use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub player_id: Uuid,
    pub player_name: String,
    pub player_color: String, // Hex color string
    pub text: String,
    pub timestamp: u64,
}

