// Simulated guest: ideal jump frame + N(bias, sigma) error; jumpRisk() for the overlay. GDD 3, 5.3.
// Pure function of what the guest can see (upcoming hazards, own sprite state)
// and feel (frustration, skill). Never imports ManipulationLayer or the overlay.
import { MS_PER_FRAME } from '../core/Clock';
import type { Rng } from '../core/Rng';
import type { HazardView, HumanInput } from '../arcade/FakeArcadeGame';
import type { HopperMode } from '../arcade/Hopper';
import { msToPx } from '../arcade/Physics';
import type { JumpPrediction } from '../arcade/OverlayRenderer';
import { SessionConfig as C } from '../session/SessionConfig';
import { timingSigmaMs } from './HumanPsychologyEngine';
import type { Profile } from './Profiles';

/** What the guest sees. */
export interface GuestWorld {
  frame: number;
  hazards: readonly HazardView[];
  hopperMode: HopperMode;
}

/** What the guest feels (subset of PsycheState). */
export interface GuestFeel {
  frustration: number;
  skill: number;
}

interface JumpPlan {
  idealJumpFrame: number;
  jumpFrame: number;
  errorMs: number;
  executed: boolean;
}

export class HumanAgent {
  private plans = new Map<string, JumpPlan>();

  constructor(
    private readonly rng: Rng,
    readonly profile: Profile,
  ) {}

  /**
   * The guest's committed take-off front-x for a hazard, or null if he has not
   * decided yet. This is what the machine view shows (GDD 2.2, amended after
   * STOPP 2: the overlay shows the committed jump, not a probability).
   */
  plannedTakeoffX(hazard: HazardView): number | null {
    const plan = this.plans.get(hazard.id);
    if (!plan || Math.abs(plan.idealJumpFrame - hazard.idealJumpFrame) > 2) return null;
    return hazard.idealX + (plan.jumpFrame - plan.idealJumpFrame) * C.scrollPxPerFrame;
  }

  sigmaMs(feel: GuestFeel): number {
    return timingSigmaMs(feel.skill, feel.frustration);
  }

  tick(world: GuestWorld, feel: GuestFeel): HumanInput | null {
    this.forgetStale(world.hazards);
    // Commit a jump plan for every hazard inside the reaction horizon (in
    // order, so the PRNG draw sequence is stable), execute only the front one.
    for (const h of world.hazards) {
      const existing = this.plans.get(h.id);
      if (existing && Math.abs(existing.idealJumpFrame - h.idealJumpFrame) <= 2) continue;
      if (h.framesUntilCritical > C.guestReactionFrames) break;
      const errorMs = this.rng.gaussian(C.biasMs, this.sigmaMs(feel));
      this.plans.set(h.id, {
        idealJumpFrame: h.idealJumpFrame,
        jumpFrame: Math.round(h.idealJumpFrame + errorMs / MS_PER_FRAME),
        errorMs,
        executed: false,
      });
    }
    const next = world.hazards[0];
    if (!next) return null;
    const plan = this.plans.get(next.id);
    if (!plan || plan.executed || world.frame < plan.jumpFrame) return null;
    // Press the button. If the hopper is still airborne the press is lost and
    // the guest keeps pressing until grounded (a human would hammer the button).
    if (world.hopperMode === 'airborne') return null;
    plan.executed = true;
    return { jump: true };
  }

  /**
   * Machine-view risk estimate for the overlay (GDD 2.2, amended after
   * STOPP 2): no random sample, but the guest's error distribution against
   * the safe take-off range. Deterministic, never contradicts the outcome.
   */
  jumpRisk(hazard: HazardView, feel: GuestFeel): JumpPrediction {
    const speed = C.scrollPxPerFrame;
    const sigmaPx = msToPx(this.sigmaMs(feel), speed);
    const expectedX = hazard.idealX + msToPx(C.biasMs, speed);
    const { min, max } = hazard.baseRange;
    const pInside = normalCdf((max - expectedX) / sigmaPx) - normalCdf((min - expectedX) / sigmaPx);
    const deathProbability = Math.min(1, Math.max(0, 1 - pInside));
    const outcome = deathProbability >= C.overlayRiskDead ? 'dead' : deathProbability >= C.overlayRiskClose ? 'close' : 'safe';
    return { hazardId: hazard.id, expectedX, sigmaPx, safeMin: min, safeMax: max, deathProbability, outcome };
  }

  private forgetStale(hazards: readonly HazardView[]): void {
    if (this.plans.size < 8) return;
    const live = new Set(hazards.map((h) => h.id));
    for (const id of this.plans.keys()) if (!live.has(id)) this.plans.delete(id);
  }
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26), max error 1.5e-7. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? 1 - p : p;
}
