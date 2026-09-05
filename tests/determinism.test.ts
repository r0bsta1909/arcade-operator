// Same seed + same operator inputs => identical SessionLog hash. Sacred (CLAUDE.md).
// GDD 5.1. Runs the real SessionRunner with a scripted operator.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/Rng';
import { SessionLog } from '../src/session/SessionLog';
import { SessionRunner, type OperatorCommand } from '../src/session/SessionRunner';

interface ScriptedInput extends OperatorCommand {
  frame: number;
}

/** 'front' resolves to the front chip at that frame; still a pure function of (seed, script). */
function run(seed: number, script: readonly ScriptedInput[]): SessionLog {
  const runner = new SessionRunner({ seed, buildHash: 'test' });
  return runner.runToEnd((r) =>
    script
      .filter((s) => s.frame === r.frame)
      .map((s) => (s.hazardId === 'front' ? { ...s, hazardId: r.game.getUpcomingHazards(1)[0]?.id ?? 'none' } : s)),
  );
}

/** Operator that arms the front chip every 90 frames and always vetoes death. Deterministic by construction. */
function reactivePolicy(r: SessionRunner): OperatorCommand[] {
  if (r.states.inDeathFreeze && r.msSinceDeath() >= 200) return [{ action: 'retroMercy' }];
  const next = r.game.getUpcomingHazards(1)[0];
  if (r.frame % 90 === 0 && next) return [{ action: 'arm', hazardId: next.id }];
  return [];
}

// Frames chosen so every command targets a hazard that is upcoming at that time (PLAY starts at frame 61).
const script: ScriptedInput[] = [
  { frame: 70, action: 'arm', hazardId: 'front' },
  { frame: 75, action: 'veto', hazardId: 'front' },
  { frame: 400, action: 'arm', hazardId: 'front' },
  { frame: 403, action: 'veto', hazardId: 'front' },
];

describe('determinism', () => {
  it('same seed + same scripted inputs => identical log hash', () => {
    const a = run(1234, script);
    const b = run(1234, script);
    expect(a.length).toBeGreaterThan(20);
    expect(a.filter('OperatorAction').length).toBeGreaterThanOrEqual(2); // some frames may fall into a freeze
    expect(a.hash()).toBe(b.hash());
    expect(JSON.stringify(a.toJSON())).toBe(JSON.stringify(b.toJSON()));
  });

  it('same seed + same reactive policy => identical log hash', () => {
    const a = new SessionRunner({ seed: 99, buildHash: 'test' }).runToEnd(reactivePolicy);
    const b = new SessionRunner({ seed: 99, buildHash: 'test' }).runToEnd(reactivePolicy);
    expect(a.hash()).toBe(b.hash());
    expect(a.filter('OperatorAction').length).toBeGreaterThan(0);
  });

  it('different seed => different hash', () => {
    expect(run(1234, script).hash()).not.toBe(run(4321, script).hash());
  });

  it('different inputs => different hash', () => {
    expect(run(1234, script).hash()).not.toBe(run(1234, []).hash());
    const passive = new SessionRunner({ seed: 99, buildHash: 'test' }).runToEnd(() => []);
    const reactive = new SessionRunner({ seed: 99, buildHash: 'test' }).runToEnd(reactivePolicy);
    expect(passive.hash()).not.toBe(reactive.hash());
  });

  it('every session ends with exactly one SessionEnd', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const log = run(seed, []);
      expect(log.filter('SessionEnd')).toHaveLength(1);
    }
  });

  it('measurement events (latency, CRT touch) do not change the hash', () => {
    const a = run(7, script);
    const b = run(7, script);
    b.append(500, { type: 'LatencySample', ms: 312 });
    b.append(600, { type: 'CrtTouch', x: 0.4, y: 0.5 });
    expect(b.hash()).toBe(a.hash());
    expect(b.length).toBe(a.length + 2);
  });

  it('log survives a JSON round trip', () => {
    const a = run(7, script);
    const b = SessionLog.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
    expect(b.hash()).toBe(a.hash());
  });

  it('Rng forks are independent and stable', () => {
    const r = new Rng(42);
    const seq = (label: string) => Array.from({ length: 5 }, () => r.fork(label).next());
    expect(seq('human')).toEqual(seq('human'));
    expect(seq('human')).not.toEqual(seq('world'));
    const g = new Rng(42).fork('human');
    const draws = Array.from({ length: 2000 }, () => g.gaussian(0, 1));
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });
});
