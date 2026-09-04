// Tolerance crack bar. GDD 2.1, 4.1: flickers below 30.
import { de } from '../i18n/de';

const WARN_BELOW = 60;
const CRITICAL_BELOW = 30; // GDD 2.3: "flackert < 30"

export class ToleranceBar {
  private readonly bar: HTMLElement;
  private readonly fill: HTMLElement;

  constructor(container: HTMLElement) {
    container.classList.add('tolerance-wrap');
    container.innerHTML = `<div class="tolerance-bar"><div class="tolerance-fill"></div></div><span>${de.dashboard.tolerance}</span>`;
    this.bar = container.querySelector('.tolerance-bar')!;
    this.fill = container.querySelector('.tolerance-fill')!;
  }

  update(tolerance: number): void {
    this.fill.style.width = `${Math.max(0, Math.min(100, tolerance))}%`;
    this.bar.classList.toggle('warn', tolerance < WARN_BELOW && tolerance >= CRITICAL_BELOW);
    this.bar.classList.toggle('critical', tolerance < CRITICAL_BELOW);
  }
}
