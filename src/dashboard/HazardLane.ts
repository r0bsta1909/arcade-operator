// Chips bound to hazard ids; the only gesture zone. GDD 2.2, 4.1.
// Pure view: reads HazardView[] + manipulation state each frame and moves DOM
// chips with CSS transforms. Never mutates simulation state.
//
// Feedback added after the first device test (M1 STOPP 2): a resolved chip
// stays in the contact zone for a moment and shows its outcome, and every
// accepted operator action flashes over the lane.
import type { HazardView } from '../arcade/FakeArcadeGame';
import type { ManipulationLayer } from '../arcade/ManipulationLayer';
import { de } from '../i18n/de';
import { SessionConfig as C } from '../session/SessionConfig';
import type { GameEventOf } from '../session/events';

const CHIP_GLYPH: Record<HazardView['type'], string> = { crater: '○', worm: '◆', probe: '▲', meteor: '●' };
/** How long a resolved chip stays visible with its outcome. */
const OUTCOME_MS = 1400;
/** How long the action flash stays on the lane. */
const FLASH_MS = 300;
/** How long the judgement text stays at the line. */
const JUDGE_MS = 550;

export type ChipOutcome = keyof typeof de.lane.outcome;

export interface LaneOverheat {
  msLeft: number;
}

export interface LaneFreeze {
  /** 0..1 elapsed share of the death freeze. */
  progress: number;
}

export class HazardLane {
  readonly root: HTMLElement;
  private readonly track: HTMLElement;
  private readonly freezeBar: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly overheat: HTMLElement;
  private readonly judge: HTMLElement;
  private readonly judgeText: HTMLElement;
  private readonly judgeEffect: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly comboEl: HTMLElement;
  private judgeTimer = 0;
  private chips = new Map<string, HTMLElement>();
  private outcomes = new Map<string, { until: number }>();
  private ids: string[] = [];
  private flashTimer = 0;

  constructor(container: HTMLElement) {
    this.root = container;
    this.root.classList.add('lane');
    this.root.innerHTML = `
      <div class="lane-contact"><span>${de.lane.contact}</span></div>
      <div class="lane-track"></div>
      <div class="lane-hints"><span>${de.lane.hintUp}</span><span>${de.lane.hintDown}</span></div>
      <div class="lane-hud"><span class="lane-score"></span><span class="lane-combo"></span></div>
      <div class="lane-judge"><span class="judge-text"></span><span class="judge-effect"></span></div>
      <div class="lane-flash"></div>
      <div class="lane-overheat"></div>
      <div class="lane-freeze"><div class="lane-freeze-bar"></div><span>${de.lane.freeze}</span></div>`;
    this.track = this.root.querySelector<HTMLElement>('.lane-track')!;
    this.freezeBar = this.root.querySelector<HTMLElement>('.lane-freeze-bar')!;
    this.flash = this.root.querySelector<HTMLElement>('.lane-flash')!;
    this.overheat = this.root.querySelector<HTMLElement>('.lane-overheat')!;
    this.judge = this.root.querySelector<HTMLElement>('.lane-judge')!;
    this.judgeText = this.root.querySelector<HTMLElement>('.judge-text')!;
    this.judgeEffect = this.root.querySelector<HTMLElement>('.judge-effect')!;
    this.scoreEl = this.root.querySelector<HTMLElement>('.lane-score')!;
    this.comboEl = this.root.querySelector<HTMLElement>('.lane-combo')!;
  }

  /** Hazard ids currently displayed, front chip first. Used by keyboard input. */
  chipIds(): readonly string[] {
    return this.ids;
  }

  /** A hazard was resolved: keep its chip in the contact zone and label it. */
  showOutcome(hazardId: string, outcome: ChipOutcome): void {
    const el = this.chips.get(hazardId);
    if (!el) return;
    // MercyApplied/MercyExpired arrive before HazardCleared; 'alone' must not overwrite them.
    if (outcome === 'alone' && this.outcomes.has(hazardId)) return;
    el.className = `chip chip-${el.dataset['type']} resolved outcome-${outcome}`;
    el.style.transform = 'translate3d(0, 0, 0)';
    el.querySelector('.chip-label')!.textContent = de.lane.outcome[outcome];
    this.outcomes.set(hazardId, { until: performance.now() + OUTCOME_MS });
  }

