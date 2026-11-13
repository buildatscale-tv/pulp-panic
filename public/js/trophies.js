// Trophies. Each gives seeds once. "live" trophies are checked during play, the rest at round end.
export const TROPHIES = [
  { id: 'first', name: 'First Cut', desc: 'Slice your first fruit', seeds: 5 },
  { id: 'combo4', name: 'Fruit Salad', desc: 'Get a 4 fruit combo', seeds: 15 },
  { id: 'combo6', name: 'Smoothie Maker', desc: 'Get a 6 fruit combo', seeds: 40 },
  { id: 'bulls10', name: 'Sharpshooter', desc: '10 bullseyes in one round', seeds: 30 },
  { id: 'blitz3', name: 'Lightning Hands', desc: 'Reach Blitz x3', seeds: 30 },
  { id: 'powers3', name: 'Power Trip', desc: 'Use all 3 power-ups in one round', seeds: 25 },
  { id: 'gourd30', name: 'Gourd Crusher', desc: 'Hit the Grand Gourd 30 times', seeds: 30 },
  { id: 'nobomb', name: 'Careful Blade', desc: 'Finish Arcade with no bomb hits', seeds: 15 },
  { id: 'arcade200', name: 'Arcade Ace', desc: 'Score 200 in Arcade', seeds: 30 },
  { id: 'arcade350', name: 'Arcade Legend', desc: 'Score 350 in Arcade', seeds: 60 },
  { id: 'classic100', name: 'Steady Hands', desc: 'Score 100 in Classic', seeds: 30 },
  { id: 'classic250', name: 'Unshakable', desc: 'Score 250 in Classic', seeds: 60 },
  { id: 'zen150', name: 'Inner Peace', desc: 'Score 150 in Zen', seeds: 30 },
  { id: 'barista', name: 'Head Barista', desc: 'Serve 6 orders in one Smoothie Rush', seeds: 40 },
  { id: 'dailyfirst', name: 'Daily Grind', desc: 'Reach the Daily Challenge goal', seeds: 20 },
  { id: 'streak3', name: 'On a Roll', desc: 'Reach the daily goal 3 days in a row', seeds: 60 },
  { id: 'fruit1000', name: 'Orchard Keeper', desc: 'Slice 1,000 fruit in total', seeds: 50 },
  { id: 'rounds25', name: 'Regular', desc: 'Play 25 rounds', seeds: 40 },
];

export function findTrophy(id) {
  return TROPHIES.find((t) => t.id === id);
}

// Ids earned by a finished round (r = round summary, d = saved data after the round).
export function roundTrophies(r, d) {
  const ids = [];
  if (r.mode === 'arcade') {
    if (r.bombs === 0) ids.push('nobomb');
    if (r.total >= 200) ids.push('arcade200');
    if (r.total >= 350) ids.push('arcade350');
  }
  if (r.mode === 'classic') {
    if (r.total >= 100) ids.push('classic100');
    if (r.total >= 250) ids.push('classic250');
  }
  if (r.mode === 'zen' && r.total >= 150) ids.push('zen150');
  if (r.mode === 'smoothie' && r.orders >= 6) ids.push('barista');
  if (r.dailyDone) ids.push('dailyfirst');
  if (d.daily && d.daily.streak >= 3) ids.push('streak3');
  if (d.fruits >= 1000) ids.push('fruit1000');
  if (d.games >= 25) ids.push('rounds25');
  return ids;
}
