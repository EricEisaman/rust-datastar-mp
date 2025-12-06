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
    eprintln!("🎮 Initializing player: {}", request.player_id);
    
    // Add player to game state if they don't exist (idempotent)
    {
        let mut game_state = app_state.game_state.write().await;
        let player_count_before = game_state.players.len();
        
        if !game_state.players.contains_key(&request.player_id) {
            eprintln!("✅ Adding new player to game state: {} (total players: {} -> {})", 
                request.player_id, player_count_before, player_count_before + 1);
            game_state.add_player(request.player_id);
        } else {
            eprintln!("♻️ Player {} already exists in game state (total: {})", 
                request.player_id, game_state.players.len());
        }
        
        eprintln!("📊 Current game state has {} players", game_state.players.len());
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
    eprintln!("Received command from player {}: {:?}", request.player_id, request.command);
    
    // Add player to game state if they don't exist (idempotent)
    {
        let mut game_state = app_state.game_state.write().await;
        let player_count_before = game_state.players.len();
        
        if !game_state.players.contains_key(&request.player_id) {
            eprintln!("✅ Adding new player to game state via command: {} (total: {} -> {})", 
                request.player_id, player_count_before, player_count_before + 1);
            game_state.add_player(request.player_id);
        }
        
        eprintln!("📊 Game state now has {} players", game_state.players.len());
    }
    
    // Send command to game loop (idempotent - game loop handles deduplication)
    match app_state.command_tx.send((request.player_id, request.command)).await {
        Ok(_) => eprintln!("Command sent to game loop"),
        Err(e) => eprintln!("Failed to send command to game loop: {:?}", e),
    }
    
    // Return empty response - state updates come via SSE (Datastar best practice)
    axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .body(axum::body::Body::empty())
        .unwrap()
}

