import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import {
  COURSE_LENGTH,
  FIXED_STEP,
  HEARTS,
  INVULNERABLE,
  MIN_GAP_TIME,
  OBSTACLES,
  PLAYER_BOX,
  PLAYER_X,
  SPEED_END,
  SPEED_START,
  VIEW_W,
  autopilotInput,
  buildCourse,
  courseDuration,
  createWorld,
  makeObstacle,
  simulateJump,
  speedAt,
  stepWorld,
} from '../src/games/runner/logic.js';

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);
const NONE = { pressed: false, held: false };

// Lässt einen Lauf bis zum Ende durchlaufen. input(world) liefert die Eingabe je Schritt.
function run(course, input = () => NONE, maxTime = 60) {
  const w = createWorld(course);
  const log = [];
  while (!w.stopped && w.time + w.over < maxTime) {
    for (const e of stepWorld(w, FIXED_STEP, input(w))) log.push({ ...e, time: w.time });
  }
  return { w, log, has: (type) => log.some((e) => e.type === type), count: (type) => log.filter((e) => e.type === type).length };
}

// Strecke mit genau einem Hindernis; start = Streckenposition des Laufbeginns (bestimmt das Tempo).
function single(kind, at = 600) {
  return { obstacles: [makeObstacle(kind, at)], treats: [], length: at + 800 };
}

// Ein Sprung über ein einzelnes Hindernis: Absprung `lead` Sekunden vor dem Kontakt.
function tryJump(kind, { lead, hold = 0, doubleAfter = null, fast = false }) {
  const course = single(kind, fast ? COURSE_LENGTH - 900 : 600);
  if (fast) course.length = COURSE_LENGTH;
  const w = createWorld(course);
  if (fast) w.dist = COURSE_LENGTH - 1700;
  const o = w.obstacles[0];
  const d = OBSTACLES[kind];
  let jumpedAt = null;
  let hit = false;
  for (let i = 0; i < 120 * 8 && w.phase === 'run' && w.dist < o.x + 400; i++) {
    const eta = (PLAYER_X + (o.x - w.dist) * (1 + o.drift) + d.inset[0] - (PLAYER_X + PLAYER_BOX.right)) / (w.speed * (1 + o.drift));
    let pressed = false;
    if (jumpedAt === null && eta <= lead) {
      pressed = true;
      jumpedAt = w.time;
    } else if (jumpedAt !== null && doubleAfter !== null && w.player.jumps === 1 && w.time - jumpedAt >= doubleAfter) pressed = true;
    const held = jumpedAt !== null && w.time - jumpedAt < hold;
    for (const e of stepWorld(w, FIXED_STEP, { pressed, held })) if (e.type === 'hit') hit = true;
  }
  return !hit;
}

const LEADS = Array.from({ length: 60 }, (_, i) => i * 0.01);
// Größe des Zeitfensters (s), in dem der Absprung das Hindernis schafft.
const window_ = (kind, opts) => LEADS.filter((lead) => tryJump(kind, { ...opts, lead })).length * 0.01;

test('Sprungphysik: Halten springt höher als Tippen', () => {
  const tap = simulateJump({ holdFor: 0 });
  const hold = simulateJump({ holdFor: 1 });
  assert.ok(hold.peak > tap.peak * 1.3, `${tap.peak} / ${hold.peak}`);
  assert.ok(hold.airtime > tap.airtime);
  assert.ok(tap.peak > 110 && tap.airtime > 0.6 && tap.airtime < 0.85, JSON.stringify(tap));
  assert.ok(hold.airtime < 1.05, JSON.stringify(hold));
});

test('Sprungphysik: Doppelsprung ist höher als der Einzelsprung', () => {
  const single_ = simulateJump({ holdFor: 1 });
  const double = simulateJump({ holdFor: 1, doubleAt: 0.35 });
  assert.ok(double.peak > single_.peak + 80, `${single_.peak} / ${double.peak}`);
  assert.equal(double.doubles, 1);
});

test('Sprungphysik: nur ein Doppelsprung pro Sprung', () => {
  const two = simulateJump({ holdFor: 1, doubleAt: 0.3 });
  const three = simulateJump({ holdFor: 1, doubleAt: 0.3, tripleAt: 0.6 });
  assert.equal(three.doubles, 1);
  assert.ok(Math.abs(three.peak - two.peak) < 1e-9);
});

test('Strecke: gleicher Seed ergibt dieselbe Strecke', () => {
  assert.deepEqual(buildCourse(createRng(7)), buildCourse(createRng(7)));
  assert.notDeepEqual(buildCourse(createRng(7)).obstacles, buildCourse(createRng(8)).obstacles);
});

