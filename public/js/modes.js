// Mode rules and the wave director that decides what to throw and when.
import { NORMAL_FRUITS } from './art.js';
import { rand, randInt, pick, clamp, lerp, weightedPick } from './util.js';

export const MODES = {
  arcade: {
    id: 'arcade', name: 'Arcade', time: 60, bombs: true, bombEndsGame: false, powerups: true,
    strikes: false, finale: true, blitz: true, fruit: 'watermelon',
    tagline: '60 seconds, power-ups, and a big finish',
  },
  classic: {
    id: 'classic', name: 'Classic', time: 0, bombs: true, bombEndsGame: true, powerups: false,
    strikes: true, finale: false, blitz: false, fruit: 'apple',
    tagline: 'Miss 3 fruit and you lose. One bomb ends it',
  },
  zen: {
    id: 'zen', name: 'Zen', time: 90, bombs: false, bombEndsGame: false, powerups: false,
    strikes: false, finale: false, blitz: true, fruit: 'peach',
    tagline: '90 calm seconds with no bombs',
  },
};

export const POWER_FRUIT = { frost: 'frost', frenzy: 'blaze', double: 'gold' };
export const POWER_TIME = { frost: 6, frenzy: 5.5, double: 8 };

export class Director {
  constructor(game, mode) {
    this.game = game;
    this.mode = mode;
    this.t = 0;
    this.waves = 0;
    this.nextWave = 0.35;
    this.queue = [];
    this.nextPower = mode.powerups ? rand(4.5, 7) / game.mods.powerFreq : Infinity;
    this.lastPower = null;
    this.frenzyNext = 0;
  }

  progress() {
    if (this.mode.id === 'classic') return clamp(this.t / 170 + this.game.score / 650, 0, 1);
    return clamp(this.t / this.mode.time, 0, 1);
  }

  interval(p) {
    let base;
    if (this.mode.id === 'classic') base = lerp(1.95, 1.0, p);
    else if (this.mode.id === 'arcade') base = lerp(1.4, 0.72, p);
    else base = lerp(1.15, 0.7, p);
    return base * rand(0.85, 1.15);
  }

  update(dt) {
    this.t += dt;
    const g = this.game;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.delay -= dt;
      if (q.delay <= 0) {
        this.queue.splice(i, 1);
        if (g.spawning) g.launch(q);
      }
    }
    if (!g.spawning) return;

    if (g.powers.frenzy > 0) {
      this.frenzyNext -= dt;
      if (this.frenzyNext <= 0) {
        this.frenzyNext = rand(0.08, 0.15);
        g.launch(g.sideLaunch(pick(NORMAL_FRUITS)));
      }
      return;
    }

    this.nextWave -= dt;
    if (this.nextWave <= 0) {
      this.wave();
      this.nextWave = this.interval(this.progress());
    }

    this.nextPower -= dt;
    if (this.nextPower <= 0) {
      if (g.timeLeft > 5) this.power();
      this.nextPower = rand(7, 11) / g.mods.powerFreq;
    }
  }

  power() {
    const kinds = ['frost', 'frenzy', 'double'].filter((k) => k !== this.lastPower);
    const k = pick(kinds);
    this.lastPower = k;
    const spec = this.game.bottomLaunch(POWER_FRUIT[k], { apexMin: 0.16, apexMax: 0.3 });
    spec.delay = 0;
    this.queue.push(spec);
  }

  wave() {
    const g = this.game, p = this.progress(), m = this.mode;
    this.waves++;
    let maxN;
    if (m.id === 'zen') maxN = 3 + Math.round(p * 4);
    else if (m.id === 'arcade') maxN = 2 + Math.round(p * 4);
    else maxN = 1 + Math.round(p * 4);
    let n = randInt(Math.max(1, Math.ceil(maxN * 0.45)), maxN);
    if (m.id === 'classic' && this.waves <= 3) n = Math.min(n, this.waves);

    let bombs = 0;
    if (m.bombs && this.waves > 2) {
      const chance = m.id === 'arcade' ? lerp(0.3, 0.6, p) : lerp(0.12, 0.5, p);
      if (Math.random() < chance) bombs = p > 0.55 && Math.random() < 0.3 ? 2 : 1;
    }

    const kinds = [];
    for (let i = 0; i < n; i++) kinds.push(pick(NORMAL_FRUITS));
    for (let b = 0; b < bombs; b++) kinds.splice(randInt(0, kinds.length), 0, 'bomb');

    const total = kinds.length;
    const pattern = weightedPick([
      ['volley', 4],
      ['spray', n >= 3 ? 2.2 : 0],
      ['line', n >= 3 ? 1.6 : 0],
      ['pair', total === 2 ? 3 : 0],
    ]);
    const sprayX = rand(0.3, 0.7) * g.W;

    kinds.forEach((type, i) => {
      let spec;
      const f = total > 1 ? i / (total - 1) : 0.5;
      if (pattern === 'spray') {
        spec = g.bottomLaunch(type, { x: sprayX + rand(-12, 12), spread: f - 0.5, apexMin: 0.14, apexMax: 0.26 });
        spec.delay = i * 0.06;
      } else if (pattern === 'line') {
        spec = g.bottomLaunch(type, { x: lerp(0.14, 0.86, f) * g.W, spread: 0 });
        spec.delay = i * 0.13;
      } else {
        spec = g.bottomLaunch(type);
        spec.delay = pattern === 'pair' ? 0 : rand(0, 0.55);
      }
      this.queue.push(spec);
    });
  }
}
