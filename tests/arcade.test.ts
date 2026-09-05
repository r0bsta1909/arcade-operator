// Fake-game geometry sanity: every hazard is solvable, the timing window is
// what the config says, and a perfect guest survives. GDD 3, 2.2.
import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { FakeArcadeGame } from '../src/arcade/FakeArcadeGame';
import { ManipulationLayer } from '../src/arcade/ManipulationLayer';
import { slackForWindow, takeoffRange } from '../src/arcade/Physics';
import { SEGMENTS } from '../src/arcade/Segments';
import { SessionConfig as C } from '../src/session/SessionConfig';
import { SessionRunner } from '../src/session/SessionRunner';
import { normalCdf } from '../src/human/HumanAgent';
import type { Obstacle } from '../src/arcade/Obstacle';
import type { GameEvent } from '../src/session/events';

function obstacleFrom(seg: number, i: number): Obstacle {
  const h = SEGMENTS[seg]!.hazards[i]!;
  return {
    id: `S${seg}:${i}`,
    type: h.type,
    x: 500 + h.atMeter * C.pxPerMeter,
    width: h.width,
    height: h.type === 'crater' ? 0 : (h.height ?? 8),
    segment: seg,
    loop: 0,
    resolved: false,
  };
}

describe('physics / segments', () => {
  const base = slackForWindow(C.windowMs, C.scrollPxPerFrame);

  it('every hazard has a safe take-off range under the base window', () => {
    SEGMENTS.forEach((seg, s) => {
      seg.hazards.forEach((_, i) => {
        const r = takeoffRange(obstacleFrom(s, i), base, C.scrollPxPerFrame);
        expect(r, `${seg.name} #${i}`).not.toBeNull();
        expect(r!.widthMs).toBeGreaterThanOrEqual(C.windowMs - 20);
      });
    });
  });

  it('a 36 px crater has exactly the configured window as tolerance', () => {
    const o: Obstacle = { id: 'x', type: 'crater', x: 400, width: 36, height: 0, segment: 0, loop: 0, resolved: false };
    const r = takeoffRange(o, base, C.scrollPxPerFrame)!;
    expect(Math.abs(r.widthMs - C.windowMs)).toBeLessThanOrEqual(20);
  });

  it('mercy widens the range, hardening narrows it', () => {
    const bus = new EventBus();
    const manip = new ManipulationLayer(bus);
    const o: Obstacle = { id: 'h', type: 'crater', x: 400, width: 36, height: 0, segment: 0, loop: 0, resolved: false };
    const plain = takeoffRange(o, manip.slackFor('h'), 1)!;
    manip.grantMercy('h', 'perfect');
    const merciful = takeoffRange(o, manip.slackFor('h'), 1)!;
    manip.setWindow('h', C.hardenedWindowMs);
    const hard = takeoffRange(o, manip.slackFor('h'), 1)!;
    expect(merciful.widthMs).toBeGreaterThan(plain.widthMs + 100);
    expect(hard.widthMs).toBeLessThan(plain.widthMs);
  });

  it('a perfect guest clears two segments without dying', () => {
    const bus = new EventBus();
    const events: GameEvent[] = [];
    bus.onAny((e) => events.push(e));
    const game = new FakeArcadeGame(bus, new ManipulationLayer(bus));
    for (let f = 0; f < 60 * 45 && !game.victory; f++) {
      const next = game.getUpcomingHazards(1)[0];
      const jump = next !== undefined && Math.abs(next.framesUntilCritical) <= 0.5 && game.hopper.mode === 'grounded';
      game.tick(jump ? { jump: true } : null);
    }
    expect(events.filter((e) => e.type === 'Death')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'SegmentCleared').length).toBeGreaterThanOrEqual(1);
    expect(game.victory).toBe(true);
    expect(game.score).toBeGreaterThanOrEqual(C.victoryScore);
  });

  it('respawn gives the guest a full lead before the next hazard (STOPP 2: two lives at once)', () => {
    // Old code: hopper respawned 16 px before the previous worm and died 3 frames later in 40 % of respawns.
    let respawns = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = new SessionRunner({ seed, buildHash: 'test' });
      const ev = r.runToEnd(() => []).all();
      for (let i = 0; i < ev.length; i++) {
        if (ev[i]!.e.type !== 'Respawn') continue;
        respawns++;
        const death = ev.slice(i + 1).find((x) => x.e.type === 'Death');
        if (!death) continue;
        expect(death.f - ev[i]!.f, 'seed ' + seed + ' died ' + (death.f - ev[i]!.f) + ' frames after respawn').toBeGreaterThanOrEqual(60);
      }
    }
    expect(respawns).toBeGreaterThan(20);
  });

  it('a guest who never jumps dies at the first crater and can respawn', () => {
    const bus = new EventBus();
    const events: GameEvent[] = [];
    bus.onAny((e) => events.push(e));
    const game = new FakeArcadeGame(bus, new ManipulationLayer(bus));
    for (let f = 0; f < 600 && game.alive; f++) game.tick(null);
    const death = events.find((e) => e.type === 'Death');
    expect(death).toBeDefined();
    expect(game.lives).toBe(C.lives - 1);
    game.respawn();
    expect(game.alive).toBe(true);
    expect(events.at(-1)?.type).toBe('Respawn');
  });
});

