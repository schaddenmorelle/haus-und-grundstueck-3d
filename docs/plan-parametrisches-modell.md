# Plan: parametrisches Hausmodell mit 2D-Bemaßung und Prüfung

Stand: 11.10.2026. Die Entscheidungen des Nutzers sind eingearbeitet (Abschnitt 9), Phase 0 bis 2 sind erledigt. Ziel: Raummaße, Wanddicken und Höhen sollen sich in 2D-Ansichten (Grundriss je Geschoss, Schnitt und Ansicht) direkt an den Maßen ändern lassen. Jede Änderung wird sofort geprüft, und ihre Auswirkungen auf Nachbarräume, Wände, Öffnungen, Treppe und Dachgeschoss werden angezeigt. Später kommen Ausstattungsdetails hinzu. Deshalb muss zuerst der Rohbau mit korrekten Maßen sauber als Daten vorliegen.

---

## 1. Befund: Ist-Stand

**Was gut ist und bleibt**
- Eine HTML-Datei, Three.js r128 vom CDN, einfacher Build, Veröffentlichung als Artifact.
- Hausrelative Koordinaten (`P(hx, hz)`) und Höhen (`Y(e)`) sind schon sauber getrennt.
- Das Dach ist eine analytische Funktion (`roofH`). Daraus lassen sich Schnitte, DG-Wandhöhen und Prüfungen exakt ableiten.
- Die Treppe hängt bereits an der Geschosshöhe (Steigung = Geschosshöhe / 15).
- Die geklärten Randbedingungen sind in `AGENTS.md` dokumentiert.

**Was das Feintuning heute verhindert**

| # | Problem | Beleg im Code |
|---|---|---|
| 1 | **Daten und Geometrie sind vermischt.** Maße stehen als Zahlen direkt in Funktionsaufrufen. | `model.js` hat 730 Zeilen. `12.565` (Innenseite Ostwand) steht 21-mal im Code, `0.385` 26-mal, `9.69` 12-mal. |
| 2 | **Räume und Wände werden doppelt gepflegt.** Die Raumpolygone (`ROOMS`, `DGR`) sind unabhängig von den Wänden (`rw`, `dw`, `dgWall`). Wird eine Wand verschoben, bleibt der Raum, wie er ist. Die Fläche stimmt dann nicht mehr, und es gibt keine Warnung. | Julians Zimmer hat die Ecke (8,00 / 3,535), die Schrägwand läuft von (7,93 / 3,45) nach (8,83 / 4,35). |
| 3 | **Wanddicken sind nur implizit vorhanden**, als Differenz von x0/x1. Es gibt keine Wandtypen. | EG: 11,5 / 12,5 / 17,5 / 20 cm. DG: 12 / 15 / 17 / 18 cm. Um eine Dicke zu ändern, müssen mehrere Zahlen in Wand **und** Raum angepasst werden. |
| 4 | **Öffnungen sind schwer lesbar und unvollständig.** Ihre Lage wird ab Wandanfang in Laufrichtung angegeben (z. B. `HD - 14.27`). Innentüren sind nur Aussparungen ohne Art, Breite/Höhe-Angabe oder Anschlag. Manche Durchgänge sind sogar nur der Abstand zwischen zwei getrennten Wänden. | Durchgang Flur–Wohnen (hx 8,01–8,87), Tür zum Arbeitszimmer im DG (hz 8,55–9,41) |
| 5 | **Abhängigkeiten sind nicht ausgedrückt.** Kniewände, DG-Räume und Treppenöffnung stehen als feste Zahlen im Code. Die Treppe ist fest an 12,565 und 9,69 verankert. Ändert sich eine Wand oder die Traufe, laufen diese Elemente nicht mit. | `Z = {x0: 5.20, x1: 11.24, …}`, `stairHole`, `toP()` |
| 6 | **Beschriftungen sind fester Text.** Nach dem Feintuning wären sie falsch. | Maß-Tags `'12,95 m'`, `'14,66 m'`, `EDGE_TXT`. Kennzahlen First und Traufe stehen als String in `app.js`. Die Hinweistexte in `tpl.html` enthalten Maße (1,60 m, 90 cm …). |
| 7 | Kleinigkeiten | Jeder Raum und jede DG-Wand bekommt ein eigenes Material. Es gibt keinen Neuaufbau mit `dispose()`. *In Phase 0 erledigt:* DG-Höhe 2,82 statt 2,971 in `app.js`, unbenutzte `pm`/`pmx`/`pmz`, Test ohne Prüfung, Paketname „scratchpad“, Kennzahlen First/Traufe als fester Text. |

**Fachlich geklärt und umgesetzt (11.10.2026)**
- **Flur und Diele** sind ein Raum („Flur / Diele“, 15,2 m²).
- **Zwischen Eltern und Flur** gibt es eine Tür. Sie fehlt im Bauplan und wurde als Wand mit Tür ergänzt: 17,5 cm in der Flucht von Installationswand und HAR-Südwand, Tür 86 cm. Lage und Breite sind angenommen.
- **Die Treppe** steht offen im Nähzimmer. Ihre 3,5 m² zählen zum Nähzimmer, weil unter der Treppe ein Schreibtisch steht. Im neuen Modell ist die Treppe ein Objekt im Raum und keine Raumgrenze.
- **DG-Wanddicken** waren nicht gemessen und sind jetzt einheitlich 12,5 cm (Annahme, genaue Maße folgen). Kniewände behalten die Planlage (Außenseite), Treppenwände die Seite zur Treppe (1,60 m licht bleiben), Querwand und Trennwand ihre Mittellinie.
- **Kniewände** bleiben an ihrer Lage aus dem Plan.

