// Suspicion floor ratchet; sacrifice tactic must not lower suspicion. GDD 2.4.
import { describe, expect, it } from 'vitest';
import { HumanPsychologyEngine } from '../src/human/HumanPsychologyEngine';
import { PROFILES } from '../src/human/Profiles';
import { SessionConfig as C } from '../src/session/SessionConfig';
import { SessionRunner } from '../src/session/SessionRunner';

const neutral = { ...PROFILES.casual, frustMult: 1, boredMult: 1, suspicionSensitivity: 1 };
const S = C.suspicion;

describe('suspicion (GDD 2.4)', () => {
  it('mercy increases by timing delta: > 120 ms +25, 60-120 +10, < 60 +3', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply({ type: 'MercyApplied', hazardId: 'a', deltaMs: 150 }, 100);
    expect(e.state.suspicion).toBe(S.mercyHigh);
    e.apply({ type: 'MercyApplied', hazardId: 'b', deltaMs: -80 }, 60 * 30);
    expect(e.state.suspicion).toBe(S.mercyHigh + S.mercyMid);
    e.apply({ type: 'MercyApplied', hazardId: 'c', deltaMs: 20 }, 60 * 60);
    expect(e.state.suspicion).toBe(S.mercyHigh + S.mercyMid + S.mercyLow);
  });

  it('two mercies within 10 s add +15 extra', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply({ type: 'MercyApplied', hazardId: 'a', deltaMs: 20 }, 100);
    e.apply({ type: 'MercyApplied', hazardId: 'b', deltaMs: 20 }, 100 + 5 * 60);
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
    e.apply({ type: 'MercyApplied', hazardId: 'a', deltaMs: 200 }, 10);
    expect(e.state.suspicionFloor).toBeCloseTo(S.mercyHigh * S.floorRatio, 5);
    for (let i = 0; i < 60 * 60; i++) e.tick();
    expect(e.state.suspicion).toBeCloseTo(S.mercyHigh * S.floorRatio, 3);
  });

  it('honest deaths do not lower suspicion (sacrifice tactic is useless)', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply({ type: 'MercyApplied', hazardId: 'a', deltaMs: 200 }, 10);
    const before = e.state.suspicion;
    for (let i = 0; i < 3; i++) e.apply({ type: 'Death', hazardId: `d${i}`, deltaMs: 90, livesLeft: 2 - i, score: 500 }, 20 + i);
    expect(e.state.suspicion).toBe(before);
  });

  it('profile sensitivity scales increases; noticed mercy bumps frustration', () => {
    const e = new HumanPsychologyEngine(PROFILES.veteran);
    e.apply({ type: 'MercyApplied', hazardId: 'a', deltaMs: 200 }, 10);
    expect(e.state.suspicion).toBeCloseTo(S.mercyHigh * PROFILES.veteran.suspicionSensitivity, 5);
    expect(e.state.frustration).toBeCloseTo(C.psych.mercyNoticed.frust * PROFILES.veteran.frustMult, 5);
  });

  it('a session ends with ABORT_SUSPECT once suspicion hits 100', () => {
    const r = new SessionRunner({ seed: 21, profileId: 'casual', buildHash: 'test' });
    // arm everything and always retro-veto late: maximal suspicion
    r.runToEnd((x) => {
      if (x.states.inDeathFreeze && x.msSinceDeath() >= 250) return [{ action: 'retroMercy' }];
      const h = x.game.getUpcomingHazards(1)[0];
      return h && !x.manip.isArmed(h.id) ? [{ action: 'arm', hazardId: h.id }] : [];
    });
    const suspicions = r.log.filter('Suspicion');
    expect(suspicions.length).toBeGreaterThan(0);
    for (let i = 1; i < suspicions.length; i++) expect(suspicions[i]!.e.floor).toBeGreaterThanOrEqual(suspicions[i - 1]!.e.floor);
    const maxed = suspicions.some((s) => s.e.value >= 100);
    if (maxed) {
      expect(r.result!.reason).toBe('ABORT_SUSPECT');
      expect(r.result!.cause).toBe('suspicion');
    }
  });
});
