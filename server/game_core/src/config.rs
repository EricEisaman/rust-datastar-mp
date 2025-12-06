use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConfig {
    pub physics: PhysicsConfig,
    pub platforms: Vec<PlatformConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicsConfig {
    pub gravity: f32,
    pub jump_velocity: f32,
    pub move_acceleration: f32,
    pub move_deceleration: f32,
    pub max_horizontal_velocity: f32,
    pub ground_y: f32,
    pub player_width: f32,
    pub player_height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub id: String,
    pub x_start: f32,
    pub x_end: f32,
    pub y_top: f32,
    pub height: f32,
}

impl GameConfig {
    /// Load game configuration from JSON file
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let contents = fs::read_to_string(path)?;
        let config: GameConfig = serde_json::from_str(&contents)?;
        Ok(config)
    }

    /// Load game configuration from JSON string (for network loading)
    pub fn from_json(json: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let config: GameConfig = serde_json::from_str(json)?;
        Ok(config)
    }

    /// Get default configuration (fallback if file loading fails)
    pub fn default() -> Self {
        Self {
            physics: PhysicsConfig {
                gravity: -2000.0,
                jump_velocity: 250.0,
                move_acceleration: 1200.0,
                move_deceleration: 1500.0,
                max_horizontal_velocity: 300.0,
                ground_y: -10.0,
                player_width: 1.5,
                player_height: 1.5,
            },
            platforms: vec![PlatformConfig {
                id: "platform_1".to_string(),
                x_start: -3.0,
                x_end: 3.0,
                y_top: 2.0,
                height: 0.5,
            }],
        }
    }
}

