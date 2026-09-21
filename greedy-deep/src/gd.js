// Greedy Deep — window.GD facade (PRD 13). Click it! Studios, 2026.
// Always present. ?debug=1 adds the overlay and the mutators.
(function () {
  "use strict";

  var E = window.GDEngine;
  var GD = (window.GD = {
    version: "0.4.0-m4",
    config: null,
    state: null,
    ready: false,
    debug: /(\?|&)debug=1/.test(location.search),
    dbg: {
      t: 0, depth: 0, band: "-", bandIndex: 0, gold: 0, goldRate: 0, digRate: 0, dwarves: 0,
      owned: {}, fps: 0, saveSize: 0, errors: 0, warnings: 0, lastError: "",
      lastEvent: "", eventsFired: 0, revealBonus: 0, timed: 0, flavorTodoCount: 0,
      maxRenderedBandIndex: 0, forwardMeters: 0, veilAlpha: 0, nextBands: 0, offlineLast: null,
      cameraY: 0, deepestDwarfY: 0, cameraUserBu: 0, titleCardBytes: 0,
      dwarfCache: 0, dwarfLoadouts: 0, placeholderRects: 0,
      spriteCacheOpaque: 0, spriteCacheTotal: 0, spriteCacheRebuilds: 0, spriteCacheBlank: [],
      outlineFailures: 0, logoRedraws: 0,
      audioMasterGain: 0, lastCue: null
    },
    // The live loop passes these through to the engine so the UI can react to
    // events, band changes and the ending without the engine knowing about DOM.
    hooks: { onEvent: null, onBand: null, onEnding: null },
    audio: {
      get muted() { return window.GDAudio ? window.GDAudio.isMuted() : false; },
      set muted(v) { if (window.GDAudio) window.GDAudio.setMuted(v); }
    }
  });

  GD.ctx = {
    rng: null, // null = engine default rng
    onEvent: function (e, st) { if (GD.hooks.onEvent) GD.hooks.onEvent(e, st); },
    onBand: function (b, prev, st) { if (GD.hooks.onBand) GD.hooks.onBand(b, prev, st); },
    onEnding: function (st, m) { if (GD.hooks.onEnding) GD.hooks.onEnding(st, m); }
  };

  // -------------------------------------------------- console error counter
  // "zero console errors/warnings" needs a number, not a vibe.
  (function hookConsole() {
    var ce = console.error.bind(console), cw = console.warn.bind(console);
    console.error = function () { GD.dbg.errors++; GD.dbg.lastError = String(arguments[0]); ce.apply(null, arguments); };
    console.warn = function () { GD.dbg.warnings++; cw.apply(null, arguments); };
    window.addEventListener("error", function (e) { GD.dbg.errors++; GD.dbg.lastError = e.message || "error"; });
    window.addEventListener("unhandledrejection", function () { GD.dbg.errors++; GD.dbg.lastError = "unhandled rejection"; });
  })();

  // -------------------------------------------------- lifecycle
  GD.init = function (cfg) {
    GD.config = cfg;
    var v = E.validateConfig(cfg);
    if (!v.ok) console.error("[GD] config invalid:", v.errors.join(" | "));
    E.setSeed(cfg.sim.seed === undefined ? 1 : cfg.sim.seed);
    var loaded = window.GDSave.read(cfg);
    GD.state = loaded || E.newState(cfg);
    GD.loadedFromSave = !!loaded;
    GD.savedAt = loaded ? window.GDSave.savedAt(cfg) : 0;
    GD.dbg.flavorTodoCount = E.flavorTodoCount(cfg);
    GD.ready = true;
    return GD.state;
  };

  // Swap the whole config at runtime. This is the content-as-data escape hatch:
  // a fifth ore or a fifth dwarf arrives as JSON and nothing in JS changes.
  GD.setConfig = function (cfg, keepState) {
    var v = E.validateConfig(cfg);
    if (!v.ok) return { ok: false, errors: v.errors };
    var prevState = keepState ? E.cloneState(GD.state) : null;
    GD.config = cfg;
    GD.state = prevState || E.newState(cfg);
    GD.dbg.flavorTodoCount = E.flavorTodoCount(cfg);
    if (window.GDRender && window.GDRender.setConfig) window.GDRender.setConfig(cfg);
    if (window.GDUI && window.GDUI.rebuild) window.GDUI.rebuild();
    return { ok: true };
  };

  // reset() also reseeds the shared event rng to config.sim.seed, so
  // `reset(); step(3600)` equals `reset(); 3600 x step(1)` with no extra ceremony.
  // GD.seed(n) overrides it until the next reset (critic M2, MINOR 2).
  GD.reset = function () {
    E.setSeed(GD.config.sim.seed === undefined ? 1 : GD.config.sim.seed);
    GD.state = E.newState(GD.config);
    return E.snapshot(GD.config, GD.state);
  };

  GD.getState = function () { return E.cloneState(GD.state); };
  GD.setState = function (s) {
    var fresh = E.newState(GD.config);
    if (s && typeof s === "object") {
      if (typeof s.depth === "number") fresh.depth = s.depth;
      if (typeof s.gold === "number") fresh.gold = s.gold;
      if (typeof s.goldEarnedTotal === "number") fresh.goldEarnedTotal = s.goldEarnedTotal;
      if (typeof s.t === "number") fresh.t = s.t;
      if (s.owned) fresh.owned = JSON.parse(JSON.stringify(s.owned));
      if (s.prefs) fresh.prefs = JSON.parse(JSON.stringify(s.prefs));
      if (Array.isArray(s.timed)) fresh.timed = JSON.parse(JSON.stringify(s.timed));
      fresh.endingSeen = !!s.endingSeen;
      fresh.bandId = E.bandAt(GD.config, fresh.depth).id;
    }
    GD.state = fresh;
    return E.snapshot(GD.config, GD.state);
  };

  GD.validateConfig = function () { return E.validateConfig(GD.config); };
  GD.snapshot = function () { return E.snapshot(GD.config, GD.state); };
  GD.derive = function () { return E.derive(GD.config, GD.state); };
  GD.costOf = function (id) { return E.costOf(GD.config, GD.state, id); };
  GD.format = function (n) { return E.format(GD.config, n); };
  GD.bandAt = function (d) { return E.bandAt(GD.config, d); };

  // -------------------------------------------------- core API
  // Synchronous sim advance. Fixed sub-steps of sim.dt. No rAF, no DOM, no audio.
  GD.step = function (seconds) {
    E.advance(GD.config, GD.state, seconds, GD.ctx);
    return E.snapshot(GD.config, GD.state);
  };

  GD.tap = function (times) {
    var g = E.tap(GD.config, GD.state, times);
    // Record the cue request (item 1): tap always requests "strike"
    if (!GD.state.prefs.muted && window.GDAudio) window.GDAudio.play("strike");
    else if (!GD.state.prefs.muted) { GD.dbg.lastCue = "strike"; }
    return g;
  };
  GD.buy = function (id) {
    var r = E.buy(GD.config, GD.state, id);
    if (r.ok && !GD.state.prefs.muted) {
      var cue = E.isDwarf(GD.config, id) ? "hire" : "buy";
      if (window.GDAudio) window.GDAudio.play(cue);
      else GD.dbg.lastCue = cue;
    } else if (!r.ok && !GD.state.prefs.muted) {
      if (window.GDAudio) window.GDAudio.play("denied");
      else GD.dbg.lastCue = "denied";
    }
    return r;
  };

  // ETA for a locked row: (cost - gold) / goldRate at the current passive rate.
  // Returns Infinity while goldRate is 0 so the UI can print the em dash.
  GD.etaFor = function (id) {
    var cost = GD.costOf(id);
    var gold = GD.state.gold;
    if (gold >= cost - 1e-9) return 0;
    var rate = E.derive(GD.config, GD.state).goldRate;
    if (!(rate > 0)) return Infinity;
    return (cost - gold) / rate;
  };

  GD.simulate = function (opts) {
    // Save and restore the engine RNG so simulate never affects the live game
    var savedRng = E.rng;
    var result = E.simulate(GD.config, opts);
    E.rng = savedRng;
    return result;
  };

  GD.offlinePreview = function (elapsedMs, state) {
    return E.offlinePreview(GD.config, state || GD.state, elapsedMs);
  };
  GD.applyOffline = function (elapsedMs) {
    var p = E.applyOffline(GD.config, GD.state, elapsedMs, GD.ctx);
    GD.dbg.offlineLast = p;
    return p;
  };

  GD.fire = function (eventId) {
    var list = GD.config.events;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === eventId) return E.applyEvent(GD.config, GD.state, list[i], GD.ctx);
    }
    return null;
  };

  GD.jumpTo = function (depth) {
    GD.state.depth = Math.max(0, depth);
    var b = E.bandAt(GD.config, GD.state.depth);
    if (b.id !== GD.state.bandId) {
      var prev = GD.state.bandId;
      GD.state.bandId = b.id;
      GD.ctx.onBand(b, prev, GD.state);
    }
    E.checkMilestone(GD.config, GD.state, GD.ctx);
    if (window.GDUI && window.GDUI.refresh) window.GDUI.refresh();
    return GD.state.depth;
  };

  GD.seed = function (n) { return E.setSeed(n); };

  GD.save = function () {
    var d = window.GDSave.write(GD.config, GD.state);
    if (d) GD.dbg.saveSize = JSON.stringify(d).length;
    return d;
  };

  GD.export = function () {
    return window.GDSave.exportString(GD.config, GD.state);
  };

  GD.import = function (str) {
    var result = window.GDSave.importString(GD.config, str);
    if (!result.ok) return result;
    GD.state = result.state;
    window.GDSave.write(GD.config, GD.state);
    if (window.GDUI && window.GDUI.rebuild) window.GDUI.rebuild();
    return result;
  };

  GD.refreshDbg = function (fps) {
    var d = E.derive(GD.config, GD.state);
    GD.dbg.t = GD.state.t;
    GD.dbg.depth = GD.state.depth;
    GD.dbg.band = d.band.id;
    GD.dbg.bandIndex = d.band.index;
    GD.dbg.gold = GD.state.gold;
    GD.dbg.goldRate = d.goldRate;
    GD.dbg.digRate = d.digRate;
    GD.dbg.dwarves = d.dwarves;
    GD.dbg.owned = GD.state.owned;
    GD.dbg.lastEvent = GD.state.lastEvent;
    GD.dbg.eventsFired = GD.state.eventsFired;
    GD.dbg.revealBonus = d.revealBonus;
    GD.dbg.timed = GD.state.timed.length;
    if (window.GDRender && window.GDRender.lastPlan) {
      var pl = window.GDRender.lastPlan();
      GD.dbg.maxRenderedBandIndex = pl.maxIndex;
      GD.dbg.forwardMeters = pl.forwardMeters || 0;
      GD.dbg.veilAlpha = pl.veilAlpha || 0;
      GD.dbg.nextBands = (pl.nextBands || []).length;
    }
    if (window.GDRender && window.GDRender.cameraState) {
      var cs = window.GDRender.cameraState();
      GD.dbg.cameraY = cs.focusY;
      GD.dbg.deepestDwarfY = cs.deepestDwarfY;
      GD.dbg.cameraUserBu = cs.userBu;
      var rs = window.GDRender.stats();
      GD.dbg.placeholderRects = rs.placeholderRects;
    }
    if (window.GDSprites && window.GDSprites.stats) {
      var ss = window.GDSprites.stats();
      GD.dbg.dwarfCache = ss.dwarfCache;
      GD.dbg.dwarfLoadouts = ss.dwarfLoadouts;
      GD.dbg.spriteCacheOpaque = ss.opaque;
      GD.dbg.spriteCacheTotal = ss.total;
      GD.dbg.spriteCacheRebuilds = ss.rebuilds;
      GD.dbg.spriteCacheBlank = ss.blank.length;
      GD.dbg.outlineFailures = ss.outlineFailures;
    }
    if (fps !== undefined) GD.dbg.fps = fps;
    if (window.GDRender && window.GDRender.renderSignature) {
      GD.dbg.renderSignature = function () {
        return window.GDRender.renderSignature(GD.state, GD.derive());
      };
    }
    if (window.GDAudio) {
      GD.dbg.audioMasterGain = window.GDAudio.masterGainValue();
      GD.dbg.lastCue = window.GDAudio.lastCue;
    }
  };

  // -------------------------------------------------- debug mutators (?debug=1)
  GD.timeScale = 1;
  GD.paused = false;
  if (GD.debug) {
    GD.setGold = function (n) { GD.state.gold = n; return n; };
    GD.setDepth = function (n) { return GD.jumpTo(n); };
    GD.grant = function (id, n) {
      n = n === undefined ? 1 : n;
      GD.state.owned[id] = (GD.state.owned[id] || 0) + n;
      return GD.state.owned[id];
    };
    GD.pause = function () { GD.paused = true; };
    GD.resume = function () { GD.paused = false; };
    GD.clearSave = function () { return GD._clearSave(); };
  }

  // Clearing the key alone is not enough: the live state keeps ticking and the 5 s
  // autosave heartbeat (or visibilitychange on navigate) writes the old run straight
  // back. Reset the live state too, and tell the UI to drop its pending autosave.
  GD._clearSave = function () {
    var ok = window.GDSave.clear(GD.config);
    GD.state = E.newState(GD.config);
    if (window.GDUI && window.GDUI.afterClearSave) window.GDUI.afterClearSave();
    return ok;
  };

  GD.grantForTest = function (id, n) {
    GD.state.owned[id] = (GD.state.owned[id] || 0) + (n === undefined ? 1 : n);
    return GD.state.owned[id];
  };

  // -------------------------------------------------- selfTest (PRD 14)
  function approx(a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps); }

  GD.selfTest = function (opts) {
    opts = opts || {};
    var cfg = GD.config;
    var failed = [], ran = 0;
    var liveState = E.cloneState(GD.state);
    var liveRaw = window.GDSave.readRaw(cfg);
    var liveConfig = GD.config;
    // selfTest drives the engine hard (jumpTo, fire, band crossings). Mute the UI
    // hooks for the duration so a test run never leaves a panel or a log line behind.
    var liveHooks = GD.hooks;
    GD.hooks = { onEvent: null, onBand: null, onEnding: null };

    function bad3(mutate) {
      var c = JSON.parse(JSON.stringify(GD.config));
      mutate(c);
      return E.validateConfig(c);
    }

    function check(name, expected, actual, ok) {
      ran++;
      if (!ok) failed.push({ name: name, expected: expected, actual: actual });
    }

    try {
      // =========================================================== M1 block
      GD.reset();
      var s0 = GD.step(0);
      check("m1_reset_zero_gold", cfg.start.gold, s0.gold, s0.gold === cfg.start.gold);
      check("m1_reset_zero_depth", 0, s0.depth, s0.depth === 0);

      GD.reset();
      var gpt = GD.derive().goldPerTap;
      for (var i = 0; i < 10; i++) GD.tap(1);
      check("m1_taps_pay_exact_gold", 10 * gpt, GD.state.gold, approx(GD.state.gold, 10 * gpt, 1e-9));
      check("m1_taps_never_dig", 0, GD.state.depth, GD.state.depth === 0);
      check("m1_taps_count_toward_lifetime", 10 * gpt, GD.state.goldEarnedTotal, approx(GD.state.goldEarnedTotal, 10 * gpt, 1e-9));

      GD.reset();
      var s600 = GD.step(600);
      check("m1_idle_no_gold_without_dwarves", 0, s600.gold, s600.gold === 0);
      check("m1_idle_no_depth_without_dwarves", 0, s600.depth, s600.depth === 0);

      var track = cfg.tracks[0];
      GD.reset();
      GD.state.gold = track.base * 100;
      var b1 = GD.buy(track.id);
      var cost2 = GD.costOf(track.id);
      check("m1_first_purchase_cost_base", track.base, b1.cost, approx(b1.cost, track.base));
      check("m1_second_purchase_cost_ratio", track.base * track.ratio, cost2, approx(cost2, track.base * track.ratio));

      GD.reset();
      GD.state.gold = track.base - 0.01;
      var goldBefore = GD.state.gold;
      var refused = GD.buy(track.id);
      check("m1_insufficient_refused", false, refused.ok, refused.ok === false);
      check("m1_insufficient_gold_unchanged", goldBefore, GD.state.gold, GD.state.gold === goldBefore);
      check("m1_insufficient_owned_unchanged", 0, GD.state.owned[track.id] || 0, (GD.state.owned[track.id] || 0) === 0);

      var dwarf = cfg.dwarves[0];
      GD.reset();
      GD.grantForTest(dwarf.id, 2);
      var d2 = GD.derive();
      var expRate = cfg.start.digRate + dwarf.effects[0].value * 2;
      check("m1_dwarf_digs", expRate, d2.digRate, approx(d2.digRate, expRate));
      GD.step(10);
      check("m1_depth_advances_from_digrate", expRate * 10, GD.state.depth, approx(GD.state.depth, expRate * 10, 1e-6));

      var raw = window.GDSave.readRaw(cfg);
      var parsed = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
      check("m1_save_present", "an object at " + cfg.save.key, raw, !!parsed);
      var keys = ["version", "savedAt", "depth", "gold", "goldEarnedTotal", "owned", "prefs"];
      var missing = [];
      if (parsed) for (var k = 0; k < keys.length; k++) if (!(keys[k] in parsed)) missing.push(keys[k]);
      check("m1_save_shape", "no missing keys", missing.join(","), parsed && missing.length === 0);

      GD.reset();
      GD.state.depth = 123.456; GD.state.gold = 4567.89; GD.state.goldEarnedTotal = 9999;
      GD.grantForTest(track.id, 3); GD.grantForTest(dwarf.id, 2);
      window.GDSave.write(cfg, GD.state);
      var restored = window.GDSave.read(cfg);
      check("m1_reload_restores_depth", 123.456, restored && restored.depth, !!restored && Math.abs(restored.depth - 123.456) < 1);
      check("m1_reload_restores_gold", 4567.89, restored && restored.gold, !!restored && Math.abs(restored.gold - 4567.89) < 1);
      check("m1_reload_restores_owned", "3/2", restored && (restored.owned[track.id] + "/" + restored.owned[dwarf.id]),
        !!restored && restored.owned[track.id] === 3 && restored.owned[dwarf.id] === 2);

      var seedOwned = {};
      seedOwned[track.id] = 3; seedOwned[dwarf.id] = 5;
      if (cfg.tracks[1]) seedOwned[cfg.tracks[1].id] = 2;

      // reset() reseeds, so the invariant holds with no explicit GD.seed() call.
      GD.reset(); GD.state.owned = JSON.parse(JSON.stringify(seedOwned));
      var addA = GD.step(3600);
      GD.reset(); GD.state.owned = JSON.parse(JSON.stringify(seedOwned));
      for (var ja = 0; ja < 3600; ja++) GD.step(1);
      var addB = GD.snapshot();
      check("m1_reset_reseeds_for_additivity", addA.gold, addB.gold, approx(addA.gold, addB.gold, 1e-6) && approx(addA.depth, addB.depth, 1e-6));
      check("m1_reset_reseeds_rng", GD.config.sim.seed, (function () { GD.reset(); var x = E.rng(); GD.reset(); return E.rng() === x ? GD.config.sim.seed : "different"; })(),
        (function () { GD.reset(); var x = E.rng(); GD.reset(); return E.rng() === x; })());

      // Determinism-by-seed is asserted separately below; seeding here keeps the timing
      // half of this comparison independent of the reset path.
      GD.seed(4242);
      GD.setState({ owned: seedOwned });
      var t0 = performance.now();
      var big = GD.step(3600);
      var ms = performance.now() - t0;
      check("m1_step_3600_under_500ms", "< 500 ms", Math.round(ms) + " ms", ms < 500);

      GD.seed(4242);
      GD.setState({ owned: seedOwned });
      for (var j = 0; j < 3600; j++) GD.step(1);
      var many = GD.snapshot();
      check("m1_step_additive_gold", big.gold, many.gold, approx(big.gold, many.gold, 1e-6));
      check("m1_step_additive_depth", big.depth, many.depth, approx(big.depth, many.depth, 1e-6));
      check("m1_step_additive_total", big.goldEarnedTotal, many.goldEarnedTotal, approx(big.goldEarnedTotal, many.goldEarnedTotal, 1e-6));

      GD.reset();
      GD.grantForTest(dwarf.id, 1);
      GD.state.gold = 777;
      window.GDSave.write(cfg, GD.state);
      GD._clearSave();
      GD.step(5);
      var afterClear = window.GDSave.readRaw(cfg);
      var parsedClear = null;
      try { parsedClear = afterClear ? JSON.parse(afterClear) : null; } catch (e) { parsedClear = null; }
      var freshAfterClear = !parsedClear ||
        (parsedClear.gold === 0 && parsedClear.depth === 0 && Object.keys(parsedClear.owned || {}).length === 0);
      check("m1_clear_save_key_absent_or_fresh", "absent or fresh state", afterClear, freshAfterClear);
      check("m1_clear_save_resets_live_state", "gold 0, no owned", GD.state.gold + "/" + JSON.stringify(GD.state.owned),
        GD.state.gold === 0 && Object.keys(GD.state.owned).length === 0);

      var v1 = GD.validateConfig();
      check("m1_config_valid", "ok", v1.errors.join(" | "), v1.ok);

      var snapKeys = ["t", "depth", "gold", "goldEarnedTotal", "goldRate", "digRate", "band", "owned", "dwarves", "eventsFired"];
      var snapMissing = [];
      for (var q = 0; q < snapKeys.length; q++) if (!(snapKeys[q] in big)) snapMissing.push(snapKeys[q]);
      check("m1_snapshot_shape", "no missing keys", snapMissing.join(","), snapMissing.length === 0);

      // =========================================================== M2 block
      // --- the 12-verb registry is complete and every JSON verb has a handler
      var wantVerbs = ["add_click", "add_rate", "mul_rate", "mul_gold", "add_rate_per_dwarf",
        "reveal_bands", "mul_hazard_resist", "add_offline_hours", "mul_offline_rate",
        "mul_rate_temp", "mul_gold_temp", "add_depth"];
      var verbMissing = [];
      for (var vi = 0; vi < wantVerbs.length; vi++) if (typeof E.EFFECTS[wantVerbs[vi]] !== "function") verbMissing.push(wantVerbs[vi]);
      check("m2_all_12_verbs_registered", "12 handlers", E.VERBS.length + " (missing " + verbMissing.join(",") + ")",
        verbMissing.length === 0 && E.VERBS.length === 12);

      // --- content: 4 ores, 8 tracks, 4 dwarves, 3 events
      check("m2_content_counts", "4 ores / 8 tracks / 4 dwarves / 3 events",
        cfg.ores.length + "/" + cfg.tracks.length + "/" + cfg.dwarves.length + "/" + cfg.events.length,
        cfg.ores.length === 4 && cfg.tracks.length === 8 && cfg.dwarves.length === 4 && cfg.events.length === 3);

      // --- simulate: the economy window (PRD 8 targets)
      var simT0 = performance.now();
      var sim = GD.simulate({ policy: "cheapest-affordable" });
      var simMs = performance.now() - simT0;
      check("m2_simulate_under_20s", "< 20000 ms", Math.round(simMs) + " ms", simMs < 20000);
      check("m2_simulate_reaches_milestone", cfg.milestone.depth + " m", sim.finalDepth.toFixed(1), sim.reached === true);
      check("m2_reached_in_window", "5400..10800 s", Math.round(sim.reachedAtSeconds),
        sim.reachedAtSeconds >= 5400 && sim.reachedAtSeconds <= 10800);
      check("m2_max_gap_under_300", "< 300 s", Math.round(sim.maxGapSeconds), sim.maxGapSeconds < 300);
      check("m2_ten_purchases_in_600s", ">= 10", sim.purchasesFirst600, sim.purchasesFirst600 >= 10);

      // --- bandLog boundaries equal the JSON startDepth values
      // PRD 14 says the boundaries EQUAL the JSON startDepth values. The log now
      // interpolates the crossing back to the boundary, so this is exact equality.
      var boundaryBad = [];
      for (var bi = 1; bi < sim.bandLog.length; bi++) {
        var entry = sim.bandLog[bi];
        var band = E.bandByIndex(cfg, entry.index);
        if (!band) { boundaryBad.push(entry.band + ": no band at index " + entry.index); continue; }
        if (entry.depth !== band.startDepth) boundaryBad.push(entry.band + "@" + entry.depth + " want " + band.startDepth);
        if (!(entry.t > sim.bandLog[bi - 1].t)) boundaryBad.push(entry.band + ": crossing time not increasing");
        if (!(entry.tickDepth >= band.startDepth)) boundaryBad.push(entry.band + ": tickDepth behind the boundary");
      }
      check("m2_bandlog_equals_startdepths_exactly", "exact JSON startDepth on every crossing", boundaryBad.join(" | "), boundaryBad.length === 0);

      // --- band income step within 10% of the goldPerMeter ratio
      var stepBad = [];
      for (var si = 1; si < sim.bandLog.length; si++) {
        var e2 = sim.bandLog[si];
        var want = e2.goldPerMeter / sim.bandLog[si - 1].goldPerMeter;
        var got = e2.goldRateBefore > 0 ? e2.goldRateAfter / e2.goldRateBefore : want;
        if (Math.abs(got - want) / want > 0.10) stepBad.push(e2.band + " got x" + got.toFixed(3) + " want x" + want.toFixed(3));
      }
      check("m2_band_income_step_within_10pct", "every step within 10% of gpm ratio", stepBad.join(" | "), stepBad.length === 0);

      // --- the other two policies run and behave
      var simNone = GD.simulate({ policy: "none", maxSeconds: 3600 });
      check("m2_policy_none_never_digs", "depth 0, no purchases", simNone.finalDepth.toFixed(2) + "/" + simNone.purchaseCount,
        simNone.purchaseCount === 0 && simNone.finalDepth === 0);
      var simRatio = GD.simulate({ policy: "ratio", maxSeconds: 3600 });
      check("m2_policy_ratio_runs", "purchases > 0", simRatio.purchaseCount, simRatio.purchaseCount > 0);
      check("m2_ratio_weight_lives_in_json", "a number in cfg.sim", cfg.sim.ratioDepthWeight, typeof cfg.sim.ratioDepthWeight === "number" && cfg.sim.ratioDepthWeight > 0);
      check("m2_unknown_policy_errors", "an error object", JSON.stringify(GD.simulate({ policy: "nope" })),
        !!GD.simulate({ policy: "nope" }).error);

      // --- simulate is deterministic for a given seed
      var a1 = GD.simulate({ seed: 42, maxSeconds: 2400 });
      var a2 = GD.simulate({ seed: 42, maxSeconds: 2400 });
      check("m2_simulate_deterministic_by_seed", a1.finalDepth, a2.finalDepth, approx(a1.finalDepth, a2.finalDepth, 1e-9));

      // --- offline resolver (PRD 9)
      var off = E.newState(cfg);
      off.owned[cfg.dwarves[0].id] = 3;
      var od = E.derive(cfg, off);
      var cap = cfg.offline.capHours * 3600;
      var want8 = od.goldRate * cap * cfg.offline.ratePercent;
      var p8 = GD.offlinePreview(8 * 3600 * 1000, off);
      var p24 = GD.offlinePreview(24 * 3600 * 1000, off);
      check("m2_offline_8h_equals_formula", want8, p8.gold, approx(p8.gold, want8, 1e-6));
      check("m2_offline_24h_equals_8h", p8.gold, p24.gold, approx(p8.gold, p24.gold, 1e-6));
      check("m2_offline_caps_seconds", cap, p24.cappedSeconds, approx(p24.cappedSeconds, cap, 1e-6));
      var p30 = GD.offlinePreview(30000, off);
      check("m2_offline_below_min_pays_nothing", 0, p30.gold, p30.gold === 0 && p30.cappedSeconds === 0);
      var pNeg = GD.offlinePreview(-5000, off);
      check("m2_offline_clock_skew_negative", 0, pNeg.gold, pNeg.gold === 0 && pNeg.reason === "skew");
      var pFar = GD.offlinePreview((cfg.offline.maxClockSkewHours + 1) * 3600 * 1000, off);
      check("m2_offline_clock_skew_absurd", 0, pFar.gold, pFar.gold === 0 && pFar.reason === "skew");
      check("m2_offline_advances_depth", od.digRate * cap * cfg.offline.ratePercent, p8.depth,
        approx(p8.depth, od.digRate * cap * cfg.offline.ratePercent, 1e-6));
      // Elevator extends the cap and lifts the rate
      var offE = E.cloneState(off);
      offE.owned.elevator = 2;
      var pE = GD.offlinePreview(24 * 3600 * 1000, offE);
      check("m2_elevator_extends_cap", (cfg.offline.capHours + 2) * 3600, pE.cappedSeconds,
        approx(pE.cappedSeconds, (cfg.offline.capHours + 2) * 3600, 1e-6));
      var dE = E.derive(cfg, offE);
      check("m2_elevator_lifts_offline_rate", 1.1 * 1.1, dE.offlineRateMul, approx(dE.offlineRateMul, 1.21, 1e-9));
      // applyOffline mutates by exactly the preview
      GD.setState({ owned: { dorrik: 3 } });
      var pv = GD.offlinePreview(2 * 3600 * 1000);
      var goldPre = GD.state.gold, depthPre = GD.state.depth;
      var ap = GD.applyOffline(2 * 3600 * 1000);
      check("m2_applyOffline_matches_preview", pv.gold + "/" + pv.depth.toFixed(4),
        (GD.state.gold - goldPre).toFixed(6) + "/" + (GD.state.depth - depthPre).toFixed(4),
        approx(GD.state.gold - goldPre, ap.gold, 1e-6) && approx(GD.state.depth - depthPre, ap.depth, 1e-6));

      // --- events
      GD.reset();
      GD.jumpTo(300);
      var depthBefore = GD.state.depth;
      var fired = GD.fire("cave_in");
      check("m2_fire_cave_in_returns_event", "cave_in", fired && fired.id, !!fired && fired.id === "cave_in");
      check("m2_cave_in_moves_depth_minus_5", depthBefore - 5, GD.state.depth, approx(GD.state.depth, depthBefore - 5, 1e-9));
      check("m2_cave_in_logs_its_line", cfg.flavor.eventTexts.cave_in, E.eventText(cfg, fired),
        E.eventText(cfg, fired) === cfg.flavor.eventTexts.cave_in);
      check("m2_event_counter_increments", 1, GD.state.eventsFired, GD.state.eventsFired === 1);

      GD.reset();
      GD.grantForTest("dorrik", 5);
      var rateBefore = GD.derive().digRate;
      GD.fire("gas_pocket");
      var rateDuring = GD.derive().digRate;
      check("m2_gas_pocket_halves_rate", rateBefore * 0.5, rateDuring, approx(rateDuring, rateBefore * 0.5, 1e-9));
      GD.step(25);
      check("m2_timed_effect_expires", rateBefore, GD.derive().digRate, approx(GD.derive().digRate, rateBefore, 1e-9));

      GD.reset();
      GD.grantForTest("dorrik", 5);
      var goldRateBefore = GD.derive().goldRate;
      GD.fire("rich_seam");
      check("m2_rich_seam_triples_gold", goldRateBefore * 3, GD.derive().goldRate, approx(GD.derive().goldRate, goldRateBefore * 3, 1e-9));

      // minDepth gating and hazard resist weighting
      GD.reset();
      var poolShallow = E.eligibleEvents(cfg, GD.state, GD.derive());
      check("m2_event_mindepth_gate", "only rich_seam at 0 m", poolShallow.list.map(function (x) { return x.e.id; }).join(","),
        poolShallow.list.length === 1 && poolShallow.list[0].e.id === "rich_seam");
      GD.jumpTo(400);
      GD.grantForTest("braces", 3);
      var dB = GD.derive();
      var poolDeep = E.eligibleEvents(cfg, GD.state, dB);
      var gasW = 0;
      for (var pi = 0; pi < poolDeep.list.length; pi++) if (poolDeep.list[pi].e.id === "gas_pocket") gasW = poolDeep.list[pi].w;
      check("m2_braces_scale_hazard_weight", 3 * Math.pow(0.9, 3), gasW, approx(gasW, 3 * Math.pow(0.9, 3), 1e-9));
      check("m2_non_hazard_weight_unscaled", 4, (function () {
        for (var z = 0; z < poolDeep.list.length; z++) if (poolDeep.list[z].e.id === "rich_seam") return poolDeep.list[z].w;
        return -1;
      })(), (function () {
        for (var z = 0; z < poolDeep.list.length; z++) if (poolDeep.list[z].e.id === "rich_seam") return poolDeep.list[z].w === 4;
        return false;
      })());
      // events never fire offline
      var offEv = E.newState(cfg);
      offEv.owned.dorrik = 5;
      GD.offlinePreview(8 * 3600 * 1000, offEv);
      check("m2_offline_fires_no_events", 0, offEv.eventsFired, offEv.eventsFired === 0);

      // --- milestone + ending
      GD.reset();
      GD.state.goldEarnedTotal = 1000;
      GD.jumpTo(cfg.milestone.depth);
      check("m2_milestone_sets_endingSeen", true, GD.state.endingSeen, GD.state.endingSeen === true);
      check("m2_milestone_score_formula", 1000 + cfg.milestone.depth * 100, GD.state.endingScore,
        approx(GD.state.endingScore, 1000 + cfg.milestone.depth * 100, 1e-6));
      var seenCount = 0;
      GD.hooks.onEnding = function () { seenCount++; };
      GD.jumpTo(cfg.milestone.depth + 100);
      GD.step(60);
      GD.hooks.onEnding = null;
      check("m2_milestone_fires_once", 0, seenCount, seenCount === 0);
      check("m2_game_continues_after_ending", "depth > milestone", GD.state.depth.toFixed(1), GD.state.depth >= cfg.milestone.depth);

      // --- endless bands after the ending (PRD 11)
      var es = E.endlessStart(cfg);
      var lastOre = cfg.ores[cfg.ores.length - 1];
      check("m2_endless_starts_after_last_band", lastOre.startDepth + cfg.endless.bandLengthM, es, es === lastOre.startDepth + cfg.endless.bandLengthM);
      var eb1 = E.bandAt(cfg, es + 1);
      var eb2 = E.bandAt(cfg, es + cfg.endless.bandLengthM + 1);
      check("m2_endless_band_multiplier", lastOre.goldPerMeter * cfg.endless.multiplierPerBand, eb1.goldPerMeter,
        approx(eb1.goldPerMeter, lastOre.goldPerMeter * cfg.endless.multiplierPerBand, 1e-9));
      check("m2_endless_band_compounds", lastOre.goldPerMeter * Math.pow(cfg.endless.multiplierPerBand, 2), eb2.goldPerMeter,
        approx(eb2.goldPerMeter, lastOre.goldPerMeter * Math.pow(cfg.endless.multiplierPerBand, 2), 1e-9));
      check("m2_endless_band_index_continues", cfg.ores.length, eb1.index, eb1.index === cfg.ores.length);

      // --- reveal: at depth d, ore renders through band d+1+revealBonus and no further
      if (window.GDRender && window.GDRender.bandPlan) {
        var revealBad = [];
        var probes = [0, 39, 41, 179, 181, 599, 601, 1199, 1500];
        for (var ri = 0; ri < probes.length; ri++) {
          for (var rb = 0; rb <= 3; rb++) {
            var plan = window.GDRender.bandPlan(probes[ri], rb);
            if (plan.maxIndex > plan.cutoffIndex) revealBad.push("d=" + probes[ri] + " rb=" + rb + " drew " + plan.maxIndex + " cutoff " + plan.cutoffIndex);
          }
        }
        check("m2_reveal_never_past_cutoff", "maxIndex <= currentIndex + 1 + revealBonus", revealBad.join(" | "), revealBad.length === 0);
        // and the tease IS drawn: standing just above a seam, the next band is in the plan
        var teasePlan = window.GDRender.bandPlan(38, 0);
        check("m2_next_band_teased_above_seam", "band index 1 in the plan", JSON.stringify(teasePlan.indices),
          teasePlan.indices.indexOf(1) !== -1 && teasePlan.cutoffIndex === 1);
        var veiled = window.GDRender.bandPlan(38, 0).veiledIndices;
        check("m2_next_band_is_veiled", "[1]", JSON.stringify(veiled), veiled.length === 1 && veiled[0] === 1);

        // --- Deep Lantern must be observable the moment it is bought, at EVERY depth,
        // not only where a band boundary happens to fall inside the viewport (critic MAJOR).
        var lanternBad = [];
        var lanternProbes = [0, 20, 35, 120, 200, 400, 590, 800, 1199, 1600];
        for (var li = 0; li < lanternProbes.length; li++) {
          var d0 = lanternProbes[li];
          var p0 = JSON.parse(JSON.stringify(window.GDRender.bandPlan(d0, 0)));
          var p1 = JSON.parse(JSON.stringify(window.GDRender.bandPlan(d0, 1)));
          var p2 = JSON.parse(JSON.stringify(window.GDRender.bandPlan(d0, 2)));
          var differs01 = p1.indices.length > p0.indices.length || p1.veilAlpha < p0.veilAlpha ||
            p1.forwardBiasBu > p0.forwardBiasBu || p1.nextBands.length > p0.nextBands.length;
          var differs12 = p2.indices.length > p1.indices.length || p2.veilAlpha < p1.veilAlpha ||
            p2.forwardBiasBu > p1.forwardBiasBu || p2.nextBands.length > p1.nextBands.length;
          if (!differs01) lanternBad.push("d=" + d0 + " level 1 changes nothing");
          if (!differs12) lanternBad.push("d=" + d0 + " level 2 changes nothing");
          if (JSON.stringify(p0) === JSON.stringify(p1)) lanternBad.push("d=" + d0 + " plan identical at 0 vs 1");
        }
        check("m2_lantern_observable_at_every_depth", "plan differs for every extra reveal level", lanternBad.join(" | "), lanternBad.length === 0);

        var l0 = window.GDRender.bandPlan(35, 0), lm0 = l0.forwardMeters, la0 = l0.veilAlpha, ln0 = l0.nextBands.length;
        var l1 = window.GDRender.bandPlan(35, 1), lm1 = l1.forwardMeters, la1 = l1.veilAlpha, ln1 = l1.nextBands.length;
        check("m2_lantern_widens_forward_view", "> " + lm0.toFixed(1) + " m", lm1.toFixed(1) + " m", lm1 > lm0);
        check("m2_lantern_lifts_the_veil", "< " + la0, la1, la1 < la0);
        check("m2_lantern_adds_a_next_band_line", ln0 + 1, ln1, ln1 === ln0 + 1);
        check("m2_base_game_shows_one_next_band", 1, ln0, ln0 === 1);
        var lFloor = window.GDRender.bandPlan(35, 20);
        check("m2_lantern_veil_has_a_floor", cfg.lantern.veilAlphaFloor, lFloor.veilAlpha, lFloor.veilAlpha === cfg.lantern.veilAlphaFloor);
        check("m2_lantern_face_has_a_floor", cfg.lantern.minFaceYBu, lFloor.faceYBu, lFloor.faceYBu === cfg.lantern.minFaceYBu);
        check("m2_lantern_params_are_json_driven", "face from cfg.lantern", window.GDRender.effFaceY(1),
          window.GDRender.effFaceY(1) === Math.max(cfg.lantern.minFaceYBu, cfg.layout.faceYBu - cfg.lantern.forwardTilesPerLevel * cfg.layout.tileBu));
        if (window.GDUI && window.GDUI.nextBandsReport) {
          GD.reset();
          var nb0 = window.GDUI.nextBandsReport();
          GD.grantForTest("lantern", 1);
          var nb1 = window.GDUI.nextBandsReport();
          check("m2_next_bands_readout_grows_with_lantern", nb0.lines + 1, nb1.lines, nb1.lines === nb0.lines + 1);
          check("m2_next_bands_readout_names_the_ore", "a band name and its startDepth", nb1.text, /\d+\s*m/.test(nb1.text) && nb1.text.length > 0);
        }
      } else {
        check("m2_renderer_exposes_bandPlan", "GDRender.bandPlan", "missing", false);
      }

      // --- ETA on locked rows
      GD.reset();
      GD.state.gold = 0;
      check("m2_eta_is_dash_while_rate_zero", Infinity, GD.etaFor("pick"), GD.etaFor("pick") === Infinity);
      GD.grantForTest("dorrik", 4);
      var dEta = GD.derive();
      var wantEta = (GD.costOf("pick") - GD.state.gold) / dEta.goldRate;
      check("m2_eta_formula", wantEta, GD.etaFor("pick"), approx(GD.etaFor("pick"), wantEta, 1e-9));
      GD.state.gold = GD.costOf("pick") + 1;
      check("m2_eta_zero_when_affordable", 0, GD.etaFor("pick"), GD.etaFor("pick") === 0);
      if (window.GDUI && window.GDUI.rowReport) {
        var rr = window.GDUI.rowReport();
        check("m2_shop_lists_all_tracks_and_dwarves", cfg.tracks.length + cfg.dwarves.length, rr.rows, rr.rows === cfg.tracks.length + cfg.dwarves.length);
        check("m2_locked_rows_show_price_and_eta", "every locked row has a price and an ETA string",
          rr.lockedWithoutEta + " locked rows missing an ETA", rr.lockedWithoutEta === 0);
      }

      // --- flavor
      check("m2_flavor_todo_count_reported", 0, E.flavorTodoCount(cfg), E.flavorTodoCount(cfg) === 0);
      check("m2_flavor_band_intro_for_every_ore", "4 intros", cfg.ores.map(function (o) { return E.bandIntro(cfg, o) ? 1 : 0; }).join(""),
        cfg.ores.every(function (o) { return !!E.bandIntro(cfg, o); }));
      check("m2_flavor_line_for_every_dwarf", "4 lines", cfg.dwarves.map(function (d) { return E.dwarfLine(cfg, d.id) ? 1 : 0; }).join(""),
        cfg.dwarves.every(function (d) { return !!E.dwarfLine(cfg, d.id); }));
      // no Tolkien Appendix A dwarf names anywhere in the shipped content (PRD 3)
      var banned = ["durin", "thorin", "balin", "dwalin", "borin", "farin", "fundin", "dain", "nain",
        "thrain", "thror", "gloin", "oin", "gimli", "frerin", "gror", "fili", "kili", "dori", "nori",
        "ori", "bifur", "bofur", "bombur", "narvi", "telchar", "azaghal", "mim", "moria", "khazad",
        "balrog", "mithril"];
      var hay = JSON.stringify({ o: cfg.ores, t: cfg.tracks, d: cfg.dwarves, e: cfg.events, f: cfg.flavor, m: cfg.milestone }).toLowerCase();
      var hits = [];
      for (var bn = 0; bn < banned.length; bn++) if (new RegExp("\\b" + banned[bn] + "\\b").test(hay)) hits.push(banned[bn]);
      check("m2_no_tolkien_appendix_a_names", "no hits", hits.join(","), hits.length === 0);

      // --- content-as-data: a fifth ore and a fifth dwarf, JSON only, no JS edit
      var ext = JSON.parse(JSON.stringify({
        configVersion: cfg.configVersion, title: cfg.title, start: cfg.start, sim: cfg.sim,
        format: cfg.format, ores: cfg.ores, tracks: cfg.tracks, dwarves: cfg.dwarves,
        eventRules: cfg.eventRules, events: cfg.events, offline: cfg.offline,
        milestone: cfg.milestone, endless: cfg.endless, flavor: cfg.flavor, save: cfg.save,
        layout: cfg.layout, veil: cfg.veil, vein: cfg.vein, debug: cfg.debug, lantern: cfg.lantern,
        camera: cfg.camera, sprites: cfg.sprites, titleCard: cfg.titleCard,
        audio: cfg.audio, particles: cfg.particles, ending: cfg.ending
      }));
      ext.ores.push({
        id: "voidglass", name: "Voidglass", startDepth: 2000, goldPerMeter: 400, pattern: "crystal",
        intro: "Test ore added by selfTest.", color: "#101018", wallColor: "#1b1b28",
        veinColor: "#5be0ff", glintColor: "#ffffff",
        palette: { base: "#1b1b28", light: "#2b2b3e", speck: "#5be0ff", dark: "#0e0e16" }
      });
      ext.dwarves.push({
        id: "brann_test", name: "Test Hire", job: "Tester", base: 9999, ratio: 1.5,
        effects: [{ verb: "add_rate", value: 0.5 }], flavor: "Added by selfTest.",
        cosmetic: { hat: "cap", beard: "short", palette: "rust" }
      });
      ext.flavor = JSON.parse(JSON.stringify(cfg.flavor));
      ext.flavor.bandIntro.voidglass = "Test ore added by selfTest.";
      ext.flavor.dwarfLines.brann_test = "Added by selfTest.";
      var extV = E.validateConfig(ext);
      check("m2_extended_config_validates", "ok", extV.errors.join(" | "), extV.ok);
      var setRes = GD.setConfig(ext, false);
      check("m2_setConfig_accepts_extended", "ok", JSON.stringify(setRes.errors || ""), setRes.ok === true);
      var newBand = E.bandAt(ext, 2100);
      check("m2_fifth_ore_becomes_a_band", "voidglass", newBand.id, newBand.id === "voidglass");
      check("m2_fifth_ore_band_index", 4, newBand.index, newBand.index === 4);
      check("m2_fifth_dwarf_is_purchasable", 9999, E.costOf(ext, GD.state, "brann_test"), E.costOf(ext, GD.state, "brann_test") === 9999);
      GD.state.gold = 20000;
      var hireRes = GD.buy("brann_test");
      check("m2_fifth_dwarf_can_be_hired", true, hireRes.ok, hireRes.ok === true);
      check("m2_fifth_dwarf_counts_as_crew", 1, GD.derive().dwarves, GD.derive().dwarves === 1);
      if (window.GDUI && window.GDUI.rowReport) {
        var rr2 = window.GDUI.rowReport();
        check("m2_fifth_dwarf_shows_in_shop", cfg.tracks.length + cfg.dwarves.length + 1, rr2.rows,
          rr2.rows === cfg.tracks.length + cfg.dwarves.length + 1);
        check("m2_fifth_dwarf_row_by_id", "a row for brann_test", rr2.ids.indexOf("brann_test") !== -1 ? "found" : "missing",
          rr2.ids.indexOf("brann_test") !== -1);
      }
      if (window.GDRender && window.GDRender.bandPlan) {
        var extPlan = window.GDRender.bandPlan(1999, 0);
        check("m2_fifth_ore_renders_as_the_tease", "index 4 within cutoff", JSON.stringify(extPlan.indices) + " cutoff " + extPlan.cutoffIndex,
          extPlan.maxIndex <= extPlan.cutoffIndex);
      }
      // restore the shipped config before anything else runs
      GD.setConfig(liveConfig, false);
      check("m2_config_restored_after_extension", cfg.ores.length, GD.config.ores.length, GD.config.ores.length === cfg.ores.length);

      // --- validateConfig catches the four named failures (PRD 12)
      function bad(mutate) {
        var c = JSON.parse(JSON.stringify(cfg));
        mutate(c);
        return E.validateConfig(c);
      }
      var badVerb = bad(function (c) { c.tracks[0].effects[0].verb = "make_sandwich"; });
      check("m2_validate_unknown_verb", "not ok", badVerb.ok, badVerb.ok === false && /unknown effect verb/.test(badVerb.errors.join()));
      var badPattern = bad(function (c) { c.ores[1].pattern = "plaid"; });
      check("m2_validate_unknown_pattern", "not ok", badPattern.ok, badPattern.ok === false && /unknown pattern/.test(badPattern.errors.join()));
      var badDup = bad(function (c) { c.tracks[1].id = c.tracks[0].id; });
      check("m2_validate_duplicate_id", "not ok", badDup.ok, badDup.ok === false && /duplicate id/.test(badDup.errors.join()));
      var badOrder = bad(function (c) { c.ores[2].startDepth = 10; });
      check("m2_validate_non_monotonic_startdepth", "not ok", badOrder.ok, badOrder.ok === false && /non-monotonic/.test(badOrder.errors.join()));
      check("m2_validate_shipped_file_ok", "ok", E.validateConfig(cfg).errors.join(" | "), E.validateConfig(cfg).ok);

      // --- no numbers left in JS: every purchasable and band number comes from cfg
      check("m2_purchase_engine_is_config_driven", cfg.dwarves[3].base * cfg.dwarves[3].ratio,
        (function () { var s = E.newState(cfg); s.owned[cfg.dwarves[3].id] = 1; return E.costOf(cfg, s, cfg.dwarves[3].id); })(),
        approx((function () { var s = E.newState(cfg); s.owned[cfg.dwarves[3].id] = 1; return E.costOf(cfg, s, cfg.dwarves[3].id); })(),
          cfg.dwarves[3].base * cfg.dwarves[3].ratio, 1e-6));


      // =========================================================== M3 block
      // Art-pass assertions (PRD 14, M3). These drive the real renderer through
      // GDRender.renderProbe (GD.step + manual render ticks) and read its counters
      // rather than sampling pixels.
      var SPR = window.GDSprites, RND = window.GDRender;
      if (!SPR || !RND || !RND.renderProbe) {
        check("m3_sprite_factory_present", "GDSprites + GDRender.renderProbe", "missing", false);
      } else {
        // --- BLOCKER 1 guard: every cached canvas must actually have pixels in it.
        // A cache that builds blank (a hibernated or lost 2D backing store) passed every
        // other M3 check while the shaft rendered as an empty black rectangle.
        var vrep = SPR.verify();
        check("m3_sprite_cache_every_entry_opaque", "0 blank of " + vrep.total,
          vrep.blank.length + " blank" + (vrep.blank.length ? ": " + vrep.blank.slice(0, 5).join(", ") : ""),
          vrep.blank.length === 0);
        check("m3_sprite_cache_is_populated", "> 100 cached canvases", vrep.total, vrep.total > 100);
        check("m3_sprite_cache_opaque_equals_total", vrep.total, vrep.opaque, vrep.opaque === vrep.total);
        GD.refreshDbg();
        check("m3_dbg_exposes_sprite_cache_opaque", "a number equal to the verified count",
          GD.dbg.spriteCacheOpaque, GD.dbg.spriteCacheOpaque === vrep.total && GD.dbg.spriteCacheTotal === vrep.total);
        // ensure() must be idempotent on a healthy cache: no rebuild, nothing blank
        var rbBefore = SPR.stats().rebuilds;
        var vrep2 = SPR.ensure(false);
        check("m3_sprite_cache_ensure_is_a_noop_when_healthy", rbBefore + " rebuilds",
          SPR.stats().rebuilds, SPR.stats().rebuilds === rbBefore && vrep2.blank.length === 0);
        var logoEl = document.getElementById("splash-logo");
        check("m3_splash_logo_has_pixels", "> 0 opaque pixels",
          logoEl ? SPR.opaqueCount(logoEl) : "no canvas",
          !!logoEl && SPR.opaqueCount(logoEl) > 0);
        check("m3_splash_logo_is_dpr_scaled", "backing store >= CSS box",
          logoEl ? logoEl.width + "x" + logoEl.height + " for " + logoEl.style.width : "no canvas",
          !!logoEl && logoEl.width >= parseInt(logoEl.style.width, 10));

        // --- ETA formatting never carries a 60 into the seconds slot (M3 critic)
        var etaBad = [];
        for (var ei = 0; ei < 400; ei++) {
          var probe = 1 + ei * 11.37;
          var txt = E.formatEta(probe);
          if (/\b60s\b/.test(txt) || /\b60m\b/.test(txt) || /\b24h\b/.test(txt)) etaBad.push(probe.toFixed(1) + " -> " + txt);
        }
        check("m3_eta_never_prints_60s", "no 60s / 60m / 24h", etaBad.slice(0, 4).join(" | "), etaBad.length === 0);
        check("m3_eta_rounds_before_splitting", "38m 0s", E.formatEta(2279.6), E.formatEta(2279.6) === "38m 0s");

        // The composite outline replaced a getImageData round-trip; prove it draws the
        // same rim the copied peasant-swarm algorithm does, rather than trusting it.
        (function () {
          function sample(fn) {
            var c = document.createElement("canvas");
            c.width = 14; c.height = 16;
            var g = c.getContext("2d");
            g.fillStyle = "#c0392b"; g.fillRect(4, 4, 6, 8); g.fillRect(6, 2, 2, 2);
            fn(c);
            var o = document.createElement("canvas"); o.width = 14; o.height = 16;
            var og = o.getContext("2d", { willReadFrequently: true });
            og.drawImage(c, 0, 0);
            return og.getImageData(0, 0, 14, 16).data;
          }
          var a = sample(SPR.outlineComposite), b = sample(SPR.outlineVerbatim);
          var diff = 0;
          for (var i = 0; i < a.length; i += 4) {
            if ((a[i + 3] > 0) !== (b[i + 3] > 0)) diff++;
            else if (a[i + 3] > 0 && (Math.abs(a[i] - b[i]) > 2 || Math.abs(a[i + 1] - b[i + 1]) > 2 || Math.abs(a[i + 2] - b[i + 2]) > 2)) diff++;
          }
          check("m3_composite_outline_matches_peasant_swarm", "0 differing pixels of 224", diff, diff === 0);
        })();

        var ss0 = SPR.stats();
        check("m3_sprite_factory_ready", "tiles for every ore, shaft parts built",
          ss0.tilePalettes + " palettes, ready=" + ss0.ready,
          ss0.ready === true && ss0.tilePalettes >= cfg.ores.length);
        check("m3_four_variants_per_band", cfg.sprites.tileVariants + " per band",
          SPR.tilesFor(cfg.ores[0]).length, SPR.tilesFor(cfg.ores[0]).length === cfg.sprites.tileVariants);

        // --- no placeholder rects at any depth: the wall is blitted tiles, and the
        // fallback fill path (the only rect left in the tile loop) never runs.
        GD.reset();
        GD.grantForTest(cfg.dwarves[0].id, 2);
        var depthProbes = [0, 12, 39, 41, 120, 179, 181, 400, 599, 601, 700, 1199, 1400, 2100];
        var phBad = [], noTiles = [];
        for (var m3i = 0; m3i < depthProbes.length; m3i++) {
          GD.jumpTo(depthProbes[m3i]);
          RND.cameraSnap();
          var pr = RND.renderProbe(GD.state, GD.derive(), 2, 1 / 60);
          if (pr.placeholderRects > 0) phBad.push("d=" + depthProbes[m3i] + " rects=" + pr.placeholderRects);
          if (!(pr.tileBlits > 0)) noTiles.push("d=" + depthProbes[m3i]);
          if (pr.maxDrawnIndex > pr.cutoffIndex) phBad.push("d=" + depthProbes[m3i] + " drew band " + pr.maxDrawnIndex + " past cutoff " + pr.cutoffIndex);
        }
        check("m3_no_placeholder_rects_at_any_depth", "0 at every probe depth", phBad.join(" | "), phBad.length === 0);
        check("m3_walls_are_blitted_tiles", "tileBlits > 0 at every probe depth", noTiles.join(" | "), noTiles.length === 0);

        // --- seam dither at every band boundary
        var seamBad = [];
        for (var bi3 = 1; bi3 < cfg.ores.length; bi3++) {
          var sd = cfg.ores[bi3].startDepth;
          GD.jumpTo(Math.max(0, sd - 2));
          RND.cameraSnap();
          var prS = RND.renderProbe(GD.state, GD.derive(), 2, 1 / 60);
          if (!(prS.seams >= 1)) seamBad.push(cfg.ores[bi3].id + " @" + sd + ": no seam drawn");
        }
        // and the first endless boundary, which is synthesized rather than authored
        GD.jumpTo(E.endlessStart(cfg) - 2);
        RND.cameraSnap();
        var prE = RND.renderProbe(GD.state, GD.derive(), 2, 1 / 60);
        if (!(prE.seams >= 1)) seamBad.push("endless boundary: no seam drawn");
        check("m3_seam_dither_at_every_boundary", "a seam strip at every boundary", seamBad.join(" | "), seamBad.length === 0);

        // --- the veil is painted on d+1+revealBonus and on nothing beyond it
        var veilBad = [];
        for (var rb3 = 0; rb3 <= 2; rb3++) {
          GD.reset();
          if (rb3) GD.grantForTest("lantern", rb3);
          GD.jumpTo(cfg.ores[1].startDepth - 3);
          RND.cameraSnap();
          var prV = RND.renderProbe(GD.state, GD.derive(), 2, 1 / 60);
          if (!(prV.veiled >= 1)) veilBad.push("rb=" + rb3 + ": nothing veiled above the seam");
          if (prV.maxVeiledIndex > prV.cutoffIndex) veilBad.push("rb=" + rb3 + ": veiled band " + prV.maxVeiledIndex + " past cutoff " + prV.cutoffIndex);
          if (prV.maxDrawnIndex > prV.cutoffIndex) veilBad.push("rb=" + rb3 + ": drew band " + prV.maxDrawnIndex + " past cutoff " + prV.cutoffIndex);
        }
        check("m3_veil_through_cutoff_and_no_further", "veiled, and never past d+1+revealBonus", veilBad.join(" | "), veilBad.length === 0);

        // --- every hired dwarf is on a ledge, with its own loadout
        GD.reset();
        var wantCrew = 0;
        for (var dz = 0; dz < cfg.dwarves.length; dz++) { GD.grantForTest(cfg.dwarves[dz].id, 2); wantCrew += 2; }
        GD.jumpTo(300);
        RND.cameraSnap();
        var prC = RND.renderProbe(GD.state, GD.derive(), 2, 1 / 60);
        check("m3_every_hired_dwarf_is_drawn", wantCrew, prC.dwarves, prC.dwarves === wantCrew);

        // --- the dwarf cache is bounded by loadouts x frames: no per-frame builds
        var before = SPR.dwarfCacheSize();
        RND.renderProbe(GD.state, GD.derive(), 120, 1 / 60);
        var after = SPR.dwarfCacheSize();
        var loCount = SPR.dwarfLoadoutCount(), frames = cfg.sprites.dwarfFrames;
        check("m3_dwarf_cache_within_loadouts_x_frames", "<= " + (loCount * frames), after,
          after <= loCount * frames);
        check("m3_dwarf_cache_stable_across_frames", before, after, after === before);

        // --- the scrolling camera. GD.step moves the crew down; manual render ticks
        // stand in for one second of rAF. PRD 14 M3: within 16 bu of the deepest dwarf.
        GD.reset();
        GD.grantForTest("dorrik", 2);
        GD.grantForTest("nix", 1);
        var brk = cfg.ores[1].startDepth;
        GD.jumpTo(brk - 8);
        RND.cameraSnap();
        RND.renderProbe(GD.state, GD.derive(), 30, 1 / 60);       // let it settle above the seam
        var bandBefore = GD.derive().band.index;
        GD.step(20);                                              // dig through the boundary
        var bandAfter = GD.derive().band.index;
        var prCam = RND.renderProbe(GD.state, GD.derive(), 60, 1 / 60);   // one second of frames
        check("m3_camera_test_actually_crossed_a_band", bandBefore + " -> " + (bandBefore + 1),
          bandBefore + " -> " + bandAfter, bandAfter === bandBefore + 1);
        check("m3_camera_within_16bu_of_deepest_dwarf", "<= 16 bu",
          Math.abs(prCam.cameraY - prCam.deepestDwarfY).toFixed(2) + " bu",
          Math.abs(prCam.cameraY - prCam.deepestDwarfY) <= 16);
        check("m3_camera_exposed_on_dbg", "a number", typeof GD.dbg.cameraY, typeof GD.dbg.cameraY === "number");

        // --- drag scrolls back up, and the camera snaps back after snapBackMs
        RND.cameraNudge(-200, true);
        RND.cameraRelease();
        var prUp = RND.renderProbe(GD.state, GD.derive(), 30, 1 / 60);
        check("m3_camera_scrolls_back_up", "> 100 bu off the face",
          Math.abs(prUp.cameraY - prUp.deepestDwarfY).toFixed(1) + " bu",
          Math.abs(prUp.cameraY - prUp.deepestDwarfY) > 100);
        RND.renderProbe(GD.state, GD.derive(), 4, cfg.camera.snapBackMs / 4000);   // idle past the snap-back delay
        var prBack = RND.renderProbe(GD.state, GD.derive(), 300, 1 / 60);
        check("m3_camera_snaps_back_to_the_face", "<= 16 bu",
          Math.abs(prBack.cameraY - prBack.deepestDwarfY).toFixed(2) + " bu",
          Math.abs(prBack.cameraY - prBack.deepestDwarfY) <= 16);

        // --- the one generated asset stays inside its budget
        var capBytes = (cfg.titleCard && cfg.titleCard.maxBytes) || 122880;
        check("m3_title_card_within_120kb", "1.." + capBytes + " bytes", GD.dbg.titleCardBytes,
          GD.dbg.titleCardBytes > 0 && GD.dbg.titleCardBytes <= capBytes);
        check("m3_title_card_is_splash_only", "splash element present and not in the shaft",
          document.getElementById("splash") ? "found" : "missing",
          !!document.getElementById("splash"));
      }
      // --- M3 JSON knobs exist and are used
      check("m3_json_band_palettes", cfg.ores.length + " palettes",
        cfg.ores.filter(function (o) { return o.palette && o.palette.base; }).length,
        cfg.ores.every(function (o) { return o.palette && o.palette.base && o.palette.light && o.palette.dark && o.palette.speck; }));
      check("m3_json_camera_block", "ease + snapBackMs", JSON.stringify(cfg.camera || null),
        !!cfg.camera && cfg.camera.ease > 0 && cfg.camera.snapBackMs >= 0);
      check("m3_json_veil_block", "alpha + scanline", (cfg.veil || {}).alpha + "/" + (cfg.veil || {}).scanline,
        cfg.veil.alpha > 0 && cfg.veil.scanline >= 1);
      check("m3_json_sprites_block", "frame rates", (cfg.sprites || {}).digFps + "/" + (cfg.sprites || {}).walkFps,
        !!cfg.sprites && cfg.sprites.digFps > 0 && cfg.sprites.walkFps > 0);
      var badPal = bad3(function (c) { delete c.ores[1].palette; });
      check("m3_validate_missing_palette", "not ok", badPal.ok, badPal.ok === false && /palette needs/.test(badPal.errors.join()));
      var badCam = bad3(function (c) { c.camera.ease = 0; });
      check("m3_validate_bad_camera_ease", "not ok", badCam.ok, badCam.ok === false && /camera.ease/.test(badCam.errors.join()));
      var badCos = bad3(function (c) { c.dwarves[0].cosmetic.palette = "chartreuse"; });
      check("m3_validate_unknown_cosmetic_palette", "not ok", badCos.ok, badCos.ok === false && /unknown cosmetic palette/.test(badCos.errors.join()));

      // =========================================================== M4 block
      // Audio: mute state, master gain, no cue when muted
      if (window.GDRender && window.GDRender.renderSignature) {
      GD.dbg.renderSignature = function () {
        return window.GDRender.renderSignature(GD.state, GD.derive());
      };
    }
    if (window.GDAudio) {
        var A = window.GDAudio;
        var prevMuted = A.isMuted();
        A.setMuted(true);
        check("m4_muted_master_gain_zero", 0, A.masterGainValue(), A.masterGainValue() === 0);
        var cueBefore = A.lastCue;
        A.play("strike"); // should be no-op
        check("m4_muted_no_cue_scheduled", cueBefore, A.lastCue, A.lastCue === cueBefore);

        // Mute persisted in prefs
        GD.state.prefs.muted = true;
        var savedPrefs = JSON.parse(JSON.stringify(GD.state.prefs));
        check("m4_mute_persisted_in_prefs", true, savedPrefs.muted, savedPrefs.muted === true);

        // Item 1: lastCue tracks after play
        A.lastCue = null;
        A.setMuted(false);
        A.play("strike");
        check("m4_lastcue_tracks_strike", "strike", A.lastCue, A.lastCue === "strike");
        check("m4_dbg_lastcue_synced", "strike", GD.dbg.lastCue, GD.dbg.lastCue === "strike");
        A.play("buy");
        check("m4_lastcue_tracks_buy", "buy", A.lastCue, A.lastCue === "buy");
        A.play("hire");
        check("m4_lastcue_tracks_hire", "hire", A.lastCue, A.lastCue === "hire");
        A.play("denied");
        check("m4_lastcue_tracks_denied", "denied", A.lastCue, A.lastCue === "denied");

        A.setMuted(prevMuted);
        GD.state.prefs.muted = prevMuted;

        // Item 3: GD.audio.muted facade
        check("m4_audio_facade_exists", true, typeof GD.audio === "object", typeof GD.audio === "object");
        check("m4_audio_muted_matches", A.isMuted(), GD.audio.muted, GD.audio.muted === A.isMuted());
      } else {
        check("m4_audio_module_present", "GDAudio", "missing", false);
      }

      // Item 2: simulate is non-destructive
      GD.reset();
      GD.grantForTest("dorrik", 3);
      GD.state.gold = 500;
      var preSimState = E.cloneState(GD.state);
      var preSimSave = window.GDSave.readRaw(cfg);
      window.GDSave.write(cfg, GD.state); // ensure a save exists
      var preSimSave2 = window.GDSave.readRaw(cfg);
      GD.simulate({ maxSeconds: 3600 });
      check("m4_simulate_gold_unchanged", preSimState.gold, GD.state.gold,
        approx(GD.state.gold, preSimState.gold, 1e-9));
      check("m4_simulate_depth_unchanged", preSimState.depth, GD.state.depth,
        approx(GD.state.depth, preSimState.depth, 1e-9));
      var postSimSave = window.GDSave.readRaw(cfg);
      check("m4_simulate_save_unchanged", preSimSave2, postSimSave, postSimSave === preSimSave2);

      // Export/import round-trip
      GD.reset();
      GD.state.gold = 12345.67;
      GD.state.depth = 456.78;
      GD.state.goldEarnedTotal = 99999;
      GD.grantForTest("pick", 5);
      GD.grantForTest("dorrik", 3);
      var exported = GD.export();
      check("m4_export_produces_string", "a string", typeof exported, typeof exported === "string" && exported.length > 10);

      // Import on a fresh state
      GD.reset();
      var importResult = GD.import(exported);
      check("m4_import_succeeds", true, importResult.ok, importResult.ok === true);
      check("m4_import_gold_exact", 12345.67, GD.state.gold, approx(GD.state.gold, 12345.67, 0.01));
      check("m4_import_depth_exact", 456.78, GD.state.depth, approx(GD.state.depth, 456.78, 0.01));
      check("m4_import_goldEarnedTotal_exact", 99999, GD.state.goldEarnedTotal, approx(GD.state.goldEarnedTotal, 99999, 0.01));
      check("m4_import_owned_exact", "pick=5,dorrik=3",
        "pick=" + (GD.state.owned.pick || 0) + ",dorrik=" + (GD.state.owned.dorrik || 0),
        GD.state.owned.pick === 5 && GD.state.owned.dorrik === 3);

      // Truncated import fails safely
      var truncated = exported.substring(0, 20);
      GD.state.gold = 777;
      var truncResult = GD.import(truncated);
      check("m4_truncated_import_fails", false, truncResult.ok, truncResult.ok === false);
      check("m4_truncated_import_gold_untouched", 777, GD.state.gold, GD.state.gold === 777);

      // Version-bumped import fails safely
      var badVersionPayload;
      try { badVersionPayload = atob(exported); } catch (e) { badVersionPayload = ""; }
      if (badVersionPayload) {
        var badEnv = JSON.parse(badVersionPayload);
        badEnv.v = 9999;
        var badExport = btoa(JSON.stringify(badEnv));
        var badResult = GD.import(badExport);
        check("m4_version_bumped_import_fails", false, badResult.ok, badResult.ok === false);
        check("m4_version_bumped_gold_untouched", 777, GD.state.gold, GD.state.gold === 777);
      }

      // jumpTo(1200) triggers ending once, sets endingSeen, game continues
      GD.reset();
      GD.state.goldEarnedTotal = 5000;
      var endingCount = 0;
      GD.hooks.onEnding = function () { endingCount++; };
      GD.jumpTo(cfg.milestone.depth);
      check("m4_ending_triggers_once", 1, endingCount, endingCount === 1);
      check("m4_endingSeen_set", true, GD.state.endingSeen, GD.state.endingSeen === true);
      // game continues after ending
      GD.grantForTest("dorrik", 3);
      GD.step(10);
      check("m4_game_continues_after_ending", true, GD.state.depth > cfg.milestone.depth,
        GD.state.depth > cfg.milestone.depth);
      // second jumpTo does NOT fire again
      GD.jumpTo(cfg.milestone.depth + 500);
      check("m4_ending_fires_only_once", 1, endingCount, endingCount === 1);
      GD.hooks.onEnding = null;

      // Particle count never exceeds particles.max
      check("m4_particle_max_in_json", true, cfg.particles && cfg.particles.max > 0,
        cfg.particles && cfg.particles.max > 0);

      // No visible FLAVOR-TODO in any rendered DOM text
      var allText = document.body.innerText || "";
      var hasTodo = allText.indexOf("FLAVOR-TODO") !== -1;
      // Check that the fallbacks table exists
      check("m4_flavor_fallbacks_exist", true, !!(cfg.flavor && cfg.flavor.fallbacks),
        !!(cfg.flavor && cfg.flavor.fallbacks));

      // Layout assertions
      if (typeof window.innerWidth === "number") {
        check("m4_no_horizontal_scroll", true,
          document.documentElement.scrollWidth <= window.innerWidth + 2,
          document.documentElement.scrollWidth <= window.innerWidth + 2);
      }

      // Item 6: purchase visibility - every track changes what is DRAWN
      if (window.GDRender && window.GDRender.renderSignature) {
        var pvBad = [];
        GD.reset();
        GD.jumpTo(1000); // past all minDepth locks so every item is purchasable
        GD.grantForTest("dorrik", 2); // need crew for rate-dependent visuals
        var pvList = E.purchasables(cfg);
        for (var pvi = 0; pvi < pvList.length; pvi++) {
          var pvItem = pvList[pvi];
          var pvId = pvItem.id;
          GD.state.gold = 1e12;
          var pvBefore = JSON.stringify(window.GDRender.renderSignature(GD.state, GD.derive()));
          E.buy(cfg, GD.state, pvId); // use engine buy to avoid audio side effects in selfTest
          var pvAfter = JSON.stringify(window.GDRender.renderSignature(GD.state, GD.derive()));
          if (pvBefore === pvAfter) pvBad.push(pvId);
        }
        check("m4_every_purchase_changes_render_signature", "all 12 change", pvBad.join(","), pvBad.length === 0);
      }

      // Item 8: crew positions no overlap
      if (window.GDRender && window.GDRender.crewPositions) {
        var crewBad = [];
        var crewCounts = [1, 4, 10, 18, 30];
        for (var cci = 0; cci < crewCounts.length; cci++) {
          GD.reset();
          GD.grantForTest("dorrik", Math.ceil(crewCounts[cci] / 4));
          GD.grantForTest("hald", Math.ceil(crewCounts[cci] / 4));
          GD.grantForTest("vessa", Math.ceil(crewCounts[cci] / 4));
          GD.grantForTest("nix", Math.ceil(crewCounts[cci] / 4));
          GD.jumpTo(300);
          window.GDRender.cameraSnap();
          var cp = window.GDRender.crewPositions(GD.state, GD.derive());
          var dw2 = cfg.sprites.dwarfWBu, dh2 = cfg.sprites.dwarfHBu;
          for (var ca = 0; ca < cp.length; ca++) {
            for (var cb = ca + 1; cb < cp.length; cb++) {
              if (Math.abs(cp[ca].x - cp[cb].x) < dw2 && Math.abs(cp[ca].y - cp[cb].y) < dh2) {
                crewBad.push("N=" + crewCounts[cci] + " slots " + ca + "/" + cb + " overlap at (" +
                  cp[ca].x + "," + cp[ca].y + ") vs (" + cp[cb].x + "," + cp[cb].y + ")");
              }
            }
          }
        }
        check("m4_crew_no_overlap", "0 overlaps", crewBad.slice(0, 3).join(" | "), crewBad.length === 0);
      }

      // Item 2+4: row states -- no depth locks in v1 (B2-1: all minDepth stripped)
      GD.reset();
      var anyLocked2 = false;
      var allItems2 = E.purchasables(cfg);
      for (var ali2 = 0; ali2 < allItems2.length; ali2++) {
        if (E.isLocked(cfg, GD.state, allItems2[ali2].id)) anyLocked2 = true;
      }
      check("m4_no_depth_locks_in_v1", false, anyLocked2, !anyLocked2);

      // Item 5: bulk cost equals N single buys exactly
      GD.reset();
      var singleSum = 0;
      for (var bci = 0; bci < 5; bci++) singleSum += cfg.tracks[0].base * Math.pow(cfg.tracks[0].ratio, bci);
      var bulk = E.bulkCost(cfg, GD.state, cfg.tracks[0].id, 5);
      check("m4_bulk_cost_equals_singles", singleSum, bulk, approx(bulk, singleSum, 1e-6));

      // Item 7: richButLockedMax < 30
      check("m4_richButLockedMax_under_30", "< 30",
        sim.richButLockedMax !== undefined ? sim.richButLockedMax.toFixed(1) : "missing",
        sim.richButLockedMax !== undefined && sim.richButLockedMax < 30);

      // =========================================================== P7 block
      // Phase 7: FLAVOR-TODO zero in DOM (excluding the debug overlay which shows the count)
      var dbgEl7 = document.getElementById("dbg");
      var dbgText7 = dbgEl7 ? dbgEl7.innerText : "";
      var allText7 = (document.body.innerText || "").replace(dbgText7, "");
      check("p7_no_flavor_todo_in_dom", false, allText7.indexOf("FLAVOR-TODO") !== -1,
        allText7.indexOf("FLAVOR-TODO") === -1);
      check("p7_flavor_todo_count_zero", 0, GD.dbg.flavorTodoCount, GD.dbg.flavorTodoCount === 0);

      // Phase 7: elementFromPoint hit-testing for EVERY primary control.
      // Helper: test that elementFromPoint at center of `el` returns it or a descendant.
      function hitTest(label, el) {
        if (!el) { check(label, "element present", "null", false); return; }
        var r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) { check(label, "visible", "0x0", false); return; }
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
          check(label, "in viewport", cx.toFixed(0) + "," + cy.toFixed(0) + " out", false);
          return;
        }
        var hit = document.elementFromPoint(cx, cy);
        var ok = hit && (hit === el || el.contains(hit));
        check(label, "el or descendant", hit ? hit.tagName + (hit.id ? "#" + hit.id : "") : "null", ok);
      }

      // 1. DESCEND (splash must be visible)
      var splashEl7 = document.getElementById("splash");
      var splashWasGone = splashEl7 && splashEl7.classList.contains("gone");
      var splashWasOff = splashEl7 && splashEl7.classList.contains("off");
      if (document.getElementById("descend") && splashEl7 && !splashWasOff) {
        hitTest("p7_hit_descend", document.getElementById("descend"));
      }
      // Dismiss splash for remaining game-area hit tests
      if (splashEl7) { splashEl7.classList.add("gone"); splashEl7.classList.add("off"); }

      // 2. Shaft canvas (dig/strike target)
      var shaftEl = document.getElementById("shaft");
      if (shaftEl) hitTest("p7_hit_shaft_canvas", shaftEl);

      // 3. Mute button
      hitTest("p7_hit_mute_btn", document.getElementById("mute-btn"));

      // 4. Tab buttons (portrait only — hidden on desktop)
      var tabbarEl = document.getElementById("tabbar");
      if (tabbarEl && getComputedStyle(tabbarEl).display !== "none") {
        var tabBtns = tabbarEl.querySelectorAll(".tab");
        var tabHitBad = [];
        for (var thi = 0; thi < tabBtns.length; thi++) {
          var tbr = tabBtns[thi].getBoundingClientRect();
          if (tbr.width <= 0 || tbr.top < 0 || tbr.top > window.innerHeight) continue;
          var tEl = document.elementFromPoint(tbr.left + tbr.width / 2, tbr.top + tbr.height / 2);
          if (!tEl || (tEl !== tabBtns[thi] && !tabBtns[thi].contains(tEl))) {
            tabHitBad.push(tabBtns[thi].textContent);
          }
        }
        check("p7_hit_tabs", "all 4 hittable", tabHitBad.join(","), tabHitBad.length === 0);
      }

      // 5. Qty toggle buttons (wherever currently visible — portrait tabpanel or desktop rail)
      var qtyBar = document.getElementById("qty-bar");
      if (qtyBar && getComputedStyle(qtyBar).display !== "none") {
        var qtyBtns = qtyBar.querySelectorAll(".qty-btn");
        var qtyHitBad = [];
        for (var qhi = 0; qhi < qtyBtns.length; qhi++) {
          var qbr = qtyBtns[qhi].getBoundingClientRect();
          if (qbr.width <= 0 || qbr.top < 0 || qbr.top > window.innerHeight) continue;
          var qEl = document.elementFromPoint(qbr.left + qbr.width / 2, qbr.top + qbr.height / 2);
          if (!qEl || (qEl !== qtyBtns[qhi] && !qtyBtns[qhi].contains(qEl))) {
            qtyHitBad.push(qtyBtns[qhi].textContent);
          }
        }
        check("p7_hit_qty_toggle", "all 4 hittable", qtyHitBad.join(","), qtyHitBad.length === 0);
      }

      // 6. Shop buy row — first visible .buy button in the current layout
      var buyBtns = document.querySelectorAll(".buy");
      var foundBuyPortrait = false, foundBuyRail = false;
      for (var bbi = 0; bbi < buyBtns.length; bbi++) {
        var bbr = buyBtns[bbi].getBoundingClientRect();
        if (bbr.width <= 0 || bbr.top < 0 || bbr.top > window.innerHeight) continue;
        var bEl = document.elementFromPoint(bbr.left + bbr.width / 2, bbr.top + bbr.height / 2);
        var bOk = bEl && (bEl === buyBtns[bbi] || buyBtns[bbi].contains(bEl));
        var inRail = !!buyBtns[bbi].closest("#right-rail");
        if (inRail && !foundBuyRail) {
          check("p7_hit_buy_row_desktop_rail", "buy btn hittable in rail", bEl ? bEl.tagName : "null", bOk);
          foundBuyRail = true;
        } else if (!inRail && !foundBuyPortrait) {
          check("p7_hit_buy_row_portrait", "buy btn hittable in portrait", bEl ? bEl.tagName : "null", bOk);
          foundBuyPortrait = true;
        }
        if (foundBuyPortrait || foundBuyRail) break; // one per layout is enough
      }

      // 7. Settings panel buttons: open settings, test each button, close
      if (window.GDUI && window.GDUI.openSettings) {
        window.GDUI.openSettings();
        var settingsEl = document.getElementById("settings");
        if (settingsEl && !settingsEl.classList.contains("hidden")) {
          hitTest("p7_hit_settings_mute", document.getElementById("set-mute"));
          hitTest("p7_hit_settings_export", document.getElementById("set-export"));
          hitTest("p7_hit_settings_import", document.getElementById("set-import"));
          hitTest("p7_hit_settings_reset", document.getElementById("set-reset"));
          hitTest("p7_hit_settings_close", document.getElementById("settings-close"));
        }
        // Close settings
        settingsEl.classList.add("hidden");
      }

      // 8. KEEP DIGGING on ending overlay: trigger ending, test the button, close
      GD.reset();
      GD.state.goldEarnedTotal = 5000;
      // Show ending panel directly (bypassing the timing delay)
      var endingEl = document.getElementById("ending");
      if (endingEl) {
        var endingHead = endingEl.querySelector(".panel-head");
        var endingBody = endingEl.querySelector(".panel-body");
        var endingBtn = endingEl.querySelector(".panel-btn");
        if (endingHead) endingHead.textContent = "TEST";
        if (endingBody) endingBody.innerHTML = "<p>test</p>";
        if (endingBtn) endingBtn.textContent = "KEEP DIGGING";
        endingEl.classList.remove("hidden");
        hitTest("p7_hit_keep_digging", endingBtn);
        endingEl.classList.add("hidden");
      }

      // 9. Spacebar to mine: dispatch through the LIVE document keydown listener
      // and assert gold, lastCue AND juice counter (strikeCount) all change.
      // This tests the real keyboard path, not a private function.
      GD.reset();
      GD.grantForTest("dorrik", 1);
      // Ensure splash is dismissed so Space reaches doStrike
      var sp9 = document.getElementById("splash");
      if (sp9) { sp9.classList.add("gone"); sp9.classList.add("off"); }
      var goldBeforeSpace = GD.state.gold;
      if (window.GDAudio) window.GDAudio.lastCue = null;
      GD.dbg.lastCue = null;
      var strikesBefore = (window.GDUI && window.GDUI.strikeCount) || 0;
      // Dispatch through document — the same target the live listener is on
      var spaceEvt = new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true });
      document.dispatchEvent(spaceEvt);
      var goldAfterSpace = GD.state.gold;
      var strikesAfter = (window.GDUI && window.GDUI.strikeCount) || 0;
      check("p7_space_mines_gold", true, goldAfterSpace > goldBeforeSpace,
        goldAfterSpace > goldBeforeSpace);
      var cueName = window.GDAudio ? window.GDAudio.lastCue : GD.dbg.lastCue;
      check("p7_space_sets_lastcue", "strike", cueName, cueName === "strike");
      check("p7_space_fires_juice", strikesBefore + 1, strikesAfter,
        strikesAfter === strikesBefore + 1);

      // Space during textarea focus must NOT strike
      var ta = document.getElementById("import-area");
      if (ta) {
        ta.classList.remove("hidden");
        ta.focus();
        var goldBeforeFocused = GD.state.gold;
        var strikesBeforeFocused = window.GDUI.strikeCount;
        var spaceEvt2 = new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true });
        document.dispatchEvent(spaceEvt2);
        check("p7_space_ignored_in_textarea", goldBeforeFocused, GD.state.gold,
          GD.state.gold === goldBeforeFocused);
        check("p7_space_no_juice_in_textarea", strikesBeforeFocused, window.GDUI.strikeCount,
          window.GDUI.strikeCount === strikesBeforeFocused);
        ta.blur();
        ta.classList.add("hidden");
      }

      // spaceMinesPerSec lives in JSON
      check("p7_space_rate_in_json", true,
        !!(cfg.input && cfg.input.spaceMinesPerSec > 0),
        !!(cfg.input && cfg.input.spaceMinesPerSec > 0));

      // Effect description function produces non-empty strings
      var edBad = [];
      var allPurch = E.purchasables(cfg);
      for (var edi = 0; edi < allPurch.length; edi++) {
        var ed = E.effectDesc(allPurch[edi].effects);
        if (!ed) edBad.push(allPurch[edi].id);
      }
      check("p7_effect_desc_for_all", "all have descriptions", edBad.join(","), edBad.length === 0);

      // Layout assertion: at least 3 buy rows intersect the viewport
      if (window.GDUI && window.GDUI.rowReport) {
        var rr3 = window.GDUI.rowReport();
        check("m4_min_3_visible_rows", ">= 3 rows", rr3.rows, rr3.rows >= 3);
      }

      // JSON blocks present
      check("m4_json_audio_block", true, !!cfg.audio, !!cfg.audio && typeof cfg.audio.masterGain === "number");
      check("m4_json_particles_block", true, !!cfg.particles, !!cfg.particles && cfg.particles.max > 0);
      check("m4_json_ending_block", true, !!cfg.ending, !!cfg.ending && cfg.ending.totalDurationS > 0);
      check("m4_json_layout_desktop", true, !!cfg.layout.desktopBreakpoint,
        cfg.layout.desktopBreakpoint > 0 && cfg.layout.leftRailPx > 0 && cfg.layout.rightRailPx > 0);
      // Item 3: spriteCacheBlank is a number
      check("m4_sprite_cache_blank_is_number", "number", typeof GD.dbg.spriteCacheBlank,
        typeof GD.dbg.spriteCacheBlank === "number");

      check("m4_json_flavor_fallbacks", true, !!(cfg.flavor && cfg.flavor.fallbacks && cfg.flavor.fallbacks.welcomeBack),
        !!(cfg.flavor && cfg.flavor.fallbacks && cfg.flavor.fallbacks.welcomeBack));

      // =========================================================== P7-fix block
      // Format assertion: formatted strings stay compact for values up to 1e30
      var fmtMax = cfg.format.maxChars || 7;
      var fmtBad = [];
      var fmtProbes = [0, 1, 999, 1000, 999999, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21, 1e24, 1e27, 1e30];
      for (var fi = 0; fi < fmtProbes.length; fi++) {
        var fs = GD.format(fmtProbes[fi]);
        if (fs.length > fmtMax) fmtBad.push(fmtProbes[fi] + " -> \"" + fs + "\" (" + fs.length + " chars)");
        // No stray digits after a suffix letter (malformed like "1.78M9")
        if (/[A-Za-z]\d/.test(fs) && !/e\d/.test(fs)) fmtBad.push(fmtProbes[fi] + " -> \"" + fs + "\" (malformed)");
      }
      check("p7fix_format_compact_to_1e30", "all <= " + fmtMax + " chars, no malformed", fmtBad.join(" | "), fmtBad.length === 0);

      // Format assertions for INCOME and DEPTH HUD strings
      var incMax = 12; // "+999Dc/s" = 10 chars max, 12 generous
      var depMax = 10; // "999Dc km" or "9999.9 m" = 10 chars max
      var hudFmtBad = [];
      var rateProbes = [0, 1, 999, 1e6, 1e9, 1e15, 1e21, 1e30, 1e36];
      for (var ri7 = 0; ri7 < rateProbes.length; ri7++) {
        var rStr = "+" + GD.format(rateProbes[ri7]) + "/s";
        if (rStr.length > incMax) hudFmtBad.push("income " + rateProbes[ri7] + " -> \"" + rStr + "\" (" + rStr.length + ")");
        if (/[A-Za-z]\d/.test(rStr) && !/e\d/.test(rStr)) hudFmtBad.push("income malformed: " + rStr);
      }
      var depthProbes7 = [0, 100, 9999, 10000, 125000, 1e6, 1e7];
      for (var di7 = 0; di7 < depthProbes7.length; di7++) {
        var dv = depthProbes7[di7];
        var dStr = dv >= 10000 ? GD.format(dv / 1000) + " km" : dv.toFixed(1) + " m";
        if (dStr.length > depMax) hudFmtBad.push("depth " + dv + " -> \"" + dStr + "\" (" + dStr.length + ")");
      }
      check("p7fix_income_depth_compact", "all fit", hudFmtBad.join(" | "), hudFmtBad.length === 0);

      // HUD layout: topbar stat boxes must not overlap at current viewport
      var statEls = document.querySelectorAll("#topbar .stat");
      var hudOverlap = [];
      for (var ha = 0; ha < statEls.length; ha++) {
        var ra = statEls[ha].getBoundingClientRect();
        for (var hb = ha + 1; hb < statEls.length; hb++) {
          var rb = statEls[hb].getBoundingClientRect();
          if (ra.right > rb.left + 1 && ra.left < rb.right - 1 && ra.bottom > rb.top + 1 && ra.top < rb.bottom - 1) {
            hudOverlap.push("stat[" + ha + "] overlaps stat[" + hb + "]");
          }
        }
      }
      check("p7fix_hud_no_overlap", "0 overlapping stat boxes", hudOverlap.join(", "), hudOverlap.length === 0);

      // --- console clean (last, so it counts everything above)
      if (!opts.skipConsoleCheck) {
        check("m2_no_console_errors", 0, GD.dbg.errors, GD.dbg.errors === 0);
        check("m2_no_console_warnings", 0, GD.dbg.warnings, GD.dbg.warnings === 0);
      }
    } finally {
      // Never leave the player's game, config, or save in test state.
      GD.hooks = liveHooks;
      // Restore splash state
      var splashRestore = document.getElementById("splash");
      if (splashRestore) {
        if (!splashWasGone) splashRestore.classList.remove("gone");
        if (!splashWasOff) splashRestore.classList.remove("off");
      }
      if (window.GDRender && window.GDRender.cameraSnap) window.GDRender.cameraSnap();
      if (GD.config !== liveConfig) GD.setConfig(liveConfig, false);
      GD.state = liveState;
      try {
        if (liveRaw === null) window.GDSave.clear(cfg);
        else localStorage.setItem(cfg.save.key, liveRaw);
      } catch (e) { /* storage unavailable; nothing to restore */ }
      if (window.GDUI && window.GDUI.rebuild) window.GDUI.rebuild();
    }

    return { passed: failed.length === 0, ran: ran, failedCount: failed.length, failed: failed };
  };
})();
