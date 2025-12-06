use crate::player::Player;

// 2D Side-scroller physics: Y increases UP, ground is at bottom
pub const GRAVITY: f32 = -2000.0; // Negative = pulls DOWN (toward ground) - stronger gravity
pub const JUMP_VELOCITY: f32 = 250.0; // Positive = jumps UP - reduced for better feel
pub const MOVE_ACCELERATION: f32 = 1200.0;
pub const MOVE_DECELERATION: f32 = 1500.0;
pub const MAX_HORIZONTAL_VELOCITY: f32 = 300.0;
pub const GROUND_Y: f32 = -10.0; // Ground at y=-10 in world units (bottom of screen)

// Platform definitions for Metroidvania gameplay
// Platform is 6 meters (6 world units) wide, positioned above ground
pub const PLATFORM_Y: f32 = 5.0; // Platform top at y=5 in world coords (above ground, middle of view)
pub const PLATFORM_X_START: f32 = -3.0; // Platform starts at x=-3 (3 meters left of center)
pub const PLATFORM_X_END: f32 = 3.0; // Platform ends at x=3 (3 meters right of center, total 6 meters)
pub const PLATFORM_HEIGHT: f32 = 0.5; // Platform is 0.5 world units tall

pub fn update_player_physics(player: &mut Player, delta_time: f32) {
    apply_gravity(player, delta_time);
    apply_horizontal_friction(player, delta_time);
    clamp_velocities(player);
    update_position(player, delta_time);
    check_ground_collision(player);
}

fn apply_gravity(player: &mut Player, delta_time: f32) {
    if !player.on_ground {
        player.velocity_y += GRAVITY * delta_time;
    }
}

fn apply_horizontal_friction(player: &mut Player, delta_time: f32) {
    if player.on_ground {
        let friction = MOVE_DECELERATION * delta_time;
        if player.velocity_x > 0.0 {
            player.velocity_x = (player.velocity_x - friction).max(0.0);
        } else if player.velocity_x < 0.0 {
            player.velocity_x = (player.velocity_x + friction).min(0.0);
        }
    }
}

fn clamp_velocities(player: &mut Player) {
    if player.velocity_x > MAX_HORIZONTAL_VELOCITY {
        player.velocity_x = MAX_HORIZONTAL_VELOCITY;
    } else if player.velocity_x < -MAX_HORIZONTAL_VELOCITY {
        player.velocity_x = -MAX_HORIZONTAL_VELOCITY;
    }
}

fn update_position(player: &mut Player, delta_time: f32) {
    player.x += player.velocity_x * delta_time;
    player.y += player.velocity_y * delta_time;
}

fn check_ground_collision(player: &mut Player) {
    // 2D side-scroller: Y increases UP, ground is at bottom (y=-10)
    // Player height is approximately 1.5 world units (sprite size)
    const PLAYER_HEIGHT: f32 = 1.5;
    let player_bottom: f32 = player.y - PLAYER_HEIGHT / 2.0;
    
    // Check if player is on the ground (at bottom of screen)
    if player_bottom <= GROUND_Y {
        player.y = GROUND_Y + PLAYER_HEIGHT / 2.0; // Position player on top of ground
        player.velocity_y = 0.0;
        player.on_ground = true;
        return;
    }
    
    // Check if player is on the platform
    // Platform top is at y=PLATFORM_Y, platform bottom is at y=PLATFORM_Y - PLATFORM_HEIGHT
    // Player lands on platform if:
    // 1. Player's bottom is at or just above platform top (landing from above)
    // 2. Player is moving downward (velocity_y < 0, since gravity is negative)
    // 3. Player's x is within platform bounds (6 meters wide, centered at x=0)
    if player.velocity_y <= 0.0 // Moving down (negative velocity)
        && player.x >= PLATFORM_X_START 
        && player.x <= PLATFORM_X_END
        && player_bottom <= PLATFORM_Y 
        && player_bottom >= PLATFORM_Y - PLATFORM_HEIGHT - 0.1 { // Small tolerance for landing
        // Player is landing on platform from above
        player.y = PLATFORM_Y + PLAYER_HEIGHT / 2.0; // Position player on top of platform
        player.velocity_y = 0.0;
        player.on_ground = true;
        return;
    }
    
    // Player is in the air
    player.on_ground = false;
}

pub fn apply_command(player: &mut Player, command: &crate::commands::PlayerCommand) {
    match command {
        crate::commands::PlayerCommand::MoveLeft => {
            player.velocity_x -= MOVE_ACCELERATION * 0.016;
            player.facing_right = false;
        }
        crate::commands::PlayerCommand::MoveRight => {
            player.velocity_x += MOVE_ACCELERATION * 0.016;
            player.facing_right = true;
        }
        crate::commands::PlayerCommand::Jump => {
            if player.on_ground {
                player.velocity_y = JUMP_VELOCITY;
                player.on_ground = false;
            }
        }
        crate::commands::PlayerCommand::Stop => {
            player.velocity_x = 0.0;
        }
    }
}

