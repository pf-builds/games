// Peasant Swarm — core simulation + render. Click it! Studios, 2026.
// Boids swarm, local combat, rout-and-absorb, AI rivals, power-ups. All tuning in config.json.
(function () {
  const PS = (window.PS = window.PS || {});
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- state
  const S = {
    cfg: null, spr: null, debug: /(\?|&)debug=1/.test(location.search),
    mode: "title", t: 0, timeLeft: 0, pace: 1,
    agents: [], teams: [], obstacles: [], powerups: [], camps: [],
    cam: { x: 0, y: 0, zoom: 1 }, vw: 0, vh: 0, dpr: 1,
    input: { px: 0, py: 0, active: false, huddle: false, keys: {}, touch: false },
    rng: null, seed: 0, trickleT: 0, shake: 0, banners: [], hintT: 0,
    stats: { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0 },
    fps: 60, fpsT0: 0, frameN: 0, engagedNow: false, result: null,
    grid: null, cols: 0, rows: 0, CELL: 48, drawList: [], decals: [], trails: [], attract: false, vignette: null, difficulty: "normal",
  };
  if (S.debug) window.PSS = S;

  const canvas = $("game"), ctx = canvas.getContext("2d");
  const mini = $("minimap"), mctx = mini.getContext("2d");
  let particles, floaters;

  // ---------------------------------------------------------------- setup
  async function boot() {
    const res = await fetch("config.json?v=16");
    S.cfg = await res.json();
    S.spr = PS.buildSprites(S.cfg);
    particles = PS.Particles(1400);
    floaters = PS.Floaters();
    S.CELL = 48;
    resize();
    window.addEventListener("resize", resize);
    bindInput();
    bindUI();
    newGame(true);
    schedule();
    if (S.debug) {
      // hidden-tab fallback clock: rAF starves there. Never registers a second rAF (see schedule()).
      setInterval(() => { if (performance.now() - lastFrame > 60) frame(performance.now(), true); }, 33);
      // synchronous sim advance for automated critics: PS.step(5) = 5 sim-seconds, no rendering
      PS.step = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (S.mode !== "play") break; update(1 / 60); if (S.mode !== "play") break; particles.update(1 / 60); floaters.update(1 / 60); } updateHUD(true); return S.result || S.mode; };
      PS.timeStep = (sec) => { const t0 = performance.now(); PS.step(sec); return (performance.now() - t0) / (sec * 60); };
    }
  }

  function resize() {
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.vw = window.innerWidth; S.vh = window.innerHeight;
    canvas.width = Math.round(S.vw * S.dpr); canvas.height = Math.round(S.vh * S.dpr);
    const c = S.cfg.camera;
    S.cam.zoom = S.vw < c.mobileBreak ? c.zoomMobile : c.zoomDesktop;
    // cached screen-space vignette
    const v = document.createElement("canvas"); v.width = Math.max(1, S.vw >> 1); v.height = Math.max(1, S.vh >> 1);
    const g = v.getContext("2d"); const rg = g.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * 0.35, v.width / 2, v.height / 2, Math.max(v.width, v.height) * 0.75);
    rg.addColorStop(0, "rgba(10,20,8,0)"); rg.addColorStop(1, "rgba(10,20,8,.42)"); g.fillStyle = rg; g.fillRect(0, 0, v.width, v.height); S.vignette = v;
  }

  // ---------------------------------------------------------------- world gen
  function mkAgent(x, y, team) {
    return { x, y, vx: 0, vy: 0, team, hp: S.cfg.agent.hp, atk: Math.random() * 0.5, tgt: null,
      ph: Math.random() * 10, face: Math.random() < 0.5 ? 1 : -1, fl: 0, lunge: 0, wx: x, wy: y, hx: x, hy: y, dead: false, fight: false, r: 6, pop: 9, camp: null };
  }
  function mkTeam(id, name, color, isPlayer, ai) {
    return { id, name, color, isPlayer, ai, count: 0, cx: 0, cy: 0, tx: 0, ty: 0, alive: true,
      buffs: { speed: 0, armor: 0, frenzy: 0, rally: 0 }, eng: [0, 0, 0, 0, 0], engT: [0, 0, 0, 0, 0], engStart: [0, 0, 0, 0, 0],
      spr: S.spr.peasantSet(color), kills: 0, peak: 1, state: "roam", speedMod: 1, thinkT: Math.random() * 0.5, lastHint: 0, minY: 0 };
  }

  function farFromObstacles(x, y, pad) {
    for (const o of S.obstacles) { const dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy < (o.r + pad) * (o.r + pad)) return false; }
    return true;
  }
  function farFromTeams(x, y, d) {
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (!t.alive) continue; const dx = t.cx - x, dy = t.cy - y; if (dx * dx + dy * dy < d * d) return false; }
    return true;
  }
  function randPos(margin) { return { x: margin + S.rng() * (S.cfg.world.w - margin * 2), y: margin + S.rng() * (S.cfg.world.h - margin * 2) }; }

  function spawnCamp(x, y, n) {
    const sp = S.cfg.spawn.campSpread;
    const camp = { x, y, n: 0, smokeT: S.rng() * 0.8 };
    S.camps.push(camp);
    for (let i = 0; i < n; i++) {
      const a = S.rng() * Math.PI * 2, d = 6 + S.rng() * sp;
      const ag = mkAgent(x + Math.cos(a) * d, y + Math.sin(a) * d, 0);
      ag.hx = x; ag.hy = y; ag.wx = ag.x; ag.wy = ag.y; ag.camp = camp;
      S.agents.push(ag);
    }
  }

  function newGame(attract) {
    const cfg = S.cfg, W = cfg.world.w, H = cfg.world.h;
    S.attract = !!attract; PS.audio.setSilent(S.attract);
    S.seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    S.rng = mulberry32(S.seed);
    S.agents.length = 0; S.obstacles.length = 0; S.powerups.length = 0; S.camps.length = 0; S.banners.length = 0; S.decals.length = 0; S.trails.length = 0;
    S.t = 0; S.timeLeft = cfg.world.matchSeconds; S.trickleT = 0; S.shake = 0; S.result = null; S.engagedNow = false; S.finalCalled = false; S.pendingEnd = null; S._routedBy = null;
    S.stats = { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0 };
    S.cols = Math.ceil(W / S.CELL); S.rows = Math.ceil(H / S.CELL);
    S.grid = new Array(S.cols * S.rows); for (let i = 0; i < S.grid.length; i++) S.grid[i] = [];

    // obstacles
    for (let i = 0; i < cfg.world.trees; i++) {
      const p = randPos(80); const big = S.rng() < 0.4;
      if (farFromObstacles(p.x, p.y, 40)) S.obstacles.push({ x: p.x, y: p.y, r: big ? 17 : 12, kind: big ? 1 : 0 });
    }
    for (let i = 0; i < cfg.world.rocks; i++) {
      const p = randPos(80);
      if (farFromObstacles(p.x, p.y, 40)) S.obstacles.push({ x: p.x, y: p.y, r: 13, kind: 2 });
    }

    // teams: player + 3 AI in shuffled quadrants
    S.teams = [null];
    S.teams.push(mkTeam(1, cfg.player.name, cfg.player.color, true, S.attract ? cfg.ai.personalities[1] : null));
    cfg.ai.personalities.forEach((p, i) => S.teams.push(mkTeam(2 + i, p.name, p.color, false, p)));
    const quads = [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]].sort(() => S.rng() - 0.5);
    for (let i = 1; i <= 4; i++) {
      const t = S.teams[i];
      let x = quads[i - 1][0] * W, y = quads[i - 1][1] * H;
      while (!farFromObstacles(x, y, 60)) { x += 40; }
      t.cx = t.tx = x; t.cy = t.ty = y;
      S.agents.push(mkAgent(x, y, i));
      if (i === 1 && !S.attract) for (let b = 0; b < diff().startBonus; b++) S.agents.push(mkAgent(x + (S.rng() - 0.5) * 30, y + (S.rng() - 0.5) * 30, 1));
      // starter camps within reach so the first minute isn't a walk
      for (let k = 0; k < cfg.spawn.starterCamps; k++) {
        const a = S.rng() * Math.PI * 2, d = cfg.spawn.starterDist[0] + S.rng() * (cfg.spawn.starterDist[1] - cfg.spawn.starterDist[0]);
        const cx = clamp(x + Math.cos(a) * d, 60, W - 60), cy = clamp(y + Math.sin(a) * d, 60, H - 60);
        spawnCamp(cx, cy, 2 + ((S.rng() * 2) | 0));
      }
    }
    // neutral camps
    let tries = 0;
    for (let i = 0; i < cfg.spawn.neutralCamps && tries < 400; tries++) {
      const p = randPos(70);
      if (!farFromObstacles(p.x, p.y, 44) || !farFromTeams(p.x, p.y, 220)) continue;
      spawnCamp(p.x, p.y, cfg.spawn.campMin + ((S.rng() * (cfg.spawn.campMax - cfg.spawn.campMin + 1)) | 0));
      i++;
    }
    // power-ups
    for (let i = 0; i < cfg.powerups.count; i++) S.powerups.push(newPowerup(true));
    // decals (dressing only) and dirt trails between neighbouring camps
    for (let i = 0; i < cfg.world.decals; i++) { const p = randPos(20); S.decals.push({ x: p.x, y: p.y, k: (S.rng() * S.spr.decals.length) | 0 }); }
    for (let i = 0; i < S.camps.length; i++) {
      const a = S.camps[i]; const near = [];
      for (let j = 0; j < S.camps.length; j++) { if (i === j) continue; const b = S.camps[j]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < cfg.world.trailDist) near.push([d, j]); }
      near.sort((u, v) => u[0] - v[0]);
      for (let k = 0; k < Math.min(2, near.length); k++) {
        const j = near[k][1]; if (j < i) continue; const b = S.camps[j];
        const mx = (a.x + b.x) / 2 + (S.rng() - 0.5) * 120, my = (a.y + b.y) / 2 + (S.rng() - 0.5) * 120;
        S.trails.push({ x0: a.x, y0: a.y, cx: mx, cy: my, x1: b.x, y1: b.y, minX: Math.min(a.x, b.x, mx) - 12, maxX: Math.max(a.x, b.x, mx) + 12, minY: Math.min(a.y, b.y, my) - 12, maxY: Math.max(a.y, b.y, my) + 12 });
      }
    }

    recount();
    S.cam.x = S.teams[1].cx; S.cam.y = S.teams[1].cy;
    S.teams[1].tx = S.teams[1].cx; S.teams[1].ty = S.teams[1].cy;
    buildTeamChips();
    if (!S.attract) showHint("Walk into grey peasants to recruit them", 4);
  }

  function diff() { return S.cfg.difficulty[S.difficulty] || S.cfg.difficulty.normal; }
  function pickKind() {
    const w = S.cfg.powerups.weights; const keys = Object.keys(w); let tot = 0; for (const k of keys) tot += w[k];
    let r = S.rng() * tot; for (const k of keys) { r -= w[k]; if (r <= 0) return k; } return keys[0];
  }
  function newPowerup(initial) {
    let p, n = 0;
    do { p = randPos(90); n++; } while (n < 60 && (!farFromObstacles(p.x, p.y, 30) || (initial && !farFromTeams(p.x, p.y, S.cfg.powerups.minDistFromStart))));
    return { x: p.x, y: p.y, kind: pickKind(), alive: true, t: 0 };
  }

  function recount() {
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; t.count = 0; t._sx = 0; t._sy = 0; t.minY = Infinity; }
    for (const a of S.agents) { if (a.team === 0 || a.dead) continue; const t = S.teams[a.team]; t.count++; t._sx += a.x; t._sy += a.y; if (a.y < t.minY) t.minY = a.y; }
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i];
      if (t.count > 0) { t.cx = t._sx / t.count; t.cy = t._sy / t.count; if (t.count > t.peak) t.peak = t.count; }
    }
  }

  // ---------------------------------------------------------------- spatial hash
  const NEAR = new Array(6000); let nearN = 0;
  function rebuildGrid() {
    const g = S.grid; for (let i = 0; i < g.length; i++) g[i].length = 0;
    const C = S.CELL, cols = S.cols, rows = S.rows;
    for (const a of S.agents) {
      const cx = clamp((a.x / C) | 0, 0, cols - 1), cy = clamp((a.y / C) | 0, 0, rows - 1);
      g[cy * cols + cx].push(a);
    }
  }
  function gather(x, y) {
    nearN = 0;
    const C = S.CELL, cols = S.cols, rows = S.rows, g = S.grid;
    const cx = (x / C) | 0, cy = (y / C) | 0;
    for (let j = cy - 1; j <= cy + 1; j++) {
      if (j < 0 || j >= rows) continue;
      for (let i = cx - 1; i <= cx + 1; i++) {
        if (i < 0 || i >= cols) continue;
        const cell = g[j * cols + i];
        for (let k = 0; k < cell.length && nearN < 6000; k++) NEAR[nearN++] = cell[k];
      }
    }
  }
  function countNear(x, y, r, team) {
    // wide query (up to 3 cell rings) for AI/rally decisions — not per-agent
    const C = S.CELL, cols = S.cols, rows = S.rows, g = S.grid, R = Math.ceil(r / C);
    const cx = (x / C) | 0, cy = (y / C) | 0; let n = 0; const r2 = r * r;
    for (let j = cy - R; j <= cy + R; j++) { if (j < 0 || j >= rows) continue;
      for (let i = cx - R; i <= cx + R; i++) { if (i < 0 || i >= cols) continue;
        const cell = g[j * cols + i];
        for (let k = 0; k < cell.length; k++) { const b = cell[k]; if (b.team !== team || b.dead) continue; const dx = b.x - x, dy = b.y - y; if (dx * dx + dy * dy < r2) n++; }
      } }
    return n;
  }

  // ---------------------------------------------------------------- simulation
  function update(dt) {
    const cfg = S.cfg, A = cfg.agent, F = cfg.flock, CB = cfg.combat, W = cfg.world.w, H = cfg.world.h, D = diff();
    S.t += dt; S.timeLeft -= dt;
    const player = S.teams[1];
    if (S.pendingEnd && S.t >= S.pendingEnd.at) { finishEnd(); return; }
    const finalPhase = S.timeLeft <= cfg.world.finalSeconds;
    if (S.attract) {
      let alive = 0; for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive) alive++;
      if (alive <= 1 || S.timeLeft <= 0) { newGame(true); return; }
    }
    if (finalPhase && !S.finalCalled) { S.finalCalled = true; banner("LAST MINUTE: every mob turns on the biggest", "#FFE49A", 3.5); PS.audio.bell(); showHint("Be the biggest swarm when the bell rings", 4); for (let i = 2; i < S.teams.length; i++) S.teams[i].thinkT = 0; }

    // player target
    const inp = S.input;
    let kx = 0, ky = 0;
    if (inp.keys.w || inp.keys.ArrowUp) ky -= 1; if (inp.keys.s || inp.keys.ArrowDown) ky += 1;
    if (inp.keys.a || inp.keys.ArrowLeft) kx -= 1; if (inp.keys.d || inp.keys.ArrowRight) kx += 1;
    if (S.attract) { /* player is AI-driven under the title */ }
    else if (kx || ky) { const l = Math.hypot(kx, ky); player.tx = clamp(player.cx + (kx / l) * 170, 10, W - 10); player.ty = clamp(player.cy + (ky / l) * 170, 10, H - 10); }
    else if (inp.active) { const w = screenToWorld(inp.px, inp.py); player.tx = clamp(w.x, 40, W - 40); player.ty = clamp(w.y, 40, H - 40); }

    // AI think
    for (let i = S.attract ? 1 : 2; i < S.teams.length; i++) { const t = S.teams[i]; if (!t.alive) continue; t.thinkT -= dt; if (t.thinkT <= 0) { t.thinkT = S.attract ? cfg.ai.think : D.think; aiThink(t); } }

    // buffs tick, engagement reset
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; for (const k in t.buffs) if (t.buffs[k] > 0) t.buffs[k] -= dt; for (let j = 0; j < 5; j++) t.eng[j] = 0; }

    rebuildGrid();

    // per-agent steering + combat
    const sepR = F.sepRadius, sepR2 = sepR * sepR, engR2 = A.engageRadius * A.engageRadius, atkR2 = A.attackRange * A.attackRange;
    const huddleP = inp.huddle;
    for (let idx = 0; idx < S.agents.length; idx++) {
      const a = S.agents[idx];
      if (a.dead) continue;
      a.ph += dt * 9; if (a.fl > 0) a.fl -= dt; if (a.lunge > 0) a.lunge -= dt;
      if (a.pop < 0.35) { const was = a.pop; a.pop += dt; if (was < 0 && a.pop >= 0 && onScreen(a.x, a.y)) { const tc = S.teams[a.team]; if (tc) { particles.burst(a.x, a.y - 8, tc.color, 6, 80, 0.45, 3, 200); particles.ring(a.x, a.y - 8, tc.color, 4, 18, 0.3); } } }
      gather(a.x, a.y);
      let sx = 0, sy = 0; // separation accumulator
      let dvx = 0, dvy = 0; // desired velocity
      const team = a.team ? S.teams[a.team] : null;
      const hud = team && team.isPlayer && huddleP && !S.attract;
      const mySep = hud ? F.huddleSepRadius : sepR, mySep2 = mySep * mySep;
      const eSep = sepR * F.enemySepMult, eSep2 = eSep * eSep, hard = F.enemyHardRadius, hard2 = hard * hard;
      let speed = A.speed;
      if (team) { speed *= team.speedMod; if (team.ai && !S.attract) speed *= D.aiSpeed; if (team.buffs.speed > 0) speed *= cfg.powerups.speedMult; if (hud) speed *= F.huddleSpeedMult; }

      // find/keep combat target + separation in one pass
      let best = null, bestD2 = engR2;
      if (a.tgt && (a.tgt.dead || a.tgt.team === a.team || a.tgt.team === 0)) a.tgt = null;
      if (a.tgt) { const dx = a.tgt.x - a.x, dy = a.tgt.y - a.y; const d2 = dx * dx + dy * dy; if (d2 < engR2 * 4) { best = a.tgt; bestD2 = d2; } else a.tgt = null; }
      for (let k = 0; k < nearN; k++) {
        const b = NEAR[k]; if (b === a || b.dead) continue;
        const dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy;
        const enemy = team && b.team !== 0 && b.team !== a.team;
        const sR = enemy ? eSep : mySep, sR2 = enemy ? eSep2 : mySep2;
        if (d2 < sR2 && d2 > 0.0001) {
          const d = Math.sqrt(d2); const f = (1 - d / sR) / d; sx += dx * f; sy += dy * f;
          if (enemy && d2 < hard2) { const push = (hard - d) * 0.5; a.x += (dx / d) * push; a.y += (dy / d) * push; }
        }
        if (team && b.team !== 0 && b.team !== a.team && d2 < bestD2 && !best) { best = b; bestD2 = d2; }
        else if (team && b.team !== 0 && b.team !== a.team && d2 < bestD2 && best && d2 < bestD2 * 0.5) { best = b; bestD2 = d2; }
      }

      if (team) {
        // seek team target with arrive
        let dx = team.tx - a.x, dy = team.ty - a.y, d = Math.sqrt(dx * dx + dy * dy);
        let seekX = 0, seekY = 0;
        if (d > 2) { let sp = speed; if (d < F.arrive) sp *= d / F.arrive; seekX = (dx / d) * sp; seekY = (dy / d) * sp; }
        // cohesion toward centroid
        let cohX = 0, cohY = 0;
        const cdx = team.cx - a.x, cdy = team.cy - a.y, cd = Math.sqrt(cdx * cdx + cdy * cdy);
        const cohW = hud ? F.huddleCohesion : F.cohesion;
        if (cd > F.cohesionStart) { const k = clamp((cd - F.cohesionStart) / (F.cohesionFull - F.cohesionStart), 0, 1); cohX = (cdx / cd) * speed * cohW * (0.3 + 0.7 * k); cohY = (cdy / cd) * speed * cohW * (0.3 + 0.7 * k); }
        if (best) {
          a.tgt = best; a.fight = true; team.eng[best.team]++;
          const tdx = best.x - a.x, tdy = best.y - a.y, td = Math.sqrt(bestD2) || 1;
          const fs = speed * A.fightSpeedMult;
          if (bestD2 < atkR2 * 0.85) { dvx = 0; dvy = 0; } // hold the line at pitchfork reach
          else { dvx = (tdx / td) * fs * CB.fightPull; dvy = (tdy / td) * fs * CB.fightPull; }
          dvx += seekX * (1 - CB.fightPull) * 0.5 + cohX * 0.15;
          dvy += seekY * (1 - CB.fightPull) * 0.5 + cohY * 0.15;
          // attack
          if (bestD2 < atkR2) {
            a.atk -= dt;
            if (a.atk <= 0) {
              a.atk = A.attackInterval * (0.8 + Math.random() * 0.4); a.lunge = 0.18;
              const tt = S.teams[best.team];
              let dmg = A.damage; if (team.buffs.frenzy > 0) dmg *= cfg.powerups.frenzyMult; if (tt.buffs.armor > 0) dmg *= cfg.powerups.armorMult;
              best.hp -= dmg; best.fl = 0.16;
              const vis = onScreen(best.x, best.y);
              if (vis) { particles.burst(best.x, best.y - 6, "#FFFFFF", 2, 60, 0.25, 2, 200); PS.audio.hit(); }
              if (best.hp <= 0) killAgent(best, a.team);
            }
          } else a.atk = Math.min(a.atk, A.attackInterval * 0.5);
        } else {
          a.fight = false; dvx = seekX + cohX; dvy = seekY + cohY;
        }
      } else {
        // neutral: idle wander around home camp
        let dx = a.wx - a.x, dy = a.wy - a.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 3) { if (Math.random() < 0.02) { const ang = Math.random() * Math.PI * 2, r = Math.random() * F.neutralWanderRadius; a.wx = a.hx + Math.cos(ang) * r; a.wy = a.hy + Math.sin(ang) * r; } }
        else { dvx = (dx / d) * speed * F.neutralWander; dvy = (dy / d) * speed * F.neutralWander; }
      }
      // separation (velocity-space)
      const sl = Math.sqrt(sx * sx + sy * sy);
      if (sl > 0) { const sw = speed * F.separation; dvx += (sx / sl) * Math.min(sl * 40, 1) * sw; dvy += (sy / sl) * Math.min(sl * 40, 1) * sw; }
      // limit + integrate
      const dl = Math.sqrt(dvx * dvx + dvy * dvy); const maxV = speed * (team ? 1.15 : 0.5);
      if (dl > maxV) { dvx *= maxV / dl; dvy *= maxV / dl; }
      const k = 1 - Math.exp(-F.steerLerp * dt);
      a.vx += (dvx - a.vx) * k; a.vy += (dvy - a.vy) * k;
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (Math.abs(a.vx) > 8) a.face = a.vx > 0 ? 1 : -1;
      // obstacles
      for (let o = 0; o < S.obstacles.length; o++) {
        const ob = S.obstacles[o]; const ox = a.x - ob.x, oy = a.y - ob.y; const rr = ob.r + a.r; const d2 = ox * ox + oy * oy;
        if (d2 < rr * rr && d2 > 0.001) { const d = Math.sqrt(d2); a.x = ob.x + (ox / d) * rr; a.y = ob.y + (oy / d) * rr; }
      }
      if (a.x < 8) a.x = 8; else if (a.x > W - 8) a.x = W - 8;
      if (a.y < 8) a.y = 8; else if (a.y > H - 8) a.y = H - 8;
    }

    // recruitment: neutrals look for the nearest team agent within recruitRadius
    const rr2 = A.recruitRadius * A.recruitRadius;
    for (let idx = 0; idx < S.agents.length; idx++) {
      const a = S.agents[idx]; if (a.dead || a.team !== 0) continue;
      gather(a.x, a.y);
      let bt = 0, bd = rr2;
      for (let k = 0; k < nearN; k++) { const b = NEAR[k]; if (b.team === 0 || b.dead) continue; const dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; bt = b.team; } }
      if (bt) convert(a, bt, false);
    }

    // power-up pickup
    const pr2 = cfg.powerups.pickupRadius * cfg.powerups.pickupRadius;
    for (const p of S.powerups) {
      if (!p.alive) { p.t -= dt; if (p.t <= 0) { const np = newPowerup(false); p.x = np.x; p.y = np.y; p.kind = np.kind; p.alive = true; } continue; }
      p.t += dt;
      gather(p.x, p.y);
      for (let k = 0; k < nearN; k++) { const b = NEAR[k]; if (b.team === 0 || b.dead) continue; const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < pr2) { pickup(p, b.team); break; } }
    }

    // camp head-counts (for "+N" labels) and campfire smoke
    for (const c of S.camps) c.n = 0;
    for (const a of S.agents) if (a.team === 0 && !a.dead && a.camp) a.camp.n++;
    for (const c of S.camps) { if (c.n === 0 || !onScreen(c.x, c.y)) continue; c.smokeT -= dt; if (c.smokeT <= 0) { c.smokeT = 0.5 + Math.random() * 0.5; particles.smoke(c.x + (Math.random() - 0.5) * 3, c.y - 6); } }

    // remove dead
    let any = false; for (const a of S.agents) if (a.dead) { any = true; break; }
    if (any) S.agents = S.agents.filter((a) => !a.dead);

    recount();

    // engagement timers + rout resolution
    S.engagedNow = false;
    for (let i = 1; i < S.teams.length; i++) {
      const ta = S.teams[i]; if (!ta.alive) continue;
      for (let j = 1; j < S.teams.length; j++) {
        if (i === j) continue; const tb = S.teams[j]; if (!tb.alive) continue;
        if (ta.eng[j] > 0 && tb.eng[i] > 0) { if (ta.engT[j] === 0) ta.engStart[j] = ta.count; ta.engT[j] += dt; if (ta.isPlayer || tb.isPlayer) S.engagedNow = true; }
        else ta.engT[j] = Math.max(0, ta.engT[j] - dt * CB.engageDecay);
        if (ta.engT[j] >= CB.engageDelay && ta.count >= CB.minRoutSize) {
          const moraleA = ta.count / Math.max(1, ta.engStart[j]), moraleB = tb.count / Math.max(1, tb.engStart[i] || tb.count);
          if (ta.count < CB.breakRatio * tb.count || (moraleA < CB.moraleBreak && moraleA < moraleB - 0.02)) { rout(ta, tb); break; }
        }
      }
    }

    // eliminations
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && t.count === 0) eliminate(t); }

    // trickle spawns
    S.trickleT += dt;
    if (!finalPhase && S.trickleT >= cfg.spawn.trickleEvery) {
      S.trickleT = 0;
      let neutrals = 0; for (const a of S.agents) if (a.team === 0) neutrals++;
      for (let rep = 0; rep < (cfg.spawn.trickleCamps || 1); rep++) if (neutrals < cfg.spawn.trickleCap && S.agents.length < cfg.spawn.agentCap) {
        let under = null; for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && (!under || t.count < under.count)) under = t; }
        const favour = under && S.rng() < cfg.spawn.underdogBias;
        for (let n = 0; n < 40; n++) {
          let p;
          if (favour) { const ang = S.rng() * Math.PI * 2, d = 340 + S.rng() * 320; p = { x: clamp(under.cx + Math.cos(ang) * d, 70, W - 70), y: clamp(under.cy + Math.sin(ang) * d, 70, H - 70) }; }
          else p = randPos(70);
          if (!farFromObstacles(p.x, p.y, 44)) continue;
          let ok = true; for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (!t.alive || t === under && favour) continue; const dx = t.cx - p.x, dy = t.cy - p.y; if (dx * dx + dy * dy < cfg.spawn.minTrickleDistFromTeams * cfg.spawn.minTrickleDistFromTeams) { ok = false; break; } }
          if (!ok) continue;
          const nn = cfg.spawn.campMin + ((S.rng() * (cfg.spawn.campMax - cfg.spawn.campMin + 1)) | 0); spawnCamp(p.x, p.y, nn); neutrals += nn; break;
        }
      }
    }

    // drum
    if (S.engagedNow && !PS.audio.drumOn()) PS.audio.startDrum(); else if (!S.engagedNow && PS.audio.drumOn()) PS.audio.stopDrum();

    // camera
    const cl = 1 - Math.exp(-cfg.camera.lerp * dt);
    let camT = player;
    if (S.attract) { for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive && S.teams[i].count > camT.count) camT = S.teams[i]; }
    if (camT.count > 0) { S.cam.x += (camT.cx - S.cam.x) * cl * (S.attract ? 0.4 : 1); S.cam.y += (camT.cy - S.cam.y) * cl * (S.attract ? 0.4 : 1); }
    if (S.shake > 0) S.shake -= dt;

    // banners: one at a time, queued
    if (S.banners.length) { S.banners[0].life -= dt; if (S.banners[0].life <= 0) S.banners.shift(); }
    if (S.hintT > 0) { S.hintT -= dt; if (S.hintT <= 0 || S.engagedNow) { S.hintT = 0; $("hint").classList.remove("show"); } }

    if (S.attract) return;
    // stats + hints
    if (player.count > S.stats.peak) S.stats.peak = player.count;
    if (S.stats.recruited === 0 && S.t > 25 && !S._hintRecruit) { S._hintRecruit = true; showHint("Grey peasants are free recruits. Go touch them.", 3); }
    if (player.count >= 8 && !S._hintFight) { S._hintFight = true; showHint("Only fight rivals when you're bigger. Winners absorb the losers.", 5); }
    if (player.count >= 20 && !S._hintHud) { S._hintHud = true; showHint(S.input.touch ? "Hold HUDDLE to tighten the swarm before a clash" : "Hold SPACE to huddle up before a clash", 5); }

    // win / lose
    if (player.count === 0 && !S.result) endGame(false, S._routedBy ? "Your swarm broke and joined " + S._routedBy + "." : "Every last peasant fell.");
    else if (!S.result) {
      let rivals = 0; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive) rivals++;
      if (rivals === 0) endGame(true, "Every rival mob is gone. The whole valley marches under your banner.");
      else if (S.timeLeft <= 0) {
        let big = player; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].count > big.count) big = S.teams[i];
        if (big === player) endGame(true, "The bell rang and yours was the biggest swarm in the valley.");
        else endGame(false, big.name + " had the biggest swarm when the bell rang (" + big.count + " vs your " + player.count + ").");
      }
    }
  }

  function convert(a, team, absorbed) {
    const from = a.team; a.team = team; a.hp = S.cfg.agent.hp; a.tgt = null; a.fight = false; a.fl = absorbed ? 0 : 0.2;
    a.pop = absorbed ? -Math.random() * 0.45 : 0;
    const t = S.teams[team];
    if (onScreen(a.x, a.y)) {
      if (!absorbed) particles.burst(a.x, a.y - 6, t.color, 5, 80, 0.45, 3, 220);
      if (t.isPlayer && !absorbed) { PS.audio.recruit(); if (Math.random() < 0.35) floaters.add(a.x, a.y - 14, "+1", t.color, 13, 0.7); }
    }
    if (t.isPlayer && from === 0) S.stats.recruited++;
    if (from === 0 && !absorbed) bumpChip(team);
  }
  function killAgent(a, byTeam) {
    if (a.dead) return; a.dead = true;
    const t = S.teams[a.team]; if (t) { if (t.isPlayer) S.stats.lost++; }
    if (byTeam === 1) { S.stats.kills++; S.teams[1].kills++; }
    if (onScreen(a.x, a.y)) { particles.burst(a.x, a.y - 6, t ? t.color : "#B8A88A", 10, 120, 0.6, 4, 260); particles.burst(a.x, a.y - 6, "#F1C27D", 4, 90, 0.5, 3, 260); particles.ring(a.x, a.y - 6, "#FFFFFF", 3, 14, 0.22); PS.audio.die(a.team === 1); }
  }
  function rout(loser, winner) {
    const n = loser.count; let flipped = 0;
    for (const a of S.agents) if (a.team === loser.id && !a.dead) { convert(a, winner.id, true); flipped++; }
    for (let j = 0; j < 5; j++) { loser.engT[j] = 0; winner.engT[j] = 0; loser.engStart[j] = 0; winner.engStart[j] = 0; }
    if (winner.isPlayer) { S.stats.routs++; PS.audio.rout(true); banner(loser.name.toUpperCase() + " ROUTED!  +" + flipped + " join you", winner.color, 2.6); S.shake = 0.35; }
    else if (loser.isPlayer) { S._routedBy = winner.name; PS.audio.rout(false); S.shake = 0.5; }
    else { banner(loser.name.toUpperCase() + " routed by " + winner.name, winner.color, 2); if (onScreen(loser.cx, loser.cy)) PS.audio.rout(false); }
    particles.ring(loser.cx, loser.cy, winner.color, 10, 120, 0.7);
    recount();
  }
  function eliminate(t) {
    t.alive = false; t.count = 0;
    buildTeamChips();
    if (!t.isPlayer && !S.attract) { banner(t.name.toUpperCase() + " ELIMINATED", t.color, 2.4); PS.audio.eliminated(); }
  }
  function pickup(p, teamId) {
    const cfg = S.cfg.powerups, t = S.teams[teamId];
    p.alive = false; p.t = cfg.respawn;
    if (p.kind === "rally") {
      let n = 0;
      for (const a of S.agents) { if (a.team !== 0 || a.dead) continue; const dx = a.x - p.x, dy = a.y - p.y; if (dx * dx + dy * dy < cfg.rallyRadius * cfg.rallyRadius) { convert(a, teamId, false); n++; } }
      t.buffs.rally = cfg.duration.rally;
      particles.ring(p.x, p.y, S.spr.PU.rally.color, 10, cfg.rallyRadius, 0.6);
      if (t.isPlayer) { floaters.add(p.x, p.y - 20, "RALLY! +" + n, S.spr.PU.rally.color, 18, 1.3); PS.audio.power("rally"); S.stats.powerups++; }
    } else {
      t.buffs[p.kind] = cfg.duration[p.kind];
      if (t.isPlayer) { floaters.add(p.x, p.y - 20, p.kind.toUpperCase() + "!", S.spr.PU[p.kind].color, 18, 1.1); PS.audio.power(p.kind); S.stats.powerups++; }
    }
    particles.burst(p.x, p.y, S.spr.PU[p.kind].color, 14, 110, 0.6, 2.5, 120);
  }

  // ---------------------------------------------------------------- AI
  function aiThink(t) {
    const cfg = S.cfg, P = t.ai, W = cfg.world.w, H = cfg.world.h;
    const final = S.timeLeft <= cfg.world.finalSeconds;
    let biggest = null; for (let i = 1; i < S.teams.length; i++) { const o = S.teams[i]; if (o.alive && (!biggest || o.count > biggest.count)) biggest = o; }
    const sight2 = final ? 1e12 : cfg.ai.sight * cfg.ai.sight;
    const fleeRatio = final ? cfg.ai.finalFleeRatio : P.fleeRatio;
    let threat = null, threatD2 = Infinity, prey = null, preyScore = 0;
    for (let i = 1; i < S.teams.length; i++) {
      const o = S.teams[i]; if (o === t || !o.alive) continue;
      const dx = o.cx - t.cx, dy = o.cy - t.cy, d2 = dx * dx + dy * dy;
      if (d2 > sight2) continue;
      let huntRatio = final && o === biggest ? cfg.ai.finalHuntRatio : P.huntRatio * (S.attract ? 1 : diff().huntMult);
      if (!final && !o.isPlayer) huntRatio *= cfg.ai.aiVsAiHuntMult;
      if (!final && S.t < cfg.ai.gracePeriod) huntRatio = 1e9; // nobody hunts before the grace period ends
      if (!(final && o === biggest) && o.count >= t.count * fleeRatio && d2 < threatD2) { threat = o; threatD2 = d2; }
      if (t.count >= o.count * huntRatio && t.count >= 3 && S.t >= (t.huntCooldown || 0)) {
        const sc = (o.count + 2) / (Math.sqrt(d2) + 60) * (o.isPlayer ? P.hatesPlayer : 1);
        if (sc > preyScore) { preyScore = sc; prey = o; }
      }
    }
    if (threat && threatD2 < cfg.ai.corneredDist * cfg.ai.corneredDist && t.count >= 3) {
      // caught: turn and fight rather than drag a hopeless chase across the map
      t.tx = threat.cx; t.ty = threat.cy; t.state = "hunt"; t.speedMod = cfg.ai.huntSpeed; return;
    }
    if (threat) {
      t.speedMod = cfg.ai.fleeSpeed;
      const dx = t.cx - threat.cx, dy = t.cy - threat.cy, d = Math.hypot(dx, dy) || 1;
      let tx = t.cx + (dx / d) * cfg.ai.fleeDistance, ty = t.cy + (dy / d) * cfg.ai.fleeDistance;
      // prefer fleeing toward a neutral camp that lies roughly away from the threat: recruit while running
      let bs = 0, bx = 0, by = 0;
      for (const a of S.agents) {
        if (a.team !== 0 || a.dead) continue;
        const nx = a.hx - t.cx, ny = a.hy - t.cy, nd = Math.sqrt(nx * nx + ny * ny) || 1;
        const dot = (nx / nd) * (dx / d) + (ny / nd) * (dy / d); if (dot < 0.3) continue;
        const sc = (0.5 + dot) / (nd + 150); if (sc > bs) { bs = sc; bx = a.hx; by = a.hy; }
      }
      if (bs > 0) { tx = bx; ty = by; }
      // if fleeing into a wall, slide along it
      if (tx < 60 || tx > W - 60) { tx = clamp(tx, 60, W - 60); ty += (dy >= 0 ? 1 : -1) * 200; }
      if (ty < 60 || ty > H - 60) { ty = clamp(ty, 60, H - 60); tx += (dx >= 0 ? 1 : -1) * 200; }
      t.tx = clamp(tx, 40, W - 40); t.ty = clamp(ty, 40, H - 40); t.state = "flee"; return;
    }
    if (prey) {
      if (t.state !== "hunt") t.huntStart = S.t;
      let engagedAny = 0; for (let j = 1; j < 5; j++) engagedAny += t.eng[j];
      if (!final && S.t - t.huntStart > cfg.ai.huntTimeout && engagedAny === 0) { t.huntCooldown = S.t + cfg.ai.huntCooldown; prey = null; }
    }
    if (prey) {
      // lead the target a bit
      t.tx = clamp(prey.cx + (prey.tx - prey.cx) * 0.3, 20, W - 20); t.ty = clamp(prey.cy + (prey.ty - prey.cy) * 0.3, 20, H - 20); t.state = "hunt"; t.speedMod = cfg.ai.huntSpeed; return;
    }
    // roam: best neutral cluster or power-up by value/distance
    let best = null, bestS = 0;
    for (const a of S.agents) {
      if (a.team !== 0 || a.dead) continue;
      const dx = a.hx - t.cx, dy = a.hy - t.cy, d = Math.sqrt(dx * dx + dy * dy);
      const sc = P.neutralBias * cfg.ai.neutralScore / (d + 120);
      if (sc > bestS) { bestS = sc; best = a; }
    }
    let tx = best ? best.hx : t.cx, ty = best ? best.hy : t.cy;
    for (const p of S.powerups) {
      if (!p.alive) continue;
      const dx = p.x - t.cx, dy = p.y - t.cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > cfg.ai.powerupSight) continue;
      const sc = P.powerBias * cfg.ai.powerScore / (d + 120);
      if (sc > bestS) { bestS = sc; tx = p.x; ty = p.y; }
    }
    if (!best && bestS === 0) { const p = randPos(200); tx = p.x; ty = p.y; }
    t.tx = tx; t.ty = ty; t.state = "roam"; t.speedMod = 1;
  }

  // ---------------------------------------------------------------- helpers
  function screenToWorld(sx, sy) { const z = S.cam.zoom; return { x: (sx - S.vw / 2) / z + S.cam.x, y: (sy - S.vh / 2) / z + S.cam.y }; }
  function onScreen(x, y) { const z = S.cam.zoom, hw = S.vw / 2 / z + 40, hh = S.vh / 2 / z + 40; return Math.abs(x - S.cam.x) < hw && Math.abs(y - S.cam.y) < hh; }
  function banner(text, color, life) { if (S.attract) return; S.banners.push({ text, color, life, life0: life }); }
  function showHint(text, secs) { if (S.attract || S.result) return; const h = $("hint"); h.textContent = text; h.classList.add("show"); S.hintT = secs; }
  function bumpChip(teamId) { const el = $("chip-" + teamId); if (!el) return; el.classList.add("bump"); clearTimeout(el._bt); el._bt = setTimeout(() => el.classList.remove("bump"), 140); }

  function endGame(won, why) {
    if (S.attract || S.result) return;
    S.result = won ? "win" : "lose";
    PS.audio.stopDrum();
    S.pendingEnd = { won, why, at: S.t + (won ? 0.9 : 1.2) }; // sim-time delay: pausing defers it, newGame clears it
  }
  function finishEnd() {
    const { won, why } = S.pendingEnd; S.pendingEnd = null;
    {
      S.mode = won ? "win" : "lose";
      if (won) PS.audio.win(); else PS.audio.lose();
      $(won ? "win-sub" : "lose-sub").textContent = why;
      const st = S.stats, el = $(won ? "win-stats" : "lose-stats");
      const mm = Math.floor((S.cfg.world.matchSeconds - Math.max(0, S.timeLeft)) / 60), ss = Math.floor((S.cfg.world.matchSeconds - Math.max(0, S.timeLeft)) % 60);
      el.innerHTML = [["Peak swarm", st.peak], ["Recruited", st.recruited], ["Routs", st.routs], ["Kills", st.kills], ["Power-ups", st.powerups], ["Time", mm + ":" + (ss < 10 ? "0" : "") + ss]]
        .map(([k, v]) => "<div class='stat'><b>" + v + "</b><span>" + k + "</span></div>").join("");
      showOverlay(won ? "ov-win" : "ov-lose");
    }
  }

  // ---------------------------------------------------------------- render
  let lastFrame = 0, rafPending = false;
  function schedule() { if (rafPending) return; rafPending = true; requestAnimationFrame((t) => { rafPending = false; frame(t, false); }); }
  function frame(now, fromFallback) {
    if (!fromFallback || !rafPending) schedule();
    let raw = (now - lastFrame) / 1000 || 0; lastFrame = now;
    const wall = performance.now(); S.frameN++;
    if (wall - S.fpsT0 >= 500) { S.fps = Math.round((S.frameN * 1000) / (wall - S.fpsT0)); S.fpsT0 = wall; S.frameN = 0; }
    // sub-step big gaps (hidden tab fallback clock) so sim time tracks wall time up to ~130ms/tick
    const sub = Math.min(8, Math.max(1, Math.ceil(raw / (1 / 60))));
    let dt = Math.min(1 / 60, raw / sub);
    if (S.mode === "play" || (S.mode === "title" && S.attract)) {
      for (let k = 0; k < sub; k++) { for (let i = 0; i < (S.attract ? 1 : S.pace); i++) update(dt); particles.update(dt); floaters.update(dt); }
      if (S.mode === "play") updateHUD();
    }
    draw();
  }

  const teamRingCache = {};
  function draw() {
    const cfg = S.cfg, spr = S.spr, z = S.cam.zoom, dpr = S.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#2E4E27"; ctx.fillRect(0, 0, S.vw, S.vh);
    if (!S.grid) return;
    let shx = 0, shy = 0; if (S.shake > 0) { shx = (Math.random() - 0.5) * 10 * S.shake; shy = (Math.random() - 0.5) * 10 * S.shake; }
    ctx.translate(S.vw / 2 + shx, S.vh / 2 + shy); ctx.scale(z, z); ctx.translate(-Math.round(S.cam.x), -Math.round(S.cam.y));
    const x0 = S.cam.x - S.vw / 2 / z, y0 = S.cam.y - S.vh / 2 / z, x1 = S.cam.x + S.vw / 2 / z, y1 = S.cam.y + S.vh / 2 / z;

    // ground
    const T = cfg.world.tile;
    const i0 = Math.max(0, Math.floor(x0 / T)), i1 = Math.min(Math.ceil(cfg.world.w / T) - 1, Math.floor(x1 / T));
    const j0 = Math.max(0, Math.floor(y0 / T)), j1 = Math.min(Math.ceil(cfg.world.h / T) - 1, Math.floor(y1 / T));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h = (h ^ (h >>> 16)) >>> 0; const v = h % 11; ctx.drawImage(spr.tiles[v < 6 ? 0 : v < 10 ? 1 : 2], i * T, j * T); }
    // world edge: dark line + a hedge of trees just outside the map
    ctx.strokeStyle = "rgba(20,36,16,.55)"; ctx.lineWidth = 10; ctx.strokeRect(0, 0, cfg.world.w, cfg.world.h);
    const W = cfg.world.w, H = cfg.world.h, tr = spr.trees[1], step = 34;
    const hedge = (x, y, k) => { const j = ((k * 7919) % 13) - 6; ctx.drawImage(tr, x - tr.width / 2 + j, y - tr.height + 8 + ((k * 104729) % 9)); };
    if (x0 < 0) for (let y = Math.max(-60, Math.floor(y0 / step) * step); y < Math.min(H + 60, y1 + 40); y += step) hedge(-16, y, y / step | 0);
    if (x1 > W) for (let y = Math.max(-60, Math.floor(y0 / step) * step); y < Math.min(H + 60, y1 + 40); y += step) hedge(W + 16, y, (y / step | 0) + 977);
    if (y0 < 0) for (let x = Math.max(-60, Math.floor(x0 / step) * step); x < Math.min(W + 60, x1 + 40); x += step) hedge(x, -8, (x / step | 0) + 1531);
    if (y1 > H) for (let x = Math.max(-60, Math.floor(x0 / step) * step); x < Math.min(W + 60, x1 + 40); x += step) hedge(x, H + 40, (x / step | 0) + 2467);
    // dirt trails between camps
    ctx.strokeStyle = "rgba(125,106,68,.42)"; ctx.lineWidth = 9; ctx.lineCap = "round";
    for (const tr of S.trails) {
      if (tr.maxX < x0 || tr.minX > x1 || tr.maxY < y0 || tr.minY > y1) continue;
      ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.quadraticCurveTo(tr.cx, tr.cy, tr.x1, tr.y1); ctx.stroke();
    }
    // camps
    for (const c of S.camps) if (c.x > x0 - 40 && c.x < x1 + 40 && c.y > y0 - 30 && c.y < y1 + 30) ctx.drawImage(spr.dirt, c.x - 32, c.y - 20);
    // decals
    for (const d of S.decals) { if (d.x < x0 - 20 || d.x > x1 + 20 || d.y < y0 - 20 || d.y > y1 + 20) continue; const im = spr.decals[d.k]; ctx.drawImage(im, d.x - im.width / 2, d.y - im.height / 2); }

    // team rings (buff / huddle indicator) under everything
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count < 2) continue;
      const r = 10 + Math.sqrt(t.count) * 7;
      let col = null;
      if (t.buffs.frenzy > 0) col = spr.PU.frenzy.color; else if (t.buffs.armor > 0) col = spr.PU.armor.color; else if (t.buffs.speed > 0) col = spr.PU.speed.color;
      if (t.isPlayer && S.input.huddle && !S.attract && !col) col = "rgba(255,255,255,.5)";
      if (!col) continue;
      ctx.globalAlpha = 0.28 + 0.12 * Math.sin(S.t * 8); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -S.t * 40;
      ctx.beginPath(); ctx.arc(t.cx, t.cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // player target marker
    const pl = S.teams[1];
    if (pl && pl.count > 0 && S.mode === "play") {
      const d = Math.hypot(pl.tx - pl.cx, pl.ty - pl.cy);
      if (d > 30) { ctx.globalAlpha = 0.85; ctx.drawImage(spr.marker, pl.tx - 2, pl.ty - 12); ctx.globalAlpha = 0.5; ctx.strokeStyle = pl.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.tx, pl.ty, 6 + 2 * Math.sin(S.t * 6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    }

    // power-ups
    for (const p of S.powerups) {
      if (!p.alive || p.x < x0 - 30 || p.x > x1 + 30 || p.y < y0 - 30 || p.y > y1 + 30) continue;
      const pu = spr.PU[p.kind], bob = Math.sin(p.t * 4) * 3, pulse = (p.t * 0.9) % 1;
      ctx.globalAlpha = 0.4; ctx.fillStyle = pu.color; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7 * (1 - pulse); ctx.strokeStyle = pu.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, 10 + pulse * 26, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.drawImage(spr.shadow, p.x - 6, p.y + 4);
      ctx.drawImage(pu.icon, p.x - 12, p.y - 16 + bob, 24, 24);
    }

    // shadows + sort list
    const DL = S.drawList; DL.length = 0;
    for (const a of S.agents) { if (a.x < x0 - 20 || a.x > x1 + 20 || a.y < y0 - 30 || a.y > y1 + 20) continue; DL.push(a); }
    for (const o of S.obstacles) { if (o.x < x0 - 40 || o.x > x1 + 40 || o.y < y0 - 60 || o.y > y1 + 30) continue; DL.push(o); }
    for (const a of DL) if (a.team !== undefined) ctx.drawImage(spr.shadow, a.x - 6, a.y - 1);
    DL.sort((p, q) => p.y - q.y);
    const neutralSet = spr._neutral || (spr._neutral = spr.peasantSet(cfg.neutral.color));
    for (const e of DL) {
      if (e.team === undefined) {
        if (e.kind === 2) ctx.drawImage(spr.rock, e.x - 14, e.y - 14);
        else { const tr = spr.trees[e.kind]; ctx.drawImage(tr, e.x - tr.width / 2, e.y - tr.height + 6); }
        continue;
      }
      const set = e.team ? S.teams[e.team].spr : neutralSet;
      const moving = e.vx * e.vx + e.vy * e.vy > 120;
      let f = e.lunge > 0.08 ? 2 : moving ? ((e.ph | 0) % 2) : 3;
      const img = (e.face < 0 ? set.L : set.R)[f];
      const bob = moving ? (((e.ph * 0.5) | 0) % 2) : 0;
      let sc = 1; if (e.pop > 0 && e.pop < 0.3) sc = 1 + 0.55 * (1 - e.pop / 0.3);
      const w = 24 * sc, h = 28 * sc, dx = e.x - w / 2, dy = e.y - 24 - bob - (h - 28);
      ctx.drawImage(img, dx, dy, w, h);
      if (e.fl > 0) { ctx.globalAlpha = Math.min(1, e.fl * 7); ctx.drawImage((e.face < 0 ? set.LW : set.RW)[f], dx, dy, w, h); ctx.globalAlpha = 1; }
      if (e.hp < cfg.agent.hp && e.team) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(e.x - 6, dy - 3, 12, 2); ctx.fillStyle = e.hp <= 1 ? "#FF5C5C" : "#FFD23F"; ctx.fillRect(e.x - 6, dy - 3, 12 * (e.hp / cfg.agent.hp), 2); }
    }

    particles.draw(ctx);
    floaters.draw(ctx);

    // camp head-count labels near the player
    if (S.mode === "play" && pl.count > 0) {
      ctx.font = "800 11px 'Nunito', system-ui"; ctx.textAlign = "center";
      for (const c of S.camps) {
        if (c.n === 0 || c.x < x0 - 40 || c.x > x1 + 40 || c.y < y0 - 40 || c.y > y1 + 40) continue;
        const d = Math.hypot(c.x - pl.cx, c.y - pl.cy); if (d > cfg.world.campLabelDist) continue;
        const a = clamp((cfg.world.campLabelDist - d) / 120, 0, 1); ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = "rgba(8,14,6,.7)"; ctx.fillRect(c.x - 15, c.y - 44, 30, 15); ctx.fillStyle = "#F1EEDF"; ctx.fillText("+" + c.n, c.x, c.y - 33);
      }
      ctx.globalAlpha = 1;
    }

    // name tags above every swarm (player too); the swarm currently clashing with the player is labelled by the clash panel instead
    let clashRival = 0; if (S.mode === "play" && !S.attract && pl.count > 0) { let best = 0.1; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive && pl.engT[i] > best) { best = pl.engT[i]; clashRival = i; } }
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count === 0 || i === clashRival || (t.isPlayer && (t.count < 2 || S.attract || S.engagedNow))) continue;
      if (t.cx < x0 - 60 || t.cx > x1 + 60 || t.cy < y0 - 60 || t.cy > y1 + 60) continue;
      const ly = Math.min(t.minY - 30, t.cy - 40);
      ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center";
      const label = (S.attract && t.isPlayer ? "Mint" : t.name) + " · " + t.count; const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = "rgba(8,14,6,.75)"; ctx.fillRect(t.cx - w / 2, ly - 13, w, 18);
      ctx.fillStyle = t.color; ctx.fillRect(t.cx - w / 2, ly - 13, 3, 18);
      ctx.fillStyle = "#F1EEDF"; ctx.fillText(label, t.cx + 1, ly);
    }

    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // off-screen rival arrows
    for (let i = 2; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count === 0 || S.mode !== "play") continue;
      const sx = (t.cx - S.cam.x) * z + S.vw / 2, sy = (t.cy - S.cam.y) * z + S.vh / 2;
      if (S.attract) continue;
      if (sx > 20 && sx < S.vw - 20 && sy > 60 && sy < S.vh - 20) continue;
      const cx = S.vw / 2, cy = S.vh / 2, ang = Math.atan2(sy - cy, sx - cx);
      let ex = clamp(sx, 26, S.vw - 26), ey = clamp(sy, S.input.touch ? 120 : 70, S.vh - (S.input.touch ? 46 : 26));
      const mm = S.input.touch ? 120 : 160; if (ex > S.vw - mm - 10 && ey > S.vh - mm - 10) ey = S.vh - mm - 14;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = t.color; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-3, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1; ctx.font = "800 11px 'Nunito', system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#F1EEDF";
      ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 3; ctx.strokeText(t.count, ex, ey + 22); ctx.fillText(t.count, ex, ey + 22);
    }
    // banner (one at a time, pinned high)
    for (let i = 0; i < Math.min(1, S.banners.length); i++) {
      const b = S.banners[i], age = 1 - b.life / b.life0;
      const a = Math.min(1, b.life * 2, age * 6); const y = S.input.touch ? 215 : Math.max(150, S.vh * 0.22);
      ctx.globalAlpha = a; ctx.font = "800 " + (S.vw < 700 ? 22 : 30) + "px 'Baloo 2', system-ui"; ctx.textAlign = "center";
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(b.text, S.vw / 2, y);
      ctx.fillStyle = b.color; ctx.fillText(b.text, S.vw / 2, y); ctx.globalAlpha = 1;
    }
    // clash panel: who is fighting whom and who is winning, unmissable, screen space
    let clashF = -1;
    if (S.mode === "play" && !S.attract && pl.count > 0) {
      let ri = 0, best = 0.1; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive && pl.engT[i] > best) { best = pl.engT[i]; ri = i; }
      if (ri) {
        const t = S.teams[ri];
        const mA = pl.count / Math.max(1, pl.engStart[ri] || pl.count), mB = t.count / Math.max(1, t.engStart[1] || t.count);
        clashF = mA / (mA + mB);
        const pw = Math.min(380, S.vw - 32), px = S.vw / 2 - pw / 2, py = S.input.touch ? 112 : 58, ph = 46;
        ctx.fillStyle = "rgba(8,14,6,.82)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.fill();
        ctx.font = "800 15px 'Nunito', system-ui"; ctx.textAlign = "left"; ctx.fillStyle = pl.color; ctx.fillText("YOU " + pl.count, px + 12, py + 20);
        ctx.textAlign = "right"; ctx.fillStyle = t.color; ctx.fillText(t.name.toUpperCase() + " " + t.count, px + pw - 12, py + 20);
        ctx.textAlign = "center"; ctx.font = "800 12px 'Nunito', system-ui";
        const verdict = clashF > 0.56 ? "WINNING" : clashF < 0.44 ? "LOSING" : "EVEN"; ctx.fillStyle = clashF > 0.56 ? "#7CF2C4" : clashF < 0.44 ? "#FF7A6E" : "#FFE49A"; ctx.fillText(verdict, px + pw / 2, py + 20);
        const bx = px + 12, bw = pw - 24, by = py + 30;
        ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(bx, by, bw, 8);
        ctx.fillStyle = pl.color; ctx.fillRect(bx, by, bw * clashF, 8); ctx.fillStyle = t.color; ctx.fillRect(bx + bw * clashF, by, bw * (1 - clashF), 8);
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bx + bw * clashF - 1, by - 2, 2, 12);
      }
    }
    // danger vignette while a clash is going against you
    if (S.mode === "play" && S.engagedNow) {
      const outn = clashF >= 0 && clashF < 0.46;
      if (outn) { const g = ctx.createRadialGradient(S.vw / 2, S.vh / 2, S.vh * 0.35, S.vw / 2, S.vh / 2, S.vh * 0.85); g.addColorStop(0, "rgba(200,30,30,0)"); g.addColorStop(1, "rgba(200,30,30," + (0.22 + 0.1 * Math.sin(S.t * 10)) + ")"); ctx.fillStyle = g; ctx.fillRect(0, 0, S.vw, S.vh); }
    }
    if (S.vignette) ctx.drawImage(S.vignette, 0, 0, S.vw, S.vh);
    if (S.debug) { ctx.font = "12px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("fps " + S.fps + "  agents " + S.agents.length + "  seed " + S.seed, 8, S.vh - 8); }

    drawMinimap();
  }

  function drawMinimap() {
    if (S.mode === "title" || S.attract) return;
    const cfg = S.cfg, W = cfg.world.w, H = cfg.world.h, k = 150 / Math.max(W, H);
    mctx.fillStyle = "#1f3a1a"; mctx.fillRect(0, 0, 150, 150);
    mctx.fillStyle = "#16301b"; for (const o of S.obstacles) mctx.fillRect((o.x * k) | 0, (o.y * k) | 0, 2, 2);
    mctx.fillStyle = "#c9bd9c"; for (const a of S.agents) if (a.team === 0) mctx.fillRect((a.x * k) | 0, (a.y * k) | 0, 1, 1);
    for (const p of S.powerups) if (p.alive) { mctx.fillStyle = S.spr.PU[p.kind].color; mctx.fillRect((p.x * k - 1) | 0, (p.y * k - 1) | 0, 3, 3); }
    for (let i = S.teams.length - 1; i >= 1; i--) { const t = S.teams[i]; mctx.fillStyle = t.color; for (const a of S.agents) if (a.team === i) mctx.fillRect((a.x * k) | 0, (a.y * k) | 0, 2, 2); }
    const z = S.cam.zoom; mctx.strokeStyle = "rgba(255,255,255,.9)"; mctx.lineWidth = 1.5;
    mctx.strokeRect((S.cam.x - S.vw / 2 / z) * k, (S.cam.y - S.vh / 2 / z) * k, (S.vw / z) * k, (S.vh / z) * k);
  }

  // ---------------------------------------------------------------- HUD
  function buildTeamChips() {
    const el = $("teams"); el.innerHTML = "";
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i];
      const c = document.createElement("div"); c.className = "chip" + (t.isPlayer ? " you" : "") + (t.alive ? "" : " dead"); c.id = "chip-" + i;
      c.innerHTML = "<span class='sw' style='background:" + t.color + "'></span><span>" + t.name + "</span><span class='n'>" + t.count + "</span>";
      el.appendChild(c);
    }
  }
  let hudT = 0;
  function updateHUD(force) {
    const now = performance.now(); if (!force && now - hudT < 100) return; hudT = now;
    for (let i = 1; i < S.teams.length; i++) { const el = $("chip-" + i); if (el) el.lastElementChild.textContent = S.teams[i].count; }
    const tl = Math.max(0, S.timeLeft), m = Math.floor(tl / 60), s = Math.floor(tl % 60);
    const tm = $("timer"); tm.textContent = m + ":" + (s < 10 ? "0" : "") + s; tm.classList.toggle("urgent", tl < 30);
    const b = $("buffs"), t = S.teams[1], cfg = S.cfg.powerups; let h = "";
    for (const k of ["speed", "armor", "frenzy"]) if (t.buffs[k] > 0) h += "<div class='buff' style='color:" + S.spr.PU[k].color + ";border-color:" + S.spr.PU[k].color + "'><span>" + k.toUpperCase() + "</span><span class='bar'><i style='width:" + (100 * t.buffs[k] / cfg.duration[k]) + "%'></i></span></div>";
    if (b.innerHTML !== h) b.innerHTML = h;
  }

  // ---------------------------------------------------------------- input
  function bindInput() {
    const inp = S.input;
    canvas.addEventListener("pointermove", (e) => { inp.px = e.clientX; inp.py = e.clientY; if (e.pointerType === "mouse" || e.buttons) inp.active = true; });
    canvas.addEventListener("pointerdown", (e) => { inp.px = e.clientX; inp.py = e.clientY; inp.active = true; if (e.pointerType !== "mouse") { inp.touch = true; document.body.classList.add("touch"); } PS.audio.unlock(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
    canvas.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") inp.active = false; });
    canvas.addEventListener("pointercancel", () => { inp.active = false; });
    canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") inp.active = false; });
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      inp.keys[k] = true;
      if (k === " ") { e.preventDefault(); if (S.mode === "play") setHuddle(true); }
      if (k === "p" || k === "Escape") { if (S.mode === "play") pause(); else if (S.mode === "pause") resume(); }
      if (k === "m") toggleSound();
      if (k === "1") setPace(0); if (k === "2") setPace(1);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; inp.keys[k] = false; if (k === " ") setHuddle(false); });
    window.addEventListener("blur", () => { inp.keys = {}; setHuddle(false); });
    const hb = $("t-huddle");
    hb.addEventListener("pointerdown", (e) => { e.preventDefault(); setHuddle(true); });
    hb.addEventListener("pointerup", () => setHuddle(false));
    hb.addEventListener("pointercancel", () => setHuddle(false));
    hb.addEventListener("pointerleave", () => setHuddle(false));
    if ("ontouchstart" in window && !window.matchMedia("(pointer:fine)").matches) { inp.touch = true; document.body.classList.add("touch"); }
    document.addEventListener("visibilitychange", () => { if (document.hidden && S.mode === "play") pause(); });
  }
  function setHuddle(on) { if (S.input.huddle === on) return; S.input.huddle = on; $("t-huddle").classList.toggle("on", on); if (S.mode === "play") PS.audio.huddle(on); }

  function bindUI() {
    try { const d = localStorage.getItem("ps.difficulty"); if (d && S.cfg.difficulty[d]) S.difficulty = d; } catch (e) {}
    const row = $("difficulty");
    for (const k of Object.keys(S.cfg.difficulty)) {
      const b = document.createElement("button"); b.textContent = S.cfg.difficulty[k].label; b.dataset.k = k;
      b.onclick = () => { S.difficulty = k; try { localStorage.setItem("ps.difficulty", k); } catch (e) {} syncDifficulty(); PS.audio.click(); };
      row.appendChild(b);
    }
    syncDifficulty();
    $("btn-play").onclick = () => startGame();
    $("btn-again").onclick = () => startGame();
    $("btn-retry").onclick = () => startGame();
    $("btn-title-w").onclick = () => toTitle();
    $("btn-title-l").onclick = () => toTitle();
    $("btn-quit").onclick = () => toTitle();
    $("btn-resume").onclick = () => resume();
    $("btn-pause").onclick = () => { if (S.mode === "play") pause(); };
    $("btn-pace").onclick = () => setPace((S.cfg.pace.indexOf(S.pace) + 1) % S.cfg.pace.length);
    for (const id of ["btn-sound", "btn-sound-title", "btn-sound-pause"]) $(id).onclick = () => toggleSound();
    syncSound();
  }
  function showOverlay(id) { document.querySelectorAll(".overlay").forEach((o) => o.classList.toggle("active", o.id === id)); }
  function startGame() { PS.audio.setSilent(false); PS.audio.unlock(); PS.audio.click(); newGame(false); S.mode = "play"; S._hintFight = S._hintHud = S._hintRecruit = false; S._routedBy = null; showOverlay(null); $("hud").classList.remove("hidden"); updateHUD(); }
  function toTitle() { PS.audio.stopDrum(); S.mode = "title"; showOverlay("ov-title"); $("hud").classList.add("hidden"); setHuddle(false); newGame(true); }
  function pause() { S.mode = "pause"; PS.audio.stopDrum(); showOverlay("ov-pause"); setHuddle(false); }
  function resume() { S.mode = "play"; showOverlay(null); lastFrame = performance.now(); }
  function setPace(i) { S.pace = S.cfg.pace[i]; $("btn-pace").textContent = S.pace + "×"; }
  function toggleSound() { PS.audio.setMuted(!PS.audio.isMuted()); syncSound(); }
  function syncDifficulty() { for (const b of $("difficulty").children) b.classList.toggle("sel", b.dataset.k === S.difficulty); }
  function syncSound() { const m = PS.audio.isMuted(); for (const id of ["btn-sound", "btn-sound-title", "btn-sound-pause"]) $(id).classList.toggle("off", m); }

  boot();
})();
