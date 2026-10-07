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
// v5 R3 fix (Peter's call, 2026-10-04): old saves keep their levels by slot number. A level id is "e<era>-<n>", n its
// slot in the campaign; R2's re-lay moved four slots into the next era (v4.3's e1-25, e2-50, e3-75, e4-100 are e2-25,
// e3-50, e4-75, e5-100 now). On load, a done, best or last id the page no longer has counts as the level in its slot n
// (an id the page has wins over a renamed one), so a migrated level is cleared once and its first-clear coins never pay
// again.
// Land 1 fix (the functional critic's m5): tail {id: 1}, long-tail pictures a save had open before the lands moved the
// long tail past them (questOpen keeps them open), and lands (1: the page has read this save with lands built, so its
// tail is final); both optional, kept on load (tail only for pictures the page has), not in the save code.
// v5.2: settings.music and settings.sfx, music and sound effects switched apart (strict booleans, on by default). A save
// from before v5.2 has neither: both load as the opposite of its muted flag. muted is kept as both off.
// v5.4 (SPEC-v4 §9, tools/v5-4-notes.md): reset and the save code.
//   reset(sv, meta): the progress cleared to a fresh save, the player's preferences (settings: music, sfx, muted, cb,
//   speed) kept; written at once, then the CLOUD HOOK (cloud.reset) is told so a portal build's cloud copy goes too.
//   The save code: CODE ("SP1.") + base64url(body + its CRC-32, 4 bytes big-endian). The body is unsigned LEB128
//   varints: the save's format v; coins (format 1: + 1, 0 for an old save with none); the inventory (a count, then each in POWERS order); got (a bit per power-up);
//   the cleared levels (a count, then each by slot number as a step from the one before, in slot order, with its best
//   row: format 2 [ms, taps, coins]; format 1 its mask, then [ms E, N, H, taps E, N, H, coins]); the cleared pictures
//   the same, by their place in the Gallery's order (from 1); the eggs found (a count, then sheet and i each); last (its
//   slot, 0: none); lives n (format 1: + 1 as coins) and at. Preferences are not in it: a load keeps the device's. decode() checks the prefix,
//   that the text is canonical base64url (so no character can change unseen), the checksum, and that the body reads to
//   its end exactly, then builds a raw save that goes through sanitize() like any stored one: clamped, unknown slots and
//   pictures dropped, an older format migrated, levels kept by slot (the v5 R3 rule). The checksum catches typing and
//   copying mistakes, not cheating (coins are free; a code edited on purpose still only loads what sanitize allows).
// v6 lane B (Zen mode; tools/zen-mode-notes.md): two modes. The key above stays the Campaign's save and still holds the
//   SHARED WALLET (coins, inv, got, lives) and the settings for both modes; it is sanitized against every level and
//   picture the game has (lands too), so nothing in it is dropped while the campaign shows 1-200. Zen progress lives in
//   its own key (config zen.save.key): {v: 1, done, gal, eggs (ids "z<world>-<sheet in its world>-<i>"), best, last,
//   moved (1: the one-time move below has run), mode (the mode last played: the home accents its card)}.
//   openZen(store, key, order, gal, wallet): like open(), its data carries the wallet's fields as accessors onto
//   wallet() (the Campaign save's data, read at each access, so a reset or a load there shows at once); they are not
//   enumerable, so the Zen key never stores them; write() writes the Zen key and the Campaign save.
//   An order may carry `starts` (a Set of ids open from the start: every Zen world's first level); isOpen honours it.
//   zenMove(camp, zen, spec): the one-time move of a pre-v6 save's Zen-bound progress into the Zen data (a union; never
//   removes anything from either). spec: {pics: [[gallery id, zen level id]] (the 36 Gallery pictures: a picture won
//   becomes its World 1 level cleared, no best row: it is dealt again), levels: [ids] (a land's levels: cleared and best
//   kept, same deal), quests: [ids] (a land's pictures: won and best kept), eggs: [[castle egg id, zen egg id]], last:
//   [ids] (a campaign last among these moves to Zen's last when Zen has none)}. Sets zen.moved = 1.
//   The SP2 save code: CODE2 ("SP2.") + base64url(body + CRC-32): the Campaign body exactly as SP1's (pictures by their
//   place in the whole of gallery.json), then the Zen part: format, the cleared levels (a count, then world, its level
//   number in the world, best row), the won pictures (by their place in gallery.json, best row), the eggs (world, sheet,
//   i), last (world and number, 0 0: none). decodeAny() reads both: an SP1 code loads as the Campaign with zen null (the
//   page runs the move on it); an SP2 code as both.
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
  function fresh(meta) { return { v: VERSION, done: {}, gal: {}, settings: { muted: false, music: true, sfx: true, speed: 1, cb: false }, last: null,
    coins: startCoins(meta), inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 0, volley: 0 }, got: {}, best: {}, lives: { n: maxLives(meta), at: 0 }, eggs: {} }; }
  const EGG = /^s\d{1,3}-\d{1,2}$/, MAXEGGS = 256; // v5 R3: the journey map's easter eggs found, by id (journey.js eggId)
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);

  // order: the level ids in play order; gal: the Gallery's ids (v4 M4); meta: config.meta (v4 M5: the starting coins and
  // lives). Unknown ids are dropped. v4.3: format 1 (any raw.v but 2) is migrated as the header says.
  const cleared = (o, id) => own(o, id) && typeof o[id] === "number" && isFinite(o[id]) && ((o[id] | 0) & ALL) !== 0;
  const least = (a) => { let m = 0; for (const v of a) if (v > 0 && (!m || v < m)) m = v; return m; }; // the smallest nonzero (0: none)
  // v5 R3 fix: a level id's slot number (0: not a level id), and the save's keys moved onto the page's ids by slot.
  const slotOf = (id) => { const m = /^e\d{1,2}-(\d{1,4})$/.exec(id); return m ? +m[1] : 0; };
  function bySlot(o, order) {
    if (!isObj(o)) return {}; const has = new Set(order || []), at = new Map(); for (const id of has) if (slotOf(id)) at.set(slotOf(id), id);
    const r = {}; for (const k of Object.keys(o)) if (has.has(k) || !at.has(slotOf(k))) r[k] = o[k];
    for (const k of Object.keys(o)) { const t = !has.has(k) && at.get(slotOf(k)); if (t && !own(r, t)) r[t] = o[k]; }
    return r;
  }
  function sanitize(raw, order, gal, meta) {
    const s = fresh(meta);
    if (!isObj(raw)) return s;
    try {
      raw = Object.assign({}, raw, { done: bySlot(raw.done, order), best: bySlot(raw.best, order) }); if (typeof raw.last === "string") raw.last = Object.keys(bySlot({ [raw.last]: 1 }, order))[0];
      const v1 = raw.v !== VERSION, d = isObj(raw.done) ? raw.done : {}, g = isObj(raw.gal) ? raw.gal : {}, mask = {};
      for (const id of order || []) if (cleared(d, id)) { s.done[id] = 1; mask[id] = v1 ? (d[id] | 0) & ALL : ALL; }
      for (const id of gal || []) if (cleared(g, id)) { s.gal[id] = 1; mask[id] = v1 ? (g[id] | 0) & ALL : ALL; }
      const set = isObj(raw.settings) ? raw.settings : {};
      const on = set.muted !== true; s.settings.music = typeof set.music === "boolean" ? set.music : on; s.settings.sfx = typeof set.sfx === "boolean" ? set.sfx : on; // v5.2
      s.settings.muted = !s.settings.music && !s.settings.sfx; s.settings.cb = set.cb === true;
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
      if (isObj(raw.tail)) { s.tail = {}; for (const id of gal || []) if (raw.tail[id] === 1) s.tail[id] = 1; } if (raw.lands === 1) s.lands = 1; // Land 1 fix: the long tail kept open
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
    if (field !== "gal" && order.starts && order.starts.has(id)) return true; // v6: a Zen world's first level
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
    const i = gal.indexOf(id), done = data.done || {}, won = data.gal || {}; if (i < 0) return false; if (won[id] || (data.tail || {})[id] === 1) return true; // Land 1 fix: a long-tail picture kept open
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

  // ---- v5.4: reset and the save code ----------------------------------------------------------------------------------
  // CLOUD HOOK (v5.4, not built): a portal build with its own cloud save (CrazyGames) sets cloud.reset(key) to clear the
  // cloud copy; reset() calls it after the local write. null on the web build.
  const cloud = { reset: null };
  // d's progress replaced by from's, d's preferences kept (a new object; neither is changed).
  function withPrefs(from, d) { const s = Object.assign({}, from); s.settings = Object.assign({}, d && d.settings ? d.settings : from.settings); return s; }
  // Clear sv's progress (a fresh save, preferences kept) and write it. Returns whether the local write took.
  function reset(sv, meta) {
    sv.data = withPrefs(fresh(meta), sv.data); const w = sv.write();
    if (typeof cloud.reset === "function") { try { cloud.reset(sv.key); } catch (e) { /* the local reset stands */ } }
    return w;
  }
  const CODE = "SP1.", B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", ROW = [7, 3]; // a best row's length: format 1, 2
  let crcT = null;
  function crc32(b, n) { if (!crcT) { crcT = new Int32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[i] = c; } }
    let c = -1; for (let i = 0; i < n; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
  function b64(b) { let s = ""; for (let i = 0; i < b.length; i += 3) { const n = (b[i] << 16) | ((b[i + 1] | 0) << 8) | (b[i + 2] | 0), k = Math.min(3, b.length - i) + 1; for (let j = 0; j < k; j++) s += B64[(n >> (18 - 6 * j)) & 63]; } return s; }
  function unb64(s) { // null on any character outside base64url or an impossible length
    if (s.length % 4 === 1) return null; const out = new Uint8Array(Math.floor((s.length * 3) / 4)); let o = 0, acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) { const v = B64.indexOf(s[i]); if (v < 0) return null; acc = ((acc << 6) | v) & 0xffffff; bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; } }
    return out;
  }
  // The save code of data (a sanitized save; format 1 shapes are written too, so tests can make an older page's code).
  // gal: the Gallery's ids in order (a level goes by the slot number in its id).
  const writer = () => { const b = []; return { b, put: (v) => { v = whole(v, 9007199254740991); while (v >= 128) { b.push((v % 128) | 128); v = Math.floor(v / 128); } b.push(v); } }; };
  const seal = (b, code) => { const c = crc32(b, b.length); b.push(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255); return code + b64(b); };
  function campBody(data, gal, put) {
    const v1 = data.v !== VERSION, rl = ROW[v1 ? 0 : 1], row = (id) => { const r = isObj(data.best) && Array.isArray(data.best[id]) ? data.best[id] : []; for (let k = 0; k < rl; k++) put(r[k]); };
    const opt = (has, v) => put(has ? whole(v, MAXCOINS * 1e9) + 1 : 0); // format 1: a field an old save may lack (0: none)
    put(v1 ? 1 : VERSION); if (v1) opt(own(data, "coins"), data.coins); else put(data.coins); put(POWERS.length); for (const k of POWERS) put(data.inv && data.inv[k]);
    let g = 0; POWERS.forEach((k, i) => { if (data.got && data.got[k] === 1) g += 1 << i; }); put(g);
    const done = Object.keys(data.done || {}).map((id) => [slotOf(id), id]).filter((x) => x[0] > 0).sort((p, q) => p[0] - q[0]);
    put(done.length); let at = 0; for (const [s, id] of done) { put(s - at); at = s; if (v1) put(data.done[id]); row(id); }
    const pics = (gal || []).map((id, i) => [i + 1, id]).filter((x) => own(data.gal || {}, x[1]));
    put(pics.length); at = 0; for (const [s, id] of pics) { put(s - at); at = s; if (v1) put(data.gal[id]); row(id); }
    const eggs = Object.keys(data.eggs || {}).filter((k) => EGG.test(k)); put(eggs.length); for (const k of eggs) { const m = /^s(\d+)-(\d+)$/.exec(k); put(+m[1]); put(+m[2]); }
    put(typeof data.last === "string" ? slotOf(data.last) : 0); if (v1) opt(isObj(data.lives), data.lives && data.lives.n); else put(data.lives && data.lives.n); put(data.lives && data.lives.at);
  }
  function encode(data, gal) { const w = writer(); campBody(data, gal, w.put); return seal(w.b, CODE); }
  // v6: the SP2 code of both modes. cdata: the Campaign save's data; zdata: the Zen save's; gal: every gallery.json id in
  // order; zl: the Zen levels [{id, w (its world), n (its number in the world)}].
  function encode2(cdata, zdata, gal, zl) {
    const w = writer(), put = w.put, at = new Map(zl.map((x) => [x.id, x])), row = (id) => { const r = isObj(zdata.best) && Array.isArray(zdata.best[id]) ? zdata.best[id] : []; for (let k = 0; k < 3; k++) put(r[k]); };
    campBody(cdata, gal, put); put(ZVERSION);
    const done = Object.keys(zdata.done || {}).filter((id) => at.has(id)).map((id) => at.get(id)).sort((p, q) => p.w - q.w || p.n - q.n);
    put(done.length); for (const x of done) { put(x.w); put(x.n); row(x.id); }
    const pics = (gal || []).map((id, i) => [i + 1, id]).filter((x) => own(zdata.gal || {}, x[1])); put(pics.length); for (const [s, id] of pics) { put(s); row(id); }
    const eggs = Object.keys(zdata.eggs || {}).filter((k) => ZEGG.test(k)); put(eggs.length); for (const k of eggs) { const m = /^z(\d+)-(\d+)-(\d+)$/.exec(k); put(+m[1]); put(+m[2]); put(+m[3]); }
    const l = at.get(zdata.last); put(l ? l.w : 0); put(l ? l.n : 0);
    return seal(w.b, CODE2);
  }
  // The Campaign part of a code, read from get() (raw, unsanitized).
  function campRead(get, order, gal) {
    const v = get(); if (v !== 1 && v !== VERSION) return null;
    const raw = { v, inv: {}, got: {}, done: {}, gal: {}, best: {}, eggs: {} }, rl = ROW[v === 1 ? 0 : 1], bySl = new Map(), opt = (f) => { const x = get(); if (v !== 1) f(x); else if (x) f(x - 1); };
    opt((x) => { raw.coins = x; });
    for (const id of order || []) if (slotOf(id)) bySl.set(slotOf(id), id);
    const ni = get(); for (let i = 0; i < ni; i++) { const x = get(); if (i < POWERS.length) raw.inv[POWERS[i]] = x; }
    const g = get(); POWERS.forEach((k, i) => { if (Math.floor(g / 2 ** i) % 2) raw.got[k] = 1; });
    const entries = (into, name) => { const cnt = get(); let at = 0; for (let i = 0; i < cnt; i++) { at += get(); const id = name(at), mk = v === 1 ? get() : 1, r = []; for (let k = 0; k < rl; k++) r.push(get()); if (id) { into[id] = mk; raw.best[id] = r; } } };
    entries(raw.done, (s) => bySl.get(s) || "e0-" + s); entries(raw.gal, (s) => (gal || [])[s - 1] || null);
    const ne = get(); for (let i = 0; i < ne; i++) { const sh = get(), k = get(); raw.eggs["s" + sh + "-" + k] = 1; }
    const ls = get(); if (ls) raw.last = bySl.get(ls) || "e0-" + ls; let ln = -1; opt((x) => { ln = x; }); const la = get(); if (ln >= 0) raw.lives = { n: ln, at: la };
    return raw;
  }
  // Read a pasted code: {ok: true, data (sanitized, the device's preferences from prefs), v} or {ok: false, err}: "empty",
  // "prefix" (not a save code), "newer" (a later code format), "broken" (a changed, missing or extra character), "body"
  // (a checksum that matches a body this page can't read). Whitespace anywhere is ignored (codes get wrapped). Never throws.
  // v6: decodeAny(text, order, gal, meta, prefs, maxLen, Z) also reads SP2 (Z: {order, gal, zl} of the Zen mode): {ok,
  // code (1 or 2), data (the Campaign), zen (the Zen data, sanitized; null for an SP1 code)}. decode() stays SP1 only.
  function decode(text, order, gal, meta, prefs, maxLen) { const r = decodeAny(text, order, gal, meta, prefs, maxLen, null); return r.ok && r.code !== 1 ? { ok: false, err: "newer" } : r; }
  function decodeAny(text, order, gal, meta, prefs, maxLen, Z) {
    try {
      const t = String(text == null ? "" : text).slice(0, maxLen || 20000).replace(/\s+/g, ""); if (!t) return { ok: false, err: "empty" };
      const m = /^SP(\d+)\.(.*)$/i.exec(t); if (!m) return { ok: false, err: "prefix" }; const cv = +m[1]; if (cv !== 1 && !(cv === 2 && Z)) return { ok: false, err: cv > 1 ? "newer" : "prefix" };
      const b = unb64(m[2]); if (!b || b.length < 5 || b64(b) !== m[2]) return { ok: false, err: "broken" };
      const n = b.length - 4, c = ((b[n] << 24) | (b[n + 1] << 16) | (b[n + 2] << 8) | b[n + 3]) >>> 0; if (crc32(b, n) !== c) return { ok: false, err: "broken" };
      let p = 0; const get = () => { let v = 0, f = 1; for (let k = 0; k < 8; k++) { if (p >= n) throw new Error("short"); const x = b[p++]; v += (x & 127) * f; if (x < 128) return v; f *= 128; } throw new Error("long"); };
      const raw = campRead(get, order, gal); if (!raw) return { ok: false, err: "body" };
      let zraw = null;
      if (cv === 2) { if (get() !== ZVERSION) return { ok: false, err: "body" }; const byWN = new Map(Z.zl.map((x) => [x.w + "," + x.n, x.id])), row = () => [get(), get(), get()];
        zraw = { v: ZVERSION, done: {}, gal: {}, eggs: {}, best: {}, moved: 1 };
        const nd = get(); for (let i = 0; i < nd; i++) { const id = byWN.get(get() + "," + get()), r = row(); if (id) { zraw.done[id] = 1; zraw.best[id] = r; } }
        const ng = get(); for (let i = 0; i < ng; i++) { const id = (gal || [])[get() - 1], r = row(); if (id) { zraw.gal[id] = 1; zraw.best[id] = r; } }
        const ne = get(); for (let i = 0; i < ne; i++) zraw.eggs["z" + get() + "-" + get() + "-" + get()] = 1;
        const lw = get(), lnn = get(); if (lw) zraw.last = byWN.get(lw + "," + lnn) || null; }
      if (p !== n) return { ok: false, err: "body" };
      const data = withPrefs(sanitize(raw, order, gal, meta), prefs ? { settings: prefs } : null);
      return { ok: true, v: raw.v, code: cv, data, zen: zraw ? zenSanitize(zraw, Z.order, Z.gal) : null };
    } catch (e) { return { ok: false, err: "body" }; }
  }

  // ---- v6 lane B: the Zen save ------------------------------------------------------------------------------------------
  const ZVERSION = 1, ZEGG = /^z\d{1,2}-\d{1,3}-\d{1,2}$/, CODE2 = "SP2.", WALLET = ["coins", "inv", "got", "lives", "settings"], MODES = ["campaign", "zen"];
  const zenFresh = () => ({ v: ZVERSION, done: {}, gal: {}, eggs: {}, best: {}, last: null, moved: 0, mode: "campaign" });
  // order: the Zen levels in play order (with starts); gal: its pictures. Unknown ids dropped; never throws.
  function zenSanitize(raw, order, gal) {
    const s = zenFresh(); if (!isObj(raw)) return s;
    try {
      const d = isObj(raw.done) ? raw.done : {}, g = isObj(raw.gal) ? raw.gal : {}, best = isObj(raw.best) ? raw.best : {}, eg = isObj(raw.eggs) ? raw.eggs : {};
      for (const id of order || []) if (d[id] === 1) s.done[id] = 1;
      for (const id of gal || []) if (g[id] === 1) s.gal[id] = 1;
      for (const id of Object.keys(s.done).concat(Object.keys(s.gal))) { const b = own(best, id) && Array.isArray(best[id]) ? best[id] : null; if (!b) continue; const row = [whole(b[0], MAXMS), whole(b[1], MAXTAPS), whole(b[2], MAXCOINS)]; if (row.some((v) => v > 0)) s.best[id] = row; }
      for (const k of Object.keys(eg).slice(0, MAXEGGS)) if (ZEGG.test(k) && eg[k] === 1) s.eggs[k] = 1;
      if (typeof raw.last === "string" && isOpen(s, order || [], raw.last)) s.last = raw.last;
      if (raw.moved === 1) s.moved = 1; if (MODES.indexOf(raw.mode) >= 0) s.mode = raw.mode;
      return s;
    } catch (e) { return zenFresh(); }
  }
  // The Zen data object the page plays on: d (sanitized) with the wallet's fields as accessors onto wallet() (not enumerable).
  function zenView(d, wallet) { for (const k of WALLET) Object.defineProperty(d, k, { get: () => wallet()[k], set: (v) => { wallet()[k] = v; }, enumerable: false, configurable: true }); return d; }
  function openZen(store, key, order, gal, wallet, campSave) {
    let data = zenFresh();
    try { const raw = store.getItem(key); if (raw) data = zenSanitize(JSON.parse(raw), order, gal); } catch (e) { data = zenFresh(); }
    return { key, store, zen: true, data: zenView(data, wallet), wallet,
      write() { let ok = true; try { store.setItem(key, JSON.stringify(this.data)); } catch (e) { ok = false; } const c = campSave && campSave(); return (c ? c.write() : true) && ok; } };
  }
  // The one-time move (header). Returns how many entries it added.
  function zenMove(camp, zen, spec) {
    let n = 0; const cd = (camp && camp.done) || {}, cg = (camp && camp.gal) || {}, cb = (camp && camp.best) || {}, ce = (camp && camp.eggs) || {};
    const set = (map, id) => { if (map[id] !== 1) { map[id] = 1; n++; } }, best = (id) => { if (Array.isArray(cb[id]) && !zen.best[id]) zen.best[id] = cb[id].slice(0, 3); };
    for (const [g, z] of spec.pics || []) if (cleared(cg, g)) set(zen.done, z);
    for (const id of spec.levels || []) if (cleared(cd, id)) { set(zen.done, id); best(id); }
    for (const id of spec.quests || []) if (cleared(cg, id)) { set(zen.gal, id); best(id); }
    for (const [c, z] of spec.eggs || []) if (ce[c] === 1) set(zen.eggs, z);
    if (!zen.last && camp && (spec.levels || []).indexOf(camp.last) >= 0) zen.last = camp.last;
    zen.moved = 1; return n;
  }
  // v6 fix pass: the Campaign's progress cleared with the SHARED WALLET kept (coins, inv, got, lives) and the preferences;
  // the cloud hook is not told (only a full reset clears a portal's cloud copy). A full reset is reset() plus resetZen().
  function resetCampaign(sv, meta) { const w = sv.data, s = withPrefs(fresh(meta), w); for (const k of ["coins", "inv", "got", "lives"]) s[k] = JSON.parse(JSON.stringify(w[k])); sv.data = s; return sv.write(); }
  // Zen reset: Zen progress cleared (the move's flag and the mode kept), the wallet and the Campaign untouched.
  function resetZen(sv) { const d = zenFresh(); d.moved = 1; d.mode = sv.data.mode; sv.data = zenView(d, sv.wallet); return sv.write(); }

  return { VERSION, fresh, sanitize, record, next, nextBy, isOpen, questOpen, memoryStore, open, reset, cloud, withPrefs, encode, decode, CODE,
    ZVERSION, CODE2, resetCampaign, zenFresh, zenSanitize, zenView, openZen, zenMove, resetZen, encode2, decodeAny }; // v6 lane B
});
