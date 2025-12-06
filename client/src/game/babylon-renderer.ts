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
  private playerSpriteManagers: Map<string, SpriteManager> = new Map();
  private spriteManager: SpriteManager | null = null;
  private groundMesh: Mesh | null = null;
  private platformMeshes: Map<string, Mesh> = new Map();
  private wallMeshes: Map<string, Mesh> = new Map();
  private chatGUI: ChatGUI | null = null;

  // Game configuration (loaded from server)
  private gameConfig: {
    physics: {
      ground_y: number;
      player_width: number;
      player_height: number;
      ground_color: string;
    };
    platforms: Array<{
      id: string;
      x_start: number;
      x_end: number;
      y_top: number;
      height: number;
      color: string;
    }>;
    walls: Array<{
      id: string;
      x: number;
      y_bottom: number;
      y_top: number;
      width: number;
      color: string;
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

    // Load game config first, then create ground, platforms, and walls
    this.loadGameConfig()
      .then(() => {
        console.log(`[${this.id}] 🎯 Config loaded successfully, creating game objects...`);
        this.createGround();
        this.createPlatforms();
        this.createWalls();
        console.log(`[${this.id}] ✅ All game objects created!`);
      })
      .catch((error) => {
        console.error(`[${this.id}] ❌ CRITICAL: Failed to load game config:`, error);
        console.error(`[${this.id}] ❌ Game will not function correctly without config!`);
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
   * Get the Babylon.js scene (for input handling)
   */
  getScene(): Scene {
    return this.scene;
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
      this.scene
    );
  }

  /**
   * Convert hex color string to Babylon.js Color3
   * @param hex - Hex color string (e.g., "#8B6F47" or "8B6F47")
   * @returns Color3 object
   */
  private hexToColor3(hex: string): Color3 {
    // Remove # if present
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

    // Parse RGB values
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255.0;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255.0;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255.0;

    return new Color3(r, g, b);
  }

  private createGround(): void {
    if (!this.gameConfig) {
      console.warn(`[${this.id}] ⚠️ Game config not loaded, using default ground color`);
    }

    // Create ground as a box mesh for 2D Metroidvania style
    // Ground positioned at the bottom of the camera view
    // Camera view: -10 to 10 world units, so ground at y = -10 (bottom of view)

    // Create a wide, thin box for the ground
    this.groundMesh = MeshBuilder.CreateBox(
      'ground',
      {
        width: 200, // 200 world units = 20000 pixels wide (very wide)
        height: 1, // 1 world unit = 100 pixels tall
        depth: 0.1, // Very thin depth for 2D look
      },
      this.scene
    );

    // Position ground at the bottom of the screen
    // Use ground_y from config if available, otherwise default to -10
    const groundY = this.gameConfig?.physics.ground_y ?? -10.0;
    this.groundMesh.position.x = 0;
    this.groundMesh.position.y = groundY; // Bottom of camera view (from config)
    this.groundMesh.position.z = 0;

    // Get ground color from config or use default
    const groundColorHex = this.gameConfig?.physics.ground_color || '#8B6F47';
    const groundColor = this.hexToColor3(groundColorHex);

    // Create material with configurable color and toon shading
    const groundMaterial = new StandardMaterial('groundMaterial', this.scene);
    groundMaterial.diffuseColor = groundColor;
    // Toon shading: use emissive to create flat, unlit appearance
    groundMaterial.emissiveColor = groundColor; // Same as diffuse for flat look
    groundMaterial.specularColor = new Color3(0, 0, 0); // No specular highlights
    groundMaterial.disableLighting = true; // Completely flat, unlit appearance (toon style)
    this.groundMesh.material = groundMaterial;

    console.log(
      `[${this.id}] ✅ Ground box created at y=${groundY} (bottom of screen) with color ${groundColorHex}`
    );
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
      const rawConfig = await response.json();
      console.log(`[${this.id}] 📥 Raw config from server:`, JSON.stringify(rawConfig, null, 2));
      
      // Explicitly map the config to ensure all fields are present
      this.gameConfig = {
        physics: {
          ground_y: rawConfig.physics?.ground_y ?? -10.0,
          player_width: rawConfig.physics?.player_width ?? 1.5,
          player_height: rawConfig.physics?.player_height ?? 1.5,
          ground_color: rawConfig.physics?.ground_color ?? '#8B6F47',
        },
        platforms: Array.isArray(rawConfig.platforms)
          ? rawConfig.platforms.map((p: unknown) => {
              if (typeof p === 'object' && p !== null) {
                const platform = p as Record<string, unknown>;
                return {
                  id: String(platform['id'] ?? ''),
                  x_start: Number(platform['x_start'] ?? 0),
                  x_end: Number(platform['x_end'] ?? 0),
                  y_top: Number(platform['y_top'] ?? 0),
                  height: Number(platform['height'] ?? 0.5),
                  color: String(platform['color'] ?? '#B34733'),
                };
              }
              throw new Error('Invalid platform config');
            })
          : [],
        walls: Array.isArray(rawConfig.walls)
          ? rawConfig.walls.map((w: unknown) => {
              if (typeof w === 'object' && w !== null) {
                const wall = w as Record<string, unknown>;
                return {
                  id: String(wall['id'] ?? ''),
                  x: Number(wall['x'] ?? 0),
                  y_bottom: Number(wall['y_bottom'] ?? 0),
                  y_top: Number(wall['y_top'] ?? 0),
                  width: Number(wall['width'] ?? 0.5),
                  color: String(wall['color'] ?? '#666666'),
                };
              }
              throw new Error('Invalid wall config');
            })
          : [],
      };
      
      console.log(`[${this.id}] ✅ Parsed game config successfully!`);
      console.log(`[${this.id}] 📊 Summary: ${this.gameConfig.platforms.length} platform(s), ${this.gameConfig.walls.length} wall(s)`);
      console.log(`[${this.id}] 📋 Full config:`, JSON.stringify(this.gameConfig, null, 2));
    } catch (error) {
      console.error(`[${this.id}] ❌ Failed to load game config:`, error);
      throw error; // Don't use fallback - fail explicitly so we know there's a problem
    }
  }

  /**
   * Create all platforms from game configuration
   */
  private createPlatforms(): void {
    if (!this.gameConfig) {
      console.error(`[${this.id}] ❌ Game config not loaded, cannot create platforms!`);
      return;
    }

    console.log(`[${this.id}] 🏗️ Creating platforms from config:`, this.gameConfig.platforms);

    // Create a platform mesh for each platform in the config
    for (const platform of this.gameConfig.platforms) {
      // Use EXACT values from config - no defaults, no fallbacks
      const width = platform.x_end - platform.x_start;
      const centerX = (platform.x_start + platform.x_end) / 2.0;
      const centerY = platform.y_top - platform.height / 2.0;

      console.log(
        `[${this.id}] 📐 Platform "${platform.id}": x_start=${platform.x_start}, x_end=${platform.x_end}, y_top=${platform.y_top}, height=${platform.height}, width=${width}, centerX=${centerX}, centerY=${centerY}, color=${platform.color}`
      );

      const platformMesh = MeshBuilder.CreateBox(
        `platform_${platform.id}`,
        {
          width: width, // Use calculated width from config
          height: platform.height, // Use height from config
          depth: 0.1, // Very thin depth for 2D look
        },
        this.scene
      );

      // Use EXACT position values from config
      platformMesh.position.x = centerX;
      platformMesh.position.y = centerY;
      platformMesh.position.z = 0;

      // Use EXACT color from config - no fallback
      const platformColorHex = platform.color;
      const platformColor = this.hexToColor3(platformColorHex);

      // Create material with configurable color and toon shading (one per platform)
      const platformMaterial = new StandardMaterial(`platformMaterial_${platform.id}`, this.scene);
      platformMaterial.diffuseColor = platformColor;
      platformMaterial.emissiveColor = platformColor; // Toon shading
      platformMaterial.specularColor = new Color3(0, 0, 0);
      platformMaterial.disableLighting = true;
      platformMesh.material = platformMaterial;

      this.platformMeshes.set(platform.id, platformMesh);
      console.log(
        `[${this.id}] ✅ Platform "${platform.id}" created: width=${width.toFixed(2)}, height=${platform.height.toFixed(2)}, position=(${centerX.toFixed(2)}, ${centerY.toFixed(2)}), color=${platformColorHex}`
      );
    }

    console.log(`[${this.id}] ✅ Created ${this.platformMeshes.size} platform(s) from config`);
  }

  /**
   * Create all walls from game configuration
   */
  private createWalls(): void {
    if (!this.gameConfig) {
      console.error(`[${this.id}] ❌ Game config not loaded, cannot create walls!`);
      return;
    }

    console.log(`[${this.id}] 🏗️ Creating walls from config:`, this.gameConfig.walls);

    // Create a wall mesh for each wall in the config
    for (const wall of this.gameConfig.walls) {
      // Use EXACT values from config - no defaults, no fallbacks
      const height = wall.y_top - wall.y_bottom;
      const centerX = wall.x + wall.width / 2.0;
      const centerY = (wall.y_bottom + wall.y_top) / 2.0;

      console.log(
        `[${this.id}] 📐 Wall "${wall.id}": x=${wall.x}, y_bottom=${wall.y_bottom}, y_top=${wall.y_top}, width=${wall.width}, height=${height}, centerX=${centerX}, centerY=${centerY}, color=${wall.color}`
      );

      const wallMesh = MeshBuilder.CreateBox(
        `wall_${wall.id}`,
        {
          width: wall.width, // Use width from config
          height: height, // Use calculated height from config
          depth: 0.1, // Very thin depth for 2D look
        },
        this.scene
      );

      // Use EXACT position values from config
      wallMesh.position.x = centerX;
      wallMesh.position.y = centerY;
      wallMesh.position.z = 0;

      // Use EXACT color from config - no fallback
      const wallColorHex = wall.color;
      const wallColor = this.hexToColor3(wallColorHex);

      // Create material with configurable color and toon shading (one per wall)
      const wallMaterial = new StandardMaterial(`wallMaterial_${wall.id}`, this.scene);
      wallMaterial.diffuseColor = wallColor;
      wallMaterial.emissiveColor = wallColor; // Toon shading
      wallMaterial.specularColor = new Color3(0, 0, 0);
      wallMaterial.disableLighting = true;
      wallMesh.material = wallMaterial;

      this.wallMeshes.set(wall.id, wallMesh);
      console.log(
        `[${this.id}] ✅ Wall "${wall.id}" created: width=${wall.width.toFixed(2)}, height=${height.toFixed(2)}, position=(${centerX.toFixed(2)}, ${centerY.toFixed(2)}), color=${wallColorHex}`
      );
    }

    console.log(`[${this.id}] ✅ Created ${this.wallMeshes.size} wall(s) from config`);
  }

  /**
   * Handle game state signal updates
   * This is called by DatastarUpdateManager when gameState signal is received
   */
  override onSignalUpdate(signalName: string, data: unknown): void {
    if (signalName === 'gameState' && Array.isArray(data)) {
      // Type-safe player array - data is already validated as array
      const players: Player[] = data;
      console.log(`[${this.id}] 📨 Received gameState signal with ${players.length} players`);
      if (players.length > 0) {
        console.log(
          `[${this.id}] 🎮 Players:`,
          players.map((p) => ({ id: p.id.substring(0, 8), x: p.x.toFixed(1), y: p.y.toFixed(1) }))
        );
      }
      // Update sprites based on the new game state
      this.updateSprites(players);
    }
  }

  /**
   * Update player sprites based on game state
   */
  private updateSprites(players: Player[]): void {
    console.log(
      `[${this.id}] 🎨 Updating sprites for ${players.length} players, current sprites: ${this.playerSprites.size}`
    );

    // Remove sprites for players that no longer exist
    const currentPlayerIds = new Set(players.map((p) => p.id));
    for (const [playerId, sprite] of this.playerSprites.entries()) {
      if (!currentPlayerIds.has(playerId)) {
        console.log(`[${this.id}] 🗑️ Removing sprite for player: ${playerId.substring(0, 8)}`);
        const manager = this.playerSpriteManagers.get(playerId);
        if (manager) {
          manager.dispose();
          this.playerSpriteManagers.delete(playerId);
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
          console.error(
            `[${this.id}] ❌ Failed to create texture for player: ${player.id.substring(0, 8)}`
          );
          continue;
        }

        // Create a new sprite manager for this player with their unique texture
        const playerSpriteManager = new SpriteManager(
          `playerSpriteManager-${player.id}`,
          playerTexture,
          1, // Only need 1 sprite per manager
          64,
          this.scene
        );

        // Store the manager for cleanup
        this.playerSpriteManagers.set(player.id, playerSpriteManager);

        // Create new player sprite with unique appearance
        playerSprite = new Sprite(`player-${player.id}`, playerSpriteManager);
        // Fixed size - don't vary with screen width
        playerSprite.width = 1.5; // Fixed width in world units
        playerSprite.height = 1.5; // Fixed height in world units
        this.playerSprites.set(player.id, playerSprite);

        const playerColor = this.getPlayerColor(player.id);
        console.log(
          `[${this.id}] ✅ Created unique sprite for player: ${player.id.substring(0, 8)} (color: ${playerColor})`
        );
      }

      // Update player position
      // Game coordinates are already in world units (no scaling needed)
      // 2D side-scroller: Y increases UP, ground is at y=-10
      playerSprite.position.x = player.x; // Direct mapping (already in world units)
      playerSprite.position.y = player.y; // Direct mapping (already in world units)
      playerSprite.position.z = 0;

      // Update facing direction (flip sprite horizontally)
      // Use invertU property to flip horizontally instead of negative width
      const fixedWidth = 1.5; // Fixed width in world units
      const fixedHeight = 1.5; // Fixed height in world units
      playerSprite.width = fixedWidth; // Always use positive width
      playerSprite.height = fixedHeight;
      playerSprite.invertU = !player.facing_right; // Flip horizontally when facing left
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
    for (const [playerId, sprite] of this.playerSprites.entries()) {
      const manager = this.playerSpriteManagers.get(playerId);
      if (manager) {
        manager.dispose();
      }
      sprite.dispose();
    }
    this.playerSprites.clear();
    this.playerSpriteManagers.clear();

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

    // Dispose all wall meshes
    for (const [id, mesh] of this.wallMeshes) {
      mesh.dispose();
      console.log(`[${this.id}] 🗑️ Disposed wall: ${id}`);
    }
    this.wallMeshes.clear();

    this.scene.dispose();
    this.engine.dispose();

    console.log(`[${this.id}] Disposed`);
  }
}
