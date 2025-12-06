use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};
use game_core::GameState;

#[derive(Clone)]
pub struct AppState {
    pub game_state: Arc<RwLock<GameState>>,
    pub game_tx: broadcast::Sender<crate::GameUpdate>,
    pub chat_tx: broadcast::Sender<game_core::ChatMessage>,
    pub command_tx: mpsc::Sender<(uuid::Uuid, game_core::PlayerCommand)>,
}

