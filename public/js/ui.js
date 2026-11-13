// DOM screens: menu, HUD, pause, results, collection, settings, help.
import { BLADES, BACKDROPS, paintBackdrop } from './themes.js';
import { drawTrail } from './game.js';
import { TROPHIES } from './trophies.js';

const $ = (sel) => document.querySelector(sel);

export class UI {
  constructor(store) {
    this.store = store;
    this.game = null;
    this.el = {
      hud: $('#hud'), score: $('#score'), best: $('#best'), timer: $('#timer'), strikes: $('#strikes'),
      menu: $('#menu'), menuSeeds: $('#menuSeeds'), pause: $('#pause'), results: $('#results'),
      collection: $('#collection'), settings: $('#settings'), howto: $('#howto'), colGrid: $('#colGrid'),
    };
    this.chips = {};
    document.querySelectorAll('.chip').forEach((c) => (this.chips[c.dataset.power] = { el: c, bar: c.querySelector('i') }));
    this.shown = { score: -1, time: -1, strikes: -1, urgent: null, frozen: null };
    this.tab = 'blades';
    this.bind();
  }

  attach(game) {
    this.game = game;
  }

  setScoreIcon(url) {
    const img = $('#scoreIcon');
    if (img) img.src = url;
  }

  bind() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const g = this.game;
      if (g) g.sfx.unlock();
      if (g) g.sfx.ui();
      const act = btn.dataset.act;
      if (act === 'collection') this.openCollection();
      else if (act === 'howto') this.open('howto');
      else if (act === 'settings') this.openSettings();
      else if (act === 'fullscreen') this.toggleFullscreen();
      else if (act === 'close') this.closeModals();
      else if (act === 'resume') g.resume();
      else if (act === 'restart') { this.showPause(false); g.start(g.mode.id); }
      else if (act === 'quit') { this.showPause(false); g.toMenu(); }
      else if (act === 'retry') { this.el.results.hidden = true; g.start(g.mode.id); }
      else if (act === 'menu') { this.el.results.hidden = true; g.toMenu(); }
    });
    $('#pauseBtn').addEventListener('click', () => this.game && this.game.pause());
    document.querySelectorAll('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        this.tab = t.dataset.tab;
        document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
        this.renderCollection();
      }),
    );
    document.addEventListener('keydown', (e) => {
      if (!this.game) return;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.game.paused) this.game.resume();
        else if (this.game.isPlaying()) this.game.pause();
        else this.closeModals();
      }
    });
    // Close a modal when its dark backdrop is tapped.
    document.querySelectorAll('.modal').forEach((m) =>
      m.addEventListener('pointerdown', (e) => {
        if (e.target === m && (m.id === 'collection' || m.id === 'settings' || m.id === 'howto')) this.closeModals();
      }),
    );

    const s = this.store.data.settings;
    const sound = $('#setSound'), music = $('#setMusic'), shake = $('#setShake'), mouse = $('#setMouse');
    sound.addEventListener('change', () => {
      s.sound = sound.checked;
      if (this.game) {
        this.game.sfx.enabled = s.sound;
        this.game.music.fade();
      }
      this.store.save();
    });
    music.addEventListener('change', () => {
      s.music = music.checked;
      if (this.game) {
        this.game.music.enabled = s.music;
        this.game.sfx.unlock();
        this.game.music.start();
        this.game.music.fade();
      }
      this.store.save();
    });
    shake.addEventListener('change', () => { s.shake = shake.checked; this.store.save(); });
    mouse.addEventListener('change', () => { s.mouseHold = mouse.checked; this.store.save(); });
    const reset = $('#resetBtn');
    let armed = 0;
    reset.addEventListener('click', () => {
      if (Date.now() - armed < 3000) {
        this.store.reset();
        reset.textContent = 'Progress reset';
        armed = 0;
        if (this.game) {
          this.game.sfx.enabled = this.store.data.settings.sound;
          this.game.music.enabled = this.store.data.settings.music;
          this.game.music.fade();
          this.game.applyBackdrop();
        }
        this.openSettings();
        this.updateSeeds();
      } else {
        armed = Date.now();
        reset.textContent = 'Tap again to confirm';
        setTimeout(() => (reset.textContent = 'Reset progress'), 3000);
      }
    });

    const fsOk = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    if (!fsOk) $('#fsBtn').hidden = true;

    $('#tipClose').addEventListener('click', () => {
      this.store.data.tipDismissed = true;
      this.store.save();
      $('#tip').hidden = true;
      if (this.game) this.game.layoutMenu();
    });
  }

  // iPad/iPhone Safari outside home-screen mode.
  wantsHomeTip() {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && !navigator.standalone && !this.store.data.tipDismissed;
  }

  toast(title, sub) {
    const t = $('#toast');
    t.querySelector('b').textContent = title;
    t.querySelector('span').textContent = sub || '';
    t.classList.remove('out');
    t.hidden = false;
    clearTimeout(this.toastTimer);
    clearTimeout(this.toastTimer2);
    this.toastTimer = setTimeout(() => t.classList.add('out'), 2200);
    this.toastTimer2 = setTimeout(() => (t.hidden = true), 2550);
  }

  toggleFullscreen() {
    const d = document, el = d.documentElement;
    const isFs = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (isFs) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch {
      // Not supported here.
    }
  }

  open(id) {
    this.closeModals();
    this.el[id].hidden = false;
  }

  closeModals() {
    for (const id of ['collection', 'settings', 'howto']) this.el[id].hidden = true;
  }

  updateSeeds() {
    this.el.menuSeeds.textContent = `${this.store.data.seeds} seeds`;
  }

  showMenu() {
    this.el.hud.hidden = true;
    this.el.pause.hidden = true;
    this.el.results.hidden = true;
    this.el.menu.hidden = false;
    $('#tip').hidden = !this.wantsHomeTip();
    this.updateSeeds();
  }

  showHud(mode, best) {
    this.el.menu.hidden = true;
    this.closeModals();
    this.el.results.hidden = true;
    this.el.pause.hidden = true;
    this.el.hud.hidden = false;
    this.el.best.textContent = `BEST ${best || 0}`;
    this.el.timer.hidden = !mode.time;
    this.el.strikes.hidden = !mode.strikes;
    this.shown = { score: -1, time: -1, strikes: -1, urgent: null, frozen: null };
    for (const c of Object.values(this.chips)) c.el.hidden = true;
  }

  updateHud(g) {
    const sh = this.shown;
    if (g.score !== sh.score) {
      const up = g.score > sh.score && sh.score >= 0;
      sh.score = g.score;
      this.el.score.textContent = g.score;
      if (up) {
        this.el.score.classList.remove('bump');
        void this.el.score.offsetWidth;
        this.el.score.classList.add('bump');
      }
    }
    if (g.mode.time) {
      const t = Math.ceil(g.timeLeft);
      if (t !== sh.time) {
        sh.time = t;
        const m = Math.floor(t / 60), s = t % 60;
        this.el.timer.textContent = t >= 60 ? `${m}:${String(s).padStart(2, '0')}` : `${t}`;
      }
      const urgent = t <= 5 && g.state === 'play';
      if (urgent !== sh.urgent) { sh.urgent = urgent; this.el.timer.classList.toggle('urgent', urgent); }
      const frozen = g.powers.frost > 0;
      if (frozen !== sh.frozen) { sh.frozen = frozen; this.el.timer.classList.toggle('frozen', frozen); }
    }
    if (g.mode.strikes && g.strikes !== sh.strikes) {
      sh.strikes = g.strikes;
      this.el.strikes.querySelectorAll('b').forEach((b, i) => b.classList.toggle('hit', i < g.strikes));
    }
    for (const [k, c] of Object.entries(this.chips)) {
      const t = g.powers[k];
      const on = t > 0;
      if (c.el.hidden === on) c.el.hidden = !on;
      c.max = on ? Math.max(c.max || 0, t) : 0;
      if (on) c.bar.style.transform = `scaleX(${Math.min(1, t / c.max)})`;
    }
  }

  showPause(on) {
    this.el.pause.hidden = !on;
  }

  showResults(r) {
    this.el.hud.hidden = true;
    const titles = { time: "TIME'S UP!", bomb: 'BOOM!', strikes: 'GAME OVER' };
    $('#resTitle').textContent = titles[r.reason] || 'ROUND OVER';
    $('#resMode').textContent = `${r.mode.name} mode`;
    const scoreEl = $('#resScore');
    const bestEl = $('#resBest');
    bestEl.textContent = '';
    bestEl.classList.remove('new');
    const list = $('#resBonus');
    list.innerHTML = '';
    const pct = Math.round(r.accuracy * 100);
    const stats = [
      ['Sliced', r.sliced],
      ['Best combo', r.maxCombo || '-'],
      [r.mode.id === 'arcade' ? 'Gourd hits' : r.mode.id === 'classic' ? 'Bombs' : 'Combos', r.mode.id === 'arcade' ? r.gourd : r.mode.id === 'classic' ? r.bombs : r.combos],
    ];
    if (r.mode.id !== 'classic') stats[1] = ['Accuracy', `${pct}%`];
    $('#resStats').innerHTML = stats.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
    $('#resSeeds').textContent = `+${r.seeds} seeds (total ${r.totalSeeds})`;
    const un = $('#resUnlock');
    un.hidden = !r.unlocked.length;
    un.textContent = r.unlocked.length ? `New: ${r.unlocked.join(', ')}! Open Collection to use it.` : '';
    const tr = $('#resTrophy');
    tr.hidden = !r.trophies.length;
    tr.textContent = r.trophies.length ? `Trophy: ${r.trophies.map((t) => `${t.name} (+${t.seeds})`).join(', ')}` : '';
    this.el.results.hidden = false;

    // Count up the base score, then add each bonus.
    const g = this.game;
    let shown = 0;
    scoreEl.textContent = '0';
    const steps = [];
    const countTo = (target, dur) =>
      new Promise((res) => {
        const from = shown, t0 = performance.now();
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / dur);
          shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
          scoreEl.textContent = shown;
          if (k < 1 && !this.el.results.hidden) requestAnimationFrame(tick);
          else res();
        };
        tick();
      });
    const token = (this.resultToken = {});
    (async () => {
      await countTo(r.base, Math.min(900, 300 + r.base * 4));
      let running = r.base;
      for (let i = 0; i < r.bonuses.length; i++) {
        if (this.resultToken !== token) return;
        const b = r.bonuses[i];
        await new Promise((res) => setTimeout(res, 260));
        const li = document.createElement('li');
        li.innerHTML = `<span>${b.label}</span><b>+${b.pts}</b>`;
        list.appendChild(li);
        if (g) g.sfx.bonus(i);
        running += b.pts;
        await countTo(running, 300);
      }
      if (this.resultToken !== token) return;
      scoreEl.textContent = r.total;
      if (r.newBest && r.total > 0) {
        bestEl.textContent = 'NEW BEST!';
        bestEl.classList.add('new');
        if (g) g.sfx.lifeUp();
      } else {
        bestEl.textContent = `Best ${r.best}`;
      }
    })();
    void steps;
  }

  openSettings() {
    const s = this.store.data.settings;
    $('#setSound').checked = s.sound;
    $('#setMusic').checked = s.music;
    $('#setShake').checked = s.shake;
    $('#setMouse').checked = s.mouseHold;
    const d = this.store.data;
    $('#statsLine').textContent = `Rounds played: ${d.games}. Fruit sliced: ${d.fruits}. Best combo: ${d.bestCombo}.`;
    this.open('settings');
  }

  openCollection() {
    this.open('collection');
    this.renderCollection();
  }

  renderCollection() {
    const grid = this.el.colGrid;
    grid.innerHTML = '';
    grid.classList.toggle('list', this.tab === 'trophies');
    const d = this.store.data;
    if (this.tab === 'trophies') {
      const got = TROPHIES.filter((t) => d.trophies[t.id]).length;
      const head = document.createElement('p');
      head.className = 'sub';
      head.style.gridColumn = '1 / -1';
      head.style.margin = '0';
      head.textContent = `${got} of ${TROPHIES.length} earned`;
      grid.appendChild(head);
      for (const t of TROPHIES) {
        const on = !!d.trophies[t.id];
        const el = document.createElement('div');
        el.className = 'trophy' + (on ? '' : ' locked');
        el.innerHTML = `<div class="medal">${on ? '★' : '?'}</div><div><div class="tn"></div><div class="td"></div></div>`;
        el.querySelector('.tn').textContent = t.name;
        el.querySelector('.td').textContent = `${t.desc} · ${t.seeds} seeds`;
        grid.appendChild(el);
      }
      return;
    }
    const list = this.tab === 'blades' ? BLADES : BACKDROPS;
    const current = this.tab === 'blades' ? d.blade : d.backdrop;
    for (const item of list) {
      const locked = d.seeds < item.need;
      const btn = document.createElement('button');
      btn.className = 'item' + (item.id === current ? ' on' : '') + (locked ? ' locked' : '');
      const cv = document.createElement('canvas');
      cv.width = 300;
      cv.height = 172;
      btn.appendChild(cv);
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = item.name;
      const st = document.createElement('div');
      st.className = 'st';
      st.textContent = locked ? `Needs ${item.need} seeds` : item.id === current ? 'Equipped' : 'Tap to use';
      btn.append(nm, st);
      grid.appendChild(btn);
      this.paintPreview(cv, item);
      btn.addEventListener('click', () => {
        if (locked) return;
        if (this.tab === 'blades') d.blade = item.id;
        else {
          d.backdrop = item.id;
          if (this.game) this.game.applyBackdrop();
        }
        this.store.save();
        this.renderCollection();
      });
    }
  }

  paintPreview(cv, item) {
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    if (this.tab === 'backdrops') {
      const bg = paintBackdrop(item.id, w / 2, h / 2, 2);
      ctx.drawImage(bg, 0, 0, w, h);
      return;
    }
    const bg = paintBackdrop(this.store.data.backdrop, w / 2, h / 2, 2);
    ctx.drawImage(bg, 0, 0, w, h);
    const pts = [];
    const now = 10;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push({ x: w * (0.1 + 0.8 * t), y: h * (0.75 - Math.sin(t * Math.PI) * 0.45), t: now - 0.11 + t * 0.11 });
    }
    drawTrail(ctx, pts, item, now, 46);
  }
}
