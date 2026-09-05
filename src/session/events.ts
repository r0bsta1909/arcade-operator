// GameEvent union shared by bus, log and psychology engine. GDD 5.3.
// Every event that changes the session is appended to the SessionLog (CLAUDE.md rule 4).

export type GameState =
  | 'ATTRACT'
  | 'READY'
  | 'PLAY'
  | 'DEATH_FREEZE'
  | 'CONTINUE'
  | 'VICTORY'
  | 'ABORT_FRUST'
  | 'ABORT_BORED'
  | 'ABORT_SUSPECT'
  | 'DEBRIEF';

export type EndReason = 'VICTORY' | 'ABORT_FRUST' | 'ABORT_BORED' | 'ABORT_SUSPECT';
/** What triggered the end: tolerance hit zero, guest ran out of lives, high score, or suspicion maxed. */
export type EndCause = 'tolerance' | 'lives' | 'highscore' | 'suspicion';

export type HazardType = 'crater' | 'worm' | 'probe' | 'meteor';

/**
 * Operator gestures (GDD 2.2, timed-hit model after STOPP 2): a swipe up or
 * down on the hit line. What it does depends on the timing judgement.
 */
export type OperatorActionKind = 'hitUp' | 'hitDown';
/** Timing quality of a hit relative to the front chip's critical frame. GDD 2.2. */
export type Judgement = 'perfect' | 'good' | 'late' | 'miss';
/** What an accepted hit did. */
export type OperatorEffect = 'mercy' | 'mercyWasted' | 'harden' | 'revived' | 'none';

export type GameEvent =
  // --- fake game (FakeArcadeGame) ---
  | { type: 'Jump'; hazardId: string; deltaMs: number }
  | { type: 'Death'; hazardId: string; deltaMs: number; livesLeft: number; score: number }
  | { type: 'NearMiss'; hazardId: string; marginMs: number }
  | { type: 'HazardCleared'; hazardId: string; marginMs: number }
  | { type: 'SegmentCleared'; segment: number; loop: number }
  | { type: 'ScoreMilestone'; score: number }
  | { type: 'Respawn'; hazardId: string; livesLeft: number }
  // --- manipulation (ManipulationLayer) ---
  | { type: 'MercyApplied'; hazardId: string; deltaMs: number; judgement: 'perfect' | 'good' }
  | { type: 'MercyExpired'; hazardId: string }
  | { type: 'RetroMercy'; hazardId: string; msAfterDeath: number }
  // --- operator ---
  | { type: 'OperatorAction'; action: OperatorActionKind; hazardId?: string; offsetMs: number; judgement: Judgement; effect: OperatorEffect }
  | { type: 'Combo'; value: number; multiplier: number }
  | { type: 'OperatorScore'; value: number; gained: number }
  | { type: 'Heat'; value: number }
  | { type: 'Overheat'; lockMs: number }
  | { type: 'OverheatEnd' }
  | { type: 'LatencySample'; ms: number }
  | { type: 'CrtTouch'; x: number; y: number }
  // --- session ---
  | { type: 'StateChange'; from: GameState; to: GameState }
  | { type: 'Suspicion'; value: number; floor: number; delta: number; cause: 'mercy' | 'retro' | 'double' }
  | { type: 'PsycheSample'; frustration: number; boredom: number; tolerance: number; jitter: number; skill: number; suspicion: number }
  | { type: 'SessionEnd'; reason: EndReason; cause: EndCause; score: number; durationMs: number };

export type GameEventType = GameEvent['type'];
export type GameEventOf<K extends GameEventType> = Extract<GameEvent, { type: K }>;
