# Haus und Grundstück 3D

Maßstabsgetreues, interaktives 3D-Modell von Grundstück, Haus und Dachausbau (Three.js r128, eine einzelne HTML-Datei).
Gesprächssprache: **Deutsch**, Antworten kurz. Dieses Repository ist privat und enthält absichtlich auch Pläne und PDFs mit persönlichen Daten (`eingaben/`). Diese Daten dürfen **nicht** in die veröffentlichte Seite (`dist/`) oder in Texte der Seite gelangen: keine Straßen-, Orts- oder Eigentümernamen.

## Arbeitsablauf
- Quellen: `src/model.js` (Geometrie, Daten aus den Plänen), `src/app.js` (Steuerung, Kamera, Schalter), `src/tpl.html` (Seite, Styles, Hinweistexte).
- `python3 build.py` baut `dist/haus-und-grundstueck-3d.html` (CDN-Three.js, wird veröffentlicht) und `dist/test_page.html` (lokal, nicht eingecheckt).
- `npm ci` installiert three@0.128.0 für Tests. `npm test` (`tools/test_model.js`) prüft feste Randbedingungen (keine NaN, Dachneigung 35°, First, Traufe, Geschosshöhe) und vergleicht Kennwerte und Raumflächen mit `tools/snapshot.json`. Außerdem berichtet er die Prüfmaße aus dem Aufmaß (`tools/pruefmasse.json`). Gewollte Änderungen mit `UPDATE=1 npm test` übernehmen und die Abweichungen im Commit nennen.
- **Änderungen am Modell nur über dieses Git-Repository.** Die veröffentlichte Seite speichert nichts.
- Umbauplan (Datenmodell, 2D-Bemaßung, Prüfung): `docs/plan-parametrisches-modell.md`.
- Screenshots: `NODE_PATH=$(npm root -g) OUT=/tmp node tools/shot_view.js '[{"p":[x,y,z],"t":[x,y,z]}]' dg` (Playwright, Ansicht `dg`, `inside`, …; Kamera in Modellkoordinaten).
- Veröffentlicht als privates Artifact https://claude.ai/artifact/Jpk68akehTMkfHyEyZMxMY (Titel „Haus und Grundstück 3D"). Nach jedem Build dieselbe Datei erneut mit der Artifact-Funktion unter derselben URL veröffentlichen. Seitenvorgaben: Design-Tokens mit hell/dunkel, nur erlaubte CDNs (jsdelivr, cdnjs).
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
- **Balkenlage / Stahlträger:** auf Wunsch des Nutzers wieder entfernt. Nur der Kamin (35 × 49 cm, bis 149,60 m ü. NN, Höhe angenommen) und der Stützpfosten an der Terrassenecke bleiben. Die Pläne dazu liegen in `eingaben/` (Balkenlage-Plan, Binderplan), die Auswertung steht in `archiv/modell-versionen/model_v4.js`.
- EG-Außenwandecke zwischen Wohnzimmer, Ankleide und Bad ist geschlossen (Westwand beginnt bei ZU − TW).
- **EG-Grundriss:** Referenz ist der bemaßte Grundriss `eingaben/bilder/32710f5f-image.png`. Die gedruckten Maße sind Rohbaumaße, die roten Handmaße des Nutzers sind fertige Innenmaße und wegen Putz und Belag bis etwa 4 cm kleiner. Die Geometrie folgt den gedruckten Maßketten. Abweichungen und übernommene Aufmaße stehen in `docs/abgleich-eg-grundriss.md`.
- Die Elterntür liegt in der kurzen Querwand hx 6,26–6,435 zwischen HAR-Südwand und Ankleide. Bad- und Ankleidetür gehen vom Vorraum des Elternschlafzimmers ab, der Vorraum gehört zum Raum „Eltern".
- **Terrasse:** Oberkante auf Höhe des Fußbodens innen (142,80). Stützpfosten und Balken der überdachten Terrasse sind weiß. Auf dem nicht überdachten Teil steht eine Pergola (Aluminium anthrazit, Lamellendach weiß), außen 3 × 5 m, 2,525 m hoch, 30 cm vor der Wohnzimmer-Westwand (hx 0,20–3,20) und 2,97 m vor der Außenwand des Bads (hz 9,75–14,75), oben knapp unter dem Dachüberstand (Aufmaß Nutzer). Die Terrasse reicht dafür bis hz 14,85 (Annahme).
- Die Treppe steht offen im Nähzimmer. Ihre Fläche zählt zum Nähzimmer, unter der Treppe steht ein Schreibtisch.
- **DG-Wanddicken:** alle Trockenbauwände einheitlich 12,5 cm (nicht gemessen, genaue Maße reicht der Nutzer nach). Kniewände bleiben an der Planlage (Außenseite), Treppenwände behalten die Seite zur Treppe (1,60 m licht), Querwand und Trennwand behalten ihre Mittellinie.

## Annahmen (nicht aus Plänen belegt)
Geländehöhen im Grundstück (±15 cm), Raumhöhe 2,525 m, Kaminhöhe, DG-Wanddicken 12,5 cm, Aufteilung der Haustür (1,16 + 0,60 m Seitenteil, nach Foto), Position des Terrassenpfostens, Fensterhöhen außer den bemaßten, Pool, Carport und Gartenelemente nach Luftbild. DG-Flächen sind Grundflächen zwischen den Kniewänden, keine Wohnfläche.

## Stil
Kurze, sachliche Antworten auf Deutsch. Änderungen am Modell immer mit Screenshot prüfen, bevor veröffentlicht wird.
