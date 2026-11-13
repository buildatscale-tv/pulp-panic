// Pre-rendered sound effects. Each one is built once with an OfflineAudioContext
// from many layers, then played back as a buffer with small pitch changes.
const SR = 44100;
const rand = (a, b) => a + Math.random() * (b - a);

function offline(dur) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new OAC(1, Math.ceil(SR * dur), SR);
}

function render(ctx) {
  return new Promise((resolve, reject) => {
    ctx.oncomplete = (e) => resolve(e.renderedBuffer);
    const p = ctx.startRendering();
    if (p && p.then) p.then(resolve, reject);
  });
}

function whiteNoise(ctx, dur = 2) {
  const b = ctx.createBuffer(1, Math.ceil(SR * dur), SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// Deep rumble noise (random walk, high-passed by the leak factor).
function brownNoise(ctx, dur = 4) {
  const b = ctx.createBuffer(1, Math.ceil(SR * dur), SR);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return b;
}

function src(ctx, buf, t, dur, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  const maxOff = Math.max(0, buf.duration - dur * rate - 0.01);
  s.start(t, Math.random() * maxOff);
  s.stop(t + dur);
  return s;
}

function filt(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// Linear attack, exponential decay.
function env(ctx, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

// A gain that wobbles randomly while it decays (wet, uneven texture).
function flutter(ctx, t, dur, peak, steps = 48, power = 2) {
  const g = ctx.createGain();
  const curve = new Float32Array(steps);
  for (let k = 0; k < steps; k++) curve[k] = Math.pow(1 - k / steps, power) * (0.5 + 0.5 * Math.random()) * peak;
  curve[steps - 1] = 0;
  g.gain.setValueAtTime(0, 0);
  g.gain.setValueCurveAtTime(curve, t, dur);
  return g;
}

function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

function softClip(ctx, k) {
  const ws = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  ws.curve = curve;
  return ws;
}

// Juicy slice: blade swish + crisp cut + wet grains + juice splash + drips.
async function slice() {
  const ctx = offline(0.5);
  const out = ctx.createGain();
  out.gain.value = 0.85;
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1.5);

  // Blade swish: bright band of noise that rises fast.
  {
    const bp = filt(ctx, 'bandpass', 2400, 0.9);
    bp.frequency.setValueAtTime(2000, 0);
    bp.frequency.exponentialRampToValueAtTime(7000, 0.07);
    chain(src(ctx, w, 0, 0.12), bp, env(ctx, 0, 0.42, 0.006, 0.07), out);
  }
  // Crisp cut through skin.
  chain(src(ctx, w, 0.008, 0.07), filt(ctx, 'highpass', 2600), filt(ctx, 'lowpass', 10000), env(ctx, 0.008, 0.38, 0.001, 0.03), out);
  // Wet tearing: many short grains of band-limited noise.
  for (let i = 0; i < 26; i++) {
    const t = 0.012 + Math.pow(Math.random(), 1.6) * 0.22;
    const d = rand(0.006, 0.024);
    const peak = rand(0.1, 0.3) * Math.max(0.15, 1 - (t - 0.012) / 0.26);
    chain(src(ctx, w, t, d + 0.012, rand(0.7, 1.3)), filt(ctx, 'bandpass', rand(450, 2800), rand(2, 6)), env(ctx, t, peak, 0.0008, d), out);
  }
  // Juice splash body: soft low noise with an uneven, wet level.
  {
    const lp = filt(ctx, 'lowpass', 1200, 0.5);
    lp.frequency.setValueAtTime(1300, 0.01);
    lp.frequency.exponentialRampToValueAtTime(280, 0.32);
    chain(src(ctx, w, 0.01, 0.36), lp, flutter(ctx, 0.01, 0.32, 0.34), out);
  }
  // A few droplets.
  for (let i = 0; i < 2; i++) {
    const t = rand(0.07, 0.3);
    const f0 = rand(900, 1700);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.7, t + 0.022);
    chain(o, env(ctx, t, rand(0.012, 0.025), 0.002, 0.03), out);
    o.start(t);
    o.stop(t + 0.06);
  }
  return render(ctx);
}

// Blade swoosh: air swell with a faint metal shimmer.
async function swoosh() {
  const ctx = offline(0.3);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1);
  const bp = filt(ctx, 'bandpass', 800, 1.2);
  bp.frequency.setValueAtTime(600, 0);
  bp.frequency.exponentialRampToValueAtTime(3200, 0.12);
  bp.frequency.exponentialRampToValueAtTime(1800, 0.25);
  chain(src(ctx, w, 0, 0.28), bp, env(ctx, 0, 0.55, 0.05, 0.18), out);
  for (const f of [5200, 6900]) {
    const o = ctx.createOscillator();
    o.frequency.value = f * rand(0.97, 1.03);
    chain(o, env(ctx, 0.03, 0.012, 0.03, 0.12), out);
    o.start(0.03);
    o.stop(0.25);
  }
  return render(ctx);
}

// Explosion: crack, distorted sub boom, blast, long rumble, debris, echo.
async function bomb(big) {
  const dur = big ? 2.0 : 1.3;
  const ctx = offline(dur);
  const mix = ctx.createGain();
  const clip = softClip(ctx, big ? 3.2 : 2.6);
  const tone = filt(ctx, 'lowpass', 9000);
  const master = ctx.createGain();
  master.gain.value = 0.95;
  chain(mix, clip, tone, master, ctx.destination);
  // Short echo for space.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.07;
  const fb = ctx.createGain();
  fb.gain.value = 0.08;
  const dl = filt(ctx, 'lowpass', 1400);
  chain(master, delay, dl, fb, delay);
  const wet = ctx.createGain();
  wet.gain.value = 0.12;
  chain(dl, wet, ctx.destination);

  const w = whiteNoise(ctx, 2);
  const br = brownNoise(ctx, dur + 0.5);
  // Crack (the first hit).
  chain(src(ctx, w, 0, 0.12), filt(ctx, 'highpass', 700), env(ctx, 0, 1.0, 0.0008, 0.06), mix);
  // Sub boom: falling sine, driven into the clipper.
  {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(big ? 75 : 90, 0);
    o.frequency.exponentialRampToValueAtTime(28, big ? 0.9 : 0.6);
    chain(o, env(ctx, 0, 1.1, 0.004, big ? 1.0 : 0.7), mix);
    o.start(0);
    o.stop(dur);
  }
  // Mid punch.
  {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, 0);
    o.frequency.exponentialRampToValueAtTime(45, 0.35);
    chain(o, env(ctx, 0, 0.55, 0.003, 0.32), mix);
    o.start(0);
    o.stop(0.5);
  }
  // Blast: broadband noise that closes down.
  {
    const lp = filt(ctx, 'lowpass', 5000, 0.6);
    lp.frequency.setValueAtTime(5000, 0.002);
    lp.frequency.exponentialRampToValueAtTime(260, 0.75);
    chain(src(ctx, w, 0.002, 0.8), lp, env(ctx, 0.002, 0.95, 0.002, 0.55), mix);
  }
  // Long rumble.
  chain(src(ctx, br, 0.02, dur - 0.05), filt(ctx, 'lowpass', big ? 180 : 230), flutter(ctx, 0.02, dur - 0.1, big ? 1.4 : 1.1, 64, 2.6), mix);
  // Debris and crackle.
  const n = big ? 60 : 40;
  for (let i = 0; i < n; i++) {
    const t = 0.08 + Math.pow(Math.random(), 1.5) * dur * 0.35;
    const d = rand(0.003, 0.014);
    const peak = rand(0.08, 0.28) * (1 - t / dur);
    chain(src(ctx, w, t, d + 0.01), filt(ctx, 'bandpass', rand(1200, 6500), rand(2, 5)), env(ctx, t, peak, 0.0005, d), mix);
  }
  // Ears ringing after the big one.
  if (big) {
    const o = ctx.createOscillator();
    o.frequency.value = 3900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, 0.15);
    g.gain.linearRampToValueAtTime(0.035, 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, dur - 0.1);
    o.connect(g).connect(ctx.destination);
    o.start(0.15);
    o.stop(dur);
  }
  return render(ctx);
}

