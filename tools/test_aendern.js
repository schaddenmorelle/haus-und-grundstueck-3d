/* Test von src/aendern.js und tools/aendern.js (Plan Abschnitt 5.2 und 9, Phase 4), ohne Three.js.
   Aufruf: node tools/test_aendern.js   (läuft auch über npm test)
   Sollwerte stammen aus dem Plan (Ketten und Maße in docs/plan-parametrisches-modell.md, 5.2) und aus Rechnung mit den gedruckten Maßen,
   nicht aus dem Modell. Geprüft wird über die öffentliche Schnittstelle:
     aendern(haus, aenderungen, optionen)   → { ok, haus, kanten, schritte, meldungen, auswirkungen, befunde }
     einheitParsen, stand, listeErzeugen, listeLesen, textPatchen, auswirkungenText
   und die Befehlszeile tools/aendern.js (mit --datei auf einer Kopie von haus.json). */
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const A = require('../src/aendern.js');
const haus = require('../src/data/haus.json');
const HAUS_TEXT = fs.readFileSync(path.join(__dirname, '../src/data/haus.json'), 'utf8');

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
function wirft(fn, muster, msg) {
  try { fn(); fails.push(msg + ' (kein Fehler geworfen)'); } catch (e) { if (!muster.test(e.message)) fails.push(msg + ' (falsche Meldung: ' + e.message + ')'); }
}
const klon = o => JSON.parse(JSON.stringify(o));
const nahe = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const lauf = (liste, opt) => A.aendern(haus, liste, opt);
const raum = (res, id) => res.auswirkungen.raeume.filter(r => r.id === id)[0];
const masz = (res, name) => res.auswirkungen.masse.filter(m => m.name === name)[0];
const idx = id => haus.waende.findIndex(w => w.id === id);
const pfadGleich = (k, pfad, wert) => k.length === 1 && JSON.stringify(k[0].pfad) === JSON.stringify(pfad) && k[0].wert === wert;
const kurz = res => res.meldungen.join(' | ');

/* ---------- Einheiten ---------- */
{
  check(A.einheitParsen('1,30m') === 1300, 'Einheit: 1,30m ist ' + A.einheitParsen('1,30m') + ' mm statt 1300');
  check(A.einheitParsen('12,5cm') === 125, 'Einheit: 12,5cm');
  check(A.einheitParsen('885mm') === 885, 'Einheit: 885mm');
  check(A.einheitParsen(' 2.5 m ') === 2500, 'Einheit: Punkt als Komma und Leerzeichen');
  check(A.einheitParsen(1300) === 1300, 'Einheit: eine Zahl sind Millimeter');
  check(A.einheitParsen('-5cm') === -50, 'Einheit: negative Werte');
  wirft(() => A.einheitParsen('12,5'), /Einheit/, 'Text ohne Einheit muss abgelehnt werden');
  wirft(() => A.einheitParsen('1,30 Meter'), /Einheit|lesbar/, 'unbekannte Einheit');
  wirft(() => A.einheitParsen('abc'), /Einheit|lesbar/, 'kein Wert');
  wirft(() => A.einheitParsen(NaN), /lesbar|Zahl/, 'NaN');
}

/* ---------- Beispiel aus Plan 5.2: lichte Tiefe der Speisekammer 1,26 → 1,30 m ---------- */
// Kette rechts (gedruckter Plan, docs/abgleich-eg-grundriss.md): Nähzimmer / Speisekammer 9,645–9,76, Speisekammer 1,26, Wand 17,5, Küche 3,075.
// 1,30 m heißt: Wand Speisekammer / Küche bei 9,645 + 0,115 + 1,30 = 11,06 m (statt 11,02). Speisekammer 3,385 m breit, Küche 3,56 m.
const speis = lauf([{ mass: 'raum:speis.tiefe', wert: '1,30m' }]);
{
  check(speis.ok, 'Beispiel Speisekammer bricht ab: ' + kurz(speis));
  check(speis.kanten && pfadGleich(speis.kanten, ['achsen', 'z.speisS', 'wert'], 11060), 'Beispiel: geändert wird z.speisS auf 11060, nicht ' + JSON.stringify(speis.kanten));
  check(speis.haus && speis.haus.achsen['z.speisS'].wert === 11060, 'Beispiel: neues Haus trägt z.speisS = 11060');
  check(haus.achsen['z.speisS'].wert === 11020, 'Eingabedaten dürfen nicht verändert werden');
  const alt = klon(haus), neu = klon(speis.haus); alt.achsen['z.speisS'].wert = neu.achsen['z.speisS'].wert;
  check(JSON.stringify(alt) === JSON.stringify(neu), 'Beispiel: außer z.speisS ändert sich nichts in den Daten');
  check(speis.schritte[0].parameter.name === 'z.speisS', 'Beispiel: gewählter Parameter ist ' + JSON.stringify(speis.schritte[0].parameter));
  const ids = speis.auswirkungen.raeume.map(r => r.id).sort();
  check(ids.join() === 'kueche,speis', 'Beispiel: nur Speisekammer und Küche ändern sich, nicht ' + ids);
  check(raum(speis, 'speis') && nahe(raum(speis, 'speis').flaeche.nachher - raum(speis, 'speis').flaeche.vorher, 0.040 * 3.385, 1e-6), 'Beispiel: Speisekammer wächst um 0,04 × 3,385 m²');
  check(raum(speis, 'kueche') && nahe(raum(speis, 'kueche').flaeche.nachher - raum(speis, 'kueche').flaeche.vorher, -0.040 * 3.560, 1e-6), 'Beispiel: Küche schrumpft um 0,04 × 3,56 m²');
  check(masz(speis, 'raum:speis.tiefe') && masz(speis, 'raum:speis.tiefe').vorher === 1260 && masz(speis, 'raum:speis.tiefe').nachher === 1300, 'Beispiel: Maß Speisekammer 1260 → 1300');
  check(masz(speis, 'raum:kueche.tiefe') && masz(speis, 'raum:kueche.tiefe').vorher === 3075 && masz(speis, 'raum:kueche.tiefe').nachher === 3035, 'Beispiel: Maß Küche 3075 → 3035');
  check(speis.auswirkungen.oeffnungen.some(o => o.name === 'eg.speis-kueche.oeff1' && o.art === 'verschoben'), 'Beispiel: der Durchgang in der Wand wandert mit');
  check(speis.befunde.neu.length === 0, 'Beispiel: keine neuen Befunde, aber ' + speis.befunde.neu.map(b => b.text));
  // Wohnfläche (Phase 7): die Speisekammer gewinnt 0,04 × 3,385 m², die Küche verliert 0,04 × 3,56 m²; beide EG, 3 % Putzabzug auf die Differenz
  const wf = speis.auswirkungen.wohnflaeche;
  check(wf && nahe(wf.nachher.gesamt - wf.vorher.gesamt, 0.040 * (3.385 - 3.560) * 0.97, 1e-6), 'Beispiel: Wohnfläche ändert sich um 0,04 × (3,385 − 3,56) × 0,97 m², nicht ' + JSON.stringify(wf));
  const wz = /Wohnfläche \(WoFlV\): ([\d,]+) → ([\d,]+) m²/.exec(A.auswirkungenText(speis));
  check(wz && wz[1] !== wz[2], 'Beispiel: Ausgabe nennt die Wohnfläche, und der Unterschied (7 cm²-Bruchteile) bleibt sichtbar, nicht ' + (wz && wz[0]));
  const text = A.auswirkungenText(speis);
  check(/Speisekammer/.test(text) && /Küche/.test(text) && /z\.speisS/.test(text), 'Beispiel: Ausgabe nennt Räume und Parameter');
}

