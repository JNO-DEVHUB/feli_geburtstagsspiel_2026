// Browser-Probe für „Lacher wischen“ (Kapitel 6): spielt im echten Browser mit Wischgesten
// einmal bis zur Tomaten-Niederlage, einmal bis zum Zeitablauf und einmal bis zum Sieg,
// jeweils bei 390×844 und 360×640. Bildschirmfotos landen in screenshots/lacher-<breite>-NN-<name>.png.
// Aufruf: npm run build && node scripts/games/lacher.mjs [breite]
/* global window, document */
import { join } from 'node:path';
import { openApp } from '../lib.mjs';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
].filter((v) => !process.argv[2] || String(v.width) === process.argv[2]);

const fail = (msg) => {
  console.error('FEHLER:', msg);
  process.exitCode = 1;
};

// Abstand Punkt–Strecke
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const u = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(ax + u * dx - px, ay + u * dy - py);
}

async function probe(viewport) {
  const app = await openApp({ query: '?debug=1&go=game:5', viewport });
  const { page } = app;
  const tag = `lacher-${viewport.width}`;
  let n = 0;
  const snap = (name) => page.screenshot({ path: join(app.shots, `${tag}-${String(++n).padStart(2, '0')}-${name}.png`) });
  // Vorhalt: Zwischen Abfrage und Wisch vergehen ein paar Browser-Aufrufe, so lange fliegen die Objekte weiter.
  let lead = 0;
  const info = () => page.evaluate((s) => ({ st: globalThis.__game.state(), objs: globalThis.__game.objects(s), view: globalThis.__game.view() }), lead);
  const measureLead = async () => {
    const t0 = Date.now();
    for (let i = 0; i < 6; i++) await page.evaluate(() => 0);
    lead = (((Date.now() - t0) / 6) * 3.5) / 1000;
  };
  const setSpeed = (k) => page.evaluate((v) => globalThis.__game.setSpeed(v), k);
  const freeze = async (name) => {
    await setSpeed(0.02);
    await snap(name);
    await setSpeed(1);
  };
  const start = async () => {
    await page.waitForSelector('.howto .btn');
    await page.click('.howto .btn');
    await page.waitForFunction(() => globalThis.__game?.id === 'lacher');
  };
  const restart = async () => {
    await page.evaluate(() => window.__feli.go('game:5'));
    await start();
  };
  const swipe = async (ax, ay, bx, by, { steps = 2, hold = false } = {}) => {
    await page.mouse.move(ax, ay);
    await page.mouse.down();
    await page.mouse.move(bx, by, { steps });
    if (!hold) await page.mouse.up();
  };
  const toFrame = async (expectWon) => {
    await page.waitForFunction(() => window.__feli.step().startsWith('frame:'), null, { timeout: 8000 });
    const result = await page.evaluate(() => window.__feli.progress().results[5]);
    if (result !== expectWon) fail(`${tag}: Ergebnis ${result}, erwartet ${expectWon}`);
    if (await page.evaluate(() => 'undefined' !== typeof globalThis.__game)) fail(`${tag}: __game nach destroy() noch gesetzt`);
  };
  const bannerText = () => page.evaluate(() => document.querySelector('.g-lacher .game-banner')?.textContent ?? '');
  const inBand = (o, view) => o.y > view.top + o.r * 1.3 && o.y < view.h * 0.84;

  // Gerader Wisch quer durch ein Objekt (waagerecht, sonst senkrecht), der allen anderen "avoid" ausweicht.
  const lineThrough = (o, view, avoid, margin) => {
    const d = o.r * 1.5;
    const options = [
      [Math.max(4, o.x - d), o.y, Math.min(view.w - 4, o.x + d), o.y],
      [o.x, o.y - d, o.x, o.y + d],
      [o.x - d * 0.75, o.y - d * 0.75, o.x + d * 0.75, o.y + d * 0.75],
      [o.x - d * 0.75, o.y + d * 0.75, o.x + d * 0.75, o.y - d * 0.75],
    ];
    return options.find((s) => avoid.every((a) => distSeg(a.x, a.y, ...s) > a.r * margin)) ?? null;
  };

  try {
    // --- 1. Antippen zählt nicht, dann Niederlage durch drei Tomaten ---
    await start();
    await measureLead();
    await page.waitForTimeout(900);
    {
      const { objs } = await info();
      const o = objs[0];
      if (o) {
        await page.touchscreen.tap(o.x, o.y);
        await swipe(o.x, o.y, o.x + 2, o.y + 1, { steps: 1 });
      }
      const { st } = await info();
      if (st.points !== 0) fail(`${tag}: Antippen hat ${st.points} Punkte gebracht`);
      await snap('start');
    }
    let splats = 0;
    let approach = false;
    for (;;) {
      const { st, objs, view } = await info();
      if (st.phase !== 'play') break;
      if (st.timeLeft < 2) {
        fail(`${tag}: Tomaten-Lauf hat keine drei Tomaten erwischt`);
        break;
      }
      const tomato = objs.find((o) => o.type === 'tomato' && inBand(o, view));
      const line = tomato && lineThrough(tomato, view, objs.filter((o) => o.type !== 'tomato'), 1.35);
      if (!line) {
        await page.waitForTimeout(25);
        continue;
      }
      if (!approach) {
        approach = true;
        await freeze('tomate-im-anflug');
        continue; // danach neu zielen
      }
      await swipe(...line);
      splats++;
      const after = (await info()).st;
      if (after.tomatoes !== splats) fail(`${tag}: Tomatenzähler ${after.tomatoes} nach ${splats} Tomaten`);
      if (splats === 1) {
        await page.waitForTimeout(110);
        await freeze('splatsch');
        await page.waitForTimeout(480);
        await freeze('splatsch-laeuft');
      }
    }
    await page.waitForTimeout(450);
    await snap('tomaten-alarm');
    if (!/TOMATEN-ALARM/.test(await bannerText())) fail(`${tag}: Banner TOMATEN-ALARM fehlt („${await bannerText()}“)`);
    await toFrame(false);

    // --- 2. Niederlage durch Zeitablauf (Zeitraffer, niemand wischt) ---
    await restart();
    {
      // erst in Ruhe zuschauen und fliegende Objekte fotografieren, dann Zeitraffer
      const want = { flug: false, gold: false };
      for (;;) {
        const { st, objs, view } = await info();
        if (st.time > 18 || (want.flug && want.gold)) break;
        const seen = objs.filter((o) => inBand(o, view));
        if (!want.flug && seen.length >= 3 && seen.some((o) => o.type === 'tomato')) {
          want.flug = true;
          await freeze('flug');
        } else if (!want.gold && seen.some((o) => o.type === 'gold' && !o.rising)) {
          want.gold = true;
          await freeze('gold');
        } else {
          await page.waitForTimeout(25);
        }
      }
      for (const [name, ok] of Object.entries(want)) if (!ok) console.warn(`${tag}: kein Foto „${name}“ (Situation kam nicht vor)`);
    }
    await setSpeed(8);
    await page.waitForFunction(() => globalThis.__game?.state().phase === 'over', null, { timeout: 15000 });
    await page.waitForTimeout(450);
    await snap('zu-wenig-lacher');
    if (!/ZU WENIG LACHER/.test(await bannerText())) fail(`${tag}: Banner ZU WENIG LACHER fehlt`);
    await toFrame(false);

    // --- 3. Sieg: Lacher wischen, Tomaten ausweichen ---
    await restart();
    const done = { wisch: false, combo: false, ziel: false, bonus: false };
    let swipes = 0;
    for (;;) {
      const { st, objs, view } = await info();
      if (st.phase !== 'play') break;
      const tomatoes = objs.filter((o) => o.type === 'tomato');
      const laughs = objs.filter((o) => o.type !== 'tomato' && inBand(o, view));

      // Nach Erreichen des Ziels einmal absichtlich eine Tomate wischen: Sie klatscht, zählt aber nicht mehr.
      if (st.secured && !done.bonus) {
        const tomato = tomatoes.find((o) => inBand(o, view));
        if (tomato) {
          done.bonus = true;
          const before = st.tomatoes;
          await swipe(tomato.x - tomato.r * 1.4, tomato.y, tomato.x + tomato.r * 1.4, tomato.y);
          await page.waitForTimeout(140);
          await freeze('bonus-tomate');
          const after = (await info()).st;
          if (after.tomatoes !== before || after.phase !== 'play') fail(`${tag}: Tomate nach dem Ziel hat gezählt`);
          continue;
        }
      }

      // Combo: zwei nahe Lacher in einem Wisch
      let line = null;
      let combo = false;
      for (const a of laughs) {
        for (const b of laughs) {
          if (line || a === b) continue;
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          if (d < a.r * 0.6 || d > a.r * 5) continue;
          const ux = ((b.x - a.x) / d) * a.r * 1.4;
          const uy = ((b.y - a.y) / d) * a.r * 1.4;
          const s = [a.x - ux, a.y - uy, b.x + ux, b.y + uy];
          if (tomatoes.every((t) => distSeg(t.x, t.y, ...s) > t.r * 1.5)) {
            line = s;
            combo = true;
          }
        }
      }
      // einzelne Lacher erst nach dem Scheitelpunkt, damit vorher Zeit für eine Combo bleibt
      for (const o of laughs) if (!o.rising || st.time < 2.6) line ??= lineThrough(o, view, tomatoes, 1.5);
      if (!line) {
        await page.waitForTimeout(25);
        continue;
      }

      const wantShot = (combo && !done.combo) || (!combo && !done.wisch && st.time > 3);
      if (wantShot) {
        // in Zeitlupe wischen und mit liegendem Finger fotografieren: Spur, Hälften, Konfetti, Punkte
        await setSpeed(0.3);
        await swipe(...line, { steps: 5, hold: true });
        await page.waitForTimeout(150);
        await freeze(combo ? 'combo' : 'wisch');
        await page.mouse.up();
        if (combo) done.combo = true;
        else done.wisch = true;
      } else {
        await swipe(...line);
      }
      swipes++;
      if (!done.ziel && (await info()).st.secured) {
        done.ziel = true;
        await page.waitForTimeout(200);
        await snap('ziel-erreicht');
      }
    }
    const end = (await info()).st;
    await page.waitForTimeout(450);
    await snap('sieg');
    if (!/STANDING OVATIONS/.test(await bannerText())) fail(`${tag}: Banner STANDING OVATIONS fehlt`);
    if (end.points < 25) fail(`${tag}: nur ${end.points} Punkte im Sieg-Lauf`);
    if (end.tomatoes !== 0) fail(`${tag}: Sieg-Lauf hat ${end.tomatoes} Tomaten erwischt`);
    for (const [name, ok] of Object.entries(done)) if (!ok) console.warn(`${tag}: kein Foto „${name}“ (Situation kam nicht vor)`);
    await toFrame(true);
    await app.shot(`${tag}-rahmen`);
    console.log(`${tag}: Sieg mit ${end.points} Punkten in ${swipes} Wischern (beste Combo ×${end.bestCombo}), Tomaten-Niederlage und Zeitablauf geprüft`);

    if (app.errors.length) {
      console.error(app.errors);
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

for (const viewport of VIEWPORTS) await probe(viewport);
if (!process.exitCode) console.log('Lacher-Probe ok');
