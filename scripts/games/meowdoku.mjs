// Browser-Probe für das Meowdoku (Kapitel 2): Regel-Erklärung, ein Durchlauf bis zum Sieg, einer bis zur
// Niederlage, dazu eine Layout-Prüfung auf dem kleinsten Bildschirm (360 × 640).
// Aufruf: npm run build && node scripts/games/meowdoku.mjs      (Bilder landen in screenshots/)
/* global window, document, getComputedStyle */
import { openApp } from '../lib.mjs';

const QUERY = '?debug=1&go=game:1';
const SIZE = 6;

const fail = (msg) => {
  console.error('FEHLER:', msg);
  process.exitCode = 1;
};

// Öffnet das Spiel bis zur Regel-Erklärung und liefert Helfer für Tipps auf echte Bildschirmkoordinaten.
async function open(viewport, tag) {
  const app = await openApp({ query: QUERY, ...(viewport ? { viewport } : {}) });
  const { page } = app;
  const shot = (name) => app.shot(`meowdoku-${tag}-${name}`);
  await page.waitForSelector('.howto .btn');
  await page.click('.howto .btn');
  await page.waitForSelector('.g-meowdoku-tut');
  await page.waitForTimeout(450); // Karte ploppt auf
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(globalThis.__game.state())));
  const tapCell = async (row, col) => {
    const box = await page.locator(`.g-meowdoku-board .g-meowdoku-cell[data-row="${row}"][data-col="${col}"]`).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  };
  // leer → ✕ → Kater
  const cat = async (row, col) => {
    await tapCell(row, col);
    await page.waitForTimeout(70); // schneller Doppeltipp
    await tapCell(row, col);
  };
  const cellState = (row, col) => page.getAttribute(`.g-meowdoku-board .g-meowdoku-cell[data-row="${row}"][data-col="${col}"]`, 'data-state');
  const waitFrame = () => page.waitForFunction(() => window.__feli.step().startsWith('frame:'), null, { timeout: 8000 });
  return { app, page, shot, state, tapCell, cat, cellState, waitFrame };
}

// Nichts ragt aus der Bühne, nichts liegt unter dem Stumm-Schalter, Tippziele sind groß genug.
async function checkLayout(page, where) {
  const report = await page.evaluate(() => {
    const em = parseFloat(getComputedStyle(document.querySelector('.game-root')).fontSize);
    const root = document.querySelector('.game-root').getBoundingClientRect();
    const mute = document.querySelector('.mute')?.getBoundingClientRect();
    const problems = [];
    const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const check = (sel, { minTap = 0 } = {}) => {
      for (const el of document.querySelectorAll(sel)) {
        if (el.hidden || !el.offsetParent) continue;
        const r = el.getBoundingClientRect();
        if (r.left < root.left - 0.5 || r.right > root.right + 0.5 || r.top < root.top - 0.5 || r.bottom > root.bottom + 0.5) problems.push(`${sel} ragt aus der Bühne (${Math.round(r.left)},${Math.round(r.top)} – ${Math.round(r.right)},${Math.round(r.bottom)})`);
        if (mute && hits(r, mute)) problems.push(`${sel} liegt unter dem Stumm-Schalter`);
        if (minTap && (r.width < minTap * em - 0.5 || r.height < minTap * em - 0.5)) problems.push(`${sel} ist als Tippziel zu klein: ${(r.width / em).toFixed(2)} × ${(r.height / em).toFixed(2)} em`);
        if (el.scrollWidth > el.clientWidth + 1 && sel !== '.g-meowdoku-board') problems.push(`${sel} schneidet Text ab`);
      }
    };
    check('.g-meowdoku-card');
    check('.g-meowdoku-board .g-meowdoku-cell', { minTap: 3.1 });
    check('.g-meowdoku-count');
    check('.g-meowdoku-legend');
    check('.hud-hearts');
    check('.g-meowdoku-tut-card');
    check('.g-meowdoku-tut-card .btn', { minTap: 2.6 });
    check('.g-meowdoku-tut-card .linkbtn', { minTap: 2.6 });
    check('.g-meowdoku-tut-card p');
    check('.g-meowdoku-tut-card figcaption');
    const card = document.querySelector('.g-meowdoku-card').getBoundingClientRect();
    const hud = document.querySelector('.hud-hearts').getBoundingClientRect();
    if (hits(card, hud)) problems.push('Karte überlappt die Herzen');
    const cell = document.querySelector('.g-meowdoku-board .g-meowdoku-cell').getBoundingClientRect();
    return { problems, cellEm: cell.width / em, cardShare: card.width / root.width, em };
  });
  for (const p of report.problems) fail(`${where}: ${p}`);
  console.log(`  Layout ${where}: Zelle ${report.cellEm.toFixed(2)} em, Karte ${(report.cardShare * 100).toFixed(0)} % der Breite, 1em = ${report.em.toFixed(1)}px, ${report.problems.length} Probleme`);
}

