import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, PIECES, ROWS, pieceCell, pieceEdges } from '../src/ui/puzzle.js';

test('Raster 2 × 3 im Hochformat', () => {
  assert.equal(COLS, 2);
  assert.equal(ROWS, 3);
  assert.equal(PIECES, 6);
  assert.deepEqual(pieceCell(0), { col: 0, row: 0 });
  assert.deepEqual(pieceCell(3), { col: 1, row: 1 });
  assert.deepEqual(pieceCell(5), { col: 1, row: 2 });
});

test('Puzzlenasen passen zusammen: Nase trifft Bucht, Rand ist gerade', () => {
  for (let i = 0; i < PIECES; i++) {
    const { col, row } = pieceCell(i);
    const e = pieceEdges(i);
    assert.equal(e.top === 0, row === 0);
    assert.equal(e.bottom === 0, row === ROWS - 1);
    assert.equal(e.left === 0, col === 0);
    assert.equal(e.right === 0, col === COLS - 1);
    if (col < COLS - 1) assert.equal(e.right, -pieceEdges(i + 1).left);
    if (row < ROWS - 1) assert.equal(e.bottom, -pieceEdges(i + COLS).top);
  }
});
