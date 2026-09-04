// Fixed simulation dt and timeScale. GDD 5.3: bullet-time (M2) scales the
// accumulator via Clock.timeScale, never the tick rate.

export const TICK_HZ = 60;
export const FIXED_DT = 1 / TICK_HZ;
export const MS_PER_FRAME = 1000 / TICK_HZ;

export function framesToMs(frames: number): number {
  return frames * MS_PER_FRAME;
}

export function msToFrames(ms: number): number {
  return ms / MS_PER_FRAME;
}

export class Clock {
  /** 1 = real time. 0.5 = bullet-time. Only affects how much wall time feeds the accumulator. */
  timeScale = 1;
  /** Simulation frame counter. */
  frame = 0;

  get elapsedMs(): number {
    return this.frame * MS_PER_FRAME;
  }
}
