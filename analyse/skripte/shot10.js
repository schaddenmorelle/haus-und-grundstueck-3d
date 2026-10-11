const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(3500);
  await pg.evaluate(()=>document.getElementById('panel').classList.add('closed'));
  for (const [n,c,t] of [['a',[-6,7,22],[6,2.5,14]],['b',[24,10,14],[11,3,12]]]){
    await pg.evaluate(([c,t])=>{const m=window.__m3d;m.camera.position.set(...c);m.controls.target.set(...t);m.controls.update();},[c,t]);
    await pg.waitForTimeout(800); await pg.screenshot({ path: 's10'+n+'.png' });
  }
  console.log(errs.join('\n')||'no errors');
  await b.close();
})();
