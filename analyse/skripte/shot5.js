const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(3000);
  await pg.click('[data-view="dg"]'); await pg.waitForTimeout(1500);
  await pg.click("#togglePanel"); await pg.waitForTimeout(800);
  await pg.screenshot({ path: 's5.png' }); await pg.click('#togglePanel'); await pg.click('[data-view="frame"]'); await pg.click('#togglePanel'); await pg.waitForTimeout(1500); await pg.screenshot({ path: 's6.png' });
  await b.close();
})();
