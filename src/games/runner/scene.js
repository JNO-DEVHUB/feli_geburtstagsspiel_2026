// Kulisse: Berlin im Herbst in mehreren Parallax-Ebenen, alles prozedural gezeichnet und einmal
// in Offscreen-Canvas vorgerendert (Idee aus render/scenery.js des Hochzeits-Runners).
//   Himmel → Fernsehturm und Skyline (0,05) → Altbauten mit Brandenburger Tor und Siegessäule
//   in den Lücken (0,22) → Gehweg mit Bäumen, Laternen, Currybude (0,5) → Stau mit Doppeldecker
//   (0,72) → Kopfsteinpflaster (1) → Vordergrund (1,25). Am Ende der Bahnhof Südkreuz.
// Alle y-Angaben relativ zur Huflinie G (y nach unten positiv).

import { TAU } from '../../core/math.js';
import { createRng } from '../../core/rng.js';
import { COURSE_LENGTH, PLAYER_X } from './logic.js';
import { INK, LEAF_COLORS, box, disc, haze, ink, label, leaf, limb, makeSprite, oval, poly, rr, stroke } from './pen.js';

const ORANGE = '#F07A1A';
const NUNITO = "Nunito, 'Segoe UI', sans-serif";
const INK_SOFT = 'rgba(59,42,34,.6)';

// Lage der Ebenen relativ zur Huflinie und ihre Parallax-Faktoren.
const FAR = { par: 0.05, base: -112, w: 1300, h: 600 };
const MID = { par: 0.22, base: -104, w: 1320, h: 480, gapAt: 960 };
const NEAR = { par: 0.5, base: -96, w: 1650, h: 380 };
const TRAFFIC = { par: 0.72, base: -40, w: 1500, h: 190 };
const GROUND = { top: -58, w: 600, h: 440 };
const FRONT = { par: 1.25, base: 312, w: 1500, h: 150 };
export const STATION = { x: COURSE_LENGTH - 250, w: 960, h: 560, base: -36 };
const SIGNPOST = { x: COURSE_LENGTH - 1750, w: 190, h: 250, base: -40 };

// Kachel, die sich nahtlos wiederholt: Inhalt wird dreimal versetzt gezeichnet.
function tile(w, h, res, draw) {
  return makeSprite(w, h, res, (g) => {
    for (const dx of [-w, 0, w]) {
      g.save();
      g.translate(dx, 0);
      draw(g);
      g.restore();
    }
  });
}

// ------------------------------------------------------------------ ferne Skyline

function fernsehturm(g, x, base) {
  const lw = 3;
  poly(g, [x - 58, base, x - 40, base - 20, x - 22, base - 8, x, base - 24, x + 22, base - 8, x + 40, base - 20, x + 58, base], '#EFE6DA', lw, INK_SOFT);
  poly(g, [x - 15, base, x + 15, base, x + 7, base - 330, x - 7, base - 330], '#F3EBE0', lw, INK_SOFT);
  poly(g, [x + 4, base, x + 15, base, x + 7, base - 330, x + 3, base - 330], '#D9CDBD', 0);
  poly(g, [x - 16, base - 322, x + 16, base - 322, x + 26, base - 342, x - 26, base - 342], '#C9CED6', lw, INK_SOFT);
  const cy = base - 372;
  disc(g, x, cy, 42, '#DCE1E7', lw, INK_SOFT);
  g.save();
  g.beginPath();
  g.arc(x, cy, 42, 0, TAU);
  g.clip();
  g.fillStyle = '#B4BCC8';
  g.fillRect(x - 50, cy + 6, 100, 50);
  g.fillStyle = '#6F7B8A';
  g.fillRect(x - 50, cy - 6, 100, 12);
  g.fillStyle = '#FFE08A';
  for (let i = -5; i <= 5; i++) g.fillRect(x + i * 8 - 2, cy - 3, 4, 6);
  oval(g, x - 14, cy - 22, 16, 9, 'rgba(255,255,255,.7)', 0, -0.4);
  g.restore();
  disc(g, x, cy, 42, null, lw, INK_SOFT);
  box(g, x - 7, cy - 78, 14, 38, 2, '#F3EBE0', lw, INK_SOFT);
  // rot-weiße Antenne
  for (let i = 0; i < 6; i++) {
    const y0 = cy - 78 - i * 19;
    const wd = 5 - i * 0.5;
    box(g, x - wd / 2, y0 - 19, wd, 19, 0, i % 2 ? '#FFFFFF' : '#E5484D', 2, INK_SOFT);
  }
}

function drawFar(g) {
  const { w: W, h: H } = FAR;
  const r = createRng(11);
  // hintere Häuserreihe als Dunst-Silhouette
  for (let x = -30; x < W; ) {
    const bw = r.range(46, 120);
    const bh = r.range(50, 120);
    box(g, x, H - bh, bw + 1, bh, 0, '#F2BE94', 0);
    if (r.chance(0.3)) poly(g, [x, H - bh, x + bw / 2, H - bh - r.range(14, 30), x + bw, H - bh], '#F2BE94', 0);
    x += bw;
  }
  // Berliner Dom und Baukran: ohne geht es nicht
  box(g, 110, H - 150, 110, 150, 0, '#E7B58C', 2.5, INK_SOFT);
  g.beginPath();
  g.arc(165, H - 150, 42, Math.PI, 0);
  g.closePath();
  ink(g, '#8DBBA8', 2.5, INK_SOFT);
  box(g, 161, H - 214, 8, 22, 0, '#8DBBA8', 2, INK_SOFT);
  for (const dx of [-48, 48]) {
    box(g, 165 + dx - 9, H - 176, 18, 30, 0, '#E7B58C', 2, INK_SOFT);
    g.beginPath();
    g.arc(165 + dx, H - 176, 10, Math.PI, 0);
    g.closePath();
    ink(g, '#8DBBA8', 2, INK_SOFT);
  }
  stroke(g, [930, H, 930, H - 300], '#D98A4E', 5);
  stroke(g, [870, H - 290, 1060, H - 290], '#D98A4E', 5);
  stroke(g, [930, H - 322, 890, H - 290, 930, H - 322, 1010, H - 290], '#D98A4E', 2.5);
  stroke(g, [1040, H - 290, 1040, H - 240], '#C9762B', 1.6);
  box(g, 1032, H - 240, 16, 12, 0, '#C9762B', 0);
  // vordere Häuserreihe mit Lichtern
  for (let x = -20; x < W; ) {
    const bw = r.range(60, 130);
    const bh = r.range(70, 165);
    const col = r.pick(['#E6A377', '#E0986C', '#EBAE82']);
    box(g, x, H - bh, bw + 1, bh, 0, col, 2, 'rgba(59,42,34,.35)');
    if (r.chance(0.4)) poly(g, [x - 2, H - bh, x + bw / 2, H - bh - r.range(18, 34), x + bw + 2, H - bh], '#C9775A', 2, 'rgba(59,42,34,.35)');
    for (let wy = H - bh + 12; wy < H - 20; wy += 22) for (let wx = x + 10; wx < x + bw - 12; wx += 18) if (r.chance(0.5)) box(g, wx, wy, 7, 10, 0, r.chance(0.4) ? '#FFE9A8' : '#F6C79A', 0);
    x += bw;
  }
  fernsehturm(g, 400, H);
  haze(g, W, H, 'rgba(255,200,150,.22)');
}

// ------------------------------------------------------------------ Altbauten

