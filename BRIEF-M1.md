# BRIEF-M1 — Klickbarer Core-Loop-Prototyp + Infrastruktur

**Für:** Claude Code (Fable 5.1)
**Quelle:** `GDD.md` v0.2, Abschnitt 6 / Meilenstein 1. Regeln: `CLAUDE.md`.
**Ergebnis:** Ein deploytes Spiel auf Render, das Rob und drei Freunde per Invite-Link am Handy spielen und über den Feedback-Button kommentieren können. Die Kernentscheidung (Scharfen / Veto / Rückwirk-Gnade) ist spielbar; Latenz und CRT-Touches werden gemessen.

Arbeite die Schritte in dieser Reihenfolge ab. Hake sie hier ab. Halte an jedem **STOPP** an.

---

## Schritt 0 — Umgebung prüfen

- [x] `bun --version`, `gh auth status`, `git config user.name`. Fehlt etwas → **STOPP**, Rob bitten, `gh auth login` auszuführen bzw. Bun zu installieren.
- [x] Lies `GDD.md` vollständig. Lies `CLAUDE.md`. Fasse in fünf Sätzen zusammen, was in M1 *nicht* gebaut wird (Verdacht, Overheat, Hitbox-Shrink, Bullet-Time, Slider, Profile außer Casual, Sonden, Meteoriten, CRT-Shader, Audio). Diese Liste ist deine Scope-Bremse.

## Schritt 1 — Repo-Skelett

- [x] (Repo heißt `r0bsta1909/arcade-operator`, von Rob leer angelegt; Lizenz per curl geladen) `gh repo create operator --public --description "Asymmetric arcade-operator game. You are the machine." --license` — CC BY-NC ist bei `gh` nicht als Template verfügbar: Repo ohne Lizenz anlegen, `LICENSE` manuell mit dem offiziellen CC-BY-NC-4.0-Text anlegen (Quelle: creativecommons.org/licenses/by-nc/4.0/legalcode.txt — herunterladen, nicht aus dem Gedächtnis schreiben).
- [x] `README.md`: Ein Absatz Vision (aus GDD 1), Link zum Spiel (Platzhalter bis Schritt 9), Lizenzhinweis, "How to run locally", "How to give feedback".
- [x] `bun init`, Vite + TypeScript strict, `vitest`, `eslint` mit `no-restricted-globals` für `Math.random` / `Date.now` / `performance.now` in `src/arcade`, `src/human`, `src/session`.
- [x] Ordnerstruktur aus GDD 5.2 als leere Dateien mit je einem Kopfkommentar (Zweck, GDD-Verweis).
- [x] `.github/workflows/ci.yml`: `bun install`, `bun run typecheck`, `bun run test`, `bun run build`.
- [x] `.github/ISSUE_TEMPLATE/feedback.yml` mit denselben Feldern wie der spätere Button (Kategorie-Dropdown, Freitext, Gerät, optional Log).
- [x] Labels anlegen: `feedback`, `cat:bug`, `cat:feel`, `cat:balance`, `cat:idea`, `cat:other`, `phase:m1`, `phase:m2`, `phase:m3`, `phase:m4`.
- [x] Erster Commit: `infra: repo skeleton, CI, license`.

## Schritt 2 — Core

- [x] `core/Rng.ts` — `mulberry32`, `fork(label)` für getrennte Streams (Welt, Gast, Gast-Vorhersage).
- [x] `core/GameLoop.ts` — Fixed 60 Hz mit Akkumulator, Spiral-of-Death-Schutz (max 5 Ticks/Frame), `onTick`, `onRender(alpha)`. `Clock.timeScale` skaliert den Akkumulator, nicht die Frame-Rate.
- [x] `core/Store.ts` — `Store<T>` mit `get`, `set`, `update`, `subscribe`. Keine Abhängigkeit.
- [x] `core/EventBus.ts` — typisiert über ein `GameEvent`-Union aus `session/events.ts`.
- [x] `session/SessionLog.ts` — `append(frame, event)`, `toJSON()`, `fromJSON()`, `hash()`. Enthält Header: `seed`, `profileId`, `buildHash`, `configHash`.
- [x] `session/SessionConfig.ts` — alle Konstanten aus GDD 2.1, 2.3 (nur die M1-relevanten), jede mit Kommentar `// GDD 2.3: …`.
- [x] `tests/determinism.test.ts` — zwei Läufe mit gleichem Seed und gleichem Operator-Input-Skript (Array aus `{frame, action}`) ⇒ identischer `SessionLog.hash()`. Der Test läuft jetzt schon gegen einen Dummy-Tick und wird in Schritt 4 auf die echte Simulation umgestellt.
- [x] Commit: `feat(core): loop, rng, store, eventbus, session log`.

