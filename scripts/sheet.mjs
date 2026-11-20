// Kontaktbogen aus Bildschirmfotos: node scripts/sheet.mjs [ordner] [proSeite] -> ordner/_bogen-N.png
import { execSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

function loadPlaywright() {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return createRequire(join(execSync('npm root -g').toString().trim(), '/'))('playwright');
  }
}
const { chromium } = loadPlaywright();
const dir = resolve(process.argv[2] || 'screenshots');
const per = Number(process.argv[3] || 21);
const files = readdirSync(dir).filter((f) => f.endsWith('.png') && !f.startsWith('_')).sort();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
for (let i = 0; i * per < files.length; i++) {
  const part = files.slice(i * per, (i + 1) * per);
  const html = `<body style="margin:0;background:#222;color:#fff;font:12px system-ui;display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:6px">${part.map((f) => `<figure style="margin:0"><img src="file://${join(dir, f)}" style="width:100%;display:block"><figcaption>${f}</figcaption></figure>`).join('')}</body>`;
  const tmp = join(dir, '_bogen.html');
  writeFileSync(tmp, html);
  await page.goto('file://' + tmp);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(dir, `_bogen-${i + 1}.png`), fullPage: true });
}
await browser.close();
console.log('Kontaktbogen in', dir);
