// DOM-free wiring of world, guest, psyche, manipulation and log; one step() per frame. GDD 5.3, 5.4.
// Used by the browser entry point, the tests, the balancing sim and replays.
// Operator commands enter through `step(commands)` so a session is a pure
// function of (seed, profile, command script).
import { EventBus } from '../core/EventBus';
import { MS_PER_FRAME } from '../core/Clock';
import { Rng } from '../core/Rng';
import { FakeArcadeGame, type HazardView } from '../arcade/FakeArcadeGame';
import { ManipulationLayer } from '../arcade/ManipulationLayer';
import type { JumpPrediction } from '../arcade/OverlayRenderer';
import { HumanAgent } from '../human/HumanAgent';
import { HeatSystem } from '../operator/HeatSystem';
import { HumanPsychologyEngine } from '../human/HumanPsychologyEngine';
import { ACTIVE_PROFILES, PROFILES, type ProfileId } from '../human/Profiles';
import { CONTINUE_FRAMES, DEATH_FREEZE_FRAMES, GameStateManager, READY_FRAMES } from './GameStateManager';
import { SessionConfig as C, configHash } from './SessionConfig';
import { SessionLog } from './SessionLog';
import type { EndCause, EndReason, OperatorActionKind } from './events';

export interface SessionSetup {
  seed: number;
  /** Omit to roll one of ACTIVE_PROFILES from the seed. */
  profileId?: ProfileId;
  buildHash: string;
}

export interface OperatorCommand {
  action: OperatorActionKind;
  hazardId?: string;
}

export interface SessionResult {
  reason: EndReason;
  cause: EndCause;
  score: number;
  durationMs: number;
}

export class SessionRunner {
  readonly bus = new EventBus();
  readonly log: SessionLog;
  readonly manip: ManipulationLayer;
  readonly game: FakeArcadeGame;
  readonly agent: HumanAgent;
  readonly psyche: HumanPsychologyEngine;
  readonly states: GameStateManager;
  readonly heat: HeatSystem;
  readonly profileId: ProfileId;
  /** Session frame counter (runs during freeze and continue as well). */
  frame = 0;
  result: SessionResult | null = null;
  private deathFrame = 0;

  constructor(readonly setup: SessionSetup) {
    const root = new Rng(setup.seed);
    this.profileId = setup.profileId ?? root.fork('profile').pick(ACTIVE_PROFILES);
    const profile = PROFILES[this.profileId];
    this.log = new SessionLog({
      version: 1,
      seed: setup.seed,
      profileId: this.profileId,
      buildHash: setup.buildHash,
      configHash: configHash(),
    });
    this.bus.onAny((e) => this.log.append(this.frame, e));
    this.manip = new ManipulationLayer(this.bus);
    this.game = new FakeArcadeGame(this.bus, this.manip);
    this.agent = new HumanAgent(root.fork('human'), profile);
    this.psyche = new HumanPsychologyEngine(profile, (e) => this.bus.emit(e));
    this.states = new GameStateManager(this.bus);
    this.heat = new HeatSystem(this.bus);
    this.bus.onAny((e) => this.psyche.apply(e, this.frame));
    this.states.transition('READY', 0);
  }

  get ended(): boolean {
    return this.result !== null;
  }

  /** Advance one frame with the operator's commands for this frame. */
  step(commands: readonly OperatorCommand[] = []): void {
    if (this.ended) return;
    this.frame++;
    for (const cmd of commands) this.applyCommand(cmd);

    const st = this.states;
    switch (st.state) {
      case 'READY':
        if (st.framesIn(this.frame) >= READY_FRAMES) st.transition('PLAY', this.frame);
        break;
      case 'PLAY': {
        const hazards = this.game.getUpcomingHazards(3);
        const input = this.agent.tick(
          { frame: this.game.frame, hazards, hopperMode: this.game.hopper.mode },
          this.psyche.state,
        );
        this.game.tick(input);
        if (this.game.victory) {
          st.transition('VICTORY', this.frame);
          this.end('VICTORY', 'highscore');
          return;
        }
        if (!this.game.alive) {
          this.deathFrame = this.frame;
          st.transition('DEATH_FREEZE', this.frame);
        }
        break;
      }
      case 'DEATH_FREEZE':
        if (st.framesIn(this.frame) >= DEATH_FREEZE_FRAMES) {
          if (this.game.lives > 0) {
            this.game.respawn();
            st.transition('PLAY', this.frame);
          } else {
            st.transition('CONTINUE', this.frame);
          }
        }
        break;
      case 'CONTINUE':
        if (st.framesIn(this.frame) >= CONTINUE_FRAMES) {
          const reason = this.psyche.dominantAxis();
          st.transition(reason, this.frame);
          this.end(reason, 'lives');
          return;
        }
        break;
      default:
        return;
    }

    this.psyche.tick();
    this.heat.tick();
    if (this.frame % C.psycheSampleEveryFrames === 0) {
      const p = this.psyche.state;
      this.bus.emit({
        type: 'PsycheSample',
        frustration: round3(p.frustration),
        boredom: round3(p.boredom),
        tolerance: round3(p.tolerance),
        jitter: round3(p.jitter),
        skill: round3(p.skill),
        suspicion: Math.round(p.suspicion),
      });
    }
    const abort = this.psyche.abortReason();
    if (abort) {
      st.transition(abort, this.frame);
      this.end(abort, abort === 'ABORT_SUSPECT' ? 'suspicion' : 'tolerance');
    }
  }

