// Sapper's Path v3 grader (SPEC-v3 §5 grading). Every number comes from the caller's config. Every game is played
// patiently (SPEC-v3 §9, the dispatch model): tap, run the engine until nothing moves, tap again.
//   rate(B, rules, n, seed)            random-tap win rate: n seeded playouts, each tap a uniform pick of a legal column
//   greedy(B, rules, n, seed)          one-move-lookahead player's win rate (a human proxy)
//   orders(B, rules, cap, nodes)       capped count of winning tap orders (memoised DFS over whole-game states)
//   solve(B, rules, nodes, hint)       one winning order (DFS; tries `hint` first), or null
//   narrow(B, rules, order, nodes)     safe taps per turn along a winning line (forced turns = exactly one safe tap)
//   line(B, rules, order)              patient replay: {won, reason, peak, len, ms (engine time to the end)}
//   fast(B, rules, n, seed, gapMs)     v4 M2: the fast tapper's win rate (taps whenever a tap is legal, never waits for rest)
//   view(S) / look(S, ...)             v4 M2: what the player can see of the tray, and the lookahead player's scores
//   plan(B, rules, n, seed, k, seeing) v4 M3: the sampling planner's win rate, honest about mystery cards or all-seeing
//   pace(B, rules, order, thinkMs)     v4.2: the real-pace replay of a winning order: {won, ms, taps} (below)
// v4 M2: every player picks only among legal taps (a front card whose tap would not be refused: a free space, or 2 for a
// linked card), so a stored order never holds a refused tap. On a level without links a patient player never meets a
// refused tap (a line with no room at rest is already a jam), so every number there is the same as before.
// All loops are bounded by the node budgets, the deck size and the event count.
"use strict";
const E = require("../src/engine.js");

const rng = (s) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// A legal tap: column j has a front card and its tap would not be refused.
const legal = (S, j) => S.heads[j] < S.B.colLen[j] && !S.refused(j);

function rate(B, rules, n, seed, S) {
  S = S || E.sim(B, rules);
  const open = new Int32Array(E.NCOL);
  let wins = 0;
  for (let k = 0; k < n; k++) {
    S.reset(); const r = rng((seed | 0) + k * 7919);
    for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
      let c = 0; for (let j = 0; j < E.NCOL; j++) if (legal(S, j)) open[c++] = j;
      if (!c) break;
      S.play(open[Math.floor(r() * c)]); S.quiet();
    }
    if (S.status === E.WON) wins++;
  }
  return wins / n;
}

// What the player can see of the tray (v4 M2), as a plain object: cols[j] = the cards still in column j, front first,
// each [mat, count, partner card or -1] with mat 0 for a hidden mystery card (its count and its rod show); unseen[m] =
// the sappers of colour m the player hasn't seen on a card yet: the board's starting pixels of m less every card of m
// already seen (played, pulled, or in view). The deal sums each colour's cards to its pixels, so this is what a player
// can count. The lookahead player reads the tray only through this.
function view(S) {
  const B = S.B, seen = new Int32Array(E.NMAT), unseen = new Int32Array(E.NMAT), cols = [];
  for (let ci = 0; ci < B.ncards; ci++) if (!S.hidden(ci)) seen[B.cardM[ci]] += B.cardN[ci];
  for (let m = 1; m < E.NMAT; m++) if (m !== E.IRON) unseen[m] = Math.max(0, B.pix[m] - seen[m]);
  for (let j = 0; j < E.NCOL; j++) { const col = []; for (let d = 0, ci = S.card(j, 0); ci >= 0; ci = S.card(j, ++d)) col.push([S.hidden(ci) ? 0 : B.cardM[ci], B.cardN[ci], S.partner(ci)]); cols.push(col); }
  return { cols, unseen };
}

// The lookahead player's score for each column (lower is better): -1 a win, 1e6 a fail, else the holding line's length
// once nothing moves; Infinity for a column it can't tap. Only one thing a tap does depends on a hidden colour: a linked
// front card whose partner is still hidden. That tap is scored from the view: the mean of its outcome with the partner
// played as each colour it could be (every colour with at least the partner's count unseen), weighted by the unseen
// count of that colour. (The trial swaps the card's colour in B for the one trial and puts it back; the sim's per-colour
// sapper totals keep the real colour, which only matters to a Hard kill, and the player is graded on Normal.) With the
// comparison flag mergeLeftovers off, nothing else in a one-tap trial reads a colour the player can't see: the new
// front's colour never changes the outcome (a refusal and a jam depend only on free spaces and links).
function look(S, buf, out) {
  const B = S.B; S.save(buf);
  let u = null;
  for (let j = 0; j < E.NCOL; j++) {
    out[j] = Infinity; if (!legal(S, j)) continue;
    const ci = S.front(j), p = S.partner(ci);
    if (p < 0 || !S.hidden(p)) { S.play(j); S.quiet(); out[j] = score(S); S.load(buf); continue; }
    if (!u) u = view(S).unseen;
    const real = B.cardM[p], k = B.cardN[p]; let sum = 0, wsum = 0;
    for (let pass = 0; pass < 2 && !wsum; pass++) for (let m = 1; m < E.NMAT; m++) {
      const wt = pass ? (S.left[m] > 0 ? 1 : 0) : u[m] >= k ? u[m] : 0; if (!wt || m === E.IRON) continue; // pass 1: any colour on the board
      B.cardM[p] = m; S.play(j); S.quiet(); sum += wt * score(S); wsum += wt; S.load(buf); B.cardM[p] = real;
    }
    out[j] = wsum ? sum / wsum : 1e6;
  }
  return out;
}
const score = (S) => (S.status === E.WON ? -1 : S.status === E.FAILED ? 1e6 : S.lineLen);

