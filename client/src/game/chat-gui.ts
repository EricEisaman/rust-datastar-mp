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
  KeyboardEventTypes,
  Animation,
  QuadraticEase,
  CubicEase,
  EasingFunction,
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

    // Create messages panel (scrollable area)
    this.messagesPanel = new StackPanel('chatMessages');
    this.messagesPanel.width = '100%';
    this.messagesPanel.height = '310px';
    this.messagesPanel.top = '10px';
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
      console.warn(`[${this.id}] ⚠️ Input field not available`);
      return;
    }

    const text = this.inputField.text.trim();
    if (!text) {
      console.warn(`[${this.id}] ⚠️ Empty message, not sending`);
      return;
    }

    console.log(
      `[${this.id}] 📤 Sending chat message: "${text}" from player: ${this.playerId.substring(0, 8)}`
    );

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
    console.log(`[${this.id}] 💬 HTML content: ${html.substring(0, 200)}...`);

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
            const colorMatch = styleAttr.match(/color:\s*([^;]+)/);
            if (colorMatch && colorMatch[1]) {
              nameColor = colorMatch[1].trim();
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
            console.warn(`[${this.id}] ⚠️ Empty message text extracted from HTML`);
            return;
          }

          // Create a container for the message with proper wrapping
          // Use a single TextBlock that can wrap, with formatted text showing name in color
          const messageId = `message-${Date.now()}-${Math.random()}`;
          const messageContainer = new Rectangle(`container-${messageId}`);
          messageContainer.height = 'auto';
          messageContainer.width = '100%';
          messageContainer.thickness = 0;
          messageContainer.background = 'transparent';
          messageContainer.paddingTop = '4px';
          messageContainer.paddingBottom = '4px';
          messageContainer.paddingLeft = '8px';
          messageContainer.paddingRight = '8px';

          // Create a horizontal stack panel for name (inline) + message (wrapping)
          const nameMessagePanel = new StackPanel(`nameMessage-${messageId}`);
          nameMessagePanel.height = 'auto';
          nameMessagePanel.width = '100%';
          nameMessagePanel.isVertical = false; // Horizontal: name on left, message on right
          nameMessagePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
          messageContainer.addControl(nameMessagePanel);

          // Create name TextBlock with color (inline, no wrap, fixed width)
          if (nameText) {
            const nameBlock = new TextBlock(`name-${messageId}`, `${nameText}: `);
            nameBlock.height = 'auto';
            nameBlock.width = 'auto';
            nameBlock.color = nameColor;
            nameBlock.fontSize = 14;
            nameBlock.fontWeight = 'bold';
            nameBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            nameBlock.resizeToFit = true;
            nameBlock.textWrapping = false; // Name doesn't wrap
            nameMessagePanel.addControl(nameBlock);
          }

          // Create message TextBlock that can wrap (takes remaining space)
          const messageBlock = new TextBlock(`text-${messageId}`, messageText);
          messageBlock.height = 'auto';
          messageBlock.width = '1*'; // Take remaining space, allows wrapping
          messageBlock.color = 'white';
          messageBlock.fontSize = 14;
          messageBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
          messageBlock.textWrapping = true; // Enable text wrapping for long messages
          messageBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
          nameMessagePanel.addControl(messageBlock);

          if (mode === 'append') {
            // Add new message to the bottom
            this.messagesPanel.addControl(messageContainer);
            console.log(
              `[${this.id}] ✅ Chat message appended: "${nameText}: ${messageText.substring(0, 50)}"`
            );

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
            console.log(
              `[${this.id}] ✅ Chat message prepended: "${nameText}: ${messageText.substring(0, 50)}"`
            );
          } else if (mode === 'replace') {
            // Replace all messages
            this.messagesPanel.clearControls();
            this.messagesPanel.addControl(messageContainer);
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
      console.log(
        `[${this.id}] ⚠️ Received element update for unhandled selector: ${selector} (expected #chat-messages)`
      );
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
