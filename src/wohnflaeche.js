/* Wohnfläche: berechnet die Wohnfläche je Raum nach der Wohnflächenverordnung (WoFlV §§ 2–4) aus den abgeleiteten Räumen, dem Dach und der Treppe.
   Ohne Three.js, in Node testbar. Alle Flächen in mm², alle Maße in Millimetern, hausrelativ (hx nach Osten, hz nach Süden).

     wohnflaecheAbleiten(haus, WV, abl, dach, T)  → { putzabzug, raeume[], terrassen[], geschosse{EG, DG}, summe }
        Raum:     { id, name, geschoss, zubehoer, grundflaeche, abzuege: { kamin, treppe }, zonen: { voll, halb, keine },
                    zonenPolygone: { voll, halb, keine } (MultiPolygone in mm), anrechenbar, wohnflaeche }
        Terrasse: { name, ueberdacht, grundflaeche, anteil, wohnflaeche }
        Geschoss: { grundflaeche, anrechenbar, wohnflaeche };  summe: dasselbe für alle Räume, dazu terrassen (angerechnete Terrassenfläche) und gesamt = Räume + Terrassen
     wohnflaecheText(w)                           die Tabelle als Text (m², Dezimalkomma)

   Regeln (ausführbar in diesem Modul, Nachweis in tools/test_wohnflaeche.js):
   - Grundfläche = abgeleitete Raumfläche (Rohbaumaße: Geschossfläche minus Wände, Stempel wählt die Teilfläche; Treppe und Kamin ziehen dort nichts ab).
   - Abzug Schornstein (§ 3 Abs. 2 Nr. 1): Kamin mit mehr als 0,1 m² Grundfläche, im Geschoss höher als 1,50 m.
   - Abzug Treppe (§ 3 Abs. 2 Nr. 2): Treppen mit mehr als drei Steigungen, die Fläche der Stufen im EG. Im DG liegt die Treppenöffnung ohnehin
     außerhalb der Ausbaufläche.
   - Höhenzonen (§ 4 Nr. 1): lichte Höhe ≥ 2 m voll, 1 m bis 2 m zur Hälfte, unter 1 m gar nicht. Im EG ist die lichte Höhe überall dieselbe (geschosse.EG.lichteHoehe).
     Im DG ist sie lotrecht Dachhaut − Sparrenabstand (dg.wandAbstandDachhaut) − DG-Boden, wie bei der Oberkante der Wände (dach.js). Die Dachhaut
     ist die größere der beiden Walmflächen (Flügel A, B), also ist „Höhe ≥ h“ die Vereinigung der um den Abstand d verkleinerten Flügelrechtecke,
     d = (DG-Boden + h + Sparrenabstand − Traufe) / tan(Neigung) + Überstand. Das ist exakt und braucht keine Rasterung.
   - Putzabzug (§ 4 Nr. 2): Die Maße sind Rohbaumaße, also 3 % Abzug (haus.wohnflaeche.putzabzug; 0 bei fertigen Maßen).
   - Zubehörräume (haus.raeume[].zubehoer: true; z. B. Keller, Abstellraum außerhalb der Wohnung, Heizungsraum) zählen nicht zur Wohnfläche
     (§ 2 Abs. 3 Nr. 1), bleiben aber in der Ausgabe.
   - Terrasse (§ 4 Nr. 4: Balkone, Loggien, Dachgärten und Terrassen in der Regel zu einem Viertel, höchstens zur Hälfte): haus.terrasse { polygon, anteil (Standard 0,25,
     höchstens 0,5, sonst Fehler), ueberdacht }. Überdacht oder offen gilt dieselbe Regel; ein Putzabzug entfällt, die Fläche ist nicht verputzt. Sie steht gesondert in
     terrassen[] und in summe.gesamt, nicht in summe.wohnflaeche (Räume).
   Nicht berücksichtigt: Türnischen und Wandnischen, Mauervorlagen außer dem Kamin. */
if (typeof require !== 'undefined') { var polygonClipping = require('polygon-clipping'); var RA = require('./raeume.js'); }

var WOFLV = { putzabzug: 0.03, zonen: [{ ab: 2000, anteil: 1 }, { ab: 1000, anteil: 0.5 }], schornsteinMin: 100000, schornsteinHoehe: 1500, treppeSteigungen: 3, terrasseAnteil: 0.25, terrasseMax: 0.5 };

