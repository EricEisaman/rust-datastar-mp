use crate::player::Player;
use crate::config::{GameConfig, PlatformConfig};
use std::sync::Arc;
use std::sync::RwLock;

// Global game configuration (loaded from JSON)
static GAME_CONFIG: RwLock<Option<Arc<GameConfig>>> = RwLock::new(None);

/// Initialize physics system with game configuration
pub fn init(config: Arc<GameConfig>) {
    let mut global_config = GAME_CONFIG.write().unwrap();
    *global_config = Some(config);
}

/// Get the current game configuration
fn get_config() -> Arc<GameConfig> {
    let config = GAME_CONFIG.read().unwrap();
    config.clone().unwrap_or_else(|| Arc::new(GameConfig::default()))
}

/// Get all platforms from configuration
pub fn get_platforms() -> Vec<PlatformConfig> {
    get_config().platforms.clone()
}

pub fn update_player_physics(player: &mut Player, delta_time: f32) {
    apply_gravity(player, delta_time);
    apply_horizontal_friction(player, delta_time);
    clamp_velocities(player);
    update_position(player, delta_time);
    check_ground_collision(player);
}

fn apply_gravity(player: &mut Player, delta_time: f32) {
    if !player.on_ground {
        let config = get_config();
        player.velocity_y += config.physics.gravity * delta_time;
    }
}

fn apply_horizontal_friction(player: &mut Player, delta_time: f32) {
    if player.on_ground {
        let config = get_config();
        let friction = config.physics.move_deceleration * delta_time;
        if player.velocity_x > 0.0 {
            player.velocity_x = (player.velocity_x - friction).max(0.0);
        } else if player.velocity_x < 0.0 {
            player.velocity_x = (player.velocity_x + friction).min(0.0);
        }
    }
}

fn clamp_velocities(player: &mut Player) {
    let config = get_config();
    if player.velocity_x > config.physics.max_horizontal_velocity {
        player.velocity_x = config.physics.max_horizontal_velocity;
    } else if player.velocity_x < -config.physics.max_horizontal_velocity {
        player.velocity_x = -config.physics.max_horizontal_velocity;
    }
}

fn update_position(player: &mut Player, delta_time: f32) {
    player.x += player.velocity_x * delta_time;
    player.y += player.velocity_y * delta_time;
}

fn check_ground_collision(player: &mut Player) {
    let config = get_config();
    let platforms = get_platforms();
    
    // 2D side-scroller: Y increases UP, ground is at bottom
    // Player dimensions from configuration
    let player_width = config.physics.player_width;
    let player_height = config.physics.player_height;
    
    // Calculate player bounding box (AABB - Axis-Aligned Bounding Box)
    let player_left = player.x - player_width / 2.0;
    let player_right = player.x + player_width / 2.0;
    let player_bottom = player.y - player_height / 2.0;
    let player_top = player.y + player_height / 2.0;
    
    // Check if player is on the ground (at bottom of screen)
    if player_bottom <= config.physics.ground_y {
        player.y = config.physics.ground_y + player_height / 2.0; // Position player on top of ground
        player.velocity_y = 0.0;
        player.on_ground = true;
        return;
    }
    
    // Check collision with all platforms
    for platform in &platforms {
        // Platform bounding box (AABB)
        let platform_left = platform.x_start;
        let platform_right = platform.x_end;
        let platform_bottom = platform.y_top - platform.height;
        let platform_top = platform.y_top;
        
        // Rectangle collision detection (AABB)
        // Check if player rectangle overlaps with platform rectangle
        let horizontal_overlap = player_right > platform_left && player_left < platform_right;
        let vertical_overlap = player_top > platform_bottom && player_bottom < platform_top;
        
        if horizontal_overlap && vertical_overlap {
            // Player is colliding with platform
            // Determine collision direction based on velocity and position
            
            // Landing from above: player is moving down and bottom is near platform top
            if player.velocity_y <= 0.0 && player_bottom <= platform_top && player_bottom >= platform_top - 0.2 {
                // Player is landing on platform from above
                player.y = platform_top + player_height / 2.0; // Position player on top of platform
                player.velocity_y = 0.0;
                player.on_ground = true;
                return;
            }
            
            // Hitting from below: player is moving up and top is near platform bottom
            if player.velocity_y > 0.0 && player_top >= platform_bottom && player_top <= platform_bottom + 0.2 {
                // Player hits platform from below - stop upward movement
                player.y = platform_bottom - player_height / 2.0;
                player.velocity_y = 0.0;
                return;
            }
            
            // Hitting from sides: horizontal collision
            if player.velocity_x > 0.0 && player_left < platform_right && player_right > platform_right {
                // Hitting right side of platform
                player.x = platform_right - player_width / 2.0;
                player.velocity_x = 0.0;
            } else if player.velocity_x < 0.0 && player_right > platform_left && player_left < platform_left {
                // Hitting left side of platform
                player.x = platform_left + player_width / 2.0;
                player.velocity_x = 0.0;
            }
        }
        
        // Check if player is standing on this platform (not just colliding, but actually on top)
        if horizontal_overlap 
            && player_bottom >= platform_top - 0.1 
            && player_bottom <= platform_top + 0.1
            && player.velocity_y <= 0.0 {
            // Player is standing on platform
            player.on_ground = true;
            return; // Found a platform to stand on, no need to check others
        }
    }
    
    // Player is in the air (not on ground or any platform)
    player.on_ground = false;
}

pub fn apply_command(player: &mut Player, command: &crate::commands::PlayerCommand) {
    let config = get_config();
    match command {
        crate::commands::PlayerCommand::MoveLeft => {
            player.velocity_x -= config.physics.move_acceleration * 0.016;
            player.facing_right = false;
        }
        crate::commands::PlayerCommand::MoveRight => {
            player.velocity_x += config.physics.move_acceleration * 0.016;
            player.facing_right = true;
        }
        crate::commands::PlayerCommand::Jump => {
            if player.on_ground {
                player.velocity_y = config.physics.jump_velocity;
                player.on_ground = false;
            }
        }
        crate::commands::PlayerCommand::Stop => {
            player.velocity_x = 0.0;
        }
    }
}

