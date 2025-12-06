import { Scene, MeshBuilder } from '@babylonjs/core';

type Tile = { x: number; y: number; solid: boolean };

export function buildCollisionMeshes(tiles: Tile[], scene: Scene): void {
  tiles
    .filter((tile) => tile.solid)
    .forEach((tile) => {
      const box = MeshBuilder.CreateBox(
        `tile-${tile.x}-${tile.y}`,
        { width: 1, height: 1, depth: 0.5 },
        scene
      );
      box.position.set(tile.x + 0.5, tile.y + 0.5, 0);
      box.checkCollisions = true;
    });
}
