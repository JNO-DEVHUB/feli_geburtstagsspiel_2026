// Reihenfolge des ersten Durchlaufs als reine Daten. Ein Schritt ist ein String:
// 'card' | 'trailer' | 'prolog' | 'story:N' | 'game:N' | 'frame:N' | 'finale' | 'voucher' | 'hall'

import { CHAPTER_COUNT } from './core/progress.js';

export const STEPS = Object.freeze([
  'card',
  'trailer',
  'prolog',
  ...Array.from({ length: CHAPTER_COUNT }, (_, i) => [`story:${i}`, `game:${i}`, `frame:${i}`]).flat(),
  'finale',
  'voucher',
  'hall',
]);

export function parseStep(step) {
  const [kind, n] = String(step).split(':');
  return { kind, chapter: n === undefined ? null : Number(n) };
}

export function nextStep(step) {
  const i = STEPS.indexOf(step);
  return i < 0 || i >= STEPS.length - 1 ? 'hall' : STEPS[i + 1];
}

export function prevStep(step) {
  const i = STEPS.indexOf(step);
  return i <= 0 ? STEPS[0] : STEPS[i - 1];
}

// Wo geht es nach einem Neuladen weiter?
// - Erster Durchlauf erledigt: Spielesaal.
// - Mitten im Spiel neu geladen: zurück an den Anfang des Kapitels (das Spiel gilt nicht als verloren).
// - Ergebnis schon gespeichert ('frame:N'): beim Bilderrahmen, kein zweiter Versuch.
export function resumeStep(progress) {
  if (progress.firstRunDone) return 'hall';
  const step = STEPS.includes(progress.step) ? progress.step : 'card';
  const { kind, chapter } = parseStep(step);
  if (kind === 'game') return `story:${chapter}`;
  if (kind === 'frame' && progress.results[chapter] === null) return `story:${chapter}`;
  return step;
}
