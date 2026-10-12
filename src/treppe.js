/* Treppe: Stufen, Höhen und Kopfhöhe aus src/data/haus.json (haus.treppe). Ohne Three.js, in Node testbar.
   Alle Maße in Millimetern, hausrelativ (hx nach Osten, hz nach Süden), Höhen ab OKFF EG.

     treppeAbleiten(haus, WV)                 → { steigung, auftritt, laufbreite, dicke, stufen[], umriss, lauflinie[], hoeheBei(x, z), zuXZ(u, v) }
        Stufe: { n, art ('wendel' | 'gerade'), uv (Ecken in u, v ab der Innenecke), polygon (hx, hz), hoehe (Trittfläche), unterkante, schwerpunkt }
     treppeKopfhoehe(haus, WV, T, dach)       → { min, stufe, ort, stellen[] }   lichte Höhe über der Lauflinie

   u läuft von der Innenecke (Anker) nach Westen, v nach Norden. Stufe n liegt mit der Trittfläche n × Steigung über OKFF EG; Stufe 15 ist der DG-Boden.
   Die Steigung ist die Geschosshöhe durch die Zahl der Steigungen (Treppenplanung: 2971 / 15 = 198,07 mm). */
function treppeAbleiten(haus, WV) {
  var T = haus.treppe, ax = WV.mm(T.anker[0]), az = WV.mm(T.anker[1]), W = T.laufbreite, U0 = T.geraderLaufAb, U1 = T.laufEnde;
  var hoehe = haus.geschosse.DG.okff - haus.geschosse.EG.okff, steigung = hoehe / T.steigungen, dicke = T.stufendicke || 44;
  function zuXZ(u, v) { return [ax - u, az - v]; }
  function wert(t) { return t === 'W' ? W : t === 'U0' ? U0 : t; }
  function flaeche(r) { var s = 0, i; for (i = 0; i < r.length; i++) { var a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function schwerpunkt(r) { // Flächenschwerpunkt eines Polygons
    var A = flaeche(r), cx = 0, cz = 0, i;
    for (i = 0; i < r.length; i++) { var a = r[i], b = r[(i + 1) % r.length], k = a[0] * b[1] - b[0] * a[1]; cx += (a[0] + b[0]) * k; cz += (a[1] + b[1]) * k; }
    return [cx / (6 * A), cz / (6 * A)];
  }
  function imRing(r, x, z) {
    var ins = false, i, j;
    for (i = 0, j = r.length - 1; i < r.length; j = i++) {
      var a = r[j], b = r[i];
      if ((b[1] > z) !== (a[1] > z) && x < (a[0] - b[0]) * (z - b[1]) / (a[1] - b[1]) + b[0]) ins = !ins;
    }
    return ins;
  }
  var stufen = [], n, i;
  for (n = 1; n <= T.steigungen - 1; n++) {
    var uv, art;
    if (T.wendel && T.wendel[String(n)]) { uv = T.wendel[String(n)].map(function (q) { return [wert(q[0]), wert(q[1])]; }); art = 'wendel'; }
    else { // gerader Lauf: gleiche Tiefe von geraderLaufAb bis laufEnde (Stufe 7 bis zur letzten Stufe)
      var erste = Object.keys(T.wendel || {}).filter(function (k) { return /^\d+$/.test(k); }).length + 1, anz = T.steigungen - erste, tiefe = (U1 - U0) / anz, u0 = U0 + (n - erste) * tiefe;
      uv = [[u0, 0], [u0 + tiefe, 0], [u0 + tiefe, W], [u0, W]]; art = 'gerade';
    }
    var poly = uv.map(function (q) { return zuXZ(q[0], q[1]); });
    stufen.push({ n: n, art: art, uv: uv, polygon: poly, hoehe: n * steigung, unterkante: n * steigung - dicke, schwerpunkt: schwerpunkt(poly) });
  }
  var umriss = null;
  if (typeof polygonClipping !== 'undefined' && stufen.length) {
    var u = polygonClipping.union.apply(null, stufen.map(function (s) { return [[s.polygon.concat([s.polygon[0]])]]; }));
    umriss = u.length ? u[0][0].slice(0, -1) : null;
  }
  function stufeBei(x, z) {
    for (var k = 0; k < stufen.length; k++) if (imRing(stufen[k].polygon, x, z)) return stufen[k];
    return null;
  }
  return {
    steigung: steigung, auftritt: T.auftritt, laufbreite: W, dicke: dicke, anker: [ax, az], steigungen: T.steigungen, stufen: stufen, umriss: umriss,
    lauflinie: stufen.map(function (s) { return s.schwerpunkt; }), zuXZ: zuXZ, stufeBei: stufeBei,
    hoeheBei: function (x, z) { var s = stufeBei(x, z); return s ? s.hoehe : null; }
  };
}

/* Lichte Höhe über der Lauflinie (Linie durch die Flächenschwerpunkte der Stufen), geprüft alle 25 mm. Über der Treppenöffnung im DG-Boden
   begrenzt die Dachhaut abzüglich Sparrenabstand, sonst die Unterseite der Decke (lichte Höhe EG). */
function treppeKopfhoehe(haus, WV, T, dach) {
  var lichte = haus.geschosse.EG.lichteHoehe, oef = haus.dg && haus.dg.treppenoeffnung ? haus.dg.treppenoeffnung.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; }) : null;
  function imRing(r, x, z) {
    var ins = false, i, j;
    for (i = 0, j = r.length - 1; i < r.length; j = i++) { var a = r[j], b = r[i]; if ((b[1] > z) !== (a[1] > z) && x < (a[0] - b[0]) * (z - b[1]) / (a[1] - b[1]) + b[0]) ins = !ins; }
    return ins;
  }
  var L = T.lauflinie, stellen = [], k, j, min = Infinity, minStelle = null;
  function pruefe(x, z) {
    var s = T.stufeBei(x, z);
    if (!s) { // zwischen den Stufen: die nächste Stufe (Schwerpunkt) bestimmt die Höhe
      var best = 1e18; T.stufen.forEach(function (t) { var d = Math.hypot(t.schwerpunkt[0] - x, t.schwerpunkt[1] - z); if (d < best) { best = d; s = t; } });
    }
    var offen = oef && imRing(oef, x, z), grenze, art;
    if (offen) {
      var r = dach ? dach.hoehe(x, z) : -1e9;
      grenze = r < -1e8 ? Infinity : r - haus.dg.wandAbstandDachhaut; art = 'dach';
    } else { grenze = lichte; art = 'decke'; }
    var st = { x: x, z: z, stufe: s.n, tritt: s.hoehe, hoehe: grenze - s.hoehe, art: art };
    stellen.push(st);
    if (st.hoehe < min) { min = st.hoehe; minStelle = st; }
  }
  for (k = 0; k + 1 < L.length; k++) {
    var a = L[k], b = L[k + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 25));
    for (j = 0; j < n; j++) pruefe(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n);
  }
  if (L.length) pruefe(L[L.length - 1][0], L[L.length - 1][1]);
  return { min: min, stufe: minStelle ? minStelle.stufe : null, ort: minStelle ? [minStelle.x, minStelle.z] : null, stellen: stellen };
}
if (typeof require !== 'undefined') var polygonClipping = require('polygon-clipping');
if (typeof module !== 'undefined') module.exports = { treppeAbleiten: treppeAbleiten, treppeKopfhoehe: treppeKopfhoehe };
