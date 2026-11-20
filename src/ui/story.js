// Story-Szene: Hintergrund, Janni als Moderator unten links, Sprechblasen mit Schreibmaschinen-Effekt.
// Tippen zeigt erst die ganze Blase, dann die nächste.

import { charEl } from '../render/chars.js';
import { h } from './dom.js';
import { popWord } from './fx.js';

const TYPE_MS = 22;

export function mountStory(root, app, { bg, lines, cast = [], outfits = {}, title = null, kicker = null, onDone }) {
  const { assets, audio } = app;
  const scene = h('div.screen.story');
  const backdrop = h('div.story-bg', { style: { backgroundImage: `url("${assets.url(bg)}")` } });
  const castBox = h('div.story-cast');
  const janni = charEl(assets, 'janni', 'anzug', { className: 'story-janni' });
  const text = h('p.bubble-text');
  const bubble = h('div.bubble.story-bubble', h('b.bubble-name', 'Janni'), text);
  const note = h('div.story-note');
  const hint = h('div.story-hint', 'Tippen ▸');
  const head = title ? h('div.story-title', kicker ? h('small', kicker) : null, h('span', title)) : null;
  scene.append(backdrop, h('div.story-shade'), head, castBox, janni, bubble, note, hint);
  root.append(scene);

  const present = new Set();
  const enter = (who) => {
    if (present.has(who)) return;
    present.add(who);
    const el = charEl(assets, who, outfits[who] ?? (who === 'feli' ? 'braut' : 'default'), who === 'feli' ? { className: 'story-guest' } : { className: 'story-guest', headScale: 1.3, headDy: 22 });
    castBox.append(el);
  };
  cast.forEach(enter);

  let index = -1;
  let timer = 0;
  let full = '';
  let typing = false;
  let done = false;

  const stopTyping = () => {
    clearInterval(timer);
    typing = false;
    text.textContent = full;
    scene.classList.remove('typing');
  };

  function show(line) {
    for (const who of line.enter ?? []) enter(who);
    if (line.sfx) audio.play(line.sfx);
    if (line.note !== undefined) {
      bubble.hidden = true;
      note.hidden = false;
      note.textContent = line.note;
      janni.classList.remove('talking');
      if (line.word) {
        const r = scene.getBoundingClientRect();
        popWord(scene, line.word, r.width * 0.5, r.height * 0.3, { size: 3.2, life: 1300 });
      }
      full = '';
      typing = false;
      return;
    }
    note.hidden = true;
    bubble.hidden = false;
    full = line.text;
    text.textContent = '';
    typing = true;
    scene.classList.add('typing');
    janni.classList.add('talking');
    let n = 0;
    timer = setInterval(() => {
      n++;
      text.textContent = full.slice(0, n);
      if (n % 3 === 0) audio.play('type');
      if (n >= full.length) {
        stopTyping();
        janni.classList.remove('talking');
      }
    }, TYPE_MS);
  }

  function advance() {
    if (done) return;
    if (typing) {
      stopTyping();
      janni.classList.remove('talking');
      return;
    }
    index++;
    if (index >= lines.length) {
      done = true;
      onDone();
      return;
    }
    audio.play('tap');
    show(lines[index]);
  }

  const onPointer = (e) => {
    e.preventDefault();
    advance();
  };
  scene.addEventListener('pointerdown', onPointer);
  bubble.hidden = true;
  note.hidden = true;
  if (lines.length) {
    index = 0;
    show(lines[0]);
  } else {
    done = true;
    queueMicrotask(onDone);
  }

  return {
    destroy() {
      clearInterval(timer);
      scene.remove();
    },
  };
}
