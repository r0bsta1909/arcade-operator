// Heat budget and overheat lock. GDD 2.1 / 2.2 (pulled into M1 after STOPP 2).
import { describe, expect, it } from 'vitest';
import { OVERHEAT_LOCK_FRAMES } from '../src/operator/HeatSystem';
import { SessionConfig as C } from '../src/session/SessionConfig';
import { SessionRunner } from '../src/session/SessionRunner';

/** Advance to PLAY and return the runner. */
function inPlay(seed = 5): SessionRunner {
  const r = new SessionRunner({ seed, buildHash: 'test' });
  while (r.states.state !== 'PLAY') r.step();
  return r;
}

describe('HeatSystem', () => {
  it('arming costs heat, heat decays', () => {
    const r = inPlay();
    const id = r.game.getUpcomingHazards(1)[0]!.id;
    r.step([{ action: 'arm', hazardId: id }]);
    expect(Math.round(r.heat.value)).toBe(C.heatArm);
    for (let i = 0; i < 60; i++) r.step();
    expect(r.heat.value).toBeCloseTo(C.heatArm - C.heatDecayPerSec, 0);
  });

  it('veto on an armed chip refunds nothing; hardening costs', () => {
    const r = inPlay();
    const id = r.game.getUpcomingHazards(1)[0]!.id;
    r.step([{ action: 'arm', hazardId: id }, { action: 'veto', hazardId: id }]);
    expect(Math.round(r.heat.value)).toBe(C.heatArm);
    r.step([{ action: 'veto', hazardId: id }]);
    expect(Math.round(r.heat.value)).toBe(C.heatArm + C.heatHarden);
    expect(r.manip.isHardened(id)).toBe(true);
  });

  it('reaching heatMax locks all interventions for 3 s, then releases', () => {
    const r = inPlay();
    const ids = r.game.getUpcomingHazards(3).map((h) => h.id);
    // arm, disarm, harden repeatedly on the three chips until the machine overheats
    let guard = 0;
    while (!r.heat.locked && guard++ < 40) {
      const id = ids[guard % ids.length]!;
      r.step([{ action: r.manip.isArmed(id) ? 'veto' : 'arm', hazardId: id }]);
    }
    expect(r.heat.locked).toBe(true);
    expect(r.log.filter('Overheat')).toHaveLength(1);
    const actionsBefore = r.log.filter('OperatorAction').length;
    // while locked: commands are ignored
    r.step([{ action: 'arm', hazardId: ids[2]! }]);
    expect(r.log.filter('OperatorAction').length).toBe(actionsBefore);
    for (let i = 0; i < OVERHEAT_LOCK_FRAMES; i++) r.step();
    expect(r.heat.locked).toBe(false);
    expect(r.log.filter('OverheatEnd')).toHaveLength(1);
    expect(r.heat.value).toBeLessThan(C.heatMax - C.heatDecayPerSec * 2);
  });

  it('retro mercy is refused while overheated', () => {
    const r = inPlay(3);
    // heat up to lock
    let guard = 0;
    while (!r.heat.locked && guard++ < 60) {
      const h = r.game.getUpcomingHazards(1)[0];
      if (!h) break;
      r.step([{ action: r.manip.isArmed(h.id) ? 'veto' : 'arm', hazardId: h.id }]);
    }
    expect(r.heat.locked).toBe(true);
    // run into the next death while still locked; hardened/armed chips keep the guest alive rarely, so loop
    while (!r.states.inDeathFreeze && r.heat.locked && !r.ended) r.step();
    if (r.states.inDeathFreeze && r.heat.locked) {
      r.step([{ action: 'retroMercy' }]);
      expect(r.log.filter('RetroMercy')).toHaveLength(0);
      expect(r.states.inDeathFreeze).toBe(true);
    }
  });
});
