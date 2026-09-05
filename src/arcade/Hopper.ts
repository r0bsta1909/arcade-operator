// Player sprite: fixed jump height, 36-frame jump, coyote frames as input. GDD 3.
// Horizontal position is owned by FakeArcadeGame (auto-run); Hopper owns the
// vertical state machine: grounded -> airborne -> grounded, or grounded -> falling -> dead.
import { SessionConfig as C } from '../session/SessionConfig';
import { jumpFeetY } from './Physics';

export type HopperMode = 'grounded' | 'airborne' | 'falling';

export class Hopper {
  mode: HopperMode = 'grounded';
  /** Feet y in logic px. */
  feetY: number = C.groundY;
  /** Frames since take-off while airborne. */
  jumpFrame = 0;
  /** Frames since the hopper lost ground support while falling. */
  fallFrames = 0;

  reset(): void {
    this.mode = 'grounded';
    this.feetY = C.groundY;
    this.jumpFrame = 0;
    this.fallFrames = 0;
  }

  /**
   * Attempt a jump. Allowed when grounded, or while falling within coyote time
   * (GDD 2.2: mercy adds 120 ms coyote). Returns true if the jump started.
   */
  tryJump(coyoteFrames: number): boolean {
    const canJump = this.mode === 'grounded' || (this.mode === 'falling' && this.fallFrames <= coyoteFrames);
    if (!canJump) return false;
    this.mode = 'airborne';
    this.jumpFrame = 0;
    this.fallFrames = 0;
    this.feetY = C.groundY;
    return true;
  }

  /**
   * Advance one frame. `hasSupport` says whether there is ground under the
   * hopper's center right now (computed by the game with slack applied).
   * Returns true if the hopper has fallen to its death.
   */
  update(hasSupport: boolean): boolean {
    switch (this.mode) {
      case 'airborne':
        this.jumpFrame++;
        this.feetY = jumpFeetY(this.jumpFrame);
        if (this.jumpFrame >= C.jumpFrames) {
          this.feetY = C.groundY;
          this.mode = hasSupport ? 'grounded' : 'falling';
          this.fallFrames = hasSupport ? 0 : 1;
        }
        return false;
      case 'grounded':
        if (!hasSupport) {
          // The frame support is lost already counts as a fall frame, so a jump
          // in that frame needs coyote time >= 1. Keeps the live game consistent
          // with Physics.survivesJumpFrom (no hidden one-frame coyote).
          this.mode = 'falling';
          this.fallFrames = 1;
          this.feetY = C.groundY + 2;
        }
        return false;
      case 'falling':
        this.fallFrames++;
        this.feetY = C.groundY + this.fallFrames * 2;
        return this.fallFrames >= C.craterFallFrames;
    }
  }
}
