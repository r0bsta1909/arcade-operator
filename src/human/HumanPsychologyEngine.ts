// Frustration/boredom leaky integrators, tolerance, channel, jitter. Knows only events. GDD 2.3.
// M1 subset: death (serial, near-highscore), near-miss (+ delayed relief),
// safe-streak boredom, new segment, score milestone. Suspicion is M2 and stays 0.
import { MS_PER_FRAME } from '../core/Clock';
import { SessionConfig as C } from '../session/SessionConfig';
import type { EndReason, GameEvent } from '../session/events';
import type { Profile } from './Profiles';

export interface PsycheState {
  frustration: number;
  boredom: number;
  tolerance: number;
  suspicion: number;
  suspicionFloor: number;
  channel: { frustMax: number; boreMax: number };
  skill: number;
  /** Current timing sigma of the guest in ms (dashboard JITTER). */
  jitter: number;
}

/** GDD 3: sigma = sigmaBase * (1 - skill) * (1 + frustration * jitterGain). Shared with HumanAgent. */
export function timingSigmaMs(skill: number, frustration: number): number {
  return C.sigmaBaseMs * (1 - skill) * (1 + frustration * C.jitterGain);
}

export class HumanPsychologyEngine {
  readonly state: PsycheState;
  private deathFrames: number[] = [];
  private safeStreak = 0;
  /** Remaining frustration relief to pay out and frames left to do it. */
  private reliefRemaining = 0;
  private reliefFramesLeft = 0;
  private frame = 0;

  constructor(private readonly profile: Profile) {
    this.state = {
      frustration: 0,
      boredom: 0,
      tolerance: C.toleranceStart,
      suspicion: 0,
      suspicionFloor: 0,
      channel: { frustMax: C.channelFrustMax, boreMax: C.channelBoredMax },
      skill: profile.skillStart,
      jitter: timingSigmaMs(profile.skillStart, 0),
    };
  }

  /** Feed a game event. `frame` is the session frame for serial-death timing. */
  apply(event: GameEvent, frame: number): void {
    const p = C.psych;
    switch (event.type) {
      case 'Death': {
        this.deathFrames = this.deathFrames.filter((f) => frame - f <= p.serialDeathWindowMs / MS_PER_FRAME);
        this.deathFrames.push(frame);
        const n = this.deathFrames.length;
        const serial = 1 + (n - 1) * (n - 1) * p.serialDeathQuadGain;
        const nearHigh = event.score >= C.victoryScore * p.nearHighscoreRatio;
        const base = nearHigh ? p.deathNearHighscore : p.death;
        this.bump(base.frust * serial, base.bored);
        this.safeStreak = 0;
        this.reliefRemaining = 0;
        break;
      }
      case 'NearMiss':
        this.bump(p.nearMiss.frust, p.nearMiss.bored);
        this.reliefRemaining = p.nearMiss.reliefFrust;
        this.reliefFramesLeft = p.nearMiss.reliefMs / MS_PER_FRAME;
        this.safeStreak = 0;
        break;
      case 'HazardCleared':
        if (event.marginMs < C.nearMissMs) break; // counted as NearMiss
        this.safeStreak++;
        if (this.safeStreak >= p.streakThreshold) this.bump(0, p.streakBoredPerJump);
        break;
      case 'SegmentCleared':
        this.bump(p.newSegment.frust, p.newSegment.bored);
        this.state.skill = Math.min(C.skillMax, this.state.skill + this.profile.learnRate * C.skillPerSegment);
        break;
      case 'ScoreMilestone':
        this.bump(p.milestone.frust, p.milestone.bored);
        break;
      default:
        break;
    }
    this.state.jitter = timingSigmaMs(this.state.skill, this.state.frustration);
  }

  /** Advance one simulation frame. */
  tick(): void {
    this.frame++;
    const dt = MS_PER_FRAME / 1000;
    const s = this.state;
    s.frustration = clamp01(s.frustration - C.frustDecayPerSec * dt);
    s.boredom = clamp01(s.boredom - C.boredDecayPerSec * dt);

    if (this.reliefFramesLeft > 0 && this.reliefRemaining !== 0) {
      const step = this.reliefRemaining / this.reliefFramesLeft;
      s.frustration = clamp01(s.frustration + step);
      this.reliefRemaining -= step;
      this.reliefFramesLeft--;
    }

    const overFrust = s.frustration - s.channel.frustMax;
    const overBored = s.boredom - s.channel.boreMax;
    const excess = Math.max(overFrust, overBored);
    if (excess <= 0) {
      s.tolerance = Math.min(100, s.tolerance + C.toleranceGainPerSec * dt);
    } else {
      const headroom = 1 - Math.min(s.channel.frustMax, s.channel.boreMax);
      const k = Math.min(1, excess / headroom);
      const rate = C.toleranceLossMinPerSec + (C.toleranceLossMaxPerSec - C.toleranceLossMinPerSec) * k;
      s.tolerance = Math.max(0, s.tolerance - rate * dt);
    }
    s.jitter = timingSigmaMs(s.skill, s.frustration);
  }

  get inChannel(): boolean {
    return this.state.frustration < this.state.channel.frustMax && this.state.boredom < this.state.channel.boreMax;
  }

  /** Abort reason once tolerance is gone, by the axis with the larger overshoot. GDD 2.5. */
  abortReason(): EndReason | null {
    if (this.state.tolerance > 0) return null;
    return this.dominantAxis();
  }

  /** Which axis is "more over" its threshold right now. Used for the abort flavour after the last life too. */
  dominantAxis(): 'ABORT_FRUST' | 'ABORT_BORED' {
    const overFrust = this.state.frustration - this.state.channel.frustMax;
    const overBored = this.state.boredom - this.state.channel.boreMax;
    return overFrust >= overBored ? 'ABORT_FRUST' : 'ABORT_BORED';
  }

  private bump(frust: number, bored: number): void {
    const s = this.state;
    s.frustration = clamp01(s.frustration + (frust > 0 ? frust * this.profile.frustMult : frust));
    s.boredom = clamp01(s.boredom + (bored > 0 ? bored * this.profile.boredMult : bored));
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
