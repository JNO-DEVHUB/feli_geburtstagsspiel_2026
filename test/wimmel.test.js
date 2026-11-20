import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import * as L from '../src/games/wimmel/logic.js';
import { IMG, SPOTS, spotByKey } from '../src/games/wimmel/spots.js';

// Spielfläche = Bühne ohne die Suchkarten-Leiste (4,5em hoch, siehe style.css).
const BAR_EM = 4.5;
const phone = (w, h) => {
  const em = 16 * Math.min(w / 390, h / 760); // wie die Bühne in main.js
  return { em, dims: { imgW: IMG.w, imgH: IMG.h, viewW: w, viewH: h - BAR_EM * em } };
};
const REF = phone(390, 844);
const SMALL = phone(360, 640);
const BIG = phone(430, 932);
const KEYS = SPOTS.map((s) => s.key);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const fit = (d) => L.fitView(d.imgW, d.imgH, d.viewW, d.viewH);

test('Stellschrauben wie bestellt', () => {
  assert.equal(L.TIME_LIMIT, 90);
  assert.equal(L.MISS_PENALTY, 3);
  assert.equal(L.HINT_AFTER, 30);
  assert.equal(L.HINT_STRONG_AFTER, 45);
  assert.equal(L.MISS_COOLDOWN, 0.5);
  assert.equal(L.MAX_ZOOM, 3);
});

test('fitView füllt die Höhe und zentriert', () => {
  for (const { dims } of [REF, SMALL, BIG]) {
    const v = fit(dims);
    near(v.zoom * IMG.h, dims.viewH);
    near(v.y, 0);
    near(v.x + (IMG.w * v.zoom) / 2, dims.viewW / 2);
    assert.ok(IMG.w * v.zoom > dims.viewW, 'Querformat-Bild ist breiter als die Fläche: seitlich verschieben');
    assert.deepEqual(L.clampView(v, dims), v);
    near(L.minZoom(dims), v.zoom);
    near(L.maxZoom(dims), v.zoom * 3);
  }
});

test('clampView hält das Bild an allen vier Rändern in der Fläche, auch im größten Zoom', () => {
  const { dims } = REF;
  for (const zoom of [L.minZoom(dims), L.minZoom(dims) * 1.7, L.maxZoom(dims)]) {
    for (const [x, y] of [[9999, 0], [-99999, 0], [0, 9999], [0, -99999], [9999, 9999], [-99999, -99999], [-300, -200]]) {
      const v = L.clampView({ zoom, x, y }, dims);
      near(v.zoom, zoom);
      assert.ok(v.x <= 1e-9, 'linker Bildrand nicht in der Fläche');
      assert.ok(v.y <= 1e-9, 'oberer Bildrand nicht in der Fläche');
      assert.ok(v.x + IMG.w * zoom >= dims.viewW - 1e-9, 'rechter Bildrand nicht in der Fläche');
      assert.ok(v.y + IMG.h * zoom >= dims.viewH - 1e-9, 'unterer Bildrand nicht in der Fläche');
    }
  }
  // Zoom außerhalb der Grenzen wird mit begrenzt.
  near(L.clampView({ zoom: 0.01, x: 0, y: 0 }, dims).zoom, L.minZoom(dims));
  near(L.clampView({ zoom: 99, x: 0, y: 0 }, dims).zoom, L.maxZoom(dims));
});

test('panBy verschiebt direkt und klemmt am Rand', () => {
  const { dims } = REF;
  const v0 = fit(dims);
  const v1 = L.panBy(v0, -50, 30, dims);
  near(v1.x, v0.x - 50);
  near(v1.y, 0); // im kleinsten Zoom kein senkrechtes Verschieben
  near(L.panBy(v0, 5000, 0, dims).x, 0);
  near(L.panBy(v0, -5000, 0, dims).x, dims.viewW - IMG.w * v0.zoom);
  const zoomed = L.zoomAt(v0, 2, 195, 300, dims);
  near(L.panBy(zoomed, 0, -40, dims).y, zoomed.y - 40);
});

