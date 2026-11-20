import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, createProgressStore, defaultProgress, normalizeProgress, recordResult, wonCount } from '../src/core/progress.js';
import { STEPS, nextStep, parseStep, prevStep, resumeStep } from '../src/flow.js';

function memoryBackend(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
}

test('Standard-Stand: Karte, nichts gespielt', () => {
  const p = defaultProgress();
  assert.equal(p.step, 'card');
  assert.equal(p.firstRunDone, false);
  assert.deepEqual(p.results, [null, null, null, null, null, null]);
});

test('normalizeProgress repariert kaputte Daten', () => {
  assert.deepEqual(normalizeProgress(null), defaultProgress());
  assert.deepEqual(normalizeProgress('quatsch'), defaultProgress());
  const p = normalizeProgress({ step: 42, results: [true, 'ja', false], firstRunDone: 'yes', muted: true });
  assert.equal(p.step, 'card');
  assert.deepEqual(p.results, [true, null, false, null, null, null]);
  assert.equal(p.firstRunDone, false);
  assert.equal(p.muted, true);
});

test('recordResult: gewonnenes Teil bleibt gewonnen', () => {
  const p = defaultProgress();
  recordResult(p, 2, false);
  assert.equal(p.results[2], false);
  recordResult(p, 2, true);
  assert.equal(p.results[2], true);
  recordResult(p, 2, false);
  assert.equal(p.results[2], true);
  recordResult(p, 9, true);
  assert.equal(wonCount(p), 1);
});

test('Speicher überlebt Neuladen und kaputtes JSON', () => {
  const backend = memoryBackend();
  const a = createProgressStore(backend);
  a.update((p) => {
    p.step = 'story:3';
    recordResult(p, 0, true);
  });
  const b = createProgressStore(backend);
  assert.equal(b.get().step, 'story:3');
  assert.equal(b.get().results[0], true);
  backend.setItem(KEY, '{kaputt');
  assert.deepEqual(createProgressStore(backend).get(), defaultProgress());
});

test('Speicher ohne localStorage läuft im Arbeitsspeicher', () => {
  const s = createProgressStore(null);
  s.update((p) => recordResult(p, 1, true));
  assert.equal(s.get().results[1], true);
  assert.equal(s.persistent, false);
  const throwing = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const t = createProgressStore(throwing);
  t.update((p) => recordResult(p, 1, true));
  assert.equal(t.get().results[1], true);
});

test('reset behält die Ton-Einstellung', () => {
  const s = createProgressStore(memoryBackend());
  s.update((p) => {
    p.muted = true;
    p.firstRunDone = true;
  });
  s.reset();
  assert.equal(s.get().muted, true);
  assert.equal(s.get().firstRunDone, false);
});

test('Reihenfolge: Karte, Trailer, Prolog, 6 × (Story, Spiel, Rahmen), Finale, Gutschein, Saal', () => {
  assert.equal(STEPS.length, 3 + 18 + 3);
  assert.deepEqual(STEPS.slice(0, 6), ['card', 'trailer', 'prolog', 'story:0', 'game:0', 'frame:0']);
  assert.deepEqual(STEPS.slice(-4), ['frame:5', 'finale', 'voucher', 'hall']);
  assert.equal(nextStep('frame:5'), 'finale');
  assert.equal(nextStep('hall'), 'hall');
  assert.equal(prevStep('card'), 'card');
  assert.deepEqual(parseStep('game:4'), { kind: 'game', chapter: 4 });
  assert.deepEqual(parseStep('finale'), { kind: 'finale', chapter: null });
});

test('Neuladen im Spiel: zurück an den Kapitelanfang, Spiel gilt nicht als verloren', () => {
  const p = defaultProgress();
  p.step = 'game:2';
  assert.equal(resumeStep(p), 'story:2');
  assert.equal(p.results[2], null);
});

test('Neuladen am Bilderrahmen: Ergebnis bleibt, kein zweiter Versuch', () => {
  const p = defaultProgress();
  p.step = 'frame:2';
  recordResult(p, 2, false);
  assert.equal(resumeStep(p), 'frame:2');
  p.results[2] = null; // sollte nie vorkommen: dann lieber neu spielen lassen
  assert.equal(resumeStep(p), 'story:2');
});

test('Neuladen: unbekannter Schritt führt zur Karte, fertiger Durchlauf in den Saal', () => {
  const p = defaultProgress();
  p.step = 'gibtsnicht';
  assert.equal(resumeStep(p), 'card');
  p.step = 'story:4';
  assert.equal(resumeStep(p), 'story:4');
  p.firstRunDone = true;
  assert.equal(resumeStep(p), 'hall');
});
