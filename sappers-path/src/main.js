// Sapper's Path page v3 (SPEC-v3 §3, §6, §7): boot, screens (title, era map, play), layout, input (a tap on a front
// card plays that column; a board tap skips the show), the holding line and tray, the win/fail panel, save, the frame
// loop, and the ?debug=1 facade (window.SP) with selfTest. The rules live in engine.js, the board and the run-and-carry
// show in board.js, the title scene, wall and goblin sprites in art.js, the synth in audio.js.
//
// A tap resolves at once in the engine (SPEC-v3 §3: the whole cascade of resumes included); the tray, the holding line
// and a win or fail are decided right then. The show only replays it. A tap during a show lands that show first.
// Clock: app.clock is sim time in ms. The rAF loop advances it by the real frame delta (capped at layout.maxDtMs);
// SP.tick(ms) advances it by hand, so a hidden tab (no rAF) can still be driven. Shows, the goblin, the panel delay and
// toasts all run on this clock; nothing here uses setTimeout or setInterval.
(function () {
  "use strict";
  const NS = window.SappersPath, E = NS.engine, Save = NS.save, Board = NS.board, Art = NS.art, Audio = NS.audio;
  const V_ = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const DIFFS = Save.DIFFS, DNAME = { easy: "Easy", normal: "Normal", hard: "Hard" }, $ = (id) => document.getElementById(id);
  const app = { cfg: null, levels: [], byId: new Map(), order: [], eras: [], save: null, entry: null, B: null, S: null, V: null, audio: null, sheets: null,
    clock: 0, lastT: 0, screen: "title", diff: "normal", fast: false, ending: null, endAt: -1, panel: null, testing: false, hintOn: false,
    toastT: -1e12, popK: 0, cards: [], nexts: [], slots: [], wide: false, chipURL: [], manURL: [], nodes: [], lastW: 0, lastH: 0 };
  const togMute = Array.from(document.querySelectorAll(".tog-mute")), togFast = Array.from(document.querySelectorAll(".tog-fast")), segs = Array.from(document.querySelectorAll(".seg button"));

  // ---- boot --------------------------------------------------------------------------------------------------------
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }
  async function boot() {
    try {
      const [cfg, lv] = await Promise.all([getJSON("config.json?v=" + V_), getJSON("levels/levels.json?v=" + V_)]);
      app.cfg = cfg; indexLevels(lv);
    } catch (e) { $("load-msg").textContent = "Couldn't load the siege. Reload to try again."; return; }
    if (!app.levels.length) { $("load-msg").textContent = "No levels found."; return; }
    app.save = Save.open(storage(), app.cfg.save.key, app.order);
    app.diff = app.save.data.settings.diff;
    app.sheets = Art.sources(app.cfg.art);
    app.V = Board.create($("board"), app.cfg, app.sheets);
    app.V.hooks.pop = onPop;
    app.audio = Audio.create(app.cfg.audio);
    setMuted(app.save.data.settings.muted, false); setFast(app.save.data.settings.fast, false); setDiff(app.diff, false);
    paintWall(); chips(); buildTray(); buildLine(); buildMap(); wire();
    showScreen("title"); layout();
    if (DEBUG) window.SP = SP;
    requestAnimationFrame(frame);
  }
  // levels.json: {levels: [...]} in play order. A level that fails to compile is skipped, never fatal.
  function indexLevels(lv) {
    const list = lv && Array.isArray(lv.levels) ? lv.levels : [];
    for (const L of list) {
      try { E.compile(L); } catch (e) { continue; }
      const id = String(L.id); if (app.byId.has(id)) continue;
      const entry = { L, id, n: L.n | 0, era: L.era | 0, idx: app.levels.length, node: null };
      app.levels.push(entry); app.byId.set(id, entry); app.order.push(id);
    }
  }
  function storage() { try { const s = window.localStorage; s.getItem("sappers-path.probe"); return s; } catch (e) { return Save.memoryStore(); } }
  const rulesOf = (d) => app.cfg.v3.rules[d] || app.cfg.v3.rules.normal;
  const mat = (m) => app.cfg.v3.mats[m] || { n: "?", c: "#888888", crew: "?" };
  const writeSave = () => { if (!app.testing) app.save.write(); };

  // The dark brick texture behind the chrome (art.js), upscaled once to whole device pixels.
  function paintWall() {
    try {
      const a = app.cfg.title.wallArtPx, dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), src = Art.wall(app.cfg.art), k = Math.max(1, Math.round(a * dpr));
      const c = document.createElement("canvas"); c.width = src.width * k; c.height = src.height * k;
      const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, c.width, c.height);
      const r = document.documentElement.style; r.setProperty("--wall", "url(" + c.toDataURL() + ")"); r.setProperty("--wall-size", src.width * a + "px " + src.height * a + "px");
    } catch (e) { /* the flat background colour stays */ }
  }
  // Block chips (tray swatches) and sapper figures (holding line) as image URLs, drawn by board.js.
  function chips() {
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), s = Math.round(16 * dpr), ms = Math.round(14 * dpr);
    for (let m = 1; m < E.NMAT; m++) {
      try { app.chipURL[m] = "url(" + app.V.chip(m, s).toDataURL() + ")"; } catch (e) { app.chipURL[m] = "none"; }
      try { const f = app.V.man(m, ms), c = document.createElement("canvas"); c.width = ms; c.height = ms; c.getContext("2d").drawImage(f, 0, 0, ms, ms, 0, 0, ms, ms); app.manURL[m] = "url(" + c.toDataURL() + ")"; } catch (e) { app.manURL[m] = "none"; }
    }
  }

  // ---- tray, holding line, map (built once, updated in place) ------------------------------------------------------
  function buildTray() {
    const tray = $("tray");
    for (let j = 0; j < E.NCOL; j++) {
      const col = document.createElement("div"); col.className = "col";
      const b = document.createElement("button"); b.className = "card"; b.dataset.col = j;
      b.innerHTML = '<span class="top"><i class="sw"></i><b class="n"></b></span><span class="lab"></span>';
      b.addEventListener("click", () => { playCol(j); });
      col.append(b); app.cards.push(b);
      const nx = [];
      for (let d = 1; d <= 3; d++) { const x = document.createElement("div"); x.className = "next d" + d; x.innerHTML = '<i class="sw"></i><span></span>'; col.append(x); nx.push(x); }
      app.nexts.push(nx); tray.append(col);
    }
  }
  function buildLine() {
    const line = $("line");
    for (let i = 0; i < app.cfg.layout.lineSlots; i++) { const s = document.createElement("div"); s.className = "slot"; s.innerHTML = '<i class="men"></i><b></b>'; line.append(s); app.slots.push(s); }
  }
  function paintMat(el, m) { const c = mat(m).c; el.style.setProperty("--mc", c); el.style.setProperty("--tc", Board.lum(c) > 0.62 ? "#221a26" : "#ffffff"); }
  function renderTray() {
    const S = app.S, B = app.B, live = S && S.status === E.PLAYING && !app.panel;
    for (let j = 0; j < E.NCOL; j++) {
      const b = app.cards[j], f = S ? S.front(j) : -1;
      if (f < 0) { b.className = "card empty"; b.disabled = true; b.querySelector(".n").textContent = ""; b.querySelector(".lab").textContent = "empty"; b.querySelector(".sw").style.backgroundImage = "none"; b.style.removeProperty("--mc"); b.setAttribute("aria-label", "Empty column"); }
      else {
        const m = B.cardM[f], k = B.cardN[f];
        b.className = "card"; b.disabled = !live; paintMat(b, m);
        b.querySelector(".n").textContent = k; b.querySelector(".lab").textContent = mat(m).crew; b.querySelector(".sw").style.backgroundImage = app.chipURL[m];
        b.setAttribute("aria-label", mat(m).crew + ", " + k + " sappers");
      }
      for (let d = 1; d <= 3; d++) {
        const x = app.nexts[j][d - 1], h = S ? S.heads[j] + d : 1e9;
        if (!S || h >= B.colLen[j]) { x.className = "next d" + d + " none"; continue; }
        const ci = B.colStart[j] + h; x.className = "next d" + d; paintMat(x, B.cardM[ci]);
        x.querySelector("span").textContent = B.cardN[ci]; x.querySelector(".sw").style.backgroundImage = app.chipURL[B.cardM[ci]];
      }
    }
  }
  function renderLine() {
    const S = app.S; if (!S) return;
    $("line").style.setProperty("--cap", S.cap);
    app.slots.forEach((s, i) => {
      s.hidden = i >= S.cap; s.classList.remove("over");
      if (i < S.lineLen) { const m = S.lineM[i], n = S.lineN[i]; s.classList.add("full"); paintMat(s, m); s.querySelector("b").textContent = n;
        const men = s.querySelector(".men"); men.style.backgroundImage = app.manURL[m]; men.style.width = Math.min(n, app.cfg.layout.sapperIcons) * 14 + "px"; s.setAttribute("aria-label", mat(m).crew + ", " + n + " waiting"); }
      else { s.classList.remove("full"); s.style.removeProperty("--mc"); s.querySelector("b").textContent = ""; s.querySelector(".men").style.width = "0"; s.setAttribute("aria-label", "Empty space"); }
    });
    if (S.status === E.FAILED && S.reason === "overflow") { const s = app.slots[Math.min(S.cap, app.slots.length) - 1]; if (s) s.classList.add("over"); }
  }
  function renderTop() {
    const e = app.entry; if (!e) return;
    $("lvl-num").textContent = e.n; $("lvl-name").textContent = e.L.name || (app.eras[e.era - 1] ? app.eras[e.era - 1].name : "Era " + e.era);
    $("diff-chip").textContent = DNAME[app.diff];
  }
  function renderAll() { renderTop(); renderTray(); renderLine(); }

  function buildMap() {
    const host = $("eras"); app.eras = app.cfg.eras || [];
    app.eras.forEach((er) => {
      const sec = document.createElement("section"); sec.className = "era";
      sec.innerHTML = '<div class="eye"><span>Era ' + er.era + '</span><span class="cnt"></span></div><h3></h3><p></p><div class="nodes"></div>';
      sec.querySelector("h3").textContent = er.name; sec.querySelector("p").textContent = er.note;
      const nodes = sec.querySelector(".nodes");
      for (const e of app.levels) {
        if (e.era !== er.era) continue;
        const b = document.createElement("button"); b.className = "node"; b.innerHTML = e.n + "<i></i>";
        b.addEventListener("click", () => { if (Save.isOpen(app.save.data, app.order, e.id)) startLevel(e.id); });
        e.node = b; nodes.append(b);
      }
      er.sec = sec; host.append(sec);
    });
  }
  function renderMap() {
    const d = app.save.data, next = Save.next(d, app.order); let won = 0;
    for (const e of app.levels) {
      const m = d.done[e.id] | 0, open = Save.isOpen(d, app.order, e.id); if (m) won++;
      e.node.className = "node" + (m ? " done" : open ? "" : " locked") + (e.id === next && !m ? " next" : "");
      e.node.disabled = !open; e.node.querySelector("i").textContent = (m & 1 ? "E" : "") + (m & 2 ? "N" : "") + (m & 4 ? "H" : "");
      e.node.setAttribute("aria-label", "Level " + e.n + (m ? ", won" : open ? "" : ", locked"));
    }
    app.eras.forEach((er) => { const ls = app.levels.filter((e) => e.era === er.era); er.sec.querySelector(".cnt").textContent = ls.filter((e) => d.done[e.id]).length + "/" + ls.length; });
    $("map-count").textContent = won + "/" + app.levels.length;
    const ne = app.byId.get(next); $("map-play").textContent = ne ? "Play level " + ne.n : "Play";
  }

  // ---- screens and levels --------------------------------------------------------------------------------------------
  function showScreen(name) {
    app.screen = name;
    $("title").hidden = name !== "title"; $("map").hidden = name !== "map";
    if (name === "map") { renderMap(); const ne = app.byId.get(Save.next(app.save.data, app.order)); if (ne && ne.node && ne.node.scrollIntoView) ne.node.scrollIntoView({ block: "center" }); }
    if (name === "title") paintTitle();
    if (name === "play") fitBoard();
  }
  function startLevel(id, diff) {
    const e = app.byId.get(id) || app.levels[0];
    if (diff && DIFFS.indexOf(diff) >= 0) app.diff = diff;
    app.entry = e; app.B = E.compile(e.L); app.S = E.sim(app.B, rulesOf(app.diff));
    app.ending = null; app.endAt = -1; app.panel = null; app.popK = 0; $("panel").hidden = true; hideToast();
    app.V.setLevel(app.B, app.S);
    app.save.data.last = e.id; writeSave();
    app.hintOn = !!e.L.hint; $("hint").hidden = !app.hintOn; $("hint-text").textContent = e.L.hint || "";
    showScreen("play"); renderAll();
    return e;
  }
  function retry() {
    if (!app.S) return;
    app.S.reset(); app.V.reset(); app.ending = null; app.endAt = -1; app.panel = null; app.popK = 0; $("panel").hidden = true; hideToast();
    renderAll();
  }
  const playNext = () => startLevel(Save.next(app.save.data, app.order));

  // The one play entry point: the card tap, the keyboard and SP.play all call this. Returns true if a card was played.
  function playCol(col) {
    const S = app.S;
    if (app.screen !== "play" || !S || S.status !== E.PLAYING || app.panel || !(col >= 0 && col < E.NCOL) || S.front(col) < 0) return false;
    app.V.fastForward();
    S.logOn = true; S.clearLog();
    if (S.play(col) === -2) return false;
    const st = app.V.startShow(S);
    app.popK = 0;
    if (app.hintOn) { app.hintOn = false; $("hint").hidden = true; }
    cue("pop");
    if (st.kills) toast("Archers cut down " + st.kills + " " + crewOf(S) + ".", true);
    else if (st.hits) toast("Archers drove " + st.hits + " back to the line.", true);
    if (S.status !== E.PLAYING) {
      app.ending = { won: S.status === E.WON, reason: S.reason, m: S.failMat };
      if (app.ending.won) { const first = Save.record(app.save.data, app.entry.id, app.diff); app.ending.first = first; app.save.data.last = Save.next(app.save.data, app.order); writeSave(); }
    }
    renderTray(); renderLine();
    return true;
  }
  const crewOf = (S) => { const ev = S.ev; for (let i = 0; i + 2 < S.evLen; i += 3) if (ev[i] === E.EV.KILL || ev[i] === E.EV.HIT) return mat(ev[i + 1]).crew; return "sappers"; };
  function skip() {
    if (app.screen !== "play") return;
    if (app.V.fastForward()) return;
    if (app.V.gob.on && !app.V.gob.done) app.V.gob.done = true;
    else if (app.ending && !app.panel) app.endAt = app.clock;
  }
  function reasonText(e) {
    const who = e.m ? mat(e.m).crew : "sappers";
    return { overflow: "The holding line overflowed: no space left for the " + who + ".", short: "Archers cut down the " + who + ": too few left to finish.",
      stuck: "Out of squads, and the waiting sappers can't reach their colour.", nomove: "No safe move left: every front squad would overflow the line." }[e.reason] || "The assault failed.";
  }
  function showPanel() {
    const e = app.ending; if (!e) return;
    app.panel = e.won ? "win" : "fail";
    const last = app.entry.idx === app.levels.length - 1;
    $("p-title").textContent = e.won ? "Fort razed!" : "Assault failed";
    $("p-line").textContent = e.won ? "The goblin king flees. Level " + app.entry.n + " won on " + DNAME[app.diff] + "." : reasonText(e);
    $("p-primary").textContent = e.won ? (last ? "Era map" : "Next level") : "Retry";
    $("p-secondary").textContent = e.won ? "Retry" : "Era map";
    $("panel").hidden = false;
    cue(e.won ? "chime" : "bad");
    renderTray();
  }
  function panelPrimary() { if (app.panel === "win") { if (app.entry.idx === app.levels.length - 1) showScreen("map"); else playNext(); } else retry(); }
  function panelSecondary() { if (app.panel === "win") retry(); else showScreen("map"); }

  // ---- toasts, audio, toggles ----------------------------------------------------------------------------------------
  function toast(text, bad) { const t = $("toast"); t.textContent = text; t.classList.toggle("bad", !!bad); t.hidden = false; app.toastT = app.clock + app.cfg.show.toastMs; }
  function hideToast() { $("toast").hidden = true; app.toastT = -1e12; }
  function cue(name, arg) { if (app.audio && !app.testing) Audio.cue(app.audio, name, arg, app.clock); }
  function onPop() { cue("tick", app.popK++ % 12); }
  function setMuted(on, save) { Audio.setMuted(app.audio, on); togMute.forEach((b) => b.setAttribute("aria-pressed", on ? "true" : "false")); if (save) { app.save.data.settings.muted = !!on; writeSave(); } }
  function setFast(on, save) { app.fast = !!on; togFast.forEach((b) => b.setAttribute("aria-pressed", on ? "true" : "false")); if (save) { app.save.data.settings.fast = app.fast; writeSave(); } }
  function setDiff(d, save) { if (DIFFS.indexOf(d) < 0) return; app.diff = d; segs.forEach((b) => b.setAttribute("aria-pressed", b.dataset.diff === d ? "true" : "false")); if (save) { app.save.data.settings.diff = d; writeSave(); } }

  function wire() {
    document.addEventListener("pointerdown", () => { if (app.audio) Audio.unlock(app.audio); }, { capture: true });
    document.addEventListener("keydown", (ev) => {
      if (app.audio) Audio.unlock(app.audio);
      if (app.screen !== "play") return;
      if (ev.key >= "1" && ev.key <= "5") playCol(+ev.key - 1);
      else if (ev.key === "r" || ev.key === "R") retry();
      else if (ev.key === " ") { ev.preventDefault(); skip(); }
    });
    $("board").addEventListener("pointerdown", skip);
    $("btn-retry").addEventListener("click", retry);
    $("btn-map").addEventListener("click", () => { app.V.fastForward(); showScreen("map"); });
    $("btn-play").addEventListener("click", playNext);
    $("btn-tomap").addEventListener("click", () => showScreen("map"));
    $("btn-home").addEventListener("click", () => showScreen("title"));
    $("map-play").addEventListener("click", playNext);
    $("p-primary").addEventListener("click", panelPrimary);
    $("p-secondary").addEventListener("click", panelSecondary);
    togMute.forEach((b) => b.addEventListener("click", () => setMuted(!app.audio.muted, true)));
    togFast.forEach((b) => b.addEventListener("click", () => setFast(!app.fast, true)));
    segs.forEach((b) => b.addEventListener("click", () => { setDiff(b.dataset.diff, true); if (app.screen === "map") renderMap(); }));
    window.addEventListener("resize", layout);
    // A hidden tab can lose canvas backing stores: re-check every opaque cache when the page shows again, rebuild once.
    const recheck = () => { if (document.hidden || !app.V || !app.V.sprites) return; if (app.V.checkSprites().length) { app.V.buildSprites(); app.V.paintLayer(); } };
    document.addEventListener("visibilitychange", recheck); window.addEventListener("pageshow", recheck);
  }

  // ---- layout ---------------------------------------------------------------------------------------------------------
  function layout() {
    if (!app.cfg) return;
    const L = app.cfg.layout, W = window.innerWidth, H = window.innerHeight;
    app.wide = W >= L.wideMinPx && W / H >= L.wideAspect;
    document.body.classList.toggle("wide", app.wide);
    const r = document.documentElement.style;
    if (app.wide) { const rw = Math.min(L.railWidePx, Math.max(300, W * 0.34)); r.setProperty("--rail-w", rw + "px"); r.setProperty("--stage-w", Math.max(200, Math.min(W - rw - 60, 1100 - rw - 24)) + "px"); }
    if (app.screen === "title") paintTitle();
    fitBoard();
  }
  function fitBoard() {
    if (!app.B || !app.V) return;
    const st = $("stage"), w = st.clientWidth - 14, h = st.clientHeight - 16;
    if (w > 0 && h > 0) app.V.layout(w, h, window.devicePixelRatio || 1);
  }
  function paintTitle() {
    if (!app.cfg) return;
    const c = $("title-art"), T = app.cfg.title, W = window.innerWidth, H = window.innerHeight;
    if (W === app.lastW && H === app.lastH && c.width > 1) return;
    app.lastW = W; app.lastH = H;
    const a = Math.max(T.artMin, Math.min(T.artMax, Math.floor(Math.min(W / T.artW, H / T.artH)))), w = Math.ceil(W / a), h = Math.ceil(H / a);
    c.width = w; c.height = h; c.style.width = w * a + "px"; c.style.height = h * a + "px";
    try { Art.title(c, app.cfg.art, app.sheets, 0, W > H ? T.baseFracWide : T.baseFrac); } catch (e) { /* sky colour stays */ }
  }

  // ---- frame loop -----------------------------------------------------------------------------------------------------
  function step(dt) {
    app.clock += dt;
    const V = app.V; if (!V) return;
    V.clock = app.clock;
    if (app.screen !== "play" || !app.B) return;
    V.update(dt, app.fast ? app.cfg.show.speedFast : 1);
    if (app.ending && !app.panel && V.idle()) {
      if (app.ending.won) { if (!V.gob.on) { V.goblin(true); cue("fanfare"); } else if (V.gob.done) showPanel(); }
      else if (app.endAt < 0) app.endAt = app.clock + app.cfg.show.panelMs;
      else if (app.clock >= app.endAt) showPanel();
    }
    if (app.toastT > 0 && app.clock >= app.toastT) hideToast();
  }
  function frame(t) {
    const dt = app.lastT ? Math.min(app.cfg ? app.cfg.layout.maxDtMs : 100, Math.max(0, t - app.lastT)) : 16;
    app.lastT = t;
    step(dt);
    if (app.screen === "play" && app.V) app.V.draw();
    requestAnimationFrame(frame);
  }

  // ---- solver (debug): DFS from the current position on a clone ----------------------------------------------------
  function solveHere(nodes) {
    const B = app.B; if (!B) return null;
    const S = E.sim(B, rulesOf(app.diff)), dead = new Set(), path = [], bufs = [];
    S.load(app.S.save());
    for (let k = 0; k <= B.ncards + 1; k++) bufs.push(new Int32Array(S.M.length));
    let used = 0; const cap = nodes || app.cfg.selfTest.solveNodes;
    function dfs(k) {
      if (S.status === E.WON) return true;
      if (S.status !== E.PLAYING || ++used > cap) return false;
      const h = S.hash(); if (dead.has(h)) return false;
      S.save(bufs[k]);
      const kids = [];
      for (let j = 0; j < E.NCOL; j++) { if (S.front(j) < 0) continue; S.play(j); if (S.status !== E.FAILED) kids.push([j, S.status === E.WON ? -1 : S.lineLen]); S.load(bufs[k]); }
      kids.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
      for (const [j] of kids) { S.play(j); path.push(j); if (dfs(k + 1)) return true; path.pop(); S.load(bufs[k]); if (used > cap) return false; }
      dead.add(h); return false;
    }
    return dfs(0) ? path.join("") : null;
  }
  // Seeded random taps on an engine copy of level e until pred(S) holds; returns that tap order, or null.
  function search(e, diff, pred, tries, seed) {
    const B = E.compile(e.L), S = E.sim(B, rulesOf(diff)), open = [];
    let s = seed | 0; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let k = 0; k < tries; k++) {
      S.reset(); let ord = "";
      for (let g = 0; g <= B.ncards && S.status === E.PLAYING; g++) {
        open.length = 0; for (let j = 0; j < E.NCOL; j++) if (S.front(j) >= 0) open.push(j);
        if (!open.length) break;
        const j = open[Math.floor(rnd() * open.length)]; S.play(j); ord += j;
        if (pred(S)) return ord;
      }
    }
    return null;
  }
  const lossPred = (S) => S.status === E.FAILED && S.reason === "overflow";
  function lossOrder(id, diff) { const e = app.byId.get(id) || app.entry; return e ? search(e, diff || app.diff, lossPred, app.cfg.selfTest.searchTries, app.cfg.selfTest.searchSeed) : null; }

  // ---- debug facade ---------------------------------------------------------------------------------------------------
  function state() {
    const S = app.S, B = app.B, V = app.V;
    const line = []; if (S) for (let i = 0; i < S.lineLen; i++) line.push([mat(S.lineM[i]).crew, S.lineN[i]]);
    const fronts = []; if (S) for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); fronts.push(f < 0 ? null : { mat: B.cardM[f], crew: mat(B.cardM[f]).crew, n: B.cardN[f] }); }
    return { screen: app.screen, id: app.entry ? app.entry.id : null, n: app.entry ? app.entry.n : null, era: app.entry ? app.entry.era : null, diff: app.diff,
      status: !S ? null : S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing", reason: S && S.status === E.FAILED ? S.reason : null,
      pixLeft: S ? S.pixLeft : null, cap: S ? S.cap : null, line, fronts, plays: S ? S.plays : 0, hits: S ? S.hits : 0, kills: S ? S.kills : 0,
      showing: V ? V.showOn : false, runners: V ? V.rN : 0, launched: V ? V.rLaunched : 0, showT: V ? Math.round(V.showT) : 0, goblin: V ? V.gob.on && !V.gob.done : false,
      panel: app.panel, fast: app.fast, clock: Math.round(app.clock), cs: V ? V.cs : 0, done: Object.keys(app.save.data.done).length };
  }
  const resolve = (id) => (typeof id === "number" ? (app.levels.find((e) => e.n === id) || {}).id : id);
  const hitOK = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t)); };
  const dispMatches = () => { const S = app.S, V = app.V; for (let c = 0; c < app.B.n; c++) if ((V.disp[c] > 0) !== (S.a[c] > 0)) return false; return true; };
  function tick(ms) { let left = Math.max(0, Math.min(600000, +ms || 0)); while (left > 0) { const d = Math.min(16, left); step(d); left -= d; } if (app.screen === "play" && app.V) app.V.draw(); return state(); }
  const playOrder = (ord) => { for (let i = 0; i < ord.length; i++) if (!playCol(ord.charCodeAt(i) - 48)) return false; return true; };

  // selfTest (SPEC-v3 §7): every stored winning order on every difficulty through playCol, an overflow, the key and
  // gate, an archer hit per difficulty, the show cap at 1x and 2x, the save byte-identical after solve(), elementFromPoint
  // on the primary buttons, opaque sprite caches. Runs on a scratch save; the real save is compared byte for byte at
  // the end. Leaves the page on the level it was on (restarted).
  function selfTest() {
    const T0 = performance.now(), out = { pass: 0, fail: [], notes: {}, ms: 0 };
    const ok = (c, m) => { if (c) out.pass++; else out.fail.push(m); return !!c; };
    const was = { save: app.save, screen: app.screen, entry: app.entry, diff: app.diff, fast: app.fast };
    const key = app.cfg.save.key, snap = (() => { try { return was.save.store.getItem(key); } catch (e) { return "?"; } })();
    app.testing = true; app.save = Save.open(Save.memoryStore(), key, app.order); app.fast = false;
    try {
      // 1. Stored winning orders, all levels, all difficulties, through the play entry point.
      let wins = 0, total = 0;
      for (const e of app.levels) for (const d of DIFFS) {
        total++; startLevel(e.id, d);
        const ord = e.L.win && e.L.win[d];
        const good = !!ord && playOrder(ord); app.V.fastForward();
        if (ok(good && app.S.status === E.WON, e.id + " " + d + ": stored order wins through play()")) wins++;
        ok(dispMatches(), e.id + " " + d + ": the board display matches the rules after the show lands");
      }
      out.notes.wins = wins + "/" + total;
      // 2. An overflow fail: a late level (built to punish careless taps), a seeded careless order, through play().
      let of = null;
      for (const e of app.levels) { if (e.L.band !== "hard" && e.L.band !== "hardest") continue; const o = search(e, "normal", lossPred, app.cfg.selfTest.searchTries, app.cfg.selfTest.searchSeed); if (o) { of = { e, o }; break; } }
      if (ok(!!of, "overflow: found a careless order that overflows")) {
        startLevel(of.e.id, "normal"); playOrder(of.o);
        ok(app.S.status === E.FAILED && app.S.reason === "overflow" && app.ending && app.ending.reason === "overflow", "overflow: play() ends the assault with reason overflow");
        tick(app.cfg.show.capMs + app.cfg.show.panelMs + 100);
        ok(app.panel === "fail" && /overflow/.test($("p-line").textContent), "overflow: the fail panel names the reason");
        ok(hitOK($("p-primary")) && $("p-primary").textContent === "Retry", "overflow: Retry is the panel's primary button and is hittable");
        out.notes.overflow = of.e.id + " '" + of.o + "'";
      }
      // 3. Key and gate: the gate stays iron until the play that eats its key; then every gate cell is open ground.
      const ge = app.levels.find((e) => e.L.gates && e.L.gates.length);
      if (ok(!!ge, "gate: a level with a gate exists")) {
        startLevel(ge.id, "normal"); const B = app.B, ord = ge.L.win.normal, gc = B.gateCells[0];
        let before = true, opened = -1;
        for (let i = 0; i < ord.length && app.S.status === E.PLAYING; i++) {
          if (opened < 0 && !gc.every((c) => app.S.a[c] === E.IRON)) before = false;
          playCol(ord.charCodeAt(i) - 48);
          if (opened < 0 && gc.every((c) => app.S.a[c] === E.DIRT)) opened = i;
        }
        app.V.fastForward();
        ok(before && opened >= 0, "gate: iron until the key play (" + opened + "), then open");
        ok(gc.every((c) => app.V.disp[c] <= 0), "gate: the board shows the gate gone once the show lands");
        out.notes.gate = ge.id + " opened on play " + (opened + 1);
      }
      // 4. An archer hit on every difficulty (Easy/Normal: back to the line; Hard: killed).
      for (const d of DIFFS) {
        const lethal = rulesOf(d).archersKill, pred = lethal ? (S) => S.kills > 0 : (S) => S.hits > 0; let found = null;
        for (const e of app.levels) { if (!(e.L.towers && e.L.towers.length)) continue; const o = search(e, d, pred, app.cfg.selfTest.searchTries, app.cfg.selfTest.searchSeed); if (o) { found = { e, o }; break; } }
        if (!ok(!!found, "archers " + d + ": found an order with a hit")) continue;
        startLevel(found.e.id, d); playOrder(found.o);
        ok(lethal ? app.S.kills > 0 : app.S.hits > 0 && app.S.kills === 0, "archers " + d + ": play() records the " + (lethal ? "kill" : "hit"));
        if (!lethal && app.S.status === E.PLAYING) ok(app.S.lineLen > 0, "archers " + d + ": the hit sappers wait on the holding line");
        out.notes["archer_" + d] = found.e.id + " '" + found.o + "'";
      }
      // 5. The show cap: the play with the most eats, at 1x and 2x (app time, not show time).
      let big = null;
      for (const e of app.levels) { const B = E.compile(e.L); if (!big || B.pixTotal > big.p) big = { e, p: B.pixTotal }; }
      for (const fast of [false, true]) {
        startLevel(big.e.id, "normal"); app.fast = fast;
        const ord = big.e.L.win.normal; let worst = 0, runners = 0;
        for (let i = 0; i < ord.length && app.S.status === E.PLAYING; i++) {
          playCol(ord.charCodeAt(i) - 48); runners = Math.max(runners, app.V.rN);
          let t = 0; while (app.V.showOn && t < 20000) { step(16); t += 16; }
          worst = Math.max(worst, t);
        }
        const cap = app.cfg.show.capMs / (fast ? app.cfg.show.speedFast : 1) + 32;
        ok(worst <= cap && runners <= app.cfg.show.maxRunners * 2, "show " + (fast ? "2x" : "1x") + ": longest play " + worst + " ms (cap " + cap + "), " + runners + " runners");
        out.notes["show_" + (fast ? "2x" : "1x")] = worst + " ms";
      }
      app.fast = false;
      // 6. solve() leaves the save byte-identical.
      startLevel(app.levels[Math.min(20, app.levels.length - 1)].id, "normal");
      const s0 = app.save.store.getItem(key) + "|" + JSON.stringify(app.save.data), sol = solveHere();
      ok(!!sol, "solve: finds a win from the start");
      ok(s0 === app.save.store.getItem(key) + "|" + JSON.stringify(app.save.data), "solve: the save is byte-identical after solve()");
      // 7. elementFromPoint on the primary buttons of every screen.
      showScreen("title"); ok(hitOK($("btn-play")), "hit: title Play");
      showScreen("map"); ok(hitOK($("map-play")), "hit: map Play");
      startLevel(app.levels[0].id, "normal");
      for (let j = 0; j < E.NCOL; j++) if (app.S.front(j) >= 0) ok(hitOK(app.cards[j]), "hit: card " + j);
      ok(hitOK($("btn-retry")), "hit: Retry");
      playOrder(app.levels[0].L.win.normal); tick(8000);
      ok(app.panel === "win" && hitOK($("p-primary")), "hit: the win panel's Next");
      // 8. Opaque sprite caches.
      const bad = app.V.checkSprites(); ok(!bad.length, "sprites: every opaque cache is opaque" + (bad.length ? " (" + bad.join(",") + ")" : ""));
    } catch (err) { ok(false, "selfTest threw: " + (err && err.message)); }
    finally {
      app.save = was.save; app.testing = false; app.fast = was.fast; app.diff = was.diff;
      if (was.entry) startLevel(was.entry.id, was.diff); showScreen(was.screen); renderAll();
    }
    let snap2 = "?"; try { snap2 = was.save.store.getItem(key); } catch (e) { /* stays "?" */ }
    ok(snap === snap2, "save: the real save is untouched by selfTest");
    out.ms = Math.round(performance.now() - T0);
    return out;
  }
  const SP = { play: playCol, state, load: (id, diff) => { startLevel(resolve(id), diff); return state(); }, retry: () => { retry(); return state(); }, tick,
    solve: (nodes) => solveHere(nodes), selfTest, winOrder: (d) => (app.entry ? app.entry.L.win[d || app.diff] : null), lossOrder: (id, d) => lossOrder(resolve(id), d),
    screen: (name) => { showScreen(name); return state(); }, skip: () => { skip(); return state(); },
    // Cost of n board draws right now (ms): the harness calls it mid-show on the busiest play.
    perf: (n) => { const k = Math.max(1, Math.min(500, n | 0 || 60)); let max = 0; const t0 = performance.now(); for (let i = 0; i < k; i++) { const a = performance.now(); app.V.draw(); max = Math.max(max, performance.now() - a); } return { mean: +((performance.now() - t0) / k).toFixed(3), max: +max.toFixed(3), runners: app.V.rN, launched: app.V.rLaunched }; },
    sprites: () => app.V.checkSprites(),
    // The play with the most eats across every level's stored Normal order: {n, i} (level number, tap index).
    busiest: () => { let best = { n: 0, i: 0, eats: -1 }; for (const e of app.levels) { const B = E.compile(e.L), S = E.sim(B, rulesOf("normal")), o = e.L.win.normal; S.logOn = true;
      for (let i = 0; i < o.length; i++) { S.clearLog(); S.play(o.charCodeAt(i) - 48); let k = 0; for (let j = 0; j < S.evLen; j += 3) if (S.ev[j] === E.EV.EAT) k++; if (k > best.eats) best = { n: e.n, i, eats: k }; } } return best; } };

  boot();
})();
