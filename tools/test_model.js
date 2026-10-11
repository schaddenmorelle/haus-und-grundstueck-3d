/* Modelltest: feste Randbedingungen prüfen und Kennwerte mit tools/snapshot.json vergleichen.
   Aufruf: npm test        Snapshot nach gewollter Änderung neu schreiben: UPDATE=1 npm test */
const fs = require('fs'), path = require('path');
const THREE = require('three');
const { buildModel } = require('../src/model.js');
const SNAP = path.join(__dirname, 'snapshot.json');

const t0 = Date.now();
const m = buildModel(THREE);
console.log('build ms', Date.now() - t0);

let meshes = 0, tris = 0, bad = 0;
m.root.traverse(o => {
  if (!o.isMesh) return;
  meshes++;
  const g = o.geometry, p = g.attributes.position;
  tris += (g.index ? g.index.count : p.count) / 3;
  for (let i = 0; i < p.array.length; i++) if (!isFinite(p.array[i])) bad++;
});
m.root.updateMatrixWorld(true);
const roof = m.groups.roof.children[0];
roof.geometry.computeBoundingBox();
const ridge = roof.geometry.boundingBox.max.y + m.datum;
let minY = 1e9, maxY = -1e9; const tp = m.terrain.geometry.attributes.position;
for (let i = 0; i < tp.count; i++) { minY = Math.min(minY, tp.getY(i)); maxY = Math.max(maxY, tp.getY(i)); }

const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const cur = {
  meshes, tris: Math.round(tris), tags: m.tags.length,
  plotArea: r2(m.info.plotArea), footArea: r2(m.info.footArea),
  ridge: r3(ridge), levels: { eg: r3(m.levels.eg), dg: r3(m.levels.dg) },
  terrain: [r2(minY + m.datum), r2(maxY + m.datum)],
  rooms: {}
};
m.rooms.forEach(r => { cur.rooms[r.id] = { name: r.name, level: r.level, area: r2(r.area) }; });
console.log({ meshes: cur.meshes, tris: cur.tris, nonFinite: bad, ridge: cur.ridge });
m.rooms.forEach(r => console.log('  ' + r.level.padEnd(4) + r.name.padEnd(24) + r.area.toFixed(2) + ' m²'));

/* Feste Randbedingungen (AGENTS.md) */
const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
check(bad === 0, 'nicht endliche Koordinaten: ' + bad);
check(Math.abs(m.info.pitchDeg - 35) < 1e-6, 'Dachneigung ist ' + m.info.pitchDeg + '° statt 35°');
check(Math.abs(ridge - 149.08) < 0.01, 'First ' + ridge.toFixed(3) + ' statt 149,08');
check(Math.abs(m.roofH(3.05, 8) - 145.77) < 1e-6 && Math.abs(m.roofH(16.0, 8) - 145.77) < 1e-6, 'Traufe an der Außenwand nicht 145,77');
check(Math.abs(m.levels.dg - m.levels.eg - 2.971) < 1e-9, 'Geschosshöhe nicht 2,971 m');
const ids = new Set(); m.rooms.forEach(r => { check(!ids.has(r.id), 'Raum-ID doppelt: ' + r.id); ids.add(r.id); });

/* Einfahrt (Angaben des Nutzers vom 11.10.2026): Pflaster an der Haustür auf Schwellenhöhe, vor dem Nebeneingang
   30 cm unter der Schwelle, von der Haustür bis zur Straße stetig fallend. Schwelle = Fußboden EG (142,80), Toleranz 3 cm. */
