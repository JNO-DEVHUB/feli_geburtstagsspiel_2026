// Werkzeugkasten für alle Minispiele. Vertrag eines Spiels:
//
//   export function createGame(ctx) -> { destroy() }
//
//   ctx.root     HTMLElement, füllt die ganze Bühne (position: relative). Oben rechts 3em × 3em
//                frei lassen: dort sitzt der Stumm-Schalter der App.
//   ctx.audio    ctx.audio.play('ping') – Namen siehe src/audio/audio.js
//   ctx.assets   ctx.assets.img('head:feli') fürs Canvas, ctx.assets.url('bg:k5') für CSS/<img>
//   ctx.rng      Zufall mit Seed: next(), range(a,b), int(a,b), pick(liste), chance(p)
//   ctx.debug    true bei ?debug=1
//   ctx.end(won) genau einmal aufrufen, NACH der eigenen Sieg-/Niederlage-Animation
//
// Die Spiellogik gehört in logic.js (ohne DOM, per node:test prüfbar), Darstellung in game.js.

import { h } from '../ui/dom.js';
export { h, wait, onTap } from '../ui/dom.js';
export { popWord, burst, sparkle, shake, CONFETTI } from '../ui/fx.js';
export { charEl, headEl, createCharSprite } from '../render/chars.js';

// Spielschleife: fn(dt, t) mit dt in Sekunden (max. 1/20). Pausiert, wenn die Seite verborgen ist.
export function createLoop(fn) {
  let raf = 0;
  let last = 0;
  let t = 0;
  let stopped = false;
  const frame = (now) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = 0;
      return;
    }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    t += dt;
    fn(dt, t);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}

// Canvas, das root füllt. Gezeichnet wird in CSS-Pixeln (view.w × view.h), die Auflösung folgt dem Gerät.
export function fitCanvas(root, { className = 'game-canvas', onResize } = {}) {
  const canvas = h('canvas', { class: className });
  root.append(canvas);
  const g = canvas.getContext('2d');
  const view = { canvas, g, w: 0, h: 0, dpr: 1, destroy: () => {} };
  const resize = () => {
    const r = root.getBoundingClientRect();
    view.dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    view.w = Math.max(1, Math.round(r.width));
    view.h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    onResize?.(view);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();
  view.destroy = () => {
    ro.disconnect();
    canvas.remove();
  };
  return view;
}

// Zeigerposition relativ zu einem Element in CSS-Pixeln.
export function pointerPos(e, el) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// Kopfzeile: Herzen links, Mitte frei für Timer/Punkte, rechts Platz für den Stumm-Schalter.
export function createHud(root) {
  const hearts = h('div.hud-hearts');
  const mid = h('div.hud-mid');
  const bar = h('div.hud-bar', h('i'));
  const el = h('div.hud', hearts, mid, bar);
  bar.hidden = true;
  root.append(el);
  return {
    el,
    setHearts(n, max = 3) {
      hearts.replaceChildren(...Array.from({ length: max }, (_, i) => h('span.heart' + (i < n ? '' : '.off'), '❤')));
    },
    setText(text) {
      mid.textContent = text;
    },
    // frac 0..1; low = true färbt den Balken rot
    setBar(frac, low = false) {
      bar.hidden = false;
      bar.firstChild.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
      bar.classList.toggle('low', low);
    },
    destroy: () => el.remove(),
  };
}

// Großes Comic-Banner mittig ("GESCHAFFT!", "ZEIT UM!"). kind: 'win' | 'lose'
export function banner(root, text, kind = 'win') {
  const el = h('div.game-banner.' + kind, h('span', text));
  root.append(el);
  return el;
}
