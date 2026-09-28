// Sapper's Path save (SPEC-v3 §6). One localStorage key (config.save.key, "sappers-path.v3"; the v1 and v2 keys are left
// alone) holding {v, done: {id: mask}, settings: {muted, fast, diff}, last}. mask is a bit per difficulty the level was
// won on (1 easy, 2 normal, 4 hard). Every field is sanitized and clamped on load against the levels the page actually
// has, in order: a level opens when the one before it is won on any difficulty, so a win on a level that is still locked
// is dropped, and `last` must be an open level. Never throws. UMD like engine.js, so Node can check sanitize().
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).save = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1, DIFFS = ["easy", "normal", "hard"], ALL = 7;

  function fresh() { return { v: VERSION, done: {}, settings: { muted: false, fast: false, diff: "normal" }, last: null }; }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);

  // order: the level ids in play order. Unknown ids are dropped; masks are clamped to the three difficulty bits; a win
  // on a level whose predecessor has no win is dropped (and so is every win after it).
  function sanitize(raw, order) {
    const s = fresh();
    if (!isObj(raw)) return s;
    try {
      const d = isObj(raw.done) ? raw.done : {}, open = new Set();
      for (let i = 0; i < order.length; i++) {
        const id = order[i];
        if (i > 0 && !s.done[order[i - 1]]) break;
        open.add(id);
        const m = own(d, id) && typeof d[id] === "number" && isFinite(d[id]) ? (d[id] | 0) & ALL : 0;
        if (m) s.done[id] = m;
      }
      const set = isObj(raw.settings) ? raw.settings : {};
      s.settings.muted = set.muted === true; s.settings.fast = set.fast === true;
      s.settings.diff = DIFFS.indexOf(set.diff) >= 0 ? set.diff : "normal";
      if (typeof raw.last === "string" && open.has(raw.last)) s.last = raw.last;
      return s;
    } catch (e) { return fresh(); }
  }
  // Record a win on difficulty diff. Returns true if it is the level's first win on any difficulty.
  function record(data, id, diff) {
    const bit = 1 << Math.max(0, DIFFS.indexOf(diff)), old = data.done[id] | 0;
    data.done[id] = old | bit;
    return !old;
  }
  // The first level (in order) with no win, or the last level when every one is won.
  function next(data, order) { for (const id of order) if (!data.done[id]) return id; return order[order.length - 1] || null; }
  const isOpen = (data, order, id) => { const i = order.indexOf(id); return i === 0 || (i > 0 && !!data.done[order[i - 1]]); };

  // In-memory storage: selfTest's scratch save, and the fallback when localStorage throws (private mode, blocked data).
  function memoryStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  }

  // Returns {key, store, data, write()}; neither open nor write ever throws.
  function open(store, key, order) {
    let data = fresh();
    try { const raw = store.getItem(key); if (raw) data = sanitize(JSON.parse(raw), order); } catch (e) { data = fresh(); }
    return { key, store, data, write() { try { store.setItem(key, JSON.stringify(this.data)); return true; } catch (e) { return false; } } };
  }

  return { VERSION, DIFFS, fresh, sanitize, record, next, isOpen, memoryStore, open };
});
