// Meowdoku (Kapitel 2 „Kater an Bord!“): reine Spiellogik ohne DOM.
//
// Queens-Prinzip: pro Zeile, Spalte und Farbregion genau ein Kater, Kater berühren sich nicht
// (auch nicht diagonal). Das Rätsel ist fest vorgegeben; die Tests belegen, dass es genau eine Lösung
// hat und sich allein mit den einfachen Schlüssen aus solveByLogic() lösen lässt.

// --- Stellschrauben ---
export const SIZE = 6;
export const MAX_HEARTS = 3;
// Nach so vielen Sekunden ohne Tipp schimmert ein Feld, das sich sicher erschließen lässt (0 = kein Hinweis).
export const HINT_AFTER_S = 30;

// Sitzplan: jeder Buchstabe ist eine Polsterfarbe. D und F (je 1 Feld) und A (2 Felder) sind der
// leichte Einstieg, danach ergibt sich jeder Kater aus „in dieser Farbe bleibt nur noch ein Feld“.
//
//   A A B B B B
//   C C C D B B
//   C C C C B B
//   E F E C B B
//   E E E C C B
//   E E E E E E
export const REGIONS = ['AABBBB', 'CCCDBB', 'CCCCBB', 'EFECBB', 'EEECCB', 'EEEEEE'];

// Spalte des Katers je Zeile (die einzige Lösung, siehe Test).
export const SOLUTION = [0, 3, 5, 1, 4, 2];

// Die Kater wechseln sich ab.
export const CATS = ['franks', 'findi'];

// --- Zellzustände ---
export const EMPTY = 'empty'; // frei
export const MARK = 'mark'; // ✕ von Hand (Merkhilfe)
export const AUTO = 'auto'; // ✕ automatisch, weil ein sitzender Kater das Feld ausschließt
export const BAD = 'bad'; // ✕ rot: hier hat ein Kater gefaucht, sicher kein Platz
export const CAT = 'cat'; // Kater sitzt richtig und bleibt

const key = (row, col) => row * SIZE + col;
const inside = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;

export const regionAt = (regions, row, col) => regions[row][col];

// Buchstaben der Regionen in Lesereihenfolge.
export function regionIds(regions) {
  const ids = [];
  for (const line of regions) for (const ch of line) if (!ids.includes(ch)) ids.push(ch);
  return ids;
}

// Alle Felder einer Region als { row, col }.
export function regionCells(regions, id) {
  const cells = [];
  for (let row = 0; row < regions.length; row++) {
    for (let col = 0; col < regions[row].length; col++) if (regions[row][col] === id) cells.push({ row, col });
  }
  return cells;
}

// Hängt die Region über Kanten zusammen?
export function isConnected(regions, id) {
  const cells = regionCells(regions, id);
  if (!cells.length) return false;
  const todo = [cells[0]];
  const seen = new Set([key(cells[0].row, cells[0].col)]);
  while (todo.length) {
    const { row, col } = todo.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = row + dr;
      const c = col + dc;
      if (regions[r]?.[c] !== id || seen.has(key(r, c))) continue;
      seen.add(key(r, c));
      todo.push({ row: r, col: c });
    }
  }
  return seen.size === cells.length;
}

// Berühren sich zwei Felder (auch diagonal)?
export const touches = (r1, c1, r2, c2) => Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && !(r1 === r2 && c1 === c2);

// Schließt ein Kater auf (r1, c1) das Feld (r2, c2) aus?
export function excludes(regions, r1, c1, r2, c2) {
  if (r1 === r2 && c1 === c2) return false;
  return r1 === r2 || c1 === c2 || regions[r1][c1] === regions[r2][c2] || touches(r1, c1, r2, c2);
}

// Alle Felder, die ein Kater auf (row, col) ausschließt: Zeile, Spalte, Region und die 8 Nachbarn.
export function excludedBy(regions, row, col) {
  const out = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (excludes(regions, row, col, r, c)) out.push({ row: r, col: c });
  }
  return out;
}

// cols[row] = Spalte des Katers. Prüft alle vier Regeln.
export function isValidSolution(regions, cols) {
  if (!Array.isArray(cols) || cols.length !== SIZE) return false;
  const usedCols = new Set();
  const usedRegions = new Set();
  for (let row = 0; row < SIZE; row++) {
    const col = cols[row];
    if (!Number.isInteger(col) || !inside(row, col)) return false;
    if (usedCols.has(col) || usedRegions.has(regions[row][col])) return false;
    if (row > 0 && Math.abs(col - cols[row - 1]) <= 1) return false;
    usedCols.add(col);
    usedRegions.add(regions[row][col]);
  }
  return usedRegions.size === regionIds(regions).length;
}

// Alle Lösungen per Backtracking (Zeile für Zeile).
export function solve(regions) {
  const solutions = [];
  const cols = [];
  const usedCols = new Set();
  const usedRegions = new Set();
  const place = (row) => {
    if (row === SIZE) {
      solutions.push([...cols]);
      return;
    }
    for (let col = 0; col < SIZE; col++) {
      const region = regions[row][col];
      if (usedCols.has(col) || usedRegions.has(region)) continue;
      if (row > 0 && Math.abs(col - cols[row - 1]) <= 1) continue;
      cols.push(col);
      usedCols.add(col);
      usedRegions.add(region);
      place(row + 1);
      cols.pop();
      usedCols.delete(col);
      usedRegions.delete(region);
    }
  };
  place(0);
  return solutions;
}