  /** Run to the end with an operator policy. Returns the log. */
  runToEnd(policy: (runner: SessionRunner) => readonly OperatorCommand[], maxFrames = 60 * 60 * 15): SessionLog {
    while (!this.ended && this.frame < maxFrames) this.step(policy(this));
    if (!this.ended) {
      const reason = this.psyche.dominantAxis();
      this.states.transition(reason, this.frame);
      this.end(reason, 'tolerance');
    }
    return this.log;
  }

  /** Risk band for the overlay: first hazard within the lead time. GDD 2.2. */
  prediction(): JumpPrediction | null {
    if (this.states.state !== 'PLAY') return null;
    const next = this.game.getUpcomingHazards(1)[0];
    if (!next) return null;
    if (next.framesUntilCritical * MS_PER_FRAME > C.overlayLeadMs) return null;
    if (next.framesUntilCritical < -C.jumpFrames) return null;
    const risk = this.agent.jumpRisk(next, this.psyche.state);
    const takeoff = this.committedTakeoff(next);
    if (takeoff === null) return risk;
    const survives = this.game.willSurvive(next.id, takeoff);
    return survives === null ? risk : { ...risk, committed: { takeoffX: takeoff, survives } };
  }

  /**
   * Where the guest's press for this hazard will (or did) take off: the actual
   * press if it happened, else his plan, but never before the hopper can jump
   * again (a press while airborne is held until landing).
   */
  private committedTakeoff(h: HazardView): number | null {
    const actual = this.game.jumpFrontFor(h.id);
    if (actual !== null) return actual;
    const planned = this.agent.plannedTakeoffX(h);
    if (planned === null) return null;
    return Math.max(planned, this.game.earliestTakeoffX());
  }

  /** Per upcoming hazard: will the guest's committed jump survive under the current manipulation? Unknown = not committed. */
  verdicts(): Map<string, 'safe' | 'dead'> {
    const out = new Map<string, 'safe' | 'dead'>();
    if (this.states.state !== 'PLAY') return out;
    for (const h of this.game.getUpcomingHazards(3)) {
      const planned = this.committedTakeoff(h);
      if (planned === null) continue;
      const s = this.game.willSurvive(h.id, planned);
      if (s !== null) out.set(h.id, s ? 'safe' : 'dead');
    }
    return out;
  }

  /** Milliseconds since the current death freeze started (for the lane countdown / latency). */
  msSinceDeath(): number {
    return (this.frame - this.deathFrame) * MS_PER_FRAME;
  }

  private applyCommand(cmd: OperatorCommand): void {
    const st = this.states;
    if (this.heat.locked) return; // GDD 2.1: overheat = no interventions
    if (cmd.action === 'retroMercy') {
      if (!st.inDeathFreeze) return;
      this.bus.emit({ type: 'OperatorAction', action: 'retroMercy', effect: 'revived' });
      this.game.revive(this.msSinceDeath());
      st.transition('PLAY', this.frame);
      return;
    }
    if (st.state !== 'PLAY' || !cmd.hazardId) return;
    if (!this.game.getUpcomingHazards(3).some((h) => h.id === cmd.hazardId)) return;
    if (cmd.action === 'arm') {
      this.manip.arm(cmd.hazardId);
      this.bus.emit({ type: 'OperatorAction', action: 'arm', hazardId: cmd.hazardId, effect: 'armed' });
    } else {
      const effect = this.manip.veto(cmd.hazardId);
      this.bus.emit({ type: 'OperatorAction', action: 'veto', hazardId: cmd.hazardId, effect });
    }
  }

  private end(reason: EndReason, cause: EndCause): void {
    this.result = { reason, cause, score: this.game.score, durationMs: this.frame * MS_PER_FRAME };
    this.bus.emit({ type: 'SessionEnd', reason, cause, score: this.game.score, durationMs: this.result.durationMs });
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
