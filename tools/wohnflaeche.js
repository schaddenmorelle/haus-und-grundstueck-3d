/* Wohnflächenberechnung nach WoFlV aus src/data/haus.json (Plan Phase 7).
   Aufruf:  node tools/wohnflaeche.js                    Tabelle auf die Konsole
            node tools/wohnflaeche.js --datei <datei.md>  Dokument schreiben (der Build ruft es mit docs/wohnflaeche.md auf; jede Maßänderung ist dann im Git-Diff sichtbar)
   Die Regeln stehen im Kopf von src/wohnflaeche.js. */
const fs = require('fs'), path = require('path');
const { werteAufloesen } = require('../src/werte.js');
const { raeumeAbleiten } = require('../src/raeume.js');
const { dachAbleiten } = require('../src/dach.js');
const { treppeAbleiten } = require('../src/treppe.js');
const { wohnflaecheAbleiten, wohnflaecheText } = require('../src/wohnflaeche.js');
const haus = require('../src/data/haus.json');

const WV = werteAufloesen(haus), abl = raeumeAbleiten(haus, WV), dach = dachAbleiten(haus, WV);
const T = haus.treppe && haus.treppe.steigungen && haus.treppe.anker ? treppeAbleiten(haus, WV) : null;
const w = wohnflaecheAbleiten(haus, WV, abl, dach, T), tabelle = wohnflaecheText(w);

const i = process.argv.indexOf('--datei');
if (i < 0) { console.log(tabelle); process.exit(0); }
if (!process.argv[i + 1]) { console.error('--datei braucht einen Dateinamen'); process.exit(1); }
const md = [
  '# Wohnfläche',
  '',
  'Vom Build aus `src/data/haus.json` geschrieben (`node tools/wohnflaeche.js --datei docs/wohnflaeche.md`), nicht von Hand ändern. Jede Maßänderung zeigt sich hier im Git-Diff.',
  '',
  '```',
  tabelle,
  '```',
  '',
  'Spalten: Grundfläche = Raumfläche aus den Wänden (Rohbaumaße); Kamin und Treppe sind abgezogen; die Zonen teilen den Rest nach lichter Höhe (≥ 2 m voll, 1–2 m zur Hälfte, < 1 m nicht); Wohnfläche = angerechnete Fläche abzüglich Putzabzug.',
  '',
  '## Grundlage',
  '',
  '- Wohnflächenverordnung (WoFlV) §§ 2–4. Der Putzabzug von 3 % gilt, weil die Maße Rohbaumaße sind (§ 4 Nr. 2); `wohnflaeche.putzabzug` in `haus.json`.',
  '- Abgezogen werden der Kamin (Schornstein über 0,1 m² und höher als 1,50 m) und die Stufen der Treppe im EG (mehr als drei Steigungen), § 3 Abs. 2.',
  '- Raumhöhe im Dachausbau: lotrecht von der Oberkante des Fußbodens bis zur Unterkante der Sparren (Dachhaut minus 22 cm, `dg.wandAbstandDachhaut`). Das ist eine Annahme zur Dämmung und Bekleidung.',
  '- Zubehörräume (§ 2 Abs. 3 Nr. 1: Keller, Abstellräume außerhalb der Wohnung, Waschküchen, Trockenräume, Heizungsräume, Garagen) zählen nicht zur Wohnfläche: `zubehoer: true` am Raum in `haus.json`. Der HAR dient als Technikraum (Heizung, Lüftung, Stromkasten) und Waschraum (Waschmaschine, Trockner) und ist deshalb eingestuft (Angabe des Nutzers vom 12.10.2026). Wäre er ein Hauswirtschaftsraum innerhalb der Wohnung, zählte er voll.',
  '- Terrasse (§ 4 Nr. 4): Balkone, Loggien, Dachgärten und Terrassen in der Regel zu einem Viertel, höchstens zur Hälfte; überdacht oder offen gilt dieselbe Regel. `terrasse` in `haus.json` (Anteil 0,25). Kein Putzabzug.',
  '- Nicht enthalten: Türnischen und Wandnischen.',
  ''
].join('\n');
fs.mkdirSync(path.dirname(path.resolve(process.argv[i + 1])), { recursive: true });
fs.writeFileSync(process.argv[i + 1], md);
console.log('geschrieben: ' + path.relative(process.cwd(), path.resolve(process.argv[i + 1])));
