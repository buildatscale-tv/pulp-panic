// Player level, skill tree and the gameplay modifiers that skills and blades produce.
import { findBlade } from './themes.js';

export const MAX_LEVEL = 30;

// XP needed to go from `level` to `level + 1`.
export const xpToNext = (level) => 80 + level * 40;

export function levelInfo(xp) {
  let level = 1;
  let rest = xp;
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  const need = level >= MAX_LEVEL ? 0 : xpToNext(level);
  return { level, into: rest, need, frac: need ? rest / need : 1 };
}

// Each skill has 3 ranks; each rank costs 1 point. `effects[rank]` is shown to the player.
export const SKILLS = [
  { id: 'edge', name: 'Keen Edge', icon: '✦', effects: ['', 'Cut reach +8%', 'Cut reach +16%, slower swipes still cut', 'Cut reach +25%, slow swipes cut'] },
  { id: 'flow', name: 'Combo Flow', icon: '≋', effects: ['', 'Combo window +25%', 'Combo window +50%', 'Combo window +80%, combo bonus +1'] },
  { id: 'bulls', name: 'Bullseye', icon: '◎', effects: ['', 'Bullseye zone 1.5x, worth +3', 'Bullseye zone 2x, worth +4', 'Bullseye zone 2.5x, worth +5'] },
  { id: 'pouch', name: 'Seed Pouch', icon: '❀', effects: ['', 'Seeds +10%', 'Seeds +20%', 'Seeds +35%'] },
  { id: 'surge', name: 'Power Surge', icon: 'ϟ', effects: ['', 'Power-ups last +1s', 'Power-ups last +2s, appear more often', 'Power-ups last +3s, appear much more often'] },
  { id: 'sense', name: 'Bomb Sense', icon: '✸', effects: ['', 'Bombs flash a warning', 'Arcade bomb costs 6, not 10', 'First bomb each round fizzles out'] },
  { id: 'wind', name: 'Second Wind', icon: '♥︎', effects: ['', 'Classic: a life back every 90 points', 'Classic: a life back every 80 points', 'Classic: first miss each round is free'] },
  { id: 'time', name: 'Time Bender', icon: '◷', effects: ['', 'Arcade and Zen: +2 seconds', 'Arcade and Zen: +4 seconds', 'Arcade and Zen: +6 seconds'] },
  { id: 'gourd', name: 'Gourd Smasher', icon: '❂', effects: ['', 'Gourd stays +0.6s', 'Gourd stays +1.2s', 'Gourd stays +2s, +1 point per 10 hits'] },
];

export function skillRank(data, id) {
  return Math.max(0, Math.min(3, (data.skills && data.skills[id]) || 0));
}

export function pointsSpent(data) {
  return SKILLS.reduce((a, s) => a + skillRank(data, s.id), 0);
}

export function pointsAvailable(data) {
  return Math.max(0, levelInfo(data.xp || 0).level - 1 - pointsSpent(data));
}

// Everything the engine needs, from skills plus the equipped blade.
export function computeMods(data) {
  const r = (id) => skillRank(data, id);
  const blade = findBlade(data.blade);
  const spectrum = blade.perk === 'spectrum';
  return {
    reach: [1, 1.08, 1.16, 1.25][r('edge')],
    minSpeed: [1, 1, 0.85, 0.7][r('edge')],
    comboWindow: 0.22 * [1, 1.25, 1.5, 1.8][r('flow')],
    comboExtra: r('flow') >= 3 ? 1 : 0,
    comboMin: spectrum ? 2 : 3,
    comboMult: spectrum ? 1.5 : 1,
    bullZone: 0.08 * [1, 1.5, 2, 2.5][r('bulls')],
    bullPts: 2 + r('bulls'),
    seedMul: [1, 1.1, 1.2, 1.35][r('pouch')],
    powerExtra: [0, 1, 2, 3][r('surge')],
    powerFreq: [1, 1, 1.25, 1.5][r('surge')],
    bombWarn: r('sense') >= 1,
    bombPenalty: r('sense') >= 2 ? 6 : 10,
    bombShield: r('sense') >= 3 ? 1 : 0,
    lifeEvery: [100, 90, 80, 80][r('wind')],
    missShield: r('wind') >= 3 ? 1 : 0,
    timeBonus: [0, 2, 4, 6][r('time')],
    gourdExtra: [0, 0.6, 1.2, 2][r('gourd')],
    gourdBonus: r('gourd') >= 3,
    fingers: blade.fingers,
    perk: blade.perk,
  };
}
