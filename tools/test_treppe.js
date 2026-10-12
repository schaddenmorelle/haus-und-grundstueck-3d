/* Test der Treppe (src/treppe.js, Plan Abschnitt 3.8 und 5.1 Regel 11, Phase 5), ohne Three.js.
   Aufruf: node tools/test_treppe.js   (läuft auch über npm test)
   Sollwerte stammen aus der Treppenplanung und den Angaben des Nutzers (AGENTS.md: 15 Steigungen, Geschosshöhe 2,971 m, Auftritt 25 cm,
   Wendelung Stufe 1–6 an der Ostwand, Treppenöffnung hx 9,2–12,54 / hz 8,655–9,645), nicht aus dem Modell. Geprüft wird über die öffentliche Schnittstelle:
     treppeAbleiten(haus, WV)                     Stufen mit Grundriss und Höhe, Lauflinie, Höhe unter einem Punkt
     treppeKopfhoehe(haus, WV, T, dach)           lichte Höhe über der Lauflinie (Decke, Treppenöffnung, Dachschräge)
     pruefen(…)                                   Regel 11 meldet zu geringe Kopfhöhe */
const { werteAufloesen } = require('../src/werte.js');
const { raeumeAbleiten } = require('../src/raeume.js');
const { dachAbleiten } = require('../src/dach.js');
const { pruefen } = require('../src/pruefen.js');
const { treppeAbleiten, treppeKopfhoehe } = require('../src/treppe.js');
const haus = require('../src/data/haus.json');

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
const klon = o => JSON.parse(JSON.stringify(o));
const nahe = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.01 : tol);
function alles(h) {
  const WV = werteAufloesen(h), abl = raeumeAbleiten(h, WV), dach = dachAbleiten(h, WV);
  return { h, WV, abl, dach, T: treppeAbleiten(h, WV), befunde: pruefen(h, WV, abl, dach) };
}
const A = alles(haus);
const bb = ring => { const x = ring.map(p => p[0]), z = ring.map(p => p[1]); return [Math.min(...x), Math.min(...z), Math.max(...x), Math.max(...z)]; };

/* ---------- Stufen und Höhen: 15 Steigungen à 2971 / 15 = 198,07 mm (Treppenplanung: 19,81 cm) ---------- */
{
  const T = A.T;
  check(T.stufen.length === 14, 'Anzahl Stufen mit Grundriss: ' + T.stufen.length + ' statt 14 (die 15. Steigung führt auf den DG-Boden)');
  check(nahe(T.steigung, 2971 / 15, 1e-9), 'Steigung ' + T.steigung + ' statt 2971 / 15 = 198,07 mm');
  T.stufen.forEach(s => check(nahe(s.hoehe, s.n * 2971 / 15, 1e-6), 'Stufe ' + s.n + ': Trittfläche bei ' + s.hoehe + ' statt ' + s.n * 2971 / 15));
  check(nahe(T.stufen[13].hoehe + T.steigung, 2971, 1e-6), 'Die Steigung nach Stufe 14 führt nicht genau auf den DG-Boden 2971 mm');
  check(T.stufen.slice(0, 6).every(s => s.art === 'wendel') && T.stufen.slice(6).every(s => s.art === 'gerade'), 'Stufen 1–6 sind gewendelt, 7–14 gerade (Treppenplanung)');
  check(nahe(T.dicke, 44, 1e-9), 'Stufendicke ' + T.dicke + ' statt 44 mm');
  check(nahe(T.auftritt, 250, 1e-9), 'Auftritt ' + T.auftritt + ' statt 250 mm');
}

/* ---------- Lage: gerader Lauf von der Innenseite der Ostwand (hx 12,565) nach Westen bis zur Treppenöffnung (hx 9,20) ---------- */
{
  const T = A.T, s7 = T.stufen[6], s14 = T.stufen[13];
  const b7 = bb(s7.polygon), b14 = bb(s14.polygon);
  check(nahe(b7[3], 9645, 1e-6) && nahe(b7[1], 9645 - 900, 1e-6), 'Stufe 7: Lauf zwischen hz ' + b7[1] + ' und ' + b7[3] + ' statt 8745 und 9645 (0,90 m Laufbreite an der Wand Nähzimmer / Speisekammer)');
  check(nahe(b7[0], 12565 - 1357 - 251, 1e-6) && nahe(b7[2], 12565 - 1357, 1e-6), 'Stufe 7: hx ' + b7[0] + ' bis ' + b7[2] + ' statt 10957 bis 11208');
  check(nahe(b14[0], 9200, 1e-6), 'Stufe 14 reicht bis hx ' + b14[0] + ' statt 9200 (Westende der Treppenöffnung)');
  check(nahe(bb(T.stufen[0].polygon)[2], 12565, 1e-6), 'Stufe 1 beginnt nicht an der Innenseite der Ostwand (hx 12,565)');
  // die Stufen überschneiden sich nicht (Flächensumme = Fläche der Vereinigung = Umriss)
  const flaeche = r => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  const summe = T.stufen.reduce((a, s) => a + flaeche(s.polygon), 0);
  check(nahe(summe, flaeche(T.umriss), 1), 'Flächensumme der Stufen ' + summe + ' ≠ Fläche des Umrisses ' + flaeche(T.umriss) + ' (Stufen überlappen oder lassen Lücken)');
}

