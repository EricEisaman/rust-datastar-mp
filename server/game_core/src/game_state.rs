use std::collections::HashMap;
use crate::player::{Player, PlayerId};
use crate::commands::PlayerCommand;

#[derive(Debug, Clone)]
pub struct GameState {
    pub players: HashMap<PlayerId, Player>,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            players: HashMap::new(),
        }
    }

    pub fn add_player(&mut self, player_id: PlayerId) {
        self.players.insert(player_id, Player::new(player_id));
    }

    pub fn remove_player(&mut self, player_id: &PlayerId) {
        self.players.remove(player_id);
    }

    pub fn apply_command(&mut self, player_id: &PlayerId, command: &PlayerCommand) {
        if let Some(player) = self.players.get_mut(player_id) {
            crate::physics::apply_command(player, command);
        }
    }

    pub fn update(&mut self, delta_time: f32) {
        for player in self.players.values_mut() {
            crate::physics::update_player_physics(player, delta_time);
        }
    }
}

