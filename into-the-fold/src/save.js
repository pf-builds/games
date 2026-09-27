// Into the Fold save (SPEC §7). One versioned localStorage key ("intothefold.save.v1", from config.save.key).
// Every field is sanitized on load, so a stale or hand-edited save can never break the game. UMD like rules.js.
// M1 stores only the tutorial flag. M2 seams: stats, streak, the in-progress daily (resume) and the sound pref
// all go in this same object, each with its own clamp in sanitize().
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.IntoTheFold = root.IntoTheFold || {}).save = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1;

  function fresh() { return { v: VERSION, tutorialSeen: false }; }

  function sanitize(raw) {
    const s = fresh();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return s;
    s.tutorialSeen = raw.tutorialSeen === true;
    return s;
  }

  // A storage that lives in memory only: selfTest's scratch namespace, and the fallback when localStorage throws
  // (Safari private mode, blocked site data).
  function memoryStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  }

  // Open the save at `key` in `store`. Returns {key, store, data, write()}; write() never throws.
  function open(store, key) {
    let data = fresh();
    try { const raw = store.getItem(key); if (raw) data = sanitize(JSON.parse(raw)); } catch (e) { data = fresh(); }
    return { key, store, data, write() { try { store.setItem(key, JSON.stringify(this.data)); return true; } catch (e) { return false; } } };
  }

  return { VERSION, fresh, sanitize, memoryStore, open };
});
