// Gemeinsame Helfer für Browser-Tests: Playwright laden, dist/ unter dem Pages-Unterpfad ausliefern.
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASE = '/feli_geburtstagsspiel_2026/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };

export function loadPlaywright() {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return createRequire(join(execSync('npm root -g').toString().trim(), '/'))('playwright');
  }
}

// Server unter demselben Unterpfad wie GitHub Pages, damit falsche absolute Pfade auffallen.
export function startServer(dist = join(projectRoot, 'dist')) {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!url.startsWith(BASE)) {
      res.writeHead(404);
      return res.end();
    }
    const path = join(dist, url.slice(BASE.length).replace(/^$|\/$/, 'index.html'));
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  }).listen(0);
  return { server, origin: `http://127.0.0.1:${server.address().port}${BASE}` };
}

// Öffnet die App auf Handy-Größe. query z. B. '?debug=1&go=game:3'.
// Rückgabe: { page, origin, errors, shot(name), close() }
export async function openApp({ query = '?debug=1', shots = process.env.SCREENSHOTS || join(projectRoot, 'screenshots'), viewport = { width: 390, height: 844 } } = {}) {
  const { chromium } = loadPlaywright();
  await mkdir(shots, { recursive: true });
  const { server, origin } = startServer();
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/k1_berlin/.test(m.location().url) && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && !/k1_berlin/.test(r.url()) && errors.push(`HTTP ${r.status()}: ${r.url()}`));
  await page.goto(origin + query);
  let n = 0;
  return {
    page,
    origin,
    errors,
    shots,
    async shot(name) {
      await page.waitForTimeout(350);
      await page.screenshot({ path: join(shots, `${String(++n).padStart(2, '0')}-${name}.png`) });
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
}
