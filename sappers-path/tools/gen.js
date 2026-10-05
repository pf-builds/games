// Sapper's Path v3 generators (SPEC-v3 §5): seeded top-down fort plans per era, the deal by simulating a winning play
// order, and the column assignment that sets difficulty. Every number comes from tools/bake-config.json.
//
//   fort(era, seed, P, Q)     -> {w, h, grid, pic, gates, towers, pal, roles} or null: v4.1, the era's castle picture
//                                (tools/castle.js; P: the level's generator params, config eras[e]; Q: config picture)
//   deal(B, seed, D)          -> {play:[[m,n],...]} a winning play order simulated under dealing rules (D.hold spaces,
//                                archers lethal, so the order wins on Easy, Normal and Hard), or null
//                                (v4.2: with D.best > 1 each squad is the biggest of the first `best` colours that fit,
//                                so a full-screen board deals in fewer taps; 1, the default, deals as before)
//   assign(play, beta, seed)  -> colOf[] per card: round-robin mixed with contiguous chunks (beta 0 = pure round-robin,
//                                the easiest deal; 1 = five chunks of the order, the deepest)
//   colsOf(play, colOf)       -> the five tray columns;  orderOf(colOf) -> the tap order that replays `play`
// Any assignment keeps `play` a winning order: each column is a subsequence of it, so its next card is always in front.
// v4 M3 (the Siege to 100): era 4, the concentric castle; the dealer's dead-time cap and parking rules; linked pairs
//   linkUp(L, play, k, seed, D) joins consecutive plays into pairs [m1, n1, m2, n2] (one tap, two squads);
//   deck(play, colOf)          -> {cols, links, bad}: the columns with each partner placed a row from its card;
//   lockKey(L, seed)           turns a block dug in one layer into the locked space's gilt key (sets L.lock);
//   dealLine(L, play, D)       -> {won, ms, maxWait}: a play replayed patiently under dealing rules.
// v4.3, rushed dealing (D.rush; the bake sets it on a Hard level whose archers stand): a Hard kill leaves its colour
//   short, so a deal that only wins patiently is lost by a player who taps the moment a space is free. With D.rush the
//   dealt play must also win that way: a second simulation plays each squad the moment a space is free (grade.pace's
//   player, no thinking time) beside the patient one, and a squad whose rushed tap fails (run to rest with no more taps,
//   or before the next space frees) is dealt again smaller, then another colour is tried, as the dead-time cap does.
//   rushLine(L, play, D)       -> {won, ms}: a play replayed that way under dealing rules (linkUp and the tuner check it).
"use strict";
const E = require("../src/engine.js");
const { rng } = require("./grade.js");

