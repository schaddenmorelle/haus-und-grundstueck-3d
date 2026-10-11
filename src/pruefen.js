/* Prüfen: Regeln über das abgeleitete Modell (Plan docs/plan-parametrisches-modell.md, Abschnitt 5.1). Ohne Three.js, in Node testbar.
   pruefen(haus, WV, abl, dach) → Befunde[]; ein Befund ist { regel, stufe, text, elemente, ort, geschoss }.
     stufe:    'fehler' (Modell ist in sich widersprüchlich), 'warnung' (auffällig, prüfen), 'hinweis' (zur Kenntnis)
     elemente: IDs betroffener Wände, Räume, Öffnungen
     ort:      [hx, hz] in mm hausrelativ oder null
   Regeln: 1 Teilflächen und Stempel · 2 Wandüberschneidungen · 3 freie Enden, Stummel, Wände außerhalb · 4 Öffnungen ·
           7 Flächenbilanz · 9 Maßketten · 10 Geschosshöhe · 11 Treppe (Steigung, Schrittmaß, Öffnung) · 12 Höhen der Öffnungen ·
           13 Kniewände im Dachausbau. Maße in mm. */
if (typeof require !== 'undefined') { var polygonClipping = require('polygon-clipping'); var RA = require('./raeume.js'); }

