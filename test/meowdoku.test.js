import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import {
  AUTO,
  BAD,
  CAT,
  CATS,
  EMPTY,
  MARK,
  MAX_HEARTS,
  REGIONS,
  SIZE,
  SOLUTION,
  createState,
  excludedBy,
  isConnected,
  isOpen,
  isValidSolution,
  logicalMoves,
  regionCells,
  regionIds,
  solve,
  solveByLogic,
  tapCell,
  touches,
} from '../src/games/meowdoku/logic.js';

// Zwei Tipps auf dasselbe Feld = Kater setzen (leer → ✕ → Kater). Gibt den Zustand und die Ereignisse des zweiten Tipps zurück.
function placeCat(state, row, col) {
  let res = { state, events: [] };
  if (state.cells[row][col] === EMPTY) res = tapCell(state, row, col);
  return tapCell(res.state, row, col);
}
const types = (events) => events.map((e) => e.type);
const wrongCells = () => {
  const list = [];
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (SOLUTION[row] !== col) list.push({ row, col });
  return list;
};

test('Sitzplan: 6 × 6 Felder, genau 6 Regionen A–F, jede zusammenhängend', () => {
  assert.equal(SIZE, 6);
  assert.equal(REGIONS.length, SIZE);
  for (const line of REGIONS) assert.match(line, /^[A-F]{6}$/);
  const ids = regionIds(REGIONS);
  assert.deepEqual([...ids].sort(), ['A', 'B', 'C', 'D', 'E', 'F']);
  for (const id of ids) assert.ok(isConnected(REGIONS, id), `Region ${id} hängt nicht zusammen`);
  assert.equal(ids.reduce((sum, id) => sum + regionCells(REGIONS, id).length, 0), SIZE * SIZE);
});

test('leichter Einstieg: mindestens zwei sehr kleine Regionen (1–2 Felder)', () => {
  const sizes = regionIds(REGIONS).map((id) => regionCells(REGIONS, id).length);
  assert.ok(sizes.filter((n) => n <= 2).length >= 2, `Regionsgrößen: ${sizes}`);
  assert.ok(sizes.includes(1));
});

test('isConnected erkennt zerrissene Regionen', () => {
  assert.equal(isConnected(['AB', 'BA'], 'A'), false);
  assert.equal(isConnected(['AA', 'BA'], 'A'), true);
  assert.equal(isConnected(['AA', 'AA'], 'Z'), false);
});

test('das Rätsel hat genau eine Lösung, und zwar SOLUTION', () => {
  const solutions = solve(REGIONS);
  assert.equal(solutions.length, 1);
  assert.deepEqual(solutions[0], SOLUTION);
  assert.ok(isValidSolution(REGIONS, SOLUTION));
});

test('solve findet alle Lösungen eines mehrdeutigen Plans', () => {
  // Waagerechte Streifen: Regionen = Zeilen, es bleiben nur Spalten- und Berührungsregel (90 Lösungen bei 6 × 6).
  const stripes = ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD', 'EEEEEE', 'FFFFFF'];
  const solutions = solve(stripes);
  assert.equal(solutions.length, 90);
  for (const cols of solutions) assert.ok(isValidSolution(stripes, cols));
  assert.equal(solveByLogic(stripes).solved, false);
});

test('isValidSolution lehnt Regelverstöße ab', () => {
  assert.equal(isValidSolution(REGIONS, [0, 3, 5, 1, 4]), false, 'zu kurz');
  assert.equal(isValidSolution(REGIONS, [0, 0, 5, 1, 4, 2]), false, 'gleiche Spalte');
  assert.equal(isValidSolution(REGIONS, [0, 1, 3, 5, 2, 4]), false, 'berühren sich diagonal');
  assert.equal(isValidSolution(REGIONS, [1, 3, 5, 0, 4, 2]), false, 'Region E doppelt, F bleibt leer');
  assert.equal(isValidSolution(REGIONS, [0, 3, 5, 1, 4, 9]), false, 'außerhalb');
});

test('keine zwei Lösungskater berühren sich, je Zeile/Spalte/Region genau einer', () => {
  const cats = SOLUTION.map((col, row) => ({ row, col }));
  for (const a of cats) for (const b of cats) if (a !== b) assert.equal(touches(a.row, a.col, b.row, b.col), false);
  assert.equal(new Set(SOLUTION).size, SIZE);
  assert.equal(new Set(cats.map((c) => REGIONS[c.row][c.col])).size, SIZE);
});

test('Anfänger-Niveau: solveByLogic löst das Rätsel nur mit einfachen Schlüssen', () => {
  const res = solveByLogic(REGIONS);
  assert.equal(res.solved, true);
  assert.deepEqual(res.cols, SOLUTION);
  assert.equal(res.steps.length, SIZE);
  for (const step of res.steps) assert.ok(['region', 'row', 'col'].includes(step.reason));
  // Der Einstieg sind die beiden Ein-Feld-Regionen.
  assert.equal(res.steps[0].reason, 'region');
  assert.equal(regionCells(REGIONS, REGIONS[res.steps[0].row][res.steps[0].col]).length, 1);
});

