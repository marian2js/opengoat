use std::str;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{State, ipc::Channel};

use crate::state::AppState;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamRequest {
    pub agent_id: Option<String>,
    pub message: Value,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChatStreamEvent {
    Chunk { chunk: Value },
    Done,
    Error { message: String },
}

#[tauri::command]
pub async fn stream_chat(
    state: State<'_, AppState>,
    payload: ChatStreamRequest,
    events: Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let connection = state
        .sidecar_connection()
        .await
        .ok_or_else(|| "Sidecar connection was not initialized".to_string())?;

    let result = stream_chat_response(&connection, payload, &events).await;
    if let Err(error) = result {
        let _ = events.send(ChatStreamEvent::Error { message: error });
        let _ = events.send(ChatStreamEvent::Done);
    }

    Ok(())
}

async fn stream_chat_response(
    connection: &crate::state::SidecarConnection,
    payload: ChatStreamRequest,
    events: &Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let client = Client::new();
    let response = client
        .post(format!("{}/chat", connection.url))
        .basic_auth(&connection.username, Some(&connection.password))
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Failed to start chat request: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read error body".to_string());
        return Err(format!("Chat request failed with status {status}: {body}"));
    }

    let mut buffer = String::new();
    let mut response = response;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Failed to read chat stream: {error}"))?
    {
        let text = str::from_utf8(&chunk)
            .map_err(|error| format!("Chat stream contained invalid UTF-8: {error}"))?;
        buffer.push_str(text);

        while let Some(frame_end) = buffer.find("\n\n") {
            let frame = buffer[..frame_end].to_string();
            buffer.drain(..frame_end + 2);
            handle_sse_frame(&frame, events)?;
        }
    }

    if !buffer.trim().is_empty() {
        handle_sse_frame(&buffer, events)?;
    }

    let _ = events.send(ChatStreamEvent::Done);
    Ok(())
}

fn handle_sse_frame(frame: &str, events: &Channel<ChatStreamEvent>) -> Result<(), String> {
    let parsed = parse_sse_frame(frame)?;
    for chunk in parsed.chunks {
        let _ = events.send(ChatStreamEvent::Chunk { chunk });
    }
    if parsed.done {
        let _ = events.send(ChatStreamEvent::Done);
    }

    Ok(())
}

struct ParsedSseFrame {
    chunks: Vec<Value>,
    done: bool,
}

fn parse_sse_frame(frame: &str) -> Result<ParsedSseFrame, String> {
    let mut chunks = Vec::new();
    let mut done = false;

    for line in frame.lines() {
        let Some(raw_data) = line.strip_prefix("data:") else {
            continue;
        };

        let data = raw_data.trim();
        if data.is_empty() {
            continue;
        }

        if data == "[DONE]" {
            done = true;
            continue;
        }

        let chunk = serde_json::from_str::<Value>(data)
            .map_err(|error| format!("Failed to parse chat stream chunk: {error}"))?;
        chunks.push(chunk);
    }

    Ok(ParsedSseFrame { chunks, done })
}

#[cfg(test)]
mod tests {
    use super::parse_sse_frame;
    use serde_json::json;

    #[test]
    fn parses_data_frames() {
        let result = parse_sse_frame(
            "event: message\ndata: {\"type\":\"text-start\",\"id\":\"a\"}\n\ndata: [DONE]\n",
        );

        let parsed = result.expect("expected SSE parsing to succeed");
        assert_eq!(parsed.chunks, vec![json!({ "type": "text-start", "id": "a" })]);
        assert!(parsed.done);
    }
}
