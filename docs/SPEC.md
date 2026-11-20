# Felis Geburtstagsspiel 2026 – Spezifikation

Ziel: eine Handy-Web-App, in der Feli in **ca. 10 Minuten** sechs witzige Minispiele mit Storyline durchspielt. Jedes Spiel bringt ein **Puzzleteil** und ein **Hinweiswort**. Am Ende errät sie ihr Geschenk: ein Wochenende in Köln mit der 1LIVE Köln Comedy-Nacht XXL.

**Deadline: Samstag, 21.11.2026, früh morgens.** Lieber einfach und stabil als groß und wackelig.

---

## 1. Rahmen

| Punkt | Vorgabe |
|---|---|
| Repo | `JNO-DEVHUB/feli_geburtstagsspiel_2026` |
| URL | `https://jno-devhub.github.io/feli_geburtstagsspiel_2026/` (der QR-Code ist schon gedruckt, die URL muss genau so funktionieren) |
| Technik | Wie der Hochzeits-Runner (`JNO-DEVHUB/handyspiel_hochzeitsrunnner`): Vanilla JS, HTML5 Canvas + DOM, esbuild, keine Laufzeit-Abhängigkeiten. Module aus dem Runner dürfen kopiert werden (Physik, Paar-Rendering, Parallax, FX, Audio, Storage, Pages-Workflow). |
| Deploy | GitHub Actions → GitHub Pages. Wichtig: Bei privaten Repos geht Pages nur mit kostenpflichtigem Plan. Ist das Repo privat und Pages nicht verfügbar, dem Nutzer sagen, er soll das Repo auf public stellen. |
| Gerät | Smartphone im Hochformat (Referenz 390×844), nur Touch. Am Desktop mittig im Handy-Rahmen. Querformat: Hinweis „Bitte Handy drehen“. |
| Sprache | Deutsch, Duzen, viel Humor |
| Speicher | `localStorage` (Fortschritt, Teile, erster Durchlauf erledigt). Alles in try/catch. |
| Offline | Alle Assets lokal im Bundle bzw. unter `public/assets/`. Keine externen Fonts von CDNs, also Fonts per `@fontsource` oder lokal. |
| Ton | Kurze Soundeffekte mit WebAudio-Synth wie im Runner, Stumm-Schalter oben rechts. **Keine fremde Musik und keine Liedtexte** (auch nicht von Taylor Swift). |
| Debug | `?debug=1`: Kapitel überspringen, Fortschritt zurücksetzen, jedes Spiel sofort gewinnen/verlieren. Ohne den Parameter unsichtbar. |

## 2. Figuren und Look

- **Stil:** warmes, detailreiches Wimmelbild-Comic, angelehnt an niederländische Wimmelpuzzles (Jan van Haasteren). Kräftige Farben, dicke Konturen, viele kleine Gags im Hintergrund. **Akzentfarbe Orange `#F07A1A`** (Felis Lieblingsfarbe), dazu Creme `#FFF4E2`, Dunkelbraun `#3B2A22`, Himmelblau `#7CC4F0`.
- **Schrift:** verspielte Comic-Display-Schrift für Titel (z. B. „Luckiest Guy“ oder „Bangers“ via @fontsource), gut lesbare Rundschrift für Text (z. B. „Nunito“).
- **Figuren = echte Fotoköpfe auf gezeichneten Comic-Körpern** (Bobblehead-Prinzip, großer Kopf, kleiner Körper):
  - **Feli** („Königin“): trägt **immer die gelbe Krone** (ist im Kopf-PNG schon drin). Outfits je nach Szene: Brautoutfit (weißer Hosenanzug) mit Snowboard, Handballtrikot schwarz-rot mit der Nr. 23, schick für die Show.
  - **Janni**: der **Moderator** der ganzen Geschichte. Beiger Anzug, Fliege, Mikrofon in der Hand, in Spiel 5 Torwart, im Finale mit Konfettikanone.
  - **Franks**: rot-oranger Kater mit weißer Brust, Felis Liebling, eher selbstbewusst.
  - **Findi**: grau getigerter Kater mit weißem Bauch und weißen Pfoten, eher chaotisch.
