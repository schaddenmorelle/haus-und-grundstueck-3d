/* Ändern: wendet Änderungen auf die Hausdaten (src/data/haus.json) an, ohne Three.js, in Node und in der Seite (Probiermodus) lauffähig.
   Plan docs/plan-parametrisches-modell.md, Abschnitt 5.2 und 9 (Phase 4). Alle Maße in Millimetern.

     Aendern.aendern(haus, aenderungen, optionen)   → { ok, haus, kanten, schritte, meldungen, auswirkungen, befunde, vorschauHaus }
     Aendern.einheitParsen(wert)                    "1,30m", "12,5cm", "885mm" oder eine Zahl (mm) → mm; Text ohne Einheit wirft
     Aendern.stand(haus)                            Prüfsumme der Daten (für die Änderungsliste)
     Aendern.listeErzeugen(haus, aenderungen)       Export: { format, version, stand, aenderungen }
     Aendern.listeLesen(text oder Objekt, haus)     prüft eine Änderungsliste und gibt die Änderungen zurück (wirft bei Fehlern)
     Aendern.textPatchen(text, kanten)              ersetzt nur die geänderten Stellen im Text von haus.json
     Aendern.auswirkungenText(ergebnis)             die Ausgabe für Befehlszeile und Seite
     Aendern.vergleichSvg(ergebnis, geschoss)       neuer Plan mit gestricheltem alten Wandumriss

   Eine Änderung ist genau eine von
     { mass: "raum:speis.tiefe", wert, bewegt?, einzeln? }   ein benanntes Maß aus dem Grundriss (siehe src/grundriss.js)
     { achse: "z.speisS", wert }                             Achse mit eigenem Wert (absolute Lage)
     { wandtyp: "IW125", wert }                              Dicke eines Wandtyps
     { wandende: "eg.dbad-west.bis", wert }                  Ende einer achsparallelen Wand (Achse oder Zahl)
     { oeffnung: "eg.har-sued.oeff1", feld, wert }           ab, breite, hoehe oder bruestung einer Öffnung
   Ein Maß hängt an mehreren Parametern (Achsen, Wandtypen). „Nachbar gibt nach“: Der Kern probiert jeden aus und wählt den mit der kleinsten
   Auswirkung (zuerst weniger neue Fehler, dann weniger veränderte Räume, dann weniger verschobene Wände); bei Gleichstand das hintere Ende
   (Ost bzw. Süd). `bewegt` gibt den Parameter vor. Gesperrte Parameter (fest: true) bewegt nur optionen.aussenmass. Entstehen neue Fehler,
   bricht alles ab (haus: null), außer mit optionen.trotzdem. */
if (typeof require !== 'undefined') { var werteAufloesen = require('./werte.js').werteAufloesen, raeumeAbleiten = require('./raeume.js').raeumeAbleiten, dachAbleiten = require('./dach.js').dachAbleiten, pruefen = require('./pruefen.js').pruefen, grundrissAbleiten = require('./grundriss.js').grundrissAbleiten, grundrissSvg = require('./grundriss.js').grundrissSvg; }

