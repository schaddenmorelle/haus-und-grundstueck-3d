const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const errs=[];
  for (const [name,vp] of [['desk',{width:1280,height:800}],['mob',{width:400,height:820}]]) {
    const pg = await b.newPage({ viewport: vp });
    pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort()); await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'domcontentloaded'});
    await pg.waitForTimeout(2200);
    await pg.screenshot({ path: `s2_${name}.png` });
    if (name==='mob') { await pg.click('#togglePanel'); await pg.waitForTimeout(500); await pg.click('[data-view="dg"]'); await pg.waitForTimeout(1500); await pg.screenshot({ path: 's2_mob_dg.png' });
      const sw = await pg.evaluate(()=>document.documentElement.scrollWidth+' '+innerWidth); console.log('scrollW',sw); }
    if (name==='desk') { await pg.click('#rooms button[data-id="dg"]'); await pg.waitForTimeout(1500); await pg.screenshot({ path: 's2_room.png' });
      await pg.click('#measure'); await pg.mouse.click(700,420); await pg.mouse.click(900,520); await pg.waitForTimeout(300); console.log(await pg.textContent('#readout')); }
  }
  console.log(errs.join('\n')||'no page errors');
  await b.close();
})();
