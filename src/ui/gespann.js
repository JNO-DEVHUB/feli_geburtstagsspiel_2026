// Das Hochzeitspferd aus dem Runner als eigenständiges Canvas-Element für Trailer und Spielesaal,
// damit überall dasselbe weiße Pferd mit Blumengirlande zu sehen ist.

import { createGespann } from '../games/runner/horse.js';

const U = { w: 300, h: 250 }; // Zeichenfläche in Pferde-Einheiten

// animate: true = galoppiert dauerhaft, false = ein einzelnes Standbild (z. B. als Symbol).
// Rückgabe: { el, stop() }. Größe per CSS (Breite setzen, das Seitenverhältnis ist fest).
export function gespannCanvas(assets, { riders = { feli: true, janni: true }, flip = false, speed = 250, animate = true, onStep } = {}) {
  const el = document.createElement('canvas');
  el.className = 'gespann';
  const g = el.getContext('2d');
  const gespann = createGespann(assets, { riders });
  const w = { player: { grounded: true, alt: 0, v: 0, spin: 0 }, speed, phase: 'run', stopped: false };
  let raf = 0;
  let last = 0;
  let sized = 0;

  function paint() {
    const css = el.clientWidth;
    if (!css) return false;
    if (css !== sized) {
      const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
      el.width = Math.round(css * dpr);
      el.height = Math.round(css * (U.h / U.w) * dpr);
      sized = css;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, el.width, el.height);
    const s = el.width / U.w;
    if (flip) g.setTransform(-s, 0, 0, s, el.width, 0);
    else g.setTransform(s, 0, 0, s, 0, 0);
    gespann.draw(g, U.w * 0.5, U.h - 12, w);
    return true;
  }

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (animate || !sized) {
      if (gespann.update(animate ? dt : 0.16, w) && animate) onStep?.();
      const done = paint();
      // Standbild: aufhören, sobald einmal mit geladenen Köpfen gezeichnet wurde
      if (!animate && done && assets.ok('head:feli')) cancelAnimationFrame(raf);
    }
  };
  raf = requestAnimationFrame(frame);
  return { el, stop: () => cancelAnimationFrame(raf) };
}
