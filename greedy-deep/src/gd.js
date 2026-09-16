// Greedy Deep — window.GD facade (PRD 13). Click it! Studios, 2026.
// Always present. ?debug=1 adds the overlay and the mutators.
(function () {
  "use strict";

  var E = window.GDEngine;
  var GD = (window.GD = {
    version: "0.1.0-m1",
    config: null,
    state: null,
    ready: false,
    debug: /(\?|&)debug=1/.test(location.search),
    dbg: { t: 0, depth: 0, band: "-", gold: 0, goldRate: 0, digRate: 0, dwarves: 0, owned: {}, fps: 0, saveSize: 0, errors: 0, warnings: 0, lastError: "" }
  });

  // -------------------------------------------------- console error counter
  // The M1 check "zero console errors/warnings over 60 s" needs a number, not a vibe.
  (function hookConsole() {
    var ce = console.error.bind(console), cw = console.warn.bind(console);
    console.error = function () { GD.dbg.errors++; GD.dbg.lastError = String(arguments[0]); ce.apply(null, arguments); };
    console.warn = function () { GD.dbg.warnings++; cw.apply(null, arguments); };
    window.addEventListener("error", function (e) { GD.dbg.errors++; GD.dbg.lastError = e.message || "error"; });
    window.addEventListener("unhandledrejection", function (e) { GD.dbg.errors++; GD.dbg.lastError = "unhandled rejection"; });
  })();

  // -------------------------------------------------- lifecycle
  GD.init = function (cfg) {
    GD.config = cfg;
    var v = E.validateConfig(cfg);
    if (!v.ok) console.error("[GD] config invalid:", v.errors.join(" | "));
    var loaded = window.GDSave.read(cfg);
    GD.state = loaded || E.newState(cfg);
    GD.loadedFromSave = !!loaded;
    GD.ready = true;
    return GD.state;
  };

  GD.reset = function () {
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
      fresh.endingSeen = !!s.endingSeen;
    }
    GD.state = fresh;
    return E.snapshot(GD.config, GD.state);
  };

  GD.validateConfig = function () { return E.validateConfig(GD.config); };
  GD.snapshot = function () { return E.snapshot(GD.config, GD.state); };
  GD.derive = function () { return E.derive(GD.config, GD.state); };
  GD.costOf = function (id) { return E.costOf(GD.config, GD.state, id); };
  GD.format = function (n) { return E.format(GD.config, n); };

  // -------------------------------------------------- core API
  // Synchronous sim advance. Fixed sub-steps of sim.dt. No rAF, no DOM, no audio.
  GD.step = function (seconds) {
    E.advance(GD.config, GD.state, seconds);
    return E.snapshot(GD.config, GD.state);
  };

  GD.tap = function (times) {
    var g = E.tap(GD.config, GD.state, times);
    return g;
  };

  GD.buy = function (id) { return E.buy(GD.config, GD.state, id); };

  GD.save = function () {
    var d = window.GDSave.write(GD.config, GD.state);
    if (d) GD.dbg.saveSize = JSON.stringify(d).length;
    return d;
  };

  GD.refreshDbg = function (fps) {
    var d = E.derive(GD.config, GD.state);
    GD.dbg.t = GD.state.t;
    GD.dbg.depth = GD.state.depth;
    GD.dbg.band = d.band.id;
    GD.dbg.gold = GD.state.gold;
    GD.dbg.goldRate = d.goldRate;
    GD.dbg.digRate = d.digRate;
    GD.dbg.dwarves = d.dwarves;
    GD.dbg.owned = GD.state.owned;
    if (fps !== undefined) GD.dbg.fps = fps;
  };

  // -------------------------------------------------- debug mutators (?debug=1)
  GD.timeScale = 1;
  GD.paused = false;
  if (GD.debug) {
    GD.setGold = function (n) { GD.state.gold = n; return n; };
    GD.setDepth = function (n) { GD.state.depth = n; return n; };
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

  // -------------------------------------------------- selfTest (PRD 14, M1 block)
  function approx(a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps); }

  GD.selfTest = function () {
    var cfg = GD.config;
    var failed = [];
    var liveState = E.cloneState(GD.state);
    var liveRaw = window.GDSave.readRaw(cfg);

    function check(name, expected, actual, ok) {
      if (!ok) failed.push({ name: name, expected: expected, actual: actual });
    }

    try {
      // --- 1. reset(); step(0) -> gold 0, depth 0
      GD.reset();
      var s0 = GD.step(0);
      check("reset_zero_gold", cfg.start.gold, s0.gold, s0.gold === cfg.start.gold);
      check("reset_zero_depth", 0, s0.depth, s0.depth === 0);

      // --- 2. 10 synthetic taps = exactly 10 x goldPerTap, depth unchanged
      GD.reset();
      var gpt = GD.derive().goldPerTap;
      for (var i = 0; i < 10; i++) GD.tap(1);
      check("taps_pay_exact_gold", 10 * gpt, GD.state.gold, approx(GD.state.gold, 10 * gpt, 1e-9));
      check("taps_never_dig", 0, GD.state.depth, GD.state.depth === 0);
      check("taps_count_toward_lifetime", 10 * gpt, GD.state.goldEarnedTotal, approx(GD.state.goldEarnedTotal, 10 * gpt, 1e-9));

      // --- 3. step(600) with no purchases changes nothing (idle path is dwarves only)
      GD.reset();
      var beforeGold = GD.state.gold, beforeDepth = GD.state.depth;
      var s600 = GD.step(600);
      check("idle_no_gold_without_dwarves", beforeGold, s600.gold, s600.gold === beforeGold);
      check("idle_no_depth_without_dwarves", beforeDepth, s600.depth, s600.depth === beforeDepth);

      // --- 4. second purchase costs base x ratio
      var track = cfg.tracks[0];
      GD.reset();
      GD.state.gold = track.base * 100;
      var b1 = GD.buy(track.id);
      var cost2 = GD.costOf(track.id);
      check("first_purchase_cost_base", track.base, b1.cost, approx(b1.cost, track.base));
      check("second_purchase_cost_ratio", track.base * track.ratio, cost2, approx(cost2, track.base * track.ratio));

      // --- 5. insufficient gold refused, gold unchanged
      GD.reset();
      GD.state.gold = track.base - 0.01;
      var goldBefore = GD.state.gold;
      var refused = GD.buy(track.id);
      check("insufficient_refused", false, refused.ok, refused.ok === false);
      check("insufficient_gold_unchanged", goldBefore, GD.state.gold, GD.state.gold === goldBefore);
      check("insufficient_owned_unchanged", 0, GD.state.owned[track.id] || 0, (GD.state.owned[track.id] || 0) === 0);

      // --- 6. dwarves dig, and only dwarf-driven depth pays passive gold
      var dwarf = cfg.dwarves[0];
      GD.reset();
      GD.grantForTest(dwarf.id, 2);
      var d2 = GD.derive();
      var expRate = (cfg.start.digRate + dwarf.effects[0].value * 2);
      check("dwarf_digs", expRate, d2.digRate, approx(d2.digRate, expRate));
      GD.step(10);
      check("depth_advances_from_digrate", expRate * 10, GD.state.depth, approx(GD.state.depth, expRate * 10, 1e-6));

      // --- 7. live save exists and carries the PRD shape
      var raw = window.GDSave.readRaw(cfg);
      var parsed = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
      check("save_present", "an object at " + cfg.save.key, raw, !!parsed);
      var keys = ["version", "savedAt", "depth", "gold", "goldEarnedTotal", "owned", "prefs"];
      var missing = [];
      if (parsed) for (var k = 0; k < keys.length; k++) if (!(keys[k] in parsed)) missing.push(keys[k]);
      check("save_shape", "no missing keys", missing.join(","), parsed && missing.length === 0);

      // --- 8. save -> read restores depth within 1 m and gold within 1 g
      GD.reset();
      GD.state.depth = 123.456;
      GD.state.gold = 4567.89;
      GD.state.goldEarnedTotal = 9999;
      GD.grantForTest(track.id, 3);
      GD.grantForTest(dwarf.id, 2);
      window.GDSave.write(cfg, GD.state);
      var restored = window.GDSave.read(cfg);
      check("reload_restores_depth", 123.456, restored && restored.depth, !!restored && Math.abs(restored.depth - 123.456) < 1);
      check("reload_restores_gold", 4567.89, restored && restored.gold, !!restored && Math.abs(restored.gold - 4567.89) < 1);
      check("reload_restores_owned", "3/2", restored && (restored.owned[track.id] + "/" + restored.owned[dwarf.id]),
        !!restored && restored.owned[track.id] === 3 && restored.owned[dwarf.id] === 2);

      // --- 9 + 10. step(3600) timing and additivity
      var seedOwned = {};
      seedOwned[track.id] = 3;
      seedOwned[dwarf.id] = 5;
      if (cfg.tracks[1]) seedOwned[cfg.tracks[1].id] = 2;

      GD.setState({ owned: seedOwned });
      var t0 = (performance && performance.now) ? performance.now() : Date.now();
      var big = GD.step(3600);
      var ms = ((performance && performance.now) ? performance.now() : Date.now()) - t0;
      check("step_3600_under_500ms", "< 500 ms", Math.round(ms) + " ms", ms < 500);

      GD.setState({ owned: seedOwned });
      for (var j = 0; j < 3600; j++) GD.step(1);
      var many = GD.snapshot();
      check("step_additive_gold", big.gold, many.gold, approx(big.gold, many.gold, 1e-6));
      check("step_additive_depth", big.depth, many.depth, approx(big.depth, many.depth, 1e-6));
      check("step_additive_total", big.goldEarnedTotal, many.goldEarnedTotal, approx(big.goldEarnedTotal, many.goldEarnedTotal, 1e-6));

      // --- 10b. clearSave leaves nothing to resurrect (critic M1, MAJOR)
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
      check("clear_save_key_absent_or_fresh", "absent or fresh state", afterClear, freshAfterClear);
      check("clear_save_resets_live_state", "gold 0, no owned", GD.state.gold + "/" + JSON.stringify(GD.state.owned),
        GD.state.gold === 0 && Object.keys(GD.state.owned).length === 0);

      // --- 11. config validates
      var v = GD.validateConfig();
      check("config_valid", "ok", v.errors.join(" | "), v.ok);

      // --- 12. snapshot carries the PRD 13 fields
      var snapKeys = ["t", "depth", "gold", "goldEarnedTotal", "goldRate", "digRate", "band", "owned", "dwarves", "eventsFired"];
      var snapMissing = [];
      for (var q = 0; q < snapKeys.length; q++) if (!(snapKeys[q] in big)) snapMissing.push(snapKeys[q]);
      check("snapshot_shape", "no missing keys", snapMissing.join(","), snapMissing.length === 0);

      // --- 13. console clean
      check("no_console_errors", 0, GD.dbg.errors, GD.dbg.errors === 0);
      check("no_console_warnings", 0, GD.dbg.warnings, GD.dbg.warnings === 0);
    } finally {
      // Never leave the player's game or save in test state.
      GD.state = liveState;
      try {
        if (liveRaw === null) window.GDSave.clear(cfg);
        else localStorage.setItem(cfg.save.key, liveRaw);
      } catch (e) { /* storage unavailable; nothing to restore */ }
      if (window.GDUI && window.GDUI.refresh) window.GDUI.refresh();
    }

    return { passed: failed.length === 0, failed: failed };
  };

  // Internal grant used by selfTest so the tests work with or without ?debug=1.
  GD.grantForTest = function (id, n) {
    GD.state.owned[id] = (GD.state.owned[id] || 0) + (n === undefined ? 1 : n);
    return GD.state.owned[id];
  };
})();
