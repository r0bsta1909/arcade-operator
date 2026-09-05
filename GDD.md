# GDD — OPERATOR (Arbeitstitel)

**Genre:** Psychologische Rhythmus-/Management-Simulation mit Perspektivumkehrung
**Plattform:** Browser, Mobile-First (Portrait, Touch), vollständig spielbar am PC (Maus/Tastatur)
**Spieldauer pro Session:** 6–10 Minuten (eine "Münze")
**Version:** 0.2 — Konzeptfassung für Claude Code (Fable 5.1)
**Lizenz:** CC BY-NC 4.0 · **Repo:** öffentlich · **Hosting:** Render.com (Bun Web Service)

**Änderungen gegenüber 0.1:** Gnade als Scharfen-und-Veto-Modell statt Reaktion (2.2), Frust und Langeweile als getrennte Integratoren (2.3), Verdachts-Boden mit Ratsche (2.4), Hazard-Lane als einzige Touch-Zone / CRT als reine Ausgabe (4.1), Server-, Feedback- und Deploy-Architektur (5.5–5.6), Infrastruktur im M1-Umfang (6).

---

## 0. Design-Ziel (Goal Framing)

**Goal Statement:** Der Spieler soll lernen, einen fremden Menschen *zu lesen* und dosiert zu manipulieren, indem er ein unsichtbares Regelwerk (Hitboxen, Timing-Fenster, Gnade/Tod) in Echtzeit steuert — gemessen daran, ob der Spieler nach 3 Sessions vorhersagen kann, wann der Gast kurz vor Abbruch steht, bevor der Sensor es anzeigt.

**Intendierter Spieler-Effekt (Impact First):**
- Der Spieler soll *Spannung aus Verantwortung* fühlen, nicht aus eigener Geschicklichkeit.
- Die zentrale Entscheidung ist immer dieselbe, aber nie gleich: **"Schütze ich ihn beim nächsten Sprung — und wenn er stirbt: lasse ich es zu?"**

**Was das Spiel NICHT ist:** Kein Idle-Game, kein Tower-Defense mit Automat-Skin, kein Reflex-Shooter. Der Spieler gewinnt durch *Antizipation* und richtiges Timing der Gnade, nie durch Reaktionsgeschwindigkeit allein.

**Bewusst benannte Designrisiken:**
1. **Unsichtbare Wirkung.** Manipulationen sind für den Gast unsichtbar, müssen für den Spieler aber ≤ 100 ms lesbar sein. Jede Manipulation hat ein Dashboard-Feedback.
2. **Drei Game-Over-Arten müssen sich verschieden anfühlen.** Frust: schnell, laut, Faustschlag. Langeweile: langsam, leise, Schritte entfernen sich. Verdacht: Klopfen, Münzrückgabe.
3. **Der simulierte Gast ist das eigentliche Spiel.** Verdeckte Profile + Rauschen erzeugen die Undurchschaubarkeit, nicht Modellkomplexität. Mehr verdeckte Achsen würden die Lesbarkeit (H2, H4) verschlechtern.
4. **Reaktionszeit.** Wahlreaktion + Geste liegen bei 350–500 ms. Deshalb ist Gnade keine Reaktion, sondern eine Vorentscheidung (Scharfen) mit Last-Frame-Veto. Reaktiv bleibt nur das rückwirkende Fenster, das der klassische Arcade-Death-Freeze diegetisch abdeckt.
5. **Verdeckung.** Auf 6 Zoll verdeckt die Hand beim Tippen das Spielfeld. Deshalb ist der CRT reine Ausgabe; alle Interaktion läuft über die Hazard-Lane darunter.

---

## 1. Executive Summary & Core Loop

Der Spieler ist der Arcade-Automat. Vor ihm sitzt ein unsichtbarer Mensch ("der Gast"), der den fiktiven 80er-Klassiker **MOON HOPPER** spielt — ein gnadenloser One-Button-Plattformer. Der Spieler sieht das Fake-Game auf dem Röhrenmonitor und darunter das Hardware-Dashboard der Maschine. Er verändert heimlich Hitboxen, Timing-Fenster und Geschwindigkeit und entscheidet pro Hindernis, ob der Gast beschützt wird, und im Todesmoment, ob die Maschine ihn doch noch rettet.

Sieg: Der Gast erreicht den Highscore und trägt jubelnd drei Initialen ein.
Niederlage: Die **Emotionale Toleranz** des Gastes fällt auf null — durch Frust, Langeweile oder Verdacht.

### Core Loop (3 Schritte, Zykluszeit 2–6 Sekunden)

1. **LESEN** — Das nächste Hindernis wandert als Chip durch die Hazard-Lane (1–2 s Vorlauf). Das Dashboard zeigt den Zustand des Gastes (zwei Nadeln: Frust, Langeweile) und sein aktuelles Zittern (Timing-Streuung).
2. **ENTSCHEIDEN** — Der Spieler scharft Gnade für diesen Chip (Swipe hoch), verhärtet ihn (Swipe runter), schrumpft seine Hitbox (Tap) oder tut nichts. Im Todesmoment friert das Bild 400 ms ein — das ist das Veto-Fenster für eine rückwirkende Rettung.
3. **WIRKUNG ABLESEN** — Adrenalin bei Beinahe-Tod, Frust bei Tod, Langeweile bei Streaks ohne Gefahr, Verdacht bei sichtbarer Hilfe. Nadeln und Toleranz verschieben sich. Zurück zu 1.

