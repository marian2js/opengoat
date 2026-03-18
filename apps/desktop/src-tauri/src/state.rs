use serde::Serialize;
use tokio::sync::{Mutex, RwLock, watch};

use crate::sidecar::SidecarHandle;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InitStep {
    SidecarWaiting,
    SidecarReady,
    Done,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SidecarConnection {
    pub url: String,
    pub username: String,
    pub password: String,
    pub is_sidecar: bool,
}

pub struct AppState {
    init_state: watch::Receiver<InitStep>,
    initialization_error: RwLock<Option<String>>,
    sidecar: Mutex<Option<SidecarHandle>>,
    sidecar_connection: RwLock<Option<SidecarConnection>>,
}

impl AppState {
    pub fn new(init_state: watch::Receiver<InitStep>) -> Self {
        Self {
            init_state,
            initialization_error: RwLock::new(None),
            sidecar: Mutex::new(None),
            sidecar_connection: RwLock::new(None),
        }
    }

    pub fn init_state(&self) -> watch::Receiver<InitStep> {
        self.init_state.clone()
    }

    pub async fn initialization_error(&self) -> Option<String> {
        self.initialization_error.read().await.clone()
    }

    pub async fn sidecar_connection(&self) -> Option<SidecarConnection> {
        self.sidecar_connection.read().await.clone()
    }

    pub async fn register_sidecar(&self, handle: SidecarHandle, connection: SidecarConnection) {
        *self.sidecar.lock().await = Some(handle);
        *self.sidecar_connection.write().await = Some(connection);
    }

    pub async fn set_initialization_error(&self, message: String) {
        *self.initialization_error.write().await = Some(message);
    }

    pub async fn kill_sidecar(&self) -> Result<(), String> {
        let Some(handle) = self.sidecar.lock().await.take() else {
            return Ok(());
        };

        handle
            .kill()
            .await
            .map_err(|error| format!("Failed to stop sidecar: {error}"))
    }
}

impl Default for AppState {
    fn default() -> Self {
        let (_init_tx, init_rx) = watch::channel(InitStep::Done);
        Self::new(init_rx)
    }
}