test('Strecke über 100 Seeds: 15–18 Hindernisse, genau 2 Kehrmaschinen, Abstände, Dauer', () => {
  const kinds = new Set();
  for (const seed of SEEDS) {
    const c = buildCourse(createRng(seed));
    const n = c.obstacles.length;
    assert.ok(n >= 15 && n <= 18, `Seed ${seed}: ${n} Hindernisse`);
    assert.equal(c.obstacles.filter((o) => o.kind === 'kehrmaschine').length, 2, `Seed ${seed}`);
    assert.equal(c.obstacles[0].kind, 'laub');
    c.obstacles.forEach((o) => kinds.add(o.kind));

    // kein Hindernis in den ersten 3 Sekunden: weder am Gespann noch im Bild
    const firstVisible = c.obstacles[0].x - (VIEW_W - PLAYER_X);
    assert.ok(firstVisible / SPEED_START >= 3, `Seed ${seed}: erstes Hindernis sichtbar nach ${firstVisible / SPEED_START}s`);

    // Mindestabstand in Laufzeit, großzügiger rund um die Kehrmaschine
    for (let i = 1; i < n; i++) {
      const a = c.obstacles[i - 1];
      const b = c.obstacles[i];
      const gap = (b.x - (a.x + a.w)) / speedAt(b.x);
      assert.ok(gap >= MIN_GAP_TIME - 0.01, `Seed ${seed}: Lücke ${i} nur ${gap.toFixed(2)}s`);
      assert.ok(gap >= 1.3);
      if (a.kind === 'kehrmaschine' || b.kind === 'kehrmaschine') assert.ok(gap >= MIN_GAP_TIME + 0.4, `Seed ${seed}: Lücke an der Kehrmaschine ${gap.toFixed(2)}s`);
      assert.ok(!(a.kind === 'kehrmaschine' && b.kind === 'kehrmaschine'));
    }
    // freie Einfahrt: letztes Hindernis endet deutlich vor dem Bahnhof
    const last = c.obstacles[n - 1];
    assert.ok(c.length - (last.x + last.w) >= 600, `Seed ${seed}`);

    const dur = courseDuration(c);
    assert.ok(dur >= 38 && dur <= 43, `Seed ${seed}: Dauer ${dur.toFixed(1)}s`);

    // Leckerlis liegen auf der Strecke und sind sortiert
    assert.ok(c.treats.length >= 15, `Seed ${seed}: ${c.treats.length} Leckerlis`);
    for (let i = 1; i < c.treats.length; i++) assert.ok(c.treats[i].x >= c.treats[i - 1].x);
  }
  // über viele Seeds kommt jede Hindernis-Art vor
  for (const k of Object.keys(OBSTACLES)) assert.ok(kinds.has(k), k);
});

test('Sichtbarkeit: jedes Hindernis ist mindestens 1,4 s vor dem Aufprall im Bild', () => {
  for (const [kind, d] of Object.entries(OBSTACLES)) {
    const visible = (VIEW_W - (PLAYER_X + PLAYER_BOX.right) + d.inset[0]) / (SPEED_END * (1 + (d.drift ?? 0)));
    assert.ok(visible >= 1.4, `${kind}: ${visible.toFixed(2)}s`);
  }
});

test('Jedes normale Hindernis ist mit einem Einzelsprung überwindbar (auch nur getippt)', () => {
  for (const kind of Object.keys(OBSTACLES)) {
    if (OBSTACLES[kind].double) continue;
    for (const fast of [false, true]) {
      const tap = window_(kind, { hold: 0, fast });
      const hold = window_(kind, { hold: 1, fast });
      assert.ok(tap >= 0.12, `${kind}: Zeitfenster getippt nur ${tap.toFixed(2)}s`);
      assert.ok(hold >= 0.25, `${kind}: Zeitfenster gehalten nur ${hold.toFixed(2)}s`);
    }
  }
});

test('Kehrmaschine: Einzelsprung reicht nie, Doppelsprung schon', () => {
  for (const fast of [false, true]) {
    assert.equal(window_('kehrmaschine', { hold: 0, fast }), 0);
    assert.equal(window_('kehrmaschine', { hold: 1, fast }), 0);
    const dbl = window_('kehrmaschine', { hold: 1, doubleAfter: 0.35, fast });
    const tapTap = window_('kehrmaschine', { hold: 0.1, doubleAfter: 0.3, fast });
    assert.ok(dbl >= 0.2, `Doppelsprung gehalten: ${dbl.toFixed(2)}s`);
    assert.ok(tapTap >= 0.15, `Doppelsprung getippt: ${tapTap.toFixed(2)}s`);
  }
});

test('Autopilot schafft alle 100 Seeds ohne Herzverlust', () => {
  for (const seed of SEEDS) {
    const c = buildCourse(createRng(seed));
    const r = run(c, (w) => autopilotInput(w));
    assert.equal(r.w.phase, 'won', `Seed ${seed}`);
    assert.equal(r.w.hearts, HEARTS, `Seed ${seed}: ${r.w.hits} Treffer`);
    assert.equal(r.count('won'), 1);
    assert.equal(r.count('doubleJump'), 2, `Seed ${seed}`);
    assert.equal(r.count('warn'), 2, `Seed ${seed}`);
    assert.equal(r.count('hint'), 1);
    assert.ok(r.w.time >= 38 && r.w.time <= 43, `Seed ${seed}: ${r.w.time.toFixed(1)}s`);
    // Die Bögen über den Hindernissen sammelt ein sauberer Sprung ein.
    assert.ok(r.w.treats >= c.treats.length * 0.9, `Seed ${seed}: ${r.w.treats}/${c.treats.length} Leckerlis`);
  }
});