function wohnflaecheAbleiten(haus, WV, abl, dach, T) {
  var R = typeof RA !== 'undefined' ? RA : { multiFlaeche: multiFlaeche, vereinigen: vereinigen, ringFlaeche: ringFlaeche };
  var cfg = haus.wohnflaeche || {}, putz = cfg.putzabzug != null ? cfg.putzabzug : WOFLV.putzabzug;
  var G = haus.geschosse, out = { putzabzug: putz, raeume: [], terrassen: [], geschosse: {}, summe: { grundflaeche: 0, anrechenbar: 0, wohnflaeche: 0, terrassen: 0, gesamt: 0 } };
  function ring(pts) { return pts.concat([pts[0]]); }
  function rechteck(x0, z0, x1, z1) { return [[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]]; }
  function flaeche(mp) { return mp.length ? R.multiFlaeche(mp) : 0; }
  function schneiden(a, b) { return a.length && b.length ? polygonClipping.intersection(a, b) : []; }
  function ohne(a, b) { return a.length && b.length ? polygonClipping.difference(a, b) : a; }

  /* Fläche, auf der die lichte Höhe mindestens h erreicht: im DG die Vereinigung der verkleinerten Flügelrechtecke, sonst überall (EG) */
  function ab(h) {
    var out2 = [];
    var yD = G.DG.okff, abstand = haus.dg.wandAbstandDachhaut, d = (yD + h + abstand - dach.traufe) / dach.tan + dach.ueberstand;
    [dach.A, dach.B].forEach(function (r) {
      if (!r) return;
      var x0 = r.x0 + d, x1 = r.x1 - d, z0 = r.z0 + d, z1 = r.z1 - d;
      if (x0 < x1 && z0 < z1) out2.push(rechteck(x0, z0, x1, z1));
    });
    return out2.length ? polygonClipping.union.apply(null, out2.map(function (p) { return [p]; })) : [];
  }
  var zonenGrenze = {};
  function grenze(h) { if (!(h in zonenGrenze)) zonenGrenze[h] = ab(h); return zonenGrenze[h]; }

  /* Kamin (Schornstein) als Rechteck, wenn er in einem Geschoss abzuziehen ist */
  function kaminFlaeche(g) {
    var k = haus.kamin;
    if (!k || k.breite * k.tiefe <= WOFLV.schornsteinMin) return [];
    var ok = k.oberkante != null ? k.oberkante : Infinity;
    if (ok - G[g].okff <= WOFLV.schornsteinHoehe) return [];
    var c = [WV.mm(k.mitte[0]), WV.mm(k.mitte[1])];
    return [rechteck(c[0] - k.breite / 2, c[1] - k.tiefe / 2, c[0] + k.breite / 2, c[1] + k.tiefe / 2)];
  }
  /* Stufenfläche der Treppe (EG), wenn sie mehr als drei Steigungen hat */
  function treppeFlaeche(g) {
    if (g !== 'EG' || !T || !T.stufen || !T.stufen.length || !(T.steigungen > WOFLV.treppeSteigungen)) return [];
    return polygonClipping.union.apply(null, T.stufen.map(function (s) { return [[ring(s.polygon)]]; }));
  }

  ['EG', 'DG'].forEach(function (g) {
    var gs = abl.geschosse[g];
    if (!gs) return;
    var kamin = kaminFlaeche(g), treppe = treppeFlaeche(g);
    var sum = out.geschosse[g] = { grundflaeche: 0, anrechenbar: 0, wohnflaeche: 0 };
    abl.raeume.forEach(function (r) {
      if (r.geschoss !== g) return;
      var tf = r.teilflaeche >= 0 ? gs.teilflaechen[r.teilflaeche] : null, roh = tf ? [tf.polygon] : [], zub = !!(haus.raeume.filter(function (q) { return q.id === r.id; })[0] || {}).zubehoer;
      var grund = flaeche(roh), nachTreppe = ohne(roh, treppe), abTreppe = grund - flaeche(nachTreppe), netto = ohne(nachTreppe, kamin);
      var abKamin = flaeche(nachTreppe) - flaeche(netto), zonen, poly;
      var z2 = g === 'DG' ? grenze(WOFLV.zonen[0].ab) : null, z1 = g === 'DG' ? grenze(WOFLV.zonen[1].ab) : null;
      if (g === 'DG' && dach) {
        var voll = schneiden(netto, z2), mind1 = schneiden(netto, z1), halb = ohne(mind1, z2), keine = ohne(netto, z1);
        poly = { voll: voll, halb: halb, keine: keine };
      } else if (G[g].lichteHoehe >= WOFLV.zonen[0].ab) poly = { voll: netto, halb: [], keine: [] };
      else if (G[g].lichteHoehe >= WOFLV.zonen[1].ab) poly = { voll: [], halb: netto, keine: [] };
      else poly = { voll: [], halb: [], keine: netto };
      zonen = { voll: flaeche(poly.voll), halb: flaeche(poly.halb), keine: flaeche(poly.keine) };
      var anrechenbar = zonen.voll * WOFLV.zonen[0].anteil + zonen.halb * WOFLV.zonen[1].anteil, wohn = zub ? 0 : anrechenbar * (1 - putz);
      out.raeume.push({
        id: r.id, name: r.name, geschoss: g, zubehoer: zub, grundflaeche: grund, abzuege: { kamin: abKamin, treppe: abTreppe },
        zonen: zonen, zonenPolygone: poly, anrechenbar: anrechenbar, wohnflaeche: wohn
      });
      [sum, out.summe].forEach(function (s) { s.grundflaeche += grund; s.anrechenbar += zub ? 0 : anrechenbar; s.wohnflaeche += wohn; });
    });
  });
  if (haus.terrasse && haus.terrasse.polygon) {
    var tr = haus.terrasse, anteil = tr.anteil != null ? tr.anteil : WOFLV.terrasseAnteil;
    if (!(anteil >= 0) || anteil > WOFLV.terrasseMax) throw new Error('Terrasse: Anteil ' + anteil + ' nicht zulässig, nach WoFlV § 4 Nr. 4 höchstens die Hälfte (0,5)');
    var tg = R.ringFlaeche(tr.polygon.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; }));
    out.terrassen.push({ name: tr.name || 'Terrasse', ueberdacht: !!tr.ueberdacht, grundflaeche: tg, anteil: anteil, wohnflaeche: tg * anteil });
    out.summe.terrassen += tg * anteil;
  }
  out.summe.gesamt = out.summe.wohnflaeche + out.summe.terrassen;
  return out;
}

