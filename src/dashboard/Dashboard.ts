// Dashboard root: composes lane, meters, sliders. GDD 4.1.
// Builds the portrait DOM (layout.css) and exposes the child views. Sliders
// and COIN are visible but disabled placeholders in M1 (scope brake).
import type { HazardView } from '../arcade/FakeArcadeGame';
import type { ManipulationLayer } from '../arcade/ManipulationLayer';
import type { PsycheState } from '../human/HumanPsychologyEngine';
import { de } from '../i18n/de';
import { FlowMeters } from './FlowMeters';
import { HazardLane, type LaneFreeze } from './HazardLane';
import { JitterBar } from './JitterBar';
import { ToleranceBar } from './ToleranceBar';

export class Dashboard {
  readonly root: HTMLElement;
  readonly crtWrap: HTMLElement;
  readonly crtCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
  readonly crtHint: HTMLElement;
  readonly lane: HazardLane;
  readonly feedbackButton: HTMLButtonElement;
  private readonly meters: FlowMeters;
  private readonly tolerance: ToleranceBar;
  private readonly jitter: JitterBar;
  private readonly heatFill: HTMLElement;
  private readonly heatValue: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'screen game';
    this.root.innerHTML = `
      <div class="crt-wrap">
        <canvas class="crt"></canvas>
        <canvas class="overlay"></canvas>
        <div class="crt-hint">${de.crt.touchHint}</div>
      </div>
      <div class="tolerance-wrap"></div>
      <div class="lane"></div>
      <div class="sensors"><div class="meters-wrap"></div><div class="jitter-wrap"></div></div>
      <div class="controls">
        <div class="control-row disabled"><span>SPEED</span><div class="control-track"><div class="control-knob" style="left:33%"></div></div><span>1.0×</span></div>
        <div class="control-row disabled"><span>WINDOW</span><div class="control-track"><div class="control-knob" style="left:42%"></div></div><span>90ms</span></div>
        <div class="control-row disabled"><span>SPAWN</span><span>[SPARSE] [●NORM] [DENSE]</span><span></span></div>
        <div class="control-row"><span>${de.dashboard.heat}</span><div class="control-track"><div class="heat-fill" style="width:0%"></div></div><span class="heat-value">0%</span></div>
      </div>
      <div class="footer">
        <button class="btn" disabled>◎ ${de.dashboard.coin}</button>
        <button class="btn feedback">✎ ${de.dashboard.feedback}</button>
      </div>`;
    parent.appendChild(this.root);
    this.crtWrap = this.q('.crt-wrap');
    this.crtCanvas = this.q('canvas.crt');
    this.overlayCanvas = this.q('canvas.overlay');
    this.crtHint = this.q('.crt-hint');
    this.lane = new HazardLane(this.q('.lane'));
    this.meters = new FlowMeters(this.q('.meters-wrap'));
    this.tolerance = new ToleranceBar(this.q('.tolerance-wrap'));
    this.jitter = new JitterBar(this.q('.jitter-wrap'));
    this.heatFill = this.q('.heat-fill');
    this.heatValue = this.q('.heat-value');
    this.feedbackButton = this.q('button.feedback');
  }

  update(hazards: readonly HazardView[], manip: ManipulationLayer, freeze: LaneFreeze | null, psyche: PsycheState, heat: number): void {
    this.lane.update(hazards, manip, freeze);
    this.meters.update(psyche);
    this.tolerance.update(psyche.tolerance);
    this.jitter.update(psyche.jitter);
    this.heatFill.style.width = `${heat.toFixed(0)}%`;
    this.heatValue.textContent = `${heat.toFixed(0)}%`;
  }

  /** GDD 4.1: touching the CRT shows an arrow to the lane for 600 ms. */
  flashCrtHint(): void {
    this.crtHint.classList.add('show');
    window.setTimeout(() => this.crtHint.classList.remove('show'), 600);
  }

  private q<T extends HTMLElement>(sel: string): T {
    const el = this.root.querySelector<T>(sel);
    if (!el) throw new Error(`Dashboard: missing ${sel}`);
    return el;
  }
}
