import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import {
  BACK,
  ENTER,
  HINTS,
  KEY_ROWS,
  MAX_TRIES,
  SOLUTION,
  START_HINT,
  WORD_LENGTH,
  backspace,
  createState,
  hintFor,
  mergeKeyStates,
  missCount,
  normalizeLetter,
  scoreGuess,
  submit,
  typeLetter,
} from '../src/games/wordle/logic.js';

const H = 'hit';
const P = 'present';
const M = 'miss';

const typeWord = (state, word) => Array.from(word).reduce((s, ch) => typeLetter(s, ch), state);
const guess = (state, word) => submit(typeWord(state, word));

test('Konstanten: ARENA, 6 Versuche, 5 Buchstaben', () => {
  assert.equal(SOLUTION, 'ARENA');
  assert.equal(MAX_TRIES, 6);
  assert.equal(WORD_LENGTH, 5);
  assert.equal(Array.from(SOLUTION).length, WORD_LENGTH);
});

test('scoreGuess: die Lösung ist überall ein Treffer', () => {
  assert.deepEqual(scoreGuess('ARENA'), [H, H, H, H, H]);
  assert.deepEqual(scoreGuess('arena'), [H, H, H, H, H]);
});

test('scoreGuess: doppelte Buchstaben (ARENA hat zweimal A)', () => {
  assert.deepEqual(scoreGuess('AAAAA'), [H, M, M, M, H]);
  assert.deepEqual(scoreGuess('ALARM'), [H, M, P, P, M]);
  assert.deepEqual(scoreGuess('NASEN'), [P, P, M, P, M]);
  assert.deepEqual(scoreGuess('REGAL'), [P, P, M, P, M]);
  // drei A geraten, zwei gibt es: der Treffer hinten zählt zuerst, vorne bleibt nur noch ein „kommt vor“
  assert.deepEqual(scoreGuess('KAAAA'), [M, P, M, M, H]);
  assert.deepEqual(scoreGuess('TORTE'), [M, M, P, M, P]);
});

test('scoreGuess: andere Lösung, Umlaute und Unsinn laufen ohne Fehler', () => {
  assert.deepEqual(scoreGuess('TÖRÖÖ'), [M, M, P, M, M]);
  assert.deepEqual(scoreGuess('ÖÖÖÖÖ', 'KÖNIG'), [M, H, M, M, M]);
  assert.deepEqual(scoreGuess('LLAMA', 'HALLE'), [P, P, P, M, M]);
  assert.equal(scoreGuess('AR').length, WORD_LENGTH);
  assert.deepEqual(scoreGuess(''), [M, M, M, M, M]);
});

test('normalizeLetter: nur A–Z und Ä, Ö, Ü', () => {
  assert.equal(normalizeLetter('a'), 'A');
  assert.equal(normalizeLetter('Z'), 'Z');
  assert.equal(normalizeLetter('ä'), 'Ä');
  assert.equal(normalizeLetter('Ö'), 'Ö');
  assert.equal(normalizeLetter('ü'), 'Ü');
  assert.equal(normalizeLetter('ü'), 'Ü'); // zerlegtes ü (NFD)
  for (const bad of ['ß', '1', ' ', '', '-', 'AB', 'é', 'Enter', '⏎', '😀', null, undefined, 5]) assert.equal(normalizeLetter(bad), null, String(bad));
});

test('Tastatur: QWERTZ mit Umlauten, jede Buchstabentaste genau einmal', () => {
  assert.deepEqual(KEY_ROWS.map((r) => Array.from(r).length), [11, 11, 9]);
  const keys = Array.from(KEY_ROWS.join(''));
  assert.equal(keys.filter((k) => k === ENTER).length, 1);
  assert.equal(keys.filter((k) => k === BACK).length, 1);
  const lettersOnly = keys.filter((k) => k !== ENTER && k !== BACK);
  assert.equal(lettersOnly.length, 29);
  assert.equal(new Set(lettersOnly).size, 29);
  for (const k of lettersOnly) assert.equal(normalizeLetter(k), k);
  for (const ch of SOLUTION) assert.ok(lettersOnly.includes(ch));
});

