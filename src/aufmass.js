/* Aufmaß: vergleicht gemessene Werte (Prüfmaße, src/data/pruefmasse.json) mit dem Modell. Ohne Three.js, in Node und in der Seite lauffähig.
   Plan docs/plan-parametrisches-modell.md, Abschnitt 3.9 und 9 (Phase 6). Gemessen wird in cm, gerechnet in Millimetern.

     Aufmass.auswerten(D, pruefmasse)        → { zeilen, gemessen, auffaellig, unbekannt }   D = Aendern.ableiten(haus)
     Aufmass.beschreibung(D, maßname)        „Speisekammer, Tiefe“ für ein Raummaß, sonst der Maßname
     Aufmass.cmParsen(text)                  "125", "125,5", "1,255m", "1255mm" → cm; ohne Einheit sind es cm
     Aufmass.listeErzeugen(D, messungen)     Export der Seite: { format: "haus-aufmass", version: 1, eintraege }
     Aufmass.listeLesen(text oder Objekt, D) prüft eine Messliste und gibt die Messungen zurück (wirft bei Fehlern)
     Aufmass.eintragen(text, messungen)      schreibt Messungen in den Text von pruefmasse.json, nur die betroffenen Zeilen ändern sich
     Aufmass.bericht(ergebnis)               Textbericht für Befehlszeile und Test

   Ein Prüfmaß ist genau eines von
     { mass: "raum:speis.tiefe", cm }                          ein benanntes Maß aus Grundriss, Schnitt oder Ansicht (Namen zeigt die Seite beim Anklicken)
     { raum: "wohnen", richtung: "z", bei: 6.0, cm }           Länge der Linie durch den Raum (richtung x: waagerecht bei hz = bei, z: senkrecht bei hx = bei, Meter)
     { raum: "eltern", kante_bei: [4.57, 2.0], cm }            Länge der Raumkante, die dem Punkt (hx, hz in Metern) am nächsten liegt
   mit optional was (Beschriftung), datum (JJJJ-MM-TT) und notiz. Die Werte der beiden letzten Arten stammen aus dem ersten Aufmaß des EG; die Seite
   erfasst Messungen als Maß ("mass").

   Das Aufmaß misst fertige Oberflächen (Putz, Belag), das Modell Rohbaumaße. Abweichung = Modell − Aufmaß. Erwartet ist sie bei lichten Raummaßen
   zwischen putz_cm[0] und putz_cm[1], bei Wandlängen (kante_bei) innerhalb von ±kante_cm. Für andere Maße (Wanddicken, Öffnungen, Gesamtmaße, Höhen)
   gibt es keine Erwartung: die Abweichung wird nur angezeigt (Status "offen"). Das Modell wird nie von selbst angepasst; ob und wie, entscheidet der Nutzer
   (node tools/aendern.js, dort mit --quelle aufmass die Herkunft setzen). */
