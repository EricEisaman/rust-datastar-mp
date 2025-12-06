import { Scene } from '@babylonjs/core';
import { getPlayerId, initPlayer as initPlayerOnServer } from './player-state';

type PlayerCommand = 'MoveLeft' | 'MoveRight' | 'Jump' | 'Stop';

let playerId: string;

export function initPlayer(): void {
  initPlayerOnServer();
}

export function setupInput(scene: Scene): void {
  playerId = getPlayerId();
  const activeKeys = new Set<string>();
  let lastSendTime = 0;
  const sendInterval = 100; // Send command every 100ms while key is held

  // Use Babylon.js observable for continuous movement updates
  const handleMovement = (): void => {
    const hasMovementKey = ['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].some((key) =>
      activeKeys.has(key)
    );

    if (hasMovementKey) {
      const now = Date.now();
      if (now - lastSendTime >= sendInterval) {
        // Find the most recent movement key
        const movementKeys = Array.from(activeKeys).filter((k) =>
          ['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(k)
        );
        if (movementKeys.length > 0) {
          const latestKey = movementKeys[movementKeys.length - 1];
          if (latestKey) {
            const command = getCommandForKey(latestKey);
            if (command) {
              sendCommand(command);
            }
          }
        }
        lastSendTime = now;
      }
    }
  };

  // Register observer for continuous movement (runs every frame)
  // Observer is automatically managed by Babylon.js scene lifecycle
  scene.onBeforeRenderObservable.add(handleMovement);

  window.addEventListener('keydown', (e) => {
    // Don't interfere with chat input
    // If user is typing in chat, don't process game controls
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }

    // Prevent default for game keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'A', 'd', 'D', 'w', 'W'].includes(e.key)) {
      e.preventDefault();
    }

    // Only add if not already pressed (avoid duplicate commands)
    if (!activeKeys.has(e.key)) {
      activeKeys.add(e.key);
      const command = getCommandForKey(e.key);
      if (command) {
        sendCommand(command);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    activeKeys.delete(e.key);

    // Stop continuous movement if no movement keys are pressed
    const hasMovementKey = ['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].some((key) =>
      activeKeys.has(key)
    );
    if (!hasMovementKey) {
      sendCommand('Stop');
    }
  });
}

function getCommandForKey(key: string): PlayerCommand | null {
  switch (key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'MoveLeft';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'MoveRight';
    case ' ':
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'Jump';
    default:
      return null;
  }
}

// Removed handleKey - commands are now sent directly in setupInput

function sendCommand(command: PlayerCommand): void {
  const payload = {
    player_id: playerId,
    command: { type: command },
  };

  console.log(`[Input] 📤 Sending command: ${command} for player: ${playerId.substring(0, 8)}`);

  fetch('/api/player/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`[Input] ❌ Command failed with status: ${response.status}`);
      } else {
        console.log(`[Input] ✅ Command sent successfully: ${command}`);
      }
    })
    .catch((err) => {
      console.error('[Input] ❌ Failed to send command:', err);
    });
}
