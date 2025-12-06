import { Scene, SpriteManager, Sprite, Vector3 } from '@babylonjs/core';

export class SpriteAnimator {
  private sprite: Sprite;
  private manager: SpriteManager;
  private animationSpeed = 120; // milliseconds per frame
  private frameCount = 4;
  private lastUpdate = 0;

  constructor(
    scene: Scene,
    texturePath: string,
    position: Vector3,
    size: number = 1.5,
  ) {
    // Create sprite manager with texture atlas
    // For now, we'll use a placeholder - in production, use actual sprite sheet
    this.manager = new SpriteManager('playerManager', texturePath, 1024, 64, scene);
    this.sprite = new Sprite('player', this.manager);
    this.sprite.position = position;
    this.sprite.size = size;

    // Register animation loop
    scene.registerBeforeRender(() => {
      const now = performance.now();
      if (now - this.lastUpdate >= this.animationSpeed) {
        this.sprite.cellIndex = Math.floor(now / this.animationSpeed) % this.frameCount;
        this.lastUpdate = now;
      }
    });
  }

  public setPosition(position: Vector3): void {
    this.sprite.position = position;
  }

  public setFacingRight(facingRight: boolean): void {
    // Flip sprite horizontally
    this.sprite.width = facingRight ? Math.abs(this.sprite.width) : -Math.abs(this.sprite.width);
  }

  public dispose(): void {
    this.sprite.dispose();
    this.manager.dispose();
  }
}

