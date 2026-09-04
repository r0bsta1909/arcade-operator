// Read-only renderer: 160x144 logic pixels, 4 colors, nearest-neighbour. GDD 3, 5.3.
// M1: rectangles only. No scanlines, no curvature (M3). Never mutates simulation state.
import { SessionConfig as C } from '../session/SessionConfig';
import type { WorldSnapshot } from './FakeArcadeGame';

export const PALETTE = {
  black: '#000000',
  cyan: '#00e5ff',
  magenta: '#ff2ea6',
  white: '#f4f4f4',
} as const;

export interface CrtFrameOptions {
  /** 0..1 progress of the death freeze rolling bar; undefined = not frozen. */
  freezeProgress?: number;
  /** Centered message (e.g. "PLAYER 1 READY"). */
  message?: string;
}

export class CrtRenderer {
  private readonly logic: HTMLCanvasElement;
  private readonly lctx: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly target: HTMLCanvasElement) {
    this.logic = document.createElement('canvas');
    this.logic.width = C.crtWidth;
    this.logic.height = C.crtHeight;
    this.lctx = must(this.logic.getContext('2d'));
    this.ctx = must(this.target.getContext('2d'));
    this.ctx.imageSmoothingEnabled = false;
  }

  render(s: WorldSnapshot, opts: CrtFrameOptions = {}): void {
    const g = this.lctx;
    const toScreen = (worldX: number) => Math.round(worldX - s.distance + C.hopperScreenX);

    g.fillStyle = PALETTE.black;
    g.fillRect(0, 0, C.crtWidth, C.crtHeight);

    // Stars: deterministic from world position, purely decorative.
    g.fillStyle = PALETTE.white;
    for (let i = 0; i < 24; i++) {
      const wx = i * 53 + ((i * 17) % 11) * 7;
      const period = C.crtWidth * 4;
      const sx = ((((wx - s.distance * 0.25) % period) + period) % period) - 16;
      if (sx >= 0 && sx < C.crtWidth) g.fillRect(Math.round(sx), 12 + ((i * 29) % 70), 1, 1);
    }

    // Ground
    g.fillStyle = PALETTE.white;
    g.fillRect(0, C.groundY, C.crtWidth, 2);
    g.fillStyle = PALETTE.magenta;
    g.fillRect(0, C.groundY + 2, C.crtWidth, C.crtHeight - C.groundY - 2);

    // Obstacles
    for (const o of s.obstacles) {
      const sx = toScreen(o.x);
      if (o.type === 'crater') {
        g.fillStyle = PALETTE.black;
        g.fillRect(sx, C.groundY, o.width, C.crtHeight - C.groundY);
      } else {
        g.fillStyle = PALETTE.magenta;
        g.fillRect(sx, C.groundY - o.height, o.width, o.height);
        g.fillStyle = PALETTE.white;
        g.fillRect(sx + 1, C.groundY - o.height + 2, 2, 2); // eye
      }
    }

    // Hopper
    g.fillStyle = PALETTE.cyan;
    g.fillRect(C.hopperScreenX - C.hopperWidth, Math.round(s.hopperFeetY) - C.hopperHeight, C.hopperWidth, C.hopperHeight);

    // HUD
    g.fillStyle = PALETTE.white;
    g.font = '7px monospace';
    g.textBaseline = 'top';
    g.fillText(`HI ${pad(s.victoryScore)}`, 2, 2);
    g.fillText(`1UP ${pad(s.score)}`, 64, 2);
    g.fillStyle = PALETTE.cyan;
    for (let i = 0; i < s.lives; i++) g.fillRect(C.crtWidth - 6 - i * 6, 3, 4, 4);

    if (opts.freezeProgress !== undefined) {
      const y = Math.round(opts.freezeProgress * C.crtHeight);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, C.crtWidth, C.crtHeight);
      g.fillStyle = PALETTE.white;
      g.fillRect(0, y, C.crtWidth, 3);
    }

    if (opts.message) {
      g.fillStyle = PALETTE.white;
      g.font = '8px monospace';
      g.textAlign = 'center';
      g.fillText(opts.message, C.crtWidth / 2, 60);
      g.textAlign = 'left';
    }

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.target.width, this.target.height);
    this.ctx.drawImage(this.logic, 0, 0, this.target.width, this.target.height);
  }
}

function pad(n: number): string {
  return String(n).padStart(5, '0');
}

function must<T>(v: T | null): T {
  if (v === null) throw new Error('2D context unavailable');
  return v;
}
