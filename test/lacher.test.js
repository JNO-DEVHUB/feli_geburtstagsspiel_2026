import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import * as L from '../src/games/lacher/logic.js';

const VIEWS = [
  { w: 390, h: 844 },
  { w: 360, h: 640 },
  { w: 430, h: 932 },
];
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

test('Wurfplan: deterministisch aus dem Seed, nach Zeit sortiert', () => {
  const a = L.buildPlan(createRng(42));
  const b = L.buildPlan(createRng(42));
  const c = L.buildPlan(createRng(43));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  for (let i = 1; i < a.length; i++) assert.ok(a[i].t >= a[i - 1].t);
  for (const w of a) {
    assert.ok(w.type in L.POINTS, `unbekannter Typ ${w.type}`);
    for (const k of ['t', 'x0', 'vx', 'vy', 'spin']) assert.ok(Number.isFinite(w[k]), `${k} fehlt`);
  }
});

test('Wurfplan: 40–55 Punkte erreichbar, 10–18 % Tomaten (200 Seeds)', () => {
  let pointsSum = 0;
  for (const seed of SEEDS) {
    const plan = L.buildPlan(createRng(seed));
    const points = L.reachablePoints(plan);
    const tomatoes = plan.filter((w) => w.type === 'tomato').length;
    const share = tomatoes / plan.length;
    assert.ok(points >= 40 && points <= 55, `Seed ${seed}: ${points} Punkte`);
    assert.ok(share >= 0.1 && share <= 0.18, `Seed ${seed}: Tomatenanteil ${share.toFixed(3)}`);
    assert.ok(tomatoes > L.MAX_TOMATOES, 'genug Tomaten, um überhaupt verlieren zu können');
    assert.ok(plan.some((w) => w.type === 'gold') && plan.some((w) => w.type === 'mic'));
    pointsSum += points;
  }
  const mean = pointsSum / SEEDS.length;
  assert.ok(mean >= 43 && mean <= 49, `Mittel ${mean}`);
});

test('Wurfplan: Einstieg mit einzelnen normalen Lachern, danach Wellen von 2–4', () => {
  let earlySum = 0;
  let lateSum = 0;
  for (const seed of SEEDS) {
    const plan = L.buildPlan(createRng(seed));
    const intro = plan.filter((w) => w.t < 2);
    assert.equal(intro.length, L.INTRO_TIMES.length);
    for (const w of intro) assert.equal(L.POINTS[w.type], 1, `Seed ${seed}: ${w.type} im Einstieg`);
    for (let i = 1; i < intro.length; i++) assert.ok(intro[i].t - intro[i - 1].t >= 0.6);
    const waves = new Map();
    for (const w of plan) if (w.wave >= 0) waves.set(w.wave, [...(waves.get(w.wave) ?? []), w]);
    for (const [index, list] of waves) {
      assert.ok(list.length >= L.WAVE_MIN && list.length <= L.WAVE_MAX, `Seed ${seed}: Welle mit ${list.length}`);
      assert.ok(list.filter((w) => w.type === 'tomato').length <= 1, 'höchstens eine Tomate je Welle');
      if (index < L.FIRST_TOMATO_WAVE) assert.ok(list.every((w) => w.type !== 'tomato'));
    }
    // gegen Ende dichter: in den letzten 10 Sekunden starten mehr Würfe als in den ersten 10
    const early = plan.filter((w) => w.t < 10).length;
    const late = plan.filter((w) => w.t >= 20).length;
    assert.ok(late >= early - 2, `Seed ${seed}: ${early} früh, ${late} spät`);
    earlySum += early;
    lateSum += late;
  }
  assert.ok(lateSum / SEEDS.length >= earlySum / SEEDS.length + 2, `im Mittel ${earlySum / SEEDS.length} früh, ${lateSum / SEEDS.length} spät`);
});

