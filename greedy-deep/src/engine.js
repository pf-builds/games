// Greedy Deep — engine. Click it! Studios, 2026.
// Pure simulation: fixed-dt tick, purchase engine, effects registry, bands, events,
// offline resolver, milestone, and the headless `simulate` harness.
// No DOM, no rAF, no audio, no numbers. Every tunable comes from config/greedy-deep.json.
(function (root) {
  "use strict";

  var E = (root.GDEngine = {});

  // ------------------------------------------------------------ effects registry
  // The full v1 verb vocabulary (PRD 8). Every handler is pure: it folds one
  // purchasable's (or event's) effect into the accumulator. `n` is the owned count.
  // Nothing in here reads or writes game state directly.
  var EFFECTS = {
    add_click:          function (acc, v, n) { acc.clickAdd += v * n; },
    add_rate:           function (acc, v, n) { acc.rateAdd += v * n; },
    mul_rate:           function (acc, v, n) { acc.rateMul *= Math.pow(v, n); },
    mul_gold:           function (acc, v, n) { acc.goldMul *= Math.pow(v, n); },
    add_rate_per_dwarf: function (acc, v, n) { acc.ratePerDwarf += v * n; },
    reveal_bands:       function (acc, v, n) { acc.revealBonus += v * n; },
    mul_hazard_resist:  function (acc, v, n) { acc.hazardMul *= Math.pow(v, n); },
    add_offline_hours:  function (acc, v, n) { acc.offlineHours += v * n; },
    mul_offline_rate:   function (acc, v, n) { acc.offlineRateMul *= Math.pow(v, n); },
    mul_rate_temp:      function (acc, v, n) { acc.rateMul *= Math.pow(v, n); },
    mul_gold_temp:      function (acc, v, n) { acc.goldMul *= Math.pow(v, n); },
    add_depth:          function (acc, v, n) { acc.depthAdd += v * n; }
  };
  // Verbs whose only meaning is instantaneous: they never survive into a derived
  // stat block, they are applied once at the moment the effect fires.
  var INSTANT_VERBS = { add_depth: true };
  var PATTERNS = ["speckle", "vein", "crystal", "flat"];
  var SCORE_FORMULAS = {
    gold_plus_depth: function (cfg, state) { return state.goldEarnedTotal + state.depth * 100; }
  };

  E.EFFECTS = EFFECTS;
  E.INSTANT_VERBS = INSTANT_VERBS;
  E.PATTERNS = PATTERNS;
  E.SCORE_FORMULAS = SCORE_FORMULAS;
  E.VERBS = Object.keys(EFFECTS);

  function newAcc() {
    return {
      clickAdd: 0, rateAdd: 0, rateMul: 1, goldMul: 1, ratePerDwarf: 0,
      revealBonus: 0, hazardMul: 1, offlineHours: 0, offlineRateMul: 1, depthAdd: 0
    };
  }
  E.newAcc = newAcc;

  // ------------------------------------------------------------ rng (seedable)
  // mulberry32: small, deterministic, good enough for weighted event rolls.
  E.makeRng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  E.rng = E.makeRng(0x9E3779B9);
  E.setSeed = function (n) { E.rng = E.makeRng(n); return n; };

  // ------------------------------------------------------------ state
  E.newState = function (cfg) {
    return {
      t: 0,
      depth: 0,
      gold: cfg.start.gold,
      goldEarnedTotal: 0,
      owned: {},
      endingSeen: false,
      endingScore: 0,
      endingAtSeconds: 0,
      timed: [],
      eventT: 0,
      eventsFired: 0,
      bandId: cfg.ores[0].id,
      lastEvent: "",
      prefs: { muted: false }
    };
  };

  E.cloneState = function (s) { return JSON.parse(JSON.stringify(s)); };

  // ------------------------------------------------------------ catalog (cached)
  // derive() runs once per sub-step, so the catalog and the id index are built once
  // per config object and hung off it rather than rebuilt 36,000 times a minute.
  function hide(obj, key, value) {
    // non-enumerable so a JSON.stringify of the config never picks the cache up
    Object.defineProperty(obj, key, { value: value, enumerable: false, writable: true, configurable: true });
    return value;
  }
  function cat(cfg) {
    if (!cfg.__cat) {
      var list = cfg.tracks.concat(cfg.dwarves);
      var index = {};
      for (var i = 0; i < list.length; i++) index[list[i].id] = list[i];
      var isDwarf = {};
      for (var j = 0; j < cfg.dwarves.length; j++) isDwarf[cfg.dwarves[j].id] = true;
      hide(cfg, "__cat", list); hide(cfg, "__index", index); hide(cfg, "__isDwarf", isDwarf);
    }
    return cfg.__cat;
  }
  E.purchasables = function (cfg) { return cat(cfg); };
  E.isDwarf = function (cfg, id) { cat(cfg); return !!cfg.__isDwarf[id]; };
  E.byId = function (cfg, id) { cat(cfg); return cfg.__index[id] || null; };
  E.ownedOf = function (state, id) { return state.owned[id] || 0; };

  // cost = base x ratio^owned — one formula for tracks and dwarves alike (PRD 8).
  E.costOf = function (cfg, state, id) {
    var p = E.byId(cfg, id);
    if (!p) return Infinity;
    return p.base * Math.pow(p.ratio, E.ownedOf(state, id));
  };

  // ------------------------------------------------------------ bands
  // Bands 0..n-1 come straight from `ores`. Past the last one, `endless` repeats the
  // deepest band every bandLengthM with goldPerMeter x multiplierPerBand per repeat
  // (PRD 11). Repeat bands are cached so bandAt() never allocates in the hot path.
  function endlessStart(cfg) {
    var last = cfg.ores[cfg.ores.length - 1];
    if (!cfg.endless || !(cfg.endless.bandLengthM > 0)) return Infinity;
    return last.startDepth + cfg.endless.bandLengthM;
  }
  E.endlessStart = endlessStart;

  function endlessBand(cfg, rep) {
    if (!cfg.__endless) hide(cfg, "__endless", {});
    if (cfg.__endless[rep]) return cfg.__endless[rep];
    var ores = cfg.ores, last = ores[ores.length - 1], en = cfg.endless;
    var start = endlessStart(cfg) + (rep - 1) * en.bandLengthM;
    var b = {
      id: last.id + "+" + rep,
      baseId: last.id,
      name: last.name + " " + (rep + 1),
      startDepth: start,
      goldPerMeter: last.goldPerMeter * Math.pow(en.multiplierPerBand, rep),
      pattern: last.pattern,
      intro: (cfg.flavor && cfg.flavor.bandIntro && cfg.flavor.bandIntro.endless) || last.intro,
      color: last.color, wallColor: last.wallColor, veinColor: last.veinColor, glintColor: last.glintColor,
      index: ores.length - 1 + rep,
      endless: true, repeat: rep
    };
    cfg.__endless[rep] = b;
    return b;
  }

  E.bandAt = function (cfg, depth) {
    var ores = cfg.ores;
    var es = endlessStart(cfg);
    if (depth >= es) return endlessBand(cfg, Math.floor((depth - es) / cfg.endless.bandLengthM) + 1);
    var bi = 0;
    for (var i = 0; i < ores.length; i++) if (depth >= ores[i].startDepth) bi = i;
    var b = ores[bi];
    if (b.index === undefined) hide(b, "index", bi);
    return b;
  };

  E.bandByIndex = function (cfg, i) {
    if (i < 0) return null;
    var ores = cfg.ores;
    if (i < ores.length) { if (ores[i].index === undefined) hide(ores[i], "index", i); return ores[i]; }
    if (!cfg.endless || !(cfg.endless.bandLengthM > 0)) return null;
    return endlessBand(cfg, i - (ores.length - 1));
  };

  // ------------------------------------------------------------ derived stats
  E.derive = function (cfg, state) {
    var acc = newAcc();
    var list = cat(cfg);
    var i, j, n, efs, h;

    // Dwarf headcount first: add_rate_per_dwarf needs it after the fold.
    var dwarves = 0;
    for (i = 0; i < cfg.dwarves.length; i++) dwarves += state.owned[cfg.dwarves[i].id] || 0;

    for (i = 0; i < list.length; i++) {
      n = state.owned[list[i].id] || 0;
      if (!n) continue;
      efs = list[i].effects;
      for (j = 0; j < efs.length; j++) {
        h = EFFECTS[efs[j].verb];
        if (h && !INSTANT_VERBS[efs[j].verb]) h(acc, efs[j].value, n);
      }
    }

    // Timed effects from events (mul_rate_temp / mul_gold_temp) expire on sim time.
    var tl = state.timed;
    if (tl && tl.length) {
      for (i = 0; i < tl.length; i++) {
        if (tl[i].until <= state.t) continue;
        h = EFFECTS[tl[i].verb];
        if (h && !INSTANT_VERBS[tl[i].verb]) h(acc, tl[i].value, 1);
      }
    }

    acc.rateAdd += acc.ratePerDwarf * dwarves;

    var band = E.bandAt(cfg, state.depth);
    var clickPower = cfg.start.clickPower + acc.clickAdd;
    // Depth comes only from digRate. Taps never dig (PRD 8).
    var digRate = (cfg.start.digRate + acc.rateAdd) * acc.rateMul;
    var goldRate = digRate * band.goldPerMeter * acc.goldMul;
    var goldPerTap = clickPower * band.goldPerMeter * cfg.start.clickYield;

    return {
      clickPower: clickPower, digRate: digRate, goldRate: goldRate, goldPerTap: goldPerTap,
      goldMul: acc.goldMul, rateMul: acc.rateMul, band: band, dwarves: dwarves,
      revealBonus: acc.revealBonus, hazardMul: acc.hazardMul,
      offlineHours: acc.offlineHours, offlineRateMul: acc.offlineRateMul
    };
  };

  // ------------------------------------------------------------ events
  // One roll every intervalSeconds at `chance`, weighted, minDepth gated, hazard
  // weights scaled by mul_hazard_resist, never offline (PRD 10).
  E.eligibleEvents = function (cfg, state, derived) {
    var out = [], total = 0;
    if (!cfg.events) return { list: out, total: 0 };
    for (var i = 0; i < cfg.events.length; i++) {
      var e = cfg.events[i];
      if (state.depth < (e.minDepth || 0)) continue;
      var w = e.weight * (e.hazard ? derived.hazardMul : 1);
      if (!(w > 0)) continue;
      out.push({ e: e, w: w });
      total += w;
    }
    return { list: out, total: total };
  };

  E.applyEvent = function (cfg, state, e, ctx) {
    var acc = newAcc();
    for (var i = 0; i < e.effects.length; i++) {
      var ef = e.effects[i];
      if (ef.seconds > 0) {
        state.timed.push({ verb: ef.verb, value: ef.value, until: state.t + ef.seconds, id: e.id });
      } else {
        var h = EFFECTS[ef.verb];
        if (h) h(acc, ef.value, 1);
      }
    }
    if (acc.depthAdd) state.depth = Math.max(0, state.depth + acc.depthAdd);
    state.eventsFired++;
    state.lastEvent = e.id;
    if (ctx && ctx.onEvent) ctx.onEvent(e, state);
    return e;
  };

  E.tickEvents = function (cfg, state, dt, derived, ctx) {
    var r = cfg.eventRules;
    if (!r || !cfg.events || !cfg.events.length) return;
    state.eventT += dt;
    var guard = 0;
    while (state.eventT >= r.intervalSeconds && guard++ < 64) {
      state.eventT -= r.intervalSeconds;
      var rng = (ctx && ctx.rng) || E.rng;
      if (rng() >= r.chance) continue;
      var pool = E.eligibleEvents(cfg, state, derived);
      if (!pool.total) continue;
      var roll = rng() * pool.total, acc = 0, picked = pool.list[pool.list.length - 1].e;
      for (var i = 0; i < pool.list.length; i++) {
        acc += pool.list[i].w;
        if (roll < acc) { picked = pool.list[i].e; break; }
      }
      E.applyEvent(cfg, state, picked, ctx);
    }
  };

  // ------------------------------------------------------------ milestone
  E.score = function (cfg, state) {
    var f = SCORE_FORMULAS[cfg.milestone && cfg.milestone.scoreFormulaId];
    return f ? f(cfg, state) : 0;
  };

  E.checkMilestone = function (cfg, state, ctx) {
    var m = cfg.milestone;
    if (!m || state.endingSeen || state.depth < m.depth) return false;
    state.endingSeen = true;
    state.endingScore = E.score(cfg, state);
    state.endingAtSeconds = state.t;
    if (ctx && ctx.onEnding) ctx.onEnding(state, m);
    return true;
  };

  // ------------------------------------------------------------ tick
  E.substep = function (cfg, state, dt, ctx) {
    var d = E.derive(cfg, state);
    state.depth += d.digRate * dt;
    var g = d.goldRate * dt;
    state.gold += g;
    state.goldEarnedTotal += g;
    state.t += dt;

    // prune expired timed effects (derive already ignores them; this keeps the array small)
    var tl = state.timed;
    if (tl.length) {
      for (var i = tl.length - 1; i >= 0; i--) if (tl[i].until <= state.t) tl.splice(i, 1);
    }

    E.tickEvents(cfg, state, dt, d, ctx);

    var nb = E.bandAt(cfg, state.depth);
    if (nb.id !== state.bandId) {
      var prev = state.bandId;
      state.bandId = nb.id;
      if (ctx && ctx.onBand) ctx.onBand(nb, prev, state);
    }

    E.checkMilestone(cfg, state, ctx);
  };

  // Advance `seconds` in fixed sub-steps of sim.dt so step(3600) === 3600 x step(1).
  E.advance = function (cfg, state, seconds, ctx) {
    if (!(seconds > 0)) return;
    var dt = cfg.sim.dt;
    var raw = seconds / dt;
    var n = Math.round(raw);
    if (Math.abs(raw - n) < 1e-6) {
      for (var i = 0; i < n; i++) E.substep(cfg, state, dt, ctx);
      return;
    }
    n = Math.floor(raw);
    for (var j = 0; j < n; j++) E.substep(cfg, state, dt, ctx);
    var rem = seconds - n * dt;
    if (rem > 1e-9) E.substep(cfg, state, rem, ctx);
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
    return { ok: true, cost: cost, owned: state.owned[id], id: id };
  };

  // ------------------------------------------------------------ offline (PRD 9)
  // Pure function of elapsed ms and a state snapshot. No mutation, no clock reads.
  E.offlinePreview = function (cfg, state, elapsedMs) {
    var o = cfg.offline;
    var seconds = elapsedMs / 1000;
    var out = { seconds: seconds, cappedSeconds: 0, gold: 0, depth: 0, reason: "ok" };
    if (!(seconds > 0)) { out.seconds = 0; out.reason = "skew"; return out; }
    if (seconds > o.maxClockSkewHours * 3600) { out.seconds = 0; out.reason = "skew"; return out; }
    if (seconds < o.minSeconds) { out.reason = "below-min"; return out; }

    var d = E.derive(cfg, state);
    var capSeconds = (o.capHours + d.offlineHours) * 3600;
    out.cappedSeconds = Math.min(seconds, capSeconds);
    if (out.cappedSeconds < seconds) out.reason = "capped";
    var rate = o.ratePercent * d.offlineRateMul;
    // Entry band's rate, flat: no mid-offline band change (PRD 9, 16).
    out.gold = d.goldRate * out.cappedSeconds * rate;
    out.depth = o.advanceDepth ? d.digRate * out.cappedSeconds * rate : 0;
    return out;
  };

  E.applyOffline = function (cfg, state, elapsedMs, ctx) {
    var p = E.offlinePreview(cfg, state, elapsedMs);
    if (p.gold > 0) { state.gold += p.gold; state.goldEarnedTotal += p.gold; }
    if (p.depth > 0) {
      state.depth += p.depth;
      var nb = E.bandAt(cfg, state.depth);
      if (nb.id !== state.bandId) state.bandId = nb.id;
      E.checkMilestone(cfg, state, ctx);
    }
    return p;
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
      eventsFired: state.eventsFired
    };
  };

  // ------------------------------------------------------------ purchase policies
  function cheapestAffordable(cfg, state) {
    var list = cat(cfg), best = null, bestCost = Infinity;
    for (var i = 0; i < list.length; i++) {
      var c = E.costOf(cfg, state, list[i].id);
      if (c <= state.gold + 1e-9 && c < bestCost) { best = list[i]; bestCost = c; }
    }
    return best;
  }

  // Diagnostic policy: buy the affordable row with the best marginal score per gold.
  // Depth is the binding constraint on the ending, so digRate is weighted heavily.
  function ratioPick(cfg, state) {
    var list = cat(cfg);
    var base = E.derive(cfg, state);
    var baseScore = base.digRate * 1000 + base.goldRate;
    var best = null, bestVal = 0;
    var probe = { t: state.t, depth: state.depth, gold: 0, goldEarnedTotal: 0, owned: null, timed: state.timed };
    for (var i = 0; i < list.length; i++) {
      var id = list[i].id;
      var c = E.costOf(cfg, state, id);
      if (c > state.gold + 1e-9) continue;
      probe.owned = state.owned;
      var saved = state.owned[id] || 0;
      state.owned[id] = saved + 1;
      var d = E.derive(cfg, state);
      state.owned[id] = saved;
      var val = (d.digRate * 1000 + d.goldRate - baseScore) / c;
      if (val > bestVal) { bestVal = val; best = list[i]; }
    }
    return best;
  }

  E.POLICIES = {
    "cheapest-affordable": cheapestAffordable,
    "none": function () { return null; },
    "ratio": ratioPick
  };

  // ------------------------------------------------------------ simulate (PRD 13)
  E.simulate = function (cfg, opts) {
    opts = opts || {};
    var maxSeconds = opts.maxSeconds === undefined ? cfg.sim.maxSeconds : opts.maxSeconds;
    var dt = opts.dt === undefined ? cfg.sim.simulateDt : opts.dt;
    var policyName = opts.policy === undefined ? cfg.sim.policy : opts.policy;
    var pick = E.POLICIES[policyName];
    if (!pick) return { error: "unknown policy: " + policyName };
    var untilDepth = opts.untilDepth === undefined ? (cfg.milestone ? cfg.milestone.depth : Infinity) : opts.untilDepth;
    var cps = opts.clicksPerSecond === undefined ? cfg.sim.clicksPerSecond : opts.clicksPerSecond;
    var sampleEvery = opts.sampleSeconds === undefined ? (cfg.sim.sampleSeconds || 60) : opts.sampleSeconds;

    var state = opts.state ? E.cloneState(opts.state) : E.newState(cfg);
    var purchases = [], bandLog = [], samples = [], events = 0;
    var ctx = {
      rng: E.makeRng(opts.seed === undefined ? 1337 : opts.seed),
      onEvent: function () { events++; },
      onBand: null
    };

    var reached = false, reachedAtSeconds = null;
    var lastPurchaseT = 0, maxGap = 0;
    var nextSample = 0;
    var startBand = E.bandAt(cfg, state.depth);
    bandLog.push({ band: startBand.id, index: startBand.index, depth: state.depth, t: 0, goldRateBefore: 0, goldRateAfter: 0, stepRatio: 1, goldPerMeter: startBand.goldPerMeter });

    ctx.onBand = function (nb, prevId, st) {
      var prev = bandLog[bandLog.length - 1];
      var before = prev.goldPerMeter, after = nb.goldPerMeter;
      // income step is measured at the boundary: goldRate is digRate x gpm x goldMul, and
      // digRate/goldMul are continuous across a boundary, so the step IS the gpm ratio.
      var d = E.derive(cfg, st);
      bandLog.push({
        band: nb.id, index: nb.index, depth: st.depth, t: st.t,
        goldPerMeter: after,
        goldRateBefore: d.digRate * before * d.goldMul,
        goldRateAfter: d.goldRate,
        stepRatio: after / before
      });
    };

    var guard = 0;
    for (var t = 0; t < maxSeconds; t += dt) {
      if (guard++ > 10000000) break;

      if (cps > 0) E.tap(cfg, state, cps * dt);

      var bought = 0;
      while (bought < 400) {
        var p = pick(cfg, state);
        if (!p) break;
        var r = E.buy(cfg, state, p.id);
        if (!r.ok) break;
        purchases.push({ t: state.t, id: r.id, cost: r.cost, owned: r.owned });
        var gap = state.t - lastPurchaseT;
        if (gap > maxGap) maxGap = gap;
        lastPurchaseT = state.t;
        bought++;
      }

      E.substep(cfg, state, dt, ctx);

      if (state.t >= nextSample) {
        var d2 = E.derive(cfg, state);
        samples.push({
          t: Math.round(state.t), depth: +state.depth.toFixed(2), gold: state.gold,
          goldRate: d2.goldRate, digRate: d2.digRate, band: d2.band.id,
          purchases: purchases.length
        });
        nextSample += sampleEvery;
      }

      if (!reached && state.depth >= untilDepth) {
        reached = true;
        reachedAtSeconds = state.t;
        if (!opts.continueAfterTarget) break;
      }
    }

    // gap from the last purchase to the end of the measured run
    var endT = reachedAtSeconds === null ? state.t : reachedAtSeconds;
    if (endT - lastPurchaseT > maxGap) maxGap = endT - lastPurchaseT;

    var first600 = 0;
    for (var i = 0; i < purchases.length; i++) if (purchases[i].t <= 600) first600++;

    return {
      reached: reached,
      reachedAtSeconds: reachedAtSeconds,
      finalDepth: state.depth,
      finalGold: state.gold,
      goldEarnedTotal: state.goldEarnedTotal,
      purchases: purchases,
      purchaseCount: purchases.length,
      purchasesFirst600: first600,
      bandLog: bandLog,
      maxGapSeconds: maxGap,
      eventsFired: events,
      samples: samples,
      policy: policyName,
      dt: dt,
      owned: JSON.parse(JSON.stringify(state.owned))
    };
  };

  // ------------------------------------------------------------ flavor
  E.flavorTodoCount = function (cfg) {
    var n = 0;
    function walk(v) {
      if (typeof v === "string") { if (v.indexOf("FLAVOR-TODO:") === 0) n++; return; }
      if (!v || typeof v !== "object") return;
      for (var k in v) { if (k.indexOf("__") === 0) continue; walk(v[k]); }
    }
    walk(cfg.flavor);
    walk(cfg.dwarves);
    walk(cfg.tracks);
    walk(cfg.ores);
    walk(cfg.events);
    walk(cfg.milestone);
    return n;
  };

  E.dwarfLine = function (cfg, id) {
    var f = cfg.flavor && cfg.flavor.dwarfLines && cfg.flavor.dwarfLines[id];
    if (f) return f;
    var d = E.byId(cfg, id);
    return (d && d.flavor) || "";
  };

  E.bandIntro = function (cfg, band) {
    var f = cfg.flavor && cfg.flavor.bandIntro;
    if (!f) return band.intro || "";
    if (band.endless) return f.endless || band.intro || "";
    return f[band.id] || band.intro || "";
  };

  E.eventText = function (cfg, e) {
    var f = cfg.flavor && cfg.flavor.eventTexts;
    return (f && f[e.id]) || e.text || e.name || e.id;
  };

  // ------------------------------------------------------------ validation
  E.validateConfig = function (cfg) {
    var errors = [];
    var need = ["start", "sim", "format", "ores", "tracks", "dwarves", "save", "layout",
                "events", "eventRules", "offline", "milestone", "endless", "flavor"];
    for (var i = 0; i < need.length; i++) if (!cfg[need[i]]) errors.push("missing block: " + need[i]);
    if (errors.length) return { ok: false, errors: errors };

    if (!(cfg.sim.dt > 0)) errors.push("sim.dt must be > 0");
    if (!E.POLICIES[cfg.sim.policy]) errors.push("sim.policy unknown: " + cfg.sim.policy);
    if (!cfg.ores.length) errors.push("ores is empty");

    // ids are one namespace across ores, tracks, dwarves, and events
    var seen = {};
    var all = cfg.tracks.concat(cfg.dwarves, cfg.ores, cfg.events);
    for (var j = 0; j < all.length; j++) {
      var id = all[j].id;
      if (!id) { errors.push("entry with no id"); continue; }
      if (seen[id]) errors.push("duplicate id: " + id);
      seen[id] = true;
    }

    var prev = -Infinity;
    for (var k = 0; k < cfg.ores.length; k++) {
      var o = cfg.ores[k];
      if (k > 0 && !(o.startDepth > prev)) errors.push("non-monotonic startDepth at ore " + o.id);
      if (k === 0 && o.startDepth !== 0) errors.push("first ore must start at depth 0");
      prev = o.startDepth;
      if (PATTERNS.indexOf(o.pattern) === -1) errors.push("unknown pattern '" + o.pattern + "' on ore " + o.id);
      if (!(o.goldPerMeter > 0)) errors.push("ore " + o.id + " needs goldPerMeter > 0");
    }

    function checkEffects(label, effects, allowSeconds) {
      if (!Array.isArray(effects) || !effects.length) { errors.push(label + ": effects must be a non-empty array"); return; }
      for (var n = 0; n < effects.length; n++) {
        var ef = effects[n];
        if (!EFFECTS[ef.verb]) errors.push(label + ": unknown effect verb '" + ef.verb + "'");
        if (typeof ef.value !== "number") errors.push(label + ": effect value must be a number");
        if (ef.seconds !== undefined && !allowSeconds) errors.push(label + ": 'seconds' is only valid on events");
        if (ef.seconds !== undefined && !(ef.seconds > 0)) errors.push(label + ": effect seconds must be > 0");
      }
    }

    var buyables = cfg.tracks.concat(cfg.dwarves);
    for (var m = 0; m < buyables.length; m++) {
      var p = buyables[m];
      if (!(p.base > 0)) errors.push(p.id + ": base must be > 0");
      if (!(p.ratio > 1)) errors.push(p.id + ": ratio must be > 1");
      checkEffects(p.id, p.effects, false);
    }

    for (var e = 0; e < cfg.events.length; e++) {
      var ev = cfg.events[e];
      if (!(ev.weight > 0)) errors.push("event " + ev.id + ": weight must be > 0");
      if (typeof ev.minDepth !== "number" || ev.minDepth < 0) errors.push("event " + ev.id + ": minDepth must be >= 0");
      checkEffects("event " + ev.id, ev.effects, true);
    }
    if (!(cfg.eventRules.intervalSeconds > 0)) errors.push("eventRules.intervalSeconds must be > 0");
    if (!(cfg.eventRules.chance >= 0 && cfg.eventRules.chance <= 1)) errors.push("eventRules.chance must be 0..1");

    var o2 = cfg.offline;
    if (!(o2.ratePercent > 0 && o2.ratePercent <= 1)) errors.push("offline.ratePercent must be 0..1");
    if (!(o2.capHours > 0)) errors.push("offline.capHours must be > 0");
    if (!(o2.minSeconds >= 0)) errors.push("offline.minSeconds must be >= 0");
    if (!(o2.maxClockSkewHours > 0)) errors.push("offline.maxClockSkewHours must be > 0");

    if (!SCORE_FORMULAS[cfg.milestone.scoreFormulaId]) errors.push("unknown scoreFormulaId: " + cfg.milestone.scoreFormulaId);
    if (!(cfg.milestone.depth > 0)) errors.push("milestone.depth must be > 0");
    if (!(cfg.endless.bandLengthM > 0)) errors.push("endless.bandLengthM must be > 0");
    if (!(cfg.endless.multiplierPerBand > 1)) errors.push("endless.multiplierPerBand must be > 1");

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

  // hh:mm:ss-ish ETA string for the shop rows.
  E.formatEta = function (seconds) {
    if (!isFinite(seconds) || seconds <= 0) return "now";
    if (seconds < 60) return Math.ceil(seconds) + "s";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m " + Math.round(seconds % 60) + "s";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h " + Math.round((seconds % 3600) / 60) + "m";
    return Math.floor(seconds / 86400) + "d";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
