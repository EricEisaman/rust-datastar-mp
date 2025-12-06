/**
 * Datastar Initialization
 * 
 * Sets up the Datastar update manager and registers all receivers.
 * This is the central initialization point for all Datastar-based updates.
 */

import { datastarManager } from './datastar-manager';
import { PlayerReceiver } from './receivers/player-receiver';
// Chat is now handled by ChatGUI (Babylon GUI), not a separate receiver
// import { ChatReceiver } from './receivers/chat-receiver';

// Create receiver instances
const playerReceiver = new PlayerReceiver();
// Chat receiver removed - ChatGUI handles chat updates now

/**
 * Initialize Datastar system
 * Call this when the app starts to set up all Datastar receivers
 */
export function initializeDatastar(endpoint: string = '/events'): void {
  if (typeof window === 'undefined') {
    return;
  }

  console.log('[DatastarInit] Initializing Datastar system...');

  // Register all receivers
  datastarManager.register(playerReceiver);
  // Chat is registered by BabylonRenderer when ChatGUI is created

  // Connect to SSE endpoint
  datastarManager.connect(endpoint);

  console.log('[DatastarInit] ✅ Datastar system initialized');
}

/**
 * Get the Datastar manager instance
 * Useful for registering additional receivers at runtime
 */
export { datastarManager };

