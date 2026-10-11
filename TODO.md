# Offene Punkte

Die Arbeitsliste dieses Projekts, **von Anfang an** geführt und nicht nachträglich angelegt: Eine Liste, die erst entsteht, wenn es unübersichtlich geworden ist, enthält nur noch das, woran sich gerade jemand erinnert.

## Wie die Liste ehrlich bleibt

- **Im selben Commit.** Wer einen Punkt umsetzt, entfernt ihn in derselben Änderung — nicht später und nicht gesammelt. Wer beim Arbeiten einen neuen Punkt findet, trägt ihn dort ein, wo er hingehört.
- **Erledigtes wird gelöscht, nicht angesammelt.** Ein abgehaktes Kästchen wäre eine zweite Wahrheit neben dem Code, und ein Erledigt-Abschnitt wächst endlos, behauptet irgendwann nur noch Vergangenheit und wird von niemandem mehr gelesen. Verloren geht dabei nichts: Was passiert ist, steht in der Git-Historie — `git log -p TODO.md` zeigt jede Zeile, die hier je stand, samt dem Commit, der sie abgeräumt hat.
- **Ein Punkt sagt, woran man erkennt, dass er fertig ist.** „Fehlerbehandlung verbessern" ist kein Punkt, „bei Zeitüberschreitung eine verständliche Meldung statt des Stacktrace" ist einer.
- **Was eine Entscheidung braucht, steht unter „Offene Fragen"** und nicht bei den Aufgaben. Sonst liegt ein Punkt monatelang unangetastet da, und niemand sieht, dass er gar nicht dran ist, sondern auf jemanden wartet.
- **Ein Agent erfindet hier nichts.** Was ihm nebenbei auffällt, darf er vorschlagen; eingetragen wird, was besprochen ist. Eine Liste, die sich selbst verlängert, ist nach zwei Wochen niemandes Liste mehr.

## Jetzt

<!-- Woran tatsächlich gerade gearbeitet wird. Kurz halten: Mehr als zwei, drei Zeilen
     heißt, dass zu viel gleichzeitig offen ist. -->

## Als Nächstes

<!-- Beschlossen und begründet, aber noch nicht angefangen. -->

- [ ] Phase 1 des Umbauplans (`docs/plan-parametrisches-modell.md`, Abschnitt 8): Daten aus `model.js` in `haus.json` herauslösen (Achsen, gesperrte Außenmaße, Wandtypen, Wände, Öffnungen). Fertig, wenn `model.js` die Daten liest und `npm test` ohne Abweichung vom Snapshot grün bleibt.
- [ ] Ändern über die Oberfläche (Probiermodus, Plan Abschnitt 4, 8 und 9): Maße in der Seite ändern, Prüfung und Auswirkungen anzeigen, den Export als Änderungsliste erzeugen und mit einem Werkzeug im Repository validiert als neue Sollwerte einspielen. Baut auf Phase 1 und `tools/aendern.js` (Phase 4) auf. Fertig, wenn ein in der Seite geänderter Wert exportiert, vom Werkzeug geprüft und eingespielt wird, `npm test` danach grün ist und ein ungültiger Export abgelehnt wird.

- [ ] Südseite der Einfahrt: Stufe zwischen dem Pflaster an der Haustür und dem tieferen Pflaster zum Gartentor, mit Randsteinreihe, Kiesstreifen am Sockel und Gartentor samt Zaun. Fertig, wenn Stufenhöhe, Lage und die Ausdehnung des tieferen Pflasters aus Aufmaß oder Luftbild stammen, `npm test` die Stufe prüft und der Screenshot von Süden zu den Fotos `foto-einfahrt-gartentor` und `foto-einfahrt-tuerbereich-sued` passt.

## Irgendwann

<!-- Ideen und Annehmlichkeiten. Hier darf etwas liegenbleiben, ohne zu stören —
     genau dafür ist der Abschnitt da. -->

## Offene Fragen

<!-- Was entschieden werden muss, bevor daraus eine Aufgabe werden kann. Mit Datum,
     damit sichtbar ist, wie lange eine Frage schon wartet. -->

- 2026-10-11: Soll es ein Glossar für Fachbegriffe und Raumnamen geben (bisher nur in `AGENTS.md`)?
- 2026-10-11: Soll es eine Architekturdatei (arc42) und ADRs geben, oder reicht `docs/plan-parametrisches-modell.md`?
- 2026-10-11: Wohnflächenberechnung: Umsetzung und Berechnungsgrundlage (z. B. Anrechnung nach Höhenzonen im Dachgeschoss) sind offen. Der Plan nennt sie nur unter „danach“.
