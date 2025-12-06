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
    console.log(`[DatastarManager] Registered receiver: ${receiver.id}`);
  }

  /**
   * Unregister a Datastar receiver
   */
  unregister(receiverId: string): void {
    const receiver = this.receivers.get(receiverId);
    if (receiver) {
      receiver.dispose();
      this.receivers.delete(receiverId);
      console.log(`[DatastarManager] Unregistered receiver: ${receiverId}`);
    }
  }

  /**
   * Connect to Datastar SSE endpoint
   */
  connect(endpoint: string = '/events'): void {
    if (this.eventSource) {
      this.disconnect();
    }

    console.log(`[DatastarManager] Connecting to SSE endpoint: ${endpoint}`);
    this.eventSource = new EventSource(endpoint);

    // Handle signal patches
    this.eventSource.addEventListener('datastar-patch-signals', (event: MessageEvent) => {
      console.log(`[DatastarManager] 📬 Received datastar-patch-signals event`);
      console.log(
        `[DatastarManager] 📬 Event data (first 200 chars):`,
        event.data.substring(0, 200)
      );
      this.handleSignalPatch(event.data);
    });

    // Handle element patches
    this.eventSource.addEventListener('datastar-patch-elements', (event: MessageEvent) => {
      console.log(`[DatastarManager] 📬 Received datastar-patch-elements event`);
      console.log(
        `[DatastarManager] 📬 Event data (first 200 chars):`,
        event.data.substring(0, 200)
      );
      this.handleElementPatch(event.data);
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
      console.log('[DatastarManager] ✅ SSE connection opened');
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
      console.log('[DatastarManager] Disconnected from SSE');
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
      console.log(`[DatastarManager] 📨 Processing signal patch, data length: ${data.length}`);
      console.log(`[DatastarManager] 📨 Raw data (first 300 chars):`, data.substring(0, 300));

      // SSE can send multi-line format: "event: type\ndata: content"
      // Extract just the data part if it's multi-line
      let actualData = data;

      // Check if it's the multi-line SSE format
      if (data.includes('\n') || data.includes('event:') || data.includes('data:')) {
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            actualData = line.substring(5).trim(); // Remove "data: " prefix
            console.log(`[DatastarManager] 📨 Extracted data line:`, actualData.substring(0, 200));
            break;
          }
        }
      }

      // Parse Datastar signal format: "signals {...}" or just JSON
      let jsonStr = actualData;
      if (actualData.startsWith('signals ')) {
        jsonStr = actualData.substring(8); // Remove "signals " prefix
      }

      console.log(
        `[DatastarManager] 📨 Final JSON string to parse (first 200 chars):`,
        jsonStr.substring(0, 200)
      );
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
   */
  private handleElementPatch(data: string): void {
    console.log(`[DatastarManager] 📨 Handling element patch (full): ${data}`);
    console.log(`[DatastarManager] 📨 Data type: ${typeof data}, length: ${data.length}`);

    try {
      // Datastar element patch format can be:
      // 1. "elements #selector mode html"
      // 2. Just the data part from SSE
      // 3. JSON format

      let selector = '';
      let mode = 'append';
      let html = '';

      // Try format 1: "elements #selector mode html"
      if (data.startsWith('elements ')) {
        const afterElements = data.substring(9);
        const selectorMatch = afterElements.match(/^(#[^\s]+|.[^\s]+|\w+)/);

        if (selectorMatch && selectorMatch[1]) {
          selector = selectorMatch[1];
          const afterSelector = afterElements.substring(selector.length).trim();

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
            // No mode specified, assume append and use rest as HTML
            html = afterSelector;
          }
        } else {
          console.warn(`[DatastarManager] ⚠️ Could not parse selector from: ${afterElements}`);
        }
      } else {
        // Try to parse as JSON or other format
        // The data might just be the HTML or a different format
        console.warn(
          `[DatastarManager] ⚠️ Element patch doesn't start with 'elements ', trying alternative parsing`
        );

        // If it contains #chat-messages, try to extract it
        if (data.includes('#chat-messages')) {
          selector = '#chat-messages';
          // Try to find HTML content
          const htmlMatch = data.match(/<div[^>]*>.*?<\/div>/s);
          if (htmlMatch) {
            html = htmlMatch[0];
            mode = 'append';
          } else {
            // Use the whole data as HTML
            html = data;
          }
        }
      }

      if (selector && html) {
        console.log(
          `[DatastarManager] ✅ Parsed element patch: selector=${selector}, mode=${mode}, html=${html.substring(0, 100)}...`
        );

        // Route to all receivers
        for (const receiver of this.receivers.values()) {
          try {
            console.log(`[DatastarManager] 📤 Routing to receiver: ${receiver.id}`);
            receiver.onElementUpdate(selector, mode, html);
          } catch (err) {
            console.error(`[DatastarManager] ❌ Error in receiver ${receiver.id}:`, err);
          }
        }
      } else {
        console.warn(
          `[DatastarManager] ⚠️ Could not parse element patch - selector: ${selector}, html length: ${html.length}`
        );
      }
    } catch (err) {
      console.error('[DatastarManager] ❌ Failed to parse element patch:', err, 'Data:', data);
    }
  }
}

// Singleton instance
export const datastarManager = new DatastarUpdateManager();