const gE = (x, z) => m.groundY(x, z) + m.datum;
const FFB = m.H.FFB;
check(Math.abs(gE(16.3, 11.1) - FFB) <= 0.03, 'Pflaster vor der Haustür ' + gE(16.3, 11.1).toFixed(3) + ' statt auf Schwellenhöhe ' + FFB.toFixed(2));
check(Math.abs(gE(9.1, 5.3) - (FFB - 0.30)) <= 0.03, 'Pflaster vor dem Nebeneingang ' + gE(9.1, 5.3).toFixed(3) + ' statt 30 cm unter der Schwelle ' + (FFB - 0.30).toFixed(2));
{ // Pfad von der Haustür an der Hauswand nach Norden und dann nach Osten zum Straßenrand (am Vorbeet vorbei)
  const pfad = [[16.3, 11.1], [16.3, 7.0], [24.5, 7.0]], start = gE(16.3, 11.1);
  let prev = start, steigt = null;
  for (let k = 0; k + 1 < pfad.length; k++) {
    const [x0, z0] = pfad[k], [x1, z1] = pfad[k + 1], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.1);
    for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n, h = gE(x, z); if (h > prev + 0.001) steigt = steigt || x.toFixed(1) + ' / ' + z.toFixed(1); prev = h; }
  }
  check(steigt === null, 'Pflaster steigt von der Haustür zur Straße bei ' + steigt);
  check(start - prev >= 0.3, 'Pflaster fällt von der Haustür bis zur Straße nur um ' + (start - prev).toFixed(2) + ' m');
}

/* Szenenprüfung über benannte Objekte (userData.kind) und deren Hüllquader */
const kinds = k => { const a = []; m.root.traverse(o => { if (o.userData && o.userData.kind === k) a.push(o); }); return a; };
const box = o => new THREE.Box3().setFromObject(o);
const inPoly = (poly, x, z) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[j], b = poly[i]; if ((b[1] > z) !== (a[1] > z) && x < (a[0] - b[0]) * (z - b[1]) / (a[1] - b[1]) + b[0]) ins = !ins; } return ins; };
/* Straße (Angaben des Nutzers vom 11.10.2026): glatt ohne Wellen und 15 cm über den Höhen des Lageplans von 2014 (Baustraße).
   Straßenfläche = grau texturiert, östlich und südlich des Grundstücks. Höhen der Baustraße aus dem Lageplan. */
{
  const ebene = (xs, zs, name) => { // Ebene durch drei Eckpunkte, alle Rasterpunkte der Fläche müssen innerhalb 1 cm darauf liegen
    const p0 = [xs[0], zs[0], gE(xs[0], zs[0])], bx = (gE(xs[1], zs[0]) - p0[2]) / (xs[1] - xs[0]), bz = (gE(xs[0], zs[1]) - p0[2]) / (zs[1] - zs[0]);
    let worst = 0;
    for (let x = xs[0]; x <= xs[1] + 1e-9; x += 0.5) for (let z = zs[0]; z <= zs[1] + 1e-9; z += 0.5) worst = Math.max(worst, Math.abs(gE(x, z) - (p0[2] + bx * (x - p0[0]) + bz * (z - p0[1]))));
    check(worst <= 0.01, 'Straße ' + name + ' ist nicht eben, größte Welle ' + (worst * 100).toFixed(1) + ' cm');
  };
  ebene([27, 33], [8, 22], 'Ost');
  ebene([2, 14], [30, 37], 'Süd');
  { // eine einzige Ebene für die ganze Straße, auch direkt am Bordstein: Raster 1 m, mindestens 0,6 m vom Grundstück entfernt, ohne Nachbargrundstücke
    const q0 = [30, 10], bx = (gE(34, 10) - gE(30, 10)) / 4, bz = (gE(30, 24) - gE(30, 10)) / 14, h0 = gE(30, 10);
    const draussen = (x, z) => !inPoly(m.zones.plot, x, z) && !inPoly(m.zones.neighbor, x, z) && [0, 1, 2, 3, 4, 5, 6, 7].every(k => !inPoly(m.zones.plot, x + 0.6 * Math.cos(k * Math.PI / 4), z + 0.6 * Math.sin(k * Math.PI / 4)));
    let worst = 0, wo = '', n = 0;
    for (let x = -9; x <= 35; x += 1) for (let z = 4; z <= 38; z += 1) {
      if (!draussen(x, z)) continue;
      n++; const d = Math.abs(gE(x, z) - (h0 + bx * (x - q0[0]) + bz * (z - q0[1])));
      if (d > worst) { worst = d; wo = x + ' / ' + z; }
    }
    check(n > 200 && worst <= 0.01, 'Straße ist an ' + wo + ' um ' + (worst * 100).toFixed(1) + ' cm von der Ebene entfernt (' + n + ' Punkte)');
  }
  { // Pflaster endet am Bordstein 2–3 cm über der Straße (Rinne liegt auf Straßenhöhe), entlang der ganzen Kante
    const a = [25.9, 3.04], b = [22.06, 15.72], L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
    let lo = 9, hi = -9, wo = '';
    for (let f = 0.04; f <= 0.96; f += 0.04) {
      const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, d = gE(x - nx * 0.08, z - nz * 0.08) - gE(x + nx * 0.45, z + nz * 0.45);
      if (d < lo) lo = d; if (d > hi) { hi = d; wo = z.toFixed(1); }
    }
    check(lo >= 0.015 && hi <= 0.045, 'Pflaster liegt am Bordstein ' + (lo * 100).toFixed(1) + ' bis ' + (hi * 100).toFixed(1) + ' cm über der Straße statt 2–3 cm (größter Wert bei z ' + wo + ')');
  }
  const lp = [[28, 6, 141.85], [27, 14, 142.0], [24.5, 20, 142.3], [22, 26, 142.35], [0, 28.5, 142.2], [8, 28.8, 142.25], [16, 28.5, 142.33], [26, 28, 142.35]];
  const mittel = lp.reduce((s, q) => s + gE(q[0], q[1]) - q[2], 0) / lp.length;
  check(Math.abs(mittel - 0.15) <= 0.01, 'Straße liegt im Mittel ' + (mittel * 100).toFixed(1) + ' cm über dem Lageplan statt 15 cm');
}

