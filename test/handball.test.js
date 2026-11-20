import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import {
  FLIGHT,
  GOALS_NEEDED,
  GOAL_IMG,
  IMAGE,
  KEEPER,
  SWIPE,
  THROWS,
  ballAt,
  createMatch,
  keeperAt,
  keeperDecision,
  matchOutcome,
  onTarget,
  project,
  recordShot,
  resolveShot,
  stageLayout,
  swipeScale,
  swipeToShot,
} from '../src/games/handball/logic.js';

const VIEW = { w: 390, h: 844 };
// Wisch in Anteilen der Bühnenbreite (hoch = positiv), 250 ms lang.
const swipe = (side, up, ms = 250, view = VIEW) => swipeToShot(side * view.w, -up * view.w, ms, view);
const inGoal = (s) => s.valid && s.x > 0 && s.x < 1 && s.y > 0 && s.y < 1;

// Normalverteilte Zufallszahl aus dem Seed-Generator (Box-Muller).
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

// Gelegenheitsspielerin: zielt grob auf die Tormitte, streut aber kräftig (ca. 10 % gehen neben oder übers Tor).
// Tiefer als der flachste mögliche Wurf kann ein Wisch nicht zielen.
const CASUAL = { x: 0.5, y: 0.5, sx: 0.28, sy: 0.28 };
const casualShot = (rng) => ({ x: CASUAL.x + gauss(rng) * CASUAL.sx, y: Math.max(SWIPE.lowY, CASUAL.y + gauss(rng) * CASUAL.sy), power: 0.5 });

function saveRate(rng, makeShot, n = 4000) {
  let saved = 0;
  for (let i = 0; i < n; i++) {
    const shot = makeShot(rng);
    if (resolveShot(shot, keeperDecision(rng, shot)) === 'saved') saved++;
  }
  return saved / n;
}

function playMatch(rng, makeShot) {
  let match = createMatch();
  while (!matchOutcome(match)) {
    const shot = makeShot(rng);
    match = recordShot(match, resolveShot(shot, keeperDecision(rng, shot)));
  }
  return match;
}

test('normaler, mittellanger Wisch nach oben landet im Tor', () => {
  for (const view of [VIEW, { w: 360, h: 640 }, { w: 430, h: 932 }]) {
    for (const up of [0.25, 0.35, 0.45, 0.55]) {
      const s = swipe(0, up, 250, view);
      assert.ok(inGoal(s), `hoch ${up} bei ${view.w}: ${JSON.stringify(s)}`);
      assert.ok(Math.abs(s.x - 0.5) < 1e-9);
    }
  }
  // auch leicht schräg (bis ca. 20°) und fast beliebig lang bleibt der Ball im Tor
  for (const deg of [-20, -10, 10, 20]) {
    for (const len of [0.15, 0.3, 0.5, 0.7, 0.9]) {
      const a = (deg * Math.PI) / 180;
      assert.ok(inGoal(swipe(Math.sin(a) * len, Math.cos(a) * len)), `${deg}° Länge ${len}`);
    }
  }
});

test('längerer Wisch = höher und härter, Richtung = Seite', () => {
  const low = swipe(0, 0.15);
  const mid = swipe(0, 0.4);
  const high = swipe(0, 0.7);
  assert.ok(low.y < mid.y && mid.y < high.y);
  assert.ok(low.power < mid.power && mid.power < high.power);
  assert.ok(low.time > high.time, 'harte Würfe fliegen schneller');
  assert.ok(swipe(-0.15, 0.4).x < 0.5 && swipe(0.15, 0.4).x > 0.5);
  assert.ok(swipe(0, 0.4, 100).time < swipe(0, 0.4, 600).time, 'schneller Wisch = schnellerer Ball');
  assert.equal(swipe(0, 0.4, 100).y, swipe(0, 0.4, 600).y, 'Tempo ändert das Ziel nicht (Vorschau bleibt ehrlich)');
});

test('Antippen, zu kurzer Wisch und Wisch nach unten sind kein Wurf', () => {
  assert.equal(swipeToShot(0, 0, 80, VIEW).valid, false);
  assert.equal(swipe(0, 0.03).valid, false);
  assert.equal(swipe(0.02, 0.02).valid, false);
  assert.equal(swipe(0, -0.4).valid, false);
  assert.equal(swipe(0.3, -0.2).valid, false);
  assert.equal(swipe(0.5, 0).valid, false, 'rein waagerecht');
  assert.equal(swipe(0, SWIPE.minLen + 0.01).valid, true);
});

