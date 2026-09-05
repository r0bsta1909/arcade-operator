// Heat budget and overheat lock. GDD 2.1 / 2.2 (pulled into M1 after STOPP 2).
import { describe, expect, it } from 'vitest';
import { OVERHEAT_LOCK_FRAMES } from '../src/operator/HeatSystem';
import { SessionConfig as C } from '../src/session/SessionConfig';
import { SessionRunner, type OperatorCommand } from '../src/session/SessionRunner';

/** Advance to PLAY and return the runner. */
function inPlay(seed = 5): SessionRunner {
  const r = new SessionRunner({ seed, buildHash: 'test' });
  while (r.states.state !== 'PLAY') r.step();
  return r;
}

/** Step until the front chip is at its critical frame, then apply the command (=> PERFECT). */
function hitOnLine(r: SessionRunner, action: OperatorCommand['action']): void {
  for (let guard = 0; guard < 600; guard++) {
    const next = r.game.getUpcomingHazards(1)[0];
    if (next && next.framesUntilCritical <= 0.5 && next.framesUntilCritical > -0.5 && r.states.state === 'PLAY') {
      r.step([{ action }]);
      return;
    }
    r.step();
  }
  throw new Error('no chip reached the line');
}

describe('HeatSystem', () => {
  it('a perfect hit costs 10, heat decays 5/s', () => {
    const r = inPlay();
    hitOnLine(r, 'hitUp');
    const last = r.log.filter('OperatorAction').at(-1)!.e;
    expect(last.judgement).toBe('perfect');
    expect(Math.round(r.heat.value)).toBe(C.heat.perfect);
    for (let i = 0; i < 60; i++) r.step();
    expect(r.heat.value).toBeCloseTo(C.heat.perfect - C.heat.decayPerSec, 0);
  });

  it('a miss still costs heat', () => {
    const r = inPlay();
    // far from any critical frame: next chip at least 20 frames away
    for (let guard = 0; guard < 600; guard++) {
      const next = r.game.getUpcomingHazards(1)[0];
      if (next && next.framesUntilCritical > 20) break;
      r.step();
    }
    r.step([{ action: 'hitDown' }]);
    expect(r.log.filter('OperatorAction').at(-1)!.e.judgement).toBe('miss');
    expect(Math.round(r.heat.value)).toBe(C.heat.miss);
  });

  it('reaching heatMax locks all interventions, then releases', () => {
    const r = inPlay();
    let guard = 0;
    while (!r.heat.locked && guard++ < 60) r.step([{ action: 'hitUp' }, { action: 'hitDown' }]);
    expect(r.heat.locked).toBe(true);
    expect(r.log.filter('Overheat')).toHaveLength(1);
    const actionsBefore = r.log.filter('OperatorAction').length;
    r.step([{ action: 'hitUp' }]);
    expect(r.log.filter('OperatorAction').length).toBe(actionsBefore);
    for (let i = 0; i < OVERHEAT_LOCK_FRAMES; i++) r.step();
    expect(r.heat.locked).toBe(false);
    expect(r.log.filter('OverheatEnd')).toHaveLength(1);
  });
});
