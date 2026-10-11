/* Test der Raumableitung (src/raeume.js) und der Prüfregeln (src/pruefen.js) an einem kleinen, erfundenen Haus (ohne Three.js).
   Aufruf: node tools/test_pruefen.js   (läuft auch über npm test)
   Das Haus: 6,00 × 4,00 m, Außenwand 30 cm, eine Innenwand (10 cm) bei x = 3,00 m teilt es in „links“ und „rechts“.
   Dachausbau: Raum „dg“ zwischen vier Kniewänden (je 10 cm). Jede Prüfregel bekommt einen Fall, der sie auslöst, und den Gegenfall ohne Befund. */
const { werteAufloesen } = require('../src/werte.js');
const { raeumeAbleiten } = require('../src/raeume.js');
const { dachAbleiten } = require('../src/dach.js');
const { pruefen } = require('../src/pruefen.js');

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
const klon = o => JSON.parse(JSON.stringify(o));
const nahe = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);

function basis() {
  return {
    wandtypen: { AW: { dicke: 300 }, IW: { dicke: 100 }, TB: { dicke: 100 } },
    aussenmasse: { 'x.W': { wert: 0, fest: true }, 'x.O': { wert: 6000, fest: true }, 'z.N': { wert: 0, fest: true }, 'z.S': { wert: 4000, fest: true } },
    achsen: {
      'x.Wi': { ref: 'x.W', plus: 'AW' }, 'x.Oi': { ref: 'x.O', minus: 'AW' }, 'z.Ni': { ref: 'z.N', plus: 'AW' }, 'z.Si': { ref: 'z.S', minus: 'AW' },
      'x.M': { wert: 3000 }, 'x.Mo': { ref: 'x.M', plus: 'IW' },
      'x.dgW': { wert: 1000 }, 'x.dgO': { wert: 5000 }, 'z.dgN': { wert: 1000 }, 'z.dgS': { wert: 3000 }
    },
    huelle: {
      aussen: [['x.W', 'z.N'], ['x.O', 'z.N'], ['x.O', 'z.S'], ['x.W', 'z.S']],
      innen: [['x.Wi', 'z.Ni'], ['x.Oi', 'z.Ni'], ['x.Oi', 'z.Si'], ['x.Wi', 'z.Si']]
    },
    geschosse: { EG: { okff: 0, lichteHoehe: 2500 }, DG: { okff: 2900, deckenaufbau: 400 } },
    dach: { neigung: 35, ueberstand: 200, traufe: 3500, fluegelA: { x: ['x.W', 'x.O'], z: ['z.N', 'z.S'] } },
    dg: {
      ausbauflaeche: [['x.dgW', 'z.dgN'], ['x.dgO', 'z.dgN'], ['x.dgO', 'z.dgS'], ['x.dgW', 'z.dgS']],
      wandHoechst: 2450, wandAbstandDachhaut: 220, kniewandSoll: 1000, kniewandToleranz: 50
    },
    waende: [
      { id: 'eg.aw.nord', geschoss: 'EG', typ: 'AW', von: ['x.W', 'z.N'], bis: ['x.O', 'z.N'], flucht: 'oben', hoehe: 'traufe' },
      { id: 'eg.aw.ost', geschoss: 'EG', typ: 'AW', von: ['x.O', 'z.N'], bis: ['x.O', 'z.S'], flucht: 'rechts', hoehe: 'traufe' },
      { id: 'eg.aw.sued', geschoss: 'EG', typ: 'AW', von: ['x.O', 'z.S'], bis: ['x.W', 'z.S'], flucht: 'unten', hoehe: 'traufe' },
      { id: 'eg.aw.west', geschoss: 'EG', typ: 'AW', von: ['x.W', 'z.S'], bis: ['x.W', 'z.N'], flucht: 'links', hoehe: 'traufe' },
      { id: 'eg.mitte', geschoss: 'EG', typ: 'IW', von: ['x.M', 'z.Ni'], bis: ['x.M', 'z.Si'], flucht: 'links', hoehe: 'decke',
        oeffnungen: [{ art: 'durchgang', ab: 1000, breite: 900, hoehe: 2100 }] },
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
function lauf(h) {
  const WV = werteAufloesen(h), abl = raeumeAbleiten(h, WV);
  return { WV, abl, befunde: pruefen(h, WV, abl, dachAbleiten(h, WV)) };
}
const finde = (r, regel, stufe, muster) => r.befunde.filter(b => b.regel === regel && (!stufe || b.stufe === stufe) && (!muster || muster.test(b.text)));
const hat = (r, regel, stufe, muster, msg) => check(finde(r, regel, stufe, muster).length > 0, msg + ' (kein Befund Regel ' + regel + ' ' + (stufe || '') + ' ' + (muster || '') + '; vorhanden: ' + r.befunde.map(b => b.regel + ':' + b.stufe + ':' + b.text).join(' | ') + ')');
const keinBefund = (r, msg) => check(r.befunde.length === 0, msg + ' – unerwartete Befunde: ' + r.befunde.map(b => b.regel + ':' + b.stufe + ':' + b.text).join(' | '));
const ohne = (r, regel, msg) => check(finde(r, regel).length === 0, msg + ' – Befund Regel ' + regel + ': ' + finde(r, regel).map(b => b.text).join(' | '));

/* ---------- Ableitung der Räume ---------- */
{
  const r = lauf(basis()), raum = id => r.abl.raeume.filter(q => q.id === id)[0];
  check(nahe(raum('links').flaeche, 2700 * 3400, 1e-3), 'links: Fläche ' + raum('links').flaeche + ' statt 2700 × 3400 mm');
  check(nahe(raum('rechts').flaeche, 2600 * 3400, 1e-3), 'rechts: Fläche ' + raum('rechts').flaeche + ' statt 2600 × 3400 mm');
  check(raum('links').ring.length === 4 && raum('rechts').ring.length === 4, 'Räume sind Rechtecke mit vier Eckpunkten');
  const eg = r.abl.geschosse.EG;
  check(nahe(eg.flaeche, 6000 * 4000, 1e-3), 'Geschossfläche EG ' + eg.flaeche);
  check(nahe(eg.wandflaeche, 6000 * 4000 - 2700 * 3400 - 2600 * 3400, 1e-3), 'Wandfläche EG ' + eg.wandflaeche);
  const dg = r.abl.geschosse.DG;
  check(nahe(raum('dg').flaeche, 3800 * 1800, 1e-3), 'DG: Fläche zwischen den Kniewänden ' + raum('dg').flaeche);
  check(dg.teilflaechen.length === 1, 'DG hat eine Teilfläche');
  keinBefund(r, 'Grundfall');
}
{ // Eine Öffnung (Durchgang) trennt die Räume nicht auf: die Innenwand bleibt durchgehend
  const r = lauf(basis());
  check(r.abl.geschosse.EG.teilflaechen.length === 2, 'Durchgang in der Innenwand: ' + r.abl.geschosse.EG.teilflaechen.length + ' Teilflächen statt 2');
}

/* ---------- Regel 1: jede Teilfläche genau ein Stempel ---------- */
{
  const h = basis(); h.raeume = h.raeume.filter(q => q.id !== 'rechts');
  const r = lauf(h);
  hat(r, 1, 'fehler', /unbenannte Teilfläche/i, 'Teilfläche ohne Raumstempel');
}
{
  const h = basis(); h.waende = h.waende.filter(w => w.id !== 'eg.mitte');
  const r = lauf(h);
  hat(r, 1, 'fehler', /nicht getrennt/i, 'Zwei Stempel in einer Teilfläche (Wand fehlt)');
}
{ // Trennlinie ohne Wand trennt die Räume
  const h = basis(); h.waende = h.waende.filter(w => w.id !== 'eg.mitte');
  h.trennlinien = [{ id: 'eg.grenze', geschoss: 'EG', von: ['x.M', 'z.Ni'], bis: ['x.M', 'z.Si'] }];
  const r = lauf(h);
  ohne(r, 1, 'Trennlinie statt Wand');
  check(nahe(r.abl.raeume.filter(q => q.id === 'links')[0].flaeche, 2700 * 3400, 100), 'Trennlinie: Fläche links (Toleranz 100 mm² für die rechnerische Dicke der Linie) ' + r.abl.raeume.filter(q => q.id === 'links')[0].flaeche);
}
{ // Stempel in der Wand: der Raum hat keine Fläche
  const h = basis(); h.raeume[1].stempel = [3050, 2000];
  const r = lauf(h);
  hat(r, 1, 'fehler', /Stempel/i, 'Stempel liegt in einer Wand');
}

/* ---------- Regel 2: Wände überschneiden sich nur an Stößen ---------- */
{ // Innenwand läuft durch die Südwand hindurch und darüber hinaus: schneidet die Wand und liegt außerhalb der Hülle (Regel 3)
  const h = basis(); h.waende[4].bis = ['x.M', 4600];
  const r = lauf(h);
  hat(r, 2, 'fehler', /eg\.mitte.*eg\.aw\.sued|eg\.aw\.sued.*eg\.mitte/, 'Wand läuft durch eine andere hindurch');
  hat(r, 3, 'fehler', /außerhalb/i, 'Wand ragt über die Hülle');
}
{ // zwei Wände auf derselben Linie überlappen sich
  const h = basis();
  h.waende.push({ id: 'eg.mitte2', geschoss: 'EG', typ: 'IW', von: ['x.M', 2000], bis: ['x.M', 'z.Si'], flucht: 'links', hoehe: 'decke' });
  const r = lauf(h);
  hat(r, 2, 'fehler', /überlappen/i, 'Wände auf derselben Linie überlappen sich');
}
{ // bündig stoßende Wände auf einer Linie sind kein Fehler
  const h = basis(); h.waende[4].bis = ['x.M', 2000];
  h.waende.push({ id: 'eg.mitte2', geschoss: 'EG', typ: 'IW', von: ['x.M', 2000], bis: ['x.M', 'z.Si'], flucht: 'links', hoehe: 'decke' });
  h.waende[4].oeffnungen = [{ art: 'durchgang', ab: 400, breite: 900, hoehe: 2100 }];
  const r = lauf(h);
  ohne(r, 2, 'Wände stoßen auf einer Linie aneinander');
  ohne(r, 3, 'Wände stoßen auf einer Linie aneinander');
}

/* ---------- Regel 3: freie Enden, Wandstummel, Wände außerhalb ---------- */
{
  const h = basis(); h.waende[4].bis = ['x.M', 2000]; // Wand endet frei im Raum, links und rechts hängen zusammen
  const r = lauf(h);
  hat(r, 3, 'warnung', /endet frei/i, 'Wand endet frei im Raum');
  hat(r, 1, 'fehler', /nicht getrennt/i, 'Räume hängen um die freie Wand herum zusammen');
}
{ // gewollt: Vorwand, die frei endet (freiesEnde), die Räume bleiben getrennt gestempelt (eine Fläche, ein Stempel)
  const h = basis(); h.waende[4].bis = ['x.M', 2000]; h.waende[4].freiesEnde = true; h.raeume = h.raeume.filter(q => q.id !== 'rechts');
  const r = lauf(h);
  ohne(r, 3, 'freies Ende ausdrücklich gewollt');
}
{
  const h = basis();
  h.waende.push({ id: 'eg.stummel', geschoss: 'EG', typ: 'IW', von: ['x.M', 'z.Ni'], bis: [3030, 'z.Ni'], flucht: 'oben', hoehe: 'decke' });
  const r = lauf(h);
  hat(r, 3, 'warnung', /Stummel/i, 'Wandstummel unter 5 cm');
}

/* ---------- Regel 4: Öffnungen ---------- */
{
  const h = basis(); h.waende[0].oeffnungen = [{ art: 'fenster', ab: 2800, breite: 600, bruestung: 900, hoehe: 1200 }]; // 2800–3400, Innenwand bei 3000–3100
  const r = lauf(h);
  hat(r, 4, 'fehler', /Wandstoß/i, 'Öffnung liegt im Wandstoß');
}
{
  const h = basis(); h.waende[0].oeffnungen = [{ art: 'fenster', ab: 3100, breite: 600, bruestung: 900, hoehe: 1200 }]; // grenzt genau an die Innenwand
  ohne(lauf(h), 4, 'Öffnung grenzt an den Wandstoß');
}
{
  const h = basis(); h.waende[0].oeffnungen = [{ art: 'fenster', ab: 3120, breite: 600, bruestung: 900, hoehe: 1200 }]; // 20 mm Abstand
  hat(lauf(h), 4, 'hinweis', /Abstand/i, 'Öffnung nur 20 mm neben dem Wandstoß');
}
{
  const h = basis(); h.waende[0].oeffnungen = [{ art: 'fenster', ab: 600, breite: 800, bruestung: 900, hoehe: 1200 }, { art: 'fenster', ab: 1200, breite: 800, bruestung: 900, hoehe: 1200 }];
  hat(lauf(h), 4, 'fehler', /überlappen/i, 'Öffnungen überlappen sich');
}
{
  const h = basis(); h.waende[0].oeffnungen = [{ art: 'fenster', ab: 5500, breite: 800, bruestung: 900, hoehe: 1200 }]; // Wandlänge 6000
  hat(lauf(h), 4, 'fehler', /Wand|Ende/i, 'Öffnung ragt über das Wandende');
}

{ // Tür nahe am Ende einer Wand, die in eine andere Wand läuft (T-Stoß von der anderen Seite): 20 mm Abstand
  const h = basis();
  h.waende.push({ id: 'eg.stich', geschoss: 'EG', typ: 'IW', von: ['x.Wi', 1000], bis: ['x.M', 1000], flucht: 'oben', hoehe: 'decke',
    oeffnungen: [{ art: 'durchgang', ab: 1880, breite: 800, hoehe: 2100 }] }); // Wandlänge 2700, Tür bis 2680
  hat(lauf(h), 4, 'hinweis', /Abstand/i, 'Tür 20 mm vor dem Anschluss an eine andere Wand');
}

/* ---------- Regel 7: Flächenbilanz ---------- */
{
  const r = lauf(basis());
  ['EG', 'DG'].forEach(g => {
    const s = r.abl.geschosse[g], summe = s.teilflaechen.reduce((a, t) => a + t.flaeche, 0) + s.wandflaeche;
    check(nahe(summe, s.flaeche, 1e-3), g + ': Räume + Wände ' + summe + ' ≠ Geschossfläche ' + s.flaeche);
  });
  ohne(r, 7, 'Flächenbilanz stimmt');
  const h = basis(), WV = werteAufloesen(h), abl = raeumeAbleiten(h, WV);
  abl.geschosse.EG.wandflaeche += 5000; // Rechenfehler vortäuschen: 5000 mm² Wandfläche zu viel
  check(pruefen(h, WV, abl, dachAbleiten(h, WV)).some(b => b.regel === 7 && b.stufe === 'fehler' && /Flächenbilanz EG/.test(b.text)), 'Flächenbilanz: Abweichung von 5000 mm² nicht gemeldet');
}

/* ---------- Regel 10: Geschosshöhe = lichte Höhe + Deckenaufbau ---------- */
{
  const h = basis(); h.geschosse.DG.deckenaufbau = 450; // 2900 − 2500 = 400
  hat(lauf(h), 10, 'fehler', /Deckenaufbau/i, 'Deckenaufbau passt nicht zur Geschosshöhe');
}

/* ---------- Regel 12: Höhen der Öffnungen ---------- */
{
  const h = basis(); h.waende[0].oeffnungen = [{ art: 'fenster', ab: 600, breite: 800, bruestung: 1500, hoehe: 1200 }]; // Oberkante 2700 > 2500
  hat(lauf(h), 12, 'fehler', /Sturz|Decke/i, 'Fenster ragt über die Decke');
}
{
  const h = basis(); h.waende[0].oeffnungen = [{ art: 'tuer', ab: 600, breite: 900, hoehe: 2600 }];
  hat(lauf(h), 12, 'fehler', /Decke/i, 'Tür höher als der Raum');
}
{
  const h = basis(); h.waende[0].oeffnungen = [{ art: 'fenster', ab: 600, breite: 800, bruestung: -50, hoehe: 1200 }];
  hat(lauf(h), 12, 'fehler', /Brüstung/i, 'negative Brüstung');
}

/* ---------- Regel 12 im Dachausbau: Türhöhe gegen die Wandoberkante ---------- */
{
  const h = basis(); h.waende.filter(w => w.id === 'dg.kn.nord')[0].oeffnungen = [{ art: 'durchgang', ab: 1000, breite: 800, hoehe: 1200 }]; // Kniewand höchstens 1000 mm hoch
  hat(lauf(h), 12, 'fehler', /Wand|Oberkante/, 'Tür im DG höher als die Kniewand');
}
{
  const h = basis(); h.waende.filter(w => w.id === 'dg.kn.nord')[0].oeffnungen = [{ art: 'durchgang', ab: 1000, breite: 800, hoehe: 900 }];
  ohne(lauf(h), 12, 'Tür im DG unter der Kniewand');
}

/* ---------- Regel 13: Kniewände im Dachausbau ---------- */
{
  const r = lauf(basis());
  ohne(r, 13, 'Kniewand erreicht 1,00 m (Dachhaut 4,2 m über OKFF EG)');
}
{ // Kniewand zu nah an der Traufe: unter der Dachhaut bleibt weniger als 1 m (Dachhaut − 22 cm)
  const h = basis(); h.achsen['z.dgN'].wert = 300;
  hat(lauf(h), 13, 'warnung', /Kniewand/i, 'Kniewand nur 0,59 m hoch');
}
{ // Dachausbau-Wände enden unter den Sparren: Oberkante = Dachhaut − 22 cm, höchstens 2,45 m über dem DG-Boden
  const h = basis(), WV = werteAufloesen(h), d = dachAbleiten(h, WV);
  check(nahe(d.hoehe(3000, 1000), 3500 - 200 * Math.tan(35 * Math.PI / 180) + Math.tan(35 * Math.PI / 180) * 1200, 1e-6), 'Dachhöhe bei hz 1,00 m: ' + d.hoehe(3000, 1000));
  check(nahe(d.wandOK(3000, 1000, 1000), 2900 + 1000, 1e-6), 'Kniewand begrenzt auf 1,00 m: ' + d.wandOK(3000, 1000, 1000));
  check(nahe(d.wandOK(3000, 300, 1000), d.hoehe(3000, 300) - 220, 1e-6), 'Wand folgt der Dachhaut − 22 cm: ' + d.wandOK(3000, 300, 1000));
  check(nahe(d.wandOK(3000, 2000), 2900 + 2450, 1e-6) || d.wandOK(3000, 2000) <= 2900 + 2450, 'ohne Maximum höchstens 2,45 m: ' + d.wandOK(3000, 2000));
  check(d.hoehe(-500, 2000) < -1e8, 'außerhalb des Daches keine Dachhöhe');
}

/* ---------- Regel 9: Maßketten ---------- */
{
  const h = basis(); h.ketten = [{ id: 'kette.a', name: 'Testkette', gesamt: ['x.Wi', 'x.Oi'], teile: [{ was: 'links', wert: 2700 }, { was: 'Wand', wert: 100 }, { was: 'rechts', wert: 2600 }] }];
  ohne(lauf(h), 9, 'Kette geht auf (2700 + 100 + 2600 = 5400)');
  h.ketten[0].teile[2].wert = 2590;
  hat(lauf(h), 9, 'hinweis', /10 mm/, 'Rest von 10 mm ist ein Hinweis');
  h.ketten[0].teile[2].wert = 2500;
  hat(lauf(h), 9, 'warnung', /100 mm/, 'Rest von 100 mm ist eine Warnung');
  h.ketten[0].teile[2].wert = 'treppe.laufbreite'; h.treppe = { laufbreite: 2600 };
  ohne(lauf(h), 9, 'Kettenglied aus den Daten (Pfad treppe.laufbreite)');
}

/* ---------- Regel 11: Treppe ---------- */
function mitTreppe() {
  const h = basis();
  h.achsen['x.tW'] = { wert: 3500 }; h.achsen['x.tO'] = { wert: 5700 };
  h.achsen['z.tN'] = { wert: 1200 }; h.achsen['z.tS'] = { wert: 2100 };
  h.treppe = { steigungen: 15, auftritt: 250, laufbreite: 900, gelaender: 150, nische: 540, anker: ['x.Oi', 'z.tS'], geraderLaufAb: 1357, laufEnde: 2200 };
  h.dg.treppenoeffnung = [['x.tW', 'z.tN'], ['x.tO', 'z.tN'], ['x.tO', 'z.tS'], ['x.tW', 'z.tS']];
  return h;
}
{
  const r = lauf(mitTreppe());
  ohne(r, 11, 'Treppe: Steigung 2900/15 = 193 mm, Schrittmaß 636 mm, Lauf in der Öffnung');
}
{
  const h = mitTreppe(); h.treppe.auftritt = 330;  // 2 · 193 + 330 = 716 mm
  hat(lauf(h), 11, 'warnung', /Schrittmaß/i, 'Schrittmaß außerhalb 590–650 mm');
}
{
  const h = mitTreppe(); h.treppe.steigungen = 11;   // Steigung 2900/11 = 264 mm
  hat(lauf(h), 11, 'fehler', /Steigung/i, 'Steigung über 210 mm');
}
{
  const h = mitTreppe(); h.achsen['x.tW'].wert = 4000; // Öffnung beginnt hinter dem Lauf (Lauf von x 3500 bis 4343)
  hat(lauf(h), 11, 'fehler', /Treppenöffnung/i, 'Treppenöffnung umfasst den Lauf nicht');
}

if (fails.length) { console.log('FEHLER:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('Raumableitung und Prüfregeln: alle Prüfungen bestanden');