test('zoomAt hält den Punkt unter den Fingern fest und begrenzt den Zoom', () => {
  const { dims } = REF;
  const v0 = fit(dims);
  const [cx, cy] = [140, 420];
  const before = L.screenToImage(v0, cx, cy);
  let v = L.zoomAt(v0, 1.8, cx, cy, dims);
  near(v.zoom, v0.zoom * 1.8);
  let after = L.screenToImage(v, cx, cy);
  near(after.x, before.x, 1e-6);
  near(after.y, before.y, 1e-6);
  // weiter hinein: bleibt fest, Zoom endet bei 3×
  v = L.zoomAt(v, 5, cx, cy, dims);
  near(v.zoom, v0.zoom * L.MAX_ZOOM);
  after = L.screenToImage(v, cx, cy);
  near(after.x, before.x, 1e-6);
  near(after.y, before.y, 1e-6);
  // wieder hinaus: endet beim kleinsten Zoom, Bild bleibt in der Fläche
  v = L.zoomAt(v, 0.01, cx, cy, dims);
  near(v.zoom, v0.zoom);
  assert.deepEqual(L.clampView(v, dims), v);
  // Faktor 1 ändert nichts
  assert.deepEqual(L.zoomAt(v0, 1, cx, cy, dims), v0);
});

test('Bildschirm ↔ Bild rechnet verlustfrei hin und zurück', () => {
  const { dims } = REF;
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const v = L.clampView({ zoom: rng.range(0.2, 1.4), x: rng.range(-2500, 100), y: rng.range(-1800, 100) }, dims);
    const [sx, sy] = [rng.range(0, dims.viewW), rng.range(0, dims.viewH)];
    const p = L.screenToImage(v, sx, sy);
    const s = L.imageToScreen(v, p.x, p.y);
    near(s.x, sx, 1e-9);
    near(s.y, sy, 1e-9);
    const q = L.screenToImage(v, s.x, s.y);
    near(q.x, p.x, 1e-9);
    near(q.y, p.y, 1e-9);
  }
  const c = L.centerOn(1200, 900, L.minZoom(dims) * 2, dims);
  const mid = L.imageToScreen(c, 1200, 900);
  near(mid.x, dims.viewW / 2);
  near(mid.y, dims.viewH / 2);
});

test('drei Figuren: vollständig im Bild, in verschiedenen Bildbereichen, verschieden hoch, ohne Überlappung', () => {
  assert.deepEqual([...KEYS].sort(), ['feli', 'findi', 'franks']);
  for (const s of SPOTS) {
    const b = L.clipBounds(s);
    for (const box of [b, s.seen, { x: s.hit.x - s.hit.r, y: s.hit.y - s.hit.r, w: 2 * s.hit.r, h: 2 * s.hit.r }]) {
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= IMG.w && box.y + box.h <= IMG.h, `${s.key} liegt im Bild`);
    }
    // sichtbarer Teil liegt im Beschnitt, der Treffer-Mittelpunkt im sichtbaren Teil
    assert.ok(s.seen.x >= b.x - 1 && s.seen.y >= b.y - 1 && s.seen.x + s.seen.w <= b.x + b.w + 1 && s.seen.y + s.seen.h <= b.y + b.h + 1, `${s.key}: seen im Beschnitt`);
    assert.ok(s.hit.x > s.seen.x && s.hit.x < s.seen.x + s.seen.w && s.hit.y > s.seen.y && s.hit.y < s.seen.y + s.seen.h, `${s.key}: Treffer-Mitte auf der Figur`);
    assert.ok(Math.abs(s.rot) <= 8, 'nur leichte Drehung');
    assert.ok(s.clip.length >= 4);
    // oben bleibt Platz für Zeitleiste und Stumm-Schalter (3em im kleinsten Zoom des kleinen Handys)
    assert.ok(s.seen.y * L.minZoom(SMALL.dims) >= 3 * SMALL.em, `${s.key} steckt nicht unter der Kopfzeile`);
  }
  assert.deepEqual(SPOTS.map((s) => L.regionOf(s, IMG.w)).sort(), [0, 1, 2], 'links, Mitte, rechts');
  for (let i = 0; i < SPOTS.length; i++) {
    for (let j = i + 1; j < SPOTS.length; j++) {
      const [a, b] = [SPOTS[i], SPOTS[j]];
      const apart = a.seen.x + a.seen.w < b.seen.x || b.seen.x + b.seen.w < a.seen.x || a.seen.y + a.seen.h < b.seen.y || b.seen.y + b.seen.h < a.seen.y;
      assert.ok(apart, `${a.key} und ${b.key} überlappen sich nicht`);
      // auch die großzügigen Treffer-Kreise des kleinsten Handys berühren sich nicht
      const d = Math.hypot(a.hit.x - b.hit.x, a.hit.y - b.hit.y);
      const zoom = L.minZoom(SMALL.dims);
      assert.ok(d > L.hitRadius(a, zoom, L.MIN_HIT_EM * SMALL.em) + L.hitRadius(b, zoom, L.MIN_HIT_EM * SMALL.em));
      assert.ok(Math.abs(a.hit.y - b.hit.y) >= 100, `${a.key} und ${b.key} liegen nicht auf derselben Höhe`);
    }
  }
});

