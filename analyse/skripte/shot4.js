const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:400,height:820} });
  pg.on('pageerror', e => console.log('PAGEERR ' + e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit'});
  await pg.waitForTimeout(4000);
  await pg.screenshot({ path: 's2_mob.png' });
  await pg.click('#togglePanel'); await pg.waitForTimeout(600); await pg.screenshot({ path: 's2_mob_panel.png' });
  console.log('scroll', await pg.evaluate(()=>document.documentElement.scrollWidth+' vs '+innerWidth));
  await b.close();
})();
