/* Test der Wohnflächenberechnung (src/wohnflaeche.js, Plan Phase 7) nach der Wohnflächenverordnung (WoFlV §§ 2–4), ohne Three.js.
   Aufruf: node tools/test_wohnflaeche.js   (läuft auch über npm test)
   Die Sollwerte sind von Hand gerechnet (erfundenes Haus mit 45° Dachneigung, damit die Höhenzonen glatte Maße haben) bzw. stammen aus dem Plan
   (Kamin 35 × 49 cm) und der Treppenplanung (Stufen), nicht aus einem gemessenen Istwert des Modells. Geprüft wird über die öffentliche Schnittstelle:
     wohnflaecheAbleiten(haus, WV, abl, dach, T)   Grundfläche, Abzüge (Kamin, Treppe), Höhenzonen (100 % / 50 % / 0 %), Putzabzug, Summen
     wohnflaecheText(w)                            die Tabelle für Befehlszeile und Dokument */
const fs = require('fs');
const { werteAufloesen } = require('../src/werte.js');
const { raeumeAbleiten } = require('../src/raeume.js');
const { dachAbleiten } = require('../src/dach.js');
const { treppeAbleiten } = require('../src/treppe.js');
const { wohnflaecheAbleiten, wohnflaecheText } = require('../src/wohnflaeche.js');
const echt = require('../src/data/haus.json');

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
const klon = o => JSON.parse(JSON.stringify(o));
const nahe = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1 : tol); // mm²

/* Erfundenes Haus: 6 × 4 m, Außenwand 30 cm, Innenwand bei x = 3,00 m (EG: „links“ und „rechts“), im DG ein Raum zwischen vier Kniewänden (je 10 cm,
   Raum x 1100–4900, z 1100–2900). Dach 45°, Überstand 0, Traufe auf DG-Höhe, ein Walmflügel 8 × 6 m: Dachhaut = Traufe + Abstand zur Dachkante. */
function basis() {
  return {
    wandtypen: { AW: { dicke: 300 }, IW: { dicke: 100 }, TB: { dicke: 100 } },
    aussenmasse: { 'x.W': { wert: 0, fest: true }, 'x.O': { wert: 6000, fest: true }, 'z.N': { wert: 0, fest: true }, 'z.S': { wert: 4000, fest: true } },
    achsen: {
      'x.Wi': { ref: 'x.W', plus: 'AW' }, 'x.Oi': { ref: 'x.O', minus: 'AW' }, 'z.Ni': { ref: 'z.N', plus: 'AW' }, 'z.Si': { ref: 'z.S', minus: 'AW' },
      'x.M': { wert: 3000 }, 'x.dgW': { wert: 1000 }, 'x.dgO': { wert: 5000 }, 'z.dgN': { wert: 1000 }, 'z.dgS': { wert: 3000 }
    },
    huelle: {
      aussen: [['x.W', 'z.N'], ['x.O', 'z.N'], ['x.O', 'z.S'], ['x.W', 'z.S']],
      innen: [['x.Wi', 'z.Ni'], ['x.Oi', 'z.Ni'], ['x.Oi', 'z.Si'], ['x.Wi', 'z.Si']]
    },
    geschosse: { EG: { okff: 0, lichteHoehe: 2500 }, DG: { okff: 2900, deckenaufbau: 400 } },
    dach: { neigung: 45, ueberstand: 0, traufe: 2900, fluegelA: { x: [0, 8000], z: [0, 6000] } },
    dg: {
      ausbauflaeche: [['x.dgW', 'z.dgN'], ['x.dgO', 'z.dgN'], ['x.dgO', 'z.dgS'], ['x.dgW', 'z.dgS']],
      wandHoechst: 2450, wandAbstandDachhaut: 220, kniewandSoll: 1000, kniewandToleranz: 50
    },
    waende: [
      { id: 'eg.aw.nord', geschoss: 'EG', typ: 'AW', von: ['x.W', 'z.N'], bis: ['x.O', 'z.N'], flucht: 'oben' },
      { id: 'eg.aw.ost', geschoss: 'EG', typ: 'AW', von: ['x.O', 'z.N'], bis: ['x.O', 'z.S'], flucht: 'rechts' },
      { id: 'eg.aw.sued', geschoss: 'EG', typ: 'AW', von: ['x.O', 'z.S'], bis: ['x.W', 'z.S'], flucht: 'unten' },
      { id: 'eg.aw.west', geschoss: 'EG', typ: 'AW', von: ['x.W', 'z.S'], bis: ['x.W', 'z.N'], flucht: 'links' },
      { id: 'eg.mitte', geschoss: 'EG', typ: 'IW', von: ['x.M', 'z.Ni'], bis: ['x.M', 'z.Si'], flucht: 'links' },
      { id: 'dg.kn.nord', geschoss: 'DG', typ: 'TB', von: ['x.dgW', 'z.dgN'], bis: ['x.dgO', 'z.dgN'], flucht: 'oben', hoehe: { max: 1000 } },
      { id: 'dg.kn.sued', geschoss: 'DG', typ: 'TB', von: ['x.dgW', 'z.dgS'], bis: ['x.dgO', 'z.dgS'], flucht: 'unten', hoehe: { max: 1000 } },
      { id: 'dg.kn.west', geschoss: 'DG', typ: 'TB', von: ['x.dgW', 'z.dgN'], bis: ['x.dgW', 'z.dgS'], flucht: 'links', hoehe: { max: 1000 } },
      { id: 'dg.kn.ost', geschoss: 'DG', typ: 'TB', von: ['x.dgO', 'z.dgN'], bis: ['x.dgO', 'z.dgS'], flucht: 'rechts', hoehe: { max: 1000 } }
    ],
    raeume: [
      { id: 'links', name: 'Links', geschoss: 'EG', boden: 'holz', stempel: [1500, 2000] },
      { id: 'rechts', name: 'Rechts', geschoss: 'EG', boden: 'holz', stempel: [4500, 2000] },
      { id: 'dg', name: 'DG', geschoss: 'DG', boden: 'dg', stempel: [3000, 2000] }
    ]
  };
}
function rechne(h) {
  const WV = werteAufloesen(h), abl = raeumeAbleiten(h, WV), dach = dachAbleiten(h, WV);
  const T = h.treppe ? treppeAbleiten(h, WV) : null;
  return wohnflaecheAbleiten(h, WV, abl, dach, T);
}
const raum = (w, id) => w.raeume.filter(r => r.id === id)[0];

