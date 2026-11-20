// Kapitel 1 „Im Galopp zum Südkreuz“: reine Spiellogik ohne DOM.
// Darstellung, Ton und Oberfläche (game.js) reagieren nur auf die Ereignisse aus stepWorld().
// Technik aus dem Hochzeits-Runner: fester Zeitschritt, Sprungphysik (physics.js), Strecke mit
// Fairness-Garantie (course.js), Autopilot als Fairness-Nachweis.

import { layoutCourse } from './course.js';
import { createPlayer, riseTime, simulateJump as simulate, stepPlayer } from './physics.js';

// ---------------------------------------------------------------------------------------------
// Stellschrauben. Längen in logischen Einheiten: Die Bühnenbreite entspricht immer VIEW_W
// Einheiten (bei 390 px also 0,65 px je Einheit). Zeiten in Sekunden.
// ---------------------------------------------------------------------------------------------

export const FIXED_STEP = 1 / 120; // Physik-Takt
export const VIEW_W = 600; // sichtbare Breite: Hindernis taucht ca. 1,7 s vor dem Gespann auf
export const PLAYER_X = 120; // Ankerpunkt des Gespanns (Mitte Pferderumpf) vom linken Rand

// Sprung: Tipp ≈ 130 hoch / 0,72 s Flug, gehalten ≈ 200 / 0,92 s, Doppelsprung noch einmal +144.
export const PHYSICS = Object.freeze({
  gravity: 2000,
  jumpVelocity: 720,
  doubleJumpVelocity: 760,
  holdGravityFactor: 0.45,
  maxHoldTime: 0.2,
  jumpBuffer: 0.13,
  maxFallSpeed: 1500,
  spinTime: 0.55, // Dauer der Drehung beim Doppelsprung
});

// Tempo (Einheiten/s): gemütlich, steigt über die Strecke nur leicht an.
export const SPEED_START = 250;
export const SPEED_END = 268;

// Strecke: Länge ergibt mit dem Tempo ca. 40 s bis Südkreuz.
export const COURSE_LENGTH = 10450;
export const FIRST_OBSTACLE_AT = 1250; // erstes Hindernis nach ca. 5 s (im Bild ab ca. 3,1 s)
export const LAST_OBSTACLE_BEFORE_END = 700; // freie Einfahrt in den Bahnhof
export const OBSTACLE_COUNT = Object.freeze([15, 17]); // Anzahl inkl. der zwei Kehrmaschinen
export const MIN_GAP_TIME = 1.5; // freie Laufzeit zwischen zwei Hindernissen
export const SWEEPER_GAP_TIME = 0.5; // zusätzlich vor und nach einer Kehrmaschine
export const WARN_TIME = 2.7; // so lange vor der Kehrmaschine kommt die Warnung
export const HINT_TIME = 1.9; // so lange vor dem ersten Hindernis kommt „Tippen = springen!“

export const HEARTS = 3;
export const INVULNERABLE = 1.5; // Sekunden nach einem Treffer

// Kollisionsbox des Gespanns relativ zum Anker: deutlich kleiner als die Zeichnung (verzeihend).
export const PLAYER_BOX = Object.freeze({ left: -25, right: 25, bottom: 6, top: 120 });
// Zum Einsammeln zählt dagegen das ganze Gespann samt Köpfen.
export const TREAT_BOX = Object.freeze({ left: -62, right: 86, bottom: 8, top: 240 });
export const TREAT_RADIUS = 15;

// Hindernisse: w/h = gezeichnete Größe, inset = [seitlich, oben] Abzug für die Kollisionsbox,
// alt = Flughöhe der Unterkante, drift = Eigenbewegung aufs Paar zu (Anteil des Lauftempos),
// double = nur mit Doppelsprung zu schaffen.
export const OBSTACLES = Object.freeze({
  laub: { w: 58, h: 32, inset: [9, 8] },
  scooter: { w: 72, h: 30, inset: [8, 8] },
  tonne: { w: 42, h: 62, inset: [6, 8] },
  absperrung: { w: 78, h: 48, inset: [8, 7] },
  brezel: { w: 80, h: 50, inset: [8, 8] },
  taube: { w: 46, h: 26, inset: [6, 6], alt: 30, drift: 0.16 },
  kehrmaschine: { w: 136, h: 146, inset: [12, 16], double: true },
});
// Auswahl ab dem vierten Hindernis (die ersten drei sind immer niedrige/mittlere).
export const OBSTACLE_POOL = Object.freeze(['laub', 'laub', 'scooter', 'scooter', 'tonne', 'tonne', 'tonne', 'absperrung', 'absperrung', 'brezel', 'brezel', 'taube', 'taube', 'taube']);

export const TREATS = Object.freeze({
  spacing: 46,
  arcTop: 292, // Bogen über normalen Hindernissen (nur im Sprung erreichbar)
  arcChance: 0.75,
  sweeperTop: 400, // Bogen über der Kehrmaschine
  rowAlt: 165, // Reihe auf Kopfhöhe, gibt es im Vorbeireiten
  rowChance: 0.45,
  rowMinGap: 470,
});

