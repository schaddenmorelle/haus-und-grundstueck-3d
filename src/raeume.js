/* Räume: leitet Wandflächen, Teilflächen und Räume aus src/data/haus.json ab. Ohne Three.js, in Node testbar.
   Alle Maße in Millimetern, hausrelativ (hx nach Osten, hz nach Süden).

   Ablauf je Geschoss:  Geschossfläche  −  Vereinigung aller Wandflächen (und Trennlinien)  =  Teilflächen.
   Jede Teilfläche gehört zu dem Raum, dessen Stempel (ein Punkt in haus.raeume[].stempel) in ihr liegt.
   Durchgänge und Türen sind Öffnungen in durchgehenden Wänden und trennen Räume nicht auf. Eine Trennlinie (haus.trennlinien)
   ist eine Raumgrenze ohne Wand, z. B. wo ein Flur offen in einen Raum übergeht; sie hat keine Dicke (rechnerisch 0,01 mm).
   Geschossfläche: EG = Außenkante des Hauses (huelle.aussen), DG = Ausbaufläche (dg.ausbauflaeche). Das Clipping übernimmt
   die Bibliothek polygon-clipping (MIT). */
if (typeof require !== 'undefined') var polygonClipping = require('polygon-clipping');

var TRENNLINIE_MM = 0.01;

/* Mittellinie, Dicke und Normale einer Wand in mm; n zeigt von der Mittellinie zur Flucht-Seite (bei Außenwänden nach außen). */
function wandLinie(haus, WV, w) {
  var tm = w.dicke != null ? w.dicke : WV.dicke(w.typ), d = tm / 2, n = [0, 0], sg;
  var a = [WV.mm(w.von[0]), WV.mm(w.von[1])], b = [WV.mm(w.bis[0]), WV.mm(w.bis[1])];
  var horiz = a[1] === b[1], vert = a[0] === b[0];
  if (w.flucht === 'mitte') n = [0, 0];
  else if (horiz && (w.flucht === 'oben' || w.flucht === 'unten')) { sg = w.flucht === 'oben' ? 1 : -1; a[1] += sg * d; b[1] += sg * d; n = [0, -sg]; }
  else if (vert && (w.flucht === 'links' || w.flucht === 'rechts')) { sg = w.flucht === 'links' ? 1 : -1; a[0] += sg * d; b[0] += sg * d; n = [-sg, 0]; }
  else throw new Error('Wand ' + w.id + ': Flucht "' + w.flucht + '" passt nicht zur Richtung der Wand');
  return { a: a, b: b, t: tm, n: n };
}

/* Rechteck der Wand (4 Eckpunkte, mm); ext verlängert beide Enden (verlaengerung der Wand). */
function wandRing(ln, ext) {
  var dx = ln.b[0] - ln.a[0], dz = ln.b[1] - ln.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  var nx = -uz * ln.t / 2, nz = ux * ln.t / 2, a = [ln.a[0] - ux * ext, ln.a[1] - uz * ext], b = [ln.b[0] + ux * ext, ln.b[1] + uz * ext];
  return [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
}

function ringFlaeche(r) { // vorzeichenlose Fläche eines Rings in mm² (offen oder geschlossen)
  var s = 0;
  for (var i = 0; i < r.length; i++) { var a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}
function polyFlaeche(p) { // Polygon [außen, Löcher…] in mm²
  var s = ringFlaeche(p[0]);
  for (var i = 1; i < p.length; i++) s -= ringFlaeche(p[i]);
  return s;
}
function multiFlaeche(mp) { return mp.reduce(function (s, p) { return s + polyFlaeche(p); }, 0); }
function offenerRing(r) { // ohne den doppelten Schlusspunkt des Clippings
  var f = r[0], l = r[r.length - 1];
  return f[0] === l[0] && f[1] === l[1] ? r.slice(0, -1) : r.slice();
}
function ringBereinigt(r, tol) { // Eckpunkte entfernen, die näher als tol mm (Standard 1 mm) am Vorgänger oder an der Verbindung ihrer Nachbarn liegen
  tol = tol == null ? 1 : tol;
  var p = offenerRing(r), ok = true, i;
  while (ok && p.length > 3) {
    ok = false;
    for (i = 0; i < p.length; i++) {
      var a = p[(i + p.length - 1) % p.length], b = p[i], c = p[(i + 1) % p.length];
      var dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz);
      var abstand = Math.hypot(b[0] - a[0], b[1] - a[1]) < tol ? 0 : (L < tol ? Math.hypot(b[0] - a[0], b[1] - a[1]) : Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / L);
      if (abstand < tol) { p.splice(i, 1); ok = true; break; }
    }
  }
  return p;
}
function imRing(r, x, z) { // Punkt im (offenen) Ring, Strahlverfahren
  var ins = false;
  for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
    var a = r[j], b = r[i];
    if ((b[1] > z) !== (a[1] > z) && x < (a[0] - b[0]) * (z - b[1]) / (a[1] - b[1]) + b[0]) ins = !ins;
  }
  return ins;
}
function imPolygon(p, x, z) { // Polygon [außen, Löcher…]
  if (!imRing(offenerRing(p[0]), x, z)) return false;
  for (var i = 1; i < p.length; i++) if (imRing(offenerRing(p[i]), x, z)) return false;
  return true;
}
function mpVonRing(r) { return [[r.concat([r[0]])]]; }
function vereinigen(ringe) { // Vereinigung beliebig vieler Ringe als MultiPolygon
  if (!ringe.length) return [];
  var m = ringe.map(function (r) { return [r]; });
  return polygonClipping.union.apply(null, m);
}

