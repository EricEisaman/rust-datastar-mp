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
    
    // Look up player name and generate color
    let game_state = app_state.game_state.read().await;
    let player = game_state.players.get(&request.player_id);
    
    let (player_name, player_color) = if let Some(player) = player {
        (player.name.clone(), game_core::player_color::get_player_color(&player.id))
    } else {
        // Fallback if player not found
        (format!("Player-{}", &request.player_id.to_string()[..8]), "#FFFFFF".to_string())
    };
    
    drop(game_state); // Release lock
    
    let message = game_core::ChatMessage {
        player_id: request.player_id,
        player_name,
        player_color,
        text: request.text.clone(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    // Idempotent: Broadcasting the same message multiple times is safe
    // (Datastar best practice for network resilience)
    eprintln!("💬 Attempting to broadcast chat message: player={}, text=\"{}\"", message.player_name, message.text);
    match app_state.chat_tx.send(message) {
        Ok(_) => {
            eprintln!("✅ Chat message broadcast successfully - should be received by SSE handler");
        },
        Err(e) => {
            eprintln!("❌ Failed to broadcast chat message: {:?}", e);
            eprintln!("❌ Error details: message text=\"{}\"", e.0.text);
            eprintln!("❌ This usually means no SSE clients are connected (no receivers subscribed to chat_tx)");
        },
    }
    
    // Return empty response - Datastar will update via SSE patches
    // This follows Datastar's server-driven state management pattern
    axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .body(axum::body::Body::empty())
        .unwrap()
}

