/* Probiermodus der Seite im Grundriss (Playwright): Maß anklicken, Wert eingeben, anwenden, Screenshot und Export der Änderungsliste. Aufruf:
     NODE_PATH=$(npm root -g) OUT=/tmp node tools/shot_probe.js EG raum:speis.tiefe 1,30m
   Weitere Maß-Wert-Paare dahinter (Name Wert Name Wert …). AUSSEN=1 gibt gesperrte Außenmaße frei, EXPORT=<datei> schreibt die Änderungsliste.
   Ausgabe: $OUT/probe_<Geschoss>.png, Meldungen des Probiermodus auf der Konsole; Breite × Höhe per W und H (Standard 1280 × 800), THEME=dark. */
const { chromium } = require('playwright');
const fs = require('fs');
const G = (process.argv[2] || 'EG').toUpperCase(), paare = process.argv.slice(3);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 800) }, colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light' });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.goto('file://' + require('path').resolve(__dirname, '../dist/test_page.html'), { waitUntil: 'commit' });
  await pg.waitForTimeout(2500);
  await pg.evaluate(g => document.querySelector('[data-modus="' + g + '"]').click(), G);
  await pg.waitForTimeout(400);
  if (await pg.evaluate(() => document.getElementById('panel').classList.contains('closed'))) await pg.click('#togglePanel'); // schmaler Bildschirm: Menü ist zu
  await pg.click('#pm-an');
  if (process.env.AUSSEN) await pg.click('#pm-aussen');
  for (let i = 0; i + 1 < paare.length; i += 2) {
    await pg.evaluate(name => { const el = document.querySelector('#planSvg [data-name="' + name + '"]'); if (!el) throw new Error('Maß nicht im Plan: ' + name); const r = el.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, paare[i]);
    await pg.fill('#pm-wert', paare[i + 1]);
    await pg.click('#pm-ok');
    await pg.waitForTimeout(400);
    const f = (await pg.textContent('#pm-fehler')).trim();
    console.log(paare[i] + ' = ' + paare[i + 1] + (f ? ' → ABGELEHNT: ' + f : ' → übernommen'));
  }
  console.log('Änderungen: ' + (await pg.textContent('#pm-liste')).trim());
  if (!(await pg.getAttribute('#pm-aus', 'hidden') !== null)) console.log('Auswirkungen:\n' + (await pg.textContent('#pm-aus')));
  if (process.env.EXPORT) { await pg.click('#pm-export'); fs.writeFileSync(process.env.EXPORT, await pg.inputValue('#pm-text')); console.log('Export: ' + process.env.EXPORT); }
  await pg.screenshot({ path: (process.env.OUT || '.') + '/probe_' + G + '.png' });
  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