test('jede Figur ist im kleinsten Zoom groß genug zu sehen', () => {
  const zoom = L.minZoom(REF.dims);
  for (const s of SPOTS) {
    assert.ok((s.seen.h * zoom) / REF.em >= L.MIN_SHOW_EM, `${s.key}: ${((s.seen.h * zoom) / REF.em).toFixed(2)}em sichtbar`);
    // auf dem kleinsten Handy (360×640) immer noch gut 2,8em
    assert.ok((s.seen.h * L.minZoom(SMALL.dims)) / SMALL.em >= 2.8);
  }
});

test('Treffer: Mitte zählt, 1 px außerhalb des Radius nicht', () => {
  for (const s of SPOTS) {
    assert.equal(L.hitTest(SPOTS, [], s.hit.x, s.hit.y, 1), s.key);
    assert.equal(L.hitTest(SPOTS, [], s.hit.x + s.hit.r, s.hit.y, 1), s.key);
    assert.equal(L.hitTest(SPOTS, [], s.hit.x + s.hit.r + 1, s.hit.y, 1), null);
    assert.equal(L.hitTest(SPOTS, [], s.hit.x, s.hit.y - s.hit.r - 1, 1), null);
    // mit Mindest-Radius auf dem Bildschirm: Grenze wandert mit dem Zoom
    const zoom = 0.3;
    const r = L.hitRadius(s, zoom, 36);
    near(r, 120);
    assert.equal(L.hitTest(SPOTS, [], s.hit.x - r, s.hit.y, zoom, 36), s.key);
    assert.equal(L.hitTest(SPOTS, [], s.hit.x - r - 1, s.hit.y, zoom, 36), null);
    // schon gefunden: kein Treffer mehr
    assert.equal(L.hitTest(SPOTS, [s.key], s.hit.x, s.hit.y, 1), null);
  }
  assert.equal(L.hitTest(SPOTS, [], 1200, 1700, 1), null);
});

test('im kleinsten Zoom ist der Treffer-Radius auf dem Bildschirm mindestens 2,4em', () => {
  assert.ok(L.MIN_HIT_EM >= 2.4);
  for (const { em, dims } of [REF, SMALL, BIG]) {
    for (const zoom of [L.minZoom(dims), L.minZoom(dims) * 1.5, L.maxZoom(dims)]) {
      for (const s of SPOTS) assert.ok(L.hitRadius(s, zoom, L.MIN_HIT_EM * em) * zoom >= L.MIN_HIT_EM * em - 1e-9);
    }
  }
});

const tapSpot = (round, key) => {
  const s = spotByKey(key);
  return L.tapAt(round, SPOTS, s.hit.x, s.hit.y, 0.4, 38);
};
const tapNowhere = (round) => L.tapAt(round, SPOTS, 1200, 1700, 0.4, 38);
const types = (events) => events.map((e) => e.type);
// Zeit in kleinen Schritten vorspulen, Ereignisse einsammeln.
const run = (round, seconds, step = 0.05) => {
  const events = [];
  for (let i = 0; i < Math.round(seconds / step); i++) events.push(...L.tick(round, step));
  return events;
};

