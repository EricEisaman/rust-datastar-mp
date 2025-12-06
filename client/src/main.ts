/**
 * Main Entry Point
 * 
 * Pure TypeScript application - no Vue!
 * Uses Babylon.js for rendering and GUI.
 */

import { BabylonRenderer } from './game/babylon-renderer';
import { setupInput, initPlayer } from './game/input';
import { initializeDatastar } from './game/datastar-init';
import { datastarManager } from './game/datastar-manager';
import './datastar-boot';

// Initialize when DOM is ready
function init(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }

  // Set canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Initialize Datastar system
  initializeDatastar('/events');

  // Initialize player on server
  initPlayer();

  // Setup input handlers
  setupInput();

  // Create Babylon renderer (includes chat GUI)
  const renderer = new BabylonRenderer(canvas);
  
  // Register renderer with Datastar manager
  datastarManager.register(renderer);

  // Handle window resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  console.log('✅ Application initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
