// Per-hazard mercy / window override, global window/speed; resolves mercy. GDD 2.2, 5.3.
// Knows nothing about the guest. The game asks `slackFor(hazardId)` and reports
// outcomes via `onHazardResolved`, which emits MercyApplied / MercyExpired.
//
// Timed-hit model (after STOPP 2): the SessionRunner judges a hit and either
// grants mercy with a judgement (perfect/good) or overrides the hazard's
// timing window (hardening). Nothing is armed in advance any more.
import type { EventBus } from '../core/EventBus';
import { MS_PER_FRAME } from '../core/Clock';
import { SessionConfig as C } from '../session/SessionConfig';
import { msToPx, slackForWindow, type Slack } from './Physics';

export type MercyJudgement = 'perfect' | 'good';

export interface ManipulationState {
  /** Hazards with mercy granted, by hit judgement. */
  mercy: Map<string, MercyJudgement>;
  /** Hazards with an overridden timing window in ms (hardening; may be negative = hitbox grows). */
  windowOverride: Map<string, number>;
  /** Global timing window in ms (GDD 2.2 WINDOW slider, fixed in M1). */
  windowMs: number;
  /** Scroll speed multiplier (GDD 2.2 SPEED slider, fixed 1.0 in M1). */
  speed: number;
}

export interface HazardOutcome {
  hazardId: string;
  survived: boolean;
  /** Signed ms outside the unmanipulated window (0 if the guest made it alone). */
  outsideBaseMs: number;
}

export class ManipulationLayer {
  readonly state: ManipulationState = {
    mercy: new Map(),
    windowOverride: new Map(),
    windowMs: C.windowMs,
    speed: C.scrollPxPerFrame,
  };

  constructor(private readonly bus: EventBus) {}

  /** Grant mercy for a hazard (timed hit up). Replaces any hardening. */
  grantMercy(hazardId: string, judgement: MercyJudgement): void {
    this.state.windowOverride.delete(hazardId);
    // A perfect hit is never downgraded by a later good one.
    if (this.state.mercy.get(hazardId) === 'perfect') return;
    this.state.mercy.set(hazardId, judgement);
  }

  /** Override the timing window for a hazard (hardening). Replaces any mercy. */
  setWindow(hazardId: string, windowMs: number): void {
    this.state.mercy.delete(hazardId);
    this.state.windowOverride.set(hazardId, windowMs);
  }

  isArmed(hazardId: string): boolean {
    return this.state.mercy.has(hazardId);
  }

  isHardened(hazardId: string): boolean {
    return this.state.windowOverride.has(hazardId);
  }

  /** What the guest believes: the plain global window. Used for ideal frames and predictions. */
  baseSlack(): Slack {
    return slackForWindow(this.state.windowMs, this.state.speed);
  }

  /** What actually applies to a hazard right now. */
  slackFor(hazardId: string): Slack {
    const override = this.state.windowOverride.get(hazardId);
    if (override !== undefined) return slackForWindow(override, this.state.speed);
    const base = this.baseSlack();
    if (!this.state.mercy.has(hazardId)) return base;
    return {
      latePx: base.latePx + msToPx(C.mercyCoyoteMs, this.state.speed),
      earlyPx: base.earlyPx + msToPx(C.mercyLandingMs, this.state.speed),
      coyoteFrames: C.mercyCoyoteMs / MS_PER_FRAME,
    };
  }

  /** Called by the game once a hazard is passed or killed the hopper. */
  onHazardResolved(outcome: HazardOutcome): void {
    const { hazardId } = outcome;
    const judgement = this.state.mercy.get(hazardId);
    if (judgement !== undefined) {
      this.state.mercy.delete(hazardId);
      if (outcome.survived && outcome.outsideBaseMs !== 0) {
        this.bus.emit({ type: 'MercyApplied', hazardId, deltaMs: outcome.outsideBaseMs, judgement });
      } else {
        this.bus.emit({ type: 'MercyExpired', hazardId });
      }
    }
    this.state.windowOverride.delete(hazardId);
  }

  /** Drop per-hazard state for hazards that no longer exist (e.g. after respawn re-activation). */
  forget(hazardId: string): void {
    this.state.mercy.delete(hazardId);
    this.state.windowOverride.delete(hazardId);
  }
}
