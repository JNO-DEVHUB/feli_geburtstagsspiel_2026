import test from 'node:test';
import assert from 'node:assert/strict';
import { clearedFraction, createScratchGrid, markStroke } from '../src/core/scratch.js';

test('leeres Raster: nichts freigewischt', () => {
  assert.equal(clearedFraction(createScratchGrid()), 0);
});

test('ein Tupfer in der Mitte markiert nur die Umgebung', () => {
  const g = createScratchGrid(20, 20);
  markStroke(g, 0.5, 0.5, 0.5, 0.5, 0.1);
  const f = clearedFraction(g);
  assert.ok(f > 0.015 && f < 0.06, String(f));
});

test('Zellen zählen nur einmal', () => {
  const g = createScratchGrid(20, 20);
  markStroke(g, 0.1, 0.5, 0.9, 0.5, 0.1);
  const once = g.count;
  markStroke(g, 0.1, 0.5, 0.9, 0.5, 0.1);
  assert.equal(g.count, once);
});

test('Zickzack über die ganze Fläche kommt über 70 %', () => {
  const g = createScratchGrid();
  const aspect = 844 / 390;
  for (let i = 0; i < 12; i++) {
    const y = (i + 0.5) / 12;
    markStroke(g, 0.05, y, 0.95, y, 0.09, aspect);
  }
  assert.ok(clearedFraction(g) > 0.7, String(clearedFraction(g)));
});

test('Striche außerhalb der Fläche schaden nicht', () => {
  const g = createScratchGrid();
  markStroke(g, -2, -2, -1, -1, 0.1);
  markStroke(g, 3, 3, 4, 4, 0.1);
  assert.equal(g.count, 0);
});
