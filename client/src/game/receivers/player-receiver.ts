/**
 * PlayerReceiver
 * 
 * Implements IDatastar to receive and process game state updates.
 * Updates the reactive gameState that Babylon renderer consumes.
 */

import { BaseDatastarReceiver } from '../../interfaces/datastar';
import { gameState, type Player } from '../player-state';

export class PlayerReceiver extends BaseDatastarReceiver {
  readonly id = 'player-receiver';

  override onSignalUpdate(signalName: string, data: unknown): void {
    if (signalName === 'gameState') {
      try {
        // Ensure data is an array of players
        if (Array.isArray(data)) {
          const players = data.map((p: unknown) => {
            const player = p as Record<string, unknown>;
            return {
              id: typeof player['id'] === 'string' ? player['id'] : String(player['id']),
              x: typeof player['x'] === 'number' ? player['x'] : 0,
              y: typeof player['y'] === 'number' ? player['y'] : 0,
              velocity_x: typeof player['velocity_x'] === 'number' ? player['velocity_x'] : 0,
              velocity_y: typeof player['velocity_y'] === 'number' ? player['velocity_y'] : 0,
              facing_right: typeof player['facing_right'] === 'boolean' ? player['facing_right'] : true,
              on_ground: typeof player['on_ground'] === 'boolean' ? player['on_ground'] : false,
            } as Player;
          });

          gameState.value = { gameState: players };
          console.log(`[${this.id}] ✅ Updated game state with ${players.length} players`);
          
          if (players.length > 0) {
            const firstPlayer = players[0];
            if (firstPlayer) {
              console.log(`[${this.id}] 🎮 First player:`, {
                id: firstPlayer.id.substring(0, 8),
                x: firstPlayer.x.toFixed(1),
                y: firstPlayer.y.toFixed(1),
              });
            }
          }
        }
      } catch (err) {
        console.error(`[${this.id}] Error processing game state update:`, err);
      }
    }
  }
}

