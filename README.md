# Felis große Reise 👑

Geburtstagsspiel fürs Handy: sechs Minispiele mit Storyline. Jedes Spiel bringt ein Puzzleteil und ein Hinweiswort, am Ende steht der Gutschein.

- **Live:** https://jno-devhub.github.io/feli_geburtstagsspiel_2026/
- **Spezifikation:** [docs/SPEC.md](docs/SPEC.md) (Stand vom 20.11., siehe Abweichungen unten)
- **Leitfaden für die Minispiele:** [docs/GAMES.md](docs/GAMES.md)

## Ablauf

```
Geburtstagskarte → Trailer → Prolog
  → [Story → Regel-Karte → Spiel → Bilderrahmen] × 6
  → Finale (Puzzle, Quiz, Konfettikanone, Rubbel-Konfetti) → Gutschein → Spielesaal
```

| Kapitel | Spiel | Gewonnen, wenn | Hinweiswort |
| --- | --- | --- | --- |
| 1 · Im Galopp zum Südkreuz! | Runner auf dem Hochzeitspferd | ca. 40 s mit mindestens einem von 3 Herzen | ZUG |
| 2 · Kater an Bord! | Meowdoku (6×6) | 6 Kater richtig, höchstens 2 Fehler | ZU ZWEIT |
| 3 · Verloren in Hamburg! | Wimmelbild | Feli, Franks und Findi in 90 s gefunden | KÖLN |
| 4 · Perlen-Rätsel! | Wordle mit Freundschaftsarmband | Lösungswort in 6 Versuchen | ARENA |
| 5 · Siebenmeter! | Handball-Wurfspiel | 3 Tore aus 5 Würfen | 16.10. |
| 6 · Showtime! | Lacher wischen | 25 Punkte in 30 s, weniger als 3 Tomaten | COMEDY |

Erster Durchlauf: feste Reihenfolge, ein Versuch pro Spiel. Neuladen setzt am Anfang des aktuellen Kapitels fort
(ein abgebrochenes Spiel gilt nicht als verloren; steht das Ergebnis schon im Bilderrahmen, bleibt es dabei).
Ab dem zweiten Öffnen startet die App im Spielesaal.

## Testen

- **Debug-Modus:** `?debug=1` an die URL hängen. Unten links erscheint ein Käfer-Knopf mit Schritt zurück/vor,
  Sprung zu jedem Schritt, „Gewinnen“, „Verlieren“ und „Reset“.
- **Ein Spiel direkt starten:** `?debug=1&go=game:0` bis `game:5` (Kapitel zählen ab 0). Andere Schritte:
  `card`, `trailer`, `prolog`, `story:N`, `frame:N`, `finale`, `voucher`, `hall`.
- **Fortschritt zurücksetzen:** im Debug-Modus „Reset“ tippen (wichtig vor der Übergabe an Feli, siehe unten).

Der Spielstand liegt im `localStorage` des Browsers. Wer vorher auf Felis Handy testet, muss danach dort
`…/feli_geburtstagsspiel_2026/?debug=1` öffnen, „Reset“ tippen und den Tab schließen.

## Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```powershell
npm install
npm run check
npm run smoke
```

| Befehl | Zweck |
| --- | --- |
| `npm run build` | baut nach `dist/` (`index.html`, `app.js`, `app.css`, Schriften, `assets/`) |
| `npm run dev` | baut bei jeder Änderung neu |
| `npm test` | Unit-Tests mit `node:test` |
| `npm run lint` | ESLint |
| `npm run check` | Lint, Tests und Build |
| `npm run smoke` | kompletter Durchlauf im Browser (390×844, mit `VIEWPORT=360x640` auch kleiner), Bildschirmfotos in `screenshots/` |
| `node scripts/games/<spiel>.mjs` | Browser-Probe eines einzelnen Spiels (Sieg und Niederlage) |

Deploy: Jeder Push auf `main` baut und veröffentlicht über GitHub Actions auf GitHub Pages
(Settings → Pages → Source „GitHub Actions“).

Neue Grafiken vom Branch `assets` holen und fürs Handy aufbereiten (WebP, saubere Köpfe mit Comic-Kontur,
Ergebnis in `public/opt/`, wird eingecheckt; braucht Playwright mit Chromium):

```powershell
git fetch origin assets
git checkout origin/assets -- public/assets
node scripts/optimize-assets.mjs
```

Die App lädt zuerst die aufbereitete Fassung aus `public/opt/` und fällt sonst auf das Original zurück.

## Architektur

```
src/
  main.js            Programmsteuerung: Schritt anzeigen, Fortschritt speichern, Debug
  flow.js            Reihenfolge der Schritte und Regeln fürs Fortsetzen (reine Daten)
  content.js         alle Texte (Karte, Trailer, Story, Regeln, Finale, Gutschein)
  assets.js          Bilder laden, Platzhalter für fehlende Dateien, Kopf-Anker
  core/              Zufall mit Seed, Mathe, Spielstand, Rubbel-Raster
  audio/             synthetische Soundeffekte (Web Audio), keine Audiodateien
  render/chars.js    Figuren: gezeichneter Comic-Körper plus Fotokopf (DOM und Canvas)
  ui/                Bildschirme: Karte, Trailer, Story, Bilderrahmen, Finale, Gutschein, Spielesaal
  games/<spiel>/     je Spiel logic.js (ohne DOM, getestet), game.js, style.css