// Bremsweg im Bahnhof bzw. beim bockigen Stehenbleiben (Einheiten/s²).
export const BRAKE_WON = 400;
export const BRAKE_LOST = 1500;

// ---------------------------------------------------------------------------------------------

export const speedAt = (dist) => SPEED_START + (SPEED_END - SPEED_START) * Math.min(1, Math.max(0, dist / COURSE_LENGTH));

export const simulateJump = (opts) => simulate(PHYSICS, opts);

export function makeObstacle(kind, x) {
  const d = OBSTACLES[kind];
  return { kind, x, w: d.w, h: d.h, alt: d.alt ?? 0, drift: d.drift ?? 0 };
}

// Feste Strecke für einen Lauf: { obstacles, treats, length }.
export function buildCourse(rng) {
  return layoutCourse(rng, {
    defs: OBSTACLES,
    pool: OBSTACLE_POOL,
    length: COURSE_LENGTH,
    firstAt: FIRST_OBSTACLE_AT,
    lastBeforeEnd: LAST_OBSTACLE_BEFORE_END,
    count: OBSTACLE_COUNT,
    minGap: MIN_GAP_TIME * SPEED_END,
    sweeperGap: SWEEPER_GAP_TIME * SPEED_END,
    treat: TREATS,
  });
}

// Laufzeit bis zum Ziel bei ungestörtem Lauf (das Tempo hängt nur von der Strecke ab).
export function courseDuration(course) {
  let t = 0;
  for (let d = 0; d < course.length; d += 5) t += 5 / speedAt(d);
  return t;
}

export function createWorld(course, { viewWidth = VIEW_W, playerX = PLAYER_X } = {}) {
  return {
    course,
    viewWidth,
    playerX,
    obstacles: course.obstacles.map((o) => ({ ...o, hit: false, warned: false })),
    treatList: course.treats.map((t) => ({ ...t, taken: false })),
    firstObstacle: 0, // Index des ersten Hindernisses, das noch nicht hinter dem Gespann liegt
    firstTreat: 0,
    player: createPlayer(),
    phase: 'run', // 'run' | 'won' | 'lost'
    time: 0,
    over: 0, // Sekunden seit Spielende
    dist: 0,
    speed: speedAt(0),
    hearts: HEARTS,
    inv: 0,
    treats: 0,
    jumps: 0,
    doubleJumps: 0,
    hits: 0,
    hinted: false,
    stopped: false,
    events: [],
  };
}

// Bildschirm-x (linke Kante) eines Hindernisses bzw. Mitte eines Leckerlis, in Einheiten.
export const screenX = (w, o) => w.playerX + (o.x - w.dist) * (1 + (o.drift ?? 0));

export function playerBox(w) {
  const a = w.player.alt;
  return { l: w.playerX + PLAYER_BOX.left, r: w.playerX + PLAYER_BOX.right, b: a + PLAYER_BOX.bottom, t: a + PLAYER_BOX.top };
}

export function obstacleBox(w, o) {
  const [ix, it] = OBSTACLES[o.kind].inset;
  const sx = screenX(w, o);
  return { l: sx + ix, r: sx + o.w - ix, b: o.alt + 4, t: o.alt + o.h - it };
}

const NO_INPUT = Object.freeze({ pressed: false, held: false });

/**
 * Ein fester Schritt. input = { pressed, held }.
 * Liefert die Ereignisse dieses Schritts (das Array wird beim nächsten Aufruf wiederverwendet):
 *   jump, doubleJump, land, treat {x, alt, count}, hit {kind, x, alt, hearts},
 *   hint (erstes Hindernis naht), warn {kind} (Kehrmaschine naht), won, lost, stopped.
 */
