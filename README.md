# Pulp Panic

An arcade fruit-slicing game for the browser and iPad. Plain HTML, CSS and JavaScript modules. No build step, no dependencies, no image or audio files: all art and sound is generated in code.

## Run

```bash
./start.sh
```

This starts the server on port 5178 and a Cloudflare quick tunnel, then prints a public `trycloudflare.com` link. Open that link on the iPad.

Only local: `node server.mjs`, then open http://localhost:5178.

## Deploy

Live at https://pulp-panic.fly.dev (also at `/pulp/`). Update it with:

```bash
fly deploy --remote-only --ha=false
```

Files: `Dockerfile`, `deploy/nginx.conf`, `fly.toml`. One small machine stays running.

Planned: `buildatscale.tv/pulp` through Cloudflare (`wrangler.jsonc`, `tools/build.sh`). This needs `wrangler login` first.

## Modes

- **Arcade**: 60 seconds. Bombs cost 10 points. Power-ups: Frostberry (slow time), Blazefig (fruit from the sides), Goldenberry (double points). At time-up, slash the Grand Gourd as many times as you can. End-of-round bonuses.
- **Classic**: no timer. Miss 3 fruit or cut 1 bomb and the round ends. Each 100 points gives back one miss.
- **Zen**: 90 seconds, no bombs.

Scoring: 1 point per fruit, combo bonus for 3+ fruit in one swipe, bullseye for a cut through the exact center, blitz for fast chains.

## Progress

Seeds are earned each round (score / 10, plus trophy rewards). Seeds unlock blades and backdrops in Collection. 15 trophies. Saved in `localStorage`.

## iPad

- Multi-touch: each finger is its own blade.
- Add to Home Screen for full-screen play (manifest + icons included). A service worker caches the game for offline play.
- Page zoom and scroll gestures are blocked during play.

## Files

- `public/js/game.js`: engine (input, physics, slicing, scoring, rendering)
- `public/js/art.js`: procedural fruit, bomb and power-up sprites
- `public/js/modes.js`: mode rules and wave director
- `public/js/audio.js`: synthesized sound effects and music
- `public/js/ui.js`: menu, HUD, results, collection, settings
- `public/js/themes.js`: blades and backdrops
- `public/js/trophies.js`: trophy list
- `tools/make-icons.cjs`: renders the app icons with the game art (needs Playwright)

Debug: add `?fps` to the URL to show the frame rate. `window.__pulp` is the game object.
