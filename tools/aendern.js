#!/usr/bin/env node
/* Ändert die Hausdaten src/data/haus.json (Plan Abschnitt 5.2 und 9, Phase 4). Der Kern steht in src/aendern.js.

   Aufruf:  node tools/aendern.js [Optionen] <Änderung> [<Änderung> …]
            node tools/aendern.js [Optionen] --liste <datei.json>        Änderungsliste aus dem Probiermodus der Seite einspielen

   Änderung (Werte mit Einheit: 1,30m  12,5cm  885mm):
     <maß>=<wert>                          ein Maß aus dem Grundriss, z. B. raum:speis.tiefe=1,30m  wand:eg.dbad-west=13,5cm  eg.har-sued.oeff1=90cm
     achse:<name>=<wert>                   Lage einer Achse, z. B. achse:z.speisS=11,06m
     wandtyp:<name>=<wert>                 Dicke eines Wandtyps, z. B. wandtyp:IW125=135mm
     wandende:<wand>.von|bis=<achse|wert>  Ende einer Wand, z. B. wandende:eg.dbad-west.bis=z.flurS
     oeffnung:<wand>.oeff<k>.<feld>=<wert>  ab, breite, hoehe oder bruestung einer Öffnung

   Optionen:
     --datei <pfad>        andere Datei statt src/data/haus.json
     --trockenlauf         nur anzeigen, nichts schreiben
     --trotzdem            auch bei neuen Fehlern der Prüfung schreiben
     --aussenmass          gesperrte Außenmaße dürfen sich ändern
     --einzeln             bei wand:<id>: nur diese Wand bekommt die Dicke (statt des Wandtyps)
     --bewegt <name>       bei einem Maß: diesen Parameter bewegen (Achse, Wandtyp oder Wand)
     --vergleich <ordner>  je Geschoss ein Vergleichs-SVG (alter Wandumriss gestrichelt) schreiben
     --quelle <herkunft>   Herkunft des neuen Werts setzen (plan, aufmass, nutzer, annahme); ohne die Angabe bleibt die bisherige stehen
     --stand-ignorieren    bei --liste: den Stand von haus.json nicht prüfen
   Ausgang: 0 geändert (oder Trockenlauf ohne Abbruch), 1 abgebrochen, 2 falscher Aufruf. */
const fs = require('fs'), path = require('path'), assert = require('assert');
const A = require('../src/aendern.js');

function hilfe() {
  return 'Aufruf: node tools/aendern.js [Optionen] <maß>=<wert> …   oder   --liste <datei.json>\n' +
    'Beispiel: node tools/aendern.js raum:speis.tiefe=1,30m\n' +
    'Optionen: --datei <pfad>  --trockenlauf  --trotzdem  --aussenmass  --einzeln  --bewegt <name>  --vergleich <ordner>  --liste <datei>  --quelle <herkunft>  --stand-ignorieren\n' +
    'Werte mit Einheit (mm, cm oder m); weitere Arten: achse:, wandtyp:, wandende:, oeffnung: (siehe Kopf von tools/aendern.js)';
}
function aufruf(args) {
  const o = { datei: path.join(__dirname, '..', 'src', 'data', 'haus.json'), optionen: {}, positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i], wert = () => { if (i + 1 >= args.length) throw new Error('Zu ' + a + ' fehlt ein Wert'); return args[++i]; };
    if (a === '--datei') o.datei = wert();
    else if (a === '--trockenlauf') o.trockenlauf = true;
    else if (a === '--trotzdem') o.optionen.trotzdem = true;
    else if (a === '--aussenmass') o.optionen.aussenmass = true;
    else if (a === '--einzeln') o.einzeln = true;
    else if (a === '--bewegt') o.bewegt = wert();
    else if (a === '--vergleich') o.vergleich = wert();
    else if (a === '--liste') o.liste = wert();
    else if (a === '--quelle') o.quelle = wert();
    else if (a === '--stand-ignorieren') o.standIgnorieren = true;
    else if (a === '-h' || a === '--hilfe' || a === '--help') o.hilfe = true;
    else if (a.indexOf('--') === 0) throw new Error('Unbekannte Option ' + a);
    else o.positional.push(a);
  }
  return o;
}
function aenderungAus(text, o) {
  const i = text.indexOf('=');
  if (i <= 0 || i === text.length - 1) throw new Error('"' + text + '" ist keine Änderung (erwartet <name>=<wert>)');
  const name = text.slice(0, i), wert = text.slice(i + 1);
  let m, ae;
  if ((m = /^achse:(.+)$/.exec(name))) ae = { achse: m[1], wert };
  else if ((m = /^wandtyp:(.+)$/.exec(name))) ae = { wandtyp: m[1], wert };
  else if ((m = /^wandende:(.+)$/.exec(name))) return { wandende: m[1], wert };
  else if ((m = /^oeffnung:(.+\.oeff\d+)\.([a-z]+)$/.exec(name))) ae = { oeffnung: m[1], feld: m[2], wert };
  else if (/^oeffnung:/.test(name)) throw new Error('"' + name + '": erwartet oeffnung:<wand>.oeff<k>.<feld>');
  else {
    ae = { mass: name, wert };
    if (o.bewegt) ae.bewegt = o.bewegt;
    if (o.einzeln) ae.einzeln = true;
  }
  if (o.quelle) ae.quelle = o.quelle;
  return ae;
}