/* ---------- Gegenbeispiel aus Plan 5.2: Westwand des D-Bads bis zur Wand des Nähzimmers verlängert ---------- */
{
  const g = lauf([{ wandende: 'eg.dbad-west.bis', wert: 'z.flurS' }]);
  check(!g.ok && g.haus === null, 'Gegenbeispiel: muss abbrechen und kein Haus liefern');
  check(g.befunde.fehlerNeu.some(b => b.regel === 2 && b.elemente.indexOf('eg.dbad-west') >= 0 && b.elemente.indexOf('eg.julian-dbad-sued') >= 0), 'Gegenbeispiel: Wand schneidet Wand fehlt: ' + kurz(g));
  check(g.befunde.fehlerNeu.some(b => b.regel === 1 && /Unbenannte Teilfläche/.test(b.text) && /3,[89]\d m²/.test(b.text)), 'Gegenbeispiel: abgetrennter Eingangsbereich (ca. 3,8–3,9 m²) fehlt');
  check(/Fehler/.test(kurz(g)), 'Gegenbeispiel: Meldung nennt die Fehler');
  const t = lauf([{ wandende: 'eg.dbad-west.bis', wert: 'z.flurS' }], { trotzdem: true });
  check(t.ok && t.haus && JSON.stringify(t.haus.waende[idx('eg.dbad-west')].bis) === JSON.stringify(['x.dbW', 'z.flurS']), 'Gegenbeispiel mit trotzdem: Änderung wird übernommen');
  check(t.kanten.length === 1 && JSON.stringify(t.kanten[0].pfad) === JSON.stringify(['waende', idx('eg.dbad-west'), 'bis', 1]), 'Gegenbeispiel: nur der Wert in bis[1] ändert sich: ' + JSON.stringify(t.kanten));
  check(t.befunde.fehlerNeu.length > 0, 'Gegenbeispiel mit trotzdem: Fehler stehen weiter in der Auswertung');
  const frei = lauf([{ wandende: 'eg.dbad-west.bis', wert: 5300 }]); // endet mitten im Flur: frei endende Wand oder Schnitt
  check(!frei.ok, 'Wand endet mitten im Flur: muss abbrechen');
}

/* ---------- Nachbar gibt nach ---------- */
{
  // HAR Tiefe 2,95 → 3,05 m (Aufmaß: HAR 2,95 tief): nur z.harSi.plus ändert sich, Eltern und Flur geben nach.
  const h = lauf([{ mass: 'raum:har.tiefe', wert: '3,05m' }]);
  check(h.ok && pfadGleich(h.kanten, ['achsen', 'z.harSi', 'plus'], 3050), 'HAR-Tiefe: z.harSi.plus = 3050 erwartet, ' + JSON.stringify(h.kanten) + ' ' + kurz(h));
  check(h.ok && raum(h, 'har') && nahe(raum(h, 'har').flaeche.nachher, 3.010 * 3.050, 1e-6), 'HAR-Tiefe: Fläche 3,010 × 3,050 m²');
  check(h.ok && raum(h, 'eltern') && nahe(raum(h, 'eltern').flaeche.vorher - raum(h, 'eltern').flaeche.nachher, 1.690 * 0.10, 1e-6), 'HAR-Tiefe: Eltern verliert 1,69 × 0,10 m²');
  // HAR Breite 3,01 → 3,10 m: die Ostwand der HAR wandert, Julians Zimmer gibt nach (Maß hängt nur an x.harO.plus).
  const b = lauf([{ mass: 'raum:har.breite', wert: '3,10m' }]);
  check(b.ok && pfadGleich(b.kanten, ['achsen', 'x.harO', 'plus'], 3100), 'HAR-Breite: x.harO.plus = 3100 erwartet, ' + JSON.stringify(b.kanten) + ' ' + kurz(b));
  check(b.ok && raum(b, 'kind2') && raum(b, 'kind2').flaeche.nachher < raum(b, 'kind2').flaeche.vorher, 'HAR-Breite: Julians Zimmer wird kleiner');
  // bewegt: die Wand Nähzimmer / Speisekammer statt der Wand Speisekammer / Küche (9,645 = 11,02 − 0,115 − 1,30)
  const w = lauf([{ mass: 'raum:speis.tiefe', wert: '1,30m', bewegt: 'z.ZS' }], { trotzdem: true });
  check(w.ok && w.kanten.some(k => JSON.stringify(k.pfad) === JSON.stringify(['achsen', 'z.ZS', 'wert']) && k.wert === 9605), 'bewegt z.ZS: z.ZS = 9605 erwartet, ' + JSON.stringify(w.kanten) + ' ' + kurz(w));
  const u = lauf([{ mass: 'raum:speis.tiefe', wert: '1,30m', bewegt: 'x.gibtsnicht' }]);
  check(!u.ok && /bewegt|Parameter/.test(kurz(u)), 'bewegt mit unpassendem Parameter muss abbrechen: ' + kurz(u));
}

/* ---------- gesperrte Außenmaße ---------- */
{
  const s = lauf([{ mass: 'aussen:breite', wert: '13m' }]);
  check(!s.ok && /gesperrt|aussenmass/i.test(kurz(s)), 'Außenmaß ohne aussenmass muss abbrechen: ' + kurz(s));
  check(s.haus === null, 'Außenmaß ohne aussenmass: kein Haus');
  const o = lauf([{ mass: 'aussen:breite', wert: '13m' }], { aussenmass: true });
  check(o.ok && pfadGleich(o.kanten, ['aussenmasse', 'x.O', 'wert'], 13000), 'Außenmaß mit aussenmass: x.O = 13000 erwartet, ' + JSON.stringify(o.kanten) + ' ' + kurz(o));
  const d = lauf([{ achse: 'x.O', wert: '13m' }]);
  check(!d.ok && /gesperrt/i.test(kurz(d)), 'Achse mit fest: true ohne aussenmass muss abbrechen');
  const dg = lauf([{ achse: 'x.O', wert: '13m' }], { aussenmass: true });
  check(dg.ok, 'Achse mit fest: true und aussenmass: ' + kurz(dg));
  const abg = lauf([{ achse: 'z.Ni', wert: '300mm' }]);
  check(!abg.ok && /abgeleitet|ref/i.test(kurz(abg)), 'abgeleitete Achse ist nicht direkt änderbar: ' + kurz(abg));
}

