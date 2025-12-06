import {
  Scene,
  Engine,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  Camera,
  Color4,
} from '@babylonjs/core';

export function createScene(engine: Engine, _canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);

  scene.collisionsEnabled = true;

  // Fixed orthographic camera for 2D side-scrolling
  // Camera is completely fixed - no movement or controls
  // Camera view: -10 to 10 world units on both axes
  // Camera positioned to view area with ground at bottom
  const camera = new UniversalCamera('ortho-camera', new Vector3(0, 0, -10), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  // Fixed view: -10 to 10 world units (covers -1000 to 1000 pixels with 0.01 scale)
  camera.orthoLeft = -10;
  camera.orthoRight = 10;
  camera.orthoTop = 10;
  camera.orthoBottom = -10;
  // NO attachControl - camera is completely fixed
  camera.checkCollisions = false; // No collisions needed for fixed camera

  // Enhanced lighting rig for better visibility
  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
  light.intensity = 1.0; // Increased intensity for better visibility

  // Set clear color to a light sky blue for better contrast with ground
  scene.clearColor = new Color4(0.5, 0.7, 0.9, 1.0);

  return scene;
}