  /** A hit was judged: big judgement at the line plus a lane flash in the judgement color. GDD 2.2. */
  showJudgement(a: GameEventOf<'OperatorAction'>): void {
    this.judgeText.textContent = de.lane.judgement[a.judgement];
    this.judgeEffect.textContent = de.lane.effect[a.effect];
    this.judge.className = `lane-judge show judge-${a.judgement}`;
    this.flash.textContent = '';
    this.flash.className = `lane-flash show judge-${a.judgement} dir-${a.action === 'hitUp' ? 'up' : 'down'}`;
    window.clearTimeout(this.judgeTimer);
    window.clearTimeout(this.flashTimer);
    this.judgeTimer = window.setTimeout(() => this.judge.classList.remove('show'), JUDGE_MS);
    this.flashTimer = window.setTimeout(() => this.flash.classList.remove('show'), FLASH_MS);
  }

  /** Live operator score and combo. GDD 2.6. */
  showHud(score: number, combo: number, multiplier: number): void {
    this.scoreEl.textContent = de.lane.opScore(score);
    this.comboEl.textContent = combo > 0 ? `${de.lane.combo(combo)} ${de.lane.multiplier(multiplier)}` : '';
    this.comboEl.classList.toggle('hot', multiplier >= 3);
  }

  update(hazards: readonly HazardView[], manip: ManipulationLayer, freeze: LaneFreeze | null, overheat: LaneOverheat | null = null, verdicts: ReadonlyMap<string, 'safe' | 'dead'> = new Map()): void {
    const width = this.track.clientWidth || 1;
    const now = performance.now();
    const seen = new Set<string>();
    this.ids = hazards.map((h) => h.id);

    for (const h of hazards) {
      seen.add(h.id);
      let el = this.chips.get(h.id);
      if (this.outcomes.has(h.id)) {
        // Re-activated after a respawn: fresh chip.
        el?.remove();
        el = undefined;
        this.outcomes.delete(h.id);
      }
      if (!el) {
        el = document.createElement('div');
        el.className = `chip chip-${h.type}`;
        el.dataset['hazardId'] = h.id;
        el.dataset['type'] = h.type;
        el.innerHTML = `<span class="chip-verdict"></span><span class="chip-glyph">${CHIP_GLYPH[h.type]}</span><span class="chip-label">${de.lane.chip[h.type]}</span>`;
        this.track.appendChild(el);
        this.chips.set(h.id, el);
      }
      // Chip reaches the contact zone (x = 0) exactly at the critical frame.
      const t = Math.max(-0.15, Math.min(1.1, h.framesUntilCritical / C.laneLookaheadFrames));
      el.style.transform = `translate3d(${(t * width).toFixed(1)}px, 0, 0)`;
      el.classList.toggle('armed', manip.isArmed(h.id));
      el.classList.toggle('hardened', manip.isHardened(h.id));
      el.classList.toggle('in-contact', h.framesUntilCritical <= 0);
      el.classList.toggle('front', h === hazards[0]);
      const v = verdicts.get(h.id);
      el.classList.toggle('will-die', v === 'dead');
      el.classList.toggle('will-live', v === 'safe');
    }
    for (const [id, el] of this.chips) {
      if (seen.has(id)) continue;
      const outcome = this.outcomes.get(id);
      if (outcome && outcome.until > now) continue;
      el.remove();
      this.chips.delete(id);
      this.outcomes.delete(id);
    }

    this.root.classList.toggle('overheated', overheat !== null);
    if (overheat) this.overheat.textContent = de.lane.overheat(overheat.msLeft / 1000);
    this.root.classList.toggle('frozen', freeze !== null);
    if (freeze) this.freezeBar.style.width = `${Math.max(0, 1 - freeze.progress) * 100}%`;
  }
}
