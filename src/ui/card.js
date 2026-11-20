// Geburtstagskarte: Deckblatt klappt per 3D-Drehung auf, innen der Gruß. Verrät nichts über das Geschenk.

import { CARD } from '../content.js';
import { headEl } from '../render/chars.js';
import { h, onTap } from './dom.js';
import { burst } from './fx.js';

export function mountCard(root, app, { onDone }) {
  const { assets, audio } = app;
  const go = h('button.btn.card-go', CARD.button);
  const inside = h(
    'div.card-inside',
    { style: { backgroundImage: `url("${assets.url('bg:card')}")` } },
    h('div.card-heads', headEl(assets, 'franks', 'card-cat'), headEl(assets, 'feli', 'card-feli'), headEl(assets, 'findi', 'card-cat')),
    h('h1.card-headline', CARD.headline, ' 👑'),
    h('div.card-text', CARD.lines.map((l) => h('p', { html: l }))),
    go,
  );
  const cover = h(
    'div.card-cover',
    h('div.card-cover-face', h('div.card-crown', '👑'), h('div.card-for', CARD.cover), h('div.card-tap', CARD.coverHint)),
  );
  const sparkles = h('div.card-sparkles', Array.from({ length: 14 }, (_, i) => h('i', { style: { left: (i % 2 ? 2 + ((i * 5) % 11) : 86 + ((i * 3) % 11)) + '%', top: 4 + ((i * 61) % 90) + '%', animationDelay: (i % 7) * 0.3 + 's' } }, '✦')));
  const screen = h('div.screen.card-screen', inside, cover, sparkles);
  root.append(screen);

  let open = false;
  const openCard = () => {
    if (open) return;
    open = true;
    audio.unlock();
    audio.play('flip');
    screen.classList.add('open');
    setTimeout(() => {
      const r = screen.getBoundingClientRect();
      burst(screen, r.width / 2, r.height * 0.3, { count: 46, spread: 230 });
      audio.play('sparkle');
    }, 650);
  };
  cover.addEventListener('pointerdown', openCard);
  onTap(go, () => {
    audio.unlock();
    audio.play('tap');
    onDone();
  });

  return {
    destroy: () => screen.remove(),
  };
}