const SHOPS = ['SPÄTI', 'BÄCKER', 'CAFÉ', 'BLUMEN', 'DÖNER', 'KNEIPE'];
const HOUSES = [
  { w: 170, h: 360, wall: '#F3DEB4', trim: '#FFF4E2', roof: 'mansard', awning: '#E5484D' },
  { w: 150, h: 412, wall: '#E3A08C', trim: '#FBE3D4', roof: 'gable', awning: '#3F9B5A' },
  { w: 200, h: 332, wall: '#F6E3A1', trim: '#FFF8DC', roof: 'flat', awning: ORANGE, erker: true },
  { w: 160, h: 430, wall: '#D98C5F', trim: '#F9D9BF', roof: 'mansard', awning: '#7CC4F0' },
  { w: 130, h: 372, wall: '#C9D2A6', trim: '#F2F5DC', roof: 'gable', awning: '#E5484D' },
  { w: 150, h: 400, wall: '#EAC27E', trim: '#FFF0CF', roof: 'flat', awning: '#8E5BD0' },
];

function fenster(g, r, x, y, w, h, trim, arched) {
  const lit = r.chance(0.36);
  if (arched) {
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + w / 2);
    g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    g.lineTo(x + w, y + h);
    g.closePath();
  } else rr(g, x, y, w, h, 1.5);
  ink(g, trim, 5);
  ink(g, lit ? '#FFE08A' : r.pick(['#6E8196', '#7F93A8', '#5F7186']), 2.4);
  stroke(g, [x + w / 2, y + (arched ? 2 : 0), x + w / 2, y + h], INK, 1.5);
  stroke(g, [x, y + h * 0.42, x + w, y + h * 0.42], INK, 1.5);
  box(g, x - 3, y + h, w + 6, 4, 1, trim, 2);
  if (r.chance(0.22)) {
    box(g, x - 2, y + h - 5, w + 4, 6, 1, '#8A5A35', 2);
    for (let i = 0; i < 4; i++) disc(g, x + 2 + i * (w / 3.4), y + h - 7, 3, r.pick(['#E5484D', ORANGE, '#FFD23F', '#FF8FAB']), 1.2);
  }
}

function altbau(g, r, x, base, d, shop) {
  const { w, h, wall, trim } = d;
  const top = base - h;
  box(g, x, top, w, h, 0, wall, 3.5);
  // Dach
  if (d.roof === 'mansard') {
    poly(g, [x - 4, top, x + w + 4, top, x + w - 12, top - 46, x + 12, top - 46], '#B5533C', 3.5);
    for (let rx = x + 14; rx < x + w - 14; rx += 14) stroke(g, [rx, top - 4, rx + 3, top - 42], 'rgba(59,42,34,.25)', 1.5);
    for (const dx of [0.28, 0.72]) {
      box(g, x + w * dx - 13, top - 38, 26, 30, 2, trim, 3);
      box(g, x + w * dx - 8, top - 32, 16, 20, 1, r.chance(0.5) ? '#FFE08A' : '#6E8196', 2);
      poly(g, [x + w * dx - 17, top - 38, x + w * dx, top - 52, x + w * dx + 17, top - 38], '#9C4634', 3);
    }
    box(g, x + w * 0.5 - 8, top - 70, 16, 26, 1, '#C9775A', 3);
  } else if (d.roof === 'gable') {
    poly(g, [x - 3, top, x + w * 0.2, top, x + w * 0.2, top - 26, x + w * 0.38, top - 26, x + w * 0.38, top - 52, x + w * 0.62, top - 52, x + w * 0.62, top - 26, x + w * 0.8, top - 26, x + w * 0.8, top, x + w + 3, top], wall, 3.5);
    disc(g, x + w / 2, top - 22, 11, '#6E8196', 3);
    stroke(g, [x + w / 2 - 11, top - 22, x + w / 2 + 11, top - 22], INK, 1.5);
    stroke(g, [x + w / 2, top - 33, x + w / 2, top - 11], INK, 1.5);
  } else {
    box(g, x - 4, top - 12, w + 8, 14, 2, trim, 3);
    for (let rx = x + 8; rx < x + w - 4; rx += 12) stroke(g, [rx, top - 9, rx, top - 1], INK, 1.5);
    box(g, x + w * 0.2, top - 44, 18, 34, 1, '#C9775A', 3);
    // Katze auf dem Dach
    const cx = x + w * 0.68;
    oval(g, cx, top - 20, 11, 8, '#E8702A', 2.4);
    disc(g, cx + 10, top - 29, 6.5, '#E8702A', 2.4);
    poly(g, [cx + 5, top - 33, cx + 6.5, top - 40, cx + 10, top - 35], '#E8702A', 2);
    poly(g, [cx + 11, top - 35, cx + 14.5, top - 40, cx + 15.5, top - 33], '#E8702A', 2);
    stroke(g, [cx - 10, top - 18, cx - 19, top - 22, cx - 20, top - 32], '#E8702A', 3.6);
  }
  // Stockwerke
  const ground = 82;
  const floors = Math.max(2, Math.round((h - ground - 14) / 78));
  const fh = (h - ground - 14) / floors;
  const cols = Math.max(2, Math.round(w / 48));
  const cw = w / cols;
  for (let f = 0; f < floors; f++) {
    const fy = top + 14 + f * fh;
    box(g, x, fy + fh - 7, w, 6, 0, trim, 2);
    for (let c = 0; c < cols; c++) {
      const wx = x + c * cw + cw / 2 - 11;
      const isErker = d.erker && c === Math.floor(cols / 2);
      if (isErker) continue;
      fenster(g, r, wx, fy + 10, 22, fh * 0.58, trim, f === 0 && d.roof !== 'flat');
      if (r.chance(0.16)) {
        // Balkon
        box(g, wx - 8, fy + 10 + fh * 0.4, 38, fh * 0.26, 1, 'rgba(255,255,255,.25)', 2.4);
        for (let b = 0; b < 5; b++) stroke(g, [wx - 4 + b * 7.5, fy + 12 + fh * 0.4, wx - 4 + b * 7.5, fy + 8 + fh * 0.66], INK, 1.3);
      }
    }
  }
  if (d.erker) {
    const ex = x + Math.floor(cols / 2) * cw + cw / 2 - 24;
    box(g, ex, top + 24, 48, h - ground - 30, 3, trim, 3);
    poly(g, [ex - 4, top + 24, ex + 24, top - 2, ex + 52, top + 24], '#B5533C', 3);
    for (let f = 0; f < floors; f++) fenster(g, r, ex + 12, top + 38 + f * fh, 24, fh * 0.55, wall, true);
  }
  // Erdgeschoss: Laden mit Markise und Haustür
  const gy = base - ground;
  box(g, x, gy, w, ground, 0, 'rgba(59,42,34,.12)', 0);
  box(g, x, gy - 3, w, 7, 0, trim, 2.4);
  const doorX = x + w - 44;
  g.beginPath();
  g.moveTo(doorX, base);
  g.lineTo(doorX, gy + 30);
  g.arc(doorX + 15, gy + 30, 15, Math.PI, 0);
  g.lineTo(doorX + 30, base);
  g.closePath();
  ink(g, '#7A4A2B', 3);
  stroke(g, [doorX + 15, gy + 18, doorX + 15, base], INK, 1.5);
  const sw = w - 70;
  box(g, x + 12, gy + 34, sw, ground - 44, 2, '#FFE9A8', 3);
  stroke(g, [x + 12 + sw / 2, gy + 34, x + 12 + sw / 2, base - 10], INK, 1.5);
  // Markise gestreift
  g.save();
  g.beginPath();
  g.moveTo(x + 8, gy + 14);
  g.lineTo(x + 16 + sw, gy + 14);
  g.lineTo(x + 22 + sw, gy + 34);
  g.lineTo(x + 2, gy + 34);
  g.closePath();
  g.clip();
  g.fillStyle = '#FFFFFF';
  g.fillRect(x, gy + 10, w, 30);
  g.fillStyle = d.awning;
  for (let ax = x + 2; ax < x + sw + 24; ax += 20) g.fillRect(ax, gy + 10, 10, 30);
  g.restore();
  poly(g, [x + 8, gy + 14, x + 16 + sw, gy + 14, x + 22 + sw, gy + 34, x + 2, gy + 34], null, 3);
  label(g, shop, x + 12 + sw / 2, gy + 58, 15, '#7A3D0A');
}

