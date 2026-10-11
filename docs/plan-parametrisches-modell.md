# Plan: parametrisches Hausmodell mit 2D-Bemaßung und Prüfung

Stand: Oktober 2026. Ziel: Raummaße, Wanddicken und Höhen sollen sich in 2D-Ansichten (Grundriss je Geschoss, Schnitt und Ansicht) direkt an den Maßen ändern lassen. Jede Änderung wird sofort geprüft, und ihre Auswirkungen auf Nachbarräume, Wände, Öffnungen, Treppe und Dachgeschoss werden angezeigt. Später kommen Ausstattungsdetails hinzu. Deshalb muss zuerst der Rohbau mit korrekten Maßen sauber als Daten vorliegen.

---

## 1. Befund: Ist-Stand

**Was gut ist und bleibt**
- Eine HTML-Datei, Three.js r128 vom CDN, einfacher Build, Veröffentlichung als Artifact.
- Hausrelative Koordinaten (`P(hx, hz)`) und Höhen (`Y(e)`) sind schon sauber getrennt.
- Das Dach ist eine analytische Funktion (`roofH`). Daraus lassen sich Schnitte, DG-Wandhöhen und Prüfungen exakt ableiten.
- Die Treppe hängt bereits an der Geschosshöhe (Steigung = Geschosshöhe / 15).
- Die geklärten Randbedingungen sind in `CLAUDE.md` dokumentiert.

**Was das Feintuning heute verhindert**

| # | Problem | Beleg im Code |
|---|---|---|
| 1 | **Daten und Geometrie sind vermischt.** Maße stehen als Zahlen direkt in Funktionsaufrufen. | `model.js` hat 730 Zeilen. `12.565` (Innenseite Ostwand) steht 21-mal im Code, `0.385` 26-mal, `9.69` 12-mal. |
| 2 | **Räume und Wände werden doppelt gepflegt.** Die Raumpolygone (`ROOMS`, `DGR`) sind unabhängig von den Wänden (`rw`, `dw`, `dgWall`). Wird eine Wand verschoben, bleibt der Raum, wie er ist. Die Fläche stimmt dann nicht mehr, und es gibt keine Warnung. | Julians Zimmer hat die Ecke (8,00 / 3,535), die Schrägwand läuft von (7,93 / 3,45) nach (8,83 / 4,35). |
| 3 | **Wanddicken sind nur implizit vorhanden**, als Differenz von x0/x1. Es gibt keine Wandtypen. | EG: 11,5 / 12,5 / 17,5 / 20 cm. DG: 12 / 15 / 17 / 18 cm. Um eine Dicke zu ändern, müssen mehrere Zahlen in Wand **und** Raum angepasst werden. |
| 4 | **Öffnungen sind schwer lesbar und unvollständig.** Ihre Lage wird ab Wandanfang in Laufrichtung angegeben (z. B. `HD - 14.27`). Innentüren sind nur Aussparungen ohne Art, Breite/Höhe-Angabe oder Anschlag. Manche Durchgänge sind sogar nur der Abstand zwischen zwei getrennten Wänden. | Durchgang Flur–Wohnen (hx 8,01–8,87), Tür zum Arbeitszimmer im DG (hz 8,55–9,41) |
| 5 | **Abhängigkeiten sind nicht ausgedrückt.** Kniewände, DG-Räume und Treppenöffnung stehen als feste Zahlen im Code. Die Treppe ist fest an 12,565 und 9,69 verankert. Ändert sich eine Wand oder die Traufe, laufen diese Elemente nicht mit. | `Z = {x0: 5.20, x1: 11.24, …}`, `stairHole`, `toP()` |
| 6 | **Beschriftungen sind fester Text.** Nach dem Feintuning wären sie falsch. | Maß-Tags `'12,95 m'`, `'14,66 m'`, `EDGE_TXT`. Kennzahlen First und Traufe stehen als String in `app.js`. Die Hinweistexte in `tpl.html` enthalten Maße (1,60 m, 90 cm …). |
| 7 | Kleinigkeiten | `app.js` setzt die DG-Höhe auf 2,82 statt yD − yF = 2,971. `pm`/`pmx`/`pmz` werden nicht benutzt. `tools/test_model.js` gibt nur Werte aus und prüft nichts (kein Exit-Code). `package.json` heißt „scratchpad“. Jeder Raum und jede DG-Wand bekommt ein eigenes Material. Es gibt keinen Neuaufbau mit `dispose()`. |

