// Headless balancing with timed-hit bots. GDD 5.4 (bots re-defined after STOPP 2).
// Usage: bun tests/balance.sim.ts [--smoke] [--bots passive,perfect,sloppy,oracle] [--profiles casual,veteran] [--n 1000] [--seed 1] [--example]
// One row per bot x profile.
import { SessionRunner, type OperatorCommand } from '../src/session/SessionRunner';
import type { EndCause, EndReason } from '../src/session/events';
import { ACTIVE_PROFILES, type ProfileId } from '../src/human/Profiles';

type Policy = (r: SessionRunner) => OperatorCommand[];
/** A bot is created per session so it can keep per-session memory (which chips it already hit). */
type Bot = () => Policy;

/** True on the one frame the front chip crosses the line, shifted by `offsetFrames` (positive = late). */
function onLine(r: SessionRunner, offsetFrames: number, seen: Set<string>): string | null {
  const next = r.game.getUpcomingHazards(1)[0];
  if (!next || seen.has(next.id)) return null;
  const f = next.framesUntilCritical + offsetFrames;
  if (f > 0.5 || f <= -0.5) return null;
  seen.add(next.id);
  return next.id;
}

const BOTS: Record<string, Bot> = {
  /** Never intervenes. */
  passive: () => () => [],
  /** Hits up PERFECT on every chip, always retro-vetoes: measures whether heat alone stops mercy spam. */
  perfect: () => {
    const seen = new Set<string>();
    return (r) => {
      if (r.states.inDeathFreeze && r.msSinceDeath() >= 150) return [{ action: 'hitUp' }];
      return onLine(r, 0, seen) ? [{ action: 'hitUp' }] : [];
    };
  },
  /** Hits up on every chip 7 frames late (+117 ms = GOOD): measures whether suspicion stops sloppy spam. */
  sloppy: () => {
    const seen = new Set<string>();
    return (r) => {
      if (r.states.inDeathFreeze && r.msSinceDeath() >= 250) return [{ action: 'hitUp' }];
      return onLine(r, -7, seen) ? [{ action: 'hitUp' }] : [];
    };
  },
  /** What a human with the truth display does: hit up only on doomed chips (offset alternates 0 / +6 frames), hit down PERFECT when the guest is bored, keep suspicion under 60. */
  oracle: () => {
    const seen = new Set<string>();
    let n = 0;
    return (r) => {
      if (r.states.inDeathFreeze && r.msSinceDeath() >= 150 && r.psyche.state.suspicion < 60) return [{ action: 'hitUp' }];
      const next = r.game.getUpcomingHazards(1)[0];
      if (!next) return [];
      const v = r.verdicts().get(next.id);
      const offset = n % 2 === 0 ? 0 : -6;
      if (v === 'dead' && r.psyche.state.suspicion < 60) {
        if (onLine(r, offset, seen)) {
          n++;
          return [{ action: 'hitUp' }];
        }
        return [];
      }
      if (v === 'safe' && r.psyche.state.boredom > 0.3 && onLine(r, 0, seen)) {
        n++;
        return [{ action: 'hitDown' }];
      }
      return [];
    };
  },
};

interface Stats {
  n: number;
  wins: number;
  reasons: Record<EndReason, number>;
  causes: Record<EndCause, number>;
  durations: number[];
  scores: number[];
  deaths: number[];
  mercies: number[];
  maxCombo: number[];
  opScore: number[];
  judgements: Record<string, number>;
}

