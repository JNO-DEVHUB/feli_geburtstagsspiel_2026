// Spiellogik „Lacher wischen“ (Kapitel 6, Vorbild Fruit Ninja). Ohne DOM, per node:test prüfbar.
//
// Einheiten: Der Wurfplan ist unabhängig von der Bildschirmgröße. Waagerecht wird in Bildbreiten
// gerechnet (0 = linker Rand, 1 = rechter Rand), senkrecht in Bildhöhen (0 = oben, 1 = unten).
// Erst positionAt() rechnet mit view.w / view.h in Pixel um.

// --- Stellschrauben: Regeln ---
export const TARGET = 25; // Punkte zum Sieg
export const DURATION = 30; // Sekunden
export const MAX_TOMATOES = 3; // so viele Tomaten vor Erreichen des Ziels = verloren
export const POINTS = { ha: 1, haha: 1, face: 1, mic: 2, gold: 3, tomato: 0 };
export const COMBO_BONUS = 1; // Bonuspunkt je weiterem Lacher im selben Wisch (ab dem 2. Treffer)
export const COMBO_WINDOW = 0.6; // Sekunden zwischen zwei Treffern, damit sie noch als ein Wisch zählen

// --- Stellschrauben: Wurfplan ---
export const OBJECT_COUNT = 41; // Würfe pro Runde (Lacher + Tomaten) → 47 Punkte ohne Combos
export const SHARES = { tomato: 1 / 7, gold: 0.07, mic: 0.14 }; // Anteile an allen Würfen, der Rest sind 1-Punkt-Lacher
export const SINGLES = [
  ['ha', 0.4],
  ['haha', 0.33],
  ['face', 0.27],
]; // Gewichte der 1-Punkt-Lacher
export const INTRO_TIMES = [0.3, 1.1, 1.9]; // einzelne normale Lacher zum Reinkommen
export const FIRST_WAVE_AT = 2.7;
export const LAST_WAVE_AT = 28.0;
export const WAVE_GAP_START = 2.4; // Wellenabstand am Anfang …
export const WAVE_GAP_END = 1.8; // … und rechnerisch bei t = DURATION (gegen Ende dichter)
export const WAVE_JITTER = 0.12; // ± Sekunden
export const WAVE_MIN = 2;
export const WAVE_MAX = 4;
export const WAVE_SIZE_START = 2.4; // mittlere Wellengröße am Anfang …
export const WAVE_SIZE_END = 3.6; // … und am Ende
export const WAVE_STAGGER = [0.06, 0.2]; // Abstand der Würfe innerhalb einer Welle
export const LAST_THROW_AT = 28.7; // später startet nichts mehr (Scheitelpunkt noch vor Schluss)
export const FIRST_TOMATO_WAVE = 1; // in der allerersten Welle fliegt noch keine Tomate

// --- Stellschrauben: Flugbahn und Treffer ---
export const RADIUS = 2.25 / 24.375; // Objektradius in Bildbreiten: 2.25em bei 24.375em Bühnenbreite (16px bei 390px)
export const HIT_SCALE = 1.25; // Trefferradius der Lacher (großzügig)
export const TOMATO_HIT_SCALE = 0.85; // Tomaten erwischt man nur, wenn man wirklich durchwischt
export const MIN_SWIPE = 0.045; // Mindeststrecke eines Wischs in Bildbreiten (Antippen zählt nicht)
export const GRAVITY = 1.3; // Bildhöhen pro s²
export const START_Y = 1.09; // Startpunkt unter dem unteren Rand
export const APEX_MIN = 0.22; // Scheitelpunkt (Mittelpunkt) zwischen 22 % …
export const APEX_MAX = 0.5; // … und 50 % der Bildhöhe
export const X_MIN = 0.13; // Start- und Landepunkt bleiben waagerecht im Bild
export const X_MAX = 0.87;
export const DRIFT_CENTER = 0.25; // Zug zur Bildmitte
export const DRIFT_RANDOM = 0.11;
export const SPIN = [0.5, 1.4]; // Drehung in rad/s; am Scheitelpunkt steht das Objekt gerade
export const TOP_CLEAR = 4.2 / 24.375; // Kopfzeile + Stumm-Schalter (4.2em) in Bildbreiten: darüber fliegt nichts
export const TOMATO_CLEARANCE = 1.4; // Mindestabstand Tomate–Lacher in Objektradien (gegen Verdecken) …
export const TOMATO_OVERLAP_MAX = 0.08; // … der höchstens so viele Sekunden am Stück unterschritten wird (Kreuzen im Vorbeiflug)
export const TOMATO_DELAY_MAX = 0.8; // so viel später als geplant darf eine Tomate dafür starten
export const ASPECT_MIN = 640 / 360; // flachste Bühne; bei höheren Bühnen sind die Abstände nur größer
const OVERLAP_TRIES = 200;
const OVERLAP_STEP = 0.01;

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const lerp = (a, b, t) => a + (b - a) * t;

