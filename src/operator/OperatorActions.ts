// arm / veto / retroMercy; queue consumed by SessionRunner.step() on the next tick. GDD 2.2.
// The UI never touches the simulation directly: gestures become commands here,
// the game loop drains them once per frame, so a session stays a function of
// (seed, command script) and can be replayed from the log.
import type { OperatorCommand } from '../session/SessionRunner';

export class OperatorActions {
  private pending: OperatorCommand[] = [];

  /** Arm mercy for a chip (swipe up). GDD 2.2. */
  arm(hazardId: string): void {
    this.pending.push({ action: 'arm', hazardId });
  }

  /** Veto: disarms an armed chip, otherwise hardens it (swipe down). GDD 2.2. */
  veto(hazardId: string): void {
    this.pending.push({ action: 'veto', hazardId });
  }

  /** Retroactive mercy during DEATH_FREEZE (swipe up in the freeze). GDD 2.2. */
  retroMercy(): void {
    this.pending.push({ action: 'retroMercy' });
  }

  /** Commands for this frame; empties the queue. */
  drain(): OperatorCommand[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
