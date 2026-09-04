// Headless balancing: passive / merciful / heuristic bots. GDD 5.4.
// Usage: bun tests/balance.sim.ts [--smoke] [--bots passive,merciful,heuristic] [--profiles casual,veteran] [--n 1000] [--seed 1] [--example]
// One row per bot x profile.
import { SessionRunner, type OperatorCommand } from '../src/session/SessionRunner';
import type { EndCause, EndReason } from '../src/session/events';
import { ACTIVE_PROFILES, type ProfileId } from '../src/human/Profiles';

type Bot = (r: SessionRunner) => OperatorCommand[];

const BOTS: Record<string, Bot> = {
  /** Never intervenes. */
  passive: () => [],
  /** Arms every chip once, always retro-vetoes. */
  merciful: (r) => {
    if (r.states.inDeathFreeze && r.msSinceDeath() >= 150) return [{ action: 'retroMercy' }];
    const next = r.game.getUpcomingHazards(1)[0];
    if (next && !r.manip.isArmed(next.id) && next.framesUntilCritical <= 60) return [{ action: 'arm', hazardId: next.id }];
    return [];
  },
  /** GDD 5.4: arms at jitter > 0.3 (of full scale) and suspicion < 40, hardens at boredom > 0.35. */
  heuristic: (r) => {
    const next = r.game.getUpcomingHazards(1)[0];
    if (!next || next.framesUntilCritical > 60) return [];
    const p = r.psyche.state;
    const jitter = p.jitter / 200;
    if (jitter > 0.3 && p.suspicion < 40 && !r.manip.isArmed(next.id)) return [{ action: 'arm', hazardId: next.id }];
    if (p.boredom > 0.35 && !r.manip.isHardened(next.id) && !r.manip.isArmed(next.id)) return [{ action: 'veto', hazardId: next.id }];
    return [];
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
  };
  for (let i = 0; i < n; i++) {
    const r = new SessionRunner({ seed: seed0 + i, profileId, buildHash: `sim-${name}` });
    const log = r.runToEnd(bot);
    const res = r.result!;
    if (res.reason === 'VICTORY') st.wins++;
    st.reasons[res.reason]++;
    st.causes[res.cause]++;
    st.durations.push(res.durationMs / 1000);
    st.scores.push(res.score);
    st.deaths.push(log.filter('Death').length);
    st.mercies.push(log.filter('MercyApplied').length + log.filter('RetroMercy').length);
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
  const head = '| Bot / Profil | n | Sieg | Frust-Abbruch | Langeweile-Abbruch | Verdachts-Abbruch | davon Leben weg | Dauer Ø / Median (s) | Score Ø | Tode Ø | Gnaden Ø |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|';
  const lines = rows.map(([name, s]) =>
    `| ${name} | ${s.n} | ${pct(s.wins, s.n)} | ${pct(s.reasons.ABORT_FRUST, s.n)} | ${pct(s.reasons.ABORT_BORED, s.n)} | ${pct(s.reasons.ABORT_SUSPECT, s.n)} | ${pct(s.causes.lives, s.n)} | ${mean(s.durations).toFixed(0)} / ${median(s.durations).toFixed(0)} | ${mean(s.scores).toFixed(0)} | ${mean(s.deaths).toFixed(1)} | ${mean(s.mercies).toFixed(1)} |`,
  );
  return [head, sep, ...lines].join('\n');
}

function exampleSession(seed: number): string {
  const r = new SessionRunner({ seed, buildHash: 'sim-example' });
  r.runToEnd(BOTS['passive']!);
  const skip = new Set(['PsycheSample', 'HazardCleared', 'Jump']);
  const lines = r.log
    .all()
    .filter((e) => !skip.has(e.e.type))
    .map((e) => `${(e.f / 60).toFixed(1).padStart(6)} s  ${JSON.stringify(e.e)}`);
  return `Seed ${seed}, Profil ${r.profileId}, Ende ${r.result!.reason} (${r.result!.cause}), Score ${r.result!.score}\n${lines.join('\n')}`;
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
const botNames = (flag('--bots') ?? (smoke ? 'passive' : 'passive,merciful,heuristic')).split(',');
const profiles = (flag('--profiles')?.split(',') ?? ACTIVE_PROFILES) as ProfileId[];

const t0 = Date.now();
const rows: Array<[string, Stats]> = botNames.flatMap((b) => {
  const bot = BOTS[b];
  if (!bot) throw new Error(`unknown bot ${b}`);
  return profiles.map((pr): [string, Stats] => [`${b} / ${pr}`, runBot(b, bot, n, seed0, pr)]);
});
console.log(table(rows));
console.log(`\n${n} Sessions/Bot in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (args.includes('--example')) console.log(`\n${exampleSession(seed0)}`);
