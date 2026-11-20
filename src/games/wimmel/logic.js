// Wimmelbild „Verloren in Hamburg!“ – reine Logik ohne DOM.
// Ansicht (Verschieben/Zoomen), Treffer-Prüfung und Rundenablauf. Die Verstecke stehen in spots.js.

// --- Stellschrauben ---
export const TIME_LIMIT = 90; // Sekunden für alle drei Figuren
export const MISS_PENALTY = 3; // Sekunden Abzug je Fehltipp
export const MISS_COOLDOWN = 0.5; // Sekunden, in denen nach einem Fehltipp kein weiterer zählt
export const HINT_AFTER = 30; // Sekunden ohne Fund bis zum dezenten Schimmer
export const HINT_STRONG_AFTER = 45; // Sekunden ohne Fund bis zum deutlichen Schimmer (Karte wackelt)
export const LOW_TIME = 15; // letzte Sekunden: rot und Tick-Ton
export const MAX_ZOOM = 3; // größter Zoom als Vielfaches des kleinsten
export const MIN_HIT_EM = 2.4; // kleinster Treffer-Radius auf dem Bildschirm (em)
export const MIN_SHOW_EM = 3.2; // so hoch soll jede Figur im kleinsten Zoom mindestens zu sehen sein (em)
export const TAP_MAX_MOVE = 10; // px: mehr Bewegung ist ein Wischer, kein Tipp
export const TAP_MAX_MS = 350; // ms: längerer Kontakt ist kein Tipp

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// --- Ansicht ---
// view = { zoom, x, y }: Bildschirm = Bild * zoom + (x, y). dims = { imgW, imgH, viewW, viewH }.

// Kleinster Zoom: Das Bild füllt die Fläche in der Höhe (und nie schmaler als die Fläche).
export function minZoom({ imgW, imgH, viewW, viewH }) {
  return Math.max(viewH / imgH, viewW / imgW);
}

export function maxZoom(dims) {
  return minZoom(dims) * MAX_ZOOM;
}

// Startlage: kleinster Zoom, Bildmitte.
export function fitView(imgW, imgH, viewW, viewH) {
  const zoom = minZoom({ imgW, imgH, viewW, viewH });
  return { zoom, x: (viewW - imgW * zoom) / 2, y: (viewH - imgH * zoom) / 2 };
}

// Zoom begrenzen und das Bild an allen vier Rändern in der Fläche halten.
export function clampView(view, dims) {
  const zoom = clamp(view.zoom, minZoom(dims), maxZoom(dims));
  return {
    zoom,
    x: clamp(view.x, dims.viewW - dims.imgW * zoom, 0),
    y: clamp(view.y, dims.viewH - dims.imgH * zoom, 0),
  };
}

export function panBy(view, dx, dy, dims) {
  return clampView({ zoom: view.zoom, x: view.x + dx, y: view.y + dy }, dims);
}

// Zoomt um den Faktor; der Bildpunkt unter (cx, cy) bleibt unter den Fingern.
export function zoomAt(view, factor, cx, cy, dims) {
  const zoom = clamp(view.zoom * factor, minZoom(dims), maxZoom(dims));
  const k = zoom / view.zoom;
  return clampView({ zoom, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k }, dims);
}

// Ansicht, die den Bildpunkt (imgX, imgY) bei gegebenem Zoom möglichst in die Mitte holt.
export function centerOn(imgX, imgY, zoom, dims) {
  return clampView({ zoom, x: dims.viewW / 2 - imgX * zoom, y: dims.viewH / 2 - imgY * zoom }, dims);
}

export function screenToImage(view, sx, sy) {
  return { x: (sx - view.x) / view.zoom, y: (sy - view.y) / view.zoom };
}

export function imageToScreen(view, ix, iy) {
  return { x: ix * view.zoom + view.x, y: iy * view.zoom + view.y };
}

// --- Verstecke ---