test('mergeKeyStates: beste Farbe je Taste, nie schlechter', () => {
  let keys = mergeKeyStates({}, 'REGAL', scoreGuess('REGAL'));
  assert.deepEqual(keys, { R: P, E: P, G: M, A: P, L: M });
  const before = keys;
  keys = mergeKeyStates(keys, 'ALARM', scoreGuess('ALARM'));
  assert.equal(keys.A, H); // present → hit
  assert.equal(keys.R, P);
  assert.equal(keys.M, M);
  assert.deepEqual(before, { R: P, E: P, G: M, A: P, L: M }, 'Eingabe bleibt unverändert');
  // Derselbe Buchstabe später schlechter bewertet: Die Taste behält ihre Farbe.
  keys = mergeKeyStates(keys, 'KAAAK', [M, M, M, M, M]);
  assert.equal(keys.A, H);
  keys = mergeKeyStates(keys, 'RRRRR', [P, M, M, M, M]);
  assert.equal(keys.R, P);
  // Innerhalb eines Versuchs (AAAAA → hit, miss, miss, miss, hit) gewinnt der Treffer.
  assert.deepEqual(mergeKeyStates({}, 'AAAAA', scoreGuess('AAAAA')), { A: H });
});

test('mergeKeyStates: über beliebige Versuchsfolgen wird keine Taste schlechter', () => {
  const rank = { undefined: 0, miss: 1, present: 2, hit: 3 };
  const abc = 'ARENXQÄ';
  const rng = createRng(7);
  let keys = {};
  for (let n = 0; n < 300; n++) {
    const word = Array.from({ length: 5 }, () => rng.pick(Array.from(abc))).join('');
    const next = mergeKeyStates(keys, word, scoreGuess(word));
    for (const ch of abc) assert.ok(rank[next[ch]] >= rank[keys[ch]], `${ch}: ${keys[ch]} → ${next[ch]}`);
    keys = next;
  }
});

test('Tippen und Löschen', () => {
  let s = createState();
  assert.equal(s.status, 'playing');
  s = typeWord(s, 'to1 ßr');
  assert.equal(s.current, 'TOR', 'ungültige Zeichen werden verschluckt');
  s = typeWord(s, 'tenxyz');
  assert.equal(s.current, 'TORTE', 'nach 5 Buchstaben ist Schluss');
  s = backspace(backspace(s));
  assert.equal(s.current, 'TOR');
  s = backspace(backspace(backspace(backspace(s))));
  assert.equal(s.current, '');
  assert.equal(typeWord(createState(), 'öäüöä').current, 'ÖÄÜÖÄ');
});

test('Zu kurz wird abgelehnt und kostet keinen Versuch', () => {
  const s = typeWord(createState(), 'AREN');
  const res = submit(s);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'short');
  assert.equal(res.state, s);
  assert.equal(res.state.rows.length, 0);
  assert.equal(submit(createState()).reason, 'short');
});

test('Jedes Wort aus 5 Buchstaben wird angenommen', () => {
  for (const word of ['XQZÄÜ', 'AAAAA', 'TÖRÖÖ', 'KATER']) {
    const res = guess(createState(), word);
    assert.equal(res.ok, true, word);
    assert.equal(res.state.rows.length, 1);
    assert.equal(res.state.current, '');
    assert.deepEqual(res.state.rows[0], { word, marks: scoreGuess(word) });
  }
});

test('Treffer → gewonnen, danach keine Eingabe mehr', () => {
  let res = guess(createState(), 'TORTE');
  assert.equal(res.won, false);
  assert.equal(res.state.status, 'playing');
  res = guess(res.state, 'REGAL');
  res = guess(res.state, 'ARENA');
  assert.equal(res.ok, true);
  assert.equal(res.won, true);
  assert.equal(res.lost, false);
  assert.equal(res.hint, null);
  const done = res.state;
  assert.equal(done.status, 'won');
  assert.equal(done.rows.length, 3);
  assert.equal(missCount(done), 2);
  assert.deepEqual(done.keys, { T: M, O: M, R: H, E: H, G: M, A: H, L: M, N: H });
  assert.equal(typeLetter(done, 'A'), done);
  assert.equal(backspace(done), done);
  assert.deepEqual(submit(done), { ok: false, reason: 'over', state: done });
});

