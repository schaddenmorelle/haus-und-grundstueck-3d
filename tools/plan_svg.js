/* Schreibt die Grundrisse als SVG nach docs/plaene/ (Plan 4.1: jede Maßänderung ist im Git-Diff als Bild sichtbar).
   Aufruf: node tools/plan_svg.js   (der Build ruft es auf)   Ausgabe: docs/plaene/grundriss-eg.svg, grundriss-dg.svg */
const fs = require('fs'), path = require('path');
const { werteAufloesen } = require('../src/werte.js');
const { raeumeAbleiten } = require('../src/raeume.js');
const { dachAbleiten } = require('../src/dach.js');
const { pruefen } = require('../src/pruefen.js');
const { grundrissAbleiten, grundrissSvg } = require('../src/grundriss.js');
const haus = require('../src/data/haus.json');

const WV = werteAufloesen(haus), abl = raeumeAbleiten(haus, WV), dach = dachAbleiten(haus, WV), befunde = pruefen(haus, WV, abl, dach);
const dir = path.join(__dirname, '..', 'docs', 'plaene');
fs.mkdirSync(dir, { recursive: true });
['EG', 'DG'].forEach(g => {
  const f = path.join(dir, 'grundriss-' + g.toLowerCase() + '.svg');
  fs.writeFileSync(f, grundrissSvg(grundrissAbleiten(haus, WV, abl, dach, befunde, g), { standalone: true }) + '\n');
  console.log('geschrieben: ' + path.relative(process.cwd(), f));
});
