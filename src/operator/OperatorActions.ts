// hitUp / hitDown; queue consumed by SessionRunner.step() on the next tick. GDD 2.2.
// The UI never touches the simulation directly: gestures become commands here,
// the game loop drains them once per frame, so a session stays a function of
// (seed, command script) and can be replayed from the log. The timing
// judgement happens in the runner, from the frame the command is applied in.
import type { OperatorCommand } from '../session/SessionRunner';

export class OperatorActions {
  private pending: OperatorCommand[] = [];

  /** Swipe up on the hit line: mercy (or retroactive mercy in the death freeze). GDD 2.2. */
  hitUp(): void {
    this.pending.push({ action: 'hitUp' });
  }

  /** Swipe down on the hit line: harden the front hazard. GDD 2.2. */
  hitDown(): void {
    this.pending.push({ action: 'hitDown' });
  }

  /** Commands for this frame; empties the queue. */
  drain(): OperatorCommand[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
