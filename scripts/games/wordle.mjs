// Browser-Probe fürs Perlen-Rätsel (Kapitel 4): spielt mit echten Tipps auf die Perlen-Tastatur einmal bis zum
// Sieg und einmal bis zur Niederlage, auf 390×844 und auf der kleinsten Bühne 360×640, prüft das Layout
// (nichts überlappt, nichts abgeschnitten, Tasten groß genug) und macht Bildschirmfotos.
// Aufruf: npm run build && node scripts/games/wordle.mjs      (Bilder landen in screenshots/)
/* global document, getComputedStyle */
import { join } from 'node:path';
import { openApp } from '../lib.mjs';

const fail = (msg) => {
  console.error('FEHLER:', msg);
  process.exitCode = 1;
};
const check = (ok, msg) => ok || fail(msg);

async function play({ tag, viewport, words, expectWin }) {
  const app = await openApp({ query: '?debug=1&go=game:3', viewport });
  const { page } = app;
  const label = `${tag} (${viewport.width}×${viewport.height})`;
  const shot = (name) => app.shot(`wordle-${viewport.width}-${tag}-${name}`);
  // sofort, ohne die übliche Wartezeit von shot(): für Momente mitten in einer Animation
  const snap = (name) => page.screenshot({ path: join(app.shots, `wordle-${viewport.width}-${tag}-${name}.png`) });
  const game = (fn) => page.evaluate(fn);
  const info = () => game(() => ({ ...globalThis.__game.state(), busy: globalThis.__game.busy() }));
  const keyBox = (code) => page.locator(`.g-wordle-key[data-key="${code}"]`).boundingBox();
  const tapKey = async (code) => {
    const b = await keyBox(code);
    // Eingabe sitzt unten links, dort liegt im Debug-Modus der Käfer-Knopf der App darüber: weiter oben rechts tippen
    if (code === 'ENTER') await page.touchscreen.tap(b.x + b.width * 0.75, b.y + b.height * 0.3);
    else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  const typeWord = async (word) => {
    for (const ch of word) await tapKey(ch);
  };
  const idle = () => page.waitForFunction(() => !globalThis.__game || !globalThis.__game.busy() || globalThis.__game.state().status !== 'playing', null, { timeout: 8000 });

  try {
    await page.waitForSelector('.howto .btn');
    await page.click('.howto .btn');
    await page.waitForSelector('.g-wordle');
    await shot('start');
    await checkLayout(page, label, check);

    // Zu kurz: Zeile wackelt, kein Versuch verbraucht. Löschen und Tipp in die Lücke zwischen zwei Tasten.
    await typeWord('TOR');
    await tapKey('ENTER');
    await page.waitForTimeout(120);
    await shot('zu-kurz');
    let s = await info();
    check(s.rows.length === 0 && s.current === 'TOR', `${label}: zu kurzes Wort darf nichts verbrauchen (${JSON.stringify(s)})`);
    await tapKey('BACK');
    await tapKey('BACK');
    await tapKey('BACK');
    await tapKey('BACK');
    check((await info()).current === '', `${label}: Löschen leert die Zeile`);
    const [g, hKey] = [await keyBox('G'), await keyBox('H')];
    await page.touchscreen.tap((g.x + g.width + hKey.x) / 2 - 1, g.y + g.height / 2);
    s = await info();
    check(s.current === 'G' || s.current === 'H', `${label}: Tipp in die Lücke zwischen G und H trifft eine der beiden Tasten (${s.current})`);
    await tapKey('BACK');

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      await typeWord(word);
      if (i === 0) {
        await tapKey('X'); // sechster Buchstabe wird verschluckt
        check((await info()).current === word, `${label}: mehr als 5 Buchstaben gehen nicht`);
        await shot('getippt');
      }
      await tapKey('ENTER');
      await page.waitForTimeout(430);
      if (i === 0) {
        // während des Aufdeckens ist die Eingabe gesperrt
        await tapKey('A');
        s = await info();
        check(s.busy && s.current === '', `${label}: während des Aufdeckens keine Eingabe (${JSON.stringify(s)})`);
        await shot('aufdecken');
      }
      await idle();
      s = await info();
      check(s.rows.length === i + 1 && s.rows[i].word === word, `${label}: Versuch ${i + 1} (${word}) wurde nicht gewertet`);
      if (s.status !== 'playing') break;
      await page.waitForTimeout(450);
      await shot(`nach-${i + 1}-${word}`);
      await checkLayout(page, label + ` nach ${word}`, check);
    }

    s = await info();
    check(s.status === (expectWin ? 'won' : 'lost'), `${label}: Status ${s.status}`);
    if (expectWin) {
      await page.waitForSelector('.g-wordle-finale');
      await page.waitForTimeout(230);
      await snap('x1-armband-schliesst-sich');
      await page.waitForSelector('.g-wordle-finale.closed');
      await page.waitForTimeout(120);
      await snap('x2-armband-kreis');
    } else {
      await page.waitForSelector('.g-wordle-solution');
      await page.waitForTimeout(500);
      await shot('loesung');
      const box = await page.locator('.g-wordle-solution').boundingBox();
      check(box.x >= 0 && box.x + box.width <= viewport.width, `${label}: Lösungskarte ragt aus dem Bild`);
    }
    await page.waitForSelector('.game-banner span');
    await page.waitForTimeout(500); // Banner ist eingeflogen
    if (expectWin) {
      // Kreis und Banner dürfen sich nicht überdecken
      const overlap = await game(() => {
        const text = document.querySelector('.game-banner span').getBoundingClientRect();
        return [...document.querySelectorAll('.g-wordle-loose')].some((el) => el.getBoundingClientRect().bottom > text.top);
      });
      check(!overlap, `${label}: Armband-Kreis und Banner überdecken sich`);
    } else {
      const overlap = await game(() => document.querySelector('.g-wordle-solution').getBoundingClientRect().bottom > document.querySelector('.game-banner span').getBoundingClientRect().top);
      check(!overlap, `${label}: Lösungskarte und Banner überdecken sich`);
    }
    await snap('x3-banner');
    await page.waitForFunction(() => globalThis.__feli.step().startsWith('frame:'), null, { timeout: 8000 });
    await page.waitForTimeout(600);
    check(await game(() => !document.querySelector('.g-wordle') && !globalThis.__game), `${label}: Spiel wurde nach dem Ende nicht aufgeräumt`);
    console.log(`ok  ${label}: ${words.join(', ')} → ${expectWin ? 'gewonnen' : 'verloren'}`);
  } catch (err) {
    fail(`${label}: ${err.stack || err}`);
    await shot('fehler').catch(() => {});
  }
  if (app.errors.length) fail(`${label}: Fehler in der Konsole: ${app.errors.join(' | ')}`);
  await app.close();
}

