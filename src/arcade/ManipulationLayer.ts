// Per-hazard armed/hardened state, global window/speed; resolves mercy. GDD 2.2, 5.3.
// Knows nothing about the guest. The game asks `slackFor(hazardId)` and reports
// outcomes via `onHazardResolved`, which emits MercyApplied / MercyExpired.
import type { EventBus } from '../core/EventBus';
import { SessionConfig as C } from '../session/SessionConfig';
import { MS_PER_FRAME } from '../core/Clock';
import { msToPx, slackForWindow, type Slack } from './Physics';

export interface ManipulationState {
  armed: Set<string>;
  hardened: Set<string>;
  /** Set by the operator during DEATH_FREEZE; consumed by the session runner. */
  retroMercyRequested: boolean;
  /** Global timing window in ms (GDD 2.2 WINDOW slider, fixed in M1). */
  windowMs: number;
  /** Scroll speed multiplier (GDD 2.2 SPEED slider, fixed 1.0 in M1). */
  speed: number;
  /** Bullet-time factor (M2). */
  timeScale: number;
}

export interface HazardOutcome {
  hazardId: string;
  survived: boolean;
  /** Signed ms outside the unmanipulated window (0 if the guest made it alone). */
  outsideBaseMs: number;
}

export class ManipulationLayer {
  readonly state: ManipulationState = {
    armed: new Set(),
    hardened: new Set(),
    retroMercyRequested: false,
    windowMs: C.windowMs,
    speed: C.scrollPxPerFrame,
    timeScale: 1,
  };

  constructor(private readonly bus: EventBus) {}

  arm(hazardId: string): void {
    this.state.hardened.delete(hazardId);
    this.state.armed.add(hazardId);
  }

  /** Veto on an armed chip disarms it; otherwise hardens the chip. Returns what happened. */
  veto(hazardId: string): 'disarmed' | 'hardened' {
    if (this.state.armed.delete(hazardId)) return 'disarmed';
    this.state.hardened.add(hazardId);
    return 'hardened';
  }

  isArmed(hazardId: string): boolean {
    return this.state.armed.has(hazardId);
  }

  isHardened(hazardId: string): boolean {
    return this.state.hardened.has(hazardId);
  }

  /** What the guest believes: the plain global window. Used for ideal frames and predictions. */
  baseSlack(): Slack {
    return slackForWindow(this.state.windowMs, this.state.speed);
  }

  /** What actually applies to a hazard right now. */
  slackFor(hazardId: string): Slack {
    if (this.state.hardened.has(hazardId)) return slackForWindow(C.hardenedWindowMs, this.state.speed);
    const base = this.baseSlack();
    if (!this.state.armed.has(hazardId)) return base;
    return {
      latePx: base.latePx + msToPx(C.mercyCoyoteMs, this.state.speed),
      earlyPx: base.earlyPx + msToPx(C.mercyLandingMs, this.state.speed),
      coyoteFrames: C.mercyCoyoteMs / MS_PER_FRAME,
    };
  }

  /** Called by the game once a hazard is passed or killed the hopper. */
  onHazardResolved(outcome: HazardOutcome): void {
    const { hazardId } = outcome;
    if (this.state.armed.delete(hazardId)) {
      if (outcome.survived && outcome.outsideBaseMs !== 0) {
        this.bus.emit({ type: 'MercyApplied', hazardId, deltaMs: outcome.outsideBaseMs });
      } else {
        this.bus.emit({ type: 'MercyExpired', hazardId });
      }
    }
    this.state.hardened.delete(hazardId);
  }

  /** Drop per-hazard state for hazards that no longer exist (e.g. after respawn re-activation). */
  forget(hazardId: string): void {
    this.state.armed.delete(hazardId);
    this.state.hardened.delete(hazardId);
  }
}
