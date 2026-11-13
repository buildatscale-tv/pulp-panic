export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Closest distance from point (cx, cy) to segment (x1, y1)-(x2, y2).
export function segDist(x1, y1, x2, y2, cx, cy) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const px = x1 + t * dx - cx, py = y1 + t * dy - cy;
  return Math.sqrt(px * px + py * py);
}

export function weightedPick(entries) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = Math.random() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}
