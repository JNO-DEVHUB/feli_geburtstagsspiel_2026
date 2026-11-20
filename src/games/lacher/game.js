// Kapitel 6 „Showtime!“ – Lacher wischen (Vorbild Fruit Ninja).
// Darstellung und Eingabe im Canvas; Regeln, Wurfplan und Flugbahnen stehen in logic.js.

import { banner, burst, createLoop, fitCanvas, h, popWord, shake, sparkle } from '../kit.js';
import * as L from './logic.js';

const TAU = Math.PI * 2;
const INK = '#3B2A22';
const FONT = '"Luckiest Guy", "Arial Black", Impact, sans-serif';

// --- Stellschrauben der Darstellung ---
const SPRITE_PAD = 1.55; // Sprite-Kantenlänge = 2 · Radius · PAD (Platz für Schatten, Zacken, Sprechblasen-Zipfel)
const TRAIL_LIFE = 0.24; // Sekunden, bis die Wisch-Spur ausgelaufen ist
const TRAIL_MAX = 28;
const SPLAT_LIFE = 1.2; // Sekunden, die der Klecks herunterläuft und verblasst
const PART_MAX = 150; // Obergrenze Konfetti/Funken
const HALF_MAX = 14;
const HALF_LIFE = 0.75;
const END_DELAY = 1600; // ms vom Banner bis ctx.end()

const CONFETTI = {
  ha: ['#FFFFFF', '#F07A1A', '#FFD23F'],
  haha: ['#7CC4F0', '#FFFFFF', '#BDE6FF'],
  face: ['#FFD23F', '#FFE98A', '#5BC0F5'],
  mic: ['#F07A1A', '#D9DEE6', '#FFD23F'],
  gold: ['#FFD23F', '#FFF6B0', '#FFFFFF', '#F5A21B'],
  tomato: ['#9E3B22', '#C9342A', '#7C8F2E'],
};

const TOMATO_SVG =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="b" d="M16 9c7.2 0 12 4.300 12 10.300S23.200 29.500 16 29.500 4 25.300 4 19.300 8.800 9 16 9z"/><path class="l" d="M16 10.500l-6.500-3.500 5 .2L16 2.500l1.500 4.700 5-.2z"/></svg>';

// ---------------------------------------------------------------------------------------------
// Sprites: Jedes Objekt wird einmal in ein eigenes Canvas gezeichnet und danach nur noch gedreht kopiert.
// ---------------------------------------------------------------------------------------------

