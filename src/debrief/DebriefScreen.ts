// Post-session curves, markers, profile reveal, feedback button. GDD 2.6.
// M1 minimal: frustration + boredom polylines from PsycheSample entries,
// channel band, markers for deaths and mercies, "Nochmal" and "Feedback".
import { PROFILES, type ProfileId } from '../human/Profiles';
import { de } from '../i18n/de';
import { SessionConfig as C } from '../session/SessionConfig';
import type { SessionLog } from '../session/SessionLog';
import type { SessionResult } from '../session/SessionRunner';

const W = 600;
const H = 220;
const PAD = 8;

export interface DebriefActions {
  onAgain: () => void;
  onFeedback: () => void;
}

export class DebriefScreen {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement, private readonly actions: DebriefActions) {
    this.root = document.createElement('div');
    this.root.className = 'screen debrief';
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(log: SessionLog, result: SessionResult, profileId: ProfileId, buildHash: string): void {
    const samples = log.filter('PsycheSample');
    const lastFrame = Math.max(1, log.all().at(-1)?.f ?? 1);
    const x = (f: number) => PAD + ((W - 2 * PAD) * f) / lastFrame;
    const y = (v: number) => PAD + (H - 2 * PAD) * (1 - v);
    const poly = (key: 'frustration' | 'boredom' | 'suspicion', scale = 1) =>
      samples.map((s) => `${x(s.f).toFixed(1)},${y(s.e[key] / scale).toFixed(1)}`).join(' ');

    const deaths = log.filter('Death').map((d) => `<circle cx="${x(d.f).toFixed(1)}" cy="${y(0.98).toFixed(1)}" r="5" fill="#ff3b3b"><title>${de.debrief.legendDeath} ${d.e.deltaMs} ms</title></circle>`);
    const mercies = [...log.filter('MercyApplied'), ...log.filter('RetroMercy')].map(
      (m) => `<rect x="${(x(m.f) - 4).toFixed(1)}" y="${(y(0.9) - 4).toFixed(1)}" width="8" height="8" fill="#00e5ff"><title>${de.debrief.legendMercy}</title></rect>`,
    );
    const deathsCount = log.filter('Death').length;
    let streak = 0;
    let longestStreak = 0;
    for (const e of log.all()) {
      if (e.e.type === 'HazardCleared' && e.e.marginMs >= C.nearMissMs) longestStreak = Math.max(longestStreak, ++streak);
      else if (e.e.type === 'HazardCleared' || e.e.type === 'Death') streak = 0;
    }
    const hint =
      profileId === 'casual' || profileId === 'tilter' ? de.debrief.profileHint[profileId](deathsCount) : de.debrief.profileHint[profileId](longestStreak);
    const actions = log.filter('OperatorAction').map((a) => a.e);
    const judgeCounts = { perfect: 0, good: 0, late: 0, miss: 0 };
    for (const a of actions) judgeCounts[a.judgement]++;
    const maxCombo = Math.max(0, ...log.filter('Combo').map((c) => c.e.value));
    const opScore = log.filter('OperatorScore').at(-1)?.e.value ?? 0;
    const inChannel = samples.length
      ? Math.round((100 * samples.filter((s) => s.e.frustration < C.channelFrustMax && s.e.boredom < C.channelBoredMax).length) / samples.length)
      : 0;

    const outcome =
      result.reason === 'VICTORY'
        ? de.debrief.victory
        : result.reason === 'ABORT_FRUST'
          ? de.debrief.abortFrust
          : result.reason === 'ABORT_BORED'
            ? de.debrief.abortBored
            : de.debrief.abortSuspect;

    this.root.innerHTML = `
      <h1>${de.debrief.title}</h1>
      <p>${outcome}${result.cause === 'lives' ? ` ${de.debrief.livesGone}` : ''}</p>
      <p>${de.debrief.score(result.score)} · ${de.debrief.inChannel(inChannel)} · ${de.debrief.profile(PROFILES[profileId].label)}</p>
      <p>${hint}</p>
      <p>${de.debrief.opScore(opScore)} · ${de.debrief.maxCombo(maxCombo)} · ${de.debrief.judgementLegend}: PERFECT ${judgeCounts.perfect} / GOOD ${judgeCounts.good} / LATE ${judgeCounts.late} / MISS ${judgeCounts.miss}</p>
      <svg class="debrief-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <rect x="${PAD}" y="${y(C.channelFrustMax).toFixed(1)}" width="${W - 2 * PAD}" height="${(y(0) - y(C.channelFrustMax)).toFixed(1)}" fill="rgba(61,220,132,0.12)"/>
        <line x1="${PAD}" y1="${y(C.channelFrustMax).toFixed(1)}" x2="${W - PAD}" y2="${y(C.channelFrustMax).toFixed(1)}" stroke="#3ddc84" stroke-dasharray="4 4"/>
        <polyline points="${poly('frustration')}" fill="none" stroke="#ff3b3b" stroke-width="2"/>
        <polyline points="${poly('boredom')}" fill="none" stroke="#4da3ff" stroke-width="2"/>
        <polyline points="${poly('suspicion', 100)}" fill="none" stroke="#ffb300" stroke-width="2" stroke-dasharray="3 3"/>
        ${deaths.join('')}${mercies.join('')}
      </svg>
      <div class="debrief-legend">
        <span><i class="legend-swatch" style="background:#ff3b3b"></i>${de.debrief.legendFrust}</span>
        <span><i class="legend-swatch" style="background:#4da3ff"></i>${de.debrief.legendBored}</span>
        <span><i class="legend-swatch" style="background:#ffb300"></i>${de.debrief.legendSuspect}</span>
        <span><i class="legend-swatch" style="background:#ff3b3b;border-radius:50%"></i>${de.debrief.legendDeath}</span>
        <span><i class="legend-swatch" style="background:#00e5ff"></i>${de.debrief.legendMercy}</span>
      </div>
      <div class="debrief-actions">
        <button class="btn primary again">${de.debrief.again}</button>
        <button class="btn feedback">${de.debrief.feedback}</button>
      </div>
      <div class="debrief-build">${de.debrief.build(buildHash)} · seed ${log.header.seed}</div>`;
    this.root.querySelector('button.again')!.addEventListener('click', () => this.actions.onAgain());
    this.root.querySelector('button.feedback')!.addEventListener('click', () => this.actions.onFeedback());
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
