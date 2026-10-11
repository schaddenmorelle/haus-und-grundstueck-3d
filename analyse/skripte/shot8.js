const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(3000);
  await pg.click('[data-view="dg"]'); await pg.waitForTimeout(3500);
  await pg.evaluate(()=>document.getElementById('panel').classList.add('closed'));
  const shots=[['a',[14.2,9.5,17.5],[14.2,3.5,14.7]],['b',[9.5,7.5,20],[14.2,3.5,14.7]],['c',[17,6,12],[14.2,3,14.7]]];
  for (const [n,c,t] of shots){
    await pg.evaluate(([c,t])=>{const m=window.__m3d;m.camera.position.set(...c);m.controls.target.set(...t);m.controls.update();},[c,t]);
    await pg.waitForTimeout(700); await pg.screenshot({ path: 's8'+n+'.png' });
  }
  await b.close();
})();