**Fachlich zu klären** (aus einer 2D-Auswertung der heutigen Daten; diese Punkte werden im neuen Modell sichtbar)
- **Raumgrenzen ohne Wand:** Eltern/Flur (hx 2,56–4,57 bei hz 3,36) und Flur/Diele (hx 8,83). Laut Originalplan sind sie offen. Im neuen Modell werden sie als *Raumtrennlinie* ausdrücklich eingetragen.
- **Treppe im Nähzimmer:** Im EG liegt die Treppe vollständig im Polygon des Nähzimmers. 3,5 m² der angezeigten 10,8 m² sind Treppe, und eine Abtrennung ist nicht modelliert.
- **Wanddicken im DG** (12/15/17/18 cm): Sind sie so gemessen, oder sollen sie vereinheitlicht werden?
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
     Maß anklicken und ändern ─► Patch ─► neu auswerten ─► Diff + Befunde ─► übernehmen / verwerfen
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

### 3.3 Wandtypen
```json
"wandtypen": {
  "AW":    { "dicke": 385, "schichten": [["EPS", 200], ["Poroton", 185]], "quelle": "nutzer" },
  "IW175": { "dicke": 175, "quelle": "plan" },
  "IW125": { "dicke": 125, "quelle": "plan" },
  "IW115": { "dicke": 115, "quelle": "plan" },
  "TB-DG": { "dicke": 150, "quelle": "annahme" }
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
"raeume": [ { "id": "speis", "name": "Speisekammer", "geschoss": "EG", "stempel": [10800, 10400], "boden": "fliese" } ],
"trennlinien": [ { "geschoss": "EG", "von": ["x.flurO", "z.dieleN"], "bis": ["x.flurO", "z.kind1N"], "zwischen": ["flur", "diele"] } ]
```
**Raumpolygone werden abgeleitet:** Geschossfläche (Innenseite der Außenwände bzw. im DG die Ausbaufläche) minus alle Wandflächen minus Trennlinien minus Öffnungen in der Decke. Jede so entstandene Teilfläche bekommt den Raum, dessen Stempel in ihr liegt. Polygon-Clipping übernimmt die Bibliothek `polygon-clipping@0.15.7` (MIT). Sie wird in die Seite eingebaut und braucht kein zusätzliches CDN. In ganzen Millimetern rechnet sie robust.
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
- **DG-Ausbau:** Kniewände als Wände mit `hoehe: fest 1000`, ihre Lage auf Achsen. Eine Prüfregel vergleicht die tatsächliche Höhe unter der Dachschräge mit dem Soll. Falls gewünscht, kann die Lage später aus „Kniewand 1,00 m“ berechnet werden (Rückfrage, siehe 8).
- **Treppe:** parametrisch mit Steigungen (15), Auftritt (250), Laufbreite (900), Wendelungsfeld (Stufen 1–6) und einem Anker an zwei Achsen (heute die Innenseite der Ostwand und `z.kind1S`). Die Steigung wird aus der Geschosshöhe abgeleitet. Die Treppenöffnung im DG ergibt sich aus Treppe und Kopfhöhe oder wird als eigener Wert mit Prüfung geführt (heute 99 cm).
- **Kamin, Stützpfosten, Dachfenster:** Objekte mit Lage an Achsen bzw. auf der Dachfläche.

### 3.9 Prüfmaße (Aufmaß)
Gemessene Strecken werden getrennt von den Steuerwerten geführt:
```json
{ "was": "Speisekammer lichte Tiefe", "von": "wand:eg.kind1_speis/unten", "bis": "wand:eg.speis_kueche/oben", "gemessen": 1262, "datum": "2026-10-12" }
```
Das Modell zeigt die Abweichung an. Der Nutzer entscheidet, ob er das Modell anpasst. So wird jede Messung genutzt, ohne dass Messfehler unbemerkt ins Modell wandern.

