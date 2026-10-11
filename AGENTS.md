# Regelwerk für dieses Repository

Privates, maßstabsgetreues, interaktives 3D-Modell von Grundstück, Haus und Dachausbau (Three.js r128, eine einzelne HTML-Datei). Dazu soll eine Wohnflächenberechnung kommen. Kein Bauantrag, keine öffentliche Seite.

Dieses Dokument regelt die **Zusammenarbeit mit KI-Agenten**. Fachliche Randbedingungen und die Architektur stehen in den eigenen Dokumenten des Projekts `CLAUDE.md` (Randbedingungen, Koordinaten, Annahmen), `README.md` und `docs/` und werden hier **nicht wiederholt** — doppelt gepflegte Regeln laufen auseinander, und dann weiß niemand, welche gilt.

## Skills aus dem Startpaket

Der Skill **`wissensrueckgabe`** unter `.claude/skills/` bleibt dauerhaft hier: Am Ende oder an größeren Meilensteinen trägt er zusammen, was aus diesem Projekt dauerhaft wissenswert ist, und schreibt es für die Übernahme in die Wissensdatenbank auf.

## Sprache

Dokumentation, Code-Kommentare und Commit-Nachrichten auf **Deutsch**. Im Code gilt die Mischung: Modul- und Funktionsnamen englisch (`decodeFrame`, `connectToDevice`), Fachbegriffe in der Sprache der Domäne, Variablen und alle **nutzersichtbaren Texte** — Fehlermeldungen, CLI-Ausgaben, Oberfläche — deutsch.

Ein Glossar gibt es noch nicht (siehe `TODO.md`, „Offene Fragen“). Raumnamen und das Koordinatensystem stehen in `CLAUDE.md` und bleiben unverändert. Fremde Bezeichner aus Protokollen gibt es hier nicht.

## Setup

Entwicklungsumgebung: Devcontainer unter `.devcontainer/` (Ubuntu 24.04, multi-arch). Geöffnet wird mit Cursor (Erweiterung `anysphere.remote-containers`, **nicht** `ms-vscode-remote.remote-containers`) oder der CLI `@devcontainers/cli`.

- **Mac:** Podman mit laufender Machine. `dev.containers.dockerPath` **muss** auf `.devcontainer/podman-wrapper.sh` zeigen (nicht nur `podman`) — sonst hängt „Starting container" und der Workspace bleibt nur lesbar.
- **Windows:** Docker Desktop mit WSL2-Integration; Workspace aus dem WSL-Dateisystem öffnen (`/home/…`), nicht über `/mnt/c`. Dazu ein laufender SSH-Agent in der WSL-Distro, sonst scheitert jeder `git pull` im Container.

Erster Build dauert einige Minuten, jeder Rebuild danach unter einer Minute (Layer-Cache).

## Build- und Testbefehle

Nach **jeder** Änderung am Code laufen:

- Test: `npm test` (`tools/test_model.js`)
- Typprüfung: nicht eingerichtet
- Lint / Format: nicht eingerichtet
- Build: `npm run build` (`python3 build.py`)
- Start (lokal): `dist/test_page.html` bzw. `dist/haus-und-grundstueck-3d.html` im Browser öffnen; Screenshots mit `tools/shot_view.js` (siehe `CLAUDE.md`)

Vor dem ersten Test einmal `npm ci`.

## Architektur

Quellen in `src/` (`model.js` Geometrie, `app.js` Steuerung, `tpl.html` Seite), `build.py` fügt sie zu einer HTML-Datei in `dist/` zusammen. Aufbau der Ordner in `README.md`, geplanter Umbau (Datenmodell, 2D-Bemaßung, Prüfung) in `docs/plan-parametrisches-modell.md`. Eine arc42-Datei und ADRs gibt es noch nicht (siehe `TODO.md`, „Offene Fragen“).

Empfehlung: Architekturdokumentation von Anfang an mitführen, nicht am Ende nachtragen — eine abgespeckte Fassung von **arc42** mit **Mermaid**-Diagrammen, mitwachsend statt nachträglich. Der Grund ist nicht Ordnungsliebe: Wer mit Agenten arbeitet, braucht ein Dokument, in das der Agent hineinschaut, sonst erfindet er die Struktur bei jedem Lauf neu. Entscheidungen mit Tragweite bekommen einen kurzen, datierten Eintrag (ADR), damit später nachvollziehbar ist, **warum** etwas so ist.

## Arbeitsweise und Tests