Meta-Schleife: Der Gast lernt (Skill steigt), der Spieler muss die Schwierigkeit nachziehen — nicht zu schnell (Frust), nicht zu langsam (Langeweile). Der Flow-Kanal verengt sich über die Session.

---

## 2. Gameplay-Mechanik im Detail

### 2.1 Die drei Ressourcen des Spielers

| Ressource | Funktion | Dynamik |
|---|---|---|
| **Emotionale Toleranz** (0–100) | Lebensbalken des Gastes. Sinkt, wenn Frust *oder* Langeweile über der Kanalschwelle liegen. 0 = Game Over. | +2/s im Kanal, −4 bis −12/s außerhalb (proportional zum Überschuss der höheren Achse) |
| **Hitze** (0–100) | Manipulationsbudget. Bei 100 → Overheat: 3 s keine Eingriffe, Lüfter heult. | −8/s passiv |
| **Verdacht** (0–100) | Gefühl des Gastes, das Spiel sei "kaputt" oder unfair leicht. Bei 100 → sofortiger Abbruch. | −1/s passiv, **nie unter den Verdachts-Boden** (2.4). Ehrliche Tode senken Verdacht nicht mehr. |

### 2.2 Interaktion (Hazard-Lane-Modell)

Der CRT ist reine Ausgabe. Alle Gesten finden auf der **Hazard-Lane** statt — ein Streifen direkt unter dem CRT, durch den die nächsten drei Hindernisse als Chips von rechts nach links wandern, synchron zum Scrolling. Ein Chip erreicht die **Kontaktzone** (linker Rand, rot markiert) exakt im kritischen Frame.

**Operator-Overlay (Pre-Signal):** 1 s vor dem kritischen Frame zeichnet eine Overlay-Ebene *über* dem CRT die Maschinen-Sicht auf den nächsten Sprung: den sicheren Landebereich als grünen Balken und die wahrscheinliche Landung des Gastes als Band (erwarteter Absprung ± eine Streuung σ), farbcodiert nach Todeswahrscheinlichkeit (grün < 20 %, bernstein < 50 %, rot ≥ 50 %). Das Band wird breiter, wenn der Gast zittert (Frust), und ist damit die sichtbare Form des JITTER-Werts. Die Overlay-Ebene ist nicht Teil des Fake-Games — der Gast sieht sie fiktional nicht.

*Zweite Änderung nach STOPP 2:* Sobald der Gast sich entschieden hat (er plant seinen Sprung, wenn das Hindernis vorderster Chip wird), zeigt das Overlay **die Wahrheit**: seinen tatsächlichen Absprung als durchgezogene Kurve, grün oder rot, unter der aktuellen Manipulation. Der Chip auf der Lane trägt denselben Punkt: rot pulsierend = stirbt ohne Hilfe, grün = kommt durch. Scharfen färbt den Punkt sofort um, wenn die Gnade reicht. Das Band aus der Verteilung bleibt nur, solange der Gast noch nicht entschieden hat. Grund: Rob las das Wahrscheinlichkeits-Band als Vorhersage, und eine Vorhersage, die jedes zweite Mal „falsch“ ist, ist unlesbar. Die Entscheidung des Spielers verschiebt sich damit von „Wird er sterben?“ zu „Ist mir diese Rettung Hitze und Verdacht wert?“ — der Kern-Konflikt aus Abschnitt 0 bleibt.

*Erste Änderung nach M1 STOPP 2 (2026-09-05):* v0.2 zeichnete einen einzelnen Geist-Sprung aus einem separaten Zufallsstrom, damit das Overlay „Schätzung, keine Wahrheit“ ist. Im Test zeigte der Geist grün, und der Gast starb — die Stichprobe hatte mit dem echten Sprung nichts zu tun und wurde als Lüge gelesen. Das Band zeigt die Verteilung statt einer Ziehung: ehrlich, ohne Orakel zu sein.