let o;
try { o = aufruf(process.argv.slice(2)); } catch (e) { console.error(e.message + '\n' + hilfe()); process.exit(2); }
if (o.hilfe || (!o.positional.length && !o.liste)) { (o.hilfe ? console.log : console.error)(hilfe()); process.exit(o.hilfe ? 0 : 2); }
if (o.liste && o.positional.length) { console.error('Entweder --liste oder einzelne Änderungen angeben, nicht beides.\n' + hilfe()); process.exit(2); }

let text, haus, aenderungen;
try { text = fs.readFileSync(o.datei, 'utf8'); haus = JSON.parse(text); } catch (e) { console.error('haus.json nicht lesbar (' + o.datei + '): ' + e.message); process.exit(1); }
try {
  if (o.liste) aenderungen = A.listeLesen(fs.readFileSync(o.liste, 'utf8'), haus, { standIgnorieren: o.standIgnorieren });
  else aenderungen = o.positional.map(t => aenderungAus(t, o));
} catch (e) {
  const usage = !o.liste;
  console.error((o.liste ? 'Änderungsliste abgelehnt: ' : '') + e.message);
  process.exit(usage && !/Einheit|nicht lesbar/.test(e.message) ? 2 : 1);
}

const res = A.aendern(haus, aenderungen, o.optionen);
console.log(A.auswirkungenText(res));
if (o.vergleich && res.vorschauHaus) {
  fs.mkdirSync(o.vergleich, { recursive: true });
  ['EG', 'DG'].forEach(g => {
    if (!res.ableitung.nachher.abl.geschosse[g]) return;
    const f = path.join(o.vergleich, 'vergleich-' + g.toLowerCase() + '.svg');
    fs.writeFileSync(f, A.vergleichSvg(res, g) + '\n');
    console.log('Vergleich geschrieben: ' + f);
  });
}
if (!res.ok) { console.error('Abgebrochen, haus.json bleibt unverändert.'); process.exit(1); }
if (o.trockenlauf) { console.log('Trockenlauf: haus.json bleibt unverändert (' + res.kanten.length + ' Stelle(n) würden geändert).'); process.exit(0); }
if (!res.kanten.length) { console.log('Nichts zu schreiben.'); process.exit(0); }

let neu;
try {
  neu = A.textPatchen(text, res.kanten);
  assert.deepStrictEqual(JSON.parse(neu), res.haus); // die gepatchte Datei muss genau das berechnete Haus ergeben
} catch (e) {
  console.error('Interner Fehler beim Schreiben, haus.json bleibt unverändert: ' + e.message);
  process.exit(1);
}
fs.writeFileSync(o.datei, neu);
console.log('haus.json geändert: ' + res.kanten.length + ' Stelle(n). Danach: npm test, npm run build, Screenshot prüfen, committen.');