## Schritt 3 — Fake-Game

- [x] `arcade/Segments.ts` — zwei handgebaute Segmente à 20 s, nur Krater und Würmer, als Datenarrays (`{ atMeter, type, width }`).
- [x] `arcade/Hopper.ts` — feste Sprunghöhe, Sprungdauer 36 Frames, `coyoteFrames` als Eingang aus `ManipulationState`.
- [x] `arcade/FakeArcadeGame.ts` — Scrolling, Kollision (AABB), Score, drei Leben, `getUpcomingHazards(3)` mit `framesUntilCritical` und `idealJumpFrame`. Emittiert `Death`, `NearMiss(deltaMs)`, `SegmentCleared`, `ScoreMilestone`. Sieg bei 3.000.
- [x] `arcade/ManipulationLayer.ts` — `ManipulationState` mit `armed: Set<hazardId>`, `hardened: Set<hazardId>`, `retroMercyRequested: boolean`. Gnade greift nur, wenn `armed` und der Sprung sonst tödlich wäre; loggt `MercyApplied(hazardId, deltaMs)` oder `MercyExpired`.
- [x] `arcade/CrtRenderer.ts` — 160×144 Logikpixel auf Canvas, Rechtecke in 4 Farben, `imageSmoothingEnabled = false`. Keine Scanlines, keine Wölbung in M1.
- [x] `arcade/OverlayRenderer.ts` — zweites Canvas über dem CRT, zeichnet 300 ms vor dem kritischen Frame die Geist-Sprungkurve aus `HumanAgent.predictedJump` mit farbigem Landemarker.
- [x] Commit: `feat(arcade): moon hopper core, manipulation layer, crt + overlay renderers`.

## Schritt 4 — Gast

- [x] `human/Profiles.ts` — nur `casual` aktiv, Struktur für alle vier.
- [x] `human/HumanAgent.ts` — ideale Sprungframe-Berechnung, Fehler `N(bias, σ)`, `σ = σBase × (1 − skill) × (1 + frustration × jitterGain)`. `predictedJump(hazard)` mit eigenem PRNG-Fork. Kein Zugriff auf Manipulation.
- [x] `human/HumanPsychologyEngine.ts` — `frustration`, `boredom` als Leaky-Integratoren, `tolerance`, fixer Kanal (0,45 / 0,45), `jitter`. Events aus GDD 2.3 (M1-Teilmenge: Tod, Beinahe-Tod, Streak, Segment, Meilenstein). Abbruch-Entscheidung liefert `ABORT_FRUST` oder `ABORT_BORED` je nach dominanter Achse.
- [x] `session/GameStateManager.ts` — Zustandsautomat inkl. `DEATH_FREEZE` (400 ms, aus `SessionConfig.deathFreezeMs`).
- [x] `tests/determinism.test.ts` auf die echte Simulation umstellen. `tests/psychology.test.ts` mit drei Fällen: Serientod-Quadratik, Streak-Langeweile, Beinahe-Tod-Erleichterung.
- [x] Headless-Smoke: `bun run sim:smoke` spielt 50 Sessions mit Passiv-Bot. Erwartung: Passiv verliert ≥ 80 %. Sonst Konstanten anpassen, Ergebnis im Commit-Body.
- [x] Commit: `feat(human): agent, psychology engine, state machine`.

**STOPP 1 — Headless-Review.** Zeige Rob die Sim-Tabelle (Siegrate Passiv, mittlere Session-Dauer, Verteilung Frust- vs. Langeweile-Abbruch) und die Ereignisliste einer Beispiel-Session. Warte auf Freigabe der Konstanten.