**Noch offen**
- **Maßkette an der DG-Treppe:** Lauf 0,90 + Geländer 0,15 + Nische 0,54 = 1,59 m, der lichte Wandabstand ist aber 1,60 m. Es bleibt 1 cm Rest. Das ist ein gutes erstes Beispiel für eine automatische Kettenprüfung.

---

## 2. Zielbild

```
 src/data/haus.json  ─►  auswerten  ─►  abgeleitetes Modell  ─►  prüfen  ─►  Befunde
 (einzige Quelle, mm)    (Achsen,        (Wandflächen, Räume,     (Regeln)    (Fehler, Warnung, Hinweis)
                          Typen, Bezüge)  Höhen, Dach, Treppe)
                                                 │
                         ┌───────────────────────┼─────────────────────────┐
                         ▼                       ▼                         ▼
                    3D (Three.js)        Grundriss 2D (SVG)        Schnitt/Ansicht 2D (SVG)
                                                 │
     tools/aendern.js maß=wert ─► Patch ─► neu auswerten ─► Diff + Befunde ─► haus.json + Commit (oder Abbruch)
```

Grundsätze:
1. **Eine Quelle, alles andere wird abgeleitet.** Keine Zahl steht doppelt. Raumpolygone, Flächen, Maßketten, Beschriftungen und Kennzahlen werden berechnet.
2. **Der Kern kommt ohne Three.js aus.** Auswerten, Ableiten, Prüfen und Ändern sind reine Funktionen und lassen sich in Node testen. 3D und 2D sind nur Darstellungen desselben abgeleiteten Modells.
3. **Jeder Wert hat eine Herkunft:** `plan`, `aufmass`, `annahme` oder `nutzer`, optional mit Notiz. Er kann außerdem **gesperrt** sein (z. B. Außenmaße aus der Absteckung, Dachneigung 35°). Die Herkunft wird in den 2D-Ansichten farbig angezeigt. So ist sichtbar, wo Nachmessen am meisten bringt.
4. **Kein allgemeiner Constraint-Solver.** Fast alle Wände sind achsparallel. Benannte Achsen mit Bezügen („Achse B = Achse A + 1,38 m“) bilden einen kleinen Abhängigkeitsgraphen. Er lässt sich einfach auswerten und auf Zyklen prüfen. Die drei Schrägwände werden über Endpunkte auf Achsen bestimmt.

---

## 3. Datenmodell (`src/data/haus.json`)

### 3.1 Einheiten und Koordinaten
- **Ganze Millimeter.** Das vermeidet Rundungsdrift wie `0.1 + 0.2`, und Planmaße wie 88,5 cm lassen sich exakt abbilden.
- Lage hausrelativ (hx, hz) wie heute. Höhen in mm relativ zu OKFF EG, dazu der Bezug `okffEG = 142,80 m ü. NN`. Die Lage auf dem Grundstück (3,05 / 5,74, Drehung 0) ist eine eigene Transformation.

### 3.2 Achsen (Maßketten-Rückgrat)
Benannte Fluchtlinien in x und z, jeweils absolut oder relativ zu einer anderen Achse. Relativ heißt hier: bezogen auf eine andere Achse plus Abstand, optional minus eine Wanddicke.
```json
"achsen": {
  "x.W":      { "wert": 0,     "quelle": "plan", "fest": true },
  "x.O":      { "wert": 12950, "quelle": "plan", "fest": true },
  "x.Oi":     { "ref": "x.O", "minus": "AW" },
  "x.kind1W": { "wert": 9000,  "quelle": "plan" },
  "z.N":      { "wert": 0,     "quelle": "plan", "fest": true },
  "z.kind1S": { "ref": "z.N", "plus": 9690, "quelle": "plan" },
  "z.speisS": { "ref": "z.kind1S", "plus": 1380, "quelle": "plan" }
}
```
`"minus": "AW"` bezieht die Dicke des Wandtyps ein. Wird die Außenwand dicker, wandern alle Innenseiten und alle dort anstoßenden Wände automatisch mit.

**Außenmaße** (Außenkanten West, Ost, Nord, Süd und der Versprung 3,50 / 6,78 m) stehen in einer eigenen Gruppe `aussenmasse` und sind gesperrt. Bei normalen Änderungen bewegen sie sich nie. Sie lassen sich **gesondert** ändern: in einem eigenen Abschnitt von `haus.json` bzw. mit `tools/aendern.js --aussenmass`. Dabei gibt der Raum an der betroffenen Fassade nach. Dach (Flügel A/B), Traufe und Kniewandhöhen werden neu berechnet und geprüft. Ein Test vergleicht die gesperrten Werte mit `tools/gesperrt.json`. Eine versehentliche Änderung fällt dadurch auf, eine gewollte wird in beiden Dateien eingetragen.

### 3.3 Wandtypen
```json
"wandtypen": {
  "AW":    { "dicke": 385, "schichten": [["EPS", 200], ["Poroton", 185]], "quelle": "nutzer" },
  "IW175": { "dicke": 175, "quelle": "plan" },
  "IW125": { "dicke": 125, "quelle": "plan" },
  "IW115": { "dicke": 115, "quelle": "plan" },
  "TB-DG": { "dicke": 125, "quelle": "annahme", "notiz": "vereinheitlicht, nicht gemessen" }
}
```
Eine Dicke wird an einer Stelle geändert und wirkt auf alle Wände dieses Typs. Für Einzelfälle gibt es eine Überschreibung an der Wand.