test('Fehltipp kostet 3 s und hat 500 ms Abklingzeit', () => {
  const round = L.createRound(KEYS);
  assert.deepEqual(tapNowhere(round), [{ type: 'miss', penalty: 3 }]);
  near(round.timeLeft, 87);
  assert.deepEqual(tapNowhere(round), [], 'sofort danach zählt kein weiterer Fehltipp');
  run(round, 0.4);
  assert.deepEqual(tapNowhere(round), [], 'nach 400 ms auch noch nicht');
  near(round.timeLeft, 86.6, 1e-6);
  run(round, 0.15);
  assert.deepEqual(types(tapNowhere(round)), ['miss'], 'nach 550 ms wieder');
  near(round.timeLeft, 83.45, 1e-6);
  assert.equal(round.misses, 2);
  // Ein richtiger Tipp zählt auch während der Abklingzeit.
  assert.deepEqual(types(tapSpot(round, 'feli')), ['found']);
});

test('Fehltipp in den letzten Sekunden beendet das Spiel', () => {
  const round = L.createRound(KEYS);
  run(round, 88);
  assert.deepEqual(types(tapNowhere(round)), ['miss', 'lost']);
  assert.equal(round.state, 'lost');
  assert.equal(round.timeLeft, 0);
  assert.deepEqual(tapSpot(round, 'feli'), [], 'nach dem Ende zählt nichts mehr');
  assert.deepEqual(L.tick(round, 1), []);
});

test('Hinweis nach 30 s ohne Fund, stärker nach 45 s, Frist beginnt nach einem Fund neu', () => {
  const round = L.createRound(KEYS);
  assert.deepEqual(types(run(round, 29.9)), []);
  assert.equal(round.hint, 0);
  const first = run(round, 0.2);
  assert.deepEqual(first, [{ type: 'hint', key: 'feli' }]);
  assert.equal(round.hint, 1);
  assert.deepEqual(types(run(round, 14.8)), []);
  assert.deepEqual(run(round, 0.2), [{ type: 'hint-strong', key: 'feli' }]);
  assert.equal(round.hint, 2);
  assert.deepEqual(types(run(round, 5)), [], 'kein dritter Hinweis');
  // Fund (egal welche Figur): Hinweis weg, Frist neu
  assert.deepEqual(types(tapSpot(round, 'franks')), ['found']);
  assert.equal(round.hint, 0);
  assert.equal(round.hintKey, null);
  assert.equal(round.sinceFound, 0);
  assert.deepEqual(types(run(round, 29.9)).filter((t) => t !== 'tick'), []);
  const again = run(round, 0.2).filter((e) => e.type !== 'tick');
  assert.deepEqual(again, [{ type: 'hint', key: 'feli' }], 'Hinweis zeigt auf eine noch fehlende Figur');
  // Fehltipps setzen die Frist nicht zurück
  const r2 = L.createRound(KEYS);
  run(r2, 20);
  tapNowhere(r2);
  assert.deepEqual(types(run(r2, 10.1)), ['hint']);
});

