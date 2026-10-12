/* Grundriss: leitet aus dem abgeleiteten Modell alles ab, was der 2D-Grundriss zeigt (Plan docs/plan-parametrisches-modell.md, 4.1),
   und zeichnet ihn als SVG. Ohne Three.js, in Node testbar. Alle Maße in Millimetern, hausrelativ (hx nach Osten, hz nach Süden, im SVG
   also x nach rechts und y nach unten wie im Plan).

     kettenSchnitt(haus, WV, abl, geschoss, richtung, bei)       Maßkette entlang einer Schnittlinie (richtung 'x': waagerecht bei hz = bei,
                                                                'z': senkrecht bei hx = bei): Wandstärken und lichte Räume im Wechsel
     grundrissAbleiten(haus, WV, abl, dach, befunde, geschoss)   Wände, Öffnungen, Räume, Maßketten, Treppe, Befund-Marken
     grundrissSvg(plan, optionen)                                SVG-Text; optionen.standalone (eigene Farben, Dunkelmodus, Hintergrund),
                                                                optionen.massketten / raeume / oeffnungen / marken (false schaltet ab)

   Maßketten entstehen automatisch: je Seite Gesamtmaße (aus den Außenkanten), Öffnungsketten der Außenwände und Wandketten entlang von
   Schnittlinien, die so gewählt sind, dass jede achsparallele Wand in mindestens einer Kette steht. Jedes Maß hat einen Namen
   (`wand:<id>`, `raum:<id>.breite|tiefe`, `<wand>.oeff<k>`, `<wand>.pfeiler<k>`, `aussen:<…>`), eine Herkunft (plan, aufmass, nutzer,
   annahme, ohne) und ein Schloss, wenn beide Enden auf gesperrten Achsen liegen. Die Herkunft ergibt sich aus den Parametern, von denen
   das Maß wirklich abhängt: Maße werden als Summe aus Achsen und Wandtypen aufgelöst, was sich in der Differenz aufhebt, zählt nicht
   (die Innenkante der Außenwand hebt sich bei der HAR-Tiefe auf, übrig bleibt das Aufmaß 2,95 m). Die Namen der Maße sind vorläufig:
   Mit diesen Namen spricht src/aendern.js (Phase 4) ein Maß an; jedes Segment einer Kette trägt dafür `parameter` (Achsen und Wandtypen, von denen es
   abhängt, mit Faktor k) und bei Öffnungen und Pfeilern `oeffnungen` (Verweis auf die Öffnung in der Wand). */
if (typeof require !== 'undefined') { var polygonClipping = require('polygon-clipping'); var RA = require('./raeume.js'); var treppeAbleiten = require('./treppe.js').treppeAbleiten; var wohnflaecheAbleiten = require('./wohnflaeche.js').wohnflaecheAbleiten; }

