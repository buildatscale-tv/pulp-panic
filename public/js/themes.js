// Backdrops and blade styles. "need" = lifetime seeds required to unlock.
import { TAU, rand } from './util.js';

// fingers: how many touches can cut at once. perk: a gameplay effect (see game.js).
export const BLADES = [
  { id: 'spark', name: 'Spark', need: 0, core: '#ffffff', glow: 'rgba(120,225,255,0.55)', width: 1,
    fingers: 1, perk: null, perkName: 'Starter', perkDesc: 'A clean, simple blade.' },
  { id: 'ember', name: 'Ember', need: 120, core: '#fff3c4', glow: 'rgba(255,110,30,0.65)', width: 1.1, sparks: ['#ffb13a', '#ff5a1f', '#ffe36b'],
    fingers: 2, perk: 'wildfire', perkName: 'Wildfire', perkDesc: 'A cut can set a nearby fruit on fire. It bursts for +1.' },
  { id: 'venom', name: 'Venom', need: 300, core: '#f2ffd8', glow: 'rgba(110,255,80,0.55)', width: 1, drips: '#7dff4a',
    fingers: 2, perk: 'linger', perkName: 'Lingering Venom', perkDesc: 'Your cut line stays sharp for a moment. It cuts fruit, never bombs.' },
  { id: 'prism', name: 'Prism', need: 550, core: '#ffffff', glow: 'hue', width: 1.15,
    fingers: 3, perk: 'spectrum', perkName: 'Spectrum', perkDesc: 'Combos start at 2 fruit and pay 50% more.' },
  { id: 'void', name: 'Void', need: 900, core: '#ffffff', glow: 'rgba(150,70,255,0.7)', width: 1.25, outer: 'rgba(20,0,40,0.5)',
    fingers: 4, perk: 'gravity', perkName: 'Gravity Well', perkDesc: 'Fruit drifts toward your blade. Bombs drift away.' },
  { id: 'gilded', name: 'Gilded', need: 1400, core: '#fffbe0', glow: 'rgba(255,200,40,0.7)', width: 1.15, sparks: ['#fff6b0', '#ffd84a', '#ffffff'],
    fingers: 5, perk: 'midas', perkName: 'Midas', perkDesc: 'Some fruit turns gold: +3 points and a seed each.' },
];

export const BACKDROPS = [
  { id: 'slate', name: 'Slate Counter', need: 0 },
  { id: 'dusk', name: 'Dusk Grove', need: 0 },
  { id: 'sun', name: 'Sunburst', need: 200 },
  { id: 'neon', name: 'Neon Night', need: 650 },
  { id: 'glacier', name: 'Glacier', need: 1100 },
];

export function findBlade(id) {
  return BLADES.find((b) => b.id === id) || BLADES[0];
}

export function findBackdrop(id) {
  return BACKDROPS.find((b) => b.id === id) || BACKDROPS[0];
}