| Geste | Wo | Wirkung | Hitze | Verdacht |
|---|---|---|---|---|
| **Swipe hoch auf Chip** | Lane | **Gnade scharfen:** Chip leuchtet cyan. Erreicht er die Kontaktzone und der Gast hätte versagt, greifen 120 ms Coyote-Time + vergrößerte Landefläche. Greift die Gnade nicht (Gast schafft es allein), verfällt sie ohne Verdacht. | +20 beim Scharfen, +10 wenn sie greift | Nur wenn sie greift: nach Timing-Delta (2.4) |
| **Swipe runter auf Chip** | Lane | **Veto / Härte:** Ist Gnade gescharft → aufgehoben (Hitze bleibt verbraucht). Sonst → Timing-Fenster für diesen Chip auf 40 ms verengt. | +15 (nur Härte) | Niedrig |
| **Swipe hoch im Death-Freeze** | Lane | **Rückwirkende Gnade:** Beim Tod friert der CRT 400 ms ein (klassischer Arcade-Beat, diegetisch). Swipe hoch in diesem Fenster macht den Tod rückgängig ("er hat es gerade so geschafft"). | +35 | 0–150 ms nach Tod: mittel; 150–400 ms: hoch |
| **Tap auf Chip** | Lane | **Hitbox-Shrink:** Hitbox −40 % für dieses Hindernis, Sprite unverändert. Nur solange der Chip *vor* der Kontaktzone ist; in der Kontaktzone ist er ausgegraut. | +10 | Null (nie während Kontakt möglich) |
| **Long-Press auf Lane (≥ 400 ms)** | Lane | **Bullet-Time-Fake:** Spiel 50 % langsamer, Musik pitcht runter, max. 1,5 s. Gast liest es als dramatischen Moment. | +30 | Niedrig, aber +Langeweile-Drift bei Wiederholung |
| **Slider SPEED** | Dashboard | Scroll-Geschwindigkeit 0,7×–1,6×, Rampe über 2 s. | 0 | Null bei Rampe |
| **Slider WINDOW** | Dashboard | Globales Timing-Fenster 40–160 ms. | 0 | Null |
| **Toggle SPAWN** | Dashboard | SPARSE / NORMAL / DENSE, wirkt ab nächstem Segment. | 0 | Null |
| **Doppel-Tap Münzschlitz** | Dashboard | **Free Credit** nach dem letzten Leben ("CONTINUE? 9…8…"). Senkt Toleranz nicht, +Langeweile leicht. | +40 | Mittel |

**PC-Mapping:** Swipe hoch/runter = `W`/`S` bzw. Pfeiltasten (wirken auf den vordersten Chip; `1`–`3` wählen Chip), Tap = Linksklick auf Chip, Long-Press = Leertaste halten, Slider = Mausrad, Münze = `C`.

**Warum Scharfen statt Reaktion:** Die Entscheidung "beschütze ich ihn?" fällt mit 1–2 s Vorlauf bewusst. Die Reaktion im Todesmoment ist eine Einzelgeste ohne Dashboard-Blick — machbar in 400 ms. Gescharfte, nicht benötigte Gnade kostet Hitze ohne Nutzen; das ist der Preis für Vorsicht. Wer immer scharft, überhitzt; wer nie scharft, verlässt sich auf das teure Rückwirk-Fenster.

### 2.3 Flow-Messung: Frust und Langeweile als getrennte Achsen

Zwei Leaky-Integratoren, beide `∈ [0, 1]`, beide mit eigener Zerfallsrate:

- `frustration` — Zerfall −0,04/s
- `boredom` — Zerfall −0,03/s

Beide können gleichzeitig hoch sein (Veteran, der an trivialen Stellen billig stirbt). Das 1D-Modell aus v0.1 konnte das nicht abbilden.

**Flow-Kanal:** Beide Werte unter Schwelle. Anfang: `frustration < 0,45` und `boredom < 0,45`. Die Schwellen sinken über die Session (Minute 8: 0,30 / 0,30). Mit steigendem Skill sinkt die Langeweile-Schwelle schneller als die Frust-Schwelle — der Gast *braucht* mehr Reiz.

**Ereignistabelle** (Startwerte für die Headless-Sim):

| Ereignis | Δ frustration | Δ boredom | Kommentar |
|---|---|---|---|
| Tod (ehrlich) | +0,18 | −0,05 | Serientode quadratisch: 3. Tod in 20 s = +0,45 |
| Tod bei ≥ 90 % Highscore | +0,30 | −0,05 | "Fast geschafft" ist der stärkste Frust |
| Beinahe-Tod (Delta < 60 ms, überlebt) | +0,08, dann −0,15 über 3 s | −0,12 | Adrenalin-Spike, Erleichterung — beste Flow-Quelle. *Gefühlt* wird er nur, wenn der Abstand auch unter der eigenen Streuung σ liegt (M1-Kalibrierung: ein 30-ms-Veteran erschrickt nicht bei 50 ms Abstand) |
| Gnade bemerkt (Verdacht +) | +0,10 | +0,05 | "Fühlt sich komisch an" |
| Sprung ohne Gefahr (Streak ≥ 3) | 0 | +0,14 pro Sprung | Langeweile schleicht. Startwerte 5 / 0,06 erzeugten in 45-s-Runden nie Langeweile (M1-Kalibrierung 2026-09-05) |
| Neues Segment / neuer Gegnertyp | 0 | −0,10 | Neugier |
| Punkte-Meilenstein (1.000) | −0,05 | −0,12 | Belohnung |
| Bullet-Time | −0,05 | −0,03, danach +0,02/s für 10 s | Abnutzung |
| Verdacht > 50 | — | halbiert die Erleichterung nach Beinahe-Tod | "Ich hätte eh nicht sterben können" |

**Persönlichkeitsprofile** (zufällig pro Session, dem Spieler nur über Verhalten erkennbar, Reveal im Debrief):

