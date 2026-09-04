// Heat budget (M1: number only, no overheat). GDD 2.1 / 2.2.
// Listens to the bus so heat is part of the deterministic simulation and the
// log: +20 arm, +15 harden, +10 mercy applied, +35 retro mercy, -8/s decay.
// A Heat event is logged on every discrete change (decay is implied).
import type { EventBus } from '../core/EventBus';
import { MS_PER_FRAME } from '../core/Clock';
import { SessionConfig as C } from '../session/SessionConfig';

export class HeatSystem {
  value = 0;

  constructor(private readonly bus: EventBus) {
    bus.on('OperatorAction', (e) => {
      if (e.effect === 'armed') this.add(C.heatArm);
      else if (e.effect === 'hardened') this.add(C.heatHarden);
      else if (e.effect === 'revived') this.add(C.heatRetroMercy);
      // 'disarmed': heat already spent, nothing refunded (GDD 2.2)
    });
    bus.on('MercyApplied', () => this.add(C.heatMercyApplied));
  }

  tick(): void {
    this.value = Math.max(0, this.value - (C.heatDecayPerSec * MS_PER_FRAME) / 1000);
  }

  private add(amount: number): void {
    this.value = Math.min(100, this.value + amount);
    this.bus.emit({ type: 'Heat', value: Math.round(this.value) });
  }
}
