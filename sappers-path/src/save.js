// Sapper's Path save (SPEC-v3 §6). One localStorage key (config.save.key, "sappers-path.v3"; the v1 and v2 keys are left
// alone) holding {v, done: {id: mask}, settings: {muted, speed, cb, diff}, last} (format 1, to v4.2; v4.3's format 2 is
// below). mask is a bit per difficulty the level was won on (1 easy, 2 normal, 4 hard). Every field is sanitized and
// clamped on load against the levels the page actually has; until v4.2 a win on a level whose predecessor had none was
// dropped (v4.3 keeps it), and `last` must be an open level. Never throws. UMD like engine.js, so Node can check sanitize().
// v4 M1: speed (the speed button's multiplier, a whole number 1-3; the page also checks it against config show.speeds)
// replaces the old 2x flag (a save with fast: true loads as 2), and cb (colour-blind marks) is a strict boolean.
// v4 M4: gal {id: mask}, the Gallery's pictures won, a bit per difficulty like done. Every Gallery picture is open once
// the Gallery is (the page decides that from done), so a mask is kept for any Gallery id the page has, clamped to the
// three bits; unknown ids and non-numbers are dropped. A save from before M4 loads with an empty gal.
// v4 M5 (the meta layer, src/meta.js): coins (a whole number 0-9,999,999), inv {ladder, quartermaster, scout, recall, volley (v5 R1)};
// v5 R1: got {id: 1} for each power-up unlocked (its one free use given; anything but 1 dropped)
// v5 R3: eggs {id: 1}, the journey map's easter eggs found (ids "s<sheet>-<i>"; anything else dropped, at most 256); a
// save from before R3 loads with none found.
// (each 0-99), best {id: [ms easy, ms normal, ms hard, taps easy, taps normal, taps hard, coins earned]} (whole numbers,
// ms 0-3,600,000 and taps 0-999 with 0 = none, kept only for a difficulty the level or picture was won on; ids the page
// has), and lives {n, at} (n 0-livesMax, at a time in ms or 0). meta (config.meta) gives a new save its coins
// (meta.coins.start) and full lives. A save from before M5 has no coins field: it loads with the starting balance (the
// same as a new player, so everyone can try each power-up once), an empty inventory, no best results and full lives.
// v4.3 (SPEC-v4 §9, the v4.3 entry): save format 2, progress by stable level id, every level with one fixed tag (no
// difficulty picker). {v: 2, done: {id: 1}, gal: {id: 1}, settings: {muted, speed, cb}, last, coins, inv, best: {id: [ms,
// taps, coins earned]}, lives}. A level is cleared or not (1); a cleared id the page has is kept wherever it sits in the
// order (no win is dropped for its position any more: openness is worked out from the ids, isOpen below). One-time
// migration of every shipped shape (format 1: v3, v4, v4.1 and v4.2 all wrote it): a done or gal mask with any of the
// three difficulty bits set becomes cleared; a best row [ms E, ms N, ms H, taps E, taps N, taps H, coins] becomes [the
// fastest time, the fewest taps, the coins] over the difficulties it was won on; settings.diff (and v3's fast, read as
// speed 2) are dropped; coins, inventory, lives and the other settings are kept. Sanitized and clamped as before; the
// next write stores format 2.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).save = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 2, ALL = 7; // format 1's done masks: a bit per difficulty (1 easy, 2 normal, 4 hard)

  const MAXSPEED = 3;
  const MAXCOINS = 9999999, MAXINV = 99, MAXMS = 3600000, MAXTAPS = 999, POWERS = ["ladder", "quartermaster", "scout", "recall", "volley"]; // v5 R1: volley
  const whole = (v, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.round(v))) : 0);
  const startCoins = (meta) => whole(meta && meta.coins && meta.coins.start, MAXCOINS), maxLives = (meta) => Math.max(1, Math.min(99, (meta && meta.livesMax) | 0 || 5));
  function fresh(meta) { return { v: VERSION, done: {}, gal: {}, settings: { muted: false, speed: 1, cb: false }, last: null,
    coins: startCoins(meta), inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 0, volley: 0 }, got: {}, best: {}, lives: { n: maxLives(meta), at: 0 }, eggs: {} }; }
  const EGG = /^s\d{1,3}-\d{1,2}$/, MAXEGGS = 256; // v5 R3: the journey map's easter eggs found, by id (journey.js eggId)
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);

  // order: the level ids in play order; gal: the Gallery's ids (v4 M4); meta: config.meta (v4 M5: the starting coins and
  // lives). Unknown ids are dropped. v4.3: format 1 (any raw.v but 2) is migrated as the header says.
  const cleared = (o, id) => own(o, id) && typeof o[id] === "number" && isFinite(o[id]) && ((o[id] | 0) & ALL) !== 0;
  const least = (a) => { let m = 0; for (const v of a) if (v > 0 && (!m || v < m)) m = v; return m; }; // the smallest nonzero (0: none)
  function sanitize(raw, order, gal, meta) {
    const s = fresh(meta);
    if (!isObj(raw)) return s;
    try {
      const v1 = raw.v !== VERSION, d = isObj(raw.done) ? raw.done : {}, g = isObj(raw.gal) ? raw.gal : {}, mask = {};
      for (const id of order || []) if (cleared(d, id)) { s.done[id] = 1; mask[id] = v1 ? (d[id] | 0) & ALL : ALL; }
      for (const id of gal || []) if (cleared(g, id)) { s.gal[id] = 1; mask[id] = v1 ? (g[id] | 0) & ALL : ALL; }
      const set = isObj(raw.settings) ? raw.settings : {};
      s.settings.muted = set.muted === true; s.settings.cb = set.cb === true;
      s.settings.speed = Number.isInteger(set.speed) && set.speed >= 1 && set.speed <= MAXSPEED ? set.speed : set.fast === true ? 2 : 1;
      if (typeof raw.last === "string" && isOpen(s, order || [], raw.last)) s.last = raw.last;
      // v4 M5: coins (an old save without the field keeps the starting balance), the inventory, best results, lives.
      if (own(raw, "coins")) s.coins = whole(raw.coins, MAXCOINS);
      const inv = isObj(raw.inv) ? raw.inv : {}; for (const k of POWERS) s.inv[k] = whole(inv[k], MAXINV);
      const got = isObj(raw.got) ? raw.got : {}; for (const k of POWERS) if (got[k] === 1) s.got[k] = 1; // v5 R1: power-ups unlocked (their free use given)
      const best = isObj(raw.best) ? raw.best : {};
      for (const id of Object.keys(mask)) {
        const b = own(best, id) && Array.isArray(best[id]) ? best[id] : null, m = mask[id]; if (!b) continue;
        // format 1: [ms E, ms N, ms H, taps E, taps N, taps H, coins], each difficulty's only if it was won there
        const row = v1 ? [least([0, 1, 2].map((k) => (m & (1 << k) ? whole(b[k], MAXMS) : 0))), least([0, 1, 2].map((k) => (m & (1 << k) ? whole(b[3 + k], MAXTAPS) : 0))), whole(b[6], MAXCOINS)]
          : [whole(b[0], MAXMS), whole(b[1], MAXTAPS), whole(b[2], MAXCOINS)];
        if (row.some((v) => v > 0)) s.best[id] = row;
      }
      const lv = isObj(raw.lives) ? raw.lives : null;
      if (lv) { s.lives.n = Math.min(maxLives(meta), whole(lv.n, 99)); s.lives.at = whole(lv.at, 8.64e15); }
      const eg = isObj(raw.eggs) ? raw.eggs : {}; for (const k of Object.keys(eg).slice(0, MAXEGGS)) if (EGG.test(k) && eg[k] === 1) s.eggs[k] = 1; // v5 R3
      return s;
    } catch (e) { return fresh(meta); }
  }
  // Record a win (in data.done, or v4 M4 a Gallery picture's in data.gal: field "gal"). Returns true if it is the level's
  // first clear (v4.3: a level is cleared or not; the coins' first-clear bonus reads it).
  function record(data, id, field) { const map = data[field || "done"], old = !!map[id]; map[id] = 1; return !old; }
  // v4.3, openness by id: a level is open when it is the first, cleared, or the one before it in order is cleared (field
  // "gal": the Gallery, whose first picture opens on `gate`, the Siege's gallery.openAt being cleared). The ids in `order`
  // can grow (packs) without moving anyone's progress.
  function isOpen(data, order, id, field, gate) {
    const map = data[field || "done"] || {}, i = order.indexOf(id); if (i < 0) return false;
    return !!map[id] || (i === 0 ? (field === "gal" ? !!gate : true) : !!map[order[i - 1]]);
  }
  // The first open level (in order) not cleared, or the last level when every one is (field and gate as isOpen; null when
  // none is open, e.g. a Gallery still shut).
  function next(data, order, field, gate) { return nextBy(data, order, field, (id) => isOpen(data, order, id, field, gate)); }
  // v5 R2: the same with any openness test, open(id) (the Gallery's side quests use questOpen).
  function nextBy(data, order, field, open) {
    const map = data[field || "done"] || {};
    for (const id of order) if (!map[id] && open(id)) return id;
    return order.length && open(order[order.length - 1]) ? order[order.length - 1] : order.find(open) || null;
  }
  // v5 R2, side quests: Gallery picture id (gal: the pictures' ids in order; after: each one's quest main level, numbered
  // from 1 in `order`) is open when cleared, or once the main level numbered after is cleared. A quest past the last
  // level waits for the whole campaign, then they open one at a time (the first at once, each next when the one before it
  // is cleared): the long tail until R4 builds those levels.
  function questOpen(data, order, gal, after, id) {
    const i = gal.indexOf(id), done = data.done || {}, won = data.gal || {}; if (i < 0) return false; if (won[id]) return true;
    const a = after[i] | 0; if (a >= 1 && a <= order.length) return !!done[order[a - 1]];
    if (!order.every((x) => done[x])) return false;
    return i === 0 || (after[i - 1] | 0) <= order.length || !!won[gal[i - 1]];
  }

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

  return { VERSION, fresh, sanitize, record, next, nextBy, isOpen, questOpen, memoryStore, open };
});
