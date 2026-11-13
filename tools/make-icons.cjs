// Renders the app icons with the game's own art module.
// Usage: NODE_PATH=<dir with playwright> node tools/make-icons.cjs  (server must run on :5178)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'icons');
const sizes = [
  ['icon-512.png', 512, false],
  ['icon-192.png', 192, false],
  ['apple-touch-icon.png', 180, false],
  ['icon-maskable-512.png', 512, true],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5178/', { waitUntil: 'networkidle' });
  for (const [name, size, maskable] of sizes) {
    const data = await page.evaluate(async ({ size, maskable }) => {
      const { Art, INK } = await import('/js/art.js');
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(size * 0.5, size * 0.6, 0, size * 0.5, size * 0.5, size * 0.75);
      g.addColorStop(0, '#7a2c6a');
      g.addColorStop(0.55, '#3a1a5c');
      g.addColorStop(1, '#160b2e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const k = maskable ? 0.78 : 1;
      const art = new Art();
      art.build(size * 0.2 * k, 1);
      const draw = (key, x, y, rot, scale, half) => {
        const s = art.sprites[key];
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(scale, scale);
        if (half) {
          ctx.beginPath();
          ctx.rect(-s.size, 0, s.size * 2, s.size);
          ctx.clip();
          ctx.drawImage(s.skin, -s.size / 2, -s.size / 2, s.size, s.size);
          ctx.drawImage(s.flesh, -s.size / 2, -s.size / 2, s.size, s.size);
        } else {
          ctx.drawImage(s.skin, -s.size / 2, -s.size / 2, s.size, s.size);
        }
        ctx.restore();
      };
      const cx = size / 2, cy = size / 2;
      // Two halves of a watermelon drifting apart, plus an orange half.
      draw('watermelon', cx - size * 0.06 * k, cy - size * 0.02 * k, Math.PI + 0.5, 1, true);
      draw('watermelon', cx + size * 0.04 * k, cy + size * 0.08 * k, 0.5, 1, true);
      draw('orange', cx + size * 0.24 * k, cy - size * 0.24 * k, -0.6, 0.7, true);
      // Blade slash.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(0.5);
      const L = size * 0.62 * k;
      const grad = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
      grad.addColorStop(0, 'rgba(120,225,255,0)');
      grad.addColorStop(1, 'rgba(120,225,255,0.8)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-L / 2, 0);
      ctx.lineTo(L / 2, -size * 0.035 * k);
      ctx.lineTo(L / 2, size * 0.035 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-L / 2, 0);
      ctx.lineTo(L / 2, -size * 0.014 * k);
      ctx.lineTo(L / 2, size * 0.014 * k);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      void INK;
      return c.toDataURL('image/png');
    }, { size, maskable });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote', name);
  }
  await browser.close();
})();
