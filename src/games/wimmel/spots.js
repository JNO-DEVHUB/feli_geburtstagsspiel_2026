// Verstecke im Wimmelbild k3_hamburg_wimmel.jpg. Alle Angaben in Bildkoordinaten (Pixel im 2496×1929-Bild).
//
//   x, y, w   linke obere Ecke und Breite der Figur (Zeichenfläche von charEl; Höhe: Mensch 1,5 × w, Kater 1,2 × w)
//   rot       leichte Drehung in Grad (um die Mitte der Zeichenfläche)
//   clip      Beschnitt-Polygon: Nur innerhalb ist die Figur zu sehen. Die Kanten folgen dem, wohinter sie steckt.
//   hit       Mitte des sichtbaren Teils und Treffer-Radius (auch Ort von Marker und Hinweis-Schimmer)
//   seen      Umriss dessen, was wirklich zu sehen ist (ausgemessen von der Browser-Probe, die auch prüft,
//             dass die Zahlen noch stimmen); daraus rechnen die Tests die sichtbare Größe auf dem Handy
//   filter    Farbton/Kontur, damit der Fotokopf zum Comic-Bild passt
//   glass     true: steht hinter einer Scheibe (etwas durchscheinend)
//   cut       optionaler Zuschnitt der Figur selbst (clip-path in ihrer Zeichenfläche), z. B. um den
//             mitfotografierten Schatten rechts an Franks' Kopf abzuschneiden
//
// Nach jeder Änderung: node scripts/games/wimmel.mjs und die Nahaufnahmen ansehen.

export const IMG = { w: 2496, h: 1929 };

const INK = '#3b2a22';
const outline = (px) => `drop-shadow(${px}px 0 0 ${INK}) drop-shadow(-${px}px 0 0 ${INK}) drop-shadow(0 ${px}px 0 ${INK}) drop-shadow(0 -${px}px 0 ${INK})`;

export const SPOTS = [
  {
    // Links: Feli hat ihr Franzbrötchen gefunden. Sie steht in der Bäckerbude hinter der Scheibe und dem Gebäck-Berg.
    key: 'feli',
    name: 'Feli',
    who: 'feli',
    outfit: 'braut',
    x: 310,
    y: 889,
    w: 170,
    rot: -3,
    clip: [[300, 900], [320, 899], [341, 897], [356, 886], [362, 872], [460, 872], [460, 1100], [428, 1100], [426, 1070], [420, 1057], [395, 1052], [392, 1040], [380, 1030], [330, 1030], [319, 1035], [310, 1031], [300, 1031]],
    hit: { x: 400, y: 965, r: 92 },
    seen: { x: 351, y: 887, w: 98, h: 213 },
    filter: `${outline(2)} saturate(0.95) brightness(0.98)`,
    glass: true,
  },
  {
    // Mitte: Franks thront auf dem Geschenkeberg und lugt zwischen roter und gelber Schleife hervor.
    key: 'franks',
    name: 'Franks',
    who: 'franks',
    outfit: 'default',
    x: 1497,
    y: 759,
    w: 235,
    rot: -3,
    clip: [[1500, 740], [1720, 740], [1720, 934], [1700, 916], [1701, 900], [1692, 888], [1678, 888], [1664, 900], [1656, 890], [1652, 876], [1640, 870], [1626, 872], [1620, 884], [1620, 896], [1612, 893], [1602, 893], [1600, 880], [1595, 868], [1578, 866], [1562, 878], [1560, 860], [1552, 853], [1543, 858], [1538, 878], [1525, 866], [1510, 868], [1503, 880], [1508, 898], [1500, 900]],
    hit: { x: 1605, y: 832, r: 92 },
    seen: { x: 1527, y: 766, w: 153, h: 130 },
    filter: `${outline(2)} saturate(1.05) contrast(1.05)`,
    cut: 'polygon(-10% -21.5%, 80.75% -21.5%, 80.75% 22.3%, 77% 28.55%, 76.6% 38.55%, 74% 43.55%, 68.75% 49.2%, 62% 53.55%, 59% 56.05%, 117.5% 56.05%, 117.5% 135%, -10% 135%)',
  },
  {
    // Rechts oben: Findi hockt hinter der blauen Anzeigetafel, zwischen den beiden Aufhänge-Stangen.
    key: 'findi',
    name: 'Findi',
    who: 'findi',
    outfit: 'default',
    x: 2020,
    y: 288,
    w: 240,
    rot: 2,
    clip: [[2030, 270], [2250, 270], [2250, 426], [2200, 426], [2200, 332], [2192, 332], [2192, 426], [2089, 426], [2089, 357], [2081, 357], [2081, 426], [2030, 426]],
    hit: { x: 2140, y: 358, r: 95 },
    seen: { x: 2068, y: 287, w: 144, h: 139 },
    filter: `${outline(2)} brightness(0.9) saturate(0.95)`,
    cut: 'polygon(-10% -21.5%, 78.1% -21.5%, 78.1% 28.55%, 74.75% 32.3%, 74.75% 38.55%, 80% 42.3%, 80% 135%, -10% 135%)',
  },
];

export const spotByKey = (key) => SPOTS.find((s) => s.key === key);
