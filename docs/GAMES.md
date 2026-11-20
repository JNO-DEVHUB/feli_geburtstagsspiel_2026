# Minispiele bauen – Leitfaden

Jedes Minispiel ist ein eigenes Modul unter `src/games/<id>/`. Die App drumherum (Story, Regel-Karte,
Bilderrahmen, Speicher, Debug) ist fertig und ruft das Spiel nur über den folgenden Vertrag auf.

## Dateien (nur diese anfassen)

| Datei | Inhalt |
| --- | --- |
| `src/games/<id>/logic.js` | reine Spiellogik ohne DOM und ohne `Math.random` im Modul-Scope; alle Stellschrauben als benannte Konstanten oben |
| `src/games/<id>/game.js` | Darstellung und Eingabe; exportiert `createGame(ctx)` |
| `src/games/<id>/style.css` | Stile, alle Selektoren mit `.g-<id>` beginnen lassen |
| `test/<id>.test.js` | Unit-Tests der Logik mit `node:test` |
| `scripts/games/<id>.mjs` | Browser-Probe mit Playwright (siehe unten) |

Alles andere (`src/ui`, `src/games/kit.js`, `src/main.js`, `src/content.js`, Audio …) ist gemeinsamer Code.
Fehlt dort etwas, nicht selbst ändern, sondern im Abschlussbericht nennen.

## Vertrag

```js
// src/games/<id>/game.js
export function createGame(ctx) { … return { destroy() { … } }; }
```

- `ctx.root`: HTMLElement, füllt die ganze Bühne (`position: relative`, `touch-action: none`). Das Kapitel-Hintergrundbild
  liegt schon dahinter. Oben rechts 3em × 3em frei lassen (Stumm-Schalter der App).
- `ctx.audio.play(name)`: Soundeffekte, Namen siehe `src/audio/audio.js` (`ping`, `no`, `bonk`, `mampf`, `win`, `lose`, …).
- `ctx.assets.img(key)` fürs Canvas, `ctx.assets.url(key)` für `<img>`/CSS. Schlüssel: `head:feli`, `head:janni`,
  `head:franks`, `head:findi`, `bg:k1` … `bg:k6`, `puzzle`. Fehlt eine Datei, kommt automatisch ein Platzhalter.
- `ctx.rng`: Zufall mit Seed (`next()`, `range(a,b)`, `int(a,b)`, `pick(liste)`, `chance(p)`). Nur diesen benutzen, damit Tests reproduzierbar sind.
- `ctx.debug`: `true` bei `?debug=1`. Dann darf das Spiel `globalThis.__game = { … }` für die Browser-Probe setzen.
- `ctx.end(won)`: **genau einmal** aufrufen, nach der eigenen Sieg-/Niederlage-Animation (ca. 1,2–1,8 s nach Spielende).
  Danach zeigt die App den Bilderrahmen.
- `destroy()`: alle Timer, Schleifen und Listener entfernen. Kann jederzeit kommen (Debug-Sprung).

Die Regel-Karte mit „Start“ zeigt die App selbst (Texte in `src/content.js` → `CHAPTERS[n].howto`). `createGame` wird
erst nach dem Tipp auf „Start“ aufgerufen: Das Spiel beginnt also sofort.

## Werkzeugkasten `src/games/kit.js`

`createLoop(fn)` (Spielschleife, pausiert bei verborgener Seite), `fitCanvas(root)` (Canvas in CSS-Pixeln),
`pointerPos(e, el)`, `createHud(root)` (Herzen, Text, Balken), `banner(root, text, 'win'|'lose')`,
`popWord(root, text, x, y)` (Comic-Wort), `burst(root, x, y)` (Konfetti), `sparkle`, `shake`,
`charEl(assets, who, outfit)` / `headEl(assets, who)` (DOM-Figuren), `createCharSprite(assets, who, outfit)` (Canvas-Figur mit Wackelkopf),
`h(spec, props, ...kinder)`, `wait(ms)`, `onTap(el, fn)`.

Figuren: `feli` (Outfits `braut`, `trikot`, `show`), `janni` (`anzug`, `torwart`, `kanone`), `franks`, `findi`.

## Aussehen

- Warmer Wimmelbild-Comic: kräftige Farben, dicke dunkle Konturen, harte Schlagschatten, viel Humor.
- Farben als CSS-Variablen: `--orange #F07A1A`, `--cream #FFF4E2`, `--ink #3B2A22`, `--sky #7CC4F0`, `--gold #FFD23F`,
  `--red #E5484D`, `--purple #8E5BD0`, `--green #3F9B5A`. Schriften: `var(--display)` (Luckiest Guy, nur Großes) und `var(--body)` (Nunito).
- **Alle Maße in `em`.** Die Bühne setzt ihre Schriftgröße passend zur Breite (16px bei 390px). Im Canvas statt fester
  Pixel mit `view.w`/`view.h` rechnen. Die Bühne ist 360×640 bis 430×932 groß, Referenz 390×844.
- Sprache: Deutsch, Duzen. Anrede für Feli: „Spatzl“ (nie „Königin“). Kein Text darf „Köln“, „Comedy“ oder „Chris Tall“ nennen.
- Nur Touch (Pointer Events). Tippziele mindestens 2.6em groß.
- Keine externen Bibliotheken, keine Netzwerkzugriffe, keine fremde Musik.

## Schwierigkeit

Beim ersten Durchlauf hat Feli **genau einen Versuch**. Jedes Spiel soll für eine Gelegenheitsspielerin beim ersten
Mal zu **etwa 80 %** schaffbar sein: lieber etwas zu leicht als frustrierend. Die Stellschrauben stehen als Konstanten
in `logic.js`, und ein Test belegt die Abstimmung (z. B. simulierte Spielerin über viele Seeds).

## Prüfen

```bash
npm install            # einmalig im Worktree
npm run check          # Lint, Unit-Tests, Build
node scripts/games/<id>.mjs   # eigene Browser-Probe
```

Browser-Probe mit dem Helfer aus `scripts/lib.mjs` (Chromium und Playwright sind installiert, nichts nachinstallieren):

```js
import { openApp } from '../lib.mjs';
const app = await openApp({ query: '?debug=1&go=game:3' }); // Kapitel zählen ab 0: runner 0, meowdoku 1, wimmel 2, wordle 3, handball 4, lacher 5
const { page } = app;
await page.click('.howto .btn');          // Regel-Karte schließen, Spiel startet
await app.shot('<id>-start');             // Bild nach screenshots/
// … spielen: page.touchscreen.tap(x, y), page.mouse.move/down/up für Wischer, page.evaluate(() => globalThis.__game …)
await page.waitForFunction(() => window.__feli.step().startsWith('frame:'));   // Spiel hat ctx.end() gemeldet
if (app.errors.length) { console.error(app.errors); process.exitCode = 1; }
await app.close();
```

Die Bildschirmfotos unbedingt selbst ansehen (Read-Werkzeug) und Layout-Fehler beheben: Überlappungen, abgeschnittene
Texte, zu kleine Tippziele, Elemente unter dem Stumm-Schalter. Die Probe soll das Spiel einmal bis zum Sieg und einmal
bis zur Niederlage durchspielen und jeweils ein Foto machen.
