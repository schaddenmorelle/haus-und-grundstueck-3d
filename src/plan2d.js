/* Plan 2D: zeigt den Grundriss (src/grundriss.js) in der Seite, mit Verschieben, Zoomen und Auswahl von Maßen, Räumen und Befunden.
   Läuft nur im Browser. Die Seite speichert nichts. Umschalten zwischen 3D und den Grundrissen über die Schaltflächen „Darstellung“. */
(function () {
  'use strict';
  var shell = document.getElementById('shell'), host = document.getElementById('plan2d'), box = document.getElementById('planSvg'), info = document.getElementById('planInfo'), panel = document.getElementById('panel');
  if (!host || !box || typeof grundrissAbleiten !== 'function') return;
  var D = null, markName = null, geschoss = null, svg = null, vb = null, vb0 = null, aus = null, auswahlRaum = null;
  var probe = { an: false, liste: [], res: null, mass: null }; // Probiermodus: Änderungen auf einer Kopie der Daten, die Seite speichert nichts
  var opt = { massketten: true, raeume: true, oeffnungen: true, marken: true };
  var HERKUNFT = { plan: 'Plan', aufmass: 'Aufmaß', nutzer: 'Angabe des Nutzers', annahme: 'Annahme', ohne: 'ohne Herkunftsangabe' };
  var HINWEIS = 'Ein Maß, einen Raum oder eine Markierung anklicken.';
  var modusBtns = [].slice.call(document.querySelectorAll('[data-modus]'));
  var boxen = { massketten: 'p-mass', raeume: 'p-raeume', oeffnungen: 'p-oeff', marken: 'p-marken' };

  function fmt(n, d) { return n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function mass(mm) { return mm >= 1000 ? fmt(mm / 1000, 3).replace(/,?0+$/, '') + ' m' : fmt(mm / 10, 1).replace(/,0$/, '') + ' cm'; }
  function aktuellesHaus() { return probe.an && probe.res && probe.res.vorschauHaus ? probe.res.vorschauHaus : HAUS; }
  function daten() { if (!D) D = Aendern.ableiten(aktuellesHaus()); return D; }
  function plan(g) { return daten().plan(g); }

  /* ---------- Anzeige ---------- */
  function layout() {
    var w = shell.clientWidth, links = !panel.classList.contains('closed') && w > 760 ? Math.min(340, w - 24) + 24 : 0;
    box.style.cssText = 'position:absolute;top:0;bottom:0;right:0;left:' + links + 'px';
    info.style.left = links + 'px';
  }
  function setVB() { if (svg && vb) svg.setAttribute('viewBox', vb.map(function (v) { return Math.round(v * 10) / 10; }).join(' ')); }
  function darstellen(neu) {
    var p = plan(geschoss), g = geschoss;
    box.innerHTML = grundrissSvg(p, opt);
    svg = box.firstChild;
    if (probe.an && probe.res && probe.res.ableitung) svg.insertAdjacentHTML('beforeend', Aendern.vergleichUeberlagerung(probe.res, g || geschoss)); // alter Wandumriss gestrichelt
    var n = svg.getAttribute('data-viewbox').split(' ').map(Number);
    if (neu || !vb) { vb0 = n; vb = n.slice(); }
    setVB();
    aus = null;
    if (markName) { // gewähltes Maß nach dem Neuzeichnen (Probiermodus, Schalter) wieder hervorheben
      var el = [].filter.call(svg.querySelectorAll('[data-name]'), function (e) { return e.getAttribute('data-name') === markName; })[0];
      if (el) { aus = el; el.classList.add('on'); hervorheben(el); }
    }
    if (auswahlRaum) markiereRaum(auswahlRaum);
  }
  function zeige(g, neu) {
    var wechsel = g !== geschoss;
    geschoss = g;
    layout();
    darstellen(wechsel || neu);
    if (wechsel) { auswahlRaum = null; markName = null; info.textContent = HINWEIS; }
  }
  function setModus(m) {
    var an = m !== '3d';
    host.hidden = !an;
    shell.classList.toggle('modus2d', an);
    modusBtns.forEach(function (b) { var on = b.getAttribute('data-modus') === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    if (an) { daten(); zeige(m, false); if (!info.textContent) info.textContent = HINWEIS; }
    else probe3d();
  }
  /* Zurück in 3D: Stimmt das Modell nicht mit den Daten des Probiermodus überein, wird es neu aufgebaut (src/app.js, neuAufbauen) */
  function probe3d() {
    var b = document.getElementById('pm3d'), m3 = window.__m3d, h = aktuellesHaus();
    if (!b || !m3 || !m3.neuAufbauen) return;
    b.hidden = true;
    if (m3.haus() !== h) {
      try { m3.neuAufbauen(h); } catch (e) { b.textContent = '3D-Modell konnte mit den geänderten Daten nicht aufgebaut werden (' + e.message + '); es zeigt den vorigen Stand.'; b.hidden = false; return; }
    }
    if (h !== HAUS) { b.textContent = 'Probiermodus: Das 3D-Modell zeigt den geänderten Stand (' + probe.liste.length + (probe.liste.length === 1 ? ' Änderung' : ' Änderungen') + '), nicht den eingecheckten.'; b.hidden = false; }
  }
  modusBtns.forEach(function (b) { b.addEventListener('click', function () { setModus(b.getAttribute('data-modus')); }); });
  Object.keys(boxen).forEach(function (k) {
    var el = document.getElementById(boxen[k]);
    if (el) el.addEventListener('change', function () { opt[k] = el.checked; if (geschoss) darstellen(false); });
  });
  new MutationObserver(layout).observe(panel, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', layout);

  /* ---------- Auswahl ---------- */
  function zeile(h, q) { return '<b>' + h + '</b> ' + q; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function ringPfad(r) { return 'M' + r.map(function (p) { return Math.round(p[0] * 10) / 10 + ' ' + Math.round(p[1] * 10) / 10; }).join('L') + 'Z'; }
  function bereicheVon(el) { // Flächen, die zu einem Maß gehören (src/grundriss.js, markieren): Wand, Pfeiler, Ausschnitt, Außenwände
    var name = el.getAttribute('data-name'), art = el.getAttribute('data-art'), p = plan(geschoss), out = [];
    if (art === 'oeffnung') { p.oeffnungen.forEach(function (o) { if (o.name === name) out.push(o.ring); }); return out; }
    var von = Number(el.getAttribute('data-von')), bis = Number(el.getAttribute('data-bis')), ri = el.getAttribute('data-richtung');
    p.ketten.forEach(function (k) {
      if (out.length || k.richtung !== ri) return;
      k.segmente.forEach(function (s) {
        if (!out.length && s.name === name && Math.abs(s.von - von) < 1 && Math.abs(s.bis - bis) < 1) (s.bereiche || []).forEach(function (b) { out.push(b.ring); });
      });
    });
    return out;
  }
  function hervorheben(el) { // Raummaß: rote Linie über die Schnittlinie; alles andere: die zugehörige Fläche im Plan rot
    [].forEach.call(svg.querySelectorAll('.hl, .hlf'), function (l) { l.parentNode.removeChild(l); });
    var bei = el.getAttribute('data-bei'), art = el.getAttribute('data-art');
    if (bei != null && art === 'raum') { // Schnittlinie, entlang der das Maß gemessen ist
      var von = Number(el.getAttribute('data-von')), bis = Number(el.getAttribute('data-bis')), b = Number(bei), h = el.getAttribute('data-richtung') === 'x';
      var l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('class', 'hl');
      l.setAttribute('x1', h ? von : b); l.setAttribute('y1', h ? b : von); l.setAttribute('x2', h ? bis : b); l.setAttribute('y2', h ? b : bis);
      svg.appendChild(l);
    }
    bereicheVon(el).forEach(function (r) {
      var pf = document.createElementNS(SVGNS, 'path');
      pf.setAttribute('class', 'hlf'); pf.setAttribute('d', ringPfad(r));
      svg.appendChild(pf);
    });
  }
  function waehleMass(el) {
    if (aus) aus.classList.remove('on');
    aus = el; el.classList.add('on');
    markName = el.getAttribute('data-name');
    hervorheben(el);
    var wert = Number(el.getAttribute('data-wert')), q = el.getAttribute('data-quelle');
    probeMass(el);
    info.textContent = el.getAttribute('data-name') + ' · ' + mass(wert) + ' (' + fmt(wert, wert % 1 ? 1 : 0) + ' mm) · Herkunft: ' + HERKUNFT[q] +
      (el.getAttribute('data-fest') === '1' ? ' · gesperrt (Außenmaß)' : '') + (el.getAttribute('data-schraeg') ? ' · schräg gemessen' : '');
  }
  function markiereRaum(id) {
    auswahlRaum = id;
    [].forEach.call(svg.querySelectorAll('.raumf'), function (p) { p.classList.toggle('on', p.getAttribute('data-raum') === id); });
    [].forEach.call(document.querySelectorAll('#rooms button'), function (b) { b.classList.toggle('on', b.dataset.id === id); });
  }
  function waehleRaum(id) {
    var r = plan(geschoss).raeume.filter(function (q) { return q.id === id; })[0];
    if (!r) return;
    markiereRaum(id);
    info.textContent = r.name + ' · ' + fmt(r.flaeche / 1e6, 2) + ' m² · ' + (r.rechteckig ? '' : 'etwa ') + fmt(r.lichte.breite / 1000, 3) + ' × ' + fmt(r.lichte.tiefe / 1000, 3) + ' m' + (r.notiz ? ' · ' + r.notiz : '');
  }
  function waehleMarke(g) {
    var m = plan(geschoss).marken[Number(g.getAttribute('data-marke'))];
    if (m) info.textContent = (m.stufe === 'fehler' ? 'Fehler' : m.stufe === 'warnung' ? 'Warnung' : 'Hinweis') + ' · Regel ' + m.regel + ': ' + m.text;
  }
  function klick(t) {
    if (!t || !t.closest) return;
    var m = t.closest('[data-name]'), g = t.closest('[data-marke]'), r = t.closest('[data-raum]');
    if (m) waehleMass(m); else if (g) waehleMarke(g); else if (r) waehleRaum(r.getAttribute('data-raum'));
  }

  /* ---------- Verschieben und Zoomen ---------- */
  function punkt(cx, cy) { var p = svg.createSVGPoint(); p.x = cx; p.y = cy; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  function zoom(k, cx, cy) { // k < 1 vergrößert; der Punkt unter (cx, cy) bleibt stehen
    if (!svg) return;
    var w = Math.min(vb0[2] * 3, Math.max(vb0[2] / 40, vb[2] * k)), s = w / vb[2], p = punkt(cx, cy);
    vb[2] = w; vb[3] *= s; setVB();
    var p2 = punkt(cx, cy);
    vb[0] += p.x - p2.x; vb[1] += p.y - p2.y; setVB();
  }
  function mitte() { var r = box.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  document.getElementById('planPlus').addEventListener('click', function () { var c = mitte(); zoom(0.7, c[0], c[1]); });
  document.getElementById('planMinus').addEventListener('click', function () { var c = mitte(); zoom(1 / 0.7, c[0], c[1]); });
  document.getElementById('planFit').addEventListener('click', function () { if (vb0) { vb = vb0.slice(); setVB(); } });
  host.addEventListener('wheel', function (e) { if (!svg) return; e.preventDefault(); zoom(Math.pow(1.0016, e.deltaY), e.clientX, e.clientY); }, { passive: false });
  var zeiger = {}, start = null;
  function anzahl() { return Object.keys(zeiger).length; }
  host.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('#planTools')) return;
    zeiger[e.pointerId] = [e.clientX, e.clientY];
    start = { vb: vb ? vb.slice() : null, x: e.clientX, y: e.clientY, ziel: e.target, bewegt: false, abstand: 0 };
    if (anzahl() === 2) { var k = Object.keys(zeiger).map(function (i) { return zeiger[i]; }); start.abstand = Math.hypot(k[0][0] - k[1][0], k[0][1] - k[1][1]); start.bewegt = true; }
  });
  host.addEventListener('pointermove', function (e) {
    if (!zeiger[e.pointerId] || !svg || !start) return;
    var alt = zeiger[e.pointerId]; zeiger[e.pointerId] = [e.clientX, e.clientY];
    if (anzahl() === 2) {
      var k = Object.keys(zeiger).map(function (i) { return zeiger[i]; }), d = Math.hypot(k[0][0] - k[1][0], k[0][1] - k[1][1]);
      if (start.abstand > 0 && d > 0) { zoom(start.abstand / d, (k[0][0] + k[1][0]) / 2, (k[0][1] + k[1][1]) / 2); start.abstand = d; }
      return;
    }
    if (!start.bewegt && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) return;
    start.bewegt = true; host.classList.add('zieht');
    var p0 = punkt(alt[0], alt[1]), p1 = punkt(e.clientX, e.clientY);
    vb[0] -= p1.x - p0.x; vb[1] -= p1.y - p0.y; setVB();
  });
  function ende(e) {
    if (!zeiger[e.pointerId]) return;
    delete zeiger[e.pointerId];
    host.classList.remove('zieht');
    if (start && !start.bewegt && e.type === 'pointerup') klick(start.ziel);
    if (!anzahl()) start = null;
  }
  host.addEventListener('pointerup', ende); host.addEventListener('pointercancel', ende);

  /* ---------- Probiermodus ---------- */
  var pm = {};
  ['an', 'box', 'mass', 'wert', 'ok', 'einzeln-l', 'einzeln', 'quelle', 'aussen', 'fehler', 'liste', 'aus', 'export', 'reset', 'text'].forEach(function (k) { pm[k] = document.getElementById('pm-' + k); });
  function pmWert(mm) { return fmt(mm / 1000, 3).replace(/,?0+$/, '') + 'm'; }
  function probeMass(el) { // ein Maß im Plan wurde angeklickt
    if (!probe.an || !pm.wert) return;
    var wert = Number(el.getAttribute('data-wert')), art = el.getAttribute('data-art');
    probe.mass = { name: el.getAttribute('data-name'), wert: wert, art: art, fest: el.getAttribute('data-fest') === '1', schraeg: !!el.getAttribute('data-schraeg') };
    pm.mass.textContent = probe.mass.name + ' · derzeit ' + mass(wert) + (probe.mass.fest ? ' · gesperrt (Außenmaß)' : '') + (probe.mass.schraeg ? ' · schräg gemessen, nicht änderbar' : '');
    pm.wert.value = pmWert(wert);
    pm['einzeln-l'].hidden = art !== 'wand';
    pm.fehler.textContent = '';
    pm.mass.scrollIntoView({ block: 'nearest' });
    pm.wert.focus({ preventScroll: true });
    pm.wert.select();
  }
  function probeOptionen() { return { aussenmass: pm.aussen.checked, trotzdem: true }; } // trotzdem: Fehler werden angezeigt statt die Vorschau zu verhindern
  function probeNeuZeichnen() {
    D = null;
    if (geschoss) darstellen(false);
    probeAnzeigen();
  }
  function probeAnzeigen() {
    var res = probe.res;
    pm.liste.innerHTML = '';
    if (!probe.liste.length) { var l0 = document.createElement('li'); l0.className = 'leer'; l0.textContent = 'Noch keine Änderung.'; pm.liste.appendChild(l0); }
    probe.liste.forEach(function (ae, i) {
      var li = document.createElement('li'), s = document.createElement('span'), b = document.createElement('button');
      s.textContent = (res && res.schritte[i] && res.schritte[i].text) || (ae.mass + ' = ' + ae.wert);
      b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Änderung ' + (i + 1) + ' entfernen');
      b.addEventListener('click', function () { probe.liste.splice(i, 1); probeRechnen(); });
      li.appendChild(s); li.appendChild(b); pm.liste.appendChild(li);
    });
    pm.aus.hidden = !res;
    if (res) {
      var neu = res.befunde.fehlerNeu.length;
      pm.aus.textContent = Aendern.auswirkungenText(res).split('\n').slice(res.schritte.length).join('\n');
      if (neu) {
        var w = document.createElement('div'); w.className = 'pm-warn';
        w.textContent = neu + ' neue(r) Fehler: Das Werkzeug übernimmt die Liste nur mit --trotzdem.';
        pm.aus.insertBefore(w, pm.aus.firstChild);
      }
    }
    pm.export.disabled = !probe.liste.length;
    pm.reset.disabled = !probe.liste.length;
  }
  function probeRechnen() {
    if (!probe.liste.length) probe.res = null;
    else probe.res = Aendern.aendern(HAUS, probe.liste, probeOptionen());
    probeNeuZeichnen();
  }
  function probeAnwenden() {
    if (!probe.mass) { pm.fehler.textContent = 'Zuerst ein Maß im Grundriss anklicken.'; return; }
    var ae = { mass: probe.mass.name, wert: pm.wert.value.trim() };
    if (probe.mass.art === 'wand' && pm.einzeln.checked) ae.einzeln = true;
    if (pm.quelle.value) ae.quelle = pm.quelle.value;
    var versuch = probe.liste.concat([ae]), res = Aendern.aendern(HAUS, versuch, probeOptionen());
    if (!res.vorschauHaus) { pm.fehler.textContent = res.meldungen[res.meldungen.length - 1]; return; } // die Änderung selbst ist nicht möglich
    pm.fehler.textContent = '';
    probe.liste = versuch; probe.res = res;
    info.textContent = 'Geändert: ' + res.schritte[res.schritte.length - 1].text;
    probe.mass = null; pm.mass.textContent = 'Kein Maß gewählt.'; pm.wert.value = ''; pm['einzeln-l'].hidden = true;
    probeNeuZeichnen();
  }
  function probeSchalten(an) {
    probe.an = an; pm.box.hidden = !an;
    if (!an) { probe.mass = null; pm.fehler.textContent = ''; }
    else if (probe.liste.length) probe.res = Aendern.aendern(HAUS, probe.liste, probeOptionen());
    probeNeuZeichnen();
  }
  if (pm.an) {
    pm.an.addEventListener('change', function () { probeSchalten(pm.an.checked); });
    pm.ok.addEventListener('click', probeAnwenden);
    pm.wert.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); probeAnwenden(); } });
    pm.aussen.addEventListener('change', function () { if (probe.liste.length) probeRechnen(); });
    pm.reset.addEventListener('click', function () { probe.liste = []; probe.res = null; pm.fehler.textContent = ''; pm.text.hidden = true; probeNeuZeichnen(); });
    pm.export.addEventListener('click', function () {
      var text;
      try { text = JSON.stringify(Aendern.listeErzeugen(HAUS, probe.liste), null, 2) + '\n'; } catch (e) { pm.fehler.textContent = e.message; return; }
      pm.text.value = text; pm.text.hidden = false; pm.text.focus({ preventScroll: true }); pm.text.select();
      var speichern = function () { // im Artifact über die Fähigkeit „downloads“, sonst als Link; der Text steht in jedem Fall im Feld zum Kopieren
        if (window.claude && typeof window.claude.use === 'function') {
          return window.claude.use('downloads').then(function (d) { if (d) return d.save({ filename: 'aenderungen.json', data: text }); throw new Error('keine Downloads'); });
        }
        return new Promise(function (ok) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'aenderungen.json';
          document.body.appendChild(a); a.click(); document.body.removeChild(a); ok();
        });
      };
      try { speichern().catch(function () { /* abgelehnt oder nicht möglich: der Text steht im Feld */ }); } catch (e) { /* dito */ }
    });
    probeAnzeigen();
  }

  /* ---------- Schnittstelle zur Seite ---------- */
  window.__plan2d = {
    aktiv: function () { return shell.classList.contains('modus2d'); },
    setModus: setModus,
    zeigeRaum: function (id) { // Raum aus der Liste: Geschoss wechseln, auswählen
      var r = HAUS.raeume.filter(function (q) { return q.id === id; })[0];
      if (!r) return;
      if (r.geschoss !== geschoss) setModus(r.geschoss);
      waehleRaum(id);
    },
    probe: function () { return probe; },
    zeigeBefund: function (b) { // Befund aus der Liste: Geschoss wechseln, Stelle heranholen
      if (!b.ort) return;
      var g = b.geschoss || geschoss;
      if (g !== geschoss) setModus(g);
      var r = box.getBoundingClientRect(), breite = 6000, h = breite * r.height / Math.max(1, r.width);
      vb = [b.ort[0] - breite / 2, b.ort[1] - h / 2, breite, h]; setVB();
      info.textContent = (b.stufe === 'fehler' ? 'Fehler' : b.stufe === 'warnung' ? 'Warnung' : 'Hinweis') + ' · Regel ' + b.regel + ': ' + b.text;
    }
  };
  var h0 = (window.location.hash || '').toLowerCase();
  if (h0 === '#eg' || h0 === '#dg') setModus(h0.slice(1).toUpperCase());
})();