/* ---------- Wanddicke ---------- */
{
  // IW125 (nur Westwand des D-Bads, Außenseite fest bei hx 10,44): 12,5 → 13,5 cm, das D-Bad (Innenmaß 2,00 m) verliert 1 cm × 1,885 m
  const t = lauf([{ mass: 'wand:eg.dbad-west', wert: '13,5cm' }]);
  check(t.ok && pfadGleich(t.kanten, ['wandtypen', 'IW125', 'dicke'], 135), 'Wanddicke: wandtypen.IW125.dicke = 135 erwartet, ' + JSON.stringify(t.kanten) + ' ' + kurz(t));
  check(t.ok && raum(t, 'dbad') && nahe(raum(t, 'dbad').flaeche.vorher - raum(t, 'dbad').flaeche.nachher, 0.01 * 1.885, 1e-6), 'Wanddicke: D-Bad verliert 0,01 × 1,885 m²');
  check(t.ok && t.auswirkungen.raeume.length === 1, 'Wanddicke: nur das D-Bad ändert sich, nicht ' + t.auswirkungen.raeume.map(r => r.id));
  check(t.ok && t.schritte[0].betroffeneWaende === 1, 'Wanddicke: der Wandtyp gilt für 1 Wand: ' + t.schritte[0].betroffeneWaende);
  // IW115 gilt für viele Wände: die Ausgabe nennt die Zahl
  const v = lauf([{ mass: 'wand:eg.eltern-bad', wert: '12cm' }], { trotzdem: true });
  check(v.ok && v.schritte[0].betroffeneWaende > 5, 'Wanddicke IW115: betrifft mehrere Wände, genannt: ' + (v.schritte && v.schritte[0].betroffeneWaende));
  // einzeln: nur diese Wand bekommt eine eigene Dicke
  const e = lauf([{ mass: 'wand:eg.dbad-west', wert: '13,5cm', einzeln: true }]);
  check(e.ok && pfadGleich(e.kanten, ['waende', idx('eg.dbad-west'), 'dicke'], 135), 'Wanddicke einzeln: waende[].dicke = 135 erwartet, ' + JSON.stringify(e.kanten) + ' ' + kurz(e));
  check(e.ok && e.haus.wandtypen.IW125.dicke === 125, 'Wanddicke einzeln: Wandtyp bleibt');
  // Wandtyp mit Schichten (Außenwand) wird nicht über die Gesamtdicke geändert
  const aw = lauf([{ mass: 'wand:eg.aw.nord', wert: '40cm' }]);
  check(!aw.ok && /Schicht/i.test(kurz(aw)), 'Außenwand mit Schichten muss abbrechen: ' + kurz(aw));
}

/* ---------- Öffnungen ---------- */
{
  const o = lauf([{ mass: 'eg.har-sued.oeff1', wert: '90cm' }]);
  check(o.ok && pfadGleich(o.kanten, ['waende', idx('eg.har-sued'), 'oeffnungen', 0, 'breite'], 900), 'Öffnung: Breite 900 erwartet, ' + JSON.stringify(o.kanten) + ' ' + kurz(o));
  check(o.ok && o.auswirkungen.oeffnungen.some(x => x.name === 'eg.har-sued.oeff1' && x.art === 'breite' && x.vorher === 885 && x.nachher === 900), 'Öffnung: Auswirkung 885 → 900');
  const f = lauf([{ oeffnung: 'eg.har-sued.oeff1', feld: 'hoehe', wert: '2,10m' }]);
  check(f.ok && pfadGleich(f.kanten, ['waende', idx('eg.har-sued'), 'oeffnungen', 0, 'hoehe'], 2100), 'Öffnung: Höhe 2100 erwartet, ' + JSON.stringify(f.kanten) + ' ' + kurz(f));
  const ab = lauf([{ oeffnung: 'eg.har-sued.oeff1', feld: 'ab', wert: '2,0m' }]);
  check(ab.ok && pfadGleich(ab.kanten, ['waende', idx('eg.har-sued'), 'oeffnungen', 0, 'ab'], 2000), 'Öffnung: ab 2000 erwartet, ' + JSON.stringify(ab.kanten) + ' ' + kurz(ab));
  const gross = lauf([{ mass: 'eg.har-sued.oeff1', wert: '5m' }]);
  check(!gross.ok && /Öffnung|Wand/.test(kurz(gross)), 'Öffnung breiter als die Wand muss abbrechen: ' + kurz(gross));
  const un = lauf([{ oeffnung: 'eg.har-sued.oeff9', feld: 'breite', wert: '90cm' }]);
  check(!un.ok && /oeff9|Öffnung/.test(kurz(un)), 'unbekannte Öffnung muss abbrechen: ' + kurz(un));
  const fe = lauf([{ oeffnung: 'eg.har-sued.oeff1', feld: 'farbe', wert: '90cm' }]);
  check(!fe.ok && /Feld|farbe/.test(kurz(fe)), 'unbekanntes Feld muss abbrechen: ' + kurz(fe));
  // Pfeiler: Südwand, Terrassentür ab Ostecke 6055 (läuft nach Westen). Pfeiler 1 (Westecke bis Tür) ist 385 mm; 500 mm heißt, die Tür rückt 115 mm
  // nach Osten, also ab = 6055 − 115 = 5940. Der Pfeiler auf der anderen Seite (Ostecke bis Tür) ist dann 5940 mm.
  const p = lauf([{ mass: 'eg.aw.sued.pfeiler1', wert: '50cm' }]);
  check(p.ok && pfadGleich(p.kanten, ['waende', idx('eg.aw.sued'), 'oeffnungen', 0, 'ab'], 5940), 'Pfeiler: ab = 5940 erwartet, ' + JSON.stringify(p.kanten) + ' ' + kurz(p));
  check(p.ok && masz(p, 'eg.aw.sued.pfeiler2') && masz(p, 'eg.aw.sued.pfeiler2').nachher === 5940, 'Pfeiler: der Pfeiler auf der anderen Seite gibt nach (5940)');
  check(p.ok && masz(p, 'eg.aw.sued.oeff1') === undefined, 'Pfeiler: die Öffnung behält ihre Breite');
}

/* ---------- direkte Änderungen ---------- */
{
  const a = lauf([{ achse: 'z.speisS', wert: '11,06m' }]);
  check(a.ok && pfadGleich(a.kanten, ['achsen', 'z.speisS', 'wert'], 11060), 'Achse direkt: wie das Beispiel, ' + JSON.stringify(a.kanten) + ' ' + kurz(a));
  const wt = lauf([{ wandtyp: 'IW125', wert: '135mm' }]);
  check(wt.ok && pfadGleich(wt.kanten, ['wandtypen', 'IW125', 'dicke'], 135), 'Wandtyp direkt: ' + JSON.stringify(wt.kanten) + ' ' + kurz(wt));
  const sch = lauf([{ wandtyp: 'AW', wert: '40cm' }], { aussenmass: true });
  check(!sch.ok && /Schicht/i.test(kurz(sch)), 'Wandtyp mit Schichten: ' + kurz(sch));
  const un = lauf([{ wandtyp: 'XX', wert: '10cm' }]);
  check(!un.ok && /XX/.test(kurz(un)), 'unbekannter Wandtyp: ' + kurz(un));
  const ua = lauf([{ achse: 'x.gibtsnicht', wert: '1m' }]);
  check(!ua.ok && /gibtsnicht/.test(kurz(ua)), 'unbekannte Achse: ' + kurz(ua));
  const um = lauf([{ mass: 'raum:gibtsnicht.tiefe', wert: '1m' }]);
  check(!um.ok && /gibtsnicht/.test(kurz(um)), 'unbekanntes Maß: ' + kurz(um));
  const we = lauf([{ wandende: 'eg.dbad-west.mitte', wert: 5000 }]);
  check(!we.ok && /von|bis/.test(kurz(we)), 'Wandende muss von oder bis heißen: ' + kurz(we));
  const sw = lauf([{ wandende: 'eg.julian-flur-schraeg.bis', wert: 5000 }]);
  check(!sw.ok && /schräg|achsparallel/i.test(kurz(sw)), 'Schrägwand: Ende nicht änderbar: ' + kurz(sw));
  const ue = lauf([{ mass: 'raum:speis.tiefe', wert: '1,30' }]);
  check(!ue.ok && /Einheit/.test(kurz(ue)), 'Wert ohne Einheit muss abbrechen: ' + kurz(ue));
}

