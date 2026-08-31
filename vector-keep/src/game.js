// Vector Keep — single-tower defense. Vanilla canvas, zero deps.
// v2 pass: multishot/bomb branches, endless mode, rebuilt explosion layer,
// DOM boss banner/bar, readability fixes from the critic reports.
(function () {
  const VK = window.VK;
  const $ = (s) => document.querySelector(s);
  const LS = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const KEY = "vectorkeep.v1";
  const BRANCHES = ["cannon", "multi", "bomb", "pierce", "nova", "stasis", "hull", "armor", "vault"];

  let cfg = null, WAVES = null, UPG = null;
  let canvas, ctx, dpr = 1, W = 0, H = 0, cx = 0, cy = 0, arenaR = 0;
  let particles = null, floaters = null;

  const S = {
    screen: "title", demo: true, phase: "shop", wave: 0,
    gold: 0, hp: 0, maxHp: 0,
    tiers: {}, repairs: 0,
    kills: 0, goldEarned: 0, t0: 0,
    enemies: [], shots: [], rings: [], queue: [], waveT: 0,
    fireCd: 0, novaCd: 0, turretA: 0, muzzle: 0, shotIdx: 0,
    shake: 0, timeScale: 1, slowT: 0, flash: 0, flashWhite: 0, over: null,
    bossRef: null, bossGhost: 1, demoSpawnCd: 0, endless: false
  };

  const GATES = 16; // 8 felt too predictable — attacks now come from 16 directions
  const nWaves = () => WAVES.waves.length;

  // Player-selectable game speed (fast-forward button). Gameplay runs on
  // pdt = dt * pace; juice (particles, floaters, shake) stays on full dt so
  // explosions feel snappy at every speed.
  let paceIdx = LS.get(KEY + ".paceIdx", 0);
  function pace() { return (cfg.paceOptions || [1])[paceIdx] || 1; }
  function cyclePace() {
    paceIdx = (paceIdx + 1) % cfg.paceOptions.length;
    LS.set(KEY + ".paceIdx", paceIdx);
    syncPaceButton();
  }
  function syncPaceButton() {
    const b = $("#btn-speed");
    if (b) b.textContent = ["1×", "2×", "3×"][paceIdx] || (paceIdx + 1) + "×";
  }

  // ---------- boot ----------
  async function boot() {
    canvas = $("#arena");
    ctx = canvas.getContext("2d");
    try {
      // ?v must match the asset version in index.html — stale tuning JSON against
      // new code caused undefined-type crashes once already (browser caching).
      const V = "?v=5";
      [cfg, WAVES, UPG] = await Promise.all([
        fetch("config.json" + V).then((r) => r.json()),
        fetch("waves.json" + V).then((r) => r.json()),
        fetch("upgrades.json" + V).then((r) => r.json())
      ]);
      if (paceIdx >= cfg.paceOptions.length) paceIdx = 0;
      syncPaceButton();
    } catch (e) {
      $("#title-sub").textContent = "Failed to load config — serve over HTTP.";
      return;
    }
    VK.audio.setMuted(LS.get(KEY + ".muted", false));
    syncSound();
    resize();
    window.addEventListener("resize", resize);
    wireUi();
    startDemo();
    requestAnimationFrame(frame);
  }

  function resize() {
    const wrap = $("#arena-wrap");
    const s = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
    if (s <= 0) return;
    dpr = window.devicePixelRatio || 1;
    W = H = s;
    canvas.style.width = s + "px"; canvas.style.height = s + "px";
    canvas.width = Math.round(s * dpr); canvas.height = Math.round(s * dpr);
    cx = W / 2; cy = H / 2;
    arenaR = W * 0.47;
  }

  // ---------- run lifecycle ----------
  function freshRun() {
    S.phase = "shop"; S.wave = 0;
    S.gold = cfg.economy.startGold;
    S.maxHp = cfg.tower.baseHp; S.hp = S.maxHp;
    S.tiers = {}; BRANCHES.forEach((b) => (S.tiers[b] = 0));
    S.repairs = 0; S.kills = 0; S.goldEarned = 0; S.t0 = performance.now();
    S.enemies = []; S.shots = []; S.rings = []; S.queue = [];
    S.fireCd = 0; S.novaCd = 0; S.shake = 0; S.timeScale = 1;
    S.flash = 0; S.flashWhite = 0; S.shotIdx = 0;
    S.turrets = [{ a: 0, muzzle: 0 }];
    S.bossRef = null; S.over = null; S.endless = false;
    hideBossUi();
    particles = VK.Particles(cfg.fx.particleCap);
    floaters = VK.Floaters();
  }

  function startDemo() {
    S.screen = "title"; S.demo = true;
    freshRun();
    S.tiers.cannon = 2; S.tiers.multi = 1;
    for (let i = 0; i < 6; i++) spawnEnemy(["mob", "mob", "dart", "splitter"][Math.floor(Math.random() * 4)], Math.floor(Math.random() * GATES));
    show("title");
  }

  function startGame() {
    S.demo = false;
    S.paused = false;
    document.body.classList.remove("paused");
    freshRun();
    show("game");
    updateHud(); renderShop();
    VK.audio.unlock();
  }

  function show(name) {
    ["title", "game", "over"].forEach((n) => $("#screen-" + n).classList.toggle("active", n === name));
    document.body.classList.toggle("in-game", name === "game");
  }

  // ---------- tower stats ----------
  function tierVal(branch) { return S.tiers[branch] ? UPG[branch].tiers[S.tiers[branch] - 1] : null; }
  function stat() {
    const c = tierVal("cannon") || { damage: cfg.tower.baseDamage, fireRate: cfg.tower.baseFireRate };
    return {
      dmg: c.damage, rate: c.fireRate,
      multi: tierVal("multi"), bomb: tierVal("bomb"), pierce: tierVal("pierce"),
      nova: tierVal("nova"), stasis: tierVal("stasis"),
      armor: tierVal("armor"), vault: tierVal("vault"),
      range: W * cfg.tower.rangeFrac
    };
  }

  // ---------- wave defs (authored + endless synthesis) ----------
  function endlessK() { return Math.max(0, S.wave - nWaves() + 1); }
  function waveDef(n) {
    if (n < nWaves()) return WAVES.waves[n];
    const k = n - nWaves() + 1;
    const p = cfg.pace || 1;
    const def = {
      groups: [
        { type: "mob", count: 20 + k * 4, interval: Math.max(0.2, 0.4 - k * 0.006) / p, delay: 0, gates: 6 },
        { type: "dart", count: 24 + k * 5, interval: Math.max(0.12, 0.2 - k * 0.004) / p, delay: 2, gates: 7 },
        { type: "brute", count: 10 + k * 2, interval: Math.max(0.4, 0.8 - k * 0.015) / p, delay: 4, gates: 5 },
        { type: "splitter", count: 10 + k * 2, interval: Math.max(0.3, 0.6 - k * 0.012) / p, delay: 7, gates: 5 }
      ]
    };
    if ((n + 1) % 5 === 0) def.boss = 3;
    return def;
  }
  function endlessMult(n) { return n < nWaves() ? 1 : Math.pow(1.16, n - nWaves() + 1); }

  function buildQueue(w) {
    const def = waveDef(w);
    const q = [];
    if (def.boss !== undefined) q.push({ t: 0.5, type: "boss", bossIdx: def.boss, gate: Math.floor(Math.random() * GATES) });
    for (const g of def.groups || []) {
      const gates = [];
      while (gates.length < Math.min(g.gates, GATES)) {
        const k = Math.floor(Math.random() * GATES);
        if (!gates.includes(k)) gates.push(k);
      }
      for (let i = 0; i < g.count; i++) q.push({ t: g.delay + i * g.interval, type: g.type, gate: gates[i % gates.length] });
    }
    q.sort((a, b) => a.t - b.t);
    return q;
  }

  function startWave() {
    if (S.phase !== "shop" || S.over) return;
    setPaused(false);
    S.phase = "wave";
    S.waveT = 0;
    S.queue = buildQueue(S.wave);
    VK.audio.waveStart();
    if (cfg.music) VK.audio.startMusic();
    const def = waveDef(S.wave);
    if (def.boss !== undefined) {
      const name = WAVES.bossNames[def.boss] + (S.wave >= nWaves() ? " Ω" + endlessK() : "");
      setTimeout(() => { VK.audio.bossHorn(); showBanner(name); }, 350);
    }
    updateHud(); renderShop();
  }

  function spawnEnemy(type, gate, bossIdx) {
    const t = WAVES.types[type];
    const mult = S.demo ? 1 : endlessMult(S.wave);
    const a = gate * (Math.PI * 2 / GATES) - Math.PI / 2;
    const e = {
      type, x: cx + Math.cos(a) * arenaR, y: cy + Math.sin(a) * arenaR,
      hp: Math.round(t.hp * mult), maxHp: Math.round(t.hp * mult),
      speed: t.speed, dmg: t.dmg, gold: Math.max(1, Math.round(t.gold * (1 + (mult - 1) * 0.6))),
      armor: t.armor || 0, weak: t.weak || null, weakMult: t.weakMult || 1,
      r: t.r, rot: Math.random() * 6.3, wob: Math.random() * 6.3, dead: false, bossIdx: undefined
    };
    if (!S.demo && type !== "boss") introduceThreat(type);
    if (type === "boss") {
      const bmult = (t.scaling[bossIdx] || 1) * mult;
      e.hp = e.maxHp = Math.round(t.hp * bmult);
      e.gold = Math.round(t.gold * (1 + bossIdx) * (1 + (mult - 1) * 0.6));
      e.bossIdx = bossIdx;
      S.bossRef = e; S.bossGhost = 1;
      showBossBar(WAVES.bossNames[bossIdx] + (S.wave >= nWaves() ? " Ω" + endlessK() : ""));
    }
    S.enemies.push(e);
    particles.burst(e.x, e.y, colorOf(e), 8, 120, 0.4, 5);
  }

  function colorOf(e) { return cfg.palette.enemies[e.type] || "#FFF"; }

  // First-ever encounter with a threat type gets an explainer toast (persisted).
  let seenThreats = LS.get(KEY + ".threats", {});
  let threatTimer = null;
  function introduceThreat(type) {
    if (seenThreats[type] || !WAVES.intros || !WAVES.intros[type]) return;
    seenThreats[type] = true;
    LS.set(KEY + ".threats", seenThreats);
    const info = WAVES.intros[type];
    const t = $("#threat-toast");
    t.querySelector(".tglyph").textContent = info.glyph;
    t.querySelector(".tglyph").style.color = cfg.palette.enemies[type];
    t.querySelector(".ttitle").textContent = "NEW THREAT · " + info.title;
    t.querySelector(".ttitle").style.color = cfg.palette.enemies[type];
    t.querySelector(".ttext").textContent = info.text;
    t.classList.add("show");
    if (threatTimer) clearTimeout(threatTimer);
    threatTimer = setTimeout(() => t.classList.remove("show"), 9000); // long enough to actually read
  }

  function killRing(x, y, r, color, lw) {
    S.rings.push({ r, R: r * 3.5, t: 0.18, t0: 0.18, color, lw: lw || 3 });
  }

  function killEnemy(e, byContact) {
    e.dead = true;
    S.kills++;
    const isBoss = e.type === "boss";
    const c = colorOf(e);
    if (!byContact) {
      S.gold += e.gold; S.goldEarned += e.gold;
      floaters.add(e.x, e.y - 10, "+" + e.gold, cfg.palette.gold, isBoss ? 20 : 16);
      VK.audio.coin();
      if (!S.demo) $("#hud-gold").textContent = S.gold; // live gold while shopping mid-wave
    }
    if (isBoss) {
      S.bossRef = null; hideBossUi();
      VK.audio.explode(true);
      S.shake = Math.min(cfg.fx.shakeMax, 12);
      S.timeScale = cfg.fx.slowMoScale; S.slowT = cfg.fx.slowMoMs / 1000;
      S.flashWhite = Math.max(S.flashWhite, 0.55);
      killRing(e.x, e.y, e.r * 1.4, "#FFFFFF", 6);
      particles.shards(e.x, e.y, c, 14, 340);
      particles.burst(e.x, e.y, "#FFFFFF", 24, 320, 1.0, 8);
      for (let k = 0; k < 5; k++) {
        setTimeout(() => {
          const px = e.x + (Math.random() - 0.5) * 70, py = e.y + (Math.random() - 0.5) * 70;
          particles.burst(px, py, c, 22, 260, 0.9, 8);
          particles.shards(px, py, c, 8, 300);
          killRing(px, py, 14, c, 4);
          VK.audio.explode(false);
        }, k * 120);
      }
    } else {
      VK.audio.pop();
      killRing(e.x, e.y, e.r, c);
      particles.burst(e.x, e.y, c, 12, 190, 0.5, 5);
      particles.shards(e.x, e.y, c, e.type === "dart" ? 4 : 6, 240);
      if (e.type !== "dart") S.flashWhite = Math.max(S.flashWhite, 0.1);
      if (WAVES.types[e.type].splitInto && !byContact) {
        VK.audio.crack();
        const st = WAVES.types[WAVES.types[e.type].splitInto];
        const mult = S.demo ? 1 : endlessMult(S.wave);
        for (let k = 0; k < WAVES.types[e.type].splitCount; k++) {
          const a = Math.random() * Math.PI * 2;
          S.enemies.push({
            type: WAVES.types[e.type].splitInto,
            x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12,
            hp: Math.round(st.hp * mult), maxHp: Math.round(st.hp * mult),
            speed: st.speed, dmg: st.dmg, gold: Math.max(1, Math.round(st.gold * (1 + (mult - 1) * 0.6))),
            armor: st.armor || 0, weak: st.weak || null, weakMult: st.weakMult || 1,
            r: st.r, rot: Math.random() * 6.3, wob: Math.random() * 6.3, dead: false
          });
        }
      }
    }
  }

  function damageTower(amount) {
    if (S.demo || S.over) return;
    const ar = tierVal("armor");
    amount = Math.max(1, amount - (ar ? ar.reduce : 0));
    S.hp = Math.max(0, S.hp - amount);
    S.flash = 0.5;
    S.shake = Math.min(cfg.fx.shakeMax, S.shake + 6);
    VK.audio.towerHit();
    updateHud(); renderShop();
    if (S.hp <= 0) endRun(false);
  }

  function endRun(won) {
    S.over = won ? "win" : "lose";
    renderShop(); updateHud();
    VK.audio.stopMusic();
    const color = won ? cfg.palette.tower : cfg.palette.enemies.boss;
    if (won) {
      VK.audio.win();
      for (let k = 0; k < 6; k++) setTimeout(() => {
        const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * arenaR * 0.5;
        const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
        particles.burst(px, py, k % 2 ? cfg.palette.gold : cfg.palette.tower, 24, 280, 1.0, 7);
        particles.shards(px, py, k % 2 ? cfg.palette.gold : cfg.palette.tower, 10, 320);
        killRing(px, py, 12, k % 2 ? cfg.palette.gold : cfg.palette.tower, 4);
        VK.audio.explode(false);
      }, k * 240);
      S.flashWhite = 0.35;
    } else {
      VK.audio.explode(true);
      VK.audio.lose();
      S.shake = cfg.fx.shakeMax;
      S.flashWhite = 0.6;
      for (let k = 0; k < 7; k++) setTimeout(() => {
        const px = cx + (Math.random() - 0.5) * 70, py = cy + (Math.random() - 0.5) * 70;
        particles.burst(px, py, cfg.palette.tower, 22, 280, 1.0, 8);
        particles.shards(px, py, cfg.palette.tower, 9, 320);
        killRing(px, py, 14, cfg.palette.tower, 4);
        VK.audio.explode(false);
      }, k * 110);
    }
    const prevBest = LS.get(KEY + ".best", 0);
    const reached = won ? nWaves() : S.wave + 1;
    const newBest = reached > prevBest;
    if (newBest) LS.set(KEY + ".best", reached);
    setTimeout(() => {
      $("#over-title").textContent = won ? "THE KEEP STANDS" : "THE KEEP HAS FALLEN";
      $("#over-title").style.color = color;
      const secs = Math.round((performance.now() - S.t0) / 1000);
      $("#over-sub").textContent = won
        ? "All " + nWaves() + " waves cleared"
        : "Fell on wave " + reached + (S.wave >= nWaves() ? " · endless" : "");
      $("#over-newbest").style.display = newBest && !won ? "" : (newBest && won ? "" : "none");
      $("#stat-kills").textContent = S.kills;
      $("#stat-gold").textContent = S.goldEarned;
      $("#stat-time").textContent = Math.floor(secs / 60) + "m " + (secs % 60) + "s";
      $("#btn-continue").style.display = won ? "" : "none";
      show("over");
    }, won ? 2000 : 1400);
  }

  function continueEndless() {
    if (S.over !== "win") return;
    S.over = null; S.endless = true;
    S.phase = "shop";
    show("game");
    updateHud(); renderShop();
  }

  // ---------- boss DOM ui ----------
  function showBanner(name) {
    $("#boss-banner .bname").textContent = name;
    const b = $("#boss-banner");
    b.classList.remove("show"); void b.offsetWidth; // restart animation
    b.classList.add("show");
    setTimeout(() => b.classList.remove("show"), 2400);
  }
  function showBossBar(name) {
    $("#bossbar .bb-name").textContent = name;
    $("#bossbar").classList.add("show");
  }
  function hideBossUi() {
    const bb = $("#bossbar"); if (bb) bb.classList.remove("show");
    const b = $("#boss-banner"); if (b) b.classList.remove("show");
  }
  function updateBossBar() {
    if (!S.bossRef) return;
    const f = Math.max(0, S.bossRef.hp / S.bossRef.maxHp);
    S.bossGhost += (f - S.bossGhost) * 0.08;
    $("#bb-fill").style.width = (f * 100).toFixed(1) + "%";
    $("#bb-ghost").style.width = (Math.max(f, S.bossGhost) * 100).toFixed(1) + "%";
  }

  // ---------- update ----------
  function update(dt) {
    const st = stat();
    // gameplay clock (player-selected speed); juice stays on raw dt
    const pdt = dt * (S.demo ? 0.7 : pace());

    if (S.demo) {
      S.demoSpawnCd -= pdt;
      if (S.demoSpawnCd <= 0) {
        S.demoSpawnCd = 0.25 + Math.random() * 0.35;
        spawnEnemy(["mob", "mob", "dart", "splitter"][Math.floor(Math.random() * 4)], Math.floor(Math.random() * GATES));
      }
    } else if (S.phase === "wave" && !S.over) {
      S.waveT += pdt;
      while (S.queue.length && S.queue[0].t <= S.waveT) {
        const ev = S.queue.shift();
        spawnEnemy(ev.type, ev.gate, ev.bossIdx);
      }
      if (!S.queue.length && S.enemies.length === 0) {
        // interest pays on gold still unspent at the horn — the vault build's whole game
        const vault = tierVal("vault");
        const rate = cfg.economy.interestBase + (vault ? vault.bonus : 0);
        const interest = Math.floor(S.gold * rate);
        const bonus = cfg.economy.waveBonusBase + cfg.economy.waveBonusPerWave * S.wave;
        S.gold += bonus + interest; S.goldEarned += bonus + interest;
        floaters.add(cx, cy - 40, "WAVE CLEAR +" + bonus, cfg.palette.gold, 18);
        if (interest > 0) floaters.add(cx, cy - 14, "INTEREST +" + interest, "#A8E060", 15);
        VK.audio.upgrade();
        VK.audio.stopMusic();
        S.wave++;
        if (S.wave === nWaves() && !S.endless) endRun(true);
        else { S.phase = "shop"; updateHud(); renderShop(); }
      }
    }

    // enemies
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = cx - e.x, dy = cy - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let sp = e.speed;
      if (st.stasis && d < W * st.stasis.radiusFrac) sp *= (1 - st.stasis.slow);
      e.wob += pdt * 4;
      const wobble = e.type === "dart" ? Math.sin(e.wob) * 26 : 0;
      const px = -dy / d, py = dx / d;
      e.x += (dx / d) * sp * pdt + px * wobble * pdt;
      e.y += (dy / d) * sp * pdt + py * wobble * pdt;
      e.rot += pdt * (e.type === "boss" ? 0.8 : 2.2);
      if (d < W * 0.055 + e.r) {
        e.dead = true;
        particles.burst(e.x, e.y, colorOf(e), 12, 160, 0.5, 5);
        particles.shards(e.x, e.y, colorOf(e), 5, 220);
        damageTower(e.dmg);
        if (e.type === "boss") { S.bossRef = null; hideBossUi(); }
      }
    }
    S.enemies = S.enemies.filter((e) => !e.dead);

    // tower fire — one visible barrel per Multi shot, each tracking its own target
    S.fireCd -= pdt;
    const nShots = st.multi ? st.multi.shots : 1;
    while (S.turrets.length < nShots) {
      const base = S.turrets[S.turrets.length - 1];
      S.turrets.push({ a: (base ? base.a : 0) + 0.6, muzzle: 0 });
    }
    if (S.turrets.length > nShots) S.turrets.length = nShots;
    const inRange = [];
    for (const e of S.enemies) {
      const d = Math.hypot(e.x - cx, e.y - cy);
      if (d < st.range) inRange.push({ e, d });
    }
    inRange.sort((a, b) => a.d - b.d);
    const aimAt = (pick) => {
      const lead = Math.hypot(pick.x - cx, pick.y - cy) / cfg.tower.projSpeed;
      const tdx = cx - pick.x, tdy = cy - pick.y;
      const td = Math.hypot(tdx, tdy) || 1;
      return Math.atan2(pick.y + (tdy / td) * pick.speed * lead - cy,
                        pick.x + (tdx / td) * pick.speed * lead - cx);
    };
    for (let i = 0; i < S.turrets.length; i++) {
      const t = S.turrets[i];
      t.muzzle = Math.max(0, t.muzzle - dt);
      let want;
      if (inRange.length && !S.over) want = aimAt(inRange[i % inRange.length].e);
      else want = (i / S.turrets.length) * Math.PI * 2 + performance.now() / 4000; // idle: slow even fan
      let da = want - t.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      t.a += da * Math.min(1, dt * (inRange.length ? 10 : 2));
    }
    if (inRange.length && !S.over && S.fireCd <= 0) {
      S.fireCd = 1 / st.rate;
      for (let i = 0; i < S.turrets.length; i++) {
        const t = S.turrets[i];
        const a = aimAt(inRange[i % inRange.length].e);
        t.a = a; t.muzzle = 0.14;
        S.shots.push({
          x: cx + Math.cos(a) * W * 0.06, y: cy + Math.sin(a) * W * 0.06,
          vx: Math.cos(a) * cfg.tower.projSpeed, vy: Math.sin(a) * cfg.tower.projSpeed,
          dmg: st.dmg, bomb: false, hist: [],
          pierce: st.pierce ? st.pierce.through : 0,
          pierceMax: st.pierce ? st.pierce.through : 0,
          falloff: st.pierce ? st.pierce.falloff : 1,
          hit: st.pierce ? new Set() : null
        });
      }
      VK.audio.shot();
    }

    // Bomb launcher: independent weapon on its own cooldown, seeks the thickest cluster.
    if (st.bomb && (S.phase === "wave" || S.demo) && !S.over && S.enemies.length) {
      S.bombCd = (S.bombCd || 0) - pdt;
      if (S.bombCd <= 0) {
        S.bombCd = st.bomb.period;
        const R = W * st.bomb.radiusFrac;
        let best = null, bestScore = -1;
        for (const e of S.enemies) {
          let score = 0;
          for (const o of S.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) < R) score++;
          if (score > bestScore) { bestScore = score; best = e; }
        }
        const bs = cfg.tower.projSpeed * 0.55;
        const lead = Math.hypot(best.x - cx, best.y - cy) / bs;
        const tdx = cx - best.x, tdy = cy - best.y;
        const td = Math.hypot(tdx, tdy) || 1;
        const a = Math.atan2(best.y + (tdy / td) * best.speed * lead - cy, best.x + (tdx / td) * best.speed * lead - cx);
        S.shots.push({
          x: cx + Math.cos(a) * W * 0.06, y: cy + Math.sin(a) * W * 0.06,
          vx: Math.cos(a) * bs, vy: Math.sin(a) * bs,
          dmg: st.bomb.damage, bomb: true, hist: [], pierce: 0, falloff: 1, hit: null
        });
        VK.audio.shot();
      }
    }

    // projectiles
    for (const s of S.shots) {
      s.hist.push(s.x, s.y);
      if (s.hist.length > 8) s.hist.splice(0, 2);
      s.x += s.vx * pdt; s.y += s.vy * pdt;
      if (Math.hypot(s.x - cx, s.y - cy) > arenaR + 30) { s.dead = true; continue; }
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (s.hit && s.hit.has(e)) continue; // pierced shots never re-hit the same enemy
        if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + (s.bomb ? 8 : 5)) {
          if (s.bomb) {
            s.dead = true;
            const st2 = stat().bomb;
            const R = W * st2.radiusFrac;
            VK.audio.explode(false);
            killRing(s.x, s.y, 10, cfg.palette.bomb, 5);
            particles.burst(s.x, s.y, cfg.palette.bomb, 20, 240, 0.6, 7);
            particles.shards(s.x, s.y, cfg.palette.bomb, 8, 280);
            S.flashWhite = Math.max(S.flashWhite, 0.12);
            for (const e2 of S.enemies) {
              if (e2.dead) continue;
              const d2 = Math.hypot(e2.x - s.x, e2.y - s.y);
              if (d2 < R + e2.r) {
                const m2 = e2.weak === "bomb" ? e2.weakMult : 1;
                e2.hp -= Math.max(1, Math.round(s.dmg * m2) - e2.armor);
                const push = st2.knockback * Math.max(0.25, 1 - d2 / R);
                const nd = d2 || 1;
                e2.x += ((e2.x - s.x) / nd) * push; e2.y += ((e2.y - s.y) / nd) * push;
                if (e2.hp <= 0) killEnemy(e2, false);
              }
            }
          } else {
            // weakness: mobs melt to cannon fire; splitters crack open to piercing rounds
            let m = 1;
            if (e.weak === "cannon") m = e.weakMult;
            else if (e.weak === "pierce" && s.pierceMax > 0) m = e.weakMult;
            const weakHit = m > 1;
            e.hp -= Math.max(1, Math.round(s.dmg * m) - e.armor);
            particles.burst(s.x, s.y, e.armor ? "#AEBBD0" : (weakHit ? "#FFFFFF" : cfg.palette.shot), weakHit ? 7 : 4, 110, 0.22, 3);
            if (e.hp <= 0) killEnemy(e, false);
            if (s.pierce > 0) {
              s.pierce--;
              s.dmg = Math.max(1, Math.round(s.dmg * s.falloff));
              if (s.hit) s.hit.add(e);
            } else {
              s.dead = true;
            }
          }
          break;
        }
      }
    }
    S.shots = S.shots.filter((s) => !s.dead);
    S.enemies = S.enemies.filter((e) => !e.dead);

    // nova
    if (st.nova && (S.phase === "wave" || S.demo) && !S.over) {
      S.novaCd -= pdt;
      if (S.novaCd <= 0 && S.enemies.length) {
        S.novaCd = st.nova.period;
        const R = W * st.nova.radiusFrac;
        S.rings.push({ r: W * 0.06, R, t: 0.25, t0: 0.25, color: cfg.palette.nova, lw: 8, nova: true });
        VK.audio.novaPulse();
        for (const e of S.enemies) {
          const d = Math.hypot(e.x - cx, e.y - cy);
          if (d < R) {
            const mn = e.weak === "nova" ? e.weakMult : 1;
            e.hp -= Math.max(1, Math.round(st.nova.damage * mn) - e.armor);
            // real, visible hurl — scaled by proximity to the keep
            const push = st.nova.knockback * Math.max(0.3, 1 - d / R);
            const nd = d || 1;
            e.x += ((e.x - cx) / nd) * push; e.y += ((e.y - cy) / nd) * push;
            if (e.hp <= 0) killEnemy(e, false);
          }
        }
        S.enemies = S.enemies.filter((e) => !e.dead);
      }
    }
    for (const r of S.rings) { r.t -= dt; r.r += (r.R - r.r) * Math.min(1, dt * 11); }
    S.rings = S.rings.filter((r) => r.t > 0);

    particles.update(dt);
    floaters.update(dt);
    updateBossBar();
    // keep shop affordability fresh while gold flows in mid-wave (throttled)
    if (!S.demo && S.phase === "wave" && !S.over) {
      S.shopCd = (S.shopCd || 0) - dt;
      if (S.shopCd <= 0) { S.shopCd = 0.5; renderShop(); }
    }
    S.shake = Math.max(0, S.shake - dt * 26);
    S.flash = Math.max(0, S.flash - dt * 2);
    S.flashWhite = Math.max(0, S.flashWhite - dt * 3.5);
    if (S.slowT > 0) { S.slowT -= dt / S.timeScale; if (S.slowT <= 0) S.timeScale = 1; }

    if (!S.demo && !S.over && S.hp > 0 && S.hp / S.maxHp < 0.25) {
      S.alarmCd = (S.alarmCd || 0) - dt;
      if (S.alarmCd <= 0) { S.alarmCd = 1.4; VK.audio.alarm(); }
      document.body.classList.add("danger");
    } else document.body.classList.remove("danger");
  }

  // ---------- render ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = Math.min(0.05, (now - (S.lastT || now)) / 1000);
    S.lastT = now;
    if (!S.paused) update(rawDt * S.timeScale);
    draw(now);
  }

  function setPaused(p) {
    if (S.demo || S.over) p = false;
    if (S.paused === p) return;
    S.paused = p;
    document.body.classList.toggle("paused", p);
    $("#btn-pause").textContent = p ? "▶" : "⏸";
    if (p) VK.audio.stopMusic();
    else if (S.phase === "wave" && cfg.music) VK.audio.startMusic();
  }

  function poly(x, y, r, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function draw(now) {
    const P = cfg.palette;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
    ctx.clearRect(-20, -20, W + 40, H + 40);

    ctx.fillStyle = P.bg; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.beginPath(); ctx.arc(cx, cy, arenaR, 0, 7);
    ctx.fillStyle = P.arena; ctx.fill();
    // visible arena rim with bloom
    ctx.strokeStyle = VK.hexA(P.tower, 0.25); ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.12;
    ctx.strokeStyle = P.tower; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();

    ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, arenaR * k / 4, 0, 7); ctx.stroke(); }
    for (let k = 0; k < GATES; k++) {
      const a = k * Math.PI * 2 / GATES - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * arenaR * 0.12, cy + Math.sin(a) * arenaR * 0.12);
      ctx.lineTo(cx + Math.cos(a) * arenaR, cy + Math.sin(a) * arenaR); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(VK.glow(P.dim, 8), cx + Math.cos(a) * arenaR - 8, cy + Math.sin(a) * arenaR - 8, 16, 16);
      ctx.restore();
    }

    const st = stat();
    if (st.stasis) {
      ctx.beginPath(); ctx.arc(cx, cy, W * st.stasis.radiusFrac, 0, 7);
      ctx.strokeStyle = P.stasis; ctx.globalAlpha = 0.35; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // rings (kill rings, bomb rings, nova with echoes)
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const r of S.rings) {
      const a = r.t / r.t0;
      ctx.strokeStyle = r.color;
      if (r.nova) {
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = a * (0.7 - k * 0.2);
          ctx.lineWidth = Math.max(1, (r.lw - k * 3) * a + 1);
          ctx.beginPath(); ctx.arc(cx, cy, r.r * (1 - k * 0.14), 0, 7); ctx.stroke();
        }
      } else {
        ctx.globalAlpha = a * 0.9;
        ctx.lineWidth = Math.max(1, r.lw * a);
        ctx.beginPath(); ctx.arc(r.x !== undefined ? r.x : cx, r.y !== undefined ? r.y : cy, r.r, 0, 7); ctx.stroke();
      }
    }
    ctx.restore();

    // enemies — emissive line art with bloom pass
    for (const e of S.enemies) {
      const c = colorOf(e);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55;
      const gs = e.r * 2.2;
      ctx.drawImage(VK.glow(c, gs), e.x - gs, e.y - gs, gs * 2, gs * 2);
      ctx.restore();
      // shape = identity: circle mob, triangle dart, square brute, pentagon splitter, 7-gon boss
      if (e.type === "mob") { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); }
      else {
        const n = e.type === "dart" ? 3 : e.type === "brute" ? 4 : e.type === "splitter" ? 5 : 7;
        poly(e.x, e.y, e.r, n, e.rot);
      }
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4;
      ctx.strokeStyle = c; ctx.lineWidth = (e.type === "boss" ? 4 : 2.5) * 2; ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = c; ctx.lineWidth = e.type === "boss" ? 4 : 2.5; ctx.stroke();
      if (e.type === "brute") { // armor plate: inner counter-square
        poly(e.x, e.y, e.r * 0.55, 4, e.rot + 0.79);
        ctx.strokeStyle = "#AEBBD0"; ctx.lineWidth = 2; ctx.stroke();
      }
      if (e.type === "boss") { // counter-rotating outer ring
        poly(e.x, e.y, e.r * 1.45, 7, -e.rot * 1.4);
        ctx.strokeStyle = VK.hexA(c, 0.5); ctx.lineWidth = 2; ctx.stroke();
      }
      if (e.maxHp > 25 && e.hp < e.maxHp && e.type !== "boss") {
        const f = e.hp / e.maxHp;
        const col = f > 0.6 ? P.hp : f > 0.3 ? P.gold : P.hpLow;
        ctx.fillStyle = "rgba(0,0,0,.9)";
        ctx.fillRect(e.x - e.r - 1, e.y - e.r - 10, e.r * 2 + 2, 7);
        ctx.fillStyle = col;
        ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * f, 5);
      }
    }

    // projectiles — motion streaks, not bead chains
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (const s of S.shots) {
      const col = s.bomb ? P.bomb : P.shot;
      const h = s.hist;
      if (h.length >= 4) {
        for (let i = 0; i + 3 < h.length; i += 2) {
          const seg = i / 2, total = h.length / 2 - 1;
          ctx.globalAlpha = 0.15 + 0.5 * (seg / total);
          ctx.lineWidth = 2 + 3 * (seg / total) + (s.bomb ? 2 : 0);
          ctx.strokeStyle = col;
          ctx.beginPath(); ctx.moveTo(h[i], h[i + 1]); ctx.lineTo(h[i + 2], h[i + 3]); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      const gs = s.bomb ? 14 : 9;
      ctx.drawImage(VK.glow(col, gs), s.x - gs, s.y - gs, gs * 2, gs * 2);
    }
    ctx.restore();

    // tower (hidden after defeat — the keep actually falls)
    const towerR = W * 0.055;
    if (S.over !== "lose") {
      const hpFrac = S.demo ? 1 : S.hp / S.maxHp;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const tg = towerR * 2.2;
      ctx.drawImage(VK.glow(P.tower, tg), cx - tg, cy - tg, tg * 2, tg * 2);
      ctx.restore();
      poly(cx, cy, towerR, 6, now / 3000);
      ctx.fillStyle = P.towerCore; ctx.fill();
      let strokeCol = P.tower;
      if (S.flash > 0) strokeCol = "#FFFFFF";
      else if (hpFrac < 0.25) strokeCol = (Math.sin(now / 90) > 0) ? P.hpLow : "#8A2A24";
      else if (hpFrac < 0.5) strokeCol = P.bomb;
      ctx.strokeStyle = strokeCol; ctx.lineWidth = 3; ctx.stroke();
      for (let ti = 0; ti < S.turrets.length; ti++) {
        const t = S.turrets[ti];
        const recoil = t.muzzle > 0.06 ? towerR * 0.16 : 0;
        // lateral mount offset so stacked barrels still read as separate guns
        const mount = (ti - (S.turrets.length - 1) / 2) * Math.min(5, towerR * 0.16);
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(t.a); ctx.translate(0, mount);
        ctx.fillStyle = P.tower;
        ctx.fillRect(towerR * 0.3 - recoil, -3.5, towerR * 1.15, 7);
        if (t.muzzle > 0) {
          ctx.globalCompositeOperation = "lighter";
          const ms = 20;
          ctx.drawImage(VK.glow(P.shot, ms), towerR * 1.35 - recoil - ms, -ms, ms * 2, ms * 2);
        }
        ctx.restore();
      }
    } else {
      // crater
      ctx.beginPath(); ctx.arc(cx, cy, towerR * 1.1, 0, 7);
      ctx.fillStyle = "#0A0D13"; ctx.fill();
      ctx.strokeStyle = "#232B3B"; ctx.lineWidth = 2; ctx.stroke();
      if (Math.random() < 0.15) particles.burst(cx + (Math.random() - 0.5) * towerR, cy + (Math.random() - 0.5) * towerR, P.bomb, 1, 40, 0.8, 3);
    }

    particles.draw(ctx);
    floaters.draw(ctx);

    // white impact flash
    if (S.flashWhite > 0.01) {
      ctx.globalAlpha = S.flashWhite * 0.5;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- HUD / shop ----------
  function updateHud() {
    if (S.demo) return;
    $("#hud-wave").textContent = S.wave < nWaves()
      ? "WAVE " + Math.min(S.wave + 1, nWaves()) + "/" + nWaves()
      : "WAVE " + (S.wave + 1) + " · ENDLESS";
    $("#hud-gold").textContent = S.gold;
    const f = Math.max(0, S.hp / S.maxHp);
    $("#hp-fill").style.width = (f * 100).toFixed(1) + "%";
    $("#hp-fill").style.background = f < 0.25 ? cfg.palette.hpLow : cfg.palette.hp;
    $("#hp-text").textContent = S.hp + "/" + S.maxHp;
  }

  function repairPrice() { return Math.round(UPG.repair.basePrice * Math.pow(UPG.repair.priceGrowth, S.repairs)); }

  function renderShop() {
    const shop = $("#shop");
    const shopOpen = !S.over && !S.demo; // buying works in both phases now
    shop.classList.toggle("locked", !shopOpen);
    for (const key of BRANCHES) {
      const tier = S.tiers[key];
      const maxT = UPG[key].tiers.length;
      const card = $("#card-" + key);
      const next = tier < maxT ? UPG[key].tiers[tier] : null;
      card.querySelector(".pips").innerHTML =
        Array.from({ length: maxT }, (_, i) => "<span class='pip" + (i < tier ? " on" : "") + "'></span>").join("");
      card.classList.toggle("maxed", !next);
      const btn = card.querySelector("button");
      if (next) {
        btn.textContent = "UPGRADE ◆" + next.price;
        btn.disabled = !shopOpen || S.gold < next.price;
        btn.classList.toggle("afford", shopOpen && S.gold >= next.price);
      } else { btn.textContent = "MAX"; btn.disabled = true; btn.classList.remove("afford"); }
    }
    const rbtn = $("#card-repair button");
    const full = S.hp >= S.maxHp;
    const repairOpen = shopOpen && S.phase === "shop";
    rbtn.textContent = S.phase !== "shop" && !S.over ? "AFTER WAVE" : full ? "FULL" : "+" + UPG.repair.amount + " ◆" + repairPrice();
    rbtn.disabled = !repairOpen || full || S.gold < repairPrice();
    rbtn.classList.toggle("afford", repairOpen && !full && S.gold >= repairPrice());
    const canStart = S.phase === "shop" && !S.over;
    $("#btn-wave").disabled = !canStart;
    $("#btn-wave").textContent = canStart ? "START WAVE " + (S.wave + 1) : (S.over ? "—" : "WAVE " + (S.wave + 1) + " ACTIVE");
  }

  function buy(key) {
    if (S.over || S.demo) return; // mid-wave purchases are allowed — spending under fire is the point
    if (key === "repair") {
      if (S.phase !== "shop") { VK.audio.deny(); return; } // no repair-spamming through a swarm
      const p = repairPrice();
      if (S.hp >= S.maxHp || S.gold < p) { VK.audio.deny(); return; }
      S.gold -= p; S.repairs++;
      S.hp = Math.min(S.maxHp, S.hp + UPG.repair.amount);
    } else {
      const tier = S.tiers[key];
      if (tier >= UPG[key].tiers.length) return;
      const next = UPG[key].tiers[tier];
      if (S.gold < next.price) { VK.audio.deny(); return; }
      S.gold -= next.price; S.tiers[key]++;
      if (key === "hull") { S.maxHp += next.amount; S.hp += next.amount; }
    }
    VK.audio.upgrade();
    S.flash = 0.4;
    particles.burst(cx, cy, cfg.palette.tower, 18, 200, 0.6, 5);
    killRing(cx, cy, W * 0.06, cfg.palette.tower, 4);
    updateHud(); renderShop();
  }

  function syncSound() {
    const on = !VK.audio.isMuted();
    document.querySelectorAll(".btn-sound").forEach((b) => {
      b.innerHTML = on
        ? "<svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5' fill='currentColor' stroke='none'/><path d='M15 9a5 5 0 0 1 0 6'/><path d='M18 6a9 9 0 0 1 0 12'/></svg>"
        : "<svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5' fill='currentColor' stroke='none'/><line x1='15' y1='9' x2='21' y2='15'/><line x1='21' y1='9' x2='15' y2='15'/></svg>";
      b.setAttribute("aria-label", on ? "Sound on" : "Sound off");
    });
  }

  function wireUi() {
    $("#btn-play").addEventListener("click", () => { VK.audio.unlock(); startGame(); });
    $("#btn-wave").addEventListener("click", startWave);
    [...BRANCHES, "repair"].forEach((k) => {
      $("#card-" + k).querySelector("button").addEventListener("click", () => buy(k));
    });
    $("#btn-again").addEventListener("click", () => startGame());
    $("#btn-continue").addEventListener("click", continueEndless);
    $("#btn-menu").addEventListener("click", () => startDemo());
    $("#btn-quit").addEventListener("click", () => { VK.audio.stopMusic(); S.paused = false; document.body.classList.remove("paused"); startDemo(); });
    $("#btn-pause").addEventListener("click", () => setPaused(!S.paused));
    $("#btn-speed").addEventListener("click", cyclePace);
    syncPaceButton();
    window.addEventListener("keydown", (e) => {
      if ((e.key === "p" || e.key === "P" || e.key === "Escape") && !S.demo && !S.over) setPaused(!S.paused);
    });
    $("#threat-toast").addEventListener("click", () => $("#threat-toast").classList.remove("show"));
    document.querySelectorAll(".btn-sound").forEach((b) => b.addEventListener("click", () => {
      VK.audio.setMuted(!VK.audio.isMuted());
      LS.set(KEY + ".muted", VK.audio.isMuted());
      syncSound();
    }));
    const best = LS.get(KEY + ".best", 0);
    if (best) $("#title-best").textContent = "Best: wave " + best;

    // ?debug=1 — testing harness for critics and tuning sessions. Not linked anywhere.
    if (new URLSearchParams(location.search).get("debug")) {
      const bar = document.createElement("div");
      bar.style.cssText = "position:fixed;bottom:0;right:0;z-index:9;display:flex;gap:4px;padding:4px;background:rgba(0,0,0,.6)";
      bar.innerHTML = "<button id='dbg-gold'>+500◆</button><button id='dbg-skip'>skip wave</button><button id='dbg-hurt'>-40 hp</button>";
      document.body.appendChild(bar);
      bar.querySelector("#dbg-gold").addEventListener("click", () => { S.gold += 500; updateHud(); renderShop(); });
      bar.querySelector("#dbg-skip").addEventListener("click", () => {
        if (S.screen === "over" || S.demo || S.over) return;
        S.enemies = []; S.queue = []; S.shots = []; S.bossRef = null; hideBossUi();
        if (S.phase === "shop") { S.wave = S.endless ? S.wave + 1 : Math.min(S.wave + 1, nWaves() - 1); updateHud(); renderShop(); }
      });
      bar.querySelector("#dbg-hurt").addEventListener("click", () => damageTower(40));
    }
  }

  window.addEventListener("DOMContentLoaded", boot);
})();
