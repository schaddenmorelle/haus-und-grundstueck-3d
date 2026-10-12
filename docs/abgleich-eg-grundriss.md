# Abgleich Erdgeschoss mit dem bemaßten Grundriss

Stand 11.10.2026. Referenz ist `eingaben/bilder/32710f5f-image.png`, der genaueste vorhandene EG-Plan. Er enthält zwei Arten von Maßen:
- **Gedruckte Maßketten:** Rohbaumaße. Sie gehen in sich auf, zum Beispiel ergibt jede Kette 12,95 bzw. 14,655 m.
- **Rote Handmaße des Nutzers:** fertige Innenmaße mit Putz und Belag. Sie dürfen deshalb einige Zentimeter kleiner sein als der Rohbau.

**Vorgehen**
- Die Geometrie folgt den gedruckten Maßketten.
- Die roten Raummaße stehen als Prüfmaße in `src/data/pruefmasse.json`. `npm test` vergleicht sie mit dem Modell. Erwartet ist Modell − Aufmaß zwischen −1 und +4 cm.
- Wo rote Maße in sich aufgehen und mehr als 10 cm vom Druck abweichen, ist das Aufmaß übernommen.

## Korrigiert

| Bauteil | vorher im Modell | jetzt | Quelle |
|---|---|---|---|
| **Elterntür** | Wand Eltern/Flur bei hz 3,36 mit Tür (Annahme) | Querwand hx 6,26–6,435 zwischen HAR-Südwand und Ankleide, Tür 88,5/219 | Kette 5,875 + 17,5; Aufmaß 168 |
| **Vorraum mit Bad- und Ankleidetür** | Teil des Flurs | Teil des Raums Eltern: 12,4 → 16,3 m². Flur / Diele: 15,2 → 11,9 m² | Plan, Nutzer |
| Wand Eltern / Bad | 17,5 cm bei hz 3,35–3,525 | 11,5 cm bei hz 3,395–3,51, Eltern 3,01 tief | Kette links |
| Schräge Wand Vorraum / Bad | kurzer Knick, Rest offen | 45°-Wand von (2,52 / 3,395) bis (3,77 / 4,645), 11,5 cm, Badtür 88,5 darin | 2,135 / 25 / Kette |
| WC-Wand | 17,5 cm bei hx 1,26 | 11,5 cm bei hx 1,285–1,40 (WC 90 cm breit) | Maß 90 |
| Wand Bad / Ankleide | 17,5 cm (hx 3,71–3,885) | 11,5 cm (hx 3,77–3,885), Bad 3,385 breit | Kette oben |
| Ankleide Nord | hz 4,60–4,775, Tür 62 cm | 11,5 cm bei hz 4,645–4,76, Tür 76 bei hx 4,615–5,375 | Kette links, Plan |
| Schräge Wand Ankleide / Flur | Schätzung, 20 cm | nach 1,5725 / 27,25 / 62,5 (rund 13 cm) | Plan |
| HAR Süd | hz 3,36–3,535, Tür 6,775–7,62 | hz 3,335–3,51 (HAR 2,95 tief), Tür 6,725–7,61 | Kette rechts, Aufmaß 295 / 198 |
| Schräge Wand Julians Zimmer / Flur | 20 cm | 17,5 cm (Planänderung 1), Flurseite 1,2375 | Plan |
| D-Bad West | 17,5 cm (hx 10,46–10,635) | 12,5 cm (hx 10,44–10,565), 1,5025 ab der Schräge | Plan |
| Querwände Ostseite | jeweils 2–5 cm zu weit südlich, teils 12,5 statt 11,5 cm | D-Bad Nord 2,27–2,385; Süd 4,27–4,385; Nähzimmer Nord 6,335–6,45; Nähzimmer/Speisekammer 9,645–9,76; Speisekammer/Küche 11,02–11,195 | Kette rechts |
| Wohnen Nordwand | 17,5 cm bei hz 6,405–6,58 | Ankleide/Wohnen 11,5 cm (6,395–6,51); Flur/Wohnen 17,5 cm (6,335–6,51) mit Tür 7,995–8,88 | Ketten links/rechts |
| Wohnen | 7,69 m tief, 39,3 m² | 7,76 m tief, 39,7 m² | Kette, Aufmaß 776 |
| Fensterhöhe | Oberkante 2,625 | Oberkante 2,375: sichtbar 1,25 m, Rohbauöffnung 1,50 m inkl. Rollladenkasten | Plan „RBÖ = 1,50“ |
| Ostwand Fenster und Haustür | 2–6 cm verschoben | 1,01–1,77; 3,01–3,77; Tür 4,51–6,27; 7,01–8,52; 11,885–13,395 | Kette rechts |
| Badfenster Süd | 1,75–3,25 | 1,76–3,27 | Kette unten |
| Kamin | hz 10,18–10,67 | 35 cm vor der Wand Nähzimmer/Speisekammer: hz 10,11–10,60 | Maße 35 / 50 / 41 |
| Treppe, Treppenöffnung und Treppenwände im DG | Anker hz 9,69 | Anker hz 9,645 (Wand Nähzimmer/Speisekammer). Alles rückt 4,5 cm nach Norden, 1,60 m und 99 cm bleiben | folgt der Wand |

