// Siebenmeter! – Darstellung und Eingabe. Regeln und Stellschrauben stehen in logic.js.
import { banner, burst, createCharSprite, createLoop, fitCanvas, h, pointerPos, popWord, shake } from '../kit.js';
import { FLIGHT, GOALS_NEEDED, IMAGE, KEEPER, THROWS, ballAt, createMatch, keeperAt, keeperDecision, matchOutcome, onTarget, project, recordShot, resolveShot, shotSide, stageLayout, swipeToShot } from './logic.js';

const INK = '#3B2A22';
const SKIN = '#F1C6A3';
const TAU = Math.PI * 2;

// Darstellung (keine Spielregeln)
const PAUSE_AFTER = 1.3; // Sekunden zwischen zwei Würfen
const PAUSE_LAST = 1.05; // … nach dem entscheidenden Wurf bis zum Banner
const END_DELAY = 1.6; // Banner bis ctx.end()
const AIM_ZONE = 0.6; // Wisch darf unterhalb dieser Höhe (Anteil) oder am Ball beginnen
const BALL_R = 0.046; // Ballradius in der Torebene × Torbreite
const KEEPER_H = 0.8; // Jannis Größe × Torhöhe
const KEEPER_ANCHOR = 140; // Sprite-y der Mitte seiner Reichweite (Brust/Arme)
const STAND_Y = ((300 - KEEPER_ANCHOR) / 300) * KEEPER_H; // Ankerhöhe im Stand (Füße am Boden)
const DIVE_ROT = 1.15;
const FELI_H = 0.8; // Felis Größe × Torhöhe (in ihrer Ebene, also doppelt so groß gezeichnet)
const FELI_HAND_DX = 0.28; // Wurfhand rechts neben der Körpermitte × Körperhöhe
const MISS_SIDE = [0.07, 0.12]; // Fehlwürfe landen sichtbar knapp neben dem Pfosten …
const MISS_OVER = 1.34; // … bzw. klar über der Latte

const CALLS = ['Den hab ich!', 'Ich bin eine Wand!', 'Katzenreflexe!', 'Hier kommt nix durch!', 'Hechtsprung!', 'Achtung, Flugshow!'];
const EXCUSES = ['Unhaltbar!', 'Ich war abgelenkt!', 'Der Boden war rutschig!', 'Das war Absicht!', 'Aua. Mein Stolz.'];
const SMUG = ['Rausgeguckt!', 'Zählt als gehalten!', 'Ich hab gepustet!'];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeOutBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

