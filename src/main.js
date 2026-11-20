// Programmsteuerung: lädt Stand und Bilder, zeigt die Bildschirme in der Reihenfolge aus flow.js
// und speichert den Fortschritt. Die einzelnen Bildschirme liegen in ui/, die Spiele in games/.

import '@fontsource/luckiest-guy/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import './ui/styles.css';

import { HEAD_KEYS, FILES, createAssets } from './assets.js';
import { createAudio } from './audio/audio.js';
import { CHAPTERS, PROLOG, RESET, RESUME, ROTATE } from './content.js';
import { createProgressStore, recordResult } from './core/progress.js';
import { STEPS, nextStep, parseStep, prevStep, resumeStep } from './flow.js';
import { mountCard } from './ui/card.js';
import { mountDebug } from './ui/debug.js';
import { h, onTap } from './ui/dom.js';
import { mountFinale } from './ui/finale.js';
import { mountFrame } from './ui/frame.js';
import { mountGame } from './ui/gamehost.js';
import { mountHall } from './ui/hall.js';
import { mountStory } from './ui/story.js';
import { mountTrailer } from './ui/trailer.js';
import { mountVoucher } from './ui/voucher.js';

const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1';

const stage = h('div.stage');
const layer = h('div.layer');
const mute = h('button.mute', { 'aria-label': 'Ton an/aus' });
const resetBtn = h('button.reset', { 'aria-label': 'Von vorn beginnen' }, '↺');
stage.append(layer, mute, resetBtn, h('div.rotate', h('span', '📱'), ROTATE));
document.getElementById('app').append(stage);

const store = createProgressStore();
const audio = createAudio();
const assets = createAssets();
const app = { stage, audio, assets, store, debug };

// Alle Maße in der App hängen an der Schriftgröße der Bühne: 16px bei 390px Breite.
const fit = () => {
  const r = stage.getBoundingClientRect();
  const u = Math.min(r.width / 390, r.height / 760);
  stage.style.fontSize = Math.max(11, 16 * u) + 'px';
};
new ResizeObserver(fit).observe(stage);
fit();

// --- Ton ---
audio.setMuted(store.get().muted);
const paintMute = () => {
  mute.textContent = audio.muted ? '🔇' : '🔊';
};
paintMute();
onTap(mute, () => {
  audio.setMuted(!audio.muted);
  store.update((p) => {
    p.muted = audio.muted;
  });
  paintMute();
  audio.play('tap');
});
// Browser geben den Ton erst nach einer echten Nutzergeste frei (je nach Gerät pointerup, touchend oder click).
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click']) window.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.resume()));

// Kein Pinch-Zoom der Seite, kein Kontextmenü bei langem Druck. Den Doppeltipp-Zoom schaltet
// touch-action: manipulation im CSS ab (ein eigener Tipp-Filter würde schnelles Tippen verschlucken).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
// --- Ablauf ---
let screen = null;
let current = 'card';
let replay = false; // "Intro nochmal ansehen" aus dem Spielesaal
let debugPanel = null;

function mount(fn, props) {
  try {
    screen?.destroy?.();
  } catch (err) {
    console.error(err);
  }
  layer.replaceChildren();
  screen = fn(layer, app, props);
}

const firstRun = () => !store.get().firstRunDone && !replay;

function go(step, opts = {}) {
  if (!STEPS.includes(step)) step = 'card';
  current = step;
  debugPanel?.setStep(step);
  if (firstRun() && step !== 'hall') store.update((p) => { p.step = step; });
  const { kind, chapter } = parseStep(step);
  const next = () => go(nextStep(step));
  stage.dataset.step = step;

  // Hintergrundmusik je Bildschirm; Karte, Trailer und Spiele steuern sie selbst.
  const MOOD = { prolog: 'calm', story: 'calm', frame: 'calm', finale: 'tense', voucher: 'party' };
  if (MOOD[kind]) audio.setMood(MOOD[kind]);
  if (kind === 'card') return mount(mountCard, { onDone: next });
  if (kind === 'trailer') return mount(mountTrailer, { onDone: next });
  if (kind === 'prolog') {
    return mount(mountStory, { ...PROLOG, title: 'Prolog', onDone: () => (replay ? go('hall') : next()) });
  }
  if (kind === 'story') {
    const ch = CHAPTERS[chapter];
    preload(chapter + 1);
    if (!ch.intro.length) return go(`game:${chapter}`);
    return mount(mountStory, { bg: ch.bg, lines: ch.intro, cast: ch.cast, outfits: ch.outfits, title: ch.title, kicker: `Kapitel ${chapter + 1}`, onDone: next });
  }
  if (kind === 'game') {
    return mount(mountGame, {
      chapter,
      onEnd(won) {
        store.update((p) => {
          recordResult(p, chapter, won);
          p.step = `frame:${chapter}`;
        });
        go(`frame:${chapter}`, { fresh: true });
      },
    });
  }
  if (kind === 'frame') {
    const won = store.get().results[chapter] === true;
    return mount(mountFrame, { chapter, outcome: won ? 'won' : 'lost', animate: opts.fresh !== false, onNext: next });
  }
  if (kind === 'finale') return mount(mountFinale, { onDone: next });
  if (kind === 'voucher') return mount(mountVoucher, { onDone: next });
  return hall();
}

