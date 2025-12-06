use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConfig {
    pub physics: PhysicsConfig,
    pub platforms: Vec<PlatformConfig>,
    pub walls: Vec<WallConfig>,
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
    /// Friction when sliding on ground (applied to horizontal velocity)
    pub ground_slide_friction: f32,
    /// Friction when sliding on platforms (applied to horizontal velocity)
    pub platform_slide_friction: f32,
    /// Ground color as hex string (e.g., "#8B6F47")
    pub ground_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub id: String,
    pub x_start: f32,
    pub x_end: f32,
    pub y_top: f32,
    pub height: f32,
    /// Platform color as hex string (e.g., "#B34733")
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WallConfig {
    pub id: String,
    /// Left edge x position of the wall
    pub x: f32,
    /// Bottom y position of the wall
    pub y_bottom: f32,
    /// Top y position of the wall
    pub y_top: f32,
    /// Width (thickness) of the wall
    pub width: f32,
    /// Wall color as hex string (e.g., "#666666")
    pub color: String,
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
                ground_slide_friction: 800.0,
                platform_slide_friction: 600.0,
                ground_color: "#8B6F47".to_string(),
            },
            platforms: vec![PlatformConfig {
                id: "platform_1".to_string(),
                x_start: -3.0,
                x_end: 3.0,
                y_top: 2.0,
                height: 0.5,
                color: "#B34733".to_string(),
            }],
            walls: vec![],
        }
    }
}

