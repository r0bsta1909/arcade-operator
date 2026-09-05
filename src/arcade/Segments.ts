// Hand-built segment data (M1: two segments, craters + worms). GDD 3.
// No procedural randomness in M1-M3. Positions in meters from segment start
// (1 m = SessionConfig.pxPerMeter px). A segment is 20 s at 1.0x = 150 m.
//
// Rhythm (after STOPP 2, "Guitar Hero" round): one hazard every 6 m = 48 px
// = 0.8 s at 1.0x, 25 per segment. The jump covers 36 px, so the guest lands
// ~12 px before the next ideal take-off; the machine view already shows the
// next chip's verdict because the guest commits 120 frames ahead.
//
// Geometry notes (see Physics.ts): a crater of width 36 has exactly the timing
// window as tolerance; narrower craters are easier. Worms 8x8 are easy, 8x12
// and 12x12 tighten the window. Base tolerance at the 90 ms window:
//   c24 267 ms | c26 233 | c28 200 | c30 167 | c32 133 | w8x8 300 | w8x12 233 | w12x12 167
// 34-36 px craters (100 ms) were a coin flip for the casual guest and are not used.
import type { HazardType } from '../session/events';

export interface HazardDef {
  atMeter: number;
  type: HazardType;
  width: number;
  /** Height above ground; ignored for craters. */
  height?: number;
}

export interface SegmentDef {
  name: string;
  hazards: HazardDef[];
}

/** Meters between hazards. GDD 3 (amended after STOPP 2: 6 m = 0.8 s beat). */
export const HAZARD_SPACING_M = 6;
/** SessionConfig.pxPerMeter, kept literal here so this module stays data-only. */
const PX_PER_METER = 8;

/**
 * Compact hand-written pattern: tokens like `c24` (crater 24 px wide), `w8`
 * (worm 8x8), `w8t` (worm 8 wide, 12 tall), `w12t` (12x12). One token per
 * beat. The beat is the guest's *ideal take-off*, not the hazard's left edge:
 * a crater's ideal take-off is at x + (w - 36) / 2 + 4, a worm's about 10-12 px
 * before it (see Physics.takeoffRange), so the hazard x is offset accordingly
 * and the lane chips (positioned by ideal frame) arrive on a steady beat.
 * Without this, a worm right after a crater has its ideal take-off before the
 * hopper has even landed and is impossible for everyone.
 */
function beats(pattern: string): HazardDef[] {
  return pattern
    .trim()
    .split(/\s+/)
    .map((tok, i) => {
      const beatPx = HAZARD_SPACING_M * PX_PER_METER * (i + 1);
      const m = /^([cw])(\d+)(t?)$/.exec(tok);
      if (!m) throw new Error(`bad hazard token ${tok}`);
      const width = Number(m[2]);
      if (m[1] === 'c') return { atMeter: (beatPx - ((width - 36) / 2 + 4)) / PX_PER_METER, type: 'crater' as const, width };
      const tall = Boolean(m[3]);
      return { atMeter: (beatPx + (width >= 12 ? 12 : 10)) / PX_PER_METER, type: 'worm' as const, width, height: tall ? 12 : 8 };
    });
}

export const SEGMENTS: readonly SegmentDef[] = [
  {
    // Warm-up: wide craters and small worms, tightening towards the end.
    name: 'MARE TRANQUILLITATIS',
    hazards: beats(`
      c24 w8  c24 c24 w8  c26 c24 w8  c26 c26
      w8  c26 c24 w8  c28 c26 w8t c26 c28 w8
      c28 w8t c26 c28 w8t`),
  },
  {
    // Cruise: 26-30 px craters, tall worms, a wide worm now and then.
    name: 'OCEANUS PROCELLARUM',
    hazards: beats(`
      w8t c26 c28 w8t c28 c30 w8  c28 c30 w12t
      c26 w8  c28 c30 w8t c30 c28 w12t c28 c30
      w8t c30 c28 w12t c30`),
  },
];
