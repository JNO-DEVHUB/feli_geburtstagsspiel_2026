// Rubbel-Fortschritt als grobes Raster: Welche Zellen hat der Finger schon freigewischt?
// Koordinaten normiert auf 0..1 (x über die Breite, y über die Höhe).

export function createScratchGrid(cols = 20, rows = 36) {
  return { cols, rows, cells: new Uint8Array(cols * rows), count: 0 };
}

// Markiert alle Zellen, deren Mittelpunkt höchstens r (in Breiten-Einheiten) von der Strecke entfernt ist.
// aspect = Höhe / Breite der Fläche, damit der Pinsel rund bleibt.
export function markStroke(grid, x0, y0, x1, y1, r, aspect = 1) {
  const { cols, rows, cells } = grid;
  const ry = r / aspect;
  const cMin = Math.max(0, Math.floor((Math.min(x0, x1) - r) * cols));
  const cMax = Math.min(cols - 1, Math.floor((Math.max(x0, x1) + r) * cols));
  const rMin = Math.max(0, Math.floor((Math.min(y0, y1) - ry) * rows));
  const rMax = Math.min(rows - 1, Math.floor((Math.max(y0, y1) + ry) * rows));
  const dx = x1 - x0;
  const dy = (y1 - y0) * aspect;
  const len2 = dx * dx + dy * dy;
  for (let row = rMin; row <= rMax; row++) {
    for (let col = cMin; col <= cMax; col++) {
      const i = row * cols + col;
      if (cells[i]) continue;
      const px = (col + 0.5) / cols - x0;
      const py = ((row + 0.5) / rows - y0) * aspect;
      const t = len2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
      const ex = px - dx * t;
      const ey = py - dy * t;
      if (ex * ex + ey * ey <= r * r) {
        cells[i] = 1;
        grid.count++;
      }
    }
  }
  return grid;
}

export const clearedFraction = (grid) => grid.count / grid.cells.length;