| Profil | Skill-Start | Lernrate | Frust-Mult. | Langeweile-Mult. | Verdachts-Empfindlichkeit |
|---|---|---|---|---|---|
| **Der Casual** | 0,35 | hoch | 1,4 | 0,7 | niedrig |
| **Der Veteran** | 0,75 | niedrig | 0,8 | 1,5 | hoch |
| **Der Tilter** | 0,55 | mittel | 2,0 bei Serientoden | 0,9 | mittel |
| **Das Kind** | 0,30 | sehr hoch | 1,0 | 1,2 | sehr niedrig |

**Dashboard-Darstellung:** Zwei analoge Nadeln (FRUST rot, BORED blau) auf einer gemeinsamen Skala mit grünem Kanalband; Puls-Oszilloskop (Frequenz = max(frustration, boredom-invers)); Gehäuse-Mikrofon mit Reaktionstexten; Toleranz als Rissbalken, flackert < 30. Zusätzlich **JITTER**: die aktuelle Timing-Streuung des Gastes als Zitterbreite — steigt mit Frust, ist die Vorwarnung, dass Scharfen sich lohnt.

### 2.4 Verdachtssystem mit Boden-Ratsche

Verdacht steigt bei:
- Gnade greift bei Timing-Delta > 120 ms (der Gast "weiß", dass er verpasst hat): +25
- Gnade greift bei Delta 60–120 ms: +10; < 60 ms: +3
- Rückwirkende Gnade 0–150 ms nach Tod: +15; 150–400 ms: +35
- Zwei greifende Gnaden innerhalb 10 s: +15 zusätzlich
- Speed-Sprung statt Rampe (> 0,2× in < 1 s): +20

**Verdachts-Boden:** Jedes verdächtige Ereignis hebt einen Session-Mindestwert um 30 % seines Zuwachses. Verdacht zerfällt mit −1/s, aber nie unter den Boden. Ehrliche Tode senken Verdacht *nicht* (v0.1-Regel gestrichen). Damit ist die "Opfer-Taktik" — Gast gezielt töten, um Verdacht abzubauen — wirkungslos; ein Härte-Tod kostet nur Leben und Frust.

Endgame (≥ 90 % Highscore): Verdachts-Empfindlichkeit +30 %, weil der Gast konzentriert ist.

### 2.5 Session-Struktur & Siegbedingung

- **Start:** Münze fällt, Profil gewürfelt, "PLAYER 1 READY". Drei Leben.
- **Highscore-Ziel:** 12.000 Punkte (Balancing-Variable).
- **Death-Freeze:** Jeder Tod friert den CRT 400 ms ein (Rolling-Bar-Störung). Das ist zugleich das Rückwirk-Fenster.
- **Sieg:** Highscore überschritten → "NEW HIGH SCORE — ENTER YOUR INITIALS". Der Gast tippt animiert drei Buchstaben (mit einem korrigierten Tippfehler). Mikrofon: *"JAAAA!"*. Dann Debrief.
- **Niederlagen:** Frust-Abbruch (Toleranz 0, frustration dominant): Faustschlag, CRT wackelt, "PLAYER 1 LEFT". Langeweile-Abbruch (boredom dominant): Schritte entfernen sich, Attract-Mode, "INSERT COIN". Verdachts-Abbruch (Verdacht 100): Klopfen, "THIS THING IS RIGGED", Münzrückgabe.
- **Letztes Leben ohne Free Credit:** Nach dem dritten Tod läuft "CONTINUE? 9…8…" (9 s). Greift kein Free Credit (M2), geht der Gast. Die Abbruchart richtet sich nach der Achse, die ihre Schwelle stärker überschreitet; im Log steht `cause: "lives"` statt `"tolerance"`, damit Debrief und Digest beide Wege unterscheiden können. (Ergänzt in M1 Schritt 4: Das Modell in 2.1 kannte nur Toleranz 0 als Niederlage, aber ohne Continue endet das Fake-Game physisch.)

### 2.6 Debrief-Screen

1. Beide Kurven (Frust, Langeweile) über die Session mit Kanalband.
2. Marker für jedes Scharfen, jede greifende Gnade, jedes Veto, jeden Tod — mit Timing-Delta.
3. Profil-Reveal mit einem Satz: *"Der Veteran langweilt sich bei Streaks über 4 — du hast ihm 7 gegeben."*
4. **Operator-Score:** Zeit im Kanal (%) × Highscore-Erreichung × (1 − Verdacht/100).
5. **Feedback-Button** (siehe 5.5) — der Debrief ist der primäre Feedback-Moment.

### 2.7 Testbarkeit

