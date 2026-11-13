// Saved progress in localStorage. The game works when storage is blocked; it only stops saving.
const KEY = 'pulp-panic-v1';

const defaults = () => ({
  best: { arcade: 0, classic: 0, zen: 0 },
  seeds: 0,
  games: 0,
  fruits: 0,
  bestCombo: 0,
  blade: 'spark',
  backdrop: 'slate',
  v: 2,
  settings: { sound: true, music: true, shake: true, mouseHold: true },
  trophies: {},
  tipDismissed: false,
});

export class Store {
  constructor() {
    this.data = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const d = defaults();
        this.data = { ...d, ...saved, best: { ...d.best, ...saved.best }, settings: { ...d.settings, ...saved.settings }, trophies: { ...saved.trophies } };
      }
    } catch {
      // Keep defaults.
    }
    // Version 2 switched the default backdrop to the realistic slate.
    if (!this.data.v || this.data.v < 2) {
      this.data.backdrop = 'slate';
      this.data.v = 2;
      this.save();
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage blocked (private mode). Ignore.
    }
  }

  reset() {
    this.data = defaults();
    this.save();
  }
}