```

- Technik wie im Hochzeits-Runner: Vanilla JS, HTML5 Canvas plus DOM, esbuild, keine Laufzeit-Abhängigkeiten.
  Sprungphysik, fester Zeitschritt, Ton-Synthese und der abgesicherte Speicher sind von dort übernommen.
- Jedes Spiel hat dieselbe Schnittstelle (`createGame(ctx)`, `ctx.end(won)`, `destroy()`), die Spiellogik läuft ohne
  Browser und ist per Unit-Test geprüft.
- Alle Maße hängen an der Schriftgröße der Bühne (16px bei 390×844), dadurch skaliert die App von 360×640 bis 430×932.
- Offline-tauglich im Sinne der SPEC: alle Bilder und Schriften (Luckiest Guy, Nunito per `@fontsource`) liegen lokal.

## Entscheidungen

- **Kapitel 1 ohne Schnee:** Runner mit dem Hochzeitspferd durch das herbstliche Berlin (Vorgabe per Nachricht).
  Die angekündigte neue SPEC.md ist in der Entwicklungs-Session nicht angekommen; Prolog-Text, Titel
  („Im Galopp zum Südkreuz!“), Hindernisse (Laubhaufen, E-Scooter, Mülltonne, Brezelstand, Absperrung, Tauben,
  Kehrmaschine) und der Trailer-Satz („Hü-hott durch Berlin!“) sind deshalb eigene Formulierungen in `src/content.js`.
- **Puzzle im Hochformat, Raster 2×3:** Teile zeilenweise von oben links (Kapitel 1) bis unten rechts (Kapitel 6).
- **Anrede „Spatzl“** statt „Königin“ in allen Texten. Die Krone bleibt.
- **Hinweiswörter erscheinen sofort** im Bilderrahmen (Variante A), auch „KÖLN“ und „COMEDY“. Story, Trailer, Titel
  und Regeln nennen das Ziel nie; das prüft `test/content.test.js`.
- **Bilder aufbereitet:** Die gelieferten Grafiken werden per Skript verkleinert (gesamt 4,9 MB → 2,3 MB, Köpfe
  von ca. 230 KB auf ca. 16 KB). Die Fotoköpfe bekommen dabei saubere Ränder, eine dunkle Comic-Kontur und etwas
  kräftigere Farben. Ein Spiel startet erst, wenn sein Hintergrund geladen ist.
- **Kein Service Worker:** Ein Cache könnte am Geburtstagsmorgen eine veraltete Version zeigen.
- **Nur Soundeffekte** und kurze eigene Synth-Jingles, keine durchlaufende Musik, keine fremden Melodien.
- **Text für verlorene Spiele:** Die SPEC kennt nur die Sieger-Sprüche; für die Niederlage gibt es eigene.
- **Abstimmung auf ca. 80 % Erfolg**, jeweils per Test mit simulierter Spielerin belegt:
  - Runner: gemütliches Tempo, 15–18 Hindernisse, Kehrmaschine wird angekündigt.
  - Meowdoku: Rätsel mit genau einer Lösung, allein durch einfache Schlüsse lösbar; richtige Kater streichen
    ausgeschlossene Felder automatisch; nach 30 s ohne Tipp pulsiert ein sicher erschließbares Feld.
  - Wimmelbild: Hinweis-Schimmer schon nach 30 s ohne Fund (SPEC: 60 s), deutlicher nach 45 s.
  - Wordle: Jannis Tipp bleibt sichtbar; nach dem 3., 4. und 5. Fehlversuch gibt es je einen weiteren Tipp.
  - Siebenmeter: Vorschau-Linie beim Zielen; Janni hält etwa jeden vierten Ball aufs Tor.
  - Lacher wischen: rund 47 Punkte fliegen pro Runde, jedes siebte Objekt ist eine Tomate. Ab 25 Punkten ist der
    Sieg sicher, Tomaten klatschen dann nur noch.
- **Neuladen am Bilderrahmen** zeigt das gespeicherte Ergebnis ohne zweite Animation.
- **Spielesaal:** Ein nachträglich gewonnenes Spiel setzt das Teil ein und deckt das Hinweiswort auf; ein
  gewonnenes Teil geht nie wieder verloren.

## Bekannte Grenzen

- Getestet in Chromium mit Touch-Emulation (390×844 und 360×640). Auf echtem iOS-Safari und Android-Chrome
  bitte einmal mit `?debug=1` durchklicken.
- Auf dem iPhone bleibt die App stumm, wenn der Stummschalter am Gerät an ist.
- Das Repo ist öffentlich: Fotoköpfe und Gutscheintext sind im Quelltext einsehbar.
