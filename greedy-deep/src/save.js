// Greedy Deep — versioned localStorage save. Click it! Studios, 2026.
// Shape (PRD 4): {version, savedAt, depth, gold, goldEarnedTotal, owned, endingSeen, prefs}
// Export/import (base64 + checksum) lands in M4.
(function () {
  "use strict";

  var S = (window.GDSave = {});

  // Migration map keyed by the version being migrated FROM. Each entry returns the
  // next-version shape. Empty in v1; the walker below is the part that has to exist.
  var MIGRATIONS = {
    // 0: function (data) { data.version = 1; return data; }
  };
  S.MIGRATIONS = MIGRATIONS;

  S.serialize = function (cfg, state) {
    return {
      version: cfg.save.version,
      savedAt: Date.now(),
      depth: state.depth,
      gold: state.gold,
      goldEarnedTotal: state.goldEarnedTotal,
      owned: JSON.parse(JSON.stringify(state.owned)),
      endingSeen: !!state.endingSeen,
      prefs: JSON.parse(JSON.stringify(state.prefs || {}))
    };
  };

  S.write = function (cfg, state) {
    var data = S.serialize(cfg, state);
    try {
      localStorage.setItem(cfg.save.key, JSON.stringify(data));
      return data;
    } catch (e) {
      return null; // private mode / quota — the game keeps running, it just won't persist
    }
  };

  S.readRaw = function (cfg) {
    try { return localStorage.getItem(cfg.save.key); } catch (e) { return null; }
  };

  S.migrate = function (cfg, data) {
    var guard = 0;
    while (data && data.version !== cfg.save.version && guard++ < 32) {
      var fn = MIGRATIONS[data.version];
      if (!fn) return null; // unknown version: fail safe, never half-apply
      data = fn(data);
    }
    return data;
  };

  // Returns a state object, or null if there is nothing valid to load.
  S.read = function (cfg) {
    var raw = S.readRaw(cfg);
    if (!raw) return null;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    if (!data || typeof data !== "object") return null;
    data = S.migrate(cfg, data);
    if (!data) return null;
    var st = window.GDEngine.newState(cfg);
    if (typeof data.depth === "number" && isFinite(data.depth)) st.depth = data.depth;
    if (typeof data.gold === "number" && isFinite(data.gold)) st.gold = data.gold;
    if (typeof data.goldEarnedTotal === "number" && isFinite(data.goldEarnedTotal)) st.goldEarnedTotal = data.goldEarnedTotal;
    if (data.owned && typeof data.owned === "object") {
      for (var id in data.owned) {
        var n = data.owned[id];
        if (typeof n === "number" && isFinite(n) && n > 0) st.owned[id] = Math.floor(n);
      }
    }
    st.endingSeen = !!data.endingSeen;
    if (data.prefs && typeof data.prefs === "object") st.prefs = data.prefs;
    return st;
  };

  S.clear = function (cfg) {
    try { localStorage.removeItem(cfg.save.key); return true; } catch (e) { return false; }
  };
})();
