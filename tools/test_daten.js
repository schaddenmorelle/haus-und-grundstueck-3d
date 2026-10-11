/* Test der Datenquelle src/data/haus.json und der Auflösung in src/werte.js (ohne Three.js).
   Aufruf: node tools/test_daten.js   (läuft auch über npm test)
   Geprüft wird über die öffentliche Schnittstelle: werteAufloesen(haus) und buildModel(THREE, haus). */
const path = require('path');
const THREE = require('three');
const { werteAufloesen } = require('../src/werte.js');
const { buildModel } = require('../src/model.js');
const haus = require('../src/data/haus.json');
const gesperrt = require('./gesperrt.json');

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
function wirft(fn, muster, msg) {
  try { fn(); fails.push(msg + ' (kein Fehler geworfen)'); } catch (e) { if (!muster.test(e.message)) fails.push(msg + ' (falsche Meldung: ' + e.message + ')'); }
}
const klon = o => JSON.parse(JSON.stringify(o));

/* ---------- Auflösung von Achsen und Wandtypen (kleine, erfundene Daten) ---------- */
{
  const d = {
    wandtypen: { AW: { dicke: 385 }, TB: { dicke: 125 } },
    aussenmasse: { 'x.W': { wert: 0 }, 'x.O': { wert: 12950 } },
    achsen: {
      'x.Oi': { ref: 'x.O', minus: 'AW' },
      'x.mitte': { ref: 'x.W', plus: 'TB/2' },
      'x.kette': { ref: 'x.Oi', plus: 100, minus: 'TB' }
    }
  };
  const w = werteAufloesen(d);
  check(w.mm('x.Oi') === 12565, 'Innenseite Ostwand: ' + w.mm('x.Oi') + ' statt 12565 (Außenmaß minus Wanddicke)');
  check(w.mm('x.mitte') === 62.5, 'halbe Wanddicke: ' + w.mm('x.mitte') + ' statt 62,5');
  check(w.mm('x.kette') === 12540, 'plus und minus zusammen: ' + w.mm('x.kette') + ' statt 12540');
  check(w.m('x.Oi') === 12.565, 'Meter: ' + w.m('x.Oi'));
  check(w.m(1500) === 1.5 && w.mm('x.O') === 12950, 'Zahlen sind Millimeter, Achsennamen werden aufgelöst');
  check(w.mm({ ref: 'x.O', minus: 3000 }) === 9950, 'Ausdruck { ref, minus } direkt');
  check(w.dicke('AW') === 385, 'Wanddicke AW');
  wirft(() => werteAufloesen(d).mm('x.gibtsnicht'), /unbekannt/, 'unbekannte Achse');
  wirft(() => werteAufloesen({ wandtypen: {}, aussenmasse: {}, achsen: { a: { ref: 'a', plus: 1 } } }).mm('a'), /Zyklus/, 'Zyklus a → a');
  wirft(() => werteAufloesen({ wandtypen: {}, aussenmasse: {}, achsen: { a: { ref: 'b' }, b: { ref: 'c' }, c: { ref: 'a' } } }).mm('a'), /Zyklus/, 'Zyklus a → b → c → a');
  wirft(() => werteAufloesen({ wandtypen: {}, aussenmasse: { a: { wert: 1 } }, achsen: { a: { wert: 2 } } }), /doppelt/, 'Achse in aussenmasse und achsen');
  wirft(() => werteAufloesen({ wandtypen: {}, aussenmasse: {}, achsen: { a: { ref: 'x', plus: 'XX' } , x: { wert: 0 } } }).mm('a'), /Wandtyp/, 'unbekannter Wandtyp in plus');
}

/* ---------- haus.json: Aufbau ---------- */
const W = werteAufloesen(haus);
Object.keys(Object.assign({}, haus.aussenmasse, haus.achsen)).forEach(n => {
  try { if (!isFinite(W.mm(n))) fails.push('Achse ' + n + ' ist nicht endlich'); } catch (e) { fails.push('Achse ' + n + ': ' + e.message); }
});