function drawMid(g) {
  const { h: H, gapAt } = MID;
  const r = createRng(23);
  let x = 0;
  HOUSES.forEach((d, i) => {
    altbau(g, r, x, H, d, SHOPS[i]);
    x += d.w;
  });
  // Lücke: kleiner Platz mit Herbstbüschen, dahinter steht ein Wahrzeichen (eigenes Sprite)
  for (let pass = 0; pass < 2; pass++) {
    const rb = createRng(5);
    for (let bx = gapAt + 14; bx < MID.w - 6; bx += 26) {
      const br = rb.range(16, 26);
      g.beginPath();
      g.arc(bx, H - br * 0.7, br, 0, TAU);
      if (pass === 0) ink(g, null, 6);
      else ink(g, rb.pick(['#E8892B', '#D9A22B', '#C9642B', '#E5B33D']), 0);
    }
  }
  const rl = createRng(8);
  for (let i = 0; i < 26; i++) leaf(g, gapAt + rl.range(10, 350), H - rl.range(6, 40), 8, rl.range(0, 6), rl.pick(LEAF_COLORS), 1.1);
  haze(g, MID.w, H, 'rgba(255,214,165,.2)');
}

function drawTor(g, W, H) {
  const stone = '#EBCB98';
  const dark = '#D3A873';
  // Seitenflügel
  for (const x of [4, W - 64]) {
    box(g, x, H - 86, 60, 86, 0, stone, 3);
    box(g, x - 3, H - 94, 66, 10, 0, dark, 3);
    for (let i = 0; i < 4; i++) box(g, x + 6 + i * 13.5, H - 80, 7, 80, 0, '#F6DDB3', 1.6);
  }
  box(g, 54, H - 8, W - 108, 8, 0, dark, 3);
  // sechs Säulen, dazwischen freie Durchfahrten
  box(g, 62, H - 130, W - 124, 10, 0, 'rgba(120,80,50,.35)', 0);
  for (let i = 0; i < 6; i++) {
    const x = 64 + i * ((W - 142) / 5);
    box(g, x, H - 122, 14, 114, 0, stone, 3);
    stroke(g, [x + 10, H - 118, x + 10, H - 12], dark, 2.4);
    box(g, x - 3, H - 126, 20, 7, 0, '#F6DDB3', 2.4);
  }
  box(g, 54, H - 146, W - 108, 22, 0, stone, 3);
  for (let x = 62; x < W - 60; x += 12) stroke(g, [x, H - 142, x, H - 130], dark, 1.6);
  box(g, 76, H - 174, W - 152, 28, 0, '#F1D4A6', 3);
  box(g, 70, H - 178, W - 140, 6, 0, dark, 2.4);
  // Quadriga
  const q = '#5E9C84';
  const cx = W / 2;
  box(g, cx - 34, H - 184, 68, 6, 0, q, 2.4);
  for (const dx of [-24, -9, 9, 24]) {
    oval(g, cx + dx, H - 196, 6.5, 9, q, 2.2);
    limb(g, [cx + dx, H - 203, cx + dx + (dx < 0 ? -3 : 3), H - 214], 4.5, q, 1.8);
    oval(g, cx + dx + (dx < 0 ? -4 : 4), H - 216, 4.2, 3, q, 1.8, dx < 0 ? 0.5 : -0.5);
  }
  poly(g, [cx - 7, H - 190, cx + 7, H - 190, cx + 4, H - 218, cx - 4, H - 218], q, 2.2);
  disc(g, cx, H - 223, 4.2, q, 2);
  stroke(g, [cx + 7, H - 196, cx + 9, H - 238], INK, 2.2);
  disc(g, cx + 9, H - 240, 3.4, q, 1.8);
  haze(g, W, H, 'rgba(255,214,165,.2)');
}

function drawSaeule(g, W, H) {
  const cx = W / 2;
  box(g, cx - 46, H - 28, 92, 28, 0, '#B86B55', 3);
  box(g, cx - 36, H - 64, 72, 36, 0, '#C98F6E', 3);
  box(g, cx - 30, H - 116, 60, 52, 0, '#E6C28B', 3);
  for (let i = 0; i < 6; i++) stroke(g, [cx - 24 + i * 9.6, H - 112, cx - 24 + i * 9.6, H - 68], '#C99B66', 2.4);
  box(g, cx - 34, H - 122, 68, 8, 0, '#D3A873', 2.4);
  box(g, cx - 11, H - 290, 22, 168, 0, '#DDBE90', 3);
  for (const y of [H - 250, H - 208, H - 166]) box(g, cx - 12.5, y, 25, 9, 0, '#FFC233', 2);
  box(g, cx - 19, H - 300, 38, 10, 2, '#D3A873', 2.4);
  // Goldelse
  const gold = '#FFC233';
  poly(g, [cx - 2, H - 322, cx - 30, H - 340, cx - 22, H - 318, cx - 6, H - 312], gold, 2.2);
  poly(g, [cx - 9, H - 300, cx + 9, H - 300, cx + 4, H - 330, cx - 4, H - 330], gold, 2.2);
  disc(g, cx, H - 335, 5, gold, 2);
  limb(g, [cx + 3, H - 326, cx + 16, H - 344], 3, gold, 1.6);
  disc(g, cx + 18, H - 348, 5, null, 2.4, gold);
  disc(g, cx + 18, H - 348, 6.4, null, 1, INK);
  stroke(g, [cx - 8, H - 302, cx - 12, H - 350], INK, 2);
  haze(g, W, H, 'rgba(255,214,165,.2)');
}

// ------------------------------------------------------------------ Gehweg: Bäume, Laternen, Buden

function baum(g, x, base, hgt, cols, seed) {
  const r = createRng(seed);
  poly(g, [x - 10, base, x + 10, base, x + 6, base - hgt * 0.5, x - 6, base - hgt * 0.5], '#7A5540', 3.5);
  limb(g, [x, base - hgt * 0.4, x - hgt * 0.14, base - hgt * 0.58], 5, '#7A5540', 2.6);
  limb(g, [x, base - hgt * 0.36, x + hgt * 0.16, base - hgt * 0.56], 5, '#7A5540', 2.6);
  const R = hgt * 0.27;
  const cy = base - hgt * 0.7;
  const blobs = [
    [0, 0, 1],
    [-0.62, 0.28, 0.72],
    [0.62, 0.24, 0.76],
    [-0.3, -0.5, 0.74],
    [0.36, -0.42, 0.7],
    [0, 0.4, 0.66],
  ];
  for (const [bx, by, br] of blobs) disc(g, x + bx * R, cy + by * R, br * R, null, 8);
  for (const [bx, by, br] of blobs) disc(g, x + bx * R, cy + by * R, br * R, cols[0], 0);
  for (const [bx, by, br] of blobs.slice(2, 5)) disc(g, x + bx * R + br * R * 0.2, cy + by * R - br * R * 0.22, br * R * 0.6, cols[1], 0);
  for (let i = 0; i < 16; i++) {
    const a = r.range(0, TAU);
    const d = r.range(0.1, 1.05) * R;
    leaf(g, x + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d * 0.9, r.range(9, 14), r.range(0, 6), r.pick(cols), 1.2);
  }
  // ein paar Blätter rieseln
  for (let i = 0; i < 4; i++) leaf(g, x + r.range(-R, R), cy + R + r.range(10, hgt * 0.4), 9, r.range(0, 6), r.pick(cols), 1.4);
}

