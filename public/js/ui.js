// DOM screens: menu, HUD, pause, results, collection, settings, help.
import { BLADES, BACKDROPS, paintBackdrop } from './themes.js';
import { MODES } from './modes.js';
import { drawTrail } from './game.js';
import { TROPHIES } from './trophies.js';
import { SKILLS, levelInfo, pointsAvailable, skillRank } from './progression.js';

const $ = (sel) => document.querySelector(sel);

export class UI {
  constructor(store) {
    this.store = store;
    this.game = null;
    this.el = {
      hud: $('#hud'), score: $('#score'), best: $('#best'), timer: $('#timer'), strikes: $('#strikes'),
      menu: $('#menu'), menuSeeds: $('#menuSeeds'), pause: $('#pause'), results: $('#results'),
      collection: $('#collection'), settings: $('#settings'), howto: $('#howto'), colGrid: $('#colGrid'),
      skills: $('#skills'),
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
      else if (act === 'skills') this.openSkills();
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
        if (e.target === m && ['collection', 'settings', 'howto', 'skills'].includes(m.id)) this.closeModals();
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
          this.game.refreshMods();
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

    $('#skReset').addEventListener('click', () => {
      this.store.data.skills = {};
      this.store.save();
      if (this.game) this.game.refreshMods();
      this.renderSkills();
      this.updateSeeds();
    });

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
    for (const id of ['collection', 'settings', 'howto', 'skills']) this.el[id].hidden = true;
    this.updateSeeds();
  }

  // Menu pill: level, XP bar and seeds. Badge on Skills when points are waiting.
  updateSeeds() {
    const d = this.store.data;
    const lv = levelInfo(d.xp || 0);
    this.el.menuSeeds.innerHTML = `<span class="lv">LV ${lv.level}</span><span class="xpbar" title="${lv.into} / ${lv.need} XP"><i style="width:${Math.round(lv.frac * 100)}%"></i></span><span class="sd">${d.seeds} seeds</span>`;
    const pts = pointsAvailable(d);
    const badge = $('#skillsBadge');
    badge.hidden = pts === 0;
    badge.textContent = pts;
  }

  openSkills() {
    this.open('skills');
    this.renderSkills();
  }

  renderSkills() {
    const d = this.store.data;
    if (!d.skills) d.skills = {};
    const lv = levelInfo(d.xp || 0);
    const pts = pointsAvailable(d);
    $('#skLevel').textContent = `Level ${lv.level}`;
    $('#skXp').textContent = lv.need ? `${lv.into} / ${lv.need} XP` : 'Max level';
    $('#skFill').style.width = `${Math.round(lv.frac * 100)}%`;
    $('#skMeter').setAttribute('aria-valuenow', Math.round(lv.frac * 100));
    $('#skPoints').textContent = pts;
    const grid = $('#skillGrid');
    grid.innerHTML = '';
    for (const sk of SKILLS) {
      const rank = skillRank(d, sk.id);
      const el = document.createElement('div');
      el.className = 'skill' + (rank >= 3 ? ' maxed' : '');
      el.innerHTML = `<div class="sk-head"><div class="sk-icon"></div><div><div class="sk-name"></div><div class="pips">${[1, 2, 3].map((i) => `<i class="${i <= rank ? 'on' : ''}"></i>`).join('')}</div></div></div>`
        + `<div class="sk-now"></div><div class="sk-next"></div>`;
      el.querySelector('.sk-icon').textContent = sk.icon;
      el.querySelector('.sk-name').textContent = sk.name;
      el.querySelector('.sk-now').textContent = rank ? sk.effects[rank] : 'Not learned yet';
      el.querySelector('.sk-next').textContent = rank < 3 ? `Next: ${sk.effects[rank + 1]}` : 'Maxed out';
      const btn = document.createElement('button');
      btn.className = 'btn' + (rank < 3 && pts > 0 ? ' primary' : '');
      btn.textContent = rank >= 3 ? 'Max' : rank ? 'Upgrade' : 'Learn';
      btn.disabled = rank >= 3 || pts === 0;
      btn.addEventListener('click', () => {
        if (pointsAvailable(this.store.data) <= 0 || skillRank(this.store.data, sk.id) >= 3) return;
        this.store.data.skills[sk.id] = skillRank(this.store.data, sk.id) + 1;
        this.store.save();
        if (this.game) {
          this.game.refreshMods();
          this.game.sfx.lifeUp();
        }
        this.renderSkills();
        this.updateSeeds();
      });
      el.appendChild(btn);
      grid.appendChild(el);
    }
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
    this.shown = { score: -1, time: -1, strikes: -1, urgent: null, frozen: null, shield: null };
    for (const c of Object.values(this.chips)) c.el.hidden = true;
    $('#shieldChip').hidden = true;
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
    const shd = g.shields || { bomb: 0, miss: 0 };
    const shieldText = [shd.bomb ? 'BOMB' : '', shd.miss ? 'MISS' : ''].filter(Boolean).join(' + ');
    if (shieldText !== this.shown.shield) {
      this.shown.shield = shieldText;
      const chip = $('#shieldChip');
      chip.hidden = !shieldText;
      chip.querySelector('span').textContent = shieldText ? `${shieldText} SHIELD` : '';
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
    const xp = $('#resXp');
    const a = r.levelBefore, b = r.levelAfter;
    const ups = b.level - a.level;
    xp.innerHTML = `<div class="lv-row"><b>Level ${b.level}</b><span>+${r.xpGain} XP · ${b.need ? `${b.into} / ${b.need}` : 'max'}</span></div>`
      + `<div class="mb big"><i style="width:${Math.round((ups ? 0 : a.frac) * 100)}%"></i></div>`
      + (ups ? `<div class="lvup">LEVEL UP! +${ups} skill point${ups > 1 ? 's' : ''}. Open Skills on the menu.</div>` : '');
    requestAnimationFrame(() => {
      const fill = xp.querySelector('.mb i');
      fill.style.transition = 'width 0.9s cubic-bezier(.2,.8,.2,1)';
      requestAnimationFrame(() => (fill.style.width = `${Math.round(b.frac * 100)}%`));
    });
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
    this.renderStats();
    this.open('settings');
  }

  // KPI tiles and meter lists for the saved stats.
  renderStats() {
    const d = this.store.data;
    const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}K` : n.toLocaleString('en-US'));
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    $('#statKpis').innerHTML = [
      ['Rounds played', d.games],
      ['Fruit sliced', d.fruits],
      ['Best combo', d.bestCombo],
    ].map(([k, v]) => `<div class="kpi"><span class="kl">${k}</span><span class="kv">${fmt(v)}</span></div>`).join('');

    const meter = (name, val, max, fig, tip) => {
      const pct = max > 0 ? Math.min(100, (val / max) * 100) : 0;
      return `<div class="meter-row" title="${esc(tip)}"><span class="mn">${esc(name)}</span>`
        + `<span class="mb" role="meter" aria-label="${esc(tip)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(val, max)}"><i style="width:${pct}%"></i></span>`
        + `<span class="mf">${fig}</span></div>`;
    };

    // Trophy score targets per mode, from the trophy list.
    const targets = { arcade: [200, 350], classic: [100, 250], zen: [150] };
    $('#statBest').innerHTML = Object.keys(targets).map((id) => {
      const best = d.best[id] || 0;
      const next = targets[id].find((t) => t > best);
      const name = MODES[id].name;
      if (next === undefined) return meter(name, 1, 1, `${fmt(best)} <small>★</small>`, `${name} best ${best}. All ${name} score trophies earned.`);
      return meter(name, best, next, `${fmt(best)} <small>/ ${fmt(next)}</small>`, `${name} best ${best}. Next trophy at ${next}.`);
    }).join('');

    const got = TROPHIES.filter((t) => d.trophies[t.id]).length;
    const unlocks = [...BLADES.map((b) => ({ ...b, kind: 'blade' })), ...BACKDROPS.map((b) => ({ ...b, kind: 'backdrop' }))]
      .filter((u) => u.need > d.seeds)
      .sort((a, b) => a.need - b.need);
    const nextUnlock = unlocks[0];
    $('#statProgress').innerHTML = [
      meter('Trophies', got, TROPHIES.length, `${got} <small>/ ${TROPHIES.length}</small>`, `${got} of ${TROPHIES.length} trophies earned.`),
      nextUnlock
        ? meter('Seeds', d.seeds, nextUnlock.need, `${fmt(d.seeds)} <small>/ ${fmt(nextUnlock.need)}</small>`, `${d.seeds} seeds. ${nextUnlock.name} ${nextUnlock.kind} unlocks at ${nextUnlock.need}.`)
        : meter('Seeds', 1, 1, `${fmt(d.seeds)} <small>★</small>`, `${d.seeds} seeds. Everything is unlocked.`),
    ].join('');
    $('#statNext').textContent = nextUnlock
      ? `Next unlock: ${nextUnlock.name} ${nextUnlock.kind}, ${nextUnlock.need - d.seeds} seeds to go.`
      : 'Every blade and backdrop is unlocked.';
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
      if (this.tab === 'blades') {
        const fingers = document.createElement('div');
        fingers.className = 'fingers';
        fingers.textContent = `${item.fingers} finger${item.fingers > 1 ? 's' : ''}`;
        const perk = document.createElement('div');
        perk.className = 'perk';
        perk.innerHTML = `<b></b> <span></span>`;
        perk.querySelector('b').textContent = `${item.perkName}:`;
        perk.querySelector('span').textContent = item.perkDesc;
        btn.append(fingers, perk);
      }
      grid.appendChild(btn);
      this.paintPreview(cv, item);
      btn.addEventListener('click', () => {
        if (locked) return;
        if (this.tab === 'blades') {
          d.blade = item.id;
          if (this.game) this.game.refreshMods();
        }
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
