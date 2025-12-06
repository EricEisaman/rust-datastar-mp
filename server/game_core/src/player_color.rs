use uuid::Uuid;

/// Generate a unique color for a player based on their ID
/// This matches the client-side color generation algorithm
pub fn get_player_color(player_id: &Uuid) -> String {
    // Hash the player ID to get a consistent color
    let bytes = player_id.as_bytes();
    let mut hash: u32 = 0;
    
    for &byte in bytes.iter() {
        // Use wrapping arithmetic to prevent overflow panics
        // (hash << 5) - hash is equivalent to hash * 31
        hash = hash.wrapping_mul(31).wrapping_add(byte as u32);
    }
    
    // Generate HSL color values
    let hue = (hash % 360) as u32;
    let saturation = 70 + ((hash % 30) as u32); // 70-100%
    let lightness = 50 + ((hash % 20) as u32); // 50-70%
    
    // Convert HSL to RGB
    let (r, g, b) = hsl_to_rgb(hue, saturation, lightness);
    
    // Return as hex string
    format!("#{:02X}{:02X}{:02X}", r, g, b)
}

/// Convert HSL to RGB
fn hsl_to_rgb(h: u32, s: u32, l: u32) -> (u8, u8, u8) {
    let h_f = h as f64 / 360.0;
    let s_f = s as f64 / 100.0;
    let l_f = l as f64 / 100.0;
    
    let c = (1.0 - (2.0 * l_f - 1.0).abs()) * s_f;
    let x = c * (1.0 - ((h_f * 6.0) % 2.0 - 1.0).abs());
    let m = l_f - c / 2.0;
    
    let (r, g, b) = if h_f < 1.0 / 6.0 {
        (c, x, 0.0)
    } else if h_f < 2.0 / 6.0 {
        (x, c, 0.0)
    } else if h_f < 3.0 / 6.0 {
        (0.0, c, x)
    } else if h_f < 4.0 / 6.0 {
        (0.0, x, c)
    } else if h_f < 5.0 / 6.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };
    
    (
        ((r + m) * 255.0).round() as u8,
        ((g + m) * 255.0).round() as u8,
        ((b + m) * 255.0).round() as u8,
    )
}

