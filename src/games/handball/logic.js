// Siebenmeter! – reine Spiellogik ohne DOM. Alle Stellschrauben stehen hier oben.
//
// Tor-Koordinaten: x 0 = linker Pfosten, 1 = rechter Pfosten; y 0 = Boden, 1 = Latte.
// Werte außerhalb von 0..1 heißen: daneben bzw. drüber.

// --- Regeln ---
export const THROWS = 5;
export const GOALS_NEEDED = 3;

// --- Tor ---
// Normiertes Tor-Rechteck. postTolerance: so weit darf der Ballmittelpunkt außen liegen und zählt
// trotzdem als „Innenpfosten und rein“ (großzügig).
export const GOAL = { x0: 0, x1: 1, y0: 0, y1: 1, postTolerance: 0.02 };

// Hallenbild public/assets/bg/k5_halle.jpg und die Lage des gemalten Tors darin (Bildpixel):
// Innenkante der Pfosten (l, r), Unterkante der Latte (t), Bodenlinie (b).
export const IMAGE = { w: 1080, h: 1920 };
export const GOAL_IMG = { l: 258, r: 822, t: 666, b: 980 };

// Bildausschnitt: Das Tor nimmt goalWidthFrac der Bühnenbreite ein (mindestens aber „cover“),
// seine Bodenlinie liegt auf goalBottomFrac der Höhe. Feli steht bei groundFrac. depthScale ist der
// Maßstab der Torebene relativ zur Werferin (Perspektive: Ball und Figuren werden hinten kleiner).
export const STAGE = { goalWidthFrac: 0.74, goalBottomFrac: 0.5, groundFrac: 0.975, depthScale: 0.5 };

// --- Wisch → Wurf ---
// Die Wischlänge wird am Bildschirm geeicht: Reicht der Finger vom Ball bis zur Torlinie, fliegt der Ball
// auf kneeY; reicht er (fast) bis zur Latte, geht der Ball drüber. So passt „zu lang“ auf jedem Handy
// zu dem, was man sieht. minLen/minUp sind Anteile der Bühnenbreite.
export const SWIPE = {
  minLen: 0.07, // kürzer = Antippen, kein Wurf
  minUp: 0.045, // so weit muss es mindestens nach oben gehen
  lowY: 0.1, // Höhe des kürzesten gültigen Wurfs (flach)
  kneeAt: 1, // Wischlänge ÷ Abstand Ball–Torlinie, bis zu der die Höhe zügig steigt …
  kneeY: 0.62, // … auf diese Höhe, danach geht es langsamer weiter
  barAt: 0.95, // Wischlänge ÷ Abstand Ball–Latte, ab der der Ball über die Latte geht
  maxY: 1.9, // höher fliegt nichts
  aimDepth: 0.82, // Seitenversatz im Tor = tan(Wischwinkel) · aimDepth (kleiner = verzeiht mehr)
  maxTan: 1.5, // Begrenzung für fast waagerechte Wische
  fastMs: 110, // Wischdauer für den schnellsten …
  slowMs: 520, // … und den langsamsten Ball (wirkt nur auf die Flugzeit, nicht aufs Ziel)
};

// --- Flugbahn ---
export const FLIGHT = {
  start: { x: 0.6, y: 0.5 }, // Abwurfpunkt (Felis Wurfhand) in Tor-Koordinaten der Werfer-Ebene
  timeSoft: 0.8, // Flugzeit in Sekunden bei schwachem …
  timeHard: 0.5, // … und bei hartem Wurf
  arcSoft: 0.5, // Bogenhöhe (in Torhöhen) bei schwachem …
  arcHard: 0.14, // … und bei hartem Wurf
  spin: 0.035, // feste Seitenkurve (Rechtshänderin)
  curve: 0.16, // zusätzliche Kurve je Seitenversatz des Ziels
};

