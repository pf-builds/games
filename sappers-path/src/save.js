// Sapper's Path save (SPEC §4). One localStorage key (config.save.key, "sappers-path.v1") holding
// {v, stars: {id: 0-3}, best: {id: crews}, settings: {muted, fast}, last}. Every field is sanitized and clamped on load
// against the level ids the page actually has, so a stale or hand-edited save can never break the game. Never throws.
// UMD like engine.js, so Node can check sanitize().
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).save = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1;

  function fresh() { return { v: VERSION, stars: {}, best: {}, settings: { muted: false, fast: false }, last: null }; }
  // A whole number in [lo, hi], or null.
  function whole(v, lo, hi) { return typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : null; }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // ids: a Set of the level ids that exist. Unknown ids are dropped; a best without stars is dropped.
  function sanitize(raw, ids, maxCrews) {
    const s = fresh();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return s;
    const st = raw.stars && typeof raw.stars === "object" && !Array.isArray(raw.stars) ? raw.stars : {};
    const be = raw.best && typeof raw.best === "object" && !Array.isArray(raw.best) ? raw.best : {};
    for (const id of ids) {
      const n = own(st, id) ? whole(st[id], 0, 3) : null;
      if (!n) continue;
      s.stars[id] = n;
      const b = own(be, id) && be[id] >= 1 ? whole(be[id], 1, maxCrews) : null;
      if (b) s.best[id] = b;
    }
    const set = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    s.settings.muted = set.muted === true; s.settings.fast = set.fast === true;
    if (typeof raw.last === "string" && ids.has(raw.last)) s.last = raw.last;
    return s;
  }

  // Stars only go up; best crews only go down.
  function record(data, id, stars, used) {
    const old = data.stars[id] | 0;
    if (stars > old) data.stars[id] = stars;
    if (!(data.best[id] <= used)) data.best[id] = used;
    return stars > old;
  }

  // In-memory storage: selfTest's scratch save, and the fallback when localStorage throws (private mode, blocked data).
  function memoryStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  }

  // Returns {key, store, data, write()}; neither open nor write ever throws.
  function open(store, key, ids, maxCrews) {
    let data = fresh();
    try { const raw = store.getItem(key); if (raw) data = sanitize(JSON.parse(raw), ids, maxCrews); } catch (e) { data = fresh(); }
    return { key, store, data, write() { try { store.setItem(key, JSON.stringify(this.data)); return true; } catch (e) { return false; } } };
  }

  return { VERSION, fresh, sanitize, record, memoryStore, open };
});
