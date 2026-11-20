// Finale in fünf Phasen:
//   puzzle  – der Bilderrahmen setzt sich aus den gewonnenen Teilen zusammen
//   quiz    – die große Frage mit vier Antwortkarten
//   cannon  – Janni rollt die Konfettikanone herein, Lunte, 3-2-1, BOOM
//   scratch – der ganze Bildschirm ist voller Konfetti, darunter liegt der Gutschein (Rubbellos)
//   done    – ab ca. 70 % fällt der Rest von selbst, weiter zum Gutschein-Bildschirm

import { FINALE } from '../content.js';
import { wonCount } from '../core/progress.js';
import { clearedFraction, createScratchGrid, markStroke } from '../core/scratch.js';
import { charEl, headEl } from '../render/chars.js';
import { h, onTap } from './dom.js';
import { CONFETTI, burst, popWord, shake, sparkle } from './fx.js';
import { createFrameView } from './frame.js';
import { voucherEl } from './voucher.js';

const CLEAR_AT = 0.7;

const CANNON_SVG = `<svg viewBox="0 0 300 220" aria-hidden="true">
  <g class="cannon-barrel">
    <path d="M70 150 250 44q22-10 34 12t-8 36L96 196z" fill="#4a4a52" stroke="#3B2A22" stroke-width="6" stroke-linejoin="round"/>
    <path d="M232 54l28 50M196 76l28 50M112 126l28 50" stroke="#E0A91E" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="271" cy="66" rx="13" ry="28" transform="rotate(-30 271 66)" fill="#1d1d1f" stroke="#3B2A22" stroke-width="5"/>
    <path class="cannon-fuse" d="M84 150q-30-30-10-52" fill="none" stroke="#b08a5a" stroke-width="5" stroke-linecap="round"/>
  </g>
  <circle cx="110" cy="170" r="44" fill="#8a5a3c" stroke="#3B2A22" stroke-width="6"/>
  <circle cx="110" cy="170" r="12" fill="#E0A91E" stroke="#3B2A22" stroke-width="5"/>
  <path d="M110 126v88M66 170h88M79 139l62 62M141 139l-62 62" stroke="#3B2A22" stroke-width="5"/>
</svg>`;

