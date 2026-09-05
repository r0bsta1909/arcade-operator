// Timed hits: judgement windows, effects, combo, score. GDD 2.2 / 2.6 (after STOPP 2).
import { describe, expect, it } from 'vitest';
import { SessionConfig as C } from '../src/session/SessionConfig';
import { SessionRunner } from '../src/session/SessionRunner';

function inPlay(seed: number, profileId: 'casual' | 'veteran' = 'casual'): SessionRunner {
  const r = new SessionRunner({ seed, profileId, buildHash: 'test' });
  while (r.states.state !== 'PLAY') r.step();
  return r;
}

/** Step until the front chip is `framesBefore` frames before its critical frame. Returns false if the session ended. */
function stepToOffset(r: SessionRunner, framesBefore: number, predicate: (id: string) => boolean = () => true): boolean {
  for (let guard = 0; guard < 6000 && !r.ended; guard++) {
    const next = r.game.getUpcomingHazards(1)[0];
    if (r.states.state === 'PLAY' && next && predicate(next.id) && next.framesUntilCritical <= framesBefore + 0.5 && next.framesUntilCritical > framesBefore - 0.5) return true;
    r.step();
  }
  return false;
}

describe('judgement windows', () => {
  it('maps offsets to perfect / good / miss', () => {
    expect(SessionRunner.judge(0)).toBe('perfect');
    expect(SessionRunner.judge(-C.hit.perfectMs)).toBe('perfect');
    expect(SessionRunner.judge(C.hit.perfectMs + 1)).toBe('good');
    expect(SessionRunner.judge(-C.hit.goodMs)).toBe('good');
    expect(SessionRunner.judge(C.hit.goodMs + 1)).toBe('miss');
  });

  it('a hit 6 frames early is GOOD, 12 frames early is MISS', () => {
    const r = inPlay(3);
    expect(stepToOffset(r, 6)).toBe(true);
    r.step([{ action: 'hitUp' }]);
    expect(r.log.filter('OperatorAction').at(-1)!.e.judgement).toBe('good');
    const r2 = inPlay(3);
    expect(stepToOffset(r2, 12)).toBe(true);
    r2.step([{ action: 'hitUp' }]);
    expect(r2.log.filter('OperatorAction').at(-1)!.e.judgement).toBe('miss');
  });

  it('a swipe up in the death freeze is LATE and revives; a swipe down is a miss', () => {
    const r = inPlay(3);
    while (!r.states.inDeathFreeze && !r.ended) r.step();
    expect(r.states.inDeathFreeze).toBe(true);
    const lives = r.game.lives;
    r.step([{ action: 'hitDown' }]);
    expect(r.log.filter('OperatorAction').at(-1)!.e.judgement).toBe('miss');
    expect(r.states.inDeathFreeze).toBe(true);
    r.step([{ action: 'hitUp' }]);
    const a = r.log.filter('OperatorAction').at(-1)!.e;
    expect(a.judgement).toBe('late');
    expect(a.effect).toBe('revived');
    expect(r.game.lives).toBe(lives + 1);
    expect(r.states.state).toBe('PLAY');
  });
});