function hall() {
  replay = false;
  audio.setMood('calm');
  current = 'hall';
  stage.dataset.step = 'hall';
  debugPanel?.setStep('hall');
  if (!store.get().firstRunDone) store.update((p) => { p.firstRunDone = true; p.step = 'hall'; });
  mount(mountHall, {
    onPlay: playFromHall,
    onVoucher: () => {
      audio.setMood('party');
      mount(mountVoucher, { onDone: hall });
    },
    onIntro() {
      replay = true;
      go('card');
    },
  });
}

function playFromHall(chapter) {
  current = `game:${chapter}`;
  stage.dataset.step = current;
  debugPanel?.setStep(current);
  mount(mountGame, {
    chapter,
    onEnd(won) {
      const had = store.get().results[chapter] === true;
      store.update((p) => recordResult(p, chapter, won));
      const outcome = won ? (had ? 'again' : 'won') : 'miss';
      audio.setMood('calm');
      mount(mountFrame, { chapter, outcome, mode: 'hall', onNext: hall, onAgain: () => playFromHall(chapter) });
    },
  });
}

// Bilder des nächsten Kapitels schon im Hintergrund holen.
function preload(chapter) {
  const ch = CHAPTERS[chapter];
  const keys = ch ? [ch.bg] : ['puzzle'];
  assets.load(keys);
}

// --- Von vorn beginnen (Knopf oben links, mit Rückfrage) ---
function startOver() {
  store.reset();
  replay = false;
  audio.setMood(null);
  go('card');
}
onTap(resetBtn, () => {
  audio.play('tap');
  if (stage.querySelector('.confirm')) return;
  const yes = h('button.btn', RESET.yes);
  const no = h('button.btn.ghost', RESET.no);
  const box = h('div.confirm', h('div.confirm-card', h('h2', RESET.title), h('p', RESET.text), h('div.confirm-actions', no, yes)));
  stage.append(box);
  onTap(no, () => {
    audio.play('tap');
    box.remove();
  });
  onTap(yes, () => {
    audio.play('tap');
    box.remove();
    startOver();
  });
});

// --- Debug ---
const api = {
  step: () => current,
  progress: () => store.get(),
  mood: () => audio.mood,
  go: (step) => go(step, { fresh: true }),
  next: () => go(nextStep(current)),
  prev: () => go(prevStep(current)),
  win: () => screen?.forceEnd?.(true),
  lose: () => screen?.forceEnd?.(false),
  reset: startOver,
};
if (debug) {
  debugPanel = mountDebug(stage, api);
  globalThis.__feli = api;
}

// --- Start ---
(async () => {
  stage.classList.add('loading');
  await Promise.race([Promise.all([assets.loadManifest(), assets.load([...HEAD_KEYS, 'bg:card', 'puzzle'])]), new Promise((r) => setTimeout(r, 10000))]);
  stage.classList.remove('loading');
  const wanted = debug && params.get('go');
  const step = wanted && STEPS.includes(wanted) ? wanted : resumeStep(store.get());
  const begin = () => {
    if (step === 'hall') hall();
    else go(step, { fresh: step === wanted });
  };
  // Die Karte ist selbst der erste Tipp. Bei jedem anderen Einstieg (Neuladen, Spielesaal) fragt ein
  // Start-Bildschirm nach einem Tipp: Erst dann darf der Browser Ton und Musik abspielen.
  // Debug-Sprünge (?debug=1&go=…) starten direkt, dort entsperrt der erste Tipp im Bildschirm den Ton.
  if (step === 'card' || step === wanted) begin();
  else {
    const splash = h('button.splash', h('span.splash-crown', '👑'), h('b', RESUME.title), h('span.splash-tap', RESUME.tap));
    stage.append(splash);
    onTap(splash, () => {
      audio.unlock();
      audio.play('tap');
      splash.remove();
      begin();
    });
  }
  // Rest in Ruhe nachladen, damit spätere Kapitel ohne Wartezeit starten.
  for (const key of Object.keys(FILES)) await assets.load([key]);
})();
