// Spielesaal: alle sechs Spiele beliebig oft, dazu Gutschein, Puzzle und das Intro.

import { CHAPTERS, HALL } from '../content.js';
import { h, onTap } from './dom.js';
import { createFrameView } from './frame.js';
import { gespannCanvas } from './gespann.js';

const ICONS = ['🐴', '🐱', '🔍', '📿', '🤾', '🎤'];

export function mountHall(root, app, { onPlay, onVoucher, onIntro }) {
  const results = app.store.get().results;
  // Kapitel 1 zeigt das echte Hochzeitspferd statt eines Pferde-Emojis.
  const icons = { horse: gespannCanvas(app.assets, { animate: false }) };
  const grid = h('div.hall-grid');
  CHAPTERS.forEach((c, i) => {
    const card = h('button.hall-card' + (results[i] === true ? '.got' : ''), h('span.hall-icon', i === 0 ? icons.horse.el : ICONS[i]), h('small', `Kapitel ${i + 1}`), h('b', c.title), h('em', results[i] === true ? `🧩 ${c.hint}` : `🧩 ${HALL.locked}`));
    onTap(card, () => {
      app.audio.play('tap');
      onPlay(i);
    });
    grid.append(card);
  });
  const voucher = h('button.btn', '🎟 ' + HALL.voucher);
  const puzzle = h('button.btn.ghost', '🧩 ' + HALL.puzzle);
  const intro = h('button.linkbtn', HALL.intro);
  const screen = h('div.screen.hall', h('h1', HALL.title), h('p.hall-sub', HALL.sub), grid, h('div.hall-actions', voucher, puzzle), intro);
  root.append(screen);

  let sheet = null;
  onTap(voucher, () => {
    app.audio.play('tap');
    onVoucher();
  });
  onTap(intro, () => {
    app.audio.play('tap');
    onIntro();
  });
  onTap(puzzle, () => {
    app.audio.play('tap');
    const view = createFrameView(app, results);
    const close = h('button.btn', HALL.back);
    sheet = h('div.hall-sheet', view.el, close);
    screen.append(sheet);
    view.layout();
    onTap(close, () => {
      app.audio.play('tap');
      sheet.remove();
      sheet = null;
    });
  });

  return {
    destroy() {
      icons.horse.stop();
      screen.remove();
    },
  };
}
