/**
 * ChatGUI
 * 
 * Babylon.js 2D GUI implementation for the chat overlay.
 * 
 * Implements IDatastar interface to receive real-time chat message updates
 * from the server via Datastar element patches. This follows the top-level
 * pattern where any Babylon component can implement IDatastar to receive
 * server-driven updates.
 * 
 * Features:
 * - Toggle button to show/hide chat overlay
 * - Messages panel that receives updates via onElementUpdate()
 * - Input field and send button for sending messages
 * - Auto-updates when new messages arrive from server
 */

import { Engine, Scene, KeyboardEventTypes } from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, TextBlock, InputText, Button, StackPanel } from '@babylonjs/gui';
import { BaseDatastarReceiver, type IDatastar } from '../interfaces/datastar';
import { getPlayerId } from './player-state';

/**
 * ChatGUI implements IDatastar interface for receiving real-time updates
 * 
 * This is a concrete example of the IDatastar pattern - any Babylon component
 * can implement this interface to receive server-driven updates via Datastar.
 */
export class ChatGUI extends BaseDatastarReceiver implements IDatastar {
  readonly id = 'chat-gui';
  
  private advancedTexture: AdvancedDynamicTexture | null = null;
  private chatPanel: Rectangle | null = null;
  private messagesPanel: StackPanel | null = null;
  private inputField: InputText | null = null;
  private sendButton: Button | null = null;
  private toggleButton: Button | null = null;
  private isOpen = false;
  private playerId: string;

  constructor(engine: Engine, scene: Scene) {
    super();
    this.playerId = getPlayerId();
    this.initializeGUI(engine, scene);
  }

  /**
   * Initialize the chat GUI
   * Called automatically when the receiver is registered with DatastarManager
   */
  override initialize(): void {
    console.log(`[${this.id}] ✅ Chat GUI initialized`);
    console.log(`[${this.id}] Messages panel exists: ${!!this.messagesPanel}`);
    console.log(`[${this.id}] Chat panel exists: ${!!this.chatPanel}`);
    // GUI is already initialized in constructor, but this method
    // can be used for re-initialization if needed
  }

