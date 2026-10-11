/* Plan 2D: zeigt den Grundriss (src/grundriss.js) in der Seite, mit Verschieben, Zoomen und Auswahl von Maßen, Räumen und Befunden.
   Läuft nur im Browser. Die Seite speichert nichts. Umschalten zwischen 3D und den Grundrissen über die Schaltflächen „Darstellung“. */
(function () {
  'use strict';
  var shell = document.getElementById('shell'), host = document.getElementById('plan2d'), box = document.getElementById('planSvg'), info = document.getElementById('planInfo'), panel = document.getElementById('panel');
  if (!host || !box || typeof grundrissAbleiten !== 'function') return;
  var D = null, plaene = {}, geschoss = null, svg = null, vb = null, vb0 = null, aus = null, auswahlRaum = null;
  var opt = { massketten: true, raeume: true, oeffnungen: true, marken: true };
  var HERKUNFT = { plan: 'Plan', aufmass: 'Aufmaß', nutzer: 'Angabe des Nutzers', annahme: 'Annahme', ohne: 'ohne Herkunftsangabe' };
  var HINWEIS = 'Ein Maß, einen Raum oder eine Markierung anklicken.';
  var modusBtns = [].slice.call(document.querySelectorAll('[data-modus]'));
  var boxen = { massketten: 'p-mass', raeume: 'p-raeume', oeffnungen: 'p-oeff', marken: 'p-marken' };

  function fmt(n, d) { return n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function mass(mm) { return mm >= 1000 ? fmt(mm / 1000, 3).replace(/,?0+$/, '') + ' m' : fmt(mm / 10, 1).replace(/,0$/, '') + ' cm'; }
  function daten() {
    if (D) return D;
    var WV = werteAufloesen(HAUS), abl = raeumeAbleiten(HAUS, WV), dach = dachAbleiten(HAUS, WV);
    D = { WV: WV, abl: abl, dach: dach, befunde: pruefen(HAUS, WV, abl, dach) };
    return D;
  }
  function plan(g) { if (!plaene[g]) plaene[g] = grundrissAbleiten(HAUS, D.WV, D.abl, D.dach, D.befunde, g); return plaene[g]; }

  /* ---------- Anzeige ---------- */
  function layout() {
    var w = shell.clientWidth, links = !panel.classList.contains('closed') && w > 760 ? Math.min(340, w - 24) + 24 : 0;
    box.style.cssText = 'position:absolute;top:0;bottom:0;right:0;left:' + links + 'px';
    info.style.left = links + 'px';
  }
  function setVB() { if (svg && vb) svg.setAttribute('viewBox', vb.map(function (v) { return Math.round(v * 10) / 10; }).join(' ')); }
  function darstellen(neu) {
    var p = plan(geschoss);
    box.innerHTML = grundrissSvg(p, opt);
    svg = box.firstChild;
    var n = svg.getAttribute('data-viewbox').split(' ').map(Number);
    if (neu || !vb) { vb0 = n; vb = n.slice(); }
    setVB();
    aus = null;
    if (auswahlRaum) markiereRaum(auswahlRaum);
  }
  function zeige(g, neu) {
    var wechsel = g !== geschoss;
    geschoss = g;
    layout();
    darstellen(wechsel || neu);
    if (wechsel) { auswahlRaum = null; info.textContent = HINWEIS; }
  }
  function setModus(m) {
    var an = m !== '3d';
    host.hidden = !an;
    shell.classList.toggle('modus2d', an);
    modusBtns.forEach(function (b) { var on = b.getAttribute('data-modus') === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    if (an) { daten(); zeige(m, false); if (!info.textContent) info.textContent = HINWEIS; }
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
  function waehleMass(el) {
    if (aus) aus.classList.remove('on');
    [].forEach.call(svg.querySelectorAll('.hl'), function (l) { l.parentNode.removeChild(l); });
    aus = el; el.classList.add('on');
    var wert = Number(el.getAttribute('data-wert')), q = el.getAttribute('data-quelle'), bei = el.getAttribute('data-bei');
    if (bei != null) { // Schnittlinie, entlang der das Maß gemessen ist
      var von = Number(el.getAttribute('data-von')), bis = Number(el.getAttribute('data-bis')), b = Number(bei), h = el.getAttribute('data-richtung') === 'x';
      var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('class', 'hl');
      l.setAttribute('x1', h ? von : b); l.setAttribute('y1', h ? b : von); l.setAttribute('x2', h ? bis : b); l.setAttribute('y2', h ? b : bis);
      svg.appendChild(l);
    }
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
