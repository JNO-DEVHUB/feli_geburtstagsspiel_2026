import { TAU } from '../core/math.js';

// Kleine Zeichen-Helfer für Canvas-2D in logischen Einheiten.

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

export function fillRR(g, x, y, w, h, r, fill) {
  rr(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}

export function circle(g, x, y, r, fill) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}

export function ellipse(g, x, y, rx, ry, fill, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}

export function poly(g, pts, fill) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

export function line(g, x0, y0, x1, y1, stroke, width = 1, cap = 'round') {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.lineCap = cap;
  g.stroke();
}

export function vGrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}

export function hGrad(g, x0, x1, stops) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}

// Laubkrone aus überlappenden Kreisen mit Lichtkante oben rechts.
export function canopy(g, cx, cy, r, base, light, seed = 0) {
  const blobs = [
    [0, 0, 1],
    [-0.55, 0.25, 0.72],
    [0.55, 0.2, 0.75],
    [-0.2, -0.45, 0.7],
    [0.3, -0.35, 0.65],
  ];
  for (const [bx, by, br] of blobs) circle(g, cx + bx * r, cy + by * r, br * r * (0.92 + ((seed * 7) % 3) * 0.04), base);
  g.save();
  g.globalAlpha = 0.5;
  for (const [bx, by, br] of blobs.slice(2)) {
    circle(g, cx + bx * r + br * r * 0.25, cy + by * r - br * r * 0.25, br * r * 0.55, light);
  }
  g.restore();
}

// Fenster-Raster auf einer Fassade.
export function windows(g, x, y, w, h, cols, rows, fill, frame) {
  const gw = w / cols;
  const gh = h / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const wx = x + c * gw + gw * 0.22;
      const wy = y + r * gh + gh * 0.18;
      const ww = gw * 0.56;
      const wh = gh * 0.6;
      if (frame) fillRR(g, wx - 1, wy - 1, ww + 2, wh + 2, 1.5, frame);
      fillRR(g, wx, wy, ww, wh, 1, fill);
    }
  }
}
