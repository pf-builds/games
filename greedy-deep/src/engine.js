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
  // Soft cap: diminishing returns on multiplicative stacking.
  // Instead of v^n (uncapped exponential), use v^(n * softCapFn(n, cap)).
  // softCapFn returns an effective exponent fraction: 1 for n<=cap, diminishing past it.
  // This keeps early levels full-strength and bends the curve past the cap.
  function softMul(v, n, cap) {
    if (!cap || cap <= 0 || n <= 0) return Math.pow(v, n);
    // Effective exponent: min(n, cap + sqrt(max(0, n-cap)))
    var effN = n <= cap ? n : cap + Math.sqrt(n - cap);
    return Math.pow(v, effN);
  }
  // Hard clamp: never let any value exceed this to prevent Infinity
  var VALUE_CAP = 1e100;
  function clamp(x) { return Math.min(VALUE_CAP, Math.max(-VALUE_CAP, x || 0)); }
  E.clamp = clamp;

  var EFFECTS = {
    add_click:          function (acc, v, n) { acc.clickAdd += v * n; },
    add_rate:           function (acc, v, n) { acc.rateAdd += v * n; },
    mul_rate:           function (acc, v, n, cap) { acc.rateMul *= softMul(v, n, cap); },
    mul_gold:           function (acc, v, n, cap) { acc.goldMul *= softMul(v, n, cap); },
    add_rate_per_dwarf: function (acc, v, n) { acc.ratePerDwarf += v * n; },
    reveal_bands:       function (acc, v, n) { acc.revealBonus += v * n; },
    mul_hazard_resist:  function (acc, v, n) { acc.hazardMul *= Math.pow(v, n); },
    add_offline_hours:  function (acc, v, n) { acc.offlineHours += v * n; },
    mul_offline_rate:   function (acc, v, n) { acc.offlineRateMul *= Math.pow(v, n); },
    mul_rate_temp:      function (acc, v, n) { acc.rateMul *= Math.pow(v, n); },
    mul_gold_temp:      function (acc, v, n) { acc.goldMul *= Math.pow(v, n); },
    // M5: the chest's gold buff. Unlike mul_gold_temp (crew income only, the rich-seam
    // event) this one multiplies EVERY gold source: crew, taps, spacebar and pickups.
    mul_gold_all_temp:  function (acc, v, n) { acc.goldAllMul *= Math.pow(v, n); },
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
      revealBonus: 0, hazardMul: 1, offlineHours: 0, offlineRateMul: 1, depthAdd: 0, goldAllMul: 1
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
      // M5: real earnings per second (taps + crew, before the all-gold buff), a rolling
      // average over ~pickups.earnWindowS. Gems pay seconds of this. Never saved.
      earnRate: 0,
      earnAcc: 0,
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
  // Is a purchasable depth-locked? Returns the minDepth or 0.
  E.lockDepth = function (cfg, id) {
    var p = E.byId(cfg, id);
    return (p && typeof p.minDepth === "number") ? p.minDepth : 0;
  };
  E.isLocked = function (cfg, state, id) {
    var md = E.lockDepth(cfg, id);
    return md > 0 && state.depth < md;
  };

  // Bulk cost: sum of N successive purchases = base * ratio^owned * (ratio^N - 1) / (ratio - 1)
  E.bulkCost = function (cfg, state, id, n) {
    var p = E.byId(cfg, id);
    if (!p || n <= 0) return 0;
    var owned = E.ownedOf(state, id);
    var total = 0;
    for (var i = 0; i < n; i++) total += p.base * Math.pow(p.ratio, owned + i);
    return total;
  };

  // How many can be bought with current gold (overflow-safe, capped)
  var MAX_BUY_CAP = 500; // hard cap on single MAX-buy batch
  E.maxBuyable = function (cfg, state, id) {
    var p = E.byId(cfg, id);
    if (!p) return 0;
    var owned = E.ownedOf(state, id);
    var gold = state.gold;
    if (!isFinite(gold) || gold <= 0) return 0;
    var n = 0;
    var cost = 0;
    while (n < MAX_BUY_CAP) {
      var next = p.base * Math.pow(p.ratio, owned + n);
      if (!isFinite(next) || next <= 0) break; // overflow safety
      if (cost + next > gold + 1e-9) break;
      cost += next;
      n++;
    }
    return n;
  };

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

  // Compute the start depth of endless band `rep` (1-indexed).
  // Band length grows with `lengthGrowth` per repeat: base + base*(growth*(rep-1)).
  function endlessBandStart(cfg, rep) {
    var en = cfg.endless;
    var base = en.bandLengthM;
    var growth = en.lengthGrowth || 0;
    // Sum of lengths for bands 1..rep-1: base*(1+growth*0) + base*(1+growth*1) + ...
    var sum = 0;
    for (var i = 0; i < rep - 1; i++) sum += base * (1 + growth * i);
    return endlessStart(cfg) + sum;
  }

  function endlessBandLength(cfg, rep) {
    var en = cfg.endless;
    return en.bandLengthM * (1 + (en.lengthGrowth || 0) * (rep - 1));
  }

  function endlessBand(cfg, rep) {
    if (!cfg.__endless) hide(cfg, "__endless", {});
    if (cfg.__endless[rep]) return cfg.__endless[rep];
    var ores = cfg.ores, last = ores[ores.length - 1], en = cfg.endless;
    var start = endlessBandStart(cfg, rep);
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
    if (depth >= es) {
      // Walk endless bands with variable lengths
      var rep = 1;
      while (rep < 9999) {
        var nextStart = endlessBandStart(cfg, rep + 1);
        if (depth < nextStart) break;
        rep++;
      }
      return endlessBand(cfg, rep);
    }
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
    var caps = (cfg.balance && cfg.balance.softCaps) || {};
    var mulRateCap = caps.mulRate || 0;
    var mulGoldCap = caps.mulGold || 0;

    // Dwarf headcount first: add_rate_per_dwarf needs it after the fold.
    var dwarves = 0;
    for (i = 0; i < cfg.dwarves.length; i++) dwarves += state.owned[cfg.dwarves[i].id] || 0;

    for (i = 0; i < list.length; i++) {
      n = state.owned[list[i].id] || 0;
      if (!n) continue;
      efs = list[i].effects;
      for (j = 0; j < efs.length; j++) {
        h = EFFECTS[efs[j].verb];
        if (h && !INSTANT_VERBS[efs[j].verb]) {
          // Pass soft-cap threshold for multiplicative verbs
          var sc = 0;
          if (efs[j].verb === "mul_rate") sc = mulRateCap;
          else if (efs[j].verb === "mul_gold") sc = mulGoldCap;
          h(acc, efs[j].value, n, sc);
        }
      }
    }

    // Timed effects from events (mul_rate_temp / mul_gold_temp) expire on sim time.
    var tl = state.timed;
    if (tl && tl.length) {
      for (i = 0; i < tl.length; i++) {
        if (tl[i].until <= state.t) continue;
        h = EFFECTS[tl[i].verb];
        if (h && !INSTANT_VERBS[tl[i].verb]) h(acc, tl[i].value, 1, 0);
      }
    }

    // Cart Rails add_rate_per_dwarf: cap per-dwarf contribution with sqrt scaling past threshold
    var rdpCap = (cfg.balance && cfg.balance.ratePerDwarfCap) || 0;
    var effDwarves = dwarves;
    if (rdpCap > 0 && dwarves > rdpCap) {
      effDwarves = rdpCap + Math.sqrt(dwarves - rdpCap);
    }
    acc.rateAdd += acc.ratePerDwarf * effDwarves;

    // Clamp multipliers to prevent overflow
    acc.rateMul = clamp(acc.rateMul);
    acc.goldMul = clamp(acc.goldMul);
    acc.goldAllMul = clamp(acc.goldAllMul);

    var band = E.bandAt(cfg, state.depth);
    var clickPower = cfg.start.clickPower + acc.clickAdd;
    // Depth comes only from digRate. Taps never dig (PRD 8).
    var digRate = clamp((cfg.start.digRate + acc.rateAdd) * acc.rateMul);
    // Every gold source passes through goldAllMul once; the *Base values are before it.
    var goldRateBase = clamp(digRate * band.goldPerMeter * acc.goldMul);
    var goldPerTapBase = clamp(clickPower * band.goldPerMeter * cfg.start.clickYield);
    var goldRate = clamp(goldRateBase * acc.goldAllMul);
    var goldPerTap = clamp(goldPerTapBase * acc.goldAllMul);

    return {
      clickPower: clickPower, digRate: digRate, goldRate: goldRate, goldPerTap: goldPerTap,
      goldRateBase: goldRateBase, goldPerTapBase: goldPerTapBase, goldAllMul: acc.goldAllMul,
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
    var depthBefore = state.depth;
    state.depth += d.digRate * dt;
    var g = d.goldRate * dt;
    state.gold = clamp(state.gold + g);
    state.goldEarnedTotal = clamp(state.goldEarnedTotal + g);
    state.t += dt;
    // rolling real earnings: crew this step plus any taps since the last one
    state.earnAcc = (state.earnAcc || 0) + d.goldRateBase * dt;
    var tau = (cfg.pickups && cfg.pickups.earnWindowS) || 30;
    var ek = 1 - Math.exp(-dt / tau);
    state.earnRate = clamp((state.earnRate || 0) + (state.earnAcc / dt - (state.earnRate || 0)) * ek);
    state.earnAcc = 0;

    // prune expired timed effects (derive already ignores them; this keeps the array small)
    var tl = state.timed;
    if (tl.length) {
      for (var i = tl.length - 1; i >= 0; i--) if (tl[i].until <= state.t) tl.splice(i, 1);
    }

    E.tickEvents(cfg, state, dt, d, ctx);
    // M5: the pickup field ticks on the same sim clock (GD wires it; simulate runs its own).
    if (ctx && ctx.onStep) ctx.onStep(dt, d);

    var nb = E.bandAt(cfg, state.depth);
    if (nb.id !== state.bandId) {
      var prev = state.bandId;
      state.bandId = nb.id;
      // prevDepth + dt let the caller interpolate the crossing back to the exact
      // JSON startDepth instead of logging wherever the tick happened to land.
      if (ctx && ctx.onBand) ctx.onBand(nb, prev, state, { prevDepth: depthBefore, dt: dt });
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
    var n = times === undefined ? 1 : times;
    var g = d.goldPerTap * n;
    state.gold = clamp(state.gold + g);
    state.goldEarnedTotal = clamp(state.goldEarnedTotal + g);
    state.earnAcc = clamp((state.earnAcc || 0) + d.goldPerTapBase * n);
    return g;
  };

  E.buy = function (cfg, state, id) {
    var p = E.byId(cfg, id);
    if (!p) return { ok: false, reason: "unknown-id", id: id };
    if (E.isLocked(cfg, state, id)) return { ok: false, reason: "locked", minDepth: E.lockDepth(cfg, id), id: id };
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
    out.gold = d.goldRateBase * out.cappedSeconds * rate;
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

  // ------------------------------------------------------------ pickups (M5)
  // Clicked pickups on the shaft walls: gems pay instant gold, chests start a timed buff
  // through the existing *_temp verbs, geodes take several clicks and then roll a weighted
  // table. The field lives BESIDE the state, never inside it: it is never saved, and
  // applyOffline() cannot see it, so offline time grants nothing from pickups.
  // Pooled: `maxLive` slots are allocated once and reused, so ticking allocates nothing.
  // Rolls take their own rng, so pickups never shift the event rng's sequence.
  var PICKUP_KINDS = { gem: true, chest: true, geode: true };
  var PICKUP_REWARDS = { gold: true, buff: true, gems: true };
  E.PICKUP_KINDS = PICKUP_KINDS;

  function pickupType(cfg, id) {
    var pk = cfg.pickups;
    if (!pk) return null;
    if (!pk.__types) {
      var m = {};
      for (var i = 0; i < pk.types.length; i++) m[pk.types[i].id] = pk.types[i];
      hide(pk, "__types", m);
    }
    return pk.__types[id] || null;
  }
  E.pickupType = pickupType;

  // Band scaling, capped so an endless band 40 deep never compounds a payout to nonsense.
  function bandPow(v, bi, cfg) {
    if (!(v > 0)) return 1;
    var cap = cfg.pickups.bandScaleCap;
    return Math.pow(v, Math.max(0, Math.min(bi, cap)));
  }
  E.pickupBandPow = bandPow;

  // Same formula as GDRender.effFaceY (render keeps its own copy for the band plan): where
  // the dig face sits on a settled camera, in bu from the top of the shaft viewport.
  E.faceYBu = function (cfg, revealBonus) {
    var L = cfg.layout, lan = cfg.lantern || {};
    var bias = (revealBonus || 0) * (lan.forwardTilesPerLevel || 0) * L.tileBu;
    var floorY = lan.minFaceYBu === undefined ? L.faceYBu : lan.minFaceYBu;
    return Math.max(floorY, L.faceYBu - bias);
  };
  // World y (bu) drawn at the top of the viewport when the camera is settled on the face.
  function settledTopBu(cfg, state, derived) {
    return state.depth * cfg.layout.buPerMeter - E.faceYBu(cfg, derived.revealBonus);
  }

  E.newPickupField = function (cfg) {
    var n = (cfg.pickups && cfg.pickups.maxLive) || 0, slots = [];
    for (var i = 0; i < n; i++) {
      slots.push({ active: false, id: 0, type: "", kind: "", ttl: 0, life: 0, age: 0,
        clicks: 0, clicksMax: 0, bandIndex: 0, xBu: 0, yBu: 0, sizeBu: 0, flash: 0 });
    }
    return { checkT: 0, nextId: 1, slots: slots, live: 0, spawned: 0, collected: 0, expired: 0, goldPaid: 0 };
  };

  E.pickupLiveOf = function (field, typeId) {
    var n = 0;
    for (var i = 0; i < field.slots.length; i++) if (field.slots[i].active && field.slots[i].type === typeId) n++;
    return n;
  };
  E.pickupById = function (field, id) {
    for (var i = 0; i < field.slots.length; i++) if (field.slots[i].active && field.slots[i].id === id) return field.slots[i];
    return null;
  };

  // Place a pickup in a side wall inside the settled viewport near the face. The right
  // wall keeps clear of the active vein (the strike target) and pickups keep clear of
  // each other; both are bounded rerolls. `opts` (debug/tests) can pin x, y (viewport bu),
  // side, ttl and clicks. Returns the slot, or null when the pool is full.
  E.spawnPickup = function (cfg, field, state, derived, typeId, rng, opts) {
    var ty = pickupType(cfg, typeId);
    if (!ty || !field) return null;
    var slot = null, i;
    for (i = 0; i < field.slots.length; i++) if (!field.slots[i].active) { slot = field.slots[i]; break; }
    if (!slot) return null;
    opts = opts || {};
    var pk = cfg.pickups, sp = pk.spawn, L = cfg.layout;
    var H = L._liveShaftBu || L.shaftBu;
    var fy = E.faceYBu(cfg, derived.revealBonus);
    var y0 = Math.max(sp.padTopBu, fy - sp.aboveFaceBu), y1 = Math.min(H - sp.padBottomBu, fy + sp.belowFaceBu);
    // The active vein's bracket owns that stretch of the right wall. Clear it by half the
    // sprite plus a margin, and further below it by the distance the face will carry the
    // pickup up the screen over its lifetime, so it never drifts into the bracket either.
    var half = ty.sizeBu * 0.5 + sp.veinClearBu;
    var drift = derived.digRate * L.buPerMeter * (ty.lifetimeS + pk.lanternLifetimeS * (derived.revealBonus || 0));
    var vTop = Math.max(L.tileBu * 2, fy - cfg.vein.aboveFaceBu);
    var veinTop = vTop - half, veinBot = vTop + cfg.vein.hBu + half + drift;
    var pinSide = opts.side === 0 || opts.side === "left" ? 0 : (opts.side === 1 || opts.side === "right" ? 1 : -1);
    var sx = 0, sy = 0, side = 0, tries = 0, clear = false;
    while (!clear && tries++ < 6) {
      sy = opts.y !== undefined ? opts.y : y0 + rng() * Math.max(0, y1 - y0);
      side = pinSide >= 0 ? pinSide : (rng() < 0.5 ? 0 : 1);
      if (side === 1 && sy > veinTop && sy < veinBot) side = 0;
      var xr = side ? sp.rightXBu : sp.leftXBu;
      sx = opts.x !== undefined ? opts.x : xr[0] + rng() * (xr[1] - xr[0]);
      clear = true;
      if (opts.x !== undefined || opts.y !== undefined) break;
      var topNow = settledTopBu(cfg, state, derived);
      for (i = 0; i < field.slots.length; i++) {
        var o = field.slots[i];
        if (!o.active) continue;
        if (Math.abs(o.xBu - sx) < sp.minGapBu && Math.abs((o.yBu - topNow) - sy) < sp.minGapBu) { clear = false; break; }
      }
    }
    var bi = derived.band.index;
    slot.active = true;
    slot.id = field.nextId++;
    slot.type = ty.id;
    slot.kind = ty.kind;
    slot.life = opts.ttl !== undefined ? opts.ttl : ty.lifetimeS + pk.lanternLifetimeS * (derived.revealBonus || 0);
    slot.ttl = slot.life;
    slot.age = 0;
    slot.flash = 0;
    var cmin = ty.clicks[0], cmax = ty.clicks[1];
    slot.clicksMax = opts.clicks !== undefined ? opts.clicks : cmin + Math.floor(rng() * (cmax - cmin + 1));
    if (slot.clicksMax > cmax) slot.clicksMax = cmax;
    slot.clicks = slot.clicksMax;
    slot.bandIndex = bi;
    slot.xBu = sx;
    slot.yBu = settledTopBu(cfg, state, derived) + sy;
    slot.sizeBu = ty.sizeBu;
    field.live++;
    field.spawned++;
    return slot;
  };

  function freePickup(field, slot) { slot.active = false; field.live--; }

  // Age, expire (lifetime or scrolled off the top of a settled camera), then roll spawns
  // once per `checkSeconds`. `canSpawn` false (hidden tab, overlay up) stops the spawn
  // clock outright, so nothing banks while nobody can see the shaft.
  E.tickPickups = function (cfg, field, state, dt, derived, rng, canSpawn, hooks) {
    var pk = cfg.pickups;
    if (!pk || !field) return;
    var topBu = settledTopBu(cfg, state, derived);
    var i, s;
    for (i = 0; i < field.slots.length; i++) {
      s = field.slots[i];
      if (!s.active) continue;
      s.ttl -= dt; s.age += dt;
      if (s.ttl <= 0 || s.yBu - topBu + s.sizeBu * 0.5 < 0) {
        freePickup(field, s);
        field.expired++;
        if (hooks && hooks.onPickupExpire) hooks.onPickupExpire(s);
      }
    }
    if (!canSpawn) return;
    field.checkT += dt;
    var guard = 0, bi = derived.band.index;
    while (field.checkT >= pk.checkSeconds && guard++ < 64) {
      field.checkT -= pk.checkSeconds;
      for (var t = 0; t < pk.types.length; t++) {
        var ty = pk.types[t];
        if (state.depth < ty.minDepth) continue;
        if (field.live >= field.slots.length || E.pickupLiveOf(field, ty.id) >= ty.maxLive) continue;
        var p = ty.ratePerMinute * bandPow(ty.rateMulPerBand, bi, cfg) * pk.checkSeconds / 60;
        if (rng() >= p) continue;
        s = E.spawnPickup(cfg, field, state, derived, ty.id, rng);
        if (s && hooks && hooks.onPickupSpawn) hooks.onPickupSpawn(s);
      }
    }
  };

  // The earnings a gold pickup pays seconds of: the rolling real-earnings rate, capped at
  // crew income plus `earnCapTapsPerSec` taps a second so an autoclicker cannot inflate it.
  E.earnBasis = function (cfg, state, derived) {
    var cap = derived.goldRateBase + cfg.pickups.earnCapTapsPerSec * derived.goldPerTapBase;
    var r = state.earnRate > 0 ? state.earnRate : 0;
    return clamp(r < cap ? r : cap);
  };
  // Gold for one gold reward: `earnSeconds` of real earnings, floored at `floorTaps` taps
  // (so an idle player still gets something), scaled by band, then through the all-gold
  // buff like every other gold source.
  E.pickupGold = function (cfg, state, derived, r, bandIndex) {
    var g = Math.max(E.earnBasis(cfg, state, derived) * r.earnSeconds, derived.goldPerTapBase * r.floorTaps);
    return clamp(g * bandPow(r.payoutMulPerBand, bandIndex, cfg) * derived.goldAllMul);
  };
  E.gemGold = function (cfg, state, derived, bandIndex) {
    var gem = pickupType(cfg, "gem");
    return gem ? E.pickupGold(cfg, state, derived, gem.reward, bandIndex) : 0;
  };

  function rollWeighted(list, rng) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].weight;
    var roll = rng() * total, acc = 0;
    for (i = 0; i < list.length; i++) { acc += list[i].weight; if (roll < acc) return list[i]; }
    return list[list.length - 1];
  }

  // A buff is one timed effect on the existing verbs. A second chest of the same buff
  // refreshes the timer instead of stacking another multiplier on top.
  E.applyPickupBuff = function (cfg, state, b, bandIndex) {
    var secs = b.seconds + b.secondsPerBand * Math.max(0, Math.min(bandIndex, cfg.pickups.bandScaleCap));
    var until = state.t + secs, tl = state.timed;
    var tid = b.timedId || hide(b, "timedId", "pickup:" + b.id);
    for (var i = 0; i < tl.length; i++) {
      if (tl[i].id === tid && tl[i].until > state.t) { if (until > tl[i].until) tl[i].until = until; return secs; }
    }
    tl.push({ verb: b.verb, value: b.value, until: until, id: tid });
    return secs;
  };

  // One click on pickup `id`. A geode loses a click and cracks; the last click (or the
  // only click on a gem or chest) pays and frees the slot. Returns what happened.
  E.clickPickup = function (cfg, field, state, id, rng) {
    var s = E.pickupById(field, id);
    if (!s) return { ok: false, reason: "gone", id: id };
    s.clicks--;
    var res = { ok: true, id: id, type: s.type, kind: s.kind, done: false, clicksLeft: s.clicks,
      clicksMax: s.clicksMax, gold: 0, buff: null, buffSeconds: 0, gems: 0, xBu: s.xBu, yBu: s.yBu, bandIndex: s.bandIndex };
    if (s.clicks > 0) return res;
    var ty = pickupType(cfg, s.type), d = E.derive(cfg, state), pk = cfg.pickups;
    var r = ty.reward;
    if (r.kind === "table") r = rollWeighted(pk.geodeTable, rng);
    if (r.kind === "gold") {
      res.gold = E.pickupGold(cfg, state, d, r, s.bandIndex);
    } else if (r.kind === "gems") {
      res.gems = r.count;
      res.gold = clamp(E.gemGold(cfg, state, d, s.bandIndex) * r.count);
    } else if (r.kind === "buff") {
      res.buff = rollWeighted(pk.buffs, rng);
      res.buffSeconds = E.applyPickupBuff(cfg, state, res.buff, s.bandIndex);
    }
    if (res.gold > 0) {
      state.gold = clamp(state.gold + res.gold);
      state.goldEarnedTotal = clamp(state.goldEarnedTotal + res.gold);
    }
    res.done = true;
    res.clicksLeft = 0;
    freePickup(field, s);
    field.collected++;
    field.goldPaid = clamp(field.goldPaid + res.gold);
    return res;
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
      if (E.isLocked(cfg, state, list[i].id)) continue;
      var c = E.costOf(cfg, state, list[i].id);
      if (c <= state.gold + 1e-9 && c < bestCost) { best = list[i]; bestCost = c; }
    }
    return best;
  }

  // Diagnostic policy: buy the affordable row with the best marginal score per gold.
  // Depth is the binding constraint on the ending, so digRate is weighted heavily.
  function ratioPick(cfg, state) {
    var list = cat(cfg);
    var W = cfg.sim.ratioDepthWeight;   // JSON, not a literal: PRD 12 content-as-data
    var base = E.derive(cfg, state);
    var baseScore = base.digRate * W + base.goldRate;
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
      var val = (d.digRate * W + d.goldRate - baseScore) / c;
      if (val > bestVal) { bestVal = val; best = list[i]; }
    }
    return best;
  }

  // max-buy policy: buy the max affordable of every track and dwarf each tick
  function maxBuyAll(cfg, state) {
    // Returns a sentinel — simulate handles this specially
    return "__max_buy__";
  }

  E.POLICIES = {
    "cheapest-affordable": cheapestAffordable,
    "none": function () { return null; },
    "ratio": ratioPick,
    "max-buy": maxBuyAll
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
      rng: E.makeRng(opts.seed === undefined ? (cfg.sim.seed || 1) : opts.seed),
      onEvent: function () { events++; },
      onBand: null
    };

    var reached = false, reachedAtSeconds = null;
    var lastPurchaseT = 0, maxGap = 0;
    var nextSample = 0;
    var startBand = E.bandAt(cfg, state.depth);
    bandLog.push({ band: startBand.id, index: startBand.index, depth: state.depth, t: 0, goldRateBefore: 0, goldRateAfter: 0, stepRatio: 1, goldPerMeter: startBand.goldPerMeter });

    ctx.onBand = function (nb, prevId, st, info) {
      var prev = bandLog[bandLog.length - 1];
      var before = prev.goldPerMeter, after = nb.goldPerMeter;
      // income step is measured at the boundary: goldRate is digRate x gpm x goldMul, and
      // digRate/goldMul are continuous across a boundary, so the step IS the gpm ratio.
      var d = E.derive(cfg, st);
      // Log the crossing at the exact JSON startDepth with the interpolated tick time,
      // not wherever the whole-dt step happened to land (critic M2, MINOR 1).
      var t = st.t;
      if (info && info.dt > 0 && st.depth > info.prevDepth) {
        var frac = (nb.startDepth - info.prevDepth) / (st.depth - info.prevDepth);
        if (frac >= 0 && frac <= 1) t = st.t - info.dt + frac * info.dt;
      }
      bandLog.push({
        band: nb.id, index: nb.index, depth: nb.startDepth, tickDepth: st.depth, t: t,
        goldPerMeter: after,
        goldRateBefore: d.digRate * before * d.goldMul * d.goldAllMul,
        goldRateAfter: d.goldRate,
        stepRatio: after / before
      });
    };

    var isMaxBuy = policyName === "max-buy";
    // For max-buy, use the aggressive tapping rate from config
    if (isMaxBuy) {
      cps = (cfg.input && cfg.input.spaceMinesPerSec) || 8;
    }
    var peakGold = 0;

    // M5: `pickups: "collect-all"` spawns on the same schedule as the live game and
    // collects every spawn the moment it appears (geodes cracked through). "off" (the
    // default) leaves the pre-M5 numbers untouched. Pickups roll on their own rng.
    var pickupMode = opts.pickups === undefined ? "off" : opts.pickups;
    if (pickupMode !== "off" && pickupMode !== "collect-all") return { error: "unknown pickups mode: " + pickupMode };
    var pField = pickupMode === "collect-all" && cfg.pickups ? E.newPickupField(cfg) : null;
    var pRng = E.makeRng(((opts.seed === undefined ? (cfg.sim.seed || 1) : opts.seed) ^ 0x51CC) >>> 0);
    var pStats = { spawned: 0, collected: 0, gold: 0, buffs: 0, byType: {} };
    var allFinite = true;

    var guard = 0;
    for (var t = 0; t < maxSeconds; t += dt) {
      if (guard++ > 10000000) break;

      if (cps > 0) E.tap(cfg, state, cps * dt);

      var bought = 0;
      if (isMaxBuy) {
        // Buy max affordable of every purchasable
        var allP = cat(cfg);
        for (var mi = 0; mi < allP.length; mi++) {
          if (E.isLocked(cfg, state, allP[mi].id)) continue;
          var maxN = E.maxBuyable(cfg, state, allP[mi].id);
          for (var mj = 0; mj < maxN; mj++) {
            var mr = E.buy(cfg, state, allP[mi].id);
            if (!mr.ok) break;
            purchases.push({ t: state.t, id: mr.id, cost: mr.cost, owned: mr.owned });
            var mgap = state.t - lastPurchaseT;
            if (mgap > maxGap) maxGap = mgap;
            lastPurchaseT = state.t;
            bought++;
          }
        }
      } else {
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
      }

      E.substep(cfg, state, dt, ctx);
      if (state.gold > peakGold) peakGold = state.gold;
      if (!isFinite(state.gold) || !isFinite(state.depth) || !isFinite(state.goldEarnedTotal)) allFinite = false;

      if (pField) {
        var pd = E.derive(cfg, state);
        var sp0 = pField.spawned;
        E.tickPickups(cfg, pField, state, dt, pd, pRng, true, null);
        pStats.spawned += pField.spawned - sp0;
        for (var ps = 0; ps < pField.slots.length; ps++) {
          var slot = pField.slots[ps];
          if (!slot.active) continue;
          var ptype = slot.type, pres = null, pg = 0;
          while (pg++ < 16 && slot.active) pres = E.clickPickup(cfg, pField, state, slot.id, pRng);
          if (!pres || !pres.done) continue;
          pStats.collected++;
          pStats.gold += pres.gold;
          if (pres.buff) pStats.buffs++;
          pStats.byType[ptype] = (pStats.byType[ptype] || 0) + 1;
        }
      }

      if (state.t >= nextSample) {
        var d2 = E.derive(cfg, state);
        if (!isFinite(d2.goldRate) || !isFinite(d2.digRate) || !isFinite(d2.goldPerTap)) allFinite = false;
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

    // richButLockedMax: longest stretch where gold >= cheapest locked but no unlocked is affordable
    // Recompute from samples (cheaper than tracking per-tick)
    var richButLockedMax = 0, rblStart = -1;
    for (var si2 = 0; si2 < samples.length; si2++) {
      var ss = samples[si2];
      // Reconstruct: can we buy any unlocked row?
      var canBuyUnlocked = false, canAffordLocked = false;
      var tmpState = { depth: ss.depth, gold: ss.gold, owned: {}, t: ss.t, timed: [], eventT: 0, eventsFired: 0, bandId: "", lastEvent: "", goldEarnedTotal: 0, prefs: {}, endingSeen: false, endingScore: 0, endingAtSeconds: 0 };
      var cl = cat(cfg);
      for (var ci2 = 0; ci2 < cl.length; ci2++) {
        var cid = cl[ci2].id;
        var locked = E.isLocked(cfg, tmpState, cid);
        var cost2 = cl[ci2].base; // approx (ignoring owned)
        if (!locked && cost2 <= ss.gold + 1e-9) canBuyUnlocked = true;
        if (locked && cost2 <= ss.gold + 1e-9) canAffordLocked = true;
      }
      if (!canBuyUnlocked && canAffordLocked) {
        if (rblStart < 0) rblStart = ss.t;
      } else {
        if (rblStart >= 0) {
          var dur2 = ss.t - rblStart;
          if (dur2 > richButLockedMax) richButLockedMax = dur2;
          rblStart = -1;
        }
      }
    }

    // Band crossing cadence: time between successive crossings
    var bandGaps = [];
    for (var bg = 1; bg < bandLog.length; bg++) {
      bandGaps.push(bandLog[bg].t - bandLog[bg - 1].t);
    }
    bandGaps.sort(function (a, b) { return a - b; });
    var bandCadence = {
      count: bandGaps.length,
      min: bandGaps.length ? bandGaps[0] : 0,
      median: bandGaps.length ? bandGaps[Math.floor(bandGaps.length / 2)] : 0,
      max: bandGaps.length ? bandGaps[bandGaps.length - 1] : 0
    };

    return {
      reached: reached,
      reachedAtSeconds: reachedAtSeconds,
      finalDepth: state.depth,
      finalGold: state.gold,
      goldEarnedTotal: state.goldEarnedTotal,
      peakGold: peakGold,
      purchases: purchases,
      purchaseCount: purchases.length,
      purchasesFirst600: first600,
      bandLog: bandLog,
      bandCadence: bandCadence,
      maxGapSeconds: maxGap,
      eventsFired: events,
      samples: samples,
      policy: policyName,
      dt: dt,
      owned: JSON.parse(JSON.stringify(state.owned)),
      richButLockedMax: richButLockedMax,
      pickups: pickupMode,
      pickupStats: pStats,
      allFinite: allFinite && isFinite(peakGold) && isFinite(maxGap)
    };
  };

  // ------------------------------------------------------------ effect description
  // Plain-language per-unit effect string for a purchasable's effects array.
  E.effectDesc = function (effects) {
    if (!effects || !effects.length) return "";
    var parts = [];
    for (var i = 0; i < effects.length; i++) {
      var ef = effects[i];
      var v = ef.verb, val = ef.value;
      if (v === "add_click") parts.push("+" + val + " tap power");
      else if (v === "add_rate") parts.push("+" + val + " m/s dig");
      else if (v === "mul_rate") parts.push("+" + Math.round((val - 1) * 100) + "% dig speed");
      else if (v === "mul_gold") parts.push("+" + Math.round((val - 1) * 100) + "% gold");
      else if (v === "add_rate_per_dwarf") parts.push("+" + val + " m/s per dwarf");
      else if (v === "reveal_bands") parts.push("+" + val + " band revealed");
      else if (v === "mul_hazard_resist") parts.push("-" + Math.round((1 - val) * 100) + "% hazard");
      else if (v === "add_offline_hours") parts.push("+" + val + " hr offline");
      else if (v === "mul_offline_rate") parts.push("+" + Math.round((val - 1) * 100) + "% offline rate");
      else parts.push(v + " " + val);
    }
    return parts.join(", ");
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
                "events", "eventRules", "offline", "milestone", "endless", "flavor",
                "audio", "particles", "ending", "pickups"];
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

    if (!(cfg.sim.ratioDepthWeight > 0)) errors.push("sim.ratioDepthWeight must be > 0");
    if (!(cfg.sim.seed >= 0)) errors.push("sim.seed must be >= 0");
    var lan = cfg.lantern;
    if (!lan) errors.push("missing block: lantern");
    else {
      if (!(lan.forwardTilesPerLevel >= 0)) errors.push("lantern.forwardTilesPerLevel must be >= 0");
      if (!(lan.minFaceYBu > 0 && lan.minFaceYBu <= cfg.layout.faceYBu)) errors.push("lantern.minFaceYBu must be 0..layout.faceYBu");
      if (!(lan.veilAlphaPerLevel >= 0)) errors.push("lantern.veilAlphaPerLevel must be >= 0");
      if (!(lan.veilAlphaFloor >= 0 && lan.veilAlphaFloor <= cfg.veil.alpha)) errors.push("lantern.veilAlphaFloor must be 0..veil.alpha");
    }
    // ---- M3 render blocks. A bad palette or a missing camera block must fail loud
    // here rather than put a flat rect on screen.
    var cam = cfg.camera;
    if (!cam) errors.push("missing block: camera");
    else {
      if (!(cam.ease > 0 && cam.ease <= 1)) errors.push("camera.ease must be 0..1");
      if (!(cam.snapBackMs >= 0)) errors.push("camera.snapBackMs must be >= 0");
      if (!(cam.maxUpBu > 0)) errors.push("camera.maxUpBu must be > 0");
    }
    if (!(cfg.veil.scanline >= 1)) errors.push("veil.scanline must be >= 1");
    var spr = cfg.sprites;
    if (!spr) errors.push("missing block: sprites");
    else {
      if (!(spr.digFps > 0)) errors.push("sprites.digFps must be > 0");
      if (!(spr.walkFps > 0)) errors.push("sprites.walkFps must be > 0");
      if (!(spr.pickTiers >= 1)) errors.push("sprites.pickTiers must be >= 1");
      if (!(spr.dwarfFrames >= 1)) errors.push("sprites.dwarfFrames must be >= 1");
      if (!spr.palettes) errors.push("sprites.palettes must be an object of cosmetic palettes");
      // Sprite canvas sizes come from JSON, never from a layout measurement (which reads
      // 0 while the tab is hidden). The pixel art is hand-placed for these exact sizes,
      // so JSON that disagrees with the art fails loud rather than drawing a clipped sprite.
      var sizes = { dwarfWBu: 14, dwarfHBu: 16, cartWBu: 20, cartHBu: 14, elevatorWBu: 24, elevatorHBu: 28 };
      for (var sk in sizes) {
        if (spr[sk] !== sizes[sk]) errors.push("sprites." + sk + " must be " + sizes[sk] + " (the art is drawn for it)");
      }
    }
    for (var pk = 0; pk < cfg.ores.length; pk++) {
      var pp = cfg.ores[pk].palette;
      if (!pp || !pp.base || !pp.light || !pp.dark || !pp.speck) {
        errors.push("ore " + cfg.ores[pk].id + ": palette needs base, light, dark and speck");
      }
    }
    if (spr && spr.palettes) {
      for (var dk = 0; dk < cfg.dwarves.length; dk++) {
        var cos = cfg.dwarves[dk].cosmetic || {};
        if (cos.palette && !spr.palettes[cos.palette]) {
          errors.push("dwarf " + cfg.dwarves[dk].id + ": unknown cosmetic palette '" + cos.palette + "'");
        }
      }
    }

    // ---- M5 pickups. Every number the spawner, the payouts and the hit test read.
    var pk = cfg.pickups;
    if (pk) {
      if (!(pk.checkSeconds > 0)) errors.push("pickups.checkSeconds must be > 0");
      if (!(pk.maxLive >= 1 && pk.maxLive <= 16)) errors.push("pickups.maxLive must be 1..16");
      if (!(pk.bandScaleCap >= 0)) errors.push("pickups.bandScaleCap must be >= 0");
      if (!(pk.lanternLifetimeS >= 0)) errors.push("pickups.lanternLifetimeS must be >= 0");
      if (!(pk.hitMinCssPx >= 40)) errors.push("pickups.hitMinCssPx must be >= 40 (phone tap target)");
      if (!(pk.hitPadBu >= 0)) errors.push("pickups.hitPadBu must be >= 0");
      if (!(pk.earnWindowS > 0)) errors.push("pickups.earnWindowS must be > 0");
      if (!(pk.earnCapTapsPerSec > 0)) errors.push("pickups.earnCapTapsPerSec must be > 0");
      var ps = pk.spawn || {};
      if (!Array.isArray(ps.leftXBu) || !Array.isArray(ps.rightXBu) || !(ps.leftXBu[1] >= ps.leftXBu[0]) || !(ps.rightXBu[1] >= ps.rightXBu[0])) {
        errors.push("pickups.spawn.leftXBu/rightXBu must be [min, max]");
      }
      if (!(ps.aboveFaceBu >= 0 && ps.belowFaceBu >= 0 && ps.padTopBu >= 0 && ps.padBottomBu >= 0 && ps.minGapBu >= 0 && ps.veinClearBu >= 0)) {
        errors.push("pickups.spawn needs aboveFaceBu, belowFaceBu, padTopBu, padBottomBu, minGapBu, veinClearBu >= 0");
      }
      function checkReward(label, r, allowTable) {
        if (!r || !(PICKUP_REWARDS[r.kind] || (allowTable && r.kind === "table"))) { errors.push(label + ": unknown reward kind '" + (r && r.kind) + "'"); return; }
        if (r.kind === "gold" && !(r.earnSeconds > 0 && r.floorTaps >= 0 && r.payoutMulPerBand > 0)) errors.push(label + ": gold reward needs earnSeconds > 0, floorTaps >= 0, payoutMulPerBand > 0");
        if (r.kind === "gems" && !(r.count >= 1)) errors.push(label + ": gems reward needs count >= 1");
      }
      if (!Array.isArray(pk.types) || !pk.types.length) errors.push("pickups.types must be a non-empty array");
      else {
        var pseen = {};
        for (var pt = 0; pt < pk.types.length; pt++) {
          var ty = pk.types[pt], tl = "pickup " + ty.id;
          if (!ty.id || pseen[ty.id]) errors.push("pickups.types: missing or duplicate id '" + ty.id + "'");
          pseen[ty.id] = true;
          if (!PICKUP_KINDS[ty.kind]) errors.push(tl + ": unknown kind '" + ty.kind + "' (sprites exist for gem, chest, geode)");
          if (!(ty.ratePerMinute >= 0)) errors.push(tl + ": ratePerMinute must be >= 0");
          if (!(ty.rateMulPerBand > 0)) errors.push(tl + ": rateMulPerBand must be > 0");
          if (!(ty.minDepth >= 0)) errors.push(tl + ": minDepth must be >= 0");
          if (!(ty.maxLive >= 1)) errors.push(tl + ": maxLive must be >= 1");
          if (!(ty.lifetimeS > 0)) errors.push(tl + ": lifetimeS must be > 0");
          if (!(ty.sizeBu > 0)) errors.push(tl + ": sizeBu must be > 0");
          if (!Array.isArray(ty.clicks) || !(ty.clicks[0] >= 1) || !(ty.clicks[1] >= ty.clicks[0]) || ty.clicks[1] > 8 ||
              Math.floor(ty.clicks[0]) !== ty.clicks[0] || Math.floor(ty.clicks[1]) !== ty.clicks[1]) {
            errors.push(tl + ": clicks must be integers [min, max], 1 <= min <= max <= 8");
          }
          checkReward(tl, ty.reward, true);
        }
        if (!pseen.gem) errors.push("pickups.types needs a 'gem' (gem bursts pay in gems)");
      }
      if (!Array.isArray(pk.buffs) || !pk.buffs.length) errors.push("pickups.buffs must be a non-empty array");
      else for (var pb = 0; pb < pk.buffs.length; pb++) {
        var bf = pk.buffs[pb];
        if (bf.verb !== "mul_gold_all_temp" && bf.verb !== "mul_gold_temp" && bf.verb !== "mul_rate_temp") errors.push("pickup buff " + bf.id + ": verb must be a timed verb (mul_gold_all_temp, mul_gold_temp, mul_rate_temp)");
        if (!(bf.value > 0) || !(bf.seconds > 0) || !(bf.secondsPerBand >= 0) || !(bf.weight > 0)) errors.push("pickup buff " + bf.id + ": needs value > 0, seconds > 0, secondsPerBand >= 0, weight > 0");
        if (!bf.label) errors.push("pickup buff " + bf.id + ": needs a label");
      }
      if (!Array.isArray(pk.geodeTable) || !pk.geodeTable.length) errors.push("pickups.geodeTable must be a non-empty array");
      else for (var pg = 0; pg < pk.geodeTable.length; pg++) {
        checkReward("geodeTable[" + pg + "]", pk.geodeTable[pg], false);
        if (!(pk.geodeTable[pg].weight > 0)) errors.push("geodeTable[" + pg + "]: weight must be > 0");
      }
      if (!pk.palette || !pk.palette.gem || !pk.palette.chest || !pk.palette.geode) errors.push("pickups.palette needs gem, chest and geode");
      if (!pk.juice) errors.push("pickups.juice is missing");
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
    // If we exhausted the suffix ladder and the value is still >= 1000, fall back to
    // scientific notation so the string stays compact and never malforms.
    if (v >= 1000) {
      var totalExp = tier * 3 + Math.floor(Math.log10(v));
      var man = v / Math.pow(10, Math.floor(Math.log10(v)));
      // Keep scientific notation short: round mantissa to integer for compact output
      var s = man < 9.95 ? man.toFixed(1) : String(Math.round(man));
      if (s.indexOf(".") !== -1) s = s.replace(/\.?0+$/, "");
      return (neg ? "-" : "") + s + "e" + totalExp;
    }
    var out;
    if (v >= 100) out = String(Math.round(v));
    else if (v >= 10) out = v.toFixed(Math.max(0, f.sigFigs - 2));
    else out = v.toFixed(Math.max(0, f.sigFigs - 1));
    if (out.indexOf(".") !== -1) out = out.replace(/\.?0+$/, "");
    // Rounding can push v to 1000 (e.g. 999.6 rounds to 1000): bump tier if possible
    if (parseFloat(out) >= 1000 && tier < maxTier) {
      tier++;
      v = parseFloat(out) / 1000;
      if (v >= 100) out = String(Math.round(v));
      else if (v >= 10) out = v.toFixed(Math.max(0, f.sigFigs - 2));
      else out = v.toFixed(Math.max(0, f.sigFigs - 1));
      if (out.indexOf(".") !== -1) out = out.replace(/\.?0+$/, "");
    }
    return (neg ? "-" : "") + out + f.suffixes[tier];
  };

  // hh:mm:ss-ish ETA string for the shop rows.
  // Round to whole seconds BEFORE splitting into units. Rounding each unit separately
  // is what produced "37m 60s" (M3 critic): floor(2279.6/60)=37 and round(59.6)=60.
  E.formatEta = function (seconds) {
    if (!isFinite(seconds) || seconds <= 0) return "now";
    var s = Math.ceil(seconds - 1e-9);
    if (s < 60) return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m " + (s % 60) + "s";
    var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    if (m === 60) { h++; m = 0; }
    if (h < 24) return h + "h " + m + "m";
    return Math.floor(h / 24) + "d " + (h % 24) + "h";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
