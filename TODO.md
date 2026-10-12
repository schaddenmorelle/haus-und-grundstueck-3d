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

## Irgendwann

<!-- Ideen und Annehmlichkeiten. Hier darf etwas liegenbleiben, ohne zu stören —
     genau dafür ist der Abschnitt da. -->

## Offene Fragen

<!-- Was entschieden werden muss, bevor daraus eine Aufgabe werden kann. Mit Datum,
     damit sichtbar ist, wie lange eine Frage schon wartet. -->

- 2026-10-11: Soll es ein Glossar für Fachbegriffe und Raumnamen geben (bisher nur in `AGENTS.md`)?
- 2026-10-11: Soll es eine Architekturdatei (arc42) und ADRs geben, oder reicht `docs/plan-parametrisches-modell.md`?
- 2026-10-12: Terrasse in der Wohnfläche: Anteil 25 % (Regelfall) oder bis 50 % (besonders hochwertig nutzbar)? Gesetzlich ist beides möglich, die Wahl liegt beim Nutzer; derzeit 25 %.
