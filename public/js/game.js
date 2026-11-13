// Core engine: input, physics, slicing, scoring, rendering.
import { Art, FRUITS, NORMAL_FRUITS, POWER_COLORS, INK, snowflake } from './art.js';
import { Sfx, Music } from './audio.js';
import { TROPHIES, findTrophy, roundTrophies } from './trophies.js';
import { computeMods, levelInfo, pointsAvailable } from './progression.js';
import { findBlade, findBackdrop, paintBackdrop, makeMotes, moteColor, BLADES, BACKDROPS } from './themes.js';
import { MODES, Director, POWER_TIME } from './modes.js';
import { TAU, rand, randInt, pick, clamp, lerp, segDist, easeOutBack, easeOutCubic } from './util.js';

const FONT = '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif';
const TRAIL_LIFE = 0.12;
// Faint blade for fingers past the blade's finger limit (they do not cut).
const GHOST_BLADE = { core: 'rgba(255,255,255,0.35)', glow: 'rgba(200,200,230,0.12)', width: 0.8 };

export function drawTrail(ctx, pts, blade, now, unit) {
  const n = pts.length;
  if (n < 2) return;
  const maxW = unit * 0.17 * blade.width;
  let hw = 0;
  const ribbon = (mult) => {
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[Math.min(i + 1, n - 1)], o = pts[Math.max(i - 1, 0)];
      let dx = q.x - o.x, dy = q.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const age = clamp((now - p.t) / TRAIL_LIFE, 0, 1);
      const w = maxW * mult * Math.pow(i / (n - 1), 0.85) * (1 - age * 0.5);
      if (i === n - 1) hw = w;
      L.push(p.x - dy * w, p.y + dx * w);
      R.push(p.x + dy * w, p.y - dx * w);
    }
    ctx.beginPath();
    ctx.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
    for (let i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]);
    ctx.closePath();
  };
  const tail = pts[0], head = pts[n - 1];
  if (blade.outer) {
    ribbon(3.8);
    ctx.fillStyle = blade.outer;
    ctx.fill();
  }
  let glow = blade.glow;
  if (blade.glow === 'hue') {
    glow = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    const h0 = (now * 220) % 360;
    for (let i = 0; i <= 4; i++) glow.addColorStop(i / 4, `hsla(${(h0 + i * 70) % 360},100%,60%,0.75)`);
  }
  // Soft glow in layers: wide and faint, then narrow and stronger.
  const base = ctx.globalAlpha;
  ctx.fillStyle = glow;
  for (const [w, a] of [[3.4, 0.28], [2.3, 0.5], [1.6, 0.8]]) {
    ctx.globalAlpha = base * a;
    ribbon(w);
    ctx.fill();
  }
  ctx.globalAlpha = base;
  ribbon(1);
  ctx.fillStyle = blade.core;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(head.x, head.y, hw, 0, TAU);
  ctx.fill();
}

export class Game {
  constructor(canvas, ui, store) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.store = store;
    this.art = new Art();
    this.sfx = new Sfx();
    this.sfx.enabled = store.data.settings.sound;
    this.music = new Music(this.sfx);
    this.music.enabled = store.data.settings.music;
    this.mods = computeMods(store.data);
    this.lingers = [];
    this.shields = { bomb: 0, miss: 0 };
    this.fireTrail = { comboN: 0, comboTimer: 0 };
    this.lastInput = 0;
    this.showFps = /[?&]fps/.test(location.search);
    this.fps = 60;

    this.fruits = [];
    this.halves = [];
    this.particles = [];
    this.splats = [];
    this.popups = [];
    this.cuts = [];
    this.menuItems = [];
    this.trails = new Map();
    this.powers = { frost: 0, frenzy: 0, double: 0 };

    this.state = 'menu';
    this.paused = false;
    this.realT = 0;
    this.timeScale = 1;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '255,255,255';
    this.banner = null;
    this.score = 0;
    this.timeLeft = 0;
    this.spawning = false;

