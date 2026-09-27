// Sapper's Path page (SPEC §4-§6): boot, layout, input, the win/stuck panel, save, the frame loop, and the ?debug=1
// facade (window.SP) with selfTest. The rules live in engine.js, the pick/feedback logic in game.js, the art in render.js.
//
// Clock: app.clock is sim time in ms. The rAF loop advances it by the real frame delta (capped at config.fx.maxDtMs);
// SP.tick(ms) advances it by hand, so a hidden tab (no rAF) can still be driven. Panels appear when the clock passes
// their delay; nothing here uses setTimeout or setInterval.
(function () {
  "use strict";
  const NS = window.SappersPath, E = NS.engine, Solver = NS.solver, Save = NS.save, Game = NS.game, Render = NS.render;
  const V_ = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const CREWS = E.CREWS, $ = (id) => document.getElementById(id);
  const cards = Array.from(document.querySelectorAll(".crew"));
  const app = { cfg: null, entries: [], byId: new Map(), ids: new Set(), save: null, entry: null, game: null, V: null,
    clock: 0, lastT: 0, screen: "title", panel: null, pact: {}, dirty: true, testing: false, cardFlash: -1, cacheRebuilds: 0 };

  // ---- boot --------------------------------------------------------------------------------------------------------
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }

  async function boot() {
    try {
      const [cfg, lv] = await Promise.all([getJSON("config.json?v=" + V_), getJSON("levels/levels.json?v=" + V_)]);
      app.cfg = cfg; indexLevels(lv);
    } catch (e) { $("load-msg").textContent = "Couldn't load the castle. Reload to try again."; return; }
    if (!app.entries.length) { $("load-msg").textContent = "No levels found."; return; }
    app.save = Save.open(storage(), app.cfg.save.key, app.ids, app.cfg.save.maxCrews);
    app.V = Render.create($("board"), app.cfg);
    drawCardIcons(); buildSelect(); wire(); layout();
    showScreen("title");
    if (DEBUG) window.SP = SP;
    requestAnimationFrame(frame);
  }

  // Levels come from levels.json as worlds[].levels[]; nothing here knows their ids or counts. A level that fails to
  // parse is skipped, never fatal.
  function indexLevels(lv) {
    const worlds = lv && Array.isArray(lv.worlds) ? lv.worlds : [];
    worlds.forEach((w, wi) => {
      const list = w && Array.isArray(w.levels) ? w.levels : [];
      list.forEach((L, i) => {
        try { E.parse(L); } catch (e) { return; }
        const id = String(L.id);
        if (app.byId.has(id)) return;
        const entry = { L, id, world: (w.world | 0) || wi + 1, worldName: w.name || "", n: i + 1, idx: app.entries.length, btn: null };
        app.entries.push(entry); app.byId.set(id, entry); app.ids.add(id);
      });
    });
  }

  function storage() { try { const s = window.localStorage; s.getItem("sappers-path.probe"); return s; } catch (e) { return Save.memoryStore(); } }

  function drawCardIcons() {
    const A = app.cfg.art;
    for (const b of cards) {
      const m = +b.dataset.m, c = b.querySelector(".ico"), g = c.getContext("2d"), r = c.width / 2;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = A[Render.MATS[m]][0]; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = A.badge[0]; g.beginPath(); g.arc(r, r, r * 0.8, 0, Math.PI * 2); g.fill();
      Render.icon(g, m, r, r, r * 0.55, A.badge[1]);
    }
  }

  function wire() {
    $("board").addEventListener("pointerdown", onBoardDown);
    for (const b of cards) b.addEventListener("click", () => tapCrew(CREWS[+b.dataset.m]));
    $("btn-undo").addEventListener("click", () => undo());
    $("btn-restart").addEventListener("click", () => restart());
    $("btn-menu").addEventListener("click", openSelect);
    $("btn-play").addEventListener("click", () => loadLevel(continueEntry()));
    $("btn-levels").addEventListener("click", openSelect);
    $("btn-back").addEventListener("click", () => showScreen("play"));
    for (const k of ["primary", "secondary", "third"]) $("p-" + k).addEventListener("click", () => { if (app.pact[k]) app.pact[k](); });
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
    window.addEventListener("pageshow", wake);
    if (window.ResizeObserver) new ResizeObserver(layout).observe($("app")); else window.addEventListener("resize", layout);
  }

  // ---- screens and levels ------------------------------------------------------------------------------------------
  function showScreen(name) {
    app.screen = name;
    $("title").hidden = name !== "title"; $("select").hidden = name !== "select";
    app.dirty = true;
  }

  // The first level without a win (level 1 on a fresh save), so Play is one tap from load.
  function continueEntry() {
    for (const e of app.entries) if (!(app.save.data.stars[e.id] > 0)) return e;
    return app.byId.get(app.save.data.last) || app.entries[0];
  }

  function loadLevel(entry) {
    let g;
    try { g = Game.create(entry.L, app.cfg); } catch (e) { return false; }
    mount(entry, g);
    app.save.data.last = entry.id; app.save.write();
    return true;
  }

  // Show a game on the board (no save writes: selfTest uses this to hand the player's game back).
  function mount(entry, g) {
    app.entry = entry; app.game = g; app.cardFlash = -1;
    hidePanel();
    Render.setLevel(app.V, g.B);
    $("lvl-num").textContent = entry.world + "-" + entry.n;
    $("lvl-name").textContent = entry.L.name || "";
    $("teach").textContent = entry.L.teaches || ""; $("teach").hidden = !entry.L.teaches;
    for (const b of cards) { b.hidden = !g.present[+b.dataset.m]; b.classList.remove("flash"); }
    showScreen("play"); layout(); ui();
  }

  function nextEntry() { return app.entry ? app.entries[app.entry.idx + 1] || null : null; }

  function buildSelect() {
    const box = $("worlds"); box.textContent = "";
    let cur = null, grid = null;
    for (const e of app.entries) {
      if (cur !== e.world) {
        cur = e.world;
        const w = document.createElement("div"), h = document.createElement("h3");
        w.className = "world"; h.textContent = "World " + e.world + (e.worldName ? ": " + e.worldName : "");
        grid = document.createElement("div"); grid.className = "levels"; w.append(h, grid); box.append(w);
      }
      const b = document.createElement("button"), i = document.createElement("i");
      b.textContent = e.n; b.append(i); b.setAttribute("aria-label", "Level " + e.world + "-" + e.n);
      b.addEventListener("click", () => loadLevel(e));
      grid.append(b); e.btn = b;
    }
  }

  function openSelect() {
    for (const e of app.entries) { const n = app.save.data.stars[e.id] | 0; e.btn.lastChild.textContent = n ? "★".repeat(n) : "·"; e.btn.classList.toggle("done", n > 0); }
    $("btn-back").hidden = !app.game;
    showScreen("select");
  }

  // ---- input (the pointer handlers and SP call these exact functions) ------------------------------------------------
  function onBoardDown(e) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const c = Render.cellAt(app.V, e.clientX, e.clientY);
    if (c) tapCell(c.x, c.y);
  }

  function tapCell(x, y) {
    const g = app.game;
    if (!g || app.screen !== "play" || app.panel === "win") return "ignored";
    const r = Game.tapCell(g, x | 0, y | 0, app.clock);
    drain(); return r;
  }

  function tapCrew(type) {
    const g = app.game, m = typeof type === "number" ? type : CREWS.indexOf(type);
    if (!g || app.screen !== "play" || app.panel === "win") return "ignored";
    const r = Game.tapCrew(g, m, app.clock);
    drain(); return r;
  }

  function undo() { if (!app.game || app.screen !== "play") return false; const r = Game.undo(app.game); drain(); return r; }
  function restart() { if (!app.game || app.screen !== "play") return false; const r = Game.restart(app.game); drain(); return r; }

  function onKey(e) {
    if (app.screen !== "play" || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k >= "1" && k <= "4") { const vis = cards.filter((b) => !b.hidden), b = vis[+k - 1]; if (b) tapCrew(CREWS[+b.dataset.m]); }
    else if (k === "u" || k === "z" || k === "Backspace") undo();
    else if (k === "r") restart();
    else if (k === "Escape") { if (app.game) { app.game.pick = -1; ui(); app.dirty = true; } }
    else if ((k === "Enter" || k === "n") && app.panel && app.pact.primary) app.pact.primary();
    else return;
    e.preventDefault();
  }

  // Apply what a game call queued: dust for a break, the save on a win, the panel closing on undo/restart.
  function drain() {
    const g = app.game, ev = g.events;
    for (let i = 0; i < ev.length; i++) {
      const t = ev[i].t;
      if (t === "break") Render.spawnDust(app.V, ev[i].s);
      else if (t === "win") { Save.record(app.save.data, app.entry.id, Game.stars(app.cfg, g.L.min, g.st.used), g.st.used); app.save.write(); }
      else if (t === "undo" || t === "restart") hidePanel();
    }
    ev.length = 0;
    ui(); app.dirty = true;
  }

  // ---- HUD, cards, panel -------------------------------------------------------------------------------------------
  function ui() {
    const g = app.game;
    if (!g) return;
    $("hud-used").textContent = g.st.used; $("hud-par").textContent = g.L.min;
    $("hud").setAttribute("aria-label", "Crews used " + g.st.used + ", three stars at " + g.L.min);
    for (const b of cards) {
      const m = +b.dataset.m, n = g.st.remaining[m];
      b.querySelector(".n").textContent = n;
      b.classList.toggle("picked", g.pick === m); b.classList.toggle("zero", n <= 0);
    }
    $("btn-undo").disabled = !g.st.moves.length; $("btn-restart").disabled = !g.st.moves.length;
  }

  function setPanelButton(k, label, fn) { const b = $("p-" + k); b.hidden = !label; b.textContent = label || ""; app.pact[k] = fn || null; }

  function showPanel(kind) {
    const g = app.game, star = "★";
    app.panel = kind;
    if (kind === "win") {
      const n = Game.stars(app.cfg, g.L.min, g.st.used), nx = nextEntry();
      $("p-stars").innerHTML = star.repeat(n) + '<span class="off">' + star.repeat(3 - n) + "</span>";
      $("p-title").textContent = n === 3 ? "Keep breached!" : "Keep breached";
      $("p-line").textContent = "Crews used " + g.st.used + " · 3 stars at " + g.L.min;
      setPanelButton("primary", nx ? "Next" : "Levels", nx ? () => loadLevel(nx) : openSelect);
      setPanelButton("secondary", "Replay", () => restart());
      setPanelButton("third", nx ? "Levels" : null, nx ? openSelect : null);
    } else {
      $("p-stars").textContent = "";
      $("p-title").textContent = "Stuck";
      $("p-line").textContent = "No crew left can reach a wall it breaks.";
      setPanelButton("primary", "Undo", () => undo());
      setPanelButton("secondary", "Restart", () => restart());
      setPanelButton("third", null, null);
    }
    $("panel").hidden = false;
  }
  function hidePanel() { app.panel = null; $("panel").hidden = true; }

  // ---- layout, frame loop ------------------------------------------------------------------------------------------
  // Portrait: the board takes the stage (all the height the top bar and the rail leave). Wide (desktop 16:9): the board
  // sits in the centre column and the rail in the right one; the width left for the board is the play area minus a
  // rail and gap on each side, so the board stays centred on the page.
  function layout() {
    if (!app.cfg) return;
    const L = app.cfg.layout, play = $("play"), stage = $("stage");
    const wide = innerWidth >= L.wideMinPx && innerWidth >= innerHeight * L.wideAspect;
    document.body.classList.toggle("wide", wide);
    play.style.setProperty("--rail", L.railPx + "px"); play.style.setProperty("--gap", L.gapPx + "px");
    if (!app.game) return;
    const dpr = Math.min(L.maxDpr, Math.max(1, window.devicePixelRatio || 1));
    const aw = wide ? play.clientWidth - 2 * (L.railPx + L.gapPx) : stage.clientWidth;
    const r = Render.fit(app.V, Math.max(1, aw), Math.max(1, stage.clientHeight), dpr);
    play.style.setProperty("--bw", Math.ceil(r.cssW) + "px");
    const cv = $("board");
    cv.style.left = Math.round((stage.clientWidth - r.cssW) / 2) + "px"; cv.style.top = Math.round((stage.clientHeight - r.cssH) / 2) + "px";
    app.dirty = true;
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = app.lastT ? Math.min(app.cfg.fx.maxDtMs, Math.max(0, t - app.lastT)) : 0;
    app.lastT = t; step(dt);
  }

  // One step of the sim clock: due panels, the card flash, then a frame if anything moved.
  function step(dt) {
    app.clock += dt;
    const g = app.game, F = app.cfg.fx;
    if (!g || app.screen !== "play") return;
    if (!app.panel && g.endT >= 0 && app.clock - g.endT >= (g.st.won ? F.winPanelMs : F.stuckPanelMs)) showPanel(g.st.won ? "win" : "stuck");
    const cf = app.clock - g.fx.cardT < F.cardFlashMs ? g.fx.cardM : -1;
    if (cf !== app.cardFlash) { app.cardFlash = cf; for (const b of cards) b.classList.toggle("flash", +b.dataset.m === cf); }
    if (app.testing) return;
    if (app.dirty || Render.busy(app.V, g, app.clock)) { Render.draw(app.V, g, app.clock); app.dirty = false; }
  }

  // Back from the background: re-check the sprite caches (a discarded backing store reads blank), redraw.
  function wake() {
    if (!app.V) return;
    if (Render.check(app.V)) app.cacheRebuilds++;
    app.dirty = true; app.lastT = 0;
  }

  // ---- debug facade (?debug=1) -------------------------------------------------------------------------------------
  function state() {
    const g = app.game, e = app.entry;
    const out = { screen: app.screen, panel: app.panel, clock: app.clock, twoTap: !!app.cfg.input.twoTap };
    if (!g) return out;
    const rem = {};
    for (let i = 0; i < 4; i++) if (g.present[i]) rem[CREWS[i]] = g.st.remaining[i];
    return Object.assign(out, { id: e.id, world: e.world, n: e.n, w: g.B.w, h: g.B.h, min: g.L.min, moves: g.st.moves.length, used: g.st.used,
      remaining: rem, pick: g.pick >= 0 ? CREWS[g.pick] : null, won: g.st.won, stuck: g.st.stuck, legal: g.st.legal,
      stars: g.st.won ? Game.stars(app.cfg, g.L.min, g.st.used) : 0, saved: app.save.data.stars[e.id] | 0, flashN: g.fx.flashN,
      cell: app.V.cell, dpr: app.V.dpr, cacheRebuilds: app.cacheRebuilds });
  }

  // Solve on a clone: the full level from the start (the M0 solver) and the fewest breaks from here. Never touches the
  // live game or the save.
  function solveNow() {
    const g = app.game;
    if (!g) return null;
    const B = E.parse(JSON.parse(JSON.stringify(g.L))), r = Solver.solve(B), here = Game.solveFrom(g, 200000);
    return { win: r.win, min: r.min, line: r.line.map((s) => Game.firstTile(B, s)), states: r.states, capped: r.capped, fromHere: here };
  }

  function renderSignature() {
    const g = app.game, V = app.V, c = V.canvas;
    if (!g) return app.screen;
    Render.draw(V, g, app.clock);
    const px = Render.pixelHash(V);
    return [app.entry.id, V.cell, V.dpr, c.width + "x" + c.height, g.pick, E.serialize(g.st), px.hash, px.opaque.toFixed(3)].join("|");
  }

  // The primary buttons a player can see on the current screen.
  function primaryButtons() {
    if (app.screen === "title") return [$("btn-play"), $("btn-levels")];
    if (app.screen === "select") {
      const out = Array.from(document.querySelectorAll("#worlds button")).filter((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
      if (!$("btn-back").hidden) out.push($("btn-back"));
      return out;
    }
    const out = [$("btn-menu")];
    if (app.panel) { for (const k of ["primary", "secondary", "third"]) if (!$("p-" + k).hidden) out.push($("p-" + k)); return out; }
    for (const b of cards) if (!b.hidden) out.push(b);
    out.push($("btn-undo"), $("btn-restart"));
    return out;
  }
  // elementFromPoint at the centre of each primary button hits that button (lesson 34). Returns how many were checked.
  function checkButtons(check, where) {
    let n = 0;
    for (const b of primaryButtons()) {
      const r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      check(r.width >= 44 && r.height >= 44, where + ": " + (b.id || b.textContent) + " is under 44 px");
      check(!!el && (el === b || b.contains(el)), where + ": " + (b.id || b.textContent) + " is covered by " + (el ? el.id || el.className || el.tagName : "nothing"));
      n++;
    }
    return n;
  }

  // A stuck line for one of these entries: seeded random legal breaks until stuck (bounded tries and depth).
  function findStuck(entries, seed, tries) {
    const rng = Solver.mulberry32(seed);
    for (const e of entries) {
      const B = E.parse(e.L);
      for (let t = 0; t < tries; t++) {
        let st = E.start(B);
        for (let d = 0; d <= B.nsec && !st.won && !st.stuck; d++) { const legal = E.legalMoves(B, st); st = E.apply(B, st, legal[Math.floor(rng() * legal.length)]); }
        if (st.stuck) return { e, moves: st.moves.slice() };
      }
    }
    return null;
  }

  // SPEC §5 selfTest, through the same tapCell/tapCrew/undo/restart the pointer handlers call, on a memory save, with
  // SP's manual clock (step). Hands the player's game, screen and save back, and checks their stored save is unchanged.
  function selfTest() {
    const t0 = performance.now(), cfg = app.cfg, fails = [];
    const check = (ok, m) => { if (!ok && fails.length < 40) fails.push(m); return !!ok; };
    const raw = () => { try { return localStorage.getItem(cfg.save.key); } catch (e) { return null; } };
    const rawBefore = raw();
    const keep = { save: app.save, game: app.game, entry: app.entry, screen: app.screen, panel: app.panel, twoTap: cfg.input.twoTap };
    const out = { ok: false, levels: 0, solved: 0, stuck: [], buttons: 0, checks: {}, ms: 0, fails };
    app.save = Save.open(Save.memoryStore(), cfg.save.key, app.ids, cfg.save.maxCrews);
    app.testing = true; cfg.input.twoTap = true;
    try {
      // Title screen buttons first (the page the player lands on).
      showScreen("title"); out.buttons += checkButtons(check, "title");

      // solve() never writes: the player's stored save and the live save data are byte-identical after it.
      loadLevel(app.entries[0]);
      const memBefore = JSON.stringify(app.save.data), sol = solveNow();
      check(sol && sol.win && sol.min === app.entries[0].L.min, "solve() min differs from the baked min");
      check(raw() === rawBefore && JSON.stringify(app.save.data) === memBefore, "solve() changed the save");

      // Stars maths and "stars only go up".
      check(Game.stars(cfg, 3, 3) === 3 && Game.stars(cfg, 3, 4) === 2 && Game.stars(cfg, 3, 5) === 1 && Game.stars(cfg, 3, 9) === 1, "stars offsets");
      const d = Save.fresh(); Save.record(d, "x", 3, 3); Save.record(d, "x", 1, 6);
      check(d.stars.x === 3 && d.best.x === 3, "stars went down on a worse replay");

      // Every level along its baked line: tap 1 picks (by board or by card), tap 2 breaks; undo on move 1 is exact and
      // refunds the crew; the line wins at 3 stars, the panel comes up on the sim clock, 3 stars are saved.
      for (const e of app.entries.slice(0, cfg.selfTest.maxLevels)) {
        out.levels++;
        if (!check(loadLevel(e), e.id + ": load failed")) continue;
        const g = app.game, line = e.L.line;
        if (!check(Array.isArray(line) && line.length === e.L.min, e.id + ": line length is not min")) continue;
        let ok = true;
        for (let k = 0; k < line.length && ok; k++) {
          const x = line[k][0], y = line[k][1], s = E.sectionAt(g.B, x, y), m = g.B.secMat[s], moves = g.st.moves.length;
          const r1 = k % 2 ? tapCrew(CREWS[m]) : tapCell(x, y);
          ok = check(r1 === "pick" && g.pick === m && g.st.moves.length === moves, e.id + " step " + k + ": tap 1 gave " + r1);
          if (!ok) break;
          const before = E.serialize(g.st), rem = g.st.remaining[m], r2 = tapCell(x, y);
          ok = check(r2 === "break" && g.st.moves.length === moves + 1, e.id + " step " + k + ": tap 2 gave " + r2);
          if (ok && k === 0) {
            undo();
            check(E.serialize(g.st) === before && g.st.remaining[m] === rem, e.id + ": undo was not exact");
            tapCell(x, y); ok = check(tapCell(x, y) === "break", e.id + ": redo failed");
          }
        }
        if (!ok) continue;
        const n = Game.stars(cfg, e.L.min, g.st.used);
        check(g.st.won && n === 3 && g.st.used === e.L.min, e.id + ": won " + g.st.won + " stars " + n + " used " + g.st.used);
        step(cfg.fx.winPanelMs);
        check(app.panel === "win", e.id + ": no win panel");
        check((app.save.data.stars[e.id] | 0) === 3 && app.save.data.best[e.id] === e.L.min, e.id + ": 3 stars not saved");
        out.buttons += checkButtons(check, e.id + " win");
        if (g.st.won && app.panel === "win") out.solved++;
      }
      check(out.solved >= cfg.selfTest.minLevels, "solved " + out.solved + " levels, need " + cfg.selfTest.minLevels);

      // Stuck, one board per world: the panel's Undo steps back exactly; its Restart returns to the start.
      const worlds = Array.from(new Set(app.entries.map((e) => e.world)));
      for (const w of worlds) {
        const found = findStuck(app.entries.filter((e) => e.world === w), cfg.selfTest.stuckSeed + w, cfg.selfTest.stuckTries);
        if (!check(found, "world " + w + ": no stuck line found")) continue;
        loadLevel(found.e);
        const g = app.game, start = E.serialize(g.st), pre = E.serialize(E.fromMoves(g.B, found.moves.slice(0, -1)));
        const play = () => { for (const s of found.moves) { const [x, y] = Game.firstTile(g.B, s); tapCell(x, y); tapCell(x, y); } };
        play();
        if (!check(g.st.stuck && !g.st.won, found.e.id + ": not stuck after the stuck line")) continue;
        step(cfg.fx.stuckPanelMs);
        check(app.panel === "stuck", found.e.id + ": no stuck panel");
        out.buttons += checkButtons(check, found.e.id + " stuck");
        $("p-primary").click();
        check(app.panel === null && !g.st.stuck && E.serialize(g.st) === pre, found.e.id + ": panel Undo was not exact");
        const last = Game.firstTile(g.B, found.moves[found.moves.length - 1]);
        tapCell(last[0], last[1]); tapCell(last[0], last[1]); step(cfg.fx.stuckPanelMs);
        check(app.panel === "stuck", found.e.id + ": not stuck again after redo");
        $("p-secondary").click();
        check(app.panel === null && g.st.moves.length === 0 && E.serialize(g.st) === start, found.e.id + ": panel Restart did not reset");
        out.stuck.push(found.e.id);
      }

      // Feedback: an out-of-reach section shakes and flashes what's in the way; a crew at 0 flashes its card.
      let blockedSeen = 0, emptySeen = 0;
      for (const e of app.entries) {
        if (blockedSeen && emptySeen) break;
        loadLevel(e);
        const g = app.game, B = g.B;
        for (let s = 0; s < B.nsec; s++) {
          if (!E.isCrewSection(B, s)) continue;
          const m = B.secMat[s], [x, y] = Game.firstTile(B, s);
          if (!blockedSeen && !g.st.reach[s] && g.st.remaining[m] > 0 && Game.blockers(g, s) > 0) {
            const r = tapCell(x, y);
            check(r === "blocked" && g.fx.flashN > 0 && g.fx.shakeS === s && g.st.moves.length === 0, e.id + ": blocked tap gave " + r);
            blockedSeen = 1;
          } else if (!emptySeen && g.st.remaining[m] <= 0) {
            const r = tapCell(x, y); step(1);
            check(r === "empty" && g.fx.cardM === m && cards[m].classList.contains("flash"), e.id + ": empty tap gave " + r);
            check(tapCrew(CREWS[m]) === "empty", e.id + ": empty card tap did not flash");
            emptySeen = 1;
          }
        }
      }
      check(blockedSeen && emptySeen, "feedback cases not found (blocked " + blockedSeen + ", empty " + emptySeen + ")");

      // One-tap dial: a single tap on a reachable section breaks it.
      cfg.input.twoTap = false;
      loadLevel(app.entries[0]);
      const l0 = app.entries[0].L.line[0];
      check(tapCell(l0[0], l0[1]) === "break", "twoTap=false: one tap did not break");
      cfg.input.twoTap = true;

      // Sprite caches: opaque, and rebuilt after a simulated backing-store drop.
      check(Render.blankTiles(app.V).length === 0, "blank sprite caches: " + Render.blankTiles(app.V).join(","));
      Render.dropCaches(app.V); Render.check(app.V);
      check(Render.blankTiles(app.V).length === 0, "sprite caches not rebuilt after a drop");

      // Save sanitize: junk never throws and is clamped.
      const id0 = app.entries[0].id, junk = [null, 7, "x", [], { stars: [] }, { stars: { [id0]: 9, nope: 3 }, best: { [id0]: -4 }, last: "nope", settings: { muted: "yes" } }];
      for (const j of junk) { let s = null; try { s = Save.sanitize(j, app.ids, cfg.save.maxCrews); } catch (e) { s = null; } check(s && s.v === Save.VERSION, "sanitize threw on " + JSON.stringify(j)); }
      const s5 = Save.sanitize(junk[5], app.ids, cfg.save.maxCrews);
      check(s5.stars[id0] === 3 && !("nope" in s5.stars) && !(id0 in s5.best) && s5.last === null && s5.settings.muted === false, "sanitize did not clamp");
      const ms = Save.memoryStore(); ms.setItem(cfg.save.key, "{not json");
      check(Save.open(ms, cfg.save.key, app.ids, cfg.save.maxCrews).data.v === Save.VERSION, "open() on bad JSON");
    } catch (e) { check(false, "selfTest threw: " + (e && e.stack || e)); }

    // Hand everything back.
    app.testing = false; cfg.input.twoTap = keep.twoTap; app.save = keep.save;
    if (keep.game) mount(keep.entry, keep.game); else { app.game = null; app.entry = null; hidePanel(); }
    if (keep.panel && keep.game) showPanel(keep.panel);
    if (keep.screen === "select") openSelect(); else showScreen(keep.screen);
    out.buttons += checkButtons(check, "restored " + app.screen);
    check(raw() === rawBefore, "the player's stored save changed during selfTest");
    out.ms = Math.round(performance.now() - t0); out.ok = fails.length === 0;
    return out;
  }

  const SP = {
    state, tapCell, tapCrew, undo, restart, selfTest, renderSignature,
    load: (id) => { const e = app.byId.get(String(id)); return e && loadLevel(e) ? state() : null; },
    solve: solveNow,
    tick: (ms) => { step(Math.max(0, Math.min(60000, +ms || 0))); return state(); },
    levels: () => app.entries.map((e) => ({ id: e.id, world: e.world, n: e.n, min: e.L.min, line: e.L.line })),
    cellCenter: (x, y) => Render.cellCenter(app.V, x, y),
    firstTile: (x, y) => { const g = app.game, s = g ? E.sectionAt(g.B, x, y) : -1; return s >= 0 ? Game.firstTile(g.B, s) : null; },
    buttons: () => primaryButtons().map((b) => { const r = b.getBoundingClientRect(); return { id: b.id || b.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }),
    stuckLine: (world) => { const f = findStuck(app.entries.filter((e) => e.world === world), app.cfg.selfTest.stuckSeed + world, app.cfg.selfTest.stuckTries); return f ? { id: f.e.id, taps: f.moves.map((s) => Game.firstTile(E.parse(f.e.L), s)) } : null; },
    blankTiles: () => Render.blankTiles(app.V), dropCaches: () => Render.dropCaches(app.V),
    // Draw cost: n full frames of the current board on the live clock (the layers are cached, as in play). Bounded.
    bench: (n) => {
      const g = app.game; if (!g) return null;
      const k = Math.max(1, Math.min(2000, n | 0)), t0 = performance.now();
      for (let i = 0; i < k; i++) Render.draw(app.V, g, app.clock + i * 16);
      return { frames: k, msPerDraw: (performance.now() - t0) / k, canvas: app.V.canvas.width + "x" + app.V.canvas.height };
    },
  };

  boot();
})();