/* ---------- mehrere Änderungen, unverändert ---------- */
{
  // zwei unabhängige Änderungen nacheinander
  const z = lauf([{ mass: 'raum:speis.tiefe', wert: '1,30m' }, { mass: 'raum:har.tiefe', wert: '3,05m' }]);
  check(z.ok && z.schritte.length === 2 && z.kanten.length === 2, 'zwei Änderungen: ' + kurz(z));
  check(z.ok && z.haus.achsen['z.speisS'].wert === 11060 && z.haus.achsen['z.harSi'].plus === 3050, 'zwei Änderungen: beide stehen im neuen Haus');
  // jede Änderung wirkt auf den Stand nach der vorigen: die zweite findet das Maß schon erfüllt
  const folge = lauf([{ achse: 'z.speisS', wert: '11,06m' }, { mass: 'raum:speis.tiefe', wert: '1,30m' }]);
  check(folge.ok && folge.kanten.length === 1 && folge.schritte[1].unveraendert === true, 'Folgeänderung auf dem Stand nach der ersten: ' + kurz(folge));
  // dieselbe Stelle zweimal: die Änderungsliste fasst zusammen, und eine Rückkehr zum Ausgangswert ist keine Änderung
  const zurueck = lauf([{ achse: 'z.speisS', wert: '11,06m' }, { achse: 'z.speisS', wert: '11,02m' }]);
  check(zurueck.ok && zurueck.kanten.length === 0, 'Rückkehr zum Ausgangswert ergibt keine Änderung: ' + JSON.stringify(zurueck.kanten));
  const gleich = lauf([{ mass: 'raum:speis.tiefe', wert: '1,26m' }]);
  check(gleich.ok && gleich.kanten.length === 0 && /unverändert/i.test(kurz(gleich)), 'unverändertes Maß: keine Änderung, Hinweis "unverändert": ' + kurz(gleich));
  check(gleich.ok && gleich.auswirkungen.raeume.length === 0, 'unverändertes Maß: keine Auswirkungen');
  const leer = lauf([]);
  check(!leer.ok && /keine|leer/i.test(kurz(leer)), 'leere Liste: ' + kurz(leer));
  // ein fehlerhafter Schritt bricht alles ab, auch wenn der erste in Ordnung ist
  const halb = lauf([{ mass: 'raum:speis.tiefe', wert: '1,30m' }, { mass: 'raum:gibtsnicht.tiefe', wert: '1m' }]);
  check(!halb.ok && halb.haus === null, 'ein fehlerhafter Schritt bricht alle ab');
}

/* ---------- Änderungsliste (Export der Seite) ---------- */
{
  const liste = A.listeErzeugen(haus, [{ mass: 'raum:speis.tiefe', wert: 1300 }]);
  check(liste.format === 'haus-aenderungen' && liste.version === 1 && typeof liste.stand === 'string' && liste.stand.length >= 8, 'Liste: Format, Version, Stand');
  check(liste.stand === A.stand(haus), 'Liste: Stand ist die Prüfsumme der Daten');
  check(A.stand(haus) !== A.stand(speis.haus), 'Prüfsumme ändert sich mit den Daten');
  check(A.stand(haus) === A.stand(klon(haus)), 'Prüfsumme ist stabil');
  const gelesen = A.listeLesen(JSON.stringify(liste), haus);
  check(Array.isArray(gelesen) && gelesen.length === 1 && gelesen[0].mass === 'raum:speis.tiefe' && gelesen[0].wert === 1300, 'Liste lesen: Text und Objekt');
  const r = lauf(gelesen);
  check(r.ok && JSON.stringify(r.kanten) === JSON.stringify(speis.kanten), 'Liste einspielen ergibt dieselbe Änderung wie das Maß direkt');
  const ablehnen = (o, muster, msg) => wirft(() => A.listeLesen(typeof o === 'string' ? o : JSON.stringify(o), haus), muster, msg);
  const gut = () => klon(liste);
  { const l = gut(); l.format = 'anderes'; ablehnen(l, /Format/, 'falsches Format'); }
  { const l = gut(); l.version = 2; ablehnen(l, /Version/, 'falsche Version'); }
  { const l = gut(); l.stand = 'abc'; ablehnen(l, /Stand|stand/, 'falscher Stand'); }
  { const l = gut(); delete l.stand; ablehnen(l, /Stand|stand/, 'fehlender Stand'); }
  { const l = gut(); l.aenderungen = []; ablehnen(l, /keine|leer/i, 'leere Liste'); }
  { const l = gut(); l.aenderungen = 'x'; ablehnen(l, /aenderungen|Liste/, 'Änderungen keine Liste'); }
  { const l = gut(); l.aenderungen[0].wert = '1,30'; ablehnen(l, /Einheit/, 'Wert ohne Einheit'); }
  { const l = gut(); l.aenderungen[0].extra = 1; ablehnen(l, /extra|unbekannt/i, 'unbekanntes Feld'); }
  { const l = gut(); l.aenderungen[0] = { mass: 'raum:speis.tiefe' }; ablehnen(l, /wert/, 'Wert fehlt'); }
  { const l = gut(); l.aenderungen[0] = { wert: 1300 }; ablehnen(l, /Art|mass|achse/i, 'Art der Änderung fehlt'); }
  { const l = gut(); l.aenderungen[0] = { mass: 'a', achse: 'b', wert: 1 }; ablehnen(l, /Art|genau/i, 'zwei Arten in einer Änderung'); }
  ablehnen('{ kein json', /JSON|lesbar/i, 'kein JSON');
  ablehnen('[1,2]', /Format/, 'Liste ohne Rahmen');
  const l = gut(); l.aenderungen[0].mass = 'raum:gibtsnicht.tiefe';
  const bad = lauf(A.listeLesen(l, haus));
  check(!bad.ok && /gibtsnicht/.test(kurz(bad)), 'unbekanntes Maß in der Liste: Abbruch beim Anwenden');
  // Stand ignorieren nur ausdrücklich
  const alt = klon(liste); alt.stand = 'abc12345';
  check(A.listeLesen(alt, haus, { standIgnorieren: true }).length === 1, 'Stand ignorieren nur mit Option');
}