test('sehr langer Wisch geht über die Latte', () => {
  for (const view of [VIEW, { w: 360, h: 640 }, { w: 430, h: 932 }]) {
    const L = stageLayout(view.w, view.h);
    const hand = project(L, { ...FLIGHT.start, d: 0 });
    const toBar = (hand.y - L.goal.t) / view.w; // Finger wischt vom Ball bis zur Latte
    for (const up of [toBar, toBar * 1.2, 1.5, 2.5]) {
      const s = swipe(0, up, 250, view);
      assert.ok(s.valid && s.y > 1, `hoch ${up} bei ${view.w}: y=${s.y}`);
      assert.equal(resolveShot(s, keeperAt('center', 0.5, KEEPER.bodyY)), 'miss');
    }
    // … aber ein Wisch nur bis zur Torlinie bleibt klar drunter
    const toLine = (hand.y - L.goal.b) / view.w;
    const safe = swipe(0, toLine, 250, view);
    assert.ok(safe.y > 0.4 && safe.y < 0.8, `bis zur Torlinie: y=${safe.y}`);
    // die Eichung ist dieselbe, egal ob { w, h } oder das fertige Layout übergeben wird
    assert.deepEqual(swipeToShot(20, -200, 250, L), swipeToShot(20, -200, 250, view));
    assert.ok(swipeScale(view).barLen > swipeScale(view).kneeLen);
  }
  assert.ok(swipe(0, 5).y <= SWIPE.maxY);
});

test('stark seitlicher Wisch geht daneben', () => {
  for (const side of [-0.5, -0.35, 0.35, 0.5]) {
    const s = swipe(side, 0.4);
    assert.ok(s.valid && (s.x < 0 || s.x > 1), `seitlich ${side}: x=${s.x}`);
    assert.equal(onTarget(s), false);
    assert.equal(resolveShot(s, keeperAt('center', 0.5, KEEPER.bodyY)), 'miss');
  }
  assert.ok(Math.abs(swipe(3, 0.1).x - 0.5) <= SWIPE.maxTan * SWIPE.aimDepth + 1e-9);
});

test('resolveShot: Tor, gehalten, daneben', () => {
  const keeper = keeperAt('center', 0.5, 0.45);
  assert.equal(resolveShot({ x: 0.5, y: 0.45 }, keeper), 'saved');
  assert.equal(resolveShot({ x: 0.05, y: 0.9 }, keeper), 'goal');
  assert.equal(resolveShot({ x: -0.2, y: 0.5 }, keeper), 'miss');
  assert.equal(resolveShot({ x: 1.2, y: 0.5 }, keeper), 'miss');
  assert.equal(resolveShot({ x: 0.5, y: 1.2 }, keeper), 'miss');
  // seitlicher Hechtsprung reicht weiter zur Seite, aber nicht bis in die Ecke
  const dive = keeperAt('left', KEEPER.diveX.left, 0.45);
  assert.equal(resolveShot({ x: 0.15, y: 0.45 }, dive), 'saved');
  assert.equal(resolveShot({ x: 0.04, y: 0.92 }, dive), 'goal');
  assert.equal(resolveShot({ x: 0.5, y: 0.45 }, dive), 'goal');
});

test('Torwart hechtet nur zu erlaubten Stellen', () => {
  const rng = createRng(11);
  const sides = new Set();
  for (let i = 0; i < 500; i++) {
    const shot = casualShot(rng);
    const k = keeperDecision(rng, shot);
    sides.add(k.side);
    assert.ok(Math.abs(k.x - KEEPER.diveX[k.side]) <= KEEPER.jitterX + 1e-9);
    if (k.side === 'center') assert.equal(k.y, KEEPER.bodyY);
    else assert.ok(k.y >= KEEPER.minY && k.y <= KEEPER.maxY);
  }
  assert.deepEqual([...sides].sort(), ['center', 'left', 'right']);
});

test('Eckbälle sind fast unhaltbar (höchstens 8 %)', () => {
  const rng = createRng(2026);
  const corner = (r) => ({
    x: r.chance(0.5) ? r.range(0.02, 0.12) : r.range(0.88, 0.98),
    y: r.chance(0.5) ? r.range(SWIPE.lowY, 0.2) : r.range(0.84, 0.98),
  });
  const rate = saveRate(rng, corner);
  assert.ok(rate <= 0.08, `Eckbälle gehalten: ${rate}`);
});

