const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(3500);
  await pg.evaluate(()=>{document.getElementById('togglePanel').click(); document.querySelector('[data-view="dg"]').click();});
  await pg.waitForTimeout(3600);
  // site coords = hx+3.05, hz+5.74 ; stair top at hx 9.2 hz 9.1 -> (12.25, 14.84); floor yD ~ 3.77
  for (const [n,c,t] of [['a',[10.0,5.6,13.9],[15.4,3.4,14.8]],['b',[14.5,9.5,19.0],[15.0,3.6,14.6]],['c',[16.5,8.5,11.0],[15.0,3.6,14.7]]]){
    await pg.evaluate(([c,t])=>{const m=window.__m3d;m.camera.position.set(...c);m.controls.target.set(...t);m.controls.update();},[c,t]);
    await pg.waitForTimeout(800); await pg.screenshot({ path: 's12'+n+'.png' });
  }
  console.log(errs.join('\n')||'no errors');
  await b.close();
})();
