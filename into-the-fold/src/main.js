// Into the Fold boot + page glue (SPEC §2, §4, §5, §8). Loads config and levels, owns the DOM (header, HUD, hint line,
// result panel, stats, menu, restart confirm, toast), turns keys and pointer drags into actions for the ONE input
// facade, act(), which feeds game.input(). Runs the frame loop on rAF time: animation, the game's timed events (sound
// and particles), resume saves, the countdown and the date check all run there. With ?debug=1 it exposes window.ITF.
(function () {
  "use strict";
  const NS = window.IntoTheFold, R = NS.rules, Solver = NS.solver, Daily = NS.daily, Save = NS.save, Game = NS.game, Render = NS.render, Audio = NS.audio;
  const CONFIG_V = 5; // config.json's own ?v=; the levels carry config.dataVersion
  const DEBUG = /[?&]debug=1(&|$)/.test(location.search);
  const $ = (id) => document.getElementById(id);
  const KEYS = { ArrowUp: "N", ArrowRight: "E", ArrowDown: "S", ArrowLeft: "W", w: "N", d: "E", s: "S", a: "W", z: "undo", Backspace: "undo", r: "restart" };

  const app = { cfg: null, levels: null, save: null, limits: null, V: null, A: null, game: null, daily: null, practice: null, tutReplay: false, dateOverride: null,
    now: 0, dirty: true, testing: false, resultShown: false, confirmOpen: false, menuOpen: false, statsOpen: false, lastDateCheck: 0, pendingRollover: false,
    drag: null, hudKey: -1, res: { primary: null, secondary: null }, toastUntil: 0, countdownAt: 0, stopBleats: 0 };

  function fetchJSON(url) { return fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(url + ": HTTP " + r.status); return r.json(); }); }

  // localStorage, or a memory store when the browser refuses it (private mode, blocked site data).
  function localStore() { try { const s = window.localStorage; s.getItem("intothefold.probe"); return s; } catch (e) { return Save.memoryStore(); } }

  function today() { return app.dateOverride || Daily.localDate(new Date()); }

  // ---- screens -------------------------------------------------------------------------------------------------

  function setGame(g) {
    app.game = g; Game.frame(g, app.now);
    app.resultShown = false; app.confirmOpen = false; app.drag = null;
    $("result").hidden = true; $("confirm").hidden = true;
    closeMenu(); closeStats();
    app.dirty = true; app.hudKey = -1;
    ui(); layout();
  }

  function todayN() { return Daily.puzzleFor(today(), app.cfg.launchDate, app.levels.daily.pools).n; }

  // Today's daily. The same puzzle number keeps the game in memory, so Help → tutorial → back can't reset the count.
  // A new game replays the saved action log when it belongs to this puzzle (same #N, same board id): the resume.
  function openDaily(date) {
    const p = Daily.puzzleFor(date, app.cfg.launchDate, app.levels.daily.pools);
    if (!app.daily || app.daily.meta.n !== p.n) {
      const g = Game.create(app.cfg, p.board, { mode: "daily", n: p.n, name: p.name, day: p.day, date: p.date, asked: date, sym: p.sym });
      const r = app.save.data.daily;
      if (r && r.n === p.n && r.id === p.board.id) Game.replay(g, r.log);
      g.now = app.now; g.meta.savedRev = g.rev;
      startHints(g);
      app.daily = g;
      if (g.won && Save.recordDaily(app.save.data.stats, p.n, g.swipes, g.par)) app.save.write();
    }
    app.daily.meta.asked = date;
    app.pendingRollover = false;
    setGame(app.daily);
  }

  // Practice (SPEC §2): unlocked once today's daily is finished; a fixed-order pool with its own index. An unfinished
  // practice board stays in memory, so hopping to the daily and back keeps it.
  function practiceUnlocked() { return !!(app.levels.practice && app.save.data.stats.lastN >= todayN()); }

  function openPractice() {
    if (!practiceUnlocked()) return false;
    const idx = app.save.data.practice.index, boards = app.levels.practice.boards;
    if (!app.practice || app.practice.won || app.practice.meta.index !== idx) {
      app.practice = Game.create(app.cfg, boards[idx % boards.length], { mode: "practice", index: idx, k: idx + 1 });
      startHints(app.practice);
    }
    setGame(app.practice);
    return true;
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

  // ---- first-time element hints (SPEC §2): one line each, once ever -------------------------------------------------
  function elementsOf(B) {
    let mud = false, pond = false;
    for (let c = 0; c < B.n; c++) { if (B.type[c] === R.MUD) mud = true; else if (B.type[c] === R.POND) pond = true; }
    return { mud, black: B.sheep0.some((q) => q.c === "b"), pond };
  }

  // Queue this board's unseen elements; the first shows now, the next after each counted swipe.
  function startHints(g) {
    if (g.won) return;
    const has = elementsOf(g.B);
    g.meta.hintList = Save.HINTS.filter((k) => has[k] && !app.save.data.hints[k]);
    g.meta.hint = "";
    nextHint(g);
  }

  function nextHint(g) {
    const k = g.meta.hintList && g.meta.hintList.shift();
    if (!k) return;
    g.meta.hint = app.cfg.hints[k];
    if (!app.testing) { app.save.data.hints[k] = true; app.save.write(); }
  }

  // ---- HUD -------------------------------------------------------------------------------------------------------

  function titleOf(m) {
    if (m.mode === "daily") return "#" + m.n + " · " + m.name;
    if (m.mode === "practice") return "Practice #" + m.k;
    return m.mode === "tutorial" ? "How to play · " + (m.index + 1) + " of " + app.levels.tutorial.boards.length : "Self-test";
  }

  function ui() {
    const g = app.game, m = g.meta, tut = m.mode === "tutorial";
    $("title").textContent = titleOf(m);
    $("hud-swipes").textContent = "Swipes " + g.swipes;
    $("hud-par").textContent = "Par " + g.par;
    const md = Game.medal(app.cfg, g.swipes, g.par);
    $("hud-target").textContent = md.maxOverPar === null || g.won ? md.emoji : md.emoji + " ≤ " + (g.par + md.maxOverPar);
    const hint = tut || (m.hint && !g.won) ? m.hint || "" : "";
    $("hint").classList.toggle("off", !hint);
    $("hint-text").textContent = hint;
    $("btn-skip").hidden = !tut;
    if (tut) $("btn-skip").textContent = app.tutReplay ? "Back to today" : "Skip";
    $("btn-undo").disabled = g.won || g.history.length <= 1;
    $("btn-restart").disabled = g.won || g.history.length <= 1;
    app.hudKey = hudKey(g);
  }

  function hudKey(g) { return g.swipes * 4096 + g.history.length * 2 + (g.won ? 1 : 0); }

  function showResult() {
    const g = app.game, m = g.meta, md = Game.medal(app.cfg, g.swipes, g.par), p = $("res-primary"), s = $("res-secondary");
    app.resultShown = true;
    closeMenu(); closeStats();
    $("res-medal").textContent = md.emoji;
    $("res-title").textContent = m.mode === "practice" ? "Practice #" + m.k + " · " + md.name : md.name;
    $("res-line").textContent = g.swipes + (g.swipes === 1 ? " swipe" : " swipes") + " · par " + g.par;
    $("res-share").hidden = m.mode !== "daily";
    $("res-stats").hidden = m.mode !== "daily";
    p.hidden = false; s.hidden = false;
    if (m.mode === "daily") {
      fillStats($("res-stats"), Save.bucket(g.swipes - g.par, app.cfg.stats.buckets));
      dailyFooter();
      s.hidden = true; app.res.secondary = null;
    } else if (m.mode === "practice") {
      $("res-extra").textContent = "Practice never touches your streak.";
      p.textContent = "Next practice"; p.className = "primary";
      app.res.primary = () => openPractice() || openDaily(today()); // relocked after a midnight rollover: go to today
      s.textContent = "Back to today";
      app.res.secondary = () => openDaily(today());
    } else if (m.mode === "tutorial") {
      p.className = "primary";
      const last = m.index >= app.levels.tutorial.boards.length - 1;
      if (last && !app.save.data.tutorialSeen) { app.save.data.tutorialSeen = true; app.save.write(); }
      $("res-extra").textContent = last ? "That's the whole idea. Today's flock is waiting." : "";
      p.textContent = last ? "Play today's flock" : "Next";
      app.res.primary = last ? finishTutorial : () => openTutorial(m.index + 1, app.tutReplay);
      s.textContent = "Play again"; s.hidden = false;
      app.res.secondary = () => openTutorial(m.index, app.tutReplay);
    } else {
      $("res-extra").textContent = "";
      p.hidden = true; s.hidden = true; app.res.primary = null; app.res.secondary = null;
    }
    $("result").hidden = false;
    app.dirty = true;
  }

  // The daily result's footer: the countdown and Practice, or, once the date has rolled over under a finished daily,
  // "A new flock is ready." and a Today's flock button (the result and its Share stay up until the player leaves).
  function dailyFooter() {
    const p = $("res-primary");
    if (app.pendingRollover) {
      $("res-extra").textContent = "A new flock is ready.";
      p.textContent = "Today's flock"; p.className = "primary"; p.hidden = false;
      app.res.primary = () => openDaily(today());
      return;
    }
    countdown(true);
    p.textContent = "Practice"; p.className = ""; p.hidden = !practiceUnlocked();
    app.res.primary = openPractice;
  }

  // "Next flock in 4:12:09", refreshed once a second from the frame loop while a daily result is up. At midnight it
  // hands over to the date check at once, so it never shows a fresh 24 hours for the day that just ended.
  function countdown(force) {
    if (!force && app.now < app.countdownAt) return;
    if (today() !== app.daily.meta.asked) { dateCheck(); if (app.pendingRollover) return; }
    app.countdownAt = app.now + 1000;
    const t = Math.max(0, Math.floor(Daily.msToMidnight(new Date()) / 1000)), p2 = (v) => (v < 10 ? "0" : "") + v;
    $("res-extra").textContent = "Next flock in " + Math.floor(t / 3600) + ":" + p2(Math.floor(t / 60) % 60) + ":" + p2(t % 60);
  }

  // ---- stats (SPEC §2) --------------------------------------------------------------------------------------------
  // Tiles (played, streak, max streak, par-or-better %) and a histogram of swipes over par; `hl` marks a bucket.
  function fillStats(el, hl) {
    const st = app.save.data.stats, labels = app.cfg.stats.labels, played = Save.played(st);
    let max = 1;
    for (let k = 0; k < st.hist.length; k++) if (st.hist[k] > max) max = st.hist[k];
    const tile = (v, l) => "<div><b>" + v + "</b><span>" + l + "</span></div>";
    let h = "<div class=\"tiles\">" + tile(played, "Played") + tile(Save.streakNow(st, todayN()), "Streak") + tile(st.maxStreak, "Max streak") + tile(played ? Save.parPct(st) + "%" : "–", "Par or better") + "</div><div class=\"hist\">";
    for (let k = 0; k < st.hist.length; k++) {
      const pct = Math.round((88 * st.hist[k]) / max);
      h += "<div class=\"col" + (k === hl ? " hl" : "") + "\"><span class=\"n\">" + st.hist[k] + "</span><i style=\"height:" + pct + "%\"></i><span class=\"l\">" + labels[k] + "</span></div>";
    }
    el.innerHTML = h + "</div><div class=\"hist-cap\">Swipes over par</div>";
  }

  function openStats() {
    closeMenu();
    if (app.confirmOpen) return;
    fillStats($("stats-body"), -1);
    $("stats-note").textContent = Save.played(app.save.data.stats) ? "" : "Finish a daily flock to start your stats.";
    app.statsOpen = true; $("stats").hidden = false;
  }

  function closeStats() { app.statsOpen = false; $("stats").hidden = true; }

  // ---- share (SPEC §2): the share sheet on touch devices, otherwise the clipboard and a "Copied" toast ------------
  function shareTextFor(g) { return Game.shareText(app.cfg, g.meta.n, g.swipes, g.par, g.squares); }

  function share() {
    const g = app.daily;
    if (!g || !g.won) return;
    const text = shareTextFor(g), touch = window.matchMedia && matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.share) navigator.share({ text }).catch((e) => { if (!e || e.name !== "AbortError") copy(text); });
    else copy(text);
  }

  function copy(text) {
    const done = (ok) => toast(ok ? "Copied" : "Couldn't copy");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(legacyCopy(text)));
    else done(legacyCopy(text));
  }

  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  // The toast hides on frame time (never a setTimeout).
  function toast(msg) { $("toast").textContent = msg; $("toast").hidden = false; app.toastUntil = app.now + app.cfg.share.toastMs; }

  // ---- menu ------------------------------------------------------------------------------------------------------
  function openMenu() {
    if (app.confirmOpen) return;
    const inPractice = app.game && app.game.meta.mode !== "daily";
    $("menu-sound").textContent = "Sound: " + (app.save.data.sound ? "on" : "off");
    $("menu-practice").hidden = !practiceUnlocked() || (app.game && app.game.meta.mode === "practice");
    $("menu-today").hidden = !inPractice && !app.pendingRollover;
    const b = $("btn-menu").getBoundingClientRect(), a = $("app").getBoundingClientRect();
    $("menu").firstElementChild.style.top = Math.round(b.bottom - a.top + 6) + "px"; // just under the button
    app.menuOpen = true; $("menu").hidden = false; $("btn-menu").setAttribute("aria-expanded", "true");
  }

  function closeMenu() { app.menuOpen = false; $("menu").hidden = true; $("btn-menu").setAttribute("aria-expanded", "false"); }

  function toggleSound() {
    app.save.data.sound = !app.save.data.sound; app.save.write();
    app.A.on = app.save.data.sound;
    $("menu-sound").textContent = "Sound: " + (app.save.data.sound ? "on" : "off");
  }

  // ---- saves: the daily's resume on every effective action, the result the moment the win commits ----------------
  function persist() {
    if (app.testing) return;
    const g = app.game;
    if (g === app.daily && g.rev !== g.meta.savedRev) {
      g.meta.savedRev = g.rev;
      const d = app.save.data;
      if (g.log.length <= app.limits.maxLog) d.daily = { n: g.meta.n, id: g.json.id, log: g.log };
      if (g.won) Save.recordDaily(d.stats, g.meta.n, g.swipes, g.par);
      app.save.write();
    } else if (g === app.practice && g.won && !g.meta.counted) {
      g.meta.counted = true;
      app.save.data.practice.index = Math.max(app.save.data.practice.index, g.meta.index + 1);
      app.save.write();
    }
  }

  // ---- the game's timed events: sound (through Audio.play, which counts every call) and particles ----------------
  function onEvent(type, i, x, y) {
    const g = app.game, A = app.A, C = app.cfg.audio;
    if (type === Game.EV_SWIPE) { Audio.play(A, "whistle"); app.stopBleats = 0; }
    else if (type === Game.EV_STOP) {
      if (app.stopBleats++ < C.bleat.maxPerSwipe) Audio.play(A, "bleat", g.state.sheep[i].c);
      if (!app.testing) Render.spawn(app.V, "stop", x, y, app.now);
    } else if (type === Game.EV_PEN) {
      Audio.play(A, "bleat", g.state.sheep[i].c, 1.12); Audio.play(A, "latch");
      if (!app.testing) Render.spawn(app.V, "pen", x, y, app.now);
    } else if (type === Game.EV_SPLASH) {
      Audio.play(A, "splash");
      if (!app.testing) Render.spawn(app.V, "splash", x, y, app.now);
    } else if (type === Game.EV_WIN) {
      Audio.play(A, "win");
      if (!app.testing) for (const p of g.B.pens) Render.spawn(app.V, "win", p.x, p.y, app.now);
    }
  }

  function askRestart() {
    const g = app.game;
    if (!g || g.won || app.resultShown || app.confirmOpen || app.menuOpen || app.statsOpen) return;
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
    if (!g || app.confirmOpen || app.resultShown || app.menuOpen || app.statsOpen) return { ignored: true, reason: "panel open" };
    const before = g.swipes, r = Game.input(g, a);
    if (g.swipes > before && g.meta.hintList && g.meta.hintList.length) nextHint(g);
    app.dirty = true;
    persist();
    if (!app.testing) ui();
    return r;
  }

  function onKey(e) {
    if (!app.game || e.metaKey || e.ctrlKey || e.altKey) return;
    if (app.menuOpen || app.statsOpen) {
      if (e.key === "Escape") { e.preventDefault(); closeMenu(); closeStats(); }
      return;
    }
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
    if (app.resultShown || app.confirmOpen || app.menuOpen || app.statsOpen || (e.pointerType === "mouse" && e.button !== 0)) return;
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
    $("btn-menu").addEventListener("click", () => (app.menuOpen ? closeMenu() : openMenu()));
    $("menu").addEventListener("click", (e) => { if (e.target === $("menu")) closeMenu(); });
    document.addEventListener("click", (e) => { if (app.menuOpen && !$("app").contains(e.target)) closeMenu(); }); // desktop: outside the column
    $("menu-stats").addEventListener("click", openStats);
    $("menu-help").addEventListener("click", () => openTutorial(0, app.save.data.tutorialSeen));
    $("menu-sound").addEventListener("click", toggleSound);
    $("menu-practice").addEventListener("click", openPractice);
    $("menu-today").addEventListener("click", () => openDaily(today()));
    $("stats-close").addEventListener("click", closeStats);
    $("btn-skip").addEventListener("click", finishTutorial);
    $("confirm-yes").addEventListener("click", () => closeConfirm(true));
    $("confirm-no").addEventListener("click", () => closeConfirm(false));
    $("res-share").addEventListener("click", share);
    $("res-primary").addEventListener("click", () => { if (app.res.primary) app.res.primary(); });
    $("res-secondary").addEventListener("click", () => { if (app.res.secondary) app.res.secondary(); });
    // Audio unlocks inside the first gesture (and again if the OS suspended it).
    for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, () => Audio.unlock(app.A), true);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
    window.addEventListener("pageshow", wake);
    window.addEventListener("focus", wake);
    if (window.ResizeObserver) { const ro = new ResizeObserver(layout); ro.observe($("app")); ro.observe($("hint")); } else window.addEventListener("resize", layout);
  }

  // ---- layout, frame loop, date rollover ---------------------------------------------------------------------------

  // The stage is exactly the board's height and the column is centred, so the free height frames the column instead
  // of opening bands between the hint, the board and the buttons. The board gets the stage's width and whatever
  // height the column leaves (the app's inner height minus everything but the stage).
  function layout() {
    if (!app.V || !app.cfg) return;
    const st = $("stage"), el = $("app"), cs = getComputedStyle(el);
    const inner = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const used = $("toolbar").getBoundingClientRect().bottom - $("top").getBoundingClientRect().top;
    const css = Math.max(120, Math.floor(Math.min(st.clientWidth, st.clientHeight + inner - used, app.cfg.board.maxCssPx)));
    Render.resize(app.V, css, Math.min(3, window.devicePixelRatio || 1));
    st.style.setProperty("--bs", css + "px"); // the stage's height and the restart confirm's size
    app.dirty = true;
  }

  function loop(now) { requestAnimationFrame(loop); step(now); }

  // One frame. Also what ITF.tick(now) calls, so a hidden tab (no rAF) can still be driven.
  function step(now) {
    app.now = now;
    const g = app.game;
    if (!g) return;
    const was = Game.animating(g) || Render.busy(app.V, g.now);
    Game.frame(g, now);
    Game.drain(g, g.now, onEvent);
    if (app.testing) return;
    persist();
    if (was || app.dirty) { Render.draw(app.V, g); app.dirty = Game.animating(g) || Render.busy(app.V, g.now); if (hudKey(g) !== app.hudKey) ui(); }
    if (!app.resultShown && Game.resultDue(g)) showResult();
    if (app.resultShown && g === app.daily && !app.pendingRollover) countdown(false);
    if (app.toastUntil && now >= app.toastUntil) { app.toastUntil = 0; $("toast").hidden = true; }
    if (now - app.lastDateCheck >= app.cfg.dateCheckMs) { app.lastDateCheck = now; dateCheck(); }
  }

  // A new local date loads the new daily at once only if today's is untouched. A daily in progress keeps going, and a
  // finished one keeps its result (and its Share) up, until the page is hidden and shown again or the player leaves
  // the result. Never swapped under a live swipe, and never between a win and its result.
  function dateCheck() {
    if (app.testing || !app.daily || app.game !== app.daily) return;
    const d = today();
    if (d === app.daily.meta.asked) return;
    const p = Daily.puzzleFor(d, app.cfg.launchDate, app.levels.daily.pools);
    if (p.n === app.daily.meta.n) { app.daily.meta.asked = d; return; }
    if (app.daily.swipes === 0) { openDaily(d); return; }
    if (app.pendingRollover) return;
    app.pendingRollover = true;
    if (app.resultShown) dailyFooter();
  }

  // A finished daily whose result hasn't shown yet (the win's flock jump is still playing).
  function resultPending() { return app.game === app.daily && app.daily.won && !app.resultShown; }

  // Back from the background (visibilitychange, pageshow, focus): re-check the sprite caches, then the date.
  function wake() {
    if (!app.game || app.testing) return;
    app.dirty = true;
    if (Render.check(app.V)) app.cacheRebuilds = (app.cacheRebuilds || 0) + 1;
    dateCheck();
    if (app.pendingRollover && app.game === app.daily && !resultPending()) openDaily(today());
  }

  // ---- debug handle (?debug=1) -----------------------------------------------------------------------------------

  function snapshot(g) {
    if (!g) return null;
    const m = g.meta;
    return { mode: m.mode, id: g.json.id || null, n: m.n || null, k: m.k || null, day: m.day || null, name: m.name || null, date: m.date || null, par: g.par,
      swipes: g.swipes, won: g.won, busy: Game.busy(g), queued: g.queue, undoDepth: g.history.length - 1, squares: g.squares, log: g.log,
      hint: (!g.won && m.hint) || null, resultShown: app.resultShown, sheep: g.state.sheep.map((q) => ({ x: q.x, y: q.y, c: q.c, penned: q.penned })) };
  }

  function statsSnapshot() {
    const st = app.save.data.stats;
    return { played: Save.played(st), streak: Save.streakNow(st, todayN()), streakStored: st.streak, maxStreak: st.maxStreak, parPct: Save.parPct(st), hist: st.hist.slice(), lastN: st.lastN,
      practiceIndex: app.save.data.practice.index, practiceUnlocked: practiceUnlocked() };
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
    practice: () => (openPractice() ? snapshot(app.game) : { locked: true }),
    today: () => { openDaily(today()); return snapshot(app.game); },
    stats: statsSnapshot,
    shareText: () => (app.daily && app.daily.won ? shareTextFor(app.daily) : null),
    audioCalls: () => Object.assign({}, app.A.calls),
    dropCaches: () => { Render.dropCaches(app.V); return true; },
    cacheRebuilds: () => app.cacheRebuilds || 0,
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

  // SPEC §8 selfTest. Runs on scratch games and a memory save, through ITF.swipe (the player's facade), driven by
  // ITF.tick on a virtual clock, so it needs no rAF. Sound is silenced (the hook still counts). Restores the player's
  // game and checks their save is byte-identical.
  function selfTest() {
    const t0 = performance.now(), cfg = app.cfg, pools = app.levels.daily.pools, failures = [];
    const keep = { game: app.game, save: app.save, practice: app.practice, resultShown: app.resultShown, confirmOpen: app.confirmOpen, silent: app.A.silent,
      daily: app.daily, dateOverride: app.dateOverride, pendingRollover: app.pendingRollover, lastDateCheck: app.lastDateCheck, now: app.now };
    const rawSave = () => { try { return keep.save.store.getItem(cfg.save.key); } catch (e) { return "(unreadable)"; } };
    const saveBefore = rawSave(), days = {};
    const fail = (m) => { failures.push(m); };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const xy = (s) => s.sheep.map((q) => q.x + "," + q.y + (q.penned ? "P" : ""));
    let clock = 0, boards = 0, syms = 0;
    const use = (board) => { const g = Game.create(cfg, board, { mode: "test" }); clock += 1000; Game.frame(g, clock); app.game = g; return g; };
    const settle = () => { clock += 2000; ITF.tick(clock); };
    const run = (dirs) => { for (const d of dirs) { ITF.swipe(d); settle(); } };
    const calls = () => Object.assign({}, app.A.calls);
    app.testing = true; app.resultShown = false; app.confirmOpen = false; app.A.silent = true;
    app.save = Save.open(Save.memoryStore(), cfg.save.key, app.limits);
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
      //    The audio hook fires on this real swipe path: a whistle per swipe, a latch per penned sheep, a win jingle.
      const heard0 = calls();
      let swiped = 0, penned = 0;
      for (let i = 0; i < cfg.selfTest.boards; i++) {
        const p = Daily.puzzleFor(Daily.dateString(L + i * cfg.selfTest.stepDays), cfg.launchDate, pools), b = p.board;
        days[p.day] = (days[p.day] || 0) + 1; if (p.sym) syms++;
        use(b);
        const s = ITF.solve();
        if (!s.solved || s.par !== b.par) { fail(b.id + ": in-page solver par " + s.par + " vs baked " + b.par); continue; }
        run(s.solution);
        const st = ITF.state();
        if (!st.won || st.swipes !== b.par) fail(b.id + ": solver line gave won=" + st.won + " in " + st.swipes + ", par " + b.par);
        swiped += st.swipes; penned += st.sheep.length;
        const baked = R.play(R.parseBoard(b), b.sol);
        if (!baked.win || baked.swipes !== b.par) fail(b.id + ": baked sol does not win at par");
        boards++;
      }
      if (Object.keys(days).length !== 7) fail("weekdays covered: " + Object.keys(days).join(","));
      {
        const h = calls(), d = (k) => h[k] - heard0[k];
        if (d("whistle") !== swiped || d("latch") !== penned || d("win") !== boards || d("bleat") < penned) fail("audio hook: whistle " + d("whistle") + "/" + swiped + ", latch " + d("latch") + "/" + penned + ", win " + d("win") + "/" + boards);
      }

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

      // 7. Share text: only the header, the squares (<= perRow a row, one per counted swipe incl. splashes and undone
      //    ones) and the URL. Played for real (a splash, an undo, then the solver's line), so squares come from play.
      {
        const hit = findCase(pools, ["fri", "sat", "sun"], (r) => r.splash);
        use(hit.board); run(hit.prefix); ITF.swipe(hit.dir); settle(); ITF.undo(); settle();
        run(ITF.solve().solution);
        app.game.meta.n = 12;
        const st = ITF.state(), text = shareTextFor(app.game);
        const sq = "(?:🟩|⬜|🟦)", url = cfg.share.url.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), md = Game.medal(cfg, st.swipes, st.par).emoji;
        const re = new RegExp("^" + cfg.share.title + " #12 " + cfg.share.mark + " " + st.swipes + "/" + st.par + " " + md + "\n(?:" + sq + "{" + cfg.share.perRow + "}\n)*" + sq + "{1," + cfg.share.perRow + "}\n" + url + "$", "u");
        const squares = (text.match(/🟩|⬜|🟦/gu) || []).length;
        if (!st.won || !re.test(text)) fail("share text is not header + squares + URL only:\n" + text);
        if (squares !== st.swipes || text.indexOf("🟦") < 0) fail("share: " + squares + " squares for " + st.swipes + " swipes (splash included?)");
        if (/[NESW]{2}/.test(text.replace(cfg.share.title, "")) || text.indexOf(hit.board.sol) >= 0) fail("share text looks like it carries directions");
      }

      // 8. Resume: the action log replays to the same swipes, squares, undo depth and board.
      {
        const b = pools.thu[3];
        const g = use(b); run(b.sol.slice(0, 3)); ITF.undo(); settle(); run(b.sol.slice(2, 4));
        const saved = Save.sanitize(JSON.parse(JSON.stringify({ daily: { n: 9, id: b.id, log: g.log } })), app.limits).daily;
        const g2 = Game.create(cfg, b, { mode: "test" });
        Game.replay(g2, saved.log);
        if (!saved || g2.swipes !== g.swipes || g2.squares !== g.squares || g2.history.length !== g.history.length || !same(xy(g2.state), xy(g.state))) fail("resume replay differs from the live game");
      }

      // 9. Stats: streak over consecutive puzzle numbers, histogram buckets, no double count; practice never touches it.
      {
        const st = Save.fresh(app.limits).stats, B = cfg.stats.buckets;
        Save.recordDaily(st, 5, 7, 7); Save.recordDaily(st, 6, 9, 7);
        const again = Save.recordDaily(st, 6, 7, 7);
        Save.recordDaily(st, 9, 20, 7);
        if (again || !same(st.hist, [1, 0, 1, 0, 0, 1].slice(0, B)) || st.streak !== 1 || st.maxStreak !== 2 || Save.streakNow(st, 10) !== 1 || Save.streakNow(st, 11) !== 0 || Save.parPct(st) !== 33) fail("stats maths: " + JSON.stringify(st));
        const before = JSON.stringify(app.save.data.stats), g = use(pools.mon[1]);
        g.meta.mode = "practice"; g.meta.index = 4; app.practice = g;
        run(pools.mon[1].sol);
        app.testing = false; persist(); app.testing = true;
        app.practice = keep.practice;
        if (JSON.stringify(app.save.data.stats) !== before || app.save.data.practice.index !== 5) fail("practice finish should bump only the practice index");
      }

      // 10. A corrupted save loads sanitized: every number clamped, a bad log dropped.
      {
        const s = Save.sanitize({ tutorialSeen: 1, sound: "x", hints: { mud: "y", pond: true }, stats: { hist: [-5, 1e99, "7", NaN, 2.7], streak: 99, maxStreak: 3, lastN: 4 }, daily: { n: 3, id: "x", log: "NESQ" }, practice: { index: -4 } }, app.limits);
        if (s.tutorialSeen || !s.sound || s.hints.mud || !s.hints.pond || !same(s.stats.hist, [0, app.limits.maxCount, 0, 0, 2, 0]) || s.stats.maxStreak !== 3 || s.stats.streak !== 3 || s.daily !== null || s.practice.index !== 0) fail("sanitize: " + JSON.stringify(s));
      }

      // 11. The sprite caches read non-blank.
      if (app.V.B && Render.check(app.V)) fail("render caches read blank");

      // 12. A daily won just after local midnight (the M2 critic's repro). The live page path runs here (testing
      //     off, still on the memory save, silent): play #6 to one swipe short, roll the date to #7, then win. The
      //     frame loop's date check and a page show must not swap #6 out before or under its result; the result
      //     shows with its Share, the stats count #6, and leaving the result is what opens #7.
      {
        const d6 = Daily.dateString(L + 5), d7 = Daily.dateString(L + 6);
        app.testing = false; app.daily = null; app.pendingRollover = false; app.resultShown = false; app.lastDateCheck = -1e9;
        app.dateOverride = d6; openDaily(today());
        const g = app.game, sol = ITF.solve().solution;
        run(sol.slice(0, -1));
        app.dateOverride = d7; clock += 1500; ITF.tick(clock);
        if (app.game !== g || !app.pendingRollover) fail("rollover: an unfinished daily should keep going past midnight");
        ITF.swipe(sol[sol.length - 1]);
        let swapped = false, shownAt = -1;
        for (let k = 0; k < 20 && shownAt < 0; k++) {
          clock += 200; ITF.tick(clock);
          if (k === 1) wake(); // the page shown again while the result is still pending
          if (app.game !== g) swapped = true;
          if (app.resultShown) shownAt = k;
        }
        const share = ITF.shareText() || "";
        if (swapped || shownAt < 0 || app.game !== g) fail("rollover: the #6 win was swapped out before its result (shown " + shownAt + ")");
        if (share.indexOf(cfg.share.title + " #6 ") !== 0 || $("res-share").hidden) fail("rollover: #6's Share should be up on its result: " + JSON.stringify(share));
        if (app.save.data.stats.lastN !== 6 || $("res-primary").hidden || $("res-primary").textContent !== "Today's flock") fail("rollover: stats lastN " + app.save.data.stats.lastN + ", result button '" + $("res-primary").textContent + "'");
        clock += 3000; ITF.tick(clock);
        if (app.game !== g || !app.resultShown) fail("rollover: the result should stay up until the player leaves it");
        $("res-primary").click();
        if (app.game.meta.n !== 7 || app.resultShown || app.pendingRollover) fail("rollover: leaving the result should open #7, got #" + app.game.meta.n);
        app.testing = true;
      }
    } catch (e) {
      fail("threw: " + (e && e.message));
    } finally {
      app.save = keep.save; app.confirmOpen = false; app.A.silent = keep.silent;
      app.practice = keep.practice; app.daily = keep.daily; app.dateOverride = keep.dateOverride; app.pendingRollover = keep.pendingRollover;
      app.lastDateCheck = keep.lastDateCheck; app.countdownAt = 0; app.now = keep.now; app.testing = false;
      Render.clearFx(app.V);
      if (keep.game) { setGame(keep.game); if (keep.resultShown) showResult(); if (keep.confirmOpen) { app.confirmOpen = true; $("confirm").hidden = false; } }
    }
    if (rawSave() !== saveBefore) fail("the player's save changed during selfTest");
    return { pass: failures.length === 0, failures, boards, symmetric: syms, weekdays: days, ms: Math.round(performance.now() - t0) };
  }

  // ---- boot ------------------------------------------------------------------------------------------------------

  function start(levels) {
    app.levels = levels;
    app.limits = Object.assign({ buckets: app.cfg.stats.buckets }, app.cfg.save.limits);
    app.save = Save.open(localStore(), app.cfg.save.key, app.limits);
    app.V = Render.create($("board"), app.cfg);
    app.A = Audio.create(app.cfg.audio); app.A.on = app.save.data.sound;
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
    .then((all) => {
      start({ daily: all[0], tutorial: all[1], practice: null });
      // Practice is only needed after today's daily, so it loads behind the first board.
      return fetchJSON("levels/practice.json?v=" + encodeURIComponent(app.cfg.dataVersion)).then((pr) => { app.levels.practice = pr; }, (e) => console.warn("Into the Fold: practice pool didn't load", e));
    })
    .catch((e) => {
      $("title").textContent = "Couldn't load";
      $("hint").hidden = false; $("hint-text").textContent = "The pasture didn't load. Reload to try again."; $("btn-skip").hidden = true;
      console.warn("Into the Fold boot failed:", e);
    });
})();