/* ---------- EG ohne Abzüge: Wohnfläche = Grundfläche abzüglich 3 % Putz ---------- */
{
  const w = rechne(basis()), l = raum(w, 'links'), r = raum(w, 'rechts');
  check(nahe(l.grundflaeche, 2700 * 3400), 'links: Grundfläche ' + l.grundflaeche + ' statt 2700 × 3400 mm² (x 300–3000, z 300–3700)');
  check(nahe(l.anrechenbar, l.grundflaeche) && nahe(l.zonen.voll, l.grundflaeche) && l.zonen.halb === 0 && l.zonen.keine === 0, 'EG-Raum (lichte Höhe 2,50 m) wird voll angerechnet');
  check(nahe(l.wohnflaeche, l.grundflaeche * 0.97), 'links: Wohnfläche ' + l.wohnflaeche + ' statt 97 % der Grundfläche (Putzabzug 3 % bei Rohbaumaßen, WoFlV § 4 Nr. 2)');
  check(nahe(w.geschosse.EG.wohnflaeche, (l.grundflaeche + r.grundflaeche) * 0.97), 'Summe EG');
}

/* ---------- Putzabzug lässt sich in den Daten ändern (fertige Maße: 0) ---------- */
{
  const h = basis(); h.wohnflaeche = { putzabzug: 0 };
  const l = raum(rechne(h), 'links');
  check(nahe(l.wohnflaeche, l.grundflaeche), 'putzabzug 0: Wohnfläche ' + l.wohnflaeche + ' statt Grundfläche ' + l.grundflaeche);
  h.wohnflaeche = { putzabzug: 0.05 };
  check(nahe(raum(rechne(h), 'links').wohnflaeche, l.grundflaeche * 0.95), 'putzabzug 5 %');
}

