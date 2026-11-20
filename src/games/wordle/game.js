// Perlen-Rätsel (Kapitel 4): Wordle mit Freundschaftsarmband.
// Die Regeln stehen in logic.js, hier nur Darstellung, Eingabe und Animationen.

import { banner, createLoop, h, headEl, popWord, shake, sparkle } from '../kit.js';
import { BACK, ENTER, KEY_ROWS, MAX_TRIES, START_HINT, WORD_LENGTH, backspace, createState, normalizeLetter, submit, typeLetter } from './logic.js';

// --- Zeiten (ms) und Maße der Darstellung ---
const REVEAL_STEP = 290; // Abstand zwischen zwei Perlen beim Aufdecken
const FLIP_MS = 460; // Dreh-/Hüpf-Animation einer Perle (gleicher Wert wie g-wordle-flip in style.css)
const WIN_PAUSE = 150; // kurze Pause, bevor sich das Armband löst
const CURL_MS = 900; // Armband schließt sich zum Kreis
const WIN_BANNER_AFTER = 320; // Funkeln, dann Banner
const WIN_END_AFTER = 1050; // Banner steht, dann ctx.end(true)
const LOSE_BANNER_AFTER = 1050; // so lange ist die Lösung allein zu sehen
const LOSE_END_AFTER = 1000;
const BOARD_MAX_SCALE = 1.12; // das Raster wächst höchstens so weit über seine Grundgröße
const WIN_GROW = 1.3; // das geschlossene Armband ist etwas größer als die Zeile
const WIN_BEAD_GROW = 1.2; // und seine Perlen auch
const KEY_SLOP = 0.6; // em: Tipps knapp neben eine Taste zählen für die nächste Taste

const ICONS = {
  ENTER: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v7a2 2 0 0 1-2 2H6m0 0 4-4m-4 4 4 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  BACK: '<svg viewBox="0 0 28 24" aria-hidden="true"><path d="M10 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H10l-8-8z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="m14 9 6 6m0-6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
};
const KEY_LABELS = { ENTER: 'Eingabe', BACK: 'Löschen' };
const keyCode = (k) => (k === ENTER ? 'ENTER' : k === BACK ? 'BACK' : k);

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, cls) => {
  const el = document.createElementNS(SVG_NS, tag);
  el.setAttribute('class', cls);
  return el;
};
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const restart = (el, cls) => {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
};

// Eine Armband-Zeile: Schnur mit Knoten an beiden Enden, darauf die Perlen.
function braceletRow(word = '') {
  const chars = Array.from(word);
  const beads = Array.from({ length: WORD_LENGTH }, (_, i) => h('div.g-wordle-bead', h('b', chars[i] ?? '')));
  return { el: h('div.g-wordle-row', h('i.g-wordle-knot'), beads, h('i.g-wordle-knot')), beads };
}

