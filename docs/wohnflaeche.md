# Wohnfläche

Vom Build aus `src/data/haus.json` geschrieben (`node tools/wohnflaeche.js --datei docs/wohnflaeche.md`), nicht von Hand ändern. Jede Maßänderung zeigt sich hier im Git-Diff.

```
Wohnfläche nach WoFlV (Rohbaumaße, Putzabzug 3 %), m²
Raum                       Grundfl.  Kamin  Treppe   ≥ 2 m   1–2 m   < 1 m  Wohnfl.
EG:
  Eltern                      16,30                  16,30    0,00    0,00    15,81
  HAR                          8,88                   8,88    0,00    0,00     8,61
  Julians Zimmer              13,25                  13,25    0,00    0,00    12,85
  D-Bad                        3,77                   3,77    0,00    0,00     3,66
  Bad (Eltern)                 8,79                   8,79    0,00    0,00     8,53
  Ankleide                     5,64                   5,64    0,00    0,00     5,47
  Flur / Diele                11,92                  11,92    0,00    0,00    11,56
  Nähzimmer                   10,82           3,50    7,31    0,00    0,00     7,09
  Speisekammer                 4,27   0,17            4,09    0,00    0,00     3,97
  Wohnen / Essen              39,73                  39,73    0,00    0,00    38,54
  Küche                       10,95                  10,95    0,00    0,00    10,62
  Summe EG                   134,31                                          126,71
DG:
  Pias Zimmer                 33,12                  17,84   15,28    0,00    24,71
  Arbeitszimmer               15,55                   6,17    9,39    0,00    10,54
  Abstellkammer                8,64   0,17            2,36    6,10    0,00     5,25
  Treppe und Flur (DG)         2,61                   1,80    0,82    0,00     2,14
  Summe DG                    59,92                                           42,64
Summe Wohnfläche             194,23                                          169,35
```

Spalten: Grundfläche = Raumfläche aus den Wänden (Rohbaumaße); Kamin und Treppe sind abgezogen; die Zonen teilen den Rest nach lichter Höhe (≥ 2 m voll, 1–2 m zur Hälfte, < 1 m nicht); Wohnfläche = angerechnete Fläche abzüglich Putzabzug.

## Grundlage

- Wohnflächenverordnung (WoFlV) §§ 2–4. Der Putzabzug von 3 % gilt, weil die Maße Rohbaumaße sind (§ 4 Nr. 2); `wohnflaeche.putzabzug` in `haus.json`.
- Abgezogen werden der Kamin (Schornstein über 0,1 m² und höher als 1,50 m) und die Stufen der Treppe im EG (mehr als drei Steigungen), § 3 Abs. 2.
- Raumhöhe im Dachausbau: lotrecht von der Oberkante des Fußbodens bis zur Unterkante der Sparren (Dachhaut minus 22 cm, `dg.wandAbstandDachhaut`). Das ist eine Annahme zur Dämmung und Bekleidung.
- Nicht enthalten: Terrasse (zu einem Viertel, höchstens zur Hälfte), Türnischen und Wandnischen. Zubehörräume bekommen `zubehoer: true` am Raum in `haus.json`; bisher ist keiner so eingestuft.