/* ---------- DG: Höhenzonen unter der Dachschräge (WoFlV § 4 Nr. 1): ≥ 2 m voll, 1–2 m halb, < 1 m nicht ----------
   lichte Höhe = Dachhaut − 220 (Sparren) − DG-Boden; bei 45° und Überstand 0 ist die Dachhaut gleich Traufe + Abstand zur Dachkante.
   ≥ 2000 mm ⇔ Abstand zur Dachkante ≥ 2220, ≥ 1000 mm ⇔ ≥ 1220. Raum x 1100–4900, z 1100–2900 (3800 × 1800 = 6 840 000 mm²):
   voll   x 2220–4900 × z 2220–2900 = 2680 × 680  = 1 822 400
   ≥ 1 m  x 1220–4900 × z 1220–2900 = 3680 × 1680 = 6 182 400  →  halb 4 360 000,  nicht 657 600 */
{
  const w = rechne(basis()), d = raum(w, 'dg');
  check(nahe(d.grundflaeche, 3800 * 1800), 'dg: Grundfläche ' + d.grundflaeche + ' statt 3800 × 1800');
  check(nahe(d.zonen.voll, 1822400), 'dg: Zone ≥ 2 m ' + d.zonen.voll + ' statt 1 822 400 mm²');
  check(nahe(d.zonen.halb, 4360000), 'dg: Zone 1–2 m ' + d.zonen.halb + ' statt 4 360 000 mm²');
  check(nahe(d.zonen.keine, 657600), 'dg: Zone < 1 m ' + d.zonen.keine + ' statt 657 600 mm²');
  check(nahe(d.anrechenbar, 1822400 + 4360000 / 2), 'dg: anrechenbar ' + d.anrechenbar + ' statt 4 002 400 mm²');
  check(nahe(d.wohnflaeche, 4002400 * 0.97), 'dg: Wohnfläche ' + d.wohnflaeche + ' statt 4 002 400 × 0,97');
  check(nahe(d.zonen.voll + d.zonen.halb + d.zonen.keine, d.grundflaeche), 'dg: Zonen zusammen = Grundfläche');
  check(d.zonenPolygone && d.zonenPolygone.voll && d.zonenPolygone.halb, 'dg: Zonenflächen als Polygone für den Plan');
}

/* ---------- Höhenzonen folgen dem Dach, wenn ein Flügel höher ist: die Vereinigung beider Flügel zählt ---------- */
{
  const h = basis();
  h.dach.fluegelA = { x: [0, 8000], z: [0, 6000] };
  h.dach.fluegelB = { x: [1500, 3500], z: [0, 6000] }; // Quergiebel (2000 breit, Walmfirst auf Höhe 1000, niedriger als A): ändert nichts
  const d = raum(rechne(h), 'dg');
  check(nahe(d.zonen.voll, 1822400) && nahe(d.zonen.halb, 4360000), 'ein niedrigerer zweiter Flügel ändert die Zonen nicht');
  h.dach.fluegelB = { x: [0, 8000], z: [0, 6000] }; // gleicher Flügel noch einmal: Vereinigung = derselbe Bereich
  const e = raum(rechne(h), 'dg');
  check(nahe(e.zonen.voll, 1822400) && nahe(e.zonen.halb, 4360000), 'zwei gleiche Flügel ergeben dieselben Zonen');
}

/* ---------- Kamin (35 × 49 cm, raumhoch): wird in beiden Geschossen abgezogen (WoFlV § 3 Abs. 2 Nr. 1: Schornsteine über 0,1 m²) ----------
   Mitte (2400 / 2000): x 2225–2575, z 1755–2245. Im EG ganz in „links“: 171 500 mm² Abzug. Im DG liegen z 2220–2245 (25 mm) in der vollen Zone,
   der Rest (465 mm) in der halben: voll −350 × 25 = 8 750, halb −350 × 465 = 162 750. */
{
  const h = basis(); h.kamin = { mitte: [2400, 2000], breite: 350, tiefe: 490, oberkante: 6800 };
  const w = rechne(h), l = raum(w, 'links'), d = raum(w, 'dg');
  check(nahe(l.abzuege.kamin, 171500), 'EG: Kaminabzug ' + l.abzuege.kamin + ' statt 350 × 490 = 171 500 mm²');
  check(nahe(l.anrechenbar, 2700 * 3400 - 171500), 'EG: anrechenbare Fläche mit Kamin ' + l.anrechenbar);
  check(nahe(d.abzuege.kamin, 171500), 'DG: Kaminabzug ' + d.abzuege.kamin);
  check(nahe(d.zonen.voll, 1822400 - 8750) && nahe(d.zonen.halb, 4360000 - 162750), 'DG: Zonen mit Kamin ' + d.zonen.voll + ' / ' + d.zonen.halb + ' statt 1 813 650 / 4 197 250');
  check(nahe(d.wohnflaeche, (1813650 + 4197250 / 2) * 0.97), 'DG: Wohnfläche mit Kamin ' + d.wohnflaeche);
  // ein kleiner Schornstein (unter 0,1 m²) wird nicht abgezogen
  h.kamin = { mitte: [2400, 2000], breite: 300, tiefe: 300, oberkante: 6800 };
  check(raum(rechne(h), 'links').abzuege.kamin === 0, 'Schornstein unter 0,1 m² wird nicht abgezogen');
  // ein niedriger Pfeiler (unter 1,50 m hoch) auch nicht
  h.kamin = { mitte: [2400, 2000], breite: 350, tiefe: 490, oberkante: 1400 };
  check(raum(rechne(h), 'links').abzuege.kamin === 0, 'Mauervorlage unter 1,50 m Höhe wird nicht abgezogen');
}

