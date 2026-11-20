// Browser-Probe für das Wimmelbild (Kapitel 3): verschieben, zoomen (echte Touch-Punkte per CDP), Fehltipp,
// Hinweis-Schimmer, alle drei finden (Sieg), Zeit im Zeitraffer ablaufen lassen (Niederlage), kleines Handy.
// Aufruf: npm run build && node scripts/games/wimmel.mjs      (Bilder landen in screenshots/)
/* global window */
import assert from 'node:assert/strict';
import { openApp } from '../lib.mjs';

const KEYS = ['feli', 'franks', 'findi'];

async function start(viewport, tag) {
  const app = await openApp({ query: '?debug=1&go=game:2', viewport });
  const { page } = app;
  await page.waitForSelector('.howto .btn');
  await page.click('.howto .btn');
  await page.waitForFunction(() => globalThis.__game?.dims().viewW > 10);
  await page.waitForFunction(() => window.document.querySelector('.g-wimmel-img')?.complete);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const game = (fn, arg) => page.evaluate(fn, arg);
  return {
    app,
    page,
    shot: (name) => app.shot(`wimmel-${tag}-${name}`),
    view: () => game(() => globalThis.__game.view()),
    round: () => game(() => ({ ...globalThis.__game.round, found: [...globalThis.__game.round.found] })),
    focus: (key, rel) => game(([k, r]) => globalThis.__game.focus(k, r), [key, rel]),
    skip: (s) => game((x) => globalThis.__game.skip(x), s),
    screenOf: (key) => game((k) => globalThis.__game.screenOf(k), key),
    // Wischer mit einem Finger
    async drag(x0, y0, x1, y1, steps = 8) {
      await touch('touchStart', [[x0, y0]]);
      for (let i = 1; i <= steps; i++) {
        await touch('touchMove', [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]);
        await page.waitForTimeout(16);
      }
      await touch('touchEnd', []);
    },
    // Zwei Finger um (cx, cy): Abstand von d0 auf d1
    async pinch(cx, cy, d0, d1, steps = 10) {
      await touch('touchStart', [[cx - d0 / 2, cy]]);
      await touch('touchStart', [[cx - d0 / 2, cy], [cx + d0 / 2, cy]]);
      for (let i = 1; i <= steps; i++) {
        const d = d0 + ((d1 - d0) * i) / steps;
        await touch('touchMove', [[cx - d / 2, cy], [cx + d / 2, cy]]);
        await page.waitForTimeout(16);
      }
      await touch('touchEnd', [[cx - d1 / 2, cy]]);
      await touch('touchEnd', []);
    },
    async tap(x, y) {
      await touch('touchStart', [[x, y]]);
      await page.waitForTimeout(40);
      await touch('touchEnd', []);
      await page.waitForTimeout(30);
    },
    async finish() {
      await page.waitForFunction(() => window.__feli.step().startsWith('frame:'), null, { timeout: 15000 });
      if (app.errors.length) {
        console.error(tag, app.errors);
        process.exitCode = 1;
      }
      await app.close();
    },
  };
}

// Misst im Browser, was von jeder Figur wirklich zu sehen ist: Figur (Körper + Kopf, gedreht, zugeschnitten)
// innerhalb des Beschnitt-Polygons auf ein Canvas zeichnen und den Umriss der deckenden Pixel nehmen.
// Ergebnis in Bildkoordinaten; muss zu `seen` in spots.js passen (dort für die Unit-Tests hinterlegt).
const measureSeen = (page) =>
  page.evaluate(async () => {
    const g = globalThis.__game;
    const load = (src) =>
      new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    const out = {};
    for (const spot of g.spots) {
      const svg = window.document.querySelector(`.g-wimmel-spot[data-key="${spot.key}"] svg`);
      const vb = svg.viewBox.baseVal;
      const k = spot.w / vb.width;
      const b = g.logic.clipBounds(spot);
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(b.w);
      canvas.height = Math.ceil(b.h);
      const c = canvas.getContext('2d');
      c.translate(-b.x, -b.y);
      c.beginPath();
      spot.clip.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.clip();
      c.translate(spot.x + spot.w / 2, spot.y + (vb.height * k) / 2);
      c.rotate((spot.rot * Math.PI) / 180);
      c.translate(-spot.w / 2, (-vb.height * k) / 2);
      c.scale(k, k);
      const cut = /^polygon\((.*)\)$/.exec(spot.cut ?? '');
      if (cut) {
        c.beginPath();
        cut[1].split(',').forEach((pt, i) => {
          const [px, py] = pt.trim().split(/\s+/).map(parseFloat);
          const x = (px / 100) * vb.width;
          const y = (py / 100) * vb.height;
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        });
        c.clip();
      }
      const body = svg.cloneNode(true);
      const head = body.querySelector('image');
      head.remove();
      body.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      body.setAttribute('width', vb.width);
      body.setAttribute('height', vb.height);
      c.drawImage(await load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new window.XMLSerializer().serializeToString(body))), 0, 0, vb.width, vb.height);
      c.drawImage(await load(head.getAttribute('href')), +head.getAttribute('x'), +head.getAttribute('y'), +head.getAttribute('width'), +head.getAttribute('height'));
      const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = 1e9;
      let y0 = 1e9;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] > 128) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
        }
      }
      out[spot.key] = { x: Math.round(b.x + x0), y: Math.round(b.y + y0), w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    return out;
  });

