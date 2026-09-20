// Greedy Deep — versioned localStorage save + export/import. Click it! Studios, 2026.
// Shape (PRD 4): {version, savedAt, depth, gold, goldEarnedTotal, owned, endingSeen, prefs}
// Export = base64(JSON+checksum); import validates version + checksum, fails safely.
(function () {
  "use strict";

  var S = (window.GDSave = {});

  var MIGRATIONS = {};
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
    } catch (e) { return null; }
  };

  S.readRaw = function (cfg) {
    try { return localStorage.getItem(cfg.save.key); } catch (e) { return null; }
  };

  S.savedAt = function (cfg) {
    var raw = S.readRaw(cfg);
    if (!raw) return 0;
    try {
      var d = JSON.parse(raw);
      return (d && typeof d.savedAt === "number" && isFinite(d.savedAt)) ? d.savedAt : 0;
    } catch (e) { return 0; }
  };

  S.migrate = function (cfg, data) {
    var guard = 0;
    while (data && data.version !== cfg.save.version && guard++ < 32) {
      var fn = MIGRATIONS[data.version];
      if (!fn) return null;
      data = fn(data);
    }
    return data;
  };

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
    if (data.prefs && typeof data.prefs === "object") {
      st.prefs = data.prefs;
    }
    // Ensure prefs.muted is always a boolean (old saves may lack it)
    if (typeof st.prefs.muted !== "boolean") st.prefs.muted = false;
    st.bandId = window.GDEngine.bandAt(cfg, st.depth).id;
    return st;
  };

  S.clear = function (cfg) {
    try { localStorage.removeItem(cfg.save.key); return true; } catch (e) { return false; }
  };

  // ---- Export/import codec (M4, PRD §4) ----
  function checksum(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  S.exportString = function (cfg, state) {
    var data = S.serialize(cfg, state);
    var json = JSON.stringify(data);
    var cs = checksum(json);
    var payload = JSON.stringify({ d: json, c: cs, v: cfg.save.version });
    try { return btoa(payload); } catch (e) { return null; }
  };

  S.importString = function (cfg, str) {
    if (!str || typeof str !== "string") return { ok: false, reason: "empty" };
    var payload;
    try { payload = atob(str.trim()); } catch (e) { return { ok: false, reason: "not-base64" }; }
    var envelope;
    try { envelope = JSON.parse(payload); } catch (e) { return { ok: false, reason: "not-json" }; }
    if (!envelope || !envelope.d || !envelope.c) return { ok: false, reason: "bad-envelope" };
    if (envelope.v !== cfg.save.version) return { ok: false, reason: "version-mismatch", got: envelope.v, want: cfg.save.version };
    if (checksum(envelope.d) !== envelope.c) return { ok: false, reason: "checksum-failed" };
    var data;
    try { data = JSON.parse(envelope.d); } catch (e) { return { ok: false, reason: "corrupt-data" }; }
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
    st.bandId = window.GDEngine.bandAt(cfg, st.depth).id;
    return { ok: true, state: st };
  };
})();
