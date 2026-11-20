// Bereitet die gelieferten Grafiken aus public/assets/ fürs Handy auf und legt das Ergebnis in public/opt/ ab:
//   - Köpfe: weiche Ränder und Schattenreste entfernen, dunkle Comic-Kontur, etwas kräftigere Farben, WebP
//   - Hintergründe und Puzzlebild: WebP in passender Größe (lädt um ein Vielfaches schneller)
// Aufruf nach jedem Update von public/assets/:  node scripts/optimize-assets.mjs
// Braucht Playwright mit Chromium (lokal vorhanden, nicht im CI: das Ergebnis wird eingecheckt).
/* global document, Image */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadPlaywright, projectRoot, startServer } from './lib.mjs';

export const HEAD_PAD = 0.05; // Rand um den Kopf für die Kontur (Anteil der Bildgröße), siehe src/assets.js
const HEAD_SIZE = 400;
const OUTLINE = 7; // Konturbreite in Pixeln bei 512px Vorlage

const JOBS = [
  // smooth: Glättung des Umrisses in Pixeln (Kater höher, damit einzelne Schnurrhaare keine Zacken bilden)
  ...[['feli', 2.4], ['janni', 2.4], ['franks', 5], ['findi', 7]].map(([n, smooth]) => ({ kind: 'head', src: `assets/chars/${n}_head.png`, out: `opt/chars/${n}_head.webp`, smooth })),
  { kind: 'photo', src: 'assets/bg/card.jpg', out: 'opt/bg/card.webp', maxW: 1080, q: 0.8 },
  { kind: 'photo', src: 'assets/bg/k1_berlin.jpg', out: 'opt/bg/k1_berlin.webp', maxW: 1080, q: 0.8 },
  { kind: 'photo', src: 'assets/bg/k2_ice.jpg', out: 'opt/bg/k2_ice.webp', maxW: 1080, q: 0.8 },
  { kind: 'photo', src: 'assets/bg/k3_hamburg_wimmel.jpg', out: 'opt/bg/k3_hamburg_wimmel.webp', maxW: 2496, q: 0.8 },
  { kind: 'photo', src: 'assets/bg/k4_zug_abend.jpg', out: 'opt/bg/k4_zug_abend.webp', maxW: 1080, q: 0.8 },
  { kind: 'photo', src: 'assets/bg/k5_halle.jpg', out: 'opt/bg/k5_halle.webp', maxW: 1080, q: 0.8 },
  { kind: 'photo', src: 'assets/bg/k6_buehne.jpg', out: 'opt/bg/k6_buehne.webp', maxW: 1080, q: 0.8 },
  { kind: 'photo', src: 'assets/puzzle/puzzle_final.jpg', out: 'opt/puzzle/puzzle_final.webp', maxW: 1200, q: 0.84 },
];

// Läuft im Browser: liefert eine Daten-URL.
async function processInPage({ kind, url, maxW, q, pad, size, outline, smooth }) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d', { willReadFrequently: true })];
  };
  if (kind === 'photo') {
    const k = Math.min(1, maxW / img.naturalWidth);
    const [c, g] = mk(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', q);
  }
  // --- Kopf ---
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const [, sg] = mk(W, H);
  sg.drawImage(img, 0, 0);
  const px = sg.getImageData(0, 0, W, H);
  const d = px.data;
  // 1. harte Maske aus dem Alphakanal, nur die größte zusammenhängende Fläche behalten
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = d[i * 4 + 3] > 150 ? 1 : 0;
  const label = new Int32Array(W * H);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  const stack = [];
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || label[i]) continue;
    next++;
    let n = 0;
    stack.push(i);
    label[i] = next;
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % W;
      for (const o of [p - 1, p + 1, p - W, p + W]) {
        if (o < 0 || o >= W * H || label[o] || !mask[o]) continue;
        if ((o === p - 1 && x === 0) || (o === p + 1 && x === W - 1)) continue;
        label[o] = next;
        stack.push(o);
      }
    }
    if (n > bestSize) {
      bestSize = n;
      best = next;
    }
  }
  const [mc, mg] = mk(W, H);
  const mpx = mg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const on = label[i] === best;
    mpx.data[i * 4] = mpx.data[i * 4 + 1] = mpx.data[i * 4 + 2] = 255;
    mpx.data[i * 4 + 3] = on ? 255 : 0;
  }
  mg.putImageData(mpx, 0, 0);
  // Maske weichzeichnen und neu schwellen: level > 0.5 schrumpft (Saum weg), < 0.5 wächst (Kontur)
  const grow = (radius, level, soft) => {
    const [c, g] = mk(W, H);
    g.filter = `blur(${radius}px)`;
    g.drawImage(mc, 0, 0);
    g.filter = 'none';
    const p = g.getImageData(0, 0, W, H);
    for (let i = 3; i < p.data.length; i += 4) {
      const a = p.data[i] / 255;
      p.data[i] = Math.max(0, Math.min(1, (a - level) / soft + 0.5)) * 255;
    }
    g.putImageData(p, 0, 0);
    return c;
  };
  const inner = grow(smooth, 0.58, 0.1); // geglättet und leicht geschrumpft: der helle Saum verschwindet
  // Kontur folgt dem geglätteten Umriss: geglättete Maske als neue Grundlage, dann wachsen lassen
  mg.clearRect(0, 0, W, H);
  mg.drawImage(inner, 0, 0);
  const outer = grow(outline * 0.9, 0.2, 0.06);
  // 2. Foto mit sauberer Maske
  const [fc, fg] = mk(W, H);
  fg.filter = 'contrast(1.07) saturate(1.14)';
  fg.drawImage(img, 0, 0);
  fg.filter = 'none';
  // Farbe an teiltransparenten Rändern auffüllen, damit kein grauer Rand entsteht
  fg.globalCompositeOperation = 'destination-in';
  fg.drawImage(inner, 0, 0);
  fg.globalCompositeOperation = 'source-over';
  // 3. Kontur dahinter
  const [oc, og] = mk(W, H);
  og.drawImage(outer, 0, 0);
  og.globalCompositeOperation = 'source-in';
  og.fillStyle = '#3B2A22';
  og.fillRect(0, 0, W, H);
  // 4. zusammensetzen, mit Rand, in Zielgröße
  const [out, g] = mk(size, size);
  g.imageSmoothingQuality = 'high';
  const inset = size * pad;
  const box = size - inset * 2;
  g.drawImage(oc, inset, inset, box, box);
  g.drawImage(fc, inset, inset, box, box);
  return out.toDataURL('image/webp', 0.9);
}

const { chromium } = loadPlaywright();
const { server, origin } = startServer(join(projectRoot, 'public'));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(origin + 'manifest.webmanifest');
let before = 0;
let after = 0;
for (const job of JOBS) {
  const dataUrl = await page.evaluate(processInPage, { ...job, url: origin + job.src, pad: HEAD_PAD, size: HEAD_SIZE, outline: OUTLINE });
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const target = join(projectRoot, 'public', job.out);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buf);
  const orig = (await stat(join(projectRoot, 'public', job.src))).size;
  before += orig;
  after += buf.length;
  console.log(`${job.out.padEnd(36)} ${(orig / 1024).toFixed(0).padStart(5)} KB → ${(buf.length / 1024).toFixed(0).padStart(4)} KB`);
}
console.log(`Summe: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
await browser.close();
server.close();
