// Sapper's Path save (SPEC-v3 §6). One localStorage key (config.save.key, "sappers-path.v3"; the v1 and v2 keys are left
// alone) holding {v, done: {id: mask}, settings: {muted, speed, cb, diff}, last}. mask is a bit per difficulty the level was
// won on (1 easy, 2 normal, 4 hard). Every field is sanitized and clamped on load against the levels the page actually
// has, in order: a level opens when the one before it is won on any difficulty, so a win on a level that is still locked
// is dropped, and `last` must be an open level. Never throws. UMD like engine.js, so Node can check sanitize().
// v4 M1: speed (the speed button's multiplier, a whole number 1-3; the page also checks it against config show.speeds)
// replaces the old 2x flag (a save with fast: true loads as 2), and cb (colour-blind marks) is a strict boolean.
// v4 M4: gal {id: mask}, the Gallery's pictures won, a bit per difficulty like done. Every Gallery picture is open once
// the Gallery is (the page decides that from done), so a mask is kept for any Gallery id the page has, clamped to the
// three bits; unknown ids and non-numbers are dropped. A save from before M4 loads with an empty gal.
// v4 M5 (the meta layer, src/meta.js): coins (a whole number 0-9,999,999), inv {ladder, quartermaster, scout, recall}
// (each 0-99), best {id: [ms easy, ms normal, ms hard, taps easy, taps normal, taps hard, coins earned]} (whole numbers,
// ms 0-3,600,000 and taps 0-999 with 0 = none, kept only for a difficulty the level or picture was won on; ids the page
// has), and lives {n, at} (n 0-livesMax, at a time in ms or 0). meta (config.meta) gives a new save its coins
// (meta.coins.start) and full lives. A save from before M5 has no coins field: it loads with the starting balance (the
// same as a new player, so everyone can try each power-up once), an empty inventory, no best results and full lives.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).save = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1, DIFFS = ["easy", "normal", "hard"], ALL = 7;

  const MAXSPEED = 3;
  const MAXCOINS = 9999999, MAXINV = 99, MAXMS = 3600000, MAXTAPS = 999, POWERS = ["ladder", "quartermaster", "scout", "recall"];
  const whole = (v, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.round(v))) : 0);
  const startCoins = (meta) => whole(meta && meta.coins && meta.coins.start, MAXCOINS), maxLives = (meta) => Math.max(1, Math.min(99, (meta && meta.livesMax) | 0 || 5));
  function fresh(meta) { return { v: VERSION, done: {}, gal: {}, settings: { muted: false, speed: 1, cb: false, diff: "normal" }, last: null,
    coins: startCoins(meta), inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 0 }, best: {}, lives: { n: maxLives(meta), at: 0 } }; }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);

  // order: the level ids in play order. Unknown ids are dropped; masks are clamped to the three difficulty bits; a win
  // on a level whose predecessor has no win is dropped (and so is every win after it). gal: the Gallery's ids (v4 M4).
  // meta: config.meta (v4 M5: the starting coins and lives).
  function sanitize(raw, order, gal, meta) {
    const s = fresh(meta);
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
      const g = isObj(raw.gal) ? raw.gal : {};
      for (const id of gal || []) { const m = own(g, id) && typeof g[id] === "number" && isFinite(g[id]) ? (g[id] | 0) & ALL : 0; if (m) s.gal[id] = m; }
      const set = isObj(raw.settings) ? raw.settings : {};
      s.settings.muted = set.muted === true; s.settings.cb = set.cb === true;
      s.settings.speed = Number.isInteger(set.speed) && set.speed >= 1 && set.speed <= MAXSPEED ? set.speed : set.fast === true ? 2 : 1;
      s.settings.diff = DIFFS.indexOf(set.diff) >= 0 ? set.diff : "normal";
      if (typeof raw.last === "string" && open.has(raw.last)) s.last = raw.last;
      // v4 M5: coins (an old save without the field keeps the starting balance), the inventory, best results, lives.
      if (own(raw, "coins")) s.coins = whole(raw.coins, MAXCOINS);
      const inv = isObj(raw.inv) ? raw.inv : {}; for (const k of POWERS) s.inv[k] = whole(inv[k], MAXINV);
      const best = isObj(raw.best) ? raw.best : {};
      for (const [id, mask] of Object.entries(s.done).concat(Object.entries(s.gal))) {
        const b = own(best, id) && Array.isArray(best[id]) ? best[id] : null; if (!b) continue;
        const row = [0, 1, 2].map((k) => (mask & (1 << k) ? whole(b[k], MAXMS) : 0)).concat([0, 1, 2].map((k) => (mask & (1 << k) ? whole(b[3 + k], MAXTAPS) : 0)), [whole(b[6], MAXCOINS)]);
        if (row.some((v) => v > 0)) s.best[id] = row;
      }
      const lv = isObj(raw.lives) ? raw.lives : null;
      if (lv) { s.lives.n = Math.min(maxLives(meta), whole(lv.n, 99)); s.lives.at = whole(lv.at, 8.64e15); }
      return s;
    } catch (e) { return fresh(meta); }
  }
  // Record a win on difficulty diff (in data.done, or v4 M4 a Gallery picture's in data.gal: field "gal"). Returns true if
  // it is the level's first win on any difficulty.
  function record(data, id, diff, field) {
    const bit = 1 << Math.max(0, DIFFS.indexOf(diff)), map = data[field || "done"], old = map[id] | 0;
    map[id] = old | bit;
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
  function open(store, key, order, gal, meta) {
    let data = fresh(meta);
    try { const raw = store.getItem(key); if (raw) data = sanitize(JSON.parse(raw), order, gal, meta); } catch (e) { data = fresh(meta); }
    return { key, store, data, write() { try { store.setItem(key, JSON.stringify(this.data)); return true; } catch (e) { return false; } } };
  }

  return { VERSION, DIFFS, fresh, sanitize, record, next, isOpen, memoryStore, open };
});
