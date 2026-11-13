// Synthesized sound effects. No audio files.
import { bakeAll } from './baked.js';

export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastSwoosh = 0;
    this.baked = null;
    this.fuseLevel = -1;
  }

  // Must run inside a user gesture (iOS needs this).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // Music bus: own gain and a low-pass filter (used for the freeze effect).
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 16000;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicFilter.connect(this.musicGain);
      this.musicGain.connect(comp);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // Play one silent buffer so iOS fully unlocks output.
      const s = this.ctx.createBufferSource();
      s.buffer = this.ctx.createBuffer(1, 1, 22050);
      s.connect(this.ctx.destination);
      s.start(0);
      bakeAll()
        .then((b) => {
          this.baked = b;
          this.startFuseLoop();
        })
        .catch((e) => console.warn('Sound bake failed, using simple sounds', e));
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ok() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  env(gainNode, t, peak, attack, release) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  noise({ dur = 0.2, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 0.4, attack = 0.005, delay = 0 }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, gain, attack, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + attack + 0.05);
  }

  tone({ f0 = 440, f1 = f0, dur = 0.15, type = 'sine', gain = 0.3, attack = 0.005, delay = 0 }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, gain, attack, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + attack + 0.05);
  }

  playBuf(buf, rate = 1, gain = 1, delay = 0) {
    if (!this.ok || !buf) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(g).connect(this.master);
    s.start(c.currentTime + delay);
  }

  startFuseLoop() {
    const c = this.ctx;
    this.fuseGain = c.createGain();
    this.fuseGain.gain.value = 0;
    const s = c.createBufferSource();
    s.buffer = this.baked.fuse;
    s.loop = true;
    s.connect(this.fuseGain).connect(this.master);
    s.start();
  }

  // Fuse sizzle level follows the number of live bombs.
  setFuse(n) {
    if (!this.fuseGain) return;
    const level = this.enabled && n > 0 ? Math.min(0.42, 0.24 + 0.07 * n) : 0;
    if (level === this.fuseLevel) return;
    this.fuseLevel = level;
    this.fuseGain.gain.setTargetAtTime(level, this.ctx.currentTime, level ? 0.03 : 0.08);
  }

  swoosh(speed = 1) {
    if (!this.ok) return;
    const now = performance.now();
    if (now - this.lastSwoosh < 140) return;
    this.lastSwoosh = now;
    if (this.baked) {
      const b = this.baked.swoosh[Math.floor(Math.random() * this.baked.swoosh.length)];
      this.playBuf(b, 0.9 + Math.random() * 0.25, Math.min(0.5, 0.18 + speed * 0.15));
      return;
    }
    const p = 0.85 + Math.random() * 0.3;
    this.noise({ dur: 0.16, type: 'bandpass', f0: 500 * p, f1: 2600 * p, q: 1.6, gain: Math.min(0.22, 0.08 + speed * 0.05), attack: 0.02 });
  }

  slice(pitch = 1) {
    if (this.baked) {
      const list = this.baked.slice;
      this.playBuf(list[Math.floor(Math.random() * list.length)], pitch * (0.93 + Math.random() * 0.14), 1);
      return;
    }
    const p = pitch * (0.9 + Math.random() * 0.2);
    this.noise({ dur: 0.09, type: 'highpass', f0: 3200 * p, f1: 1400 * p, q: 0.8, gain: 0.35 });
    this.noise({ dur: 0.18, type: 'lowpass', f0: 1400 * p, f1: 260, q: 4, gain: 0.45, delay: 0.01 });
    this.tone({ f0: 260 * p, f1: 110 * p, dur: 0.1, type: 'triangle', gain: 0.18 });
  }

  splat() {
    if (this.baked) return; // The baked slice already has the splash.
    this.noise({ dur: 0.22, type: 'lowpass', f0: 700, f1: 120, q: 6, gain: 0.3, delay: 0.03 });
  }

  launch() {
    this.noise({ dur: 0.14, type: 'lowpass', f0: 380, f1: 900, q: 1, gain: 0.12 });
  }

  combo(n) {
    const scale = [0, 4, 7, 12, 16, 19, 24, 28];
    for (let i = 0; i < Math.min(n, 8); i++) {
      const f = 523.25 * Math.pow(2, scale[i] / 12);
      this.tone({ f0: f, f1: f * 1.01, dur: 0.12, type: 'triangle', gain: 0.2, delay: i * 0.055 });
    }
  }

  blitz() {
    this.tone({ f0: 880, f1: 1760, dur: 0.18, type: 'square', gain: 0.07 });
    this.tone({ f0: 1320, f1: 2640, dur: 0.18, type: 'triangle', gain: 0.12, delay: 0.04 });
  }

  core() {
    this.tone({ f0: 1567, f1: 1600, dur: 0.25, type: 'sine', gain: 0.2 });
    this.tone({ f0: 2349, f1: 2400, dur: 0.3, type: 'sine', gain: 0.12, delay: 0.05 });
  }

  bomb(big = false) {
    if (this.baked) {
      this.playBuf(big ? this.baked.bigBomb : this.baked.bomb, 0.96 + Math.random() * 0.08, 1.1);
      return;
    }
    this.tone({ f0: 140, f1: 28, dur: 0.9, type: 'sine', gain: 0.9 });
    this.noise({ dur: 1.1, type: 'lowpass', f0: 1800, f1: 80, q: 0.7, gain: 0.9 });
    this.noise({ dur: 0.3, type: 'highpass', f0: 4000, f1: 1500, q: 0.7, gain: 0.3 });
  }

  fuse() {
    if (this.baked) return; // The fuse loop covers this.
    this.noise({ dur: 0.35, type: 'highpass', f0: 5000, f1: 6000, q: 0.5, gain: 0.05 });
  }

  power(kind) {
    if (kind === 'frost') {
      [1318, 1760, 2093, 2637].forEach((f, i) => this.tone({ f0: f, f1: f * 0.98, dur: 0.35, type: 'sine', gain: 0.14, delay: i * 0.06 }));
      this.noise({ dur: 0.5, type: 'highpass', f0: 6000, f1: 3000, gain: 0.08 });
    } else if (kind === 'frenzy') {
      this.noise({ dur: 0.5, type: 'bandpass', f0: 300, f1: 2400, q: 1.2, gain: 0.35 });
      [392, 523, 659, 784].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.12, type: 'sawtooth', gain: 0.07, delay: i * 0.05 }));
    } else {
      [784, 988, 1175, 1568].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.22, type: 'triangle', gain: 0.16, delay: i * 0.05 }));
    }
  }

  tick(urgent) {
    this.tone({ f0: urgent ? 1200 : 900, f1: urgent ? 1200 : 900, dur: 0.04, type: 'square', gain: 0.06 });
  }

  strike() {
    this.tone({ f0: 330, f1: 160, dur: 0.3, type: 'sawtooth', gain: 0.12 });
    this.tone({ f0: 220, f1: 110, dur: 0.35, type: 'square', gain: 0.06, delay: 0.05 });
  }

  lifeUp() {
    [660, 880, 1320].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.14, type: 'triangle', gain: 0.18, delay: i * 0.07 }));
  }

  go() {
    this.tone({ f0: 523, f1: 523, dur: 0.12, type: 'triangle', gain: 0.2 });
    this.tone({ f0: 784, f1: 784, dur: 0.12, type: 'triangle', gain: 0.2, delay: 0.1 });
    this.tone({ f0: 1046, f1: 1050, dur: 0.3, type: 'triangle', gain: 0.22, delay: 0.2 });
  }

  ready() {
    this.tone({ f0: 392, f1: 392, dur: 0.14, type: 'triangle', gain: 0.16 });
  }

  timeUp() {
    this.tone({ f0: 880, f1: 440, dur: 0.6, type: 'square', gain: 0.08 });
    this.tone({ f0: 660, f1: 330, dur: 0.6, type: 'triangle', gain: 0.18, delay: 0.05 });
  }

  gameOver() {
    [523, 440, 349, 262].forEach((f, i) => this.tone({ f0: f, f1: f * 0.97, dur: 0.3, type: 'triangle', gain: 0.18, delay: i * 0.16 }));
  }

  gourdHit(n) {
    const p = 1 + Math.min(n, 40) * 0.025;
    this.tone({ f0: 180 * p, f1: 90 * p, dur: 0.12, type: 'sine', gain: 0.5 });
    this.noise({ dur: 0.1, type: 'bandpass', f0: 1800 * p, f1: 900 * p, q: 2, gain: 0.25 });
  }

  burst() {
    this.noise({ dur: 0.8, type: 'lowpass', f0: 3000, f1: 200, q: 0.8, gain: 0.7 });
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.25, type: 'triangle', gain: 0.15, delay: 0.1 + i * 0.06 }));
  }

  ui() {
    this.tone({ f0: 660, f1: 880, dur: 0.06, type: 'triangle', gain: 0.12 });
  }

  bonus(i) {
    const f = 660 * Math.pow(2, (i * 2) / 12);
    this.tone({ f0: f, f1: f, dur: 0.12, type: 'triangle', gain: 0.16 });
  }

  fizzle() {
    this.noise({ dur: 0.4, type: 'highpass', f0: 3500, f1: 900, q: 0.7, gain: 0.22 });
    this.tone({ f0: 240, f1: 70, dur: 0.3, type: 'triangle', gain: 0.12, delay: 0.05 });
  }

  trophy() {
    [784, 1046, 1318, 1568, 2093].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.18, type: 'triangle', gain: 0.14, delay: i * 0.07 }));
  }
}