### 3.4 Wände
```json
{ "id": "eg.speis_kueche", "geschoss": "EG", "typ": "IW175",
  "von": ["x.kind1W", "z.speisS"], "bis": ["x.Oi", "z.speisS"],
  "flucht": "oben",
  "hoehe": { "bis": "decke" },
  "oeffnungen": [ { "art": "durchgang", "ab": 2070, "breite": 740, "hoehe": 2190 } ] }
```
- `flucht` gibt an, welche Wandseite auf der Achse liegt (`oben`, `unten`, `links`, `rechts`, `mitte`, bezogen auf den Grundriss).
- `hoehe`: `decke`, `dach` (DG: Dachhaut − 22 cm, höchstens 2,45 m, wie heute festgelegt), `fest` (Kniewand 1,00 m) oder `ab`/`bis` als Höhenwert.
- Wandstöße (L, T) erkennt das Programm, Wandenden werden auf die angrenzende Wandseite gekürzt. Die heute doppelt erzeugten Ecken der Außenwände entfallen.
- Für 3D bleiben die Schichten (EPS außen, Poroton innen) erhalten.

### 3.5 Öffnungen
Sie gehören zu einer Wand: `art` (fenster, tuer, fenstertuer, durchgang), `ab` (ab Wandanfang **oder** ab einer Achse, z. B. `"ab": {"achse": "x.kind1W", "plus": 2070}`), `breite`, `hoehe`, `bruestung`, `fluegel`, später `anschlag` (links/rechts, innen/außen) für Türbögen und Kollisionsprüfungen.
**Wichtig:** Auch Durchgänge ohne Tür sind Öffnungen in einer durchgehenden Wand und keine Lücke zwischen zwei Wänden. Nur so bleiben die Räume bei der Ableitung (3.6) getrennt.

### 3.6 Räume: Stempel statt Polygone
```json
"raeume": [ { "id": "speis", "name": "Speisekammer", "geschoss": "EG", "stempel": [10800, 10400], "boden": "fliese" } ]
```
**Raumpolygone werden abgeleitet:** Geschossfläche (Innenseite der Außenwände bzw. im DG die Ausbaufläche) minus alle Wandflächen minus Öffnungen in der Decke. Raumtrennlinien ohne Wand (`trennlinien` in `haus.json`) gibt es seit Phase 2: Küche / Wohnen / Essen gehen ohne Wand ineinander über (Abschnitt 9, Phase 2). Treppe, Kamin und Möbel sind Objekte im Raum und ziehen nichts von der Fläche ab. Die offene Treppe zählt also zum Nähzimmer. Jede so entstandene Teilfläche bekommt den Raum, dessen Stempel in ihr liegt. Polygon-Clipping übernimmt die Bibliothek `polygon-clipping@0.15.7` (MIT). Sie wird in die Seite eingebaut und braucht kein zusätzliches CDN. In ganzen Millimetern rechnet sie robust.
Damit lässt sich die Frage „Was passiert, wenn ich die Wand verlängere?“ direkt beantworten (siehe 5.1).

### 3.7 Geschosse und Höhen
```json
"geschosse": {
  "EG": { "okff": 0, "lichteHoehe": 2525, "quelle": "annahme" },
  "DG": { "okff": { "ref": "EG.okff", "plus": 2971 }, "quelle": "treppenplanung", "fest": true }
}
```
Daraus folgt der Deckenaufbau mit 446 mm (Rohdecke + Fußbodenaufbau DG). Bei drei verknüpften Größen legt das Modell fest, welche abgeleitet wird. Heute ist das die Deckenstärke, weil Geschosshöhe (Treppenplanung) und lichte Höhe vorgegeben sind.

### 3.8 Dach, DG-Ausbau, Treppe, Kamin
- **Dach:** Traufe 145,77, Neigung 35° (gesperrt), Überstand 235 mm, Flügel A und B als Rechtecke über Achsen der Außenwände. Der First wird berechnet und gegen den Plan (149,08) geprüft.
- **DG-Ausbau:** Kniewände als Wände mit `hoehe: fest 1000`. Ihre Lage kommt aus dem Plan (entschieden), die Außenseite liegt auf der Planlinie. Eine Prüfregel vergleicht die tatsächliche Höhe unter der Dachschräge mit dem Soll.
- **Treppe:** parametrisch mit Steigungen (15), Auftritt (250), Laufbreite (900), Wendelungsfeld (Stufen 1–6) und einem Anker an zwei Achsen (heute die Innenseite der Ostwand und `z.kind1S`). Die Steigung wird aus der Geschosshöhe abgeleitet. Die Treppenöffnung im DG ergibt sich aus Treppe und Kopfhöhe oder wird als eigener Wert mit Prüfung geführt (heute 99 cm).
- **Kamin, Stützpfosten, Dachfenster:** Objekte mit Lage an Achsen bzw. auf der Dachfläche.

### 3.9 Prüfmaße (Aufmaß)
Gemessene Strecken werden getrennt von den Steuerwerten geführt:
```json
{ "was": "Speisekammer lichte Tiefe", "von": "wand:eg.kind1_speis/unten", "bis": "wand:eg.speis_kueche/oben", "gemessen": 1262, "datum": "2026-10-12" }
```
Das Modell zeigt die Abweichung an. Der Nutzer entscheidet, ob er das Modell anpasst. So wird jede Messung genutzt, ohne dass Messfehler unbemerkt ins Modell wandern.