- Die Körper zeichnet der Code prozedural im Canvas, wie das Brautpaar im Runner (`src/render/couple.js`). Die Fotoköpfe werden als Bild darübergelegt und wackeln leicht mit (Feder, Squash beim Springen).
- Sprechblasen im Comic-Stil. Janni spricht immer mit Mikrofon von unten ins Bild.

## 3. Assets

Assets liefert die Chat-Session und legt sie unter `public/assets/` ab. **Bis sie da sind, Platzhalter verwenden** (farbige Kreise mit Initialen, Verlaufshintergründe) und die Dateinamen genau so referenzieren:

| Datei | Inhalt |
|---|---|
| `chars/feli_head.png` | Felis Kopf mit Krone, freigestellt, ca. 512×512 |
| `chars/janni_head.png` | Jannis Kopf, freigestellt |
| `chars/franks_head.png` | Franks' Kopf, freigestellt |
| `chars/findi_head.png` | Findis Kopf, freigestellt |
| `bg/card.jpg` | Hintergrund der Geburtstagskarte |
| `bg/k1_berlin_schnee.jpg` | verschneites Berlin (Story-Hintergrund für Kapitel 1) |
| `bg/k2_ice.jpg` | ICE-Abteil innen |
| `bg/k3_hamburg_wimmel.jpg` | großes Wimmelbild Hamburg Hbf (Spiel 3, ca. 2400 px breit) |
| `bg/k4_zug_abend.jpg` | Zugfenster in der Abenddämmerung |
| `bg/k5_halle.jpg` | Sporthalle |
| `bg/k6_buehne.jpg` | Comedy-Bühne mit Publikum |
| `puzzle/puzzle_final.jpg` | das finale Puzzlebild, 3:2 quer |
| `manifest.json` | Kopf-Anker (Mittelpunkt, Skalierung) sowie Fundstellen-Koordinaten für Spiel 3, falls nötig |

## 4. Ablauf

```
Geburtstagskarte → Trailer → Prolog
  → [Story-Intro → Spiel → Bilderrahmen] × 6
  → Finale → Gutschein → Spielesaal
```

### 4.1 Erster Durchlauf

- Alle Kapitel kommen fest hintereinander, ohne Menü und ohne Zurück.
- **Jedes Spiel hat genau 1 Versuch.** Gewonnen: das Teil fliegt in den Rahmen. Verloren: das Teil zerbröselt (Comic-„PUFF!“), der Platz bleibt leer, es geht trotzdem weiter.
- Lädt sie die Seite neu, geht es am Anfang des aktuellen Kapitels weiter. Ein abgebrochenes Spiel gilt nicht als verloren, sie darf es neu starten. Sonst wäre ein versehentlicher Reload zu frustrierend.
- Gesamtdauer: Ziel 8–10 Minuten. Die Spiele so abstimmen, dass **jedes beim ersten Versuch zu etwa 80 % schaffbar** ist. Es soll Spaß machen, nicht frustrieren.

### 4.2 Bilderrahmen (nach jedem Spiel)

- Ein goldener Bilderrahmen mit einem 3×2-Raster (quer), darunter 6 Hinweisfelder.
- Gewonnen: Das Puzzleteil (echter Ausschnitt aus `puzzle_final.jpg` mit Puzzlenasen-Maske) wird groß eingeblendet, dreht sich, fliegt in seinen Platz und rastet mit „Klack“ und Glitzer ein. Das Hinweiswort erscheint.
- Verloren: Das Teil wird kurz gezeigt, zerbröselt, und das Hinweisfeld zeigt `???`.
- Button „Weiter“ geht zum nächsten Kapitel.

| Kapitel | Teil (Position im Rahmen) | Hinweiswort |
|---|---|---|
| 1 | oben links | ZUG |
| 2 | oben Mitte | ZU ZWEIT |
| 3 | oben rechts | KÖLN |
| 4 | unten links | ARENA |
| 5 | unten Mitte | 16.10. |
| 6 | unten rechts | COMEDY |

### 4.3 Spielesaal (nach dem Finale)

