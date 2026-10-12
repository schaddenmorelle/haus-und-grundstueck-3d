/* Test des 2D-Grundrisses (src/grundriss.js, Plan Abschnitt 4.1, Phase 3), ohne Three.js.
   Aufruf: node tools/test_grundriss.js   (läuft auch über npm test)
   Sollwerte stammen aus dem bemaßten Grundriss (eingaben/bilder/32710f5f-image.png, gedruckte Maßketten) und aus
   docs/abgleich-eg-grundriss.md, nicht aus dem Modell. Geprüft wird über die öffentliche Schnittstelle:
     kettenSchnitt(haus, WV, abl, geschoss, richtung, bei)      Maßkette entlang einer Schnittlinie
     grundrissAbleiten(haus, WV, abl, dach, befunde, geschoss)  alles, was der Grundriss zeigt
     grundrissSvg(plan, optionen)                               der Grundriss als SVG-Text */
const fs = require('fs'), path = require('path');
const { werteAufloesen } = require('../src/werte.js');
const { raeumeAbleiten } = require('../src/raeume.js');
const { dachAbleiten } = require('../src/dach.js');
const { pruefen } = require('../src/pruefen.js');
const { grundrissAbleiten, kettenSchnitt, grundrissSvg } = require('../src/grundriss.js');
const haus = require('../src/data/haus.json');

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
const klon = o => JSON.parse(JSON.stringify(o));
const gleich = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
function alles(h) {
  const WV = werteAufloesen(h), abl = raeumeAbleiten(h, WV), dach = dachAbleiten(h, WV), befunde = pruefen(h, WV, abl, dach);
  return { h, WV, abl, dach, befunde };
}
const A = alles(haus);
const laengen = k => k.segmente.map(s => s.laenge);
const plan = g => grundrissAbleiten(A.h, A.WV, A.abl, A.dach, A.befunde, g);

/* ---------- Maßketten entlang einer Schnittlinie: Stichproben aus dem gedruckten Plan ---------- */
{
  // Gedruckte Kette oben, 1. Zeile: 21 + 17,5 | 4,185 | 17,5 | 3,01 | 17,5 | 4,635 | 17,5 + 21 (Außenwand 38,5 = 21 Dämmung + 17,5 Mauerwerk)
  const k1 = kettenSchnitt(A.h, A.WV, A.abl, 'EG', 'x', 1500);
  check(gleich(laengen(k1), [385, 4185, 175, 3010, 175, 4635, 385]), 'Kette x bei hz 1,50: ' + laengen(k1) + ' statt 385, 4185, 175, 3010, 175, 4635, 385 (Plan oben, Zeile 1)');
  // Gedruckte Kette oben, 3. Zeile: 38,5 | 3,385 | 11,5 | 3,76 | 17,5 | 4,745 | 38,5
  const k3 = kettenSchnitt(A.h, A.WV, A.abl, 'EG', 'x', 6000);
  check(gleich(laengen(k3), [385, 3385, 115, 3760, 175, 4745, 385]), 'Kette x bei hz 6,00: ' + laengen(k3) + ' statt 385, 3385, 115, 3760, 175, 4745, 385 (Plan oben, Zeile 3)');
  // Gedruckte Kette rechts (Abgleich): D-Bad Nord 2,27–2,385, Süd 4,27–4,385, Nähzimmer Nord 6,335–6,45, Nähzimmer / Speisekammer 9,645–9,76, Speisekammer / Küche 11,02–11,195
  const kz = kettenSchnitt(A.h, A.WV, A.abl, 'EG', 'z', 11500);
  check(gleich(laengen(kz), [385, 1885, 115, 1885, 115, 1950, 115, 3195, 115, 1260, 175, 3075, 385]), 'Kette z bei hx 11,50: ' + laengen(kz) + ' (Plan rechts: 1,885 / 1,885 / 1,95 / 3,195 / 1,26 / 3,075)');
  check(kz.von === 0 && kz.bis === 14655, 'Kette z bei hx 11,50 läuft von ' + kz.von + ' bis ' + kz.bis + ' statt 0 bis 14655');
  // Westseite: Eltern 3,01 tief, Wand Eltern / Bad 11,5, Bad 2,885 (Aufmaß 288), Außenwand Süd 38,5; zusammen 6,78 m
  const kw = kettenSchnitt(A.h, A.WV, A.abl, 'EG', 'z', 800);
  check(gleich(laengen(kw), [385, 3010, 115, 2885, 385]), 'Kette z bei hx 0,80: ' + laengen(kw) + ' statt 385, 3010, 115, 2885, 385');
  // Die Segmente schließen lückenlos aneinander und ergeben die Länge der Kette
  [k1, k3, kz, kw].forEach((k, i) => {
    let ok = true; k.segmente.forEach((s, j) => { if (j && Math.abs(s.von - k.segmente[j - 1].bis) > 1e-6) ok = false; });
    check(ok, 'Kette ' + i + ': Segmente schließen nicht lückenlos aneinander');
    check(Math.abs(k.segmente.reduce((a, s) => a + s.laenge, 0) - (k.bis - k.von)) < 1e-6, 'Kette ' + i + ': Summe der Segmente ungleich Länge der Kette');
  });
  // Wand und Raum wechseln sich ab
  check(k1.segmente.map(s => s.art).join() === 'wand,raum,wand,raum,wand,raum,wand', 'Art der Segmente in Kette 1: ' + k1.segmente.map(s => s.art));
  // Lichte Räume tragen den Raumnamen (id) im Maßnamen, Wände die Wand-ID
  check(k1.segmente[1].name.indexOf('eltern') >= 0 && /breite/.test(k1.segmente[1].name), 'Maßname des Raums Eltern: ' + k1.segmente[1].name);
  check(k1.segmente[2].name === 'wand:eg.eltern-har', 'Maßname der Wand: ' + k1.segmente[2].name);
}

