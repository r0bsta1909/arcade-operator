// Heat budget with overheat lock. GDD 2.1 / 2.2.
// Listens to the bus so heat is part of the deterministic simulation and the
// log. Timed-hit model: cost depends on the judgement (perfect 10, good 20 /
// harden 15, late 35, miss 10) plus +10 when mercy actually applies.
// Reaching heatMax locks all interventions for overheatLockMs (Overheat /
// OverheatEnd events); SessionRunner rejects commands while `locked`.
import type { EventBus } from '../core/EventBus';
import { MS_PER_FRAME } from '../core/Clock';
import { SessionConfig as C } from '../session/SessionConfig';
import type { GameEventOf } from '../session/events';

export const OVERHEAT_LOCK_FRAMES = Math.round(C.overheatLockMs / MS_PER_FRAME);

export function heatCost(e: GameEventOf<'OperatorAction'>): number {
  const h = C.heat;
  switch (e.judgement) {
    case 'perfect':
      return h.perfect;
    case 'good':
      return e.action === 'hitDown' ? h.goodHarden : h.goodMercy;
    case 'late':
      return h.late;
    case 'miss':
      return h.miss;
  }
}

export class HeatSystem {
  value = 0;
  /** Frames left in the overheat lock; 0 = operational. */
  lockFramesLeft = 0;

  constructor(private readonly bus: EventBus) {
    bus.on('OperatorAction', (e) => this.add(heatCost(e)));
    bus.on('MercyApplied', () => this.add(C.heat.mercyApplied));
  }

  get locked(): boolean {
    return this.lockFramesLeft > 0;
  }

  get lockMsLeft(): number {
    return this.lockFramesLeft * MS_PER_FRAME;
  }

  tick(): void {
    this.value = Math.max(0, this.value - (C.heat.decayPerSec * MS_PER_FRAME) / 1000);
    if (this.lockFramesLeft > 0) {
      this.lockFramesLeft--;
      if (this.lockFramesLeft === 0) this.bus.emit({ type: 'OverheatEnd' });
    }
  }

  private add(amount: number): void {
    if (amount <= 0) return;
    this.value = Math.min(C.heat.max, this.value + amount);
    this.bus.emit({ type: 'Heat', value: Math.round(this.value) });
    if (this.value >= C.heat.max && !this.locked) {
      this.lockFramesLeft = OVERHEAT_LOCK_FRAMES;
      this.bus.emit({ type: 'Overheat', lockMs: C.overheatLockMs });
    }
  }
}
