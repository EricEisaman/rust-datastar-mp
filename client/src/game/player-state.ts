import { ref } from 'vue';

export interface Player {
  id: string;
  x: number;
  y: number;
  velocity_x: number;
  velocity_y: number;
  facing_right: boolean;
  on_ground: boolean;
}

export const gameState = ref<{ gameState: Player[] }>({ gameState: [] });

export function getPlayerId(): string {
  // Use sessionStorage instead of localStorage so each tab gets a unique ID
  // This allows multiple players to connect from different tabs
  let id = sessionStorage.getItem('playerId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('playerId', id);
    console.log(`[PlayerState] 🆕 Generated new player ID for this tab: ${id.substring(0, 8)}`);
  } else {
    console.log(`[PlayerState] ♻️ Using existing player ID for this tab: ${id.substring(0, 8)}`);
  }
  return id;
}

// Initialize player on server when they connect
export function initPlayer(): void {
  const playerId = getPlayerId();
  fetch('/api/player/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_id: playerId,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        console.error('Player initialization failed with status:', response.status);
      } else {
        console.log('✅ Player initialized successfully:', playerId);
      }
    })
    .catch((err) => {
      console.error('Failed to initialize player:', err);
    });
}

// NOTE: The old direct SSE listener has been replaced by the DatastarUpdateManager pattern.
// See datastar-init.ts for the new initialization.
// This code is kept for backward compatibility but will be removed in a future update.