describe('overlay risk band', () => {
  it('normalCdf is a sane CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it('death probability rises with frustration (wider band) and never contradicts the safe range', () => {
    const r = new SessionRunner({ seed: 11, profileId: 'casual', buildHash: 'test' });
    while (r.states.state !== 'PLAY') r.step();
    const h = r.game.getUpcomingHazards(1)[0]!;
    const calm = r.agent.jumpRisk(h, { frustration: 0, skill: 0.35 });
    const tilted = r.agent.jumpRisk(h, { frustration: 0.8, skill: 0.35 });
    const veteran = r.agent.jumpRisk(h, { frustration: 0, skill: 0.75 });
    expect(tilted.sigmaPx).toBeGreaterThan(calm.sigmaPx);
    expect(tilted.deathProbability).toBeGreaterThan(calm.deathProbability);
    expect(veteran.deathProbability).toBeLessThan(calm.deathProbability);
    expect(calm.safeMin).toBe(h.baseRange.min);
    expect(calm.safeMax).toBe(h.baseRange.max);
    expect(calm.expectedX).toBeGreaterThan(h.baseRange.min - 40);
  });
});

describe('machine view tells the truth (STOPP 2)', () => {
  it('the front chip verdict matches the actual outcome in every unmanipulated session', () => {
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = new SessionRunner({ seed, buildHash: 'test' });
      const verdictAt = new Map<string, 'safe' | 'dead'>();
      const outcome = new Map<string, 'safe' | 'dead'>();
      r.bus.on('Death', (e) => outcome.set(e.hazardId, 'dead'));
      r.bus.on('HazardCleared', (e) => outcome.set(e.hazardId, 'safe'));
      r.bus.on('Respawn', () => {
        verdictAt.clear();
        outcome.clear(); // hazards ahead re-activate with a fresh plan
      });
      while (!r.ended) {
        r.step();
        for (const [id, v] of r.verdicts()) if (!verdictAt.has(id)) verdictAt.set(id, v);
        for (const [id, v] of verdictAt) {
          const o = outcome.get(id);
          if (o) {
            expect(v, `seed ${seed} hazard ${id}`).toBe(o);
            verdictAt.delete(id);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('a good hit up on a doomed chip turns its verdict green', () => {
    for (let seed = 1; seed < 40; seed++) {
      const r = new SessionRunner({ seed, profileId: 'casual', buildHash: 'test' });
      let found = false;
      while (!r.ended && !found) {
        r.step();
        const next = r.game.getUpcomingHazards(1)[0];
        if (r.states.state === 'PLAY' && next && r.verdicts().get(next.id) === 'dead' && next.framesUntilCritical <= 6 && next.framesUntilCritical > 5) {
          r.step([{ action: 'hitUp' }]);
          const after = r.verdicts().get(next.id);
          if (after === 'safe') found = true;
          else break; // mercy could not save this one (too far off), try another seed
        }
      }
      if (found) return;
    }
    throw new Error('no seed where arming flipped a verdict');
  });
});
