// Das Gespann: weißes Hochzeitspferd mit Blumengirlande, darauf Feli (vorn, weißer Hosenanzug)
// und Janni (hinten, beiger Anzug, orange Fliege). Körper prozedural, Köpfe als Fotos, die wie
// Wackelköpfe federn. Angelehnt an render/couple.js und render/mounts.js des Hochzeits-Runners.
// Koordinaten: Ursprung am Boden unter der Rumpfmitte, x nach vorn (rechts), y nach oben negativ.

import { TAU, clamp, lerp } from '../../core/math.js';
import { INK, disc, flower, ink, limb, oval, poly, stroke } from './pen.js';

const WHITE = '#FFFDF8';
const SHADE = '#DDD2C4';
const CREAM = '#F7E2B4';
const SKIN = '#F1C6A3';
const BEIGE = '#D9C3A0';
const ORANGE = '#F07A1A';
const GOLD = '#FFC233';

export const GESPANN_SCALE = 0.9;
const REAR_LEAN = 0.38; // so weit steigt das Pferd beim Jubeln im Bahnhof (Bogenmaß)
// Nüstern (für Schnauben) relativ zum Anker, bereits skaliert.
export const NOSE = Object.freeze({ x: 100 * GESPANN_SCALE, y: -124 * GESPANN_SCALE });

const L1 = 34;
const L2 = 30;
const HIND = [-38, -66];
const FRONT = [38, -68];
const FLOWERS = [
  [27, -107, ORANGE],
  [37, -103, '#FFFFFF'],
  [46, -96, '#FF8FAB'],
  [53, -87, GOLD],
  [57, -76, ORANGE],
  [57, -65, '#FFFFFF'],
];

const spring = () => ({ a: 0, va: 0, y: 0, vy: 0 });
const leg = () => ({ a1: 0, a2: 0, pts: [0, 0, 0, 0, 0, 0] });
const ease = (t) => t * t * (3 - 2 * t);
const tailPts = new Float32Array(44);

function bodyPath(g) {
  g.beginPath();
  g.moveTo(30, -107);
  g.bezierCurveTo(8, -111, -30, -113, -52, -99);
  g.bezierCurveTo(-69, -89, -67, -62, -50, -54);
  g.bezierCurveTo(-30, -46, 20, -44, 40, -52);
  g.bezierCurveTo(58, -58, 64, -80, 57, -94);
  g.bezierCurveTo(50, -104, 40, -107, 30, -107);
  g.closePath();
}

function neckPath(g) {
  g.beginPath();
  g.moveTo(20, -98);
  g.bezierCurveTo(32, -126, 44, -148, 58, -160);
  g.lineTo(64, -165);
  g.bezierCurveTo(76, -164, 90, -150, 100, -137);
  g.bezierCurveTo(108, -130, 108, -117, 99, -114);
  g.bezierCurveTo(90, -111, 82, -115, 77, -123);
  g.bezierCurveTo(73, -129, 70, -132, 67, -130);
  g.bezierCurveTo(66, -114, 64, -96, 59, -80);
  g.lineTo(26, -80);
  g.closePath();
}

function earPath(g, dx) {
  g.beginPath();
  g.moveTo(56 + dx, -160);
  g.quadraticCurveTo(52 + dx, -180, 62 + dx, -184);
  g.quadraticCurveTo(68 + dx, -174, 67 + dx, -162);
  g.closePath();
}

