// Sapper's Path v3 grader (SPEC-v3 §5 grading). Every number comes from the caller's config. Every game is played
// patiently (SPEC-v3 §9, the dispatch model): tap, run the engine until nothing moves, tap again.
//   rate(B, rules, n, seed)            random-tap win rate: n seeded playouts, each tap a uniform pick of a non-empty column
//   greedy(B, rules, n, seed)          one-move-lookahead player's win rate (a human proxy)
//   orders(B, rules, cap, nodes)       capped count of winning tap orders (memoised DFS over whole-game states)
//   solve(B, rules, nodes, hint)       one winning order (DFS; tries `hint` first), or null
//   narrow(B, rules, order, nodes)     safe taps per turn along a winning line (forced turns = exactly one safe tap)
//   line(B, rules, order)              patient replay: {won, reason, peak, len, ms (engine time to the end)}
// All loops are bounded by the node budgets and the deck size.
"use strict";
const E = require("../src/engine.js");

const rng = (s) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function rate(B, rules, n, seed, S) {
  S = S || E.sim(B, rules);
  const open = new Int32Array(E.NCOL);
  let wins = 0;
  for (let k = 0; k < n; k++) {
    S.reset(); const r = rng((seed | 0) + k * 7919);
    for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
      let c = 0; for (let j = 0; j < E.NCOL; j++) if (S.heads[j] < B.colLen[j]) open[c++] = j;
      if (!c) break;
      S.play(open[Math.floor(r() * c)]); S.quiet();
    }
    if (S.status === E.WON) wins++;
  }
  return wins / n;
}

// One-move-lookahead player (a human proxy): skip taps that fail at once, prefer the shortest holding line after the
// tap, seeded random among ties. Returns its win rate over n games.
function greedy(B, rules, n, seed) {
  const S = E.sim(B, rules), buf = new Int32Array(S.M.length), best = new Int32Array(E.NCOL);
  let wins = 0;
  for (let k = 0; k < n; k++) {
    S.reset(); const r = rng((seed | 0) + k * 104723);
    for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
      S.save(buf); let nb = 0, bl = 1e9;
      for (let j = 0; j < E.NCOL; j++) {
        if (S.heads[j] >= B.colLen[j]) continue;
        S.play(j); S.quiet(); const v = S.status === E.WON ? -1 : S.status === E.FAILED ? 1e6 : S.lineLen; S.load(buf);
        if (v < bl) { bl = v; nb = 0; } if (v === bl) best[nb++] = j;
      }
      if (!nb) break;
      S.play(best[Math.floor(r() * nb)]); S.quiet();
    }
    if (S.status === E.WON) wins++;
  }
  return wins / n;
}

// Count winning orders, capped. Memo on the whole-state hash; a capped subtotal is a lower bound, which is all a capped
// count needs. Returns {count, exact, nodes}: exact false when the node budget ran out first.
function orders(B, rules, cap, nodes) {
  const S = E.sim(B, rules), memo = new Map(), depth = B.ncards + 1;
  const bufs = Array.from({ length: depth + 1 }, () => new Int32Array(S.M.length));
  let used = 0, out = false;
  function dfs(k) {
    if (S.status === E.WON) return 1;
    if (S.status !== E.PLAYING) return 0;
    const hsh = S.hash(), got = memo.get(hsh); if (got !== undefined) return got;
    if (++used > nodes) { out = true; return 0; }
    let total = 0; S.save(bufs[k]);
    for (let j = 0; j < E.NCOL && total < cap; j++) {
      if (S.heads[j] >= B.colLen[j]) continue;
      S.play(j); S.quiet(); total += dfs(k + 1); S.load(bufs[k]);
      if (out) break;
    }
    if (total > cap) total = cap;
    if (!out) memo.set(hsh, total);
    return total;
  }
  const count = Math.min(cap, dfs(0));
  return { count, exact: !out && count < cap, capped: count >= cap, nodes: used };
}

// One winning order. Children tried in order: the hint's move first, then by the shortest holding line after the move.
// from: an optional state buffer to start from (a mid-game position); the order returned starts there.
function solve(B, rules, nodes, hint, from) {
  const S = E.sim(B, rules), dead = new Set(), depth = B.ncards + 1, path = [];
  if (from) S.load(from);
  const bufs = Array.from({ length: depth + 1 }, () => new Int32Array(S.M.length));
  let used = 0;
  function dfs(k) {
    if (S.status === E.WON) return true;
    if (S.status !== E.PLAYING || ++used > nodes) return false;
    const hsh = S.hash(); if (dead.has(hsh)) return false;
    S.save(bufs[k]);
    const kids = [];
    for (let j = 0; j < E.NCOL; j++) {
      if (S.heads[j] >= B.colLen[j]) continue;
      S.play(j); S.quiet(); if (S.status !== E.FAILED) kids.push([j, S.status === E.WON ? -1 : S.lineLen]); S.load(bufs[k]);
    }
    const hj = hint && k < hint.length ? hint.charCodeAt(k) - 48 : -1;
    kids.sort((p, q) => (q[0] === hj) - (p[0] === hj) || p[1] - q[1] || p[0] - q[0]);
    for (const [j] of kids) {
      S.play(j); S.quiet(); path.push(j);
      if (dfs(k + 1)) return true;
      path.pop(); S.load(bufs[k]);
      if (used > nodes) return false;
    }
    dead.add(hsh); return false;
  }
  const found = dfs(0);
  return found ? path.join("") : used > nodes ? undefined : null;
}

// Narrowness of a winning line: at every turn of `order`, how many of the open columns still leave a won game
// reachable (each checked by solve with `nodes`). Returns {turns, forced (turns with exactly one safe tap), minSafe,
// meanSafe, unknown (checks that ran out of budget; counted as unsafe)}.
function narrow(B, rules, order, nodes) {
  const S = E.sim(B, rules), buf = new Int32Array(S.M.length), kid = new Int32Array(S.M.length);
  let forced = 0, minSafe = 9, sum = 0, unknown = 0, turns = 0;
  for (let t = 0; t < order.length && S.status === E.PLAYING; t++) {
    S.save(buf); let safe = 0, open = 0;
    for (let j = 0; j < E.NCOL; j++) {
      if (S.heads[j] >= B.colLen[j]) continue; open++;
      if (j === order.charCodeAt(t) - 48) { safe++; continue; }
      S.play(j); S.quiet();
      if (S.status === E.WON) safe++;
      else if (S.status === E.PLAYING) { S.save(kid); const got = solve(B, rules, nodes, null, kid); if (got) safe++; else if (got === undefined) unknown++; }
      S.load(buf);
    }
    if (open > 1) { turns++; sum += safe; if (safe === 1) forced++; if (safe < minSafe) minSafe = safe; }
    S.play(order.charCodeAt(t) - 48); S.quiet();
  }
  return { turns, forced, minSafe: turns ? minSafe : null, meanSafe: turns ? +(sum / turns).toFixed(2) : null, unknown };
}

function line(B, rules, order) {
  const S = E.replay(B, rules, order);
  return { won: S.status === E.WON, reason: S.reason, peak: S.peak, len: order.length, hits: S.hits, kills: S.kills, ms: S.now };
}

module.exports = { rate, greedy, orders, solve, narrow, line, rng };