/* ---------- Text von haus.json patchen ---------- */
{
  const t = A.textPatchen(HAUS_TEXT, speis.kanten);
  const zeilenAlt = HAUS_TEXT.split('\n'), zeilenNeu = t.split('\n');
  const unterschied = zeilenAlt.map((z, i) => z !== zeilenNeu[i] ? i : -1).filter(i => i >= 0);
  check(zeilenAlt.length === zeilenNeu.length && unterschied.length === 1, 'Text: genau eine Zeile ändert sich, nicht ' + unterschied.length);
  check(unterschied.length === 1 && /"z\.speisS": \{ "wert": 11060, "quelle": "plan"/.test(zeilenNeu[unterschied[0]]), 'Text: Zeile behält Aufbau und Notiz: ' + (unterschied.length ? zeilenNeu[unterschied[0]] : ''));
  check(JSON.stringify(JSON.parse(t)) === JSON.stringify(speis.haus), 'Text: Ergebnis entspricht dem neuen Haus');
  // Wandende (Array-Element), neuer Schlüssel (einzeln), Öffnung und Wandtyp
  const mehr = lauf([{ wandende: 'eg.dbad-west.bis', wert: 'z.flurS' }, { mass: 'wand:eg.dbad-west', wert: '13,5cm', einzeln: true }, { mass: 'eg.har-sued.oeff1', wert: '90cm' }, { wandtyp: 'IW175', wert: '180mm' }], { trotzdem: true });
  const t2 = A.textPatchen(HAUS_TEXT, mehr.kanten);
  try { require('assert').deepStrictEqual(JSON.parse(t2), mehr.haus); } catch (e) { fails.push('Text: mehrere Stellen, neuer Schlüssel, Array-Element entsprechen nicht dem neuen Haus'); }
  const n = HAUS_TEXT.split('\n').filter((z, i) => z !== t2.split('\n')[i]).length;
  check(n <= 4, 'Text: höchstens vier Zeilen geändert, nicht ' + n);
  // Schlüssel entfernen: einzeln wieder zurücknehmen (wert null bei einzeln)
  const ohne = A.textPatchen(t2, [{ pfad: ['waende', idx('eg.dbad-west'), 'dicke'], entfernen: true }]);
  check(JSON.parse(ohne).waende[idx('eg.dbad-west')].dicke === undefined && Object.keys(JSON.parse(ohne).waende[idx('eg.dbad-west')]).length === Object.keys(haus.waende[idx('eg.dbad-west')]).length, 'Text: Schlüssel entfernen');
  wirft(() => A.textPatchen(HAUS_TEXT, [{ pfad: ['achsen', 'gibt.es.nicht', 'wert'], wert: 1 }]), /Pfad|Stelle/, 'Text: Pfad nicht gefunden');
}

/* ---------- Vergleichs-SVG ---------- */
{
  const svg = A.vergleichSvg(speis, 'EG');
  check(/<svg[\s>]/.test(svg) && /vergleich/.test(svg) && /stroke-dasharray/.test(svg), 'Vergleichs-SVG enthält den gestrichelten alten Umriss');
  check(/data-geschoss="EG"/.test(svg), 'Vergleichs-SVG: Geschoss');
}

/* ---------- Herkunft des neuen Werts ---------- */
{
  // z.harSi trägt quelle "aufmass": ohne Angabe bleibt sie stehen, die Ausgabe weist darauf hin
  const o = lauf([{ mass: 'raum:har.tiefe', wert: '3,05m' }]);
  check(o.ok && o.schritte[0].herkunft && o.schritte[0].herkunft.quelle === 'aufmass' && o.schritte[0].herkunft.gesetzt === false, 'Herkunft bleibt "aufmass": ' + JSON.stringify(o.schritte[0].herkunft));
  check(o.meldungen.some(m => /Herkunft/.test(m) && /aufmass/.test(m)), 'Hinweis auf die stehen gebliebene Herkunft fehlt: ' + kurz(o));
  const q = lauf([{ mass: 'raum:har.tiefe', wert: '3,05m', quelle: 'nutzer' }]);
  check(q.ok && q.kanten.length === 2 && q.kanten.some(k => JSON.stringify(k.pfad) === JSON.stringify(['achsen', 'z.harSi', 'quelle']) && k.wert === 'nutzer'), 'Herkunft setzen: quelle = nutzer erwartet, ' + JSON.stringify(q.kanten));
  check(q.ok && !q.meldungen.some(m => /Hinweis/.test(m)), 'Herkunft gesetzt: kein Hinweis mehr');
  const t = A.textPatchen(HAUS_TEXT, q.kanten), z = t.split('\n').filter(l => /"z\.harSi"/.test(l))[0];
  check(/"plus": 3050, "quelle": "nutzer"/.test(z), 'Text: plus und quelle in einer Zeile: ' + z);
  // Öffnung ohne quelle: der Schlüssel entsteht neu
  const e = lauf([{ mass: 'eg.har-sued.oeff1', wert: '90cm', quelle: 'nutzer' }]);
  check(e.ok && e.haus.waende[idx('eg.har-sued')].oeffnungen[0].quelle === 'nutzer', 'Herkunft der Öffnung wird gesetzt');
  check(e.ok && (() => { try { require('assert').deepStrictEqual(JSON.parse(A.textPatchen(HAUS_TEXT, e.kanten)), e.haus); return true; } catch (x) { return false; } })(), 'Text: Herkunft einer Öffnung (Quelle war schon "aufmass" im Text) entspricht dem neuen Haus');
  const w = lauf([{ mass: 'raum:har.tiefe', wert: '3,05m', quelle: 'gerade so' }]);
  check(!w.ok && /Herkunft/.test(kurz(w)), 'unbekannte Herkunft muss abbrechen: ' + kurz(w));
  wirft(() => A.listeLesen(A.listeErzeugen(haus, [{ achse: 'z.speisS', wert: 1, quelle: 'x' }]), haus), /Herkunft/, 'unbekannte Herkunft in der Liste');
  wirft(() => A.aenderungPruefen({ wandende: 'eg.dbad-west.bis', wert: 1, quelle: 'nutzer' }, haus), /quelle/, 'Wandende hat keine Herkunft');
}

/* ---------- Befehlszeile ---------- */
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aendern-')), datei = path.join(dir, 'haus.json');
  const setze = () => fs.writeFileSync(datei, HAUS_TEXT);
  const cli = (...a) => spawnSync('node', [path.join(__dirname, 'aendern.js'), '--datei', datei, ...a], { encoding: 'utf8' });
  const text = () => fs.readFileSync(datei, 'utf8');
  setze();
  let r = cli('raum:speis.tiefe=1,30m');
  check(r.status === 0, 'CLI Beispiel: Exit 0 erwartet, ' + r.status + ' ' + r.stdout + r.stderr);
  check(text() === A.textPatchen(HAUS_TEXT, speis.kanten), 'CLI Beispiel: haus.json entspricht dem Textpatch');
  check(/z\.speisS/.test(r.stdout) && /Speisekammer/.test(r.stdout) && /Küche/.test(r.stdout), 'CLI Beispiel: Ausgabe nennt Parameter und Räume: ' + r.stdout);
  setze();
  r = cli('--trockenlauf', 'raum:speis.tiefe=1,30m');
  check(r.status === 0 && text() === HAUS_TEXT, 'CLI --trockenlauf schreibt nichts');
  r = cli('raum:speis.tiefe=1,30');
  check(r.status === 1 && /Einheit/.test(r.stdout + r.stderr) && text() === HAUS_TEXT, 'CLI ohne Einheit: Abbruch ohne Änderung: ' + r.stdout + r.stderr);
  r = cli('wandende:eg.dbad-west.bis=z.flurS');
  check(r.status === 1 && text() === HAUS_TEXT && /Fehler/.test(r.stdout + r.stderr), 'CLI Gegenbeispiel: Abbruch, haus.json unberührt: ' + r.stdout + r.stderr);
  r = cli('--trotzdem', 'wandende:eg.dbad-west.bis=z.flurS');
  check(r.status === 0 && text() !== HAUS_TEXT, 'CLI Gegenbeispiel mit --trotzdem wird geschrieben');
  setze();
  r = cli('aussen:breite=13m');
  check(r.status === 1 && text() === HAUS_TEXT && /aussenmass/.test(r.stdout + r.stderr), 'CLI Außenmaß ohne --aussenmass: Abbruch');
  r = cli('--aussenmass', 'aussen:breite=13m');
  check(r.status === 0 && JSON.parse(text()).aussenmasse['x.O'].wert === 13000, 'CLI --aussenmass: x.O = 13000');
  setze();
  r = cli('--einzeln', 'wand:eg.dbad-west=13,5cm');
  check(r.status === 0 && JSON.parse(text()).waende[idx('eg.dbad-west')].dicke === 135, 'CLI --einzeln');
  setze();
  r = cli('--bewegt', 'z.ZS', '--trotzdem', 'raum:speis.tiefe=1,30m');
  check(r.status === 0 && JSON.parse(text()).achsen['z.ZS'].wert === 9605, 'CLI --bewegt: ' + r.stdout + r.stderr);
  setze();
  r = cli('--quelle', 'nutzer', 'raum:har.tiefe=3,05m');
  check(r.status === 0 && JSON.parse(text()).achsen['z.harSi'].quelle === 'nutzer', 'CLI --quelle: ' + r.stdout + r.stderr);
  setze();
  r = cli('achse:z.speisS=11,06m', 'wandtyp:IW125=135mm');
  check(r.status === 0 && JSON.parse(text()).achsen['z.speisS'].wert === 11060 && JSON.parse(text()).wandtypen.IW125.dicke === 135, 'CLI achse: und wandtyp: ' + r.stdout + r.stderr);
  setze();
  r = cli('oeffnung:eg.har-sued.oeff1.breite=90cm');
  check(r.status === 0 && JSON.parse(text()).waende[idx('eg.har-sued')].oeffnungen[0].breite === 900, 'CLI oeffnung: ' + r.stdout + r.stderr);
  setze();
  r = cli();
  check(r.status === 2 && /Aufruf/.test(r.stdout + r.stderr), 'CLI ohne Angaben zeigt den Aufruf (Exit 2)');
  r = cli('unsinn');
  check(r.status === 2, 'CLI Angabe ohne = : Exit 2');
  // Vergleichs-SVG in einen Ordner schreiben
  const vdir = path.join(dir, 'vergleich');
  r = cli('--vergleich', vdir, 'raum:speis.tiefe=1,30m');
  check(r.status === 0 && fs.existsSync(path.join(vdir, 'vergleich-eg.svg')), 'CLI --vergleich schreibt vergleich-eg.svg: ' + r.stdout + r.stderr);
  setze();
  // Änderungsliste einspielen
  const listeDatei = path.join(dir, 'liste.json'), hausObj = JSON.parse(HAUS_TEXT);
  fs.writeFileSync(listeDatei, JSON.stringify(A.listeErzeugen(hausObj, [{ mass: 'raum:speis.tiefe', wert: 1300 }])));
  r = cli('--liste', listeDatei);
  check(r.status === 0 && text() === A.textPatchen(HAUS_TEXT, speis.kanten), 'CLI --liste spielt die Änderungsliste ein: ' + r.stdout + r.stderr);
  r = cli('--liste', listeDatei); // haus.json hat sich geändert: Stand passt nicht mehr
  check(r.status === 1 && /Stand/.test(r.stdout + r.stderr), 'CLI --liste mit altem Stand wird abgelehnt: ' + r.stdout + r.stderr);
  setze();
  fs.writeFileSync(listeDatei, '{ "format": "haus-aenderungen" }');
  r = cli('--liste', listeDatei);
  check(r.status === 1 && text() === HAUS_TEXT, 'CLI --liste mit ungültiger Liste wird abgelehnt: ' + r.stdout + r.stderr);
  r = cli('--liste', path.join(dir, 'gibtsnicht.json'));
  check(r.status === 1, 'CLI --liste mit fehlender Datei: Exit 1');
}

