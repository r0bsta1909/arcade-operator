// Read-only machine-view overlay: ghost jump curve and landing marker. GDD 2.2.
// Drawn on a second canvas above the CRT; fictionally invisible to the guest.
// The risk estimate comes from HumanAgent.jumpRisk and is handed in as plain
// data so this module never imports from src/human.
import { SessionConfig as C } from '../session/SessionConfig';
import type { WorldSnapshot } from './FakeArcadeGame';
import { jumpFeetY } from './Physics';

export type PredictedOutcome = 'safe' | 'close' | 'dead';

/**
 * Risk estimate for the next hazard (GDD 2.2, amended after STOPP 2). The
 * overlay no longer shows a fake single sample; it shows where the guest is
 * likely to take off (expected take-off +- one sigma) against the safe
 * take-off range, and the resulting death probability.
 */
export interface JumpPrediction {
  hazardId: string;
  /** Expected take-off front-x (ideal + bias). */
  expectedX: number;
  /** One sigma of the guest's timing error in px. */
  sigmaPx: number;
  /** Safe take-off range under the base window. */
  safeMin: number;
  safeMax: number;
  deathProbability: number;
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

  render(s: WorldSnapshot, p: JumpPrediction | null): void {
    const g = this.ctx;
    g.clearRect(0, 0, this.target.width, this.target.height);
    if (!p) return;

    const sx = this.target.width / C.crtWidth;
    const sy = this.target.height / C.crtHeight;
    g.save();
    g.scale(sx, sy);
    const toScreen = (worldX: number) => worldX - s.distance + C.hopperScreenX;
    const jump = C.jumpFrames * s.speed;
    const color = MARKER_COLOR[p.outcome];

    // Safe landing range (green bar on the ground): where the hopper lands if it takes off inside the safe range.
    g.fillStyle = 'rgba(61,220,132,0.55)';
    g.fillRect(toScreen(p.safeMin + jump) - C.hopperWidth, C.groundY - 2, p.safeMax - p.safeMin + C.hopperWidth, 2);

    // Likely landing band (expected +- sigma), colored by risk.
    const bandLeft = toScreen(p.expectedX - p.sigmaPx + jump) - C.hopperWidth;
    const bandWidth = 2 * p.sigmaPx + C.hopperWidth;
    g.fillStyle = color;
    g.globalAlpha = 0.35;
    g.fillRect(bandLeft, C.groundY - 6, bandWidth, 4);
    g.globalAlpha = 1;
    g.fillRect(toScreen(p.expectedX + jump) - C.hopperWidth, C.groundY - 6, C.hopperWidth, 4);

    // Ghost parabola from the expected take-off.
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.setLineDash([2, 2]);
    g.beginPath();
    for (let f = 0; f <= C.jumpFrames; f++) {
      const x = toScreen(p.expectedX + f * s.speed);
      const y = jumpFeetY(f) - C.hopperHeight / 2;
      if (f === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.setLineDash([]);
    g.restore();
  }
}
