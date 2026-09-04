// Entry point: wires GameLoop, SessionRunner, renderers and dashboard. GDD 5.2.
// This is the only module that knows both the simulation and the DOM. All
// operator input goes through OperatorActions and is applied once per tick.
import { CrtRenderer } from './arcade/CrtRenderer';
import { OverlayRenderer } from './arcade/OverlayRenderer';
import { GameLoop } from './core/GameLoop';
import { Dashboard } from './dashboard/Dashboard';
import { DebriefScreen } from './debrief/DebriefScreen';
import { de } from './i18n/de';
import { LatencyProbe } from './operator/LatencyProbe';
import { OperatorActions } from './operator/OperatorActions';
import { OperatorInput } from './operator/OperatorInput';
import { DEATH_FREEZE_FRAMES, CONTINUE_FRAMES } from './session/GameStateManager';
import { SessionConfig as C } from './session/SessionConfig';
import { SessionRunner } from './session/SessionRunner';

declare const __BUILD_HASH__: string;
const BUILD_HASH = typeof __BUILD_HASH__ === 'string' ? __BUILD_HASH__ : 'dev';
/** Frames the end screen stays on the CRT before the debrief. */
const END_SCREEN_FRAMES = 120;

const app = document.getElementById('app')!;
const dashboard = new Dashboard(app);
const crt = new CrtRenderer(dashboard.crtCanvas);
const overlay = new OverlayRenderer(dashboard.overlayCanvas);
const debrief = new DebriefScreen(app, { onAgain: () => startSession(), onFeedback: () => openFeedback() });

let runner: SessionRunner;
let actions: OperatorActions;
let probe: LatencyProbe;
let input: OperatorInput | null = null;
/** Render frames shown since the session ended (end screen hold). */
let endScreenFrames = 0;

function newSeed(): number {
  // main.ts is outside the deterministic core; the seed itself may come from the wall clock.
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function fitCanvases(): void {
  const dpr = window.devicePixelRatio || 1;
  const wrap = dashboard.crtWrap;
  const scale = Math.max(1, Math.floor(Math.min((wrap.clientWidth * dpr) / C.crtWidth, (wrap.clientHeight * dpr) / C.crtHeight)));
  for (const c of [dashboard.crtCanvas, dashboard.overlayCanvas]) {
    c.width = C.crtWidth * scale;
    c.height = C.crtHeight * scale;
  }
}

function crtMessage(): string | undefined {
  const st = runner.states;
  switch (st.state) {
    case 'READY':
      return de.crt.ready;
    case 'CONTINUE':
      return de.crt.continue(Math.max(0, Math.ceil((CONTINUE_FRAMES - st.framesIn(runner.frame)) / 60)));
    case 'VICTORY':
      return de.crt.victory;
    case 'ABORT_FRUST':
      return de.crt.abortFrust;
    case 'ABORT_BORED':
      return de.crt.abortBored;
    case 'ABORT_SUSPECT':
      return de.crt.abortSuspect;
    default:
      return undefined;
  }
}

const loop = new GameLoop({
  onTick: () => {
    if (!runner.ended) runner.step(actions.drain());
  },
  onRender: () => {
    const snap = runner.game.snapshot();
    const frozen = runner.states.inDeathFreeze;
    const freezeProgress = frozen ? runner.states.framesIn(runner.frame) / DEATH_FREEZE_FRAMES : undefined;
    crt.render(snap, { freezeProgress, message: crtMessage() });
    overlay.render(snap, runner.prediction());
    dashboard.update(runner.game.getUpcomingHazards(3), runner.manip, frozen && freezeProgress !== undefined ? { progress: freezeProgress } : null, runner.psyche.state, runner.heat.value);

    if (runner.ended && runner.result && ++endScreenFrames >= END_SCREEN_FRAMES) {
      // Hold the end screen for a moment, then debrief.
      loop.stop();
      dashboard.root.hidden = true;
      debrief.show(runner.log, runner.result, runner.profileId, BUILD_HASH);
    }
  },
});

function startSession(): void {
  debrief.hide();
  dashboard.root.hidden = false;
  input?.dispose();
  endScreenFrames = 0;
  runner = new SessionRunner({ seed: newSeed(), buildHash: BUILD_HASH });
  actions = new OperatorActions();
  probe = new LatencyProbe(runner.bus);
  input = new OperatorInput(dashboard.lane.root, actions, probe, {
    chipIds: () => dashboard.lane.chipIds(),
    inDeathFreeze: () => runner.states.inDeathFreeze,
  });
  fitCanvases();
  loop.start();
}

function openFeedback(): void {
  // M1 step 7 replaces this with FeedbackDialog.
  console.info('feedback dialog arrives in step 7; log hash', runner.log.hash());
}

// GDD 4.1 / H6: the CRT takes no pointer events, but touches on it are logged and hint at the lane.
dashboard.crtWrap.addEventListener('pointerdown', (e) => {
  const r = dashboard.crtWrap.getBoundingClientRect();
  probe.crtTouched((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  dashboard.flashCrtHint();
});
dashboard.feedbackButton.addEventListener('click', () => openFeedback());
window.addEventListener('resize', fitCanvases);

startSession();