## Schritt 5 — Operator & Hazard-Lane

- [ ] `operator/OperatorActions.ts` — `arm(hazardId)`, `veto(hazardId)`, `retroMercy()`. `veto` auf gescharften Chip = aufheben, sonst = Härte.
- [ ] `operator/HeatSystem.ts` — Hitze +20 beim Scharfen, +10 wenn greift, +15 Härte, +35 Rückwirk, −8/s. In M1 nur als Zahl, kein Overheat.
- [ ] `operator/OperatorInput.ts` — Pointer-Events. Swipe: ≥ 40 px, ≤ 250 ms, vertikal dominant. `pointer-capture` auf der Lane. Tastatur: `W`/`S`/Pfeile auf vordersten Chip, `1`–`3` wählen.
- [ ] `operator/LatencyProbe.ts` — misst `Death`-Event → `pointerup` des Rückwirk-Swipes in ms; loggt `LatencySample(ms)`. Loggt jeden `pointerdown` auf dem CRT-Canvas als `CrtTouch`.
- [ ] `dashboard/HazardLane.ts` — Chips als DOM-Elemente, Position via CSS-Transform aus `framesUntilCritical`, Kontaktzone rot, gescharft cyan, in Kontaktzone grau. Death-Freeze: Lane pulsiert rot mit ablaufendem Balken.
- [ ] Commit: `feat(operator): hazard lane, arm/veto/retro mercy, latency probe`.

## Schritt 6 — Dashboard & Layout (roh)

- [ ] `styles/tokens.css`, `styles/layout.css` — Portrait-Layout nach GDD 4.1 mit den Höhenanteilen; Landscape ab 1024 px CRT links, Panel rechts. Kein Feinschliff.
- [ ] `dashboard/FlowMeters.ts` — zwei Nadeln (FRUST, BORED) als SVG mit Kanalband.
- [ ] `dashboard/ToleranceBar.ts`, `dashboard/JitterBar.ts`, Hitze als Textzahl.
- [ ] CRT nimmt keine Pointer-Events an (`pointer-events: none` auf beiden Canvases; Touch wird vom Container geloggt und zeigt 600 ms einen Pfeil zur Lane).
- [ ] Game-Over-Screens: Text unterscheidet Frust ("PLAYER 1 LEFT") und Langeweile ("INSERT COIN"). Sieg: "NEW HIGH SCORE" ohne Initialen-Animation.
- [ ] `debrief/DebriefScreen.ts` — zwei Polylines (frustration, boredom) über die Session, Kanalband, Marker für Tode und greifende Gnaden, Button "Nochmal", Button "Feedback".
- [ ] Commit: `feat(dashboard): raw portrait layout, meters, debrief`.

**STOPP 2 — Erster Gerätetest.** `bun run dev --host`, Rob spielt am Handy im lokalen Netz. Warte auf: fühlt sich Scharfen wie eine Entscheidung an, ist das Rückwirk-Fenster erreichbar, wird die Lane verstanden. Anpassungen aus diesem Test vor Schritt 7.

## Schritt 7 — Feedback-Pipeline

