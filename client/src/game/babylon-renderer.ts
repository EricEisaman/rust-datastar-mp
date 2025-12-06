import {
  Engine,
  Scene,
  SpriteManager,
  Sprite,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
} from '@babylonjs/core';
import { BaseDatastarReceiver } from '../interfaces/datastar';
import { createScene } from '../scene';
import { gameState, type Player } from './player-state';
import { ChatGUI } from './chat-gui';
import { datastarManager } from './datastar-manager';

export class BabylonRenderer extends BaseDatastarReceiver {
  readonly id = 'babylon-renderer';
  private engine: Engine;
  private scene: Scene;
  private playerSprites: Map<string, Sprite> = new Map();
  private spriteManager: SpriteManager | null = null;
  private groundMesh: Mesh | null = null;
  private platformMeshes: Map<string, Mesh> = new Map();
  private chatGUI: ChatGUI | null = null;
  
  // Game configuration (loaded from server)
  private gameConfig: {
    physics: {
      ground_y: number;
      player_width: number;
      player_height: number;
    };
    platforms: Array<{
      id: string;
      x_start: number;
      x_end: number;
      y_top: number;
      height: number;
    }>;
  } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super();
    
    // Create Babylon.js engine
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    // Create scene
    this.scene = createScene(this.engine, canvas);

    // Create sprite manager with programmatic texture
    this.createSpriteManager();

    // Create ground
    this.createGround();

    // Load game config and create platforms
    this.loadGameConfig().then(() => {
      this.createPlatforms();
    });