/* ---------- Höhe unter einem Punkt ---------- */
{
  const T = A.T;
  check(T.hoeheBei(11000, 9000) !== null && nahe(T.hoeheBei(11000, 9000), 7 * 2971 / 15, 1e-6), 'Höhe bei hx 11,00 / hz 9,00 (Stufe 7): ' + T.hoeheBei(11000, 9000));
  check(nahe(T.hoeheBei(9300, 9000), 14 * 2971 / 15, 1e-6), 'Höhe bei hx 9,30 (Stufe 14): ' + T.hoeheBei(9300, 9000));
  check(T.hoeheBei(8000, 9000) === null, 'Westlich der Treppe gibt es keine Stufe');
  check(T.hoeheBei(11000, 8000) === null, 'Nördlich der Treppe (Nähzimmer) gibt es keine Stufe');
}

/* ---------- Kopfhöhe über der Lauflinie: mindestens 2,00 m ---------- */
{
  const K = treppeKopfhoehe(A.h, A.WV, A.T, A.dach);
  check(K.min >= 2000, 'Kopfhöhe an der Lauflinie nur ' + K.min + ' mm (Soll mindestens 2000) bei Stufe ' + K.stufe);
  check(K.stellen.length > 20, 'Zu wenige Stellen entlang der Lauflinie geprüft: ' + K.stellen.length);
  // unter der Decke (nicht in der Treppenöffnung) ist die Kopfhöhe lichte Höhe 2525 minus Höhe der Trittfläche: Stufe 1 (198 mm) → 2327
  const s1 = K.stellen.filter(p => p.stufe === 1)[0];
  check(s1 && nahe(s1.hoehe, 2525 - 2971 / 15, 0.01) && s1.art === 'decke', 'Kopfhöhe über Stufe 1: ' + (s1 && s1.hoehe) + ' (' + (s1 && s1.art) + ') statt ' + (2525 - 2971 / 15) + ' (Decke)');
  check(A.befunde.filter(b => b.regel === 11).length === 0, 'Regel 11 meldet bei den echten Daten: ' + A.befunde.filter(b => b.regel === 11).map(b => b.text));
}

/* ---------- Gegenfall: Treppenöffnung zu kurz (bis hx 11,00): die Lauflinie läuft über Stufe 7 (Trittfläche 1386 mm) unter die Decke ---------- */
{
  const h = klon(haus);
  h.dg.treppenoeffnung = [[9200, 8655], [11000, 8655], [11000, 9645], [9200, 9645]];
  const B = alles(h);
  const kopf = B.befunde.filter(b => b.regel === 11 && /Kopfhöhe/.test(b.text));
  check(kopf.length === 1 && kopf[0].stufe === 'fehler' && kopf[0].geschoss === 'EG', 'Zu kurze Treppenöffnung: erwartet genau einen Fehler zur Kopfhöhe, gefunden ' + kopf.map(b => b.stufe + ' ' + b.text));
  const K = treppeKopfhoehe(B.h, B.WV, B.T, B.dach);
  // Stufe 7 liegt bei 1386,5 mm unter der Decke 2525 → 1138,5 mm; Stufe 8 und höher liegen in der Öffnung
  check(nahe(K.min, 2525 - 7 * 2971 / 15, 1) && K.stufe === 7, 'Kopfhöhe bei zu kurzer Öffnung ' + K.min + ' über Stufe ' + K.stufe + ' statt ' + (2525 - 7 * 2971 / 15) + ' über Stufe 7');
}

/* ---------- Gegenfall: niedrige Decke (lichte Höhe 2,15 m): die Lauflinie läuft zwischen den Schwerpunkten von Stufe 1 und 2 noch 80 mm weit unter der Decke (Öffnung ab hz 8,655),
   über Stufe 2 (396 mm) bleiben dort nur 1754 mm ---------- */
{
  const h = klon(haus);
  h.geschosse.EG.lichteHoehe = 2150; h.geschosse.DG.deckenaufbau = 821; // Geschosshöhe bleibt 2971
  const B = alles(h);
  const kopf = B.befunde.filter(b => b.regel === 11 && /Kopfhöhe/.test(b.text));
  check(kopf.length === 1 && /Stufe 2\b/.test(kopf[0].text), 'Lichte Höhe 2,15 m: erwartet ein Befund zur Kopfhöhe über Stufe 2, gefunden ' + kopf.map(b => b.text));
  const K = treppeKopfhoehe(B.h, B.WV, B.T, B.dach);
  check(nahe(K.min, 2150 - 2 * 2971 / 15, 0.5), 'Kopfhöhe ' + K.min + ' statt ' + (2150 - 2 * 2971 / 15));
}

if (fails.length) { console.error('Treppe: ' + fails.length + ' Prüfung(en) fehlgeschlagen:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Treppe: alle Prüfungen bestanden (' + A.T.stufen.length + ' Stufen, Steigung ' + A.T.steigung.toFixed(2) + ' mm)');
