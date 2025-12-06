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

import {
  Engine,
  Scene,
  Animation,
  QuadraticEase,
  CubicEase,
  EasingFunction,
  KeyboardEventTypes,
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  InputText,
  Button,
  StackPanel,
  Control,
} from '@babylonjs/gui';
import { BaseDatastarReceiver, type IDatastar } from '../interfaces/datastar';
import { getPlayerId } from './player-state';

/**
 * Animation proxy interface for Babylon.js animations
 */
interface AnimationProxy {
  animations?: Animation[];
  [key: string]: number | Animation[] | undefined;
}

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
  private scene: Scene;
  private inputFocused = false;

  /**
   * Check if chat input is currently focused
   * Used by input system to disable game controls when typing
   */
  isInputFocused(): boolean {
    return this.inputFocused;
  }

  constructor(_engine: Engine, scene: Scene) {
    super();
    this.playerId = getPlayerId();
    this.scene = scene;
    this.initializeGUI(_engine, scene);
  }

  /**
   * Initialize the chat GUI
   * Called automatically when the receiver is registered with DatastarManager
   */
  override initialize(): void {
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

    // Create messages panel (scrollable area)
    this.messagesPanel = new StackPanel('chatMessages');
    this.messagesPanel.width = '100%';
    this.messagesPanel.height = '310px';
    this.messagesPanel.top = '10px';
    this.messagesPanel.left = '0px';
    this.messagesPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.messagesPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.messagesPanel.isVertical = true;
    this.messagesPanel.isVisible = true;
    this.messagesPanel.paddingTop = '0px';
    this.messagesPanel.paddingBottom = '0px';
    this.messagesPanel.paddingLeft = '0px';
    this.messagesPanel.paddingRight = '0px';
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

    // Handle Enter key to send message using proper Babylon.js keyboard observable
    // Track if input is focused
    this.inputField.onFocusObservable.add(() => {
      this.inputFocused = true;
      console.log(`[${this.id}] 💬 Input field focused`);
    });
    this.inputField.onBlurObservable.add(() => {
      this.inputFocused = false;
      console.log(`[${this.id}] 💬 Input field blurred`);
    });

    // Use scene.onKeyboardObservable - the proper Babylon.js way
    const keyboardObserver = scene.onKeyboardObservable.add((kbInfo) => {
      // Only handle KEYDOWN events
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
        // Check if Enter key is pressed (check both key and code)
        const isEnter = kbInfo.event.key === 'Enter' || 
                       kbInfo.event.key === 'NumpadEnter' ||
                       kbInfo.event.code === 'Enter' ||
                       kbInfo.event.code === 'NumpadEnter';
        
        if (isEnter) {
          // Check if chat is open and input field exists
          if (this.isOpen && this.inputField) {
            // Also check DOM directly - Babylon.js InputText creates a DOM input
            const activeElement = document.activeElement;
            const isDOMInputActive = activeElement && activeElement.tagName === 'INPUT';
            
            console.log(`[${this.id}] ⌨️ Enter key pressed - isOpen: ${this.isOpen}, inputFocused: ${this.inputFocused}, isDOMInputActive: ${isDOMInputActive}, activeElement: ${activeElement?.tagName}`);
            
            // If chat is open, treat Enter as send (unless shift is held)
            // Check if chat is open - if so, Enter should send message
            if (!kbInfo.event.shiftKey) {
              kbInfo.event.preventDefault();
              const text = (this.inputField.text || '').trim();
              console.log(`[${this.id}] ⌨️ Enter key detected (chat open), text: "${text}"`);
              if (text) {
                console.log(`[${this.id}] ⌨️ Sending message via Enter key`);
                this.sendMessage();
                return; // Prevent further processing
              }
            }
          }
        }
      }
    });

    // Store the observer so we can remove it on dispose
    (this as { _keyboardObserver?: typeof keyboardObserver })._keyboardObserver = keyboardObserver;

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

  /**
   * Animate fade for a control
   */
  private fadeControl(
    control: Control,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void
  ): void {
    const frameRate = 60;
    const totalFrames = (durationMs / 1000) * frameRate;

    const animation = new Animation(
      `fade-${control.name}`,
      'alpha',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const keys = [
      { frame: 0, value: from },
      { frame: totalFrames, value: to },
    ];
    animation.setKeys(keys);

    const easing = new QuadraticEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    animation.setEasingFunction(easing);

    control.animations = control.animations || [];
    control.animations.push(animation);

    this.scene.beginAnimation(control, 0, totalFrames, false, 1.0, onComplete);
  }

  /**
   * Animate slide and fade for a control
   */
  private slideAndFadeControl(
    control: Control,
    fromLeft: number,
    toLeft: number,
    fromAlpha: number,
    toAlpha: number,
    durationMs: number,
    onComplete?: () => void
  ): void {
    const frameRate = 60;
    const totalFrames = (durationMs / 1000) * frameRate;

    // Create proxy object for animation with proper type
    const proxy: AnimationProxy & { left: number; alpha: number } = {
      left: fromLeft,
      alpha: fromAlpha,
      animations: [],
    };

    // Fade animation
    const fadeAnim = new Animation(
      `fade-${control.name}`,
      'alpha',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    fadeAnim.setKeys([
      { frame: 0, value: fromAlpha },
      { frame: totalFrames, value: toAlpha },
    ]);

    // Slide animation
    const slideAnim = new Animation(
      `slide-${control.name}`,
      'left',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    slideAnim.setKeys([
      { frame: 0, value: fromLeft },
      { frame: totalFrames, value: toLeft },
    ]);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    fadeAnim.setEasingFunction(easing);
    slideAnim.setEasingFunction(easing);

    proxy.animations = [fadeAnim, slideAnim];

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      control.alpha = proxy.alpha;
      control.left = `${proxy.left}px`;
    });

    this.scene.beginAnimation(proxy, 0, totalFrames, false, 1.0, () => {
      this.scene.onBeforeRenderObservable.remove(observer);
      if (onComplete) {
        onComplete();
      }
    });
  }

  /**
   * Animate a new message appearing
   */
  private animateMessageIn(messageContainer: Control): void {
    // Start invisible and slightly to the right
    messageContainer.alpha = 0;
    const originalLeft = messageContainer.left;
    const leftValue =
      typeof originalLeft === 'string' ? parseFloat(originalLeft.replace('px', '')) || 0 : 0;

    messageContainer.left = `${leftValue + 20}px`;

    // Fade and slide in
    this.fadeControl(messageContainer, 0, 1, 300);

    // Slide animation
    const frameRate = 60;
    const totalFrames = (300 / 1000) * frameRate;
    const proxy: AnimationProxy & { left: number } = {
      left: leftValue + 20,
      animations: [],
    };

    const slideAnim = new Animation(
      `slide-${messageContainer.name}`,
      'left',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    slideAnim.setKeys([
      { frame: 0, value: leftValue + 20 },
      { frame: totalFrames, value: leftValue },
    ]);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    slideAnim.setEasingFunction(easing);

    proxy.animations = [slideAnim];

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      messageContainer.left = `${proxy.left}px`;
    });

    this.scene.beginAnimation(proxy, 0, totalFrames, false, 1.0, () => {
      this.scene.onBeforeRenderObservable.remove(observer);
      messageContainer.left = originalLeft; // Restore original
    });
  }

  private toggleChat(): void {
    this.isOpen = !this.isOpen;

    if (!this.chatPanel) {
      return;
    }

    if (this.isOpen) {
      // Show panel with animation
      this.chatPanel.isVisible = true;
      this.chatPanel.alpha = 0;

      // Slide and fade in from left
      this.slideAndFadeControl(
        this.chatPanel,
        -350, // Start off-screen to the left
        20, // End at normal position
        0, // Start invisible
        1, // End fully visible
        400, // 400ms animation
        () => {
          // Animation complete
        }
      );
    } else {
      // Hide panel with animation
      this.slideAndFadeControl(
        this.chatPanel,
        20, // Start at normal position
        -350, // End off-screen to the left
        1, // Start fully visible
        0, // End invisible
        300, // 300ms animation
        () => {
          // Hide after animation
          if (this.chatPanel) {
            this.chatPanel.isVisible = false;
          }
        }
      );
    }

    if (this.toggleButton) {
      this.toggleButton.textBlock!.text = this.isOpen ? 'Close Chat' : 'Open Chat';
    }
  }

  private sendMessage(): void {
    if (!this.inputField) {
      console.error(`[${this.id}] ❌ Input field not available - cannot send message`);
      return;
    }

    const text = (this.inputField.text || '').trim();
    if (!text) {
      return;
    }

    if (!this.playerId) {
      console.error(`[${this.id}] ❌ Player ID not available - cannot send message`);
      return;
    }

    console.log(
      `[${this.id}] 📤 Sending chat message: "${text}" from player: ${this.playerId.substring(0, 8)}`
    );

    const payload = {
      player_id: this.playerId,
      text: text,
    };

    // Clear input immediately (optimistic UI update)
    const originalText = this.inputField.text;
    this.inputField.text = '';

    fetch('/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        console.log(`[${this.id}] 📥 Received response: status=${response.status}, ok=${response.ok}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[${this.id}] ❌ Chat message failed with status: ${response.status}, error: ${errorText}`
          );
          // Restore text if send failed
          if (this.inputField) {
            this.inputField.text = originalText;
          }
        } else {
          const responseText = await response.text();
          console.log(
            `[${this.id}] ✅ Chat message sent successfully: "${text}" (response: ${responseText || 'empty'})`
          );
        }
      })
      .catch((err) => {
        console.error(`[${this.id}] ❌ Failed to send chat message:`, err);
        // Restore text if send failed
        if (this.inputField) {
          this.inputField.text = originalText;
        }
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
    
    // Only handle updates for the chat messages panel
    if (selector === '#chat-messages' && this.messagesPanel) {
      console.log(`[${this.id}] ✅ Processing chat message update`);
      try {
        // Parse HTML and create Babylon GUI controls
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const messageElement = tempDiv.firstElementChild;
        if (messageElement) {
          // Parse HTML to extract name and message
          // Format: <div><span style="color: #HEX;">Name:</span> message</div>
          const nameSpan = messageElement.querySelector('span');
          let nameText = '';
          let nameColor = 'white';
          let messageText = '';

          if (nameSpan) {
            // Extract name and color from span
            nameText = nameSpan.textContent?.replace(':', '').trim() || '';
            const styleAttr = nameSpan.getAttribute('style') || '';
            // Match color with or without quotes, handle rgb() and hex formats
            const colorMatch = styleAttr.match(/color:\s*([^;]+)/);
            if (colorMatch && colorMatch[1]) {
              let extractedColor = colorMatch[1].trim();
              // Remove quotes if present
              extractedColor = extractedColor.replace(/^["']|["']$/g, '');
              nameColor = extractedColor;
              console.log(`[${this.id}] 🎨 Extracted player color: "${nameColor}" for player: ${nameText}`);
            } else {
              console.warn(`[${this.id}] ⚠️ Could not extract color from style: "${styleAttr}"`);
            }

            // Extract message text (everything after the span)
            const tempDiv2 = document.createElement('div');
            tempDiv2.innerHTML = messageElement.innerHTML;
            tempDiv2.querySelector('span')?.remove();
            messageText = tempDiv2.textContent?.trim() || '';
          } else {
            // Fallback: extract all text
            messageText = messageElement.textContent?.trim() || '';
          }

          if (!messageText && !nameText) {
            return;
          }

          // Log received chat message
          console.log(`[${this.id}] 📥 Client received chat message from ${nameText || 'Unknown'}: "${messageText}"`);

          // Create a container for the message with proper wrapping
          // Use a single TextBlock that can wrap, with formatted text showing name in color
          const messageId = `message-${Date.now()}-${Math.random()}`;
          const messageContainer = new Rectangle(`container-${messageId}`);
          messageContainer.height = '30px'; // Fixed height instead of auto
          messageContainer.width = '100%';
          messageContainer.thickness = 0;
          messageContainer.background = 'transparent';
          messageContainer.paddingTop = '4px';
          messageContainer.paddingBottom = '4px';
          messageContainer.paddingLeft = '8px';
          messageContainer.paddingRight = '8px';
          messageContainer.isVisible = true; // Ensure container is visible
          messageContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
          messageContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

          // Create a horizontal stack panel for name (inline) + message (wrapping)
          const nameMessagePanel = new StackPanel(`nameMessage-${messageId}`);
          nameMessagePanel.height = '30px'; // Fixed height
          nameMessagePanel.width = '100%';
          nameMessagePanel.isVertical = false; // Horizontal: name on left, message on right
          nameMessagePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
          nameMessagePanel.isVisible = true; // Ensure panel is visible
          messageContainer.addControl(nameMessagePanel);

          // Create name TextBlock with color (inline, no wrap, fixed width)
          let nameBlock: TextBlock | null = null;
          if (nameText) {
            nameBlock = new TextBlock(`name-${messageId}`, `${nameText}: `);
            nameBlock.height = '30px'; // Fixed height
            nameBlock.width = 'auto';
            // Apply the player's color - use the extracted color or fallback to white
            // Ensure color is in proper format (hex with #)
            let finalColor = nameColor || '#FFFFFF';
            if (!finalColor.startsWith('#')) {
              finalColor = `#${finalColor}`;
            }
            // Ensure it's a valid hex color (6 digits)
            if (!/^#[0-9A-Fa-f]{6}$/.test(finalColor)) {
              console.warn(`[${this.id}] ⚠️ Invalid color format: "${finalColor}", using white`);
              finalColor = '#FFFFFF';
            }
            nameBlock.color = finalColor;
            console.log(`[${this.id}] 🎨 Applied color "${finalColor}" to name block for: ${nameText}`);
            nameBlock.fontSize = 14;
            nameBlock.fontWeight = 'bold';
            nameBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            nameBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            nameBlock.resizeToFit = true;
            nameBlock.textWrapping = false; // Name doesn't wrap
            nameBlock.isVisible = true; // Ensure name block is visible
            // Mark as dirty to force color update
            nameBlock.markAsDirty();
            nameMessagePanel.addControl(nameBlock);
          }

          // Create message TextBlock that can wrap (takes remaining space)
          const messageBlock = new TextBlock(`text-${messageId}`, messageText);
          messageBlock.height = '30px'; // Fixed height
          messageBlock.width = '100%'; // Use 100% width within the panel
          messageBlock.color = 'white';
          messageBlock.fontSize = 14;
          messageBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
          messageBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
          messageBlock.textWrapping = false; // Disable wrapping for now to ensure visibility
          messageBlock.isVisible = true; // Ensure message block is visible
          nameMessagePanel.addControl(messageBlock);

          if (mode === 'append') {
            // Ensure messagesPanel is visible and properly set up
            if (!this.messagesPanel) {
              console.error(`[${this.id}] ❌ Messages panel is null!`);
              return;
            }
            
            // Add new message to the bottom
            this.messagesPanel.addControl(messageContainer);
            console.log(
              `[${this.id}] ✅ Chat message appended: "${nameText}: ${messageText.substring(0, 50)}" (panel has ${this.messagesPanel.children.length} controls)`
            );

            // Force update to ensure rendering - mark all parent controls as dirty
            messageContainer.markAsDirty();
            nameMessagePanel.markAsDirty();
            if (nameBlock) {
              nameBlock.markAsDirty();
            }
            messageBlock.markAsDirty();
            if (this.messagesPanel) {
              this.messagesPanel.markAsDirty();
            }
            if (this.chatPanel) {
              this.chatPanel.markAsDirty();
            }
            if (this.advancedTexture) {
              this.advancedTexture.markAsDirty();
            }

            // Animate message appearing
            this.animateMessageIn(messageContainer);

            // Ensure chat panel is visible when message arrives
            if (!this.isOpen && this.chatPanel) {
              this.toggleChat(); // Auto-open chat when message arrives
            }
          } else if (mode === 'prepend') {
            // Add new message to the top
            const controls = this.messagesPanel.children.slice();
            this.messagesPanel.clearControls();
            this.messagesPanel.addControl(messageContainer);
            controls.forEach((ctrl) => {
              this.messagesPanel!.addControl(ctrl);
            });
          } else if (mode === 'replace') {
            // Replace all messages
            this.messagesPanel.clearControls();
            this.messagesPanel.addControl(messageContainer);
          }
        }
      } catch (err) {
        console.error(`[${this.id}] ❌ Error processing chat element update:`, err);
      }
    }
  }

  /**
   * Handle signal updates from Datastar
   *
   * Chat doesn't use signal updates, but this method is part of the IDatastar interface.
   * Could be used in the future for chat state signals (e.g., user list, typing indicators).
   */
  override onSignalUpdate(_signalName: string, _data: unknown): void {
    // Chat currently uses element patches, not signals
    // This could be extended in the future for chat-related signals
  }

  override dispose(): void {
    // Remove keyboard observer
    const observer = (this as { _keyboardObserver?: { dispose: () => void } })._keyboardObserver;
    if (observer && typeof observer.dispose === 'function') {
      observer.dispose();
      delete (this as { _keyboardObserver?: unknown })._keyboardObserver;
    }

    if (this.advancedTexture) {
      this.advancedTexture.dispose();
      this.advancedTexture = null;
    }
  }
}
