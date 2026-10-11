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
  check(Array.isArray(r.stempel) && r.stempel.length === 2 && r.stempel.every(v => typeof v === 'number' || typeof v === 'string'), r.id + ': Stempel (Punkt in der Raumfläche) fehlt');
  check(!('polygon' in r), r.id + ': Räume haben keine Polygone mehr, sie werden aus den Wänden abgeleitet (src/raeume.js)');
});
(haus.trennlinien || []).forEach(t => {
  check(['EG', 'DG'].indexOf(t.geschoss) >= 0, t.id + ': Geschoss ' + t.geschoss);
  try { check(W.mm(t.von[0]) === W.mm(t.bis[0]) || W.mm(t.von[1]) === W.mm(t.bis[1]), t.id + ': Trennlinie nicht achsparallel'); } catch (e) { fails.push(t.id + ': ' + e.message); }
});

/* ---------- Modell folgt den Daten ---------- */
const flaeche = (m, id) => m.rooms.filter(r => r.id === id)[0].area;
const m0 = buildModel(THREE, haus);
{ // HAR 10 cm tiefer: lichte Breite 3,010 m (Kette 4,745 → 7,755), Tiefe 2,95 + 0,10 = 3,05 m (Plan: HAR 2,95 tief).
  // Nur die Nachbarn an der HAR-Südwand geben nach: der Vorraum Eltern (1,69 m breit, Kette 4,57 → 6,26) und der Flur (1,495 m breit,
  // 6,435 → 7,93) verlieren 0,10 m Tiefe. Die 45°-Schrägwand zwischen Flur und Julians Zimmer bleibt stehen (die früheren Raumpolygone ließen ihre
  // Schrägkante mitwandern und rechneten ein Dreieck mit 0,875 m Kathete mit).
  // Die Wand Eltern / Bad liegt zwar bündig, gehört aber zu einer eigenen Kette und bleibt stehen.
  const d = klon(haus); d.achsen['z.harSi'].plus = 3050;
  const m = buildModel(THREE, d);
  const soll = 3.010 * 3.050;
  check(Math.abs(flaeche(m, 'har') - soll) < 1e-6, 'HAR bei 3,05 m Tiefe: ' + flaeche(m, 'har').toFixed(4) + ' m² statt ' + soll.toFixed(4));
  check(Math.abs(flaeche(m, 'eltern') - (flaeche(m0, 'eltern') - 1.690 * 0.10)) < 1e-6, 'Eltern gibt nicht um Breite 1,69 × 0,10 m² nach: ' + flaeche(m, 'eltern').toFixed(4));
  const flurVerlust = 1.495 * 0.10;
  check(Math.abs(flaeche(m, 'flur') - (flaeche(m0, 'flur') - flurVerlust)) < 1e-4, 'Flur verliert nicht ' + flurVerlust.toFixed(5) + ' m²: ' + (flaeche(m0, 'flur') - flaeche(m, 'flur')).toFixed(5));
  ['bad', 'ankleide', 'wohnen', 'kind2', 'kind1'].forEach(id => check(Math.abs(flaeche(m, id) - flaeche(m0, id)) < 1e-9, id + ' ändert sich, obwohl nur die HAR-Tiefe geändert wurde'));
  check(m.befunde.filter(b => b.stufe === 'fehler').length === 0, 'HAR tiefer: Fehler ' + m.befunde.filter(b => b.stufe === 'fehler').map(b => b.text).join(' | '));
}
{ // Außenmaß breiter (nur zur Prüfung der Verkettung, nicht als gewollte Änderung): Grundfläche +1,0 m × Haustiefe, Ostwand wandert mit
  const d = klon(haus); d.aussenmasse['x.O'].wert += 1000;
  const m = buildModel(THREE, d);
  const diff = m.info.footArea - m0.info.footArea;
  check(Math.abs(diff - 14.655) < 1e-6, 'Grundfläche wächst um ' + diff.toFixed(4) + ' m² statt 14,655');
  const b0 = new THREE.Box3().setFromObject(m0.groups.inner), b1 = new THREE.Box3().setFromObject(m.groups.inner);
  check(Math.abs(b1.max.x - b0.max.x - 1.0) < 1e-6, 'Innenwände folgen der Ostwand nicht (Verschiebung ' + (b1.max.x - b0.max.x).toFixed(4) + ' m)');
}
{ // Wanddicke 12,5 → 13,5 cm (Wandtyp IW125 = Westwand des D-Bads, Außenseite fest bei hx 10,44): die Wand wächst nach Osten, das D-Bad (Innenmaß 2,00 m) gibt
  // 1 cm nach und wird um 0,01 m × 1,885 m² kleiner. Julians Zimmer liegt westlich der Wand und bleibt, ebenso alle anderen Räume.
  const d = klon(haus); d.wandtypen.IW125.dicke = 135;
  const m = buildModel(THREE, d);
  const soll = flaeche(m0, 'dbad') - 0.01 * 1.885;
  check(Math.abs(flaeche(m, 'dbad') - soll) < 1e-6, 'D-Bad bei dickerer Wand: ' + flaeche(m, 'dbad').toFixed(4) + ' m² statt ' + soll.toFixed(4));
  m0.rooms.filter(r => r.id !== 'dbad').forEach(r => check(Math.abs(flaeche(m, r.id) - r.area) < 1e-9, r.id + ' ändert sich, obwohl nur die Dicke von IW125 geändert wurde'));
  check(m.rooms.length === m0.rooms.length, 'Wanddicke ändert die Anzahl der Räume');
}
{ // Nachbar gibt nach: Wand Speisekammer / Küche 45 mm nach Süden. Speisekammer wird um 45 mm × Breite größer, die Küche um dasselbe kleiner.
  const d = klon(haus); d.achsen['z.speisS'].wert += 45;
  const m = buildModel(THREE, d), breite = (W.mm('x.Oi') - W.mm('x.naehW')) / 1000, dm = 0.045 * breite;
  check(Math.abs(flaeche(m, 'speis') - (flaeche(m0, 'speis') + dm)) < 1e-6, 'Speisekammer wächst nicht um ' + dm.toFixed(4) + ' m²: ' + flaeche(m, 'speis').toFixed(4));
  const kb = (W.mm('x.Oi') - W.mm('x.wohnO')) / 1000;
  check(Math.abs(flaeche(m, 'kueche') - (flaeche(m0, 'kueche') - 0.045 * kb)) < 1e-6, 'Küche schrumpft nicht um ' + (0.045 * kb).toFixed(4) + ' m²: ' + flaeche(m, 'kueche').toFixed(4));
  check(m.befunde.filter(b => b.stufe === 'fehler').length === 0, 'Speisekammer-Wand verschoben: Fehler ' + m.befunde.filter(b => b.stufe === 'fehler').map(b => b.text).join(' | '));
}
{ // Gegenbeispiel aus dem Plan (5.2): Westwand des D-Bads nach Süden bis zur Wand des Nähzimmers verlängert. Sie läuft durch die Südwand von Julians Zimmer
  // und trennt den Eingangsbereich der Haustür vom Flur ab: Wand schneidet Wand, Teilfläche ohne Raum (ca. 3,9 m²).
  const d = klon(haus); d.waende.filter(w => w.id === 'eg.dbad-west')[0].bis = ['x.dbW', 'z.flurS'];
  const m = buildModel(THREE, d);
  const schnitt = m.befunde.filter(b => b.regel === 2 && b.stufe === 'fehler' && b.elemente.indexOf('eg.dbad-west') >= 0 && b.elemente.indexOf('eg.julian-dbad-sued') >= 0);
  check(schnitt.length === 1, 'D-Bad-Westwand verlängert: Wand schneidet Wand nicht gemeldet');
  const rest = m.befunde.filter(b => b.regel === 1 && b.stufe === 'fehler' && /Unbenannte Teilfläche/.test(b.text) && /3,9\d m²|3,8\d m²/.test(b.text));
  check(rest.length === 1, 'D-Bad-Westwand verlängert: abgetrennter Eingangsbereich (3,8–3,9 m²) nicht als Teilfläche ohne Raum gemeldet: ' + m.befunde.map(b => b.regel + ':' + b.text).join(' | '));
  check(m0.befunde.filter(b => b.stufe === 'fehler').length === 0, 'Ausgangszustand hat Fehler');
}
wirft(() => buildModel(THREE), /Daten|haus/i, 'buildModel ohne Daten');

if (fails.length) { console.log('FEHLER:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('Datenprüfung: alle Prüfungen bestanden (' + haus.waende.length + ' Wände, ' + haus.raeume.length + ' Räume, ' +
  Object.keys(haus.aussenmasse).length + ' Außenmaße, ' + Object.keys(haus.achsen).length + ' Achsen)');
