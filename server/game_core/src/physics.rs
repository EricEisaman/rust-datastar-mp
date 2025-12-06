use crate::player::Player;
use crate::config::{GameConfig, PlatformConfig, WallConfig};
use crate::ground_state::GroundState;
use std::sync::Arc;
use std::sync::RwLock;

// Global game configuration (loaded from JSON)
static GAME_CONFIG: RwLock<Option<Arc<GameConfig>>> = RwLock::new(None);

/// Initialize physics system with game configuration
pub fn init(config: Arc<GameConfig>) {
    let mut global_config = GAME_CONFIG.write().unwrap();
    *global_config = Some(config);
}


/// Get all platforms from configuration
pub fn get_platforms() -> Vec<PlatformConfig> {
    get_config().platforms.clone()
}

/// Get all walls from configuration
pub fn get_walls() -> Vec<WallConfig> {
    get_config().walls.clone()
}

/// Get the current game configuration (public for player initialization)
pub fn get_config() -> Arc<GameConfig> {
    let config = GAME_CONFIG.read().unwrap();
    config.clone().unwrap_or_else(|| Arc::new(GameConfig::default()))
}

pub fn update_player_physics(player: &mut Player, delta_time: f32) {
    let config = get_config();
    
    // Apply gravity only if flying (not when sliding)
    if player.ground_state.is_flying() {
        player.velocity_y += config.physics.gravity * delta_time;
    }
    
    // Apply horizontal friction based on ground state
    match player.ground_state {
        GroundState::Grounded { platform_id: _ } => {
            // Normal deceleration when grounded
            let friction = config.physics.move_deceleration * delta_time;
            if player.velocity_x > 0.0 {
                player.velocity_x = (player.velocity_x - friction).max(0.0);
            } else if player.velocity_x < 0.0 {
                player.velocity_x = (player.velocity_x + friction).min(0.0);
            }
        }
        GroundState::Sliding { platform_id, .. } => {
            // Apply sliding friction (different for ground vs platform)
            let slide_friction = if platform_id.is_some() {
                config.physics.platform_slide_friction
            } else {
                config.physics.ground_slide_friction
            } * delta_time;
            
            if player.velocity_x > 0.0 {
                player.velocity_x = (player.velocity_x - slide_friction).max(0.0);
            } else if player.velocity_x < 0.0 {
                player.velocity_x = (player.velocity_x + slide_friction).min(0.0);
            }
        }
        GroundState::Flying => {
            // No friction when flying
        }
    }
    
    // Clamp velocities
    clamp_velocities(player);
    
    // Update position with continuous collision detection
    // This prevents players from moving through platforms
    update_position_with_collision(player, delta_time);
}

fn clamp_velocities(player: &mut Player) {
    let config = get_config();
    if player.velocity_x > config.physics.max_horizontal_velocity {
        player.velocity_x = config.physics.max_horizontal_velocity;
    } else if player.velocity_x < -config.physics.max_horizontal_velocity {
        player.velocity_x = -config.physics.max_horizontal_velocity;
    }
}

/// Update player position with continuous collision detection
/// This prevents players from moving through platforms by checking collisions
/// at multiple points along the movement path
fn update_position_with_collision(player: &mut Player, delta_time: f32) {
    let config = get_config();
    let player_width = config.physics.player_width;
    let player_height = config.physics.player_height;
    
    // Calculate movement
    let dx = player.velocity_x * delta_time;
    let dy = player.velocity_y * delta_time;
    
    // Move horizontally first with collision detection
    player.x += dx;
    
    // Check horizontal collision with platforms
    check_horizontal_collision(player, player_width, player_height);
    
    // Move vertically with continuous collision detection
    // Use multiple steps to prevent passing through thin platforms
    let steps = (dy.abs() / (player_height * 0.5)).max(1.0) as i32;
    let step_size = dy / steps as f32;
    
    for _ in 0..steps {
        let old_y = player.y;
        player.y += step_size;
        
        // Check vertical collision
        if check_vertical_collision(player, player_width, player_height) {
            // Collision detected, revert to previous position
            player.y = old_y;
            break;
        }
    }
    
    // Final collision check to ensure we're not penetrating anything
    resolve_collisions(player, player_width, player_height);
}

