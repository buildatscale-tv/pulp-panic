import { Store } from './store.js';
import { UI } from './ui.js';
import { Game } from './game.js';

// Block page zoom and scroll gestures (iPad Safari ignores user-scalable=no).
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (!e.target.closest('.card')) e.preventDefault();
  },
  { passive: false },
);
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300 && !e.target.closest('button, input, label')) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

function boot() {
  const store = new Store();
  const ui = new UI(store);
  const game = new Game(document.getElementById('game'), ui, store);
  ui.attach(game);
  ui.updateSeeds();
  window.__pulp = game;
}

// Wait for the display font so canvas text uses it, but never block long.
const fontReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('40px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
fontReady.then(boot, boot);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