Object.keys(gesperrt.aussenmasse_mm).forEach(n => {
  check(W.mm(n) === gesperrt.aussenmasse_mm[n], 'gesperrtes Außenmaß ' + n + ' ist ' + W.mm(n) + ' statt ' + gesperrt.aussenmasse_mm[n]);
  check(haus.aussenmasse[n] && haus.aussenmasse[n].fest === true, 'Außenmaß ' + n + ' steht nicht in der Gruppe aussenmasse mit fest: true');
});
check(haus.dach.neigung === gesperrt.dach.neigung_grad, 'Dachneigung ' + haus.dach.neigung + '° statt ' + gesperrt.dach.neigung_grad + '°');
check(haus.dach.fest === true, 'Dachneigung ist nicht als fest gekennzeichnet');
check(Object.keys(haus.achsen).every(n => !(n in haus.aussenmasse)), 'Achse sowohl in aussenmasse als auch in achsen');

Object.keys(haus.wandtypen).forEach(n => {
  const t = haus.wandtypen[n];
  if (t.schichten) check(t.schichten.reduce((s, x) => s + x[1], 0) === t.dicke, 'Wandtyp ' + n + ': Schichten ergeben nicht die Dicke ' + t.dicke);
});
check(haus.geschosse.DG.okff - haus.geschosse.EG.okff === 2971, 'Geschosshöhe EG–DG ' + (haus.geschosse.DG.okff - haus.geschosse.EG.okff) + ' statt 2971 (Treppenplanung)');

/* Wände: Typ vorhanden, Länge > 0, Öffnungen liegen in der Wand und überlappen sich nicht */
const wandIds = new Set();
haus.waende.forEach(w => {
  check(!wandIds.has(w.id), 'Wand-ID doppelt: ' + w.id); wandIds.add(w.id);
  check(!!haus.wandtypen[w.typ], w.id + ': Wandtyp ' + w.typ + ' fehlt');
  check(['oben', 'unten', 'links', 'rechts', 'mitte'].indexOf(w.flucht) >= 0, w.id + ': Flucht ' + w.flucht);
  let a, b;
  try { a = [W.mm(w.von[0]), W.mm(w.von[1])]; b = [W.mm(w.bis[0]), W.mm(w.bis[1])]; } catch (e) { fails.push(w.id + ': ' + e.message); return; }
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  check(L > 0, w.id + ': Länge 0');
  const dir = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? Math.sign(b[0] - a[0]) : Math.sign(b[1] - a[1]);
  const start = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? a[0] : a[1];
  const iv = (w.oeffnungen || []).map(o => {
    const ab = typeof o.ab === 'number' ? o.ab : (W.mm(o.ab) - start) * dir;
    return [ab, ab + o.breite, o];
  }).sort((p, q) => p[0] - q[0]);
  iv.forEach((v, i) => {
    check(v[0] >= 0 && v[1] <= L + 1e-9, w.id + ': Öffnung ' + v[2].art + ' bei ' + v[0] + '–' + v[1] + ' liegt nicht in der Wand (Länge ' + L + ')');
    if (i) check(v[0] >= iv[i - 1][1], w.id + ': Öffnungen überlappen sich');
  });
});

const raumIds = new Set();
haus.raeume.forEach(r => {
  check(!raumIds.has(r.id), 'Raum-ID doppelt: ' + r.id); raumIds.add(r.id);
  check(r.polygon.length >= 3, r.id + ': weniger als drei Eckpunkte');
  let s = 0; const p = r.polygon.map(q => [W.mm(q[0]), W.mm(q[1])]);
  p.forEach((q, i) => { const n = p[(i + 1) % p.length]; s += q[0] * n[1] - n[0] * q[1]; });
  check(Math.abs(s) / 2 > 0, r.id + ': Fläche 0');
});