export const isLaugh = (type) => type !== 'tomato';
export const flightTime = (wurf) => (2 * wurf.vy) / GRAVITY;
export const apexTime = (wurf) => wurf.vy / GRAVITY;

// Position eines Wurfs zur Spielzeit t in Pixeln. out wird wiederverwendet (keine Allokation pro Frame).
export function positionAt(wurf, t, view, out = {}) {
  const tau = t - wurf.t;
  out.x = (wurf.x0 + wurf.vx * tau) * view.w;
  out.y = (START_Y - wurf.vy * tau + 0.5 * GRAVITY * tau * tau) * view.h;
  out.rot = wurf.spin * (tau - wurf.vy / GRAVITY);
  return out;
}

export function apexOf(wurf, view, out = {}) {
  return positionAt(wurf, wurf.t + apexTime(wurf), view, out);
}

function makeThrow(rng, t, type, x0, wave) {
  const apexY = rng.range(APEX_MIN, APEX_MAX);
  const vy = Math.sqrt(2 * GRAVITY * (START_Y - apexY));
  const ta = vy / GRAVITY;
  const wish = (0.5 - x0) * DRIFT_CENTER + rng.range(-DRIFT_RANDOM, DRIFT_RANDOM);
  const drift = clamp(wish, (X_MIN - x0) / 2, (X_MAX - x0) / 2); // Landepunkt x0 + 2·drift bleibt im Bild
  const spin = rng.range(SPIN[0], SPIN[1]) * (rng.chance(0.5) ? 1 : -1);
  return { t, type, x0, vx: drift / ta, vy, spin, wave };
}

// Längste Zeit am Stück (Sekunden), die eine Tomate einem Lacher näher als TOMATO_CLEARANCE Radien ist,
// solange beide im Bild sind. Gerechnet wird auf der flachsten Bühne: Auf höheren sind die Abstände nur größer.
// Kurze Kreuzungen im Vorbeiflug (eine steigt, einer fällt) sind erlaubt, gemeinsames Fliegen nicht.
const NORM_VIEW = { w: 1, h: ASPECT_MIN };
export function tomatoOverlap(tomato, plan, view = NORM_VIEW, step = OVERLAP_STEP) {
  const a = {};
  const b = {};
  const need = TOMATO_CLEARANCE * RADIUS * view.w;
  const endA = tomato.t + flightTime(tomato);
  let worst = 0;
  for (const other of plan) {
    if (!isLaugh(other.type)) continue;
    const from = Math.max(tomato.t, other.t);
    const to = Math.min(endA, other.t + flightTime(other));
    let run = 0;
    for (let t = from; t <= to; t += step) {
      positionAt(tomato, t, view, a);
      positionAt(other, t, view, b);
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      // unter dem Rand verdeckt niemand etwas
      if (a.y <= view.h && b.y <= view.h && dx * dx + dy * dy < need * need) {
        run += step;
        if (run > worst) worst = run;
      } else {
        run = 0;
      }
    }
  }
  return worst;
}

