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
// M2: the teaching coach (config.teach: one line and a bouncing arrow on what to tap, advanced by play), the sound set
// (tap, a throttled pop per pixel, haul, line fill and last-space warning, overflow, gate, arrows, collapse, fanfare), the
// win beat (difficulty medals), and portal shape: pause on blur or a hidden tab (the clock stops and the audio context
// suspends; a Paused sheet takes the next tap so it can never play a card), and the board turned a quarter in landscape.
// Fix pass: the level's name sits over its difficulty and steps its size down to fit (never an ellipsis), crew names on
// cards fit the same way, a full holding line pulses red and marks each front card safe or fatal (a one-tap look-ahead
// on a scratch copy, run on a play, never per frame), and wide screens put every control in one side panel.
(function () {
  "use strict";
  const NS = window.SappersPath, E = NS.engine, Save = NS.save, Board = NS.board, Art = NS.art, Audio = NS.audio;
  const V_ = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const DIFFS = Save.DIFFS, DNAME = { easy: "Easy", normal: "Normal", hard: "Hard" }, $ = (id) => document.getElementById(id);
  const app = { cfg: null, levels: [], byId: new Map(), order: [], eras: [], save: null, entry: null, B: null, S: null, V: null, audio: null, sheets: null,
    clock: 0, lastT: 0, screen: "title", diff: "normal", fast: false, ending: null, endAt: -1, panel: null, panelAt: 0, testing: false,
    toastT: -1e12, popK: 0, cards: [], nexts: [], slots: [], wide: false, chipURL: [], manURL: [], nodes: [], lastW: 0, lastH: 0,
    coach: null, used: 0, cues: {}, paused: false, pauses: 0, focusEl: null, pt: { x: 0, y: 0 }, T: null, tbuf: null, labFit: new Map(), verdict: [] };
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
    const H = app.V.hooks;
    H.pop = onPop; H.deposit = () => cue("haul"); H.gate = () => cue("gate"); H.tower = () => cue("tower"); H.shot = () => cue("arrow");
    H.hit = (k) => cue(k === 2 ? "fall" : "thud"); H.collapse = () => cue("collapse");
    try { app.V.calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* motion stays on */ }
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
  // Text on a colour: white or ink, whichever has the higher contrast (WCAG relative luminance).
  const INK = "#221a26", relLum = (hex) => { const v = parseInt(hex.slice(1), 16), f = (s) => { const x = ((v >> s) & 255) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(16) + 0.7152 * f(8) + 0.0722 * f(0); };
  const textOn = (hex) => { const L = relLum(hex); return 1.05 / (L + 0.05) >= (L + 0.05) / (relLum(INK) + 0.05) ? "#ffffff" : INK; };
  function paintMat(el, m) { const c = mat(m).c, t = textOn(c); el.style.setProperty("--mc", c); el.style.setProperty("--tc", t); el.style.setProperty("--oc", t === INK ? "rgba(255,255,255,.45)" : "rgba(20,16,28,.7)"); }
  // Fit a label to its box: the CSS size, stepped down in one measure (cached per text until the next resize).
  function fitText(el, key, min) {
    let px = app.labFit.get(key);
    if (px == null) { el.style.fontSize = ""; const base = parseFloat(getComputedStyle(el).fontSize) || 14; px = base;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 0.5) px = Math.max(min, Math.floor((base * el.clientWidth * 10) / el.scrollWidth) / 10);
      if (el.clientWidth > 0) app.labFit.set(key, px); }
    el.style.fontSize = px + "px";
  }
  function renderTray() {
    const S = app.S, B = app.B, live = S && S.status === E.PLAYING && !app.panel;
    for (let j = 0; j < E.NCOL; j++) {
      const b = app.cards[j], f = S ? S.front(j) : -1;
      if (f < 0) { b.className = "card empty"; b.disabled = true; b.querySelector(".n").textContent = ""; b.querySelector(".lab").textContent = "empty"; b.querySelector(".sw").style.backgroundImage = "none"; b.style.removeProperty("--mc"); b.setAttribute("aria-label", "Empty column"); }
      else {
        const m = B.cardM[f], k = B.cardN[f];
        b.className = "card" + (app.verdict[j] === 1 ? " safe" : app.verdict[j] === 2 ? " fatal" : ""); b.disabled = !live; paintMat(b, m);
        const lab = b.querySelector(".lab"); lab.textContent = mat(m).crew; fitText(lab, "crew:" + m, app.cfg.layout.labMinPx);
        b.querySelector(".n").textContent = k; b.querySelector(".sw").style.backgroundImage = app.chipURL[m];
        b.setAttribute("aria-label", mat(m).crew + ", " + k + " sappers" + (app.verdict[j] === 2 ? ", would end the assault" : app.verdict[j] === 1 ? ", safe" : ""));
      }
      for (let d = 1; d <= 3; d++) {
        const x = app.nexts[j][d - 1], h = S ? S.heads[j] + d : 1e9;
        if (!S || h >= B.colLen[j]) { x.className = "next d" + d + " none"; continue; }
        const ci = B.colStart[j] + h; x.className = "next d" + d; paintMat(x, B.cardM[ci]);
        x.querySelector("span").textContent = B.cardN[ci]; x.querySelector(".sw").style.backgroundImage = app.chipURL[B.cardM[ci]];
      }
    }
  }
  // The holding line full: every front card gets a verdict from a one-tap look-ahead on a scratch copy (1 safe, 2 fatal:
  // that tap would end the assault). Run on a play or a load, never per frame.
  function judge() {
    const S = app.S, full = S && S.status === E.PLAYING && S.lineLen >= S.cap && !app.panel;
    for (let j = 0; j < E.NCOL; j++) app.verdict[j] = 0;
    if (!full) return false;
    S.save(app.tbuf);
    for (let j = 0; j < E.NCOL; j++) { if (S.front(j) < 0) continue; app.T.load(app.tbuf); app.T.play(j); app.verdict[j] = app.T.status === E.FAILED ? 2 : 1; }
    return true;
  }
  function renderLine() {
    const S = app.S; if (!S) return;
    $("line").style.setProperty("--cap", S.cap);
    const full = S.status === E.PLAYING && S.lineLen >= S.cap && !app.panel;
    $("line-wrap").classList.toggle("full", full);
    $("line-lab").textContent = full ? app.cfg.layout.fullText : "Holding line"; $("line-cnt").textContent = S.lineLen + "/" + S.cap;
    app.slots.forEach((s, i) => {
      s.hidden = i >= S.cap; s.classList.remove("over");
      if (i < S.lineLen) { const m = S.lineM[i], n = S.lineN[i]; s.classList.add("full"); paintMat(s, m); s.querySelector("b").textContent = n;
        const men = s.querySelector(".men"); men.style.backgroundImage = app.manURL[m]; men.style.width = Math.min(n, app.cfg.layout.sapperIcons) * 14 + "px"; s.setAttribute("aria-label", mat(m).crew + ", " + n + " waiting"); }
      else { s.classList.remove("full"); s.style.removeProperty("--mc"); s.querySelector("b").textContent = ""; s.querySelector(".men").style.width = "0"; s.setAttribute("aria-label", "Empty space"); }
      s.classList.toggle("last", i === S.lineLen && S.lineLen === S.cap - 1 && S.status === E.PLAYING); // the last free space pulses
    });
    if (S.status === E.FAILED && S.reason === "overflow") { const s = app.slots[Math.min(S.cap, app.slots.length) - 1]; if (s) s.classList.add("over"); }
  }
  function renderTop() {
    const e = app.entry; if (!e) return;
    $("lvl-num").textContent = e.n; $("lvl-name").textContent = e.L.name || (app.eras[e.era - 1] ? app.eras[e.era - 1].name : "Era " + e.era);
    $("diff-chip").textContent = DNAME[app.diff];
    app.labFit.delete("name"); fitText($("lvl-name"), "name", app.cfg.layout.nameMinPx); // the room beside the number changes with its digits
  }
  function renderAll() { judge(); renderTop(); renderTray(); renderLine(); }

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
    if (name !== "play") { $("pause").hidden = true; if (app.paused && !document.hidden) resume(); }
    renderCoach();
  }
  function startLevel(id, diff) {
    const e = app.byId.get(id) || app.levels[0];
    if (diff && DIFFS.indexOf(diff) >= 0) app.diff = diff;
    app.entry = e; app.B = E.compile(e.L); app.S = E.sim(app.B, rulesOf(app.diff)); app.T = E.sim(app.B, rulesOf(app.diff)); app.tbuf = new Int32Array(app.S.M.length);
    app.ending = null; app.endAt = -1; app.panel = null; app.popK = 0; app.used = 0; $("panel").hidden = true; hideToast();
    app.V.setLevel(app.B, app.S);
    app.save.data.last = e.id; writeSave();
    showScreen("play"); renderAll(); coachStart();
    return e;
  }
  function retry() {
    if (!app.S) return;
    app.S.reset(); app.V.reset(); app.ending = null; app.endAt = -1; app.panel = null; app.popK = 0; app.used = 0; $("panel").hidden = true; hideToast();
    renderAll(); coachStart();
  }
  const playNext = () => startLevel(Save.next(app.save.data, app.order));

  // The one play entry point: the card tap, the keyboard and SP.play all call this. Returns true if a card was played.
  function playCol(col) {
    const S = app.S;
    if (app.screen !== "play" || !S || S.status !== E.PLAYING || app.panel || !(col >= 0 && col < E.NCOL) || S.front(col) < 0) return false;
    app.V.fastForward();
    const m = app.B.cardM[S.front(col)], line0 = S.lineLen;
    S.logOn = true; S.clearLog();
    if (S.play(col) === -2) return false;
    app.used |= 1 << m;
    app.V.startShow(S);
    app.popK = 0;
    cue("tap");
    if (S.status === E.FAILED && S.reason === "overflow") cue("overflow");
    else if (S.status === E.PLAYING && S.lineLen === S.cap - 1 && S.lineLen > line0) cue("warn");
    else if (S.lineLen > line0) cue("fill");
    if (S.status !== E.PLAYING) {
      app.ending = { won: S.status === E.WON, reason: S.reason, m: S.failMat };
      if (app.ending.won) { const was = app.save.data.done[app.entry.id] | 0, first = Save.record(app.save.data, app.entry.id, app.diff); app.ending.first = first; app.ending.medal = !(was & (1 << DIFFS.indexOf(app.diff))); app.save.data.last = Save.next(app.save.data, app.order); writeSave(); }
    }
    judge(); renderTray(); renderLine(); coachStep();
    return true;
  }
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
    app.panel = e.won ? "win" : "fail"; app.panelAt = app.clock; renderCoach();
    const last = app.entry.idx === app.levels.length - 1;
    $("p-title").textContent = e.won ? "Fort razed!" : "Assault failed";
    $("p-line").textContent = e.won ? "The goblin king flees. Level " + app.entry.n + " won on " + DNAME[app.diff] + "." : reasonText(e);
    $("p-primary").textContent = e.won ? (last ? "Era map" : "Next level") : "Retry";
    $("p-secondary").textContent = e.won ? "Retry" : "Era map";
    // The win beat: the level's difficulty medals, this one stamped in if it's new.
    const mask = app.save.data.done[app.entry.id] | 0, md = $("p-medals"); md.hidden = !e.won;
    Array.from(md.children).forEach((el, k) => { el.className = "medal" + (mask & (1 << k) ? " got" : "") + (e.won && e.medal && DIFFS[k] === app.diff ? " new" : ""); });
    $("panel").hidden = false;
    cue(e.won ? "chime" : "bad"); if (e.won && e.medal) cue("star", 2);
    judge(); renderTray(); renderLine();
  }
  // A panel button ignores taps for show.panelGuardMs after the panel appears, so a thumb still tapping cards can't hit it.
  const panelLive = () => app.clock - app.panelAt >= app.cfg.show.panelGuardMs || app.testing;
  function panelPrimary() { if (!app.panel || !panelLive()) return; if (app.panel === "win") { if (app.entry.idx === app.levels.length - 1) showScreen("map"); else playNext(); } else retry(); }
  function panelSecondary() { if (!app.panel || !panelLive()) return; if (app.panel === "win") retry(); else showScreen("map"); }

  // ---- teaching coach (config.teach) ---------------------------------------------------------------------------------
  // One line over the board and a bouncing arrow on the thing to tap: a front card, a card behind one, the holding line,
  // or a ring on the board (key, gate, tower). Steps advance on play; conditions read the rules state, so any tap order
  // works. DOM work happens on a play or a resize only, never per frame.
  function coachStart() {
    const e = app.entry, steps = e && ((app.cfg.teach || {})[e.id] || (e.L.hint ? [{ say: e.L.hint, until: "play" }] : null));
    app.coach = steps && steps.length ? { steps, i: 0, at: 0 } : null;
    if (app.coach) skipDead();
    renderCoach();
  }
  function frontOf(m) { const S = app.S; for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0 && app.B.cardM[f] === m) return j; } return -1; }
  function cond(k) {
    const S = app.S, B = app.B, [w, a] = String(k).split(":"), m = a | 0;
    switch (w) {
      case "play": return S.plays > app.coach.at;
      case "line": return S.lineLen > 0;
      case "lineEmpty": return S.lineLen === 0;
      case "gate": return B.gateCells.every((gc) => S.a[gc[0]] <= 0);
      case "tower": return S.standing === 0;
      case "reach": return S.reachable(m) > 0;
      case "used": return !!(app.used & (1 << m));
      case "hit": return S.hits > 0;
      case "front": return frontOf(m) >= 0;
      case "short": { const j = frontOf(m); return j >= 0 && B.cardN[S.front(j)] > S.reachable(m); }
    }
    return false;
  }
  const any = (u) => [].concat(u || "play").some(cond);
  function skipDead() { const co = app.coach; while (co.i < co.steps.length && co.steps[co.i].if && !cond(co.steps[co.i].if)) co.i++; co.at = app.S.plays; }
  function coachStep() {
    const co = app.coach; if (!co) return;
    for (let guard = 0; guard <= co.steps.length && co.i < co.steps.length && any(co.steps[co.i].until); guard++) { co.i++; skipDead(); }
    if (co.i >= co.steps.length || app.S.status !== E.PLAYING) app.coach = null;
    renderCoach();
  }
  function renderCoach() {
    const co = app.coach, hand = $("hand"), txt = $("coach"), V = app.V;
    if (app.focusEl) { app.focusEl.classList.remove("coach-on"); app.focusEl = null; }
    $("line").classList.remove("coach-on");
    V.focus.on = false;
    if (!co || app.screen !== "play" || app.panel || co.i >= co.steps.length) { txt.hidden = true; hand.hidden = true; return; }
    const st = co.steps[co.i], S = app.S, B = app.B;
    let el = null, cm = 0, cn = 0;
    if (st.card) { const j = frontOf(st.card); if (j >= 0) { el = app.cards[j]; cm = st.card; cn = B.cardN[S.front(j)]; } }
    if (!el && st.next) { for (let j = 0; j < E.NCOL && !el; j++) if (!app.nexts[j][0].classList.contains("none")) el = app.nexts[j][0]; }
    if (!el && st.line) el = $("line");
    // A ring on the board: the first gate's key (or the gate once the key is gone), the first standing tower.
    if (st.ring === "key" || st.ring === "gate") { const k = 0, kc = V.keyC[k]; if (B.gateCells.length) { if (st.ring === "key" && kc >= 0 && S.a[kc] > 0) Object.assign(V.focus, { on: true, x: kc % B.w + 0.5, y: ((kc / B.w) | 0) + 0.5, r: 1.1 }); else Object.assign(V.focus, { on: true, x: V.gX[k], y: V.gY[k], r: 1.6 }); } }
    if (st.ring === "tower") { for (let k = 0; k < B.towers.length; k++) if (S.standing & (1 << k)) { const T = B.towers[k]; Object.assign(V.focus, { on: true, x: T.cx + 0.5, y: T.cy + 0.5, r: Math.sqrt(T.size / Math.PI) + 0.9 }); break; } }
    txt.textContent = st.say.replace("{n}", cn).replace("{crew}", cm ? mat(cm).crew : "").replace("{reach}", cm ? S.reachable(cm) : 0);
    txt.hidden = false; fitCoach();
    if (el) { el.classList.add("coach-on"); app.focusEl = el; }
    if (st.line) $("line").classList.add("coach-on");
    placeHand(el);
  }
  // One line: step the font down (layout.coachFontPx [max, min]) until the line fits the bubble.
  function fitCoach() {
    const t = $("coach"), [hi, lo] = app.cfg.layout.coachFontPx; if (t.hidden) return;
    for (let px = hi; px >= lo; px--) { t.style.fontSize = px + "px"; if (t.scrollWidth <= t.clientWidth) break; }
  }
  // The arrow sits above its target and points down at it; a board ring when there is no element.
  function placeHand(el) {
    const hand = $("hand"), V = app.V; let x, y;
    if (el) { const r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + Math.min(8, r.height * 0.3); }
    else if (V.focus.on) { const r = $("board").getBoundingClientRect(), p = V.cssAt(V.focus.x, V.focus.y, app.pt); x = r.left + p.x; y = r.top + p.y - (V.focus.r * V.cs) / V.dpr; }
    else { hand.hidden = true; return; }
    hand.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)"; hand.hidden = false;
  }
  const coachState = () => ({ on: !!app.coach && !$("coach").hidden, i: app.coach ? app.coach.i : -1, text: $("coach").hidden ? "" : $("coach").textContent, hand: !$("hand").hidden,
    target: app.focusEl ? app.focusEl.id || app.focusEl.className : null, ring: app.V.focus.on, oneLine: $("coach").scrollWidth <= $("coach").clientWidth });

  // ---- toasts, audio, toggles ----------------------------------------------------------------------------------------
  function toast(text, bad) { const t = $("toast"); t.textContent = text; t.classList.toggle("bad", !!bad); t.hidden = false; app.toastT = app.clock + app.cfg.show.toastMs; }
  function hideToast() { $("toast").hidden = true; app.toastT = -1e12; }
  function cue(name, arg) { app.cues[name] = (app.cues[name] | 0) + 1; if (app.audio && !app.testing) Audio.cue(app.audio, name, arg, app.clock); }
  function onPop() { cue("pop", app.popK++ % 12); }
  // Pause (portal shape): on window blur or a hidden tab the clock stops and the audio context suspends. In a level the
  // Paused sheet covers everything and takes the tap that resumes, so the tap that brings a player back never plays a
  // card; on the title and map the game just resumes when focus returns. No timers are involved.
  function pause() {
    if (app.paused || !app.cfg) return;
    app.paused = true; app.pauses++; if (app.audio) Audio.suspend(app.audio);
    if (app.screen === "play") $("pause").hidden = false;
  }
  function resume() {
    if (!app.paused) return;
    app.paused = false; app.lastT = 0; $("pause").hidden = true;
    if (app.audio && app.audio.ctx) Audio.unlock(app.audio);
  }
  function setMuted(on, save) { Audio.setMuted(app.audio, on); togMute.forEach((b) => b.setAttribute("aria-pressed", on ? "true" : "false")); if (save) { app.save.data.settings.muted = !!on; writeSave(); } }
  function setFast(on, save) { app.fast = !!on; togFast.forEach((b) => b.setAttribute("aria-pressed", on ? "true" : "false")); if (save) { app.save.data.settings.fast = app.fast; writeSave(); } }
  function setDiff(d, save) { if (DIFFS.indexOf(d) < 0) return; app.diff = d; segs.forEach((b) => b.setAttribute("aria-pressed", b.dataset.diff === d ? "true" : "false")); if (save) { app.save.data.settings.diff = d; writeSave(); } }

  function wire() {
    document.addEventListener("pointerdown", () => { if (app.audio) Audio.unlock(app.audio); }, { capture: true });
    document.addEventListener("keydown", (ev) => {
      if (app.audio) Audio.unlock(app.audio);
      if (app.paused) { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); resume(); } return; }
      if (app.screen !== "play") return;
      if (ev.key >= "1" && ev.key <= "5") playCol(+ev.key - 1);
      else if (ev.key === "r" || ev.key === "R") retry();
      else if (ev.key === " ") { ev.preventDefault(); skip(); }
    });
    $("board").addEventListener("pointerdown", skip);
    $("pause").addEventListener("click", resume);
    window.addEventListener("blur", pause);
    window.addEventListener("focus", () => { if (app.screen !== "play") resume(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else if (app.screen !== "play") resume(); });
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
    // Short and wide (a landscape phone): the top bar moves over the rail so the board gets the full height.
    const short = app.wide && H <= L.shortMaxH;
    document.body.classList.toggle("wide", app.wide); document.body.classList.toggle("short", short);
    const r = document.documentElement.style;
    if (app.wide) { const rw = short ? L.railShortPx : Math.round(Math.min(L.railWidePx, Math.max(L.railMinPx, W * L.railFrac))); r.setProperty("--rail-w", rw + "px"); r.setProperty("--wide-gap", (short ? L.gapShortPx : L.gapWidePx) + "px"); }
    app.labFit.clear();
    if (app.screen === "title") paintTitle();
    fitBoard();
    if (app.S) { renderTop(); renderTray(); }
  }
  function fitBoard() {
    if (!app.B || !app.V) return;
    // Wide: offer the stage every px beside the panel, fit the board, then shrink the stage to it so the board and the
    // panel sit together in the middle (the cell size doesn't change on the second fit).
    const L = app.cfg.layout, r = document.documentElement.style;
    if (app.wide) r.setProperty("--stage-w", Math.max(200, window.innerWidth - (parseFloat(r.getPropertyValue("--rail-w")) || L.railWidePx) - (app.wide && window.innerHeight <= L.shortMaxH ? L.gapShortPx : L.gapWidePx) - L.sidePadPx) + "px");
    const st = $("stage"), w = st.clientWidth - 14, h = st.clientHeight - 16;
    if (w > 0 && h > 0) app.V.layout(w, h, window.devicePixelRatio || 1, app.wide);
    if (app.wide) { const cw = parseFloat($("board").style.width) || 0; if (cw > 0) r.setProperty("--stage-w", Math.ceil(cw + 16) + "px"); }
    document.body.classList.toggle("turned", app.V.rot);
    if (app.coach) { fitCoach(); placeHand(app.focusEl); }
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
      else if (app.endAt < 0) { app.endAt = app.clock + app.cfg.show.panelMs; V.shake(app.cfg.fx.failShake[0], app.cfg.fx.failShake[1]); }
      else if (app.clock >= app.endAt) showPanel();
    }
    if (app.toastT > 0 && app.clock >= app.toastT) hideToast();
  }
  // One rAF frame: real time in, sim time out (nothing moves while paused; the first frame after a resume is 16 ms).
  function advance(t) {
    const dt = app.lastT ? Math.min(app.cfg ? app.cfg.layout.maxDtMs : 100, Math.max(0, t - app.lastT)) : 16;
    app.lastT = t;
    if (app.paused) return;
    step(dt);
    if (app.screen === "play" && app.V) app.V.draw();
  }
  function frame(t) { advance(t); requestAnimationFrame(frame); }

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
    if (app.paused) resume();
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
        startLevel(of.e.id, "normal"); let warned = null; const ov0 = app.cues.overflow | 0;
        for (let i = 0; i < of.o.length; i++) {
          const w0 = app.cues.warn | 0, l0 = app.S.lineLen; playCol(of.o.charCodeAt(i) - 48);
          if (!warned && app.S.status === E.PLAYING && app.S.lineLen === app.S.cap - 1 && app.S.lineLen > l0) warned = { cue: (app.cues.warn | 0) - w0, pulse: app.slots[app.S.lineLen].classList.contains("last") };
        }
        ok(app.S.status === E.FAILED && app.S.reason === "overflow" && app.ending && app.ending.reason === "overflow", "overflow: play() ends the assault with reason overflow");
        ok((app.cues.overflow | 0) === ov0 + 1, "overflow: the overflow cue plays once, on the tap");
        if (warned) ok(warned.cue === 1 && warned.pulse, "line: filling to one free space warns once and pulses that space");
        out.notes.lineWarn = warned ? "checked" : "this order skipped the one-space state";
        let tt = 0; while (app.endAt < 0 && tt < 8000) { step(16); tt += 16; }
        ok(app.V.fxInfo().shaking, "overflow: the board shakes as the fail lands");
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
        // The gate's show, ticked instead of landed: the lock drops, the bars fall in turn, the board shakes, one gate cue.
        startLevel(ge.id, "normal"); let seen = null;
        for (let i = 0; i < ord.length && app.S.status === E.PLAYING && !seen; i++) {
          const c0 = app.cues.gate | 0; playCol(ord.charCodeAt(i) - 48);
          if (!gc.every((c) => app.S.a[c] <= 0)) continue;
          for (let t = 0; t < 6000 && app.V.showOn && app.V.gSt[0] === 0; t += 16) step(16);
          step(48); seen = Object.assign(app.V.fxInfo(), { cue: (app.cues.gate | 0) - c0 });
        }
        ok(!!seen && seen.gates[0] === 1 && seen.lockFalling && seen.falls > 0 && seen.shaking && seen.cue === 1, "gate show: key eaten, the lock drops, the bars crumble, the board shakes, one gate cue (" + JSON.stringify(seen) + ")");
        for (let t = 0; t < 8000 && app.V.showOn; t += 16) step(16);
        step(1500);
        ok(gc.every((c) => app.V.disp[c] <= 0) && app.V.fxInfo().falls === 0 && app.V.gSt[0] === 1, "gate show: the gate is open ground once its show ends");
      }
      // 4. An archer hit on every difficulty (Easy/Normal: back to the line; Hard: killed).
      // The hit is instant in the rules; the show then sends hit runners that an arrow meets at the ring (knocked back
      // on Easy/Normal, falling on Hard), and a tap mid-animation still plays.
      for (const d of DIFFS) {
        // (Hard: a kill always ends the level short, since deals carry no spare sappers; there the Retry key must work mid-show.)
        const lethal = rulesOf(d).archersKill, pred = (S) => (lethal ? S.kills > 0 : S.hits > 0 && S.status === E.PLAYING); let found = null;
        for (const e of app.levels) { if (!(e.L.towers && e.L.towers.length)) continue; const o = search(e, d, pred, app.cfg.selfTest.searchTries, app.cfg.selfTest.searchSeed); if (o) { found = { e, o }; break; } }
        if (!ok(!!found, "archers " + d + ": found an order with a hit")) continue;
        startLevel(found.e.id, d); playOrder(found.o.slice(0, -1)); app.V.fastForward(); playCol(found.o.charCodeAt(found.o.length - 1) - 48);
        ok(lethal ? app.S.kills > 0 : app.S.hits > 0 && app.S.kills === 0, "archers " + d + ": play() records the " + (lethal ? "kill" : "hit") + " at once");
        if (!lethal) ok(app.S.lineLen > 0, "archers " + d + ": the hit sappers wait on the holding line at once");
        const h0 = app.V.hitInfo(); let arrow = false, struck = null;
        ok(h0.live > 0 && h0.kind === (lethal ? 2 : 1), "archers " + d + ": the show sends " + (lethal ? "falling" : "knocked-back") + " hit runners (" + JSON.stringify(h0) + ")");
        for (let t = 0; t < 5000 && app.V.showOn && !struck; t += 16) { step(16); const h = app.V.hitInfo(); if (h.arrows) arrow = true; if (h.struck) struck = h; }
        ok(arrow && !!struck && struck.label, "archers " + d + ": an arrow flies, strikes, and the label rises");
        const j = app.cards.findIndex((b, k) => app.S.front(k) >= 0), p0 = app.S.plays, busy = app.V.showOn;
        if (!lethal) ok(busy && j >= 0 && playCol(j) && app.S.plays === p0 + 1, "archers " + d + ": a tap mid-animation still plays (input never waits on the show)");
        else { ok(app.S.status === E.FAILED && app.S.reason === "short", "archers hard: the kill ends the assault short, at once"); retry(); ok(busy && app.S.plays === 0 && !app.V.showOn && app.S.status === E.PLAYING, "archers hard: Retry mid-animation restarts at once"); }
        out.notes["archer_" + d] = found.e.id + " '" + found.o + "'";
      }
      // 4b. The archer teaching level never kills (safeArchers): on Hard a hit sends the squad to the line and play goes on.
      if (app.byId.has("e3-51")) { const e = app.byId.get("e3-51"), o = search(e, "hard", (S) => S.hits > 0, app.cfg.selfTest.searchTries, app.cfg.selfTest.searchSeed);
        if (ok(!!o, "e3-51 hard: found a tap into the ring")) { startLevel("e3-51", "hard"); playOrder(o); app.V.fastForward(); ok(app.S.hits > 0 && app.S.kills === 0 && app.S.status === E.PLAYING && app.S.lineLen > 0, "e3-51 hard: archers send the hit squad to the line, never kill"); } }
      // 4c. A full holding line pulses and marks every front card: fatal exactly when that tap would end the assault.
      { let fl = null; for (const e of app.levels) { if (e.L.band !== "hard") continue; const o = search(e, "normal", (S) => S.status === E.PLAYING && S.lineLen >= S.cap, app.cfg.selfTest.searchTries, app.cfg.selfTest.searchSeed); if (o) { fl = { e, o }; break; } }
        if (ok(!!fl, "full line: found an order that fills the line")) {
          startLevel(fl.e.id, "normal"); playOrder(fl.o); app.V.fastForward(); let right = true, marked = 0;
          for (let j = 0; j < E.NCOL; j++) { if (app.S.front(j) < 0) continue; const c = app.cards[j].classList, T = E.sim(app.B, rulesOf("normal")); T.load(app.S.save()); T.play(j); marked++; if (c.contains("fatal") !== (T.status === E.FAILED) || c.contains("safe") === c.contains("fatal")) right = false; }
          ok($("line-wrap").classList.contains("full") && marked > 0 && right, "full line: the line pulses and every front card is marked safe or fatal, correctly (" + fl.e.id + " '" + fl.o + "')"); } }
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
      // The win: the keep's last blocks fall with a collapse, the goblin flees, the panel stamps this difficulty's medal.
      delete app.save.data.done[app.levels[0].id];
      const w1 = app.levels[0].L.win.normal, col0 = app.cues.collapse | 0; let falls = 0;
      playOrder(w1.slice(0, -1)); app.V.fastForward(); playCol(w1.charCodeAt(w1.length - 1) - 48);
      for (let t = 0; t < 6000 && app.V.showOn; t += 16) { step(16); falls = Math.max(falls, app.V.fxInfo().falls); }
      step(16); step(16); const kf = app.V.fxInfo();
      ok(falls > 0 && kf.keep && kf.shaking && app.V.gob.on && (app.cues.collapse | 0) === col0 + 1 && (app.cues.fanfare | 0) > 0, "win: the last blocks fall, then the keep comes down with a shake and one collapse, the fanfare plays");
      tick(8000);
      ok(app.panel === "win" && hitOK($("p-primary")), "hit: the win panel's Next");
      ok(!$("p-medals").hidden && $("p-medals").querySelectorAll(".medal.new").length === 1, "win: the panel stamps the new Normal medal");
      // Pause: nothing moves and the sheet takes the tap; one tap resumes with no jump in time and no card played.
      startLevel(app.levels[0].id, "normal");
      pause(); const pc = app.clock; advance(1000); advance(1600);
      ok(app.paused && app.clock === pc && !$("pause").hidden && hitOK($("pause")) && !hitOK(app.cards[0]), "pause: the clock stops and the Paused sheet covers the cards");
      $("pause").click(); advance(5000); advance(5016);
      ok(!app.paused && $("pause").hidden && app.clock - pc <= 32 && app.S.plays === 0, "pause: one tap resumes, the clock moves on without a jump, no card played");
      app.lastT = 0;
      // The teaching coach: each script shows its first line and its arrow at load, advances as the stored order plays,
      // and is gone once the level is won. Plus the specific lessons: the line step on level 2, the tower ring on 51.
      for (const id of Object.keys(app.cfg.teach || {})) {
        if (id === "note") continue;
        const e = app.byId.get(id); if (!ok(!!e, "coach: level " + id + " exists")) continue;
        startLevel(id, "normal"); const c0 = coachState(), steps = app.cfg.teach[id];
        ok(c0.on && c0.text.length > 0 && c0.oneLine && c0.text.indexOf("{") < 0 && (c0.hand || c0.ring), id + ": one coach line (fits one line) with its arrow at load (" + c0.text + ")");
        if (app.focusEl) ok(hitOK(app.focusEl), id + ": the arrow never covers its target");
        const seen = new Set([c0.i]); let last = c0.i, mono = true;
        for (const ch of e.L.win.normal) { playCol(+ch); app.V.fastForward(); const cs = coachState(); if (cs.i >= 0) { if (cs.i < last) mono = false; last = cs.i; seen.add(cs.i); } }
        ok(mono && !coachState().on && app.S.status === E.WON, id + ": on the stored order the coach only moves forward (" + Array.from(seen).join(",") + ") and is gone at the win");
        // A first-time player who taps what the arrow points at (the leftmost card when it points elsewhere) sees every step.
        startLevel(id, "normal"); const saw = new Set();
        for (let g = 0; g <= app.B.ncards && app.S.status === E.PLAYING; g++) {
          const cs = coachState(); if (cs.on) saw.add(cs.i);
          let jj = app.focusEl ? app.cards.indexOf(app.focusEl) : -1; if (jj < 0 || app.S.front(jj) < 0) jj = app.cards.findIndex((b, k) => app.S.front(k) >= 0);
          playCol(jj); app.V.fastForward();
        }
        ok(saw.size === steps.length && app.S.status === E.WON && !coachState().on, id + ": following the arrow shows all " + steps.length + " steps (" + Array.from(saw).join(",") + ") and wins");
        out.notes["coach_" + id] = Array.from(seen).join(",") + " / " + Array.from(saw).join(",");
      }
      if (app.byId.has("e1-02")) { startLevel("e1-02", "normal"); playCol(frontOf(3)); const cs = coachState(); ok(cs.i === 1 && app.focusEl === $("line"), "coach e1-02: the Torchbearers wait, the arrow moves to the holding line"); }
      if (app.byId.has("e3-51")) { startLevel("e3-51", "normal"); ok(app.V.focus.on && coachState().target && /card/.test(coachState().target), "coach e3-51: the tower wears the ring and the arrow points at the Quarrymen"); }
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
    solve: (nodes) => solveHere(nodes), selfTest, coach: coachState, cues: () => Object.assign({}, app.cues), fx: () => app.V.fxInfo(), hits: () => app.V.hitInfo(),
    paused: () => app.paused, pause: () => { pause(); return app.paused; }, resume: () => { resume(); return app.paused; }, winOrder: (d) => (app.entry ? app.entry.L.win[d || app.diff] : null), lossOrder: (id, d) => lossOrder(resolve(id), d),
    screen: (name) => { showScreen(name); return state(); }, skip: () => { skip(); return state(); },
    // Cost of n board draws right now (ms): the harness calls it mid-show on the busiest play.
    perf: (n) => { const k = Math.max(1, Math.min(500, n | 0 || 60)); let max = 0; const t0 = performance.now(); for (let i = 0; i < k; i++) { const a = performance.now(); app.V.draw(); max = Math.max(max, performance.now() - a); } return { mean: +((performance.now() - t0) / k).toFixed(3), max: +max.toFixed(3), runners: app.V.rN, launched: app.V.rLaunched }; },
    sprites: () => app.V.checkSprites(),
    // The play with the most eats across every level's stored Normal order: {n, i} (level number, tap index).
    busiest: () => { let best = { n: 0, i: 0, eats: -1 }; for (const e of app.levels) { const B = E.compile(e.L), S = E.sim(B, rulesOf("normal")), o = e.L.win.normal; S.logOn = true;
      for (let i = 0; i < o.length; i++) { S.clearLog(); S.play(o.charCodeAt(i) - 48); let k = 0; for (let j = 0; j < S.evLen; j += 3) if (S.ev[j] === E.EV.EAT) k++; if (k > best.eats) best = { n: e.n, i, eats: k }; } } return best; } };

  boot();
})();
