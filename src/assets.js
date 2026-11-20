// Bilder laden mit Platzhalter: Fehlt eine Datei unter public/assets/, zeichnet der Code
// einen farbigen Kreis mit Initiale (Köpfe) oder einen Verlauf (Hintergründe).

const BASE = 'assets/';

export const FILES = Object.freeze({
  'head:feli': 'chars/feli_head.png',
  'head:janni': 'chars/janni_head.png',
  'head:franks': 'chars/franks_head.png',
  'head:findi': 'chars/findi_head.png',
  'bg:card': 'bg/card.jpg',
  'bg:k1': 'bg/k1_berlin.jpg',
  'bg:k2': 'bg/k2_ice.jpg',
  'bg:k3': 'bg/k3_hamburg_wimmel.jpg',
  'bg:k4': 'bg/k4_zug_abend.jpg',
  'bg:k5': 'bg/k5_halle.jpg',
  'bg:k6': 'bg/k6_buehne.jpg',
  puzzle: 'puzzle/puzzle_final.jpg',
});

// Halsansatz relativ zur Bildgröße (aus public/assets/manifest.json, dort zur Laufzeit überschreibbar).
const NECK = { feli: [0.47, 0.98], janni: [0.5, 0.98], franks: [0.5, 0.95], findi: [0.5, 0.95] };

const HEAD_STYLE = {
  feli: { fill: '#F4C9A6', hair: '#8A5A3C', letter: 'F', crown: true },
  janni: { fill: '#F4C9A6', hair: '#3B2A22', letter: 'J' },
  franks: { fill: '#E8702A', hair: '#E8702A', letter: '', cat: true },
  findi: { fill: '#8E8E93', hair: '#6d6d73', letter: '', cat: true },
};

const BG_STYLE = {
  'bg:card': ['#FFE2B8', '#F07A1A'],
  'bg:k1': ['#F6C56B', '#C8642A'],
  'bg:k2': ['#DCEBF5', '#8FA9BC'],
  'bg:k3': ['#C9D8C0', '#7C9A86'],
  'bg:k4': ['#F7A65A', '#5B3A6E'],
  'bg:k5': ['#C9DDE8', '#E0B070'],
  'bg:k6': ['#5a2d6e', '#1b1024'],
  puzzle: ['#7CC4F0', '#F07A1A'],
};

function placeholder(key) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  if (key.startsWith('head:')) {
    const s = HEAD_STYLE[key.slice(5)];
    c.width = c.height = 256;
    g.lineWidth = 8;
    g.strokeStyle = '#3B2A22';
    g.lineJoin = 'round';
    if (s.cat) {
      g.fillStyle = s.fill;
      for (const dx of [-1, 1]) {
        g.beginPath();
        g.moveTo(128 + dx * 96, 130);
        g.lineTo(128 + dx * 88, 34);
        g.lineTo(128 + dx * 26, 76);
        g.closePath();
        g.fill();
        g.stroke();
      }
    }
    g.fillStyle = s.fill;
    g.beginPath();
    g.arc(128, 150, s.cat ? 92 : 96, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (s.cat) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(128, 190, 46, 36, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3B2A22';
      for (const dx of [-1, 1]) {
        g.beginPath();
        g.arc(128 + dx * 36, 140, 11, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#D4456A';
      g.beginPath();
      g.moveTo(116, 172);
      g.lineTo(140, 172);
      g.lineTo(128, 186);
      g.fill();
    } else {
      g.fillStyle = s.hair;
      g.beginPath();
      g.arc(128, 136, 96, Math.PI * 1.05, Math.PI * 1.95);
      g.quadraticCurveTo(128, 96, 36, 122);
      g.fill();
      g.fillStyle = '#3B2A22';
      g.font = '700 90px Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText(s.letter, 128, 208);
    }
    if (s.crown) {
      g.fillStyle = '#FFD23F';
      g.beginPath();
      g.moveTo(58, 84);
      for (const [x, y] of [[50, 14], [92, 50], [128, 6], [164, 50], [206, 14], [198, 84]]) g.lineTo(x, y);
      g.closePath();
      g.fill();
      g.stroke();
    }
  } else {
    const [a, b] = BG_STYLE[key] ?? ['#FFF4E2', '#F07A1A'];
    c.width = 270;
    c.height = key === 'puzzle' ? 382 : 480;
    const gr = g.createLinearGradient(0, 0, 0, c.height);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.arc((i * 97) % c.width, (i * 53) % c.height, 8 + ((i * 7) % 22), 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

export function createAssets() {
  const state = new Map(); // key -> { img, ok, promise, fallback }
  const neck = structuredClone(NECK);

  function entry(key) {
    let e = state.get(key);
    if (e) return e;
    e = { img: null, ok: false, done: false, fallback: null, promise: null };
    e.promise = new Promise((resolve) => {
      if (!FILES[key]) return resolve();
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        e.img = img;
        e.ok = true;
        e.done = true;
        resolve();
      };
      img.onerror = () => {
        e.done = true;
        resolve();
      };
      img.src = BASE + FILES[key];
    });
    state.set(key, e);
    return e;
  }

  const fallback = (key) => {
    const e = entry(key);
    e.fallback ??= placeholder(key);
    return e.fallback;
  };

  return {
    // Lädt die Bilder (bricht nie ab, fehlende werden zu Platzhaltern).
    load: (keys) => Promise.all(keys.map((k) => entry(k).promise)).then(() => {}),
    // Fertiges Bild für Canvas-Zeichnung: HTMLImageElement oder Platzhalter-Canvas.
    img(key) {
      const e = entry(key);
      return e.ok ? e.img : fallback(key);
    },
    // URL für <img>/CSS/SVG: echte Datei, sonst Platzhalter als Daten-URL.
    url(key) {
      const e = entry(key);
      if (e.ok || !e.done) return BASE + FILES[key];
      return fallback(key).toDataURL();
    },
    ok: (key) => entry(key).ok,
    neck: (who) => neck[who] ?? [0.5, 0.97],
    // Kopf-Anker aus manifest.json nachladen (optional, Fehler werden ignoriert).
    async loadManifest() {
      try {
        const res = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
        const data = await res.json();
        for (const [who, def] of Object.entries(data.chars ?? {})) {
          if (Array.isArray(def.neck) && def.neck.length === 2 && def.neck.every(Number.isFinite)) neck[who] = def.neck;
        }
      } catch {
        // Standardwerte bleiben
      }
    },
  };
}

export const HEAD_KEYS = ['head:feli', 'head:janni', 'head:franks', 'head:findi'];
