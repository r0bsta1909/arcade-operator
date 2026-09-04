// Fake-game geometry sanity: every hazard is solvable, the timing window is
// what the config says, and a perfect guest survives. GDD 3, 2.2.
import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { FakeArcadeGame } from '../src/arcade/FakeArcadeGame';
import { ManipulationLayer } from '../src/arcade/ManipulationLayer';
import { slackForWindow, takeoffRange } from '../src/arcade/Physics';
import { SEGMENTS } from '../src/arcade/Segments';
import { SessionConfig as C } from '../src/session/SessionConfig';
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
    manip.arm('h');
    const merciful = takeoffRange(o, manip.slackFor('h'), 1)!;
    manip.veto('h'); // disarms
    manip.veto('h'); // hardens
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
      const jump = next !== undefined && next.framesUntilCritical <= 0.5 && game.hopper.mode === 'grounded';
      game.tick(jump ? { jump: true } : null);
    }
    expect(events.filter((e) => e.type === 'Death')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'SegmentCleared').length).toBeGreaterThanOrEqual(1);
    expect(game.victory).toBe(true);
    expect(game.score).toBeGreaterThanOrEqual(C.victoryScore);
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