/* Tabelle als Text: m² mit Dezimalkomma, Geschossweise und mit Summe */
function wohnflaecheText(w) {
  function m2(v) { return (Math.round(v / 1e4) / 100).toFixed(2).replace('.', ','); }
  function sp(t, n, links) { t = String(t); while (t.length < n) t = links ? t + ' ' : ' ' + t; return t; }
  var z = ['Wohnfläche nach WoFlV (Rohbaumaße, Putzabzug ' + (Math.round(w.putzabzug * 1000) / 10).toString().replace('.', ',') + ' %), m²',
    sp('Raum', 26, true) + sp('Grundfl.', 9) + sp('Kamin', 7) + sp('Treppe', 8) + sp('≥ 2 m', 8) + sp('1–2 m', 8) + sp('< 1 m', 8) + sp('Wohnfl.', 9)];
  ['EG', 'DG'].forEach(function (g) {
    if (!w.geschosse[g]) return;
    z.push(g + ':');
    w.raeume.filter(function (r) { return r.geschoss === g; }).forEach(function (r) {
      z.push(sp('  ' + r.name + (r.zubehoer ? ' (Zubehör)' : ''), 26, true) + sp(m2(r.grundflaeche), 9) + sp(r.abzuege.kamin ? m2(r.abzuege.kamin) : '', 7) + sp(r.abzuege.treppe ? m2(r.abzuege.treppe) : '', 8) +
        sp(m2(r.zonen.voll), 8) + sp(m2(r.zonen.halb), 8) + sp(m2(r.zonen.keine), 8) + sp(m2(r.wohnflaeche), 9));
    });
    z.push(sp('  Summe ' + g, 26, true) + sp(m2(w.geschosse[g].grundflaeche), 9) + sp('', 7 + 8 + 8 + 8 + 8) + sp(m2(w.geschosse[g].wohnflaeche), 9));
  });
  z.push(sp('Summe Wohnfläche (Räume)', 26, true) + sp(m2(w.summe.grundflaeche), 9) + sp('', 7 + 8 + 8 + 8 + 8) + sp(m2(w.summe.wohnflaeche), 9));
  w.terrassen.forEach(function (t) {
    z.push(sp(t.name + (t.ueberdacht ? ' (überdacht)' : '') + ', ' + (Math.round(t.anteil * 1000) / 10).toString().replace('.', ',') + ' %', 26, true) + sp(m2(t.grundflaeche), 9) + sp('', 7 + 8 + 8 + 8 + 8) + sp(m2(t.wohnflaeche), 9));
  });
  if (w.terrassen.length) z.push(sp('Wohnfläche gesamt', 26, true) + sp('', 9 + 7 + 8 + 8 + 8 + 8) + sp(m2(w.summe.gesamt), 9));
  return z.join('\n');
}
if (typeof module !== 'undefined') module.exports = { wohnflaecheAbleiten: wohnflaecheAbleiten, wohnflaecheText: wohnflaecheText, WOFLV: WOFLV };