// --- Torwart ---
// Janni entscheidet beim Abwurf: Mit readChance errät er die richtige Seite, sonst wählt er zufällig
// Mitte (centerChance) oder links / rechts. Gehalten ist, was in seiner Reichweite (Ellipse um Brust und Arme) ankommt.
export const KEEPER = {
  readChance: 0.12,
  centerChance: 0.3, // nicht geraten: mit dieser Wahrscheinlichkeit bleibt er in der Mitte, sonst links/rechts je zur Hälfte
  zoneLeft: 0.37, // Ziel-x darunter = linke Seite
  zoneRight: 0.63, // Ziel-x darüber = rechte Seite
  diveX: { left: 0.24, center: 0.5, right: 0.76 },
  jitterX: 0.04, // Streuung seines Hechtsprungs
  bodyY: 0.48, // Höhe seiner Brust im Stand
  minY: 0.32, // tiefster …
  maxY: 0.6, // … und höchster Hechtsprung
  followY: 0.5, // richtig geraten: so weit geht er in der Höhe mit (0 = gar nicht, 1 = genau)
  reach: {
    side: { rx: 0.16, ry: 0.24 }, // im Flug: breit und flach
    center: { rx: 0.1, ry: 0.34 }, // im Stand: schmal und hoch
  },
};

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const lerp = (a, b, t) => a + (b - a) * t;

// Wisch (dx, dy in CSS-Pixeln, dy < 0 = nach oben; Dauer in ms) → Wurf.
// view: { w, h } der Bühne oder gleich das Ergebnis von stageLayout(). Rückgabe: { valid, x, y, power, time, curve }
//   Richtung des Wischs = Richtung des Wurfs, Länge = Stärke (kurz = flach, lang = hoch, zu lang = drüber).
export function swipeToShot(dx, dy, durationMs, view) {
  const { unit, kneeLen, barLen } = swipeScale(view);
  const len = Math.hypot(dx, dy) / unit;
  const up = -dy / unit;
  if (!(len >= SWIPE.minLen) || !(up >= SWIPE.minUp)) return { valid: false, x: 0.5, y: 0, power: 0 };
  const tan = clamp(dx / -dy, -SWIPE.maxTan, SWIPE.maxTan);
  const x = 0.5 + tan * SWIPE.aimDepth;
  let y;
  if (len <= kneeLen) y = lerp(SWIPE.lowY, SWIPE.kneeY, (len - SWIPE.minLen) / (kneeLen - SWIPE.minLen));
  else y = lerp(SWIPE.kneeY, GOAL.y1, (len - kneeLen) / (barLen - kneeLen));
  if (len >= barLen) y += 0.06; // eindeutig drüber statt Lattenkreuz-Lotterie
  y = Math.min(SWIPE.maxY, y);
  const power = clamp((len - SWIPE.minLen) / (barLen - SWIPE.minLen), 0, 1.5);
  const quick = 1 - clamp(((durationMs || SWIPE.slowMs) - SWIPE.fastMs) / (SWIPE.slowMs - SWIPE.fastMs), 0, 1);
  const time = lerp(FLIGHT.timeSoft, FLIGHT.timeHard, clamp(0.7 * Math.min(1, power) + 0.3 * quick, 0, 1));
  return { valid: true, x, y, power, time, curve: shotCurve(x) };
}

// Eichung der Wischlänge (in Bühnenbreiten) für diese Bühne: Knick an der Torlinie, Latte kurz vor der Latte.
export function swipeScale(view) {
  const L = view?.goal ? view : stageLayout(view?.w > 0 ? view.w : 390, view?.h > 0 ? view.h : 844);
  const hand = project(L, { x: FLIGHT.start.x, y: FLIGHT.start.y, d: 0 });
  const kneeLen = Math.max(SWIPE.minLen + 0.1, ((hand.y - L.goal.b) * SWIPE.kneeAt) / L.w);
  const barLen = Math.max(kneeLen + 0.1, ((hand.y - L.goal.t) * SWIPE.barAt) / L.w);
  return { unit: L.w, kneeLen, barLen };
}

function shotCurve(x) {
  return FLIGHT.spin + FLIGHT.curve * (x - FLIGHT.start.x);
}

// Flugbahn: t 0..1 → { x, y, d }. x/y in Tor-Koordinaten, d = Tiefe (0 = Abwurf, 1 = Torebene).
// Seitlich fliegt der Ball eine leichte Kurve, in der Höhe einen Bogen (schwache Würfe höher).
export function ballAt(shot, t) {
  const u = clamp(t, 0, 1);
  const bow = 4 * u * (1 - u);
  const arc = lerp(FLIGHT.arcSoft, FLIGHT.arcHard, clamp(shot.power ?? 0.5, 0, 1));
  return {
    x: lerp(FLIGHT.start.x, shot.x, u) + (shot.curve ?? shotCurve(shot.x)) * bow,
    y: lerp(FLIGHT.start.y, shot.y, u) + arc * bow,
    d: u,
  };
}

export function onTarget(shot) {
  const p = GOAL.postTolerance;
  return shot.x >= GOAL.x0 - p && shot.x <= GOAL.x1 + p && shot.y >= GOAL.y0 && shot.y <= GOAL.y1;
}