test('Wurfplan: alle Würfe in der Zeit, Scheitelpunkte und Flugbahnen im sichtbaren Bereich', () => {
  const p = {};
  for (const seed of SEEDS) {
    const plan = L.buildPlan(createRng(seed));
    for (const wurf of plan) {
      assert.ok(wurf.t >= 0 && wurf.t <= L.LAST_THROW_AT, `Seed ${seed}: Wurf bei ${wurf.t}`);
      assert.ok(wurf.t + L.apexTime(wurf) < L.DURATION, `Seed ${seed}: Scheitelpunkt erst nach Schluss`);
      assert.ok(Math.abs(wurf.spin * L.apexTime(wurf)) < 1.8, 'dreht sich nicht über Kopf');
      for (const view of VIEWS) {
        const r = L.RADIUS * view.w;
        const top = L.TOP_CLEAR * view.w;
        L.apexOf(wurf, view, p);
        assert.ok(p.y - r >= top, `Seed ${seed} ${view.w}×${view.h}: Scheitelpunkt ${p.y} unter der Kopfzeile`);
        assert.ok(p.y >= 0.2 * view.h && p.y <= 0.55 * view.h, `Seed ${seed}: Scheitelpunkt ${p.y / view.h} nicht mittig`);
        assert.ok(Math.abs(p.rot) < 1e-9, 'am Scheitelpunkt aufrecht');
        // waagerecht bleibt das ganze Objekt über den gesamten Flug im Bild
        const T = L.flightTime(wurf);
        for (let k = 0; k <= 10; k++) {
          L.positionAt(wurf, wurf.t + (T * k) / 10, view, p);
          assert.ok(p.x - r >= 0 && p.x + r <= view.w, `Seed ${seed}: x=${p.x} außerhalb`);
          assert.ok(p.y - r >= top - 1e-6, 'nie höher als der Scheitelpunkt');
        }
        // Start und Landung unter dem unteren Rand (nichts taucht mitten im Bild auf)
        L.positionAt(wurf, wurf.t, view, p);
        assert.ok(p.y - r > view.h);
      }
    }
  }
});

test('Wurfplan: Tomaten verdecken keinen Lacher', () => {
  // Erlaubt ist nur kurzes Kreuzen im Vorbeiflug (< 0,1 s näher als 1.4 Radien), kein gemeinsames Fliegen.
  for (const seed of SEEDS) {
    const plan = L.buildPlan(createRng(seed));
    for (const tomato of plan.filter((w) => w.type === 'tomato')) {
      for (const view of VIEWS) {
        const sec = L.tomatoOverlap(tomato, plan, view, 0.005);
        assert.ok(sec <= 0.1, `Seed ${seed} ${view.w}×${view.h}: Tomate ${sec.toFixed(2)} s lang direkt an einem Lacher`);
      }
    }
  }
  // Gegenprobe: Eine Tomate auf derselben Bahn wie ein Lacher fällt auf.
  const plan = L.buildPlan(createRng(1));
  const laugh = plan.find((w) => w.type !== 'tomato' && w.wave >= 0);
  assert.ok(L.tomatoOverlap({ ...laugh, type: 'tomato', t: laugh.t + 0.02 }, plan) > 1);
});

test('positionAt: Wurfparabel, skaliert mit der Bildgröße', () => {
  const wurf = { t: 2, type: 'ha', x0: 0.3, vx: 0.1, vy: 1.3, spin: 1 };
  const a = L.positionAt(wurf, 2, { w: 400, h: 800 });
  assert.equal(a.x, 120);
  assert.equal(a.y, L.START_Y * 800);
  const apex = L.apexOf(wurf, { w: 400, h: 800 });
  const before = L.positionAt(wurf, 2 + L.apexTime(wurf) - 0.1, { w: 400, h: 800 });
  const after = L.positionAt(wurf, 2 + L.apexTime(wurf) + 0.1, { w: 400, h: 800 });
  assert.ok(apex.y < before.y && apex.y < after.y);
  assert.ok(Math.abs(before.y - after.y) < 1e-9, 'symmetrisch um den Scheitelpunkt');
  const end = L.positionAt(wurf, 2 + L.flightTime(wurf), { w: 400, h: 800 });
  assert.ok(Math.abs(end.y - a.y) < 1e-9);
  const small = L.positionAt(wurf, 2.5, { w: 200, h: 400 });
  const big = L.positionAt(wurf, 2.5, { w: 400, h: 800 });
  assert.ok(Math.abs(big.x - 2 * small.x) < 1e-9 && Math.abs(big.y - 2 * small.y) < 1e-9);
  // out-Objekt wird wiederverwendet
  const out = {};
  assert.equal(L.positionAt(wurf, 2.5, { w: 200, h: 400 }, out), out);
});