const { GRASS, WATER, DIRT, CAMP, IRON, GILT } = E;
// v4.1: every era's fort is a castle picture (tools/castle.js), a full board of blocks seen from the front with a black
// outline, in a frame of open ground entered from the bottom. The v3/v4 top-down plans are gone (git keeps them).
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
function shuffle(r, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
// Build a fort: the era's castle picture (P: the era's generator params with P.colours; Q: bake-config picture); null when
// the plan is malformed (the caller moves on to the next seed).
function fort(era, seed, P, Q) {
  const K = require("./castle.js");
  let L; try { L = K.castle(era, seed, P, Q || require("./bake-config.json").picture); } catch (e) { return null; }
  return L || null;
}
const coloursOf = (L) => { const s = new Set(); for (const row of L.grid) for (const ch of row) { const m = E.matOf(ch); if (m && m !== IRON) s.add(m); } return s; };

// Deal by simulation: pick a colour and a squad size, play it patiently under dealing rules (D.hold spaces, archers
// lethal, D.time the engine timing), keep it if nothing fails. D: {hold, size:[lo,hi], deep, finish, maxCard, maxCards, tries, maxTaps (optional: a deal with more
// cards than this is dropped, so a level never asks for more taps)}. v4 M3: D.maxWaitMs (optional) is the dead-time cap:
// a squad whose tap keeps the siege moving longer than this (from the tap until nothing moves, patient play) is dealt
// again smaller (D.shrink of its size, up to D.shrinks times), then another colour is tried. D.park: at most this many
// squads wait on the line at rest (a squad with nothing in reach is only dealt below it). D.noParkUnderArchers: while any
// tower stands no squad may be left waiting (on Hard a waiting squad released into a ring loses a sapper, so the deal
// would fail later with no way back). A level with a lock deals with one open space fewer until its key pops.
// v4 M4 (the Gallery): D.capOf (optional) {m: [first, rest]} caps colour m's first squad at `first` and every later one at
// `rest` (the outline: a narrow first breach, then more black squads); with no capOf the deal is exactly as before.
// v5 R2: a colour lock ({colour: m}) opens when a squad of m goes out, which a deal can't count on: the dealer plays
// with the lock left shut (one space fewer, the lock dropped), so every deal wins without it.
const shut = (L, D) => (L.lock && L.lock.colour != null ? [Object.assign({}, L, { lock: null }), D.hold - (D.lockSpaces == null ? 1 : D.lockSpaces)] : [L, D.hold]);
function deal(L0, seed, D) {
  const [L, hold] = shut(L0, D), B = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)), r = rng(seed);
  const S = E.sim(B, { hold, archersKill: true, time: D.time }, { deal: true }), buf = new Int32Array(S.M.length), want = Math.max(1, D.best | 0), top = want > 1 ? new Int32Array(S.M.length) : null;
  const S2 = D.rush ? E.sim(B, { hold, archersKill: true, time: D.time }, { deal: true }) : null, rcap = 8 * (B.pixTotal + D.maxCards) + 64; // v4.3 D.rush
  const buf2 = S2 ? new Int32Array(S2.M.length) : null, tmp2 = S2 ? new Int32Array(S2.M.length) : null, top2 = S2 && top ? new Int32Array(S2.M.length) : null;
  const rushBad = (m, n) => { S2.playSquad(m, n); S2.save(tmp2); S2.quiet(); const bad = S2.status === E.FAILED; S2.load(tmp2); return bad || (!rushTo(S2, 1, rcap) && S2.status !== E.WON); };
  const un = new Int32Array(E.NMAT); for (let m = 1; m < E.NMAT; m++) if (m !== IRON) un[m] = B.pix[m];
  const play = [], cap = D.maxWaitMs || 0, dealt = new Int32Array(E.NMAT);
  let maxWait = 0;
  for (let guard = 0; guard < D.maxCards && S.pixLeft > 0; guard++) {
    const reach = [], deep = [];
    for (let m = 1; m < E.NMAT; m++) { if (!un[m]) continue; const t = S.target(m); if (t >= 0 && !S.covered(t)) reach.push(m); else deep.push(m); }
    const opts = [], park = (D.park == null || S.lineLen < D.park) && !(D.noParkUnderArchers && S.standing);
    if (park && deep.length && r() < D.deep) opts.push(...shuffle(r, deep));
    opts.push(...shuffle(r, reach)); if (park) opts.push(...shuffle(r, deep));
    let done = false, got = 0, bm = 0, bn = 0, bw = 0;
    for (let t = 0; t < Math.min(D.tries, opts.length) && !done && got < want; t++) {
      const m = opts[t];
      let n = Math.min(un[m], ri(r, D.size[0], D.size[1]), D.maxCard);
      if (un[m] <= D.maxCard && r() < D.finish) n = un[m];
      if (D.capOf) n = Math.min(n, D.capOf[m] ? (dealt[m] ? D.capOf[m][1] : D.capOf[m][0]) : n); // v4 M4 (the Gallery): the outline's squads
      for (let s = 0; s <= (D.shrinks || 0) && !done && n > 0; s++) {
        S.save(buf); if (S2) S2.save(buf2); const t0 = S.now, l0 = S.lineLen;
        S.playSquad(m, n); S.quiet();
        const wait = S.now - t0;
        if (S.status === E.FAILED || (cap && wait > cap) || (D.noParkUnderArchers && S.standing && S.lineLen > l0) || (D.park != null && S.lineLen > Math.max(l0, D.park)) || (D.parkMax && overPark(S, D.parkMax)) || (S2 && rushBad(m, n))) { S.load(buf); if (S2) S2.load(buf2); n = Math.floor(n * (D.shrink || 0.6)); continue; }
        if (want > 1) { got++; if (n > bn) { bn = n; bm = m; bw = wait; S.save(top); if (S2) S2.save(top2); } S.load(buf); if (S2) S2.load(buf2); break; } // v4.2 D.best: the biggest of the first `best` squads that fit
        un[m] -= n; play.push([m, n]); done = true; dealt[m]++; if (wait > maxWait) maxWait = wait;
      }
    }
    if (!done && bn > 0) { S.load(top); if (S2) S2.load(top2); un[bm] -= bn; play.push([bm, bn]); done = true; dealt[bm]++; if (bw > maxWait) maxWait = bw; }
    if (!done || (D.maxTaps && play.length > D.maxTaps)) return null;
  }
  return S.pixLeft === 0 ? { play, peak: S.peak, maxWait } : null;
}
// v4.1: does a squad wait at rest with more than k sappers? (A big squad parked behind a gate pours out when the gate
// opens, and far from the entry square every round of it is a long walk: the tap that opens the gate would run on.)
function overPark(S, k) { for (let i = 0; i < E.MAXLINE; i++) if (S.spQ[i] && S.spW[i] > k) return true; return false; }
// Patient replay of a dealt play (singles [m, n] and pairs [m, n, m2, n2]) under dealing rules (D: {hold, time}, archers
// lethal): {won, ms, maxWait (the longest tap, from the tap until nothing moves)}.
function dealLine(L0, play, D) {
  const [L, hold] = shut(L0, D), B = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L));
  const S = E.sim(B, { hold, archersKill: true, time: D.time, lockSpaces: D.lockSpaces }, { deal: true });
  let maxWait = 0;
  for (let i = 0; i < play.length && S.status === E.PLAYING; i++) {
    const p = play[i], t0 = S.now;
    if (p.length >= 4) S.playPair(p[0], p[1], p[2], p[3]); else S.playSquad(p[0], p[1]);
    S.quiet(); if (S.now - t0 > maxWait) maxWait = S.now - t0;
  }
  S.quiet();
  return { won: S.status === E.WON, ms: S.now, maxWait };
}
// v4.3: run S (dealing mode) on until `need` spaces are free (true), or it stops (false). Bounded by cap events.
function rushTo(S, need, cap) { for (let g = 0; g < cap && S.status === E.PLAYING && S.open - S.lineLen < need && S.busy; g++) S.advanceTo(S.nextAt); return S.status === E.PLAYING && S.open - S.lineLen >= need; }
// v4.3: a play replayed rushed under dealing rules: each squad (a pair: both) tapped the moment its spaces are free.
function rushLine(L0, play, D) {
  const [L, hold] = shut(L0, D), B = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L));
  const S = E.sim(B, { hold, archersKill: true, time: D.time, lockSpaces: D.lockSpaces }, { deal: true }), cap = 8 * (B.pixTotal + play.length) + 64;
  for (let i = 0; i < play.length && S.status === E.PLAYING; i++) {
    const p = play[i]; if (!rushTo(S, p.length >= 4 ? 2 : 1, cap)) break;
    if (p.length >= 4) S.playPair(p[0], p[1], p[2], p[3]); else S.playSquad(p[0], p[1]);
  }
  S.quiet();
  return { won: S.status === E.WON, ms: S.now };
}
// Linked squads (v4 M3): join k pairs of consecutive plays [m1, n1] then [m2, n2] (different colours, both singles) into
// one pair [m1, n1, m2, n2] that goes out at once, kept only when the whole play still wins patiently under dealing rules
// within the dead-time cap (D.maxWaitMs). Bounded tries; returns the new play (fewer pairs when none fit).
function linkUp(L, play, k, seed, D) {
  const r = rng(seed ^ 0x1b873593); let cur = play.map((c) => c.slice()), got = 0;
  for (let t = 0; t < 12 * k && got < k; t++) {
    const i = Math.floor(r() * (cur.length - 1)); if (i < 0) break;
    const a = cur[i], b = cur[i + 1]; if (a.length > 2 || b.length > 2 || a[0] === b[0]) continue;
    const next = cur.slice(0, i).concat([[a[0], a[1], b[0], b[1]]], cur.slice(i + 2)), ln = dealLine(L, next, D);
    if (!ln.won || (D.maxWaitMs && ln.maxWait > D.maxWaitMs) || (D.rush && !rushLine(L, next, D).won)) continue; // v4.3 D.rush
    cur = next; got++;
  }
  return cur;
}
// The locked space's key (v4 M3): a fort pixel dug in one layer (it touches no walkable cell, but touches a pixel that
// does, counting every gate open and every yard as ground), never a gate, tower or key or next to a key, turned gilt.
// Picked seeded among the third of such pixels nearest the camp row. Sets L.lock; the deal then adds the Looters for it.
// Returns false when no pixel fits.
function lockKey(L, seed) {
  const B = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)), r = rng(seed ^ 0x2f6b1d37), w = B.w, n = B.n, a0 = B.a0;
  const walk = (c) => c >= 0 && (a0[c] === GRASS || a0[c] === DIRT || a0[c] === CAMP || a0[c] === IRON);
  const touch = (c) => { for (let k = 0; k < 4; k++) if (walk(B.nb[c * 4 + k])) return true; return false; };
  const nearKey = (c) => { const x = c % w, y = (c / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < B.h && a0[ny * w + nx] === GILT) return true; } return false; };
  const cand = [];
  for (let c = 0; c < n; c++) {
    const m = a0[c]; if (!(m > 0) || m === IRON || m === GILT || B.towerOf[c] >= 0 || touch(c) || nearKey(c) || (c / w | 0) >= B.campRow - 1) continue;
    let next = false; for (let k = 0; k < 4 && !next; k++) { const e = B.nb[c * 4 + k]; if (e >= 0 && a0[e] > 0 && a0[e] !== IRON && touch(e)) next = true; }
    if (next) cand.push(c);
  }
  if (!cand.length) return false;
  cand.sort((p, q) => Math.abs(((p / w) | 0) - B.campRow) - Math.abs(((q / w) | 0) - B.campRow) || p - q);
  const c = cand[Math.floor(r() * Math.max(1, Math.ceil(cand.length / 3)))], x = c % w, y = (c / w) | 0;
  L.grid = L.grid.slice(); L.grid[y] = L.grid[y].slice(0, x) + E.chOf(GILT) + L.grid[y].slice(x + 1); L.lock = { key: [x, y] };
  return true;
}

