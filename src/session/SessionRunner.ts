// DOM-free wiring of world, guest, psyche, manipulation and log; one step() per frame. GDD 5.3, 5.4.
// Used by the browser entry point, the tests, the balancing sim and replays.
// Operator commands enter through `step(commands)` so a session is a pure
// function of (seed, profile, command script).
//
// Timed-hit model (GDD 2.2 after STOPP 2): a hit is judged against the front
// chip's critical frame (perfect / good / late / miss) and the judgement
// decides the effect, the heat and the suspicion. Combo and operator score
// live here too, because they are part of the deterministic log.
import { EventBus } from '../core/EventBus';
import { MS_PER_FRAME } from '../core/Clock';
import { Rng } from '../core/Rng';
import { FakeArcadeGame, type HazardView } from '../arcade/FakeArcadeGame';
import { ManipulationLayer } from '../arcade/ManipulationLayer';
import type { JumpPrediction } from '../arcade/OverlayRenderer';
import { marginMs } from '../arcade/Physics';
import { HumanAgent } from '../human/HumanAgent';
import { HeatSystem } from '../operator/HeatSystem';
import { HumanPsychologyEngine } from '../human/HumanPsychologyEngine';
import { ACTIVE_PROFILES, PROFILES, type ProfileId } from '../human/Profiles';
import { CONTINUE_FRAMES, DEATH_FREEZE_FRAMES, GameStateManager, READY_FRAMES } from './GameStateManager';
import { SessionConfig as C, configHash } from './SessionConfig';
import { SessionLog } from './SessionLog';
import type { EndCause, EndReason, Judgement, OperatorActionKind, OperatorEffect } from './events';

export interface SessionSetup {
  seed: number;
  /** Omit to roll one of ACTIVE_PROFILES from the seed. */
  profileId?: ProfileId;
  buildHash: string;
}

export interface OperatorCommand {
  action: OperatorActionKind;
}

export interface SessionResult {
  reason: EndReason;
  cause: EndCause;
  score: number;
  durationMs: number;
}

