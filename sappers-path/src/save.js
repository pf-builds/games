// Sapper's Path save (SPEC §4, SPEC-v2 §8). One localStorage key (config.save.key, "sappers-path.v2"; v1's key is left
// alone) holding {v, stars: {id: 0-3}, best: {id: calls}, settings: {muted, fast}, last}. v is the payload format (1; the
// v2 key did not change the format). Every field is sanitized and clamped on load against the levels the page actually
// has (their ids, mins, worlds and the unlock and star rules), so a stale or hand-edited save can never break the game or
// show progress play could not have made. Never throws. UMD like engine.js, so Node can check sanitize().
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

  // ids: a Set of the level ids that exist. Unknown ids are dropped; a best without stars is dropped. rules (optional):
  // {min: {id: min calls}, worlds: [[id, ...] per world, in order], worldNeeds, stars: config.stars}. With rules a record
  // must be one play could have made:
  //   best is at least the level's min (else it is dropped) and at most maxCrews
  //   stars are what that best earns under the star offsets (a record without a best keeps its stars)
  //   a level still locked under the unlock rule (a level opens when the one before it is won; a world's first level when
  //   the first worldNeeds levels of the world before are won), judged on the sanitized stars before it, keeps nothing,
  //   and `last` must be an open level
  function sanitize(raw, ids, maxCrews, rules) {
    const s = fresh();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return s;
    try {
      const st = raw.stars && typeof raw.stars === "object" && !Array.isArray(raw.stars) ? raw.stars : {};
      const be = raw.best && typeof raw.best === "object" && !Array.isArray(raw.best) ? raw.best : {};
      const R = rules && typeof rules === "object" && rules.min && Array.isArray(rules.worlds) ? rules : null, open = new Set();
      const keep = (id) => {
        const n = own(st, id) ? whole(st[id], 0, 3) : null;
        if (!n) return;
        let b = own(be, id) && be[id] >= 1 ? whole(be[id], 1, maxCrews) : null;
        if (R && b !== null && !(b >= (R.min[id] | 0))) b = null;
        s.stars[id] = b !== null && R ? earned(R, id, b) : n;
        if (b !== null) s.best[id] = b;
      };
      if (R) {
        R.worlds.forEach((list, wi) => {
          for (let i = 0; i < list.length; i++) {
            const id = list[i];
            if (!ids.has(id)) continue;
            let ok = i > 0 ? (s.stars[list[i - 1]] | 0) > 0 : wi === 0;
            if (i === 0 && wi > 0) { const prev = R.worlds[wi - 1], need = Math.min(R.worldNeeds | 0, prev.length); ok = true; for (let k = 0; k < need; k++) if (!((s.stars[prev[k]] | 0) > 0)) ok = false; }
            if (!ok) continue;
            open.add(id); keep(id);
          }
        });
      } else for (const id of ids) { open.add(id); keep(id); }
      const set = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
      s.settings.muted = set.muted === true; s.settings.fast = set.fast === true;
      if (typeof raw.last === "string" && ids.has(raw.last) && open.has(raw.last)) s.last = raw.last;
      return s;
    } catch (e) { return fresh(); }
  }
  // The stars a best of b calls earns on level id (config.stars offsets from its min).
  function earned(R, id, b) { const m = R.min[id] | 0, S = R.stars || {}; return b <= m + (S.threeAtMinPlus | 0) ? 3 : b <= m + (S.twoAtMinPlus | 0) ? 2 : 1; }

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
  function open(store, key, ids, maxCrews, rules) {
    let data = fresh();
    try { const raw = store.getItem(key); if (raw) data = sanitize(JSON.parse(raw), ids, maxCrews, rules); } catch (e) { data = fresh(); }
    return { key, store, data, write() { try { store.setItem(key, JSON.stringify(this.data)); return true; } catch (e) { return false; } } };
  }

  return { VERSION, fresh, sanitize, record, memoryStore, open };
});