function pickWeighted(rng, list) {
  let total = 0;
  for (const [, w] of list) total += w;
  let r = rng.next() * total;
  for (const [value, w] of list) {
    r -= w;
    if (r < 0) return value;
  }
  return list[list.length - 1][0];
}

export function waveTimes() {
  const times = [];
  for (let t = FIRST_WAVE_AT; t <= LAST_WAVE_AT + 1e-9; t += lerp(WAVE_GAP_START, WAVE_GAP_END, t / DURATION)) times.push(t);
  return times;
}

// Wurfplan einer Runde: Liste { t, type, x0, vx, vy, spin, wave }, nach t sortiert. Deterministisch aus rng.
// Die Zusammensetzung (Anzahl Tomaten, goldene Lacher, Mikrofone) ist in jeder Runde gleich, nur
// Reihenfolge und Flugbahnen sind zufällig: So hängt das Ergebnis nicht vom Glück beim Mischen ab.
export function buildPlan(rng) {
  const times = waveTimes();
  const waves = times.length;

  // Wellengrößen: 2–4, gegen Ende eher größer, in der Summe genau die gewünschte Zahl an Würfen
  const inWaves = clamp(OBJECT_COUNT - INTRO_TIMES.length, waves * WAVE_MIN, waves * WAVE_MAX);
  const sizes = times.map((_, i) => clamp(Math.round(lerp(WAVE_SIZE_START, WAVE_SIZE_END, i / Math.max(1, waves - 1)) + rng.range(-0.6, 0.6)), WAVE_MIN, WAVE_MAX));
  let sum = sizes.reduce((s, n) => s + n, 0);
  while (sum !== inWaves) {
    const i = rng.int(0, waves - 1);
    if (sum < inWaves && sizes[i] < WAVE_MAX) {
      sizes[i]++;
      sum++;
    } else if (sum > inWaves && sizes[i] > WAVE_MIN) {
      sizes[i]--;
      sum--;
    }
  }

  // Typen verteilen: Tomaten und goldene Lacher gleichmäßig über die Runde gestreut (je Abschnitt einer),
  // Mikrofone irgendwo, der Rest 1-Punkt-Lacher.
  const total = INTRO_TIMES.length + inWaves;
  const slots = sizes.map((n) => new Array(n).fill(null));
  const place = (type, wave) => {
    for (let k = 0; k < waves; k++) {
      const row = slots[(wave + k) % waves];
      const free = [];
      for (let i = 0; i < row.length; i++) if (row[i] === null) free.push(i);
      if (free.length) {
        row[rng.pick(free)] = type;
        return;
      }
    }
  };
  const spread = (type, count, from) => {
    const span = waves - from;
    for (let k = 0; k < count; k++) {
      const lo = from + Math.floor((k * span) / count);
      const hi = Math.max(lo, from + Math.floor(((k + 1) * span) / count) - 1);
      place(type, rng.int(lo, hi));
    }
  };
  spread('tomato', Math.round(total * SHARES.tomato), Math.min(FIRST_TOMATO_WAVE, waves - 1));
  spread('gold', Math.round(total * SHARES.gold), 0);
  for (let k = Math.round(total * SHARES.mic); k > 0; k--) place('mic', rng.int(0, waves - 1));

  const plan = [];
  for (const t of INTRO_TIMES) plan.push(makeThrow(rng, t, pickWeighted(rng, SINGLES), rng.range(0.3, 0.7), -1));

  const tomatoes = [];
  for (let w = 0; w < waves; w++) {
    const n = sizes[w];
    // Startpunkte: Die Welle teilt die Breite in n Bahnen, jede Bahn wird genau einmal benutzt.
    const lanes = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    let t = Math.min(LAST_WAVE_AT, times[w] + rng.range(-WAVE_JITTER, WAVE_JITTER));
    for (let i = 0; i < n; i++) {
      const type = slots[w][i] ?? pickWeighted(rng, SINGLES);
      const x0 = X_MIN + ((lanes[i] + 0.5 + rng.range(-0.3, 0.3)) / n) * (X_MAX - X_MIN);
      const wurf = makeThrow(rng, Math.min(t, LAST_THROW_AT), type, x0, w);
      plan.push(wurf);
      if (type === 'tomato') tomatoes.push(wurf);
      t += rng.range(WAVE_STAGGER[0], WAVE_STAGGER[1]);
    }
  }

  // Tomaten dürfen keinen Lacher verdecken: Flugbahn neu würfeln (anderer Startpunkt, zeitlich versetzt),
  // bis keine Tomate mehr neben oder auf einem Lacher herfliegt.
  for (const tomato of tomatoes) {
    const t0 = tomato.t;
    let best = tomatoOverlap(tomato, plan);
    for (let k = 1; k <= OVERLAP_TRIES && best > TOMATO_OVERLAP_MAX; k++) {
      const t = Math.min(LAST_THROW_AT, t0 + rng.range(0, TOMATO_DELAY_MAX));
      const cand = makeThrow(rng, t, 'tomato', rng.range(X_MIN, X_MAX), tomato.wave);
      const c = tomatoOverlap(cand, plan);
      if (c < best) {
        best = c;
        Object.assign(tomato, cand);
      }
    }
  }

  return plan.sort((a, b) => a.t - b.t);
}

