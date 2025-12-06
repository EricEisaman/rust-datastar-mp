use axum::extract::State;
use axum::response::Json;
use crate::state::AppState;
use serde_json::json;

/// Get game configuration (platforms, physics settings, etc.)
pub async fn get_config(
    State(app_state): State<AppState>,
) -> impl axum::response::IntoResponse {
    // Return the game configuration as JSON
    // This allows clients to fetch platform definitions and physics settings
    Json(json!({
        "physics": {
            "gravity": app_state.game_config.physics.gravity,
            "jump_velocity": app_state.game_config.physics.jump_velocity,
            "move_acceleration": app_state.game_config.physics.move_acceleration,
            "move_deceleration": app_state.game_config.physics.move_deceleration,
            "max_horizontal_velocity": app_state.game_config.physics.max_horizontal_velocity,
            "ground_y": app_state.game_config.physics.ground_y,
            "player_width": app_state.game_config.physics.player_width,
            "player_height": app_state.game_config.physics.player_height,
            "ground_color": app_state.game_config.physics.ground_color,
        },
        "platforms": app_state.game_config.platforms.iter().map(|p| json!({
            "id": p.id,
            "x_start": p.x_start,
            "x_end": p.x_end,
            "y_top": p.y_top,
            "height": p.height,
            "color": p.color,
        })).collect::<Vec<_>>(),
        "walls": app_state.game_config.walls.iter().map(|w| json!({
            "id": w.id,
            "x": w.x,
            "y_bottom": w.y_bottom,
            "y_top": w.y_top,
            "width": w.width,
            "color": w.color,
        })).collect::<Vec<_>>(),
    }))
}