- **Tests zuerst.** Ein Test ist der präziseste Prompt, den es gibt: klein, klar benannt, eine Anforderung. Reihenfolge: Dokumentation und Entwurf, dann Tests, dann Umsetzung, dann Umbau mit grünen Tests als Netz. Diese Regel ausdrücklich hier festhalten — sonst überspringen Agenten sie.
- **Erst rot, dann grün.** Ein Test, der noch nie fehlgeschlagen ist, hat nichts bewiesen.
- **Nur an abgestimmten Nahtstellen.** Tests prüfen Verhalten über die **öffentliche Schnittstelle**, nicht Interna — sonst zementieren sie die heutige Umsetzung und jeder Umbau bricht sie.
- **Erwartete Werte stammen aus einer unabhängigen Quelle** — aus der Dokumentation, einem Mitschnitt, einem Referenzwert —, **nie aus dem Code selbst.** Ein Test, dessen Sollwert aus dem gemessenen Istwert entstanden ist, prüft nur, dass sich nichts geändert hat, und nicht, dass es stimmt.
- Für Aufrufe an Sprachmodelle taugen klassische Unit-Tests kaum; dort braucht es einen Prüfstand mit echten Interaktionen und mehreren Läufen, um die Streuung zu sehen.
- Regeln müssen **ausführbar** formuliert sein, nicht als Absichtserklärung.
- Ein Entwicklungsserver, der auch vom Handy aus erreichbar sein soll, muss explizit an alle Adressen binden (bei Vite z.B. `npm run dev -- --host`) — sonst hört er nur auf `localhost`.
- Ordnerlayout laut `README.md`. Bibliothek: three@0.128.0, ohne weitere Abhängigkeiten.
- Änderungen am Modell nur über dieses Repository, nie in der veröffentlichten Seite, und immer mit Screenshot prüfen, bevor veröffentlicht wird.
- Gewollte Änderungen an Kennwerten oder Raumflächen mit `UPDATE=1 npm test` übernehmen und die Abweichungen im Commit nennen.

## Offene Punkte pflegen

Die Arbeitsliste steht in `TODO.md` und wird **von Anfang an** geführt. Drei Regeln gelten für jeden, der hier schreibt, und sie stehen deshalb hier und nicht nur dort:

- Wer einen Punkt umsetzt, **entfernt ihn im selben Commit.** Erledigtes wird gelöscht und nicht abgehakt — die Git-Historie ist das Archiv (`git log -p TODO.md`).
- Wer beim Arbeiten einen neuen Punkt findet, trägt ihn ein, statt ihn im Kopf zu behalten. Was eine **Entscheidung** braucht, gehört unter „Offene Fragen" und nicht zu den Aufgaben.
- **Ein Agent erfindet keine Punkte.** Aufgefallenes darf er vorschlagen; eingetragen wird, was besprochen ist.

## Sensible Daten

- **Niemals Zugangsdaten committen:** Passwörter, Tokens, API-Schlüssel, PINs, private Schlüssel. Sie gehören auch nicht in Dokumentation, Tests, Beispieldaten oder in den Chat, sondern nach `.tmp/<name>.env` bzw. in den Passwort-Manager.
- **Auch Dateien ohne sichtbares Geheimnis können eins tragen:** Mitschnitte (`.pcap`, `.har`), Protokolle und Exporte enthalten regelmäßig Hostnamen, Seriennummern, Kennungen oder Nutzdaten. Sie bleiben draußen.
- **Fremdmaterial bleibt draußen:** heruntergeladene Binärdateien, Dekompilate, extrahierte Ressourcen. Ins Repository kommt nur **eigene Arbeit** — also etwa die selbst erstellte Tabelle mit den Erkenntnissen, nicht das Material, aus dem sie stammt.
- **Der Ort für all das ist `.tmp/`**, von `.gitignore` ausgeschlossen. Dort liegen auch Versuchsskripte und Zwischenstände. Was dort liegt, kommt nicht ins Repository — **auch nicht testweise und auch nicht mit `git add -f`.** Einmal committet, bleibt eine Datei über die Historie abrufbar; Löschen macht das nicht rückgängig.
- **Kein Agent arbeitet mit Administratorrechten** — dafür braucht kein KI-Werkzeug Adminrechte.
- **Alles unter Git** — nicht wegen der Historie, sondern weil sich ein Agentenlauf damit zurückdrehen lässt.
- **Eigene KI-Integrationen nur serverseitig** ansprechen. Ein Schlüssel im Browser ist ein veröffentlichter Schlüssel.
- **Keine echten Zugangsdaten und keine Produktivdatenbank** in einer Umgebung, in der ein Agent frei läuft.
- **Pläne und PDFs in `eingaben/` enthalten persönliche Daten.** Sie bleiben im privaten Repository, gelangen aber nie in `dist/` oder in Texte der Seite: keine Straßen-, Orts- oder Eigentümernamen. Zugangsdaten gibt es in diesem Projekt keine; falls doch, gehören sie nach `.tmp/<name>.env`.

## Umgang mit echten Systemen

Dieser Abschnitt gilt, sobald das Projekt ein System berührt, das kaputtgehen kann: Gerät, Produktivdatenbank, fremde Schnittstelle, Zahlungsdienst. Gibt es hier nichts dergleichen, kann er entfallen.

**Grundsatz: nur lesen.** Kein Agent sendet schreibende Befehle, auch nicht zum Ausprobieren. Was darüber hinausgeht, braucht eine **einzeln benannte, datierte Freigabe** — nicht eine allgemeine Erlaubnis, sondern eine für genau diesen Befehl in genau diesem Geltungsbereich.