test('in jeder erreichbaren Lage gibt es einen sichtbaren Schluss über eine Farbregion', () => {
  const seen = new Set();
  const visit = (state) => {
    const id = state.cats.map((c) => c.row).sort().join('');
    if (seen.has(id) || state.status !== 'playing') return;
    seen.add(id);
    const moves = logicalMoves(state);
    assert.ok(moves.some((m) => m.reason === 'region'), `kein Regions-Schluss nach Katern in Zeilen ${id}`);
    for (const m of moves) {
      assert.equal(SOLUTION[m.row], m.col);
      visit(placeCat(state, m.row, m.col).state);
    }
  };
  visit(createState());
  assert.ok(seen.size >= SIZE);
});

test('Auto-✕: Zeile, Spalte, Region und die 8 Nachbarn', () => {
  const list = excludedBy(REGIONS, 1, 3); // Ein-Feld-Region D
  const has = (row, col) => list.some((c) => c.row === row && c.col === col);
  assert.equal(has(1, 3), false);
  for (let i = 0; i < SIZE; i++) {
    if (i !== 3) assert.ok(has(1, i), `Zeile, Spalte ${i}`);
    if (i !== 1) assert.ok(has(i, 3), `Spalte, Zeile ${i}`);
  }
  for (const [row, col] of [[0, 2], [0, 4], [2, 2], [2, 4]]) assert.ok(has(row, col), 'diagonaler Nachbar');
  assert.equal(has(3, 5), false);
  // Region: ein Kater in A (0,0) schließt das zweite A-Feld aus, eine große Region komplett.
  assert.ok(excludedBy(REGIONS, 4, 4).some((c) => c.row === 1 && c.col === 0), 'Region C reicht bis (1,0)');
});

test('Tipp-Zyklus: leer → ✕ → Kater (richtiges Feld)', () => {
  const s0 = createState();
  assert.equal(s0.hearts, MAX_HEARTS);
  assert.equal(s0.cells[0][0], EMPTY);

  const a = tapCell(s0, 0, 0);
  assert.deepEqual(types(a.events), ['mark']);
  assert.equal(a.state.cells[0][0], MARK);
  assert.equal(s0.cells[0][0], EMPTY, 'alter Zustand bleibt unberührt');

  const b = tapCell(a.state, 0, 0);
  assert.deepEqual(types(b.events), ['cat-ok']);
  assert.equal(b.state.cells[0][0], CAT);
  assert.equal(b.state.hearts, MAX_HEARTS);
  assert.deepEqual(b.state.cats, [{ row: 0, col: 0, who: CATS[0] }]);
  assert.equal(b.events[0].who, CATS[0]);
  assert.equal(b.events[0].cats, 1);
});

test('richtiger Kater streicht alle ausgeschlossenen Felder automatisch aus', () => {
  const marked = tapCell(createState(), 0, 3).state; // Hand-✕ in der späteren Zeile
  const { state, events } = placeCat(marked, 0, 0);
  const expected = excludedBy(REGIONS, 0, 0);
  assert.equal(events[0].auto.length, expected.length);
  for (const c of expected) assert.equal(state.cells[c.row][c.col], AUTO, `(${c.row},${c.col})`);
  assert.equal(state.cells[0][3], AUTO, 'Hand-✕ wird zum Auto-✕');
  assert.equal(state.cells[2][2], EMPTY, 'nicht betroffen');
  assert.equal(isOpen(state, 0, 1), false);
});

test('Kater wechseln sich ab: Franks, Findi, Franks …', () => {
  let state = createState();
  const order = [];
  for (let row = 0; row < SIZE; row++) {
    const res = placeCat(state, row, SOLUTION[row]);
    order.push(res.events[0].who);
    state = res.state;
  }
  assert.deepEqual(order, ['franks', 'findi', 'franks', 'findi', 'franks', 'findi']);
});

test('falscher Kater kostet ein Herz und hinterlässt ein rotes ✕', () => {
  const { state, events } = placeCat(createState(), 2, 2);
  assert.deepEqual(types(events), ['cat-wrong']);
  assert.equal(events[0].hearts, MAX_HEARTS - 1);
  assert.equal(state.hearts, MAX_HEARTS - 1);
  assert.equal(state.cells[2][2], BAD);
  assert.equal(state.cats.length, 0);
  assert.equal(state.status, 'playing');
  assert.equal(isOpen(state, 2, 2), false);

  // Das rote ✕ ist gesperrt: weiteres Tippen kostet kein Herz mehr.
  const again = tapCell(state, 2, 2);
  assert.deepEqual(types(again.events), ['locked']);
  assert.equal(again.state.hearts, MAX_HEARTS - 1);
  assert.equal(again.state.cells[2][2], BAD);
});

