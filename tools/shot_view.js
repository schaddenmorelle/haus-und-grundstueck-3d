const { chromium } = require('playwright');
const VIEW=process.argv[3]||'dg';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + require('path').resolve(__dirname, '../dist/test_page.html'),{waitUntil:'commit'});
  await pg.waitForTimeout(3500);
  await pg.evaluate((V)=>{document.querySelector('[data-view="'+V+'"]').click();}, VIEW);
  await pg.waitForTimeout(3600);
  const views = JSON.parse(process.argv[2]);
  for (let i=0;i<views.length;i++){
    const v=views[i];
    await pg.evaluate((v)=>{const m=window.__m3d; m.camera.position.set(...v.p); m.controls.target.set(...v.t); m.controls.update();},v);
    await pg.waitForTimeout(700);
    await pg.screenshot({ path: (process.env.OUT||'.')+'/shot_'+i+'.png' });
  }
  console.log(errs.join('\n')||'no errors');
  await b.close();
})();
