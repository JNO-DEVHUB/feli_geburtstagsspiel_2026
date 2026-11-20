// Meowdoku (Kapitel 2 „Kater an Bord!“): Darstellung und Eingabe. Die Regeln stehen in logic.js.
import { banner, burst, createHud, h, headEl, onTap, popWord, shake } from '../kit.js';
import { HINT_AFTER_S, MAX_HEARTS, REGIONS, SIZE, SOLUTION, createState, logicalMoves, tapCell } from './logic.js';

// Zeiten in Millisekunden
const HISS_MS = 620; // so lange faucht ein falscher Kater, bevor er weghüpft
const WIN_PARTY_MS = 400; // Pause vor dem Jubel
const BANNER_MS = 350; // Banner kommt kurz nach Jubel/Flucht
const END_MS = 1300; // vom Jubel/der Flucht bis ctx.end()

// Mini-Beispiele der Regel-Erklärung: regions wie in logic.js, cats = [Zeile, Spalte, wer]
const TUT_BAD = [
  { text: 'Zwei in einer Zeile', regions: ['AAB', 'CAB', 'CCB'], cats: [[0, 0, 'franks'], [0, 2, 'findi']] },
  { text: 'Zwei in einer Spalte', regions: ['AAB', 'CCB', 'CDD'], cats: [[0, 1, 'findi'], [2, 1, 'franks']] },
  { text: 'Zwei auf einer Farbe', regions: ['AAA', 'BBA', 'BCA'], cats: [[0, 0, 'franks'], [2, 2, 'findi']] },
  { text: 'Berühren sich diagonal', regions: ['ABB', 'AAB', 'CCC'], cats: [[1, 0, 'findi'], [2, 1, 'franks']] },
];
const TUT_GOOD = { regions: ['AABB', 'AABB', 'CCDD', 'CCDD'], cats: [[0, 1, 'franks'], [1, 3, 'findi'], [2, 0, 'findi'], [3, 2, 'franks']] };

