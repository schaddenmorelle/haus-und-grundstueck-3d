const THREE=require('three');const {buildModel}=require('./model.js');const m=buildModel(THREE);
const yD=0.8+2.971;
for (const hz of [7.31,7.9,8.0,10]) { let o=[];for (let hx=5.0;hx<=5.6;hx+=0.06){o.push(hx.toFixed(2)+':'+(m.roofH(3.05+hx,5.74+hz)-142-yD-0.22).toFixed(3));} console.log('hz',hz,o.join(' '));}
