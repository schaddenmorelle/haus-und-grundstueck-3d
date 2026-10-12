/* Test von Schnitt und Ansicht (src/schnitt.js, Plan Abschnitt 4.2, Phase 5), ohne Three.js.
   Aufruf: node tools/test_schnitt.js   (läuft auch über npm test)
   Sollwerte stammen aus dem Plan und den Angaben des Nutzers (AGENTS.md): OKFF EG 0, lichte Höhe 2525, Geschosshöhe 2971 (Decke 446), Traufe 2970
   (145,77 m ü. NN), First 149,08 m ü. NN, Dachneigung 35°, Überstand 235, Außenwand 385, Kniewand 1000, Treppe 15 Steigungen, Fenster und Türen aus den
   Planmaßen (Breite/Höhe, Brüstung), nicht aus dem Modell. Geprüft wird über die öffentliche Schnittstelle:
     schnittLinien(haus, WV)                              die Schnittlinien aus haus.schnitte (Achsen aufgelöst)
     schnittAbleiten(haus, WV, abl, dach, linie)          geschnittene Wände, Decke, Dach, Treppe mit Kopfhöhe, Höhenketten
     ansichtAbleiten(haus, WV, abl, dach, seite)          Fassade N, O, S, W: Außenwände mit Öffnungen, Dachsilhouette, Dachfenster, Kamin, Höhenkoten
     schnittSvg(zeichnung, optionen)                      SVG-Text */
const { werteAufloesen } = require('../src/werte.js');
const { raeumeAbleiten } = require('../src/raeume.js');
const { dachAbleiten } = require('../src/dach.js');
const { pruefen } = require('../src/pruefen.js');
const { schnittLinien, schnittAbleiten, ansichtAbleiten, schnittSvg } = require('../src/schnitt.js');
const haus = require('../src/data/haus.json');

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
const nahe = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.5 : tol);
const klon = o => JSON.parse(JSON.stringify(o));
function alles(h) {
  const WV = werteAufloesen(h), abl = raeumeAbleiten(h, WV), dach = dachAbleiten(h, WV);
  return { h, WV, abl, dach, befunde: pruefen(h, WV, abl, dach) };
}
const A = alles(haus);
const bb = ring => { const s = ring.map(p => p[0]), y = ring.map(p => p[1]); return [Math.min(...s), Math.min(...y), Math.max(...s), Math.max(...y)]; };
const gleichBB = (ring, soll, tol) => { const b = bb(ring); return b.every((v, i) => nahe(v, soll[i], tol)); };
const segmente = z => [].concat(...z.ketten.map(k => k.segmente));
const segment = (z, name) => segmente(z).filter(s => s.name === name)[0];
const yD = 2971, yE = 2970, lichte = 2525, tan = Math.tan(35 * Math.PI / 180);

/* ---------- Schnittlinien aus den Daten ---------- */
const linien = schnittLinien(A.h, A.WV);
check(linien.length === 2 && linien[0].id === 'A' && linien[1].id === 'B', 'Schnittlinien: ' + linien.map(l => l.id));
const lA = linien[0], lB = linien[1];
check(nahe(lA.a[0], 3100, 1e-6) && nahe(lA.a[1], 9195, 1e-6) && nahe(lA.b[0], 13350, 1e-6) && nahe(lA.b[1], 9195, 1e-6), 'Linie A–A: ' + JSON.stringify([lA.a, lA.b]) + ' statt (3100 / 9195) bis (13350 / 9195): waagerecht 450 mm nördlich der Wand Nähzimmer / Speisekammer, 400 mm über die Außenkanten hinaus');

