// Procedural art: every fruit, bomb and special item is drawn here into cached sprites.
import { TAU, rand } from './util.js';

export const INK = '#2a1533';
// Soft edge for realistic fruit (no cartoon outline).
const EDGE = 'rgba(28,14,24,0.42)';

// s: size factor of base radius. rx/ry: shape ratio. juice: splat + droplet color.
export const FRUITS = {
  apple:      { s: 1.0,  rx: 1.03, ry: 0.95, juice: '#ffe7a0', name: 'Apple' },
  orange:     { s: 0.98, rx: 1.0,  ry: 0.98, juice: '#ff9a1f', name: 'Orange' },
  lemon:      { s: 0.9,  rx: 1.15, ry: 0.85, juice: '#ffe83a', name: 'Lemon' },
  lime:       { s: 0.82, rx: 1.0,  ry: 0.96, juice: '#9be24a', name: 'Lime' },
  watermelon: { s: 1.28, rx: 1.3,  ry: 1.05, juice: '#ff3355', name: 'Watermelon' },
  kiwi:       { s: 0.88, rx: 1.08, ry: 0.88, juice: '#8fd14f', name: 'Kiwi' },
  peach:      { s: 1.0,  rx: 1.0,  ry: 0.97, juice: '#ffb347', name: 'Peach' },
  plum:       { s: 0.84, rx: 0.95, ry: 1.0,  juice: '#e0457b', name: 'Plum' },
  coconut:    { s: 1.08, rx: 1.0,  ry: 0.96, juice: '#fffaf0', name: 'Coconut' },
  dragon:     { s: 1.05, rx: 0.92, ry: 1.1,  juice: '#ff2d8f', name: 'Dragon Fruit' },
  mango:      { s: 1.05, rx: 1.15, ry: 0.88, juice: '#ffb020', name: 'Mango' },
  // Power-up fruits (Arcade).
  frost:      { s: 1.0,  rx: 1.0,  ry: 1.0,  juice: '#9fe8ff', name: 'Frostberry', power: 'frost' },
  blaze:      { s: 1.0,  rx: 0.95, ry: 1.05, juice: '#ff5a1f', name: 'Blazefig', power: 'frenzy' },
  gold:       { s: 0.95, rx: 1.0,  ry: 1.0,  juice: '#ffd84a', name: 'Goldenberry', power: 'double' },
  // Not sliceable into halves.
  bomb:       { s: 0.95, rx: 1.0,  ry: 1.0,  juice: '#ffffff', name: 'Bomb', bomb: true },
  gourd:      { s: 2.4,  rx: 1.08, ry: 0.98, juice: '#ffc23a', name: 'Grand Gourd' },
};

export const NORMAL_FRUITS = ['apple', 'orange', 'lemon', 'lime', 'watermelon', 'kiwi', 'peach', 'plum', 'coconut', 'dragon', 'mango'];

export const POWER_COLORS = {
  frost: { a: '#7fe3ff', b: '#2a8bff', label: 'FREEZE' },
  frenzy: { a: '#ffb13a', b: '#ff3a1a', label: 'FRENZY' },
  double: { a: '#ffe36b', b: '#ffae00', label: 'DOUBLE' },
};

function makeCanvas(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.translate(w / 2, h / 2);
  return [c, ctx];
}

function ellipsePath(ctx, rx, ry, x = 0, y = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
}

