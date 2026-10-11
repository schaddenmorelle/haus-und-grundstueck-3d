# Abgleich: abgeleitete Räume gegen die alten Raumpolygone (Phase 2)

Stand: 11.10.2026. Die Räume in `src/data/haus.json` haben keine Polygone mehr. `src/raeume.js` leitet sie ab: Geschossfläche minus Vereinigung aller Wandflächen (und Trennlinien) ergibt Teilflächen, jede Teilfläche gehört dem Raum, dessen Stempel in ihr liegt. Dieses Blatt hält fest, was sich gegenüber den alten, von Hand gepflegten Polygonen geändert hat und wie jede Abweichung geklärt wurde. Die alten Polygone stehen in der Git-Historie (`git show b1502ff:src/data/haus.json`).

## Flächen alt gegen neu

| Raum | alt (m²) | neu (m²) | Δ (m²) | Ursache |
|---|---:|---:|---:|---|
| Eltern | 16,2963 | 16,2971 | +0,0009 | Schrägwand, Rundung der alten Eckpunkte (1) |
| HAR | 8,8795 | 8,8795 | 0 | |
| Julians Zimmer | 13,2494 | 13,2492 | −0,0002 | Schrägwand (1) |
| D-Bad | 3,7700 | 3,7700 | 0 | |
| **Bad (Eltern)** | 8,9238 | 8,7935 | **−0,1303** | WC-Wand liegt jetzt nicht mehr im Raum (2) |
| Ankleide | 5,6376 | 5,6375 | 0 | |
| Flur / Diele | 11,9221 | 11,9222 | +0,0002 | Schrägwand (1) |
| Nähzimmer | 10,8151 | 10,8151 | 0 | |
| Speisekammer | 4,2651 | 4,2651 | 0 | |
| Wohnen / Essen | 39,7312 | 39,7312 | 0 | Trennlinie zur Küche (3) |
| Küche | 10,9470 | 10,9470 | 0 | Trennlinie zum Wohnen (3) |
| Pias Zimmer | 33,1173 | 33,1173 | 0 | Wand mit Tür zum Flur (3) |
| Arbeitszimmer | 15,5545 | 15,5545 | 0 | |
| Abstellkammer | 8,6356 | 8,6356 | 0 | Wand mit Tür zum Flur (3) |
| **Treppe und Flur (DG)** | 3,3165 | 2,6122 | **−0,7043** | die beiden Treppenwände und die zwei Wände mit Tür im Flur lagen im alten Polygon (2, 3) |

In `tools/snapshot.json` ändern sich dadurch nur Bad (8,92 → 8,79) und Treppe und Flur DG (3,32 → 2,61); alle anderen Flächen bleiben auf zwei Stellen gleich. Die Prüfmaße aus dem Aufmaß (`tools/pruefmasse.json`) sind vor und nach dem Umbau Wert für Wert gleich.

## Geklärte Abweichungen

1. **Schrägwände (Δ unter 1 dm²).** Die alten Polygone benutzten gerundete Eckpunkte (z. B. 8937,5 / 3262,5), die zur tatsächlichen Wanddicke der Schrägwand (175 bzw. 115 mm) nicht ganz passten (bis 0,7 mm). Das Polygon folgt jetzt der Wand. Eckpunkte, die weniger als 1 mm von der Verbindung ihrer Nachbarn entfernt liegen, werden in der Darstellung entfernt (`ringBereinigt`). Die Fläche selbst wird aus der exakten Teilfläche berechnet.
2. **Wände im Raum.** Die alten Polygone zogen nur die Außenlinie und ließen freistehende Wände im Raum liegen. Jetzt zählt die Fläche einer Wand nicht mehr zum Raum: die WC-Wand im Bad (11,5 × 112,5 cm) und die Treppenwände nördlich und südlich der Treppenöffnung im DG (je 12,5 cm × 1,92 m). Die abgeleiteten Werte sind die genaueren; die Flächen im Dachausbau bleiben Grundflächen zwischen den Kniewänden, keine Wohnfläche.
3. **Offene Übergänge und Türen.** Wo zwei Räume ohne Wand ineinander übergehen, hielt das alte Polygon die Grenze. Ohne Wand würden die abgeleiteten Flächen verschmelzen (Befund „Räume nicht getrennt“). Klärung des Nutzers vom 11.10.2026:
   - **EG, Küche / Wohnen / Essen** bleibt offen. Dafür gibt es eine Trennlinie (`eg.wohnen-kueche`, hx 9,005 m, von der Küchen-Nordseite bis zur Südwand). Sie hat keine Dicke (rechnerisch 0,01 mm).
   - **DG:** Pias Zimmer, Arbeitszimmer und Abstellkammer haben je eine **Tür** zum Flur, keine offenen Übergänge. Neben der Trennwand zum Arbeitszimmer (Tür 86 cm, Plan) gibt es deshalb zwei Wände mit Tür: `dg.wand-pia-flur` (hz 7,92–8,045 m) und `dg.wand-flur-abstell` (hz 9,645–9,77 m), je von der Trennwand bis zur Treppenwand (hx 8,30–9,20 m), mit der Flucht der Treppenwand. Die Türen sind wie die zum Arbeitszimmer Öffnungen ohne Sturz und Türblatt. **Breite 76 cm und die Lage (mittig in der 90-cm-Lücke) sind angenommen**, die Maße reicht der Nutzer nach.