| Hypothese | Erwartetes Verhalten | Falsifiziert, wenn |
|---|---|---|
| H1: Kern-Konflikt trägt | Spieler zögern beim Scharfen in Endgame-Nähe und benutzen das Veto | Scharfen bei jedem Chip reflexartig |
| H2: Verdacht ist verständlich | Spieler erklären nach 2 Sessions, warum der Gast misstrauisch wurde | > 50 % nennen es "zufällig" |
| H3: Game-Over-Arten fühlen sich verschieden an | Langeweile-Abbruch wird als "hab's kommen sehen" beschrieben | Beide gleich beschrieben |
| H4: Profile sind lesbar | ≥ 60 % raten das Profil vor dem Reveal richtig | ≤ 35 % (Zufall 25 %) |
| H5: Rückwirk-Fenster ist erreichbar | Gemessene Latenz Death-Event → Swipe-Ende < 400 ms in ≥ 80 % der Versuche | Median > 400 ms → Freeze verlängern |
| H6: Hazard-Lane statt CRT-Touch | Kein Tester versucht, auf den CRT zu tippen, nach 1 Minute | ≥ 30 % tippen auf den CRT |

---

## 3. Das Fake-Game: MOON HOPPER (1983)

**Optik:** Vier-Farben-Palette (Schwarz, Cyan, Magenta, Weiß), 160×144 Logikpixel, Scanlines, leichte Wölbung. Zwischen *Pitfall!* und *Moon Patrol*.

**Regeln:**
- Auto-Scrolling One-Button-Plattformer, Hopper rennt nach rechts. Einzige Gast-Eingabe: Sprung, feste Höhe.
- Hindernisse: **Krater** (Lücke), **Mondwurm** (überspringen), **Sonde** (fliegt in Sprunghöhe — *nicht* springen), **Meteorit** (fällt, Schatten als Vorwarnung).
- Punkte: +10/Meter, +100/Gegner, +500/Segment. 8 handgebaute Segmente à 20 s. Kein prozeduraler Zufall in M1–M3.
- Drei Leben, Death-Freeze 400 ms, kein Continue außer Free Credit.

**Der simulierte Gast** (`HumanAgent`): Sieht ein Hindernis, berechnet den idealen Sprungframe, addiert Fehler `N(bias, σ)` mit `σ = f(1 − skill, frustration)` — Tilt-Spirale. Erkennungsfehler bei Sonden: `p = (1 − skill) × 0,3`. Skill +`learnRate × 0,02` pro Segment. Der Agent kennt weder Manipulation noch Overlay.

---

## 4. UI/UX Design (Mobile First, Portrait)

### 4.1 Layout (Referenz 390×844, skalierend)

```
┌──────────────────────────────┐
│  HI 12000    1UP 03450   ♥♥♥  │  ← Fake-Game-HUD
│ ┌──────────────────────────┐ │
│ │     CRT / MOON HOPPER    │ │  ← 36 % Höhe, REINE AUSGABE
│ │     + Operator-Overlay   │ │     (Geist-Sprungkurve, Landemarker)
│ │       (Geist, Marker)    │ │     keine Touch-Verarbeitung
│ └──────────────────────────┘ │
│ ▓▓▓▓▓▓▓▓░░░░░░  TOLERANCE    │  ← Rissbalken, 4 %
├──────────────────────────────┤
│ ▌KONTAKT│ ◆wurm  ○krater  ▲sonde  ← HAZARD-LANE, 22 % Höhe (v0.2: 12 %, nach STOPP 2 vergrößert; Sensoren 11 %, Regler 10 %)
│ ▌  ZONE │  cyan   grau           │     Chips wandern nach links
│         │ ↑ Gnade  ↓ Veto  · Tap │     einzige Gesten-Zone oben
├──────────────────────────────┤
│  ╭ FRUST ╮ ╭ BORED ╮ ╭ PULSE ╮ │
│  │ ◄═●══ │ │ ══●═► │ │ ∿∿∿∿ │ │  ← Sensoren, 14 %
│  ╰───────╯ ╰───────╯ ╰──────╯ │
│  JITTER ▁▂▃▅▃▂   🎙 "…ok, nochmal" │
├──────────────────────────────┤
│  SPEED  ●────────  1.0×      │
│  WINDOW ────●────  90ms      │  ← Regler, 18 %
│  SPAWN  [SPARSE][●NORM][DENSE]│
│  HEAT   ▓▓▓▓░░░░░░  38%  🌀   │
│  [ ◎ COIN ]     [ ✎ FEEDBACK ]│  ← 6 %
└──────────────────────────────┘
```

**Regeln:**
- Alles unterhalb des CRT ist mit dem Daumen erreichbar. Der CRT nimmt keine Pointer-Events an; Touch dort zeigt kurz einen Hinweis-Pfeil auf die Lane (H6-Messung: solche Touches werden geloggt).
- Die Lane ist die einzige Gesten-Zone; Regler und Lane haben Pointer-Capture pro Zone.
- Farbcodierung: **Grün** = im Kanal, **Bernstein** = Warnung, **Rot** = kritisch/Kontaktzone, **Cyan** = Manipulation aktiv, **Grau** = nicht mehr manipulierbar.
- Death-Freeze: Lane pulsiert 400 ms rot mit sichtbar ablaufendem Balken — der Spieler sieht, wie viel Veto-Zeit bleibt.

### 4.2 PC-Layout (Landscape ≥ 1024 px)

