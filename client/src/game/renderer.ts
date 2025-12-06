import { gameState } from './player-state';

export function render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const groundY = canvas.height * 0.8;
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  // Render all players
  const players = gameState.value.gameState;
  
  // Debug: Log player count occasionally
  if (players.length > 0 && Math.random() < 0.01) {
    console.log('🎮 Rendering', players.length, 'players');
  }
  
  // Always log if we have players (for debugging)
  if (players.length > 0) {
    // Only log once per second to avoid spam
    const now = Date.now();
    if (!(window as any).lastPlayerLog || now - (window as any).lastPlayerLog > 1000) {
      console.log('🎮 Players in render:', players.map(p => ({ id: p.id.substring(0, 8), x: p.x.toFixed(1), y: p.y.toFixed(1) })));
      (window as any).lastPlayerLog = now;
    }
  }
  
  for (const player of players) {
    ctx.fillStyle = '#4a9eff';
    const playerX = player.x;
    const playerY = player.y;
    const playerWidth = 40;
    const playerHeight = 40;
    
    // Draw player rectangle (y=0 is at ground level, positive y is up)
    ctx.fillRect(
      playerX,
      groundY - playerY - playerHeight,
      playerWidth,
      playerHeight
    );
    
    // Draw facing direction indicator
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      playerX + (player.facing_right ? playerWidth - 10 : 0),
      groundY - playerY - playerHeight / 2,
      10,
      5
    );
    
    // Draw player ID above player
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText(
      player.id.substring(0, 8),
      playerX,
      groundY - playerY - playerHeight - 5
    );
  }
}