/* ---------- Schnitt A–A durch die Treppe ---------- */
const sA = schnittAbleiten(A.h, A.WV, A.abl, A.dach, lA);
{
  check(nahe(sA.laenge, 10250, 1e-6), 'Länge A–A ' + sA.laenge + ' statt 10250');
  check(sA.blick[0] === 0 && sA.blick[1] === -1, 'Blick von A–A nach Norden (links von der Laufrichtung): ' + sA.blick);
  const fl = (id) => sA.flaechen.filter(f => f.id === id);
  // Westwand des Wohnzimmers (x 3,50–3,885): bei hz 9,195 keine Öffnung (die dritte Fenstertür reicht von hz 7,04 bis 9,05), also ganz bis zur Traufe
  const ww = fl('eg.aw.west-wohnen');
  check(ww.length === 1 && gleichBB(ww[0].ring, [400, 0, 785, yE]), 'Westwand: ' + JSON.stringify(ww.map(f => bb(f.ring))) + ' statt 400–785 / 0–2970');
  // Ostwand (x 12,565–12,95): an dieser Stelle keine Öffnung (Fenster hz 7,01–8,52 und 11,885–13,395), also ganz bis zur Traufe
  const ow = fl('eg.aw.ost');
  check(ow.length === 1 && gleichBB(ow[0].ring, [9465, 0, 9850, yE]), 'Ostwand: ' + JSON.stringify(ow.map(f => bb(f.ring))) + ' statt 9465–9850 / 0–2970');
  check(ow[0].geschoss === 'EG' && ow[0].art === 'wand', 'Ostwand: art/geschoss ' + ow[0].art + '/' + ow[0].geschoss);
  // Decke: zwischen den Innenseiten der Außenwände, ohne die Treppenöffnung (hx 9,20–12,54): [785, 6100] und der Rest bis zur Ostwand [9440, 9465]
  const dk = sA.flaechen.filter(f => f.art === 'decke').map(f => bb(f.ring)).sort((p, q) => p[0] - q[0]);
  check(dk.length === 2 && [785, lichte, 6100, yD].every((v, i) => nahe(dk[0][i], v)) && [9440, lichte, 9465, yD].every((v, i) => nahe(dk[1][i], v)),
    'Decke in A–A: ' + JSON.stringify(dk) + ' statt [785, 2525, 6100, 2971] und [9440, 2525, 9465, 2971] (Treppenöffnung 9,20–12,54)');
  // Treppe: die Linie läuft in der Mitte des Laufs (v = 450): Stufen 3 bis 14 werden geschnitten, jede 44 mm dick, mit der Trittfläche n · 198,07
  const st = sA.treppe.stufen;
  check(st.map(s => s.n).join() === '3,4,5,6,7,8,9,10,11,12,13,14', 'Geschnittene Stufen: ' + st.map(s => s.n));
  st.forEach(s => check(nahe(s.hoehe, s.n * 2971 / 15, 1e-6) && nahe(bb(s.ring)[1], s.n * 2971 / 15 - 44, 1e-6) && nahe(bb(s.ring)[3], s.n * 2971 / 15, 1e-6), 'Stufe ' + s.n + ': ' + JSON.stringify(bb(s.ring))));
  const s7 = st.filter(s => s.n === 7)[0];
  check(nahe(bb(s7.ring)[0], 12565 - 1357 - 251 - 3100, 1e-6) && nahe(bb(s7.ring)[2], 12565 - 1357 - 3100, 1e-6), 'Stufe 7 liegt bei s ' + bb(s7.ring)[0] + ' bis ' + bb(s7.ring)[2] + ' statt 7857 bis 8108');
  check(nahe(sA.treppe.steigung, 2971 / 15, 1e-9), 'Steigung ' + sA.treppe.steigung);
  // Kopfhöhe: über den Stufen mindestens 2,00 m; Randstreifen unter 100 mm Breite zählen nicht (die Decke endet bei hx 12,54, die Wand bei 12,565)
  check(sA.treppe.kopf.min >= 2000, 'Kopfhöhe in A–A nur ' + sA.treppe.kopf.min);
  check(sA.treppe.kopf.stellen.length > 50, 'Zu wenige Stellen der Kopfhöhe: ' + sA.treppe.kopf.stellen.length);
  // Dach: am Anfang der Linie (hx 3,10) liegt die Südtraufe des Flügels A, 490 mm entfernt (Flügel A endet mit dem Überstand bei z.A + 235);
  // First des Flügels B bei hx 8,225 → s 5125 mit 6280 ± 2 (First 149,08 m ü. NN − 142,80)
  const punkte = [].concat(...sA.dachhaut), zA = A.WV.mm('z.A');
  check(nahe(punkte[0][0], 0, 0.5) && nahe(punkte[0][1], 2970 - 235 * tan + tan * (zA + 235 - 9195), 0.5), 'Dach am Anfang von A–A: ' + JSON.stringify(punkte[0]));
  const hoechster = punkte.reduce((m, p) => p[1] > m[1] ? p : m);
  check(nahe(hoechster[0], 5125, 0.5) && nahe(hoechster[1], 6280, 2), 'First in A–A bei s ' + hoechster[0] + ' mit ' + hoechster[1] + ' statt 5125 / 6280');
  // Höhenketten: lichte Höhe 2525, Decke 446
  check(segment(sA, 'hoehe:eg.lichte') && nahe(segment(sA, 'hoehe:eg.lichte').laenge, 2525), 'Kette: hoehe:eg.lichte ' + (segment(sA, 'hoehe:eg.lichte') || {}).laenge);
  check(segment(sA, 'hoehe:dg.deckenaufbau') && nahe(segment(sA, 'hoehe:dg.deckenaufbau').laenge, 446), 'Kette: hoehe:dg.deckenaufbau ' + (segment(sA, 'hoehe:dg.deckenaufbau') || {}).laenge);
  check(segment(sA, 'hoehe:dach.traufe') && nahe(segment(sA, 'hoehe:dach.traufe').laenge, 2970), 'Kette: hoehe:dach.traufe');
  check(sA.koten.okffEG === 0 && sA.koten.deckeUK === 2525 && sA.koten.okffDG === 2971 && sA.koten.traufe === 2970 && nahe(sA.koten.first, 6280, 2), 'Koten: ' + JSON.stringify(sA.koten));
  // Maßkette EG in der Schnittlinie (Wand und Raum im Wechsel) beginnt mit der Westwand 385
  const kEG = sA.ketten.filter(k => k.geschoss === 'EG' && k.typ === 'waende')[0];
  check(kEG && nahe(kEG.segmente[0].laenge, 385) && kEG.segmente[0].name === 'wand:eg.aw.west-wohnen', 'Kette EG beginnt mit ' + (kEG && kEG.segmente[0].name));
  check(kEG && kEG.segmente.length === 5 && nahe(kEG.segmente.reduce((a, s) => a + s.laenge, 0), 12950 - 3500), 'Kette EG: Summe ' + (kEG && kEG.segmente.reduce((a, s) => a + s.laenge, 0)) + ' statt 9450 (hx 3,50–12,95)');
}