/* ---------- Markierung beim Anklicken eines Maßes (bereiche) ----------
   Wandmaß: die ganze Wand, Pfeiler: das Wandstück zwischen den Öffnungen, Öffnung: der Ausschnitt, Gesamtmaß: die Außenwände dazwischen.
   Sollwerte aus dem gedruckten Plan (Achsen und Wanddicken), nicht aus dem Modell. */
{
  const bb = r => { const x = r.map(p => p[0]), z = r.map(p => p[1]); return [Math.min(...x), Math.min(...z), Math.max(...x), Math.max(...z)]; };
  const segs = g => plan(g).ketten.reduce((a, k) => a.concat(k.segmente.map(s => ({ s, k }))), []);
  const finde = (g, name) => (segs(g).filter(x => x.s.name === name)[0] || {}).s;
  // Wand Speisekammer / Küche: Nordseite bei 11,02 m (Plan), 17,5 cm dick, von der Wand zum Nähzimmer (9,005) bis zur Innenseite Ostwand (12,565)
  const w = finde('EG', 'wand:eg.speis-kueche');
  check(w && w.bereiche && w.bereiche.length === 1 && w.bereiche[0].id === 'eg.speis-kueche' && gleich(bb(w.bereiche[0].ring), [9005, 11020, 12565, 11195]), 'Wandmaß markiert die ganze Wand: ' + JSON.stringify(w && w.bereiche && w.bereiche.map(b => [b.id, bb(b.ring)])));
  // Pfeiler der Südwand: West-Ecke bis Terrassentür (3,5 bis 3,885 m) und Tür bis Ost-Ecke (6,895 bis 12,95 m); Wand 38,5 cm, Außenkante 14,655 m
  const p1 = finde('EG', 'eg.aw.sued.pfeiler1'), p2 = finde('EG', 'eg.aw.sued.pfeiler2');
  check(p1 && p1.bereiche && p1.bereiche.length === 1 && gleich(bb(p1.bereiche[0].ring), [3500, 14270, 3885, 14655]), 'Pfeiler 1 markiert nur sein Wandstück: ' + JSON.stringify(p1 && p1.bereiche && p1.bereiche.map(b => bb(b.ring))));
  check(p2 && p2.bereiche && gleich(bb(p2.bereiche[0].ring), [6895, 14270, 12950, 14655]), 'Pfeiler 2 markiert nur sein Wandstück');
  // Öffnung: der Ausschnitt (Terrassentür 3,885 bis 6,895 m)
  const o = finde('EG', 'eg.aw.sued.oeff1');
  check(o && o.bereiche && o.bereiche.length === 1 && gleich(bb(o.bereiche[0].ring), [3885, 14270, 6895, 14655]), 'Öffnung markiert den Ausschnitt: ' + JSON.stringify(o && o.bereiche && o.bereiche.map(b => bb(b.ring))));
  // Gesamtmaße: die Außenwände zwischen den Endpunkten
  const ids = s => (s.bereiche || []).map(b => b.id).sort().join();
  const eg = plan('EG');
  const gN = eg.ketten.filter(k => k.typ === 'gesamt' && k.seite === 'N')[0].segmente, gS = eg.ketten.filter(k => k.typ === 'gesamt' && k.seite === 'S')[0].segmente;
  const gW = eg.ketten.filter(k => k.typ === 'gesamt' && k.seite === 'W')[0].segmente, gO = eg.ketten.filter(k => k.typ === 'gesamt' && k.seite === 'O')[0].segmente;
  check(ids(gN[0]) === 'eg.aw.nord', 'Gesamtmaß Nord markiert die Nordwand: ' + ids(gN[0]));
  check(ids(gO[0]) === 'eg.aw.ost', 'Gesamtmaß Ost markiert die Ostwand: ' + ids(gO[0]));
  check(ids(gS[0]) === 'eg.aw.sued-west' && ids(gS[1]) === 'eg.aw.sued', 'Gesamtmaß Süd (3,5 | 9,45): ' + ids(gS[0]) + ' | ' + ids(gS[1]));
  check(ids(gW[0]) === 'eg.aw.west' && ids(gW[1]) === 'eg.aw.west-wohnen', 'Gesamtmaß West (6,78 | 7,875): ' + ids(gW[0]) + ' | ' + ids(gW[1]));
  // Raummaße behalten die rote Linie über die Schnittlinie und markieren keine Wand
  const r = segs('EG').filter(x => x.s.art === 'raum')[0].s;
  check(!r.bereiche || r.bereiche.length === 0, 'Raummaß markiert keine Wand: ' + JSON.stringify(r.bereiche));
  // Im DG: Gesamtmaß Nord liegt auf der Nord-Kniewand
  const dgN = plan('DG').ketten.filter(k => k.typ === 'gesamt' && k.seite === 'N')[0].segmente[0];
  check(ids(dgN) === 'dg.kniewand-nord', 'DG Gesamtmaß Nord markiert die Nord-Kniewand: ' + ids(dgN));
  // Beschriftungen an den Öffnungen sind anklickbar und tragen den Namen der Öffnung (auch an Innenwänden, die keine Maßkette haben)
  const svg = grundrissSvg(plan('EG'), {});
  const hits = (svg.match(/<(?:path|rect) class="hit"[^>]*data-art="oeffnung"[^>]*>/g) || []);
  check(plan('EG').oeffnungen.every(op => hits.some(h => h.indexOf('data-name="' + op.name + '"') >= 0 && /data-wert="[\d.]+"/.test(h))), 'Jede Öffnung hat ein anklickbares Ziel mit Namen und Wert: ' + hits.length + ' Ziele für ' + plan('EG').oeffnungen.length + ' Öffnungen');
  check(grundrissSvg(plan('EG'), { oeffnungen: false }).indexOf('data-art="oeffnung"') >= 0, 'Öffnungsmaße der Ketten bleiben klickbar, auch wenn die Beschriftungen aus sind');
}

