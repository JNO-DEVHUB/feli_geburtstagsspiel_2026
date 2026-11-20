// Browser-Probe für „Siebenmeter!“ (handball): spielt mit echten Wisch-Gesten einmal bis zum Sieg und
// einmal bis zur Niederlage, jeweils auf 390×844 und 360×640, und macht Bildschirmfotos.
// Aufruf: npm run build && node scripts/games/handball.mjs      (Bilder landen in screenshots/)
/* global window, document */
import { openApp } from '../lib.mjs';

const fail = (msg) => {
  console.error('FEHLER:', msg);
  process.exitCode = 1;
};

async function start(viewport) {
  const app = await openApp({ query: '?debug=1&go=game:4', viewport });
  const { page } = app;
  await page.click('.howto .btn');
  await page.waitForFunction(() => globalThis.__game?.info().phase === 'aim');
  const game = {
    info: () => page.evaluate(() => globalThis.__game.info()),
    keeper: (mode) => page.evaluate((m) => globalThis.__game.keeper(m), mode),
    victim: (kind) => page.evaluate((k) => globalThis.__game.victim(k), kind),
    speed: (s) => page.evaluate((v) => globalThis.__game.speed(v), s),
    waitPhase: (phase) => page.waitForFunction((p) => globalThis.__game?.info().phase === p, phase, { timeout: 8000 }),
    // Wisch vom Ball aus; dx/dy als Anteil der Bühnenbreite. release: false lässt den Finger liegen.
    async swipe(dx, dy, { release = true, steps = 7 } = {}) {
      const i = await game.info();
      const box = await page.evaluate(() => {
        const r = document.querySelector('.game-root').getBoundingClientRect();
        return { x: r.left, y: r.top };
      });
      const x0 = box.x + i.ball.x;
      const y0 = box.y + i.ball.y;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      for (let s = 1; s <= steps; s++) {
        await page.mouse.move(x0 + (dx * i.w * s) / steps, y0 + (dy * i.w * s) / steps);
        await page.waitForTimeout(18);
      }
      if (release) await page.mouse.up();
    },
    // Wurf abwarten, kurz nach dem Aufprall einfrieren, Foto machen, weiterspielen.
    async shotAfterImpact(name, expected) {
      await game.waitPhase('after');
      const i = await game.info();
      if (i.last !== expected) fail(`${name}: erwartet ${expected}, war ${i.last}`);
      await page.waitForTimeout(260);
      await game.speed(0);
      await app.shot(name);
      await game.speed(1);
    },
  };
  return { app, page, game };
}

async function finish({ app, page }, tag, name, expectWon) {
  await page.waitForSelector('.game-banner', { timeout: 8000 });
  await app.shot(`${tag}-${name}`);
  await page.waitForFunction(() => window.__feli.step().startsWith('frame:'), null, { timeout: 8000 });
  console.log(`${tag}: ${name} (${expectWon ? 'gewonnen' : 'verloren'}) → ${await page.evaluate(() => window.__feli.step())}`);
  if (app.errors.length) fail(`${tag}: ${app.errors.join(' | ')}`);
  await app.close();
}

async function playWin(viewport, tag) {
  const run = await start(viewport);
  const { app, page, game } = run;
  await page.waitForTimeout(900);
  await app.shot(`${tag}-start`);

  // Antippen und Wisch nach unten zählen nicht.
  await game.swipe(0, 0);
  await app.shot(`${tag}-hinweis`);
  await game.swipe(0.05, 0.3);
  if ((await game.info()).throws !== 0) fail('Antippen oder Wisch nach unten wurde als Wurf gezählt');
  await page.waitForTimeout(1500);

  // 1. Wurf: Vorschau-Linie, Ball im Flug, Tor.
  await game.keeper('away');
  await game.swipe(-0.12, -0.42, { release: false });
  await app.shot(`${tag}-vorschau`);
  await game.speed(0.35);
  await page.mouse.up();
  await page.waitForFunction(() => globalThis.__game.info().flying >= 0.5);
  await game.speed(0);
  await app.shot(`${tag}-flug`);
  await game.speed(1);
  await game.shotAfterImpact(`${tag}-tor`, 'goal');
  await game.waitPhase('aim');

  // 2. Wurf: gehalten.
  await game.keeper('catch');
  await game.swipe(0.08, -0.36);
  await game.shotAfterImpact(`${tag}-gehalten`, 'saved');
  await game.waitPhase('aim');

  // 3. Wurf: weit daneben, trifft Franks im Publikum.
  await game.keeper(null);
  await game.victim('franks');
  await game.swipe(0.5, -0.4);
  await game.shotAfterImpact(`${tag}-daneben`, 'miss');
  await game.waitPhase('aim');

  // 4. und 5. Wurf: Tore → Sieg.
  await game.keeper('away');
  await game.swipe(0.1, -0.3);
  await game.waitPhase('after');
  await game.waitPhase('aim');
  await game.swipe(-0.02, -0.5);
  const end = await game.info();
  await game.waitPhase('over');
  const i = await game.info();
  if (i.goals !== 3 || i.throws !== 5) fail(`Sieg-Lauf: ${JSON.stringify(i.results)} (vorher ${JSON.stringify(end.results)})`);
  await finish(run, tag, 'sieg', true);
}

async function playLose(viewport, tag) {
  const run = await start(viewport);
  const { game } = run;
  await game.keeper('catch');
  await game.swipe(-0.1, -0.3);
  await game.waitPhase('after');
  await game.waitPhase('aim');

  // Zu langer Wisch: über die Latte, trifft die Taube.
  await game.victim('pigeon');
  await game.swipe(0.04, -1.15);
  await game.shotAfterImpact(`${tag}-drueber`, 'miss');
  await game.waitPhase('aim');

  // Dritter Fehlwurf: 3 Tore sind nicht mehr möglich → sofort verloren, obwohl noch 2 Würfe übrig wären.
  await game.swipe(0.02, -0.4);
  await game.waitPhase('over');
  const i = await game.info();
  if (i.goals !== 0 || i.throws !== 3) fail(`Niederlage-Lauf: ${JSON.stringify(i.results)}`);
  await finish(run, tag, 'niederlage', false);
}

for (const [viewport, tag] of [
  [{ width: 390, height: 844 }, 'handball'],
  [{ width: 360, height: 640 }, 'handball-360'],
]) {
  await playWin(viewport, tag);
  await playLose(viewport, tag);
}
console.log(process.exitCode ? 'Probe mit Fehlern beendet.' : 'Probe ok.');