// Direct SSE listener - DEPRECATED: Use DatastarUpdateManager instead
if (typeof window !== 'undefined' && false) { // Disabled - use datastar-init.ts instead
  console.log('🚀 Initializing direct SSE listener for game state...');
  
  let eventSource: EventSource | null = null;
  
  const connectSSE = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null; // Ensure it's nullified after closing
    }
    
    console.log('📡 Connecting to SSE endpoint: /events');
    eventSource = new EventSource('/events');
    
    // Handle SSE events - Datastar sends events with event type and data
    // Listen for both signal patches (game state) and element patches (chat)
    eventSource.addEventListener('datastar-patch-signals', (event: MessageEvent) => {
      try {
        const data = event.data;
        console.log('📨 SSE signal patch received:', data);
        
        // Datastar format: "signals {...}" or just the JSON
        // Try to extract JSON from the data
        let jsonStr = data;
        
        // If it starts with "signals ", remove that prefix
        if (data.startsWith('signals ')) {
          jsonStr = data.substring(8);
        }
        
        // Try to parse the JSON
        try {
          const signalData = JSON.parse(jsonStr);
          if (signalData.gameState && Array.isArray(signalData.gameState)) {
            // Convert UUID objects to strings if needed
            const players = signalData.gameState.map((p: any) => ({
              ...p,
              id: typeof p.id === 'string' ? p.id : String(p.id),
            })) as Player[];
            gameState.value = { gameState: players };
            console.log('✅ Updated game state with', players.length, 'players');
            if (players.length > 0) {
              const firstPlayer = players[0];
              if (firstPlayer) {
                console.log('🎮 First player:', { id: firstPlayer.id.substring(0, 8), x: firstPlayer.x.toFixed(1), y: firstPlayer.y.toFixed(1) });
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse signal JSON:', e, 'JSON string:', jsonStr);
        }
      } catch (err) {
        console.error('Error processing SSE signal patch:', err);
      }
    });
    
    // Handle regular messages (fallback)
    eventSource.onmessage = (event) => {
      try {
        const data = event.data;
        console.log('📨 SSE message received:', data);
        
        // Try to parse if it's a signal patch
        if (data.includes('signals ')) {
          const jsonStr = data.substring(8);
          try {
            const signalData = JSON.parse(jsonStr);
            if (signalData.gameState && Array.isArray(signalData.gameState)) {
              const players = signalData.gameState.map((p: any) => ({
                ...p,
                id: typeof p.id === 'string' ? p.id : String(p.id),
              })) as Player[];
              gameState.value = { gameState: players };
              console.log('✅ Updated game state with', players.length, 'players');
            }
          } catch (e) {
            console.error('Failed to parse signal JSON:', e);
          }
        }
      } catch (err) {
        console.error('Error processing SSE message:', err);
      }
    };
    
    // Listen for element patches (chat messages)
    eventSource.addEventListener('datastar-patch-elements', (event: MessageEvent) => {
      try {
        const data = event.data;
        console.log('💬 Chat element patch received (full):', data);
        
        // Datastar element patch format can vary, try multiple parsing strategies
        // Format might be: "elements #selector mode html" or JSON or other formats
        
        // Strategy 1: Try parsing as "elements selector mode html"
        if (data.startsWith('elements ')) {
          const afterElements = data.substring(9); // Remove "elements " prefix
          
          // Try to find selector (starts with # or .)
          const selectorMatch = afterElements.match(/^(#[^\s]+|.[^\s]+|\w+)/);
          if (selectorMatch) {
            const selector = selectorMatch[1];
            const afterSelector = afterElements.substring(selector.length).trim();
            
            // Find mode (append, replace, etc.)
            let mode = 'append';
            let html = afterSelector;
            
            if (afterSelector.startsWith('append ')) {
              mode = 'append';
              html = afterSelector.substring(7).trim();
            } else if (afterSelector.startsWith('replace ')) {
              mode = 'replace';
              html = afterSelector.substring(8).trim();
            } else if (afterSelector.startsWith('prepend ')) {
              mode = 'prepend';
              html = afterSelector.substring(8).trim();
            }
            
            // Apply the patch to the DOM
            const targetElement = document.querySelector(selector);
            if (targetElement) {
              if (mode === 'append') {
                // Create a temporary container to parse HTML safely
                const temp = document.createElement('div');
                temp.innerHTML = html;
                while (temp.firstChild) {
                  targetElement.appendChild(temp.firstChild);
                }
                // Auto-scroll to bottom
                targetElement.scrollTop = targetElement.scrollHeight;
                console.log('✅ Chat message appended to', selector);
              } else if (mode === 'prepend') {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                const firstChild = temp.firstChild;
                if (firstChild) {
                  targetElement.insertBefore(firstChild, targetElement.firstChild);
                }
                console.log('✅ Chat message prepended to', selector);
              } else if (mode === 'replace') {
                targetElement.innerHTML = html;
                console.log('✅ Chat messages replaced in', selector);
              }
            } else {
              console.warn('⚠️ Chat target element not found:', selector, 'Available elements:', document.querySelectorAll('[id]'));
            }
          } else {
            console.warn('⚠️ Could not parse selector from element patch:', data);
          }
        } else {
          // Strategy 2: Try parsing as JSON
          try {
            const json = JSON.parse(data);
            if (json.selector && json.html) {
              const targetElement = document.querySelector(json.selector);
              if (targetElement) {
                if (json.mode === 'append' || !json.mode) {
                  const temp = document.createElement('div');
                  temp.innerHTML = json.html;
                  while (temp.firstChild) {
                    targetElement.appendChild(temp.firstChild);
                  }
                  targetElement.scrollTop = targetElement.scrollHeight;
                  console.log('✅ Chat message appended via JSON to', json.selector);
                } else if (json.mode === 'replace') {
                  targetElement.innerHTML = json.html;
                  console.log('✅ Chat messages replaced via JSON in', json.selector);
                }
              }
            }
          } catch (e) {
            console.warn('⚠️ Element patch is not in expected format:', data);
          }
        }
      } catch (err) {
        console.error('Error processing chat element patch:', err);
      }
    });
    
    eventSource.onerror = (err) => {
      console.error('❌ SSE error:', err);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      // Reconnect after delay
      setTimeout(connectSSE, 2000);
    };
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection opened successfully');
    };
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectSSE);
  } else {
    setTimeout(connectSSE, 100);
  }
}

