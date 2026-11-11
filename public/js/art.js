// Product artwork, drawn in code. One flat object per product, in the product's own colour.
// The only saturated colour on a card is the product itself.

const INK = '#1f1b16';
const PAPER = '#fdfbf7';
const BG = '#f7f4ee';

function rgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join('');
}

function palette(base) {
  return {
    base,
    dark: mix(base, INK, 0.38),
    light: mix(base, '#ffffff', 0.38),
    ink: INK,
    paper: PAPER,
    tile: mix(base, BG, 0.84),
  };
}

const R = (x, y, w, h, rx, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const E = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const S = (d, stroke, w, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

const objects = {
  earphones: (c) =>
    E(82, 70, 13, 16, c.light) + R(90, 74, 6, 30, 3, c.light) +
    E(118, 70, 13, 16, c.light) + R(104, 74, 6, 30, 3, c.light) +
    R(58, 96, 84, 62, 24, c.base) + R(58, 96, 84, 22, 20, c.dark, 'opacity=".55"') + S('M58 118h84', c.dark, 2) + C(100, 138, 3, c.light),

  neckband: (c) =>
    S('M52 66C52 142 148 142 148 66', c.base, 10) + C(52, 62, 10, c.dark) + C(148, 62, 10, c.dark) +
    R(88, 124, 24, 12, 6, c.dark) + C(100, 130, 2, c.light),

  speaker: (c) =>
    S('M138 92q18 0 18 16t-18 16', c.dark, 4) + R(62, 54, 76, 104, 30, c.base) +
    [78, 90, 102, 114, 126, 138].map((y) => S(`M76 ${y}h48`, c.dark, 3, 'opacity=".4"')).join('') + C(100, 68, 4, c.light),

  boombox: (c) =>
    S('M62 70q38-36 76 0', c.dark, 6) + R(38, 68, 124, 72, 18, c.base) +
    C(74, 104, 22, c.dark) + C(74, 104, 13, c.base) + C(74, 104, 4, c.light) +
    C(126, 104, 22, c.dark) + C(126, 104, 13, c.base) + C(126, 104, 4, c.light),

  watch: (c) =>
    R(84, 24, 32, 152, 12, c.base) + R(142, 92, 6, 16, 3, c.light) +
    C(100, 100, 44, c.light) + C(100, 100, 36, c.ink) +
    S('M100 100V76', c.paper, 3) + S('M100 100l16 6', c.paper, 3) + C(100, 100, 3, c.paper),

  band: (c) =>
    R(80, 22, 40, 156, 20, c.base) + R(86, 62, 28, 76, 10, c.ink) +
    R(92, 82, 16, 4, 2, c.paper) + R(92, 94, 10, 4, 2, c.light) + C(100, 118, 4, c.base),

  powerbank: (c) =>
    R(90, 38, 20, 8, 3, c.dark) + R(64, 44, 72, 116, 14, c.base) + R(64, 90, 72, 20, 0, c.dark, 'opacity=".3"') +
    [80, 92, 104, 116].map((x) => C(x + 2, 138, 3, c.light)).join(''),

  kurta: (c) =>
    P('M72 26L88 20Q100 34 112 20L128 26L146 38L158 108L142 112L130 62V164H70V62L58 112L42 108L54 38Z', c.base) +
    S('M100 34V96', c.dark, 2) + [46, 58, 70].map((y) => C(100, y, 2.5, c.light)).join('') +
    S('M88 20Q100 34 112 20', c.dark, 3) + R(70, 156, 60, 8, 0, c.dark, 'opacity=".3"') +
    R(42, 104, 16, 8, 0, c.dark, 'opacity=".3"') + R(142, 104, 16, 8, 0, c.dark, 'opacity=".3"'),

  shirt: (c) =>
    P('M70 44L90 36L100 50L110 36L130 44L160 66L146 92L132 82V154H68V82L54 92L40 66Z', c.base) +
    P('M90 36L100 50L92 62L78 46Z', c.light) + P('M110 36L100 50L108 62L122 46Z', c.light) +
    S('M100 52V154', c.dark, 2) + [76, 96, 116, 136].map((y) => C(100, y, 2.5, c.light)).join(''),

  tee: (c) =>
    P('M72 40Q100 58 128 40L160 62L146 88L132 80V158H68V80L54 88L40 62Z', c.base) +
    S('M72 40Q100 58 128 40', c.dark, 4) + R(68, 150, 64, 8, 0, c.dark, 'opacity=".25"'),

  sneaker: (c) =>
    R(34, 118, 134, 16, 8, c.paper) +
    P('M40 120V86Q40 76 52 78L92 92Q106 70 120 72Q152 80 166 114V122H40Z', c.base) +
    S('M96 90l10 8M106 84l10 8M116 80l10 8', c.paper, 3) + S('M54 104Q100 112 156 102', c.dark, 3) + R(34, 130, 134, 4, 2, c.dark, 'opacity=".25"'),

  bag: (c) =>
    S('M88 52q12-24 24 0', c.dark, 5) + R(60, 50, 80, 110, 28, c.base) +
    R(72, 100, 56, 46, 14, c.dark, 'opacity=".55"') + S('M72 100h56', c.light, 2) + C(100, 100, 3, c.light) +
    R(54, 84, 8, 40, 4, c.dark) + R(138, 84, 8, 40, 4, c.dark),

  duffel: (c) =>
    S('M70 78q30-36 60 0', c.dark, 6) + R(32, 76, 136, 70, 30, c.base) +
    S('M40 102h120', c.dark, 3) + R(118, 110, 36, 28, 10, c.dark, 'opacity=".55"') + C(100, 102, 3, c.light),

  kettle: (c) =>
    S('M66 86Q38 92 44 128Q50 144 72 142', c.dark, 8) +
    P('M130 86L158 62L164 70L138 108Z', c.base) +
    P('M62 152L72 76Q100 64 128 76L138 152Z', c.base) + E(100, 72, 30, 9, c.light) + C(100, 58, 6, c.dark) +
    R(58, 148, 84, 12, 6, c.dark) + S('M84 100l-4 40', c.light, 3, 'opacity=".6"'),

  bottle: (c) =>
    R(78, 56, 44, 104, 18, c.base) + R(84, 36, 32, 26, 6, c.dark) + R(78, 108, 44, 14, 0, c.light, 'opacity=".55"') +
    S('M88 76v24', c.light, 3, 'opacity=".6"'),

  lamp: (c) =>
    E(100, 158, 34, 8, c.dark) + S('M100 154V104L128 70', c.dark, 6) +
    P('M114 58L158 72L146 100L104 84Z', c.base) + C(118, 100, 6, c.light) + P('M104 84L146 100L142 108L100 92Z', c.dark, 'opacity=".45"'),

  mug: (c) =>
    S('M126 90q30 0 30 24t-30 24', c.base, 12) + R(56, 70, 72, 80, 16, c.base) + E(92, 70, 36, 8, c.dark) +
    R(56, 104, 72, 12, 0, c.light, 'opacity=".6"'),

  jar: (c) =>
    R(64, 60, 72, 100, 18, c.light, 'opacity=".5"') + R(70, 104, 60, 50, 12, c.base) + R(80, 118, 40, 22, 4, c.paper) +
    R(60, 44, 80, 22, 7, c.dark),

  tawa: (c) =>
    R(148, 102, 44, 12, 6, c.dark) + C(94, 108, 60, c.dark) + C(94, 108, 50, c.base, 'opacity=".55"') +
    C(94, 108, 50, 'none', `stroke="${c.light}" stroke-width="2" opacity=".35"`) + C(186, 108, 3, BG),

  tiffin: (c) =>
    S('M72 56Q100 22 128 56', c.dark, 4) + R(60, 54, 80, 14, 6, c.dark) +
    R(62, 66, 76, 30, 8, c.base) + R(62, 98, 76, 30, 8, c.light) + R(62, 130, 76, 30, 8, c.base) +
    S('M60 100v26', c.dark, 3),

  serum: (c) =>
    P('M92 74V48Q100 30 108 48V74Z', c.dark) + R(88, 70, 24, 18, 4, c.dark) +
    R(72, 86, 56, 74, 16, c.base) + R(82, 108, 36, 32, 4, c.paper) + S('M88 120h24M88 128h14', c.dark, 2.5, 'opacity=".6"'),

  tube: (c) =>
    P('M70 50L130 50L124 140L76 140Z', c.base) + R(70, 40, 60, 12, 2, c.dark) + R(78, 138, 44, 20, 5, c.dark) +
    R(84, 72, 32, 44, 4, c.paper) + S('M90 86h20M90 96h12', c.dark, 2.5, 'opacity=".6"'),

  trimmer: (c) =>
    R(80, 40, 40, 120, 18, c.base) + R(72, 24, 56, 22, 4, c.light) +
    [78, 86, 94, 102, 110, 118, 126].map((x) => R(x - 2, 14, 3, 12, 1, c.dark)).join('') +
    C(100, 92, 7, c.light) + R(92, 124, 16, 4, 2, c.dark) + R(92, 134, 10, 4, 2, c.dark, 'opacity=".5"'),

  mat: (c) =>
    R(48, 74, 104, 56, 0, c.base) + E(48, 102, 14, 28, c.light) + E(48, 102, 9, 18, c.base) + E(48, 102, 4, 8, c.dark) +
    E(152, 102, 14, 28, c.base) + R(94, 74, 12, 56, 0, c.dark, 'opacity=".7"'),

  dumbbell: (c) =>
    R(66, 94, 68, 12, 4, c.light) +
    R(40, 70, 28, 60, 8, c.base) + R(28, 82, 14, 36, 6, c.dark) +
    R(132, 70, 28, 60, 8, c.base) + R(158, 82, 14, 36, 6, c.dark),

  rope: (c) =>
    S('M52 102C52 26 148 26 148 102', c.dark, 3) +
    R(42, 100, 20, 56, 9, c.base) + R(42, 100, 20, 12, 6, c.dark) +
    R(138, 100, 20, 56, 9, c.base) + R(138, 100, 20, 12, 6, c.dark),

  bat: (c) =>
    `<g transform="rotate(32 100 100)">` +
    R(92, 22, 16, 44, 6, c.dark) + R(92, 30, 16, 5, 0, c.light, 'opacity=".5"') + R(92, 42, 16, 5, 0, c.light, 'opacity=".5"') +
    R(76, 62, 48, 92, 10, c.light) + S('M100 66v84', c.base, 3, 'opacity=".5"') + R(76, 140, 48, 14, 7, c.base, 'opacity=".5"') + `</g>`,

  notebook: (c) =>
    R(58, 40, 88, 120, 6, c.base) + R(58, 40, 14, 120, 6, c.dark) + R(86, 66, 44, 26, 3, c.paper) +
    R(126, 40, 5, 120, 0, c.dark, 'opacity=".55"') + P('M112 160V176L118 170L124 176V160Z', c.light),

  pen: (c) =>
    `<g transform="rotate(-48 100 100)">` + R(92, 28, 16, 112, 8, c.light) + P('M92 138H108L100 164Z', c.dark) + R(92, 108, 16, 8, 0, c.dark) + `</g>` +
    `<g transform="rotate(-34 100 100)">` + R(92, 24, 16, 120, 8, c.base) + P('M92 142H108L100 170Z', c.dark) + R(108, 36, 4, 38, 2, c.light) + R(92, 112, 16, 8, 0, c.light) + `</g>`,

  book: (c) =>
    R(54, 38, 92, 124, 4, c.base) + R(58, 154, 84, 8, 0, c.paper) + R(54, 38, 12, 124, 4, c.dark) +
    C(104, 96, 16, 'none', `stroke="${c.paper}" stroke-width="3"`) + R(82, 126, 44, 5, 2, c.paper) + R(90, 136, 28, 5, 2, c.paper, 'opacity=".6"'),
};

export function drawObject(type, color) {
  const c = palette(color);
  return (objects[type] || objects.book)(c);
}

// A full square tile: tinted ground, soft contact shadow, the object.
export function artSvg(type, color, label = '') {
  const c = palette(color);
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${label.replace(/"/g, '&quot;')}" preserveAspectRatio="xMidYMid slice">
    <rect width="200" height="200" fill="${c.tile}"/>
    <ellipse cx="100" cy="164" rx="48" ry="6" fill="${INK}" opacity="0.1"/>
    ${(objects[type] || objects.book)(c)}
  </svg>`;
}

export function tileColor(color) {
  return palette(color).tile;
}

// The hero: a shelf in a shop, four real products from the catalogue.
export function shelfScene(items) {
  const wall = '#d9e4df';
  const board = '#b99b78';
  const boardDark = '#9c7f5e';
  const top = 452; // top edge of the shelf board
  const pos = [
    { x: 6, s: 0.94, dy: 0 },
    { x: 138, s: 1.02, dy: -6 },
    { x: 288, s: 0.96, dy: 0 },
    { x: 410, s: 0.92, dy: 9 },
  ];
  const objs = items
    .slice(0, 4)
    .map((it, i) => {
      const { x, s, dy } = pos[i];
      const c = palette(it.color);
      const y = top - 160 * s + 4 + dy;
      return `<ellipse cx="${x + 100 * s}" cy="${top + 1}" rx="${46 * s}" ry="4" fill="${INK}" opacity=".16"/>` +
        `<g transform="translate(${x} ${y}) scale(${s})">${(objects[it.art] || objects.book)(c)}</g>`;
    })
    .join('');
  return `<svg viewBox="0 0 600 640" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A shop shelf with a steel bottle, a reading lamp, a kettle and a mug">
    <rect width="600" height="640" fill="${wall}"/>
    <rect y="${top}" width="600" height="18" fill="${board}"/>
    <rect y="${top + 18}" width="600" height="6" fill="${boardDark}"/>
    <rect y="${top + 24}" width="600" height="${640 - top - 24}" fill="${mix(wall, INK, 0.05)}"/>
    ${objs}
  </svg>`;
}
