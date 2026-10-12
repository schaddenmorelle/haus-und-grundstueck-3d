/* Dach: Dachhöhe und Oberkante der Dachausbau-Wände aus src/data/haus.json. Ohne Three.js, in Node testbar.
   Alle Maße in Millimetern, hausrelativ (hx nach Osten, hz nach Süden), Höhen ab OKFF EG.
   Zwei Walmflügel (A: Ost-West-First, B: Nord-Süd-First), die Dachhöhe ist das Maximum beider. */
function dachAbleiten(haus, WV) {
  var d = haus.dach, ueber = d.ueberstand, tan = Math.tan(d.neigung * Math.PI / 180), eps = 1e-3;
  function rechteck(f) { return { x0: WV.mm(f.x[0]) - ueber, x1: WV.mm(f.x[1]) + ueber, z0: WV.mm(f.z[0]) - ueber, z1: WV.mm(f.z[1]) + ueber }; }
  var A = rechteck(d.fluegelA), B = d.fluegelB ? rechteck(d.fluegelB) : null;
  function inR(r, x, z) { return x >= r.x0 - eps && x <= r.x1 + eps && z >= r.z0 - eps && z <= r.z1 + eps; }
  function dR(r, x, z) { return Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z); }
  function flaeche(r, x, z) { return d.traufe - ueber * tan + tan * dR(r, x, z); }
  /* Dachhaut über OKFF EG an der Stelle (hx, hz) in mm; -1e9 außerhalb des Daches */
  function hoehe(x, z) {
    var h = -1e9;
    if (inR(A, x, z)) h = Math.max(h, flaeche(A, x, z));
    if (B && inR(B, x, z)) h = Math.max(h, flaeche(B, x, z));
    return h;
  }
  /* Oberkante einer Wand im Dachausbau über OKFF EG: höchstens hmax über dem DG-Boden (Standard dg.wandHoechst) und mindestens
     dg.wandAbstandDachhaut unter der Dachhaut, also unter den Sparren. nurB: nur die Fläche des Flügels B zählt (Querwand). */
  function wandOK(x, z, hmax, nurB) {
    var dg = haus.dg, yD = haus.geschosse.DG.okff, h = nurB && B && inR(B, x, z) ? flaeche(B, x, z) : hoehe(x, z);
    hmax = hmax || dg.wandHoechst;
    return h < -1e8 ? yD + 2200 : Math.min(yD + hmax, h - dg.wandAbstandDachhaut);
  }
  /* First über OKFF EG: der höchste Punkt ist die Mitte der schmaleren Seite eines Flügels */
  function ersteHoehe(r) { return d.traufe - ueber * tan + tan * Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2; }
  var first = Math.max(ersteHoehe(A), B ? ersteHoehe(B) : -1e9);
  return { neigung: d.neigung, tan: tan, ueberstand: ueber, traufe: d.traufe, A: A, B: B, first: first, inR: inR, dR: dR, hoehe: hoehe, wandOK: wandOK };
}
if (typeof module !== 'undefined') module.exports = { dachAbleiten: dachAbleiten };