test('letzte 15 Sekunden: ein Tick pro Sekunde', () => {
  const round = L.createRound(KEYS);
  const early = run(round, 74.5).filter((e) => e.type === 'tick');
  assert.deepEqual(early, []);
  const ticks = run(round, 15.4).filter((e) => e.type === 'tick');
  assert.deepEqual(ticks.map((e) => e.left), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test('Zeit abgelaufen = verloren, die fehlenden Figuren werden genannt', () => {
  const round = L.createRound(KEYS);
  tapSpot(round, 'franks');
  const events = run(round, 90.1);
  const lost = events.filter((e) => e.type === 'lost');
  assert.equal(lost.length, 1, 'genau ein Ende');
  assert.deepEqual(lost[0].missing, ['feli', 'findi']);
  assert.equal(round.state, 'lost');
  assert.equal(round.timeLeft, 0);
  assert.deepEqual(L.missing(round), ['feli', 'findi']);
});

test('drei Funde = gewonnen', () => {
  const round = L.createRound(KEYS);
  assert.deepEqual(tapSpot(round, 'findi'), [{ type: 'found', key: 'findi' }]);
  run(round, 5);
  assert.deepEqual(tapSpot(round, 'feli'), [{ type: 'found', key: 'feli' }]);
  assert.deepEqual(tapSpot(round, 'franks'), [{ type: 'found', key: 'franks' }, { type: 'won' }]);
  assert.equal(round.state, 'won');
  assert.deepEqual([...round.found].sort(), ['feli', 'findi', 'franks']);
  const left = round.timeLeft;
  assert.deepEqual(L.tick(round, 10), [], 'Uhr steht');
  assert.equal(round.timeLeft, left);
  assert.deepEqual(tapNowhere(round), []);
});

test('gefundene Figur zählt nicht doppelt und ist kein Fehltipp', () => {
  const round = L.createRound(KEYS);
  assert.deepEqual(types(tapSpot(round, 'feli')), ['found']);
  const left = round.timeLeft;
  assert.deepEqual(tapSpot(round, 'feli'), []);
  assert.deepEqual(tapSpot(round, 'feli'), []);
  assert.deepEqual(round.found, ['feli']);
  assert.equal(round.misses, 0);
  assert.equal(round.timeLeft, left);
  assert.equal(round.state, 'play');
});

// Abstimmung: simulierte Spielerin. Sie sucht alle fehlenden Figuren gleichzeitig; jede hat eine mittlere
// Suchdauer für sich allein (Feli hinter der Scheibe fällt schneller auf als Findi hinter der Tafel). Der
// Schimmer verkürzt die Suche deutlich, hin und wieder tippt sie daneben (z. B. auf die gemalte Katze auf dem
// Koffer). „Aufmerksam“ entspricht 15–25 s je Figur nacheinander, „gemütlich“ ist deutlich langsamer.
const PLAYERS = {
  aufmerksam: { mean: { feli: 28, franks: 33, findi: 45 }, missEvery: 25, hint: [8, 4] },
  mittel: { mean: { feli: 32, franks: 38, findi: 55 }, missEvery: 22, hint: [8, 4] },
  gemuetlich: { mean: { feli: 36, franks: 42, findi: 60 }, missEvery: 20, hint: [9, 4] },
};

function simulate(seed, player) {
  const rng = createRng(seed);
  const round = L.createRound(KEYS);
  const step = 0.25;
  while (round.state === 'play') {
    L.tick(round, step);
    if (round.state !== 'play') break;
    if (rng.chance(step / player.missEvery)) tapNowhere(round);
    for (const key of L.missing(round)) {
      const m = round.hintKey === key ? player.hint[round.hint - 1] : player.mean[key];
      if (rng.chance(step / m)) {
        tapSpot(round, key);
        break;
      }
    }
  }
  return round;
}

function winRate(player, n = 2000) {
  let wins = 0;
  let time = 0;
  for (let seed = 1; seed <= n; seed++) {
    const round = simulate(seed, player);
    if (round.state === 'won') {
      wins += 1;
      time += L.TIME_LIMIT - round.timeLeft;
    }
  }
  return { rate: wins / n, avg: time / wins };
}

test('Abstimmung: etwa 80 % schaffen es beim ersten Versuch (lieber etwas zu leicht)', () => {
  const a = winRate(PLAYERS.aufmerksam);
  const m = winRate(PLAYERS.mittel);
  const g = winRate(PLAYERS.gemuetlich);
  const show = (r) => `${(r.rate * 100).toFixed(1)} % in ${r.avg.toFixed(0)} s`;
  assert.ok(a.rate >= 0.85 && a.rate <= 0.96, `aufmerksam: ${show(a)}`);
  assert.ok(m.rate >= 0.78 && m.rate <= 0.9, `mittel: ${show(m)}`);
  assert.ok(g.rate >= 0.7 && g.rate <= 0.85, `gemütlich: ${show(g)}`);
  assert.ok(m.avg > 40 && m.avg < 70, `Siege dauern im Schnitt ${m.avg.toFixed(1)} s`);
});
