const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  pg.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.text()); });
  pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pg.goto('file://' + process.cwd() + '/test_page.html');
  await pg.waitForTimeout(2500);
  const views = process.argv.slice(2);
  for (const v of views) {
    await pg.click(`[data-view="${v}"]`);
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: `shot_${v}.png` });
  }
  console.log(errs.slice(0, 10).join('\n') || 'no errors');
  await b.close();
})();
