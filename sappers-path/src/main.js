// Sapper's Path page (SPEC §4-§7): boot, screens (title, world map, play; the flat level select under ?debug=1 only),
// layout, input, the show (show.js) and its sounds, the win/stuck panel, save, the frame loop, and the ?debug=1 facade
// (window.SP) with selfTest. The rules live in engine.js, the pick/feedback logic in game.js, the art in art.js, the
// board drawing in render.js, the synth in audio.js.
//
// Clock: app.clock is sim time in ms. The rAF loop advances it by the real frame delta (capped at config.fx.maxDtMs);
// SP.tick(ms) advances it by hand, so a hidden tab (no rAF) can still be driven. Shows, panels, star reveals, the chest
// fly and card bumps all run on this clock; nothing here uses setTimeout or setInterval.
(function () {
  "use strict";
  const NS = window.SappersPath, E = NS.engine, Solver = NS.solver, Save = NS.save, Game = NS.game, Render = NS.render;
  const Art = NS.art, Show = NS.show, Audio = NS.audio;
  const V_ = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const CREWS = E.CREWS, $ = (id) => document.getElementById(id);
  const cards = Array.from(document.querySelectorAll(".crew")), togMute = Array.from(document.querySelectorAll(".tog-mute")), togFast = Array.from(document.querySelectorAll(".tog-fast"));
  const app = { cfg: null, entries: [], byId: new Map(), ids: new Set(), byWorld: new Map(), worldOrder: [], worldName: new Map(), save: null, entry: null, game: null, V: null,
    show: null, prevSt: null, audio: null, clock: 0, lastT: 0, hold: false, screen: "title", panel: null, panelAt: -1, panelT: 0, starsWon: 0, starsShown: 0,
    pact: {}, dirty: true, testing: false, cardFlash: -1, cacheRebuilds: 0, pending: [0, 0, 0, 0], bumpT: [-1e12, -1e12, -1e12, -1e12],
    fly: { on: false, m: 0, t0: 0, t1: 1, x0: 0, y0: 0, x1: 0, y1: 0 }, nudgeT: -1e12, nudged: false, bannerF: -1, titleF: -1, hintDone: new Set(), mapCards: [] };

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
    app.audio = Audio.create(app.cfg.audio);
    setMuted(app.save.data.settings.muted, false); setFast(app.save.data.settings.fast, false);
    drawCardIcons(); buildMap(); buildSelect(); wire(); layout();
    showScreen("title");
    if (DEBUG) { window.SP = SP; $("btn-debug").hidden = false; }
    requestAnimationFrame(frame);
  }

  // Levels come from levels.json as worlds[].levels[]; nothing here knows their ids or counts. A level that fails to
  // parse is skipped, never fatal.
  function indexLevels(lv) {
    const worlds = lv && Array.isArray(lv.worlds) ? lv.worlds : [];
    worlds.forEach((w, wi) => {
      const list = w && Array.isArray(w.levels) ? w.levels : [], wn = (w.world | 0) || wi + 1;
      if (!app.byWorld.has(wn)) { app.byWorld.set(wn, []); app.worldOrder.push(wn); app.worldName.set(wn, w.name || ""); }
      list.forEach((L) => {
        try { E.parse(L); } catch (e) { return; }
        const id = String(L.id);
        if (app.byId.has(id)) return;
        const inW = app.byWorld.get(wn), entry = { L, id, world: wn, worldName: w.name || "", n: inW.length + 1, idx: app.entries.length, btn: null, node: null };
        app.entries.push(entry); app.byId.set(id, entry); app.ids.add(id); inW.push(entry);
      });
    });
  }

  function storage() { try { const s = window.localStorage; s.getItem("sappers-path.probe"); return s; } catch (e) { return Save.memoryStore(); } }

  // Crew cards show the same pixel icon as the board badges, on a disc of the material's colour.
  function drawCardIcons() {
    const A = app.cfg.art;
    for (const b of cards) {
      const m = +b.dataset.m, c = b.querySelector(".ico"), g = c.getContext("2d"), r = c.width / 2;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = A.ink; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = A[Render.MATS[m]][0]; g.beginPath(); g.arc(r, r, r * 0.9, 0, Math.PI * 2); g.fill();
      g.fillStyle = A.badge[0]; g.beginPath(); g.arc(r, r, r * 0.74, 0, Math.PI * 2); g.fill();
      Render.icon(g, m, r, r, r * 0.5, A.badge[1]);
    }
  }

  function wire() {
    $("board").addEventListener("pointerdown", onBoardDown);
    for (const b of cards) b.addEventListener("click", () => tapCrew(CREWS[+b.dataset.m]));
    $("btn-undo").addEventListener("click", () => undo());
    $("btn-restart").addEventListener("click", () => restart());
    $("btn-menu").addEventListener("click", () => { cue("ui"); openMap(); });
    $("btn-play").addEventListener("click", () => { cue("ui"); openMap(); });
    $("btn-home").addEventListener("click", () => { cue("ui"); showScreen("title"); });
    $("btn-debug").addEventListener("click", () => { cue("ui"); openSelect(); });
    $("btn-back").addEventListener("click", () => { cue("ui"); openMap(); });
    $("btn-hint").addEventListener("click", dismissHint);
    for (const b of togMute) b.addEventListener("click", () => { setMuted(!app.audio.muted, true); cue("ui"); });
    for (const b of togFast) b.addEventListener("click", () => { setFast(!app.save.data.settings.fast, true); cue("ui"); });
    for (const k of ["primary", "secondary", "third"]) $("p-" + k).addEventListener("click", () => { if (app.pact[k]) { cue("ui"); app.pact[k](); } });
    window.addEventListener("keydown", onKey);
    // The audio context may only start inside a user gesture: make it on the first one.
    const unlock = () => Audio.unlock(app.audio);
    document.addEventListener("pointerdown", unlock, true); document.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
    window.addEventListener("pageshow", wake);
    if (window.ResizeObserver) new ResizeObserver(layout).observe($("app")); else window.addEventListener("resize", layout);
  }

  // ---- settings ------------------------------------------------------------------------------------------------------
  function setMuted(on, persist) {
    Audio.setMuted(app.audio, on);
    for (const b of togMute) { b.setAttribute("aria-pressed", on ? "true" : "false"); b.setAttribute("aria-label", on ? "Unmute sound" : "Mute sound"); }
    if (persist) { app.save.data.settings.muted = !!on; app.save.write(); }
  }
  function setFast(on, persist) {
    for (const b of togFast) b.setAttribute("aria-pressed", on ? "true" : "false");
    if (persist) { app.save.data.settings.fast = !!on; app.save.write(); } else app.save.data.settings.fast = !!on;
  }
  // The show's time factor: 1, or 1 / speedFast at 2×.
  function speedK() { return app.save.data.settings.fast ? 1 / app.cfg.show.speedFast : 1; }
  function cue(name, arg) { return Audio.cue(app.audio, name, arg || 0, app.clock); }

  // ---- screens -------------------------------------------------------------------------------------------------------
  function showScreen(name) {
    app.screen = name;
    $("title").hidden = name !== "title"; $("map").hidden = name !== "map"; $("select").hidden = name !== "select";
    if (name === "title") paintTitle(true);
    app.dirty = true;
  }

  function paintTitle(force) {
    const f = Math.floor(app.clock / app.cfg.fx.bannerFrameMs) % 2;
    if (!force && f === app.titleF) return;
    app.titleF = f; Art.title($("title-art"), app.cfg.art, app.V.src, f);
  }

  // SPEC §7 (M2) unlock rule: a level opens when the level before it in its world is won; the first level of a world
  // opens when the first config.unlock.worldNeeds levels of the world before it are all won (or all of them, if fewer).
  // World 1 level 1 is always open. The save only holds stars, so this is derived, never stored.
  function won(e) { return (app.save.data.stars[e.id] | 0) > 0; }
  function isOpen(e) {
    const list = app.byWorld.get(e.world);
    if (e.n > 1) return won(list[e.n - 2]);
    const wi = app.worldOrder.indexOf(e.world);
    if (wi <= 0) return true;
    const prev = app.byWorld.get(app.worldOrder[wi - 1]), need = Math.min(app.cfg.unlock.worldNeeds, prev.length);
    for (let i = 0; i < need; i++) if (!won(prev[i])) return false;
    return true;
  }
  // The first open level without a win (the map's pulsing node).
  function continueEntry() {
    for (const e of app.entries) if (isOpen(e) && !won(e)) return e;
    return app.byId.get(app.save.data.last) || app.entries[0];
  }

  const LOCK = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';
  function buildMap() {
    const box = $("map-worlds"); box.textContent = ""; app.mapCards = [];
    for (const w of app.worldOrder) {
      const list = app.byWorld.get(w), card = document.createElement("div"), cv = document.createElement("canvas"), head = document.createElement("div");
      card.className = "wcard"; cv.className = "pix"; head.className = "whead";
      head.innerHTML = "<b></b><span></span>"; head.firstChild.textContent = "World " + w + ": " + app.worldName.get(w);
      card.append(cv, head);
      for (const e of list) {
        const b = document.createElement("button");
        b.className = "node"; b.setAttribute("aria-label", "Level " + e.world + "-" + e.n);
        b.addEventListener("click", () => onNode(e));
        b.addEventListener("animationend", () => b.classList.remove("shake"));
        card.append(b); e.node = b;
      }
      box.append(card); app.mapCards.push({ world: w, card, cv, head, list, locked: null, W: 0 });
    }
  }
  function onNode(e) {
    if (!isOpen(e)) { cue("lock"); e.node.classList.remove("shake"); void e.node.offsetWidth; e.node.classList.add("shake"); return; }
    cue("ui"); loadLevel(e);
  }
  function openMap() {
    showScreen("map"); refreshMap(); layoutMap(true);
    const cur = continueEntry(), mc = app.mapCards.find((c) => c.world === cur.world);
    if (mc && !app.testing) mc.card.scrollIntoView({ block: "nearest" });
  }
  function refreshMap() {
    const next = continueEntry(); let got = 0, all = 0;
    for (const mc of app.mapCards) {
      let ws = 0;
      for (const e of mc.list) {
        const n = app.save.data.stars[e.id] | 0, open = isOpen(e), b = e.node;
        ws += n; b.classList.toggle("done", n > 0); b.classList.toggle("locked", !open); b.classList.toggle("next", open && e === next);
        b.innerHTML = open ? e.n + "<i>" + (n ? "★".repeat(n) : "") + "</i>" : LOCK;
      }
      got += ws; all += mc.list.length * 3;
      const locked = !isOpen(mc.list[0]), wi = app.worldOrder.indexOf(mc.world);
      mc.head.lastChild.textContent = locked && wi > 0 ? "Win " + Math.min(app.cfg.unlock.worldNeeds, app.byWorld.get(app.worldOrder[wi - 1]).length) + " in World " + app.worldOrder[wi - 1] : "★ " + ws + " / " + mc.list.length * 3;
      if (mc.locked !== locked) { mc.locked = locked; mc.W = 0; }
    }
    $("map-stars").textContent = "★ " + got + " / " + all;
  }
  // Nodes snake along the card, four to a row; the painted strip draws the trail through their centres.
  function layoutMap(force) {
    if (app.screen !== "map") return;
    const a = app.cfg.layout.artPx, headH = 40, rowH = 80, cols = 4, pad = 18;
    for (const mc of app.mapCards) {
      const W = mc.card.clientWidth; if (!W) continue;
      const rows = Math.ceil(mc.list.length / cols), H = headH + rows * rowH + 18, pts = [];
      mc.card.style.height = H + "px";
      mc.list.forEach((e, i) => {
        const r = Math.floor(i / cols); let c = i % cols; if (r % 2) c = cols - 1 - c;
        const x = pad + ((c + 0.5) * (W - 2 * pad)) / cols, y = headH + r * rowH + rowH / 2 + (c % 2 ? 7 : -7);
        e.node.style.left = Math.round(x - 28) + "px"; e.node.style.top = Math.round(y - 28) + "px"; pts.push([Math.round(x / a), Math.round(y / a)]);
      });
      if (!force && mc.W === W) continue;
      const lw = Math.ceil(W / a), lh = Math.ceil(H / a);
      mc.cv.width = lw; mc.cv.height = lh; mc.cv.style.width = lw * a + "px"; mc.cv.style.height = lh * a + "px";
      Art.worldStrip(mc.cv, app.cfg.art, app.V.src, mc.world, pts, mc.locked); mc.W = W;
    }
  }

  // The flat select (every level open) is a debug tool only.
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
      b.addEventListener("click", () => { cue("ui"); loadLevel(e); });
      grid.append(b); e.btn = b;
    }
  }
  function openSelect() {
    for (const e of app.entries) { const n = app.save.data.stars[e.id] | 0; e.btn.lastChild.textContent = n ? "★".repeat(n) : "·"; e.btn.classList.toggle("done", n > 0); }
    showScreen("select");
  }

  // ---- levels --------------------------------------------------------------------------------------------------------
  function loadLevel(entry) {
    let g;
    try { g = Game.create(entry.L, app.cfg); } catch (e) { return false; }
    mount(entry, g);
    app.save.data.last = entry.id; app.save.write();
    return true;
  }

  // Show a game on the board (no save writes: selfTest uses this to hand the player's game back).
  function mount(entry, g) {
    app.entry = entry; app.game = g; app.cardFlash = -1; app.show = Show.create(g.B); app.panelAt = -1;
    app.pending.fill(0); app.fly.on = false; $("fly").hidden = true; app.nudgeT = -1e12;
    hidePanel();
    Render.setLevel(app.V, g.B);
    $("lvl-num").textContent = entry.world + "-" + entry.n;
    $("lvl-name").textContent = entry.L.name || "";
    $("w-num").textContent = "World " + entry.world; $("w-name").textContent = entry.worldName;
    $("hint-text").textContent = entry.L.teaches || ""; $("hint").hidden = !entry.L.teaches || app.hintDone.has(entry.id);
    for (const b of cards) { b.hidden = !g.present[+b.dataset.m]; b.classList.remove("flash", "bump"); }
    showScreen("play"); app.bannerF = -1; layout(); ui();
  }
  function dismissHint() { if (app.entry) app.hintDone.add(app.entry.id); $("hint").hidden = true; cue("ui"); }

  function nextEntry() { return app.entry ? app.entries[app.entry.idx + 1] || null : null; }

  // ---- input (the pointer handlers and SP call these exact functions) ------------------------------------------------
  function onBoardDown(e) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const c = Render.cellAt(app.V, e.clientX, e.clientY);
    if (c) tapCell(c.x, c.y); else skip();
  }

  // The next tap fast-forwards whatever is playing: the show, the chest fly, the wait for the panel.
  function skip() {
    let cut = false;
    if (app.show && Show.finish(app.show)) cut = true;
    if (app.fly.on || app.pending[0] + app.pending[1] + app.pending[2] + app.pending[3]) { app.fly.on = false; $("fly").hidden = true; app.pending.fill(0); ui(); cut = true; }
    const F = app.cfg.fx;
    if (app.panelAt >= 0 && !app.panel && app.panelAt > app.clock + F.skipPanelMs) { app.panelAt = app.clock + F.skipPanelMs; cut = true; }
    if (cut) app.dirty = true;
    return cut;
  }

  function tapCell(x, y) {
    const g = app.game;
    if (!g || app.screen !== "play" || app.panel === "win") return "ignored";
    skip();
    app.prevSt = g.st;
    const r = Game.tapCell(g, x | 0, y | 0, app.clock);
    feedback(r); drain(); return r;
  }

  function tapCrew(type) {
    const g = app.game, m = typeof type === "number" ? type : CREWS.indexOf(type);
    if (!g || app.screen !== "play" || app.panel === "win") return "ignored";
    skip();
    const r = Game.tapCrew(g, m, app.clock);
    feedback(r); drain(); return r;
  }

  function undo() { if (!app.game || app.screen !== "play") return false; skip(); const r = Game.undo(app.game); if (r) cue("undo"); drain(); return r; }
  function restart() { if (!app.game || app.screen !== "play") return false; skip(); const r = Game.restart(app.game); if (r) cue("undo"); drain(); return r; }

  // Sound and the board nudge for a tap result.
  function feedback(r) {
    if (r === "pick" || r === "unpick" || r === "break") cue("ui");
    else if (r === "blocked" || r === "iron" || r === "empty") { cue("bad"); app.nudgeT = app.clock; }
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "m") { setMuted(!app.audio.muted, true); e.preventDefault(); return; }
    if (app.screen !== "play") return;
    if (k >= "1" && k <= "4") { const vis = cards.filter((b) => !b.hidden), b = vis[+k - 1]; if (b) tapCrew(CREWS[+b.dataset.m]); }
    else if (k === "u" || k === "z" || k === "Backspace") undo();
    else if (k === "r") restart();
    else if (k === "f") setFast(!app.save.data.settings.fast, true);
    else if (k === "Escape") { skip(); if (app.game) { app.game.pick = -1; ui(); app.dirty = true; } }
    else if ((k === "Enter" || k === "n") && app.panel && app.pact.primary) app.pact.primary();
    else return;
    e.preventDefault();
  }

  // Apply what a game call queued: the show for a break, the save and the panel time on a win or stuck, the panel
  // closing on undo/restart.
  function drain() {
    const g = app.game, ev = g.events, F = app.cfg.fx;
    for (let i = 0; i < ev.length; i++) {
      const t = ev[i].t;
      if (t === "break") {
        const S = Show.build(app.show, app.prevSt, g.st, ev[i].s, app.clock, app.cfg.show, speedK());
        for (let c = 0; c < g.B.chestCell.length; c++) if (S.chestAt[c] < Show.INF) app.pending[g.B.chestCrew[c]]++;
      } else if (t === "win") {
        Save.record(app.save.data, app.entry.id, Game.stars(app.cfg, g.L.min, g.st.used), g.st.used); app.save.write();
        app.panelAt = app.show.end + F.winPanelMs * speedK();
      } else if (t === "stuck") app.panelAt = app.show.end + F.stuckPanelMs * speedK();
      else if (t === "undo" || t === "restart") { hidePanel(); app.panelAt = -1; }
    }
    ev.length = 0;
    ui(); app.dirty = true;
  }

  // What the show's events do on the page: sounds, dust, the chest fly and card bump.
  function onShow(kind, arg, t) {
    const S = app.show, EV = Show.EV, A = app.cfg.audio;
    if (kind === EV.WORK) { const n = arg === 0 ? A.work[S.m] : A.workAfter[S.m]; if (n) cue(n, arg); }
    else if (kind === EV.TICK) { Render.dustRing(app.V, S, arg, t); cue("tick", arg); }
    else if (kind === EV.CLANK) cue("clank");
    else if (kind === EV.DOOR) cue("door");
    else if (kind === EV.CHEST) { cue("chime"); startFly(arg, t); }
    else if (kind === EV.ARRIVE) { cue("pop"); arrive(arg, t); }
    else if (kind === EV.KEEP) cue("fanfare");
  }
  function startFly(i, t) {
    const g = app.game, B = g.B, m = B.chestCrew[i], c = B.chestCell[i], fl = app.fly, fe = $("fly");
    if (app.testing || cards[m].hidden) return;
    const a = Render.cellCenter(app.V, c % B.w, (c / B.w) | 0), r = cards[m].querySelector(".ico").getBoundingClientRect(), o = $("app").getBoundingClientRect();
    fl.on = true; fl.m = m; fl.t0 = t; fl.t1 = t + app.cfg.show.flyMs * speedK();
    fl.x0 = a.x - o.left; fl.y0 = a.y - o.top; fl.x1 = r.left + r.width / 2 - o.left; fl.y1 = r.top + r.height / 2 - o.top;
    const cg = fe.getContext("2d"); cg.clearRect(0, 0, fe.width, fe.height); cg.drawImage(cards[m].querySelector(".ico"), 0, 0, fe.width, fe.height);
    fe.hidden = false; updateFly(t);
  }
  function updateFly(now) {
    const fl = app.fly; if (!fl.on) return;
    const p = Math.max(0, Math.min(1, (now - fl.t0) / (fl.t1 - fl.t0))), e = p * p * (3 - 2 * p);
    const x = fl.x0 + (fl.x1 - fl.x0) * e, y = fl.y0 + (fl.y1 - fl.y0) * e - Math.sin(p * Math.PI) * 70;
    $("fly").style.transform = "translate(" + Math.round(x - 20) + "px," + Math.round(y - 20) + "px) scale(" + (1 + 0.35 * Math.sin(p * Math.PI)).toFixed(2) + ")";
  }
  function arrive(i, t) {
    const m = app.game.B.chestCrew[i];
    if (app.pending[m] > 0) app.pending[m]--;
    app.fly.on = false; $("fly").hidden = true;
    cards[m].classList.add("bump"); app.bumpT[m] = t; ui();
  }

  // ---- HUD, cards, panel -------------------------------------------------------------------------------------------
  function ui() {
    const g = app.game;
    if (!g) return;
    $("hud-used").textContent = g.st.used; $("hud-par").textContent = g.L.min;
    $("hud").setAttribute("aria-label", "Crews used " + g.st.used + ", three stars at " + g.L.min);
    for (const b of cards) {
      const m = +b.dataset.m, n = g.st.remaining[m], shown = n - app.pending[m];
      b.querySelector(".n").textContent = shown;
      b.classList.toggle("picked", g.pick === m); b.classList.toggle("zero", n <= 0);
    }
    $("btn-undo").disabled = !g.st.moves.length; $("btn-restart").disabled = !g.st.moves.length;
  }

  function setPanelButton(k, label, fn) { const b = $("p-" + k); b.hidden = !label; b.textContent = label || ""; app.pact[k] = fn || null; }

  function showPanel(kind) {
    const g = app.game, st = $("p-stars").children;
    app.panel = kind; app.panelT = app.clock; app.starsShown = 0;
    for (const i of st) i.classList.remove("on");
    if (kind === "win") {
      const n = Game.stars(app.cfg, g.L.min, g.st.used), nx = nextEntry(), go = nx && isOpen(nx);
      app.starsWon = n; $("p-stars").hidden = false;
      $("p-title").textContent = n === 3 ? "Keep breached!" : "Keep breached";
      $("p-line").textContent = "Crews used " + g.st.used + " · 3 stars at " + g.L.min;
      setPanelButton("primary", go ? "Next" : "Map", go ? () => loadLevel(nx) : openMap);
      setPanelButton("secondary", "Replay", () => restart());
      setPanelButton("third", go ? "Map" : null, go ? openMap : null);
    } else {
      app.starsWon = 0; $("p-stars").hidden = true;
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
  // Portrait: the rail sits at the bottom, the board directly above it as large as the width (or the height left after
  // a minimum banner) allows, and the banner takes whatever height is left. Wide (desktop 16:9): side column | board |
  // rail, the three centred as a group.
  function layout() {
    if (!app.cfg) return;
    const L = app.cfg.layout, play = $("play"), stage = $("stage"), cv = $("board");
    const wide = innerWidth >= L.wideMinPx && innerWidth >= innerHeight * L.wideAspect;
    document.body.classList.toggle("wide", wide);
    play.style.setProperty("--rail", L.railPx + "px"); play.style.setProperty("--gap", L.gapPx + "px"); play.style.setProperty("--side", L.sidePx + "px");
    if (app.screen === "map") layoutMap(false);
    if (!app.game) return;
    const dpr = Math.min(L.maxDpr, Math.max(1, window.devicePixelRatio || 1));
    let r;
    if (wide) {
      stage.style.height = "";
      r = Render.fit(app.V, Math.max(1, play.clientWidth - L.railPx - L.sidePx - 2 * L.gapPx), Math.max(1, play.clientHeight - 16), dpr);
      play.style.setProperty("--bw", Math.ceil(r.cssW) + "px");
    } else {
      r = Render.fit(app.V, Math.max(1, play.clientWidth), Math.max(1, play.clientHeight - $("rail").offsetHeight - L.bannerMinPx), dpr);
      stage.style.height = Math.ceil(r.cssH) + "px";
    }
    cv.style.left = Math.round((stage.clientWidth - r.cssW) / 2) + "px"; cv.style.top = Math.max(0, Math.round((stage.clientHeight - r.cssH) / 2)) + "px";
    app.bannerF = -1; app.dirty = true;
  }
  // The banner's pixel scene at config.layout.artPx CSS px per art pixel; repainted when its size or goblin frame changes.
  function paintBanner() {
    const c = $("banner-art"), b = $("banner"), a = app.cfg.layout.artPx, f = Math.floor(app.clock / app.cfg.fx.bannerFrameMs) % 2;
    const w = Math.max(1, Math.ceil(b.clientWidth / a)), h = Math.max(1, Math.ceil(b.clientHeight / a));
    if (f === app.bannerF && c.width === w && c.height === h) return;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; c.style.width = w * a + "px"; c.style.height = h * a + "px"; }
    app.bannerF = f; Art.banner(c, app.cfg.art, app.V.src, app.entry ? app.entry.world : 1, f);
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = app.lastT ? Math.min(app.cfg.fx.maxDtMs, Math.max(0, t - app.lastT)) : 0;
    app.lastT = t; step(app.hold ? 0 : dt);
  }

  // One step of the sim clock: the show's due events, the fly, the panel and its stars, card flash and bumps, the board
  // nudge, then a frame if anything moved.
  function step(dt) {
    app.clock += dt;
    const now = app.clock;
    if (app.screen === "title") { if (!app.testing) paintTitle(false); return; }
    const g = app.game, F = app.cfg.fx, S = app.show;
    if (!g || app.screen !== "play") return;
    if (S.evi < S.ev.length || S.active) Show.advance(S, now, onShow);
    updateFly(now);
    if (!app.panel && app.panelAt >= 0 && now >= app.panelAt) showPanel(g.st.won ? "win" : "stuck");
    if (app.panel === "win" && app.starsShown < app.starsWon && now >= app.panelT + (app.starsShown + 1) * F.starMs) { $("p-stars").children[app.starsShown++].classList.add("on"); cue("star", app.starsShown - 1); }
    const cf = now - g.fx.cardT < F.cardFlashMs ? g.fx.cardM : -1;
    if (cf !== app.cardFlash) { app.cardFlash = cf; for (const b of cards) b.classList.toggle("flash", +b.dataset.m === cf); }
    for (let m = 0; m < 4; m++) if (app.bumpT[m] > -1e12 && now - app.bumpT[m] >= F.bumpMs) { cards[m].classList.remove("bump"); app.bumpT[m] = -1e12; }
    const nt = now - app.nudgeT, cv = $("board");
    if (nt < F.boardNudgeMs) { cv.style.transform = "translateX(" + Math.round(Math.sin((nt / 1000) * F.boardNudgeHz * Math.PI * 2) * F.boardNudgePx * (1 - nt / F.boardNudgeMs)) + "px)"; app.nudged = true; }
    else if (app.nudged) { cv.style.transform = ""; app.nudged = false; }
    if (app.testing) return;
    paintBanner();
    if (app.dirty || Render.busy(app.V, g, now, S)) { Render.draw(app.V, g, now, S); app.dirty = false; }
  }

  // Back from the background: re-check the sprite caches (a discarded backing store reads blank), redraw.
  function wake() {
    if (!app.V) return;
    if (Render.check(app.V)) app.cacheRebuilds++;
    app.dirty = true; app.lastT = 0; app.bannerF = -1; app.titleF = -1;
  }

  // ---- debug facade (?debug=1) -------------------------------------------------------------------------------------
  function state() {
    const g = app.game, e = app.entry, S = app.show;
    const out = { screen: app.screen, panel: app.panel, clock: app.clock, twoTap: !!app.cfg.input.twoTap, muted: app.audio.muted, fast: !!app.save.data.settings.fast, cue: app.audio.last };
    if (!g) return out;
    const rem = {};
    for (let i = 0; i < 4; i++) if (g.present[i]) rem[CREWS[i]] = g.st.remaining[i];
    return Object.assign(out, { id: e.id, world: e.world, n: e.n, w: g.B.w, h: g.B.h, min: g.L.min, moves: g.st.moves.length, used: g.st.used,
      remaining: rem, pick: g.pick >= 0 ? CREWS[g.pick] : null, won: g.st.won, stuck: g.st.stuck, legal: g.st.legal,
      stars: g.st.won ? Game.stars(app.cfg, g.L.min, g.st.used) : 0, saved: app.save.data.stars[e.id] | 0, flashN: g.fx.flashN,
      show: { active: S.active, t0: S.t0, end: S.end, dur: S.end - S.t0, popT0: S.popT0, crumbleEnd: S.crumbleEnd, keepAt: S.keepAt, k: S.k },
      panelAt: app.panelAt, starsShown: app.starsShown, hint: !$("hint").hidden, scenery: g.scenery.reduce((a, b) => a + b, 0),
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
    Render.draw(V, g, app.clock, app.show);
    const px = Render.pixelHash(V);
    return [app.entry.id, V.cell, V.dpr, c.width + "x" + c.height, g.pick, E.serialize(g.st), px.hash, px.opaque.toFixed(3)].join("|");
  }

  // The primary buttons a player can see on the current screen.
  // On screen and not under the map's sticky header.
  function inView(b) { const r = b.getBoundingClientRect(), top = app.screen === "map" ? document.querySelector(".map-top").getBoundingClientRect().bottom : 0; return r.width > 0 && r.top >= top && r.bottom <= innerHeight; }
  function primaryButtons() {
    if (app.screen === "title") return [$("btn-play")];
    if (app.screen === "map") return [$("btn-home")].concat(togMute.filter((b) => b.closest("#map")), app.entries.map((e) => e.node).filter(inView), DEBUG && inView($("btn-debug")) ? [$("btn-debug")] : []);
    if (app.screen === "select") return Array.from(document.querySelectorAll("#worlds button")).filter(inView).concat([$("btn-back")]);
    const out = [$("btn-menu")].concat(togMute.filter((b) => b.closest("#banner")), togFast);
    if (app.panel) { for (const k of ["primary", "secondary", "third"]) if (!$("p-" + k).hidden) out.push($("p-" + k)); return out; }
    if (!$("hint").hidden) out.push($("btn-hint"));
    for (const b of cards) if (!b.hidden) out.push(b);
    out.push($("btn-undo"), $("btn-restart"));
    return out;
  }
  // elementFromPoint at the centre of each primary button hits that button (lesson 34). Returns how many were checked.
  function checkButtons(check, where) {
    let n = 0;
    for (const b of primaryButtons()) {
      const r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      check(r.width >= 44 && r.height >= 44, where + ": " + (b.id || b.getAttribute("aria-label") || b.textContent) + " is under 44 px");
      check(!!el && (el === b || b.contains(el)), where + ": " + (b.id || b.getAttribute("aria-label") || b.textContent) + " is covered by " + (el ? el.id || el.className || el.tagName : "nothing"));
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

  // Step the sim clock until the show is over and any due panel is up (bounded by config.selfTest.settleMs).
  function settle() { const lim = app.cfg.selfTest.settleMs; for (let t = 0; t < lim && (app.show.active || (app.panelAt >= 0 && !app.panel) || app.starsShown < app.starsWon); t += 50) step(50); }

  // SPEC §5 selfTest, through the same tapCell/tapCrew/undo/restart the pointer handlers call, on a memory save, with
  // SP's manual clock (step). Hands the player's game, screen and save back, and checks their stored save is unchanged.
  function selfTest() {
    const t0 = performance.now(), cfg = app.cfg, fails = [];
    const check = (ok, m) => { if (!ok && fails.length < 40) fails.push(m); return !!ok; };
    const raw = () => { try { return localStorage.getItem(cfg.save.key); } catch (e) { return null; } };
    const rawBefore = raw();
    const keep = { save: app.save, game: app.game, entry: app.entry, screen: app.screen, panel: app.panel, twoTap: cfg.input.twoTap, show: app.show, hint: new Set(app.hintDone), muted: app.audio.muted };
    const out = { ok: false, levels: 0, solved: 0, stuck: [], buttons: 0, cues: {}, ms: 0, fails };
    app.save = Save.open(Save.memoryStore(), cfg.save.key, app.ids, cfg.save.maxCrews);
    app.testing = true; app.audio.quiet = true; cfg.input.twoTap = true;
    const counts0 = Object.assign({}, app.audio.counts);
    try {
      // Title, then the map: Play is one tap to the map and level 1 is one more (two taps from load).
      showScreen("title"); out.buttons += checkButtons(check, "title");
      $("btn-play").click();
      check(app.screen === "map", "Play did not open the map");
      out.buttons += checkButtons(check, "map");
      const W = app.worldOrder, w1 = app.byWorld.get(W[0]), w2 = app.byWorld.get(W[1]), need = Math.min(cfg.unlock.worldNeeds, w1.length);
      check(isOpen(w1[0]) && !isOpen(w1[1]) && !isOpen(w2[0]) && w1[1].node.classList.contains("locked") && w1[0].node.classList.contains("next"), "fresh save: locks wrong");
      w1[1].node.click();
      check(app.screen === "map" && app.audio.last === "lock", "a locked node opened or made no sound");
      for (let i = 0; i < need; i++) { check(!isOpen(w2[0]), "world 2 opened after " + i + " wins"); Save.record(app.save.data, w1[i].id, 1, 9); refreshMap(); check(isOpen(w1[i + 1] || w1[i]), "win " + i + " did not open the next level"); }
      check(isOpen(w2[0]) && !isOpen(w2[1]) && !w2[0].node.classList.contains("locked"), "world 2 did not open after " + need + " wins");
      app.save = Save.open(Save.memoryStore(), cfg.save.key, app.ids, cfg.save.maxCrews); refreshMap();
      w1[0].node.click();
      check(app.screen === "play" && app.entry === w1[0], "map node 1 did not open level 1");

      // solve() never writes: the player's stored save and the live save data are byte-identical after it.
      const memBefore = JSON.stringify(app.save.data), sol = solveNow();
      check(sol && sol.win && sol.min === app.entries[0].L.min, "solve() min differs from the baked min");
      check(raw() === rawBefore && JSON.stringify(app.save.data) === memBefore, "solve() changed the save");

      // Stars maths and "stars only go up".
      check(Game.stars(cfg, 3, 3) === 3 && Game.stars(cfg, 3, 4) === 2 && Game.stars(cfg, 3, 5) === 1 && Game.stars(cfg, 3, 9) === 1, "stars offsets");
      const d = Save.fresh(); Save.record(d, "x", 3, 3); Save.record(d, "x", 1, 6);
      check(d.stars.x === 3 && d.best.x === 3, "stars went down on a worse replay");

      // The show: a break builds one; the next tap fast-forwards it; 2× halves it; its sounds fire.
      {
        const e = app.entries.find((q) => q.L.line.length >= 2) || app.entries[0], [x, y] = e.L.line[0];
        loadLevel(e); tapCell(x, y); tapCell(x, y);
        const S = app.show, d1 = S.end - S.t0;
        check(S.active && d1 > 0 && app.game.st.moves.length === 1, "no show after a break");
        const r = tapCrew(CREWS[app.game.B.secMat[E.sectionAt(app.game.B, ...e.L.line[1])]]);
        check(!S.active && r === "pick", "a tap during the show did not fast-forward it (" + r + ")");
        undo(); app.game.pick = -1; setFast(true, false);
        tapCell(x, y); tapCell(x, y);
        const d2 = app.show.end - app.show.t0;
        check(Math.abs(d2 / d1 - 1 / cfg.show.speedFast) < 0.01, "2x: " + d2 + " vs " + d1);
        setFast(false, false); settle();
        const c = app.audio.counts, workCue = cfg.audio.work[app.show.m];
        check((c.tick || 0) > (counts0.tick || 0) && (c[workCue] || 0) > (counts0[workCue] || 0), "show sounds did not fire (tick, " + workCue + ")");
        out.show = { ms1x: Math.round(d1), ms2x: Math.round(d2) };
      }

      // A chest on the line: after the break the card holds the +1 back while the crew flies; the chime, the arrival
      // pop and the card bump follow on the clock, and then the card shows the real count.
      {
        let hit = null;
        for (const e of app.entries) {
          const B = E.parse(e.L); let st = E.start(B);
          for (let k = 0; k < e.L.line.length && !hit; k++) { const nx = E.apply(B, st, E.sectionAt(B, ...e.L.line[k])); for (let i = 0; i < B.chestCell.length; i++) if (nx.claimed[i] && !st.claimed[i] && !nx.won) hit = { e, k, m: B.chestCrew[i] }; st = nx; }
          if (hit) break;
        }
        if (check(hit, "no line claims a chest before its win")) {
          loadLevel(hit.e); const c0 = Object.assign({}, app.audio.counts), g = app.game;
          for (let k = 0; k <= hit.k; k++) { const [x, y] = hit.e.L.line[k]; tapCell(x, y); tapCell(x, y); if (k < hit.k) settle(); }
          const shownBefore = +cards[hit.m].querySelector(".n").textContent;
          check(app.pending[hit.m] === 1 && shownBefore === g.st.remaining[hit.m] - 1, hit.e.id + ": the chest crew was not held back (" + shownBefore + ")");
          settle();
          const c = app.audio.counts;
          check((c.chime || 0) > (c0.chime || 0) && (c.pop || 0) > (c0.pop || 0) && app.pending[hit.m] === 0 && +cards[hit.m].querySelector(".n").textContent === g.st.remaining[hit.m] && app.bumpT[hit.m] > -1e12, hit.e.id + ": chest chime/arrival/bump missing");
          out.chest = hit.e.id + " step " + hit.k;
        }
      }

      // Every level along its baked line: tap 1 picks (by board or by card), tap 2 breaks; undo on move 1 is exact and
      // refunds the crew; the line wins at 3 stars, the panel comes up after the show, 3 stars are saved and revealed.
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
          ok = check(r2 === "break" && g.st.moves.length === moves + 1 && app.show.active, e.id + " step " + k + ": tap 2 gave " + r2);
          if (ok && k === 0) {
            undo();
            check(E.serialize(g.st) === before && g.st.remaining[m] === rem && !app.show.active, e.id + ": undo was not exact");
            tapCell(x, y); ok = check(tapCell(x, y) === "break", e.id + ": redo failed");
          }
        }
        if (!ok) continue;
        const n = Game.stars(cfg, e.L.min, g.st.used);
        check(g.st.won && n === 3 && g.st.used === e.L.min, e.id + ": won " + g.st.won + " stars " + n + " used " + g.st.used);
        check(app.panel === null, e.id + ": panel came up before the show");
        settle();
        check(app.panel === "win" && app.starsShown === 3, e.id + ": no win panel or stars " + app.starsShown);
        check((app.save.data.stars[e.id] | 0) === 3 && app.save.data.best[e.id] === e.L.min, e.id + ": 3 stars not saved");
        out.buttons += checkButtons(check, e.id + " win");
        if (g.st.won && app.panel === "win") out.solved++;
      }
      check(out.solved >= cfg.selfTest.minLevels, "solved " + out.solved + " levels, need " + cfg.selfTest.minLevels);

      // Stuck, one board per world: the panel's Undo steps back exactly; its Restart returns to the start.
      for (const w of app.worldOrder) {
        const found = findStuck(app.byWorld.get(w), cfg.selfTest.stuckSeed + w, cfg.selfTest.stuckTries);
        if (!check(found, "world " + w + ": no stuck line found")) continue;
        loadLevel(found.e);
        const g = app.game, start = E.serialize(g.st), pre = E.serialize(E.fromMoves(g.B, found.moves.slice(0, -1)));
        for (const s of found.moves) { const [x, y] = Game.firstTile(g.B, s); tapCell(x, y); tapCell(x, y); }
        if (!check(g.st.stuck && !g.st.won, found.e.id + ": not stuck after the stuck line")) continue;
        settle();
        check(app.panel === "stuck", found.e.id + ": no stuck panel");
        out.buttons += checkButtons(check, found.e.id + " stuck");
        $("p-primary").click();
        check(app.panel === null && !g.st.stuck && E.serialize(g.st) === pre, found.e.id + ": panel Undo was not exact");
        const last = Game.firstTile(g.B, found.moves[found.moves.length - 1]);
        tapCell(last[0], last[1]); tapCell(last[0], last[1]); settle();
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
          if (!E.isCrewSection(B, s) || g.scenery[s]) continue;
          const m = B.secMat[s], [x, y] = Game.firstTile(B, s);
          if (!blockedSeen && !g.st.reach[s] && g.st.remaining[m] > 0 && Game.blockers(g, s) > 0) {
            const r = tapCell(x, y);
            check(r === "blocked" && g.fx.flashN > 0 && g.fx.shakeS === s && g.st.moves.length === 0 && app.audio.last === "bad", e.id + ": blocked tap gave " + r);
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

      // Scenery (SPEC §7): a stone section sealed by moat on a hand-made board is scenery; tapping it only clears.
      {
        const L = { id: "scenery-test", w: 7, h: 7, grid: ["TTTTTTT", "T.....T", "T.~~~.T", "T.~S~.T", "T.~~~.T", "T..K..T", "TTTTTTT"], muster: { stone: 1, timber: 1 }, chests: [] };
        const g = Game.create(L, cfg), s = E.sectionAt(g.B, 3, 3), t = E.sectionAt(g.B, 0, 0);
        check(g.scenery[s] === 1 && g.scenery[t] === 0, "scenery rule: stone " + g.scenery[s] + " timber " + g.scenery[t]);
        g.pick = 0; check(Game.tapCell(g, 3, 3, 0) === "scenery" && g.pick === -1, "a scenery tap did not just clear");
        let baked = 0; for (const e of app.entries) baked += Game.create(e.L, cfg).scenery.reduce((a, b) => a + b, 0);
        out.scenerySections = baked;
      }

      // Teaching hint card: shown on a board with teaches, dismissible, and its button is hittable.
      {
        const e = app.entries.find((q) => q.L.teaches);
        app.hintDone.delete(e.id); loadLevel(e);
        check(!$("hint").hidden && $("hint-text").textContent === e.L.teaches, e.id + ": no hint card");
        out.buttons += checkButtons(check, e.id + " hint");
        $("btn-hint").click();
        check($("hint").hidden && app.hintDone.has(e.id), e.id + ": hint did not dismiss");
        loadLevel(e); check($("hint").hidden, e.id + ": hint came back after dismissal");
      }

      // Mute: the toggle sets the saved setting and silences the synth; the cue is still recorded.
      setMuted(true, true);
      check(app.save.data.settings.muted === true && app.audio.muted && cue("ui") === false && app.audio.last === "ui", "mute");
      setMuted(false, true);

      // One-tap dial: a single tap on a reachable section breaks it.
      cfg.input.twoTap = false;
      loadLevel(app.entries[0]);
      const l0 = app.entries[0].L.line[0];
      check(tapCell(l0[0], l0[1]) === "break", "twoTap=false: one tap did not break");
      cfg.input.twoTap = true;

      // Sprite caches: opaque (tiles, badges and all five character sheets), and rebuilt after a simulated drop.
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
    for (const k in app.audio.counts) { const d = app.audio.counts[k] - (counts0[k] || 0); if (d) out.cues[k] = d; }
    app.testing = false; app.audio.quiet = false; cfg.input.twoTap = keep.twoTap; app.save = keep.save; app.hintDone = keep.hint;
    setMuted(keep.muted, false); setFast(app.save.data.settings.fast, false);
    if (keep.game) { mount(keep.entry, keep.game); app.show = keep.show; } else { app.game = null; app.entry = null; hidePanel(); }
    if (keep.panel && keep.game) showPanel(keep.panel);
    if (keep.screen === "select") openSelect(); else if (keep.screen === "map") openMap(); else showScreen(keep.screen);
    refreshMap();
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
    // Freeze the rAF clock (SP.tick still advances it): deterministic frames for screenshots.
    hold: (on) => { app.hold = !!on; app.dirty = true; return app.hold; },
    draw: () => { if (app.game) { Render.draw(app.V, app.game, app.clock, app.show); app.dirty = false; } return app.clock; },
    cues: () => Object.assign({}, app.audio.counts),
    isOpen: (id) => { const e = app.byId.get(String(id)); return !!e && isOpen(e); },
    levels: () => app.entries.map((e) => ({ id: e.id, world: e.world, n: e.n, min: e.L.min, line: e.L.line })),
    cellCenter: (x, y) => Render.cellCenter(app.V, x, y),
    firstTile: (x, y) => { const g = app.game, s = g ? E.sectionAt(g.B, x, y) : -1; return s >= 0 ? Game.firstTile(g.B, s) : null; },
    buttons: () => primaryButtons().map((b) => { const r = b.getBoundingClientRect(); return { id: b.id || b.getAttribute("aria-label") || b.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }),
    stuckLine: (world) => { const f = findStuck(app.byWorld.get(world), app.cfg.selfTest.stuckSeed + world, app.cfg.selfTest.stuckTries); return f ? { id: f.e.id, taps: f.moves.map((s) => Game.firstTile(E.parse(f.e.L), s)) } : null; },
    blankTiles: () => Render.blankTiles(app.V), dropCaches: () => Render.dropCaches(app.V),
    // Draw cost: n full frames of the current board on the live clock (the layers are cached, as in play). Bounded.
    bench: (n) => {
      const g = app.game; if (!g) return null;
      const k = Math.max(1, Math.min(2000, n | 0)), t0 = performance.now();
      for (let i = 0; i < k; i++) Render.draw(app.V, g, app.clock + i * 16, app.show);
      return { frames: k, msPerDraw: (performance.now() - t0) / k, canvas: app.V.canvas.width + "x" + app.V.canvas.height };
    },
  };

  boot();
})();
