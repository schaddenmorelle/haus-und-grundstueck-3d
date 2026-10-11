const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: {width:400,height:820} });
  pg.on('pageerror', e => console.log('PAGEERR ' + e.message));
  pg.on('console', m => console.log('C', m.text().slice(0,200)));
  await pg.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  const t=Date.now();
  try { await pg.goto('file://' + process.cwd() + '/test_page.html',{waitUntil:'commit',timeout:10000}); } catch(e){console.log('goto',e.message.slice(0,80));}
  console.log('committed',Date.now()-t);
  await pg.waitForTimeout(5000);
  try { const r = await Promise.race([pg.evaluate(()=>document.readyState), new Promise(r=>setTimeout(()=>r('EVAL TIMEOUT'),8000))]); console.log(r);} catch(e){console.log('ev',e.message.slice(0,80))}
  await b.close();
})();
