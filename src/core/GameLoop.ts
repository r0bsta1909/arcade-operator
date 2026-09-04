// Fixed 60 Hz timestep with accumulator, render alpha, spiral-of-death guard.
// GDD 5.3. This is the only place that touches requestAnimationFrame /
// performance.now; the simulation itself is driven purely by tick(frame).
import { Clock, FIXED_DT } from './Clock';

export interface GameLoopOptions {
  /** Maximum simulation ticks per animation frame. GDD 5.3 / BRIEF step 2: 5. */
  maxTicksPerFrame?: number;
  onTick: (frame: number) => void;
  onRender: (alpha: number) => void;
}

export class GameLoop {
  readonly clock = new Clock();
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private readonly maxTicks: number;

  constructor(private readonly opts: GameLoopOptions) {
    this.maxTicks = opts.maxTicksPerFrame ?? 5;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const wallDt = Math.min((now - this.lastTime) / 1000, 0.25); // clamp tab-switch gaps
    this.lastTime = now;
    this.accumulator += wallDt * this.clock.timeScale;

    let ticks = 0;
    while (this.accumulator >= FIXED_DT && ticks < this.maxTicks) {
      this.clock.frame++;
      this.opts.onTick(this.clock.frame);
      this.accumulator -= FIXED_DT;
      ticks++;
    }
    if (ticks === this.maxTicks) this.accumulator = 0; // spiral-of-death guard: drop backlog

    this.opts.onRender(this.accumulator / FIXED_DT);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