var Aendern = (function () {
  var TOL = 1e-6, GESCHOSSE = ['EG', 'DG'];
  var ARTEN = { mass: ['mass', 'wert', 'bewegt', 'einzeln'], achse: ['achse', 'wert'], wandtyp: ['wandtyp', 'wert'], wandende: ['wandende', 'wert'], oeffnung: ['oeffnung', 'feld', 'wert'] };
  var OEFFNUNGSFELDER = ['ab', 'breite', 'hoehe', 'bruestung'];

  function fehler(text) { var e = new Error(text); e.aendern = true; return e; }
  function klon(o) { return JSON.parse(JSON.stringify(o)); }
  function de(v, d) { var s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); if (d && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s.replace('.', ','); }
  function mmText(v) { return de(v, 3) + ' mm'; }

  /* ---------- Werte mit Einheit ---------- */
  function einheitParsen(w) {
    if (typeof w === 'number') { if (!isFinite(w)) throw fehler('Wert nicht lesbar: ' + w); return w; }
    if (typeof w !== 'string') throw fehler('Wert nicht lesbar: ' + JSON.stringify(w));
    var m = /^\s*(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)\s*$/i.exec(w);
    if (!m) {
      if (/^\s*-?\d+(?:[.,]\d+)?\s*$/.test(w)) throw fehler('Einheit fehlt bei "' + w.trim() + '": mm, cm oder m angeben (z. B. 1,30m), damit "12,5" nicht als Meter gelesen wird');
      throw fehler('Wert nicht lesbar: "' + w + '" (erwartet z. B. 1,30m, 12,5cm oder 885mm)');
    }
    var f = { mm: 1, cm: 10, m: 1000 }[m[2].toLowerCase()];
    return Math.round(parseFloat(m[1].replace(',', '.')) * f * 1e6) / 1e6;
  }

  /* ---------- Prüfsumme (cyrb53) über die Daten mit sortierten Schlüsseln ---------- */
  function kanonisch(v) {
    if (Array.isArray(v)) return '[' + v.map(kanonisch).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + kanonisch(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function stand(haus) {
    var s = kanonisch(haus), h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ('00000000' + (h2 >>> 0).toString(16)).slice(-8) + ('00000000' + (h1 >>> 0).toString(16)).slice(-8);
  }

  /* ---------- Aufbau einer Änderung prüfen ---------- */
  function achseDef(haus, name) {
    if (haus.aussenmasse && haus.aussenmasse[name]) return { gruppe: 'aussenmasse', def: haus.aussenmasse[name] };
    if (haus.achsen && haus.achsen[name]) return { gruppe: 'achsen', def: haus.achsen[name] };
    return null;
  }
  function artVon(ae) {
    if (!ae || typeof ae !== 'object' || Array.isArray(ae)) throw fehler('Eine Änderung muss ein Objekt sein');
    var arten = Object.keys(ARTEN).filter(function (a) { return a in ae; });
    if (arten.length === 0) throw fehler('Art der Änderung fehlt: genau eines von ' + Object.keys(ARTEN).join(', ') + ' angeben');
    if (arten.length > 1) throw fehler('Eine Änderung hat genau eine Art, nicht ' + arten.join(' und '));
    return arten[0];
  }
  function aenderungPruefen(ae, haus) {
    var art = artVon(ae);
    Object.keys(ae).forEach(function (k) { if (ARTEN[art].indexOf(k) < 0) throw fehler('Unbekanntes Feld "' + k + '" in der Änderung ' + art + ' (erlaubt: ' + ARTEN[art].join(', ') + ')'); });
    if (typeof ae[art] !== 'string' || !ae[art]) throw fehler('Bei der Änderung ' + art + ' fehlt der Name');
    if (!('wert' in ae)) throw fehler('Bei der Änderung ' + art + ' ' + ae[art] + ' fehlt der Wert (wert)');
    if (art === 'oeffnung' && OEFFNUNGSFELDER.indexOf(ae.feld) < 0) throw fehler('Unbekanntes Feld "' + ae.feld + '" der Öffnung (erlaubt: ' + OEFFNUNGSFELDER.join(', ') + ')');
    if (art === 'mass' && 'bewegt' in ae && typeof ae.bewegt !== 'string') throw fehler('bewegt muss der Name einer Achse, eines Wandtyps oder einer Wand sein');
    if ('einzeln' in ae && typeof ae.einzeln !== 'boolean') throw fehler('einzeln muss wahr oder falsch sein');
    var achsName = typeof ae.wert === 'string' && haus && achseDef(haus, ae.wert);
    if (!((art === 'wandende' || (art === 'oeffnung' && ae.feld === 'ab')) && achsName)) einheitParsen(ae.wert);
    return art;
  }
  function kurzText(ae) {
    var art;
    try { art = artVon(ae); } catch (e) { return JSON.stringify(ae); }
    return art + ' ' + ae[art] + (art === 'oeffnung' ? '.' + ae.feld : '') + ' = ' + (typeof ae.wert === 'number' ? mmText(ae.wert) : ae.wert);
  }

  /* ---------- Änderungsliste (Export der Seite) ---------- */
  function listeErzeugen(haus, aenderungen) {
    if (!Array.isArray(aenderungen) || !aenderungen.length) throw fehler('Keine Änderungen zum Exportieren');
    aenderungen.forEach(function (ae) { aenderungPruefen(ae, haus); });
    return { format: 'haus-aenderungen', version: 1, stand: stand(haus), aenderungen: klon(aenderungen) };
  }
  function listeLesen(quelle, haus, optionen) {
    var o = quelle, opt = optionen || {};
    if (typeof quelle === 'string') { try { o = JSON.parse(quelle); } catch (e) { throw fehler('Änderungsliste nicht lesbar (kein gültiges JSON): ' + e.message); } }
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.format !== 'haus-aenderungen') throw fehler('Das ist keine Änderungsliste (Format "haus-aenderungen" erwartet)');
    if (o.version !== 1) throw fehler('Version der Änderungsliste nicht unterstützt: ' + o.version + ' (erwartet 1)');
    if (!opt.standIgnorieren && o.stand !== stand(haus)) throw fehler('Stand von haus.json passt nicht zur Änderungsliste (Liste: ' + o.stand + ', Daten: ' + stand(haus) + '): die Daten haben sich seit dem Export geändert; die Liste neu erzeugen');
    if (!Array.isArray(o.aenderungen)) throw fehler('Die Liste "aenderungen" fehlt');
    if (!o.aenderungen.length) throw fehler('Die Änderungsliste enthält keine Änderungen');
    var extra = Object.keys(o).filter(function (k) { return ['format', 'version', 'stand', 'aenderungen'].indexOf(k) < 0; });
    if (extra.length) throw fehler('Unbekannte Felder in der Änderungsliste: ' + extra.join(', '));
    o.aenderungen.forEach(function (ae, i) { try { aenderungPruefen(ae, haus); } catch (e) { throw fehler('Änderung ' + (i + 1) + ': ' + e.message); } });
    return klon(o.aenderungen);
  }

  /* ---------- Ableitung ---------- */
  function ableiten(haus) {
    var WV = werteAufloesen(haus), abl = raeumeAbleiten(haus, WV), dach = dachAbleiten(haus, WV), befunde = pruefen(haus, WV, abl, dach), plaene = {};
    return {
      haus: haus, WV: WV, abl: abl, dach: dach, befunde: befunde,
      plan: function (g) { if (!plaene[g]) plaene[g] = grundrissAbleiten(haus, WV, abl, dach, befunde, g); return plaene[g]; },
      geschosse: Object.keys(abl.geschosse)
    };
  }
  function massSuchen(D, name) {
    var treffer = null;
    D.geschosse.forEach(function (g) {
      if (treffer) return;
      D.plan(g).ketten.forEach(function (k) { k.segmente.forEach(function (s) { if (!treffer && s.name === name) treffer = { seg: s, kette: k, geschoss: g }; }); });
    });
    return treffer;
  }
  function wandIndex(haus, id) { for (var i = 0; i < haus.waende.length; i++) if (haus.waende[i].id === id) return i; return -1; }

  /* ---------- Änderungen am Arbeitsstand, mit Protokoll der geänderten Stellen ---------- */
  function lesen(obj, pfad) { return pfad.reduce(function (v, k) { return v == null ? v : v[k]; }, obj); }
  function setzen(S, pfad, wert) {
    var eltern = lesen(S.haus, pfad.slice(0, -1)), key = pfad[pfad.length - 1], k = JSON.stringify(pfad);
    if (eltern == null || typeof eltern !== 'object') throw fehler('Stelle in den Daten nicht gefunden: ' + pfad.join('.'));
    if (!S.edits[k]) { S.edits[k] = { pfad: pfad, alt: eltern[key], vorhanden: key in eltern }; S.reihenfolge.push(k); }
    eltern[key] = wert;
  }
  function kantenAus(S) {
    return S.reihenfolge.map(function (k) { return S.edits[k]; }).filter(function (e) {
      var jetzt = lesen(S.haus, e.pfad);
      return !e.vorhanden || JSON.stringify(jetzt) !== JSON.stringify(e.alt);
    }).map(function (e) { return { pfad: e.pfad, wert: lesen(S.haus, e.pfad) }; });
  }

  /* ---------- Parameter hinter einem Maß ---------- */
  function stellgroesse(haus, p) { // → { pfad, name, bezeichnung, fest, wert } | { ausgeschlossen } | null (nicht änderbar)
    var d, i;
    if (p.art === 'wurzel') {
      d = achseDef(haus, p.name);
      if (!d || typeof d.def.wert !== 'number') return null;
      return { pfad: [d.gruppe, p.name, 'wert'], name: p.name, bezeichnung: 'Achse ' + p.name, fest: !!d.def.fest, wert: d.def.wert };
    }
    if (p.art === 'achse+' || p.art === 'achse-') {
      var feld = p.art === 'achse+' ? 'plus' : 'minus';
      d = achseDef(haus, p.name);
      if (!d || typeof d.def[feld] !== 'number') return null;
      return { pfad: [d.gruppe, p.name, feld], name: p.name, bezeichnung: 'Achse ' + p.name + ' (' + feld + ')', fest: !!d.def.fest, wert: d.def[feld] };
    }
    if (p.art === 'typ') {
      var t = haus.wandtypen && haus.wandtypen[p.name];
      if (!t) return null;
      if (t.schichten) return { ausgeschlossen: 'schichten', text: 'Wandtyp ' + p.name + ' hat Schichten (' + t.schichten.map(function (s) { return s[0] + ' ' + s[1]; }).join(', ') + '); die Gesamtdicke lässt sich nicht einzeln ändern' };
      return { pfad: ['wandtypen', p.name, 'dicke'], name: p.name, bezeichnung: 'Wandtyp ' + p.name, fest: false, wert: t.dicke, typ: true };
    }
    if (p.art === 'wanddicke') {
      i = wandIndex(haus, p.name);
      if (i < 0) return null;
      return { pfad: ['waende', i, 'dicke'], name: p.name, bezeichnung: 'Dicke der Wand ' + p.name, fest: false, wert: haus.waende[i].dicke };
    }
    return null;
  }
  function anwendenKandidat(haus2, sg, delta, k) { // Kopie des Hauses mit dem Parameter um delta / k verschoben
    var h = klon(haus2), eltern = lesen(h, sg.pfad.slice(0, -1)), key = sg.pfad[sg.pfad.length - 1];
    eltern[key] = Math.round((sg.wert + delta / k) * 1e6) / 1e6;
    return h;
  }
  function befundSchluessel(b) { return b.regel + '|' + b.stufe + '|' + (b.elemente || []).slice().sort().join(',') + '|' + String(b.text).replace(/[\d.,]+/g, '#'); }
  function befundeVergleichen(D0, D1) {
    var alt = {}, neu = {};
    D0.befunde.forEach(function (b) { alt[befundSchluessel(b)] = 1; });
    D1.befunde.forEach(function (b) { neu[befundSchluessel(b)] = 1; });
    return {
      neu: D1.befunde.filter(function (b) { return !alt[befundSchluessel(b)]; }),
      behoben: D0.befunde.filter(function (b) { return !neu[befundSchluessel(b)]; }),
      alle: D1.befunde
    };
  }
  function raeumeGeaendert(D0, D1) {
    var n = 0, alt = {};
    D0.abl.raeume.forEach(function (r) { alt[r.id] = r.flaeche; });
    D1.abl.raeume.forEach(function (r) { if (alt[r.id] == null || Math.abs(alt[r.id] - r.flaeche) > 1) n++; });
    return n;
  }
  function waendeVerschoben(D0, D1) {
    var n = 0, alt = {};
    D0.geschosse.forEach(function (g) { D0.abl.geschosse[g].waende.forEach(function (w) { alt[g + ':' + w.id] = w.linie; }); });
    D1.geschosse.forEach(function (g) {
      D1.abl.geschosse[g].waende.forEach(function (w) {
        var a = alt[g + ':' + w.id], b = w.linie;
        if (!a || [a.a[0] - b.a[0], a.a[1] - b.a[1], a.b[0] - b.b[0], a.b[1] - b.b[1], a.t - b.t].some(function (d) { return Math.abs(d) > TOL; })) n++;
      });
    });
    return n;
  }
  function betroffeneWaende(haus, sg) {
    if (sg.typ) return haus.waende.filter(function (w) { return w.typ === sg.name && w.dicke == null; }).length;
    return 1;
  }

  /* ---------- die einzelnen Änderungsarten ---------- */
  function parameterSetzen(S, sg, neuerWert) { setzen(S, sg.pfad, Math.round(neuerWert * 1e6) / 1e6); }

  function massAendern(S, ae, opt) {
    var name = ae.mass, ziel = einheitParsen(ae.wert), D = S.D, m, mo = /^(.*)\.oeff(\d+)$/.exec(name);
    if (mo && wandIndex(S.haus, mo[1]) >= 0) return oeffnungAendern(S, { oeffnung: name, feld: 'breite', wert: ziel }, opt, name);
    m = massSuchen(D, name);
    if (!m) throw fehler('Maß unbekannt: ' + name + ' (Namen stehen im Grundriss beim Anklicken eines Maßes)');
    var seg = m.seg, vorher = seg.laenge, delta = ziel - vorher;
    if (Math.abs(delta) < TOL) return { art: 'mass', ziel: name, von: vorher, nach: ziel, unveraendert: true, parameter: null, text: 'Maß ' + name + ' ist bereits ' + mmText(vorher) + ' – unverändert' };
    if (ae.einzeln && seg.art !== 'wand') throw fehler('einzeln gilt nur für Wanddicken (wand:<id>)');
    if (seg.schraeg) throw fehler('Das Maß ' + name + ' ist schräg gemessen und lässt sich nicht ändern; die Schrägwand über ihre Achsen ändern');
    if (seg.art === 'pfeiler') return pfeilerAendern(S, ae, seg, delta, opt);
    if (seg.art === 'oeffnung') return oeffnungAendern(S, { oeffnung: seg.name, feld: 'breite', wert: ziel }, opt, name);
    if (!seg.parameter) throw fehler('Das Maß ' + name + ' fasst mehrere Wände zusammen und hängt an keinem einzelnen Parameter');

    /* Wanddicke einzeln: nur diese Wand bekommt eine eigene Dicke */
    if (ae.einzeln) {
      var wi = wandIndex(S.haus, seg.ids[0]);
      if (wi < 0) throw fehler('Wand unbekannt: ' + seg.ids[0]);
      var sgw = { pfad: ['waende', wi, 'dicke'], name: seg.ids[0], bezeichnung: 'Dicke der Wand ' + seg.ids[0], wert: vorher };
      parameterSetzen(S, sgw, ziel);
      return { art: 'mass', ziel: name, von: vorher, nach: ziel, parameter: { art: 'wanddicke', name: sgw.name, bezeichnung: sgw.bezeichnung, von: vorher, nach: ziel }, betroffeneWaende: 1,
               text: name + ': ' + mmText(vorher) + ' → ' + mmText(ziel) + ' (nur diese Wand, ' + sgw.bezeichnung + ')' };
    }

    /* Kandidaten sammeln */
    var kand = [], ausgeschlossen = [];
    seg.parameter.forEach(function (p) {
      if (Math.abs(p.k) < 1e-9) return;
      var sg = stellgroesse(S.haus, p);
      if (!sg) return;
      if (sg.ausgeschlossen) { ausgeschlossen.push(sg); return; }
      sg.k = p.k;
      if (sg.fest && !opt.aussenmass) { ausgeschlossen.push({ ausgeschlossen: 'gesperrt', text: sg.bezeichnung + ' ist gesperrt' }); return; }
      kand.push(sg);
    });
    if (ae.bewegt) {
      var gewuenscht = kand.filter(function (c) { return c.name === ae.bewegt; });
      if (!gewuenscht.length) {
        var gesperrtBewegt = ausgeschlossen.some(function (a) { return a.ausgeschlossen === 'gesperrt' && a.text.indexOf(ae.bewegt) >= 0; });
        throw fehler(gesperrtBewegt ? 'bewegt ' + ae.bewegt + ': Parameter ist gesperrt (Außenmaß); nur mit aussenmass (--aussenmass)'
          : 'bewegt ' + ae.bewegt + ' gehört nicht zum Maß ' + name + '; mögliche Parameter: ' + (kand.map(function (c) { return c.name; }).join(', ') || 'keine'));
      }
      kand = gewuenscht;
    }
    if (!kand.length) {
      if (ausgeschlossen.some(function (a) { return a.ausgeschlossen === 'gesperrt'; })) throw fehler('Das Maß ' + name + ' ist gesperrt (Außenmaß) und lässt sich nur mit aussenmass ändern (Befehlszeile --aussenmass)');
      if (ausgeschlossen.length) throw fehler('Das Maß ' + name + ' lässt sich nicht ändern: ' + ausgeschlossen[0].text);
      throw fehler('Das Maß ' + name + ' hängt an keinem änderbaren Parameter (Zahl direkt an einer Wand; über wandende oder oeffnung ändern)');
    }

    /* Gesperrte Außenmaße wachsen nach Osten bzw. Süden: der Ursprung (Westkante, Nordkante) bleibt liegen */
    if (kand.every(function (c) { return c.fest; })) { var hinten = kand.filter(function (c) { return c.k > 0; }); if (hinten.length) kand = hinten; }

    /* bewerten: jeden Kandidaten anwenden, neu ableiten, Auswirkung zählen */
    var bewertet = kand.map(function (c) {
      var h2 = anwendenKandidat(S.haus, c, delta, c.k), D1;
      try { D1 = ableiten(h2); } catch (e) { return { c: c, ungueltig: true }; }
      var m1 = massSuchen(D1, name), erreicht = !!m1 && Math.abs(m1.seg.laenge - ziel) < 1e-3;
      var fehlerNeu = befundeVergleichen(D, D1).neu.filter(function (b) { return b.stufe === 'fehler'; }).length;
      return { c: c, ungueltig: !erreicht, wertung: [fehlerNeu, raeumeGeaendert(D, D1), waendeVerschoben(D, D1), c.fest ? 1 : 0, -c.k, c.name] };
    }).filter(function (b) { return !b.ungueltig; });
    if (!bewertet.length) throw fehler('Das Maß ' + name + ' lässt sich mit keinem Parameter auf ' + mmText(ziel) + ' bringen');
    bewertet.sort(function (a, b) {
      for (var i = 0; i < a.wertung.length; i++) { if (a.wertung[i] < b.wertung[i]) return -1; if (a.wertung[i] > b.wertung[i]) return 1; }
      return 0;
    });
    var gewaehlt = bewertet[0].c, alternativen = bewertet.slice(1).map(function (b) { return b.c.bezeichnung; });
    var neuerWert = gewaehlt.wert + delta / gewaehlt.k;
    parameterSetzen(S, gewaehlt, neuerWert);
    return {
      art: 'mass', ziel: name, von: vorher, nach: ziel,
      parameter: { art: gewaehlt.pfad[2] === 'wert' ? 'achse' : gewaehlt.typ ? 'wandtyp' : 'achse', name: gewaehlt.name, bezeichnung: gewaehlt.bezeichnung, pfad: gewaehlt.pfad, von: gewaehlt.wert, nach: Math.round(neuerWert * 1e6) / 1e6 },
      betroffeneWaende: betroffeneWaende(S.haus, gewaehlt), alternativen: alternativen,
      text: name + ': ' + mmText(vorher) + ' → ' + mmText(ziel) + ' (bewegt: ' + gewaehlt.bezeichnung + ' ' + mmText(gewaehlt.wert) + ' → ' + mmText(neuerWert) + ')' +
            (gewaehlt.typ ? ', gilt für ' + betroffeneWaende(S.haus, gewaehlt) + ' Wände dieses Typs' : '')
    };
  }

  function oeffnungAendern(S, ae, opt, urname) {
    var mo = /^(.*)\.oeff(\d+)$/.exec(ae.oeffnung);
    if (!mo) throw fehler('Öffnung unbekannt: ' + ae.oeffnung + ' (erwartet <wand>.oeff<k>)');
    var wi = wandIndex(S.haus, mo[1]), k = parseInt(mo[2], 10) - 1;
    if (wi < 0) throw fehler('Öffnung unbekannt: ' + ae.oeffnung + ' (Wand ' + mo[1] + ' gibt es nicht)');
    var o = (S.haus.waende[wi].oeffnungen || [])[k];
    if (!o) throw fehler('Öffnung unbekannt: ' + ae.oeffnung + ' (die Wand ' + mo[1] + ' hat ' + (S.haus.waende[wi].oeffnungen || []).length + ' Öffnungen)');
    var feld = ae.feld, achsName = typeof ae.wert === 'string' && achseDef(S.haus, ae.wert), ziel;
    if (feld === 'ab' && achsName) ziel = ae.wert; else ziel = einheitParsen(ae.wert);
    var vorher = o[feld];
    if (JSON.stringify(vorher) === JSON.stringify(ziel)) return { art: 'oeffnung', ziel: ae.oeffnung + '.' + feld, von: vorher, nach: ziel, unveraendert: true, parameter: null, text: 'Öffnung ' + ae.oeffnung + ' (' + feld + ') ist bereits ' + (typeof vorher === 'number' ? mmText(vorher) : vorher) + ' – unverändert' };
    setzen(S, ['waende', wi, 'oeffnungen', k, feld], ziel);
    return { art: 'oeffnung', ziel: urname || ae.oeffnung + '.' + feld, von: vorher, nach: ziel, parameter: { art: 'oeffnung', name: ae.oeffnung, bezeichnung: 'Öffnung ' + ae.oeffnung + ' (' + feld + ')', von: vorher, nach: ziel },
             text: 'Öffnung ' + ae.oeffnung + ', ' + feld + ': ' + (typeof vorher === 'number' ? mmText(vorher) : vorher) + ' → ' + (typeof ziel === 'number' ? mmText(ziel) : ziel) };
  }

  function pfeilerAendern(S, ae, seg, delta, opt) { // der angrenzende Öffnungsblock rückt, der Pfeiler auf der anderen Seite gibt nach
    var wid = seg.ids[0], wi = wandIndex(S.haus, wid), w = S.haus.waende[wi], WV = S.D.WV;
    var a = [WV.mm(w.von[0]), WV.mm(w.von[1])], b = [WV.mm(w.bis[0]), WV.mm(w.bis[1])];
    var along = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1, dir = b[along] >= a[along] ? 1 : -1;
    var info = seg.oeffnungen || {}, k, verschiebung;
    if (info.naechste != null) { k = info.naechste; verschiebung = delta; } else if (info.vorige != null) { k = info.vorige; verschiebung = -delta; } else throw fehler('Der Pfeiler ' + seg.name + ' grenzt an keine Öffnung');
    var o = w.oeffnungen[k], vorher = o.ab;
    if (typeof o.ab === 'number') {
      setzen(S, ['waende', wi, 'oeffnungen', k, 'ab'], Math.round((o.ab + dir * verschiebung) * 1e6) / 1e6);
      return { art: 'pfeiler', ziel: seg.name, von: seg.laenge, nach: seg.laenge + delta, parameter: { art: 'oeffnung', name: wid + '.oeff' + (k + 1), bezeichnung: 'Lage der Öffnung ' + wid + '.oeff' + (k + 1) + ' (ab)', von: vorher, nach: o.ab + dir * verschiebung },
               text: seg.name + ': ' + mmText(seg.laenge) + ' → ' + mmText(seg.laenge + delta) + ' (Öffnung ' + wid + '.oeff' + (k + 1) + ' rückt um ' + mmText(Math.abs(verschiebung)) + ')' };
    }
    var sg = stellgroesse(S.haus, { art: 'wurzel', name: o.ab });
    if (!sg) throw fehler('Die Lage der Öffnung hängt an der abgeleiteten Achse ' + o.ab + '; die Achse oder ein anderes Maß ändern');
    if (sg.fest && !opt.aussenmass) throw fehler('Die Achse ' + o.ab + ' ist gesperrt (aussenmass)');
    parameterSetzen(S, sg, sg.wert + verschiebung);
    return { art: 'pfeiler', ziel: seg.name, von: seg.laenge, nach: seg.laenge + delta, parameter: { art: 'achse', name: sg.name, bezeichnung: sg.bezeichnung, von: sg.wert, nach: sg.wert + verschiebung },
             text: seg.name + ': ' + mmText(seg.laenge) + ' → ' + mmText(seg.laenge + delta) + ' (' + sg.bezeichnung + ' ' + mmText(sg.wert) + ' → ' + mmText(sg.wert + verschiebung) + ')' };
  }

  function achseAendern(S, ae, opt) {
    var d = achseDef(S.haus, ae.achse);
    if (!d) throw fehler('Achse unbekannt: ' + ae.achse);
    if (typeof d.def.wert !== 'number') throw fehler('Die Achse ' + ae.achse + ' ist abgeleitet (ref ' + d.def.ref + '); ein Maß ändern, an dem sie hängt, oder die Achse ' + d.def.ref + ' ändern');
    if (d.def.fest && !opt.aussenmass) throw fehler('Die Achse ' + ae.achse + ' ist gesperrt (Außenmaß) und lässt sich nur mit aussenmass ändern (Befehlszeile --aussenmass)');
    var ziel = einheitParsen(ae.wert), vorher = d.def.wert;
    if (Math.abs(ziel - vorher) < TOL) return { art: 'achse', ziel: ae.achse, von: vorher, nach: ziel, unveraendert: true, parameter: null, text: 'Achse ' + ae.achse + ' liegt bereits bei ' + mmText(vorher) + ' – unverändert' };
    setzen(S, [d.gruppe, ae.achse, 'wert'], ziel);
    return { art: 'achse', ziel: ae.achse, von: vorher, nach: ziel, parameter: { art: 'achse', name: ae.achse, bezeichnung: 'Achse ' + ae.achse, von: vorher, nach: ziel }, text: 'Achse ' + ae.achse + ': ' + mmText(vorher) + ' → ' + mmText(ziel) };
  }

  function wandtypAendern(S, ae) {
    var t = S.haus.wandtypen && S.haus.wandtypen[ae.wandtyp];
    if (!t) throw fehler('Wandtyp unbekannt: ' + ae.wandtyp);
    if (t.schichten) throw fehler('Wandtyp ' + ae.wandtyp + ' hat Schichten; die Gesamtdicke lässt sich nicht einzeln ändern');
    var ziel = einheitParsen(ae.wert), vorher = t.dicke;
    if (ziel <= 0) throw fehler('Die Dicke muss größer als 0 sein');
    if (Math.abs(ziel - vorher) < TOL) return { art: 'wandtyp', ziel: ae.wandtyp, von: vorher, nach: ziel, unveraendert: true, parameter: null, text: 'Wandtyp ' + ae.wandtyp + ' ist bereits ' + mmText(vorher) + ' dick – unverändert' };
    setzen(S, ['wandtypen', ae.wandtyp, 'dicke'], ziel);
    var n = S.haus.waende.filter(function (w) { return w.typ === ae.wandtyp && w.dicke == null; }).length;
    return { art: 'wandtyp', ziel: ae.wandtyp, von: vorher, nach: ziel, betroffeneWaende: n, parameter: { art: 'wandtyp', name: ae.wandtyp, bezeichnung: 'Wandtyp ' + ae.wandtyp, von: vorher, nach: ziel },
             text: 'Wandtyp ' + ae.wandtyp + ': ' + mmText(vorher) + ' → ' + mmText(ziel) + ', gilt für ' + n + ' Wände' };
  }

  function wandendeAendern(S, ae) {
    var mo = /^(.*)\.(von|bis)$/.exec(ae.wandende);
    if (!mo) throw fehler('Wandende muss "<wand>.von" oder "<wand>.bis" heißen, nicht "' + ae.wandende + '"');
    var wi = wandIndex(S.haus, mo[1]);
    if (wi < 0) throw fehler('Wand unbekannt: ' + mo[1]);
    var w = S.haus.waende[wi], WV = S.D.WV, a = [WV.mm(w.von[0]), WV.mm(w.von[1])], b = [WV.mm(w.bis[0]), WV.mm(w.bis[1])];
    var senkrecht = Math.abs(a[0] - b[0]) < TOL, waagerecht = Math.abs(a[1] - b[1]) < TOL;
    if (!senkrecht && !waagerecht) throw fehler('Die Wand ' + w.id + ' ist schräg (nicht achsparallel); ihr Ende lässt sich nicht verschieben');
    var i = senkrecht ? 1 : 0, praefix = i === 0 ? 'x.' : 'z.', ziel;
    if (typeof ae.wert === 'string' && achseDef(S.haus, ae.wert)) {
      if (ae.wert.indexOf(praefix) !== 0) throw fehler('Die Wand ' + w.id + ' verläuft ' + (senkrecht ? 'senkrecht' : 'waagerecht') + '; ihr Ende liegt auf einer Achse "' + praefix + '…", nicht auf ' + ae.wert);
      ziel = ae.wert;
    } else ziel = einheitParsen(ae.wert);
    var vorher = w[mo[2]][i];
    if (JSON.stringify(vorher) === JSON.stringify(ziel)) return { art: 'wandende', ziel: ae.wandende, von: vorher, nach: ziel, unveraendert: true, parameter: null, text: 'Wandende ' + ae.wandende + ' liegt bereits dort – unverändert' };
    setzen(S, ['waende', wi, mo[2], i], ziel);
    var wt = function (v) { return typeof v === 'number' ? mmText(v) : v + ' (' + mmText(WV.mm(v)) + ')'; };
    return { art: 'wandende', ziel: ae.wandende, von: vorher, nach: ziel, parameter: { art: 'wandende', name: ae.wandende, bezeichnung: 'Ende ' + ae.wandende, von: vorher, nach: ziel }, text: 'Wandende ' + ae.wandende + ': ' + wt(vorher) + ' → ' + wt(ziel) };
  }

  function schrittAnwenden(S, ae, opt) {
    var art = aenderungPruefen(ae, S.haus);
    if (art === 'mass') return massAendern(S, ae, opt);
    if (art === 'achse') return achseAendern(S, ae, opt);
    if (art === 'wandtyp') return wandtypAendern(S, ae);
    if (art === 'wandende') return wandendeAendern(S, ae);
    return oeffnungAendern(S, ae, opt);
  }

  /* ---------- gesperrte Werte ---------- */
  function festeVerletzt(alt, neu) {
    var out = [];
    ['aussenmasse', 'achsen'].forEach(function (g) {
      Object.keys(alt[g] || {}).forEach(function (n) {
        var a = alt[g][n], b = neu[g] && neu[g][n];
        if (a.fest && (!b || JSON.stringify(a) !== JSON.stringify(b))) out.push(n);
      });
    });
    if (alt.dach && alt.dach.fest && JSON.stringify(alt.dach.neigung) !== JSON.stringify(neu.dach && neu.dach.neigung)) out.push('dach.neigung');
    return out;
  }

  /* ---------- Auswirkungen ---------- */
  function auswirkungenBerechnen(D0, D1) {
    var A = { raeume: [], masse: [], waende: [], oeffnungen: [], dach: [] };
    function lichte(D, id) { var r = null; D.geschosse.forEach(function (g) { D.plan(g).raeume.forEach(function (q) { if (q.id === id) r = q; }); }); return r; }
    var alt = {};
    D0.abl.raeume.forEach(function (r) { alt[r.id] = r; });
    D1.abl.raeume.forEach(function (r) {
      var a = alt[r.id];
      if (a && Math.abs(a.flaeche - r.flaeche) <= 1) return;
      var la = a && lichte(D0, r.id), ln = lichte(D1, r.id);
      A.raeume.push({
        id: r.id, name: r.name, geschoss: r.geschoss,
        flaeche: { vorher: a ? a.flaeche / 1e6 : 0, nachher: r.flaeche / 1e6 },
        breite: { vorher: la ? la.lichte.breite : null, nachher: ln ? ln.lichte.breite : null },
        tiefe: { vorher: la ? la.lichte.tiefe : null, nachher: ln ? ln.lichte.tiefe : null }
      });
    });
    function segmente(D) {
      var out = {};
      D.geschosse.forEach(function (g) { D.plan(g).ketten.forEach(function (k) { k.segmente.forEach(function (s) { if (!(s.name in out)) out[s.name] = { laenge: s.laenge, geschoss: g }; }); }); });
      return out;
    }
    var s0 = segmente(D0), s1 = segmente(D1);
    Object.keys(s1).forEach(function (n) { if (n in s0 && Math.abs(s0[n].laenge - s1[n].laenge) > TOL) A.masse.push({ name: n, geschoss: s1[n].geschoss, vorher: s0[n].laenge, nachher: s1[n].laenge }); });
    var w0 = {};
    D0.geschosse.forEach(function (g) { D0.abl.geschosse[g].waende.forEach(function (w) { w0[g + ':' + w.id] = w.linie; }); });
    D1.geschosse.forEach(function (g) {
      D1.abl.geschosse[g].waende.forEach(function (w) {
        var a = w0[g + ':' + w.id], b = w.linie;
        if (!a) { A.waende.push({ id: w.id, geschoss: g, art: 'neu' }); return; }
        var dA = [b.a[0] - a.a[0], b.a[1] - a.a[1]], dB = [b.b[0] - a.b[0], b.b[1] - a.b[1]], lA = Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]), lB = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]);
        if (Math.abs(a.t - b.t) > TOL) A.waende.push({ id: w.id, geschoss: g, art: 'dicke', vorher: a.t, nachher: b.t });
        if (Math.abs(lA - lB) > TOL) A.waende.push({ id: w.id, geschoss: g, art: 'laenge', vorher: lA, nachher: lB });
        else if (dA.concat(dB).some(function (d) { return Math.abs(d) > TOL; })) A.waende.push({ id: w.id, geschoss: g, art: 'verschoben', vorher: a.a, nachher: b.a });
      });
    });
    function oeff(D) { var out = {}; D.geschosse.forEach(function (g) { D.plan(g).oeffnungen.forEach(function (o) { out[o.name] = o; }); }); return out; }
    var o0 = oeff(D0), o1 = oeff(D1);
    Object.keys(o1).forEach(function (n) {
      var a = o0[n], b = o1[n];
      if (!a) return;
      if (Math.abs(a.breite - b.breite) > TOL) A.oeffnungen.push({ name: n, art: 'breite', vorher: a.breite, nachher: b.breite });
      else if (Math.hypot(a.mitte[0] - b.mitte[0], a.mitte[1] - b.mitte[1]) > TOL) A.oeffnungen.push({ name: n, art: 'verschoben', vorher: a.mitte, nachher: b.mitte, weg: Math.hypot(a.mitte[0] - b.mitte[0], a.mitte[1] - b.mitte[1]) });
    });
    function dachWerte(D) {
      var d = D.dach, out = { neigung: d.neigung, ueberstand: d.ueberstand, traufe: d.traufe };
      ['A', 'B'].forEach(function (f) { if (d[f]) ['x0', 'x1', 'z0', 'z1'].forEach(function (k) { out['Flügel ' + f + ' ' + k] = d[f][k]; }); });
      return out;
    }
    var d0 = dachWerte(D0), d1 = dachWerte(D1);
    Object.keys(d1).forEach(function (n) { if (n in d0 && Math.abs(d0[n] - d1[n]) > TOL) A.dach.push({ name: n, vorher: d0[n], nachher: d1[n] }); });
    return A;
  }

  /* ---------- Hauptfunktion ---------- */
  function aendern(haus, aenderungen, optionen) {
    var opt = optionen || {};
    var res = { ok: false, haus: null, vorschauHaus: null, kanten: [], schritte: [], meldungen: [], auswirkungen: { raeume: [], masse: [], waende: [], oeffnungen: [], dach: [] }, befunde: { neu: [], behoben: [], fehlerNeu: [], alle: [] } };
    var S = null;
    try {
      if (!Array.isArray(aenderungen) || !aenderungen.length) throw fehler('Keine Änderungen angegeben.');
      var D0 = ableiten(haus);
      S = { haus: klon(haus), D: D0, edits: {}, reihenfolge: [] };
      aenderungen.forEach(function (ae, i) {
        var schritt;
        try { schritt = schrittAnwenden(S, ae, opt); } catch (e) { e.nummer = i + 1; e.kurz = kurzText(ae); throw e; }
        res.schritte.push(schritt);
        res.meldungen.push((aenderungen.length > 1 ? 'Änderung ' + (i + 1) + ': ' : '') + schritt.text + (schritt.alternativen && schritt.alternativen.length ? ' (Alternativen: ' + schritt.alternativen.join(', ') + ')' : ''));
        if (!schritt.unveraendert) {
          try { S.D = ableiten(S.haus); } catch (e) { throw fehler('Das Haus lässt sich nach dieser Änderung nicht mehr ableiten: ' + e.message); }
        }
      });
      var D1 = S.D;
      res.vorschauHaus = S.haus;
      Object.defineProperty(res, 'ableitung', { value: { vorher: D0, nachher: D1 }, enumerable: false });
      res.auswirkungen = auswirkungenBerechnen(D0, D1);
      res.befunde = befundeVergleichen(D0, D1);
      res.befunde.fehlerNeu = res.befunde.neu.filter(function (b) { return b.stufe === 'fehler'; });
      var verletzt = opt.aussenmass ? [] : festeVerletzt(haus, S.haus);
      if (verletzt.length) throw fehler('Gesperrte Werte würden sich ändern: ' + verletzt.join(', ') + ' (nur mit aussenmass)');
      if (res.befunde.fehlerNeu.length && !opt.trotzdem) {
        res.meldungen.push('Abbruch: Die Änderung erzeugt ' + res.befunde.fehlerNeu.length + ' neue(n) Fehler, haus.json bleibt unverändert (übernehmen nur mit trotzdem bzw. --trotzdem):');
        res.befunde.fehlerNeu.forEach(function (b) { res.meldungen.push('  Fehler · Regel ' + b.regel + ': ' + b.text); });
        return res;
      }
      if (res.befunde.fehlerNeu.length) res.befunde.fehlerNeu.forEach(function (b) { res.meldungen.push('Fehler (trotzdem übernommen) · Regel ' + b.regel + ': ' + b.text); });
      res.kanten = kantenAus(S);
      res.haus = S.haus;
      res.ok = true;
      if (res.schritte.every(function (s) { return s.unveraendert; })) res.meldungen.push('Alles unverändert.');
      return res;
    } catch (e) {
      if (e.nummer) res.meldungen.push('Änderung ' + e.nummer + ' (' + e.kurz + '): ' + e.message);
      else res.meldungen.push(e.aendern ? e.message : 'Fehler beim Ableiten: ' + e.message);
      if (!e.aendern && !e.nummer) { /* unerwartet: Meldung genügt, Stapel für die Fehlersuche */ res.stapel = e.stack; }
      res.haus = null; res.ok = false;
      return res;
    }
  }

  /* ---------- Text von haus.json: nur die geänderten Stellen ersetzen ---------- */
  function jsonScan(text) {
    var i = 0, n = text.length;
    function ws() { while (i < n && ' \t\r\n'.indexOf(text.charAt(i)) >= 0) i++; }
    function bad(m) { throw fehler('JSON nicht lesbar bei Zeichen ' + i + ': ' + m); }
    function str() { var s = i; i++; while (i < n && text.charAt(i) !== '"') { if (text.charAt(i) === '\\') i++; i++; } i++; return JSON.parse(text.slice(s, i)); }
    function wert() {
      ws();
      var s = i, c = text.charAt(i);
      if (c === '{') {
        i++; var props = []; ws();
        if (text.charAt(i) === '}') { i++; return { t: 'obj', s: s, e: i, props: props }; }
        for (;;) {
          ws(); if (text.charAt(i) !== '"') bad('Schlüssel erwartet');
          var ks = i, key = str(); ws(); if (text.charAt(i) !== ':') bad(': erwartet'); i++;
          props.push({ key: key, ks: ks, node: wert() }); ws();
          if (text.charAt(i) === ',') { i++; continue; }
          if (text.charAt(i) === '}') { i++; break; }
          bad(', oder } erwartet');
        }
        return { t: 'obj', s: s, e: i, props: props };
      }
      if (c === '[') {
        i++; var items = []; ws();
        if (text.charAt(i) === ']') { i++; return { t: 'arr', s: s, e: i, items: items }; }
        for (;;) {
          items.push(wert()); ws();
          if (text.charAt(i) === ',') { i++; continue; }
          if (text.charAt(i) === ']') { i++; break; }
          bad(', oder ] erwartet');
        }
        return { t: 'arr', s: s, e: i, items: items };
      }
      if (c === '"') { str(); return { t: 'str', s: s, e: i }; }
      var m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 40));
      if (!m) bad('Wert erwartet');
      i += m[0].length;
      return { t: 'lit', s: s, e: i };
    }
    var r = wert(); ws();
    if (i !== n) bad('Text nach dem Wert');
    return r;
  }
  function ser(v) { return Array.isArray(v) ? '[' + v.map(ser).join(', ') + ']' : JSON.stringify(v); }
  function textPatchen(text, kanten) {
    var wurzel = jsonScan(text), edits = [], seq = 0;
    kanten.forEach(function (k) {
      var knoten = wurzel, eltern = null, prop = null, i;
      for (i = 0; i < k.pfad.length; i++) {
        var schluessel = k.pfad[i], kind = null;
        if (knoten && knoten.t === 'obj') { prop = null; knoten.props.forEach(function (p) { if (p.key === schluessel) prop = p; }); kind = prop ? prop.node : null; } else if (knoten && knoten.t === 'arr') { kind = knoten.items[schluessel] || null; prop = null; }
        if (!kind) {
          if (i === k.pfad.length - 1 && knoten && knoten.t === 'obj' && !k.entfernen) { eltern = knoten; knoten = null; break; }
          throw fehler('Pfad in haus.json nicht gefunden: ' + k.pfad.join('.'));
        }
        eltern = knoten; knoten = kind;
      }
      if (!knoten) { // neuer Schlüssel: hinter dem Wert von "typ" (sonst der ersten Eigenschaft)
        var anker = null;
        eltern.props.forEach(function (p) { if (p.key === 'typ') anker = p; });
        if (!anker) anker = eltern.props[0];
        if (!anker) throw fehler('Neuer Schlüssel in leerem Objekt nicht unterstützt: ' + k.pfad.join('.'));
        edits.push({ s: anker.node.e, e: anker.node.e, text: ', ' + JSON.stringify(k.pfad[k.pfad.length - 1]) + ': ' + ser(k.wert), seq: seq++ });
      } else if (k.entfernen) {
        if (!eltern || eltern.t !== 'obj') throw fehler('Entfernen nur für Eigenschaften eines Objekts: ' + k.pfad.join('.'));
        var idx = eltern.props.indexOf(prop);
        if (idx > 0) edits.push({ s: eltern.props[idx - 1].node.e, e: prop.node.e, text: '', seq: seq++ });
        else edits.push({ s: prop.ks, e: eltern.props[1] ? eltern.props[1].ks : prop.node.e, text: '', seq: seq++ });
      } else edits.push({ s: knoten.s, e: knoten.e, text: ser(k.wert), seq: seq++ });
    });
    edits.sort(function (a, b) { return b.s - a.s || b.seq - a.seq; });
    var out = text;
    edits.forEach(function (e) { out = out.slice(0, e.s) + e.text + out.slice(e.e); });
    return out;
  }

  /* ---------- Ausgabe ---------- */
  function raumText(r) {
    var s = r.name + ': ' + de(r.flaeche.vorher, 2) + ' → ' + de(r.flaeche.nachher, 2) + ' m²';
    if (r.breite.vorher != null && r.breite.nachher != null) s += ' (lichte Maße ' + de(r.breite.vorher / 1000, 3) + ' × ' + de(r.tiefe.vorher / 1000, 3) + ' → ' + de(r.breite.nachher / 1000, 3) + ' × ' + de(r.tiefe.nachher / 1000, 3) + ' m)';
    return s;
  }
  function auswirkungenText(res) {
    var z = [], A = res.auswirkungen;
    res.meldungen.forEach(function (m) { z.push(m); });
    if (A.raeume.length) { z.push('Räume:'); A.raeume.forEach(function (r) { z.push('  ' + raumText(r)); }); } else if (res.vorschauHaus) z.push('Räume: keine Änderung');
    if (A.masse.length) { z.push('Maße (' + A.masse.length + '):'); A.masse.forEach(function (m) { z.push('  ' + m.name + ': ' + de(m.vorher, 1) + ' → ' + de(m.nachher, 1) + ' mm'); }); }
    if (A.waende.length) {
      z.push('Wände (' + A.waende.length + '):');
      A.waende.forEach(function (w) { z.push('  ' + w.id + ': ' + (w.art === 'verschoben' ? 'verschoben' : w.art === 'laenge' ? 'Länge ' + de(w.vorher, 1) + ' → ' + de(w.nachher, 1) + ' mm' : w.art === 'dicke' ? 'Dicke ' + de(w.vorher, 1) + ' → ' + de(w.nachher, 1) + ' mm' : 'neu')); });
    }
    if (A.oeffnungen.length) {
      z.push('Öffnungen:');
      A.oeffnungen.forEach(function (o) { z.push('  ' + o.name + ': ' + (o.art === 'breite' ? 'Breite ' + de(o.vorher, 1) + ' → ' + de(o.nachher, 1) + ' mm' : 'verschoben um ' + de(o.weg, 1) + ' mm')); });
    }
    if (A.dach.length) { z.push('Dach:'); A.dach.forEach(function (d) { z.push('  ' + d.name + ': ' + de(d.vorher, 1) + ' → ' + de(d.nachher, 1)); }); }
    if (res.vorschauHaus) {
      var B = res.befunde;
      z.push('Befunde: ' + (B.neu.length ? B.neu.length + ' neu' : 'keine neuen') + ', ' + B.behoben.length + ' behoben, ' + B.alle.length + ' insgesamt');
      B.neu.forEach(function (b) { z.push('  neu · ' + b.stufe + ' · Regel ' + b.regel + ': ' + b.text); });
      B.behoben.forEach(function (b) { z.push('  behoben · ' + b.stufe + ' · Regel ' + b.regel + ': ' + b.text); });
    }
    return z.join('\n');
  }

  function vergleichSvg(res, geschoss) {
    if (!res.ableitung) throw fehler('Kein Vergleich möglich: die Änderung wurde nicht ausgewertet');
    var neu = res.ableitung.nachher.plan(geschoss), alt = res.ableitung.vorher.plan(geschoss);
    function f(v) { return String(Math.round(v * 10) / 10); }
    function pfad(ring) { return 'M' + ring.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L') + 'Z'; }
    var d = alt.waendeUnion.map(function (poly) { return poly.map(pfad).join(''); }).join('');
    var svg = grundrissSvg(neu, { standalone: true });
    var ueber = '<g class="vergleich" fill="none" stroke="#c8321e" stroke-width="22" stroke-dasharray="80 60" stroke-linejoin="round"><path d="' + d + '"/></g>';
    return svg.replace(/<\/svg>\s*$/, ueber + '</svg>');
  }

  return { aendern: aendern, einheitParsen: einheitParsen, stand: stand, listeErzeugen: listeErzeugen, listeLesen: listeLesen, textPatchen: textPatchen, auswirkungenText: auswirkungenText, vergleichSvg: vergleichSvg, ableiten: ableiten, aenderungPruefen: aenderungPruefen };
})();
if (typeof module !== 'undefined') module.exports = Aendern;