export function createGame(ctx) {
  const { audio, assets } = ctx;
  let state = createState();
  let alive = true;
  let started = false; // Regel-Erklärung vorbei
  let ended = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
  };

  // --- Aufbau ---
  const wrap = h('div.g-meowdoku');
  const hud = createHud(wrap);
  hud.setHearts(state.hearts, MAX_HEARTS);

  const count = h('div.g-meowdoku-count');
  const board = h('div.g-meowdoku-board');
  board.style.setProperty('--n', SIZE);
  const cells = [];
  for (let row = 0; row < SIZE; row++) {
    cells.push([]);
    for (let col = 0; col < SIZE; col++) {
      const el = h('button.g-meowdoku-cell', { type: 'button', 'data-row': row, 'data-col': col, 'data-state': 'empty', 'aria-label': `Zeile ${row + 1}, Platz ${col + 1}` });
      el.className += ' ' + cellClasses(REGIONS, row, col);
      cells[row].push(el);
      board.append(el);
    }
  }
  const legend = h(
    'div.g-meowdoku-legend',
    h('span', h('b', '1×'), ' tippen = ', h('i.g-meowdoku-key.x')),
    h('span', h('b', '2×'), ' tippen = ', h('i.g-meowdoku-key', headEl(assets, 'franks'))),
  );
  const card = h('div.g-meowdoku-card', count, board, legend);
  wrap.append(card);
  ctx.root.append(wrap);

  const center = (el) => {
    const a = el.getBoundingClientRect();
    const b = wrap.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width, rootW: b.width };
  };

  const word = (text, x, y, opts) => popWord(wrap, text, x, y, opts).style.setProperty('--rot', (opts.rot ?? -8) + 'deg');

  function setCount() {
    const n = state.cats.length;
    count.replaceChildren(h('b', String(n)), ` von ${SIZE} Katern sitzen`);
    count.classList.toggle('done', n === SIZE);
  }
  setCount();

  const paint = (row, col) => {
    cells[row][col].dataset.state = state.cells[row][col];
  };

  // --- Hinweis: nach längerem Stillstand schimmert ein Feld, das sich sicher erschließen lässt ---
  let hintTimer = 0;
  let hintEl = null;
  function showHint() {
    const moves = logicalMoves(state);
    const move = moves.find((m) => m.reason === 'region') ?? moves[0];
    if (!move || !started || ended || !alive) return;
    hintEl?.classList.remove('hint');
    hintEl = cells[move.row][move.col];
    hintEl.classList.add('hint');
  }
  function armHint() {
    clearTimeout(hintTimer);
    hintEl?.classList.remove('hint');
    hintEl = null;
    if (HINT_AFTER_S > 0 && !ended && alive) hintTimer = setTimeout(showHint, HINT_AFTER_S * 1000);
  }

  // --- Eingabe ---
  function tap(row, col) {
    if (!started || ended || !alive) return;
    const res = tapCell(state, row, col);
    state = res.state;
    for (const ev of res.events) handle(ev);
    armHint();
  }

  function handle(ev) {
    if (ev.type === 'mark') {
      paint(ev.row, ev.col);
      audio.play('mark');
    } else if (ev.type === 'locked') {
      const el = cells[ev.row][ev.col];
      el.classList.remove('nudge');
      void el.offsetWidth;
      el.classList.add('nudge');
      audio.play('tick');
    } else if (ev.type === 'cat-ok') {
      const el = cells[ev.row][ev.col];
      el.append(headEl(assets, ev.who, 'g-meowdoku-cat hop'));
      paint(ev.row, ev.col);
      for (const other of ev.auto) {
        const o = cells[other.row][other.col];
        o.style.setProperty('--d', Math.round(Math.hypot(other.row - ev.row, other.col - ev.col) * 45) + 'ms');
        paint(other.row, other.col);
      }
      setCount();
      audio.play('meow');
      const p = center(el);
      if (ev.cats < SIZE) word('MIAU!', p.x, p.y - p.w * 0.75, { color: '#FFD23F', size: 1.5, rot: ev.cats % 2 ? -8 : 7, life: 800 });
    } else if (ev.type === 'cat-wrong') {
      const el = cells[ev.row][ev.col];
      const cat = headEl(assets, ev.who, 'g-meowdoku-cat hiss');
      cat.style.setProperty('--fx', (ev.col < SIZE / 2 ? 1 : -1) * 90 + '%');
      el.dataset.state = 'hiss';
      el.append(cat);
      hud.setHearts(ev.hearts, MAX_HEARTS);
      audio.play('hiss');
      const p = center(el);
      const x = Math.max(p.w * 1.4, Math.min(p.rootW - p.w * 1.4, p.x));
      word('FAUCH!', x, p.y - p.w * 0.8, { color: '#E5484D', size: 2.3, rot: ev.col < SIZE / 2 ? -9 : 9 });
      shake(card, 5, 320);
      later(() => {
        cat.remove();
        paint(ev.row, ev.col);
      }, HISS_MS);
    } else if (ev.type === 'won') {
      finish(true);
    } else if (ev.type === 'lost') {
      finish(false);
    }
  }

  // pointerdown statt click: Beim schnellen Doppeltipp (✕ → Kater) verschluckt der Browser sonst den zweiten Klick.
  const onDown = (e) => {
    if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.target.closest?.('.g-meowdoku-cell');
    if (!el) return;
    e.preventDefault();
    tap(Number(el.dataset.row), Number(el.dataset.col));
  };
  board.addEventListener('pointerdown', onDown);

  // --- Ende ---
  function finish(won) {
    ended = true;
    wrap.classList.add('over');
    const sitting = () => [...board.querySelectorAll('.g-meowdoku-cat:not(.hiss)')];
    if (won) {
      later(() => {
        sitting().forEach((cat, i) => {
          cat.style.setProperty('--d', i * 90 + 'ms');
          cat.classList.remove('hop');
          cat.classList.add('party');
        });
        audio.play('win');
        const p = center(board);
        burst(wrap, p.x, p.y, { count: 44, spread: 200 });
        burst(wrap, p.x - p.w * 0.3, p.y - p.w * 0.25, { count: 16 });
        burst(wrap, p.x + p.w * 0.3, p.y - p.w * 0.25, { count: 16 });
        word('SCHNURR!', p.x, p.y + p.w * 0.36, { color: '#FFD23F', size: 2, rot: 5, life: 1200 });
        later(() => banner(wrap, 'GESCHAFFT!', 'win'), BANNER_MS);
        later(() => ctx.end(true), END_MS);
      }, WIN_PARTY_MS);
    } else {
      later(() => {
        sitting().forEach((cat, i) => {
          const dir = ctx.rng.chance(0.5) ? 1 : -1;
          cat.style.setProperty('--fx', dir * ctx.rng.range(180, 420) + '%');
          cat.style.setProperty('--fy', -ctx.rng.range(160, 420) + '%');
          cat.style.setProperty('--fr', dir * ctx.rng.range(120, 540) + 'deg');
          cat.style.setProperty('--d', i * 70 + 'ms');
          cat.classList.remove('hop');
          cat.classList.add('flee');
        });
        audio.play('lose');
        shake(card, 7, 420);
        later(() => banner(wrap, 'CHAOS IM ABTEIL!', 'lose'), BANNER_MS);
        later(() => ctx.end(false), END_MS);
      }, HISS_MS + 60);
    }
  }

  // --- Regel-Erklärung (2 Bildschirme) ---
  let page = 0;
  const tutBody = h('div.g-meowdoku-tut-body');
  const dots = h('div.g-meowdoku-dots', h('i'), h('i'));
  const next = h('button.btn.g-meowdoku-next', { type: 'button' }, 'Weiter');
  const skip = h('button.linkbtn.g-meowdoku-skip', { type: 'button' }, 'Überspringen');
  const tut = h('div.g-meowdoku-tut', h('div.g-meowdoku-tut-card', h('small', 'So geht’s'), tutBody, dots, h('div.g-meowdoku-tut-btns', skip, next)));
  wrap.append(tut);

  function showPage(n) {
    page = n;
    tutBody.replaceChildren(...(n === 0 ? pageNo(assets) : pageYes(assets)));
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === n));
    next.textContent = n === 0 ? 'Weiter' : 'Los!';
    skip.hidden = n !== 0;
  }
  function startPuzzle() {
    if (started) return;
    started = true;
    tut.remove();
    armHint();
  }
  onTap(next, () => {
    audio.play('tap');
    if (page === 0) showPage(1);
    else startPuzzle();
  });
  onTap(skip, () => {
    audio.play('tap');
    startPuzzle();
  });
  showPage(0);

  // Für die Browser-Probe (?debug=1)
  let debugApi = null;
  if (ctx.debug) {
    debugApi = {
      id: 'meowdoku',
      solution: SOLUTION,
      regions: REGIONS,
      state: () => state,
      started: () => started,
      ended: () => ended,
      skipTutorial: startPuzzle,
      tap,
      hint: () => logicalMoves(state)[0] ?? null,
      showHint,
    };
    globalThis.__game = debugApi;
  }

  return {
    destroy() {
      alive = false;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      clearTimeout(hintTimer);
      board.removeEventListener('pointerdown', onDown);
      hud.destroy();
      wrap.remove();
      if (debugApi && globalThis.__game === debugApi) delete globalThis.__game;
    },
  };
}