// --- 1. Durchlauf: Regel-Erklärung ansehen, Fehlversuch, Sieg ---
{
  const { app, page, shot, state, tapCell, cat, cellState, waitFrame } = await open(null, 'a');
  console.log('Sieg-Durchlauf (390 × 844)');
  await checkLayout(page, 'Erklärung 1');
  await shot('tutorial-1');
  // Solange die Erklärung offen ist, darf das Feld nicht reagieren.
  await page.evaluate(() => globalThis.__game.tap(0, 0));
  if ((await state()).cells[0][0] !== 'empty') fail('Feld reagiert schon während der Erklärung');
  await page.click('.g-meowdoku-next');
  await page.waitForFunction(() => document.querySelector('.g-meowdoku-next').textContent === 'Los!');
  await checkLayout(page, 'Erklärung 2');
  if (/false|undefined|null/.test(await page.textContent('.g-meowdoku-tut-card'))) fail('Erklärung enthält verirrten Text');
  await shot('tutorial-2');
  await page.click('.g-meowdoku-next');
  await page.waitForSelector('.g-meowdoku-tut', { state: 'detached' });
  await checkLayout(page, 'Start');
  await shot('start');

  const solution = await page.evaluate(() => globalThis.__game.solution);

  // Tipp-Zyklus mit echten Tipps: leer → ✕ → Kater
  await tapCell(2, 2);
  if ((await cellState(2, 2)) !== 'mark') fail('erster Tipp setzt kein ✕');
  await tapCell(4, 0);
  await cat(1, 3);
  await page.waitForTimeout(150);
  if ((await cellState(1, 3)) !== 'cat') fail('zweiter Tipp setzt keinen Kater');
  if ((await cellState(1, 0)) !== 'auto') fail('Auto-✕ in der Zeile fehlt');
  await cat(3, 1);
  await page.waitForTimeout(160);
  await page.screenshot({ path: `${app.shots}/meowdoku-a-miau.png` });
  // fester Kater und Auto-✕ lassen sich nicht wegtippen
  await tapCell(3, 1);
  await tapCell(3, 0);
  let s = await state();
  if (s.cells[3][1] !== 'cat' || s.hearts !== 3 || s.cats.length !== 2) fail('fester Kater oder Auto-✕ hat auf Tippen reagiert');
  if (!(await page.textContent('.g-meowdoku-count')).startsWith('2 von 6')) fail('Anzeige „x von 6 Katern sitzen“ stimmt nicht');
  await tapCell(5, 0); // ✕ von Hand auf einem noch freien Feld
  if ((await cellState(5, 0)) !== 'mark') fail('Hand-✕ fehlt');
  await page.waitForTimeout(700);
  await checkLayout(page, 'laufend');
  await shot('laufend');

  // Hinweis-Schimmer (kommt sonst erst nach längerem Stillstand)
  await page.evaluate(() => globalThis.__game.showHint());
  if ((await page.locator('.g-meowdoku-cell.hint').count()) !== 1) fail('Hinweis-Schimmer fehlt');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${app.shots}/meowdoku-a-hinweis.png` });

  // Fehlversuch: Kater faucht, Herz weg, rotes ✕
  await cat(5, 5);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${app.shots}/meowdoku-a-fehlversuch-fauch.png` });
  if (await page.locator('.g-meowdoku-cell.hint').count()) fail('Hinweis bleibt nach dem Tipp stehen');
  await page.waitForTimeout(800);
  s = await state();
  if (s.hearts !== 2 || s.cells[5][5] !== 'bad') fail('Fehlversuch: Herz oder rotes ✕ fehlt');
  if ((await cellState(5, 5)) !== 'bad') fail('rotes ✕ wird nicht angezeigt');
  if ((await page.locator('.hud-hearts .heart.off').count()) !== 1) fail('Herz-Anzeige stimmt nicht');
  await shot('fehlversuch');

  // Rest immer mit dem einfachen Schluss lösen, den das Spiel selbst kennt.
  for (let i = 0; i < SIZE; i++) {
    const hint = await page.evaluate(() => globalThis.__game.hint());
    if (!hint) break;
    if (solution[hint.row] !== hint.col) fail('Hinweis zeigt auf ein falsches Feld');
    await cat(hint.row, hint.col);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(320);
  await page.screenshot({ path: `${app.shots}/meowdoku-a-jubel.png` });
  s = await state();
  if (s.status !== 'won') fail(`nicht gewonnen: ${s.status}, ${s.cats.length} Kater`);
  await page.waitForSelector('.game-banner.win');
  await shot('sieg');
  await waitFrame();
  if (!(await page.evaluate(() => window.__feli.step())).startsWith('frame:')) fail('kein Bilderrahmen nach dem Sieg');
  if (await page.evaluate(() => '__game' in globalThis)) fail('__game bleibt nach destroy() stehen');
  if (app.errors.length) fail(app.errors.join('\n'));
  await app.close();
}