// Ohne Combos erreichbare Punkte eines Plans.
export function reachablePoints(plan) {
  let sum = 0;
  for (const wurf of plan) sum += POINTS[wurf.type];
  return sum;
}

// Strecke A–B gegen Kreis (c, r). Eine Strecke der Länge null ist ein Punkt.
export function segmentHitsCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let u = len2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / len2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const px = ax + u * dx - cx;
  const py = ay + u * dy - cy;
  return px * px + py * py <= r * r;
}

export const hitRadius = (type, viewW) => RADIUS * viewW * (type === 'tomato' ? TOMATO_HIT_SCALE : HIT_SCALE);

// Erst ab dieser zurückgelegten Strecke (Pixel) gilt eine Berührung als Wisch.
export const isSwipe = (length, viewW) => length >= MIN_SWIPE * viewW;

// --- Punkte ---
export function createScore() {
  return { points: 0, tomatoes: 0, secured: false, slices: 0, bestCombo: 0 };
}

// Lacher zerteilt. comboIndex: 0 = erster Treffer des Wischs, 1 = zweiter … (Bonus ab dem zweiten).
// Rückgabe: { gained, bonus, justSecured }. Ab TARGET Punkten ist der Sieg sicher (score.secured).
export function applySlice(score, type, comboIndex = 0) {
  const bonus = comboIndex >= 1 ? COMBO_BONUS : 0;
  const gained = POINTS[type] + bonus;
  const before = score.secured;
  score.points += gained;
  score.slices += 1;
  if (comboIndex + 1 > score.bestCombo) score.bestCombo = comboIndex + 1;
  if (score.points >= TARGET) score.secured = true;
  return { gained, bonus, justSecured: !before && score.secured };
}

// Tomate erwischt. Ist das Ziel schon erreicht, klatscht sie nur noch und zählt nicht mehr.
// Rückgabe: { counted, lost }
export function applyTomato(score) {
  if (score.secured) return { counted: false, lost: false };
  score.tomatoes = Math.min(MAX_TOMATOES, score.tomatoes + 1);
  return { counted: true, lost: score.tomatoes >= MAX_TOMATOES };
}

// 'play' (läuft), 'win', 'tomatoes' (3 Tomaten vor dem Ziel), 'timeout' (Zeit um, zu wenig Punkte)
export function outcome(score, timeLeft) {
  if (!score.secured && score.tomatoes >= MAX_TOMATOES) return 'tomatoes';
  if (timeLeft > 0) return 'play';
  return score.secured ? 'win' : 'timeout';
}
