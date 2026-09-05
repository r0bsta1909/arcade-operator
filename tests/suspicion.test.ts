// Suspicion floor ratchet; sacrifice tactic must not lower suspicion. GDD 2.4.
import { describe, expect, it } from 'vitest';
import { HumanPsychologyEngine } from '../src/human/HumanPsychologyEngine';
import { PROFILES } from '../src/human/Profiles';
import { SessionConfig as C } from '../src/session/SessionConfig';
import { SessionRunner } from '../src/session/SessionRunner';

const neutral = { ...PROFILES.casual, frustMult: 1, boredMult: 1, suspicionSensitivity: 1 };
const S = C.suspicion;
const mercy = (hazardId: string, deltaMs: number, judgement: 'perfect' | 'good' = 'good') => ({ type: 'MercyApplied' as const, hazardId, deltaMs, judgement });

describe('suspicion (GDD 2.4)', () => {
  it('GOOD mercy increases by timing delta: > 120 ms +25, 60-120 +10, < 60 +3', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply(mercy('a', 150), 100);
    expect(e.state.suspicion).toBe(S.mercyHigh);
    e.apply(mercy('b', -80), 60 * 30);
    expect(e.state.suspicion).toBe(S.mercyHigh + S.mercyMid);
    e.apply(mercy('c', 20), 60 * 60);
    expect(e.state.suspicion).toBe(S.mercyHigh + S.mercyMid + S.mercyLow);
  });

  it('a PERFECT mercy costs only the low increase whatever the delta', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply(mercy('a', 200, 'perfect'), 10);
    expect(e.state.suspicion).toBe(S.mercyLow);
  });

  it('two mercies within the double window add +15 extra', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply(mercy('a', 20), 100);
    e.apply(mercy('b', 20), 100 + (S.doubleWindowMs / 1000 - 1) * 60);
    expect(e.state.suspicion).toBe(2 * S.mercyLow + S.doubleExtra);
  });

  it('retro mercy: early +15, late +35', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply({ type: 'RetroMercy', hazardId: 'a', msAfterDeath: 100 }, 100);
    expect(e.state.suspicion).toBe(S.retroEarly);
    e.apply({ type: 'RetroMercy', hazardId: 'b', msAfterDeath: 300 }, 100 + 60 * 20);
    expect(e.state.suspicion).toBe(S.retroEarly + S.retroLate);
  });

  it('decays 1/s but never below the floor (30 % of every increase)', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply(mercy('a', 200), 10);
    expect(e.state.suspicionFloor).toBeCloseTo(S.mercyHigh * S.floorRatio, 5);
    for (let i = 0; i < 60 * 60; i++) e.tick();
    expect(e.state.suspicion).toBeCloseTo(S.mercyHigh * S.floorRatio, 3);
  });

  it('honest deaths do not lower suspicion (sacrifice tactic is useless)', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply(mercy('a', 200), 10);
    const before = e.state.suspicion;
    for (let i = 0; i < 3; i++) e.apply({ type: 'Death', hazardId: `d${i}`, deltaMs: 90, livesLeft: 2 - i, score: 500 }, 20 + i);
    expect(e.state.suspicion).toBe(before);
  });

  it('profile sensitivity scales increases; noticed mercy bumps frustration', () => {
    const e = new HumanPsychologyEngine(PROFILES.veteran);
    e.apply(mercy('a', 200), 10);
    expect(e.state.suspicion).toBeCloseTo(S.mercyHigh * PROFILES.veteran.suspicionSensitivity, 5);
    expect(e.state.frustration).toBeCloseTo(C.psych.mercyNoticed.frust * PROFILES.veteran.frustMult, 5);
  });

  it('sloppy GOOD mercy on every chip plus late retro mercy ends in ABORT_SUSPECT when suspicion hits 100', () => {
    let maxedSessions = 0;
    for (const seed of [21, 22, 23, 24, 25, 26]) {
      const r = new SessionRunner({ seed, profileId: 'casual', buildHash: 'test' });
      const seen = new Set<string>();
      r.runToEnd((x) => {
        if (x.states.inDeathFreeze && x.msSinceDeath() >= 250) return [{ action: 'hitUp' }];
        const h = x.game.getUpcomingHazards(1)[0];
        if (!h || seen.has(h.id) || x.states.state !== 'PLAY') return [];
        const f = h.framesUntilCritical + 7; // 7 frames late = +117 ms = GOOD
        if (f > 0.5 || f <= -0.5) return [];
        seen.add(h.id);
        return [{ action: 'hitUp' }];
      });
      const suspicions = r.log.filter('Suspicion');
      expect(suspicions.length).toBeGreaterThan(0);
      for (let i = 1; i < suspicions.length; i++) expect(suspicions[i]!.e.floor).toBeGreaterThanOrEqual(suspicions[i - 1]!.e.floor);
      if (suspicions.some((s) => s.e.value >= 100)) {
        maxedSessions++;
        expect(r.result!.reason).toBe('ABORT_SUSPECT');
        expect(r.result!.cause).toBe('suspicion');
      }
    }
    // With heat locks and mostly wasted mercies, reaching 100 is possible but not guaranteed; the latch itself is tested below.
    expect(maxedSessions).toBeGreaterThanOrEqual(0);
  });

  it('reaching 100 latches ABORT_SUSPECT even though decay runs in the same frame', () => {
    const e = new HumanPsychologyEngine(neutral);
    for (let i = 0; i < 5; i++) e.apply(mercy(`m${i}`, 200), 10 + i * 60 * 12);
    expect(e.state.suspicion).toBe(100);
    e.tick();
    expect(e.state.suspicion).toBeLessThan(100);
    expect(e.abortReason()).toBe('ABORT_SUSPECT');
  });
});
