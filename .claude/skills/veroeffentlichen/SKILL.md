---
name: veroeffentlichen
description: Veröffentlicht die gebaute Seite dist/haus-und-grundstueck-3d.html als privates Artifact „Haus und Grundstück 3D“ unter der festen URL — mit Prüfung der Live-Seite per Hash, in fester Reihenfolge. Löst aus auf „veröffentlichen“, „Artifact aktualisieren“, „Live-Seite aktualisieren“ und nach jedem Build, wenn die Dauerfreigabe in AGENTS.md greift.
---

# Veröffentlichen

Die Regeln (Freigabe, Voraussetzungen, Grenzen) stehen in `AGENTS.md`, Abschnitt „Veröffentlichen“. Hier steht nur der Ablauf. URL: https://claude.ai/artifact/Jpk68akehTMkfHyEyZMxMY

## Warum die Reihenfolge so ist

Der Dienst lehnt jede Veröffentlichung ab, bis die Live-Version **vollständig gelesen** wurde (jede Zeile der gespeicherten Datei, mit `Read` in Stücken von etwa 500 Zeilen). Der erste Versuch nach `read` ohne vollständiges Lesen scheitert deshalb immer, und ein zweiter Versuch mit unverändertem Inhalt direkt danach auch („unverändert erneut gesendet“). Beides sind Sicherungen des Dienstes und keine Fehler im Build.

`dist/veroeffentlicht.json` hält den Hash der zuletzt veröffentlichten Seite. Gleiche Live-Seite heißt: Seit der letzten Veröffentlichung hat niemand etwas auf der Seite geändert, es geht nichts verloren. Die Seite speichert nichts, deshalb ist das der einzige Weg, wie Fremdes dorthin käme.

Erfahrung vom 11.10.2026: Nach einmaligem vollständigem Lesen einer Live-Version wurde die Veröffentlichung beim ersten Versuch angenommen, solange die Version unverändert blieb. Die Ablehnungen kamen vorher, weil das Lesen fehlte, und danach durch das unveränderte Wiederholen.

Zweite Erfahrung: Ist die Live-Version die, die diese Sitzung selbst zuletzt veröffentlicht hat, ist kein erneutes Lesen nötig. Dann genügt `read` mit `path: "index.html"` für die Hash-Prüfung (Schritt 4), und die Veröffentlichung wird beim ersten Versuch angenommen. Das vollständige Lesen (Schritte 2 und 3) ist nur nötig, wenn die Live-Version aus einer anderen Sitzung stammt.

## Ablauf

1. **Voraussetzungen:** `npm test` grün, `npm run build`, Screenshot-Prüfung der betroffenen Ansichten (`tools/shot_view.js`), die gebaute Seite unterscheidet sich vom Stand in `dist/veroeffentlicht.json` (sonst nichts zu tun).
2. **Live-Version holen:** `Artifact` mit `action: "read"` und der URL (ohne `path`). Das Ergebnis nennt die gespeicherte Datei. Nur dieser Weg zählt für den Dienst als „gesehen“; `read` mit `path: "index.html"` liefert zwar eine saubere Kopie samt SHA-256, zählt aber nicht.
3. **Vollständig lesen:** diese Datei mit `Read` ganz lesen (`offset`/`limit`, Stücke bis etwa 500 Zeilen, letzte Zeile mitnehmen). Die Datei nicht verändern.
4. **Hash prüfen:** `node tools/live_pruefen.js pruefen <gespeicherte Datei>`.
   - Exit 0 (gleich): weiter.
   - Exit 1 (weicht ab): **nichts veröffentlichen**, dem Nutzer sagen, was abweicht (Diff gegen `git show <Commit aus dem Stand>:dist/haus-und-grundstueck-3d.html`), und fragen.
   - Exit 2 (kein Stand): die Live-Seite von Hand gegen den Build des letzten Veröffentlichungs-Commits prüfen, dann `node tools/live_pruefen.js setzen <gespeicherte Datei> <Commit>`, dann weiter bei 4.
5. **Veröffentlichen:** `Artifact` mit `url`, `file_path: dist/haus-und-grundstueck-3d.html` und einem kurzen `label`.
6. **Lehnt der Dienst mit „unverändert erneut gesendet“ ab:** Hash war gleich (Schritt 4), also **einmal** dieselbe Veröffentlichung wiederholen. Jeder andere Fehler (Berechtigung, Netzwerk, Inhaltsprüfung) wird gemeldet und weder wiederholt noch umgangen.
7. **Stand fortschreiben:** `node tools/live_pruefen.js setzen dist/haus-und-grundstueck-3d.html`, committen als `chore(build): veröffentlicht` (mit `dist/veroeffentlicht.json`) und pushen. Die Commit-Nachricht des Codes sagt nichts über die Veröffentlichung, sie steht erst im Folgecommit.
8. Dem Nutzer in einem Satz sagen, dass veröffentlicht ist, und die URL nennen.