/* ---------- Treppe mit mehr als drei Steigungen: die Fläche der Stufen wird im EG abgezogen (WoFlV § 3 Abs. 2 Nr. 2) ----------
   Gerader Lauf von u = 0 bis 2000 in 8 Stufen (9 Steigungen), 900 breit: Anker (2800 / 3000) ⇒ x 800–2800, z 2100–3000, ganz in „links“. */
{
  const h = basis();
  h.treppe = { steigungen: 9, auftritt: 250, laufbreite: 900, anker: [2800, 3000], geraderLaufAb: 0, laufEnde: 2000, stufendicke: 44 };
  const w = rechne(h), l = raum(w, 'links');
  check(nahe(l.abzuege.treppe, 2000 * 900), 'Treppenabzug ' + l.abzuege.treppe + ' statt 2000 × 900 = 1 800 000 mm²');
  check(nahe(l.anrechenbar, 2700 * 3400 - 1800000), 'anrechenbar ohne Treppe');
  check(raum(w, 'rechts').abzuege.treppe === 0 && raum(w, 'dg').abzuege.treppe === 0, 'andere Räume ohne Treppenabzug');
  h.treppe.steigungen = 3; h.treppe.laufEnde = 500; // drei Steigungen: keine Abzugsfläche („mehr als drei“)
  check(raum(rechne(h), 'links').abzuege.treppe === 0, 'Treppe mit drei Steigungen wird nicht abgezogen');
}

/* ---------- Zubehörräume (z. B. Keller, Abstellraum außerhalb der Wohnung) zählen nicht zur Wohnfläche ---------- */
{
  const h = basis(); h.raeume[1].zubehoer = true;
  const w = rechne(h), r = raum(w, 'rechts'), l = raum(w, 'links');
  check(r.zubehoer === true && r.wohnflaeche === 0, 'Zubehörraum: Wohnfläche ' + r.wohnflaeche);
  check(nahe(r.grundflaeche, 2600 * 3400), 'Zubehörraum behält seine Grundfläche in der Ausgabe');
  check(nahe(w.geschosse.EG.wohnflaeche, l.wohnflaeche), 'Summe EG ohne den Zubehörraum');
  check(nahe(w.summe.wohnflaeche, w.geschosse.EG.wohnflaeche + w.geschosse.DG.wohnflaeche), 'Gesamtsumme = EG + DG');
  check(nahe(w.summe.grundflaeche, l.grundflaeche + r.grundflaeche + raum(w, 'dg').grundflaeche), 'Summe der Grundflächen enthält alle Räume');
}

/* ---------- Räume ohne Fläche (Stempel in der Wand) liefern 0 statt NaN ---------- */
{
  const h = basis(); h.raeume[0].stempel = [3000, 2000];
  const l = raum(rechne(h), 'links');
  check(l.grundflaeche === 0 && l.wohnflaeche === 0, 'Raum ohne Teilfläche: 0');
}

/* ---------- Ausgabe als Tabelle ---------- */
{
  const t = wohnflaecheText(rechne(basis()));
  check(/Links/.test(t) && /Rechts/.test(t) && /Summe/.test(t) && /EG/.test(t) && /DG/.test(t), 'Tabelle nennt Räume, Geschosse und Summe: ' + t);
  check(/3\s?%/.test(t) && /Rohbau/i.test(t), 'Tabelle nennt den Putzabzug (3 %) und die Rohbaumaße');
  check(/3,88/.test(t), 'Wohnfläche des DG-Raums (3,88 m²) steht, mit Dezimalkomma, in der Tabelle: ' + t);
}

