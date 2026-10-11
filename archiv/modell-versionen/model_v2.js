/* Modell: baut Grundstück, Gelände, Haus, Räume, Dach und Außenanlagen.
   Koordinaten: x = Plan nach rechts, z = Plan nach unten (Meter), y = Höhe über 142,00 m ü. NN.
   Ursprung: nordwestliche Grundstücksecke des Lageplans. */
function buildModel(THREE) {
  var DATUM = 142.0, NORTH = 26;
  var BOUNDS = { x0: -10, x1: 36, z0: -11, z1: 39 };
  var H = { FFB: 142.80, EAVE: 145.77, RIDGE: 149.08 };
  var PLOT = [[0, 0], [3.85, -0.25], [25.77, 2.975], [19.38, 23.805], [15.57, 26.795], [0, 26.795]];
  var EDGE_TXT = ['3,85', '22,25', '21,78', '4,84', '15,57', '26,80'];
  var F = { x0: 3.05, x1: 16.0, xn: 6.55, z0: 5.74, zn: 12.52, z1: 20.395 };
  var TE = 0.365, TI = 0.24, TL = 0.12, CEIL = 2.60, OVER = 0.5, RUN = 4.75;
  var TAN = (H.RIDGE - H.EAVE) / RUN;

  function Y(e) { return e - DATUM; }
  /* Pixel des Grundrissplans -> Meter (stückweise, an den Absteckmaßen verankert) */
  function pmx(px) { return px <= 608 ? F.x0 + (px - 420.5) * (3.5 / 187.5) : F.xn + (px - 608) * (9.45 / 494.5); }
  function pmz(py) { return py <= 851 ? F.z0 + (py - 509) * (6.78 / 342) : F.zn + (py - 851) * (7.875 / 426); }
  function pm(px, py) { return [pmx(px), pmz(py)]; }
  /* Pixel des Lageplan-Bildes -> Meter */
  function pl(px, py) { return [(px - 265) / 51.9, (py - 214) / 51.9]; }

  var root = new THREE.Group();
  var gHouse = new THREE.Group(), gInner = new THREE.Group(), gDG = new THREE.Group(), gRaf = new THREE.Group(), gRoof = new THREE.Group(), gGarden = new THREE.Group(), gTerrain = new THREE.Group(), gMarks = new THREE.Group();
  root.add(gTerrain, gHouse, gInner, gDG, gRaf, gRoof, gGarden, gMarks);
  var pickables = [];
  var tags = [];

  function M(color, rough, metal, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough == null ? 0.9 : rough, metalness: metal || 0 }, extra || {}));
  }
  var mat = {
    plaster: M(0xece8df, 0.95), plasterIn: M(0xf5f3ee, 0.95), slab: M(0xaaa8a1, 0.95),
    roof: M(0x3a3f48, 0.8, 0, { side: THREE.DoubleSide, flatShading: true }),
    glass: M(0x9ec7dc, 0.1, 0, { transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false }),
    door: M(0x2b2e34, 0.6), frame: M(0x2f333a, 0.5), concrete: M(0xc3c2bc, 0.95),
    carportRoof: M(0x93a09d, 0.7, 0.2), carportWall: M(0xd9d6cc, 0.95), wood: M(0xb48a5c, 0.8),
    metal: M(0x6b7178, 0.5, 0.5), hedge: M(0x2f5a33, 1), trunk: M(0x6b4a2f, 1), crown: M(0x4f7d3a, 1),
    crown2: M(0x6a9547, 1), water: M(0x4fc3d8, 0.1, 0, { transparent: true, opacity: 0.8 }), poolwall: M(0x7fa7cf, 0.6, 0, { side: THREE.DoubleSide }),
    bin1: M(0x2a2c30, 0.8), bin2: M(0xe0b52b, 0.8), stone: M(0xf2f0ea, 0.9), stoneTop: M(0xc8321e, 0.8),
    retain: M(0xb4b3ad, 0.95), step: M(0x9c9a94, 0.95), timber: M(0xc9a27a, 0.8)
  };
  mat.insul = M(0xcfd0cb, 0.95, 0, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  if (typeof document !== 'undefined') {
    var hc = document.createElement('canvas'); hc.width = hc.height = 128;
    var hg = hc.getContext('2d'); hg.fillStyle = '#d3d4cf'; hg.fillRect(0, 0, 128, 128);
    hg.strokeStyle = '#7a7e82'; hg.lineWidth = 3; hg.beginPath();
    for (var hi = -128; hi < 256; hi += 32) { hg.moveTo(hi, 0); hg.lineTo(hi + 128, 128); hg.moveTo(hi, 128); hg.lineTo(hi + 128, 0); }
    hg.stroke();
    var ht = new THREE.CanvasTexture(hc); ht.wrapS = ht.wrapT = THREE.RepeatWrapping; ht.repeat.set(1, 1);
    mat.insul.map = ht;
  }

  function mesh(geo, m, shadow, parent, pick) {
    var o = new THREE.Mesh(geo, m);
    if (shadow !== false) { o.castShadow = true; o.receiveShadow = true; }
    if (parent) parent.add(o);
    if (pick) pickables.push(o);
    return o;
  }
  function boxAt(w, h, d, m, x, yc, z, parent, ry) {
    var o = mesh(new THREE.BoxGeometry(w, h, d), m, true, parent, true);
    o.position.set(x, yc, z);
    if (ry) o.rotation.y = ry;
    return o;
  }

  /* ---------- Wandbauer mit Öffnungen ---------- */
  function wall(a, b, t, y0, y1, opens, parent, ext, m) {
    var dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ang = -Math.atan2(dz, dx);
    ext = ext || 0;
    var A = [a[0] - ux * ext, a[1] - uz * ext], Lt = L + 2 * ext;
    function piece(s0, s1, ya, yb, mm) {
      if (s1 - s0 < 1e-3 || yb - ya < 1e-3) return null;
      var c = (s0 + s1) / 2;
      var o = mesh(new THREE.BoxGeometry(s1 - s0, yb - ya, t), mm || m, true, parent, true);
      o.position.set(A[0] + ux * c, (ya + yb) / 2, A[1] + uz * c);
      o.rotation.y = ang;
      return o;
    }
    var list = (opens || []).slice().sort(function (p, q) { return p.a - q.a; });
    var cur = 0;
    list.forEach(function (o) {
      var oa = o.a + ext, ob = o.b + ext;
      piece(cur, oa, y0, y1);
      if (o.sill > 0) piece(oa, ob, y0, y0 + o.sill);
      if (y0 + o.head < y1) piece(oa, ob, y0 + o.head, y1);
      var w = ob - oa, hh = o.head - o.sill, c = (oa + ob) / 2;
      var cx = A[0] + ux * c, cz = A[1] + uz * c, cy = y0 + o.sill + hh / 2;
      if (o.type === 'glass') {
        var g = mesh(new THREE.BoxGeometry(w, hh, 0.04), mat.glass, false, parent, false);
        g.position.set(cx, cy, cz); g.rotation.y = ang;
        var fr = 0.06;
        [[w, fr, 0, hh / 2 - fr / 2], [w, fr, 0, -hh / 2 + fr / 2]].forEach(function (s) {
          var f = mesh(new THREE.BoxGeometry(s[0], s[1], 0.08), mat.frame, true, parent, false);
          f.position.set(cx, cy + s[3], cz); f.rotation.y = ang;
        });
        var np = o.parts || (w >= 2.8 ? 3 : (w >= 1.4 ? 2 : 1)), offs = [-w / 2 + fr / 2, w / 2 - fr / 2];
        for (var k = 1; k < np; k++) offs.push(-w / 2 + k * w / np);
        offs.forEach(function (off) {
          var f = mesh(new THREE.BoxGeometry(fr, hh, 0.08), mat.frame, true, parent, false);
          f.position.set(cx + ux * off, cy, cz + uz * off); f.rotation.y = ang;
        });
      } else if (o.type === 'door') {
        var d = mesh(new THREE.BoxGeometry(w, hh, 0.06), mat.door, true, parent, true);
        d.position.set(cx, cy, cz); d.rotation.y = ang;
      }
      cur = ob;
    });
    piece(cur, Lt, y0, y1);
  }

  /* ---------- Gelände ---------- */
  var GP = [ // geplantes Gelände im Grundstück (teils Annahme, siehe Hinweise)
    [0.3, 0.3, 142.25], [3.85, -0.2, 142.25], [8, 0.7, 142.25], [13.6, 1.4, 142.25], [19.7, 2.1, 142.05], [25.5, 3.0, 141.95],
    [0.3, 3.7, 142.25], [0.3, 11.1, 142.45], [0.3, 17.4, 142.65], [0.3, 21.2, 142.75], [0.3, 26.4, 142.8],
    [8, 26.3, 142.55], [15.5, 26.3, 142.4], [19.4, 23.7, 142.3], [22.5, 16, 142.1], [24, 9, 142.0],
    [10, 3.5, 142.3], [16, 3.5, 142.3], [21, 6, 142.1], [19.5, 12, 142.2], [19, 19, 142.35],
    [6, 5.3, 142.35], [10, 5.3, 142.35], [15, 5.3, 142.35], [17.2, 8, 142.4], [17.2, 14, 142.5], [17.2, 19, 142.6],
    [8, 21.2, 142.62], [12, 21.2, 142.62], [15, 21.2, 142.6], [2, 8, 142.4], [1.5, 14, 142.55], [1.5, 20, 142.65],
    [4.8, 13.5, 142.6], [4.8, 19.5, 142.62], [12.9, 24.2, 142.62], [5, 24.5, 142.65], [9, 24.5, 142.62]
  ];
  var EP = [ // vorhandenes Gelände außerhalb (Höhenpunkte aus Lageplan)
    [0, -0.3, 141.38], [15.4, 0.8, 141.69], [17.7, 1.4, 141.74], [24.7, 2.6, 141.79], [8, -4, 141.45], [20, -4, 141.7], [30, -2, 141.8],
    [-0.5, 5.4, 141.46], [-0.8, 8.7, 141.51], [-0.8, 12.4, 141.65], [-0.8, 15.6, 141.78], [-0.8, 18.8, 141.92], [-0.8, 22.8, 142.05], [-0.8, 26.1, 142.18],
    [-8, 10, 141.6], [-8, 22, 142.1], [-8, -2, 141.4],
    [0, 28.5, 142.2], [8, 28.8, 142.25], [16, 28.5, 142.33], [26, 28, 142.35],
    [28, 6, 141.85], [27, 14, 142.0], [24.5, 20, 142.3], [22, 26, 142.35], [32, 12, 141.95], [32, 3, 141.8]
  ];
  function idw(pts, x, z) {
    var sw = 0, sv = 0;
    for (var i = 0; i < pts.length; i++) {
      var dx = x - pts[i][0], dz = z - pts[i][1], d2 = dx * dx + dz * dz;
      if (d2 < 1e-6) return pts[i][2];
      var w = 1 / d2; sw += w; sv += w * pts[i][2];
    }
    return sv / sw;
  }
  function polyInfo(x, z) {
    var n = PLOT.length, best = 1e9, bi = 0, inside = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var a = PLOT[j], b = PLOT[i];
      if (((b[1] > z) !== (a[1] > z)) && (x < (a[0] - b[0]) * (z - b[1]) / (a[1] - b[1]) + b[0])) inside = !inside;
    }
    for (var k = 0; k < n; k++) {
      var p = PLOT[k], q = PLOT[(k + 1) % n];
      var vx = q[0] - p[0], vz = q[1] - p[1], wx = x - p[0], wz = z - p[1];
      var t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz)));
      var dd = Math.hypot(wx - t * vx, wz - t * vz);
      if (dd < best) { best = dd; bi = k; }
    }
    return { d: inside ? -best : best, edge: bi };
  }
  var BLEND = [0.3, 0.3, 2.5, 2.5, 1.5, 0.3];
  function sm(t) { return t * t * (3 - 2 * t); }
  function groundE(x, z) {
    var info = polyInfo(x, z), g = idw(GP, x, z), e = idw(EP, x, z);
    if (info.d <= 0) return g;
    var w = BLEND[info.edge];
    if (info.d >= w) return e;
    return g + (e - g) * sm(info.d / w);
  }
  function groundY(x, z) { return Y(groundE(x, z)); }

  (function buildTerrain() {
    var step = 0.25, B = BOUNDS;
    var nx = Math.round((B.x1 - B.x0) / step), nz = Math.round((B.z1 - B.z0) / step);
    var pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
    var idx = [];
    for (var j = 0; j <= nz; j++) for (var i = 0; i <= nx; i++) {
      var x = B.x0 + i * step, z = B.z0 + j * step, k = j * (nx + 1) + i;
      pos[k * 3] = x; pos[k * 3 + 1] = groundY(x, z); pos[k * 3 + 2] = z;
      uv[k * 2] = (x - B.x0) / (B.x1 - B.x0); uv[k * 2 + 1] = 1 - (z - B.z0) / (B.z1 - B.z0);
    }
    for (var j2 = 0; j2 < nz; j2++) for (var i2 = 0; i2 < nx; i2++) {
      var a = j2 * (nx + 1) + i2, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    var m = M(0x8a9a7a, 1);
    var t = mesh(g, m, false, gTerrain, true);
    t.receiveShadow = true;
    t.name = 'terrain';
    root.userData.terrain = t;
  })();

  /* Stützmauern an West- und Nordgrenze */
  (function retaining() {
    [5, 0, 1].forEach(function (ei) {
      var a = PLOT[ei], b = PLOT[(ei + 1) % PLOT.length];
      var dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      var nxo = uz, nzo = -ux; // nach außen (Polygon im Uhrzeigersinn, z nach unten)
      var step = 0.5, n = Math.ceil(L / step);
      for (var i = 0; i < n; i++) {
        var s0 = i * step, s1 = Math.min(L, (i + 1) * step), sc = (s0 + s1) / 2;
        var px = a[0] + ux * sc, pz = a[1] + uz * sc;
        var top = groundE(px, pz), bot = groundE(px + nxo * 0.45, pz + nzo * 0.45);
        if (top - bot < 0.1) continue;
        var o = mesh(new THREE.BoxGeometry(s1 - s0 + 0.02, top - bot + 0.3, 0.3), mat.retain, true, gGarden, true);
        o.position.set(px - nxo * 0.15, Y(bot) - 0.15 + (top - bot + 0.3) / 2, pz - nzo * 0.15);
        o.rotation.y = -Math.atan2(dz, dx);
      }
    });
  })();

  /* Grenzsteine */
  PLOT.forEach(function (p) {
    var gy = groundY(p[0], p[1]);
    var s = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), mat.stone, true, gMarks, false);
    s.position.set(p[0], gy + 0.12, p[1]);
    var t = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 10), mat.stoneTop, false, gMarks, false);
    t.position.set(p[0], gy + 0.4, p[1]);
  });

  /* ---------- Haus: Erdgeschoss nach dem Original-Bauplan ----------
     Hausmaße relativ zur nordwestlichen Außenkante des oberen Baukörpers (hx nach Osten, hz nach Süden). */
  var yF = Y(H.FFB), yE = Y(H.EAVE), yC = yF + CEIL, yD = yC + 0.22;
  var footPts = [[F.x0, F.z0], [F.x1, F.z0], [F.x1, F.z1], [F.xn, F.z1], [F.xn, F.zn], [F.x0, F.zn]];
  function shapeOf(pts) {
    var s = new THREE.Shape();
    pts.forEach(function (p, i) { if (i) s.lineTo(p[0], -p[1]); else s.moveTo(p[0], -p[1]); });
    s.closePath();
    return s;
  }
  (function slab() {
    var g = new THREE.ExtrudeGeometry(shapeOf(footPts), { depth: yF - 0.0, bevelEnabled: false });
    var o = mesh(g, mat.slab, true, gHouse, true);
    o.rotation.x = -Math.PI / 2; o.position.y = 0.0;
  })();

  var HW = 12.95, HD = 14.655, XL = 3.5, ZU = 6.78, TW = 0.385, hw = TW / 2;
  function P(x, z) { return [F.x0 + x, F.z0 + z]; }
  // Außenwand: 18,5 cm Poroton innen plus 20 cm Dämmung außen; n = Richtung nach außen
  function xw(a, b, opens, n) {
    var gaps = opens.map(function (o) { return { a: o.a, b: o.b, sill: o.sill, head: o.head, type: 'gap' }; });
    function sh(p, d) { var q = P(p[0], p[1]); return [q[0] + n[0] * d, q[1] + n[1] * d]; }
    wall(sh(a, 0.0925), sh(b, 0.0925), 0.20, yF, yE, gaps, gHouse, 0, mat.plaster);
    wall(sh(a, -0.1), sh(b, -0.1), 0.185, yF, yE, opens, gHouse, 0, mat.plasterIn);
  }
  function win(a, b) { return { a: a, b: b, sill: 1.125, head: 2.625, type: 'glass' }; }
  function gdoor(a, b) { return { a: a, b: b, sill: 0, head: 2.375, type: 'glass' }; }
  // Außenwände 38,5 cm (Öffnungen aus den Maßketten des Plans)
  xw([0, hw], [HW, hw], [{ a: 5.555, b: 6.565, sill: 0, head: 2.375, type: 'door' }, win(9.055, 10.565)], [0, -1]);
  xw([HW - hw, 0], [HW - hw, HD], [win(1.036, 1.783), win(3.056, 3.795), { a: 4.559, b: 6.29, sill: 0, head: 2.375, type: 'door' }, win(7.063, 8.548), win(11.944, 13.438)], [1, 0]);
  xw([HW, HD - hw], [XL, HD - hw], [gdoor(HW - 6.895, HW - 3.885)], [0, 1]);
  xw([XL + hw, HD], [XL + hw, ZU], [gdoor(HD - 14.27, HD - 13.26), gdoor(HD - 12.395, HD - 10.385), gdoor(HD - 9.27, HD - 7.26)], [-1, 0]);
  xw([XL, ZU - hw], [0, ZU - hw], [{ a: XL - 3.25, b: XL - 1.75, sill: 1.5, head: 2.375, type: 'glass' }], [0, 1]);
  xw([hw, ZU], [hw, 0], [gdoor(ZU - 2.895, ZU - 0.885), gdoor(ZU - 5.145, ZU - 4.385)], [-1, 0]);

  // Innenwände (rechteckig: x0,x1,z0,z1 und Öffnungen als [von,bis] in hx bzw. hz)
  function rw(x0, x1, z0, z1, opens) {
    var horiz = (x1 - x0) >= (z1 - z0), t = horiz ? z1 - z0 : x1 - x0;
    var a = horiz ? P(x0, (z0 + z1) / 2) : P((x0 + x1) / 2, z0), b = horiz ? P(x1, (z0 + z1) / 2) : P((x0 + x1) / 2, z1);
    var o0 = horiz ? x0 : z0;
    var os = (opens || []).map(function (o) { return { a: o[0] - o0, b: o[1] - o0, sill: 0, head: 2.19, type: 'gap' }; });
    wall(a, b, t, yF, yC, os, gInner, 0, mat.plasterIn);
  }
  function dw(p, q, t) { wall(P(p[0], p[1]), P(q[0], q[1]), t, yF, yC, [], gInner, 0.05, mat.plasterIn); }
  rw(4.57, 4.745, 0.385, 3.535);                       // HAR West
  rw(4.57, 7.93, 3.36, 3.535, [[6.775, 7.62]]);        // HAR Süd mit Tür
  rw(7.755, 7.93, 0.385, 3.36);                        // HAR / Kind II
  dw([7.93, 3.45], [8.83, 4.35], 0.2);                 // schräge Wand Kind II / Diele
  rw(8.8, 12.565, 4.30, 4.425, [[9.46, 10.32], [11.71, 12.565]]); // Kind II und D-Bad Süd
  rw(10.46, 10.635, 2.29, 4.30);                       // D-Bad West
  rw(10.46, 12.565, 2.29, 2.405);                      // D-Bad Nord
  rw(0.385, 2.56, 3.35, 3.525);                        // Installationswand Eltern-Bad
  rw(1.26, 1.435, 3.525, 4.69);                        // WC-Wand
  dw([2.56, 3.44], [2.95, 3.82], 0.175);               // Knick vor der Badtür
  rw(3.885, 6.82, 4.60, 4.775, [[4.75, 5.37]]);        // Ankleide Nord mit Tür
  dw([6.78, 4.72], [7.70, 5.64], 0.2);                 // schräge Wand Ankleide
  rw(7.64, 7.815, 5.62, 6.58);                         // Ankleide Ost
  rw(3.71, 3.885, 4.60, 6.78);                         // Bad / Ankleide
  rw(3.885, 8.01, 6.405, 6.58);                        // Wand Wohnen / Flur
  rw(8.87, 12.565, 6.375, 6.50, [[9.95, 10.81]]);      // Kind I Nord mit Tür
  rw(9.0, 9.175, 6.375, 11.245);                       // Kind I / Speisekammer West
  rw(9.175, 12.565, 9.69, 9.815);                      // Kind I / Speisekammer
  rw(9.0, 12.565, 11.07, 11.245, [[11.07, 11.81]]);    // Speisekammer / Küche

  /* Räume (Polygone in hx/hz, Innenkanten) */
  var WOOD = 0xb99466, TILE = 0xc9ced1, TILE2 = 0xd8d4cb, CONC = 0xbab8b1;
  var ROOMS = [
    { id: 'eltern', name: 'Eltern', col: WOOD, poly: [[0.385, 0.385], [4.57, 0.385], [4.57, 3.36], [2.56, 3.36], [0.385, 3.35]] },
    { id: 'har', name: 'HAR', col: CONC, poly: [[4.745, 0.385], [7.755, 0.385], [7.755, 3.36], [4.745, 3.36]] },
    { id: 'kind2', name: 'Kind II', col: WOOD, poly: [[7.93, 0.385], [12.565, 0.385], [12.565, 2.29], [10.46, 2.29], [10.46, 4.30], [8.83, 4.30], [8.0, 3.535], [7.93, 3.535]] },
    { id: 'dbad', name: 'D-Bad', col: TILE, poly: [[10.635, 2.405], [12.565, 2.405], [12.565, 4.30], [10.635, 4.30]] },
    { id: 'bad', name: 'Bad (Eltern)', col: TILE, poly: [[0.385, 3.525], [2.56, 3.525], [3.62, 4.5], [3.71, 4.6], [3.71, 6.405], [0.385, 6.405]] },
    { id: 'ankleide', name: 'Ankleide', col: WOOD, poly: [[3.885, 4.775], [6.78, 4.775], [7.64, 5.64], [7.64, 6.405], [3.885, 6.405]] },
    { id: 'flur', name: 'Flur', col: TILE2, poly: [[2.56, 3.36], [4.57, 3.36], [4.745, 3.535], [7.93, 3.535], [8.83, 4.425], [8.83, 6.405], [7.815, 6.405], [7.815, 5.64], [6.82, 4.6], [3.885, 4.6], [3.62, 4.5]] },
    { id: 'diele', name: 'Diele', col: TILE2, poly: [[8.83, 4.425], [12.565, 4.425], [12.565, 6.375], [8.83, 6.375]] },
    { id: 'kind1', name: 'Kind I', col: WOOD, poly: [[9.175, 6.5], [12.565, 6.5], [12.565, 9.69], [9.175, 9.69]] },
    { id: 'speis', name: 'Speisekammer', col: TILE, poly: [[9.175, 9.815], [12.565, 9.815], [12.565, 11.07], [9.175, 11.07]] },
    { id: 'wohnen', name: 'Wohnen / Essen', col: WOOD, poly: [[3.885, 6.58], [9.0, 6.58], [9.0, 14.27], [3.885, 14.27]] },
    { id: 'kueche', name: 'Küche', col: TILE, poly: [[9.0, 11.245], [12.565, 11.245], [12.565, 14.27], [9.0, 14.27]] }
  ];
  function polyArea(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
  function centroid(p) {
    var A = 0, cx = 0, cz = 0;
    for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length], c = a[0] * b[1] - b[0] * a[1]; A += c; cx += (a[0] + b[0]) * c; cz += (a[1] + b[1]) * c; }
    A /= 2; return [cx / (6 * A), cz / (6 * A)];
  }
  var roomsOut = [];
  ROOMS.forEach(function (r) {
    var pts = r.poly.map(function (q) { return P(q[0], q[1]); });
    var geo = new THREE.ShapeGeometry(shapeOf(pts));
    var m = M(r.col, 0.85);
    var o = new THREE.Mesh(geo, m);
    o.rotation.x = -Math.PI / 2; o.position.y = yF + 0.012; o.receiveShadow = true;
    gInner.add(o); pickables.push(o);
    var c = centroid(pts), area = polyArea(pts);
    roomsOut.push({ id: r.id, name: r.name, area: area, center: c, mesh: o, base: r.col, level: 'eg' });
    tags.push({ kind: 'room', layer: 'rooms', level: 'eg', name: r.name, area: area, pos: [c[0], yF + 0.25, c[1]] });
  });
  // überdachte Terrasse und Terrassenplatten
  (function terrace() {
    var t = boxAt(3.4, 0.2, F.z1 - F.zn, M(0x6e7176, 0.9), (F.x0 + F.xn) / 2 + 0.0, Y(142.5), (F.zn + F.z1) / 2, gGarden);
    var area = 3.4 * (15.74 - F.zn);
    tags.push({ kind: 'room', layer: 'rooms', name: 'Terrasse (überdacht)', area: area, pos: [(F.x0 + F.xn) / 2, Y(142.62) + 0.25, (F.zn + 15.74) / 2] });
    roomsOut.push({ id: 'terrasse', name: 'Terrasse (überdacht)', area: area, center: [(F.x0 + F.xn) / 2, (F.zn + 15.74) / 2], mesh: t, base: 0x6e7176, level: 'out' });
  })();
  // Eingangspodest Ost
  (function podest() {
    var a = pl(1100, 735), b = pl(1180, 840);
    boxAt(b[0] - a[0], 0.3, b[1] - a[1], mat.step, (a[0] + b[0]) / 2, Y(142.65) - 0.15, (a[1] + b[1]) / 2, gGarden);
  })();

  /* ---------- Dach (zwei Walmflügel, Höhe als Maximum beider) ---------- */
  var AR = { x0: F.x0 - OVER, x1: F.x1 + OVER, z0: F.z0 - OVER, z1: F.z0 + 2 * RUN + OVER };
  var BR = { x0: F.xn - OVER, x1: F.x1 + OVER, z0: F.z0 - OVER, z1: F.z1 + OVER };
  var EPS = 1e-6;
  function inR(r, x, z) { return x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS; }
  function dR(r, x, z) { return Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z); }
  function roofH(x, z) {
    var h = -1e9;
    if (inR(AR, x, z)) h = Math.max(h, H.EAVE - OVER * TAN + TAN * dR(AR, x, z));
    if (inR(BR, x, z)) h = Math.max(h, H.EAVE - OVER * TAN + TAN * dR(BR, x, z));
    return h;
  }
  function gridLines(min, max, extra, step) {
    var n = Math.ceil((max - min) / step), arr = [];
    for (var i = 0; i <= n; i++) arr.push(min + (max - min) * i / n);
    extra.forEach(function (e) { if (e > min && e < max) arr.push(e); });
    arr.sort(function (a, b) { return a - b; });
    var out = [arr[0]];
    for (var k = 1; k < arr.length; k++) if (arr[k] - out[out.length - 1] > 0.004) out.push(arr[k]);
    return out;
  }
  (function roof() {
    var xs = gridLines(AR.x0, AR.x1, [BR.x0, BR.x1, AR.x0 + (AR.z1 - AR.z0) / 2, AR.x1 - (AR.z1 - AR.z0) / 2, (BR.x0 + BR.x1) / 2], 0.07);
    var zs = gridLines(BR.z0, BR.z1, [AR.z1, (AR.z0 + AR.z1) / 2, BR.z0 + (BR.x1 - BR.x0) / 2, BR.z1 - (BR.x1 - BR.x0) / 2], 0.07);
    var P = [];
    for (var i = 0; i < xs.length - 1; i++) for (var j = 0; j < zs.length - 1; j++) {
      var x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
      if (roofH((x0 + x1) / 2, (z0 + z1) / 2) < -1e8) continue;
      var h00 = roofH(x0, z0), h10 = roofH(x1, z0), h11 = roofH(x1, z1), h01 = roofH(x0, z1);
      if (h00 < -1e8 || h10 < -1e8 || h11 < -1e8 || h01 < -1e8) continue;
      P.push(x0, Y(h00), z0, x0, Y(h01), z1, x1, Y(h11), z1, x0, Y(h00), z0, x1, Y(h11), z1, x1, Y(h10), z0);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.computeVertexNormals();
    var o = mesh(g, mat.roof, true, gRoof, true);
    o.name = 'roof';
  })();

  /* ---------- Dachausbau (DG) und Dachstuhl ---------- */
  (function dgLayer() {
    var inset = [[0.385, 0.385], [HW - 0.385, 0.385], [HW - 0.385, HD - 0.385], [XL + 0.385, HD - 0.385], [XL + 0.385, ZU - 0.385], [0.385, ZU - 0.385]];
    var stairHole = [[9.55, 8.23], [12.54, 8.23], [12.54, 9.64], [9.55, 9.64]];
    function holeOf(pts) {
      var h = new THREE.Path();
      pts.forEach(function (p, i) { var q = P(p[0], p[1]); if (i) h.lineTo(q[0], -q[1]); else h.moveTo(q[0], -q[1]); });
      h.closePath(); return h;
    }
    // Decke über dem EG = Boden des Dachausbaus
    var sh = shapeOf(inset.map(function (p) { return P(p[0], p[1]); }));
    sh.holes.push(holeOf(stairHole));
    var slab = mesh(new THREE.ExtrudeGeometry(sh, { depth: yD - yC, bevelEnabled: false }), mat.slab, true, gDG, true);
    slab.rotation.x = -Math.PI / 2; slab.position.y = yC;
    // nicht ausgebauter Randbereich (schraffiert im Plan)
    var sh2 = shapeOf(inset.map(function (p) { return P(p[0], p[1]); }));
    sh2.holes.push(holeOf(stairHole));
    var ins = new THREE.Mesh(new THREE.ShapeGeometry(sh2), mat.insul);
    ins.rotation.x = -Math.PI / 2; ins.position.y = yD + 0.004; ins.receiveShadow = true; gDG.add(ins); pickables.push(ins);
    // ausgebauter Bereich (weiß im Plan)
    var Z = { x0: 5.20, x1: 11.24, z0: 1.73, z1: 12.96 };
    var zonePts = [[Z.x0, Z.z0], [Z.x1, Z.z0], [Z.x1, 8.23], [9.55, 8.23], [9.55, 9.64], [Z.x1, 9.64], [Z.x1, Z.z1], [Z.x0, Z.z1]];
    var zoneMat = M(0xcdae82, 0.8, 0, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    var zone = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(zonePts.map(function (p) { return P(p[0], p[1]); }))), zoneMat);
    zone.rotation.x = -Math.PI / 2; zone.position.y = yD + 0.008; zone.receiveShadow = true; gDG.add(zone); pickables.push(zone);
    var zArea = polyArea(zonePts), zc = P(8.22, 6.4);
    roomsOut.push({ id: 'dg', name: 'Dachausbau (DG)', area: zArea, center: zc, mesh: zone, base: 0xcdae82, level: 'dg' });
    tags.push({ kind: 'room', layer: 'rooms', level: 'dg', name: 'Dachausbau', area: zArea, pos: [zc[0] - 1.6, yD + 0.35, zc[1] - 2.2] });

    // Wände des Dachausbaus, oben an der Dachschräge abgeschnitten
    // Oberkante: höchstens 2,45 m (bzw. hm) über dem Boden und mindestens 22 cm unter der Dachhaut, also unter den Sparren
    function topAt(x, z, hm) { var h = roofH(x, z); hm = hm || 2.45; return h < -1e8 ? yD + 2.2 : Math.min(yD + hm, Y(h) - 0.22); }
    function dgWall(x0, x1, z0, z1, hm) {
      var horiz = (x1 - x0) >= (z1 - z0), len = horiz ? x1 - x0 : z1 - z0, n = Math.max(1, Math.ceil(len / 0.1)), t = horiz ? z1 - z0 : x1 - x0;
      var cA = horiz ? (z0 + z1) / 2 : (x0 + x1) / 2, s0 = horiz ? x0 : z0, ht = t / 2;
      var top = [], pos = [], i;
      function pt(i2, side, y) { var sv = s0 + len * i2 / n, c = cA + side * ht; var q = horiz ? P(sv, c) : P(c, sv); return [q[0], y, q[1]]; }
      for (i = 0; i <= n; i++) {
        var q = horiz ? P(s0 + len * i / n, cA) : P(cA, s0 + len * i / n);
        top.push(Math.max(yD, topAt(q[0], q[1], hm)));
      }
      function quad(a, b, c, d) { pos.push.apply(pos, a.concat(b, c, a, c, d)); }
      for (i = 0; i < n; i++) {
        quad(pt(i, -1, yD), pt(i + 1, -1, yD), pt(i + 1, -1, top[i + 1]), pt(i, -1, top[i]));
        quad(pt(i + 1, 1, yD), pt(i, 1, yD), pt(i, 1, top[i]), pt(i + 1, 1, top[i + 1]));
        quad(pt(i, -1, top[i]), pt(i + 1, -1, top[i + 1]), pt(i + 1, 1, top[i + 1]), pt(i, 1, top[i]));
      }
      quad(pt(0, 1, yD), pt(0, -1, yD), pt(0, -1, top[0]), pt(0, 1, top[0]));
      quad(pt(n, -1, yD), pt(n, 1, yD), pt(n, 1, top[n]), pt(n, -1, top[n]));
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.computeVertexNormals();
      var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.95, side: THREE.DoubleSide }));
      m.castShadow = true; m.receiveShadow = true; gDG.add(m); pickables.push(m);
    }
    // Kniewände (ca. 1 m hoch) zwischen ausgebautem Raum und nicht ausgebautem Dachraum
    dgWall(Z.x0, Z.x1, Z.z0, Z.z0 + 0.12, 1.0);                 // Nord
    dgWall(Z.x0, Z.x1, Z.z1 - 0.12, Z.z1, 1.0);                 // Süd
    dgWall(Z.x0, Z.x0 + 0.12, Z.z0, Z.z1, 1.0);                 // West
    dgWall(Z.x1 - 0.12, Z.x1, Z.z0, 8.23, 1.0);                 // Ost, nördlich der Treppe
    dgWall(Z.x1 - 0.12, Z.x1, 9.64, Z.z1, 1.0);                 // Ost, südlich der Treppe
    dgWall(5.20, 8.32, 7.22, 7.40);          // Querwand West
    dgWall(8.15, 8.32, 7.22, 8.55);          // Trennwand Nord
    dgWall(8.15, 8.32, 9.41, 12.96);         // Trennwand Süd
    dgWall(9.28, 11.26, 8.08, 8.23);         // Treppenwand Nord
    dgWall(9.25, 11.26, 9.64, 9.78);         // Treppenwand Süd
    // Treppe: 15 Steigungen von der Kind-I-Seite hinauf (Stufen 7 bis 15 gerade, 1 bis 6 gewendelt, vereinfacht)
    var rise = (yD - (yF + 0.012)) / 16;
    for (var n = 15; n >= 1; n--) {
      var x0 = n >= 7 ? 9.28 + (15 - n) * 0.25 : 11.53 + (6 - n) * 0.17, dx = n >= 7 ? 0.25 : 0.17;
      var yt = yD - (16 - n) * rise, c = P(x0 + dx / 2, 8.93);
      boxAt(dx, 0.05, 1.3, mat.wood, c[0], yt - 0.025, c[1], gDG);
      var r = boxAt(0.03, rise, 1.3, mat.wood, P(x0, 0)[0], yt - rise / 2, c[1], gDG);
    }
    var sj = P(0, 8.93); // Wangen
    [8.3, 9.57].forEach(function (zz) {
      var lenx = 12.54 - 9.28, drop = 15 * rise;
      var ln = Math.hypot(lenx, drop);
      var o = boxAt(ln, 0.2, 0.05, mat.wood, F.x0 + (9.28 + 12.54) / 2, yD - drop / 2 - 0.1, F.z0 + zz, gDG);
      o.rotation.z = -Math.atan2(drop, lenx);
    });
  })();

  // Dachfenster (fünf Stück, aus dem Dachausbauplan)
  (function roofWindows() {
    var WL = [[7.69, 8.80, 1.79, 3.15], [9.86, 11.22, 6.47, 7.20], [5.28, 6.64, 8.24, 8.96], [10.29, 11.23, 8.39, 8.75], [7.34, 8.11, 11.54, 12.94]];
    WL.forEach(function (w) {
      var c = [[w[0], w[2]], [w[1], w[2]], [w[1], w[3]], [w[0], w[3]]].map(function (p) { var q = P(p[0], p[1]); return [q[0], Y(roofH(q[0], q[1])) + 0.05, q[1]]; });
      var pos = new Float32Array(c.reduce(function (a, v) { return a.concat(v); }, []));
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
      var m = new THREE.Mesh(g, mat.glass); gRoof.add(m);
      var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      lg.setIndex([0, 1, 1, 2, 2, 3, 3, 0]);
      gRoof.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2f333a })));
    });
  })();

  // Dachstuhl: Sparren, Grate, First
  (function rafters() {
    var inst = [], STEP = 0.2;
    function addSeg(ax, az, bx, bz, w, d, drop) {
      var ha = roofH(ax, az), hb = roofH(bx, bz);
      if (ha < -1e8 || hb < -1e8) return;
      inst.push([ax, Y(ha) - drop, az, bx, Y(hb) - drop, bz, w, d]);
    }
    function grad(x, z) {
      var e = 0.05, a = roofH(x + e, z), b = roofH(x - e, z), c = roofH(x, z + e), d = roofH(x, z - e);
      if (a < -1e8 || b < -1e8 || c < -1e8 || d < -1e8) return null;
      return [(a - b) / (2 * e), (c - d) / (2 * e)];
    }
    var x0 = AR.x0 + 0.02, x1 = BR.x1 - 0.02, z0 = BR.z0 + 0.02, z1 = BR.z1 - 0.02;
    // Sparren in Ost-West-Richtung (Abstand 0,88 m) und in Nord-Süd-Richtung (Abstand 0,97 m)
    for (var z = z0 + 0.3; z < z1; z += 0.88) for (var x = x0; x < x1 - 1e-6; x += STEP) {
      var g = grad(x + STEP / 2, z); if (!g || Math.abs(g[0]) + 1e-3 < Math.abs(g[1])) continue;
      addSeg(x, z, Math.min(x + STEP, x1), z, 0.08, 0.18, 0.12);
    }
    for (var xx = x0 + 0.3; xx < x1; xx += 0.97) for (var zz = z0; zz < z1 - 1e-6; zz += STEP) {
      var g2 = grad(xx, zz + STEP / 2); if (!g2 || Math.abs(g2[1]) + 1e-3 < Math.abs(g2[0])) continue;
      addSeg(xx, zz, xx, Math.min(zz + STEP, z1), 0.08, 0.18, 0.12);
    }
    // Grate: Linien von den Ecken beider Flügel zu den Firsten, nur wo der Flügel das Dach bestimmt
    [AR, BR].forEach(function (R) {
      var hh = function (x, z) { return H.EAVE - OVER * TAN + TAN * dR(R, x, z); };
      var half = Math.min(R.x1 - R.x0, R.z1 - R.z0) / 2;
      [[R.x0, R.z0, 1, 1], [R.x1, R.z0, -1, 1], [R.x0, R.z1, 1, -1], [R.x1, R.z1, -1, -1]].forEach(function (c) {
        for (var t = 0; t < half - 1e-6; t += STEP) {
          var t2 = Math.min(t + STEP, half), mx = c[0] + c[2] * (t + t2) / 2, mz = c[1] + c[3] * (t + t2) / 2;
          if (Math.abs(roofH(mx, mz) - hh(mx, mz)) > 0.03) continue;
          addSeg(c[0] + c[2] * t, c[1] + c[3] * t, c[0] + c[2] * t2, c[1] + c[3] * t2, 0.1, 0.22, 0.14);
        }
      });
    });
    // First
    var ax = (AR.z1 - AR.z0) / 2;
    for (var s = AR.x0 + ax; s < AR.x1 - ax; s += STEP) addSeg(s, (AR.z0 + AR.z1) / 2, Math.min(s + STEP, AR.x1 - ax), (AR.z0 + AR.z1) / 2, 0.12, 0.26, 0.18);
    var bx = (BR.x0 + BR.x1) / 2, bh = (BR.x1 - BR.x0) / 2;
    for (var s2 = BR.z0 + bh; s2 < BR.z1 - bh; s2 += STEP) addSeg(bx, s2, bx, Math.min(s2 + STEP, BR.z1 - bh), 0.12, 0.26, 0.18);

    var im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat.timber, inst.length);
    var m4 = new THREE.Matrix4(), u = new THREE.Vector3(), sd = new THREE.Vector3(), up = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), mid = new THREE.Vector3();
    inst.forEach(function (s, i) {
      u.set(s[3] - s[0], s[4] - s[1], s[5] - s[2]); var len = u.length(); u.divideScalar(len);
      sd.crossVectors(UP, u); if (sd.lengthSq() < 1e-8) sd.set(1, 0, 0); sd.normalize();
      up.crossVectors(u, sd);
      m4.makeBasis(u.clone().multiplyScalar(len + 0.02), up.clone().multiplyScalar(s[7]), sd.clone().multiplyScalar(s[6]));
      mid.set((s[0] + s[3]) / 2, (s[1] + s[4]) / 2, (s[2] + s[5]) / 2);
      m4.setPosition(mid);
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true;
    gRaf.add(im);
    root.userData.rafterCount = inst.length;
  })();

  /* ---------- Carport und Geräteraum (41 m² unter einem Dach) ---------- */
  (function carport() {
    var base = Y(142.25), hRoof = base + 2.6;
    // Boden
    var a = pl(270, 232), b = pl(675, 505);
    boxAt(b[0] - a[0], 0.1, b[1] - a[1], M(0xa8a8a4, 0.95), (a[0] + b[0]) / 2, base - 0.05, (a[1] + b[1]) / 2, gGarden);
    // Geräteraum
    var gx0 = 0.15, gx1 = 2.55, gz0 = 0.35, gz1 = 5.35;
    wall([gx0, gz0], [gx1, gz0], 0.15, base, hRoof, [], gGarden, 0.075, mat.carportWall);
    wall([gx1, gz0], [gx1, gz1], 0.15, base, hRoof, [{ a: 1.9, b: 3.0, sill: 0, head: 2.0, type: 'door' }], gGarden, 0.075, mat.carportWall);
    wall([gx1, gz1], [gx0, gz1], 0.15, base, hRoof, [], gGarden, 0.075, mat.carportWall);
    wall([gx0, gz1], [gx0, gz0], 0.15, base, hRoof, [], gGarden, 0.075, mat.carportWall);
    // Pfosten Carport
    [[2.9, 0.4], [2.9, 5.35], [5.4, 0.4], [5.4, 5.35], [7.9, 0.4], [7.9, 5.35]].forEach(function (p) {
      boxAt(0.14, hRoof - base, 0.14, mat.wood, p[0], (base + hRoof) / 2, p[1], gGarden);
    });
    // Dach (flach)
    var ra = pl(268, 226), rb = pl(682, 512);
    boxAt(rb[0] - ra[0], 0.18, rb[1] - ra[1], mat.carportRoof, (ra[0] + rb[0]) / 2, hRoof + 0.09, (ra[1] + rb[1]) / 2, gGarden);
    tags.push({ kind: 'room', layer: 'rooms', name: 'Geräteraum', area: 12, pos: [(gx0 + gx1) / 2, base + 0.4, (gz0 + gz1) / 2] });
    tags.push({ kind: 'room', layer: 'rooms', name: 'Carport', area: 29, pos: [5.4, base + 0.4, 2.9] });
    // Mülltonnen
    var t1 = pl(690, 488), t2 = pl(790, 484);
    boxAt(0.55, 1.0, 0.6, mat.bin1, t1[0], Y(142.33) + 0.5, t1[1], gGarden);
    boxAt(0.55, 1.0, 0.6, mat.bin2, t2[0], Y(142.33) + 0.5, t2[1], gGarden);
  })();

  /* ---------- Garten: Pool, Beet, Spielgeräte, Hecke ---------- */
  (function garden() {
    var pc = pl(935, 1470), r = 1.83, py = Y(142.62);
    boxAt(4.0, 0.06, 4.0, M(0x3f6b3a, 1), pc[0], py + 0.03, pc[1], gGarden);
    var wall1 = mesh(new THREE.CylinderGeometry(r, r, 1.2, 56, 1, true), mat.poolwall, true, gGarden, true);
    wall1.position.set(pc[0], py + 0.6 + 0.06, pc[1]);
    var wat = mesh(new THREE.CircleGeometry(r - 0.03, 56), mat.water, false, gGarden, false);
    wat.rotation.x = -Math.PI / 2; wat.position.set(pc[0], py + 1.06, pc[1]);
    var rim = mesh(new THREE.TorusGeometry(r, 0.04, 8, 56), mat.metal, true, gGarden, false);
    rim.rotation.x = Math.PI / 2; rim.position.set(pc[0], py + 1.26, pc[1]);
    // Beet mit Baum und Sträuchern
    var bc = pl(1355, 780);
    var tx = bc[0], tz = bc[1] + 0.2, ty = groundY(tx, tz);
    var tr = mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 10), mat.trunk, true, gGarden, false);
    tr.position.set(tx, ty + 1.1, tz);
    var cr = mesh(new THREE.SphereGeometry(1.35, 18, 14), mat.crown, true, gGarden, false);
    cr.position.set(tx, ty + 3.1, tz); cr.scale.set(1, 0.9, 1);
    [[-1.2, 1.9], [1.1, -2.0], [1.3, 1.6], [-0.9, -1.8]].forEach(function (o) {
      var s = mesh(new THREE.SphereGeometry(0.55, 12, 10), mat.crown2, true, gGarden, false);
      s.position.set(tx + o[0], groundY(tx + o[0], tz + o[1]) + 0.4, tz + o[1]); s.scale.set(1, 0.75, 1);
    });
    var sc = pl(1190, 1480);
    [[0, 0, 1.0], [-0.9, 0.7, 0.8], [0.8, 0.9, 0.7]].forEach(function (o) {
      var s = mesh(new THREE.SphereGeometry(o[2], 14, 10), mat.crown, true, gGarden, false);
      s.position.set(sc[0] + o[0], groundY(sc[0] + o[0], sc[1] + o[1]) + o[2] * 0.8, sc[1] + o[1]); s.scale.set(1, 0.85, 1);
    });
    // Hecke an der Südgrenze
    var hz = PLOT[4][1] - 0.4;
    boxAt(PLOT[4][0] - 0.2, 1.2, 0.6, mat.hedge, (PLOT[4][0] - 0.2) / 2 + 0.1, Y(142.45) + 0.5, hz, gGarden);
    // Spielturm und Schaukelgestell
    var st = pl(355, 1445), sy = Y(142.65);
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(function (o) { boxAt(0.1, 2.4, 0.1, mat.wood, st[0] + o[0], sy + 1.2, st[1] + o[1], gGarden); });
    boxAt(1.4, 0.08, 1.4, mat.wood, st[0], sy + 1.2, st[1], gGarden);
    var rf = mesh(new THREE.ConeGeometry(1.15, 0.8, 4), M(0xa33a2a, 0.8), true, gGarden, false);
    rf.position.set(st[0], sy + 2.8, st[1]); rf.rotation.y = Math.PI / 4;
    var sl = boxAt(0.45, 0.05, 2.6, M(0x3c7fd0, 0.5), st[0] + 0.0, sy + 0.62, st[1] + 2.0, gGarden); sl.rotation.x = 0.46;
    var sw = pl(543, 1500);
    boxAt(3.4, 0.1, 0.1, mat.wood, sw[0], sy + 2.3, sw[1], gGarden);
    [[-1.6, -0.6], [-1.6, 0.6], [1.6, -0.6], [1.6, 0.6]].forEach(function (o) {
      var p = boxAt(0.09, 2.45, 0.09, mat.wood, sw[0] + o[0], sy + 1.15, sw[1] + o[1], gGarden); p.rotation.z = o[0] < 0 ? -0.0 : 0.0;
    });
  })();

  /* ---------- Beschriftungen: Höhen und Maße ---------- */
  function hTag(txt, x, z, yy) { tags.push({ kind: 'h', layer: 'heights', text: txt, pos: [x, yy, z] }); }
  var mw = [[270, 405, '142,25'], [970, 285, '142,25'], [270, 790, '142,45'], [270, 1115, '142,65']];
  mw.forEach(function (m) { var p = pl(m[0], m[1]); hTag('OK Mauer ' + m[2], Math.max(p[0], 0.4), Math.max(p[1], 0.4), groundY(p[0], p[1]) + 1.0); });
  hTag('OK FFB 142,80', F.x1 + 0.2, 8.4, yF + 0.3);
  hTag('Traufe 145,77', F.x0 + 0.4, F.z0 + 0.2, yE + 0.4);
  hTag('First 149,08', (AR.x0 + 5.25 + AR.x1 - 5.25) / 2, F.z0 + RUN, Y(H.RIDGE) + 0.5);
  hTag('Schotterhöhe 142,35', 9.3, 4.4, Y(142.35) + 0.2);
  [[268, 215, '141,38'], [1060, 262, '141,69'], [1560, 348, '141,79'], [255, 500, '141,46'], [255, 868, '141,65'], [250, 1402, '142,05'], [250, 1578, '142,18']].forEach(function (s) {
    var p = pl(s[0], s[1]); hTag('Bestand ' + s[2], p[0] - (s[0] < 400 ? 1.6 : 0), p[1], Y(parseFloat(s[2].replace(',', '.'))) + 0.2);
  });
  function dTag(txt, x, z, yy) { tags.push({ kind: 'dim', layer: 'dims', text: txt, pos: [x, yy, z] }); }
  for (var ei = 0; ei < PLOT.length; ei++) {
    var pa = PLOT[ei], pb = PLOT[(ei + 1) % PLOT.length];
    var mx = (pa[0] + pb[0]) / 2, mz = (pa[1] + pb[1]) / 2;
    var ox = ei === 5 ? -1.2 : ei === 2 || ei === 3 ? 1.2 : 0, oz = ei === 0 || ei === 1 ? -1.2 : ei === 4 ? 1.2 : 0;
    dTag(EDGE_TXT[ei] + ' m', mx + ox, mz + oz, groundY(mx, mz) + 0.3);
  }
  dTag('12,95 m', (F.x0 + F.x1) / 2, F.z0 - 0.9, groundY(9, 5) + 0.4);
  dTag('14,66 m', F.x1 + 1.3, (F.z0 + F.z1) / 2 + 3.5, groundY(17, 14) + 0.4);
  dTag('9,45 m', (F.xn + F.x1) / 2, F.z1 + 0.9, groundY(11, 21) + 0.4);
  dTag('3,50 m', (F.x0 + F.xn) / 2, F.zn + 0.9, groundY(5, 13) + 0.4);
  dTag('3,05 m', 1.5, F.z0 + 3.4, groundY(1.5, 9) + 0.4);
  dTag('5,74 m', 1.0, 3.0, groundY(1, 3) + 0.4);

  /* ---------- Flächen für die Bodentextur (Meter) ---------- */
  var zones = {
    plot: PLOT,
    neighbor: [[-12, -12], [40, -12], [40, 5.1], [25.77, 2.975], [3.85, -0.25], [0, 0], [0, 26.795], [-12, 26.795]],
    paving: [pl(675, 232), pl(1610, 372), pl(1410, 1030), pl(1118, 922), pl(1100, 922), pl(1100, 505), pl(675, 505)],
    pavingWest: [pl(370, 510), pl(420, 510), pl(420, 1000), pl(370, 1000)],
    terrace: [[3.1, 12.6], [6.5, 12.6], [6.5, 20.4], [3.1, 20.4]],
    carport: [pl(270, 232), pl(675, 232), pl(675, 505), pl(270, 505)],
    poolSlab: [pl(830, 1368), pl(1037, 1368), pl(1037, 1575), pl(830, 1575)],
    mulch: [pl(1405, 1032), pl(1275, 1445), pl(1085, 1600)],
    bed: { c: pl(1355, 780), w: 3.5, h: 5.8, rot: 18 }
  };

  var info = {
    plotArea: polyArea(PLOT), footArea: polyArea(footPts), pitchDeg: Math.atan(TAN) * 180 / Math.PI,
    ridgeAbove: H.RIDGE - H.FFB, eaveAbove: H.EAVE - H.FFB
  };
  var sunDir = function (bearing, elev) {
    var a = (NORTH + bearing) * Math.PI / 180, e = elev * Math.PI / 180;
    return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
  };

  return {
    root: root, groups: { house: gHouse, inner: gInner, dg: gDG, rafters: gRaf, roof: gRoof, garden: gGarden, terrain: gTerrain, marks: gMarks },
    terrain: root.userData.terrain, pickables: pickables, tags: tags, rooms: roomsOut, zones: zones, info: info,
    groundY: groundY, bounds: BOUNDS, north: NORTH, H: H, datum: DATUM, sunDir: sunDir, roofH: roofH
  };
}
if (typeof module !== 'undefined') module.exports = { buildModel: buildModel };
