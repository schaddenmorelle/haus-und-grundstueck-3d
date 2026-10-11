# Haus und Grundstück 3D

Privates, maßstabsgetreues, interaktives 3D-Modell von Grundstück, Haus und Dachausbau (Three.js r128, eine einzelne HTML-Datei). Dazu soll eine Wohnflächenberechnung kommen. Kein Bauantrag, keine öffentliche Seite.

Dies ist das **einzige Regelwerk** für die Zusammenarbeit mit KI-Agenten und zugleich die Projektbeschreibung. `CLAUDE.md` verweist nur hierher. Doppelt gepflegte Regeln laufen auseinander: Eine Regel steht an genau einer Stelle, andere Dokumente verweisen darauf.

## Sprache und Stil

- Gesprächssprache **Deutsch**, Antworten kurz und sachlich.
- Dokumentation, Code-Kommentare und Commit-Nachrichten auf **Deutsch**. Im Code: Modul- und Funktionsnamen englisch (`buildModel`, `boxAt`), Fachbegriffe in der Sprache der Domäne, alle **nutzersichtbaren Texte** deutsch.
- Ein Glossar gibt es noch nicht (siehe `TODO.md`, „Offene Fragen"). Raumnamen und Koordinatensystem stehen unten und bleiben unverändert.

## Setup

Entwicklungsumgebung für die lokale Arbeit: Devcontainer unter `.devcontainer/` (Ubuntu 24.04, multi-arch). Geöffnet wird mit Cursor (Erweiterung `anysphere.remote-containers`, **nicht** `ms-vscode-remote.remote-containers`) oder der CLI `@devcontainers/cli`. In Cloud-Sitzungen (Claude Code im Web) wird der Devcontainer nicht genutzt; dort laufen die Befehle direkt in der Sitzung.

- **Windows:** Docker Desktop mit WSL2-Integration; Workspace aus dem WSL-Dateisystem öffnen (`/home/…`), nicht über `/mnt/c`. Dazu ein laufender SSH-Agent in der WSL-Distro, sonst scheitert jeder `git pull` im Container.
- **Mac:** Podman mit laufender Machine. `dev.containers.dockerPath` **muss** auf `.devcontainer/podman-wrapper.sh` zeigen (nicht nur `podman`) — sonst hängt „Starting container" und der Workspace bleibt nur lesbar.

Erster Build dauert einige Minuten, jeder Rebuild danach unter einer Minute (Layer-Cache).

## Arbeitsablauf

- Quellen: `src/model.js` (Geometrie, Daten aus den Plänen), `src/app.js` (Steuerung, Kamera, Schalter), `src/tpl.html` (Seite, Styles, Hinweistexte). Ordnerlayout in `README.md`. Bibliothek: three@0.128.0, ohne weitere Abhängigkeiten.
- `npm ci` einmal vor dem ersten Test. Nach **jeder** Änderung am Code: `npm test` (`tools/test_model.js`) und `npm run build` (`python3 build.py`).
- `npm run build` baut `dist/haus-und-grundstueck-3d.html` (CDN-Three.js, wird veröffentlicht) und `dist/test_page.html` (lokal, nicht eingecheckt). Typprüfung, Lint und Format sind nicht eingerichtet.
- `npm test` prüft feste Randbedingungen (keine NaN, Dachneigung 35°, First, Traufe, Geschosshöhe), vergleicht Kennwerte und Raumflächen mit `tools/snapshot.json` und berichtet die Prüfmaße aus dem Aufmaß (`tools/pruefmasse.json`).
- Screenshots: `NODE_PATH=$(npm root -g) OUT=/tmp node tools/shot_view.js '[{"p":[x,y,z],"t":[x,y,z]}]' dg` (Playwright, Ansicht `dg`, `inside`, …; Kamera in Modellkoordinaten). Alternativ `dist/test_page.html` im Browser öffnen.
- **Änderungen am Modell nur über dieses Git-Repository.** Die veröffentlichte Seite speichert nichts.
- Umbauplan (Datenmodell, 2D-Bemaßung, Prüfung): `docs/plan-parametrisches-modell.md`. Entscheidungen mit Tragweite bekommen dort einen kurzen, datierten Eintrag (Abschnitt 9). Eine arc42-Datei und ADRs gibt es noch nicht (siehe `TODO.md`, „Offene Fragen").
- `archiv/` enthält frühere Stände (v1–v4), `analyse/` die Hilfsskripte der Planauswertung. Beides ist Historie, nicht Teil des Builds.

## Koordinaten
- Hausrelativ (hx, hz): Ursprung an der NW-Außenecke des oberen Gebäudeblocks, x nach rechts, z im Grundriss nach unten. Standortkoordinaten = (3,05 + hx, 5,74 + hz). Norden liegt 26° im Uhrzeigersinn von „Grundriss oben".
- Höhe y = Höhe ü. NN − 142,0. Fußboden EG yF = 0,8, Dachgeschossboden yD = yF + 2,971, Decke EG yC = yF + 2,525, Traufe yE = 3,77.
- Hilfsfunktion `P(hx, hz)` rechnet in Weltkoordinaten um, `Y(e)` Höhe ü. NN in Modellhöhe.

## Festgelegte Randbedingungen (mit dem Nutzer geklärt, nicht ohne Rückfrage ändern)
- **Dachneigung 35°** (Binderplan, Ansichten, Lageplan, bestätigt vom Nutzer; ein früherer Hinweis auf 45° war falsch). Dachüberstand 23,5 cm. Zwei Flügel: A (Ost-West-First) und B (Nord-Süd-First bei hx 8,225), `roofH` ist das Maximum.
- Außenwand: 18,5 cm Poroton innen plus 20 cm EPS außen. Kein Keller. EG-Fenster: mittlere zweigeteilt, breites im Wohnzimmer dreigeteilt.
- Schraffierte Randzonen im Dach sind nicht ausgebaut. Kniewände ca. 1 m. Trockenbauwände im DG enden unterhalb der Sparren (Oberkante = Dachhaut − 22 cm, höchstens 2,45 m).
- **Bearbeitungsregel:** Ändert sich ein Innenmaß, gibt nur der Nachbarraum nach (keine Kette verschieben). Die Außenmaße (12,95 × 14,655 m, Versprung 3,50 / 6,78 m) sind gesperrt und werden nur gesondert und ausdrücklich geändert.
- **Raumnamen:** EG „Nähzimmer" (früher Kind 1) und „Julians Zimmer" (früher Kind 2), Flur und Diele sind ein Raum („Flur / Diele"). DG: „Abstellkammer" (Raum mit Kamin), „Arbeitszimmer" (kleiner Raum gegenüber der Treppe mit Eingangstür), „Pias Zimmer" (großer Raum).
- **Treppe** (Treppenplanung, 15 Steigungen, Auftritt 25 cm, Steigung 19,81 cm, Wendelung Stufe 1–6 an der Ostwand), im DG an der Südwand. Maße des Nutzers: 1,60 m zwischen den DG-Wänden, Lauf 0,90 m bis zum Geländer, Nische 0,54 m, Geländer insgesamt 0,15 m breit (Holz 4 cm) und läuft oben zweimal um 90° zurück, Deckenöffnung 99 cm. Die Wand von Pias Zimmer ist dafür etwa 14 cm in den Raum gerückt.
- Treppe und Treppenöffnung hängen an der Nordseite der Wand Nähzimmer / Speisekammer (hz 9,645, Variable `ZS`). Treppenöffnung im DG: hx 9,2–12,54, hz 8,655–9,645. Die Kniewand von Pias Zimmer ist bis zur Treppenöffnung verlängert (Geländer endet an ihr), danach fällt eine Schrägwand zur Hauskante. Die Wand zur Abstellkammer fällt mit der Dachschräge nach Osten, die Wand zu Pias Zimmer endet an der Kniewand. Querwand Pias Zimmer / Arbeitszimmer folgt der B-Dachschräge bis zur 1-m-Kniewand.
- **Dachfenster und Dachaufbauten** (Angaben des Nutzers vom 11.10.2026, Luftbild `eingaben/bilder/luftbild-dach.webp`): Die drei mittelgroßen Fenster (zwei im Arbeitszimmer, West und Süd, eines nach Osten in Pias Zimmer) sind **Roto WDF 07/14 R89G K WD AL**, das große Fenster nach Norden in Pias Zimmer ist **Roto WSA 11/14 R89 G K WD AL**, das Fenster im Treppenhaus nach Osten ist **Velux GGU CK04**. Größen nach Herstellerdatenblättern (Blendrahmenaußenmaß, Breite × Länge entlang der Schräge): 07/14 = 74 × 140 cm, 11/14 = 114 × 140 cm, CK04 = 55 × 98 cm; die Mitten bleiben die aus dem Dachausbauplan (die früheren Maße waren Planmaße der Öffnung). Auf dem Westwalm sitzen zwei **Solarkollektoren** (weißer Rahmen, dunkelblaues Glas), auf dem Südwalm zwei **Photovoltaikmodule** (dunkel) und darüber, rechts neben dem Südfenster, eine **Satellitenschüssel**.
- **Balkenlage / Stahlträger:** auf Wunsch des Nutzers wieder entfernt. Nur der Kamin (35 × 49 cm, bis 149,60 m ü. NN, Höhe angenommen) und der Stützpfosten an der Terrassenecke bleiben. Die Pläne dazu liegen in `eingaben/` (Balkenlage-Plan, Binderplan), die Auswertung steht in `archiv/modell-versionen/model_v4.js`.
- EG-Außenwandecke zwischen Wohnzimmer, Ankleide und Bad ist geschlossen (Westwand beginnt bei ZU − TW).
- **EG-Grundriss:** Referenz ist der bemaßte Grundriss `eingaben/bilder/32710f5f-image.png`. Die gedruckten Maße sind Rohbaumaße, die roten Handmaße des Nutzers sind fertige Innenmaße und wegen Putz und Belag bis etwa 4 cm kleiner. Die Geometrie folgt den gedruckten Maßketten. Abweichungen und übernommene Aufmaße stehen in `docs/abgleich-eg-grundriss.md`.
- Die Elterntür liegt in der kurzen Querwand hx 6,26–6,435 zwischen HAR-Südwand und Ankleide. Bad- und Ankleidetür gehen vom Vorraum des Elternschlafzimmers ab, der Vorraum gehört zum Raum „Eltern".
- **Terrasse:** Oberkante auf Höhe des Fußbodens innen (142,80). Stützpfosten und Balken der überdachten Terrasse sind weiß. Auf dem nicht überdachten Teil steht eine Pergola (Aluminium anthrazit, Lamellendach weiß), außen 3 × 5 m, 2,525 m hoch, 30 cm vor der Wohnzimmer-Westwand (hx 0,20–3,20), Südseite 5 cm hinter der Terrassenkante (hz 9,605–14,605), hinten unter dem Dachüberstand, oben knapp darunter (Angaben Nutzer). Die Terrasse endet bündig mit der südlichen Hausaußenwand (hz 14,655).
- **Einfahrt und Hof** (Angaben des Nutzers vom 11.10.2026, Fotos `eingaben/bilder/foto-einfahrt-*`): Beim Pflastern wurde die Einfahrt deutlich angehoben. Das Pflaster liegt an der Haustür (Ostwand) auf Schwellenhöhe und fällt von dort stetig bis zur Straße. Vor dem Nebeneingang (Nordwand, neben dem Carport) liegt es 30 cm unter der Schwelle, dort führen zwei Stufen aus anthrazitfarbenem Stein (je 15 cm) zur Tür (Glas oben, weiße Füllung unten). Zur Südseite geht 30 cm links neben der Haustüröffnung (Tür und Seitenteil, von vorn gesehen, also bei z 12,31) eine Stufe 11 cm nach unten, mit Randsteinreihe bis zum Vorbeet; das tiefere Pflaster reicht bis zur Wiesenkante, an der der Zaun mit dem Gartentor steht (siehe „Außengrundstück“). Die Straße ist glatt (eine geneigte Ebene, auch direkt am Bordstein) und liegt 15 cm über den Höhen der Baustraße im Lageplan von 2014 (Schätzung des Nutzers, die Straße ist inzwischen belegt und „ein Stück höher“). Das Pflaster endet am Bordstein 2–3 cm über der Straße, der Bordstein steht leicht zur Rinne vor, und die Rinne liegt auf Straßenhöhe; auch das tiefere Pflaster südlich der Stufe sinkt nie unter diese Höhe. Das Vorbeet hat eine Winkelsteinmauer, die über das Pflaster heraussteht; darin stehen ein Baum und zwei Sträucher (zwei weitere, einer auf der Straße und einer über dem Rand, sind entfernt). Drei Mülltonnen stehen an der Nordwand: blau und gelb östlich der Nebeneingangstür, schwarz westlich davon beim Carportpfosten. Die Carportpfosten stehen mit der hinteren Reihe direkt an der Hauswand, die vordere Reihe im Abstand 4,95 m, damit keiner über die Grenze ragt.
- **Außengrundstück** (Angaben des Nutzers vom 11.10.2026): Der Pool hat 3,66 m Durchmesser und ist 76 cm hoch. Von den drei Sträuchern an der Südostecke stand einer auf der Straße (entfernt); die beiden runden übrigen sind durch ein Sträucherband ersetzt: neben dem Gartentor beginnend rund um die Ostseite herum, innen am Zaun, viele kleine und schmale Büsche und Sträucher bis zur Hecke (Angabe Nutzer und Satellitenbild). **Zaun** (Doppelstabmatten, anthrazit): Im Westen 2 m hoch vom Carport (Südwestecke des Geräteraums) bis zur Straße. Im Süden 1 m hoch an der Grundstücksgrenze entlang, weiter an der Ostseite bis dorthin, wo die Wiese endet (Pflasterecke an der Straße), und von dort 1 m hoch an der Wiesenkante (Pflasterrand) bis zur Hauswand. Im Zaun an der Wiesenkante steht gleich neben dem kleinen Zaunstück an der Hauswand (das auf dem Spritzschutzstreifen steht) ein Gartentor, 80 cm breit, Höhe und Design wie der Zaun (Angabe Nutzer). Die Hecke an der Südgrenze ist 2 m hoch und steht 10 cm vom Zaun entfernt. **Spritzschutzstreifen** (dunkelgrauer Kies, Betonrandstein außen): an der Hauswand auf der Ostseite von der Stufe an der Haustür nach Süden (über das Zaunende hinaus), um die Südostecke (Fallrohr) und an der Südwand entlang bis zur Terrassenkante (x 6,5); an beiden Enden quer ein Abschlussstein (an der Stufe vor der Randsteinreihe der Stufe). **Spielplatz** (Fotos und Luftbild vom 11.10.2026): Der Spielturm steht in der Südwestecke nahe der Westgrenze, aus Holz, mit Stauraum (Brettertüren) unter der Plattform, Geländer, blauem Planendach (First Nord–Süd), Leiter an der Ostseite und grüner Rutsche nach Norden. Der Schaukelbalken geht vom Turm nach Osten an der Hecke entlang (zwei rote Sitze, ein Trapez, Schräggestell nahe dem Ostende). Zwischen Schaukel und Pool steht ein Trampolin mit 3 m Durchmesser (Angabe Nutzer: Durchmesser; blauer Randschutz, schwarze Matte, Fangnetz mit sechs Pfosten nach Foto). Der Zaun im Westen trägt in Wirklichkeit Sichtschutzstreifen in Steinoptik; sie sind noch nicht modelliert.
- Die Treppe steht offen im Nähzimmer. Ihre Fläche zählt zum Nähzimmer, unter der Treppe steht ein Schreibtisch.
- **DG-Wanddicken:** alle Trockenbauwände einheitlich 12,5 cm (nicht gemessen, genaue Maße reicht der Nutzer nach). Kniewände bleiben an der Planlage (Außenseite), Treppenwände behalten die Seite zur Treppe (1,60 m licht), Querwand und Trennwand behalten ihre Mittellinie.

## Annahmen (nicht aus Plänen belegt)
Geländehöhen im Grundstück (±15 cm), Pflasterhöhe an der Haustür 142,78 (2 cm unter dem Fußboden), Straßenhöhe (Ausgleichsebene durch die Lageplanhöhen von 2014 plus 15 cm, Schätzung des Nutzers), Mauerhöhe des Vorbeets 30 cm über dem Pflaster, Lage und Umriss von Hof und Vorbeet (aus dem alten Lageplan, nicht aus den Fotos), Carportdach in der alten Höhe, Raumhöhe 2,525 m, Kaminhöhe, DG-Wanddicken 12,5 cm, Aufteilung der Haustür (1,16 + 0,60 m Seitenteil, nach Foto), Position des Terrassenpfostens, Fensterhöhen außer den bemaßten, Lage von Pool, Carport und Gartenelementen nach Luftbild, Poolhöhe ab Oberkante der Unterlage, Wasserstand 8 cm unter dem Rand, Zaun (Achse 15 cm innerhalb der Grenzlinie auf der Mauerkrone, an der Wiesenkante 8 cm auf der Wiesenseite, Höhe ab Gelände am Pfosten, Pfosten 6 × 6 cm im Abstand von höchstens 2,5 m, Matten 8/6/8 mit Doppelstäben alle 20 cm), Heckentiefe 40 cm (damit sie zwischen Zaun und Pool passt; bei 60 cm würde sie in den Pool ragen), Spritzschutzstreifen 40 cm breit mit 8 cm breitem Randstein außen und ebenso breiten Abschlusssteinen, Kies 2 cm und Steine 4 cm über dem Gelände (nach Foto), Sträucherband (Größen 0,3–0,7 m breit und 0,5–1,4 m hoch, einzelne schlanke bis 1,7 m, Farben und Verteilung als feste Zufallsfolge nach dem Satellitenbild), Gartentor (Flügel 78 cm in 4-cm-Rahmen, Griff beidseitig, Pfosten wie die Zaunpfosten, Flügel gerade geschlossen), Maße von Spielturm (Kasten 1,30 × 1,30 m, Plattform 1,15 m, First 2,95 m), Schaukelbalken (4,4 m lang, Oberkante 2,1 m), Trampolinhöhe (0,86 m) und deren Lage nach Fotos und Luftbild geschätzt, Rutsche gerade statt wellig, Dachaufbauten: zwei Solarkollektoren je 1,18 × 2,30 m mit 5 cm Fuge, mittig auf dem Westwalm (hz 4,725), 1,4 bis 3,7 m von der Traufe entlang der Schräge; zwei PV-Module je 1,13 × 1,75 m (hochkant, 2 cm Fuge, Zellraster 6 × 10), mittig auf der Firstachse des Südwalms (hx 8,225), 0,45 bis 2,20 m von der Traufe, 5 cm über der Dachhaut aufgeständert; Satellitenschüssel 80 cm auf 50 cm hohem Mast bei hx 8,95, 3,6 m von der Traufe, Azimut 163° (Astra 19,2° Ost), Fläche 40° aufwärts geneigt (alles nach dem schrägen Luftbild geschätzt, Lage auf etwa 0,3 m genau), Dämmblock der Roto-Fenster 3 cm rundum (Datenblatt 07/14: 800/1460 zu 740/1400, für 11/14 übertragen), Velux ohne Eindeckrahmen, Aufbauhöhe der Fenster 7 cm über der Dachhaut. DG-Flächen sind Grundflächen zwischen den Kniewänden, keine Wohnfläche.

## Tests

- **Tests zuerst.** Ein Test ist der präziseste Prompt, den es gibt: klein, klar benannt, eine Anforderung. Reihenfolge: Dokumentation und Entwurf, dann Tests, dann Umsetzung, dann Umbau mit grünen Tests als Netz. Diese Regel steht hier ausdrücklich, sonst überspringen Agenten sie.
- **Erst rot, dann grün.** Ein Test, der noch nie fehlgeschlagen ist, hat nichts bewiesen.
- **Nur an abgestimmten Nahtstellen.** Tests prüfen Verhalten über die öffentliche Schnittstelle, nicht Interna — sonst zementieren sie die heutige Umsetzung und jeder Umbau bricht sie.
- **Neue Sollwerte stammen aus einer unabhängigen Quelle:** Plan, Aufmaß (`tools/pruefmasse.json`) oder ein validierter Export aus der Oberfläche (siehe `TODO.md`) — nie aus einem ungeprüft gemessenen Istwert des Modells.
- **`tools/snapshot.json` ist ein Regressionsnetz:** Es hält fest, dass sich nichts geändert hat, nicht dass es stimmt. Gewollte Änderungen an Kennwerten oder Raumflächen nur mit `UPDATE=1 npm test` übernehmen und die Abweichungen im Commit nennen; ohne `UPDATE=1` bleibt die Datei unberührt.
- Regeln müssen **ausführbar** formuliert sein, nicht als Absichtserklärung.

## Offene Punkte pflegen

Die Arbeitsliste steht in `TODO.md` und wird **von Anfang an** geführt. Drei Regeln gelten für jeden, der hier schreibt:

- Wer einen Punkt umsetzt, **entfernt ihn im selben Commit.** Erledigtes wird gelöscht und nicht abgehakt — die Git-Historie ist das Archiv (`git log -p TODO.md`).
- Wer beim Arbeiten einen neuen Punkt findet, trägt ihn ein, statt ihn im Kopf zu behalten. Was eine **Entscheidung** braucht, gehört unter „Offene Fragen" und nicht zu den Aufgaben.
- **Ein Agent erfindet keine Punkte.** Aufgefallenes darf er vorschlagen; eingetragen wird, was besprochen ist.

## Sensible Daten

- **Niemals Zugangsdaten committen:** Passwörter, Tokens, API-Schlüssel, private Schlüssel. Sie gehören auch nicht in Dokumentation, Tests oder in den Chat, sondern nach `.tmp/<name>.env` bzw. in den Passwort-Manager. Zugangsdaten gibt es in diesem Projekt bisher keine.
- **Pläne und PDFs in `eingaben/` enthalten persönliche Daten.** Sie bleiben im privaten Repository, gelangen aber nie in `dist/` oder in Texte der Seite: keine Straßen-, Orts- oder Eigentümernamen.
- **Fremdmaterial bleibt draußen:** heruntergeladene Binärdateien, Dekompilate, extrahierte Ressourcen. Ins Repository kommt nur eigene Arbeit.
- **Der Ort für Versuchsskripte, Zwischenstände und alles Nichtveröffentlichbare ist `.tmp/`**, von `.gitignore` ausgeschlossen. Was dort liegt, kommt nicht ins Repository — auch nicht testweise und nicht mit `git add -f`. Einmal committet, bleibt eine Datei über die Historie abrufbar.
- **Kein Agent arbeitet mit Administratorrechten.**

## Veröffentlichen

Berührtes System ist das private Artifact „Haus und Grundstück 3D" (https://claude.ai/artifact/Jpk68akehTMkfHyEyZMxMY). Seitenvorgaben: Design-Tokens mit hell/dunkel, nur erlaubte CDNs (jsdelivr, cdnjs). Änderungen am Modell werden immer mit Screenshot geprüft, bevor veröffentlicht wird.

**Dauerfreigabe (11.10.2026):** Nach jedem Build wird `dist/haus-und-grundstueck-3d.html` mit der Artifact-Funktion unter derselben URL neu veröffentlicht — ohne Rückfrage und von jedem Branch aus. Voraussetzungen: `npm test` grün, Screenshot-Prüfung der betroffenen Ansichten sauber, die gebaute Seite hat sich gegenüber der veröffentlichten geändert. Die Commit-Nachricht nennt, dass veröffentlicht wurde. Ablauf: Vor dem Veröffentlichen die Live-Version mit `read` holen, die gespeicherte Datei vollständig lesen und per Diff gegen den letzten eingecheckten Build (`git show <Commit>:dist/haus-und-grundstueck-3d.html`) prüfen: Liegt auf der Live-Seite nichts, was der Build nicht enthält, ist die Veröffentlichung unbedenklich; sonst wird nichts veröffentlicht, sondern gefragt. Lehnt der Dienst wegen der Konfliktprüfung ab („Live-Version nicht gelesen“, „unverändert erneut gesendet“), darf **einmal** mit demselben Inhalt wiederholt werden, aber nur, wenn die Live-Seite dem letzten eingecheckten Build entspricht. Jeder andere Fehler (Berechtigung, Netzwerk, Inhaltsprüfung) wird weder wiederholt noch umgangen, sondern die Fehlermeldung gemeldet.

Die Freigabe gilt nur für diese Datei und diese URL. Jede andere schreibende Aktion auf einem fremden System braucht eine einzeln benannte, datierte Freigabe.

## Git

- Kleine, thematische Commits mit **deutschen** Commit-Nachrichten im Format `typ(bereich): Beschreibung` (Conventional Commits, deutsch). Typen: `feat`, `fix`, `docs`, `chore`. `bereich` ist meist eine Komponente (`model`, `app`, `tpl`, `build`, `tools`, `docs`) und entfällt, wenn keine klar zutrifft. Mechanische Sammeländerungen ohne Verhaltensänderung bekommen `chore(…)`.
- Umbenennen und Verschieben mit `git mv`, damit die Historie erhalten bleibt.
- Alles liegt unter Git, damit sich ein Agentenlauf zurückdrehen lässt.

**Wo ein Agent arbeitet, entscheidet, ob er selbst committen darf.** Die Trennlinie ist der Branch, nicht die Aufgabe:

| Wo | Committen und pushen | Mergen nach `main` |
|---|---|---|
| Eigener Branch | erlaubt, ohne zu fragen | nur auf ausdrückliche Aufforderung |
| `main` | nur auf ausdrückliche Aufforderung | nur auf ausdrückliche Aufforderung |

- **Auf einem eigenen Branch** vor dem ersten Schreibzugriff `git fetch origin main && git merge origin/main`, damit der Branch nicht auf einem veralteten Stand aufsetzt. Vor dem Mergen `git diff --stat origin/main <branch>` ansehen — Löschungen in Dateien, die niemand angefasst hat, sind das Warnsignal.
- **Auf `main`** kein Commit, kein Push, kein Merge — auch nicht der Merge des eigenen Branches. Änderungen bleiben im Arbeitsbaum, und am Ende steht eine fertige deutsche Commit-Nachricht zum Herauskopieren.

## Skills aus dem Startpaket

Der Skill **`wissensrueckgabe`** unter `.claude/skills/` bleibt dauerhaft hier: Am Ende oder an größeren Meilensteinen trägt er zusammen, was aus diesem Projekt dauerhaft wissenswert ist, und schreibt es für die Übernahme in die Wissensdatenbank auf.

<!-- Kein Wikilink möglich, dies ist ein eigenständiges Repository außerhalb der Wissensdatenbank. Herkunft der Vorlage: die private Wissensdatenbank der Familie, destilliert aus den Notizen „App-Entwicklung", „Devcontainer", „KI-Werkzeuge absichern" und „KI in der Entwicklung" sowie aus dem Regelwerk des Vaults selbst. Angelegt über den Skill projekt-aufsetzen; der Rückweg für neu entstandenes Wissen ist der Skill wissensrueckgabe (unter .claude/skills/). -->