// Band entlang einer Bézierkurve mit Breitenprofil (Schweif).
function ribbon(g, x0, y0, x1, y1, x2, y2, x3, y3, wide) {
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const m = 1 - t;
    const px = m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3;
    const py = m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3;
    let tx = 3 * m * m * (x1 - x0) + 6 * m * t * (x2 - x1) + 3 * t * t * (x3 - x2);
    let ty = 3 * m * m * (y1 - y0) + 6 * m * t * (y2 - y1) + 3 * t * t * (y3 - y2);
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const hw = wide * (0.45 + 0.75 * Math.sin(Math.PI * Math.pow(t, 0.75))) * (t > 0.85 ? (1 - t) / 0.15 * 0.8 + 0.2 : 1);
    tailPts[i * 4] = px - ty * hw;
    tailPts[i * 4 + 1] = py + tx * hw;
    tailPts[i * 4 + 2] = px + ty * hw;
    tailPts[i * 4 + 3] = py - tx * hw;
  }
  g.beginPath();
  g.moveTo(tailPts[0], tailPts[1]);
  for (let i = 1; i < n; i++) g.lineTo(tailPts[i * 4], tailPts[i * 4 + 1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(tailPts[i * 4 + 2], tailPts[i * 4 + 3]);
  g.closePath();
}

export function createGespann(assets) {
  const s = {
    t: 0,
    run: 0,
    air: 0,
    brace: 0,
    rear: 0,
    squash: 0,
    sulk: 0,
    happy: 0,
    heads: [spring(), spring()],
    legs: [leg(), leg(), leg(), leg()], // hinten fern, vorn fern, hinten nah, vorn nah
    step: 0,
  };

  function legPose(L, phase, front, p) {
    const sn = Math.sin(phase);
    const cs = Math.cos(phase);
    const fold = cs > 0 ? cs : 0;
    let a1 = front ? 0.72 * sn + 0.05 : 0.66 * sn - 0.12;
    let a2 = front ? a1 - 1.25 * fold : a1 + 0.42 - 1.15 * fold;
    if (s.air > 0.01) {
      const f = clamp(0.5 - p.v / 800, 0, 1); // 0 steigt, 1 fällt
      const b1 = front ? lerp(1.15, 0.8, f) : lerp(-0.95, 0.35, f);
      const b2 = front ? lerp(-0.85, 0.5, f) : lerp(-0.55, -0.75, f);
      a1 = lerp(a1, b1, s.air);
      a2 = lerp(a2, b2, s.air);
    }
    if (s.brace > 0.01) {
      a1 = lerp(a1, front ? 0.52 : 0.3, s.brace);
      a2 = lerp(a2, front ? 0.56 : 0.56, s.brace);
    }
    if (s.rear > 0.01) {
      const paw = Math.sin(s.t * 11 + (front ? phase : 0)) * 0.22;
      a1 = lerp(a1, front ? 1.35 + paw : 0.38, s.rear);
      a2 = lerp(a2, front ? -0.35 + paw * 2 : 0.82, s.rear);
    }
    L.a1 = a1;
    L.a2 = a2;
  }

  function legPoints(L, hip, dx) {
    const kx = hip[0] + dx + Math.sin(L.a1) * L1;
    const ky = hip[1] + Math.cos(L.a1) * L1;
    L.pts[0] = hip[0] + dx;
    L.pts[1] = hip[1];
    L.pts[2] = kx;
    L.pts[3] = ky;
    L.pts[4] = kx + Math.sin(L.a2) * L2;
    L.pts[5] = ky + Math.cos(L.a2) * L2;
  }

  function hoof(g, L) {
    oval(g, L.pts[4] + Math.sin(L.a2) * 3, L.pts[5] + Math.cos(L.a2) * 3, 7.6, 5.6, '#E3B23C', 3, -L.a2);
  }

  function headImg(g, who, nx, ny, size, st) {
    const [ax, ay] = assets.neck(who);
    size *= assets.headZoom?.(who) ?? 1; // aufbereitete Köpfe haben einen Rand für die Kontur
    g.save();
    g.translate(nx, ny + st.y);
    g.rotate(st.a);
    g.drawImage(assets.img('head:' + who), -ax * size, -ay * size, size, size);
    g.restore();
  }

  return {
    state: s,
    onJump() {
      s.squash = -0.6;
      for (const h of s.heads) h.vy += 40;
    },
    onDoubleJump() {
      s.squash = -0.4;
      s.heads[0].va -= 2.5;
      s.heads[1].va -= 3.5;
    },
    onLand(impact = 1) {
      s.squash = Math.max(s.squash, 0.55 + 0.45 * impact);
      s.heads[0].vy += 70 * impact + 30;
      s.heads[1].vy += 90 * impact + 30;
      s.heads[0].va += 1.6;
      s.heads[1].va -= 1.2;
    },
    onHit() {
      s.heads[0].va += 5;
      s.heads[1].va -= 4;
      s.heads[0].vy -= 50;
      s.heads[1].vy -= 40;
    },

    // Liefert true, wenn in diesem Frame ein Huf aufsetzt (für Hufschlag und Staub).
    update(dt, w) {
      const p = w.player;
      s.t += dt;
      const pace = w.speed / 250;
      const before = s.run;
      s.run += dt * (p.grounded ? (pace * TAU) / 0.46 : 2.2);
      const k = Math.min(1, dt * 12);
      s.air += ((p.grounded ? 0 : 1) - s.air) * k;
      const over = w.phase !== 'run';
      const lost = w.phase === 'lost';
      const braking = over && (lost || !w.stopped);
      s.brace += ((braking ? 1 : 0) - s.brace) * Math.min(1, dt * 10);
      s.rear += ((w.phase === 'won' && w.stopped ? 1 : 0) - s.rear) * Math.min(1, dt * 6);
      s.sulk += ((lost ? 1 : 0) - s.sulk) * Math.min(1, dt * 8);
      s.happy += ((w.phase === 'won' ? 1 : 0) - s.happy) * Math.min(1, dt * 8);
      s.squash += (0 - s.squash) * Math.min(1, dt * 9);

      // Wackelköpfe: gedämpfte Federn, angeregt vom Galopp, vom Steigen und Fallen
      for (let i = 0; i < 2; i++) {
        const h = s.heads[i];
        let target = p.grounded ? Math.sin(s.run + i * 1.4) * 0.07 * Math.min(1, pace) : clamp(-p.v / 900, -1, 1) * 0.13;
        if (lost) target = i ? -0.2 : 0.22;
        if (s.rear > 0.5) target = Math.sin(s.t * 9 + i * 2) * 0.12;
        h.va += ((target - h.a) * 170 - h.va * 7.5) * dt;
        h.a = clamp(h.a + h.va * dt, -0.6, 0.6);
        h.vy += (-h.y * 260 - h.vy * 10) * dt;
        h.y = clamp(h.y + h.vy * dt, -8, 12);
      }
      // Hufschlag: zweimal je Galoppsprung
      const beat = Math.floor((s.run / TAU) * 2);
      const stepped = p.grounded && !over && beat !== Math.floor((before / TAU) * 2);
      return stepped;
    },

    /**
     * g in Einheiten, (x, gy) = Ankerpunkt am Boden. w = Welt (für Höhe, Drehung, Zustand).
     */
    draw(g, x, gy, w) {
      const p = w.player;
      const t = s.t;
      const grounded = p.grounded;
      const bob = grounded ? -Math.abs(Math.sin(s.run)) * 3 * (1 - s.brace) * (1 - s.rear) : 0;
      const pitch = clamp(-p.v / 2600, -0.26, 0.3) * s.air;
      const spin = p.spin > 0 ? ease(p.spin) * TAU : 0;

      g.save();
      g.translate(x, gy - p.alt);
      g.scale(GESPANN_SCALE * (1 + s.squash * 0.07), GESPANN_SCALE * (1 - s.squash * 0.11));
      // Bremsen und Steigen drehen um die Hinterhufe, Flug und Doppelsprung um die Körpermitte
      g.translate(-42, 0);
      g.rotate(-s.brace * 0.09 - s.rear * REAR_LEAN);
      g.translate(42, bob + s.brace * 6);
      g.translate(0, -95);
      g.rotate(pitch + spin);
      g.translate(0, 95);

      const [hf, ff, hn, fn] = s.legs;
      legPose(hf, s.run + 0.9, false, p);
      legPose(ff, s.run + Math.PI * 0.9 + 0.9, true, p);
      legPose(hn, s.run, false, p);
      legPose(fn, s.run + Math.PI * 0.9, true, p);
      legPoints(hf, HIND, 9);
      legPoints(ff, FRONT, 8);
      legPoints(hn, HIND, 0);
      legPoints(fn, FRONT, 0);

      // Schweif mit Schleife
      const fly = s.air * 0.8 + (1 - s.brace) * 0.2;
      const w1 = Math.sin(t * 8) * 5;
      const w2 = Math.sin(t * 8 - 1.2) * 8;
      const w3 = Math.sin(t * 8 - 2.4) * 11;
      ribbon(g, -54, -94, -80, -112 + w1, -106 - fly * 8, -92 + w2 - fly * 14, -112 - fly * 22 + w3 * 0.4, -50 + w3 - fly * 26, 11);
      ink(g, CREAM, 4.2);
      g.beginPath();
      g.moveTo(-70, -104 + w1 * 0.5);
      g.quadraticCurveTo(-96, -96 + w2 * 0.7, -104 - fly * 14, -66 + w3 * 0.7 - fly * 18);
      g.strokeStyle = 'rgba(59,42,34,.28)';
      g.lineWidth = 1.8;
      g.stroke();

      // ferne Beine
      limb(g, hf.pts, 9.5, SHADE, 4);
      hoof(g, hf);
      limb(g, ff.pts, 9.5, SHADE, 4);
      hoof(g, ff);
      earPath(g, 7);
      ink(g, SHADE, 4);

      // Rumpf, Hals, Kopf und nahe Beine als eine Silhouette: erst alle Konturen, dann alle Flächen
      g.strokeStyle = INK;
      g.lineWidth = 9;
      g.lineJoin = 'round';
      bodyPath(g);
      g.stroke();
      neckPath(g);
      g.stroke();
      earPath(g, 0);
      g.stroke();
      stroke(g, hn.pts, INK, 19);
      stroke(g, fn.pts, INK, 19);
      g.fillStyle = WHITE;
      bodyPath(g);
      g.fill();
      neckPath(g);
      g.fill();
      earPath(g, 0);
      g.fill();
      stroke(g, hn.pts, WHITE, 10.5);
      stroke(g, fn.pts, WHITE, 10.5);
      hoof(g, hn);
      hoof(g, fn);
      // Schatten am Bauch, Andeutung von Schulter und Kruppe
      g.save();
      bodyPath(g);
      g.clip();
      oval(g, -4, -42, 62, 13, SHADE, 0);
      g.restore();
      g.strokeStyle = 'rgba(59,42,34,.26)';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(44, -98);
      g.quadraticCurveTo(32, -82, 40, -64);
      g.moveTo(-24, -102);
      g.quadraticCurveTo(-12, -80, -32, -60);
      g.stroke();
      oval(g, 63, -170, 2.2, 6, '#F3B7B0', 0, 0.2);

      // Gesicht
      oval(g, 87, -130, 7, 4.5, 'rgba(255,143,171,.55)', 0, 0.5);
      if (s.happy > 0.5) {
        g.beginPath();
        g.arc(77, -146, 4.6, Math.PI * 1.05, Math.PI * 1.95);
        ink(g, null, 2.8);
      } else {
        oval(g, 77, -147, 3.6, 4.8, INK, 0, 0.3);
        disc(g, 78.2, -148.8, 1.3, '#FFFFFF', 0);
        if (s.sulk > 0.5) stroke(g, [70, -156, 82, -152], INK, 3);
      }
      oval(g, 101, -124, 1.7, 2.4, INK, 0, 0.4);
      g.beginPath();
      if (s.sulk > 0.5) {
        g.moveTo(102, -116);
        g.quadraticCurveTo(95, -119, 88, -116);
      } else {
        g.moveTo(103, -119);
        g.quadraticCurveTo(96, -113, 88, -118);
      }
      ink(g, null, 2.4);
      // Zaumzeug
      stroke(g, [91, -146, 88, -116], ORANGE, 3.4);
      stroke(g, [90, -140, 70, -133, 62, -160], ORANGE, 3);
      disc(g, 89.5, -127, 2.6, GOLD, 1.6);

      // Mähne: Büschel entlang des Kamms, Schopf über der Stirn
      const mane = [
        [57, -159, 13],
        [49, -148, 14],
        [42, -135, 14],
        [35, -122, 13],
        [29, -110, 11],
      ];
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < mane.length; i++) {
          const [mx, my, len] = mane[i];
          const rot = 2.5 + Math.sin(t * 9 - i * 0.9) * 0.2 - s.air * 0.25;
          g.beginPath();
          g.ellipse(mx + Math.cos(rot) * len * 0.55, my + Math.sin(rot) * len * 0.55, len, 6.2, rot, 0, TAU);
          if (pass === 0) ink(g, null, 7.6);
          else ink(g, CREAM, 0);
        }
      }
      g.beginPath();
      g.moveTo(60, -166);
      g.quadraticCurveTo(74, -168, 78, -156 + Math.sin(t * 9) * 1.5);
      g.quadraticCurveTo(68, -158, 61, -158);
      g.closePath();
      ink(g, CREAM, 3.2);

      // Satteldecke
      g.beginPath();
      g.moveTo(-46, -108);
      g.quadraticCurveTo(-10, -114, 26, -108);
      g.lineTo(23, -80);
      g.quadraticCurveTo(-10, -72, -43, -80);
      g.closePath();
      ink(g, ORANGE, 3.6);
      g.beginPath();
      g.moveTo(-41, -85);
      g.quadraticCurveTo(-10, -78, 21, -85);
      g.strokeStyle = GOLD;
      g.lineWidth = 3;
      g.stroke();

      // Blumengirlande um den Hals
      for (const [fx, fy, c] of FLOWERS) flower(g, fx, fy, 6.2, c, c === GOLD ? ORANGE : GOLD);

      // Schleife am Schweifansatz
      poly(g, [-56, -96, -70, -108, -68, -90], ORANGE, 3);
      poly(g, [-56, -96, -52, -112, -44, -100], ORANGE, 3);
      disc(g, -55, -97, 4, '#FF9A45', 2.6);

      // --- Janni (hinten) ---
      const post = grounded ? -Math.abs(Math.sin(s.run + 0.7)) * 2.2 * (1 - s.brace) : 0;
      const hj = s.heads[1];
      const hfeli = s.heads[0];
      g.save();
      g.translate(0, post);
      limb(g, [-34, -103, -19, -86, -27, -64], 10, BEIGE, 3);
      oval(g, -24, -60, 9, 5.5, '#5A3A2A', 3, -0.2);
      g.beginPath();
      g.moveTo(-48, -103);
      g.bezierCurveTo(-52, -126, -51, -146, -45, -155);
      g.quadraticCurveTo(-36, -160, -27, -155);
      g.bezierCurveTo(-21, -146, -21, -126, -24, -103);
      g.closePath();
      ink(g, BEIGE, 3.6);
      poly(g, [-42, -156, -36, -134, -30, -156], '#FFFFFF', 2.2);
      stroke(g, [-36, -134, -36, -106], INK, 1.8);
      disc(g, -36, -124, 1.5, INK, 0);
      disc(g, -36, -114, 1.5, INK, 0);
      limb(g, [-36, -148, -36, -156 + hj.y * 0.4], 8, SKIN, 2.4);
      headImg(g, 'janni', -36, -155, 100, hj);
      // Fliege sitzt vor dem Kinn
      poly(g, [-36, -152, -47, -158, -47, -146], ORANGE, 2.4);
      poly(g, [-36, -152, -25, -158, -25, -146], ORANGE, 2.4);
      disc(g, -36, -152, 3, '#FF9A45', 2);
      g.restore();

      // --- Feli (vorn) ---
      const post2 = grounded ? -Math.abs(Math.sin(s.run + 0.2)) * 2.2 * (1 - s.brace) : 0;
      g.save();
      g.translate(0, post2);
      limb(g, [8, -103, 25, -87, 18, -64], 9.5, WHITE, 3);
      oval(g, 21, -60, 8.5, 5.2, WHITE, 3, -0.2);
      g.beginPath();
      g.moveTo(-3, -103);
      g.bezierCurveTo(-7, -124, -6, -140, 0, -148);
      g.quadraticCurveTo(8, -153, 17, -148);
      g.bezierCurveTo(23, -140, 23, -124, 20, -103);
      g.closePath();
      ink(g, WHITE, 3.6);
      g.beginPath();
      g.moveTo(2, -149);
      g.lineTo(9, -128);
      g.lineTo(15, -149);
      ink(g, null, 2);
      stroke(g, [9, -128, 9, -106], INK, 1.6);
      disc(g, 17, -132, 3.4, ORANGE, 1.8);
      g.restore();
      // Jannis Arm hält Feli fest
      limb(g, [-27, -146 + post, -12, -126 + post, 4, -120 + post2], 8.5, BEIGE, 2.8);
      disc(g, 5, -120 + post2, 4.8, SKIN, 2.4);
      // Felis Arm mit Zügel
      g.beginPath();
      g.moveTo(40, -117 + post2);
      g.quadraticCurveTo(64, -102, 89, -124);
      g.strokeStyle = '#8A5A35';
      g.lineWidth = 2.6;
      g.stroke();
      limb(g, [14, -141 + post2, 26, -125 + post2, 39, -118 + post2], 8, WHITE, 2.8);
      disc(g, 40, -118 + post2, 4.6, SKIN, 2.4);
      limb(g, [8, -143 + post2, 8, -149 + post2 + hfeli.y * 0.4], 7, SKIN, 2.4);
      headImg(g, 'feli', 8, -148 + post2, 116, hfeli);

      g.restore();
    },
  };
}
