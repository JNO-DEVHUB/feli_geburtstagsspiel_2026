// Kapitel 3 „Verloren in Hamburg!“ – Wimmelbild: verschieben, zoomen, Feli, Franks und Findi finden.
// Darstellung und Eingabe; Regeln und Zahlen stehen in logic.js, die Verstecke in spots.js.

import { banner, burst, charEl, createHud, createLoop, h, headEl, popWord, sparkle } from '../kit.js';
import * as L from './logic.js';
import { IMG, SPOTS, spotByKey } from './spots.js';

const GLOW_SCALE = 1.5; // Hinweis-Schimmer: Durchmesser als Vielfaches der Figurgröße (≈ Treffer-Kreis)
const ARROW_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 8 36 20 6 32l7-12z" fill="#FFD23F" stroke="#3B2A22" stroke-width="4" stroke-linejoin="round"/></svg>';

export function createGame(ctx) {
  const { root, audio, assets } = ctx;
  root.classList.add('g-wimmel');

  // --- Aufbau ---
  const world = h('div.g-wimmel-world', { style: { width: IMG.w + 'px', height: IMG.h + 'px' } });
  world.append(h('img.g-wimmel-img', { src: assets.url('bg:k3'), alt: '', draggable: 'false', width: IMG.w, height: IMG.h }));

  const figs = {}; // key -> { wrap, glow, ring }
  for (const spot of SPOTS) {
    const b = L.clipBounds(spot);
    const poly = spot.clip.map(([x, y]) => `${x - b.x}px ${y - b.y}px`).join(',');
    const fig = h('div.g-wimmel-fig', { style: { left: spot.x - b.x + 'px', top: spot.y - b.y + 'px', width: spot.w + 'px', transform: `rotate(${spot.rot}deg)`, filter: spot.filter } }, h('div', { style: { clipPath: spot.cut } }, charEl(assets, spot.who, spot.outfit)));
    const wrap = h('div.g-wimmel-spot' + (spot.glass ? '.glass' : ''), { 'data-key': spot.key, style: { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', clipPath: `polygon(${poly})` } }, fig);
    const size = spot.hit.r * 2 * GLOW_SCALE;
    const glow = h('div.g-wimmel-glow', { style: { left: spot.hit.x + 'px', top: spot.hit.y + 'px', width: size + 'px', height: size + 'px' } });
    world.append(wrap, glow);
    figs[spot.key] = { wrap, glow, ring: null };
  }

  const arrow = h('div.g-wimmel-arrow', { html: ARROW_SVG });
  arrow.hidden = true;
  const viewEl = h('div.g-wimmel-view.allow-fast-taps', world, arrow);

  const cards = {};
  const bar = h(
    'div.g-wimmel-bar',
    SPOTS.map((spot) => (cards[spot.key] = h('div.g-wimmel-card', h('div.g-wimmel-face', headEl(assets, spot.who)), h('b', spot.name), h('i', '✓')))),
  );

  root.append(viewEl, bar);
  const hud = createHud(root);
  hud.el.classList.add('g-wimmel-hud');

  // --- Zustand ---
  const round = L.createRound(SPOTS.map((s) => s.key));
  let dims = { imgW: IMG.w, imgH: IMG.h, viewW: 1, viewH: 1 };
  let view = { zoom: 1, x: 0, y: 0 };
  let em = 16;
  let dirty = true;
  let ended = false;
  let dead = false;
  let glide = null; // Kamerafahrt { from, to, t, dur, done }
  let shownSecond = -1;
  let flashTimer = 0;
  const timers = new Set();

  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
  };
  const pause = (ms) => new Promise((resolve) => later(resolve, ms));

  // Größe der Fläche übernehmen. Beim ersten Mal: kleinster Zoom, Bildmitte. Später (Drehen, Fenstergröße):
  // Bildmitte und Zoomstufe behalten.
  let measured = false;
  function measure() {
    const r = viewEl.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    em = parseFloat(getComputedStyle(root).fontSize) || 16;
    const center = L.screenToImage(view, dims.viewW / 2, dims.viewH / 2);
    const rel = view.zoom / L.minZoom(dims);
    dims = { imgW: IMG.w, imgH: IMG.h, viewW: r.width, viewH: r.height };
    view = measured ? L.centerOn(center.x, center.y, rel * L.minZoom(dims), dims) : L.fitView(IMG.w, IMG.h, r.width, r.height);
    measured = true;
    dirty = true;
  }
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(viewEl);

  function apply() {
    dirty = false;
    world.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`;
  }
  apply();

  const screenOf = (key) => {
    const s = spotByKey(key);
    return L.imageToScreen(view, s.hit.x, s.hit.y);
  };

  // --- Rückmeldungen ---
  function addRing(key, kind) {
    const s = spotByKey(key);
    const ring = h('div.g-wimmel-ring.' + kind, { style: { left: s.hit.x + 'px', top: s.hit.y + 'px', width: s.hit.r * 2 + 'px', height: s.hit.r * 2 + 'px' } });
    world.append(ring);
    figs[key].ring = ring;
  }

  function clearHint() {
    for (const k of Object.keys(figs)) {
      figs[k].glow.classList.remove('on', 'strong');
      cards[k].classList.remove('hint');
    }
    arrow.hidden = true;
  }

  function updateArrow() {
    const key = round.state === 'play' && round.hint > 0 ? round.hintKey : null;
    if (!key) {
      arrow.hidden = true;
      return;
    }
    const p = screenOf(key);
    const m = 1.5 * em;
    const inside = p.x >= m && p.x <= dims.viewW - m && p.y >= m && p.y <= dims.viewH - m;
    arrow.hidden = inside;
    if (inside) return;
    const cx = dims.viewW / 2;
    const cy = dims.viewH / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    // Schnittpunkt der Linie Mitte → Figur mit dem eingerückten Rand.
    const k = Math.min((cx - m) / Math.abs(dx || 1e-6), (cy - m) / Math.abs(dy || 1e-6));
    arrow.style.transform = `translate(${cx + dx * k}px, ${cy + dy * k}px) rotate(${Math.atan2(dy, dx)}rad)`;
    arrow.classList.toggle('strong', round.hint > 1);
  }

  function updateHud(force) {
    const sec = Math.ceil(round.timeLeft);
    hud.setBar(round.timeLeft / L.TIME_LIMIT, round.timeLeft <= L.LOW_TIME);
    if (sec !== shownSecond || force) {
      shownSecond = sec;
      hud.setText(String(sec));
      hud.el.classList.toggle('low', round.timeLeft <= L.LOW_TIME);
    }
  }

  function flashHud() {
    hud.el.classList.remove('miss');
    void hud.el.offsetWidth; // Animation neu starten
    hud.el.classList.add('miss');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => hud.el.classList.remove('miss'), 650);
  }

  function handle(events, at) {
    for (const ev of events) {
      if (ev.type === 'found') {
        const c = screenOf(ev.key);
        const r = spotByKey(ev.key).hit.r * view.zoom;
        clearHint();
        addRing(ev.key, 'found');
        figs[ev.key].wrap.classList.add('found');
        cards[ev.key].classList.add('found');
        audio.play('ping');
        popWord(root, 'GEFUNDEN!', clampX(c.x, 5.2), Math.max(4.2 * em, c.y - r - 1.1 * em), { color: '#3F9B5A', size: 2.1, rot: -7 });
        sparkle(root, c.x, c.y);
      } else if (ev.type === 'miss') {
        audio.play('no');
        popWord(root, 'Nö!', clampX(at.x, 2), Math.max(4 * em, at.y - 1.2 * em), { color: '#E5484D', size: 2, rot: 6, life: 800 });
        popWord(root, `−${ev.penalty} s`, dims.viewW / 2, 4.2 * em, { color: '#E5484D', size: 1.5, rot: -4, life: 900 });
        flashHud();
        updateHud(true);
      } else if (ev.type === 'tick') {
        audio.play('tick');
      } else if (ev.type === 'hint' || ev.type === 'hint-strong') {
        const strong = ev.type === 'hint-strong';
        figs[ev.key].glow.classList.add('on');
        figs[ev.key].glow.classList.toggle('strong', strong);
        cards[ev.key].classList.toggle('hint', strong);
      } else if (ev.type === 'won') {
        finishWin();
      } else if (ev.type === 'lost') {
        finishLose(ev.missing);
      }
    }
  }

  const clampX = (x, halfEm) => Math.min(dims.viewW - halfEm * em, Math.max(halfEm * em, x));

  function end(won) {
    if (ended || dead) return;
    ended = true;
    ctx.end(won);
  }

  async function finishWin() {
    clearHint();
    updateHud(true);
    await pause(450);
    audio.play('win');
    banner(root, 'ALLE GEFUNDEN!', 'win');
    burst(root, dims.viewW * 0.5, dims.viewH * 0.42, { count: 44, spread: 230 });
    later(() => burst(root, dims.viewW * 0.22, dims.viewH * 0.3, { count: 26 }), 220);
    later(() => burst(root, dims.viewW * 0.78, dims.viewH * 0.34, { count: 26 }), 420);
    await pause(1500);
    end(true);
  }

  async function finishLose(missingKeys) {
    clearHint();
    updateHud(true);
    audio.play('lose');
    for (const key of missingKeys) {
      addRing(key, 'missed');
      cards[key].classList.add('missed');
    }
    // Kamera: kleinster Zoom. Passen alle fehlenden Figuren in einen Ausschnitt, reicht eine Fahrt,
    // sonst nacheinander zu jeder, die nicht schon gut zu sehen ist.
    const zoom = L.minZoom(dims);
    const hits = missingKeys.map((key) => spotByKey(key).hit);
    const xs = hits.map((p) => p.x);
    const ys = hits.map((p) => p.y);
    const margin = 3 * em;
    const fits = (Math.max(...xs) - Math.min(...xs)) * zoom + 2 * margin <= dims.viewW && (Math.max(...ys) - Math.min(...ys)) * zoom + 2 * margin <= dims.viewH;
    const stops = fits ? [{ x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 }] : hits;
    for (const stop of stops) {
      const group = fits ? hits : [stop];
      const visible = view.zoom <= zoom * 1.4 && group.every((p) => inView(view, p, margin));
      if (!visible) await glideTo(L.centerOn(stop.x, stop.y, zoom, dims), 460);
      await pause(fits ? 600 : 400);
    }
    banner(root, 'ANSCHLUSS WEG?', 'lose');
    await pause(1300);
    end(false);
  }

  const inView = (v, p, m) => {
    const q = L.imageToScreen(v, p.x, p.y);
    return q.x > m && q.x < dims.viewW - m && q.y > m && q.y < dims.viewH - m;
  };

  function glideTo(to, dur) {
    return new Promise((resolve) => {
      glide = { from: { ...view }, to, t: 0, dur: dur / 1000, done: resolve };
    });
  }

  // --- Eingabe ---
  const pointers = new Map(); // id -> { x, y }
  let gesture = null; // { t0, sx, sy, moved, multi, panning }

  const pos = (e) => {
    const r = viewEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onDown(e) {
    if (round.state !== 'play') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const p = pos(e);
    pointers.set(e.pointerId, p);
    try {
      viewEl.setPointerCapture(e.pointerId);
    } catch {
      // Zeiger schon wieder weg
    }
    if (pointers.size === 1) gesture = { t0: performance.now(), sx: p.x, sy: p.y, moved: 0, multi: false, panning: false };
    else if (gesture) gesture.multi = true;
  }

  function onMove(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev || !gesture || round.state !== 'play') return;
    e.preventDefault();
    const p = pos(e);
    if (pointers.size === 1) {
      gesture.moved = Math.max(gesture.moved, Math.hypot(p.x - gesture.sx, p.y - gesture.sy));
      // Kleine Totzone, damit ein ruhiger Tipp das Bild nicht verrutscht.
      if (!gesture.panning && !gesture.multi && gesture.moved < L.TAP_MAX_MOVE * 0.5) return;
      gesture.panning = true;
      view = L.panBy(view, p.x - prev.x, p.y - prev.y, dims);
      dirty = true;
      pointers.set(e.pointerId, p);
      return;
    }
    // Zwei Finger: Abstand = Zoom, Mittelpunkt = Verschieben.
    const [a, b] = [...pointers.entries()].slice(0, 2);
    if (e.pointerId !== a[0] && e.pointerId !== b[0]) return;
    const other = e.pointerId === a[0] ? b[1] : a[1];
    const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
    const d1 = Math.hypot(p.x - other.x, p.y - other.y);
    const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
    const m1 = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
    view = L.panBy(view, m1.x - m0.x, m1.y - m0.y, dims);
    if (d0 > 8 && d1 > 8) view = L.zoomAt(view, d1 / d0, m1.x, m1.y, dims);
    dirty = true;
    pointers.set(e.pointerId, p);
  }

  function onUp(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    const g = gesture;
    if (pointers.size > 0 || !g) return;
    gesture = null;
    if (e.type !== 'pointerup' || g.multi || round.state !== 'play') return;
    if (g.moved >= L.TAP_MAX_MOVE || performance.now() - g.t0 >= L.TAP_MAX_MS) return;
    // p ist die zuletzt verarbeitete Fingerposition: Das Bild ist ihr gefolgt, der Bildpunkt darunter stimmt also.
    tap(p.x, p.y);
  }

  function tap(sx, sy) {
    const p = L.screenToImage(view, sx, sy);
    handle(L.tapAt(round, SPOTS, p.x, p.y, view.zoom, L.MIN_HIT_EM * em), { x: sx, y: sy });
  }

  // Am Rechner: Mausrad zoomt um den Zeiger.
  function onWheel(e) {
    e.preventDefault();
    if (round.state !== 'play') return;
    const p = pos(e);
    view = L.zoomAt(view, Math.exp(-e.deltaY * 0.0015), p.x, p.y, dims);
    dirty = true;
  }

  const noMenu = (e) => e.preventDefault();
  viewEl.addEventListener('pointerdown', onDown);
  viewEl.addEventListener('pointermove', onMove);
  viewEl.addEventListener('pointerup', onUp);
  viewEl.addEventListener('pointercancel', onUp);
  viewEl.addEventListener('contextmenu', noMenu);
  viewEl.addEventListener('wheel', onWheel, { passive: false });

  // --- Schleife ---
  const advance = (dt) => {
    if (round.state === 'play') handle(L.tick(round, dt));
  };
  const loop = createLoop((dt) => {
    advance(dt);
    if (glide) {
      glide.t = Math.min(1, glide.t + dt / glide.dur);
      const k = glide.t < 0.5 ? 2 * glide.t * glide.t : 1 - (-2 * glide.t + 2) ** 2 / 2;
      view = {
        zoom: glide.from.zoom + (glide.to.zoom - glide.from.zoom) * k,
        x: glide.from.x + (glide.to.x - glide.from.x) * k,
        y: glide.from.y + (glide.to.y - glide.from.y) * k,
      };
      dirty = true;
      if (glide.t >= 1) {
        const done = glide.done;
        glide = null;
        done();
      }
    }
    if (dirty) apply();
    updateHud(false);
    updateArrow();
  });
  updateHud(true);

  if (ctx.debug) {
    globalThis.__game = {
      logic: L,
      spots: SPOTS,
      round,
      em: () => em,
      dims: () => ({ ...dims }),
      view: () => ({ ...view }),
      // Mitte des Verstecks auf dem Bildschirm (Seitenkoordinaten) und ob sie in der Fläche liegt.
      screenOf(key) {
        const p = screenOf(key);
        const r = viewEl.getBoundingClientRect();
        return { x: p.x + r.left, y: p.y + r.top, inside: p.x >= 0 && p.x <= dims.viewW && p.y >= 0 && p.y <= dims.viewH };
      },
      // Kamera auf ein Versteck (oder einen Bildpunkt) setzen; rel = Zoom als Vielfaches des kleinsten.
      focus(target, rel = 1) {
        const s = typeof target === 'string' ? spotByKey(target).hit : target;
        view = L.centerOn(s.x, s.y, L.minZoom(dims) * rel, dims);
        dirty = true;
        return { ...view };
      },
      // Zeitraffer: Sekunden in kleinen Schritten vorspulen (Ereignisse laufen wie im Spiel).
      skip(seconds) {
        for (let t = 0; t < seconds && round.state === 'play'; t += 0.05) advance(Math.min(0.05, seconds - t));
        return round.timeLeft;
      },
    };
  }

  return {
    destroy() {
      dead = true;
      loop.stop();
      ro.disconnect();
      for (const id of timers) clearTimeout(id);
      clearTimeout(flashTimer);
      timers.clear();
      viewEl.removeEventListener('pointerdown', onDown);
      viewEl.removeEventListener('pointermove', onMove);
      viewEl.removeEventListener('pointerup', onUp);
      viewEl.removeEventListener('pointercancel', onUp);
      viewEl.removeEventListener('contextmenu', noMenu);
      viewEl.removeEventListener('wheel', onWheel);
      hud.destroy();
      viewEl.remove();
      bar.remove();
      root.classList.remove('g-wimmel');
      if (ctx.debug && globalThis.__game?.round === round) delete globalThis.__game;
    },
  };
}
