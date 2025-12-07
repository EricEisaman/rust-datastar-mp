use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CommandRequest {
    pub player_id: uuid::Uuid,
    pub command: game_core::PlayerCommand,
}

#[derive(Deserialize)]
pub struct InitRequest {
    pub player_id: uuid::Uuid,
}

// Initialize a player when they first connect
pub async fn init_player(
    State(app_state): State<AppState>,
    Json(request): Json<InitRequest>,
) -> impl axum::response::IntoResponse {
    // Add player to game state if they don't exist (idempotent)
    {
        let mut game_state = app_state.game_state.write().await;
        if !game_state.players.contains_key(&request.player_id) {
            game_state.add_player(request.player_id);
        }
    }
    
    // Return empty response - state updates come via SSE (Datastar best practice)
    axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .body(axum::body::Body::empty())
        .unwrap()
}

// Datastar best practice: Idempotent command handling
// Processing the same command multiple times should be safe
pub async fn player_command(
    State(app_state): State<AppState>,
    Json(request): Json<CommandRequest>,
) -> impl axum::response::IntoResponse {
    // Add player to game state if they don't exist (idempotent)
    // Update activity timestamp when player sends a command
    {
        let mut game_state = app_state.game_state.write().await;
        if !game_state.players.contains_key(&request.player_id) {
            game_state.add_player(request.player_id);
        }
        // Update activity timestamp
        if let Some(player) = game_state.players.get_mut(&request.player_id) {
            player.update_activity();
        }
    }
    
    // Send command to game loop (idempotent - game loop handles deduplication)
    if let Err(e) = app_state.command_tx.send((request.player_id, request.command)).await {
        eprintln!("❌ Failed to send command to game loop: {:?}", e);
    }
    
    // Return empty response - state updates come via SSE (Datastar best practice)
    axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .body(axum::body::Body::empty())
        .unwrap()
}