function sitzTaube(g, x, y, flip = 1) {
  g.save();
  g.translate(x, y);
  g.scale(flip, 1);
  poly(g, [8, -6, 19, -4, 9, -1], '#7F8A9B', 2);
  oval(g, 0, -7, 10, 7, '#9AA3B2', 2.4);
  disc(g, -8, -15, 5.5, '#8793A6', 2.4);
  poly(g, [-13, -15, -18, -13.5, -13, -12.5], ORANGE, 1.6);
  disc(g, -9.5, -16, 1.2, INK, 0);
  stroke(g, [-2, 0, -2, 3], ORANGE, 1.6);
  stroke(g, [3, 0, 3, 3], ORANGE, 1.6);
  g.restore();
}

function laterne(g, x, base, tauben) {
  const green = '#2F5B4B';
  const top = base - 178;
  const gl = g.createRadialGradient(x, top - 12, 4, x, top - 12, 58);
  gl.addColorStop(0, 'rgba(255,233,150,.75)');
  gl.addColorStop(1, 'rgba(255,233,150,0)');
  g.fillStyle = gl;
  g.fillRect(x - 60, top - 72, 120, 120);
  box(g, x - 8, base - 16, 16, 16, 2, green, 3);
  limb(g, [x, base - 14, x, top + 4], 5, green, 2.8);
  box(g, x - 6, base - 70, 12, 6, 2, green, 2.4);
  poly(g, [x - 9, top + 4, x + 9, top + 4, x + 14, top - 24, x - 14, top - 24], '#FFE9A0', 3);
  stroke(g, [x, top + 2, x, top - 22], INK_SOFT, 1.5);
  poly(g, [x - 18, top - 24, x, top - 40, x + 18, top - 24], green, 3);
  disc(g, x, top - 43, 3.4, green, 2.2);
  if (tauben > 0) sitzTaube(g, x - 9, top - 30 + 4, 1);
  if (tauben > 1) sitzTaube(g, x + 13, top - 27 + 3, -1);
}

function litfass(g, x, base) {
  box(g, x - 30, base - 150, 60, 150, 4, '#F3E6D0', 3.5);
  g.beginPath();
  g.moveTo(x - 34, base - 150);
  g.quadraticCurveTo(x, base - 188, x + 34, base - 150);
  g.closePath();
  ink(g, '#2F6B5A', 3.5);
  disc(g, x, base - 172, 4, '#2F6B5A', 2.4);
  box(g, x - 32, base - 12, 64, 12, 2, '#2F6B5A', 3);
  box(g, x - 24, base - 140, 30, 40, 1, '#E5484D', 2);
  label(g, 'STAU', x - 9, base - 126, 10, '#FFFFFF');
  label(g, '!!!', x - 9, base - 111, 11, '#FFD23F');
  box(g, x + 9, base - 136, 18, 52, 1, '#FFD23F', 2);
  disc(g, x + 18, base - 120, 5, '#E8702A', 1.6);
  poly(g, [x + 13.5, base - 123, x + 15, base - 129, x + 18, base - 125], '#E8702A', 1.4);
  poly(g, [x + 18, base - 125, x + 21, base - 129, x + 22.5, base - 123], '#E8702A', 1.4);
  stroke(g, [x + 12, base - 106, x + 24, base - 106], INK, 1.6);
  stroke(g, [x + 12, base - 100, x + 24, base - 100], INK, 1.6);
  box(g, x - 24, base - 94, 28, 58, 1, '#7CC4F0', 2);
  label(g, 'ZIRKUS', x - 10, base - 80, 7, INK);
  disc(g, x - 10, base - 60, 8, '#FFFFFF', 1.6);
  disc(g, x - 10, base - 60, 3.5, '#E5484D', 0);
  box(g, x + 9, base - 78, 18, 44, 1, '#3F9B5A', 2);
}

function currybude(g, x, base) {
  box(g, x, base - 104, 150, 104, 3, '#E5484D', 3.5);
  box(g, x, base - 40, 150, 10, 0, '#FFFFFF', 2.4);
  box(g, x + 14, base - 90, 100, 46, 2, '#5A3A2A', 3);
  // Wurstverkäufer
  box(g, x + 50, base - 66, 30, 22, 4, '#FFFFFF', 2.4);
  disc(g, x + 65, base - 74, 10, '#E9B48E', 2.4);
  box(g, x + 55, base - 92, 20, 12, 3, '#FFFFFF', 2.4);
  stroke(g, [x + 61, base - 71, x + 69, base - 71], INK, 1.6);
  // Theke mit Pappschale
  box(g, x + 10, base - 48, 108, 8, 2, '#D39A56', 2.4);
  box(g, x + 24, base - 56, 20, 8, 2, '#FFF4E2', 2);
  limb(g, [x + 28, base - 58, x + 40, base - 58], 4, '#B5532A', 1.6);
  // Markise
  g.save();
  g.beginPath();
  g.moveTo(x - 4, base - 104);
  g.lineTo(x + 154, base - 104);
  g.lineTo(x + 164, base - 84);
  g.lineTo(x - 14, base - 84);
  g.closePath();
  g.clip();
  g.fillStyle = '#FFFFFF';
  g.fillRect(x - 20, base - 110, 200, 30);
  g.fillStyle = '#E5484D';
  for (let ax = x - 14; ax < x + 170; ax += 24) g.fillRect(ax, base - 110, 12, 30);
  g.restore();
  poly(g, [x - 4, base - 104, x + 154, base - 104, x + 164, base - 84, x - 14, base - 84], null, 3.5);
  box(g, x + 14, base - 140, 122, 34, 5, '#FFD23F', 3.5);
  label(g, 'CURRY 23', x + 75, base - 121, 20, '#E5484D', { lw: 3.5 });
  box(g, x + 124, base - 86, 18, 40, 2, '#FFF4E2', 2);
  for (let i = 0; i < 4; i++) stroke(g, [x + 128, base - 78 + i * 8, x + 138, base - 78 + i * 8], INK, 1.4);
  sitzTaube(g, x + 30, base - 140, 1);
}

function ampel(g, x, base) {
  limb(g, [x, base, x, base - 150], 5, '#6B6F7A', 2.8);
  box(g, x - 12, base - 206, 24, 58, 5, '#2B2B30', 3.5);
  disc(g, x, base - 190, 8, '#6B2222', 1.6);
  disc(g, x, base - 165, 9, '#123A22', 1.6);
  // grünes Ampelmännchen mit Hut
  const c = '#4BE38C';
  const y = base - 165;
  disc(g, x + 1, y - 5, 2, c, 0);
  stroke(g, [x - 2, y - 7, x + 4.5, y - 7], c, 1.4);
  stroke(g, [x + 0.5, y - 3, x, y + 1], c, 2.6);
  stroke(g, [x, y + 1, x - 3.5, y + 6], c, 1.8);
  stroke(g, [x, y + 1, x + 3.5, y + 5.5], c, 1.8);
  stroke(g, [x - 4, y - 1.5, x + 4.5, y - 2.5], c, 1.6);
}