function pruefen(haus, WV, abl, dach) {
  var R = typeof RA !== 'undefined' ? RA : { imWandRing: imWandRing, ringFlaeche: ringFlaeche, multiFlaeche: multiFlaeche, geschossRing: geschossRing };
  var out = [], TOL = 1; // 1 mm
  function b(regel, stufe, text, elemente, ort, geschoss) { out.push({ regel: regel, stufe: stufe, text: text, elemente: elemente || [], ort: ort || null, geschoss: geschoss || null }); }
  function m1(v) { return (Math.round(v / 10) / 100).toFixed(2).replace('.', ',') + ' m'; }
  function mm(v) { return Math.round(v * 10) / 10 + ' mm'; }
  function pos(p) { return 'hx ' + (Math.round(p[0] / 10) / 100).toFixed(2).replace('.', ',') + ' / hz ' + (Math.round(p[1] / 10) / 100).toFixed(2).replace('.', ','); }
  function laenge(ln) { return Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1]); }
  function achse(fl) { var L = laenge(fl.linie); return [(fl.linie.b[0] - fl.linie.a[0]) / L, (fl.linie.b[1] - fl.linie.a[1]) / L]; }
  function mitte(ring) { var x = 0, z = 0; ring.forEach(function (p) { x += p[0]; z += p[1]; }); return [x / ring.length, z / ring.length]; }
  function geschlossen(r) { return r.concat([r[0]]); }
  function gestreckt(fl, d) { // Wandrechteck an beiden Enden um d mm länger
    var u = achse(fl), c = mitte(fl.ring);
    return fl.ring.map(function (p) { var t = (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1], sg = t >= 0 ? 1 : -1; return [p[0] + sg * u[0] * d, p[1] + sg * u[1] * d]; });
  }
  function pfad(o, p) { return p.split('.').reduce(function (v, k) { return v == null ? v : v[k]; }, o); }
  var geschosse = Object.keys(abl.geschosse);

  /* ---- Regel 1: jede Teilfläche hat genau einen Raumstempel ---- */
  geschosse.forEach(function (g) {
    var gs = abl.geschosse[g];
    gs.teilflaechen.forEach(function (t) {
      var c = mitte(t.polygon[0]);
      if (t.raeume.length === 0) {
        if (t.flaeche < 100) b(1, 'hinweis', 'Splitter von ' + mm(t.flaeche) + '² ohne Raum (' + g + ' bei ' + pos(c) + ')', [], c, g);
        else b(1, 'fehler', 'Unbenannte Teilfläche ohne Raum (' + g + ', ' + (t.flaeche / 1e6).toFixed(2).replace('.', ',') + ' m² bei ' + pos(c) + '); fehlt ein Raumstempel oder eine Trennlinie?', [], c, g);
      } else if (t.raeume.length > 1) {
        b(1, 'fehler', 'Räume nicht getrennt: ' + t.raeume.join(' und ') + ' bilden eine Fläche (' + g + ', ' + (t.flaeche / 1e6).toFixed(2).replace('.', ',') + ' m²); es fehlt eine Wand oder Trennlinie', t.raeume.slice(), c, g);
      }
    });
  });
  abl.raeume.forEach(function (r) {
    if (r.teilflaeche < 0) b(1, 'fehler', 'Raum ' + r.id + ' (' + r.name + '): Der Stempel bei ' + pos(r.stempel) + ' liegt in keiner freien Fläche, vermutlich in einer Wand', [r.id], r.stempel, r.geschoss);
  });

  /* ---- Regeln 2 und 3: Wände untereinander, freie Enden, Stummel, Wände außerhalb der Hülle ---- */
  geschosse.forEach(function (g) {
    var gs = abl.geschosse[g], fl = gs.waende.filter(function (w) { return !w.trennlinie; });
    function ende(w, k) { // verlängertes Ende der gebauten Wand: k = 0 Anfang, 1 Ende
      var ln = w.linie, ext = w.wand.verlaengerung || 0, u = achse(w);
      return k ? [ln.b[0] + u[0] * ext, ln.b[1] + u[1] * ext] : [ln.a[0] - u[0] * ext, ln.a[1] - u[1] * ext];
    }
    function endetIn(a, bb) { return [0, 1].some(function (k) { var e = ende(a, k); return R.imWandRing(bb.ring, e[0], e[1], TOL); }); }
    var hull = polygonClipping.union([[geschlossen(haus.huelle.aussen.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; }))]]);
    for (var i = 0; i < fl.length; i++) {
      for (var j = i + 1; j < fl.length; j++) {
        var A = fl[i], B = fl[j], ua = achse(A), ub = achse(B);
        var ov = polygonClipping.intersection([geschlossen(A.ring)], [geschlossen(B.ring)]);
        if (!ov.length) continue;
        var fOv = R.multiFlaeche(ov);
        if (fOv < TOL) continue;
        var parallel = Math.abs(ua[0] * ub[1] - ua[1] * ub[0]) < 1e-9, c = mitte(ov[0][0]);
        if (parallel) { // dieselbe Richtung: Überlappung in Länge und Dicke
          var nu = [-ua[1], ua[0]], pu = [], pn = [];
          A.ring.concat(B.ring).forEach(function (p, k) { var t = [p[0] * ua[0] + p[1] * ua[1], p[0] * nu[0] + p[1] * nu[1]]; (k < A.ring.length ? pu : pn).push(t); });
          var iv = function (arr, d) { var s = arr.map(function (t) { return t[d]; }); return [Math.min.apply(null, s), Math.max.apply(null, s)]; };
          var uA = iv(pu, 0), nA = iv(pu, 1), uB = iv(pn, 0), nB = iv(pn, 1);
          if (Math.min(uA[1], uB[1]) - Math.max(uA[0], uB[0]) > TOL && Math.min(nA[1], nB[1]) - Math.max(nA[0], nB[0]) > TOL)
            b(2, 'fehler', 'Wände ' + A.id + ' und ' + B.id + ' überlappen sich auf derselben Linie (' + (fOv / 1e6).toFixed(3).replace('.', ',') + ' m²)', [A.id, B.id], c, g);
        } else if (!endetIn(A, B) && !endetIn(B, A)) {
          // Liegt die Überlappung ganz in einer dritten Wand, treffen sich drei Wände in einem Knoten (z. B. zwei Wände und eine Schrägwand, die in einer Ecke endet)
          var andere = fl.filter(function (o) { return o !== A && o !== B; }).map(function (o) { return [geschlossen(o.ring)]; });
          var rest = andere.length ? polygonClipping.difference.apply(null, [ov].concat(andere)) : ov, fRest = R.multiFlaeche(rest);
          if (fRest >= TOL) b(2, 'fehler', 'Wand ' + A.id + ' schneidet Wand ' + B.id + ' (läuft hindurch, ' + (fRest / 1e6).toFixed(3).replace('.', ',') + ' m² Überlappung)', [A.id, B.id], c, g);
        }
      }
    }
    fl.forEach(function (w) {
      var L = laenge(w.linie);
      if (L < 50) b(3, 'warnung', 'Wandstummel ' + w.id + ' (' + mm(L) + ' lang)', [w.id], mitte(w.ring), g);
      if (!w.wand.freiesEnde) [0, 1].forEach(function (k) {
        // gestützt: das Ende liegt in einer anderen Wand oder eine seiner beiden Kappenecken an einer anderen Wand (L-, Z-Anschluss)
        var e = ende(w, k), punkte = [e, w.roh[k ? 1 : 0], w.roh[k ? 2 : 3]];
        var gestuetzt = fl.some(function (o) { return o !== w && punkte.some(function (q) { return R.imWandRing(o.roh, q[0], q[1], TOL); }); });
        if (!gestuetzt) b(3, 'warnung', 'Wand ' + w.id + ' endet frei (' + (k ? 'Ende' : 'Anfang') + ' bei ' + pos(e) + '); gewollt? Dann freiesEnde: true setzen', [w.id], e, g);
      });
      var aus = polygonClipping.difference([geschlossen(w.ring)], hull);
      if (aus.length && R.multiFlaeche(aus) > TOL) b(3, 'fehler', 'Wand ' + w.id + ' liegt außerhalb der Hülle (' + (R.multiFlaeche(aus) / 1e6).toFixed(3).replace('.', ',') + ' m²)', [w.id], mitte(aus[0][0]), g);
    });

    /* ---- Regel 4: Öffnungen liegen in der Wand, überlappen sich nicht, Abstand zu Wandstößen ---- */
    fl.forEach(function (w) {
      var ln = w.linie, L = laenge(ln), u = achse(w), os = w.wand.oeffnungen || [];
      if (!os.length) return;
      var along = Math.abs(ln.b[0] - ln.a[0]) >= Math.abs(ln.b[1] - ln.a[1]) ? 0 : 1, dir = ln.b[along] >= ln.a[along] ? 1 : -1;
      var iv = os.map(function (o, k) {
        var ab = typeof o.ab === 'number' ? o.ab : (WV.mm(o.ab) - ln.a[along]) * dir;
        return { s0: ab, s1: ab + o.breite, o: o, name: 'Öffnung ' + (k + 1) + ' (' + o.art + ') in ' + w.id };
      });
      var stoesse = []; // Bereiche entlang der Wand, in denen eine querlaufende Wand anschließt
      fl.forEach(function (o) {
        if (o === w) return;
        var uo = achse(o);
        if (Math.abs(u[0] * uo[1] - u[1] * uo[0]) < 1e-9) return;
        // 2 mm in Wandrichtung länger, einmal die andere Wand (sie endet an w) und einmal w selbst (w endet an der anderen Wand): auch bündig anliegende Wände erzeugen einen Stoß
        var s = [];
        [polygonClipping.intersection([geschlossen(w.ring)], [geschlossen(gestreckt(o, 2))]), polygonClipping.intersection([geschlossen(gestreckt(w, 2))], [geschlossen(o.ring)])].forEach(function (ov) {
          if (!ov.length || R.multiFlaeche(ov) < TOL) return;
          ov.forEach(function (p) { p[0].forEach(function (q) { s.push((q[0] - ln.a[0]) * u[0] + (q[1] - ln.a[1]) * u[1]); }); });
        });
        if (s.length) stoesse.push({ id: o.id, s0: Math.min.apply(null, s), s1: Math.max.apply(null, s) });
      });
      iv.forEach(function (v, k) {
        var ort = [ln.a[0] + u[0] * (v.s0 + v.s1) / 2, ln.a[1] + u[1] * (v.s0 + v.s1) / 2];
        if (v.s0 < -TOL || v.s1 > L + TOL) b(4, 'fehler', v.name + ' ragt über das Wandende hinaus (' + mm(v.s0) + ' bis ' + mm(v.s1) + ', Wandlänge ' + mm(L) + ')', [w.id], ort, g);
        for (var q = k + 1; q < iv.length; q++) if (Math.min(v.s1, iv[q].s1) - Math.max(v.s0, iv[q].s0) > TOL) b(4, 'fehler', 'Öffnungen in ' + w.id + ' überlappen sich (' + mm(v.s0) + '–' + mm(v.s1) + ' und ' + mm(iv[q].s0) + '–' + mm(iv[q].s1) + ')', [w.id], ort, g);
        stoesse.forEach(function (s) {
          var ueber = Math.min(v.s1, s.s1) - Math.max(v.s0, s.s0);
          if (ueber > TOL) b(4, 'fehler', v.name + ' liegt im Wandstoß mit ' + s.id + ' (' + mm(ueber) + ' Überschneidung)', [w.id, s.id], ort, g);
          else {
            var luecke = Math.max(s.s0 - v.s1, v.s0 - s.s1);
            if (luecke > TOL && luecke < 50) b(4, 'hinweis', v.name + ': Abstand zum Wandstoß mit ' + s.id + ' nur ' + mm(luecke), [w.id, s.id], ort, g);
          }
        });
      });
    });
  });

  /* ---- Regel 7: Flächenbilanz ---- */
  geschosse.forEach(function (g) {
    var gs = abl.geschosse[g], summe = gs.teilflaechen.reduce(function (a, t) { return a + t.flaeche; }, 0) + gs.wandflaeche;
    if (Math.abs(summe - gs.flaeche) > TOL) b(7, 'fehler', 'Flächenbilanz ' + g + ': Räume + Wände = ' + (summe / 1e6).toFixed(4).replace('.', ',') + ' m², Geschossfläche ' + (gs.flaeche / 1e6).toFixed(4).replace('.', ',') + ' m²', [], null, g);
  });

  /* ---- Regel 9: Maßketten (Summe der Teile = Abstand zweier Achsen) ---- */
  (haus.ketten || []).forEach(function (k) {
    var gesamt = Math.abs(WV.mm(k.gesamt[1]) - WV.mm(k.gesamt[0])), summe = 0;
    k.teile.forEach(function (t) { summe += typeof t.wert === 'number' ? t.wert : pfad(haus, t.wert); });
    var rest = gesamt - summe;
    if (Math.abs(rest) < 1e-9) return;
    var text = 'Maßkette ' + (k.name || k.id) + ': Teile ' + mm(summe) + ' gegenüber Gesamtmaß ' + mm(gesamt) + ', Rest ' + mm(rest);
    b(9, Math.abs(rest) <= 20 ? 'hinweis' : 'warnung', text, [k.id], null, null);
  });

  /* ---- Regel 10: Geschosshöhe = lichte Höhe + Deckenaufbau ---- */
  if (haus.geschosse.DG && haus.geschosse.DG.deckenaufbau != null) {
    var gh = haus.geschosse.DG.okff - haus.geschosse.EG.okff, soll = haus.geschosse.EG.lichteHoehe + haus.geschosse.DG.deckenaufbau;
    if (gh !== soll) b(10, 'fehler', 'Geschosshöhe ' + mm(gh) + ' ist nicht lichte Höhe ' + mm(haus.geschosse.EG.lichteHoehe) + ' + Deckenaufbau ' + mm(haus.geschosse.DG.deckenaufbau) + ' (Differenz ' + mm(gh - soll) + ')', [], null, null);
  }

  /* ---- Regel 11: Treppe ---- */
  var T = haus.treppe;
  if (T && T.steigungen) {
    var hoehe = haus.geschosse.DG.okff - haus.geschosse.EG.okff, st = hoehe / T.steigungen, sm = 2 * st + T.auftritt;
    if (st < 140 || st > 210) b(11, 'fehler', 'Treppe: Steigung ' + mm(st) + ' (Geschosshöhe ' + mm(hoehe) + ' durch ' + T.steigungen + ') liegt außerhalb 140–210 mm', ['treppe'], null, null);
    if (sm < 590 || sm > 650) b(11, 'warnung', 'Treppe: Schrittmaß 2s + a = ' + mm(sm) + ' liegt außerhalb 590–650 mm', ['treppe'], null, null);
    if (haus.dg && haus.dg.treppenoeffnung && T.anker) {
      var ax = WV.mm(T.anker[0]), az = WV.mm(T.anker[1]), lauf = [[ax - T.laufEnde, az - T.laufbreite], [ax - T.geraderLaufAb, az - T.laufbreite], [ax - T.geraderLaufAb, az], [ax - T.laufEnde, az]];
      var oef = haus.dg.treppenoeffnung.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; });
      var aussen = polygonClipping.difference([geschlossen(lauf)], [geschlossen(oef)]);
      if (aussen.length && R.multiFlaeche(aussen) > TOL) b(11, 'fehler', 'Treppenöffnung umfasst den geraden Lauf nicht (' + (R.multiFlaeche(aussen) / 1e6).toFixed(3).replace('.', ',') + ' m² des Laufs liegen außerhalb)', ['treppe'], mitte(lauf), 'DG');
    }
  }

  /* ---- Regel 12: Höhen der Öffnungen im EG ---- */
  var lichte = haus.geschosse.EG.lichteHoehe;
  haus.waende.forEach(function (w) {
    if (w.geschoss !== 'EG') return;
    (w.oeffnungen || []).forEach(function (o, k) {
      var name = 'Öffnung ' + (k + 1) + ' (' + o.art + ') in ' + w.id, br = o.bruestung || 0;
      if (o.breite <= 0 || o.hoehe <= 0) b(12, 'fehler', name + ': Breite und Höhe müssen größer 0 sein', [w.id], null, 'EG');
      if (br < 0) b(12, 'fehler', name + ': Brüstung ' + mm(br) + ' ist negativ', [w.id], null, 'EG');
      if (br + o.hoehe > lichte) b(12, 'fehler', name + ': Oberkante (Sturz) bei ' + mm(br + o.hoehe) + ' liegt über der Decke (lichte Höhe ' + mm(lichte) + ')', [w.id], null, 'EG');
    });
  });

  /* ---- Regel 12 im Dachausbau: Öffnungen mit Höhe liegen unter der Wandoberkante (Dachhaut − Sparrenabstand, Kniewand höchstens hoehe.max) ---- */
  if (dach && haus.dg && abl.geschosse.DG) abl.geschosse.DG.waende.forEach(function (w) {
    if (w.trennlinie || !(w.wand.oeffnungen || []).length) return;
    var ln = w.linie, L = laenge(ln), u = achse(w), yD = haus.geschosse.DG.okff, hmax = w.wand.hoehe && w.wand.hoehe.max, nurB = w.wand.dach === 'B';
    var along = Math.abs(ln.b[0] - ln.a[0]) >= Math.abs(ln.b[1] - ln.a[1]) ? 0 : 1, dir = ln.b[along] >= ln.a[along] ? 1 : -1;
    w.wand.oeffnungen.forEach(function (o, k) {
      if (typeof o.hoehe !== 'number') return;
      var ab = typeof o.ab === 'number' ? o.ab : (WV.mm(o.ab) - ln.a[along]) * dir, oben = (o.bruestung || 0) + o.hoehe, niedrigste = 1e9, n = Math.max(1, Math.ceil(o.breite / 50));
      for (var i = 0; i <= n; i++) {
        var s = ab + o.breite * i / n, x = ln.a[0] + u[0] * s, z = ln.a[1] + u[1] * s;
        niedrigste = Math.min(niedrigste, dach.wandOK(x, z, hmax, nurB) - yD);
      }
      if (oben > niedrigste + 1e-6) b(12, 'fehler', 'Öffnung ' + (k + 1) + ' (' + o.art + ') in ' + w.id + ': Oberkante bei ' + mm(oben) + ' liegt über der Wandoberkante (' + mm(niedrigste) + ')', [w.id], [ln.a[0] + u[0] * (ab + o.breite / 2), ln.a[1] + u[1] * (ab + o.breite / 2)], 'DG');
    });
  });

  /* ---- Regel 13: Wände im Dachausbau unter den Sparren, Kniewandhöhe ---- */
  if (dach && haus.dg) {
    var yD = haus.geschosse.DG.okff, soll13 = haus.dg.kniewandSoll, tol13 = haus.dg.kniewandToleranz == null ? 50 : haus.dg.kniewandToleranz;
    abl.geschosse.DG && abl.geschosse.DG.waende.forEach(function (w) {
      if (w.trennlinie) return;
      var ln = w.linie, L = laenge(ln), n = Math.max(1, Math.ceil(L / 100)), hmax = w.wand.hoehe && w.wand.hoehe.max, nurB = w.wand.dach === 'B', minH = 1e9, minAt = null;
      for (var i = 0; i <= n; i++) {
        var x = ln.a[0] + (ln.b[0] - ln.a[0]) * i / n, z = ln.a[1] + (ln.b[1] - ln.a[1]) * i / n, top = dach.wandOK(x, z, hmax, nurB), h = top - yD, roof = dach.hoehe(x, z);
        if (h > (hmax || haus.dg.wandHoechst) + 1e-6) b(13, 'fehler', 'Wand ' + w.id + ' ist ' + mm(h) + ' hoch, höchstens ' + mm(hmax || haus.dg.wandHoechst) + ' erlaubt', [w.id], [x, z], 'DG');
        if (roof > -1e8 && !nurB && top > roof - haus.dg.wandAbstandDachhaut + 1e-6) b(13, 'fehler', 'Wand ' + w.id + ' reicht bis ' + mm(roof - top) + ' an die Dachhaut, mindestens ' + mm(haus.dg.wandAbstandDachhaut) + ' für die Sparren', [w.id], [x, z], 'DG');
        if (h < minH) { minH = h; minAt = [x, z]; }
      }
      if (hmax && soll13 && minH < soll13 - tol13) b(13, 'warnung', 'Kniewand ' + w.id + ' nur ' + mm(minH) + ' hoch (Soll ' + mm(soll13) + ' ± ' + mm(tol13) + ', die Dachhaut minus Sparrenabstand begrenzt) bei ' + pos(minAt), [w.id], minAt, 'DG');
    });
  }
  return out;
}
if (typeof module !== 'undefined') module.exports = { pruefen: pruefen };