*Erster Stand umgesetzt:* `tools/pruefmasse.json` enthält die lichten Raummaße aus dem Aufmaß des EG. `npm test` berichtet die Abweichung je Maß. Erwartet ist Modell − Aufmaß zwischen −1 und +4 cm, weil das Aufmaß fertige Oberflächen misst. Der Abgleich steht in `docs/abgleich-eg-grundriss.md`.

### 3.10 Später: Ausstattung
Möbel, Sanitär und Küche als Objekte, verankert an Raum oder Wand („an Wand X, 300 mm ab Ecke, Höhe 0“). Sie wandern mit, wenn die Wand sich verschiebt. Prüfungen: Kollision mit Wänden und Türaufschlägen, Bewegungsflächen, Kopfhöhe unter der Dachschräge und unter der Treppe. Ein naheliegendes erstes Objekt ist der Schreibtisch unter der Treppe im Nähzimmer.

---

## 4. 2D-Ansichten

### 4.1 Grundriss je Geschoss (EG, DG, optional Dachaufsicht)
- **Darstellung:** Wände gefüllt bzw. schraffiert nach Wandtyp, Fenster als Doppellinie, Türen mit Aufschlagbogen (sobald `anschlag` bekannt ist). Raumstempel mit Name, Fläche und lichten Maßen. Treppe mit Lauflinie und Stufennummern, dazu Kamin und Treppenöffnung. Im DG zusätzlich Höhenlinien der Dachschräge (1,00 m und 2,00 m), nützlich für Möbel und Wohnflächenberechnung.
- **Automatische Bemaßung:** außen drei Ketten wie im Bauplan (Gesamtmaß, Wandvorsprünge/Achsen, Öffnungen), innen lichte Raummaße und Wanddicken. Öffnungen in Plannotation „88,5/219“ (Breite/Höhe), dazu BRH.
- **Bearbeiten nur über das Repository (entschieden):** Die Seite speichert nichts. Jedes Maß in der Seite hat einen eindeutigen Namen, z. B. `speis.tiefe` oder `wand:eg.speis_kueche`. Der Nutzer nennt Maß und neuen Wert, und die Änderung läuft über `tools/aendern.js` im Repository (siehe 7). Ein Probiermodus in der Seite, der nur Vorschau und Prüfung zeigt und eine Änderungsliste zum Exportieren erzeugt, ist für Phase 4 gewünscht (siehe 9, „Ändern über die Oberfläche“).
- **Welche Seite bleibt fest? (entschieden)** Immer **„Nachbar gibt nach“:** Nur die gewählte Wand wandert, abhängige Achsen werden ausgeglichen, der angrenzende Raum wird größer oder kleiner. Gesperrte Achsen (Außenmaße) bewegen sich nie, außer bei der gesonderten Außenmaß-Änderung (3.2). Ein Schloss-Symbol kennzeichnet sie im Plan.
- **Plan auch im Repository:** Der Build schreibt Grundrisse und Schnitte zusätzlich als SVG nach `docs/plaene/`. Jede Maßänderung ist so im Git-Diff als Bild sichtbar.
- **Farben nach Herkunft:** Plan, Aufmaß, Annahme und „in dieser Sitzung geändert“ bekommen je eine eigene Farbe. Die Befunde erscheinen als Marker im Plan und als Liste. Ein Klick springt zur Stelle.

### 4.2 Schnitte und Ansichten (Seitenansicht)
- **Ansichten Nord, Ost, Süd, West:** Fassade mit Öffnungen, Dachsilhouette, Geländelinie und Höhenkoten ü. NN.
- **Schnitte:** eine Linie im Grundriss ziehen. Voreingestellt sind A–A durch die Treppe und B–B quer durch Pias Zimmer. Der Schnitt zeigt Decken, geschnittene Wände, das Dachprofil aus `roofH`, Kniewände, DG-Wandoberkanten und die Treppe mit Kopfhöhenlinie (2,00 m).
- **Höhenketten:** OKFF EG, UK Decke, OKFF DG, Kniewand, Traufe, First.
- **Bearbeiten:** lichte Höhe, Deckenaufbau/Geschosshöhe (mit Wahl, welcher Wert abgeleitet wird), Brüstung und Sturz, Kniewandhöhe, Traufe, Überstand. Die Neigung ist gesperrt.
- **Technik:** Grundflächen des abgeleiteten Modells mit der Schnittlinie schneiden, dazu Höhenbereiche und Dachfunktion. Alles ist exakt, ohne Raycasting.

### 4.3 Kopplung mit 3D
Umschalter 2D / 3D / geteilt (auf dem Handy als Reiter). Eine Auswahl in 2D hebt dasselbe Element in 3D hervor und umgekehrt. Haus und Grundstück werden getrennt aufgebaut. Für einen späteren Probiermodus kann so nur das Haus neu entstehen (Gelände und Garten bleiben), alte Geometrien werden mit `dispose()` freigegeben. Der heutige Gesamtaufbau dauert in Node 175 ms.

---

## 5. Prüfung und Auswirkungen

### 5.1 Prüfregeln (erste Ausbaustufe)
Jede Regel ist eine Funktion `(abgeleitetes Modell) → Befunde[]` mit Stufe (Fehler, Warnung, Hinweis), Text, betroffenen Elementen und Ort.