function bank(g, x, base) {
  box(g, x + 6, base - 20, 5, 20, 1, '#2F5B4B', 2.4);
  box(g, x + 59, base - 20, 5, 20, 1, '#2F5B4B', 2.4);
  box(g, x, base - 26, 70, 7, 2, '#A9743C', 2.8);
  box(g, x + 2, base - 46, 66, 6, 2, '#A9743C', 2.8);
  box(g, x + 2, base - 37, 66, 6, 2, '#A9743C', 2.8);
  sitzTaube(g, x + 20, base - 46, -1);
}

function drawNear(g) {
  const H = NEAR.h;
  const autumn = [
    ['#F08A24', '#FFB347', '#D9652B'],
    ['#F5B83D', '#FFDD6E', '#E0962B'],
    ['#DD5A33', '#F58A4B', '#B8432B'],
  ];
  bank(g, 1392, H);
  baum(g, 90, H, 300, autumn[0], 1);
  laterne(g, 235, H, 1);
  litfass(g, 352, H);
  baum(g, 505, H, 330, autumn[1], 2);
  ampel(g, 640, H);
  laterne(g, 722, H, 0);
  baum(g, 860, H, 285, autumn[2], 3);
  currybude(g, 965, H);
  laterne(g, 1180, H, 2);
  baum(g, 1300, H, 315, autumn[0], 4);
  baum(g, 1560, H, 280, autumn[1], 5);
  haze(g, NEAR.w, H, 'rgba(255,222,180,.1)');
}

// ------------------------------------------------------------------ Stau

function rad(g, x, y, r) {
  disc(g, x, y, r, '#33333B', 3.5);
  disc(g, x, y, r * 0.45, '#C9CED6', 2);
}

function kopf(g, r, x, y) {
  disc(g, x, y, 6.5, r.pick(['#E9B48E', '#F1C6A3', '#C98F6E']), 1.8);
  g.beginPath();
  g.arc(x, y - 1.5, 6.8, Math.PI, 0);
  g.closePath();
  ink(g, r.pick(['#5A3A2A', '#2B2B30', '#E5484D', '#F5B83D', '#8E5BD0']), 1.6);
}

function bus(g, x, base) {
  const r = createRng(31);
  const W = 262;
  box(g, x, base - 156, W, 144, 13, '#FFD23F', 4);
  box(g, x + 2, base - 54, W - 4, 40, 0, '#F4B91F', 0);
  box(g, x, base - 156, W, 144, 13, null, 4);
  // Oberdeck
  for (let i = 0; i < 6; i++) {
    const wx = x + 12 + i * 41;
    box(g, wx, base - 146, 35, 34, 4, '#7C93A8', 2.6);
    if (r.chance(0.75)) kopf(g, r, wx + r.range(10, 25), base - 122);
  }
  // Zielanzeige zwischen den Decks
  box(g, x, base - 106, W, 17, 0, '#2B2B30', 2.6);
  label(g, 'M46 SÜDKREUZ · +45 MIN', x + W / 2, base - 97, 11, '#FFB52E', { font: NUNITO, weight: 800 });
  // Unterdeck mit Tür, vorn (rechts) der Fahrer
  for (let i = 0; i < 4; i++) {
    const wx = x + 12 + i * 41;
    box(g, wx, base - 82, 35, 32, 4, '#7C93A8', 2.6);
    if (r.chance(0.7)) kopf(g, r, wx + r.range(10, 25), base - 60);
  }
  box(g, x + 178, base - 84, 34, 68, 3, '#7C93A8', 2.8);
  stroke(g, [x + 195, base - 84, x + 195, base - 16], INK, 2);
  box(g, x + 220, base - 84, 34, 36, 5, '#BFE6F5', 2.8);
  kopf(g, r, x + 236, base - 62);
  disc(g, x + 254, base - 30, 5, '#FFF4C2', 2.2);
  rad(g, x + 54, base - 16, 17);
  rad(g, x + 150, base - 16, 17);
  label(g, 'BERLIN ♥ STAU', x + 92, base - 34, 11, '#7A3D0A');
  sitzTaube(g, x + 70, base - 156, 1);
}

function taxi(g, x, base) {
  poly(g, [x + 30, base - 44, x + 48, base - 72, x + 116, base - 72, x + 134, base - 44], '#F3E7B8', 3.5);
  poly(g, [x + 40, base - 46, x + 53, base - 66, x + 78, base - 66, x + 78, base - 46], '#7C93A8', 2.4);
  poly(g, [x + 84, base - 46, x + 84, base - 66, x + 111, base - 66, x + 124, base - 46], '#7C93A8', 2.4);
  box(g, x, base - 46, 160, 34, 10, '#F3E7B8', 3.5);
  box(g, x + 68, base - 84, 28, 12, 3, '#FFD23F', 2.6);
  label(g, 'TAXI', x + 82, base - 77.5, 8, INK, { font: NUNITO, weight: 800 });
  disc(g, x + 154, base - 34, 4.5, '#FFF4C2', 2);
  stroke(g, [x + 4, base - 30, x + 156, base - 30], INK_SOFT, 1.6);
  rad(g, x + 34, base - 14, 13);
  rad(g, x + 126, base - 14, 13);
  // Hupkonzert
  g.save();
  g.translate(x + 150, base - 108);
  g.rotate(-0.16);
  label(g, 'TUUUT!', 0, 0, 20, '#FFD23F', { lw: 5 });
  g.restore();
  stroke(g, [x + 166, base - 50, x + 178, base - 56], INK, 2.4);
  stroke(g, [x + 167, base - 40, x + 181, base - 40], INK, 2.4);
}

function trabi(g, x, base) {
  const blue = '#8EC5E6';
  // Koffer auf dem Dach
  box(g, x + 44, base - 86, 40, 16, 3, '#B5653A', 2.6);
  stroke(g, [x + 56, base - 86, x + 56, base - 70], INK, 1.5);
  stroke(g, [x + 72, base - 86, x + 72, base - 70], INK, 1.5);
  box(g, x + 26, base - 70, 78, 30, 5, blue, 3.5);
  box(g, x + 33, base - 64, 28, 20, 2, '#7C93A8', 2.4);
  box(g, x + 67, base - 64, 30, 20, 2, '#7C93A8', 2.4);
  box(g, x, base - 44, 130, 32, 6, blue, 3.5);
  disc(g, x + 123, base - 32, 5.5, '#FFF4C2', 2.2);
  box(g, x + 118, base - 20, 14, 6, 2, '#C9CED6', 2);
  rad(g, x + 28, base - 13, 12);
  rad(g, x + 102, base - 13, 12);
  // Zweitakt-Wölkchen
  for (const [dx, dy, rr2] of [[-10, -18, 7], [-22, -26, 9], [-37, -36, 11]]) disc(g, x + dx, base + dy, rr2, 'rgba(255,255,255,.75)', 1.6, INK_SOFT);
}

