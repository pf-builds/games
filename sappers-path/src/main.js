// Sapper's Path page v3 (SPEC-v3 §3, §6, §7): boot, screens (title, era map, play), layout, input (a tap on a front
// card plays that column; a board tap skips the show), the holding line and tray, the win/fail panel, save, the frame
// loop, and the ?debug=1 facade (window.SP) with selfTest. The rules live in engine.js, the board and the run-and-carry
// show in board.js, the title scene, wall and goblin sprites in art.js, the synth in audio.js.
//
// Playtest 1 (the dispatch model): the engine is a timed simulation. A tap takes a holding space at once (no free space:
// refused, v3.1); its sappers go out only to pixels they can reach, a round at a time, and the space frees when they are all
// home. The page plays engine time at show.pace x real time (2x doubles it), reads the engine's log into the board every
// step, and draws engine state. Cards stay live at any time; a board tap (or Space) skips: the engine runs until nothing
// moves and the board lands. Win and fail sheets wait for the squads to settle, at most show.settleCapMs after the end.
// Clock: app.clock is sim time in ms. The rAF loop advances it by the real frame delta (capped at layout.maxDtMs);
// SP.tick(ms) advances it by hand, so a hidden tab (no rAF) can still be driven. The engine, the goblin, the panel delay
// and toasts all run on this clock; nothing here uses setTimeout or setInterval.
// M2: the teaching coach (config.teach: one line and a bouncing arrow on what to tap, advanced by play), the sound set
// (tap, a throttled pop per pixel, haul, line fill and near-jam warning, jam, blocked, gate, arrows, collapse, fanfare), the
// win beat (difficulty medals), and portal shape: pause on blur or a hidden tab (the clock stops and the audio context
// suspends; a Paused sheet takes the next tap so it can never play a card), and the board turned a quarter in landscape.
// Fix pass: the level's name sits over its difficulty and steps its size down to fit (never an ellipsis), a full
// holding line marks each front card blocked (or safe, merge flag only; run on a play, never per frame), and wide
// screens put every control in one side panel.
// v3.1: a tap with no free space is refused (the card shakes, a toast, a soft "blocked" sound, all throttled by
// show.blockedGapMs; no input lock). The overflow fail is gone: the fail is a jammed line (every space held by a squad
// that can't reach a block, found at rest). Each space reads stuck (hatched, a lock) or working (gold rim, a walking
// marker, the figures step); one space left with every other squad stuck warns ("One space left", the last space pulses);
// a full line marks each front card blocked. Victory march: once the tray is empty and a scratch copy run to rest wins,
// the show plays at show.victoryPace (never slower than the speed button) until the sheet.
// v4 M1 (the look pass): the queue is colour first (solid tiles with a big count, no crew names) and shows three rows,
// the front one tappable and two faded behind; the holding spaces are bigger; the speed button cycles 1x, 2x, 3x; a
// colour-blind toggle on the title and the map puts the material marks on the blocks and a glyph on the tiles. Both
// settings live in the save. The board's flat studs and retuned palette are board.js and config.json.
// v4 M2 (the twists; rules in engine.js): a hidden mystery card's tile shows "?" and its count on a neutral tile in every
// row (no colour, crew or glyph anywhere in the DOM) and flips as it reaches the front; linked tiles are joined by a rod
// (an SVG over the tray), or wear a stub toward the partner's column when the partner is below the visible rows; a
// refused linked tap shakes both tiles and says why; linked spaces wear a chain, and a finished one holds its space
// (dimmed) for its partner; a lock level's last space is a padlocked socket that pops open with a cue when its key goes.
// The jam sheet says why (linked squads needing 2 spaces, a space still locked). Under ?debug=1 the map has a "v4
// twists" row of debug levels (levels/debug-v4.json), kept out of the save's progress.
// v4 M3 (the Siege to 100; levels in the rebaked levels.json): a fourth era on the map, the coach's pointers and
// conditions for the twists' teaching levels (35, 62, 76, 77), and a tile's flip or shake landing when a level starts.
// v4 Critics 1 fix (presentation only): the line and queue sit on a light stone tray; the rows behind the front fade
// toward the tray colour and step down in size (layout.fade; never opacity); rods run centre to centre under the counts
// with a rivet on each tile, and partners two rows apart (or below the visible rows) run down the column gutter; a
// linked tile wears a chain. The coach has its own band for the whole level (above the board, else over the level's
// name, or in the side column on wide screens), fits one line or two, and its arrow comes in from the side for a tile
// and from above for a space (the head's count steps aside), never over a count. The board is told which colours the
// player can send (V.hot) so only the archer rings that matter are loud. The jam sheet shows colour chips (names in its
// aria-label); win and fail sheets never slice the holding line (placeSheet). Wide screens: the side column is the
// board's height (--blk-h). The victory march's label shows the pace in use.
// Critics 1 fix 2: rods run between rivets on the tiles' facing rims, never over a face; the rows behind sit on darker
// tray bands (layout.fade.band); the desktop tray ends at the queue; in the top bar the coach sits beside the level's
// number, one line (a step's short text).
// v4 M4, the Gallery (levels/gallery.json, config.gallery): picture levels on ring boards with their own palettes. The
// Gallery screen (a grid of the pictures: dimmed until won, then in colour with its title; the count; a plain-text
// credits line, no links) opens from the title and the map once siege level gallery.openAt is won; before that both
// buttons are locked and say so. Every picture is open once the Gallery is; a win goes in the save's gal (per
// difficulty, like the siege). A picture level uses its palette everywhere a colour shows (app.mats: tiles, spaces,
// chips, the board, the sappers' helmets) and its colour names wherever a crew name would be read (aria-labels, the jam
// sheet's label). The win sheet offers the next picture not yet won; the top bar's map button goes back to the Gallery.
(function () {
  "use strict";
  const NS = window.SappersPath, E = NS.engine, Save = NS.save, Board = NS.board, Art = NS.art, Audio = NS.audio;
  const V_ = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const DIFFS = Save.DIFFS, DNAME = { easy: "Easy", normal: "Normal", hard: "Hard" }, $ = (id) => document.getElementById(id);
  const app = { cfg: null, levels: [], byId: new Map(), order: [], eras: [], save: null, entry: null, B: null, S: null, V: null, audio: null, sheets: null, gal: [], mats: null, palKey: "", galTiles: [],
    clock: 0, lastT: 0, screen: "title", diff: "normal", speed: 1, cb: false, ending: null, endAt: -1, panel: null, panelAt: 0, testing: false,
    toastT: -1e12, popK: 0, cards: [], nexts: [], slots: [], wide: false, glURL: [], manURL: [], nodes: [], lastW: 0, lastH: 0,
    coach: null, used: 0, cues: {}, paused: false, pauses: 0, focusEl: null, pt: { x: 0, y: 0 }, T: null, tbuf: null, labFit: new Map(), verdict: [],
    et: 0, endT: -1, lineDirty: false, lineMoved: false, ord: [], slotPts: [], blockT: -1e12, refused: 0, march: false,
    debug: [], flip: [false, false, false, false, false], rods: null, unlockT: -1e12, lockN: 0, reveals: 0, pairsOut: 0,
    fadeC: null, coached: false, coachMode: "", handKind: "", meas: null,
    li: { stuck: 0, work: 0, occ: 0, free: 0, near: false, full: false, danger: false } };
  const togMute = Array.from(document.querySelectorAll(".tog-mute")), togSpeed = Array.from(document.querySelectorAll(".tog-speed")), togCb = Array.from(document.querySelectorAll(".tog-cb"));
  const segs = Array.from(document.querySelectorAll(".seg button"));

  // ---- boot --------------------------------------------------------------------------------------------------------
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }
  async function boot() {
    try {
      const [cfg, lv] = await Promise.all([getJSON("config.json?v=" + V_), getJSON("levels/levels.json?v=" + V_)]);
      app.cfg = cfg; indexLevels(lv);
    } catch (e) { $("load-msg").textContent = "Couldn't load the siege. Reload to try again."; return; }
    if (DEBUG) { try { indexDebug(await getJSON("levels/debug-v4.json?v=" + V_)); } catch (e) { /* no debug row */ } }
    try { indexGallery(await getJSON("levels/gallery.json?v=" + V_)); } catch (e) { /* no Gallery: its buttons stay hidden */ }
    if (!app.levels.length) { $("load-msg").textContent = "No levels found."; return; }
    app.save = Save.open(storage(), app.cfg.save.key, app.order, app.gal.map((e) => e.id)); app.mats = app.cfg.v3.mats;
    app.diff = app.save.data.settings.diff;
    app.sheets = Art.sources(app.cfg.art); fades();
    app.V = Board.create($("board"), app.cfg, app.sheets);
    const H = app.V.hooks;
    H.pop = onPop; H.deposit = () => cue("haul"); H.gate = () => cue("gate"); H.tower = () => cue("tower"); H.shot = () => cue("arrow");
    H.hit = (k) => cue(k === 2 ? "fall" : "thud"); H.collapse = () => cue("collapse");
    H.tap = () => { app.lineDirty = true; }; H.free = () => { app.lineDirty = true; }; H.move = () => { app.lineMoved = true; };
    H.reveal = (ci, j) => { if (app.S && app.S.front(j) === ci) { app.flip[j] = true; cue("flip"); } app.reveals++; app.lineDirty = true; };
    H.link = () => { app.pairsOut++; app.lineDirty = true; };
    H.unlock = () => { app.unlockT = app.clock; cue("unlock"); app.lineDirty = true; };
    try { app.V.calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* motion stays on */ }
    app.audio = Audio.create(app.cfg.audio);
    setMuted(app.save.data.settings.muted, false); setSpeed(app.save.data.settings.speed, false); setCb(app.save.data.settings.cb, false); setDiff(app.diff, false);
    paintWall(); chips(); buildTray(); buildLine(); buildMap(); buildGallery(); wire();
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
  // v4 M2 debug levels (?debug=1 only): reachable by id and from the map's "v4 twists" row, never in the play order, so
  // they never touch the save's progress.
  function indexDebug(lv) {
    for (const L of lv && Array.isArray(lv.levels) ? lv.levels : []) {
      try { E.compile(L); } catch (e) { continue; }
      const id = String(L.id); if (app.byId.has(id)) continue;
      const entry = { L, id, n: 0, era: 0, idx: -1, node: null, debug: true };
      app.debug.push(entry); app.byId.set(id, entry);
    }
  }
  // v4 M4 Gallery levels: by id, in the Gallery's order; never in the siege's play order.
  function indexGallery(lv) {
    for (const L of lv && Array.isArray(lv.levels) ? lv.levels : []) {
      try { E.compile(L); } catch (e) { continue; }
      const id = String(L.id); if (app.byId.has(id)) continue;
      const entry = { L, id, n: L.n | 0, era: 0, idx: -1, node: null, gallery: true };
      app.gal.push(entry); app.byId.set(id, entry);
    }
  }
  function storage() { try { const s = window.localStorage; s.getItem("sappers-path.probe"); return s; } catch (e) { return Save.memoryStore(); } }
  const rulesOf = (d) => E.rulesOf(app.cfg.v3, d);
  const mat = (m) => (app.mats || app.cfg.v3.mats)[m] || { n: "?", c: "#888888", crew: "?" };
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
  // Material glyphs (the queue tiles' mark in colour-blind mode, used as a CSS mask so it takes the tile's text colour) and
  // sapper figures (holding line) as image URLs, drawn by board.js.
  function chips() {
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), s = Math.round(app.cfg.layout.glyphPx * dpr);
    for (let m = 1; m < E.NMAT; m++) { try { app.glURL[m] = "url(" + app.V.glyph(m, s, "#ffffff").toDataURL() + ")"; } catch (e) { app.glURL[m] = "none"; } }
    men();
  }
  // The sappers' figures in the holding line, helmets in the board's current colours (v4 M4: a Gallery level's palette).
  function men() {
    const ms = Math.round(app.cfg.layout.manPx * Math.min(3, Math.max(1, window.devicePixelRatio || 1)));
    for (let m = 1; m < E.NMAT; m++) { try { const f = app.V.man(m, ms), c = document.createElement("canvas"); c.width = ms; c.height = ms; c.getContext("2d").drawImage(f, 0, 0, ms, ms, 0, 0, ms, ms); app.manURL[m] = "url(" + c.toDataURL() + ")"; } catch (e) { app.manURL[m] = "none"; } }
  }

  // ---- tray, holding line, map (built once, updated in place) ------------------------------------------------------
  // v4 M1, the queue: colour first. Each column shows layout.queueRows tiles at full size, each a solid tile in its
  // material's colour with a big count (no crew name, no swatch; the material's glyph only in colour-blind mode): the
  // front one is the tap target (a raised button), the ones behind sit back, flat and progressively faded, so three moves
  // ahead read at a glance.
  function buildTray() {
    const tray = $("tray"), inner = '<b class="n"></b><i class="gl" aria-hidden="true"></i><i class="q" aria-hidden="true"></i><i class="ch" aria-hidden="true"></i>';
    for (let j = 0; j < E.NCOL; j++) {
      const col = document.createElement("div"); col.className = "col";
      const b = document.createElement("button"); b.className = "tile card"; b.dataset.col = j; b.innerHTML = inner;
      b.addEventListener("click", () => { playCol(j); });
      col.append(b); app.cards.push(b);
      const nx = [];
      for (let d = 1; d < app.cfg.layout.queueRows; d++) { const x = document.createElement("div"); x.className = "tile next d" + d; x.setAttribute("aria-hidden", "true"); x.innerHTML = inner; col.append(x); nx.push(x); }
      app.nexts.push(nx); tray.append(col);
    }
    app.rods = document.createElementNS("http://www.w3.org/2000/svg", "svg"); app.rods.setAttribute("class", "rods"); app.rods.setAttribute("aria-hidden", "true"); tray.append(app.rods);
  }
  function buildLine() {
    const line = $("line");
    for (let i = 0; i < app.cfg.layout.lineSlots; i++) { const s = document.createElement("div"); s.className = "slot"; s.innerHTML = '<i class="men"></i><b></b><em class="out"></em><i class="lk"></i><i class="pad"></i>'; line.append(s); app.slots.push(s); }
  }
  // Text on a colour: white or ink, whichever has the higher contrast (WCAG relative luminance).
  const INK = "#221a26", relLum = (hex) => { const v = parseInt(hex.slice(1), 16), f = (s) => { const x = ((v >> s) & 255) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(16) + 0.7152 * f(8) + 0.0722 * f(0); };
  const textOn = (hex) => { const L = relLum(hex); return 1.05 / (L + 0.05) >= (L + 0.05) / (relLum(INK) + 0.05) ? "#ffffff" : INK; };
  // d (the row behind the front, 0 = the front): the tile's face is its colour faded toward the tray (--fc, app.fadeC);
  // --mc stays the material's own colour.
  function paintMat(el, m, d) { const c = mat(m).c, f = d ? app.fadeC[d][m] : c, t = textOn(f); el.style.setProperty("--mc", c); el.style.setProperty("--fc", f); el.style.setProperty("--tc", t); el.style.setProperty("--oc", t === INK ? "rgba(255,255,255,.45)" : "rgba(20,16,28,.7)"); el.style.setProperty("--gl", app.glURL[m] || "none"); }
  // A hidden mystery card (v4 M2): the face-down tile of layout.mystery and its "?" glyph; nothing of the card's colour.
  function paintMys(el, d) { const Y = app.cfg.layout.mystery; el.style.setProperty("--mc", Y.c); el.style.setProperty("--fc", d ? app.fadeC[d][0] : Y.c); el.style.setProperty("--tc", Y.tc); el.style.setProperty("--oc", "rgba(20,16,28,.7)"); el.style.setProperty("--gl", "none"); }
  // Critics 1 fix: the faded faces, once per boot: row d mixes layout.fade.t[d] of the tray colour into each material's
  // colour (sRGB); index 0 is the mystery card's back. The tray colour goes to CSS (--tray) from the same place.
  const mixHex = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), ch = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); };
  function fades() {
    const F = app.cfg.layout.fade, rs = document.documentElement.style; rs.setProperty("--tray", F.tray);
    F.band.forEach((t, d) => { if (d) rs.setProperty("--band" + d, mixHex(F.tray, "#000000", t)); }); // the rows' tray bands (fix 2)
    fadeRows();
  }
  function fadeRows() { const F = app.cfg.layout.fade; app.fadeC = F.t.map((t) => { const row = [mixHex(app.cfg.layout.mystery.c, F.tray, t)]; for (let m = 1; m < E.NMAT; m++) row.push(mixHex(mat(m).c, F.tray, t)); return row; }); }
  // v4 M4: the level's colours. A Gallery level's pal overrides config's colours by id and names each one (its crew, for
  // aria-labels and the jam sheet, is the colour's name); the faded rows and the sappers' figures follow. Cached by palette.
  function usePalette(e) {
    const P = e && e.L.pal, base = app.cfg.v3.mats, key = P ? JSON.stringify(P) : "";
    if (key === app.palKey) return;
    app.palKey = key; app.mats = !P ? base : base.map((m, k) => (P[k] ? { n: P[k].n, c: P[k].c, crew: P[k].n.charAt(0).toUpperCase() + P[k].n.slice(1) } : m));
    fadeRows(); men();
  }
  // Fit a label to its box: the CSS size, stepped down in one measure (cached per text until the next resize).
  function fitText(el, key, min) {
    let px = app.labFit.get(key);
    if (px == null) { el.style.fontSize = ""; const base = parseFloat(getComputedStyle(el).fontSize) || 14; px = base;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 0.5) px = Math.max(min, Math.floor((base * el.clientWidth * 10) / el.scrollWidth) / 10);
      if (el.clientWidth > 0) app.labFit.set(key, px); }
    el.style.fontSize = px + "px";
  }
  function renderTray() {
    const S = app.S, B = app.B, live = S && S.status === E.PLAYING && !app.panel, LY = app.cfg.layout, SH = app.cfg.show;
    for (let j = 0; j < E.NCOL; j++) {
      const b = app.cards[j], f = S ? S.front(j) : -1;
      if (f < 0) { b.className = "tile card empty"; b.disabled = true; b.querySelector(".n").textContent = ""; b.querySelector(".q").textContent = ""; b.style.removeProperty("--mc"); b.style.removeProperty("--gl"); b.setAttribute("aria-label", "Empty column"); app.flip[j] = false; }
      else {
        const m = B.cardM[f], k = B.cardN[f], p = S.partner(f);
        b.className = "tile card" + (app.verdict[j] === 1 ? " safe" : app.verdict[j] === 2 ? " blocked" : "") + (p >= 0 ? " linked" + (B.cardCol[p] < j ? " ch-r" : "") : ""); b.disabled = !live; paintMat(b, m); // ch-r: the chain tag on the corner away from the rod
        b.querySelector(".n").textContent = k; b.querySelector(".q").textContent = "";
        b.setAttribute("aria-label", mat(m).crew + ", " + k + " sappers" + (p >= 0 ? ", " + LY.linkedAria.replace("{c}", B.cardCol[p] + 1) : "") + (app.verdict[j] === 2 ? ", blocked: " + (p >= 0 ? LY.linkedText : "no free space") : app.verdict[j] === 1 ? ", safe" : ""));
        // A mystery card that just reached the front turns over (presentation only).
        if (app.flip[j]) { app.flip[j] = false; if (!app.V.calm && b.animate) b.animate([{ transform: "perspective(240px) rotateY(90deg)" }, { transform: "none" }], { duration: SH.flipMs, easing: "ease-out" }); }
      }
      for (let d = 1; d <= app.nexts[j].length; d++) {
        const x = app.nexts[j][d - 1], ci = S ? S.card(j, d) : -1;
        if (ci < 0) { x.className = "tile next d" + d + " none"; x.querySelector(".n").textContent = ""; x.querySelector(".q").textContent = ""; continue; }
        const hid = S.hidden(ci);
        const xp = S.partner(ci); x.className = "tile next d" + d + (hid ? " mys" : "") + (xp >= 0 ? " linked" + (B.cardCol[xp] < j ? " ch-r" : "") : "");
        if (hid) paintMys(x, d); else paintMat(x, B.cardM[ci], d);
        x.querySelector(".n").textContent = B.cardN[ci]; x.querySelector(".q").textContent = hid ? LY.mystery.q : "";
      }
    }
    drawRods(); sendable();
  }
  // The colours the player can send now (front cards and squads in the line), for the board's archer rings (V.hot).
  function sendable() {
    const S = app.S, B = app.B; let m = 0;
    if (S && S.status === E.PLAYING) { for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0) m |= 1 << B.cardM[f]; } for (let i = 0; i < S.cap; i++) if (S.spQ[i]) m |= 1 << S.spM[i]; }
    app.V.hot = m;
  }
  // v4 M2: the rods between linked tiles, as SVG paths over the tray. Critics 1 fix 2: a rod never touches a tile's
  // face, so it never crosses a count. Each end is a rivet on the rim of its tile's edge that faces the partner's column,
  // at the tile's middle; the rod runs between the rivets in the gaps: straight when that line stays out of every tile
  // (partners in neighbouring columns at most one row apart: through the four-tile corner), else down the gutter between
  // the two columns. A partner below the visible rows: along the gutter past its column's last visible row, then two
  // dots. Sizes are layout.rod at a phone tile, scaled with the tile. Each pair is drawn once (from its card nearer the
  // front). Run with the tray, never per frame.
  function tileOf(j, d) { return d ? app.nexts[j][d - 1] : app.cards[j]; }
  function rowOf(S, j, ci) { for (let d = 0; d < app.cfg.layout.queueRows; d++) { const c = S.card(j, d); if (c < 0) return -1; if (c === ci) return d; } return -1; }
  function drawRods() {
    const S = app.S, B = app.B, svg = app.rods; if (!svg) return;
    let html = "";
    if (S && B && B.nlinks) {
      const R = app.cfg.layout.rod, RW = app.cfg.layout.queueRows, f = (v) => v.toFixed(1);
      // A tile's layout box in the tray (offsets ignore a flip or shake in progress, which would narrow or move its rect).
      const box = (el) => { const l = el.offsetLeft, t = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight; return { x: l + w / 2, y: t + h / 2, hw: w / 2, hh: h / 2, l, r: l + w, t, b: t + h }; };
      const k = Math.max(0.7, Math.min(1.4, (box(app.cards[0]).hh * 2) / 52)), rv = R.rivet * k, sw = 'stroke-linecap="round" stroke-linejoin="round"';
      // Every shown tile's box, for the straight rod's check.
      const tiles = []; for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < RW; d++) { const el = tileOf(j, d); if (!el.classList.contains("none") && !el.classList.contains("empty") && el.offsetWidth) tiles.push(box(el)); }
      const inside = (x, y) => tiles.some((q) => x > q.l + 1 && x < q.r - 1 && y > q.t + 1 && y < q.b - 1);
      const clear = (P) => { for (let i = 0; i + 3 < P.length; i += 2) for (let u = 1; u < 16; u++) if (inside(P[i] + ((P[i + 2] - P[i]) * u) / 16, P[i + 1] + ((P[i + 3] - P[i + 1]) * u) / 16)) return false; return true; };
      // The gutter between neighbouring columns j and pj: midway between their front tiles' facing edges.
      const gutter = (j, pj) => { const a = box(app.cards[j]), b = box(app.cards[pj]); return pj > j ? (a.r + b.l) / 2 : (a.l + b.r) / 2; };
      const rod = (P) => { let d = "M" + f(P[0]) + " " + f(P[1]); for (let i = 2; i < P.length; i += 2) d += "L" + f(P[i]) + " " + f(P[i + 1]);
        return '<path d="' + d + '" stroke="' + R.ink + '" stroke-width="' + f(R.w * k) + '" ' + sw + '/><path d="' + d + '" stroke="' + R.metal + '" stroke-width="' + f(R.core * k) + '" ' + sw + '/><path d="' + d + '" stroke="' + R.hi + '" stroke-width="' + f(Math.max(1, k)) + '" ' + sw + ' transform="translate(0 -1)" opacity=".6"/>'; };
      const rivet = (x, y) => '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rv) + '" fill="' + R.metal + '" stroke="' + R.ink + '" stroke-width="' + f(1.6 * k) + '"/><circle cx="' + f(x - rv * 0.3) + '" cy="' + f(y - rv * 0.3) + '" r="' + f(rv * 0.35) + '" fill="' + R.hi + '" opacity=".8"/>';
      for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < RW; d++) {
        const ci = S.card(j, d); if (ci < 0) break;
        const p = S.partner(ci); if (p < 0) continue;
        const pj = B.cardCol[p], pd = rowOf(S, pj, p), a = box(tileOf(j, d)), right = pj > j, ax = right ? a.r : a.l, gx = gutter(j, pj);
        if (pd >= 0) {
          if (pd < d || (pd === d && pj < j)) continue;
          const b = box(tileOf(pj, pd)), bx = right ? b.l : b.r;
          let P = [ax, a.y, bx, b.y];
          if (Math.abs(pj - j) !== 1 || !clear(P)) P = [ax, a.y, gx, a.y, gx, b.y, bx, b.y];
          html += rod(P) + rivet(ax, a.y) + rivet(bx, b.y);
          continue;
        }
        // Stub: along the gutter toward the partner's column, past its last visible row, then two dots.
        const y2 = Math.max(a.y + a.hh, box(tileOf(pj, RW - 1)).b - R.stub * k * 0.4);
        html += rod([ax, a.y, gx, a.y, gx, y2]) + rivet(ax, a.y);
        for (let q = 1; q <= 2; q++) html += '<circle class="dot" cx="' + f(gx) + '" cy="' + f(y2 + R.cap * k * 2.3 * q) + '" r="' + f(R.cap * k * 0.8) + '" fill="' + R.metal + '" stroke="' + R.ink + '" stroke-width="1"/>';
      }
    }
    if (svg.innerHTML !== html) svg.innerHTML = html;
  }
  // Every open space taken: each front card is marked blocked (a tap now is refused until a squad comes home) or safe (it
  // can merge, only with the comparison flag on). v4 M2: with one space left, a linked front card is blocked too (it needs
  // 2). Run when the line changes, never per frame.
  function judge() {
    const S = app.S, live = S && S.status === E.PLAYING && !app.panel, full = live && S.lineLen >= S.open;
    for (let j = 0; j < E.NCOL; j++) app.verdict[j] = 0;
    if (!live) return false;
    let any = false;
    for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f < 0) continue; if (S.refused(j)) { app.verdict[j] = 2; any = true; } else if (full) app.verdict[j] = 1; }
    return full || any;
  }
  // The line at a glance (into app.li, no allocation): squads stuck (nothing they can reach, all home), working (sappers
  // out), free spaces; near = one space left and every other squad but one stuck; danger = full and at most one working.
  function readLine() {
    const S = app.S, li = app.li; li.stuck = 0; li.work = 0; li.occ = 0;
    for (let i = 0; i < S.cap; i++) { if (!S.spQ[i]) continue; li.occ++; if (S.stuck(i)) li.stuck++; else if (S.spO[i] > 0) li.work++; }
    const live = S.status === E.PLAYING && !app.panel;
    li.free = S.open - li.occ; li.full = live && li.free === 0; li.danger = li.full && li.stuck >= li.occ - 1;
    li.near = live && li.free === 1 && li.occ > 0 && li.stuck >= li.occ - 1;
    return li;
  }
  // The holding spaces, straight from the engine: a squad's space shows its colour and the sappers still waiting there.
  // Stuck (nothing it can reach, all home): hatched with a lock. Working: a gold rim and a walking marker with the number
  // out. The head says the line's state and counts stuck, working and free. The counts are the engine's.
  function renderLine() {
    const S = app.S; if (!S) return;
    app.lineDirty = false;
    $("line").style.setProperty("--cap", S.cap);
    const li = readLine(), L = app.cfg.layout, wrap = $("line-wrap"), march = app.march && !app.panel;
    wrap.classList.toggle("full", li.full); wrap.classList.toggle("danger", li.danger); wrap.classList.toggle("near", li.near && !li.full); wrap.classList.toggle("march", march);
    $("line-lab").textContent = march ? L.marchText.replace("{x}", Math.max(app.speed, app.cfg.show.victoryPace)) : li.full ? L.fullText : li.near ? L.nearText : L.lineText; // the pace in use
    let cnt = li.stuck ? li.stuck + " " + L.stuckWord : "";
    if (li.work) cnt += (cnt ? " · " : "") + li.work + " " + L.workWord;
    if (li.free) cnt += (cnt ? " · " : "") + li.free + " " + L.freeWord;
    $("line-cnt").textContent = cnt;
    let free = -1; for (let i = 0; i < S.open; i++) if (!S.spQ[i]) { free = free < 0 ? i : free; }
    const popping = app.clock - app.unlockT < app.cfg.show.unlockMs;
    app.slots.forEach((s, i) => {
      s.hidden = i >= S.cap;
      const shut = i < S.cap && i >= S.open, opening = !shut && popping && i < S.cap && i >= S.cap - app.lockN;
      s.classList.toggle("locked", shut); s.classList.toggle("unlocking", opening);
      if (i < S.cap && S.spQ[i]) { const m = S.spM[i], w = S.spW[i], o = S.spO[i], st = S.stuck(i), lk = S.spL[i] !== 0, held = S.held(i); s.classList.add("full"); s.classList.toggle("work", o > 0); s.classList.toggle("stuck", st); s.classList.toggle("linked", lk); s.classList.toggle("held", held); paintMat(s, m); s.querySelector("b").textContent = w || "";
        s.querySelector(".out").textContent = o > 0 ? o : "";
        const men = s.querySelector(".men"); men.style.backgroundImage = app.manURL[m]; men.style.width = "calc(var(--man) * " + Math.min(w, L.sapperIcons) + ")";
        s.setAttribute("aria-label", mat(m).crew + ", " + w + " waiting" + (o ? ", " + o + " out" : "") + (st ? ", stuck: nothing in reach" : "") + (lk ? ", " + L.linkedWord : "") + (held ? ", " + L.heldText : "")); }
      else { s.classList.remove("full", "work", "stuck", "linked", "held"); s.style.removeProperty("--mc"); s.querySelector("b").textContent = ""; s.querySelector(".out").textContent = ""; s.querySelector(".men").style.width = "0"; s.setAttribute("aria-label", shut ? L.lockedText : "Empty space"); }
      s.classList.toggle("last", i === free && li.near); // one space left and the rest stuck: the last free space pulses
    });
    sendable();
  }
  // Critics 1 fix: a space too narrow for its badge column beside a two-digit count takes the tight layout (the badges
  // on top, the count below: #line.tight). Worked out from a space's width and the fonts in use, at layout time only.
  function fitLine() {
    const line = $("line"), s = app.slots[0]; if (!s || s.hidden || !s.clientWidth) return;
    line.classList.remove("tight");
    const cs = getComputedStyle(s), g = app.meas || (app.meas = document.createElement("canvas").getContext("2d")), px = (v) => parseFloat(v) || 0;
    g.font = getComputedStyle(s.querySelector("b")).fontSize + ' "Jersey 10"'; const two = g.measureText("88").width;
    g.font = cs.getPropertyValue("--out-n").trim() + ' "Jersey 10"'; const out = g.measureText("88").width + 5 + 1 + 4;
    const room = s.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.columnGap);
    line.classList.toggle("tight", room < two + Math.max(out, px(cs.getPropertyValue("--bd")), px(cs.getPropertyValue("--lk-s"))));
  }
  function renderTop() {
    const e = app.entry; if (!e) return;
    $("lvl-num").textContent = e.debug ? app.cfg.layout.debugNum : e.n; $("lvl-name").textContent = e.gallery ? e.L.title : e.L.name || (app.eras[e.era - 1] ? app.eras[e.era - 1].name : "Era " + e.era);
    $("btn-map").setAttribute("aria-label", e.gallery ? app.cfg.gallery.title : "Era map");
    $("diff-chip").textContent = DNAME[app.diff];
    app.labFit.delete("name"); fitText($("lvl-name"), "name", app.cfg.layout.nameMinPx); // the room beside the number changes with its digits
  }
  function renderAll() { judge(); renderTop(); renderTray(); renderLine(); }

  function buildMap() {
    const host = $("eras"); app.eras = app.cfg.eras || [];
    if (app.debug.length) { // ?debug=1: the v4 twists' debug levels, one button each (never in the play order)
      const sec = document.createElement("section"); sec.className = "era dbg";
      sec.innerHTML = '<div class="eye"><span></span><span class="cnt">debug</span></div><div class="nodes"></div>'; sec.querySelector(".eye span").textContent = app.cfg.layout.debugRow;
      for (const e of app.debug) { const b = document.createElement("button"); b.className = "node dbg-node"; b.dataset.id = e.id; b.textContent = e.id.replace(/^v4-/, ""); b.setAttribute("aria-label", e.L.name || e.id); b.addEventListener("click", () => startLevel(e.id)); e.node = b; sec.querySelector(".nodes").append(b); }
      host.append(sec);
    }
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

  // ---- the Gallery (v4 M4) -------------------------------------------------------------------------------------------
  // The Gallery is open once siege level gallery.openAt is won (any difficulty). Its buttons (title, map) say so while
  // locked; the screen is a grid of every picture: dimmed (its cells' lightness squeezed into gallery.dim, no colour) until
  // it is won, then in its colours with its title and its E/N/H medals. Thumbnails are drawn when the grid renders.
  const galOpen = () => !!(app.cfg.gallery && app.save.data.done[app.cfg.gallery.openAt]);
  const galWon = () => app.gal.filter((e) => app.save.data.gal[e.id]).length;
  function buildGallery() {
    const G = app.cfg.gallery, host = $("gal-grid"); if (!G || !host) return;
    $("gal-title").textContent = G.title; $("gal-credits").textContent = G.credits;
    for (const b of [$("btn-gallery"), $("map-gallery")]) { b.hidden = !app.gal.length; b.querySelector(".gt").textContent = G.btn; b.addEventListener("click", () => { if (galOpen()) showScreen("gallery"); else lockedTap(b); }); }
    for (const e of app.gal) {
      const b = document.createElement("button"); b.className = "gal-tile"; b.innerHTML = '<canvas class="pix" aria-hidden="true"></canvas><span class="gn"></span><i class="gm"></i>';
      b.addEventListener("click", () => { if (galOpen()) startLevel(e.id); });
      e.node = b; host.append(b);
    }
  }
  // A locked Gallery button shakes (its hint is already on it).
  function lockedTap(b) { if (!app.V.calm && b.animate) b.animate(app.cfg.show.blockedShake.map((x) => ({ transform: "translateX(" + x + "px)" })), { duration: app.cfg.show.blockedShakeMs }); cue("blocked"); }
  // The title's and the map's Gallery buttons: locked with the hint, or open with the count.
  function renderGalButtons() {
    const G = app.cfg.gallery; if (!G) return; const open = galOpen(), sub = open ? G.count.replace("{n}", galWon()).replace("{t}", app.gal.length) : G.lockedHint;
    for (const b of [$("btn-gallery"), $("map-gallery")]) { b.classList.toggle("locked", !open); b.setAttribute("aria-disabled", open ? "false" : "true"); b.querySelector(".gs").textContent = sub; b.setAttribute("aria-label", G.btn + ": " + sub); }
  }
  function renderGallery() {
    const G = app.cfg.gallery, d = app.save.data; if (!G) return;
    $("gal-count").textContent = G.count.replace("{n}", galWon()).replace("{t}", app.gal.length);
    for (const e of app.gal) {
      const m = d.gal[e.id] | 0, b = e.node, won = !!m, key = won ? "c" : "d";
      b.classList.toggle("done", won); b.querySelector(".gn").textContent = won ? e.L.title : e.n;
      b.querySelector(".gm").textContent = (m & 1 ? "E" : "") + (m & 2 ? "N" : "") + (m & 4 ? "H" : "");
      b.setAttribute("aria-label", won ? e.L.title + ", cleared" : "Picture " + e.n + ", not cleared yet");
      if (b.dataset.drawn !== key) { thumb(b.querySelector("canvas"), e.L, won); b.dataset.drawn = key; }
    }
  }
  // A picture's thumbnail: gallery.thumbPx canvas px a cell, the ring left out; dimmed (lightness only) until won.
  function thumb(c, L, colour) {
    const k = app.cfg.gallery.thumbPx, w = L.w - 2, h = L.h - 2, [lo, hi] = app.cfg.gallery.dim.map((x) => parseInt(x.slice(1), 16));
    c.width = w * k; c.height = h * k; const g = c.getContext("2d");
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const id = E.matOf(L.grid[y + 1][x + 1]), hex = L.pal[id] ? L.pal[id].c : "#888888";
      if (colour) g.fillStyle = hex;
      else { const v = parseInt(hex.slice(1), 16), t = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255, ch = (s) => Math.round(((lo >> s) & 255) * (1 - t) + ((hi >> s) & 255) * t); g.fillStyle = "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")"; }
      g.fillRect(x * k, y * k, k, k);
    }
  }
  // The next Gallery picture to offer after e: the first not yet won after it (wrapping round), else the one after it.
  function nextPicture(e) { const i = app.gal.indexOf(e), n = app.gal.length; for (let k = 1; k <= n; k++) { const x = app.gal[(i + k) % n]; if (!app.save.data.gal[x.id]) return x; } return app.gal[(i + 1) % n]; }

  // ---- screens and levels --------------------------------------------------------------------------------------------
  function showScreen(name) {
    if (name === "gallery" && !galOpen()) name = "title";
    app.screen = name;
    $("title").hidden = name !== "title"; $("map").hidden = name !== "map"; $("gallery").hidden = name !== "gallery";
    if (name === "title" || name === "map") renderGalButtons();
    if (name === "gallery") renderGallery();
    if (name === "map") { renderMap(); const ne = app.byId.get(Save.next(app.save.data, app.order)); if (ne && ne.node && ne.node.scrollIntoView) ne.node.scrollIntoView({ block: "center" }); }
    if (name === "title") paintTitle();
    if (name === "play") fitBoard();
    if (name !== "play") { $("pause").hidden = true; if (app.paused && !document.hidden) resume(); }
    renderCoach();
  }
  function startLevel(id, diff) {
    const e = app.byId.get(id) || app.levels[0];
    if (diff && DIFFS.indexOf(diff) >= 0) app.diff = diff;
    app.entry = e; app.B = E.compile(e.L); app.S = E.sim(app.B, rulesOf(app.diff)); app.S.logOn = true; app.et = 0;
    app.V.setLevel(app.B, app.S, e.L.pal); usePalette(e); // v4 M4: the level's colours before anything is painted
    app.ending = null; app.endAt = -1; app.endT = -1; app.panel = null; app.popK = 0; app.used = 0; app.march = false; app.blockT = -1e12; $("panel").hidden = true; hideToast();
    app.lockN = app.S.locked; app.unlockT = -1e12; app.flip.fill(false); app.reveals = 0; app.pairsOut = 0; landTiles();
    app.coached = !!coachSteps(e); // the coach's band is kept for the whole level, so the board never jumps when it goes
    placeSlots();
    if (!e.debug && !e.gallery) { app.save.data.last = e.id; writeSave(); }
    renderAll(); fitLine(); showScreen("play"); coachStart(); // the line and tray take their size before the board is fitted to what is left
    return e;
  }
  // v4 M3: a tile's flip or shake from the last game lands at once when a level starts (a flip left mid-turn has no width).
  function landTiles() { for (const b of app.cards.concat(app.nexts.flat())) if (b.getAnimations) for (const a of b.getAnimations()) if (a.effect && isFinite(a.effect.getComputedTiming().endTime)) a.finish(); }
  function retry() {
    if (!app.S) return;
    app.S.reset(); app.et = 0; app.V.reset(); app.ending = null; app.endAt = -1; app.endT = -1; app.panel = null; app.popK = 0; app.used = 0; app.march = false; app.blockT = -1e12; $("panel").hidden = true; hideToast();
    app.unlockT = -1e12; app.flip.fill(false); app.reveals = 0; app.pairsOut = 0; landTiles();
    renderAll(); coachStart();
  }
  const playNext = () => startLevel(Save.next(app.save.data, app.order));

  // The one play entry point: the card tap, the keyboard and SP.play all call this. Returns true if a card was played.
  // The squad takes its space at the engine's current time; nothing waits on the show. No free space: refused (below).
  function playCol(col) {
    const S = app.S;
    if (app.screen !== "play" || !S || S.status !== E.PLAYING || app.panel || !(col >= 0 && col < E.NCOL) || S.front(col) < 0) return false;
    const m = app.B.cardM[S.front(col)], line0 = S.lineLen, got = S.play(col);
    if (got === E.REFUSED) { refusedTap(col); return false; }
    if (got === E.NOPLAY) return false;
    app.used |= 1 << m;
    app.V.sync(S, true);
    app.popK = 0;
    cue("tap");
    if (S.status === E.PLAYING && S.lineLen > line0 && readLine().near) cue("warn");
    else if (S.lineLen > line0) cue("fill");
    ended();
    marchCheck();
    judge(); renderTray(); renderLine(); coachStep();
    return true;
  }
  // A tap with no free space: nothing changes in the rules. The card shakes every time; the toast and the soft blocked
  // sound come at most once per show.blockedGapMs, so a thumb hammering a card isn't noisy. No input lock.
  // v4 M2: a linked card shakes with its partner's tile (when it is in the visible rows), and the toast says why.
  function refusedTap(col) {
    app.refused++;
    const S = app.S, SH = app.cfg.show, p = S.partner(S.front(col)), pd = p >= 0 ? rowOf(S, app.B.cardCol[p], p) : -1;
    const shake = (b) => { if (!app.V.calm && b.animate) b.animate(SH.blockedShake.map((x) => ({ transform: "translateX(" + x + "px)" })), { duration: SH.blockedShakeMs, easing: "linear" }); };
    shake(app.cards[col]); if (pd >= 0) shake(tileOf(app.B.cardCol[p], pd));
    if (app.clock - app.blockT < SH.blockedGapMs) return;
    app.blockT = app.clock; cue("blocked"); toast(p >= 0 ? app.cfg.layout.linkedText : app.cfg.layout.blockedText, true);
  }
  // Victory march: once the tray is empty no input is left, so a scratch copy of the engine run to rest gives the exact
  // outcome. A win: the show plays at show.victoryPace until the sheet. A jam or a stuck line: no march.
  function marchCheck() {
    const S = app.S, B = app.B; if (app.march || S.status === E.FAILED) return;
    for (let j = 0; j < E.NCOL; j++) if (S.front(j) >= 0) return;
    const X = E.sim(B, rulesOf(app.diff)); X.load(S.save()); X.quiet();
    app.march = X.status === E.WON;
  }
  const paceNow = () => app.cfg.show.pace * Math.max(app.speed, app.march ? app.cfg.show.victoryPace : 1);
  // The rules just ended the assault (at a tap, a pop or an arrow): record it; the sheet waits for the squads to settle.
  function ended() {
    const S = app.S; if (app.ending || S.status === E.PLAYING) return;
    app.ending = { won: S.status === E.WON, reason: S.reason, m: S.failMat, crews: [], why: S.status === E.FAILED && S.reason === "jam" ? S.jamWhy : 0 }; app.endT = app.clock;
    if (S.reason === "jam") { app.ending.squads = []; for (const s of S.order(app.ord)) { if (!S.stuck(s)) continue; app.ending.squads.push([S.spM[s], S.spW[s]]); const c = mat(S.spM[s]).crew; if (app.ending.crews.indexOf(c) < 0) app.ending.crews.push(c); } cue("jam"); }
    if (app.ending.won && app.entry.debug) app.ending.medal = false;
    else if (app.ending.won && app.entry.gallery) { const was = app.save.data.gal[app.entry.id] | 0; app.ending.first = Save.record(app.save.data, app.entry.id, app.diff, "gal"); app.ending.medal = !(was & (1 << DIFFS.indexOf(app.diff))); writeSave(); }
    else if (app.ending.won) { const was = app.save.data.done[app.entry.id] | 0, first = Save.record(app.save.data, app.entry.id, app.diff); app.ending.first = first; app.ending.medal = !(was & (1 << DIFFS.indexOf(app.diff))); app.save.data.last = Save.next(app.save.data, app.order); writeSave(); }
    judge(); renderTray(); renderLine();
  }
  // Run the engine until nothing moves and land the board (a skip; the patient player's wait).
  function settleNow() {
    const S = app.S; if (!S) return false;
    const busy = S.busy; S.quiet(); app.et = Math.max(app.et, S.now); app.V.t = app.et; app.V.sync(S, false);
    ended(); if (busy) { judge(); renderTray(); renderLine(); coachStep(); }
    return busy;
  }
  function skip() {
    if (app.screen !== "play") return;
    if (settleNow()) return;
    if (app.V.gob.on && !app.V.gob.done) app.V.gob.done = true;
    else if (app.ending && !app.panel) app.endAt = app.clock;
  }
  // The jam names the crews that jammed, in line order (up to layout.jamNames, then "and n more"). Critics 1 fix: this
  // text is the sheet's aria-label; what shows is sheetLine's (colour chips, since no tile shows a crew name).
  function reasonText(e) {
    const who = e.m ? mat(e.m).crew : "sappers", k = app.cfg.layout.jamNames, c = e.crews || [];
    const names = c.length > k ? c.slice(0, k).join(", ") + " and " + (c.length - k) + " more" : c.length > 1 ? c.slice(0, -1).join(", ") + " and " + c[c.length - 1] : c[0] || "the squads";
    // v4 M2: a jam where a linked card needed 2 spaces says so; one with a space still locked adds that it never opened.
    const L = app.cfg.layout, jam = e.why & 1 ? L.jamLinkedText + (c.length ? ", and " + names + " can't reach a block." : ".") : "Line jammed: " + names + " can't reach a block." + (e.why & 2 ? " " + L.jamLockText : "");
    return { short: "Archers cut down the " + who + ": too few left to finish.", stuck: "Out of squads, and the waiting sappers can't reach their colour.",
      jam }[e.reason] || "The assault failed.";
  }
  // The fail sheet's line as the player sees the squads: each jammed squad a chip in its colour with its count (a short
  // colour: a chip with no count); the words around them as reasonText's. The names stay in the aria-label.
  function sheetLine(e) {
    const pl = $("p-line"), L = app.cfg.layout, add = (t) => pl.append(t);
    pl.textContent = ""; pl.setAttribute("aria-label", reasonText(e));
    const chip = (m, k) => { const c = document.createElement("span"); c.className = "chip"; c.setAttribute("aria-hidden", "true"); paintMat(c, m); c.innerHTML = '<i class="gl"></i>'; if (k) c.append(String(k)); pl.append(c); };
    const chips = () => { (e.squads || []).slice(0, L.jamChips).forEach(([m, k]) => chip(m, k)); };
    const n = (e.squads || []).length;
    if (e.reason === "jam" && e.why & 1) { add(L.jamLinkedText); if (n) { add(", and "); chips(); add(" can't reach a block."); } else add("."); }
    else if (e.reason === "jam") { add("Line jammed: "); if (n) chips(); else add("the squads"); add(" can't reach a block." + (e.why & 2 ? " " + L.jamLockText : "")); }
    else if (e.reason === "short" && e.m) { add("Archers cut down the "); chip(e.m, 0); add(" squad: too few left to finish."); }
    else add(reasonText(e));
  }
  function showPanel() {
    const e = app.ending; if (!e) return;
    app.panel = e.won ? "win" : "fail"; app.panelAt = app.clock; renderCoach();
    const last = app.entry.debug || app.entry.idx === app.levels.length - 1, G = app.cfg.gallery, gal = !!app.entry.gallery;
    $("p-title").textContent = e.won ? (gal ? G.winTitle : "Fort razed!") : "Assault failed";
    if (e.won) { $("p-line").textContent = gal ? G.winLine.replace("{title}", app.entry.L.title).replace("{diff}", DNAME[app.diff]) : "The goblin king flees. " + (app.entry.debug ? app.entry.L.name : "Level " + app.entry.n) + " won on " + DNAME[app.diff] + "."; $("p-line").removeAttribute("aria-label"); } else sheetLine(e);
    $("p-primary").textContent = e.won ? (gal ? G.nextBtn : last ? "Era map" : "Next level") : "Retry";
    $("p-secondary").textContent = e.won ? "Retry" : gal ? G.title : "Era map";
    // The win beat: the level's difficulty medals, this one stamped in if it's new.
    const mask = (gal ? app.save.data.gal : app.save.data.done)[app.entry.id] | 0, md = $("p-medals"); md.hidden = !e.won;
    Array.from(md.children).forEach((el, k) => { el.className = "medal" + (mask & (1 << k) ? " got" : "") + (e.won && e.medal && DIFFS[k] === app.diff ? " new" : ""); });
    $("panel").hidden = false; placeSheet();
    cue(e.won ? "chime" : "bad"); if (e.won && e.medal) cue("star", 2);
    judge(); renderTray(); renderLine();
  }
  // A panel button ignores taps for show.panelGuardMs after the panel appears, so a thumb still tapping cards can't hit it.
  const panelLive = () => app.clock - app.panelAt >= app.cfg.show.panelGuardMs || app.testing;
  function panelPrimary() { if (!app.panel || !panelLive()) return; if (app.panel === "win") { if (app.entry.gallery) startLevel(nextPicture(app.entry).id); else if (app.entry.debug || app.entry.idx === app.levels.length - 1) showScreen("map"); else playNext(); } else retry(); }
  function panelSecondary() { if (!app.panel || !panelLive()) return; if (app.panel === "win") retry(); else showScreen(app.entry.gallery ? "gallery" : "map"); }

  // ---- teaching coach (config.teach) ---------------------------------------------------------------------------------
  // One line over the board and a bouncing arrow on the thing to tap: a front card, a card behind one, the holding line,
  // or a ring on the board (key, gate, tower). Steps advance on play; conditions read the rules state, so any tap order
  // works. DOM work happens on a play or a resize only, never per frame. v4 M3 (the twists' teaching levels): pointers
  // mystery (a hidden "?" tile in view), linked (a linked front card), lockSlot (the padlocked space) and the ring
  // lockKey (the space's key on the board); conditions reveal (a "?" turned over), pair (a linked pair went out), unlock
  // (the space opened), locked (it is still shut), hidden (a "?" is in view), linkedFront (a front card is linked).
  const coachSteps = (e) => { const st = e && ((app.cfg.teach || {})[e.id] || (e.L.hint ? [{ say: e.L.hint, until: "play" }] : null)); return st && st.length ? st : null; };
  function coachStart() {
    const steps = coachSteps(app.entry);
    app.coach = steps ? { steps, i: 0, at: 0 } : null;
    if (app.coach) skipDead();
    renderCoach();
  }
  function frontOf(m) { const S = app.S; for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0 && app.B.cardM[f] === m) return j; } return -1; }
  function cond(k) {
    const S = app.S, B = app.B, [w, a] = String(k).split(":"), m = a | 0;
    switch (w) {
      case "play": return S.plays > app.coach.at;
      case "line": return S.lineLen > 0;
      case "wait": { for (let k = 0; k < S.cap; k++) if (S.spQ[k] && S.spW[k] > S.reachable(S.spM[k])) return true; return false; }
      case "lineEmpty": return S.lineLen === 0;
      case "gate": return B.gateCells.every((gc) => S.a[gc[0]] <= 0);
      case "tower": return S.standing === 0;
      case "reach": return S.reachable(m) > 0;
      case "used": return !!(app.used & (1 << m));
      case "hit": return S.hits > 0;
      case "front": return frontOf(m) >= 0;
      case "short": { const j = frontOf(m); return j >= 0 && B.cardN[S.front(j)] > S.reachable(m); }
      case "reveal": return app.reveals > 0;
      case "pair": return app.pairsOut > 0;
      case "unlock": return B.lockKey >= 0 && S.locked === 0;
      case "locked": return S.locked > 0;
      case "hidden": return hiddenTile() !== null;
      case "linkedFront": return linkedFront() >= 0;
    }
    return false;
  }
  // The first hidden "?" tile in the visible rows, and the first column whose front card is linked (-1: none).
  function hiddenTile() { const S = app.S, RW = app.cfg.layout.queueRows; for (let d = 1; d < RW; d++) for (let j = 0; j < E.NCOL; j++) { const ci = S.card(j, d); if (ci >= 0 && S.hidden(ci)) return tileOf(j, d); } return null; }
  function linkedFront() { const S = app.S; for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0 && S.partner(f) >= 0) return j; } return -1; }
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
    $("line").classList.remove("coach-on"); $("line-cnt").style.removeProperty("--cnt-shift");
    V.focus.on = false; V.ringsLoud = false;
    if (!co || app.screen !== "play" || app.panel || co.i >= co.steps.length) { txt.hidden = true; hand.hidden = true; return; }
    const st = co.steps[co.i], S = app.S, B = app.B;
    let el = null, cm = 0, cn = 0;
    if (st.card) { const j = frontOf(st.card); if (j >= 0) { el = app.cards[j]; cm = st.card; cn = B.cardN[S.front(j)]; } }
    if (!el && st.next) { for (let j = 0; j < E.NCOL && !el; j++) if (!app.nexts[j][0].classList.contains("none")) el = app.nexts[j][0]; }
    if (!el && st.mystery) el = hiddenTile();
    if (!el && st.linked) { const j = linkedFront(); if (j >= 0) el = app.cards[j]; }
    if (!el && st.lockSlot && S.locked > 0) el = app.slots[S.cap - 1];
    if (!el && st.line) el = $("line");
    // A ring on the board: the first gate's key (or the gate once the key is gone), the first standing tower.
    if (st.ring === "key" || st.ring === "gate") { const k = 0, kc = V.keyC[k]; if (B.gateCells.length) { if (st.ring === "key" && kc >= 0 && S.a[kc] > 0) Object.assign(V.focus, { on: true, x: kc % B.w + 0.5, y: ((kc / B.w) | 0) + 0.5, r: 1.1 }); else Object.assign(V.focus, { on: true, x: V.gX[k], y: V.gY[k], r: 1.6 }); } }
    if (st.ring === "lockKey" && B.lockKey >= 0 && S.a[B.lockKey] > 0) Object.assign(V.focus, { on: true, x: B.lockKey % B.w + 0.5, y: ((B.lockKey / B.w) | 0) + 0.5, r: 1.1 });
    if (st.ring === "tower") { for (let k = 0; k < B.towers.length; k++) if (S.standing & (1 << k)) { const T = B.towers[k]; Object.assign(V.focus, { on: true, x: T.cx + 0.5, y: T.cy + 0.5, r: Math.sqrt(T.size / Math.PI) + 0.9 }); break; } }
    txt.textContent = (app.coachMode === "top" && st.short ? st.short : st.say).replace(/\{n\}/g, cn).replace(/\{crew\}/g, cm ? mat(cm).crew : "").replace(/\{reach\}/g, cm ? S.reachable(cm) : 0).replace(/\{go\}/g, cm ? Math.min(cn, S.reachable(cm)) : 0);
    V.ringsLoud = st.ring === "tower"; // the lesson is the ring: every ring loud while it shows
    txt.hidden = false; placeCoach(); fitCoach();
    if (el) { el.classList.add("coach-on"); app.focusEl = el; }
    if (st.line) $("line").classList.add("coach-on");
    placeHand(el);
  }
  // The coach's box (fixed, --coach-h tall): the band above the board, the level's name in the top bar, or its spot in
  // the side column (app.coachMode, set when the board is fitted).
  const coachH = () => parseFloat(getComputedStyle(document.body).getPropertyValue("--coach-h")) || 46;
  function placeCoach() {
    const t = $("coach"); if (t.hidden) return;
    let r;
    if (app.coachMode === "side") { const q = $("coach-dock").getBoundingClientRect(); r = [q.left, q.top, q.width, q.height]; }
    else if (app.coachMode === "top") { const a = document.querySelector("#lvl .lvl-txt").getBoundingClientRect(), b = $("top").getBoundingClientRect(), m = app.cfg.layout.coachTopMarginPx; r = [a.left, b.top + m, a.width, b.height - 2 * m]; } // beside the level's number
    else { const q = $("stage").getBoundingClientRect(); r = [q.left + 6, q.top + 2, q.width - 12, coachH()]; }
    t.style.left = r[0] + "px"; t.style.top = r[1] + "px"; t.style.width = Math.max(0, r[2]) + "px"; t.style.height = Math.max(0, r[3]) + "px";
  }
  // One line if it fits (the font steps down through layout.coachFontPx [max, min]), else two (Critics 1 fix, m3). In
  // the top bar it is always one line (the step's short text there, when it has one).
  function fitCoach() {
    const t = $("coach"), [hi, lo] = app.cfg.layout.coachFontPx; if (t.hidden) return;
    t.classList.remove("two");
    for (let px = hi; px >= lo; px--) { t.style.fontSize = px + "px"; if (t.scrollWidth <= t.clientWidth && t.scrollHeight <= t.clientHeight) return; }
    if (app.coachMode === "top") return;
    t.classList.add("two");
    for (let px = hi; px >= lo; px--) { t.style.fontSize = px + "px"; if (t.scrollWidth <= t.clientWidth && t.scrollHeight <= t.clientHeight) return; }
  }
  // The arrow (Critics 1 fix: it never covers a count). A queue tile: in from the side at its middle (from the left, or
  // from the right in the first column), over its neighbour's empty edge. A space: from above; the line head's count
  // steps aside. The whole line: over the gap between the head's label and count, or no arrow (the line glows). Else a
  // ring on the board.
  function placeHand(el) {
    const hand = $("hand"), V = app.V, H = app.cfg.layout.hand; let x, y, rot = 0, sc = 1, kind = "";
    $("line-cnt").style.removeProperty("--cnt-shift");
    if (el && el.classList.contains("tile")) { const r = el.getBoundingClientRect(), right = el.closest(".col") === $("tray").firstElementChild; x = right ? r.right - H.sideIn : r.left + H.sideIn; y = r.top + r.height / 2; rot = right ? 90 : -90; sc = H.sideScale; kind = "side"; }
    else if (el && el.classList.contains("slot")) {
      const r = el.getBoundingClientRect(), head = $("line-head").getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + H.downIn; kind = "slot";
      const shift = head.right - (x - H.halfW) + H.gap; if (shift > 0) $("line-cnt").style.setProperty("--cnt-shift", Math.ceil(shift) + "px");
    } else if (el && el.id === "line") {
      const a = $("line-lab").getBoundingClientRect(), b = $("line-cnt").getBoundingClientRect(), r = el.getBoundingClientRect(), right = b.width ? b.left : r.right;
      if (right - a.right < 2 * (H.halfW + H.gap)) { hand.hidden = true; app.handKind = "none"; return; }
      x = (a.right + right) / 2; y = r.top + H.downIn; kind = "line";
    } else if (V.focus.on) { const r = $("board").getBoundingClientRect(), p = V.cssAt(V.focus.x, V.focus.y, app.pt); x = r.left + p.x; y = r.top + p.y - (V.focus.r * V.cs) / V.dpr; kind = "ring"; }
    else { hand.hidden = true; app.handKind = ""; return; }
    app.handKind = kind; hand.classList.toggle("side", kind === "side");
    hand.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)" + (rot ? " rotate(" + rot + "deg) scale(" + sc + ")" : ""); hand.hidden = false;
  }
  const coachState = () => { const t = $("coach"); return { on: !!app.coach && !t.hidden, i: app.coach ? app.coach.i : -1, text: t.hidden ? "" : t.textContent, hand: !$("hand").hidden, kind: app.handKind, mode: app.coachMode,
    target: app.focusEl ? app.focusEl.id || app.focusEl.className : null, ring: app.V.focus.on, oneLine: !t.classList.contains("two"), fits: t.scrollWidth <= t.clientWidth && t.scrollHeight <= t.clientHeight }; };

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
  // The speed button cycles show.speeds (1x, 2x, 3x); anything else loads as the first one. Gold above 1x.
  function setSpeed(k, save) {
    const sp = app.cfg.show.speeds; app.speed = sp.indexOf(k) >= 0 ? k : sp[0];
    togSpeed.forEach((b) => { b.textContent = app.speed + "\u00d7"; b.classList.toggle("on", app.speed > sp[0]); b.setAttribute("aria-label", "Speed " + app.speed + "x (tap for " + sp[(sp.indexOf(app.speed) + 1) % sp.length] + "x)"); });
    if (save) { app.save.data.settings.speed = app.speed; writeSave(); }
  }
  const nextSpeed = () => { const sp = app.cfg.show.speeds; setSpeed(sp[(sp.indexOf(app.speed) + 1) % sp.length], true); };
  // Colour-blind mode (v4 M1): the board's blocks and the queue tiles wear their material's mark. A toggle on the title
  // and the map, kept in the save.
  function setCb(on, save) {
    app.cb = !!on; document.body.classList.toggle("cb", app.cb); if (app.V) app.V.setCb(app.cb);
    togCb.forEach((b) => b.setAttribute("aria-pressed", app.cb ? "true" : "false"));
    if (save) { app.save.data.settings.cb = app.cb; writeSave(); }
  }
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
    $("btn-map").addEventListener("click", () => showScreen(app.entry && app.entry.gallery ? "gallery" : "map"));
    $("gal-back").addEventListener("click", () => showScreen("title"));
    $("btn-play").addEventListener("click", playNext);
    $("btn-tomap").addEventListener("click", () => showScreen("map"));
    $("btn-home").addEventListener("click", () => showScreen("title"));
    $("map-play").addEventListener("click", playNext);
    $("p-primary").addEventListener("click", panelPrimary);
    $("p-secondary").addEventListener("click", panelSecondary);
    togMute.forEach((b) => b.addEventListener("click", () => setMuted(!app.audio.muted, true)));
    togSpeed.forEach((b) => b.addEventListener("click", nextSpeed));
    togCb.forEach((b) => b.addEventListener("click", () => setCb(!app.cb, true)));
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
    if (app.S) fitLine();
    fitBoard();
    if (app.S) { renderTop(); renderTray(); placeSlots(); }
    if (app.panel) placeSheet();
  }
  // Where each space's sappers walk onto the board: its slot's centre, relative to the canvas (clamped to its edge there).
  function placeSlots() {
    if (!app.V || !app.B) return;
    const r = $("board").getBoundingClientRect();
    app.slotPts.length = 0;
    for (const s of app.slots) { const q = s.getBoundingClientRect(); app.slotPts.push(q.width > 0 ? { x: q.left + q.width / 2 - r.left, y: q.top + q.height / 2 - r.top } : null); }
    app.V.setSlots(app.slotPts);
  }
  function fitBoard() {
    if (!app.B || !app.V) return;
    // Wide: offer the stage every px beside the panel, fit the board, then shrink the stage to it so the board and the
    // panel sit together in the middle (the cell size doesn't change on the second fit).
    const L = app.cfg.layout, r = document.documentElement.style;
    if (app.wide) r.setProperty("--stage-w", Math.max(200, window.innerWidth - (parseFloat(r.getPropertyValue("--rail-w")) || L.railWidePx) - (app.wide && window.innerHeight <= L.shortMaxH ? L.gapShortPx : L.gapWidePx) - L.sidePadPx) + "px");
    // Critics 1 fix: a level with a coach keeps a band for it. Wide: its spot in the side column. Portrait: the band above
    // the board when the board still gets layout.minCellCss CSS px a cell there, else over the level's name.
    const st = $("stage"), dpr = window.devicePixelRatio || 1, w = st.clientWidth - 14, h0 = st.clientHeight - 16, BD = document.body;
    let mode = app.coached && app.screen === "play" ? (app.wide ? "side" : "above") : "";
    const res = mode === "above" ? coachH() + 6 : 0;
    if (mode === "above" && app.V.fitCs(w, h0 - res, dpr, false) < L.minCellCss) mode = "top";
    app.coachMode = mode; BD.classList.toggle("coached", !!mode); BD.classList.toggle("coach-above", mode === "above"); BD.classList.toggle("coach-top", mode === "top");
    const h = h0 - (mode === "above" ? res : 0);
    if (w > 0 && h > 0) app.V.layout(w, h, dpr, app.wide);
    if (app.wide) { const cw = parseFloat($("board").style.width) || 0; if (cw > 0) r.setProperty("--stage-w", Math.ceil(cw + 16) + "px"); r.setProperty("--blk-h", $("frame").offsetHeight + "px"); } // the side column is the board's height (M10)
    document.body.classList.toggle("turned", app.V.rot);
    if (app.coach && !$("coach").hidden) { placeCoach(); fitCoach(); placeHand(app.focusEl); }
    placeSlots();
  }
  // Critics 1 fix: the win / fail sheet never slices the holding line. A fail sheet starts under the line (its text steps
  // down, .tight, if the room is short) and covers the queue, so the jammed line stays in view; if it still doesn't fit
  // it floats above the line (.float) instead. A win sheet covers the whole rail (and reaches up over the board's foot if
  // it needs more room). Wide: the same within the side column.
  function placeSheet() {
    const P = $("panel"), card = P.firstElementChild, st = P.style, A = $("app").getBoundingClientRect(), lw = $("line-wrap").getBoundingClientRect(), rl = $("rail").getBoundingClientRect(), sd = $("side").getBoundingClientRect();
    if (P.hidden) return;
    P.classList.remove("float", "tight"); st.top = ""; st.bottom = ""; st.left = ""; st.width = ""; st.right = "";
    if (app.wide) { st.left = sd.left - A.left + "px"; st.width = sd.width + "px"; st.right = "auto"; st.bottom = A.bottom - sd.bottom + "px"; }
    const foot = app.wide ? sd.bottom : A.bottom, gap = 6, natural = () => { P.classList.add("float"); const k = card.offsetHeight; P.classList.remove("float"); return k; };
    if (app.panel === "win") { const hh = natural(); st.top = Math.min(rl.top, foot - hh) - A.top + "px"; return; }
    let hh = natural(); const room = foot - lw.bottom - gap;
    if (hh > room) { P.classList.add("tight"); hh = natural(); }
    if (hh <= room) { st.top = lw.bottom + gap - A.top + "px"; return; }
    P.classList.add("float"); st.top = "auto"; st.bottom = A.bottom - lw.top + gap + "px";
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
    // The engine plays at show.pace x real time (x the speed button's 1x, 2x or 3x, or the victory march's pace, whichever
    // is faster); its log goes to the board every step.
    const S = app.S, sp = paceNow();
    app.et += dt * sp; S.advanceTo(app.et); V.t = app.et; V.sync(S, true);
    V.update(dt, sp);
    ended();
    if (app.unlockT > 0 && app.clock - app.unlockT >= app.cfg.show.unlockMs && app.clock - app.unlockT < app.cfg.show.unlockMs + dt) app.lineMoved = true; // the padlock's pop ends
    if (app.lineDirty) { judge(); renderTray(); renderLine(); coachStep(); } else if (app.lineMoved) renderLine();
    app.lineMoved = false;
    // The sheet waits for the squads to settle, at most show.settleCapMs after the end (then everything lands).
    if (app.ending && !app.panel && S.busy && app.clock - app.endT >= app.cfg.show.settleCapMs) settleNow();
    if (app.ending && !app.panel && !S.busy) {
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

  // ---- solver (debug): DFS from the current position on a clone, played patiently (legal taps only, v4 M2) ------------
  function solveHere(nodes) {
    const B = app.B; if (!B) return null;
    const S = E.sim(B, rulesOf(app.diff)), dead = new Set(), path = [], bufs = [];
    S.load(app.S.save()); S.quiet();
    for (let k = 0; k <= B.ncards + 1; k++) bufs.push(new Int32Array(S.M.length));
    let used = 0; const cap = nodes || app.cfg.selfTest.solveNodes;
    function dfs(k) {
      if (S.status === E.WON) return true;
      if (S.status !== E.PLAYING || ++used > cap) return false;
      const h = S.hash(); if (dead.has(h)) return false;
      S.save(bufs[k]);
      const kids = [];
      for (let j = 0; j < E.NCOL; j++) { if (S.front(j) < 0 || S.refused(j)) continue; S.play(j); S.quiet(); if (S.status !== E.FAILED) kids.push([j, S.status === E.WON ? -1 : S.lineLen]); S.load(bufs[k]); }
      kids.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
      for (const [j] of kids) { S.play(j); S.quiet(); path.push(j); if (dfs(k + 1)) return true; path.pop(); S.load(bufs[k]); if (used > cap) return false; }
      dead.add(h); return false;
    }
    return dfs(0) ? path.join("") : null;
  }
  // Seeded random patient taps on an engine copy of level e until pred(S) holds; returns that tap order, or null.
  function search(e, diff, pred, tries, seed) {
    const B = E.compile(e.L), S = E.sim(B, rulesOf(diff)), open = [];
    let s = seed | 0; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let k = 0; k < tries; k++) {
      S.reset(); let ord = "";
      for (let g = 0; g <= B.ncards && S.status === E.PLAYING; g++) {
        open.length = 0; for (let j = 0; j < E.NCOL; j++) if (S.front(j) >= 0 && !S.refused(j)) open.push(j); // legal taps (v4 M2)
        if (!open.length) break;
        const j = open[Math.floor(rnd() * open.length)]; S.play(j); S.quiet(); ord += j;
        if (pred(S)) return ord;
      }
    }
    return null;
  }
  // A jam loss (v3.1): seeded random patient taps until the line jams. Returns {prefix} (its last tap jams) or null.
  function jamPlan(e, diff) {
    const pre = search(e, diff, (S) => S.status === E.FAILED && S.reason === "jam", app.cfg.selfTest.searchTries, app.cfg.selfTest.searchSeed);
    return pre == null ? null : { prefix: pre };
  }
  function lossPlan(id, diff) { const e = app.byId.get(id) || app.entry; return e ? jamPlan(e, diff || app.diff) : null; }
  // Rushed taps (no waiting) of the front card with the most in reach until every space is taken with squads out; returns
  // the taps made. The full-line checks and the harness's screens use it.
  function fillLine() {
    let taps = "";
    for (let g = 0; g < 12 && app.S.status === E.PLAYING && app.S.lineLen < app.S.open; g++) { let j = -1; for (let k = 0; k < E.NCOL; k++) { const f = app.S.front(k); if (f >= 0 && (j < 0 || app.S.reachable(app.B.cardM[f]) > app.S.reachable(app.B.cardM[app.S.front(j)]))) j = k; } if (j < 0) break; playCol(j); taps += j; }
    return taps;
  }
  // A line of k stuck squads and w working ones, patient taps from the level's start: fronts with nothing in reach
  // first, then fronts with the most in reach. Returns the taps, or null if the fronts don't allow it.
  function stageLine(k, w) {
    let taps = "";
    for (let g = 0; g < k + w; g++) {
      let j = -1, best = -1;
      for (let c = 0; c < E.NCOL; c++) { const f = app.S.front(c); if (f < 0) continue; const r = app.S.reachable(app.B.cardM[f]); if (g < k ? r === 0 && j < 0 : r > 0 && r > best) { j = c; best = r; } }
      if (j < 0 || !playCol(j)) return null;
      taps += j; if (g < k) settleNow();
    }
    return taps;
  }

  // ---- debug facade ---------------------------------------------------------------------------------------------------
  function state() {
    const S = app.S, B = app.B, V = app.V;
    const line = []; if (S) for (const s of S.order(app.ord)) line.push([mat(S.spM[s]).crew, S.spW[s], S.spO[s]]);
    const fronts = []; if (S) for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); fronts.push(f < 0 ? null : { mat: B.cardM[f], crew: mat(B.cardM[f]).crew, n: B.cardN[f] }); }
    return { screen: app.screen, id: app.entry ? app.entry.id : null, n: app.entry ? app.entry.n : null, era: app.entry ? app.entry.era : null, diff: app.diff,
      status: !S ? null : S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing", reason: S && S.status === E.FAILED ? S.reason : null,
      pixLeft: S ? S.pixLeft : null, cap: S ? S.cap : null, line, fronts, plays: S ? S.plays : 0, hits: S ? S.hits : 0, kills: S ? S.kills : 0,
      busy: S ? S.busy : false, out: S ? S.out : 0, runners: V ? V.live : 0, now: S ? S.now : 0, goblin: V ? V.gob.on && !V.gob.done : false,
      panel: app.panel, speed: app.speed, cb: app.cb, clock: Math.round(app.clock), cs: V ? V.cs : 0, done: Object.keys(app.save.data.done).length,
      refused: app.refused, march: app.march, pace: app.cfg ? paceNow() : 1, li: S ? Object.assign({}, readLine()) : null,
      open: S ? S.open : null, locked: S ? S.locked : 0, links: B ? B.nlinks : 0, hidden: S ? Array.from({ length: B.ncards }, (_, c) => S.hidden(c)).filter(Boolean).length : 0, debug: !!(app.entry && app.entry.debug) };
  }
  const resolve = (id) => (typeof id === "number" ? (app.levels.find((e) => e.n === id) || {}).id : id);
  const hitOK = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t)); };
  const dispMatches = () => { const S = app.S, V = app.V; for (let c = 0; c < app.B.n; c++) if ((V.disp[c] > 0) !== (S.a[c] > 0)) return false; return true; };
  function tick(ms) { let left = Math.max(0, Math.min(600000, +ms || 0)); while (left > 0) { const d = Math.min(16, left); step(d); left -= d; } if (app.screen === "play" && app.V) app.V.draw(); return state(); }
  const playOrder = (ord) => { for (let i = 0; i < ord.length; i++) if (!playCol(ord.charCodeAt(i) - 48)) return false; return true; };

  // selfTest (SPEC-v3 §7, playtest 1, v3.1): every stored winning order on every difficulty played patiently through
  // playCol, a sample of them on real ticks, the dispatch rule on a real board, three overlapping squads, a jam loss (the
  // sheet names the crews), the key and gate, an archer hit per difficulty, the full line (blocked cards; a refused tap
  // changes nothing, then plays once a space frees), stuck and working squads, the near-jam warning and the jam on a
  // level built for it (selfTest.jamLevel), the victory march, determinism on ticks, the save byte-identical after
  // solve(), elementFromPoint on the primary buttons, the win, pause, the coach, opaque sprite caches; v4 M1: the queue's
  // three rows against the engine, colour-blind mode (the toggles, the marks, the save) and the speed cycle; v4 M2: every
  // debug level's stored order on every difficulty, mystery tiles that never leak their colour (also in colour-blind mode)
  // and flip at the front, the rods, a linked refusal with one space free that changes nothing, both squads of a pair
  // leaving together, the padlock opening on its key, and the generalized jam's sheet. Runs on a scratch save; the real
  // save is compared byte for byte at the end. Leaves the page on the level it was on (restarted).
  function selfTest() {
    const T0 = performance.now(), out = { pass: 0, fail: [], notes: {}, ms: 0 };
    const ok = (c, m) => { if (c) out.pass++; else out.fail.push(m); return !!c; };
    const was = { save: app.save, screen: app.screen, entry: app.entry, diff: app.diff, speed: app.speed, cb: app.cb };
    const key = app.cfg.save.key, snap = (() => { try { return was.save.store.getItem(key); } catch (e) { return "?"; } })();
    if (app.paused) resume();
    const ST = app.cfg.selfTest, SH = app.cfg.show, SPD = SH.speeds;
    app.testing = true; app.save = Save.open(Save.memoryStore(), key, app.order); setSpeed(SPD[0], false); setCb(false, false);
    // Patient play: tap, then the engine runs until nothing moves and the board lands (the skip path).
    const patient = (ord) => { for (let i = 0; i < ord.length && app.S.status === E.PLAYING; i++) { if (!playCol(ord.charCodeAt(i) - 48)) return false; settleNow(); } return true; };
    // Real ticks until the engine is quiet (bounded); returns the ms ticked.
    const tickQuiet = (max) => { let t = 0; while (app.S.busy && t < max) { step(16); t += 16; } return t; };
    const allHome = () => !app.S.busy && app.V.live === 0 && app.S.out === 0;
    // Levels built for a check (config selfTest.jamLevel, stuckLevel): registered for the run only.
    const fx = (k) => { const e = { L: ST[k], id: "fx-" + k, n: 0, era: 1, idx: -1, node: null }; app.byId.set(e.id, e); return e; };
    const LY = app.cfg.layout;
    // Critics 1 fix, measured in the page: a text's glyph box (a Range), the overlap of two rects, whether an element shows.
    const glyph = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const over = (a, b) => { const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return x > 0.5 && y > 0.5 ? Math.round(x) + "x" + Math.round(y) : 0; };
    const shown = (el) => { if (!el) return false; const c = getComputedStyle(el), r = el.getBoundingClientRect(); return c.display !== "none" && c.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    // The jam sheet's chips: one per jammed squad (up to layout.jamChips) in its colour with its count; no crew name shows.
    const chipCheck = () => { const cs = Array.from($("p-line").querySelectorAll(".chip")), want = ((app.ending && app.ending.squads) || []).slice(0, LY.jamChips);
      if (cs.length !== want.length) return cs.length + " chips for " + want.length + " squads";
      for (let i = 0; i < cs.length; i++) if (cs[i].style.getPropertyValue("--mc") !== mat(want[i][0]).c || cs[i].textContent !== String(want[i][1])) return "chip " + i + " is wrong";
      for (let m = 1; m < E.NMAT; m++) if ($("p-line").textContent.indexOf(mat(m).crew) >= 0) return "the text names " + mat(m).crew;
      return true; };
    // The sheet never slices the holding line: a fail sheet starts under it or ends above it; a win sheet covers it or ends above it.
    const sheetClear = (win) => { const a = $("panel").getBoundingClientRect(), l = $("line").getBoundingClientRect(), fine = a.bottom <= l.top + 0.5 || (win ? a.top <= l.top + 0.5 : a.top >= l.bottom - 0.5);
      return fine || "sheet " + Math.round(a.top) + "-" + Math.round(a.bottom) + ", line " + Math.round(l.top) + "-" + Math.round(l.bottom); };
    // The coach box clear of the board; the arrow (at the far end of its bob) clear of every count shown and the line head.
    const coachClear = () => { const t = $("coach"); if (t.hidden) return true; const o = over($("board").getBoundingClientRect(), t.getBoundingClientRect()); if (o) return "the coach covers the board by " + o;
      const hd = $("hand"); if (hd.hidden) return true;
      const q = hd.getBoundingClientRect(), bob = parseFloat(getComputedStyle(hd).getPropertyValue("--bob")) || 0, k = app.handKind === "side" ? LY.hand.sideScale : 1, left = /rotate\(-90/.test(hd.style.transform), right = /rotate\(90/.test(hd.style.transform);
      const r = { left: q.left - (left ? bob * k : 0), right: q.right + (right ? bob * k : 0), top: q.top - (left || right ? 0 : bob), bottom: q.bottom };
      const texts = Array.from(document.querySelectorAll("#tray .tile .n, #line .slot b")).filter((el) => el.textContent && shown(el.parentElement)).concat([$("line-lab"), $("line-cnt")].filter((el) => el.textContent));
      for (const el of texts) { const w = over(r, glyph(el)); if (w) return "the arrow (" + app.handKind + ") covers '" + el.textContent + "' by " + w; }
      return true; };
    // B1: in every taken space the count clears every badge (the chain, the working marker, the figures, the stuck lock).
    const slotClear = () => { for (const s of app.slots) { if (s.hidden || !s.classList.contains("full")) continue; const b = s.querySelector("b"); if (!b.textContent) continue; const g = glyph(b);
        for (const sel of [".lk", ".out", ".men"]) { const el = s.querySelector(sel); if (!shown(el)) continue; const o = over(g, el.getBoundingClientRect()); if (o) return sel + " covers the count " + b.textContent + " by " + o; }
        if (s.classList.contains("stuck")) { const cs = getComputedStyle(s), r = s.getBoundingClientRect(), bd = parseFloat(cs.getPropertyValue("--bd")), x = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), y = r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
          const o = over(g, { left: x, top: y, right: x + bd, bottom: y + bd }); if (o) return "the lock covers the count " + b.textContent + " by " + o; } }
      return true; };
    // M3: a linked tile's chain tag clears every count in the tray.
    const chainClear = () => { landTiles(); const ns = Array.from(document.querySelectorAll("#tray .tile .n")).filter((n) => n.textContent && shown(n.parentElement));
      for (const ch of document.querySelectorAll("#tray .tile .ch")) { if (!shown(ch)) continue; for (const n of ns) { const o = over(glyph(n), ch.getBoundingClientRect()); if (o) return "a chain covers '" + n.textContent + "' by " + o; } }
      return true; };
    // M3 (Critics 1 fix 2): no rod or rivet touches a count's glyph box: no rivet disc overlaps one, no point along a rod lies
    // inside one.
    const rodGlyph = () => { landTiles(); const sb = app.rods.getBoundingClientRect(), G = Array.from(document.querySelectorAll("#tray .tile .n")).filter((n) => n.textContent && shown(n.parentElement)).map((n) => [n.textContent, glyph(n)]);
      for (const c of app.rods.querySelectorAll("circle")) { const r = c.getBoundingClientRect(); if (r.width <= 6) continue; for (const [t, g] of G) { const o = over(r, g); if (o) return "a rivet covers '" + t + "' by " + o; } }
      for (const g0 of app.rods.querySelectorAll("path")) { const L = g0.getTotalLength(); if (L < 4) continue; for (let i = 0; i <= 32; i++) { const q = g0.getPointAtLength((L * i) / 32), x = sb.left + q.x, y = sb.top + q.y;
        for (const [t, g] of G) if (x > g.left && x < g.right && y > g.top && y < g.bottom) return "a rod crosses '" + t + "'"; } }
      return true; };
    // M3: every rod's two ends lie on two tiles and no point along it lies inside a third tile (3 px in from its edge).
    const rodClear = () => { landTiles(); const T = []; for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < LY.queueRows; d++) { const el = tileOf(j, d); if (shown(el) && !el.classList.contains("empty")) T.push(el.getBoundingClientRect()); }
      const sb = app.rods.getBoundingClientRect(), inT = (x, y, b, e) => x > b.left + e && x < b.right - e && y > b.top + e && y < b.bottom - e;
      for (const g of app.rods.querySelectorAll("path")) { const L = g.getTotalLength(); if (L < 4) continue;
        const at = (u) => { const p = g.getPointAtLength(L * u); return [sb.left + p.x, sb.top + p.y]; }, e0 = at(0), e1 = at(1), own = T.filter((b) => inT(e0[0], e0[1], b, -1) || inT(e1[0], e1[1], b, -1));
        if (!own.length) return "a rod starts on no tile";
        for (let i = 1; i < 32; i++) { const [x, y] = at(i / 32); const hit = T.find((b) => own.indexOf(b) < 0 && inT(x, y, b, 3)); if (hit) return "a rod crosses a third tile at " + Math.round(x) + "," + Math.round(y); } }
      return true; };
    try {
      // 1. Stored winning orders, all levels, all difficulties, played patiently through the play entry point.
      let wins = 0, total = 0;
      for (const e of app.levels) for (const d of DIFFS) {
        total++; startLevel(e.id, d);
        const ord = e.L.win && e.L.win[d];
        const good = !!ord && patient(ord); settleNow();
        if (ok(good && app.S.status === E.WON, e.id + " " + d + ": stored order wins played patiently through play()")) wins++;
        ok(dispMatches() && allHome(), e.id + " " + d + ": the board display matches the rules and every sapper is home");
      }
      out.notes.wins = wins + "/" + total;
      // 1b. The same on real ticks (SP.tick's 16 ms steps, no skip), Normal, on a sample: its time at 1x.
      for (const id of ST.tickSample) {
        const e = app.byId.get(id); if (!e) continue;
        startLevel(id, "normal"); let t = 0;
        for (const ch of e.L.win.normal) { if (!playCol(+ch)) break; t += tickQuiet(ST.tickCapMs); }
        ok(app.S.status === E.WON && dispMatches() && allHome(), id + ": the stored order wins on real ticks, tap after tap once the squads are home");
        out.notes["ticked_" + id] = Math.round(t / 1000) + " s";
      }
      // 2. Only what can be reached goes: level 3's Sawyers (10) with 4 timber in reach send 4, the rest wait at the space.
      if (app.byId.has("e1-03")) {
        startLevel("e1-03", "normal"); const j = frontOf(4), reach = app.S.reachable(4);
        if (ok(j >= 0 && app.B.cardN[app.S.front(j)] > reach, "dispatch: level 3 opens with more Sawyers than timber in reach")) {
          playCol(j); for (let t = 0; t < 1500; t += 16) step(16);
          const s = app.S.order(app.ord)[0];
          ok(app.S.sent <= reach && app.S.spW[s] > 0 && app.V.runners().live === app.S.out, "dispatch: " + reach + " in reach, " + app.S.sent + " go, " + app.S.spW[s] + " wait at the space; one runner per sapper out");
        }
      }
      // 3. Three rapid taps: three squads out at once, each with runners alive; no play completes early.
      { const reachCols = (S, B) => { const o = []; for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0 && S.reachable(B.cardM[f]) > 0) o.push(j); } return o; };
        const pref = app.byId.get(ST.overlapLevel), pool = (pref ? [pref] : []).concat(app.levels.slice().reverse());
        const e = pool.find((x) => { const B = E.compile(x.L); return reachCols(E.sim(B, rulesOf("normal")), B).length >= 3; }) || app.levels[0];
        startLevel(e.id, "normal");
        const cols = reachCols(app.S, app.B).slice(0, 3);
        for (const j of cols) { playCol(j); step(16); step(16); }
        for (let t = 0; t < 700; t += 16) step(16);
        const R = app.V.runners(), spaces = R.bySpace.filter((k) => k > 0).length;
        ok(cols.length === 3 && app.S.lineLen === 3 && spaces === 3 && R.live >= 3, "overlap: three rapid taps leave three squads out, runners alive in all three (" + JSON.stringify(R.bySpace) + ")");
        out.notes.overlap = e.id + " cols " + cols.join("") + " runners " + R.live; }
      // 4. A jam loss on a late level: seeded patient taps until every space holds a squad that can't reach a block; the
      // line jams at rest, one jam cue, the sheet names the crews, Retry is primary. Then a Retry mid-show clears every runner.
      let jp = null; for (const e of app.levels) { if (e.L.band !== "hard" && e.L.band !== "hardest") continue; const p = jamPlan(e, "normal"); if (p) { jp = { e, p }; break; } }
      if (ok(!!jp, "jam: found a patient order that jams a late level")) {
        startLevel(jp.e.id, "normal"); const j0 = app.cues.jam | 0; patient(jp.p.prefix);
        ok(app.S.status === E.FAILED && app.S.reason === "jam" && app.ending && app.ending.reason === "jam" && app.S.lineLen === app.S.cap, "jam: the line fills with squads that can't reach a block and jams at rest");
        ok(app.S.order(app.ord).every((q) => app.S.stuck(q)) && (app.cues.jam | 0) === j0 + 1, "jam: every squad in the line reads stuck; one jam cue");
        let at = null; for (let t = 0; t < SH.settleCapMs + 3000 && !app.panel; t += 16) { step(16); if (app.panel && !at) at = { busy: app.S.busy, ms: app.clock - app.endT }; }
        const pl = $("p-line").getAttribute("aria-label") || "", chipsOK = chipCheck();
        ok(app.panel === "fail" && /^Line jammed: .+ can't reach a block\.$/.test(pl) && pl.indexOf(app.ending.crews[0]) >= 0 && hitOK($("p-primary")) && $("p-primary").textContent === "Retry", "jam: the sheet's label names the jammed crews (" + pl + "), Retry is primary and hittable");
        ok(chipsOK === true, "jam: the sheet shows one colour chip with its count per jammed squad, no crew names (" + chipsOK + ")");
        const sl = sheetClear(); ok(sl === true, "jam: the fail sheet leaves the jammed line in view (" + sl + ")");
        out.notes.jam = jp.e.id + " '" + jp.p.prefix + "' (sheet after " + (at ? Math.round(at.ms) : "?") + " ms)";
      }
      { const e = app.byId.get(ST.overlapLevel) || app.levels[app.levels.length - 1]; startLevel(e.id, "normal"); fillLine(); step(16); step(16);
        const liveBefore = app.V.live; retry();
        ok(liveBefore > 0 && app.V.live === 0 && !app.S.busy && app.S.plays === 0 && app.S.lineLen === 0, "retry: mid-show, every runner goes and the level restarts (" + liveBefore + " runners cleared)"); }
      // 5. Key and gate: the gate stays iron until its key pops; then the lock drops, the bars fall, the board shakes.
      const ge = app.levels.find((e) => e.L.gates && e.L.gates.length);
      if (ok(!!ge, "gate: a level with a gate exists")) {
        startLevel(ge.id, "normal"); const B = app.B, ord = ge.L.win.normal, gc = B.gateCells[0]; let seen = null, before = true;
        for (let i = 0; i < ord.length && app.S.status === E.PLAYING && !seen; i++) {
          const c0 = app.cues.gate | 0; playCol(ord.charCodeAt(i) - 48);
          for (let t = 0; t < ST.tickCapMs && app.S.busy && !seen; t += 16) {
            if (!gc.every((c) => app.S.a[c] === E.IRON) && app.V.gSt[0] === 0) before = false;
            step(16);
            if (app.V.gSt[0] === 1) { step(48); seen = Object.assign(app.V.fxInfo(), { cue: (app.cues.gate | 0) - c0 }); }
          }
        }
        ok(before && !!seen && seen.gates[0] === 1 && seen.lockFalling && seen.falls > 0 && seen.shaking && seen.cue === 1, "gate show: iron until the key pops, then the lock drops, the bars crumble, the board shakes, one gate cue (" + JSON.stringify(seen) + ")");
        tickQuiet(ST.tickCapMs); step(1500);
        ok(gc.every((c) => app.V.disp[c] <= 0 && app.S.a[c] === E.DIRT) && app.V.fxInfo().falls === 0, "gate show: the gate is open ground once its show ends");
      }
      // 6. An archer hit on every difficulty (Easy/Normal: sent back to its space; Hard: killed, and the level fails short).
      for (const d of DIFFS) {
        const lethal = rulesOf(d).archersKill, pred = (S) => (lethal ? S.kills > 0 : S.hits > 0 && S.status === E.PLAYING); let found = null;
        for (const e of app.levels) { if (!(e.L.towers && e.L.towers.length) || e.L.safeArchers) continue; const o = search(e, d, pred, ST.searchTries, ST.searchSeed); if (o) { found = { e, o }; break; } }
        if (!ok(!!found, "archers " + d + ": found an order with a hit")) continue;
        startLevel(found.e.id, d); patient(found.o.slice(0, -1)); playCol(found.o.charCodeAt(found.o.length - 1) - 48);
        let arrow = false, struck = null, live = 0;
        for (let t = 0; t < ST.tickCapMs && !struck; t += 16) { step(16); const h = app.V.hitInfo(); if (h.live) live = h.kind; if (h.arrows) arrow = true; if (h.struck) struck = h; }
        ok(live === (lethal ? 2 : 1) && arrow && !!struck && struck.label, "archers " + d + ": a " + (lethal ? "doomed" : "knocked-back") + " runner, the arrow flies and strikes, the label rises (" + JSON.stringify(struck) + ")");
        ok(lethal ? app.S.kills > 0 : app.S.hits > 0 && app.S.kills === 0, "archers " + d + ": the engine records the " + (lethal ? "kill" : "hit") + " when the arrow lands");
        if (!lethal) { const j = app.cards.findIndex((b, k) => app.S.front(k) >= 0), p0 = app.S.plays, busy = app.S.busy;
          ok(busy && (j < 0 || app.S.lineLen >= app.S.cap || (playCol(j) && app.S.plays === p0 + 1)), "archers " + d + ": a tap mid-show still plays (input never waits on the show)"); }
        else { ok(app.S.status === E.FAILED && app.S.reason === "short", "archers hard: the kill leaves the colour short: the assault fails"); const busy = app.S.busy || app.V.live > 0; retry(); ok(busy && app.S.plays === 0 && app.V.live === 0 && app.S.status === E.PLAYING, "archers hard: Retry mid-show restarts at once"); }
        out.notes["archer_" + d] = found.e.id + " '" + found.o + "'";
      }
      // 6b. The archer teaching level never kills (safeArchers): on Hard a hit walks back to its space and play goes on.
      if (app.byId.has("e3-51")) { const e = app.byId.get("e3-51"), o = search(e, "hard", (S) => S.hits > 0, ST.searchTries, ST.searchSeed);
        if (ok(!!o, "e3-51 hard: found a tap into the ring")) { startLevel("e3-51", "hard"); patient(o); ok(app.S.hits > 0 && app.S.kills === 0 && app.S.status === E.PLAYING, "e3-51 hard: archers send the hit sapper back, never kill"); } }
      // 7. Every space taken (rushed taps, squads out): each front card is marked blocked and the head says to wait. A tap
      // on one is refused: engine state, tray, line and board byte-identical; the card shakes, the toast, one blocked
      // sound, and hammering it stays quiet. Once a squad is home the same card plays. (With patient play a full line of
      // stuck squads is already a jam, so this state only comes from rushing.)
      { const e = app.byId.get(ST.overlapLevel) || app.levels[app.levels.length - 1]; startLevel(e.id, "normal"); const taps = fillLine();
        let right = true, marked = 0;
        for (let j = 0; j < E.NCOL; j++) { if (app.S.front(j) < 0) continue; marked++; if (!app.cards[j].classList.contains("blocked")) right = false; }
        ok(app.S.status === E.PLAYING && app.S.lineLen === app.S.cap && $("line-wrap").classList.contains("full") && $("line-lab").textContent === LY.fullText && marked > 0 && right, "full line: rushed taps fill every space with squads out; every front card is marked blocked, the head says wait (" + e.id + " '" + taps + "')");
        ok(readLine().work > 0 && app.slots.some((q) => q.classList.contains("work") && !q.classList.contains("stuck")), "full line: squads with sappers out wear the working mark, not stuck");
        const j = app.cards.findIndex((b, k) => app.S.front(k) >= 0);
        const snap = () => Array.from(app.S.save()).join(",") + "|" + app.cards.map((b) => b.className + ":" + b.textContent + ":" + b.disabled).join("/") + "|" + app.slots.map((q) => q.className + ":" + q.textContent).join("/") + "|" + Array.from(app.V.disp).join("");
        const b0 = snap(), c0 = app.cues.blocked | 0, r0 = app.refused, played = playCol(j);
        ok(!played && snap() === b0 && app.S.status === E.PLAYING && app.S.front(j) >= 0, "refused: a tap with no free space changes nothing (engine state, tray, line and board byte-identical); no fail");
        ok((app.cues.blocked | 0) === c0 + 1 && !$("toast").hidden && $("toast").textContent === LY.blockedText && (!app.cards[j].getAnimations || app.cards[j].getAnimations().length > 0), "refused: the card shakes, the toast says wait, one soft blocked sound");
        playCol(j); playCol(j);
        ok(app.refused === r0 + 3 && (app.cues.blocked | 0) === c0 + 1 && snap() === b0, "refused: hammering the card is throttled (no second sound within " + SH.blockedGapMs + " ms) and still changes nothing");
        let t = 0; for (; app.S.lineLen >= app.S.cap && app.S.status === E.PLAYING && t < ST.tickCapMs; t += 16) step(16);
        const p0 = app.S.plays;
        ok(app.S.lineLen < app.S.cap && playCol(j) && app.S.plays === p0 + 1, "refused, then accepted: once a squad is home the same card plays (after " + t + " ms)"); }
      // 7b. Stuck and working on a real level: 2 squads with nothing in reach (hatched, locked) and 2 out working (gold rim,
      // walking marker); the head counts them. Then the near jam: 3 stuck, 1 working, 1 free warns.
      { let got = null, near = null;
        for (const e of app.levels) { if (e.n < 16) continue; startLevel(e.id, "normal"); const tp = stageLine(2, 2); if (tp) { step(16); got = { e, tp, li: Object.assign({}, readLine()) }; break; } }
        if (ok(!!got, "stuck/working: a level whose fronts give 2 stuck and 2 working squads")) {
          const st = app.slots.filter((q) => q.classList.contains("stuck")).length, wk = app.slots.filter((q) => q.classList.contains("work") && !q.classList.contains("stuck")).length;
          ok(got.li.stuck === 2 && got.li.work === 2 && got.li.free === 1 && !got.li.near && st === 2 && wk === 2 && /2 stuck/.test($("line-cnt").textContent) && /2 working/.test($("line-cnt").textContent) && /1 free/.test($("line-cnt").textContent), "stuck/working: two hatched stuck spaces, two working, the head reads '" + $("line-cnt").textContent + "' (" + got.e.id + " '" + got.tp + "')"); }
        for (const e of app.levels) { if (e.n < 16) continue; startLevel(e.id, "normal"); const tp = stageLine(3, 1); if (tp) { step(16); near = { e, tp, li: Object.assign({}, readLine()) }; break; } }
        if (ok(!!near, "near jam: a level whose fronts give 3 stuck and 1 working")) {
          const last = app.slots.filter((q) => q.classList.contains("last")).length;
          ok(near.li.near && $("line-wrap").classList.contains("near") && $("line-lab").textContent === LY.nearText && last === 1, "near jam: every squad but one stuck and one space left: '" + LY.nearText + "', the last space pulses (" + near.e.id + " '" + near.tp + "')"); } }
      // 7c. The jam on a level built for it (selfTest.jamLevel): four inner colours wait stuck (the near-jam warning, the
      // warn cue on that tap), the fifth fills the line and it jams at rest; no victory march; the sheet names the crews.
      { const e = fx("jamLevel"); startLevel(e.id, "normal"); const w0 = app.cues.warn | 0; patient("1234");
        ok(readLine().near && readLine().stuck === 4 && app.slots.filter((q) => q.classList.contains("stuck")).length === 4 && app.slots.some((q) => q.classList.contains("last")) && (app.cues.warn | 0) === w0 + 1, "jam level: four stuck squads, one space left: the near-jam warning and one warn cue");
        playCol(0); settleNow();
        ok(app.S.status === E.FAILED && app.S.reason === "jam" && !app.march, "jam level: the fifth stuck squad jams the line at rest; the pace never switches to the victory march");
        for (let t = 0; t < SH.settleCapMs + 3000 && !app.panel; t += 16) step(16);
        ok(app.panel === "fail" && /^Line jammed: .+ and 2 more can't reach a block\.$/.test($("p-line").getAttribute("aria-label")) && chipCheck() === true && $("p-line").querySelectorAll(".chip").length === 5, "jam level: the sheet's label names three crews and 'and 2 more' (" + $("p-line").getAttribute("aria-label") + "); five chips show");
        startLevel(e.id, "normal"); patient("001234"); settleNow();
        ok(app.S.status === E.WON, "jam level: the ring's crew first wins (the level is fair)");
        const s2 = fx("stuckLevel"); startLevel(s2.id, "normal"); playCol(0);
        ok(!app.march, "stuck level: the tray is empty but the line will end stuck: no victory march"); settleNow();
        ok(app.S.status === E.FAILED && app.S.reason === "stuck" && !app.march, "stuck level: it fails stuck, the pace never switched"); }
      // 8. Determinism on ticks (a hidden tab driven by SP.tick): the same taps at the same ticks give the same state.
      { const e = app.byId.get(ST.overlapLevel) || app.levels[40], sig = () => { startLevel(e.id, "normal"); const o = e.L.win.normal; for (let i = 0; i < 8 && i < o.length; i++) { playCol(+o[i]); for (let k = 0; k < 37; k++) step(16); } for (let k = 0; k < 90; k++) step(16); return Array.from(app.S.save()).join(",") + "|" + app.V.live + "|" + Array.from(app.V.disp).join(""); };
        ok(sig() === sig(), "ticks: the same taps at the same 16 ms ticks give an identical engine state and board (" + e.id + ")"); }
      // 9. solve() leaves the save byte-identical.
      startLevel(app.levels[Math.min(20, app.levels.length - 1)].id, "normal");
      const s0 = app.save.store.getItem(key) + "|" + JSON.stringify(app.save.data), sol = solveHere();
      ok(!!sol, "solve: finds a win from the start");
      ok(s0 === app.save.store.getItem(key) + "|" + JSON.stringify(app.save.data), "solve: the save is byte-identical after solve()");
      // 10. elementFromPoint on the primary buttons of every screen.
      showScreen("title"); ok(hitOK($("btn-play")), "hit: title Play");
      showScreen("map"); ok(hitOK($("map-play")), "hit: map Play");
      startLevel(app.levels[0].id, "normal");
      for (let j = 0; j < E.NCOL; j++) if (app.S.front(j) >= 0) ok(hitOK(app.cards[j]), "hit: card " + j);
      ok(hitOK($("btn-retry")), "hit: Retry");
      // 11. The win on ticks: the last blocks fall; the keep comes down only once every sapper is home; the panel stamps
      // this difficulty's medal.
      delete app.save.data.done[app.levels[0].id];
      const w1 = app.levels[0].L.win.normal, col0 = app.cues.collapse | 0; let falls = 0, gobBusy = null;
      patient(w1.slice(0, -1)); playCol(w1.charCodeAt(w1.length - 1) - 48);
      for (let t = 0; t < ST.tickCapMs && !app.V.gob.on; t += 16) { step(16); falls = Math.max(falls, app.V.fxInfo().falls); if (app.V.gob.on) gobBusy = app.S.busy; }
      step(16); const kf = app.V.fxInfo();
      ok(falls > 0 && kf.keep && kf.shaking && app.V.gob.on && gobBusy === false && (app.cues.collapse | 0) === col0 + 1 && (app.cues.fanfare | 0) > 0, "win: the last blocks fall, the keep comes down once every sapper is home, one collapse, the fanfare");
      tick(8000);
      ok(app.panel === "win" && hitOK($("p-primary")), "hit: the win panel's Next");
      { const w = sheetClear(true); ok(w === true, "win: the sheet covers the whole holding line or none of it (" + w + ")"); }
      ok(!$("p-medals").hidden && $("p-medals").querySelectorAll(".medal.new").length === 1, "win: the panel stamps the new Normal medal");
      // 12. Pause: nothing moves and the sheet takes the tap; one tap resumes with no jump in time and no card played.
      startLevel(app.levels[0].id, "normal");
      pause(); const pc = app.clock; advance(1000); advance(1600);
      ok(app.paused && app.clock === pc && !$("pause").hidden && hitOK($("pause")) && !hitOK(app.cards[0]), "pause: the clock stops and the Paused sheet covers the cards");
      $("pause").click(); advance(5000); advance(5016);
      ok(!app.paused && $("pause").hidden && app.clock - pc <= 32 && app.S.plays === 0, "pause: one tap resumes, the clock moves on without a jump, no card played");
      app.lastT = 0;
      // 13. The teaching coach: each script shows its first line and its arrow at load, only moves forward on the stored
      // order (played patiently), and is gone at the win; a player who follows the arrow sees every step.
      for (const id of Object.keys(app.cfg.teach || {})) {
        if (id === "note") continue;
        const e = app.byId.get(id); if (!ok(!!e, "coach: level " + id + " exists")) continue;
        startLevel(id, "normal"); const c0 = coachState(), steps = app.cfg.teach[id];
        ok(c0.on && c0.text.length > 0 && c0.fits && c0.text.indexOf("{") < 0 && (c0.hand || c0.ring), id + ": the coach line fits its box (" + (c0.oneLine ? "one line" : "two lines") + ", " + c0.mode + ") with its arrow at load (" + c0.text + ")");
        if (app.focusEl) ok(hitOK(app.focusEl), id + ": the arrow never covers its target");
        const cc = coachClear(); ok(cc === true, id + ": the coach box covers no board and the arrow no count or line head (" + cc + ")");
        const seen = new Set([c0.i]); let last = c0.i, mono = true;
        let clear = true; for (const ch of e.L.win.normal) { playCol(+ch); settleNow(); const cs = coachState(); if (cs.i >= 0) { if (cs.i < last) mono = false; last = cs.i; seen.add(cs.i); if (cs.on && clear === true) clear = cs.fits ? coachClear() : "'" + cs.text + "' overflows its box"; } }
        ok(clear === true, id + ": at every step of the stored order the coach covers no board and the arrow no count (" + clear + ")");
        ok(mono && !coachState().on && app.S.status === E.WON, id + ": on the stored order the coach only moves forward (" + Array.from(seen).join(",") + ") and is gone at the win");
        startLevel(id, "normal"); const saw = new Set();
        for (let g = 0; g <= app.B.ncards && app.S.status === E.PLAYING; g++) {
          const cs = coachState(); if (cs.on) saw.add(cs.i);
          let jj = app.focusEl ? app.cards.indexOf(app.focusEl) : -1; if (jj < 0 || app.S.front(jj) < 0 || app.S.refused(jj)) jj = app.cards.findIndex((b, k) => app.S.front(k) >= 0 && !app.S.refused(k));
          playCol(jj); settleNow();
        }
        ok(saw.size === steps.length && app.S.status === E.WON && !coachState().on, id + ": following the arrow shows all " + steps.length + " steps (" + Array.from(saw).join(",") + ") and wins");
        out.notes["coach_" + id] = Array.from(seen).join(",") + " / " + Array.from(saw).join(",");
      }
      if (app.byId.has("e1-02")) { startLevel("e1-02", "normal"); playCol(frontOf(3)); settleNow(); const cs = coachState(); ok(cs.i === 1 && app.focusEl === $("line"), "coach e1-02: the Torchbearers wait in their space, the arrow moves to the holding line"); }
      if (app.byId.has("e3-51")) { startLevel("e3-51", "normal"); ok(app.V.focus.on && coachState().target && /card/.test(coachState().target), "coach e3-51: the tower wears the ring and the arrow points at the Quarrymen"); }
      // v4 M3: the twists' lessons point at their twist from the first tap: a ? tile (35), a linked front card (62), the
      // padlocked space with a ring on its key (76).
      if (app.byId.has("e2-35")) { startLevel("e2-35", "normal"); const el = app.focusEl; ok(!!el && el.classList.contains("next") && el.classList.contains("mys"), "coach e2-35: the arrow points at a hidden ? squad (" + (el && el.className) + ")"); }
      if (app.byId.has("e3-62")) { startLevel("e3-62", "normal"); const j = app.cards.indexOf(app.focusEl); ok(j >= 0 && app.S.partner(app.S.front(j)) >= 0 && app.rods.innerHTML.indexOf("<path") >= 0, "coach e3-62: the arrow points at a linked front card, its rod drawn"); }
      if (app.byId.has("e4-76")) { startLevel("e4-76", "normal"); ok(app.focusEl === app.slots[app.S.cap - 1] && app.focusEl.classList.contains("locked") && app.V.focus.on && app.S.locked === 1, "coach e4-76: the arrow points at the padlocked space and the key wears the ring"); }
      // 13b. Victory march: on a stored winning line the pace stays 1x until the tray empties, then plays at
      // show.victoryPace; the final state (board, every sapper's times, status) is identical to the same taps at 1x; with
      // 2x or 3x on, the faster pace stays.
      { const e = app.byId.get("e1-03") || app.levels[0], o = e.L.win.normal, vp = SH.victoryPace;
        const run = () => { startLevel(e.id, "normal"); let before = false; for (let i = 0; i < o.length - 1; i++) { playCol(+o[i]); tickQuiet(ST.tickCapMs); before = before || app.march; } playCol(+o[o.length - 1]);
          const r = { before, march: app.march, pace: paceNow(), busy: app.S.busy }; tickQuiet(ST.tickCapMs); const S = app.S, k = S.sent;
          r.sig = Array.from(S.a).join("") + "|" + S.status + "|" + S.hash() + "|" + k + "|" + Array.from(S.q0.subarray(0, k)).join(",") + "|" + Array.from(S.q1.subarray(0, k)).join(",") + "|" + Array.from(S.q2.subarray(0, k)).join(",");
          r.won = S.status === E.WON; return r; };
        let A = null, Z = null, F = null, F3 = null;
        try { A = run(); SH.victoryPace = 1; Z = run(); SH.victoryPace = vp; app.speed = SPD[1]; F = run(); app.speed = SPD[2]; F3 = run(); } finally { SH.victoryPace = vp; app.speed = SPD[0]; }
        ok(!A.before && A.march && A.busy && A.pace === SH.pace * vp && A.won, "victory march: 1x until the tray empties; the last tap of the winning line switches to " + vp + "x while the squads come home");
        ok(A.sig === Z.sig, "victory march: the final state is identical to the same line at 1x");
        ok(F.march && F.pace === SH.pace * Math.max(SPD[1], vp) && F.won && F3.march && F3.pace === SH.pace * Math.max(SPD[2], vp) && F3.won, "victory march: with 2x or 3x on the faster pace stays (" + F.pace + "x, " + F3.pace + "x)");
        startLevel(e.id, "normal"); for (let i = 0; i < o.length; i++) { playCol(+o[i]); if (i < o.length - 1) tickQuiet(ST.tickCapMs); }
        ok(app.march && $("line-wrap").classList.contains("march") && $("line-lab").textContent === LY.marchText.replace("{x}", vp), "victory march: the head reads '" + $("line-lab").textContent + "'");
        skip(); ok(!app.S.busy && app.S.status === E.WON, "victory march: skip still lands everything");
        setSpeed(SPD[2], false); startLevel(e.id, "normal"); for (let i = 0; i < o.length; i++) { playCol(+o[i]); if (i < o.length - 1) tickQuiet(ST.tickCapMs); }
        const l3 = $("line-lab").textContent; setSpeed(SPD[0], false); skip();
        ok(l3 === LY.marchText.replace("{x}", Math.max(SPD[2], vp)), "victory march: at " + SPD[2] + "x the head shows the pace in use (" + l3 + ")"); }
      // 15. The queue (v4 M1): every column shows layout.queueRows tiles, front first, checked against the engine at load
      // and after every tap of a stored order (played patiently): each shown tile has its card's colour and count and
      // nothing else (no crew name), a row past the column's end is hidden, the rows behind are full size and fade back.
      { const e = app.byId.get(ST.queueLevel) || app.levels[Math.min(39, app.levels.length - 1)], RW = LY.queueRows;
        const qCheck = () => { const S = app.S, B = app.B; let n = 0;
          for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < RW; d++) {
            const el = d ? app.nexts[j][d - 1] : app.cards[j], ci = S.card(j, d), r = el.getBoundingClientRect(), shown = getComputedStyle(el).visibility !== "hidden" && r.width > 0 && r.height > 0;
            if (ci < 0) { if (d ? shown : !el.classList.contains("empty")) return "column " + j + " row " + d + " shows a card past the column's end"; continue; }
            const m = B.cardM[ci], k = String(B.cardN[ci]);
            if (!shown) return "column " + j + " row " + d + " is hidden";
            if (el.style.getPropertyValue("--mc") !== mat(m).c || el.textContent !== k) return "column " + j + " row " + d + " shows '" + el.textContent + "' in " + el.style.getPropertyValue("--mc") + ", the engine has " + k + " " + mat(m).c;
            if (d && el.style.getPropertyValue("--fc") !== app.fadeC[d][m]) return "column " + j + " row " + d + " is not faded toward the tray";
            n++; }
          return n; };
        startLevel(e.id, "normal");
        const S = app.S, want = app.cards.reduce((a, b, j) => a + Math.min(RW, app.B.colLen[j]), 0), q0 = qCheck();
        const hs = [], op = [], fc = [], j0 = Math.max(0, app.cards.findIndex((b, j) => S.card(j, RW - 1) >= 0));
        for (let d = 0; d < RW; d++) { const el = tileOf(j0, d); hs.push(el.getBoundingClientRect().height); op.push(+getComputedStyle(el).opacity); fc.push(el.style.getPropertyValue("--fc") === (d ? app.fadeC[d][app.B.cardM[S.card(j0, d)]] : mat(app.B.cardM[S.card(j0, 0)]).c)); }
        ok(q0 === want && RW === 3 && hs[1] < hs[0] && hs[2] < hs[1] && op.every((o) => o === 1) && fc.every(Boolean), "queue: " + RW + " rows per column stepping down (" + hs.map((h) => h.toFixed(1)).join(", ") + " px), all at full opacity, the rows behind faded toward the tray (layout.fade); " + q0 + " tiles match the engine (" + e.id + ")");
        let moved = true, taps = 0; const o = e.L.win.normal;
        for (let i = 0; i < o.length && app.S.status === E.PLAYING; i++) { playCol(+o[i]); settleNow(); taps++; const q = qCheck(); if (typeof q === "string") { moved = q + " after tap " + taps; break; } }
        ok(moved === true && S.status === E.WON, "queue: the rows move up with the engine on every tap of the stored order (" + (moved === true ? taps + " taps" : moved) + ")"); }
      // 16. Colour-blind mode (v4 M1): off by default, every block a plain stud but the iron gate (bars) and the gilt key
      // (its glyph). The title's toggle (a real click) turns it on: every other material's stud gains its mark, the gate and
      // key are unchanged, the queue tiles show their glyph, and the save keeps it (read back through sanitize). The map's
      // toggle turns it off again.
      { startLevel(ST.queueLevel && app.byId.has(ST.queueLevel) ? ST.queueLevel : app.levels[0].id, "normal");
        const off = app.V.studInfo(), gl = () => { const el = app.cards.find((b) => !b.classList.contains("empty")), g = el && el.querySelector(".gl"), r = g && g.getBoundingClientRect(); return !!g && getComputedStyle(g).display !== "none" && r.width > 0 && el.style.getPropertyValue("--gl").indexOf("url(") === 0; };
        ok(!app.cb && !off.cb && off.ink[E.IRON] > 0 && off.ink[E.GILT] > 0 && !gl(), "colour-blind off (the default): the gate keeps its bars (" + off.ink[E.IRON] + " px) and the key its glyph (" + off.ink[E.GILT] + " px); no glyph on the tiles");
        showScreen("title"); const tb = document.querySelector("#title .tog-cb"), hit1 = hitOK(tb); tb.click();
        showScreen("play"); const on = app.V.studInfo();
        let marked = 0; for (let m = 1; m < E.NMAT; m++) if (m !== E.IRON && m !== E.GILT && on.sum[m] !== off.sum[m] && on.ink[m] > off.ink[m]) marked++;
        const saved = app.save.data.settings.cb === true; app.save.write(); const reread = Save.open(app.save.store, key, app.order).data.settings.cb === true;
        ok(hit1 && app.cb && on.cb && tb.getAttribute("aria-pressed") === "true" && document.body.classList.contains("cb") && marked === E.NMAT - 3 && on.sum[E.IRON] === off.sum[E.IRON] && on.sum[E.GILT] === off.sum[E.GILT] && gl(),
          "colour-blind on (the title's toggle): all " + marked + " other materials wear their mark, the gate and key are unchanged, the tiles show their glyph");
        ok(saved && reread, "colour-blind: the save keeps it and reads it back (sanitized)");
        const junk = Save.sanitize({ settings: { cb: "yes", speed: 7, fast: true } }, app.order), junk2 = Save.sanitize({ settings: { cb: true, speed: 3 } }, app.order);
        ok(junk.settings.cb === false && junk.settings.speed === 2 && junk2.settings.cb === true && junk2.settings.speed === 3, "save: a bad colour-blind value loads off; a bad speed falls back (the old 2x flag loads as 2); good values load as saved");
        showScreen("map"); const mb = document.querySelector("#map .tog-cb"), hit2 = hitOK(mb); mb.click(); showScreen("play");
        const off2 = app.V.studInfo();
        ok(hit2 && !app.cb && !off2.cb && off2.sum.every((h, m) => h === off.sum[m]) && !gl() && app.save.data.settings.cb === false, "colour-blind off again (the map's toggle): the studs are plain again, byte for byte"); }
      // 17. Speed (v4 M1): the top bar's button cycles 1x, 2x, 3x and back to 1x through real clicks; its label, the pace
      // and the save follow, and at 3x the engine really runs three times real time.
      { startLevel(app.levels[0].id, "normal"); const b = document.querySelector("#top .tog-speed"), seen = [], hit = hitOK(b);
        for (let k = 0; k < SPD.length; k++) { b.click(); seen.push([app.speed, b.textContent, paceNow() / SH.pace, app.save.data.settings.speed].join(":")); }
        const want = SPD.map((_, k) => { const v = SPD[(k + 1) % SPD.length]; return [v, v + "×", v, v].join(":"); });
        ok(hit && seen.join(" ") === want.join(" "), "speed: the button cycles " + seen.join(" ") + " (speed:label:pace:saved)");
        b.click(); b.click(); const et0 = app.et; for (let k = 0; k < 10; k++) step(16);
        ok(app.speed === SPD[2] && Math.abs(app.et - et0 - 160 * SPD[2] * SH.pace) < 1e-6, "speed: at " + app.speed + "x, 160 ms of real time moves the engine " + (app.et - et0) + " ms");
        setSpeed(SPD[0], false); }
      // 18. v4 M2 debug levels: every stored order wins on every difficulty, played patiently through playCol; the board
      // matches the rules; none of it reaches the save's progress.
      { let wins = 0, total = 0; const done0 = JSON.stringify(app.save.data.done), last0 = app.save.data.last;
        for (const id of ST.debugOrder) { const e = app.byId.get(id); if (!ok(!!e, "debug: level " + id + " is loaded")) continue;
          for (const d of DIFFS) { total++; startLevel(id, d); const good = patient(e.L.win[d]); settleNow();
            if (ok(good && app.S.status === E.WON && dispMatches() && allHome(), id + " " + d + ": stored order wins played patiently through play()")) wins++; } }
        ok(JSON.stringify(app.save.data.done) === done0 && app.save.data.last === last0, "debug: the wins never reach the save's progress");
        out.notes.debug = wins + "/" + total; }
      // 19. Mystery tiles: at load and after every tap of the stored Normal order (v4-mystery and v4-all, colour-blind off
      // and on), each tile of a hidden card is the neutral tile with "?" and its count and nothing of its card (no colour
      // anywhere in its markup, no crew, no glyph); every other tile shows its card's colour and count. A card that
      // reaches the front turns over.
      { const Y = LY.mystery; let tiles = 0, hiddenSeen = 0, flips = 0, bad = null;
        const mCheck = () => { const S = app.S, B = app.B;
          for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < LY.queueRows; d++) {
            const el = tileOf(j, d), ci = S.card(j, d); if (ci < 0) continue; tiles++;
            const m = B.cardM[ci], html = el.outerHTML.toLowerCase(), hid = S.hidden(ci), gl = el.querySelector(".gl"), glOn = gl && getComputedStyle(gl).display !== "none" && el.style.getPropertyValue("--gl").indexOf("url(") === 0;
            if (hid) { hiddenSeen++;
              if (!el.classList.contains("mys") || el.style.getPropertyValue("--mc") !== Y.c || el.textContent !== B.cardN[ci] + Y.q || html.indexOf(mat(m).c.toLowerCase()) >= 0 || html.indexOf(mat(m).crew.toLowerCase()) >= 0 || glOn || !d) return "column " + j + " row " + d + " leaks or misses its ? (" + el.outerHTML.slice(0, 160) + ")"; }
            else if (el.classList.contains("mys") || el.style.getPropertyValue("--mc") !== mat(m).c || el.textContent !== String(B.cardN[ci])) return "column " + j + " row " + d + " shows the wrong tile for a revealed card";
          } return null; };
        for (const cb of [false, true]) { setCb(cb, false);
          for (const id of ["v4-mystery", "v4-all"]) { const e = app.byId.get(id); if (!e) continue; startLevel(id, "normal"); bad = bad || mCheck();
            for (const ch of e.L.win.normal) { const j = +ch, f0 = app.S.front(j); playCol(j); if (app.S.front(j) >= 0 && app.S.front(j) !== f0 && app.B.cardF[app.S.front(j)] & E.MYSTERY && (app.V.calm || app.cards[j].getAnimations().length > 0)) flips++; bad = bad || mCheck(); settleNow(); bad = bad || mCheck(); } } }
        setCb(false, false);
        ok(!bad && hiddenSeen > 0 && flips > 0, "mystery: " + tiles + " tiles checked (" + hiddenSeen + " hidden), colour-blind off and on: hidden ones show only ? and their count, the rest their colour; " + flips + " flips at the front" + (bad ? " (" + bad + ")" : "")); }
      // 20. Linked squads (v4-linked): the rods at load; a pair both of whose colours are in reach leaves together (runners
      // from both spaces); a stub when a partner sits below the visible rows; a linked tap with one space free is refused
      // and changes nothing (engine state, tray, line, board), both tiles shake, the toast says why.
      { const e = app.byId.get("v4-linked"), rodsN = () => app.rods.querySelectorAll("path").length / 3, stubs = () => app.rods.querySelectorAll("circle.dot").length / 2;
        if (ok(!!e, "linked: v4-linked is loaded")) {
          startLevel(e.id, "normal"); const r0 = rodsN(); let pairN = 0, together = null, stubSeen = 0;
          for (const ch of e.L.win.normal) { const j = +ch, f = app.S.front(j), p = app.S.partner(f); stubSeen = Math.max(stubSeen, stubs());
            if (p >= 0 && !together && app.S.reachable(app.B.cardM[f]) > 0 && app.S.reachable(app.B.cardM[p]) > 0) { playCol(j); for (let k = 0; k < 20; k++) step(16); const sp = app.S.order(app.ord).slice(-2), R = app.V.runners(); together = sp.length === 2 && sp.every((q) => R.bySpace[q] > 0) && app.slots[sp[0]].classList.contains("linked") && app.slots[sp[1]].classList.contains("linked"); pairN++; settleNow(); }
            else { if (p >= 0) pairN++; playCol(j); settleNow(); } }
          ok(r0 > 0 && app.S.status === E.WON && pairN === e.L.links.length, "linked: " + r0 + " rod(s) at load; the stored order plays all " + pairN + " pairs and wins");
          ok(together === true, "linked: a pair leaves together: runners out from both spaces at once, both spaces wear the chain");
          // Stub: search seeded patient play for a linked card whose partner is below the visible rows.
          for (let t = 0; t < 40 && !stubSeen; t++) { startLevel(e.id, "normal"); let sd = 5 + t;
            for (let g = 0; g < 20 && app.S.status === E.PLAYING && !stubSeen; g++) { const o = []; for (let j = 0; j < E.NCOL; j++) if (!app.S.refused(j) && app.S.front(j) >= 0) o.push(j); if (!o.length) break; sd = (Math.imul(sd, 1103515245) + 12345) | 0; playCol(o[((sd >>> 8) % o.length)]); settleNow(); stubSeen = stubs(); } }
          ok(stubSeen > 0, "linked: a partner below the visible rows shows a stub on the visible tile");
          // A same-instant tap order that leaves exactly one space free with a linked front card (searched on a copy).
          let plan = null; const X = E.sim(app.B, rulesOf("normal")), buf = X.save();
          const dfs = (ord) => { if (X.status !== E.PLAYING) return null; if (X.lineLen === X.open - 1) { for (let j = 0; j < E.NCOL; j++) if (X.front(j) >= 0 && X.partner(X.front(j)) >= 0 && X.refused(j)) return { ord, j }; return null; }
            const b2 = X.save(); for (let j = 0; j < E.NCOL; j++) { if (X.front(j) < 0 || X.partner(X.front(j)) >= 0 || X.refused(j)) continue; X.play(j); const got = dfs(ord + j); X.load(b2); if (got) return got; } return null; };
          plan = dfs(""); X.load(buf);
          if (ok(!!plan, "linked refusal: found taps that leave one space free with a linked card at the front")) {
            startLevel(e.id, "normal"); for (const ch of plan.ord) playCol(+ch);
            const j = plan.j, p = app.S.partner(app.S.front(j)), pt = tileOf(app.B.cardCol[p], rowOf(app.S, app.B.cardCol[p], p));
            const snap = () => Array.from(app.S.save()).join(",") + "|" + app.cards.map((b) => b.className + ":" + b.textContent + ":" + b.disabled).join("/") + "|" + app.nexts.flat().map((x) => x.className + ":" + x.textContent).join("/") + "|" + app.slots.map((q) => q.className + ":" + q.textContent).join("/") + "|" + Array.from(app.V.disp).join("");
            const b0 = snap(), c0 = app.cues.blocked | 0, blocked = app.cards[j].classList.contains("blocked"), played = playCol(j);
            ok(app.S.lineLen === app.S.open - 1 && blocked && !played && snap() === b0 && app.S.status === E.PLAYING, "linked refusal: one space free, the linked card wears the lock; its tap changes nothing (engine state, tray, line, board byte-identical)");
            ok((app.cues.blocked | 0) === c0 + 1 && $("toast").textContent === LY.linkedText && (app.V.calm || (app.cards[j].getAnimations().length > 0 && (!pt || pt.getAnimations().length > 0))), "linked refusal: both tiles shake, the toast says '" + $("toast").textContent + "'"); } } }
      // 21. The locked space (v4-locked): at load the last space is a padlocked socket and the key wears its brackets; on
      // the stored order the key pops, the unlock cue plays once, the padlock pops and the space opens.
      { const e = app.byId.get("v4-locked");
        if (ok(!!e, "lock: v4-locked is loaded")) {
          startLevel(e.id, "normal"); const S = app.S, last = app.slots[S.cap - 1], u0 = app.cues.unlock | 0;
          ok(S.open === S.cap - 1 && last.classList.contains("locked") && !last.hidden && getComputedStyle(last.querySelector(".pad")).display !== "none" && last.getAttribute("aria-label") === LY.lockedText && app.V.fxInfo().lockKey, "lock: the last space shows a padlock (" + S.open + " of " + S.cap + " open) and the key block wears its brackets");
          let seen = null; const o = e.L.win.normal;
          for (let i = 0; i < o.length && !seen; i++) { playCol(+o[i]); for (let t = 0; t < ST.tickCapMs && app.S.busy && !seen; t += 16) { step(16); if (!app.S.locked) seen = { cls: last.className, cue: (app.cues.unlock | 0) - u0, key: app.V.fxInfo().lockKey, open: app.S.open }; } }
          ok(!!seen && /unlocking/.test(seen.cls) && !/locked /.test(seen.cls + " ") && seen.cue === 1 && !seen.key && seen.open === app.S.cap, "lock: the key pops: one unlock cue, the padlock pops, the space opens (" + JSON.stringify(seen) + ")");
          for (let t = 0; t < app.cfg.show.unlockMs + 100; t += 16) step(16);
          ok(!last.classList.contains("unlocking") && !last.classList.contains("locked"), "lock: once the padlock's pop ends the space is an ordinary one"); } }
      // 22. The generalized jam's sheet: one space free and every front card linked (selfTest.linkJamLevel), and a line
      // full but for the locked space (selfTest.lockJamLevel). Both fixtures win with the right order.
      for (const [k, jam, win, re] of [["linkJamLevel", "2301", "00123", LY.jamLinkedText], ["lockJamLevel", "1234", "001234", LY.jamLockText]]) {
        const e = fx(k); startLevel(e.id, "normal"); patient(jam); settleNow();
        for (let t = 0; t < SH.settleCapMs + 3000 && !app.panel; t += 16) step(16);
        const pl = $("p-line").getAttribute("aria-label") || "", tx = $("p-line").textContent, want = k === "linkJamLevel" ? pl.indexOf(re) === 0 && tx.indexOf(re) === 0 : pl.slice(-re.length) === re && tx.slice(-re.length) === re;
        ok(app.S.status === E.FAILED && app.S.reason === "jam" && app.panel === "fail" && want && chipCheck() === true, k + ": at rest every front card is refused: the sheet says why (" + tx + " / " + pl + ")");
        startLevel(e.id, "normal"); patient(win); settleNow(); ok(app.S.status === E.WON, k + ": the right order wins"); }
      // 23. Critics 1 fix: the rods on the debug levels along their stored orders (every rod on its two tiles, never over a
      // third); B1: a linked pair leaving and then at rest, and a full line of big squads rushed out, with every count
      // clear of every badge.
      for (const id of ["v4-linked", "v4-all", "e3-62", "e3-67", "e4-89"]) { const e = app.byId.get(id); if (!e) continue; startLevel(id, "normal"); let bad = rodClear(), cb = chainClear(), gb = rodGlyph(), n = 0;
        for (const ch of e.L.win.normal) { if (bad !== true || cb !== true || gb !== true) break; playCol(+ch); settleNow(); bad = rodClear(); cb = chainClear(); gb = rodGlyph(); n++; }
        ok(bad === true && cb === true && gb === true, id + ": after each of " + n + " taps every rod lands on its two tiles and crosses no third, no rod or rivet touches a count, no chain tag covers one (" + bad + ", " + gb + ", " + cb + ")"); }
      if (app.byId.has("v4-linked")) { startLevel("v4-linked", "normal"); const j = app.cards.findIndex((b, k) => app.S.front(k) >= 0 && app.S.partner(app.S.front(k)) >= 0);
        if (ok(j >= 0 && playCol(j), "B1: a linked front card plays")) { for (let t = 0; t < 350; t += 16) step(16); const a = slotClear(), lk = app.slots.filter((q) => q.classList.contains("linked")).length; settleNow(); const b = slotClear();
          ok(a === true && b === true && lk === 2, "B1: both linked spaces wear the chain and every count stays clear of every badge, leaving and at rest (" + a + ", " + b + ")"); } }
      { const e = app.byId.get(ST.overlapLevel) || app.levels[app.levels.length - 1]; startLevel(e.id, "easy"); fillLine(); step(16); step(16); for (let t = 0; t < 400; t += 16) step(16);
        const c = slotClear(); ok(c === true && app.slots.some((q) => q.classList.contains("work")), "B1: a full Easy line of working squads (" + app.S.cap + " spaces" + ($("line").classList.contains("tight") ? ", tight" : "") + "): every count clear of every badge (" + c + ")"); }
      // 24. v4 M4, the Gallery: every picture's stored order on every difficulty, played patiently through playCol (the
      // board matches the rules, every sapper home); the level's palette on the tiles, the spaces' aria and the board;
      // sappers coming in from the edges; the Gallery screen locked before gallery.openAt is won and open after, a won
      // picture in colour with its title; a win recorded in the save's gal and the win sheet's next picture.
      if (app.gal.length) {
        const GC = app.cfg.gallery; let wins = 0, total = 0;
        for (const e of app.gal) for (const d of DIFFS) { total++; startLevel(e.id, d); const good = patient(e.L.win[d] || ""); settleNow();
          if (ok(good && app.S.status === E.WON && dispMatches() && allHome(), e.id + " " + d + ": the Gallery's stored order wins played patiently through play()")) wins++; }
        out.notes.gallery = wins + "/" + total;
        { const e = app.gal.find((x) => Object.keys(x.L.pal).length >= 5) || app.gal[0], P = e.L.pal; startLevel(e.id, "normal"); let bad = null;
          for (let j = 0; j < E.NCOL && !bad; j++) { const f = app.S.front(j); if (f < 0) continue; const m = app.B.cardM[f], want = P[m];
            if (app.cards[j].style.getPropertyValue("--mc") !== want.c) bad = "tile " + j + " is " + app.cards[j].style.getPropertyValue("--mc") + ", its colour is " + want.c;
            else if (app.cards[j].getAttribute("aria-label").toLowerCase().indexOf(want.n) !== 0) bad = "tile " + j + " reads '" + app.cards[j].getAttribute("aria-label") + "', not its colour's name " + want.n;
            else if (app.V.pal[m] !== want.c) bad = "the board draws " + m + " as " + app.V.pal[m]; }
          ok(!bad && app.V.sprites && !app.V.checkSprites().length, e.id + ": the tiles and the board use the picture's own colours, the tiles are named by colour (" + (bad || Object.keys(P).length + " colours") + ")");
          const o = e.L.win.normal; playCol(+o[0]); let seen = [0, 0, 0, 0]; for (let t = 0; t < 1200; t += 16) { step(16); const sd = app.V.sides(); for (let k = 0; k < 4; k++) seen[k] = Math.max(seen[k], sd[k]); }
          ok(seen.filter((k) => k > 0).length >= 3 && app.S.status === E.PLAYING, e.id + ": the first squad's sappers come in from the board's edges (top, left, right, yard: " + seen.join(", ") + ")");
          settleNow(); const sl = app.slots.find((q) => q.classList.contains("full")); ok(!sl || sl.getAttribute("aria-label").toLowerCase().indexOf(P[app.S.spM[+app.slots.indexOf(sl)]].n) === 0, e.id + ": a space reads its colour's name (" + (sl ? sl.getAttribute("aria-label") : "no squad waiting") + ")"); }
        // Locked: a fresh save. Both buttons show the padlock and the hint; a tap on either never opens the Gallery.
        app.save.data.done = {}; app.save.data.gal = {}; showScreen("title");
        const gb = $("btn-gallery"), mg = $("map-gallery");
        ok(!galOpen() && gb.classList.contains("locked") && gb.getAttribute("aria-disabled") === "true" && gb.querySelector(".gs").textContent === GC.lockedHint && hitOK(gb), "gallery: locked before level " + GC.openAt + " is won; the title's button shows the hint (" + gb.querySelector(".gs").textContent + ")");
        gb.click(); const s1 = app.screen; showScreen("map"); const mh = hitOK(mg); mg.click(); const s2 = app.screen; showScreen("gallery"); const s3 = app.screen;
        ok(s1 === "title" && s2 === "map" && s3 === "title" && mg.classList.contains("locked") && mh, "gallery: while locked, the title's and the map's buttons (hittable, padlocked) don't open it, nor does asking for the screen (" + [s1, s2, s3].join(", ") + ")");
        // Open: win the opening level. The buttons show the count; the screen shows every picture, dimmed.
        Save.record(app.save.data, GC.openAt, "normal"); showScreen("title");
        ok(galOpen() && !gb.classList.contains("locked") && gb.querySelector(".gs").textContent === GC.count.replace("{n}", 0).replace("{t}", app.gal.length), "gallery: open once level " + GC.openAt + " is won; the button counts " + gb.querySelector(".gs").textContent);
        gb.click(); const tiles = Array.from(document.querySelectorAll("#gal-grid .gal-tile"));
        ok(app.screen === "gallery" && tiles.length === app.gal.length && !tiles.some((t) => t.classList.contains("done")) && $("gal-credits").textContent === GC.credits && !document.querySelector("#gallery a") && hitOK(tiles[0]), "gallery: the title's button opens the grid of " + tiles.length + " pictures, none cleared, the credits line in plain text (no links)");
        const px = (c) => { const q = document.createElement("canvas"); q.width = c.width; q.height = c.height; const g = q.getContext("2d", { willReadFrequently: true }); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, s = new Set(); for (let i = 0; i < d.length; i += 4) s.add("#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")); return s; };
        const e0 = app.gal[1] || app.gal[0], i0 = app.gal.indexOf(e0), pal0 = new Set(Object.values(e0.L.pal).map((q) => q.c.toLowerCase())), dim0 = px(tiles[i0].querySelector("canvas"));
        // Cleared: win a picture through its stored order; the save's gal holds it, the sheet offers the next picture.
        startLevel(e0.id, "normal"); patient(e0.L.win.normal); settleNow(); tick(9000);
        const nx = nextPicture(e0);
        ok(app.panel === "win" && $("p-title").textContent === GC.winTitle && $("p-primary").textContent === GC.nextBtn && (app.save.data.gal[e0.id] & 2) && !app.save.data.done[e0.id] && hitOK($("p-primary")), "gallery: a picture won goes in the save's gal (" + app.save.data.gal[e0.id] + "), the sheet says '" + $("p-title").textContent + "' and offers '" + $("p-primary").textContent + "'");
        $("p-primary").click(); ok(app.entry === nx && app.screen === "play", "gallery: Next picture opens the next one not yet won (" + nx.id + ")");
        $("btn-map").click(); const col = px(tiles[i0].querySelector("canvas"));
        ok(app.screen === "gallery" && tiles[i0].classList.contains("done") && tiles[i0].querySelector(".gn").textContent === e0.L.title && [...col].every((c) => pal0.has(c)) && ![...dim0].some((c) => pal0.has(c)), "gallery: the top bar's button goes back to the grid; the won picture shows in its own colours with its title (" + e0.L.title + "), the rest stay dimmed");
        const saved = JSON.stringify(Save.sanitize(JSON.parse(JSON.stringify(app.save.data)), app.order, app.gal.map((x) => x.id)).gal), junk = Save.sanitize({ gal: { [e0.id]: 99, nope: 1, [app.gal[0].id]: "x" } }, app.order, app.gal.map((x) => x.id)).gal;
        ok(saved === JSON.stringify(app.save.data.gal) && JSON.stringify(junk) === JSON.stringify({ [e0.id]: 3 }), "gallery: the save's gal reads back through sanitize; a bad mask is clamped, unknown ids and non-numbers are dropped");
        showScreen("title");
      }
      // 14. Opaque sprite caches.
      const bad = app.V.checkSprites(); ok(!bad.length, "sprites: every opaque cache is opaque" + (bad.length ? " (" + bad.join(",") + ")" : ""));
    } catch (err) { ok(false, "selfTest threw: " + (err && err.message) + " " + (err && err.stack ? err.stack.split("\n")[1] : "")); }
    finally {
      app.byId.delete("fx-jamLevel"); app.byId.delete("fx-stuckLevel"); app.byId.delete("fx-linkJamLevel"); app.byId.delete("fx-lockJamLevel");
      app.save = was.save; app.testing = false; setSpeed(was.speed, false); setCb(was.cb, false); app.diff = was.diff;
      if (was.entry) startLevel(was.entry.id, was.diff); showScreen(was.screen); renderAll();
    }
    let snap2 = "?"; try { snap2 = was.save.store.getItem(key); } catch (e) { /* stays "?" */ }
    ok(snap === snap2, "save: the real save is untouched by selfTest");
    out.ms = Math.round(performance.now() - T0);
    return out;
  }
  const SP = { play: playCol, state, load: (id, diff) => { startLevel(resolve(id), diff); return state(); }, retry: () => { retry(); return state(); }, tick,
    solve: (nodes) => solveHere(nodes), selfTest, coach: coachState, cues: () => Object.assign({}, app.cues), fx: () => app.V.fxInfo(), hits: () => app.V.hitInfo(), runners: () => app.V.runners(),
    paused: () => app.paused, pause: () => { pause(); return app.paused; }, resume: () => { resume(); return app.paused; }, winOrder: (d) => (app.entry ? app.entry.L.win[d || app.diff] : null),
    lossPlan: (id, d) => lossPlan(resolve(id), d), settle: () => { settleNow(); return state(); }, reachable: (m) => (app.S ? app.S.reachable(m) : 0),
    // Screens for the harness: fill the line with rushed taps; stage k stuck and w working squads on level n (or the first
    // level from n whose fronts allow it). Both return the state plus the taps made.
    fill: () => { const taps = fillLine(); return Object.assign(state(), { taps }); },
    // v4 M2: load a selfTest fixture level (config selfTest[name], e.g. linkJamLevel) like a debug level (no save).
    fixture: (k, diff) => { const L = app.cfg.selfTest[k]; if (!L || !L.grid) return null; const id = "fx-" + k; if (!app.byId.has(id)) app.byId.set(id, { L, id, n: 0, era: 1, idx: -1, node: null, debug: true }); startLevel(id, diff); return state(); },
    stage: (n, k, w) => { for (const e of app.levels) { if (e.n < n) continue; startLevel(e.id, "normal"); const tp = stageLine(k, w); if (tp) return Object.assign(state(), { taps: tp }); } return null; },
    screen: (name) => { showScreen(name); return state(); }, skip: () => { skip(); return state(); }, speed: (k) => { setSpeed(k, false); return app.speed; },
    // Cost of n board draws right now (ms): the harness calls it mid-show.
    perf: (n) => { const k = Math.max(1, Math.min(500, n | 0 || 60)); let max = 0; const t0 = performance.now(); for (let i = 0; i < k; i++) { const a = performance.now(); app.V.draw(); max = Math.max(max, performance.now() - a); } return { mean: +((performance.now() - t0) / k).toFixed(3), max: +max.toFixed(3), runners: app.V.live }; },
    sprites: () => app.V.checkSprites(),
    // v4 M4: win siege levels 1 to gallery.openAt in the live save (the harness opens the Gallery this way); the ids of
    // the Gallery's pictures; the board's runners by entry edge.
    unlockGallery: () => { const k = app.order.indexOf(app.cfg.gallery.openAt); for (let i = 0; i <= k; i++) Save.record(app.save.data, app.order[i], "normal"); writeSave(); renderGalButtons(); return galOpen(); },
    gallery: () => app.gal.map((e) => e.id), sides: () => app.V.sides() };

  boot();
})();
