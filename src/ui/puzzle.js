// Puzzle: Raster 2 Spalten × 3 Zeilen (Hochformat). Jedes Teil ist ein echter Ausschnitt
// aus dem Puzzlebild mit Puzzlenasen-Maske, gezeichnet auf ein eigenes Canvas.

export const COLS = 2;
export const ROWS = 3;
export const PIECES = COLS * ROWS;
export const TAB = 0.24; // Überstand der Nasen relativ zur kürzeren Zellkante

export const pieceCell = (index) => ({ col: index % COLS, row: Math.floor(index / COLS) });

// Richtung der Nase an einer Innenkante: +1 = nach außen, -1 = nach innen, 0 = Rand.
export function pieceEdges(index) {
  const { col, row } = pieceCell(index);
  const v = (c, r) => ((c + r) % 2 === 0 ? 1 : -1); // Kante zwischen (c,r) und (c+1,r)
  const hz = (c, r) => ((c + r) % 2 === 0 ? -1 : 1); // Kante zwischen (c,r) und (c,r+1)
  return {
    top: row === 0 ? 0 : -hz(col, row - 1),
    right: col === COLS - 1 ? 0 : v(col, row),
    bottom: row === ROWS - 1 ? 0 : hz(col, row),
    left: col === 0 ? 0 : -v(col - 1, row),
  };
}

// Eine Kante von (0,0) nach (len,0) mit Nase; dir > 0 zeigt nach "links der Laufrichtung" (außen).
function edge(g, len, dir, tab) {
  if (!dir) {
    g.lineTo(len, 0);
    return;
  }
  const t = -dir * tab;
  const m = len / 2;
  const n = tab * 0.62;
  g.lineTo(m - n * 0.55, 0);
  g.bezierCurveTo(m - n * 0.2, t * 0.12, m - n * 1.25, t * 0.55, m - n * 0.9, t * 0.82);
  g.bezierCurveTo(m - n * 0.55, t * 1.12, m + n * 0.55, t * 1.12, m + n * 0.9, t * 0.82);
  g.bezierCurveTo(m + n * 1.25, t * 0.55, m + n * 0.2, t * 0.12, m + n * 0.55, 0);
  g.lineTo(len, 0);
}

export function tracePiece(g, x, y, w, h, edges, tab) {
  g.beginPath();
  g.save();
  g.translate(x, y);
  g.moveTo(0, 0);
  edge(g, w, edges.top, tab);
  g.translate(w, 0);
  g.rotate(Math.PI / 2);
  edge(g, h, edges.right, tab);
  g.translate(h, 0);
  g.rotate(Math.PI / 2);
  edge(g, w, edges.bottom, tab);
  g.translate(w, 0);
  g.rotate(Math.PI / 2);
  edge(g, h, edges.left, tab);
  g.restore();
  g.closePath();
}

// Canvas für ein Teil. cellW/cellH in CSS-Pixeln; das Canvas ist um den Nasen-Überstand größer.
// Rückgabe: { canvas, margin } – im Rahmen bei (col*cellW - margin, row*cellH - margin) platzieren.
export function makePieceCanvas(img, index, cellW, cellH, { dpr = Math.min(3, globalThis.devicePixelRatio || 1), ghost = false } = {}) {
  const tab = Math.min(cellW, cellH) * TAB;
  const margin = Math.ceil(tab) + 3;
  const { col, row } = pieceCell(index);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((cellW + margin * 2) * dpr);
  canvas.height = Math.round((cellH + margin * 2) * dpr);
  canvas.style.width = cellW + margin * 2 + 'px';
  canvas.style.height = cellH + margin * 2 + 'px';
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  tracePiece(g, margin, margin, cellW, cellH, pieceEdges(index), tab);
  if (ghost) {
    g.fillStyle = 'rgba(120,105,95,.55)';
    g.fill();
    g.setLineDash([5, 5]);
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(255,244,226,.5)';
    g.stroke();
    return { canvas, margin };
  }
  g.save();
  g.clip();
  g.drawImage(img, margin - col * cellW, margin - row * cellH, cellW * COLS, cellH * ROWS);
  g.restore();
  g.lineJoin = 'round';
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(59,42,34,.85)';
  g.stroke();
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.stroke();
  return { canvas, margin };
}