- Übersicht der 6 Spiele als Karten, jedes beliebig oft spielbar.
- Wird ein vorher verlorenes Spiel gewonnen, wird das Teil nachträglich eingesetzt und das Hinweiswort aufgedeckt.
- Von hier aus kann man jederzeit den Gutschein und das Puzzle ansehen.
- Ab dem zweiten Öffnen der App direkt hierhin (mit Button „Intro nochmal ansehen“).

## 5. Bildschirme im Detail

### 5.1 Geburtstagskarte (Start)

Eine aufklappbare Karte (3D-Flip-Animation) mit Konfetti-Funkeln, Feli mit Krone und den beiden Katern.

> **Alles Gute zum Geburtstag, Feli!** 👑
> Dein Geschenk liegt dieses Jahr nicht unterm Kissen.
> Du musst es dir **erspielen**.
> 6 Kapitel. 6 Puzzleteile. Jedes verlorene Teil macht es schwerer.
> Beim ersten Mal hast du pro Spiel nur **einen Versuch**. Also: Konzentration, Königin!

Button: **„Los geht's!“** (dieser erste Tap schaltet auch den Ton frei)

Die Karte verrät nichts über das Geschenk.

### 5.2 Trailer (ca. 25 s, überspringbar ab Sekunde 3)

Ein animierter Kino-Trailer, ganz im Canvas oder per CSS, kein Video:
1. Schwarz, Text „Eine Janni-Production präsentiert…“ und Jannis Kopf zwinkert.
2. Titel knallt rein: **„FELIS GROSSE REISE“**, Krone funkelt.
3. Schnelldurchlauf, je ca. 2,5 s pro Kapitel mit Wisch-Übergang:
   - „Kapitel 1: Schneechaos!“ (Snowboard rast durchs Bild)
   - „Kapitel 2: Kater an Bord!“ (Franks und Findi lugen aus dem Koffer)
   - „Kapitel 3: Verloren in Hamburg!“ (Lupe über Wimmelbild)
   - „Kapitel 4: Perlen-Rätsel!“ (Armbandperlen klackern)
   - „Kapitel 5: Siebenmeter!“ (Handball fliegt aufs Tor)
   - „Kapitel 6: Showtime!“ (Scheinwerfer, Lacher fliegen)
4. „Nur echt mit Krone.“, dann „Bereit, Königin?“ und Button **„Abenteuer starten“**.

### 5.3 Story-Szenen

- Hintergrund-Bild, Janni als Moderator unten links mit Mikro, Sprechblasen erscheinen nacheinander (Tippen = nächste Blase, Schreibmaschinen-Effekt, Tippen zeigt sofort alles).
- Feli, Franks und Findi tauchen je nach Szene mit kleinen Animationen auf.
- **Im Storytext nie „Köln“, „Comedy“ oder „Chris Tall“ erwähnen.** Das Ziel bleibt geheim, bis die Hinweise es verraten.

## 6. Die Kapitel

### Prolog (Story)
> **Janni:** Meine Damen und Herren, liebe Kater! Herzlich willkommen!
> **Janni:** Unsere frisch gekrönte Ehefrau hat heute Geburtstag. Und ich hab ihr eine Reise geschenkt.
> **Janni:** Wohin? Tja. Das muss sie schon selbst herausfinden.
> **Janni:** Kleines Problem: Der Zug fährt in 10 Minuten ab Südkreuz. Berlin liegt unter einem Meter Schnee.
> **Janni:** Taxi? Steckt fest. Die BVG? Hat Schneefrei. Das Hochzeitspferd? Ist in Rente.
> **Janni:** Zum Glück liegt im Keller noch was …
> *(Snowboard fällt ins Bild: „PLONK!“)*
> **Janni:** Ab zum Südkreuz! Du lenkst, ich schrei.