    this.resize();
    this.ui.setScoreIcon(this.makeIcon());
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isPlaying()) this.pause();
    });

    this.last = performance.now() / 1000;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.toMenu();
  }

  // ---------- Setup ----------
  resize() {
    const w = Math.round(window.innerWidth);
    const h = Math.round(window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === this.W && h === this.H && dpr === this.dpr) return;
    // Keep flying objects in the same relative place when the screen rotates.
    if (this.W && this.H) {
      const sx = w / this.W, sy = h / this.H;
      for (const list of [this.fruits, this.halves, this.particles, this.splats, this.popups]) {
        for (const o of list) {
          o.x *= sx;
          o.y *= sy;
          if (o.vx !== undefined) o.vx *= sx;
          if (o.vy !== undefined) o.vy *= sy;
        }
      }
      if (this.gourd) this.gourd.hoverY *= sy;
    }
    this.W = w;
    this.H = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.minDim = Math.min(w, h);
    this.base = clamp(this.minDim * 0.062, 26, 64);
    this.gravity = h * 1.5;
    this.minSpeed = this.minDim * 0.45;
    this.art.build(this.base, dpr);
    this.applyBackdrop();
    this.layoutMenu();
  }

  // Small watermelon slice for the score display.
  makeIcon() {
    const art = new Art();
    art.build(30, 2);
    const s = art.sprites.watermelon;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.translate(64, 84);
    ctx.rotate(Math.PI - 0.3);
    ctx.beginPath();
    ctx.rect(-s.size, 0, s.size * 2, s.size);
    ctx.clip();
    const k = 58 / s.rx;
    ctx.scale(k, k);
    ctx.drawImage(s.skin, -s.size / 2, -s.size / 2, s.size, s.size);
    ctx.drawImage(s.flesh, -s.size / 2, -s.size / 2, s.size, s.size);
    return c.toDataURL();
  }

  applyBackdrop() {
    const id = findBackdrop(this.store.data.backdrop).id;
    this.backdropId = id;
    this.bg = paintBackdrop(id, this.W, this.H, Math.min(this.dpr, 1.5));
    this.motes = makeMotes(id, this.W, this.H);
    this.moteRGB = moteColor(id);
    this.vignettes = {};
    for (const [k, c] of Object.entries(POWER_COLORS)) this.vignettes[k] = this.makeVignette(c.a);
  }

  makeVignette(color) {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return c;
  }

  get blade() {
    return findBlade(this.store.data.blade);
  }

  // Recompute skill and blade effects (after a blade change or a skill upgrade).
  refreshMods() {
    this.mods = computeMods(this.store.data);
  }

  // ---------- Input ----------
  bindInput() {
    const c = this.canvas;
    const pos = (e) => ({ x: e.clientX, y: e.clientY, t: (e.timeStamp || performance.now()) / 1000 });
    const unlock = () => {
      this.sfx.unlock();
      this.music.start();
    };

    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlock();
      this.lastInput = this.realT;
      try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const p = pos(e);
      this.startTrail(e.pointerId, p, e.pointerType);
    });
    c.addEventListener('pointermove', (e) => {
      let tr = this.trails.get(e.pointerId);
      const hover = e.pointerType === 'mouse' && !this.store.data.settings.mouseHold;
      if (!tr || !tr.down) {
        if (!hover) return;
        if (!tr) tr = this.startTrail(e.pointerId, pos(e), 'mouse');
        tr.down = true;
      }
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (list && list.length) for (const ce of list) this.moveTrail(tr, pos(ce));
      else this.moveTrail(tr, pos(e));
    });
    const end = (e) => {
      unlock();
      const tr = this.trails.get(e.pointerId);
      if (!tr) return;
      const p = pos(e);
      if (tr.moved < 14 && p.t - tr.startT < 0.45) this.tap(tr.startX, tr.startY);
      if (e.pointerType === 'mouse' && !this.store.data.settings.mouseHold) return;
      tr.down = false;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('touchend', unlock, { passive: true });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  startTrail(id, p, kind) {
    // Each blade allows only so many fingers; extra fingers draw a faint trail that does not cut.
    let ghost = false;
    if (kind === 'touch' || kind === 'pen') {
      let active = 0;
      for (const t of this.trails.values()) if (t.down && !t.ghost && (t.kind === 'touch' || t.kind === 'pen')) active++;
      ghost = active >= this.mods.fingers;
      if (ghost && this.isPlaying() && !this.fingerHintShown) {
        this.fingerHintShown = true;
        const n = this.mods.fingers;
        this.popup(`${this.blade.name} blade: ${n} finger${n > 1 ? 's' : ''}`, p.x, p.y - this.base, 0.75, 'rgba(255,255,255,0.85)');
      }
    }
    const tr = {
      id, kind, down: true, pts: [p], last: p, ghost,
      startX: p.x, startY: p.y, startT: p.t, moved: 0,
      comboN: 0, comboTimer: 0, comboX: 0, comboY: 0,
    };
    this.trails.set(id, tr);
    return tr;
  }

  moveTrail(tr, p) {
    const last = tr.last;
    const dx = p.x - last.x, dy = p.y - last.y;
    const d = Math.hypot(dx, dy);
    if (d < 1.5) return;
    tr.moved += d;
    const dt = Math.max(0.004, p.t - last.t);
    const speed = d / dt;
    const cuts = !tr.ghost && speed > this.minSpeed * this.mods.minSpeed;
    if (cuts) {
      this.sliceSegment(tr, last.x, last.y, p.x, p.y, speed);
      if (this.mods.perk === 'linger' && this.isPlaying()) {
        this.lingers.push({ x1: last.x, y1: last.y, x2: p.x, y2: p.y, t: this.realT, ang: Math.atan2(dy, dx) });
      }
    }
    if (speed > this.minSpeed * 3.5) this.sfx.swoosh(speed / (this.minSpeed * 6));
    if (tr.ghost) {
      tr.pts.push(p);
      tr.last = p;
      return;
    }
    const blade = this.blade;
    if (blade.sparks && speed > this.minSpeed * 1.5 && Math.random() < 0.5) {
      this.spark(p.x, p.y, pick(blade.sparks), -dx / d, -dy / d);
    }
    if (blade.drips && speed > this.minSpeed && Math.random() < 0.25) {
      this.addParticle({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(0, 40), r: rand(1.5, 3), color: blade.drips, life: 0.8, g: 1 });
    }
    tr.pts.push(p);
    tr.last = p;
  }

  // ---------- Slicing ----------
  sliceSegment(tr, x1, y1, x2, y2, speed) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    if (this.state === 'menu') {
      for (const m of this.menuItems) {
        if (!m.alive) continue;
        if (segDist(x1, y1, x2, y2, m.x, m.y) < m.hit) this.sliceMenu(m, ang);
      }
      return;
    }
    if (this.state === 'boom' || this.state === 'results') return;
    for (let i = 0; i < this.fruits.length; i++) {
      const f = this.fruits[i];
      if (!f.alive) continue;
      const s = this.art.sprites[f.type];
      const d = segDist(x1, y1, x2, y2, f.x, f.y);
      if (d >= s.hit * this.mods.reach) continue;
      if (f.gourd) this.hitGourd(f, ang);
      else if (f.bomb) this.hitBomb(f);
      else this.sliceFruit(f, ang, d / s.hit, tr);
    }
  }

  tap(x, y) {
    if (this.state !== 'menu') return;
    for (const m of this.menuItems) {
      if (m.alive && Math.hypot(m.x - x, m.y - y) < m.ringR) {
        this.sliceMenu(m, -Math.PI / 2 + rand(-0.3, 0.3));
        return;
      }
    }
  }

  makeHalves(type, x, y, vx, vy, rot, vr, ang) {
    const s = this.art.sprites[type];
    if (!s.flesh) return;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const sep = this.base * rand(2.6, 3.8);
    const rel = ang - rot;
    for (const side of [1, -1]) {
      this.halves.push({
        type, x: x + nx * side * 2, y: y + ny * side * 2,
        vx: vx * 0.6 + nx * side * sep + Math.cos(ang) * this.base * 1.2,
        vy: vy * 0.4 + ny * side * sep + Math.sin(ang) * this.base * 1.2 - this.base * 1.5,
        rot, vr: vr + side * rand(1.5, 3.5), rel, side, phase: 0, vphase: rand(1.8, 3.2), drip: 0.6,
      });
    }
  }

  juice(x, y, color, ang, amount = 1, r = this.base) {
    const n = Math.round(rand(18, 26) * amount);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let i = 0; i < n; i++) {
      const sp = rand(0.4, 1) * this.base * 9;
      const spread = rand(-1, 1);
      const a = ang + spread * 0.9 + (Math.random() < 0.3 ? Math.PI : 0);
      this.addParticle({
        x: x + rand(-r, r) * 0.4, y: y + rand(-r, r) * 0.4,
        vx: Math.cos(a) * sp * 0.6 + ca * this.base * 2, vy: Math.sin(a) * sp * 0.6 + sa * this.base * 2 - this.base * 2,
        r: rand(0.07, 0.17) * this.base, color, life: rand(0.5, 0.9), g: 1,
      });
    }
    this.addParticle({ x, y, vx: 0, vy: 0, r: r * 0.9, color, life: 0.22, g: 0, kind: 'burst' });
    while (this.splats.length > 44) this.splats.shift();
    this.splats.push({
      img: this.art.splat(color), x, y, rot: rand(-0.35, 0.35),
      size: r * rand(3.4, 4.6), life: 0, max: rand(5, 6.5), alpha: 0.78,
    });
    for (let i = 0; i < 2; i++) {
      const a = ang + rand(-0.6, 0.6) + (i ? Math.PI : 0), d = r * rand(1.4, 2.4);
      this.splats.push({
        img: this.art.splat(color), x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, rot: rand(-0.35, 0.35),
        size: r * rand(1.0, 1.6), life: 0, max: rand(4, 5.5), alpha: 0.72,
      });
    }
  }

  sliceFruit(f, ang, depth, tr) {
    f.alive = false;
    const def = FRUITS[f.type];
    this.makeHalves(f.type, f.x, f.y, f.vx, f.vy, f.rot, f.vr, ang);
    this.juice(f.x, f.y, def.juice, ang);
    const s = this.art.sprites[f.type];
    this.cuts.push({ x: f.x, y: f.y, ang, len: s.hit * 2.6, life: 0, max: 0.2 });
    this.sfx.slice(f.type === 'watermelon' ? 0.75 : f.type === 'lime' || f.type === 'plum' ? 1.2 : 1);
    this.sfx.splat();

    if (this.state === 'menu') return;
    this.stats.sliced++;
    if (!f.side) this.stats.slicedThrown++;
    this.award('first');

    if (def.power) {
      this.activatePower(def.power, f.x, f.y);
    }

    if (f.golden) {
      this.stats.goldSeeds++;
      this.addScore(3, f.x, f.y - s.ry, 'GOLD', 0.9, '#ffe36b');
      this.sfx.core();
      for (let i = 0; i < 14; i++) this.spark(f.x, f.y, pick(['#fff6b0', '#ffd84a', '#ffffff']), Math.cos(i * 0.45), Math.sin(i * 0.45), 6);
    } else {
      this.addScore(1, f.x, f.y - s.ry, null, 0.8);
    }

    // Center cut bonus.
    if (depth < this.mods.bullZone && !def.power) {
      this.addScore(this.mods.bullPts, f.x, f.y - s.ry - this.base * 0.7, 'BULLSEYE', 0.9, '#7fffd4');
      this.sfx.core();
      this.stats.bullseyes++;
      if (this.stats.bullseyes >= 10) this.award('bulls10');
      for (let i = 0; i < 8; i++) this.spark(f.x, f.y, '#ffffff', Math.cos(i * 0.785), Math.sin(i * 0.785));
    }

    // Multi-fruit combo for this stroke.
    tr.comboN++;
    tr.comboTimer = this.mods.comboWindow;
    if (this.mods.perk === 'wildfire' && !f.byFire && Math.random() < 0.25) this.igniteNear(f);
    tr.comboX = f.x;
    tr.comboY = f.y;

    // Fast chain of slices.
    if (this.mode.blitz) {
      if (this.realT - this.lastSlice < 0.5) this.blitz++;
      else this.blitz = 1;
      this.lastSlice = this.realT;
      const lvl = Math.floor(this.blitz / 8);
      if (lvl > this.blitzLevel) {
        this.blitzLevel = lvl;
        this.stats.blitzMax = Math.max(this.stats.blitzMax, lvl);
        this.addScore(lvl * 2 + 1, this.W / 2, this.H * 0.28, `BLITZ x${lvl}`, 1.3, '#ffe36b');
        this.sfx.blitz();
        if (lvl >= 3) this.award('blitz3');
      }
      if (this.blitz < 8) this.blitzLevel = 0;
    }
  }

  finishCombo(tr) {
    const n = tr.comboN;
    tr.comboN = 0;
    if (n < this.mods.comboMin || this.state === 'menu') return;
    this.stats.combos++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, n);
    const x = clamp(tr.comboX, this.W * 0.2, this.W * 0.8);
    const y = clamp(tr.comboY - this.base * 2, this.H * 0.18, this.H * 0.8);
    const bonus = Math.round(n * this.mods.comboMult) + this.mods.comboExtra;
    this.addScore(bonus, x, y, `${n} FRUIT COMBO`, 1.2, '#ffd23a');
    this.sfx.combo(n);
    if (n >= 4) this.award('combo4');
    if (n >= 6) this.award('combo6');
  }

  addScore(pts, x, y, label, size = 1, color = '#ffffff') {
    if (this.state !== 'play' && this.state !== 'finale') return;
    const mult = this.powers.double > 0 ? 2 : 1;
    const total = pts * mult;
    this.score += total;
    const text = label ? `${label} +${total}` : `+${total}`;
    this.popup(text, x, y, size, mult > 1 && !label ? '#ffe36b' : color);
    if (this.mode.strikes) this.checkLifeUp();
  }

  popup(text, x, y, size = 1, color = '#fff') {
    this.popups.push({ text, x, y, life: 0, max: 0.9, size: this.base * 0.55 * size, color });
    if (this.popups.length > 24) this.popups.shift();
  }

  hitBomb(f) {
    f.alive = false;
    if (this.shields.bomb > 0 && this.state === 'play') {
      this.shields.bomb--;
      for (let i = 0; i < 14; i++) this.addParticle({ x: f.x, y: f.y, vx: rand(-50, 50), vy: rand(-90, 10), r: rand(0.3, 0.6) * this.base, color: 'rgba(90,90,110,0.55)', life: rand(0.6, 1), g: -0.15, kind: 'smoke' });
      this.popup('FIZZLED!', f.x, f.y - this.base, 1.2, '#9fe8ff');
      this.sfx.fizzle();
      return;
    }
    this.stats.bombs++;
    this.explosion(f.x, f.y);
    this.sfx.bomb(this.mode.bombEndsGame && this.state === 'play');
    if (this.mode.bombEndsGame && this.state === 'play') {
      this.state = 'boom';
      this.boomAt = { x: f.x, y: f.y, t: 0 };
      this.spawning = false;
      this.endAt = this.realT + 1.7;
      this.endReason = 'bomb';
      this.flash = 1;
      this.shakeBy(22);
      setTimeout(() => this.sfx.gameOver(), 700);
      return;
    }
    // Arcade: lose points, keep playing.
    const loss = Math.min(this.mods.bombPenalty, this.score);
    this.score -= loss;
    this.popup(`-${loss}`, f.x, f.y - this.base, 1.4, '#ff5a5a');
    this.blitz = 0;
    this.blitzLevel = 0;
    this.flash = 0.75;
    this.flashColor = '255,255,255';
    this.shakeBy(16);
    this.hitStop = 0.14;
    for (const o of this.fruits) {
      if (!o.alive || o === f || o.gourd) continue;
      const dx = o.x - f.x, dy = o.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < this.base * 6) {
        const k = (1 - d / (this.base * 6)) * this.base * 14;
        o.vx += (dx / d) * k;
        o.vy += (dy / d) * k;
      }
    }
  }

  explosion(x, y) {
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU), sp = rand(2, 14) * this.base;
      this.addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(0.06, 0.16) * this.base, color: pick(['#fff3b0', '#ffb13a', '#ff5a1f', '#ffffff']), life: rand(0.4, 0.9), g: 0.4, kind: 'spark' });
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU), sp = rand(0.5, 3) * this.base;
      this.addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.base, r: rand(0.4, 0.8) * this.base, color: 'rgba(60,50,70,0.55)', life: rand(0.8, 1.3), g: -0.1, kind: 'smoke' });
    }
  }

  activatePower(kind, x, y) {
    const dur = POWER_TIME[kind] + this.mods.powerExtra;
    this.powers[kind] = Math.min(dur * 1.6, Math.max(0, this.powers[kind]) + dur);
    this.stats.powers.add(kind);
    if (this.stats.powers.size >= 3) this.award('powers3');
    this.sfx.power(kind);
    const c = POWER_COLORS[kind];
    this.popup(c.label + '!', x, y - this.base * 1.6, 1.5, c.a);
    this.flash = 0.45;
    this.flashColor = kind === 'frost' ? '150,230,255' : kind === 'frenzy' ? '255,150,60' : '255,220,90';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      this.spark(x, y, c.a, Math.cos(a), Math.sin(a), 8);
    }
  }

  hitGourd(f, ang) {
    if (f.phase !== 'hover' && f.phase !== 'rise') return;
    if (this.realT - f.lastHit < 0.055) return;
    f.lastHit = this.realT;
    f.hits++;
    f.squash = 1;
    f.ox += Math.cos(ang) * this.base * 0.25;
    f.oy += Math.sin(ang) * this.base * 0.25;
    const s = this.art.sprites.gourd;
    const px = f.x + rand(-0.4, 0.4) * s.rx, py = f.y + rand(-0.4, 0.4) * s.ry;
    this.cuts.push({ x: px, y: py, ang, len: s.hit * 1.6, life: 0, max: 0.15 });
    for (let i = 0; i < 6; i++) {
      const a = ang + rand(-0.8, 0.8) + (i % 2 ? Math.PI : 0), sp = rand(3, 8) * this.base;
      this.addParticle({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(0.07, 0.15) * this.base, color: pick(['#ffc23a', '#fff09a', '#ff9a1f']), life: 0.6, g: 1 });
    }
    this.score += 1;
    if (this.mods.gourdBonus && f.hits % 10 === 0) {
      this.score += 1;
      this.popup('+1 SMASH', px, py - this.base, 0.9, '#ffe36b');
    }
    this.stats.gourd = f.hits;
    this.sfx.gourdHit(f.hits);
    if (f.hits >= 30) this.award('gourd30');
    this.shakeBy(3);
  }

  burstGourd(f) {
    f.alive = false;
    const s = this.art.sprites.gourd;
    this.makeHalves('gourd', f.x, f.y, 0, -this.base, f.rot, 0, rand(-0.4, 0.4));
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU), sp = rand(2, 16) * this.base;
      this.addParticle({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(0.08, 0.2) * this.base, color: pick(['#ffc23a', '#fff09a', '#ff4f8b', '#7fe3ff', '#9be24a', '#ffffff']), life: rand(0.7, 1.3), g: 0.8, kind: Math.random() < 0.3 ? 'spark' : 'drop' });
    }
    for (let i = 0; i < 5; i++) {
      this.splats.push({ img: this.art.splat(pick(['#ffc23a', '#ff4f8b', '#9be24a'])), x: f.x + rand(-1, 1) * s.rx * 1.4, y: f.y + rand(-1, 1) * s.ry * 1.4, rot: rand(0, TAU), size: s.r * rand(1.2, 1.8), life: 0, max: 4, alpha: 0.8 });
    }
    this.popup(`GRAND GOURD +${f.hits}`, this.W / 2, this.H * 0.3, 1.6, '#ffe36b');
    this.sfx.burst();
    this.shakeBy(14);
    this.flash = 0.6;
    this.flashColor = '255,230,150';
  }

  award(id, silent = false) {
    const d = this.store.data;
    if (d.trophies[id]) return null;
    const t = findTrophy(id);
    if (!t) return null;
    d.trophies[id] = Date.now();
    d.seeds += t.seeds;
    this.store.save();
    if (!silent) {
      this.sfx.trophy();
      this.ui.toast(`Trophy: ${t.name}`, `+${t.seeds} seeds`);
    }
    return t;
  }

  // Wildfire perk: set the nearest uncut fruit on fire; it bursts a moment later.
  igniteNear(from) {
    let best = null, bestD = this.base * 9;
    for (const o of this.fruits) {
      if (!o.alive || o.bomb || o.gourd || o.burn > 0 || o === from) continue;
      const d = Math.hypot(o.x - from.x, o.y - from.y);
      if (d < bestD) { best = o; bestD = d; }
    }
    if (!best) return;
    best.burn = 0.55;
    for (let i = 0; i < 10; i++) {
      const k = i / 10;
      this.addParticle({ x: from.x + (best.x - from.x) * k, y: from.y + (best.y - from.y) * k, vx: rand(-30, 30), vy: rand(-60, -20), r: rand(1.5, 3), color: pick(['#ffb13a', '#ff5a1f', '#ffe36b']), life: 0.4, g: -0.1, kind: 'spark' });
    }
  }

  // Per-frame blade perks: lingering venom line and the gravity well.
  updatePerks(gdt) {
    const active = this.state === 'play' || this.state === 'finale';
    if (this.lingers.length) {
      this.lingers = this.lingers.filter((l) => this.realT - l.t < 0.3);
      if (active) {
        for (const f of this.fruits) {
          if (!f.alive || f.bomb || f.gourd) continue;
          const s = this.art.sprites[f.type];
          for (const l of this.lingers) {
            const d = segDist(l.x1, l.y1, l.x2, l.y2, f.x, f.y);
            if (d < s.hit * this.mods.reach) {
              this.sliceFruit(f, l.ang, d / s.hit, this.fireTrail);
              break;
            }
          }
        }
      }
    }
    if (this.mods.perk === 'gravity' && active && gdt > 0) {
      const R = this.base * 5.5;
      const nowT = performance.now() / 1000;
      for (const tr of this.trails.values()) {
        if (!tr.down || tr.ghost || !tr.pts.length || nowT - tr.last.t > 0.15) continue;
        const h = tr.last;
        for (const f of this.fruits) {
          if (!f.alive || f.gourd) continue;
          const dx = h.x - f.x, dy = h.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > R) continue;
          const k = 1 - d / R;
          const pull = (f.bomb ? -1.4 : 1) * k * this.base * 34 * gdt;
          f.vx += (dx / d) * pull;
          f.vy += (dy / d) * pull;
          if (!f.bomb) {
            f.vx *= 1 - k * 1.6 * gdt;
            f.vy *= 1 - k * 0.8 * gdt;
          }
        }
      }
    }
  }

  spark(x, y, color, dx, dy, speed = 4) {
    const sp = rand(0.5, 1) * this.base * speed;
    this.addParticle({ x, y, vx: dx * sp + rand(-30, 30), vy: dy * sp + rand(-30, 30), r: rand(1.2, 2.6), color, life: rand(0.25, 0.5), g: 0.2, kind: 'spark' });
  }

  addParticle(p) {
    if (this.particles.length > 700) return;
    p.age = 0;
    p.kind = p.kind || 'drop';
    this.particles.push(p);
  }

  shakeBy(v) {
    if (!this.store.data.settings.shake) return;
    this.shake = Math.max(this.shake, v);
  }

  // ---------- Launching ----------
  bottomLaunch(type, o = {}) {
    const s = this.art.sprites[type];
    const W = this.W, H = this.H, g = this.gravity;
    const x = o.x ?? rand(W * 0.12, W * 0.88);
    const y = H + s.hit + 8;
    const apexY = H * rand(o.apexMin ?? 0.1, o.apexMax ?? 0.36);
    const vy = -Math.sqrt(2 * g * (y - apexY));
    const T = (2 * -vy) / g;
    let landX;
    if (o.spread !== undefined) landX = x + o.spread * W * 0.75;
    else landX = x + rand(-0.32, 0.32) * W;
    landX = clamp(landX, W * 0.06, W * 0.94);
    return { type, x, y, vx: (landX - x) / T, vy, delay: 0 };
  }

  sideLaunch(type) {
    const s = this.art.sprites[type];
    const W = this.W, H = this.H, g = this.gravity;
    const fromLeft = Math.random() < 0.5;
    const T = rand(1.3, 1.8);
    const dist = rand(0.6, 1.0) * W;
    const y = rand(0.45, 0.8) * H;
    let vy = -g * rand(0.3, 0.5) * T;
    const top = y - (vy * vy) / (2 * g);
    if (top < H * 0.08) vy = -Math.sqrt(2 * g * (y - H * 0.08));
    return { type, x: fromLeft ? -s.hit : W + s.hit, y, vx: (fromLeft ? 1 : -1) * (dist / T), vy, side: true, delay: 0 };
  }

  launch(spec) {
    const def = FRUITS[spec.type];
    const f = {
      type: spec.type, x: spec.x, y: spec.y, vx: spec.vx, vy: spec.vy,
      rot: rand(0, TAU), vr: rand(-2.6, 2.6) * (def.bomb ? 0.5 : 1),
      alive: true, bomb: !!def.bomb, power: def.power || null, side: !!spec.side,
      born: this.realT, gourd: false,
    };
    if (this.mods.perk === 'midas' && !f.bomb && !f.power && spec.type !== 'gourd' && this.state === 'play' && Math.random() < 0.12) f.golden = true;
    this.fruits.push(f);
    if (!f.bomb && !f.side && spec.type !== 'gourd') this.stats.launched++;
    if (!f.side || Math.random() < 0.3) this.sfx.launch();
    if (f.bomb) this.sfx.fuse();
    return f;
  }

  launchGourd() {
    const s = this.art.sprites.gourd;
    const f = this.launch({ type: 'gourd', x: this.W / 2, y: this.H + s.hit, vx: 0, vy: 0 });
    const hoverY = this.H * 0.46;
    f.vy = -Math.sqrt(2 * this.gravity * (f.y - hoverY));
    f.vr = 0;
    f.rot = 0;
    f.gourd = true;
    f.phase = 'rise';
    f.hits = 0;
    f.lastHit = 0;
    f.window = 4.2 + this.mods.gourdExtra;
    f.windowMax = f.window;
    f.squash = 0;
    f.ox = 0;
    f.oy = 0;
    f.hoverY = hoverY;
    f.cracks = [];
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      const pts = [[Math.cos(a) * s.rx * 0.1, Math.sin(a) * s.ry * 0.1]];
      let cx = pts[0][0], cy = pts[0][1];
      for (let k = 0; k < 4; k++) {
        const b = a + rand(-0.5, 0.5);
        cx += Math.cos(b) * s.rx * 0.2;
        cy += Math.sin(b) * s.ry * 0.2;
        pts.push([cx, cy]);
      }
      f.cracks.push(pts);
    }
    this.gourd = f;
    this.popup('SLASH IT!', this.W / 2, this.H * 0.2, 1.3, '#ffe36b');
  }

  // ---------- Flow ----------
  isPlaying() {
    return ['ready', 'play', 'finale', 'boom'].includes(this.state);
  }

  // keepFx keeps flying halves, juice and stains so a transition looks continuous.
  clearWorld(keepFx = false) {
    this.fruits = [];
    if (!keepFx) {
      this.halves = [];
      this.particles = [];
      this.splats = [];
      this.cuts = [];
    }
    this.popups = [];
    this.powers = { frost: 0, frenzy: 0, double: 0 };
    this.timeScale = 1;
    this.gourd = null;
    this.banner = null;
  }

  toMenu() {
    if (this.paused) this.music.duck(false);
    this.refreshMods();
    this.paused = false;
    this.state = 'menu';
    this.clearWorld(true);
    this.mode = MODES.arcade;
    this.ui.showMenu();
    this.layoutMenu();
  }

  // Free vertical band for the mode fruits: below the title block, above the button row.
  menuBand() {
    const H = this.H;
    const fallback = { top: H * 0.24, bottom: H * 0.88 };
    const menu = document.getElementById('menu');
    const bar = document.querySelector('#menu .menu-bar');
    if (!menu || menu.hidden || !bar) return fallback;
    const barTop = bar.getBoundingClientRect().top;
    let top = 0;
    for (const sel of ['#menu .logo', '#menu .hint', '#menuSeeds', '#tip']) {
      const el = document.querySelector(sel);
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect();
      // The seeds pill sits in the top-right corner on wide screens; ignore it there.
      if (sel === '#menuSeeds' && r.left > this.W * 0.6) continue;
      if (r.height > 0) top = Math.max(top, r.bottom);
    }
    if (!top || barTop <= top + 50) return fallback;
    return { top: top + 8, bottom: barTop - 8 };
  }

  layoutMenu() {
    if (!this.W) return;
    const W = this.W;
    const portrait = this.H > W * 1.1;
    const b = this.base;
    const { top, bottom } = this.menuBand();
    const avail = bottom - top;
    // Space for the curved label above a ring and the BEST line below it.
    const above = b * 1.05, below = b * 1.1;
    let big = b * 2.5, small = b * 2.0, k = 1;
    let items;
    if (portrait) {
      const gap = b * 0.5;
      const need = big * 2 + small * 2 + (above + below) * 2 + gap;
      k = Math.min(1, avail / need);
      big *= k;
      small *= k;
      const g = gap * k;
      const used = big * 2 + small * 2 + (above + below) * 2 + g;
      const y0 = top + (avail - used) / 2;
      const yA = y0 + above + big;
      const yB = yA + big + below + g + above + small;
      items = [
        { mode: 'arcade', x: W * 0.5, y: yA, ringR: big },
        { mode: 'classic', x: W * 0.27, y: yB, ringR: small },
        { mode: 'zen', x: W * 0.73, y: yB, ringR: small },
      ];
    } else {
      const need = big * 2 + above + below;
      k = Math.min(1, avail / need);
      big *= k;
      small *= k;
      const yA = top + (avail - (big * 2 + above + below)) / 2 + above + big;
      // The small rings sit a little lower than the big one.
      const yS = yA + (big - small) * 0.45;
      items = [
        { mode: 'classic', x: W * 0.24, y: yS, ringR: small },
        { mode: 'arcade', x: W * 0.5, y: yA, ringR: big },
        { mode: 'zen', x: W * 0.76, y: yS, ringR: small },
      ];
    }
    const prev = this.menuItems;
    this.menuItems = items.map((it, i) => {
      const m = MODES[it.mode];
      const old = prev.find((p) => p.mode === it.mode);
      return {
        ...it, type: m.fruit, label: m.name.toUpperCase(), alive: old ? old.alive : true,
        rot: old ? old.rot : rand(0, TAU), phase: i * 1.7, hit: it.ringR * 0.62, y0: it.y,
        respawn: old ? old.respawn : 0, fruitScale: (it.mode === 'arcade' ? 1.35 : 1.15) * k,
      };
    });
  }

  sliceMenu(m, ang) {
    m.alive = false;
    const def = FRUITS[m.type];
    this.makeHalves(m.type, m.x, m.y, 0, 0, m.rot, 0, ang);
    this.juice(m.x, m.y, def.juice, ang, 1.2);
    this.cuts.push({ x: m.x, y: m.y, ang, len: m.ringR * 2.2, life: 0, max: 0.22 });
    this.sfx.slice(1);
    this.sfx.splat();
    this.menuChoice = m.mode;
    setTimeout(() => {
      if (this.state === 'menu') this.start(m.mode);
    }, 520);
  }

  start(modeId) {
    if (this.paused) this.music.duck(false);
    this.mode = MODES[modeId];
    this.clearWorld(true);
    this.paused = false;
    this.director = new Director(this, this.mode);
    this.score = 0;
    this.strikes = 0;
    this.lifeMark = 0;
    this.blitz = 0;
    this.blitzLevel = 0;
    this.lastSlice = -1;
    this.lastTick = -1;
    this.refreshMods();
    this.timeLeft = this.mode.time ? this.mode.time + this.mods.timeBonus : 0;
    this.shields = { bomb: this.mods.bombShield, miss: this.mode.strikes ? this.mods.missShield : 0 };
    this.lingers = [];
    this.fingerHintShown = false;
    this.spawning = false;
    this.endAt = 0;
    this.endReason = null;
    this.gourdLaunched = false;
    this.roundSeedsStart = this.store.data.seeds;
    this.stats = { goldSeeds: 0, fireBursts: 0, bullseyes: 0, sliced: 0, slicedThrown: 0, launched: 0, combos: 0, maxCombo: 0, bombs: 0, missed: 0, blitzMax: 0, gourd: 0, powers: new Set() };
    this.state = 'ready';
    this.readyT = 0;
    this.trails.clear();
    for (const m of this.menuItems) m.alive = true;
    this.ui.showHud(this.mode, this.store.data.best[modeId]);
    this.sfx.ready();
  }

  pause() {
    if (!this.isPlaying() || this.paused) return;
    this.paused = true;
    this.music.duck(true);
    this.sfx.setFuse(0);
    this.ui.showPause(true);
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.music.duck(false);
    this.last = performance.now() / 1000;
    this.trails.clear();
    this.ui.showPause(false);
  }

  strike(x) {
    if (this.shields.miss > 0) {
      this.shields.miss--;
      this.sfx.lifeUp();
      this.popup('SAVED!', clamp(x, this.base * 2, this.W - this.base * 2), this.H - this.base * 1.4, 1.3, '#7dff8a');
      return;
    }
    this.strikes++;
    this.stats.missed++;
    this.sfx.strike();
    this.popup('✕', clamp(x, this.base, this.W - this.base), this.H - this.base * 1.2, 1.8, '#ff4a4a');
    if (this.strikes >= 3 && this.state === 'play') {
      this.state = 'finale';
      this.spawning = false;
      this.endAt = this.realT + 1.5;
      this.endReason = 'strikes';
      this.banner = { text: 'GAME OVER', t: 0, dur: 1.5, color: '#ff5a5a' };
      this.sfx.gameOver();
    }
  }

  checkLifeUp() {
    const mark = Math.floor(this.score / this.mods.lifeEvery);
    if (mark > this.lifeMark) {
      this.lifeMark = mark;
      if (this.strikes > 0 && this.state === 'play') {
        this.strikes--;
        this.sfx.lifeUp();
        this.popup('+1 LIFE', this.W - this.base * 3, this.base * 3.2, 1, '#7dff8a');
      }
    }
  }

  endRound() {
    const st = this.stats;
    const mode = this.mode;
    const bonuses = [];
    const acc = st.launched ? Math.min(1, st.slicedThrown / st.launched) : 0;
    if (mode.id === 'arcade') {
      if (st.bombs === 0) bonuses.push({ label: 'Bomb Dodger', pts: 25 });
      if (st.combos >= 3) bonuses.push({ label: `Combo Crafter (${st.combos})`, pts: Math.min(40, st.combos * 2) });
      if (acc >= 0.9 && st.launched >= 25) bonuses.push({ label: 'Sharp Eye', pts: 20 });
      if (st.powers.size >= 3) bonuses.push({ label: 'Power Hungry', pts: 15 });
      if (st.sliced >= 120) bonuses.push({ label: 'Fruit Fiend', pts: 20 });
      if (st.blitzMax >= 3) bonuses.push({ label: 'Blitz Master', pts: 10 });
    } else if (mode.id === 'zen') {
      if (st.combos >= 5) bonuses.push({ label: `Combo Crafter (${st.combos})`, pts: Math.min(30, st.combos * 2) });
      if (acc >= 0.9 && st.launched >= 40) bonuses.push({ label: 'Sharp Eye', pts: 15 });
    }
    const base = this.score;
    const total = base + bonuses.reduce((a, b) => a + b.pts, 0);
    const d = this.store.data;
    const prevBest = d.best[mode.id] || 0;
    const newBest = total > prevBest;
    if (newBest) d.best[mode.id] = total;
    const seedsBefore = this.roundSeedsStart ?? d.seeds;
    const seeds = Math.round((Math.floor(total / 10) + (newBest && total > 0 ? 5 : 0) + st.goldSeeds) * this.mods.seedMul);
    d.seeds += seeds;
    const levelBefore = levelInfo(d.xp || 0);
    d.xp = (d.xp || 0) + total;
    const levelAfter = levelInfo(d.xp);
    d.games++;
    d.fruits += st.sliced;
    d.bestCombo = Math.max(d.bestCombo, st.maxCombo);
    const trophies = [];
    for (const id of roundTrophies({ mode: mode.id, bombs: st.bombs, total }, d)) {
      const t = this.award(id, true);
      if (t) trophies.push(t);
    }
    if (trophies.length) this.sfx.trophy();
    const unlocked = [
      ...BLADES.filter((b) => b.need > seedsBefore && b.need <= d.seeds).map((b) => `${b.name} blade`),
      ...BACKDROPS.filter((b) => b.need > seedsBefore && b.need <= d.seeds).map((b) => `${b.name} backdrop`),
    ];
    this.store.save();
    this.state = 'results';
    this.spawning = false;
    this.fruits = [];
    this.powers = { frost: 0, frenzy: 0, double: 0 };
    this.banner = null;
    this.ui.showResults({
      mode, reason: this.endReason, base, total, bonuses, newBest, best: Math.max(prevBest, total),
      sliced: st.sliced, accuracy: acc, maxCombo: st.maxCombo, combos: st.combos, bombs: st.bombs,
      gourd: st.gourd, seeds, totalSeeds: d.seeds, unlocked, trophies,
      xpGain: total, levelBefore, levelAfter, points: pointsAvailable(d),
    });
  }

  // ---------- Update ----------
  loop(ts) {
    const now = ts / 1000;
    const dt = Math.min(0.05, Math.max(0, now - this.last));
    this.last = now;
    if (!this.paused) this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.realT += dt;
    const W = this.W, H = this.H;

    for (const k of Object.keys(this.powers)) if (this.powers[k] > 0) this.powers[k] = Math.max(0, this.powers[k] - dt);
    const targetScale = this.powers.frost > 0 ? 0.42 : 1;
    this.timeScale = lerp(this.timeScale, targetScale, 1 - Math.exp(-dt * 7));
    if (this.hitStop > 0) this.hitStop -= dt;
    const frozen = this.state === 'boom' || this.hitStop > 0;
    const gdt = frozen ? 0 : dt * this.timeScale;

    // Trails and combo windows.
    const nowT = performance.now() / 1000;
    for (const [id, tr] of this.trails) {
      while (tr.pts.length && nowT - tr.pts[0].t > TRAIL_LIFE) tr.pts.shift();
      if (tr.comboN > 0) {
        tr.comboTimer -= dt;
        if (tr.comboTimer <= 0) this.finishCombo(tr);
      }
      if (!tr.down && tr.pts.length === 0 && tr.comboN === 0) this.trails.delete(id);
    }

    // State machine.
    if (this.state === 'ready') {
      this.readyT += dt;
      if (this.readyT >= 1.5) {
        this.state = 'play';
        this.spawning = true;
      }
    } else if (this.state === 'play') {
      this.director.update(gdt);
      if (this.mode.time) {
        this.timeLeft = Math.max(0, this.timeLeft - gdt);
        const sec = Math.ceil(this.timeLeft);
        if (sec <= 5 && sec !== this.lastTick && this.timeLeft > 0) {
          this.lastTick = sec;
          this.sfx.tick(sec <= 3);
        }
        if (this.timeLeft <= 0) {
          this.state = 'finale';
          this.spawning = false;
          this.finaleT = 0;
          this.sfx.timeUp();
          this.banner = { text: "TIME'S UP!", t: 0, dur: 1.3, color: '#ffe36b' };
          if (!this.mode.finale) {
            this.endAt = this.realT + 1.8;
            this.endReason = 'time';
          }
        }
      }
    } else if (this.state === 'finale') {
      this.director.update(gdt);
      if (this.mode.finale) {
        this.finaleT += dt;
        const anyLeft = this.fruits.some((f) => f.alive && !f.bomb);
        if (!this.gourdLaunched && (this.finaleT > 2.2 || (this.finaleT > 1.2 && !anyLeft))) {
          this.gourdLaunched = true;
          for (const f of this.fruits) {
            if (!f.bomb || !f.alive) continue;
            f.alive = false;
            for (let i = 0; i < 8; i++) this.addParticle({ x: f.x, y: f.y, vx: rand(-40, 40), vy: rand(-60, 0), r: rand(0.3, 0.6) * this.base, color: 'rgba(60,50,70,0.5)', life: 0.8, g: -0.1, kind: 'smoke' });
          }
          this.launchGourd();
        }
        if (this.gourdLaunched && !this.endAt && (!this.gourd || !this.gourd.alive)) {
          this.endAt = this.realT + 1.8;
          this.endReason = 'time';
        }
      }
      if (this.endAt && this.realT >= this.endAt) this.endRound();
    } else if (this.state === 'boom') {
      if (this.boomAt) this.boomAt.t += dt;
      if (this.realT >= this.endAt) this.endRound();
    } else if (this.state === 'menu') {
      for (const m of this.menuItems) {
        m.rot += dt * 0.5;
        m.phase += dt * 1.6;
        m.y = m.y0 + Math.sin(m.phase) * this.base * 0.12;
        if (!m.alive) {
          m.respawn += dt;
          if (m.respawn > 1.2) {
            m.alive = true;
            m.respawn = 0;
          }
        }
      }
    }

    // Fruits.
    this.updatePerks(gdt);
    const g = this.gravity;
    for (const f of this.fruits) {
      if (!f.alive) continue;
      if (f.gourd) {
        this.updateGourd(f, dt, gdt);
        continue;
      }
      if (f.burn > 0) {
        f.burn -= gdt;
        if (Math.random() < 0.7) this.addParticle({ x: f.x + rand(-0.5, 0.5) * this.base, y: f.y - this.base * 0.4, vx: rand(-25, 25), vy: rand(-140, -60), r: rand(1.5, 3.5), color: pick(['#ffb13a', '#ff5a1f', '#ffe36b']), life: 0.45, g: -0.1, kind: 'spark' });
        if (f.burn <= 0 && (this.state === 'play' || this.state === 'finale')) {
          f.byFire = true;
          this.stats.fireBursts++;
          this.sliceFruit(f, rand(0, TAU), 0.5, this.fireTrail);
          this.popup('BURN', f.x, f.y - this.base * 1.6, 0.8, '#ffb13a');
          continue;
        }
      }
      if (f.golden && Math.random() < 0.3) {
        const s0 = this.art.sprites[f.type];
        this.addParticle({ x: f.x + rand(-1, 1) * s0.r, y: f.y + rand(-1, 1) * s0.r, vx: 0, vy: rand(-30, -10), r: rand(1, 2.2), color: '#fff6b0', life: 0.5, g: 0, kind: 'spark' });
      }
      f.vy += g * gdt;
      f.x += f.vx * gdt;
      f.y += f.vy * gdt;
      f.rot += f.vr * gdt;
      const s = this.art.sprites[f.type];
      if (f.bomb && Math.random() < 0.5 * this.timeScale) {
        const tip = this.fuseTip(f, s);
        this.addParticle({ x: tip.x, y: tip.y, vx: rand(-60, 60), vy: rand(-90, -10), r: rand(1, 2.4), color: pick(['#fff3b0', '#ffb13a', '#ffffff']), life: rand(0.15, 0.35), g: 0.3, kind: 'spark' });
      }
      if (f.side) {
        if (f.x > -s.hit * 2 && f.x < W + s.hit * 2) f.seen = true;
        if (f.seen && (f.x < -s.hit * 2.5 || f.x > W + s.hit * 2.5)) f.alive = false;
      }
      if (f.vy > 0 && f.y > H + s.hit * 1.2) {
        f.alive = false;
        if (!f.bomb && !f.side && this.mode.strikes && this.state === 'play') this.strike(f.x);
      }
    }
    if (this.fruits.length > 40 || this.fruits.some((f) => !f.alive)) this.fruits = this.fruits.filter((f) => f.alive);

    for (const h of this.halves) {
      h.vy += g * gdt;
      h.x += h.vx * gdt;
      h.y += h.vy * gdt;
      h.rot += h.vr * gdt;
      h.phase += h.vphase * gdt;
      if (h.drip > 0) {
        h.drip -= gdt;
        if (Math.random() < 0.35) this.addParticle({ x: h.x + rand(-4, 4), y: h.y + rand(-4, 4), vx: h.vx * 0.3, vy: h.vy * 0.3, r: rand(0.04, 0.08) * this.base, color: FRUITS[h.type].juice, life: 0.5, g: 1 });
      }
    }
    this.halves = this.halves.filter((h) => h.y < H + this.base * 6 && h.x > -this.base * 8 && h.x < W + this.base * 8);

    for (const p of this.particles) {
      p.age += gdt;
      p.vy += g * (p.g ?? 1) * gdt * 0.8;
      p.vx *= p.kind === 'smoke' ? 0.96 : 0.995;
      p.x += p.vx * gdt;
      p.y += p.vy * gdt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);

    for (const s of this.splats) s.life += dt;
    this.splats = this.splats.filter((s) => s.life < s.max);
    for (const p of this.popups) {
      p.life += dt;
      p.y -= this.base * 1.1 * dt;
    }
    this.popups = this.popups.filter((p) => p.life < p.max);
    for (const c of this.cuts) c.life += dt;
    this.cuts = this.cuts.filter((c) => c.life < c.max);
    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.p += dt;
      if (m.y < -10) {
        m.y = H + 10;
        m.x = rand(0, W);
      }
    }
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }

    this.shake *= Math.exp(-dt * 9);
    if (this.shake < 0.3) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 2.2);

    if (this.isPlaying()) this.ui.updateHud(this);
    let bombs = 0;
    for (const f of this.fruits) if (f.alive && f.bomb && f.y < H + 20) bombs++;
    this.sfx.setFuse(this.state === 'boom' ? 0 : bombs);
    const playing = this.state === 'play' || this.state === 'finale';
    this.music.intensity = playing ? (this.powers.frenzy > 0 ? 2 : 1) : 0;
    this.music.setFrozen(this.powers.frost > 0 && !this.paused);
    if (dt > 0) this.fps = lerp(this.fps, 1 / dt, 0.05);
  }

  updateGourd(f, dt, gdt) {
    const g = this.gravity;
    f.squash = Math.max(0, f.squash - dt * 5);
    f.ox *= Math.exp(-dt * 8);
    f.oy *= Math.exp(-dt * 8);
    if (f.phase === 'rise') {
      f.vy += g * gdt;
      f.y += f.vy * gdt;
      if (f.vy >= -this.base * 2) {
        f.phase = 'hover';
        f.vy = 0;
      }
    } else if (f.phase === 'hover') {
      f.window -= dt;
      f.y = lerp(f.y, f.hoverY + Math.sin(this.realT * 2.2) * this.base * 0.15, 1 - Math.exp(-dt * 4));
      f.rot = Math.sin(this.realT * 1.4) * 0.08;
      if (f.window <= 0) {
        if (f.hits > 0) this.burstGourd(f);
        else f.phase = 'fall';
      }
    } else if (f.phase === 'fall') {
      f.vy += g * gdt;
      f.y += f.vy * gdt;
      if (f.y > this.H + this.art.sprites.gourd.hit * 1.5) f.alive = false;
    }
  }

  fuseTip(f, s) {
    const lx = s.rx * 0.32, ly = -s.ry * 1.42;
    const c = Math.cos(f.rot), sn = Math.sin(f.rot);
    return { x: f.x + lx * c - ly * sn, y: f.y + lx * sn + ly * c };
  }

  // ---------- Render ----------
  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.bg, 0, 0, W, H);

    // Motes.
    for (const m of this.motes) {
      ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.p * 2));
      ctx.fillStyle = `rgb(${this.moteRGB})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    if (this.shake) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);

    for (const s of this.splats) {
      const fade = s.life > s.max - 1.4 ? (s.max - s.life) / 1.4 : 1;
      const grow = Math.min(1, s.life / 0.08);
      ctx.globalAlpha = s.alpha * fade;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      const sz = s.size * (0.6 + 0.4 * grow);
      ctx.drawImage(s.img, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (const h of this.halves) this.drawHalf(h);

    if (this.state === 'menu') this.drawMenu();

    for (const f of this.fruits) if (f.alive) this.drawFruit(f);

    for (const p of this.particles) {
      const k = 1 - p.age / p.life;
      if (p.kind === 'spark') {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.5 + k), 0, TAU);
        ctx.fill();
      } else if (p.kind === 'burst') {
        ctx.globalAlpha = k * 0.55;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + (1 - k) * 1.6), 0, TAU);
        ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = k * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.6 - k * 0.6), 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * k), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Cut streaks.
    for (const c of this.cuts) {
      const k = 1 - c.life / c.max;
      const dx = Math.cos(c.ang) * c.len * 0.5, dy = Math.sin(c.ang) * c.len * 0.5;
      ctx.strokeStyle = `rgba(255,255,255,${k})`;
      ctx.lineCap = 'round';
      ctx.lineWidth = this.base * 0.18 * k;
      ctx.beginPath();
      ctx.moveTo(c.x - dx, c.y - dy);
      ctx.lineTo(c.x + dx, c.y + dy);
      ctx.stroke();
    }

    this.drawPopups();
    ctx.restore();

    // Blade trails (not shaken).
    const blade = this.blade;
    const now = performance.now() / 1000;
    for (const l of this.lingers) {
      const a = 1 - (this.realT - l.t) / 0.3;
      ctx.strokeStyle = `rgba(125,255,74,${0.55 * a})`;
      ctx.lineWidth = this.base * 0.14 * a;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    for (const tr of this.trails.values()) drawTrail(ctx, tr.pts, tr.ghost ? GHOST_BLADE : blade, now, this.base);

    this.drawPowerFx();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${Math.min(0.85, this.flash * 0.7)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.state === 'boom' && this.boomAt) this.drawBoom();
    if (this.state === 'ready') this.drawReady();
    if (this.banner) this.drawBanner();
    if (this.state === 'menu') this.drawHint();
    if (this.showFps) this.text(`${Math.round(this.fps)} fps`, W / 2, H - 16, 14, '#7dff8a');
  }

  // Ghost swipe across the Arcade fruit when the player has not touched for a while.
  drawHint() {
    const idle = this.realT - this.lastInput;
    const m = this.menuItems.find((i) => i.mode === 'arcade');
    if (!m || !m.alive || idle < 2.5) return;
    const t = ((idle - 2.5) % 2.8) / 1.0;
    if (t > 1) return;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const x0 = m.x - m.ringR * 1.3, y0 = m.y + m.ringR * 0.7;
    const x1 = m.x + m.ringR * 1.3, y1 = m.y - m.ringR * 0.5;
    const pts = [];
    const now = 100;
    for (let i = 0; i <= 12; i++) {
      const k = Math.max(0, e - 0.35 + (i / 12) * 0.35);
      pts.push({ x: lerp(x0, x1, k), y: lerp(y0, y1, k) - Math.sin(k * Math.PI) * m.ringR * 0.25, t: now - 0.1 + (i / 12) * 0.1 });
    }
    const ctx = this.ctx;
    ctx.globalAlpha = 0.6 * Math.sin(t * Math.PI);
    drawTrail(ctx, pts, { core: '#ffffff', glow: 'rgba(255,255,255,0.35)', width: 1 }, now, this.base);
    const h = pts[pts.length - 1];
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(h.x, h.y, this.base * 0.22, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Midas perk: recolor the fruit to gold, keeping its shading.
  goldTint(f, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, s.rx, s.ry, 0, 0, TAU);
    ctx.clip();
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = '#ffc400';
    ctx.fillRect(-s.rx * 1.2, -s.ry * 1.2, s.rx * 2.4, s.ry * 2.4);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,240,170,0.6)';
    ctx.fillRect(-s.rx * 1.2, -s.ry * 1.2, s.rx * 2.4, s.ry * 2.4);
    ctx.restore();
  }

  // Fixed light from the top-left, clipped to the (rotating) fruit outline.
  shade(x, y, rot, rx, ry) {
    const ctx = this.ctx;
    const R = Math.max(rx, ry);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.99, ry * 0.99, 0, 0, TAU);
    ctx.rotate(-rot);
    ctx.clip();
    const g = ctx.createRadialGradient(-R * 0.4, -R * 0.45, R * 0.05, -R * 0.1, -R * 0.1, R * 1.45);
    g.addColorStop(0, 'rgba(255,250,235,0.18)');
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(0.82, 'rgba(10,0,20,0.36)');
    g.addColorStop(1, 'rgba(10,0,20,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
    ctx.restore();
  }

  drawGloss(x, y, s) {
    const gr = Math.min(s.rx, s.ry);
    const size = gr * 1.0;
    this.ctx.globalAlpha = 0.85;
    this.ctx.drawImage(this.art.gloss, x - gr * 0.38 - size / 2, y - gr * 0.42 - size / 2, size, size);
    this.ctx.globalAlpha = 1;
  }

  drawFruit(f) {
    const ctx = this.ctx;
    const s = this.art.sprites[f.type];
    if (f.power) this.drawAura(f, s);
    if (f.burn > 0) {
      const g = ctx.createRadialGradient(f.x, f.y, s.r * 0.5, f.x, f.y, s.r * 1.8);
      g.addColorStop(0, `rgba(255,140,30,${0.45 + Math.random() * 0.2})`);
      g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, s.r * 1.8, 0, TAU);
      ctx.fill();
    }
    if (f.bomb && this.mods.bombWarn && this.isPlaying()) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(-this.realT * 2);
      ctx.strokeStyle = `rgba(255,70,60,${0.55 + 0.35 * Math.sin(this.realT * 10)})`;
      ctx.lineWidth = Math.max(2, s.r * 0.09);
      ctx.setLineDash([s.r * 0.3, s.r * 0.2]);
      ctx.beginPath();
      ctx.arc(0, 0, s.r * 1.55, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (f.bomb) {
      const pulse = 0.5 + 0.5 * Math.sin(this.realT * 12);
      const g = ctx.createRadialGradient(f.x, f.y, s.r * 0.6, f.x, f.y, s.r * 1.9);
      g.addColorStop(0, `rgba(255,40,40,${0.35 + pulse * 0.25})`);
      g.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, s.r * 1.9, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(f.x + (f.ox || 0), f.y + (f.oy || 0));
    if (f.gourd && f.squash) {
      const q = f.squash;
      ctx.scale(1 + q * 0.07, 1 - q * 0.06);
    }
    ctx.rotate(f.rot);
    ctx.drawImage(s.skin, -s.size / 2, -s.size / 2, s.size, s.size);
    if (f.gourd) this.drawGourdCracks(f, s);
    ctx.restore();
    this.shade(f.x + (f.ox || 0), f.y + (f.oy || 0), f.rot, s.rx, s.ry);
    if (f.golden) this.goldTint(f, s);
    this.drawGloss(f.x + (f.ox || 0), f.y + (f.oy || 0), s);
    if (f.bomb) {
      const tip = this.fuseTip(f, s);
      const fl = 0.7 + Math.random() * 0.5;
      const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, s.r * 0.5 * fl);
      g.addColorStop(0, 'rgba(255,255,230,1)');
      g.addColorStop(0.3, 'rgba(255,190,60,0.9)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, s.r * 0.5 * fl, 0, TAU);
      ctx.fill();
    }
    if (f.gourd && f.phase === 'hover') {
      const k = clamp(f.window / f.windowMax, 0, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = this.base * 0.16;
      ctx.beginPath();
      ctx.arc(f.x, f.y, s.hit * 1.18, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = k < 0.3 ? '#ff6a5a' : '#ffe36b';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(f.x, f.y, s.hit * 1.18, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
      if (f.hits > 0) {
        this.text(`${f.hits}`, f.x, f.y + s.ry * 1.45, this.base * 0.9, '#fff09a');
      }
    }
  }

  drawGourdCracks(f, s) {
    const ctx = this.ctx;
    const n = Math.min(f.cracks.length, Math.floor(f.hits / 2));
    if (!n) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      const pts = f.cracks[i];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.strokeStyle = 'rgba(255,190,60,0.5)';
      ctx.lineWidth = this.base * 0.3;
      ctx.stroke();
      ctx.strokeStyle = '#fffbe0';
      ctx.lineWidth = this.base * 0.08;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAura(f, s) {
    const ctx = this.ctx;
    const c = POWER_COLORS[f.power];
    const pulse = 0.5 + 0.5 * Math.sin(this.realT * 6);
    const R = s.r * (1.75 + pulse * 0.15);
    const g = ctx.createRadialGradient(f.x, f.y, s.r * 0.5, f.x, f.y, R);
    g.addColorStop(0, c.a);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, R, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(this.realT * 1.5);
    ctx.strokeStyle = c.a;
    ctx.lineWidth = Math.max(2, s.r * 0.08);
    ctx.setLineDash([s.r * 0.35, s.r * 0.25]);
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 1.4, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (f.power === 'frost' && Math.random() < 0.3) {
      this.addParticle({ x: f.x + rand(-1, 1) * s.r, y: f.y + rand(-1, 1) * s.r, vx: rand(-20, 20), vy: rand(-20, 20), r: rand(1, 2.5), color: '#e9fbff', life: 0.5, g: 0, kind: 'spark' });
    }
    if (f.power === 'frenzy' && Math.random() < 0.4) {
      this.addParticle({ x: f.x + rand(-0.6, 0.6) * s.r, y: f.y - s.r * 0.6, vx: rand(-20, 20), vy: rand(-120, -60), r: rand(1.5, 3), color: pick(['#ffb13a', '#ff5a1f', '#ffe36b']), life: 0.5, g: -0.1, kind: 'spark' });
    }
  }

  drawHalf(h) {
    const ctx = this.ctx;
    const s = this.art.sprites[h.type];
    const R = s.size;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);
    ctx.save();
    ctx.rotate(h.rel);
    ctx.beginPath();
    if (h.side > 0) ctx.rect(-R, 0, R * 2, R);
    else ctx.rect(-R, -R, R * 2, R);
    ctx.restore();
    ctx.clip();
    ctx.drawImage(s.skin, -R / 2, -R / 2, R, R);
    const k = 0.32 + 0.68 * Math.abs(Math.cos(h.phase));
    ctx.rotate(h.rel);
    ctx.scale(1, k);
    ctx.rotate(-h.rel);
    ctx.drawImage(s.flesh, -R / 2, -R / 2, R, R);
    ctx.restore();
  }

  drawMenu() {
    const ctx = this.ctx;
    const best = this.store.data.best;
    for (const m of this.menuItems) {
      const s = this.art.sprites[m.type];
      // Ring.
      ctx.save();
      ctx.translate(m.x, m.y);
      const g = ctx.createRadialGradient(0, 0, m.ringR * 0.3, 0, 0, m.ringR * 1.1);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, m.ringR * 1.1, 0, TAU);
      ctx.fill();
      ctx.rotate(this.realT * 0.4 * (m.mode === 'zen' ? -1 : 1));
      ctx.strokeStyle = m.mode === 'arcade' ? 'rgba(255,214,90,0.9)' : 'rgba(255,240,220,0.65)';
      ctx.lineWidth = Math.max(2, this.base * 0.07);
      ctx.setLineDash([this.base * 0.3, this.base * 0.2]);
      ctx.beginPath();
      ctx.arc(0, 0, m.ringR, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // Label on an arc above the ring.
      this.arcText(m.label, m.x, m.y, m.ringR + this.base * 0.42, m.mode === 'arcade' ? this.base * 0.62 : this.base * 0.5, m.mode === 'arcade' ? '#ffe36b' : '#fff1de');
      const b = best[m.mode] || 0;
      this.text(`BEST ${b}`, m.x, m.y + m.ringR + this.base * 0.75, this.base * 0.36, 'rgba(255,241,222,0.85)');
      if (m.alive) {
        const scale = m.fruitScale;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.scale(scale, scale);
        ctx.rotate(m.rot);
        ctx.drawImage(s.skin, -s.size / 2, -s.size / 2, s.size, s.size);
        ctx.restore();
        this.shade(m.x, m.y, m.rot, s.rx * scale, s.ry * scale);
        const gs = { rx: s.rx * scale, ry: s.ry * scale };
        this.drawGloss(m.x, m.y, gs);
      }
    }
  }

  arcText(text, cx, cy, radius, size, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const spacing = size * 0.08;
    const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0);
    let a = -Math.PI / 2 - total / radius / 2;
    ctx.lineJoin = 'round';
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];
      a += w / 2 / radius;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.rotate(a + Math.PI / 2);
      ctx.lineWidth = size * 0.28;
      ctx.strokeStyle = INK;
      ctx.strokeText(text[i], 0, 0);
      ctx.fillStyle = color;
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
      a += w / 2 / radius;
    }
    ctx.restore();
  }

  text(str, x, y, size, color, alpha = 1, stroke = true) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (stroke) {
      ctx.lineWidth = size * 0.24;
      ctx.strokeStyle = INK;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  drawPopups() {
    for (const p of this.popups) {
      const t = p.life / p.max;
      const sc = t < 0.25 ? easeOutBack(t / 0.25) : 1;
      const a = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      this.text(p.text, p.x, p.y, p.size * Math.max(0.1, sc), p.color, a);
    }
  }

  drawPowerFx() {
    const ctx = this.ctx;
    for (const k of ['frost', 'frenzy', 'double']) {
      const t = this.powers[k];
      if (t <= 0) continue;
      const fade = Math.min(1, t / 0.8);
      ctx.globalAlpha = (k === 'frost' ? 0.8 : 0.55) * fade * (0.85 + 0.15 * Math.sin(this.realT * 5));
      ctx.drawImage(this.vignettes[k], 0, 0, this.W, this.H);
    }
    ctx.globalAlpha = 1;
    if (this.powers.frost > 0) {
      const a = Math.min(1, this.powers.frost / 0.8) * 0.5;
      const s = this.base * 0.9;
      snowflakeCorner(ctx, s, this.H - s, s, a, this.realT);
      snowflakeCorner(ctx, this.W - s, this.H - s, s, a, -this.realT);
    }
  }

  drawReady() {
    const t = this.readyT;
    const W = this.W, H = this.H;
    if (t < 0.85) {
      const k = easeOutBack(Math.min(1, t / 0.3));
      this.text('READY?', W / 2, H * 0.42, this.base * 1.4 * k, '#fff1de');
      this.text(this.mode.tagline, W / 2, H * 0.42 + this.base * 1.5, this.base * 0.42, 'rgba(255,241,222,0.85)', Math.min(1, t * 3));
    } else {
      const u = (t - 0.85) / 0.65;
      if (u < 0.05 && !this.goPlayed) {
        this.goPlayed = true;
        this.sfx.go();
      }
      const k = easeOutBack(Math.min(1, u / 0.35));
      this.text('SLICE!', W / 2, H * 0.42, this.base * 1.8 * k, '#ffe36b', u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1);
    }
    if (t < 0.1) this.goPlayed = false;
  }

  drawBanner() {
    const b = this.banner;
    const k = easeOutBack(Math.min(1, b.t / 0.3));
    const a = b.t > b.dur - 0.3 ? (b.dur - b.t) / 0.3 : 1;
    this.text(b.text, this.W / 2, this.H * 0.4, this.base * 1.5 * k, b.color, a);
  }

  drawBoom() {
    const ctx = this.ctx;
    const b = this.boomAt;
    const k = clamp(b.t / 1.2, 0, 1);
    ctx.save();
    ctx.translate(b.x, b.y);
    const rays = 14;
    const len = Math.hypot(this.W, this.H) * easeOutCubic(k);
    ctx.fillStyle = `rgba(255,250,235,${0.85 - k * 0.3})`;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * TAU + b.t * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.06) * len, Math.sin(a - 0.06) * len);
      ctx.lineTo(Math.cos(a + 0.06) * len, Math.sin(a + 0.06) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${clamp((b.t - 0.6) / 0.6, 0, 1) * 0.9})`;
    ctx.fillRect(0, 0, this.W, this.H);
    if (b.t > 0.7) this.text('BOOM!', this.W / 2, this.H * 0.42, this.base * 1.8, '#ff5a5a');
  }
}

function snowflakeCorner(ctx, x, y, s, a, rot) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.rotate(rot * 0.3);
  snowflake(ctx, 0, 0, s, '#e9fbff', s * 0.09);
  ctx.restore();
}
