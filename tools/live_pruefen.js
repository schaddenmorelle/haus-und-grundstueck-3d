/* Veröffentlichungsstand: vergleicht die Live-Seite des Artifacts mit dem zuletzt veröffentlichten Build (dist/veroeffentlicht.json).
   Aufruf:
     node tools/live_pruefen.js pruefen <gespeicherte-live-datei>   0 = gleich (nichts Fremdes, veröffentlichen), 1 = abweichend (fragen), 2 = kein Stand
     node tools/live_pruefen.js setzen <datei> [commit]             schreibt den Stand fort (nach dem Veröffentlichen mit dist/haus-und-grundstueck-3d.html)
   Der Dienst legt eine Hülle um die Seite (<!doctype…><body>\n … </body></html>); sie wird vor dem Hash entfernt. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync } = require('child_process');
const STAND = process.env.VEROEFFENTLICHT || path.join(__dirname, '..', 'dist', 'veroeffentlicht.json');
function normal(t) {
  const m = /<body>\n/.exec(t);
  if (m && /^<!doctype/i.test(t)) t = t.slice(m.index + m[0].length).replace(/<\/body><\/html>\s*$/, '');
  return t.trim();
}
const hash = f => crypto.createHash('sha256').update(normal(fs.readFileSync(f, 'utf8'))).digest('hex');
const [modus, datei, commit] = process.argv.slice(2);
if (modus === 'pruefen' && datei) {
  if (!fs.existsSync(STAND)) { console.log('Kein Veröffentlichungsstand (' + STAND + '): erst mit „setzen“ anlegen, nachdem die Live-Seite von Hand geprüft wurde.'); process.exit(2); }
  const s = JSON.parse(fs.readFileSync(STAND, 'utf8')), h = hash(datei);
  if (h === s.hash) { console.log('Live-Seite gleich dem Stand vom ' + s.datum + ' (Commit ' + s.commit + '): nichts Fremdes, veröffentlichen.'); process.exit(0); }
  console.log('Live-Seite weicht vom Stand ab (' + h.slice(0, 12) + ' statt ' + s.hash.slice(0, 12) + '): nicht veröffentlichen, den Nutzer fragen.'); process.exit(1);
} else if (modus === 'setzen' && datei) {
  let c = commit;
  if (!c) { try { c = execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim(); } catch (e) { c = 'unbekannt'; } }
  fs.writeFileSync(STAND, JSON.stringify({ hash: hash(datei), commit: c, datum: new Date().toISOString().slice(0, 10), hinweis: 'SHA-256 der zuletzt veröffentlichten Seite ohne die Hülle des Dienstes; schreibt tools/live_pruefen.js fort' }, null, 1) + '\n');
  console.log('Stand geschrieben: ' + path.relative(process.cwd(), STAND) + ' (Commit ' + c + ')');
} else { console.log('Aufruf: node tools/live_pruefen.js pruefen|setzen <datei> [commit]'); process.exit(64); }
