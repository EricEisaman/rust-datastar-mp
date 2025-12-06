/**
 * DatastarUpdateManager
 *
 * Centralized manager for routing Datastar SSE updates to registered receivers.
 * This follows the Observer pattern and allows multiple objects to receive
 * updates from a single SSE connection.
 */

import type { IDatastar } from '../interfaces/datastar';

export class DatastarUpdateManager {
  private receivers: Map<string, IDatastar> = new Map();
  private eventSource: EventSource | null = null;
  private isConnected = false;

  /**
   * Register a Datastar receiver
   */
  register(receiver: IDatastar): void {
    if (this.receivers.has(receiver.id)) {
      console.warn(`[DatastarManager] Receiver ${receiver.id} already registered, replacing...`);
    }

    this.receivers.set(receiver.id, receiver);
    receiver.initialize();
  }

  /**
   * Get a registered receiver by ID
   */
  getReceiver(receiverId: string): IDatastar | undefined {
    return this.receivers.get(receiverId);
  }

  /**
   * Unregister a Datastar receiver
   */
  unregister(receiverId: string): void {
    const receiver = this.receivers.get(receiverId);
    if (receiver) {
      receiver.dispose();
      this.receivers.delete(receiverId);
    }
  }

  /**
   * Connect to Datastar SSE endpoint
   */
  connect(endpoint: string = '/events'): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.eventSource = new EventSource(endpoint);

    // Handle signal patches
    this.eventSource.addEventListener('datastar-patch-signals', (event: MessageEvent) => {
      this.handleSignalPatch(event.data);
    });

