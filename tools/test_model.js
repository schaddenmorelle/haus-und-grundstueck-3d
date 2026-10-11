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
  rooms: m.rooms.map(r => ({ id: r.id, name: r.name, level: r.level, area: r2(r.area) }))
};
console.log({ meshes: cur.meshes, tris: cur.tris, nonFinite: bad, ridge: cur.ridge });
cur.rooms.forEach(r => console.log('  ' + r.level.padEnd(4) + r.name.padEnd(24) + r.area.toFixed(2) + ' m²'));

/* Feste Randbedingungen (CLAUDE.md) */
const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
check(bad === 0, 'nicht endliche Koordinaten: ' + bad);
check(Math.abs(m.info.pitchDeg - 35) < 1e-6, 'Dachneigung ist ' + m.info.pitchDeg + '° statt 35°');
check(Math.abs(ridge - 149.08) < 0.01, 'First ' + ridge.toFixed(3) + ' statt 149,08');
check(Math.abs(m.roofH(3.05, 8) - 145.77) < 1e-6 && Math.abs(m.roofH(16.0, 8) - 145.77) < 1e-6, 'Traufe an der Außenwand nicht 145,77');
check(Math.abs(m.levels.dg - m.levels.eg - 2.971) < 1e-9, 'Geschosshöhe nicht 2,971 m');
const ids = new Set(); m.rooms.forEach(r => { check(!ids.has(r.id), 'Raum-ID doppelt: ' + r.id); ids.add(r.id); });

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
