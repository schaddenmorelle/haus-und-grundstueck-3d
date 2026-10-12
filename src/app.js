(function () {
  'use strict';
  var app = document.getElementById('app'), canvas = document.getElementById('gl');
  var panel = document.getElementById('panel');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    document.getElementById('fallback').hidden = false;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var model = buildModel(THREE, HAUS);
  scene.add(model.root);

  function fmt(n, d) { return n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /* ---------- Licht und Theme ---------- */
  var hemi = new THREE.HemisphereLight(0xffffff, 0x8c8f96, 0.85);
  var sun = new THREE.DirectionalLight(0xfff1dc, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  var sc = sun.shadow.camera;
  sc.left = -27; sc.right = 27; sc.top = 27; sc.bottom = -27; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  sun.target.position.set(11, 0, 13);
  scene.add(hemi, sun, sun.target);
  function setSun(bearing) {
    var d = model.sunDir(bearing, 34);
    sun.position.copy(sun.target.position).addScaledVector(d, 80);
  }
  function applyTheme() {
    var c = new THREE.Color(cssVar('--scene') || '#dfe6ea');
    scene.background = c;
    scene.fog = new THREE.Fog(c, 140, 360);
    var dark = cssVar('--dark') === '1';
    hemi.intensity = dark ? 0.6 : 0.85;
    sun.intensity = dark ? 0.8 : 1.0;
  }
  applyTheme();
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- Bodentextur aus den Planflächen ---------- */
  function paintTerrain() {
    var B = model.bounds, ppm = 36, W = Math.round((B.x1 - B.x0) * ppm), Hh = Math.round((B.z1 - B.z0) * ppm);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    var c = cv.getContext('2d'), Z = model.zones;
    function P(p) { return [(p[0] - B.x0) * ppm, (p[1] - B.z0) * ppm]; }
    function path(pts) { c.beginPath(); pts.forEach(function (p, i) { var q = P(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }
    function fill(pts, col) { path(pts); c.fillStyle = col; c.fill(); }
    function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
    function speckle(pts, cols, n, seed) {
      var r = rnd(seed); c.save(); path(pts); c.clip();
      for (var i = 0; i < n; i++) { c.fillStyle = cols[Math.floor(r() * cols.length)]; c.fillRect(r() * W, r() * Hh, 2, 2); }
      c.restore();
    }
    function joints(pts, stepX, stepZ, col) {
      c.save(); path(pts); c.clip(); c.strokeStyle = col; c.lineWidth = 1; c.beginPath();
      for (var x = Math.floor(B.x0); x < B.x1; x += stepX) { var q = (x - B.x0) * ppm; c.moveTo(q, 0); c.lineTo(q, Hh); }
      for (var z = Math.floor(B.z0); z < B.z1; z += stepZ) { var q2 = (z - B.z0) * ppm; c.moveTo(0, q2); c.lineTo(W, q2); }
      c.stroke(); c.restore();
    }
    c.fillStyle = '#62666b'; c.fillRect(0, 0, W, Hh);
    fill(Z.neighbor, '#97a48d');
    speckle(Z.neighbor, ['#8a9981', '#a4b09a', '#929f88'], 14000, 11);
    fill(Z.plot, '#6c9a4c');
    speckle(Z.plot, ['#5f8d42', '#7aa857', '#689848', '#82b05d'], 26000, 7);
    // Mulchstreifen am Südost-Rand
    c.save(); path(Z.plot); c.clip();
    c.strokeStyle = '#6a5a3e'; c.lineWidth = 0.9 * ppm; c.lineJoin = 'round'; c.beginPath();
    Z.mulch.forEach(function (p, i) { var q = P(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
    c.stroke(); c.restore();
    // Pflaster Hof und Zufahrt
    fill(Z.paving, '#b4b4af'); joints(Z.paving, 0.5, 0.25, 'rgba(70,70,70,0.20)');
    fill(Z.pavingWest, '#c3c3be'); joints(Z.pavingWest, 0.5, 0.25, 'rgba(70,70,70,0.20)');
    fill(Z.carport, '#a9aaa6'); joints(Z.carport, 1, 1, 'rgba(70,70,70,0.14)');
    fill(Z.terrace, '#6b6e73'); joints(Z.terrace, 0.45, 0.45, 'rgba(255,255,255,0.12)');
    fill(Z.poolSlab, '#3b6a38');
    // Beet
    var b = Z.bed, bc = P(b.c), bw = b.w * ppm, bh = b.h * ppm, rr = 0.7 * ppm;
    c.save(); c.translate(bc[0], bc[1]); c.rotate(b.rot * Math.PI / 180);
    c.beginPath(); c.moveTo(-bw / 2 + rr, -bh / 2); c.lineTo(bw / 2 - rr, -bh / 2); c.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, -bh / 2 + rr);
    c.lineTo(bw / 2, bh / 2 - rr); c.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - rr, bh / 2); c.lineTo(-bw / 2 + rr, bh / 2);
    c.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, bh / 2 - rr); c.lineTo(-bw / 2, -bh / 2 + rr); c.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + rr, -bh / 2); c.closePath();
    c.fillStyle = '#6b5339'; c.fill(); c.restore();
    // Grundstücksgrenze (strichpunktiert)
    path(Z.plot); c.setLineDash([16, 6, 3, 6]); c.lineWidth = 2; c.strokeStyle = '#1b1b1b'; c.stroke(); c.setLineDash([]);
    var tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    model.terrain.material.map = tex;
    model.terrain.material.color.set(0xffffff);
    model.terrain.material.needsUpdate = true;
  }
  paintTerrain();

  /* ---------- Kamera ---------- */
  var camera = new THREE.PerspectiveCamera(42, 1, 0.2, 700);
  var controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 3; controls.maxDistance = 120;
  var VIEWS = {
    sw: { pos: [-20, 26, 46], tgt: [11, 1, 13] },
    ne: { pos: [44, 26, -16], tgt: [11, 1, 13] },
    plan: { pos: [11, 80, 13.6], tgt: [11, 0, 13] },
    inside: { pos: [-1, 31, 41], tgt: [10, 0.8, 14] },
    dg: { pos: [-4, 27, 38], tgt: [11, 3.4, 13] },
    frame: { pos: [-10, 24, 40], tgt: [10, 4, 13] }
  };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tween = null;
  function fit(pos, tgt) {
    var t = new THREE.Vector3(tgt[0], tgt[1], tgt[2]), p = new THREE.Vector3(pos[0], pos[1], pos[2]);
    var f = camera.aspect < 0.8 ? 1.55 : camera.aspect < 1.2 ? 1.2 : 1;
    return { p: t.clone().add(p.sub(t).multiplyScalar(f)), t: t };
  }
  function flyTo(pos, tgt, ms) {
    var d = fit(pos, tgt);
    if (reduce || ms === 0) { camera.position.copy(d.p); controls.target.copy(d.t); tween = null; controls.update(); return; }
    tween = { start: performance.now(), ms: ms || 850, p0: camera.position.clone(), q0: controls.target.clone(), p1: d.p, q1: d.t };
  }
  function stepTween(now) {
    if (!tween) return;
    var k = Math.min(1, (now - tween.start) / tween.ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, e);
    controls.target.lerpVectors(tween.q0, tween.q1, e);
    if (k >= 1) tween = null;
  }
  canvas.addEventListener('pointerdown', function () { tween = null; });

  function resize() {
    var w = app.clientWidth, h = app.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyOffset();
  }
  function applyOffset() {
    var w = app.clientWidth, h = app.clientHeight;
    if (!w || !h) return;
    if (panel && !panel.classList.contains('closed') && w > 760) camera.setViewOffset(w, h, -(Math.min(340, w - 24) + 24) / 2, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(app); else window.addEventListener('resize', resize);
  resize();

  /* ---------- Zustand und Bedienung ---------- */
  var state = { roof: true, rafters: false, dg: false, rooms: false, heights: false, dims: false, garden: true };
  var boxes = { roof: document.getElementById('t-roof'), rafters: document.getElementById('t-rafters'), dg: document.getElementById('t-dg'), rooms: document.getElementById('t-rooms'), heights: document.getElementById('t-heights'), dims: document.getElementById('t-dims'), garden: document.getElementById('t-garden') };
  function applyState() {
    model.groups.roof.visible = state.roof;
    model.groups.rafters.visible = state.rafters;
    model.groups.dg.visible = state.dg;
    model.groups.garden.visible = state.garden;
    Object.keys(boxes).forEach(function (k) { boxes[k].checked = state[k]; });
  }
  Object.keys(boxes).forEach(function (k) {
    boxes[k].addEventListener('change', function () {
      state[k] = boxes[k].checked;
      if ((k === 'rafters' && state.rafters)) state.roof = false;
      if (k === 'roof' && state.roof) { state.rafters = false; }
      applyState();
    });
  });
  var viewBtns = [].slice.call(document.querySelectorAll('[data-view]'));
  function setView(name, ms) {
    var v = VIEWS[name];
    viewBtns.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === name); b.setAttribute('aria-pressed', b.getAttribute('data-view') === name ? 'true' : 'false'); });
    var S = { roof: true, rafters: false, dg: false, rooms: false };
    if (name === 'inside') S = { roof: false, rafters: false, dg: false, rooms: true };
    else if (name === 'dg') S = { roof: false, rafters: false, dg: true, rooms: true };
    else if (name === 'frame') S = { roof: false, rafters: true, dg: false, rooms: false };
    Object.keys(S).forEach(function (k) { state[k] = S[k]; });
    applyState();
    flyTo(v.pos, v.tgt, ms);
  }
  viewBtns.forEach(function (b) { b.addEventListener('click', function () { selectRoom(null); setView(b.getAttribute('data-view')); }); });

  var sunSlider = document.getElementById('sun'), sunOut = document.getElementById('sunOut');
  var COMP = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function onSun() {
    var b = parseFloat(sunSlider.value);
    sunOut.textContent = Math.round(b) + '° (' + COMP[Math.round(b / 22.5) % 16] + ')';
    setSun(b);
  }
  sunSlider.addEventListener('input', onSun); onSun();

  var pbtn = document.getElementById('togglePanel');
  function setPanel(open) { panel.classList.toggle('closed', !open); pbtn.setAttribute('aria-expanded', open ? 'true' : 'false'); applyOffset(); }
  pbtn.addEventListener('click', function () { setPanel(panel.classList.contains('closed')); });
  setPanel(window.innerWidth > 760);

  /* ---------- Räume ---------- */
  var list = document.getElementById('rooms'), selected = null;
  function baueRaumliste() {
    list.innerHTML = ''; selected = null;
    model.rooms.forEach(function (r) {
      var li = document.createElement('li'), btn = document.createElement('button');
      btn.type = 'button'; btn.dataset.id = r.id;
      var n = document.createElement('span'); n.textContent = r.name;
      var a = document.createElement('span'); a.className = 'num'; a.textContent = fmt(r.area, 1) + ' m²';
      btn.appendChild(n); btn.appendChild(a); li.appendChild(btn); list.appendChild(li);
      btn.addEventListener('click', function () { selectRoom(selected === r.id ? null : r.id, true); });
    });
  }
  baueRaumliste();
  function selectRoom(id, fly) {
    if (id && window.__plan2d && window.__plan2d.aktiv()) { selected = id; window.__plan2d.zeigeRaum(id); return; } // im Grundriss: Raum dort auswählen
    selected = id;
    model.rooms.forEach(function (r) {
      var on = r.id === id;
      if (r.mesh.material && r.mesh.material.emissive) { r.mesh.material.emissive.set(on ? 0x2f5fd0 : 0x000000); r.mesh.material.emissiveIntensity = on ? 0.3 : 0; }
    });
    [].forEach.call(list.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.id === id); });
    if (id && fly) {
      var r = model.rooms.filter(function (q) { return q.id === id; })[0];
      state.roof = false; state.rafters = false; state.rooms = true; state.dg = r.level === 'dg'; applyState();
      viewBtns.forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
      var cx = r.center[0], cz = r.center[1], y = r.level === 'dg' ? model.levels.dg : model.levels.eg;
      var k = Math.max(1, Math.sqrt(r.area) / 4.5);
      flyTo([cx - 6 * k, y + 12 * k, cz + 11 * k], [cx, y, cz], 800);
    }
  }

  /* ---------- Wohnfläche (src/wohnflaeche.js) ---------- */
  var wfTab = document.getElementById('wohnfl'), wfNote = document.getElementById('wohnflNote');
  function m2(v) { return fmt(v / 1e6, 2); }
  function wfZeile(tab, zellen, klasse) {
    var tr = document.createElement('tr');
    if (klasse) tr.className = klasse;
    zellen.forEach(function (z) {
      var td = document.createElement('td');
      td.textContent = z.t;
      if (z.leer) td.className = 'leer';
      if (z.span) td.colSpan = z.span;
      tr.appendChild(td);
    });
    tab.appendChild(tr);
  }
  function baueWohnflaeche() {
    var w = model.wohnflaeche, kopf = document.createElement('thead'), tr = document.createElement('tr');
    wfTab.innerHTML = '';
    ['Raum', 'Grundfl. m²', 'Abzug m²', '1–2 m hoch m²', 'Wohnfl. m²'].forEach(function (t) { var th = document.createElement('th'); th.scope = 'col'; th.textContent = t; tr.appendChild(th); });
    kopf.appendChild(tr); wfTab.appendChild(kopf);
    var body = document.createElement('tbody');
    wfTab.appendChild(body);
    ['EG', 'DG'].forEach(function (g) {
      if (!w.geschosse[g]) return;
      w.raeume.filter(function (r) { return r.geschoss === g; }).forEach(function (r) {
        var ab = r.abzuege.kamin + r.abzuege.treppe;
        wfZeile(body, [{ t: r.name + (r.zubehoer ? ' (Zubehör)' : '') }, { t: m2(r.grundflaeche) }, { t: ab ? m2(ab) : '–', leer: !ab }, { t: r.zonen.halb ? m2(r.zonen.halb) : '–', leer: !r.zonen.halb }, { t: m2(r.wohnflaeche) }]);
      });
      wfZeile(body, [{ t: 'Summe ' + g }, { t: m2(w.geschosse[g].grundflaeche) }, { t: '' }, { t: '' }, { t: m2(w.geschosse[g].wohnflaeche) }], 'gs');
    });
    wfZeile(body, [{ t: 'Wohnfläche gesamt' }, { t: m2(w.summe.grundflaeche) }, { t: '' }, { t: '' }, { t: m2(w.summe.wohnflaeche) }], 'sum');
    wfNote.textContent = 'Nach der Wohnflächenverordnung (WoFlV): Die Maße sind Rohbaumaße, daher ' + fmt(w.putzabzug * 100, 0) + ' % Putzabzug. Im Dachausbau zählt die Fläche mit mehr als 2 m Raumhöhe voll, zwischen 1 und 2 m zur Hälfte, darunter gar nicht (Raumhöhe = Dachhaut minus 22 cm Sparren). Abgezogen sind der Kamin und die Treppe. Die Terrasse ist nicht angerechnet.';
  }
  baueWohnflaeche();

  /* ---------- Prüfung (Befunde aus src/pruefen.js) ---------- */
  var befList = document.getElementById('befunde'), befSumme = document.getElementById('befundSumme');
  var STUFE = { fehler: 'Fehler', warnung: 'Warnung', hinweis: 'Hinweis' };
  function anz(n, eins, viele) { return n + ' ' + (n === 1 ? eins : viele); }
  function baueBefunde() {
    var zaehl = { fehler: 0, warnung: 0, hinweis: 0 };
    befList.innerHTML = '';
    model.befunde.forEach(function (b) {
      zaehl[b.stufe]++;
      var li = document.createElement('li'), btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'bef ' + b.stufe;
      var k = document.createElement('b'); k.textContent = STUFE[b.stufe] + ' · Regel ' + b.regel;
      var t = document.createElement('span'); t.textContent = b.text;
      btn.appendChild(k); btn.appendChild(t); li.appendChild(btn); befList.appendChild(li);
      btn.disabled = !b.ort;
      btn.addEventListener('click', function () {
        if (!b.ort) return;
        if (window.__plan2d && window.__plan2d.aktiv()) { window.__plan2d.zeigeBefund(b); return; }
        var q = model.toWorld(b.ort[0] / 1000, b.ort[1] / 1000), dg = b.geschoss === 'DG', y = dg ? model.levels.dg : model.levels.eg;
        state.roof = false; state.rafters = false; state.rooms = true; state.dg = dg; applyState();
        viewBtns.forEach(function (v) { v.classList.remove('on'); v.setAttribute('aria-pressed', 'false'); });
        flyTo([q[0] - 3, y + 6, q[1] + 5], [q[0], y, q[1]], 800);
      });
    });
    befSumme.textContent = model.befunde.length ? anz(zaehl.fehler, 'Fehler', 'Fehler') + ', ' + anz(zaehl.warnung, 'Warnung', 'Warnungen') + ', ' + anz(zaehl.hinweis, 'Hinweis', 'Hinweise') : 'Keine Befunde: Wände, Räume, Öffnungen, Höhen und Dachausbau sind stimmig.';
  }
  baueBefunde();

  /* ---------- Beschriftungen ---------- */
  var tagBox = document.getElementById('tags'), tagEls = [];
  function baueTags() {
    tagBox.innerHTML = ''; tagEls = [];
    model.tags.forEach(function (t) {
      var d = document.createElement('div');
      d.className = 'tag ' + t.kind;
      if (t.kind === 'room') {
        var b = document.createElement('b'); b.textContent = t.name;
        var s = document.createElement('span'); s.textContent = fmt(t.area, 1) + ' m²';
        d.appendChild(b); d.appendChild(s);
      } else d.textContent = t.text;
      d.style.display = 'none';
      tagBox.appendChild(d);
      tagEls.push({ el: d, t: t, v: new THREE.Vector3(t.pos[0], t.pos[1], t.pos[2]) });
    });
  }
  baueTags();
  var tmp = new THREE.Vector3();
  function updateTags() {
    var w = app.clientWidth, h = app.clientHeight;
    tagEls.forEach(function (o) {
      var on = state[o.t.layer];
      if (on && o.t.level === 'eg') on = !state.roof && !state.dg;
      if (on && o.t.level === 'dg') on = state.dg && !state.roof;
      if (!on) { if (o.el.style.display !== 'none') o.el.style.display = 'none'; return; }
      tmp.copy(o.v).project(camera);
      if (tmp.z > 1 || Math.abs(tmp.x) > 1.08 || Math.abs(tmp.y) > 1.08) { o.el.style.display = 'none'; return; }
      o.el.style.display = '';
      o.el.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-tmp.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,-50%)';
    });
    if (meas.tag.visible) {
      tmp.copy(meas.tag.pos).project(camera);
      meas.tag.el.style.display = tmp.z > 1 ? 'none' : '';
      meas.tag.el.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-tmp.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,-130%)';
    }
  }

  /* ---------- Kompass ---------- */
  var needle = document.getElementById('needle');
  var nrad = model.north * Math.PI / 180, nvec = [Math.sin(nrad), -Math.cos(nrad)];
  function updateCompass() {
    var fx = controls.target.x - camera.position.x, fz = controls.target.z - camera.position.z, L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    var rx = -fz, rz = fx;
    var ang = Math.atan2(nvec[0] * rx + nvec[1] * rz, nvec[0] * fx + nvec[1] * fz) * 180 / Math.PI;
    needle.setAttribute('transform', 'rotate(' + ang.toFixed(1) + ' 30 30)');
  }

  /* ---------- Messen ---------- */
  var meas = { on: false, pts: [], objs: [], tag: { el: document.getElementById('measTag'), pos: new THREE.Vector3(), visible: false } };
  var readout = document.getElementById('readout'), measBtn = document.getElementById('measure'), measClr = document.getElementById('measureClear');
  var ray = new THREE.Raycaster();
  function deepVisible(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
  var markMat = new THREE.MeshBasicMaterial({ color: 0xc8321e, depthTest: false }), lineMat = new THREE.LineBasicMaterial({ color: 0xc8321e, depthTest: false });
  function clearMeasure() {
    meas.objs.forEach(function (o) { scene.remove(o); });
    meas.objs = []; meas.pts = []; meas.tag.visible = false; meas.tag.el.style.display = 'none';
    readout.textContent = meas.on ? 'Messen: Zwei Punkte im Modell anklicken.' : '';
  }
  measBtn.addEventListener('click', function () {
    meas.on = !meas.on;
    measBtn.setAttribute('aria-pressed', meas.on ? 'true' : 'false');
    measBtn.classList.toggle('on', meas.on);
    canvas.style.cursor = meas.on ? 'crosshair' : '';
    clearMeasure();
  });
  measClr.addEventListener('click', clearMeasure);
  var down = null;
  canvas.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', function (e) {
    if (!meas.on || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    var r = canvas.getBoundingClientRect();
    var ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(model.pickables, false).filter(function (h) { return deepVisible(h.object); });
    if (!hits.length) return;
    if (meas.pts.length >= 2) clearMeasure();
    var p = hits[0].point.clone();
    meas.pts.push(p);
    var s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), markMat); s.position.copy(p); s.renderOrder = 10; scene.add(s); meas.objs.push(s);
    if (meas.pts.length === 2) {
      var g = new THREE.BufferGeometry().setFromPoints(meas.pts);
      var ln = new THREE.Line(g, lineMat); ln.renderOrder = 10; scene.add(ln); meas.objs.push(ln);
      var a = meas.pts[0], b = meas.pts[1], dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
      var d3 = a.distanceTo(b), dh = Math.hypot(dx, dz);
      var txt = fmt(d3, 2) + ' m';
      readout.textContent = 'Abstand ' + txt + ' · waagerecht ' + fmt(dh, 2) + ' m · Höhenunterschied ' + fmt(Math.abs(dy), 2) + ' m';
      meas.tag.el.textContent = txt; meas.tag.pos.copy(a).add(b).multiplyScalar(0.5); meas.tag.visible = true;
    } else readout.textContent = 'Erster Punkt gesetzt. Zweiten Punkt anklicken.';
  });

  /* ---------- Kennzahlen ---------- */
  function setzeKennzahlen() {
    var I = model.info;
    document.getElementById('k-plot').textContent = fmt(I.plotArea, 0) + ' m²';
    document.getElementById('k-foot').textContent = fmt(I.footArea, 0) + ' m²';
    document.getElementById('k-ridge').textContent = fmt(model.H.RIDGE, 2) + ' m (+' + fmt(I.ridgeAbove, 2) + ' m)';
    document.getElementById('k-eave').textContent = fmt(model.H.EAVE, 2) + ' m (+' + fmt(I.eaveAbove, 2) + ' m)';
    document.getElementById('k-pitch').textContent = fmt(I.pitchDeg, 1) + '°';
  }
  setzeKennzahlen();

  /* ---------- Neuaufbau mit geänderten Daten (Probiermodus) ----------
     Das Modell entsteht komplett neu (Gelände und Außenanlagen hängen an derselben Berechnung); die alten Geometrien, Materialien und Texturen
     werden freigegeben, Ebenen, Kamera und Sonne bleiben. Aufgerufen vom Grundriss (src/plan2d.js), wenn zu 3D zurückgeschaltet wird. */
  function freeModel(root) {
    root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      var m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach(function (x) { if (x.map) x.map.dispose(); x.dispose(); });
    });
  }
  var gebaut = HAUS;
  function neuAufbauen(haus) {
    var t0 = performance.now(), neu = buildModel(THREE, haus); // wirft bei unbrauchbaren Daten, das alte Modell bleibt dann stehen
    selectRoom(null); clearMeasure();
    scene.remove(model.root); freeModel(model.root);
    model = neu; scene.add(model.root); gebaut = haus;
    paintTerrain(); applyState(); baueRaumliste(); baueWohnflaeche(); baueBefunde(); baueTags(); setzeKennzahlen();
    return performance.now() - t0;
  }

  /* ---------- Schleife ---------- */
  window.__m3d = { camera: camera, controls: controls, neuAufbauen: neuAufbauen, haus: function () { return gebaut; }, modell: function () { return model; }, speicher: function () { return renderer.info.memory; } };
  setView('sw', 0);
  var shell = document.getElementById('shell');
  function frame(now) {
    if (!shell.classList.contains('modus2d')) { // im Grundriss ruht das 3D-Bild
      stepTween(now);
      controls.update();
      renderer.render(scene, camera);
      updateTags();
      updateCompass();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
