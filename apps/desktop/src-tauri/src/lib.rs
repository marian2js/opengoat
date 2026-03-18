mod commands;
mod sidecar;
mod state;

use std::{net::TcpListener, time::Duration};

use tauri::{AppHandle, Manager, RunEvent};
use tokio::sync::watch;
use uuid::Uuid;

use crate::{
    sidecar::spawn_local_server,
    state::{AppState, InitStep, SidecarConnection},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (init_tx, init_rx) = watch::channel(InitStep::SidecarWaiting);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new(init_rx))
        .setup(move |app| {
            let handle = app.handle().clone();
            let init_tx = init_tx.clone();

            tauri::async_runtime::spawn(async move {
                initialize(handle, init_tx).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap::await_initialization,
            commands::bootstrap::kill_sidecar,
            commands::chat::stream_chat
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event
                && let Some(state) = app.try_state::<AppState>()
            {
                let _ = tauri::async_runtime::block_on(state.kill_sidecar());
            }
        });
}

async fn initialize(app: AppHandle, init_tx: watch::Sender<InitStep>) {
    let state = app.state::<AppState>();
    let hostname = "127.0.0.1";
    let port = next_sidecar_port();
    let password = Uuid::new_v4().to_string();
    let connection = SidecarConnection {
        url: format!("http://{hostname}:{port}"),
        username: "opengoat".to_string(),
        password: password.clone(),
        is_sidecar: true,
    };

    let spawned = match spawn_local_server(&app, hostname, port, &password) {
        Ok(spawned) => spawned,
        Err(error) => {
            state.set_initialization_error(error).await;
            let _ = init_tx.send(InitStep::Done);
            return;
        }
    };

    state.register_sidecar(spawned.handle, connection).await;
    let _ = init_tx.send(InitStep::SidecarReady);

    let initialization_result =
        tokio::time::timeout(Duration::from_secs(20), spawned.health_check.0)
            .await
            .map_err(|_| "Timed out waiting for the OpenGoat sidecar to become healthy".to_string())
            .and_then(|result| {
                result.map_err(|error| format!("Sidecar health check task failed: {error}"))?
            });

    if let Err(error) = initialization_result {
        state.set_initialization_error(error).await;
    }

    let _ = init_tx.send(InitStep::Done);
}

fn next_sidecar_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("expected loopback port allocation to succeed")
        .local_addr()
        .expect("allocated socket should have a local address")
        .port()
}
