/**
 * PlayerReceiver
 *
 * Implements IDatastar to receive and process game state updates.
 * Updates the reactive gameState that Babylon renderer consumes.
 */

import { BaseDatastarReceiver } from '../../interfaces/datastar';
import { gameState, type Player, type GroundState } from '../player-state';

export class PlayerReceiver extends BaseDatastarReceiver {
  readonly id = 'player-receiver';

  override onSignalUpdate(signalName: string, data: unknown): void {
    if (signalName === 'gameState') {
      try {
        // Ensure data is an array of players
        if (Array.isArray(data)) {
          const players = data.map((p: unknown): Player => {
            if (typeof p === 'object' && p !== null) {
              const playerObj = p as Record<string, unknown>;
              const groundState = playerObj['ground_state'];
              let parsedGroundState: GroundState;

              // Parse ground_state as discriminated union
              if (typeof groundState === 'object' && groundState !== null) {
                const gs = groundState as Record<string, unknown>;
                if (gs['type'] === 'Grounded') {
                  parsedGroundState = {
                    type: 'Grounded',
                    platform_id: typeof gs['platform_id'] === 'number' ? gs['platform_id'] : null,
                  };
                } else if (gs['type'] === 'Sliding') {
                  const sideValue = gs['side'];
                  parsedGroundState = {
                    type: 'Sliding',
                    side:
                      typeof sideValue === 'string' &&
                      (sideValue === 'left' || sideValue === 'right')
                        ? sideValue
                        : 'left',
                    platform_id: typeof gs['platform_id'] === 'number' ? gs['platform_id'] : null,
                  };
                } else {
                  parsedGroundState = { type: 'Flying' };
                }
              } else {
                parsedGroundState = { type: 'Flying' };
              }

              return {
                id: typeof playerObj['id'] === 'string' ? playerObj['id'] : String(playerObj['id']),
                name: typeof playerObj['name'] === 'string' ? playerObj['name'] : '',
                x: typeof playerObj['x'] === 'number' ? playerObj['x'] : 0,
                y: typeof playerObj['y'] === 'number' ? playerObj['y'] : 0,
                velocity_x:
                  typeof playerObj['velocity_x'] === 'number' ? playerObj['velocity_x'] : 0,
                velocity_y:
                  typeof playerObj['velocity_y'] === 'number' ? playerObj['velocity_y'] : 0,
                facing_right:
                  typeof playerObj['facing_right'] === 'boolean' ? playerObj['facing_right'] : true,
                ground_state: parsedGroundState,
              };
            }
            throw new Error('Invalid player data');
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
