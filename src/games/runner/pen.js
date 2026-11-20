// Zeichen-Helfer im Comic-Stil: Formen mit dicker dunkler Kontur, Gliedmaßen als umrandete
// Linienzüge, vorgerenderte Sprites (Offscreen-Canvas). Alle Maße in logischen Einheiten.

import { TAU } from '../../core/math.js';

export const INK = '#3B2A22';
export const LEAF_COLORS = ['#F07A1A', '#FFC233', '#E5484D', '#D9762B', '#F9A03F', '#C9532B'];

// Aktuellen Pfad füllen und umranden.
export function ink(g, fill, lw = 3.5, stroke = INK) {
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (lw) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }
}

// Pfad eines abgerundeten Rechtecks (ohne g.roundRect, das ältere Safari nicht kennen).
export function rr(g, x, y, w, h, r = 0) {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

export function box(g, x, y, w, h, r, fill, lw, stroke) {
  rr(g, x, y, w, h, r);
  ink(g, fill, lw, stroke);
}

export function disc(g, x, y, r, fill, lw, stroke) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  ink(g, fill, lw, stroke);
}

export function oval(g, x, y, rx, ry, fill, lw, rot = 0, stroke) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  ink(g, fill, lw, stroke);
}

// Vieleck aus [x0, y0, x1, y1, …].
export function poly(g, pts, fill, lw, stroke) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  ink(g, fill, lw, stroke);
}

export function stroke(g, pts, color, width, cap = 'round') {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = cap;
  g.lineJoin = 'round';
  g.stroke();
}

// Umrandeter Linienzug (Arm, Bein, Stange): erst dunkel und breit, dann farbig und schmaler.
export function limb(g, pts, width, fill, outline = 2.6, color = INK) {
  stroke(g, pts, color, width + outline * 2);
  stroke(g, pts, fill, width);
}

// Blatt: spitzes Oval mit Mittelrippe.
export function leaf(g, x, y, len, rot, fill, lw = 1.6) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.5, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.5, -len / 2, 0);
  ink(g, fill, lw);
  if (lw) {
    g.beginPath();
    g.moveTo(-len * 0.3, 0);
    g.lineTo(len * 0.35, 0);
    g.lineWidth = lw * 0.6;
    g.stroke();
  }
  g.restore();
}

// Blume mit fünf Blütenblättern (Girlande).
export function flower(g, x, y, r, fill, center = '#FFD23F', lw = 1.8) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - 1.2;
    disc(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, fill, lw);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - 1.2;
    disc(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, fill, 0);
  }
  disc(g, x, y, r * 0.36, center, lw * 0.7);
}

// Text mit dunkler Kontur.
export function label(g, text, x, y, size, fill, { font = "'Luckiest Guy', 'Arial Black', sans-serif", weight = 400, align = 'center', lw = 0, strokeColor = INK, base = 'middle' } = {}) {
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = base;
  if (lw) {
    g.strokeStyle = strokeColor;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.strokeText(text, x, y);
  }
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

/**
 * Vorgerendertes Sprite. w/h in Einheiten, res = Pixel je Einheit.
 * draw(g) zeichnet in Einheiten mit Ursprung links oben.
 * Rückgabe { c, w, h }: zeichnen mit g.drawImage(s.c, x, y, s.w, s.h). Ist res die Auflösung des
 * Ziel-Canvas und x/y auf Pixel gerundet, wird 1:1 kopiert (scharf, ohne Nähte).
 */
export function makeSprite(w, h, res, draw) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * res));
  c.height = Math.max(1, Math.round(h * res));
  const g = c.getContext('2d');
  g.scale(c.width / w, c.height / h);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  // tatsächliche Größe in Einheiten (auf ganze Pixel gerundet), damit Kacheln nahtlos anschließen
  return { c, w: c.width / res, h: c.height / res };
}

// Dunstschleier über alles bisher Gezeichnete (Luftperspektive für ferne Ebenen).
export function haze(g, w, h, color) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  g.restore();
}
