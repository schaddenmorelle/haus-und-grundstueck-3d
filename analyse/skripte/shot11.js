const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(3500);
  await pg.evaluate(()=>{document.querySelector('[data-view="frame"]').click();});
  await pg.waitForTimeout(3500);
  await pg.evaluate(()=>{document.getElementById('t-rafters').click();});
  for (const [n,c,t] of [['a',[14.2,12,16.5],[14.5,3.8,14.0]],['b',[19,6,19],[14.5,3.6,14.0]]]){
    await pg.evaluate(([c,t])=>{const m=window.__m3d;m.camera.position.set(...c);m.controls.target.set(...t);m.controls.update();},[c,t]);
    await pg.waitForTimeout(800); await pg.screenshot({ path: 's11'+n+'.png' });
  }
  console.log(errs.join('\n')||'no errors');
  await b.close();
})();