function vgrad(ctx, w, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function vignette(ctx, w, h, strength = 0.55) {
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(5,0,15,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function leafSilhouette(ctx, x, y, len, ang, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// Paint the static part of a backdrop to an offscreen canvas.
export function paintBackdrop(id, w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const m = Math.min(w, h);

  if (id === 'slate') {
    // Dark stone counter: soft blotches, grain, faint scratches, warm top light.
    vgrad(ctx, w, h, [[0, '#30343c'], [1, '#1b1e24']]);
    for (let i = 0; i < 46; i++) {
      const x = rand(0, w), y = rand(0, h), r = m * rand(0.08, 0.35);
      glow(ctx, x, y, r, Math.random() < 0.5 ? `rgba(255,255,255,${rand(0.012, 0.035)})` : `rgba(0,0,0,${rand(0.05, 0.12)})`);
    }
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      px[i] += n;
      px[i + 1] += n;
      px[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = rand(0, w), y = rand(0, h), a = rand(-0.4, 0.4) + (Math.random() < 0.5 ? 0 : Math.PI / 2), l = m * rand(0.03, 0.14);
      ctx.strokeStyle = `rgba(255,255,255,${rand(0.02, 0.05)})`;
      ctx.lineWidth = rand(0.5, 1.2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    glow(ctx, w / 2, h * 0.3, m * 0.95, 'rgba(255,232,200,0.11)');
    vignette(ctx, w, h, 0.72);
  } else if (id === 'sun') {
    vgrad(ctx, w, h, [[0, '#ffcf6b'], [0.5, '#ff8a5c'], [1, '#e2456e']]);
    ctx.save();
    ctx.translate(w / 2, h * 0.58);
    const rays = 22;
    for (let i = 0; i < rays; i++) {
      ctx.rotate(TAU / rays);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-m * 0.12, -Math.hypot(w, h));
      ctx.lineTo(m * 0.12, -Math.hypot(w, h));
      ctx.closePath();
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(255,240,200,0.0)';
      ctx.fill();
    }
    ctx.restore();
    glow(ctx, w / 2, h * 0.58, m * 0.7, 'rgba(255,250,220,0.55)');
    vignette(ctx, w, h, 0.45);
  } else if (id === 'neon') {
    vgrad(ctx, w, h, [[0, '#070718'], [0.6, '#160b33'], [1, '#2a0b3d']]);
    glow(ctx, w / 2, h * 0.62, m * 0.8, 'rgba(255,40,170,0.28)');
    const horizon = h * 0.62;
    ctx.strokeStyle = 'rgba(0,240,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 14; i++) {
      const y = horizon + Math.pow(i / 14, 2) * (h - horizon) * 1.1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = -16; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * w * 0.02, horizon);
      ctx.lineTo(w / 2 + i * w * 0.16, h);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,60,200,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w, horizon);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = rand(0.2, 0.8);
      ctx.fillRect(rand(0, w), rand(0, horizon * 0.9), 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    vignette(ctx, w, h, 0.6);
  } else if (id === 'glacier') {
    vgrad(ctx, w, h, [[0, '#0d2a4a'], [0.55, '#1f5f8f'], [1, '#7fc8e8']]);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const peaks = 7;
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i <= peaks; i++) {
        const x = (i / peaks) * w;
        const y = h * (0.62 + layer * 0.12) - (i % 2 ? m * (0.12 + layer * 0.05) : 0) - rand(0, m * 0.05);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = layer ? 'rgba(220,245,255,0.18)' : 'rgba(255,255,255,0.08)';
      ctx.fill();
    }
    glow(ctx, w * 0.75, h * 0.2, m * 0.5, 'rgba(180,255,240,0.18)');
    vignette(ctx, w, h, 0.5);
  } else {
    // Dusk Grove (default).
    vgrad(ctx, w, h, [[0, '#160b2e'], [0.45, '#3a1a5c'], [0.8, '#7a2c6a'], [1, '#c2546a']]);
    glow(ctx, w / 2, h * 1.05, m * 0.9, 'rgba(255,170,90,0.4)');
    glow(ctx, w * 0.2, h * 0.2, m * 0.45, 'rgba(120,80,255,0.18)');
    const col = 'rgba(10,4,24,0.55)';
    for (let i = 0; i < 7; i++) leafSilhouette(ctx, -m * 0.05, h * (0.1 + i * 0.05), m * rand(0.22, 0.34), rand(-0.6, 0.5), col);
    for (let i = 0; i < 7; i++) leafSilhouette(ctx, w + m * 0.05, h * (0.05 + i * 0.05), -m * rand(0.22, 0.34), rand(-0.5, 0.6), col);
    for (let i = 0; i < 5; i++) leafSilhouette(ctx, w * (0.1 + i * 0.2), h + m * 0.03, m * rand(0.18, 0.26), -Math.PI / 2 + rand(-0.6, 0.6), 'rgba(10,4,24,0.4)');
    vignette(ctx, w, h, 0.55);
  }
  return c;
}

// Floating motes drawn each frame on top of the static backdrop.
export function makeMotes(id, w, h) {
  const n = id === 'neon' ? 0 : 22;
  const motes = [];
  for (let i = 0; i < n; i++) {
    motes.push({ x: rand(0, w), y: rand(0, h), r: rand(1.5, 4.5), vx: rand(-6, 6), vy: rand(-14, -4), a: rand(0.15, 0.5), p: rand(0, TAU) });
  }
  return motes;
}

export function moteColor(id) {
  if (id === 'sun') return '255,255,230';
  if (id === 'slate') return '255,240,220';
  if (id === 'glacier') return '230,250,255';
  return '255,200,150';
}