/* ---------- Herkunft und gesperrte Maße ---------- */
{
  // HAR 2,95 m tief: Maß aus dem Aufmaß (z.harSi = z.Ni + 2950, quelle aufmass); die Außenwanddicke hebt sich in der Differenz auf
  const kz = kettenSchnitt(A.h, A.WV, A.abl, 'EG', 'z', 6000);
  const har = kz.segmente.filter(s => s.art === 'raum' && /har\./.test(s.name))[0];
  check(har && Math.abs(har.laenge - 2950) < 1e-6 && har.quelle === 'aufmass', 'HAR-Tiefe: ' + JSON.stringify(har && { l: har.laenge, q: har.quelle }) + ' statt 2950 mm aus dem Aufmaß');
  const iw = kz.segmente.filter(s => s.name === 'wand:eg.har-sued')[0];
  check(iw && iw.quelle === 'plan', 'Innenwand IW175 hat Herkunft plan: ' + (iw && iw.quelle));
  const aw = kz.segmente[0];
  check(aw.quelle === 'nutzer', 'Außenwand 38,5 cm hat Herkunft nutzer: ' + aw.quelle);
  check(aw.fest === false, 'Die Außenwanddicke ist nicht gesperrt');
  const dg = kettenSchnitt(A.h, A.WV, A.abl, 'DG', 'x', 4000);
  check(dg.segmente.some(s => s.art === 'wand' && s.quelle === 'annahme'), 'DG-Wanddicke 12,5 cm hat Herkunft annahme');
}

