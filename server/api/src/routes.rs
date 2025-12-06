use axum::Router;
use crate::handlers;
use crate::state::AppState;

pub fn create_routes(app_state: AppState) -> Router {
    Router::new()
        .route("/health", axum::routing::get(handlers::health::health_check))
        .route("/events", axum::routing::get(handlers::events::events_handler))
        .route("/api/player/init", axum::routing::post(handlers::game::init_player))
        .route("/api/player/command", axum::routing::post(handlers::game::player_command))
        // Datastar best practice: Support JSON for API calls
        .route("/api/chat", axum::routing::post(handlers::chat::send_message))
        .with_state(app_state)
}

