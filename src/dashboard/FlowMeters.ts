// FRUST / BORED needles with channel band. GDD 2.3, 4.1.
// SVG, read-only: update(state) moves two needles on a shared 0..1 scale and
// draws the channel band (green) up to each threshold.
import { de } from '../i18n/de';
import type { PsycheState } from '../human/HumanPsychologyEngine';

const W = 300;
const H = 132;
const LEFT = 52;
const RIGHT = W - 10;

export class FlowMeters {
  readonly root: SVGSVGElement;
  private readonly frustNeedle: SVGLineElement;
  private readonly boredNeedle: SVGLineElement;
  private readonly frustBand: SVGRectElement;
  private readonly boredBand: SVGRectElement;
  private readonly suspectNeedle: SVGLineElement;
  private readonly suspectFloor: SVGRectElement;

  constructor(container: HTMLElement) {
    container.innerHTML = `
      <svg class="meters" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <text x="4" y="30">${de.dashboard.frust}</text>
        <rect x="${LEFT}" y="18" width="${RIGHT - LEFT}" height="16" fill="#1f2027" stroke="#2c2e38"/>
        <rect class="band-frust" x="${LEFT}" y="18" width="0" height="16" fill="rgba(61,220,132,0.35)"/>
        <line class="needle-frust" x1="${LEFT}" y1="14" x2="${LEFT}" y2="38" stroke="#ff3b3b" stroke-width="3"/>
        <text x="4" y="72">${de.dashboard.bored}</text>
        <rect x="${LEFT}" y="60" width="${RIGHT - LEFT}" height="16" fill="#1f2027" stroke="#2c2e38"/>
        <rect class="band-bored" x="${LEFT}" y="60" width="0" height="16" fill="rgba(61,220,132,0.35)"/>
        <line class="needle-bored" x1="${LEFT}" y1="56" x2="${LEFT}" y2="80" stroke="#4da3ff" stroke-width="3"/>
        <text x="4" y="114">${de.dashboard.suspect}</text>
        <rect x="${LEFT}" y="102" width="${RIGHT - LEFT}" height="16" fill="#1f2027" stroke="#2c2e38"/>
        <rect x="${LEFT + (RIGHT - LEFT) * 0.7}" y="102" width="${(RIGHT - LEFT) * 0.3}" height="16" fill="rgba(255,59,59,0.3)"/>
        <rect class="floor-suspect" x="${LEFT}" y="102" width="0" height="16" fill="rgba(255,179,0,0.25)"/>
        <line class="needle-suspect" x1="${LEFT}" y1="98" x2="${LEFT}" y2="122" stroke="#ffb300" stroke-width="3"/>
      </svg>`;
    this.root = container.querySelector('svg')!;
    this.frustNeedle = this.root.querySelector('.needle-frust')!;
    this.boredNeedle = this.root.querySelector('.needle-bored')!;
    this.frustBand = this.root.querySelector('.band-frust')!;
    this.boredBand = this.root.querySelector('.band-bored')!;
    this.suspectNeedle = this.root.querySelector('.needle-suspect')!;
    this.suspectFloor = this.root.querySelector('.floor-suspect')!;
  }

  update(p: PsycheState): void {
    const x = (v: number) => (LEFT + (RIGHT - LEFT) * Math.min(1, Math.max(0, v))).toFixed(1);
    this.frustNeedle.setAttribute('x1', x(p.frustration));
    this.frustNeedle.setAttribute('x2', x(p.frustration));
    this.boredNeedle.setAttribute('x1', x(p.boredom));
    this.boredNeedle.setAttribute('x2', x(p.boredom));
    this.frustBand.setAttribute('width', ((RIGHT - LEFT) * p.channel.frustMax).toFixed(1));
    this.boredBand.setAttribute('width', ((RIGHT - LEFT) * p.channel.boreMax).toFixed(1));
    this.suspectNeedle.setAttribute('x1', x(p.suspicion / 100));
    this.suspectNeedle.setAttribute('x2', x(p.suspicion / 100));
    this.suspectFloor.setAttribute('width', ((RIGHT - LEFT) * (p.suspicionFloor / 100)).toFixed(1));
  }
}
