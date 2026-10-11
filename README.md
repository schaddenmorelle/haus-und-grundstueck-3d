# Haus und Grundstück 3D

Interaktives, maßstabsgetreues 3D-Modell von Grundstück, Haus und Dachausbau (Three.js, eine HTML-Datei).

**Privates Repository.** Es enthält auch Pläne und PDFs mit persönlichen Daten. Nicht öffentlich machen.

## Aufbau
| Ordner | Inhalt |
|---|---|
| `src/` | `model.js` (Geometrie), `app.js` (Bedienung), `tpl.html` (Seitenvorlage) |
| `dist/` | gebaute Seite `haus-und-grundstueck-3d.html` (wird als Artifact veröffentlicht) |
| `tools/` | Modelltest, Screenshot-Werkzeug |
| `eingaben/` | Originalpläne, PDFs, Fotos und Skizzen des Nutzers, Seitenbilder der Pläne |
| `analyse/` | Hilfsskripte und Zwischendaten der Planauswertung |
| `archiv/` | frühere Modellstände (v1–v4) |

## Bauen und Testen
```
npm ci
python3 build.py
node tools/test_model.js
```
Hinweise zu Koordinaten, Maßen und geklärten Annahmen stehen in `CLAUDE.md`. Was in `eingaben/` liegt, steht in `eingaben/README.md`.