    // Create chat GUI
    this.chatGUI = new ChatGUI(this.engine, this.scene);
    datastarManager.register(this.chatGUI);

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });

    // Start render loop
    this.engine.runRenderLoop(() => {
      this.update();
      this.scene.render();
    });
  }

  /**
   * Generate a unique color for a player based on their ID
   */
  private getPlayerColor(playerId: string): string {
    // Hash the player ID to get a consistent color
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate a bright, saturated color
    const hue = Math.abs(hash) % 360;
    const saturation = 70 + (Math.abs(hash) % 30); // 70-100%
    const lightness = 50 + (Math.abs(hash) % 20); // 50-70%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Create a unique sprite texture for a player
   */
  private createPlayerSpriteTexture(playerId: string): string {
    const textureSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = textureSize;
    canvas.height = textureSize;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('[BabylonRenderer] Failed to get canvas context for sprite');
      return '';
    }
    
    // Get unique color for this player
    const playerColor = this.getPlayerColor(playerId);
    
    // Clear with transparent background
    ctx.clearRect(0, 0, textureSize, textureSize);
    
    // Draw body with unique color
    ctx.fillStyle = playerColor;
    ctx.fillRect(8, 8, 48, 48);
    
    // Draw face (white circle)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(textureSize / 2, textureSize / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw eyes (black circles)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(textureSize / 2 - 8, textureSize / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(textureSize / 2 + 8, textureSize / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Convert canvas to data URL
    return canvas.toDataURL('image/png');
  }

  private createSpriteManager(): void {
    // Create a shared sprite manager - we'll create individual textures per player
    // For now, create a default texture (will be replaced per-player)
    const defaultTexture = this.createPlayerSpriteTexture('default');
    
    this.spriteManager = new SpriteManager(
      'playerSpriteManager',
      defaultTexture,
      100, // max sprites
      64, // sprite size
      this.scene,
    );
  }

  private createGround(): void {
    // Create ground as a box mesh for 2D Metroidvania style
    // Ground positioned at the bottom of the camera view
    // Camera view: -10 to 10 world units, so ground at y = -10 (bottom of view)
    
    // Create a wide, thin box for the ground
    this.groundMesh = MeshBuilder.CreateBox(
      'ground',
      { 
        width: 200,  // 200 world units = 20000 pixels wide (very wide)
        height: 1,   // 1 world unit = 100 pixels tall
        depth: 0.1  // Very thin depth for 2D look
      },
      this.scene,
    );
    
    // Position ground at the bottom of the screen
    this.groundMesh.position.x = 0;
    this.groundMesh.position.y = -10; // Bottom of camera view
    this.groundMesh.position.z = 0;
    
    // Create brown/dirt colored material with toon shading
    const groundMaterial = new StandardMaterial('groundMaterial', this.scene);
    groundMaterial.diffuseColor = new Color3(0.55, 0.44, 0.28); // Brown/dirt color (#8B6F47)
    // Toon shading: use emissive to create flat, unlit appearance
    groundMaterial.emissiveColor = new Color3(0.55, 0.44, 0.28); // Same as diffuse for flat look
    groundMaterial.specularColor = new Color3(0, 0, 0); // No specular highlights
    groundMaterial.disableLighting = true; // Completely flat, unlit appearance (toon style)
    this.groundMesh.material = groundMaterial;
    
    console.log(`[${this.id}] ✅ Ground box created at y=-10 (bottom of screen)`);
  }

  /**
   * Load game configuration from server
   */
  private async loadGameConfig(): Promise<void> {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`Failed to load game config: ${response.statusText}`);
      }
      this.gameConfig = await response.json();
      console.log(`[${this.id}] ✅ Loaded game config:`, this.gameConfig);
    } catch (error) {
      console.error(`[${this.id}] ❌ Failed to load game config:`, error);
      // Use default config as fallback
      this.gameConfig = {
        physics: {
          ground_y: -10.0,
          player_width: 1.5,
          player_height: 1.5,
        },
        platforms: [
          {
            id: 'platform_1',
            x_start: -3.0,
            x_end: 3.0,
            y_top: 2.0,
            height: 0.5,
          },
        ],
      };
    }
  }

  /**
   * Create all platforms from game configuration
   */
  private createPlatforms(): void {
    if (!this.gameConfig) {
      console.warn(`[${this.id}] ⚠️ Game config not loaded, skipping platform creation`);
      return;
    }

    // Create dark reddish-orange platform material with toon shading (shared across all platforms)
    const platformMaterial = new StandardMaterial('platformMaterial', this.scene);
    platformMaterial.diffuseColor = new Color3(0.7, 0.3, 0.2); // Dark reddish-orange (#B34733)
    platformMaterial.emissiveColor = new Color3(0.7, 0.3, 0.2); // Toon shading
    platformMaterial.specularColor = new Color3(0, 0, 0);
    platformMaterial.disableLighting = true;

    // Create a platform mesh for each platform in the config
    for (const platform of this.gameConfig.platforms) {
      const width = platform.x_end - platform.x_start;
      const centerX = (platform.x_start + platform.x_end) / 2.0;
      const centerY = platform.y_top - platform.height / 2.0;

      const platformMesh = MeshBuilder.CreateBox(
        `platform_${platform.id}`,
        {
          width: width,
          height: platform.height,
          depth: 0.1, // Very thin depth for 2D look
        },
        this.scene,
      );

      platformMesh.position.x = centerX;
      platformMesh.position.y = centerY;
      platformMesh.position.z = 0;
      platformMesh.material = platformMaterial;

      this.platformMeshes.set(platform.id, platformMesh);
      console.log(
        `[${this.id}] ✅ Platform "${platform.id}" created: ${width.toFixed(1)}m wide at y=${platform.y_top.toFixed(1)}`,
      );
    }

    console.log(`[${this.id}] ✅ Created ${this.platformMeshes.size} platform(s) from config`);
  }

  /**
   * Handle game state signal updates
   * This is called by DatastarUpdateManager when gameState signal is received
   */
  override onSignalUpdate(signalName: string, data: unknown): void {
    if (signalName === 'gameState' && Array.isArray(data)) {
      const players = data as Player[];
      console.log(`[${this.id}] 📨 Received gameState signal with ${players.length} players`);
      if (players.length > 0) {
        console.log(`[${this.id}] 🎮 Players:`, players.map(p => ({ id: p.id.substring(0, 8), x: p.x.toFixed(1), y: p.y.toFixed(1) })));
      }
      // Update sprites based on the new game state
      this.updateSprites(players);
    }
  }

  /**
   * Update player sprites based on game state
   */
  private updateSprites(players: Player[]): void {
    console.log(`[${this.id}] 🎨 Updating sprites for ${players.length} players, current sprites: ${this.playerSprites.size}`);

    // Remove sprites for players that no longer exist
    const currentPlayerIds = new Set(players.map((p) => p.id));
    for (const [playerId, sprite] of this.playerSprites.entries()) {
      if (!currentPlayerIds.has(playerId)) {
        console.log(`[${this.id}] 🗑️ Removing sprite for player: ${playerId.substring(0, 8)}`);
        const manager = (sprite as any).manager;
        if (manager) {
          manager.dispose();
        }
        sprite.dispose();
        this.playerSprites.delete(playerId);
      }
    }

    // Update or create player sprites
    for (const player of players) {
      let playerSprite = this.playerSprites.get(player.id);

      if (!playerSprite) {
        console.log(`[${this.id}] 🆕 Creating new sprite for player: ${player.id.substring(0, 8)}`);
        
        // Create unique texture for this player
        const playerTexture = this.createPlayerSpriteTexture(player.id);
        
        if (!playerTexture) {
          console.error(`[${this.id}] ❌ Failed to create texture for player: ${player.id.substring(0, 8)}`);
          continue;
        }
        
        // Create a new sprite manager for this player with their unique texture
        const playerSpriteManager = new SpriteManager(
          `playerSpriteManager-${player.id}`,
          playerTexture,
          1, // Only need 1 sprite per manager
          64,
          this.scene,
        );
        
        // Create new player sprite with unique appearance
        playerSprite = new Sprite(`player-${player.id}`, playerSpriteManager);
        // Fixed size - don't vary with screen width
        playerSprite.width = 1.5; // Fixed width in world units
        playerSprite.height = 1.5; // Fixed height in world units
        this.playerSprites.set(player.id, playerSprite);
        
        const playerColor = this.getPlayerColor(player.id);
        console.log(`[${this.id}] ✅ Created unique sprite for player: ${player.id.substring(0, 8)} (color: ${playerColor})`);
      }

      // Update player position
      // Game coordinates are already in world units (no scaling needed)
      // 2D side-scroller: Y increases UP, ground is at y=-10
      playerSprite.position.x = player.x; // Direct mapping (already in world units)
      playerSprite.position.y = player.y; // Direct mapping (already in world units)
      playerSprite.position.z = 0;

      // Update facing direction (flip sprite horizontally)
      // Keep height fixed, only flip width for direction
      const fixedHeight = 1.5; // Fixed height in world units
      if (player.facing_right) {
        playerSprite.width = 1.5; // Fixed width in world units
        playerSprite.height = fixedHeight;
      } else {
        playerSprite.width = -1.5; // Negative width flips horizontally
        playerSprite.height = fixedHeight;
      }
    }
    
    console.log(`[${this.id}] ✅ Updated ${this.playerSprites.size} sprites`);
  }

  private update(): void {
    // Update from reactive gameState (fallback for compatibility)
    const players = gameState.value.gameState;
    this.updateSprites(players);
  }

  override dispose(): void {
    // Clean up chat GUI
    if (this.chatGUI) {
      datastarManager.unregister(this.chatGUI.id);
      this.chatGUI.dispose();
      this.chatGUI = null;
    }

    // Clean up all sprites and their managers
    for (const [, sprite] of this.playerSprites.entries()) {
      // Dispose the sprite's manager
      const manager = (sprite as any).manager;
      if (manager) {
        manager.dispose();
      }
      sprite.dispose();
    }
    this.playerSprites.clear();

    if (this.spriteManager) {
      this.spriteManager.dispose();
    }

    if (this.groundMesh) {
      this.groundMesh.dispose();
    }

    // Dispose all platform meshes
    for (const [id, mesh] of this.platformMeshes) {
      mesh.dispose();
      console.log(`[${this.id}] 🗑️ Disposed platform: ${id}`);
    }
    this.platformMeshes.clear();

    this.scene.dispose();
    this.engine.dispose();
    
    console.log(`[${this.id}] Disposed`);
  }
}