  private initializeGUI(_engine: Engine, scene: Scene): void {
    // Create fullscreen UI
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('ChatUI', true, scene);

    // Create toggle button (top-left)
    this.toggleButton = Button.CreateSimpleButton('chatToggle', 'Open Chat');
    this.toggleButton.width = '120px';
    this.toggleButton.height = '40px';
    this.toggleButton.color = 'white';
    this.toggleButton.background = 'rgba(0, 0, 0, 0.8)';
    this.toggleButton.cornerRadius = 4;
    this.toggleButton.left = '20px';
    this.toggleButton.top = '20px';
    this.toggleButton.horizontalAlignment = 0; // LEFT
    this.toggleButton.verticalAlignment = 0; // TOP
    this.toggleButton.onPointerClickObservable.add(() => {
      this.toggleChat();
    });
    this.advancedTexture.addControl(this.toggleButton);

    // Create chat panel (initially hidden)
    this.chatPanel = new Rectangle('chatPanel');
    this.chatPanel.width = '300px';
    this.chatPanel.height = '400px';
    this.chatPanel.color = 'white';
    this.chatPanel.background = 'rgba(0, 0, 0, 0.9)';
    this.chatPanel.cornerRadius = 8;
    this.chatPanel.thickness = 1;
    this.chatPanel.left = '20px';
    this.chatPanel.top = '70px';
    this.chatPanel.horizontalAlignment = 0; // LEFT
    this.chatPanel.verticalAlignment = 0; // TOP
    this.chatPanel.isVisible = false;
    this.advancedTexture.addControl(this.chatPanel);

    // Create title
    const title = new TextBlock('chatTitle', 'Chat');
    title.height = '30px';
    title.color = 'white';
    title.fontSize = 18;
    title.textHorizontalAlignment = 0; // LEFT
    this.chatPanel.addControl(title);

    // Create messages panel (scrollable area)
    this.messagesPanel = new StackPanel('chatMessages');
    this.messagesPanel.width = '100%';
    this.messagesPanel.height = '280px';
    this.messagesPanel.top = '40px';
    this.messagesPanel.verticalAlignment = 0; // TOP
    this.messagesPanel.isVertical = true;
    this.chatPanel.addControl(this.messagesPanel);

    // Create input field
    this.inputField = new InputText('chatInput', '');
    this.inputField.width = '200px';
    this.inputField.height = '40px';
    this.inputField.color = 'black';
    this.inputField.background = 'white';
    this.inputField.top = '-50px';
    this.inputField.horizontalAlignment = 0; // LEFT
    this.inputField.verticalAlignment = 1; // BOTTOM
    this.inputField.focusedBackground = 'white';
    this.inputField.paddingLeft = '8px';
    this.inputField.paddingRight = '8px';
    
    // Handle Enter key to send message
    // Track if input is focused manually
    let inputFocused = false;
    this.inputField.onFocusObservable.add(() => {
      inputFocused = true;
      console.log(`[${this.id}] 💬 Chat input focused`);
    });
    this.inputField.onBlurObservable.add(() => {
      inputFocused = false;
      console.log(`[${this.id}] 💬 Chat input blurred`);
    });
    
    // Listen on scene for Enter key when input is focused
    scene.onKeyboardObservable.add((kbInfo) => {
      if (this.inputField && inputFocused && kbInfo.type === KeyboardEventTypes.KEYDOWN) {
        if (kbInfo.event.key === 'Enter') {
          const text = this.inputField.text.trim();
          if (text) {
            console.log(`[${this.id}] ⌨️ Enter key pressed in chat input`);
            this.sendMessage();
            if (kbInfo.event.preventDefault) {
              kbInfo.event.preventDefault();
            }
          }
        }
      }
    });
    
    this.chatPanel.addControl(this.inputField);

    // Create send button
    this.sendButton = Button.CreateSimpleButton('chatSend', 'Send');
    this.sendButton.width = '80px';
    this.sendButton.height = '40px';
    this.sendButton.color = 'white';
    this.sendButton.background = '#4a9eff';
    this.sendButton.cornerRadius = 4;
    this.sendButton.left = '210px';
    this.sendButton.top = '-50px';
    this.sendButton.horizontalAlignment = 0; // LEFT
    this.sendButton.verticalAlignment = 1; // BOTTOM
    this.sendButton.onPointerClickObservable.add(() => {
      this.sendMessage();
    });
    this.chatPanel.addControl(this.sendButton);
  }

