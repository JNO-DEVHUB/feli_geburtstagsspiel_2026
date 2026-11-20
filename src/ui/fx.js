// Effekte auf DOM-Basis, für alle Bildschirme und über jedem Canvas nutzbar:
// Comic-Wörter (BONK!, PUFF!), Konfetti-Platzer, Wackeln.

import { h } from './dom.js';

export const CONFETTI = ['#F07A1A', '#FFD23F', '#FFFFFF', '#E5484D', '#7CC4F0', '#8E5BD0'];

// Koordinaten relativ zu root (CSS-Pixel). size in em.
export function popWord(root, text, x, y, { color = '#F07A1A', size = 2.2, rot = -8, life = 950 } = {}) {
  const el = h('div.comic-word', { style: { left: x + 'px', top: y + 'px', color, fontSize: size + 'em', '--rot': rot + 'deg', animationDuration: life + 'ms' } }, text);
  root.append(el);
  setTimeout(() => el.remove(), life + 50);
  return el;
}

export function burst(root, x, y, { count = 26, colors = CONFETTI, spread = 150, life = 950, gravity = 260, glyphs = null, size = 9 } = {}) {
  if (!root.animate) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = spread * (0.35 + Math.random() * 0.75);
    const dx = Math.cos(a) * v;
    const dy = Math.sin(a) * v - spread * 0.35;
    const glyph = glyphs ? glyphs[i % glyphs.length] : null;
    const el = h('div.fx-bit', { style: glyph ? { left: x + 'px', top: y + 'px', fontSize: size * 1.8 + 'px' } : { left: x + 'px', top: y + 'px', width: size + 'px', height: size * 0.55 + 'px', background: colors[i % colors.length] } }, glyph);
    root.append(el);
    const t = life * (0.7 + Math.random() * 0.5);
    el.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + gravity * 0.5}px)) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration: t, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => el.remove();
  }
}

export const sparkle = (root, x, y, count = 10) => burst(root, x, y, { count, glyphs: ['✨', '⭐', '✦'], spread: 90, gravity: 40, life: 800, size: 10 });

export function shake(el, strength = 8, ms = 380) {
  if (!el.animate) return;
  const k = [];
  for (let i = 0; i < 8; i++) k.push({ transform: `translate(${(Math.random() - 0.5) * 2 * strength}px, ${(Math.random() - 0.5) * 2 * strength}px)` });
  k.push({ transform: 'translate(0,0)' });
  el.animate(k, { duration: ms });
}
