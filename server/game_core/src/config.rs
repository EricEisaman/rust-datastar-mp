use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConfig {
    /// Optional URL to fetch configuration from remotely
    /// If set, the server will fetch config from this URL instead of using local file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_config: Option<String>,
    /// Idle timeout in seconds - players inactive for this duration will be disconnected
    /// Default: 180 seconds (3 minutes)
    #[serde(default = "default_idle_timeout")]
    pub idle_timeout: u64,
    pub physics: PhysicsConfig,
    pub platforms: Vec<PlatformConfig>,
    pub walls: Vec<WallConfig>,
}

fn default_idle_timeout() -> u64 {
    180 // 3 minutes default
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
    /// Load game configuration from JSON file synchronously
    /// This is a convenience wrapper for sync contexts
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let contents = fs::read_to_string(path)?;
        let config: GameConfig = serde_json::from_str(&contents)?;
        
        // If remote_config is specified, we can't fetch it synchronously
        // This will be handled by load_async instead
        if let Some(remote_url) = &config.remote_config {
            if !remote_url.is_empty() {
                eprintln!("⚠️ remote_config found but load() is synchronous. Use load_async() instead.");
                eprintln!("⚠️ Using local config file (remote config will not be fetched)");
            }
        }
        
        Ok(config)
    }

    /// Load game configuration from JSON file asynchronously
    /// If the config contains a remote_config URL, it will fetch and use that instead
    pub async fn load_async<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let path = path.as_ref();
        let contents = tokio::fs::read_to_string(path).await?;
        let config: GameConfig = serde_json::from_str(&contents)?;
        
        // Check if remote_config is specified
        if let Some(remote_url) = &config.remote_config {
            if !remote_url.is_empty() {
                match Self::fetch_remote_config(remote_url).await {
                    Ok(remote_config) => {
                        eprintln!("✅ Successfully fetched remote config from: {}", remote_url);
                        Ok(remote_config)
                    }
                    Err(e) => {
                        eprintln!("⚠️ Failed to fetch remote config from {}: {}, using local config", remote_url, e);
                        Ok(config)
                    }
                }
            } else {
                Ok(config)
            }
        } else {
            Ok(config)
        }
    }

    /// Fetch configuration from a remote URL
    async fn fetch_remote_config(url: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?;
        
        let response = client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()).into());
        }
        
        let json_text = response.text().await?;
        
        // Parse the remote config (should not have remote_config field)
        let config: GameConfig = serde_json::from_str(&json_text)?;
        
        // Ensure remote_config is None in the fetched config (prevent recursion)
        Ok(GameConfig {
            remote_config: None,
            idle_timeout: config.idle_timeout,
            physics: config.physics,
            platforms: config.platforms,
            walls: config.walls,
        })
    }

    /// Load game configuration from JSON string (for network loading)
    pub fn from_json(json: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let config: GameConfig = serde_json::from_str(json)?;
        Ok(config)
    }

    /// Get default configuration (fallback if file loading fails)
    pub fn default() -> Self {
        Self {
            remote_config: None,
            idle_timeout: 180, // 3 minutes default
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

