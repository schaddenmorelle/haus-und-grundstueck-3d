/* Test von tools/live_pruefen.js: Hülle des Dienstes entfernen, Hash bilden, mit dist/veroeffentlicht.json vergleichen. Ohne Netz. */
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const S = path.join(__dirname, 'live_pruefen.js'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-'));
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const seite = '<title>Test</title>\n<div>Seite</div>\n<script>var a = 1;</script>\n';
const huelle = '<!doctype html><html><head><meta charset=utf8></head><body>\n' + seite + '\n</body></html>';
const w = (n, t) => { const p = path.join(dir, n); fs.writeFileSync(p, t); return p; };
const lauf = (...a) => spawnSync('node', [S, ...a], { encoding: 'utf8', env: Object.assign({}, process.env, { VEROEFFENTLICHT: path.join(dir, 'stand.json') }) });
const roh = w('roh.html', seite), mit = w('mit.html', huelle), anders = w('anders.html', huelle.replace('Seite', 'Fremd'));
check(lauf('pruefen', mit).status === 2, 'ohne Eintrag muss pruefen mit Code 2 enden (Stand unbekannt)');
check(lauf('setzen', roh, 'abc1234').status === 0, 'setzen schlägt fehl');
check(JSON.parse(fs.readFileSync(path.join(dir, 'stand.json'), 'utf8')).commit === 'abc1234', 'Commit nicht im Eintrag');
const gleich = lauf('pruefen', mit);
check(gleich.status === 0 && /gleich/i.test(gleich.stdout), 'Hülle des Dienstes darf den Vergleich nicht stören: ' + gleich.stdout + gleich.stderr);
const ungleich = lauf('pruefen', anders);
check(ungleich.status === 1 && /weicht .* ab/i.test(ungleich.stdout), 'geänderte Live-Seite muss Code 1 ergeben: ' + ungleich.stdout);
if (fails.length) { console.log('FEHLER:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('live_pruefen: alle Prüfungen bestanden');