/* Stufe südlich der Haustür (Angabe des Nutzers vom 11.10.2026): 30 cm links der Haustüröffnung, von vorn gesehen, 11 cm tief.
   Öffnung = Tür und Seitenteil (hz 4,51–6,27, südliche Kante bei z 12,01), die Stufe liegt also bei z 12,31. */
{
  const tuer = gE(16.3, 11.1), vorStufe = gE(16.3, 12.2), nachStufe = gE(16.3, 12.45);
  check(Math.abs(vorStufe - tuer) <= 0.005, 'Pflaster bis zur Stufe nicht mehr auf Türhöhe: ' + (vorStufe - tuer).toFixed(3) + ' m bei z 12,2');
  check(Math.abs(vorStufe - nachStufe - 0.11) <= 0.01, 'Stufe südlich der Haustür ' + (vorStufe - nachStufe).toFixed(3) + ' m statt 0,11 m');
}

/* Carport: Pfosten direkt an der Hauswand (Nordwand, z 5,74), keiner außerhalb des Grundstücks (Angabe des Nutzers vom 11.10.2026) */
{
  const pf = [];
  m.root.traverse(o => { if (o.userData && o.userData.kind === 'carportpfosten') pf.push(box(o)); });
  check(pf.length === 6, 'Carport: ' + pf.length + ' Pfosten statt 6');
  pf.forEach(b => {
    [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z]].forEach(c => { if (!inPoly(m.zones.plot, c[0], c[1])) fails.push('Carportpfosten steht außerhalb des Grundstücks bei ' + c[0].toFixed(2) + ' / ' + c[1].toFixed(2)); });
  });
  const hinten = pf.filter(b => b.max.z > 5);
  check(hinten.length === 3 && hinten.every(b => Math.abs(b.max.z - 5.74) <= 0.01), 'Carport: die drei Pfosten an der Hauswand stehen nicht direkt an der Wand (z 5,74)');
}