/* ---------- Echte Daten: Kamin und Treppe, Invarianten ---------- */
{
  const h = klon(echt), w = rechne(h);
  const speis = raum(w, 'speis'), abst = raum(w, 'abstell'), naeh = raum(w, 'kind1');
  check(nahe(speis.abzuege.kamin, 350 * 490), 'Speisekammer: Kamin 35 × 49 cm (Plan) wird abgezogen: ' + speis.abzuege.kamin);
  check(nahe(abst.abzuege.kamin, 350 * 490), 'Abstellkammer (DG): derselbe Kamin wird abgezogen: ' + abst.abzuege.kamin);
  // Treppe: Wendelstufen 1–6 aus der Treppenplanung (Gaußsche Flächenformel) + 8 gerade Stufen (Lauf 3365 − 1357 = 2008 mm, 900 breit)
  const Tp = h.treppe, W = Tp.laufbreite, U0 = Tp.geraderLaufAb, ev = t => t === 'W' ? W : t === 'U0' ? U0 : t;
  let wendel = 0;
  ['1', '2', '3', '4', '5', '6'].forEach(k => {
    const p = Tp.wendel[k].map(q => [ev(q[0]), ev(q[1])]); let s = 0;
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
    wendel += Math.abs(s) / 2;
  });
  const stufen = wendel + (Tp.laufEnde - U0) * W;
  check(nahe(naeh.abzuege.treppe, stufen, 1), 'Nähzimmer: Treppenabzug ' + naeh.abzuege.treppe + ' statt Summe der Stufenflächen ' + stufen);
  check(naeh.abzuege.treppe > 3e6 && naeh.abzuege.treppe < 5e6, 'Treppenfläche liegt zwischen 3 und 5 m² (15 Steigungen, 0,90 m Lauf)');
  w.raeume.forEach(r => {
    check(Number.isFinite(r.wohnflaeche) && r.wohnflaeche >= 0, r.id + ': Wohnfläche ' + r.wohnflaeche);
    check(r.wohnflaeche <= r.grundflaeche + 1e-6, r.id + ': Wohnfläche größer als Grundfläche');
    check(nahe(r.zonen.voll + r.zonen.halb + r.zonen.keine + r.abzuege.kamin + r.abzuege.treppe, r.grundflaeche, 2), r.id + ': Zonen und Abzüge ergeben nicht die Grundfläche');
    if (r.geschoss === 'EG') check(r.zonen.halb === 0 && r.zonen.keine === 0, r.id + ': EG voll angerechnet');
  });
  check(w.raeume.length === echt.raeume.length, 'Alle Räume stehen in der Berechnung');
  check(nahe(w.summe.wohnflaeche, w.raeume.reduce((s, r) => s + r.wohnflaeche, 0), 1), 'Gesamtsumme = Summe der Räume');
  // das Dach ist 35°: im DG gibt es Bereiche in allen drei Zonen? mindestens volle und halbe
  const dgVoll = w.raeume.filter(r => r.geschoss === 'DG').reduce((s, r) => s + r.zonen.voll, 0), dgHalb = w.raeume.filter(r => r.geschoss === 'DG').reduce((s, r) => s + r.zonen.halb, 0);
  check(dgVoll > 0 && dgHalb > 0, 'DG: Flächen über 2 m (' + dgVoll + ') und zwischen 1 und 2 m (' + dgHalb + ') kommen vor');
}

/* ---------- Eine Maßänderung wirkt auf die Wohnfläche (Beispiel: die Speisekammer wird tiefer, das Nähzimmer gibt nach) ---------- */
{
  const a = rechne(klon(echt)), h = klon(echt);
  // Dachneigung ändern: die Höhenzonen im DG wandern
  h.dach.neigung = 30;
  const b = rechne(h);
  check(b.geschosse.DG.wohnflaeche < a.geschosse.DG.wohnflaeche, 'flacheres Dach (30° statt 35°): weniger Wohnfläche im DG (' + a.geschosse.DG.wohnflaeche + ' → ' + b.geschosse.DG.wohnflaeche + ')');
  check(nahe(b.geschosse.EG.wohnflaeche, a.geschosse.EG.wohnflaeche), 'das Dach ändert die Wohnfläche im EG nicht');
}

/* ---------- Befehlszeile tools/wohnflaeche.js: Tabelle auf die Konsole, mit --datei als Markdown ---------- */
{
  const { spawnSync } = require('child_process'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haus-wohnfl-')), datei = path.join(dir, 'wohnflaeche.md');
  let r = spawnSync('node', [path.join(__dirname, 'wohnflaeche.js')], { encoding: 'utf8' });
  check(r.status === 0 && /Summe Wohnfläche/.test(r.stdout) && /Nähzimmer/.test(r.stdout), 'CLI gibt die Tabelle aus: ' + r.stdout + r.stderr);
  r = spawnSync('node', [path.join(__dirname, 'wohnflaeche.js'), '--datei', datei], { encoding: 'utf8' });
  const md = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : '';
  check(r.status === 0 && /^# Wohnfläche/.test(md) && /WoFlV/.test(md) && /Summe Wohnfläche/.test(md), 'CLI --datei schreibt das Dokument: ' + r.stderr + md.slice(0, 80));
  check(!/[A-Za-z]:\\|\/home\//.test(md), 'das Dokument enthält keine Pfade');
  fs.rmSync(dir, { recursive: true, force: true });
}

if (fails.length) { console.log('FEHLER:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('Wohnfläche: alle Prüfungen bestanden');