### 3.10 Später: Ausstattung
Möbel, Sanitär und Küche als Objekte, verankert an Raum oder Wand („an Wand X, 300 mm ab Ecke, Höhe 0“). Sie wandern mit, wenn die Wand sich verschiebt. Prüfungen: Kollision mit Wänden und Türaufschlägen, Bewegungsflächen, Kopfhöhe unter der Dachschräge.

---

## 4. 2D-Ansichten

### 4.1 Grundriss je Geschoss (EG, DG, optional Dachaufsicht)
- **Darstellung:** Wände gefüllt bzw. schraffiert nach Wandtyp, Fenster als Doppellinie, Türen mit Aufschlagbogen (sobald `anschlag` bekannt ist). Raumstempel mit Name, Fläche und lichten Maßen. Treppe mit Lauflinie und Stufennummern, dazu Kamin und Treppenöffnung. Im DG zusätzlich Höhenlinien der Dachschräge (1,00 m und 2,00 m), nützlich für Möbel und Wohnflächenberechnung.
- **Automatische Bemaßung:** außen drei Ketten wie im Bauplan (Gesamtmaß, Wandvorsprünge/Achsen, Öffnungen), innen lichte Raummaße und Wanddicken. Öffnungen in Plannotation „88,5/219“ (Breite/Höhe), dazu BRH.
- **Bearbeiten:** Klick auf ein Maß öffnet ein Eingabefeld (cm oder m, Komma). Pfeiltasten ändern um ±1 cm, mit Umschalt um ±10 cm. Klick auf eine Wand zeigt Typ, Dicke, Höhe und Öffnungen. Klick auf einen Raum zeigt Name und Belag.
- **Welche Seite bleibt fest?** Gesperrte Achsen bewegen sich nie. Ansonsten gilt als Standard **„Nachbar gibt nach“**: Nur die gewählte Wand wandert, abhängige Achsen werden ausgeglichen. Alternativ **„Kette schieben“**: Alles dahinter wandert mit. Ein Pin-Symbol an den Achsen zeigt den Zustand.
- **Farben nach Herkunft:** Plan, Aufmaß, Annahme und „in dieser Sitzung geändert“ bekommen je eine eigene Farbe. Die Befunde erscheinen als Marker im Plan und als Liste. Ein Klick springt zur Stelle.

### 4.2 Schnitte und Ansichten (Seitenansicht)
- **Ansichten Nord, Ost, Süd, West:** Fassade mit Öffnungen, Dachsilhouette, Geländelinie und Höhenkoten ü. NN.
- **Schnitte:** eine Linie im Grundriss ziehen. Voreingestellt sind A–A durch die Treppe und B–B quer durch Pias Zimmer. Der Schnitt zeigt Decken, geschnittene Wände, das Dachprofil aus `roofH`, Kniewände, DG-Wandoberkanten und die Treppe mit Kopfhöhenlinie (2,00 m).
- **Höhenketten:** OKFF EG, UK Decke, OKFF DG, Kniewand, Traufe, First.
- **Bearbeiten:** lichte Höhe, Deckenaufbau/Geschosshöhe (mit Wahl, welcher Wert abgeleitet wird), Brüstung und Sturz, Kniewandhöhe, Traufe, Überstand. Die Neigung ist gesperrt.
- **Technik:** Grundflächen des abgeleiteten Modells mit der Schnittlinie schneiden, dazu Höhenbereiche und Dachfunktion. Alles ist exakt, ohne Raycasting.

### 4.3 Kopplung mit 3D
Umschalter 2D / 3D / geteilt (auf dem Handy als Reiter). Eine Auswahl in 2D hebt dasselbe Element in 3D hervor und umgekehrt. Nach „Übernehmen“ wird nur das Haus in 3D neu aufgebaut (Gelände und Garten bleiben), alte Geometrien werden mit `dispose()` freigegeben. Der heutige Gesamtaufbau dauert in Node 175 ms, ein Neuaufbau nur des Hauses ist also im Browser flüssig.

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
Vor dem Übernehmen wird altes und neues abgeleitetes Modell verglichen: Räume (Fläche, lichte Maße), Wände (Länge, Lage), Öffnungen (verschoben, Abstand zum Wandende), Höhen (Steigung, DG-Wandhöhen) sowie neue und behobene Befunde. Im Grundriss erscheint der alte Umriss gestrichelt und der neue durchgezogen. Es gibt Rückgängig und Wiederholen.

