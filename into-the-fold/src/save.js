// Into the Fold save (SPEC §7). One versioned localStorage key ("intothefold.save.v1", from config.save.key).
// Every field is sanitized on load, so a stale or hand-edited save can never break the game. UMD like rules.js.
// Fields: tutorialSeen; sound (on/off); hints (first-time element hints already shown); stats (daily only);
// daily (the in-progress or finished daily, as its action log, so a reload replays it exactly); practice (next index).
// Stats helpers are pure here so Node can check the streak and histogram maths.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.IntoTheFold = root.IntoTheFold || {}).save = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1;
  const HINTS = ["mud", "black", "pond"];
  // Safety bounds for sanitize(); config.save.limits overrides them.
  const LIMITS = { maxCount: 1e7, maxLog: 20000, buckets: 6, maxId: 40 };
  const LOG_RE = /^[NESWur]*$/;

  function freshStats(buckets) { return { hist: new Array(buckets).fill(0), streak: 0, maxStreak: 0, lastN: 0 }; }

  function fresh(limits) {
    const L = Object.assign({}, LIMITS, limits);
    return { v: VERSION, tutorialSeen: false, sound: true, hints: { mud: false, black: false, pond: false }, stats: freshStats(L.buckets), daily: null, practice: { index: 0 } };
  }

  // A whole number in [0, max], or 0.
  function count(v, max) { return typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0; }

  function sanitize(raw, limits) {
    const L = Object.assign({}, LIMITS, limits), s = fresh(L);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return s;
    s.tutorialSeen = raw.tutorialSeen === true;
    s.sound = raw.sound !== false;
    const h = raw.hints && typeof raw.hints === "object" ? raw.hints : {};
    for (const k of HINTS) s.hints[k] = h[k] === true;
    const st = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
    if (Array.isArray(st.hist)) for (let k = 0; k < L.buckets; k++) s.stats.hist[k] = count(st.hist[k], L.maxCount);
    s.stats.lastN = count(st.lastN, L.maxCount);
    s.stats.maxStreak = Math.min(count(st.maxStreak, L.maxCount), played(s.stats));
    s.stats.streak = Math.min(count(st.streak, L.maxCount), s.stats.maxStreak, played(s.stats));
    if (!s.stats.lastN) s.stats.streak = 0;
    const d = raw.daily;
    if (d && typeof d === "object" && typeof d.id === "string" && d.id.length <= L.maxId && typeof d.log === "string" && d.log.length <= L.maxLog && LOG_RE.test(d.log)) {
      const n = count(d.n, L.maxCount);
      if (n >= 1) s.daily = { n, id: d.id, log: d.log };
    }
    const p = raw.practice && typeof raw.practice === "object" ? raw.practice : {};
    s.practice.index = count(p.index, L.maxCount);
    return s;
  }

  // ---- stats (pure) ---------------------------------------------------------------------------------------------
  function played(st) { let n = 0; for (let k = 0; k < st.hist.length; k++) n += st.hist[k]; return n; }

  // Histogram bucket for a finish `over` par: 0 = par or under, then +1 … the last bucket holds everything beyond.
  function bucket(over, buckets) { return over <= 0 ? 0 : Math.min(buckets - 1, over); }

  // Record a finished daily #n. The streak runs over consecutive puzzle numbers (= consecutive local dates), so a
  // daily finished after midnight still counts for its own day. Returns false if #n was already recorded.
  function recordDaily(st, n, swipes, par) {
    if (n <= st.lastN) return false;
    st.hist[bucket(swipes - par, st.hist.length)]++;
    st.streak = st.lastN > 0 && st.lastN === n - 1 ? st.streak + 1 : 1;
    if (st.streak > st.maxStreak) st.maxStreak = st.streak;
    st.lastN = n;
    return true;
  }

  // The streak as of puzzle #todayN: alive if the last finish was today's or yesterday's puzzle, otherwise broken.
  function streakNow(st, todayN) { return st.lastN > 0 && todayN - st.lastN <= 1 ? st.streak : 0; }

  // Par-or-better share, whole percent (0 before the first finish).
  function parPct(st) { const p = played(st); return p ? Math.round((100 * st.hist[0]) / p) : 0; }

  // A storage that lives in memory only: selfTest's scratch namespace, and the fallback when localStorage throws
  // (Safari private mode, blocked site data).
  function memoryStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  }

  // Open the save at `key` in `store`. Returns {key, store, data, write()}; write() never throws.
  function open(store, key, limits) {
    let data = fresh(limits);
    try { const raw = store.getItem(key); if (raw) data = sanitize(JSON.parse(raw), limits); } catch (e) { data = fresh(limits); }
    return { key, store, data, write() { try { store.setItem(key, JSON.stringify(this.data)); return true; } catch (e) { return false; } } };
  }

  return { VERSION, HINTS, LIMITS, fresh, sanitize, played, bucket, recordDaily, streakNow, parPct, memoryStore, open };
});
