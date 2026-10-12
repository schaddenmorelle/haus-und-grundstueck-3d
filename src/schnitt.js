/* Schnitt und Ansicht: leitet aus dem abgeleiteten Modell senkrechte Schnitte und Fassaden ab und zeichnet sie als SVG (Plan docs/plan-parametrisches-modell.md,
   Abschnitt 4.2, Phase 5). Ohne Three.js, in Node testbar. Maße in Millimetern; Höhen ab OKFF EG (nach oben), im SVG ist y = −Höhe.

     schnittLinien(haus, WV)                                   die Schnittlinien aus haus.schnitte: [{ id, name, a, b }] mit a, b = [hx, hz]
     schnittAbleiten(haus, WV, abl, dach, linie)               Schnitt entlang einer beliebigen Linie { id, name, a, b }
     ansichtAbleiten(haus, WV, abl, dach, seite)               Fassade 'N', 'O', 'S' oder 'W' (Blick auf die Außenseite)
     schnittSvg(zeichnung, optionen)                           SVG-Text (zeichnung = Schnitt oder Ansicht); optionen.standalone wie beim Grundriss

   Schnitt: Die Linie läuft von a nach b (s = Abstand von a), der Blick geht nach links der Laufrichtung, so bleibt s im Bild von links nach rechts (Linie nach
   Osten → Blick nach Norden). Geschnitten werden Wände (mit Öffnungen), Decke (Innenseiten der Außenwände ohne Treppenöffnung), Dach (Dachhaut minus
   Sparrenabstand), Treppe (Stufen mit Dicke), Kamin und Dachfenster. Die Oberkanten im Dachausbau und die Dachhaut sind stückweise linear; sie werden abgetastet
   und an den Knicken exakt nachgezogen (profil). Die Kopfhöhe über der Treppe zählt Streifen unter 100 mm Breite nicht (der Kopf passt nicht hinein).
   Ansicht: nur die Außenwände des EG, deren Außenseite zum Betrachter zeigt, mit ihren Öffnungen; dazu Dachsilhouette (höchste Dachhaut je Stelle), Dachfenster,
   die zum Betrachter zeigen, und Kamin. Das Gelände fehlt (es hängt an src/model.js).

   Höhenmaße haben Namen wie die Maße im Grundriss: hoehe:eg.lichte, hoehe:dg.deckenaufbau, hoehe:dg.okff (gesperrt), hoehe:dach.traufe, hoehe:<kniewand>,
   <wand>.oeff<k>.bruestung / .hoehe / .sturz; abgeleitete Höhen (bis zum First) haben abgeleitet: true. Mit diesen Namen spricht src/aendern.js sie an. */
if (typeof require !== 'undefined') { var treppeAbleiten = require('./treppe.js').treppeAbleiten, kettenSchnitt = require('./grundriss.js').kettenSchnitt, planHilfen = require('./grundriss.js').planHilfen; }