/* ---------- Höhen (Phase 5): lichte Höhe, Deckenaufbau, Geschosshöhe, Traufe, Kniewand, Brüstung, Höhe und Sturz ---------- */
// Geschosshöhe OKFF–OKFF = lichte Höhe + Deckenaufbau (Regel 10): 2525 + 446 = 2971; die Geschosshöhe ist gesperrt (Treppenplanung), der Deckenaufbau gibt nach.
{
  const r = lauf([{ mass: 'hoehe:eg.lichte', wert: '2,40m' }]);
  check(r.ok, 'lichte Höhe 2,40 m bricht ab: ' + kurz(r));
  check(r.haus && r.haus.geschosse.EG.lichteHoehe === 2400 && r.haus.geschosse.DG.deckenaufbau === 571 && r.haus.geschosse.DG.okff === 2971, 'lichte Höhe 2,40 m: Deckenaufbau gibt nach (571), Geschosshöhe bleibt 2971: ' + JSON.stringify(r.haus && r.haus.geschosse));
  check(r.kanten.length === 2, 'lichte Höhe: zwei geänderte Stellen (lichteHoehe, deckenaufbau), nicht ' + r.kanten.length);
  const hw = (res, n) => (res.auswirkungen.hoehen || []).filter(h => h.name === n)[0];
  check(hw(r, 'hoehe:eg.lichte') && hw(r, 'hoehe:eg.lichte').vorher === 2525 && hw(r, 'hoehe:eg.lichte').nachher === 2400, 'Auswirkung lichte Höhe 2525 → 2400: ' + JSON.stringify(r.auswirkungen.hoehen));
  check(hw(r, 'hoehe:dg.deckenaufbau') && hw(r, 'hoehe:dg.deckenaufbau').nachher === 571, 'Auswirkung Deckenaufbau 446 → 571');
  check(r.befunde.neu.filter(b => b.stufe === 'fehler').length === 0, 'lichte Höhe 2,40 m: keine neuen Fehler: ' + r.befunde.neu.map(b => b.text));
  check(/Höhen/.test(A.auswirkungenText(r)), 'Ausgabe nennt die Höhen');
  check(r.auswirkungen.wohnflaeche == null, 'lichte Höhe 2,40 m ändert die Wohnfläche nicht (WoFlV kennt im EG nur ≥ 2 m): ' + JSON.stringify(r.auswirkungen.wohnflaeche));
  check(haus.geschosse.EG.lichteHoehe === 2525, 'Eingabedaten dürfen nicht verändert werden');
}
{ // Die Haustür ist 2,375 m hoch: bei 2,30 m lichter Höhe liegt ihr Sturz über der Decke (Regel 12)
  const r = lauf([{ mass: 'hoehe:eg.lichte', wert: '2,30m' }]);
  check(!r.ok && r.haus === null && /Abbruch/.test(kurz(r)) && r.befunde.fehlerNeu.some(b => b.regel === 12), 'lichte Höhe 2,30 m muss an der Türhöhe 2,375 m abbrechen: ' + kurz(r));
  check(lauf([{ mass: 'hoehe:eg.lichte', wert: '2,30m' }], { trotzdem: true }).ok, 'mit trotzdem wird gespeichert');
}
{
  const r = lauf([{ mass: 'hoehe:dg.deckenaufbau', wert: '500mm' }]);
  check(r.ok && r.haus.geschosse.DG.deckenaufbau === 500 && r.haus.geschosse.EG.lichteHoehe === 2471, 'Deckenaufbau 500 mm: die lichte Höhe gibt nach (2471): ' + kurz(r));
  const neg = lauf([{ mass: 'hoehe:dg.deckenaufbau', wert: '3m' }]);
  check(!neg.ok && /negativ|größer/.test(kurz(neg)), 'Deckenaufbau 3 m (größer als die Geschosshöhe) wird abgelehnt: ' + kurz(neg));
  const nul = lauf([{ mass: 'hoehe:eg.lichte', wert: '0mm' }]);
  check(!nul.ok, 'lichte Höhe 0 wird abgelehnt');
}
{ // Geschosshöhe: gesperrt, nur mit aussenmass; 3,00 m → Steigung 3000 / 15 = 200 mm, Deckenaufbau 3000 − 2525 = 475
  const ohneFreigabe = lauf([{ mass: 'hoehe:dg.okff', wert: '3,00m' }]);
  check(!ohneFreigabe.ok && /gesperrt/.test(kurz(ohneFreigabe)) && /aussenmass/.test(kurz(ohneFreigabe)), 'Geschosshöhe ist gesperrt: ' + kurz(ohneFreigabe));
  const r = lauf([{ mass: 'hoehe:dg.okff', wert: '3,00m' }], { aussenmass: true });
  check(r.ok && r.haus.geschosse.DG.okff === 3000 && r.haus.geschosse.DG.deckenaufbau === 475 && r.haus.geschosse.EG.lichteHoehe === 2525, 'Geschosshöhe 3,00 m: OKFF DG 3000, Deckenaufbau 475: ' + kurz(r));
  const st = (r.auswirkungen.hoehen || []).filter(h => h.name === 'treppe.steigung')[0];
  check(st && nahe(st.vorher, 2971 / 15, 1e-6) && nahe(st.nachher, 200, 1e-6), 'Auswirkung Steigung 198,07 → 200 mm: ' + JSON.stringify(st));
}
{ // Traufe: der First steigt mit (Neigung bleibt, Überstand bleibt)
  const r = lauf([{ mass: 'hoehe:dach.traufe', wert: '3,10m' }]);
  check(r.ok && r.haus.dach.traufe === 3100, 'Traufe 3,10 m: ' + kurz(r));
  const f = (r.auswirkungen.hoehen || []).filter(h => h.name === 'hoehe:dach.first')[0];
  check(f && nahe(f.nachher - f.vorher, 130, 1e-6), 'Der First steigt um 130 mm mit der Traufe: ' + JSON.stringify(f));
  check(r.befunde.neu.some(b => b.regel === 15), 'Der berechnete First weicht nun vom Plan (149,08 m ü. NN) ab: Regel 15');
  const ue = lauf([{ mass: 'hoehe:dach.ueberstand', wert: '30cm' }]);
  check(ue.ok && ue.haus.dach.ueberstand === 300, 'Dachüberstand 30 cm: ' + kurz(ue));
  check(!lauf([{ mass: 'hoehe:dach.first', wert: '6,5m' }]).ok && /abgeleitet/.test(kurz(lauf([{ mass: 'hoehe:dach.first', wert: '6,5m' }]))), 'Der First ist abgeleitet und nicht änderbar');
}
{ // Kniewände: eine Wand oder alle. Die Höhe ist ein Höchstwert; die Dachhaut abzüglich Sparrenabstand (22 cm) begrenzt sie an den Enden der Wand
  const r = lauf([{ mass: 'hoehe:dg.kniewand-west', wert: '1,20m' }]);
  const w = id => r.haus.waende[idx(id)];
  check(r.ok && w('dg.kniewand-west').hoehe.max === 1200 && w('dg.kniewand-nord').hoehe.max === 1000, 'Kniewand West 1,20 m, die anderen bleiben: ' + kurz(r));
  check(/Dachhaut/.test(kurz(r)) && (r.auswirkungen.hoehen || []).every(h => h.name !== 'hoehe:dg.kniewand-west'), 'Die Dachhaut begrenzt die West-Kniewand schon bei etwa 0,97 m: Hinweis, keine Höhenänderung: ' + kurz(r));
  const tiefer = lauf([{ mass: 'hoehe:dg.kniewand-west', wert: '0,80m' }]);
  const k = (tiefer.auswirkungen.hoehen || []).filter(h => h.name === 'hoehe:dg.kniewand-west')[0];
  check(tiefer.ok && tiefer.haus.waende[idx('dg.kniewand-west')].hoehe.max === 800 && k && nahe(k.nachher, 800, 1e-6) && k.vorher < 1000, 'Kniewand West 0,80 m: niedrigste Oberkante ' + JSON.stringify(k));
  check(tiefer.befunde.neu.some(b => b.regel === 13), 'Kniewand unter 0,95 m: Regel 13 meldet');
  const alle = lauf([{ mass: 'hoehe:dg.kniewand', wert: '1,10m' }]);
  check(alle.ok && alle.haus.dg.kniewandSoll === 1100 && alle.haus.waende.filter(x => x.hoehe && x.hoehe.max != null).every(x => x.hoehe.max === 1100), 'Alle Kniewände 1,10 m samt Sollwert: ' + kurz(alle));
}
{ // Öffnungen: Brüstung, Höhe, Sturz (bis zur Decke, 2525)
  const nord = 'eg.aw.nord', i = idx(nord);
  const br = lauf([{ mass: nord + '.oeff2.bruestung', wert: '1,00m' }]);
  check(br.ok && br.haus.waende[i].oeffnungen[1].bruestung === 1000 && br.haus.waende[i].oeffnungen[1].hoehe === 1250, 'Brüstung 1,00 m: ' + kurz(br));
  const h = lauf([{ mass: nord + '.oeff2.hoehe', wert: '1,30m' }]);
  check(h.ok && h.haus.waende[i].oeffnungen[1].hoehe === 1300, 'Höhe 1,30 m: ' + kurz(h));
  const sturz = lauf([{ mass: nord + '.oeff2.sturz', wert: '100mm' }]);
  check(sturz.ok && sturz.haus.waende[i].oeffnungen[1].hoehe === 1300 && sturz.haus.waende[i].oeffnungen[1].bruestung === 1125, 'Sturz 100 mm: Höhe = 2525 − 100 − 1125 = 1300: ' + kurz(sturz));
  const zuHoch = lauf([{ mass: nord + '.oeff2.hoehe', wert: '1,50m' }]);
  check(!zuHoch.ok && zuHoch.befunde.fehlerNeu.some(b => b.regel === 12), 'Fenster bis 2,625 m liegt über der Decke (Regel 12): ' + kurz(zuHoch));
  const neg = lauf([{ mass: nord + '.oeff2.sturz', wert: '-5cm' }]);
  check(!neg.ok && /negativ|Sturz/.test(kurz(neg)), 'negativer Sturz wird abgelehnt: ' + kurz(neg));
  const tuer = lauf([{ mass: nord + '.oeff1.sturz', wert: '10cm' }]);
  check(tuer.ok && tuer.haus.waende[i].oeffnungen[0].hoehe === 2425, 'Tür ohne Brüstung: Sturz 10 cm → Höhe 2425: ' + kurz(tuer));
  check(!lauf([{ mass: 'hoehe:gibtsnicht', wert: '1m' }]).ok && /unbekannt/.test(kurz(lauf([{ mass: 'hoehe:gibtsnicht', wert: '1m' }]))), 'unbekanntes Höhenmaß');
  check(!lauf([{ mass: 'hoehe:eg.lichte', wert: '2,40m', einzeln: true }]).ok, 'einzeln gilt nicht für Höhen');
}
{ // Änderungsliste mit Höhen und Schnitt der Ableitung
  const liste = A.listeErzeugen(haus, [{ mass: 'hoehe:eg.lichte', wert: '2,40m' }, { mass: 'hoehe:dach.traufe', wert: '3,05m' }]);
  const res = A.aendern(haus, A.listeLesen(liste, haus));
  check(res.ok && res.haus.dach.traufe === 3050 && res.haus.geschosse.EG.lichteHoehe === 2400, 'Änderungsliste mit zwei Höhen: ' + kurz(res));
  const D = A.ableiten(res.haus);
  check(D.schnitte().map(l => l.id).join() === 'A,B', 'Schnittlinien der Ableitung: ' + D.schnitte().map(l => l.id));
  const sA = D.schnitt('A');
  check(sA.koten.deckeUK === 2400 && sA.koten.traufe === 3050, 'Der Schnitt folgt den geänderten Höhen: ' + JSON.stringify(sA.koten));
  check(D.ansicht('N').seite === 'N' && D.ansicht('N').koten.traufe === 3050, 'Die Ansicht folgt den geänderten Höhen');
  wirft(() => D.schnitt('Z'), /Schnitt.*unbekannt/, 'unbekannter Schnitt');
}
{ // Befehlszeile
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haus-hoehen-')), datei = path.join(dir, 'haus.json');
  fs.writeFileSync(datei, HAUS_TEXT);
  const cli = (...a) => spawnSync(process.execPath, [path.join(__dirname, 'aendern.js'), '--datei', datei, ...a], { encoding: 'utf8' });
  let r = cli('hoehe:eg.lichte=2,40m');
  const neu = fs.readFileSync(datei, 'utf8');
  check(r.status === 0 && JSON.parse(neu).geschosse.EG.lichteHoehe === 2400 && /Höhen/.test(r.stdout), 'CLI hoehe:eg.lichte: ' + r.stdout + r.stderr);
  check(neu.split('\n').length === HAUS_TEXT.split('\n').length, 'CLI: Zeilenzahl bleibt, geändert werden nur die betroffenen Stellen');
  fs.writeFileSync(datei, HAUS_TEXT);
  r = cli('hoehe:dg.okff=3,00m');
  check(r.status === 1 && /gesperrt/.test(r.stdout + r.stderr) && fs.readFileSync(datei, 'utf8') === HAUS_TEXT, 'CLI hoehe:dg.okff ohne --aussenmass wird abgelehnt: ' + r.stdout + r.stderr);
  r = cli('--aussenmass', 'hoehe:dg.okff=3,00m');
  check(r.status === 0 && JSON.parse(fs.readFileSync(datei, 'utf8')).geschosse.DG.okff === 3000, 'CLI hoehe:dg.okff mit --aussenmass: ' + r.stdout + r.stderr);
}