// --- 2. Durchlauf: Erklärung überspringen, drei Fehlversuche, Niederlage ---
{
  const { app, page, shot, state, cat, waitFrame } = await open(null, 'b');
  console.log('Niederlage-Durchlauf (390 × 844)');
  await page.click('.g-meowdoku-skip');
  await page.waitForSelector('.g-meowdoku-tut', { state: 'detached' });
  await cat(0, 0);
  await cat(4, 4);
  await page.waitForTimeout(400);
  for (const [row, col] of [[1, 5], [3, 2], [5, 1]]) {
    await cat(row, col);
    await page.waitForTimeout(250);
  }
  const s = await state();
  if (s.status !== 'lost' || s.hearts !== 0) fail(`nicht verloren: ${s.status}, ${s.hearts} Herzen`);
  // Nach dem Ende reagiert nichts mehr.
  await cat(1, 3);
  if ((await state()).cats.length !== 2) fail('Feld reagiert nach Spielende');
  await page.screenshot({ path: `${app.shots}/meowdoku-b-flucht.png` });
  await page.waitForSelector('.game-banner.lose');
  await shot('niederlage');
  await waitFrame();
  if (app.errors.length) fail(app.errors.join('\n'));
  await app.close();
}

// --- 3. Kleinster Bildschirm: nichts überlappt, nichts abgeschnitten ---
{
  const { app, page, shot, cat, state, waitFrame } = await open({ width: 360, height: 640 }, 'c360');
  console.log('Layout-Durchlauf (360 × 640)');
  await checkLayout(page, '360 Erklärung 1');
  await shot('tutorial-1');
  await page.click('.g-meowdoku-next');
  await page.waitForFunction(() => document.querySelector('.g-meowdoku-next').textContent === 'Los!');
  await checkLayout(page, '360 Erklärung 2');
  await shot('tutorial-2');
  // Schnell überspringen per Debug-Schnittstelle
  await page.evaluate(() => globalThis.__game.skipTutorial());
  await page.waitForSelector('.g-meowdoku-tut', { state: 'detached' });
  await cat(1, 3);
  await cat(3, 1);
  await cat(0, 5);
  await page.waitForTimeout(900);
  await checkLayout(page, '360 laufend');
  await shot('laufend');
  for (const [row, col] of [[0, 0], [4, 4], [2, 5], [5, 2]]) {
    await cat(row, col);
    await page.waitForTimeout(200);
  }
  if ((await state()).status !== 'won') fail('360: nicht gewonnen');
  await page.waitForSelector('.game-banner.win');
  await shot('sieg');
  await waitFrame();
  if (app.errors.length) fail(app.errors.join('\n'));
  await app.close();
}

// --- 4. Größter Bildschirm ---
{
  const { app, page, shot, cat } = await open({ width: 430, height: 932 }, 'd430');
  console.log('Layout-Durchlauf (430 × 932)');
  await checkLayout(page, '430 Erklärung 1');
  await page.evaluate(() => globalThis.__game.skipTutorial());
  await page.waitForSelector('.g-meowdoku-tut', { state: 'detached' });
  await cat(1, 3);
  await page.waitForTimeout(700);
  await checkLayout(page, '430 laufend');
  await shot('laufend');
  if (app.errors.length) fail(app.errors.join('\n'));
  await app.close();
}

console.log(process.exitCode ? 'Meowdoku-Probe: FEHLER' : 'Meowdoku-Probe: alles in Ordnung');
