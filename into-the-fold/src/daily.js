// Into the Fold daily picker (SPEC §2). PURE: no DOM, no clock; the page passes the local date in. UMD like rules.js.
// Dates are "YYYY-MM-DD" strings for the player's LOCAL calendar day. Day arithmetic runs on Date.UTC of that
// calendar date, so a DST shift can never move a puzzle by a day.
(function (root, factory) {
  const Sym = typeof module === "object" && module.exports ? require("./sym.js") : root.IntoTheFold.sym;
  const api = factory(Sym);
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.IntoTheFold = root.IntoTheFold || {}).daily = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Sym) {
  "use strict";
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const MS_DAY = 86400000;

  const pad2 = (n) => (n < 10 ? "0" : "") + n;

  // "YYYY-MM-DD" → whole days since 1970-01-01, or null if malformed (2026-02-30 is malformed).
  function dayNumber(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = new Date(t);
    if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return Math.round(t / MS_DAY);
  }

  function dateString(dn) { const d = new Date(dn * MS_DAY); return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()); }

  // A Date's LOCAL calendar day (SPEC §2: local, not UTC).
  function localDate(date) { return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()); }

  // 0 = Monday … 6 = Sunday (1970-01-01 was a Thursday).
  function weekday(dn) { return (((dn + 3) % 7) + 7) % 7; }

  // Symmetry for pass `cycle` through a weekday pool: identity on the first pass, then the other seven in turn
  // (never identity again), keeping only those that keep w×h. Every baked board is square, so all seven qualify.
  function symFor(cycle, w, h) {
    if (cycle <= 0) return 0;
    let n = 0;
    for (let k = 1; k < 8; k++) if (Sym.keepsDims(k, w, h)) n++;
    if (!n) return 0;
    let want = (cycle - 1) % n;
    for (let k = 1; k < 8; k++) if (Sym.keepsDims(k, w, h) && want-- === 0) return k;
    return 0;
  }

  // The daily for a local date: #N counts from launch day (#1); the board is pools[weekday][k], k = how many of that
  // weekday have happened since launch. Past the bake horizon: pool[k mod len] under symmetry symFor(k div len).
  // A date before launch plays launch day's board (#1), so the header never shows a #0 or a negative number.
  function puzzleFor(dateStr, launchStr, pools) {
    const launch = dayNumber(launchStr), asked = dayNumber(dateStr);
    if (launch === null) throw new Error("bad launchDate: " + launchStr);
    if (asked === null) throw new Error("bad date: " + dateStr);
    const dn = Math.max(asked, launch), wd = weekday(dn), day = DAYS[wd], pool = pools[day];
    if (!pool || !pool.length) throw new Error("empty pool: " + day);
    const k = Math.floor((dn - launch) / 7), index = k % pool.length, cycle = Math.floor(k / pool.length);
    const base = pool[index], sym = symFor(cycle, base.w, base.h);
    const board = sym ? Object.assign(Sym.apply(sym, base), { id: base.id + "~s" + sym }) : base;
    return { n: dn - launch + 1, date: dateString(dn), asked: dateStr, weekday: wd, day, name: NAMES[wd], k, index, cycle, sym, board };
  }

  // Milliseconds from `date` to the next local midnight (the result screen's countdown, M2).
  function msToMidnight(date) { const t = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1); return t - date; }

  return { DAYS, NAMES, dayNumber, dateString, localDate, weekday, symFor, puzzleFor, msToMidnight };
});