// Farbklasse und dicke Linien an den Regionsgrenzen (t/r/b/l), damit es nicht nur an der Farbe hängt.
function cellClasses(regions, row, col) {
  const id = regions[row][col];
  const differs = (r, c) => regions[r]?.[c] !== undefined && regions[r][c] !== id;
  const list = ['r-' + id];
  if (differs(row - 1, col)) list.push('bt');
  if (differs(row, col + 1)) list.push('br');
  if (differs(row + 1, col)) list.push('bb');
  if (differs(row, col - 1)) list.push('bl');
  return list.join(' ');
}

// Kleines Beispielbrett ohne Eingabe. kind 'no': die beiden Streithähne werden rot eingekreist und verbunden.
function miniBoard(assets, { regions, cats }, kind) {
  const el = h('div.g-meowdoku-mini.' + kind);
  el.style.setProperty('--n', regions.length);
  regions.forEach((line, row) => {
    [...line].forEach((_, col) => {
      const cell = h('div.g-meowdoku-cell');
      cell.className += ' ' + cellClasses(regions, row, col);
      const cat = cats.find(([r, c]) => r === row && c === col);
      if (cat && kind === 'no') cell.append(h('i.g-meowdoku-ring'));
      if (cat) cell.append(headEl(assets, cat[2], 'g-meowdoku-cat'));
      el.append(cell);
    });
  });
  if (kind === 'no') {
    const [[r1, c1], [r2, c2]] = cats;
    const line = h('i.g-meowdoku-clash');
    line.style.setProperty('--x', c1 + 0.5);
    line.style.setProperty('--y', r1 + 0.5);
    line.style.setProperty('--len', Math.hypot(r2 - r1, c2 - c1));
    line.style.setProperty('--rot', Math.atan2(r2 - r1, c2 - c1) + 'rad');
    el.append(line);
  }
  return h('div.g-meowdoku-mini-wrap.' + kind, el, h('i.g-meowdoku-badge', kind === 'no' ? '✕' : '✓'));
}

function pageNo(assets) {
  return [h('h2.no', 'So nicht!'), h('div.g-meowdoku-examples.four', TUT_BAD.map((ex) => h('figure', miniBoard(assets, ex, 'no'), h('figcaption', ex.text))))];
}

function pageYes(assets) {
  return [
    h('h2.yes', 'So ja!'),
    h('div.g-meowdoku-examples', h('figure', miniBoard(assets, TUT_GOOD, 'yes'), h('figcaption', 'Jede Zeile, Spalte und Farbe hat genau einen Kater. Keiner berührt den anderen.'))),
    h(
      'div.g-meowdoku-steps',
      h('i.g-meowdoku-key'),
      h('span.arrow', '➜'),
      h('i.g-meowdoku-key.x'),
      h('span.arrow', '➜'),
      h('i.g-meowdoku-key', headEl(assets, 'findi')),
    ),
    h('p', h('b', 'Einmal'), ' tippen = ✕ als Merkhilfe. ', h('b', 'Nochmal'), ' tippen = Kater.'),
    h('p.warn', 'Falscher Platz? Dann faucht er,', h('br'), 'und ein ❤ ist weg!'),
  ];
}
