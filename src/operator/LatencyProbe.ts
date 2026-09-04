// Measures Death -> swipe-end latency (H5) and CRT touches (H6). GDD 2.7, 5.3.
// Wall-clock measurements. They are appended to the SessionLog but excluded
// from SessionLog.hash() (see SessionLog.MEASUREMENT_EVENTS) because they
// are observations about the device, not inputs to the simulation.
import type { EventBus } from '../core/EventBus';

export class LatencyProbe {
  private deathAt: number | null = null;

  constructor(private readonly bus: EventBus) {
    bus.on('Death', () => {
      this.deathAt = performance.now();
    });
    bus.on('StateChange', (e) => {
      if (e.from === 'DEATH_FREEZE') this.deathAt = null;
    });
  }

  /** Call at the end of the retro-mercy gesture (pointerup / keyup). */
  retroGestureEnded(): void {
    if (this.deathAt === null) return;
    const ms = Math.round(performance.now() - this.deathAt);
    this.deathAt = null;
    this.bus.emit({ type: 'LatencySample', ms });
  }

  /** Any pointerdown on the CRT container. Coordinates normalized 0..1. */
  crtTouched(x: number, y: number): void {
    this.bus.emit({ type: 'CrtTouch', x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
  }
}