CRT links (55 % Breite, Automat-Gehäuse als Rahmen), rechts Servicepanel: Lane oben, Sensoren, Regler. Tastenkürzel als Labels.

### 4.3 Feedback-Prinzipien

- Jede Manipulation: Cyan-Flackern des Elements + Relais-Klicken ≤ 100 ms.
- Tod: Rolling-Bar auf dem CRT, Freeze 400 ms, Mikrofon reagiert nach 300 ms.
- Overheat: Lüfter, Regler grau, 3-s-Countdown.
- Verdacht > 70: Mikrofon zeigt "…?", Nadeln zittern.

### 4.4 Audio

Zwei Busse: Chiptune (aus dem Monitor, gefiltert) und Hardware (Relais, Lüfter, Münze, Gast-Geräusche). Bullet-Time pitcht nur den Chiptune-Bus.

---

## 5. Technische Architektur

### 5.1 Stack

**Vite + TypeScript + Canvas 2D (CRT + Overlay) + DOM/CSS (Dashboard), keine Engine. Bun-Server für Hosting und Feedback.**

- Keine Phaser: Overhead ohne Nutzen bei vier Gegnertypen, erschwert Determinismus und Headless-Tests.
- Kein UI-Framework: Das Dashboard braucht einen 40-Zeilen-Store, nicht React.
- Canvas 2D reicht; WebGL-CRT-Shader ist optionales M4-Upgrade.
- Audio: Web Audio API. Tests: `vitest`. Server: Bun (`Bun.serve`), liefert `dist/` und `POST /feedback`.

**Determinismus als Gesetz:** Fixed Timestep 60 Hz, alle Zufallsquellen über seedbare PRNG (`mulberry32`), Rendering rein lesend. Gleicher Seed + gleiche Operator-Inputs = gleicher `SessionLog`. Grundlage für Replays, Debrief, Balancing-Sim und Feedback-Reproduktion.

### 5.2 Ordnerstruktur

```
operator/
├── README.md · LICENSE (CC BY-NC 4.0) · CLAUDE.md · GDD.md · BRIEF-M1.md
├── package.json · bunfig.toml · vite.config.ts · tsconfig.json · render.yaml
├── .github/
│   ├── workflows/ci.yml            # vitest + typecheck + build bei jedem Push
│   └── ISSUE_TEMPLATE/feedback.yml # manuelles Feedback, gleiche Felder wie der Button
├── public/audio/
├── server/
│   ├── index.ts                    # Bun.serve: static dist/ + POST /feedback + GET /health
│   ├── feedback.ts                 # Validierung, Invite/Rate-Limit, Issue-Erstellung
│   └── rateLimit.ts
├── scripts/
│   ├── feedback-digest.ts          # gh issue list → tabellarische Zusammenfassung für Claude Code
│   └── replay.ts                   # SessionLog-JSON → Headless-Replay, prüft Determinismus
├── src/
│   ├── main.ts
│   ├── core/        GameLoop · Rng · Store · EventBus · Clock
│   ├── session/     GameStateManager · SessionConfig · SessionLog
│   ├── arcade/      FakeArcadeGame · Hopper · Obstacle · Segments · ManipulationLayer · CrtRenderer · OverlayRenderer
│   ├── human/       HumanAgent · HumanPsychologyEngine · Profiles · Voice
│   ├── operator/    OperatorInput · OperatorActions · HeatSystem · LatencyProbe
│   ├── dashboard/   Dashboard · HazardLane · FlowMeters · PulseScope · JitterBar · Sliders · ToleranceBar
│   ├── debrief/     DebriefScreen
│   ├── feedback/    FeedbackDialog · FeedbackPayload · deviceInfo
│   ├── audio/       AudioBus
│   └── styles/      tokens.css · layout.css · dashboard.css
└── tests/
    ├── psychology.test.ts · determinism.test.ts · suspicion.test.ts
    ├── feedback.test.ts            # Payload-Validierung, Größenkappung
    └── balance.sim.ts
```

### 5.3 Kernklassen & Verträge

