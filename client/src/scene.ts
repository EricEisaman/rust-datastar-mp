import {
  Scene,
  Engine,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  Camera,
  Color4,
} from '@babylonjs/core';

export function createScene(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);

  scene.collisionsEnabled = true;

  // Fixed orthographic camera for 2D side-scrolling
  // Camera maintains fixed aspect ratio to prevent stretching
  // Camera view: ground at y=-10, platforms up to y=4, so we need to see from -10 to at least 6
  // We'll use a view from y=-10 (ground) to y=8 to give some headroom above platform 2
  const camera = new UniversalCamera('ortho-camera', new Vector3(0, -1, -10), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;

  // Calculate aspect ratio to maintain fixed world dimensions
  // This prevents stretching when window resizes
  const updateCameraBounds = () => {
    const aspect = canvas.width / canvas.height;
    const worldHeight = 18.0; // Fixed world height (from -10 to 8)
    const worldWidth = worldHeight * aspect;

    // Center the view horizontally, maintain fixed vertical bounds
    // Ground at y=-10 (bottom), platforms at y=2 and y=4, with headroom up to y=8
    camera.orthoLeft = -worldWidth / 2.0;
    camera.orthoRight = worldWidth / 2.0;
    camera.orthoTop = 8.0; // Top of view (above platform 2 at y=4)
    camera.orthoBottom = -10.0; // Bottom of view (ground level)
  };

  // Set initial bounds
  updateCameraBounds();

  // Update bounds when canvas resizes
  engine.onResizeObservable.add(() => {
    updateCameraBounds();
  });

  // NO attachControl - camera is completely fixed
  camera.checkCollisions = false; // No collisions needed for fixed camera

  // Enhanced lighting rig for better visibility
  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
  light.intensity = 1.0; // Increased intensity for better visibility

  // Set clear color to a light sky blue for better contrast with ground
  scene.clearColor = new Color4(0.5, 0.7, 0.9, 1.0);

  return scene;
}
