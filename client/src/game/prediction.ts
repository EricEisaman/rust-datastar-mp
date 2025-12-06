export interface PredictedState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export function createPredictedState(): PredictedState {
  return {
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
  };
}

export function reconcile(predicted: PredictedState, authoritative: PredictedState): void {
  predicted.x = authoritative.x;
  predicted.y = authoritative.y;
  predicted.velocityX = authoritative.velocityX;
  predicted.velocityY = authoritative.velocityY;
}