// Größe im kleinsten Zoom (in em): sichtbare Höhe und Treffer-Radius.
const sizes = (page, seen) =>
  page.evaluate((seenBoxes) => {
    const g = globalThis.__game;
    const zoom = g.logic.minZoom(g.dims());
    return Object.fromEntries(g.spots.map((s) => [s.key, { hoch: +((seenBoxes[s.key].h * zoom) / g.em()).toFixed(2), trefferRadius: +((g.logic.hitRadius(s, zoom, g.logic.MIN_HIT_EM * g.em()) * zoom) / g.em()).toFixed(2) }]));
  }, seen);

// --- Lauf 1: Referenzgröße, alles ausprobieren, Sieg ---
{
  const t = await start({ width: 390, height: 844 }, 'a');
  const { page } = t;
  await t.shot('start');
  const v0 = await t.view();
  const dims = await page.evaluate(() => globalThis.__game.dims());
  assert.ok(Math.abs(v0.zoom * 1929 - dims.viewH) < 0.5, 'Start: Bild füllt die Höhe');
  assert.ok(Math.abs(v0.x - (dims.viewW - 2496 * v0.zoom) / 2) < 0.5, 'Start: Bildmitte');
  const seen = await measureSeen(page);
  console.log('Sichtbarer Teil je Figur (Bildkoordinaten):', seen);
  console.log('Größen im kleinsten Zoom (em):', await sizes(page, seen));
  for (const spot of await page.evaluate(() => globalThis.__game.spots)) {
    for (const f of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(seen[spot.key][f] - spot.seen[f]) <= 6, `spots.js: seen.${f} von ${spot.key} ist ${spot.seen[f]}, gemessen ${seen[spot.key][f]}`);
  }

  // Verschieben mit einem Finger, Ränder klemmen
  await t.drag(300, 400, 120, 400);
  const v1 = await t.view();
  assert.ok(Math.abs(v1.x - (v0.x - 180)) < 8, `Wischer verschiebt um ca. 180 px (war ${v0.x - v1.x})`);
  for (let i = 0; i < 4; i++) await t.drag(40, 400, 380, 400);
  assert.equal((await t.view()).x, 0, 'linker Rand klemmt');
  for (let i = 0; i < 5; i++) await t.drag(380, 300, 20, 500);
  const v2 = await t.view();
  assert.ok(Math.abs(v2.x - (dims.viewW - 2496 * v2.zoom)) < 0.01, 'rechter Rand klemmt');
  assert.ok(Math.abs(v2.y) < 0.01, 'im kleinsten Zoom kein senkrechtes Verschieben');

  // Zoomen mit zwei Fingern
  await t.focus({ x: 1248, y: 1000 }, 1);
  const before = await page.evaluate(() => globalThis.__game.logic.screenToImage(globalThis.__game.view(), 195, 400));
  await t.pinch(195, 400, 90, 200);
  const v3 = await t.view();
  assert.ok(v3.zoom > v0.zoom * 1.9 && v3.zoom < v0.zoom * 2.5, `Pinch zoomt um ca. 2,2× (war ${v3.zoom / v0.zoom})`);
  const after = await page.evaluate(() => globalThis.__game.logic.screenToImage(globalThis.__game.view(), 195, 400));
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 6, 'Punkt unter den Fingern bleibt stehen');
  await t.shot('gezoomt');
  await t.pinch(195, 400, 80, 330);
  assert.ok(Math.abs((await t.view()).zoom - v0.zoom * 3) < 1e-6, 'größter Zoom = 3×');
  await t.shot('zoom-max');
  await t.drag(200, 500, 220, 200);
  assert.ok((await t.view()).y < v3.y, 'gezoomt lässt sich auch senkrecht verschieben');
  await t.pinch(195, 400, 330, 60);
  await t.pinch(195, 400, 330, 60);
  assert.ok(Math.abs((await t.view()).zoom - v0.zoom) < 1e-6, 'kleinster Zoom klemmt');
  assert.equal((await t.round()).misses, 0, 'Wischen und Zoomen sind keine Tipps');

  // Fehltipp: 3 s Abzug, danach kurze Abklingzeit
  await t.focus({ x: 1248, y: 1000 }, 1);
  const r0 = await t.round();
  await t.tap(100, 700);
  await t.tap(110, 690);
  const r1 = await t.round();
  assert.equal(r1.misses, 1, 'ein Fehltipp, der zweite fällt in die Abklingzeit');
  assert.ok(r0.timeLeft - r1.timeLeft > 2.9 && r0.timeLeft - r1.timeLeft < 3.6, 'Fehltipp kostet 3 s');
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${t.app.shots}/wimmel-a-fehltipp.png` });

  // Jede Fundstelle: kleinster Zoom und Nahaufnahme vor dem Fund
  for (const key of KEYS) {
    await t.focus(key, 1);
    await t.shot(`${key}-klein`);
    await t.focus(key, 2.4);
    await t.shot(`${key}-nah-vorher`);
  }

  // Hinweis-Schimmer nach 30 s ohne Fund, deutlicher nach 45 s, Pfeil am Rand
  await t.focus('feli', 1.6);
  await t.skip(27.5);
  assert.equal((await t.round()).hint, 1, 'Hinweis nach 30 s');
  await page.waitForTimeout(700);
  await t.shot('hinweis');
  await t.skip(15);
  assert.equal((await t.round()).hint, 2, 'deutlicher Hinweis nach 45 s');
  await page.waitForTimeout(250);
  await t.shot('hinweis-stark');
  await t.focus('findi', 1.3);
  await t.shot('hinweis-pfeil');
  assert.ok(await page.evaluate(() => !window.document.querySelector('.g-wimmel-arrow').hidden), 'Pfeil zeigt zur Figur außerhalb');

  // Alle drei finden
  for (const key of ['franks', 'feli', 'findi']) {
    await t.focus(key, key === 'feli' ? 1 : 2.4);
    const p = await t.screenOf(key);
    await t.tap(p.x, p.y);
    assert.ok((await t.round()).found.includes(key), `${key} gefunden`);
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${t.app.shots}/wimmel-a-${key}-fund.png` });
    if (key !== 'findi') {
      await page.waitForTimeout(900);
      await t.shot(`${key}-nah-nachher`);
      // Tipp auf die gefundene Figur: weder Fund noch Fehltipp
      await t.tap(p.x, p.y);
      assert.equal((await t.round()).misses, 1);
    }
  }
  assert.equal((await t.round()).state, 'won');
  await page.waitForTimeout(700);
  await t.shot('sieg');
  await t.finish();
}

