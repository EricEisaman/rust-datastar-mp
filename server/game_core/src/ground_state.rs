use serde::{Deserialize, Serialize};

/// Which side a player is sliding on
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SlideSide {
    Left,
    Right,
}

/// Represents the ground state of a player
/// This enum properly distinguishes between grounded, sliding, and flying states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GroundState {
    /// Player is grounded (standing on ground or platform)
    Grounded {
        /// Platform ID if on a platform, None if on ground
        platform_id: Option<u32>,
    },
    /// Player is sliding along a wall or surface
    Sliding {
        /// Which side is being slid on
        side: SlideSide,
        /// Platform ID if sliding on a platform, None if sliding on wall
        platform_id: Option<u32>,
    },
    /// Player is flying/airborne (jumping or falling)
    Flying,
}

impl GroundState {
    /// Returns true if the player is grounded (on ground or platform)
    pub fn is_grounded(&self) -> bool {
        matches!(self, GroundState::Grounded { .. })
    }
    
    /// Returns true if the player is sliding
    pub fn is_sliding(&self) -> bool {
        matches!(self, GroundState::Sliding { .. })
    }
    
    /// Returns true if the player is flying/airborne
    pub fn is_flying(&self) -> bool {
        matches!(self, GroundState::Flying)
    }
    
    /// Returns true if the player is airborne (sliding or flying)
    pub fn is_airborne(&self) -> bool {
        self.is_sliding() || self.is_flying()
    }
    
    /// Returns true if the player is on a surface (grounded or sliding)
    pub fn is_on_surface(&self) -> bool {
        self.is_grounded() || self.is_sliding()
    }
}

