// Trailer: animierter Kino-Vorspann aus DOM und CSS (kein Video), ca. 37 Sekunden.
// Jede Szene dauert eine feste Zahl Takte der Trailer-Musik (TRAILER_PLAN in audio/music.js).
// Überspringbar ab Sekunde 3.

import { TRAILER_PLAN } from '../audio/music.js';
import { CHAPTERS, TRAILER } from '../content.js';
import { charEl, headEl } from '../render/chars.js';
import { h, onTap } from './dom.js';
import { burst, popWord, shake } from './fx.js';
import { gespannCanvas } from './gespann.js';
import { suitcaseSvg } from './props.js';

const SKIP_AFTER = 3000;
const START = 300;
const BAR = TRAILER_PLAN.bar * 1000;

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
  let horse = null; // galoppierendes Hochzeitspferd der Kapitel-1-Szene
  const set = (cls, ...children) => {
    horse?.stop();
    horse = null;
    slide.className = 'trailer-slide ' + cls;
    slide.replaceChildren(...children);
    void slide.offsetWidth; // Animation neu starten
    slide.classList.add('in');
  };
  const backdrop = (key) => h('div.trailer-backdrop', { style: { backgroundImage: `url("${assets.url(key)}")` } });
  const size = () => screen.getBoundingClientRect();

  audio.setMood(null);
  const stopScore = audio.playTrailer(START / 1000 - 0.06);
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    horse?.stop();
    stopScore();
    onDone();
  };

  // Kleine Szene je Kapitel: [Bild-Elemente, Sounds mit Verzögerung in ms]
  const art = [
    () => {
      // dasselbe weiße Hochzeitspferd wie im Spiel, mit Feli und Janni im Sattel
      const ride = gespannCanvas(assets, { onStep: () => audio.play('hoof') });
      return [h('div.tr-rider', ride.el), [['wieher', 200]], ride];
    },
    () => [h('div.tr-case', headEl(assets, 'franks', 'tr-peek p1'), headEl(assets, 'findi', 'tr-peek p2'), h('div.tr-suitcase', { html: suitcaseSvg() })), [['flip', 150], ['klack', 650], ['meow', 900], ['meow', 1600]]],
    () => [h('div.tr-loupe', '🔍'), [['ping', 1300], ['ping', 2500]]],
    () => [h('div.tr-beads', ['#F07A1A', '#8E5BD0', '#FFD23F', '#E5484D', '#7CC4F0'].map((c, i) => h('i', { style: { background: c, animationDelay: 0.3 + i * 0.32 + 's' } }, '?'))), [0, 1, 2, 3, 4].map((i) => ['bead', 500 + i * 320, i])],
    () => [h('div.tr-ball'), [['throw', 600], ['tor', 1900]]],
    () => [h('div.tr-laughs', h('b', 'HA!'), h('b', 'HAHA!'), h('b', '😂'), h('b', 'HA!')), [['slice', 500], ['slice', 1000], ['gold', 1700], ['slice', 2300]]],
  ];

  // Zug-Szene: Der ICE fährt ein, die Tür geht auf, alle vier steigen aus. Wohin? Bleibt geheim.
  function trainScene() {
    const crew = [
      ['feli', 'braut', 't-feli', {}],
      ['janni', 'kanone', 't-janni', {}],
      ['franks', 'default', 't-franks', { headScale: 1.3, headDy: 22 }],
      ['findi', 'default', 't-findi', { headScale: 1.3, headDy: 22 }],
    ].map(([who, outfit, cls, opts], i) => {
      const el = charEl(assets, who, outfit, { ...opts, className: 'tr-out ' + cls });
      el.style.animationDelay = 2.25 + i * 0.42 + 's';
      return el;
    });
    const train = h(
      'div.tr-train',
      h('div.tr-nose'),
      h('div.tr-body', h('div.tr-stripe'), h('div.tr-windows'), h('div.tr-door', h('i')), h('div.tr-ice', 'ICE')),
      h('div.tr-wheels'),
    );
    set(
      't-chapter t-train',
      backdrop('bg:k3'),
      h('div.trailer-art', h('div.tr-sign', h('small', TRAILER.train.sign), h('b', '???')), train, h('div.tr-platform'), ...crew),
      h('div.trailer-caption', h('small', TRAILER.train.kicker), h('h2', TRAILER.train.title)),
    );
    audio.play('whoosh');
    at(250, () => audio.play('brake'));
    at(1750, () => shake(screen, 4, 260));
    at(1950, () => audio.play('klack'));
    crew.forEach((el, i) => at(2250 + i * 420, () => audio.play(i < 2 ? 'bead' : 'meow', i)));
    at(4300, () => {
      const r = size();
      popWord(screen, '???', r.width * 0.5, r.height * 0.3, { size: 3.4, color: '#FFD23F', life: 900, rot: -6 });
    });
  }

  // [Takte, Funktion]
  const scenes = [];
  scenes.push([TRAILER_PLAN.presents, () => {
    set('t-presents', headEl(assets, 'janni', 'trailer-janni'), h('p', TRAILER.presents));
  }]);
  scenes.push([TRAILER_PLAN.title, () => {
    set('t-title', h('div.trailer-crown', '👑'), h('h1', TRAILER.title));
    const r = size();
    shake(screen, 10, 450);
    burst(screen, r.width / 2, r.height * 0.4, { count: 36, spread: 220 });
    at(600, () => audio.play('sparkle'));
  }]);
  CHAPTERS.forEach((c, i) => {
    scenes.push([TRAILER_PLAN.chapter, () => {
      const [el, sounds, runner] = art[i]();
      set('t-chapter c' + i, backdrop(c.bg), h('div.trailer-art', el), h('div.trailer-caption', h('small', `Kapitel ${i + 1}`), h('h2', c.trailer)));
      horse = runner ?? null;
      audio.play('whoosh');
      for (const [name, delay, arg] of sounds) at(delay, () => audio.play(name, arg));
    }]);
  });
  scenes.push([TRAILER_PLAN.train, trainScene]);
  scenes.push([TRAILER_PLAN.outro, () => {
    set('t-line', h('div.trailer-crown', '👑'), h('h2', TRAILER.outro[0]));
    const r = size();
    burst(screen, r.width / 2, r.height * 0.42, { count: 30, spread: 200 });
  }]);
  scenes.push([0, () => {
    const go = h('button.btn', TRAILER.button);
    onTap(go, () => {
      audio.play('tap');
      finish();
    });
    set('t-line t-end', headEl(assets, 'feli', 'trailer-feli'), h('h2', TRAILER.outro[1]), go);
    skip.hidden = true;
    audio.play('sparkle');
    at(3400, () => audio.setMood('calm'));
  }]);

  let t = START;
  for (const [bars, fn] of scenes) {
    const start = t;
    timers.push(setTimeout(() => !finished && fn(), start));
    t += bars * BAR;
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
      horse?.stop();
      if (audio.mood === null) stopScore();
      screen.remove();
    },
  };
}
