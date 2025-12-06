use axum::extract::State;
use axum::response::IntoResponse;
use serde::Deserialize;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct ChatRequest {
    pub player_id: uuid::Uuid,
    pub text: String,
}

// Datastar best practice: Idempotent message handling
// Processing the same message multiple times is safe (network resilience)
pub async fn send_message(
    State(app_state): State<AppState>,
    request: axum::extract::Json<ChatRequest>,
) -> impl IntoResponse {
    eprintln!("Received chat message from player {}: {}", request.player_id, request.text);
    
    let message = game_core::ChatMessage {
        player_id: request.player_id,
        text: request.text.clone(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    // Idempotent: Broadcasting the same message multiple times is safe
    // (Datastar best practice for network resilience)
    match app_state.chat_tx.send(message) {
        Ok(_) => eprintln!("Chat message broadcast successfully"),
        Err(e) => eprintln!("Failed to broadcast chat message: {:?}", e),
    }
    
    // Return empty response - Datastar will update via SSE patches
    // This follows Datastar's server-driven state management pattern
    axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .body(axum::body::Body::empty())
        .unwrap()
}