/* ---------- Schnitt B–B quer durch Pias Zimmer ---------- */
const sB = schnittAbleiten(A.h, A.WV, A.abl, A.dach, lB);
{
  check(nahe(lB.a[0], -400, 1e-6) && nahe(lB.a[1], 4560, 1e-6), 'Linie B–B beginnt bei ' + lB.a);
  const dgW = A.WV.mm('x.dgW'), kw = sB.flaechen.filter(f => f.id === 'dg.kniewand-west');
  check(kw.length === 1 && gleichBB(kw[0].ring, [dgW + 400, yD, dgW + 400 + 125, yD + 1000]), 'West-Kniewand: ' + JSON.stringify(kw.map(f => bb(f.ring))) + ' statt 1,00 m über dem DG-Boden');
  const ko = sB.flaechen.filter(f => f.id === 'dg.kniewand-ost-nord');
  check(ko.length === 1 && nahe(bb(ko[0].ring)[3], yD + 1000, 1e-6), 'Ost-Kniewand reicht nicht 1,00 m hoch: ' + JSON.stringify(ko.map(f => bb(f.ring))));
  // Eckpunkt an der Traufe (Überstand 235: hx −0,235 → s 165, Höhe 2970 − 235 · tan 35° = 2805,45)
  const punkte = [].concat(...sB.dachhaut);
  check(nahe(punkte[0][0], 165, 0.5) && nahe(punkte[0][1], 2970 - 235 * tan, 0.5), 'Dach an der Traufe in B–B: ' + JSON.stringify(punkte[0]));
  // bei hz 4,56 liegt die Linie in beiden Flügeln auf dem Walm im Norden (Abstand zur Nordtraufe 4560 + 235): Höhe 2970 − 235 · tan + tan · 4795 = 6163, auch über dem First-Nord-Süd bei hx 8,225
  const soll = 2970 - 235 * tan + tan * (4560 + 235), hoechster = Math.max(...punkte.map(p => p[1]));
  const dachY = (pl, s) => { for (let i = 0; i + 1 < pl.length; i++) if (s >= pl[i][0] - 1e-9 && s <= pl[i + 1][0] + 1e-9) return pl[i][1] + (pl[i + 1][1] - pl[i][1]) * (pl[i + 1][0] === pl[i][0] ? 0 : (s - pl[i][0]) / (pl[i + 1][0] - pl[i][0])); return null; };
  check(nahe(hoechster, soll, 1) && nahe(dachY(sB.dachhaut[0], 8225 + 400), soll, 1), 'Dach in B–B: Höchstwert ' + hoechster + ', bei hx 8,225 ' + dachY(sB.dachhaut[0], 8625) + ' statt ' + soll);
  // EG-Wände in B–B: Westwand und Ostwand sind bei hz 4,56 durch Fenstertür (0,76 m) bzw. Haustür (hz 4,51–5,67) geöffnet, es bleibt der Sturz von 2375 bis zur Traufe
  const wW = sB.flaechen.filter(f => f.id === 'eg.aw.west'), wO = sB.flaechen.filter(f => f.id === 'eg.aw.ost');
  check(wW.length === 1 && gleichBB(wW[0].ring, [400, 2375, 785, yE]), 'Westwand in B–B: ' + JSON.stringify(wW.map(f => bb(f.ring))) + ' statt Sturzstück 400–785 / 2375–2970');
  check(wO.length === 1 && gleichBB(wO[0].ring, [12965, 2375, 13350, yE]), 'Ostwand in B–B: ' + JSON.stringify(wO.map(f => bb(f.ring))) + ' statt Sturzstück 12965–13350 / 2375–2970');
  check(sB.treppe.stufen.length === 0, 'B–B schneidet keine Treppe');
  // DG-Wandoberkanten folgen der Dachhaut − 22 cm (Querwand und Trennwand schneidet B–B nicht, die Kniewände ja)
  const dgWaende = sB.flaechen.filter(f => f.geschoss === 'DG' && f.art === 'wand').map(f => f.id).sort();
  check(dgWaende.join() === 'dg.kniewand-ost-nord,dg.kniewand-west', 'Geschnittene DG-Wände in B–B: ' + dgWaende);
}

