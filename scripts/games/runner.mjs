// Browser-Probe für das Spiel runner (Kapitel 1: Im Galopp zum Südkreuz).
// Aufruf: npm run build && node scripts/games/runner.mjs      (Bilder landen in screenshots/)
//
// 1. Autopilot gewinnt im Zeitraffer ohne Herzverlust (390×844), Fotos der wichtigen Momente.
// 2. Ein Lauf ohne Eingaben verliert nach drei Treffern.
// 3. Kleinste Bühne (360×640): echter Tipp springt, Autopilot gewinnt auch dort.
/* global window, document, requestAnimationFrame */
import { join } from 'node:path';
import { openApp } from '../lib.mjs';

const SEED = Number(process.env.SEED) || 7;
const problems = [];
const fail = (msg) => {
  console.error('FEHLER:', msg);
  problems.push(msg);
  process.exitCode = 1;
};

async function start(viewport, tag) {
  const app = await openApp({ query: `?debug=1&go=game:0&seed=${SEED}`, viewport });
  const { page } = app;
  await page.waitForSelector('.howto .btn');
  await page.click('.howto .btn');
  await page.waitForFunction(() => !!globalThis.__game);

  const shot = async (name, delay = 0) => {
    if (delay) await page.waitForTimeout(delay);
    await page.screenshot({ path: join(app.shots, `runner-${tag}-${name}.png`) });
  };
  const game = (fn, arg) => page.evaluate(fn, arg);
  // Läuft mit Zeitraffer weiter, bis die Bedingung (JS-Ausdruck über den Zustand s) gilt, und hält dann an.
  const until = (cond, { rate = 3, timeout = 60000 } = {}) =>
    page.evaluate(
      ({ cond, rate, timeout }) =>
        new Promise((resolve, reject) => {
          const pred = new Function('s', 'return ' + cond);
          const t0 = performance.now();
          const g = globalThis.__game;
          g.rate(rate);
          g.pause(false);
          const loop = () => {
            if (globalThis.__game !== g) return reject(new Error('Spiel beendet vor: ' + cond));
            const s = g.state();
            if (pred(s)) {
              g.pause(true);
              return resolve(s);
            }
            if (performance.now() - t0 > timeout) return reject(new Error('Zeit abgelaufen: ' + cond + ' ' + JSON.stringify(s)));
            requestAnimationFrame(loop);
          };
          loop();
        }),
      { cond, rate, timeout },
    );
  const resume = (rate = 1) =>
    game((r) => {
      globalThis.__game.rate(r);
      globalThis.__game.pause(false);
    }, rate);
  // Nach ctx.end(): Rahmen-Bildschirm erreicht, Ergebnis gespeichert, Spiel aufgeräumt.
  const finish = async (won) => {
    await resume(1);
    await page.waitForFunction(() => window.__feli.step().startsWith('frame:'), null, { timeout: 15000 });
    const after = await page.evaluate(() => ({
      result: window.__feli.progress().results[0],
      game: typeof globalThis.__game,
      left: document.querySelectorAll('.g-runner, .g-runner-hint, .g-runner-warn, .game-canvas').length,
    }));
    if ((after.result === true) !== won) fail(`${tag}: Ergebnis ${after.result}, erwartet ${won}`);
    if (after.game !== 'undefined' || after.left) fail(`${tag}: destroy() hat nicht aufgeräumt (${JSON.stringify(after)})`);
    if (app.errors.length) fail(`${tag}: Browser-Fehler: ${app.errors.join(' | ')}`);
    await app.close();
  };
  return { app, page, shot, game, until, resume, finish };
}

// Nichts außer dem Stumm-Schalter darf oben rechts in 3em × 3em liegen.
async function checkCorner(page, tag) {
  const hits = await page.evaluate(() => {
    const root = document.querySelector('.game-root');
    const r = root.getBoundingClientRect();
    const em = parseFloat(globalThis.getComputedStyle(root).fontSize);
    const box = { l: r.right - 3 * em, t: r.top, r: r.right, b: r.top + 3 * em };
    return [...root.querySelectorAll('.hud *, .g-runner-hint, .g-runner-warn')]
      .filter((el) => el.children.length === 0 || el.classList.contains('hud-bar'))
      .map((el) => [el.className || el.tagName, el.getBoundingClientRect()])
      .filter(([, b]) => b.width > 0 && b.right > box.l + 1 && b.left < box.r && b.bottom > box.t + 1 && b.top < box.b)
      .map(([name]) => String(name));
  });
  if (hits.length) fail(`${tag}: Elemente unter dem Stumm-Schalter: ${hits.join(', ')}`);
}