export function stepWorld(w, dt, input) {
  const events = w.events;
  events.length = 0;
  const p = w.player;

  if (w.phase !== 'run') {
    // Auslaufen: Pferd bremst (Bahnhof) bzw. bleibt bockig stehen, die Physik lässt es noch landen.
    w.over += dt;
    w.speed = Math.max(0, w.speed - (w.phase === 'won' ? BRAKE_WON : BRAKE_LOST) * dt);
    w.dist += w.speed * dt;
    if (stepPlayer(p, dt, NO_INPUT, PHYSICS) === 'land') events.push({ type: 'land' });
    if (!w.stopped && w.speed === 0 && p.grounded) {
      w.stopped = true;
      events.push({ type: 'stopped' });
    }
    return events;
  }

  w.time += dt;
  w.speed = speedAt(w.dist);
  w.dist += w.speed * dt;
  if (w.inv > 0) w.inv = Math.max(0, w.inv - dt);

  const pe = stepPlayer(p, dt, input, PHYSICS);
  if (pe) {
    if (pe === 'jump') w.jumps++;
    if (pe === 'doubleJump') w.doubleJumps++;
    events.push({ type: pe });
  }

  const left = w.playerX + PLAYER_BOX.left;
  const right = w.playerX + PLAYER_BOX.right;
  const bottom = p.alt + PLAYER_BOX.bottom;
  const top = p.alt + PLAYER_BOX.top;

  // Hindernisse: ankündigen, Kollision prüfen, hinter dem Gespann abhaken.
  const list = w.obstacles;
  while (w.firstObstacle < list.length && screenX(w, list[w.firstObstacle]) + list[w.firstObstacle].w < left - 4) w.firstObstacle++;
  for (let i = w.firstObstacle; i < list.length; i++) {
    const o = list[i];
    const d = OBSTACLES[o.kind];
    const sx = screenX(w, o);
    const eta = (sx + d.inset[0] - right) / (w.speed * (1 + o.drift));
    if (eta > WARN_TIME) break;
    if (!o.warned && d.double) {
      o.warned = true;
      events.push({ type: 'warn', kind: o.kind });
    }
    if (!w.hinted && i === 0 && eta <= HINT_TIME) {
      w.hinted = true;
      events.push({ type: 'hint' });
    }
    if (o.hit || w.inv > 0) continue;
    const ol = sx + d.inset[0];
    const or = sx + o.w - d.inset[0];
    if (ol < right && or > left && o.alt + 4 < top && o.alt + o.h - d.inset[1] > bottom) {
      o.hit = true;
      w.hits++;
      w.hearts--;
      w.inv = INVULNERABLE;
      events.push({ type: 'hit', kind: o.kind, index: i, x: Math.max(ol, left), alt: Math.min(top, o.alt + o.h), hearts: w.hearts });
      if (w.hearts <= 0) {
        w.phase = 'lost';
        events.push({ type: 'lost' });
        return events;
      }
    }
  }

  // Leckerlis einsammeln (zählt das ganze Gespann).
  const tl = w.treatList;
  const tLeft = w.playerX + TREAT_BOX.left - TREAT_RADIUS;
  const tRight = w.playerX + TREAT_BOX.right + TREAT_RADIUS;
  while (w.firstTreat < tl.length && screenX(w, tl[w.firstTreat]) < tLeft) w.firstTreat++;
  for (let i = w.firstTreat; i < tl.length; i++) {
    const t = tl[i];
    const sx = screenX(w, t);
    if (sx > tRight) break;
    if (t.taken) continue;
    if (t.alt + TREAT_RADIUS > p.alt + TREAT_BOX.bottom && t.alt - TREAT_RADIUS < p.alt + TREAT_BOX.top) {
      t.taken = true;
      w.treats++;
      events.push({ type: 'treat', x: sx, alt: t.alt, count: w.treats });
    }
  }

  if (w.dist >= w.course.length) {
    w.phase = 'won';
    events.push({ type: 'won' });
  }
  return events;
}

// Fortschritt 0..1 für den Balken.
export const progress = (w) => Math.min(1, w.dist / w.course.length);

// ---------------------------------------------------------------------------------------------
// Autopilot: zustandslos, springt rechtzeitig vor dem nächsten Hindernis (immer voll gehalten)
// und setzt bei der Kehrmaschine kurz vor dem Scheitel den Doppelsprung.
// opts.skip(index): Hindernisse, die er „übersieht“ (für die schlampige Test-Spielerin).
// ---------------------------------------------------------------------------------------------

const riseCache = new Map();
function riseFor(kind) {
  if (!riseCache.has(kind)) {
    const d = OBSTACLES[kind];
    const need = (d.alt ?? 0) + d.h - d.inset[1] - PLAYER_BOX.bottom;
    // Kehrmaschine: Absprung so, dass der Einzelsprung sie gerade noch nicht erreicht hätte.
    riseCache.set(kind, d.double ? riseTime(PHYSICS, Math.min(need, 110)) + 0.05 : riseTime(PHYSICS, need + 6));
  }
  return riseCache.get(kind);
}

const AUTO = { pressed: false, held: true };

export function autopilotInput(w, opts = {}) {
  AUTO.pressed = false;
  if (w.phase !== 'run') return AUTO;
  const p = w.player;
  const right = w.playerX + PLAYER_BOX.right;
  const left = w.playerX + PLAYER_BOX.left;
  for (let i = w.firstObstacle; i < w.obstacles.length; i++) {
    const o = w.obstacles[i];
    if (o.hit || opts.skip?.(i)) continue;
    const d = OBSTACLES[o.kind];
    const sx = screenX(w, o);
    if (sx + o.w - d.inset[0] < left) continue;
    const eta = (sx + d.inset[0] - right) / (w.speed * (1 + o.drift));
    if (p.grounded) AUTO.pressed = eta <= riseFor(o.kind) + 0.02;
    else if (d.double && p.jumps === 1) AUTO.pressed = p.v <= 260 && eta < 0.6;
    break;
  }
  return AUTO;
}