  private toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.chatPanel) {
      this.chatPanel.isVisible = this.isOpen;
    }
    if (this.toggleButton) {
      this.toggleButton.textBlock!.text = this.isOpen ? 'Close Chat' : 'Open Chat';
    }
  }

  private sendMessage(): void {
    if (!this.inputField) {
      console.warn(`[${this.id}] ⚠️ Input field not available`);
      return;
    }
    
    const text = this.inputField.text.trim();
    if (!text) {
      console.warn(`[${this.id}] ⚠️ Empty message, not sending`);
      return;
    }

    console.log(`[${this.id}] 📤 Sending chat message: "${text}" from player: ${this.playerId.substring(0, 8)}`);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: this.playerId,
        text: text,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`[${this.id}] ❌ Chat message failed with status:`, response.status);
        } else {
          console.log(`[${this.id}] ✅ Chat message sent successfully:`, text);
          // Clear input after successful send
          if (this.inputField) {
            this.inputField.text = '';
          }
        }
      })
      .catch((err) => {
        console.error(`[${this.id}] ❌ Failed to send chat message:`, err);
      });
  }

  /**
   * Handle element updates from Datastar (chat messages)
   * 
   * This method is called automatically by DatastarUpdateManager when
   * the server sends element patches targeting #chat-messages.
   * 
   * @param selector - CSS selector for the target element (#chat-messages)
   * @param mode - Patch mode: "append", "replace", "prepend"
   * @param html - HTML content containing the chat message
   */
  override onElementUpdate(selector: string, mode: string, html: string): void {
    console.log(`[${this.id}] 💬 Element update received: selector=${selector}, mode=${mode}`);
    console.log(`[${this.id}] 💬 HTML content: ${html.substring(0, 100)}...`);
    
    // Only handle updates for the chat messages panel
    if (selector === '#chat-messages' && this.messagesPanel) {
      try {
        // Parse HTML and create Babylon GUI controls
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const messageElement = tempDiv.firstElementChild;
        if (messageElement) {
          // Extract text content, handling both text nodes and HTML
          let messageText = '';
          if (messageElement.textContent) {
            messageText = messageElement.textContent.trim();
          } else {
            messageText = messageElement.innerHTML || '';
          }
          
          if (!messageText) {
            console.warn(`[${this.id}] ⚠️ Empty message text extracted from HTML`);
            return;
          }
          
          // Create a TextBlock for the message
          const messageId = `message-${Date.now()}-${Math.random()}`;
          const messageBlock = new TextBlock(messageId, messageText);
          messageBlock.height = 'auto';
          messageBlock.width = '100%';
          messageBlock.color = 'white';
          messageBlock.fontSize = 14;
          messageBlock.textHorizontalAlignment = 0; // LEFT
          messageBlock.textWrapping = true;
          messageBlock.paddingTop = '4px';
          messageBlock.paddingBottom = '4px';
          messageBlock.paddingLeft = '8px';
          messageBlock.paddingRight = '8px';
          
          if (mode === 'append') {
            // Add new message to the bottom
            this.messagesPanel.addControl(messageBlock);
            console.log(`[${this.id}] ✅ Chat message appended: "${messageText.substring(0, 50)}"`);
            
            // Ensure chat panel is visible when message arrives
            if (!this.isOpen && this.chatPanel) {
              this.toggleChat(); // Auto-open chat when message arrives
            }
          } else if (mode === 'prepend') {
            // Add new message to the top
            const controls = this.messagesPanel.children.slice();
            this.messagesPanel.clearControls();
            this.messagesPanel.addControl(messageBlock);
            controls.forEach((ctrl) => {
              this.messagesPanel!.addControl(ctrl);
            });
            console.log(`[${this.id}] ✅ Chat message prepended: "${messageText.substring(0, 50)}"`);
          } else if (mode === 'replace') {
            // Replace all messages
            this.messagesPanel.clearControls();
            this.messagesPanel.addControl(messageBlock);
            console.log(`[${this.id}] ✅ Chat messages replaced`);
          }
        } else {
          console.warn(`[${this.id}] ⚠️ No message element found in HTML: ${html}`);
        }
      } catch (err) {
        console.error(`[${this.id}] ❌ Error processing chat element update:`, err);
        console.error(`[${this.id}] HTML that failed: ${html}`);
      }
    } else {
      // Log unhandled selectors for debugging
      console.log(`[${this.id}] ⚠️ Received element update for unhandled selector: ${selector} (expected #chat-messages)`);
      console.log(`[${this.id}] Messages panel exists: ${!!this.messagesPanel}`);
    }
  }

  /**
   * Handle signal updates from Datastar
   * 
   * Chat doesn't use signal updates, but this method is part of the IDatastar interface.
   * Could be used in the future for chat state signals (e.g., user list, typing indicators).
   */
  override onSignalUpdate(signalName: string, _data: unknown): void {
    // Chat currently uses element patches, not signals
    // This could be extended in the future for chat-related signals
    console.debug(`[${this.id}] Signal update received (not used by chat):`, signalName);
  }

  override dispose(): void {
    if (this.advancedTexture) {
      this.advancedTexture.dispose();
      this.advancedTexture = null;
    }
    console.log(`[${this.id}] Disposed`);
  }
}