export function createGame(ctx) {
  const { root, audio, assets } = ctx;
  let state = createState();
  let busy = false; // während Aufdecken und Schluss-Animation keine Eingabe
  let dead = false;
  let ended = false;
  let loop = null;
  let bannerEl = null;

  const timers = new Set();
  const after = (ms, fn) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
  };
  const sleep = (ms) => new Promise((resolve) => after(ms, resolve)); // löst nach destroy() nie mehr auf

  // --- Aufbau ---
  const rows = Array.from({ length: MAX_TRIES }, () => braceletRow());
  const board = h('div.g-wordle-board', rows.map((r) => r.el));
  const top = h('div.g-wordle-top', board);

  const hintText = h('p');
  const hintEl = h('div.g-wordle-hint', headEl(assets, 'janni', 'g-wordle-janni'), h('div.g-wordle-bubble', hintText));

  const keyEls = new Map();
  const keys = h(
    'div.g-wordle-keys',
    KEY_ROWS.map((row) =>
      h(
        'div.g-wordle-keyrow',
        Array.from(row).map((k) => {
          const code = keyCode(k);
          const el = ICONS[code]
            ? h('button.g-wordle-key.wide', { type: 'button', 'data-key': code, 'aria-label': KEY_LABELS[code], html: ICONS[code] })
            : h('button.g-wordle-key', { type: 'button', 'data-key': code }, h('b', k));
          keyEls.set(code, el);
          return el;
        }),
      ),
    ),
  );

  const wrap = h('div.g-wordle', top, hintEl, keys);
  root.append(wrap);

  // Das Raster nutzt die Höhe zwischen Oberkante und Tipp-Zeile: Schriftgröße so wählen, dass es genau passt.
  const fit = () => {
    board.style.fontSize = '';
    const w = board.offsetWidth;
    const bh = board.offsetHeight;
    if (!w || !bh) return;
    const k = Math.min(BOARD_MAX_SCALE, (top.clientWidth * 0.97) / w, top.clientHeight / bh);
    board.style.fontSize = Math.max(0.5, k).toFixed(3) + 'em';
  };
  const ro = new ResizeObserver(fit);
  ro.observe(top);
  fit();

  // --- Anzeige ---
  const emPx = () => parseFloat(getComputedStyle(wrap).fontSize) || 16;
  const localRect = (el) => {
    const base = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, cx: r.left - base.left + r.width / 2, cy: r.top - base.top + r.height / 2 };
  };

  function renderCurrent() {
    const playing = state.status === 'playing' && !busy;
    const index = state.rows.length;
    const chars = Array.from(state.current);
    rows.forEach((row, i) => row.el.classList.toggle('active', playing && i === index));
    if (index < MAX_TRIES && state.status === 'playing') {
      rows[index].beads.forEach((bead, i) => {
        bead.firstChild.textContent = chars[i] ?? '';
        bead.classList.toggle('filled', i < chars.length);
        bead.classList.toggle('cursor', playing && i === chars.length);
      });
    }
    keyEls.get('ENTER').classList.toggle('ready', playing && chars.length === WORD_LENGTH);
  }

  function paintKeys() {
    for (const [ch, mark] of Object.entries(state.keys)) {
      const el = keyEls.get(ch);
      if (!el) continue;
      el.classList.remove('hit', 'present', 'miss');
      el.classList.add(mark);
    }
  }

  function showHint(text, fresh) {
    if (!text) return;
    hintText.textContent = text;
    hintEl.classList.add('on');
    if (fresh) {
      restart(hintEl, 'fresh');
      audio.play('ping');
    }
  }

  // --- Eingabe ---
  function press(code) {
    if (dead || busy || state.status !== 'playing') return;
    if (code === 'ENTER') {
      enter();
      return;
    }
    if (code === 'BACK') {
      const next = backspace(state);
      if (next === state) return;
      state = next;
      audio.play('tap');
      renderCurrent();
      return;
    }
    const next = typeLetter(state, code);
    if (next === state) {
      // Zeile ist voll: die Eingabe-Taste winkt
      if (Array.from(state.current).length >= WORD_LENGTH) {
        const key = keyEls.get('ENTER');
        restart(key, 'nudge');
        after(420, () => key.classList.remove('nudge'));
      }
      return;
    }
    state = next;
    const pos = Array.from(state.current).length - 1;
    audio.play('bead', pos);
    renderCurrent();
    restart(rows[state.rows.length].beads[pos], 'pop');
  }

  async function enter() {
    const index = state.rows.length;
    const res = submit(state);
    if (!res.ok) {
      if (res.reason !== 'short') return;
      audio.play('no');
      shake(rows[index].el, emPx() * 0.4, 380);
      const r = localRect(rows[index].el);
      popWord(root, 'Noch zu kurz!', r.cx, r.y - emPx() * 0.2, { size: 1.5, color: '#FFD23F', rot: -4, life: 900 });
      return;
    }
    state = res.state;
    busy = true;
    renderCurrent();
    await reveal(index, res.marks);
    paintKeys();
    if (res.won) return win(index);
    if (res.lost) return lose();
    if (res.hint) showHint(res.hint.text, true);
    busy = false;
    renderCurrent();
  }

  // Perle für Perle aufdecken: hochhüpfen, auf die Kante drehen, in der neuen Farbe zurückdrehen.
  async function reveal(index, marks) {
    const { el, beads } = rows[index];
    el.classList.add('done');
    for (let i = 0; i < beads.length; i++) {
      const bead = beads[i];
      audio.play('reveal', i);
      bead.classList.remove('pop', 'cursor');
      bead.classList.add('flip');
      after(FLIP_MS / 2, () => {
        bead.classList.remove('filled');
        bead.classList.add(marks[i]);
      });
      await sleep(REVEAL_STEP);
    }
    await sleep(FLIP_MS - REVEAL_STEP + 140);
  }

  function finish(won) {
    if (ended || dead) return;
    ended = true;
    ctx.end(won);
  }

  // --- Gewonnen: Das Armband löst sich aus dem Raster und schließt sich zum Kreis ---
  async function win(index) {
    wrap.classList.add('over', 'won');
    await sleep(WIN_PAUSE);

    const row = rows[index];
    const first = localRect(row.beads[0]);
    const last = localRect(row.beads[WORD_LENGTH - 1]);
    const line = localRect(row.el);
    const size = first.w;
    const pitch0 = (last.cx - first.cx) / (WORD_LENGTH - 1);
    const from = { x: (first.cx + last.cx) / 2, y: first.cy };
    const overhang = Math.max(0, line.w / 2 - (WORD_LENGTH * pitch0) / 2); // Schnur-Enden jenseits der Perlen
    const radius = (WORD_LENGTH * pitch0 * WIN_GROW) / (2 * Math.PI);
    const em = emPx();
    const area = wrap.getBoundingClientRect();
    const boardBox = localRect(board);
    // Kreis über dem Raster, aber so hoch, dass das Banner in der Bildmitte frei bleibt
    const cx = area.width / 2;
    const cy = Math.max(radius + size + 2.6 * em, Math.min(boardBox.cy, area.height / 2 - 3.2 * em - radius - (size * WIN_BEAD_GROW) / 2));

    const cordOut = svgEl('path', 'g-wordle-cord-out');
    const cordIn = svgEl('path', 'g-wordle-cord-in');
    const cordTwist = svgEl('path', 'g-wordle-cord-twist');
    const cord = svgEl('svg', 'g-wordle-cord');
    cord.append(cordOut, cordIn, cordTwist);
    const fontPx = parseFloat(getComputedStyle(board).fontSize) || em;
    cordTwist.setAttribute('stroke-dasharray', `${(0.14 * fontPx).toFixed(2)} ${(0.3 * fontPx).toFixed(2)}`); // gedrehte Kordel wie im Raster
    const bow = h('i.g-wordle-bow');
    const loose = Array.from(state.rows[index].word).map((ch) => h('div.g-wordle-bead.g-wordle-loose.hit', h('b', ch)));
    const layer = h('div.g-wordle-finale', { style: { fontSize: fontPx + 'px' } }, cord, loose, bow);

    // u = 0: gerade Zeile im Raster, u = 1: geschlossener Kreis. Die Schnur wird wie ein Draht gebogen
    // (Krümmung wächst von 0 bis 2π / Länge), die Perlen sitzen in gleichen Abständen darauf.
    const mid = (WORD_LENGTH - 1) / 2;
    const place = (u, spin = 0) => {
      const pitch = pitch0 * (1 + (WIN_GROW - 1) * u);
      const length = WORD_LENGTH * pitch;
      const kappa = (u * 2 * Math.PI) / length;
      const ox = from.x + (cx - from.x) * u;
      const oy = from.y + (cy + radius - from.y) * u;
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      const at = (s) => {
        const x = kappa < 1e-5 ? ox + s : ox + Math.sin(kappa * s) / kappa;
        const y = kappa < 1e-5 ? oy : oy - (1 - Math.cos(kappa * s)) / kappa;
        if (!spin) return [x, y];
        return [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
      };
      const scale = 1 + (WIN_BEAD_GROW - 1) * u;
      loose.forEach((el, i) => {
        const [x, y] = at((i - mid) * pitch);
        el.style.transform = `translate(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px) scale(${scale.toFixed(3)})`;
      });
      const half = length / 2 + overhang * (1 - u);
      const pts = [];
      for (let j = 0; j <= 48; j++) {
        const [x, y] = at(-half + (2 * half * j) / 48);
        pts.push(x.toFixed(1) + ' ' + y.toFixed(1));
      }
      const d = 'M' + pts.join('L');
      cordOut.setAttribute('d', d);
      cordIn.setAttribute('d', d);
      cordTwist.setAttribute('d', d);
      const [bx, by] = at(half);
      bow.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
    };

    place(0);
    wrap.append(layer);
    row.el.classList.add('gone');
    audio.play('whoosh');
    loop = createLoop((_dt, t) => {
      const u = Math.min(1, (t * 1000) / CURL_MS);
      place(ease(u), u < 1 ? 0 : Math.sin((t - CURL_MS / 1000) * 2.6) * 0.08);
    });
    await sleep(CURL_MS);

    layer.classList.add('closed');
    audio.play('win');
    sparkle(root, cx, cy, 14);
    after(200, () => {
      audio.play('sparkle');
      sparkle(root, cx - radius, cy - radius * 0.5, 8);
    });
    after(430, () => sparkle(root, cx + radius, cy + radius * 0.4, 8));
    await sleep(WIN_BANNER_AFTER);
    bannerEl = banner(root, 'GESCHAFFT!', 'win');
    after(250, () => sparkle(root, cx, cy - radius, 8));
    await sleep(WIN_END_AFTER);
    finish(true);
  }

  // --- Verloren: Die Lösung kurz als Armband zeigen ---
  async function lose() {
    wrap.classList.add('over', 'lost');
    audio.play('lose');
    shake(board, emPx() * 0.3, 420);
    const solution = braceletRow(state.solution);
    solution.beads.forEach((bead) => bead.classList.add('hit'));
    const card = h('div.g-wordle-solution', h('p', 'Es wäre'), solution.el, h('p', 'gewesen.'));
    const em = emPx();
    const area = wrap.getBoundingClientRect();
    // über dem Raster, aber oberhalb der Bildmitte, damit das Banner Platz hat
    card.style.top = Math.min(localRect(board).cy, area.height / 2 - 8.6 * em) + 'px';
    wrap.append(card);
    await sleep(LOSE_BANNER_AFTER);
    bannerEl = banner(root, 'SCHADE!', 'lose');
    await sleep(LOSE_END_AFTER);
    finish(false);
  }

  // --- Zeiger und Tastatur ---
  function keyAt(e) {
    const direct = e.target instanceof Element ? e.target.closest('.g-wordle-key') : null;
    if (direct) return direct;
    // knapp daneben getippt (Lücke zwischen zwei Tasten): die nächste Taste nehmen
    let best = null;
    let bestDist = Infinity;
    for (const el of keyEls.values()) {
      const r = el.getBoundingClientRect();
      const dist = Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
      if (dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    }
    return bestDist <= emPx() * KEY_SLOP ? best : null;
  }
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const el = keyAt(e);
    if (!el) return;
    el.classList.add('down');
    after(140, () => el.classList.remove('down'));
    press(el.dataset.key);
  };
  // Am Rechner (Debug) geht auch die echte Tastatur.
  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.key === 'Enter' ? 'ENTER' : e.key === 'Backspace' ? 'BACK' : normalizeLetter(e.key);
    if (!code) return;
    e.preventDefault();
    press(code);
  };
  keys.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('keydown', onKeyDown);

  showHint(START_HINT, false);
  renderCurrent();

  const debugApi = { state: () => state, busy: () => busy, press };
  if (ctx.debug) globalThis.__game = debugApi;

  return {
    destroy() {
      dead = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      loop?.stop();
      ro.disconnect();
      keys.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      bannerEl?.remove();
      wrap.remove();
      if (globalThis.__game === debugApi) delete globalThis.__game;
    },
  };
}
