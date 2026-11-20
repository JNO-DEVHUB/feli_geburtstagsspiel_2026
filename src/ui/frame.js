// Bilderrahmen: goldener Rahmen mit dem 2×3-Puzzle, daneben die sechs Hinweisfelder.
// Nach jedem Spiel fliegt das gewonnene Teil ein oder das verlorene zerbröselt.

import { CHAPTERS, FRAME, HALL } from '../content.js';
import { charEl } from '../render/chars.js';
import { h, onTap, wait } from './dom.js';
import { burst, popWord, shake, sparkle } from './fx.js';
import { COLS, PIECES, ROWS, makePieceCanvas, pieceCell } from './puzzle.js';

// Rahmen-Ansicht (auch im Finale und im Spielesaal benutzt).
// results: Array(6) mit true/false/null. Nach dem Einhängen layout() aufrufen.
export function createFrameView(app, results) {
  const inner = h('div.frame-inner');
  const box = h('div.frame-box', inner);
  const hints = h('div.hints');
  const chips = CHAPTERS.map((c, i) => {
    const chip = h('div.hint', h('i', String(i + 1)), h('b'));
    hints.append(chip);
    return chip;
  });
  const el = h('div.frame-wrap', box, hints);
  const img = app.assets.img('puzzle');
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  inner.style.aspectRatio = `${iw} / ${ih}`;
  const pieces = Array(PIECES).fill(null);
  let cw = 0;
  let ch = 0;

  function setHint(i, state) {
    const chip = chips[i];
    chip.classList.toggle('on', state === true);
    chip.classList.toggle('lost', state === false);
    chip.lastChild.textContent = state === true ? CHAPTERS[i].hint : state === false ? FRAME.unknown : '';
  }

  function place(i, { ghost = false } = {}) {
    const { col, row } = pieceCell(i);
    const { canvas, margin } = makePieceCanvas(img, i, cw, ch, { ghost });
    canvas.className = ghost ? 'piece ghost' : 'piece';
    canvas.style.left = col * cw - margin + 'px';
    canvas.style.top = row * ch - margin + 'px';
    inner.append(canvas);
    return canvas;
  }

  return {
    el,
    box,
    inner,
    // exclude: Index, der (noch) nicht gezeichnet wird, weil er gleich animiert einfliegt
    layout({ exclude = -1 } = {}) {
      inner.replaceChildren();
      cw = inner.clientWidth / COLS;
      ch = inner.clientHeight / ROWS;
      for (let i = 0; i < PIECES; i++) place(i, { ghost: true });
      for (let i = 0; i < PIECES; i++) {
        if (i === exclude) {
          setHint(i, null);
          continue;
        }
        if (results[i] === true) pieces[i] = place(i);
        setHint(i, results[i]);
      }
    },
    addPiece(i) {
      pieces[i]?.remove();
      pieces[i] = place(i);
      return pieces[i];
    },
    setHint,
    pieces,
    // Mittelpunkt eines Feldes relativ zu inner
    cellCenter(i) {
      const { col, row } = pieceCell(i);
      return { x: (col + 0.5) * cw, y: (row + 0.5) * ch };
    },
  };
}

// Teil fliegt groß herein, dreht sich und rastet ein.
export async function flyIn(app, view, stage, i, { delay = 0 } = {}) {
  const canvas = view.addPiece(i);
  canvas.classList.add('flying');
  const sr = stage.getBoundingClientRect();
  const ir = view.inner.getBoundingClientRect();
  const c = view.cellCenter(i);
  const dx = sr.left + sr.width / 2 - (ir.left + c.x);
  const dy = sr.top + sr.height * 0.42 - (ir.top + c.y);
  const big = Math.min(2.6, (sr.width * 0.62) / canvas.offsetWidth);
  if (canvas.animate) {
    app.audio.play('whoosh');
    await canvas.animate(
      [
        { transform: `translate(${dx}px,${dy}px) scale(0) rotate(-200deg)`, offset: 0 },
        { transform: `translate(${dx}px,${dy}px) scale(${big}) rotate(0deg)`, offset: 0.28 },
        { transform: `translate(${dx}px,${dy}px) scale(${big}) rotate(360deg)`, offset: 0.62 },
        { transform: 'translate(0,0) scale(1) rotate(720deg)', offset: 1 },
      ],
      { duration: 2100, delay, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'backwards' },
    ).finished.catch(() => {});
  }
  canvas.classList.remove('flying');
  app.audio.play('klack');
  shake(view.box, 4, 220);
  sparkle(stage, ir.left - sr.left + c.x, ir.top - sr.top + c.y, 12);
  setTimeout(() => app.audio.play('sparkle'), 120);
  view.setHint(i, true);
}