### Kapitel 1 · „Schneechaos!“ – Snowboard-Runner (Vorbild Subway Surfers / Hochzeits-Runner)
- **Basis: der Hochzeits-Runner** (Physik, Parallax, Paar-Rendering, FX). Das Brautpaar steht hintereinander auf einem Snowboard (Feli vorne mit Krone, Janni hinten), Feli im weißen Hosenanzug, Janni im beigen Anzug mit Fliege. Schneeflocken-Partikel, Schneespritzer beim Landen.
- **Steuerung:** Tippen = Springen, gedrückt halten = höher, in der Luft nochmal tippen = Doppelsprung mit Drehung (wie im Runner).
- **Welt:** verschneites Berlin mit Parallax: Fernsehturm, Altbauten, Brandenburger Tor mit Schneemütze, Spree mit Eisschollen. Gegen Ende taucht das Südkreuz-Bahnhofsschild auf.
- **Hindernisse:** Schneemann, eingeschneiter E-Scooter, Streufahrzeug (groß, Doppelsprung nötig), Tauben im Tiefflug, Mülltonne mit Schneehaube.
- **Sammeln:** Katzenleckerlis (nur Punkte, Comic-„MAMPF!“).
- **Ziel:** Strecke bis Südkreuz überleben, **ca. 40 Sekunden**, Fortschrittsbalken oben mit kleinem Zug-Icon. **3 Herzen.** Jeder Treffer kostet ein Herz (Comic-„BONK!“, kurz blinken, unverwundbar). Bei 0 Herzen ist das Spiel verloren.
- **Gewonnen:** Das Paar rutscht in den Bahnhof, Bremsspur, Schneewolke, „GESCHAFFT!“
- **Outro:** „Südkreuz erreicht! Mit 3 Sekunden Puffer. Und der Zug war sogar pünktlich. Dass ich das noch erleben darf.“

### Kapitel 2 · „Kater an Bord!“ – Meowdoku (Vorbild Meowdoku)
**Intro:**
> **Janni:** ICE 508, Wagen 2, Ruhebereich. Endlich Ruhe.
> *(Koffer wackelt. Reißverschluss geht auf. Franks und Findi schauen raus.)*
> **Janni:** … Ich hab nicht gesagt, dass ihr mitkommen dürft.
> **Janni:** Jetzt brauchen sie Plätze. Aber Kater sind Kater: Jeder will sein eigenes Revier, und keiner will den anderen sehen. Nicht mal diagonal.

- **Regeln** (Queens-Prinzip): 6×6-Feld mit 6 farbigen Regionen (Sitzpolster in verschiedenen Farben). Pro **Zeile**, **Spalte** und **Farbregion** genau **eine Katze**. Katzen dürfen sich **nicht berühren, auch nicht diagonal**.
- **Steuerung:** einmal tippen = X (Markierung), zweimal tippen = Katze, nochmal = leer. Die Katzen-Icons sind abwechselnd Franks- und Findi-Köpfe.
- **3 Herzen:** Eine Katze an falscher Stelle (Vergleich mit der Lösung) kostet ein Herz, die Katze faucht und hüpft weg. Bei 0 Herzen ist das Spiel verloren.
- Das Rätsel ist handgebaut, **eindeutig lösbar und leicht** (Anfänger-Niveau). Die Eindeutigkeit mit einem kleinen Solver im Test prüfen.
- Kleine Regel-Erklärung vor dem Start mit Mini-Beispiel (2 Bildschirme, überspringbar).
- **Outro:** „Ruhe im Abteil. Der Schaffner hat nichts gemerkt. Glaubt er zumindest.“

### Kapitel 3 · „Verloren in Hamburg!“ – Wimmelbild (Vorbild „Wo ist Walter?“)
**Intro:**
> **Janni:** Umsteigen in Hamburg! 45 Minuten Aufenthalt.
> **Janni:** Feli wollte nur kurz ein Franzbrötchen holen … und jetzt ist sie weg. Und die Kater auch.
> **Janni:** Finde Feli, Franks und Findi, bevor der Anschluss weg ist! (Ja, du suchst dich gerade selbst.)