/* ---------- freie Schnitte ---------- */
{
  const frei = { id: 'C', name: 'Frei', a: [3100, 9195], b: [13350, 9195] };
  const sC = schnittAbleiten(A.h, A.WV, A.abl, A.dach, frei);
  check(sC.flaechen.length === sA.flaechen.length, 'Dieselbe Linie als freier Schnitt liefert dieselben Flächen: ' + sC.flaechen.length + ' statt ' + sA.flaechen.length);
  // gedreht: Linie von Nordwest nach Südost, weder waagerecht noch senkrecht
  const schraeg = schnittAbleiten(A.h, A.WV, A.abl, A.dach, { id: 'D', name: 'Schräg', a: [-500, 500], b: [13400, 14000] });
  check(nahe(schraeg.laenge, Math.hypot(13900, 13500), 1e-6), 'Länge des schrägen Schnitts: ' + schraeg.laenge);
  const ok = schraeg.flaechen.every(f => f.ring.every(p => isFinite(p[0]) && isFinite(p[1])));
  check(ok && schraeg.flaechen.length > 5, 'Schräger Schnitt: Flächen endlich und vorhanden (' + schraeg.flaechen.length + ')');
  check(schraeg.blick[0] > 0.5 && schraeg.blick[1] < -0.5, 'Blick des schrägen Schnitts (links der Laufrichtung, also nach Nordosten): ' + schraeg.blick);
  // senkrechte Linie von Süd nach Nord: Blick nach Osten (links der Laufrichtung)
  const nord = schnittAbleiten(A.h, A.WV, A.abl, A.dach, { id: 'E', name: 'Senkrecht', a: [4500, 15000], b: [4500, -500] });
  check(nord.blick[0] === -1 || nord.blick[0] === 1, 'senkrechte Linie hat einen waagerechten Blick: ' + nord.blick);
}