- **`GameLoop`** — 60 Hz Fixed-Timestep, Render mit Alpha. Bullet-Time über `Clock.timeScale`.
- **`GameStateManager`** — `'ATTRACT' | 'READY' | 'PLAY' | 'DEATH_FREEZE' | 'CONTINUE' | 'VICTORY' | 'ABORT_FRUST' | 'ABORT_BORED' | 'ABORT_SUSPECT' | 'DEBRIEF'`. `DEATH_FREEZE` ist ein eigener Zustand mit 400-ms-Timer, in dem nur das Rückwirk-Veto erlaubt ist.
- **`FakeArcadeGame`** — `tick(dt, manip)`, `getUpcomingHazards(n=3): Hazard[]` (mit `framesUntilCritical`, `idealJumpFrame`), emittiert `Death`, `NearMiss(deltaMs)`, `SegmentCleared`, `ScoreMilestone`. Kennt den Gast nicht.
- **`HumanAgent`** — `tick(dt, world, psyche): HumanInput | null`. Reine Funktion der Sicht. Liefert zusätzlich `jumpRisk(hazard): { expectedX, sigmaPx, safeMin, safeMax, deathProbability }` für das Overlay — deterministisch aus der Fehlerverteilung, kein eigener PRNG-Stream (geändert nach M1 STOPP 2, siehe 2.2).
- **`HumanPsychologyEngine`** — `apply(event)`, `tick(dt)`, `state: { frustration, boredom, tolerance, suspicion, suspicionFloor, channel: { frustMax, boreMax }, skill, jitter }`.
- **`ManipulationLayer`** — hält `ManipulationState` pro Hazard-ID (`armed`, `hardened`, `hitboxScale`) plus global (`windowMs`, `speedTarget`, `timeScale`). Berechnet Sichtbarkeit greifender Gnade → Verdacht.
- **`HazardLane`** — DOM-Komponente, bindet Chips an Hazard-IDs, nimmt Gesten entgegen, emittiert `OperatorAction` mit `hazardId`.
- **`OperatorInput`** — Pointer-Events auf Lane und Regler; Swipe ≥ 28 px in ≤ 450 ms vertikal dominant (v0.2: 40 px / 250 ms, gelockert nach Gerätetest STOPP 2); Tap ≤ 200 ms; Long-Press ≥ 400 ms. Tastatur-Mapping.
- **`LatencyProbe`** — misst `Death`-Event → Swipe-Ende in ms, schreibt ins `SessionLog` (H5). Loggt außerdem Touches auf dem CRT (H6).
- **`SessionLog`** — Append-only, Frame-nummeriert, serialisierbar. Enthält Seed, Profil, Config-Hash, alle Game- und Operator-Events, Latenzmessungen.

### 5.4 Headless-Balancing

`balance.sim.ts`: 1.000 Sessions ohne DOM mit drei Bot-Operatoren — *Passiv* (nie), *Gnädig* (scharft jeden Chip), *Heuristik* (scharft bei `jitter > 0,3` und `suspicion < 40`, Veto bei `boredom > 0,35`). Ziel: Passiv verliert 85–95 %, Gnädig scheitert zu > 60 % an Verdacht oder Overheat, Heuristik gewinnt 40–60 %.

### 5.5 Feedback-Pipeline

**Ziel:** Jedes Tester-Feedback landet als GitHub-Issue mit reproduzierbarem SessionLog, damit Claude Code Issues maschinell auslesen und Sessions headless nachspielen kann.

**Client (`FeedbackDialog`):** Button im Debrief (primär) und dauerhaft im Dashboard. Felder: Kategorie (`bug` / `feel` / `balance` / `idea` / `other`), Freitext (max. 2.000 Zeichen), optional Name/Handle. Automatisch angehängt: `deviceInfo` (UA, Viewport, DPR, Touch ja/nein, Landscape/Portrait), Build-Hash, aktueller oder letzter `SessionLog`.

**Server (`POST /feedback`):**
1. Validierung (Zod-Schema, Größenkappung: Log > 60.000 Zeichen → erste 300 + letzte 1.500 Events + Hinweis).
2. Schutz nach Phase (Env `PHASE=friends|public`):
   - `friends`: Invite-Code aus Link (`?invite=…`, in `localStorage`) muss in `INVITE_CODES` liegen.
   - `public`: Honeypot-Feld leer, IP-Rate-Limit 5 Issues/Stunde, Freitext ≥ 10 Zeichen.
