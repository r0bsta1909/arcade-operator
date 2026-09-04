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

  sigmaMs(feel: GuestFeel): number {
    return timingSigmaMs(feel.skill, feel.frustration);
  }

  tick(world: GuestWorld, feel: GuestFeel): HumanInput | null {
    this.forgetStale(world.hazards);
    const next = world.hazards[0];
    if (!next) return null;

    let plan = this.plans.get(next.id);
    if (plan && Math.abs(plan.idealJumpFrame - next.idealJumpFrame) > 2) plan = undefined; // hazard re-activated after respawn
    if (!plan && next.framesUntilCritical <= C.guestReactionFrames) {
      const errorMs = this.rng.gaussian(C.biasMs, this.sigmaMs(feel));
      plan = {
        idealJumpFrame: next.idealJumpFrame,
        jumpFrame: Math.round(next.idealJumpFrame + errorMs / MS_PER_FRAME),
        errorMs,
        executed: false,
      };
      this.plans.set(next.id, plan);
    }
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
