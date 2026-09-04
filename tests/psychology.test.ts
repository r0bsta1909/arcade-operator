// Psychology table cases (M1: serial death, streak boredom, near-miss relief). GDD 2.3.
import { describe, expect, it } from 'vitest';
import { HumanPsychologyEngine } from '../src/human/HumanPsychologyEngine';
import { PROFILES } from '../src/human/Profiles';
import { SessionConfig as C } from '../src/session/SessionConfig';

const neutral = { ...PROFILES.casual, frustMult: 1, boredMult: 1 };
const death = (score = 0) => ({ type: 'Death' as const, hazardId: 'h', deltaMs: 80, livesLeft: 2, score });

describe('HumanPsychologyEngine', () => {
  it('serial deaths grow quadratically: third death within 20 s adds +0.45', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply(death(), 100);
    const afterFirst = e.state.frustration;
    expect(afterFirst).toBeCloseTo(C.psych.death.frust, 5);
    e.apply(death(), 400);
    const afterSecond = e.state.frustration;
    e.apply(death(), 700);
    const third = e.state.frustration - afterSecond;
    expect(third).toBeCloseTo(0.45, 5);
    expect(afterSecond - afterFirst).toBeGreaterThan(afterFirst);
  });

  it('a death outside the 20 s window counts as a first death again', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.apply(death(), 100);
    e.apply(death(), 100 + 21 * 60);
    expect(e.state.frustration).toBeCloseTo(2 * C.psych.death.frust, 5);
  });

  it('profile multiplier scales frustration increases only', () => {
    const e = new HumanPsychologyEngine(PROFILES.casual);
    e.apply(death(), 10);
    expect(e.state.frustration).toBeCloseTo(C.psych.death.frust * PROFILES.casual.frustMult, 5);
  });

  it('safe streaks feed boredom from the fifth jump on', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.state.boredom = 0.5;
    for (let i = 0; i < 4; i++) e.apply({ type: 'HazardCleared', hazardId: `h${i}`, marginMs: 120 }, i * 60);
    expect(e.state.boredom).toBe(0.5);
    e.apply({ type: 'HazardCleared', hazardId: 'h5', marginMs: 120 }, 300);
    expect(e.state.boredom).toBeCloseTo(0.5 + C.psych.streakBoredPerJump, 5);
    e.apply({ type: 'NearMiss', hazardId: 'h6', marginMs: 20 }, 360); // resets streak
    e.apply({ type: 'HazardCleared', hazardId: 'h7', marginMs: 120 }, 420);
    expect(e.state.boredom).toBeCloseTo(0.5 + C.psych.streakBoredPerJump + C.psych.nearMiss.bored, 5);
  });

  it('near-miss spikes frustration, then relief pays out over 3 s', () => {
    const e = new HumanPsychologyEngine(neutral);
    e.state.frustration = 0.4;
    e.apply({ type: 'NearMiss', hazardId: 'h', marginMs: 30 }, 10);
    expect(e.state.frustration).toBeCloseTo(0.48, 5);
    expect(e.state.boredom).toBe(0);
    const frames = Math.round(C.psych.nearMiss.reliefMs / (1000 / 60));
    for (let i = 0; i < frames; i++) e.tick();
    const decay = C.frustDecayPerSec * (C.psych.nearMiss.reliefMs / 1000);
    expect(e.state.frustration).toBeCloseTo(0.48 + C.psych.nearMiss.reliefFrust - decay, 2);
  });

  it('tolerance grows in the channel and shrinks outside; abort names the dominant axis', () => {
    const e = new HumanPsychologyEngine(neutral);
    for (let i = 0; i < 60; i++) e.tick();
    expect(e.state.tolerance).toBe(100);
    e.state.tolerance = 50;
    e.state.boredom = 0.9;
    for (let i = 0; i < 60; i++) e.tick();
    expect(e.state.tolerance).toBeLessThan(50 - C.toleranceLossMinPerSec + 0.5);
    e.state.tolerance = 0;
    expect(e.abortReason()).toBe('ABORT_BORED');
  });
});
