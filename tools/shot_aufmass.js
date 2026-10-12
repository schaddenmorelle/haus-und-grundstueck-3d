/* Aufmaß der Seite im Grundriss (Playwright): Aufmaß erfassen einschalten, Maße anklicken, Messwerte eingeben, Screenshot und Export der Messliste. Aufruf:
     NODE_PATH=$(npm root -g) OUT=/tmp node tools/shot_aufmass.js EG raum:speis.tiefe 125 raum:kind1.breite 339,5
   Weitere Maß-Wert-Paare dahinter (Name Wert Name Wert …; Wert in cm oder mit Einheit). Ohne Paare zeigt der Screenshot nur die Prüfmaße im Plan.
   EXPORT=<datei> schreibt die Messliste, LISTE=1 klappt die Liste der Prüfmaße auf, PROBE="<Maß> <Wert>" ändert vorher ein Maß im Probiermodus
   (die Abweichungen folgen dem geänderten Haus). Ausgabe: $OUT/aufmass_<Geschoss>.png; Breite × Höhe per W und H (Standard 1280 × 800), THEME=dark. */
const { chromium } = require('playwright');
const fs = require('fs');
const G = /^(eg|dg)$/i.test(process.argv[2] || 'EG') ? (process.argv[2] || 'EG').toUpperCase() : process.argv[2], paare = process.argv.slice(3);
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
  const klick = name => pg.evaluate(n => { const el = document.querySelector('#planSvg [data-name="' + n + '"]'); if (!el) throw new Error('Maß nicht im Plan: ' + n); const r = el.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, name);
  if (process.env.PROBE) {
    const [name, wert] = process.env.PROBE.split(' ');
    await pg.click('#pm-an'); await klick(name); await pg.fill('#pm-wert', wert); await pg.click('#pm-ok'); await pg.waitForTimeout(400);
    console.log('Probiermodus: ' + name + ' = ' + wert + ' → ' + ((await pg.textContent('#pm-fehler')).trim() || 'übernommen'));
  }
  if (process.env.LISTE) await pg.evaluate(() => { document.querySelector('#aufmass details').open = true; });
  await pg.click('#am-an');
  for (let i = 0; i + 1 < paare.length; i += 2) {
    await klick(paare[i]);
    await pg.fill('#am-wert', paare[i + 1]);
    await pg.click('#am-ok');
    await pg.waitForTimeout(300);
    const f = (await pg.textContent('#am-fehler')).trim();
    console.log(paare[i] + ' = ' + paare[i + 1] + (f ? ' → ABGELEHNT: ' + f : ' → erfasst'));
  }
  console.log('Zusammenfassung: ' + (await pg.textContent('#am-summe')).trim());
  console.log('Neu erfasst:\n' + (await pg.evaluate(() => [].map.call(document.querySelectorAll('#am-neu li'), l => '  ' + l.textContent).join('\n'))));
  console.log('Im Plan gekennzeichnet: ' + (await pg.evaluate(() => document.querySelectorAll('#planSvg .hit.gem').length)) + ', davon auffällig ' + (await pg.evaluate(() => document.querySelectorAll('#planSvg .hit.gem.abw').length)));
  if (process.env.EXPORT) { await pg.click('#am-export'); fs.writeFileSync(process.env.EXPORT, await pg.inputValue('#am-text')); console.log('Export: ' + process.env.EXPORT); }
  await pg.screenshot({ path: (process.env.OUT || '.') + '/aufmass_' + G.replace(':', '_') + '.png' });
  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