/* ---------- Modell folgt den Daten ---------- */
const flaeche = (m, id) => m.rooms.filter(r => r.id === id)[0].area;
const m0 = buildModel(THREE, haus);
{ // HAR 10 cm tiefer: lichte Breite 3,010 m (Kette 4,745 → 7,755), Tiefe 2,95 + 0,10 = 3,05 m (Plan: HAR 2,95 tief).
  // Nur die Nachbarn an der HAR-Südwand geben nach: der Vorraum Eltern (1,69 m breit, Kette 4,57 → 6,26) und der Flur (1,495 m breit,
  // 6,435 → 7,93, dazu das Dreieck an der 45°-Schrägwand mit 0,875 m Kathete) verlieren 0,10 m Tiefe. Die Wand Eltern / Bad liegt zwar bündig, gehört aber zu einer eigenen Kette und bleibt stehen.
  const d = klon(haus); d.achsen['z.harSi'].plus = 3050;
  const m = buildModel(THREE, d);
  const soll = 3.010 * 3.050;
  check(Math.abs(flaeche(m, 'har') - soll) < 1e-6, 'HAR bei 3,05 m Tiefe: ' + flaeche(m, 'har').toFixed(4) + ' m² statt ' + soll.toFixed(4));
  check(Math.abs(flaeche(m, 'eltern') - (flaeche(m0, 'eltern') - 1.690 * 0.10)) < 1e-6, 'Eltern gibt nicht um Breite 1,69 × 0,10 m² nach: ' + flaeche(m, 'eltern').toFixed(4));
  const flurVerlust = 1.495 * 0.10 + 0.5 * 0.875 * 0.10;
  check(Math.abs(flaeche(m, 'flur') - (flaeche(m0, 'flur') - flurVerlust)) < 1e-6, 'Flur verliert nicht ' + flurVerlust.toFixed(5) + ' m²: ' + flaeche(m, 'flur').toFixed(4));
  ['bad', 'ankleide', 'wohnen', 'kind2', 'kind1'].forEach(id => check(Math.abs(flaeche(m, id) - flaeche(m0, id)) < 1e-9, id + ' ändert sich, obwohl nur die HAR-Tiefe geändert wurde'));
}
{ // Außenmaß breiter (nur zur Prüfung der Verkettung, nicht als gewollte Änderung): Grundfläche +1,0 m × Haustiefe, Ostwand wandert mit
  const d = klon(haus); d.aussenmasse['x.O'].wert += 1000;
  const m = buildModel(THREE, d);
  const diff = m.info.footArea - m0.info.footArea;
  check(Math.abs(diff - 14.655) < 1e-6, 'Grundfläche wächst um ' + diff.toFixed(4) + ' m² statt 14,655');
  const b0 = new THREE.Box3().setFromObject(m0.groups.inner), b1 = new THREE.Box3().setFromObject(m.groups.inner);
  check(Math.abs(b1.max.x - b0.max.x - 1.0) < 1e-6, 'Innenwände folgen der Ostwand nicht (Verschiebung ' + (b1.max.x - b0.max.x).toFixed(4) + ' m)');
}
{ // Wanddicke 11,5 → 13,5 cm: Die Wand Ankleide / Wohnen liegt mit der Nordfläche auf der Innenseite der Südwand des Bads (hz 6,395)
  // und wächst nach Süden. Wohnen (5,12 m breit, Kette 3,885 → 9,005) gibt nach und wird um 5,12 × 0,02 m² kleiner.
  const d = klon(haus); d.wandtypen.IW115.dicke = 135;
  const m = buildModel(THREE, d);
  const soll = flaeche(m0, 'wohnen') - 5.12 * 0.02;
  check(Math.abs(flaeche(m, 'wohnen') - soll) < 1e-6, 'Wohnen bei dickerer Wand: ' + flaeche(m, 'wohnen').toFixed(4) + ' m² statt ' + soll.toFixed(4));
  check(m.rooms.length === m0.rooms.length, 'Wanddicke ändert die Anzahl der Räume');
}
wirft(() => buildModel(THREE), /Daten|haus/i, 'buildModel ohne Daten');

if (fails.length) { console.log('FEHLER:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('Datenprüfung: alle Prüfungen bestanden (' + haus.waende.length + ' Wände, ' + haus.raeume.length + ' Räume, ' +
  Object.keys(haus.aussenmasse).length + ' Außenmaße, ' + Object.keys(haus.achsen).length + ' Achsen)');
