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
    function topAt(x, z) { var h = roofH(x, z); return h < -1e8 ? yD + 2.2 : Math.min(yD + 2.45, Y(h) - 0.07); }
    function dgWall(x0, x1, z0, z1, gap) {
      var horiz = (x1 - x0) >= (z1 - z0), len = horiz ? x1 - x0 : z1 - z0, n = Math.max(1, Math.ceil(len / 0.2)), t = horiz ? z1 - z0 : x1 - x0;
      for (var i = 0; i < n; i++) {
        var s0 = i * len / n, s1 = (i + 1) * len / n;
        var cx = horiz ? x0 + (s0 + s1) / 2 : (x0 + x1) / 2, cz = horiz ? (z0 + z1) / 2 : z0 + (s0 + s1) / 2;
        var q = P(cx, cz), top = topAt(q[0], q[1]);
        if (top - yD < 0.05) continue;
        var o = boxAt(horiz ? s1 - s0 + 0.002 : t, top - yD, horiz ? t : s1 - s0 + 0.002, mat.plasterIn, q[0], (yD + top) / 2, q[1], gDG);
      }
    }
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
      var lenx = 12.54 - 9.28, drop = 15 * rise, ang = Math.atan2(drop, 2.0 + 6 * 0.17 + 0.25 * 8 - 2.0);
      var ln = Math.hypot(lenx, drop);
      var o = boxAt(ln, 0.2, 0.05, mat.wood, F.x0 + (9.28 + 12.54) / 2, yD - drop / 2 - 0.1, F.z0 + zz, gDG);
      o.rotation.z = Math.atan2(-drop, lenx) * -1;
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