## Aufmaß übernommen (weicht deutlich vom Druck ab)

| Stelle | Plan | Aufmaß | Folge im Modell |
|---|---|---|---|
| Westwand Wohnen, Pfeiler zwischen den Fenstertüren | 75 / 111,5 / 86,5 | 53 / 111 / 108 | Die Summe passt zu 7,76 m. Fenstertür 1 liegt jetzt bei 7,04–9,05, Tür 2 bei 10,16–12,17. Beide sind gut 20 cm nach Norden gerückt, Tür 3 bleibt. |
| Südwand Julians Zimmer und D-Bad, Wandstücke neben den Türen | gezeichnet rund 63 / 135 | 47 / 150 | Die Summe passt bis zur Ostwand. Tür Julians Zimmer liegt jetzt bei 9,275–10,16, rund 16 cm weiter westlich. D-Bad-Tür 76 bei 11,66–12,42. |

## Nachgemessen (geklärt)

| Maß | erst notiert | nachgemessen | Modell (Rohbau) | Bemerkung |
|---|---|---|---|---|
| Flur / Diele, Breite von der Ankleide bis zur Ostwand | 484 | 471 | 474,5 | 484 war bis zur Scheibe neben der Haustür gemessen. |
| D-Bad, Breite | 204 | 200 | 200 | passt |
| Eltern, Wand zum HAR | 287 ??? | 314 | 312,5 | Wandlänge bis zur Ecke am Vorraum, passt |

Damit liegen alle Prüfmaße im erwarteten Bereich.

## Bestätigt (Abweichung höchstens 2 cm, bzw. bis 4 cm kleiner durch Putz)

Raummaße: Eltern 300, HAR 300 / 295, Julians Zimmer 464 / 188, D-Bad Tiefe 189, Bad 339 / 288, Ankleide 374, Flur Tiefen 195 / 196, Nähzimmer 339 / 320, Speisekammer 125, Wohnen 776.

Wandstücke: Westwand 50 / 50 / 87 / 124, Nordwand 81 / 118 / 112 / 200, Ostwand 63 / 188 / 49 / 63 / 49 / 55 / 114 / 69 / 88, Südwand 566, HAR 198 / 168, Vorraum 85, Ankleide 125 / 144 / 163 / 408, Bad 157 / 213, Julians Zimmer 290 / 200, Nähzimmer 103 / 173 / 175 / 468, Küche 188 / 205.

## Abgleich mit dem Foto der Ostseite

`eingaben/bilder/foto-ostseite-alt.webp`, ein altes Foto noch vor dem Dachausbau. Betrachtet wird nur das Haus.

- **Bestätigt:**
  - Fensterteilung (Küche und Nähzimmer zweiflügelig, D-Bad und Julians Zimmer einflügelig).
  - Fenster und Haustür enden oben auf gleicher Höhe. Das Verhältnis Fenster- zu Türhöhe auf dem Foto beträgt 0,52, das Modell hat 1,25 / 2,375 = 0,53.
  - Kamin auf der Südseite am Firstende, Walmdach mit kurzem First, Stufe vor der Haustür.
- **Angepasst:**
  - Fensterrahmen und Türen weiß.
  - Haustür: weißes Türblatt mit senkrechtem Glasstreifen, südlich daneben ein Seitenteil aus Satinato-Glas. Aufteilung 1,16 + 0,60 m, nach Foto geschätzt.
  - Kamin über Dach dunkel verkleidet, mit Edelstahl-Abgasrohr und Haube.
  - Dachziegel dunkelbraun, Sockel dunkel.
  - Dachrinnen ringsum und Fallrohre DN 100. Die Fallrohre liegen an der NW-, NO- und SO-Ecke wie im Plan („RR100“); das Foto zeigt die beiden an der Ostseite.
- **Nicht übertragen:**
  - Die fehlenden Dachfenster: Das Foto ist älter als der Dachausbau.
  - Satellitenschüssel, Lampe, Briefkasten und Hausnummer.

## Nicht übernommen

- Vorwände für WC und Dusche (Höhe 1,35 m) in Bad und D-Bad, Rohrkästen und der Schacht neben der Elterntür (27,25 cm breit): Das gehört zur Ausstattung und folgt später.
- Außenwandaufbau: Der Plan zeigt 17,5 cm Mauerwerk + 21 cm Dämmung, das Modell 18,5 + 20 cm wie vom Nutzer festgelegt. Die Gesamtdicke ist in beiden Fällen 38,5 cm.
- Die Einschubtreppe („EST“) im Nähzimmer aus dem Originalplan wurde durch die heutige Treppe ersetzt.
