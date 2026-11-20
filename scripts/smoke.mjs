// End-to-End-Rauchtest im echten Browser (390×844, Touch): kompletter Durchlauf über den Debug-Modus,
// Neuladen mitten im Kapitel, Bildschirmfotos aller Bildschirme.
// Aufruf: npm run build && npm run smoke        (Bilder landen in screenshots/, änderbar per SCREENSHOTS=pfad)
/* global window */
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadPlaywright() {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return createRequire(join(execSync('npm root -g').toString().trim(), '/'))('playwright');
  }
}
const { chromium } = loadPlaywright();
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const shots = process.env.SCREENSHOTS || join(root, '..', 'screenshots');
await mkdir(shots, { recursive: true });
const BASE = '/feli_geburtstagsspiel_2026/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };

// Server unter demselben Unterpfad wie GitHub Pages, damit falsche absolute Pfade auffallen.
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith(BASE)) {
    res.writeHead(404);
    return res.end();
  }
  const path = join(root, url.slice(BASE.length).replace(/^$|\/$/, 'index.html'));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const origin = `http://127.0.0.1:${server.address().port}${BASE}`;

const fail = (msg) => {
  console.error('FEHLER:', msg);
  process.exitCode = 1;
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/k1_berlin/.test(m.location().url) && errors.push(m.text()));
page.on('requestfailed', (r) => errors.push('Anfrage fehlgeschlagen: ' + r.url()));
page.on('response', (r) => r.status() >= 400 && !/k1_berlin/.test(r.url()) && errors.push(`HTTP ${r.status()}: ${r.url()}`));

let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(shots, `${String(++n).padStart(2, '0')}-${name}.png`) });
};
const step = () => page.evaluate(() => window.__feli.step());
const waitStep = (s) => page.waitForFunction((x) => window.__feli?.step() === x, s, { timeout: 15000 });
const tap = (x = 195, y = 420) => page.touchscreen.tap(x, y);
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
  await shot('trailer-1');
  await page.waitForTimeout(2600);
  await shot('trailer-2');
  await page.waitForTimeout(2600);
  await shot('trailer-3');
  await page.click('.trailer-skip');
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
  await page.waitForTimeout(800);
  await shot('finale-frage');
  await page.evaluate(() => window.__feliFinale?.skipTo?.('quiz'));
  const wrong = page.locator('.answer', { hasText: 'Franzbrötchen' });
  if (await wrong.count()) {
    await wrong.click();
    await page.waitForTimeout(700);
    await shot('finale-falsch');
    await page.locator('.answer', { hasText: 'Wochenende' }).click();
    await page.waitForTimeout(900);
    await shot('finale-richtig');
  }
  // Kanone und Rubbel-Konfetti (falls schon gebaut): wischen, bis der Gutschein frei liegt.
  for (let i = 0; i < 40 && (await step()) === 'finale'; i++) {
    if (await page.locator('.scratch').count()) {
      if (i === 0 || !(await page.locator('.scratch.shot').count())) {
        await page.waitForTimeout(600);
      }
      const y = 120 + ((i * 53) % 620);
      await page.mouse.move(20, y);
      await page.mouse.down();
      await page.mouse.move(370, y + 30, { steps: 8 });
      await page.mouse.up();
      if (i === 4) await shot('finale-konfetti');
    } else await page.waitForTimeout(500);
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
  await browser.close();
  server.close();
}
