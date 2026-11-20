// Alle Texte der App an einer Stelle.
// WICHTIG: Vor dem Finale darf kein Story-Text das Ziel verraten (siehe test/content.test.js).
// Die Hinweiswörter im Bilderrahmen sind die gewollte Ausnahme: Sie sind die Belohnung.

// Zeilen einer Story-Szene:
//   { who: 'janni', text }                Sprechblase
//   { note: '…', word?: 'PLONK!', enter?: ['franks'], sfx?: 'wieher' }   Regieanweisung mit optionalem Comic-Wort und Auftritt

export const TITLE = 'Felis große Reise';

export const CARD = {
  headline: 'Alles Gute zum Geburtstag, Feli!',
  lines: [
    'Dein Geschenk liegt dieses Jahr nicht unterm Kissen.',
    'Du musst es dir <b>erspielen</b>.',
    '6 Kapitel. 6 Puzzleteile. Jedes verlorene Teil macht es schwerer.',
    'Beim ersten Mal hast du pro Spiel nur <b>einen Versuch</b>. Also: Konzentration, Spatzl!',
  ],
  cover: 'Für Feli',
  coverHint: 'Tippen zum Aufklappen',
  button: "Los geht's!",
};

export const TRAILER = {
  presents: 'Eine Janni-Production präsentiert …',
  title: 'FELIS GROSSE REISE',
  outro: ['Nur echt mit Krone.', 'Bereit, Spatzl?'],
  button: 'Abenteuer starten',
  skip: 'Überspringen',
};

export const PROLOG = {
  bg: 'bg:k1',
  cast: [],
  lines: [
    { who: 'janni', text: 'Meine Damen und Herren, liebe Kater! Herzlich willkommen!' },
    { who: 'janni', text: 'Unsere frisch gekrönte Ehefrau hat heute Geburtstag. Und ich hab ihr eine Reise geschenkt.' },
    { who: 'janni', text: 'Wohin? Tja. Das muss sie schon selbst herausfinden.' },
    { who: 'janni', text: 'Kleines Problem: Der Zug fährt in 10 Minuten ab Südkreuz. Und ganz Berlin steht im Stau.' },
    { who: 'janni', text: 'Taxi? Steckt fest. Die BVG? Streikt. Die Ringbahn? Laub auf den Gleisen.' },
    { who: 'janni', text: 'Zum Glück kennen wir da jemanden …' },
    { note: 'Das Hochzeitspferd trabt ins Bild.', word: 'WIEHER!', sfx: 'wieher', enter: ['feli'] },
    { who: 'janni', text: 'Ab zum Südkreuz! Du lenkst, ich schrei.' },
  ],
};