test('Strecke-Kreis-Test', () => {
  const hit = L.segmentHitsCircle;
  assert.equal(hit(0, 0, 100, 0, 50, 5, 10), true, 'Strecke geht durch den Kreis');
  assert.equal(hit(0, 0, 100, 0, 50, 10, 10), true, 'Strecke berührt den Kreis');
  assert.equal(hit(0, 0, 100, 0, 50, 10.5, 10), false, 'knapp daneben');
  assert.equal(hit(0, 0, 100, 0, 112, 0, 10), false, 'Kreis liegt hinter dem Streckenende');
  assert.equal(hit(0, 0, 100, 0, 108, 0, 10), true, 'Endpunkt im Kreis');
  assert.equal(hit(0, 0, 100, 0, -8, 3, 10), true, 'Anfangspunkt im Kreis');
  assert.equal(hit(0, 0, 100, 0, -8, 7, 10), false, 'knapp neben dem Anfangspunkt');
  assert.equal(hit(45, 3, 55, -2, 50, 0, 30), true, 'Strecke ganz im Kreis');
  assert.equal(hit(50, 50, 50, 50, 55, 50, 10), true, 'Nulllänge im Kreis');
  assert.equal(hit(50, 50, 50, 50, 70, 50, 10), false, 'Nulllänge außerhalb');
  assert.equal(hit(0, 0, 60, 80, 30, 40, 1), true, 'schräge Strecke');
  assert.equal(hit(0, 0, 60, 80, 40, 30, 5), false, 'schräg knapp daneben');
});

test('Wisch: Antippen zählt nicht, Trefferradius großzügig', () => {
  assert.equal(L.isSwipe(0, 390), false);
  assert.equal(L.isSwipe(6, 390), false);
  assert.equal(L.isSwipe(L.MIN_SWIPE * 390, 390), true);
  const r = L.RADIUS * 390;
  assert.ok(Math.abs(2 * r - 4.5 * 16) < 0.01, 'Durchmesser 4.5em');
  assert.ok(L.hitRadius('ha', 390) > r);
  assert.ok(L.hitRadius('gold', 390) > r);
  assert.ok(L.hitRadius('tomato', 390) < r);
});

test('Punkte: Typen, Gold 3, Combo-Bonus', () => {
  const s = L.createScore();
  assert.deepEqual(L.applySlice(s, 'ha', 0), { gained: 1, bonus: 0, justSecured: false });
  assert.equal(L.applySlice(s, 'haha', 0).gained, 1);
  assert.equal(L.applySlice(s, 'face', 0).gained, 1);
  assert.equal(L.applySlice(s, 'mic', 0).gained, 2);
  assert.equal(L.applySlice(s, 'gold', 0).gained, 3);
  assert.equal(s.points, 8);
  // ein Wisch durch drei Lacher: 1 + (1+1) + (3+1)
  const c = L.createScore();
  L.applySlice(c, 'ha', 0);
  assert.deepEqual(L.applySlice(c, 'haha', 1), { gained: 2, bonus: 1, justSecured: false });
  assert.equal(L.applySlice(c, 'gold', 2).gained, 4);
  assert.equal(c.points, 7);
  assert.equal(c.bestCombo, 3);
  assert.equal(c.slices, 3);
});

test('Regeln: 3 Tomaten vor dem Ziel = verloren', () => {
  const s = L.createScore();
  for (let i = 0; i < 10; i++) L.applySlice(s, 'mic', 0);
  assert.equal(s.points, 20);
  assert.equal(L.outcome(s, 12), 'play');
  assert.deepEqual(L.applyTomato(s), { counted: true, lost: false });
  assert.deepEqual(L.applyTomato(s), { counted: true, lost: false });
  assert.equal(L.outcome(s, 10), 'play');
  assert.deepEqual(L.applyTomato(s), { counted: true, lost: true });
  assert.equal(s.tomatoes, 3);
  assert.equal(L.outcome(s, 10), 'tomatoes');
  assert.equal(L.outcome(s, 0), 'tomatoes');
});

