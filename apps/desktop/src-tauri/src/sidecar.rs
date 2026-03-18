use std::{
    io,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

#[cfg(unix)]
use std::os::unix::process::ExitStatusExt;

use tauri::{AppHandle, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncRead, BufReader},
    process::Command,
    sync::{mpsc, oneshot},
    task::JoinHandle,
};

#[derive(Clone, Debug)]
pub struct SidecarHandle {
    kill: mpsc::Sender<()>,
}

impl SidecarHandle {
    pub async fn kill(&self) -> io::Result<()> {
        self.kill
            .send(())
            .await
            .map_err(|error| io::Error::other(error.to_string()))
    }
}

pub struct SpawnedSidecar {
    pub handle: SidecarHandle,
    pub health_check: HealthCheck,
}

pub struct HealthCheck(pub JoinHandle<Result<(), String>>);

#[derive(Clone, Copy, Debug)]
struct ExitPayload {
    code: Option<i32>,
    signal: Option<i32>,
}

pub fn spawn_local_server(
    app: &AppHandle,
    hostname: &str,
    port: u16,
    password: &str,
) -> Result<SpawnedSidecar, String> {
    let mut command = build_sidecar_command(app)?;
    command
        .arg("--hostname")
        .arg(hostname)
        .arg("--port")
        .arg(port.to_string())
        .arg("--username")
        .arg("opengoat")
        .arg("--password")
        .arg(password)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to spawn OpenGoat sidecar: {error}"))?;

    if let Some(stdout) = child.stdout.take() {
        spawn_pipe_logger("stdout", stdout);
    }

    if let Some(stderr) = child.stderr.take() {
        spawn_pipe_logger("stderr", stderr);
    }

    let (kill_tx, mut kill_rx) = mpsc::channel::<()>(1);
    let (exit_tx, exit_rx) = oneshot::channel::<ExitPayload>();

    tokio::spawn(async move {
        let status = tokio::select! {
            _ = kill_rx.recv() => {
                let _ = child.kill().await;
                child.wait().await
            }
            result = child.wait() => result,
        };

        let payload = match status {
            Ok(status) => ExitPayload {
                code: status.code(),
                signal: signal_from_status(status),
            },
            Err(error) => {
                eprintln!("[sidecar] failed to await exit: {error}");
                ExitPayload {
                    code: None,
                    signal: None,
                }
            }
        };

        let _ = exit_tx.send(payload);
    });

    Ok(SpawnedSidecar {
        handle: SidecarHandle { kill: kill_tx },
        health_check: HealthCheck(tokio::spawn(wait_for_health(
            hostname.to_string(),
            port,
            password.to_string(),
            exit_rx,
        ))),
    })
}

async fn wait_for_health(
    hostname: String,
    port: u16,
    password: String,
    exit_rx: oneshot::Receiver<ExitPayload>,
) -> Result<(), String> {
    let url = format!("http://{hostname}:{port}");

    let ready = async {
        loop {
            tokio::time::sleep(Duration::from_millis(100)).await;
            if check_health(&url, &password).await {
                return Ok(());
            }
        }
    };

    let terminated = async {
        match exit_rx.await {
            Ok(payload) => Err(format!(
                "Sidecar terminated before becoming healthy (code={:?} signal={:?})",
                payload.code, payload.signal
            )),
            Err(_) => Err("Sidecar exit channel closed unexpectedly".to_string()),
        }
    };

    tokio::select! {
        ready_result = ready => ready_result,
        terminated_result = terminated => terminated_result,
    }
}

async fn check_health(base_url: &str, password: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(base_url) else {
        return false;
    };

    let mut client_builder = reqwest::Client::builder().timeout(Duration::from_secs(5));

    if url
        .host_str()
        .is_some_and(|host| host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1")
    {
        client_builder = client_builder.no_proxy();
    }

    let Ok(client) = client_builder.build() else {
        return false;
    };

    let Ok(health_url) = url.join("/global/health") else {
        return false;
    };

    client
        .get(health_url)
        .basic_auth("opengoat", Some(password))
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

fn build_sidecar_command(app: &AppHandle) -> Result<Command, String> {
    if cfg!(debug_assertions) {
        let sidecar_dir = workspace_root().join("packages/sidecar");
        let mut command = Command::new("pnpm");
        command.arg("--dir").arg(sidecar_dir).arg("dev");
        return Ok(command);
    }

    let entrypoint = sidecar_entrypoint(app)?;
    let node_binary = packaged_node_binary(app)
        .and_then(|candidate| candidate.exists().then_some(candidate))
        .or_else(|| std::env::var("OPENGOAT_NODE_BINARY").ok().map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("node"));
    let mut command = Command::new(node_binary);
    command.arg(entrypoint);
    Ok(command)
}

fn sidecar_entrypoint(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("sidecar/dist/cli.js");
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    let candidate = workspace_root().join("packages/sidecar/dist/cli.js");
    if candidate.exists() {
        return Ok(candidate);
    }

    Err(format!(
        "Could not locate sidecar entrypoint. Expected {}",
        candidate.display()
    ))
}

fn packaged_node_binary(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|resource_dir| resource_dir.join("sidecar/node/bin/node"))
}

fn workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("workspace root should exist at compile time")
}

fn spawn_pipe_logger(
    stream_name: &'static str,
    pipe: impl AsyncRead + Send + Unpin + 'static,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut lines = BufReader::new(pipe).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[sidecar:{stream_name}] {line}");
        }
    })
}

fn signal_from_status(status: std::process::ExitStatus) -> Option<i32> {
    #[cfg(unix)]
    {
        status.signal()
    }

    #[cfg(not(unix))]
    {
        let _ = status;
        None
    }
}