var grundrissAbleiten, kettenSchnitt, grundrissSvg, planHilfen;
(function () {
  var TOL = 1e-6;
  var RANG = { aufmass: 0, plan: 1, nutzer: 1, ohne: 2, annahme: 3 }; // je höher, desto unsicherer
  function R() {
    return typeof RA !== 'undefined' ? RA : { imPolygon: imPolygon, wandRing: wandRing, ringFlaeche: ringFlaeche };
  }
  function schlechter(a, b) { return a == null ? b : (b == null ? a : (RANG[b] > RANG[a] ? b : a)); }

  /* ---------- Herkunft: Maße als Summe aus Parametern ---------- */
  function kontext(haus, WV, abl) {
    var typen = haus.wandtypen || {}, defs = {}, memo = {};
    [haus.aussenmasse || {}, haus.achsen || {}].forEach(function (gr) { Object.keys(gr).forEach(function (n) { defs[n] = gr[n]; }); });
    function leer(root, rootQ) { return { root: root, rootQ: rootQ, t: {} }; }
    function kopie(e) { var o = leer(e.root, e.rootQ); Object.keys(e.t).forEach(function (k) { o.t[k] = { c: e.t[k].c, q: e.t[k].q, s: e.t[k].s }; }); return o; }
    function addTerm(e, key, c, q, s) { if (e.t[key]) { e.t[key].c += c; e.t[key].s += s || 0; } else e.t[key] = { c: c, q: q, s: s || 0 }; }
    function typQ(name) { var n = String(name).replace(/\/2$/, ''); return (typen[n] && typen[n].quelle) || 'ohne'; }
    function term(e, x, sg, name, quelle) { // x: Zahl (mm) oder Wandtyp ("IW175", "TB-DG/2")
      if (x == null) return;
      if (typeof x === 'number') addTerm(e, 'p:' + name + (sg > 0 ? '+' : '-'), sg * x, quelle || 'ohne', sg);
      else { var halb = /\/2$/.test(x); addTerm(e, 't:' + String(x).replace(/\/2$/, ''), sg * (halb ? 0.5 : 1), typQ(x)); }
    }
    function achseExpr(name) {
      if (memo[name]) return memo[name];
      var d = defs[name];
      if (d == null) throw new Error('Achse unbekannt: ' + name);
      var e;
      if (d.ref == null) e = leer(name, d.quelle || 'ohne');
      else { e = kopie(achseExpr(d.ref)); term(e, d.plus, 1, name, d.quelle); term(e, d.minus, -1, name, d.quelle); }
      memo[name] = e;
      return e;
    }
    function ausdruckExpr(x) { // Zahl, Achsenname oder { ref, plus, minus }
      if (typeof x === 'number') return leer('lit:' + x, 'ohne');
      if (typeof x === 'string') return achseExpr(x);
      var e = kopie(achseExpr(x.ref)); term(e, x.plus, 1, 'ausdruck', x.quelle); term(e, x.minus, -1, 'ausdruck', x.quelle);
      return e;
    }
    function differenzQ(a, b) { // schlechteste Herkunft der Parameter, von denen b − a abhängt
      var q = null, keys = {};
      Object.keys(a.t).concat(Object.keys(b.t)).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) {
        var c = (b.t[k] ? b.t[k].c : 0) - (a.t[k] ? a.t[k].c : 0);
        if (Math.abs(c) > 1e-9) q = schlechter(q, (b.t[k] || a.t[k]).q);
      });
      if (a.root !== b.root) { q = schlechter(q, a.rootQ); q = schlechter(q, b.rootQ); }
      return q || 'plan';
    }
    /* Parameter, von denen die Differenz b − a abhängt, mit ihrem Faktor k (Änderung des Maßes = k × Änderung des Parameters):
       { art: 'wurzel' (Achse mit eigenem Wert) | 'achse+' / 'achse-' (Zahl in plus / minus einer abgeleiteten Achse) | 'typ' (Wandtyp, k = 0,5 bei halber Dicke)
              | 'wanddicke' (eigene Dicke einer Wand), name, k }. Phase 4 (src/aendern.js) wählt daraus den Parameter, der nachgibt. */
    function abhaengig(a, b) {
      var out = [], keys = {};
      Object.keys(a.t).concat(Object.keys(b.t)).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) {
        var ta = a.t[k], tb = b.t[k], c = (tb ? tb.c : 0) - (ta ? ta.c : 0), m;
        if (Math.abs(c) < 1e-9) return;
        if (k.indexOf('t:') === 0) out.push({ art: 'typ', name: k.slice(2), k: c });
        else if (k.indexOf('d:') === 0) out.push({ art: 'wanddicke', name: k.slice(2), k: c });
        else if ((m = /^p:(.*)([+-])$/.exec(k))) out.push({ art: m[2] === '+' ? 'achse+' : 'achse-', name: m[1], k: (tb ? tb.s : 0) - (ta ? ta.s : 0) });
      });
      if (a.root !== b.root) { out.push({ art: 'wurzel', name: a.root, k: -1 }); out.push({ art: 'wurzel', name: b.root, k: 1 }); }
      return out;
    }
    function achseZuWert(c, praefix) { // Name einer Achse (x. oder z.) mit diesem Wert; Außenmaße zuerst
      var gruppen = [haus.aussenmasse || {}, haus.achsen || {}], i, n;
      for (i = 0; i < gruppen.length; i++) for (n in gruppen[i]) if (n.indexOf(praefix) === 0 && Math.abs(WV.mm(n) - c) < TOL) return n;
      return null;
    }
    return { haus: haus, WV: WV, abl: abl, typen: typen, defs: defs, leer: leer, kopie: kopie, addTerm: addTerm, term: term, typQ: typQ, achseExpr: achseExpr,
             ausdruckExpr: ausdruckExpr, differenzQ: differenzQ, abhaengig: abhaengig, achseZuWert: achseZuWert };
  }

  /* ---------- Wände eines Geschosses mit Richtung, Flächen (Seiten) und Herkunft ---------- */
  function wandInfos(K, g) {
    var WV = K.WV;
    return K.abl.geschosse[g].waende.filter(function (w) { return !w.trennlinie; }).map(function (w) {
      var ln = w.linie, vert = Math.abs(ln.a[0] - ln.b[0]) < TOL, horiz = Math.abs(ln.a[1] - ln.b[1]) < TOL;
      var xs = w.ring.map(function (p) { return p[0]; }), zs = w.ring.map(function (p) { return p[1]; });
      var info = { id: w.id, w: w, ln: ln, orth: vert ? 'v' : (horiz ? 'h' : null), x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs), seiten: null };
      var typ = w.wand.typ;
      info.q = w.wand.dicke != null ? (w.wand.quelle || 'plan') : K.typQ(typ);
      if (info.orth) { // die zwei Seiten (Flächen) quer zur Wand mit Koordinate und Ausdruck
        var quer = vert ? 0 : 1, cross = w.wand.von[quer], e0 = K.ausdruckExpr(cross), c0 = WV.mm(cross), n = ln.n[quer], t = ln.t;
        var key = w.wand.dicke != null ? 'd:' + w.id : 't:' + typ, q = info.q;
        function seite(c, sg) { var e = K.kopie(e0); if (sg) K.addTerm(e, key, sg, q); return { c: c, e: e }; }
        var s;
        if (w.wand.flucht === 'mitte') s = [seite(c0 - t / 2, -0.5), seite(c0 + t / 2, 0.5)];
        else s = [seite(c0, 0), seite(c0 - n * t, -n)].sort(function (a, b) { return a.c - b.c; });
        info.seiten = s;
      }
      return info;
    });
  }

  /* ---------- Maßkette entlang einer Schnittlinie ---------- */
  function raumBei(K, g, x, z) {
    var Rr = R(), hit = null;
    K.abl.raeume.forEach(function (r) { if (!hit && r.geschoss === g && r.ring.length && Rr.imPolygon([r.ring].concat(r.loecher || []), x, z)) hit = r; });
    return hit;
  }
  function schnittIntervall(info, richtung, bei) { // Länge, in der die Wand die Schnittlinie schneidet: [von, bis] oder null
    var xs = [], i, a, b, t, p = info.w.ring;
    for (i = 0; i < p.length; i++) {
      a = p[i]; b = p[(i + 1) % p.length];
      var ia = richtung === 'x' ? 1 : 0, ib = richtung === 'x' ? 0 : 1; // ia: Querkoordinate (fest), ib: Laufkoordinate
      if ((a[ia] - bei) * (b[ia] - bei) < 0 || (a[ia] === bei && b[ia] === bei)) {
        if (a[ia] === b[ia]) { xs.push(a[ib], b[ib]); continue; }
        t = (bei - a[ia]) / (b[ia] - a[ia]); xs.push(a[ib] + (b[ib] - a[ib]) * t);
      } else if (a[ia] === bei) xs.push(a[ib]);
    }
    return xs.length >= 2 ? [Math.min.apply(null, xs), Math.max.apply(null, xs)] : null;
  }
  function kette(K, g, infos, richtung, bei) {
    var quer = richtung === 'x' ? 0 : 1, senkr = richtung === 'x' ? 'v' : 'h', solids = [];
    infos.forEach(function (info) {
      if (info.orth === (richtung === 'x' ? 'h' : 'v')) return; // läuft entlang der Schnittlinie
      var lo = richtung === 'x' ? info.z0 : info.x0, hi = richtung === 'x' ? info.z1 : info.x1;
      if (info.orth === senkr && !(bei > lo + TOL && bei < hi - TOL)) return;
      var iv = schnittIntervall(info, richtung, bei);
      if (!iv || iv[1] - iv[0] < TOL) return;
      solids.push({ s: iv[0], e: iv[1], ids: [info.id], q: info.q, schraeg: !info.orth, fl: info.orth ? info.seiten[0] : null, fr: info.orth ? info.seiten[1] : null });
    });
    solids.sort(function (a, b) { return a.s - b.s; });
    var merged = [];
    solids.forEach(function (s) {
      var l = merged[merged.length - 1];
      if (l && s.s <= l.e + TOL) {
        l.ids = l.ids.concat(s.ids); l.q = schlechter(l.q, s.q); l.schraeg = l.schraeg || s.schraeg;
        if (s.e > l.e) { l.e = s.e; l.fr = s.fr; }
      } else merged.push(s);
    });
    var segs = [];
    merged.forEach(function (s, i) {
      var q = s.q;
      if (s.fl && s.fr && s.ids.length === 1) q = K.differenzQ(s.fl.e, s.fr.e);
      segs.push({ art: 'wand', von: s.s, bis: s.e, laenge: s.e - s.s, name: 'wand:' + s.ids.join('+'), quelle: q, fest: false, ids: s.ids, schraeg: s.schraeg,
                  parameter: s.fl && s.fr && s.ids.length === 1 ? K.abhaengig(s.fl.e, s.fr.e) : null });
      if (i + 1 < merged.length) {
        var n = merged[i + 1], mid = (s.e + n.s) / 2, r = richtung === 'x' ? raumBei(K, g, mid, bei) : raumBei(K, g, bei, mid);
        var name = r ? 'raum:' + r.id + (richtung === 'x' ? '.breite' : '.tiefe') : 'luft:' + s.ids[0] + '/' + n.ids[0];
        segs.push({ art: 'raum', von: s.e, bis: n.s, laenge: n.s - s.e, name: name, quelle: s.fr && n.fl ? K.differenzQ(s.fr.e, n.fl.e) : 'ohne', fest: false, ids: r ? [r.id] : [], schraeg: false,
                  parameter: s.fr && n.fl ? K.abhaengig(s.fr.e, n.fl.e) : null });
      }
    });
    return { richtung: richtung, bei: bei, von: merged.length ? merged[0].s : 0, bis: merged.length ? merged[merged.length - 1].e : 0, segmente: segs };
  }

  kettenSchnitt = function (haus, WV, abl, geschoss, richtung, bei) {
    var K = kontext(haus, WV, abl);
    return kette(K, geschoss, wandInfos(K, geschoss), richtung, bei);
  };

  /* Schnittlinien so wählen, dass jede achsparallele Wand quer zur Messrichtung in mindestens einer Kette steht (Mengenüberdeckung, gierig) */
  function waehleScans(infos, richtung) {
    var senkr = richtung === 'x' ? 'v' : 'h', par = richtung === 'x' ? 'h' : 'v';
    function lo(i) { return richtung === 'x' ? i.z0 : i.x0; }
    function hi(i) { return richtung === 'x' ? i.z1 : i.x1; }
    var pts = {}, rest = {}, cand = [];
    infos.forEach(function (i) { pts[Math.round(lo(i) * 1000)] = lo(i); pts[Math.round(hi(i) * 1000)] = hi(i); if (i.orth === senkr) rest[i.id] = true; });
    var xs = Object.keys(pts).map(function (k) { return pts[k]; }).sort(function (a, b) { return a - b; });
    for (var k = 0; k + 1 < xs.length; k++) {
      var breite = xs[k + 1] - xs[k], bei = (xs[k] + xs[k + 1]) / 2;
      if (breite < 40) continue;
      var drin = infos.some(function (i) { return i.orth === par && bei > lo(i) && bei < hi(i); });
      if (drin) continue;
      var ids = infos.filter(function (i) { return i.orth === senkr && bei > lo(i) && bei < hi(i); }).map(function (i) { return i.id; });
      var schraeg = infos.filter(function (i) { return !i.orth && bei > lo(i) && bei < hi(i); }).length;
      cand.push({ bei: bei, breite: breite, ids: ids, schraeg: schraeg });
    }
    var gewaehlt = [];
    for (;;) {
      var best = null, bn = 0;
      cand.forEach(function (c) {
        var n = c.ids.filter(function (id) { return rest[id]; }).length;
        if (n > bn || (n === bn && n > 0 && best && (c.schraeg < best.schraeg || (c.schraeg === best.schraeg && c.breite > best.breite)))) { best = c; bn = n; }
      });
      if (!best || !bn) break;
      gewaehlt.push(best.bei);
      best.ids.forEach(function (id) { delete rest[id]; });
    }
    return gewaehlt.sort(function (a, b) { return a - b; });
  }

  /* ---------- Gesamtmaße und Öffnungsketten ---------- */
  function huellenKanten(K, g, ring) { // achsparallele Kanten mit Blickrichtung nach außen: { seite, koord, von, bis }
    var Rr = R(), out = [], n = ring.length, i;
    for (i = 0; i < n; i++) {
      var a = ring[i], b = ring[(i + 1) % n], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (Math.abs(a[1] - b[1]) < TOL) { // waagerecht: Nord oder Süd
        var innenS = Rr.imPolygon([ring], mx, mz + 0.5);
        out.push({ seite: innenS ? 'N' : 'S', koord: a[1], von: Math.min(a[0], b[0]), bis: Math.max(a[0], b[0]) });
      } else if (Math.abs(a[0] - b[0]) < TOL) {
        var innenO = Rr.imPolygon([ring], mx + 0.5, mz);
        out.push({ seite: innenO ? 'W' : 'O', koord: a[0], von: Math.min(a[1], b[1]), bis: Math.max(a[1], b[1]) });
      }
    }
    return out;
  }
  function gesamtKetten(K, g, ring) {
    var kanten = huellenKanten(K, g, ring), out = [];
    ['N', 'S', 'W', 'O'].forEach(function (seite) {
      var ks = kanten.filter(function (k) { return k.seite === seite; });
      if (!ks.length) return;
      var richtung = seite === 'N' || seite === 'S' ? 'x' : 'z', praefix = richtung + '.', pts = {}, aussenZuerst = seite === 'N' || seite === 'W' ? 1 : -1, bedeckt = [];
      // von außen nach innen: eine Kante, die hinter einer weiter außen liegenden verschwindet (z. B. die Treppenöffnung im DG), trägt nichts zum Gesamtmaß bei
      ks = ks.slice().sort(function (a, b) { return aussenZuerst * (a.koord - b.koord); });
      ks = ks.map(function (k) {
        var teile = [[k.von, k.bis]];
        bedeckt.forEach(function (b) {
          var neu = [];
          teile.forEach(function (t) { if (b[1] <= t[0] + TOL || b[0] >= t[1] - TOL) neu.push(t); else { if (b[0] > t[0] + TOL) neu.push([t[0], b[0]]); if (b[1] < t[1] - TOL) neu.push([b[1], t[1]]); } });
          teile = neu;
        });
        bedeckt.push([k.von, k.bis]);
        return teile.map(function (t) { return { von: t[0], bis: t[1] }; });
      }).reduce(function (a, b) { return a.concat(b); }, []);
      if (!ks.length) return;
      ks.forEach(function (k) { pts[Math.round(k.von * 1000)] = k.von; pts[Math.round(k.bis * 1000)] = k.bis; });
      var xs = Object.keys(pts).map(function (k) { return pts[k]; }).sort(function (a, b) { return a - b; }), segs = [];
      for (var i = 0; i + 1 < xs.length; i++) {
        var m = (xs[i] + xs[i + 1]) / 2;
        if (!ks.some(function (k) { return m > k.von && m < k.bis; })) continue;
        segs.push({ a: xs[i], b: xs[i + 1] });
      }
      var kette = { typ: 'gesamt', seite: seite, richtung: richtung, bei: null, von: segs.length ? segs[0].a : 0, bis: segs.length ? segs[segs.length - 1].b : 0, segmente: [] };
      segs.forEach(function (s, k) {
        var na = K.achseZuWert(s.a, praefix), nb = K.achseZuWert(s.b, praefix), fa = na && K.defs[na], fb = nb && K.defs[nb];
        var imAussen = function (n) { return n && K.haus.aussenmasse && K.haus.aussenmasse[n]; };
        var name;
        if (segs.length === 1 && na && nb && imAussen(na) && imAussen(nb)) name = 'aussen:' + (richtung === 'x' ? 'breite' : 'tiefe');
        else if (na && nb) name = (imAussen(na) && imAussen(nb) ? 'aussen:' : 'gesamt:') + na + '-' + nb;
        else name = 'gesamt:' + seite + (k + 1);
        kette.segmente.push({ art: 'gesamt', von: s.a, bis: s.b, laenge: s.b - s.a, name: name, quelle: na && nb ? K.differenzQ(K.achseExpr(na), K.achseExpr(nb)) : 'ohne',
                              fest: !!(fa && fb && fa.fest && fb.fest), ids: [], schraeg: false, parameter: na && nb ? K.abhaengig(K.achseExpr(na), K.achseExpr(nb)) : null });
      });
      if (kette.segmente.length) out.push(kette);
    });
    return out;
  }
  function seiteVonNormale(n) { return n[1] < -0.5 ? 'N' : n[1] > 0.5 ? 'S' : n[0] < -0.5 ? 'W' : 'O'; }
  function oeffnungsListe(K, g, infos) { // alle Öffnungen des Geschosses mit Fläche und Beschriftung
    var WV = K.WV, Rr = R(), out = [];
    infos.forEach(function (info) {
      var w = info.w, ln = info.ln, os = w.wand.oeffnungen || [];
      if (!os.length) return;
      var L = Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1]), u = [(ln.b[0] - ln.a[0]) / L, (ln.b[1] - ln.a[1]) / L];
      var along = Math.abs(ln.b[0] - ln.a[0]) >= Math.abs(ln.b[1] - ln.a[1]) ? 0 : 1, dir = ln.b[along] >= ln.a[along] ? 1 : -1;
      os.forEach(function (o, k) {
        var ab = typeof o.ab === 'number' ? o.ab : (WV.mm(o.ab) - ln.a[along]) * dir;
        var a = [ln.a[0] + u[0] * ab, ln.a[1] + u[1] * ab], b = [ln.a[0] + u[0] * (ab + o.breite), ln.a[1] + u[1] * (ab + o.breite)];
        out.push({
          name: w.id + '.oeff' + (k + 1), wand: w.id, art: o.art, ab: ab, breite: o.breite, hoehe: o.hoehe, bruestung: o.bruestung || 0, quelle: o.quelle || 'plan',
          ring: Rr.wandRing({ a: a, b: b, t: ln.t }, 0), mitte: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], richtung: along === 0 ? 'x' : 'z', dicke: ln.t,
          beschriftung: cm(o.breite) + (typeof o.hoehe === 'number' ? '/' + cm(o.hoehe) : '')
        });
      });
    });
    return out;
  }
  function oeffnungsKetten(K, g, infos, ring) {
    var kanten = huellenKanten(K, g, ring), out = [];
    infos.forEach(function (info) {
      var os = info.w.wand.oeffnungen || [];
      if (!os.length || !info.orth) return;
      var ln = info.ln, n = ln.n;
      if (Math.abs(n[0]) + Math.abs(n[1]) < 0.5) return; // Wand auf der Mittellinie
      var mid = [(ln.a[0] + ln.b[0]) / 2 + n[0] * ln.t / 2, (ln.a[1] + ln.b[1]) / 2 + n[1] * ln.t / 2], seite = seiteVonNormale(n);
      var aussen = kanten.some(function (k) {
        return k.seite === seite && (seite === 'N' || seite === 'S' ? Math.abs(k.koord - mid[1]) < 0.5 && mid[0] >= k.von - 0.5 && mid[0] <= k.bis + 0.5 : Math.abs(k.koord - mid[0]) < 0.5 && mid[1] >= k.von - 0.5 && mid[1] <= k.bis + 0.5);
      });
      if (!aussen) return;
      var along = info.orth === 'h' ? 0 : 1, richtung = along === 0 ? 'x' : 'z', dir = ln.b[along] >= ln.a[along] ? 1 : -1;
      var Lw = Math.abs(ln.b[along] - ln.a[along]);
      var teile = os.map(function (o, k) {
        var ab = typeof o.ab === 'number' ? o.ab : (K.WV.mm(o.ab) - ln.a[along]) * dir, p0 = ln.a[along] + dir * ab, p1 = ln.a[along] + dir * (ab + o.breite);
        return { k: k, s: Math.min(p0, p1), e: Math.max(p0, p1), o: o };
      }).sort(function (a, b) { return a.s - b.s; });
      var lo = Math.min(ln.a[along], ln.b[along]), hi = Math.max(ln.a[along], ln.b[along]), segs = [], cur = lo, pf = 0, prev = null;
      teile.forEach(function (t) {
        if (t.s - cur > TOL) { pf++; segs.push({ art: 'pfeiler', von: cur, bis: t.s, laenge: t.s - cur, name: info.id + '.pfeiler' + pf, quelle: schlechter(prev ? prev.o.quelle || 'plan' : null, t.o.quelle || 'plan'), fest: false, ids: [info.id], schraeg: false, oeffnungen: { vorige: prev ? prev.k : null, naechste: t.k } }); }
        segs.push({ art: 'oeffnung', von: t.s, bis: t.e, laenge: t.e - t.s, name: info.id + '.oeff' + (t.k + 1), quelle: t.o.quelle || 'plan', fest: false, ids: [info.id], schraeg: false, oeffnungen: { wand: info.id, k: t.k } });
        cur = t.e; prev = t;
      });
      if (hi - cur > TOL) { pf++; segs.push({ art: 'pfeiler', von: cur, bis: hi, laenge: hi - cur, name: info.id + '.pfeiler' + pf, quelle: prev ? prev.o.quelle || 'plan' : 'plan', fest: false, ids: [info.id], schraeg: false, oeffnungen: { vorige: prev ? prev.k : null, naechste: null } }); }
      out.push({ typ: 'oeffnungen', seite: seite, richtung: richtung, bei: null, wand: info.id, koord: seite === 'N' || seite === 'S' ? mid[1] : mid[0], von: lo, bis: hi, segmente: segs });
    });
    return out;
  }

  /* ---------- Formatierung ---------- */
  function zahl(v, d) { var s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); if (d && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s.replace('.', ',').replace(/^-0$/, '0'); }
  function cm(mm) { return zahl(mm / 10, 1); }
  function mass(mm) { return mm >= 1000 ? zahl(mm / 1000, 3) : zahl(mm / 10, 1); } // wie im gedruckten Plan: ab 1 m in Metern, darunter in Zentimetern
  function qm(mm2) { return zahl(mm2 / 1e6, 2) + ' m²'; }

  /* ---------- Markierung beim Anklicken: welche Flächen gehören zu einem Maß? ----------
     Jedes Segment einer Kette bekommt `bereiche` = [{ id, ring }] (Ringe in mm): Wandmaß = die ganze Wand (bei zusammengefassten Wänden alle),
     Pfeiler = das Wandstück zwischen den Öffnungen, Öffnung = der Ausschnitt, Gesamtmaß = die Außenwände zwischen den Endpunkten.
     Raummaße haben keine Bereiche (sie zeigen die Schnittlinie). */
  function markieren(K, g, infos, ring, ketten, oel) {
    var kanten = huellenKanten(K, g, ring), byId = {}, opByName = {};
    infos.forEach(function (i) { byId[i.id] = i; });
    oel.forEach(function (o) { opByName[o.name] = o; });
    ketten.forEach(function (k) {
      k.segmente.forEach(function (s) {
        var b = [], i, o;
        if (s.art === 'wand') s.ids.forEach(function (id) { if (byId[id]) b.push({ id: id, ring: byId[id].w.ring }); });
        else if (s.art === 'pfeiler') {
          i = byId[s.ids[0]];
          if (i && i.orth) {
            var h = i.orth === 'h', c = h ? i.ln.a[1] : i.ln.a[0], d = i.ln.t / 2;
            b.push({ id: s.name, ring: h ? [[s.von, c - d], [s.bis, c - d], [s.bis, c + d], [s.von, c + d]] : [[c - d, s.von], [c + d, s.von], [c + d, s.bis], [c - d, s.bis]] });
          }
        } else if (s.art === 'oeffnung') { o = opByName[s.name]; if (o) b.push({ id: s.name, ring: o.ring }); }
        else if (s.art === 'gesamt') {
          var horiz = k.seite === 'N' || k.seite === 'S';
          var edges = kanten.filter(function (e) { return e.seite === k.seite && Math.min(e.bis, s.bis) - Math.max(e.von, s.von) > TOL; });
          var aussen = edges.reduce(function (m, e) { return m == null ? e.koord : (k.seite === 'N' || k.seite === 'W' ? Math.min(m, e.koord) : Math.max(m, e.koord)); }, null);
          edges = edges.filter(function (e) { return Math.abs(e.koord - aussen) < 0.5; }); // nur die äußerste Kante zählt (die Treppenöffnung im DG liegt dahinter)
          infos.forEach(function (w) {
            if (w.orth !== (horiz ? 'h' : 'v')) return;
            var lo = horiz ? w.x0 : w.z0, hi = horiz ? w.x1 : w.z1;
            if (Math.min(hi, s.bis) - Math.max(lo, s.von) <= TOL) return;
            var face = k.seite === 'N' ? w.z0 : k.seite === 'S' ? w.z1 : k.seite === 'W' ? w.x0 : w.x1;
            if (edges.some(function (e) { return Math.abs(e.koord - face) < 0.5; })) b.push({ id: w.id, ring: w.w.ring });
          });
        }
        s.bereiche = b;
      });
    });
  }

  /* ---------- Grundriss ableiten ---------- */
  function eindeutigeNamen(ketten) {
    var wert = {};
    ketten.forEach(function (k) {
      k.segmente.forEach(function (s) {
        if (wert[s.name] != null && Math.abs(wert[s.name] - s.laenge) > 0.5 && !s.schraeg) s.name += '@' + Math.round(k.bei != null ? k.bei : 0);
        wert[s.name] = s.laenge;
      });
    });
  }
  function rechteck(ring, loecher) {
    if (loecher && loecher.length || ring.length !== 4) return false;
    return ring.every(function (p, i) { var q = ring[(i + 1) % 4]; return Math.abs(p[0] - q[0]) < 1e-3 || Math.abs(p[1] - q[1]) < 1e-3; });
  }
  grundrissAbleiten = function (haus, WV, abl, dach, befunde, geschoss) {
    var g = geschoss, K = kontext(haus, WV, abl), gs = abl.geschosse[g], Rr = R();
    if (!gs) throw new Error('Geschoss ohne Grundriss: ' + g);
    var infos = wandInfos(K, g), ring = gs.boden;
    var xs = ring.map(function (p) { return p[0]; }), zs = ring.map(function (p) { return p[1]; });
    var grenzen = { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs) };
    var ketten = [].concat(oeffnungsKetten(K, g, infos, ring));
    ['x', 'z'].forEach(function (richtung) {
      waehleScans(infos, richtung).forEach(function (bei) {
        var k = kette(K, g, infos, richtung, bei);
        k.typ = 'waende'; k.seite = richtung === 'x' ? 'N' : 'O'; k.wand = null;
        if (k.segmente.length) ketten.push(k);
      });
    });
    ketten = ketten.concat(gesamtKetten(K, g, ring));
    eindeutigeNamen(ketten);
    var oel = oeffnungsListe(K, g, infos);
    markieren(K, g, infos, ring, ketten, oel);
    var waende = infos.map(function (i) { return { id: i.id, typ: i.w.wand.typ, dicke: i.ln.t, ring: i.w.ring, quelle: i.q, freiesEnde: !!i.w.wand.freiesEnde }; });
    var daemmung = [];
    infos.forEach(function (i) { // erste Schicht eines Wandtyps (z. B. Dämmung der Außenwand) liegt auf der Flucht-Seite
      var t = K.typen[i.w.wand.typ];
      if (!t || !t.schichten || !t.schichten.length || i.w.wand.dicke != null) return;
      var s0 = t.schichten[0][1], ln = i.ln, m = (ln.t - s0) / 2;
      daemmung.push(Rr.wandRing({ a: [ln.a[0] + ln.n[0] * m, ln.a[1] + ln.n[1] * m], b: [ln.b[0] + ln.n[0] * m, ln.b[1] + ln.n[1] * m], t: s0 }, 0));
    });
    var raeume = abl.raeume.filter(function (r) { return r.geschoss === g; }).map(function (r) {
      var xr = r.ring.map(function (p) { return p[0]; }), zr = r.ring.map(function (p) { return p[1]; });
      var mitte = r.ring.length ? [(Math.min.apply(null, xr) + Math.max.apply(null, xr)) / 2, (Math.min.apply(null, zr) + Math.max.apply(null, zr)) / 2] : r.stempel;
      if (r.ring.length && !Rr.imPolygon([r.ring].concat(r.loecher || []), mitte[0], mitte[1])) mitte = r.stempel; // sonst am Stempel
      return { id: r.id, name: r.name, boden: r.boden, stempel: r.stempel, textpos: mitte, flaeche: r.flaeche, ring: r.ring, loecher: r.loecher || [], notiz: r.notiz,
               lichte: r.ring.length ? { breite: Math.max.apply(null, xr) - Math.min.apply(null, xr), tiefe: Math.max.apply(null, zr) - Math.min.apply(null, zr) } : { breite: 0, tiefe: 0 },
               rechteckig: rechteck(r.ring, r.loecher) };
    });
    var plan = {
      geschoss: g, grenzen: grenzen, huelle: ring, waende: waende, waendeUnion: gs.wandUnion || [], daemmung: daemmung,
      oeffnungen: oel, raeume: raeume, ketten: ketten,
      trennlinien: gs.waende.filter(function (w) { return w.trennlinie; }).map(function (w) { return { id: w.id, von: w.linie.a, bis: w.linie.b }; }),
      treppe: null, treppenoeffnung: null, zonen: null,
      marken: (befunde || []).filter(function (b) { return b.ort && b.geschoss === g; }).map(function (b) { return { regel: b.regel, stufe: b.stufe, text: b.text, ort: b.ort, elemente: b.elemente }; })
    };
    var T = haus.treppe;
    if (g === 'EG' && T && T.anker && T.laufEnde) {
      var ax = WV.mm(T.anker[0]), az = WV.mm(T.anker[1]);
      var TR = T.steigungen ? treppeAbleiten(haus, WV) : null;
      plan.treppe = { lauf: [[ax - T.laufEnde, az - T.laufbreite], [ax - T.geraderLaufAb, az - T.laufbreite], [ax - T.geraderLaufAb, az], [ax - T.laufEnde, az]],
                      stufen: TR ? TR.stufen.map(function (s) { return { n: s.n, polygon: s.polygon, schwerpunkt: s.schwerpunkt, hoehe: s.hoehe }; }) : [], lauflinie: TR ? TR.lauflinie : [] };
    }
    if (g === 'DG' && dach) { // Höhenzonen der Wohnfläche: 1–2 m (zur Hälfte angerechnet) und unter 1 m (nicht angerechnet), alle Räume zusammen
      var WF = wohnflaecheAbleiten(haus, WV, abl, dach, null);
      var vereint = function (art) { var l = WF.raeume.filter(function (r) { return r.geschoss === g && r.zonenPolygone[art].length; }).map(function (r) { return r.zonenPolygone[art]; }); return l.length ? polygonClipping.union.apply(null, l) : []; };
      plan.zonen = { halb: vereint('halb'), keine: vereint('keine') };
    }
    if (g === 'DG' && haus.dg && haus.dg.treppenoeffnung) plan.treppenoeffnung = haus.dg.treppenoeffnung.map(function (q) { return [WV.mm(q[0]), WV.mm(q[1])]; });
    return plan;
  };

  /* ---------- SVG ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function f(v) { var s = String(Math.round(v * 10) / 10); return s === '-0' ? '0' : s; }
  function pfad(ring) { return 'M' + ring.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L') + 'Z'; }
  function mpPfad(mp) { return mp.map(function (poly) { return poly.map(pfad).join(''); }).join(''); }
  var FS = 150, ZEILE = 1.18, ZEICHEN = 0.58;
  var CSS = [
    '.plan{--pi:var(--ink,#1f2328);--pm:var(--muted,#6a6f76);--pg:var(--panel,#fbfaf6);--pr:var(--rule,#d9d6cb);--pw:var(--plan-wand,#2b2f35);--pt:var(--plan-raum,#eef0f2);--pe:var(--red,#c8321e);',
    '--qp:var(--q-plan,#1f4fb5);--qa:var(--q-aufmass,#2f7d3a);--qn:var(--q-nutzer,#8a3fb5);--qx:var(--q-annahme,#c76a00);--qo:var(--q-ohne,#7b8088);--pwarn:#c08a1c}',
    '.plan{font-family:Barlow,system-ui,sans-serif;font-variant-numeric:tabular-nums}',
    '.plan .bg{fill:var(--pg)}.plan .raumf{fill:var(--pt);stroke:none}.plan .raumf.on{fill:color-mix(in srgb,var(--qp) 28%,var(--pt))}.plan .wandf{fill:var(--pw);stroke:none}',
    '.plan .eps{fill:url(#hatch)}.plan .oef{fill:var(--pg);stroke:none}.plan .rahmen{fill:none;stroke:var(--pi);stroke-width:14}.plan .glas{fill:none;stroke:var(--pi);stroke-width:9}',
    '.plan .trenn{stroke:var(--pm);stroke-width:12;stroke-dasharray:60 50;fill:none}.plan .treppe{fill:none;stroke:var(--pm);stroke-width:12;stroke-dasharray:90 40}',
    '.plan .stufe{fill:none;stroke:var(--pm);stroke-width:9;stroke-linejoin:round}.plan .lauflinie{fill:none;stroke:var(--pm);stroke-width:8;stroke-dasharray:50 40}.plan .snr{font-size:95px;text-anchor:middle;fill:var(--pm)}',
    '.plan .schnittl .sl{stroke:var(--pe);stroke-width:14;stroke-dasharray:160 50 20 50;fill:none}.plan .schnittl .sa{stroke:var(--pe);stroke-width:14;fill:var(--pe)}.plan .schnittl text{font-size:230px;font-weight:700;fill:var(--pe);text-anchor:middle}.plan .schnittl .hit{stroke:none;cursor:pointer}',
    '.plan .zone-halb{fill:var(--qx);fill-opacity:.3;stroke:none}.plan .zone-keine{fill:var(--pe);fill-opacity:.32;stroke:none}.plan .zonenlegende text{font-size:130px;fill:var(--pm);stroke:none}',
    '.plan .halo{paint-order:stroke;stroke:var(--pg);stroke-width:34;stroke-linejoin:round;fill:var(--pi)}',
    '.plan .rname{font-weight:600;font-size:200px;text-anchor:middle}.plan .rinfo{font-size:150px;text-anchor:middle;fill:var(--pm)}.plan .kreuz{stroke:var(--pm);stroke-width:10}',
    '.plan .olabel{font-size:105px;text-anchor:middle;fill:var(--pm)}.plan .dim{font-size:' + FS + 'px}.plan .dim text{stroke:none}',
    '.plan .ql{stroke-width:14;fill:none}.plan .tick{stroke:var(--pi);stroke-width:12}.plan .ext{stroke:var(--pm);stroke-width:7;opacity:.7}.plan .leit{stroke:var(--pm);stroke-width:6}',
    '.plan .scan{stroke:var(--pm);stroke-width:6;stroke-dasharray:20 90;opacity:.35;fill:none}.plan .hit{fill:transparent;stroke:none;cursor:pointer}.plan .hit:hover{fill:color-mix(in srgb,var(--pi) 12%,transparent)}',
    '.plan .hit.on{fill:color-mix(in srgb,var(--pe) 22%,transparent);stroke:var(--pe);stroke-width:8}.plan .hl{stroke:var(--pe);stroke-width:34;fill:none;stroke-linecap:round}.plan .hlf{fill:var(--pe);fill-opacity:.4;stroke:var(--pe);stroke-width:26;stroke-linejoin:round;pointer-events:none}',
    '.plan .q-plan{fill:var(--qp);stroke:var(--qp)}.plan .q-aufmass{fill:var(--qa);stroke:var(--qa)}.plan .q-nutzer{fill:var(--qn);stroke:var(--qn)}',
    '.plan .q-annahme{fill:var(--qx);stroke:var(--qx)}.plan .q-ohne{fill:var(--qo);stroke:var(--qo)}.plan .dim text.q-plan,.plan .dim text.q-aufmass,.plan .dim text.q-nutzer,.plan .dim text.q-annahme,.plan .dim text.q-ohne{stroke:none}',
    '.plan .ql.q-annahme{stroke-dasharray:90 40}.plan .ql.q-ohne{stroke-dasharray:30 40}.plan .schloss{fill:none;stroke:var(--pi);stroke-width:14}.plan .schloss rect{fill:var(--pi)}',
    '.plan .marke circle{stroke:var(--pg);stroke-width:14}.plan .marke.fehler circle{fill:var(--pe)}.plan .marke.warnung circle{fill:var(--pwarn)}.plan .marke.hinweis circle{fill:var(--pm)}.plan .marke text{fill:var(--pg);font-weight:700;font-size:200px;text-anchor:middle;stroke:none}.plan .marke{cursor:pointer}'
  ].join('');
  var CSS_DUNKEL = '@media (prefers-color-scheme: dark){.plan{--pi:#e8e6df;--pm:#9aa0a8;--pg:#1d2126;--pr:#323840;--pw:#cfcdc6;--pt:#262b31;--pe:#ff7a63;--qp:#7da3ff;--qa:#6fcf7f;--qn:#c39bff;--qx:#ffb25c;--qo:#9aa0a8;--pwarn:#e0b040}}';

  function schlossSvg(x, y) { // Vorhängeschloss, Mitte bei (x, y), etwa 110 mm hoch
    return '<g class="schloss" transform="translate(' + f(x - 40) + ' ' + f(y - 62) + ')"><path d="M14 40V26a26 26 0 0 1 52 0V40"/><rect x="0" y="40" width="80" height="62" rx="8"/></g>';
  }
  function textBreite(s, fs) { return s.length * fs * ZEICHEN; }

  /* Kettenlage: Zeilen für Beschriftungen (gestaffelt, wenn ein Maß schmaler ist als sein Text), Dicke der Kette in mm */
  function kettenLayout(k) {
    var rows = [], horiz = k.richtung === 'x';
    k.segmente.forEach(function (s) {
      var w = textBreite(mass(s.laenge), FS) + (s.fest ? 130 : 0) + 50, m = (s.von + s.bis) / 2, iv = [m - w / 2, m + w / 2], r = 0;
      for (;; r++) { if (!rows[r]) rows[r] = []; if (!rows[r].some(function (o) { return iv[0] < o[1] && iv[1] > o[0]; })) break; }
      rows[r].push(iv); s._zeile = r;
    });
    return { zeilen: rows.length || 1, dicke: 420 + (rows.length || 1) * FS * ZEILE };
  }

  function kettenSvg(k, lage, plan, nr) { // lage: Koordinate der Maßlinie quer zur Messrichtung; Beschriftung liegt nach außen (N oben, S unten, W links, O rechts)
    var horiz = k.richtung === 'x', out = [], sgn = (k.seite === 'N' || k.seite === 'W') ? -1 : 1, geschl = k.segmente.length > 0;
    function P(a, q) { return horiz ? [a, q] : [q, a]; } // Messkoordinate a, Querkoordinate q
    function l(p0, p1, cls) { return '<line' + (cls ? ' class="' + cls + '"' : '') + ' x1="' + f(p0[0]) + '" y1="' + f(p0[1]) + '" x2="' + f(p1[0]) + '" y2="' + f(p1[1]) + '"/>'; }
    var bkoord = {};
    k.segmente.forEach(function (s) { bkoord[Math.round(s.von * 10)] = s.von; bkoord[Math.round(s.bis * 10)] = s.bis; });
    if (k.typ === 'waende' && k.bei != null) out.push(l(P(k.von, k.bei), P(k.bis, k.bei), 'scan'));
    Object.keys(bkoord).forEach(function (kk) { // Hilfslinie von der Außenkante zur Maßlinie (nur Gesamt- und Öffnungsketten), Ticks
      var a = bkoord[kk];
      if (k.typ !== 'waende' && k.anker != null) out.push(l(P(a, k.anker), P(a, lage + sgn * 90), 'ext'));
      var p = P(a, lage), d = 55;
      out.push('<g class="tick"><line x1="' + f(p[0] - d) + '" y1="' + f(p[1] + d) + '" x2="' + f(p[0] + d) + '" y2="' + f(p[1] - d) + '"/>' + l([p[0] + (horiz ? 0 : -110), p[1] + (horiz ? -110 : 0)], [p[0] + (horiz ? 0 : 110), p[1] + (horiz ? 110 : 0)]) + '</g>');
    });
    k.segmente.forEach(function (s) {
      var q = 'q-' + s.quelle, p0 = P(s.von, lage), p1 = P(s.bis, lage), m = (s.von + s.bis) / 2, r = s._zeile || 0, txt = mass(s.laenge);
      out.push('<line class="ql ' + q + '" x1="' + f(p0[0]) + '" y1="' + f(p0[1]) + '" x2="' + f(p1[0]) + '" y2="' + f(p1[1]) + '"/>');
      var off = 55 + r * FS * ZEILE, tx, ty, rot = '';
      if (horiz) { tx = m; ty = sgn < 0 ? lage - off : lage + off + FS * 0.8; }
      else { tx = sgn < 0 ? lage - off : lage + off + FS * 0.8; ty = m; rot = ' transform="rotate(-90 ' + f(tx) + ' ' + f(ty) + ')"'; }
      if (r > 0) { var pa = P(m, lage), pb = P(m, lage + sgn * (off - 20)); out.push(l(pa, pb, 'leit')); }
      out.push('<text class="' + q + '" x="' + f(tx) + '" y="' + f(ty) + '" text-anchor="middle"' + rot + '>' + esc(txt) + (s.schraeg ? '~' : '') + '</text>');
      if (s.fest) {
        var wl = textBreite(txt, FS) / 2 + 85, sx = horiz ? tx + wl : tx, sy = horiz ? ty - FS * 0.32 : ty - wl;
        if (!horiz) sx = tx - FS * 0.32;
        out.push(schlossSvg(sx, sy));
      }
      var hx = horiz ? Math.min(p0[0], p1[0]) : lage - 160, hy = horiz ? lage - 160 : Math.min(p0[1], p1[1]);
      var hw = horiz ? Math.abs(p1[0] - p0[0]) : 320, hh = horiz ? 320 : Math.abs(p1[1] - p0[1]);
      var attr = ' data-name="' + esc(s.name) + '" data-wert="' + f(s.laenge) + '" data-quelle="' + s.quelle + '" data-fest="' + (s.fest ? 1 : 0) + '" data-art="' + s.art + '" data-richtung="' + k.richtung + '" data-von="' + f(s.von) + '" data-bis="' + f(s.bis) + '"' + (k.bei != null ? ' data-bei="' + f(k.bei) + '"' : '') + (s.schraeg ? ' data-schraeg="1"' : '') + (s.abgeleitet ? ' data-abgeleitet="1"' : '');
      out.push('<rect class="hit"' + attr + ' x="' + f(hx) + '" y="' + f(hy) + '" width="' + f(hw) + '" height="' + f(hh) + '"><title>' + esc(s.name + ': ' + mass(s.laenge) + (s.fest ? ' (gesperrt)' : '')) + '</title></rect>');
    });
    return '<g class="dim" data-kette="' + nr + '">' + out.join('') + '</g>';
  }

  grundrissSvg = function (plan, optionen) {
    var o = optionen || {}, standalone = !!o.standalone, zeigeM = o.massketten !== false, zeigeR = o.raeume !== false, zeigeO = o.oeffnungen !== false, zeigeMarken = o.marken !== false, zeigeZonen = o.zonen === true && !!plan.zonen;
    var G = plan.grenzen, parts = [], bb = { x0: G.x0, x1: G.x1, z0: G.z0, z1: G.z1 };
    function erweitere(x, z) { bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); bb.z0 = Math.min(bb.z0, z); bb.z1 = Math.max(bb.z1, z); }

    /* Räume und Wände */
    var bodenSvg = plan.raeume.map(function (r) { return r.ring.length ? '<path class="raumf" data-raum="' + esc(r.id) + '" d="' + pfad(r.ring) + r.loecher.map(pfad).join('') + '" fill-rule="evenodd"/>' : ''; }).join('');
    var waendeSvg = '<path class="wandf" d="' + mpPfad(plan.waendeUnion) + '" fill-rule="evenodd"/>' + plan.daemmung.map(function (r) { return '<path class="eps" d="' + pfad(r) + '"/>'; }).join('');

    /* Öffnungen: Aussparung in der Wand, Fensterlinien */
    var oeffSvg = plan.oeffnungen.map(function (op) {
      var r = op.ring, a = [(r[0][0] + r[3][0]) / 2, (r[0][1] + r[3][1]) / 2], b = [(r[1][0] + r[2][0]) / 2, (r[1][1] + r[2][1]) / 2], s = '<g data-oeffnung="' + esc(op.name) + '"><path class="oef" d="' + pfad(r) + '"/>';
      if (op.art === 'fenster' || op.art === 'fenstertuer') s += '<line class="glas" x1="' + f(a[0]) + '" y1="' + f(a[1]) + '" x2="' + f(b[0]) + '" y2="' + f(b[1]) + '"/>';
      s += '<line class="rahmen" x1="' + f(r[0][0]) + '" y1="' + f(r[0][1]) + '" x2="' + f(r[3][0]) + '" y2="' + f(r[3][1]) + '"/><line class="rahmen" x1="' + f(r[1][0]) + '" y1="' + f(r[1][1]) + '" x2="' + f(r[2][0]) + '" y2="' + f(r[2][1]) + '"/>';
      return s + '</g>';
    }).join('');
    var oeffText = zeigeO ? plan.oeffnungen.map(function (op) {
      var vert = op.richtung === 'z', x = op.mitte[0], z = op.mitte[1];
      var text = vert ? '<text class="olabel halo" transform="rotate(-90 ' + f(x) + ' ' + f(z) + ')" x="' + f(x) + '" y="' + f(z + 35) + '">' + esc(op.beschriftung) + '</text>'
                      : '<text class="olabel halo" x="' + f(x) + '" y="' + f(z + 35) + '">' + esc(op.beschriftung) + '</text>';
      var quer = Math.max(op.dicke, 260), bw = vert ? quer : op.breite, bh = vert ? op.breite : quer; // anklickbar: der Ausschnitt, mindestens so breit wie die Beschriftung hoch ist
      var lo = (vert ? z : x) - op.breite / 2;
      var attr = ' data-name="' + esc(op.name) + '" data-wert="' + f(op.breite) + '" data-quelle="' + op.quelle + '" data-fest="0" data-art="oeffnung" data-richtung="' + op.richtung + '" data-von="' + f(lo) + '" data-bis="' + f(lo + op.breite) + '"';
      return text + '<rect class="hit"' + attr + ' x="' + f(x - bw / 2) + '" y="' + f(z - bh / 2) + '" width="' + f(bw) + '" height="' + f(bh) + '"><title>' + esc(op.name + ': ' + mass(op.breite)) + '</title></rect>';
    }).join('') : '';

    /* Treppe, Treppenöffnung, Trennlinien */
    var extra = plan.trennlinien.map(function (t) { return '<line class="trenn" x1="' + f(t.von[0]) + '" y1="' + f(t.von[1]) + '" x2="' + f(t.bis[0]) + '" y2="' + f(t.bis[1]) + '"/>'; }).join('');
    if (plan.treppe) {
      if (plan.treppe.stufen && plan.treppe.stufen.length) { // Stufen mit Nummer und Lauflinie (durch die Schwerpunkte der Stufen)
        extra += plan.treppe.stufen.map(function (st) { return '<path class="stufe" data-stufe="' + st.n + '" d="' + pfad(st.polygon) + '"><title>Stufe ' + st.n + ': Trittfläche ' + zahl(st.hoehe / 1000, 3) + ' m über OKFF EG</title></path>'; }).join('');
        extra += '<path class="lauflinie" d="M' + plan.treppe.lauflinie.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L') + '"/>';
        extra += plan.treppe.stufen.map(function (st) { return '<text class="snr halo" x="' + f(st.schwerpunkt[0]) + '" y="' + f(st.schwerpunkt[1] + 32) + '">' + st.n + '</text>'; }).join('');
      } else extra += '<path class="treppe" d="' + pfad(plan.treppe.lauf) + '"/>';
    }
    if (plan.treppenoeffnung) extra += '<path class="treppe" d="' + pfad(plan.treppenoeffnung) + '"/>';

    /* Raumstempel: Name, Fläche, lichte Maße */
    var raumSvg = zeigeR ? plan.raeume.map(function (r) {
      var x = r.stempel[0], z = r.stempel[1], tx = r.textpos[0], tz = r.textpos[1], lichte = (r.rechteckig ? '' : '≈ ') + zahl(r.lichte.breite / 1000, 3) + ' × ' + zahl(r.lichte.tiefe / 1000, 3) + ' m';
      return '<g class="raum" data-raum="' + esc(r.id) + '"><line class="kreuz" x1="' + f(x - 50) + '" y1="' + f(z) + '" x2="' + f(x + 50) + '" y2="' + f(z) + '"/><line class="kreuz" x1="' + f(x) + '" y1="' + f(z - 50) + '" x2="' + f(x) + '" y2="' + f(z + 50) + '"/>' +
        '<text class="rname halo" x="' + f(tx) + '" y="' + f(tz - 150) + '">' + esc(r.name) + '</text><text class="rinfo halo" x="' + f(tx) + '" y="' + f(tz + 30) + '">' + esc(qm(r.flaeche)) + '</text>' +
        '<text class="rinfo halo" x="' + f(tx) + '" y="' + f(tz + 200) + '">' + esc(lichte) + '</text></g>';
    }).join('') : '';

    /* Maßketten: Reihenfolge von innen nach außen je Seite; Öffnungsketten hängen an ihrer Wand, die übrigen an der äußersten Kante */
    var ketten = plan.ketten, kettenSvgTeile = '';
    if (zeigeM) {
      var cursor = { N: G.z0, S: G.z1, W: G.x0, O: G.x1 };
      var sgnSeite = { N: -1, S: 1, W: -1, O: 1 }, reihenfolge = [];
      ['N', 'O', 'S', 'W'].forEach(function (seite) {
        ketten.filter(function (k) { return k.typ === 'oeffnungen' && k.seite === seite; }).forEach(function (k) { reihenfolge.push(k); });
        ketten.filter(function (k) { return k.typ === 'waende' && k.seite === seite; }).sort(function (a, b) { return a.bei - b.bei; }).forEach(function (k) { reihenfolge.push(k); });
        ketten.filter(function (k) { return k.typ === 'gesamt' && k.seite === seite; }).forEach(function (k) { reihenfolge.push(k); });
      });
      var nr = 0;
      reihenfolge.forEach(function (k) {
        var lay = kettenLayout(k), sg = sgnSeite[k.seite], lage;
        if (k.typ === 'oeffnungen') { // hängt an seiner Wand; liegt die Wand an der äußersten Kante, rücken die folgenden Ketten nach außen
          k.anker = k.koord; lage = k.koord + sg * 450;
          if (Math.abs(k.koord - cursor[k.seite]) < 1) cursor[k.seite] += sg * lay.dicke;
        } else {
          k.anker = k.typ === 'gesamt' ? cursor[k.seite] : null;
          lage = cursor[k.seite] + sg * 450;
          cursor[k.seite] += sg * lay.dicke;
        }
        if (k.richtung === 'x') { erweitere(k.von, lage + sg * lay.dicke); erweitere(k.bis, lage); } else { erweitere(lage + sg * lay.dicke, k.von); erweitere(lage, k.bis); }
        kettenSvgTeile += kettenSvg(k, lage, plan, nr++);
      });
    }

    /* Schnittlinien: gestrichelt mit Buchstaben an den Enden und Pfeilen in Blickrichtung (links von der Laufrichtung) */
    var schnittSvgTeile = (o.schnittlinien || []).map(function (sl) {
      var L = Math.hypot(sl.b[0] - sl.a[0], sl.b[1] - sl.a[1]), u = [(sl.b[0] - sl.a[0]) / L, (sl.b[1] - sl.a[1]) / L], bl = [u[1], -u[0]], pf = 420, out = '';
      erweitere(sl.a[0], sl.a[1]); erweitere(sl.b[0], sl.b[1]); erweitere(sl.a[0] + bl[0] * (pf + 330), sl.a[1] + bl[1] * (pf + 330)); erweitere(sl.b[0] + bl[0] * (pf + 330), sl.b[1] + bl[1] * (pf + 330));
      out += '<line class="sl" x1="' + f(sl.a[0]) + '" y1="' + f(sl.a[1]) + '" x2="' + f(sl.b[0]) + '" y2="' + f(sl.b[1]) + '"/>';
      [sl.a, sl.b].forEach(function (p) {
        var t = [p[0] + bl[0] * pf, p[1] + bl[1] * pf], k1 = [t[0] - bl[0] * 120 + u[1] * 90 * -1, t[1] - bl[1] * 120 + u[0] * 90], k2 = [t[0] - bl[0] * 120 - u[1] * 90 * -1, t[1] - bl[1] * 120 - u[0] * 90];
        out += '<line class="sl" style="stroke-dasharray:none" x1="' + f(p[0]) + '" y1="' + f(p[1]) + '" x2="' + f(t[0]) + '" y2="' + f(t[1]) + '"/><path class="sa" d="M' + f(t[0]) + ' ' + f(t[1]) + 'L' + f(k1[0]) + ' ' + f(k1[1]) + 'L' + f(k2[0]) + ' ' + f(k2[1]) + 'Z"/>' +
          '<text class="halo" x="' + f(p[0] + bl[0] * (pf + 330)) + '" y="' + f(p[1] + bl[1] * (pf + 330) + 80) + '">' + esc(sl.id) + '</text>';
      });
      var m = [(sl.a[0] + sl.b[0]) / 2, (sl.a[1] + sl.b[1]) / 2], w = 300, nq = [-u[1], u[0]];
      out += '<polygon class="hit" points="' + [[sl.a[0] + nq[0] * w, sl.a[1] + nq[1] * w], [sl.b[0] + nq[0] * w, sl.b[1] + nq[1] * w], [sl.b[0] - nq[0] * w, sl.b[1] - nq[1] * w], [sl.a[0] - nq[0] * w, sl.a[1] - nq[1] * w]].map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' ') + '" fill="transparent"><title>' + esc(sl.name || sl.id) + '</title></polygon>';
      return '<g class="schnittl" data-schnitt="' + esc(sl.id) + '">' + out + '</g>';
    }).join('');

    /* Befund-Marken */
    var markenSvg = zeigeMarken ? plan.marken.map(function (m, i) {
      return '<g class="marke ' + m.stufe + '" data-marke="' + i + '" transform="translate(' + f(m.ort[0]) + ' ' + f(m.ort[1]) + ')"><circle r="170"/><text y="70">!</text><title>' + esc('Regel ' + m.regel + ': ' + m.text) + '</title></g>';
    }).join('') : '';

    var zonenSvg = '';
    if (zeigeZonen) {
      var lx = G.x0, lz = G.z1 + 330;
      zonenSvg = '<path class="zone-halb" d="' + mpPfad(plan.zonen.halb) + '" fill-rule="evenodd"/><path class="zone-keine" d="' + mpPfad(plan.zonen.keine) + '" fill-rule="evenodd"/>' +
        '<g class="zonenlegende"><rect class="zone-halb" x="' + f(lx) + '" y="' + f(lz - 130) + '" width="260" height="130"/><text x="' + f(lx + 330) + '" y="' + f(lz) + '">Raumhöhe 1–2 m (zur Hälfte angerechnet)</text>' +
        '<rect class="zone-keine" x="' + f(lx + 4600) + '" y="' + f(lz - 130) + '" width="260" height="130"/><text x="' + f(lx + 4930) + '" y="' + f(lz) + '">unter 1 m (nicht angerechnet)</text></g>';
      erweitere(lx, lz + 80);
    }
    var rand = 700, vx = bb.x0 - rand, vy = bb.z0 - rand, vw = bb.x1 - bb.x0 + 2 * rand, vh = bb.z1 - bb.z0 + 2 * rand;
    var size = standalone ? ' width="' + Math.round(vw / 6) + '" height="' + Math.round(vh / 6) + '"' : '';
    var style = '<style>' + CSS + (standalone ? CSS_DUNKEL : '') + '</style>';
    var defs = '<defs><pattern id="hatch" width="70" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="70" height="70" fill="var(--pw)"/><line x1="0" y1="0" x2="0" y2="70" stroke="var(--pg)" stroke-width="22" opacity=".55"/></pattern></defs>';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="plan" viewBox="' + f(vx) + ' ' + f(vy) + ' ' + f(vw) + ' ' + f(vh) + '"' + size + ' role="img" aria-label="Grundriss ' + esc(plan.geschoss) + '" data-geschoss="' + esc(plan.geschoss) + '" data-viewbox="' + f(vx) + ' ' + f(vy) + ' ' + f(vw) + ' ' + f(vh) + '">' +
      style + defs + (standalone ? '<rect class="bg" x="' + f(vx) + '" y="' + f(vy) + '" width="' + f(vw) + '" height="' + f(vh) + '"/>' : '') +
      '<g class="boden">' + bodenSvg + '</g>' + (zonenSvg ? '<g class="hoehenzonen">' + zonenSvg + '</g>' : '') + '<g class="waende">' + waendeSvg + '</g><g class="oeffnungen">' + oeffSvg + '</g><g class="extra">' + extra + '</g>' +
      '<g class="oeffnungstexte">' + oeffText + '</g><g class="raeume">' + raumSvg + '</g><g class="massketten">' + kettenSvgTeile + '</g><g class="schnittlinien">' + schnittSvgTeile + '</g><g class="marken">' + markenSvg + '</g></svg>';
  };
  /* Zeichenhilfen für Schnitt und Ansicht (src/schnitt.js): dieselben Maßketten, Farben und Zahlenformate wie im Grundriss */
  planHilfen = { kettenSvg: kettenSvg, kettenLayout: kettenLayout, CSS: CSS, CSS_DUNKEL: CSS_DUNKEL, f: f, esc: esc, pfad: pfad, mass: mass, zahl: zahl, schlossSvg: schlossSvg, FS: FS };
})();
if (typeof module !== 'undefined') module.exports = { grundrissAbleiten: grundrissAbleiten, kettenSchnitt: kettenSchnitt, grundrissSvg: grundrissSvg, planHilfen: planHilfen };