// Geometrie prüfen: alles im Bild, Raster / Tipp / Tastatur überlappen nicht, nichts unter dem Stumm-Schalter,
// Tasten mindestens 2.9em hoch und 11 pro Reihe über die volle Breite.
async function checkLayout(page, label, check) {
  const r = await page.evaluate(() => {
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
    };
    const q = (sel) => [...document.querySelectorAll(sel)].map(box);
    const stage = box(document.querySelector('.game-root'));
    const em = parseFloat(getComputedStyle(document.querySelector('.g-wordle')).fontSize);
    const bubble = document.querySelector('.g-wordle-bubble');
    return {
      stage,
      em,
      mute: q('.mute')[0],
      board: q('.g-wordle-board')[0],
      rows: q('.g-wordle-row'),
      beads: q('.g-wordle-board .g-wordle-bead'),
      hint: q('.g-wordle-hint')[0],
      hintOn: document.querySelector('.g-wordle-hint').classList.contains('on'),
      bubble: box(bubble),
      bubbleText: box(bubble.firstElementChild),
      janni: q('.g-wordle-janni')[0],
      keys: q('.g-wordle-key'),
      keyRows: [...document.querySelectorAll('.g-wordle-keyrow')].map((row) => [...row.children].map(box)),
      keyboard: q('.g-wordle-keys')[0],
    };
  });
  const inside = (a, b, tol = 0.5) => a.l >= b.l - tol && a.t >= b.t - tol && a.r <= b.r + tol && a.b <= b.b + tol;
  const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const { stage, em } = r;
  check(r.rows.length === 6 && r.beads.length === 30, `${label}: 6 Zeilen mit 5 Perlen erwartet`);
  check(inside(r.board, stage), `${label}: Raster ragt aus der Bühne`);
  check(inside(r.keyboard, stage), `${label}: Tastatur ragt aus der Bühne`);
  check(r.board.b <= r.hint.t + 0.5, `${label}: Raster überlappt die Tipp-Zeile (${r.board.b} > ${r.hint.t})`);
  check(r.hint.b <= r.keyboard.t + 0.5, `${label}: Tipp-Zeile überlappt die Tastatur`);
  for (const row of r.rows) check(inside(row, r.board), `${label}: Armband ragt aus dem Raster`);
  if (r.mute) {
    const zone = { l: stage.r - 3 * em, t: stage.t, r: stage.r, b: stage.t + 3 * em };
    check(!r.rows.some((row) => hits(row, zone)) && !hits(r.janni, zone), `${label}: Armband unter dem Stumm-Schalter (oben rechts 3em frei lassen)`);
  }
  if (r.hintOn) {
    check(inside(r.bubble, r.hint, 1) && inside(r.janni, r.hint, 1), `${label}: Tipp ragt aus seiner Zeile (${JSON.stringify(r.bubble)} in ${JSON.stringify(r.hint)})`);
    check(inside(r.bubbleText, r.bubble), `${label}: Tipp-Text ist abgeschnitten`);
  }
  check(r.keys.length === 31, `${label}: 29 Buchstaben + Eingabe + Löschen erwartet, gefunden ${r.keys.length}`);
  for (const key of r.keys) {
    check(inside(key, r.keyboard), `${label}: Taste ragt aus der Tastatur`);
    check(key.h >= 2.9 * em - 0.5, `${label}: Taste zu niedrig (${key.h}px < ${2.9 * em}px)`);
    check(key.w >= 26, `${label}: Taste zu schmal (${key.w}px)`);
  }
  for (const row of r.keyRows) {
    check(row[0].l - stage.l < 0.5 * em && stage.r - row[row.length - 1].r < 0.5 * em, `${label}: Tastenreihe nutzt nicht die volle Breite`);
    for (let i = 1; i < row.length; i++) check(row[i].l >= row[i - 1].r, `${label}: Tasten überlappen`);
  }
  return r;
}

const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 430, height: 932 },
];
for (const viewport of SIZES) {
  // Sieg im dritten Versuch
  await play({ tag: 'sieg', viewport, words: ['TORTE', 'REGAL', 'ARENA'], expectWin: true });
  // Niederlage: alle drei Tipps von Janni erscheinen, Umlaute sind dabei
  await play({ tag: 'niederlage', viewport, words: ['KATZE', 'BLUME', 'TÖRÖÖ', 'HALLE', 'ALARM', 'NASEN'], expectWin: false });
}
// Sieg im letzten Versuch auf der kleinsten Bühne: volles Raster, letzter Tipp, Armband löst sich aus der untersten Zeile
await play({ tag: 'sieg6', viewport: SIZES[1], words: ['MÜTZE', 'KÖNIG', 'ÄPFEL', 'NASEN', 'AROMA', 'ARENA'], expectWin: true });
