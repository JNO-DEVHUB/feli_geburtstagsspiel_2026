import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CARD, CHAPTERS, FRAME, HALL, PROLOG, TRAILER } from '../src/content.js';

const SPOILER = /k[öo]ln|comedy|chris\s*tall|1live|lanxess/i;

// Alles, was Feli vor dem Finale liest. Die Hinweiswörter im Bilderrahmen sind die gewollte Ausnahme.
function textsBeforeFinale() {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === 'string') out.push([path, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(CARD, 'CARD');
  walk(TRAILER, 'TRAILER');
  walk(PROLOG, 'PROLOG');
  walk(FRAME, 'FRAME');
  walk(HALL, 'HALL');
  CHAPTERS.forEach((c, i) => {
    const { hint: _hint, ...rest } = c;
    walk(rest, `CHAPTERS[${i}]`);
  });
  return out;
}

test('kein Text vor dem Finale verrät das Ziel', () => {
  for (const [path, text] of textsBeforeFinale()) assert.ok(!SPOILER.test(text), `Spoiler in ${path}: ${text}`);
});

test('sechs Kapitel mit Hinweiswörtern in der Reihenfolge der SPEC', () => {
  assert.deepEqual(CHAPTERS.map((c) => c.hint), ['ZUG', 'ZU ZWEIT', 'KÖLN', 'ARENA', '16.10.', 'COMEDY']);
  assert.deepEqual(CHAPTERS.map((c) => c.game), ['runner', 'meowdoku', 'wimmel', 'wordle', 'handball', 'lacher']);
  for (const c of CHAPTERS) {
    assert.ok(c.title && c.outroWin && c.outroLose && c.howto.length, c.game);
  }
});

test('Anrede: Spatzl statt Königin', () => {
  const all = JSON.stringify([CARD, TRAILER, PROLOG, CHAPTERS]);
  assert.ok(!/königin/i.test(all));
  assert.ok(/Spatzl/.test(all));
});

test('HTML-Titel und Manifest ohne Spoiler', async () => {
  const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  const manifest = await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
  assert.ok(build.includes('<title>Felis große Reise 👑</title>'));
  assert.ok(!SPOILER.test(manifest));
  const head = build.slice(build.indexOf('<!doctype'), build.indexOf('</head>'));
  assert.ok(!SPOILER.test(head));
});
