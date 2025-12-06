use axum::extract::State;
use axum::response::sse::{Event, Sse};
use futures::stream::Stream;
use std::convert::Infallible;
use crate::state::AppState;
use crate::GameUpdate;
use datastar::patch_signals::PatchSignals;
use datastar::patch_elements::PatchElements;
use datastar::consts::ElementPatchMode;

pub async fn events_handler(
    State(app_state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut game_rx = app_state.game_tx.subscribe();
    let mut chat_rx = app_state.chat_tx.subscribe();

    let stream = async_stream::stream! {
        loop {
            tokio::select! {
                Ok(update) = game_rx.recv() => {
                    match update {
                        GameUpdate::StateUpdate(state) => {
                            // Datastar best practice: Send only what changed (delta updates)
                            // For now, send full state, but in production implement delta encoding
                            let players: Vec<_> = state.players.values().cloned().collect();
                            
                            // Log player IDs for debugging
                            if players.len() > 0 {
                                let player_ids: Vec<String> = players.iter()
                                    .map(|p| p.id.to_string().chars().take(8).collect())
                                    .collect();
                                eprintln!("📤 Sending game state update: {} players (IDs: {:?})", players.len(), player_ids);
                            } else {
                                eprintln!("📤 Sending game state update: {} players", players.len());
                            }
                            
                            // Datastar signal format: {"signalName": value}
                            // Send the players array directly as the signal value
                            let signals_json = serde_json::json!({
                                "gameState": players
                            });
                            
                            let patch = PatchSignals::new(serde_json::to_string(&signals_json).unwrap());
                            let event = patch.into_datastar_event();
                            
                            yield Ok(Event::default()
                                .event("datastar-patch-signals")
                                .data(format!("{}", event)));
                        }
                    }
                }
                Ok(message) = chat_rx.recv() => {
                    eprintln!("💬 Broadcasting chat message via SSE: {} ({}): {}", message.player_name, message.player_id, message.text);
                    // Format message with player name in their color
                    let patch = PatchElements::new(
                        format!(
                            r#"<div style="margin-bottom: 8px; font-size: 14px"><span style="color: {}; font-weight: bold;">{}:</span> {}</div>"#,
                            message.player_color,
                            message.player_name,
                            message.text
                        )
                    )
                    .selector("#chat-messages")
                    .mode(ElementPatchMode::Append);
                    let event = patch.into_datastar_event();
                    eprintln!("💬 Chat patch event: {}", event);
                    // Set the event type for proper SSE routing
                    yield Ok(Event::default()
                        .event("datastar-patch-elements")
                        .data(format!("{}", event)));
                }
            }
        }
    };

    Sse::new(stream)
}

