// Figuren nach dem Bobblehead-Prinzip: gezeichneter Comic-Körper (SVG) plus Fotokopf.
// Eine Definition, zwei Ausgaben:
//   charEl(...)          DOM-Element für Story, Karte, Rahmen, Finale
//   createCharSprite(...) Canvas-Zeichner für die Spiele (Körper als Bild, Kopf wackelt separat)

const INK = '#3B2A22';
const SKIN = '#F1C6A3';
const S = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;

// Geometrie: Menschen 200×300, Hals bei (100,168). Kater 200×240, Hals bei (100,128).
export const GEOM = {
  human: { w: 200, h: 300, neck: [100, 168], head: 172 },
  cat: { w: 200, h: 240, neck: [100, 128], head: 150 },
};
const HEAD_SCALE = { feli: 1.16, janni: 1, franks: 1, findi: 1 };
export const isCat = (who) => who === 'franks' || who === 'findi';

const legs = (color, shoe, y = 232) =>
  `<path d="M82 ${y}v46M118 ${y}v46" fill="none" stroke="${INK}" stroke-width="27" stroke-linecap="round"/>` +
  `<path d="M82 ${y}v46M118 ${y}v46" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round"/>` +
  `<ellipse cx="77" cy="287" rx="17" ry="9" fill="${shoe}" ${S}/><ellipse cx="123" cy="287" rx="17" ry="9" fill="${shoe}" ${S}/>`;

const arm = (d, color, hand = SKIN) => {
  const end = d.trim().split(/[ ,]+/).slice(-2);
  return (
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${end[0]}" cy="${end[1]}" r="10" fill="${hand}" ${S}/>`
  );
};

const torso = (fill, extra = '') => `<path d="M66 176q34-16 68 0l6 62q-40 12-80 0z" fill="${fill}" ${S}/>${extra}`;

const BODIES = {
  'janni:anzug': ({ mic = true } = {}) =>
    legs('#D9C3A0', '#5A3A2A') +
    arm('M70 184 52 214 58 240', '#D9C3A0') +
    torso('#D9C3A0', `<path d="M88 170l12 34 12-34z" fill="#fff" ${S}/><path d="M100 204v36" stroke="${INK}" stroke-width="3"/><circle cx="100" cy="216" r="3" fill="${INK}"/><circle cx="100" cy="230" r="3" fill="${INK}"/><path d="M84 176l16 8 16-8v16l-16-8-16 8z" fill="#F07A1A" ${S}/>`) +
    (mic
      ? arm('M132 184 152 208 146 182', '#D9C3A0') + `<path d="M146 184 150 158" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M146 184 150 158" stroke="#666" stroke-width="5" stroke-linecap="round"/><circle cx="151" cy="150" r="12" fill="#2b2b2e" ${S}/>`
      : arm('M132 184 148 214 142 240', '#D9C3A0')),
  'janni:torwart': () =>
    legs(SKIN, '#F07A1A', 240) +
    `<path d="M68 226h64l4 30h-30l-6-14-6 14H64z" fill="#1d1d1f" ${S}/>` +
    arm('M70 182 36 168 14 146', '#FFD23F', '#fff') +
    arm('M130 182 164 168 186 146', '#FFD23F', '#fff') +
    torso('#3F9B5A', `<text x="100" y="222" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="30" text-anchor="middle" fill="#fff">1</text>`),
  'feli:braut': () =>
    legs('#FFFDF8', '#fff') +
    arm('M70 184 52 212 60 238', '#FFFDF8') +
    arm('M130 184 148 212 140 238', '#FFFDF8') +
    torso('#FFFDF8', `<path d="M86 172l14 30 14-30" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M100 202v38" stroke="${INK}" stroke-width="3"/><circle cx="118" cy="194" r="6" fill="#F07A1A" ${S}/>`),
  'feli:trikot': () =>
    legs(SKIN, '#fff', 240) +
    `<path d="M68 226h64l4 30h-30l-6-14-6 14H64z" fill="#1d1d1f" ${S}/>` +
    arm('M70 182 50 208 56 232', SKIN) +
    arm('M130 182 150 208 144 232', SKIN) +
    torso('#1d1d1f', `<path d="M66 176l-4 16 12 6zM134 176l4 16-12 6z" fill="#E5484D" ${S}/><path d="M64 214l74 0" stroke="#E5484D" stroke-width="7"/><text x="100" y="210" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="30" text-anchor="middle" fill="#fff">23</text>`),
  'feli:show': () =>
    legs('#2b2230', '#F07A1A') +
    arm('M70 184 50 208 44 180', '#F07A1A') +
    arm('M130 184 150 208 156 180', '#F07A1A') +
    torso('#F07A1A', `<path d="M86 172l14 26 14-26" fill="#2b2230" ${S}/><circle cx="80" cy="212" r="3" fill="#FFD23F"/><circle cx="122" cy="204" r="3" fill="#FFD23F"/><circle cx="110" cy="228" r="3" fill="#FFD23F"/><circle cx="90" cy="232" r="3" fill="#FFD23F"/>`),
};
BODIES['janni:kanone'] = () => BODIES['janni:anzug']({ mic: false });
BODIES['feli:default'] = BODIES['feli:braut'];
BODIES['janni:default'] = BODIES['janni:anzug'];

