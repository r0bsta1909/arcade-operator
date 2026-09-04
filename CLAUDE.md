# CLAUDE.md — Repo-Regeln für OPERATOR

Dieses Repo ist öffentlich (CC BY-NC 4.0). Das Spiel wird auf Render.com gehostet. Die Designquelle ist `GDD.md`; die aktuelle Arbeitsanweisung ist `BRIEF-M<n>.md`. Bei Widerspruch zwischen Code und GDD gilt das GDD — oder das GDD wird im selben Commit geändert und der Grund im Commit-Body genannt.

## Sprache

- Kommunikation mit Rob: Deutsch.
- Code, Identifier, Commits, Issues, Kommentare im Code: Englisch.
- Spieltexte (Mikrofon, Debrief, UI): Deutsch, in `src/i18n/de.ts`, nie hartcodiert.

## Unverhandelbare Architekturregeln

1. **Determinismus.** Simulation läuft mit festem 60-Hz-Timestep. Jede Zufallsquelle geht durch `Rng` mit Seed aus `SessionConfig`. `Math.random`, `Date.now` und `performance.now` sind in `src/arcade`, `src/human`, `src/session` verboten (ESLint-Regel `no-restricted-globals`). `HumanAgent.predictedJump` nutzt einen eigenen PRNG-Stream.
2. **Rendering ist rein lesend.** `CrtRenderer`, `OverlayRenderer` und alle Dashboard-Komponenten verändern keinen Simulationszustand.
3. **Trennung der Wissensgrenzen.** `FakeArcadeGame` kennt den Gast nicht. `HumanAgent` kennt weder `ManipulationLayer` noch Overlay. `HumanPsychologyEngine` kennt nur Events. Wer eine Grenze überschreiten will, schreibt zuerst einen Absatz ins GDD, warum.
4. **Alles ins `SessionLog`.** Jedes Game-Event, jede Operator-Aktion, jede Latenzmessung, jeder CRT-Touch. Ein Feature ohne Log-Eintrag ist nicht fertig.
5. **Konstanten leben in `SessionConfig`.** Keine Magic Numbers in Engines. Jede Konstante hat einen Kommentar mit Verweis auf den GDD-Abschnitt.
6. **Kein UI-Framework, keine Game-Engine.** Vite + TypeScript strict + Canvas 2D + DOM. Abhängigkeiten nur nach Begründung im PR-Body; Kandidatenliste erlaubt: `zod`, `vitest`, `eslint`, `typescript`, `vite`.

## Tests

- `bun run test` muss vor jedem Commit grün sein. CI führt `tsc --noEmit`, `vitest run`, `vite build` aus.
- `tests/determinism.test.ts` ist heilig: Gleicher Seed + gleiche Operator-Inputs ⇒ byte-identisches `SessionLog`. Bricht dieser Test, ist alles andere zweitrangig.
- Jede Änderung an Psychologie-Konstanten läuft durch `bun run sim` (`tests/balance.sim.ts`) und legt die Ergebnistabelle im Commit-Body ab.

## Arbeitsweise

- Arbeite den aktuellen `BRIEF-M<n>.md` in der dort festgelegten Reihenfolge ab. Ein Schritt = ein oder mehrere Commits; Schrittabschluss wird in `BRIEF-M<n>.md` abgehakt.
- **Stopp-Punkte** im Brief sind hart: Dort anhalten, Zustand zusammenfassen, auf Robs Antwort warten. Nie über einen Stopp-Punkt hinaus raten.
- Vor jeder Architekturentscheidung, die im GDD nicht steht: kurz vorschlagen, Trade-off nennen, auf Freigabe warten. Kleine Implementierungsentscheidungen (Dateinamen, Hilfsfunktionen) eigenständig treffen.
- Conventional Commits: `feat(arcade): …`, `fix(lane): …`, `balance(psych): …`, `infra(render): …`, `docs(gdd): …`.
- Kein Force-Push auf `main`. Keine Secrets im Repo — `GITHUB_TOKEN`, `INVITE_CODES` nur als Render-Env-Vars; `.env.example` dokumentiert die Namen.

## Feedback-Schleife

- Feedback der Tester kommt als GitHub-Issues mit Label `feedback` und eingebettetem SessionLog (siehe GDD 5.5).
- Zu Beginn jeder Session ab M2: `bun run feedback:digest` ausführen, `feedback/digest-<datum>.md` lesen, die drei wichtigsten Punkte Rob vorlegen, bevor Code angefasst wird.
- Ein Issue wird geschlossen mit Verweis auf den Commit, der es adressiert, oder mit einer Begründung, warum nicht. Nie still schließen.
- `bun run replay <issue-nr>` spielt den Log eines Issues headless nach. Bei Bug-Reports zuerst replayen, dann fixen, dann einen Regressionstest aus dem Log ableiten.

## Was Rob testet, was Claude Code testet

- Claude Code: Determinismus, Psychologie-Tabellen, Verdachtsregeln, Feedback-Payload, Bot-Spreizung, Build.
- Rob und Tester: Spielgefühl, Touch-Ergonomie, Latenz auf echten Geräten, Lesbarkeit der Profile. Diese Hypothesen (GDD 2.7) werden nur durch Gerätefeedback entschieden — nie durch Annahmen im Code.

## Deploy

- Push auf `main` ⇒ Render baut und deployt automatisch. Vor dem Push: `bun run build` lokal, `bun server/index.ts` lokal starten, `/health` und einen Test-`POST /feedback` gegen ein Dummy-Repo prüfen (`GITHUB_REPO` auf ein privates Scratch-Repo zeigen lassen).
- `VITE_BUILD_HASH` = kurzer Git-SHA, wird in jeden Log geschrieben. Ein Issue ohne Build-Hash ist nicht reproduzierbar.
