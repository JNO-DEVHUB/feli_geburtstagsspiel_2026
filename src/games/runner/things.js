// Hindernisse und Leckerlis: einmal als Sprite vorgerendert, im Lauf nur noch drawImage.
// Jede Zeichnung hat den Ursprung links unten an der Standfläche (y nach oben negativ).

import { TAU } from '../../core/math.js';
import { OBSTACLES } from './logic.js';
import { INK, LEAF_COLORS, box, disc, ink, label, leaf, limb, makeSprite, oval, poly, rr, stroke } from './pen.js';

const ORANGE = '#F07A1A';

function laub(g) {
  // lose Blätter am Rand
  leaf(g, 3, -3, 12, 0.3, LEAF_COLORS[1]);
  leaf(g, 55, -3, 12, -0.4, LEAF_COLORS[2]);
  g.beginPath();
  g.moveTo(3, 0);
  g.quadraticCurveTo(2, -16, 14, -20);
  g.quadraticCurveTo(20, -33, 32, -27);
  g.quadraticCurveTo(44, -31, 48, -18);
  g.quadraticCurveTo(58, -12, 55, 0);
  g.closePath();
  ink(g, '#E8892B', 4);
  const spots = [
    [14, -10, 15, -0.5, 1],
    [27, -19, 16, 0.4, 2],
    [40, -12, 15, -0.2, 4],
    [22, -6, 13, 0.9, 5],
    [34, -5, 13, -0.9, 1],
    [45, -6, 11, 0.5, 3],
    [31, -26, 11, 0.1, 1],
    [10, -4, 10, 0.2, 2],
  ];
  for (const [x, y, len, rot, c] of spots) leaf(g, x, y, len, rot, LEAF_COLORS[c], 1.5);
  // ein Blatt segelt gerade oben herunter
  leaf(g, 46, -31, 11, -0.7, LEAF_COLORS[0], 1.8);
}

function scooter(g) {
  // umgekippt: Trittbrett liegt schräg, Lenkstange ragt nach rechts oben
  disc(g, 11, -9, 8.5, '#3A3A44', 3.5);
  disc(g, 11, -9, 3, '#C9CED6', 0);
  limb(g, [14, -9, 50, -13], 7, '#35C2A8', 3);
  stroke(g, [22, -11.5, 42, -13.5], '#2A2A30', 2.5);
  disc(g, 56, -9, 8.5, '#3A3A44', 3.5);
  disc(g, 56, -9, 3, '#C9CED6', 0);
  limb(g, [54, -14, 65, -26], 4.5, '#D8DEE6', 2.6);
  limb(g, [59, -30, 71, -21], 4.5, '#2A2A30', 2.2);
  box(g, 26, -19, 13, 7, 2, '#FFFFFF', 2);
  stroke(g, [29, -15.5, 36, -15.5], ORANGE, 2.2);
}

function tonne(g) {
  disc(g, 11, -6, 6, '#3A3A44', 3);
  disc(g, 32, -6, 6, '#3A3A44', 3);
  // Laub quillt unter dem Deckel hervor
  leaf(g, 9, -54, 12, -0.5, LEAF_COLORS[1], 1.6);
  leaf(g, 22, -57, 13, 0.2, LEAF_COLORS[2], 1.6);
  leaf(g, 34, -54, 12, 0.6, LEAF_COLORS[3], 1.6);
  poly(g, [5, -50, 37, -50, 34, -5, 8, -5], ORANGE, 4);
  stroke(g, [13, -44, 14.5, -10], '#F9A45A', 3);
  stroke(g, [29, -44, 27.5, -10], '#D9651A', 3);
  box(g, 14, -38, 14, 15, 2, '#FFF4E2', 2);
  // Piktogramm: Männchen wirft etwas ein
  disc(g, 19, -33, 2, INK, 0);
  stroke(g, [19, -31, 19, -26, 23, -29], INK, 1.6);
  box(g, 2, -57, 38, 8, 3, '#D9651A', 4);
  box(g, 15, -61, 12, 5, 2, '#D9651A', 3);
}