/// Check horizontal collision with platforms and walls
fn check_horizontal_collision(player: &mut Player, player_width: f32, player_height: f32) {
    let platforms = get_platforms();
    let walls = get_walls();
    let player_left = player.x - player_width / 2.0;
    let player_right = player.x + player_width / 2.0;
    let player_bottom = player.y - player_height / 2.0;
    let player_top = player.y + player_height / 2.0;
    
    // Check platform collisions
    for platform in &platforms {
        let platform_left = platform.x_start;
        let platform_right = platform.x_end;
        let platform_bottom = platform.y_top - platform.height;
        let platform_top = platform.y_top;
        
        // Check if player overlaps with platform horizontally
        let horizontal_overlap = player_right > platform_left && player_left < platform_right;
        let vertical_overlap = player_top > platform_bottom && player_bottom < platform_top;
        
        if horizontal_overlap && vertical_overlap {
            // Collision detected - properly reset position based on boundary
            if player.velocity_x > 0.0 {
                // Moving right, push player to exactly at the left boundary of platform
                player.x = platform_left - player_width / 2.0 - 0.001; // Small epsilon to prevent overlap
                player.velocity_x = 0.0;
            } else if player.velocity_x < 0.0 {
                // Moving left, push player to exactly at the right boundary of platform
                player.x = platform_right + player_width / 2.0 + 0.001; // Small epsilon to prevent overlap
                player.velocity_x = 0.0;
            } else {
                // No horizontal velocity, resolve based on which side is closer
                let dist_to_left = (player_right - platform_left).abs();
                let dist_to_right = (player_left - platform_right).abs();
                if dist_to_left < dist_to_right {
                    player.x = platform_left - player_width / 2.0 - 0.001;
                } else {
                    player.x = platform_right + player_width / 2.0 + 0.001;
                }
            }
        }
    }
    
    // Check wall collisions
    for wall in &walls {
        let wall_left = wall.x;
        let wall_right = wall.x + wall.width;
        let wall_bottom = wall.y_bottom;
        let wall_top = wall.y_top;
        
        // Check if player overlaps with wall
        let horizontal_overlap = player_right > wall_left && player_left < wall_right;
        let vertical_overlap = player_top > wall_bottom && player_bottom < wall_top;
        
        if horizontal_overlap && vertical_overlap {
            // Collision detected - properly reset position based on boundary
            if player.velocity_x > 0.0 {
                // Moving right, push player to exactly at the left boundary of wall
                player.x = wall_left - player_width / 2.0 - 0.001; // Small epsilon to prevent overlap
                player.velocity_x = 0.0;
                // Check if sliding down wall
                if player.velocity_y < 0.0 {
                    player.ground_state = GroundState::Sliding {
                        side: crate::ground_state::SlideSide::Left,
                        platform_id: None,
                    };
                }
            } else if player.velocity_x < 0.0 {
                // Moving left, push player to exactly at the right boundary of wall
                player.x = wall_right + player_width / 2.0 + 0.001; // Small epsilon to prevent overlap
                player.velocity_x = 0.0;
                // Check if sliding down wall
                if player.velocity_y < 0.0 {
                    player.ground_state = GroundState::Sliding {
                        side: crate::ground_state::SlideSide::Right,
                        platform_id: None,
                    };
                }
            } else {
                // No horizontal velocity, resolve based on which side is closer
                let dist_to_left = (player_right - wall_left).abs();
                let dist_to_right = (player_left - wall_right).abs();
                if dist_to_left < dist_to_right {
                    player.x = wall_left - player_width / 2.0 - 0.001;
                } else {
                    player.x = wall_right + player_width / 2.0 + 0.001;
                }
            }
        }
    }
}

