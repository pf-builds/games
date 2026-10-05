// Sapper's Path meta layer (v4 M5, SPEC-v4 §9): coins, the power-up inventory, best results and lives, as pure functions
// on the save's data (save.js sanitizes it) and config.meta. Every clock is passed in (now: ms since the epoch), so Node
// can test them; the page calls them and writes the save. Never throws on a sanitized save. UMD like engine.js.
//   Coins: a win earns meta.coins.win[diff], plus meta.coins.first[diff] the first time the level (or picture) is won on
//   that difficulty (a new medal). They buy power-ups (meta.powers[k].price) one at a time into data.inv.
//   Best: data.best[id] = [ms easy, ms normal, ms hard, taps easy, taps normal, taps hard, coins earned there], 0 = none;
//   the fastest win and the fewest taps are kept apart (they can come from different runs).
//   v4.3: every level has one fixed tag (no difficulty picker), so diff below is the level's tag; a win earns
//   meta.coins.win[tag], plus meta.coins.first[tag] on the level's first clear (the medals are gone); best is [fastest ms,
//   fewest taps, coins earned there] (save format 2).
//   Lives (meta.lives; off on the web): data.lives = {n, at}. A fail costs one; while n < livesMax one comes back every
//   livesRefillMin minutes, counted from at (the moment the line first dropped below full). With n = 0 no level starts.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.SappersPath = root.SappersPath || {}).meta = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DIFFS = ["easy", "normal", "hard", "extreme"], POWERS = ["ladder", "quartermaster", "scout", "recall", "volley"]; // v5 R1: volley
  const MAXCOINS = 9999999, MAXINV = 99, MAXMS = 3600000, MAXTAPS = 999, BEST = 3; // v4.3: best = [ms, taps, coins]
  const clampInt = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : lo);
  const powerOf = (meta, k) => (meta && Array.isArray(meta.powers) ? meta.powers.find((p) => p && p.id === POWERS[k]) : null) || { id: POWERS[k], price: 0, perLevel: 0 };

  // Coins a win earns: the tag's win coins, plus its first-clear coins on the level's first clear (v4.3; a new medal before).
  function winCoins(meta, diff, first) { const C = (meta && meta.coins) || {}; return clampInt(((C.win || {})[diff] | 0) + (first ? (C.first || {})[diff] | 0 : 0), 0, MAXCOINS); }
  // Record a win of id (on its tag) after ms of play and taps plays: coins in, best time and taps, coins earned there.
  // first: the level's first clear. Returns {coins, ms, taps, best: [ms, taps] before, newMs, newTaps}.
  function recordWin(data, meta, id, tag, ms, taps, first) {
    const coins = winCoins(meta, tag, first), b = bestOf(data, id), was = [b[0], b[1]];
    ms = clampInt(ms, 1, MAXMS); taps = clampInt(taps, 1, MAXTAPS);
    const newMs = !was[0] || ms < was[0], newTaps = !was[1] || taps < was[1];
    if (newMs) b[0] = ms; if (newTaps) b[1] = taps; b[2] = clampInt(b[2] + coins, 0, MAXCOINS);
    data.best[id] = b; data.coins = clampInt((data.coins | 0) + coins, 0, MAXCOINS);
    return { coins, ms, taps, best: was, newMs, newTaps };
  }
  // A copy of id's best record (all zeros when there is none).
  function bestOf(data, id) { const b = data.best && Array.isArray(data.best[id]) ? data.best[id].slice(0, BEST) : []; while (b.length < BEST) b.push(0); return b; }
  // Buy one of power k: {ok, price, short (coins missing when not ok)}. The inventory caps at 99 (refused, nothing spent).
  function buy(data, meta, k) {
    const price = clampInt(powerOf(meta, k).price, 0, MAXCOINS), have = data.coins | 0, inv = data.inv[POWERS[k]] | 0;
    if (inv >= MAXINV) return { ok: false, price, short: 0, full: true };
    if (have < price) return { ok: false, price, short: price - have };
    data.coins = have - price; data.inv[POWERS[k]] = inv + 1;
    return { ok: true, price, short: 0 };
  }
  // v5 R1: spend price coins (a continue, 2x speed): {ok, price, short (coins missing when not ok)}; nothing spent when short.
  function spend(data, price) { price = clampInt(price, 0, MAXCOINS); const have = data.coins | 0; if (have < price) return { ok: false, price, short: price - have }; data.coins = have - price; return { ok: true, price, short: 0 }; }
  // v5 R1, unlocks: power k is open once the campaign's reach (the number of the first open Siege level not cleared, or one
  // past the last) is at least powers[k].unlockAt (missing: 1). grant() gives each newly open power-up its one free use
  // (data.got[id] = 1, data.inv[id] + 1) and returns the ks it opened, in order.
  const unlockAt = (meta, k) => Math.max(1, powerOf(meta, k).unlockAt | 0 || 1), isOpen = (meta, k, reach) => reach >= unlockAt(meta, k);
  function grant(data, meta, reach) {
    const out = []; data.got = data.got || {};
    for (let k = 0; k < POWERS.length; k++) if (isOpen(meta, k, reach) && data.got[POWERS[k]] !== 1) { data.got[POWERS[k]] = 1; data.inv[POWERS[k]] = Math.min(MAXINV, (data.inv[POWERS[k]] | 0) + 1); out.push(k); }
    return out;
  }
  // One of power k used (call after the engine took it). False when there was none.
  // v5 R2, a side quest's prize: one use of power id, kept like a bought one (the inventory caps at 99). Returns true if added.
  function gift(data, id) { const k = POWERS.indexOf(id); if (k < 0) return false; const n = data.inv[id] | 0; if (n >= MAXINV) return false; data.inv[id] = n + 1; return true; }
  // v5 R3, an easter egg on the journey map: the first tap of egg id pays coins (sanity-capped) and marks it found in the
  // save; any later tap pays nothing. Returns the coins paid.
  function egg(data, id, coins) { data.eggs = data.eggs || {}; if (data.eggs[id] === 1) return 0; const n = clampInt(coins, 0, 999); data.eggs[id] = 1; data.coins = clampInt((data.coins | 0) + n, 0, MAXCOINS); return n; }
  function take(data, k) { const n = data.inv[POWERS[k]] | 0; if (n <= 0) return false; data.inv[POWERS[k]] = n - 1; return true; }

  // Lives at time now (refilled lazily into data.lives): {on, n, max, nextMs (ms to the next life; 0 when full)}.
  function lives(data, meta, now) {
    const on = !!(meta && meta.lives), max = clampInt(meta && meta.livesMax, 1, 99), per = clampInt(meta && meta.livesRefillMin, 1, 1440) * 60000;
    if (!on) return { on: false, n: max, max, nextMs: 0 };
    const L = data.lives; L.n = clampInt(L.n, 0, max);
    if (L.n >= max) { L.at = 0; return { on, n: max, max, nextMs: 0 }; }
    if (!(L.at > 0) || L.at > now) L.at = now; // a clock that went back restarts the count
    const k = Math.floor((now - L.at) / per);
    if (k > 0) { L.n = Math.min(max, L.n + k); L.at = L.n >= max ? 0 : L.at + k * per; }
    return { on, n: L.n, max, nextMs: L.n >= max ? 0 : L.at + per - now };
  }
  // A fail: one life gone (the refill count starts if the line was full). Returns the lives after.
  function loseLife(data, meta, now) {
    const s = lives(data, meta, now); if (!s.on || s.n <= 0) return s;
    if (data.lives.n >= s.max) data.lives.at = now;
    data.lives.n = s.n - 1;
    return lives(data, meta, now);
  }
  const canStart = (data, meta, now) => lives(data, meta, now).n > 0;
  // m:ss (or h:mm:ss) for a time in ms, rounded up to the second for countdowns (up) or down for results.
  function clock(ms, up) { const t = Math.max(0, up ? Math.ceil(ms / 1000) : Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); }

  return { DIFFS, POWERS, MAXCOINS, MAXINV, MAXMS, MAXTAPS, BEST, winCoins, recordWin, bestOf, buy, spend, take, gift, egg, unlockAt, isOpen, grant, lives, loseLife, canStart, clock, powerOf };
});
