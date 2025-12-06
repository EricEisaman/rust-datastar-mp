/**
 * IDatastar Interface
 * 
 * Top-level interface for any object that receives updates from Datastar SSE.
 * This pattern allows for consistent update handling across game entities,
 * UI components, and other reactive systems.
 * 
 * Implementation pattern:
 * - Classes implement this interface to receive Datastar updates
 * - Register implementations with DatastarUpdateManager
 * - Updates are automatically routed to the appropriate handlers
 */

export interface IDatastar {
  /**
   * Unique identifier for this Datastar receiver
   * Used for routing updates and debugging
   */
  readonly id: string;

  /**
   * Handle a signal patch update from Datastar
   * Signal patches contain JSON data that updates reactive state
   * 
   * @param signalName - The name of the signal (e.g., "gameState", "chatState")
   * @param data - The signal data (parsed JSON object)
   */
  onSignalUpdate(signalName: string, data: unknown): void;

  /**
   * Handle an element patch update from Datastar
   * Element patches contain HTML/DOM updates
   * 
   * @param selector - CSS selector for the target element
   * @param mode - Patch mode: "append", "replace", "prepend", etc.
   * @param html - HTML content to apply
   */
  onElementUpdate(selector: string, mode: string, html: string): void;

  /**
   * Initialize this receiver
   * Called when the receiver is registered or when Datastar connects
   */
  initialize(): void | Promise<void>;

  /**
   * Cleanup this receiver
   * Called when the receiver is unregistered or when Datastar disconnects
   */
  dispose(): void;
}

/**
 * Base implementation of IDatastar with common functionality
 * Extend this class to create Datastar receivers with default behavior
 */
export abstract class BaseDatastarReceiver implements IDatastar {
  abstract readonly id: string;

  onSignalUpdate(signalName: string, data: unknown): void {
    // Default: log unhandled signal updates
    console.debug(`[${this.id}] Signal update received:`, signalName, data);
  }

  onElementUpdate(selector: string, mode: string, _html: string): void {
    // Default: log unhandled element updates
    console.debug(`[${this.id}] Element update received:`, selector, mode);
  }

  initialize(): void {
    // Default: no-op
  }

  dispose(): void {
    // Default: no-op
  }
}