4. **Schrägwand-Enden (zwei Datenkorrekturen).** Zwei Schrägwände reichten auch mit ihrer Verlängerung von 5 cm nicht in die Wand, an die sie anschließen (Lücke an der Mittellinie 3,8 cm bzw. 0,8 cm). Im Raumumriss blieb eine Zacke bzw. Kerbe von bis zu 9 cm (Julians Zimmer) und 4,6 cm (Bad). Die Mittellinie ist dieselbe, nur Anfang bzw. Ende liegt jetzt in der Nachbarwand:
   - `eg.julian-flur-schraeg`: Anfang von 7992 / 3448 auf 7900 / 3356 mm (in der Wand HAR / Julians Zimmer).
   - `eg.vorraum-bad-schraeg`: Ende von 3729 / 4686 auf 3790 / 4747 mm (in der Wand Bad / Ankleide). Die Badtür misst ab Wandanfang und bleibt unverändert.
   In der 3D-Ansicht ändern sich von den 800 Netzen sieben: die beiden Wandkörper (die Ecke ist jetzt geschlossen), die Bodenflächen von Bad, Eltern und Flur (Zehntelmillimeter, beim Bad die WC-Wand) und zwei weitere nur durch Float32-Rundung (unter 5 µm).
5. **Wandenden werden gekappt.** Endet eine Schrägwand in einer querlaufenden Wand, ragten ihre Ecken (das Ende ist nicht rechtwinklig) hinter der Wand in den Nachbarraum. `wandEndenKappen` schneidet die Wand an der abgewandten Seite der Nachbarwand ab (Plan 3.4, „Wandenden werden auf die angrenzende Wandseite gekürzt“). Die gebauten Wandkörper in 3D bleiben davon unberührt.
6. **Gewollt freie Enden.** Vier Wände enden mit Absicht frei und tragen `freiesEnde: true`: die WC-Wand im Bad, die Schrägwand nördlich der Treppenöffnung (Ende an der Hauskante) und beide Treppenwände im DG (Anfang im Flur, Ende an der Hauskante). Alle anderen Wandenden sind angeschlossen.

## Folgen für die Tests

- `tools/test_daten.js`, **HAR 10 cm tiefer:** Der Flur verliert 1,495 × 0,10 m². Die alten Polygone rechneten zusätzlich ein Dreieck an der Schrägwand ein (Kathete 0,875 m), weil die Schrägkante mit der HAR-Wand wanderte. Die Schrägwand bleibt in Wirklichkeit stehen, das Dreieck entfällt.
- `tools/test_daten.js`, **Wanddicke:** Der Test mit IW115 (11,5 → 13,5 cm) erwartete Wohnen um die ganze Breite kleiner. Tatsächlich ändert sich nur die Nordwand der Ankleide (3,76 m); der Teil unter dem Flur ist eine IW175-Wand, und an der Westecke entsteht eine Kerbe von 2 × 13,5 cm, weil die dickere Wand Bad / Ankleide nicht mehr bündig mit der Innenseite der Außenwand liegt. Der Test nimmt jetzt IW125 (Westwand des D-Bads): das D-Bad wird 1 cm schmaler, alle anderen Räume bleiben.
- Neu: `tools/test_pruefen.js` (erfundenes Haus, jede Regel mit Fall und Gegenfall), Beispiel und Gegenbeispiel aus Plan 5.2 auf den echten Daten (Speisekammer-Wand nach Süden; Westwand D-Bad nach Süden verlängert).

## Prüfergebnis auf den echten Daten

0 Fehler, 0 Warnungen, 1 Hinweis: die Maßkette der DG-Treppe (Lauf 0,90 + Geländer 0,15 + Nische 0,54 = 1,59 m gegen 1,60 m Wandabstand, Rest 10 mm). Die Kniewände erreichen 0,97 bis 1,00 m (Soll 1,00 ± 0,05 m); die niedrigste Stelle liegt an der West- und Ostkniewand, wo die Dachhaut abzüglich 22 cm Sparrenabstand die Wand begrenzt.

Noch nicht geprüft (spätere Phasen): Erreichbarkeit der Räume (Regel 5), Mindestmaße (6), Kopfhöhe auf der Treppe (Regel 11, braucht den Schnitt), Dachfenster (14), First (15), Treppe und Kamin über beide Geschosse (16).
