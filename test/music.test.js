import test from 'node:test';
import assert from 'node:assert/strict';
import { MOODS, TRAILER_PLAN, createMusic } from '../src/audio/music.js';

test('sechs Stimmungen mit Tempo, vier Akkorden und gültigen Melodie-Indizes', () => {
  assert.deepEqual(Object.keys(MOODS).sort(), ['action', 'calm', 'party', 'show', 'tense', 'think']);
  for (const [name, m] of Object.entries(MOODS)) {
    assert.ok(m.tempo >= 60 && m.tempo <= 150, name);
    assert.equal(m.chords.length, 4, name);
    for (const chord of m.chords) {
      assert.equal(chord.length, 3, name);
      assert.ok(chord.every((n) => Number.isInteger(n) && n >= 36 && n <= 60), name);
    }
    for (const i of m.lead ?? []) assert.ok(i === null || (Number.isInteger(i) && i >= 0 && i <= 6), name);
    if (m.lead) assert.equal(m.lead.length, 32, name);
  }
});

test('ohne Audio-Kontext passiert nichts (kein Absturz, keine Stimmung hängt)', () => {
  const music = createMusic(() => null, () => null);
  music.setMood('calm');
  assert.equal(music.mood, 'calm');
  music.resume();
  music.duck();
  const stop = music.playTrailer(0);
  stop();
  music.setMood('gibtsnicht');
  assert.equal(music.mood, null);
});

test('Trailer-Plan: sechs Kapitel, Gesamtlänge zwischen 30 und 45 Sekunden', () => {
  const p = TRAILER_PLAN;
  assert.equal(p.chapters, 6);
  const bars = p.presents + p.title + p.chapters * p.chapter + p.train + p.outro;
  const seconds = bars * p.bar;
  assert.ok(seconds >= 30 && seconds <= 45, String(seconds));
  assert.ok(p.chapter * p.bar >= 3, 'jede Kapitel-Szene mindestens 3 Sekunden lesbar');
});
