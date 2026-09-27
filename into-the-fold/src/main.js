// Into the Fold boot + page glue (SPEC §4, §5, §8). Loads config and levels, owns the DOM (header, HUD, tutorial hint,
// result panel, restart confirm), turns keys and pointer drags into actions for the ONE input facade, act(), which
// feeds game.input(). Runs the frame loop on rAF time and, with ?debug=1, exposes window.ITF.
(function () {
  "use strict";
  const NS = window.IntoTheFold, R = NS.rules, Solver = NS.solver, Daily = NS.daily, Save = NS.save, Game = NS.game, Render = NS.render;
  const CONFIG_V = 2; // config.json's own ?v=; the levels carry config.dataVersion
  const DEBUG = /[?&]debug=1(&|$)/.test(location.search);
  const $ = (id) => document.getElementById(id);
  const KEYS = { ArrowUp: "N", ArrowRight: "E", ArrowDown: "S", ArrowLeft: "W", w: "N", d: "E", s: "S", a: "W", z: "undo", Backspace: "undo", r: "restart" };

  const app = { cfg: null, levels: null, save: null, V: null, game: null, daily: null, tutReplay: false, dateOverride: null,
    now: 0, dirty: true, testing: false, resultShown: false, confirmOpen: false, lastDateCheck: 0, pendingRollover: false,
    drag: null, hudKey: -1, res: { primary: null, secondary: null } };

  function fetchJSON(url) { return fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(url + ": HTTP " + r.status); return r.json(); }); }

  // localStorage, or a memory store when the browser refuses it (private mode, blocked site data).
  function localStore() { try { const s = window.localStorage; s.getItem("intothefold.probe"); return s; } catch (e) { return Save.memoryStore(); } }

  function today() { return app.dateOverride || Daily.localDate(new Date()); }

  // ---- screens -------------------------------------------------------------------------------------------------

  function setGame(g) {
    app.game = g; Game.frame(g, app.now);
    app.resultShown = false; app.confirmOpen = false; app.drag = null;
    $("result").hidden = true; $("confirm").hidden = true;
    app.dirty = true; app.hudKey = -1;
    ui(); layout();
  }

  // Today's daily. The same puzzle number keeps the game in memory, so Help → tutorial → back can't reset the count.
  function openDaily(date) {
    const p = Daily.puzzleFor(date, app.cfg.launchDate, app.levels.daily.pools);
    if (!app.daily || app.daily.meta.n !== p.n) app.daily = Game.create(app.cfg, p.board, { mode: "daily", n: p.n, name: p.name, day: p.day, date: p.date, asked: date, sym: p.sym });
    app.daily.meta.asked = date;
    app.pendingRollover = false;
    setGame(app.daily);
  }

  function openTutorial(i, replay) {
    const b = app.levels.tutorial.boards[i];
    app.tutReplay = replay;
    setGame(Game.create(app.cfg, b, { mode: "tutorial", index: i, hint: b.hint }));
  }

  function finishTutorial() {
    if (!app.save.data.tutorialSeen) { app.save.data.tutorialSeen = true; app.save.write(); }
    openDaily(today());
  }

  // ---- HUD -------------------------------------------------------------------------------------------------------

  function ui() {
    const g = app.game, m = g.meta, tut = m.mode === "tutorial";
    $("title").textContent = m.mode === "daily" ? "#" + m.n + " · " + m.name : tut ? "How to play · " + (m.index + 1) + " of " + app.levels.tutorial.boards.length : "Self-test";
    $("hud-swipes").textContent = "Swipes " + g.swipes;
    $("hud-par").textContent = "Par " + g.par;
    const md = Game.medal(app.cfg, g.swipes, g.par);
    $("hud-target").textContent = md.maxOverPar === null || g.won ? md.emoji : md.emoji + " ≤ " + (g.par + md.maxOverPar);
    $("hint").hidden = !tut;
    if (tut) { $("hint-text").textContent = m.hint || ""; $("btn-skip").textContent = app.tutReplay ? "Back to today" : "Skip"; }
    $("btn-undo").disabled = g.won || g.history.length <= 1;
    $("btn-restart").disabled = g.won || g.history.length <= 1;
    app.hudKey = hudKey(g);
  }

  function hudKey(g) { return g.swipes * 4096 + g.history.length * 2 + (g.won ? 1 : 0); }

  function showResult() {
    const g = app.game, m = g.meta, md = Game.medal(app.cfg, g.swipes, g.par), p = $("res-primary"), s = $("res-secondary");
    app.resultShown = true;
    $("res-medal").textContent = md.emoji;
    $("res-title").textContent = md.name;
    $("res-line").textContent = g.swipes + (g.swipes === 1 ? " swipe" : " swipes") + " · par " + g.par;
    if (m.mode === "tutorial") {
      const last = m.index >= app.levels.tutorial.boards.length - 1;
      if (last && !app.save.data.tutorialSeen) { app.save.data.tutorialSeen = true; app.save.write(); }
      $("res-extra").textContent = last ? "That's the whole idea. Today's flock is waiting." : "";
      p.textContent = last ? "Play today's flock" : "Next";
      app.res.primary = last ? finishTutorial : () => openTutorial(m.index + 1, app.tutReplay);
      s.textContent = "Play again"; s.hidden = false;
      app.res.secondary = () => openTutorial(m.index, app.tutReplay);
    } else {
      // M2 seam: share button, stats histogram, countdown and Practice go here.
      $("res-extra").textContent = "A new flock arrives at midnight.";
      p.textContent = "How to play";
      app.res.primary = () => openTutorial(0, true);
      s.hidden = true; app.res.secondary = null;
    }
    $("result").hidden = false;
    app.dirty = true;
  }

  function askRestart() {
    const g = app.game;
    if (!g || g.won || app.resultShown || app.confirmOpen) return;
    if (g.meta.mode === "daily" && g.swipes > 0 && g.history.length > 1) { app.confirmOpen = true; $("confirm").hidden = false; return; }
    act("restart");
  }

  function closeConfirm(yes) {
    app.confirmOpen = false; $("confirm").hidden = true;
    if (yes) act("restart");
  }

  // ---- THE input facade: keys, pointer swipes, buttons and window.ITF all land here ----------------------------------

  function act(a) {
    const g = app.game;
    if (!g || app.confirmOpen || app.resultShown) return { ignored: true, reason: "panel open" };
    const r = Game.input(g, a);
    app.dirty = true;
    if (!app.testing) ui();
    return r;
  }

  function onKey(e) {
    if (!app.game || e.metaKey || e.ctrlKey || e.altKey) return;
    if (app.confirmOpen) {
      if (e.key === "Escape" || e.key === "n" || e.key === "N") { e.preventDefault(); closeConfirm(false); }
      else if (e.key === "y" || e.key === "Y") { e.preventDefault(); closeConfirm(true); }
      return;
    }
    if (app.resultShown) return;
    const a = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!a) return;
    e.preventDefault();
    if (e.repeat && a !== "undo") return;
    if (a === "restart") askRestart(); else act(a);
  }

  // One swipe per press: the first time the drag passes config.input.swipePx, the dominant axis wins.
  function onDown(e) {
    if (app.resultShown || app.confirmOpen || (e.pointerType === "mouse" && e.button !== 0)) return;
    app.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
    try { $("stage").setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
  }

  function onMove(e) {
    const d = app.drag;
    if (!d || d.id !== e.pointerId || d.fired) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < app.cfg.input.swipePx) return;
    d.fired = true;
    act(ax > ay ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N"));
  }

  function onUp(e) { if (app.drag && app.drag.id === e.pointerId) app.drag = null; }

  function bindInput() {
    window.addEventListener("keydown", onKey);
    const st = $("stage");
    st.addEventListener("pointerdown", onDown);
    st.addEventListener("pointermove", onMove);
    st.addEventListener("pointerup", onUp);
    st.addEventListener("pointercancel", onUp);
    $("btn-undo").addEventListener("click", () => act("undo"));
    $("btn-restart").addEventListener("click", askRestart);
    $("btn-help").addEventListener("click", () => openTutorial(0, app.save.data.tutorialSeen));
    $("btn-skip").addEventListener("click", finishTutorial);
    $("confirm-yes").addEventListener("click", () => closeConfirm(true));
    $("confirm-no").addEventListener("click", () => closeConfirm(false));
    $("res-primary").addEventListener("click", () => { if (app.res.primary) app.res.primary(); });
    $("res-secondary").addEventListener("click", () => { if (app.res.secondary) app.res.secondary(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
    window.addEventListener("focus", wake);
    if (window.ResizeObserver) new ResizeObserver(layout).observe(st); else window.addEventListener("resize", layout);
  }

  // ---- layout, frame loop, date rollover ---------------------------------------------------------------------------

  function layout() {
    if (!app.V || !app.cfg) return;
    const st = $("stage"), css = Math.max(120, Math.floor(Math.min(st.clientWidth, st.clientHeight, app.cfg.board.maxCssPx)));
    Render.resize(app.V, css, Math.min(3, window.devicePixelRatio || 1));
    st.style.setProperty("--bs", css + "px"); // the result/confirm overlays cover the board, not the whole stage
    app.dirty = true;
  }

  function loop(now) { requestAnimationFrame(loop); step(now); }

  // One frame. Also what ITF.tick(now) calls, so a hidden tab (no rAF) can still be driven.
  function step(now) {
    app.now = now;
    const g = app.game;
    if (!g) return;
    const was = Game.animating(g);
    Game.frame(g, now);
    if (app.testing) return;
    if (was || app.dirty) { Render.draw(app.V, g); app.dirty = Game.animating(g); if (hudKey(g) !== app.hudKey) ui(); }
    if (!app.resultShown && Game.resultDue(g)) showResult();
    if (now - app.lastDateCheck >= app.cfg.dateCheckMs) { app.lastDateCheck = now; dateCheck(); }
  }

  // A new local date loads the new daily at once if today's is finished or untouched; a daily in progress keeps
  // going until the page is hidden and shown again (never swapped under a live swipe).
  function dateCheck() {
    if (app.testing || !app.daily || app.game !== app.daily) return;
    const d = today();
    if (d === app.daily.meta.asked) return;
    const p = Daily.puzzleFor(d, app.cfg.launchDate, app.levels.daily.pools);
    if (p.n === app.daily.meta.n) { app.daily.meta.asked = d; return; }
    if (app.daily.won || app.daily.swipes === 0) openDaily(d); else app.pendingRollover = true;
  }

  function wake() {
    if (!app.game || app.testing) return;
    app.dirty = true;
    dateCheck();
    if (app.pendingRollover && app.game === app.daily) openDaily(today());
  }

  // ---- debug handle (?debug=1) -----------------------------------------------------------------------------------

  function snapshot(g) {
    if (!g) return null;
    const m = g.meta;
    return { mode: m.mode, id: g.json.id || null, n: m.n || null, day: m.day || null, name: m.name || null, date: m.date || null, par: g.par,
      swipes: g.swipes, won: g.won, busy: Game.busy(g), queued: g.queue, undoDepth: g.history.length - 1, squares: g.squares,
      resultShown: app.resultShown, sheep: g.state.sheep.map((q) => ({ x: q.x, y: q.y, c: q.c, penned: q.penned })) };
  }

  const ITF = {
    state: () => snapshot(app.game),
    swipe: (dir) => act(dir),
    undo: () => act("undo"),
    restart: () => act("restart"),
    solve: () => Game.solveFrom(app.game, Solver),
    tick: (now) => { step(now == null ? performance.now() : now); return snapshot(app.game); },
    setDate: (s) => {
      if (s != null && Daily.dayNumber(s) === null) throw new Error("setDate wants YYYY-MM-DD or null");
      app.dateOverride = s || null;
      openDaily(today());
      return snapshot(app.game);
    },
    tutorial: (i) => { openTutorial(i | 0, true); return snapshot(app.game); },
    selfTest,
  };

  // Scan baked boards along their solution lines for a state + direction whose swipe matches pred (splash, no-op).
  // Bounded: stops before each line's last swipe, so the found state is never already won.
  function findCase(pools, days, pred) {
    for (const day of days) for (const b of pools[day]) {
      const B = R.parseBoard(b);
      let s = R.initialState(B);
      for (let k = 0; k < b.sol.length; k++) {
        for (const d of R.DIRS) if (pred(R.swipe(B, s, d))) return { board: b, prefix: b.sol.slice(0, k), dir: d };
        s = R.swipe(B, s, b.sol[k]).state;
      }
    }
    return null;
  }

  // SPEC §8 selfTest, M1 scope. Runs on scratch games and a memory save, through ITF.swipe (the player's facade),
  // driven by ITF.tick on a virtual clock, so it needs no rAF. Restores the player's game and checks their save.
  function selfTest() {
    const t0 = performance.now(), cfg = app.cfg, pools = app.levels.daily.pools, failures = [];
    const keep = { game: app.game, save: app.save, resultShown: app.resultShown, confirmOpen: app.confirmOpen };
    const rawSave = () => { try { return keep.save.store.getItem(cfg.save.key); } catch (e) { return "(unreadable)"; } };
    const saveBefore = rawSave(), days = {};
    const fail = (m) => { failures.push(m); };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const xy = (s) => s.sheep.map((q) => q.x + "," + q.y + (q.penned ? "P" : ""));
    let clock = 0, boards = 0, syms = 0;
    const use = (board) => { const g = Game.create(cfg, board, { mode: "test" }); clock += 1000; Game.frame(g, clock); app.game = g; return g; };
    const settle = () => { clock += 2000; ITF.tick(clock); };
    const run = (dirs) => { for (const d of dirs) { ITF.swipe(d); settle(); } };
    app.testing = true; app.resultShown = false; app.confirmOpen = false;
    app.save = Save.open(Save.memoryStore(), cfg.save.key);
    try {
      // 1. The daily picker.
      const L = Daily.dayNumber(cfg.launchDate), p1 = Daily.puzzleFor(cfg.launchDate, cfg.launchDate, pools);
      if (p1.n !== 1 || p1.sym !== 0 || p1.board !== pools[p1.day][0]) fail("daily: launch day should be #1, pool[0], no symmetry");
      const pre = Daily.puzzleFor(Daily.dateString(L - 3), cfg.launchDate, pools);
      if (pre.n !== 1 || pre.board.id !== p1.board.id) fail("daily: a date before launch should play #1");
      const ph = Daily.puzzleFor(Daily.dateString(L + 7 * pools[p1.day].length), cfg.launchDate, pools);
      if (ph.cycle !== 1 || ph.sym === 0 || ph.index !== 0) fail("daily: past the horizon should reuse pool[0] under a non-identity symmetry");
      if (Daily.puzzleFor(Daily.dateString(L + 50), cfg.launchDate, pools).board.id !== Daily.puzzleFor(Daily.dateString(L + 50), cfg.launchDate, pools).board.id) fail("daily: not deterministic");

      // 2. Baked dailies across all 7 weekdays: the in-page solver's line through ITF.swipe wins at exactly par.
      for (let i = 0; i < cfg.selfTest.boards; i++) {
        const p = Daily.puzzleFor(Daily.dateString(L + i * cfg.selfTest.stepDays), cfg.launchDate, pools), b = p.board;
        days[p.day] = (days[p.day] || 0) + 1; if (p.sym) syms++;
        use(b);
        const s = ITF.solve();
        if (!s.solved || s.par !== b.par) { fail(b.id + ": in-page solver par " + s.par + " vs baked " + b.par); continue; }
        run(s.solution);
        const st = ITF.state();
        if (!st.won || st.swipes !== b.par) fail(b.id + ": solver line gave won=" + st.won + " in " + st.swipes + ", par " + b.par);
        const baked = R.play(R.parseBoard(b), b.sol);
        if (!baked.win || baked.swipes !== b.par) fail(b.id + ": baked sol does not win at par");
        boards++;
      }
      if (Object.keys(days).length !== 7) fail("weekdays covered: " + Object.keys(days).join(","));

      // 3. Undo and restart never refund and never count; solve() works on a clone.
      {
        const b = pools.tue[0];
        const g = use(b), start = xy(g.state);
        run(b.sol.slice(0, 1)); const one = ITF.state();
        run(b.sol.slice(1, 2));
        const before = ITF.state(), sv = ITF.solve();
        if (!same(ITF.state(), before)) fail("solve() changed the live game");
        if (!sv.solved || sv.par !== b.par - 2) fail("solve() from mid-game: remaining par " + sv.par + ", want " + (b.par - 2));
        ITF.undo(); settle();
        let st = ITF.state();
        if (st.swipes !== 2 || !same(st.sheep, one.sheep) || st.undoDepth !== 1) fail("undo: should step back one state and keep the count at 2");
        run(b.sol.slice(1, 2)); ITF.restart(); settle(); st = ITF.state();
        if (st.swipes !== 3 || !same(xy(app.game.state), start) || st.undoDepth !== 0) fail("restart: should return to the start and keep the count at 3");
        ITF.undo(); ITF.restart(); settle();
        if (ITF.state().swipes !== 3) fail("undo/restart at the start should cost nothing");
      }

      // 4. A splash counts, logs a splash square, and leaves the board exactly as it was.
      {
        const hit = findCase(pools, ["fri", "sat", "sun"], (r) => r.splash);
        if (!hit) fail("no splash case found in the pond pools");
        else {
          use(hit.board); run(hit.prefix);
          const before = ITF.state(); ITF.swipe(hit.dir); settle(); const st = ITF.state();
          if (st.swipes !== before.swipes + 1) fail("splash should count (" + before.swipes + " -> " + st.swipes + ")");
          if (!same(st.sheep, before.sheep) || st.undoDepth !== before.undoDepth) fail("splash should leave the board unchanged");
          if (st.squares.slice(-1) !== "s") fail("splash should log a splash square");
        }
      }

      // 5. A no-op is free and changes nothing.
      {
        const hit = findCase(pools, ["mon", "wed", "sat"], (r) => r.noop);
        if (!hit) fail("no no-op case found");
        else {
          use(hit.board); run(hit.prefix);
          const before = ITF.state(); ITF.swipe(hit.dir); settle(); const st = ITF.state();
          if (st.swipes !== before.swipes || !same(st.sheep, before.sheep) || st.squares !== before.squares) fail("no-op should not count or change the board");
        }
      }

      // 6. Rapid input: three swipes inside one slide are queued/fast-forwarded, none dropped.
      {
        const b = pools.wed[5], dirs = b.sol.slice(0, 3);
        use(b);
        ITF.swipe(dirs[0]);
        const q = ITF.swipe(dirs[1]);
        if (!q.queued) fail("a swipe during a slide should be queued");
        ITF.swipe(dirs[2]); settle(); settle();
        const want = R.play(R.parseBoard(b), dirs), st = ITF.state();
        if (st.swipes !== want.swipes || !same(xy(app.game.state), xy(want.state))) fail("rapid swipes: expected " + want.swipes + " counted and the rules' board");
      }
    } catch (e) {
      fail("threw: " + (e && e.message));
    } finally {
      app.game = keep.game; app.save = keep.save; app.resultShown = keep.resultShown; app.confirmOpen = keep.confirmOpen;
      app.testing = false; app.dirty = true; app.hudKey = -1;
      if (app.game) ui();
    }
    if (rawSave() !== saveBefore) fail("the player's save changed during selfTest");
    return { pass: failures.length === 0, failures, boards, symmetric: syms, weekdays: days, ms: Math.round(performance.now() - t0) };
  }

  // ---- boot ------------------------------------------------------------------------------------------------------

  function start(levels) {
    app.levels = levels;
    app.save = Save.open(localStore(), app.cfg.save.key);
    app.V = Render.create($("board"));
    bindInput();
    if (app.save.data.tutorialSeen) openDaily(today()); else openTutorial(0, false);
    if (DEBUG) window.ITF = ITF;
    requestAnimationFrame(loop);
  }

  fetchJSON("config.json?v=" + CONFIG_V)
    .then((cfg) => {
      app.cfg = cfg;
      const v = "?v=" + encodeURIComponent(cfg.dataVersion);
      return Promise.all([fetchJSON("levels/daily.json" + v), fetchJSON("levels/tutorial.json" + v)]);
    })
    .then((all) => start({ daily: all[0], tutorial: all[1] }))
    .catch((e) => {
      $("title").textContent = "Couldn't load";
      $("hint").hidden = false; $("hint-text").textContent = "The pasture didn't load. Reload to try again."; $("btn-skip").hidden = true;
      console.warn("Into the Fold boot failed:", e);
    });
})();
