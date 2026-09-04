// Heat budget with overheat lock. GDD 2.1 / 2.2.
// Listens to the bus so heat is part of the deterministic simulation and the
// log: +20 arm, +15 harden, +10 mercy applied, +35 retro mercy, -8/s decay.
// Reaching heatMax locks all interventions for overheatLockMs (Overheat /
// OverheatEnd events); SessionRunner rejects commands while `locked`.
import type { EventBus } from '../core/EventBus';
import { MS_PER_FRAME } from '../core/Clock';
import { SessionConfig as C } from '../session/SessionConfig';

export const OVERHEAT_LOCK_FRAMES = Math.round(C.overheatLockMs / MS_PER_FRAME);

export class HeatSystem {
  value = 0;
  /** Frames left in the overheat lock; 0 = operational. */
  lockFramesLeft = 0;

  constructor(private readonly bus: EventBus) {
    bus.on('OperatorAction', (e) => {
      if (e.effect === 'armed') this.add(C.heatArm);
      else if (e.effect === 'hardened') this.add(C.heatHarden);
      else if (e.effect === 'revived') this.add(C.heatRetroMercy);
      // 'disarmed': heat already spent, nothing refunded (GDD 2.2)
    });
    bus.on('MercyApplied', () => this.add(C.heatMercyApplied));
  }

  get locked(): boolean {
    return this.lockFramesLeft > 0;
  }

  get lockMsLeft(): number {
    return this.lockFramesLeft * MS_PER_FRAME;
  }

  tick(): void {
    this.value = Math.max(0, this.value - (C.heatDecayPerSec * MS_PER_FRAME) / 1000);
    if (this.lockFramesLeft > 0) {
      this.lockFramesLeft--;
      if (this.lockFramesLeft === 0) this.bus.emit({ type: 'OverheatEnd' });
    }
  }

  private add(amount: number): void {
    this.value = Math.min(C.heatMax, this.value + amount);
    this.bus.emit({ type: 'Heat', value: Math.round(this.value) });
    if (this.value >= C.heatMax && !this.locked) {
      this.lockFramesLeft = OVERHEAT_LOCK_FRAMES;
      this.bus.emit({ type: 'Overheat', lockMs: C.overheatLockMs });
    }
  }
}