// Teil wird kurz gezeigt und zerbröselt.
async function crumble(app, view, stage, i) {
  const canvas = view.addPiece(i);
  view.pieces[i] = null;
  canvas.classList.add('flying');
  const sr = stage.getBoundingClientRect();
  const ir = view.inner.getBoundingClientRect();
  const c = view.cellCenter(i);
  const dx = sr.left + sr.width / 2 - (ir.left + c.x);
  const dy = sr.top + sr.height * 0.42 - (ir.top + c.y);
  const big = Math.min(2.6, (sr.width * 0.62) / canvas.offsetWidth);
  const at = `translate(${dx}px,${dy}px)`;
  if (canvas.animate) {
    await canvas.animate(
      [
        { transform: `${at} scale(0)`, filter: 'grayscale(0)' },
        { transform: `${at} scale(${big}) rotate(0deg)`, offset: 0.35 },
        { transform: `${at} scale(${big}) rotate(-5deg)`, offset: 0.55 },
        { transform: `${at} scale(${big}) rotate(5deg)`, offset: 0.7 },
        { transform: `${at} scale(${big}) rotate(-6deg)`, offset: 0.85 },
        { transform: `${at} scale(${big * 0.96}) rotate(0deg)`, filter: 'grayscale(.8)' },
      ],
      { duration: 1500, easing: 'ease-out', fill: 'forwards' },
    ).finished.catch(() => {});
  }
  const x = sr.width / 2;
  const y = sr.height * 0.42;
  app.audio.play('puff');
  popWord(stage, FRAME.lostWord, x, y, { size: 3.6, color: '#7A6457', life: 1200 });
  burst(stage, x, y, { count: 40, colors: ['#B9A58F', '#8a7767', '#E6D3B8', '#5d4a3e'], spread: 190, gravity: 420, size: 11 });
  canvas.remove();
  view.setHint(i, false);
  await wait(500);
}

// Bildschirm nach einem Spiel.
// mode 'run': erster Durchlauf (Weiter). mode 'hall': Spielesaal (Nochmal / Zurück).
// outcome: 'won' (Teil neu gewonnen) | 'lost' (Teil verloren) | 'again' (im Saal gewonnen, Teil schon da) | 'miss' (im Saal verloren)
export function mountFrame(root, app, { chapter, outcome, mode = 'run', animate = true, onNext, onAgain }) {
  const results = app.store.get().results;
  const ch = CHAPTERS[chapter];
  const won = outcome === 'won' || outcome === 'again';
  const view = createFrameView(app, results);
  const title = h('div.frame-title', { class: won ? 'frame-title' : 'frame-title lost' }, outcome === 'won' ? FRAME.won : outcome === 'lost' ? FRAME.lost : outcome === 'again' ? 'Gewonnen! Das Teil hast du schon.' : "Verloren … Versuch's nochmal!");
  const text = h('p.bubble-text', won ? ch.outroWin : ch.outroLose);
  const bubble = h('div.bubble.frame-bubble', h('b.bubble-name', 'Janni'), text);
  const janni = charEl(app.assets, 'janni', 'anzug', { className: 'frame-janni' });
  const next = h('button.btn', mode === 'run' ? FRAME.next : HALL.back);
  const again = mode === 'hall' ? h('button.btn.ghost', HALL.again) : null;
  const actions = h('div.frame-actions', again, next);
  const screen = h('div.screen.frame-screen', title, view.el, h('div.frame-talk', janni, bubble), actions);
  root.append(screen);
  let alive = true;

  onTap(next, () => {
    app.audio.play('tap');
    onNext();
  });
  if (again) onTap(again, () => { app.audio.play('tap'); onAgain(); });

  (async () => {
    const animated = animate && (outcome === 'won' || outcome === 'lost');
    view.layout({ exclude: animated ? chapter : -1 });
    if (animated) {
      actions.classList.add('waiting');
      bubble.classList.add('waiting');
      await wait(350);
      if (!alive) return;
      if (outcome === 'won') await flyIn(app, view, screen, chapter);
      else await crumble(app, view, screen, chapter);
      if (!alive) return;
      actions.classList.remove('waiting');
      bubble.classList.remove('waiting');
    }
    app.audio.play(won ? 'win' : 'lose');
  })();

  return {
    destroy() {
      alive = false;
      screen.remove();
    },
  };
}