const catBody = (fur, dark, paws, stripes) =>
  `<path d="M140 206q46 6 36-40" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M140 206q46 6 36-40" fill="none" stroke="${fur}" stroke-width="13" stroke-linecap="round"/>` +
  `<ellipse cx="100" cy="182" rx="50" ry="50" fill="${fur}" ${S}/>` +
  (stripes ? `<path d="M56 168q10 6 16 0M54 190q10 6 18 0M144 168q-10 6-16 0M146 190q-10 6-18 0" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>` : '') +
  `<ellipse cx="100" cy="190" rx="27" ry="36" fill="#fff"/>` +
  `<ellipse cx="78" cy="226" rx="17" ry="11" fill="${paws}" ${S}/><ellipse cx="122" cy="226" rx="17" ry="11" fill="${paws}" ${S}/>`;
BODIES['franks:default'] = () => catBody('#E8702A', '#C2551A', '#E8702A', false);
BODIES['findi:default'] = () => catBody('#8E8E93', '#5E5E64', '#fff', true);

function geom(who) {
  return isCat(who) ? GEOM.cat : GEOM.human;
}

// Kopf-Rechteck im Körper-Koordinatensystem.
// opts.headScale / opts.headDy: Kopf größer bzw. tiefer setzen (z. B. Kater in den Story-Szenen).
export function headBox(assets, who, opts = {}) {
  const gm = geom(who);
  const size = gm.head * (HEAD_SCALE[who] ?? 1) * (opts.headScale ?? 1);
  const [nx, ny] = assets.neck(who);
  return { x: gm.neck[0] - nx * size, y: gm.neck[1] - ny * size + 8 + (opts.headDy ?? 0), size, neck: gm.neck };
}

export function bodyMarkup(who, outfit = 'default', opts) {
  return (BODIES[`${who}:${outfit}`] ?? BODIES[`${who}:default`])(opts);
}

// Vollständige Figur als SVG-Markup (Kopf als <image>).
export function charSvg(assets, who, outfit = 'default', opts = {}) {
  const gm = geom(who);
  const hb = headBox(assets, who, opts);
  return (
    `<svg class="char-svg" viewBox="0 0 ${gm.w} ${gm.h}" aria-hidden="true">${bodyMarkup(who, outfit, opts)}` +
    `<g class="char-head" style="transform-origin:${hb.neck[0]}px ${hb.neck[1]}px"><image href="${assets.url('head:' + who)}" x="${hb.x}" y="${hb.y}" width="${hb.size}" height="${hb.size}"/></g></svg>`
  );
}

// DOM-Element; Größe per CSS (Breite setzen, Höhe folgt dem Seitenverhältnis).
export function charEl(assets, who, outfit = 'default', opts = {}) {
  const el = document.createElement('div');
  el.className = `char char-${who}${opts.className ? ' ' + opts.className : ''}`;
  el.dataset.who = who;
  el.innerHTML = charSvg(assets, who, outfit, opts);
  return el;
}

// Nur der Kopf als DOM-Element (für Icons, Suchkarten, Katzen im Meowdoku).
export function headEl(assets, who, className = '') {
  const img = document.createElement('img');
  img.className = `head head-${who} ${className}`.trim();
  img.alt = '';
  img.draggable = false;
  img.src = assets.url('head:' + who);
  return img;
}

// Canvas-Zeichner. draw(g, x, footY, height, { headRot, rot, flip, squash, alpha })
// x = Mitte der Figur, footY = Unterkante. Der Kopf dreht sich um den Hals (Wackelkopf).
export function createCharSprite(assets, who, outfit = 'default', opts = {}) {
  const gm = geom(who);
  const body = new Image();
  const ready = new Promise((resolve) => {
    body.onload = body.onerror = () => resolve();
    body.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${gm.w * 2}" height="${gm.h * 2}" viewBox="0 0 ${gm.w} ${gm.h}">${bodyMarkup(who, outfit, opts)}</svg>`);
  });
  return {
    ready,
    aspect: gm.w / gm.h,
    draw(g, x, footY, height, { headRot = 0, rot = 0, flip = false, squash = 0, alpha = 1, headless = false } = {}) {
      const k = height / gm.h;
      const hb = headBox(assets, who);
      g.save();
      g.translate(x, footY);
      if (rot) g.rotate(rot);
      g.scale((flip ? -1 : 1) * k * (1 - squash * 0.6), k * (1 + squash));
      g.translate(-gm.w / 2, -gm.h);
      g.globalAlpha *= alpha;
      if (body.complete && body.naturalWidth) g.drawImage(body, 0, 0, gm.w, gm.h);
      if (!headless) {
        g.translate(hb.neck[0], hb.neck[1]);
        g.rotate(headRot);
        g.drawImage(assets.img('head:' + who), hb.x - hb.neck[0], hb.y - hb.neck[1], hb.size, hb.size);
      }
      g.restore();
    },
  };
}