/* ---------- Ansichten ---------- */
function oeff(an, id) { return an.oeffnungen.filter(o => o.name === id)[0]; }
{
  const N = ansichtAbleiten(A.h, A.WV, A.abl, A.dach, 'N');
  check(N.seite === 'N' && nahe(N.breite, 12950, 1e-6), 'Ansicht N: Breite ' + N.breite);
  const tuer = oeff(N, 'eg.aw.nord.oeff1'), fenster = oeff(N, 'eg.aw.nord.oeff2');
  check(tuer && nahe(tuer.s0, 5555) && nahe(tuer.s1, 6565) && nahe(tuer.y0, 0) && nahe(tuer.y1, 2375), 'Nordtür 101 × 237,5: ' + JSON.stringify(tuer));
  check(fenster && nahe(fenster.s0, 9055) && nahe(fenster.s1, 10565) && nahe(fenster.y0, 1125) && nahe(fenster.y1, 2375), 'Nordfenster 151 × 125, Brüstung 112,5: ' + JSON.stringify(fenster));
  check(N.oeffnungen.length === 2, 'Ansicht N zeigt ' + N.oeffnungen.length + ' Öffnungen statt 2');
  // Dachsilhouette: von der Traufe am Überstand (−235) bis zum First
  const sil = N.dach;
  check(nahe(sil[0][0], -235) && nahe(sil[0][1], 2970 - 235 * tan, 0.5), 'Silhouette beginnt bei ' + JSON.stringify(sil[0]));
  check(nahe(Math.max(...sil.map(p => p[1])), 6280, 2), 'Silhouette: First ' + Math.max(...sil.map(p => p[1])));
  // Dachfenster nach Norden (Pias Zimmer, 114 × 140 cm auf der Schräge): s 8245 ± 570, senkrecht 140 · sin 35° = 803 mm um Dachhöhe 4700
  check(N.dachfenster.length === 1 && N.dachfenster[0].id === 'pia-nord', 'Dachfenster in Ansicht N: ' + N.dachfenster.map(f => f.id));
  const df = N.dachfenster[0];
  check(df && nahe(df.s0, 8245 - 570) && nahe(df.s1, 8245 + 570) && nahe(df.y1 - df.y0, 1400 * Math.sin(35 * Math.PI / 180), 1) && nahe((df.y0 + df.y1) / 2, 4700, 1), 'Dachfenster Nord: ' + JSON.stringify(df));
  // First und Grate: Von Norden sichtbar sind der First (Höhe 149,08 m ü. NN ≙ 6280) und die Grate der Nordwalme; die Südwalme verdeckt das Dach selbst
  const firstK = N.kanten.filter(k => k.art === 'first'), grate = N.kanten.filter(k => k.art === 'grat');
  check(firstK.length >= 1 && firstK.every(k => nahe(k.a[1], 6280, 3) && nahe(k.b[1], 6280, 3)), 'Firstlinien in Ansicht N: ' + JSON.stringify(firstK));
  check(grate.length >= 2 && grate.every(k => k.a[1] < k.b[1] + 1e-6 || k.b[1] < k.a[1] + 1e-6), 'Grate in Ansicht N: ' + grate.length);
  check(N.kanten.every(k => k.a[1] > 2800 && k.b[1] > 2800), 'Kanten unterhalb der Traufkante dürfen nicht erscheinen');
  check(N.kamin && nahe(N.kamin.y1, 6800) && nahe(N.kamin.s0, 9355 - 175) && nahe(N.kamin.s1, 9355 + 175), 'Kamin in Ansicht N: ' + JSON.stringify(N.kamin));
  check(N.koten.okffEG === 0 && N.koten.traufe === 2970 && nahe(N.koten.first, 6280, 2), 'Koten Ansicht: ' + JSON.stringify(N.koten));
  // Höhen der Öffnungen sind bearbeitbare Maße mit eigenem Namen: Brüstung, Höhe, Sturz (bis zur Decke 2525)
  const h1 = segmente(N).filter(s => s.name === 'eg.aw.nord.oeff2.bruestung')[0], h2 = segmente(N).filter(s => s.name === 'eg.aw.nord.oeff2.hoehe')[0], h3 = segmente(N).filter(s => s.name === 'eg.aw.nord.oeff2.sturz')[0];
  check(h1 && nahe(h1.laenge, 1125) && h2 && nahe(h2.laenge, 1250) && h3 && nahe(h3.laenge, 150), 'Höhenmaße des Nordfensters: ' + [h1, h2, h3].map(s => s && s.laenge));
  const t1 = segmente(N).filter(s => s.name === 'eg.aw.nord.oeff1.hoehe')[0];
  check(t1 && nahe(t1.laenge, 2375), 'Höhe der Nordtür: ' + (t1 && t1.laenge));

  // Süd (Blick nach Norden, links ist Osten): s = 12950 − hx
  const S = ansichtAbleiten(A.h, A.WV, A.abl, A.dach, 'S');
  const ft = oeff(S, 'eg.aw.sued.oeff1');
  check(ft && nahe(ft.s0, 6055) && nahe(ft.s1, 9065) && nahe(ft.y0, 0) && nahe(ft.y1, 2375), 'Südtür 301 × 237,5 (Terrasse): ' + JSON.stringify(ft));
  const bf = oeff(S, 'eg.aw.sued-west.oeff1');
  check(bf && nahe(bf.s0, 12950 - 3270) && nahe(bf.s1, 12950 - 1760) && nahe(bf.y0, 1500) && nahe(bf.y1, 2375), 'Badfenster (Südseite des Westflügels): ' + JSON.stringify(bf));

  // Ost (Blick nach Westen, links ist Norden): s = hz
  const O = ansichtAbleiten(A.h, A.WV, A.abl, A.dach, 'O');
  const ot = oeff(O, 'eg.aw.ost.oeff3');
  check(ot && nahe(ot.s0, 4510) && nahe(ot.s1, 5670) && nahe(ot.y1, 2375) && nahe(O.breite, 14655), 'Haustür in der Ostwand 116 × 237,5 bei hz 4,51–5,67: ' + JSON.stringify(ot));
  check(O.oeffnungen.length === 6, 'Ansicht O: ' + O.oeffnungen.length + ' Öffnungen statt 6 (Plan: Ostwand)');
  check(O.dachfenster.map(f => f.id).sort().join() === 'pia-ost,treppenhaus-ost', 'Dachfenster nach Osten: ' + O.dachfenster.map(f => f.id));

  // West (Blick nach Osten, links ist Süden): s = 14655 − hz
  const W = ansichtAbleiten(A.h, A.WV, A.abl, A.dach, 'W');
  const wf = oeff(W, 'eg.aw.west.oeff1'), wf2 = oeff(W, 'eg.aw.west-wohnen.oeff1');
  check(wf && nahe(wf.s0, 14655 - 5145) && nahe(wf.s1, 14655 - 4385), 'Westfenster Eltern: ' + JSON.stringify(wf));
  check(wf2 && nahe(wf2.s0, 385) && nahe(wf2.s1, 1395), 'Westfenster Wohnzimmer: ' + JSON.stringify(wf2));
  check(W.dachfenster.map(f => f.id).join() === 'arbeit-west', 'Dachfenster nach Westen: ' + W.dachfenster.map(f => f.id));
}

