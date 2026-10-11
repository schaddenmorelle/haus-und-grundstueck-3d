const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(3500);
  await pg.evaluate(()=>{document.querySelector('[data-view="dg"]').click();});
  await pg.waitForTimeout(3600);
  await pg.screenshot({ path: 's13a.png' });
  console.log(errs.join('\n')||'no errors');
  await b.close();
})();