/// Check vertical collision with ground and platforms
/// Returns true if collision was detected and resolved
fn check_vertical_collision(player: &mut Player, player_width: f32, player_height: f32) -> bool {
    let config = get_config();
    let platforms = get_platforms();
    
    let player_left = player.x - player_width / 2.0;
    let player_right = player.x + player_width / 2.0;
    let player_bottom = player.y - player_height / 2.0;
    let player_top = player.y + player_height / 2.0;
    
    // Check ground collision first - properly reset position at exact boundary
    if player_bottom <= config.physics.ground_y {
        // Reset player position to exactly at ground boundary
        player.y = config.physics.ground_y + player_height / 2.0 + 0.001; // Small epsilon to prevent overlap
        player.velocity_y = 0.0;
        player.ground_state = GroundState::Grounded { platform_id: None };
        return true;
    }
    
    // Check platform collisions
    for (idx, platform) in platforms.iter().enumerate() {
        let platform_left = platform.x_start;
        let platform_right = platform.x_end;
        let platform_bottom = platform.y_top - platform.height;
        let platform_top = platform.y_top;
        
        let horizontal_overlap = player_right > platform_left && player_left < platform_right;
        
        // Check landing on top of platform (moving down)
        if horizontal_overlap 
            && player.velocity_y <= 0.0
            && player_bottom <= platform_top + 0.05
            && player_bottom >= platform_top - 0.2 {
            // Landing on platform from above - properly reset position at exact boundary
            player.y = platform_top + player_height / 2.0 + 0.001; // Small epsilon to prevent overlap
            player.velocity_y = 0.0;
            player.ground_state = GroundState::Grounded { platform_id: Some(idx as u32) };
            return true;
        }
        
        // Check hitting platform from below (moving up)
        if horizontal_overlap
            && player.velocity_y > 0.0
            && player_top >= platform_bottom - 0.05
            && player_top <= platform_bottom + 0.2 {
            // Hit platform from below - properly reset position at exact boundary
            player.y = platform_bottom - player_height / 2.0 - 0.001; // Small epsilon to prevent overlap
            player.velocity_y = 0.0;
            return true;
        }
    }
    
    // No collision - player is flying
    player.ground_state = GroundState::Flying;
    false
}

/// Final collision resolution to fix any penetration
fn resolve_collisions(player: &mut Player, player_width: f32, player_height: f32) {
    let config = get_config();
    let platforms = get_platforms();
    let walls = get_walls();
    
    let player_left = player.x - player_width / 2.0;
    let player_right = player.x + player_width / 2.0;
    let player_bottom = player.y - player_height / 2.0;
    let player_top = player.y + player_height / 2.0;
    
    // Check ground penetration - properly reset position at exact boundary
    if player_bottom < config.physics.ground_y {
        player.y = config.physics.ground_y + player_height / 2.0 + 0.001; // Small epsilon to prevent overlap
        player.velocity_y = 0.0;
        player.ground_state = GroundState::Grounded { platform_id: None };
        return;
    }
    
    // Check wall penetration first (walls take priority for horizontal collisions)
    for wall in &walls {
        let wall_left = wall.x;
        let wall_right = wall.x + wall.width;
        let wall_bottom = wall.y_bottom;
        let wall_top = wall.y_top;
        
        let horizontal_overlap = player_right > wall_left && player_left < wall_right;
        let vertical_overlap = player_top > wall_bottom && player_bottom < wall_top;
        
        if horizontal_overlap && vertical_overlap {
            // Player is penetrating wall - resolve based on which side is closer
            let dist_to_left = (player_right - wall_left).abs();
            let dist_to_right = (player_left - wall_right).abs();
            let dist_to_top = (player_bottom - wall_top).abs();
            let dist_to_bottom = (player_top - wall_bottom).abs();
            
            let min_dist = dist_to_top.min(dist_to_bottom).min(dist_to_left).min(dist_to_right);
            
            if min_dist == dist_to_left {
                // Push left - properly reset position at exact boundary
                player.x = wall_left - player_width / 2.0 - 0.001; // Small epsilon to prevent overlap
                if player.velocity_y < 0.0 {
                    // Sliding down left side of wall
                    player.ground_state = GroundState::Sliding {
                        side: crate::ground_state::SlideSide::Left,
                        platform_id: None,
                    };
                } else {
                    player.velocity_x = 0.0;
                }
            } else if min_dist == dist_to_right {
                // Push right - properly reset position at exact boundary
                player.x = wall_right + player_width / 2.0 + 0.001; // Small epsilon to prevent overlap
                if player.velocity_y < 0.0 {
                    // Sliding down right side of wall
                    player.ground_state = GroundState::Sliding {
                        side: crate::ground_state::SlideSide::Right,
                        platform_id: None,
                    };
                } else {
                    player.velocity_x = 0.0;
                }
            } else if min_dist == dist_to_top && player_bottom < wall_top {
                // Push up to top of wall - properly reset position at exact boundary
                player.y = wall_top + player_height / 2.0 + 0.001; // Small epsilon to prevent overlap
                player.velocity_y = 0.0;
            } else if min_dist == dist_to_bottom && player_top > wall_bottom {
                // Push down below wall - properly reset position at exact boundary
                player.y = wall_bottom - player_height / 2.0 - 0.001; // Small epsilon to prevent overlap
                player.velocity_y = 0.0;
            }
            return;
        }
    }
    
    // Check platform penetration
    for (idx, platform) in platforms.iter().enumerate() {
        let platform_left = platform.x_start;
        let platform_right = platform.x_end;
        let platform_bottom = platform.y_top - platform.height;
        let platform_top = platform.y_top;
        
        let horizontal_overlap = player_right > platform_left && player_left < platform_right;
        let vertical_overlap = player_top > platform_bottom && player_bottom < platform_top;
        
        if horizontal_overlap && vertical_overlap {
            // Player is penetrating platform - resolve based on which side is closer
            let dist_to_top = (player_bottom - platform_top).abs();
            let dist_to_bottom = (player_top - platform_bottom).abs();
            let dist_to_left = (player_right - platform_left).abs();
            let dist_to_right = (player_left - platform_right).abs();
            
            let min_dist = dist_to_top.min(dist_to_bottom).min(dist_to_left).min(dist_to_right);
            
            if min_dist == dist_to_top && player_bottom < platform_top {
                // Push up to top of platform - properly reset position at exact boundary
                player.y = platform_top + player_height / 2.0 + 0.001; // Small epsilon to prevent overlap
                player.velocity_y = 0.0;
                player.ground_state = GroundState::Grounded { platform_id: Some(idx as u32) };
            } else if min_dist == dist_to_bottom && player_top > platform_bottom {
                // Push down below platform - properly reset position at exact boundary
                player.y = platform_bottom - player_height / 2.0 - 0.001; // Small epsilon to prevent overlap
                player.velocity_y = 0.0;
            } else if min_dist == dist_to_left {
                // Push left - properly reset position at exact boundary
                player.x = platform_left - player_width / 2.0 - 0.001; // Small epsilon to prevent overlap
                if player.velocity_y < 0.0 {
                    // Sliding down left side
                    player.ground_state = GroundState::Sliding { 
                        side: crate::ground_state::SlideSide::Left, 
                        platform_id: Some(idx as u32) 
                    };
                } else {
                    player.velocity_x = 0.0;
                }
            } else if min_dist == dist_to_right {
                // Push right - properly reset position at exact boundary
                player.x = platform_right + player_width / 2.0 + 0.001; // Small epsilon to prevent overlap
                if player.velocity_y < 0.0 {
                    // Sliding down right side
                    player.ground_state = GroundState::Sliding { 
                        side: crate::ground_state::SlideSide::Right, 
                        platform_id: Some(idx as u32) 
                    };
                } else {
                    player.velocity_x = 0.0;
                }
            }
            return;
        }
    }
}