// Alle Einheiten (Regionen, Zeilen, Spalten) mit ihren Feldern.
function units(regions) {
  const list = regionIds(regions).map((id) => ({ kind: 'region', id, cells: regionCells(regions, id) }));
  for (let i = 0; i < SIZE; i++) {
    list.push({ kind: 'row', id: i, cells: Array.from({ length: SIZE }, (_, col) => ({ row: i, col })) });
    list.push({ kind: 'col', id: i, cells: Array.from({ length: SIZE }, (_, row) => ({ row, col: i })) });
  }
  return list;
}

// Felder, die sich mit dem einfachen Schluss „in dieser Region/Zeile/Spalte bleibt nur noch ein Feld“
// sicher bestimmen lassen. open(row, col) sagt, ob ein Feld noch in Frage kommt; cats sind die sitzenden Kater.
export function forcedCells(regions, open, cats) {
  const found = new Map();
  for (const unit of units(regions)) {
    if (unit.cells.some((a) => cats.some((b) => a.row === b.row && a.col === b.col))) continue;
    const left = unit.cells.filter((a) => open(a.row, a.col));
    if (left.length === 1 && !found.has(key(left[0].row, left[0].col))) found.set(key(left[0].row, left[0].col), { ...left[0], reason: unit.kind });
  }
  return [...found.values()];
}

// Löst nur mit den Anfänger-Schlüssen: ausstreichen, was ein gesetzter Kater ausschließt, und
// „nur noch ein Feld in Region/Zeile/Spalte“. Rückgabe: { solved, cols, steps, minChoices }.
// steps: Reihenfolge der Schlüsse; minChoices: wie viele sichere Felder es im engsten Moment gab.
export function solveByLogic(regions) {
  const open = Array.from({ length: SIZE }, () => Array(SIZE).fill(true));
  const cats = [];
  const steps = [];
  let minChoices = Infinity;
  while (cats.length < SIZE) {
    const forced = forcedCells(regions, (r, c) => open[r][c], cats);
    if (!forced.length) break;
    minChoices = Math.min(minChoices, forced.length);
    const { row, col, reason } = forced[0];
    cats.push({ row, col });
    steps.push({ row, col, reason });
    open[row][col] = false;
    for (const cell of excludedBy(regions, row, col)) open[cell.row][cell.col] = false;
  }
  const cols = Array(SIZE).fill(-1);
  for (const cat of cats) cols[cat.row] = cat.col;
  const solved = cats.length === SIZE && isValidSolution(regions, cols);
  return { solved, cols, steps, minChoices: steps.length ? minChoices : 0 };
}

// --- Spielzustand ---

export function createState({ regions = REGIONS, solution = SOLUTION, hearts = MAX_HEARTS } = {}) {
  return {
    regions,
    solution,
    cells: Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY)),
    cats: [], // { row, col, who } in Sitz-Reihenfolge
    hearts,
    maxHearts: hearts,
    status: 'playing', // 'playing' | 'won' | 'lost'
  };
}

// Welcher Kater ist als Nächstes dran?
export const nextCat = (state) => CATS[state.cats.length % CATS.length];

// Felder, die noch in Frage kommen (frei oder nur von Hand markiert).
export const isOpen = (state, row, col) => state.cells[row][col] === EMPTY || state.cells[row][col] === MARK;

// Ein Tipp auf ein Feld. Reine Funktion: gibt { state, events } zurück, der alte Zustand bleibt unberührt.
//
//   leer → ✕ (mark) → Kater. Der Kater wird sofort geprüft:
//     richtig: cat-ok, der Kater sitzt fest, alle ausgeschlossenen Felder bekommen ein Auto-✕ (ev.auto)
//     falsch:  cat-wrong, ein Herz weg, das Feld wird zum roten ✕
//   won / lost folgen als zweites Ereignis. Feste Kater, Auto-✕ und rote ✕ melden nur 'locked'.
//
// Der Schritt „Kater → leer“ (clear) kommt nicht vor, weil kein ungeprüfter Kater stehen bleibt.
export function tapCell(state, row, col) {
  if (state.status !== 'playing' || !inside(row, col)) return { state, events: [] };
  const cell = state.cells[row][col];
  if (cell === CAT || cell === AUTO || cell === BAD) return { state, events: [{ type: 'locked', row, col, cell }] };

  const cells = state.cells.map((line) => [...line]);
  if (cell === EMPTY) {
    cells[row][col] = MARK;
    return { state: { ...state, cells }, events: [{ type: 'mark', row, col }] };
  }

  const who = nextCat(state);
  if (state.solution[row] !== col) {
    cells[row][col] = BAD;
    const hearts = state.hearts - 1;
    const lost = hearts <= 0;
    const events = [{ type: 'cat-wrong', row, col, who, hearts }];
    if (lost) events.push({ type: 'lost' });
    return { state: { ...state, cells, hearts, status: lost ? 'lost' : 'playing' }, events };
  }

  cells[row][col] = CAT;
  const auto = [];
  for (const other of excludedBy(state.regions, row, col)) {
    const before = cells[other.row][other.col];
    if (before !== EMPTY && before !== MARK) continue;
    cells[other.row][other.col] = AUTO;
    auto.push(other);
  }
  const cats = [...state.cats, { row, col, who }];
  const won = cats.length === SIZE;
  const events = [{ type: 'cat-ok', row, col, who, auto, cats: cats.length }];
  if (won) events.push({ type: 'won' });
  return { state: { ...state, cells, cats, status: won ? 'won' : 'playing' }, events };
}

// Ein sicheres nächstes Feld für den aktuellen Spielstand (für Tests und die Browser-Probe).
export function logicalMoves(state) {
  return forcedCells(state.regions, (r, c) => isOpen(state, r, c), state.cats);
}
