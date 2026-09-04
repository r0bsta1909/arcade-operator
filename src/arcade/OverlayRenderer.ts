// Read-only machine-view overlay: ghost jump curve and landing marker. GDD 2.2.
// Drawn on a second canvas above the CRT; fictionally invisible to the guest.
// The prediction comes from HumanAgent.predictedJump (separate PRNG stream) and
// is handed in as plain data so this module never imports from src/human.
import { SessionConfig as C } from '../session/SessionConfig';
import type { WorldSnapshot } from './FakeArcadeGame';
import { jumpFeetY } from './Physics';

export type PredictedOutcome = 'safe' | 'close' | 'dead';

export interface JumpPrediction {
  hazardId: string;
  /** Predicted world front-x at take-off. */
  takeoffX: number;
  outcome: PredictedOutcome;
}

const MARKER_COLOR: Record<PredictedOutcome, string> = {
  safe: '#3ddc84',
  close: '#ffb300',
  dead: '#ff3b3b',
};

export class OverlayRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly target: HTMLCanvasElement) {
    const ctx = this.target.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
  }

  render(s: WorldSnapshot, prediction: JumpPrediction | null): void {
    const g = this.ctx;
    g.clearRect(0, 0, this.target.width, this.target.height);
    if (!prediction) return;

    const sx = this.target.width / C.crtWidth;
    const sy = this.target.height / C.crtHeight;
    g.save();
    g.scale(sx, sy);
    const toScreen = (worldX: number) => worldX - s.distance + C.hopperScreenX;

    g.strokeStyle = 'rgba(0,229,255,0.7)';
    g.lineWidth = 1;
    g.setLineDash([2, 2]);
    g.beginPath();
    for (let f = 0; f <= C.jumpFrames; f++) {
      const x = toScreen(prediction.takeoffX + f * s.speed);
      const y = jumpFeetY(f) - C.hopperHeight / 2;
      if (f === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.setLineDash([]);

    const landX = toScreen(prediction.takeoffX + C.jumpFrames * s.speed);
    g.fillStyle = MARKER_COLOR[prediction.outcome];
    g.fillRect(landX - C.hopperWidth, C.groundY - 2, C.hopperWidth, 3);
    g.restore();
  }
}