/* Vorbeet, Nebeneingang und Mülltonnen (Angaben des Nutzers vom 11.10.2026, Fotos in eingaben/bilder/foto-einfahrt-*).
   Nebeneingang: Tür hx 5,555–6,565 in der Nordwand (Standort x 8,605–9,615, z 5,74). */
{
  const bed = m.zones.bed, a = bed.rot * Math.PI / 180;
  const local = (x, z) => { const dx = x - bed.c[0], dz = z - bed.c[1]; return [dx * Math.cos(a) + dz * Math.sin(a), -dx * Math.sin(a) + dz * Math.cos(a)]; };
  const bueschen = kinds('busch');
  check(bueschen.length >= 1, 'Vorbeet: kein Strauch vorhanden');
  bueschen.forEach(b => {
    const c = box(b).getCenter(new THREE.Vector3()), [u, v] = local(c.x, c.z), r = b.userData.r;
    check(Math.abs(u) + r <= bed.w / 2 + 0.01 && Math.abs(v) + r <= bed.h / 2 + 0.01, 'Strauch ragt über das Vorbeet hinaus bei ' + c.x.toFixed(1) + ' / ' + c.z.toFixed(1));
  });
  const heraus = gE(bed.c[0], bed.c[1]) - m.pflasterE(bed.c[0], bed.c[1]);
  check(heraus >= 0.1 && heraus <= 0.5, 'Vorbeet-Mauer steht ' + heraus.toFixed(2) + ' m über dem Pflaster (erwartet: wenig, 0,1–0,5 m)');
}
{
  const stufen = kinds('stufe').sort((p, q) => box(p).max.y - box(q).max.y);
  check(stufen.length === 2, 'Nebeneingang: ' + stufen.length + ' Stufen statt 2');
  if (stufen.length === 2) {
    const top = stufen.map(s => box(s).max.y + m.datum);
    check(Math.abs(top[0] - (FFB - 0.15)) <= 0.02 && Math.abs(top[1] - FFB) <= 0.02, 'Stufenoberkanten ' + top.map(t => t.toFixed(3)).join(' / ') + ' statt ' + (FFB - 0.15).toFixed(2) + ' / ' + FFB.toFixed(2));
    stufen.forEach(s => { const b = box(s); check(b.min.x < 9.11 && b.max.x > 9.11 && b.max.z <= 5.76 && b.min.z >= 4.8, 'Stufe liegt nicht vor der Nebeneingangstür'); });
  }
  const tuer = kinds('nebeneingang-tuer');
  check(tuer.length === 1 && tuer[0].userData.oben === 'glas' && tuer[0].userData.unten === 'fuellung', 'Nebeneingangstür: oben Glas, unten Füllung erwartet');
  const tonnen = kinds('tonne'), farbe = f => tonnen.filter(t => t.userData.deckel === f);
  check(tonnen.length === 3 && farbe('blau').length === 1 && farbe('gelb').length === 1 && farbe('schwarz').length === 1, 'Mülltonnen: erwartet je eine mit blauem, gelbem und schwarzem Deckel, gefunden ' + tonnen.length);
  tonnen.forEach(t => { const c = box(t).getCenter(new THREE.Vector3()); check(c.z < 5.74 && c.z > 4.6, 'Tonne ' + t.userData.deckel + ' steht nicht an der Nordwand'); });
  if (tonnen.length === 3) {
    const cx = f => box(farbe(f)[0]).getCenter(new THREE.Vector3()).x;
    check(cx('blau') > 9.7 && cx('gelb') > 9.2 && cx('blau') > cx('gelb') && cx('schwarz') < 8.6, 'Tonnen: blau und gelb östlich, schwarz westlich der Nebeneingangstür erwartet');
  }
}