describe('effects', () => {
  it('a perfect hit up on a doomed chip saves the guest and is nearly invisible (+3 suspicion)', () => {
    let saved = 0;
    for (let seed = 1; seed <= 30 && saved < 3; seed++) {
      const r = inPlay(seed);
      if (!stepToOffset(r, 0, (id) => r.verdicts().get(id) === 'dead')) continue;
      const id = r.game.getUpcomingHazards(1)[0]!.id;
      r.step([{ action: 'hitUp' }]);
      const a = r.log.filter('OperatorAction').at(-1)!.e;
      expect(a.judgement).toBe('perfect');
      expect(a.effect).toBe('mercy');
      expect(r.verdicts().get(id)).toBe('safe');
      const before = r.psyche.state.suspicion;
      while (!r.ended && r.game.getUpcomingHazards(1)[0]?.id === id) r.step();
      const mercy = r.log.filter('MercyApplied').find((m) => m.e.hazardId === id);
      expect(mercy?.e.judgement).toBe('perfect');
      expect(r.log.filter('Death').some((d) => d.e.hazardId === id)).toBe(false);
      expect(r.psyche.state.suspicion - before).toBeLessThanOrEqual(C.suspicion.mercyLow + 0.01);
      saved++;
    }
    expect(saved).toBeGreaterThan(0);
  });

  it('a perfect hit down on a safe chip produces a felt near-miss and never a death (veteran)', () => {
    let trimmed = 0;
    for (let seed = 1; seed <= 40 && trimmed < 5; seed++) {
      const r = inPlay(seed, 'veteran');
      if (!stepToOffset(r, 0, (id) => r.verdicts().get(id) === 'safe')) continue;
      const id = r.game.getUpcomingHazards(1)[0]!.id;
      r.step([{ action: 'hitDown' }]);
      const a = r.log.filter('OperatorAction').at(-1)!.e;
      expect(a.judgement).toBe('perfect');
      expect(a.effect).toBe('harden');
      expect(r.manip.isHardened(id)).toBe(true);
      expect(r.verdicts().get(id)).toBe('safe');
      const frustBefore = r.psyche.state.frustration;
      while (!r.ended && r.game.getUpcomingHazards(1)[0]?.id === id) r.step();
      expect(r.log.filter('Death').some((d) => d.e.hazardId === id)).toBe(false);
      const cleared = r.log.filter('HazardCleared').find((h) => h.e.hazardId === id)!;
      expect(cleared.e.marginMs).toBeLessThanOrEqual(C.harden.perfectMarginMs + 17);
      // felt near-miss: frustration spiked (+0.08 * frustMult) instead of a boredom streak step
      expect(r.psyche.state.frustration).toBeGreaterThan(frustBefore);
      trimmed++;
    }
    expect(trimmed).toBeGreaterThan(0);
  });
});

describe('combo and operator score', () => {
  it('needed hits grow the combo, a miss resets it, multiplier steps every 5', () => {
    const r = inPlay(2);
    let hits = 0;
    while (!r.ended && hits < 7) {
      if (!stepToOffset(r, 0, (id) => r.verdicts().get(id) === 'dead')) break;
      r.step([{ action: 'hitUp' }]);
      hits++;
      if (r.heat.locked) break;
    }
    expect(r.combo).toBeGreaterThanOrEqual(1);
    const combos = r.log.filter('Combo').map((c) => c.e);
    expect(combos.some((c) => c.value >= C.combo.step && c.multiplier === 2) || r.combo < C.combo.step).toBe(true);
    expect(r.operatorScore).toBeGreaterThan(0);
    // now a deliberate miss
    if (!r.ended && stepToOffset(r, 20)) {
      r.step([{ action: 'hitDown' }]);
      expect(r.combo).toBe(0);
      expect(r.log.filter('Combo').at(-1)!.e.value).toBe(0);
    }
  });

  it('a wasted mercy (chip was safe) scores but does not grow the combo', () => {
    const r = inPlay(4, 'veteran');
    expect(stepToOffset(r, 0, (id) => r.verdicts().get(id) === 'safe')).toBe(true);
    const comboBefore = r.combo;
    const scoreBefore = r.operatorScore;
    r.step([{ action: 'hitUp' }]);
    const a = r.log.filter('OperatorAction').at(-1)!.e;
    expect(a.effect).toBe('mercyWasted');
    expect(r.combo).toBe(comboBefore);
    expect(r.operatorScore).toBeGreaterThan(scoreBefore);
  });

  it('tempo ramps with cleared segments up to the cap', () => {
    const r = new SessionRunner({ seed: 1, profileId: 'veteran', buildHash: 'test' });
    expect(r.tempo()).toBe(C.tempo.start);
    r.segmentsCleared = 2;
    expect(r.tempo()).toBeCloseTo(C.tempo.start + 2 * C.tempo.perSegment, 5);
    r.segmentsCleared = 99;
    expect(r.tempo()).toBe(C.tempo.max);
  });
});