function absperrung(g) {
  box(g, 3, -6, 20, 6, 2, '#6B6F7A', 3.5);
  box(g, 55, -6, 20, 6, 2, '#6B6F7A', 3.5);
  box(g, 10.5, -44, 5, 39, 1, '#D8DEE6', 3);
  box(g, 62.5, -44, 5, 39, 1, '#D8DEE6', 3);
  for (const [y, hgt] of [[-43, 13], [-25, 11]]) {
    g.save();
    rr(g, 3, y, 72, hgt, 2.5);
    g.clip();
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, y, 80, hgt);
    g.fillStyle = '#E5484D';
    for (let x = -12; x < 80; x += 18) {
      g.beginPath();
      g.moveTo(x, y + hgt);
      g.lineTo(x + 9, y + hgt);
      g.lineTo(x + 9 + hgt, y);
      g.lineTo(x + hgt, y);
      g.fill();
    }
    g.restore();
    box(g, 3, y, 72, hgt, 2.5, null, 3.5);
  }
  // Warnleuchte
  disc(g, 13, -48, 5.5, '#FFC233', 3);
  disc(g, 11.5, -49.5, 1.6, '#FFF4C2', 0);
}

function pretzel(g, x, y, s, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  const path = () => {
    g.beginPath();
    g.moveTo(-7, 8);
    g.bezierCurveTo(-16, -2, -10, -12, -1, -8);
    g.bezierCurveTo(6, -4, 2, 4, -4, 8);
    g.moveTo(7, 8);
    g.bezierCurveTo(16, -2, 10, -12, 1, -8);
    g.bezierCurveTo(-6, -4, -2, 4, 4, 8);
  };
  path();
  g.strokeStyle = INK;
  g.lineWidth = 7.5;
  g.lineCap = 'round';
  g.stroke();
  path();
  g.strokeStyle = '#B5651D';
  g.lineWidth = 4;
  g.stroke();
  for (const [sx, sy] of [[-8, -4], [8, -3], [0, -7], [-4, 5], [5, 5]]) disc(g, sx, sy, 0.9, '#FFF4E2', 0);
  g.restore();
}

function brezel(g) {
  // Handwagen mit Brezeln
  limb(g, [62, -26, 77, -36], 3.5, '#8A5A35', 2.4);
  box(g, 10, -30, 54, 20, 3, '#D39A56', 4);
  stroke(g, [10, -23, 64, -23], '#A9743C', 1.6);
  stroke(g, [10, -16.5, 64, -16.5], '#A9743C', 1.6);
  // rot-weißes Tuch
  g.save();
  rr(g, 8, -35, 58, 8, 2);
  g.clip();
  g.fillStyle = '#FFFFFF';
  g.fillRect(8, -35, 58, 8);
  g.fillStyle = '#E5484D';
  for (let x = 8; x < 66; x += 12) g.fillRect(x, -35, 6, 8);
  g.restore();
  box(g, 8, -35, 58, 8, 2, null, 3.5);
  for (const x of [22, 52]) {
    disc(g, x, -9, 9, '#8A5A35', 3.5);
    disc(g, x, -9, 5.4, '#E8C48E', 2);
    stroke(g, [x - 5, -9, x + 5, -9], INK, 1.4);
    stroke(g, [x, -14, x, -4], INK, 1.4);
    disc(g, x, -9, 1.8, INK, 0);
  }
  pretzel(g, 24, -42, 0.72, -0.25);
  pretzel(g, 50, -42, 0.72, 0.3);
  pretzel(g, 37, -43, 0.9, 0);
}

function taube(g, wingUp) {
  // fliegt nach links, dem Paar entgegen
  poly(g, [36, -13, 48, -18, 47, -8], '#7F8A9B', 3);
  if (!wingUp) {
    g.beginPath();
    g.moveTo(18, -10);
    g.quadraticCurveTo(26, 6, 36, 9);
    g.quadraticCurveTo(36, -4, 33, -12);
    g.closePath();
    ink(g, '#C3CAD6', 3);
  }
  oval(g, 25, -12, 15, 8.5, '#9AA3B2', 3.2, -0.08);
  oval(g, 15, -11, 6, 5, '#7BB59A', 0, -0.3);
  oval(g, 15.5, -8.5, 5, 3.4, '#A98BC7', 0, -0.3);
  poly(g, [4, -17, -3, -14.5, 4, -13], ORANGE, 2.4);
  disc(g, 10, -17, 7, '#8793A6', 3.2);
  disc(g, 8, -18.5, 2.4, '#FFFFFF', 0);
  disc(g, 7.4, -18.5, 1.2, INK, 0);
  if (wingUp) {
    g.beginPath();
    g.moveTo(17, -16);
    g.quadraticCurveTo(22, -36, 37, -42);
    g.quadraticCurveTo(39, -26, 34, -15);
    g.closePath();
    ink(g, '#C3CAD6', 3);
    stroke(g, [27, -30, 30, -20], '#8793A6', 1.6);
    stroke(g, [32, -34, 33, -22], '#8793A6', 1.6);
  }
}