3. Issue via GitHub REST (`GITHUB_TOKEN` fine-grained, nur `issues:write` auf dieses Repo):
   - Titel: `[feedback][<kategorie>] <erste 60 Zeichen>`
   - Labels: `feedback`, `cat:<kategorie>`, `phase:<m1|m2|…>` (aus Build-Config)
   - Body: Metadaten-Tabelle, Freitext, `<details>`-Block mit ```` ```json ```` SessionLog.
4. Antwort: Issue-URL, wird dem Tester als "Danke — #42" angezeigt.

**Auslesen (`scripts/feedback-digest.ts`):** `gh issue list --label feedback --state open --json number,title,body,labels,createdAt` → Tabelle nach Kategorie, extrahiert Latenz-Median (H5), CRT-Touch-Quote (H6), Profil-Verteilung; schreibt `feedback/digest-<datum>.md`. `scripts/replay.ts <issue-nr>` lädt den Log und spielt ihn headless nach.

**Datenschutz:** Kein Tracking, keine Cookies außer `localStorage` für Invite-Code. Der Dialog sagt vor dem Absenden, dass Text, Gerätedaten und Spiellog öffentlich im Repo landen.

### 5.6 Repo & Deploy

- **Repo:** `github.com/<rob>/operator`, public, CC BY-NC 4.0. Branch `main` = deployed. Conventional Commits.
- **CI:** `.github/workflows/ci.yml` — `bun install`, `tsc --noEmit`, `vitest run`, `vite build`.
- **Render:** `render.yaml` Blueprint, Web Service Free, `buildCommand: bun install && bun run build`, `startCommand: bun server/index.ts`, Health-Check `/health`. Env: `GITHUB_TOKEN`, `GITHUB_REPO`, `PHASE`, `INVITE_CODES`. Free-Tier-Spin-down ist akzeptiert; das Frontend zeigt beim ersten Laden "Automat fährt hoch…" (Attract-Mode wartet auf `/health`).
- **Build-Hash** wird zur Build-Zeit als `VITE_BUILD_HASH` injiziert und in jeden Log geschrieben.

---

## 6. Iterativer Entwicklungsplan

### Meilenstein 1 — Klickbarer Core-Loop-Prototyp + Infrastruktur (2 Sessions)

**Ziel:** Scharfen und Veto fühlen sich auf dem Handy nach Entscheidung an; Freunde können testen und Feedback hinterlassen.

Umfang:
- Repo, Lizenz, CI, `render.yaml`, Bun-Server mit `/feedback` (Phase `friends`), Deploy auf Render
- `GameLoop`, `Rng`, `Store`, `EventBus`, `SessionLog`
- `FakeArcadeGame` mit 2 Segmenten, Krater + Würmer, Rechteck-Grafik in 4 Farben, Death-Freeze 400 ms
- `HumanAgent` mit Normalverteilung, `predictedJump`, ein festes Profil (Casual)
- `HumanPsychologyEngine` mit frustration, boredom, tolerance, fixem Kanal — **ohne** Verdacht, ohne Hitze-Overheat
- `HazardLane` mit Chips, Scharfen (Swipe hoch), Veto/Härte (Swipe runter), Rückwirk-Gnade im Freeze; `OverlayRenderer` mit Geist-Kurve
- `LatencyProbe`, CRT-Touch-Logging
- Dashboard roh: zwei Nadeln, Toleranz, Jitter, Hitze-Zahl
- Game Over bei Toleranz 0 (Frust/Langeweile bereits mit unterschiedlichem Text), Sieg bei 3.000 Punkten
- Minimaler Debrief: beide Kurven als Polyline + Feedback-Button
- `determinism.test.ts`, `feedback.test.ts` grün

**Abnahme:** Fünf Runden auf deinem Handy plus drei Freunde. Fragen: Habe ich beim Scharfen gezögert (H1)? Latenz-Median < 400 ms (H5)? CRT-Touches < 30 % (H6)? Wenn H5 fällt → Freeze auf 500 ms, wenn H6 fällt → Lane visuell aufwerten, bevor M2.

### Meilenstein 2 — Vollständige Operator-Werkzeuge, Verdacht, Balancing (2 Sessions)

- Tap-Hitbox-Shrink, Long-Press-Bullet-Time, Slider, Free Credit, Overheat
- Verdachtssystem mit Boden-Ratsche und Sichtbarkeitsberechnung
- Vier Profile, Skill-Lernkurve, sinkende Kanalschwellen
- Sonden, Meteoriten, 8 Segmente
- Drei unterscheidbare Abbrüche mit Sound
- `psychology.test.ts`, `suspicion.test.ts` (Opfer-Taktik darf Verdacht nicht senken), `balance.sim.ts` bis die Spreizung aus 5.4 steht
- `feedback-digest.ts`, `replay.ts`; erster Digest aus M1-Feedback als Input
- PC-Tastatur-Mapping

**Abnahme:** Bot-Spreizung erreicht; Tester raten Profile ≥ 60 % (H4).

### Meilenstein 3 — CRT-Look, Dashboard-Design, Audio, Debrief (2 Sessions)

- `CrtRenderer` mit Scanlines, Wölbung, Rolling-Bar; MOON-HOPPER-Sprites
- Dashboard nach 4.1, Landscape-Layout
- `AudioBus`, Chiptune + Hardware, Bullet-Time-Pitch
- Mikrofon-Texte, Sieg-Sequenz mit Initialen
- Voller `DebriefScreen` mit Markern, Profil-Reveal, Operator-Score
- Attract-Mode mit "Automat fährt hoch…"

**Abnahme:** H3 — Game-Over-Arten werden unterschiedlich beschrieben.

### Meilenstein 4 — Progression, Polish, öffentliche Phase (1–2 Sessions)

- Session-Ketten mit schwierigeren Gästen, lokale Operator-Bestenliste
- Tutorial als geskriptete erste Session
- Performance-Pass (Mid-Range-Android, 60 fps), PWA-Manifest
- `PHASE=public`: Rate-Limit + Honeypot aktiv, Invite-Code entfällt
- Optional: WebGL-CRT-Shader, Replay-Viewer aus SessionLog

**Abnahme:** 10-Minuten-Session auf einem drei Jahre alten Android ohne Frame-Drops; ein Fremder versteht den Loop nach dem Tutorial.

---

## 7. Offene Design-Fragen (nicht blockierend)

1. Stammkunde mit Verdachts-Gedächtnis über Sessions vs. jedes Mal neuer Gast.
2. Gast jemals visuell zeigen? Aktuell nein — das Mikrofon reicht.
3. Zwei-Operator-Duell für das LAN-Ökosystem, nach M4.

*Alle Zahlenwerte sind Startwerte für die Headless-Sim und werden in M2 kalibriert.*
