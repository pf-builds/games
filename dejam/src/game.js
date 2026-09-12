// DeJam — core game: screens, input, render, progress. Vanilla JS + canvas, no deps.
// v2 "Big Lot": side-street exits remove cars for good, four lot sizes, a moves budget
// instead of par-to-beat, and Endless is a streak of ever-bigger lots.
(function () {
  const G = window.DeJam;
  const $ = (sel) => document.querySelector(sel);
  const LS = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* page must work without storage */ } }
  };
  const VKEY = "dejam.v1";
  const V = "?v=5"; // cache-bust for JSON fetches — keep in sync with index.html
  const DEBUG = /(\?|&)debug=1/.test(location.search);

  let cfg = null;
  let levels = [];
  let levelsVersion = "dev";
  let endlessPool = null;
  let progress = {};
  let cur = null;
  let canvas, ctx, dpr = 1, cssSize = 0;
  let drag = null;      // {i, startPx, startCoord, min, max, pos, bumped, t0}
  let settle = null;    // {i, from, to, t0}  — eased snap on release
  let winFx = null;     // taxi drive-out animation
  let puffs = [];       // shared particle list (win confetti, side-street poofs)
  let puffPrev = 0;
  let lastTierTab = LS.get(VKEY + ".tab", "easy");

  // ---------- boot ----------
  async function boot() {
    canvas = $("#board");
    ctx = canvas.getContext("2d");
    G.audio.setMuted(LS.get(VKEY + ".muted", false));
    syncSoundButtons();

    try {
      const res = await fetch("config.json" + V);
      cfg = await res.json();
    } catch (e) {
      $("#loadmsg").textContent = "Could not load config.json — serve over HTTP, not file://";
      return;
    }
    if (!cfg.tiers[lastTierTab]) lastTierTab = Object.keys(cfg.tiers)[0];

    // Shipped levels are pre-baked at build time; the generator only runs for Endless.
    try {
      const res = await fetch("levels.json" + V);
      if (!res.ok) throw new Error("no levels.json");
      const data = await res.json();
      levels = data.levels;
      endlessPool = data.endlessPool || null;
      levelsVersion = String(data.version || data.seed || "1");
    } catch (e) {
      // Dev fallback: generate live (slow) so the game still runs before a bake.
      show("loading");
      levels = await G.gen.generateSet(cfg, (done, total) => {
        $("#loadmsg").textContent = "Laying out traffic… " + done + "/" + total;
        $("#loadbar-fill").style.width = Math.round((done / total) * 100) + "%";
      });
      levelsVersion = "dev-" + cfg.generator.seed;
    }
    // Progress is namespaced by the level-set version: reseeding levels must never
    // let old bests masquerade as records on different boards.
    progress = LS.get(VKEY + ".progress." + levelsVersion, {});
    buildLevelSelect();
    renderTitleMeta();
    show("title");
    requestAnimationFrame(frame);
    if (DEBUG) {
      window.DJ = {
        get cur() { return cur; }, cfg: () => cfg, levels: () => levels, progress: () => progress,
        start: (tier, n) => { const list = levels.filter((l) => l.tier === tier); startLevel(list[n], n); },
        endless: startEndless, pool: () => endlessPool, transform: (l, k) => G.gen.transformLevel(l, k),
        move: (i, to) => finishMove(i, coordOf(cur.vehicles[i]), to),
        bounds: dragBounds, tick, get settle() { return settle; }, get drag() { return drag; },
        solve: () => G.gen.solve(cur.vehicles, cur.exits, cur.N, 400000),
      };
    }
  }

  // ---------- screens ----------
  function show(name) {
    ["loading", "title", "levels", "game"].forEach((n) => {
      $("#screen-" + n).classList.toggle("active", n === name);
    });
    $("#win-overlay").classList.remove("active");
    $("#lose-overlay").classList.remove("active");
    document.body.classList.remove("over");
    if (name === "game") resizeCanvas();
    if (name === "title") renderTitleMeta();
  }

  function renderTitleMeta() {
    const best = LS.get(VKEY + ".streak", 0);
    $("#title-meta").textContent = best > 0 ? "Best Endless streak: " + best + " lot" + (best === 1 ? "" : "s") : "";
  }

  function buildLevelSelect() {
    const tabs = $("#tier-tabs");
    tabs.innerHTML = "";
    Object.keys(cfg.tiers).forEach((t) => {
      const b = document.createElement("button");
      b.className = "tab";
      b.textContent = cfg.tiers[t].label;
      b.dataset.tier = t;
      b.style.setProperty("--tier", cfg.tiers[t].accent);
      b.addEventListener("click", () => { lastTierTab = t; LS.set(VKEY + ".tab", t); renderLevelGrid(); G.audio.tap(); });
      tabs.appendChild(b);
    });
    renderLevelGrid();
  }

  function levelId(lvl, n) { return lvl.tier + ":" + n; }

  function starsFor(moves, par) { return moves <= par ? 3 : moves <= par + (cfg.stars ? cfg.stars.twoWithin : 2) ? 2 : 1; }
  function slackFor(tierName) { const t = cfg.tiers[tierName]; return t && typeof t.slack === "number" ? t.slack : 6; }

  function renderLevelGrid() {
    document.querySelectorAll("#tier-tabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tier === lastTierTab));
    const tier = cfg.tiers[lastTierTab];
    const list = levels.filter((l) => l.tier === lastTierTab);
    const cars = list.map((l) => l.vehicles.length);
    const N = tier.board || cfg.board;
    $("#tier-info").textContent = N + "×" + N + " · " + Math.min(...cars) + "–" + Math.max(...cars) + " cars · +" + slackFor(lastTierTab) + " slack · " + list.length + " lots";
    $("#tier-info").style.color = tier.accent;
    const grid = $("#level-grid");
    grid.innerHTML = "";
    list.forEach((lvl, n) => {
      const b = document.createElement("button");
      const p = progress[levelId(lvl, n)];
      const s = p ? starsFor(p.best, lvl.par) : 0;
      b.className = "lvl" + (s ? " s" + s : "");
      b.style.setProperty("--tier", tier.accent);
      b.innerHTML = "<span class='num'>" + (n + 1) + "</span><span class='mark'>" +
        (s ? "★".repeat(s) : "") + "</span>";
      b.addEventListener("click", () => startLevel(lvl, n));
      grid.appendChild(b);
    });
  }

  // ---------- play state ----------
  function startLevel(lvl, n, streak) {
    const exits = lvl.exits || [{ side: lvl.exit.side, index: lvl.exit.index, goal: true }];
    const sizeTier = lvl.tier === "endless" ? (lvl.sizeTier || "medium") : lvl.tier;
    cur = {
      N: lvl.board || cfg.board,
      exits, goal: G.gen.goalExit(exits),
      par: lvl.par, tier: lvl.tier, num: n, sizeTier,
      budget: lvl.par + slackFor(sizeTier),
      streak: streak || 0,
      initial: lvl.vehicles.map((v) => ({ ...v, out: false })),
      vehicles: lvl.vehicles.map((v) => ({ ...v, out: false })),
      moves: 0, undo: [], won: false, lost: false
    };
    winFx = null; drag = null; settle = null; puffs = [];
    document.body.classList.remove("over");
    $("#win-overlay").classList.remove("active");
    $("#lose-overlay").classList.remove("active");
    updateHud();
    show("game");
    G.audio.tap();
  }

  async function startEndless(streak) {
    streak = streak || 0;
    const btn = $("#btn-endless");
    btn.disabled = true; btn.textContent = "Building…";
    if (cur) $("#hud-level").textContent = "Building the next lot…";
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const lvl = await G.gen.generateEndless(cfg, seed, streak, endlessPool);
    btn.disabled = false; btn.textContent = "Endless";
    if (lvl) startLevel(lvl, seed % 1000, streak);
  }

  function coordOf(v) { return v.horiz ? v.x : v.y; }
  function setCoord(v, c) { if (v.horiz) v.x = c; else v.y = c; }
  function movesLeft() { return Math.max(0, cur.budget - cur.moves); }

  function updateHud() {
    if (!cur) return;
    const name = cur.tier === "endless"
      ? "Lot " + (cur.streak + 1) + " · " + cur.N + "×" + cur.N
      : cfg.tiers[cur.tier].label + " " + (cur.num + 1);
    $("#hud-level").textContent = name;
    const left = movesLeft();
    const cls = left <= 2 ? "low" : left <= 4 ? "warn" : "";
    $("#hud-moves").innerHTML = "<span class='lbl'>Moves left</span><b class='" + cls + "'>" + left + "</b><span class='par'>par " + cur.par + "</span>";
    $("#btn-undo").disabled = cur.undo.length === 0 || cur.won || cur.lost;
  }

  // Local arcade records: top-5 fewest-moves per level, with a saved gamer name.
  // (A cross-device global board needs a backend — parked in LATER.md.)
  function recordsKey() { return VKEY + ".records." + levelsVersion; }
  function gamerName() { return (LS.get(VKEY + ".name", "") || "YOU").slice(0, 10); }

  function insertRecord(id, moves) {
    const all = LS.get(recordsKey(), {});
    const list = all[id] || [];
    const entry = { n: gamerName(), m: moves, t: Date.now() };
    list.push(entry);
    list.sort((a, b) => a.m - b.m || a.t - b.t);
    all[id] = list.slice(0, 5);
    LS.set(recordsKey(), all);
    return { list: all[id], mine: all[id].indexOf(entry) };
  }

  function renderRecords(id, res) {
    const box = $("#win-records");
    if (cur.tier === "endless") { box.style.display = "none"; return; }
    box.style.display = "";
    const input = $("#gamer-name");
    input.value = gamerName();
    const list = $("#record-list");
    list.innerHTML = "";
    res.list.forEach((r, k) => {
      const li = document.createElement("li");
      if (k === res.mine) li.className = "you";
      li.innerHTML = "<span class='rn'>" + (k + 1) + ". " + escapeHtml(r.n) + "</span><span>" + r.m + " moves</span>";
      list.appendChild(li);
    });
    input.oninput = () => {
      const name = input.value.trim().toUpperCase().slice(0, 10) || "YOU";
      LS.set(VKEY + ".name", name);
      if (res.mine >= 0) { // rename this run's entry in place
        const all = LS.get(recordsKey(), {});
        if (all[id] && all[id][res.mine]) { all[id][res.mine].n = name; LS.set(recordsKey(), all); }
        const row = list.children[res.mine];
        if (row) row.querySelector(".rn").textContent = (res.mine + 1) + ". " + name;
      }
    };
  }

  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function commitWin() {
    cur.won = true;
    G.audio.win();
    const id = levelId({ tier: cur.tier }, cur.num);
    let rec = null;
    if (cur.tier !== "endless") {
      const p = progress[id];
      if (!p || cur.moves < p.best) progress[id] = { best: cur.moves };
      LS.set(VKEY + ".progress." + levelsVersion, progress);
      rec = insertRecord(id, cur.moves);
    } else {
      cur.streak++;
      const best = LS.get(VKEY + ".streak", 0);
      if (cur.streak > best) LS.set(VKEY + ".streak", cur.streak);
    }
    const stars = starsFor(cur.moves, cur.par);
    setTimeout(() => {
      if (!cur || !cur.won) return;
      const endless = cur.tier === "endless";
      $("#win-title").textContent = endless ? "Lot cleared!" : stars === 3 ? "Perfect!" : "Solved!";
      $("#win-stats").textContent = endless
        ? cur.moves + " moves · par " + cur.par + " · streak " + cur.streak + (cur.streak >= LS.get(VKEY + ".streak", 0) ? " ★ best" : "")
        : cur.moves + " moves · par " + cur.par;
      const row = $("#win-stars");
      row.innerHTML = "";
      for (let k = 0; k < 3; k++) {
        const s = document.createElement("span");
        s.className = "star" + (k < stars ? " lit" : "");
        s.style.animationDelay = (0.15 + k * 0.18) + "s";
        s.textContent = "★";
        row.appendChild(s);
      }
      if (rec) renderRecords(id, rec); else $("#win-records").style.display = "none";
      $("#btn-next").textContent = endless ? "Next lot ▸" : "Next level";
      $("#btn-replay").style.display = endless ? "none" : "";
      $("#btn-win-menu").textContent = endless ? "Quit run" : "Level select";
      document.body.classList.add("over");
      $("#win-overlay").classList.add("active");
    }, 1050);
  }

  function commitLose() {
    cur.lost = true;
    updateHud();
    G.audio.lose();
    setTimeout(() => {
      if (!cur || !cur.lost) return;
      const endless = cur.tier === "endless";
      $("#lose-title").textContent = endless ? "Streak over!" : "Out of moves!";
      const best = LS.get(VKEY + ".streak", 0);
      $("#lose-sub").textContent = endless
        ? "Cleared " + cur.streak + " lot" + (cur.streak === 1 ? "" : "s") + (cur.streak > 0 && cur.streak >= best ? " · ★ best streak" : " · best " + best)
        : "The taxi's still stuck. Same lot, fresh budget.";
      document.body.classList.add("over");
      $("#btn-retry").textContent = endless ? "New run" : "Try again";
      $("#btn-lose-menu").textContent = endless ? "Title" : "Level select";
      $("#lose-overlay").classList.add("active");
    }, 450);
  }

  function nextLevel() {
    if (cur.tier === "endless") { $("#win-overlay").classList.remove("active"); startEndless(cur.streak); return; }
    const list = levels.filter((l) => l.tier === cur.tier);
    if (cur.num + 1 < list.length) startLevel(list[cur.num + 1], cur.num + 1);
    else { show("levels"); renderLevelGrid(); }
  }

  // ---------- input ----------
  function boardMetrics() {
    const S = cssSize, N = cur ? cur.N : cfg.board;
    const m = S * 0.075;
    const cell = (S - 2 * m) / N;
    return { S, N, m, cell };
  }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function vehicleAt(px) {
    const { m, cell } = boardMetrics();
    const gx = (px.x - m) / cell, gy = (px.y - m) / cell;
    for (let i = 0; i < cur.vehicles.length; i++) {
      const v = cur.vehicles[i];
      if (v.out) continue;
      const c = drag && drag.i === i ? drag.pos : coordOf(v);
      const x0 = v.horiz ? c : v.x, y0 = v.horiz ? v.y : c;
      const x1 = x0 + (v.horiz ? v.len : 1), y1 = y0 + (v.horiz ? 1 : v.len);
      if (gx >= x0 && gx < x1 && gy >= y0 && gy < y1) return i;
    }
    return -1;
  }

  // Slide range, extended past the edge when the lane ends in an exit this car may use:
  // the taxi through its glowing exit, blockers through a grey side street.
  function dragBounds(i) {
    const v = cur.vehicles[i], N = cur.N;
    const grid = G.gen.occupancy(cur.vehicles, N);
    let [mn, mx] = G.gen.slideRange(cur.vehicles, i, N, grid);
    if (mx === N - v.len && G.gen.mayUse(v, G.gen.exitFor(cur.exits, v, true))) mx = N;
    if (mn === 0 && G.gen.mayUse(v, G.gen.exitFor(cur.exits, v, false))) mn = -v.len;
    return [mn, mx];
  }

  function onDown(e) {
    G.audio.unlock();
    if (!cur || cur.won || cur.lost || settle) return;
    if (drag) { setCoord(cur.vehicles[drag.i], drag.startCoord); drag = null; } // a stale drag never sticks to the cursor
    const p = pointerPos(e);
    const i = vehicleAt(p);
    if (i < 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer may already be gone */ }
    const [mn, mx] = dragBounds(i);
    drag = { i, startPx: p, startCoord: coordOf(cur.vehicles[i]), min: mn, max: mx, pos: coordOf(cur.vehicles[i]), bumped: false, t0: performance.now() };
  }

  function onMove(e) {
    if (!drag || !cur || cur.won || cur.lost) return;
    const p = pointerPos(e);
    const { cell } = boardMetrics();
    const v = cur.vehicles[drag.i];
    const dpx = v.horiz ? p.x - drag.startPx.x : p.y - drag.startPx.y;
    const raw = drag.startCoord + dpx / cell;
    const clamped = Math.min(drag.max, Math.max(drag.min, raw));
    if (!drag.bumped && Math.abs(raw - clamped) > 0.35) { G.audio.thunk(); drag.bumped = true; }
    if (Math.abs(raw - clamped) < 0.2) drag.bumped = false;
    drag.pos = clamped;
    // once the car is clearly past the edge, the exit pulls it out: the drag ends by itself
    const N = cur.N;
    const pastHigh = drag.max > N - v.len && clamped > N - v.len + 0.5;
    const pastLow = drag.min < 0 && clamped < -0.5;
    if (pastHigh || pastLow) {
      const d = drag; drag = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
      settle = { i: d.i, from: d.pos, to: pastHigh ? d.max : d.min, t0: performance.now(), startCoord: d.startCoord };
    }
  }

  function finishMove(i, from, to) {
    const v = cur.vehicles[i], N = cur.N;
    if (v.isGoal) {
      const W = G.gen.winCoord(cur.goal, v.len, N);
      const outward = G.gen.outward(cur.goal);
      const winNow = outward ? to >= W : to <= W;
      if (winNow) {
        if (to !== from) cur.moves++;
        setCoord(v, W);
        cur.undo.push({ i, from });
        startWinFx(v, outward);
        updateHud();
        commitWin();
        return;
      }
    } else if (to > N - v.len || to < 0) {
      // slid out through a side street: gone for good
      const high = to > N - v.len;
      setCoord(v, high ? N - v.len : 0);
      v.out = true;
      cur.undo.push({ i, from, out: true });
      cur.moves++;
      const e = G.gen.exitFor(cur.exits, v, high);
      const dir = e.side === "right" ? [1, 0] : e.side === "left" ? [-1, 0] : e.side === "bottom" ? [0, 1] : [0, -1];
      const { m, cell } = boardMetrics();
      // spawn along the car's last cells inside the lot (anything past the 7.5% margin is clipped)
      const c0x = m + (v.horiz ? v.x + 0.5 : v.x + 0.5) * cell, c0y = m + (v.horiz ? v.y + 0.5 : v.y + 0.5) * cell;
      for (let k = 0; k < v.len; k++) {
        const px = c0x + (v.horiz ? k * cell : 0), py = c0y + (v.horiz ? 0 : k * cell);
        burst(px, py, 16, 110, v.colorIdx, dir);
        burst(px, py, 6, 70, null, dir);
      }
      G.audio.leave();
      updateHud();
      checkBudget();
      return;
    }
    if (to !== from) {
      setCoord(v, Math.min(N - v.len, Math.max(0, to)));
      cur.undo.push({ i, from });
      cur.moves++;
      G.audio.slide();
      updateHud();
      checkBudget();
    }
  }

  function checkBudget() {
    if (!cur.won && !cur.lost && cur.moves >= cur.budget) commitLose();
  }

  function onUp(e) {
    if (!drag || !cur) return;
    const d = drag; drag = null;
    if (cur.won || cur.lost) return;
    const v = cur.vehicles[d.i];
    const quickTap = performance.now() - d.t0 < 250 && Math.abs(d.pos - d.startCoord) < 0.15;
    let target;
    if (quickTap) {
      // Tap-to-slide: if the car is free in exactly one direction, send it all the way.
      // A blocker stops at the wall — leaving through a side street takes a deliberate drag past
      // the edge, so a stray tap never costs a car for good. The taxi may still tap out to win.
      const freeBack = d.min < d.startCoord, freeFwd = d.max > d.startCoord;
      if (freeBack === freeFwd) { setCoord(v, d.startCoord); return; } // both or neither: ambiguous, ignore
      target = freeFwd ? d.max : d.min;
      if (!v.isGoal) target = Math.min(cur.N - v.len, Math.max(0, target));
      if (target === d.startCoord) { setCoord(v, d.startCoord); return; }
    } else {
      target = Math.min(d.max, Math.max(d.min, Math.round(d.pos)));
    }
    // Ease from the current drag position into the target cell, then commit.
    settle = { i: d.i, from: d.pos, to: target, t0: performance.now(), startCoord: d.startCoord };
  }

  // Undo restores the board but the move still counts against the budget (v2 rule).
  function undoMove() {
    if (!cur || cur.won || cur.lost || cur.undo.length === 0 || settle) return;
    const u = cur.undo.pop();
    const v = cur.vehicles[u.i];
    if (u.out) v.out = false;
    setCoord(v, u.from);
    G.audio.tap();
    updateHud();
  }

  function resetLevel() {
    if (!cur) return;
    cur.vehicles = cur.initial.map((v) => ({ ...v }));
    cur.moves = 0; cur.undo = []; cur.won = false; cur.lost = false;
    winFx = null; settle = null; puffs = [];
    document.body.classList.remove("over");
    $("#win-overlay").classList.remove("active");
    $("#lose-overlay").classList.remove("active");
    G.audio.tap();
    updateHud();
  }

  // ---------- fx ----------
  function burst(x, y, n, speed, colorIdx, dir) {
    const { cell } = boardMetrics();
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = speed * 0.3 + Math.random() * speed;
      let vx = Math.cos(a) * sp, vy = Math.sin(a) * sp - 120;
      if (dir) { vx = vx * 0.5 + dir[0] * speed * 0.7; vy = vy * 0.5 + dir[1] * speed * 0.7 - 40; } // drift toward the mouth, slow enough to be seen
      puffs.push({ x, y, vx, vy, life: 0.7 + Math.random() * 0.6,
        c: colorIdx == null ? Math.floor(Math.random() * cfg.palette.vehicles.length) : colorIdx, r: Math.max(3, cell * 0.08) + Math.random() * Math.max(4, cell * 0.12) });
    }
  }

  function startWinFx(v, outward) {
    const { N } = boardMetrics();
    const from = coordOf(v);
    const to = outward ? N + 0.8 : -(v.len + 0.8);
    const ex = exitCenterPx(cur.goal);
    burst(ex.x, ex.y, 70, 300, null);
    winFx = { t0: performance.now(), dur: 620, from, to };
  }

  function exitCenterPx(e) {
    const { m, cell, N } = boardMetrics();
    if (e.side === "right") return { x: m + N * cell + m / 2, y: m + (e.index + 0.5) * cell };
    if (e.side === "left") return { x: m / 2, y: m + (e.index + 0.5) * cell };
    if (e.side === "bottom") return { x: m + (e.index + 0.5) * cell, y: m + N * cell + m / 2 };
    return { x: m + (e.index + 0.5) * cell, y: m / 2 };
  }

  // ---------- render helpers ----------
  function resizeCanvas() {
    const wrap = $("#board-wrap");
    const s = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
    if (s <= 0) return;
    dpr = window.devicePixelRatio || 1;
    cssSize = s;
    canvas.style.width = s + "px";
    canvas.style.height = s + "px";
    canvas.width = Math.round(s * dpr);
    canvas.height = Math.round(s * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
  }

  // ---------- main frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    tick(now);
  }
  // one simulation+draw step; the debug API drives this by hand in hidden tabs where rAF starves
  function tick(now) {
    drawHero(now);
    if (!cur || !$("#screen-game").classList.contains("active")) return;
    if (Math.abs(canvas.clientWidth - cssSize) > 1) resizeCanvas();

    // settle animation
    if (settle) {
      const t = Math.min(1, (now - settle.t0) / 130);
      const ease = 1 - Math.pow(1 - t, 3);
      const pos = settle.from + (settle.to - settle.from) * ease;
      settle.render = pos;
      if (t >= 1) {
        const s = settle; settle = null;
        finishMove(s.i, s.startCoord, s.to);
      }
    }

    drawBoard(now);
  }

  function drawBoard(now) {
    const P = cfg.palette, { S, N, m, cell } = boardMetrics();
    ctx.clearRect(0, 0, S, S);

    // grass surround
    rr(ctx, 0, 0, S, S, S * 0.05);
    ctx.fillStyle = P.grass; ctx.fill();
    // curb / sidewalk band
    rr(ctx, m * 0.45, m * 0.45, S - m * 0.9, S - m * 0.9, S * 0.035);
    ctx.fillStyle = P.curb; ctx.fill();
    // asphalt
    ctx.fillStyle = P.board;
    ctx.fillRect(m, m, N * cell, N * cell);
    // lane markings: dashed lines between lanes
    ctx.strokeStyle = P.lane;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(1.5, cell * 0.045);
    ctx.setLineDash([cell * 0.28, cell * 0.3]);
    for (let k = 1; k < N; k++) {
      ctx.beginPath(); ctx.moveTo(m + k * cell, m + cell * 0.15); ctx.lineTo(m + k * cell, m + N * cell - cell * 0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m + cell * 0.15, m + k * cell); ctx.lineTo(m + N * cell - cell * 0.15, m + k * cell); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    let liveExit = null;
    if (drag) {
      const v = cur.vehicles[drag.i];
      if (drag.max > N - v.len) liveExit = G.gen.exitFor(cur.exits, v, true);
      else if (drag.min < 0) liveExit = G.gen.exitFor(cur.exits, v, false);
    }
    for (const e of cur.exits) drawExit(e, now, e === liveExit);

    // corridor highlight while dragging
    if (drag) {
      const v = cur.vehicles[drag.i];
      ctx.fillStyle = "rgba(255,255,255,.08)";
      const lo = Math.max(0, drag.min), hi = Math.min(N - (v.horiz ? v.len : 1), drag.max);
      if (v.horiz) ctx.fillRect(m + lo * cell, m + v.y * cell, (hi - lo + v.len) * cell, cell);
      else ctx.fillRect(m + v.x * cell, m + lo * cell, cell, (hi - lo + v.len) * cell);
    }

    // vehicles (dragged one last, so it sits on top)
    let goalDrawCoord = null;
    if (winFx) {
      const t = Math.min(1, (now - winFx.t0) / winFx.dur);
      goalDrawCoord = winFx.from + (winFx.to - winFx.from) * (t * t);
    }
    const order = cur.vehicles.map((_, i) => i);
    if (drag) { order.splice(order.indexOf(drag.i), 1); order.push(drag.i); }
    for (const i of order) {
      const v = cur.vehicles[i];
      let c = coordOf(v);
      if (drag && drag.i === i) c = drag.pos;
      if (settle && settle.i === i && settle.render !== undefined) c = settle.render;
      else if (v.out) continue;
      if (v.isGoal && goalDrawCoord !== null) c = goalDrawCoord;
      drawVehicle(v, c, drag && drag.i === i);
    }

    // particles (drawn above everything on the canvas)
    if (puffs.length) {
      const dt = Math.min(0.05, (now - puffPrev) / 1000);
      ctx.save();
      for (const p of puffs) {
        p.life -= dt; if (p.life <= 0) continue;
        p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = cfg.palette.vehicles[p.c];
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      }
      ctx.restore();
      puffs = puffs.filter((p) => p.life > 0);
    }
    puffPrev = now;
  }

  // The taxi's exit glows and pulses; side streets are plain grey mouths with a lane stripe.
  function drawExit(e, now, live) {
    const P = cfg.palette, { N, m, cell } = boardMetrics();
    const gap = cell * 0.96, off = cell * 0.02;
    const horizMouth = e.side === "left" || e.side === "right";
    // mouth: asphalt continues through the curb+grass to the edge
    ctx.fillStyle = P.board;
    if (e.side === "right") ctx.fillRect(m + N * cell, m + e.index * cell + off, m, gap);
    if (e.side === "left") ctx.fillRect(0, m + e.index * cell + off, m, gap);
    if (e.side === "bottom") ctx.fillRect(m + e.index * cell + off, m + N * cell, gap, m);
    if (e.side === "top") ctx.fillRect(m + e.index * cell + off, 0, gap, m);
    const c = exitCenterPx(e);
    const dir = e.side === "right" ? [1, 0] : e.side === "left" ? [-1, 0] : e.side === "bottom" ? [0, 1] : [0, -1];
    ctx.save();
    if (e.goal) {
      // glow + chevrons live in the mouth (outside the play area — nothing can cover them)
      const pulse = 0.6 + 0.4 * Math.sin(now / 320);
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, cell * 1.1);
      grad.addColorStop(0, "rgba(246,169,63," + (0.4 * pulse) + ")");
      grad.addColorStop(1, "rgba(246,169,63,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(c.x - cell * 1.1, c.y - cell * 1.1, cell * 2.2, cell * 2.2);
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = Math.max(3, cell * 0.12);
      ctx.lineCap = "round";
      for (let k = 0; k < 2; k++) {
        const bx = c.x + dir[0] * (m * (k * 0.42 - 0.12));
        const by = c.y + dir[1] * (m * (k * 0.42 - 0.12));
        const s = cell * 0.24;
        ctx.beginPath();
        if (dir[0] !== 0) { ctx.moveTo(bx - dir[0] * s, by - s); ctx.lineTo(bx, by); ctx.lineTo(bx - dir[0] * s, by + s); }
        else { ctx.moveTo(bx - s, by - dir[1] * s); ctx.lineTo(bx, by); ctx.lineTo(bx + s, by - dir[1] * s); }
        ctx.stroke();
      }
    } else {
      // side street: a solid arrow pointing out; lit up (and the lane stripe runs into the lot)
      // while the held car can actually leave through it
      if (live) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 160);
        ctx.fillStyle = "rgba(255,255,255," + (0.16 + 0.12 * pulse) + ")";
        if (e.side === "right") ctx.fillRect(m + N * cell, m + e.index * cell + off, m, gap);
        if (e.side === "left") ctx.fillRect(0, m + e.index * cell + off, m, gap);
        if (e.side === "bottom") ctx.fillRect(m + e.index * cell + off, m + N * cell, gap, m);
        if (e.side === "top") ctx.fillRect(m + e.index * cell + off, 0, gap, m);
        ctx.strokeStyle = P.lane; ctx.globalAlpha = 0.7;
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.setLineDash([cell * 0.14, cell * 0.14]);
        ctx.lineDashOffset = -now / 40;
        const hv = cur.vehicles[drag.i];
        const near = drag.pos; // held car's current coord along its axis
        ctx.beginPath();
        if (horizMouth) {
          const carEdge = m + (e.side === "right" ? (near + hv.len) : near) * cell;
          const mouthEnd = e.side === "right" ? m + N * cell + m : 0;
          ctx.moveTo(carEdge, c.y); ctx.lineTo(mouthEnd, c.y);
        } else {
          const carEdge = m + (e.side === "bottom" ? (near + hv.len) : near) * cell;
          const mouthEnd = e.side === "bottom" ? m + N * cell + m : 0;
          ctx.moveTo(c.x, carEdge); ctx.lineTo(c.x, mouthEnd);
        }
        ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
      const s = cell * (live ? 0.24 : 0.19);
      const bx = c.x + dir[0] * m * 0.12, by = c.y + dir[1] * m * 0.12;
      ctx.globalAlpha = live ? 1 : 0.9;
      ctx.fillStyle = live ? "#FFFFFF" : "#E8E2D2";
      ctx.beginPath();
      if (dir[0] !== 0) { ctx.moveTo(bx + dir[0] * s, by); ctx.lineTo(bx - dir[0] * s * 0.6, by - s); ctx.lineTo(bx - dir[0] * s * 0.6, by + s); }
      else { ctx.moveTo(bx, by + dir[1] * s); ctx.lineTo(bx - s, by - dir[1] * s * 0.6); ctx.lineTo(bx + s, by - dir[1] * s * 0.6); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawVehicle(v, c, lifted) {
    drawVehicleOn(ctx, v, c, lifted, boardMetrics(), cfg.palette);
  }

  // Toy-style car: body with outline, lighter roof, glass windshields, wheels.
  function drawVehicleOn(g, v, c, lifted, M, P) {
    const { m, cell } = M;
    const pad = cell * 0.07;
    let x0 = m + (v.horiz ? c : v.x) * cell + pad;
    let y0 = m + (v.horiz ? v.y : c) * cell + pad;
    let w = (v.horiz ? v.len : 1) * cell - 2 * pad;
    let h = (v.horiz ? 1 : v.len) * cell - 2 * pad;
    if (lifted) { // scale 1.05 about center
      const cx = x0 + w / 2, cy = y0 + h / 2;
      w *= 1.05; h *= 1.05; x0 = cx - w / 2; y0 = cy - h / 2;
    }
    const r = Math.min(w, h) * 0.3;
    const base = P.vehicles[v.colorIdx];

    // wheels: dark stubs on the long sides
    g.fillStyle = "#23262B";
    const ww = Math.min(w, h) * 0.16, wl = Math.min(w, h) * 0.3;
    if (v.horiz) {
      [0.18, 0.82].forEach((f) => {
        for (let seg = 0; seg < v.len; seg++) {
          const wx = x0 + (seg + 0.5) * (w / v.len) - wl / 2;
          rr(g, wx, y0 + (f < 0.5 ? -ww * 0.45 : h - ww * 0.55), wl, ww, ww * 0.4); g.fill();
        }
      });
    } else {
      [0.18, 0.82].forEach((f) => {
        for (let seg = 0; seg < v.len; seg++) {
          const wy = y0 + (seg + 0.5) * (h / v.len) - wl / 2;
          rr(g, x0 + (f < 0.5 ? -ww * 0.45 : w - ww * 0.55), wy, ww, wl, ww * 0.4); g.fill();
        }
      });
    }

    // shadow
    g.save();
    g.globalAlpha = lifted ? 0.35 : 0.22;
    g.fillStyle = "#000";
    rr(g, x0 + 2, y0 + (lifted ? 9 : 4), w, h, r); g.fill();
    g.restore();

    // body with subtle vertical light
    const bodyGrad = g.createLinearGradient(x0, y0, x0, y0 + h);
    bodyGrad.addColorStop(0, shade(base, 0.12));
    bodyGrad.addColorStop(1, shade(base, -0.18));
    g.fillStyle = bodyGrad;
    rr(g, x0, y0, w, h, r); g.fill();
    g.lineWidth = Math.max(1.5, cell * 0.045);
    g.strokeStyle = "rgba(25,28,34,.5)";
    g.stroke();

    // glass: windshield bands near both ends
    g.fillStyle = "rgba(30,40,55,.75)";
    const glassW = v.horiz ? w * 0.13 : w * 0.68;
    const glassH = v.horiz ? h * 0.68 : h * 0.13;
    if (v.horiz) {
      rr(g, x0 + w * 0.16, y0 + h * 0.16, glassW, glassH, glassH * 0.25); g.fill();
      rr(g, x0 + w * 0.84 - glassW, y0 + h * 0.16, glassW, glassH, glassH * 0.25); g.fill();
    } else {
      rr(g, x0 + w * 0.16, y0 + h * 0.16, glassW, glassH, glassW * 0.25); g.fill();
      rr(g, x0 + w * 0.16, y0 + h * 0.84 - glassH, glassW, glassH, glassW * 0.25); g.fill();
    }

    // roof: lighter plate in the middle
    const roofPadL = v.horiz ? w * 0.32 : w * 0.2;
    const roofPadT = v.horiz ? h * 0.2 : h * 0.32;
    const roofW = w - 2 * roofPadL, roofH = h - 2 * roofPadT;
    g.fillStyle = shade(base, 0.22);
    rr(g, x0 + roofPadL, y0 + roofPadT, roofW, roofH, Math.min(roofW, roofH) * 0.3); g.fill();

    // gloss streak
    g.save();
    rr(g, x0, y0, w, h, r); g.clip();
    g.fillStyle = "rgba(255,255,255,.16)";
    g.beginPath();
    g.ellipse(x0 + w * 0.28, y0 + h * 0.2, w * 0.3, h * 0.16, -0.4, 0, 7);
    g.fill();
    g.restore();

    // taxi trim
    if (v.isGoal) {
      const along = v.horiz;
      const bandLen = along ? w : h;
      const sq = Math.min(w, h) * 0.22;
      const nSq = 4;
      const step = bandLen * 0.6 / nSq;
      for (let k = 0; k < nSq; k++) {
        g.fillStyle = k % 2 ? "#23262B" : "#FAFAF5";
        if (along) g.fillRect(x0 + bandLen * 0.2 + k * step, y0 + h * 0.44, step, sq * 0.55);
        else g.fillRect(x0 + w * 0.44, y0 + bandLen * 0.2 + k * step, sq * 0.55, step);
      }
      // roof sign
      const rsW = along ? w * 0.3 : w * 0.5;
      const rsH = along ? h * 0.5 : h * 0.3;
      g.fillStyle = "#23262B";
      rr(g, x0 + w / 2 - rsW / 2, y0 + h / 2 - rsH / 2, rsW, rsH, Math.min(rsW, rsH) * 0.35); g.fill();
      if (Math.min(w, h) > 26) {
        g.fillStyle = "#F6C93F";
        g.font = "700 " + Math.max(7, Math.min(rsH, rsW) * 0.55) + "px system-ui";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.save();
        g.translate(x0 + w / 2, y0 + h / 2);
        if (!along) g.rotate(Math.PI / 2);
        g.fillText("TAXI", 0, 1);
        g.restore();
      }
    }
  }

  // ---------- title hero: idle mini-board ----------
  let heroCanvas = null, heroCtx = null, heroCars = null;
  function drawHero(now) {
    if (!$("#screen-title").classList.contains("active")) return;
    if (!heroCanvas) {
      heroCanvas = $("#hero");
      if (!heroCanvas) return;
      heroCtx = heroCanvas.getContext("2d");
      heroCars = [
        { x: -1.2, y: 0, len: 2, horiz: true, isGoal: true, colorIdx: 0, sp: 1.15 },
        { x: -4.5, y: 1, len: 3, horiz: true, isGoal: false, colorIdx: 2, sp: 0.85 },
        { x: -8, y: 2, len: 2, horiz: true, isGoal: false, colorIdx: 1, sp: 1.0 }
      ];
    }
    const W = heroCanvas.clientWidth, H = heroCanvas.clientHeight;
    if (!W) return;
    const d = window.devicePixelRatio || 1;
    if (heroCanvas.width !== Math.round(W * d)) {
      heroCanvas.width = Math.round(W * d); heroCanvas.height = Math.round(H * d);
    }
    heroCtx.setTransform(d, 0, 0, d, 0, 0);
    const P = cfg.palette;
    const cell = H / 3.4;
    heroCtx.clearRect(0, 0, W, H);
    rr(heroCtx, 0, 0, W, H, 14);
    heroCtx.fillStyle = P.board; heroCtx.fill();
    heroCtx.strokeStyle = P.lane; heroCtx.globalAlpha = 0.25;
    heroCtx.lineWidth = 3; heroCtx.setLineDash([14, 16]);
    for (let k = 1; k < 3; k++) { heroCtx.beginPath(); heroCtx.moveTo(0, k * cell * 1.06 + cell * 0.05); heroCtx.lineTo(W, k * cell * 1.06 + cell * 0.05); heroCtx.stroke(); }
    heroCtx.setLineDash([]); heroCtx.globalAlpha = 1;
    const M = { m: 0, cell };
    for (const car of heroCars) {
      car.x += car.sp * 0.016;
      if (car.x > W / cell + 0.5) car.x = -car.len - Math.random() * 3;
      drawVehicleOn(heroCtx, { ...car, x: 0, y: car.y * 1.06 + 0.05 }, car.x, false, M, P);
    }
  }

  // ---------- wire up ----------
  function syncSoundButtons() {
    document.querySelectorAll(".btn-sound").forEach((b) => { b.textContent = G.audio.isMuted() ? "\u{1F507}" : "\u{1F50A}"; });
  }

  function leaveToMenu() {
    if (cur && cur.tier === "endless") show("title"); else { show("levels"); renderLevelGrid(); }
  }

  window.addEventListener("DOMContentLoaded", () => {
    boot();
    $("#btn-play").addEventListener("click", () => {
      for (const t of Object.keys(cfg.tiers)) {
        const list = levels.filter((l) => l.tier === t);
        for (let n = 0; n < list.length; n++) {
          if (!progress[levelId(list[n], n)]) { startLevel(list[n], n); return; }
        }
      }
      show("levels"); renderLevelGrid();
    });
    $("#btn-levels").addEventListener("click", () => { show("levels"); renderLevelGrid(); G.audio.tap(); });
    $("#btn-endless").addEventListener("click", () => startEndless(0));
    $("#btn-back-title").addEventListener("click", () => { show("title"); G.audio.tap(); });
    $("#btn-back-game").addEventListener("click", () => { leaveToMenu(); G.audio.tap(); });
    $("#btn-undo").addEventListener("click", undoMove);
    $("#btn-reset").addEventListener("click", resetLevel);
    $("#btn-next").addEventListener("click", nextLevel);
    $("#btn-replay").addEventListener("click", resetLevel);
    $("#btn-win-menu").addEventListener("click", () => { $("#win-overlay").classList.remove("active"); leaveToMenu(); });
    $("#btn-retry").addEventListener("click", () => {
      $("#lose-overlay").classList.remove("active");
      if (cur && cur.tier === "endless") startEndless(0); else resetLevel();
    });
    $("#btn-lose-menu").addEventListener("click", () => { $("#lose-overlay").classList.remove("active"); leaveToMenu(); });
    document.querySelectorAll(".btn-sound").forEach((b) => b.addEventListener("click", () => {
      G.audio.setMuted(!G.audio.isMuted());
      LS.set(VKEY + ".muted", G.audio.isMuted());
      syncSoundButtons();
      G.audio.tap();
    }));
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("lostpointercapture", onUp);
    window.addEventListener("pointerup", onUp);   // released outside the canvas or the window
    window.addEventListener("blur", () => { if (drag) { setCoord(cur.vehicles[drag.i], drag.startCoord); drag = null; } });
    window.addEventListener("resize", () => { if ($("#screen-game").classList.contains("active")) resizeCanvas(); });
  });
})();
