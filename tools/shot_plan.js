/* Screenshot der Grundriss-Ansicht der Seite (Playwright). Aufruf:
     NODE_PATH=$(npm root -g) OUT=/tmp node tools/shot_plan.js EG            ganzer Plan
     NODE_PATH=$(npm root -g) OUT=/tmp node tools/shot_plan.js DG '[data-name="aussen:breite"]'   mit angeklicktem Element
     NODE_PATH=$(npm root -g) OUT=/tmp node tools/shot_plan.js sch:A     Schnitt A–A (sch:B, an:N, an:O, an:S, an:W: Schnitt B–B und die vier Ansichten)
   Ausgabe: $OUT/plan_<Geschoss>.png (Doppelpunkt im Namen als Unterstrich); Breite × Höhe der Seite per W und H (Standard 1280 × 800), THEME=dark für den Dunkelmodus. */
const { chromium } = require('playwright');
const G = /^(eg|dg)$/i.test(process.argv[2] || 'EG') ? (process.argv[2] || 'EG').toUpperCase() : process.argv[2], SEL = process.argv[3]; // EG, DG, sch:A, sch:B, an:N, an:O, an:S, an:W
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 800) }, colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light' });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.goto('file://' + require('path').resolve(__dirname, '../dist/test_page.html'), { waitUntil: 'commit' });
  await pg.waitForTimeout(2500);
  await pg.evaluate(g => document.querySelector('[data-modus="' + g + '"]').click(), G);
  await pg.waitForTimeout(500);
  if (SEL) { await pg.evaluate(s => { const el = document.querySelector('#planSvg ' + s); const r = el.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, SEL); await pg.waitForTimeout(300); }
  await pg.screenshot({ path: (process.env.OUT || '.') + '/plan_' + G.replace(':', '_') + '.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
