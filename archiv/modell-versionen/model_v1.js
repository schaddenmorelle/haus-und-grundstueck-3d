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
  var gHouse = new THREE.Group(), gInner = new THREE.Group(), gRoof = new THREE.Group(), gGarden = new THREE.Group(), gTerrain = new THREE.Group(), gMarks = new THREE.Group();
  root.add(gTerrain, gHouse, gInner, gRoof, gGarden, gMarks);
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
    retain: M(0xb4b3ad, 0.95), step: M(0x9c9a94, 0.95)
  };

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
        [-w / 2 + fr / 2, w / 2 - fr / 2].forEach(function (off) {
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

  /* ---------- Haus ---------- */
  var yF = Y(H.FFB), yE = Y(H.EAVE), yC = yF + CEIL;
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

  var h2 = TE / 2;
  // Außenwände (Öffnungen: Lage aus dem Plan, Größen angenommen)
  wall([F.x0, F.z0 + h2], [F.x1, F.z0 + h2], TE, yF, yE, [
    { a: pmx(702) - F.x0, b: pmx(762) - F.x0, sill: 0, head: 2.1, type: 'door' },
    { a: pmx(895) - F.x0, b: pmx(990) - F.x0, sill: 0.9, head: 2.1, type: 'glass' }
  ], gHouse, 0, mat.plaster);
  wall([F.x1 - h2, F.z0], [F.x1 - h2, F.z1], TE, yF, yE, [
    { a: pmz(535) - F.z0, b: pmz(590) - F.z0, sill: 0.9, head: 2.1, type: 'glass' },
    { a: pmz(738) - F.z0, b: pmz(800) - F.z0, sill: 0, head: 2.1, type: 'door' },
    { a: pmz(915) - F.z0, b: pmz(975) - F.z0, sill: 0.9, head: 2.1, type: 'glass' },
    { a: pmz(1170) - F.z0, b: pmz(1215) - F.z0, sill: 1.0, head: 2.1, type: 'glass' }
  ], gHouse, 0, mat.plaster);
  wall([F.x1, F.z1 - h2], [F.xn, F.z1 - h2], TE, yF, yE, [
    { a: F.x1 - pmx(777), b: F.x1 - pmx(667), sill: 0, head: 2.2, type: 'glass' }
  ], gHouse, 0, mat.plaster);
  wall([F.xn + h2, F.z1], [F.xn + h2, F.zn], TE, yF, yE, [
    { a: F.z1 - pmz(992), b: F.z1 - pmz(895), sill: 0, head: 2.2, type: 'glass' },
    { a: F.z1 - pmz(1160), b: F.z1 - pmz(1062), sill: 0, head: 2.2, type: 'glass' },
    { a: F.z1 - pmz(1262), b: F.z1 - pmz(1217), sill: 0, head: 2.2, type: 'glass' }
  ], gHouse, 0, mat.plaster);
  wall([F.xn + TE, F.zn - h2], [F.x0, F.zn - h2], TE, yF, yE, [], gHouse, 0, mat.plaster);
  wall([F.x0 + h2, F.zn], [F.x0 + h2, F.z0], TE, yF, yE, [
    { a: F.zn - pmz(602), b: F.zn - pmz(548), sill: 0.9, head: 2.1, type: 'glass' }
  ], gHouse, 0, mat.plaster);

  // Innenwände aus dem Grundrissplan (Pixel), Stärke in m
  var IW = [
    [662, 511, 662, 689, TI], [656, 683, 777, 683, TI, [[700, 748, 0, 2.1]]], [835, 511, 835, 688, TI],
    [841, 685, 900, 734, TI], [897, 731.5, 922, 731.5, TI], [975, 624.5, 975, 736, TI],
    [975, 624.5, 1102, 624.5, TL], [975, 731.5, 1036, 731.5, TL],
    [422, 686, 540, 686, TI], [483, 686, 483, 747, TL], [546, 686, 570, 709, TL],
    [615, 742, 615, 850, TI], [612, 753, 775, 753, TL, [[625, 700, 0, 2.1]]], [775, 753, 833, 806, TL], [833, 806, 833, 846, TL],
    [608, 846, 837, 846, TI], [897, 845, 1102, 845, TI, [[950, 997, 0, 2.1]]], [903, 845, 903, 1098, TI],
    [903, 1021, 1102, 1021, TL], [903, 1096, 1102, 1096, TL, [[1010, 1050, 0, 2.1]]]
  ];
  IW.forEach(function (w) {
    var a = pm(w[0], w[1]), b = pm(w[2], w[3]);
    var horiz = Math.abs(w[2] - w[0]) >= Math.abs(w[3] - w[1]);
    var L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    var opens = (w[5] || []).map(function (o) {
      var p0 = horiz ? w[0] : w[1], p1 = horiz ? w[2] : w[3];
      var ta = (o[0] - p0) / (p1 - p0), tb = (o[1] - p0) / (p1 - p0);
      return { a: Math.max(0, ta * L), b: Math.min(L, tb * L), sill: o[2], head: o[3], type: 'gap' };
    });
    wall(a, b, w[4], yF, yC, opens, gInner, w[4] / 2, mat.plasterIn);
  });

  /* Räume */
  var WOOD = 0xb99466, TILE = 0xc9ced1, TILE2 = 0xd8d4cb, CONC = 0xbab8b1;
  var ROOMS = [
    { id: 'eltern', name: 'Eltern', col: WOOD, poly: [[428, 517], [656, 517], [656, 682], [428, 682]] },
    { id: 'har', name: 'HAR', col: CONC, poly: [[668, 517], [829, 517], [829, 677], [668, 677]] },
    { id: 'kind2', name: 'Kind II', col: WOOD, poly: [[841, 517], [1097, 517], [1097, 620], [981, 620], [981, 727], [900, 727], [841, 686]] },
    { id: 'dbad', name: 'D-Bad', col: TILE, poly: [[981, 630], [1097, 630], [1097, 727], [981, 727]] },
    { id: 'bad', name: 'Bad (Eltern)', col: TILE, poly: [[428, 692], [606, 692], [606, 842], [428, 842]] },
    { id: 'ankleide', name: 'Ankleide', col: WOOD, poly: [[621, 759], [772, 759], [828, 808], [828, 842], [621, 842]] },
    { id: 'flur', name: 'Flur', col: TILE2, poly: [[606, 712], [660, 692], [835, 692], [900, 737], [900, 757], [606, 757]] },
    { id: 'diele', name: 'Diele', col: TILE2, poly: [[900, 737], [1097, 737], [1097, 841], [897, 841], [837, 841], [837, 808], [775, 757], [900, 757]] },
    { id: 'kind1', name: 'Kind I', col: WOOD, poly: [[910, 852], [1097, 852], [1097, 1017], [910, 1017]] },
    { id: 'speis', name: 'Speisekammer', col: TILE, poly: [[910, 1029], [1097, 1029], [1097, 1090], [910, 1090]] },
    { id: 'wohnen', name: 'Wohnen / Essen', col: WOOD, poly: [[621, 852], [897, 852], [897, 1098], [905, 1100], [905, 1272], [621, 1272]] },
    { id: 'kueche', name: 'Küche', col: TILE, poly: [[905, 1100], [1097, 1100], [1097, 1272], [905, 1272]] }
  ];
  function polyArea(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
  function centroid(p) {
    var A = 0, cx = 0, cz = 0;
    for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length], c = a[0] * b[1] - b[0] * a[1]; A += c; cx += (a[0] + b[0]) * c; cz += (a[1] + b[1]) * c; }
    A /= 2; return [cx / (6 * A), cz / (6 * A)];
  }
  var roomsOut = [];
  ROOMS.forEach(function (r) {
    var pts = r.poly.map(function (q) { return pm(q[0], q[1]); });
    var geo = new THREE.ShapeGeometry(shapeOf(pts));
    var m = M(r.col, 0.85);
    var o = new THREE.Mesh(geo, m);
    o.rotation.x = -Math.PI / 2; o.position.y = yF + 0.012; o.receiveShadow = true;
    gInner.add(o); pickables.push(o);
    var c = centroid(pts), area = polyArea(pts);
    roomsOut.push({ id: r.id, name: r.name, area: area, center: c, mesh: o, base: r.col });
    tags.push({ kind: 'room', layer: 'rooms', name: r.name, area: area, pos: [c[0], yF + 0.25, c[1]] });
  });
  // überdachte Terrasse und Terrassenplatten
  (function terrace() {
    var t = boxAt(3.4, 0.2, F.z1 - F.zn, M(0x6e7176, 0.9), (F.x0 + F.xn) / 2 + 0.0, Y(142.5), (F.zn + F.z1) / 2, gGarden);
    var area = 3.4 * (15.74 - F.zn);
    tags.push({ kind: 'room', layer: 'rooms', name: 'Terrasse (überdacht)', area: area, pos: [(F.x0 + F.xn) / 2, Y(142.62) + 0.25, (F.zn + 15.74) / 2] });
    roomsOut.push({ id: 'terrasse', name: 'Terrasse (überdacht)', area: area, center: [(F.x0 + F.xn) / 2, (F.zn + 15.74) / 2], mesh: t, base: 0x6e7176 });
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
    root: root, groups: { house: gHouse, inner: gInner, roof: gRoof, garden: gGarden, terrain: gTerrain, marks: gMarks },
    terrain: root.userData.terrain, pickables: pickables, tags: tags, rooms: roomsOut, zones: zones, info: info,
    groundY: groundY, bounds: BOUNDS, north: NORTH, H: H, datum: DATUM, sunDir: sunDir, roofH: roofH
  };
}
if (typeof module !== 'undefined') module.exports = { buildModel: buildModel };