function lieferwagen(g, x, base) {
  box(g, x, base - 110, 124, 98, 6, '#FFF4E2', 3.5);
  poly(g, [x + 124, base - 86, x + 152, base - 86, x + 172, base - 52, x + 172, base - 12, x + 124, base - 12], ORANGE, 3.5);
  poly(g, [x + 130, base - 80, x + 150, base - 80, x + 164, base - 54, x + 130, base - 54], '#BFE6F5', 2.4);
  box(g, x, base - 30, 124, 8, 0, ORANGE, 2.4);
  label(g, 'KATER-', x + 62, base - 92, 17, ORANGE, { lw: 3 });
  label(g, 'SNACKS', x + 62, base - 73, 17, ORANGE, { lw: 3 });
  // Knusperfisch als Logo
  poly(g, [x + 74, base - 48, x + 86, base - 57, x + 86, base - 39], '#E39A3B', 2.2);
  oval(g, x + 62, base - 48, 14, 8.5, '#F5B94E', 2.4);
  disc(g, x + 55, base - 50, 1.6, INK, 0);
  disc(g, x + 168, base - 30, 4.5, '#FFF4C2', 2);
  rad(g, x + 34, base - 14, 14);
  rad(g, x + 140, base - 14, 14);
}

function drawTraffic(g) {
  const H = TRAFFIC.h;
  bus(g, 70, H);
  taxi(g, 420, H);
  trabi(g, 640, H);
  lieferwagen(g, 1150, H);
  haze(g, TRAFFIC.w, H, 'rgba(255,222,180,.07)');
}

// Radfahrer mit Brezel im Korb: einzige bewegte Figur der Kulisse, daher pro Frame gezeichnet.
function radler(g, x, base, time) {
  const a = time * 9;
  g.save();
  g.translate(x, base);
  for (const wx of [-24, 24]) {
    disc(g, wx, -17, 16, 'rgba(255,255,255,.18)', 3.2);
    for (let i = 0; i < 3; i++) stroke(g, [wx + Math.cos(a + i * 2.1) * 14, -17 + Math.sin(a + i * 2.1) * 14, wx - Math.cos(a + i * 2.1) * 14, -17 - Math.sin(a + i * 2.1) * 14], INK_SOFT, 1.2);
  }
  stroke(g, [-24, -17, -6, -42, 14, -42, 24, -17], INK, 5.5);
  stroke(g, [-24, -17, -6, -42, 14, -42, 24, -17], '#3F9B5A', 2.6);
  stroke(g, [-6, -42, 0, -17, 14, -42], INK, 5);
  stroke(g, [-6, -42, 0, -17, 14, -42], '#3F9B5A', 2.4);
  stroke(g, [14, -42, 18, -54, 25, -54], INK, 3);
  box(g, 22, -52, 16, 12, 2, '#D39A56', 2.2);
  disc(g, 30, -56, 5, null, 2.6, '#B5651D');
  // Beine treten
  const px = Math.cos(a) * 7;
  const py = Math.sin(a) * 7;
  limb(g, [-6, -48, 2 + px * 0.6, -32 + py * 0.3, px, -17 + py], 5, '#3B4A6B', 2);
  // Oberkörper, Schal, Mütze
  limb(g, [-6, -48, 4, -68], 11, '#FFD23F', 2.6);
  limb(g, [4, -66, 18, -55], 4.5, '#FFD23F', 2);
  stroke(g, [2, -72, -16, -74 + Math.sin(time * 12) * 3, -26, -68 + Math.sin(time * 12 + 1) * 4], '#E5484D', 4);
  disc(g, 6, -80, 9, '#F1C6A3', 2.6);
  g.beginPath();
  g.arc(6, -82, 9.4, Math.PI, 0);
  g.closePath();
  ink(g, '#E5484D', 2.4);
  disc(g, 6, -92, 2.6, '#FFFFFF', 1.6);
  disc(g, 10, -79, 1.1, INK, 0);
  g.restore();
}

// ------------------------------------------------------------------ Straße

function drawGround(g) {
  const { w: W, h: H, top } = GROUND;
  const G = -top; // Huflinie im Sprite
  const r = createRng(42);
  // Kopfsteinpflaster: Reihen werden nach unten größer
  const street0 = G - 32;
  const street1 = G + 206;
  const grad = g.createLinearGradient(0, street0, 0, street1);
  grad.addColorStop(0, '#A9937C');
  grad.addColorStop(1, '#95806B');
  g.fillStyle = grad;
  g.fillRect(-2, street0, W + 4, street1 - street0);
  const stones = ['#D8C6AE', '#CDB9A0', '#C4AE94', '#DCCDB8', '#BFA88E'];
  let y = street0 + 1;
  let row = 0;
  while (y < street1) {
    const rh = 9 + row * 1.15;
    const sw = rh * 1.7;
    for (let x = -sw + (row % 2) * sw * 0.5; x < W + sw; x += sw) {
      const k = r.range(0.82, 1);
      rr(g, x + 1, y + 1, sw * k - 1.5, rh - 2, Math.min(4, rh * 0.3));
      g.fillStyle = r.pick(stones);
      g.fill();
    }
    y += rh;
    row++;
  }
  // Gullydeckel und Flickstelle
  oval(g, 430, G + 124, 34, 13, '#8C7B6B', 3);
  oval(g, 430, G + 124, 24, 8.5, null, 1.8);
  stroke(g, [410, G + 124, 450, G + 124], INK, 1.8);
  // Laub auf der Straße
  for (let i = 0; i < 46; i++) {
    const ly = r.range(street0 + 6, street1 - 6);
    const s = 7 + ((ly - street0) / (street1 - street0)) * 8;
    leaf(g, r.range(0, W), ly, s * r.range(0.8, 1.3), r.range(0, 6), r.pick(LEAF_COLORS), 1.4);
  }
  // Mittelstreifen: Bordstein mit Herbsthecke, verdeckt die Räder der Autos dahinter
  const hedge = ['#C98A2B', '#B8923A', '#D9722B', '#A99A3E', '#E0A030'];
  for (let pass = 0; pass < 2; pass++) {
    const rh = createRng(9);
    for (let x = 0; x < W; x += 15) {
      const br = rh.range(9, 13);
      g.beginPath();
      g.arc(x + rh.range(-2, 2), G - 44 - rh.range(0, 4), br, 0, TAU);
      if (pass === 0) ink(g, null, 6);
      else ink(g, rh.pick(hedge), 0);
    }
  }
  for (let i = 0; i < 30; i++) leaf(g, r.range(0, W), G - r.range(42, 56), 7, r.range(0, 6), r.pick(LEAF_COLORS), 1);
  box(g, -4, G - 40, W + 8, 9, 0, '#E3D3BA', 3);
  for (let x = 30; x < W; x += 75) stroke(g, [x, G - 39, x, G - 32], INK_SOFT, 1.6);
  // vorderer Bordstein und Gehweg
  g.fillStyle = '#E2D2B8';
  g.fillRect(-2, street1 + 10, W + 4, H - street1);
  for (let sy = street1 + 14, k = 0; sy < H; sy += 46 + k * 6, k++) {
    stroke(g, [0, sy + 40, W, sy + 40], 'rgba(59,42,34,.28)', 1.8);
    for (let x = (k % 2) * 50; x < W; x += 100) stroke(g, [x, sy, x, sy + 40], 'rgba(59,42,34,.28)', 1.8);
  }
  box(g, -4, street1, W + 8, 12, 0, '#F0E3CD', 3);
  for (let x = 50; x < W; x += 100) stroke(g, [x, street1 + 1, x, street1 + 11], INK_SOFT, 1.6);
  for (let i = 0; i < 22; i++) leaf(g, r.range(0, W), r.range(street1 + 20, H - 8), r.range(11, 17), r.range(0, 6), r.pick(LEAF_COLORS), 1.6);
}

// ------------------------------------------------------------------ Vordergrund