// Column per card: round-robin, or with probability beta the card's chunk of the order (five contiguous chunks).
function assign(play, beta, seed) {
  const r = rng(seed), K = play.length, colOf = new Array(K);
  for (let i = 0; i < K; i++) colOf[i] = r() < beta ? Math.min(4, Math.floor((i * 5) / K)) : i % 5;
  return colOf;
}
// Tighten: hill-climb the deal into the band [lo, hi] of Normal random-tap win rate, in stages (T.stages: {playouts,
// steps}), each on its own common seeds; a later stage with more playouts confirms the screening stage and keeps
// climbing if the estimate moved out. Moves: move one card to another column (keeps `play` winning), split a card in
// two, or merge two same-colour cards adjacent in `play` (resizing; kept only if `play` still wins under the dealing
// rules, and v4 M3 within the dead-time cap T.maxWaitMs). A pair (v4 M3) moves with its tapped card and never splits or
// merges; a move that leaves a partner more than a row from its card (deck) is skipped. T: {stages, seed, margin,
// colMin, colMax, resize, split, minCard, maxCard, maxTaps, maxWaitMs}; rules: {normal, deal}.
// Returns {play, colOf, rate, steps, evals}.
function tune(L, play, colOf, lo, hi, T, rules) {
  let res = { play, colOf, rate: 0, steps: 0, evals: 0 };
  T.stages.forEach((st, k) => {
    const r = stage(L, res.play, res.colOf, lo, hi, Object.assign({}, T, st, { seed: (T.seed + k * 104729) | 0 }), rules);
    res = { play: r.play, colOf: r.colOf, rate: r.rate, steps: res.steps + r.steps, evals: res.evals + r.evals };
  });
  if (T.narrow) { const r = narrowStage(L, res.play, res.colOf, lo, hi, Object.assign({}, T, T.narrow, { seed: (T.seed + 7919) | 0 }), rules); res = Object.assign(r, { steps: res.steps + r.steps, evals: res.evals + r.evals }); }
  return res;
}
// The level with its deck (null when a partner can't sit within a row of its card).
function build(L, play, colOf) { const d = deck(play, colOf); if (d.bad) return null; return E.compile(Object.assign({}, L, d.links.length ? d : { cols: d.cols })); }
// Late hard slots: keep the Normal random-tap rate in band and hill-climb the one-move-lookahead player's win rate down
// (card moves only, so the dealt order stays a winner) until it reaches T.stopAt (a floor, so the late band stays hard
// without turning into a wall). T: {playouts, greedyPlayouts, steps, stopAt}.
function narrowStage(L, play, colOf, lo, hi, T, rules) {
  const R = require("./grade.js"), r = rng(T.seed ^ 0x68e31da4);
  let evals = 0;
  const lo2 = lo > 0 ? lo + T.margin : 0, hi2 = hi < 1 ? hi - T.margin : 1;
  const score = (co) => { const B = build(L, play, co); if (!B) return null; evals++; const x = R.rate(B, rules.normal, T.playouts, T.seed);
    return x < lo2 || x > hi2 ? null : { rate: x, g: R.greedy(B, rules.normal, T.greedyPlayouts, T.seed) }; };
  let cur = score(colOf), step = 0;
  if (!cur) { const B = build(L, play, colOf); return { play, colOf, rate: B ? R.rate(B, rules.normal, T.playouts, T.seed) : 0, steps: 0, evals }; }
  for (; step < T.steps && cur.g > (T.stopAt || 0); step++) {
    const i = Math.floor(r() * play.length), j = Math.floor(r() * 5); if (j === colOf[i]) continue;
    const co = colOf.slice(); co[i] = j;
    const c = [0, 0, 0, 0, 0]; for (const x of co) c[x]++; if (Math.min(...c) < T.colMin || Math.max(...c) > T.colMax) continue;
    const s = score(co); if (!s) continue;
    if (s.g < cur.g || (s.g === cur.g && r() < 0.3)) { colOf = co; cur = s; }
  }
  return { play, colOf, rate: cur.rate, greedy: cur.g, steps: step, evals };
}
function stage(L, play, colOf, lo, hi, T, rules) {
  const R = require("./grade.js");
  play = play.map((c) => c.slice()); colOf = colOf.slice();
  const r = rng(T.seed ^ 0x5bd1e995);
  let evals = 0;
  const rateOf = (pl, co) => { const B = build(L, pl, co); if (!B) return -1; evals++; return R.rate(B, rules.normal, T.playouts, T.seed); };
  // The margin keeps estimates off a band edge, except the 0% and 100% edges no estimate can cross.
  const lo2 = lo > 0 ? lo + T.margin : 0, hi2 = hi < 1 ? hi - T.margin : 1, miss = (x) => Math.max(0, lo2 - x, x - hi2);
  const lens = (co) => { const c = [0, 0, 0, 0, 0]; for (const j of co) c[j]++; return c; };
  const dealWins = (pl) => { const ln = dealLine(L, pl, rules.deal); return ln.won && !(T.maxWaitMs && ln.maxWait > T.maxWaitMs) && !(rules.deal.rush && !rushLine(L, pl, rules.deal).won); }; // v4.3 rush
  let cur = rateOf(play, colOf), step = 0;
  if (cur < 0) cur = 0;
  for (; step < T.steps && miss(cur) > 0; step++) {
    let pl = play, co = colOf;
    const kind = r();
    if (kind < T.resize && play.length > 5) {
      if (r() < T.split) {
        const i = Math.floor(r() * play.length), [m, n] = play[i]; if (play[i].length > 2 || n < 2 * T.minCard || (T.maxTaps && play.length >= T.maxTaps)) continue;
        const a = T.minCard + Math.floor(r() * (n - 2 * T.minCard + 1));
        pl = play.slice(0, i).concat([[m, a], [m, n - a]], play.slice(i + 1)); co = colOf.slice(0, i + 1).concat([Math.floor(r() * 5)], colOf.slice(i + 1));
      } else {
        const i = Math.floor(r() * (play.length - 1)); if (play[i].length > 2 || play[i + 1].length > 2 || play[i][0] !== play[i + 1][0] || play[i][1] + play[i + 1][1] > T.maxCard) continue;
        pl = play.slice(0, i).concat([[play[i][0], play[i][1] + play[i + 1][1]]], play.slice(i + 2)); co = colOf.slice(0, i + 1).concat(colOf.slice(i + 2));
      }
      if (!dealWins(pl)) continue;
    } else {
      const i = Math.floor(r() * play.length), j = Math.floor(r() * 5); if (j === colOf[i]) continue;
      co = colOf.slice(); co[i] = j;
    }
    const L2 = lens(co); if (Math.min(...L2) < T.colMin || Math.max(...L2) > T.colMax) continue;
    const x = rateOf(pl, co); if (x < 0) continue;
    if (miss(x) < miss(cur) || (miss(x) === miss(cur) && r() < 0.3)) { play = pl; colOf = co; cur = x; }
  }
  return { play, colOf, rate: cur, steps: step, evals };
}
// The five tray columns from a play and its tapped cards' columns (v4 M3: with links). Each column is a subsequence of
// the play, so its next card is always in front when the order reaches it. A pair's partner joins a neighbouring column
// at its end at that moment (after every card played before the pair), so it never stands in front of a card the order
// taps earlier; the side that puts it exactly one row from its card is taken first, then the same row. bad counts
// partners that would sit further away (the tuner skips those decks). Returns {cols, links, bad}.
function deck(play, colOf) {
  const cols = [[], [], [], [], []], links = []; let bad = 0;
  play.forEach((cd, i) => {
    const c = colOf[i], a = cols[c].length;
    cols[c].push([cd[0], cd[1]]);
    if (cd.length < 4) return;
    let pc = -1, best = Infinity;
    for (const j of [c - 1, c + 1]) { if (j < 0 || j > 4) continue; const g = Math.abs(cols[j].length - a), s = g === 1 ? 0 : g === 0 ? 1 : 2 + g; if (s < best) { best = s; pc = j; } }
    if (best > 1) bad++;
    links.push([[c, a], [pc, cols[pc].length]]); cols[pc].push([cd[2], cd[3]]);
  });
  return { cols, links, bad };
}
const colsOf = (play, colOf) => deck(play, colOf).cols;
const orderOf = (colOf) => colOf.join("");

