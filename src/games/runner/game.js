// Kapitel 1 „Im Galopp zum Südkreuz“: Darstellung, Eingabe und Ton.
// Die Regeln stehen in logic.js; hier wird die Welt im festen Takt fortgeschrieben und gezeichnet.

import { createRng } from '../../core/rng.js';
import { banner, burst, createHud, createLoop, fitCanvas, h, popWord, shake } from '../kit.js';
import { createFx } from './fx.js';
import { GESPANN_SCALE, NOSE, createGespann } from './horse.js';
import { FIXED_STEP, HEARTS, OBSTACLES, PLAYER_X, VIEW_W, autopilotInput, buildCourse, createWorld, progress, screenX, stepWorld } from './logic.js';
import { createScene } from './scene.js';
import { createThings } from './things.js';

const GROUND_FRAC = 0.72; // Huflinie bei 72 % der Bühnenhöhe
const MAX_DPR = 2; // schärfer bringt auf dem Handy nichts, kostet aber Füllrate
const END_DELAY = 1.5; // Sekunden zwischen Banner und ctx.end()
const BUF = { w: 440, h: 460, ox: 220, oy: 310 }; // Zwischenbild fürs Blinken nach einem Treffer
const WIN_SLIDE = 110; // so weit rollt das Gespann im Bahnhof noch ins Bild hinein (Einheiten)

