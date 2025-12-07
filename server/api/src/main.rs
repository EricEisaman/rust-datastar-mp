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
    // Try multiple paths to find the config file
    let config_paths = vec![
        std::env::var("GAME_CONFIG_PATH").ok(),
        Some("/app/game_config.json".to_string()), // Docker absolute path
        Some("./game_config.json".to_string()),    // Docker relative path
        Some("server/game_core/game_config.json".to_string()), // Local dev
        Some("../game_core/game_config.json".to_string()),    // Local dev alternative
        Some("game_core/game_config.json".to_string()),       // Local dev alternative
    ];
    
    eprintln!("🚀 Starting server...");
    
    // Try to find a valid config file path first
    let config_path = config_paths
        .into_iter()
        .flatten()
        .find(|path| std::path::Path::new(path).exists());
    
    let game_config = if let Some(path) = config_path {
        // Use async loading to support remote config fetching
        match game_core::config::GameConfig::load_async(&path).await {
            Ok(config) => {
                eprintln!("✅ Loaded config: {} platform(s), {} wall(s)", 
                    config.platforms.len(), config.walls.len());
                std::sync::Arc::new(config)
            }
            Err(e) => {
                eprintln!("⚠️ Failed to load config from {}: {}, using defaults", path, e);
                std::sync::Arc::new(game_core::config::GameConfig::default())
            }
        }
    } else {
        eprintln!("⚠️ Config file not found, using defaults");
        std::sync::Arc::new(game_core::config::GameConfig::default())
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

    tokio::spawn(game_loop(game_state.clone(), command_rx, game_tx.clone()));
    tokio::spawn(cleanup_inactive_players(game_state, game_tx.clone(), game_config.clone()));

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

    eprintln!("🌐 Starting HTTP server on {}...", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    eprintln!("✅ Server is ready! Listening on http://{}", addr);
    eprintln!("📡 SSE endpoint available at: http://{}/events", addr);
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
    PlayerLeft {
        player_id: uuid::Uuid,
        player_name: String,
    },
}

/// Cleanup task that removes inactive players (configurable timeout)
async fn cleanup_inactive_players(
    game_state: Arc<RwLock<GameState>>,
    game_tx: broadcast::Sender<GameUpdate>,
    game_config: Arc<game_core::GameConfig>,
) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
    let timeout_duration = std::time::Duration::from_secs(game_config.idle_timeout);
    
    loop {
        interval.tick().await;
        
        let now = std::time::SystemTime::now();
        let mut players_to_remove = Vec::new();
        
        // Check all players for inactivity
        {
            let game_state_guard = game_state.read().await;
            for (player_id, player) in game_state_guard.players.iter() {
                if let Ok(elapsed) = now.duration_since(player.last_activity) {
                    if elapsed > timeout_duration {
                        players_to_remove.push((*player_id, player.name.clone(), elapsed));
                    }
                }
            }
        }
        
        // Remove inactive players and broadcast
        if !players_to_remove.is_empty() {
            let mut game_state_guard = game_state.write().await;
            for (player_id, player_name, elapsed) in players_to_remove {
                eprintln!("⏰ [TIMEOUT] Player timed out due to inactivity: {} ({}) - inactive for {} seconds (timeout: {}s)", 
                    player_id, player_name, elapsed.as_secs(), timeout_duration.as_secs());
                game_state_guard.remove_player(&player_id);
                let _ = game_tx.send(GameUpdate::PlayerLeft {
                    player_id,
                    player_name,
                });
            }
        }
    }
}

