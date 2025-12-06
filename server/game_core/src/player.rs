use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: Uuid,
    pub x: f32,
    pub y: f32,
    pub velocity_x: f32,
    pub velocity_y: f32,
    pub facing_right: bool,
    pub on_ground: bool,
}

impl Player {
    pub fn new(id: Uuid) -> Self {
        Self {
            id,
            x: 0.0,
            y: -8.0, // Start at y=-8 (just above ground at y=-10, on the ground)
            velocity_x: 0.0,
            velocity_y: 0.0,
            facing_right: true,
            on_ground: true, // Start on ground
        }
    }
}

pub type PlayerId = Uuid;