**Beispiel:** Die lichte Tiefe der Speisekammer wird von 1,255 auf 1,30 m geändert (Modus „Nachbar gibt nach“).
1. Der Editor ändert `z.speisS.plus` von 1380 auf 1425.
2. Die Küche wird in der lichten Tiefe 3,025 → 2,98 m kleiner, ihre Fläche 10,8 → 10,6 m². Der Durchgang in der Wand wandert mit.
3. Es entstehen keine neuen Befunde. Der Kamin (hz 10,18–10,67) bleibt in der Speisekammer.
4. Mit „Übernehmen“ werden Patch und 3D-Neuaufbau ausgeführt.

**Gegenbeispiel:** Die Westwand des D-Bads (hx 10,46–10,635) wird nach Süden bis zur Wand des Nähzimmers (hz 6,375) verlängert. Folge: Fehler „Wand schneidet Wand Julians Zimmer/Diele“. Außerdem wird die Diele geteilt. Der Stempel bleibt im östlichen Teil, der westliche Teil wird gemeldet als „Teilfläche ohne Raum, ca. 3,2 m²“. Endet die Verlängerung mitten in der Diele, lautet der Befund stattdessen „frei endende Wand“.

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
    aendern.js            Patch anwenden, „Nachbar gibt nach“ / „Kette schieben“, Diff, Rückgängig
    bemassung.js          Maßketten für Grundriss und Schnitt
    geo2d.js              Polygonhilfen
  ansicht3d/              haus3d.js, dach3d.js, gelaende3d.js, garten3d.js (heutiger Code, umgezogen)
  ansicht2d/              grundriss.js, schnitt.js, svg.js
  ui/                     app.js (3D-Bedienung), editor.js (2D, Eingabe, Befundliste), tpl.html
