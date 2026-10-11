const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:1280,height:800} });
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(3000);
  await pg.click('[data-view="dg"]'); await pg.waitForTimeout(1200);
  await pg.click('#rooms button[data-id="kind1"]'); await pg.waitForTimeout(1600);
  await pg.click('#togglePanel'); await pg.waitForTimeout(700);
  await pg.screenshot({ path: 's7.png' });
  await b.close();
})();
