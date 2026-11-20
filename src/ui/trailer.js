// Trailer: animierter Kino-Vorspann aus DOM und CSS (kein Video), ca. 25 Sekunden.
// Überspringbar ab Sekunde 3.

import { CHAPTERS, TRAILER } from '../content.js';
import { headEl } from '../render/chars.js';
import { h, onTap } from './dom.js';
import { burst } from './fx.js';

const SKIP_AFTER = 3000;

export function mountTrailer(root, app, { onDone }) {
  const { assets, audio } = app;
  const slide = h('div.trailer-slide');
  const skip = h('button.trailer-skip', TRAILER.skip);
  const screen = h('div.screen.trailer', slide, h('div.trailer-bars'), skip);
  skip.hidden = true;
  root.append(screen);
  const timers = [];
  let finished = false;
  const at = (ms, fn) => timers.push(setTimeout(() => !finished && fn(), ms));
  const set = (cls, ...children) => {
    slide.className = 'trailer-slide ' + cls;
    slide.replaceChildren(...children);
    void slide.offsetWidth; // Animation neu starten
    slide.classList.add('in');
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    onDone();
  };
  const backdrop = (key) => h('div.trailer-backdrop', { style: { backgroundImage: `url("${assets.url(key)}")` } });

  // Kleine Szene je Kapitel: [Bild-Elemente, Sounds mit Verzögerung]
  const art = [
    () => [h('div.tr-rider', h('span.tr-horse', '🐎'), headEl(assets, 'feli', 'tr-h1'), headEl(assets, 'janni', 'tr-h2')), [['wieher', 150], ['hoof', 700], ['hoof', 900], ['hoof', 1100]]],
    () => [h('div.tr-case', headEl(assets, 'franks', 'tr-peek p1'), headEl(assets, 'findi', 'tr-peek p2'), h('span.tr-suitcase', '🧳')), [['meow', 500], ['meow', 1100]]],
    () => [h('div.tr-loupe', '🔍'), [['ping', 900], ['ping', 1700]]],
    () => [h('div.tr-beads', ['#F07A1A', '#8E5BD0', '#FFD23F', '#E5484D', '#7CC4F0'].map((c, i) => h('i', { style: { background: c, animationDelay: 0.15 + i * 0.22 + 's' } }, '?'))), [0, 1, 2, 3, 4].map((i) => ['bead', 300 + i * 220, i])],
    () => [h('div.tr-ball'), [['throw', 250], ['tor', 1050]]],
    () => [h('div.tr-laughs', h('b', 'HA!'), h('b', 'HAHA!'), h('b', '😂'), h('b', 'HA!')), [['slice', 400], ['slice', 800], ['gold', 1300]]],
  ];

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
    at(500, () => audio.play('sparkle'));
  }]);
  CHAPTERS.forEach((c, i) => {
    scenes.push([2500, () => {
      const [el, sounds] = art[i]();
      set('t-chapter c' + i, backdrop(c.bg), h('div.trailer-art', el), h('div.trailer-caption', h('small', `Kapitel ${i + 1}`), h('h2', c.trailer)));
      audio.play('whoosh');
      for (const [name, delay, arg] of sounds) at(delay, () => audio.play(name, arg));
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

  // Zeitplan relativ zum Start; at() verschiebt sich nicht, wenn eine Szene eigene Timer setzt.
  let t = 300;
  const starts = [];
  for (const [dur, fn] of scenes) {
    starts.push([t, fn]);
    t += dur;
  }
  for (const [start, fn] of starts) {
    at(start, fn);
  }
  at(SKIP_AFTER, () => {
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