function kehrmaschine(g) {
  // fährt nach links, dem Paar entgegen: vorn die Tellerbesen, darüber die Kabine
  const body = ORANGE;
  // Saugrohr hinten
  limb(g, [122, -126, 131, -138, 131, -96], 7, '#7A808C', 3);
  // Fahrwerk
  box(g, 14, -34, 116, 16, 4, '#5B5F6B', 4);
  // Kehrgutbehälter
  box(g, 58, -128, 74, 98, 10, body, 4.5);
  box(g, 61, -125, 68, 12, 6, '#F9A04A', 0);
  box(g, 58, -74, 74, 12, 0, '#FFFFFF', 3);
  label(g, 'KEHR-FORCE', 95, -94, 11.5, '#FFF4E2', { lw: 3 });
  label(g, 'BERLIN', 95, -53, 9, '#7A3D0A');
  // Kabine
  g.beginPath();
  g.moveTo(12, -32);
  g.lineTo(12, -84);
  g.quadraticCurveTo(14, -98, 24, -126);
  g.quadraticCurveTo(26, -131, 32, -131);
  g.lineTo(62, -131);
  g.lineTo(62, -32);
  g.closePath();
  ink(g, '#E56E12', 4.5);
  g.beginPath();
  g.moveTo(18, -84);
  g.quadraticCurveTo(20, -98, 28, -122);
  g.lineTo(55, -122);
  g.lineTo(55, -84);
  g.closePath();
  ink(g, '#BFE6F5', 3.2);
  // Fahrer mit Mütze
  disc(g, 41, -95, 8, '#E9B48E', 2.4);
  g.beginPath();
  g.arc(41, -97, 8.4, Math.PI, 0);
  g.closePath();
  ink(g, ORANGE, 2.4);
  stroke(g, [31, -97, 26, -96], INK, 2.4);
  disc(g, 38, -94, 1.1, INK, 0);
  stroke(g, [22, -90, 27, -116], 'rgba(255,255,255,.85)', 2.5);
  box(g, 12, -66, 50, 9, 0, '#FFFFFF', 3);
  // Scheinwerfer, Stoßstange
  disc(g, 16, -48, 5.5, '#FFE27A', 3);
  box(g, 6, -38, 14, 8, 3, '#5B5F6B', 3.5);
  // Rundumleuchte
  box(g, 34, -136, 16, 5, 2, '#5B5F6B', 3);
  g.beginPath();
  g.arc(42, -140, 6, Math.PI, 0);
  g.lineTo(48, -135);
  g.lineTo(36, -135);
  g.closePath();
  ink(g, '#FFC233', 3);
  // Räder
  for (const x of [42, 106]) {
    disc(g, x, -16, 16, '#33333B', 4);
    disc(g, x, -16, 7, '#C9CED6', 2.5);
    disc(g, x, -16, 2.2, INK, 0);
  }
  // Besenarm und Tellerbesen vorn, Walze in der Mitte
  limb(g, [20, -32, 8, -16], 5, '#7A808C', 2.6);
  for (const [x, rx] of [[9, 15], [74, 17]]) {
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.08 + (i / 8) * 0.84);
      stroke(g, [x + Math.cos(a) * rx * 0.5, -9, x + Math.cos(a) * rx * 1.08, -1 - Math.sin(a) * 1.5], '#3F6B8E', 2.4);
    }
    oval(g, x, -10, rx, 5, '#4E86B0', 3.2);
  }
}

