// Personality profiles (M1: casual active, all four defined). GDD 2.3.
// learnRate scale: niedrig 0.5, mittel 1, hoch 1.5, sehr hoch 2 (SessionConfig.skillPerSegment).
// suspicionSensitivity scale (GDD 2.3 column 'Verdachts-Empfindlichkeit'): sehr niedrig 0.6,
// niedrig 1.0, mittel 1.3, hoch 1.6. Casual = 1.0 calibrated after STOPP 2 (merciful bot
// loses 53 %, heuristic wins 56 %, GDD 5.4).

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
  /** Multiplier on suspicion increases. GDD 2.4. */
  suspicionSensitivity: number;
}

export const PROFILES: Record<ProfileId, Profile> = {
  casual: { id: 'casual', label: 'Der Casual', skillStart: 0.35, learnRate: 1.5, frustMult: 1.4, boredMult: 0.7, suspicionSensitivity: 1.0 },
  veteran: { id: 'veteran', label: 'Der Veteran', skillStart: 0.75, learnRate: 0.5, frustMult: 0.8, boredMult: 1.5, suspicionSensitivity: 1.6 },
  tilter: { id: 'tilter', label: 'Der Tilter', skillStart: 0.55, learnRate: 1.0, frustMult: 1.0, boredMult: 0.9, suspicionSensitivity: 1.3 },
  kid: { id: 'kid', label: 'Das Kind', skillStart: 0.3, learnRate: 2.0, frustMult: 1.0, boredMult: 1.2, suspicionSensitivity: 0.6 },
};

/** Profiles that can be rolled for a session. GDD 6 / M1: casual; veteran added after STOPP 2 so hardening has a purpose. */
export const ACTIVE_PROFILES: readonly ProfileId[] = ['casual', 'veteran'];
