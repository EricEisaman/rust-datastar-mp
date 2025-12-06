use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PlayerCommand {
    MoveLeft,
    MoveRight,
    Jump,
    Stop,
}