function treat(g) {
  // Katzenleckerli: goldbrauner Knusperfisch
  poly(g, [23, -11, 33, -19, 33, -3], '#E39A3B', 3);
  oval(g, 14, -11, 13, 8.5, '#F5B94E', 3.2);
  g.beginPath();
  g.ellipse(14, -11, 13, 8.5, 0, 0.25, Math.PI - 0.25);
  g.lineTo(3, -9);
  g.fillStyle = 'rgba(201,118,43,.45)';
  g.fill();
  disc(g, 8, -13, 1.7, INK, 0);
  stroke(g, [15, -16, 18, -11, 15, -6], '#C9762B', 1.6);
  stroke(g, [20, -15, 22, -11, 20, -7], '#C9762B', 1.4);
  disc(g, 11, -16, 1.6, 'rgba(255,255,255,.9)', 0);
}

const ART = {
  laub: { draw: laub, pad: [4, 8, 4, 2] },
  scooter: { draw: scooter, pad: [4, 6, 4, 2] },
  tonne: { draw: tonne, pad: [4, 6, 4, 2] },
  absperrung: { draw: absperrung, pad: [4, 10, 4, 2] },
  brezel: { draw: brezel, pad: [4, 8, 4, 2] },
  kehrmaschine: { draw: kehrmaschine, pad: [12, 8, 6, 3] },
};

// pad = [links, oben, rechts, unten] Rand um die logische Größe w × h.
function thing(w, h, pad, res, draw) {
  const s = makeSprite(w + pad[0] + pad[2], h + pad[1] + pad[3], res, (g) => {
    g.translate(pad[0], pad[1] + h);
    draw(g);
  });
  s.ox = pad[0];
  s.oy = pad[1] + h;
  return s;
}

export function createThings(res) {
  const sprites = {};
  for (const [kind, a] of Object.entries(ART)) sprites[kind] = thing(OBSTACLES[kind].w, OBSTACLES[kind].h, a.pad, res, a.draw);
  const t = OBSTACLES.taube;
  sprites.taubeA = thing(t.w, t.h, [6, 20, 6, 14], res, (g) => taube(g, true));
  sprites.taubeB = thing(t.w, t.h, [6, 20, 6, 14], res, (g) => taube(g, false));
  sprites.treat = thing(34, 22, [3, 3, 3, 3], res, treat);

  return {
    sprites,
    // x = linke Kante, y = Standfläche (Bildschirm, Einheiten). time für kleine Animationen.
    drawObstacle(g, kind, x, y, time) {
      const s = kind === 'taube' ? (Math.floor(time * 9) % 2 ? sprites.taubeA : sprites.taubeB) : sprites[kind];
      const bob = kind === 'taube' ? Math.sin(time * 9) * 2.5 : 0;
      g.drawImage(s.c, x - s.ox, y - s.oy + bob, s.w, s.h);
      if (kind === 'kehrmaschine') {
        // Rundumleuchte blinkt, Besen wirbeln Staub auf
        const on = Math.floor(time * 5) % 2 === 0;
        if (on) {
          g.save();
          g.globalAlpha = 0.5;
          disc(g, x + 42, y - 141, 15, '#FFE27A', 0);
          g.globalAlpha = 1;
          disc(g, x + 42, y - 141, 5, '#FFF9DC', 0);
          g.restore();
        }
        g.save();
        for (let i = 0; i < 3; i++) {
          const ph = (time * 2.2 + i / 3) % 1;
          g.globalAlpha = 0.5 * (1 - ph);
          disc(g, x - 4 - ph * 26, y - 6 - ph * 16 - i * 3, 5 + ph * 8, '#E9DCC8', 0);
        }
        g.restore();
        // Besen dreht sich: wandernde helle Borste
        const a = (time * 14) % TAU;
        stroke(g, [x + 9, y - 10, x + 9 + Math.cos(a) * 13, y - 10 + Math.sin(a) * 4], '#BFE0F5', 2);
        stroke(g, [x + 74, y - 10, x + 74 + Math.cos(a + 2) * 15, y - 10 + Math.sin(a + 2) * 4], '#BFE0F5', 2);
      }
    },
    drawTreat(g, x, y, time, phase) {
      const s = sprites.treat;
      g.save();
      g.translate(x, y + Math.sin(time * 4 + phase) * 3);
      g.rotate(Math.sin(time * 3 + phase) * 0.18);
      g.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
      g.restore();
    },
  };
}
