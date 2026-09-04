// MOON HOPPER simulation. Knows nothing about the guest. GDD 3, 5.3.
// Input is a HumanInput (jump or not) per frame; the ManipulationLayer supplies
// hitbox slack per hazard. Emits Jump, Death, NearMiss, HazardCleared,
// SegmentCleared, ScoreMilestone, Respawn, RetroMercy via the EventBus.
import type { EventBus } from '../core/EventBus';
import { SessionConfig as C } from '../session/SessionConfig';
import type { HazardType } from '../session/events';
import { Hopper } from './Hopper';
import type { ManipulationLayer } from './ManipulationLayer';
import type { Obstacle } from './Obstacle';
import {
  deltaMs,
  hitsWorm,
  marginMs,
  outsideMs,
  overGap,
  round1,
  takeoffRange,
  type Slack,
  type TakeoffRange,
} from './Physics';
import { SEGMENTS } from './Segments';

export interface HumanInput {
  jump: boolean;
}

/** What the guest and the lane see about an upcoming hazard. */
export interface HazardView {
  id: string;
  type: HazardType;
  x: number;
  width: number;
  height: number;
  /** Frames until the ideal take-off (the "critical frame" the lane chip reaches the contact zone). */
  framesUntilCritical: number;
  /** Absolute simulation frame of the ideal take-off. */
  idealJumpFrame: number;
  /** World front-x of the ideal take-off. */
  idealX: number;
  /** Take-off range under the unmanipulated window (what the guest believes). */
  baseRange: TakeoffRange;
}

export interface WorldSnapshot {
  frame: number;
  distance: number;
  speed: number;
  hopperFeetY: number;
  hopperMode: Hopper['mode'];
  obstacles: readonly Obstacle[];
  score: number;
  lives: number;
  victoryScore: number;
  segmentName: string;
  alive: boolean;
}

export class FakeArcadeGame {
  frame = 0;
  /** World x of the hopper's front edge. */
  distance = 0;
  score = 0;
  lives: number = C.lives;
  readonly hopper = new Hopper();
  alive = true;
  victory = false;
  deathHazard: Obstacle | null = null;

  private obstacles: Obstacle[] = [];
  private generatedLoops = 0;
  private metersScored = 0;
  private nextMilestone: number = C.scoreMilestone;
  private segmentsScored = 0;
  private lastJump: { hazardId: string; front: number } | null = null;
  private rangeCache = new Map<string, TakeoffRange | null>();

  constructor(
    private readonly bus: EventBus,
    private readonly manip: ManipulationLayer,
  ) {
    this.ensureObstacles();
  }

  get speed(): number {
    return this.manip.state.speed;
  }

  // ------------------------------------------------------------------ tick

  tick(input: HumanInput | null): void {
    if (!this.alive || this.victory) return;
    this.frame++;
    const speed = this.speed;

    if (input?.jump) this.handleJump();

    this.distance += speed;
    this.ensureObstacles();

    const craterUnder = this.craterUnder(this.distance);
    const fell = this.hopper.update(craterUnder === null);
    if (fell && craterUnder) return this.die(craterUnder);
    if (fell) return this.die(this.currentTarget() ?? this.obstacles[0]!);

    for (const o of this.obstacles) {
      if (o.resolved || o.type === 'crater') continue;
      if (o.x > this.distance + 1) break;
      if (hitsWorm(this.distance, this.hopper.feetY, o, this.manip.slackFor(o.id))) return this.die(o);
    }

    this.resolvePassed();
    this.updateScore();
  }

  /**
   * The guest pressed the button. A press while airborne is ignored (nothing to
   * log, the guest keeps pressing). A press while grounded or falling is the
   * guest's timing decision and is logged as Jump even if the hopper is already
   * past coyote time and cannot take off any more.
   */
  private handleJump(): void {
    if (this.hopper.mode === 'airborne') return;
    const falling = this.hopper.mode === 'falling' ? this.craterUnder(this.distance) : null;
    const coyote = falling ? this.manip.slackFor(falling.id).coyoteFrames : 0;
    const target = this.currentTarget();
    if (target && this.lastJump?.hazardId !== target.id) {
      this.lastJump = { hazardId: target.id, front: this.distance };
      const range = this.rangeFor(target, this.manip.baseSlack());
      this.bus.emit({ type: 'Jump', hazardId: target.id, deltaMs: range ? deltaMs(this.distance, range, this.speed) : 0 });
    }
    this.hopper.tryJump(coyote);
  }