/* ---------- Grundriss EG ---------- */
const eg = plan('EG');
{
  const gesamt = s => eg.ketten.filter(k => k.typ === 'gesamt' && k.seite === s);
  // Gedruckte Gesamtmaße: oben 12,95, unten 3,50 + 9,45, links 6,78 + 7,875, rechts 14,655; alle gesperrt (Außenmaße)
  check(gesamt('N').length === 1 && gleich(laengen(gesamt('N')[0]), [12950]), 'Gesamtmaß Nord: ' + (gesamt('N')[0] && laengen(gesamt('N')[0])));
  check(gesamt('S').length === 1 && gleich(laengen(gesamt('S')[0]), [3500, 9450]), 'Gesamtmaß Süd: ' + (gesamt('S')[0] && laengen(gesamt('S')[0])));
  check(gesamt('W').length === 1 && gleich(laengen(gesamt('W')[0]), [6780, 7875]), 'Gesamtmaß West: ' + (gesamt('W')[0] && laengen(gesamt('W')[0])));
  check(gesamt('O').length === 1 && gleich(laengen(gesamt('O')[0]), [14655]), 'Gesamtmaß Ost: ' + (gesamt('O')[0] && laengen(gesamt('O')[0])));
  ['N', 'S', 'W', 'O'].forEach(s => gesamt(s)[0] && gesamt(s)[0].segmente.forEach(sg => check(sg.fest === true, 'Gesamtmaß ' + s + ' ' + sg.laenge + ' nicht als gesperrt markiert')));
  check(gesamt('N')[0].segmente[0].name === 'aussen:breite' && gesamt('O')[0].segmente[0].name === 'aussen:tiefe', 'Namen der Außenmaße: ' + gesamt('N')[0].segmente[0].name + ', ' + gesamt('O')[0].segmente[0].name);

  // Öffnungsketten der Ostwand (Abgleich): Fenster 1,01–1,77; 3,01–3,77; Tür 4,51–5,67 + Seitenteil –6,27; Fenster 7,01–8,52; 11,885–13,395
  const ost = eg.ketten.filter(k => k.typ === 'oeffnungen' && k.wand === 'eg.aw.ost')[0];
  check(ost && gleich(laengen(ost), [1010, 760, 1240, 760, 740, 1160, 600, 740, 1510, 3365, 1510, 1260]), 'Öffnungskette Ostwand: ' + (ost && laengen(ost)));
  check(ost && ost.seite === 'O', 'Öffnungskette der Ostwand gehört zur Seite O');
  // Badfenster im Süden (gedruckt unten: 1,375 + 38,5 | 1,51 | 0,23)
  const sw = eg.ketten.filter(k => k.typ === 'oeffnungen' && k.wand === 'eg.aw.sued-west')[0];
  check(sw && gleich(laengen(sw), [1760, 1510, 230]), 'Öffnungskette Badfenster: ' + (sw && laengen(sw)));
  check(sw && sw.segmente[1].name === 'eg.aw.sued-west.oeff1' && sw.segmente[0].name === 'eg.aw.sued-west.pfeiler1', 'Namen der Öffnungskette: ' + (sw && sw.segmente.map(s => s.name)));
  // Innenwände haben keine Öffnungskette (Türen stehen als Beschriftung im Plan)
  check(!eg.ketten.some(k => k.typ === 'oeffnungen' && k.wand === 'eg.har-sued'), 'Innenwand mit Öffnungskette');

  // Jede senkrechte Innenwand taucht in mindestens einer Wandkette auf, jede waagerechte in einer z-Kette
  const inKetten = (richtung, id) => eg.ketten.some(k => k.typ === 'waende' && k.richtung === richtung && k.segmente.some(s => s.ids && s.ids.indexOf(id) >= 0));
  ['eg.eltern-har', 'eg.har-julian', 'eg.querwand-elterntuer', 'eg.dbad-west', 'eg.wc', 'eg.bad-ankleide', 'eg.ankleide-ost', 'eg.wohnen-naehzimmer-west'].forEach(id => check(inKetten('x', id), 'Wand ' + id + ' fehlt in den Maßketten (x)'));
  ['eg.har-sued', 'eg.eltern-bad', 'eg.ankleide-nord', 'eg.ankleide-wohnen', 'eg.flur-wohnen', 'eg.flur-naehzimmer', 'eg.naehzimmer-speis', 'eg.speis-kueche', 'eg.dbad-nord', 'eg.julian-dbad-sued'].forEach(id => check(inKetten('z', id), 'Wand ' + id + ' fehlt in den Maßketten (z)'));
  // Jedes Maß hat einen Namen; derselbe Name bedeutet denselben Wert
  const wert = {};
  eg.ketten.forEach(k => k.segmente.forEach(s => {
    check(typeof s.name === 'string' && s.name.length > 0, 'Maß ohne Namen in Kette ' + k.typ + ' ' + k.seite);
    check(['plan', 'aufmass', 'nutzer', 'annahme', 'ohne'].indexOf(s.quelle) >= 0, 'Maß ' + s.name + ' hat keine gültige Herkunft: ' + s.quelle);
    check(isFinite(s.laenge) && s.laenge > 0, 'Maß ' + s.name + ' hat keine positive Länge');
    if (wert[s.name] != null && Math.abs(wert[s.name] - s.laenge) > 0.5 && !s.schraeg) fails.push('Maßname ' + s.name + ' bedeutet verschiedene Werte: ' + wert[s.name] + ' und ' + s.laenge);
    wert[s.name] = s.laenge;
  }));

  // Räume: Name, Fläche und lichte Maße am Stempel
  check(eg.raeume.length === A.h.raeume.filter(r => r.geschoss === 'EG').length, 'Anzahl Räume im Grundriss EG: ' + eg.raeume.length);
  const wohnen = eg.raeume.filter(r => r.id === 'wohnen')[0], har = eg.raeume.filter(r => r.id === 'har')[0];
  check(wohnen && wohnen.name === 'Wohnen / Essen' && Math.abs(wohnen.flaeche - A.abl.raeume.filter(r => r.id === 'wohnen')[0].flaeche) < 1e-6, 'Raum Wohnen im Grundriss');
  check(har && gleich([har.lichte.breite, har.lichte.tiefe], [3010, 2950]) && har.rechteckig === true, 'lichte Maße HAR: ' + (har && JSON.stringify(har.lichte)) + ' statt 3010 × 2950');
  check(har && har.stempel[0] === 6220 && har.stempel[1] === 1860, 'Stempel HAR');
  const flur = eg.raeume.filter(r => r.id === 'flur')[0];
  check(flur && flur.rechteckig === false, 'Flur / Diele hat Schrägwände und ist nicht rechteckig');

  // Wände: Fläche und Öffnungen
  check(eg.waende.length > 0 && eg.waendeUnion && eg.waendeUnion.length > 0, 'Wandflächen fehlen im Grundriss');
  check(eg.oeffnungen.length === A.h.waende.filter(w => w.geschoss === 'EG').reduce((a, w) => a + (w.oeffnungen || []).length, 0), 'Anzahl Öffnungen im Grundriss EG: ' + eg.oeffnungen.length);
  const tuer = eg.oeffnungen.filter(o => o.name === 'eg.har-sued.oeff1')[0];
  check(tuer && tuer.beschriftung === '88,5/219' && tuer.art === 'durchgang', 'Beschriftung der Tür HAR: ' + (tuer && tuer.beschriftung) + ' statt 88,5/219 (Plannotation Breite/Höhe)');
  const fenster = eg.oeffnungen.filter(o => o.name === 'eg.aw.ost.oeff1')[0];
  check(fenster && fenster.beschriftung === '76/125' && fenster.bruestung === 1125, 'Beschriftung eines Fensters: ' + (fenster && fenster.beschriftung));

  // Kamin und Treppe stehen im EG-Plan, die Treppenöffnung im DG
  check(eg.treppe && eg.treppe.lauf.length === 4, 'Treppenlauf im EG-Plan fehlt');
  check(!eg.treppenoeffnung, 'Treppenöffnung gehört nicht in den EG-Plan');
}

