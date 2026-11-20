// Baut die App nach dist/: index.html, app.js, app.css, Schriften und alles aus public/.
// Alle Pfade sind relativ, damit die Seite unter /feli_geburtstagsspiel_2026/ und lokal läuft.
// Aufruf: node scripts/build.mjs [--watch]

import { build, context } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: { app: join(root, 'src/main.js') },
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  loader: { '.woff2': 'file', '.woff': 'file' },
  assetNames: 'fonts/[name]',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'warning',
};

async function writeHtml() {
  const hash = async (f) => createHash('sha1').update(await readFile(join(dist, f))).digest('hex').slice(0, 8);
  const [js, css] = await Promise.all([hash('app.js'), hash('app.css')]);
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#F07A1A">
<meta name="robots" content="noindex">
<title>Felis große Reise 👑</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="app.css?v=${css}">
</head>
<body>
<div id="app"></div>
<noscript>Bitte JavaScript einschalten.</noscript>
<script src="app.js?v=${js}"></script>
</body>
</html>
`;
  await writeFile(join(dist, 'index.html'), html);
}

async function finish() {
  await cp(join(root, 'public'), dist, { recursive: true });
  await writeHtml();
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

if (watch) {
  const ctx = await context({ ...options, plugins: [{ name: 'html', setup: (b) => b.onEnd(() => finish().catch(console.error)) }] });
  await ctx.watch();
  console.log('Beobachte src/ …');
} else {
  const t0 = Date.now();
  await build(options);
  await finish();
  console.log(`Build ${pkg.version} in ${Date.now() - t0} ms`);
}
