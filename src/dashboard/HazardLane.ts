// Chips bound to hazard ids; the only gesture zone. GDD 2.2, 4.1.
// Pure view: reads HazardView[] + manipulation state each frame and moves DOM
// chips with CSS transforms. Never mutates simulation state.
import type { HazardView } from '../arcade/FakeArcadeGame';
import type { ManipulationLayer } from '../arcade/ManipulationLayer';
import { de } from '../i18n/de';
import { SessionConfig as C } from '../session/SessionConfig';

const CHIP_GLYPH: Record<HazardView['type'], string> = { crater: '○', worm: '◆', probe: '▲', meteor: '●' };

export interface LaneFreeze {
  /** 0..1 elapsed share of the death freeze. */
  progress: number;
}

export class HazardLane {
  readonly root: HTMLElement;
  private readonly track: HTMLElement;
  private readonly freezeBar: HTMLElement;
  private chips = new Map<string, HTMLElement>();
  private ids: string[] = [];

  constructor(container: HTMLElement) {
    this.root = container;
    this.root.classList.add('lane');
    this.root.innerHTML = `
      <div class="lane-contact"><span>${de.lane.contact}</span></div>
      <div class="lane-track"></div>
      <div class="lane-hints"><span>${de.lane.hintUp}</span><span>${de.lane.hintDown}</span></div>
      <div class="lane-freeze"><div class="lane-freeze-bar"></div><span>${de.lane.freeze}</span></div>`;
    this.track = this.root.querySelector<HTMLElement>('.lane-track')!;
    this.freezeBar = this.root.querySelector<HTMLElement>('.lane-freeze-bar')!;
  }

  /** Hazard ids currently displayed, front chip first. Used by keyboard input. */
  chipIds(): readonly string[] {
    return this.ids;
  }

  update(hazards: readonly HazardView[], manip: ManipulationLayer, freeze: LaneFreeze | null): void {
    const width = this.track.clientWidth || 1;
    const seen = new Set<string>();
    this.ids = hazards.map((h) => h.id);

    for (const h of hazards) {
      seen.add(h.id);
      let el = this.chips.get(h.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `chip chip-${h.type}`;
        el.dataset['hazardId'] = h.id;
        el.innerHTML = `<span class="chip-glyph">${CHIP_GLYPH[h.type]}</span><span class="chip-label">${de.lane.chip[h.type]}</span>`;
        this.track.appendChild(el);
        this.chips.set(h.id, el);
      }
      // Chip reaches the contact zone (x = 0) exactly at the critical frame.
      const t = Math.max(-0.15, Math.min(1.1, h.framesUntilCritical / C.laneLookaheadFrames));
      el.style.transform = `translate3d(${(t * width).toFixed(1)}px, 0, 0)`;
      el.classList.toggle('armed', manip.isArmed(h.id));
      el.classList.toggle('hardened', manip.isHardened(h.id));
      el.classList.toggle('in-contact', h.framesUntilCritical <= 0);
    }
    for (const [id, el] of this.chips) {
      if (!seen.has(id)) {
        el.remove();
        this.chips.delete(id);
      }
    }

    this.root.classList.toggle('frozen', freeze !== null);
    if (freeze) this.freezeBar.style.width = `${Math.max(0, 1 - freeze.progress) * 100}%`;
  }
}
