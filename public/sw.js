// Network first, cache as fallback: updates show at once, and the game still loads offline.
const CACHE = 'pulp-panic-v4';
const CORE = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/art.js', 'js/audio.js', 'js/modes.js', 'js/store.js', 'js/themes.js', 'js/ui.js', 'js/util.js', 'js/trophies.js', 'js/baked.js', 'js/progression.js', 'js/daily.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (new URL(req.url).origin === location.origin || req.url.includes('fonts.g'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
