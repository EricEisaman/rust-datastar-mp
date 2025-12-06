use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub player_id: Uuid,
    pub text: String,
    pub timestamp: u64,
}