// Fill the current path with an elliptical radial gradient.
function fillEll(ctx, rx, ry, stops, ox = 0, oy = 0) {
  ctx.save();
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(ox, oy / (ry / rx), 0, 0, 0, rx);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

// Outline then fill so the visible outline sits outside the body.
function bodyFill(ctx, path, rx, ry, stops, lw) {
  path();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw * 1.1;
  ctx.strokeStyle = EDGE;
  ctx.stroke();
  fillEll(ctx, rx, ry, stops);
}

function clipTo(ctx, path) {
  path();
  ctx.clip();
}

function teardrop(ctx, x, y, len, wid, ang, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, -len / 2);
  ctx.quadraticCurveTo(wid, len * 0.2, 0, len / 2);
  ctx.quadraticCurveTo(-wid, len * 0.2, 0, -len / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function leaf(ctx, x, y, len, ang, lw, color = '#5ccf4a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.lineWidth = lw;
  ctx.strokeStyle = EDGE;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(len * 0.1, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.strokeStyle = 'rgba(20,80,20,0.5)';
  ctx.lineWidth = lw * 0.5;
  ctx.stroke();
  ctx.restore();
}

function stem(ctx, x1, y1, x2, y2, cx, cy, w, color = '#5a3418') {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = w + 1.5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function sparkle(ctx, x, y, s, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    ctx.lineTo(Math.cos(a + TAU / 8) * s * 0.28, Math.sin(a + TAU / 8) * s * 0.28);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function citrusFlesh(ctx, rx, ry, lw, rind, rindDark, pith, seg, segDark, n = 10) {
  ellipsePath(ctx, rx, ry);
  ctx.lineWidth = lw * 1.1;
  ctx.strokeStyle = EDGE;
  ctx.stroke();
  fillEll(ctx, rx, ry, [[0, rind], [1, rindDark]]);
  ellipsePath(ctx, rx * 0.88, ry * 0.88);
  ctx.fillStyle = pith;
  ctx.fill();
  ctx.save();
  ctx.scale(1, ry / rx);
  const R = rx * 0.82;
  const gap = 0.06;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + gap;
    const a1 = ((i + 1) / n) * TAU - gap;
    ctx.beginPath();
    ctx.moveTo(Math.cos((a0 + a1) / 2) * R * 0.1, Math.sin((a0 + a1) / 2) * R * 0.1);
    ctx.arc(0, 0, R, a0, a1);
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    g.addColorStop(0, seg);
    g.addColorStop(1, segDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let k = 0; k < 3; k++) {
      const a = a0 + (a1 - a0) * (0.3 + k * 0.2);
      const d = R * (0.45 + k * 0.13);
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, R * 0.06, R * 0.025, a, 0, TAU);
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.08, 0, TAU);
  ctx.fillStyle = pith;
  ctx.fill();
  ctx.restore();
}

function dots(ctx, rx, ry, n, size, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 0.92;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rx * d, Math.sin(a) * ry * d, size * rand(0.6, 1.2), 0, TAU);
    ctx.fill();
  }
}

// ---------- Skin painters: (ctx, rx, ry, lw) ----------
const SKIN = {
  apple(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#ff6a6a'], [0.55, '#d81a33'], [1, '#7e0a1e']], lw);
    ctx.save();
    clipTo(ctx, p);
    let ag = ctx.createRadialGradient(-rx * 0.45, ry * 0.45, 0, -rx * 0.45, ry * 0.45, rx * 0.8);
    ag.addColorStop(0, 'rgba(255,190,70,0.45)');
    ag.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = ag;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    dots(ctx, rx, ry, 45, rx * 0.018, 'rgba(255,225,170,0.4)');
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffd0a0';
    ctx.lineWidth = rx * 0.04;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * rx * 0.08, -ry * 0.75);
      ctx.quadraticCurveTo(i * rx * 0.5, 0, i * rx * 0.2, ry * 0.95);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ellipsePath(ctx, rx * 0.22, ry * 0.08, 0, -ry * 0.8);
    ctx.fillStyle = 'rgba(90,0,20,0.5)';
    ctx.fill();
    ctx.restore();
    stem(ctx, 0, -ry * 0.78, rx * 0.12, -ry * 1.2, rx * 0.02, -ry * 1.05, rx * 0.09);
    leaf(ctx, rx * 0.08, -ry * 1.02, rx * 0.5, -0.45, lw * 0.8);
  },
  orange(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#ffc56b'], [0.6, '#ff9419'], [1, '#d06000']], lw);
    ctx.save();
    clipTo(ctx, p);
    dots(ctx, rx, ry, 70, rx * 0.025, 'rgba(170,70,0,0.28)');
    dots(ctx, rx, ry, 30, rx * 0.02, 'rgba(255,230,180,0.25)');
    ctx.restore();
    ctx.beginPath();
    ctx.arc(rx * 0.05, -ry * 0.82, rx * 0.09, 0, TAU);
    ctx.fillStyle = '#6b8e23';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
  },
  lemon(ctx, rx, ry, lw) {
    const p = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.93, ry, 0, 0, TAU);
      ctx.moveTo(rx * 1.02, 0);
      ctx.ellipse(rx * 0.9, 0, rx * 0.12, ry * 0.2, 0, 0, TAU);
      ctx.moveTo(-rx * 0.78, 0);
      ctx.ellipse(-rx * 0.9, 0, rx * 0.12, ry * 0.2, 0, 0, TAU);
    };
    bodyFill(ctx, p, rx, ry, [[0, '#fff7a0'], [0.6, '#ffdc1a'], [1, '#d4a400']], lw);
    ctx.save();
    clipTo(ctx, p);
    dots(ctx, rx, ry, 60, rx * 0.022, 'rgba(170,130,0,0.25)');
    ctx.restore();
  },
  lime(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#c4f57a'], [0.6, '#5fc93a'], [1, '#2f7d1c']], lw);
    ctx.save();
    clipTo(ctx, p);
    dots(ctx, rx, ry, 60, rx * 0.025, 'rgba(20,80,10,0.25)');
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, -ry * 0.85, rx * 0.08, 0, TAU);
    ctx.fillStyle = '#9a7b2a';
    ctx.fill();
  },
  watermelon(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#6fd46a'], [0.7, '#2f9a3a'], [1, '#1c6b28']], lw);
    ctx.save();
    clipTo(ctx, p);
    ctx.strokeStyle = '#174d1f';
    ctx.lineCap = 'round';
    for (let k = -3; k <= 3; k++) {
      const y0 = k * ry * 0.3;
      ctx.lineWidth = ry * 0.13;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = -rx + t * rx * 2;
        const y = y0 * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx))) * 1.05 + Math.sin(t * 18 + k) * ry * 0.035;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  },
  kiwi(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#c0915f'], [0.7, '#93653d'], [1, '#6b4526']], lw);
    ctx.save();
    clipTo(ctx, p);
    ctx.lineCap = 'round';
    for (let i = 0; i < 160; i++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random());
      const x = Math.cos(a) * rx * d, y = Math.sin(a) * ry * d;
      const b = rand(0, TAU), l = rx * rand(0.04, 0.08);
      ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(60,35,15,0.4)' : 'rgba(230,200,150,0.25)';
      ctx.lineWidth = rx * 0.015;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l);
      ctx.stroke();
    }
    ctx.restore();
  },
  peach(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#ffe2b8'], [0.5, '#ffab70'], [1, '#e2574c']], lw);
    ctx.save();
    clipTo(ctx, p);
    const g = ctx.createRadialGradient(rx * 0.35, ry * 0.25, 0, rx * 0.35, ry * 0.25, rx * 0.8);
    g.addColorStop(0, 'rgba(230,40,70,0.55)');
    g.addColorStop(1, 'rgba(230,40,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    ctx.strokeStyle = 'rgba(150,40,40,0.55)';
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.1, -ry * 0.98);
    ctx.quadraticCurveTo(-rx * 0.5, 0, -rx * 0.08, ry * 0.98);
    ctx.stroke();
    ctx.restore();
    leaf(ctx, -rx * 0.05, -ry * 0.92, rx * 0.5, -0.7, lw * 0.8, '#66c94e');
  },
  plum(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#cf95ee'], [0.6, '#8137b5'], [1, '#4a1470']], lw);
    ctx.save();
    clipTo(ctx, p);
    dots(ctx, rx, ry, 40, rx * 0.03, 'rgba(255,255,255,0.1)');
    ctx.strokeStyle = 'rgba(40,0,60,0.45)';
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(rx * 0.05, -ry * 0.95);
    ctx.quadraticCurveTo(rx * 0.45, 0, rx * 0.05, ry * 0.95);
    ctx.stroke();
    ctx.restore();
    stem(ctx, 0, -ry * 0.92, -rx * 0.1, -ry * 1.18, -rx * 0.02, -ry * 1.08, rx * 0.07);
  },
  coconut(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#a8713f'], [0.7, '#7a4a22'], [1, '#4f2e12']], lw);
    ctx.save();
    clipTo(ctx, p);
    ctx.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random());
      const x = Math.cos(a) * rx * d, y = Math.sin(a) * ry * d;
      const b = rand(-0.5, 0.5) + Math.PI / 2, l = rx * rand(0.12, 0.3);
      ctx.strokeStyle = Math.random() < 0.6 ? 'rgba(40,20,5,0.4)' : 'rgba(210,160,100,0.25)';
      ctx.lineWidth = rx * 0.02;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l);
      ctx.stroke();
    }
    ctx.fillStyle = '#2e1a0a';
    for (const [x, y] of [[-0.16, -0.5], [0.16, -0.5], [0, -0.3]]) {
      ctx.beginPath();
      ctx.ellipse(x * rx, y * ry, rx * 0.08, ry * 0.07, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  dragon(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    // Leafy scale flaps that stick out of the body.
    const flaps = [];
    for (let i = 0; i < 7; i++) flaps.push((i / 7) * TAU + 0.3);
    const at = (a, d) => [Math.cos(a) * rx * d, Math.sin(a) * ry * d];
    for (const a of flaps) {
      const [b1x, b1y] = at(a - 0.32, 0.82);
      const [b2x, b2y] = at(a + 0.32, 0.82);
      const [tx, ty] = at(a + 0.3, 1.24);
      const [c1x, c1y] = at(a - 0.12, 1.2);
      const [c2x, c2y] = at(a + 0.42, 0.98);
      const [bx, by] = at(a, 0.8);
      ctx.beginPath();
      ctx.moveTo(b1x, b1y);
      ctx.quadraticCurveTo(c1x, c1y, tx, ty);
      ctx.quadraticCurveTo(c2x, c2y, b2x, b2y);
      ctx.closePath();
      ctx.lineWidth = lw * 1.6;
      ctx.strokeStyle = EDGE;
      ctx.stroke();
      const g = ctx.createLinearGradient(bx, by, tx, ty);
      g.addColorStop(0, '#f02c8c');
      g.addColorStop(0.65, '#ff6fb5');
      g.addColorStop(1, '#a6e04a');
      ctx.fillStyle = g;
      ctx.fill();
    }
    bodyFill(ctx, p, rx, ry, [[0, '#ff86c6'], [0.6, '#ee1f86'], [1, '#a0105a']], lw);
    ctx.save();
    clipTo(ctx, p);
    for (let i = 0; i < 7; i++) {
      const a = rand(0, TAU), d = rand(0.1, 0.6);
      const x = Math.cos(a) * rx * d, y = Math.sin(a) * ry * d;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand(0, TAU));
      ctx.beginPath();
      ctx.moveTo(-rx * 0.16, 0);
      ctx.quadraticCurveTo(0, -ry * 0.12, rx * 0.22, -ry * 0.02);
      ctx.quadraticCurveTo(0, ry * 0.08, -rx * 0.16, 0);
      ctx.fillStyle = 'rgba(255,170,215,0.9)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rx * 0.2, -ry * 0.02, rx * 0.04, 0, TAU);
      ctx.fillStyle = '#a6e04a';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
  mango(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#ffe56a'], [0.5, '#ffb42a'], [1, '#e8662a']], lw);
    ctx.save();
    clipTo(ctx, p);
    let g = ctx.createRadialGradient(-rx * 0.55, -ry * 0.35, 0, -rx * 0.55, -ry * 0.35, rx * 0.9);
    g.addColorStop(0, 'rgba(110,190,60,0.85)');
    g.addColorStop(1, 'rgba(110,190,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    g = ctx.createRadialGradient(rx * 0.45, ry * 0.2, 0, rx * 0.45, ry * 0.2, rx * 0.7);
    g.addColorStop(0, 'rgba(235,50,60,0.6)');
    g.addColorStop(1, 'rgba(235,50,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    dots(ctx, rx, ry, 30, rx * 0.015, 'rgba(255,255,220,0.4)');
    ctx.restore();
    stem(ctx, -rx * 0.88, -ry * 0.2, -rx * 1.08, -ry * 0.45, -rx * 1.0, -ry * 0.28, rx * 0.07, '#4e7a2a');
  },
  frost(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#ffffff'], [0.35, '#c9f3ff'], [0.75, '#5ccbff'], [1, '#2a6fd6']], lw);
    ctx.save();
    clipTo(ctx, p);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * rx, Math.sin(a) * ry);
      ctx.lineTo(Math.cos(a + 0.35) * rx, Math.sin(a + 0.35) * ry);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    for (const [x, y, s] of [[-0.4, 0.3, 0.16], [0.35, 0.4, 0.12], [0.45, -0.25, 0.1], [-0.1, 0.6, 0.09]]) {
      snowflake(ctx, x * rx, y * ry, s * rx, 'rgba(255,255,255,0.95)', lw * 0.45);
    }
    leaf(ctx, 0, -ry * 0.95, rx * 0.45, -0.6, lw * 0.8, '#3fd6c6');
    leaf(ctx, 0, -ry * 0.95, rx * 0.45, -2.5, lw * 0.8, '#3fd6c6');
  },
  blaze(ctx, rx, ry, lw) {
    const p = () => {
      ctx.beginPath();
      ctx.moveTo(0, -ry * 1.08);
      ctx.bezierCurveTo(rx * 0.35, -ry * 0.75, rx * 1.05, -ry * 0.25, rx * 0.98, ry * 0.25);
      ctx.bezierCurveTo(rx * 0.9, ry * 0.85, rx * 0.4, ry * 1.0, 0, ry * 1.0);
      ctx.bezierCurveTo(-rx * 0.4, ry * 1.0, -rx * 0.9, ry * 0.85, -rx * 0.98, ry * 0.25);
      ctx.bezierCurveTo(-rx * 1.05, -ry * 0.25, -rx * 0.35, -ry * 0.75, 0, -ry * 1.08);
      ctx.closePath();
    };
    bodyFill(ctx, p, rx, ry, [[0, '#fff38a'], [0.4, '#ffa21f'], [0.8, '#ff4a1a'], [1, '#b5120f']], lw);
    ctx.save();
    clipTo(ctx, p);
    ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      ctx.strokeStyle = i % 2 ? 'rgba(255,240,140,0.55)' : 'rgba(190,20,10,0.35)';
      ctx.lineWidth = rx * 0.07;
      ctx.beginPath();
      ctx.moveTo(i * rx * 0.25, ry);
      ctx.quadraticCurveTo(i * rx * 0.35 + rx * 0.1, 0, i * rx * 0.08, -ry * 0.9);
      ctx.stroke();
    }
    ctx.restore();
    stem(ctx, 0, -ry * 1.02, rx * 0.1, -ry * 1.25, rx * 0.12, -ry * 1.1, rx * 0.08, '#7a3a12');
  },
  gold(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    bodyFill(ctx, p, rx, ry, [[0, '#fffbe0'], [0.3, '#ffe066'], [0.72, '#e0a800'], [1, '#8a5a00']], lw);
    ctx.save();
    clipTo(ctx, p);
    ctx.strokeStyle = 'rgba(255,255,230,0.6)';
    ctx.lineWidth = rx * 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.7, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,70,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.72, Math.PI * 0.1, Math.PI * 0.45);
    ctx.stroke();
    ctx.restore();
    sparkle(ctx, rx * 0.35, ry * 0.3, rx * 0.22);
    sparkle(ctx, -rx * 0.3, ry * 0.45, rx * 0.12);
    stem(ctx, 0, -ry * 0.92, rx * 0.12, -ry * 1.2, rx * 0.02, -ry * 1.1, rx * 0.08, '#6a4a10');
    leaf(ctx, rx * 0.06, -ry * 1.05, rx * 0.45, -0.4, lw * 0.8, '#7bd34e');
  },
  bomb(ctx, rx, ry, lw) {
    const p = () => ellipsePath(ctx, rx, ry);
    // Fuse.
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -ry * 1.05);
    ctx.quadraticCurveTo(rx * 0.05, -ry * 1.4, rx * 0.32, -ry * 1.42);
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = rx * 0.14;
    ctx.stroke();
    ctx.strokeStyle = '#d9b77a';
    ctx.lineWidth = rx * 0.07;
    ctx.stroke();
    // Cap.
    ctx.beginPath();
    ctx.roundRect(-rx * 0.26, -ry * 1.15, rx * 0.52, ry * 0.3, rx * 0.06);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    ctx.fillStyle = '#6d6a80';
    ctx.fill();
    bodyFill(ctx, p, rx, ry, [[0, '#62607a'], [0.6, '#2c2a3c'], [1, '#141320']], lw);
    ctx.save();
    clipTo(ctx, p);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = rx * 0.1;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.75, Math.PI * 1.1, Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();
    // Warning badge.
    ctx.beginPath();
    ctx.arc(0, ry * 0.08, rx * 0.42, 0, TAU);
    const g = ctx.createRadialGradient(0, ry * 0.08, 0, 0, ry * 0.08, rx * 0.42);
    g.addColorStop(0, '#ff6a5a');
    g.addColorStop(1, '#c4161f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.9;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    ctx.fillStyle = '#fff3e6';
    ctx.beginPath();
    ctx.roundRect(-rx * 0.07, -ry * 0.18, rx * 0.14, ry * 0.32, rx * 0.06);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, ry * 0.3, rx * 0.075, 0, TAU);
    ctx.fill();
  },
  gourd(ctx, rx, ry, lw) {
    const ribs = [-3, 3, -2, 2, -1, 1, 0];
    const rib = (i) => {
      const x = i * rx * 0.24;
      const wr = rx * (0.42 - Math.abs(i) * 0.03);
      const hr = ry * (0.98 - Math.abs(i) * 0.06);
      ctx.beginPath();
      ctx.ellipse(x, 0, wr, hr, 0, 0, TAU);
      return [x, wr, hr];
    };
    // Silhouette outline first, then ribs with soft seams.
    for (const i of ribs) {
      rib(i);
      ctx.lineWidth = lw * 1.1;
      ctx.strokeStyle = EDGE;
      ctx.stroke();
    }
    for (const i of ribs) {
      const [x, wr, hr] = rib(i);
      ctx.save();
      const g = ctx.createRadialGradient(x - wr * 0.2, -hr * 0.2, 0, x, 0, Math.max(wr, hr));
      g.addColorStop(0, '#fff09a');
      g.addColorStop(0.55, i % 2 ? '#ffb21f' : '#ffc23a');
      g.addColorStop(1, '#c2620a');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = lw * 0.7;
      ctx.strokeStyle = 'rgba(140,60,0,0.55)';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, 0, wr * 0.18, hr * 0.85, 0, 0, TAU);
      ctx.fillStyle = 'rgba(40,150,120,0.55)';
      ctx.fill();
    }
    stem(ctx, 0, -ry * 0.88, rx * 0.14, -ry * 1.18, -rx * 0.05, -ry * 1.12, rx * 0.12, '#3f8a3a');
    leaf(ctx, rx * 0.05, -ry * 0.95, rx * 0.4, -0.3, lw * 0.8, '#5ccf4a');
    leaf(ctx, -rx * 0.05, -ry * 0.95, rx * 0.4, -2.8, lw * 0.8, '#5ccf4a');
  },
};