// v5 R4, mystery blocks (bake-config plan.hidden H): blobs of hidden blocks over the castle (the picture above its lowest
// bank path, never the foreground), only where a "?" may sit (a plain block: not iron, a gate's key, the lock's key or a
// tower), never on the picture's outer edge and never beside open ground at load (so every one starts as "?"). Blobs
// (radii H.rx x H.ry cells, seeded centres on eligible blocks) are added until a share in H.share of the eligible blocks
// is hidden. Sets L.hidden (h strings of w: "?" or "."); false (L untouched) when fewer than H.min could be hidden.
function hide(L, seed, H) {
  const B = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)), r = rng(seed ^ 0x7f4a7c15), w = B.w, h = B.h, a0 = B.a0;
  const open = (c) => a0[c] === GRASS || a0[c] === DIRT || a0[c] === CAMP;
  let yb = -1; for (let y = h - 2; y >= 1 && yb < 0; y--) { let all = true; for (let x = 1; x < w - 1 && all; x++) if (a0[y * w + x] > 0) all = false; if (all && y < B.campRow - 1) yb = y; }
  if (yb < 4) return false;
  const ok = new Uint8Array(w * h); let n = 0;
  for (let y = 2; y < yb; y++) for (let x = 2; x < w - 2; x++) { const c = y * w + x, m = a0[c];
    if (!(m > 0) || m === IRON || B.keyOf[c] >= 0 || c === B.lockKey || B.towerOf[c] >= 0) continue;
    if (H.skip && L.pal && L.pal[m] && H.skip.indexOf(L.pal[m].r) >= 0) continue; // v5 R4 fix: never the sky, the outline or the boss's king (roles in H.skip)
    let bad = false; for (let k = 0; k < 4 && !bad; k++) { const e = B.nb[c * 4 + k]; if (e >= 0 && (open(e) || a0[e] === IRON)) bad = true; }
    if (!bad) { ok[c] = 1; n++; } }
  const want = Math.round(n * (H.share[0] + r() * (H.share[1] - H.share[0]))), hid = new Uint8Array(w * h), cells = []; for (let c = 0; c < w * h; c++) if (ok[c]) cells.push(c);
  let got = 0;
  for (let t = 0; t < 400 && got < want && cells.length; t++) { const c0 = cells[Math.floor(r() * cells.length)], cx = c0 % w, cy = (c0 / w) | 0, rx = H.rx[0] + r() * (H.rx[1] - H.rx[0]), ry = H.ry[0] + r() * (H.ry[1] - H.ry[0]);
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(h - 1, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(w - 1, Math.ceil(cx + rx)); x++) { const c = y * w + x, dx = (x - cx) / rx, dy = (y - cy) / ry; if (ok[c] && !hid[c] && dx * dx + dy * dy <= 1 && got < want) { hid[c] = 1; got++; } } }
  if (H.maxGroup) { // v5 R4 fix (the visual critic's S3): no big flat "?" mass; a 4-connected group past maxGroup cells keeps its first maxGroup (breadth first) and the rest show
    const seen = new Uint8Array(w * h), q = new Int32Array(w * h);
    for (let c0 = 0; c0 < w * h; c0++) { if (!hid[c0] || seen[c0]) continue; let qh = 0, qt = 0, k = 0; q[qt++] = c0; seen[c0] = 1;
      while (qh < qt) { const c = q[qh++]; if (++k > H.maxGroup) { hid[c] = 0; got--; } for (let j = 0; j < 4; j++) { const e = B.nb[c * 4 + j]; if (e >= 0 && hid[e] && !seen[e]) { seen[e] = 1; q[qt++] = e; } } } } }
  if (got < H.min) return false;
  L.hidden = []; for (let y = 0; y < h; y++) { let s = ""; for (let x = 0; x < w; x++) s += hid[y * w + x] ? "?" : "."; L.hidden.push(s); }
  return true;
}
module.exports = { fort, deal, dealLine, rushLine, linkUp, lockKey, assign, tune, deck, colsOf, orderOf, coloursOf, hide };