function poller(g, x, base) {
  box(g, x - 7, base - 58, 14, 58, 4, '#FFFFFF', 4);
  g.save();
  rr(g, x - 7, base - 58, 14, 58, 4);
  g.clip();
  g.fillStyle = '#E5484D';
  g.fillRect(x - 8, base - 50, 16, 13);
  g.fillRect(x - 8, base - 24, 16, 13);
  g.restore();
  box(g, x - 7, base - 58, 14, 58, 4, null, 4);
}

function haufen(g, x, base, s, seed) {
  const r = createRng(seed);
  g.beginPath();
  g.moveTo(x - 46 * s, base);
  g.quadraticCurveTo(x - 40 * s, base - 30 * s, x - 12 * s, base - 36 * s);
  g.quadraticCurveTo(x + 10 * s, base - 50 * s, x + 26 * s, base - 30 * s);
  g.quadraticCurveTo(x + 48 * s, base - 22 * s, x + 46 * s, base);
  g.closePath();
  ink(g, '#D9762B', 4.5);
  for (let i = 0; i < 12; i++) leaf(g, x + r.range(-36, 36) * s, base - r.range(4, 30) * s, r.range(13, 19) * s, r.range(0, 6), r.pick(LEAF_COLORS), 1.8);
}

function kuerbis(g, x, base, s) {
  oval(g, x, base - 15 * s, 20 * s, 15 * s, ORANGE, 4);
  oval(g, x, base - 15 * s, 9 * s, 15 * s, null, 2);
  box(g, x - 3 * s, base - 36 * s, 6 * s, 9 * s, 2, '#5E7A3A', 3);
}

function drawFront(g) {
  const H = FRONT.h;
  haufen(g, 110, H, 1.1, 3);
  poller(g, 330, H);
  poller(g, 380, H);
  // Hydrant
  box(g, 596, H - 46, 24, 46, 5, '#E5484D', 4.5);
  box(g, 590, H - 54, 36, 10, 4, '#E5484D', 4);
  disc(g, 608, H - 26, 6, '#FFD23F', 3);
  box(g, 616, H - 34, 12, 10, 2, '#E5484D', 3.5);
  haufen(g, 850, H, 0.8, 7);
  poller(g, 1040, H);
  poller(g, 1090, H);
  poller(g, 1140, H);
  kuerbis(g, 1330, H, 1.25);
  kuerbis(g, 1366, H, 0.8);
  box(g, 1392, H - 30, 50, 30, 3, '#D39A56', 4);
  stroke(g, [1392, H - 15, 1442, H - 15], INK, 2);
  label(g, 'ÄPFEL', 1417, H - 22, 10, INK, { font: NUNITO, weight: 800 });
  for (const ax of [1402, 1417, 1432]) disc(g, ax, H - 34, 7, '#E5484D', 3);
}

// ------------------------------------------------------------------ Bahnhof

function drawStation(g) {
  const { w: W, h: H } = STATION;
  const steel = '#7A8793';
  // Glashalle
  const arc = () => {
    g.beginPath();
    g.moveTo(24, H - 250);
    g.bezierCurveTo(180, H - 500, W - 180, H - 500, W - 24, H - 250);
    g.closePath();
  };
  arc();
  ink(g, '#BFE3EE', 5);
  g.save();
  arc();
  g.clip();
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(0, H - 440, W, 46);
  for (let x = 60; x < W; x += 58) stroke(g, [x, H - 250, x, H - 470], steel, 3);
  for (const k of [0.33, 0.66]) {
    g.beginPath();
    g.moveTo(24, H - 250);
    g.bezierCurveTo(180, H - 250 - 250 * k, W - 180, H - 250 - 250 * k, W - 24, H - 250);
    g.strokeStyle = steel;
    g.lineWidth = 3;
    g.stroke();
  }
  g.restore();
  arc();
  ink(g, null, 5);
  // Fassade
  box(g, 14, H - 262, W - 28, 262, 0, '#F2DFBC', 5);
  box(g, 6, H - 272, W - 12, 18, 3, '#D9B98A', 4);
  for (let x = 14; x < W - 20; x += 20) stroke(g, [x + 10, H - 250, x + 10, H - 6], 'rgba(59,42,34,.06)', 2);
  // Bahnsteighalle mit Zug
  const px = 330;
  const pw = W - px - 40;
  box(g, px, H - 170, pw, 170, 8, '#54433C', 5);
  g.save();
  rr(g, px, H - 170, pw, 170, 8);
  g.clip();
  g.fillStyle = '#8D7B6D';
  g.fillRect(px, H - 28, pw, 28);
  g.fillStyle = '#FFD23F';
  g.fillRect(px, H - 28, pw, 4);
  // ICE: weiß mit rotem Streifen, Nase links
  g.beginPath();
  g.moveTo(px + 60, H - 30);
  g.quadraticCurveTo(px + 50, H - 86, px + 124, H - 124);
  g.lineTo(px + pw + 10, H - 124);
  g.lineTo(px + pw + 10, H - 30);
  g.closePath();
  ink(g, '#FAF7F0', 4);
  g.fillStyle = '#E5484D';
  g.fillRect(px + 62, H - 62, pw, 9);
  g.beginPath();
  g.moveTo(px + 86, H - 76);
  g.quadraticCurveTo(px + 96, H - 104, px + 136, H - 112);
  g.lineTo(px + 150, H - 112);
  g.lineTo(px + 150, H - 76);
  g.closePath();
  ink(g, '#33414F', 3);
  for (let x = px + 170; x < px + pw; x += 62) box(g, x, H - 110, 48, 30, 5, '#33414F', 3);
  disc(g, px + 76, H - 46, 5, '#FFF4C2', 2.4);
  g.restore();
  box(g, px, H - 170, pw, 170, 8, null, 5);
  // Abfahrtstafel
  box(g, px + 250, H - 236, 250, 56, 5, '#2B2B30', 4);
  label(g, 'ICE 2026   →  ???', px + 375, H - 219, 17, '#FFB52E', { font: NUNITO, weight: 800 });
  label(g, 'Abfahrt: gleich!  Gleis 3', px + 375, H - 197, 14, '#FFB52E', { font: NUNITO, weight: 800 });
  // Eingang links mit Wimpelkette
  for (const x of [70, 190]) {
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x, H - 110);
    g.arc(x + 40, H - 110, 40, Math.PI, 0);
    g.lineTo(x + 80, H);
    g.closePath();
    ink(g, '#54433C', 5);
    stroke(g, [x + 40, H - 150, x + 40, H], '#7A6A5E', 3);
  }
  // Bahnhofsuhr: kurz vor knapp
  disc(g, 172, H - 212, 30, '#FFFFFF', 5);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    stroke(g, [172 + Math.cos(a) * 22, H - 212 + Math.sin(a) * 22, 172 + Math.cos(a) * 26, H - 212 + Math.sin(a) * 26], INK, 2.4);
  }
  stroke(g, [172, H - 212, 164, H - 232], INK, 4);
  stroke(g, [172, H - 212, 170, H - 236], '#E5484D', 2.4);
  stroke(g, [172, H - 212, 160, H - 222], INK, 4.5);
  disc(g, 172, H - 212, 3, INK, 0);
  // großes Bahnhofsschild über allem
  box(g, 196, H - 356, 568, 78, 12, '#1F3A8A', 5.5);
  box(g, 204, H - 348, 552, 62, 8, null, 2.4, '#FFFFFF');
  disc(g, 250, H - 317, 23, '#3F9B5A', 3, '#FFFFFF');
  label(g, 'S', 250, H - 315, 30, '#FFFFFF', { font: NUNITO, weight: 800 });
  label(g, 'Berlin Südkreuz', 510, H - 315, 48, '#FFFFFF', { font: NUNITO, weight: 800 });
  for (const x of [226, 734]) box(g, x - 5, H - 280, 10, 12, 0, '#5B5F6B', 3);
  // Wimpelkette
  const flags = [ORANGE, '#FFD23F', '#FFF4E2', '#E5484D', '#7CC4F0'];
  for (let i = 0; i < 15; i++) {
    const fx = 30 + i * 20;
    const fy = H - 176 + Math.sin((i / 14) * Math.PI) * 18;
    poly(g, [fx, fy, fx + 16, fy + 1, fx + 8, fy + 18], flags[i % flags.length], 2.4);
  }
  // Blumenkübel
  for (const x of [34, 296]) {
    box(g, x - 16, H - 26, 32, 26, 3, '#B5653A', 4);
    for (const [dx, dy, c] of [[-10, -32, ORANGE], [0, -40, '#FFD23F'], [10, -32, '#E5484D']]) disc(g, x + dx, H + dy, 8, c, 3);
  }
}