// Wet look on a cut face: soft sheen, a bright rim arc and a few glints.
function wetShine(ctx, rx, ry) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.clip();
  const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.35, 0, -rx * 0.35, -ry * 0.35, rx * 0.9);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, rx * 0.05);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.8, ry * 0.8, 0, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 6; i++) {
    const a = rand(0, TAU), d = rand(0.15, 0.75);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rx * d, Math.sin(a) * ry * d, Math.max(0.8, rx * rand(0.015, 0.035)), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function snowflake(ctx, x, y, s, color, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(TAU / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s);
    ctx.moveTo(0, -s * 0.55);
    ctx.lineTo(s * 0.25, -s * 0.78);
    ctx.moveTo(0, -s * 0.55);
    ctx.lineTo(-s * 0.25, -s * 0.78);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Flesh painters (cut faces): (ctx, rx, ry, lw) ----------
const FLESH = {
  apple(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#fffbe6'], [0.78, '#fff0b8'], [0.9, '#ffe39a'], [0.91, '#e8283f'], [1, '#a01028']]);
    ctx.save();
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const d = i % 2 ? rx * 0.12 : rx * 0.3;
      ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fillStyle = '#f2d98c';
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      teardrop(ctx, Math.cos(a) * rx * 0.17, Math.sin(a) * rx * 0.17, rx * 0.16, rx * 0.06, a + Math.PI / 2, '#5a3418');
    }
    ctx.restore();
  },
  orange(ctx, rx, ry, lw) {
    citrusFlesh(ctx, rx, ry, lw, '#ff9a1f', '#e06a00', '#fff1d6', '#ffc04d', '#ff8c1a');
  },
  lemon(ctx, rx, ry, lw) {
    citrusFlesh(ctx, rx, ry, lw, '#ffe23a', '#d9b000', '#fffbe0', '#fff38a', '#ffe23a', 9);
  },
  lime(ctx, rx, ry, lw) {
    citrusFlesh(ctx, rx, ry, lw, '#5fc93a', '#2f7d1c', '#f2ffe0', '#c9f27a', '#8fdc48', 9);
  },
  watermelon(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#ff7088'], [0.78, '#ff2a4d'], [0.8, '#f6ffe8'], [0.86, '#b7ef8f'], [0.9, '#2f9a3a'], [1, '#1c6b28']]);
    ctx.save();
    ctx.scale(1, ry / rx);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU;
      teardrop(ctx, Math.cos(a) * rx * 0.5, Math.sin(a) * rx * 0.5, rx * 0.13, rx * 0.05, a + Math.PI / 2, '#1d1020');
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.4;
      teardrop(ctx, Math.cos(a) * rx * 0.25, Math.sin(a) * rx * 0.25, rx * 0.11, rx * 0.045, a + Math.PI / 2, '#1d1020');
    }
    ctx.restore();
  },
  kiwi(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#f3fbd8'], [0.24, '#f3fbd8'], [0.3, '#b4e866'], [0.9, '#64b52f'], [0.92, '#8a5c34'], [1, '#6b4526']]);
    ctx.save();
    ctx.scale(1, ry / rx);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = rx * 0.015;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rx * 0.3, Math.sin(a) * rx * 0.3);
      ctx.lineTo(Math.cos(a) * rx * 0.85, Math.sin(a) * rx * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = '#1d1020';
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * TAU + rand(-0.05, 0.05);
      const d = rx * rand(0.33, 0.45);
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, rx * 0.04, rx * 0.018, a, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  peach(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#ff6a4a'], [0.36, '#ffb43c'], [0.75, '#ffcf63'], [0.92, '#ffb347'], [0.93, '#ff7a5a'], [1, '#e2574c']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.3, ry * 0.36, 0, 0, TAU);
    ctx.fillStyle = '#8a4a2a';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,10,0,0.5)';
    ctx.lineWidth = rx * 0.025;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * rx * 0.08, -ry * 0.28);
      ctx.quadraticCurveTo(i * rx * 0.14, 0, i * rx * 0.08, ry * 0.28);
      ctx.stroke();
    }
  },
  plum(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#fff3a0'], [0.55, '#ffd04a'], [0.85, '#ff8a4a'], [0.92, '#d94a6a'], [0.93, '#5e1a8a'], [1, '#3e0f60']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.25, ry * 0.33, 0, 0, TAU);
    ctx.fillStyle = '#a0522d';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
  },
  coconut(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#f7f2e6'], [0.55, '#ece4cf'], [0.6, '#fffdf6'], [0.82, '#fff8ea'], [0.84, '#6b4120'], [1, '#4f2e12']]);
    ctx.beginPath();
    ctx.ellipse(-rx * 0.15, -ry * 0.18, rx * 0.2, ry * 0.12, -0.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  },
  dragon(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#ff4fa0'], [0.85, '#d4126e'], [0.86, '#ffa6d4'], [0.92, '#ff6fb5'], [1, '#c8106a']]);
    ctx.save();
    ctx.scale(1, ry / rx);
    ctx.fillStyle = '#1d1020';
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * rx * 0.78;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, rx * 0.025, rx * 0.017, a, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  mango(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#ffdc4a'], [0.85, '#ffa21a'], [0.93, '#ff9a1a'], [0.94, '#e8862a'], [1, '#c45a1a']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.6, ry * 0.2, 0, 0, TAU);
    ctx.fillStyle = '#fff0c0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,140,40,0.6)';
    ctx.lineWidth = rx * 0.02;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * rx * 0.12, -ry * 0.17);
      ctx.lineTo(i * rx * 0.12, ry * 0.17);
      ctx.stroke();
    }
  },
  frost(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#ffffff'], [0.6, '#bff0ff'], [0.9, '#7fd8ff'], [0.91, '#2a8bff'], [1, '#1a5fbf']]);
    snowflake(ctx, 0, 0, rx * 0.6, 'rgba(255,255,255,0.9)', rx * 0.05);
  },
  blaze(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#fff0f4'], [0.3, '#ff7aa6'], [0.88, '#d81b4a'], [0.9, '#ff7a1a'], [1, '#b5120f']]);
    ctx.fillStyle = '#ffe46b';
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU), d = rand(0.25, 0.8);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rx * d, Math.sin(a) * ry * d, rx * 0.025, 0, TAU);
      ctx.fill();
    }
  },
  gold(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#ffffff'], [0.4, '#fff3a0'], [0.88, '#ffd84a'], [0.9, '#e0a800'], [1, '#8a5a00']]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = rx * 0.03;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rx * 0.2, Math.sin(a) * ry * 0.2);
      ctx.lineTo(Math.cos(a) * rx * 0.75, Math.sin(a) * ry * 0.75);
      ctx.stroke();
    }
  },
  gourd(ctx, rx, ry, lw) {
    ellipsePath(ctx, rx, ry);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    fillEll(ctx, rx, ry, [[0, '#fff6c8'], [0.3, '#ffd75a'], [0.88, '#ffb21f'], [0.9, '#e08a12'], [1, '#c2620a']]);
  },
};