// --- Lauf 2: Zeit läuft ab (Niederlage). Nichts gefunden: Kamera fährt nacheinander zu allen dreien. ---
{
  const t = await start({ width: 390, height: 844 }, 'b');
  const { page } = t;
  await t.focus({ x: 1248, y: 900 }, 2);
  await t.skip(76);
  await page.waitForTimeout(1300);
  await t.shot('letzte-sekunden');
  assert.ok(await page.evaluate(() => window.document.querySelector('.g-wimmel .hud').classList.contains('low')), 'letzte 15 s: Zeit ist rot');
  await t.skip(20);
  assert.equal((await t.round()).state, 'lost');
  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(i === 1 ? 250 : 500);
    await t.shot(`niederlage-kamera-${i}`);
  }
  await page.waitForSelector('.game-banner');
  await t.shot('niederlage');
  await t.finish();
}

// --- Lauf 2b: Niederlage mit einem Fund: Franks und Findi fehlen und passen in einen Ausschnitt. ---
{
  const t = await start({ width: 390, height: 844 }, 'b2');
  const { page } = t;
  await t.focus('feli', 1);
  const p = await t.screenOf('feli');
  await t.tap(p.x, p.y);
  await t.focus('feli', 2.5);
  await t.skip(95);
  assert.equal((await t.round()).state, 'lost');
  await page.waitForSelector('.game-banner');
  for (const key of ['franks', 'findi']) assert.ok((await t.screenOf(key)).inside, `${key} ist am Ende im Bild`);
  await t.shot('niederlage');
  await t.finish();
}

// --- Lauf 3: kleines Handy 360×640 ---
{
  const t = await start({ width: 360, height: 640 }, 'c');
  const { page } = t;
  await t.shot('start');
  console.log('Größen im kleinsten Zoom bei 360×640 (em):', await sizes(page, await measureSeen(page)));
  await t.tap(180, 330);
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${t.app.shots}/wimmel-c-fehltipp.png` });
  for (const key of KEYS) {
    await t.focus(key, 1);
    await t.shot(`${key}-klein`);
    const p = await t.screenOf(key);
    await t.tap(p.x, p.y);
    assert.ok((await t.round()).found.includes(key), `${key} gefunden (360×640)`);
  }
  await page.waitForTimeout(900);
  await t.shot('sieg');
  await t.finish();
}

console.log(process.exitCode ? 'Wimmel-Probe: FEHLER' : 'Wimmel-Probe: alles gut');