test('zentrale Bälle auf Körperhöhe hält er häufig (35–60 %)', () => {
  const rng = createRng(2027);
  const rate = saveRate(rng, (r) => ({ x: r.range(0.44, 0.56), y: r.range(0.32, 0.62) }));
  assert.ok(rate >= 0.35 && rate <= 0.6, `zentral gehalten: ${rate}`);
});

test('Gelegenheitsspielerin: 64–74 % Treffer, 76–88 % schaffen 3 von 5', () => {
  const rng = createRng(20260123);
  const n = 2000;
  const count = { goal: 0, saved: 0, miss: 0 };
  for (let i = 0; i < n; i++) {
    const shot = casualShot(rng);
    count[resolveShot(shot, keeperDecision(rng, shot))]++;
  }
  const hit = count.goal / n;
  const off = count.miss / n;
  const held = count.saved / (n - count.miss);
  assert.ok(off >= 0.07 && off <= 0.13, `neben dem Tor: ${off}`);
  assert.ok(held >= 0.2 && held <= 0.3, `gehalten (von den Würfen aufs Tor): ${held}`);
  assert.ok(hit >= 0.64 && hit <= 0.74, `Trefferquote: ${hit}`);

  let won = 0;
  for (let i = 0; i < n; i++) if (matchOutcome(playMatch(rng, casualShot)) === 'won') won++;
  const wins = won / n;
  assert.ok(wins >= 0.76 && wins <= 0.88, `mindestens 3 von 5: ${wins}`);
});

test('dieselbe Spielerin über echte Wische (Winkel und Länge streuen) liegt im selben Bereich', () => {
  const rng = createRng(4711);
  const swiper = (r) => {
    const a = gauss(r) * 0.33; // ca. 19° Streuung
    const len = Math.max(SWIPE.minLen + 0.02, 0.42 + gauss(r) * 0.2) * VIEW.w;
    return swipeToShot(Math.sin(a) * len, -Math.cos(a) * len, 250, VIEW);
  };
  const n = 2000;
  let goals = 0;
  for (let i = 0; i < n; i++) {
    const shot = swiper(rng);
    if (shot.valid && resolveShot(shot, keeperDecision(rng, shot)) === 'goal') goals++;
  }
  assert.ok(goals / n >= 0.62 && goals / n <= 0.76, `Trefferquote über Wische: ${goals / n}`);
});

test('Spielregeln: 3 Tore = sofort gewonnen, 3 Fehlwürfe = sofort verloren, nie mehr als 5 Würfe', () => {
  assert.equal(THROWS, 5);
  assert.equal(GOALS_NEEDED, 3);
  const play = (results) => results.reduce((m, r) => recordShot(m, r), createMatch());

  assert.equal(matchOutcome(createMatch()), null);
  assert.equal(matchOutcome(play(['goal', 'goal'])), null);
  const quick = play(['goal', 'goal', 'goal']);
  assert.equal(matchOutcome(quick), 'won');
  assert.equal(quick.throws, 3);

  assert.equal(matchOutcome(play(['saved', 'miss'])), null);
  const bad = play(['saved', 'miss', 'saved']);
  assert.equal(matchOutcome(bad), 'lost');
  assert.equal(bad.throws, 3);

  assert.equal(matchOutcome(play(['goal', 'miss', 'goal', 'saved'])), null);
  assert.equal(matchOutcome(play(['goal', 'miss', 'goal', 'saved', 'goal'])), 'won');
  assert.equal(matchOutcome(play(['goal', 'miss', 'goal', 'saved', 'miss'])), 'lost');
  assert.equal(matchOutcome(play(['goal', 'miss', 'saved', 'miss'])), 'lost', 'nach 4 Würfen mit 1 Tor ist es entschieden');

  // Nach Spielende wird nichts mehr eingetragen.
  const after = recordShot(recordShot(quick, 'goal'), 'miss');
  assert.deepEqual(after, quick);

  // recordShot verändert den alten Stand nicht.
  const m0 = createMatch();
  recordShot(m0, 'goal');
  assert.deepEqual(m0, { throws: 0, goals: 0, results: [] });

  // Zufällige Partien: immer entschieden nach 3 bis 5 Würfen, Sieg genau bei 3 Toren.
  const rng = createRng(5);
  for (let i = 0; i < 500; i++) {
    let m = createMatch();
    for (let t = 0; t < 12; t++) m = recordShot(m, rng.pick(['goal', 'saved', 'miss']));
    assert.ok(m.throws >= 3 && m.throws <= THROWS);
    assert.equal(m.results.length, m.throws);
    assert.equal(matchOutcome(m), m.goals === GOALS_NEEDED ? 'won' : 'lost');
    assert.ok(m.goals <= GOALS_NEEDED);
  }
});