function runBot(name: string, bot: Bot, n: number, seed0: number, profileId: ProfileId): Stats {
  const st: Stats = {
    n,
    wins: 0,
    reasons: { VICTORY: 0, ABORT_FRUST: 0, ABORT_BORED: 0, ABORT_SUSPECT: 0 },
    causes: { tolerance: 0, lives: 0, highscore: 0, suspicion: 0 },
    durations: [],
    scores: [],
    deaths: [],
    mercies: [],
    maxCombo: [],
    opScore: [],
    judgements: { perfect: 0, good: 0, late: 0, miss: 0 },
  };
  for (let i = 0; i < n; i++) {
    const r = new SessionRunner({ seed: seed0 + i, profileId, buildHash: `sim-${name}` });
    const log = r.runToEnd(bot());
    const res = r.result!;
    if (res.reason === 'VICTORY') st.wins++;
    st.reasons[res.reason]++;
    st.causes[res.cause]++;
    st.durations.push(res.durationMs / 1000);
    st.scores.push(res.score);
    st.deaths.push(log.filter('Death').length);
    st.mercies.push(log.filter('MercyApplied').length + log.filter('RetroMercy').length);
    st.maxCombo.push(r.maxCombo);
    st.opScore.push(r.operatorScore);
    for (const a of log.filter('OperatorAction')) st.judgements[a.e.judgement] = (st.judgements[a.e.judgement] ?? 0) + 1;
  }
  return st;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number, n: number) => `${((100 * x) / n).toFixed(0)} %`;

function table(rows: Array<[string, Stats]>): string {
  const head = '| Bot / Profil | n | Sieg | Frust | Langeweile | Verdacht | Leben weg | Dauer Ø / Median (s) | Score Ø | Tode Ø | Gnaden Ø | Combo max Ø | Op-Score Ø |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const lines = rows.map(([name, s]) =>
    `| ${name} | ${s.n} | ${pct(s.wins, s.n)} | ${pct(s.reasons.ABORT_FRUST, s.n)} | ${pct(s.reasons.ABORT_BORED, s.n)} | ${pct(s.reasons.ABORT_SUSPECT, s.n)} | ${pct(s.causes.lives, s.n)} | ${mean(s.durations).toFixed(0)} / ${median(s.durations).toFixed(0)} | ${mean(s.scores).toFixed(0)} | ${mean(s.deaths).toFixed(1)} | ${mean(s.mercies).toFixed(1)} | ${mean(s.maxCombo).toFixed(1)} | ${mean(s.opScore).toFixed(0)} |`,
  );
  return [head, sep, ...lines].join('\n');
}

function exampleSession(seed: number): string {
  const r = new SessionRunner({ seed, buildHash: 'sim-example' });
  r.runToEnd(BOTS['oracle']!());
  const skip = new Set(['PsycheSample', 'HazardCleared', 'Jump', 'Heat']);
  const lines = r.log
    .all()
    .filter((e) => !skip.has(e.e.type))
    .map((e) => `${(e.f / 60).toFixed(1).padStart(6)} s  ${JSON.stringify(e.e)}`);
  return `Seed ${seed}, Profil ${r.profileId}, Ende ${r.result!.reason} (${r.result!.cause}), Score ${r.result!.score}, Op-Score ${r.operatorScore}, Combo max ${r.maxCombo}\n${lines.join('\n')}`;
}

// ------------------------------------------------------------------ main
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const smoke = args.includes('--smoke');
const n = Number(flag('--n') ?? (smoke ? 50 : 1000));
const seed0 = Number(flag('--seed') ?? 1);
const botNames = (flag('--bots') ?? (smoke ? 'passive' : 'passive,perfect,sloppy,oracle')).split(',');
const profiles = (flag('--profiles')?.split(',') ?? ACTIVE_PROFILES) as ProfileId[];

const t0 = Date.now();
const rows: Array<[string, Stats]> = botNames.flatMap((b) => {
  const bot = BOTS[b];
  if (!bot) throw new Error(`unknown bot ${b}`);
  return profiles.map((pr): [string, Stats] => [`${b} / ${pr}`, runBot(b, bot, n, seed0, pr)]);
});
console.log(table(rows));
console.log(`\n${n} Sessions/Zeile in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (args.includes('--example')) console.log(`\n${exampleSession(seed0)}`);