pub fn apply_command(player: &mut Player, command: &crate::commands::PlayerCommand) {
    let config = get_config();
    match command {
        crate::commands::PlayerCommand::MoveLeft => {
            // Horizontal controls while in flying state should not affect anything
            if player.ground_state.is_flying() {
                return;
            }
            
            // Apply acceleration, but clamp to max velocity
            // When grounded, this enables smooth horizontal movement that can transition to sliding
            player.velocity_x = (player.velocity_x - config.physics.move_acceleration * 0.016)
                .max(-config.physics.max_horizontal_velocity);
            player.facing_right = false;
        }
        crate::commands::PlayerCommand::MoveRight => {
            // Horizontal controls while in flying state should not affect anything
            if player.ground_state.is_flying() {
                return;
            }
            
            // Apply acceleration, but clamp to max velocity
            // When grounded, this enables smooth horizontal movement that can transition to sliding
            player.velocity_x = (player.velocity_x + config.physics.move_acceleration * 0.016)
                .min(config.physics.max_horizontal_velocity);
            player.facing_right = true;
        }
        crate::commands::PlayerCommand::Jump => {
            // Only jump if grounded (not sliding or flying)
            if player.ground_state.is_grounded() {
                player.velocity_y = config.physics.jump_velocity;
                player.ground_state = GroundState::Flying;
            }
        }
        crate::commands::PlayerCommand::Stop => {
            // Stop horizontal movement immediately
            player.velocity_x = 0.0;
        }
    }
}