tools/
  test/*.test.js          node --test (Regression, Regeln, Änderungen)
  shot_view.js            Screenshots wie bisher
  plan_svg.js             Grundriss/Schnitt als SVG-Datei, für Prüfungen ohne Browser
```

- **Build:** ES-Module, gebündelt mit `esbuild` zu einem IIFE-Skript, eingesetzt in `tpl.html`. Three.js bleibt global vom CDN. `python3 build.py` bleibt der Einstieg und ruft esbuild auf. Ergebnis ist wie bisher eine einzelne HTML-Datei, Tests importieren dieselben Module.
- **Sprache:** JavaScript mit JSDoc-Typen für das Datenmodell und eine Schema-Prüfung von `haus.json` beim Laden. TypeScript ist später möglich (esbuild kann beides), aber kein Muss.
- **Materialien** werden geteilt statt pro Raum und Wand neu erzeugt. Die Hervorhebung läuft über eine Kopie nur des gewählten Objekts.
- **Beschriftungen und Kennzahlen** kommen nur aus dem abgeleiteten Modell. Hinweistexte in `tpl.html` enthalten Zahlen nur noch als Platzhalter, die beim Build oder zur Laufzeit gefüllt werden.

---

## 7. Speichern und Arbeitsablauf

- Die Quelle bleibt im Repository (`src/data/haus.json`). Die Seite bringt sie beim Build mit.
- Änderungen in der Seite sind eine **Patchliste**. Der Entwurf wird lokal im Browser gespeichert (localStorage, nur Komfort). Dazu kommen **Export und Import als JSON**.
- Übernahme: Patch an Claude geben → `haus.json` anpassen → Build → Tests → Screenshot → unter derselben Artifact-URL veröffentlichen (wie bisher).
- Optional später: ein Artifact-Speicher als Laufzeitfunktion der Seite. Dann kann Claude die Änderungen direkt aus dem Artifact lesen, und Export/Import entfällt. Das wird in Phase 4 entschieden.
- **Datenschutz:** `haus.json` enthält nur Geometrie und die vereinbarten Raumnamen. Ein Test prüft `dist/` gegen eine Sperrliste (Straße, Ort, Eigentümer). Die Sperrliste liegt in `eingaben/` und wird nie veröffentlicht. Fehlt sie, wird der Test übersprungen.

---

## 8. Umsetzung in Phasen

Jede Phase endet mit grünen Tests, Screenshot-Kontrolle und, wo sichtbar, Veröffentlichung.

| Phase | Inhalt | Abnahme | Umfang |
|---|---|---|---|
| **0 Absichern** | `test_model.js` wird ein echter Test mit Assertions und Snapshot (Raumflächen, Wandanzahl, Hüllkörper, Dachhöhen). `package.json` aufräumen (Name, `build`/`test`). DG-Höhe 2,82 korrigieren, `pm*` entfernen, Kennzahlen aus dem Modell lesen. | `npm test` schlägt bei Abweichung fehl. | klein |
| **1 Daten herauslösen** | `haus.json` mit Achsen, Wandtypen, Wänden, Öffnungen (Durchgänge als echte Öffnungen). `model.js` wird auf die neue Struktur aufgeteilt und liest die Daten. Raumpolygone bleiben vorerst explizit. | 3D identisch: Snapshot und Screenshots aller Standardansichten unverändert. | mittel |
| **2 Räume ableiten, prüfen** | Clipping, Stempel, Trennlinien. Ein Vergleich der abgeleiteten mit den alten Polygonen ergibt eine Differenzliste zur Klärung. Prüfregeln 1–4, 7, 9–13, Befundliste im Panel. | Alte Polygone gelöscht, Abweichungen geklärt, 0 Fehler. | mittel |
| **3 Grundriss 2D (lesen)** | SVG für EG und DG, automatische Maßketten, Raumstempel, Herkunftsfarben, Umschalter 2D/3D. | Bemaßung stimmt mit dem Bauplan überein (Stichproben). | mittel |
| **4 Grundriss 2D (bearbeiten)** | Maße, Wanddicken, Öffnungen, Wandtypen ändern. Vorschau mit Diff und Befunden, Rückgängig/Wiederholen, Neuaufbau 3D, Export/Import, Entwurf lokal. | Beispiel 5.2 läuft in der Seite und im Node-Test. | groß |
| **5 Schnitt und Ansicht** | Fassaden, freie Schnitte, Höhenketten, Höhen bearbeiten. Treppen- und DG-Regeln (11, 13–16). | Schnitt A–A zeigt Kopfhöhe und Steigungen korrekt. | mittel |
| **6 Aufmaß** | Prüfmaße erfassen (auch auf dem Handy), Abweichungen anzeigen, Herkunft je Wert pflegen. | Gemessene Werte erscheinen mit Abweichung. | klein |
| **danach** | Ausstattung (Objektkatalog, Verankerung, Kollisionen, Bewegungsflächen), Wohnfläche im DG nach Höhenzonen. | | |

---

## 9. Offene Entscheidungen (Rückfrage an den Nutzer)

1. **Wo wird bearbeitet?** Direkt in der veröffentlichten Seite (dann Export/Import oder Artifact-Speicher) oder nur über Claude im Repository?
2. **Standard beim Ändern eines Innenmaßes:** „Nachbar gibt nach“ (empfohlen) oder „Kette schieben“?
3. **Außenmaße 12,95 × 14,655 m sperren** (Absteckung)? Empfohlen: ja.
4. **Offene Raumgrenzen** Eltern/Flur und Flur/Diele: wirklich ohne Wand? **Treppe im Nähzimmer:** abgetrennt oder offen, und soll die Treppenfläche aus der Raumfläche heraus?
5. **DG-Wanddicken** 12/15/17/18 cm: gemessen oder vereinheitlichen?
6. **Kniewände:** Lage aus dem Plan (Höhe wird geprüft) oder Höhe 1,00 m vorgeben und Lage berechnen?
7. **Eingabe in cm oder m,** und Öffnungen in Plannotation (88,5/219)?
