mod handlers;
mod routes;
mod state;

use axum::Router;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};
use tower::service_fn;
use tower_http::services::ServeDir;
use game_core::GameState;

#[tokio::main]
async fn main() {
    // Load game configuration from JSON file
    let config_path = std::env::var("GAME_CONFIG_PATH")
        .unwrap_or_else(|_| "server/game_core/game_config.json".to_string());
    
    let game_config = match game_core::config::GameConfig::load(&config_path) {
        Ok(config) => {
            eprintln!("✅ Loaded game configuration from: {}", config_path);
            std::sync::Arc::new(config)
        }
        Err(e) => {
            eprintln!("⚠️ Failed to load game config from {}: {}. Using defaults.", config_path, e);
            std::sync::Arc::new(game_core::config::GameConfig::default())
        }
    };
    
    // Initialize physics system with configuration
    game_core::physics::init(game_config.clone());
    
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .expect("PORT must be a valid number");
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let (game_tx, _) = broadcast::channel::<GameUpdate>(100);
    let (chat_tx, _) = broadcast::channel::<game_core::ChatMessage>(100);
    let (command_tx, command_rx) = mpsc::channel::<(uuid::Uuid, game_core::PlayerCommand)>(100);

    let game_state = Arc::new(RwLock::new(GameState::new()));

    let app_state = state::AppState {
        game_state: game_state.clone(),
        game_tx: game_tx.clone(),
        chat_tx: chat_tx.clone(),
        command_tx,
        game_config: game_config.clone(),
    };

    tokio::spawn(game_loop(game_state, command_rx, game_tx.clone()));

    // Serve static files with fallback to index.html for SPA routing
    // This is the Axum 0.8 best practice: use fallback_service with ServeDir
    // and not_found_service to handle SPA routing
    let static_files = ServeDir::new("client/dist")
        .not_found_service(service_fn(|_req: axum::http::Request<axum::body::Body>| async {
            Ok::<axum::response::Response, std::convert::Infallible>(
                handlers::serve_index_html().await
            )
        }));

    let app = Router::new()
        .merge(routes::create_routes(app_state))
        .fallback_service(static_files);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn game_loop(
    game_state: Arc<RwLock<GameState>>,
    mut command_rx: mpsc::Receiver<(uuid::Uuid, game_core::PlayerCommand)>,
    game_tx: broadcast::Sender<GameUpdate>,
) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs_f32(1.0 / 60.0));
    loop {
        interval.tick().await;
        let delta_time = 1.0 / 60.0;

        while let Ok((player_id, command)) = command_rx.try_recv() {
            game_state.write().await.apply_command(&player_id, &command);
        }

        game_state.write().await.update(delta_time);

        let state = game_state.read().await.clone();
        let _ = game_tx.send(GameUpdate::StateUpdate(state));
    }
}

#[derive(Debug, Clone)]
pub enum GameUpdate {
    StateUpdate(game_core::GameState),
}

