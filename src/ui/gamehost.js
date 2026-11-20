// Rahmen um ein Minispiel: Regel-Karte mit Start-Knopf, dann das Spiel, dann die Meldung ans Programm.

import { HEAD_KEYS } from '../assets.js';
import { CHAPTERS } from '../content.js';
import { GAMES } from '../games/index.js';
import { createRng, randomSeed } from '../core/rng.js';
import { h, onTap } from './dom.js';

// Hintergrundmusik je Spiel (Stimmungen aus audio/music.js)
const GAME_MOODS = { runner: 'action', meowdoku: 'think', wimmel: 'think', wordle: 'think', handball: 'action', lacher: 'show' };

export function mountGame(root, app, { chapter, onEnd }) {
  const ch = CHAPTERS[chapter];
  const screen = h('div.screen.game-screen', { 'data-game': ch.game });
  const stageEl = h('div.game-root');
  const start = h('button.btn', 'Start');
  const howto = h(
    'div.howto',
    h('div.howto-card', h('small', `Kapitel ${chapter + 1}`), h('h2', ch.title), h('ul', ch.howto.map((t) => h('li', t))), start),
  );
  screen.append(h('div.game-bg', { style: { backgroundImage: `url("${app.assets.url(ch.bg)}")` } }), stageEl, howto);
  root.append(screen);

  let game = null;
  let ended = false;
  const end = (won) => {
    if (ended) return;
    ended = true;
    onEnd(!!won);
  };

  // Erst starten, wenn Hintergrund und Köpfe da sind (sonst zeichnet ein Canvas-Spiel Platzhalter).
  // Ein Tipp vor dem Ende des Ladens wird gemerkt und danach ausgeführt.
  let ready = false;
  let wanted = false;
  const begin = () => {
    if (game || ended || !howto.isConnected) return;
    howto.remove();
    app.audio.setMood(GAME_MOODS[ch.game] ?? 'think');
    game = GAMES[ch.game].createGame({ root: stageEl, audio: app.audio, assets: app.assets, rng: createRng(randomSeed()), debug: app.debug, end });
  };
  start.classList.add('loading');
  Promise.race([app.assets.load([ch.bg, ...HEAD_KEYS]), new Promise((r) => setTimeout(r, 20000))]).then(() => {
    ready = true;
    start.classList.remove('loading');
    if (wanted) begin();
  });

  onTap(start, () => {
    app.audio.play('tap');
    wanted = true;
    if (ready) begin();
  });

  return {
    // Debug: Spiel sofort gewinnen oder verlieren.
    forceEnd: end,
    destroy() {
      ended = true;
      try {
        game?.destroy?.();
      } catch (err) {
        console.error(err);
      }
      screen.remove();
    },
  };
}