export type Verdict = 'safe' | 'dead';

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
  combo = 0;
  maxCombo = 0;
  operatorScore = 0;
  segmentsCleared = 0;
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
    this.bus.on('SegmentCleared', () => this.segmentsCleared++);
    // A death that is not undone breaks the combo (GDD 2.6 combo rule).
    this.bus.on('Respawn', () => this.setCombo(0));
    this.states.transition('READY', 0);
  }

  get ended(): boolean {
    return this.result !== null;
  }

  get multiplier(): number {
    return Math.min(C.combo.maxMultiplier, 1 + Math.floor(this.combo / C.combo.step));
  }

  /** Wall-clock tempo for the browser loop: 1.0 -> 1.4 over the session. GDD 2.2 tempo ramp. */
  tempo(): number {
    return Math.min(C.tempo.max, C.tempo.start + C.tempo.perSegment * this.segmentsCleared);
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
            this.setCombo(0);
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

  // ---------------------------------------------------------- machine view

  /** Overlay data for the front hazard: risk band, or the committed jump once the guest decided. GDD 2.2. */
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

  /** Per upcoming hazard: will the guest's committed jump survive under the current manipulation? Unknown = not committed. */
  verdicts(): Map<string, Verdict> {
    const out = new Map<string, Verdict>();
    if (this.states.state !== 'PLAY') return out;
    for (const h of this.game.getUpcomingHazards(3)) {
      const v = this.verdictFor(h);
      if (v) out.set(h.id, v);
    }
    return out;
  }

  private verdictFor(h: HazardView): Verdict | null {
    const takeoff = this.committedTakeoff(h);
    if (takeoff === null) return null;
    const s = this.game.willSurvive(h.id, takeoff);
    return s === null ? null : s ? 'safe' : 'dead';
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

  /** Milliseconds since the current death freeze started (for the lane countdown / latency). */
  msSinceDeath(): number {
    return (this.frame - this.deathFrame) * MS_PER_FRAME;
  }

  // ------------------------------------------------------------- hits

  /** Timing judgement for a hit `offsetMs` after (negative = before) the critical frame. GDD 2.2. */
  static judge(offsetMs: number): Exclude<Judgement, 'late'> {
    const a = Math.abs(offsetMs);
    if (a <= C.hit.perfectMs) return 'perfect';
    if (a <= C.hit.goodMs) return 'good';
    return 'miss';
  }

  private applyCommand(cmd: OperatorCommand): void {
    const st = this.states;
    if (this.heat.locked) return; // GDD 2.1: overheat = no interventions

    if (st.inDeathFreeze) {
      const dead = this.game.deathHazard;
      const ms = this.msSinceDeath();
      if (cmd.action === 'hitUp' && dead && ms <= C.hit.lateMs) {
        this.emitAction(cmd.action, dead.id, ms, 'late', 'revived');
        this.game.revive(ms);
        st.transition('PLAY', this.frame);
        this.reward('late', true);
      } else {
        this.emitAction(cmd.action, dead?.id, ms, 'miss', 'none');
        this.setCombo(0);
      }
      return;
    }
    if (st.state !== 'PLAY') return;

    const front = this.game.getUpcomingHazards(1)[0];
    if (!front) return;
    const offsetMs = round1((this.game.frame - front.idealJumpFrame) * MS_PER_FRAME);
    const judgement = SessionRunner.judge(offsetMs);
    if (judgement === 'miss') {
      this.emitAction(cmd.action, front.id, offsetMs, 'miss', 'none');
      this.setCombo(0);
      return;
    }

    const verdict = this.verdictFor(front);
    if (cmd.action === 'hitUp') {
      this.manip.grantMercy(front.id, judgement);
      const needed = verdict !== 'safe';
      this.emitAction('hitUp', front.id, offsetMs, judgement, needed ? 'mercy' : 'mercyWasted');
      this.reward(judgement, needed);
      return;
    }

    // hitDown: harden. A perfect hit trims the window to exactly the guest's margin => guaranteed near-miss.
    const needed = this.psyche.state.boredom > this.psyche.state.channel.boreMax / 2;
    if (judgement === 'perfect') {
      const takeoff = this.committedTakeoff(front);
      if (takeoff !== null && verdict === 'safe') {
        const margin = marginMs(takeoff, front.baseRange, this.game.speed);
        const newWindow = margin > C.harden.perfectMarginMs ? C.windowMs - 2 * (margin - C.harden.perfectMarginMs) : C.windowMs;
        this.manip.setWindow(front.id, round1(newWindow));
      } else {
        this.manip.setWindow(front.id, C.hardenedWindowMs);
      }
    } else {
      this.manip.setWindow(front.id, C.hardenedWindowMs);
    }
    this.emitAction('hitDown', front.id, offsetMs, judgement, 'harden');
    this.reward(judgement, needed);
  }

  private emitAction(action: OperatorActionKind, hazardId: string | undefined, offsetMs: number, judgement: Judgement, effect: OperatorEffect): void {
    this.bus.emit(hazardId === undefined ? { type: 'OperatorAction', action, offsetMs, judgement, effect } : { type: 'OperatorAction', action, hazardId, offsetMs, judgement, effect });
  }

  /** Combo and score after an accepted hit. Only a *needed* perfect/good hit grows the combo. GDD 2.6. */
  private reward(judgement: Exclude<Judgement, 'miss'>, needed: boolean): void {
    if (needed && judgement !== 'late') this.setCombo(this.combo + 1);
    const gained = C.combo.points[judgement] * this.multiplier;
    this.operatorScore += gained;
    this.bus.emit({ type: 'OperatorScore', value: this.operatorScore, gained });
  }

  private setCombo(value: number): void {
    if (value === this.combo) return;
    this.combo = value;
    this.maxCombo = Math.max(this.maxCombo, value);
    this.bus.emit({ type: 'Combo', value, multiplier: this.multiplier });
  }

  private end(reason: EndReason, cause: EndCause): void {
    this.result = { reason, cause, score: this.game.score, durationMs: this.frame * MS_PER_FRAME };
    this.bus.emit({ type: 'SessionEnd', reason, cause, score: this.game.score, durationMs: this.result.durationMs });
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