{ // Aufmaß bestätigt einen Wert (Phase 6): gleicher Wert mit Herkunft setzt nur die Herkunft des Parameters, den eine Änderung bewegen würde
  const h = lauf([{ mass: 'raum:speis.tiefe', wert: '1,26m', quelle: 'aufmass' }]);
  check(h.ok && h.kanten.length === 1 && pfadGleich(h.kanten, ['achsen', 'z.speisS', 'quelle'], 'aufmass'), 'Herkunft ohne Wertänderung: nur die quelle der Achse z.speisS ändert sich: ' + JSON.stringify(h.kanten) + kurz(h));
  check(JSON.stringify(h.haus.achsen['z.speisS']).replace(/"quelle":"aufmass"/, '"quelle":"plan"') === JSON.stringify(haus.achsen['z.speisS']), 'Der Wert der Achse bleibt');
  check(h.auswirkungen.raeume.length === 0 && h.auswirkungen.waende.length === 0, 'Keine Auswirkung auf Räume und Wände');
  check(!/Alles unverändert/.test(kurz(h)) && /Herkunft/.test(kurz(h)), 'Die Ausgabe nennt die Herkunft statt "Alles unverändert": ' + kurz(h));
  // dieselbe Wahl des Parameters wie bei einer echten Änderung des Maßes
  const echt = lauf([{ mass: 'raum:speis.tiefe', wert: '1,30m', quelle: 'aufmass' }]);
  check(echt.kanten[0].pfad[1] === h.kanten[0].pfad[1] && echt.kanten[0].pfad[1] === 'z.speisS', 'Gleicher Parameter wie bei einer echten Änderung: ' + JSON.stringify(echt.kanten[0].pfad));
  // ohne Herkunft bleibt es "unverändert"
  const o = lauf([{ mass: 'raum:speis.tiefe', wert: '1,26m' }]);
  check(o.ok && o.kanten.length === 0 && /Alles unverändert/.test(kurz(o)), 'Ohne Herkunft: unverändert');
  // Öffnung: Fenster der Nordwand 1,01 m (Plan, Kette oben) bestätigt als Aufmaß; Öffnung, die schon Aufmaß ist: nichts zu schreiben
  const oe = lauf([{ mass: 'eg.aw.nord.oeff1', wert: '101cm', quelle: 'aufmass' }]);
  check(oe.ok && oe.kanten.length === 1 && oe.kanten[0].pfad.slice(-1)[0] === 'quelle' && oe.kanten[0].wert === 'aufmass' && oe.haus.waende[idx('eg.aw.nord')].oeffnungen[0].breite === 1010, 'Öffnung bestätigt: ' + JSON.stringify(oe.kanten) + kurz(oe));
  check(lauf([{ mass: 'eg.har-sued.oeff1', wert: '88,5cm', quelle: 'aufmass' }]).kanten.length === 0, 'Öffnung mit gleicher Herkunft: keine Stelle zu ändern');
  // gesperrte Außenmaße bleiben gesperrt, auch für die Herkunft; mit aussenmass geht es
  check(!lauf([{ mass: 'aussen:breite', wert: '12,95m', quelle: 'aufmass' }]).ok, 'Außenmaß: Herkunft nur mit aussenmass');
  const am = lauf([{ mass: 'aussen:breite', wert: '12,95m', quelle: 'aufmass' }], { aussenmass: true });
  check(am.ok && am.kanten.length === 1 && am.kanten[0].pfad.slice(-1)[0] === 'quelle', 'Außenmaß mit aussenmass: ' + JSON.stringify(am.kanten) + kurz(am));
  // Pfeiler: nicht für sich
  wirft(() => { const r = lauf([{ mass: 'eg.aw.nord.pfeiler1', wert: '5,555m', quelle: 'aufmass' }]); if (!r.ok) throw new Error(kurz(r)); }, /Pfeiler|Öffnung|nicht/, 'Pfeiler');
  // Befehlszeile
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haus-herkunft-')), datei = path.join(dir, 'haus.json');
  fs.writeFileSync(datei, HAUS_TEXT);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'aendern.js'), '--datei', datei, '--quelle', 'aufmass', 'raum:speis.tiefe=1,26m'], { encoding: 'utf8' });
  const neu = fs.readFileSync(datei, 'utf8'), unterschied = neu.split('\n').filter((l, i) => l !== HAUS_TEXT.split('\n')[i]);
  check(r.status === 0 && unterschied.length === 1 && /"z\.speisS"/.test(unterschied[0]) && /"quelle": "aufmass"/.test(unterschied[0]), 'CLI: genau eine Zeile ändert sich (die Herkunft): ' + r.stdout + r.stderr + unterschied.join('|'));
}

if (fails.length) { console.log('FEHLER:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('Änderungen: alle Prüfungen bestanden');
