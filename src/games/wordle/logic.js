// Perlen-Rätsel (Kapitel 4): reine Spiellogik ohne DOM.
// Wordle-Regeln: 6 Versuche, 5 Buchstaben, jedes Wort aus 5 Buchstaben zählt (kein Wörterbuch).

// --- Stellschrauben ---
export const SOLUTION = 'ARENA';
export const MAX_TRIES = 6;
export const WORD_LENGTH = 5;

// Jannis Erinnerung an den Tipp aus der Story, steht von Anfang an in der Sprechblase ('' = keine Blase).
export const START_HINT = 'Denk dran: ein Ort, an dem man richtig laut sein darf.';

// Jannis Tipps: Der Tipp erscheint, sobald so viele Fehlversuche (after) gemacht sind.
// Frühere Schwellen oder deutlichere Texte machen das Spiel leichter (Ziel: ca. 80 % Erfolg).
export const HINTS = [
  { after: 3, text: 'Da wird Handball gespielt. Oder ganz laut gesungen.' },
  { after: 4, text: 'Erster und letzter Buchstabe sind gleich.' },
  { after: 5, text: 'Fängt mit A an. Hört mit A auf.' },
];

// Bildschirmtastatur (QWERTZ). ENTER und BACK sind die beiden Sondertasten der dritten Reihe.
export const ENTER = '⏎';
export const BACK = '⌫';
export const KEY_ROWS = ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', ENTER + 'YXCVBNM' + BACK];

const LETTERS = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ');
const RANK = { miss: 1, present: 2, hit: 3 };

// Ein Zeichen als Großbuchstabe A–Z, Ä, Ö, Ü. Alles andere (Ziffern, ß, Leerzeichen, mehrere Zeichen) → null.
export function normalizeLetter(ch) {
  if (typeof ch !== 'string') return null;
  const up = ch.normalize('NFC').toUpperCase();
  return LETTERS.has(up) ? up : null;
}

const letters = (word) => Array.from(String(word).normalize('NFC').toUpperCase());

// Bewertet einen Versuch: je Stelle 'hit' (richtige Stelle), 'present' (kommt vor, steht woanders) oder 'miss'.
// Doppelte Buchstaben: erst alle Treffer vergeben, danach „kommt vor“ nur so oft, wie der Buchstabe
// in der Lösung noch übrig ist.
export function scoreGuess(guess, solution = SOLUTION) {
  const want = letters(solution);
  const got = letters(guess);
  const marks = want.map(() => 'miss');
  const left = new Map();
  want.forEach((ch, i) => {
    if (got[i] === ch) marks[i] = 'hit';
    else left.set(ch, (left.get(ch) ?? 0) + 1);
  });
  want.forEach((_, i) => {
    const ch = got[i];
    if (marks[i] === 'hit' || !left.get(ch)) return;
    marks[i] = 'present';
    left.set(ch, left.get(ch) - 1);
  });
  return marks;
}

// Beste bekannte Farbe je Taste (hit > present > miss). Gibt ein neues Objekt zurück, nichts wird schlechter.
export function mergeKeyStates(states, guess, marks) {
  const next = { ...states };
  letters(guess).forEach((ch, i) => {
    const mark = marks[i];
    if (RANK[mark] && RANK[mark] > (RANK[next[ch]] ?? 0)) next[ch] = mark;
  });
  return next;
}

// Der Tipp, der nach so vielen Fehlversuchen gilt (der späteste erreichte), sonst null.
export function hintFor(misses, hints = HINTS) {
  let best = null;
  for (const hint of hints) if (misses >= hint.after && (!best || hint.after >= best.after)) best = hint;
  return best;
}

// --- Spielzustand (unveränderlich: jede Funktion gibt einen neuen Zustand zurück) ---
// status: 'playing' | 'won' | 'lost'.  rows: abgegebene Versuche [{ word, marks }].  current: die getippten Buchstaben.
export function createState(solution = SOLUTION) {
  return { solution, rows: [], current: '', status: 'playing', keys: {} };
}

export const missCount = (state) => state.rows.length - (state.status === 'won' ? 1 : 0);

export function typeLetter(state, ch) {
  const letter = normalizeLetter(ch);
  if (state.status !== 'playing' || !letter || letters(state.current).length >= WORD_LENGTH) return state;
  return { ...state, current: state.current + letter };
}

export function backspace(state) {
  if (state.status !== 'playing' || !state.current) return state;
  return { ...state, current: letters(state.current).slice(0, -1).join('') };
}

// Gibt den aktuellen Versuch ab.
// Abgelehnt: { ok: false, reason: 'over' | 'short', state } (Zustand unverändert).
// Angenommen: { ok: true, state, word, marks, won, lost, hint } – hint ist ein Eintrag aus HINTS,
// wenn mit diesem Fehlversuch ein neuer Tipp fällig wird, sonst null.
export function submit(state) {
  if (state.status !== 'playing') return { ok: false, reason: 'over', state };
  const word = state.current;
  if (letters(word).length < WORD_LENGTH) return { ok: false, reason: 'short', state };
  const marks = scoreGuess(word, state.solution);
  const won = marks.every((m) => m === 'hit');
  const rows = [...state.rows, { word, marks }];
  const lost = !won && rows.length >= MAX_TRIES;
  const next = { ...state, rows, current: '', status: won ? 'won' : lost ? 'lost' : 'playing', keys: mergeKeyStates(state.keys, word, marks) };
  const hint = won || lost ? null : (HINTS.find((x) => x.after === rows.length) ?? null);
  return { ok: true, state: next, word, marks, won, lost, hint };
}
