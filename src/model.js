/* Modell: baut Grundstück, Gelände, Haus, Räume, Dach und Außenanlagen.
   Koordinaten: x = Plan nach rechts, z = Plan nach unten (Meter), y = Höhe über 142,00 m ü. NN.
   Ursprung: nordwestliche Grundstücksecke des Lageplans.
   Rohbau-Maße (Achsen, Außenmaße, Wandtypen, Wände, Öffnungen, Räume, Dach, Treppe) kommen aus src/data/haus.json (Parameter haus),
   aufgelöst mit werteAufloesen() aus src/werte.js. Die Räume leitet raeumeAbleiten() aus den Wänden ab (src/raeume.js), die Dachhöhe
   dachAbleiten() (src/dach.js), die Prüfregeln pruefen() (src/pruefen.js) liefern die Befunde. Außenanlagen, Gelände und Ausstattung
   stehen noch als Zahlen in diesem Code. */
if (typeof require !== 'undefined') { var werteAufloesen = require('./werte.js').werteAufloesen, wandLinie = require('./raeume.js').wandLinie, raeumeAbleiten = require('./raeume.js').raeumeAbleiten, dachAbleiten = require('./dach.js').dachAbleiten, pruefen = require('./pruefen.js').pruefen; }
function buildModel(THREE, haus) {
  if (!haus) throw new Error('buildModel: Hausdaten (src/data/haus.json) fehlen');
  var WV = werteAufloesen(haus);
  function axM(n) { return WV.m(n); }                       // Achse oder Ausdruck in Metern, hausrelativ
  var LAGE = { x: haus.lage.x / 1000, z: haus.lage.z / 1000 };
  function stX(n) { return (haus.lage.x + WV.mm(n)) / 1000; } // Standortkoordinate x einer Achse
  function stZ(n) { return (haus.lage.z + WV.mm(n)) / 1000; }
  var DATUM = haus.bezug.nnDatum / 1000, NORTH = 26;
  var BOUNDS = { x0: -10, x1: 36, z0: -11, z1: 39 };
  var H = { FFB: haus.bezug.okffEG / 1000, EAVE: (haus.bezug.okffEG + haus.dach.traufe) / 1000, RIDGE: haus.pruefwerte.firstNN / 1000 };
  var PLOT = [[0, 0], [3.85, -0.25], [25.77, 2.975], [19.38, 23.805], [15.57, 26.795], [0, 26.795]];
  var EDGE_TXT = ['3,85', '22,25', '21,78', '4,84', '15,57', '26,80'];
  var F = { x0: stX('x.W'), x1: stX('x.O'), xn: stX('x.V'), z0: stZ('z.N'), zn: stZ('z.U'), z1: stZ('z.S') }; // Außenkanten des Hauses im Grundstückssystem
  var CEIL = haus.geschosse.EG.lichteHoehe / 1000, OVER = haus.dach.ueberstand / 1000;
  var RUN = (WV.mm(haus.dach.fluegelA.z[1]) - WV.mm(haus.dach.fluegelA.z[0])) / 2000; // halbe Tiefe Flügel A = Lage des Ost-West-Firsts
  var TAN = Math.tan(haus.dach.neigung * Math.PI / 180); // Dachneigung 35° laut Binderplan

  function Y(e) { return e - DATUM; }
  /* Pixel des Lageplan-Bildes -> Meter */
  function pl(px, py) { return [(px - 265) / 51.9, (py - 214) / 51.9]; }

  var root = new THREE.Group();
  var gHouse = new THREE.Group(), gInner = new THREE.Group(), gDG = new THREE.Group(), gRaf = new THREE.Group(), gDeck = new THREE.Group(), gRoof = new THREE.Group(), gGarden = new THREE.Group(), gTerrain = new THREE.Group(), gMarks = new THREE.Group();
  root.add(gTerrain, gHouse, gInner, gDG, gRaf, gRoof, gGarden, gMarks);
  gDG.add(gDeck);
  var pickables = [];
  var tags = [];

  function M(color, rough, metal, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough == null ? 0.9 : rough, metalness: metal || 0 }, extra || {}));
  }
  var mat = {
    plaster: M(0xece8df, 0.95), plasterIn: M(0xf5f3ee, 0.95), slab: M(0xaaa8a1, 0.95),
    roof: M(0x3d3734, 0.8, 0, { side: THREE.DoubleSide, flatShading: true }), // Ziegel dunkelbraun (Foto)
    glass: M(0x9ec7dc, 0.1, 0, { transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false }),
    door: M(0xf3f3f0, 0.5), frame: M(0xeeeeea, 0.5), concrete: M(0xc3c2bc, 0.95), // Türen und Rahmen weiß (Foto)
    carportRoof: M(0x93a09d, 0.7, 0.2), carportWall: M(0xd9d6cc, 0.95), wood: M(0xb48a5c, 0.8),
    metal: M(0x6b7178, 0.5, 0.5), hedge: M(0x2f5a33, 1), trunk: M(0x6b4a2f, 1), crown: M(0x4f7d3a, 1),
    crown2: M(0x6a9547, 1), water: M(0x4fc3d8, 0.1, 0, { transparent: true, opacity: 0.8 }), poolwall: M(0x7fa7cf, 0.6, 0, { side: THREE.DoubleSide }),
    bin1: M(0x2a2c30, 0.8), bin2: M(0xe0b52b, 0.8), stone: M(0xf2f0ea, 0.9), stoneTop: M(0xc8321e, 0.8),
    retain: M(0xb4b3ad, 0.95), step: M(0x9c9a94, 0.95), timber: M(0xc9a27a, 0.8), steelDark: M(0x2b2e33, 0.5, 0.6), chimney: M(0xd8d3c8, 0.95), chimneyOut: M(0x35383c, 0.85), sockel: M(0x46484b, 0.95), zinc: M(0xbfc3c6, 0.5, 0.4), glassDark: M(0x56616b, 0.2, 0.1), board: M(0xf0eee8, 0.95), oak: M(0xc89b64, 0.6), steel: M(0xb7bcc2, 0.35, 0.8),
    zaun: M(0x383e42, 0.55, 0.35), winkel: M(0x5b5c59, 0.95), stoop: M(0x3a3e44, 0.75), deckelBlau: M(0x1f5fb0, 0.6), deckelGelb: M(0xe5c617, 0.6), deckelSchwarz: M(0x26282c, 0.7)
  };
  mat.insul = M(0xcfd0cb, 0.95, 0, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  mat.kies = M(0x5b6168, 1); mat.kante = M(0x8c8e90, 0.95); // Spritzschutz: dunkelgrauer Splitt (Foto), Randstein aus Beton
  if (typeof document !== 'undefined') {
    var hc = document.createElement('canvas'); hc.width = hc.height = 128;
    var hg = hc.getContext('2d'); hg.fillStyle = '#d3d4cf'; hg.fillRect(0, 0, 128, 128);
    hg.strokeStyle = '#7a7e82'; hg.lineWidth = 3; hg.beginPath();
    for (var hi = -128; hi < 256; hi += 32) { hg.moveTo(hi, 0); hg.lineTo(hi + 128, 128); hg.moveTo(hi, 128); hg.lineTo(hi + 128, 0); }
    hg.stroke();
    var ht = new THREE.CanvasTexture(hc); ht.wrapS = ht.wrapT = THREE.RepeatWrapping; ht.repeat.set(1, 1);
    mat.insul.map = ht;
    var kc = document.createElement('canvas'); kc.width = kc.height = 256; // Splitt: Körner in Grautönen, Kachel 1 m × 1 m
    var kg = kc.getContext('2d'), ks = 7, kr = function () { ks = (ks * 16807) % 2147483647; return ks / 2147483647; };
    kg.fillStyle = '#565c63'; kg.fillRect(0, 0, 256, 256);
    for (var kk = 0; kk < 1400; kk++) { kg.fillStyle = ['#3d4247', '#494f55', '#6d737b', '#80868e', '#5f656c'][Math.floor(kr() * 5)]; kg.fillRect(kr() * 256, kr() * 256, 3 + kr() * 5, 3 + kr() * 4); }
    var kt = new THREE.CanvasTexture(kc); kt.wrapS = kt.wrapT = THREE.RepeatWrapping; kt.anisotropy = 4;
    mat.kies.map = kt; mat.kies.color.set(0xffffff);
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

  function bar(out, a, b, hn, t, h) { // Quader von a nach b, t quer waagerecht (Richtung hn), h senkrecht dazu; hängt 12 Dreiecke an out
    var d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]);
    d = [d[0] / L, d[1] / L, d[2] / L];
    var w = [d[1] * hn[2], d[2] * hn[0] - d[0] * hn[2], -d[1] * hn[0]], c = [], i, k;
    for (var e = 0; e < 2; e++) for (var sx = -1; sx <= 1; sx += 2) for (var sy = -1; sy <= 1; sy += 2) {
      var o = e ? b : a;
      c.push([o[0] + sx * hn[0] * t / 2 + sy * w[0] * h / 2, o[1] + sx * hn[1] * t / 2 + sy * w[1] * h / 2, o[2] + sx * hn[2] * t / 2 + sy * w[2] * h / 2]);
    }
    var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]].forEach(function (q) {
      var p0 = c[q[0]], p1 = c[q[1]], p2 = c[q[2]], p3 = c[q[3]];
      var nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]), ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]), nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
      var dot = nx * ((p0[0] + p2[0]) / 2 - mid[0]) + ny * ((p0[1] + p2[1]) / 2 - mid[1]) + nz * ((p0[2] + p2[2]) / 2 - mid[2]);
      if (dot < 0) { p1 = c[q[3]]; p3 = c[q[1]]; } // nach außen drehen
      [p0, p1, p2, p0, p2, p3].forEach(function (p) { out.push(p[0], p[1], p[2]); });
    });
  }
  function barMesh(out, m, parent, data) { // Netz aus den von bar() gesammelten Dreiecken, optional mit userData
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
    g.computeVertexNormals();
    var o = mesh(g, m, true, parent, true);
    if (data) o.userData = data;
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
        if (o.look === 'glas-oben') { // Nebeneingang (Foto): oben dunkles Glas, unten weiße Füllung, Griff an der Ostseite
          d.userData = { kind: 'nebeneingang-tuer', oben: 'glas', unten: 'fuellung' };
          var gl = mesh(new THREE.BoxGeometry(w * 0.8, hh * 0.44, 0.07), mat.glassDark, false, parent, false);
          gl.position.set(cx, y0 + o.sill + hh * 0.74, cz); gl.rotation.y = ang;
          var gr = mesh(new THREE.BoxGeometry(0.025, 0.22, 0.14), mat.steel, false, parent, false);
          gr.position.set(cx + ux * w * 0.38, y0 + o.sill + hh * 0.46, cz + uz * w * 0.38); gr.rotation.y = ang;
        }
        if (o.strip) { // senkrechter Glasstreifen im Türblatt
          var gs = mesh(new THREE.BoxGeometry(0.1, hh - 0.6, 0.07), mat.glassDark, false, parent, false);
          gs.position.set(cx + ux * o.strip * w, cy + 0.05, cz + uz * o.strip * w); gs.rotation.y = ang;
        }
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
  /* Straße: glatte Ebene (Ausgleichsebene durch die Höhen der Baustraße im Lageplan 2014) plus 15 cm für den endgültigen Belag
     (Schätzung des Nutzers vom 11.10.2026). Sie gilt für die graue Fläche östlich und südlich des Grundstücks; nördlich und westlich
     liegen die Nachbargrundstücke mit den Höhenpunkten des Lageplans. */
  var NEIGHBOR = [[-12, -12], [40, -12], [40, 5.1], [25.77, 2.975], [3.85, -0.25], [0, 0], [0, 26.795], [-12, 26.795]];
  var STR_UP = 0.15, CURB = 0.03; // Bordstein steht 3 cm über der Straße, das Pflaster schließt bündig an
  function strasseE(x, z) { return 141.468 + 0.00849 * x + 0.02559 * z + STR_UP; }
  /* Einfahrt: Pflasterhöhen als Dreiecksnetz (Angaben des Nutzers vom 11.10.2026, Fotos eingaben/bilder/foto-einfahrt-*).
     Haustür: Pflaster auf Schwellenhöhe (142,78 = 2 cm unter OK Fußboden, Annahme). Vor dem Nebeneingang 30 cm unter der Schwelle
     (142,50), Carport und Nordstreifen eben auf dieser Höhe. Von der Haustür bis zum Straßenrand stetig fallend. Straßenhöhen:
     an der Straße 3 cm über der Straßenebene (Bordstein).
     Stufe 30 cm südlich der Haustüröffnung (Tür und Seitenteil, z 12,01), 11 cm tief (Angabe Nutzer). Ausdehnung des tieferen Pflasters
     bis zum Gartentor fehlt noch. */
  var HOF_POLY = [[0.1, 0.35], [7.9, 0.35], [25.9, 3.04], [22.06, 15.72], [16.4, 13.6], [16.0, 13.6], [16.0, 5.74], [0.1, 5.74]];
  var HP = [
    [0.1, 0.35, 142.50], [7.9, 0.35, 142.50], [7.9, 5.74, 142.50], [0.1, 5.74, 142.50], // Carport
    [16.0, 5.74, 142.50],                                                              // Nordostecke Haus
    [16.0, 11.1, 142.78], [16.0, 13.6, 142.78],                                        // Haustür
    [25.9, 3.04, strasseE(25.9, 3.04) + CURB], [24.7, 7.0, strasseE(24.7, 7.0) + CURB], [23.46, 11.1, strasseE(23.46, 11.1) + CURB], [22.06, 15.72, strasseE(22.06, 15.72) + CURB], // Straßenrand
    [17.2, 11.1, 142.78]                                                               // ebener Absatz vor der Haustür (1,2 m)
  ];
  var HT = [[0, 1, 2], [0, 2, 3], [1, 2, 4], [1, 4, 7], [4, 7, 8], [4, 8, 11], [8, 9, 11], [9, 10, 11], [10, 6, 11], [6, 5, 11], [5, 4, 11]];
  function pflasterOben(x, z) { // Dreieck mit größtem kleinsten Schwerpunktsmaß: innen exakt, knapp außerhalb fortgesetzt
    var best = -1e9, bh = 0;
    for (var i = 0; i < HT.length; i++) {
      var a = HP[HT[i][0]], b = HP[HT[i][1]], c = HP[HT[i][2]];
      var d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      var l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d;
      var l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d;
      var l3 = 1 - l1 - l2, mn = Math.min(l1, l2, l3);
      if (mn > best) { best = mn; bh = l1 * a[2] + l2 * b[2] + l3 * c[2]; }
    }
    return bh;
  }
  function inPoly(poly, x, z) {
    var ins = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[j], b = poly[i];
      if (((b[1] > z) !== (a[1] > z)) && (x < (a[0] - b[0]) * (z - b[1]) / (a[1] - b[1]) + b[0])) ins = !ins;
    }
    return ins;
  }
  var STEP_Z = F.z0 + 6.27 + 0.30, STEP_H = 0.11; // Stufe: 30 cm südlich der Haustüröffnung (hz 6,27), 11 cm tief
  function pflasterE(x, z) { // südlich der Stufe 11 cm tiefer, aber nie unter der Straße am Bordstein
    var h = pflasterOben(x, z);
    return z > STEP_Z && !inBed(x, z) ? Math.max(h - STEP_H, strasseE(x, z) + CURB) : h;
  }
  /* Vorbeet: Mauer aus Winkelsteinen steht BED_WALL über dem Pflaster heraus (Annahme 30 cm, Fotos), Erde liegt darin */
  var BED = { c: pl(1355, 780), w: 3.5, h: 5.8, rot: 18 }, BED_R = 0.7, BED_WALL = 0.30;
  function bedLocal(x, z) {
    var a = BED.rot * Math.PI / 180, dx = x - BED.c[0], dz = z - BED.c[1];
    return [dx * Math.cos(a) + dz * Math.sin(a), -dx * Math.sin(a) + dz * Math.cos(a)];
  }
  function inBed(x, z) {
    var q = bedLocal(x, z), ex = Math.max(Math.abs(q[0]) - (BED.w / 2 - BED_R), 0), ez = Math.max(Math.abs(q[1]) - (BED.h / 2 - BED_R), 0);
    return ex * ex + ez * ez <= BED_R * BED_R;
  }
  var BLEND = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3]; // Übergang Grundstück – Umgebung: schmal, an den Straßen setzt der Bordstein die Kante
  function sm(t) { return t * t * (3 - 2 * t); }
  function groundE(x, z) {
    if (inPoly(HOF_POLY, x, z)) return inBed(x, z) ? pflasterOben(x, z) + BED_WALL : pflasterE(x, z);
    var info = polyInfo(x, z), g = idw(GP, x, z), e = inPoly(NEIGHBOR, x, z) ? idw(EP, x, z) : strasseE(x, z);
    if (info.d <= 0) return g;
    var w = BLEND[info.edge];
    if (info.d >= w) return e;
    return g + (e - g) * sm(info.d / w);
  }
  function groundY(x, z) { return Y(groundE(x, z)); }

  var TSTEP = 0.25; // Rasterweite des Geländenetzes
  (function buildTerrain() {
    var step = TSTEP, B = BOUNDS;
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

  /* Höhe des sichtbaren Geländenetzes: Dreiecksinterpolation über dem Raster wie in buildTerrain (Diagonale b–c), damit Zaunfüße darauf stehen */
  function meshY(x, z) {
    var i = Math.floor((x - BOUNDS.x0) / TSTEP), j = Math.floor((z - BOUNDS.z0) / TSTEP), x0 = BOUNDS.x0 + i * TSTEP, z0 = BOUNDS.z0 + j * TSTEP;
    var u = (x - x0) / TSTEP, v = (z - z0) / TSTEP;
    var a = groundY(x0, z0), b = groundY(x0 + TSTEP, z0), c = groundY(x0, z0 + TSTEP), d = groundY(x0 + TSTEP, z0 + TSTEP);
    return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
  }

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
  var yF = Y(H.FFB), yE = Y(H.EAVE), yC = yF + CEIL, yD = yF + haus.geschosse.DG.okff / 1000; // Geschosshöhe OKFF–OKFF 2,971 m, Decke 44,6 cm (Treppenplanung)
  function polyAx(pts) { return pts.map(function (q) { return [axM(q[0]), axM(q[1])]; }); } // Polygon aus Achsen, hausrelativ in Metern
  var footPts = polyAx(haus.huelle.aussen).map(function (q) { return [LAGE.x + q[0], LAGE.z + q[1]]; });
  function shapeOf(pts, holes) {
    var s = new THREE.Shape();
    pts.forEach(function (p, i) { if (i) s.lineTo(p[0], -p[1]); else s.moveTo(p[0], -p[1]); });
    s.closePath();
    (holes || []).forEach(function (hp) {
      var h = new THREE.Path();
      hp.forEach(function (p, i) { if (i) h.lineTo(p[0], -p[1]); else h.moveTo(p[0], -p[1]); });
      h.closePath(); s.holes.push(h);
    });
    return s;
  }
  (function slab() {
    var g = new THREE.ExtrudeGeometry(shapeOf(footPts), { depth: yF - 0.0, bevelEnabled: false });
    var o = mesh(g, mat.sockel, true, gHouse, true);
    o.rotation.x = -Math.PI / 2; o.position.y = 0.0;
  })();

  var ABL = raeumeAbleiten(haus, WV), DACH = dachAbleiten(haus, WV), BEFUNDE = pruefen(haus, WV, ABL, DACH); // Räume, Dachhöhe und Prüfbefunde aus den Daten
  var HW = axM('x.O') - axM('x.W'), HD = axM('z.S') - axM('z.N'), XL = axM('x.V') - axM('x.W'), ZU = axM('z.U') - axM('z.N');
  function P(x, z) { return [F.x0 + x, F.z0 + z]; }
  var ZS = axM('z.ZS');                                 // Nordseite Wand Nähzimmer / Speisekammer (Anker der Treppe)

  /* Wände aus haus.json: Mittellinie, Dicke und Normale (in mm, hausrelativ) liefert wandLinie() aus src/raeume.js. */
  var OEFFNUNG_ART = { fenster: 'glass', fenstertuer: 'glass', tuer: 'door', durchgang: 'gap' };
  function wandOeffnungen(w, ln) { // Öffnungen in Metern ab Wandanfang; ab als Zahl = mm ab Wandanfang, als Achse = Lage auf der Achse
    var along = Math.abs(ln.b[0] - ln.a[0]) >= Math.abs(ln.b[1] - ln.a[1]) ? 0 : 1, dir = ln.b[along] >= ln.a[along] ? 1 : -1;
    return (w.oeffnungen || []).map(function (o) {
      var ab = typeof o.ab === 'number' ? o.ab : (WV.mm(o.ab) - ln.a[along]) * dir, sill = o.bruestung || 0;
      var r = { a: ab / 1000, b: (ab + o.breite) / 1000, sill: sill / 1000, head: (sill + o.hoehe) / 1000, type: OEFFNUNG_ART[o.art] };
      if (o.felder) r.parts = o.felder;
      if (o.aussehen) r.look = o.aussehen;
      if (o.streifen) r.strip = o.streifen;
      return r;
    });
  }
  // Fenster: Brüstung 1,125, sichtbare Höhe 1,25 (Rohbauöffnung 1,50 inkl. Rollladenkasten), Oberkante wie Türen 2,375 (Daten: bruestung + hoehe)
  haus.waende.forEach(function (w) {
    if (w.geschoss !== 'EG') return;
    var ln = wandLinie(haus, WV, w), os = wandOeffnungen(w, ln), typ = haus.wandtypen[w.typ], y1 = w.hoehe === 'traufe' ? yE : yC;
    var a = P(ln.a[0] / 1000, ln.a[1] / 1000), b = P(ln.b[0] / 1000, ln.b[1] / 1000);
    if (typ.schichten) { // Außenwand: Schichten von außen (Flucht-Seite) nach innen, nur die innerste trägt Fenster und Türen
      var off = ln.t / 2;
      typ.schichten.forEach(function (sc, i) {
        var dk = sc[1], c = (off - dk / 2) / 1000, innen = i === typ.schichten.length - 1;
        var sa = [a[0] + ln.n[0] * c, a[1] + ln.n[1] * c], sb = [b[0] + ln.n[0] * c, b[1] + ln.n[1] * c];
        var lo = innen ? os : os.map(function (o) { return { a: o.a, b: o.b, sill: o.sill, head: o.head, type: 'gap' }; });
        wall(sa, sb, dk / 1000, yF, y1, lo, gHouse, 0, i === 0 ? mat.plaster : mat.plasterIn);
        off -= dk;
      });
    } else {
      wall(a, b, ln.t / 1000, yF, y1, os, gInner, (w.verlaengerung || 0) / 1000, mat.plasterIn);
    }
  });

  /* Räume (Polygone in hx/hz, Innenkanten). Der Vorraum mit Bad- und Ankleidetür gehört zum Elternschlafzimmer. */
  function mmPoly(ring) { return ring.map(function (q) { return [q[0] / 1000, q[1] / 1000]; }); } // Ring in mm → Meter, hausrelativ
  var BODEN = { holz: 0xb99466, fliese: 0xc9ced1, 'fliese-hell': 0xd8d4cb, beton: 0xbab8b1, dg: 0xcdae82 };
  var ROOMS = ABL.raeume.filter(function (r) { return r.geschoss === 'EG'; }).map(function (r) {
    return { id: r.id, name: r.name, col: BODEN[r.boden], poly: mmPoly(r.ring), holes: r.loecher.map(mmPoly), area: r.flaeche / 1e6 };
  });
  function polyArea(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
  function centroid(p) {
    var A = 0, cx = 0, cz = 0;
    for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length], c = a[0] * b[1] - b[0] * a[1]; A += c; cx += (a[0] + b[0]) * c; cz += (a[1] + b[1]) * c; }
    A /= 2; return [cx / (6 * A), cz / (6 * A)];
  }
  var roomsOut = [];
  ROOMS.forEach(function (r) {
    var pts = r.poly.map(function (q) { return P(q[0], q[1]); });
    var geo = new THREE.ShapeGeometry(shapeOf(pts, r.holes.map(function (h) { return h.map(function (q) { return P(q[0], q[1]); }); })));
    var m = M(r.col, 0.85);
    var o = new THREE.Mesh(geo, m);
    o.rotation.x = -Math.PI / 2; o.position.y = yF + 0.012; o.receiveShadow = true;
    gInner.add(o); pickables.push(o);
    var c = centroid(pts), area = r.area;
    roomsOut.push({ id: r.id, name: r.name, area: area, center: c, mesh: o, base: r.col, level: 'eg', poly: r.poly });
    tags.push({ kind: 'room', layer: 'rooms', level: 'eg', name: r.name, area: area, pos: [c[0], yF + 0.25, c[1]] });
  });
  // überdachte Terrasse und Terrassenplatten: Oberkante auf Höhe des Fußbodens innen (Angabe Nutzer)
  // Terrasse endet bündig mit der südlichen Hausaußenwand (Angabe Nutzer)
  var TERR = yF, TZ1 = F.z1;
  (function terrace() {
    var t = boxAt(3.4, 0.3, TZ1 - F.zn, M(0x6e7176, 0.9), (F.x0 + F.xn) / 2 + 0.0, TERR - 0.15, (F.zn + TZ1) / 2, gGarden);
    var area = 3.4 * (15.74 - F.zn);
    tags.push({ kind: 'room', layer: 'rooms', name: 'Terrasse (überdacht)', area: area, pos: [(F.x0 + F.xn) / 2, TERR + 0.25, (F.zn + 15.74) / 2] });
    roomsOut.push({ id: 'terrasse', name: 'Terrasse (überdacht)', area: area, center: [(F.x0 + F.xn) / 2, (F.zn + 15.74) / 2], mesh: t, base: 0x6e7176, level: 'out' });
  })();
  // Pergola (Aluminium anthrazit, Lamellendach weiß) auf dem nicht überdachten Teil der Terrasse: außen 3 × 5 m, 2,525 m hoch.
  // Angaben Nutzer: 30 cm vor der Westwand des Wohnzimmers, Südseite 5 cm hinter der Terrassenkante; hinten reicht sie unter den Dachüberstand
  (function pergola() {
    var x1 = XL - 0.30, x0 = x1 - 3.0, z1 = HD - 0.05, z0 = z1 - 5.0, H2 = 2.525, PW = 0.15, BH = 0.22;
    var alu = M(0x3a3d41, 0.6, 0.3), slat = M(0xe9e9e6, 0.6);
    var cx = P((x0 + x1) / 2, 0)[0], cz = P(0, (z0 + z1) / 2)[1], yb = TERR + H2 - BH / 2;
    [[x0, z0], [x1 - PW, z0], [x0, z1 - PW], [x1 - PW, z1 - PW]].forEach(function (q) {
      var c = P(q[0] + PW / 2, q[1] + PW / 2); boxAt(PW, H2, PW, alu, c[0], TERR + H2 / 2, c[1], gGarden);
    });
    boxAt(x1 - x0, BH, PW, alu, cx, yb, P(0, z0 + PW / 2)[1], gGarden);
    boxAt(x1 - x0, BH, PW, alu, cx, yb, P(0, z1 - PW / 2)[1], gGarden);
    boxAt(PW, BH, z1 - z0 - 2 * PW, alu, P(x0 + PW / 2, 0)[0], yb, cz, gGarden);
    boxAt(PW, BH, z1 - z0 - 2 * PW, alu, P(x1 - PW / 2, 0)[0], yb, cz, gGarden);
    var first = null;
    for (var z = z0 + PW + 0.1; z < z1 - PW - 0.05; z += 0.2) {
      var o = boxAt(x1 - x0 - 2 * PW, 0.03, 0.17, slat, cx, TERR + H2 - 0.1, P(0, z)[1], gGarden); first = first || o;
    }
    var c = P((x0 + x1) / 2, (z0 + z1) / 2), area = (x1 - x0) * (z1 - z0);
    tags.push({ kind: 'room', layer: 'rooms', name: 'Pergola', area: area, pos: [c[0], TERR + 0.25, c[1]] });
    roomsOut.push({ id: 'pergola', name: 'Pergola', area: area, center: c, mesh: first, base: 0xe9e9e6, level: 'out' });
  })();
  // Nebeneingang (Nordwand, Tür hx 5,555–6,565): zwei Stufen aus anthrazitfarbenem Stein à 15 cm, oben auf Schwellenhöhe (Fotos, Angabe Nutzer)
  var NE_X = F.x0 + 6.06, NE_Z = F.z0;
  (function nebeneingang() {
    function stufe(w, d, top, z1) {
      var gy = groundY(NE_X, z1 - d / 2), h = top - gy + 0.1;
      var o = boxAt(w, h, d, mat.stoop, NE_X, gy - 0.1 + h / 2, z1 - d / 2, gGarden);
      o.userData = { kind: 'stufe' };
    }
    stufe(1.05, 0.38, yF - 0.005, NE_Z);          // obere Stufe vor der Schwelle
    stufe(1.15, 0.38, yF - 0.155, NE_Z - 0.38);   // untere Stufe
  })();
  // Mülltonnen an der Nordwand: blau und gelb östlich der Tür, schwarz westlich beim Carportpfosten (Fotos)
  (function tonnen() {
    function tonne(x, z, deckel, dm, w, d, h) {
      var g = new THREE.Group(), gy = groundY(x, z);
      g.userData = { kind: 'tonne', deckel: deckel };
      var bg = new THREE.BoxGeometry(w, h - 0.12, d), pa = bg.attributes.position;
      for (var i = 0; i < pa.count; i++) if (pa.getY(i) < 0) { pa.setX(i, pa.getX(i) * 0.82); pa.setZ(i, pa.getZ(i) * 0.86); }
      bg.computeVertexNormals();
      var b = mesh(bg, mat.bin1, true, g, false); b.position.set(0, 0.06 + (h - 0.12) / 2, 0);
      var l = mesh(new THREE.BoxGeometry(w + 0.03, 0.07, d + 0.03), dm, true, g, false); l.position.set(0, h - 0.045, 0);
      [-1, 1].forEach(function (sx) { var r = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), mat.bin1, true, g, false); r.rotation.z = Math.PI / 2; r.position.set(sx * w * 0.4, 0.1, d * 0.28); });
      g.position.set(x, gy, z);
      gGarden.add(g);
    }
    var tz = NE_Z - 0.54;
    tonne(NE_X + 0.92, tz, 'gelb', mat.deckelGelb, 0.58, 0.72, 1.07);
    tonne(NE_X + 1.54, tz, 'blau', mat.deckelBlau, 0.58, 0.72, 1.07);
    tonne(NE_X - 1.06, tz, 'schwarz', mat.deckelSchwarz, 0.62, 0.76, 1.12);
  })();

  /* ---------- Dach (zwei Walmflügel, Höhe als Maximum beider) ---------- */
  function dachRechteck(r) { return { x0: F.x0 + r.x0 / 1000, x1: F.x0 + r.x1 / 1000, z0: F.z0 + r.z0 / 1000, z1: F.z0 + r.z1 / 1000 }; } // Dachflügel aus src/dach.js in Standortkoordinaten
  var AR = dachRechteck(DACH.A), BR = dachRechteck(DACH.B);
  var EPS = 1e-6;
  function inR(r, x, z) { return x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS; }
  function dR(r, x, z) { return Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z); }
  function roofH(x, z) { // Dachhaut in m ü. NN an der Standortstelle (x, z); -1e9 außerhalb des Daches
    var h = DACH.hoehe((x - F.x0) * 1000, (z - F.z0) * 1000);
    return h < -1e8 ? h : H.FFB + h / 1000;
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

  /* Dachrinnen an der Traufkante, Fallrohre DN 100 nach Plan („RR100“ an der NW-, NO- und SO-Ecke) */
  (function gutters() {
    var ye = Y(H.EAVE - OVER * TAN), gw = 0.12, gh = 0.1;
    var E = [[AR.x0, AR.z0], [BR.x1, AR.z0], [BR.x1, BR.z1], [BR.x0, BR.z1], [BR.x0, AR.z1], [AR.x0, AR.z1]];
    for (var i = 0; i < E.length; i++) {
      var a = E[i], b = E[(i + 1) % E.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      var nx = dz / L, nz = -dx / L; // nach außen (Umlauf im Uhrzeigersinn, z nach unten)
      boxAt(L + gw, gh, gw, mat.zinc, (a[0] + b[0]) / 2 + nx * gw / 2, ye - gh / 2 + 0.02, (a[1] + b[1]) / 2 + nz * gw / 2, gRoof, -Math.atan2(dz, dx));
    }
    var up = new THREE.Vector3(0, 1, 0);
    function rod(A, B, r) {
      var d = B.clone().sub(A), o = mesh(new THREE.CylinderGeometry(r, r, d.length(), 12), mat.zinc, true, gHouse, false);
      o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(up, d.normalize());
    }
    // [hx, hz, Richtung nach außen in x]; Rohrachse 11 cm vor der Außenwand
    [[-0.11, 0.31, -1], [HW + 0.11, 0.31, 1], [HW + 0.11, 14.39, 1]].forEach(function (q) {
      var p = P(q[0], q[1]), gx = q[2] < 0 ? AR.x0 - gw / 2 : BR.x1 + gw / 2, yt = ye - 0.35;
      rod(new THREE.Vector3(p[0], groundY(p[0], p[1]) - 0.05, p[1]), new THREE.Vector3(p[0], yt, p[1]), 0.05);
      rod(new THREE.Vector3(p[0], yt, p[1]), new THREE.Vector3(gx, ye - 0.06, p[1]), 0.05);
    });
  })();

  /* ---------- Dachausbau (DG) und Dachstuhl ---------- */
  (function dgLayer() {
    var inset = polyAx(haus.huelle.innen);
    // Treppenöffnung 99 cm vor der Wand Nähzimmer / Speisekammer, lichter Abstand der Treppenwände 1,60 m
    var stairHole = polyAx(haus.dg.treppenoeffnung);
    function holeOf(pts) {
      var h = new THREE.Path();
      pts.forEach(function (p, i) { var q = P(p[0], p[1]); if (i) h.lineTo(q[0], -q[1]); else h.moveTo(q[0], -q[1]); });
      h.closePath(); return h;
    }
    // Decke über dem EG = Boden des Dachausbaus
    var sh = shapeOf(inset.map(function (p) { return P(p[0], p[1]); }));
    sh.holes.push(holeOf(stairHole));
    var slab = mesh(new THREE.ExtrudeGeometry(sh, { depth: yD - yC, bevelEnabled: false }), mat.slab, true, gDeck, true);
    slab.rotation.x = -Math.PI / 2; slab.position.y = yC;
    // nicht ausgebauter Randbereich (schraffiert im Plan)
    var sh2 = shapeOf(inset.map(function (p) { return P(p[0], p[1]); }));
    sh2.holes.push(holeOf(stairHole));
    var ins = new THREE.Mesh(new THREE.ShapeGeometry(sh2), mat.insul);
    ins.rotation.x = -Math.PI / 2; ins.position.y = yD + 0.004; ins.receiveShadow = true; gDeck.add(ins); pickables.push(ins);
    // ausgebauter Bereich (weiß im Plan)
    // Trockenbauwände im DG einheitlich 12,5 cm (Annahme, genaue Maße folgen). Kniewände behalten die Planlage (Außenseite),
    // Treppenwände die Seite zur Treppe (lichter Abstand 1,60 m), Querwand und Trennwand ihre Mittellinie (Daten: Flucht der Wand).
    var zonePts = polyAx(haus.dg.ausbauflaeche);
    var zoneMat = M(0xcdae82, 0.8, 0, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    var zone = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(zonePts.map(function (p) { return P(p[0], p[1]); }))), zoneMat);
    zone.rotation.x = -Math.PI / 2; zone.position.y = yD + 0.008; zone.receiveShadow = true; gDeck.add(zone); pickables.push(zone);
    // Räume im Dachausbau (Innenmaße in hx/hz)
    var DGR = ABL.raeume.filter(function (r) { return r.geschoss === 'DG'; }).map(function (r) {
      return { id: r.id, name: r.name, poly: mmPoly(r.ring), holes: r.loecher.map(mmPoly), area: r.flaeche / 1e6 };
    });
    DGR.forEach(function (r) {
      var pts = r.poly.map(function (q) { return P(q[0], q[1]); });
      var mm = M(0xcdae82, 0.8, 0, { polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
      var rm = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(pts, r.holes.map(function (h) { return h.map(function (q) { return P(q[0], q[1]); }); }))), mm);
      rm.rotation.x = -Math.PI / 2; rm.position.y = yD + 0.01; rm.receiveShadow = true; gDeck.add(rm); pickables.push(rm);
      var c = centroid(pts), area = r.area;
      roomsOut.push({ id: r.id, name: r.name, area: area, center: c, mesh: rm, base: 0xcdae82, level: 'dg', poly: r.poly });
      tags.push({ kind: 'room', layer: 'rooms', level: 'dg', name: r.name, area: area, pos: [c[0], yD + 0.35, c[1]] });
    });

    // Wände des Dachausbaus, oben an der Dachschräge abgeschnitten
    // Oberkante: höchstens 2,45 m (bzw. hm) über dem Boden und mindestens 22 cm unter der Dachhaut, also unter den Sparren (DACH.wandOK, Werte in haus.dg)
    function topAt(x, z, hm, bOnly) { return yF + DACH.wandOK((x - F.x0) * 1000, (z - F.z0) * 1000, hm ? hm * 1000 : undefined, bOnly) / 1000; }
    function dgWall(x0, x1, z0, z1, hm, bOnly) {
      var horiz = (x1 - x0) >= (z1 - z0), len = horiz ? x1 - x0 : z1 - z0, n = Math.max(1, Math.ceil(len / 0.1)), t = horiz ? z1 - z0 : x1 - x0;
      var cA = horiz ? (z0 + z1) / 2 : (x0 + x1) / 2, s0 = horiz ? x0 : z0, ht = t / 2;
      var top = [], pos = [], i;
      function pt(i2, side, y) { var sv = s0 + len * i2 / n, c = cA + side * ht; var q = horiz ? P(sv, c) : P(c, sv); return [q[0], y, q[1]]; }
      for (i = 0; i <= n; i++) {
        var q = horiz ? P(s0 + len * i / n, cA) : P(cA, s0 + len * i / n);
        top.push(Math.max(yD, topAt(q[0], q[1], hm, bOnly)));
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
    // Wände des Dachausbaus aus haus.json: Kniewände (max. 1 m), Quer-, Trenn- und Treppenwände. Öffnungen mit hoehe "voll" reichen bis zur
    // Oberkante; die Wand wird dort in zwei Stücke geteilt.
    haus.waende.forEach(function (w) {
      if (w.geschoss !== 'DG') return;
      var ln = wandLinie(haus, WV, w), hm = w.hoehe && w.hoehe.max ? w.hoehe.max / 1000 : undefined, bOnly = w.dach === 'B';
      var horiz = ln.a[1] === ln.b[1], half = ln.t / 2;
      var s0 = horiz ? Math.min(ln.a[0], ln.b[0]) : Math.min(ln.a[1], ln.b[1]), s1 = horiz ? Math.max(ln.a[0], ln.b[0]) : Math.max(ln.a[1], ln.b[1]);
      var c = horiz ? ln.a[1] : ln.a[0], dir = (horiz ? ln.b[0] - ln.a[0] : ln.b[1] - ln.a[1]) >= 0 ? 1 : -1;
      var cuts = (w.oeffnungen || []).map(function (o) { // Beginn der Öffnung in Laufrichtung, dann als Bereich von–bis
        var p0 = typeof o.ab === 'number' ? (dir > 0 ? s0 + o.ab : s1 - o.ab) : WV.mm(o.ab);
        return dir > 0 ? [p0, p0 + o.breite] : [p0 - o.breite, p0];
      }).sort(function (p, q) { return p[0] - q[0]; });
      var from = s0, segs = [];
      cuts.forEach(function (k) { segs.push([from, k[0]]); from = k[1]; });
      segs.push([from, s1]);
      segs.forEach(function (sg) {
        if (sg[1] - sg[0] < 1e-6) return;
        if (horiz) dgWall(sg[0] / 1000, sg[1] / 1000, (c - half) / 1000, (c + half) / 1000, hm, bOnly);
        else dgWall((c - half) / 1000, (c + half) / 1000, sg[0] / 1000, sg[1] / 1000, hm, bOnly);
      });
    });
    // Treppe nach Treppenplanung (Wortmann): 15 Steigungen à 19,81 cm, Auftritt 25 cm, Laufbreite 1,0125 m,
    // Viertelwendelung (Stufen 1 bis 6) an der Ostwand, danach gerader Lauf nach Westen. (u, v) = Maße der Zeichnung ab Innenecke.
    (function stair() {
      var T = haus.treppe, rise = (yD - (yF + 0.012)) / T.steigungen, TH = 0.044, W = T.laufbreite / 1000, PV = [0.95, W];
      var U0 = T.geraderLaufAb / 1000, U1 = T.laufEnde / 1000;                  // u-Maße des geraden Laufs (Stufe 7 bis Austritt)
      function toP(u, v) { return P(axM(T.anker[0]) - u, axM(T.anker[1]) - v); }
      function top(n) { return yF + 0.012 + n * rise; }
      var UN = []; for (var i = 7; i <= 15; i++) UN[i] = U0 + (i - 7) * ((U1 - U0) / 8);
      var polys = {
        1: [[0, 1.4], [0.95, 1.4], PV, [0, 1.16]],
        2: [[0, 1.16], PV, [0, 0.70]],
        3: [[0, 0.70], PV, [0, 0.25]],
        4: [[0, 0.25], PV, [0.35, 0], [0, 0]],
        5: [[0.35, 0], PV, [0.80, 0]],
        6: [[0.80, 0], PV, [U0, W], [U0, 0]]
      };
      for (var n = 7; n <= 14; n++) polys[n] = [[UN[n], 0], [UN[n + 1], 0], [UN[n + 1], W], [UN[n], W]];
      Object.keys(polys).forEach(function (k) {
        var g = new THREE.ExtrudeGeometry(shapeOf(polys[k].map(function (p) { return toP(p[0], p[1]); })), { depth: TH, bevelEnabled: false });
        var o = mesh(g, mat.oak, true, gInner, true);
        o.rotation.x = -Math.PI / 2; o.position.y = top(+k) - TH;
      });
      // Geländer: Handlauf Eiche, Stäbe Edelstahl 16 mm
      // Geländer: von unten hoch, oben zweimal 90 Grad (15 cm) und zurück bis zur Dachschräge; Nische (54 cm) daneben
      var RB = T.gelaender / 1000, UE = axM('x.Oi') - axM('x.dgOi'), YT = top(15) + 0.9;
      var rp = [[0.95, 1.4, top(1) + 0.9], [0.95, W, top(4) + 0.9], [U0, W, top(7) + 0.9], [U1, W, YT], [U1, W + RB, YT], [UE, W + RB, YT]];
      function pt(p) { var q = toP(p[0], p[1]); return new THREE.Vector3(q[0], p[2], q[1]); }
      var up = new THREE.Vector3(0, 1, 0), lens = [];
      for (var j = 0; j < rp.length - 1; j++) {
        var A = pt(rp[j]), B = pt(rp[j + 1]), d = B.clone().sub(A), L = d.length();
        var bar = mesh(new THREE.BoxGeometry(L + 0.04, 0.07, 0.044), mat.oak, true, gInner, false);
        bar.position.copy(A).add(B).multiplyScalar(0.5);
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
        var segs = Math.max(1, Math.round(L / 0.125));
        for (var m = 0; m <= segs; m++) {
          var C = A.clone().lerp(B, m / segs), floorY = C.y - 0.9;
          if (m === 0 && j > 0) continue;
          var rod = mesh(new THREE.CylinderGeometry(0.008, 0.008, C.y - floorY - 0.07, 6), mat.steel, true, gInner, false);
          rod.position.set(C.x, floorY + (C.y - floorY - 0.07) / 2 + 0.0, C.z);
        }
      }
      // Pfosten oben an der Treppe und am Dachschrägenende
      [pt([U1, W, 0]), pt([UE, W + RB, 0])].forEach(function (pp) {
        var nw = mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), mat.oak, true, gInner, false);
        nw.position.set(pp.x, yD + 0.45, pp.z);
      });
      // Pfosten an der Wendelung
      var pv = pt([0.95, W, 0]); var post = mesh(new THREE.BoxGeometry(0.044, top(6) + 0.9 - top(1) + 0.2, 0.044), mat.oak, true, gInner, false);
      post.position.set(pv.x, (top(1) - 0.2 + top(6) + 0.9) / 2, pv.z);
    })();
  })();

  /* ---------- Kamin und Stützpfosten ---------- */
  (function structure() {
    // Kamin: Erdgeschoss bis über den First (Querschnitt 35 x 49 cm aus dem Plan, Höhe angenommen)
    (function () {
      var top = Y(149.6), c = P(axM('x.naehW') + 0.175, axM('z.ZSa') + 0.35 + 0.245), h = top - yF; // Westseite bündig mit der Westwand der Speisekammer (x.naehW), 35 cm südlich der Wand Nähzimmer / Speisekammer
      var yr = Math.min.apply(null, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (k) { return Y(roofH(c[0] + k[0] * 0.175, c[1] + k[1] * 0.245)); })) - 0.1;
      boxAt(0.35, yr - yF, 0.49, mat.chimney, c[0], (yF + yr) / 2, c[1], gHouse);
      boxAt(0.37, top - yr, 0.51, mat.chimneyOut, c[0], (yr + top) / 2, c[1], gHouse);
      boxAt(0.39, 0.04, 0.53, mat.steelDark, c[0], top + 0.02, c[1], gHouse);
      var fl = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 16), mat.steel, true, gHouse, false); fl.position.set(c[0], top + 0.2, c[1]);
      var hood = mesh(new THREE.ConeGeometry(0.15, 0.1, 16), mat.steel, true, gHouse, false); hood.position.set(c[0], top + 0.42, c[1]);
    })();
    // Terrasse: Stützpfosten unter der Dachüberstandsecke mit Schwellenkranz
    (function () {
      var ptop = yE - 0.2, pb = TERR, c = P(0.33, 9.20), white = M(0xf2f1ed, 0.8); // weiß gestrichen (Angabe Nutzer)
      boxAt(0.14, ptop - pb, 0.14, white, c[0], (ptop + pb) / 2, c[1], gHouse);
      var pw = P(0.33, (ZU + 9.27) / 2), ps = P((0.26 + 3.72) / 2, 9.20);
      boxAt(0.14, 0.16, 9.27 - ZU, white, pw[0], yE - 0.12, pw[1], gRaf);
      boxAt(3.72 - 0.26, 0.16, 0.14, white, ps[0], yE - 0.12, ps[1], gRaf);
    })();
    (function () { var q = P(axM('x.naehW') + 0.175, ZS + 0.71); tags.push({ kind: 'dim', layer: 'dims', text: 'Kamin', pos: [q[0], yC + 0.7, q[1]] }); })();
  })();

  /* ---------- Dachfenster und Dachaufbauten (Angaben des Nutzers vom 11.10.2026, Luftbild) ----------
     Fenster: Größe = Blendrahmenaußenmaß laut Herstellerdatenblatt (Roto Designo R8: 07/14 = 740 × 1400 mm, 11/14 = 1140 × 1400 mm;
     VELUX GGU CK04 = 55 × 98 cm), Mitte aus dem Dachausbauplan. Dämmblock Roto: 800/1460 zu 740/1400, also 3 cm rundum.
     Aufbauten (Maße und Lage nach dem Luftbild geschätzt): zwei Solarkollektoren auf dem Westwalm, zwei PV-Module und die Satellitenschüssel
     auf dem Südwalm. Lokales System jedes Objekts: x quer zur Traufe, y Flächennormale, z die Dachschräge hinauf. */
  (function roofFixtures() {
    var AL = Math.atan(TAN), S35 = Math.sin(AL), C35 = Math.cos(AL);
    // Objekt in der Mitte (hx, hz) auf die Dachfläche setzen; o = Richtung der Dachfläche nach außen (x, z)
    function onRoof(o, hx, hz, kind, data) {
      var x = F.x0 + hx, z = F.z0 + hz, N = new THREE.Vector3(o[0] * S35, C35, o[1] * S35), ds = new THREE.Vector3(-o[0] * C35, S35, -o[1] * C35);
      var g = new THREE.Group(); g.userData = Object.assign({ kind: kind }, data || {});
      g.position.set(x, Y(roofH(x, z)), z);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(N, ds), N, ds));
      gRoof.add(g); return g;
    }
    function part(g, kind, w, h, l, x, y, z, m) { // Quader (Breite quer, Höhe senkrecht zur Fläche, Länge entlang der Schräge), y = Unterkante
      var b = mesh(new THREE.BoxGeometry(w, h, l), m, true, g, false); b.position.set(x, y + h / 2, z); if (kind) b.userData = { kind: kind }; return b;
    }
    function frame(g, kind, w, l, fb, h, y, m) { // Rahmen aus vier Leisten, Außenmaß w × l, Leistenbreite fb
      part(g, kind, w, h, fb, 0, y, -(l - fb) / 2, m); part(g, kind, w, h, fb, 0, y, (l - fb) / 2, m);
      part(g, kind, fb, h, l - 2 * fb, -(w - fb) / 2, y, 0, m); part(g, kind, fb, h, l - 2 * fb, (w - fb) / 2, y, 0, m);
    }
    mat.kolGlas = M(0x17337a, 0.25, 0.2); mat.kolRahmen = M(0xf2f1ed, 0.6); mat.pvRahmen = M(0x24272b, 0.5, 0.4); mat.dish = M(0x2b2e33, 0.5, 0.3, { side: THREE.DoubleSide });
    mat.pvZelle = M(0x161d33, 0.3, 0.25);
    if (typeof document !== 'undefined') { // Zellraster des PV-Moduls: 6 × 10 Zellen
      var pc = document.createElement('canvas'); pc.width = 192; pc.height = 320;
      var pg = pc.getContext('2d'); pg.fillStyle = '#161d33'; pg.fillRect(0, 0, 192, 320); pg.strokeStyle = '#3b4668'; pg.lineWidth = 2; pg.beginPath();
      for (var pi = 0; pi <= 6; pi++) { pg.moveTo(pi * 32, 0); pg.lineTo(pi * 32, 320); }
      for (var pj = 0; pj <= 10; pj++) { pg.moveTo(0, pj * 32); pg.lineTo(192, pj * 32); }
      pg.stroke(); mat.pvZelle.map = new THREE.CanvasTexture(pc); mat.pvZelle.color.set(0xffffff);
    }

    // Fenster: [Typ, hx, hz der Mitte, Richtung nach außen, Breite, Länge, Dämmblock rundum]
    var WIN = [
      ['Roto WSA 11/14 R89 G K WD AL', 8.245, 2.47, [0, -1], 1.14, 1.40, 0.03],   // Pias Zimmer, Nord
      ['Roto WDF 07/14 R89G K WD AL', 10.54, 6.835, [1, 0], 0.74, 1.40, 0.03],    // Pias Zimmer, Ost
      ['Roto WDF 07/14 R89G K WD AL', 5.96, 8.60, [-1, 0], 0.74, 1.40, 0.03],     // Arbeitszimmer, West
      ['Roto WDF 07/14 R89G K WD AL', 7.725, 12.24, [0, 1], 0.74, 1.40, 0.03],    // Arbeitszimmer, Süd
      ['Velux GGU CK04', 10.76, 8.57, [1, 0], 0.55, 0.98, 0]                      // Treppenhaus, Ost
    ];
    WIN.forEach(function (d) {
      var g = onRoof(d[3], d[1], d[2], 'dachfenster', { typ: d[0] }), w = d[4], l = d[5], fb = 0.045, y0 = 0.02;
      frame(g, 'blendrahmen', w, l, fb, 0.07, y0, mat.frame);                     // Blendrahmen, Leiste 4,5 cm (Lichtmaß 650/1310 bei 07/14)
      part(g, 'glas', w - 2 * fb, 0.012, l - 2 * fb, 0, y0 + 0.045, 0, mat.glass);
      if (d[6] > 0) frame(g, 'eindeckrahmen', w + 2 * d[6], l + 2 * d[6], d[6], 0.03, y0 - 0.01, mat.zinc); // Dämmblock mit Eindeckrahmen
    });

    // Solarkollektoren auf dem Westwalm: zwei Flachkollektoren nebeneinander, mittig auf der Walmachse (hz 4,725),
    // von 1,4 bis 3,7 m Abstand zur Traufe entlang der Schräge (Luftbild), je 1,18 × 2,30 m, 5 cm Fuge
    (function () {
      var KW = 1.18, KL = 2.30, GAP = 0.05, s = 1.4 + KL / 2, hxm = AR.x0 - F.x0 + s * C35;
      [-1, 1].forEach(function (k) {
        var g = onRoof([-1, 0], hxm, 4.725 + k * (KW + GAP) / 2, 'kollektor', { b: KW, l: KL });
        frame(g, null, KW, KL, 0.045, 0.07, 0.03, mat.kolRahmen);
        part(g, null, KW - 0.09, 0.012, KL - 0.09, 0, 0.03 + 0.05, 0, mat.kolGlas);
      });
    })();

    // Photovoltaik auf dem Südwalm: zwei Module hochkant nebeneinander, mittig auf der Firstachse (hx 8,225),
    // von 0,45 bis 2,20 m Abstand zur Traufe entlang der Schräge, je 1,13 × 1,75 m, 2 cm Fuge, parallel zur Dachfläche aufgeständert
    (function () {
      var PW = 1.13, PL = 1.75, GAP = 0.02, s = 0.45 + PL / 2, hzm = (HD + OVER) - s * C35;
      [-1, 1].forEach(function (k) {
        var g = onRoof([0, 1], 8.225 + k * (PW + GAP) / 2, hzm, 'pvmodul', { b: PW, l: PL });
        [-0.3, 0.3].forEach(function (f) { part(g, null, PW + 0.0, 0.03, 0.04, 0, 0.02, f * PL, mat.zinc); });  // Montageschienen
        frame(g, null, PW, PL, 0.035, 0.035, 0.05, mat.pvRahmen);
        var cell = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.07, 0.012, PL - 0.07), [mat.pvRahmen, mat.pvRahmen, mat.pvZelle, mat.pvRahmen, mat.pvRahmen, mat.pvRahmen]);
        cell.position.set(0, 0.05 + 0.0175, 0); cell.castShadow = true; cell.receiveShadow = true; g.add(cell);
      });
    })();

    // Satellitenschüssel, 80 cm, rechts neben dem Südfenster und über den PV-Modulen, auf einem Mast mit Fußplatte.
    // Ausrichtung (angenommen): Azimut 163° (Astra 19,2° Ost), Schüsselfläche 40° aufwärts geneigt
    (function () {
      var x = F.x0 + 8.95, z = F.z0 + (HD + OVER) - 3.6 * C35, r = 0.4, hd = 0.09, R = (r * r + hd * hd) / (2 * hd);
      var g = new THREE.Group(); g.userData = { kind: 'satellitenschuessel' }; g.position.set(x, Y(roofH(x, z)), z); gRoof.add(g);
      var plate = mesh(new THREE.BoxGeometry(0.22, 0.012, 0.22), mat.zinc, true, g, false); plate.position.y = 0.006;
      var mast = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), mat.zinc, true, g, false); mast.position.y = 0.25;
      var d = new THREE.Group(); d.position.y = 0.5; g.add(d);
      var a = (NORTH + 163) * Math.PI / 180, e = 40 * Math.PI / 180, D = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
      d.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), D.clone().negate(), new THREE.Vector3(0, 1, 0)));
      var cg = new THREE.SphereGeometry(R, 32, 6, 0, 2 * Math.PI, 0, Math.asin(r / R)); cg.rotateX(-Math.PI / 2); cg.translate(0, 0, R); // Kugelkappe, hohle Seite nach +z
      var sc = mesh(cg, mat.dish, true, d, false); sc.userData = { kind: 'schuessel' };
      var arm = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.66, 8), mat.zinc, true, d, false);
      arm.position.set(0, -0.29, 0.30); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.22, 0.41).normalize());
      var lnb = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 10), mat.zinc, true, d, false); lnb.position.set(0, -0.18, 0.5); lnb.rotation.x = Math.PI / 2;
      var back = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8), mat.zinc, true, d, false); back.position.set(0, -0.06, -0.1); back.rotation.x = Math.PI / 2 - 0.3;
    })();
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
    // Sparrenachsen aus dem Binderplan (Maße in hx/hz ab der nordwestlichen Außenkante)
    var LZ_R = [0.667, 1.667, 2.110, 2.995, 3.880, 4.765, 5.619, 6.412, 7.284, 8.166, 9.038, 9.890, 10.775, 11.660, 12.545, 12.988, 13.988]; // Ost-West-Sparren
    var LZ_W = []; for (var kz = 0; kz < 9; kz++) LZ_W.push(0.828 + 0.974 * kz);                                                              // Walm West, Achsabstand 97,4 cm
    var LX_N = [0.602, 1.464, 2.261, 2.929, 3.796, 4.326, 5.300, 6.274, 7.248, 8.222, 9.196, 10.170, 11.144, 12.118];                          // Nord-Süd-Sparren (Nordteil)
    var LX_S = [4.326, 5.300, 6.274, 7.248, 8.222, 8.874, 9.524, 10.170, 11.144, 12.118];                                                      // Südteil mit Zwischensparren
    var xs = F.x0 + RUN, zs = AR.z1;
    function ewLine(z, xa, xb) {
      for (var x = xa; x < xb - 1e-6; x += STEP) {
        var xe = Math.min(x + STEP, xb), g = grad((x + xe) / 2, z);
        if (!g || Math.abs(g[0]) + 1e-3 < Math.abs(g[1])) continue;
        addSeg(x, z, xe, z, 0.08, 0.18, 0.12);
      }
    }
    function nsLine(x, za, zb) {
      for (var z = za; z < zb - 1e-6; z += STEP) {
        var ze = Math.min(z + STEP, zb), g = grad(x, (z + ze) / 2);
        if (!g || Math.abs(g[1]) + 1e-3 < Math.abs(g[0])) continue;
        addSeg(x, z, x, ze, 0.08, 0.18, 0.12);
      }
    }
    LZ_W.forEach(function (hz) { ewLine(F.z0 + hz, x0, xs); });
    LZ_R.forEach(function (hz) { var z = F.z0 + hz; ewLine(z, z < zs ? xs : x0, x1); });
    LX_N.forEach(function (hx) { nsLine(F.x0 + hx, z0, zs); });
    LX_S.forEach(function (hx) { nsLine(F.x0 + hx, zs, z1); });
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
    var base = Y(142.50), hRoof = Y(142.25) + 2.6; // Boden: Pflaster auf Höhe Nebeneingang; Dach bleibt in der alten Höhe (Annahme)
    // Geräteraum
    var gx0 = 0.15, gx1 = 2.55, gz0 = 0.35, gz1 = 5.35;
    wall([gx0, gz0], [gx1, gz0], 0.15, base, hRoof, [], gGarden, 0.075, mat.carportWall);
    wall([gx1, gz0], [gx1, gz1], 0.15, base, hRoof, [{ a: 1.9, b: 3.0, sill: 0, head: 2.0, type: 'door' }], gGarden, 0.075, mat.carportWall);
    wall([gx1, gz1], [gx0, gz1], 0.15, base, hRoof, [], gGarden, 0.075, mat.carportWall);
    wall([gx0, gz1], [gx0, gz0], 0.15, base, hRoof, [], gGarden, 0.075, mat.carportWall);
    // Pfosten Carport: hintere Reihe direkt an der Hauswand (Angabe Nutzer), vordere im Abstand 4,95 m, damit keiner über die Grenze steht
    var pz1 = F.z0 - 0.07, pz0 = pz1 - 4.95;
    [[2.9, pz0], [2.9, pz1], [5.4, pz0], [5.4, pz1], [7.9, pz0], [7.9, pz1]].forEach(function (p) {
      var po = boxAt(0.14, hRoof - base, 0.14, mat.wood, p[0], (base + hRoof) / 2, p[1], gGarden);
      po.userData = { kind: 'carportpfosten' };
    });
    // Dach (flach)
    var ra = pl(268, 226), rb = pl(682, 512);
    boxAt(rb[0] - ra[0], 0.18, rb[1] - ra[1], mat.carportRoof, (ra[0] + rb[0]) / 2, hRoof + 0.09, (ra[1] + rb[1]) / 2, gGarden);
    tags.push({ kind: 'room', layer: 'rooms', name: 'Geräteraum', area: 12, pos: [(gx0 + gx1) / 2, base + 0.4, (gz0 + gz1) / 2] });
    tags.push({ kind: 'room', layer: 'rooms', name: 'Carport', area: 29, pos: [5.4, base + 0.4, 2.9] });
  })();

  var ZAUN_IN = 0.15, ZAUN_PW = 0.06, ZAUN_WIESE = 0.08; // Zaun: Achse 15 cm innerhalb der Grenzlinie, Pfosten 6 cm, an der Wiesenkante 8 cm auf der Wiesenseite (siehe zaun(); Hecke und Spritzschutz richten sich danach)
  var ZL, HECKE; // ZL: Eckpunkte der Zaunachse (von zaun() gesetzt), HECKE: Grundriss der Hecke (von garden() gesetzt); Sträucherband und Tor richten sich danach

  /* ---------- Garten: Pool, Beet, Spielgeräte, Hecke ---------- */
  (function garden() {
    var pc = pl(935, 1470), r = 3.66 / 2, PH = 0.76, py = Y(142.62); // Pool: Durchmesser 3,66 m, Höhe 76 cm (Angabe Nutzer 11.10.2026), Höhe ab Oberkante der Unterlage
    boxAt(4.0, 0.06, 4.0, M(0x3f6b3a, 1), pc[0], py + 0.03, pc[1], gGarden);
    var pool = new THREE.Group(); pool.userData = { kind: 'pool', d: 2 * r, h: PH };
    gGarden.add(pool);
    var wall1 = mesh(new THREE.CylinderGeometry(r, r, PH, 56, 1, true), mat.poolwall, true, pool, true);
    wall1.position.set(pc[0], py + 0.06 + PH / 2, pc[1]);
    var wat = mesh(new THREE.CircleGeometry(r - 0.03, 56), mat.water, false, pool, false);
    wat.rotation.x = -Math.PI / 2; wat.position.set(pc[0], py + 0.06 + PH - 0.08, pc[1]);
    var rim = mesh(new THREE.TorusGeometry(r - 0.04, 0.04, 8, 56), mat.metal, true, pool, false);
    rim.rotation.x = Math.PI / 2; rim.position.set(pc[0], py + 0.06 + PH - 0.04, pc[1]);
    // Beet mit Baum und Sträuchern
    var bc = BED.c;
    var tx = bc[0], tz = bc[1] + 0.2, ty = groundY(tx, tz);
    var tr = mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 10), mat.trunk, true, gGarden, false);
    tr.position.set(tx, ty + 1.1, tz);
    var cr = mesh(new THREE.SphereGeometry(1.35, 18, 14), mat.crown, true, gGarden, false);
    cr.position.set(tx, ty + 3.1, tz); cr.scale.set(1, 0.9, 1);
    [[-1.1, 1.65], [1.1, -2.0]].forEach(function (o) { // zwei der ersten vier Sträucher entfernt (Angabe Nutzer: einer stand auf der Straße, einer ragte über das Vorbeet)
      var s = mesh(new THREE.SphereGeometry(0.55, 12, 10), mat.crown2, true, gGarden, false);
      s.position.set(tx + o[0], groundY(tx + o[0], tz + o[1]) + 0.4, tz + o[1]); s.scale.set(1, 0.75, 1);
      s.userData = { kind: 'busch', r: 0.55 };
    });
    // Hecke an der Südgrenze: 2 m hoch ab Gelände (Angabe Nutzer 11.10.2026), 10 cm vom Zaun abgerückt. Tiefe 40 cm (Annahme), damit sie
    // zwischen Zaun und Pool passt. Ein durchgehender Körper, die Oberkante folgt dem Gelände (Stützstellen alle 0,5 m); Westende und
    // Südostende halten denselben Abstand zum Zaun.
    var hkH = 2.0, hkT = 0.4, hkG = 0.10;
    var hx0 = ZAUN_IN + ZAUN_PW / 2 + hkG, hx1 = PLOT[4][0] - 0.12, hz1 = PLOT[4][1] - ZAUN_IN - ZAUN_PW / 2 - hkG, hz0 = hz1 - hkT, hkn = Math.ceil((hx1 - hx0) / 0.5);
    var hp = [], hxs = [], hts = [], hbs = [];
    function hq(a, b, c, d, out) { // Viereck a-b-c-d mit der Normalen nach out (Richtung nach außen)
      var nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (nx * out[0] + ny * out[1] + nz * out[2] < 0) { var t = b; b = d; d = t; }
      [a, b, c, a, c, d].forEach(function (p) { hp.push(p[0], p[1], p[2]); });
    }
    for (var hki = 0; hki <= hkn; hki++) {
      var hx = hx0 + (hx1 - hx0) * hki / hkn;
      hxs.push(hx); hts.push(meshY(hx, (hz0 + hz1) / 2) + hkH);
      hbs.push(Math.min(meshY(hx, hz0), meshY(hx, hz1)) - 0.05);
    }
    for (var hkj = 0; hkj < hkn; hkj++) {
      hq([hxs[hkj], hts[hkj], hz0], [hxs[hkj + 1], hts[hkj + 1], hz0], [hxs[hkj + 1], hts[hkj + 1], hz1], [hxs[hkj], hts[hkj], hz1], [0, 1, 0]);      // oben
      hq([hxs[hkj], hbs[hkj], hz1], [hxs[hkj + 1], hbs[hkj + 1], hz1], [hxs[hkj + 1], hts[hkj + 1], hz1], [hxs[hkj], hts[hkj], hz1], [0, 0, 1]);      // Südseite
      hq([hxs[hkj], hbs[hkj], hz0], [hxs[hkj + 1], hbs[hkj + 1], hz0], [hxs[hkj + 1], hts[hkj + 1], hz0], [hxs[hkj], hts[hkj], hz0], [0, 0, -1]);     // Nordseite
    }
    hq([hxs[0], hbs[0], hz0], [hxs[0], hbs[0], hz1], [hxs[0], hts[0], hz1], [hxs[0], hts[0], hz0], [-1, 0, 0]);                                       // Westende
    hq([hxs[hkn], hbs[hkn], hz0], [hxs[hkn], hbs[hkn], hz1], [hxs[hkn], hts[hkn], hz1], [hxs[hkn], hts[hkn], hz0], [1, 0, 0]);                       // Ostende
    var hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hp), 3));
    hg.computeVertexNormals();
    mesh(hg, mat.hedge, true, gGarden, true).userData = { kind: 'hecke', hoehe: hkH };
    HECKE = { x0: hx0, x1: hx1, z0: hz0, z1: hz1 };
  })();

  /* ---------- Vorbeet: Mauer aus Winkelsteinen, innen bündig mit dem Beetumriss, steht BED_WALL über dem Pflaster ---------- */
  (function vorbeetMauer() {
    var a = BED.rot * Math.PI / 180, T = 0.30, hx = BED.w / 2 - BED_R, hz = BED.h / 2 - BED_R, pts = [];
    [[hx, hz, 0], [-hx, hz, 90], [-hx, -hz, 180], [hx, -hz, 270]].forEach(function (c) {
      for (var k = 0; k <= 4; k++) { var t = (c[2] + k * 22.5) * Math.PI / 180; pts.push([c[0] + BED_R * Math.cos(t), c[1] + BED_R * Math.sin(t)]); }
    });
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L < 1e-3) continue;
      var ux = (q[0] - p[0]) / L, uv = (q[1] - p[1]) / L, nu = uv, nv = -ux, n = Math.ceil(L / 0.45);
      for (var j = 0; j < n; j++) {
        var f = (j + 0.5) / n, lu = p[0] + (q[0] - p[0]) * f + nu * T / 2, lv = p[1] + (q[1] - p[1]) * f + nv * T / 2;
        var wx = BED.c[0] + lu * Math.cos(a) - lv * Math.sin(a), wz = BED.c[1] + lu * Math.sin(a) + lv * Math.cos(a);
        var wdx = ux * Math.cos(a) - uv * Math.sin(a), wdz = ux * Math.sin(a) + uv * Math.cos(a);
        var nwx = nu * Math.cos(a) - nv * Math.sin(a), nwz = nu * Math.sin(a) + nv * Math.cos(a); // Mauer außen: Fuß am Pflaster vor der Mauer
        var top = Y(pflasterOben(wx, wz)) + BED_WALL + 0.02, bot = Y(pflasterE(wx + nwx * (T / 2 + 0.1), wz + nwz * (T / 2 + 0.1))) - 0.08;
        var o = boxAt(L / n + 0.03, top - bot, T, mat.winkel, wx, (top + bot) / 2, wz, gGarden);
        o.rotation.y = -Math.atan2(wdz, wdx);
      }
    }
  })();

  /* ---------- Stufe südlich der Haustür: Randsteinreihe von der Hauswand bis zum Vorbeet, Oberkante auf dem höheren Pflaster ---------- */
  (function randsteine() {
    var x0 = F.x1, x1 = x0;
    while (x1 < 24 && !inBed(x1, STEP_Z)) x1 += 0.05;
    var n = Math.ceil((x1 - x0) / 0.5);
    for (var i = 0; i < n; i++) {
      var xa = x0 + (x1 - x0) * i / n, xb = x0 + (x1 - x0) * (i + 1) / n, xc = (xa + xb) / 2;
      var top = Y(pflasterOben(xc, STEP_Z)), bot = Y(pflasterE(xc, STEP_Z + 0.1)) - 0.08;
      var o = boxAt(xb - xa + 0.01, top - bot, 0.08, mat.winkel, xc, (top + bot) / 2, STEP_Z + 0.04, gGarden);
      o.userData = { kind: 'randstein' };
    }
  })();

  /* ---------- Bordstein zwischen Pflaster und Straße (Foto: heller Randstein), 15 cm breit, 3 cm über der Straße ---------- */
  (function bordstein() {
    var a = HOF_POLY[2], b = HOF_POLY[3], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux; // nach außen = Richtung Straße (Osten)
    var stone = M(0xc9c6bd, 0.9), n = Math.ceil(L / 0.5);
    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n, cx = a[0] + dx * f + nx * 0.075, cz = a[1] + dz * f + nz * 0.075;
      var top = Y(strasseE(cx, cz) + CURB), bot = Y(strasseE(cx, cz)) - 0.1;
      var o = boxAt(L / n + 0.02, top - bot, 0.15, stone, cx, (top + bot) / 2, cz, gGarden, -Math.atan2(dz, dx));
      o.userData = { kind: 'bordstein' };
    }
  })();

  /* ---------- Zaun: Doppelstabmatten in Anthrazit (Angaben des Nutzers vom 11.10.2026) ----------
     West 2 m hoch vom Carport bis zur Straße. Süd und Ost 1 m hoch an der Grundstücksgrenze entlang bis dorthin, wo die Wiese endet
     (Pflasterecke an der Straße), dann 1 m hoch an der Wiesenkante (Rand des Pflasters) bis zum Haus.
     Annahmen: Zaunachse 15 cm innerhalb der Grenzlinie (auf der Mauerkrone der Stützmauer, an der Wiesenkante 8 cm auf der Wiesenseite),
     Pfosten 6 × 6 cm im Abstand von höchstens 2,5 m, Matten 8/6/8 (waagerechte Doppelstäbe alle 20 cm, senkrechte Stäbe alle 5 cm),
     Höhe = Pfostenoberkante über dem Gelände am Pfosten. */
  (function zaun() {
    var IN = ZAUN_IN, WIESE_DZ = ZAUN_WIESE, PW = ZAUN_PW, ZW = 2.5, GAP = 0.04, CAP = 0.03;
    function innen(k, d) { // Eckpunkt k des Grundstücksumrisses um d nach innen verschoben (Gehrung)
      var n = PLOT.length, p = PLOT[(k + n - 1) % n], q = PLOT[k], r = PLOT[(k + 1) % n];
      var l1 = Math.hypot(q[0] - p[0], q[1] - p[1]), l2 = Math.hypot(r[0] - q[0], r[1] - q[1]);
      var n1 = [-(q[1] - p[1]) / l1, (q[0] - p[0]) / l1], n2 = [-(r[1] - q[1]) / l2, (r[0] - q[0]) / l2], f = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
      return [q[0] + (n1[0] + n2[0]) * f, q[1] + (n1[1] + n2[1]) * f];
    }
    function schnitt(p, d, q, e) { // Schnittpunkt der Geraden p + t·d und q + s·e
      var t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]);
      return [p[0] + d[0] * t, p[1] + d[1] * t];
    }
    function lauf(linien, H, seite, ohneStart) { // Linienzüge (je Liste von Punkten x, z) als ein Zaunnetz der Höhe H; ohneStart: am Anfang des ersten steht schon ein Pfosten
      var out = [];
      linien.forEach(function (pts, li) {
      for (var i = 0; i + 1 < pts.length; i++) {
        var p = pts[i], q = pts[i + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]), u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], hn = [-u[1], 0, u[0]], n = Math.ceil(L / ZW);
        function fuss(s) { return meshY(p[0] + u[0] * s, p[1] + u[1] * s); }
        for (var k = 0; k <= n; k++) {
          var s0 = L * k / n;
          if (k === 0 && (i > 0 || (li === 0 && ohneStart))) continue; // Eckpfosten stehen schon
          var px = p[0] + u[0] * s0, pz = p[1] + u[1] * s0, y0 = fuss(s0);
          bar(out, [px, y0 - 0.25, pz], [px, y0 + H, pz], hn, PW, PW);
        }
        for (var k2 = 0; k2 < n; k2++) { // eine Matte zwischen zwei Pfosten
          var a = L * k2 / n + PW / 2, b = L * (k2 + 1) / n - PW / 2, ya = fuss(a), yb = fuss(b), top = H - CAP - GAP, m = Math.ceil(top / 0.2) + 1, W = b - a;
          var at = function (s, y) { var f = (s - a) / W; return [p[0] + u[0] * s, ya + (yb - ya) * f + y, p[1] + u[1] * s]; };
          for (var j = 0; j < m; j++) { // Doppelstab: je ein Stab vor und hinter dem senkrechten Stab
            var yy = GAP + 0.01 + (top - 0.02) * j / (m - 1);
            [-1, 1].forEach(function (sd) {
              var o = [hn[0] * 0.007 * sd, 0, hn[2] * 0.007 * sd], c0 = at(a, yy), c1 = at(b, yy);
              bar(out, [c0[0] + o[0], c0[1], c0[2] + o[2]], [c1[0] + o[0], c1[1], c1[2] + o[2]], hn, 0.008, 0.008);
            });
          }
          var nv = Math.round(W / 0.05);
          for (var v = 0; v < nv; v++) {
            var sv = a + W * (v + 0.5) / nv;
            bar(out, at(sv, GAP), at(sv, GAP + top), hn, 0.006, 0.006);
          }
        }
      }
      });
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
      g.computeVertexNormals();
      var o2 = mesh(g, mat.zaun, true, gGarden, true);
      o2.receiveShadow = false;
      o2.userData = { kind: 'zaun', seite: seite, hoehe: H };
    }
    var sw = innen(5, IN), so = innen(4, IN), oe = innen(3, IN);
    var A = [HOF_POLY[3][0], HOF_POLY[3][1] + WIESE_DZ], B = [HOF_POLY[4][0], HOF_POLY[4][1] + WIESE_DZ], C = [F.x1 + PW / 2, HOF_POLY[5][1] + WIESE_DZ];
    var q = schnitt(oe, [PLOT[2][0] - PLOT[3][0], PLOT[2][1] - PLOT[3][1]], A, [B[0] - A[0], B[1] - A[1]]); // Ende der Wiese an der Straße
    // Gartentor (Angabe Nutzer 11.10.2026): 80 cm lichte Weite, gleich hinter dem kleinen Zaunstück an der Hauswand (Pfosten bei B und G2)
    var gu = [q[0] - B[0], q[1] - B[1]], gl = Math.hypot(gu[0], gu[1]), GB = 0.80;
    gu = [gu[0] / gl, gu[1] / gl];
    var G2 = [B[0] + gu[0] * (GB + PW), B[1] + gu[1] * (GB + PW)];
    ZL = { sw: sw, so: so, oe: oe, q: q, B: B, C: C, G2: G2 };
    lauf([[[sw[0], 5.46], sw]], 2.0, 'west');         // ab Südwestecke des Geräteraums (Carport) bis zur Straße
    lauf([[sw, so, oe, q]], 1.0, 'grenze', true);     // Süd-, Südost- und Ostgrenze bis zum Ende der Wiese
    lauf([[q, G2], [B, C]], 1.0, 'wiese', true);      // Wiesenkante von der Straße bis zum Gartentor, kleines Stück zwischen Tor und Hauswand
    (function gartentor() { // Flügel 78 cm in einem Rahmen aus 4-cm-Rohr, Füllung wie die Matten, Griff beidseitig an der Hausseite
      var tg = new THREE.Group(); tg.userData = { kind: 'gartentor', breite: GB, hoehe: 1.0 }; gGarden.add(tg);
      var hn = [-gu[1], 0, gu[0]], yB = meshY(B[0], B[1]), yG = meshY(G2[0], G2[1]), SL = GB + PW, s0 = PW / 2 + 0.01, s1 = SL - PW / 2 - 0.01, top = 1.0 - CAP - GAP, o = [], hd = [];
      function at(s, y) { var f = s / SL; return [B[0] + gu[0] * s, yB + (yG - yB) * f + y, B[1] + gu[1] * s]; }
      [s0 + 0.02, s1 - 0.02].forEach(function (s) { bar(o, at(s, GAP), at(s, GAP + top), hn, 0.04, 0.04); });
      [GAP + 0.02, GAP + top - 0.02].forEach(function (y) { bar(o, at(s0, y), at(s1, y), hn, 0.04, 0.04); });
      var m = 3, nv = Math.round((s1 - s0 - 0.08) / 0.05);
      for (var j = 1; j <= m; j++) [-1, 1].forEach(function (sd) {
        var y = GAP + 0.04 + (top - 0.08) * j / (m + 1), d = [hn[0] * 0.007 * sd, 0, hn[2] * 0.007 * sd], c0 = at(s0 + 0.04, y), c1 = at(s1 - 0.04, y);
        bar(o, [c0[0] + d[0], c0[1], c0[2] + d[2]], [c1[0] + d[0], c1[1], c1[2] + d[2]], hn, 0.008, 0.008);
      });
      for (var v = 0; v < nv; v++) { var sv = s0 + 0.04 + (s1 - s0 - 0.08) * (v + 0.5) / nv; bar(o, at(sv, GAP + 0.04), at(sv, GAP + top - 0.04), hn, 0.006, 0.006); }
      barMesh(o, mat.zaun, tg);
      [-1, 1].forEach(function (sd) { var c0 = at(s0 + 0.04, 0.55), c1 = at(s0 + 0.16, 0.55), d = [hn[0] * 0.03 * sd, 0, hn[2] * 0.03 * sd]; bar(hd, [c0[0] + d[0], c0[1], c0[2] + d[2]], [c1[0] + d[0], c1[1], c1[2] + d[2]], hn, 0.02, 0.02); });
      barMesh(hd, mat.steel, tg);
    })();
  })();

  /* ---------- Sträucherband an der Ostseite (Angabe des Nutzers vom 11.10.2026, Satellitenbild) ----------
     Neben dem Gartentor beginnend rund um die Ostseite herum, innen am Zaun, viele kleine und schmale Büsche und Sträucher bis zur Hecke;
     sie ersetzen die beiden runden Büsche an der Südostecke. Größen, Farben und Lage im Band sind Annahmen (Zufallsfolge, damit der Aufbau
     stets gleich bleibt): Abstand von der Zaunachse 0,50–1,15 m, Breite 0,3–0,7 m, Höhe 0,5–1,4 m, einzelne schlanke bis 1,7 m. */
  (function straeucher() {
    var pfad = [ZL.G2, ZL.q, ZL.oe, ZL.so], seed = 11, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var farben = [0x2f5a33, 0x2f5a33, 0x27442b, 0x27442b, 0x1f3a24, 0x3f6b35, 0x3f6b35, 0x55803c, 0x8a9a3c, 0xa9b34a, 0x5d3a30].map(function (c) { return M(c, 1); }); // überwiegend dunkelgrün, einzelne gelbgrüne und braunrote (Satellitenbild)
    var kugel = new THREE.SphereGeometry(1, 10, 8);
    function zaunAbstand(x, z) { // kleinster Abstand zur Zaunachse über alle Abschnitte (an den Ecken stehen die Sträucher des einen Abschnitts sonst im Zaun des nächsten)
      var best = 1e9;
      for (var k = 0; k + 1 < pfad.length; k++) {
        var p = pfad[k], q = pfad[k + 1], vx = q[0] - p[0], vz = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * vx + (z - p[1]) * vz) / (vx * vx + vz * vz)));
        best = Math.min(best, Math.hypot(x - p[0] - t * vx, z - p[1] - t * vz));
      }
      return best;
    }
    for (var i = 0; i + 1 < pfad.length; i++) {
      var a = pfad[i], b = pfad[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nrm = [-u[1], u[0]];
      for (var s = i === 0 ? 0.55 : 0.2; s < L; s += 0.18 + rnd() * 0.26) {
        var schlank = rnd() < 0.15, d = 0.50 + rnd() * 0.65, r = schlank ? 0.12 + rnd() * 0.08 : 0.17 + rnd() * 0.19, h = schlank ? 1.3 + rnd() * 0.4 : 0.5 + rnd() * 0.9;
        var x = a[0] + u[0] * s + nrm[0] * d, z = a[1] + u[1] * s + nrm[1] * d, f = farben[Math.floor(rnd() * farben.length)];
        if (zaunAbstand(x, z) < r + 0.08) continue; // nicht in den Zaun der Nachbarstrecke
        if (x > HECKE.x0 - r - 0.05 && x < HECKE.x1 + r + 0.05 && z > HECKE.z0 - r - 0.05 && z < HECKE.z1 + r + 0.05) continue; // nicht in die Hecke
        var o = mesh(kugel, f, true, gGarden, false);
        o.scale.set(r, h / 2, r); o.position.set(x, meshY(x, z) + h / 2 - 0.05, z);
        o.userData = { kind: 'strauch', r: r, h: h };
      }
    }
  })();

  /* ---------- Spritzschutzstreifen aus Kies an der Hauswand (Angabe des Nutzers vom 11.10.2026, Foto) ----------
     Ostseite von der Stufe (Randsteinreihe bei z 12,31) nach Süden, über das Zaunende hinaus, um die Südostecke und an der Südwand
     entlang bis zur Kante der Terrasse. An beiden Enden quer ein Abschlussstein (vor der Randsteinreihe der Stufe, an der Terrassenkante).
     Annahmen nach Foto: 40 cm breit, Kies 2 cm über dem Gelände, Betonrandstein und Abschlusssteine 8 cm breit, 4 cm über dem Gelände. */
  (function spritzschutz() {
    var W = 0.40, KB = 0.08, KH = 0.04, KO = 0.02;
    var xO = F.x1, zS = F.z1, xT = (F.x0 + F.xn) / 2 + 1.7;       // Ostwand, Südwand, Terrassenkante (x 6,5)
    var zE = STEP_Z + KB, zA = zE + KB;                            // südliche Kante der Randsteinreihe der Stufe, Anfang des Kieses hinter dem Abschlussstein
    var xA = xT + KB;                                              // Anfang des Kieses an der Südwand hinter dem Abschlussstein
    var kp = [], ku = [];
    function kv(x, z) { kp.push(x, meshY(x, z) + KO, z); ku.push(x, z); } // Eckpunkt auf dem Gelände, Textur nach Lageplan (1 m Kachel)
    function kies(x0, x1, z0, z1) { // Rechteck mit Stützstellen alle 0,25 m
      var nx = Math.max(1, Math.ceil((x1 - x0) / 0.25)), nz = Math.max(1, Math.ceil((z1 - z0) / 0.25));
      for (var i = 0; i < nx; i++) for (var j = 0; j < nz; j++) {
        var a = x0 + (x1 - x0) * i / nx, b = x0 + (x1 - x0) * (i + 1) / nx, c = z0 + (z1 - z0) * j / nz, d = z0 + (z1 - z0) * (j + 1) / nz;
        kv(a, c); kv(a, d); kv(b, d); kv(a, c); kv(b, d); kv(b, c);
      }
    }
    kies(xO, xO + W, zA, zS + W);       // Ostwand, bis über die Südostecke hinaus
    kies(xA, xO, zS, zS + W);           // Südwand bis zum Abschlussstein an der Terrassenkante
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(kp), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ku), 2));
    g.computeVertexNormals();
    var km = mesh(g, mat.kies, false, gGarden, true);
    km.receiveShadow = true; km.userData = { kind: 'kies', breite: W };
    function stein(art, xc, zc, w, d) { // Stein, Oberkante KH über dem Gelände
      var yc = meshY(xc, zc) + KH - 0.07;
      boxAt(w, 0.14, d, mat.kante, xc, yc, zc, gGarden).userData = { kind: art };
    }
    var xr = xO + W + KB / 2, zr = zS + W + KB / 2, ne = Math.ceil((zr + KB / 2 - zA) / 0.5), ns = Math.ceil((xO + W - xA) / 0.5);
    for (var i = 0; i < ne; i++) { var za = zA + (zr + KB / 2 - zA) * i / ne, zb = zA + (zr + KB / 2 - zA) * (i + 1) / ne; stein('kiesrand', xr, (za + zb) / 2, KB, zb - za + 0.005); } // Ostseite, schließt die Ecke
    for (var j = 0; j < ns; j++) { var xa = xA + (xO + W - xA) * j / ns, xb = xA + (xO + W - xA) * (j + 1) / ns; stein('kiesrand', (xa + xb) / 2, zr, xb - xa + 0.005, KB); } // Südseite bis zum Randstein der Ostseite
    stein('kiesabschluss', xO + (W + KB) / 2, zE + KB / 2, W + KB, KB);   // quer an der Stufe, über die ganze Streifenbreite samt Randstein
    stein('kiesabschluss', xT + KB / 2, zS + (W + KB) / 2, KB, W + KB);   // quer an der Terrassenkante
  })();

  /* ---------- Spielplatz: Spielturm mit Schaukel und Trampolin (Fotos und Luftbild vom 11.10.2026, Trampolin Angabe des Nutzers) ----------
     Spielturm aus Holz an der Westgrenze: Stauraum mit Brettertüren unter der Plattform, Geländer, blaues Planendach (First in Nord-Süd-Richtung),
     Leiter an der Ostseite, grüne Rutsche nach Norden. Der Schaukelbalken geht vom Turm nach Osten an der Hecke entlang: zwei rote Sitze, Trapez,
     Schräggestell nahe dem Ostende. Zwischen Schaukel und Pool steht das Trampolin (3 m Durchmesser, Fangnetz, sechs Pfosten).
     Alle Maße des Turms und der Schaukel sind aus Fotos und Luftbild geschätzt (Annahmen); Lage nach Luftbild, Rutsche gerade statt wellig. */
  (function spielplatz() {
    var xt = 1.95, zt = 24.3, g0 = meshY(xt, zt), HB = 0.65, PB = 0.09;       // Turmmitte, Gelände am Turm, halbe Kastenbreite, Pfostenstärke
    var KH = 1.10, DK = 1.15, TR = 2.15, FI = 2.95, RB = 1.85;                // Kasten, Plattformoberkante, Traufe, First, Dachbreite (Höhen über g0)
    var BX1 = 7.0, BY = 2.00, AX = 6.10, SX = [4.0, 5.0], TX = 6.60;           // Balkenende, Balkenmitte, Schräggestell, Sitze, Trapez
    var V = [1, 0, 0], Zr = [0, 0, 1];
    var holz = M(0xc08f55, 0.8), plane = M(0x1f4fb0, 0.65), rutscheM = M(0x2f9a80, 0.35), seilG = M(0x1f9d8a, 0.8), seilW = M(0xf0ede6, 0.8), sitzM = M(0xd9303a, 0.5);
    var kastenM = M(0xc3925a, 0.85);
    if (typeof document !== 'undefined') { // Bretterwand: acht waagerechte Bretter über die Kastenhöhe
      var bc = document.createElement('canvas'); bc.width = 32; bc.height = 256;
      var bg = bc.getContext('2d'); bg.fillStyle = '#c3925a'; bg.fillRect(0, 0, 32, 256); bg.fillStyle = '#7d5630';
      for (var bi = 1; bi < 8; bi++) bg.fillRect(0, bi * 32 - 1, 32, 2);
      kastenM.map = new THREE.CanvasTexture(bc); kastenM.color.set(0xffffff);
    }
    var turm = new THREE.Group(); turm.userData = { kind: 'spielturm' }; gGarden.add(turm);
    // Stauraum unter der Plattform, reicht 10 cm unter das Gelände
    var kasten = mesh(new THREE.BoxGeometry(2 * HB, KH + 0.1, 2 * HB), kastenM, true, turm, true);
    kasten.position.set(xt, g0 + (KH - 0.1) / 2, zt); kasten.userData = { kind: 'spielturm-kasten' };
    var w = [], r = [];
    bar(w, [xt, g0 + KH, zt], [xt, g0 + DK, zt], V, 2 * HB + 0.06, 2 * HB + 0.06);                  // Plattform
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (o) { var x = xt + o[0] * (HB - PB / 2), z = zt + o[1] * (HB - PB / 2); bar(w, [x, g0 - 0.1, z], [x, g0 + 2.38, z], V, PB, PB); });
    function gel(ax, az, bx, bz) { // Geländer: zwei Holme und Stäbe alle 10 cm
      var L = Math.hypot(bx - ax, bz - az), u = [(bx - ax) / L, (bz - az) / L], hn = [-u[1], 0, u[0]], n = Math.max(1, Math.round(L / 0.10));
      bar(w, [ax, g0 + DK + 0.05, az], [bx, g0 + DK + 0.05, bz], hn, 0.04, 0.05);
      bar(w, [ax, g0 + DK + 0.70, az], [bx, g0 + DK + 0.70, bz], hn, 0.05, 0.06);
      for (var i = 0; i <= n; i++) { var x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; bar(w, [x, g0 + DK + 0.07, z], [x, g0 + DK + 0.68, z], hn, 0.035, 0.03); }
    }
    var e = HB - PB / 2;
    gel(xt + e, zt + e, xt + e, zt - 0.20);       // Ostseite, offen an der Leiter
    gel(xt + e, zt + e, xt - e, zt + e);          // Südseite
    gel(xt - e, zt + e, xt - e, zt - e);          // Westseite
    gel(xt - e, zt - e, xt - 0.02, zt - e);       // Nordseite, offen an der Rutsche
    bar(w, [xt, g0 + FI - 0.03, zt - RB / 2], [xt, g0 + FI - 0.03, zt + RB / 2], V, 0.08, 0.07);   // Firstbalken
    barMesh(w, holz, turm);
    // Planendach: zwei Platten, First in Nord-Süd-Richtung
    var dach = [];
    bar(dach, [xt - RB / 2, g0 + TR, zt], [xt, g0 + FI, zt], Zr, RB, 0.012);
    bar(dach, [xt + RB / 2, g0 + TR, zt], [xt, g0 + FI, zt], Zr, RB, 0.012);
    barMesh(dach, plane, turm, { kind: 'spielturm-dach' });
    // Brettertüren: zwei schwarze Bänder an der Ostseite
    var bd = [];
    [0.80, 0.30].forEach(function (y) { bar(bd, [xt + HB + 0.008, g0 + y, zt - 0.05], [xt + HB + 0.008, g0 + y, zt + 0.55], V, 0.016, 0.04); });
    barMesh(bd, mat.steelDark, turm);
    // Leiter an der Ostseite, am Nordende, Sprossen bunt
    var lt = new THREE.Group(); lt.userData = { kind: 'leiter' }; turm.add(lt);
    var lw = [], zl = [zt - 0.55, zt - 0.20], x0 = xt + 1.20, x1 = xt + 0.70, y0 = g0 - 0.02, y1 = g0 + DK + 0.02;
    zl.forEach(function (z) { bar(lw, [x0, y0, z], [x1, y1, z], Zr, 0.04, 0.07); });
    barMesh(lw, holz, lt);
    [0xe0506a, 0x2aa89a, 0xf08a3a, 0x6cb44a].forEach(function (c, i) {
      var y = g0 + 0.28 + i * 0.26, t = (y - y0) / (y1 - y0), x = x0 + (x1 - x0) * t, o = [];
      bar(o, [x, y, zl[0]], [x, y, zl[1]], V, 0.03, 0.03);
      barMesh(o, M(c, 0.6), lt);
    });
    // Rutsche: grün, vom Nordrand der Plattform nach Norden, gerade statt wellig
    var rt = new THREE.Group(); rt.userData = { kind: 'rutsche' }; turm.add(rt);
    var rs = [], xs = xt + 0.25, za = zt - HB, zb = za - 2.15, ya = g0 + 1.13, yb = g0 + 0.10;
    bar(rs, [xs, ya, za], [xs, yb, zb], V, 0.46, 0.04);
    [-0.215, 0.215].forEach(function (o) { bar(rs, [xs + o, ya + 0.07, za], [xs + o, yb + 0.07, zb], V, 0.03, 0.12); });
    barMesh(rs, rutscheM, rt);
    // Schaukelbalken nach Osten, Schräggestell nahe dem Ostende
    var bm = [];
    bar(bm, [xt + HB + 0.05, g0 + BY, zt], [BX1, g0 + BY, zt], Zr, 0.12, 0.20);
    barMesh(bm, holz, turm, { kind: 'schaukelbalken' });
    var sg = new THREE.Group(); sg.userData = { kind: 'schaukelgestell' }; turm.add(sg);
    var gs = [];
    [-0.95, 0.95].forEach(function (o) { bar(gs, [AX, g0 + BY - 0.05, zt], [AX, meshY(AX, zt + o) - 0.05, zt + o], V, 0.09, 0.14); });
    bar(gs, [AX, g0 + 0.90, zt - 0.55], [AX, g0 + 0.90, zt + 0.55], V, 0.05, 0.07);
    barMesh(gs, holz, sg);
    // Sitze (rot, an grünen Seilen) und Trapez (weiße Seile, Holzstange)
    var sl = [];
    SX.forEach(function (x) {
      [-0.21, 0.21].forEach(function (o) { bar(sl, [x + o, g0 + BY - 0.10, zt], [x + o, g0 + 0.46, zt], Zr, 0.015, 0.015); });
      var s = [], gx = meshY(x, zt);
      bar(s, [x - 0.21, gx + 0.45, zt], [x + 0.21, gx + 0.45, zt], Zr, 0.17, 0.035);
      barMesh(s, sitzM, turm, { kind: 'schaukelsitz' });
    });
    barMesh(sl, seilG, turm);
    var tp = [], tw = [];
    [-0.28, 0.28].forEach(function (o) { bar(tw, [TX + o, g0 + BY - 0.10, zt], [TX + o, g0 + 1.27, zt], Zr, 0.015, 0.015); });
    bar(tp, [TX - 0.33, g0 + 1.25, zt], [TX + 0.33, g0 + 1.25, zt], Zr, 0.04, 0.04);
    barMesh(tw, seilW, turm);
    barMesh(tp, M(0xe8d8b0, 0.7), turm, { kind: 'trapez' });

    // Trampolin: blauer Randschutz, schwarze Matte, sechs Beine, sechs Pfosten (unten Schaum, oben Stahl) mit schwarzem Fangnetz
    var cx = 9.4, cz = 24.4, g1 = meshY(cx, cz), tg = new THREE.Group(); tg.userData = { kind: 'trampolin', d: 3.0 }; gGarden.add(tg);
    var blau = M(0x1d4fa6, 0.7, 0, { side: THREE.DoubleSide }), schwarz = M(0x1b1b1d, 0.9, 0, { side: THREE.DoubleSide }), schaum = M(0x1c1c1e, 0.95);
    var netz = M(0x111214, 1, 0, { transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
    var ring = mesh(new THREE.RingGeometry(1.10, 1.5, 48), blau, true, tg, false); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, g1 + 0.86, cz);
    var rim = mesh(new THREE.TorusGeometry(1.44, 0.06, 8, 48), blau, true, tg, false); rim.rotation.x = Math.PI / 2; rim.position.set(cx, g1 + 0.84, cz);
    var matte = mesh(new THREE.CircleGeometry(1.10, 48), schwarz, false, tg, false); matte.rotation.x = -Math.PI / 2; matte.position.set(cx, g1 + 0.845, cz);
    for (var k = 0; k < 6; k++) {
      var a1 = k * Math.PI / 3 + Math.PI / 6, lx = cx + 1.30 * Math.cos(a1), lz = cz + 1.30 * Math.sin(a1), lg = meshY(lx, lz), lh = g1 + 0.80 - (lg - 0.03);
      var bein = mesh(new THREE.CylinderGeometry(0.025, 0.025, lh, 8), mat.steel, true, tg, false); bein.position.set(lx, lg - 0.03 + lh / 2, lz);
      var a2 = k * Math.PI / 3, px = cx + 1.46 * Math.cos(a2), pz = cz + 1.46 * Math.sin(a2);
      var sc = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.64, 10), schaum, true, tg, false); sc.position.set(px, g1 + 1.18, pz);
      var pf = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.50, 8), mat.steel, true, tg, false); pf.position.set(px, g1 + 1.75, pz);
    }
    var nz = mesh(new THREE.CylinderGeometry(1.45, 1.45, 1.10, 36, 1, true), netz, false, tg, false); nz.position.set(cx, g1 + 1.45, cz);
  })();

  /* ---------- Beschriftungen: Höhen und Maße ---------- */
  function hTag(txt, x, z, yy) { tags.push({ kind: 'h', layer: 'heights', text: txt, pos: [x, yy, z] }); }
  var mw = [[270, 405, '142,25'], [970, 285, '142,25'], [270, 790, '142,45'], [270, 1115, '142,65']];
  mw.forEach(function (m) { var p = pl(m[0], m[1]); hTag('OK Mauer ' + m[2], Math.max(p[0], 0.4), Math.max(p[1], 0.4), groundY(p[0], p[1]) + 1.0); });
  hTag('OK FFB 142,80', F.x1 + 0.2, 8.4, yF + 0.3);
  hTag('Traufe 145,77', F.x0 + 0.4, F.z0 + 0.2, yE + 0.4);
  hTag('First 149,08', (AR.x0 + 5.25 + AR.x1 - 5.25) / 2, F.z0 + RUN, Y(H.RIDGE) + 0.5);
  hTag('Pflaster Nebeneingang 142,50', 9.3, 4.0, Y(142.50) + 0.2);
  hTag('Pflaster Haustür 142,78', 17.0, 11.1, Y(142.78) + 0.3);
  hTag('Pflaster südlich der Stufe 142,67', 17.2, 13.0, Y(142.67) + 0.3);
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
    neighbor: NEIGHBOR,
    paving: [[7.9, 0.35], [25.9, 3.04], [22.06, 15.72], [16.4, 13.6], [16.0, 13.6], [16.0, 5.74], [7.9, 5.74]],
    pavingWest: [pl(370, 510), pl(420, 510), pl(420, 1000), pl(370, 1000)],
    terrace: [[3.1, 12.6], [6.5, 12.6], [6.5, 20.4], [3.1, 20.4]],
    carport: [[0.1, 0.35], [7.9, 0.35], [7.9, 5.74], [0.1, 5.74]],
    poolSlab: [pl(830, 1368), pl(1037, 1368), pl(1037, 1575), pl(830, 1575)],
    mulch: [pl(1405, 1032), pl(1275, 1445), pl(1085, 1600)],
    bed: BED
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
    root: root, groups: { house: gHouse, inner: gInner, dg: gDG, rafters: gRaf, deck: gDeck, roof: gRoof, garden: gGarden, terrain: gTerrain, marks: gMarks },
    terrain: root.userData.terrain, pickables: pickables, tags: tags, rooms: roomsOut, zones: zones, info: info,
    groundY: groundY, pflasterE: pflasterE, bounds: BOUNDS, north: NORTH, H: H, datum: DATUM, levels: { eg: yF, dg: yD }, sunDir: sunDir, roofH: roofH,
    befunde: BEFUNDE, abgeleitet: ABL, dach: DACH, toWorld: P
  };
}
if (typeof module !== 'undefined') module.exports = { buildModel: buildModel };
