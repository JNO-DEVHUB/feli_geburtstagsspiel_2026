// End-to-End-Rauchtest im echten Browser (390×844, Touch): kompletter Durchlauf über den Debug-Modus,
// Neuladen mitten im Kapitel, Bildschirmfotos aller Bildschirme.
// Aufruf: npm run build && npm run smoke        (Bilder landen in screenshots/, änderbar per SCREENSHOTS=pfad)
/* global window */
import { join } from 'node:path';
import { openApp } from './lib.mjs';

const { page, origin, errors, shots, close } = await openApp({ query: '' });

const fail = (msg) => {
  console.error('FEHLER:', msg);
  process.exitCode = 1;
};

let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(shots, `${String(++n).padStart(2, '0')}-${name}.png`) });
};
const step = () => page.evaluate(() => window.__feli.step());
const waitStep = (s) => page.waitForFunction((x) => window.__feli?.step() === x, s, { timeout: 15000 });
const size = page.viewportSize();
const tap = (x = size.width / 2, y = size.height / 2) => page.touchscreen.tap(x, y);
async function tapThrough(prefix) {
  for (let i = 0; i < 80 && (await step()).startsWith(prefix); i++) {
    await tap();
    await page.waitForTimeout(70);
  }
}

try {
  const t0 = Date.now();
  await page.goto(origin + '?debug=1');
  await waitStep('card');
  await page.waitForSelector('.card-screen');
  const loadMs = Date.now() - t0;
  await shot('karte-zu');
  await tap();
  await page.waitForTimeout(2200);
  await shot('karte-offen');
  await page.click('.card-go');
  await waitStep('trailer');
  await page.waitForTimeout(1500);
  await shot('trailer-praesentiert');
  await page.waitForTimeout(2600);
  await shot('trailer-titel');
  for (let c = 0; c < 6; c++) {
    await page.waitForFunction((i) => window.document.querySelector('.t-chapter.c' + i), c, { timeout: 8000 });
    await page.waitForTimeout(c === 0 ? 650 : 1050);
    await shot(`trailer-k${c + 1}`);
  }
  await page.waitForSelector('.t-end', { timeout: 9000 });
  await shot('trailer-ende');
  if (process.env.FULL_TRAILER) await page.click('.t-end .btn');
  else {
    await page.evaluate(() => window.__feli.go('trailer'));
    await page.waitForSelector('.trailer-skip:not([hidden])', { timeout: 6000 });
    await page.click('.trailer-skip');
  }
  await waitStep('prolog');
  await page.waitForTimeout(900);
  await shot('prolog');
  await tapThrough('prolog');

  for (let c = 0; c < 6; c++) {
    if ((await step()) === `story:${c}`) {
      await page.waitForTimeout(700);
      await shot(`k${c + 1}-story`);
      if (c === 1) {
        // Neuladen mitten im Kapitel: es geht am Kapitelanfang weiter, nichts ist verloren.
        await tapThrough('story');
        await waitStep(`game:${c}`);
        await page.reload();
        await waitStep(`story:${c}`);
        const results = await page.evaluate(() => window.__feli.progress().results);
        if (results[c] !== null) fail('Neuladen im Spiel hat ein Ergebnis gespeichert');
      }
      await tapThrough('story');
    }
    await waitStep(`game:${c}`);
    await shot(`k${c + 1}-regeln`);
    await page.click('.howto .btn');
    await page.waitForTimeout(900);
    await shot(`k${c + 1}-spiel`);
    // Kapitel 3 wird verloren, damit auch der "PUFF!"-Weg geprüft ist.
    await page.evaluate((won) => (won ? window.__feli.win() : window.__feli.lose()), c !== 2);
    await waitStep(`frame:${c}`);
    await page.waitForTimeout(c === 2 ? 1500 : 1300);
    await shot(`k${c + 1}-rahmen-animation`);
    await page.waitForSelector('.frame-actions:not(.waiting)', { timeout: 8000 });
    await shot(`k${c + 1}-rahmen`);
    if (c === 3) {
      // Neuladen am Bilderrahmen: Ergebnis bleibt, kein zweiter Versuch.
      await page.reload();
      await waitStep(`frame:${c}`);
      await page.waitForSelector('.frame-actions:not(.waiting)');
    }
    await page.click('.frame-actions .btn:last-child');
  }

  await waitStep('finale');
  await page.waitForTimeout(250);
  await shot('finale-puzzle-start');
  await page.waitForFunction(() => window.__feliFinale?.phase() === 'assembled', null, { timeout: 15000 });
  await page.screenshot({ path: join(shots, `${String(++n).padStart(2, '0')}-finale-puzzle-gross.png`) });
  await page.waitForSelector('.answers:not([hidden]) .answer', { timeout: 15000 });
  await page.waitForTimeout(900);
  await shot('finale-frage');
  await page.locator('.answer', { hasText: 'dritter Kater' }).click();
  await page.waitForTimeout(600);
  await shot('finale-falsch');
  await page.waitForTimeout(1500);
  await page.locator('.answer', { hasText: 'Wochenende' }).click();
  await page.waitForTimeout(700);
  await shot('finale-richtig');
  await page.waitForSelector('.cannon-scene.lit', { timeout: 8000 });
  await page.waitForTimeout(900);
  await shot('finale-kanone');
  await page.waitForSelector('.scratch.shot', { timeout: 8000 });
  await page.waitForTimeout(900);
  await shot('finale-konfetti');
  // Konfetti wegwischen wie ein Rubbellos, bis der Rest von selbst fällt.
  for (let i = 0; i < 30 && (await step()) === 'finale'; i++) {
    const y = 40 + i * size.height * 0.066;
    if (y > size.height - 30) break;
    await page.mouse.move(15, y);
    await page.mouse.down();
    await page.mouse.move(size.width - 15, y + 15, { steps: 6 });
    await page.mouse.up();
    if (i === 5) await shot('finale-rubbeln');
  }
  await waitStep('voucher');
  await page.waitForTimeout(900);
  await shot('gutschein');
  await page.click('.voucher-screen .btn');
  await waitStep('hall');
  await shot('spielesaal');

  const p = await page.evaluate(() => window.__feli.progress());
  if (!p.firstRunDone) fail('erster Durchlauf nicht als erledigt gespeichert');
  if (p.results.filter((r) => r === true).length !== 5 || p.results[2] !== false) fail('Ergebnisse falsch: ' + JSON.stringify(p.results));

  // Spielesaal: verlorenes Spiel nachholen, Teil wird nachträglich eingesetzt.
  await page.click('.hall-card:nth-child(3)');
  await page.click('.howto .btn');
  await page.evaluate(() => window.__feli.win());
  await page.waitForSelector('.frame-actions:not(.waiting)', { timeout: 8000 });
  await shot('spielesaal-nachgeholt');
  const after = await page.evaluate(() => window.__feli.progress().results);
  if (after[2] !== true) fail('nachgeholtes Teil nicht gespeichert');
  await page.click('.frame-actions .btn:last-child');
  await page.click('.hall-actions .btn.ghost');
  await shot('spielesaal-puzzle');

  // Zweites Öffnen ohne Debug: direkt im Spielesaal, Debug-Leiste unsichtbar.
  await page.goto(origin);
  await page.waitForSelector('.hall');
  if (await page.locator('.debug').count()) fail('Debug-Leiste ohne ?debug=1 sichtbar');
  const title = await page.title();
  if (title !== 'Felis große Reise 👑') fail('Titel falsch: ' + title);
  const overflow = await page.evaluate(() => window.document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) fail('horizontaler Überlauf');

  if (errors.length) fail('Konsolenfehler: ' + [...new Set(errors)].join(' | '));
  console.log(`${process.exitCode ? 'FEHLGESCHLAGEN' : 'ok'}: ${n} Bildschirmfotos in ${shots}, Start in ${loadMs} ms`);
} catch (err) {
  fail(`${err.message}\nSchritt: ${await step().catch(() => '?')}`);
  await page.screenshot({ path: join(shots, 'fehler.png') }).catch(() => {});
  if (errors.length) console.error('Konsolenfehler:', [...new Set(errors)].join(' | '));
} finally {
  await close();
}