/* ---------- Grundriss DG ---------- */
const dg = plan('DG');
{
  check(dg.geschoss === 'DG' && dg.raeume.length === 4, 'Räume im DG: ' + dg.raeume.length);
  check(dg.treppenoeffnung && dg.treppenoeffnung.length === 4, 'Treppenöffnung im DG-Plan fehlt');
  // Gesamtmaße im DG: Kante hinter der Treppenöffnung zählt nicht, die Öffnung selbst (99 cm) steht an der Ostseite
  const dgGes = s => dg.ketten.filter(k => k.typ === 'gesamt' && k.seite === s).map(laengen);
  check(JSON.stringify(dgGes('N')) === '[[6040]]' && JSON.stringify(dgGes('S')) === '[[6040]]', 'Gesamtmaß DG Nord/Süd: ' + JSON.stringify(dgGes('N')) + ' / ' + JSON.stringify(dgGes('S')) + ' statt 6040');
  check(JSON.stringify(dgGes('W')) === '[[11230]]' && JSON.stringify(dgGes('O')) === '[[6925,990,3315]]', 'Gesamtmaß DG West/Ost: ' + JSON.stringify(dgGes('W')) + ' / ' + JSON.stringify(dgGes('O')));
  check(dg.ketten.every(k => k.typ !== 'oeffnungen' || k.wand), 'Öffnungskette ohne Wand');
  const pia = dg.raeume.filter(r => r.id === 'pia')[0];
  check(pia && pia.flaeche > 1e6, 'Fläche Pias Zimmer fehlt');
}