var schnittLinien, schnittAbleiten, ansichtAbleiten, schnittSvg;
(function () {
  var EPS = 1e-6, SPARREN_STEP = 25;

  /* ---------- Geometrie ---------- */
  function imRing(r, x, z) {
    var ins = false, i, j;
    for (i = 0, j = r.length - 1; i < r.length; j = i++) {
      var a = r[j], b = r[i];
      if ((b[1] > z) !== (a[1] > z) && x < (a[0] - b[0]) * (z - b[1]) / (a[1] - b[1]) + b[0]) ins = !ins;
    }
    return ins;
  }
  function linie(a, b, id, name) {
    var L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < EPS) throw new Error('Schnittlinie ohne Länge');
    var u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    return { id: id, name: name, a: a, b: b, laenge: L, u: u, blick: [u[1] + 0, -u[0] + 0] };
  }
  function punkt(L, s) { return [L.a[0] + L.u[0] * s, L.a[1] + L.u[1] * s]; }
  function intervalle(L, ring) { // Abschnitte der Linie im Polygon: [[s0, s1], …]
    var ts = [0, L.laenge], i;
    for (i = 0; i < ring.length; i++) {
      var p = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - p[0], dz = q[1] - p[1], wx = p[0] - L.a[0], wz = p[1] - L.a[1];
      var den = L.u[0] * dz - L.u[1] * dx, len = Math.hypot(dx, dz);
      if (Math.abs(den) < 1e-12 * Math.max(1, len)) { // parallel: liegt die Kante auf der Linie, zählen ihre Endpunkte
        if (Math.abs(wx * L.u[1] - wz * L.u[0]) < 1e-6) { ts.push(wx * L.u[0] + wz * L.u[1]); ts.push((q[0] - L.a[0]) * L.u[0] + (q[1] - L.a[1]) * L.u[1]); }
        continue;
      }
      var s = (wx * dz - wz * dx) / den, k = (wx * L.u[1] - wz * L.u[0]) / den;
      if (k >= -EPS && k <= 1 + EPS && s > 0 && s < L.laenge) ts.push(s);
    }
    ts = ts.filter(function (t) { return t >= 0 && t <= L.laenge; }).sort(function (a, b) { return a - b; });
    var out = [];
    for (i = 0; i + 1 < ts.length; i++) {
      if (ts[i + 1] - ts[i] < EPS) continue;
      var m = punkt(L, (ts[i] + ts[i + 1]) / 2);
      if (!imRing(ring, m[0], m[1])) continue;
      if (out.length && Math.abs(out[out.length - 1][1] - ts[i]) < EPS) out[out.length - 1][1] = ts[i + 1]; else out.push([ts[i], ts[i + 1]]);
    }
    return out;
  }
  function abziehen(iv, weg) { // Abschnitte iv ohne die Abschnitte weg
    var out = iv.map(function (x) { return x.slice(); });
    weg.forEach(function (w) {
      var neu = [];
      out.forEach(function (x) {
        if (w[1] <= x[0] + EPS || w[0] >= x[1] - EPS) { neu.push(x); return; }
        if (w[0] > x[0] + EPS) neu.push([x[0], w[0]]);
        if (w[1] < x[1] - EPS) neu.push([w[1], x[1]]);
      });
      out = neu;
    });
    return out;
  }

  /* Stückweise lineare Funktion f(s) auf [s0, s1] als Polylinie: abtasten und an den Knicken exakt nachziehen */
  function profil(f, s0, s1, step) {
    step = step || SPARREN_STEP;
    var n = Math.max(1, Math.ceil((s1 - s0) / step)), S = [], Y = [], m = [], i, gleich = function (a, b) { return Math.abs(a - b) < 1e-6; };
    for (i = 0; i <= n; i++) { var s = s0 + (s1 - s0) * i / n; S.push(s); Y.push(f(s)); }
    for (i = 0; i < n; i++) m.push((Y[i + 1] - Y[i]) / (S[i + 1] - S[i]));
    var rein = m.map(function (v, k) { return (k > 0 && gleich(v, m[k - 1])) || (k < n - 1 && gleich(v, m[k + 1])); });
    var tok = [];
    for (i = 0; i < n;) {
      if (rein[i]) { var j = i; while (j + 1 < n && rein[j + 1] && gleich(m[j + 1], m[i])) j++; tok.push({ run: true, a: i, b: j + 1, m: m[i] }); i = j + 1; }
      else { tok.push({ run: false, i: i }); i++; }
    }
    var pts = [];
    function add(s, y) { var l = pts[pts.length - 1]; if (!l || Math.abs(l[0] - s) > 1e-9 || Math.abs(l[1] - y) > 1e-9) pts.push([s, y]); }
    add(S[0], Y[0]);
    tok.forEach(function (t, k) {
      if (t.run) { add(S[t.a], Y[t.a]); add(S[t.b], Y[t.b]); return; }
      var vor = tok[k - 1], nach = tok[k + 1];
      if (vor && nach && vor.run && nach.run && !gleich(vor.m, nach.m)) { // ein Knick in diesem Abschnitt: Schnittpunkt der beiden Geraden
        var sk = (Y[nach.a] - nach.m * S[nach.a] - Y[vor.a] + vor.m * S[vor.a]) / (vor.m - nach.m);
        if (sk >= S[t.i] - 1e-9 && sk <= S[t.i + 1] + 1e-9) { add(sk, Y[vor.a] + vor.m * (sk - S[vor.a])); return; }
      }
      add(S[t.i], Y[t.i]); add(S[t.i + 1], Y[t.i + 1]);
    });
    add(S[n], Y[n]);
    var out = [pts[0]];
    for (i = 1; i + 1 < pts.length; i++) { // Punkte auf der Verbindung ihrer Nachbarn entfallen
      var a = out[out.length - 1], b = pts[i], c = pts[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L > 0 && Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / L < 0.005) continue;
      out.push(b);
    }
    if (pts.length > 1) out.push(pts[pts.length - 1]);
    return out;
  }
  function praesenz(pred, s0, s1) { // Abschnitte, in denen pred wahr ist (abgetastet, Ränder durch Halbieren)
    var step = 10, n = Math.max(1, Math.ceil((s1 - s0) / step)), out = [], an = null, prev = pred(s0), i;
    function rand(lo, hi) { // lo und hi haben unterschiedliche Werte; Rand auf der wahren Seite finden
      var pl = pred(lo);
      for (var k = 0; k < 40; k++) { var mid = (lo + hi) / 2; if (pred(mid) === pl) lo = mid; else hi = mid; }
      return pl ? lo : hi;
    }
    if (prev) an = s0;
    for (i = 1; i <= n; i++) {
      var s = s0 + (s1 - s0) * i / n, cur = pred(s), sPrev = s0 + (s1 - s0) * (i - 1) / n;
      if (cur && !prev) an = rand(sPrev, s);
      else if (!cur && prev) { out.push([an, rand(sPrev, s)]); an = null; }
      prev = cur;
    }
    if (prev && an != null) out.push([an, s1]);
    return out;
  }

  /* ---------- Daten und Höhen ---------- */
  function nn(haus) { return (haus.bezug && haus.bezug.okffEG) || 0; }
  function koten(haus, dach) {
    return { okffEG: haus.geschosse.EG.okff, deckeUK: haus.geschosse.EG.lichteHoehe, okffDG: haus.geschosse.DG.okff, traufe: haus.dach.traufe, first: dach.first, nn: nn(haus) };
  }
  function wandHoehe(haus, w) { return w.wand.hoehe === 'traufe' ? haus.dach.traufe : haus.geschosse.EG.lichteHoehe; }
  function oeffnungsBereich(WV, ln, o) { // Beginn und Ende der Öffnung als Abstand von ln.a entlang der Wand
    var L = Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1]), along = Math.abs(ln.b[0] - ln.a[0]) >= Math.abs(ln.b[1] - ln.a[1]) ? 0 : 1, dir = ln.b[along] >= ln.a[along] ? 1 : -1;
    var ab = typeof o.ab === 'number' ? o.ab : (WV.mm(o.ab) - ln.a[along]) * dir;
    return [ab, ab + o.breite, L];
  }
  function seg(name, art, von, bis, quelle, extra) {
    var o = { art: art, von: von, bis: bis, laenge: bis - von, name: name, quelle: quelle || 'plan', fest: false, ids: [], schraeg: false };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  schnittLinien = function (haus, WV) {
    return (haus.schnitte || []).map(function (s) {
      var l = linie([WV.mm(s.von[0]), WV.mm(s.von[1])], [WV.mm(s.bis[0]), WV.mm(s.bis[1])], s.id, s.name);
      l.notiz = s.notiz;
      return l;
    });
  };

  /* ---------- Höhenketten (gemeinsam für Schnitt und Ansicht) ---------- */
  function hoehenKetten(haus, dach) {
    var k = koten(haus, dach), G = haus.geschosse, qE = G.EG.quelle || 'plan', qD = G.DG.quelle || 'plan', qT = haus.dach.quelle || 'plan';
    var innen = { typ: 'hoehe', richtung: 'z', seite: 'W', geschoss: null, bei: null, von: 0, bis: k.first, segmente: [
      seg('hoehe:eg.lichte', 'hoehe', 0, k.deckeUK, qE),
      seg('hoehe:dg.deckenaufbau', 'hoehe', k.deckeUK, k.okffDG, qD),
      seg('hoehe:dg.bis-first', 'hoehe', k.okffDG, k.first, 'plan', { abgeleitet: true })
    ] };
    var geschoss = { typ: 'hoehe', richtung: 'z', seite: 'W', geschoss: null, bei: null, von: 0, bis: k.okffDG, segmente: [
      seg('hoehe:dg.okff', 'hoehe', 0, k.okffDG, qD, { fest: !!G.DG.fest })
    ] };
    var aussen = { typ: 'hoehe', richtung: 'z', seite: 'O', geschoss: null, bei: null, von: 0, bis: k.first, segmente: [
      seg('hoehe:dach.traufe', 'hoehe', 0, k.traufe, qT),
      seg('hoehe:dach.traufe-first', 'hoehe', k.traufe, k.first, 'plan', { abgeleitet: true })
    ] };
    return [innen, geschoss, aussen];
  }

  /* ---------- Schnitt ---------- */
  schnittAbleiten = function (haus, WV, abl, dach, lin) {
    var L = lin.laenge ? lin : linie(lin.a, lin.b, lin.id, lin.name);
    if (!L.u) L = linie(lin.a, lin.b, lin.id, lin.name);
    var yD = haus.geschosse.DG.okff, lichte = haus.geschosse.EG.lichteHoehe, yE = haus.dach.traufe, sparren = haus.dg.wandAbstandDachhaut;
    var flaechen = [], K = koten(haus, dach);
    function xz(s) { return punkt(L, s); }

    /* Wände mit Öffnungen */
    ['EG', 'DG'].forEach(function (g) {
      var gs = abl.geschosse[g];
      if (!gs) return;
      gs.waende.forEach(function (w) {
        if (w.trennlinie) return;
        var ln = w.linie, uw = [(ln.b[0] - ln.a[0]) / Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1]), (ln.b[1] - ln.a[1]) / Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1])];
        intervalle(L, w.ring).forEach(function (iv) {
          var s0 = iv[0], s1 = iv[1], p0 = xz(s0), p1 = xz(s1);
          var q0 = (p0[0] - ln.a[0]) * uw[0] + (p0[1] - ln.a[1]) * uw[1], q1 = (p1[0] - ln.a[0]) * uw[0] + (p1[1] - ln.a[1]) * uw[1];
          var offen = (w.wand.oeffnungen || []).map(function (o) { var b = oeffnungsBereich(WV, ln, o); return { o: o, qa: b[0], qb: b[1] }; });
          var bruch = [s0, s1];
          if (Math.abs(q1 - q0) > EPS) offen.forEach(function (x) { [x.qa, x.qb].forEach(function (q) { var s = s0 + (q - q0) / (q1 - q0) * (s1 - s0); if (s > s0 + EPS && s < s1 - EPS) bruch.push(s); }); });
          bruch.sort(function (a, b) { return a - b; });
          for (var i = 0; i + 1 < bruch.length; i++) {
            var a = bruch[i], b = bruch[i + 1], mid = (a + b) / 2, pm = xz(mid), qm = (pm[0] - ln.a[0]) * uw[0] + (pm[1] - ln.a[1]) * uw[1], loch = null;
            offen.forEach(function (x) { if (!loch && qm >= x.qa - EPS && qm <= x.qb + EPS) loch = x.o; });
            var y0, y1, br = loch ? (loch.bruestung || 0) : 0, hh = loch ? (typeof loch.hoehe === 'number' ? loch.hoehe : Infinity) : 0;
            if (g === 'EG') {
              y0 = 0; y1 = wandHoehe(haus, w);
              if (!loch) flaechen.push({ art: 'wand', id: w.id, geschoss: g, ring: [[a, y0], [b, y0], [b, y1], [a, y1]] });
              else {
                if (br > 0) flaechen.push({ art: 'wand', id: w.id, geschoss: g, ring: [[a, 0], [b, 0], [b, br], [a, br]] });
                if (br + hh < y1) flaechen.push({ art: 'wand', id: w.id, geschoss: g, ring: [[a, br + hh], [b, br + hh], [b, y1], [a, y1]] });
              }
            } else {
              var hmax = w.wand.hoehe && w.wand.hoehe.max, nurB = w.wand.dach === 'B';
              var oben = profil(function (s) { var p = xz(s); return dach.wandOK(p[0], p[1], hmax, nurB); }, a, b);
              var stuecke = loch ? [] : [[yD]];
              if (loch) { if (br > 0) stuecke.push([yD, yD + br]); if (br + hh < Infinity) stuecke.push([yD + br + hh]); }
              stuecke.forEach(function (st) {
                var unten = st[0], obere = oben.map(function (p) { return [p[0], Math.max(p[1], st[1] != null ? st[1] : unten)]; });
                if (st[1] != null) { flaechen.push({ art: 'wand', id: w.id, geschoss: g, ring: [[a, unten], [b, unten], [b, st[1]], [a, st[1]]] }); return; }
                if (obere.every(function (p) { return p[1] <= unten + EPS; })) return;
                flaechen.push({ art: 'wand', id: w.id, geschoss: g, ring: [[a, unten], [b, unten]].concat(obere.slice().reverse()), kniewand: !!hmax, hmax: hmax || null });
              });
            }
          }
        });
      });
    });

    /* Decke: Innenseiten der Außenwände ohne Treppenöffnung */
    var innen = haus.huelle.innen.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; });
    var oef = haus.dg.treppenoeffnung ? haus.dg.treppenoeffnung.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; }) : null;
    var decke = intervalle(L, innen);
    if (oef) decke = abziehen(decke, intervalle(L, oef));
    decke.forEach(function (iv) { flaechen.push({ art: 'decke', id: 'decke', geschoss: 'EG', ring: [[iv[0], lichte], [iv[1], lichte], [iv[1], yD], [iv[0], yD]] }); });

    /* Dach: Dachhaut und Dachaufbau (Sparren) */
    var dachhaut = [], dachflaechen = [];
    praesenz(function (s) { var p = xz(s); return dach.hoehe(p[0], p[1]) > -1e8; }, 0, L.laenge).forEach(function (iv) {
      var oben = profil(function (s) { var p = xz(s); return dach.hoehe(p[0], p[1]); }, iv[0], iv[1]);
      dachhaut.push(oben);
      dachflaechen.push({ art: 'dach', id: 'dach', geschoss: null, ring: oben.concat(oben.slice().reverse().map(function (p) { return [p[0], p[1] - sparren]; })) });
    });
    dachflaechen.forEach(function (f) { flaechen.push(f); });

    /* Kamin */
    var kamin = null;
    if (haus.kamin) {
      var kc = [WV.mm(haus.kamin.mitte[0]), WV.mm(haus.kamin.mitte[1])], b2 = haus.kamin.breite / 2, t2 = haus.kamin.tiefe / 2;
      var kr = [[kc[0] - b2, kc[1] - t2], [kc[0] + b2, kc[1] - t2], [kc[0] + b2, kc[1] + t2], [kc[0] - b2, kc[1] + t2]];
      intervalle(L, kr).forEach(function (iv) { kamin = { art: 'kamin', id: 'kamin', geschoss: null, ring: [[iv[0], 0], [iv[1], 0], [iv[1], haus.kamin.oberkante], [iv[0], haus.kamin.oberkante]] }; flaechen.push(kamin); });
    }

    /* Dachfenster */
    var fenster = [], cs = Math.cos(haus.dach.neigung * Math.PI / 180);
    (haus.dachfenster || []).forEach(function (f) {
      var c = [WV.mm(f.mitte[0]), WV.mm(f.mitte[1])], o = f.richtung, p = [-o[1], o[0]], a = f.laenge * cs / 2, b = f.breite / 2;
      var ring = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(function (k) { return [c[0] + k[0] * a * o[0] + k[1] * b * p[0], c[1] + k[0] * a * o[1] + k[1] * b * p[1]]; });
      intervalle(L, ring).forEach(function (iv) {
        var p0 = xz(iv[0]), p1 = xz(iv[1]);
        fenster.push({ id: f.id, typ: f.typ, s0: iv[0], s1: iv[1], y0: dach.hoehe(p0[0], p0[1]), y1: dach.hoehe(p1[0], p1[1]) });
      });
    });

    /* Treppe mit Stufendicke, Kopfhöhe über den geschnittenen Stufen */
    var TR = haus.treppe && haus.treppe.steigungen ? treppeAbleiten(haus, WV) : null, stufen = [], kopf = { min: null, stufe: null, s: null, stellen: [], linie: [] };
    if (TR) {
      var sInStufe = [];
      TR.stufen.forEach(function (st) {
        intervalle(L, st.polygon).forEach(function (iv) {
          stufen.push({ n: st.n, hoehe: st.hoehe, s0: iv[0], s1: iv[1], ring: [[iv[0], st.unterkante], [iv[1], st.unterkante], [iv[1], st.hoehe], [iv[0], st.hoehe]] });
          sInStufe.push([iv[0], iv[1], st]);
        });
      });
      stufen.sort(function (a, b) { return a.n - b.n || a.s0 - b.s0; });
      sInStufe.sort(function (a, b) { return a[0] - b[0]; });
      sInStufe.forEach(function (iv) {
        var st = iv[2], n = Math.max(1, Math.ceil((iv[1] - iv[0]) / 25));
        for (var i = 0; i <= n; i++) {
          var s = iv[0] + (iv[1] - iv[0]) * i / n, p = xz(s), offen = oef && imRing(oef, p[0], p[1]), r = dach.hoehe(p[0], p[1]);
          var grenze = offen ? (r < -1e8 ? Infinity : r - sparren) : lichte;
          kopf.stellen.push({ s: s, x: p[0], z: p[1], stufe: st.n, tritt: st.hoehe, hoehe: grenze - st.hoehe, art: offen ? 'dach' : 'decke' });
        }
        kopf.linie.push([iv[0], st.hoehe + 2000], [iv[1], st.hoehe + 2000]);
      });
      // Streifen unter 100 mm Breite, in denen die Kopfhöhe unter 2000 liegt, zählen nicht
      var schmal = [], lauf = null;
      kopf.stellen.forEach(function (t, i) {
        var zu = t.hoehe < 2000 - 1e-6;
        if (zu && !lauf) lauf = { a: i, b: i };
        else if (zu) lauf.b = i;
        if ((!zu || i === kopf.stellen.length - 1) && lauf) { if (kopf.stellen[lauf.b].s - kopf.stellen[lauf.a].s < 100) schmal.push(lauf); lauf = null; }
      });
      var zaehlt = kopf.stellen.filter(function (t, i) { return !schmal.some(function (r) { return i >= r.a && i <= r.b; }); });
      zaehlt.forEach(function (t) { if (kopf.min == null || t.hoehe < kopf.min) { kopf.min = t.hoehe; kopf.stufe = t.stufe; kopf.s = t.s; } });
    }

    /* Maßketten: waagerecht je Geschoss entlang der Linie (nur bei achsparalleler Linie), senkrecht die Höhen */
    var ketten = [];
    var waagerecht = Math.abs(L.u[1]) < 1e-9, senkrecht = Math.abs(L.u[0]) < 1e-9;
    if (waagerecht || senkrecht) {
      ['EG', 'DG'].forEach(function (g) {
        if (!abl.geschosse[g]) return;
        var richtung = waagerecht ? 'x' : 'z', ax = waagerecht ? 0 : 1, vz = waagerecht ? L.u[0] : L.u[1], bei = waagerecht ? L.a[1] : L.a[0];
        var ks = kettenSchnitt(haus, WV, abl, g, richtung, bei);
        if (!ks.segmente.length) return;
        var abs = function (c) { return (c - L.a[ax]) * vz; };
        var segs = ks.segmente.map(function (s) {
          var v = abs(s.von), b = abs(s.bis), lo = Math.min(v, b), hi = Math.max(v, b);
          return seg(s.name, s.art, lo, hi, s.quelle, { ids: s.ids, schraeg: s.schraeg, fest: s.fest });
        }).sort(function (a, b) { return a.von - b.von; });
        ketten.push({ typ: 'waende', richtung: 'x', seite: g === 'EG' ? 'S' : 'N', geschoss: g, bei: null, von: segs[0].von, bis: segs[segs.length - 1].bis, segmente: segs });
      });
    }
    hoehenKetten(haus, dach).forEach(function (k) { ketten.push(k); });
    // Kniewände: Höhe über dem DG-Boden in der Mitte des geschnittenen Stücks
    flaechen.forEach(function (f) {
      if (!f.kniewand) return;
      var b = f.ring.map(function (p) { return p[0]; }), a0 = Math.min.apply(null, b), a1 = Math.max.apply(null, b), top = Math.max.apply(null, f.ring.map(function (p) { return p[1]; }));
      var hoehe = top - yD, begrenzt = hoehe < f.hmax - 0.5;
      ketten.push({ typ: 'hoehe', richtung: 'z', seite: (a0 + a1) / 2 < L.laenge / 2 ? 'W' : 'O', geschoss: 'DG', bei: null, lage: (a0 + a1) / 2 < L.laenge / 2 ? a0 - 150 : a1 + 150, von: yD, bis: top,
        segmente: [seg('hoehe:' + f.id, 'hoehe', yD, top, 'plan', { abgeleitet: begrenzt, wand: f.id })] });
    });

    var hMax = Math.max.apply(null, [K.first].concat(flaechen.map(function (f) { return Math.max.apply(null, f.ring.map(function (p) { return p[1]; })); })));
    return {
      art: 'schnitt', id: lin.id, name: lin.name, a: L.a, b: L.b, laenge: L.laenge, u: L.u, blick: L.blick, flaechen: flaechen, dachhaut: dachhaut, koten: K,
      treppe: { stufen: stufen, steigung: TR ? TR.steigung : null, kopf: kopf }, kamin: kamin, dachfenster: fenster, ketten: ketten,
      grenzen: { s0: 0, s1: L.laenge, y0: 0, y1: hMax }
    };
  };

  /* ---------- Ansicht ---------- */
  var SEITEN = {
    N: { name: 'Ansicht Nord', blick: [0, 1], normal: [0, -1], achse: 0, umkehr: false },
    O: { name: 'Ansicht Ost', blick: [-1, 0], normal: [1, 0], achse: 1, umkehr: false },
    S: { name: 'Ansicht Süd', blick: [0, -1], normal: [0, 1], achse: 0, umkehr: true },
    W: { name: 'Ansicht West', blick: [1, 0], normal: [-1, 0], achse: 1, umkehr: true }
  };
  ansichtAbleiten = function (haus, WV, abl, dach, seite) {
    var D = SEITEN[seite];
    if (!D) throw new Error('Ansicht unbekannt: ' + seite + ' (N, O, S oder W)');
    var hull = haus.huelle.aussen.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; });
    var lo = Math.min.apply(null, hull.map(function (p) { return p[D.achse]; })), hi = Math.max.apply(null, hull.map(function (p) { return p[D.achse]; }));
    function sVon(c) { return D.umkehr ? hi - c : c - lo; }
    var breite = hi - lo, lichte = haus.geschosse.EG.lichteHoehe, yE = haus.dach.traufe, K = koten(haus, dach), ach = D.achse, tan = dach.tan, cs = Math.cos(haus.dach.neigung * Math.PI / 180);
    var waende = [], oeffnungen = [], ketten = [];
    (abl.geschosse.EG ? abl.geschosse.EG.waende : []).forEach(function (w) {
      if (w.trennlinie || w.wand.typ !== 'AW') return;
      var ln = w.linie;
      if (Math.abs(ln.n[0] - D.normal[0]) > 1e-9 || Math.abs(ln.n[1] - D.normal[1]) > 1e-9) return;
      var cs0 = w.ring.map(function (p) { return sVon(p[ach]); }), s0 = Math.min.apply(null, cs0), s1 = Math.max.apply(null, cs0), top = wandHoehe(haus, w);
      waende.push({ id: w.id, s0: s0, s1: s1, y0: 0, y1: top });
      (w.wand.oeffnungen || []).forEach(function (o, k) {
        var b = oeffnungsBereich(WV, ln, o), dirv = ln.b[ach] >= ln.a[ach] ? 1 : -1, c0 = ln.a[ach] + dirv * b[0], c1 = ln.a[ach] + dirv * b[1];
        var os0 = Math.min(sVon(c0), sVon(c1)), os1 = Math.max(sVon(c0), sVon(c1)), br = o.bruestung || 0, h = typeof o.hoehe === 'number' ? o.hoehe : top - br;
        var name = w.id + '.oeff' + (k + 1);
        oeffnungen.push({ name: name, wand: w.id, art: o.art, s0: os0, s1: os1, y0: br, y1: br + h, quelle: o.quelle || 'plan' });
        var q = o.quelle || 'plan', segs = [];
        if (br > 0) segs.push(seg(name + '.bruestung', 'hoehe', 0, br, q));
        segs.push(seg(name + '.hoehe', 'hoehe', br, br + h, q));
        if (br + h < lichte) segs.push(seg(name + '.sturz', 'hoehe', br + h, lichte, q, { abgeleitet: false }));
        ketten.push({ typ: 'hoehe', richtung: 'z', seite: 'O', geschoss: 'EG', bei: null, lage: os1 + 140, von: 0, bis: lichte, segmente: segs, oeffnung: name });
      });
    });

    /* Dachsilhouette: je Flügel steigt die Dachhaut von der Traufkante mit tan 35° bis zur halben Tiefe (Walm), dahinter bleibt sie auf der Firsthöhe */
    function fluegel(r) {
      var aLo = ach === 0 ? r.x0 : r.z0, aHi = ach === 0 ? r.x1 : r.z1, tiefe = ach === 0 ? r.z1 - r.z0 : r.x1 - r.x0;
      return { lo: aLo, hi: aHi, halb: tiefe / 2 };
    }
    var fl = [fluegel(dach.A)].concat(dach.B ? [fluegel(dach.B)] : []);
    function silhouette(c) { // c: Koordinate entlang der Achse
      var h = -1e9;
      fl.forEach(function (f) { if (c >= f.lo - 1e-3 && c <= f.hi + 1e-3) h = Math.max(h, haus.dach.traufe - dach.ueberstand * tan + tan * Math.min(c - f.lo, f.hi - c, f.halb)); });
      return h;
    }
    function cVonS(s) { return D.umkehr ? hi - s : lo + s; }
    var sL = Math.min.apply(null, fl.map(function (f) { return sVon(f.lo); }).concat(fl.map(function (f) { return sVon(f.hi); }))), sR = Math.max.apply(null, fl.map(function (f) { return sVon(f.lo); }).concat(fl.map(function (f) { return sVon(f.hi); })));
    var dachPts = [];
    praesenz(function (s) { return silhouette(cVonS(s)) > -1e8; }, sL, sR).forEach(function (iv) {
      var pl = profil(function (s) { return silhouette(cVonS(s)); }, iv[0], iv[1]);
      dachPts = dachPts.length ? dachPts.concat(pl) : pl;
    });
    var traufKante = haus.dach.traufe - dach.ueberstand * tan;

    /* First und Grate beider Flügel, soweit sie auf der sichtbaren Dachfläche liegen (nicht im anderen Flügel versunken, nicht hinter einer höheren Dachfläche) */
    var kanten = [];
    [dach.A, dach.B].forEach(function (r) {
      if (!r) return;
      var w = r.x1 - r.x0, d = r.z1 - r.z0, halb = Math.min(w, d) / 2, h0 = haus.dach.traufe - dach.ueberstand * tan, hr = h0 + tan * halb, xc = (r.x0 + r.x1) / 2, zc = (r.z0 + r.z1) / 2;
      var e1 = w >= d ? [r.x0 + halb, zc] : [xc, r.z0 + halb], e2 = w >= d ? [r.x1 - halb, zc] : [xc, r.z1 - halb], segs = [{ art: 'first', a: [e1[0], e1[1], hr], b: [e2[0], e2[1], hr] }];
      [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].forEach(function (c) {
        var e = Math.hypot(c[0] - e1[0], c[1] - e1[1]) <= Math.hypot(c[0] - e2[0], c[1] - e2[1]) ? e1 : e2;
        segs.push({ art: 'grat', a: [c[0], c[1], h0], b: [e[0], e[1], hr] });
      });
      segs.forEach(function (sg) {
        var len = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]), n = Math.max(1, Math.ceil(len / 40)), von = null, i;
        function sichtbar(t) {
          var x = sg.a[0] + (sg.b[0] - sg.a[0]) * t, z = sg.a[1] + (sg.b[1] - sg.a[1]) * t, y = sg.a[2] + (sg.b[2] - sg.a[2]) * t;
          if (Math.abs(dach.hoehe(x, z) - y) > 1.5) return false;
          // beide Nachbarflächen gehören diesem Flügel (liegt die Kante im anderen Flügel versunken, ist sie keine Kante der sichtbaren Dachhaut)
          var nx = -(sg.b[1] - sg.a[1]) / len, nz = (sg.b[0] - sg.a[0]) / len, k;
          for (k = -1; k <= 1; k += 2) {
            var qx = x + nx * 60 * k, qz = z + nz * 60 * k;
            if (Math.abs(dach.hoehe(qx, qz) - (haus.dach.traufe - dach.ueberstand * tan + tan * dach.dR(r, qx, qz))) > 1.5) return false;
          }
          for (var q = 40; q < 25000; q += 40) if (dach.hoehe(x - D.blick[0] * q, z - D.blick[1] * q) > y + 1) return false;
          return true;
        }
        function punkt(t) { return [sVon(sg.a[ach] + (sg.b[ach] - sg.a[ach]) * t), sg.a[2] + (sg.b[2] - sg.a[2]) * t]; }
        for (i = 0; i <= n; i++) {
          var t = i / n, ok = sichtbar(t);
          if (ok && von == null) von = t;
          if ((!ok || i === n) && von != null) { var bis = ok ? t : (i - 1) / n; if (bis > von) kanten.push({ art: sg.art, a: punkt(von), b: punkt(bis) }); von = null; }
        }
      });
    });

    /* Dachfenster, die zum Betrachter zeigen */
    var dachfenster = [];
    (haus.dachfenster || []).forEach(function (f) {
      if (f.richtung[0] !== D.normal[0] || f.richtung[1] !== D.normal[1]) return;
      var c = [WV.mm(f.mitte[0]), WV.mm(f.mitte[1])], hc = dach.hoehe(c[0], c[1]), halbH = f.laenge * Math.sin(haus.dach.neigung * Math.PI / 180) / 2, b2 = f.breite / 2;
      var a = sVon(c[ach] - b2), b = sVon(c[ach] + b2);
      dachfenster.push({ id: f.id, typ: f.typ, s0: Math.min(a, b), s1: Math.max(a, b), y0: hc - halbH, y1: hc + halbH });
    });
    var kamin = null;
    if (haus.kamin) {
      var kc = [WV.mm(haus.kamin.mitte[0]), WV.mm(haus.kamin.mitte[1])], kb = ach === 0 ? haus.kamin.breite / 2 : haus.kamin.tiefe / 2, ka = sVon(kc[ach] - kb), kz = sVon(kc[ach] + kb);
      var rh = Math.min.apply(null, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (k) { return dach.hoehe(kc[0] + k[0] * haus.kamin.breite / 2, kc[1] + k[1] * haus.kamin.tiefe / 2); }));
      kamin = { s0: Math.min(ka, kz), s1: Math.max(ka, kz), y0: rh, y1: haus.kamin.oberkante };
    }
    hoehenKetten(haus, dach).forEach(function (k) { ketten.push(k); });
    var hMax = Math.max(K.first, haus.kamin ? haus.kamin.oberkante : 0);
    return {
      art: 'ansicht', seite: seite, id: seite, name: D.name, blick: D.blick, breite: breite, waende: waende, oeffnungen: oeffnungen, dach: dachPts, traufKante: traufKante,
      dachfenster: dachfenster, kamin: kamin, kanten: kanten, koten: K, ketten: ketten, grenzen: { s0: dachPts.length ? dachPts[0][0] : 0, s1: dachPts.length ? dachPts[dachPts.length - 1][0] : breite, y0: 0, y1: hMax }
    };
  };

  /* ---------- SVG ---------- */
  var CSS_S = [
    '.plan .s-erde{fill:var(--pr);opacity:.55;stroke:none}.plan .s-boden{stroke:var(--pi);stroke-width:18;fill:none}',
    '.plan .s-wand{fill:var(--pw);stroke:none}.plan .s-decke{fill:color-mix(in srgb,var(--pw) 55%,var(--pg));stroke:none}',
    '.plan .s-dach{fill:color-mix(in srgb,var(--qx) 38%,var(--pg));stroke:none}.plan .s-dachlinie{fill:none;stroke:var(--pi);stroke-width:22;stroke-linejoin:round;stroke-linecap:round}',
    '.plan .s-stufe{fill:color-mix(in srgb,var(--qx) 70%,var(--pi));stroke:var(--pi);stroke-width:6}.plan .s-kamin{fill:color-mix(in srgb,var(--pm) 70%,var(--pg));stroke:var(--pi);stroke-width:8}',
    '.plan .s-kopf{fill:none;stroke:var(--pe);stroke-width:14;stroke-dasharray:70 45}.plan .s-kopft{font-size:150px;fill:var(--pe);font-weight:600}',
    '.plan .s-kote{stroke:var(--pm);stroke-width:5;stroke-dasharray:30 40;fill:none}.plan .s-kotet{font-size:130px;fill:var(--pm)}',
    '.plan .s-df{stroke:var(--qp);stroke-width:60;fill:none;stroke-linecap:butt}.plan .s-dfa{fill:color-mix(in srgb,var(--qp) 30%,var(--pg));stroke:var(--qp);stroke-width:14}',
    '.plan .s-fassade{fill:var(--pt);stroke:var(--pi);stroke-width:12}.plan .s-oeff{fill:color-mix(in srgb,var(--qp) 16%,var(--pg));stroke:var(--pi);stroke-width:14}.plan .s-oefft{stroke:var(--pi);stroke-width:8;fill:none}',
    '.plan .s-grat{stroke:var(--pi);stroke-width:10;fill:none}.plan .s-titel{font-size:230px;font-weight:600;fill:var(--pi)}.plan .s-sub{font-size:150px;fill:var(--pm)}'
  ].join('');

  function ring2svg(H, ring) { return H.pfad(ring.map(function (p) { return [p[0], -p[1]]; })); }
  function poly2svg(H, pts) { return 'M' + pts.map(function (p) { return H.f(p[0]) + ' ' + H.f(-p[1]); }).join('L'); }
  function mText(v) { return (Math.round(v / 10) / 100).toFixed(2).replace('.', ',') + ' m'; }

  schnittSvg = function (z, optionen) {
    var H = planHilfen, o = optionen || {}, standalone = !!o.standalone, zeigeM = o.massketten !== false;
    var G = z.grenzen, K = z.koten, parts = [], bb = { x0: G.s0, x1: G.s1, y0: -G.y1, y1: 0 };
    function erweitere(x, y) { bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); bb.y0 = Math.min(bb.y0, y); bb.y1 = Math.max(bb.y1, y); }
    var ist = z.art === 'schnitt', body = [];
    var breite0 = G.s1 - G.s0;

    /* Erde (nur als Strich unter OKFF EG angedeutet) und Fußbodenlinie */
    body.push('<rect class="s-erde" x="' + H.f(G.s0) + '" y="0" width="' + H.f(breite0) + '" height="140"/>');
    body.push('<line class="s-boden" x1="' + H.f(G.s0) + '" y1="0" x2="' + H.f(G.s1) + '" y2="0"/>');

    if (ist) {
      z.flaechen.filter(function (f) { return f.art === 'decke'; }).forEach(function (f) { body.push('<path class="s-decke" d="' + ring2svg(H, f.ring) + '"/>'); });
      z.flaechen.filter(function (f) { return f.art === 'dach'; }).forEach(function (f) { body.push('<path class="s-dach" d="' + ring2svg(H, f.ring) + '"/>'); });
      z.flaechen.filter(function (f) { return f.art === 'wand'; }).forEach(function (f) { body.push('<path class="s-wand" data-wand="' + H.esc(f.id) + '" d="' + ring2svg(H, f.ring) + '"><title>' + H.esc(f.id) + '</title></path>'); });
      z.dachhaut.forEach(function (pl) { body.push('<path class="s-dachlinie" d="' + poly2svg(H, pl) + '"/>'); });
      z.flaechen.filter(function (f) { return f.art === 'kamin'; }).forEach(function (f) { body.push('<path class="s-kamin" d="' + ring2svg(H, f.ring) + '"><title>Kamin</title></path>'); });
      z.treppe.stufen.forEach(function (s) { body.push('<path class="s-stufe" data-stufe="' + s.n + '" d="' + ring2svg(H, s.ring) + '"><title>Stufe ' + s.n + ': Trittfläche ' + mText(s.hoehe) + '</title></path>'); });
      z.dachfenster.forEach(function (f) { body.push('<line class="s-df" x1="' + H.f(f.s0) + '" y1="' + H.f(-f.y0) + '" x2="' + H.f(f.s1) + '" y2="' + H.f(-f.y1) + '"><title>Dachfenster ' + H.esc(f.id) + '</title></line>'); });
      var kp = z.treppe.kopf;
      if (kp.linie.length) {
        body.push('<path class="s-kopf" d="' + poly2svg(H, kp.linie) + '"><title>2,00 m über den Stufen</title></path>');
        if (kp.min != null) {
          var st = kp.stellen.filter(function (t) { return t.stufe === kp.stufe && Math.abs(t.hoehe - kp.min) < 1e-6; })[0] || kp.stellen[0];
          body.push('<line class="s-kopf" style="stroke-dasharray:none" x1="' + H.f(st.s) + '" y1="' + H.f(-st.tritt) + '" x2="' + H.f(st.s) + '" y2="' + H.f(-(st.tritt + kp.min)) + '"/>');
          body.push('<text class="s-kopft halo" x="' + H.f(st.s + 60) + '" y="' + H.f(-(st.tritt + kp.min / 2)) + '">Kopfhöhe ' + mText(kp.min) + '</text>');
          erweitere(st.s - 200, -(st.tritt + kp.min) - 50);
        }
      }
    } else {
      body.push(ansichtKoerper(H, z));
    }

    /* Maßketten */
    var kettenSvgTeile = '', cursor = { W: bb.x0, O: G.s1, S: 160, N: -G.y1 - 100 };
    if (zeigeM) {
      var nr = 0;
      var sgn = { N: -1, S: 1, W: -1, O: 1 };
      var reihe = [];
      ['S', 'N', 'W', 'O'].forEach(function (seite) { z.ketten.filter(function (k) { return k.seite === seite && k.lage == null; }).forEach(function (k) { reihe.push(k); }); });
      z.ketten.filter(function (k) { return k.lage != null; }).forEach(function (k) { reihe.push(k); });
      reihe.forEach(function (k) {
        var lay = H.kettenLayout(k), sg = sgn[k.seite], pos;
        var kk = k;
        if (k.richtung === 'z') kk = Object.assign({}, k, { von: -k.bis, bis: -k.von, segmente: k.segmente.map(function (s) { return Object.assign({}, s, { von: -s.bis, bis: -s.von }); }) });
        if (k.lage != null) pos = k.lage;
        else { pos = cursor[k.seite] + sg * 450; cursor[k.seite] += sg * lay.dicke; }
        if (k.richtung === 'x') { erweitere(kk.von, pos + sg * lay.dicke); erweitere(kk.bis, pos); }
        else { erweitere(pos + sg * lay.dicke, kk.von); erweitere(pos, kk.bis); }
        kettenSvgTeile += H.kettenSvg(kk, pos, null, nr++);
      });
    }

    /* Höhenkoten über die ganze Breite: OKFF EG, UK Decke, OKFF DG, Traufe, First (mit Höhe ü. NN) */
    var textX = cursor.O + 120;
    var koten = [['OKFF EG', K.okffEG], ['UK Decke', K.deckeUK], ['OKFF DG', K.okffDG], ['Traufe', K.traufe], ['First', K.first]];
    koten.forEach(function (k) {
      body.push('<line class="s-kote" x1="' + H.f(G.s0) + '" y1="' + H.f(-k[1]) + '" x2="' + H.f(textX - 40) + '" y2="' + H.f(-k[1]) + '"/>');
    });
    var ky = -1e9, kotenText = [];
    koten.slice().sort(function (a, b) { return a[1] - b[1]; }).forEach(function (k) {
      var y = -k[1]; if (ky !== -1e9 && Math.abs(y - ky) < 150) y = ky - 150; ky = y; // eng liegende Koten (Traufe, OKFF DG) auseinanderziehen
      kotenText.push('<text class="s-kotet" x="' + H.f(textX) + '" y="' + H.f(y + 45) + '">' + H.esc(k[0] + ' ' + (K.okffEG === k[1] ? '±0,00' : '+' + (Math.round(k[1] / 10) / 100).toFixed(2).replace('.', ',')) + ' | ' + (Math.round((k[1] + K.nn) / 10) / 100).toFixed(2).replace('.', ',') + ' m ü. NN') + '</text>');
    });
    erweitere(textX + 3200, 0);
    body.push(kotenText.join(''));

    var titel = '<text class="s-titel" x="' + H.f(G.s0) + '" y="' + H.f(bb.y0 - 520) + '">' + H.esc(z.name) + '</text>' +
      '<text class="s-sub" x="' + H.f(G.s0) + '" y="' + H.f(bb.y0 - 280) + '">' + H.esc(blickText(z)) + '</text>';
    erweitere(G.s0, bb.y0 - 600);
    var rand = 600, vx = bb.x0 - rand, vy = bb.y0 - rand, vw = bb.x1 - bb.x0 + 2 * rand, vh = bb.y1 - bb.y0 + 2 * rand;
    var size = standalone ? ' width="' + Math.round(vw / 6) + '" height="' + Math.round(vh / 6) + '"' : '';
    var vb = H.f(vx) + ' ' + H.f(vy) + ' ' + H.f(vw) + ' ' + H.f(vh);
    return '<svg xmlns="http://www.w3.org/2000/svg" class="plan" viewBox="' + vb + '"' + size + ' role="img" aria-label="' + H.esc(z.name) + '" data-zeichnung="' + z.art + '" data-id="' + H.esc(z.id) + '" data-viewbox="' + vb + '">' +
      '<style>' + H.CSS + CSS_S + (standalone ? H.CSS_DUNKEL : '') + '</style>' + (standalone ? '<rect class="bg" x="' + H.f(vx) + '" y="' + H.f(vy) + '" width="' + H.f(vw) + '" height="' + H.f(vh) + '"/>' : '') +
      '<g class="koerper">' + body.join('') + '</g><g class="massketten">' + kettenSvgTeile + '</g>' + titel + '</svg>';
  };
  function blickText(z) {
    var b = z.blick, r = b[1] < -0.5 ? 'Norden' : b[1] > 0.5 ? 'Süden' : b[0] > 0.5 ? 'Osten' : 'Westen';
    if (Math.abs(b[0]) > 0.5 && Math.abs(b[1]) > 0.5) r = (b[1] < 0 ? 'Nord' : 'Süd') + (b[0] > 0 ? 'osten' : 'westen');
    else if (Math.abs(b[0]) > 0.1 && Math.abs(b[1]) > 0.1) r = 'etwa ' + r;
    return z.art === 'schnitt' ? 'Blick nach ' + r + ', Länge ' + mText(z.laenge) : 'Blick nach ' + r;
  }
  function ansichtKoerper(H, z) {
    var out = [];
    z.waende.forEach(function (w) { out.push('<rect class="s-fassade" data-wand="' + H.esc(w.id) + '" x="' + H.f(w.s0) + '" y="' + H.f(-w.y1) + '" width="' + H.f(w.s1 - w.s0) + '" height="' + H.f(w.y1 - w.y0) + '"><title>' + H.esc(w.id) + '</title></rect>'); });
    z.oeffnungen.forEach(function (o) {
      var x = H.f(o.s0), y = H.f(-o.y1), w = H.f(o.s1 - o.s0), h = H.f(o.y1 - o.y0), tuer = o.art === 'tuer' || o.art === 'durchgang';
      var g = '<g data-oeffnung="' + H.esc(o.name) + '"><rect class="s-oeff" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"><title>' + H.esc(o.name) + ' (' + o.art + ')</title></rect>';
      if (o.art === 'fenster' || o.art === 'fenstertuer') g += '<line class="s-oefft" x1="' + H.f((o.s0 + o.s1) / 2) + '" y1="' + y + '" x2="' + H.f((o.s0 + o.s1) / 2) + '" y2="' + H.f(-o.y0) + '"/>';
      if (tuer) g += '<line class="s-oefft" x1="' + H.f(o.s0 + 120) + '" y1="' + H.f(-o.y0 - (o.y1 - o.y0) / 2) + '" x2="' + H.f(o.s0 + 120) + '" y2="' + H.f(-o.y0 - (o.y1 - o.y0) / 2 - 250) + '"/>';
      out.push(g + '</g>');
    });
    if (z.kamin) out.push('<rect class="s-kamin" x="' + H.f(z.kamin.s0) + '" y="' + H.f(-z.kamin.y1) + '" width="' + H.f(z.kamin.s1 - z.kamin.s0) + '" height="' + H.f(z.kamin.y1 - z.kamin.y0) + '"><title>Kamin</title></rect>');
    if (z.dach.length) {
      out.push('<path class="s-dach" d="' + poly2svg(H, z.dach) + 'L' + H.f(z.dach[z.dach.length - 1][0]) + ' ' + H.f(-z.traufKante) + 'L' + H.f(z.dach[0][0]) + ' ' + H.f(-z.traufKante) + 'Z"/>');
      out.push('<path class="s-dachlinie" d="' + poly2svg(H, z.dach) + 'L' + H.f(z.dach[z.dach.length - 1][0]) + ' ' + H.f(-z.traufKante) + 'L' + H.f(z.dach[0][0]) + ' ' + H.f(-z.traufKante) + 'Z"/>');
    }
    (z.kanten || []).forEach(function (k) { out.push('<line class="s-grat" x1="' + H.f(k.a[0]) + '" y1="' + H.f(-k.a[1]) + '" x2="' + H.f(k.b[0]) + '" y2="' + H.f(-k.b[1]) + '"/>'); });
    z.dachfenster.forEach(function (f) { out.push('<rect class="s-dfa" x="' + H.f(f.s0) + '" y="' + H.f(-f.y1) + '" width="' + H.f(f.s1 - f.s0) + '" height="' + H.f(f.y1 - f.y0) + '"><title>Dachfenster ' + H.esc(f.id) + ' (' + H.esc(f.typ) + ')</title></rect>'); });
    return out.join('');
  }
})();
if (typeof module !== 'undefined') module.exports = { schnittLinien: schnittLinien, schnittAbleiten: schnittAbleiten, ansichtAbleiten: ansichtAbleiten, schnittSvg: schnittSvg };