**Grundriss und Topologie**
1. Jede Teilfläche hat genau einen Raumstempel. *Keiner:* „unbenannte Teilfläche“, etwa weil eine verlängerte Wand einen Raum teilt. *Mehrere:* „Räume nicht getrennt“, etwa weil eine Wand gekürzt wurde.
2. Wände überschneiden sich nur an Stößen, Toleranz 1 mm (z. B. eine Verlängerung durch eine andere Wand).
3. Frei endende Wände und Wandstummel unter 5 cm werden gemeldet, ebenso Wände außerhalb der Hülle.
4. Öffnungen liegen ganz in ihrer Wand, haben Abstand zu Wandstößen und überlappen sich nicht.
5. **Erreichbarkeit:** Jeder Raum ist über Türen oder Durchgänge von der Haustür aus erreichbar. Beispiel: Wird die Tür zum Arbeitszimmer entfernt oder in eine Außenwand verschoben, lautet der Befund „Arbeitszimmer ohne Zugang“.
6. Mindestmaße als Hinweis: Türbreite, Flurbreite, Durchgangshöhe.
7. Flächenbilanz: Raumflächen + Wandflächen = Geschossfläche.
8. Abweichung Prüfmaß (Aufmaß) zu Modell größer als Toleranz.
9. Explizite Maßketten wie an der DG-Treppe: Lauf + Geländer + Nische = Wandabstand (heute 1 cm Rest).

**Höhen, Treppe, Dach**
10. Geschosshöhe = lichte Höhe + Deckenaufbau.
11. Treppe: Steigung = Geschosshöhe / n, Schrittmaß 2s + a zwischen 59 und 65 cm (heute 64,6 cm), Kopfhöhe ≥ 2,00 m über der Lauflinie, Treppenöffnung umfasst den Lauf.
12. Fenstersturz unter der Decke, Brüstung ≥ 0, Türhöhe passt unter die Decke.
13. DG: Wandoberkante höchstens Dachhaut − 22 cm und höchstens 2,45 m. Kniewandhöhe am Fußpunkt gleich Soll (1,00 m ± 5 cm).
14. Dachfenster liegen ganz in einer Dachfläche (nicht über Grat oder First) und zwischen zwei Sparrenachsen aus dem Binderplan.
15. Berechneter First gegenüber dem Plan (149,08 m).

**Geschossübergreifend**
16. Treppenöffnung im DG liegt über der Treppe im EG, der Kamin hat in beiden Geschossen dieselbe Lage.

### 5.2 Auswirkungen anzeigen (Diff)
Bevor `haus.json` geschrieben wird, vergleicht `tools/aendern.js` altes und neues abgeleitetes Modell: Räume (Fläche, lichte Maße), Wände (Länge, Lage), Öffnungen (verschoben, Abstand zum Wandende), Höhen (Steigung, DG-Wandhöhen) sowie neue und behobene Befunde. Zusätzlich entsteht ein Vergleichs-SVG, darin der alte Umriss gestrichelt und der neue durchgezogen. Rückgängig geht über Git.

**Beispiel:** Die lichte Tiefe der Speisekammer wird von 1,255 auf 1,30 m geändert (`node tools/aendern.js speis.tiefe=1,30m`).
1. Das Werkzeug ändert `z.speisS.plus` von 1380 auf 1425.
2. Die Küche wird in der lichten Tiefe 3,025 → 2,98 m kleiner, ihre Fläche 10,8 → 10,6 m². Der Durchgang in der Wand wandert mit.
3. Es entstehen keine neuen Befunde. Der Kamin (hz 10,18–10,67) bleibt in der Speisekammer.
4. Ausgabe: `haus.json` geändert, Diff, Befunde und neue SVG-Pläne. Danach Build, Screenshot, Commit und Veröffentlichung.

**Gegenbeispiel:** Die Westwand des D-Bads (hx 10,46–10,635) wird nach Süden bis zur Wand des Nähzimmers (hz 6,375) verlängert. Folgen:
- Fehler „Wand schneidet Wand Julians Zimmer / Flur“.
- Der Eingangsbereich mit der Haustür (östlicher Teil, ca. 3,8 m²) wird vom Flur abgetrennt. Das ergibt die Befunde „Teilfläche ohne Raum“ und „Räume nicht von der Haustür erreichbar“.
- Endet die Verlängerung mitten im Flur, lautet der Befund stattdessen „frei endende Wand“.

Das Werkzeug bricht bei Fehlern ab und ändert `haus.json` nicht. Nur mit `--trotzdem` wird die Änderung trotz Fehlern gespeichert.

---

## 6. Code-Architektur

```
src/
  data/haus.json          Achsen, Wandtypen, Wände, Öffnungen, Räume, Geschosse, Dach, Treppe, Prüfmaße
  data/grundstueck.json   Grenzen, Geländepunkte, Außenanlagen (aus model.js herausgelöst, inhaltlich unverändert)
  kern/                   ohne Three.js, in Node testbar
    werte.js              Achsen und Parameter auflösen (Abhängigkeiten, Zyklen, Einheiten)
    ableiten.js           Wandflächen, Stöße, Räume (Clipping), Höhen, Dachfunktion, Treppe
    pruefen.js            Regeln → Befunde
    aendern.js            Patch anwenden, „Nachbar gibt nach“, gesperrte Außenmaße, Diff
    bemassung.js          Maßketten für Grundriss und Schnitt
    geo2d.js              Polygonhilfen
  ansicht3d/              haus3d.js, dach3d.js, gelaende3d.js, garten3d.js (heutiger Code, umgezogen)
  ansicht2d/              grundriss.js, schnitt.js, svg.js
  ui/                     app.js (3D-Bedienung), plan.js (2D-Ansicht, Befundliste), tpl.html
tools/
  test/*.test.js          node --test (Regression, Regeln, Änderungen)
  shot_view.js            Screenshots wie bisher
  aendern.js              Änderungen an haus.json (Befehlszeile, ruft kern/aendern.js)
  plan_svg.js             Grundriss/Schnitt als SVG nach docs/plaene/, für Prüfungen ohne Browser und im Git-Diff
```

