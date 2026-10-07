// Sapper's Path page v3 (SPEC-v3 §3, §6, §7): boot, screens (title, era map, play), layout, input (a tap on a front
// card plays that column; a board tap skips the show), the holding line and tray, the win/fail panel, save, the frame
// loop, and the ?debug=1 facade (window.SP) with selfTest. The rules live in engine.js, the board and the run-and-carry
// show in board.js, the title scene, wall and goblin sprites in art.js, the synth in audio.js.
//
// Playtest 1 (the dispatch model): the engine is a timed simulation. A tap takes a holding space at once (no free space:
// refused, v3.1); its sappers go out only to pixels they can reach, a round at a time, and the space frees when they are all
// home. The page plays engine time at show.pace x real time (2x doubles it), reads the engine's log into the board every
// step, and draws engine state. Cards stay live at any time; a board tap (or Space) skips: the engine runs until nothing
// moves and the board lands. Win and fail sheets wait for the squads to settle (v4.3: until every sapper is home, no cap).
// Clock: app.clock is sim time in ms. The rAF loop advances it by the real frame delta (capped at layout.maxDtMs);
// SP.tick(ms) advances it by hand, so a hidden tab (no rAF) can still be driven. The engine, the goblin, the panel delay
// and toasts all run on this clock; nothing here uses setTimeout or setInterval.
// M2: the teaching coach (config.teach: one line and a bouncing arrow on what to tap, advanced by play), the sound set
// (tap, a throttled pop per pixel, haul, line fill and near-jam warning, jam, blocked, gate, arrows, collapse, fanfare), the
// win beat (difficulty medals), and portal shape: pause on blur or a hidden tab (the clock stops and the audio context
// suspends; a Paused sheet takes the next tap so it can never play a card). (M2 also turned the board a quarter in
// landscape; v4.2's fix keeps every board upright.)
// v4.2 fix (the visual critic's B1 and V1): phones play upright. A touch screen held sideways under layout.upright.maxH
// tall shows the "turn your phone upright" card (#upright) and pauses as a blur does; turning it upright hides the card
// and resumes (only a pause the card made). A desktop window or a portal's iframe on a desktop never shows it. Boards
// are never turned; the wide layout fits them upright.
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
// v4 M4, the Gallery (levels/gallery.json, config.gallery): picture levels with their own palettes (ring boards then). The
// Gallery screen (a grid of the pictures: dimmed until won, then in colour with its title; the count; a plain-text
// credits line, no links) opens from the title and the map once siege level gallery.openAt is won; before that both
// buttons are locked and say so. Every picture is open once the Gallery is; a win goes in the save's gal (per
// difficulty, like the siege). A picture level uses its palette everywhere a colour shows (app.mats: tiles, spaces,
// chips, the board, the sappers' helmets) and its colour names wherever a crew name would be read (aria-labels, the jam
// sheet's label). The win sheet offers the next picture not yet won; the top bar's map button goes back to the Gallery.
// v4.1 (castle pictures, bottom entry): every Siege level is a picture too (its own palette, pal; a crew reads as its
// colour's name), and every board is entered from the entry square in the middle of its frame's bottom row. selfTest checks
// that runners leave their crates and come up through it, on a Siege level and a Gallery picture.
// v4 M5, the meta layer (rules of the power-ups in engine.js, coins, best results and lives in meta.js): the home screen
// replaces the title (the title scene with a top row: settings gear, siege progress, coins, lives only when meta.lives is
// on; one Play button labelled with the next level; a tab bar: Siege map, Home, Gallery padlocked until it opens; the
// story moves to the map). The settings sheet holds sound, speed and colour-blind marks (the Paused sheet carries
// colour-blind and sound too). The win sheet is the level report: time (real play time, pauses excluded), taps, coins
// counting up, best time and taps, the medals; the fail sheet keeps its reason and chips. The map shows a report card
// per era, the Gallery one for its pictures. The power-up bar under the queue (the foot of the side column on wide
// screens): four round badges with an owned count or a "+" price that buys one in place; the Quartermaster and Recall
// ask for a target (a tile behind the front, a waiting squad). Short frames (layout.shortRowsMaxH) show two queue rows.
// v4 Critics 2 fix: a coached level tries three rows with the coach's band above the board, then two rows with it, then
// the top bar (two lines there); a Gallery win shows the finished picture on the report (or over the razed board where
// the sheet has no room) and the Gallery marks the next picture; a buy short of coins looks it; the landscape bar fits its
// foot; the home's era chip lies on the river; era cards are a band; two rods down one gutter take a lane each.
// v4.3 (SPEC-v4 §9, the v4.3 entry): no difficulty picker. Every level (Siege and Gallery) plays on its one fixed tag
// (L.tag; v5 R1: it sets no rule, every level has 5 spaces and archers never kill), shown on its map button and Gallery tile, in the top bar
// and on the report (layout.tags: Hard a strong warning colour, Easy calm, Normal unmarked). Progress is by level id
// (save format 2, save.js): a level is cleared or not, with its best time and taps; the medals are gone and coins pay by
// tag (meta.coins). The Gallery opens one picture at a time: the first when Siege gallery.openAt is cleared, each next
// when the one before it is; the locked ones are padlocked silhouettes. A space frees when its squad's last block is
// picked up (engine.js), and the win or fail sheet waits until every sapper is home (no settle cap). A linked front card
// whose partner is buried waits for it (S.why 3): it wears the waiting look, a tap is refused with layout.linkedBuriedText,
// and a jam of them says layout.jamBuriedText.
// v4.3 fix pass (the critics on 08fbc65): every Play wears the next level's tag (the home's, the map's, the report's Next,
// the Gallery's Play chip; a red-gold face for Hard); the line head counts the sappers carrying blocks home after their
// space freed; a win's coins burst from their cell and a first clear wears a ribbon (reduced motion: none of it moves);
// on a wide screen a toast sits over the side column's tray and a fail sheet is its content's height; locked paintings
// get a two-tone silhouette and every locked tile's tag is dimmed.
// v5 R3 (the journey map; SPEC-v4 §9, the v5 R3 entry): the map screen replaces the level grid and the Gallery screen.
// Thirteen painted sheets (map/layout.json) stack bottom to top in one scroller, each image loaded as it nears the view;
// over each, an SVG in sheet pixels (the route walked in red dashes to the current node and faint ahead, plank bridges,
// stepping-stone detours to the side quests, the fog and the Goblin King on the top sheet) and a layer of buttons: the
// levels (cleared, current with its label, locked: a tap shakes), the side quests (prize until the first clear, then the
// finished picture, tap to replay), easter eggs (pay coins once: save eggs, meta.js egg), realm banners (lore on a tap).
// Past level 100 the road fades into fog; once 1-100 are cleared one next-picture node opens there (the long tail), the
// cleared ones beside it. Opening the map puts the current node about map.curAt down. Wide screens add a realm card and
// a next-up card. Pure parts in journey.js. A side quest won still offers the next open one, else the next level.
// v5 R4c: map/layout.json now holds 25 sheets (levels 1-200, realms 1-8) ahead of the levels. The map is built up to the
// frontier (the first level not built yet, or the summit's long-tail spot): nodes only for built levels, side quests only
// once their main level exists, eggs, bridges and banners only below the frontier's fog; the long tail's node waits at the
// frontier; the Goblin King stands at the summit by level 200 once it is built.
// v5.2 (SPEC-v4 §9, tools/v5-2-music-notes.md): music (audio.js). showScreen asks for the screen's track (music():
// home and map the theme, a level or side quest the play loop, realm 8's levels the boss loop); a win's sheet plays the
// jingle over the ducked loop. Settings has Music and Sound effects apart (saved: settings.music, settings.sfx); the quick
// mute buttons (top bar, Paused sheet) turn both off, or both on when both are off, and read "mixed" when one is off.
// v5.3 (SPEC-v4 §9, tools/v5-3-home-notes.md): the home is a painted siege (art/, a <picture>) sized to #title's own box
// with the castle centred (fitTitle, config title.art), not a pixel scene sized to the window; the realm line sits over Play.
// v5.4 (SPEC-v4 §9, tools/v5-4-notes.md): Settings gains Copy save code and Load save code (config saveCode.on; save.js
// encode, decode) and, at its foot apart from Done, Reset progress (config reset; save.js reset): a sheet that says what
// goes and a press-and-hold button whose fill runs on app.clock (step's holdStep, never a timer). Each sheet takes
// Settings' place and goes back to it. After a reset or a load: the home, with a toast over the screens (#toast.over).
(function () {
  "use strict";
  const NS = window.SappersPath, E = NS.engine, Save = NS.save, Board = NS.board, Art = NS.art, Audio = NS.audio, Meta = NS.meta;
  const V_ = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "1";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const TAGS = ["easy", "normal", "hard", "extreme"], $ = (id) => document.getElementById(id);
  // v4.3: a level's fixed tag (Normal when a file has none) and its one stored winning order.
  const tagOf = (e) => (e && e.L && TAGS.indexOf(e.L.tag) >= 0 ? e.L.tag : "normal"), winOf = (e) => (e && e.L && e.L.win && e.L.win[tagOf(e)]) || "";
  const app = { cfg: null, levels: [], byId: new Map(), order: [], eras: [], save: null, entry: null, B: null, S: null, V: null, audio: null, sheets: null, gal: [], mats: null, palKey: "", galTiles: [],
    clock: 0, lastT: 0, screen: "title", diff: "normal", speed: 1, fastPaid: false, debugSpeed: DEBUG, cb: false, allPw: false, tip: null, tipQ: [], tipHold: null, tipEat: -1, pwN: -1, // diff: the playing level's tag (v4.3) ending: null, endAt: -1, panel: null, panelAt: 0, testing: false,
    toastT: -1e12, popK: 0, cards: [], nexts: [], slots: [], wide: false, glURL: [], manURL: [], nodes: [],
    coach: null, used: 0, cues: {}, paused: false, pauses: 0, upright: false, upPause: false, focusEl: null, pt: { x: 0, y: 0 }, T: null, tbuf: null, labFit: new Map(), verdict: [],
    et: 0, endT: -1, lineDirty: false, lineMoved: false, ord: [], slotPts: [], blockT: -1e12, refused: 0, march: false,
    debug: [], flip: [false, false, false, false, false], rods: null, unlockT: -1e12, lockN: 0, lockWas: [false, false], lockSock: [-1, -1], slotUnT: new Array(8).fill(-1e12), reveals: 0, pairsOut: 0, // v6: each lock shut and its socket at the last render; when each socket opened
    fadeC: null, coached: false, coachMode: "", handKind: "", meas: null,
    li: { stuck: 0, work: 0, occ: 0, free: 0, near: false, full: false, danger: false },
    // v4 M5: config.meta (selfTest swaps in a copy), the lives clock (real time), the queue rows shown, the level's start
    // on app.clock, the win's report, a power-up waiting for its target (pick: {k}), the bar's badges, the icons' URLs.
    lay: null, jr: null, // v5 R3: map/layout.json and the journey map's built parts
    meta: null, now: () => Date.now(), rows: 3, t0: 0, report: null, pick: null, pws: [], icoURL: {}, pwPop: [-1e12, -1e12, -1e12, -1e12], lifeTxt: "", countTxt: "", carry: -1,
    hold: -1, loadR: null, clipFake: null, held: false }; // lands foundation: held, Settings open over a level // v5.4: the reset hold's start on app.clock (-1: none); a load's decoded code; selfTest's clipboard
  const togMute = Array.from(document.querySelectorAll(".tog-mute")), togMusic = Array.from(document.querySelectorAll(".tog-music")), togSfx = Array.from(document.querySelectorAll(".tog-sfx")), togSpeed = Array.from(document.querySelectorAll(".tog-speed")), togCb = Array.from(document.querySelectorAll(".tog-cb"));

  // ---- boot --------------------------------------------------------------------------------------------------------
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }
  async function boot() {
    try {
      const [cfg, lv] = await Promise.all([getJSON("config.json?v=" + V_), getJSON("levels/levels.json?v=" + V_)]);
      app.cfg = cfg; indexLevels(lv);
    } catch (e) { $("load-msg").textContent = "Couldn't load the siege. Reload to try again."; return; }
    if (DEBUG) { try { indexDebug(await getJSON("levels/debug-v4.json?v=" + V_)); } catch (e) { /* no debug row */ } }
    try { indexGallery(await getJSON("levels/gallery.json?v=" + V_)); } catch (e) { /* no side quests */ }
    try { app.lay = NS.journey.layoutOf(await getJSON("map/layout.json?v=" + V_)); } catch (e) { app.lay = null; /* no journey map: its Play still works */ } // lands foundation: mirrored entries resolved
    if (!app.levels.length) { $("load-msg").textContent = "No levels found."; return; }
    app.meta = app.cfg.meta; app.save = Save.open(storage(), app.cfg.save.key, app.order, app.gal.map((e) => e.id), app.meta); app.mats = app.cfg.v3.mats; keepTail(); // Land 1 fix (m5)
    app.sheets = Art.sources(app.cfg.art); fades();
    app.V = Board.create($("board"), app.cfg, app.sheets);
    const H = app.V.hooks;
    H.pop = onPop; H.deposit = () => cue("haul"); H.gate = () => cue("gate"); H.tower = () => cue("tower"); H.shot = () => cue("arrow");
    H.hit = (k) => cue(k === 2 ? "fall" : "thud"); H.collapse = () => cue("collapse");
    H.tap = () => { app.lineDirty = true; }; H.free = () => { app.lineDirty = true; }; H.move = () => { app.lineMoved = true; };
    H.reveal = (ci, j) => { if (app.S && app.S.front(j) === ci) { app.flip[j] = true; cue("flip"); } app.reveals++; app.lineDirty = true; };
    H.link = () => { app.pairsOut++; app.lineDirty = true; };
    H.unlock = () => { app.unlockT = app.clock; cue("unlock"); app.lineDirty = true; };
    H.power = () => { app.lineDirty = true; };
    try { app.V.calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* motion stays on */ }
    app.audio = Audio.create(app.cfg.audio, (f) => f + "?v=" + V_); // v5.2: the music files carry the cache tag
    setSound(app.save.data.settings.sfx, app.save.data.settings.music, false); setSpeed(1, false); setCb(app.save.data.settings.cb, false); // v5 R1: speed is never saved
    paintWall(); chips(); icons(); buildTray(); buildLine(); buildPowers(); buildMap(); progressText(); wire(); wireTitleArt();
    { const U = app.cfg.layout.upright, u = $("upright"); u.querySelector(".up-t").textContent = U.text; u.setAttribute("aria-label", U.text); }
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
      const entry = { L, id, n: L.n | 0, era: L.era | 0, idx: app.levels.length, node: null, boss: (app.cfg.boss || {})[id] || null }; // v5 R4 fix (S4): a boss's name and lines (config boss)
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
  // v4 M5: with the power-ups' uses per level; v5 R1: none for a power-up the campaign hasn't unlocked yet.
  const rulesOf = (d) => { const r = E.rulesOf(app.cfg.v3, d, app.meta); if (r.powers) r.powers = r.powers.map((v, k) => (pwOpen(k) ? v : 0)); return r; };
  // v5 R1, the campaign's reach: the number of the first open Siege level not cleared (one past the last when all are).
  function reach() { const D = app.save.data, id = Save.next(D, app.order), e = app.byId.get(id); return !e ? 1 : D.done[id] ? e.n + 1 : e.n; }
  const pwOpen = (k) => app.allPw || Meta.isOpen(app.meta, k, reach());
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
  // v4 M5: the power-up and meta icons (art.js) as image URLs at whole device pixels; the small ones go to CSS
  // (--ic-coin, --ic-heart, --ic-castle) for .ico elements.
  function icons() {
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), I = Art.icons(app.cfg.art), rs = document.documentElement.style;
    for (const [k, c] of Object.entries(I)) { try { const z = Math.max(1, Math.round((k[0] === "p" ? 3 : 2) * dpr)); app.icoURL[k] = "url(" + Art.up(c, c.width * z, c.height * z).toDataURL() + ")"; } catch (e) { app.icoURL[k] = "none"; } }
    for (const k of ["coin", "heart", "castle"]) rs.setProperty("--ic-" + k, app.icoURL[k]);
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
      for (let d = 1; d < app.cfg.layout.queueRows; d++) { const x = document.createElement("div"); x.className = "tile next d" + d; x.setAttribute("aria-hidden", "true"); x.innerHTML = inner; x.addEventListener("click", () => pickTile(j, d)); col.append(x); nx.push(x); }
      app.nexts.push(nx); tray.append(col);
    }
    app.rods = document.createElementNS("http://www.w3.org/2000/svg", "svg"); app.rods.setAttribute("class", "rods"); app.rods.setAttribute("aria-hidden", "true"); tray.append(app.rods);
  }
  function buildLine() {
    const line = $("line");
    for (let i = 0; i < app.cfg.layout.lineSlots; i++) { const s = document.createElement("div"); s.className = "slot"; s.innerHTML = '<i class="men"></i><b></b><em class="out"></em><i class="lk"></i><i class="pad"></i>'; s.addEventListener("click", () => pickSlot(i)); line.append(s); app.slots.push(s); }
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
        const m = B.cardM[f], k = S.count(f), p = S.partner(f);
        b.className = "tile card" + (app.verdict[j] === 1 ? " safe" : app.verdict[j] === 2 ? " blocked" : app.verdict[j] === 3 ? " waitpair" : "") + (p >= 0 ? " linked" + (B.cardCol[p] < j ? " ch-r" : "") : ""); b.disabled = !live; paintMat(b, m); // ch-r: the chain tag on the corner away from the rod
        b.querySelector(".n").textContent = k; b.querySelector(".q").textContent = "";
        b.setAttribute("aria-label", mat(m).crew + ", " + k + " sappers" + (p >= 0 ? ", " + LY.linkedAria.replace("{c}", B.cardCol[p] + 1) : "") + (app.verdict[j] === 2 ? ", blocked: " + (p >= 0 ? LY.linkedText : "no free space") : app.verdict[j] === 3 ? ", " + LY.linkedBuriedText : app.verdict[j] === 1 ? ", safe" : ""));
        // A mystery card that just reached the front turns over (presentation only).
        if (app.flip[j]) { app.flip[j] = false; if (!app.V.calm && b.animate) b.animate([{ transform: "perspective(240px) rotateY(90deg)" }, { transform: "none" }], { duration: SH.flipMs, easing: "ease-out" }); }
      }
      for (let d = 1; d <= app.nexts[j].length; d++) {
        const x = app.nexts[j][d - 1], ci = S && d < app.rows ? S.card(j, d) : -1;
        if (ci < 0) { x.className = "tile next d" + d + (d < app.rows ? " none" : " off"); x.querySelector(".n").textContent = ""; x.querySelector(".q").textContent = ""; continue; }
        const hid = S.hidden(ci);
        const xp = S.partner(ci); x.className = "tile next d" + d + (hid ? " mys" : "") + (xp >= 0 ? " linked" + (B.cardCol[xp] < j ? " ch-r" : "") : "");
        if (hid) paintMys(x, d); else paintMat(x, B.cardM[ci], d);
        x.querySelector(".n").textContent = S.count(ci); x.querySelector(".q").textContent = hid ? LY.mystery.q : "";
      }
    }
    drawRods(); sendable(); markPick();
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
  function rowOf(S, j, ci) { for (let d = 0; d < app.rows; d++) { const c = S.card(j, d); if (c < 0) return -1; if (c === ci) return d; } return -1; }
  function drawRods() {
    const S = app.S, B = app.B, svg = app.rods; if (!svg) return;
    let html = "";
    if (S && B && B.nlinks) {
      const R = app.cfg.layout.rod, RW = app.rows, f = (v) => v.toFixed(1);
      // A tile's layout box in the tray (offsets ignore a flip or shake in progress, which would narrow or move its rect).
      const box = (el) => { const l = el.offsetLeft, t = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight; return { x: l + w / 2, y: t + h / 2, hw: w / 2, hh: h / 2, l, r: l + w, t, b: t + h }; };
      const k = Math.max(0.7, Math.min(1.4, (box(app.cards[0]).hh * 2) / 52)), rv = R.rivet * k, sw = 'stroke-linecap="round" stroke-linejoin="round"';
      // Every shown tile's box, for the straight rod's check.
      const tiles = []; for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < RW; d++) { const el = tileOf(j, d); if (!el.classList.contains("none") && !el.classList.contains("empty") && el.offsetWidth) tiles.push(box(el)); }
      const inside = (x, y) => tiles.some((q) => x > q.l + 1 && x < q.r - 1 && y > q.t + 1 && y < q.b - 1);
      const clear = (P) => { for (let i = 0; i + 3 < P.length; i += 2) for (let u = 1; u < 16; u++) if (inside(P[i] + ((P[i + 2] - P[i]) * u) / 16, P[i + 1] + ((P[i + 3] - P[i + 1]) * u) / 16)) return false; return true; };
      // The gutter between neighbouring columns j and pj: midway between their front tiles' facing edges.
      const gutter = (j, pj) => { const a = box(app.cards[j]), b = box(app.cards[pj]); return pj > j ? (a.r + b.l) / 2 : (a.l + b.r) / 2; };
      const rod = (P, mt) => { let d = "M" + f(P[0]) + " " + f(P[1]); for (let i = 2; i < P.length; i += 2) d += "L" + f(P[i]) + " " + f(P[i + 1]);
        return '<path d="' + d + '" stroke="' + R.ink + '" stroke-width="' + f(R.w * k) + '" ' + sw + '/><path d="' + d + '" stroke="' + mt + '" stroke-width="' + f(R.core * k) + '" ' + sw + '/><path d="' + d + '" stroke="' + R.hi + '" stroke-width="' + f(Math.max(1, k)) + '" ' + sw + ' transform="translate(0 -1)" opacity=".6"/>'; };
      const rivet = (x, y, mt) => '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rv) + '" fill="' + mt + '" stroke="' + R.ink + '" stroke-width="' + f(1.6 * k) + '"/><circle cx="' + f(x - rv * 0.3) + '" cy="' + f(y - rv * 0.3) + '" r="' + f(rv * 0.35) + '" fill="' + R.hi + '" opacity=".8"/>';
      // First every rod as points (a run down a gutter is the segment P[2..5]), then the lanes, then the SVG.
      const rods = [];
      for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < RW; d++) {
        const ci = S.card(j, d); if (ci < 0) break;
        const p = S.partner(ci); if (p < 0) continue;
        const pj = B.cardCol[p], pd = rowOf(S, pj, p), a = box(tileOf(j, d)), right = pj > j, ax = right ? a.r : a.l, gx = gutter(j, pj);
        if (pd >= 0) {
          if (pd < d || (pd === d && pj < j)) continue;
          const b = box(tileOf(pj, pd)), bx = right ? b.l : b.r;
          let P = [ax, a.y, bx, b.y];
          if (Math.abs(pj - j) !== 1 || !clear(P)) P = [ax, a.y, gx, a.y, gx, b.y, bx, b.y];
          rods.push({ P, ends: [ax, a.y, bx, b.y], dots: null, j, pj });
          continue;
        }
        // Stub: along the gutter toward the partner's column, past its last visible row, then two dots.
        const y2 = Math.max(a.y + a.hh, box(tileOf(pj, RW - 1)).b - R.stub * k * 0.4);
        rods.push({ P: [ax, a.y, gx, a.y, gx, y2], ends: [ax, a.y], dots: y2, j, pj });
      }
      // Critics 2 fix (m9, Critics 1 N6): two rods running down the same gutter over the same rows take a lane each, R.lane
      // px either side of its middle (never past the tiles' edges), and the second wears the second metal (R.metal2), so
      // they read as two links, not one rod touching three tiles.
      const run = (q) => (q.P.length >= 6 ? [q.P[2], Math.min(q.P[3], q.P[5]), Math.max(q.P[3], q.P[5])] : null);
      for (let u = 0; u < rods.length; u++) for (let v = u + 1; v < rods.length; v++) {
        const A = run(rods[u]), Bq = run(rods[v]); if (!A || !Bq || Math.abs(A[0] - Bq[0]) > 0.5 || Math.min(A[2], Bq[2]) - Math.max(A[1], Bq[1]) <= 0 || rods[u].lane || rods[v].lane) continue;
        const lo = Math.min(rods[u].j, rods[u].pj), half = (box(app.cards[lo + 1]).l - box(app.cards[lo]).r) / 2, off = Math.max(0, Math.min(R.lane * k, half - 0.5));
        rods[u].lane = -1; rods[v].lane = 1; rods[v].metal = R.metal2;
        for (const [q, s] of [[rods[u], -off], [rods[v], off]]) { q.P[2] += s; q.P[4] += s; }
      }
      for (const q of rods) {
        const mt = q.metal || R.metal; html += rod(q.P, mt);
        for (let i = 0; i < q.ends.length; i += 2) html += rivet(q.ends[i], q.ends[i + 1], mt);
        if (q.dots != null) for (let t = 1; t <= 2; t++) html += '<circle class="dot" cx="' + f(q.P[4]) + '" cy="' + f(q.dots + R.cap * k * 2.3 * t) + '" r="' + f(R.cap * k * 0.8) + '" fill="' + mt + '" stroke="' + R.ink + '" stroke-width="1"/>';
      }
    }
    if (svg.innerHTML !== html) svg.innerHTML = html;
  }
  // Every open space taken: each front card is marked blocked (a tap now is refused until a space frees) or safe (it
  // can merge, only with the comparison flag on). v4 M2: with one space left, a linked front card is blocked too (it needs
  // 2). v4.3: a linked front card whose partner is still buried waits for it (verdict 3, the waiting look), whatever the
  // line. Run when the line changes, never per frame.
  function judge() {
    const S = app.S, live = S && S.status === E.PLAYING && !app.panel, full = live && S.lineLen >= S.open;
    for (let j = 0; j < E.NCOL; j++) app.verdict[j] = 0;
    if (!live) return false;
    let any = false;
    for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f < 0) continue; if (S.refused(j)) { app.verdict[j] = S.why(j) === 3 ? 3 : 2; any = true; } else if (full) app.verdict[j] = 1; }
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
    $("line-cnt").firstElementChild.textContent = cnt; retCount();
    let free = -1; for (let i = 0; i < S.cap; i++) if (!S.spQ[i] && !S.shutAt(i)) { free = free < 0 ? i : free; } // v6: a shut space may sit among open ones
    // v6, two locks: each shut socket shows its own lock (S.shutAt: the lock + 1); a lock that has opened since the last
    // render pops the padlock of the socket it held then (app.lockSock) for show.unlockMs. (A Ladder moves shut sockets
    // up one; no lock opened, so nothing pops.)
    for (let k = 0; k < app.B.nlocks; k++) { const sh = S.lockShut(k); if (app.lockWas[k] && !sh && app.lockSock[k] >= 0) app.slotUnT[app.lockSock[k]] = app.clock; app.lockWas[k] = sh; }
    app.lockSock.fill(-1);
    app.slots.forEach((s, i) => {
      s.hidden = i >= S.cap;
      const sk = i < S.cap ? S.shutAt(i) : 0, shut = sk > 0; if (shut) app.lockSock[sk - 1] = i;
      const opening = !shut && i < S.cap && app.clock - app.slotUnT[i] < app.cfg.show.unlockMs;
      s.classList.toggle("locked", shut); s.classList.toggle("unlocking", opening);
      const lm = shut ? app.B.lockM[sk - 1] : 0, cl = lm > 0; s.classList.toggle("clock", cl); if (cl) s.style.setProperty("--lc", mat(lm).c); // v5 R1: a colour lock shows its colour
      if (i < S.cap && S.spQ[i]) { const m = S.spM[i], w = S.spW[i], o = S.spO[i], st = S.stuck(i), lk = S.spL[i] !== 0, held = S.held(i); s.classList.add("full"); s.classList.toggle("work", o > 0); s.classList.toggle("stuck", st); s.classList.toggle("linked", lk); s.classList.toggle("held", held); paintMat(s, m); s.querySelector("b").textContent = w || "";
        s.querySelector(".out").textContent = o > 0 ? o : "";
        const men = s.querySelector(".men"); men.style.backgroundImage = app.manURL[m]; men.style.width = "calc(var(--man) * " + Math.min(w, L.sapperIcons) + ")";
        s.setAttribute("aria-label", mat(m).crew + ", " + w + " waiting" + (o ? ", " + o + " out" : "") + (st ? ", stuck: nothing in reach" : "") + (lk ? ", " + L.linkedWord : "") + (held ? ", " + L.heldText : "") + (S.pinned(i) ? ", " + S.pinned(i) + " " + L.pinnedWord : "")); }
      else { s.classList.remove("full", "work", "stuck", "linked", "held"); s.style.removeProperty("--mc"); s.querySelector("b").textContent = ""; s.querySelector(".out").textContent = ""; s.querySelector(".men").style.width = "0"; s.setAttribute("aria-label", shut ? (lm > 0 ? fill(L.colourLockText, { crew: mat(lm).crew }) : L.lockedText) : "Empty space"); }
      s.classList.toggle("last", i === free && li.near); // one space left and the rest stuck: the last free space pulses
    });
    sendable(); markPick();
  }
  // v4.3 fix (m1): the sappers carrying blocks home after their space freed (everyone away, less those still walking out or
  // back for a space), shown after the head's counts as a return arrow and a number. step() asks every frame; the DOM is
  // written only when the number changes.
  function carrying() { const S = app.S; if (!S) return 0; let o = 0; for (let i = 0; i < S.cap; i++) if (S.spQ[i]) o += S.spO[i]; return Math.max(0, S.out - o); }
  function retCount() {
    const n = app.screen === "play" && app.S && !app.panel ? carrying() : 0; if (n === app.carry) return; app.carry = n;
    const r = $("line-cnt").lastElementChild; r.hidden = !n; r.querySelector("b").textContent = n ? n : ""; if (n) r.setAttribute("aria-label", fill(app.cfg.layout.carryAria, { n })); else r.removeAttribute("aria-label");
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
  // ---- the power-up bar (v4 M5; the rules are engine.js power(), the coins and inventory meta.js) ------------------------
  // Four round badges: the icon, then the count owned, or a "+" with the price (a tap buys one in place; short of coins
  // the tap says so). A tap on an owned one uses it: the Ladder and the Scout at once; the Quartermaster and Recall first
  // ask for a target (the tiles or spaces they can take glow; a tap on one applies it; the badge again cancels). A refused
  // power-up costs nothing and says why. One spent per use the engine takes.
  const PWT = () => app.meta.power, pwName = (k) => Meta.powerOf(app.meta, k).name || E.POWERS[k];
  const fill = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? o[k] : m));
  function buildPowers() {
    const host = $("powers");
    for (let k = 0; k < E.POWERS.length; k++) {
      const b = document.createElement("button"); b.className = "pw"; b.dataset.k = k;
      b.innerHTML = '<i class="pw-ic" aria-hidden="true"></i><b class="pw-n" aria-hidden="true"></b><span class="pw-tag" aria-hidden="true"><i class="ico ico-coin"></i><span></span></span><span class="pw-name" aria-hidden="true"></span><span class="pw-need" aria-hidden="true"></span>';
      b.querySelector(".pw-ic").style.backgroundImage = app.icoURL["p" + k] || "none"; b.querySelector(".pw-name").textContent = pwName(k);
      b.addEventListener("click", () => onPower(k)); host.append(b); app.pws.push(b);
      // v5 R1: a long press (meta.tipHoldMs on the page clock, step()) or a hover shows the badge's tip; a press that showed
      // it doesn't also use the badge.
      b.addEventListener("pointerdown", () => { app.tipHold = { k, t0: app.clock }; });
      for (const ev of ["pointerup", "pointercancel"]) b.addEventListener(ev, () => { app.tipHold = null; if (app.tip && !app.tip.intro && app.tip.held) hideTip(); });
      b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") showTip(k, false); });
      b.addEventListener("pointerleave", (e) => { app.tipHold = null; if (e.pointerType === "mouse" && app.tip && !app.tip.intro) hideTip(); });
    }
  }
  // Each badge's state: owned (a count), buy (a "+" and the price) or spent (this level's uses gone); the coins pill.
  // Critics 2 fix (m2): a buy short of coins is .poor (a muted "+", the price in red, "need N" under it on wide screens),
  // still tappable for the toast that says so.
  function renderPowers() {
    const S = app.S, inv = app.save.data.inv, T = PWT(), pop = app.cfg.show.pwPopMs, have = app.save.data.coins | 0;
    $("pw-coins").querySelector("b").textContent = app.save.data.coins; $("pw-coins").setAttribute("aria-label", fill(app.meta.home.coins, { n: app.save.data.coins }));
    let shownN = 0;
    app.pws.forEach((b, k) => {
      b.hidden = !pwOpen(k); if (!b.hidden) shownN++; // v5 R1: hidden until the campaign unlocks it
      const P = Meta.powerOf(app.meta, k), n = inv[E.POWERS[k]] | 0, spent = !!S && S.used(k) >= S.limit(k), st = spent ? "spent" : n > 0 ? "own" : "buy", need = st === "buy" ? Math.max(0, P.price - have) : 0;
      b.className = "pw " + st + (need ? " poor" : "") + (app.pick && app.pick.k === k ? " picking" : "") + (app.clock - app.pwPop[k] < pop ? " pop" : "");
      b.querySelector(".pw-n").textContent = n > 0 ? n : "+"; b.querySelector(".pw-tag span").textContent = P.price; b.querySelector(".pw-need").textContent = need ? fill(T.need, { need }) : "";
      b.setAttribute("aria-label", fill(T.aria, { name: P.name, say: P.say, state: spent ? T.spent : n > 0 ? fill(T.owned, { n }) : fill(need ? T.poor : T.buy, { price: P.price, need }) }) + " " + P.tip);
    });
    if (shownN !== app.pwN) { app.pwN = shownN; if (app.screen === "play") sizePowers(); }
  }
  const livePlay = () => app.screen === "play" && app.S && app.S.status === E.PLAYING && !app.panel && !app.paused && !app.held; // lands foundation: held under Settings
  function pwToast(key, o, bad) { toast(fill(PWT()[key], o), bad); }
  function pwShake(k) { const b = app.pws[k]; if (b && !app.V.calm && b.animate) b.animate(app.cfg.show.blockedShake.map((x) => ({ transform: "translateX(" + x + "px)" })), { duration: app.cfg.show.blockedShakeMs }); }
  // v5 R1, the tips: one bubble over the badge, saying what the power-up does and when to use it; an unlock's intro adds
  // "New: name" and "One free use" and stays meta.tipIntroMs (page clock) unless a tap anywhere takes it away; queued
  // intros follow one by one.
  function showTip(k, intro) {
    const b = app.pws[k], t = $("pwtip"), P = Meta.powerOf(app.meta, k), M = app.meta; if (!b || b.hidden) return false;
    t.querySelector(".tt-h").textContent = intro ? fill(M.newTitle, { name: P.name }) : P.name; t.querySelector(".tt-f").hidden = !intro; t.querySelector(".tt-f").textContent = M.free;
    t.querySelector(".tt-b").textContent = P.tip; t.hidden = false; t.classList.toggle("intro", !!intro);
    const r = b.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight, x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = r.top - h - 10 >= 8 ? r.top - h - 10 : Math.min(innerHeight - h - 8, r.bottom + 10);
    t.style.left = Math.round(x) + "px"; t.style.top = Math.round(y) + "px"; t.style.setProperty("--ax", Math.round(r.left + r.width / 2 - x) + "px"); t.classList.toggle("below", y > r.top);
    app.tip = { k, intro: !!intro, held: false, until: intro ? app.clock + M.tipIntroMs : Infinity }; return true;
  }
  function hideTip() { $("pwtip").hidden = true; const was = app.tip; app.tip = null; if (was && was.intro && app.tipQ.length) showTip(app.tipQ.shift(), true); }
  // Each frame (step): a held press long enough shows its tip; an intro's time runs out.
  function tipStep() {
    const H = app.tipHold; if (H && !app.tip && app.clock - H.t0 >= app.meta.tipHoldMs) { if (showTip(H.k, false)) { app.tip.held = true; app.tipEat = H.k; } }
    if (app.tip && app.clock >= app.tip.until) hideTip();
  }
  function onPower(k) {
    if (app.tipEat === k) { app.tipEat = -1; return false; } // the press showed the tip
    if (!livePlay()) return false;
    const S = app.S, P = Meta.powerOf(app.meta, k), D = app.save.data, PW = E.PW;
    if (app.pick) { const was = app.pick.k; cancelPick(); if (was === k) return false; }
    if (S.used(k) >= S.limit(k)) { pwShake(k); cue("blocked"); pwToast("limit", { name: P.name, n: S.limit(k) }, true); return false; }
    if (!(D.inv[E.POWERS[k]] > 0)) { // buy one in place
      const r = Meta.buy(D, app.meta, k);
      if (!r.ok) { pwShake(k); cue("blocked"); pwToast(r.full ? "full" : "short", { name: P.name, price: r.price, have: D.coins }, true); renderPowers(); return false; }
      writeSave(); app.pwPop[k] = app.clock; cue("coin"); pwToast("bought", { name: P.name, price: r.price }); renderPowers(); return true;
    }
    if (k === PW.PULL || k === PW.RECALL || k === PW.VOLLEY) { // ask for a target (v5 R1: the Volley asks for a colour)
      if (!pickTargets(k).length) { pwShake(k); cue("blocked"); pwToast(k === PW.RECALL ? "noRecall" : k === PW.VOLLEY ? "noVolley" : pullWhy(), null, true); return false; }
      app.pick = { k }; pwToast(k === PW.PULL ? "pickPull" : k === PW.VOLLEY ? "pickVolley" : "pickRecall"); renderPowers(); markPick(); return true;
    }
    return applyPower(k, 0);
  }
  // Why no tile can go out (v5 R1): no free space at all, or only linked squads in view whose partners aren't (or 2 spaces).
  function pullWhy() { const S = app.S; return S.open - S.lineLen > 0 ? "noPullLinked" : "noPull"; }
  // The Quartermaster's tiles (j, d, card) in the visible rows, or Recall's spaces ([i]), that the engine would take now.
  // v5 R1, the Volley: a colour, picked by one of its face-up tiles in the visible rows ([j, d, card]) or its squads in
  // the line ([-1, i]); a hidden tile never offers its colour.
  function pickTargets(k) {
    const S = app.S, out = [];
    if (k === E.PW.VOLLEY) { for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < app.rows; d++) { const ci = S.card(j, d); if (ci >= 0 && !S.hidden(ci) && S.canPower(k, app.B.cardM[ci])) out.push([j, d, ci]); }
      for (let i = 0; i < S.cap; i++) if (S.spQ[i] && S.canPower(k, S.spM[i])) out.push([-1, i]); return out; }
    // v5 R1: the rows behind the front, and a linked front card (it can't be tapped alone while its partner is buried)
    if (k === E.PW.PULL) { for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < app.rows && d <= S.pullDepth; d++) { const ci = S.card(j, d); if (ci >= 0 && (d > 0 || S.partner(ci) >= 0) && S.canPower(k, ci)) out.push([j, d, ci]); } }
    else for (let i = 0; i < S.cap; i++) if (S.canPower(k, i)) out.push([i]);
    return out;
  }
  // Use power k on a (the engine refuses: nothing spent, the reason); taken: one spent, the show and the bar update.
  function applyPower(k, a) {
    const S = app.S, P = Meta.powerOf(app.meta, k), r = S.power(k, a);
    if (r !== E.PLAYING && r !== E.WON && r !== E.FAILED) { pwShake(k); cue("blocked"); pwToast(k === E.PW.LADDER ? "noLadder" : k === E.PW.SCOUT ? "noScout" : k === E.PW.RECALL ? "noRecall" : k === E.PW.VOLLEY ? "noVolley" : pullWhy(), null, true); return false; }
    Meta.take(app.save.data, k); writeSave(); app.pwPop[k] = app.clock; app.pick = null;
    app.V.sync(S, true); cue("power"); pwToast("used", { name: P.name, say: P.say });
    app.march = false; marchCheck(); ended();
    judge(); renderTray(); renderLine(); renderPowers(); placeSlots(); coachStep();
    return true;
  }
  function cancelPick() { if (!app.pick) return; app.pick = null; hideToast(); markPick(); renderPowers(); }
  // While a target is asked for, the tiles or spaces it can take wear .pickable (recomputed with the tray and the line,
  // since squads come home meanwhile); with none left, the ask ends.
  function markPick() {
    const k = app.pick ? app.pick.k : -1, T = k >= 0 && app.S && livePlay() ? pickTargets(k) : [];
    if (k >= 0 && !T.length) { app.pick = null; renderPowers(); }
    const tiles = k === E.PW.PULL || k === E.PW.VOLLEY;
    for (let j = 0; j < E.NCOL; j++) for (let d = 1; d <= app.nexts[j].length; d++) { const x = app.nexts[j][d - 1], on = tiles && T.some((t) => t[0] === j && t[1] === d); x.classList.toggle("pickable", on); if (on) { x.setAttribute("role", "button"); x.removeAttribute("aria-hidden"); x.setAttribute("aria-label", fill(PWT()[k === E.PW.VOLLEY ? "pickVolley" : "pickPull"], {})); } else { x.removeAttribute("role"); x.setAttribute("aria-hidden", "true"); x.removeAttribute("aria-label"); } }
    for (let j = 0; j < E.NCOL; j++) app.cards[j].classList.toggle("pickable", tiles && T.some((t) => t[0] === j && t[1] === 0)); // v5 R1: a linked front (Quartermaster), any face-up front (Volley)
    app.slots.forEach((q, i) => q.classList.toggle("pickable", (k === E.PW.RECALL && T.some((t) => t[0] === i)) || (k === E.PW.VOLLEY && T.some((t) => t[0] === -1 && t[1] === i))));
    document.body.classList.toggle("picking", k >= 0 && T.length > 0);
  }
  function pickTile(j, d) {
    if (!app.pick || !livePlay()) return false; const ci = app.S.card(j, d); if (ci < 0) return false;
    if (app.pick.k === E.PW.VOLLEY) { const m = app.B.cardM[ci]; return !app.S.hidden(ci) && app.S.canPower(E.PW.VOLLEY, m) ? applyPower(E.PW.VOLLEY, m) : false; } // v5 R1
    return app.pick.k === E.PW.PULL && app.S.canPower(E.PW.PULL, ci) ? applyPower(E.PW.PULL, ci) : false;
  }
  function pickSlot(i) {
    if (!app.pick || !livePlay()) return false;
    if (app.pick.k === E.PW.VOLLEY) return app.S.spQ[i] && app.S.canPower(E.PW.VOLLEY, app.S.spM[i]) ? applyPower(E.PW.VOLLEY, app.S.spM[i]) : false; // v5 R1
    return app.pick.k === E.PW.RECALL && app.S.canPower(E.PW.RECALL, i) ? applyPower(E.PW.RECALL, i) : false;
  }

  function renderTop() {
    const e = app.entry; if (!e) return;
    $("lvl-num").textContent = e.debug ? app.cfg.layout.debugNum : e.n; $("lvl-name").textContent = e.gallery ? e.L.short || e.L.title : e.boss ? e.boss.name : e.L.name || e.L.title || (app.eras[e.era - 1] ? app.eras[e.era - 1].name : realmEye(e.era, "top")); // lands foundation: a land level shows its picture's title; Land 1 fix: a side quest its short title (the win sheet keeps the full one)
    $("btn-map").setAttribute("aria-label", app.cfg.layout.mapName); // v5 R3: side quests live on the map too
    tagChip($("tag-chip"), app.diff); // v4.3: the level's tag (Normal unmarked)
    app.labFit.delete("name"); fitText($("lvl-name"), "name", app.cfg.layout.nameMinPx); // the room beside the number changes with its digits
  }
  // v4.3: a tag mark (layout.tags[tag]: its words, empty for Normal; class tag-<tag> colours it): hidden when empty.
  function tagChip(el, tag) { if (!el) return; const t = (tag && (app.cfg.layout.tags || {})[tag]) || ""; el.textContent = t; el.className = "tag" + (tag ? " tag-" + tag : ""); el.hidden = !t; }
  // v4.3 fix (T1): a Play button for level e (null: none) wears its tag pill, and a Hard level's the red-gold face.
  function playTag(btn, e) { const tg = e ? tagOf(e) : null; tagChip(btn.querySelector(".tag"), tg); btn.classList.toggle("hard", tg === "hard" || tg === "extreme"); btn.classList.toggle("extreme", tg === "extreme"); } // v5 R1: Extreme wears Hard's warning face, darker
  function renderAll() { judge(); renderTop(); renderTray(); renderLine(); }

  // v4 M5: a report card for a set of levels (a realm): cleared and coins earned (v4.3: no medals).
  function reportCard(el, list) {
    if (!el) return;
    const C = app.meta.eraCard, gal = list.length && list[0].gallery, map = gal ? app.save.data.gal : app.save.data.done; let won = 0, coins = 0;
    for (const e of list) { if (map[e.id]) won++; coins += Meta.bestOf(app.save.data, e.id)[2]; }
    el.innerHTML = '<span class="rc-n"></span><span class="rc-c"><i class="ico ico-coin" aria-hidden="true"></i><b></b></span>';
    el.querySelector(".rc-n").textContent = fill(C.cleared, { n: won, t: list.length }); el.querySelector(".rc-c b").textContent = coins;
    el.setAttribute("role", "img"); el.setAttribute("aria-label", fill(C.aria, { n: won, t: list.length, c: coins }));
  }

  // ---- the journey map (v5 R3; config map, map/layout.json, src/journey.js) -------------------------------------------
  // One scroller (#jr) holds the 13 painted sheets, bottom to top, scaled to the column (k CSS px a sheet px). Each sheet
  // is a box with its image (loaded once it nears the view: an IntersectionObserver on the scroller), one SVG in sheet
  // pixels (the route, detours, bridges, and on the top sheet the fog and the Goblin King) and a layer of buttons placed in
  // percent of the sheet (levels, side quests, eggs, the realm's banner). All of it is built once; renderMap only switches
  // classes, labels and the route's two path strings per sheet, and nothing runs on scroll. The current node's label moves
  // into its sheet. Phone: Play in a foot bar; wide (config map.cardsMinW): a realm card and a next-up card beside the column.
  // v5 R4c: layout.json holds sheets for levels 1-200 before they all exist. The map is built up to the frontier (journey.js
  // frontier: the spot of the first level not built, or the top sheet's long-tail spot once every spot's level is): sheets
  // past it are not built, a node only for a level that exists, a side quest only once its main level does (later ones are
  // the long tail), an egg or bridge only below the frontier's fog, a banner only for a realm with a level. The fog, its
  // label, the long tail's node (at the frontier) and the cleared pictures sit there; the Goblin King stands at the summit
  // beside level 200 once it is built, else in the fog as a teaser.
  const JN = NS.journey, svgNS = "http://www.w3.org/2000/svg", pct = (v, t) => (100 * v) / t + "%";
  // Lands foundation (config lands): the castle realms, then one era per built land ({era, name, note: its lore, land: k}).
  const landsCfg = () => app.cfg.lands || { castleEnd: 200, castleRealms: 8, list: [], text: {} }, lastN = () => (app.levels.length ? app.levels[app.levels.length - 1].n : 0);
  function erasOf() { const LC = landsCfg(), base = (app.cfg.eras || []).slice(0, LC.castleRealms); return base.concat((LC.list || []).map((d) => ({ era: LC.castleRealms + d.k, name: d.name, note: d.lore, land: d.k }))); }
  // A realm's words (kind: eye, the banner's; of, the realm card's; home, the home's line; aria, the banner's label; top,
  // the top bar's fallback): a castle realm fills its own text ({e}, {t} the castle realms, {name}); a land, lands.text
  // ({k} its number, {t} the lands built, {name}), so a land says Land where a realm says Realm.
  function realmEye(era, kind, name) {
    const LC = landsCfg(), k = era - LC.castleRealms, T = app.cfg.map.text;
    if (k < 1) return fill({ eye: T.realm, of: T.realmOf, home: app.meta.home.era, aria: T.bannerAria, top: app.cfg.layout.realmEye }[kind], { e: era, t: LC.castleRealms, name });
    const LT = LC.text || {}; return fill({ eye: LT.eye, of: LT.of, home: LT.home, aria: LT.bannerAria, top: LT.eye }[kind] || LT.eye, { k, t: (LC.list || []).length, name });
  }
  // A picture's side-quest level as the map reads it: a land's own as stored; the castle Gallery's long tail (past
  // castleEnd) moved past the last built land (journey.js tailAfter); 0: no quest.
  const questAt = (e) => (e.L.quest ? (e.L.land ? e.L.quest.after : JN.tailAfter(e.L.quest.after, landsCfg().castleEnd, lastN())) : 0);
  // v5 R2: the pictures are side quests (config gallery.quests, tools/quests.js): each opens once its quest's main level
  // is cleared (save.js questOpen; past the last level, one at a time once all are cleared), shows its prize (a power-up
  // icon) until its first clear, which adds the prize to the inventory with a toast.
  const galIds = () => app.gal.map((e) => e.id), galAfter = () => app.gal.map(questAt), picOpen = (e) => Save.questOpen(app.save.data, app.order, galIds(), galAfter(), e.id); // lands foundation: galAfter keeps the long tail past the last land (journey.js tailAfter)
  const openQs = () => { const ids = galIds(), af = galAfter(); return app.gal.filter((e) => Save.questOpen(app.save.data, app.order, ids, af, e.id)); }; // v5.1: the side quests open now
  // Land 1 fix (the functional critic's m5): a save from before the lands (no lands flag) keeps the long-tail pictures it
  // had open. tailKept(d): the castle Gallery's rule over the castle alone (its levels, the pictures' own quest levels),
  // the tail pictures it opens and d has not won; keepTail() stores them once in the save's tail (save.js questOpen keeps
  // them open wherever the long tail now sits) and sets the flag, so a player who reaches 200 later waits past the lands.
  // Before a save's first write its progress is empty, so the flag can wait for that write.
  function tailKept(d) { const cast = app.levels.filter((e) => !e.L.land).map((e) => e.id), cg = app.gal.filter((e) => !e.L.land), ids = cg.map((e) => e.id), af = cg.map((e) => (e.L.quest ? e.L.quest.after | 0 : 0)), keep = {};
    cg.forEach((e, i) => { if (af[i] > cast.length && !(d.gal || {})[e.id] && Save.questOpen(d, cast, ids, af, e.id)) keep[e.id] = 1; }); return keep; }
  function keepTail() { const d = app.save.data; if (d.lands === 1) return; const k = tailKept(d); d.lands = 1; if (Object.keys(k).length) { d.tail = Object.assign({}, d.tail, k); app.save.write(); } } // a new save keeps the flag from its first write
  function questPrize(e) { const q = e.L.quest, k = q ? E.POWERS.indexOf(q.prize) : -1; if (k < 0 || !Meta.gift(app.save.data, q.prize)) return; toast(fill(app.cfg.gallery.quests.prizeText, { name: pwName(k) })); }
  // A locked node (or button) shakes and says "blocked" (reduced motion: no shake).
  function lockedTap(b) { if (!app.V.calm && b.animate) b.animate(app.cfg.show.blockedShake.map((x) => ({ transform: "translateX(" + x + "px)" })), { duration: app.cfg.show.blockedShakeMs }); cue("blocked"); }
  function buildMap() {
    const M = app.cfg.map, T = M.text, LAY = app.lay; app.eras = erasOf();
    $("map-title").textContent = M.title; $("map-story").textContent = app.meta.home.story; $("map-credits").textContent = app.cfg.gallery.credits;
    $("jr-n-eye").textContent = T.nextUp; $("jr-q-k").textContent = T.quests; $("jr-e-k").textContent = T.secrets;
    if (app.debug.length) { // ?debug=1: the v4 twists' debug levels, one button each (never in the play order)
      const row = $("jr-dbg"); row.hidden = false; row.innerHTML = '<span class="dbg-l"></span>'; row.firstChild.textContent = app.cfg.layout.debugRow;
      for (const e of app.debug) { const b = document.createElement("button"); b.className = "dbg-node"; b.dataset.id = e.id; b.textContent = e.id.replace(/^v4-/, ""); b.setAttribute("aria-label", e.L.name || e.id); b.addEventListener("click", () => startLevel(e.id)); e.node = b; row.append(b); }
    }
    if (!LAY || !Array.isArray(LAY.sheets)) return; // no layout: the map is the foot's Play alone
    const R = M.route, W = LAY.w, H = LAY.h, byN = new Map(app.levels.map((e) => [e.n, e])), world = $("jr-world"), F_ = M.tail;
    const last = app.levels.length ? app.levels[app.levels.length - 1].n : 0, fr = JN.frontier(LAY, last, F_.room), nS = fr.n;
    const fogAt = fr.fog || Math.max(0, fr.y - F_.ramp), fogTo = fr.fog ? fr.fog + F_.tailClear : fr.y + F_.below, fogged = (si, y) => si > fr.si || (si === fr.si && y < fogTo); // in the fog: past the frontier
    const kingAt = (() => { const g = LAY.sheets.findIndex((S) => S.goblinKing && S.levels.length && byN.has(S.levels[S.levels.length - 1].n)); return g >= 0 && g < nS ? { si: g, x: LAY.sheets[g].goblinKing.x, y: LAY.sheets[g].goblinKing.y } : { si: fr.top, x: F_.kingAt[0], y: F_.kingAt[1], teaser: true }; })();
    const J = (app.jr = { sheets: [], quests: [], eggs: [], tail: null, k: 0, colW: 0, cut: "", io: null, label: null, fr, king: kingAt });
    const bannerAt = (re) => M.bannerY + ((M.bannerDy || [])[re - 1] | 0); // v5 R3 fix: a realm's banner can sit a little lower or higher (sheet px)
    const qOf = (q) => app.gal[q - 1] || null, tailE = () => app.gal.filter((e) => e.L.quest && questAt(e) > app.order.length);
    LAY.sheets.slice(0, nS).forEach((S0, si) => {
      const top = si === fr.top, front = si === fr.si, el = document.createElement("div");
      // v5 R4c: the frontier sheet's road stops a little way into the fog.
      const S = front ? Object.assign({}, S0, { road: S0.road.slice(0, Math.min(S0.road.length, JN.nearest(S0.road, fr.x, fr.y) + F_.roadOn + 1)) }) : S0; el.className = "jr-sheet" + (S0.mirror ? " mir" : "") + (S0.fade ? " fade" : ""); el.style.zIndex = si + 1; el.dataset.sheet = S.sheet; // lands foundation: a mirrored sheet flips its image; fade: the seam crossfades on the page
      const img = document.createElement("img"); img.className = "jr-img"; img.alt = ""; img.decoding = "async"; img.draggable = false; if (S0.fade) img.style.setProperty("--jr-fade", pct(LAY.overlap, H));
      let s = "";
      // v5 R4c: the fog over the road past the frontier (pale mist, full from fogAt up, clear by fogTo) and, on the top
      // sheet, the dark wash behind the long tail's pictures and the king's teaser.
      if (front || top) { s += '<defs>' + (front ? '<linearGradient id="jr-fade" gradientUnits="userSpaceOnUse" x1="0" y1="' + (fr.y + F_.fadeBelow) + '" x2="0" y2="' + (fr.y - F_.fadeAbove) + '"><stop offset="0" stop-color="#2a1c12" stop-opacity=".55"/><stop offset="1" stop-color="#2a1c12" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="jr-mist" gradientUnits="userSpaceOnUse" x1="0" y1="' + fogTo + '" x2="0" y2="' + Math.min(fogAt, fogTo - 1) + '"><stop offset="0" stop-color="#e6e8de" stop-opacity="0"/><stop offset="1" stop-color="#e6e8de" stop-opacity="' + F_.mist + '"/></linearGradient>' : "") +
        '<linearGradient id="jr-wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1620" stop-opacity=".92"/><stop offset=".55" stop-color="#1e1620" stop-opacity=".6"/><stop offset="1" stop-color="#1e1620" stop-opacity="0"/></linearGradient>' +
        '<radialGradient id="jr-fog"><stop offset="0" stop-color="#e6e8de" stop-opacity=".8"/><stop offset="1" stop-color="#e6e8de" stop-opacity="0"/></radialGradient></defs>'; }
      s += '<path class="rw-u" fill="none" stroke="#fbf5e6" stroke-opacity=".5" stroke-width="' + R.underW + '" stroke-linecap="round" stroke-linejoin="round"/>';
      s += '<path class="rw-a" fill="none" stroke="' + (front ? "url(#jr-fade)" : "#2a1c12") + '" stroke-opacity="' + (front ? 1 : 0.55) + '" stroke-width="' + R.aheadW + '" stroke-dasharray="' + R.aheadDash + '" stroke-linecap="round"/>';
      s += '<path class="rw-w" fill="none" stroke="#8a2b16" stroke-width="' + R.walkedW + '" stroke-dasharray="' + R.walkedDash + '" stroke-linecap="round"/>';
      for (const [bs, i, bk] of M.bridges.concat((S.bridges || []).map((b) => [S.sheet, b[0], b[1]]))) if (bs === S.sheet && S.road[i] && !fogged(si, S.road[i][1])) s += JN.bridge(S.road[i][0], S.road[i][1], JN.heading(S.road, i, 3), M.bridgeLen, M.bridgeW, bk); // lands foundation: a land entry carries its bridges (road samples)
      for (const Q of S.quests) { if (!qOf(Q.q) || Q.after > app.order.length) continue; const dt = JN.detour(Q.branch, [Q.x, Q.y], M.stoneGap, M.stoneSkip[0], M.stoneSkip[1]);
        s += '<g class="dt" data-q="' + Q.q + '"><path d="' + dt.d + '" fill="none" stroke="#2a1c12" stroke-opacity=".7" stroke-width="4" stroke-dasharray="3 9" stroke-linecap="round"/>' + dt.stones.map(JN.stone).join("") + "</g>"; }
      if (front) { s += '<rect width="' + W + '" height="' + fogTo + '" fill="url(#jr-mist)"/>'; // the mist, with puffs along its edge
        for (const [x, dy, rx, ry] of F_.puffs) s += '<ellipse cx="' + x + '" cy="' + (fogAt + (fogTo - fogAt) * 0.35 + dy) + '" rx="' + rx + '" ry="' + ry + '" fill="url(#jr-fog)"/>'; }
      else if (si > fr.si) s += '<rect width="' + W + '" height="' + H + '" fill="#e6e8de" fill-opacity="' + F_.mist + '"/>'; // a headroom sheet: all fog
      if (top) s += '<rect width="' + W + '" height="' + Math.min(F_.washTo, Math.max(F_.washMin, fogAt)) + '" fill="url(#jr-wash)"/>';
      if (kingAt.si === si) s += '<g class="kg" transform="translate(' + kingAt.x + " " + kingAt.y + ')">' + JN.king(F_.kingScale) + '</g><g transform="translate(' + (kingAt.x + F_.flagAt[0]) + " " + (kingAt.y + F_.flagAt[1]) + ')">' + JN.flag() + "</g>";
      const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("class", "jr-ov"); svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true"); svg.innerHTML = s;
      const lay = document.createElement("div"); lay.className = "jr-lay";
      const at = (b, x, y) => { b.style.left = pct(x, W); b.style.top = pct(y, H); if (x > M.rightEdge) b.classList.add("east"); else if (x < W - M.rightEdge) b.classList.add("west"); lay.append(b); return b; };
      // Levels: a badge with its number, a check when cleared, its tag; the road sample it sits on cuts the route.
      for (const P of S.levels) { const e = byN.get(P.n); if (!e) continue;
        const b = document.createElement("button"); b.className = "mn"; b.dataset.n = e.n; b.innerHTML = '<span class="bd"><b></b></span><i class="ck" aria-hidden="true"></i><i class="tag"></i>'; b.querySelector("b").textContent = e.n; tagChip(b.querySelector(".tag"), tagOf(e));
        b.addEventListener("click", () => { if (Save.isOpen(app.save.data, app.order, e.id)) startLevel(e.id); else lockedTap(b); });
        e.node = at(b, P.x, P.y); e.sheet = si; e.ri = JN.nearest(S.road, P.x, P.y); e.px = [P.x, P.y]; }
      // Side quests: a picture node off the road (the detour drawn above), its prize until the first clear.
      for (const Q of S.quests) { const e = qOf(Q.q); if (!e || Q.after > app.order.length) continue; const g = svg.querySelector('.dt[data-q="' + Q.q + '"]'); // v5 R4c: past the last level it is the long tail's
        const b = document.createElement("button"); b.className = "qn"; b.dataset.id = e.id; b.innerHTML = '<span class="qf"><canvas class="pix" aria-hidden="true"></canvas><i class="qi" aria-hidden="true"></i></span><i class="qp" aria-hidden="true"></i><span class="prz" aria-hidden="true"><span class="pz-t"></span><span class="pz-r"><i class="pi"></i>+1</span></span>';
        const qk = e.L.quest ? E.POWERS.indexOf(e.L.quest.prize) : -1; for (const el2 of b.querySelectorAll(".pi, .qp")) el2.style.backgroundImage = (qk >= 0 && app.icoURL["p" + qk]) || "none"; b.querySelector(".pz-t").textContent = T.prize;
        b.addEventListener("click", () => { if (picOpen(e)) startLevel(e.id); else lockedTap(b); });
        e.node = at(b, Q.x, Q.y); J.quests.push({ e, b, g, sheet: si }); }
      // Easter eggs: an ink sprite that turns into its found look (and pays) on the first tap.
      S.eggs.forEach((G, i) => { if (fogged(si, G.y)) return; const id = JN.eggId(S.sheet, i), b = document.createElement("button"); b.className = "egg k-" + G.kind; b.dataset.id = id;
        const g = { id, kind: G.kind, coins: JN.eggCoins(M, S.sheet, i), b, sheet: si, found: null }; b.addEventListener("click", () => eggTap(g)); at(b, G.x, G.y); J.eggs.push(g); });
      // A realm's banner on its first sheet (its lore on a tap).
      if ((si === 0 || LAY.sheets[si - 1].realm !== S.realm) && app.levels.some((e) => e.era === S.realm) && !fogged(si, bannerAt(S.realm))) { const er = app.eras[S.realm - 1] || { era: S.realm, name: S.realmName, note: "" }, b = document.createElement("button"); b.className = "bn";
        b.innerHTML = '<span class="bt"><i></i><b></b></span><span class="lore"></span>'; b.querySelector("i").textContent = realmEye(S.realm, "eye"); b.querySelector("b").textContent = er.name; b.querySelector(".lore").textContent = er.note;
        b.setAttribute("aria-label", realmEye(S.realm, "aria", er.name)); b.setAttribute("aria-expanded", "false");
        b.addEventListener("click", () => { const on = !b.classList.contains("open"); b.classList.toggle("open", on); b.setAttribute("aria-expanded", on ? "true" : "false"); });
        at(b, W / 2, bannerAt(S.realm)).classList.remove("east", "west"); }
      // The top sheet: the fog over the road past the last level, its one next-picture node and the cleared ones.
      // v5 R4c: the frontier's node sits at the frontier (the first missing level's spot, or the summit's long-tail spot);
      // its label above it; the cleared pictures at the top sheet's top left.
      if (front) { const F = M.tail, p = [fr.x, fr.y], lab = document.createElement("div"); lab.className = "fogl"; lab.textContent = T.fog; at(lab, Math.max(F.labelX[0], Math.min(F.labelX[1], fr.x)), Math.max(F.labelMinY, fr.y - F.labelDy)).classList.remove("east", "west");
        const b = document.createElement("button"); b.className = "qn tailn"; b.hidden = true; b.innerHTML = '<span class="qf"><canvas class="pix" aria-hidden="true"></canvas><i class="qi" aria-hidden="true"></i></span><span class="prz" aria-hidden="true"><span class="pz-t"></span><span class="pz-r"><i class="pi"></i>+1</span></span>';
        b.querySelector(".pz-t").textContent = T.prize; at(b, p[0], p[1]).classList.add("bz-e");
        const th = document.createElement("div"); th.className = "thumbs"; th.style.left = pct(F.thumbsAt[0], W); th.style.top = pct(F.thumbsAt[1], H); th.style.setProperty("--row", F.show); lay.append(th);
        J.tail = { b, th, p, si, ri: JN.nearest(S.road, fr.x, fr.y), e: null, key: "", list: tailE() };
        b.addEventListener("click", () => { const t = J.tail.e; if (t && picOpen(t)) startLevel(t.id); else lockedTap(b); }); }
      // v5 R3: the label and prize bubble sides, away from the sheet's other buttons (judged on the narrowest phone). v5 R3
      // fix: also away from the route and the realm banners (this sheet's and the one above's, which reaches down onto it).
      { const kf = M.fitK, r = M.nodeR / kf, pts = S.levels.filter((P) => byN.has(P.n)).map((P) => [P.x, P.y, r]).concat(S.quests.filter((Q) => Q.after <= app.order.length).map((Q) => [Q.x, Q.y, r]), S.eggs.filter((G) => !fogged(si, G.y)).map((G) => [G.x, G.y, r]));
        const bw = Math.min(0.76 * W, M.bannerPx[0] / kf) / 2, bh = M.bannerPx[1] / kf / 2, bx = [];
        for (const [k, dy] of [[si, 0], [si + 1, -LAY.step]]) { const T2 = LAY.sheets[k]; if (T2 && k < nS && (k === 0 || LAY.sheets[k - 1].realm !== T2.realm)) { const y = bannerAt(T2.realm) + dy; bx.push([W / 2 - bw, y - bh, W / 2 + bw, y + bh]); } }
        if (kingAt.si === si && !kingAt.teaser) bx.push([kingAt.x - F_.kingBox[0] / 2, kingAt.y - F_.kingBox[1], kingAt.x + F_.kingBox[0] / 2, kingAt.y]); // v5 R4c: labels keep off the king
        const lw = M.labelPx[0] / kf, lh = M.labelPx[1] / kf, pw = M.prizePx[0] / kf, ph = M.prizePx[1] / kf, rw = M.route.underW;
        // v5 R4c: the long tail's node and its bubble (always east) count too; the quests' bubbles are placed first (off
        // each other too) and the level labels then keep off them.
        if (front) { pts.push([fr.x, fr.y, r]); bx.push(JN.sideBox([fr.x, fr.y], "e", pw, ph, 28 / kf)); }
        for (const Q of S.quests) { const e = qOf(Q.q); if (e && e.node) { const sd = JN.side([Q.x, Q.y], pts, pw, ph, 28 / kf, W, Q.x > M.rightEdge ? ["w", "n", "s", "e"] : ["e", "n", "s", "w"], S.road, rw, bx); e.node.classList.add("bz-" + sd); bx.push(JN.sideBox([Q.x, Q.y], sd, pw, ph, 28 / kf)); } }
        for (const P of S.levels) { const e = byN.get(P.n); if (e) e.side = JN.side([P.x, P.y], pts, lw, lh, 30 / kf, W, P.x > M.rightEdge ? ["w", "e", "n", "s"] : ["e", "w", "n", "s"], S.road, rw, bx); } }
      const sh = { S, el, img, svg, lay, top, front, loaded: false, cut: null, u: svg.querySelector(".rw-u"), w: svg.querySelector(".rw-w"), a: svg.querySelector(".rw-a") };
      el.append(img, svg, lay); world.append(el); J.sheets.push(sh);
    });
    if (fr.top !== fr.si) J.sheets[fr.top].lay.append(J.tail.th); // v5 R4c: a headroom sheet over the frontier holds the cleared pictures
    J.label = document.createElement("div"); J.label.className = "jr-cur"; J.label.setAttribute("aria-hidden", "true"); J.label.innerHTML = "<span></span><i class=\"tag\"></i>";
    // Lazy sheets: an image loads once its sheet is within lazyMarginPx of the scroller's view (all at once without the API).
    const load = (sh) => { if (sh.loaded) return; sh.loaded = true; sh.img.src = "map/" + sh.S.file + "?v=" + V_; };
    if (window.IntersectionObserver) { J.io = new IntersectionObserver((es) => { for (const q of es) if (q.isIntersecting) { const sh = J.sheets[+q.target.dataset.sheet - 1]; load(sh); J.io.unobserve(q.target); } }, { root: $("jr"), rootMargin: M.lazyMarginPx + "px 0px" }); for (const sh of J.sheets) J.io.observe(sh.el); }
    else for (const sh of J.sheets) load(sh);
    $("jr-quest").addEventListener("click", () => { const te = mapPic(), nx = nearQ(te ? te.id : null); if (nx) startLevel(nx.id); else lockedTap($("jr-quest")); }); // v5 R3 fix: the card's quest
  }
  // The column's size: the screen's width up to map.colMaxPx, or colWidePx between the cards once the screen is
  // map.cardsMinW wide; sheets are placed in CSS px from it (k = column / sheet width). Keeps the world point at the
  // view's middle where it was. Returns true when the size changed.
  // v5 R4 fix (the visual critic's S5): the current node's label takes the side (its picked side first, then west, east,
  // above, below, the four corners, then those above and below a little farther out) whose box covers the least of the other nodes, eggs, open prize bubbles, banners and
  // the Goblin King, measured on the page as laid out (on a render or a resize only, never per frame), and never past the
  // map column's edges. With the map hidden (nothing laid out) the picked side stays.
  const LSIDES = ["", "east", "up", "dn", "ne", "nw", "se", "sw", "up far", "dn far", "ne far", "nw far", "se far", "sw far"];
  function fitLabel() {
    const J = app.jr, L = J && J.label, own = J && J.labelOf; if (!L || !own || !L.parentNode || !L.offsetWidth) return;
    const col = $("jr").getBoundingClientRect(), o = own.getBoundingClientRect(), cx = o.left + o.width / 2, cy = o.top + o.height / 2, near = [];
    for (const x of document.querySelectorAll("#jr .mn, #jr .qn:not([hidden]), #jr .egg:not([hidden]), #jr .bn, #jr .qn.open .prz, #jr .kg")) {
      if (x === own || x.contains(L) || own.contains(x)) continue; const r = x.getBoundingClientRect(); if (r.width && Math.abs(r.left + r.width / 2 - cx) < 320 && Math.abs(r.top + r.height / 2 - cy) < 160) near.push(r); }
    const first = L.dataset.side0.replace("jr-cur", "").trim(), order = [first].concat(LSIDES.filter((k) => k !== first)), T = app.cfg.map.text, full = fill(T.cur, { n: J.labelN }); let best = first, bc = false, bs = Infinity;
    for (const cmp of [false, true]) { L.firstChild.textContent = cmp ? fill(T.curShort, { n: J.labelN }) : full; // then the short label ("{n}"), only if it covers less
      for (const k of order) { L.className = "jr-cur" + (k ? " " + k : ""); const r = L.getBoundingClientRect(); let sc = (r.left < col.left || r.right > col.right ? 1e6 : 0) + (cmp ? 0.5 : 0);
        for (const q of near) { const w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (w > 0 && h > 0) sc += w * h; }
        if (sc < bs) { bs = sc; best = k; bc = cmp; } if (bs === 0) break; }
      if (bs < 1) break; }
    L.className = "jr-cur" + (best ? " " + best : ""); L.firstChild.textContent = bc ? fill(T.curShort, { n: J.labelN }) : full;
  }
  function layoutMap() {
    const J = app.jr, M = app.cfg.map, mp = $("map"), cards = window.innerWidth >= M.cardsMinW; mp.classList.toggle("cards", cards);
    if (!J) return false;
    const LAY = app.lay, colW = Math.round(cards ? M.colWidePx : Math.min(window.innerWidth, M.colMaxPx)); if (colW === J.colW) return false;
    const sc = $("jr"), mid = J.k ? (sc.scrollTop + sc.clientHeight / 2) / J.k : -1, k = colW / LAY.w, n = J.sheets.length; // v5 R4c: the sheets built
    J.colW = colW; J.k = k; const r = mp.style; r.setProperty("--jr-w", colW + "px"); r.setProperty("--card-w", M.cardPx + "px"); r.setProperty("--card-gap", M.cardGapPx + "px");
    $("jr-world").style.height = (LAY.step * (n - 1) + LAY.h) * k + "px";
    J.sheets.forEach((sh, i) => { sh.el.style.top = (n - 1 - i) * LAY.step * k + "px"; sh.el.style.height = LAY.h * k + "px"; });
    if (mid >= 0) sc.scrollTop = mid * k - sc.clientHeight / 2;
    return true;
  }
  // A world point (sheet si, sheet px y) in the scroller's CSS px.
  const worldY = (si, y) => ((app.jr.sheets.length - 1 - si) * app.lay.step + y) * app.jr.k;
  // Scroll so the current node (the next level, or the long tail's fog node) sits map.curAt of the way down.
  function scrollMap() {
    const J = app.jr; if (!J || !J.k) return; const f = JN.focus(app.save.data, app.order), e = f && f !== "tail" ? app.byId.get(f) : null, sc = $("jr");
    const y = e ? worldY(e.sheet, e.px[1]) : worldY(J.tail.si, J.tail.p[1]);
    sc.scrollTop = Math.max(0, Math.min($("jr-world").offsetHeight - sc.clientHeight, y - app.cfg.map.curAt * sc.clientHeight)); // the story and credits under the first sheet stay below the fold
  }
  function renderMap() {
    const d = app.save.data, M = app.cfg.map, T = M.text, J = app.jr, next = Save.next(d, app.order), tags = app.cfg.layout.tags || {};
    $("map-coins").querySelector("b").textContent = d.coins; $("map-coins").setAttribute("aria-label", fill(app.meta.home.coins, { n: d.coins }));
    // v5 R3 fix: with every level and every picture cleared the map's Play gives way to a line (any node plays again).
    const ne = app.byId.get(next), te = mapPic(), end = !te && allDone(), mp = $("map-play"); mp.hidden = end; $("jr-end").hidden = !end; $("jr-end").textContent = T.endHint;
    mp.querySelector(".pl").textContent = te ? fill(T.playPic, { n: te.n }) : ne && ne.boss ? ne.boss.play : ne ? "Play level " + ne.n : "Play"; playTag(mp, end ? null : te || ne);
    if (!J) return;
    // Levels: done (a check), the current one (a glow and the label), open, locked (dim; a tap shakes).
    const f = JN.focus(d, app.order), fe = f && f !== "tail" ? app.byId.get(f) : null;
    for (const e of app.levels) {
      if (!e.node) continue; const st = JN.nodeState(d, app.order, e.id, next), b = e.node, tg = tags[tagOf(e)];
      if (b.dataset.st !== st) { b.dataset.st = st; b.classList.remove("done", "cur", "open", "locked"); b.classList.add(st); b.setAttribute("aria-disabled", st === "locked" ? "true" : "false"); }
      b.setAttribute("aria-label", "Level " + e.n + (tg ? ", " + tg : "") + (st === "done" ? ", cleared" : st === "locked" ? ", locked" : st === "cur" ? ", play this one next" : ""));
    }
    const L = J.label; if (fe && fe.node) { L.firstChild.textContent = fill(T.cur, { n: fe.n }); tagChip(L.querySelector(".tag"), tagOf(fe)); L.className = "jr-cur" + (fe.side === "w" ? " east" : fe.side === "n" ? " up" : fe.side === "s" ? " dn" : ""); L.style.left = fe.node.style.left; L.style.top = fe.node.style.top; if (L.parentNode !== fe.node.parentNode) fe.node.parentNode.append(L); J.labelOf = fe.node; J.labelN = fe.n; L.dataset.side0 = L.className; } else { J.labelOf = null; L.remove(); } // v5 R3 fix: the label can sit above or below its node
    // The route: walked to the current node, the rest ahead (only the sheet the cut is on, and those whose side flipped, change).
    const cs = fe ? fe.sheet : J.tail.si, ci = fe ? fe.ri : J.tail.ri;
    J.sheets.forEach((sh, i) => { const key = i < cs ? "w" : i > cs ? "a" : "c" + ci; if (sh.cut === key) return; sh.cut = key;
      const [w, a] = JN.split(sh.S.road, i < cs ? sh.S.road.length : i > cs ? -1 : ci); sh.w.setAttribute("d", w); sh.u.setAttribute("d", w); sh.a.setAttribute("d", a); });
    // Side quests 1-25: locked (dim, its prize icon), open (bright, the prize bubble), won (its finished picture).
    const QT = app.cfg.gallery, nx = te || nearQ(); // v5 R3 fix: the gold ring marks the picture Play starts, else the next-up card's quest
    for (const q of J.quests) quest(q.e, q.b, q.g, nx, QT, false);
    // The long tail: one next-picture node once every level is cleared; the cleared ones beside it, to play again.
    const t = J.tail; if (t) { const tl = JN.tail(d, app.order, galIds(), galAfter()), te = tl.next ? app.byId.get(tl.next) : null; t.e = te; t.b.hidden = !te; if (te) { t.b.dataset.id = te.id; quest(te, t.b, null, nx, QT, true); }
      // v5 R3 fix: the latest map.tail.show of them (44 px each) and, past that, a chip that opens all of them in a sheet.
      const key = tl.won.join(); if (key !== t.key) { t.key = key; t.th.textContent = ""; t.won = tl.won;
        for (const id of tl.won.slice(-M.tail.show)) t.th.append(tailTile(id, "th"));
        if (tl.won.length > M.tail.show) { const c = document.createElement("button"); c.className = "tchip"; c.innerHTML = '<i class="qi" aria-hidden="true"></i><span></span>'; c.lastChild.textContent = fill(T.tailChip, { n: tl.won.length });
          c.setAttribute("aria-label", fill(T.tailChipAria, { n: tl.won.length })); c.addEventListener("click", () => openTail(true)); t.th.append(c); } } }
    for (const g of J.eggs) { g.b.hidden = !eggReached(g); eggLook(g); } // v5 R3 (Peter 10/5): a realm's eggs hide until the player reaches it
    fitLabel(); // v5 R4 fix (S5): once the quests' bubbles and the eggs show
    mapCards(fe || app.levels[app.levels.length - 1]);
  }
  // A side-quest node's look: the picture icon (or, won, its finished picture), the prize while not won, its label.
  function quest(e, b, g, nx, QT, tail) {
    const st = JN.questState(app.save.data, app.order, galIds(), galAfter(), e.id), q = e.L.quest, qk = q ? E.POWERS.indexOf(q.prize) : -1, tg = (app.cfg.layout.tags || {})[tagOf(e)];
    if (b.dataset.st !== st || b.dataset.id !== e.id || b.dataset.drawn !== e.id + st) { b.dataset.st = st; b.dataset.drawn = e.id + st; b.classList.remove("won", "open", "locked"); b.classList.add(st); if (g) g.setAttribute("class", "dt " + st);
      if (st === "won") thumb(b.querySelector("canvas"), e.L, true, 1); if (tail && qk >= 0) b.querySelector(".pi").style.backgroundImage = app.icoURL["p" + qk] || "none"; }
    b.classList.toggle("next", e === nx); b.setAttribute("aria-disabled", st === "locked" ? "true" : "false");
    const late = q && questAt(e) > app.order.length, base = st === "won" ? e.L.title + ", cleared" : tail ? fill(app.cfg.map.text.tailAria, { n: e.n }) : fill(e === nx ? QT.nextAria : st === "open" ? QT.tileAria : late ? QT.quests.waitAria : QT.lockedAria, { n: e.n, after: q ? q.after : "" });
    b.setAttribute("aria-label", base + (tg ? ", " + tg : "") + (qk >= 0 && st !== "won" ? ", " + fill(QT.quests.prizeAria, { name: pwName(qk) }) : ""));
  }
  // An egg's look (drawn again only when it is found or forgotten) and its label.
  function eggLook(g) {
    const found = app.save.data.eggs && app.save.data.eggs[g.id] === 1, nm = (app.cfg.map.text.eggs[g.kind] || ["?", "?"])[found ? 1 : 0]; if (g.found === found) return;
    g.found = found; g.b.classList.toggle("found", found); g.b.innerHTML = '<svg viewBox="-24 -24 48 48" aria-hidden="true">' + JN.egg(g.kind, found) + "</svg>";
    g.b.setAttribute("aria-label", fill(found ? app.cfg.map.text.eggFoundAria : app.cfg.map.text.eggAria, { name: nm }));
  }
  // v5 R3 (Peter 10/5): an egg shows (and pays) only once the player has reached its realm, i.e. its realm's first level
  // is open; v5 R4c: a realm with no levels yet counts as not reached.
  function eggReached(g) { const re = app.jr.sheets[g.sheet].S.realm, f = app.levels.find((e) => e.era === re); return !!f && Save.isOpen(app.save.data, app.order, f.id); }
  // An egg's tap: the first pays its coins once (meta.js egg) and turns it into its found look with a coin pop; later taps
  // only wiggle it.
  function eggTap(g) {
    if (!eggReached(g)) return 0;
    const paid = Meta.egg(app.save.data, g.id, g.coins); if (!app.V.calm && g.b.animate) g.b.animate([{ transform: "scale(1)" }, { transform: "scale(" + (paid ? 1.35 : 1.12) + ")" }, { transform: "scale(1)" }], { duration: paid ? 420 : 220 });
    if (!paid) return 0;
    writeSave(); cue("coin"); eggLook(g);
    const p = document.createElement("span"); p.className = "coinpop"; p.setAttribute("aria-hidden", "true"); p.textContent = fill(app.cfg.map.text.pop, { n: paid }); g.b.append(p); p.addEventListener("animationend", () => p.remove());
    $("map-coins").querySelector("b").textContent = app.save.data.coins; $("map-coins").setAttribute("aria-label", fill(app.meta.home.coins, { n: app.save.data.coins }));
    mapCards(null); return paid;
  }
  // v5 R3: with every level cleared, the picture the map's Play starts: the long tail's next, else (v5 R3 fix) the open
  // side quest nearest the end; null while a level is left, or once every picture is cleared too (allDone).
  const levelsDone = () => app.order.every((id) => app.save.data.done[id]);
  function mapPic() { const d = app.save.data; if (!levelsDone()) return null; const t = JN.tail(d, app.order, galIds(), galAfter()), id = t.next || JN.nearQuest(d, app.order, galIds(), galAfter(), app.order.length + 1); return id ? app.byId.get(id) : null; }
  const allDone = () => levelsDone() && !mapPic();
  // v5 R3 fix: the open side quest not won nearest the current level (the next-up card's and the gold ring's), or null.
  function nearQ(skip) { const d = app.save.data, f = JN.focus(d, app.order), at = f && f !== "tail" ? app.byId.get(f).n : app.order.length + 1, id = JN.nearQuest(d, app.order, galIds(), galAfter(), at, skip); return id ? app.byId.get(id) : null; }
  // v5 R3 fix: a cleared long-tail picture as a button (cls "th" on the map, "ts-tile" in the sheet); a tap plays it again.
  function tailTile(id, cls) { const e = app.byId.get(id), b = document.createElement("button"); b.className = cls; b.dataset.id = id; b.innerHTML = '<canvas class="pix" aria-hidden="true"></canvas>'; thumb(b.firstChild, e.L, true, 1);
    b.setAttribute("aria-label", fill(app.cfg.map.text.thumbAria, { name: e.L.title })); b.addEventListener("click", () => { openTail(false); startLevel(id); }); return b; }
  // The sheet of every cleared long-tail picture (the chip opens it; Done, the backdrop, Escape or a tile close it).
  function openTail(on) { const ts = $("tailsheet"); if (on) { const g = $("ts-grid"), won = (app.jr && app.jr.tail && app.jr.tail.won) || []; $("ts-title").textContent = fill(app.cfg.map.text.tailTitle, { n: won.length }); g.textContent = ""; for (const id of won) g.append(tailTile(id, "ts-tile")); }
    ts.hidden = !on; if (on) $("ts-close").focus(); }
  // The desktop cards: the current realm (its lore, cleared and coins, side quests and secrets found there) and next up
  // (the next level with its tag, Play, the next open side quest). e: the current level (null: keep the realm shown).
  function mapCards(e) {
    const J = app.jr, M = app.cfg.map, T = M.text, d = app.save.data; if (e) J.realm = e.era; const re = J.realm || 1, er = app.eras[re - 1] || { name: "", note: "" };
    $("jr-r-eye").textContent = realmEye(re, "of"); $("jr-r-name").textContent = er.name; $("jr-r-note").textContent = er.note;
    const ls = app.levels.filter((x) => x.era === re), won = ls.filter((x) => d.done[x.id]).length; reportCard($("jr-rc"), ls); $("jr-r-bar").style.width = (ls.length ? (100 * won) / ls.length : 0) + "%";
    const ss = J.sheets.map((sh, i) => (sh.S.realm === re ? i : -1)).filter((i) => i >= 0), qs = J.quests.filter((q) => ss.indexOf(q.sheet) >= 0), gs = J.eggs.filter((g) => ss.indexOf(g.sheet) >= 0);
    $("jr-q-v").textContent = qs.filter((q) => d.gal[q.e.id]).length + " / " + qs.length; $("jr-e-v").textContent = gs.filter((g) => d.eggs && d.eggs[g.id]).length + " / " + gs.length;
    // v5 R3 fix: past the last level the card names the picture Play starts; with every picture cleared too, "all cleared"
    // and no Play; the side quest under it is the open one nearest the current level (never the one Play starts).
    const ne = app.byId.get(Save.next(d, app.order)), te = mapPic(), end = !te && allDone(); $("jr-n-name").firstChild.textContent = te ? fill(T.picture, { n: te.n }) : end || !ne ? T.allClear : ne.boss ? ne.boss.card : fill(T.cur, { n: ne.n }); tagChip($("jr-n-name").querySelector(".tag"), te ? tagOf(te) : end || !ne ? null : tagOf(ne));
    const nx = nearQ(te ? te.id : null), qk = nx && nx.L.quest ? E.POWERS.indexOf(nx.L.quest.prize) : -1, qb = $("jr-quest"); qb.hidden = end;
    qb.querySelector("b").textContent = nx ? fill(T.sideQuest, { n: nx.n }) : T.questNone; qb.querySelector(".sq-t > span").textContent = nx && qk >= 0 ? fill(T.questLine, { name: pwName(qk) }) : "";
    qb.classList.toggle("none", !nx); qb.setAttribute("aria-disabled", nx ? "false" : "true"); qb.setAttribute("aria-label", nx ? fill(T.sideQuest, { n: nx.n }) + (qk >= 0 ? ": " + fill(T.questLine, { name: pwName(qk) }) : "") : T.questNone);
  }
  // ---- the home screen (v4 M5) -----------------------------------------------------------------------------------------
  // The title scene with its top row (settings, the siege's progress, coins, lives only when meta.lives is on), the
  // logo, the next level's era and one Play button labelled with the next level (one tap to play; v4.3 no difficulty), and
  // the tab bar (v5 R3: the map and Home; the Gallery is the map now).
  function renderHome() {
    const H = app.meta.home, d = app.save.data, ne = app.byId.get(Save.next(d, app.order)), won = app.levels.filter((e) => d.done[e.id]).length, er = ne && app.eras[ne.era - 1];
    $("home-prog").querySelector("b").textContent = won + "/" + app.levels.length; $("home-prog").setAttribute("aria-label", fill(H.progress, { done: won, t: app.levels.length }));
    $("home-coins").querySelector("b").textContent = d.coins; $("home-coins").setAttribute("aria-label", fill(H.coins, { n: d.coins }));
    $("home-era").textContent = er ? realmEye(er.era, "home", er.name) : "";
    app.lifeTxt = ""; livesPill();
  }
  // The lives pill and, with none left, Play's countdown (the text changes once a second; written only then).
  function livesPill() {
    const H = app.meta.home, L = Meta.lives(app.save.data, app.meta, app.now()), pill = $("home-lives"), ne = app.byId.get(Save.next(app.save.data, app.order));
    const cd = L.nextMs > 0 ? Meta.clock(L.nextMs, true) : "", txt = L.on ? L.n + (cd ? " · " + cd : "") : "", play = L.on && L.n <= 0 ? fill(H.noLives, { t: cd }) : ne && ne.boss ? ne.boss.play : fill(H.play, { n: ne ? ne.n : 1 });
    if (txt + play === app.lifeTxt) return; app.lifeTxt = txt + play;
    pill.hidden = !L.on; pill.querySelector("b").textContent = txt; pill.setAttribute("aria-label", L.on ? (L.n >= L.max ? H.livesFull : fill(H.lives, { n: L.n }) + (cd ? ", " + fill(H.noLives, { t: cd }) : "")) : "");
    $("play-lab").textContent = play; $("btn-play").classList.toggle("wait", L.on && L.n <= 0); playTag($("btn-play"), L.on && L.n <= 0 ? null : ne);
    $("btn-play").setAttribute("aria-label", play + (ne && !(L.on && L.n <= 0) && app.cfg.layout.tags[tagOf(ne)] ? ", " + app.cfg.layout.tags[tagOf(ne)] : ""));
  }
  function openSettings(on) { holdStop(); for (const k of SUBS) $(k).hidden = true; $("settings").hidden = !on; heldPlay(); if (on) $("set-close").focus(); }
  // Lands foundation (Peter, 2026-10-06): the play screen's gear opens Settings over the level; while it (or a sheet it
  // opens) shows, the level holds still (app.held: the engine and the show stop; the app clock runs on, so the reset's
  // press-and-hold still fills), and closing it plays on with no jump. The Paused sheet keeps its own quick toggles.
  function heldPlay() { app.held = app.screen === "play" && (!$("settings").hidden || subOpen()); document.body.classList.toggle("held", app.held); } // a power-up tip waits under Settings (style.css body.held)
  // ---- v5.4: reset and the save code -----------------------------------------------------------------------------------
  // Each sheet (reset, the code, a load) takes Settings' place over the home or the map; closing one goes back to Settings.
  const SUBS = ["resetsheet", "codesheet", "loadsheet"], RT = () => app.cfg.reset.text, CT = () => app.cfg.saveCode.text, codeOn = () => !!(app.cfg.saveCode && app.cfg.saveCode.on);
  const subOpen = () => SUBS.find((k) => !$(k).hidden) || null, plural = (w, n) => fill(w[n === 1 ? 0 : 1], { n });
  function openSub(id, el) { holdStop(); for (const k of SUBS) $(k).hidden = k !== id; $("settings").hidden = !!id; heldPlay(); (id ? el : $("set-close")).focus(); }
  // The words (boot): rows, sheets; the code's rows and the reset sheet's "copy it first" only when saveCode is on.
  function progressText() {
    const R = RT(), C = CT(), on = codeOn();
    $("set-reset").querySelector(".sl").textContent = R.row; $("set-copy").querySelector(".sl").textContent = C.copyRow; $("set-load").querySelector(".sl").textContent = C.loadRow; $("set-copy").hidden = $("set-load").hidden = !on;
    $("rs-title").textContent = R.title; $("rs-lose").textContent = R.lose; $("rs-keep").textContent = R.keep; $("rs-first").textContent = R.copyFirst; $("rs-first").hidden = !on;
    $("rs-hold").setAttribute("aria-label", R.aria); $("rs-hold").querySelector(".hl").textContent = R.hold; $("rs-cancel").textContent = R.cancel;
    $("cs-title").textContent = C.copyTitle; $("cs-help").textContent = C.copyHelp; $("cs-copy").textContent = C.copyAgain; $("cs-close").textContent = C.done;
    $("ls-title").textContent = C.loadTitle; $("ls-help").textContent = C.loadHelp; $("ls-code").placeholder = C.placeholder; $("ls-apply").textContent = C.apply; $("ls-cancel").textContent = C.cancel;
  }
  // A save's progress in words: the next level (or every level won), coins, side quests won, eggs found.
  function summary(d) {
    const C = CT(), e = app.byId.get(Save.next(d, app.order)), all = app.levels.every((x) => d.done[x.id]), q = Object.keys(d.gal || {}).length, eg = Object.keys(d.eggs || {}).length;
    const o = { n: e ? e.n : 1, c: plural(C.coins, d.coins | 0), q: plural(C.quests, q), e: eg ? plural(C.eggs, eg) : "" };
    return fill(all ? C.summaryEnd : C.summary, o);
  }
  // Reset: the sheet opens on Cancel. A press (pointer, or Space or Enter held) starts the hold on app.clock; step() fills
  // the bar (holdStep) and resets at reset.holdMs; letting go, leaving, a blur or any sheet change before then stops it.
  function openReset() { openSub("resetsheet", $("rs-cancel")); }
  function holdStart() { if (app.hold >= 0 || $("resetsheet").hidden) return; app.hold = app.clock; $("rs-hold").classList.add("on"); $("rs-hold").querySelector(".hl").textContent = RT().holding; }
  function holdStop() { if (app.hold < 0) return; app.hold = -1; const b = $("rs-hold"); b.classList.remove("on"); b.querySelector(".fill").style.transform = ""; b.querySelector(".hl").textContent = RT().hold; }
  function holdStep() { const f = Math.min(1, (app.clock - app.hold) / app.cfg.reset.holdMs); $("rs-hold").querySelector(".fill").style.transform = "scaleX(" + f.toFixed(3) + ")"; if (f >= 1) resetNow(); }
  // The one way progress is reset (save.js reset: preferences kept, written, the cloud hook told). selfTest runs it on
  // its scratch save, so the write stays in memory.
  function resetNow() { holdStop(); Save.reset(app.save, app.meta); progressSwapped(); toast(RT().toast); }
  function progressSwapped() { openSettings(false); app.tipQ = []; if (app.tip) hideTip(); app.loadR = null; showScreen("title"); }
  // Copy: the code (save.js encode) in a selectable box with its length, copied at once; where the Clipboard API is
  // missing or refused (an iframe, older Safari), execCommand on the selected box, else the box stays selected to copy by hand.
  function openCopy() {
    const C = CT(), code = Save.encode(app.save.data, galIds()); $("cs-code").value = code; $("cs-len").textContent = fill(C.len, { len: code.length }); $("cs-sum").textContent = summary(app.save.data);
    $("cs-status").textContent = ""; openSub("codesheet", $("cs-close")); copyCode();
  }
  function copyCode() {
    const ta = $("cs-code"), C = CT(), st = $("cs-status"), said = (ok) => { st.textContent = ok ? C.copied : C.copyFail; st.className = ok ? "ok" : "bad"; if (!ok && !$("codesheet").hidden) { ta.focus(); ta.select(); } return ok; };
    const byHand = () => { let ok = false; try { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); ok = !app.testing && document.execCommand("copy"); } catch (e) { ok = false; } return said(ok); };
    const w = app.clipFake || (!app.testing && navigator.clipboard && navigator.clipboard.writeText ? (t) => navigator.clipboard.writeText(t) : null);
    if (!w) return byHand();
    let r; try { r = w(ta.value); } catch (e) { return byHand(); }
    if (r && typeof r.then === "function") { r.then(() => said(true), byHand); return null; } // the answer comes later
    return r === false ? byHand() : said(true);
  }
  // Load: every change to the box is read (save.js decode; the device's preferences kept); a good code shows what it
  // holds and what it replaces, and only then can it be applied.
  function openLoad() { $("ls-code").value = ""; loadCheck(); openSub("loadsheet", $("ls-code")); }
  function loadCheck() {
    const C = CT(), r = Save.decode($("ls-code").value, app.order, galIds(), app.meta, app.save.data.settings, app.cfg.saveCode.maxPaste), m = $("ls-msg");
    app.loadR = r.ok ? r : null; m.textContent = r.ok ? summary(r.data) : C.err[r.err] || ""; m.className = "sub-sum" + (r.ok ? " good" : m.textContent ? " bad" : "");
    $("ls-warn").textContent = r.ok ? fill(C.replaces, { now: summary(app.save.data) }) : ""; $("ls-warn").hidden = !r.ok; $("ls-apply").disabled = !r.ok;
    return r;
  }
  function loadApply() { const r = app.loadR; if (!r || !codeOn()) return false; const sum = summary(r.data); app.save.data = r.data; writeSave(); progressSwapped(); toast(fill(CT().toast, { sum })); return true; }
  // A picture's thumbnail: gallery.thumbPx (or kp) canvas px a cell, the ring left out; dimmed (lightness only) unless colour.
  function thumb(c, L, colour, kp) {
    const k = kp || app.cfg.gallery.thumbPx, w = L.w - 2, h = L.h - 2, [lo, hi] = app.cfg.gallery.dim.map((x) => parseInt(x.slice(1), 16));
    c.width = w * k; c.height = h * k; const g = c.getContext("2d");
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const id = E.matOf(L.grid[y + 1][x + 1]), hex = L.pal[id] ? L.pal[id].c : "#888888";
      if (colour) g.fillStyle = hex;
      else { const v = parseInt(hex.slice(1), 16), t = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255, ch = (s) => Math.round(((lo >> s) & 255) * (1 - t) + ((hi >> s) & 255) * t); g.fillStyle = "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")"; }
      g.fillRect(x * k, y * k, k, k);
    }
  }

  // ---- screens and levels --------------------------------------------------------------------------------------------
  function showScreen(name) {
    if (name === "gallery") name = "map"; // v5 R3: the Gallery is the journey map now
    if (name !== "play") { app.pick = null; document.body.classList.remove("picking"); }
    $("settings").hidden = true; $("tailsheet").hidden = true; holdStop(); for (const k of SUBS) $(k).hidden = true; // v5.4: its sheets too
    app.screen = name; app.held = false; document.body.classList.remove("held"); music(); // lands foundation: no Settings over a new screen
    $("title").hidden = name !== "title"; $("map").hidden = name !== "map";
    if (name === "title") renderHome();
    if (name === "map") { layoutMap(); renderMap(); scrollMap(); } // v5 R3: the current node about map.curAt down the view
    if (name === "title") fitTitle();
    if (name === "play") fitBoard();
    if (name !== "play") { $("pause").hidden = true; if (app.paused && !document.hidden) resume(); }
    renderCoach();
  }
  function startLevel(id) {
    const e = app.byId.get(id) || app.levels[0];
    if (!livesLeft()) return null; // v4 M5: lives on and none left: no level starts (the toast says when the next comes)
    app.diff = tagOf(e); // v4.3: every level plays on its own tag
    app.entry = e; app.B = E.compile(e.L); app.S = E.sim(app.B, rulesOf(app.diff)); app.S.logOn = true; app.et = 0;
    app.V.setLevel(app.B, app.S, e.L.pal, e.L.liquid, e.L.shade, e.L.hideC ? { c: e.L.hideC, q: e.L.hideQ } : null); usePalette(e); // Land 1 fix (B1): a land level's mystery fill // lands foundation: shade, the level's shade rows (none: drawn as before) // v5 R4: liquid (a lava moat) // v4 M4: the level's colours before anything is painted
    app.ending = null; app.endAt = -1; app.endT = -1; app.panel = null; app.popK = 0; app.used = 0; app.march = false; app.blockT = -1e12; $("panel").hidden = true; $("stage-pic").hidden = true; hideToast();
    app.lockN = app.S.locked; app.unlockT = -1e12; app.lockWas.fill(false); app.lockSock.fill(-1); app.slotUnT.fill(-1e12); app.flip.fill(false); app.reveals = 0; app.pairsOut = 0; landTiles();
    app.t0 = app.clock; app.report = null; app.pick = null; app.pwPop.fill(-1e12); app.carry = -1; renderPowers();
    roundSpeed(); // v5 R1
    // v5 R1: power-ups the campaign has just unlocked get their free use, and their tips show one by one.
    app.tipQ = Meta.grant(app.save.data, app.meta, reach()); if (app.tipQ.length) writeSave(); if (app.tip) hideTip(); app.tipHold = null; app.tipEat = -1;
    app.coached = !!coachSteps(e); // the coach's band is kept for the whole level, so the board never jumps when it goes
    placeSlots();
    if (!e.debug && !e.gallery) { app.save.data.last = e.id; writeSave(); }
    renderAll(); fitLine(); showScreen("play"); coachStart(); // the line and tray take their size before the board is fitted to what is left
    renderPowers(); if (app.tipQ.length) showTip(app.tipQ.shift(), true);
    if (app.B.kill) toast(app.cfg.layout.killToast, true); else if (app.B.pin) toast(app.cfg.layout.pinToast); // v6: a killing (red) or pinning (calm) level says so as it starts
    return e;
  }
  // v4 M3: a tile's flip or shake from the last game lands at once when a level starts (a flip left mid-turn has no width).
  function landTiles() { for (const b of app.cards.concat(app.nexts.flat())) if (b.getAnimations) for (const a of b.getAnimations()) if (a.effect && isFinite(a.effect.getComputedTiming().endTime)) a.finish(); }
  function retry() {
    if (!app.S) return;
    if (!livesLeft()) { showScreen("title"); return; } // v4 M5: no lives left: home, where the refill time shows
    app.S.reset(); app.et = 0; app.t0 = app.clock; app.report = null; app.pick = null; app.pwPop.fill(-1e12); app.V.reset(); app.ending = null; app.endAt = -1; app.endT = -1; app.panel = null; app.popK = 0; app.used = 0; app.march = false; app.blockT = -1e12; $("panel").hidden = true; $("stage-pic").hidden = true; hideToast();
    app.unlockT = -1e12; app.lockWas.fill(false); app.lockSock.fill(-1); app.slotUnT.fill(-1e12); app.flip.fill(false); app.reveals = 0; app.pairsOut = 0; landTiles(); roundSpeed(); // v5 R1
    renderAll(); renderPowers(); coachStart();
  }
  const playNext = () => startLevel(Save.next(app.save.data, app.order));
  // v4 M5, lives (meta.lives; off on the web): true when a level may start; else a toast says when the next life comes.
  function livesLeft() {
    if (Meta.canStart(app.save.data, app.meta, app.now())) return true;
    const L = Meta.lives(app.save.data, app.meta, app.now()); toast(fill(app.meta.home.noLivesToast, { t: Meta.clock(L.nextMs, true) }), true); cue("blocked"); renderHome(); return false;
  }

  // The one play entry point: the card tap, the keyboard and SP.play all call this. Returns true if a card was played.
  // The squad takes its space at the engine's current time; nothing waits on the show. No free space: refused (below).
  function playCol(col) {
    const S = app.S;
    if (app.screen !== "play" || !S || S.status !== E.PLAYING || app.panel || !(col >= 0 && col < E.NCOL) || S.front(col) < 0) return false;
    if (app.pick) { if (app.cards[col].classList.contains("pickable")) return pickTile(col, 0); cancelPick(); return false; } // v5 R1: a linked front is a Quartermaster target; any other front cancels the ask
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
  // v4 M2: a linked card shakes with its partner's tile (when it is in the visible rows), and the toast says why (v4.3: a
  // partner still buried behind its column's front says layout.linkedBuriedText).
  function refusedTap(col) {
    app.refused++;
    const S = app.S, SH = app.cfg.show, why = S.why(col), p = S.partner(S.front(col)), pd = p >= 0 ? rowOf(S, app.B.cardCol[p], p) : -1;
    const shake = (b) => { if (!app.V.calm && b.animate) b.animate(SH.blockedShake.map((x) => ({ transform: "translateX(" + x + "px)" })), { duration: SH.blockedShakeMs, easing: "linear" }); };
    shake(app.cards[col]); if (pd >= 0) shake(tileOf(app.B.cardCol[p], pd));
    if (app.clock - app.blockT < SH.blockedGapMs) return;
    app.blockT = app.clock; cue("blocked"); toast(why === 3 ? app.cfg.layout.linkedBuriedText : p >= 0 ? app.cfg.layout.linkedText : app.cfg.layout.blockedText, true);
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
    if (S.reason === "jam") { app.ending.squads = []; for (const s of S.order(app.ord)) { if (!S.stuck(s) && !S.pinned(s)) continue; app.ending.squads.push([S.spM[s], S.spW[s] + S.pinned(s)]); /* v6 1b: a pinned squad is named too */ const c = mat(S.spM[s]).crew; if (app.ending.crews.indexOf(c) < 0) app.ending.crews.push(c); } cue("jam"); }
    // v4.3: a level is cleared or not (first: its first clear).
    const q0 = app.ending.won && !app.entry.debug ? openQs() : null; // v5.1: the side quests open before this win (toMap pulses the ones it opens)
    if (app.ending.won && app.entry.debug) app.ending.first = false;
    else if (app.ending.won && app.entry.gallery) { app.ending.first = Save.record(app.save.data, app.entry.id, "gal"); if (app.ending.first) questPrize(app.entry); writeSave(); }
    else if (app.ending.won) { app.ending.first = Save.record(app.save.data, app.entry.id); app.save.data.last = Save.next(app.save.data, app.order); writeSave(); }
    // v4 M5: the report. A win of a siege level or a Gallery picture: real play time (app.clock: pauses excluded), taps,
    // coins (by the level's tag, more on its first clear), best time and taps. A fail with lives on costs one.
    const e = app.entry, rewarded = !e.debug && (e.gallery || e.idx >= 0);
    if (app.ending.won && rewarded) { app.report = Meta.recordWin(app.save.data, app.meta, e.id, app.diff, app.clock - app.t0, S.plays, app.ending.first); writeSave(); }
    else if (!app.ending.won && rewarded && app.meta.lives) { app.report = { lives: Meta.loseLife(app.save.data, app.meta, app.now()) }; writeSave(); }
    app.fresh = q0 ? openQs().filter((e) => q0.indexOf(e) < 0) : null;
    app.pick = null; renderPowers();
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
    // v4.3: a jam where linked fronts wait for buried partners (jamWhy bit 4) says that first.
    const L = app.cfg.layout, jam = e.why & 4 ? L.jamBuriedText + (c.length ? ", and " + names + " can't reach a block." : ".") : e.why & 1 ? L.jamLinkedText + (c.length ? ", and " + names + " can't reach a block." : ".") : "Line jammed: " + names + " can't reach a block." + (e.why & 2 ? " " + L.jamLockText : "") + (e.why & 8 ? " " + L.jamPinText : ""); // v6 1b
    return { stuck: "Out of squads, and the waiting sappers can't reach their colour.", short: fill(L.shortText, { crew: who }), // v6: a killing tower left a colour short
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
    if (e.reason === "jam" && e.why & 4) { add(L.jamBuriedText); if (n) { add(", and "); chips(); add(" can't reach a block."); } else add("."); }
    else if (e.reason === "jam" && e.why & 1) { add(L.jamLinkedText); if (n) { add(", and "); chips(); add(" can't reach a block."); } else add("."); }
    else if (e.reason === "jam") { add("Line jammed: "); if (n) chips(); else add("the squads"); add(" can't reach a block." + (e.why & 2 ? " " + L.jamLockText : "") + (e.why & 8 ? " " + L.jamPinText : "")); }
    else if (e.reason === "short" && e.m) { add(L.shortPre); chip(e.m, 0); add(L.shortPost); } // v6: the colour's chip, no count; Retry only (no continue)
    else add(reasonText(e));
  }
  // Lands foundation: the end of the castle story on the boss's first win (config lands.epilogue): on into the first land
  // when one is built, else into the mist.
  function epilogue() { const LC = landsCfg(), P = LC.epilogue || {}, d = (LC.list || [])[0]; return d ? fill(P.first || "", { name: d.name }) : P.none || ""; }
  function showPanel() {
    const e = app.ending; if (!e) return;
    app.panel = e.won ? "win" : "fail"; app.panelAt = app.clock; renderCoach();
    const G = app.cfg.gallery, gal = !!app.entry.gallery, toMapT = app.cfg.layout.toMap;
    const BS = e.won && !gal && app.entry.boss; // v5 R4 fix (S4): the boss's own win title, line and the crown recovered
    const LD = app.entry.L.land ? JN.landOf(landsCfg(), app.entry.n) || (landsCfg().list || []).find((d) => d.k === app.entry.L.land) : null, LT = LD ? landsCfg().text || {} : null; // Land 1 fix (M2): a land's picture levels and side quests win and fail in the land's words, not the castle's
    $("p-title").textContent = e.won ? (gal ? G.winTitle : BS ? BS.winTitle : LT ? LT.winTitle : "Fort razed!") : LT ? LT.failTitle : "Assault failed"; tagChip($("p-tag"), app.diff); // v4.3: the level's tag
    $("p-crown").hidden = !BS; $("panel").classList.toggle("boss", !!BS); if (BS) $("p-crown").setAttribute("aria-label", BS.crownAria);
    if (e.won) { $("p-line").textContent = BS ? (e.first ? BS.win + " " + epilogue() : BS.winAgain) : gal ? fill(e.first ? G.winLine : G.winLineAgain, { title: app.entry.L.title }) : LT ? fill(e.first ? LT.winLine : LT.winLineAgain, { name: LD.name, n: app.entry.n }) : "The goblin king flees. " + (app.entry.debug ? app.entry.L.name : "Level " + app.entry.n) + (e.first ? " cleared." : " cleared again."); $("p-line").removeAttribute("aria-label"); } else sheetLine(e);
    reportPic(e.won && gal);
    // v5.1 (playtesters, 2026-10-06): every win (a level, a side quest, the boss) goes back to the journey map, where the
    // next node, a side quest just opened and the eggs in reach show (layout.toMap); a fail's main button is Retry.
    const pp = $("p-primary"); pp.querySelector(".pl").textContent = e.won ? toMapT : "Retry"; playTag(pp, null);
    $("p-stats").querySelector(".coin").classList.remove("go");
    $("p-secondary").textContent = e.won ? "Retry" : toMapT; // v5.1: the fail sheet's way out reads the same
    reportRows(e); // v4.3: no medals; the report's rows and the tag
    contOffer(e); // v5 R1: a jam's sheet offers the continue
    x2Offer(e); // v5.1 AD HOOK: the x2 reward (off)
    $("panel").hidden = false; placeSheet();
    cue(e.won ? "chime" : "bad"); if (e.won && e.first) cue("star", 2); if (BS) cue("star", BS.stars); if (e.won) jingle(); // v5.2
    judge(); renderTray(); renderLine();
  }
  // v5 R1, the continue on a jam (engine revive(); meta.cont): offered on the jam's sheet when the engine would take it
  // (once per attempt), for meta.cont.price coins. Short of coins the button is muted and its line says how many more;
  // a tap then shakes it and toasts, spending nothing. Paid: every stuck squad finishes on the spot and play goes on.
  function contOffer(e) {
    const C = app.meta.cont, box = $("p-cont"), on = !!C && !e.won && e.reason === "jam" && app.S.canRevive(); box.hidden = !on; if (!on) return;
    const have = app.save.data.coins | 0, poor = have < C.price, bt = $("p-cont-buy"), say = poor ? fill(C.poor, { need: C.price - have }) : C.say;
    bt.querySelector(".pl").textContent = C.btn; bt.querySelector(".cprice b").textContent = C.price; bt.classList.toggle("poor", poor);
    box.querySelector(".cont-say").textContent = say; bt.setAttribute("aria-label", C.btn + ", " + C.price + " coins: " + say);
    $("p-cont-ad").hidden = true; // AD HOOK (v5 R1): show it, labelled C.ad, once a rewarded-ad SDK is wired; its reward calls contRun()
  }
  function onContinue() {
    if (app.panel !== "fail" || !panelLive() || !app.S.canRevive()) return false;
    const C = app.meta.cont, r = Meta.spend(app.save.data, C.price);
    if (!r.ok) { const b = $("p-cont-buy"); if (!app.V.calm && b.animate) b.animate(app.cfg.show.blockedShake.map((x) => ({ transform: "translateX(" + x + "px)" })), { duration: app.cfg.show.blockedShakeMs }); cue("blocked"); toast(fill(C.short, { price: C.price, have: app.save.data.coins | 0 }), true); return false; }
    writeSave(); return contRun();
  }
  // The continue itself (paid, or AD HOOK: a rewarded ad's reward, free): the engine finishes every stuck squad, the sheet goes.
  function contRun() {
    if (app.S.revive() === E.REFUSED) return false;
    app.ending = null; app.endAt = -1; app.endT = -1; app.panel = null; app.report = null; $("panel").hidden = true; $("p-cont").hidden = true; hideToast();
    app.V.sync(app.S, true); cue("unlock"); renderAll(); renderPowers(); coachStep();
    return true;
  }
  // v5.1 AD HOOK, the x2 reward (config meta.double; its switch on is false until a rewarded-ad SDK is wired, so the button
  // never shows yet). On a win that paid coins the button pays them once more after a rewarded ad (Meta.double: once per
  // win; Retry's next win offers it again); the count on the sheet goes up to the doubled sum.
  function x2Offer(e) {
    const D = app.meta.double, R = app.report, b = $("p-x2"), on = !!D && D.on === true && e.won && !!R && R.coins > 0 && !R.dbl; b.hidden = !on; if (!on) return;
    b.querySelector(".pl").textContent = D.btn; b.querySelector(".x2-say").textContent = D.ad; b.setAttribute("aria-label", D.btn + ": " + D.ad);
  }
  function onDouble() { const D = app.meta.double; if (app.panel !== "win" || !panelLive() || !D || D.on !== true || $("p-x2").hidden) return 0; return adReward(x2Run); }
  // AD HOOK: the rewarded ad. No SDK yet: this stub grants at once (reachable only with meta.double.on, as in selfTest). An
  // SDK shows its ad here and calls grant() from its reward callback (a skipped ad grants nothing).
  function adReward(grant) { return grant(); }
  function x2Run() {
    const R = app.report, n = Meta.double(app.save.data, R); if (!n) return 0;
    writeSave(); $("p-x2").hidden = true; cue("coin"); toast(fill(app.meta.double.toast, { n }));
    const st = $("p-stats"), al = st.getAttribute("aria-label"); if (al) st.setAttribute("aria-label", al.replace(/\+\d+$/, "+" + (R.coins + n)));
    return n;
  }
  // v4 M5, the level report on the win sheet: time, taps and coins (counting up in step()), with the best time and taps
  // underneath ("New best!" when beaten; the first win shows none); a fail with lives on adds the life it cost.
  function reportRows(e) {
    const R = app.report, st = $("p-stats"), T = app.meta.report, rows = st.children; st.hidden = !(e.won && R && R.coins != null);
    const rb = $("p-ribbon"); rb.hidden = st.hidden || !e.first; if (!rb.hidden) rb.textContent = fill(T.firstClear, { n: R.coins - Meta.winCoins(app.meta, app.diff, false) }); // v4.3 fix (m3): a first clear's ribbon
    if (!e.won && R && R.lives && R.lives.on) $("p-line").append(" " + fill(app.meta.home.lifeLost, { n: R.lives.n }));
    if (st.hidden) return;
    const best = (v, was, nw, f) => (!was ? (e.first ? T.first : T.newBest) : nw ? T.newBest : fill(T.best, { v: f(was) })); // no best kept yet: a first win, or a win from before M5
    rows[0].querySelector(".k").textContent = T.time; $("p-time").textContent = Meta.clock(R.ms); rows[0].querySelector("em").textContent = best(R.ms, R.best[0], R.newMs, Meta.clock); rows[0].classList.toggle("new", !!R.best[0] && R.newMs);
    rows[1].querySelector(".k").textContent = T.taps; $("p-taps").textContent = R.taps; rows[1].querySelector("em").textContent = best(R.taps, R.best[1], R.newTaps, String); rows[1].classList.toggle("new", !!R.best[1] && R.newTaps);
    rows[2].querySelector(".k").textContent = T.coins; app.countTxt = ""; countCoins(); rows[2].querySelector("em").textContent = ""; // v4.3 fix (m3): the first-clear bonus is on the ribbon
    st.setAttribute("aria-label", T.time + " " + Meta.clock(R.ms) + ", " + T.taps + " " + R.taps + ", " + T.coins + " +" + R.coins);
  }
  // Critics 2 fix (V2): a Gallery win shows the finished picture above the report, in its colours on its own frame, at
  // gallery.reportCellPx CSS px a cell (whole device px a cell), at most gallery.reportMaxPx tall; placeSheet shrinks it
  // to the room there is (picSize), or hides it under gallery.reportMinPx.
  function reportPic(on) {
    const box = $("p-pic"); box.hidden = !on; box.dataset.on = on ? "1" : ""; $("stage-pic").hidden = true; if (!on) return;
    const G = app.cfg.gallery, L = app.entry.L, dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), k = Math.max(1, Math.round(Math.min(G.reportCellPx, G.reportMaxPx / (L.h - 2)) * dpr));
    thumb(box.firstElementChild, L, true, k); box.dataset.h = ((L.h - 2) * k) / dpr; box.setAttribute("aria-label", fill(G.picAria, { title: L.title })); picSize(1e9);
  }
  // Where the sheet has no room for it (a short landscape screen) the picture hangs over the razed board instead
  // (#stage-pic), as big as gallery.stageFrac of the board's frame allows.
  function stagePic(on) {
    const box = $("stage-pic"); box.hidden = !on; if (!on) return;
    const L = app.entry.L, f = $("frame").getBoundingClientRect(), dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), s = (app.cfg.gallery.stageFrac * Math.min(f.width / (L.w - 2), f.height / (L.h - 2)));
    const k = Math.max(1, Math.floor(s * dpr)); thumb(box.firstElementChild, L, true, k); box.firstElementChild.style.width = ((L.w - 2) * k) / dpr + "px"; box.firstElementChild.style.height = ((L.h - 2) * k) / dpr + "px"; box.setAttribute("aria-label", fill(app.cfg.gallery.picAria, { title: L.title }));
  }
  // The picture at its full size, or at most h CSS px tall (its aspect kept); false when that is under reportMinPx.
  function picSize(h) {
    const box = $("p-pic"), c = box.firstElementChild, full = +box.dataset.h || 0, t = Math.min(full, h); if (!full) return false;
    if (t < app.cfg.gallery.reportMinPx) return false;
    c.style.height = t + "px"; c.style.width = (t * c.width) / c.height + "px"; return true;
  }
  // The coins count up on the sim clock (meta.report: countDelayMs, then countMs); a coin cue when they start.
  function countCoins() {
    const R = app.report, T = app.meta.report; if (!R || R.coins == null || app.panel !== "win") return;
    const k = Math.max(0, Math.min(1, (app.clock - app.panelAt - T.countDelayMs) / T.countMs)), txt = "+" + Math.round((R.coins + (R.dbl | 0)) * k); // v5.1: a doubled reward counts on to its sum
    if (txt !== app.countTxt) { if (app.countTxt === "+0" && k > 0) { cue("coin"); if (!app.V.calm) $("p-stats").querySelector(".coin").classList.add("go"); } app.countTxt = txt; $("p-coins").textContent = txt; } // v4.3 fix (m3): the coins burst as they start
  }
  // A panel button ignores taps for show.panelGuardMs after the panel appears, so a thumb still tapping cards can't hit it.
  const panelLive = () => app.clock - app.panelAt >= app.cfg.show.panelGuardMs || app.testing;
  // v5.1: a win's main button and a fail's second go back to the map (toMap); Retry is the other.
  function panelPrimary() { if (!app.panel || !panelLive()) return; if (app.panel === "win") toMap(); else retry(); }
  function panelSecondary() { if (!app.panel || !panelLive()) return; if (app.panel === "win") retry(); else toMap(); }
  // The map, scrolled to the current node (showScreen: map.curAt down); after a win the node just opened and any side quest
  // that win opened (app.fresh) pulse (config map.fresh; none under reduced motion).
  function toMap() { const q = app.fresh; app.fresh = null; showScreen("map"); return freshPulse(q); }
  function freshPulse(qs) {
    const F = app.cfg.map.fresh, J = app.jr; if (!F || !J || app.V.calm) return 0;
    const f = JN.focus(app.save.data, app.order), fe = f && f !== "tail" ? app.byId.get(f) : null, tb = J.tail && !J.tail.b.hidden ? J.tail.b : null, els = [fe ? fe.node : tb];
    for (const e of qs || []) els.push(e.node && e.node.isConnected ? e.node : J.tail && J.tail.e === e ? tb : null);
    const k = []; for (let i = 0; i < F.pulses; i++) k.push({ transform: "scale(1)" }, { transform: "scale(" + F.scale + ")" }); k.push({ transform: "scale(1)" });
    let n = 0; for (const b of els) { const el = b && b.querySelector(".bd, .qf"); if (el && el.animate) { el.animate(k, { duration: F.ms, easing: "ease-in-out" }); n++; } }
    return n;
  }

  // ---- teaching coach (config.teach) ---------------------------------------------------------------------------------
  // One line over the board and a bouncing arrow on the thing to tap: a front card, a card behind one, the holding line,
  // or a ring on the board (key, gate, tower). Steps advance on play; conditions read the rules state, so any tap order
  // works. DOM work happens on a play or a resize only, never per frame. v4 M3 (the twists' teaching levels): pointers
  // mystery (a hidden "?" tile in view), linked (a linked front card), lockSlot (the padlocked space) and the ring
  // lockKey (the space's key on the board); conditions reveal (a "?" turned over), pair (a linked pair went out), unlock
  // (the space opened), locked (it is still shut), hidden (a "?" is in view), linkedFront (a front card is linked).
  // v5 R2: pointer power (a power-up id: its badge, on the level that unlocks it); any level may have coach lines (the
  // first lock levels, 53 and 87, do). v5 R4: ring hidden (the mystery block still showing "?" nearest the entry).
  // Lands foundation: a shaded level (shade rows) with no script of its own says lands.shadeTip until the player has
  // cleared a shaded level or picture (worked out from the save, so it needs no field of its own).
  const shadeTip = (e) => { if (!e || !e.L.shade) return null; const d = app.save.data, won = (x) => x.L.shade && (x.gallery ? d.gal[x.id] : d.done[x.id]); return app.levels.some(won) || app.gal.some(won) ? null : landsCfg().shadeTip || null; };
  const coachSteps = (e) => { const st = e && ((app.cfg.teach || {})[e.id] || (e.L.hint ? [{ say: e.L.hint, until: "play" }] : null) || shadeTip(e)); return st && st.length ? st : null; };
  function coachStart() {
    const steps = coachSteps(app.entry);
    app.coach = steps ? { steps, i: 0, at: 0 } : null;
    if (app.coach) skipDead();
    renderCoach();
  }
  // v5 R2, the moat lesson's ring: the middle of the ground run that crosses the water nearest the entry (an open
  // drawbridge: open ground with water beside it), or -1 with no moat. Read once per level (coach renders only).
  function bridgeOf(B) {
    if (B.bridge != null) return B.bridge; B.bridge = -1; const w = B.w, a = B.a0;
    for (let y = B.h - 1; y >= 0 && B.bridge < 0; y--) { let x0 = -1, x1 = -1;
      for (let x = 1; x < w - 1; x++) { const c = y * w + x; if (a[c] === E.DIRT && (a[c - 1] === E.WATER || a[c + 1] === E.WATER)) { if (x0 < 0) x0 = x; x1 = x; } }
      if (x0 >= 0) { let m = Math.round((x0 + x1) / 2); while (m < x1 && a[y * w + m] !== E.DIRT) m++; B.bridge = y * w + m; } }
    return B.bridge;
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
      case "unlock": return (B.lockKey >= 0 || B.lockMat > 0) && S.locked === 0;
      case "locked": return S.locked > 0;
      case "hidden": return hiddenTile() !== null;
      case "linkedFront": return linkedFront() >= 0;
    }
    return false;
  }
  // The first hidden "?" tile in the visible rows, and the first column whose front card is linked (-1: none).
  function hiddenTile() { const S = app.S, RW = app.rows; for (let d = 1; d < RW; d++) for (let j = 0; j < E.NCOL; j++) { const ci = S.card(j, d); if (ci >= 0 && S.hidden(ci)) return tileOf(j, d); } return null; }
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
    if (!el && st.lockSlot && S.locked > 0) { let i = S.cap - 1; while (i > 0 && !S.shutAt(i)) i--; el = app.slots[i]; } // v6: the last shut space
    if (!el && st.power) { const b = app.pws[E.POWERS.indexOf(st.power)]; if (b && !b.hidden) el = b; } // v5 R2: a power-up's badge (the level that unlocks it)
    if (!el && st.line) el = $("line");
    // A ring on the board: the first gate's key (or the gate once the key is gone), the first standing tower.
    if (st.ring === "key" || st.ring === "gate") { const k = 0, kc = V.keyC[k]; if (B.gateCells.length) { if (st.ring === "key" && kc >= 0 && S.a[kc] > 0) Object.assign(V.focus, { on: true, x: kc % B.w + 0.5, y: ((kc / B.w) | 0) + 0.5, r: 1.1 }); else Object.assign(V.focus, { on: true, x: V.gX[k], y: V.gY[k], r: 1.6 }); } }
    if (st.ring === "lockKey" && B.lockKey >= 0 && S.a[B.lockKey] > 0) Object.assign(V.focus, { on: true, x: B.lockKey % B.w + 0.5, y: ((B.lockKey / B.w) | 0) + 0.5, r: 1.1 });
    if (st.ring === "moat") { const c = bridgeOf(B); if (c >= 0) Object.assign(V.focus, { on: true, x: c % B.w + 0.5, y: ((c / B.w) | 0) + 0.5, r: 1.8 }); } // v5 R2: the moat lesson's bridge
    if (st.ring === "hidden") { let bc = -1, bd = Infinity; const mx = B.w / 2; for (let k = 0; k < B.n; k++) if (S.hiddenCell(k)) { const d = (k % B.w + 0.5 - mx) ** 2 + (((k / B.w) | 0) - B.campRow) ** 2; if (d < bd) { bd = d; bc = k; } } // v5 R4: the mystery block nearest the entry
      if (bc >= 0) Object.assign(V.focus, { on: true, x: bc % B.w + 0.5, y: ((bc / B.w) | 0) + 0.5, r: 1.3 }); }
    if (Array.isArray(st.ring)) { const c = st.ring[1] * B.w + st.ring[0]; if (S.a[c] > 0) Object.assign(V.focus, { on: true, x: st.ring[0] + 0.5, y: st.ring[1] + 0.5, r: st.r || 2 }); } // v5 R4 fix (S4): a ring on a board cell [x, y] (the boss's king)
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
  // the top bar (the step's short text there, when it has one) the font steps through layout.coachTopFontPx, one line
  // first, then two (Critics 2 fix, V1).
  function fitCoach() {
    const t = $("coach"), [hi, lo] = app.cfg.layout[app.coachMode === "top" ? "coachTopFontPx" : "coachFontPx"]; if (t.hidden) return;
    t.classList.remove("two");
    for (let px = hi; px >= lo; px--) { t.style.fontSize = px + "px"; if (t.scrollWidth <= t.clientWidth && t.scrollHeight <= t.clientHeight) return; }
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
  function toast(text, bad) { const t = $("toast"); t.textContent = text; t.classList.toggle("bad", !!bad); t.hidden = false; placeToast(); app.toastT = app.clock + app.cfg.show.toastMs; }
  // v4.3 fix (m2): on a wide screen a toast in play sits just above the side column's tray (by the cards and the line it is
  // about), as wide as the tray at most; elsewhere at the board's foot, as before.
  function placeToast() {
    const t = $("toast"), side = app.wide && app.screen === "play"; t.classList.toggle("side", side); t.classList.toggle("over", app.screen !== "play"); // v5.4: over the home and map
    if (!side) { t.style.left = ""; t.style.top = ""; t.style.maxWidth = ""; return; }
    const r = $("tray").getBoundingClientRect(); t.style.left = r.left + r.width / 2 + "px"; t.style.top = r.top - app.cfg.layout.toastGapPx + "px"; t.style.maxWidth = r.width + "px";
  }
  function hideToast() { $("toast").hidden = true; app.toastT = -1e12; }
  function cue(name, arg) { app.cues[name] = (app.cues[name] | 0) + 1; if (app.audio && !app.testing) Audio.cue(app.audio, name, arg, app.clock); }
  // v5.2: the screen's music track (asked for on every showScreen; the same track carries on), and the win's jingle
  // (counted in app.cues like a cue; not played while selfTest runs).
  function music() { if (app.audio) Audio.want(app.audio, Audio.pick(app.cfg.audio.music, app.screen, app.screen === "play" ? app.entry : null)); }
  function jingle() { app.cues.jingle = (app.cues.jingle | 0) + 1; if (app.audio && !app.testing) Audio.jingle(app.audio); }
  function onPop() { cue("pop", app.popK++ % 12); }
  // Pause (portal shape): on window blur or a hidden tab the clock stops and the audio context suspends. In a level the
  // Paused sheet covers everything and takes the tap that resumes, so the tap that brings a player back never plays a
  // card; on the title and map the game just resumes when focus returns. No timers are involved.
  function pause() {
    if (app.paused || !app.cfg) return;
    app.paused = true; app.pauses++; if (app.audio) Audio.suspend(app.audio); holdStop(); // v5.4: a blur lets go of the reset hold
    if (app.screen === "play") $("pause").hidden = false;
  }
  function resume() {
    if (!app.paused || app.upright) return; // v4.2 fix: never behind the upright card
    app.paused = false; app.lastT = 0; $("pause").hidden = true;
    if (app.audio && app.audio.ctx) Audio.unlock(app.audio);
  }
  // v4.2 fix: the upright card. coarse: a touch screen (CSS pointer: coarse); needed: held sideways under maxH CSS px tall
  // (layout.upright). Showing it pauses as a blur does (unless already paused); hiding it resumes only that pause.
  const coarse = () => !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const uprightNeeded = (w, h, c) => !!c && w > h && h < app.cfg.layout.upright.maxH;
  function setUpright(on) {
    on = !!on; if (on === app.upright) return;
    if (on) { if (!app.paused) { pause(); app.upPause = true; } app.upright = true; $("upright").hidden = false; }
    else { app.upright = false; $("upright").hidden = true; if (app.upPause) { app.upPause = false; resume(); } }
  }
  // v4 M5: a settings row (.set-row) also shows its value in words.
  const rowVal = (b, t) => { const v = b.querySelector(".sv"); if (v) v.textContent = t; };
  // v5.2: effects and music switch apart (the settings rows; saved). The quick mute buttons read pressed when both are off
  // and "mixed" when one is; settings.muted is kept as both off (an older page reads it).
  function setSound(sfx, music, save) {
    Audio.setSfx(app.audio, sfx); Audio.setMusic(app.audio, music); const A = app.audio, st = Audio.state(A);
    togMute.forEach((b) => b.setAttribute("aria-pressed", st === "off" ? "true" : st === "mixed" ? "mixed" : "false"));
    togMusic.forEach((b) => { b.setAttribute("aria-pressed", A.music ? "true" : "false"); rowVal(b, A.music ? "On" : "Off"); });
    togSfx.forEach((b) => { b.setAttribute("aria-pressed", A.sfx ? "true" : "false"); rowVal(b, A.sfx ? "On" : "Off"); });
    if (save) { const S = app.save.data.settings; S.sfx = A.sfx; S.music = A.music; S.muted = A.muted; writeSave(); }
  }
  const quickMute = () => { const q = Audio.quick(app.audio); setSound(q.sfx, q.music, true); };
  // v5 R1, speed (meta.speed): 1x by default. A player buys 2x for the current attempt (price coins; the sheet asks
  // first), then the button toggles 1x and 2x free until Retry, a new level or leaving. Under ?debug=1 the button cycles
  // debugSpeeds (1x, 2x, 3x) free. Nothing is saved. Gold above 1x; the settings row (debug only) shows it on the right.
  const speeds = () => (app.debugSpeed ? app.meta.speed.debugSpeeds : app.fastPaid ? [1, app.meta.speed.x] : [1]);
  function setSpeed(k) {
    const sp = speeds(); app.speed = sp.indexOf(k) >= 0 ? k : 1;
    togSpeed.forEach((b) => { const x = b.querySelector(".sv") || b; x.textContent = app.speed + "\u00d7"; b.classList.toggle("on", app.speed > 1); b.setAttribute("aria-label", "Speed " + app.speed + "x" + (sp.length > 1 ? " (tap for " + sp[(sp.indexOf(app.speed) + 1) % sp.length] + "x)" : " (tap to buy " + app.meta.speed.x + "x for this round)")); });
  }
  function nextSpeed() {
    const sp = speeds(); if (sp.length > 1) { setSpeed(sp[(sp.indexOf(app.speed) + 1) % sp.length]); return true; }
    if (app.screen !== "play" || !app.S) return false;
    const T = app.meta.speed; $("sb-title").textContent = T.say; $("sb-buy").querySelector(".pl").textContent = T.buy; $("sb-buy").querySelector(".cprice b").textContent = T.price; $("sb-no").textContent = T.no;
    $("speedbuy").hidden = false; $("sb-buy").focus(); return true;
  }
  function buySpeed(yes) {
    $("speedbuy").hidden = true; if (!yes || app.fastPaid) return false;
    const T = app.meta.speed, r = Meta.spend(app.save.data, T.price);
    if (!r.ok) { cue("blocked"); toast(fill(T.short, { price: T.price, have: app.save.data.coins | 0 }), true); return false; }
    writeSave(); app.fastPaid = true; setSpeed(T.x); cue("coin"); toast(fill(T.bought, { price: T.price })); renderPowers(); return true;
  }
  // A new attempt (a level, Retry): back to 1x unless debugging; a bought 2x is spent.
  function roundSpeed() { app.fastPaid = false; $("speedbuy").hidden = true; if (!app.debugSpeed) setSpeed(1); else setSpeed(app.speed); }
  // Colour-blind mode (v4 M1): the board's blocks and the queue tiles wear their material's mark. A toggle on the title
  // and the map, kept in the save.
  function setCb(on, save) {
    app.cb = !!on; document.body.classList.toggle("cb", app.cb); if (app.V) app.V.setCb(app.cb);
    togCb.forEach((b) => { b.setAttribute("aria-pressed", app.cb ? "true" : "false"); rowVal(b, app.cb ? "On" : "Off"); });
    if (save) { app.save.data.settings.cb = app.cb; writeSave(); }
  }

  function wire() {
    document.addEventListener("pointerdown", () => { if (app.audio) Audio.unlock(app.audio); if (app.tip && app.tip.intro) hideTip(); }, { capture: true }); // v5 R1: a tap takes an unlock's tip away
    document.addEventListener("click", () => { if (app.audio) Audio.unlock(app.audio); }, { capture: true }); // v5.2: a touch's activation lands on its click (Chrome)
    document.addEventListener("keydown", (ev) => {
      if (app.audio) Audio.unlock(app.audio);
      if (app.paused) { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); resume(); } return; }
      if (subOpen()) { if (ev.key === "Escape") openSub(null); return; } // v5.4: back to Settings
      if (!$("settings").hidden) { if (ev.key === "Escape") openSettings(false); return; }
      if (!$("tailsheet").hidden) { if (ev.key === "Escape") openTail(false); return; } // v5 R3 fix
      if (ev.key === "Escape" && app.pick) { cancelPick(); return; }
      if (app.screen !== "play") return;
      if (ev.key >= "1" && ev.key <= "5") playCol(+ev.key - 1);
      else if (ev.key === "r" || ev.key === "R") retry();
      else if (ev.key === " ") { ev.preventDefault(); skip(); }
    });
    $("board").addEventListener("pointerdown", skip);
    $("pause").addEventListener("click", resume);
    document.querySelector("#pause .pz-set").addEventListener("click", (ev) => ev.stopPropagation()); // its toggles don't resume
    $("btn-settings").addEventListener("click", () => openSettings(true)); $("btn-pset").addEventListener("click", () => openSettings(true)); $("set-close").addEventListener("click", () => openSettings(false)); // lands foundation: btn-pset, the play screen's gear
    $("settings").addEventListener("click", (ev) => { if (ev.target === $("settings")) openSettings(false); }); // the backdrop closes it
    $("tab-home").addEventListener("click", () => showScreen("title"));
    window.addEventListener("blur", pause);
    window.addEventListener("focus", () => { if (app.screen !== "play") resume(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else if (app.screen !== "play") resume(); });
    $("btn-retry").addEventListener("click", retry);
    $("btn-map").addEventListener("click", () => showScreen("map"));
    $("map-set").addEventListener("click", () => openSettings(true)); // v5 R3: the map's gear
    $("ts-close").addEventListener("click", () => openTail(false)); $("tailsheet").addEventListener("click", (ev) => { if (ev.target === $("tailsheet")) openTail(false); }); // v5 R3 fix: the long tail's sheet
    $("btn-play").addEventListener("click", playNext);
    $("btn-tomap").addEventListener("click", () => showScreen("map"));
    $("btn-home").addEventListener("click", () => showScreen("title"));
    $("map-play").addEventListener("click", () => { const te = mapPic(); if (te) startLevel(te.id); else playNext(); }); // v5 R3: past the last level, the fog's next picture
    $("p-primary").addEventListener("click", panelPrimary);
    $("p-secondary").addEventListener("click", panelSecondary);
    $("p-cont-buy").addEventListener("click", onContinue); // v5 R1
    $("p-x2").addEventListener("click", onDouble); // v5.1 AD HOOK (off)
    togMute.forEach((b) => b.addEventListener("click", quickMute));
    togMusic.forEach((b) => b.addEventListener("click", () => setSound(app.audio.sfx, !app.audio.music, true))); // v5.2
    togSfx.forEach((b) => b.addEventListener("click", () => setSound(!app.audio.sfx, app.audio.music, true)));
    togSpeed.forEach((b) => b.addEventListener("click", nextSpeed));
    $("sb-buy").addEventListener("click", () => buySpeed(true)); $("sb-no").addEventListener("click", () => buySpeed(false)); // v5 R1
    document.querySelector("#settings .tog-speed").hidden = !app.debugSpeed; // v5 R1: speed lives on the play screen (debug keeps the row)
    togCb.forEach((b) => b.addEventListener("click", () => setCb(!app.cb, true)));
    // v5.4: reset and the save code. The hold button acts on press and release only (its click does nothing).
    $("set-reset").addEventListener("click", openReset); $("set-copy").addEventListener("click", openCopy); $("set-load").addEventListener("click", openLoad);
    const hb = $("rs-hold");
    hb.addEventListener("pointerdown", (ev) => { if (ev.button > 0) return; ev.preventDefault(); holdStart(); });
    for (const k of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) hb.addEventListener(k, holdStop);
    hb.addEventListener("keydown", (ev) => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); if (!ev.repeat) holdStart(); } });
    hb.addEventListener("keyup", (ev) => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); holdStop(); } });
    hb.addEventListener("blur", holdStop); hb.addEventListener("contextmenu", (ev) => ev.preventDefault());
    $("rs-cancel").addEventListener("click", () => openSub(null));
    $("cs-copy").addEventListener("click", copyCode); $("cs-close").addEventListener("click", () => openSub(null)); $("cs-code").addEventListener("focus", () => $("cs-code").select());
    $("ls-code").addEventListener("input", loadCheck); $("ls-apply").addEventListener("click", loadApply); $("ls-cancel").addEventListener("click", () => openSub(null));
    for (const k of SUBS) $(k).addEventListener("click", (ev) => { if (ev.target === $(k)) openSub(null); }); // the backdrop: back to Settings
    window.addEventListener("resize", layout);
    // A hidden tab can lose canvas backing stores: re-check every opaque cache when the page shows again, rebuild once.
    const recheck = () => { if (document.hidden || !app.V || !app.V.sprites) return; if (app.V.checkSprites().length) { app.V.buildSprites(); app.V.paintLayer(); } };
    document.addEventListener("visibilitychange", recheck); window.addEventListener("pageshow", recheck);
  }

  // ---- layout ---------------------------------------------------------------------------------------------------------
  function layout() {
    if (!app.cfg) return;
    const L = app.cfg.layout, W = window.innerWidth, H = window.innerHeight;
    setUpright(uprightNeeded(W, H, coarse()));
    app.wide = W >= L.wideMinPx && W / H >= L.wideAspect;
    // Short and wide (a landscape phone): the top bar moves over the rail so the board gets the full height.
    const short = app.wide && H <= L.shortMaxH;
    document.body.classList.toggle("wide", app.wide); document.body.classList.toggle("short", short);
    // v4 M5: short frames show queueRowsShort rows, so the power-up bar fits under the queue (the orchestrator's call);
    // fitBoard may also drop to them on a taller phone, for a board that would be under minCellCss with three.
    setRows(H <= L.shortRowsMaxH ? L.queueRowsShort : L.queueRows);
    const r = document.documentElement.style;
    if (app.wide) { const rw = short ? L.railShortPx : Math.round(Math.min(L.railWidePx, Math.max(L.railMinPx, W * L.railFrac))); r.setProperty("--rail-w", rw + "px"); r.setProperty("--wide-gap", (short ? L.gapShortPx : L.gapWidePx) + "px"); }
    app.labFit.clear();
    if (app.screen === "title") fitTitle();
    if (app.screen === "map") { layoutMap(); fitLabel(); } else if (app.jr) app.jr.colW = 0; // v5 R3: the map's column (laid out again when it shows)
    if (app.S) fitLine();
    fitBoard();
    if (app.S) { renderTop(); renderTray(); placeSlots(); }
    if (app.panel) placeSheet();
    if (!$("toast").hidden) placeToast();
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
    const st = $("stage"), dpr = window.devicePixelRatio || 1, BD = document.body, G = L.stageGapPx;
    // v4 M5: in portrait above the short frames, three queue rows unless this board would then be under minCellCss (two
    // rows, with the compact bar). Two rows also take a smaller gap round the frame (stageGapPx[2]).
    // Critics 2 fix (V1): a coached level tries, in order, three rows with the coach's band above the board, two rows with
    // the band, then the top bar (three rows again when the board keeps minCellCss with them); every try keeps minCellCss.
    BD.classList.remove("tight"); // Land 1: measured with the full chrome first (below)
    let mode = app.coached && app.screen === "play" ? (app.wide ? "side" : "above") : "";
    const res = coachH() + 6, room = () => [st.clientWidth - G[0], st.clientHeight - (app.rows < L.queueRows ? G[2] : G[1])];
    const cellAt = (cut) => { const [a, b] = room(); return app.V.fitCs(a, b - cut, dpr); }, rowsTo = (k) => { if (app.rows !== k) { setRows(k); renderTray(); } };
    if (!app.wide && app.S && window.innerHeight > L.shortRowsMaxH) {
      rowsTo(L.queueRows); const three = cellAt(0) >= L.minCellCss;
      if (mode === "above" && !(three && cellAt(res) >= L.minCellCss)) { rowsTo(L.queueRowsShort); if (cellAt(res) < L.minCellCss) { mode = "top"; if (three) rowsTo(L.queueRows); } }
      else if (!three) rowsTo(L.queueRowsShort);
    } else if (mode === "above" && cellAt(res) < L.minCellCss) mode = "top";
    // Land 1: a portrait phone too tall for the short rules (375x667) whose board still falls under minCellCss with two
    // rows (the lands' 46-row pictures) takes the short phone's compact chrome (style.css body.tight), as 360x640 does.
    if (!app.wide && app.screen === "play" && cellAt(mode === "above" ? res : 0) < L.minCellCss) { BD.classList.add("tight"); if (mode === "above" && cellAt(res) < L.minCellCss) mode = "top"; }
    const [w, h0] = room();
    app.coachMode = mode; BD.classList.toggle("coached", !!mode); BD.classList.toggle("coach-above", mode === "above"); BD.classList.toggle("coach-top", mode === "top");
    const h = h0 - (mode === "above" ? res : 0);
    if (w > 0 && h > 0) app.V.layout(w, h, dpr);
    if (app.wide) { const cw = parseFloat($("board").style.width) || 0; if (cw > 0) r.setProperty("--stage-w", Math.ceil(cw + 16) + "px"); r.setProperty("--blk-h", $("frame").offsetHeight + "px"); } // the side column is the board's height (M10)
    sizePowers();
    if (app.coach && !$("coach").hidden) { placeCoach(); fitCoach(); placeHand(app.focusEl); }
    placeSlots();
  }
  function setRows(k) { app.rows = k; document.body.classList.toggle("rows2", k < app.cfg.layout.queueRows); }
  // v4 M5: on a wide screen (not short) the bar fills the side column's foot. Its badges take the larger of two fits to
  // the foot's free height and width: a row of four, or 2 x 2 once the foot is layout.pwGrid CSS px tall (each with its
  // name below; layout.pwFit: header, padding, name and gap px, and the badge's min and max).
  // Critics 2 fix (m5): a short landscape screen's panel (its height is the column's foot) fits its badges too, taking
  // the biggest of: a row with the coins beside it, a row under the coins (.head), or 2 x 2 beside them (.grid). Its
  // padding, gaps and the coins pill are read from the page.
  function sizePowers() {
    const P = $("powers"), F = app.cfg.layout.pwFit, wideFoot = app.wide && !document.body.classList.contains("short");
    const n = Math.max(1, app.pws.filter((b) => !b.hidden).length), c2 = Math.ceil(n / 2); // v5 R1: the badges shown (1-5); a 2-row grid's columns
    P.style.setProperty("--pw-n", n); P.style.setProperty("--pw-c", c2);
    P.classList.remove("grid", "head"); P.style.removeProperty("--pw-d"); if (!app.wide) return;
    if (!wideFoot) {
      const cs = getComputedStyle(P), px = (k) => parseFloat(cs[k]) || 0, gx = px("columnGap"), co = $("pw-coins"), h = P.clientHeight - px("paddingTop") - px("paddingBottom"), w = P.clientWidth - px("paddingLeft") - px("paddingRight");
      const fits = [["", Math.min(h, (w - co.offsetWidth - n * gx) / n)], ["head", Math.min(h - co.offsetHeight - F.rowGap, (w - (n - 1) * gx) / n)], ["grid", Math.min((h - F.rowGap) / 2, (w - co.offsetWidth - c2 * gx) / c2)]];
      let best = fits[0]; for (const q of fits) if (q[1] > best[1] + 1) best = q;
      if (best[0]) P.classList.add(best[0]); P.style.setProperty("--pw-d", Math.floor(Math.min(F.max, best[1])) + "px");
      return;
    }
    const h = P.clientHeight, w = P.clientWidth - F.padX, fix = F.padTop + F.head + F.padBottom;
    const row = Math.min(w / n - F.gapX, h - fix - F.name), grid = Math.min(w / c2 - F.gapX, (h - fix - F.rowGap) / 2 - F.name), two = n > 1 && h >= app.cfg.layout.pwGrid && grid > row;
    P.classList.toggle("grid", two); P.style.setProperty("--pw-d", Math.floor(Math.max(F.min, Math.min(F.max, two ? grid : row))) + "px");
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
    if (app.panel === "win") {
      // Critics 2 fix: a Gallery win's picture shrinks to the room (from the screen's or the column's top), or goes.
      let hh = natural(); const top0 = app.wide ? sd.top : A.top;
      const pic = $("p-pic"), pc = pic.firstElementChild;
      if (pic.dataset.on) { pic.hidden = false; picSize(1e9); hh = natural(); if (hh > foot - top0 && !picSize(parseFloat(pc.style.height) - (hh - (foot - top0)))) pic.hidden = true; hh = natural(); stagePic(pic.hidden); }
      // Wide (m8): the sheet is the rail's height, or its content's when that is taller, from the rail's top (the bar
      // under it stays in view); else the whole rail to the foot, as before.
      if (app.wide) { const want = Math.max(hh, rl.height), t = Math.max(top0, Math.min(rl.top, foot - want)); st.top = t - A.top + "px"; st.bottom = A.bottom - Math.min(foot, t + want) + "px"; return; }
      st.top = Math.min(rl.top, foot - hh) - A.top + "px"; return;
    }
    let hh = natural(); const room = foot - lw.bottom - gap;
    if (hh > room) { P.classList.add("tight"); hh = natural(); }
    if (hh <= room) { st.top = lw.bottom + gap - A.top + "px"; if (app.wide) st.bottom = A.bottom - Math.min(foot, Math.max(lw.bottom + gap + hh, rl.bottom)) + "px"; return; } // v4.3 fix (m5): wide: its content's height (down to the tray's foot, so no queue row peeks out under it)
    P.classList.add("float"); st.top = "auto"; st.bottom = A.bottom - lw.top + gap + "px";
  }
  // v5.3: the home's painting (index.html's <picture>: art/home-tall.jpg on an upright screen, home-wide.jpg otherwise)
  // covers #title's own box, never the window (the old pixel scene was sized to the window, so on a medium-wide window,
  // where the home is a phone-width column, the castle drifted right and was cut off). --art-x slides the image so the
  // castle sits as near the box's centre as the cover allows (config title.art).
  function homeArt() {
    const T = app.cfg.title.art, img = $("title-art").querySelector("img"), b = $("title").getBoundingClientRect(), src = img.currentSrc || "";
    const k = /home-tall/.test(src) ? "tall" : /home-wide/.test(src) ? "wide" : window.matchMedia("(orientation: portrait)").matches ? "tall" : "wide", A = T[k];
    const s = Math.max(b.width / A.w, b.height / A.h), rw = A.w * s, slack = b.width - rw, off = Math.max(slack, Math.min(0, b.width / 2 - A.castleX * rw));
    const castle = b.left + off + A.castleX * rw, cx = b.left + b.width / 2;
    return { k, px: slack < -0.5 ? off / slack : 0.5, py: T.posY, castle, cx, w: b.width, h: b.height, off: b.width ? (castle - cx) / b.width : 0, loaded: img.complete && img.naturalWidth > 0, on: $("title-art").classList.contains("on") };
  }
  function fitTitle() {
    if (!app.cfg) return;
    const g = homeArt(), st = $("title-art").style;
    st.setProperty("--art-x", (g.px * 100).toFixed(2) + "%"); st.setProperty("--art-y", g.py * 100 + "%");
  }
  // Fades the painting in once it has loaded (again after an orientation change swaps the source); the sky colours wait under it.
  function wireTitleArt() {
    const el = $("title-art"), img = el.querySelector("img"), on = () => { el.classList.add("on"); if (app.screen === "title") fitTitle(); };
    img.addEventListener("load", on);
    if (img.complete && img.naturalWidth > 0) on();
  }

  // ---- frame loop -----------------------------------------------------------------------------------------------------
  function step(dt) {
    app.clock += dt;
    const V = app.V; if (!V) return;
    V.clock = app.clock;
    if (app.screen === "title" && app.meta.lives) livesPill(); // v4 M5: the refill countdown (a DOM write only when it changes)
    if (app.hold >= 0) holdStep(); // v5.4: the reset hold
    if (app.held) return; // lands foundation: Settings open over a level holds it still
    if (app.screen !== "play" && app.toastT > 0 && app.clock >= app.toastT) hideToast(); // v5.4: a toast over the home or map goes too
    if (app.screen !== "play" || !app.B) return;
    if (app.panel === "win") countCoins();
    for (let k = 0; k < app.pwPop.length; k++) if (app.pwPop[k] > 0 && app.clock - app.pwPop[k] >= app.cfg.show.pwPopMs && app.clock - app.pwPop[k] < app.cfg.show.pwPopMs + dt) renderPowers(); // a badge's pop ends
    // The engine plays at show.pace x real time (x the speed button's 1x, 2x or 3x, or the victory march's pace, whichever
    // is faster); its log goes to the board every step.
    const S = app.S, sp = paceNow();
    app.et += dt * sp; S.advanceTo(app.et); V.t = app.et; V.sync(S, true);
    V.update(dt, sp);
    ended();
    if (app.unlockT > 0 && app.clock - app.unlockT >= app.cfg.show.unlockMs && app.clock - app.unlockT < app.cfg.show.unlockMs + dt) app.lineMoved = true; // the padlock's pop ends
    if (app.lineDirty) { judge(); renderTray(); renderLine(); coachStep(); } else if (app.lineMoved) renderLine(); else retCount();
    app.lineMoved = false;
    // The sheet waits until every sapper is home (v4.3: no cap; a board tap still skips the show).
    if (app.ending && !app.panel && !S.busy) {
      if (app.ending.won) { if (!V.gob.on) { V.goblin(true); cue("fanfare"); } else if (V.gob.done) showPanel(); }
      else if (app.endAt < 0) { app.endAt = app.clock + app.cfg.show.panelMs; V.shake(app.cfg.fx.failShake[0], app.cfg.fx.failShake[1]); }
      else if (app.clock >= app.endAt) showPanel();
    }
    if (app.toastT > 0 && app.clock >= app.toastT) hideToast();
    tipStep(); // v5 R1
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
  function lossPlan(id) { const e = app.byId.get(id) || app.entry; return e ? jamPlan(e, tagOf(e)) : null; } // v4.3: on the level's tag
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
    return { screen: app.screen, id: app.entry ? app.entry.id : null, n: app.entry ? app.entry.n : null, era: app.entry ? app.entry.era : null, tag: app.diff,
      status: !S ? null : S.status === E.WON ? "won" : S.status === E.FAILED ? "failed" : "playing", reason: S && S.status === E.FAILED ? S.reason : null,
      pixLeft: S ? S.pixLeft : null, cap: S ? S.cap : null, line, fronts, plays: S ? S.plays : 0, hits: S ? S.hits : 0, kills: S ? S.kills : 0,
      busy: S ? S.busy : false, out: S ? S.out : 0, runners: V ? V.live : 0, now: S ? S.now : 0, goblin: V ? V.gob.on && !V.gob.done : false,
      panel: app.panel, speed: app.speed, cb: app.cb, clock: Math.round(app.clock), cs: V ? V.cs : 0, done: Object.keys(app.save.data.done).length,
      refused: app.refused, march: app.march, pace: app.cfg ? paceNow() : 1, li: S ? Object.assign({}, readLine()) : null,
      open: S ? S.open : null, locked: S ? S.locked : 0, links: B ? B.nlinks : 0, hidden: S ? Array.from({ length: B.ncards }, (_, c) => S.hidden(c)).filter(Boolean).length : 0, debug: !!(app.entry && app.entry.debug), w: B ? B.w : 0, h: B ? B.h : 0 };
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
  // save is compared byte for byte at the end. Leaves the page on the level it was on (restarted). v4.3: every level on
  // its own tag (one stored order each), the tags on the map, the top bar and the report (no medals), a linked front
  // card waiting for its buried partner, a space freeing at its squad's last pickup while carriers walk home, the
  // Gallery opening one picture at a time (padlocked silhouettes), and the save in format 2.
  function selfTest() {
    const T0 = performance.now(), out = { pass: 0, fail: [], notes: {}, ms: 0 };
    const ok = (c, m) => { if (c) out.pass++; else out.fail.push(m); return !!c; };
    const was = { save: app.save, screen: app.screen, entry: app.entry, diff: app.diff, speed: app.speed, cb: app.cb, meta: app.meta, now: app.now, sfx: app.audio.sfx, music: app.audio.music };
    const key = app.cfg.save.key, snap = (() => { try { return was.save.store.getItem(key); } catch (e) { return "?"; } })();
    // v4.2 fix: a phone held sideways shows only the upright card, so that is all there is to check here; the game's own
    // checks run on an upright screen.
    const wasUp = app.upright;
    if (wasUp) { const r = $("upright").getBoundingClientRect();
      ok(app.paused && !$("upright").hidden && r.width >= innerWidth - 1 && r.height >= innerHeight - 1 && hitOK($("upright")) && uprightNeeded(innerWidth, innerHeight, coarse()), "upright: held sideways (" + innerWidth + "x" + innerHeight + ", touch) the upright card covers the screen and the game is paused");
      out.notes.upright = "held sideways: the card only (the game's checks run upright)"; out.ms = Math.round(performance.now() - T0); return out; }
    if (app.paused) resume();
    const ST = app.cfg.selfTest, SH = app.cfg.show, SPD = app.meta.speed.debugSpeeds; // v5 R1: the debug speeds
    // v4 M5: with meta (coins); v5 R1: every power-up already unlocked (no free uses), so the older checks see plain badges
    const scratch = () => { const sv = Save.open(Save.memoryStore(), key, app.order, app.gal.map((e) => e.id), app.meta); for (const id of E.POWERS) sv.data.got[id] = 1; return sv; };
    app.testing = true; Audio.hushed(app.audio, true); app.save = scratch(); setSpeed(SPD[0], false); setCb(false, false); app.allPw = true; // v5 R1: every power-up shown for the checks (the unlock checks use their own save)
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
    // v5 R3: scroll the journey map so el sits mid-view (a node off screen can't be hit).
    const jrTo = (el) => { const sc = $("jr"), r = el.getBoundingClientRect(), q = sc.getBoundingClientRect(); sc.scrollTop += r.top + r.height / 2 - (q.top + q.height / 2); };
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
    const rodClear = () => { landTiles(); const T = []; for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < app.rows; d++) { const el = tileOf(j, d); if (shown(el) && !el.classList.contains("empty")) T.push(el.getBoundingClientRect()); }
      const sb = app.rods.getBoundingClientRect(), inT = (x, y, b, e) => x > b.left + e && x < b.right - e && y > b.top + e && y < b.bottom - e;
      for (const g of app.rods.querySelectorAll("path")) { const L = g.getTotalLength(); if (L < 4) continue;
        const at = (u) => { const p = g.getPointAtLength(L * u); return [sb.left + p.x, sb.top + p.y]; }, e0 = at(0), e1 = at(1), own = T.filter((b) => inT(e0[0], e0[1], b, -1) || inT(e1[0], e1[1], b, -1));
        if (!own.length) return "a rod starts on no tile";
        for (let i = 1; i < 32; i++) { const [x, y] = at(i / 32); const hit = T.find((b) => own.indexOf(b) < 0 && inT(x, y, b, 3)); if (hit) return "a rod crosses a third tile at " + Math.round(x) + "," + Math.round(y); } }
      return true; };
    try {
      // 1. Stored winning orders, every level on its own tag (v4.3: one order each), played patiently through the play
      // entry point.
      let wins = 0, total = 0;
      for (const e of app.levels) {
        const d = tagOf(e); total++; startLevel(e.id);
        const ord = winOf(e);
        const good = !!ord && patient(ord); settleNow();
        if (ok(good && app.S.status === E.WON && app.diff === d && app.S.cap === rulesOf(d).hold + app.S.extra, e.id + " " + d + ": stored order wins played patiently through play() on its tag")) wins++;
        ok(dispMatches() && allHome(), e.id + " " + d + ": the board display matches the rules and every sapper is home");
      }
      out.notes.wins = wins + "/" + total;
      // 1b. The same on real ticks (SP.tick's 16 ms steps, no skip), on a sample: its time at 1x.
      for (const id of ST.tickSample) {
        const e = app.byId.get(id); if (!e) continue;
        startLevel(id); let t = 0;
        for (const ch of winOf(e)) { if (!playCol(+ch)) break; t += tickQuiet(ST.tickCapMs); }
        ok(app.S.status === E.WON && dispMatches() && allHome(), id + ": the stored order wins on real ticks, tap after tap once the squads are home");
        out.notes["ticked_" + id] = Math.round(t / 1000) + " s";
      }
      // 2. Only what can be reached goes: level 3's coached squad (more sappers than blocks of its colour in reach) sends
      // what is in reach, the rest wait at the space. v4.1: the colour is the coach's card (config teach).
      if (app.byId.has("e1-03")) {
        const cm = ((app.cfg.teach || {})["e1-03"] || [{}])[0].card | 0;
        startLevel("e1-03", "normal"); const j = frontOf(cm), reach = app.S.reachable(cm);
        if (ok(j >= 0 && app.B.cardN[app.S.front(j)] > reach, "dispatch: level 3 opens with more " + mat(cm).crew + " than blocks of theirs in reach")) {
          const TT = app.cfg.v3.time, early = TT.yardMs + TT.tileMs + TT.biteMs - 20; // v4.1: before the first pop opens more of the colour
          playCol(j); for (let t = 0; t < early; t += 16) step(16);
          const s = app.S.order(app.ord)[0];
          ok(app.S.sent <= reach && app.S.spW[s] > 0 && app.V.runners().live === app.S.out, "dispatch: " + reach + " in reach, " + app.S.sent + " go before the first pop, " + app.S.spW[s] + " wait at the space; one runner per sapper out");
        }
      }
      // 3. Three rapid taps: three squads out at once, each with runners alive; no play completes early.
      { const reachCols = (S, B) => { const o = []; for (let j = 0; j < E.NCOL; j++) { const f = S.front(j); if (f >= 0 && S.reachable(B.cardM[f]) > 0) o.push(j); } return o; };
        const pref = app.byId.get(ST.overlapLevel), pool = (pref ? [pref] : []).concat(app.levels.slice().reverse());
        const e = pool.find((x) => { const B = E.compile(x.L); return reachCols(E.sim(B, rulesOf(tagOf(x))), B).length >= 3; }) || app.levels[0];
        startLevel(e.id, "normal");
        const cols = reachCols(app.S, app.B).slice(0, 3);
        for (const j of cols) { playCol(j); step(16); step(16); }
        for (let t = 0; t < 700; t += 16) step(16);
        const R = app.V.runners(), spaces = R.bySpace.filter((k) => k > 0).length;
        ok(cols.length === 3 && app.S.lineLen === 3 && spaces === 3 && R.live >= 3, "overlap: three rapid taps leave three squads out, runners alive in all three (" + JSON.stringify(R.bySpace) + ")");
        out.notes.overlap = e.id + " cols " + cols.join("") + " runners " + R.live;
        // v4.1: every runner left its colour's crate in the yard and came up through the entry square at the bottom; every
        // Siege level and Gallery picture is a picture board (the frame open ground, the entry its bottom row's middle).
        const q = app.V.entryInfo(), notPic = app.levels.concat(app.gal).filter((x) => !E.compile(x.L).pic).map((x) => x.id);
        ok(q.live > 0 && q.yard === q.live && q.crate === q.live && q.entry === q.live, "bottom entry: " + e.id + "'s runners leave their crates in the yard and come up through the entry square (" + JSON.stringify(q) + ")");
        ok(!notPic.length && !app.V.idleC.length, "bottom entry: every level is a picture board, no idle sappers (" + (notPic.join(",") || app.levels.length + app.gal.length + " boards") + ")"); }
      // 4. A jam loss on a late level: seeded patient taps until every space holds a squad that can't reach a block; the
      // line jams at rest, one jam cue, the sheet names the crews, Retry is primary. Then a Retry mid-show clears every runner.
      let jp = null; for (const e of app.levels) { if (e.L.band !== "hard" && e.L.band !== "hardest") continue; const p = jamPlan(e, tagOf(e)); if (p) { jp = { e, p }; break; } }
      if (ok(!!jp, "jam: found a patient order that jams a late level")) {
        startLevel(jp.e.id, "normal"); const j0 = app.cues.jam | 0; patient(jp.p.prefix);
        ok(app.S.status === E.FAILED && app.S.reason === "jam" && app.ending && app.ending.reason === "jam" && app.S.lineLen === app.S.cap, "jam: the line fills with squads that can't reach a block and jams at rest");
        ok(app.S.order(app.ord).every((q) => app.S.stuck(q)) && (app.cues.jam | 0) === j0 + 1, "jam: every squad in the line reads stuck; one jam cue");
        let at = null; for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) { step(16); if (app.panel && !at) at = { busy: app.S.busy, ms: app.clock - app.endT }; }
        const pl = $("p-line").getAttribute("aria-label") || "", chipsOK = chipCheck();
        ok(app.panel === "fail" && /^Line jammed: .+ can't reach a block\.$/.test(pl) && pl.indexOf(app.ending.crews[0]) >= 0 && hitOK($("p-primary")) && $("p-primary").querySelector(".pl").textContent === "Retry", "jam: the sheet's label names the jammed crews (" + pl + "), Retry is primary and hittable");
        ok(chipsOK === true, "jam: the sheet shows one colour chip with its count per jammed squad, no crew names (" + chipsOK + ")");
        const sl = sheetClear(); ok(sl === true, "jam: the fail sheet leaves the jammed line in view (" + sl + ")");
        out.notes.jam = jp.e.id + " '" + jp.p.prefix + "' (sheet after " + (at ? Math.round(at.ms) : "?") + " ms)";
        { const lb = $("p-secondary").textContent, hit = hitOK($("p-secondary")), x2 = $("p-x2").hidden; $("p-secondary").click(); ok(lb === LY.toMap && hit && x2 && app.screen === "map", "v5.1: the fail sheet's second button reads '" + lb + "' like the win's and goes back to the map; Retry stays its main button"); }
      }
      { const e = app.byId.get(ST.overlapLevel) || app.levels[app.levels.length - 1]; startLevel(e.id, "normal"); fillLine(); step(16); step(16);
        const liveBefore = app.V.live; retry();
        ok(liveBefore > 0 && app.V.live === 0 && !app.S.busy && app.S.plays === 0 && app.S.lineLen === 0, "retry: mid-show, every runner goes and the level restarts (" + liveBefore + " runners cleared)"); }
      // 5. Key and gate: the gate stays iron until its key pops; then the lock drops, the bars fall, the board shakes.
      const ge = app.levels.find((e) => e.L.gates && e.L.gates.length);
      if (ok(!!ge, "gate: a level with a gate exists")) {
        startLevel(ge.id); const B = app.B, ord = winOf(ge), gc = B.gateCells[0]; let seen = null, before = true;
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
      // 6. An archer hit on a level of every tag (v5 R1: archers never kill; the hit sapper is sent back to its space).
      for (const d of TAGS) {
        if (!app.levels.some((e) => tagOf(e) === d && e.L.towers && e.L.towers.length)) continue; // v5 R1: no Extreme levels until R2
        const lethal = false, pred = (S) => S.hits > 0 && S.status === E.PLAYING; let found = null;
        for (const e of app.levels) { if (tagOf(e) !== d || !(e.L.towers && e.L.towers.length)) continue; const o = search(e, d, pred, ST.searchTries, ST.searchSeed); if (o) { found = { e, o }; break; } }
        if (!ok(!!found, "archers " + d + ": found an order with a hit")) continue;
        startLevel(found.e.id); patient(found.o.slice(0, -1)); playCol(found.o.charCodeAt(found.o.length - 1) - 48);
        let arrow = false, struck = null, live = 0;
        for (let t = 0; t < ST.tickCapMs && !struck; t += 16) { step(16); const h = app.V.hitInfo(); if (h.live) live = h.kind; if (h.arrows) arrow = true; if (h.struck) struck = h; }
        ok(live === (lethal ? 2 : 1) && arrow && !!struck && struck.label, "archers " + d + ": a " + (lethal ? "doomed" : "knocked-back") + " runner, the arrow flies and strikes, the label rises (" + JSON.stringify(struck) + ")");
        ok(lethal ? app.S.kills > 0 : app.S.hits > 0 && app.S.kills === 0, "archers " + d + ": the engine records the " + (lethal ? "kill" : "hit") + " when the arrow lands");
        { const j = app.cards.findIndex((b, k) => app.S.front(k) >= 0), p0 = app.S.plays, busy = app.S.busy;
          ok(busy && (j < 0 || app.S.lineLen >= app.S.cap || (playCol(j) && app.S.plays === p0 + 1)), "archers " + d + ": a tap mid-show still plays (input never waits on the show)"); }
        out.notes["archer_" + d] = found.e.id + " '" + found.o + "'";
      }
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
      // 7b. Stuck and working on a real level (v4.3: a Normal one, 5 spaces): 2 squads with nothing in reach (hatched,
      // locked) and 2 out working (gold rim, walking marker); the head counts them. Then the near jam: 3 stuck, 1 working, 1
      // free warns.
      { let got = null, near = null;
        for (const e of app.levels) { if (e.n < 16 || tagOf(e) !== "normal") continue; startLevel(e.id); const tp = stageLine(2, 2); if (tp) { step(16); got = { e, tp, li: Object.assign({}, readLine()) }; break; } } // v4.3: a Normal level (5 spaces)
        if (ok(!!got, "stuck/working: a level whose fronts give 2 stuck and 2 working squads")) {
          const st = app.slots.filter((q) => q.classList.contains("stuck")).length, wk = app.slots.filter((q) => q.classList.contains("work") && !q.classList.contains("stuck")).length;
          ok(got.li.stuck === 2 && got.li.work === 2 && got.li.free === 1 && !got.li.near && st === 2 && wk === 2 && /2 stuck/.test($("line-cnt").textContent) && /2 working/.test($("line-cnt").textContent) && /1 free/.test($("line-cnt").textContent), "stuck/working: two hatched stuck spaces, two working, the head reads '" + $("line-cnt").textContent + "' (" + got.e.id + " '" + got.tp + "')"); }
        for (const e of app.levels) { if (e.n < 16 || tagOf(e) !== "normal") continue; startLevel(e.id); const tp = stageLine(3, 1); if (tp) { step(16); near = { e, tp, li: Object.assign({}, readLine()) }; break; } }
        if (ok(!!near, "near jam: a level whose fronts give 3 stuck and 1 working")) {
          const last = app.slots.filter((q) => q.classList.contains("last")).length;
          ok(near.li.near && $("line-wrap").classList.contains("near") && $("line-lab").textContent === LY.nearText && last === 1, "near jam: every squad but one stuck and one space left: '" + LY.nearText + "', the last space pulses (" + near.e.id + " '" + near.tp + "')"); } }
      // 7c. The jam on a level built for it (selfTest.jamLevel): four inner colours wait stuck (the near-jam warning, the
      // warn cue on that tap), the fifth fills the line and it jams at rest; no victory march; the sheet names the crews.
      { const e = fx("jamLevel"); startLevel(e.id, "normal"); const w0 = app.cues.warn | 0; patient("1234");
        ok(readLine().near && readLine().stuck === 4 && app.slots.filter((q) => q.classList.contains("stuck")).length === 4 && app.slots.some((q) => q.classList.contains("last")) && (app.cues.warn | 0) === w0 + 1, "jam level: four stuck squads, one space left: the near-jam warning and one warn cue");
        playCol(0); settleNow();
        ok(app.S.status === E.FAILED && app.S.reason === "jam" && !app.march, "jam level: the fifth stuck squad jams the line at rest; the pace never switches to the victory march");
        for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) step(16);
        ok(app.panel === "fail" && /^Line jammed: .+ and 2 more can't reach a block\.$/.test($("p-line").getAttribute("aria-label")) && chipCheck() === true && $("p-line").querySelectorAll(".chip").length === 5, "jam level: the sheet's label names three crews and 'and 2 more' (" + $("p-line").getAttribute("aria-label") + "); five chips show");
        startLevel(e.id, "normal"); patient("001234"); settleNow();
        ok(app.S.status === E.WON, "jam level: the ring's crew first wins (the level is fair)");
        const s2 = fx("stuckLevel"); startLevel(s2.id, "normal"); playCol(0);
        ok(!app.march, "stuck level: the tray is empty but the line will end stuck: no victory march"); settleNow();
        ok(app.S.status === E.FAILED && app.S.reason === "stuck" && !app.march, "stuck level: it fails stuck, the pace never switched"); }
      // 8. Determinism on ticks (a hidden tab driven by SP.tick): the same taps at the same ticks give the same state.
      { const e = app.byId.get(ST.overlapLevel) || app.levels[40], sig = () => { startLevel(e.id); const o = winOf(e); for (let i = 0; i < 8 && i < o.length; i++) { playCol(+o[i]); for (let k = 0; k < 37; k++) step(16); } for (let k = 0; k < 90; k++) step(16); return Array.from(app.S.save()).join(",") + "|" + app.V.live + "|" + Array.from(app.V.disp).join(""); };
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
      // 11. The win on ticks: the last blocks fall; the keep comes down only once every sapper is home; the report shows
      // the level's tag and no medals (v4.3).
      delete app.save.data.done[app.levels[0].id];
      const w1 = winOf(app.levels[0]), col0 = app.cues.collapse | 0, jg0 = app.cues.jingle | 0; let falls = 0, gobBusy = null;
      patient(w1.slice(0, -1)); playCol(w1.charCodeAt(w1.length - 1) - 48);
      for (let t = 0; t < ST.tickCapMs && !app.V.gob.on; t += 16) { step(16); falls = Math.max(falls, app.V.fxInfo().falls); if (app.V.gob.on) gobBusy = app.S.busy; }
      step(16); const kf = app.V.fxInfo();
      ok(falls > 0 && kf.keep && kf.shaking && app.V.gob.on && gobBusy === false && (app.cues.collapse | 0) === col0 + 1 && (app.cues.fanfare | 0) > 0, "win: the last blocks fall, the keep comes down once every sapper is home, one collapse, the fanfare");
      tick(8000);
      ok(app.panel === "win" && hitOK($("p-primary")) && $("p-primary").querySelector(".pl").textContent === LY.toMap, "hit: the win panel's '" + LY.toMap + "'");
      ok((app.cues.jingle | 0) === jg0 + 1, "music (v5.2): the win sheet plays the jingle once (" + ((app.cues.jingle | 0) - jg0) + ")");
      { const w = sheetClear(true); ok(w === true, "win: the sheet covers the whole holding line or none of it (" + w + ")"); }
      { const t0 = tagOf(app.levels[0]), want = (LY.tags || {})[t0] || "";
        ok(!document.querySelector(".medal") && !$("p-medals") && $("p-tag").textContent === want && $("p-tag").hidden === !want && $("p-tag").classList.contains("tag-" + t0) && /cleared\.$/.test($("p-line").textContent), "win (v4.3): the report shows the level's tag (" + (want || "Normal, unmarked") + ") and no medals; '" + $("p-line").textContent + "'"); }
      // v5.1 (playtesters, 2026-10-06): the win sheet's main button goes back to the journey map, not on to the next level:
      // the map opens with the next level's node (the current one) in view and pulsing (none under reduced motion); the
      // AD HOOK's x2 button is not rendered (config meta.double.on is false).
      { const x2off = app.meta.double.on === false && $("p-x2").hidden && !shown($("p-x2")); $("p-primary").click();
        const f = JN.focus(app.save.data, app.order), ne = f && f !== "tail" ? app.byId.get(f) : null, nd = ne ? ne.node : app.jr.tail && !app.jr.tail.b.hidden ? app.jr.tail.b : null, q = $("jr").getBoundingClientRect(), r = nd ? nd.getBoundingClientRect() : null; // the next level, or (all cleared) the long tail's node
        const inView = !!r && r.top >= q.top && r.bottom <= q.bottom && r.left >= q.left && r.right <= q.right, pulse = !!nd && nd.querySelector(".bd, .qf").getAnimations().length > 0;
        const noTail = f === "tail" && !nd; // campaign v6: every level cleared and no long-tail picture (the castle has none): no next node to show
        ok(x2off && app.screen === "map" && (noTail || (!!nd && (!ne || nd.classList.contains("cur")) && inView && (app.V.calm ? !pulse : pulse))) && hitOK($("map-play")),
          "v5.1: off, the x2 button is not rendered; the win's '" + LY.toMap + "' opens the map with the next node (" + (ne ? "level " + ne.n : noTail ? "none: every level cleared, no long tail" : f) + ") in view" + (app.V.calm ? " (reduced motion: no pulse)" : ", pulsing") + "; map Play hittable"); }
      // 12. Pause: nothing moves and the sheet takes the tap; one tap resumes with no jump in time and no card played.
      startLevel(app.levels[0].id, "normal");
      pause(); const pc = app.clock; advance(1000); advance(1600);
      ok(app.paused && app.clock === pc && !$("pause").hidden && hitOK($("pause")) && !hitOK(app.cards[0]), "pause: the clock stops and the Paused sheet covers the cards");
      $("pause").click(); advance(5000); advance(5016);
      ok(!app.paused && $("pause").hidden && app.clock - pc <= 32 && app.S.plays === 0, "pause: one tap resumes, the clock moves on without a jump, no card played");
      app.lastT = 0;
      // 12b. v4.2 fix: phones play upright (B1) and boards are never turned (V1).
      { const U = app.cfg.layout.upright, cases = [[667, 375, true, true], [740, 360, true, true], [812, 375, true, true], [844, 390, true, true], [375, 812, true, false], [1024, 768, true, false], [900, 500, false, false], [1280, 720, false, false], [400, 600, false, false], [667, 375, false, false]];
        const bad = cases.filter(([w, h, c, want]) => uprightNeeded(w, h, c) !== want);
        ok(!bad.length, "upright: a touch screen held sideways under " + U.maxH + " px tall asks to be turned upright; a desktop window, a portal's landscape iframe and a tablet never do" + (bad.length ? " (" + JSON.stringify(bad) + ")" : ""));
        ok(!uprightNeeded(innerWidth, innerHeight, coarse()) && $("upright").hidden, "upright: no card here (" + innerWidth + "x" + innerHeight + (coarse() ? ", touch" : "") + ")");
        startLevel(app.levels[0].id, "normal"); setUpright(true); const uc = app.clock; advance(1000); advance(1600);
        const held = app.paused && app.clock === uc && !$("upright").hidden && hitOK($("upright")) && !hitOK(app.cards[0]);
        resume(); $("pause").click(); const stayed = app.paused; // nothing resumes behind the card
        setUpright(false); advance(5000); advance(5016);
        ok(held && stayed && !app.paused && $("upright").hidden && $("pause").hidden && app.clock - uc <= 32 && app.S.plays === 0, "upright: the card pauses (the clock stops, it covers the cards, nothing resumes behind it) and turning upright resumes with no jump and no card played");
        app.lastT = 0;
        const turned = [];
        for (const id of [resolve(64), resolve(100), (app.gal.find((e) => e.L.kind === "painting") || app.gal[0] || {}).id].filter(Boolean)) {
          startLevel(id, "normal"); const c = $("board"), up = Math.abs(c.width / c.height - app.B.w / (app.B.h + app.V.Y)) < 0.01; if (!up) turned.push(id); }
        ok(!turned.length, "upright: boards are never turned: the canvas has the board's own shape here (" + (turned.join(", ") || "64, 100 and a painting") + ")"); }
      // v5 R4 fix (S4, m3): a boss's moment (config boss): its name in the top bar and, on the win, its own title and line
      // under the crown and its rays; the sheet's buttons stay hittable.
      for (const id of Object.keys(app.cfg.boss || {})) { const e = app.byId.get(id), BS = app.cfg.boss[id]; if (id === "note" || !ok(!!e, "boss " + id + ": the level exists")) continue;
        startLevel(id); const nm = $("lvl-name").textContent; patient(winOf(e)); settleNow(); tick(9000); const ln = $("p-line").textContent;
        ok(nm === BS.name && app.panel === "win" && $("p-title").textContent === BS.winTitle && (ln === BS.win || ln === BS.winAgain) && shown($("p-crown")) && hitOK($("p-primary")) && hitOK($("p-secondary")),
          "boss " + id + ": the top bar reads '" + nm + "'; the win sheet '" + $("p-title").textContent + "', '" + ln + "', the crown shown, its buttons hittable");
        { const lb = $("p-primary").querySelector(".pl").textContent; $("p-primary").click(); ok(lb === LY.toMap && app.screen === "map", "v5.1: the boss's win ('" + BS.winTitle + "') goes back to the map like every win ('" + lb + "')"); }
        startLevel(app.levels[0].id); ok($("p-crown").hidden || $("panel").hidden, "boss " + id + ": the crown is the boss's alone"); }
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
        let clear = true; for (const ch of winOf(e)) { playCol(+ch); settleNow(); const cs = coachState(); if (cs.i >= 0) { if (cs.i < last) mono = false; last = cs.i; seen.add(cs.i); if (cs.on && clear === true) clear = cs.fits ? coachClear() : "'" + cs.text + "' overflows its box"; } }
        ok(clear === true, id + ": at every step of the stored order the coach covers no board and the arrow no count (" + clear + ")");
        ok(mono && !coachState().on && app.S.status === E.WON, id + ": on the stored order the coach only moves forward (" + Array.from(seen).join(",") + ") and is gone at the win");
        startLevel(id, "normal"); const saw = new Set();
        for (let g = 0; g <= app.B.ncards && app.S.status === E.PLAYING; g++) {
          const cs = coachState(); if (cs.on) saw.add(cs.i);
          let jj = app.focusEl ? app.cards.indexOf(app.focusEl) : -1; if (jj < 0 || app.S.front(jj) < 0 || app.S.refused(jj)) jj = app.cards.findIndex((b, k) => app.S.front(k) >= 0 && !app.S.refused(k));
          playCol(jj); settleNow();
        }
        const lesson = e.L.source === "teaching"; // v5 R2: a coached Hard level (the first locks) need not be won by the naive follower
        ok(saw.size === steps.length && (app.S.status === E.WON || !lesson) && !coachState().on, id + ": following the arrow shows all " + steps.length + " steps (" + Array.from(saw).join(",") + ")" + (lesson ? " and wins" : ""));
        out.notes["coach_" + id] = Array.from(seen).join(",") + " / " + Array.from(saw).join(",");
      }
      if (app.byId.has("e1-02")) { const cm = app.cfg.teach["e1-02"][0].card; startLevel("e1-02", "normal"); playCol(frontOf(cm)); settleNow(); const cs = coachState(); ok(cs.i === 1 && app.focusEl === $("line"), "coach e1-02: the walled-in " + mat(cm).crew + " wait in their space, the arrow moves to the holding line"); }
      // v4 M3: the twists' lessons point at their twist from the first tap. v5 R2 (the re-laid lessons): the bridge over
      // the moat wears the ring (25), a ? tile (100), a linked front card (75), the padlocked space with a ring on its key
      // (87, the first key lock) or with its colour's card (53, the first colour lock).
      if (app.byId.has("e2-25")) { startLevel("e2-25", "normal"); ok(app.V.focus.on && coachState().ring && app.B.a0[(Math.floor(app.V.focus.y) * app.B.w) + Math.floor(app.V.focus.x)] === E.DIRT, "coach e2-25: the bridge over the moat wears the ring"); }
      if (app.byId.has("e5-100")) { startLevel("e5-100", "normal"); const el = app.focusEl; ok(!!el && el.classList.contains("next") && el.classList.contains("mys"), "coach e5-100: the arrow points at a hidden ? squad (" + (el && el.className) + ")"); }
      if (app.byId.has("e4-75")) { startLevel("e4-75", "normal"); const j = app.cards.indexOf(app.focusEl); ok(j >= 0 && app.S.partner(app.S.front(j)) >= 0 && app.rods.innerHTML.indexOf("<path") >= 0, "coach e4-75: the arrow points at a linked front card, its rod drawn"); }
      if (app.byId.has("e4-87")) { startLevel("e4-87", "normal"); ok(app.focusEl === app.slots[app.S.cap - 1] && app.focusEl.classList.contains("locked") && app.V.focus.on && app.S.locked === 1, "coach e4-87: the arrow points at the padlocked space and the key wears the ring"); }
      if (app.byId.has("e3-53")) { startLevel("e3-53", "normal"); const st = app.cfg.teach["e3-53"][0], j = frontOf(st.card); ok(app.S.locked === 1 && app.B.lockMat === st.card && (j >= 0 ? app.focusEl === app.cards[j] : app.focusEl === app.slots[app.S.cap - 1]), "coach e3-53: a colour lock; the arrow points at its colour's card (or the padlocked space)"); }
      // 13b. Victory march: on a stored winning line the pace stays 1x until the tray empties, then plays at
      // show.victoryPace; the final state (board, every sapper's times, status) is identical to the same taps at 1x; with
      // 2x or 3x on, the faster pace stays.
      { const e = app.byId.get("e1-03") || app.levels[0], o = winOf(e), vp = SH.victoryPace;
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
      { const e = app.byId.get(ST.queueLevel) || app.levels[Math.min(39, app.levels.length - 1)]; let RW = LY.queueRows; // v4 M5: app.rows once the level is fitted
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
        startLevel(e.id, "normal"); RW = app.rows;
        const S = app.S, want = app.cards.reduce((a, b, j) => a + Math.min(RW, app.B.colLen[j]), 0), q0 = qCheck();
        const hs = [], op = [], fc = [], j0 = Math.max(0, app.cards.findIndex((b, j) => S.card(j, RW - 1) >= 0));
        for (let d = 0; d < RW; d++) { const el = tileOf(j0, d); hs.push(el.getBoundingClientRect().height); op.push(+getComputedStyle(el).opacity); fc.push(el.style.getPropertyValue("--fc") === (d ? app.fadeC[d][app.B.cardM[S.card(j0, d)]] : mat(app.B.cardM[S.card(j0, 0)]).c)); }
        const off = app.nexts.every((nx) => nx.slice(RW - 1).every((x) => getComputedStyle(x).display === "none")), rowsOK = RW === LY.queueRows ? !document.body.classList.contains("rows2") : RW === LY.queueRowsShort && document.body.classList.contains("rows2") && off;
        ok(q0 === want && rowsOK && hs[1] < hs[0] && (RW < 3 || hs[2] < hs[1]) && op.every((o) => o === 1) && fc.every(Boolean), "queue: " + RW + " rows per column stepping down (" + hs.map((h) => h.toFixed(1)).join(", ") + " px), all at full opacity, the rows behind faded toward the tray (layout.fade); " + q0 + " tiles match the engine (" + e.id + ")");
        let moved = true, taps = 0; const o = winOf(e);
        for (let i = 0; i < o.length && app.S.status === E.PLAYING; i++) { playCol(+o[i]); settleNow(); taps++; const q = qCheck(); if (typeof q === "string") { moved = q + " after tap " + taps; break; } }
        ok(moved === true && S.status === E.WON, "queue: the rows move up with the engine on every tap of the stored order (" + (moved === true ? taps + " taps" : moved) + ")"); }
      // 16. Colour-blind mode (v4 M1): off by default, every block a plain stud but the iron gate (bars) and the gilt key
      // (its glyph). The title's toggle (a real click) turns it on: every other material's stud gains its mark, the gate and
      // key are unchanged, the queue tiles show their glyph, and the save keeps it (read back through sanitize). The map's
      // toggle turns it off again.
      { startLevel(ST.queueLevel && app.byId.has(ST.queueLevel) ? ST.queueLevel : app.levels[0].id, "normal");
        const off = app.V.studInfo(), gl = () => { const el = app.cards.find((b) => !b.classList.contains("empty")), g = el && el.querySelector(".gl"), r = g && g.getBoundingClientRect(); return !!g && getComputedStyle(g).display !== "none" && r.width > 0 && el.style.getPropertyValue("--gl").indexOf("url(") === 0; };
        ok(!app.cb && !off.cb && off.ink[E.IRON] > 0 && off.ink[E.GILT] > 0 && !gl(), "colour-blind off (the default): the gate keeps its bars (" + off.ink[E.IRON] + " px) and the key its glyph (" + off.ink[E.GILT] + " px); no glyph on the tiles");
        showScreen("title"); $("btn-settings").click(); const tb = document.querySelector("#settings .tog-cb"), hit1 = hitOK(tb); tb.click(); $("set-close").click(); // v4 M5: the home's settings sheet
        showScreen("play"); const on = app.V.studInfo();
        let marked = 0; for (let m = 1; m < E.NMAT; m++) if (m !== E.IRON && m !== E.GILT && on.sum[m] !== off.sum[m] && on.ink[m] > off.ink[m]) marked++;
        const saved = app.save.data.settings.cb === true; app.save.write(); const reread = Save.open(app.save.store, key, app.order).data.settings.cb === true;
        ok(hit1 && app.cb && on.cb && tb.getAttribute("aria-pressed") === "true" && document.body.classList.contains("cb") && marked === E.NMAT - 3 && on.sum[E.IRON] === off.sum[E.IRON] && on.sum[E.GILT] === off.sum[E.GILT] && gl(),
          "colour-blind on (the settings sheet's toggle): all " + marked + " other materials wear their mark, the gate and key are unchanged, the tiles show their glyph");
        ok(saved && reread, "colour-blind: the save keeps it and reads it back (sanitized)");
        const junk = Save.sanitize({ settings: { cb: "yes", speed: 7, fast: true } }, app.order), junk2 = Save.sanitize({ settings: { cb: true, speed: 3 } }, app.order);
        ok(junk.settings.cb === false && junk.settings.speed === 2 && junk2.settings.cb === true && junk2.settings.speed === 3, "save: a bad colour-blind value loads off; a bad speed falls back (the old 2x flag loads as 2); good values load as saved");
        showScreen("map"); const hit2 = hitOK($("map-set")); $("map-set").click(); const mb = document.querySelector("#settings .tog-cb"); mb.click(); $("set-close").click(); showScreen("play"); // v5 R3: the map's gear
        const off2 = app.V.studInfo();
        ok(hit2 && !app.cb && !off2.cb && off2.sum.every((h, m) => h === off.sum[m]) && !gl() && app.save.data.settings.cb === false, "colour-blind off again (the map's gear, the settings sheet): the studs are plain again, byte for byte"); }
      // 17. Speed (v5 R1): under ?debug=1 the top bar's button cycles 1x, 2x, 3x and back through real clicks (nothing
      // saved), and at 3x the engine really runs three times real time. Without debug (forced off here): 1x; a tap asks
      // to buy 2x for the round; short of coins nothing is spent; bought, 2x and coins - price, then the button toggles
      // 1x/2x free; Retry and a new level go back to 1x and the next 2x costs again.
      { startLevel(app.levels[0].id, "normal"); const b = document.querySelector("#top .tog-speed"), seen = [], hit = hitOK(b), sv0 = app.save.data.settings.speed;
        for (let k = 0; k < SPD.length; k++) { b.click(); seen.push([app.speed, b.textContent, paceNow() / SH.pace].join(":")); }
        const want = SPD.map((_, k) => { const v = SPD[(k + 1) % SPD.length]; return [v, v + "×", v].join(":"); });
        ok(hit && seen.join(" ") === want.join(" ") && app.save.data.settings.speed === sv0, "speed (debug): the button cycles " + seen.join(" ") + " (speed:label:pace); nothing saved");
        b.click(); b.click(); const et0 = app.et; for (let k = 0; k < 10; k++) step(16);
        ok(app.speed === SPD[2] && Math.abs(app.et - et0 - 160 * SPD[2] * SH.pace) < 1e-6, "speed: at " + app.speed + "x, 160 ms of real time moves the engine " + (app.et - et0) + " ms");
        const T = app.meta.speed; app.debugSpeed = false;
        try { startLevel(app.levels[0].id); const r1 = app.speed; app.save.data.coins = T.price - 1; b.click(); const asked = !$("speedbuy").hidden && hitOK($("sb-buy")) && $("sb-buy").querySelector(".cprice b").textContent === String(T.price);
          $("sb-buy").click(); const poor = app.speed === 1 && (app.save.data.coins | 0) === T.price - 1 && $("speedbuy").hidden && !$("toast").hidden;
          app.save.data.coins = T.price + 3; b.click(); $("sb-no").click(); const no = app.speed === 1 && (app.save.data.coins | 0) === T.price + 3;
          b.click(); $("sb-buy").click(); const paid = app.speed === T.x && (app.save.data.coins | 0) === 3 && paceNow() / SH.pace === T.x;
          b.click(); const t1 = app.speed; b.click(); const t2 = app.speed; retry(); const back = app.speed === 1 && !app.fastPaid; b.click(); const again = !$("speedbuy").hidden; $("sb-no").click();
          ok(r1 === 1 && asked && poor && no && paid && t1 === 1 && t2 === T.x && back && again && (app.save.data.coins | 0) === 3, "speed (v5 R1): 1x; a tap asks to buy " + T.x + "x for " + T.price + "; short of coins nothing changes; Not now spends nothing; bought, " + T.x + "x and the coins drop; then the button toggles free; Retry is 1x again and the next one costs again"); }
        finally { app.debugSpeed = DEBUG; setSpeed(SPD[0]); } }
      // 18. v4 M2 debug levels: every stored order wins on its tag (v4.3: Normal), played patiently through playCol; the
      // board matches the rules; none of it reaches the save's progress.
      { let wins = 0, total = 0; const done0 = JSON.stringify(app.save.data.done), last0 = app.save.data.last;
        for (const id of ST.debugOrder) { const e = app.byId.get(id); if (!ok(!!e, "debug: level " + id + " is loaded")) continue;
          for (const d of [tagOf(e)]) { total++; startLevel(id); const good = patient(winOf(e)); settleNow();
            if (ok(good && app.S.status === E.WON && dispMatches() && allHome(), id + " " + d + ": stored order wins played patiently through play()")) wins++; } }
        ok(JSON.stringify(app.save.data.done) === done0 && app.save.data.last === last0, "debug: the wins never reach the save's progress");
        out.notes.debug = wins + "/" + total; }
      // 19. Mystery tiles: at load and after every tap of the stored Normal order (v4-mystery and v4-all, colour-blind off
      // and on), each tile of a hidden card is the neutral tile with "?" and its count and nothing of its card (no colour
      // anywhere in its markup, no crew, no glyph); every other tile shows its card's colour and count. A card that
      // reaches the front turns over.
      { const Y = LY.mystery; let tiles = 0, hiddenSeen = 0, flips = 0, bad = null;
        const mCheck = () => { const S = app.S, B = app.B;
          for (let j = 0; j < E.NCOL; j++) for (let d = 0; d < app.rows; d++) {
            const el = tileOf(j, d), ci = S.card(j, d); if (ci < 0) continue; tiles++;
            const m = B.cardM[ci], html = el.outerHTML.toLowerCase(), hid = S.hidden(ci), gl = el.querySelector(".gl"), glOn = gl && getComputedStyle(gl).display !== "none" && el.style.getPropertyValue("--gl").indexOf("url(") === 0;
            if (hid) { hiddenSeen++;
              if (!el.classList.contains("mys") || el.style.getPropertyValue("--mc") !== Y.c || el.textContent !== B.cardN[ci] + Y.q || html.indexOf(mat(m).c.toLowerCase()) >= 0 || html.indexOf(mat(m).crew.toLowerCase()) >= 0 || glOn || !d) return "column " + j + " row " + d + " leaks or misses its ? (" + el.outerHTML.slice(0, 160) + ")"; }
            else if (el.classList.contains("mys") || el.style.getPropertyValue("--mc") !== mat(m).c || el.textContent !== String(B.cardN[ci])) return "column " + j + " row " + d + " shows the wrong tile for a revealed card";
          } return null; };
        for (const cb of [false, true]) { setCb(cb, false);
          for (const id of ["v4-mystery", "v4-all"]) { const e = app.byId.get(id); if (!e) continue; startLevel(id, "normal"); bad = bad || mCheck();
            for (const ch of winOf(e)) { const j = +ch, f0 = app.S.front(j); playCol(j); if (app.S.front(j) >= 0 && app.S.front(j) !== f0 && app.B.cardF[app.S.front(j)] & E.MYSTERY && (app.V.calm || app.cards[j].getAnimations().length > 0)) flips++; bad = bad || mCheck(); settleNow(); bad = bad || mCheck(); } } }
        setCb(false, false);
        ok(!bad && hiddenSeen > 0 && flips > 0, "mystery: " + tiles + " tiles checked (" + hiddenSeen + " hidden), colour-blind off and on: hidden ones show only ? and their count, the rest their colour; " + flips + " flips at the front" + (bad ? " (" + bad + ")" : "")); }
      // 20. Linked squads (v4-linked): the rods at load; a pair both of whose colours are in reach leaves together (runners
      // from both spaces); a stub when a partner sits below the visible rows; a linked tap with one space free is refused
      // and changes nothing (engine state, tray, line, board), both tiles shake, the toast says why.
      { const e = app.byId.get("v4-linked"), rodsN = () => app.rods.querySelectorAll("path").length / 3, stubs = () => app.rods.querySelectorAll("circle.dot").length / 2;
        if (ok(!!e, "linked: v4-linked is loaded")) {
          startLevel(e.id, "normal"); const r0 = rodsN(); let pairN = 0, together = null, stubSeen = 0;
          for (const ch of winOf(e)) { const j = +ch, f = app.S.front(j), p = app.S.partner(f); stubSeen = Math.max(stubSeen, stubs());
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
          const dfs = (ord) => { if (X.status !== E.PLAYING) return null; if (X.lineLen === X.open - 1) { for (let j = 0; j < E.NCOL; j++) if (X.front(j) >= 0 && X.partner(X.front(j)) >= 0 && X.why(j) === 2) return { ord, j }; return null; }
            const b2 = X.save(); for (let j = 0; j < E.NCOL; j++) { if (X.front(j) < 0 || X.partner(X.front(j)) >= 0 || X.refused(j)) continue; X.play(j); const got = dfs(ord + j); X.load(b2); if (got) return got; } return null; };
          plan = dfs(""); X.load(buf);
          if (ok(!!plan, "linked refusal: found taps that leave one space free with a linked card at the front")) {
            startLevel(e.id, "normal"); for (const ch of plan.ord) playCol(+ch);
            const j = plan.j, p = app.S.partner(app.S.front(j)), pt = tileOf(app.B.cardCol[p], rowOf(app.S, app.B.cardCol[p], p));
            const snap = () => Array.from(app.S.save()).join(",") + "|" + app.cards.map((b) => b.className + ":" + b.textContent + ":" + b.disabled).join("/") + "|" + app.nexts.flat().map((x) => x.className + ":" + x.textContent).join("/") + "|" + app.slots.map((q) => q.className + ":" + q.textContent).join("/") + "|" + Array.from(app.V.disp).join("");
            const b0 = snap(), c0 = app.cues.blocked | 0, blocked = app.cards[j].classList.contains("blocked"), played = playCol(j);
            ok(app.S.lineLen === app.S.open - 1 && blocked && !played && snap() === b0 && app.S.status === E.PLAYING, "linked refusal: one space free, the linked card wears the lock; its tap changes nothing (engine state, tray, line, board byte-identical)");
            ok((app.cues.blocked | 0) === c0 + 1 && $("toast").textContent === LY.linkedText && (app.V.calm || (app.cards[j].getAnimations().length > 0 && (!pt || pt.getAnimations().length > 0))), "linked refusal: both tiles shake, the toast says '" + $("toast").textContent + "'"); } } }
      // 20b. v4.3: a linked front card whose partner is buried (v4-all at load) wears the waiting look; its tap is refused
      // with layout.linkedBuriedText and changes nothing; once the partner reaches its column's front the pair goes.
      { const e = app.byId.get("v4-all");
        if (ok(!!e, "linked (v4.3): v4-all is loaded")) {
          startLevel(e.id); const S = app.S, j = [0, 1, 2, 3, 4].find((k) => S.front(k) >= 0 && S.why(k) === 3);
          if (ok(j !== undefined, "linked (v4.3): v4-all opens with a linked front card whose partner is buried (why 3)")) {
            const p = S.partner(S.front(j)), pj = app.B.cardCol[p], b = app.cards[j], snap = () => Array.from(app.S.save()).join(",") + "|" + app.slots.map((q) => q.className).join("/") + "|" + Array.from(app.V.disp).join("");
            const b0 = snap(), c0 = app.cues.blocked | 0, look = b.classList.contains("waitpair") && !b.classList.contains("blocked") && /front/.test(b.getAttribute("aria-label")), played = playCol(j);
            ok(look && !played && snap() === b0 && (app.cues.blocked | 0) === c0 + 1 && $("toast").textContent === LY.linkedBuriedText && shown($("toast")), "linked (v4.3): the card waits for its partner (the waiting look, '" + b.getAttribute("aria-label") + "'); its tap is refused, changes nothing, and the toast says '" + $("toast").textContent + "'");
            out.notes.waitpair = e.id + " column " + j + ", partner in column " + pj; } } }
      // 21. The locked space (v4-locked): at load the last space is a padlocked socket and the key wears its brackets; on
      // the stored order the key pops, the unlock cue plays once, the padlock pops and the space opens.
      { const e = app.byId.get("v4-locked");
        if (ok(!!e, "lock: v4-locked is loaded")) {
          startLevel(e.id, "normal"); const S = app.S, last = app.slots[S.cap - 1], u0 = app.cues.unlock | 0;
          ok(S.open === S.cap - 1 && last.classList.contains("locked") && !last.hidden && getComputedStyle(last.querySelector(".pad")).display !== "none" && last.getAttribute("aria-label") === LY.lockedText && app.V.fxInfo().lockKey, "lock: the last space shows a padlock (" + S.open + " of " + S.cap + " open) and the key block wears its brackets");
          let seen = null; const o = winOf(e);
          for (let i = 0; i < o.length && !seen; i++) { playCol(+o[i]); for (let t = 0; t < ST.tickCapMs && app.S.busy && !seen; t += 16) { step(16); if (!app.S.locked) seen = { cls: last.className, cue: (app.cues.unlock | 0) - u0, key: app.V.fxInfo().lockKey, open: app.S.open }; } }
          ok(!!seen && /unlocking/.test(seen.cls) && !/locked /.test(seen.cls + " ") && seen.cue === 1 && !seen.key && seen.open === app.S.cap, "lock: the key pops: one unlock cue, the padlock pops, the space opens (" + JSON.stringify(seen) + ")");
          for (let t = 0; t < app.cfg.show.unlockMs + 100; t += 16) step(16);
          ok(!last.classList.contains("unlocking") && !last.classList.contains("locked"), "lock: once the padlock's pop ends the space is an ordinary one"); } }
      // 22. The generalized jam's sheet: one space free and every front card linked (selfTest.linkJamLevel), and a line
      // full but for the locked space (selfTest.lockJamLevel). Both fixtures win with the right order.
      for (const [k, jam, win, re] of [["linkJamLevel", "2301", "10023", LY.jamLinkedText], ["lockJamLevel", "1234", "001234", LY.jamLockText]]) { // v4.3: the linked fixture wins once its partner is a front card
        const e = fx(k); startLevel(e.id); patient(jam); settleNow();
        for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) step(16);
        const pl = $("p-line").getAttribute("aria-label") || "", tx = $("p-line").textContent, want = k === "linkJamLevel" ? pl.indexOf(re) === 0 && tx.indexOf(re) === 0 : pl.slice(-re.length) === re && tx.slice(-re.length) === re;
        ok(app.S.status === E.FAILED && app.S.reason === "jam" && app.panel === "fail" && want && chipCheck() === true, k + ": at rest every front card is refused: the sheet says why (" + tx + " / " + pl + ")");
        startLevel(e.id, "normal"); patient(win); settleNow(); ok(app.S.status === E.WON, k + ": the right order wins"); }
      // 22c. v5 R1, the continue (selfTest.jamLevel jammed): the jam's sheet offers it with its price; short of coins it is
      // muted, says how many more, and a tap spends nothing; paid, the sheet goes, every stuck squad finishes, the coins
      // drop by the price and play goes on to the win; the next attempt offers it again, the same attempt never twice.
      { const e = fx("jamLevel"), C = app.meta.cont, jam = () => { startLevel(e.id); patient("12340"); settleNow(); for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) step(16); };
        app.save.data.coins = C.price - 1; jam(); const bt = $("p-cont-buy");
        ok(app.panel === "fail" && shown($("p-cont")) && hitOK(bt) && bt.classList.contains("poor") && bt.querySelector(".cprice b").textContent === String(C.price) && $("p-cont").querySelector(".cont-say").textContent === fill(C.poor, { need: 1 }) && $("p-cont-ad").hidden, "continue: the jam's sheet offers it for " + C.price + "; one coin short it is muted and says so; the ad button stays hidden (AD HOOK)");
        app.clock += 1000; bt.click(); ok(app.panel === "fail" && app.S.status === E.FAILED && (app.save.data.coins | 0) === C.price - 1 && !$("toast").hidden, "continue: short of coins a tap spends nothing and toasts");
        app.save.data.coins = C.price + 5; jam(); app.clock += 1000;
        ok(!bt.classList.contains("poor") && $("p-cont").querySelector(".cont-say").textContent === C.say, "continue: with the coins it reads '" + C.say + "'");
        bt.click(); ok(!app.panel && $("panel").hidden && app.S.status === E.PLAYING && app.S.lineLen === 0 && (app.save.data.coins | 0) === 5 && app.S.revived === 1, "continue: paid, the sheet goes, the line is empty, " + C.price + " coins spent");
        patient("0"); settleNow(); ok(app.S.status === E.WON, "continue: play goes on and the level can be won");
        app.save.data.coins = 1000; jam(); ok(shown($("p-cont")) && app.S.revived === 0, "continue: a new attempt offers it again (one per attempt; the engine tests cover the second jam)"); }
      // 22d. v5 R1, mystery blocks (selfTest.hiddenLevel): the board draws "?" exactly where the engine hides a block (a flag
      // on a block touching open ground from the start means nothing); razing the a ring exposes them all, each once.
      { const e = fx("hiddenLevel"); startLevel(e.id); const V = app.V, S = app.S, same = () => { for (let c = 0; c < app.B.n; c++) if (!!V.hid[c] !== S.hiddenCell(c)) return false; return true; };
        const n0 = S.hiddenLeft, top = S.hiddenCell(1 * 9 + 3), s0 = same(); patient("0"); settleNow();
        ok(n0 === 5 && !top && s0 && S.hiddenLeft === 0 && same() && app.V.checkSprites().indexOf("mystery") < 0, "mystery blocks: the board's ? blocks match the engine (5; the flagged ring block touching open ground shows), and razing the ring exposes them all"); }
      // 22e. v5 R1, the Extreme tag: its pill reads "Extreme" in light text on a deep purple (4.5:1 or more), and a Play for an
      // Extreme level wears the warning face, darker than Hard's.
      { const el = document.createElement("span"); document.body.append(el); tagChip(el, "extreme"); const cs = getComputedStyle(el), rgb = (v) => { const m = v.match(/\d+/g).map(Number); return "#" + m.slice(0, 3).map((x) => x.toString(16).padStart(2, "0")).join(""); };
        const L1 = relLum(rgb(cs.color)), L2 = relLum(rgb(cs.backgroundColor)), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); el.remove();
        const pb = $("play-btn-test") || document.createElement("button"); pb.className = "primary"; pb.innerHTML = '<i class="tag"></i>'; playTag(pb, { L: { tag: "extreme" } });
        ok(el.textContent === LY.tags.extreme && el.classList.contains("tag-extreme") && cr >= 4.5 && pb.classList.contains("hard") && pb.classList.contains("extreme"), "extreme: the pill reads '" + el.textContent + "' at " + cr.toFixed(2) + ":1; an Extreme Play wears the warning face"); }
      // 22b. v5 R1, the colour lock (selfTest.colourLockLevel): its socket shows the colour that opens it and says so; the
      // tap that sends a squad of that colour out opens it (one unlock cue).
      { const e = fx("colourLockLevel"), m = ST.colourLockLevel.lock.colour; startLevel(e.id); const S = app.S, last = app.slots[S.cap - 1], u0 = app.cues.unlock | 0;
        ok(S.locked === 1 && last.classList.contains("locked") && last.classList.contains("clock") && last.style.getPropertyValue("--lc") === mat(m).c && last.getAttribute("aria-label") === fill(LY.colourLockText, { crew: mat(m).crew }) && !app.V.fxInfo().lockKey, "colour lock: the locked space shows its colour and names the crew; no key on the board");
        const j = app.cards.findIndex((b, k) => S.front(k) >= 0 && app.B.cardM[S.front(k)] === m); playCol(j); step(16);
        ok(app.S.locked === 0 && (app.cues.unlock | 0) === u0 + 1 && !last.classList.contains("locked") && !last.classList.contains("clock"), "colour lock: its colour's tap opens it (one unlock cue)"); }
      // 22f. Campaign v6, killing towers (the debug level v6-kill): the level warns as it starts (layout.killToast); a game
      // that walks a sapper into a ring: a doomed runner, the arrow strikes, the label rises, the engine kills and the
      // colour is short; the sheet names the colour (shortText; its chip, no count), offers no continue, and Retry starts
      // over; the stored order wins with nobody shot.
      { const e = app.byId.get("v6-kill");
        if (ok(!!e && e.L.archers === "kill", "kill (v6): v6-kill is loaded")) {
          startLevel(e.id); ok(!$("toast").hidden && $("toast").textContent === LY.killToast, "kill (v6): the level starts with the warning toast ('" + $("toast").textContent + "')");
          const o = search(e, "normal", (S) => S.status === E.FAILED && S.reason === "short", ST.searchTries, ST.searchSeed);
          if (ok(!!o, "kill (v6): found a game that ends short")) {
            startLevel(e.id); patient(o.slice(0, -1)); playCol(o.charCodeAt(o.length - 1) - 48);
            let live = 0, struck = null; for (let t = 0; t < ST.tickCapMs && !struck; t += 16) { step(16); const h = app.V.hitInfo(); if (h.live) live = h.kind; if (h.struck) struck = h; }
            ok(live === 2 && !!struck && struck.label && app.S.kills === 1 && app.S.status === E.FAILED, "kill (v6): a doomed runner, the arrow strikes, the label rises; the engine kills (" + JSON.stringify(struck) + ")");
            for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) step(16);
            const m = app.S.failMat, pl = $("p-line");
            ok(app.panel === "fail" && app.S.reason === "short" && pl.getAttribute("aria-label") === fill(LY.shortText, { crew: mat(m).crew }) && pl.textContent === LY.shortPre + LY.shortPost && !!pl.querySelector(".chip") && $("p-cont").hidden && $("p-primary").querySelector(".pl").textContent === "Retry",
              "kill (v6): the short sheet names the colour ('" + pl.getAttribute("aria-label") + "'), shows its chip, offers no continue; Retry is the main button");
            retry(); ok(app.S.status === E.PLAYING && app.S.plays === 0 && app.S.kills === 0 && !app.panel && $("panel").hidden, "kill (v6): Retry starts the level again");
            patient(winOf(e)); settleNow(); ok(app.S.status === E.WON && app.S.kills === 0 && app.S.hits === 0, "kill (v6): the stored order wins with nobody shot");
            out.notes.kill = e.id + " short '" + o + "'"; } } }
      // 22h. Campaign v6 1b, pinning towers (the debug level v6-pin): the calm toast; a game that walks a sapper into a ring:
      // the arrow strikes and the runner lies pinned with the label, the engine pins (nothing fails, its space is held, the
      // space says so); from there a winning continuation: the tower falls, the pinned sapper gets up and walks back, the
      // level wins. A jam with a pinned squad names it (its chip, the pin line, jamWhy 8).
      { const e = app.byId.get("v6-pin");
        if (ok(!!e && e.L.archers === "pin", "pin (v6 1b): v6-pin is loaded")) {
          startLevel(e.id); ok(!$("toast").hidden && $("toast").textContent === LY.pinToast && !$("toast").classList.contains("bad"), "pin (v6 1b): the level starts with the calm toast ('" + $("toast").textContent + "')");
          const o = search(e, "normal", (S) => S.pins > 0 && S.status === E.PLAYING, ST.searchTries, ST.searchSeed);
          if (ok(!!o, "pin (v6 1b): found a game with a pinned sapper")) {
            startLevel(e.id); patient(o.slice(0, -1)); playCol(o.charCodeAt(o.length - 1) - 48);
            let struck = null; for (let t = 0; t < ST.tickCapMs && !struck; t += 16) { step(16); const h = app.V.hitInfo(); if (h.struck && h.kind === 3) struck = h; }
            for (let t = 0; t < ST.tickCapMs && app.S.busy; t += 16) step(16);
            const S = app.S, sp = S.order().find((x) => S.pinned(x) > 0), lab = sp != null ? app.slots[sp].getAttribute("aria-label") : "";
            ok(!!struck && struck.label && S.pins === 1 && S.status === E.PLAYING && app.V.hitInfo().kind === 3 && sp != null && lab.indexOf("1 " + LY.pinnedWord) > 0, "pin (v6 1b): the runner lies pinned (the arrow struck, the label rose); the engine pins, play goes on; the space reads '" + lab + "'");
            const rest = solveHere(); let up = null;
            if (ok(!!rest, "pin (v6 1b): a winning continuation from the pinned state")) {
              for (let i = 0; i < rest.length && app.S.status === E.PLAYING; i++) { playCol(+rest[i]); for (let t = 0; t < ST.tickCapMs && app.S.busy; t += 16) { step(16); if (!up && app.S.pins === 0) up = app.V.hitInfo(); } }
              settleNow(); ok(!!up && up.kind === 4 && app.S.status === E.WON, "pin (v6 1b): the tower falls, the pinned sapper gets up and walks back (" + JSON.stringify(up) + "); the level wins"); } }
          const j = search(e, "normal", (S) => S.status === E.FAILED && S.reason === "jam" && (S.jamWhy & 8) > 0, ST.searchTries, ST.searchSeed);
          if (ok(!!j, "pin (v6 1b): found a jam with a pinned squad")) {
            startLevel(e.id); patient(j); settleNow(); for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) step(16);
            const pl = $("p-line"), aria = pl.getAttribute("aria-label") || "";
            ok(app.panel === "fail" && aria.slice(-LY.jamPinText.length) === LY.jamPinText && pl.textContent.slice(-LY.jamPinText.length) === LY.jamPinText && pl.querySelectorAll(".chip").length >= 1 && app.ending.squads.some(([m, k]) => k > 0), "pin (v6 1b): the jam sheet names the pinned squad ('" + aria + "')");
            out.notes.pin = e.id + " pinned '" + o + "', jam '" + j + "'"; } } }
      // 22g. Campaign v6, two locks (the debug level v6-locks): two padlocked sockets, the left in its colour (lock 0, a
      // colour lock) and the right the key's (lock 1, its key wearing the brackets). Along the stored order each opens on
      // its own: its own socket pops (the other stays shut), one unlock cue each; the level wins.
      { const e = app.byId.get("v6-locks");
        if (ok(!!e && e.L.locks && e.L.locks.length === 2, "two locks (v6): v6-locks is loaded")) {
          startLevel(e.id); const S = app.S, a = app.slots[S.cap - 2], b = app.slots[S.cap - 1], m = e.L.locks[0].colour, u0 = app.cues.unlock | 0, lk = /\blocked\b/;
          ok(S.open === S.cap - 2 && lk.test(a.className) && a.classList.contains("clock") && a.style.getPropertyValue("--lc") === mat(m).c && a.getAttribute("aria-label") === fill(LY.colourLockText, { crew: mat(m).crew }) && lk.test(b.className) && !b.classList.contains("clock") && b.getAttribute("aria-label") === LY.lockedText && app.V.fxInfo().lockKeys === 1,
            "two locks (v6): two padlocked sockets (" + S.open + " of " + S.cap + " open), the colour's on the left and the key's on the right; the key wears its brackets");
          const seen = [], o = winOf(e); let was = app.S.locked;
          const look = () => { if (app.S.locked < was) seen.push({ a: a.className, b: b.className, cue: (app.cues.unlock | 0) - u0, keys: app.V.fxInfo().lockKeys }); was = app.S.locked; };
          for (let i = 0; i < o.length && app.S.status === E.PLAYING; i++) { playCol(+o[i]); step(16); look(); for (let t = 0; t < ST.tickCapMs && app.S.busy; t += 16) { step(16); look(); } }
          ok(seen.length === 2 && /unlocking/.test(seen[0].b) && lk.test(seen[0].a) && seen[0].cue === 1 && seen[0].keys === 0 && /unlocking/.test(seen[1].a) && !lk.test(seen[1].a) && !/unlocking/.test(seen[1].b) && seen[1].cue === 2,
            "two locks (v6): the key opens its own socket (the colour's stays shut), then the colour opens the left one; one unlock cue each (" + JSON.stringify(seen) + ")");
          settleNow(); ok(app.S.status === E.WON, "two locks (v6): the stored order wins"); } }
      // 23. Critics 1 fix: the rods on the debug levels along their stored orders (every rod on its two tiles, never over a
      // third); B1: a linked pair leaving and then at rest, and a full line of big squads rushed out, with every count
      // clear of every badge.
      // Critics 2 fix (m9): no two rods run down one gutter over the same rows (each takes its own lane).
      const laneClash = () => { const seg = []; for (const pth of app.rods.querySelectorAll("path")) { if (pth.getAttribute("stroke") !== LY.rod.ink) continue; const v = (pth.getAttribute("d").match(/-?[\d.]+/g) || []).map(Number);
          for (let i = 0; i + 3 < v.length; i += 2) if (Math.abs(v[i] - v[i + 2]) < 0.05 && Math.abs(v[i + 1] - v[i + 3]) > 0.5) seg.push([v[i], Math.min(v[i + 1], v[i + 3]), Math.max(v[i + 1], v[i + 3])]); }
        for (let u = 0; u < seg.length; u++) for (let w = u + 1; w < seg.length; w++) if (Math.abs(seg[u][0] - seg[w][0]) < 1 && Math.min(seg[u][2], seg[w][2]) - Math.max(seg[u][1], seg[w][1]) > 0) return "two rods share the gutter at x " + Math.round(seg[u][0]);
        return true; };
      for (const id of ["v4-linked", "v4-all"].concat(app.levels.filter((x) => x.L.links && x.L.links.length).slice(0, 4).map((x) => x.id))) { const e = app.byId.get(id); if (!e) continue; startLevel(id); let bad = rodClear(), cb = chainClear(), gb = rodGlyph(), lc = laneClash(), n = 0;
        for (const ch of winOf(e)) { if (bad !== true || cb !== true || gb !== true || lc !== true) break; playCol(+ch); settleNow(); bad = rodClear(); cb = chainClear(); gb = rodGlyph(); lc = laneClash(); n++; }
        ok(bad === true && cb === true && gb === true && lc === true, id + ": after each of " + n + " taps every rod lands on its two tiles and crosses no third, no rod or rivet touches a count, no chain tag covers one, no two rods share a lane (" + bad + ", " + gb + ", " + cb + ", " + lc + ")"); }
      if (app.byId.has("v4-linked")) { startLevel("v4-linked"); const o = winOf(app.entry); let i = 0; // v4.3: the stored order up to its first pair (both cards at a front)
        for (; i < o.length && app.S.partner(app.S.front(+o[i])) < 0; i++) { playCol(+o[i]); settleNow(); }
        const j = i < o.length ? +o[i] : -1;
        if (ok(j >= 0 && playCol(j), "B1: a linked front card plays")) { for (let t = 0; t < 350; t += 16) step(16); const a = slotClear(), lk = app.slots.filter((q) => q.classList.contains("linked")).length; settleNow(); const b = slotClear();
          ok(a === true && b === true && lk === 2, "B1: both linked spaces wear the chain and every count stays clear of every badge, leaving and at rest (" + a + ", " + b + ")"); } }
      { const e = app.levels.find((x) => x.n >= 26 && tagOf(x) === "easy" && !x.L.links) || app.levels[app.levels.length - 1]; startLevel(e.id); fillLine(); step(16); step(16); for (let t = 0; t < 400; t += 16) step(16); // v4.3: an Easy level (6 spaces)
        const c = slotClear(); ok(c === true && app.slots.some((q) => q.classList.contains("work")), "B1: a full Easy line of working squads (" + app.S.cap + " spaces" + ($("line").classList.contains("tight") ? ", tight" : "") + "): every count clear of every badge (" + c + ")"); }
      // 24. v4 M4, the Gallery: every picture's stored order on its tag (v4.3), played patiently through playCol (the
      // board matches the rules, every sapper home); the level's palette on the tiles, the spaces' aria and the board;
      // sappers coming in from the edges; the Gallery screen locked before gallery.openAt is won and open after, a won
      // picture in colour with its title; a win recorded in the save's gal and the win sheet's next picture. v4.3: the
      // pictures open one at a time (the rest padlocked silhouettes a tap can't start).
      if (app.gal.length) {
        const GC = app.cfg.gallery; let wins = 0, total = 0;
        for (const e of app.gal) { const d = tagOf(e); total++; startLevel(e.id); const good = patient(winOf(e)); settleNow();
          if (ok(good && app.S.status === E.WON && dispMatches() && allHome(), e.id + " " + d + ": the Gallery's stored order wins played patiently through play()")) wins++; }
        out.notes.gallery = wins + "/" + total;
        { const e = app.gal.find((x) => Object.keys(x.L.pal).length >= 5) || app.gal[0], P = e.L.pal; startLevel(e.id, "normal"); let bad = null;
          for (let j = 0; j < E.NCOL && !bad; j++) { const f = app.S.front(j); if (f < 0) continue; const m = app.B.cardM[f], want = P[m];
            if (app.cards[j].style.getPropertyValue("--mc") !== want.c) bad = "tile " + j + " is " + app.cards[j].style.getPropertyValue("--mc") + ", its colour is " + want.c;
            else if (app.cards[j].getAttribute("aria-label").toLowerCase().indexOf(want.n) !== 0) bad = "tile " + j + " reads '" + app.cards[j].getAttribute("aria-label") + "', not its colour's name " + want.n;
            else if (app.V.pal[m] !== want.c) bad = "the board draws " + m + " as " + app.V.pal[m]; }
          ok(!bad && app.V.sprites && !app.V.checkSprites().length, e.id + ": the tiles and the board use the picture's own colours, the tiles are named by colour (" + (bad || Object.keys(P).length + " colours") + ")");
          const o = winOf(e); playCol(+o[0]); let seen = { live: 0 }; for (let t = 0; t < 1200; t += 16) { step(16); const q = app.V.entryInfo(); if (q.live > seen.live) seen = q; }
          ok(seen.live > 0 && seen.yard === seen.live && seen.crate === seen.live && seen.entry === seen.live && app.S.status === E.PLAYING, e.id + ": v4.1, the first squad's sappers leave their crate in the yard and come up through the entry square at the bottom (" + JSON.stringify(seen) + ")");
          settleNow(); const sl = app.slots.find((q) => q.classList.contains("full")); ok(!sl || sl.getAttribute("aria-label").toLowerCase().indexOf(P[app.S.spM[+app.slots.indexOf(sl)]].n) === 0, e.id + ": a space reads its colour's name (" + (sl ? sl.getAttribute("aria-label") : "no squad waiting") + ")"); }
        const px = (c) => { const q = document.createElement("canvas"); q.width = c.width; q.height = c.height; const g = q.getContext("2d", { willReadFrequently: true }); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, s = new Set(); for (let i = 0; i < d.length; i += 4) s.add("#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")); return s; };
        // v5 R3, the side quests on the journey map. A new save: picture 1's node is locked (its prize icon on it), a tap
        // shakes and starts nothing; once its main level is cleared it opens (gold ring, prize bubble) and a tap plays it.
        app.save.data.done = {}; app.save.data.gal = {}; showScreen("map");
        const e0 = app.gal[0], q0 = e0.node, a0 = e0.L.quest.after, pal0 = new Set(Object.values(e0.L.pal).map((q) => q.c.toLowerCase()));
        { const k0 = app.cues.blocked | 0; jrTo(q0); q0.click();
          ok(q0.classList.contains("locked") && q0.getAttribute("aria-disabled") === "true" && shown(q0.querySelector(".qp")) && !shown(q0.querySelector(".prz")) && app.screen === "map" && (app.cues.blocked | 0) === k0 + 1 && q0.getAttribute("aria-label").indexOf(fill(GC.lockedAria, { n: 1, after: a0 })) === 0,
            "map quests: on a new save picture 1's node is locked with its prize icon; a tap shakes and starts nothing ('" + q0.getAttribute("aria-label") + "')"); }
        // v5.1: level a0 won through play; its sheet's main button goes back to the map, where picture 1 has just opened:
        // its node and prize bubble in view, pulsing (none under reduced motion).
        for (let i = 0; i < a0 - 1; i++) Save.record(app.save.data, app.order[i]);
        { const la = app.byId.get(app.order[a0 - 1]); startLevel(la.id); patient(winOf(la)); settleNow(); tick(9000); const pw = app.panel === "win"; $("p-primary").click();
          const q = $("jr").getBoundingClientRect(), r = q0.getBoundingClientRect(), pr = q0.querySelector(".prz").getBoundingClientRect(), pulse = q0.querySelector(".qf").getAnimations().length > 0;
          ok(pw && app.screen === "map" && q0.classList.contains("open") && r.top >= q.top && r.bottom <= q.bottom && pr.top >= q.top && pr.bottom <= q.bottom && (app.V.calm ? !pulse : pulse),
            "v5.1: winning level " + a0 + " and going back to the map shows picture 1 just opened, its node and prize bubble in view" + (app.V.calm ? " (reduced motion: no pulse)" : ", pulsing")); }
        { const prz = q0.querySelector(".prz"); jrTo(q0);
          ok(q0.classList.contains("open") && q0.classList.contains("next") && shown(prz) && prz.querySelector(".pi").style.backgroundImage.indexOf("url(") === 0 && hitOK(q0) && q0.getAttribute("aria-label").indexOf(fill(GC.nextAria, { n: 1 })) === 0 && app.gal[1].node.classList.contains("locked"),
            "map quests: with level " + a0 + " cleared picture 1 opens (gold ring, prize bubble, hittable); picture 2 stays locked"); }
        q0.click(); ok(app.screen === "play" && app.entry === e0, "map quests: a tap on the open node plays picture 1");
        // Won (picture 2's main level cleared too): the save's gal, the prize paid once with its toast, the sheet's next picture.
        Save.record(app.save.data, app.order[app.gal[1].L.quest.after - 1]);
        const pz = e0.L.quest.prize, inv0 = app.save.data.inv[pz] | 0;
        startLevel(e0.id); patient(winOf(e0)); settleNow(); const tx0 = $("toast").textContent; tick(9000);
        ok(app.panel === "win" && $("p-title").textContent === GC.winTitle && $("p-primary").querySelector(".pl").textContent === LY.toMap && app.save.data.gal[e0.id] === 1 && !app.save.data.done[e0.id] && hitOK($("p-primary")) && (app.save.data.inv[pz] | 0) === inv0 + 1 && tx0 === fill(GC.quests.prizeText, { name: pwName(E.POWERS.indexOf(pz)) }),
          "map quests: a picture won goes in the save's gal, pays its prize (+1 " + pz + ", toast '" + tx0 + "'), the sheet says '" + $("p-title").textContent + "' and offers '" + $("p-primary").textContent + "'");
        { for (const an of $("panel").firstElementChild.getAnimations()) an.finish(); const pc = $("p-pic").firstElementChild, pr = pc.getBoundingClientRect(), cr = $("panel").firstElementChild.getBoundingClientRect(), cols = px(pc), cell = pr.height / (e0.L.h - 2), sc = sheetClear(true);
          out.notes.reportPic = Math.round(pr.width) + "x" + Math.round(pr.height) + " CSS px, " + cell.toFixed(2) + " a cell";
          const sp = $("stage-pic"), onStage = !shown($("p-pic")) && shown(sp), spr = sp.firstElementChild.getBoundingClientRect(), fr = $("frame").getBoundingClientRect(), scol = onStage ? px(sp.firstElementChild) : cols;
          if (onStage) out.notes.reportPic = "over the board, " + Math.round(spr.width) + "x" + Math.round(spr.height) + " CSS px";
          ok((shown($("p-pic")) ? pr.top >= cr.top && pr.bottom <= cr.bottom : onStage && spr.left >= fr.left && spr.right <= fr.right && spr.top >= fr.top && spr.bottom <= fr.bottom) && $("p-line").textContent === fill(GC.winLine, { title: e0.L.title }) && [...scol].every((c) => pal0.has(c)) && scol.size === pal0.size && cr.top >= -0.5 && cr.bottom <= innerHeight + 0.5 && sc === true && hitOK($("p-primary")) && hitOK($("p-secondary")),
            "gallery (Critics 2 fix, V2): the win shows the finished picture (" + out.notes.reportPic + ", all " + scol.size + " of its colours) on the sheet (or over the razed board where the sheet has no room), and the sheet fits the screen; '" + $("p-line").textContent + "' (" + sc + ")"); }
        $("p-primary").click(); ok(app.screen === "map" && q0.classList.contains("won") && app.gal[1].node.classList.contains("open"), "v5.1: a side quest's win goes back to the map too (not on to picture 2): picture 1 shows won, picture 2 waits open");
        startLevel(app.gal[1].id); $("btn-map").click(); const col = px(q0.querySelector("canvas"));
        ok(app.screen === "map" && q0.classList.contains("won") && !shown(q0.querySelector(".prz")) && shown(q0.querySelector("canvas")) && [...col].every((c) => pal0.has(c)) && q0.getAttribute("aria-label").indexOf(e0.L.title + ", cleared") === 0,
          "map quests: the top bar's button goes back to the map; the won node shows the finished picture in its own colours (" + col.size + "), no prize bubble");
        { const inv1 = app.save.data.inv[pz] | 0; jrTo(q0); q0.click(); const re = app.entry === e0 && app.screen === "play"; patient(winOf(e0)); settleNow(); tick(9000);
          ok(re && app.panel === "win" && (app.save.data.inv[pz] | 0) === inv1, "map quests: a tap on the won node plays it again; a second win pays no prize"); }
        ok(app.jr.quests.length === app.gal.filter((e) => e.L.quest && questAt(e) <= app.order.length).length && app.jr.quests.every((q) => q.g && q.g.querySelectorAll("ellipse").length >= 1 && q.g.getAttribute("class").indexOf(JN.questState(app.save.data, app.order, galIds(), galAfter(), q.e.id)) > 0),
          "map quests: every side quest on the map has its stepping-stone detour drawn from the road, marked with its state");
        const saved = JSON.stringify(Save.sanitize(JSON.parse(JSON.stringify(app.save.data)), app.order, app.gal.map((x) => x.id)).gal), junk = Save.sanitize({ gal: { [e0.id]: 99, nope: 1, [app.gal[1].id]: "x" } }, app.order, app.gal.map((x) => x.id)).gal;
        ok(saved === JSON.stringify(app.save.data.gal) && JSON.stringify(junk) === JSON.stringify({ [e0.id]: 1 }), "map quests: the save's gal reads back through sanitize; a cleared mask reads as cleared, unknown ids and non-numbers are dropped");
        showScreen("title");
      }
      // 24b. v5 R3, the journey map: its parts (v5 R4c: the sheets up to the frontier, a node for every level and none past,
      // the quests whose main level exists, the eggs below the fog, a banner a realm with levels,
      // the bridges), lazy sheets, the current node about map.curAt down with its label, locked and cleared taps, the
      // route cut at the current node, a banner's lore, the debug row; an egg paying once; the long tail in the fog.
      if (app.jr) { const J = app.jr, MC = app.cfg.map, MT = MC.text, sc = $("jr"), coins = () => app.save.data.coins;
        app.save = scratch(); J.colW = 0; showScreen("map");
        // v5 R4c: built up to the frontier (the first level not built, else the summit's long-tail spot): what the layout
        // holds past it, and quests past the last level, are not built; eggs and bridges in its fog neither.
        { const fr = J.fr, LS = app.lay.sheets, fogTo = fr.fog ? fr.fog + MC.tail.tailClear : fr.y + MC.tail.below, clear = (si, y) => si < fr.si || (si === fr.si && y >= fogTo), nq = app.gal.filter((e) => e.L.quest && questAt(e) <= app.order.length).length;
          const ne = LS.slice(0, fr.n).reduce((a, S, si) => a + S.eggs.filter((G) => clear(si, G.y)).length, 0), nb = MC.bridges.concat(LS.flatMap((S) => (S.bridges || []).map((b) => [S.sheet, b[0]]))).filter(([bs, i]) => bs <= fr.n && LS[bs - 1].road[i] && clear(bs - 1, LS[bs - 1].road[i][1])).length, nr = new Set(app.levels.map((e) => e.era)).size; // lands foundation: nb counts a land entry's own bridges too
          const spots = LS.flatMap((S) => S.levels).filter((v) => v.n > app.levels.length).length;
          ok(J.sheets.length === fr.n && app.levels.every((e) => e.node && e.node.classList.contains("mn")) && document.querySelectorAll("#jr .mn").length === app.levels.length && J.quests.length === nq && J.eggs.length === ne && document.querySelectorAll("#jr .bn").length === nr && document.querySelectorAll("#jr .br").length === nb,
            "map (sheets, nodes, quests, eggs, banners, bridges: " + [J.sheets.length === fr.n, app.levels.every((e) => e.node && e.node.classList.contains("mn")) && document.querySelectorAll("#jr .mn").length === app.levels.length, J.quests.length === nq, J.eggs.length === ne, document.querySelectorAll("#jr .bn").length === nr, document.querySelectorAll("#jr .br").length === nb].map(Number).join("") + "): " + J.sheets.length + " of " + LS.length + " sheets built (up to the frontier on sheet " + (fr.si + 1) + "), a node for each of " + app.levels.length + " levels and none for the " + spots + " spots ahead, " + J.quests.length + " side quests, " + J.eggs.length + " eggs, a banner for each of " + nr + " realms, " + nb + " bridges");
          const tb = J.tail.b, kg = document.querySelectorAll("#jr .jr-sheet")[J.king.si];
          ok(Math.abs(parseFloat(tb.style.left) - (100 * fr.x) / app.lay.w) < 0.01 && Math.abs(parseFloat(tb.style.top) - (100 * fr.y) / app.lay.h) < 0.01 && J.tail.si === fr.si && !!kg && !!J.king.teaser === !(LS[J.king.si] && LS[J.king.si].goblinKing && app.levels.some((e) => e.n === LS[J.king.si].levels[LS[J.king.si].levels.length - 1].n)),
            "map: the long tail's node waits at the frontier (" + fr.x + ", " + fr.y + " on sheet " + (fr.si + 1) + "); the Goblin King " + (J.king.teaser ? "waits in the fog" : "stands at the summit by level " + LS[J.king.si].levels[LS[J.king.si].levels.length - 1].n)); }
        ok(J.sheets.filter((h) => h.loaded).length < J.sheets.length && J.sheets.every((h) => h.loaded === !!h.img.getAttribute("src")), "map: sheets load as they near the view, not all at once (" + J.sheets.filter((h) => h.loaded).length + " of " + J.sheets.length + " requested so far)");
        // Mid-campaign (40 cleared): the current node about curAt down the scroller, its label beside it, in its sheet.
        for (let i = 0; i < 40; i++) Save.record(app.save.data, app.order[i]); showScreen("map");
        { const e = app.byId.get(Save.next(app.save.data, app.order)), r = e.node.getBoundingClientRect(), s = sc.getBoundingClientRect(), at = (r.top + r.height / 2 - s.top) / s.height, L = J.label;
          ok(e.node.classList.contains("cur") && Math.abs(at - MC.curAt) < 0.02 && L.parentNode === e.node.parentNode && L.firstChild.textContent === fill(MT.cur, { n: e.n }) && hitOK(e.node) && !over(L.getBoundingClientRect(), r),
            "map: level " + e.n + " is current, " + Math.round(at * 100) + "% down the view (map.curAt " + MC.curAt + "), labelled '" + L.textContent + "' beside it, hittable"); out.notes.mapAt = +at.toFixed(3);
          const cs = e.sheet, w = J.sheets.map((h) => [!!h.w.getAttribute("d"), !!h.a.getAttribute("d")]);
          ok(w.every((q, i) => (i < cs ? q[0] && !q[1] : i > cs ? !q[0] && q[1] : q[0] && q[1])), "map: the route is walked (red) up to level " + e.n + " on sheet " + (cs + 1) + " and faint ahead of it");
          const lk = app.byId.get(app.order[45]), k0 = app.cues.blocked | 0; jrTo(lk.node); lk.node.click(); const s1 = app.screen;
          const dn = app.levels[10]; jrTo(dn.node); dn.node.click();
          ok(lk.node.classList.contains("locked") && s1 === "map" && (app.cues.blocked | 0) === k0 + 1 && app.entry === dn && app.screen === "play", "map: a locked node (" + lk.n + ") shakes and starts nothing; a cleared one (" + dn.n + ") plays again"); }
        showScreen("map"); { const bn = document.querySelector("#jr .bn"), lo = bn.querySelector(".lore"); jrTo(bn); const h0 = shown(lo); bn.click(); const h1 = shown(lo); bn.click();
          ok(!h0 && h1 && !shown(lo) && lo.textContent === app.eras[0].note && hitOK(bn), "map: a realm's banner shows its lore on a tap and hides it on the next"); }
        if (app.debug.length) ok(!$("jr-dbg").hidden && $("jr-dbg").querySelectorAll(".dbg-node").length === app.debug.length && hitOK($("jr-dbg").querySelector(".dbg-node")), "map (?debug=1): the debug row holds the " + app.debug.length + " v4 twists' levels");
        // An egg: the first tap pays its coins (the top bar's count too) and turns it; a second pays nothing; the save keeps it.
        { const g = J.eggs[0], c0 = coins(); jrTo(g.b); const hit = hitOK(g.b), svg0 = g.b.innerHTML; g.b.click(); const c1 = coins(); g.b.click(); const c2 = coins();
          const reread = Save.sanitize(JSON.parse(JSON.stringify(app.save.data)), app.order, galIds(), app.meta).eggs;
          ok(hit && c1 - c0 === g.coins && g.coins >= 10 && g.coins <= 15 && c2 === c1 && g.b.classList.contains("found") && g.b.innerHTML !== svg0 && $("map-coins").textContent === String(c1) && reread[g.id] === 1 && g.b.getAttribute("aria-label").indexOf(MT.eggs[g.kind][1]) > 0,
            "map eggs: " + g.id + " (" + g.kind + ") pays " + (c1 - c0) + " coins once (a second tap " + (c2 - c1) + "), turns into " + MT.eggs[g.kind][1] + ", the top bar's coins follow, the save keeps it"); }
        // v5 R3 (Peter 10/5): an egg shows only once its realm is reached (its realm's first level open); a hidden one never pays.
        { const wrong = J.eggs.filter((g) => { const re = J.sheets[g.sheet].S.realm, f = app.levels.find((e) => e.era === re); return g.b.hidden === (!!f && Save.isOpen(app.save.data, app.order, f.id)); }); // v5 R4c: a realm with no levels is not reached
          const hid = J.eggs.find((g) => g.b.hidden), c0 = coins(); if (hid) eggTap(hid);
          ok(!wrong.length && coins() === c0 && (!hid || !(app.save.data.eggs || {})[hid.id]), "map eggs: shown only in reached realms (" + J.eggs.filter((g) => !g.b.hidden).length + " of " + J.eggs.length + " shown; wrong: " + (wrong.map((g) => g.id).join(", ") || "none") + "), a hidden one pays nothing"); }
        ok(J.eggs.every((g) => g.b.querySelector("svg") && g.b.getAttribute("aria-label")) && app.levels.every((e) => e.node.tagName === "BUTTON" && e.node.getAttribute("aria-label")) && J.quests.every((q) => q.b.tagName === "BUTTON" && q.b.getAttribute("aria-label")),
          "map a11y: every level, side quest and egg is a button with a label");
        // The long tail: before every level is cleared the fog holds no node; after, one next picture, then the next.
        { const t = J.tail, fogShown = shown(document.querySelector("#jr .fogl")); ok(t.b.hidden && fogShown && !mapPic(), "map long tail: the road fades into fog ('" + MT.fog + "'); no node there before every level is cleared");
          for (const id of app.order) Save.record(app.save.data, id); for (let i = 0; i < 25; i++) Save.record(app.save.data, app.gal[i].id, "gal"); showScreen("map");
          const T0 = JN.tail(app.save.data, app.order, galIds(), galAfter()), tb = t.b, r = tb.getBoundingClientRect(), s = sc.getBoundingClientRect(), at = (r.top + r.height / 2 - s.top) / s.height;
          if (!T0.ids.length) ok(tb.hidden && !t.e && !t.th.children.length, "map long tail (campaign v6): no picture past the last level in this build; with every level cleared the fog holds no node"); else { // campaign v6: the 50 side quests all sit by level 200
          ok(!tb.hidden && t.e && t.e.id === T0.ids[0] && hitOK(tb) && (Math.abs(at - MC.curAt) < 0.02 || sc.scrollTop === 0) && $("map-play").querySelector(".pl").textContent === fill(MT.playPic, { n: t.e.n }) && !t.th.children.length,
            "map long tail: with 1-" + app.levels.length + " cleared one node opens in the fog (picture " + (t.e ? t.e.n : "?") + "), " + Math.round(at * 100) + "% down (or the map's top); Play reads '" + $("map-play").textContent + "'");
          tb.click(); const first = app.entry; patient(winOf(first)); settleNow(); tick(9000); $("btn-map").click();
          const th = t.th.querySelector(".th"); jrTo(t.th);
          ok(first.id === T0.ids[0] && app.save.data.gal[first.id] === 1 && t.e && t.e.id === T0.ids[1] && t.th.children.length === 1 && th.dataset.id === first.id && hitOK(th), "map long tail: picture " + first.n + " won, the node moves on to picture " + (t.e ? t.e.n : "?") + "; the won one waits beside it to replay");
          th.click(); ok(app.entry === first && app.screen === "play", "map long tail: a tap on a cleared picture's thumbnail plays it again");
          // v5 R3 fix: past map.tail.show won, the row keeps the latest few (44 px) and a chip opens a sheet of all of them.
          const K = MC.tail.show; for (let i = 0; i < K + 1; i++) Save.record(app.save.data, T0.ids[1 + i], "gal"); showScreen("map");
          const won = JN.tail(app.save.data, app.order, galIds(), galAfter()).won, row = Array.from(t.th.querySelectorAll(".th")), chip = t.th.querySelector(".tchip"); jrTo(t.th);
          const big = (el) => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; };
          ok(row.length === K && row.map((b) => b.dataset.id).join() === won.slice(-K).join() && row.every((b) => big(b) && hitOK(b)) && chip && big(chip) && hitOK(chip) && chip.textContent === fill(MT.tailChip, { n: won.length }),
            "map long tail (v5 R3 fix): " + won.length + " won: the latest " + K + " in one row and the chip '" + (chip ? chip.textContent : "") + "', every one 44+ px and hittable");
          chip.click(); const tiles = Array.from(document.querySelectorAll("#ts-grid .ts-tile"));
          ok(!$("tailsheet").hidden && tiles.length === won.length && tiles.every((b) => big(b) && hitOK(b)) && hitOK($("ts-close")), "map long tail (v5 R3 fix): the chip opens a sheet of all " + tiles.length + " cleared pictures, each 44+ px and hittable");
          tiles[0].click(); ok($("tailsheet").hidden && app.entry === app.byId.get(won[0]) && app.screen === "play", "map long tail (v5 R3 fix): a tile in the sheet closes it and plays that picture again"); }
          // v5 R3 fix: everything cleared: no Play, the end line in its place, and (wide) the card says so with no side quest.
          for (const e of app.gal) Save.record(app.save.data, e.id, "gal"); showScreen("map");
          ok($("map-play").hidden && shown($("jr-end")) && $("jr-end").textContent === MT.endHint && t.b.hidden && !mapPic() && (!$("map").classList.contains("cards") || ($("jr-n-name").textContent === MT.allClear && $("jr-quest").hidden)),
            "map (v5 R3 fix): with every level and picture cleared, Play gives way to '" + $("jr-end").textContent + "'" + ($("map").classList.contains("cards") ? " and the card reads '" + $("jr-n-name").textContent + "'" : "")); }
        // v5 R3 fix: the next-up quest is the open one nearest the current level, and wears the gold ring; with levels 1-74
        // cleared and no pictures, no prize bubble or label covers another node, side quest or egg.
        { app.save = scratch(); for (let i = 0; i < 55; i++) Save.record(app.save.data, app.order[i]); for (let i = 0; i < 3; i++) Save.record(app.save.data, app.gal[i].id, "gal"); showScreen("map");
          const nq = nearQ(), want = app.gal.filter((e) => e.L.quest.after <= 55 && !app.save.data.gal[e.id]).pop();
          ok(nq === want && nq.node.classList.contains("next") && $("jr-quest").querySelector("b").textContent === fill(MT.sideQuest, { n: nq.n }), "map (v5 R3 fix): the next-up side quest is the open one nearest level 56 (picture " + (nq ? nq.n : "?") + "), gold-ringed");
          for (let i = 55; i < 74; i++) Save.record(app.save.data, app.order[i]); showScreen("map");
          const tg = Array.from(document.querySelectorAll("#jr .mn, #jr .qn:not([hidden]), #jr .egg:not([hidden])")), bad = [];
          for (const el of Array.from(document.querySelectorAll("#jr .qn.open .prz")).concat([J.label])) { if (!shown(el)) continue; const r = el.getBoundingClientRect(), own = el.closest(".qn, .mn");
            for (const x of tg) if (x !== own && !x.contains(el) && over(r, x.getBoundingClientRect())) { const o = over(r, x.getBoundingClientRect()).split("x"); if (o[0] * o[1] > 64) bad.push((own ? own.dataset.id : "label") + " x " + (x.dataset.id || x.dataset.n)); } }
          ok(!bad.length, "map (v5 R3 fix): no prize bubble or the current label covers another node, quest or egg (" + (bad.join(", ") || "none") + ")"); }
        app.save = scratch(); J.colW = 0; showScreen("title"); }
      // 25. v4 M5, the meta layer. The home: one tap on Play opens the right level (a new save: level 1; mid-campaign: the
      // first level not won), with the progress, the coins and (lives off) no heart; the tabs; the settings sheet. The
      // power-up bar through its real badges: round, bigger than a tile, hittable, inside the screen; buying (the price
      // off the coins, one owned); each power-up used through its badge (Ladder: a space; Scout: every ? face up;
      // Quartermaster: a tile to the front; Recall: a waiting squad back to its column) and refused (no target, past the
      // level's uses, short coins: nothing spent, a toast that says why). The report: a win's coins counting up, its time,
      // taps and best. The era report card. Lives forced on in a scratch copy of meta, then the shipped default (off).
      { const MT = app.meta, HT = MT.home, PWK = E.PW, inv = () => app.save.data.inv, coins = () => app.save.data.coins, tx = () => $("toast").textContent;
        const nHidden = () => { let n = 0; for (let c = 0; c < app.B.ncards; c++) if (app.S.hidden(c)) n++; return n; };
        app.save = scratch(); showScreen("title");
        ok($("play-lab").textContent === fill(HT.play, { n: app.levels[0].n }) && $("home-prog").textContent === "0/" + app.levels.length && $("home-coins").textContent === String(MT.coins.start) && $("home-lives").hidden && hitOK($("btn-play")) && hitOK($("btn-settings")),
          "home (a new save): Play reads '" + $("play-lab").textContent + "', progress " + $("home-prog").textContent + ", " + $("home-coins").textContent + " coins, no lives pill (meta.lives off); Play and the gear are hittable");
        $("btn-play").click(); ok(app.screen === "play" && app.entry === app.levels[0] && app.S.plays === 0 && !app.panel, "home: one tap on Play opens level 1, ready to play");
        for (let i = 0; i < 40; i++) Save.record(app.save.data, app.order[i]);
        showScreen("title"); const ne = app.byId.get(Save.next(app.save.data, app.order));
        ok($("play-lab").textContent === fill(HT.play, { n: ne.n }) && $("home-prog").textContent === "40/" + app.levels.length && $("home-era").textContent === fill(HT.era, { e: ne.era, name: app.eras[ne.era - 1].name }), "home (mid-campaign): Play reads '" + $("play-lab").textContent + "', progress " + $("home-prog").textContent + ", " + $("home-era").textContent);
        // v5.3: the realm line sits over Play, clear of the logo, the pills and the buttons and inside the home; it and the
        // pills hold WCAG AA (4.5:1) over any part of the painting (a translucent backing judged on white, the worst
        // case); the painting covers #title's own box (not the window) with the castle's centre within title.art.maxOff
        // of the box's centre (the harness sweeps the window widths).
        { fitTitle(); const TA = app.cfg.title.art, bx = $("title").getBoundingClientRect(), ch = $("home-era").getBoundingClientRect(), hits = ["btn-play", "play-lab", "home-prog", "home-coins", "btn-settings"].filter((id) => over(ch, $(id).getBoundingClientRect()));
          if (over(ch, document.querySelector(".home h1").getBoundingClientRect())) hits.push("h1");
          const nums = (v) => v.match(/[\d.]+/g).map(Number), hex = (m) => "#" + m.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, "0")).join(""), onWhite = (c) => c.slice(0, 3).map((x) => (c.length > 3 ? c[3] : 1) * x + (1 - (c.length > 3 ? c[3] : 1)) * 255);
          const cr = (el) => { const c = getComputedStyle(el), L1 = relLum(hex(nums(c.color))), L2 = relLum(hex(onWhite(nums(c.backgroundColor)))); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
          const crs = ["home-era", "home-prog", "home-coins"].map((id) => cr($(id))), g = homeArt(), ar = $("title-art").getBoundingClientRect();
          ok(!hits.length && ch.left >= bx.left - 0.5 && ch.right <= bx.right + 0.5 && crs.every((x) => x >= 4.5), "home (v5.3): the realm line sits over Play, clear of the logo, the pills and the buttons (" + hits.join(", ") + "); realm line and pills at " + crs.map((x) => x.toFixed(1)).join(", ") + ":1 (4.5 or more)");
          ok(Math.abs(ar.left - bx.left) < 0.5 && Math.abs(ar.width - bx.width) < 0.5 && Math.abs(ar.height - bx.height) < 0.5 && Math.abs(g.off) <= TA.maxOff && getComputedStyle($("title-art")).getPropertyValue("--art-x").trim() === (g.px * 100).toFixed(2) + "%",
            "home (v5.3): the painting (" + g.k + ") covers the home's own box (" + Math.round(g.w) + "x" + Math.round(g.h) + ", window " + innerWidth + "x" + innerHeight + ") with the castle's centre " + (g.off * 100).toFixed(1) + "% of its width off the box's centre (limit " + TA.maxOff * 100 + "%)"); }
        $("btn-play").click(); ok(app.screen === "play" && app.entry === ne, "home (mid-campaign): one tap on Play opens level " + ne.n);
        showScreen("title"); const tabsHit = hitOK($("btn-tomap")) && hitOK($("tab-home")) && !$("btn-gallery") && document.querySelectorAll(".tabs .tab").length === 2; $("btn-tomap").click(); const t1 = app.screen; $("btn-home").click(); const t2 = app.screen; $("tab-home").click(); const t3 = app.screen;
        ok(tabsHit && t1 === "map" && t2 === "title" && t3 === "title" && $("map-story").textContent === HT.story, "home tabs (v5 R3: Map and Home; the Gallery is the map): Map opens the map (the story is at its foot), back reaches Home; every tab is hittable");
        { $("btn-settings").click(); const open = !$("settings").hidden && hitOK($("set-close")), A = app.audio, s0 = [A.sfx, A.music], SS = () => app.save.data.settings;
          // v5.2: Music and Sound effects apart; the quick mute button (the Paused sheet's) mutes both and read "mixed" with one off.
          const mr = document.querySelector("#settings .tog-music"), fr = document.querySelector("#settings .tog-sfx"), pm = document.querySelector("#pause .tog-mute"), qm = pm, qp = () => pm.getAttribute("aria-pressed") + "/" + pm.getAttribute("aria-pressed"), sv = (b) => b.querySelector(".sv").textContent; // lands foundation: the play screen's quick mute became its gear; the Paused sheet's stays
          setSound(true, true, false); const hitRows = hitOK(mr) && hitOK(fr) && !document.querySelector("#settings .tog-mute");
          mr.click(); const a1 = !A.music && A.sfx && SS().music === false && SS().sfx === true && SS().muted === false && sv(mr) === "Off" && sv(fr) === "On" && mr.getAttribute("aria-pressed") === "false" && qp() === "mixed/mixed";
          fr.click(); const a2 = !A.music && !A.sfx && A.muted && SS().muted === true && sv(fr) === "Off" && qp() === "true/true";
          mr.click(); const a3 = A.music && !A.sfx && SS().music === true && qp() === "mixed/mixed";
          qm.click(); const a4 = !A.music && !A.sfx && SS().music === false && SS().sfx === false && qp() === "true/true" && sv(mr) === "Off" && sv(fr) === "Off";
          pm.click(); const a5 = A.music && A.sfx && SS().music && SS().sfx && !SS().muted && qp() === "false/false" && sv(mr) === "On";
          fr.click(); qm.click(); const a6 = !A.music && !A.sfx && qp() === "true/true"; qm.click(); // one off, then a quick mute: both off; the next: both on
          const a7 = A.music && A.sfx;
          const sp0 = app.speed; document.querySelector("#settings .tog-speed").click(); const sp1 = app.speed, lab = document.querySelector("#settings .tog-speed .sv").textContent; setSpeed(SPD[0], false); $("set-close").click(); setSound(s0[0], s0[1], false);
          ok(open && hitRows && a1 && a2 && a3 && a4 && a5 && a6 && a7 && sp1 !== sp0 && lab === sp1 + "×" && $("settings").hidden, "settings (v5.2; open, rows, closed: " + [open, hitRows, $("settings").hidden].map(Number).join("") + "): the gear opens the sheet; Music and Sound effects switch apart (each row reads On/Off and is saved: " + [a1, a2, a3].map(Number).join("") + "); the Paused sheet's quick mute reads mixed with one off and pressed with both (" + [a4, a5, a6, a7].map(Number).join("") + "): a quick mute turns both off, the next both on; (debug only, v5 R1) speed (" + lab + "); colour-blind is section 16; Done closes it"); }
        // Lands foundation (Peter, 2026-10-06): the play screen's gear (in the top bar, where the quick mute was) opens
        // Settings over the level and holds it still (the engine's time stands while it shows; the app clock runs on);
        // Done plays on with no jump. The bar still fits the screen and the gear is as big as the bar's other buttons.
        { startLevel(app.levels[0].id, "normal"); const g = $("btn-pset"), r = g.getBoundingClientRect(), rr = $("btn-retry").getBoundingClientRect(), hit = hitOK(g), tp = $("top");
          const kids = Array.from(tp.children).map((b) => b.getBoundingClientRect()), fits = kids.every((q, i) => q.left >= -0.5 && q.right <= innerWidth + 0.5 && kids.every((z, j) => j <= i || z.left >= q.right - 0.5)) && r.width >= rr.width - 0.5; // in the screen, side by side (the tap areas' 4 px past the faces don't count)
          const at = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === g || g.contains(t)); }, cy = r.top + r.height / 2, cx = r.left + r.width / 2, pad = (ST.minTapPx - r.width) / 2 - 0.5; // the tap area reaches minTapPx (style.css: 4 px round the face)
          const tapOK = r.width >= ST.minTapPx || (at(cx, Math.max(0.5, r.top - pad)) && at(cx, r.bottom + pad) && at(Math.min(innerWidth - 0.5, r.right + pad), cy) && at(r.left - pad / 2, cy)); // the screen's edge bounds it; the left neighbour shares the gap
          playCol(+winOf(app.entry)[0]); step(16); g.click(); const et0 = app.et, c0 = app.clock, live0 = livePlay(); for (let t = 0; t < 400; t += 16) step(16);
          const held = app.held && app.et === et0 && app.clock > c0 && !$("settings").hidden && !live0;
          $("set-close").click(); step(16); const on = !app.held && $("settings").hidden && app.et > et0 && app.et - et0 <= 16 * paceNow() + 0.5 && livePlay();
          out.notes.playGear = Math.round(r.width) + " px";
          ok(hit && fits && tapOK && held && on, "play gear (lands foundation; hit, fits, tap, held, on: " + [hit, fits, tapOK, held, on].map(Number).join("") + "): the top bar's gear (" + Math.round(r.width) + " px, as big as Retry, taking a " + ST.minTapPx + " px tap; the bar fits " + innerWidth + " px) opens Settings and holds the level still (engine time stood " + 400 + " ms while the app clock ran), and Done plays on with no jump"); }
        // Land 1 fix (the functional critic's m4): every round button in the play bar takes a full minTapPx square tap,
        // measured as the critic did (elementFromPoint walking out from its centre, the screen's edge included).
        { startLevel(app.levels[0].id, "normal"); const bad = [], sizes = [];
          for (const b of Array.from(document.querySelectorAll("#top button.round"))) { if (!shown(b)) continue; const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const on = (x, y) => { const t = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? document.elementFromPoint(x, y) : null; return !!t && (t === b || b.contains(t)); };
            const reach = (dx, dy) => { let d = 0; while (d < 40 && on(cx + (d + 1) * dx, cy + (d + 1) * dy)) d++; return d; }, w = reach(-1, 0) + reach(1, 0) + 1, h = reach(0, -1) + reach(0, 1) + 1;
            sizes.push(w + "x" + h); if (w < ST.minTapPx || h < ST.minTapPx) bad.push((b.id || b.className) + " " + w + "x" + h); }
          ok(sizes.length >= 3 && !bad.length, "play bar (Land 1 fix, m4): every round button takes a " + ST.minTapPx + " px square tap from its centre out at " + innerWidth + "x" + innerHeight + " (" + sizes.join(", ") + (bad.length ? "; short: " + bad.join(", ") : "") + ")"); }
        // The bar's geometry at this viewport.
        startLevel(app.levels[0].id, "normal");
        { const tileH = app.cards[0].getBoundingClientRect().height, rl = $("rail").getBoundingClientRect(), pw = $("powers").getBoundingClientRect(); let geo = true;
          const big = innerWidth >= 375 || app.pws.filter((q) => !q.hidden).length < 5; // v5 R1: five badges on a phone under 375 px wide can't all beat a tile; they keep the tap size
          app.pws.forEach((b) => { const r = b.getBoundingClientRect(); if (getComputedStyle(b).borderTopLeftRadius !== "50%" || Math.abs(r.width - r.height) > 1 || (big && r.width <= tileH - 0.5) || r.width < ST.minTapPx - 0.5 || !hitOK(b) || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5) geo = false; }); // Critics 2 fix (m4): a tap target
          const wideOK = !app.wide || pw.top >= rl.bottom - 0.5, tallOK = app.wide || pw.top >= rl.bottom - 0.5;
          out.notes.powerBar = Math.round(app.pws[0].getBoundingClientRect().width) + " px badges (tiles " + Math.round(tileH) + " px), bar " + Math.round(pw.height) + " px, " + app.rows + " queue rows" + ($("powers").classList.contains("grid") ? ", 2x2" : "");
          if (app.wide && !document.body.classList.contains("short")) { const sd = $("side").getBoundingClientRect(), used = $("top").getBoundingClientRect().height + rl.height + pw.height; out.notes.powerBarBlank = (100 * Math.max(0, 1 - used / sd.height)).toFixed(1) + "% of the side column not covered"; }
          ok(geo && wideOK && tallOK && (innerHeight > LY.shortRowsMaxH || app.rows === LY.queueRowsShort), "power-up bar: " + app.pws.filter((q) => !q.hidden).length + " round badges (" + out.notes.powerBar + "), each bigger than a tile and " + ST.minTapPx + " px or more, hittable and on screen, under the queue" + (innerHeight <= LY.shortRowsMaxH ? "; a short frame shows " + LY.queueRowsShort + " rows" : "")); }
        // Buying, then the Ladder.
        { const c0 = coins(), P = Meta.powerOf(MT, PWK.LADDER), b = app.pws[PWK.LADDER];
          ok(app.pws.every((q) => q.hidden || (q.classList.contains("buy") && q.classList.contains("poor") === Meta.powerOf(MT, +q.dataset.k).price > c0 && q.querySelector(".pw-n").textContent === "+" && !q.disabled)) && b.querySelector(".pw-tag span").textContent === String(P.price), "power-ups: none owned: every badge shows a + and its price, muted only when the price is over the coins (v5 R1: the Volley's " + Meta.powerOf(MT, 4).price + "); no disabled button");
          b.click(); const bought = coins() === c0 - P.price && inv().ladder === 1 && b.classList.contains("own") && b.querySelector(".pw-n").textContent === "1";
          const cap0 = app.S.cap; b.click();
          ok(bought && app.S.cap === cap0 + 1 && app.S.extra === 1 && inv().ladder === 0 && b.classList.contains("spent") && app.slots.filter((q) => !q.hidden).length === app.S.cap, "Ladder through its badge: bought (" + c0 + " -> " + (c0 - P.price) + " coins), then used: " + app.S.cap + " spaces show; one spent");
          const c1 = coins(); b.click();
          ok(coins() === c1 && inv().ladder === 0 && app.S.extra === 1 && tx() === fill(MT.power.limit, { name: P.name, n: app.S.limit(PWK.LADDER) }), "Ladder: past its uses this level the tap is refused (nothing bought or spent): '" + tx() + "'");
          app.save.data.coins = 70; renderPowers(); const pq = app.pws.map((q, k) => q.classList.contains("poor") === (k !== PWK.SCOUT && !q.classList.contains("spent"))), pc = getComputedStyle(app.pws[PWK.RECALL].querySelector(".pw-n")).backgroundColor !== getComputedStyle(app.pws[PWK.SCOUT].querySelector(".pw-n")).backgroundColor;
          ok(pq.every(Boolean) && pc && /need 30/.test(app.pws[PWK.RECALL].getAttribute("aria-label")), "power-ups (Critics 2 fix, m2): at 70 coins the buys over 70 look different (.poor, another '+' colour, the price in red; aria '" + app.pws[PWK.RECALL].getAttribute("aria-label") + "') and Scout (60) does not");
          app.save.data.coins = 5; renderPowers(); const sb = app.pws[PWK.SCOUT]; sb.click();
          ok(coins() === 5 && inv().scout === 0 && sb.classList.contains("poor") && !sb.disabled && tx() === fill(MT.power.short, { name: Meta.powerOf(MT, PWK.SCOUT).name, price: Meta.powerOf(MT, PWK.SCOUT).price, have: 5 }), "power-ups: short of coins a buy (.poor, still tappable) is refused and says so: '" + tx() + "'");
          app.save.data.coins = 1000; }
        // Scout on v4-mystery; refused where nothing is hidden.
        if (app.byId.has("v4-mystery")) { startLevel("v4-mystery", "normal"); inv().scout = 1; renderPowers(); const h0 = nHidden(); app.pws[PWK.SCOUT].click();
          ok(h0 > 0 && nHidden() === 0 && !document.querySelector("#tray .tile.mys") && inv().scout === 0 && app.S.used(PWK.SCOUT) === 1, "Scout through its badge: all " + h0 + " hidden squads turn face up (no ? tile left); one spent"); }
        startLevel(app.levels[0].id, "normal"); inv().scout = 1; renderPowers(); app.pws[PWK.SCOUT].click();
        ok(inv().scout === 1 && app.S.used(PWK.SCOUT) === 0 && tx() === MT.power.noScout, "Scout: nothing hidden: refused, nothing spent: '" + tx() + "'");
        // Quartermaster on the queue level: the badge asks for a target, a real tap on a tile pulls it to its column's front.
        { const e = app.byId.get(ST.queueLevel) || app.levels[39]; startLevel(e.id, "normal"); inv().quartermaster = 2; renderPowers(); const qb = app.pws[PWK.PULL]; qb.click();
          const pk = Array.from(document.querySelectorAll("#tray .tile.next.pickable")), asking = app.pick && app.pick.k === PWK.PULL && pk.length > 0 && qb.classList.contains("picking") && tx() === MT.power.pickPull;
          qb.click(); const cancelled = !app.pick && !document.querySelector(".pickable") && inv().quartermaster === 2;
          qb.click(); const el = document.querySelector("#tray .tile.next.pickable"), j = el ? app.nexts.findIndex((nx) => nx.indexOf(el) >= 0) : -1, d = j >= 0 ? app.nexts[j].indexOf(el) + 1 : 0, ci = j >= 0 ? app.S.card(j, d) : -1;
          if (el) el.click();
          const sq = app.S.order().find((q) => app.S.spM[q] === app.B.cardM[ci]);
          ok(asking && cancelled && ci >= 0 && app.S.lineLen === 1 && sq != null && app.slots[sq].classList.contains("full") && app.S.card(j, d) !== ci && inv().quartermaster === 1 && !app.pick && !document.querySelector(".pickable"),
            "Quartermaster through its badge (v5 R1): it asks (" + pk.length + " tiles glow), a second tap cancels (nothing spent), then a tap on a tile (column " + j + ", row " + (d + 1) + ") sends that squad straight into a space; one spent"); }
        if (app.byId.has("v4-mystery")) { startLevel("v4-mystery", "normal"); inv().quartermaster = 1; renderPowers(); app.pws[PWK.PULL].click();
          const el = Array.from(document.querySelectorAll("#tray .tile.next.pickable.mys"))[0], j = el ? app.nexts.findIndex((nx) => nx.indexOf(el) >= 0) : -1, ci = el ? app.S.card(j, app.nexts[j].indexOf(el) + 1) : -1; if (el) el.click();
          const sq = app.S.order().find((q) => app.S.spM[q] === app.B.cardM[ci]);
          ok(!!el && !app.S.hidden(ci) && sq != null && app.slots[sq].style.getPropertyValue("--mc") === mat(app.B.cardM[ci]).c, "Quartermaster on a ? tile (v5 R1): it goes out revealed, its space in its colour"); }
        // v5 R1, the Volley: the badge asks for a colour (face-up tiles and squads glow, never a hidden tile); a real tap
        // on a front tile clears that colour from the board, the queue and the line; one spent.
        { const e = app.byId.get(ST.queueLevel) || app.levels[39]; startLevel(e.id); inv().volley = 1; renderPowers(); const vb = app.pws[PWK.VOLLEY]; vb.click();
          const pk = Array.from(document.querySelectorAll("#tray .tile.pickable")), hid = pk.some((x) => x.classList.contains("mys")), j = app.cards.findIndex((c) => c.classList.contains("pickable")), m = j >= 0 ? app.B.cardM[app.S.front(j)] : 0;
          if (j >= 0) app.cards[j].click(); let cardsLeft = 0; for (let jj = 0; jj < E.NCOL; jj++) for (let d = 0, ci = app.S.card(jj, 0); ci >= 0; ci = app.S.card(jj, ++d)) if (app.B.cardM[ci] === m) cardsLeft++;
          ok(pk.length > 0 && !hid && j >= 0 && app.S.left[m] === 0 && cardsLeft === 0 && app.S.sappers(m) === 0 && inv().volley === 0 && app.S.used(PWK.VOLLEY) === 1 && !app.pick && hitOK(vb), "Volley through its badge: it asks (" + pk.length + " tiles glow, none hidden), a tap on a front tile clears its colour (" + mat(m).crew + ") from the board, the queue and the line; one spent"); }
        // v5 R1, unlocks and tips: a fresh campaign shows the Ladder only, with its free use and its intro tip; at reach 25
        // the Quartermaster appears with its free use and intro (once); the Gallery and debug levels follow the campaign;
        // the engine allows a hidden power-up nothing; a long press shows a tip and doesn't use the badge.
        { app.allPw = false; const sv = app.save; app.save = scratch(); app.save.data.got = {}; // a fresh campaign
          try { startLevel(app.levels[0].id); const vis = () => app.pws.map((b) => (b.hidden ? 0 : 1)).join("");
            const v1 = vis(), t1 = app.tip && app.tip.intro && app.tip.k === PWK.LADDER && !$("pwtip").hidden && $("pwtip").querySelector(".tt-b").textContent === Meta.powerOf(MT, 0).tip, i1 = inv().ladder, lim1 = app.S.limit(PWK.PULL);
            ok(v1 === "10000" && t1 && i1 === 1 && app.save.data.got.ladder === 1 && lim1 === 0 && !app.S.canPower(PWK.VOLLEY, 1), "unlocks: a fresh campaign shows the Ladder only (" + v1 + "), its free use and its intro tip; the engine allows the hidden ones nothing");
            for (let t = 0; t <= MT.tipIntroMs + 32; t += 16) step(16); const gone = !app.tip && $("pwtip").hidden;
            for (let i = 0; i < 24; i++) Save.record(app.save.data, app.order[i]); startLevel(app.order[24]);
            const v2 = vis(), t2 = app.tip && app.tip.intro && app.tip.k === PWK.PULL, i2 = inv().quartermaster; startLevel(app.order[24]); const again = !app.tip && inv().quartermaster === i2;
            ok(gone && v2 === "11000" && t2 && i2 === 1 && again, "unlocks: the intro goes after " + MT.tipIntroMs + " ms; at level 25 the Quartermaster appears (" + v2 + ") with one free use and its intro, given once");
            if (app.gal.length) { startLevel(app.gal[0].id); ok(vis() === "11000", "unlocks: a Gallery picture shows what the campaign has unlocked"); }
            startLevel(app.order[24]); const b0 = app.pws[PWK.PULL], ev = (t) => b0.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerType: "touch" }));
            ev("pointerdown"); for (let t = 0; t < MT.tipHoldMs + 48; t += 16) step(16); const held = app.tip && app.tip.k === PWK.PULL && !app.tip.intro; ev("pointerup"); b0.click();
            ok(held && !app.pick && inv().quartermaster === 1 && !app.tip, "tips: a long press shows the Quartermaster's tip; letting go hides it and the badge isn't used"); }
          finally { app.save = sv; app.allPw = true; if (app.tip) hideTip(); app.tipQ = []; } }
        // Recall: a squad waiting stuck goes back to its column's front through a real tap on its space.
        { let got = null; for (const e of app.levels) { if (e.n < 16) continue; startLevel(e.id, "normal"); const tp = stageLine(1, 0); if (tp) { got = { e, tp }; break; } }
          if (ok(!!got, "Recall: found a level whose front can't reach a block (a squad that waits)")) {
            inv().recall = 1; renderPowers(); const s0 = app.S.order(app.ord)[0], m = app.S.spM[s0], n = app.S.spW[s0], j = +got.tp[got.tp.length - 1], rb = app.pws[PWK.RECALL]; rb.click();
            const glow = app.slots[s0].classList.contains("pickable"); app.slots[s0].click(); const f = app.S.front(j);
            ok(glow && app.S.lineLen === 0 && f >= 0 && app.B.cardM[f] === m && app.S.count(f) === n && app.cards[j].querySelector(".n").textContent === String(n) && inv().recall === 0, "Recall through its badge and a tap on the space: the waiting " + mat(m).crew + " (" + n + ") go back to column " + j + "'s front, the space is free; one spent (" + got.e.id + ")"); } }
        startLevel(app.levels[0].id, "normal"); inv().recall = 1; renderPowers(); app.pws[PWK.RECALL].click();
        ok(inv().recall === 1 && !app.pick && tx() === MT.power.noRecall, "Recall: no squad waiting: refused, nothing spent: '" + tx() + "'");
        // The report: the first Hard level not yet cleared (v4.3: coins by tag, a first-clear bonus), time, taps, the count-up.
        { const e = app.levels.find((x) => tagOf(x) === "hard" && !app.save.data.done[x.id]) || app.levels[2], o = winOf(e), c0 = coins(), want = Meta.winCoins(MT, tagOf(e), true);
          startLevel(e.id); patient(o.slice(0, -1)); tick(5000); playCol(+o[o.length - 1]); settleNow(); for (let t = 0; t < 12000 && !app.panel; t += 16) step(16);
          const R = app.report, early = $("p-coins").textContent; for (let t = 0; t < MT.report.countDelayMs + MT.report.countMs + 48; t += 16) step(16);
          ok(app.panel === "win" && !!R && R.coins === want && coins() === c0 + want && R.taps === app.S.plays && R.ms >= 5000 && $("p-time").textContent === Meta.clock(R.ms) && $("p-taps").textContent === String(R.taps) && early === "+0" && $("p-coins").textContent === "+" + want && !$("p-stats").hidden && $("p-pic").hidden && hitOK($("p-primary")),
            "report (a first clear of " + e.id + ", Hard): +" + want + " coins counted up (" + early + " -> " + $("p-coins").textContent + "), time " + $("p-time").textContent + ", taps " + $("p-taps").textContent + ", the first-clear line '" + $("p-stats").children[2].querySelector("em").textContent + "' (no picture: a siege level); the save's coins follow");
          if (app.wide) { for (const an of $("panel").firstElementChild.getAnimations()) an.finish(); const sh = $("panel").getBoundingClientRect(), rl = $("rail").getBoundingClientRect(), pw = $("powers").getBoundingClientRect(), cd = $("panel").firstElementChild, k = cd.scrollHeight;
            ok(sh.top <= rl.top + 0.5 && sh.bottom >= rl.bottom - 0.5 && (sh.height <= Math.max(rl.height, k) + 12) && (document.body.classList.contains("short") || sh.bottom < pw.bottom - 1), "report (Critics 2 fix, m8): on a wide screen the win sheet covers the rail and is the rail's height or its content's (" + Math.round(sh.height) + " px against the rail's " + Math.round(rl.height) + ", content " + k + ", sheet " + Math.round(sh.top) + "-" + Math.round(sh.bottom) + ", rail " + Math.round(rl.top) + "-" + Math.round(rl.bottom) + "); the power-up bar's foot stays in view"); }
          const firstEm = $("p-stats").children[0].querySelector("em").textContent; startLevel(e.id); patient(o.slice(0, -1)); tick(2000); playCol(+o[o.length - 1]); settleNow(); for (let t = 0; t < 12000 && !app.panel; t += 16) step(16);
          const R2 = app.report, b = Meta.bestOf(app.save.data, e.id);
          ok(R2.coins === Meta.winCoins(MT, "hard", false) && R2.newMs && !R2.newTaps && $("p-stats").children[0].querySelector("em").textContent === MT.report.newBest && $("p-stats").children[1].querySelector("em").textContent === fill(MT.report.best, { v: R.taps }) && b[0] === R2.ms && b[1] === R.taps && firstEm === MT.report.first && $("p-stats").children[2].querySelector("em").textContent === "",
            "report (again): +" + R2.coins + " (no first-clear bonus); faster: '" + MT.report.newBest + "'; taps tied: '" + $("p-stats").children[1].querySelector("em").textContent + "'; the save keeps the best of each");
          // v5.1 AD HOOK, the x2 reward. Off (config meta.double.on false) the win sheet renders no x2 button. Switched on (a
          // copy of meta, this test only) a paid win shows it, hittable; a tap goes through adReward's stub and pays the
          // level's coins once more (the count runs on to the doubled sum); a second tap or call pays nothing; Retry's next
          // win offers it again.
          { const off = app.meta.double.on === false && $("p-x2").hidden && !shown($("p-x2")), m0 = app.meta, bt = $("p-x2"), win = () => { patient(o.slice(0, -1)); tick(2000); playCol(+o[o.length - 1]); settleNow(); for (let t = 0; t < 12000 && !app.panel; t += 16) step(16); };
            app.meta = Object.assign({}, m0, { double: Object.assign({}, m0.double, { on: true }) });
            try { startLevel(e.id); win(); const R4 = app.report, c0 = coins(), on = shown(bt) && hitOK(bt) && bt.querySelector(".pl").textContent === m0.double.btn && sheetClear(true) === true;
              bt.click(); const c1 = coins(), gone = bt.hidden, tx1 = tx(), again = onDouble(); bt.click(); for (let t = 0; t < MT.report.countDelayMs + MT.report.countMs + 48; t += 16) step(16);
              const tw = $("p-coins").textContent; retry(); win(); const re = shown(bt);
              ok(off && on && c1 === c0 + R4.coins && R4.dbl === R4.coins && gone && again === 0 && coins() === c1 + app.report.coins && tw === "+" + 2 * R4.coins && tx1 === fill(m0.double.toast, { n: R4.coins }) && re,
                "v5.1 AD HOOK: off, no x2 button; on (test only), the win shows '" + m0.double.btn + "', a tap pays +" + R4.coins + " once more (count " + tw + ", toast '" + tx1 + "'), a second pays nothing; Retry's win offers it again"); }
            finally { app.meta = m0; } } }
        if (app.byId.has("v4-linked")) { const c0 = coins(); startLevel("v4-linked"); patient(winOf(app.entry)); settleNow(); for (let t = 0; t < 12000 && !app.panel; t += 16) step(16); ok(app.panel === "win" && coins() === c0 && $("p-stats").hidden, "report: a debug level earns nothing and shows no report rows"); }
        if (app.gal.length) { const g = app.gal[0], c0 = coins(); startLevel(g.id); patient(winOf(g)); settleNow(); for (let t = 0; t < 12000 && !app.panel; t += 16) step(16);
          ok(app.panel === "win" && coins() === c0 + Meta.winCoins(MT, tagOf(g), true) && !$("p-stats").hidden && Meta.bestOf(app.save.data, g.id)[1] === app.report.taps, "report: a Gallery picture gets the same report (+" + app.report.coins + " coins, best kept per picture)"); }
        { showScreen("map"); const re = app.jr ? app.jr.realm : 1, rc = $("jr-rc"), ls = app.levels.filter((e) => e.era === re), won = ls.filter((e) => app.save.data.done[e.id]).length, cs = ls.reduce((a, e) => a + Meta.bestOf(app.save.data, e.id)[2], 0);
          ok(rc.querySelector(".rc-n").textContent === fill(MT.eraCard.cleared, { n: won, t: ls.length }) && rc.querySelector(".rc-c b").textContent === String(cs) && !rc.querySelector(".rc-m"), "map (v5 R3, the realm card): realm " + re + "'s report: " + rc.querySelector(".rc-n").textContent + ", no medals (v4.3), " + rc.querySelector(".rc-c b").textContent + " coins"); }
        // Lives, forced on in a scratch copy of meta with a test clock.
        { let T = 1.8e12; const per = MT.livesRefillMin * 60000; app.meta = Object.assign({}, MT, { lives: true }); app.now = () => T; app.save = scratch(); showScreen("title");
          ok(!$("home-lives").hidden && $("home-lives").textContent === String(app.meta.livesMax) && hitOK($("btn-play")), "lives on (a scratch copy of meta): the home shows " + app.meta.livesMax + " lives");
          if (jp) { startLevel(jp.e.id); patient(jp.p.prefix); for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) step(16);
            ok(app.panel === "fail" && Meta.lives(app.save.data, app.meta, T).n === app.meta.livesMax - 1 && $("p-line").textContent.indexOf(fill(HT.lifeLost, { n: app.meta.livesMax - 1 })) >= 0, "lives on: a fail costs one (the sheet says '" + fill(HT.lifeLost, { n: app.meta.livesMax - 1 }) + "')"); }
          app.save.data.lives = { n: 0, at: T }; showScreen("title"); const lab0 = $("play-lab").textContent; $("btn-play").click();
          ok(lab0 === fill(HT.noLives, { t: Meta.clock(per, true) }) && $("btn-play").classList.contains("wait") && app.screen === "title" && tx() === fill(HT.noLivesToast, { t: Meta.clock(per, true) }), "lives on, none left: Play reads '" + lab0 + "' and a tap starts nothing (the toast says when)");
          T += per; step(16); const lab1 = $("play-lab").textContent; $("btn-play").click();
          ok(lab1 === fill(HT.play, { n: app.byId.get(Save.next(app.save.data, app.order)).n }) && app.screen === "play" && Meta.lives(app.save.data, app.meta, T).n === 1, "lives on: one comes back after " + MT.livesRefillMin + " minutes; Play starts the level again");
          app.meta = MT; app.now = was.now; app.save = scratch(); showScreen("title");
          ok(app.cfg.meta.lives === false && $("home-lives").hidden && !$("btn-play").classList.contains("wait"), "lives: the shipped default is off; no heart shows on the home"); }
      }
      // 26. v4.3. The tags: every map button wears its level's (layout.tags; Normal unmarked), Hard in the warning colour
      // and Easy in the calm one; the top bar's chip on a Hard and a Normal level. The save is format 2 (no difficulty).
      // A space frees at its squad's last pickup: on real ticks the space shows free while its carriers still walk home,
      // and the sheet waits until every sapper is home.
      { showScreen("map"); const bad = app.levels.filter((e) => { const i = e.node.querySelector(".tag"), t = (LY.tags || {})[tagOf(e)] || ""; return i.textContent !== t || i.hidden !== !t || !i.classList.contains("tag-" + tagOf(e)); }).map((e) => e.id);
        const hn = app.levels.find((e) => tagOf(e) === "hard"), en = app.levels.find((e) => tagOf(e) === "easy"), hc = hn && getComputedStyle(hn.node.querySelector(".tag")).backgroundColor, ec = en && getComputedStyle(en.node.querySelector(".tag")).backgroundColor;
        ok(!bad.length && hn && en && hc !== ec && hn.node.querySelector(".tag").textContent === LY.tags.hard, "tags (v4.3): every map button wears its level's tag (Hard " + hc + ", Easy " + ec + ", Normal unmarked)" + (bad.length ? " (" + bad.slice(0, 5).join(",") + ")" : ""));
        startLevel(hn.id); const hk = $("tag-chip"), hr = shown(hk) && hk.textContent === LY.tags.hard && hk.classList.contains("tag-hard") && app.S.cap === rulesOf("hard").hold;
        const nn = app.levels.find((e) => tagOf(e) === "normal"); startLevel(nn.id); const nr = $("tag-chip").hidden && app.S.cap === rulesOf("normal").hold;
        ok(hr && nr, "tags (v4.3): the top bar shows " + hn.id + "'s Hard tag (4 spaces) and nothing on " + nn.id + " (Normal, 5 spaces)");
        ok(app.save.data.v === Save.VERSION && Save.VERSION === 2 && !("diff" in app.save.data.settings) && !document.querySelector(".seg") && !$("p-medals"), "save (v4.3): format 2, no difficulty setting; no difficulty picker anywhere, no medals"); }
      { let e = null, seen = null; // v5 R2: the first Normal level from 26 whose first squad finishes on its own (a dealt squad may wait parked)
        for (const x of app.levels.filter((x) => x.n >= 26 && tagOf(x) === "normal" && !x.L.links).slice(0, 8)) { if (seen) break; e = x; startLevel(e.id); const o = winOf(e); playCol(+o[0]);
          const s0 = app.S.order(app.ord)[0];
          for (let t = 0; t < ST.tickCapMs && !seen && app.S.busy; t += 16) { step(16); if (!app.S.spQ[s0] && app.S.out > 0) seen = { out: app.S.out, live: app.V.live, slot: app.slots[s0].classList.contains("full"), ms: app.S.now }; } }
        ok(!!seen && seen.live > 0 && !seen.slot, "pickup (v4.3): " + e.id + "'s first squad frees its space at its last pickup while " + (seen ? seen.out : "?") + " carriers still walk home (the space shows free, " + (seen ? seen.live : 0) + " runners drawn)");
        out.notes.pickup = e.id + (seen ? " at " + seen.ms + " ms, " + seen.out + " carrying" : ""); }
      // 27. v4.3 fix pass. T1: every Play wears the next level's tag (home, map, the report's Next, the Gallery's chip), a
      // Hard one's face red-gold. m6: both tag pills 4.5:1 or more. m1: the line head's return count while carriers walk
      // home. m2: a wide screen's toast sits over the side column's tray. m3: a first clear's ribbon and the coin burst.
      // m4: the locked wall's tags dimmed; a locked painting a two-tone stencil. m5: a wide fail sheet its content's height.
      { const LY2 = app.cfg.layout, cr = (el) => { const p = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number), lu = (rgb) => { const f = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
          const c = getComputedStyle(el), a = lu(p(c.color)), b = lu(p(c.backgroundColor)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
        app.save = scratch(); const hn = app.levels.find((e) => tagOf(e) === "hard"), nn = app.levels.find((e) => tagOf(e) === "normal" && e.n > 3);
        for (const e of app.levels) { if (e.n >= hn.n) break; Save.record(app.save.data, e.id); }
        showScreen("title"); const pt = $("play-tag"), hardFace = getComputedStyle($("btn-play")).backgroundColor, h1 = !pt.hidden && pt.textContent === LY2.tags.hard && $("btn-play").classList.contains("hard") && hitOK($("btn-play"));
        showScreen("map"); const mp = $("map-play"), m1 = mp.classList.contains("hard") && mp.querySelector(".tag").textContent === LY2.tags.hard && hitOK(mp);
        app.save = scratch(); for (const e of app.levels) { if (e.n >= nn.n) break; Save.record(app.save.data, e.id); }
        showScreen("title"); const n1 = pt.hidden && !$("btn-play").classList.contains("hard") && getComputedStyle($("btn-play")).backgroundColor !== hardFace;
        ok(h1 && m1 && n1, "T1 (v4.3 fix): the home's and the map's Play wear the next level's tag (" + hn.id + ": Hard, a red-gold face " + hardFace + "; " + nn.id + ": Normal, unmarked)");
        const easy = document.querySelector(".tag.tag-easy:not([hidden])") || (() => { const t = document.createElement("i"); t.className = "tag tag-easy"; t.textContent = "Easy"; document.body.append(t); return t; })(), hard = document.querySelector(".tag.tag-hard");
        const ce = cr(easy), ch = hard ? cr(hard) : 0; if (!easy.closest("#app")) easy.remove();
        ok(ce >= 4.5 && ch >= 4.5, "m6 (v4.3 fix): the Easy pill " + ce.toFixed(2) + ":1, the Hard pill " + ch.toFixed(2) + ":1 (4.5 or more)");
        // m1: real ticks on a Normal level's first squad until its space frees with carriers out.
        { let got = null; // v5 R2: the first such level whose first squad finishes on its own
          for (const e of app.levels.filter((x) => x.n >= 26 && tagOf(x) === "normal" && !x.L.links).slice(0, 8)) { if (got) break; startLevel(e.id); playCol(+winOf(e)[0]);
            for (let t = 0; t < ST.tickCapMs && !got && app.S.busy; t += 16) { step(16); if (app.S.lineLen === 0 && app.S.out > 0) got = { n: carrying(), r: $("line-cnt").lastElementChild }; } }
          const shownN = got && !got.r.hidden ? +got.r.querySelector("b").textContent : -1; settleNow(); step(16);
          ok(!!got && got.n > 0 && shownN === got.n && $("line-cnt").lastElementChild.hidden, "m1 (v4.3 fix): with the space free and " + (got ? got.n : "?") + " carriers walking home the line head shows ↩" + shownN + "; at rest it goes"); }
        // m2: the toast on a refused linked tap (v4-all at load).
        { startLevel("v4-all"); const j = app.cards.findIndex((b, k) => app.S.front(k) >= 0 && app.S.why(k) === 3); playCol(j); const t = $("toast").getBoundingClientRect(), c = app.cards[j].getBoundingClientRect(), sd = $("side").getBoundingClientRect(), ty = $("tray").getBoundingClientRect();
          const cx = (t.left + t.right) / 2, near = app.wide ? cx >= sd.left && cx <= sd.right && t.bottom <= ty.top + 1 && t.bottom >= ty.top - 40 : $("toast").classList.contains("side") === false;
          ok(!$("toast").hidden && near && t.left >= -0.5 && t.right <= innerWidth + 0.5 && t.top >= -0.5, "m2 (v4.3 fix): the refusal's toast " + (app.wide ? "sits over the side column's tray, " + Math.round(Math.hypot(cx - (c.left + c.right) / 2, (t.top + t.bottom) / 2 - (c.top + c.bottom) / 2)) + " px from the tapped card" : "stays at the board's foot (not wide)")); hideToast(); }
        // m3: a first clear's ribbon and, as the coins start, the burst (unless reduced motion).
        { app.save = scratch(); const e = app.levels.find((x) => x.n > 3 && tagOf(x) === "easy") || app.levels[0]; startLevel(e.id); patient(winOf(e)); settleNow(); for (let t = 0; t < 12000 && !app.panel; t += 16) step(16);
          const rb = $("p-ribbon"), rib = !rb.hidden && rb.textContent === fill(app.meta.report.firstClear, { n: app.meta.coins.first[tagOf(e)] }); for (let t = 0; t < app.meta.report.countDelayMs + 64; t += 16) step(16);
          const go = $("p-stats").querySelector(".coin").classList.contains("go") === !app.V.calm, sl = sheetClear(true);
          startLevel(e.id); patient(winOf(e)); settleNow(); for (let t = 0; t < 12000 && !app.panel; t += 16) step(16);
          ok(rib && go && sl === true && $("p-ribbon").hidden, "m3 (v4.3 fix): a first clear wears the ribbon '" + rb.textContent + "' and its coins burst" + (app.V.calm ? " (reduced motion: no burst)" : "") + "; a repeat clear has no ribbon (" + sl + ")"); }
        // m4 (v5 R3): the locked wall is gone with the Gallery; a locked level node hides its tag, an open one shows it.
        { app.save = scratch(); for (let i = 0; i < 6; i++) Save.record(app.save.data, app.order[i]); showScreen("map"); const open = app.levels.slice(0, 6).filter((e) => tagOf(e) !== "normal"), lk = app.levels.slice(8).find((e) => tagOf(e) !== "normal");
          ok(open.length && open.every((e) => shown(e.node.querySelector(".tag"))) && lk && !shown(lk.node.querySelector(".tag")), "m4 (v5 R3): cleared nodes wear their tags (" + open.map((e) => e.n).join(", ") + "); a locked one (" + lk.n + ") keeps quiet"); showScreen("title"); }
        // m5: a fail sheet on a wide screen is its content's height.
        if (jp && app.wide) { startLevel(jp.e.id); patient(jp.p.prefix); for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) step(16);
          const card = $("panel").firstElementChild; for (const an of card.getAnimations()) an.finish(); const r = card.getBoundingClientRect(); let lo = 1e9, hi = 0; /* the sheet's slide-in landed */ for (const el of card.children) { const q = el.getBoundingClientRect(); if (el.hidden || !q.height) continue; lo = Math.min(lo, q.top); hi = Math.max(hi, q.bottom); }
          const rb2 = $("rail").getBoundingClientRect().bottom, fl = $("panel").classList.contains("float"); // a sheet floating above the line (a short screen) is content-sized already
          ok(app.panel === "fail" && (fl || (hi > lo && r.bottom <= Math.max(r.top + (hi - lo) + 60, rb2 + 1))) && sheetClear() === true, "m5 (v4.3 fix): the wide fail sheet is its content's height, down to the tray's foot at most (" + Math.round(r.height) + " px" + (fl ? ", floating above the line" : " for " + Math.round(hi - lo) + " px of content")  + ")"); }
        app.save = scratch(); }
      // v5.2, music: no context and no fetch before a gesture; the track per screen and realm; the crossfade, the jingle's
      // duck and the switches on an offline context (silent, no fetch: its buffers are made here).
      { const MU = app.cfg.audio.music, A = app.audio, fresh = Audio.create(app.cfg.audio, (f) => f); Audio.want(fresh, "theme"); Audio.kick(fresh);
        ok(fresh.ctx === null && fresh.fetches === 0 && fresh.want === "theme" && !Object.keys(fresh.loading).length && (A.ctx ? A.firstFetchAt < 0 || A.firstFetchAt >= A.unlockAt : A.fetches === 0 && A.firstFetchAt < 0) && A.hush,
          "music (v5.2): no context and no fetch before a gesture (a fresh player waits on the theme); here " + (A.ctx ? "the context is " + A.ctx.state + " since the first gesture, its first fetch " + (A.firstFetchAt < 0 ? "not yet" : Math.round(A.firstFetchAt - A.unlockAt) + " ms after it") : "no gesture yet: no context, nothing fetched") + "; selfTest runs hushed");
        const at = (n) => app.levels.find((e) => e.n === n), pk = [];
        showScreen("title"); pk.push(A.want); showScreen("map"); pk.push(A.want);
        for (const n of [1, 174, 175, 200]) { const e = at(n); if (e) startLevel(e.id); pk.push(e ? A.want : "none"); }
        if (app.gal[0]) { startLevel(app.gal[0].id); pk.push(A.want); } showScreen("map"); pk.push(A.want);
        ok(pk.join(",") === "theme,theme,play,play,boss,boss,play,theme", "music (v5.2): home and map the theme; levels 1 and 174 the play loop; realm 8's 175 and 200 the boss loop; a side quest the play loop; back on the map the theme (" + pk.join(",") + ")");
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (OAC) { const X = Audio.create(app.cfg.audio, (f) => f), oc = new OAC(2, 4410, 44100); Audio.attach(X, oc);
          for (const k of Object.keys(MU.tracks)) X.bufs[k] = oc.createBuffer(2, 4410, 44100);
          Audio.want(X, "theme"); const c1 = X.cur && X.cur.name, src1 = X.cur && X.cur.src; Audio.want(X, "theme"); const kept = X.cur && X.cur.src === src1 && X.switches === 0;
          Audio.want(X, "play"); const c2 = X.cur && X.cur.name, sw = X.switches, lp = X.cur && X.cur.src.loop && X.cur.src.loopStart === MU.tracks.play.loopStart && X.cur.src.loopEnd === MU.tracks.play.loopEnd;
          const j = Audio.jingle(X); Audio.setMusic(X, false); const off = X.cur === null && !X.music && X.sfx && Audio.state(X) === "mixed";
          Audio.want(X, "boss"); const held = X.cur === null && X.want === "boss"; Audio.setMusic(X, true); const c3 = X.cur && X.cur.name;
          Audio.setSfx(X, false); const fx = !X.sfx && X.music && X.out.gain.value === 0 && X.cur && Audio.state(X) === "mixed"; Audio.setMuted(X, true); const all = X.muted && !X.cur;
          ok(c1 === "theme" && kept && c2 === "play" && sw === 1 && lp && j && X.ducked >= 0 && off && held && c3 === "boss" && fx && all && X.fetches === 0,
            "music (v5.2, offline context): a track starts, asking again keeps it, a new one crossfades in (looping between its loop points); the jingle ducks it; Music off stops it and a wanted track waits; on starts it; effects off leaves the music; both off stops it (" + [c1, c2, c3].join(",") + ")"); }
        else ok(true, "music (v5.2): no OfflineAudioContext here, the offline checks skipped");
        showScreen("title"); }
      // 26. v5.4: reset and the save code, through the real buttons on scratch saves. Settings: the code's rows (only with
      // saveCode on) and, after Done, Reset progress; each row hittable and minTapPx tall, the card inside the screen or
      // scrolling inside itself. Reset: Cancel changes nothing; a hold let go early changes nothing and empties its fill;
      // a full hold (a pointer, then Space held) clears the progress, keeps the preferences and lands on the home at level 1
      // with the toast over it. Copy then load: the code in its box with its length (the clipboard faked; refused: the box
      // selected to copy by hand), a reset, the code pasted back: a changed character, a truncated code and other text are
      // refused (apply disabled); the code itself shows what it holds and what it replaces, and applying restores the save.
      if (app.gal.length >= 2) {
        const RS = app.cfg.reset, RTx = RS.text, CTx = app.cfg.saveCode.text, HT = app.meta.home, card = $("settings").querySelector(".sheetcard"), hb = $("rs-hold"), fl = hb.querySelector(".fill");
        const canon = (o) => (Array.isArray(o) ? "[" + o.map(canon).join() + "]" : o && typeof o === "object" ? "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canon(o[k])).join() + "}" : JSON.stringify(o));
        const mkProg = () => { app.save = scratch(); const d = app.save.data; for (let i = 0; i < 6; i++) Save.record(d, app.order[i]); d.best[app.order[0]] = [41234, 17, 30]; Save.record(d, app.gal[0].id, "gal"); Save.record(d, app.gal[1].id, "gal");
          d.coins = 999; d.inv.ladder = 4; d.eggs["s1-0"] = 1; d.last = app.order[5]; d.settings.music = false; d.settings.cb = true; return canon(d); };
        const into = (el) => { const r = el.getBoundingClientRect(), q = card.getBoundingClientRect(); if (r.top < q.top) card.scrollTop -= q.top - r.top; else if (r.bottom > q.bottom) card.scrollTop += r.bottom - q.bottom; return el; };
        const pe = (el, k) => el.dispatchEvent(new PointerEvent(k, { bubbles: true, button: 0, pointerId: 1, isPrimary: true })), ke = (el, k) => el.dispatchEvent(new KeyboardEvent(k, { key: " ", bubbles: true, cancelable: true }));
        const holdFor = (ms) => { let t = 0; while (app.hold >= 0 && t < ms) { step(16); t += 16; } return t; };
        const wiped = (d) => !Object.keys(d.done).length && !Object.keys(d.gal).length && !Object.keys(d.eggs).length && !Object.keys(d.best).length && d.coins === app.meta.coins.start && d.inv.ladder === 0 && !Object.keys(d.got).length;
        const kept = (d) => d.settings.music === false && d.settings.cb === true && d.settings.sfx === true;
        const home1 = () => app.screen === "title" && $("play-lab").textContent === fill(HT.play, { n: app.levels[0].n }) && $("home-coins").textContent === String(app.meta.coins.start);
        // Settings.
        const p0 = mkProg(); showScreen("title"); $("btn-settings").click(); card.scrollTop = 0;
        const cr = card.getBoundingClientRect(), rows = ["set-music", "set-copy", "set-load", "set-close", "set-reset"].map((k) => (k === "set-music" ? document.querySelector("#settings .tog-music") : $(k)));
        const inScreen = cr.top >= -0.5 && cr.left >= -0.5 && cr.bottom <= innerHeight + 0.5 && cr.right <= innerWidth + 0.5, scrolls = card.scrollHeight > card.clientHeight + 1;
        const rowsOK = rows.every((el) => !el.hidden && hitOK(into(el)) && el.getBoundingClientRect().height >= ST.minTapPx - 0.5), lastRow = card.lastElementChild === $("set-reset") && $("set-reset").previousElementSibling.contains($("set-close"));
        app.cfg.saveCode.on = false; progressText(); const offRows = $("set-copy").hidden && $("set-load").hidden && $("rs-first").hidden && !$("set-reset").hidden; app.cfg.saveCode.on = true; progressText();
        ok(inScreen && rowsOK && lastRow && offRows, "settings (v5.4): Copy save code, Load save code, Done, then Reset progress last (a quiet row after Done); every row hittable and " + ST.minTapPx + " px tall or more; the card inside the " + innerWidth + "x" + innerHeight + " screen" + (scrolls ? ", scrolling inside itself" : "") + "; with saveCode off only Reset shows");
        out.notes.settingsCard = Math.round(cr.height) + " px tall" + (scrolls ? ", scrolls " + (card.scrollHeight - card.clientHeight) + " px" : "");
        // Reset: Cancel, an early let-go, a full hold by pointer, then by Space.
        card.scrollTop = 0; into($("set-reset")).click(); const say = $("resetsheet").textContent;
        const rsOpen = !$("resetsheet").hidden && $("settings").hidden && document.activeElement === $("rs-cancel") && hitOK(hb) && hitOK($("rs-cancel")) && hb.getBoundingClientRect().height >= ST.minTapPx && [RTx.lose, RTx.keep, RTx.copyFirst, RTx.hold].every((x) => say.indexOf(x) >= 0);
        $("rs-cancel").click(); const c1 = $("resetsheet").hidden && !$("settings").hidden && canon(app.save.data) === p0;
        $("set-reset").click(); pe(hb, "pointerdown"); holdFor(RS.holdMs * 0.6); const midFill = parseFloat((/scaleX\(([\d.]+)\)/.exec(fl.style.transform) || [0, 0])[1]), midLab = hb.textContent === RTx.holding; pe(hb, "pointerup");
        const c2 = canon(app.save.data) === p0 && app.hold < 0 && fl.style.transform === "" && !$("resetsheet").hidden && hb.textContent === RTx.hold && midFill > 0.5 && midFill < 0.7 && midLab;
        pe(hb, "pointerdown"); const tFull = holdFor(RS.holdMs * 2); pe(hb, "pointerup");
        const d1 = app.save.data, ts = getComputedStyle($("toast")), c3 = wiped(d1) && kept(d1) && home1() && $("resetsheet").hidden && $("settings").hidden && !$("toast").hidden && $("toast").textContent === RTx.toast && ts.position === "fixed" && +ts.zIndex > 10 && Math.abs(tFull - RS.holdMs) <= 32;
        mkProg(); showScreen("title"); $("btn-settings").click(); $("set-reset").click(); hb.focus(); ke(hb, "keydown"); const tKey = holdFor(RS.holdMs * 2); ke(hb, "keyup");
        const c4 = wiped(app.save.data) && kept(app.save.data) && home1() && Math.abs(tKey - RS.holdMs) <= 32;
        ok(rsOpen && c1 && c2 && c3 && c4, "reset (v5.4): its sheet says what goes and what stays and opens on Cancel; Cancel changes nothing (" + +c1 + "); let go at 60% (fill " + midFill.toFixed(2) + "): nothing changes, the fill empties (" + +c2 + "); a " + tFull + " ms pointer hold (" + +c3 + ") and a " + tKey + " ms Space hold (" + +c4 + ") reset: no levels, side quests, eggs or bests, " + app.meta.coins.start + " coins, music off and colour-blind on kept, the home at level 1 with the toast over it");
        // Copy then load.
        const p1 = mkProg(), d0 = JSON.parse(JSON.stringify(app.save.data)); let clip = null; app.clipFake = (t) => { clip = t; return true; };
        showScreen("map"); $("map-set").click(); into($("set-copy")).click(); const code = $("cs-code").value;
        const cpOK = !$("codesheet").hidden && clip === code && code.indexOf(Save.CODE) === 0 && $("cs-len").textContent === fill(CTx.len, { len: code.length }) && $("cs-status").textContent === CTx.copied && $("cs-sum").textContent === summary(d0) && hitOK($("cs-copy")) && hitOK($("cs-close"));
        app.clipFake = () => false; $("cs-copy").click(); const ta0 = $("cs-code"), byHand = $("cs-status").textContent === CTx.copyFail && document.activeElement === ta0 && ta0.selectionEnd - ta0.selectionStart === code.length; app.clipFake = null;
        $("cs-close").click(); const backSet = !$("settings").hidden && $("codesheet").hidden;
        $("set-reset").click(); pe(hb, "pointerdown"); holdFor(RS.holdMs * 2); pe(hb, "pointerup"); const gone = wiped(app.save.data);
        $("btn-settings").click(); into($("set-load")).click(); const ta = $("ls-code"), put = (v) => { ta.value = v; ta.dispatchEvent(new Event("input", { bubbles: true })); return $("ls-apply").disabled ? $("ls-msg").textContent : "ok"; };
        const lOpen = !$("loadsheet").hidden && document.activeElement === ta && $("ls-apply").disabled && $("ls-warn").hidden;
        const refused = [put(code.slice(0, 20) + (code[20] === "A" ? "B" : "A") + code.slice(21)), put(code.slice(0, -3)), put("hello"), put(code.replace(/^SP1\./, "SP9."))];
        const good = put("\n" + code.slice(0, 60) + "\n" + code.slice(60) + " "), sumNew = summary(d0), lsay = $("ls-msg").textContent, warn = $("ls-warn").textContent;
        $("ls-apply").click(); const d2 = app.save.data;
        const restored = canon(d2) === p1 && app.screen === "title" && $("toast").textContent === fill(CTx.toast, { sum: sumNew }) && $("play-lab").textContent === fill(HT.play, { n: app.levels[6].n }) && $("loadsheet").hidden;
        ok(cpOK && byHand && backSet && gone && lOpen && refused.join("|") === [CTx.err.broken, CTx.err.broken, CTx.err.prefix, CTx.err.newer].join("|") && good === "ok" && lsay === sumNew && warn === fill(CTx.replaces, { now: summary(Save.fresh(app.meta)) }) && restored,
          "save code (v5.4, from the map's gear): Copy shows the code (" + code.length + " characters) with its length and summary and copies it (" + +cpOK + "); a refused clipboard leaves the box selected (" + +byHand + "); after a reset, Load refuses a changed character, a truncated code, other text and a newer code (" + refused.map((x) => !!x).join(",") + "); the code (wrapped) previews '" + lsay + "' and what it replaces; applying restores the save exactly (" + +restored + ")");
        app.save = scratch(); showScreen("title");
      }
      // 13z. Lands foundation, shading within a colour: a shaded twin of picture 1 (shade rows on its biggest colour, a
      // lighter top half and a darker bottom half, two shade colours; registered for the run) compiles to the same board,
      // draws each block in its shade (tones = its digits; the shade studs differ from the base and are opaque), says
      // lands.shadeTip on a save with no shaded clear, and wins on the stored order with the board matching the engine;
      // picture 1 itself then draws as before (no shade rows, every tone stud the base's).
      if (app.gal.length) {
        const e0 = app.gal[0], L0 = e0.L, cnt = {}; for (const r of L0.grid) for (const ch of r) { const m = E.matOf(ch); if (m > 0) cnt[m] = (cnt[m] | 0) + 1; }
        const m0 = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a - b)[0], pal = JSON.parse(JSON.stringify(L0.pal)), c0 = pal[m0].c, MX = ST.shadeMix;
        pal[m0].sh = [mixHex(c0, "#ffffff", MX[0]), mixHex(c0, "#000000", MX[1]), null, null];
        const shade = L0.grid.map((r, y) => r.split("").map((ch) => (E.matOf(ch) === m0 ? (y < L0.h / 2 ? "1" : "2") : "0")).join(""));
        const e = { L: Object.assign({}, L0, { pal, shade, quest: undefined }), id: "fx-shade", n: 0, era: 1, idx: -1, node: null }; app.byId.set(e.id, e);
        const Bf = E.compile(L0), Bs = E.compile(e.L), sameB = Bf.n === Bs.n && Bf.ncards === Bs.ncards && Array.from(Bf.a0).join() === Array.from(Bs.a0).join();
        app.save = scratch(); startLevel(e.id); step(16); const Vb = app.V, S = Vb.sprites, tb = S && S.tb[m0], a0 = app.B.a0, w = app.B.w;
        let toneOK = true; for (let c = 0; c < app.B.n && toneOK; c++) if (Vb.tone[c] !== (a0[c] > 0 ? +shade[(c / w) | 0][c % w] : 0)) toneOK = false;
        const mid = (cv) => { const g = cv.getContext("2d", { willReadFrequently: true }), d = g.getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
        const studs = !!tb && tb.length === 5 && tb[1] !== tb[0] && tb[2] !== tb[0] && tb[3] === tb[0] && mid(tb[1]) === pal[m0].sh[0] && mid(tb[2]) === pal[m0].sh[1] && mid(tb[0]) === c0.toLowerCase();
        const tip = coachState().text, tipOK = tip.indexOf(app.cfg.lands.shadeTip[0].say) >= 0 || tip.indexOf(app.cfg.lands.shadeTip[0].short) >= 0;
        const won = patient(winOf(e)); settleNow();
        ok(sameB && toneOK && studs && !Vb.checkSprites().length && tipOK && won && app.S.status === E.WON && dispMatches() && allHome(),
          "shading (lands foundation): a shaded twin of " + e0.id + " compiles to the same board (" + +sameB + "), draws each block in its shade digit (" + +toneOK + ") with lighter and darker studs in the shade colours (" + +studs + "), says the shade tip ('" + tip + "'), and wins on the stored order");
        startLevel(e0.id); step(16); const S2 = app.V.sprites;
        ok(app.V.shade === null && S2.tb[m0].every((q) => q === S2.blk[m0]) && !app.coach, "shading: picture 1 itself draws as before (no shade rows, every tone stud the base, no shade tip)");
        app.byId.delete(e.id); app.save = scratch();
      }
      // 13zz. Land 1 fix. M2: a land level wins and fails in the land's words (config lands.text), a castle level keeps the
      // castle's. B1: a land level's mystery blocks draw in its own fill (hideC), 20+ CIEDE2000 from its picture, a castle
      // level's in board.hidden's. S5: a side quest with a short title shows it whole in the play bar. m5: a save from
      // before the lands keeps the long-tail picture it had open (tailKept), a save with the lands flag does not.
      { const LT = landsCfg().text || {}, le = app.levels.find((x) => x.L.land && x.L.hidden), lf = app.levels.find((x) => x.L.land);
        if (ok(!!le && !!lf && !!LT.winTitle && !!LT.failTitle, "Land 1 fix: a land level with mystery blocks, and the land's win and fail words")) {
          app.save = scratch(); startLevel(lf.id); const won = patient(winOf(lf)); settleNow(); tick(9000); const LD = JN.landOf(landsCfg(), lf.n);
          ok(won && app.panel === "win" && $("p-title").textContent === LT.winTitle && $("p-line").textContent === fill(LT.winLine, { name: LD.name, n: lf.n }), "land win (M2): " + lf.n + "'s sheet reads '" + $("p-title").textContent + "', '" + $("p-line").textContent + "'");
          const jp = jamPlan(lf, tagOf(lf)); startLevel(lf.id); if (jp) { patient(jp.prefix); for (let t = 0; t < ST.tickCapMs && !app.panel; t += 16) step(16); }
          ok(!!jp && app.panel === "fail" && $("p-title").textContent === LT.failTitle, "land fail (M2): " + lf.n + "'s jam sheet reads '" + $("p-title").textContent + "', not the castle's");
          const ce = app.levels.find((x) => !x.L.land && !x.boss && x.L.hidden), dE = (a, b) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(...p(a).map((v, i) => Math.abs(v - p(b)[i]))); };
          startLevel(le.id); step(16); const fl = app.V.hideInfo(); startLevel(ce.id); step(16); const fc = app.V.hideInfo();
          ok(fl.c === le.L.hideC && dE(fl.px, le.L.hideC) <= 2 && fc.c === app.cfg.board.hidden.c && dE(fc.px, app.cfg.board.hidden.c) <= 2, "mystery fill (B1): " + le.n + "'s hidden blocks draw in its own " + le.L.hideC + " (" + fl.px + "), castle " + ce.n + "'s in " + app.cfg.board.hidden.c + " (" + fc.px + ")"); }
        const sq = app.gal.filter((x) => x.L.short), cut = [];
        for (const x of sq) { startLevel(x.id); const nm = $("lvl-name"); if (nm.textContent !== x.L.short || nm.scrollWidth > nm.clientWidth + 1) cut.push(x.n + " '" + nm.textContent + "' " + nm.scrollWidth + "/" + nm.clientWidth); }
        ok(!cut.length, "side quest titles (S5): " + sq.length + " pictures show their short title whole in the play bar at " + innerWidth + " px" + (cut.length ? " (" + cut.join("; ") + ")" : ""));
        const tl = app.gal.filter((x) => !x.L.land && x.L.quest && x.L.quest.after > landsCfg().castleEnd);
        if (tl.length > 1 && lf) { const d = scratch().data; for (const x of app.levels) if (!x.L.land) d.done[x.id] = 1; d.gal[tl[0].id] = 1; const k = tailKept(d);
          ok(k[tl[1].id] === 1 && Object.keys(k).length === 1 && !Save.questOpen(d, app.order, galIds(), galAfter(), tl[1].id) && Save.questOpen(Object.assign({}, d, { tail: k }), app.order, galIds(), galAfter(), tl[1].id),
            "long tail kept (m5): a save from before the lands with the castle cleared and " + tl[0].n + " won keeps " + tl[1].n + " open (it would have waited past " + lastN() + ")"); }
        app.save = scratch(); }
      // 14. Opaque sprite caches.
      const bad = app.V.checkSprites(); ok(!bad.length, "sprites: every opaque cache is opaque" + (bad.length ? " (" + bad.join(",") + ")" : ""));
    } catch (err) { ok(false, "selfTest threw: " + (err && err.message) + " " + (err && err.stack ? err.stack.split("\n")[1] : "")); }
    finally {
      for (const k of Object.keys(ST)) app.byId.delete("fx-" + k); // every fixture registered for the run
      app.allPw = false; if (app.tip) hideTip(); app.tipQ = []; app.clipFake = null; holdStop(); // v5.4
      app.save = was.save; app.meta = was.meta; app.now = was.now; app.testing = false; setSpeed(was.speed, false); setCb(was.cb, false); app.diff = was.diff;
      setSound(was.sfx, was.music, false); Audio.hushed(app.audio, false); // v5.2
      if (was.entry) startLevel(was.entry.id, was.diff); showScreen(was.screen); renderAll();
    }
    let snap2 = "?"; try { snap2 = was.save.store.getItem(key); } catch (e) { /* stays "?" */ }
    ok(snap === snap2, "save: the real save is untouched by selfTest");
    out.ms = Math.round(performance.now() - T0);
    return out;
  }
  // v4.3: load(id) plays the level on its own tag (a second argument is ignored: no difficulty picker).
  const SP = { play: playCol, state, load: (id) => { startLevel(resolve(id)); return state(); }, retry: () => { retry(); return state(); }, tick,
    solve: (nodes) => solveHere(nodes), selfTest, coach: coachState, cues: () => Object.assign({}, app.cues), fx: () => app.V.fxInfo(), hits: () => app.V.hitInfo(), runners: () => app.V.runners(),
    paused: () => app.paused, held: () => app.held, upright: () => ({ on: app.upright, needed: uprightNeeded(innerWidth, innerHeight, coarse()), coarse: coarse() }), pause: () => { pause(); return app.paused; }, resume: () => { resume(); return app.paused; }, winOrder: () => (app.entry ? winOf(app.entry) : null),
    lossPlan: (id) => { const e = app.byId.get(resolve(id)) || app.entry; return e ? jamPlan(e, tagOf(e)) : null; }, hitPlan: (id) => { const e = app.byId.get(resolve(id)), T = app.cfg.selfTest; return e ? search(e, tagOf(e), (S) => S.hits > 0, T.searchTries, T.searchSeed) : null; }, settle: () => { settleNow(); return state(); }, reachable: (m) => (app.S ? app.S.reachable(m) : 0),
    // Screens for the harness: fill the line with rushed taps; stage k stuck and w working squads on level n (or the first
    // level from n whose fronts allow it). Both return the state plus the taps made.
    fill: () => { const taps = fillLine(); return Object.assign(state(), { taps }); },
    // v4 M2: load a selfTest fixture level (config selfTest[name], e.g. linkJamLevel) like a debug level (no save).
    fixture: (k) => { const L = app.cfg.selfTest[k]; if (!L || !L.grid) return null; const id = "fx-" + k; if (!app.byId.has(id)) app.byId.set(id, { L, id, n: 0, era: 1, idx: -1, node: null, debug: true }); startLevel(id); return state(); },
    stage: (n, k, w) => { for (const e of app.levels) { if (e.n < n || tagOf(e) !== "normal") continue; startLevel(e.id); /* v4.3: a Normal level (5 spaces) */ const tp = stageLine(k, w); if (tp) return Object.assign(state(), { taps: tp }); } return null; },
    screen: (name) => { showScreen(name); return state(); }, skip: () => { skip(); return state(); }, speed: (k) => { setSpeed(k, false); return app.speed; },
    // Cost of n board draws right now (ms): the harness calls it mid-show.
    perf: (n) => { const k = Math.max(1, Math.min(500, n | 0 || 60)); let max = 0; const t0 = performance.now(); for (let i = 0; i < k; i++) { const a = performance.now(); app.V.draw(); max = Math.max(max, performance.now() - a); } return { mean: +((performance.now() - t0) / k).toFixed(3), max: +max.toFixed(3), runners: app.V.live }; },
    sprites: () => app.V.checkSprites(),
    // v5.2: the music's state; musicCheck() fetches and decodes every loop on offline contexts at 44.1 and 48 kHz (and
    // reads the page's own decoded buffers where loaded) and returns each seam (Audio.seam: the loop against itself one
    // period on, in dB; the same 37 samples off; the step across loopEnd -> loopStart against the 10 ms around it).
    music: () => Audio.info(app.audio),
    musicCheck: async () => { const M = app.cfg.audio.music, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, out = {}; if (!OAC) return null;
      for (const k of Object.keys(M.tracks)) { const T = M.tracks[k]; if (T.loopEnd == null) continue; const ab = await (await fetch(T.file + "?v=" + V_)).arrayBuffer(); out[k] = {};
        for (const sr of [44100, 48000]) { const b = await new OAC(2, 1, sr).decodeAudioData(ab.slice(0)); out[k][sr] = Audio.seam(b, T); }
        if (app.audio.bufs[k]) out[k].live = Audio.seam(app.audio.bufs[k], T); }
      return out; },
    // v4 M4: the side quests' (Gallery pictures') ids; the board's runners by entry edge. v5 R3: map() reads the journey
    // map (sheets requested, the scroll, the current node, eggs found) for the harness and the screens.
    map: () => { const J = app.jr; if (!J) return null; const sc = $("jr"), f = JN.focus(app.save.data, app.order);
      return { sheets: J.sheets.length, loaded: J.sheets.filter((h) => h.loaded).length, k: +J.k.toFixed(4), colW: J.colW, cards: $("map").classList.contains("cards"), scrollTop: Math.round(sc.scrollTop), height: sc.clientHeight, world: $("jr-world").offsetHeight, focus: f, eggs: Object.keys(app.save.data.eggs || {}).length, tail: J.tail && J.tail.e ? J.tail.e.id : null }; },
    gallery: () => app.gal.map((e) => e.id), entry: () => app.V.entryInfo(),
    // v4 M5: win siege levels 1..n (normal) in the live save (screens for the harness and the critics); a power-up through
    // its badge (k), and for the Quartermaster or Recall a target (the tile [j, d] or the space); the meta state.
    // v4.3: clearPictures(k): clear the Gallery's first k pictures in the live save (the screens' sequential Gallery).
    clearPictures: (k) => { for (let i = 0; i < k && i < app.gal.length; i++) Save.record(app.save.data, app.gal[i].id, "gal"); writeSave(); if (app.screen === "map") renderMap(); return Object.keys(app.save.data.gal).length; },
    quest: (id) => { const e = app.byId.get(id); return e && e.L.quest ? Object.assign({ open: picOpen(e) }, e.L.quest) : null; }, // v5 R2: a picture's side quest
    homeArt: () => { fitTitle(); return homeArt(); },
    code: () => Save.encode(app.save.data, galIds()), // v5.4: the live save's code (shots, the harness) // v5.3: the home painting's fit (which image, the castle's offset from the box's centre)
    unlockTo: (n) => { for (let i = 0; i < n && i < app.order.length; i++) Save.record(app.save.data, app.order[i]); app.save.data.last = Save.next(app.save.data, app.order); writeSave(); renderHome(); return Object.keys(app.save.data.done).length; },
    power: (k, a) => { const got = onPower(k); if (a == null || !app.pick) return got; return Array.isArray(a) ? pickTile(a[0], a[1]) : pickSlot(a); },
    allPowers: (on) => { app.allPw = !!on; renderPowers(); return app.allPw; }, // v5 R1: every power-up shown whatever the campaign (tests)
    meta: () => ({ coins: app.save.data.coins, got: Object.assign({}, app.save.data.got), tip: app.tip ? app.tip.k : -1, inv: Object.assign({}, app.save.data.inv), lives: Meta.lives(app.save.data, app.meta, app.now()), pick: app.pick ? app.pick.k : -1, rows: app.rows, report: app.report, used: app.S ? E.POWERS.map((k, i) => app.S.used(i)) : null }),
    setMeta: (o) => { Object.assign(app.save.data, o || {}); writeSave(); renderHome(); if (app.S) renderPowers(); return app.save.data.coins; },
    // Lives forced on (a copy of meta; debug screens only) with n left, the refill count started ago ms back; off restores.
    forceLives: (on, n, ago) => { app.meta = on ? Object.assign({}, app.cfg.meta, { lives: true }) : app.cfg.meta; if (on) app.save.data.lives = { n: n | 0, at: n < app.meta.livesMax ? Date.now() - (ago | 0) : 0 }; renderHome(); return Meta.lives(app.save.data, app.meta, app.now()); } };

  boot();
})();
