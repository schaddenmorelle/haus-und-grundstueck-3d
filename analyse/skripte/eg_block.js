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
  function xw(a, b, opens) { wall(P(a[0], a[1]), P(b[0], b[1]), TW, yF, yE, opens, gHouse, 0, mat.plaster); }
  function win(a, b) { return { a: a, b: b, sill: 1.125, head: 2.625, type: 'glass' }; }
  function gdoor(a, b) { return { a: a, b: b, sill: 0, head: 2.375, type: 'glass' }; }
  // Außenwände 38,5 cm (Öffnungen aus den Maßketten des Plans)
  xw([0, hw], [HW, hw], [{ a: 5.555, b: 6.565, sill: 0, head: 2.375, type: 'door' }, win(9.055, 10.565)]);
  xw([HW - hw, 0], [HW - hw, HD], [win(1.036, 1.783), win(3.056, 3.795), { a: 4.559, b: 6.29, sill: 0, head: 2.375, type: 'door' }, win(7.063, 8.548), win(11.944, 13.438)]);
  xw([HW, HD - hw], [XL, HD - hw], [gdoor(HW - 6.895, HW - 3.885)]);
  xw([XL + hw, HD], [XL + hw, ZU], [gdoor(HD - 14.27, HD - 13.26), gdoor(HD - 12.395, HD - 10.385), gdoor(HD - 9.27, HD - 7.26)]);
  xw([XL, ZU - hw], [0, ZU - hw], [{ a: XL - 3.25, b: XL - 1.75, sill: 1.5, head: 2.375, type: 'glass' }]);
  xw([hw, ZU], [hw, 0], [gdoor(ZU - 2.895, ZU - 0.885), gdoor(ZU - 5.145, ZU - 4.385)]);

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

