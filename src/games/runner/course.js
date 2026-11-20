// Streckenbau: feste Liste aller Hindernisse und Leckerlis für einen Lauf, deterministisch aus rng.
// Anders als der Endlos-Spawner des Hochzeits-Runners wird die ganze Strecke vorab ausgelegt,
// die Fairness-Garantie (Mindestabstand in Sekunden Laufzeit) bleibt dieselbe.
// Ohne DOM; alle Zahlen (cfg) stehen in logic.js.

const EASY = ['laub', 'scooter', 'tonne'];

function pickKind(rng, pool, prev) {
  let kind = rng.pick(pool);
  for (let i = 0; i < 4 && kind === prev; i++) kind = rng.pick(pool);
  return kind;
}

/**
 * x eines Hindernisses = Streckenposition, an der seine linke Kante den Ankerpunkt des Gespanns
 * erreicht (gilt auch für Tauben, die dem Paar entgegenfliegen, siehe logic.js → screenX).
 */
export function layoutCourse(rng, cfg) {
  const { defs, length, firstAt, lastBeforeEnd, minGap, sweeperGap, count, pool, treat } = cfg;
  const n = rng.int(count[0], count[1]);

  // Zwei Kehrmaschinen: eine kurz vor der Mitte, eine im letzten Drittel.
  const s1 = rng.int(5, 6);
  const s2 = rng.int(n - 5, n - 3);
  const kinds = [];
  for (let i = 0; i < n; i++) {
    if (i === s1 || i === s2) kinds.push('kehrmaschine');
    else if (i === 0) kinds.push('laub');
    else kinds.push(pickKind(rng, i < 3 ? EASY : pool, kinds[i - 1]));
  }

  // Mindestabstände, dann den restlichen Platz zufällig auf die Lücken verteilen.
  const gaps = [0];
  let need = defs[kinds[0]].w;
  for (let i = 1; i < n; i++) {
    const big = kinds[i] === 'kehrmaschine' || kinds[i - 1] === 'kehrmaschine';
    gaps.push(minGap + (big ? sweeperGap : 0));
    need += gaps[i] + defs[kinds[i]].w;
  }
  const slack = Math.max(0, length - lastBeforeEnd - firstAt - need);
  const weights = gaps.map((_, i) => (i ? rng.range(0.3, 1) : 0));
  const sum = weights.reduce((a, b) => a + b, 0) + 0.5; // ein Rest bleibt vor dem Bahnhof frei

  const obstacles = [];
  const treats = [];
  let x = firstAt;
  for (let i = 0; i < n; i++) {
    const d = defs[kinds[i]];
    const extra = (slack * weights[i]) / sum;
    const gapStart = x;
    x += gaps[i] + extra;
    obstacles.push({ kind: kinds[i], x: Math.round(x), w: d.w, h: d.h, alt: d.alt ?? 0, drift: d.drift ?? 0 });

    // Leckerlis: Bogen über dem Hindernis (Sprung-Belohnung) …
    const mid = Math.round(x) + d.w / 2;
    if (d.double) {
      for (let k = -2; k <= 2; k++) treats.push({ x: mid + k * treat.spacing, alt: treat.sweeperTop - k * k * 10 });
    } else if (!d.drift && rng.chance(treat.arcChance)) {
      for (let k = -1; k <= 1; k++) treats.push({ x: mid + k * treat.spacing, alt: treat.arcTop - k * k * 14 });
    }
    // … und ab und zu eine Reihe zum Mitnehmen mitten in einer langen Lücke.
    if (i > 0 && gaps[i] + extra > treat.rowMinGap && rng.chance(treat.rowChance)) {
      const c = gapStart + (gaps[i] + extra) * 0.5;
      for (let k = -1; k <= 1; k++) treats.push({ x: Math.round(c + k * treat.spacing), alt: treat.rowAlt });
    }
    x = Math.round(x) + d.w;
  }
  treats.sort((a, b) => a.x - b.x);
  return { obstacles, treats, length };
}