- Das große Wimmelbild `k3_hamburg_wimmel.jpg` lässt sich mit Pinch zoomen und mit einem Finger verschieben.
- Feli (Kopf mit Krone, kleiner Körper), Franks und Findi werden **vom Code als kleine Sprites** an festen, gut versteckten Positionen ins Bild gesetzt: halb hinter etwas, aber fair findbar. Die Positionen stehen in einer Konfigurationsdatei. Sinnvolle Stellen bestimmt der Code anhand des Bildes und prüft sie per Screenshot.
- Unten eine Leiste mit 3 Suchkarten. Tippt sie richtig, gibt es einen Kreis-Marker, die Karte wird abgehakt, Ton „Ping!“.
- **Zeit: 90 Sekunden.** Ein Fehltipp kostet 3 Sekunden (Comic-„Nö!“). Bei Zeitablauf ist das Spiel verloren. Nach 60 s ohne Fund leuchtet ein dezenter Hinweis-Schimmer.
- **Outro:** „Alle wieder da! Feli hatte übrigens zwei Franzbrötchen. Für sich.“

### Kapitel 4 · „Perlen-Rätsel!“ – Wordle mit Freundschaftsarmband
**Intro:**
> **Janni:** Weiter geht's Richtung Westen. Zeit für Handarbeit.
> **Janni:** Jede echte Swiftie weiß: Zu einem großen Abend gehört ein Freundschaftsarmband.
> **Janni:** Aber welches Wort kommt drauf? 5 Buchstaben. 6 Versuche. Kleiner Tipp: ein Ort, an dem man richtig laut sein darf.

- Wordle-Mechanik, **Lösung: ARENA.** Jede Zeile ist ein Armband aus 5 Buchstabenperlen.
- Perlenfarben: **Orange** = richtiger Buchstabe an richtiger Stelle, **Lila** = Buchstabe kommt vor, steht aber woanders, **Grau** = kommt nicht vor.
- Eigene Bildschirmtastatur (QWERTZ inkl. Ä/Ö/Ü) als Perlen. **Jedes Wort aus 5 Buchstaben wird akzeptiert**, kein Wörterbuch.
- Gewonnen: Das Armband schließt sich zum Kreis und funkelt.
- **Outro:** „Schickes Armband. Ich hab auch eins gemacht. Da steht ‚JANNI‘ drauf. Für dich.“

### Kapitel 5 · „Siebenmeter!“ – Handball-Wurfspiel
**Intro:**
> **Janni:** Angekommen! Aber vor dem großen Abend: Aufwärmen.
> **Janni:** Handballerin bleibt Handballerin. 5 Siebenmeter. Im Tor: ich.
> **Janni:** Ich hab extra trainiert. *(Hat er nicht.)*

- Feli im schwarz-roten Trikot Nr. 23 von hinten, Janni als Torwart (Bobblehead, Torwart-Pulli) im Tor.
- **Steuerung:** Wischen in Wurfrichtung, die Wischlänge bestimmt die Stärke. Der Ball fliegt mit leichter Kurve.
- Janni hechtet zufällig mit Ansage („Links! Nee, rechts!“) und bewegt sich vorher hin und her. Er hält ungefähr jeden dritten bis vierten gut platzierten Wurf.
- **5 Würfe, 3 Treffer nötig.** Anzeige mit 5 Ball-Icons.
- Treffer: Netz zappelt, „TOOOR!“, Janni liegt dramatisch am Boden. Gehalten: Janni jubelt peinlich. Daneben: Ball trifft eine Taube oder Franks (comichaft, niemand verletzt).
- **Outro:** „Okay, ich geb's zu: Du bist besser. Das bleibt aber unter uns.“

### Kapitel 6 · „Showtime!“ – Lacher wischen (Vorbild Fruit Ninja)
**Intro:**
> **Janni:** Der große Abend! Die Halle ist voll, das Licht geht aus, die Stimmung kocht.
> **Janni:** Deine Aufgabe: Fang so viele Lacher wie möglich!
> **Janni:** Aber Finger weg von den faulen Tomaten. Die sind für mich.

- Von unten fliegen in Bögen Lacher hoch: „HA!“, „HAHA!“, „😂“, Mikrofone, goldene Lacher (+3). Wischen zerteilt sie mit Wisch-Spur und Konfetti-Platzer.
- Faule Tomaten dazwischen. Wischt sie eine, gibt es „SPLATSCH!“ auf dem Bildschirm (kurz verschmiert). **3 Tomaten = verloren.**
- **Ziel: 25 Punkte in 30 Sekunden.** Combo bei mehreren in einem Wisch.
- **Outro:** „Was für ein Abend! … Moment. Welcher Abend eigentlich? Und wo? Zeit für das große Finale!“

