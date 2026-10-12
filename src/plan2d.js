/* Plan 2D: zeigt den Grundriss (src/grundriss.js) in der Seite, mit Verschieben, Zoomen und Auswahl von Maßen, Räumen und Befunden.
   Läuft nur im Browser. Die Seite speichert nichts. Umschalten zwischen 3D, den Grundrissen, den Schnitten und den Ansichten über die Schaltflächen
   „Darstellung“ (data-modus: 3d, EG, DG, sch:A, sch:B, sch:frei, an:N, an:O, an:S, an:W; Schnitte und Ansichten zeichnet src/schnitt.js).
   Aufmaß (Phase 6): Die Prüfmaße (PRUEFMASSE, src/data/pruefmasse.json) erscheinen mit Abweichung im Plan und in der Liste; neue Messungen werden
   erfasst und als Messliste exportiert (src/aufmass.js), die Seite speichert nichts. */
(function () {
  'use strict';
  var shell = document.getElementById('shell'), host = document.getElementById('plan2d'), box = document.getElementById('planSvg'), info = document.getElementById('planInfo'), panel = document.getElementById('panel');
  if (!host || !box || typeof grundrissAbleiten !== 'function' || typeof schnittSvg !== 'function') return;
  var MIT_AUFMASS = typeof Aufmass !== 'undefined' && typeof PRUEFMASSE !== 'undefined';
  var D = null, markName = null, geschoss = null, frei = null, zeichnen = null, svg = null, vb = null, vb0 = null, aus = null, auswahlRaum = null;
  var probe = { an: false, liste: [], res: null, mass: null }; // Probiermodus: Änderungen auf einer Kopie der Daten, die Seite speichert nichts
  var opt = { massketten: true, raeume: true, oeffnungen: true, marken: true };
  var HERKUNFT = { plan: 'Plan', aufmass: 'Aufmaß', nutzer: 'Angabe des Nutzers', annahme: 'Annahme', ohne: 'ohne Herkunftsangabe' };
  var HINWEIS = 'Ein Maß, einen Raum oder eine Markierung anklicken.';
  var HINWEIS_SCHNITT = 'Ein Maß oder eine Wand anklicken. Die Höhen lassen sich im Probiermodus ändern.';
  var modusBtns = [].slice.call(document.querySelectorAll('[data-modus]'));
  var boxen = { massketten: 'p-mass', raeume: 'p-raeume', oeffnungen: 'p-oeff', marken: 'p-marken' };

  function fmt(n, d) { return n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function mass(mm) { return mm >= 1000 ? fmt(mm / 1000, 3).replace(/,?0+$/, '') + ' m' : fmt(mm / 10, 1).replace(/,0$/, '') + ' cm'; }
  function aktuellesHaus() { return probe.an && probe.res && probe.res.vorschauHaus ? probe.res.vorschauHaus : HAUS; }
  function daten() { if (!D) D = Aendern.ableiten(aktuellesHaus()); return D; }
  function plan(g) { return daten().plan(g); }
  function istGrundriss(m) { return m === 'EG' || m === 'DG'; }
  function freieLinie(a, b) { var L = Math.hypot(b[0] - a[0], b[1] - a[1]); return { id: 'F', name: 'Schnitt F–F (frei)', a: a, b: b, laenge: L, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], blick: [(b[1] - a[1]) / L + 0, -(b[0] - a[0]) / L + 0] }; }
  function linienListe() { return daten().schnitte().concat(frei ? [frei] : []); }
  function zeichnungVon(m) { // Schnitt oder Ansicht zum Darstellungsmodus
    var d = daten();
    if (/^sch:/.test(m)) return m === 'sch:frei' ? d.schnitt(frei) : d.schnitt(m.slice(4));
    return d.ansicht(m.slice(3));
  }
  function modusVonSchnitt(id) { return id === 'F' ? 'sch:frei' : 'sch:' + id; }

  /* ---------- Anzeige ---------- */
  function layout() {
    var w = shell.clientWidth, links = !panel.classList.contains('closed') && w > 760 ? Math.min(340, w - 24) + 24 : 0;
    box.style.cssText = 'position:absolute;top:0;bottom:0;right:0;left:' + links + 'px';
    info.style.left = links + 'px';
  }
  function setVB() { if (svg && vb) svg.setAttribute('viewBox', vb.map(function (v) { return Math.round(v * 10) / 10; }).join(' ')); }
  function darstellen(neu) {
    var g = geschoss;
    if (istGrundriss(g)) {
      box.innerHTML = grundrissSvg(plan(g), Object.assign({}, opt, { schnittlinien: linienListe() }));
      svg = box.firstChild;
      if (probe.an && probe.res && probe.res.ableitung) svg.insertAdjacentHTML('beforeend', Aendern.vergleichUeberlagerung(probe.res, g)); // alter Wandumriss gestrichelt
    } else {
      box.innerHTML = schnittSvg(zeichnungVon(g), opt);
      svg = box.firstChild;
    }
    var n = svg.getAttribute('data-viewbox').split(' ').map(Number);
    if (neu || !vb) { vb0 = n; vb = n.slice(); }
    setVB();
    aus = null;
    if (markName) { // gewähltes Maß nach dem Neuzeichnen (Probiermodus, Schalter) wieder hervorheben
      var el = [].filter.call(svg.querySelectorAll('[data-name]'), function (e) { return e.getAttribute('data-name') === markName; })[0];
      if (el) { aus = el; el.classList.add('on'); hervorheben(el); }
    }
    if (auswahlRaum) markiereRaum(auswahlRaum);
    aufmassMarkieren();
  }
  function zeige(g, neu) {
    var wechsel = g !== geschoss;
    geschoss = g;
    layout();
    darstellen(wechsel || neu);
    if (wechsel) { auswahlRaum = null; markName = null; info.textContent = istGrundriss(g) ? HINWEIS : HINWEIS_SCHNITT; }
  }
  function setModus(m) {
    var an = m !== '3d';
    if (m === 'sch:frei' && !frei) return;
    if (!istGrundriss(m)) zeichnen = null;
    host.hidden = !an;
    shell.classList.toggle('modus2d', an);
    modusBtns.forEach(function (b) { var on = b.getAttribute('data-modus') === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var fb = document.getElementById('btnFrei');
    if (fb) fb.hidden = !frei;
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
    var name = el.getAttribute('data-name'), art = el.getAttribute('data-art'), out = [];
    if (!istGrundriss(geschoss)) return out;
    var p = plan(geschoss);
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
    aufmassMass(el);
    info.textContent = el.getAttribute('data-name') + ' · ' + mass(wert) + ' (' + fmt(wert, wert % 1 ? 1 : 0) + ' mm) · Herkunft: ' + HERKUNFT[q] +
      (el.getAttribute('data-fest') === '1' ? ' · gesperrt (Außenmaß)' : '') + (el.getAttribute('data-schraeg') ? ' · schräg gemessen' : '') + (el.getAttribute('data-abgeleitet') ? ' · abgeleitet, nicht änderbar' : '') + aufmassHinweis(el.getAttribute('data-name'));
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
  /* Schnittlinie legen: zwei Punkte im Grundriss (auf 10 mm gerastet, fast waagerechte oder senkrechte Linien rasten ein) */
  function rasten(p, a) {
    var x = Math.round(p.x / 10) * 10, z = Math.round(p.y / 10) * 10;
    if (a) { var dx = x - a[0], dz = z - a[1], t = Math.tan(3 * Math.PI / 180); if (Math.abs(dz) < t * Math.abs(dx)) z = a[1]; else if (Math.abs(dx) < t * Math.abs(dz)) x = a[0]; }
    return [x, z];
  }
  function schnittLegen(e) {
    var p = rasten(punkt(e.clientX, e.clientY), zeichnen.a);
    if (!zeichnen.a) {
      zeichnen.a = p;
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 90); c.setAttribute('class', 'hl'); c.setAttribute('style', 'fill:var(--pe);stroke:none');
      svg.appendChild(c);
      info.textContent = 'Schnittlinie: den zweiten Punkt anklicken. Der Blick geht nach links von der Laufrichtung.';
      return;
    }
    if (Math.hypot(p[0] - zeichnen.a[0], p[1] - zeichnen.a[1]) < 500) { info.textContent = 'Schnittlinie: die Punkte liegen zu dicht beieinander, bitte den zweiten Punkt weiter weg anklicken.'; return; }
    frei = freieLinie(zeichnen.a, p); zeichnen = null;
    host.classList.remove('zeichnet');
    setModus('sch:frei');
  }
  function klick(t, e) {
    if (zeichnen && e && istGrundriss(geschoss)) { schnittLegen(e); return; }
    if (!t || !t.closest) return;
    var m = t.closest('[data-name]'), g = t.closest('[data-marke]'), r = t.closest('[data-raum]'), sl = t.closest('[data-schnitt]'), w = t.closest('[data-wand]'), st = t.closest('[data-stufe]');
    if (m) waehleMass(m); else if (g) waehleMarke(g); else if (sl) setModus(modusVonSchnitt(sl.getAttribute('data-schnitt')));
    else if (r) waehleRaum(r.getAttribute('data-raum'));
    else if (st && st.getAttribute('data-stufe') && !istGrundriss(geschoss)) info.textContent = 'Stufe ' + st.getAttribute('data-stufe') + ' · ' + (st.querySelector('title') || {}).textContent;
    else if (w) info.textContent = 'Wand ' + w.getAttribute('data-wand');
  }
  var neuBtn = document.getElementById('sl-neu');
  if (neuBtn) neuBtn.addEventListener('click', function () {
    if (!istGrundriss(geschoss)) setModus('EG');
    zeichnen = { a: null }; host.classList.add('zeichnet');
    info.textContent = 'Schnittlinie: den ersten Punkt im Grundriss anklicken.';
  });

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
    if (start && !start.bewegt && e.type === 'pointerup') klick(start.ziel, e);
    if (!anzahl()) start = null;
  }
  host.addEventListener('pointerup', ende); host.addEventListener('pointercancel', ende);

  /* ---------- Probiermodus ---------- */
  function herunterladen(dateiname, text) { // im Artifact über die Fähigkeit „downloads“, sonst als Link; der Text steht in jedem Fall im Feld zum Kopieren
    if (window.claude && typeof window.claude.use === 'function') {
      return window.claude.use('downloads').then(function (d) { if (d) return d.save({ filename: dateiname, data: text }); throw new Error('keine Downloads'); });
    }
    return new Promise(function (ok) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = dateiname;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); ok();
    });
  }
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
      var speichern = function () { return herunterladen('aenderungen.json', text); };
      try { speichern().catch(function () { /* abgelehnt oder nicht möglich: der Text steht im Feld */ }); } catch (e) { /* dito */ }
    });
    probeAnzeigen();
  }

  /* ---------- Aufmaß ---------- */
  var am = { an: false, neu: [], mass: null }, amE = {};
  ['an', 'box', 'summe', 'liste', 'mass', 'wert', 'datum', 'notiz', 'ok', 'fehler', 'neu', 'export', 'reset', 'text'].forEach(function (k) { amE[k] = document.getElementById('am-' + k); });
  function heuteIso() { var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function aufmassAlle() { // Prüfmaße aus dem Repository und die in dieser Sitzung erfassten, gegen das gerade gezeigte Haus (auch im Probiermodus)
    var rep = PRUEFMASSE.masse || [], res = Aufmass.auswerten(daten(), { putz_cm: PRUEFMASSE.putz_cm, kante_cm: PRUEFMASSE.kante_cm, masse: rep.concat(am.neu) });
    res.zeilen.forEach(function (z, i) { z.neu = i >= rep.length; z.index = i - rep.length; });
    return res;
  }
  function cmText(mm, vorzeichen) { var t = fmt(mm / 10, 1); return (vorzeichen && mm > 0 ? '+' : '') + t; }
  function abweichungText(z) {
    if (z.status === 'unbekannt') return 'Maß im Modell nicht gefunden';
    var t = 'gemessen ' + cmText(z.gemessen) + ' · Modell ' + cmText(z.modell) + ' · Modell − Aufmaß ' + cmText(z.abweichung, true) + ' cm';
    if (z.status === 'auffaellig') t += ' · erwartet ' + cmText(z.erwartet[0], true) + ' … ' + cmText(z.erwartet[1], true);
    return t + (z.datum ? ' · ' + z.datum.split('-').reverse().join('.') : '');
  }
  function aufmassHinweis(name) { // Zusatz zur Infozeile eines angeklickten Maßes: letzte Messung dazu
    if (!MIT_AUFMASS) return '';
    var z = aufmassAlle().zeilen.filter(function (q) { return q.mass === name; }).pop();
    return z ? ' · Aufmaß: ' + abweichungText(z) + (z.status === 'auffaellig' ? ' (auffällig)' : z.status === 'ok' ? ' (im erwarteten Rahmen)' : '') : '';
  }
  function aufmassMarkieren() { // Maße mit Messung im Plan kennzeichnen (grün umrandet, bei auffälliger Abweichung gelb); danach Listen auffrischen
    if (!MIT_AUFMASS) return;
    var res = aufmassAlle(), stand = {};
    res.zeilen.forEach(function (z) { if (z.mass) stand[z.mass] = z; }); // spätere Messung desselben Maßes gilt
    if (svg) [].forEach.call(svg.querySelectorAll('.hit[data-name]'), function (h) {
      var z = stand[h.getAttribute('data-name')];
      h.classList.toggle('gem', !!z && z.status !== 'unbekannt');
      h.classList.toggle('abw', !!z && z.status === 'auffaellig');
    });
    aufmassListen(res);
  }
  function aufmassZeile(z, mitWeg) {
    var li = document.createElement('li'), t = document.createElement('button');
    li.className = z.status === 'auffaellig' ? 'auffaellig' : z.status === 'unbekannt' ? 'unbekannt' : z.status === 'ok' ? 'ok' : 'offen';
    t.type = 'button'; t.className = 'sprung';
    var b = document.createElement('b'), kl = document.createElement('small');
    b.textContent = z.was; kl.textContent = abweichungText(z) + (z.notiz ? ' · ' + z.notiz : '');
    t.appendChild(b); t.appendChild(kl);
    t.addEventListener('click', function () { aufmassSpringen(z); });
    li.appendChild(t);
    if (mitWeg) {
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'weg'; x.textContent = '×'; x.setAttribute('aria-label', 'Messung ' + z.was + ' entfernen');
      x.addEventListener('click', function () { am.neu.splice(z.index, 1); aufmassMarkieren(); });
      li.appendChild(x);
    }
    return li;
  }
  function aufmassListen(res) {
    var rep = res.zeilen.filter(function (z) { return !z.neu; }), neu = res.zeilen.filter(function (z) { return z.neu; });
    amE.summe.textContent = 'Prüfmaße im Repository: ' + rep.length + ', davon ' + rep.filter(function (z) { return z.status === 'auffaellig'; }).length + ' auffällig. ' + (neu.length ? neu.length + ' neu erfasst, noch nicht exportiert.' : '');
    amE.liste.innerHTML = '';
    rep.forEach(function (z) { amE.liste.appendChild(aufmassZeile(z, false)); });
    amE.neu.innerHTML = '';
    if (!neu.length) { var l0 = document.createElement('li'); l0.className = 'leer'; l0.textContent = 'Noch keine Messung erfasst.'; amE.neu.appendChild(l0); }
    neu.forEach(function (z) { amE.neu.appendChild(aufmassZeile(z, true)); });
    amE.export.disabled = !neu.length; amE.reset.disabled = !neu.length;
  }
  function aufmassSpringen(z) { // zur Messung im Plan: Maß anwählen, bei Raumprüfmaßen den Raum
    if (z.mass) {
      if (!z.geschoss) { info.textContent = z.was + ' (' + z.mass + '): ' + abweichungText(z) + ' – im Schnitt oder in der Ansicht anklicken.'; return; }
      if (z.geschoss !== geschoss) setModus(z.geschoss);
      var el = [].filter.call(svg.querySelectorAll('.hit[data-name]'), function (e) { return e.getAttribute('data-name') === z.mass; })[0];
      if (el) { waehleMass(el); var bb = el.getBBox(), r = box.getBoundingClientRect(), br = 6000, h = br * r.height / Math.max(1, r.width); vb = [bb.x + bb.width / 2 - br / 2, bb.y + bb.height / 2 - h / 2, br, h]; setVB(); }
    } else if (z.raum) { window.__plan2d.zeigeRaum(z.raum); info.textContent = z.was + ' · ' + abweichungText(z); }
  }
  function aufmassMass(el) { // ein Maß im Plan wurde angeklickt (Aufmaß erfassen)
    if (!MIT_AUFMASS || !am.an) return;
    var wert = Number(el.getAttribute('data-wert'));
    am.mass = { name: el.getAttribute('data-name'), wert: wert };
    amE.mass.textContent = am.mass.name + ' · Modell ' + mass(wert);
    amE.fehler.textContent = '';
    if (panel.classList.contains('closed')) { var tg = document.getElementById('togglePanel'); if (tg) tg.click(); } // das Eingabefeld liegt im Menü
    amE.mass.scrollIntoView({ block: 'nearest' });
    amE.wert.focus({ preventScroll: true }); amE.wert.select();
  }
  function aufmassEintragen() {
    if (!am.mass) { amE.fehler.textContent = 'Zuerst ein Maß im Plan anklicken.'; return; }
    var e;
    try {
      e = { mass: am.mass.name, cm: Aufmass.cmParsen(amE.wert.value), was: Aufmass.beschreibung(daten(), am.mass.name), datum: amE.datum.value || heuteIso() };
      if (amE.notiz.value.trim()) e.notiz = amE.notiz.value.trim();
      Aufmass.eintragPruefen(e, daten());
    } catch (x) { amE.fehler.textContent = x.message; return; }
    amE.fehler.textContent = '';
    am.neu = am.neu.filter(function (q) { return q.mass !== e.mass; }).concat([e]); // eine zweite Messung desselben Maßes ersetzt die erste
    markName = e.mass;
    aufmassMarkieren();
    var z = aufmassAlle().zeilen.filter(function (q) { return q.mass === e.mass; }).pop();
    info.textContent = 'Erfasst: ' + z.was + ' · ' + abweichungText(z) + (z.status === 'auffaellig' ? ' – auffällig' : '');
    am.mass = null; amE.mass.textContent = 'Kein Maß gewählt.'; amE.wert.value = ''; amE.notiz.value = '';
  }
  if (MIT_AUFMASS && amE.an) {
    amE.datum.value = heuteIso();
    amE.an.addEventListener('change', function () { am.an = amE.an.checked; amE.box.hidden = !am.an; if (!am.an) { am.mass = null; amE.fehler.textContent = ''; } });
    amE.ok.addEventListener('click', aufmassEintragen);
    amE.wert.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aufmassEintragen(); } });
    amE.reset.addEventListener('click', function () { am.neu = []; amE.text.hidden = true; amE.fehler.textContent = ''; aufmassMarkieren(); });
    amE.export.addEventListener('click', function () {
      var text;
      try { text = JSON.stringify(Aufmass.listeErzeugen(daten(), am.neu), null, 2) + '\n'; } catch (e) { amE.fehler.textContent = e.message; return; }
      amE.text.value = text; amE.text.hidden = false; amE.text.focus({ preventScroll: true }); amE.text.select();
      try { herunterladen('aufmass.json', text).catch(function () { /* abgelehnt oder nicht möglich: der Text steht im Feld */ }); } catch (e) { /* dito */ }
    });
  } else {
    var sec = document.getElementById('aufmass');
    if (sec) sec.hidden = true;
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
    aufmass: function () { return { an: am.an, neu: am.neu.slice(), res: MIT_AUFMASS ? aufmassAlle() : null }; },
    zeigeBefund: function (b) { // Befund aus der Liste: Geschoss wechseln, Stelle heranholen
      if (!b.ort) return;
      var g = b.geschoss || geschoss;
      if (g !== geschoss) setModus(g);
      var r = box.getBoundingClientRect(), breite = 6000, h = breite * r.height / Math.max(1, r.width);
      vb = [b.ort[0] - breite / 2, b.ort[1] - h / 2, breite, h]; setVB();
      info.textContent = (b.stufe === 'fehler' ? 'Fehler' : b.stufe === 'warnung' ? 'Warnung' : 'Hinweis') + ' · Regel ' + b.regel + ': ' + b.text;
    }
  };
  var h0 = (window.location.hash || '').toLowerCase(), HASH = { '#eg': 'EG', '#dg': 'DG', '#schnitt-a': 'sch:A', '#schnitt-b': 'sch:B', '#nord': 'an:N', '#ost': 'an:O', '#sued': 'an:S', '#west': 'an:W' };
  if (HASH[h0]) setModus(HASH[h0]);
})();
