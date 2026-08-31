// Dinosaur Fight! — core engine. Vanilla canvas, chunky pixels.
// Concept by Henry, age 5. Built by Click it! Studios.
(function () {
  "use strict";
  const V = "?v=6"; // cache-bust for JSON fetches — keep in sync with index.html
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  let CFG = null, LEVELS = null, SPR = null;
  const P = DF.Particles, AU = DF.Audio;

  // ---------------- state ----------------
  const S = {
    mode: "title",           // title | levels | play | win | lose | pause
    li: 0,                   // level index
    grid: null, gw: 0, gh: 17, theme: "jungle",
    pl: null, enemies: [], bullets: [], nets: [], items: [], flyoffs: [],
    decor: [], checkpoints: [], flag: null, start: null,
    eggsTotal: 0, eggsGot: 0, baddiesTotal: 0,
    camX: 0, shake: 0, t: 0, nameT: 0,
    boss: null, bossIntroT: 0,
    winT: -1, loseT: -1,
    debug: /(\?|&)debug=1/.test(location.search),
    invulnCheat: false,
  };
  if (S.debug) window.DFS = S; // state handle for automated testing only
  const keys = {};
  const input = { left: false, right: false, jumpHeld: false, jumpBuf: 0, pounce: false, grow: false, shrink: false };

  const save = {
    load() {
      try { return JSON.parse(localStorage.getItem("df1") || "null") || { stars: [0, 0, 0, 0], unlocked: 1 }; }
      catch (e) { return { stars: [0, 0, 0, 0], unlocked: 1 }; }
    },
    write(d) { try { localStorage.setItem("df1", JSON.stringify(d)); } catch (e) {} },
  };
  let progress = save.load();

  // ---------------- boot ----------------
  Promise.all([
    fetch("config.json" + V).then(r => r.json()),
    fetch("levels.json" + V).then(r => r.json()),
  ]).then(([cfg, lv]) => {
    CFG = cfg; LEVELS = lv.levels;
    SPR = DF.buildSprites();
    AU.setVols(cfg.audio.musicVol, cfg.audio.sfxVol);
    const snd = localStorage.getItem("df1_sound");
    if (snd === "off") AU.setEnabled(false);
    syncSoundButtons();
    wireUI();
    resize();
    buildBackgrounds();
    requestAnimationFrame(frame);
  });

  // ---------------- canvas scale ----------------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let s = Math.min(w / 480, h / 272);
    if (s >= 2 && Math.abs(s - Math.round(s)) < 0.22) s = Math.round(s);
    cv.style.width = Math.floor(480 * s) + "px";
    cv.style.height = Math.floor(272 * s) + "px";
  }
  window.addEventListener("resize", resize);

  // ---------------- input ----------------
  // Left hand moves (WASD + Space), right hand powers (arrows).
  // Letter keys kept as quiet alternates for older hands.
  const KEYMAP = {
    a: "left", A: "left",
    d: "right", D: "right",
    " ": "jump", w: "jump", W: "jump",
    ArrowUp: "grow", ArrowDown: "shrink",
    ArrowLeft: "pounceL", ArrowRight: "pounceR",
    x: "pounce", X: "pounce", j: "pounce", J: "pounce",
    c: "grow", C: "grow", k: "grow", K: "grow",
    z: "shrink", Z: "shrink", l: "shrink", L: "shrink",
  };
  window.addEventListener("keydown", e => {
    if (e.repeat) return;
    const a = KEYMAP[e.key];
    if (a) { e.preventDefault(); press(a); keys[a] = true; }
    if ((e.key === "p" || e.key === "P" || e.key === "Escape") && (S.mode === "play" || S.mode === "pause")) togglePause();
  });
  window.addEventListener("keyup", e => { const a = KEYMAP[e.key]; if (a) keys[a] = false; });
  function press(a) {
    if (S.mode !== "play") return;
    if (a === "jump") input.jumpBuf = CFG.player.jumpBuffer;
    if (a === "pounce") input.pounce = true;
    if (a === "pounceL") { if (S.pl) S.pl.facing = -1; input.pounce = true; }
    if (a === "pounceR") { if (S.pl) S.pl.facing = 1; input.pounce = true; }
    if (a === "grow") input.grow = true;
    if (a === "shrink") input.shrink = true;
  }
  function held(a) { return !!keys[a] || touchHeld[a]; }

  // touch
  const touchHeld = {};
  function bindTouch(id, action) {
    const el = document.getElementById(id);
    const down = e => { e.preventDefault(); touchHeld[action] = true; press(action); };
    const up = e => { e.preventDefault(); touchHeld[action] = false; };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
  }
  if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) document.body.classList.add("touch");

  // ---------------- UI wiring ----------------
  function show(id) {
    document.querySelectorAll(".overlay").forEach(o => o.classList.remove("active"));
    if (id) document.getElementById(id).classList.add("active");
  }
  function wireUI() {
    const $ = id => document.getElementById(id);
    $("btn-play").onclick = () => { AU.unlock(); AU.click(); AU.startMusic(); showLevels(); };
    $("btn-back-title").onclick = () => { AU.click(); S.mode = "title"; show("ov-title"); };
    $("btn-next").onclick = () => { AU.click(); startLevel(S.li + 1); };
    $("btn-replay").onclick = () => { AU.click(); startLevel(S.li); };
    $("btn-retry").onclick = () => { AU.click(); startLevel(S.li); };
    $("btn-map").onclick = () => { AU.click(); showLevels(); };
    $("btn-map2").onclick = () => { AU.click(); showLevels(); };
    $("btn-pause").onclick = () => togglePause();
    $("btn-resume").onclick = () => togglePause();
    $("btn-quit-level").onclick = () => { AU.click(); document.body.classList.remove("playing"); showLevels(); };
    $("btn-sound-title").onclick = toggleSound;
    $("btn-sound-pause").onclick = toggleSound;
    bindTouch("t-left", "left"); bindTouch("t-right", "right");
    bindTouch("t-jump", "jump"); bindTouch("t-pounce", "pounce");
    bindTouch("t-grow", "grow"); bindTouch("t-shrink", "shrink");
    if (S.debug) {
      const bar = document.createElement("div");
      bar.style.cssText = "position:absolute;bottom:.4rem;left:.4rem;z-index:9;display:flex;gap:.3rem";
      for (const [label, fn] of [
        ["SKIP", () => { if (S.mode === "play") winLevel(); }],
        ["PWR", () => { if (S.pl) S.pl.power = CFG.player.power.max; }],
        ["INV", () => { S.invulnCheat = !S.invulnCheat; }],
      ]) {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = "min-height:30px;min-width:30px;padding:.1rem .4rem;font-size:.7rem";
        b.onclick = fn;
        bar.appendChild(b);
      }
      document.getElementById("stage").appendChild(bar);
    }
  }
  function toggleSound() {
    AU.setEnabled(!AU.enabled);
    localStorage.setItem("df1_sound", AU.enabled ? "on" : "off");
    if (AU.enabled && S.mode !== "title") AU.startMusic();
    syncSoundButtons();
  }
  function syncSoundButtons() {
    document.querySelectorAll(".btn-sound").forEach(b => b.classList.toggle("off", !AU.enabled));
  }
  function showLevels() {
    S.mode = "levels";
    document.body.classList.remove("playing");
    const grid = document.getElementById("level-grid");
    grid.innerHTML = "";
    LEVELS.forEach((lv, i) => {
      const locked = i >= progress.unlocked;
      const card = document.createElement("div");
      card.className = "lvl-card" + (locked ? " locked" : "") + (i === 3 ? " boss" : "");
      const stars = progress.stars[i] || 0;
      card.innerHTML = `<span class="num">${i === 3 ? "!" : i + 1}</span><span class="nm">${lv.name}</span>` +
        `<span class="st">${locked ? "🔒" : "★".repeat(stars) + `<span style="color:#2E4433">${"★".repeat(3 - stars)}</span>`}</span>`;
      if (!locked) card.onclick = () => { AU.click(); startLevel(i); };
      grid.appendChild(card);
    });
    show("ov-levels");
  }
  function togglePause() {
    if (S.mode === "play") { S.mode = "pause"; show("ov-pause"); AU.stopMusic(); }
    else if (S.mode === "pause") { S.mode = "play"; show(null); AU.startMusic(); }
  }

  // ---------------- level load ----------------
  const SOLID = "#-BM";
  function cellAt(tx, ty) {
    if (tx < 0 || tx >= S.gw) return "#";
    if (ty < 0) return ".";
    if (ty >= S.gh) return "#";
    return S.grid[ty][tx];
  }
  function solidAt(tx, ty) { return SOLID.includes(cellAt(tx, ty)); }

  function startLevel(i) {
    S.li = i;
    const lv = LEVELS[i];
    S.theme = lv.theme;
    S.gw = lv.rows[0].length;
    S.grid = lv.rows.map(r => r.split(""));
    S.enemies = []; S.bullets = []; S.nets = []; S.items = []; S.decor = [];
    S.checkpoints = []; S.flyoffs = []; S.boss = null;
    S.eggsGot = 0; S.t = 0; S.nameT = 3; S.winT = -1; S.loseT = -1;
    S.shake = 0; S.bossIntroT = i === 3 ? 2.2 : 0;
    if (i === 3) S.nameT = 0; // boss intro text is enough — no name toast on top
    P.clear();
    for (let y = 0; y < S.gh; y++) for (let x = 0; x < S.gw; x++) {
      const ch = S.grid[y][x];
      const wx = x * 16 + 8, wy = y * 16 + 16; // feet-center of the cell
      switch (ch) {
        case "P": S.start = { x: wx, y: wy }; S.grid[y][x] = "."; break;
        case "e": S.items.push({ kind: "egg", x: wx, y: wy - 3, got: false }); S.grid[y][x] = "."; break;
        case "h": S.items.push({ kind: "heart", x: wx, y: wy - 3, got: false }); S.grid[y][x] = "."; break;
        case "w": S.enemies.push(makeEnemy("walker", wx, wy)); S.grid[y][x] = "."; break;
        case "s": S.enemies.push(makeEnemy("shooter", wx, wy)); S.grid[y][x] = "."; break;
        case "n": S.enemies.push(makeEnemy("netter", wx, wy)); S.grid[y][x] = "."; break;
        case "Z": { const b = makeEnemy("boss", wx, wy); S.enemies.push(b); S.boss = b; S.grid[y][x] = "."; break; }
        case "F": S.flag = { x: wx, y: wy, open: false, sparkT: 0 }; S.grid[y][x] = "."; break;
        case "C": S.checkpoints.push({ x: wx, y: wy, on: false }); S.grid[y][x] = "."; break;
        case "t": S.decor.push({ spr: "tree", x: wx, y: wy }); S.grid[y][x] = "."; break;
        case "f": S.decor.push({ spr: "fern", x: wx, y: wy }); S.grid[y][x] = "."; break;
        case "r": S.decor.push({ spr: "rock", x: wx, y: wy }); S.grid[y][x] = "."; break;
      }
    }
    // teaching hints, derived from geometry: tall crate walls → GROW, 1-tile tunnels → SHRINK
    S.hints = [];
    for (let x = 0; x < S.gw; x++) {
      let run = 0;
      for (let y = 0; y <= S.gh; y++) {
        if (y < S.gh && S.grid[y][x] === "B") run++;
        else {
          if (run >= 3 && !S.hints.some(hh => hh.kind === "grow" && Math.abs(hh.x - (x * 16 + 8)) < 48))
            S.hints.push({ x: x * 16 + 8, y: (y - run) * 16 - 10, kind: "grow" });
          run = 0;
        }
      }
    }
    for (let y = 1; y < S.gh - 1; y++) {
      let run = null;
      for (let x = 0; x <= S.gw; x++) {
        const isT = x < S.gw && S.grid[y][x] === "." &&
          SOLID.includes(cellAt(x, y - 1)) && SOLID.includes(cellAt(x, y + 1));
        if (isT && run === null) run = x;
        if (!isT && run !== null) {
          if (x - run >= 4) S.hints.push({ x: run * 16 - 8, y: y * 16 - 12, kind: "shrink" });
          run = null;
        }
      }
    }
    S.eggsTotal = S.items.filter(it => it.kind === "egg").length;
    S.baddiesTotal = S.enemies.length;
    S.pl = makePlayer(S.start.x, S.start.y);
    S.camX = Math.max(0, Math.min(S.pl.x - 200, S.gw * 16 - 480));
    S.mode = "play";
    show(null);
    document.body.classList.add("playing");
    buildBackgrounds();
    AU.startMusic();
    if (i === 3) setTimeout(() => AU.bossRoar(), 600);
  }

  function makePlayer(x, y) {
    return {
      x, y, vx: 0, vy: 0, size: "normal", facing: 1,
      onGround: false, coyote: 0, jumps: 0,
      pounceT: 0, pounceCd: 0,
      hearts: CFG.player.hearts, power: CFG.player.power.max * 0.5,
      invuln: 0, slowT: 0, animT: 0, squash: 0, dead: false,
      cp: null,
    };
  }
  function plDims(size) {
    const k = CFG.player.sizes[size || S.pl.size];
    return { w: Math.max(5, Math.round(12 * k)), h: Math.max(6, Math.round(17 * k)), k };
  }

  function makeEnemy(type, x, y) {
    const c = CFG.enemies[type];
    return {
      type, x, y, vx: type === "walker" ? -c.speed : 0, vy: 0,
      hp: c.hp, facing: -1, state: "idle", t: 0, cd: 1 + Math.random(),
      flashT: 0, dead: false, animT: Math.random() * 2,
      // boss extras
      chargeDir: -1, fanT: c.fanCooldown || 0,
    };
  }
  function enemyDims(e) {
    return e.type === "boss" ? { w: 34, h: 52 } : { w: 10, h: 17 };
  }
  // pixel contact shadow, projected to the ground below — seats sprites in the world
  function pixShadow(cx, footY, w) {
    const tx = Math.floor(cx / 16);
    let ty = Math.floor(footY / 16);
    while (ty < S.gh && !solidAt(tx, ty)) ty++;
    if (ty >= S.gh) return;
    const gy = ty * 16;
    const dist = Math.min(1, (gy - footY) / 120);
    const ww = Math.max(4, w * (1 - dist * 0.45));
    ctx.fillStyle = `rgba(0,0,0,${(0.28 * (1 - dist * 0.6)).toFixed(2)})`;
    ctx.fillRect(Math.round(cx - ww / 2), gy - 1, Math.round(ww), 2);
    ctx.fillRect(Math.round(cx - ww / 3), gy + 1, Math.round(ww * 2 / 3), 1);
  }

  // ---------------- physics helpers ----------------
  function collideRect(x, y, w, h, solids) {
    // returns true if AABB (centered x, bottom y) hits solid
    const sol = solids || SOLID;
    const x0 = Math.floor((x - w / 2) / 16), x1 = Math.floor((x + w / 2 - 0.01) / 16);
    const y0 = Math.floor((y - h) / 16), y1 = Math.floor((y - 0.01) / 16);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
      if (sol.includes(cellAt(tx, ty))) return true;
    return false;
  }
  const BIG_SOLID = "#BM"; // the T-rex is too heavy for wooden '-' platforms — walks right past them
  function moveEntity(o, w, h, dt, opts = {}) {
    const sol = opts.solids;
    // horizontal
    let nx = o.x + o.vx * dt;
    if (collideRect(nx, o.y, w, h, sol)) {
      const dir = Math.sign(o.vx);
      // smash crates if big player
      if (opts.smash && dir !== 0) {
        const tx = Math.floor((nx + dir * w / 2) / 16);
        smashColumn(tx, o.y, h);
        if (!collideRect(nx, o.y, w, h, sol)) { o.x = nx; o.hitWall = false; }
        else if (opts.stepUp && o.onGround && !collideRect(nx, o.y - 17, w, h, sol)) {
          o.y -= 17; o.x = nx; o.hitWall = false; // T-rex strides up 1-tile ledges
        } else snapX(o, w, dir, sol);
      } else if (opts.stepUp && dir !== 0 && o.onGround && !collideRect(nx, o.y - 17, w, h, sol)) {
        o.y -= 17; o.x = nx; o.hitWall = false;
      } else snapX(o, w, dir, sol);
    } else { o.x = nx; o.hitWall = false; }
    // vertical
    o.vy += (opts.g == null ? CFG.player.gravity : opts.g) * dt;
    let ny = o.y + o.vy * dt;
    o.onGround = false;
    if (collideRect(o.x, ny, w, h, sol)) {
      if (o.vy > 0) {
        o.y = Math.floor((ny - 0.01) / 16) * 16;
        // ensure resting exactly on tile top (bounded — never spin forever)
        let g1 = 0;
        while (collideRect(o.x, o.y, w, h, sol) && ++g1 < 64) o.y -= 1;
        o.onGround = true;
      } else {
        if (opts.smash) { const ty = Math.floor((ny - h) / 16); smashRow(o.x, ty, w); }
        if (collideRect(o.x, ny, w, h, sol)) {
          let g2 = 0;
          while (collideRect(o.x, ny, w, h, sol) && ++g2 < 64) ny += 1;
          if (g2 >= 64) ny = o.y; // hopeless — stay put instead of hanging the page
        }
        o.y = ny;
      }
      o.vy = 0;
    } else o.y = ny;
  }
  function snapX(o, w, dir, sol) {
    if (dir > 0) o.x = Math.floor((o.x + w / 2) / 16) * 16 + 16 - w / 2 - 0.02;
    if (dir < 0) o.x = Math.floor((o.x - w / 2) / 16) * 16 + w / 2 + 0.02;
    // fallback nudge if still stuck
    let guard = 0;
    while (collideRect(o.x, o.y, w, plDimsSafe(o), sol)) { o.x -= dir; if (++guard > 20) break; }
    o.vx = 0; o.hitWall = true;
  }
  function plDimsSafe(o) { return o === S.pl ? plDims().h : enemyDims(o).h; }

  function smashColumn(tx, footY, h) {
    for (let ty = Math.floor((footY - h) / 16); ty <= Math.floor((footY - 1) / 16); ty++) smashCell(tx, ty);
  }
  function smashRow(cx, ty, w) {
    for (let tx = Math.floor((cx - w / 2) / 16); tx <= Math.floor((cx + w / 2) / 16); tx++) smashCell(tx, ty);
  }
  function smashCell(tx, ty) {
    if (cellAt(tx, ty) === "B") {
      S.grid[ty][tx] = ".";
      P.crate(tx * 16 + 8, ty * 16 + 8);
      AU.smash();
      S.shake = Math.min(CFG.fx.shakeMax, S.shake + 3);
    }
  }

  // ---------------- player update ----------------
  function updatePlayer(dt) {
    const pl = S.pl, PC = CFG.player, d = plDims();
    if (pl.dead) { pl.vy += PC.gravity * dt; pl.y += pl.vy * dt; return; }

    // timers
    pl.invuln = Math.max(0, pl.invuln - dt);
    pl.slowT = Math.max(0, pl.slowT - dt);
    pl.pounceCd = Math.max(0, pl.pounceCd - dt);
    pl.coyote = Math.max(0, pl.coyote - dt);
    input.jumpBuf = Math.max(0, input.jumpBuf - dt);
    pl.squash = Math.max(0, pl.squash - dt * 3);

    // power drain / regen
    const pw = PC.power;
    if (pl.size === "big") { pl.power -= pw.drainBig * dt; if (pl.power <= 0) setSize("normal", true); }
    else if (pl.size === "small") {
      pl.power -= pw.drainSmall * dt;
      if (pl.power <= 0) {
        // stay small (Mario-style) until there's headroom to pop back
        const nd = plDims("normal");
        if (!collideRect(pl.x, pl.y, nd.w, nd.h)) setSize("normal", true);
        else pl.power = 0;
      }
    }
    else pl.power = Math.min(pw.max, pl.power + pw.regen * dt);
    pl.power = Math.max(0, pl.power);

    // transform requests
    if (input.grow) { input.grow = false; requestSize(pl.size === "big" ? "normal" : "big"); }
    if (input.shrink) { input.shrink = false; requestSize(pl.size === "small" ? "normal" : "small"); }

    // horizontal
    const slow = pl.slowT > 0 ? CFG.enemies.netter.slowFactor : 1;
    const spd = PC.runSpeed * (PC.speedMul[pl.size] || 1) * slow;
    const ax = (held("left") ? -1 : 0) + (held("right") ? 1 : 0);
    if (pl.pounceT > 0) {
      pl.pounceT -= dt;
      pl.vx = pl.facing * PC.pounceSpeed * (pl.size === "small" ? 0.8 : 1);
    } else if (ax !== 0) {
      pl.facing = ax;
      pl.vx += ax * PC.accel * dt;
      pl.vx = Math.max(-spd, Math.min(spd, pl.vx));
      if (pl.onGround && Math.random() < dt * 6) P.dust(pl.x - pl.facing * 4, pl.y, -pl.facing, 1);
      if (pl.size === "big" && pl.onGround) {
        pl.stepT = (pl.stepT || 0) - dt;
        if (pl.stepT <= 0) {
          pl.stepT = 0.34;
          AU.thump(); P.dust(pl.x, pl.y, 0, 4);
          S.shake = Math.min(CFG.fx.shakeMax, S.shake + 1.6);
        }
      }
    } else {
      const f = PC.friction * dt;
      if (Math.abs(pl.vx) <= f) pl.vx = 0; else pl.vx -= Math.sign(pl.vx) * f;
    }

    // jumping
    if (pl.onGround) { pl.coyote = PC.coyoteTime; pl.jumps = 0; }
    if (input.jumpBuf > 0) {
      if (pl.coyote > 0 || pl.jumps === 0) {
        doJump(false);
      } else if (PC.doubleJump && pl.jumps === 1) {
        doJump(true);
      }
    }
    if (!held("jump") && pl.vy < -170) pl.vy = -170; // variable jump: a tap still clears one tile

    // pounce trigger
    if (input.pounce) {
      input.pounce = false;
      if (pl.pounceCd <= 0) {
        pl.pounceT = PC.pounceTime; pl.pounceCd = PC.pounceCooldown;
        AU.pounce();
        P.dust(pl.x, pl.y, -pl.facing, 3);
      }
    }

    const wasAir = !pl.onGround;
    moveEntity(pl, d.w, d.h, dt, {
      smash: pl.size === "big", stepUp: pl.size === "big",
      solids: pl.size === "big" ? BIG_SOLID : undefined,
    });
    if (wasAir && pl.onGround) {
      pl.squash = 1;
      P.dust(pl.x, pl.y, 0, pl.size === "big" ? 12 : 3);
      if (pl.size === "big") {
        S.shake = Math.min(CFG.fx.shakeMax, S.shake + 4); AU.thump();
        P.ring(pl.x, pl.y, "#8A6E4A", 140); // landing shockwave
      }
    }
    pl.animT += dt * (Math.abs(pl.vx) > 10 ? 1 : 0.4);

    // world bounds
    pl.x = Math.max(d.w / 2, Math.min(S.gw * 16 - d.w / 2, pl.x));
    if (pl.y > S.gh * 16 + 40) waterDeath(); // fell out of world

    // water
    const feet = cellAt(Math.floor(pl.x / 16), Math.floor((pl.y - 2) / 16));
    if (feet === "~") waterDeath();

    // checkpoints
    for (const cp of S.checkpoints) {
      if (!cp.on && pl.x >= cp.x) { cp.on = true; pl.cp = cp; AU.checkpoint(); P.sparkle(cp.x, cp.y - 20); }
    }

    // items
    for (const it of S.items) {
      if (it.got) continue;
      if (Math.abs(it.x - pl.x) < d.w / 2 + 5 && Math.abs(it.y - 4 - (pl.y - d.h / 2)) < d.h / 2 + 6) {
        it.got = true;
        if (it.kind === "egg") {
          S.eggsGot++;
          pl.power = Math.min(PC.power.max, pl.power + PC.power.eggRefill);
          AU.egg(); P.sparkle(it.x, it.y - 4);
        } else {
          pl.hearts = Math.min(PC.hearts, pl.hearts + 1);
          AU.heartPickup(); P.sparkle(it.x, it.y - 4, "#FF9AA0");
        }
      }
    }

    // flag
    const f = S.flag;
    const remaining = S.enemies.filter(e => !e.dead).length;
    if (!f.open && remaining === 0) {
      f.open = true; AU.flagOpen(); P.confetti(f.x, f.y - 10, 14);
    }
    if (f.open && Math.abs(f.x - pl.x) < 12 && Math.abs(f.y - pl.y) < 24) winLevel();
  }
  function doJump(isDouble) {
    const pl = S.pl, PC = CFG.player;
    pl.vy = -PC.jumpVel * (PC.jumpMul[pl.size] || 1);
    pl.jumps = isDouble ? 2 : 1;
    pl.coyote = 0; input.jumpBuf = 0;
    pl.onGround = false;
    if (isDouble) { AU.djump(); P.dust(pl.x, pl.y, 0, 4); } else AU.jump();
  }
  function requestSize(target) {
    const pl = S.pl, pw = CFG.player.power;
    if (target !== "normal" && pl.power < pw.minToTransform) { AU.deny(); return; }
    if (target !== "small") {
      const d = plDims(target);
      if (collideRect(pl.x, pl.y, d.w, d.h, target === "big" ? BIG_SOLID : undefined)) { AU.deny(); return; } // no headroom
    }
    setSize(target, false);
  }
  function setSize(target, auto) {
    const pl = S.pl;
    if (pl.size === target) return;
    const big = target === "big";
    pl.size = target;
    P.grow(pl.x, pl.y - plDims().h / 2, big);
    if (big) AU.grow(); else AU.shrink();
    if (big) pl.slowT = 0; // big shrugs off nets
  }
  function waterDeath() {
    const pl = S.pl;
    AU.splash(); P.splash(pl.x, pl.y);
    // invuln frames protect the heart (e.g. knocked into water right after a hit),
    // but you still get fished out and put back at the checkpoint
    if (pl.invuln <= 0) hurt(pl.x, 1, true);
    if (pl.hearts > 0) {
      const cp = pl.cp || S.start;
      pl.x = cp.x; pl.y = cp.y - 2; pl.vx = 0; pl.vy = 0;
      pl.invuln = CFG.player.invulnTime;
      setSizeSafe("normal");
    }
  }
  function setSizeSafe(t) { if (S.pl.size !== t) { S.pl.size = t; } }
  function hurt(srcX, dmg, skipInvulnGate) {
    const pl = S.pl;
    if (pl.dead) return;
    if (!skipInvulnGate && (pl.invuln > 0 || S.invulnCheat)) return;
    if (S.invulnCheat) return;
    pl.hearts -= dmg;
    pl.invuln = CFG.player.invulnTime;
    pl.vx = (pl.x < srcX ? -1 : 1) * CFG.player.knockback;
    pl.vy = -120;
    AU.hurt();
    S.shake = Math.min(CFG.fx.shakeMax, S.shake + 4);
    if (pl.hearts <= 0) {
      pl.hearts = 0; pl.dead = true; pl.vy = -220;
      S.loseT = 1.1;
      AU.lose(); AU.stopMusic();
    }
  }

  // ---------------- enemies ----------------
  function updateEnemies(dt) {
    const pl = S.pl, pd = plDims();
    for (const e of S.enemies) {
      if (e.dead) continue;
      const ed = enemyDims(e), c = CFG.enemies[e.type];
      e.animT += dt; e.flashT = Math.max(0, e.flashT - dt);
      const dx = pl.x - e.x, adx = Math.abs(dx), ady = Math.abs(pl.y - e.y);

      if (e.type === "walker") {
        // turn at walls and ledges
        const dir = Math.sign(e.vx) || -1;
        const aheadX = Math.floor((e.x + dir * (ed.w / 2 + 2)) / 16);
        const footY = Math.floor((e.y + 2) / 16);
        if (e.hitWall || !solidAt(aheadX, footY)) e.vx = -dir * c.speed;
        e.facing = Math.sign(e.vx) || e.facing;
        moveEntity(e, ed.w, ed.h, dt, {});
      } else if (e.type === "shooter") {
        e.facing = dx < 0 ? -1 : 1;
        e.cd -= dt;
        if (e.state === "idle" && e.cd <= 0 && adx < c.range && ady < 26 && !pl.dead) {
          e.state = "aim"; e.t = c.aimTime; e.aimDir = e.facing;
        } else if (e.state === "aim") {
          e.t -= dt;
          if (e.t <= 0) {
            e.state = "idle"; e.cd = c.cooldown;
            S.bullets.push({ x: e.x + e.aimDir * 8, y: e.y - 10, vx: e.aimDir * c.bulletSpeed, aimed: false, t: 4 });
            AU.shoot();
          }
        }
        moveEntity(e, ed.w, ed.h, dt, {});
      } else if (e.type === "netter") {
        e.facing = dx < 0 ? -1 : 1;
        e.cd -= dt;
        if (e.state === "idle" && e.cd <= 0 && adx < c.range && ady < 60 && !pl.dead) {
          e.state = "throw"; e.t = c.throwTime;
        } else if (e.state === "throw") {
          e.t -= dt;
          if (e.t <= 0) {
            e.state = "idle"; e.cd = c.cooldown;
            const tof = 0.9;
            S.nets.push({ x: e.x, y: e.y - 14, vx: Math.max(-c.netSpeed, Math.min(c.netSpeed, dx / tof)), vy: -c.netArc, t: 4, ground: 0 });
            AU.netThrow();
          }
        }
        moveEntity(e, ed.w, ed.h, dt, {});
      } else if (e.type === "boss") {
        updateBoss(e, dt, c, ed);
      }

      // ---- combat vs player ----
      if (pl.dead || e.dead) continue;
      const overlap = Math.abs(e.x - pl.x) < (ed.w + pd.w) / 2 && (pl.y - pd.h) < e.y && pl.y > (e.y - ed.h);
      if (!overlap) continue;
      const stomping = pl.vy > 40 && (pl.y - pd.h / 2) < e.y - ed.h * 0.5;

      if (e.type === "boss") {
        if (e.state === "dizzy") bossHit(e); // he's helpless — any contact counts for little hands
        else {
          if (stomping) {
            // bouncing off his helmet is safe — it teaches "wait until he's dizzy"
            pl.vy = -CFG.player.stompBounce;
            AU.ding(); P.ding(pl.x, e.y - enemyDims(e).h);
          } else if (pl.size === "big") { pl.vx = -Math.sign(e.x - pl.x) * 120; } // shove apart, no damage
          else hurt(e.x, c.touchDamage);
        }
      } else if (pl.pounceT > 0 || stomping || pl.size === "big") {
        killEnemy(e);
        if (stomping) { pl.vy = -CFG.player.stompBounce; pl.squash = 0; }
      } else {
        hurt(e.x, c.touchDamage);
      }
    }
  }

  function updateBoss(e, dt, c, ed) {
    const pl = S.pl;
    e.facing = pl.x < e.x ? -1 : 1;
    if (S.bossIntroT > 0) { S.bossIntroT -= dt; return; }
    if (e.state === "idle") { e.state = "patrol"; e.t = 2; }
    if (e.state === "patrol") {
      e.vx = e.facing * c.speed;
      e.t -= dt; e.fanT -= dt;
      if (e.fanT <= 0 && !pl.dead && Math.abs(pl.x - e.x) > 60) {
        const bx = e.x + e.facing * 20, by = e.y - 26;
        if (!solidAt(Math.floor(bx / 16), Math.floor(by / 16))) { // don't fire into a wall
          e.fanT = c.fanCooldown;
          for (const a of [-0.28, 0, 0.28])
            S.bullets.push({ x: bx, y: by, vx: e.facing * Math.cos(a) * c.bulletSpeed, vyv: Math.sin(a) * c.bulletSpeed, aimed: true, t: 4 });
          AU.shoot();
        }
      }
      if (e.t <= 0) { e.state = "windup"; e.t = c.chargeWindup; e.vx = 0; AU.bossRoar(); }
      moveEntity(e, ed.w, ed.h, dt, {});
    } else if (e.state === "windup") {
      e.t -= dt; e.vx = 0;
      if (e.t <= 0) { e.state = "charge"; e.chargeDir = e.facing; }
      moveEntity(e, ed.w, ed.h, dt, {});
    } else if (e.state === "charge") {
      e.vx = e.chargeDir * c.chargeSpeed;
      moveEntity(e, ed.w, ed.h, dt, {});
      if (Math.random() < dt * 45) P.dust(e.x - e.chargeDir * 16, e.y, -e.chargeDir, 2);
      if (e.hitWall) {
        e.state = "dizzy"; e.t = c.dizzyTime; e.vx = 0;
        S.shake = CFG.fx.shakeMax; AU.stomp(); P.dust(e.x, e.y, 0, 8);
      }
    } else if (e.state === "dizzy") {
      e.t -= dt; e.vx = 0;
      if (Math.random() < dt * 16) P.sparkle(e.x + Math.cos(S.t * 5) * 16, e.y - ed.h - 6 + Math.sin(S.t * 5) * 4, "#FFE066", 1);
      if (e.t <= 0) { e.state = "patrol"; e.t = 2.2; }
      moveEntity(e, ed.w, ed.h, dt, {});
    }
  }
  function bossHit(e) {
    e.hp -= 1; e.flashT = 0.25;
    S.pl.vy = -CFG.player.stompBounce;
    AU.bossHit();
    P.poof(e.x, e.y - 20, "#FF8A7A", 8);
    if (e.hp <= 0) { killEnemy(e); }
    else { e.state = "patrol"; e.t = 1.6; }
  }
  function killEnemy(e) {
    e.dead = true;
    const ed = enemyDims(e);
    AU.stomp();
    P.poof(e.x, e.y - ed.h / 2, e.type === "boss" ? "#FF8A7A" : "#FFE066", e.type === "boss" ? 18 : 10);
    // comic spin-away
    const sprName = e.type === "boss" ? "bossDizzy" : e.type + "1";
    S.flyoffs.push({ spr: sprName, x: e.x, y: e.y - ed.h / 2, vx: (Math.random() - 0.5) * 80, vy: -260, rot: 0, vr: 9 + Math.random() * 5, facing: e.facing });
    S.shake = Math.min(CFG.fx.shakeMax, S.shake + (e.type === "boss" ? 6 : 2));
    if (e.type === "boss") { P.confetti(e.x, e.y - 20, 30); }
  }

  // ---------------- projectiles ----------------
  function updateProjectiles(dt) {
    const pl = S.pl, pd = plDims();
    for (const b of S.bullets) {
      if (b.t <= 0) continue;
      b.t -= dt;
      b.x += b.vx * dt;
      if (b.vyv) b.y += b.vyv * dt;
      if (solidAt(Math.floor(b.x / 16), Math.floor(b.y / 16))) { b.t = 0; P.ding(b.x, b.y); continue; }
      if (pl.dead) continue;
      // small compy: unaimed bullets fly overhead by design
      if (!b.aimed && pl.size === "small") continue;
      const hit = Math.abs(b.x - pl.x) < pd.w / 2 + 3 && b.y > pl.y - pd.h - 2 && b.y < pl.y + 2;
      if (hit) {
        b.t = 0;
        if (pl.size === "big") { AU.ding(); P.ding(b.x, b.y); }
        else hurt(b.x, 1);
      }
    }
    S.bullets = S.bullets.filter(b => b.t > 0);

    for (const n of S.nets) {
      if (n.t <= 0) continue;
      n.t -= dt;
      if (n.ground > 0) { n.ground -= dt; if (n.ground <= 0) n.t = 0; }
      else {
        n.vy += 400 * dt;
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (solidAt(Math.floor(n.x / 16), Math.floor(n.y / 16))) { n.ground = 0.8; n.vy = 0; n.vx = 0; }
        if (!pl.dead && Math.abs(n.x - pl.x) < pd.w / 2 + 4 && Math.abs(n.y - (pl.y - pd.h / 2)) < pd.h / 2 + 4) {
          n.t = 0;
          if (pl.size === "big") { AU.ding(); P.ding(n.x, n.y); }
          else { pl.slowT = CFG.enemies.netter.slowTime; AU.netted(); P.sparkle(pl.x, pl.y - pd.h, "#9FB9CC", 4); }
        }
      }
    }
    S.nets = S.nets.filter(n => n.t > 0);

    for (const f of S.flyoffs) {
      f.vy += 700 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
    }
    S.flyoffs = S.flyoffs.filter(f => f.y < S.gh * 16 + 120);
  }

  // ---------------- win / lose ----------------
  function winLevel() {
    if (S.mode !== "play") return;
    S.mode = "win";
    document.body.classList.remove("playing");
    AU.stopMusic(); AU.win();
    P.confetti(S.pl.x, S.pl.y - 30, 30);
    const frac = S.eggsTotal ? S.eggsGot / S.eggsTotal : 1;
    const stars = frac >= CFG.stars.three ? 3 : frac >= CFG.stars.two ? 2 : 1;
    progress.stars[S.li] = Math.max(progress.stars[S.li] || 0, stars);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, S.li + 2));
    save.write(progress);
    const last = S.li === LEVELS.length - 1;
    document.getElementById("win-title").textContent = last ? "YOU WIN!" : "LEVEL CLEAR!";
    document.getElementById("win-stars").innerHTML =
      "★".repeat(stars) + `<span class="dim">${"★".repeat(3 - stars)}</span>`;
    document.getElementById("win-sub").innerHTML = last
      ? `The jungle is safe! 🦖<br><b>DINOSAUR FIGHT!</b> — designed by Henry, age 5.<br>Eggs: ${S.eggsGot}/${S.eggsTotal}`
      : `Eggs collected: ${S.eggsGot}/${S.eggsTotal}`;
    document.getElementById("btn-next").style.display = last ? "none" : "";
    show("ov-win");
  }

  // ---------------- backgrounds ----------------
  const THEMES = {
    jungle: { skyTop: "#0B1C12", skyBot: "#23492C", far: "#132C1B", mid: "#0C2012", canopy: "#215432", leaf: "#2F7040", bush: "#173A22", fore: "#05100A", shaft: "rgba(214,232,168,.16)", sun: null, tint: null },
    river:  { skyTop: "#0A1C1E", skyBot: "#1F4638", far: "#122C22", mid: "#0C2018", canopy: "#1C4A38", leaf: "#2A6650", bush: "#153828", fore: "#04100C", shaft: "rgba(190,228,214,.16)", sun: null, tint: "rgba(20,90,80,.14)" },
    camp:   { skyTop: "#2A1410", skyBot: "#8A4E2A", far: "#241410", mid: "#160C08", canopy: "#3A1E10", leaf: "#523018", bush: "#2A160C", fore: "#0E0604", shaft: null, sun: "#FFB05C", tint: "rgba(150,70,20,.24)" },
    arena:  { skyTop: "#1E0A0C", skyBot: "#6E2A1A", far: "#1A0C0A", mid: "#120806", canopy: "#32120C", leaf: "#4A2014", bush: "#240E08", fore: "#0C0403", shaft: null, sun: "#FF7A4A", tint: "rgba(150,45,25,.3)" },
  };
  let bgSky = null, bgFar = null, bgMid = null, bgNear = null, builtTheme = null;
  let TILES = {};
  function buildBackgrounds() {
    builtTheme = S.theme;
    const th = THEMES[S.theme] || THEMES.jungle;
    let s2 = 777;
    const r2 = () => (s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296;
    const dark = !th.sun;

    // SKY: pre-rendered, quantized into dithered bands (no smooth vector ramp)
    bgSky = document.createElement("canvas"); bgSky.width = 480; bgSky.height = 272;
    let c = bgSky.getContext("2d");
    const bands = 10;
    const lerpHex = (a, b, t) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const ch = s => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
      return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
    };
    for (let b = 0; b < bands; b++) {
      const y0 = Math.round((b / bands) * 272), y1 = Math.round(((b + 1) / bands) * 272);
      c.fillStyle = lerpHex(th.skyTop, th.skyBot, b / (bands - 1));
      c.fillRect(0, y0, 480, y1 - y0);
      if (b > 0) { // dither the seam with 2px checker from the band below
        for (let x = 0; x < 480; x += 4) c.fillRect(x + (b % 2) * 2, y0 - 2, 2, 2);
      }
    }
    if (th.sun) {
      c.fillStyle = th.sun;
      c.fillRect(316, 44, 26, 26); c.fillRect(312, 48, 34, 18); c.fillRect(320, 40, 18, 34);
    }

    // FAR: chunky quantized ridge + faint giant trunks + stepped light shafts
    bgFar = document.createElement("canvas"); bgFar.width = 480; bgFar.height = 272;
    c = bgFar.getContext("2d");
    c.fillStyle = th.far;
    for (let x = 0; x < 480; x += 8) {
      let h = dark ? 150 + Math.sin(x * 0.013) * 30 + Math.sin(x * 0.05 + 1) * 10
                   : 70 + Math.sin(x * 0.011) * 26 + Math.sin(x * 0.033 + 2) * 12;
      h = Math.round(h / 6) * 6; // stair-step to match pixel language
      c.fillRect(x, 272 - h, 8, h);
    }
    if (dark) {
      c.fillStyle = "rgba(0,0,0,.22)";
      for (let i = 0; i < 8; i++) {
        const x = i * 62 + r2() * 30;
        c.fillRect(x, 40 + r2() * 30, 7 + r2() * 5, 232);
      }
    }
    if (th.shaft) {
      // three alpha steps per shaft = dithered-edge light columns
      for (let i = 0; i < 4; i++) {
        const x = 40 + i * 120 + r2() * 40;
        for (const [off, wdt, al] of [[0, 22, 1], [-6, 34, 0.5], [8, 12, 0.7]]) {
          c.fillStyle = th.shaft.replace(/[\d.]+\)$/, m => (parseFloat(m) * al).toFixed(3) + ")");
          c.beginPath();
          c.moveTo(x + off, 0); c.lineTo(x + off + wdt, 0);
          c.lineTo(x + off - 30, 272); c.lineTo(x + off - 30 - wdt, 272);
          c.fill();
        }
      }
    }

    // MID layer
    bgMid = document.createElement("canvas"); bgMid.width = 480; bgMid.height = 272;
    c = bgMid.getContext("2d");
    if (S.theme === "camp" || S.theme === "arena") {
      // crooked dead trees — varied leans and branch angles, no crossbars
      for (let i = 0; i < 5; i++) {
        const x = 30 + i * 100 + r2() * 40, leanDir = r2() < 0.5 ? -1 : 1;
        c.fillStyle = th.mid;
        for (let seg = 0; seg < 6; seg++)
          c.fillRect(x + leanDir * seg * 2, 272 - (seg + 1) * 32, 7, 34);
        const nb = 2 + (r2() * 2 | 0);
        for (let b = 0; b < nb; b++) {
          const by = 80 + r2() * 90, len = 18 + r2() * 22, dir = r2() < 0.5 ? -1 : 1, rise = 6 + r2() * 14;
          const bx = x + leanDir * ((272 - by) / 32) * 2;
          for (let s = 0; s < len; s += 3)
            c.fillRect(bx + dir * s, by - (s / len) * rise, 3, 3);
        }
      }
      // tents: silhouette + lit door + campfire embers
      for (let i = 0; i < 6; i++) {
        const x = i * 82 + r2() * 26, w = 40 + r2() * 14, h = 30 + r2() * 10;
        c.fillStyle = th.canopy;
        c.beginPath();
        c.moveTo(x, 272); c.lineTo(x + w / 2, 272 - h); c.lineTo(x + w, 272);
        c.fill();
        c.fillStyle = th.sun ? "rgba(255,170,80,.5)" : "#333";
        c.beginPath();
        c.moveTo(x + w / 2 - 5, 272); c.lineTo(x + w / 2, 272 - h * 0.42); c.lineTo(x + w / 2 + 5, 272);
        c.fill();
        if (r2() < 0.5) { // ember glow next to the tent
          const ex = x + w + 10;
          c.fillStyle = "rgba(255,140,50,.22)"; c.fillRect(ex - 5, 258, 12, 12);
          c.fillStyle = "#FF9A3D"; c.fillRect(ex - 1, 264, 3, 3); c.fillRect(ex + 3, 266, 2, 2);
        }
      }
      c.fillStyle = th.mid; c.fillRect(0, 262, 480, 10);
    } else {
      // trunks reaching past the top of the frame, with bark notches
      for (let i = 0; i < 7; i++) {
        const x = i * 72 + r2() * 34, w = 12 + r2() * 10;
        c.fillStyle = th.mid;
        c.fillRect(x, 0, w, 272);
        c.fillStyle = "rgba(0,0,0,.3)";
        c.fillRect(x, 0, Math.max(2, w * 0.3), 272);
        c.fillStyle = "rgba(255,255,255,.05)";
        c.fillRect(x + w - 2, 0, 2, 272);
        c.fillStyle = "rgba(0,0,0,.25)"; // bark notches
        for (let n = 0; n < 7; n++) c.fillRect(x + 2 + r2() * (w - 6), 20 + r2() * 232, 3 + r2() * 4, 2);
        c.fillStyle = th.mid;
        c.fillRect(x - 10, 60 + r2() * 60, w + 20, 4);
      }
      // hanging canopy fringe — now LIGHTER than the sky so it actually reads
      c.fillStyle = th.canopy;
      c.fillRect(0, 0, 480, 24);
      for (let x = 0; x < 480; x += 8) {
        const drop = 24 + r2() * 26;
        c.fillStyle = th.canopy;
        c.fillRect(x, 0, 8, drop);
        c.fillStyle = th.leaf; // leaf highlights on the fringe
        c.fillRect(x + (r2() * 5 | 0), drop - 4, 3, 3);
        if (r2() < 0.35) { c.fillStyle = th.canopy; c.fillRect(x + 2, drop, 3, 12 + r2() * 18); } // vine
      }
      // dense bush line at the ground — own, lighter value
      c.fillStyle = th.bush;
      for (let x = 0; x < 480; x += 10) {
        const h = 14 + r2() * 22;
        c.beginPath(); c.arc(x + 5, 272 - h / 2, 9 + r2() * 4, 0, Math.PI * 2); c.fill();
      }
      c.fillRect(0, 258, 480, 14);
      c.fillStyle = th.leaf;
      for (let x = 4; x < 480; x += 18 + (r2() * 14 | 0)) c.fillRect(x, 246 - r2() * 14, 2, 2);
    }

    // NEAR: taller foreground silhouette blades, in front of the action
    bgNear = document.createElement("canvas"); bgNear.width = 480; bgNear.height = 56;
    c = bgNear.getContext("2d");
    c.fillStyle = th.fore;
    for (let x = 0; x < 480; x += 22 + ((r2() * 26) | 0)) {
      const h = 16 + r2() * 34, w = 3;
      for (let b = -2; b <= 2; b++) {
        c.save();
        c.translate(x, 56);
        c.rotate(b * 0.2);
        c.fillRect(-w / 2, -h + Math.abs(b) * 6, w, h - Math.abs(b) * 6);
        c.restore();
      }
    }

    // theme-tinted terrain tiles so lighting touches the ground
    TILES = {};
    for (const k of ["grass", "dirt", "platform", "water1", "water2", "stone", "crate", "tuft1", "tuft2"]) {
      const src = SPR[k];
      if (!th.tint) { TILES[k] = src; continue; }
      const t = document.createElement("canvas"); t.width = src.width; t.height = src.height;
      const tc = t.getContext("2d");
      tc.drawImage(src, 0, 0);
      tc.globalCompositeOperation = "source-atop";
      tc.fillStyle = th.tint;
      tc.fillRect(0, 0, t.width, t.height);
      TILES[k] = t;
    }
  }

  // ---------------- draw ----------------
  function draw() {
    const th = THEMES[S.theme] || THEMES.jungle;
    const w = 480, h = 272;
    // sky
    if (bgSky) ctx.drawImage(bgSky, 0, 0);
    else { ctx.fillStyle = th.skyTop; ctx.fillRect(0, 0, w, h); }
    // parallax
    const shx = S.shake > 0 ? (Math.random() - 0.5) * S.shake : 0;
    const shy = S.shake > 0 ? (Math.random() - 0.5) * S.shake * 0.6 : 0;
    drawWrapped(bgFar, S.camX * 0.18);
    drawWrapped(bgMid, S.camX * 0.45);

    ctx.save();
    ctx.translate(Math.round(-S.camX + shx), Math.round(shy));

    // tiles
    const x0 = Math.floor(S.camX / 16) - 1, x1 = x0 + 32;
    const waterFrame = Math.floor(S.t * 2) % 2 === 0 ? "water1" : "water2";
    for (let ty = 0; ty < S.gh; ty++) for (let tx = Math.max(0, x0); tx <= Math.min(S.gw - 1, x1); tx++) {
      const ch = S.grid[ty][tx];
      if (ch === ".") continue;
      let spr = null;
      if (ch === "#") spr = solidAt(tx, ty - 1) ? "dirt" : "grass";
      else if (ch === "-") spr = "platform";
      else if (ch === "B") spr = "crate";
      else if (ch === "M") spr = "stone";
      else if (ch === "~") { if (cellAt(tx, ty - 1) !== "~") spr = waterFrame; else spr = "water2"; }
      if (spr) {
        ctx.drawImage(TILES[spr] || SPR[spr], tx * 16, ty * 16);
        if (spr === "grass") {
          const hsh = (tx * 2654435761 >>> 0) % 5;
          if (hsh < 2) ctx.drawImage(TILES[hsh === 0 ? "tuft1" : "tuft2"] || SPR.tuft1, tx * 16, ty * 16 - 7);
        }
      }
    }

    // decor (behind entities)
    for (const d of S.decor) {
      const s = SPR[d.spr];
      ctx.drawImage(s, Math.round(d.x - s.width / 2), Math.round(d.y - s.height));
    }

    // checkpoints + flag
    for (const cp of S.checkpoints) {
      const s = SPR[cp.on ? "checkOn" : "checkOff"];
      ctx.drawImage(s, Math.round(cp.x - 4), Math.round(cp.y - 24));
    }
    if (S.flag) {
      const s = SPR[S.flag.open ? "flagOpen" : "flagClosed"];
      ctx.drawImage(s, Math.round(S.flag.x - 4), Math.round(S.flag.y - 30));
      if (!S.flag.open) {
        const remaining = S.enemies.filter(e => !e.dead).length;
        pixText(`${remaining} LEFT`, S.flag.x - 2, S.flag.y - 36, "#FFFFFF", 7, "center");
      } else if (Math.random() < 0.1) P.sparkle(S.flag.x + 4, S.flag.y - 24, "#8FE08A", 1);
    }

    // items
    for (const it of S.items) {
      if (it.got) continue;
      const bob = Math.sin(S.t * 4 + it.x * 0.13) * 2;
      const s = SPR[it.kind];
      pixShadow(it.x, it.y + 2, 7);
      ctx.drawImage(s, Math.round(it.x - s.width / 2), Math.round(it.y - s.height + bob));
    }

    // teaching hints — bounce a key prompt when the player is close and the wrong size
    if (S.hints && S.pl) {
      const touch = document.body.classList.contains("touch");
      for (const hh of S.hints) {
        if (Math.abs(hh.x - S.pl.x) > 120) continue;
        if (hh.kind === "grow" && S.pl.size === "big") continue;
        if (hh.kind === "shrink" && S.pl.size === "small") continue;
        const bnc = Math.sin(S.t * 5) * 3;
        const txt = hh.kind === "grow"
          ? (touch ? "🦖 GROW!" : "↑ = GROW!")
          : (touch ? "🐜 SHRINK!" : "↓ = SHRINK!");
        pixText(txt, hh.x, hh.y + bnc, hh.kind === "grow" ? "#C9A6FF" : "#7BE5F2", 10, "center");
      }
      ctx.textAlign = "left";
    }

    // enemies
    for (const e of S.enemies) {
      if (e.dead) continue;
      drawEnemy(e);
    }
    // flyoffs (comic defeated baddies)
    for (const f of S.flyoffs) {
      const s = SPR[f.spr][f.facing > 0 ? "R" : "L"];
      ctx.save();
      ctx.translate(Math.round(f.x), Math.round(f.y));
      ctx.rotate(f.rot);
      ctx.drawImage(s, -s.width / 2, -s.height / 2);
      ctx.restore();
    }

    // nets & bullets
    for (const n of S.nets) ctx.drawImage(SPR.net, Math.round(n.x - 4), Math.round(n.y - 4));
    for (const b of S.bullets) ctx.drawImage(SPR.bullet, Math.round(b.x - 2), Math.round(b.y - 1));

    // shooter telegraphs
    for (const e of S.enemies) {
      if (!e.dead && e.type === "shooter" && e.state === "aim") {
        const blink = Math.floor(S.t * 10) % 2 === 0;
        ctx.strokeStyle = blink ? "rgba(255,90,90,.85)" : "rgba(255,200,200,.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        let ex = e.x + e.aimDir * 8;
        const gy = e.y - 10 + 0.5;
        let len = 0;
        while (len < CFG.enemies.shooter.range && !solidAt(Math.floor((ex + e.aimDir * len) / 16), Math.floor(gy / 16))) len += 8;
        ctx.moveTo(ex, gy); ctx.lineTo(ex + e.aimDir * len, gy);
        ctx.stroke();
      }
    }

    // player
    drawPlayer();

    // particles
    P.draw(ctx, 0);

    ctx.restore();

    // foreground foliage strip (parallax slightly faster than the action)
    if (bgNear) {
      const o = ((S.camX * 1.15) % 480 + 480) % 480;
      ctx.drawImage(bgNear, -o, 272 - 56);
      ctx.drawImage(bgNear, 480 - o, 272 - 56);
    }

    drawHUD();
  }

  function drawWrapped(layer, off) {
    const o = ((off % 480) + 480) % 480;
    ctx.drawImage(layer, -o, 0);
    ctx.drawImage(layer, 480 - o, 0);
  }

  function drawEnemy(e) {
    const ed = enemyDims(e);
    let name;
    if (e.type === "boss") {
      name = e.state === "dizzy" ? "bossDizzy" : e.state === "charge" ? "bossCharge" : Math.floor(e.animT * 6) % 2 ? "boss1" : "boss2";
    } else if (e.type === "walker") {
      name = Math.floor(e.animT * 7) % 2 ? "walker1" : "walker2";
    } else if (e.type === "shooter") {
      name = e.state === "aim" ? "shooter2" : "shooter1";
    } else {
      name = e.state === "throw" ? "netter2" : "netter1";
    }
    const s = SPR[name][e.facing > 0 ? "R" : "L"];
    const wob = e.type === "boss" && e.state === "dizzy" ? Math.sin(S.t * 10) * 2 : 0;
    pixShadow(e.x, e.y, enemyDims(e).w + 4);
    if (e.flashT > 0 && Math.floor(S.t * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.drawImage(s, Math.round(e.x - s.width / 2 + wob), Math.round(e.y - s.height));
    ctx.globalAlpha = 1;
    // windup exclamation
    if (e.type === "boss" && e.state === "windup") pixText("!", e.x, e.y - ed.h - 12, "#FFE066", 10, "center");
    if ((e.type === "shooter" && e.state === "aim") || (e.type === "netter" && e.state === "throw"))
      pixText("!", e.x, e.y - ed.h - 8, "#FF8A7A", 8, "center");
  }

  function drawPlayer() {
    const pl = S.pl, d = plDims();
    if (pl.invuln > 0 && !pl.dead && Math.floor(S.t * 14) % 2 === 0) return; // blink
    let name = "idle";
    if (pl.dead) name = "fall";
    else if (pl.pounceT > 0) name = "pounce";
    else if (!pl.onGround) name = pl.vy < 0 ? "jump" : "fall";
    else if (Math.abs(pl.vx) > 10) name = Math.floor(pl.animT * 9) % 2 ? "run1" : "run2";
    const s = SPR["compy_" + name][pl.facing > 0 ? "R" : "L"];
    const k = d.k;
    let sw = 18 * k, shh = 18 * k;
    if (pl.squash > 0) { const q = pl.squash * 0.25; sw *= 1 + q; shh *= 1 - q; }
    if (!pl.dead) pixShadow(pl.x, pl.y, d.w + 4);
    ctx.save();
    if (pl.dead) {
      ctx.translate(Math.round(pl.x), Math.round(pl.y - shh / 2));
      ctx.rotate(S.t * 4);
      ctx.drawImage(s, -sw / 2, -shh / 2, sw, shh);
    } else {
      ctx.drawImage(s, Math.round(pl.x - sw / 2), Math.round(pl.y - shh), sw, shh);
    }
    ctx.restore();
    // net-slow indicator
    if (pl.slowT > 0) ctx.drawImage(SPR.net, Math.round(pl.x - 4), Math.round(pl.y - d.h - 12));
  }

  function pixText(txt, x, y, col, size, align) {
    ctx.font = `800 ${size}px "Baloo 2", sans-serif`;
    ctx.textAlign = align || "left";
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillText(txt, Math.round(x) + 1, Math.round(y) + 1);
    ctx.fillStyle = col;
    ctx.fillText(txt, Math.round(x), Math.round(y));
  }

  function drawHUD() {
    if (S.mode !== "play" && S.mode !== "pause" && S.mode !== "win" && S.mode !== "lose") return;
    const pl = S.pl;
    if (!pl) return;
    // hearts
    for (let i = 0; i < CFG.player.hearts; i++) {
      ctx.globalAlpha = i < pl.hearts ? 1 : 0.22;
      ctx.drawImage(SPR.heart, 6 + i * 12, 6, 9, 8);
    }
    ctx.globalAlpha = 1;
    // power bar
    const pw = pl.power / CFG.player.power.max;
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(6, 17, 62, 8);
    ctx.fillStyle = pl.size === "big" ? "#C9A6FF" : pl.size === "small" ? "#7BE5F2" : "#57BE59";
    ctx.fillRect(7, 18, Math.round(60 * pw), 6);
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1;
    ctx.strokeRect(6.5, 17.5, 61, 7);
    pixText("POWER", 72, 25, "#DCE6F2", 8);
    if (pl.size !== "normal") pixText(pl.size === "big" ? "HUGE!" : "tiny!", 112, 25, pl.size === "big" ? "#C9A6FF" : "#7BE5F2", 9);
    if (!document.body.classList.contains("touch"))
      pixText("WASD = MOVE · SPACE = JUMP · ↑ GROW · ↓ SHRINK · ← → POUNCE", 6, 35, "rgba(220,230,242,.6)", 7);
    // eggs + baddies right side (clear of the DOM pause button)
    ctx.drawImage(SPR.egg, 388, 6, 7, 9);
    pixText(`${S.eggsGot}/${S.eggsTotal}`, 398, 14, "#FFFFFF", 9);
    const remaining = S.enemies.filter(e => !e.dead).length;
    pixText(`BADDIES ${remaining}`, 388, 26, remaining === 0 ? "#8FE08A" : "#FF8A7A", 9);
    // boss bar — bordered, segmented per hit
    if (S.boss && !S.boss.dead && S.bossIntroT <= 0) {
      const hpMax = CFG.enemies.boss.hp, bw = 120, bx = 240 - bw / 2;
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx - 2, 7, bw + 4, 11);
      ctx.fillStyle = "#E8484F";
      ctx.fillRect(bx, 9, Math.round(bw * S.boss.hp / hpMax), 7);
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1;
      ctx.strokeRect(bx - 1.5, 7.5, bw + 3, 10);
      ctx.fillStyle = "rgba(0,0,0,.5)";
      for (let i = 1; i < hpMax; i++) ctx.fillRect(bx + Math.round(bw * i / hpMax), 9, 1, 7);
      pixText("BIG BOSS BADDIE", 240, 27, "#FF8A7A", 8, "center");
    }
    // level name toast
    if (S.nameT > 0) {
      ctx.globalAlpha = Math.min(1, S.nameT);
      pixText(LEVELS[S.li].name.toUpperCase(), 240, 52, "#FFFFFF", 14, "center");
      ctx.globalAlpha = 1;
    }
    if (S.bossIntroT > 0) {
      pixText("BIG BOSS BADDIE!", 240, 116, "#FF8A7A", 22, "center");
      pixText("Double-jump over his charges...", 240, 134, "#FFFFFF", 10, "center");
      pixText("then stomp him when he's dizzy!", 240, 147, "#FFE066", 10, "center");
    }
    ctx.textAlign = "left";
  }

  // ---------------- title scene ----------------
  let titleT = 0;
  function drawTitle(dt) {
    titleT += dt;
    S.theme = "jungle";
    if (!bgFar || builtTheme !== "jungle") buildBackgrounds();
    if (bgSky) ctx.drawImage(bgSky, 0, 0);
    drawWrapped(bgFar, titleT * 6);
    drawWrapped(bgMid, titleT * 16);
    // ground strip
    for (let tx = 0; tx < 31; tx++) {
      ctx.drawImage(SPR.grass, tx * 16 - (titleT * 40) % 16, 240);
      ctx.drawImage(SPR.dirt, tx * 16 - (titleT * 40) % 16, 256);
    }
    // running compy
    const name = Math.floor(titleT * 9) % 2 ? "run1" : "run2";
    const hop = Math.abs(Math.sin(titleT * 2.2)) < 0.08 ? -14 : 0;
    ctx.drawImage(SPR["compy_" + name].R, 96, 222 + hop, 36, 36);
    // a fleeing baddie for comedy
    const bn = Math.floor(titleT * 8) % 2 ? "walker1" : "walker2";
    ctx.drawImage(SPR[bn].R, 200 + Math.sin(titleT * 0.9) * 30, 206, 24, 36);
    if (bgNear) {
      const o = ((titleT * 46) % 480 + 480) % 480;
      ctx.drawImage(bgNear, -o, 216);
      ctx.drawImage(bgNear, 480 - o, 216);
    }
  }

  // ---------------- main loop ----------------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    step(now);
  }
  // debug builds keep simulating in background tabs (rAF starves there) so
  // automated critics can run in parallel; players always get the rAF path
  setTimeout(() => {
    if (S.debug) setInterval(() => { if (performance.now() - last > 90) step(performance.now()); }, 33);
  }, 0);
  function step(now) {
    let dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;

    if (S.mode === "title" || S.mode === "levels") { drawTitle(dt); return; }
    if (S.mode === "pause") { draw(); return; }
    if (!S.pl) return;
    if (S.mode === "win" || S.mode === "lose") {
      S.t += dt; S.shake = Math.max(0, S.shake - dt * 14);
      P.update(dt); updateProjectiles(dt);
      draw(); return;
    }

    S.t += dt;
    S.nameT = Math.max(0, S.nameT - dt);
    S.shake = Math.max(0, S.shake - dt * 14);

    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    P.update(dt);

    // camera
    const target = Math.max(0, Math.min(S.pl.x - 480 * 0.45 + S.pl.facing * 24, S.gw * 16 - 480));
    S.camX += (target - S.camX) * Math.min(1, dt * 5);

    if (S.loseT > 0) {
      S.loseT -= dt;
      if (S.loseT <= 0) { S.mode = "lose"; document.body.classList.remove("playing"); show("ov-lose"); }
    }

    draw();
  }
})();
