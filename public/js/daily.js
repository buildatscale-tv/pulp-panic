// Daily Challenge: two rule twists per day, picked from the date, plus a goal score.

export const DAILY_MODS = [
  { id: 'lowgrav', name: 'Low Gravity', desc: 'Fruit floats longer', group: 'grav', apply: (r) => { r.gravity = 0.72; } },
  { id: 'highgrav', name: 'Heavy Gravity', desc: 'Fruit falls fast', group: 'grav', apply: (r) => { r.gravity = 1.3; r.goalAdj -= 20; } },
  { id: 'citrus', name: 'Citrus Only', desc: 'Only oranges, lemons, and limes', group: 'pool', apply: (r) => { r.pool = ['orange', 'lemon', 'lime']; } },
  { id: 'melons', name: 'Melon Madness', desc: 'Mostly watermelons', group: 'pool', apply: (r) => { r.pool = ['watermelon', 'watermelon', 'watermelon', 'coconut', 'mango']; } },
  { id: 'tropical', name: 'Tropical', desc: 'Mango, coconut, dragon fruit, and kiwi', group: 'pool', apply: (r) => { r.pool = ['mango', 'coconut', 'dragon', 'kiwi']; } },
  { id: 'bombstorm', name: 'Bomb Storm', desc: 'Twice the bombs', group: 'bomb', apply: (r) => { r.bombMul = 2; r.goalAdj -= 20; } },
  { id: 'safe', name: 'Safe Skies', desc: 'No bombs at all', group: 'bomb', apply: (r) => { r.bombMul = 0; r.goalAdj += 20; } },
  { id: 'swarm', name: 'Swarm', desc: 'Bigger waves of fruit', group: 'wave', apply: (r) => { r.waveMul = 1.6; r.intervalMul = 1.2; r.goalAdj += 40; } },
  { id: 'powerparty', name: 'Power Party', desc: 'Power-ups twice as often', group: 'power', apply: (r) => { r.powerMul = 2; r.goalAdj += 20; } },
  { id: 'golden', name: 'Golden Hour', desc: 'Lots of gold fruit worth +3', group: 'gold', apply: (r) => { r.golden = 0.18; r.goalAdj += 40; } },
  { id: 'blitz', name: 'Blitz Bonanza', desc: 'Blitz bonuses are doubled', group: 'blitz', apply: (r) => { r.blitzMul = 2; r.goalAdj += 10; } },
];

export const DAILY_REWARD = 60;

// Local calendar date, so the challenge changes at the player's midnight.
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function previousKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function dailyFor(key = dateKey()) {
  const rnd = seeded(`pulp-${key}`);
  const first = DAILY_MODS[Math.floor(rnd() * DAILY_MODS.length)];
  const rest = DAILY_MODS.filter((m) => m.group !== first.group);
  const second = rest[Math.floor(rnd() * rest.length)];
  const rules = { gravity: 1, pool: null, bombMul: 1, waveMul: 1, intervalMul: 1, powerMul: 1, golden: 0, blitzMul: 1, goalAdj: 0 };
  first.apply(rules);
  second.apply(rules);
  const target = Math.max(100, 150 + Math.floor(rnd() * 5) * 20 + rules.goalAdj);
  return { key, mods: [first, second], rules, target };
}
