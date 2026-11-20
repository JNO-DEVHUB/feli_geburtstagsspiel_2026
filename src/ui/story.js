// Story-Szene: Hintergrund, Janni als Moderator unten links, Sprechblasen mit Schreibmaschinen-Effekt.
// Tippen zeigt erst die ganze Blase, dann die nächste.

import { createGespann } from '../games/runner/horse.js';
import { charEl } from '../render/chars.js';
import { h } from './dom.js';
import { popWord } from './fx.js';
import { suitcaseSvg } from './props.js';

const TYPE_MS = 22;

export function mountStory(root, app, { bg, lines, cast = [], outfits = {}, props = [], title = null, kicker = null, onDone }) {
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

  // Der Reisekoffer steht von Anfang an im Abteil. Später wackelt er, der Deckel klappt auf,
  // und die Kater springen im Bogen heraus.
  const later = [];
  const suitcase = props.includes('suitcase') ? h('div.story-case', { html: suitcaseSvg() }) : null;
  if (suitcase) scene.insertBefore(suitcase, janni);
  function jumpOut(list) {
    if (!suitcase) return list.forEach(enter);
    suitcase.classList.add('shake');
    audio.play('flip');
    later.push(setTimeout(() => {
      suitcase.classList.remove('shake');
      suitcase.classList.add('open');
      audio.play('klack');
    }, 750));
    list.forEach((who, i) => {
      if (present.has(who)) return;
      present.add(who);
      later.push(setTimeout(() => {
        const el = charEl(assets, who, 'default', { className: `story-jumper j${i}`, headScale: 1.3, headDy: 22 });
        scene.insertBefore(el, janni);
        audio.play('meow');
        const r = scene.getBoundingClientRect();
        popWord(scene, i ? 'MAU!' : 'MIAU!', r.width * (i ? 0.84 : 0.6), r.height * 0.62, { size: 2, life: 900, rot: i ? 8 : -10 });
      }, 1000 + i * 480));
    });
  }

  // Das Hochzeitspferd trabt von rechts ins Bild (mit Feli im Sattel), steigt kurz und bleibt dann stehen.
  // Gezeichnet mit dem Pferd aus dem Runner, gespiegelt, damit es zu Janni schaut.
  let horseRaf = 0;
  function trotIn() {
    if (horseRaf) return;
    const canvas = h('canvas.story-horse');
    scene.insertBefore(canvas, janni);
    const U = { w: 300, h: 250 }; // Zeichenfläche in Pferde-Einheiten
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 260;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssW * (U.h / U.w) * dpr);
    const g = canvas.getContext('2d');
    const gespann = createGespann(assets, { riders: { feli: true, janni: false } });
    const w = { player: { grounded: true, alt: 0, v: 0, spin: 0 }, speed: 250, phase: 'run', stopped: false };
    const IN = 1.7; // Sekunden bis zum Ziel
    let t = 0;
    let last = 0;
    const frame = (now) => {
      horseRaf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const k = Math.min(1, t / IN);
      const ease = 1 - (1 - k) ** 2;
      // Trab, Bremsen, Steigen, Stehen
      if (t < IN) w.speed = 250 * (1 - ease * 0.6);
      else if (t < IN + 0.35) Object.assign(w, { phase: 'won', stopped: false });
      else if (t < IN + 1.6) Object.assign(w, { phase: 'won', stopped: true });
      else Object.assign(w, { phase: 'run', stopped: false, speed: 0 });
      if (gespann.update(dt, w) && t < IN) audio.play('hoof');
      canvas.style.transform = `translateX(${(1 - ease) * 115}%)`;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      const s = canvas.width / U.w;
      g.setTransform(-s, 0, 0, s, canvas.width, 0); // gespiegelt
      gespann.draw(g, U.w * 0.52, U.h - 12, w);
    };
    horseRaf = requestAnimationFrame(frame);
  }

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
    if (line.horse) trotIn();
    if (line.jump) jumpOut(line.jump);
    if (line.sfx) audio.play(line.sfx);
    if (line.note !== undefined) {
      bubble.hidden = true;
      note.hidden = !line.note; // leere Regieanweisung: nur die Aktion selbst (z. B. das Pferd) zeigen
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
      later.forEach(clearTimeout);
      cancelAnimationFrame(horseRaf);
      scene.remove();
    },
  };
}
