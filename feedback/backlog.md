# Backlog

Things noticed during M1 that are out of scope (see BRIEF-M1 Scope-Bremse).

## Aus M1 Schritt 4 (Headless-Review)

- Gnädig- und Heuristik-Bot gewinnen 100 %: ohne Verdacht (2.4) und Overheat (2.1) kostet Gnade nichts. Erwartet, wird in M2 mit `suspicion.test.ts` und `balance.sim.ts` kalibriert.
- Session-Dauer bei Sieg ~28 s, weil M1 bei 3.000 Punkten endet (GDD 6). Für 6–10 Minuten (GDD 0) braucht es 12.000 Punkte und 8 Segmente (M2).
- Langeweile-Abbruch tritt bei Casual mit fixem Kanal 0,45 praktisch nie auf (0 % in 1.000 Läufen). Sinkende Schwellen und Veteran-Profil (M2) sollen das ändern; Text und Zustand existieren bereits.
- „Gnade bemerkt“ (GDD 2.3, +0,10 Frust) ist an Verdacht gekoppelt und daher nicht in M1.

## Aus M1 STOPP 2 (erster Gerätetest, 2026-09-05)

- Rob: „ich verstehe die Steuerung überhaupt nicht, fühlt sich alles random an.“ Umgesetzt: Chip-Ergebnis in der Kontaktzone, Aktions-Flash auf der Lane, Manipulations-Markierung und Nächstes-Hindernis-Pfeil auf dem CRT, Intro-Einblendung (einmalig, „?“ holt sie zurück), σBase 120 → 100.
- Mit σBase 100 verliert der Passiv-Bot nur 67 % (Brief: ≥ 80 %, GDD 5.4: 85–95 %). Bewusst für die erste Testrunde gesenkt, damit Beinahe-Tode statt Serientode entstehen. Vor M2-Abnahme zurück auf ≥ 120 oder über Profile/Segmente lösen.
- Vorhersagekurve erscheint 300 ms vor dem Sprung (GDD 2.2). Zum Entscheiden zu spät, das ist gewollt; ob die Chips allein reichen, entscheidet die Testrunde.

## Aus M1 STOPP 2, zweite Runde (2026-09-05)

- Rob: „ich wische immer nach oben und der Highscore wird immer erreicht.“ Ohne Kosten gibt es keine Entscheidung. Overheat (GDD 2.1) nach M1 vorgezogen; Verdacht (2.4) und Langeweile-Druck bleiben M2. Gnädig-Bot gewinnt mit Overheat noch 96 %, weil Rückwirk-Gnade jeden Tod heilt, sobald die Sperre vorbei ist. Verdacht ist die eigentliche Bremse.
- Bug „zwei Leben auf einmal“: Respawn stand 16 px vor dem vorherigen Wurm. Behoben, Regressionstest über 40 Seeds.
- σBase zurück auf 120 (Passiv verliert 78 % nach dem Respawn-Fix; die früheren 85 % enthielten den Bug).

## Aus M1 STOPP 2, dritte Runde (2026-09-05)

- Overlay zeigte einen Zufalls-Geist (GDD 5.3) → als Lüge gelesen. Jetzt Risiko-Band aus der Fehlerverteilung. GDD 2.2/5.3 geändert.
- Verdacht (GDD 2.4) in M1, Casual-Empfindlichkeit 1,0. Sieg bei 4.500 statt 3.000, Segment 2 auf 32-px-Krater gedeckelt (100-ms-Fenster waren für jeden Bot tödlich).
- Veteran aktiv. Beinahe-Tod gefühlt relativ zu σ; Streak-Langeweile 3 / 0,14. Offen: Tilter und Kind, sinkende Kanalschwellen, Sonden/Meteoriten (M2).

## Aus M1 STOPP 2, vierte Runde (2026-09-05)

- Rob: Lane zu schmal, Wahrscheinlichkeits-Band unlesbar, Hoch-Spam ohne Konsequenz. Umgesetzt: Lane 22 %, Sensoren kompakt, Swipe 28 px / 450 ms; Maschinen-Sicht zeigt den geplanten Sprung (Wahrheit) auf CRT und Chip; Hitze 5/s Zerfall, 5 s Sperre. Gnädig-Bot gewinnt jetzt 27 % (Casual), Orakel-Bot 46 %.
- Versteckte 1-Frame-Coyote-Zeit im Hopper entfernt (Spiel und Solver waren uneins). 
- Offen: Ob die Wahrheits-Anzeige H1 (Zögern beim Scharfen) noch zulässt, entscheidet der Gerätetest. Falls zu leicht: Wahrheit erst ab 500 ms vor dem Sprung zeigen (Chip vorher neutral).

## Aus M1 STOPP 2, „Guitar-Hero-Runde“ (2026-09-05)

- Rob: „zu wenig Guitar Hero, größtenteils zu passiv.“ Entscheidung: Gnade/Härte als getimte Hits (PERFECT/GOOD/LATE/MISS), Combo und Live-Score, Hindernis alle 0,8 s, Tempo-Rampe bis 1,4×. GDD 0/2.2/2.4/2.6/3/5.3 geändert.
- Orakel-Bot gewinnt beim Veteran 100 %: PERFECT-Härte ist ein garantierter Beinahe-Tod. Für Menschen mischt sich GOOD-Härte (tötet ~50 %) hinein; ob das reicht, zeigt der Gerätetest. Fallback: PERFECT-Fenster für Härte auf ±35 ms.
- Passiv-Veteran geht nach 17 s gelangweilt. Beim dichten Takt evtl. zu schnell; Streak-Konstante nach Gerätetest prüfen.
- Musik/Takt-Audio, Slider und Sonden bleiben M2/M3.