// One-move-lookahead player (a human proxy): skip taps that fail at once, prefer the shortest holding line after the
// tap, seeded random among ties. Returns its win rate over n games. v4 M2: it scores taps with look() (never a hidden
// colour).
function greedy(B, rules, n, seed) {
  const S = E.sim(B, rules), buf = new Int32Array(S.M.length), best = new Int32Array(E.NCOL), sc = new Float64Array(E.NCOL);
  let wins = 0;
  for (let k = 0; k < n; k++) {
    S.reset(); const r = rng((seed | 0) + k * 104723);
    for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
      look(S, buf, sc); let nb = 0, bl = 1e9;
      for (let j = 0; j < E.NCOL; j++) { const v = sc[j]; if (v === Infinity) continue; if (v < bl) { bl = v; nb = 0; } if (v === bl) best[nb++] = j; }
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
      if (!legal(S, j)) continue;
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
      if (!legal(S, j)) continue;
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

// Narrowness of a winning line: at every turn of `order`, how many of the legal columns still leave a won game
// reachable (each checked by solve with `nodes`). Returns {turns, forced (turns with exactly one safe tap), minSafe,
// meanSafe, unknown (checks that ran out of budget; counted as unsafe)}.
function narrow(B, rules, order, nodes) {
  const S = E.sim(B, rules), buf = new Int32Array(S.M.length), kid = new Int32Array(S.M.length);
  let forced = 0, minSafe = 9, sum = 0, unknown = 0, turns = 0;
  for (let t = 0; t < order.length && S.status === E.PLAYING; t++) {
    S.save(buf); let safe = 0, open = 0;
    for (let j = 0; j < E.NCOL; j++) {
      if (!legal(S, j)) continue; open++;
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

// v4 M3: maxWait is the dead-time measure, the longest single tap from the tap until nothing moves.
function line(B, rules, order) {
  const S = E.sim(B, rules); let maxWait = 0;
  for (let i = 0; i < order.length && S.status === E.PLAYING; i++) { const t0 = S.now; if (S.play(order.charCodeAt(i) - 48) < -1) break; S.quiet(); if (S.now - t0 > maxWait) maxWait = S.now - t0; }
  S.quiet();
  return { won: S.status === E.WON, reason: S.reason, peak: S.peak, len: order.length, hits: S.hits, kills: S.kills, ms: S.now, maxWait };
}

// The fast tapper (v4 M2; the plan's "taps whenever a squad can go", the limit of tools/rush.js's rushed player): the
// moment any front card's tap is legal it taps one (a seeded uniform pick among the legal ones), and when none is it
// waits for the next event, never for rest. gapMs: the least engine time between two taps (a thumb; 0 = the same
// instant). Returns its win rate over n games. Bounded: every pass taps a card or moves to the next event.
function fast(B, rules, n, seed, gapMs) {
  const S = E.sim(B, rules), open = new Int32Array(E.NCOL), gap = Math.max(0, gapMs | 0), cap = 8 * (B.pixTotal + B.ncards) + 64;
  let wins = 0;
  for (let k = 0; k < n; k++) {
    S.reset(); const r = rng((seed | 0) + k * 6151); let t = 0;
    for (let guard = 0; guard < cap && S.status === E.PLAYING; guard++) {
      S.advanceTo(t); if (S.status !== E.PLAYING) break;
      let c = 0, any = false; for (let j = 0; j < E.NCOL; j++) { if (S.heads[j] < B.colLen[j]) any = true; if (legal(S, j)) open[c++] = j; }
      if (c) { S.play(open[Math.floor(r() * c)]); t = S.now + gap; continue; }
      if (!any || !S.busy) break; // out of cards, or at rest with every tap refused (the engine has already called the jam)
      t = Math.max(t, S.nextAt);
    }
    S.quiet(); if (S.status === E.WON) wins++;
  }
  return wins / n;
}

// The sampling planner (v4 M3, the bake-speed version of M2's proposal). At each turn with a choice it scores every legal
// tap by k rollouts: in each, the hidden cards take colours drawn from what the player hasn't seen (each card on its own: a
// colour with at least its count unseen, weighted by the unseen count, as look() does), then the tap, then the one-move-
// lookahead player to the end. A rollout scores the share of the fort razed (1 = a win); the planner plays the best tap
// (seeded ties). seeing: it knows the true colours (the same k rollouts, each on its own lookahead seed). Returns its win
// rate over n games. The gap between the honest and the seeing planner is what the "?" cards cost a player who reads the
// board and the tray but doesn't count every pixel. Bounded: turns by the deck, rollouts by the lookahead's own guard.
function plan(B, rules, n, seed, k, seeing) {
  const S = E.sim(B, rules), top = new Int32Array(S.M.length), lb = new Int32Array(S.M.length), sc = new Float64Array(E.NCOL), gs = new Float64Array(E.NCOL), gb = new Int32Array(E.NCOL);
  const real = Int32Array.from(B.cardM), hid = [], w = new Float64Array(E.NMAT);
  let wins = 0;
  const rollout = (r) => {
    for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
      look(S, lb, gs); let nb = 0, bl = 1e9;
      for (let j = 0; j < E.NCOL; j++) { const v = gs[j]; if (v === Infinity) continue; if (v < bl) { bl = v; nb = 0; } if (v === bl) gb[nb++] = j; }
      if (!nb) break;
      S.play(gb[Math.floor(r() * nb)]); S.quiet();
    }
    return S.status === E.WON ? 1 : 1 - S.pixLeft / B.pixTotal;
  };
  try {
    for (let g = 0; g < n; g++) {
      S.reset(); const r = rng((seed | 0) + g * 7727);
      for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
        let nl = 0, only = -1; for (let j = 0; j < E.NCOL; j++) if (legal(S, j)) { nl++; only = j; }
        if (!nl) break;
        if (nl > 1) {
          S.save(top); hid.length = 0; for (let ci = 0; ci < B.ncards; ci++) if (S.hidden(ci)) hid.push(ci);
          const u = hid.length && !seeing ? view(S).unseen : null; sc.fill(0);
          for (let s = 0; s < k; s++) {
            if (u) for (const ci of hid) { let tot = 0; for (let m = 1; m < E.NMAT; m++) { w[m] = m !== E.IRON && u[m] >= B.cardN[ci] ? u[m] : 0; tot += w[m]; }
              if (!tot) for (let m = 1; m < E.NMAT; m++) { w[m] = m !== E.IRON && S.left[m] > 0 ? 1 : 0; tot += w[m]; }
              let x = r() * tot, m = 1; for (; m < E.NMAT - 1 && x >= w[m]; m++) x -= w[m]; B.cardM[ci] = tot ? m : real[ci]; }
            for (let j = 0; j < E.NCOL; j++) { if (!legal(S, j)) continue; S.play(j); S.quiet(); sc[j] += rollout(r); S.load(top); }
            if (u) for (const ci of hid) B.cardM[ci] = real[ci];
          }
          let bj = -1, bs = -1, nt = 0; for (let j = 0; j < E.NCOL; j++) { if (!legal(S, j)) continue; if (sc[j] > bs + 1e-9) { bs = sc[j]; bj = j; nt = 1; } else if (Math.abs(sc[j] - bs) <= 1e-9 && r() < 1 / ++nt) bj = j; }
          only = bj;
        }
        S.play(only); S.quiet();
      }
      if (S.status === E.WON) wins++;
    }
  } finally { B.cardM.set(real); }
  return wins / n;
}

// v4.2, the real-pace player (Peter's pace, not the patient grader's): the stored order replayed, each next card tapped the
// moment its tap is legal (a free space, the tap not refused), and never sooner than thinkMs of engine time after the tap
// before (the player's own thinking, calibrated against Peter's times: tools/v4.2-notes.md). Returns {won, ms, taps};
// won false when the early taps lose the level or leave the next tap refused at rest (the caller falls back to the
// patient time and logs it). Bounded: every pass taps a card or moves to the next event.
function pace(B, rules, order, thinkMs) {
  const S = E.sim(B, rules), cap = 8 * (B.pixTotal + B.ncards) + 64, think = Math.max(0, thinkMs | 0);
  let i = 0, t = 0;
  for (let guard = 0; guard < cap && S.status === E.PLAYING && i < order.length; guard++) {
    S.advanceTo(t); if (S.status !== E.PLAYING) break;
    const j = order.charCodeAt(i) - 48;
    if (legal(S, j)) { S.play(j); i++; t = S.now + think; continue; }
    if (!S.busy || S.nextAt < 0) break; // at rest with the next tap refused: the replay is stuck
    t = Math.max(t, S.nextAt);
  }
  S.quiet();
  return { won: S.status === E.WON && i === order.length, ms: S.now, taps: i };
}

module.exports = { rate, greedy, orders, solve, narrow, line, fast, view, look, plan, pace, legal, rng };