// Umriss des sichtbaren Teils (Beschnitt-Polygon) als Rechteck in Bildkoordinaten.
export function clipBounds(spot) {
  const xs = spot.clip.map((p) => p[0]);
  const ys = spot.clip.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Bildbereich einer Stelle: 0 = links, 1 = Mitte, 2 = rechts.
export function regionOf(spot, imgW) {
  return Math.min(2, Math.floor((spot.hit.x / imgW) * 3));
}

// Treffer-Radius in Bildpixeln: der eigene Radius, auf dem Bildschirm aber nie kleiner als minScreenRadius.
export function hitRadius(spot, zoom, minScreenRadius = 0) {
  return Math.max(spot.hit.r, minScreenRadius / zoom);
}

// Schlüssel der getroffenen, noch nicht gefundenen Figur (die nächstgelegene) oder null.
export function hitTest(spots, found, imgX, imgY, zoom, minScreenRadius = 0) {
  let best = null;
  let bestDist = Infinity;
  for (const spot of spots) {
    if (found.includes(spot.key)) continue;
    const d = Math.hypot(imgX - spot.hit.x, imgY - spot.hit.y);
    if (d <= hitRadius(spot, zoom, minScreenRadius) && d < bestDist) {
      best = spot.key;
      bestDist = d;
    }
  }
  return best;
}

// --- Runde ---

export function createRound(keys) {
  return {
    keys: [...keys],
    found: [],
    state: 'play', // 'play' | 'won' | 'lost'
    timeLeft: TIME_LIMIT,
    sinceFound: 0, // Sekunden seit Start bzw. letztem Fund
    hint: 0, // 0 = kein Hinweis, 1 = dezent, 2 = deutlich
    hintKey: null,
    cooldown: 0,
    misses: 0,
  };
}

export const missing = (round) => round.keys.filter((k) => !round.found.includes(k));

// Zeit läuft. Ereignisse: { type: 'tick', left } (jede volle Sekunde der letzten LOW_TIME),
// { type: 'hint', key }, { type: 'hint-strong', key }, { type: 'lost', missing }.
export function tick(round, dt) {
  const events = [];
  if (round.state !== 'play' || !(dt > 0)) return events;
  const before = Math.ceil(round.timeLeft);
  round.timeLeft = Math.max(0, round.timeLeft - dt);
  round.cooldown = Math.max(0, round.cooldown - dt);
  round.sinceFound += dt;
  if (round.timeLeft <= 0) {
    round.state = 'lost';
    events.push({ type: 'lost', missing: missing(round) });
    return events;
  }
  const now = Math.ceil(round.timeLeft);
  if (now < before && now <= LOW_TIME) events.push({ type: 'tick', left: now });
  if (round.hint < 1 && round.sinceFound >= HINT_AFTER) {
    round.hint = 1;
    round.hintKey = missing(round)[0];
    events.push({ type: 'hint', key: round.hintKey });
  }
  if (round.hint < 2 && round.sinceFound >= HINT_STRONG_AFTER) {
    round.hint = 2;
    events.push({ type: 'hint-strong', key: round.hintKey });
  }
  return events;
}

// Tipp auf den Bildpunkt (imgX, imgY). Ereignisse: { type: 'found', key } (+ { type: 'won' }),
// { type: 'miss', penalty } (+ { type: 'lost', missing }) oder nichts (Abklingzeit, schon gefundene Figur).
export function tapAt(round, spots, imgX, imgY, zoom, minScreenRadius = 0) {
  const events = [];
  if (round.state !== 'play') return events;
  const key = hitTest(spots, round.found, imgX, imgY, zoom, minScreenRadius);
  if (key) {
    round.found.push(key);
    round.sinceFound = 0;
    round.hint = 0;
    round.hintKey = null;
    events.push({ type: 'found', key });
    if (round.found.length >= round.keys.length) {
      round.state = 'won';
      events.push({ type: 'won' });
    }
    return events;
  }
  // Tipp auf eine schon gefundene Figur: weder Fund noch Fehltipp.
  const done = spots.filter((s) => round.found.includes(s.key));
  if (hitTest(done, [], imgX, imgY, zoom, minScreenRadius)) return events;
  if (round.cooldown > 0) return events;
  round.cooldown = MISS_COOLDOWN;
  round.misses += 1;
  round.timeLeft = Math.max(0, round.timeLeft - MISS_PENALTY);
  events.push({ type: 'miss', penalty: MISS_PENALTY });
  if (round.timeLeft <= 0) {
    round.state = 'lost';
    events.push({ type: 'lost', missing: missing(round) });
  }
  return events;
}
