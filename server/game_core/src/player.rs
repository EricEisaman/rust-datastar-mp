use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::ground_state::GroundState;
use crate::physics::get_config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: Uuid,
    pub name: String,
    pub x: f32,
    pub y: f32,
    pub velocity_x: f32,
    pub velocity_y: f32,
    pub facing_right: bool,
    pub ground_state: GroundState,
}

impl Player {
    /// Create a new player at the configured starting position
    /// Player starts on the ground at: ground_y + player_height/2
    pub fn new(id: Uuid) -> Self {
        // Get config to determine starting position
        let config = get_config();
        let ground_y = config.physics.ground_y;
        let player_height = config.physics.player_height;
        
        // Player center when on ground = ground_y + player_height/2
        let start_y = ground_y + player_height / 2.0;
        
        // Generate a random name for the player
        let name = Self::generate_random_name(&id);
        
        Self {
            id,
            name,
            x: 0.0,
            y: start_y, // Start on ground using config values
            velocity_x: 0.0,
            velocity_y: 0.0,
            facing_right: true,
            ground_state: GroundState::Grounded { platform_id: None }, // Start on ground
        }
    }
    
    /// Generate a random name based on player ID for consistency
    fn generate_random_name(id: &Uuid) -> String {
        // List of name prefixes and suffixes for variety
        let prefixes = [
            "Shadow", "Swift", "Brave", "Mighty", "Silent", "Fierce", "Noble", "Wild",
            "Dark", "Bright", "Storm", "Fire", "Ice", "Thunder", "Light", "Night",
            "Steel", "Crystal", "Dragon", "Wolf", "Eagle", "Falcon", "Tiger", "Lion",
        ];
        
        let suffixes = [
            "Warrior", "Hunter", "Ranger", "Guardian", "Knight", "Rogue", "Mage", "Sage",
            "Blade", "Fang", "Claw", "Wing", "Storm", "Flame", "Frost", "Shade",
            "Strike", "Dash", "Leap", "Rush", "Bolt", "Flash", "Beam", "Ray",
        ];
        
        // Use UUID bytes to generate deterministic but random-looking name
        let bytes = id.as_bytes();
        let prefix_idx = (bytes[0] as usize) % prefixes.len();
        let suffix_idx = (bytes[1] as usize) % suffixes.len();
        
        format!("{}{}", prefixes[prefix_idx], suffixes[suffix_idx])
    }
}

pub type PlayerId = Uuid;