export function shotSide(shot) {
  return shot.x < KEEPER.zoneLeft ? 'left' : shot.x > KEEPER.zoneRight ? 'right' : 'center';
}

// Torwart-Haltung: Mitte seiner Reichweite (x, y) plus Halbachsen.
export function keeperAt(side, x, y) {
  const reach = side === 'center' ? KEEPER.reach.center : KEEPER.reach.side;
  return { side, x, y, rx: reach.rx, ry: reach.ry };
}

// Wohin hechtet Janni? Entscheidung beim Abwurf.
export function keeperDecision(rng, shot) {
  const read = rng.chance(KEEPER.readChance);
  const side = read ? shotSide(shot) : rng.chance(KEEPER.centerChance) ? 'center' : rng.pick(['left', 'right']);
  const x = KEEPER.diveX[side] + rng.range(-KEEPER.jitterX, KEEPER.jitterX);
  let y = KEEPER.bodyY;
  if (side !== 'center') {
    y = read ? lerp(KEEPER.bodyY, clamp(shot.y, 0, 1), KEEPER.followY) : rng.range(KEEPER.minY, KEEPER.maxY);
    y = clamp(y, KEEPER.minY, KEEPER.maxY);
  }
  return { ...keeperAt(side, x, y), read };
}

export function inReach(shot, keeper) {
  const ex = (shot.x - keeper.x) / keeper.rx;
  const ey = (shot.y - keeper.y) / keeper.ry;
  return ex * ex + ey * ey <= 1;
}

// 'goal' | 'saved' | 'miss'
export function resolveShot(shot, keeper) {
  if (!onTarget(shot)) return 'miss';
  return keeper && inReach(shot, keeper) ? 'saved' : 'goal';
}

// --- Spielstand ---
export function createMatch() {
  return { throws: 0, goals: 0, results: [] };
}

// Trägt einen Wurf ein und liefert den neuen Spielstand. Nach Spielende ändert sich nichts mehr.
export function recordShot(match, result) {
  if (matchOutcome(match)) return match;
  return { throws: match.throws + 1, goals: match.goals + (result === 'goal' ? 1 : 0), results: [...match.results, result] };
}

// 'won' sobald 3 Tore gefallen sind, 'lost' sobald 3 Tore nicht mehr möglich sind, sonst null.
export function matchOutcome(match) {
  if (match.goals >= GOALS_NEEDED) return 'won';
  if (match.goals + (THROWS - match.throws) < GOALS_NEEDED) return 'lost';
  return null;
}

// --- Bühne (reine Geometrie, damit Bild, Torwart und Trefferzone garantiert dieselbe Abbildung nutzen) ---

// Bildausschnitt für eine Bühne w × h: Maßstab und Versatz des Hallenbilds, Tor in Bildschirmkoordinaten.
export function stageLayout(w, h) {
  const goalW = GOAL_IMG.r - GOAL_IMG.l;
  const scale = Math.max(w / IMAGE.w, h / IMAGE.h, (w * STAGE.goalWidthFrac) / goalW);
  const ox = clamp(w / 2 - ((GOAL_IMG.l + GOAL_IMG.r) / 2) * scale, w - IMAGE.w * scale, 0);
  const oy = clamp(h * STAGE.goalBottomFrac - GOAL_IMG.b * scale, h - IMAGE.h * scale, 0);
  const goal = { l: ox + GOAL_IMG.l * scale, r: ox + GOAL_IMG.r * scale, t: oy + GOAL_IMG.t * scale, b: oy + GOAL_IMG.b * scale };
  goal.w = goal.r - goal.l;
  goal.h = goal.b - goal.t;
  return { w, h, scale, ox, oy, goal, ground: h * STAGE.groundFrac };
}

// Punkt { x, y, d } (Tor-Koordinaten + Tiefe) → Bildschirm { x, y, groundY, m }.
// m = Maßstab relativ zur Torebene (1 im Tor, 1/depthScale bei der Werferin).
export function project(layout, p) {
  const k = STAGE.depthScale;
  const s = 1 / (1 + p.d * (1 / k - 1));
  const m = s / k;
  const { goal } = layout;
  const vanishY = (goal.b - layout.ground * k) / (1 - k);
  const groundY = vanishY + (layout.ground - vanishY) * s;
  return { x: (goal.l + goal.r) / 2 + (p.x - 0.5) * goal.w * m, y: groundY - p.y * goal.h * m, groundY, m };
}