/* ---------- Befunde als Marken im Plan ---------- */
{
  const mitOrt = A.befunde.filter(b => b.ort && b.geschoss === 'DG');
  check(dg.marken.length === mitOrt.length, 'Marken im DG-Plan: ' + dg.marken.length + ' statt ' + mitOrt.length);
  const d = klon(haus); d.waende.filter(w => w.id === 'eg.dbad-west')[0].bis = ['x.dbW', 'z.flurS'];
  const B = alles(d), p = grundrissAbleiten(B.h, B.WV, B.abl, B.dach, B.befunde, 'EG');
  const fehler = p.marken.filter(m => m.stufe === 'fehler');
  check(fehler.length >= 2 && fehler.every(m => m.ort && isFinite(m.ort[0]) && m.text), 'Fehlermarken im EG-Plan nach der Änderung: ' + fehler.length);
}

/* ---------- Eine Maßänderung wandert in den Plan ---------- */
{
  // Eltern 4,185 → 4,285 m breit (x.eltO 4570 → 4670): die Wände von HAR und Julians Zimmer wandern mit, der Raum ganz rechts gibt nach
  const d = klon(haus); d.achsen['x.eltO'].wert = 4670;
  const B = alles(d), k = kettenSchnitt(B.h, B.WV, B.abl, 'EG', 'x', 1500);
  check(gleich(laengen(k), [385, 4285, 175, 3010, 175, 4535, 385]), 'Kette nach Änderung von x.eltO: ' + laengen(k) + ' statt 385, 4285, 175, 3010, 175, 4535, 385 (Eltern breiter, HAR bleibt, Rest gibt nach)');
  check(Math.abs(k.segmente.reduce((a, s) => a + s.laenge, 0) - 12950) < 1e-6, 'Summe der Kette nach der Änderung ist nicht mehr 12950');
}

