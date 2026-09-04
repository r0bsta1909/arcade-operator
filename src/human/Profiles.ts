// Personality profiles (M1: casual active, all four defined). GDD 2.3.
// learnRate scale: niedrig 0.5, mittel 1, hoch 1.5, sehr hoch 2 (SessionConfig.skillPerSegment).
// suspicionSensitivity is unused until M2.

export type ProfileId = 'casual' | 'veteran' | 'tilter' | 'kid';

export interface Profile {
  id: ProfileId;
  /** German display name for the debrief reveal (GDD 2.6). */
  label: string;
  skillStart: number;
  learnRate: number;
  /** Multiplier on frustration increases. */
  frustMult: number;
  /** Multiplier on boredom increases. */
  boredMult: number;
  /** M2: multiplier on suspicion increases. */
  suspicionSensitivity: number;
}

export const PROFILES: Record<ProfileId, Profile> = {
  casual: { id: 'casual', label: 'Der Casual', skillStart: 0.35, learnRate: 1.5, frustMult: 1.4, boredMult: 0.7, suspicionSensitivity: 0.7 },
  veteran: { id: 'veteran', label: 'Der Veteran', skillStart: 0.75, learnRate: 0.5, frustMult: 0.8, boredMult: 1.5, suspicionSensitivity: 1.3 },
  tilter: { id: 'tilter', label: 'Der Tilter', skillStart: 0.55, learnRate: 1.0, frustMult: 1.0, boredMult: 0.9, suspicionSensitivity: 1.0 },
  kid: { id: 'kid', label: 'Das Kind', skillStart: 0.3, learnRate: 2.0, frustMult: 1.0, boredMult: 1.2, suspicionSensitivity: 0.4 },
};

/** Profiles that can be rolled for a session. GDD 6 / M1: casual only. */
export const ACTIVE_PROFILES: readonly ProfileId[] = ['casual'];