export function createGame(ctx) {
  const root = ctx.root;
  root.classList.add('g-runner');

  // Debug: ?seed=123 legt die Strecke fest (für die Browser-Probe).
  const seed = ctx.debug ? Number(new URLSearchParams(globalThis.location?.search ?? '').get('seed')) : 0;
  const course = buildCourse(seed ? createRng(seed) : ctx.rng);
  const world = createWorld(course);
  const gespann = createGespann(ctx.assets);
  const fxRng = createRng(ctx.rng.int(1, 2 ** 30)); // Partikel: eigener Zufallsstrom, nur Dekoration
  const fx = createFx(() => fxRng.next());

  let scene = null;
  let things = null;
  let res = 0;
  let u = 1; // CSS-Pixel je Einheit
  let buf = null;

  const view = fitCanvas(root, {
    onResize(v) {
      const dpr = Math.min(v.dpr, MAX_DPR);
      if (dpr !== v.dpr) {
        v.dpr = dpr;
        v.canvas.width = Math.round(v.w * dpr);
        v.canvas.height = Math.round(v.h * dpr);
      }
      u = v.w / VIEW_W;
      const r = u * dpr;
      if (Math.abs(r - res) > 1e-6) {
        res = r;
        build();
      }
    },
  });

  function build() {
    scene = createScene(res);
    things = createThings(res);
    buf = document.createElement('canvas');
    buf.width = Math.round(BUF.w * res);
    buf.height = Math.round(BUF.h * res);
  }
  // Schilder nutzen die App-Schriften: sind sie beim ersten Aufbau noch nicht da, einmal neu zeichnen.
  let alive = true;
  const fonts = globalThis.document?.fonts;
  if (fonts?.load && !(fonts.check("400 20px 'Luckiest Guy'") && fonts.check('800 20px Nunito'))) {
    Promise.all([fonts.load("400 20px 'Luckiest Guy'"), fonts.load('800 20px Nunito')]).then(
      () => alive && build(),
      () => {},
    );
  }

  const hud = createHud(root);
  hud.setHearts(HEARTS, HEARTS);
  hud.setText('🐟 0');
  hud.setBar(0);
  hud.el.append(h('span.g-runner-train', '🚆'));
  const hint = h('div.g-runner-hint');
  const warn = h('div.g-runner-warn', h('b', '!'));
  root.append(hint, warn);
  let hintText = '';
  let warnOn = false;
  const setHint = (text) => {
    if (text === hintText) return;
    hintText = text;
    if (text) hint.textContent = text;
    hint.classList.toggle('on', !!text);
  };
  const setWarn = (on) => {
    if (on === warnOn) return;
    warnOn = on;
    warn.classList.toggle('on', on);
  };

  // --- Eingabe: der ganze Bildschirm ist Tippfläche ---
  const input = { pressed: false, held: false };
  const fingers = new Set();
  let pressed = false;
  const down = (e) => {
    e.preventDefault();
    fingers.add(e.pointerId);
    pressed = true;
    ctx.audio.unlock?.();
  };
  const up = (e) => fingers.delete(e.pointerId);
  root.addEventListener('pointerdown', down);
  globalThis.addEventListener('pointerup', up);
  globalThis.addEventListener('pointercancel', up);

  // --- Zustand der Darstellung ---
  let time = 0;
  let acc = 0;
  let rate = 1;
  let paused = false;
  let auto = false;
  let ended = false;
  let endAt = Infinity;
  let bannerEl = null;
  let lastMampf = -1;
  let lastBite = -1;
  let tipUntil = -1;
  let sweeper = null; // angekündigte Kehrmaschine
  let skidFrom = -1;
  let snort = 0;
  let lastDist = 0;
  let slide = 0; // Versatz des Gespanns nach vorn beim Ausrollen im Bahnhof
  const flings = new Map(); // Hindernis-Index → Sekunden seit dem Treffer

  const px = (x) => x * u;
  const groundPx = () => Math.round(view.h * GROUND_FRAC);

  function handle(e) {
    switch (e.type) {
      case 'jump':
        ctx.audio.play('jump');
        gespann.onJump();
        fx.dust(PLAYER_X - 20, groundPx() / u, 4);
        break;
      case 'doubleJump':
        ctx.audio.play('doubleJump');
        gespann.onDoubleJump();
        break;
      case 'land': {
        ctx.audio.play('land');
        gespann.onLand(1);
        const gy = groundPx() / u;
        fx.dust(PLAYER_X, gy, 7, 1.4);
        fx.leaves(PLAYER_X, gy, 9);
        break;
      }
      case 'treat':
        if (time - lastBite > 0.07) {
          ctx.audio.play('mampf');
          lastBite = time;
        }
        if (time - lastMampf > 0.5) {
          lastMampf = time;
          popWord(root, 'MAMPF!', px(e.x), groundPx() - px(e.alt) - 0.5 * u * 16, { color: '#FFD23F', size: 1.7, rot: 8, life: 700 });
        }
        hud.setText('🐟 ' + e.count);
        break;
      case 'hit': {
        ctx.audio.play('bonk');
        gespann.onHit();
        hud.setHearts(e.hearts, HEARTS);
        shake(root, 7, 360);
        popWord(root, 'BONK!', px(Math.max(e.x, 170)), groundPx() - px(Math.min(e.alt + 70, 330)), { color: '#E5484D', size: 2.9, rot: -9, life: 1000 });
        const gy = groundPx() / u;
        if (e.kind === 'taube') fx.feathers(e.x, gy - e.alt, 9);
        else fx.leaves(e.x, gy - 20, e.kind === 'laub' ? 16 : 6, 1.2);
        if (e.kind !== 'kehrmaschine') flings.set(e.index, 0);
        break;
      }
      case 'hint':
        tipUntil = world.obstacles[0].x + world.obstacles[0].w;
        break;
      case 'warn':
        sweeper = world.obstacles.find((o) => o.warned && OBSTACLES[o.kind].double && o.x + o.w > world.dist) ?? null;
        ctx.audio.play('no');
        break;
      case 'won':
        ctx.audio.play('wieher');
        skidFrom = world.dist;
        fx.cloud(PLAYER_X + slide + 30, groundPx() / u, 12);
        break;
      case 'lost':
        skidFrom = -1;
        break;
      case 'stopped': {
        const won = world.phase === 'won';
        ctx.audio.play(won ? 'win' : 'lose');
        bannerEl = banner(root, won ? 'GESCHAFFT!' : 'ZUG VERPASST?', won ? 'win' : 'lose');
        if (won) {
          burst(root, view.w / 2, view.h * 0.4, { count: 36, spread: 190 });
          fx.cloud(PLAYER_X + slide + 40, groundPx() / u, 14);
        }
        endAt = world.over + END_DELAY;
        break;
      }
      default:
    }
  }

  function tick() {
    let inp = input;
    if (auto) inp = autopilotInput(world);
    else {
      input.pressed = pressed;
      input.held = fingers.size > 0;
    }
    pressed = false;
    const events = stepWorld(world, FIXED_STEP, inp);
    for (let i = 0; i < events.length; i++) handle(events[i]);
    if (!ended && world.over >= endAt) {
      ended = true;
      ctx.end(world.phase === 'won');
    }
  }

  // Alles, was nur hübsch ist und nicht im festen Takt laufen muss.
  function animate(dt) {
    time += dt;
    const gy = groundPx() / u;
    if (gespann.update(dt, world)) {
      ctx.audio.play('hoof');
      fx.dust(PLAYER_X - 34, gy + 2, 1, 0.55);
    }
    for (const [i, t] of flings) {
      if (t > 1.4) flings.delete(i);
      else flings.set(i, t + dt);
    }
    slide += ((world.phase === 'won' ? WIN_SLIDE : 0) - slide) * Math.min(1, dt * 2.4);
    if (world.phase === 'won' && !world.stopped) fx.cloud(PLAYER_X + slide + 40, gy, 1);
    if (world.phase === 'lost' && world.stopped) {
      snort -= dt;
      if (snort <= 0) {
        snort = 0.55;
        fx.puff(PLAYER_X + NOSE.x, gy + NOSE.y + 4, 1);
        fx.puff(PLAYER_X + NOSE.x, gy + NOSE.y + 8, 1);
      }
    }
    fx.step(dt, world.dist - lastDist, VIEW_W, view.h / u, gy);
    lastDist = world.dist;

    // Hinweise
    let text = '';
    if (world.phase === 'run') {
      if (sweeper && (sweeper.hit || sweeper.x + sweeper.w < world.dist)) sweeper = null;
      if (sweeper) text = 'Doppelsprung!';
      else if (world.dist < tipUntil && world.jumps === 0) text = 'Tippen = springen!';
    }
    setHint(text);
    setWarn(!!sweeper && world.phase === 'run' && screenX(world, sweeper) > VIEW_W - 60);
    hud.setBar(progress(world));
  }

  function render() {
    if (!scene) return;
    const g = view.g;
    const k = view.dpr * u;
    g.setTransform(k, 0, 0, k, 0, 0);
    const vw = VIEW_W;
    const vh = view.h / u;
    const G = Math.round(groundPx() * view.dpr) / k; // auf ganze Pixel, damit die Kacheln scharf bleiben
    const env = { vw, vh, G, dist: world.dist, time };
    scene.drawBack(g, env);

    // Bremsspur im Bahnhof
    if (skidFrom >= 0) {
      const x0 = PLAYER_X + (skidFrom - world.dist);
      g.fillStyle = 'rgba(59,42,34,.32)';
      const len = PLAYER_X + slide + 6 - x0;
      g.fillRect(x0 - 34, G + 3, len, 4);
      g.fillRect(x0 + 38, G + 7, len, 4);
    }

    // Leckerlis
    const tl = world.treatList;
    for (let i = Math.max(0, world.firstTreat - 8); i < tl.length; i++) {
      const t = tl[i];
      const sx = screenX(world, t);
      if (sx > vw + 30) break;
      if (!t.taken) things.drawTreat(g, sx, G - t.alt, time, i);
    }

    // Hindernisse mit Schatten; getroffene fliegen im hohen Bogen davon
    const list = world.obstacles;
    for (let i = Math.max(0, world.firstObstacle - 2); i < list.length; i++) {
      const o = list[i];
      const sx = screenX(world, o);
      if (sx > vw + 40) break;
      const ft = flings.get(i);
      if (o.hit && ft === undefined && o.kind !== 'kehrmaschine') continue;
      g.fillStyle = 'rgba(59,42,34,.22)';
      g.beginPath();
      g.ellipse(sx + o.w / 2, G + 3, o.w * (o.alt ? 0.4 : 0.56), o.alt ? 5 : 7, 0, 0, Math.PI * 2);
      g.fill();
      if (ft !== undefined) {
        g.save();
        g.translate(sx + o.w / 2 + ft * 260, G - o.alt - o.h / 2 - (520 * ft - 760 * ft * ft));
        g.rotate(ft * 7);
        g.globalAlpha = Math.max(0, 1 - ft / 1.3);
        things.drawObstacle(g, o.kind, -o.w / 2, o.h / 2, time);
        g.restore();
      } else things.drawObstacle(g, o.kind, sx, G - o.alt, time);
    }

    // Gespann: Schatten, Staub dahinter, nach Treffern blinkend
    const p = world.player;
    const gx = PLAYER_X + slide;
    const sk = 1 - Math.min(p.alt, 320) / 520;
    g.fillStyle = `rgba(59,42,34,${0.26 * sk})`;
    g.beginPath();
    g.ellipse(gx + 4, G + 4, 84 * GESPANN_SCALE * sk, 11 * sk, 0, 0, Math.PI * 2);
    g.fill();
    fx.draw(g, 'back');
    const blink = world.inv > 0 && world.phase === 'run' && Math.floor(world.inv * 9) % 2 === 0;
    if (blink) {
      const b = buf.getContext('2d');
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.clearRect(0, 0, buf.width, buf.height);
      b.setTransform(res, 0, 0, res, 0, 0);
      gespann.draw(b, BUF.ox, BUF.oy + p.alt, world);
      g.globalAlpha = 0.38;
      g.drawImage(buf, gx - BUF.ox, G - p.alt - BUF.oy, BUF.w, BUF.h);
      g.globalAlpha = 1;
    } else gespann.draw(g, gx, G, world);

    scene.drawFront(g, env);
    fx.draw(g, 'front');
  }

  // Warnschild auf Höhe der Straße
  const place = () => {
    warn.style.top = groundPx() - 5.6 * parseFloat(getComputedStyle(root).fontSize || '16') + 'px';
  };
  place();
  const ro = new ResizeObserver(place);
  ro.observe(root);

  const loop = createLoop((dt) => {
    if (!paused) {
      acc += dt * rate;
      let n = 0;
      while (acc >= FIXED_STEP && n++ < 96) {
        tick();
        acc -= FIXED_STEP;
      }
      if (acc > FIXED_STEP) acc = 0;
      animate(dt * rate);
    }
    render();
  });

  // Debug-Haken für die Browser-Probe: Autopilot, Zeitraffer, Standbild.
  const debugApi = {
    world,
    course,
    auto: (on = true) => (auto = on),
    rate: (k = 1) => (rate = k),
    pause: (on = true) => (paused = on),
    press: () => (pressed = true),
    state: () => {
      const o = world.obstacles[world.firstObstacle];
      return {
        phase: world.phase,
        time: world.time,
        dist: world.dist,
        length: course.length,
        hearts: world.hearts,
        treats: world.treats,
        hits: world.hits,
        alt: world.player.alt,
        v: world.player.v,
        jumps: world.player.jumps,
        spin: world.player.spin,
        grounded: world.player.grounded,
        inv: world.inv,
        stopped: world.stopped,
        ended,
        hint: hintText,
        warn: warnOn,
        next: o ? { kind: o.kind, sx: screenX(world, o), hit: o.hit } : null,
      };
    },
  };
  if (ctx.debug) globalThis.__game = debugApi;

  return {
    destroy() {
      alive = false;
      ended = true;
      loop.stop();
      ro.disconnect();
      root.removeEventListener('pointerdown', down);
      globalThis.removeEventListener('pointerup', up);
      globalThis.removeEventListener('pointercancel', up);
      hud.destroy();
      hint.remove();
      warn.remove();
      bannerEl?.remove();
      view.destroy();
      root.classList.remove('g-runner');
      if (globalThis.__game === debugApi) delete globalThis.__game;
    },
  };
}
