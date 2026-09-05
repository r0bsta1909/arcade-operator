// Pointer + keyboard gestures on lane and sliders. GDD 2.2, 5.3.
// Swipe: >= 40 px, <= 250 ms, vertically dominant. Tap: <= 200 ms (M2 hitbox
// shrink; ignored in M1). Pointer capture on the lane. Keyboard: W/S or
// arrows act on the front chip, 1-3 select a chip, W in the freeze = retro mercy.
import type { OperatorActions } from './OperatorActions';
import type { LatencyProbe } from './LatencyProbe';

export interface InputContext {
  /** Hazard ids currently shown on the lane, front chip first. */
  chipIds(): readonly string[];
  inDeathFreeze(): boolean;
}

// GDD 5.3 said >= 40 px in <= 250 ms; loosened after the first device test (STOPP 2: swipes not detected).
const SWIPE_MIN_PX = 28;
const SWIPE_MAX_MS = 450;

export class OperatorInput {
  private start: { x: number; y: number; t: number; chipId: string | null; pointerId: number } | null = null;
  private selectedIndex = 0;
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

  private listen<K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K | string, fn: (e: never) => void): void {
    el.addEventListener(type, fn as EventListener);
    this.disposers.push(() => el.removeEventListener(type, fn as EventListener));
  }

  private readonly onDown = (e: PointerEvent): void => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-hazard-id]');
    this.lane.setPointerCapture(e.pointerId);
    this.start = { x: e.clientX, y: e.clientY, t: e.timeStamp, chipId: chip?.dataset['hazardId'] ?? null, pointerId: e.pointerId };
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
    if (dy < 0) this.up(s.chipId);
    else this.down(s.chipId);
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const chips = this.ctx.chipIds();
    switch (e.key) {
      case '1':
      case '2':
      case '3':
        this.selectedIndex = Number(e.key) - 1;
        return;
      case 'w':
      case 'W':
      case 'ArrowUp':
        e.preventDefault();
        this.up(chips[this.selectedIndex] ?? chips[0] ?? null);
        return;
      case 's':
      case 'S':
      case 'ArrowDown':
        e.preventDefault();
        this.down(chips[this.selectedIndex] ?? chips[0] ?? null);
        return;
      default:
        return;
    }
  };

  /** Swipe up: retro mercy in the freeze, otherwise arm the chip (or the front chip). */
  private up(chipId: string | null): void {
    if (this.ctx.inDeathFreeze()) {
      this.actions.retroMercy();
      this.probe.retroGestureEnded();
      return;
    }
    const id = chipId ?? this.ctx.chipIds()[0];
    if (id) this.actions.arm(id);
  }

  private down(chipId: string | null): void {
    if (this.ctx.inDeathFreeze()) return;
    const id = chipId ?? this.ctx.chipIds()[0];
    if (id) this.actions.veto(id);
  }
}