function makeSprite(R, dpr, pad = SPRITE_PAD) {
  const size = Math.ceil(2 * R * pad);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(size * dpr);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(size / 2, size / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return { canvas, g, size, half: size / 2 };
}

// Mehrere Teilformen als eine Figur: erst alle dick konturieren, dann alle füllen.
function union(g, parts, fill, lw) {
  g.strokeStyle = INK;
  g.lineWidth = lw * 2;
  for (const part of parts) {
    part(g);
    g.stroke();
  }
  g.fillStyle = fill;
  for (const part of parts) {
    part(g);
    g.fill();
  }
}

function hardShadow(g, parts, R) {
  g.save();
  g.translate(R * 0.08, R * 0.11);
  g.globalAlpha = 0.38;
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineWidth = R * 0.2;
  for (const part of parts) {
    part(g);
    g.fill();
    g.stroke();
  }
  g.restore();
}

function comicText(g, text, x, y, px, fill, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.font = `${px}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const m = g.measureText(text);
  const dy = ((m.actualBoundingBoxAscent || px * 0.7) - (m.actualBoundingBoxDescent || 0)) / 2;
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = px * 0.24;
  g.strokeText(text, px * 0.05, dy + px * 0.08);
  g.strokeText(text, 0, dy);
  g.fillStyle = fill;
  g.fillText(text, 0, dy);
  g.restore();
}

function star4(g, x, y, r, fill) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fillStyle = fill;
  g.fill();
}

// „HA!“: weiße Sprechblase, orange Schrift
function drawHa(g, R) {
  const parts = [
    (c) => {
      c.beginPath();
      c.moveTo(-R * 0.6, R * 0.3);
      c.lineTo(-R * 0.7, R * 1.02);
      c.lineTo(-R * 0.02, R * 0.56);
      c.closePath();
    },
    (c) => {
      c.beginPath();
      c.ellipse(0, -R * 0.1, R * 0.99, R * 0.76, 0, 0, TAU);
    },
  ];
  hardShadow(g, parts, R);
  union(g, parts, '#FFFFFF', R * 0.11);
  g.beginPath();
  g.ellipse(R * 0.1, R * 0.02, R * 0.8, R * 0.56, 0, 0.15, Math.PI * 0.8);
  g.strokeStyle = 'rgba(124,196,240,0.4)';
  g.lineWidth = R * 0.1;
  g.stroke();
  comicText(g, 'HA!', R * 0.02, -R * 0.12, R * 0.98, '#F07A1A', -0.1);
}

// „HAHA!“: himmelblaue Wolkenblase, weiße Schrift
function drawHaha(g, R) {
  const parts = [
    (c) => {
      c.beginPath();
      c.moveTo(R * 0.25, R * 0.4);
      c.lineTo(R * 0.74, R * 1.04);
      c.lineTo(R * 0.7, R * 0.25);
      c.closePath();
    },
  ];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    parts.push((c) => {
      c.beginPath();
      c.arc(Math.cos(a) * R * 0.66, -R * 0.08 + Math.sin(a) * R * 0.44, R * 0.34, 0, TAU);
    });
  }
  parts.push((c) => {
    c.beginPath();
    c.ellipse(0, -R * 0.08, R * 0.74, R * 0.54, 0, 0, TAU);
  });
  hardShadow(g, parts, R);
  union(g, parts, '#7CC4F0', R * 0.11);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(-R * 0.42, -R * 0.52, R * 0.3, R * 0.12, -0.5, 0, TAU);
  g.fill();
  comicText(g, 'HAHA!', 0, -R * 0.08, R * 0.62, '#FFFFFF', 0.07);
}

// goldener Lacher „HAHAHA!“: Zackenstern mit Goldglanz
function drawGold(g, R) {
  const star = (c) => {
    c.beginPath();
    const n = 14;
    for (let k = 0; k < n * 2; k++) {
      const a = (k / (n * 2)) * TAU - Math.PI / 2;
      const r = k % 2 ? R * 0.88 : R * 1.14;
      if (k) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  };
  hardShadow(g, [star], R);
  const grad = g.createLinearGradient(-R, -R, R, R);
  grad.addColorStop(0, '#FFF9C8');
  grad.addColorStop(0.45, '#FFD23F');
  grad.addColorStop(1, '#F0941A');
  union(g, [star], grad, R * 0.11);
  // Glanzstreifen
  g.save();
  star(g);
  g.clip();
  g.rotate(-0.6);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(-R * 1.4, -R * 0.62, R * 2.8, R * 0.2);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(-R * 1.4, -R * 0.32, R * 2.8, R * 0.09);
  g.restore();
  comicText(g, 'HAHA', -R * 0.02, -R * 0.3, R * 0.6, '#FFFFFF', -0.07);
  comicText(g, 'HA!', R * 0.04, R * 0.36, R * 0.74, '#FFFFFF', -0.07);
  star4(g, R * 0.86, -R * 0.78, R * 0.3, '#FFFFFF');
  star4(g, -R * 0.92, R * 0.62, R * 0.22, '#FFFFFF');
  star4(g, -R * 0.84, -R * 0.74, R * 0.15, '#FFFFFF');
}

// lachendes Gesicht mit Freudentränen
function drawFace(g, R) {
  const head = (c) => {
    c.beginPath();
    c.arc(0, 0, R * 0.93, 0, TAU);
  };
  hardShadow(g, [head], R);
  g.save();
  g.rotate(-0.14);
  const grad = g.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R);
  grad.addColorStop(0, '#FFE98A');
  grad.addColorStop(0.6, '#FFD23F');
  grad.addColorStop(1, '#F5A623');
  union(g, [head], grad, R * 0.11);
  // Mund
  g.beginPath();
  g.moveTo(-R * 0.56, R * 0.08);
  g.quadraticCurveTo(0, R * 0.2, R * 0.56, R * 0.08);
  g.bezierCurveTo(R * 0.5, R * 0.86, -R * 0.5, R * 0.86, -R * 0.56, R * 0.08);
  g.closePath();
  g.fillStyle = '#5A1F16';
  g.strokeStyle = INK;
  g.lineWidth = R * 0.09;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = '#FFFFFF';
  g.fillRect(-R * 0.6, R * 0.02, R * 1.2, R * 0.25);
  g.fillStyle = '#E5484D';
  g.beginPath();
  g.ellipse(0, R * 0.72, R * 0.32, R * 0.2, 0, 0, TAU);
  g.fill();
  g.restore();
  g.stroke();
  // zugekniffene Augen
  g.lineWidth = R * 0.11;
  g.beginPath();
  g.moveTo(-R * 0.58, -R * 0.22);
  g.quadraticCurveTo(-R * 0.36, -R * 0.56, -R * 0.14, -R * 0.22);
  g.moveTo(R * 0.14, -R * 0.22);
  g.quadraticCurveTo(R * 0.36, -R * 0.56, R * 0.58, -R * 0.22);
  g.stroke();
  // Tränen
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * R * 0.62, -R * 0.2);
    g.bezierCurveTo(s * R * 1.05, -R * 0.1, s * R * 1.12, R * 0.4, s * R * 0.86, R * 0.4);
    g.bezierCurveTo(s * R * 0.62, R * 0.4, s * R * 0.6, R * 0.05, s * R * 0.62, -R * 0.2);
    g.closePath();
    g.fillStyle = '#5BC0F5';
    g.lineWidth = R * 0.075;
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(s * R * 0.9, R * 0.2, R * 0.06, R * 0.1, 0, 0, TAU);
    g.fill();
  }
  g.restore();
}

// Mikrofon
function drawMic(g, R) {
  g.save();
  g.rotate(0.6);
  const handle = (c) => {
    c.beginPath();
    c.moveTo(-R * 0.25, -R * 0.12);
    c.lineTo(R * 0.25, -R * 0.12);
    c.lineTo(R * 0.15, R * 1.02);
    c.quadraticCurveTo(0, R * 1.12, -R * 0.15, R * 1.02);
    c.closePath();
  };
  const head = (c) => {
    c.beginPath();
    c.arc(0, -R * 0.5, R * 0.56, 0, TAU);
  };
  hardShadow(g, [handle, head], R);
  union(g, [handle], '#F07A1A', R * 0.1);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.moveTo(-R * 0.14, R * 0.1);
  g.lineTo(-R * 0.04, R * 0.1);
  g.lineTo(-R * 0.02, R * 0.92);
  g.lineTo(-R * 0.09, R * 0.92);
  g.closePath();
  g.fill();
  g.fillStyle = '#E5484D';
  g.strokeStyle = INK;
  g.lineWidth = R * 0.05;
  g.beginPath();
  g.rect(R * 0.02, R * 0.3, R * 0.12, R * 0.2);
  g.fill();
  g.stroke();
  union(g, [head], '#D9DEE6', R * 0.1);
  // Drahtgitter
  g.save();
  head(g);
  g.clip();
  g.strokeStyle = 'rgba(59,42,34,0.38)';
  g.lineWidth = R * 0.045;
  g.beginPath();
  for (let k = -5; k <= 5; k++) {
    g.moveTo(k * R * 0.2 - R * 0.6, -R * 1.1);
    g.lineTo(k * R * 0.2 + R * 0.6, R * 0.1);
    g.moveTo(k * R * 0.2 + R * 0.6, -R * 1.1);
    g.lineTo(k * R * 0.2 - R * 0.6, R * 0.1);
  }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath();
  g.ellipse(-R * 0.22, -R * 0.74, R * 0.2, R * 0.11, -0.6, 0, TAU);
  g.fill();
  g.restore();
  // goldener Ring am Hals
  g.beginPath();
  g.rect(-R * 0.3, -R * 0.14, R * 0.6, R * 0.17);
  g.fillStyle = '#FFD23F';
  g.strokeStyle = INK;
  g.lineWidth = R * 0.085;
  g.fill();
  g.stroke();
  g.restore();
}

// faule Tomate: bräunlich-rot, fleckig, welkes Grün
function drawTomato(g, R) {
  const parts = [
    (c) => {
      c.beginPath();
      c.ellipse(-R * 0.28, R * 0.08, R * 0.62, R * 0.72, -0.12, 0, TAU);
    },
    (c) => {
      c.beginPath();
      c.ellipse(R * 0.3, R * 0.12, R * 0.6, R * 0.7, 0.16, 0, TAU);
    },
    (c) => {
      c.beginPath();
      c.ellipse(R * 0.02, R * 0.24, R * 0.74, R * 0.62, 0, 0, TAU);
    },
  ];
  hardShadow(g, parts, R);
  const grad = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.05, 0, R * 0.1, R);
  grad.addColorStop(0, '#C4603C');
  grad.addColorStop(0.5, '#96391F');
  grad.addColorStop(1, '#6A2416');
  union(g, parts, grad, R * 0.11);
  // Faulstellen und Schimmel
  g.save();
  for (const part of parts) part(g);
  g.fillStyle = 'rgba(62,26,14,0.75)';
  for (const [x, y, rx, ry, rot] of [
    [0.38, 0.38, 0.3, 0.2, 0.5],
    [-0.5, 0.3, 0.17, 0.24, -0.3],
    [0.06, 0.66, 0.2, 0.1, 0],
  ]) {
    g.beginPath();
    g.ellipse(R * x, R * y, R * rx, R * ry, rot, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#93A53C';
  g.strokeStyle = 'rgba(59,42,34,0.6)';
  g.lineWidth = R * 0.04;
  g.beginPath();
  g.ellipse(-R * 0.14, R * 0.12, R * 0.27, R * 0.2, -0.4, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = '#D8E08A';
  for (const [x, y] of [
    [-0.22, 0.06],
    [-0.06, 0.16],
    [-0.16, 0.2],
    [0.5, 0.0],
    [0.56, 0.1],
  ]) {
    g.beginPath();
    g.arc(R * x, R * y, R * 0.045, 0, TAU);
    g.fill();
  }
  g.strokeStyle = 'rgba(59,42,34,0.55)';
  g.lineWidth = R * 0.05;
  g.beginPath();
  g.moveTo(R * 0.52, -R * 0.3);
  g.quadraticCurveTo(R * 0.7, -R * 0.1, R * 0.62, R * 0.12);
  g.moveTo(-R * 0.66, -R * 0.12);
  g.quadraticCurveTo(-R * 0.76, R * 0.06, -R * 0.7, R * 0.2);
  g.stroke();
  g.restore();
  // welke Blätter
  g.fillStyle = '#6F7F2B';
  g.strokeStyle = INK;
  g.lineWidth = R * 0.085;
  g.beginPath();
  const n = 5;
  for (let k = 0; k < n * 2; k++) {
    const a = (k / (n * 2)) * TAU - Math.PI / 2 + 0.2;
    const r = k % 2 ? R * 0.13 : R * (k === 4 ? 0.5 : 0.4);
    const x = Math.cos(a) * r;
    const y = -R * 0.56 + Math.sin(a) * r * 0.62;
    if (k) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = R * 0.17;
  g.beginPath();
  g.moveTo(0, -R * 0.6);
  g.lineTo(R * 0.1, -R * 0.9);
  g.stroke();
  g.strokeStyle = '#5A4A22';
  g.lineWidth = R * 0.07;
  g.stroke();
}

function drawGlow(g, R, inner, outer) {
  const grad = g.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 1.9);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, R * 1.9, 0, TAU);
  g.fill();
}

const PAINTERS = { ha: drawHa, haha: drawHaha, face: drawFace, mic: drawMic, gold: drawGold, tomato: drawTomato };

// ---------------------------------------------------------------------------------------------

export function createGame(ctx) {
  const { rng, audio } = ctx;
  const plan = L.buildPlan(rng);
  const score = L.createScore();

  // --- Aufbau ---
  const el = h('div.g-lacher');
  const scoreNum = h('b', '0');
  const scoreEl = h('div.g-lacher-score', scoreNum, h('span', ` / ${L.TARGET}`));
  const timeFill = h('i');
  const timeNum = h('span', String(L.DURATION));
  const timeEl = h('div.g-lacher-time', timeFill, timeNum);
  const tomEls = Array.from({ length: L.MAX_TOMATOES }, () => h('span.g-lacher-tom', { html: TOMATO_SVG }));
  const tomsEl = h('div.g-lacher-toms', tomEls);
  const hud = h('div.g-lacher-hud', scoreEl, timeEl, tomsEl);
  // Scheinwerfer-Kegel als eigene Ebenen: Das Schwenken kostet so keine Zeichenzeit im Canvas.
  el.append(h('div.g-lacher-cone.a'), h('div.g-lacher-cone.b'), hud);
  ctx.root.append(el);

  // --- Zustand ---
  let dead = false;
  let phase = 'play'; // 'play' | 'over'
  let time = 0; // Spielzeit in Sekunden
  let speed = 1; // Zeitraffer/Zeitlupe (nur Debug)
  let next = 0; // nächster Wurf im Plan
  let nextId = 1;
  let R = 36;
  let sprites = null;
  let lastSecond = L.DURATION;
  let lastFrac = -1;
  let comboWord = null;
  const timers = [];
  const objs = []; // fliegende Objekte: { wurf, id, type, x, y, rot, emit }
  let stroke = null; // laufender Wisch: { id, x, y, len, active, combo, lastHit, left, top }

  const halves = Array.from({ length: HALF_MAX }, () => ({ type: 'ha', x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, cut: 0, side: 1, life: 0 }));
  let halfCount = 0;
  const parts = Array.from({ length: PART_MAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 1, rot: 0, vr: 0, kind: 0, color: '#fff' }));
  let partCount = 0;
  const trail = { x: new Float32Array(TRAIL_MAX), y: new Float32Array(TRAIL_MAX), t: new Float32Array(TRAIL_MAX), s: new Int32Array(TRAIL_MAX), head: 0, count: 0, stroke: 0 };
  const splats = [0, 1].map(() => ({ t0: -99, blobs: Array.from({ length: 15 }, () => ({ x: 0, y: 0, r: 0, drip: 0, ox: 0, oy: 0 })) }));

  const view = fitCanvas(el, {
    onResize(v) {
      R = L.RADIUS * v.w;
      buildSprites(v);
    },
  });
  const g = view.g;

  function buildSprites(v) {
    const set = {};
    for (const type of Object.keys(PAINTERS)) {
      const sp = makeSprite(R, v.dpr);
      PAINTERS[type](sp.g, R);
      set[type] = sp;
    }
    set.halo = makeSprite(R, v.dpr, 2);
    drawGlow(set.halo.g, R, 'rgba(255,224,110,0.75)', 'rgba(255,200,60,0)');
    set.haze = makeSprite(R, v.dpr, 2);
    drawGlow(set.haze.g, R, 'rgba(150,205,60,0.6)', 'rgba(120,190,50,0)');
    sprites = set;
  }
  // Die Schrift ist beim Start in aller Regel schon geladen; falls nicht, Sprechblasen danach neu zeichnen.
  document.fonts?.load?.(`20px ${FONT}`).then(() => !dead && buildSprites(view), () => {});

  // --- Kopfzeile ---
  function updateHud() {
    scoreNum.textContent = String(score.points);
    hud.classList.toggle('safe', score.secured);
    for (let i = 0; i < tomEls.length; i++) tomEls[i].classList.toggle('on', i < score.tomatoes);
  }
  function updateTime() {
    const left = Math.max(0, L.DURATION - time);
    const frac = left / L.DURATION;
    if (Math.abs(frac - lastFrac) >= 0.004 || left === 0) {
      lastFrac = frac;
      timeFill.style.transform = `scaleX(${frac.toFixed(4)})`;
    }
    const sec = Math.ceil(left);
    if (sec !== lastSecond) {
      lastSecond = sec;
      timeNum.textContent = String(sec);
      const low = sec <= 5 && !score.secured;
      timeEl.classList.toggle('low', low);
      if (low && sec > 0 && sec <= 3) audio.play('tick');
    }
  }
  const bump = (node) => {
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  };

  // --- Effekte ---
  function addPart(kind, x, y, vx, vy, grav, life, size, color) {
    if (partCount >= PART_MAX) return;
    const p = parts[partCount++];
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.g = grav;
    p.life = p.max = life;
    p.size = size;
    p.color = color;
    p.rot = rng.range(0, TAU);
    p.vr = rng.range(-12, 12);
  }
  function confetti(x, y, colors, count, kind = 0) {
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, TAU);
      const v = R * rng.range(2.5, 9);
      addPart(kind, x, y, Math.cos(a) * v, Math.sin(a) * v - R * 3, view.h * 1.1, rng.range(0.45, 0.85), R * rng.range(0.16, 0.28), colors[i % colors.length]);
    }
  }
  function addHalf(o, side, angle) {
    if (halfCount >= HALF_MAX) return;
    const hf = halves[halfCount++];
    const tau = time - o.wurf.t;
    const push = R * 4.2;
    hf.type = o.type;
    hf.x = o.x;
    hf.y = o.y;
    hf.vx = o.wurf.vx * view.w - Math.sin(angle) * push * side;
    hf.vy = (L.GRAVITY * tau - o.wurf.vy) * view.h * 0.6 + Math.cos(angle) * push * side - R * 2;
    hf.rot = o.rot;
    hf.vr = o.wurf.spin + side * rng.range(1.5, 3.5);
    hf.cut = angle - o.rot;
    hf.side = side;
    hf.life = HALF_LIFE;
  }
  function addSplat(x, y) {
    const sp = splats[0].t0 <= splats[1].t0 ? splats[0] : splats[1];
    sp.t0 = time;
    const w = view.w;
    const cx = Math.min(w * 0.72, Math.max(w * 0.28, x));
    const cy = Math.min(view.h * 0.62, Math.max(view.h * 0.24, y));
    sp.blobs.forEach((b, i) => {
      if (i === 0) {
        b.x = cx;
        b.y = cy;
        b.r = w * 0.2;
        b.drip = view.h * 0.3;
      } else if (i < 8) {
        // Lappen rund um den Hauptklecks
        const a = (i / 7) * TAU + rng.range(-0.3, 0.3);
        const d = w * rng.range(0.13, 0.2);
        b.x = cx + Math.cos(a) * d;
        b.y = cy + Math.sin(a) * d * 0.9;
        b.r = w * rng.range(0.07, 0.12);
        b.drip = Math.sin(a) > -0.2 ? view.h * rng.range(0.1, 0.34) : 0;
      } else {
        // Spritzer über den ganzen Bildschirm
        const a = rng.range(0, TAU);
        const d = w * rng.range(0.34, 0.62);
        b.x = Math.min(w * 0.96, Math.max(w * 0.04, cx + Math.cos(a) * d));
        b.y = cy + Math.sin(a) * d * 1.2;
        b.r = w * rng.range(0.022, 0.06);
        b.drip = rng.chance(0.6) ? view.h * rng.range(0.05, 0.2) : 0;
      }
      // kleine Nebenkleckse machen jeden Klecks unrund
      const a = rng.range(0, TAU);
      b.ox = Math.cos(a) * b.r * 0.75;
      b.oy = Math.sin(a) * b.r * 0.75;
    });
  }

  // --- Treffer ---
  const clampX = (x, margin) => Math.min(view.w * (1 - margin), Math.max(view.w * margin, x));

  function hitLaugh(o, angle) {
    const idx = stroke && stroke.combo > 0 && time - stroke.lastHit <= L.COMBO_WINDOW ? stroke.combo : 0;
    const res = L.applySlice(score, o.type, idx);
    if (stroke) {
      stroke.combo = idx + 1;
      stroke.lastHit = time;
    }
    audio.play('slice', idx + 1);
    if (o.type === 'gold') audio.play('gold');
    addHalf(o, 1, angle);
    addHalf(o, -1, angle);
    confetti(o.x, o.y, CONFETTI[o.type], o.type === 'gold' ? 16 : 12);
    if (o.type === 'gold') confetti(o.x, o.y, CONFETTI.gold, 6, 1);
    const color = res.gained >= 3 ? '#FFD23F' : res.gained === 2 ? '#FFB45E' : '#FFFFFF';
    popWord(el, `+${res.gained}`, clampX(o.x, 0.08), Math.max(R * 2.6, o.y - R * 0.9), { color, size: res.gained >= 3 ? 2.3 : 1.8, rot: rng.range(-12, 12), life: 750 });
    if (idx >= 1) {
      comboWord?.remove();
      comboWord = popWord(el, `COMBO ×${idx + 1}!`, clampX(o.x, 0.27), Math.max(R * 3.4, o.y - R * 2), { color: '#7CC4F0', size: 2, rot: rng.range(-9, 9), life: 900 });
    }
    updateHud();
    bump(scoreEl);
    if (res.justSecured) {
      audio.play('ping');
      popWord(el, 'ZIEL ERREICHT!', view.w / 2, view.h * 0.3, { color: '#FFD23F', size: 2.25, rot: -5, life: 1500 });
      sparkle(el, view.w / 2, view.h * 0.3, 14);
      timeEl.classList.remove('low');
    }
  }

  function hitTomato(o) {
    const res = L.applyTomato(score);
    if (stroke) stroke.combo = 0;
    audio.play('splat');
    confetti(o.x, o.y, CONFETTI.tomato, 16, 2);
    addSplat(o.x, o.y);
    popWord(el, 'SPLATSCH!', clampX(o.x, 0.36), Math.max(R * 3, o.y - R * 0.4), { color: '#E5484D', size: 2.5, rot: rng.range(-12, 12), life: 1000 });
    shake(el, R * 0.25, 380);
    updateHud();
    if (res.counted) bump(tomEls[score.tomatoes - 1]);
  }

  function slice(ax, ay, bx, by) {
    if (phase !== 'play') return;
    const angle = Math.atan2(by - ay, bx - ax);
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (!L.segmentHitsCircle(ax, ay, bx, by, o.x, o.y, L.hitRadius(o.type, view.w))) continue;
      objs.splice(i, 1);
      if (o.type === 'tomato') hitTomato(o);
      else hitLaugh(o, angle);
      const state = L.outcome(score, L.DURATION - time);
      if (state !== 'play') {
        finish(state);
        return;
      }
    }
  }

  // --- Eingabe ---
  function trailPush(x, y) {
    const i = trail.head;
    trail.x[i] = x;
    trail.y[i] = y;
    trail.t[i] = time;
    trail.s[i] = trail.stroke;
    trail.head = (i + 1) % TRAIL_MAX;
    if (trail.count < TRAIL_MAX) trail.count++;
  }
  function onDown(e) {
    if (stroke || phase !== 'play') return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    stroke = { id: e.pointerId, x, y, sx: x, sy: y, len: 0, active: false, combo: 0, lastHit: -9, left: r.left, top: r.top };
    trail.stroke++;
    trailPush(x, y);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // manche Browser erlauben das bei synthetischen Ereignissen nicht
    }
  }
  function onMove(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const x = e.clientX - stroke.left;
    const y = e.clientY - stroke.top;
    const d = Math.hypot(x - stroke.x, y - stroke.y);
    if (d < 1.5) return;
    const ax = stroke.x;
    const ay = stroke.y;
    stroke.len += d;
    stroke.x = x;
    stroke.y = y;
    trailPush(x, y);
    // Antippen und Zittern zählen nicht: erst ab der Mindeststrecke wird geschnitten
    if (!stroke.active) {
      if (!L.isSwipe(stroke.len, view.w)) return;
      stroke.active = true;
      slice(stroke.sx, stroke.sy, x, y); // großzügig: der ganze Anlauf zählt mit
      return;
    }
    slice(ax, ay, x, y);
  }
  function onUp(e) {
    if (stroke && e.pointerId === stroke.id) stroke = null;
  }
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  // --- Ende ---
  function finish(state) {
    if (phase !== 'play') return;
    phase = 'over';
    stroke = null;
    const won = state === 'win';
    updateHud();
    if (won) {
      banner(el, 'STANDING OVATIONS!', 'win');
      audio.play('win');
      burst(el, view.w * 0.5, view.h * 0.4, { count: 34, spread: view.w * 0.5 });
      timers.push(setTimeout(() => burst(el, view.w * 0.22, view.h * 0.32, { spread: view.w * 0.4 }), 260));
      timers.push(setTimeout(() => burst(el, view.w * 0.78, view.h * 0.36, { spread: view.w * 0.4 }), 520));
    } else {
      banner(el, state === 'tomatoes' ? 'TOMATEN-ALARM!' : 'ZU WENIG LACHER!', 'lose');
      audio.play('lose');
    }
    timers.push(setTimeout(() => ctx.end(won), END_DELAY));
  }

  // --- Schleife ---
  function update(dt) {
    if (phase === 'play') {
      let wave = false;
      while (next < plan.length && plan[next].t <= time) {
        const wurf = plan[next++];
        objs.push({ wurf, id: nextId++, type: wurf.type, T: L.flightTime(wurf), x: 0, y: 0, rot: 0, emit: 0 });
        wave = true;
      }
      if (wave) audio.play('throw');
      updateTime();
      const state = L.outcome(score, L.DURATION - time);
      if (state !== 'play') finish(state);
    }
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (time - o.wurf.t > o.T) {
        objs.splice(i, 1);
        continue;
      }
      L.positionAt(o.wurf, time, view, o);
      if (o.type === 'gold') {
        // Funkelspur
        o.emit -= dt;
        if (o.emit <= 0) {
          o.emit = 0.045;
          addPart(1, o.x + rng.range(-0.7, 0.7) * R, o.y + rng.range(-0.7, 0.7) * R, rng.range(-0.6, 0.6) * R, rng.range(-0.2, 1) * R, R * 2, rng.range(0.35, 0.65), R * rng.range(0.2, 0.36), rng.chance(0.5) ? '#FFFFFF' : '#FFE27A');
        }
      }
    }
    for (let i = halfCount - 1; i >= 0; i--) {
      const hf = halves[i];
      hf.life -= dt;
      if (hf.life <= 0) {
        halves[i] = halves[--halfCount];
        halves[halfCount] = hf;
        continue;
      }
      hf.vy += L.GRAVITY * view.h * dt;
      hf.x += hf.vx * dt;
      hf.y += hf.vy * dt;
      hf.rot += hf.vr * dt;
    }
    for (let i = partCount - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        parts[i] = parts[--partCount];
        parts[partCount] = p;
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    while (trail.count > 0 && time - trail.t[(trail.head - trail.count + TRAIL_MAX) % TRAIL_MAX] > TRAIL_LIFE) trail.count--;
  }

  function blit(sp, x, y, rot, scale) {
    const d = view.dpr;
    const c = Math.cos(rot) * d * scale;
    const s = Math.sin(rot) * d * scale;
    g.setTransform(c, s, -s, c, x * d, y * d);
    g.drawImage(sp.canvas, -sp.half, -sp.half, sp.size, sp.size);
  }

  function drawTomatoExtras(o) {
    // grüner Dunst steigt auf
    g.beginPath();
    for (let i = -1; i <= 1; i++) {
      const bx = o.x + i * R * 0.52;
      const by = o.y - R * 0.95;
      g.moveTo(bx, by);
      for (let k = 1; k <= 6; k++) g.lineTo(bx + Math.sin(time * 6 + k * 1.1 + i * 2) * R * 0.035 * k, by - k * R * 0.12);
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#36591B';
    g.lineWidth = R * 0.17;
    g.stroke();
    g.strokeStyle = '#B4E04E';
    g.lineWidth = R * 0.085;
    g.stroke();
    // Fliegen
    for (let i = 0; i < 3; i++) {
      const a = time * (4.2 + i * 1.3) + i * 2.1;
      const fx = o.x + Math.cos(a) * R * (1.05 + 0.12 * i);
      const fy = o.y - R * 0.25 + Math.sin(a * 1.4 + i) * R * 0.75;
      const flap = Math.sin(time * 60 + i) > 0 ? 1 : 0.55;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(fx - R * 0.07, fy - R * 0.08, R * 0.09, R * 0.05 * flap, -0.6, 0, TAU);
      g.ellipse(fx + R * 0.07, fy - R * 0.08, R * 0.09, R * 0.05 * flap, 0.6, 0, TAU);
      g.fill();
      g.fillStyle = '#1E1512';
      g.beginPath();
      g.arc(fx, fy, R * 0.075, 0, TAU);
      g.fill();
    }
  }

  function drawSplat(sp) {
    const k = (time - sp.t0) / SPLAT_LIFE;
    if (k < 0 || k >= 1) return;
    const alpha = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    const pop = Math.min(1, k / 0.07);
    const run = 1 - (1 - k) * (1 - k); // läuft erst schnell, dann langsamer
    const slide = view.h * 0.05 * run;
    g.globalAlpha = alpha * 0.22;
    g.fillStyle = '#B3261E';
    g.fillRect(0, 0, view.w, view.h);
    g.lineCap = 'round';
    for (let layer = 0; layer < 2; layer++) {
      g.globalAlpha = alpha * 0.93;
      const col = layer ? '#C9342A' : '#74170F';
      const grow = layer ? 1 : 1.09;
      g.fillStyle = col;
      g.strokeStyle = col;
      for (const b of sp.blobs) {
        const y = b.y + slide;
        const r = b.r * pop;
        if (b.drip) {
          // Tropfnase: Bahn mit dickem Tropfen am Ende
          const lw = b.r * 0.4;
          const end = y + b.r * 0.6 + b.drip * run;
          g.lineWidth = lw + (layer ? 0 : b.r * 0.16);
          g.beginPath();
          g.moveTo(b.x + b.ox * 0.4, y);
          g.lineTo(b.x + b.ox * 0.4, end);
          g.stroke();
          g.beginPath();
          g.arc(b.x + b.ox * 0.4, end, lw * 0.8 + (layer ? 0 : b.r * 0.08), 0, TAU);
          g.fill();
        }
        g.beginPath();
        g.arc(b.x, y, r * grow, 0, TAU);
        g.arc(b.x + b.ox, y + b.oy, r * 0.66 * grow, 0, TAU);
        g.arc(b.x - b.oy * 0.9, y + b.ox * 0.7, r * 0.5 * grow, 0, TAU);
        g.fill();
      }
    }
    // Glanzlichter und Kerne
    g.globalAlpha = alpha * 0.8;
    g.fillStyle = '#F2786A';
    for (let i = 0; i < 8; i++) {
      const b = sp.blobs[i];
      g.beginPath();
      g.ellipse(b.x - b.r * 0.35, b.y + slide - b.r * 0.4, b.r * 0.28, b.r * 0.14, -0.6, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#F5D76E';
    for (let i = 1; i < 8; i += 2) {
      const b = sp.blobs[i];
      g.beginPath();
      g.ellipse(b.x + b.r * 0.2, b.y + slide + b.r * 0.15, b.r * 0.1, b.r * 0.18, i, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function draw() {
    const d = view.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, view.w, view.h);
    if (!sprites) return;

    // Tomaten zuerst: Sie liegen nie über einem Lacher.
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (o.type !== 'tomato') continue;
      blit(sprites.haze, o.x, o.y - R * 0.2, 0, 1 + Math.sin(time * 5 + o.id) * 0.07);
      blit(sprites.tomato, o.x, o.y, o.rot, 1);
      g.setTransform(d, 0, 0, d, 0, 0);
      drawTomatoExtras(o);
    }
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (o.type === 'tomato') continue;
      if (o.type === 'gold') blit(sprites.halo, o.x, o.y, 0, 1 + Math.sin(time * 9 + o.id) * 0.1);
      blit(sprites[o.type], o.x, o.y, o.rot, 1);
    }

    // Hälften
    for (let i = 0; i < halfCount; i++) {
      const hf = halves[i];
      const sp = sprites[hf.type];
      const a = hf.rot + hf.cut;
      const c = Math.cos(a) * d;
      const s = Math.sin(a) * d;
      g.save();
      g.setTransform(c, s, -s, c, hf.x * d, hf.y * d);
      g.globalAlpha = Math.min(1, hf.life / (HALF_LIFE * 0.4));
      g.beginPath();
      g.rect(-sp.half, hf.side > 0 ? 0 : -sp.half, sp.size, sp.half);
      g.clip();
      g.rotate(-hf.cut);
      g.drawImage(sp.canvas, -sp.half, -sp.half, sp.size, sp.size);
      g.restore();
    }
    g.setTransform(d, 0, 0, d, 0, 0);

    // Konfetti, Funken, Tomatenspritzer
    for (let i = 0; i < partCount; i++) {
      const p = parts[i];
      const a = p.life / p.max;
      g.globalAlpha = a < 0.3 ? a / 0.3 : 1;
      g.fillStyle = p.color;
      if (p.kind === 0) {
        const wdt = p.size * Math.abs(Math.cos(p.rot));
        g.fillRect(p.x - wdt / 2, p.y - p.size * 0.3, wdt, p.size * 0.6);
      } else if (p.kind === 1) {
        const r = p.size * (0.5 + 0.5 * a);
        g.beginPath();
        g.moveTo(p.x, p.y - r);
        g.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
        g.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
        g.quadraticCurveTo(p.x, p.y, p.x - r, p.y);
        g.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
        g.fill();
      } else {
        g.beginPath();
        g.arc(p.x, p.y, p.size * 0.5, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    // Wisch-Spur: außen goldenes Leuchten, innen weiß, läuft schnell aus
    if (trail.count > 1) {
      g.lineCap = 'round';
      const first = (trail.head - trail.count + TRAIL_MAX) % TRAIL_MAX;
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? '#FFFFFF' : 'rgba(255,205,80,0.55)';
        const base = R * (pass ? 0.26 : 0.66);
        for (let k = 1; k < trail.count; k++) {
          const j = (first + k - 1) % TRAIL_MAX;
          const i = (first + k) % TRAIL_MAX;
          if (trail.s[i] !== trail.s[j]) continue;
          const life = 1 - (time - trail.t[i]) / TRAIL_LIFE;
          if (life <= 0) continue;
          g.lineWidth = base * life;
          g.beginPath();
          g.moveTo(trail.x[j], trail.y[j]);
          g.lineTo(trail.x[i], trail.y[i]);
          g.stroke();
        }
      }
    }

    drawSplat(splats[0]);
    drawSplat(splats[1]);
  }

  const loop = createLoop((dt) => {
    const step = dt * speed;
    time += step;
    update(step);
    draw();
  });

  updateHud();
  updateTime();

  // --- Debug: Zugriff für die Browser-Probe ---
  let api = null;
  if (ctx.debug) {
    api = {
      id: 'lacher',
      plan,
      target: L.TARGET,
      state: () => ({ phase, time, timeLeft: Math.max(0, L.DURATION - time), points: score.points, tomatoes: score.tomatoes, secured: score.secured, bestCombo: score.bestCombo, speed, parts: partCount }),
      // fliegende Objekte in Seitenkoordinaten (für page.mouse)
      // lead: Vorhalt in Sekunden Spielzeit (wo ist das Objekt gleich?)
      objects: (lead = 0) => {
        const r = el.getBoundingClientRect();
        return objs.map((o) => {
          const p = L.positionAt(o.wurf, time + lead, view);
          return { id: o.id, type: o.type, x: r.left + p.x, y: r.top + p.y, r: R, rising: time + lead - o.wurf.t < L.apexTime(o.wurf) };
        });
      },
      view: () => ({ w: view.w, h: view.h, r: R, top: L.TOP_CLEAR * view.w }),
      // Zeitraffer (> 1) oder Zeitlupe (< 1)
      setSpeed: (k) => {
        speed = Math.min(20, Math.max(0, Number(k) || 0));
      },
    };
    globalThis.__game = api;
  }

  return {
    destroy() {
      dead = true;
      loop.stop();
      for (const t of timers) clearTimeout(t);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      view.destroy();
      el.remove();
      if (api && globalThis.__game === api) delete globalThis.__game;
    },
  };
}