var Aufmass = (function () {
  var TOL = 1e-6;
  var FELDER = ['mass', 'cm', 'was', 'datum', 'notiz'];

  function fehler(text) { var e = new Error(text); e.aufmass = true; return e; }
  function klon(o) { return JSON.parse(JSON.stringify(o)); }
  function de(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); }

  /* ---------- Werte ---------- */
  function cmParsen(w) {
    if (typeof w === 'number') { if (!isFinite(w) || w <= 0) throw fehler('Der Wert muss größer als 0 sein'); return w; }
    var m = /^\s*(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*$/i.exec(String(w));
    if (!m) throw fehler('Wert nicht lesbar: "' + w + '" (erwartet z. B. 125, 125,5, 1,255m oder 1255mm)');
    var v = parseFloat(m[1].replace(',', '.'));
    if (!(v > 0)) throw fehler('Der Wert muss größer als 0 sein: "' + String(w).trim() + '"');
    if (!m[2] && v < 10) throw fehler('Einheit fehlt bei "' + String(w).trim() + '": ohne Einheit gilt cm, ein so kleiner Wert ist vermutlich in Metern gemeint (z. B. 1,26m)');
    var f = { mm: 0.1, cm: 1, m: 100 }[(m[2] || 'cm').toLowerCase()];
    return Math.round(v * f * 1000) / 1000;
  }

  /* ---------- Modellwerte finden ---------- */
  function segmentSuchen(D, name) {
    var treffer = null;
    D.geschosse.forEach(function (g) {
      if (treffer) return;
      D.plan(g).ketten.forEach(function (k) { k.segmente.forEach(function (s) { if (!treffer && s.name === name) treffer = { seg: s, geschoss: g }; }); });
    });
    return treffer;
  }
  function raumSuchen(D, id) { return D.abl.raeume.filter(function (r) { return r.id === id; })[0] || null; }
  function spanne(ring, richtung, at) { // längste Strecke der Linie durch den Ring (mm)
    var ts = [], i, a, b, ca, cb, ua, ub;
    for (i = 0; i < ring.length; i++) {
      a = ring[i]; b = ring[(i + 1) % ring.length];
      if (richtung === 'x') { ca = a[1]; cb = b[1]; ua = a[0]; ub = b[0]; } else { ca = a[0]; cb = b[0]; ua = a[1]; ub = b[1]; }
      if (((ca - at) * (cb - at) < 0 || (ca === at) !== (cb === at)) && ca !== cb) ts.push(ua + (ub - ua) * (at - ca) / (cb - ca));
    }
    ts.sort(function (p, q) { return p - q; });
    var best = 0; for (i = 0; i + 1 < ts.length; i += 2) best = Math.max(best, ts[i + 1] - ts[i]);
    return best;
  }
  function kantenLaenge(ring, q) { // Länge der Kante, die dem Punkt am nächsten liegt (mm)
    var best = Infinity, len = 0, i, a, b, vx, vz, L2, t, dd;
    for (i = 0; i < ring.length; i++) {
      a = ring[i]; b = ring[(i + 1) % ring.length]; vx = b[0] - a[0]; vz = b[1] - a[1]; L2 = vx * vx + vz * vz;
      if (!L2) continue;
      t = Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vz) / L2));
      dd = Math.hypot(q[0] - a[0] - t * vx, q[1] - a[1] - t * vz);
      if (dd < best) { best = dd; len = Math.sqrt(L2); }
    }
    return len;
  }
  /* → { art, modell (mm), geschoss, erwartet: 'raum' | 'kante' | null } oder null, wenn das Modell die Stelle nicht kennt */
  function modellWert(D, e) {
    var s, h, r;
    if (e.mass != null) {
      s = segmentSuchen(D, e.mass);
      if (s) return { art: s.seg.art === 'raum' ? 'raum' : 'mass', modell: s.seg.laenge, geschoss: s.geschoss, erwartet: s.seg.art === 'raum' ? 'raum' : null };
      h = D.hoehen()[e.mass];
      if (h) return { art: 'hoehe', modell: h.wert, geschoss: null, erwartet: null };
      return null;
    }
    r = raumSuchen(D, e.raum);
    if (!r || !r.ring || !r.ring.length) return null;
    if (e.kante_bei) return { art: 'kante', modell: kantenLaenge(r.ring, [e.kante_bei[0] * 1000, e.kante_bei[1] * 1000]), geschoss: r.geschoss, erwartet: 'kante' };
    return { art: 'raum', modell: spanne(r.ring, e.richtung, e.bei * 1000), geschoss: r.geschoss, erwartet: 'raum' };
  }

  /* ---------- Auswertung ---------- */
  function auswerten(D, pm) {
    var putz = (pm.putz_cm || [-1, 4]).map(function (v) { return v * 10; }), kante = (pm.kante_cm != null ? pm.kante_cm : 2) * 10;
    var zeilen = (pm.masse || []).map(function (e, i) {
      var w = modellWert(D, e), gemessen = e.cm * 10, z = {
        nr: i + 1, was: e.was || (e.mass != null ? beschreibung(D, e.mass) : e.raum), art: w ? w.art : (e.mass != null ? 'mass' : 'raum'), mass: e.mass != null ? e.mass : null, raum: e.raum || null,
        geschoss: w ? w.geschoss : null, gemessen: gemessen, modell: w ? w.modell : null, abweichung: null, erwartet: null, status: 'unbekannt', datum: e.datum || null, notiz: e.notiz || null
      };
      if (!w) return z;
      z.abweichung = w.modell - gemessen;
      z.erwartet = w.erwartet === 'raum' ? putz.slice() : w.erwartet === 'kante' ? [-kante, kante] : null;
      z.status = !z.erwartet ? 'offen' : z.abweichung >= z.erwartet[0] - TOL && z.abweichung <= z.erwartet[1] + TOL ? 'ok' : 'auffaellig';
      return z;
    });
    return {
      zeilen: zeilen, gemessen: zeilen.length,
      auffaellig: zeilen.filter(function (z) { return z.status === 'auffaellig'; }).length,
      unbekannt: zeilen.filter(function (z) { return z.status === 'unbekannt'; }).length
    };
  }
  function beschreibung(D, name) {
    var m = /^raum:([^.@]+)\.(breite|tiefe)(?:@.*)?$/.exec(name), r = m && raumSuchen(D, m[1]);
    return r ? r.name + ', ' + (m[2] === 'breite' ? 'Breite' : 'Tiefe') : name;
  }

  /* ---------- Messung prüfen, Messliste ---------- */
  function eintragPruefen(e, D) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) throw fehler('Eine Messung muss ein Objekt sein');
    Object.keys(e).forEach(function (k) { if (FELDER.indexOf(k) < 0) throw fehler('Unbekanntes Feld "' + k + '" in der Messung (erlaubt: ' + FELDER.join(', ') + ')'); });
    if (typeof e.mass !== 'string' || !e.mass) throw fehler('Das Feld "mass" (Name des Maßes) fehlt');
    if (typeof e.cm !== 'number' || !isFinite(e.cm) || e.cm <= 0) throw fehler('Bei ' + e.mass + ' muss "cm" eine Zahl größer als 0 sein (gemessener Wert in cm)');
    if ('datum' in e) {
      var d = typeof e.datum === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.datum), t = d && new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]));
      if (!d || t.getUTCFullYear() !== +d[1] || t.getUTCMonth() !== +d[2] - 1 || t.getUTCDate() !== +d[3]) throw fehler('Bei ' + e.mass + ' muss das Datum die Form JJJJ-MM-TT haben (z. B. 2026-10-12)');
    }
    ['was', 'notiz'].forEach(function (k) { if (k in e && typeof e[k] !== 'string') throw fehler('Bei ' + e.mass + ' muss "' + k + '" ein Text sein'); });
    if (D && !modellWert(D, e)) throw fehler('Maß unbekannt: ' + e.mass + ' (Namen stehen im Plan beim Anklicken eines Maßes)');
  }
  function listeErzeugen(D, messungen) {
    if (!Array.isArray(messungen) || !messungen.length) throw fehler('Keine Messung zum Exportieren');
    messungen.forEach(function (e) { eintragPruefen(e, D); });
    return { format: 'haus-aufmass', version: 1, eintraege: klon(messungen) };
  }
  function listeLesen(quelle, D) {
    var o = quelle;
    if (typeof quelle === 'string') { try { o = JSON.parse(quelle); } catch (e) { throw fehler('Messliste nicht lesbar (kein gültiges JSON): ' + e.message); } }
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.format !== 'haus-aufmass') throw fehler('Das ist keine Messliste (Format "haus-aufmass" erwartet)');
    if (o.version !== 1) throw fehler('Version der Messliste nicht unterstützt: ' + o.version + ' (erwartet 1)');
    var extra = Object.keys(o).filter(function (k) { return ['format', 'version', 'eintraege'].indexOf(k) < 0; });
    if (extra.length) throw fehler('Unbekannte Felder in der Messliste: ' + extra.join(', '));
    if (!Array.isArray(o.eintraege) || !o.eintraege.length) throw fehler('Die Messliste enthält keine Messung');
    return o.eintraege.map(function (e, i) {
      try { eintragPruefen(e, D); } catch (x) { throw fehler('Messung ' + (i + 1) + ': ' + x.message); }
      var k = klon(e);
      if (!k.was) k.was = beschreibung(D, k.mass);
      return k;
    });
  }

  /* ---------- Text von pruefmasse.json fortschreiben ---------- */
  function zeileVon(e) {
    var teile = ['mass', 'cm', 'was', 'datum', 'notiz'].filter(function (k) { return k in e; }).map(function (k) { return JSON.stringify(k) + ': ' + JSON.stringify(e[k]); });
    return '{ ' + teile.join(', ') + ' }';
  }
  function eintragen(text, messungen) {
    if (!Array.isArray(messungen) || !messungen.length) throw fehler('Keine Messung einzutragen');
    messungen.forEach(function (e) { eintragPruefen(e); });
    var lines = text.split('\n'), start = -1, ende = -1, i, erwartet;
    for (i = 0; i < lines.length; i++) if (/^\s*"masse"\s*:\s*\[\s*$/.test(lines[i])) { start = i; break; }
    if (start < 0) throw fehler('Format von pruefmasse.json nicht erwartet: die Zeile `"masse": [` fehlt');
    for (i = start + 1; i < lines.length; i++) if (/^\s*\]/.test(lines[i])) { ende = i; break; }
    if (ende < 0) throw fehler('Format von pruefmasse.json nicht erwartet: das Ende der Liste "masse" fehlt');
    var einzug = (/^(\s*)/.exec(lines[start + 1] || '') || ['', '    '])[1] || '    ';
    var koerper = lines.slice(start + 1, ende), eintraege = koerper.map(function (l) {
      var s = l.replace(/,\s*$/, '');
      try { return { zeile: s, obj: JSON.parse(s) }; } catch (x) { throw fehler('Format von pruefmasse.json nicht erwartet: ein Eintrag steht nicht auf einer Zeile: ' + l.trim().slice(0, 60)); }
    });
    var ersetzt = [], neu = [];
    messungen.forEach(function (e) {
      var k = {}; FELDER.forEach(function (f) { if (f in e) k[f] = e[f]; });
      var idx = -1, j;
      for (j = 0; j < eintraege.length; j++) if (eintraege[j].obj.mass === k.mass) idx = j;
      if (idx >= 0) { ersetzt.push(eintraege[idx].obj); eintraege[idx] = { zeile: einzug + zeileVon(k), obj: k }; }
      else { neu.push(k); eintraege.push({ zeile: einzug + zeileVon(k), obj: k }); }
    });
    var ergebnis = lines.slice(0, start + 1).concat(eintraege.map(function (e, j) { return e.zeile + (j < eintraege.length - 1 ? ',' : ''); }), lines.slice(ende)).join('\n');
    erwartet = eintraege.map(function (e) { return e.obj; });
    var gelesen;
    try { gelesen = JSON.parse(ergebnis); } catch (x) { throw fehler('Interner Fehler: pruefmasse.json wäre danach kein gültiges JSON (' + x.message + ')'); }
    if (JSON.stringify(gelesen.masse) !== JSON.stringify(erwartet)) throw fehler('Interner Fehler: pruefmasse.json hätte danach nicht den berechneten Inhalt');
    return { text: ergebnis, neu: neu, ersetzt: ersetzt };
  }

  /* ---------- Bericht ---------- */
  function bericht(res, pm) {
    var p = (pm && pm.putz_cm) || [-1, 4], k = pm && pm.kante_cm != null ? pm.kante_cm : 2;
    var kopf = 'Prüfmaße: Aufmaß (fertig) ↔ Modell (Rohbau) in cm, erwartet Modell − Aufmaß = ' + p[0] + ' … +' + p[1] + ' (Putz) bei lichten Raummaßen, ±' + k + ' bei Wandlängen; ! = auffällig, ? = Maß nicht gefunden';
    return [kopf].concat(res.zeilen.map(function (z) {
      var mk = z.status === 'auffaellig' ? '!' : z.status === 'unbekannt' ? '?' : ' ';
      return '  ' + mk + ' ' + z.was.padEnd(42) + de(z.gemessen / 10, 1).padStart(7) + (z.modell == null ? '' : de(z.modell / 10, 1).padStart(8) + '  ' + (z.abweichung >= 0 ? '+' : '') + de(z.abweichung / 10, 1)) + (z.datum ? '  ' + z.datum : '');
    })).join('\n');
  }

  return { auswerten: auswerten, beschreibung: beschreibung, cmParsen: cmParsen, listeErzeugen: listeErzeugen, listeLesen: listeLesen, eintragen: eintragen, eintragPruefen: eintragPruefen, bericht: bericht };
})();
if (typeof module !== 'undefined') module.exports = Aufmass;