## 7. Finale

1. **Puzzle:** Der Bilderrahmen füllt den Bildschirm. Alle gewonnenen Teile rotieren einmal und setzen sich zusammen, fehlende bleiben als graue Lücke. Darunter stehen alle gewonnenen Hinweiswörter.
2. **Die Frage:**
   > **Janni:** Sechs Kapitel. [X] Puzzleteile. Und jetzt die große Frage, Königin: **Was ist dein Geschenk?**

   Vier Antwortkarten in zufälliger Reihenfolge:
   - Ein Wochenende in Köln mit großer Comedy-Show ✔
   - Ein dritter Kater (Franks und Findi schauen entsetzt)
   - Handball-Trainingslager mit Janni als Trainer
   - Ein Jahresvorrat Franzbrötchen

   Richtige Antwort: „RICHTIG!!!“ Falsche Antwort: Janni lacht, „Fast! Aber nein …“, die Karte zerknüllt sich, sie darf nochmal wählen. Danach geht es weiter.
3. **Konfettikanone:** Janni rollt eine riesige Kanone ins Bild, zündet die Lunte (Funken, Countdown 3-2-1, Wackeln) und dann **BOOM**: Bildschirmwackeln, und der **ganze Bildschirm ist voller Konfetti** (orange, gold, weiß, ein paar Mini-Kronen und Katzenpfoten).
4. **Wegwischen:** Text „Wisch das Konfetti weg!“ Darunter liegt der Gutschein, das Konfetti funktioniert wie ein Rubbellos (Canvas mit `destination-out`). Ab ca. 70 % freigewischt fällt der Rest von selbst runter.
5. **Gutschein** (gestaltetes Ticket mit Krone, Katerpfoten und orangem Rand):

   > **🎟 GUTSCHEIN 🎟**
   > **1LIVE Köln Comedy-Nacht XXL**
   > moderiert von Chris Tall · LANXESS Arena Köln
   > **Samstag, 16.10.2027** · Einlass 17:30 Uhr · Beginn 19:15 Uhr
   > Preiskategorie 2 · Block 216 · Reihe 1 & 2 · jeweils Sitz 18
   >
   > 🚆 **Hinfahrt:** Fr 15.10.2027 · Berlin Südkreuz 15:24 → Köln Hbf 21:46 (ICE 508 bis Hamburg, ICE 1023 bis Köln)
   > 🚆 **Rückfahrt:** So 17.10.2027 · Köln Hbf 14:44 → Berlin Südkreuz 20:33 (ICE 651 bis Berlin Hbf, ICE 607)
   > 🏨 **Hotel:** 2 Nächte in Köln (15.–17.10.) · wird noch verraten 🤫
   >
   > *Gültig nur mit Krone. Kater bleiben zu Hause.*
   > *In Liebe, dein Janni ❤️*

   Darunter: Button „Zum Spielesaal“ und ein dezentes „Screenshot machen nicht vergessen 📸“.

## 8. Qualität und Abnahme

- [ ] Funktioniert in Safari iOS und Chrome Android (Touch, Viewport-Höhe mit `100dvh`, kein Zoom per Doppeltipp, kein Pull-to-Refresh in Spielen: `overscroll-behavior: none`, `touch-action: none` auf Spielflächen)
- [ ] Gesamtdurchlauf in unter 10 Minuten möglich
- [ ] Ein Reload mitten im Durchlauf verliert keinen Fortschritt
- [ ] Jedes Spiel ist über `?debug=1` direkt startbar
- [ ] Smoke-Test mit Playwright (390×844): kompletter Durchlauf mit Debug-Gewinnen, Screenshots aller Bildschirme
- [ ] Unit-Tests: Meowdoku-Lösung ist eindeutig, Wordle-Farblogik inkl. doppelter Buchstaben (ARENA hat 2× A), Fortschritts-Speicher
- [ ] Die URL `https://jno-devhub.github.io/feli_geburtstagsspiel_2026/` liefert die App aus (Base-Pfad beachten)
- [ ] Keine Spoiler im HTML-Titel oder Manifest: Titel „Felis große Reise 👑“