/* ---------- SVG ---------- */
function xmlOk(svg) { // Tags sind ausgeglichen (kleiner Prüfer, genügt für selbst erzeugtes SVG)
  const stack = [], re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g; let m;
  while ((m = re.exec(svg))) {
    if (m[4] === '/') continue;
    if (m[1]) { if (stack.pop() !== m[2]) return 'Tag ' + m[2] + ' schließt nichts Offenes'; } else stack.push(m[2]);
  }
  return stack.length ? 'ungeschlossen: ' + stack.join(',') : null;
}
{
  [['EG', eg], ['DG', dg]].forEach(([g, p]) => {
    const svg = grundrissSvg(p, { standalone: true }), inline = grundrissSvg(p, {});
    check(/^<svg\b/.test(svg) && /<\/svg>\s*$/.test(svg) && svg.split('<svg').length === 2, g + ': kein einzelnes svg-Element');
    check(xmlOk(svg) === null, g + ': SVG nicht wohlgeformt: ' + xmlOk(svg));
    check(xmlOk(inline) === null, g + ': Inline-SVG nicht wohlgeformt: ' + xmlOk(inline));
    check(!/NaN|undefined|Infinity/.test(svg), g + ': SVG enthält NaN/undefined/Infinity');
    check(/xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(svg), g + ': xmlns fehlt');
    p.raeume.forEach(r => check(svg.indexOf(r.name) >= 0, g + ': Raumname ' + r.name + ' fehlt im SVG'));
    check((/class="schloss"/.test(svg)) === (g === 'EG'), g + ': Schloss an gesperrten Maßen nur im EG (nur dort liegen Maße auf gesperrten Achsen)');
    (g === 'EG' ? ['plan', 'aufmass', 'nutzer'] : ['annahme']).forEach(q => check(svg.indexOf('data-quelle="' + q + '"') >= 0, g + ': keine Maße mit Herkunft ' + q));
    check(/data-name="aussen:breite"/.test(svg) || g === 'DG', g + ': Außenmaß nicht anklickbar markiert');
    check(svg.length < 400000, g + ': SVG zu groß (' + svg.length + ' Zeichen)');
    check(svg === grundrissSvg(p, { standalone: true }), g + ': SVG ist nicht reproduzierbar');
    check(/prefers-color-scheme: ?dark/.test(svg) && !/prefers-color-scheme/.test(inline), g + ': Dunkelmodus nur im eigenständigen SVG');
    ['Straße', 'Eigentümer'].forEach(s => check(svg.indexOf(s) < 0, g + ': verbotener Text im SVG ' + s));
  });
  const aus = grundrissSvg(eg, { massketten: false });
  check(aus.indexOf('data-name="aussen:breite"') < 0, 'Maßketten lassen sich abschalten');
  // docs/plaene/*.svg wird vom Build geschrieben; hier nur der Hinweis, wenn sie nicht mehr zur Quelle passen
  ['EG', 'DG'].forEach(g => {
    const f = path.join(__dirname, '..', 'docs', 'plaene', 'grundriss-' + g.toLowerCase() + '.svg');
    if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').trimEnd() !== grundrissSvg(g === 'EG' ? eg : dg, { standalone: true })) console.log('Hinweis: docs/plaene/grundriss-' + g.toLowerCase() + '.svg ist nicht aktuell (npm run build)');
  });
}

if (fails.length) { console.log('FEHLER:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('Grundriss: alle Prüfungen bestanden (EG: ' + eg.ketten.length + ' Ketten, ' + eg.oeffnungen.length + ' Öffnungen; DG: ' + dg.ketten.length + ' Ketten)');