test('Abstimmung: schlampige Spielerin (8 % Fehler je Hindernis) gewinnt mindestens 80 % von 300 Läufen', () => {
  let wins = 0;
  let hits = 0;
  for (let i = 0; i < 300; i++) {
    const c = buildCourse(createRng(1000 + i));
    const luck = createRng(5000 + i);
    const missed = c.obstacles.map(() => luck.chance(0.08));
    const r = run(c, (w) => autopilotInput(w, { skip: (k) => missed[k] }));
    assert.equal(r.w.hits, Math.min(HEARTS, missed.filter(Boolean).length), `Lauf ${i}: jeder Fehler ist genau ein Treffer`);
    hits += r.w.hits;
    if (r.w.phase === 'won') wins++;
  }
  assert.ok(wins >= 240, `nur ${wins}/300 gewonnen`);
  assert.ok(wins <= 285, `zu leicht gerechnet? ${wins}/300`);
  assert.ok(hits > 200);
});

test('Treffer kostet genau ein Herz und macht unverwundbar', () => {
  // Zwei Hindernisse direkt hintereinander: das zweite liegt in der Schonfrist.
  const course = { obstacles: [makeObstacle('tonne', 500), makeObstacle('tonne', 560)], treats: [], length: 2000 };
  const w = createWorld(course);
  const hitsAt = [];
  while (w.dist < 1200) for (const e of stepWorld(w, FIXED_STEP, NONE)) if (e.type === 'hit') hitsAt.push(w.time);
  assert.equal(hitsAt.length, 1);
  assert.equal(w.hearts, HEARTS - 1);
  assert.equal(w.phase, 'run');
  assert.ok(w.obstacles[0].hit && !w.obstacles[1].hit);

  // Schonfrist läuft ab, das getroffene Hindernis trifft nie wieder.
  const w2 = createWorld(single('kehrmaschine', 500));
  let hit2 = 0;
  let invMax = 0;
  let invEnd = null;
  while (w2.phase === 'run') {
    for (const e of stepWorld(w2, FIXED_STEP, NONE)) if (e.type === 'hit') hit2++;
    invMax = Math.max(invMax, w2.inv);
    if (hit2 && w2.inv === 0 && invEnd === null) invEnd = w2.time;
  }
  assert.equal(hit2, 1);
  assert.ok(Math.abs(invMax - INVULNERABLE) < 0.02);
  assert.ok(invEnd !== null);
  assert.equal(w2.hearts, HEARTS - 1);
});

test('3 Treffer = verloren, Pferd bleibt stehen', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const c = buildCourse(createRng(seed));
    const r = run(c);
    assert.equal(r.w.phase, 'lost');
    assert.equal(r.w.hearts, 0);
    assert.equal(r.count('hit'), 3);
    assert.equal(r.count('lost'), 1);
    assert.equal(r.count('won'), 0);
    assert.ok(r.w.stopped && r.w.speed === 0);
    // ohne Eingaben trifft genau jedes der ersten drei Hindernisse
    assert.deepEqual(r.log.filter((e) => e.type === 'hit').map((e) => e.index), [0, 1, 2]);
    assert.ok(r.w.dist < c.obstacles[2].x + 200);
    // danach passiert nichts mehr
    const before = r.w.dist;
    for (let i = 0; i < 240; i++) assert.equal(stepWorld(r.w, FIXED_STEP, { pressed: true, held: true }).length, 0);
    assert.equal(r.w.dist, before);
  }
});

test('Ziel erreicht = gewonnen, Pferd bremst im Bahnhof', () => {
  const course = { obstacles: [], treats: [{ x: 300, alt: 165 }, { x: 400, alt: 500 }], length: 1000 };
  const r = run(course);
  assert.equal(r.w.phase, 'won');
  assert.equal(r.count('won'), 1);
  assert.equal(r.count('stopped'), 1);
  assert.equal(r.w.hearts, HEARTS);
  assert.ok(r.w.dist > 1000 && r.w.dist < 1160, `Bremsweg ${r.w.dist - 1000}`);
  assert.ok(r.w.over > 0.4 && r.w.over < 1.2, `Bremszeit ${r.w.over}`);
  // Leckerli auf Kopfhöhe wird im Vorbeireiten eingesammelt, das hohe nicht
  assert.equal(r.w.treats, 1);
  assert.equal(r.count('treat'), 1);
});

test('Ereignisse: Sprung, Doppelsprung und Landung werden gemeldet', () => {
  const w = createWorld({ obstacles: [], treats: [], length: 5000 });
  const seen = [];
  for (let i = 0; i < 300; i++) {
    const pressed = i === 10 || i === 50 || i === 60;
    for (const e of stepWorld(w, FIXED_STEP, { pressed, held: false })) seen.push(e.type);
  }
  assert.deepEqual(seen, ['jump', 'doubleJump', 'land']);
  assert.equal(w.jumps, 1);
  assert.equal(w.doubleJumps, 1);
});
