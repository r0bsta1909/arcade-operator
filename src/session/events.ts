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
/** What triggered the end: tolerance hit zero, guest ran out of lives, or high score. */
export type EndCause = 'tolerance' | 'lives' | 'highscore' | 'suspicion';

export type HazardType = 'crater' | 'worm' | 'probe' | 'meteor';

/** Operator gestures that can be scripted, logged and replayed. GDD 2.2. */
export type OperatorActionKind = 'arm' | 'veto' | 'retroMercy';
/** What an accepted action did: veto either disarms an armed chip or hardens it. GDD 2.2. */
export type OperatorEffect = 'armed' | 'disarmed' | 'hardened' | 'revived';

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
  | { type: 'MercyApplied'; hazardId: string; deltaMs: number }
  | { type: 'MercyExpired'; hazardId: string }
  | { type: 'RetroMercy'; hazardId: string; msAfterDeath: number }
  // --- operator ---
  | { type: 'OperatorAction'; action: OperatorActionKind; hazardId?: string; effect: OperatorEffect }
  | { type: 'Heat'; value: number }
  | { type: 'LatencySample'; ms: number }
  | { type: 'CrtTouch'; x: number; y: number }
  // --- session ---
  | { type: 'StateChange'; from: GameState; to: GameState }
  | { type: 'PsycheSample'; frustration: number; boredom: number; tolerance: number; jitter: number; skill: number }
  | { type: 'SessionEnd'; reason: EndReason; cause: EndCause; score: number; durationMs: number };

export type GameEventType = GameEvent['type'];
export type GameEventOf<K extends GameEventType> = Extract<GameEvent, { type: K }>;