    // Handle element patches
    this.eventSource.addEventListener('datastar-patch-elements', (event: MessageEvent) => {
      // Check if data is already in the correct format: "elements #selector mode html"
      let parsedData = event.data;
      
      // If data starts with "elements ", it's already in the correct format
      if (event.data.trim().startsWith('elements ')) {
        this.handleElementPatch(parsedData);
        return;
      }
      
      // Otherwise, try to parse multi-line SSE format
      // Server might send: "data: selector #chat-messages\ndata: mode append\ndata: elements <div>..."
      if (event.data.includes('data:') || event.data.includes('\n')) {
        const lines = event.data.split('\n');
        let selector = '';
        let mode = 'append';
        let html = '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip empty lines and event type lines
          if (!trimmed || trimmed.startsWith('event:')) {
            continue;
          }
          
          if (trimmed.startsWith('data: ')) {
            const content = trimmed.substring(6).trim(); // Remove "data: " prefix
            if (content.startsWith('selector ')) {
              selector = content.substring(9).trim(); // Remove "selector " prefix
            } else if (content.startsWith('mode ')) {
              mode = content.substring(5).trim() as 'append' | 'replace' | 'prepend'; // Remove "mode " prefix
            } else if (content.startsWith('elements ')) {
              html = content.substring(9).trim(); // Remove "elements " prefix
            } else if (content.startsWith('<')) {
              // HTML content without "elements " prefix (might be on a separate data line)
              html = content;
            }
          } else if (trimmed.startsWith('selector ')) {
            // Direct format without "data: " prefix
            selector = trimmed.substring(9).trim();
          } else if (trimmed.startsWith('mode ')) {
            mode = trimmed.substring(5).trim() as 'append' | 'replace' | 'prepend';
          } else if (trimmed.startsWith('elements ')) {
            html = trimmed.substring(9).trim();
          } else if (trimmed.startsWith('<') && !html) {
            // HTML content on its own line
            html = trimmed;
          }
        }
        
        // Reconstruct the format expected by handleElementPatch
        if (selector && html) {
          parsedData = `elements ${selector} ${mode} ${html}`;
        }
      }
      
      this.handleElementPatch(parsedData);
    });

    // Handle regular messages (fallback)
    // Note: SSE events can come in different formats:
    // 1. As separate event listeners (datastar-patch-signals, datastar-patch-elements)
    // 2. As onmessage with full SSE format: "event: type\ndata: content"
    this.eventSource.onmessage = (event) => {
      const data = event.data;

      // Check if it's the full SSE format with "event:" and "data:" lines
      if (data.includes('event:') && data.includes('data:')) {
        // Parse SSE format: "event: datastar-patch-signals\ndata: signals {...}"
        const lines = data.split('\n');
        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.substring(5).trim();
          }
        }

        // Route based on event type
        if (eventType === 'datastar-patch-signals') {
          this.handleSignalPatch(eventData);
        } else if (eventType === 'datastar-patch-elements') {
          this.handleElementPatch(eventData);
        }
      } else {
        // Direct format (just the data part)
        if (data.includes('signals ')) {
          this.handleSignalPatch(data);
        } else if (data.includes('elements ')) {
          this.handleElementPatch(data);
        }
      }
    };

    this.eventSource.onopen = () => {
      this.isConnected = true;
      // Initialize all receivers when connected
      for (const receiver of this.receivers.values()) {
        receiver.initialize();
      }
    };

    this.eventSource.onerror = (err) => {
      console.error('[DatastarManager] ❌ SSE error:', err);
      this.isConnected = false;
      // Reconnect immediately (no timeout, no frame delay)
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
        // Reconnect immediately using Babylon's render loop if available
        // Otherwise reconnect synchronously
        this.connect(endpoint);
      }
    };
  }

  /**
   * Disconnect from Datastar SSE endpoint
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Handle a signal patch update
   */
  private handleSignalPatch(data: string): void {
    try {
      // SSE can send multi-line format: "event: type\ndata: content"
      // Extract just the data part if it's multi-line
      let actualData = data;

      // Check if it's the multi-line SSE format
      if (data.includes('\n') || data.includes('event:') || data.includes('data:')) {
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            actualData = line.substring(5).trim(); // Remove "data: " prefix
            break;
          }
        }
      }

      // Parse Datastar signal format: "signals {...}" or just JSON
      let jsonStr = actualData;
      if (actualData.startsWith('signals ')) {
        jsonStr = actualData.substring(8); // Remove "signals " prefix
      }

      const signalData = JSON.parse(jsonStr);

      // Route to all receivers
      for (const [signalName, value] of Object.entries(signalData)) {
        for (const receiver of this.receivers.values()) {
          try {
            receiver.onSignalUpdate(signalName, value);
          } catch (err) {
            console.error(`[DatastarManager] Error in receiver ${receiver.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[DatastarManager] Failed to parse signal patch:', err, 'Data:', data);
    }
  }

  /**
   * Handle an element patch update
   * Datastar format can be: "elements #selector mode html" or JSON or other formats
   */
  private handleElementPatch(data: string): void {
    let selector = '';
    let mode: 'append' | 'replace' | 'prepend' = 'append';
    let html = '';

    try {
      // Try multiple parsing strategies for different Datastar formats
      
      // Strategy 1: Standard format "elements #selector mode html"
      if (data.startsWith('elements ')) {
        const rest = data.substring(9).trim();
        
        // Regex to capture selector, mode, and HTML in one go
        // Format: "elements #selector mode html"
        const match = rest.match(/^(#[^\s]+|\.[^\s]+)\s+(append|replace|prepend)\s+(.*)/s);
        
        if (match && match[1] && match[2] && match[3]) {
          selector = match[1];
          mode = match[2] as 'append' | 'replace' | 'prepend';
          html = match[3];
        } else {
          // Fallback: try to find selector and mode separately
          const selectorMatch = rest.match(/^(#[^\s]+|\.[^\s]+)/);
          if (selectorMatch && selectorMatch[1]) {
            selector = selectorMatch[1];
            const afterSelector = rest.substring(selector.length).trim();
            
            if (afterSelector.startsWith('append ')) {
              mode = 'append';
              html = afterSelector.substring(7).trim();
            } else if (afterSelector.startsWith('replace ')) {
              mode = 'replace';
              html = afterSelector.substring(8).trim();
            } else if (afterSelector.startsWith('prepend ')) {
              mode = 'prepend';
              html = afterSelector.substring(8).trim();
            } else {
              // No explicit mode, assume append
              mode = 'append';
              html = afterSelector;
            }
          } else {
            console.error(`[DatastarManager] ❌ Could not parse elements format: ${rest.substring(0, 200)}`);
            return;
          }
        }
      }
      // Strategy 2: JSON format (if Datastar sends JSON)
      else if (data.trim().startsWith('{')) {
        try {
          const json = JSON.parse(data);
          if (json.selector && json.html) {
            selector = json.selector;
            mode = json.mode || 'append';
            html = json.html;
          } else {
            console.error(`[DatastarManager] ❌ JSON format missing selector or html:`, json);
            return;
          }
        } catch (jsonErr) {
          console.error(`[DatastarManager] ❌ Failed to parse as JSON:`, jsonErr);
          return;
        }
      }
      // Strategy 3: Just HTML (fallback for #chat-messages)
      else if (data.trim().startsWith('<')) {
        selector = '#chat-messages';
        mode = 'append';
        html = data.trim();
      }
      // Strategy 4: Try to extract from any format that might contain the data
      else {
        // Last resort: try to find HTML-like content and assume #chat-messages
        const htmlMatch = data.match(/<div[^>]*>.*?<\/div>/s);
        if (htmlMatch) {
          selector = '#chat-messages';
          mode = 'append';
          html = htmlMatch[0];
        } else {
          console.error(`[DatastarManager] ❌ Unknown element patch format: ${data.substring(0, 500)}`);
          return;
        }
      }

      if (!selector || !html) {
        console.error(`[DatastarManager] ❌ Missing selector or HTML after parsing: selector="${selector}", html length=${html.length}`);
        return;
      }

      // Route to all receivers
      for (const receiver of this.receivers.values()) {
        try {
          receiver.onElementUpdate(selector, mode, html);
        } catch (err) {
          console.error(`[DatastarManager] ❌ Error in receiver ${receiver.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[DatastarManager] ❌ Failed to parse element patch:', err);
    }
  }
}

// Singleton instance
export const datastarManager = new DatastarUpdateManager();
