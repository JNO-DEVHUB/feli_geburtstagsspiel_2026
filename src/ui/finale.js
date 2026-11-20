// Finale: Puzzle setzt sich zusammen, die große Frage, Konfettikanone, Rubbel-Konfetti, Gutschein.
// (Kanone und Rubbel-Konfetti folgen in einem späteren Ausbauschritt.)

import { FINALE } from '../content.js';
import { wonCount } from '../core/progress.js';
import { charEl } from '../render/chars.js';
import { h, onTap, wait } from './dom.js';
import { burst, shake } from './fx.js';
import { createFrameView } from './frame.js';

export function mountFinale(root, app, { onDone }) {
  const { audio, assets, store } = app;
  const results = store.get().results;
  const view = createFrameView(app, results);
  const text = h('p.bubble-text', FINALE.question(wonCount(store.get())));
  const bubble = h('div.bubble.finale-bubble', h('b.bubble-name', 'Janni'), text);
  const janni = charEl(assets, 'janni', 'anzug', { className: 'finale-janni' });
  const answers = h('div.answers');
  const screen = h('div.screen.finale', view.el, h('div.finale-talk', janni, bubble), answers);
  root.append(screen);
  view.layout();
  let alive = true;

  const order = FINALE.answers.map((a, i) => ({ a, k: (i * 7 + Math.floor(Math.random() * 4) * 3) % 11 })).sort((x, y) => x.k - y.k).map((x) => x.a);
  for (const a of order) {
    const card = h('button.answer', a.text);
    onTap(card, async () => {
      if (card.classList.contains('gone')) return;
      if (a.correct) {
        audio.play('fanfare');
        text.textContent = FINALE.right;
        card.classList.add('right');
        const r = screen.getBoundingClientRect();
        burst(screen, r.width / 2, r.height / 2, { count: 70, spread: 280 });
        shake(screen, 6, 400);
        await wait(1600);
        if (alive) onDone();
      } else {
        audio.play('crumple');
        text.textContent = a.react && a.react !== FINALE.wrong ? `${FINALE.wrong} ${a.react}` : FINALE.wrong;
        card.classList.add('gone');
      }
    });
    answers.append(card);
  }

  return {
    destroy() {
      alive = false;
      screen.remove();
    },
  };
}
