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
    // Look up player name and generate color, update activity timestamp
    let (player_name, player_color) = {
        let mut game_state = app_state.game_state.write().await;
        let player = game_state.players.get_mut(&request.player_id);
        
        if let Some(player) = player {
            // Update activity timestamp when player sends chat
            player.update_activity();
            (player.name.clone(), game_core::player_color::get_player_color(&player.id))
        } else {
            // Fallback if player not found
            (format!("Player-{}", &request.player_id.to_string()[..8]), "#FFFFFF".to_string())
        }
    };
    
    // Log received message before creating ChatMessage (player_name will be moved)
    eprintln!("📨 Server received chat message from {} ({}): \"{}\"", player_name, request.player_id, request.text);
    
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
    if let Err(e) = app_state.chat_tx.send(message) {
        eprintln!("❌ Failed to broadcast chat message: {:?}", e);
    }
    
    // Return empty response - Datastar will update via SSE patches
    // This follows Datastar's server-driven state management pattern
    axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .body(axum::body::Body::empty())
        .unwrap()
}

