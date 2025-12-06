/**
 * ChatReceiver
 *
 * DEPRECATED: Chat is now handled by ChatGUI (Babylon GUI).
 * This receiver is kept for backward compatibility but is no longer used.
 *
 * The ChatGUI class in chat-gui.ts now handles all chat message updates.
 */

import { BaseDatastarReceiver } from '../../interfaces/datastar';

export class ChatReceiver extends BaseDatastarReceiver {
  readonly id = 'chat-receiver';

  override onElementUpdate(selector: string, mode: string, _html: string): void {
    // Chat is now handled by ChatGUI - this is a no-op
    // Kept for backward compatibility
    if (selector === '#chat-messages') {
      console.debug(`[${this.id}] Chat update received (handled by ChatGUI):`, mode);
    }
  }
}