// Builds and caches all sprites for the current base radius and pixel ratio.
export class Art {
  constructor() {
    this.sprites = {};
    this.splats = {};
    this.base = 40;
    this.dpr = 1;
  }

  build(base, dpr) {
    this.base = base;
    this.dpr = dpr;
    this.sprites = {};
    this.splats = {};
    for (const key of Object.keys(FRUITS)) this.sprites[key] = this.buildFruit(key);
    this.gloss = this.buildGloss();
  }

  dims(key) {
    const f = FRUITS[key];
    const r = this.base * f.s;
    return { rx: r * f.rx, ry: r * f.ry, r };
  }

  buildFruit(key) {
    const { rx, ry, r } = this.dims(key);
    const lw = Math.max(1.6, r * 0.07);
    const size = Math.max(rx, ry) * 2 * 1.5 + lw * 4;
    const [skin, sctx] = makeCanvas(size, size, this.dpr);
    SKIN[key](sctx, rx, ry, lw);
    let flesh = null;
    if (FLESH[key]) {
      const [fc, fctx] = makeCanvas(size, size, this.dpr);
      FLESH[key](fctx, rx * 0.97, ry * 0.97, lw * 0.8);
      wetShine(fctx, rx * 0.97, ry * 0.97);
      flesh = fc;
    }
    return { skin, flesh, size, rx, ry, r, hit: Math.max(rx, ry) * 0.98 };
  }