/* Geschossfläche als Ring in mm */
function geschossRing(haus, WV, g) {
  var pts = g === 'EG' ? haus.huelle.aussen : haus.dg.ausbauflaeche;
  return pts.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; });
}

/* Punkt im (konvexen) Wandrechteck, Rand eingeschlossen */
function imWandRing(ring, x, z, tol) {
  tol = tol == null ? 1e-6 : tol;
  var s = 0;
  for (var i = 0; i < ring.length; i++) {
    var a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    var c = ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) / L; // Abstand links der Kante (vorzeichenbehaftet)
    if (c > tol) { if (s < 0) return false; s = 1; } else if (c < -tol) { if (s > 0) return false; s = -1; }
  }
  return true;
}
function ringKappen(ring, px, pz, nx, nz) { // Ring (konvex) auf die Halbebene (p − P)·n ≥ 0 beschneiden (Sutherland–Hodgman)
  var out = [], i;
  for (i = 0; i < ring.length; i++) {
    var a = ring[i], b = ring[(i + 1) % ring.length], da = (a[0] - px) * nx + (a[1] - pz) * nz, db = (b[0] - px) * nx + (b[1] - pz) * nz;
    if (da >= 0) out.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) { var t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
/* Wandenden: Endet eine Wand A mit ihrer Mittellinie in einer quer verlaufenden Wand B, wird A an der abgewandten Seite von B gekappt
   (T- oder L-Stoß). Sonst ragen die Ecken einer schrägen Wand, ihr Ende ist ja nicht rechtwinklig, hinter B in den Nachbarraum. */
function wandEndenKappen(fl) {
  fl.forEach(function (A) {
    var ln = A.linie, L = Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1]), ux = (ln.b[0] - ln.a[0]) / L, uz = (ln.b[1] - ln.a[1]) / L, ext = A.wand.verlaengerung || 0;
    [[[ln.a[0] - ux * ext, ln.a[1] - uz * ext], 1], [[ln.b[0] + ux * ext, ln.b[1] + uz * ext], -1]].forEach(function (end) {
      var e = end[0], ix = ux * end[1], iz = uz * end[1]; // e: gebautes Ende, (ix, iz): von dort in die Wand hinein
      fl.forEach(function (B) {
        if (B === A || !imWandRing(B.ring, e[0], e[1])) return;
        var bl = B.linie, bL = Math.hypot(bl.b[0] - bl.a[0], bl.b[1] - bl.a[1]), bx = (bl.b[0] - bl.a[0]) / bL, bz = (bl.b[1] - bl.a[1]) / bL;
        var nx = -bz, nz = bx, c = nx * ix + nz * iz;                       // Normale von B; c < 0: A läuft zur −n-Seite
        if (Math.abs(c) < 1e-9) return;                                      // parallel: kein Stoß
        var sg = c > 0 ? 1 : -1, cx = (bl.a[0] + bl.b[0]) / 2, cz = (bl.a[1] + bl.b[1]) / 2, h = bl.t / 2;
        // die abgewandte Fläche von B liegt bei −sg·h; behalten wird sg·(p − c)·n ≥ −h
        var px = cx - sg * nx * h, pz = cz - sg * nz * h, k = ringKappen(A.ring, px, pz, sg * nx, sg * nz);
        if (k.length >= 3) A.ring = k;
      });
    });
  });
}

