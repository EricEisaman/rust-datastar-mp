import { Scene, Mesh, Vector3, KeyboardEventTypes } from '@babylonjs/core';

export class PlayerController {
  private inputMap: Record<string, boolean> = {};

  private speed = 3.5;
  
  private player: Mesh;

  constructor(
    player: Mesh,
    scene: Scene
  ) {
    this.player = player;
    this.player.checkCollisions = true;
    this.player.ellipsoid = new Vector3(0.5, 1, 0.5);

    scene.onKeyboardObservable.add((kbInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          this.inputMap[kbInfo.event.key] = true;
          break;
        case KeyboardEventTypes.KEYUP:
          this.inputMap[kbInfo.event.key] = false;
          break;
      }
    });
  }

  public update(): void {
    const moveVector = Vector3.Zero();

    if (this.inputMap['ArrowLeft'] || this.inputMap['a'] || this.inputMap['A']) {
      moveVector.x = -1;
    }

    if (this.inputMap['ArrowRight'] || this.inputMap['d'] || this.inputMap['D']) {
      moveVector.x = 1;
    }

    // Note: Physics-based movement would require Babylon.js physics plugin
    // For now, we rely on server-side physics and just update position
    // Jump handling is done server-side via commands
    if (moveVector.length() > 0) {
      moveVector.normalize().scaleInPlace(this.speed);
      // Position updates come from server state, not local physics
    }
  }
}
