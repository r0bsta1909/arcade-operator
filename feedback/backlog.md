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