test('Auto-✕ ist gesperrt: Tippen kostet kein Herz', () => {
  const { state } = placeCat(createState(), 1, 3);
  assert.equal(state.cells[1][0], AUTO);
  const res = tapCell(state, 1, 0);
  assert.deepEqual(types(res.events), ['locked']);
  assert.equal(res.state.hearts, MAX_HEARTS);
  assert.equal(res.state, state);
});

test('drei falsche Kater → verloren', () => {
  let state = createState();
  const wrong = wrongCells().slice(0, MAX_HEARTS);
  let last;
  for (const { row, col } of wrong) {
    last = placeCat(state, row, col);
    state = last.state;
  }
  assert.deepEqual(types(last.events), ['cat-wrong', 'lost']);
  assert.equal(state.hearts, 0);
  assert.equal(state.status, 'lost');
});

test('sechs richtige Kater → gewonnen (auch mit zwei Fehlversuchen dazwischen)', () => {
  let state = createState();
  state = placeCat(state, 5, 5).state;
  state = placeCat(state, 2, 0).state;
  assert.equal(state.hearts, 1);
  let last;
  for (let row = 0; row < SIZE; row++) {
    last = placeCat(state, row, SOLUTION[row]);
    state = last.state;
    assert.equal(last.events[0].type, 'cat-ok');
  }
  assert.deepEqual(types(last.events), ['cat-ok', 'won']);
  assert.equal(state.status, 'won');
  assert.equal(state.cats.length, SIZE);
  assert.equal(state.hearts, 1);
  // Am Ende ist jedes Feld Kater oder ✕.
  for (const line of state.cells) for (const cell of line) assert.ok([CAT, AUTO, BAD].includes(cell));
});

test('feste Kater lassen sich nicht wegtippen', () => {
  const { state } = placeCat(createState(), 3, 1);
  let cur = state;
  for (let i = 0; i < 4; i++) {
    const res = tapCell(cur, 3, 1);
    assert.deepEqual(types(res.events), ['locked']);
    cur = res.state;
  }
  assert.equal(cur.cells[3][1], CAT);
  assert.equal(cur.cats.length, 1);
  assert.equal(cur.hearts, MAX_HEARTS);
});

test('nach Spielende ändert sich nichts mehr', () => {
  // gewonnen
  let won = createState();
  for (let row = 0; row < SIZE; row++) won = placeCat(won, row, SOLUTION[row]).state;
  // verloren
  let lost = createState();
  for (const { row, col } of wrongCells().slice(0, MAX_HEARTS)) lost = placeCat(lost, row, col).state;

  for (const state of [won, lost]) {
    const before = JSON.stringify(state);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const res = tapCell(state, row, col);
        assert.deepEqual(res.events, []);
        assert.equal(res.state, state);
      }
    }
    assert.equal(JSON.stringify(state), before);
  }
});

test('Tipps außerhalb des Felds werden ignoriert', () => {
  const state = createState();
  for (const [row, col] of [[-1, 0], [0, -1], [SIZE, 0], [0, SIZE]]) {
    const res = tapCell(state, row, col);
    assert.deepEqual(res.events, []);
    assert.equal(res.state, state);
  }
});

// Abstimmung der Schwierigkeit: eine unaufmerksame Gelegenheitsspielerin. Sie bemerkt jeden möglichen Schluss
// über eine Farbregion nur mit 50 % und jeden über eine Zeile/Spalte nur mit 25 % Wahrscheinlichkeit.
// Bemerkt sie keinen, rät sie blind irgendein Feld ohne ✕. Ziel laut Leitfaden: etwa 80 % Siege.
function simulate(seed, seeRegion = 0.5, seeLine = 0.25) {
  const rng = createRng(seed);
  let state = createState();
  while (state.status === 'playing') {
    const seen = logicalMoves(state).filter((m) => rng.chance(m.reason === 'region' ? seeRegion : seeLine));
    let cell = seen[0];
    if (!cell) {
      const open = [];
      for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (isOpen(state, row, col)) open.push({ row, col });
      cell = rng.pick(open);
    }
    state = placeCat(state, cell.row, cell.col).state;
  }
  return state.status === 'won';
}

test('Schwierigkeit: unaufmerksame Spielerin gewinnt in mindestens 80 % der Fälle', () => {
  const runs = 2000;
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) if (simulate(seed)) wins++;
  const rate = wins / runs;
  assert.ok(rate >= 0.8, `Siegquote ${rate}`);
  assert.ok(rate <= 0.97, `zu leicht für ein Rätsel? Siegquote ${rate}`);
});

test('Schwierigkeit: wer nur rät, verliert fast immer (die Herzen bedeuten etwas)', () => {
  const runs = 1000;
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) if (simulate(seed, 0, 0)) wins++;
  assert.ok(wins / runs < 0.25, `Siegquote beim Raten ${wins / runs}`);
});