/* ---------- SVG ---------- */
{
  const svg = schnittSvg(sA, { standalone: true });
  check(/^<svg /.test(svg) && /<\/svg>$/.test(svg), 'SVG des Schnitts ist ein svg-Element');
  check(!/NaN|undefined|Infinity/.test(svg), 'SVG des Schnitts enthält NaN, undefined oder Infinity');
  check(svg.indexOf('data-name="hoehe:eg.lichte"') > 0 && svg.indexOf('data-name="hoehe:dg.deckenaufbau"') > 0, 'SVG: klickbare Höhenmaße fehlen');
  check(/class="[^"]*decke/.test(svg) && /class="s-stufe/.test(svg) && /class="[^"]*dach/.test(svg), 'SVG: Decke, Treppe oder Dach fehlen');
  const sv2 = schnittSvg(ansichtAbleiten(A.h, A.WV, A.abl, A.dach, 'N'), { standalone: true });
  check(!/NaN|undefined|Infinity/.test(sv2) && sv2.indexOf('data-name="eg.aw.nord.oeff2.bruestung"') > 0, 'SVG der Ansicht: NaN oder Höhenmaß fehlt');
}

/* ---------- Gegenfall: niedrigere Decke wirkt im Schnitt ---------- */
{
  const h = klon(haus); h.geschosse.EG.lichteHoehe = 2400; h.geschosse.DG.deckenaufbau = 571;
  const B = alles(h);
  const s = schnittAbleiten(B.h, B.WV, B.abl, B.dach, schnittLinien(B.h, B.WV)[0]);
  check(nahe(segment(s, 'hoehe:eg.lichte').laenge, 2400) && nahe(segment(s, 'hoehe:dg.deckenaufbau').laenge, 571), 'Höhenketten folgen den Daten');
  const dk = s.flaechen.filter(f => f.art === 'decke').map(f => bb(f.ring)[1]);
  check(dk.every(v => nahe(v, 2400)), 'Decke beginnt bei 2400: ' + dk);
}

/* ---------- docs/plaene/*.svg schreibt der Build; hier nur der Hinweis, wenn sie nicht mehr zur Quelle passen ---------- */
{
  const fs = require('fs'), path = require('path');
  const soll = { 'schnitt-a.svg': schnittSvg(sA, { standalone: true }), 'schnitt-b.svg': schnittSvg(sB, { standalone: true }) };
  [['N', 'nord'], ['O', 'ost'], ['S', 'sued'], ['W', 'west']].forEach(([s, n]) => { soll['ansicht-' + n + '.svg'] = schnittSvg(ansichtAbleiten(A.h, A.WV, A.abl, A.dach, s), { standalone: true }); });
  Object.keys(soll).forEach(n => {
    const f = path.join(__dirname, '..', 'docs', 'plaene', n);
    if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').trimEnd() !== soll[n]) console.log('Hinweis: docs/plaene/' + n + ' ist nicht aktuell (npm run build)');
  });
}

if (fails.length) { console.error('Schnitt und Ansicht: ' + fails.length + ' Prüfung(en) fehlgeschlagen:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Schnitt und Ansicht: alle Prüfungen bestanden (A–A: ' + sA.flaechen.length + ' Flächen, ' + sA.treppe.stufen.length + ' Stufen)');