export function mountFinale(root, app, { onDone }) {
  const { audio, assets, store } = app;
  const results = store.get().results;
  const won = wonCount(store.get());
  const view = createFrameView(app, results);
  const text = h('p.bubble-text');
  const bubble = h('div.bubble.finale-bubble', h('b.bubble-name', 'Janni'), text);
  const janni = charEl(assets, 'janni', 'anzug', { className: 'finale-janni' });
  const answers = h('div.answers');
  answers.hidden = true;
  const talk = h('div.finale-talk', janni, bubble);
  const quiz = h('div.finale-quiz', view.el, talk, answers);
  const screen = h('div.screen.finale', quiz);
  root.append(screen);

  // Puzzle so groß wie möglich: 85 % der Breite, begrenzt durch die Höhe (Chips und Janni müssen darunter passen).
  function sizeFrame() {
    const em = parseFloat(getComputedStyle(screen).fontSize) || 16;
    const r = screen.getBoundingClientRect();
    const img = assets.img('puzzle');
    const aspect = (img.naturalHeight || img.height) / (img.naturalWidth || img.width);
    const reserved = (3.1 + 0.9 + 3 * 0.5 + 4.6 + 6.9) * em; // Abstände, Chips, Janni mit Sprechblase
    const byHeight = (r.height - reserved - 1.4 * em) / aspect + 1.4 * em;
    view.el.style.setProperty('--frame-w', Math.max(9 * em, Math.min(r.width * 0.85, byHeight)) + 'px');
  }
  sizeFrame();

  let alive = true;
  let phase = 'puzzle';
  const timers = [];
  const later = (ms) => new Promise((resolve) => timers.push(setTimeout(resolve, ms))).then(() => alive);
  const size = () => screen.getBoundingClientRect();

  // --- Phase 1: Puzzle setzt sich zusammen ---
  async function assemble(fast) {
    view.layout({ exclude: -1 });
    const mine = results.map((r, i) => (r === true ? i : -1)).filter((i) => i >= 0);
    if (!fast && mine.length) {
      for (const i of mine) view.pieces[i].style.visibility = 'hidden';
      if (!(await later(350))) return;
      for (const i of mine) {
        const el = view.pieces[i];
        el.style.visibility = '';
        el.classList.add('flying');
        const a = (i * 2.4 + 1) % (Math.PI * 2);
        const from = `translate(${Math.cos(a) * 320}px, ${Math.sin(a) * 320 - 160}px) scale(1.8) rotate(${i % 2 ? 360 : -360}deg)`;
        el.animate?.([{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 750, easing: 'cubic-bezier(.3,.1,.2,1)' });
        audio.play('whoosh');
        if (!(await later(620))) return;
        el.classList.remove('flying');
        audio.play('klack');
        shake(view.box, 3, 160);
        if (!(await later(130))) return;
      }
      // Das letzte Teil sitzt: kurzer Zoom-Puls und Glitzer über das ganze Bild.
      view.box.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-in-out' });
      const br = view.inner.getBoundingClientRect();
      const sr = size();
      for (let k = 0; k < 9; k++) {
        timers.push(setTimeout(() => alive && sparkle(screen, br.left - sr.left + ((k % 3) + 0.5) * (br.width / 3), br.top - sr.top + (Math.floor(k / 3) + 0.5) * (br.height / 3), 5), k * 55));
      }
      audio.play(mine.length === 6 ? 'fanfare' : 'sparkle');
      phase = 'assembled';
      if (!(await later(1100))) return;
    }
    if (!(await later(fast ? 0 : 300))) return;
    startQuiz();
  }

  // --- Phase 2: die große Frage ---
  function say(msg) {
    text.textContent = msg;
    janni.classList.add('talking');
    timers.push(setTimeout(() => janni.classList.remove('talking'), 1100));
  }

  function startQuiz() {
    phase = 'quiz';
    say(FINALE.question(won));
    answers.hidden = false;
    const order = FINALE.answers.map((a) => ({ a, k: Math.random() })).sort((x, y) => x.k - y.k).map((x) => x.a);
    answers.replaceChildren();
    for (const a of order) {
      const card = h('button.answer', a.text);
      onTap(card, () => choose(a, card));
      answers.append(card);
    }
    // Platz für die Antwortkarten schaffen: Das Puzzle schrumpft weich nach oben.
    // Nur der Rahmen schrumpft, die Hinweis-Chips bleiben lesbar.
    const fh = view.box.offsetHeight;
    const overflow = quiz.scrollHeight - quiz.clientHeight;
    if (overflow > 0 && fh > 0) {
      const scale = Math.max(0.35, (fh - overflow - 4) / fh);
      view.box.style.transform = `scale(${scale})`;
      view.box.style.marginBottom = -(fh * (1 - scale)) + 'px';
    }
  }

  let chosen = false;
  async function choose(a, card) {
    if (chosen || card.classList.contains('gone')) return;
    const r = size();
    if (!a.correct) {
      audio.play('crumple');
      card.classList.add('gone');
      say(a.react && a.react !== FINALE.wrong ? `${FINALE.wrong} ${a.react}` : FINALE.wrong);
      if (/Kater/.test(a.text)) shockedCats();
      return;
    }
    chosen = true;
    audio.play('fanfare');
    card.classList.add('right');
    say(FINALE.right);
    popWord(screen, FINALE.right, r.width / 2, r.height * 0.36, { size: 4, life: 1700, color: '#FFD23F' });
    burst(screen, r.width / 2, r.height * 0.4, { count: 70, spread: 280 });
    shake(screen, 6, 400);
    if (!(await later(1900))) return;
    startCannon();
  }

  function shockedCats() {
    audio.play('hiss');
    const cats = h('div.finale-cats', headEl(assets, 'franks'), headEl(assets, 'findi'));
    screen.append(cats);
    const r = size();
    popWord(screen, 'WAS?!', r.width * 0.5, r.height * 0.74, { size: 2.6, color: '#E5484D', life: 1300 });
    timers.push(setTimeout(() => cats.remove(), 1900));
  }

  // --- Phase 3: Konfettikanone ---
  async function startCannon() {
    phase = 'cannon';
    audio.setMood(null);
    quiz.classList.add('leaving');
    const cannon = h('div.cannon', { html: CANNON_SVG });
    const spark = h('div.cannon-spark', '✹');
    cannon.append(spark);
    const gunner = charEl(assets, 'janni', 'kanone', { className: 'cannon-janni' });
    const label = h('div.cannon-label', FINALE.cannon);
    const scene = h('div.cannon-scene', label, gunner, cannon);
    screen.append(scene);
    audio.play('whoosh');
    if (!(await later(1500))) return;
    audio.play('fuse');
    scene.classList.add('lit');
    const r = size();
    for (const n of ['3', '2', '1']) {
      audio.play('count');
      popWord(screen, n, r.width / 2, r.height * 0.43, { size: 7, life: 800, color: '#FFD23F', rot: 0 });
      shake(cannon, 3 + (4 - Number(n)) * 3, 500);
      if (!(await later(850))) return;
    }
    boom(scene);
  }

  // --- Phase 4: BOOM und Rubbel-Konfetti ---
  function boom(scene) {
    phase = 'scratch';
    const r = size();
    audio.play('boom');
    timers.push(setTimeout(() => alive && audio.setMood('party'), 900));
    const ticket = h('div.voucher-scroll.finale-voucher', voucherEl());
    const canvas = h('canvas.scratch');
    const wipe = h('div.scratch-hint', FINALE.wipe);
    const flash = h('div.finale-flash');
    quiz.remove();
    scene.remove();
    screen.classList.add('boomed');
    screen.append(ticket, canvas, wipe, flash);
    popWord(screen, FINALE.boom, r.width / 2, r.height * 0.4, { size: 6, life: 1400, color: '#fff', rot: -10 });
    shake(screen, 16, 650);
    burst(screen, r.width * 0.5, r.height * 0.55, { count: 60, spread: 420, glyphs: ['👑', '🐾', '🎉', '✨'], size: 14, life: 1500 });
    timers.push(setTimeout(() => flash.remove(), 500));
    timers.push(setTimeout(() => canvas.classList.add('shot'), 50));

    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const W = Math.round(r.width);
    const H = Math.round(r.height);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    paintConfetti(g, W, H);

    const grid = createScratchGrid();
    const brush = Math.max(26, W * 0.085);
    let last = null;
    let finished = false;
    const pos = (e) => {
      const b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const stroke = (a, b) => {
      g.globalCompositeOperation = 'destination-out';
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = brush * 2;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x + 0.01, b.y + 0.01);
      g.stroke();
      markStroke(grid, a.x / W, a.y / H, b.x / W, b.y / H, brush / W, H / W);
      if (!finished && clearedFraction(grid) >= CLEAR_AT) finish();
    };
    const down = (e) => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      last = pos(e);
      stroke(last, last);
      wipe.classList.add('fade');
    };
    const move = (e) => {
      if (!last) return;
      e.preventDefault();
      const p = pos(e);
      stroke(last, p);
      if (Math.random() < 0.25) audio.play('type');
      last = p;
    };
    const up = () => {
      last = null;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    async function finish() {
      finished = true;
      phase = 'done';
      audio.play('win');
      canvas.classList.add('fall');
      wipe.remove();
      burst(screen, W / 2, H * 0.3, { count: 50, spread: 300 });
      if (!(await later(1200))) return;
      onDone();
    }
    hooks.finishScratch = () => !finished && finish();
  }

  // Dichtes Konfetti ohne Lücken: orange, gold, weiß, dazu Mini-Kronen und Katzenpfoten.
  function paintConfetti(g, W, H) {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#F9A03F');
    gr.addColorStop(0.5, '#F07A1A');
    gr.addColorStop(1, '#E0A91E');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const colors = ['#F07A1A', '#FFD23F', '#FFFFFF', '#FFB35C', '#E0A91E', '#FFF4E2', CONFETTI[3]];
    const n = Math.round((W * H) / 150);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const s = 7 + Math.random() * 9;
      g.save();
      g.translate(x, y);
      g.rotate(Math.random() * Math.PI);
      g.fillStyle = colors[i % (i % 23 === 0 ? 7 : 6)];
      g.strokeStyle = 'rgba(59,42,34,.28)';
      g.lineWidth = 1;
      if (i % 5 === 0) {
        g.beginPath();
        g.arc(0, 0, s * 0.42, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else {
        g.fillRect(-s / 2, -s / 4, s, s / 2);
        g.strokeRect(-s / 2, -s / 4, s, s / 2);
      }
      g.restore();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < 26; i++) {
      g.save();
      g.translate(Math.random() * W, Math.random() * H);
      g.rotate((Math.random() - 0.5) * 1.2);
      g.font = `${20 + Math.random() * 16}px serif`;
      g.fillText(i % 2 ? '👑' : '🐾', 0, 0);
      g.restore();
    }
  }

  // Debug: Phasen überspringen (für den Rauchtest).
  const hooks = {
    phase: () => phase,
    skipTo(target) {
      if (target === 'quiz' && phase === 'puzzle') {
        timers.splice(0).forEach(clearTimeout);
        view.layout();
        for (const el of view.pieces) if (el) el.style.visibility = '';
        startQuiz();
      }
    },
    finishScratch: () => {},
  };
  if (app.debug) globalThis.__feliFinale = hooks;

  text.textContent = FINALE.lead;
  assemble(false);

  return {
    destroy() {
      alive = false;
      timers.forEach(clearTimeout);
      if (globalThis.__feliFinale === hooks) delete globalThis.__feliFinale;
      screen.remove();
    },
  };
}