export const CHAPTERS = [
  {
    game: 'runner',
    title: 'Im Galopp zum Südkreuz!',
    trailer: 'Hü-hott durch Berlin!',
    bg: 'bg:k1',
    cast: ['feli'],
    intro: [],
    howto: ['Tippen = springen', 'Gedrückt halten = höher', 'In der Luft nochmal tippen = Doppelsprung', '3 Herzen. Schaff es bis zum Südkreuz!'],
    outroWin: 'Südkreuz erreicht! Mit 3 Sekunden Puffer. Und der Zug war sogar pünktlich. Dass ich das noch erleben darf.',
    outroLose: 'Knapp daneben ist auch vorbei. Den Zug haben wir trotzdem erwischt. Frag nicht, wie.',
    hint: 'ZUG',
  },
  {
    game: 'meowdoku',
    title: 'Kater an Bord!',
    trailer: 'Kater an Bord!',
    bg: 'bg:k2',
    cast: [],
    intro: [
      { who: 'janni', text: 'ICE 508, Wagen 2, Ruhebereich. Endlich Ruhe.' },
      { note: 'Der Koffer wackelt. Der Reißverschluss geht auf.', word: 'ZIIIP!', sfx: 'meow', enter: ['franks', 'findi'] },
      { who: 'janni', text: '… Ich hab nicht gesagt, dass ihr mitkommen dürft.' },
      { who: 'janni', text: 'Jetzt brauchen sie Plätze. Aber Kater sind Kater: Jeder will sein eigenes Revier, und keiner will den anderen sehen. Nicht mal diagonal.' },
    ],
    howto: ['Setz 6 Kater auf die Sitze.', 'Pro Zeile, Spalte und Polsterfarbe genau ein Kater.', 'Kater dürfen sich nicht berühren, auch nicht diagonal.', '1× tippen = ✕, 2× tippen = Kater. 3 Herzen.'],
    outroWin: 'Ruhe im Abteil. Der Schaffner hat nichts gemerkt. Glaubt er zumindest.',
    outroLose: 'Chaos im Abteil! Der Schaffner hat ALLES gemerkt. Wir tun einfach so, als wären das nicht unsere Kater.',
    hint: 'ZU ZWEIT',
  },
  {
    game: 'wimmel',
    title: 'Verloren in Hamburg!',
    trailer: 'Verloren in Hamburg!',
    bg: 'bg:k3',
    cast: [],
    intro: [
      { who: 'janni', text: 'Umsteigen in Hamburg! 45 Minuten Aufenthalt.' },
      { who: 'janni', text: 'Feli wollte nur kurz ein Franzbrötchen holen … und jetzt ist sie weg. Und die Kater auch.' },
      { who: 'janni', text: 'Finde Feli, Franks und Findi, bevor der Anschluss weg ist! (Ja, du suchst dich gerade selbst.)' },
    ],
    howto: ['Finde Feli, Franks und Findi im Gewimmel.', 'Zwei Finger = zoomen, ein Finger = verschieben.', '90 Sekunden. Ein Fehltipp kostet 3 Sekunden.'],
    outroWin: 'Alle wieder da! Feli hatte übrigens zwei Franzbrötchen. Für sich.',
    outroLose: 'Zeit um! Zum Glück haben die drei von selbst zum Gleis gefunden. Mit Franzbrötchen. Ohne mir eins mitzubringen.',
    hint: 'KÖLN',
  },
  {
    game: 'wordle',
    title: 'Perlen-Rätsel!',
    trailer: 'Perlen-Rätsel!',
    bg: 'bg:k4',
    cast: ['feli'],
    intro: [
      { who: 'janni', text: "Weiter geht's Richtung Westen. Zeit für Handarbeit." },
      { who: 'janni', text: 'Jede echte Swiftie weiß: Zu einem großen Abend gehört ein Freundschaftsarmband.' },
      { who: 'janni', text: 'Aber welches Wort kommt drauf? 5 Buchstaben. 6 Versuche. Kleiner Tipp: ein Ort, an dem man richtig laut sein darf.' },
    ],
    howto: ['Errate das Wort mit 5 Buchstaben. Du hast 6 Versuche.', 'Orange = richtiger Buchstabe, richtige Stelle.', 'Lila = Buchstabe kommt vor, aber woanders.', 'Grau = kommt nicht vor.'],
    outroWin: 'Schickes Armband. Ich hab auch eins gemacht. Da steht ‚JANNI‘ drauf. Für dich.',
    outroLose: 'Hm. Das Armband ist dann eher … abstrakt. Trägt man jetzt so. Sag ich.',
    hint: 'ARENA',
  },
  {
    game: 'handball',
    title: 'Siebenmeter!',
    trailer: 'Siebenmeter!',
    bg: 'bg:k5',
    cast: ['feli'],
    intro: [
      { who: 'janni', text: 'Angekommen! Aber vor dem großen Abend: Aufwärmen.' },
      { who: 'janni', text: 'Handballerin bleibt Handballerin. 5 Siebenmeter. Im Tor: ich.' },
      { who: 'janni', text: 'Ich hab extra trainiert.' },
      { note: 'Hat er nicht.' },
    ],
    howto: ['Wisch in Wurfrichtung aufs Tor.', 'Je länger der Wisch, desto härter der Wurf.', '5 Würfe. Du brauchst 3 Tore.'],
    outroWin: "Okay, ich geb's zu: Du bist besser. Das bleibt aber unter uns.",
    outroLose: 'HA! Gehalten! Das erzähl ich allen. Wirklich allen. Auch den Katern.',
    hint: '16.10.',
  },
  {
    game: 'lacher',
    title: 'Showtime!',
    trailer: 'Showtime!',
    bg: 'bg:k6',
    cast: ['feli'],
    intro: [
      { who: 'janni', text: 'Der große Abend! Die Halle ist voll, das Licht geht aus, die Stimmung kocht.' },
      { who: 'janni', text: 'Deine Aufgabe: Fang so viele Lacher wie möglich!' },
      { who: 'janni', text: 'Aber Finger weg von den faulen Tomaten. Die sind für mich.' },
    ],
    howto: ['Wisch über die Lacher, um sie zu fangen.', 'Goldene Lacher zählen dreifach.', '25 Punkte in 30 Sekunden.', 'Finger weg von den Tomaten: 3 Tomaten = verloren.'],
    outroWin: 'Was für ein Abend! … Moment. Welcher Abend eigentlich? Und wo? Zeit für das große Finale!',
    outroLose: 'Uff. So viele Tomaten. Trotzdem: Was für ein Abend! … Moment. Welcher eigentlich? Und wo? Zeit für das große Finale!',
    hint: 'COMEDY',
  },
];