Berührtes System ist hier das private Artifact „Haus und Grundstück 3D“ (Veröffentlichen, Ablauf in `CLAUDE.md`). Es wird erst nach Screenshot-Prüfung und nur auf Aufforderung neu veröffentlicht. Einzeln benannte, datierte Freigaben gibt es bisher keine.

Zu jeder Freigabe gehört:

- **Umfang.** Welcher Befehl, welche Werte, welches Objekt. Alles Weitere braucht eine neue Freigabe.
- **Bestätigung je Anwendung.** Vor dem Senden den fertigen Befehl zeigen — Ziel, alter Wert, neuer Wert — und erst nach einem ausdrücklichen Ja im selben Gespräch senden. Ein Ja gilt für **einen** Versuch, nicht für die nächsten. Das Zurückschreiben des Ausgangswerts gehört zum selben Versuch.
- **Ablauf je Versuch:** Ausgangswert lesen, schreiben, zurücklesen und vergleichen, Ausgangswert wiederherstellen, erneut zurücklesen.
- **Wertebereich und Vorbedingungen.** Was außerhalb liegt, lehnt der Code ab — nicht erst der Mensch. Fehlt ein Ausgangswert oder ist er ungültig, wird nichts gesendet; ein fehlender Wert gilt **nie** als gleich.
- **Was als Erfolg gilt.** Die Antwort des Systems ist **kein** Erfolgsbeleg — Erfolg ist allein das Zurücklesen des neuen Werts. Eine leere oder unerwartete Antwort gilt als unklar.
- **Abbruch beim ersten Fehler.** Antwortet das System mit einem Fehler oder unerwartet, wird nichts mehr gesendet und **nichts wiederholt**. Melden, die rohe Antwort vorlegen, Mensch entscheiden lassen.
- **Vorbereiten geht ohne das echte System:** Format aus der Dokumentation lesen, den Befehl in Tests gegen Doku oder Mitschnitt absichern. Die Sperre gehört in den Code, nicht in die Absicht — sie lässt genau das Freigegebene durch und sonst nichts.

## Git

- Kleine, thematische Commits mit **deutschen** Commit-Nachrichten im Format `typ(bereich): Beschreibung` (Conventional Commits, deutsch). Typen: `feat`, `fix`, `docs`, `chore`. `bereich` ist meist eine Komponente (`model`, `app`, `tpl`, `build`, `tools`, `docs`) und entfällt, wenn keine klar zutrifft.
- **Mechanische Sammeländerungen** ohne Verhaltensänderung (Formatierung, Abhängigkeits-Aktualisierung) bekommen `chore(…)`.
- Umbenennen und Verschieben mit `git mv`, damit die Historie erhalten bleibt.
- Vor dem Bearbeiten `git pull` bzw. `git fetch origin main`.

### Agenten und Git

**Wo ein Agent arbeitet, entscheidet, ob er selbst committen darf.** Die Trennlinie ist der Branch, nicht die Aufgabe:

| Wo | Committen und pushen | Mergen nach `main` |
|---|---|---|
| Eigener Branch | erlaubt, ohne zu fragen | nur auf ausdrückliche Aufforderung |
| `main` | nur auf ausdrückliche Aufforderung | nur auf ausdrückliche Aufforderung |

- **Auf einem eigenen Branch** vor dem ersten Schreibzugriff `git fetch origin main && git merge origin/main`, damit der Branch nicht auf einem veralteten Stand aufsetzt. Vor dem Mergen `git diff --stat origin/main <branch>` ansehen — Löschungen in Dateien, die niemand angefasst hat, sind das Warnsignal.
- **Auf `main`** kein Commit, kein Push, kein Merge — auch nicht der Merge des eigenen Branches. Änderungen bleiben im Arbeitsbaum, und am Ende steht eine fertige deutsche Commit-Nachricht zum Herauskopieren.

## Ausdrückliche Verbote

- Die Außenmaße (12,95 × 14,655 m, Versprung 3,50 / 6,78 m) nicht ohne ausdrückliche Anweisung ändern.
- Die festgelegten Randbedingungen aus `CLAUDE.md` (z. B. Dachneigung 35°) nicht ohne Rückfrage ändern.
- `tools/snapshot.json` nicht ohne `UPDATE=1` und Nennung der Abweichungen im Commit ändern.
- Das Artifact nicht ohne vorherige Screenshot-Prüfung neu veröffentlichen.

## Siehe auch

<!-- Kein Wikilink möglich, dies ist ein eigenständiges Repository außerhalb der Wissensdatenbank. Herkunft dieser Vorlage: die private Wissensdatenbank der Familie, destilliert aus den Notizen „App-Entwicklung", „Devcontainer", „KI-Werkzeuge absichern" und „KI in der Entwicklung" sowie aus dem Regelwerk des Vaults selbst. Angelegt über den Skill projekt-aufsetzen; der Rückweg für neu entstandenes Wissen ist der Skill wissensrueckgabe (unter .claude/skills/). -->
