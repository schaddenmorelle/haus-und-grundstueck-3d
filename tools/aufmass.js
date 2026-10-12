#!/usr/bin/env node
/* Aufmaß: zeigt die Prüfmaße gegen das Modell und trägt Messungen in src/data/pruefmasse.json ein (Plan Abschnitt 3.9 und 9, Phase 6).
   Der Kern steht in src/aufmass.js. Das Werkzeug ändert nur pruefmasse.json, nie das Modell (haus.json).

   Aufruf:  node tools/aufmass.js                                  Bericht: jedes Prüfmaß gegen das Modell
            node tools/aufmass.js [Optionen] <maß>=<wert> …        Messung eintragen, z. B. raum:speis.tiefe=125cm  (ohne Einheit: cm)
            node tools/aufmass.js [Optionen] --liste <datei.json>  Messliste aus der Seite („Aufmaß erfassen“, Exportieren) einspielen

   Namen der Maße zeigt die Seite beim Anklicken eines Maßes im Plan. Eine zweite Messung desselben Maßes ersetzt die erste (die alte steht in der
   Git-Historie). Werte unter 10 ohne Einheit werden abgelehnt (1,26 wäre 1,26 cm); dann 1,26m schreiben.

   Optionen:
     --datei <pfad>     andere Datei statt src/data/pruefmasse.json
     --datum JJJJ-MM-TT Datum der Messung (Standard: heute; bei --liste nur für Einträge ohne Datum)
     --notiz <text>     Notiz zur Messung
     --was <text>       Beschriftung (Standard: Raumname und Richtung, z. B. „Speisekammer, Tiefe“)
     --trockenlauf      nur anzeigen, nichts schreiben
   Ausgang: 0 in Ordnung, 1 abgelehnt, 2 falscher Aufruf.

   Weicht eine Messung auffällig vom Modell ab, ändert der Nutzer das Modell bewusst, z. B.
     node tools/aendern.js raum:speis.tiefe=1,30m --quelle aufmass
   (Der Wert ist der Rohbau-Wert, das Aufmaß misst fertige Oberflächen: bis etwa 4 cm kleiner.) */
const fs = require('fs'), path = require('path');
const A = require('../src/aendern.js');
const M = require('../src/aufmass.js');

function hilfe() {
  return 'Aufruf: node tools/aufmass.js [Optionen] [<maß>=<wert> …]   oder   --liste <datei.json>\n' +
    'Beispiel: node tools/aufmass.js raum:speis.tiefe=125cm\n' +
    'Optionen: --datei <pfad>  --datum JJJJ-MM-TT  --notiz <text>  --was <text>  --trockenlauf  --liste <datei>  (Kopf von tools/aufmass.js)';
}
function aufruf(args) {
  const o = { datei: path.join(__dirname, '..', 'src', 'data', 'pruefmasse.json'), positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i], wert = () => { if (i + 1 >= args.length) throw new Error('Zu ' + a + ' fehlt ein Wert'); return args[++i]; };
    if (a === '--datei') o.datei = wert();
    else if (a === '--datum') o.datum = wert();
    else if (a === '--notiz') o.notiz = wert();
    else if (a === '--was') o.was = wert();
    else if (a === '--liste') o.liste = wert();
    else if (a === '--trockenlauf') o.trockenlauf = true;
    else if (a === '-h' || a === '--hilfe' || a === '--help') o.hilfe = true;
    else if (a.indexOf('--') === 0) throw new Error('Unbekannte Option ' + a);
    else o.positional.push(a);
  }
  return o;
}
const heute = () => new Date().toISOString().slice(0, 10);

let o;
try { o = aufruf(process.argv.slice(2)); } catch (e) { console.error(e.message + '\n' + hilfe()); process.exit(2); }
if (o.hilfe) { console.log(hilfe()); process.exit(0); }
if (o.liste && o.positional.length) { console.error('Entweder --liste oder einzelne Messungen angeben, nicht beides.\n' + hilfe()); process.exit(2); }
if (o.positional.some(t => t.indexOf('=') <= 0 || t.indexOf('=') === t.length - 1)) { console.error('Eine Messung heißt <maß>=<wert>, z. B. raum:speis.tiefe=125cm.\n' + hilfe()); process.exit(2); }

let text, pm, haus;
try { text = fs.readFileSync(o.datei, 'utf8'); pm = JSON.parse(text); } catch (e) { console.error('pruefmasse.json nicht lesbar (' + o.datei + '): ' + e.message); process.exit(1); }
try { haus = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'haus.json'), 'utf8')); } catch (e) { console.error('haus.json nicht lesbar: ' + e.message); process.exit(1); }
const D = A.ableiten(haus);

if (!o.liste && !o.positional.length) { // Bericht
  const res = M.auswerten(D, pm);
  console.log(M.bericht(res, pm));
  console.log(res.gemessen + ' Prüfmaße, ' + res.auffaellig + ' auffällig, ' + res.unbekannt + ' nicht gefunden.');
  process.exit(0);
}

let messungen;
try {
  if (o.liste) messungen = M.listeLesen(fs.readFileSync(o.liste, 'utf8'), D).map(e => (o.datum && !e.datum ? Object.assign({}, e, { datum: o.datum }) : e));
  else messungen = o.positional.map(t => {
    const i = t.indexOf('='), name = t.slice(0, i), e = { mass: name, cm: M.cmParsen(t.slice(i + 1)), was: o.was || M.beschreibung(D, name), datum: o.datum || heute() };
    if (o.notiz) e.notiz = o.notiz;
    M.eintragPruefen(e, D);
    return e;
  });
} catch (e) { console.error((o.liste ? 'Messliste abgelehnt: ' : '') + e.message); process.exit(1); }

let r;
try { r = M.eintragen(text, messungen); } catch (e) { console.error(e.message); process.exit(1); }
const pm2 = JSON.parse(r.text), res = M.auswerten(D, Object.assign({}, pm2, { masse: messungen }));
console.log(M.bericht(res, pm2));
r.ersetzt.forEach(e => console.log('Ersetzt: ' + e.mass + ' war ' + e.cm + ' cm' + (e.datum ? ' (' + e.datum + ')' : '')));
res.zeilen.filter(z => z.status === 'auffaellig').forEach(z => console.log('Auffällig: ' + z.mass + ' – das Modell bleibt unverändert; zum Anpassen z. B. node tools/aendern.js ' + z.mass + '=<Rohbauwert> --quelle aufmass'));
if (o.trockenlauf) { console.log('Trockenlauf: pruefmasse.json bleibt unverändert (' + r.neu.length + ' neu, ' + r.ersetzt.length + ' ersetzt).'); process.exit(0); }
fs.writeFileSync(o.datei, r.text);
console.log('pruefmasse.json geändert: ' + r.neu.length + ' neu, ' + r.ersetzt.length + ' ersetzt. Danach: npm test, npm run build, committen.');
