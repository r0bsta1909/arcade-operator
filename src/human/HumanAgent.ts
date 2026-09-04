// Simulated guest: ideal jump frame + N(bias, sigma) error; predictedJump on own PRNG stream. GDD 3, 5.3.
// Pure function of what the guest can see (upcoming hazards, own sprite state)
// and feel (frustration, skill). Never imports ManipulationLayer or the overlay.
import { MS_PER_FRAME } from '../core/Clock';
import type { Rng } from '../core/Rng';
import type { HazardView, HumanInput } from '../arcade/FakeArcadeGame';
import type { HopperMode } from '../arcade/Hopper';
import { msToPx, marginMs, outsideMs } from '../arcade/Physics';
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
  private predictions = new Map<string, { idealJumpFrame: number; prediction: JumpPrediction }>();

  constructor(
    private readonly rng: Rng,
    private readonly predictRng: Rng,
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
   * Machine-view estimate for the overlay: same error model, separate PRNG
   * stream, so the ghost is a guess about the guest, not the truth. Stable per
   * hazard until the hazard's ideal frame changes.
   */
  predictedJump(hazard: HazardView, feel: GuestFeel): JumpPrediction {
    const cached = this.predictions.get(hazard.id);
    if (cached && Math.abs(cached.idealJumpFrame - hazard.idealJumpFrame) <= 2) return cached.prediction;
    const errorMs = this.predictRng.gaussian(C.biasMs, this.sigmaMs(feel));
    const takeoffX = hazard.idealX + msToPx(errorMs, C.scrollPxPerFrame);
    const outside = outsideMs(takeoffX, hazard.baseRange, C.scrollPxPerFrame);
    const margin = marginMs(takeoffX, hazard.baseRange, C.scrollPxPerFrame);
    const prediction: JumpPrediction = {
      hazardId: hazard.id,
      takeoffX,
      outcome: outside !== 0 ? 'dead' : margin < C.nearMissMs ? 'close' : 'safe',
    };
    this.predictions.set(hazard.id, { idealJumpFrame: hazard.idealJumpFrame, prediction });
    return prediction;
  }

  private forgetStale(hazards: readonly HazardView[]): void {
    if (this.plans.size < 8 && this.predictions.size < 8) return;
    const live = new Set(hazards.map((h) => h.id));
    for (const id of this.plans.keys()) if (!live.has(id)) this.plans.delete(id);
    for (const id of this.predictions.keys()) if (!live.has(id)) this.predictions.delete(id);
  }
}