export const FRAME = {
  won: 'Puzzleteil gewonnen!',
  lost: 'Teil verloren …',
  lostWord: 'PUFF!',
  next: 'Weiter',
  unknown: '???',
};

export const FINALE = {
  question: (won) => `Sechs Kapitel. ${won === 1 ? 'Ein Puzzleteil' : `${['Null', 'Ein', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs'][won]} Puzzleteile`}. Und jetzt die große Frage, Spatzl: Was ist dein Geschenk?`,
  answers: [
    { text: 'Ein Wochenende in Köln mit großer Comedy-Show', correct: true },
    { text: 'Ein dritter Kater', react: 'Franks und Findi schauen entsetzt.' },
    { text: 'Handball-Trainingslager mit Janni als Trainer', react: 'Fast! Aber nein …' },
    { text: 'Ein Jahresvorrat Franzbrötchen', react: 'Fast! Aber nein …' },
  ],
  wrong: 'Fast! Aber nein …',
  right: 'RICHTIG!!!',
  cannon: 'Achtung, Konfettikanone!',
  boom: 'BOOM!',
  wipe: 'Wisch das Konfetti weg!',
};

export const VOUCHER = {
  head: '🎟 GUTSCHEIN 🎟',
  title: '1LIVE Köln Comedy-Nacht XXL',
  sub: 'moderiert von Chris Tall · LANXESS Arena Köln',
  date: 'Samstag, 16.10.2027',
  times: 'Einlass 17:30 Uhr · Beginn 19:15 Uhr',
  seats: 'Preiskategorie 2 · Block 216 · Reihe 1 & 2 · jeweils Sitz 18',
  rows: [
    { icon: '🚆', label: 'Hinfahrt', text: 'Fr 15.10.2027 · Berlin Südkreuz 15:24 → Köln Hbf 21:46', small: 'ICE 508 bis Hamburg, ICE 1023 bis Köln' },
    { icon: '🚆', label: 'Rückfahrt', text: 'So 17.10.2027 · Köln Hbf 14:44 → Berlin Südkreuz 20:33', small: 'ICE 651 bis Berlin Hbf, ICE 607' },
    { icon: '🏨', label: 'Hotel', text: '2 Nächte in Köln (15.–17.10.)', small: 'wird noch verraten 🤫' },
  ],
  fine: ['Gültig nur mit Krone. Kater bleiben zu Hause.', 'In Liebe, dein Janni ❤️'],
  toHall: 'Zum Spielesaal',
  screenshot: 'Screenshot machen nicht vergessen 📸',
};

export const HALL = {
  title: 'Spielesaal',
  sub: 'Alle Spiele, so oft du willst.',
  intro: 'Intro nochmal ansehen',
  voucher: 'Gutschein',
  puzzle: 'Puzzle',
  again: 'Nochmal',
  back: 'Zum Spielesaal',
  locked: 'Teil fehlt noch',
  got: 'Teil gewonnen',
};

export const ROTATE = 'Bitte Handy drehen';