test('Regeln: ab 25 Punkten ist der Sieg sicher, Tomaten zählen nicht mehr', () => {
  const s = L.createScore();
  L.applyTomato(s);
  L.applyTomato(s);
  for (let i = 0; i < 8; i++) assert.equal(L.applySlice(s, 'gold', 0).justSecured, false);
  assert.equal(s.points, 24);
  assert.equal(s.secured, false);
  assert.equal(L.applySlice(s, 'ha', 0).justSecured, true);
  assert.equal(s.secured, true);
  assert.equal(L.applySlice(s, 'ha', 0).justSecured, false, 'nur einmal melden');
  for (let i = 0; i < 5; i++) assert.deepEqual(L.applyTomato(s), { counted: false, lost: false });
  assert.equal(s.tomatoes, 2);
  assert.equal(L.outcome(s, 5), 'play', 'die Runde läuft als Bonus weiter');
  assert.equal(L.outcome(s, 0), 'win');
  assert.equal(L.outcome(s, -0.02), 'win');
});

test('Regeln: Zeit um mit zu wenig Punkten = verloren', () => {
  const s = L.createScore();
  for (let i = 0; i < 24; i++) L.applySlice(s, 'ha', 0);
  assert.equal(L.outcome(s, 0.01), 'play');
  assert.equal(L.outcome(s, 0), 'timeout');
  L.applySlice(s, 'ha', 0);
  assert.equal(L.outcome(s, 0), 'win');
});

// Simulierte Spielerin: erwischt jeden Lacher mit Wahrscheinlichkeit pLaugh, jede Tomate mit pTomato.
// Bewusst ohne Combos gerechnet (untere Schranke).
function simulate(seed, pLaugh, pTomato) {
  const plan = L.buildPlan(createRng(seed));
  const player = createRng(seed * 31 + 17);
  const score = L.createScore();
  for (const wurf of plan) {
    if (wurf.type === 'tomato') {
      if (player.chance(pTomato)) L.applyTomato(score);
    } else if (player.chance(pLaugh)) {
      L.applySlice(score, wurf.type, 0);
    }
    const state = L.outcome(score, L.DURATION - wurf.t);
    if (state !== 'play') return { state, score };
  }
  return { state: L.outcome(score, 0), score };
}

function winRate(pLaugh, pTomato, runs = 300) {
  let wins = 0;
  for (let i = 0; i < runs; i++) if (simulate(i * 104729 + 5, pLaugh, pTomato).state === 'win') wins++;
  return wins / runs;
}

test('Abstimmung: Gelegenheitsspielerin (62 % der Lacher, 6 % der Tomaten) gewinnt in ≥ 80 % von 300 Runden', () => {
  const rate = winRate(0.62, 0.06);
  assert.ok(rate >= 0.8, `Siegquote ${(rate * 100).toFixed(1)} %`);
  assert.ok(rate <= 0.95, `zu leicht: Siegquote ${(rate * 100).toFixed(1)} %`);
});

test('Abstimmung: Wer nur ein Drittel erwischt, verliert meist; wer alles wegwischt, fliegt an den Tomaten raus', () => {
  assert.ok(winRate(0.33, 0.06) < 0.1);
  // wildes Wischen (95 % von allem): Das Ziel ist meist erreicht, bevor die dritte Tomate kommt,
  // aber sicher ist es nicht.
  const wild = winRate(0.95, 0.95);
  assert.ok(wild > 0.1 && wild < 0.6, `wild: ${wild}`);
  assert.equal(simulate(1, 1, 0).state, 'win');
  assert.equal(simulate(1, 0, 1).state, 'tomatoes');
  assert.equal(simulate(1, 0, 0).state, 'timeout');
});
