// Same seed + same operator inputs => identical SessionLog hash. Sacred (CLAUDE.md).
// GDD 5.1. Step 2: runs against a dummy tick; step 4 switches to SessionRunner.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/Rng';
import { EventBus } from '../src/core/EventBus';
import { SessionLog } from '../src/session/SessionLog';
import { configHash } from '../src/session/SessionConfig';
import type { OperatorActionKind } from '../src/session/events';

interface ScriptedInput {
  frame: number;
  action: OperatorActionKind;
  hazardId?: string;
}

/** Placeholder simulation until FakeArcadeGame/HumanAgent exist (step 4). */
function runDummy(seed: number, script: ScriptedInput[], frames = 600): SessionLog {
  const rng = new Rng(seed).fork('world');
  const bus = new EventBus();
  const log = new SessionLog({ version: 1, seed, profileId: 'casual', buildHash: 'test', configHash: configHash() });
  let frame = 0;
  bus.onAny((e) => log.append(frame, e));
  let cursor = 0;
  for (frame = 1; frame <= frames; frame++) {
    while (cursor < script.length && script[cursor]!.frame === frame) {
      const s = script[cursor++]!;
      bus.emit(s.hazardId ? { type: 'OperatorAction', action: s.action, hazardId: s.hazardId } : { type: 'OperatorAction', action: s.action });
    }
    if (rng.next() < 0.02) bus.emit({ type: 'NearMiss', hazardId: `h${frame}`, marginMs: Math.round(rng.range(0, 60)) });
  }
  return log;
}

const script: ScriptedInput[] = [
  { frame: 30, action: 'arm', hazardId: 'seg0:1' },
  { frame: 200, action: 'veto', hazardId: 'seg0:3' },
  { frame: 450, action: 'retroMercy' },
];

describe('determinism', () => {
  it('same seed + same inputs => identical log hash', () => {
    const a = runDummy(1234, script);
    const b = runDummy(1234, script);
    expect(a.length).toBeGreaterThan(3);
    expect(a.hash()).toBe(b.hash());
    expect(JSON.stringify(a.toJSON())).toBe(JSON.stringify(b.toJSON()));
  });

  it('different seed => different hash', () => {
    expect(runDummy(1234, script).hash()).not.toBe(runDummy(4321, script).hash());
  });

  it('different inputs => different hash', () => {
    expect(runDummy(1234, script).hash()).not.toBe(runDummy(1234, script.slice(1)).hash());
  });

  it('log survives a JSON round trip', () => {
    const a = runDummy(7, script);
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
