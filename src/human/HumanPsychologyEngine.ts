// Frustration/boredom leaky integrators, tolerance, channel, jitter. Knows only events. GDD 2.3.
// M1 subset: death (serial, near-highscore), near-miss (+ delayed relief),
// safe-streak boredom, new segment, score milestone. Suspicion (GDD 2.4) was
// pulled into M1 after STOPP 2: mercy deltas, retro timing, double mercy,
// floor ratchet; honest deaths never lower it.
import { MS_PER_FRAME } from '../core/Clock';
import { SessionConfig as C } from '../session/SessionConfig';
import type { EndReason, GameEvent } from '../session/events';

/** Only Suspicion events leave the engine; the runner forwards them to the bus. */
export type SuspicionEvent = Extract<GameEvent, { type: 'Suspicion' }>;
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
  private lastMercyFrame = -Infinity;
  /** Latched when suspicion reaches max, so the same-frame decay cannot hide the abort. */
  private suspicionMaxed = false;

  constructor(
    private readonly profile: Profile,
    private readonly emit: (event: SuspicionEvent) => void = () => {},
  ) {
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
        break; // physical event; whether the guest *feels* it is decided on HazardCleared below
      case 'HazardCleared': {
        // A near-miss is felt relative to the guest's own precision: a 30 ms veteran is not thrilled by a 50 ms margin.
        const felt = event.marginMs < Math.min(C.nearMissMs, C.nearMissSigmaFactor * this.state.jitter);
        if (felt) {
          this.bump(p.nearMiss.frust, p.nearMiss.bored);
          // GDD 2.3: above 50 suspicion the relief is halved ("I could not have died anyway").
          this.reliefRemaining = this.state.suspicion > C.suspicion.halvesReliefAbove ? p.nearMiss.reliefFrust / 2 : p.nearMiss.reliefFrust;
          this.reliefFramesLeft = p.nearMiss.reliefMs / MS_PER_FRAME;
          this.safeStreak = 0;
          break;
        }
        this.safeStreak++;
        if (this.safeStreak >= p.streakThreshold) this.bump(0, p.streakBoredPerJump);
        break;
      }
      case 'SegmentCleared':
        this.bump(p.newSegment.frust, p.newSegment.bored);
        this.state.skill = Math.min(C.skillMax, this.state.skill + this.profile.learnRate * C.skillPerSegment);
        break;
      case 'ScoreMilestone':
        this.bump(p.milestone.frust, p.milestone.bored);
        break;
      case 'MercyApplied': {
        const s = C.suspicion;
        const d = Math.abs(event.deltaMs);
        const inc = d > s.mercyHighDeltaMs ? s.mercyHigh : d > s.mercyMidDeltaMs ? s.mercyMid : s.mercyLow;
        this.suspect(inc, 'mercy');
        this.doubleMercy(frame);
        break;
      }
      case 'RetroMercy': {
        const s = C.suspicion;
        this.suspect(event.msAfterDeath <= s.retroEarlyMs ? s.retroEarly : s.retroLate, 'retro');
        this.doubleMercy(frame);
        break;
      }
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

    // GDD 2.4: decays 1/s but never below the session floor.
    s.suspicion = Math.max(s.suspicionFloor, s.suspicion - C.suspicion.decayPerSec * dt);

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

  /** Abort reason: suspicion at max (GDD 2.1) or tolerance gone, by the axis with the larger overshoot. GDD 2.5. */
  abortReason(): EndReason | null {
    if (this.suspicionMaxed) return 'ABORT_SUSPECT';
    if (this.state.tolerance > 0) return null;
    return this.dominantAxis();
  }

  /** GDD 2.4: raise suspicion (scaled by profile sensitivity) and ratchet the floor. */
  private suspect(amount: number, cause: 'mercy' | 'retro' | 'double'): void {
    const s = this.state;
    const inc = amount * this.profile.suspicionSensitivity;
    s.suspicion = Math.min(C.suspicion.max, s.suspicion + inc);
    if (s.suspicion >= C.suspicion.max) this.suspicionMaxed = true;
    s.suspicionFloor = Math.min(C.suspicion.max, s.suspicionFloor + inc * C.suspicion.floorRatio);
    if (inc >= C.suspicion.noticedAt) this.bump(C.psych.mercyNoticed.frust, C.psych.mercyNoticed.bored);
    this.emit({ type: 'Suspicion', value: round1(s.suspicion), floor: round1(s.suspicionFloor), delta: round1(inc), cause });
  }

  private doubleMercy(frame: number): void {
    if (frame - this.lastMercyFrame <= C.suspicion.doubleWindowMs / MS_PER_FRAME) this.suspect(C.suspicion.doubleExtra, 'double');
    this.lastMercyFrame = frame;
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
