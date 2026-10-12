# Haus und Grundstück 3D

Interaktives, maßstabsgetreues 3D-Modell von Grundstück, Haus und Dachausbau (Three.js, eine HTML-Datei).

**Privates Repository.** Es enthält auch Pläne und PDFs mit persönlichen Daten. Nicht öffentlich machen.

## Aufbau
| Ordner | Inhalt |
|---|---|
| `src/` | `data/haus.json` (Rohbau-Maße als Daten), `werte.js` (Achsen auflösen), `raeume.js` (Räume aus den Wänden ableiten), `dach.js` (Dachhöhe, First), `treppe.js` (Stufen, Kopfhöhe), `pruefen.js` (Prüfregeln), `grundriss.js` (2D-Grundriss mit Maßketten), `schnitt.js` (Schnitte und Ansichten), `aendern.js` (Maße ändern, Auswirkungen, Änderungsliste), `model.js` (Geometrie), `app.js` (Bedienung 3D), `plan2d.js` (Bedienung Grundriss, Schnitt, Ansicht), `tpl.html` (Seitenvorlage) |
| `dist/` | gebaute Seite `haus-und-grundstueck-3d.html` (wird als Artifact veröffentlicht), `veroeffentlicht.json` (Hash der zuletzt veröffentlichten Seite) |
| `tools/` | Tests (Daten, Räume und Prüfregeln, Treppe, Grundriss, Schnitt und Ansicht, Ändern, Modell, Veröffentlichungsstand), gesperrte Werte, `aendern.js` (Maße in `haus.json` ändern), Screenshot-Werkzeuge (`shot_view.js` 3D, `shot_plan.js` Grundriss, Schnitt und Ansicht, `shot_probe.js` Probiermodus), `plan_svg.js`, `live_pruefen.js` |
| `eingaben/` | Originalpläne, PDFs, Fotos und Skizzen des Nutzers, Seitenbilder der Pläne |
| `analyse/` | Hilfsskripte und Zwischendaten der Planauswertung |
| `archiv/` | frühere Modellstände (v1–v4) |
| `docs/` | Planung, z. B. `plan-parametrisches-modell.md` (Datenmodell, 2D-Bemaßung, Prüfung), Abgleiche (`abgleich-eg-grundriss.md`, `abgleich-raeume-ableiten.md`), `plaene/` (Grundrisse, Schnitte und Ansichten als SVG, vom Build geschrieben) |
| `.devcontainer/` | Entwicklungsumgebung für die lokale Arbeit (Windows/WSL, Mac) |
| `.claude/` | Skills für KI-Agenten (`veroeffentlichen`, `wissensrueckgabe`) |

Im Wurzelverzeichnis: `AGENTS.md` (Regelwerk und Projektbeschreibung, `CLAUDE.md` verweist darauf) und `TODO.md` (offene Punkte).

## Bauen und Testen
```
npm ci
npm test
npm run build
```
Hinweise zu Koordinaten, Maßen und geklärten Annahmen stehen in `AGENTS.md`. Was in `eingaben/` liegt, steht in `eingaben/README.md`.