function drawSignpost(g) {
  const { w: W, h: H } = SIGNPOST;
  limb(g, [W / 2, H, W / 2, 50], 7, '#7A808C', 3);
  box(g, 6, 8, W - 12, 78, 9, '#1F3A8A', 5);
  box(g, 12, 14, W - 24, 66, 6, null, 2, '#FFFFFF');
  label(g, 'Südkreuz', W / 2, 36, 31, '#FFFFFF', { font: NUNITO, weight: 800 });
  label(g, 'noch 300 m  →', W / 2, 64, 19, '#FFD23F', { font: NUNITO, weight: 800 });
}

function drawClouds(g) {
  const puff = (x, y, s) => {
    for (const [dx, dy, rr2] of [[-34, 6, 20], [-8, -8, 28], [24, -2, 23], [50, 8, 16], [8, 10, 24]]) disc(g, x + dx * s, y + dy * s, rr2 * s, '#FFF1DC', 0);
    oval(g, x + 8 * s, y + 20 * s, 62 * s, 10 * s, '#FFD9B0', 0);
  };
  puff(120, 70, 1.2);
  puff(430, 150, 0.8);
  puff(700, 60, 1);
  puff(960, 170, 1.3);
}

// ------------------------------------------------------------------ Aufbau und Zeichnen

/**
 * res = Pixel je Einheit auf dem Bildschirm-Canvas. Baut alle Sprites.
 */
export function createScene(res) {
  const s = {
    far: makeSprite(FAR.w, FAR.h, res * 0.8, drawFar),
    mid: tile(MID.w, MID.h, res, drawMid),
    tor: makeSprite(320, 250, res, (g) => drawTor(g, 320, 250)),
    saeule: makeSprite(110, 360, res, (g) => drawSaeule(g, 110, 360)),
    near: tile(NEAR.w, NEAR.h, res, drawNear),
    traffic: tile(TRAFFIC.w, TRAFFIC.h, res, drawTraffic),
    ground: tile(GROUND.w, GROUND.h, res, drawGround),
    front: tile(FRONT.w, FRONT.h, res, drawFront),
    station: makeSprite(STATION.w, STATION.h, res, drawStation),
    signpost: makeSprite(SIGNPOST.w, SIGNPOST.h, res, drawSignpost),
    clouds: tile(1100, 230, res * 0.7, drawClouds),
  };
  const snap = (v) => Math.round(v * res) / res;

  function tiled(g, sp, offset, y, vw) {
    const x0 = -(((offset % sp.w) + sp.w) % sp.w);
    for (let x = x0; x < vw; x += sp.w) g.drawImage(sp.c, snap(x), snap(y), sp.w, sp.h);
  }

  let sky = null;
  let skyKey = '';

  return {
    /**
     * Alles hinter dem Gespann. env = { vw, vh, G, dist, time }
     */
    drawBack(g, env) {
      const { vw, vh, G, dist, time } = env;
      const key = vw + ':' + G;
      if (key !== skyKey) {
        skyKey = key;
        sky = g.createLinearGradient(0, 0, 0, G - 100);
        sky.addColorStop(0, '#6FA9DB');
        sky.addColorStop(0.45, '#A9CDE6');
        sky.addColorStop(0.78, '#FCE3B6');
        sky.addColorStop(1, '#FFC27A');
      }
      g.fillStyle = sky;
      g.fillRect(0, 0, vw, G);
      // tief stehende Abendsonne
      const sx = vw * 0.74;
      const sy = G - 330;
      const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 260);
      glow.addColorStop(0, 'rgba(255,244,200,.95)');
      glow.addColorStop(0.2, 'rgba(255,226,160,.55)');
      glow.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = glow;
      g.fillRect(sx - 260, sy - 260, 520, 520);
      disc(g, sx, sy, 44, '#FFF6D6', 0);
      tiled(g, s.clouds, dist * 0.02 + time * 5, Math.max(30, G - 760), vw);

      g.drawImage(s.far.c, snap(-dist * FAR.par), snap(G + FAR.base - s.far.h), s.far.w, s.far.h);

      // Wahrzeichen in den Lücken der Häuserzeile
      const midOff = dist * MID.par;
      const gapMid = MID.gapAt + (s.mid.w - MID.gapAt) / 2;
      for (let k = 0; k < 3; k++) {
        const sp = k === 0 ? s.tor : k === 1 ? s.saeule : null;
        if (!sp) continue;
        const x = gapMid + k * s.mid.w - midOff - sp.w / 2;
        if (x < vw && x + sp.w > 0) g.drawImage(sp.c, snap(x), snap(G + MID.base - sp.h), sp.w, sp.h);
      }
      tiled(g, s.mid, midOff, G + MID.base - s.mid.h, vw);

      // hinterer Gehweg und Gegenfahrbahn
      g.fillStyle = '#E2D2B8';
      g.fillRect(0, G - 110, vw, 20);
      g.fillStyle = '#A9937C';
      g.fillRect(0, G - 92, vw, 60);
      stroke(g, [0, G - 92, vw, G - 92], INK, 3);

      tiled(g, s.near, dist * NEAR.par, G + NEAR.base - s.near.h, vw);
      tiled(g, s.traffic, dist * TRAFFIC.par + 260, G + TRAFFIC.base - s.traffic.h, vw);
      // Radfahrer fährt in dieselbe Richtung, nur langsamer
      const span = 1900;
      const cx = ((((1050 + time * 120 * TRAFFIC.par - dist * TRAFFIC.par) % span) + span) % span) - 150;
      if (cx < vw + 60) radler(g, cx, G + TRAFFIC.base + 4, time);

      // Wegweiser und Bahnhof stehen an der Strecke
      const px = PLAYER_X + (SIGNPOST.x - dist);
      if (px < vw && px + s.signpost.w > 0) g.drawImage(s.signpost.c, snap(px), snap(G + SIGNPOST.base - s.signpost.h), s.signpost.w, s.signpost.h);
      const stx = PLAYER_X + (STATION.x - dist);
      if (stx < vw && stx + s.station.w > 0) g.drawImage(s.station.c, snap(stx), snap(G + STATION.base - s.station.h), s.station.w, s.station.h);

      tiled(g, s.ground, dist, G + GROUND.top, vw);
      if (G + GROUND.top + s.ground.h < vh) {
        g.fillStyle = '#E2D2B8';
        g.fillRect(0, G + GROUND.top + s.ground.h - 1, vw, vh);
      }
    },
    drawFront(g, env) {
      tiled(g, s.front, env.dist * FRONT.par + 700, env.G + FRONT.base - s.front.h, env.vw);
    },
  };
}
