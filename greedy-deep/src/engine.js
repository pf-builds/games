// Greedy Deep — engine. Click it! Studios, 2026.
// Pure simulation: fixed-dt tick, purchase engine, effects registry, bands.
// No DOM, no rAF, no audio, no numbers. Every tunable comes from config/greedy-deep.json.
(function () {
  "use strict";

  var E = (window.GDEngine = {});

  // ------------------------------------------------------------ effects
  // Each handler is pure: it folds one purchasable's effect into the accumulator.
  // `n` is the owned count for that purchasable.
  var EFFECTS = {
    add_click: function (acc, v, n) { acc.clickAdd += v * n; },
    add_rate:  function (acc, v, n) { acc.rateAdd += v * n; },
    mul_rate:  function (acc, v, n) { acc.rateMul *= Math.pow(v, n); },
    mul_gold:  function (acc, v, n) { acc.goldMul *= Math.pow(v, n); }
  };
  // Verbs reserved by the PRD but not yet implemented (M2+). validateConfig knows them
  // so a future JSON entry fails loud rather than silently doing nothing.
  var FUTURE_VERBS = [
    "add_rate_per_dwarf", "reveal_bands", "mul_hazard_resist", "add_offline_hours",
    "mul_offline_rate", "mul_rate_temp", "mul_gold_temp", "add_depth"
  ];
  var PATTERNS = ["speckle", "vein", "crystal", "flat"];

  E.EFFECTS = EFFECTS;
  E.FUTURE_VERBS = FUTURE_VERBS;

  // ------------------------------------------------------------ state
  E.newState = function (cfg) {
    return {
      t: 0,
      depth: 0,
      gold: cfg.start.gold,
      goldEarnedTotal: 0,
      owned: {},
      endingSeen: false,
      prefs: { muted: false }
    };
  };

  E.cloneState = function (s) { return JSON.parse(JSON.stringify(s)); };

  // ------------------------------------------------------------ catalog
  E.purchasables = function (cfg) { return cfg.tracks.concat(cfg.dwarves); };

  E.byId = function (cfg, id) {
    var list = E.purchasables(cfg);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  E.ownedOf = function (state, id) { return state.owned[id] || 0; };

  // cost = base x ratio^owned — one formula for tracks and dwarves alike.
  E.costOf = function (cfg, state, id) {
    var p = E.byId(cfg, id);
    if (!p) return Infinity;
    return p.base * Math.pow(p.ratio, E.ownedOf(state, id));
  };

  E.bandAt = function (cfg, depth) {
    var b = cfg.ores[0];
    for (var i = 0; i < cfg.ores.length; i++) if (depth >= cfg.ores[i].startDepth) b = cfg.ores[i];
    return b;
  };

  // ------------------------------------------------------------ derived stats
  E.derive = function (cfg, state) {
    var acc = { clickAdd: 0, rateAdd: 0, rateMul: 1, goldMul: 1 };
    var list = E.purchasables(cfg);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var n = E.ownedOf(state, p.id);
      if (!n) continue;
      var efs = p.effects || [];
      for (var j = 0; j < efs.length; j++) {
        var h = EFFECTS[efs[j].verb];
        if (h) h(acc, efs[j].value, n);
      }
    }
    var band = E.bandAt(cfg, state.depth);
    var clickPower = cfg.start.clickPower + acc.clickAdd;
    // Depth comes only from digRate. Taps never dig (PRD 8).
    var digRate = (cfg.start.digRate + acc.rateAdd) * acc.rateMul;
    var goldRate = digRate * band.goldPerMeter * acc.goldMul;
    var goldPerTap = clickPower * band.goldPerMeter * cfg.start.clickYield;
    var dwarves = 0;
    for (var k = 0; k < cfg.dwarves.length; k++) dwarves += E.ownedOf(state, cfg.dwarves[k].id);
    return {
      clickPower: clickPower, digRate: digRate, goldRate: goldRate, goldPerTap: goldPerTap,
      goldMul: acc.goldMul, rateMul: acc.rateMul, band: band, dwarves: dwarves
    };
  };

  // ------------------------------------------------------------ tick
  E.substep = function (cfg, state, dt) {
    var d = E.derive(cfg, state);
    state.depth += d.digRate * dt;
    var g = d.goldRate * dt;
    state.gold += g;
    state.goldEarnedTotal += g;
    state.t += dt;
  };

  // Advance `seconds` in fixed sub-steps of sim.dt so step(3600) === 3600 x step(1).
  E.advance = function (cfg, state, seconds) {
    if (!(seconds > 0)) return;
    var dt = cfg.sim.dt;
    var raw = seconds / dt;
    var n = Math.round(raw);
    if (Math.abs(raw - n) < 1e-6) {
      for (var i = 0; i < n; i++) E.substep(cfg, state, dt);
      return;
    }
    n = Math.floor(raw);
    for (var j = 0; j < n; j++) E.substep(cfg, state, dt);
    var rem = seconds - n * dt;
    if (rem > 1e-9) E.substep(cfg, state, rem);
  };

  // ------------------------------------------------------------ actions
  E.tap = function (cfg, state, times) {
    var d = E.derive(cfg, state);
    var g = d.goldPerTap * (times === undefined ? 1 : times);
    state.gold += g;
    state.goldEarnedTotal += g;
    return g;
  };

  E.buy = function (cfg, state, id) {
    var p = E.byId(cfg, id);
    if (!p) return { ok: false, reason: "unknown-id", id: id };
    var cost = E.costOf(cfg, state, id);
    if (state.gold < cost - 1e-9) return { ok: false, reason: "insufficient", cost: cost };
    state.gold -= cost;
    state.owned[id] = E.ownedOf(state, id) + 1;
    return { ok: true, cost: cost, owned: state.owned[id] };
  };

  // ------------------------------------------------------------ snapshot
  E.snapshot = function (cfg, state) {
    var d = E.derive(cfg, state);
    return {
      t: state.t,
      depth: state.depth,
      gold: state.gold,
      goldEarnedTotal: state.goldEarnedTotal,
      goldRate: d.goldRate,
      digRate: d.digRate,
      band: d.band.id,
      owned: JSON.parse(JSON.stringify(state.owned)),
      dwarves: d.dwarves,
      eventsFired: 0
    };
  };

  // ------------------------------------------------------------ validation
  E.validateConfig = function (cfg) {
    var errors = [];
    var need = ["start", "sim", "format", "ores", "tracks", "dwarves", "save", "layout"];
    for (var i = 0; i < need.length; i++) if (!cfg[need[i]]) errors.push("missing block: " + need[i]);
    if (errors.length) return { ok: false, errors: errors };

    if (!(cfg.sim.dt > 0)) errors.push("sim.dt must be > 0");
    if (!cfg.ores.length) errors.push("ores is empty");

    var seen = {};
    var all = E.purchasables(cfg).concat(cfg.ores);
    for (var j = 0; j < all.length; j++) {
      var id = all[j].id;
      if (!id) { errors.push("entry with no id"); continue; }
      if (seen[id]) errors.push("duplicate id: " + id);
      seen[id] = true;
    }

    var prev = -Infinity;
    for (var k = 0; k < cfg.ores.length; k++) {
      var o = cfg.ores[k];
      if (!(o.startDepth > prev) && k > 0) errors.push("non-monotonic startDepth at ore " + o.id);
      if (k === 0 && o.startDepth !== 0) errors.push("first ore must start at depth 0");
      prev = o.startDepth;
      if (PATTERNS.indexOf(o.pattern) === -1) errors.push("unknown pattern '" + o.pattern + "' on ore " + o.id);
      if (!(o.goldPerMeter > 0)) errors.push("ore " + o.id + " needs goldPerMeter > 0");
    }

    var buyables = E.purchasables(cfg);
    for (var m = 0; m < buyables.length; m++) {
      var p = buyables[m];
      if (!(p.base > 0)) errors.push(p.id + ": base must be > 0");
      if (!(p.ratio > 1)) errors.push(p.id + ": ratio must be > 1");
      if (!Array.isArray(p.effects) || !p.effects.length) { errors.push(p.id + ": effects must be a non-empty array"); continue; }
      for (var n = 0; n < p.effects.length; n++) {
        var verb = p.effects[n].verb;
        if (!EFFECTS[verb] && FUTURE_VERBS.indexOf(verb) === -1) errors.push(p.id + ": unknown effect verb '" + verb + "'");
        else if (!EFFECTS[verb]) errors.push(p.id + ": verb '" + verb + "' is reserved for a later milestone and has no handler yet");
        if (typeof p.effects[n].value !== "number") errors.push(p.id + ": effect value must be a number");
      }
    }

    if (!(cfg.format.activeSuffixes >= 1)) errors.push("format.activeSuffixes must be >= 1");
    if (cfg.format.activeSuffixes > cfg.format.suffixes.length) errors.push("format.activeSuffixes exceeds suffixes list");

    return { ok: errors.length === 0, errors: errors };
  };

  // ------------------------------------------------------------ number format
  E.format = function (cfg, n) {
    var f = cfg.format;
    if (!isFinite(n)) return "—";
    var neg = n < 0;
    var v = Math.abs(n);
    var tier = 0;
    var maxTier = Math.min(f.activeSuffixes, f.suffixes.length - 1);
    while (v >= 1000 && tier < maxTier) { v /= 1000; tier++; }
    var out;
    if (v >= 100) out = String(Math.round(v));
    else if (v >= 10) out = v.toFixed(Math.max(0, f.sigFigs - 2));
    else out = v.toFixed(Math.max(0, f.sigFigs - 1));
    if (out.indexOf(".") !== -1) out = out.replace(/\.?0+$/, "");
    return (neg ? "-" : "") + out + f.suffixes[tier];
  };
})();
