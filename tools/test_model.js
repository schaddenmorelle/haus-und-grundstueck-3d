const THREE=require('three');
const {buildModel}=require('../src/model.js');
const t0=Date.now();
const m=buildModel(THREE);
console.log('build ms',Date.now()-t0);
let meshes=0,tris=0,bad=0;
m.root.traverse(o=>{ if(o.isMesh){meshes++; const g=o.geometry; const p=g.attributes.position; tris+= (g.index?g.index.count:p.count)/3; for(let i=0;i<p.array.length;i++) if(!isFinite(p.array[i])) bad++; }});
console.log({meshes,tris:Math.round(tris),nonFinite:bad});
m.root.updateMatrixWorld(true);
const roof=m.groups.roof.children[0];
roof.geometry.computeBoundingBox();
const bb=roof.geometry.boundingBox;
console.log('roof bbox',bb.min.toArray().map(v=>+v.toFixed(2)),bb.max.toArray().map(v=>+v.toFixed(2)),'ridge elev',(bb.max.y+m.datum).toFixed(2));
console.log('roofH A ridge',(m.roofH(9,10.49)).toFixed(3),' B ridge',(m.roofH(11.275,13)).toFixed(3),' eave wall line',(m.roofH(3.05,8)).toFixed(3),(m.roofH(16.0,8)).toFixed(3));
console.log('plot area',m.info.plotArea.toFixed(1),'foot area',m.info.footArea.toFixed(1),'pitch',m.info.pitchDeg.toFixed(1));
console.log('rooms:'); m.rooms.forEach(r=>console.log(' ',r.name.padEnd(22),r.area.toFixed(1),'m2 @',r.center.map(v=>v.toFixed(1)).join(',')));
console.log('ground samples (elev):',[[0.3,3.7],[8,5.3],[16.8,11],[12.9,24.2],[25,3],[-2,10],[20,27.5]].map(p=>(m.groundY(p[0],p[1])+m.datum).toFixed(2)).join(' '));
let minY=1e9,maxY=-1e9; const tp=m.terrain.geometry.attributes.position; for(let i=0;i<tp.count;i++){minY=Math.min(minY,tp.getY(i));maxY=Math.max(maxY,tp.getY(i));}
console.log('terrain elev range',(minY+m.datum).toFixed(2),(maxY+m.datum).toFixed(2),'tags',m.tags.length);
