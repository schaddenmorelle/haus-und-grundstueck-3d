const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(3000);
  await pg.click('[data-view="frame"]'); await pg.waitForTimeout(3500);
  await pg.evaluate(()=>document.getElementById('panel').classList.add('closed'));
  const shots=[['a',[-10,24,40],[10,4,13]],['b',[11,22,13.5],[11,3,13.4]],['c',[17,9,22],[9.5,3.5,13]],['d',[6,6,16],[9.3,3.5,10.4]]];
  for (const [n,c,t] of shots){
    await pg.evaluate(([c,t])=>{const m=window.__m3d;m.camera.position.set(...c);m.controls.target.set(...t);m.controls.update();},[c,t]);
    await pg.waitForTimeout(700); await pg.screenshot({ path: 's9'+n+'.png' });
  }
  await pg.click('[data-view="sw"]'); await pg.waitForTimeout(3500);
  await pg.screenshot({ path: 's9e.png' });
  console.log(errs.join('\n')||'no errors');
  await b.close();
})();