/* Wandrechtecke eines Geschosses: [{ id, wand, linie, roh (volles Rechteck), ring (an Querwänden gekappt) }]; Trennlinien zusätzlich mit trennlinie: true */
function wandFlaechen(haus, WV, g) {
  var out = [];
  haus.waende.forEach(function (w) {
    if (w.geschoss !== g) return;
    var ln = wandLinie(haus, WV, w), roh = wandRing(ln, w.verlaengerung || 0);
    out.push({ id: w.id, wand: w, linie: ln, roh: roh, ring: roh });
  });
  wandEndenKappen(out);
  (haus.trennlinien || []).forEach(function (t) {
    if (t.geschoss !== g) return;
    var ln = wandLinie(haus, WV, { id: t.id, von: t.von, bis: t.bis, flucht: 'mitte', dicke: TRENNLINIE_MM });
    out.push({ id: t.id, wand: t, linie: ln, roh: wandRing(ln, 0), ring: wandRing(ln, 0), trennlinie: true });
  });
  return out;
}

/* Leitet alle Räume ab. Ergebnis:
     geschosse[g] = { flaeche (mm²), wandflaeche (mm²), teilflaechen: [{ polygon, flaeche, raeume: [id…] }], waende: wandFlaechen() }
     raeume[]     = { id, name, geschoss, boden, notiz, stempel, teilflaeche (Index oder -1), ring (Außenring in mm, bereinigt), polygon, flaeche (mm²) }
   Befunde entstehen erst in pruefen.js. */
function raeumeAbleiten(haus, WV) {
  var out = { geschosse: {}, raeume: [] };
  ['EG', 'DG'].forEach(function (g) {
    if (g === 'DG' && !(haus.dg && haus.dg.ausbauflaeche)) return;
    var boden = geschossRing(haus, WV, g), waende = wandFlaechen(haus, WV, g);
    var wandU = vereinigen(waende.map(function (w) { return w.ring; }));
    var frei = wandU.length ? polygonClipping.difference(mpVonRing(boden), wandU) : mpVonRing(boden);
    var imBoden = wandU.length ? polygonClipping.intersection(mpVonRing(boden), wandU) : [];
    var gs = out.geschosse[g] = {
      flaeche: ringFlaeche(boden), wandflaeche: multiFlaeche(imBoden), boden: boden, waende: waende, wandUnion: wandU,
      teilflaechen: frei.map(function (p) { return { polygon: p, flaeche: polyFlaeche(p), raeume: [] }; })
    };
    haus.raeume.forEach(function (r) {
      if (r.geschoss !== g) return;
      var st = [WV.mm(r.stempel[0]), WV.mm(r.stempel[1])], idx = -1;
      gs.teilflaechen.forEach(function (t, i) { if (idx < 0 && imPolygon(t.polygon, st[0], st[1])) idx = i; });
      var tf = idx >= 0 ? gs.teilflaechen[idx] : null;
      if (tf) tf.raeume.push(r.id);
      out.raeume.push({
        id: r.id, name: r.name, geschoss: g, boden: r.boden, notiz: r.notiz, stempel: st, teilflaeche: idx,
        ring: tf ? ringBereinigt(tf.polygon[0]) : [], loecher: tf ? tf.polygon.slice(1).map(function (h) { return ringBereinigt(h); }) : [],
        flaeche: tf ? tf.flaeche : 0
      });
    });
  });
  return out;
}

/* Exporte für Node (eine Zeile, der Build entfernt sie aus der Seite) */
if (typeof module !== 'undefined') module.exports = { wandLinie: wandLinie, wandRing: wandRing, raeumeAbleiten: raeumeAbleiten, wandFlaechen: wandFlaechen, geschossRing: geschossRing, ringFlaeche: ringFlaeche, polyFlaeche: polyFlaeche, multiFlaeche: multiFlaeche, offenerRing: offenerRing, ringBereinigt: ringBereinigt, imRing: imRing, imWandRing: imWandRing, imPolygon: imPolygon, vereinigen: vereinigen, mpVonRing: mpVonRing, TRENNLINIE_MM: TRENNLINIE_MM };
