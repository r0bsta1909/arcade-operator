// Pointer + keyboard gestures on the lane. GDD 2.2, 5.3 (timed-hit model).
// A swipe anywhere on the lane is a hit on the line: up = mercy, down = harden.
// The timing judgement happens in the simulation from the frame the command
// is applied in. Swipe: >= 28 px, <= 450 ms, vertically dominant (loosened
// after the first device test; GDD said 40 px / 250 ms). Keyboard: W/S or arrows.
import type { OperatorActions } from './OperatorActions';
import type { LatencyProbe } from './LatencyProbe';

export interface InputContext {
  inDeathFreeze(): boolean;
}

const SWIPE_MIN_PX = 28;
const SWIPE_MAX_MS = 450;

export class OperatorInput {
  private start: { x: number; y: number; t: number; pointerId: number } | null = null;
  private readonly disposers: Array<() => void> = [];

  constructor(
    private readonly lane: HTMLElement,
    private readonly actions: OperatorActions,
    private readonly probe: LatencyProbe,
    private readonly ctx: InputContext,
  ) {
    this.listen(lane, 'pointerdown', this.onDown);
    this.listen(lane, 'pointerup', this.onUp);
    this.listen(lane, 'pointercancel', () => (this.start = null));
    this.listen(window, 'keydown', this.onKey);
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }

  private listen(el: HTMLElement | Window, type: string, fn: (e: never) => void): void {
    el.addEventListener(type, fn as EventListener);
    this.disposers.push(() => el.removeEventListener(type, fn as EventListener));
  }

  private readonly onDown = (e: PointerEvent): void => {
    this.lane.setPointerCapture(e.pointerId);
    this.start = { x: e.clientX, y: e.clientY, t: e.timeStamp, pointerId: e.pointerId };
  };

  private readonly onUp = (e: PointerEvent): void => {
    const s = this.start;
    this.start = null;
    if (!s || s.pointerId !== e.pointerId) return;
    if (this.lane.hasPointerCapture(e.pointerId)) this.lane.releasePointerCapture(e.pointerId);
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = e.timeStamp - s.t;
    const isSwipe = Math.abs(dy) >= SWIPE_MIN_PX && dt <= SWIPE_MAX_MS && Math.abs(dy) > Math.abs(dx);
    if (!isSwipe) return;
    if (dy < 0) this.up();
    else this.down();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    switch (e.key) {
      case 'w':
      case 'W':
      case 'ArrowUp':
        e.preventDefault();
        this.up();
        return;
      case 's':
      case 'S':
      case 'ArrowDown':
        e.preventDefault();
        this.down();
        return;
      default:
        return;
    }
  };

  private up(): void {
    if (this.ctx.inDeathFreeze()) this.probe.retroGestureEnded();
    this.actions.hitUp();
  }

  private down(): void {
    this.actions.hitDown();
  }
}