/* Außengrundstück (Angaben des Nutzers vom 11.10.2026):
   - Der Strauch, der auf der Straße saß, ist entfernt: jeder Strauch hat seinen Mittelpunkt im Grundstück.
   - Pool: Durchmesser 3,66 m, Höhe 76 cm.
   - Doppelstabmattenzaun in Anthrazit: West 2 m vom Carport bis zur Straße; Süd und Ost 1 m an der Grundstücksgrenze entlang bis dahin,
     wo die Wiese endet (Ecke des Pflasters an der Straße); dann 1 m an der Wiesenkante entlang bis zum Haus. */
{
  const buesche = kinds('busch').concat(kinds('busch-suedost'));
  buesche.forEach(b => { const c = box(b).getCenter(new THREE.Vector3()); check(inPoly(m.zones.plot, c.x, c.z), 'Strauch steht außerhalb des Grundstücks (auf der Straße) bei ' + c.x.toFixed(1) + ' / ' + c.z.toFixed(1)); });
  check(kinds('busch-suedost').length === 2, 'Südostecke: ' + kinds('busch-suedost').length + ' Sträucher statt 2 (einer von dreien stand auf der Straße)');

  const pool = kinds('pool');
  check(pool.length === 1, 'Pool: ' + pool.length + ' statt 1');
  if (pool.length === 1) {
    const s = box(pool[0]).getSize(new THREE.Vector3());
    check(Math.abs(s.x - 3.66) <= 0.01 && Math.abs(s.z - 3.66) <= 0.01, 'Pool-Durchmesser ' + s.x.toFixed(2) + ' × ' + s.z.toFixed(2) + ' m statt 3,66 m');
    check(Math.abs(s.y - 0.76) <= 0.01, 'Pool-Höhe ' + s.y.toFixed(2) + ' m statt 0,76 m');
  }

  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const gelaende = (x, z) => { ray.set(new THREE.Vector3(x, 60, z), down); const h = ray.intersectObject(m.terrain); return h.length ? h[0].point.y : NaN; };
  const ecken = o => { const p = o.geometry.attributes.position, a = []; for (let i = 0; i < p.count; i++) a.push(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(o.matrixWorld)); return a; };
  const SOLL = { west: 2.0, grenze: 1.0, wiese: 1.0 };
  const zaun = kinds('zaun'), seite = s => zaun.filter(z => z.userData.seite === s), punkte = {};
  check(zaun.length === 3 && Object.keys(SOLL).every(s => seite(s).length === 1), 'Zaun: erwartet je ein Teilstück West, Grenze und Wiese, gefunden: ' + (zaun.map(z => z.userData.seite).join(', ') || 'keins'));
  Object.keys(SOLL).forEach(s => {
    if (seite(s).length !== 1) return;
    const o = seite(s)[0], vs = ecken(o), H = SOLL[s];
    let hi = -1e9, lo = 1e9, wo = ''; // Toleranz nach oben 8 cm: Matten sind starr, zwischen den Pfosten ist das Gelände einige cm wellig
    const zellen = new Map(); // Raster 5 cm: je Zelle nur höchster und tiefster Punkt gegen das Gelände messen (Strahlen sind teuer)
    vs.forEach(v => { const k = Math.round(v.x * 20) + '/' + Math.round(v.z * 20), e = zellen.get(k) || { hi: v, lo: v }; if (v.y > e.hi.y) e.hi = v; if (v.y < e.lo.y) e.lo = v; zellen.set(k, e); });
    zellen.forEach(e => {
      const h = e.hi.y - gelaende(e.hi.x, e.hi.z);
      if (h > hi) { hi = h; wo = e.hi.x.toFixed(1) + ' / ' + e.hi.z.toFixed(1); }
      lo = Math.min(lo, e.lo.y - gelaende(e.lo.x, e.lo.z));
    });
    check(hi >= H - 0.03 && hi <= H + 0.08, 'Zaun ' + s + ' ist ' + hi.toFixed(2) + ' m hoch statt ' + H.toFixed(2) + ' m (höchster Punkt bei ' + wo + ')');
    check(lo <= 0.02, 'Zaun ' + s + ' schwebt: tiefster Punkt ' + lo.toFixed(2) + ' m über dem Gelände');
    const c = o.material.color;
    check(c.r <= 0.3 && c.g <= 0.3 && c.b <= 0.3 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 0.08, 'Zaun ' + s + ' ist nicht anthrazit (dunkles Grau)');
    punkte[s] = vs;
  });
  const mn = a => a.reduce((p, q) => Math.min(p, q), Infinity), mx = a => a.reduce((p, q) => Math.max(p, q), -Infinity); // ohne Spread: die Netze haben zehntausende Punkte
  const nahe = (s, x, z) => punkte[s] ? mn(punkte[s].map(v => Math.hypot(v.x - x, v.z - z))) : 1e9;
  const strecke = (a, b, nn) => { const r = []; for (let i = 0; i <= nn; i++) r.push([a[0] + (b[0] - a[0]) * i / nn, a[1] + (b[1] - a[1]) * i / nn]); return r; };
  const P = m.zones.plot, bis = z => [P[2][0] + (P[3][0] - P[2][0]) * (z - P[2][1]) / (P[3][1] - P[2][1]), z]; // Punkt der Ostgrenze bei z
  const lueckenlos = (s, pts, tol, was) => { const w = pts.filter(q => nahe(s, q[0], q[1]) > tol); check(w.length === 0, 'Zaun ' + s + ' hat Lücken an ' + was + ' (z. B. bei ' + (w[0] ? w[0][0].toFixed(1) + ' / ' + w[0][1].toFixed(1) : '') + ')'); };
  lueckenlos('west', strecke([0, 5.5], P[5], 40), 0.3, 'der Westgrenze zwischen Carport und Straße');
  lueckenlos('grenze', strecke(P[5], P[4], 40).concat(strecke(P[4], P[3], 12), strecke(P[3], bis(15.9), 30)), 0.3, 'der Süd-, Südost- und Ostgrenze bis zum Ende der Wiese');
  lueckenlos('wiese', strecke([21.55, 15.53], [16.4, 13.6], 28).concat(strecke([16.4, 13.6], [16.0, 13.6], 4)), 0.3, 'der Wiesenkante von der Straße bis zum Haus (die Pflasterecke 22,06 / 15,72 liegt 20 cm außerhalb der Grenze, der Zaun setzt am Grenzzaun an)');
  if (punkte.west && punkte.grenze && punkte.wiese) {
    const zr = s => { const z = punkte[s].map(v => v.z), x = punkte[s].map(v => v.x); return { z0: mn(z), z1: mx(z), x0: mn(x), x1: mx(x) }; };
    const w = zr('west'), g = zr('grenze'), k = zr('wiese');
    check(w.z0 >= 5.3 && w.z0 <= 5.6, 'Zaun West beginnt bei z ' + w.z0.toFixed(2) + ' statt am Carport (z 5,4–5,5)');
    check(w.x0 >= -0.05 && w.x1 <= 0.35, 'Zaun West steht nicht an der Westgrenze (x ' + w.x0.toFixed(2) + ' … ' + w.x1.toFixed(2) + ')');
    check(g.z1 <= 26.9 && g.z0 >= 15.4 && g.z0 <= 15.9, 'Zaun Grenze endet nicht dort, wo die Wiese endet (z ' + g.z0.toFixed(2) + ', erwartet etwa 15,7)');
    check(k.x0 >= 15.95 && k.x0 <= 16.1, 'Zaun Wiesenkante endet nicht am Haus (x ' + k.x0.toFixed(2) + ', Hauswand 16,00)');
    check(mn(punkte.grenze.filter(v => v.z < 16).map(v => nahe('wiese', v.x, v.z))) <= 0.4, 'Grenzzaun und Zaun an der Wiesenkante treffen sich nicht an der Straße');
  }

  /* Hecke an der Südgrenze (Angabe des Nutzers vom 11.10.2026): 2 m hoch ab Gelände, vom Zaun abgerückt statt durch ihn hindurch,
     weder im Pool noch außerhalb des Grundstücks. */
  const hecke = kinds('hecke');
  check(hecke.length === 1, 'Hecke: ' + hecke.length + ' Teile statt 1');
  let hH = 1e9, hHmax = -1e9, luft = 1e9, imPool = 0, draussen = 0;
  const pb = pool.length === 1 ? box(pool[0]) : null;
  hecke.forEach(o => {
    const b = box(o); // die Hecke ist ein Quader im Grundriss, ihr Hüllquader ist der Umriss
    ecken(o).forEach(v => { const h = v.y - gelaende(v.x, v.z); if (h > 1) { hH = Math.min(hH, h); hHmax = Math.max(hHmax, h); } }); // obere Kante: Eckpunkte über 1 m
    ['west', 'grenze'].forEach(s => (punkte[s] || []).forEach(v => { luft = Math.min(luft, Math.hypot(Math.max(b.min.x - v.x, 0, v.x - b.max.x), Math.max(b.min.z - v.z, 0, v.z - b.max.z))); }));
    if (pb && b.min.x < pb.max.x && b.max.x > pb.min.x && b.min.z < pb.max.z && b.max.z > pb.min.z) imPool++;
    [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z]].forEach(q => { if (!inPoly(m.zones.plot, q[0], q[1])) draussen++; });
  });
  check(hecke.length === 0 || (hH >= 1.95 && hHmax <= 2.05), 'Hecke ist ' + hH.toFixed(2) + ' bis ' + hHmax.toFixed(2) + ' m hoch statt 2,00 m');
  check(hecke.length === 0 || luft >= 0.05, 'Hecke rückt nicht vom Zaun ab (kleinster Abstand ' + (luft * 100).toFixed(0) + ' cm, erwartet mindestens 5 cm)');
  check(imPool === 0, 'Hecke ragt in den Pool');
  check(draussen === 0, 'Hecke ragt über die Grundstücksgrenze (' + draussen + ' Ecken)');
}

