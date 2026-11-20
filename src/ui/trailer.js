// Trailer: animierter Kino-Vorspann aus DOM und CSS (kein Video). Überspringbar ab Sekunde 3.

import { CHAPTERS, TRAILER } from '../content.js';
import { headEl } from '../render/chars.js';
import { h, onTap } from './dom.js';
import { burst } from './fx.js';

const ICONS = ['🐴', '🧳', '🔍', '📿', '🤾', '🎤'];

export function mountTrailer(root, app, { onDone }) {
  const { assets, audio } = app;
  const slide = h('div.trailer-slide');
  const skip = h('button.trailer-skip', TRAILER.skip);
  const screen = h('div.screen.trailer', h('div.trailer-bars'), slide, skip);
  skip.hidden = true;
  root.append(screen);
  const timers = [];
  let finished = false;
  const at = (ms, fn) => timers.push(setTimeout(() => !finished && fn(), ms));
  const set = (cls, ...children) => {
    slide.className = 'trailer-slide ' + cls;
    slide.replaceChildren(...children);
    // Animation neu starten
    void slide.offsetWidth;
    slide.classList.add('in');
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    onDone();
  };

  const scenes = [];
  scenes.push([2800, () => {
    set('t-presents', headEl(assets, 'janni', 'trailer-janni'), h('p', TRAILER.presents));
    audio.play('drum');
  }]);
  scenes.push([3000, () => {
    set('t-title', h('div.trailer-crown', '👑'), h('h1', TRAILER.title));
    audio.play('boom');
    const r = screen.getBoundingClientRect();
    burst(screen, r.width / 2, r.height * 0.4, { count: 30, spread: 200 });
  }]);
  CHAPTERS.forEach((c, i) => {
    scenes.push([2500, () => {
      set('t-chapter c' + i, h('div.trailer-icon', ICONS[i]), h('small', `Kapitel ${i + 1}`), h('h2', c.trailer));
      audio.play('whoosh');
    }]);
  });
  scenes.push([2200, () => {
    set('t-line', h('div.trailer-crown', '👑'), h('h2', TRAILER.outro[0]));
    audio.play('sparkle');
  }]);
  scenes.push([0, () => {
    const go = h('button.btn', TRAILER.button);
    onTap(go, () => {
      audio.play('tap');
      finish();
    });
    set('t-line t-end', headEl(assets, 'feli', 'trailer-feli'), h('h2', TRAILER.outro[1]), go);
    skip.hidden = true;
    audio.play('fanfare');
  }]);

  let t = 300;
  for (const [dur, fn] of scenes) {
    at(t, fn);
    t += dur;
  }
  at(3000, () => {
    skip.hidden = false;
  });
  onTap(skip, () => {
    audio.play('tap');
    finish();
  });

  return {
    destroy() {
      finished = true;
      timers.forEach(clearTimeout);
      screen.remove();
    },
  };
}