- **Build:** ES-Module, gebündelt mit `esbuild` zu einem IIFE-Skript, eingesetzt in `tpl.html`. Three.js bleibt global vom CDN. `python3 build.py` bleibt der Einstieg und ruft esbuild auf. Ergebnis ist wie bisher eine einzelne HTML-Datei, Tests importieren dieselben Module.
- **Sprache:** JavaScript mit JSDoc-Typen für das Datenmodell und eine Schema-Prüfung von `haus.json` beim Laden. TypeScript ist später möglich (esbuild kann beides), aber kein Muss.
- **Materialien** werden geteilt statt pro Raum und Wand neu erzeugt. Die Hervorhebung läuft über eine Kopie nur des gewählten Objekts.
- **Beschriftungen und Kennzahlen** kommen nur aus dem abgeleiteten Modell. Hinweistexte in `tpl.html` enthalten Zahlen nur noch als Platzhalter, die beim Build oder zur Laufzeit gefüllt werden.

---

## 7. Speichern und Arbeitsablauf

**Entschieden:** Änderungen laufen nur über das Git-Repository. Die Seite speichert nichts: kein localStorage, kein Import/Export, kein Artifact-Speicher.

1. Der Nutzer nennt die Änderung, z. B. „Speisekammer lichte Tiefe 1,30 m“ oder „DG-Trockenbauwände 10 cm“. Sie kann aus einem Aufmaß stammen oder in der Seite abgelesen sein.
2. `node tools/aendern.js speis.tiefe=1,30m` wendet sie nach der Regel „Nachbar gibt nach“ auf `haus.json` an. Das Werkzeug gibt die Auswirkungen aus (Räume, Wände, Öffnungen, Höhen) sowie neue und behobene Befunde.
3. `npm test` (Regeln + Snapshot) → `python3 build.py` (Seite und SVG-Pläne) → Screenshot-Kontrolle → Commit mit den Auswirkungen in der Nachricht → unter derselben Artifact-URL veröffentlichen.
4. Außenmaße werden nur mit `--aussenmass` geändert (3.2).
- **Datenschutz:** `haus.json` enthält nur Geometrie und die vereinbarten Raumnamen. Ein Test prüft `dist/` gegen eine Sperrliste (Straße, Ort, Eigentümer). Die Sperrliste liegt in `eingaben/` und wird nie veröffentlicht. Fehlt sie, wird der Test übersprungen.

---

## 8. Umsetzung in Phasen

Jede Phase endet mit grünen Tests, Screenshot-Kontrolle und, wo sichtbar, Veröffentlichung.

| Phase | Inhalt | Abnahme | Umfang |
|---|---|---|---|
| **0 Absichern** ✅ | `test_model.js` ist ein echter Test mit Prüfungen und Snapshot (`tools/snapshot.json`). `npm test`/`npm run build`, Paketname, DG-Höhe 2,82 korrigiert, `pm*` entfernt, Kennzahlen aus dem Modell. | `npm test` schlägt bei Abweichung fehl. | erledigt |
| **1 Daten herauslösen** ✅ | `haus.json` mit Achsen, Außenmaß-Gruppe (gesperrt), Wandtypen, Wänden, Öffnungen (Durchgänge als echte Öffnungen). `model.js` wird auf die neue Struktur aufgeteilt und liest die Daten. Raumpolygone bleiben vorerst explizit. | 3D identisch: Snapshot und Screenshots aller Standardansichten unverändert. | erledigt |
| **2 Räume ableiten, prüfen** ✅ | Clipping, Stempel. Ein Vergleich der abgeleiteten mit den alten Polygonen ergibt eine Differenzliste zur Klärung (`docs/abgleich-raeume-ableiten.md`). Prüfregeln 1–4, 7, 9–13, Befundliste im Panel und in `npm test`. | Alte Polygone gelöscht, Abweichungen geklärt, 0 Fehler. | erledigt |
| **3 Grundriss 2D** | SVG für EG und DG in der Seite und in `docs/plaene/`, automatische Maßketten mit Maßnamen, Raumstempel, Herkunftsfarben, Schloss an gesperrten Maßen, Umschalter 2D/3D. | Bemaßung stimmt mit dem Bauplan überein (Stichproben). | mittel |
| **4 Ändern über das Repository** | `tools/aendern.js`: Maße, Wanddicken, Wandtypen, Öffnungen ändern, „Nachbar gibt nach“, Außenmaße nur mit `--aussenmass`, Ausgabe von Auswirkungen und Befunden, Abbruch bei Fehlern. Neuaufbau nur des Hauses in 3D (`dispose`, geteilte Materialien). Probiermodus in der Seite ohne Speichern, mit Export der Änderungsliste. | Beispiel und Gegenbeispiel aus 5.2 laufen als Node-Test. | groß |
| **5 Schnitt und Ansicht** | Fassaden, freie Schnitte, Höhenketten, Höhen bearbeiten. Treppen- und DG-Regeln (11, 13–16). | Schnitt A–A zeigt Kopfhöhe und Steigungen korrekt. | mittel |
| **6 Aufmaß** | Prüfmaße erfassen (auch auf dem Handy), Abweichungen anzeigen, Herkunft je Wert pflegen. | Gemessene Werte erscheinen mit Abweichung. | klein |
| **danach** | Ausstattung (Objektkatalog, Verankerung, Kollisionen, Bewegungsflächen), Wohnfläche im DG nach Höhenzonen. | | |