- [ ] `feedback/FeedbackPayload.ts` — Zod-Schema: `category`, `text` (10–2.000), `handle?`, `device`, `buildHash`, `phase`, `sessionLog`, `honeypot` (muss leer sein).
- [ ] `feedback/deviceInfo.ts` — UA, Viewport, DPR, `maxTouchPoints`, Orientierung.
- [ ] `feedback/FeedbackDialog.ts` — Dialog mit Hinweis "Text, Gerätedaten und Spiellog werden öffentlich als GitHub-Issue gespeichert", Kategorie-Buttons, Textfeld, Senden. Erfolg zeigt "#<nr>" mit Link.
- [ ] `server/feedback.ts` — Validierung, Log-Kappung (> 60.000 Zeichen → erste 300 + letzte 1.500 Events + Hinweis), Phase-Logik (`friends`: Invite-Code prüfen; `public`: Honeypot + Rate-Limit), Issue-Erstellung via `https://api.github.com/repos/${GITHUB_REPO}/issues` mit Titel `[feedback][<cat>] <60 Zeichen>`, Labels `feedback`, `cat:<cat>`, `phase:<phase>`, Body aus Metadaten-Tabelle + Text + `<details>`-JSON.
- [ ] `server/rateLimit.ts` — In-Memory pro IP, 5/Stunde, nur in `public` aktiv.
- [ ] `server/index.ts` — `Bun.serve`: `dist/` statisch, `GET /health` → `{ ok, buildHash, phase }`, `POST /feedback`. Invite-Code: Frontend liest `?invite=` beim Laden, speichert in `localStorage`, schickt ihn im Payload.
- [ ] `.env.example`: `GITHUB_TOKEN`, `GITHUB_REPO`, `PHASE=friends`, `INVITE_CODES=code1,code2`, `PORT`.
- [ ] `tests/feedback.test.ts` — Schema-Validierung, Kappung, Honeypot-Ablehnung, Invite-Ablehnung.
- [ ] Lokaler End-to-End-Test gegen ein privates Scratch-Repo (`GITHUB_REPO` temporär umbiegen). Issue muss korrekt aussehen, dann Scratch-Issue schließen.
- [ ] Commit: `feat(feedback): dialog, server endpoint, github issue pipeline`.

**STOPP 3 — Secrets.** Rob braucht: ein fine-grained GitHub-Token mit `Issues: Read and write` nur auf `operator`, und einen Render-Account. Bitte Rob, das Token zu erzeugen (nicht in den Chat pasten — direkt in Render eintragen) und zwei Invite-Codes zu wählen. Warte.

## Schritt 8 — Deploy

- [ ] `render.yaml` — Web Service, Runtime `node` mit Bun-Install im Build oder Runtime `docker` mit `oven/bun`-Image (prüfe die aktuelle Render-Doku, welche Bun-Unterstützung existiert; dokumentiere die Wahl im Commit). `healthCheckPath: /health`, Env-Vars als `sync: false`.
- [ ] Build-Hash: `VITE_BUILD_HASH` aus `git rev-parse --short HEAD` im Build-Script.
- [ ] Attract-Mode zeigt "Automat fährt hoch…" bis `/health` antwortet (Free-Tier-Spin-down).
- [ ] Rob verbindet das Repo mit Render (Blueprint) und trägt die Env-Vars ein — Anleitung in fünf Schritten im Chat liefern.
- [ ] Nach dem ersten Deploy: `/health` prüfen, eine Session spielen, ein Test-Feedback senden, Issue im Repo verifizieren, Test-Issue schließen.
- [ ] README: Live-Link eintragen, Invite-Link-Format dokumentieren (`https://<service>.onrender.com/?invite=<code>`).
- [ ] Commit: `infra(render): blueprint, build hash, health check`.

## Schritt 9 — Abnahme-Vorbereitung

- [ ] `scripts/feedback-digest.ts` in Minimalfassung: listet offene `feedback`-Issues, extrahiert aus jedem Log den Latenz-Median und die CRT-Touch-Anzahl, gibt eine Markdown-Tabelle aus.
- [ ] `BRIEF-M1.md` aktualisieren: alle Haken gesetzt, offene Punkte gelistet.
- [ ] Kurzbericht an Rob: Live-Link, Invite-Links, was Tester tun sollen (5 Runden, dann Feedback-Button im Debrief), welche drei Fragen sie beantworten sollen (H1, H5, H6 aus GDD 2.7).

**STOPP 4 — Meilenstein-Abnahme.** Warte auf die Tester-Runde. M2 beginnt erst mit dem ersten `feedback-digest`.

---

## Scope-Bremse (was in M1 NICHT gebaut wird)

Verdacht · Overheat · Hitbox-Shrink · Bullet-Time · Slider · Free Credit · Profile außer Casual · Sonden · Meteoriten · Segmente 3–8 · CRT-Scanlines/Wölbung · Audio · Initialen-Animation · Mikrofon-Texte · Tutorial · PWA · Rate-Limit aktiv (Code ja, Phase `friends`).

Wenn du merkst, dass du etwas davon "nur schnell" mitbauen willst: nicht. Notiere es in `feedback/backlog.md` und mach weiter.
