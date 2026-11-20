// Partikel mit festem Pool (keine Allokationen im Lauf), nach dem Vorbild von render/fx.js
// des Hochzeits-Runners: fallendes Herbstlaub, aufgewirbelte Blätter, Staub, Federn.
// Der Zufall hier ist reine Dekoration: eigener Strom, die Spiellogik hängt nicht davon ab.

import { TAU } from '../../core/math.js';
import { INK, LEAF_COLORS } from './pen.js';

const MAX = 160;
const AMBIENT = 20;

// random: Zufallsquelle 0..1 (game.js reicht einen eigenen Strom aus ctx.rng herein).
export function createFx(random) {
  const pool = Array.from({ length: MAX }, () => ({ alive: false, kind: 'leaf', x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 0, max: 1, size: 4, rot: 0, vr: 0, color: '#fff', scroll: 1, sway: 0, floor: Infinity }));
  let cursor = 0;
  let ambient = 0;
  let primed = 0; // die ersten Blätter starten verteilt im Bild, alle späteren oben

  function spawn() {
    for (let n = 0; n < MAX; n++) {
      const i = (cursor + n) % MAX;
      if (!pool[i].alive) {
        cursor = (i + 1) % MAX;
        const p = pool[i];
        p.alive = true;
        p.g = 0;
        p.drag = 1;
        p.rot = random() * TAU;
        p.vr = 0;
        p.scroll = 1;
        p.sway = 0;
        p.floor = Infinity;
        return p;
      }
    }
    return null;
  }

  const rand = (a, b) => a + random() * (b - a);

  return {
    // Blätter wirbeln auf (Landung, Laubhaufen getroffen).
    leaves(x, y, n, power = 1) {
      for (let i = 0; i < n; i++) {
        const p = spawn();
        if (!p) return;
        p.kind = 'leaf';
        p.x = x + rand(-18, 18);
        p.y = y - rand(0, 8);
        p.vx = rand(-170, 110) * power;
        p.vy = -rand(120, 330) * power;
        p.g = 520;
        p.drag = 0.985;
        p.life = p.max = rand(0.7, 1.3);
        p.size = rand(7, 12);
        p.vr = rand(-9, 9);
        p.color = LEAF_COLORS[(random() * LEAF_COLORS.length) | 0];
        p.sway = rand(0, TAU);
      }
    },
    dust(x, y, n, spread = 1) {
      for (let i = 0; i < n; i++) {
        const p = spawn();
        if (!p) return;
        p.kind = 'dust';
        p.x = x + rand(-14, 14) * spread;
        p.y = y - rand(0, 6);
        p.vx = rand(-90, 40) * spread;
        p.vy = -rand(15, 70);
        p.g = -30;
        p.drag = 0.95;
        p.life = p.max = rand(0.4, 0.75);
        p.size = rand(6, 12) * spread;
        p.color = '#F3E6D0';
      }
    },
    // Staubwolke beim Bremsen: größer, treibt nach vorn.
    cloud(x, y, n) {
      for (let i = 0; i < n; i++) {
        const p = spawn();
        if (!p) return;
        p.kind = 'dust';
        p.x = x + rand(-30, 60);
        p.y = y - rand(0, 14);
        p.vx = rand(20, 190);
        p.vy = -rand(20, 110);
        p.g = -20;
        p.drag = 0.94;
        p.life = p.max = rand(0.6, 1.2);
        p.size = rand(12, 26);
        p.color = '#F3E6D0';
        p.scroll = 0;
      }
    },
    puff(x, y, dir = 1) {
      const p = spawn();
      if (!p) return;
      p.kind = 'dust';
      p.x = x;
      p.y = y;
      p.vx = dir * rand(50, 100);
      p.vy = rand(-10, 30);
      p.g = -60;
      p.drag = 0.93;
      p.life = p.max = rand(0.5, 0.8);
      p.size = rand(5, 9);
      p.color = '#FFFFFF';
      p.scroll = 0;
    },
    feathers(x, y, n) {
      for (let i = 0; i < n; i++) {
        const p = spawn();
        if (!p) return;
        p.kind = 'feather';
        p.x = x;
        p.y = y;
        p.vx = rand(-120, 160);
        p.vy = -rand(60, 260);
        p.g = 240;
        p.drag = 0.96;
        p.life = p.max = rand(0.8, 1.4);
        p.size = rand(7, 11);
        p.vr = rand(-6, 6);
        p.color = random() < 0.5 ? '#C3CAD6' : '#FFFFFF';
        p.sway = rand(0, TAU);
      }
    },

    // dt in s, scrollDx = Weg der Welt in diesem Frame, vw/vh/groundY in Einheiten.
    step(dt, scrollDx, vw, vh, groundY) {
      // Dauerregen aus Herbstlaub: verteilt über das ganze Bild, landet auf der Straße
      while (ambient < AMBIENT) {
        const p = spawn();
        if (!p) break;
        ambient++;
        const first = primed < AMBIENT;
        if (first) primed++;
        p.kind = 'fall';
        p.x = first ? rand(0, vw * 1.3) : rand(vw * 0.2, vw * 1.5);
        p.y = first ? rand(0, groundY) : -20;
        p.vx = -rand(15, 55);
        p.vy = rand(45, 95);
        p.life = p.max = 60;
        p.size = rand(7, 13);
        p.vr = rand(-2.5, 2.5);
        p.color = LEAF_COLORS[(random() * LEAF_COLORS.length) | 0];
        p.sway = rand(0, TAU);
        p.scroll = rand(0.25, 0.7);
        p.floor = groundY + rand(-20, 190);
      }
      for (const p of pool) {
        if (!p.alive) continue;
        p.life -= dt;
        p.x -= scrollDx * p.scroll;
        if (p.kind === 'fall') {
          p.sway += dt * 2.4;
          p.x += (p.vx + Math.sin(p.sway) * 34) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt + Math.cos(p.sway) * dt * 1.5;
          if (p.y > p.floor || p.x < -30 || p.life <= 0) {
            p.alive = false;
            ambient--;
          }
          continue;
        }
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.kind !== 'dust') {
          p.sway += dt * 5;
          p.x += Math.sin(p.sway) * 20 * dt;
        }
        if (p.life <= 0 || p.y > vh + 30) p.alive = false;
      }
    },

    // layer: 'back' = Staub hinter dem Gespann, 'front' = Blätter und Federn davor
    draw(g, layer) {
      for (const p of pool) {
        if (!p.alive) continue;
        const dusty = p.kind === 'dust';
        if (dusty !== (layer === 'back')) continue;
        const k = p.life / p.max;
        if (dusty) {
          g.globalAlpha = Math.min(1, k * 1.4) * 0.75;
          g.beginPath();
          g.arc(p.x, p.y, p.size * (1.5 - k * 0.6), 0, TAU);
          g.fillStyle = p.color;
          g.fill();
          g.lineWidth = 1.4;
          g.strokeStyle = 'rgba(59,42,34,.35)';
          g.stroke();
          continue;
        }
        g.globalAlpha = p.kind === 'fall' ? 1 : Math.min(1, k * 3);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.beginPath();
        const len = p.size;
        if (p.kind === 'feather') {
          g.ellipse(0, 0, len * 0.6, len * 0.22, 0, 0, TAU);
        } else {
          g.moveTo(-len / 2, 0);
          g.quadraticCurveTo(0, -len * 0.5, len / 2, 0);
          g.quadraticCurveTo(0, len * 0.5, -len / 2, 0);
        }
        g.fillStyle = p.color;
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = INK;
        g.stroke();
        g.restore();
      }
      g.globalAlpha = 1;
    },
  };
}