test('Flugbahn: Start an der Wurfhand, Ziel im Tor, dazwischen Bogen und Kurve', () => {
  const shot = swipe(-0.12, 0.42);
  const a = ballAt(shot, 0);
  const b = ballAt(shot, 1);
  assert.deepEqual(a, { x: FLIGHT.start.x, y: FLIGHT.start.y, d: 0 });
  assert.ok(Math.abs(b.x - shot.x) < 1e-9 && Math.abs(b.y - shot.y) < 1e-9);
  assert.equal(b.d, 1);
  const mid = ballAt(shot, 0.5);
  assert.ok(mid.y > (a.y + b.y) / 2, 'Bogen nach oben');
  assert.ok(Math.abs(mid.x - (a.x + b.x) / 2) > 0.005, 'seitliche Kurve');
  for (let t = 0.1; t < 1; t += 0.1) assert.ok(ballAt(shot, t + 0.05).d > ballAt(shot, t).d);
  // außerhalb von 0..1 wird geklemmt
  assert.deepEqual(ballAt(shot, -1), a);
  assert.deepEqual(ballAt(shot, 2), b);
  // schwache Würfe fliegen einen höheren Bogen als harte
  const soft = ballAt({ x: 0.5, y: 0.5, power: 0 }, 0.5).y;
  const hard = ballAt({ x: 0.5, y: 0.5, power: 1 }, 0.5).y;
  assert.ok(soft > hard);
});

test('Bühne: gemaltes Tor sitzt auf jedem Handy vollständig und groß im Bild', () => {
  for (const [w, h] of [[390, 844], [360, 640], [430, 932], [375, 667]]) {
    const L = stageLayout(w, h);
    // Bild deckt die Bühne ab
    assert.ok(L.ox <= 1e-6 && L.oy <= 1e-6);
    assert.ok(L.ox + IMAGE.w * L.scale >= w - 1e-6 && L.oy + IMAGE.h * L.scale >= h - 1e-6);
    // Tor liegt mittig, vollständig sichtbar, unter der Kopfzeile und über der Werferin
    assert.ok(Math.abs((L.goal.l + L.goal.r) / 2 - w / 2) < 0.5);
    assert.ok(L.goal.l > 0 && L.goal.r < w && L.goal.t > h * 0.12 && L.goal.b < h * 0.6);
    assert.ok(L.goal.w / w >= 0.6 && L.goal.w / w <= 0.85, `Torbreite ${L.goal.w / w}`);
    // gleiche Abbildung wie das Bild: Bildpunkt → Bildschirm
    assert.ok(Math.abs(L.goal.l - (L.ox + GOAL_IMG.l * L.scale)) < 1e-9);
    assert.ok(Math.abs(L.goal.b - (L.oy + GOAL_IMG.b * L.scale)) < 1e-9);
    // Projektion: Torebene trifft das Tor-Rechteck genau, vorne ist alles doppelt so groß
    const bl = project(L, { x: 0, y: 0, d: 1 });
    const tr = project(L, { x: 1, y: 1, d: 1 });
    assert.ok(Math.abs(bl.x - L.goal.l) < 1e-6 && Math.abs(bl.y - L.goal.b) < 1e-6);
    assert.ok(Math.abs(tr.x - L.goal.r) < 1e-6 && Math.abs(tr.y - L.goal.t) < 1e-6);
    const near = project(L, { x: 0.5, y: 0, d: 0 });
    assert.ok(Math.abs(near.y - L.ground) < 1e-6);
    assert.ok(near.m > bl.m);
    // Abwurfpunkt liegt im unteren Drittel, wo der Daumen wischt
    const hand = project(L, { ...FLIGHT.start, d: 0 });
    assert.ok(hand.y > h * 0.66 && hand.y < h && hand.x > 0 && hand.x < w);
  }
});
