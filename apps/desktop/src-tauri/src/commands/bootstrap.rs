use tauri::{State, ipc::Channel};

use crate::state::{AppState, InitStep, SidecarConnection};

#[tauri::command]
pub async fn await_initialization(
    state: State<'_, AppState>,
    events: Channel<InitStep>,
) -> Result<SidecarConnection, String> {
    let mut init_state = state.init_state();
    let mut current = *init_state.borrow();
    let _ = events.send(current);

    while !matches!(current, InitStep::Done) {
        init_state
            .changed()
            .await
            .map_err(|_| "Initialization channel closed unexpectedly".to_string())?;
        current = *init_state.borrow_and_update();
        let _ = events.send(current);
    }

    if let Some(error) = state.initialization_error().await {
        return Err(error);
    }

    state
        .sidecar_connection()
        .await
        .ok_or_else(|| "Sidecar connection was not initialized".to_string())
}

#[tauri::command]
pub async fn kill_sidecar(state: State<'_, AppState>) -> Result<(), String> {
    state.kill_sidecar().await
}