---

## 9. Entscheidungen

Geklärt mit dem Nutzer am 11.10.2026:

| Frage | Entscheidung |
|---|---|
| Wo wird bearbeitet? | Nur über das Git-Repository. Die Seite speichert nichts. |
| Verhalten beim Ändern eines Innenmaßes | Nur der Nachbarraum gibt nach. |
| Außenmaße | Gesperrt, aber gesondert änderbar (3.2). |
| Flur und Diele | Ein Raum („Flur / Diele“). |
| Eltern / Flur | Getrennt durch eine Wand mit Tür (Lage und Breite angenommen, Maße folgen). |
| Treppe im Nähzimmer | Offene Treppe, die Fläche zählt zum Nähzimmer (Schreibtisch unter der Treppe). |
| DG-Wanddicken | Nicht gemessen, vereinheitlicht auf 12,5 cm. Genaue Maße reicht der Nutzer nach. |
| Kniewände | Lage aus dem Plan, die Höhe wird geprüft. |
| Ändern über die Oberfläche | Gewünscht (11.10.2026): Maße in der Seite ändern, Prüfung ansehen, Änderungsliste exportieren und im Repository validiert als neue Sollwerte einspielen. Die Seite speichert weiterhin nichts, sie exportiert nur. Das ist der Probiermodus aus Phase 4. |

**Phase 1 umgesetzt (11.10.2026), Entscheidungen mit Tragweite:**
- **Datei und Auflösung:** `src/data/haus.json` (Millimeter) wird von `src/werte.js` aufgelöst: Achsen, Wandtypen, Ausdrücke `{ ref, plus, minus }`, Prüfung auf Zyklen und unbekannte Namen. Zahlen sind Millimeter, Achsennamen werden aufgelöst, `"IW115/2"` ist die halbe Wanddicke. Halbe Wanddicken ergeben halbe Millimeter (62,5 mm bei den DG-Wänden auf der Mittellinie); das ist im Binärsystem exakt und bleibt so.
- **Wände:** `von`/`bis` auf Achsen, `flucht` sagt, welche Seite auf der Achse liegt. Bei Wandtypen mit `schichten` liegt die erste Schicht (Außenseite) auf der Flucht-Seite. `ab` einer Öffnung ist eine Zahl (mm ab Wandanfang in Laufrichtung) oder eine Achse (Lage auf der Achse). Das DG-Tor zum Arbeitszimmer ist jetzt eine Öffnung mit `hoehe: "voll"` in einer durchgehenden Trennwand; die 3D-Geometrie blieb gleich (kein Sturz).
- **Ketten:** Verkettet sind nur die Seiten derselben Wand (Achse plus Wandtyp) und echte Stöße. Wände, die nur bündig liegen (Eltern / Bad mit der HAR-Südwand, Ankleide / Wohnen mit der Südwand des Bads, Bad / Ankleide mit der Westwand des Wohnzimmers), laufen auf getrennten Maßketten wie in den gedruckten Ketten. Sonst würde eine Maßänderung entgegen der Bearbeitungsregel („nur der Nachbarraum gibt nach“) mehrere Wände mitnehmen; `tools/test_daten.js` prüft das am Beispiel der HAR-Tiefe.
- **Räume:** Die Polygone bleiben explizit, nutzen aber Achsennamen, wo die Ecke auf einer Achse liegt. Zehn Eckpunkte an den Schrägwänden (z. B. 2472,4 / 4807,6 mm im Bad) bleiben Zahlen und werden erst in Phase 2 abgeleitet.
- **Gesperrte Werte:** Außenmaße (`aussenmasse`) und Dachneigung (`dach.neigung`) tragen `fest: true`. `tools/gesperrt.json` hält die Sollwerte, `npm test` vergleicht.
- **Build:** weiterhin `build.py` (Verketten, Daten einbetten). Die Umstellung auf esbuild aus Abschnitt 6 ist nicht erfolgt und wird erst entschieden, wenn `kern/` als Module gebraucht wird.
- **Noch Zahlen im Code:** Gelände und Außenanlagen, Terrasse, Pergola, Nebeneingang, Kamin (Lage hängt an Achsen, Maße im Code), Stützpfosten, Treppe (Stufenmaße), Dachfenster und Dachaufbauten sowie die festen Beschriftungstexte.
- **Nachweis:** Weltkoordinaten aller 800 Netze, Beschriftungen und Raumflächen sind vor und nach dem Umbau gleich (größte Abweichung 4·10⁻¹⁵ m).

Außengelände (11.10.2026): Das Pflaster der Einfahrt ist ein Dreiecksnetz aus Höhenpunkten (`HP`/`HT` in `src/model.js`) und überschreibt das Gelände innerhalb des Hofumrisses. So bleiben Gelände, Texturen und Höhenabfragen (`groundY`) an einer Stelle und stimmen miteinander überein. Das Vorbeet ist im Gelände um 30 cm angehoben, die Winkelsteinmauer ist ein eigener Körper. Die Straße ist eine geneigte Ebene (Ausgleichsebene durch die Lageplanhöhen plus 15 cm), damit sie ohne Wellen bleibt; die Höhenpunkte des Lageplans gelten weiter für die Nachbargrundstücke. Die Stufe südlich der Haustür (11 cm) hat eine Randsteinreihe, das Pflaster am Straßenrand einen Bordstein. Die Pflasterhöhen sind teils Annahmen (siehe `AGENTS.md`, „Annahmen“) und werden mit Aufmaßwerten des Nutzers ersetzt.

