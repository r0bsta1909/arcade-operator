// State machine: ATTRACT..DEBRIEF incl. DEATH_FREEZE timer. GDD 5.3.
// Transitions are driven by SessionRunner; this class only guards them and logs StateChange.
import type { EventBus } from '../core/EventBus';
import { MS_PER_FRAME } from '../core/Clock';
import { SessionConfig as C } from './SessionConfig';
import type { GameState } from './events';

const ALLOWED: Record<GameState, readonly GameState[]> = {
  ATTRACT: ['READY'],
  READY: ['PLAY'],
  PLAY: ['DEATH_FREEZE', 'VICTORY', 'ABORT_FRUST', 'ABORT_BORED', 'ABORT_SUSPECT'],
  DEATH_FREEZE: ['PLAY', 'CONTINUE', 'ABORT_FRUST', 'ABORT_BORED', 'ABORT_SUSPECT'],
  CONTINUE: ['PLAY', 'ABORT_FRUST', 'ABORT_BORED', 'ABORT_SUSPECT'],
  VICTORY: ['DEBRIEF'],
  ABORT_FRUST: ['DEBRIEF'],
  ABORT_BORED: ['DEBRIEF'],
  ABORT_SUSPECT: ['DEBRIEF'],
  DEBRIEF: ['ATTRACT', 'READY'],
};

export const DEATH_FREEZE_FRAMES = Math.round(C.deathFreezeMs / MS_PER_FRAME);
export const CONTINUE_FRAMES = Math.round(C.continueMs / MS_PER_FRAME);
/** "PLAYER 1 READY" beat before play starts. */
export const READY_FRAMES = 60;

export class GameStateManager {
  state: GameState = 'ATTRACT';
  /** Session frame at which the current state was entered. */
  enteredAt = 0;

  constructor(private readonly bus: EventBus) {}

  transition(to: GameState, frame: number): void {
    if (!ALLOWED[this.state].includes(to)) {
      throw new Error(`Illegal state transition ${this.state} -> ${to}`);
    }
    const from = this.state;
    this.state = to;
    this.enteredAt = frame;
    this.bus.emit({ type: 'StateChange', from, to });
  }

  framesIn(frame: number): number {
    return frame - this.enteredAt;
  }

  /** Only the retroactive veto is allowed here. GDD 5.3. */
  get inDeathFreeze(): boolean {
    return this.state === 'DEATH_FREEZE';
  }

  get isTerminal(): boolean {
    return this.state === 'VICTORY' || this.state.startsWith('ABORT_') || this.state === 'DEBRIEF';
  }
}