  private die(o: Obstacle): void {
    this.alive = false;
    this.deathHazard = o;
    this.lives--;
    o.resolved = true;
    const base = this.rangeFor(o, this.manip.baseSlack());
    const front = this.lastJump?.hazardId === o.id ? this.lastJump.front : this.distance;
    const delta = base ? deltaMs(front, base, this.speed) : 0;
    const outside = base ? outsideMs(front, base, this.speed) : 0;
    this.manip.onHazardResolved({ hazardId: o.id, survived: false, outsideBaseMs: outside });
    this.bus.emit({ type: 'Death', hazardId: o.id, deltaMs: delta, livesLeft: this.lives, score: this.score });
  }

  private resolvePassed(): void {
    for (const o of this.obstacles) {
      if (o.resolved) continue;
      if (this.distance - C.hopperWidth <= o.x + o.width) break;
      o.resolved = true;
      const jumped = this.lastJump?.hazardId === o.id ? this.lastJump.front : null;
      const base = this.rangeFor(o, this.manip.baseSlack());
      const actual = this.rangeFor(o, this.manip.slackFor(o.id));
      const outside = jumped !== null && base ? outsideMs(jumped, base, this.speed) : 0;
      const margin = jumped !== null && actual ? marginMs(jumped, actual, this.speed) : round1(C.nearMissMs * 4);
      this.manip.onHazardResolved({ hazardId: o.id, survived: true, outsideBaseMs: outside });
      this.bus.emit({ type: 'HazardCleared', hazardId: o.id, marginMs: margin });
      if (margin < C.nearMissMs) this.bus.emit({ type: 'NearMiss', hazardId: o.id, marginMs: margin });
      if (o.type !== 'crater') this.score += C.pointsPerEnemy;
    }
  }

  private updateScore(): void {
    const meters = Math.floor(this.distance / C.pxPerMeter);
    if (meters > this.metersScored) {
      this.score += (meters - this.metersScored) * C.pointsPerMeter;
      this.metersScored = meters;
    }
    const segmentsPassed = Math.floor(this.distance / C.segmentLengthPx);
    while (segmentsPassed > this.segmentsScored) {
      const idx = this.segmentsScored;
      this.segmentsScored++;
      this.score += C.pointsPerSegment;
      this.bus.emit({ type: 'SegmentCleared', segment: idx % SEGMENTS.length, loop: Math.floor(idx / SEGMENTS.length) });
    }
    while (this.score >= this.nextMilestone) {
      this.bus.emit({ type: 'ScoreMilestone', score: this.nextMilestone });
      this.nextMilestone += C.scoreMilestone;
    }
    if (this.score >= C.victoryScore) this.victory = true;
  }

  // ------------------------------------------------------- death handling

  /** Retroactive mercy (GDD 2.2): undo the last death, place the hopper past the hazard. */
  revive(msAfterDeath: number): void {
    const o = this.deathHazard;
    if (this.alive || !o) return;
    this.lives++;
    this.distance = o.x + o.width + C.hopperWidth + 1;
    this.hopper.reset();
    this.alive = true;
    this.lastJump = null;
    this.manip.forget(o.id);
    this.deathHazard = null;
    this.bus.emit({ type: 'RetroMercy', hazardId: o.id, msAfterDeath: round1(msAfterDeath) });
  }

  /** Respawn shortly before the killing hazard; hazards ahead become active again. */
  respawn(): void {
    const o = this.deathHazard;
    if (this.alive || !o) return;
    this.distance = this.safeRespawnX(o);
    for (const ob of this.obstacles) {
      if (ob.x >= this.distance) {
        ob.resolved = false;
        this.manip.forget(ob.id);
      }
    }
    this.hopper.reset();
    this.alive = true;
    this.lastJump = null;
    this.deathHazard = null;
    this.bus.emit({ type: 'Respawn', hazardId: o.id, livesLeft: this.lives });
  }

  // ------------------------------------------------------------- queries