test('Gewinnen geht auch noch im 6. Versuch', () => {
  let s = createState();
  for (let i = 0; i < MAX_TRIES - 1; i++) s = guess(s, 'KATER').state;
  assert.equal(s.status, 'playing');
  const res = guess(s, 'ARENA');
  assert.equal(res.won, true);
  assert.equal(res.lost, false);
  assert.equal(res.state.status, 'won');
});

test('6. Fehlversuch → verloren, danach keine Eingabe mehr', () => {
  let s = createState();
  let res;
  for (let i = 0; i < MAX_TRIES; i++) {
    assert.equal(s.status, 'playing');
    res = guess(s, 'KATER');
    assert.equal(res.ok, true);
    s = res.state;
  }
  assert.equal(res.lost, true);
  assert.equal(res.won, false);
  assert.equal(res.hint, null);
  assert.equal(s.status, 'lost');
  assert.equal(s.rows.length, MAX_TRIES);
  assert.equal(missCount(s), MAX_TRIES);
  assert.equal(typeLetter(s, 'A'), s);
  assert.equal(typeWord(s, 'ARENA').current, '');
  assert.equal(submit(s).reason, 'over');
});

test('Die Zustandsfunktionen verändern ihren Eingabezustand nicht', () => {
  const s0 = createState();
  const s1 = typeWord(s0, 'REGAL');
  const snapshot = JSON.stringify(s1);
  submit(s1);
  backspace(s1);
  typeLetter(s1, 'X');
  assert.equal(JSON.stringify(s1), snapshot);
  assert.deepEqual(s0, createState());
});

test('Tipps: nach dem 3., 4. und 5. Fehlversuch', () => {
  assert.deepEqual(HINTS.map((x) => x.after), [3, 4, 5]);
  assert.match(HINTS[0].text, /Handball/);
  assert.match(HINTS[1].text, /Erster und letzter Buchstabe/);
  assert.match(HINTS[2].text, /Fängt mit A an/);
  assert.equal(hintFor(0), null);
  assert.equal(hintFor(2), null);
  assert.equal(hintFor(3), HINTS[0]);
  assert.equal(hintFor(4), HINTS[1]);
  assert.equal(hintFor(5), HINTS[2]);
  assert.equal(hintFor(6), HINTS[2]);

  let s = createState();
  const seen = [];
  for (let i = 0; i < MAX_TRIES; i++) {
    const res = guess(s, 'KATER');
    seen.push(res.hint);
    s = res.state;
  }
  assert.deepEqual(seen, [null, null, HINTS[0], HINTS[1], HINTS[2], null]);
});

test('Texte verraten das Reiseziel nicht', () => {
  for (const text of [START_HINT, ...HINTS.map((x) => x.text)]) assert.doesNotMatch(text, /Köln|Comedy|Chris Tall|Königin/i);
});

// --- Abstimmung: simulierte Gelegenheitsspielerin ---------------------------------------------
// Ein Modell, kein Messwert: Die Spielerin kennt einen Alltagswortschatz und rät meistens ein Wort, das zu den
// bisherigen Farben passt, manchmal (SLOPPY) irgendeins. Ob ihr ARENA überhaupt einfällt, ist der eigentliche
// Engpass: Am Anfang (Story-Tipp „ein Ort, an dem man laut sein darf“) nur manchmal, jeder gefundene Buchstabe
// hilft etwas, jeder Tipp von Janni deutlich. Die Wahrscheinlichkeiten stehen in RECALL.
const VOCAB = [
  'ARENA', 'HALLE', 'BÜHNE', 'DISCO', 'KATZE', 'KATER', 'TORTE', 'REGAL', 'NASEN', 'ALARM', 'BLUME', 'STERN', 'HAFEN', 'INSEL', 'KRONE', 'LAMPE', 'MUSIK', 'NACHT',
  'ORGEL', 'PERLE', 'REISE', 'SONNE', 'TASSE', 'VOGEL', 'WAGEN', 'ZEBRA', 'APFEL', 'BIRNE', 'DAUER', 'ESSEN', 'FEIER', 'GABEL', 'HONIG', 'IDEAL', 'JACKE', 'KABEL',
  'LEBEN', 'MAUER', 'NADEL', 'OZEAN', 'PAUSE', 'RADIO', 'SAHNE', 'TAFEL', 'UNTEN', 'VATER', 'WIESE', 'ZANGE', 'ABEND', 'BRAUT', 'ERNTE', 'FARBE', 'GARNE', 'HAARE',
  'KANAL', 'LAGER', 'MARKT', 'NAMEN', 'OPERN', 'PANDA', 'RASEN', 'SALAT', 'TANTE', 'WAREN', 'AROMA', 'ALGEN', 'ANGEL', 'ADLER', 'ERNST', 'TRÄNE', 'LÖWEN', 'MÜTZE',
  'KÖNIG', 'GRÜNE', 'SUPPE', 'STUHL', 'TISCH', 'BODEN', 'ZWERG', 'PIZZA', 'PASTA', 'LIEBE', 'SPIEL', 'KRAFT', 'SCHAL', 'FISCH', 'HUNDE', 'PFERD', 'MAGEN', 'NEBEL',
  'AGENT', 'AHNEN', 'AMPEL', 'ANKER', 'ARMEE', 'ASIEN', 'ATLAS', 'EBENE', 'EICHE', 'ENGEL', 'ERKER', 'ETAGE', 'RAUPE', 'REGEN', 'RUNDE', 'NARBE', 'NEBEN', 'ANRUF',
];