// --- 1. Autopilot gewinnt (390×844) ---
async function winRun() {
  const t = await start({ width: 390, height: 844 }, 'a');
  await t.shot('01-start', 500);
  await checkCorner(t.page, 'a');
  await t.game(() => globalThis.__game.auto(true));

  await t.until("s.hint === 'Tippen = springen!'", { rate: 2 });
  await t.shot('02-hinweis', 350);
  await t.until('s.jumps === 1 && s.alt > 110 && s.v < 150', { rate: 1 });
  await t.shot('03-sprung');
  const treats = (await t.until('s.treats > 0', { rate: 1 })).treats;
  await t.shot('04-leckerli', 160);
  if (!treats) fail('kein Leckerli eingesammelt');

  await t.until("s.warn && s.hint === 'Doppelsprung!'", { rate: 3 });
  await t.shot('05-warnung', 350);
  await t.until("s.jumps === 2 && s.next && s.next.kind === 'kehrmaschine' && s.next.sx < 150", { rate: 1 });
  await t.shot('06-doppelsprung');

  const length = (await t.game(() => globalThis.__game.state())).length;
  await t.until(`s.dist > ${length - 330}`, { rate: 3 });
  await t.shot('07-suedkreuz');
  const won = await t.until("s.phase === 'won'", { rate: 2 });
  if (won.time < 38 || won.time > 43) fail(`Laufzeit ${won.time.toFixed(1)} s liegt nicht bei ca. 40 s`);
  if (won.hearts !== 3) fail(`Autopilot hat Herzen verloren: ${won.hearts}`);
  await t.until('s.stopped', { rate: 1 });
  await t.resume(1);
  await t.shot('08-sieg', 700);
  await t.finish(true);
  console.log(`Sieg: ${won.time.toFixed(1)} s, ${won.hearts} Herzen, ${won.treats} Leckerlis`);
}

// --- 2. Ohne Eingaben verlieren ---
async function loseRun() {
  const t = await start({ width: 390, height: 844 }, 'b');
  const hit = await t.until('s.hits === 1', { rate: 2 });
  if (hit.hearts !== 2) fail(`Treffer kostet nicht genau ein Herz: ${hit.hearts}`);
  await t.shot('01-treffer', 140);
  await t.until('s.inv > 0 && s.inv < 1.2 && Math.floor(s.inv * 9) % 2 === 0', { rate: 1 });
  await t.shot('02-blinken');
  const lost = await t.until("s.phase === 'lost'", { rate: 3 });
  if (lost.hits !== 3 || lost.hearts !== 0) fail(`Niederlage nach ${lost.hits} Treffern, ${lost.hearts} Herzen`);
  await t.until('s.stopped', { rate: 1 });
  await t.resume(1);
  await t.shot('03-niederlage', 700);
  await t.finish(false);
  console.log(`Niederlage nach ${lost.time.toFixed(1)} s und ${lost.hits} Treffern`);
}

// --- 3. Kleinste Bühne 360×640 ---
async function smallRun() {
  const t = await start({ width: 360, height: 640 }, 'c');
  await t.shot('01-start', 500);
  await checkCorner(t.page, 'c');
  // echter Tipp auf den Bildschirm = Sprung, zweiter Tipp in der Luft = Doppelsprung
  await t.page.touchscreen.tap(180, 400);
  await t.page.waitForTimeout(180);
  await t.page.touchscreen.tap(180, 400);
  await t.page.waitForTimeout(120);
  const s = await t.game(() => ({ jumps: globalThis.__game.world.jumps, doubles: globalThis.__game.world.doubleJumps }));
  if (s.jumps !== 1 || s.doubles !== 1) fail(`Tippen springt nicht: ${JSON.stringify(s)}`);
  await t.game(() => globalThis.__game.auto(true));
  await t.until("s.warn && s.hint === 'Doppelsprung!'", { rate: 3 });
  await t.shot('02-warnung', 350);
  await t.until("s.jumps === 2 && s.next && s.next.kind === 'kehrmaschine' && s.next.sx < 150", { rate: 1 });
  await t.shot('03-doppelsprung');
  const won = await t.until("s.phase === 'won'", { rate: 3 });
  if (won.hearts !== 3) fail(`360×640: Autopilot hat Herzen verloren: ${won.hearts}`);
  await t.until('s.stopped', { rate: 1 });
  await t.resume(1);
  await t.shot('04-sieg', 700);
  await t.finish(true);
}

const only = process.env.ONLY;
try {
  if (!only || only === 'win') await winRun();
  if (!only || only === 'lose') await loseRun();
  if (!only || only === 'small') await smallRun();
} catch (err) {
  fail(err.message);
}
console.log(problems.length ? `runner: ${problems.length} Problem(e)` : 'runner: alles in Ordnung');
process.exit(process.exitCode ?? 0);