// Burning fuse: steady hiss plus sparks, made to loop.
async function fuse() {
  const dur = 1.2;
  const ctx = offline(dur);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 2);
  const hiss = ctx.createGain();
  hiss.gain.value = 0.22;
  chain(src(ctx, w, 0, dur), filt(ctx, 'highpass', 4500), filt(ctx, 'lowpass', 11000), hiss, out);
  for (let i = 0; i < 70; i++) {
    const t = Math.random() * (dur - 0.02);
    const d = rand(0.001, 0.004);
    chain(src(ctx, w, t, d + 0.006), filt(ctx, 'bandpass', rand(2500, 7000), 2), env(ctx, t, rand(0.15, 0.55), 0.0003, d), out);
  }
  const b = await render(ctx);
  // Cross-fade the ends so the loop has no click.
  const d = b.getChannelData(0);
  const fade = Math.floor(SR * 0.03);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    d[i] = d[i] * k + d[d.length - fade + i] * (1 - k);
  }
  return b;
}

// Fade the last part of a buffer to silence.
function fadeTail(buf, sec) {
  const d = buf.getChannelData(0);
  const n = Math.min(d.length, Math.floor(SR * sec));
  for (let i = 0; i < n; i++) d[d.length - n + i] *= Math.pow(1 - i / n, 2);
  return buf;
}

// Scale a buffer so its loudest sample is at the target peak.
function normalize(buf, target) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) {
    const k = target / peak;
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return buf;
}

export async function bakeAll() {
  const [s1, s2, s3, s4, w1, w2, w3, b1, b2, f] = await Promise.all([
    slice(), slice(), slice(), slice(), swoosh(), swoosh(), swoosh(), bomb(false), bomb(true), fuse(),
  ]);
  return {
    slice: [s1, s2, s3, s4].map((b) => normalize(b, 0.8)),
    swoosh: [w1, w2, w3].map((b) => normalize(b, 0.6)),
    bomb: fadeTail(normalize(b1, 0.95), 0.35),
    bigBomb: fadeTail(normalize(b2, 0.95), 0.5),
    fuse: normalize(f, 0.45),
  };
}
