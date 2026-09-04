// Guest timing spread as tremor width. GDD 2.3: rises with frustration, the early warning that arming pays off.
import { de } from '../i18n/de';
import { SessionConfig as C } from '../session/SessionConfig';

export class JitterBar {
  private readonly fill: HTMLElement;
  private readonly value: HTMLElement;

  constructor(container: HTMLElement) {
    container.classList.add('jitter-row');
    container.innerHTML = `<span>${de.dashboard.jitter}</span><div class="jitter-bar"><div class="jitter-fill"></div></div><span class="jitter-value"></span>`;
    this.fill = container.querySelector('.jitter-fill')!;
    this.value = container.querySelector('.jitter-value')!;
  }

  update(sigmaMs: number): void {
    const pct = Math.min(1, sigmaMs / C.jitterFullScaleMs) * 100;
    this.fill.style.width = `${pct.toFixed(0)}%`;
    this.value.textContent = `±${sigmaMs.toFixed(0)} ms`;
  }
}