/* Prüfmaße aus dem Aufmaß: nur Bericht, kein Fehler (bekannte Abweichungen stehen in docs/abgleich-eg-grundriss.md) */
function span(poly, dir, at) {
  const ts = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const [ca, cb, ua, ub] = dir === 'x' ? [a[1], b[1], a[0], b[0]] : [a[0], b[0], a[1], b[1]];
    if ((ca - at) * (cb - at) < 0 || (ca === at) !== (cb === at)) { if (ca !== cb) ts.push(ua + (ub - ua) * (at - ca) / (cb - ca)); }
  }
  ts.sort((p, q) => p - q);
  let best = 0; for (let i = 0; i + 1 < ts.length; i += 2) best = Math.max(best, ts[i + 1] - ts[i]);
  return best;
}
function edgeLen(poly, q) {
  let best = 1e9, len = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz;
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vz) / L2));
    const dd = Math.hypot(q[0] - a[0] - t * vx, q[1] - a[1] - t * vz);
    if (dd < best) { best = dd; len = Math.sqrt(L2); }
  }
  return len;
}
const PM = JSON.parse(fs.readFileSync(path.join(__dirname, 'pruefmasse.json'), 'utf8'));
const byId = {}; m.rooms.forEach(r => { byId[r.id] = r; });
console.log('\nPrüfmaße: Aufmaß (fertig) ↔ Modell (Rohbau) in cm, erwartet Modell − Aufmaß = ' + PM.putz_cm[0] + ' … +' + PM.putz_cm[1] + ' (Putz), ! = auffällig');
PM.masse.forEach(p => {
  const r = byId[p.raum];
  if (!r || !r.poly) { fails.push('Prüfmaß ohne Raum: ' + p.raum); return; }
  const mod = (p.kante_bei ? edgeLen(r.poly, p.kante_bei) : span(r.poly, p.richtung, p.bei)) * 100, d = mod - p.cm;
  const off = p.kante_bei ? Math.abs(d) > PM.kante_cm : d < PM.putz_cm[0] || d > PM.putz_cm[1];
  console.log('  ' + (off ? '!' : ' ') + ' ' + p.was.padEnd(42) + String(p.cm).padStart(5) + String(mod.toFixed(1)).padStart(8) + (d >= 0 ? '  +' : '  ') + d.toFixed(1));
});

/* Snapshot */
if (process.env.UPDATE || !fs.existsSync(SNAP)) {
  fs.writeFileSync(SNAP, JSON.stringify(cur, null, 1) + '\n');
  console.log('Snapshot geschrieben:', path.relative(process.cwd(), SNAP));
} else {
  const old = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  const diff = [];
  (function cmp(a, b, p) {
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => cmp(a[k], b[k], p ? p + '.' + k : k));
    } else if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(p + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b));
  })(old, cur, '');
  if (diff.length) fails.push('Abweichung vom Snapshot (gewollt? dann UPDATE=1 npm test):\n    ' + diff.join('\n    '));
}

if (fails.length) { console.error('\nFEHLER\n  ' + fails.join('\n  ')); process.exitCode = 1; }
else console.log('\nalle Prüfungen bestanden');