const SLOPPY = 0.3; // so oft ignoriert sie die Farben und rät irgendein Wort
const RECALL = { start: 0.15, perLetter: 0.05, hint: [0.35, 0.25, 0.6] }; // Chance, dass ihr ARENA einfällt

const fits = (word, rows) => rows.every((row) => scoreGuess(row.word, word).join() === row.marks.join());

function playBot(seed, { hints = HINTS } = {}) {
  const rng = createRng(seed);
  let state = createState();
  let knows = rng.chance(RECALL.start);
  const tried = new Set();
  while (state.status === 'playing') {
    const options = VOCAB.filter((w) => !tried.has(w) && (knows || w !== SOLUTION));
    const good = options.filter((w) => fits(w, state.rows));
    const word = good.length && !rng.chance(SLOPPY) ? rng.pick(good) : rng.pick(options);
    tried.add(word);
    const res = guess(state, word);
    state = res.state;
    if (!knows && state.status === 'playing') {
      const found = Array.from(new Set(SOLUTION)).filter((ch) => state.keys[ch] === 'hit' || state.keys[ch] === 'present').length;
      const hintIndex = hints.findIndex((x) => x.after === state.rows.length);
      knows = rng.chance(found * RECALL.perLetter) || (hintIndex >= 0 && rng.chance(RECALL.hint[hintIndex]));
    }
  }
  return state.status === 'won';
}

const winRate = (opts) => {
  const runs = 1500;
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) if (playBot(seed, opts)) wins++;
  return wins / runs;
};

test('Abstimmung: simulierte Gelegenheitsspielerin schafft es in etwa 80 % der Fälle', () => {
  assert.ok(VOCAB.every((w) => Array.from(w).length === WORD_LENGTH && Array.from(w).every((ch) => normalizeLetter(ch) === ch)));
  const withHints = winRate();
  const withoutHints = winRate({ hints: [] });
  assert.ok(withHints >= 0.75 && withHints <= 0.92, `mit Tipps: ${withHints}`);
  assert.ok(withoutHints <= withHints - 0.15, `ohne Tipps wäre es deutlich schwerer: ${withoutHints} statt ${withHints}`);
});

test('Abstimmung: Wer die Farben beachtet und die Lösung kennt, gewinnt praktisch immer', () => {
  // Gegenprobe zum Modell: Das Rätsel selbst ist fair, der Engpass ist nur, ob einem das Wort einfällt.
  let wins = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const rng = createRng(seed);
    let state = createState();
    while (state.status === 'playing') {
      const good = VOCAB.filter((w) => fits(w, state.rows) && !state.rows.some((r) => r.word === w));
      state = guess(state, rng.pick(good)).state;
    }
    if (state.status === 'won') wins++;
  }
  assert.ok(wins / 500 >= 0.97, `sorgfältige Spielerin: ${wins / 500}`);
});
