// All tunable constants with GDD references. No magic numbers elsewhere
// (CLAUDE.md rule 5). M1 subset only; M2 adds suspicion, overheat, sliders.
// Numbers marked "start value" are calibrated via `bun run sim` (GDD 7).
import { fnv1a } from '../core/Rng';
import { canonicalJson } from './SessionLog';

export const SessionConfig = {
  // ---------------------------------------------------------------- world
  /** Logic resolution of the CRT. GDD 3. */
  crtWidth: 160,
  crtHeight: 144,
  /** GDD 3: +10 points per meter. One meter = this many logic pixels. */
  pxPerMeter: 8,
  /** Base scroll speed in logic px per frame (1.0x). GDD 2.2: SPEED 0.7x-1.6x in M2. */
  scrollPxPerFrame: 1.0,
  /** Ground line (top of floor) in logic px. */
  groundY: 120,
  /** Hopper screen x (front edge stays fixed, world scrolls). */
  hopperScreenX: 32,
  hopperWidth: 8,
  hopperHeight: 10,
  /** GDD 3 / BRIEF step 3: fixed jump, 36 frames. */
  jumpFrames: 36,
  jumpHeightPx: 24,
  /** Frames the hopper falls inside a crater before Death is emitted. */
  craterFallFrames: 8,
  /** After a death the hopper respawns this many px before the killing hazard. */
  respawnLeadPx: 96,
  /** Hazards inside this distance after respawn are still active (no grace period). */
  segmentLengthPx: 1200, // GDD 3: 20 s per segment at 1.0x = 1200 frames = 1200 px

  // ---------------------------------------------------------------- score
  pointsPerMeter: 10, // GDD 3
  pointsPerEnemy: 100, // GDD 3: worm jumped over
  pointsPerSegment: 500, // GDD 3
  scoreMilestone: 1000, // GDD 2.3: reward event every 1000 points
  /** GDD 6 / M1: victory at 3000 (12000 in the full game, GDD 2.5). */
  victoryScore: 3000,
  lives: 3, // GDD 2.5
  /** CONTINUE countdown in ms after the last life. GDD 2.2 (Free Credit is M2). */
  continueMs: 9000,

  // ------------------------------------------------------------ timing window
  /** GDD 2.2: WINDOW slider 40-160 ms, default 90 ms. Applied as hitbox slack (half each side). */
  windowMs: 90,
  /** GDD 2.2: hardened chip narrows the window to 40 ms. */
  hardenedWindowMs: 40,
  /** GDD 2.2: mercy adds 120 ms coyote time (late side). */
  mercyCoyoteMs: 120,
  /** GDD 2.2: mercy enlarges the landing area (early side). Start value. */
  mercyLandingMs: 80,
  /** GDD 2.3: near-miss = survived with less than 60 ms margin to death. */
  nearMissMs: 60,
  /** GDD 2.2 / 2.5: death freeze = retroactive mercy window. */
  deathFreezeMs: 400,
  /** GDD 2.2: overlay ghost appears 300 ms before the critical frame. */
  overlayLeadMs: 300,
  /** Hazard lane shows chips this many frames ahead (GDD 2.2: 1-2 s). */
  laneLookaheadFrames: 120,

  // ------------------------------------------------------------------ heat
  // GDD 2.1 / 2.2. M1: number only, no overheat.
  heatArm: 20,
  heatMercyApplied: 10,
  heatHarden: 15,
  heatRetroMercy: 35,
  heatDecayPerSec: 8,

  // ----------------------------------------------------------------- guest
  /** Base timing error sigma in ms at skill 0. GDD 3: sigma = f(1 - skill, frustration). Start value. */
  sigmaBaseMs: 110,
  /** Extra sigma factor per unit frustration (tilt spiral). Start value. */
  jitterGain: 1.5,
  /** Systematic bias in ms (positive = jumps late). Casual guests tend to jump late. Start value. */
  biasMs: 12,
  /** GDD 3: skill += learnRate * 0.02 per segment. */
  skillPerSegment: 0.02,
  /** Frames of lookahead the guest uses to commit to a jump decision. */
  guestReactionFrames: 20,

  // ------------------------------------------------------------- psychology
  // GDD 2.3, start values for the headless sim.
  frustDecayPerSec: 0.04,
  boredDecayPerSec: 0.03,
  channelFrustMax: 0.45,
  channelBoredMax: 0.45,
  /** GDD 2.1: tolerance +2/s inside the channel. */
  toleranceGainPerSec: 2,
  /** GDD 2.1: -4 .. -12 per second outside, proportional to overshoot of the higher axis. */
  toleranceLossMinPerSec: 4,
  toleranceLossMaxPerSec: 12,
  toleranceStart: 100,
  /** GDD 2.3 event table. */
  psych: {
    death: { frust: 0.18, bored: -0.05 },
    deathNearHighscore: { frust: 0.3, bored: -0.05 },
    /** Highscore proximity that counts as "almost made it". GDD 2.3: >= 90 %. */
    nearHighscoreRatio: 0.9,
    /** Serial deaths: n-th death within the window is multiplied by n^2 / 4 (3rd death in 20 s => +0.45 base). */
    serialDeathWindowMs: 20000,
    nearMiss: { frust: 0.08, bored: -0.12, reliefFrust: -0.15, reliefMs: 3000 },
    mercyNoticed: { frust: 0.1, bored: 0.05 },
    /** Boredom per safe jump once the streak reaches the threshold. */
    streakThreshold: 5,
    streakBoredPerJump: 0.06,
    newSegment: { frust: 0, bored: -0.1 },
    milestone: { frust: -0.05, bored: -0.12 },
  },
  /** PsycheSample is logged every N frames for the debrief curves. */
  psycheSampleEveryFrames: 30,
} as const;

export type SessionConfigType = typeof SessionConfig;

/** Stable hash of the constants; written into every log header so balancing changes are traceable. */
export function configHash(config: SessionConfigType = SessionConfig): string {
  return fnv1a(canonicalJson(config)).toString(16).padStart(8, '0');
}
