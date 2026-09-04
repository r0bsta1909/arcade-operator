// Pure geometry shared by FakeArcadeGame (live collision), HumanAgent (ideal
// jump frame) and OverlayRenderer (ghost prediction). GDD 3, 2.2.
//
// Collision is AABB. The timing window (GDD 2.2) is applied as horizontal
// hitbox slack: the hazard's effective hitbox is shrunk by `latePx` on the
// side the hopper reaches first and by `earlyPx` on the far side. Coyote time
// lets the hopper jump for a few frames after its center is already over a
// crater. All of this is expressed as one `Slack` so mercy, hardening and the
// global window are the same kind of thing.
import { MS_PER_FRAME } from '../core/Clock';
import { SessionConfig as C } from '../session/SessionConfig';
import type { Obstacle } from './Obstacle';

export interface Slack {
  /** Slack on the near side (late jump). Positive = more forgiving. */
  latePx: number;
  /** Slack on the far side (early jump / short landing). */
  earlyPx: number;
  /** Frames the hopper may still jump after starting to fall into a crater. */
  coyoteFrames: number;
}

export const HOPPER_JUMP_DISTANCE_PX = C.jumpFrames * C.scrollPxPerFrame;

export function msToPx(ms: number, speed: number): number {
  return (ms / MS_PER_FRAME) * speed;
}

export function pxToMs(px: number, speed: number): number {
  return (px / speed) * MS_PER_FRAME;
}

/** Symmetric slack for a timing window (total width in ms). */
export function slackForWindow(windowMs: number, speed: number): Slack {
  const half = msToPx(windowMs / 2, speed);
  return { latePx: half, earlyPx: half, coyoteFrames: 0 };
}

/** Feet y of the hopper at jump frame f (0..jumpFrames). Parabola, fixed height. */
export function jumpFeetY(jumpFrame: number): number {
  const t = Math.min(Math.max(jumpFrame / C.jumpFrames, 0), 1);
  return C.groundY - C.jumpHeightPx * 4 * t * (1 - t);
}

/** Effective (slack-shrunk) horizontal extent of a hazard. */
export function effectiveSpan(o: Obstacle, s: Slack): { left: number; right: number } {
  return { left: o.x + s.latePx, right: o.x + o.width - s.earlyPx };
}

/** Hopper center (used for crater support) given its front edge x. */
export function hopperCenter(front: number): number {
  return front - C.hopperWidth / 2;
}

export function overGap(front: number, crater: Obstacle, s: Slack): boolean {
  const { left, right } = effectiveSpan(crater, s);
  const cx = hopperCenter(front);
  return cx > left && cx < right;
}

export function hitsWorm(front: number, feetY: number, worm: Obstacle, s: Slack): boolean {
  const { left, right } = effectiveSpan(worm, s);
  const horizontal = front > left && front - C.hopperWidth < right;
  const vertical = feetY > C.groundY - worm.height;
  return horizontal && vertical;
}

/**
 * Simulates one committed jump taking off with the hopper front edge at `front`.
 * Returns true if the hopper survives the hazard. Mirrors FakeArcadeGame.tick.
 */
export function survivesJumpFrom(front: number, o: Obstacle, s: Slack, speed: number): boolean {
  let d = front;
  if (o.type === 'crater') {
    if (overGap(d, o, s)) {
      const { left } = effectiveSpan(o, s);
      const fallingFrames = (hopperCenter(d) - left) / speed;
      if (fallingFrames > s.coyoteFrames) return false; // fell before jumping
    }
  } else if (hitsWorm(d, C.groundY, o, s)) {
    return false; // walked into it before jumping
  }
  for (let f = 1; f <= C.jumpFrames; f++) {
    d += speed;
    const y = jumpFeetY(f);
    if (o.type !== 'crater' && hitsWorm(d, y, o, s)) return false;
  }
  // Landed. Walk until clear of the hazard (no second jump in this model).
  const clearX = o.x + o.width + C.hopperWidth + 1;
  while (d < clearX) {
    if (o.type === 'crater') {
      if (overGap(d, o, s)) return false;
    } else if (hitsWorm(d, C.groundY, o, s)) {
      return false;
    }
    d += speed;
  }
  return true;
}

export interface TakeoffRange {
  /** Earliest safe take-off front x. */
  min: number;
  /** Latest safe take-off front x. */
  max: number;
  /** Center of the range; the guest aims for this. */
  ideal: number;
  widthMs: number;
}

/**
 * Brute-force scan of safe take-off positions (1 px resolution) for a hazard
 * under a given slack. Returns the largest contiguous safe run, or null if the
 * hazard is impossible (a segment design error; tests assert against it).
 */
export function takeoffRange(o: Obstacle, s: Slack, speed: number): TakeoffRange | null {
  const from = o.x - HOPPER_JUMP_DISTANCE_PX - 24;
  const to = o.x + o.width + C.hopperWidth;
  let bestMin = 0;
  let bestMax = -1;
  let runMin = 0;
  let inRun = false;
  for (let x = from; x <= to; x += 1) {
    const ok = survivesJumpFrom(x, o, s, speed);
    if (ok && !inRun) {
      inRun = true;
      runMin = x;
    }
    if ((!ok || x === to) && inRun) {
      const runMax = ok ? x : x - 1;
      if (runMax - runMin > bestMax - bestMin) {
        bestMin = runMin;
        bestMax = runMax;
      }
      inRun = false;
    }
  }
  if (bestMax < bestMin) return null;
  return { min: bestMin, max: bestMax, ideal: (bestMin + bestMax) / 2, widthMs: pxToMs(bestMax - bestMin, speed) };
}

/** Signed distance (ms, positive = late) of a take-off x from a range's ideal. */
export function deltaMs(front: number, range: TakeoffRange, speed: number): number {
  return round1(pxToMs(front - range.ideal, speed));
}

/** How far outside a range a take-off is, in ms (0 if inside). Positive = late. */
export function outsideMs(front: number, range: TakeoffRange, speed: number): number {
  if (front < range.min) return round1(pxToMs(front - range.min, speed));
  if (front > range.max) return round1(pxToMs(front - range.max, speed));
  return 0;
}

/** Margin to the nearest edge of a range in ms (negative if outside). */
export function marginMs(front: number, range: TakeoffRange, speed: number): number {
  return round1(pxToMs(Math.min(front - range.min, range.max - front), speed));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