  /** Next `n` unresolved hazards ahead, with ideal take-off frames under the base window. */
  getUpcomingHazards(n = 3): HazardView[] {
    const out: HazardView[] = [];
    const base = this.manip.baseSlack();
    for (const o of this.obstacles) {
      if (o.resolved) continue;
      const range = this.rangeFor(o, base);
      if (!range) continue;
      const framesUntil = (range.ideal - this.distance) / this.speed;
      out.push({
        id: o.id,
        type: o.type,
        x: o.x,
        width: o.width,
        height: o.height,
        framesUntilCritical: framesUntil,
        idealJumpFrame: this.frame + framesUntil,
        idealX: range.ideal,
        baseRange: range,
      });
      if (out.length >= n) break;
    }
    return out;
  }

  /** Take-off range for a hazard under a slack; cached by slack signature. */
  rangeFor(o: Obstacle, slack: Slack): TakeoffRange | null {
    const key = `${o.id}|${slack.latePx}|${slack.earlyPx}|${slack.coyoteFrames}|${this.speed}`;
    let r = this.rangeCache.get(key);
    if (r === undefined) {
      r = takeoffRange(o, slack, this.speed);
      this.rangeCache.set(key, r);
    }
    return r;
  }

  snapshot(): WorldSnapshot {
    const left = this.distance - C.hopperScreenX - 16;
    const right = left + C.crtWidth + 32;
    const segIdx = Math.floor(this.distance / C.segmentLengthPx) % SEGMENTS.length;
    return {
      frame: this.frame,
      distance: this.distance,
      speed: this.speed,
      hopperFeetY: this.hopper.feetY,
      hopperMode: this.hopper.mode,
      obstacles: this.obstacles.filter((o) => o.x + o.width >= left && o.x <= right),
      score: this.score,
      lives: this.lives,
      victoryScore: C.victoryScore,
      segmentName: SEGMENTS[segIdx]?.name ?? '',
      alive: this.alive,
    };
  }

  // ------------------------------------------------------------- helpers

  /**
   * Respawn point before the killing hazard with a full lead before *every*
   * hazard ahead. Segments space hazards 80-112 px apart while the lead is
   * 96 px, so the naive point sits right in front of the previous hazard and
   * the guest dies again within the freeze (STOPP 2 bug: "two lives at once").
   */
  private safeRespawnX(o: Obstacle): number {
    let x = o.x - C.respawnLeadPx;
    for (let guard = 0; guard < 8; guard++) {
      const ahead = this.obstacles.find((h) => h.x + h.width + C.hopperWidth >= x);
      if (!ahead || ahead.x - x >= C.respawnLeadPx) break;
      x = ahead.x - C.respawnLeadPx;
    }
    return Math.max(0, x);
  }

  private currentTarget(): Obstacle | null {
    for (const o of this.obstacles) {
      if (!o.resolved && o.x + o.width >= this.distance - C.hopperWidth) return o;
    }
    return null;
  }

  private craterUnder(front: number): Obstacle | null {
    for (const o of this.obstacles) {
      if (o.resolved || o.type !== 'crater') continue;
      if (o.x > front) break;
      if (overGap(front, o, this.manip.slackFor(o.id))) return o;
    }
    return null;
  }

  /** Generate segments up to two ahead of the hopper. Cycles through SEGMENTS. */
  private ensureObstacles(): void {
    const loopLength = C.segmentLengthPx * SEGMENTS.length;
    while (this.generatedLoops * loopLength < this.distance + 2 * C.segmentLengthPx) {
      const loop = this.generatedLoops;
      SEGMENTS.forEach((seg, s) => {
        seg.hazards.forEach((h, i) => {
          this.obstacles.push({
            id: `L${loop}S${s}:${i}`,
            type: h.type,
            x: loop * loopLength + s * C.segmentLengthPx + h.atMeter * C.pxPerMeter,
            width: h.width,
            height: h.type === 'crater' ? 0 : (h.height ?? 8),
            segment: s,
            loop,
            resolved: false,
          });
        });
      });
      this.generatedLoops++;
    }
    // Drop obstacles far behind to keep scans short; keep a margin for respawn.
    const cutoff = this.distance - C.respawnLeadPx - C.crtWidth;
    while (this.obstacles.length > 0 && this.obstacles[0]!.x + this.obstacles[0]!.width < cutoff) this.obstacles.shift();
  }
}