export function createGame(ctx) {
  const { root, assets, audio, rng } = ctx;
  root.classList.add('g-handball');

  const feli = createCharSprite(assets, 'feli', 'trikot');
  const janni = createCharSprite(assets, 'janni', 'torwart');

  let L = stageLayout(390, 844);
  const view = fitCanvas(root, {
    onResize: (v) => {
      L = stageLayout(v.w, v.h);
    },
  });
  const g = view.g;

  // --- Anzeige ---
  const dots = Array.from({ length: THROWS }, () => h('i'));
  const score = h('b');
  const hud = h('div.g-handball-hud', h('div.g-handball-balls', dots), score);
  const bubble = h('div.g-handball-bubble', { hidden: true });
  const hint = h('div.g-handball-hint');
  root.append(hud, bubble, hint);
  let bannerEl = null;

  // --- Zustand ---
  let match = createMatch();
  let phase = 'aim'; // 'aim' | 'fly' | 'after' | 'over'
  let phaseT = 0;
  let time = 0;
  let timeScale = 1;
  let drag = null;
  let preview = null;
  let flight = null; // { shot, t, time }
  let keeper = null;
  let result = null;
  let lastResult = null;
  let ball = null; // Ball nach dem Aufprall (Bildschirm-Physik)
  let ballIn = 1; // neuer Ball ploppt in die Hand
  let throwA = 0; // 0 = Ball in der Hand, 1 = Arm durchgeschwungen
  let aimDir = 0;
  let windup = 0;
  let net = null;
  let victim = null;
  let forced = null; // Debug: 'catch' | 'away'
  let forcedVictim = null; // Debug: 'franks' | 'pigeon'
  let bubbleT = 0;
  let hintT = 0;
  let won = false;
  let ended = false;
  const kp = { x: 0.5, y: STAND_Y, rot: 0, mode: 'idle', t: 0, dir: 1, smugX: 0.5 };

  const u = () => L.w / 390;
  const centerX = () => (L.goal.l + L.goal.r) / 2;
  const startPt = () => project(L, { x: FLIGHT.start.x, y: FLIGHT.start.y, d: 0 });
  const ballR = (m) => BALL_R * L.goal.w * m;

  function renderHud() {
    dots.forEach((el, i) => {
      const r = match.results[i];
      el.className = r === 'goal' ? 'goal' : r ? 'miss' : i === match.throws && !matchOutcome(match) ? 'next' : '';
    });
    score.textContent = `${match.goals}/${GOALS_NEEDED} TORE`;
  }

  function say(text, secs = 1.5) {
    bubble.textContent = text;
    bubble.hidden = false;
    bubbleT = secs;
    placeBubble();
  }

  function placeBubble() {
    const kh = KEEPER_H * L.goal.h;
    const lying = kp.mode === 'floor';
    const kx = kp.mode === 'smug' ? kp.smugX : kp.x; // beim Wegschlendern gleich am Ziel, weg vom Comic-Wort
    const x = clamp(L.goal.l + kx * L.goal.w + (lying ? kp.dir * kh * 0.2 : 0), L.w * 0.3, L.w * 0.7);
    const top = lying ? 0.5 * L.goal.h : Math.max(kp.y, STAND_Y) * L.goal.h + kh * 0.56;
    const y = Math.max(L.h * 0.17, L.goal.b - top);
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
  }

  function showHint(text) {
    hint.textContent = text;
    hint.classList.add('on');
    hintT = 1.5;
  }

  // --- Wurf ---
  function forcedKeeper(s) {
    if (forced === 'catch') return keeperAt(shotSide(s), s.x, s.y);
    const side = s.x < 0.5 ? 'right' : 'left';
    return keeperAt(side, KEEPER.diveX[side], KEEPER.minY);
  }

  function announce(s) {
    const side = shotSide(s);
    if (keeper.side !== 'center' && side !== keeper.side && onTarget(s)) {
      const first = keeper.side === 'left' ? 'Links!' : 'Rechts!';
      return `${first} Nee, ${side === 'center' ? 'Mitte' : side === 'left' ? 'links' : 'rechts'}!`;
    }
    return rng.pick(CALLS);
  }

  function throwBall(s) {
    keeper = forced ? forcedKeeper(s) : keeperDecision(rng, s);
    result = resolveShot(s, keeper);
    let shown = s;
    if (result === 'miss') {
      // Fehlwürfe bleiben im Bild: knapp neben dem Pfosten bzw. klar über der Latte.
      const top = (L.goal.b - L.h * 0.14) / L.goal.h;
      let x = s.x;
      if (x < 0) x = clamp(x, -MISS_SIDE[1], -MISS_SIDE[0]);
      else if (x > 1) x = clamp(x, 1 + MISS_SIDE[0], 1 + MISS_SIDE[1]);
      shown = { ...s, x, y: s.y > 1 ? clamp(s.y, MISS_OVER, Math.max(MISS_OVER, top)) : s.y };
    }
    flight = { shot: shown, t: 0, time: s.time };
    aimDir = clamp((s.x - 0.5) * 0.9, -0.55, 0.55);
    phase = 'fly';
    phaseT = 0;
    kp.mode = 'dive';
    kp.t = 0;
    audio.play('throw');
    say(announce(s), 1.7);
  }

  function impact() {
    const end = project(L, ballAt(flight.shot, 1));
    const r = ballR(end.m);
    const k = u();
    const cx = centerX();
    match = recordShot(match, result);
    lastResult = result;
    renderHud();
    phase = 'after';
    phaseT = 0;
    kp.t = 0;
    if (result === 'goal') {
      audio.play('tor');
      net = { t: 0, x: end.x, y: end.y };
      popWord(root, 'TOOOR!', cx, L.goal.t - L.goal.h * 0.04, { color: '#FFD23F', size: 3.6, rot: -7, life: 1150 });
      burst(root, end.x, end.y, { count: 14, spread: 90 * k, colors: ['#fff', '#FFD23F', '#F07A1A'] });
      shake(view.canvas, 4 * k, 300);
      kp.mode = 'floor';
      kp.dir = keeper.side === 'left' ? -1 : keeper.side === 'right' ? 1 : rng.chance(0.5) ? 1 : -1;
      ball = { x: end.x, y: end.y, vx: (end.x - cx) * 0.5, vy: -30 * k, r: r * 0.9, floor: L.goal.b - r * 0.7, behind: true, rot: 0, spin: 5 };
      say(rng.pick(EXCUSES), 1.25);
    } else if (result === 'saved') {
      audio.play('save');
      kp.mode = 'cheer';
      const away = end.x >= L.goal.l + keeper.x * L.goal.w ? 1 : -1;
      const side = L.goal.l + keeper.x * L.goal.w > cx ? -1 : 1; // Comic-Wort auf die freie Seite neben Janni
      popWord(root, 'PATSCH!', clamp(L.goal.l + keeper.x * L.goal.w + side * L.goal.w * 0.3, L.w * 0.22, L.w * 0.78), L.goal.b - L.goal.h * 0.3, { color: '#7CC4F0', size: 2, rot: 6 * side });
      ball = { x: end.x, y: end.y, vx: away * rng.range(70, 130) * k, vy: -250 * k, r, floor: L.goal.b + L.goal.h * 0.32, behind: false, rot: 0, spin: 9 * away };
      say('Ha! Gehalten!', 1.25);
    } else {
      audio.play('bonk');
      const inCrowd = flight.shot.y > 0.6;
      const kind = forcedVictim ?? (inCrowd && rng.chance(0.65) ? 'franks' : 'pigeon');
      let vx = clamp(end.x, L.w * 0.13, L.w * 0.87);
      // Neben dem Pfosten: Opfer nach außen rücken, damit es nicht im Tor steht (darf am Rand angeschnitten sein).
      if (flight.shot.x > 1) vx = Math.max(vx, Math.min(L.goal.r + 30 * k, L.w - 26 * k));
      else if (flight.shot.x < 0) vx = Math.min(vx, Math.max(L.goal.l - 30 * k, 26 * k));
      victim = { kind, x: vx, y: end.y, t: 0, dir: end.x < cx ? 1 : -1, meow: false };
      const word = kind === 'franks' ? 'MIAU?!' : 'GURR!';
      popWord(root, word, clamp(vx, L.w * 0.24, L.w * 0.76), Math.max(L.h * 0.13, end.y - 56 * k), { color: kind === 'franks' ? '#F07A1A' : '#DCE6F2', size: 2.5, rot: kind === 'franks' ? -9 : 8, life: 1100 });
      if (kind === 'pigeon') burst(root, vx, end.y, { count: 12, spread: 80 * k, colors: ['#fff', '#C9D1DC', '#9AA3B2'], size: 8, gravity: 120 });
      kp.mode = 'smug';
      kp.smugX = flight.shot.x < 0 ? 0.68 : flight.shot.x > 1 ? 0.32 : clamp(kp.x, 0.25, 0.75); // weg vom Einschlag
      ball = { x: end.x, y: end.y, vx: victim.dir * rng.range(60, 110) * k, vy: -280 * k, r, floor: L.goal.b + L.goal.h * 0.18, behind: false, rot: 0, spin: 8 * victim.dir };
      say(rng.pick(SMUG), 1.25);
    }
    flight = null;
  }

  function nextThrow() {
    phase = 'aim';
    phaseT = 0;
    ball = null;
    victim = null;
    result = null;
    keeper = null;
    kp.mode = 'idle';
    kp.t = 0;
    ballIn = 0;
    bubble.hidden = true;
    renderHud();
  }

  function finish(outcome) {
    phase = 'over';
    phaseT = 0;
    won = outcome === 'won';
    drag = null;
    preview = null;
    bubble.hidden = true;
    bannerEl = banner(root, won ? 'SIEG! 3 TORE!' : 'JANNI HÄLT ALLES!', won ? 'win' : 'lose');
    // Banner über dem Tor (vor dem Publikum), damit Janni im Tor sichtbar bleibt.
    bannerEl.style.padding = `${Math.round(L.h * 0.07)}px 0 ${Math.round(L.h - L.goal.t)}px`;
    audio.play(won ? 'win' : 'lose');
    if (won) {
      kp.mode = 'floor';
      for (const [fx, fy] of [[0.25, 0.3], [0.75, 0.3], [0.5, 0.55]]) burst(root, L.w * fx, L.h * fy, { count: 30, spread: 170 * u() });
    } else {
      kp.mode = 'cheer';
      kp.t = 0;
    }
  }

  // --- Eingabe ---
  const onDown = (e) => {
    if (phase !== 'aim' || drag) return;
    const p = pointerPos(e, root);
    const s = startPt();
    const nearBall = Math.hypot(p.x - s.x, p.y - s.y) < ballR(s.m) * 2.6;
    if (!nearBall && p.y < L.h * AIM_ZONE) {
      showHint('Wisch vom Ball nach oben!');
      return;
    }
    drag = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: e.timeStamp };
    try {
      root.setPointerCapture(e.pointerId);
    } catch {
      // ohne Capture geht es auch
    }
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = pointerPos(e, root);
    drag.x = p.x;
    drag.y = p.y;
    const s = swipeToShot(drag.x - drag.x0, drag.y - drag.y0, e.timeStamp - drag.t0, L);
    preview = s.valid ? s : null;
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = pointerPos(e, root);
    const s = swipeToShot(p.x - drag.x0, p.y - drag.y0, e.timeStamp - drag.t0, L);
    drag = null;
    preview = null;
    if (phase !== 'aim') return;
    if (s.valid) throwBall(s);
    else showHint('Nach oben wischen!');
  };
  const onCancel = (e) => {
    if (drag && e.pointerId === drag.id) {
      drag = null;
      preview = null;
    }
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onCancel);

  // --- Ablauf ---
  function update(dt) {
    time += dt;
    phaseT += dt;
    if (bubbleT > 0 && (bubbleT -= dt) <= 0) bubble.hidden = true;
    if (!bubble.hidden) placeBubble();
    if (hintT > 0 && (hintT -= dt) <= 0) hint.classList.remove('on');
    ballIn = Math.min(1, ballIn + dt * 4);
    windup += ((preview ? clamp(preview.power, 0, 1) : 0) - windup) * (1 - Math.exp(-dt * 14));
    const armTarget = phase === 'aim' ? 0 : 1;
    throwA = clamp(throwA + (armTarget > throwA ? dt / 0.22 : -dt / 0.3), 0, 1);

    updateKeeper(dt);
    if (net && (net.t += dt) > 1.1) net = null;
    if (victim) {
      victim.t += dt;
      if (victim.kind === 'franks' && !victim.meow && victim.t > 0.2) {
        victim.meow = true;
        audio.play('meow');
      }
    }

    if (phase === 'fly') {
      flight.t += dt / flight.time;
      if (flight.t >= 1) impact();
    } else if (phase === 'after') {
      if (ball) {
        const k = u();
        ball.vy += 900 * k * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.rot += ball.spin * dt;
        if (ball.y > ball.floor) {
          ball.y = ball.floor;
          ball.vy = Math.abs(ball.vy) > 60 * k ? -ball.vy * 0.5 : 0;
          ball.vx *= 0.7;
          ball.spin *= 0.6;
        }
      }
      const outcome = matchOutcome(match);
      if (phaseT >= (outcome ? PAUSE_LAST : PAUSE_AFTER)) {
        if (outcome) finish(outcome);
        else nextThrow();
      }
    } else if (phase === 'over') {
      if (ball) {
        ball.vy += 900 * u() * dt;
        ball.y = Math.min(ball.floor, ball.y + ball.vy * dt);
      }
      if (phaseT >= END_DELAY && !ended) {
        ended = true;
        ctx.end(won);
      }
    }
  }

  function updateKeeper(dt) {
    kp.t += dt;
    let tx = kp.x;
    let ty = STAND_Y;
    let tr = 0;
    let rate = 7;
    if (kp.mode === 'idle') {
      tx = 0.5 + 0.18 * Math.sin(time * 2.3) * (0.75 + 0.25 * Math.sin(time * 0.9));
      tr = 0.07 * Math.sin(time * 4.6);
    } else if (kp.mode === 'dive' && keeper && flight) {
      tx = keeper.x;
      ty = keeper.y;
      tr = keeper.side === 'left' ? -DIVE_ROT : keeper.side === 'right' ? DIVE_ROT : 0;
      rate = 4.4 / flight.time;
    } else if (kp.mode === 'floor') {
      tx = clamp(kp.x, 0.2, 0.8);
      ty = 0.15;
      tr = kp.dir * 1.5;
      rate = 9;
    } else if (kp.mode === 'cheer') {
      tx = clamp(kp.x, 0.2, 0.8);
      rate = 8;
    } else if (kp.mode === 'smug') {
      tx = kp.smugX;
      rate = 5;
    }
    const a = 1 - Math.exp(-dt * rate);
    kp.x += (tx - kp.x) * a;
    kp.y += (ty - kp.y) * a;
    kp.rot += (tr - kp.rot) * a;
  }

  // --- Zeichnen ---
  function draw() {
    const { w, h: hh } = L;
    g.clearRect(0, 0, w, hh);
    g.drawImage(assets.img('bg:k5'), L.ox, L.oy, IMAGE.w * L.scale, IMAGE.h * L.scale);
    drawNet();
    if (ball?.behind) drawBall(ball.x, ball.y, ball.r, ball.rot, ball.floor + ball.r * 0.9);
    if (victim) drawVictim();
    drawKeeper();
    if (ball && !ball.behind) drawBall(ball.x, ball.y, ball.r, ball.rot, ball.floor + ball.r * 0.9);
    if (flight) {
      const p = project(L, ballAt(flight.shot, flight.t));
      drawBall(p.x, p.y, ballR(p.m), flight.t * 9, p.groundY);
    }
    drawFeli();
    if (phase === 'aim') {
      if (preview) drawPreview();
      else if (match.throws === 0 && !drag && time > 0.9) drawSwipeHint();
    }
  }

  function drawBall(x, y, r, rot, shadowY) {
    if (shadowY !== undefined && shadowY > y) {
      const d = clamp((shadowY - y) / (r * 9), 0, 1);
      g.fillStyle = `rgba(40,24,16,${0.34 * (1 - d * 0.4)})`;
      g.beginPath();
      g.ellipse(x, shadowY, r * (1.05 - d * 0.3), r * 0.3, 0, 0, TAU);
      g.fill();
    }
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fillStyle = '#FFF8EC';
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = '#F07A1A';
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1, r * 0.09);
    for (let i = -1; i < 5; i++) {
      const a = (i / 5) * TAU;
      const d = i < 0 ? 0 : r * 0.98;
      const pr = i < 0 ? r * 0.36 : r * 0.38;
      g.beginPath();
      for (let j = 0; j < 5; j++) {
        const b = a + (j / 5) * TAU + (i < 0 ? -Math.PI / 2 : Math.PI);
        const px = Math.cos(a) * d + Math.cos(b) * pr;
        const py = Math.sin(a) * d + Math.sin(b) * pr;
        if (j) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
      g.fill();
      g.stroke();
      if (i >= 0) {
        const b = a - Math.PI / 2 + TAU / 10;
        g.beginPath();
        g.moveTo(Math.cos(b) * r * 0.36, Math.sin(b) * r * 0.36);
        g.lineTo(Math.cos(b) * r * 0.75, Math.sin(b) * r * 0.75);
        g.stroke();
      }
    }
    g.restore();
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1.5, r * 0.17);
    g.stroke();
    g.restore();
  }

  function drawNet() {
    if (!net) return;
    const { goal } = L;
    const life = 1.1;
    const fade = 1 - net.t / life;
    const pull = 0.6 * Math.exp(-net.t * 3.2) * Math.cos(net.t * 24);
    const sig2 = 2 * (goal.w * 0.24) ** 2;
    const wob = (x, y) => {
      const dx = x - net.x;
      const dy = y - net.y;
      const wgt = Math.exp(-(dx * dx + dy * dy) / sig2);
      return [x - dx * wgt * pull + Math.sin(net.t * 30 + y * 0.05) * 1.5 * fade, y - dy * wgt * pull + goal.h * 0.05 * wgt * pull];
    };
    g.save();
    g.beginPath();
    g.rect(goal.l, goal.t, goal.w, goal.h);
    g.clip();
    const flash = g.createRadialGradient(net.x, net.y, 0, net.x, net.y, goal.w * 0.3);
    flash.addColorStop(0, `rgba(255,255,255,${0.55 * fade * fade})`);
    flash.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = flash;
    g.fillRect(goal.l, goal.t, goal.w, goal.h);
    g.strokeStyle = `rgba(255,255,255,${0.9 * fade})`;
    g.lineWidth = 1.7 * u();
    g.lineJoin = 'round';
    const cols = 16;
    const rows = 9;
    const seg = 14;
    g.beginPath();
    for (let c = 1; c < cols; c++) {
      for (let s = 0; s <= seg; s++) {
        const [x, y] = wob(goal.l + (c / cols) * goal.w, goal.t + (s / seg) * goal.h);
        if (s) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
    }
    for (let r = 1; r < rows; r++) {
      for (let s = 0; s <= seg; s++) {
        const [x, y] = wob(goal.l + (s / seg) * goal.w, goal.t + (r / rows) * goal.h);
        if (s) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
    }
    g.stroke();
    g.restore();
  }

  function drawKeeper() {
    const { goal } = L;
    const kh = KEEPER_H * goal.h;
    let hop = 0;
    let squash = 0;
    let headRot = 0.24 * Math.sin(time * 8.5);
    if (kp.mode === 'idle') hop = Math.abs(Math.sin(time * 6.9)) * 0.05 * goal.h;
    else if (kp.mode === 'dive') headRot = 0.38 * Math.sin(time * 24);
    else if (kp.mode === 'cheer') {
      hop = Math.abs(Math.sin(kp.t * 8.5)) * 0.2 * goal.h;
      squash = 0.07 * Math.sin(kp.t * 17);
      headRot = 0.45 * Math.sin(kp.t * 15);
    } else if (kp.mode === 'floor') headRot = 0.3 * Math.sin(kp.t * 5);
    else if (kp.mode === 'smug') headRot = 0.3 * Math.sin(kp.t * 10);
    const ax = goal.l + kp.x * goal.w;
    const ay = goal.b - kp.y * goal.h - hop;
    g.fillStyle = 'rgba(40,24,16,0.25)';
    g.beginPath();
    g.ellipse(ax + Math.sin(kp.rot) * kh * 0.1, goal.b + kh * 0.02, kh * (0.26 + Math.abs(Math.sin(kp.rot)) * 0.2), kh * 0.05, 0, 0, TAU);
    g.fill();
    g.save();
    g.translate(ax, ay);
    g.rotate(kp.rot);
    janni.draw(g, 0, ((300 - KEEPER_ANCHOR) / 300) * kh, kh, { headRot, squash });
    if (kp.mode === 'floor' && kp.t > 0.25) {
      // Sternchen kreisen um den Kopf
      const hy = -((KEEPER_ANCHOR - 78) / 300) * kh;
      for (let i = 0; i < 3; i++) {
        const a = kp.t * 5 + (i / 3) * TAU;
        drawStar(Math.cos(a) * kh * 0.3, hy - kh * 0.2 + Math.sin(a) * kh * 0.08, kh * 0.07, a);
      }
    }
    g.restore();
  }

  function drawStar(x, y, r, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = '#FFD23F';
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1, r * 0.22);
    g.lineJoin = 'round';
    g.fill();
    g.stroke();
    g.restore();
  }

  function drawVictim() {
    const k = u();
    const t = victim.t;
    // Comic-Zacken hinter dem Einschlag
    const zap = clamp(1 - (t - 0.3) / 0.25, 0, 1);
    if (zap > 0) {
      const rad = 46 * k * easeOutBack(Math.min(1, t / 0.14));
      g.save();
      g.globalAlpha = zap;
      g.translate(victim.x, victim.y);
      g.rotate(0.2);
      g.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU;
        const rr = i % 2 ? rad * 0.62 : rad;
        if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = '#FFD23F';
      g.strokeStyle = INK;
      g.lineWidth = 3 * k;
      g.lineJoin = 'round';
      g.fill();
      g.stroke();
      g.restore();
    }
    if (victim.kind === 'franks') {
      const size = 88 * k;
      const up = t < 1.0 ? easeOutBack(Math.min(1, t / 0.22)) : Math.max(0, 1 - (t - 1.0) / 0.2);
      if (up <= 0) return;
      g.save();
      g.translate(victim.x, victim.y + size * 0.42);
      g.rotate(-0.2 * victim.dir + 0.16 * Math.sin(t * 16) * Math.exp(-t * 2.5));
      g.scale(up, up);
      g.drawImage(assets.img('head:franks'), -size / 2, -size * 0.8, size, size);
      // Empörungs-Striche
      g.strokeStyle = '#E5484D';
      g.lineWidth = 4 * k;
      g.lineCap = 'round';
      for (const a of [-0.5, 0, 0.5]) {
        g.beginPath();
        g.moveTo(Math.sin(a) * size * 0.62, -size * 0.3 - Math.cos(a) * size * 0.62);
        g.lineTo(Math.sin(a) * size * 0.8, -size * 0.3 - Math.cos(a) * size * 0.8);
        g.stroke();
      }
      g.restore();
    } else {
      const s = 23 * k;
      const fly = Math.max(0, t - 0.5);
      const alpha = clamp(1.6 - fly * 1.6, 0, 1);
      if (alpha <= 0) return;
      const pop = easeOutBack(Math.min(1, t / 0.18));
      g.save();
      g.globalAlpha = alpha;
      g.translate(victim.x - victim.dir * (s * 1.2 + fly * 70 * k), victim.y - s * 0.3 - fly * fly * 220 * k - fly * 40 * k);
      g.rotate(Math.sin(t * 20) * 0.35 * Math.exp(-t * 1.5));
      g.scale(-victim.dir * pop, pop);
      drawPigeon(s, t);
      g.restore();
    }
  }

  // Taube, schaut nach rechts; s = halbe Körperlänge.
  function drawPigeon(s, t) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1.5, s * 0.16);
    // Füße
    g.beginPath();
    g.moveTo(-s * 0.2, s * 0.6);
    g.lineTo(-s * 0.25, s * 1.05);
    g.moveTo(s * 0.2, s * 0.6);
    g.lineTo(s * 0.25, s * 1.05);
    g.strokeStyle = '#F07A1A';
    g.stroke();
    g.strokeStyle = INK;
    // Schwanz
    g.beginPath();
    g.moveTo(-s * 0.8, -s * 0.1);
    g.lineTo(-s * 1.55, -s * 0.35);
    g.lineTo(-s * 1.45, s * 0.25);
    g.closePath();
    g.fillStyle = '#7F8898';
    g.fill();
    g.stroke();
    // Körper
    g.beginPath();
    g.ellipse(0, 0, s, s * 0.7, 0, 0, TAU);
    g.fillStyle = '#9AA3B2';
    g.fill();
    g.stroke();
    // Kopf
    g.beginPath();
    g.arc(s * 0.8, -s * 0.7, s * 0.45, 0, TAU);
    g.fillStyle = '#B4BCC9';
    g.fill();
    g.stroke();
    // Schnabel
    g.beginPath();
    g.moveTo(s * 1.2, -s * 0.8);
    g.lineTo(s * 1.65, -s * 0.62);
    g.lineTo(s * 1.2, -s * 0.5);
    g.closePath();
    g.fillStyle = '#FFD23F';
    g.fill();
    g.stroke();
    // Auge (verdutzt)
    g.beginPath();
    g.arc(s * 0.88, -s * 0.78, s * 0.2, 0, TAU);
    g.fillStyle = '#fff';
    g.fill();
    g.lineWidth = Math.max(1, s * 0.09);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.92, -s * 0.78, s * 0.07, 0, TAU);
    g.fillStyle = INK;
    g.fill();
    // Flügel flattert
    g.lineWidth = Math.max(1.5, s * 0.16);
    g.save();
    g.translate(-s * 0.1, -s * 0.15);
    g.rotate(Math.sin(t * 34) * 0.9 - 0.5);
    g.beginPath();
    g.ellipse(-s * 0.35, -s * 0.35, s * 0.7, s * 0.36, 0.6, 0, TAU);
    g.fillStyle = '#C9D1DC';
    g.fill();
    g.stroke();
    g.restore();
  }

  function drawPreview() {
    const n = 11;
    const shift = (time * 1.6) % 1;
    g.strokeStyle = INK;
    for (let i = 0; i < n; i++) {
      const f = (i + shift) / n;
      if (f < 0.05) continue;
      const p = project(L, ballAt(preview, f / (2 - f))); // gleichmäßige Abstände auf dem Bildschirm trotz Perspektive
      const r = Math.max(1.8, 2.6 * u() * p.m);
      g.beginPath();
      g.arc(p.x, p.y, r, 0, TAU);
      g.fillStyle = '#fff';
      g.globalAlpha = 0.95;
      g.fill();
      g.lineWidth = Math.max(1, r * 0.45);
      g.stroke();
    }
    const e = project(L, ballAt(preview, 1));
    const r = ballR(e.m) * 1.15;
    const ok = onTarget(preview);
    g.globalAlpha = 1;
    for (const [color, width] of [[INK, 5.5 * u()], [ok ? '#FFD23F' : '#E5484D', 2.8 * u()]]) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(e.x, e.y, r, 0, TAU);
      g.moveTo(e.x - r * 1.5, e.y);
      g.lineTo(e.x - r * 0.55, e.y);
      g.moveTo(e.x + r * 0.55, e.y);
      g.lineTo(e.x + r * 1.5, e.y);
      g.moveTo(e.x, e.y - r * 1.5);
      g.lineTo(e.x, e.y - r * 0.55);
      g.moveTo(e.x, e.y + r * 0.55);
      g.lineTo(e.x, e.y + r * 1.5);
      g.stroke();
    }
  }

  // Vor dem ersten Wurf: drei Pfeilspitzen über dem Ball zeigen die Wischrichtung.
  function drawSwipeHint() {
    const s = startPt();
    const r = ballR(s.m);
    const k = u();
    const tx = centerX() - s.x;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const f = (((time * 0.9) % 1) + i) / 3;
      const y = s.y - r * 1.7 - f * 96 * k;
      const x = s.x + tx * f * 0.45;
      const a = Math.sin(f * Math.PI);
      const sz = 13 * k * (1 - f * 0.3);
      g.globalAlpha = a;
      for (const [color, width] of [[INK, 8 * k], ['#fff', 4.5 * k]]) {
        g.strokeStyle = color;
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(x - sz, y + sz * 0.7);
        g.lineTo(x, y);
        g.lineTo(x + sz, y + sz * 0.7);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  function spriteTransform(fx, fy, k, rot, squash) {
    g.translate(fx, fy);
    g.rotate(rot);
    g.scale(k * (1 - squash * 0.6), k * (1 + squash));
    g.translate(-100, -300);
  }

  function drawFeli() {
    const s = startPt();
    const H = FELI_H * L.goal.h * s.m;
    const k = H / 300;
    const e = easeOut(throwA);
    const swing = Math.sin(Math.PI * throwA);
    const rot = 0.05 * (1 - e) - 0.07 * e - 0.1 * swing + aimDir * 0.12 * e;
    const squash = 0.012 * Math.sin(time * 3.1) + 0.05 * windup - 0.08 * swing;
    const fx = s.x - H * FELI_HAND_DX;
    const fy = L.ground - swing * 0.05 * H;
    const headRot = 0.05 * Math.sin(time * 2.7) - 0.14 * swing + aimDir * 0.1 * e;
    // Sprite-Koordinate → Bildschirm (dieselbe Abbildung wie createCharSprite.draw)
    const sp = (px, py) => {
      const lx = (px - 100) * k * (1 - squash * 0.6);
      const ly = (py - 300) * k * (1 + squash);
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      return { x: fx + lx * c - ly * sn, y: fy + lx * sn + ly * c };
    };

    // Schatten
    g.fillStyle = 'rgba(40,24,16,0.25)';
    g.beginPath();
    g.ellipse(fx, L.ground - H * 0.03, H * 0.26, H * 0.045, 0, 0, TAU);
    g.fill();

    // Ball in der Hand und Wurfarm (hinter dem Körper, damit die Schulter sauber sitzt)
    const r = ballR(s.m);
    const hold = { x: s.x, y: s.y + windup * 0.035 * H };
    const shoulder = sp(133, 186);
    const reach = 0.27 * H;
    const follow = { x: shoulder.x + reach * (0.45 + aimDir * 0.5), y: shoulder.y - reach * 0.95 };
    const handHold = { x: hold.x - r * 0.3, y: hold.y + r * 0.5 };
    const hand = { x: lerp(handHold.x, follow.x, e), y: lerp(handHold.y, follow.y, e) };
    const bend = 0.07 * H * (1 - e * 0.7);
    const elbow = { x: (shoulder.x + hand.x) / 2 + bend, y: (shoulder.y + hand.y) / 2 + bend * 0.3 };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [color, width] of [[INK, 24 * k], [SKIN, 15 * k]]) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(shoulder.x, shoulder.y);
      g.lineTo(elbow.x, elbow.y);
      g.lineTo(hand.x, hand.y);
      g.stroke();
    }

    // Körper: der hängende rechte Arm des Sprites wird weggeschnitten (er ist ja oben am Ball)
    const base = g.getTransform();
    g.save();
    spriteTransform(fx, fy, k, rot, squash);
    g.beginPath();
    g.moveTo(-100, -100);
    g.lineTo(300, -100);
    g.lineTo(300, 166);
    g.lineTo(137, 166);
    g.lineTo(143.5, 248);
    g.lineTo(300, 248);
    g.lineTo(300, 340);
    g.lineTo(-100, 340);
    g.closePath();
    g.clip();
    g.setTransform(base);
    feli.draw(g, fx, fy, H, { rot, squash, headless: true });
    g.restore();

    // Hinterkopf
    g.save();
    spriteTransform(fx, fy, k, rot, squash);
    drawBackHead(headRot);
    g.restore();

    // Ball in der Hand, die Finger liegen von hinten am Ball
    if (phase === 'aim' && throwA < 0.5) drawBall(hold.x, hold.y, r * easeOutBack(ballIn), 0.3);
    g.beginPath();
    g.arc(hand.x, hand.y, 10 * k, 0, TAU);
    g.fillStyle = SKIN;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 5 * k;
    g.stroke();
  }

  // Felis Hinterkopf in Sprite-Koordinaten (Hals bei 100/168): braune Haare, gelbe Krone.
  function drawBackHead(rot) {
    g.save();
    g.translate(100, 168);
    g.rotate(rot);
    g.translate(-100, -168);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(47, 112);
    g.bezierCurveTo(45, 64, 70, 46, 101, 46);
    g.bezierCurveTo(132, 46, 157, 64, 155, 112);
    g.bezierCurveTo(155, 136, 160, 152, 153, 172);
    g.quadraticCurveTo(140, 186, 128, 176);
    g.quadraticCurveTo(114, 188, 101, 178);
    g.quadraticCurveTo(88, 188, 74, 176);
    g.quadraticCurveTo(62, 186, 49, 172);
    g.bezierCurveTo(42, 152, 47, 136, 47, 112);
    g.closePath();
    g.fillStyle = '#7B4F35';
    g.fill();
    g.stroke();
    g.strokeStyle = '#5A3723';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(101, 76);
    g.quadraticCurveTo(97, 126, 101, 168);
    g.moveTo(77, 88);
    g.quadraticCurveTo(66, 128, 74, 166);
    g.moveTo(125, 88);
    g.quadraticCurveTo(136, 128, 128, 166);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(62, 96);
    g.quadraticCurveTo(70, 72, 92, 66);
    g.stroke();
    // Krone
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(60, 64);
    g.lineTo(54, 14);
    g.lineTo(78, 38);
    g.lineTo(101, 4);
    g.lineTo(124, 38);
    g.lineTo(148, 14);
    g.lineTo(142, 64);
    g.closePath();
    g.fillStyle = '#FFD23F';
    g.fill();
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(60, 50);
    g.lineTo(143, 50);
    g.stroke();
    g.lineWidth = 2;
    for (const x of [78, 101, 124]) {
      g.beginPath();
      g.arc(x, 57, 4, 0, TAU);
      g.fillStyle = '#E5484D';
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  // --- Start ---
  renderHud();
  audio.play('whistle');
  say('Komm nur, Spatzl!', 1.8);
  const loop = createLoop((dt) => {
    update(dt * timeScale);
    draw();
  });
  draw();

  if (ctx.debug) {
    // Für die Browser-Probe: Lage von Ball und Tor, Spielstand, Torwart steuern, Zeitlupe.
    globalThis.__game = {
      info: () => {
        const s = startPt();
        return { phase, throws: match.throws, goals: match.goals, results: [...match.results], last: lastResult, flying: flight ? flight.t : null, ball: { x: s.x, y: s.y }, goal: { ...L.goal }, w: L.w, h: L.h };
      },
      keeper: (mode) => {
        forced = mode === 'catch' || mode === 'away' ? mode : null;
      },
      speed: (s) => {
        timeScale = Number.isFinite(s) ? clamp(s, 0, 4) : 1;
      },
      victim: (kind) => {
        forcedVictim = kind === 'franks' || kind === 'pigeon' ? kind : null;
      },
    };
  }

  return {
    destroy() {
      loop.stop();
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onCancel);
      view.destroy();
      hud.remove();
      bubble.remove();
      hint.remove();
      bannerEl?.remove();
      root.classList.remove('g-handball');
      ended = true;
      if (ctx.debug) delete globalThis.__game;
    },
  };
}