  // Specular highlight: soft halo plus a small bright tilted spot.
  buildGloss() {
    const s = 64;
    const [c, ctx] = makeCanvas(s, s, this.dpr);
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s / 2, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.rotate(-0.7);
    ctx.scale(1, 0.55);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.22);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();
    return c;
  }

  // Juice splat blobs, three variants per color, built when first used.
  splat(color) {
    let list = this.splats[color];
    if (!list) {
      list = [];
      for (let v = 0; v < 3; v++) {
        const s = 128;
        const [c, ctx] = makeCanvas(s, s, Math.min(this.dpr, 1.5));
        // 1. Blob shape: a lumpy core, a few lobes, scattered droplets, two thin drips.
        ctx.fillStyle = color;
        const lobes = 7 + Math.floor(Math.random() * 4);
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * TAU;
          const r = s * (0.17 + 0.05 * Math.sin(a * lobes + v) + 0.03 * Math.sin(a * 3 + v * 2));
          i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const a = rand(0, TAU);
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14, s * rand(0.06, 0.1), s * rand(0.04, 0.07), a, 0, TAU);
          ctx.fill();
        }
        const n = 10 + Math.floor(Math.random() * 8);
        for (let i = 0; i < n; i++) {
          const a = rand(0, TAU);
          const d = rand(s * 0.2, s * 0.44);
          const rr = rand(s * 0.01, s * 0.045) * (1.2 - d / (s * 0.5));
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, rr * 1.5, rr, a, 0, TAU);
          ctx.fill();
        }
        for (let i = 0; i < 2; i++) {
          const x = rand(-s * 0.1, s * 0.1);
          const len = rand(s * 0.1, s * 0.24);
          const wd = rand(s * 0.012, s * 0.022);
          ctx.beginPath();
          ctx.moveTo(x - wd, s * 0.1);
          ctx.lineTo(x - wd * 0.6, s * 0.1 + len);
          ctx.arc(x, s * 0.1 + len, wd * 1.3, Math.PI, 0, true);
          ctx.lineTo(x + wd, s * 0.1);
          ctx.closePath();
          ctx.fill();
        }
        // 2. Wet shading only on the blob: darker rim, lighter center, one glint.
        ctx.globalCompositeOperation = 'source-atop';
        let g = ctx.createRadialGradient(0, 0, s * 0.04, 0, 0, s * 0.3);
        g.addColorStop(0, 'rgba(255,255,255,0.22)');
        g.addColorStop(0.55, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = g;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(-s * 0.06, -s * 0.07, s * 0.06, s * 0.03, -0.6, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        list.push(c);
      }
      this.splats[color] = list;
    }
    return list[Math.floor(Math.random() * list.length)];
  }
}

export { snowflake };