**Phase 2 umgesetzt (11.10.2026), Entscheidungen mit Tragweite:**
- **Module:** `src/raeume.js` (Wandflächen, Clipping, Stempel, Räume), `src/dach.js` (Dachhöhe und Oberkante der DG-Wände aus den Daten, löst `roofH` und `topAt` in `model.js` ab) und `src/pruefen.js` (Regeln → Befunde) laufen ohne Three.js und werden in Node getestet. Die Seite verkettet sie weiter in einer Datei (`build.py`); die Umstellung auf `kern/` und esbuild aus Abschnitt 6 bleibt offen. `polygon-clipping@0.15.7` steht in `package.json` und wird mit seiner Lizenz in die Seite eingebaut.
- **Räume:** Stempel (Punkt in mm, nicht gemessen) statt Polygon. Geschossfläche EG = Außenkante des Hauses, DG = Ausbaufläche. Jede Teilfläche ohne Stempel ist ein Fehler, mehrere Stempel in einer Teilfläche ebenso. Die Fläche eines Raumes zieht freistehende Wände ab (Bad ohne WC-Wand, DG-Flur ohne Treppenwände).
- **Trennlinien:** `haus.trennlinien` sind Raumgrenzen ohne Wand (Dicke 0,01 mm). Es gibt eine: EG Wohnen / Küche (bleibt offen, Angabe des Nutzers vom 11.10.2026). Im DG haben Pias Zimmer, Arbeitszimmer und Abstellkammer je eine Tür zum Flur; dafür stehen zwei Wände mit Tür in `waende` (Türen 86 × 200 cm Arbeitszimmer und Pias Zimmer, 76 × 195 cm Abstellkammer nach Angabe des Nutzers, Lage mittig angenommen; Regel 12 prüft Türhöhen jetzt auch im DG gegen die Wandoberkante, Regel 4 erkennt Anschlüsse von beiden Wänden aus).
- **Wandenden:** Eine Wand, die mit ihrer (verlängerten) Mittellinie in einer Querwand endet, wird an deren abgewandter Seite gekappt (`wandEndenKappen`). Ein Ende gilt als angeschlossen, wenn es in einer anderen Wand liegt oder eine der beiden Kappenecken an einer anderen Wand (L-/Z-Stoß). Ein gewolltes freies Ende trägt `freiesEnde: true` an der Wand. Zwei Wände dürfen sich nur an Stößen überlappen: Eine Wand, die durch eine andere hindurchläuft, ist ein Fehler (auch ein echter Kreuzstoß müsste als zwei Wände modelliert werden). Liegt die Überlappung ganz in einer dritten Wand, ist es ein Knoten und kein Fehler.
- **Daten neu:** `geschosse.DG.deckenaufbau` (446, Regel 10), `dg.wandHoechst` / `wandAbstandDachhaut` / `kniewandSoll` / `kniewandToleranz` (bisher Zahlen in `model.js`), `treppe` (Steigungen, Auftritt, Laufbreite, Geländer, Nische, Anker, gerader Lauf; `model.js` liest Lauf- und Geländermaße von dort), `ketten` (Regel 9: Teile gegen den Abstand zweier Achsen; Teile sind Zahlen oder Pfade in `haus.json`).
- **Regeln:** 1, 2, 3, 4, 7, 9, 10, 12 und 13 vollständig, 11 teilweise (Steigung 140–210 mm als Fehler, Schrittmaß 590–650 mm als Warnung, gerader Lauf liegt in der Treppenöffnung). Die Kopfhöhe von 2,00 m über der Lauflinie gehört in Phase 5 (sie braucht den Schnitt). Stufen: Fehler = in sich widersprüchlich, Warnung = auffällig, Hinweis = zur Kenntnis; `npm test` scheitert nur an Fehlern, die Anzahl je Stufe steht im Snapshot. Öffnungen, die an einen Wandstoß grenzen (Abstand 0), sind erlaubt, ein Abstand von 1 bis 49 mm ist ein Hinweis.
- **Befunde:** `buildModel` liefert `befunde`, `abgeleitet` und `dach`. Die Seite zeigt sie im Panel „Prüfung“; ein Klick auf einen Befund mit Ort fliegt hin und schaltet das Geschoss um.
- **Auf den echten Daten:** 0 Fehler, 0 Warnungen, 2 Hinweise (Maßkette DG-Treppe, 10 mm Rest; Tür Pias Zimmer 21 mm vor der Trennwand). Datenkorrekturen, Flächenänderungen und die Folgen für die Tests stehen in `docs/abgleich-raeume-ableiten.md`.

Noch offen: Format der exportierten Änderungsliste und Ablauf des Einspielens (Abschnitt 9, „Ändern über die Oberfläche“).

Noch offen: Werden Maße in cm oder m angegeben, und Öffnungen in Plannotation (88,5/219)? Bis zur Klärung verlangt `tools/aendern.js` die Einheit ausdrücklich (`1,30m`, `12,5cm`, `885mm`). Ohne Einheit bricht es ab, damit „12,5“ nicht als Meter gelesen wird.