// Small generative music loop. intensity: 0 = menu, 1 = play, 2 = frenzy.
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
const CHORDS = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am F C G (MIDI)
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.enabled = true;
    this.intensity = 0;
    this.step = 0;
    this.nextTime = 0;
    this.bpm = 104;
    this.frozen = false;
    this.timer = null;
  }

  start() {
    const s = this.sfx;
    if (!s.ctx || this.timer) return;
    this.nextTime = s.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
    this.fade();
  }

  fade() {
    const s = this.sfx;
    if (!s.ctx) return;
    const on = this.enabled && s.enabled;
    const g = s.musicGain.gain;
    g.cancelScheduledValues(s.ctx.currentTime);
    g.setTargetAtTime(on ? 0.32 : 0, s.ctx.currentTime, 0.4);
  }

  duck(on) {
    const s = this.sfx;
    if (!s.ctx) return;
    if (on) s.musicGain.gain.setTargetAtTime(0.06 * (this.enabled && s.enabled ? 1 : 0), s.ctx.currentTime, 0.2);
    else this.fade();
  }

  setFrozen(frozen) {
    if (frozen === this.frozen || !this.sfx.ctx) return;
    this.frozen = frozen;
    this.sfx.musicFilter.frequency.setTargetAtTime(frozen ? 700 : 16000, this.sfx.ctx.currentTime, 0.15);
  }

  schedule() {
    const c = this.sfx.ctx;
    if (!c || c.state !== 'running') return;
    if (!(this.enabled && this.sfx.enabled)) return;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  voice(t, freq, dur, type, gain, f1 = freq) {
    const c = this.sfx.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (f1 !== freq) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx.musicFilter);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hat(t, gain) {
    const c = this.sfx.ctx;
    const src = c.createBufferSource();
    src.buffer = this.sfx.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.sfx.musicFilter);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }

  playStep(step, t) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = CHORDS[bar];
    const I = this.intensity;
    // Bass.
    if ([0, 6, 10].includes(s) || (I > 0 && s === 13)) this.voice(t, midi(chord[0] - 24), 0.28, 'triangle', 0.5);
    // Kick and hats while playing.
    if (I > 0 && (s === 0 || s === 8 || (I > 1 && s === 12))) this.voice(t, 130, 0.2, 'sine', 0.6, 45);
    if (I > 0 && s % 2 === 1) this.hat(t, I > 1 ? 0.12 : 0.06);
    if (I > 1 && s % 2 === 0 && s % 4 !== 0) this.hat(t, 0.05);
    // Chord pad on bar start.
    if (s === 0) for (const n of chord) this.voice(t, midi(n), 2.0, 'sine', 0.06);
    // Plucked melody from a pentatonic scale.
    const p = I === 0 ? 0.22 : 0.34;
    if (s % 2 === 0 && Math.random() < p) {
      const n = 69 + SCALE[Math.floor(Math.random() * SCALE.length)];
      this.voice(t, midi(n), 0.22, 'triangle', 0.12);
    }
  }
}
