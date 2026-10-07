// Sapper's Path campaign v6 stage 2, the re-deal (SPEC-v4 §9, "Campaign v6 stage 2: the re-deal"; tools/campaign-v6-curve.md,
// the approved curve; driven by tools/campaign-v6.js). One castle level of 1-200 on its kept board (towers restored, added
// or dropped by the plan; ids stay), dealt again on its new tag, graded with its archers rule on:
//   1. The board: the plan's mystery blocks (gen.js hide, bake-config v6.hidden, a share of the castle's buried blocks a
//      mystery block may sit on, blobs kept apart by v6.hidden.gap), its locks (a key lock the board already carries; a
//      colour lock's stand-in, its colour set from the deal: lock k the colour whose first squad comes nearest
//      v6.lockAt[k] of the order).
//   2. The deal (gen.js deal: the dealing rules, 5 spaces, any arrow fails it, so a stored order never meets one; on a
//      level whose archers pin or kill, every other candidate (v6.deal.rush) dealt rushed as v4.3 did (gen.js D.rush): the
//      order also wins tapped the moment a space is free with nobody hit; every deal's order must win replayed at real pace,
//      with thinking time and at the steady rhythm, checked before the tuning), linked pairs (gen.js linkUp), tuned into the tag's random-tap band (gen.js tune) and the careful player narrowed toward
//      v6.tune.careful.under of its ceiling (gen.js carefulStage, card moves only), all-seeing past mystery blocks as
//      bake.js does.
//   3. The grade on the tag (gradeV6: what tools/regrade.js checks on a castle level: rate, the stored line, lookahead, real
//      pace, thinking replays, the steady replay, the fast tapper from fast.from, the careful player with its games by
//      range, the obvious player; fix pass: the best-of gate's two runs, grade.deep). The stored order must win with no
//      power-up and no arrow landing (line.hits 0).
//   4. The pick: every target met (band, careful ceiling, pace, longest tap, taps, fast tapper, pairs, steady replay, no
//      arrow) nearest the band's middle, the pace aim and (careWeight) the lowest careful rate; else the least total miss,
//      named as a fallback. Then the ? cards (land-bake.js mystify, the same rule).
// Fix pass (the functional critic's B1 and S1; SPEC-v4 §9, "Campaign v6 fix pass (difficulty)"): the ceiling gates the
// BEST of the careful players 1, 2 and 3 taps deep (bake-config grade.deep, 32 games each), on the level's grade seed and
// on a second, independent one; both runs must be under it (and over v6.floor where a level has one). The tuner climbs
// the same best-of (v6.tune.careful.depths), and the pick leans to the lowest mean of the two runs.
// Candidate k depends only on the job and k, so candidates can be shared out over threads (job.ks) and picked once all
// are in (job.outs), and kept between runs (tools/campaign-v6.js --reuse).
//   require("./campaign-v6-bake.js"): {bakeOne, gradeV6, runPool, rulesV6, deepOf, bestOf, regate}
"use strict";
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const E = require("../src/engine.js");
const G = require("./gen.js");
const R = require("./grade.js");

const gt = (o) => o.grade[o.tag], wn = (o) => o.win[o.tag];
const seedOf = (C, n, k) => (C.seed ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(k + 7, 0x85EBCA77)) | 0; // bake.js seedOf (regrade.js reads teaching levels with k 0)
// Fix pass: the best-of gate's two runs (bake-config grade.deep): the careful player at each depth over its games, on the
// grade seed (a, the careful player's own) and a second seed (b); bestOf: each run's best, [a, b]; regrade.js re-runs both.
const deepOf = (B, rt, C, seed) => ({ a: R.deep(B, rt, C.grade.deep.games, seed ^ 0x6c8e9cf5, C.grade.deep.depths), b: R.deep(B, rt, C.grade.deep.games, seed ^ 0x7f4a7c15, C.grade.deep.depths) });
const bestOf = (g) => (g && g.deep ? [Math.max(...g.deep.a), Math.max(...g.deep.b)] : null);
const rulesV6 = (CFG) => ({ easy: E.rulesOf(CFG.v3, "easy"), normal: E.rulesOf(CFG.v3, "normal"), hard: E.rulesOf(CFG.v3, "hard"), extreme: E.rulesOf(CFG.v3, "extreme") });

// Grade a castle level on its tag, every measure regrade.js checks (C: bake-config). hint: a known winning order.
function gradeV6(L, rules, C, hint, seed, n, tag) {
  const B = E.compile(L), win = {}, grade = { cards: B.ncards, pixels: B.pixTotal, colours: G.coloursOf(L).size }, rt = rules[tag], PC = C.duration.pace, CG = C.grade.careful, OB = C.grade.obvious;
  let order = hint, line = order ? R.line(B, rt, order) : null;
  if (!line || !line.won) { order = R.solve(B, rt, C.grade.solveNodes, hint); line = order ? R.line(B, rt, order) : null; }
  win[tag] = line && line.won ? order : null;
  const g = (grade[tag] = { rate: +R.rate(B, rt, C.grade.playouts, seed).toFixed(4), peak: line ? line.peak : null, len: order ? order.length : null, ms: line && line.won ? line.ms : null, maxWait: line && line.won ? line.maxWait : null });
  g.greedy = +R.greedy(B, rt, C.grade.greedyPlayouts, seed ^ 0x2545f491).toFixed(3);
  if (win[tag]) { const pc = R.pace(B, rt, win[tag], 0); g.pace = pc.won ? { raw: pc.ms, ms: Math.round(pc.ms * PC.factor) } : { raw: null, ms: g.ms, fell: true };
    g.thinks = PC.thinks.map((th) => (R.pace(B, rt, win[tag], th).won ? 1 : 0));
    const st = R.pace(B, rt, win[tag], PC.steady); g.steady = st.won ? { gap: st.gap, end: st.end } : { lost: 1 }; }
  if (n >= C.fast.from) g.fast = +R.fast(B, rt, C.fast.games, seed ^ 0x1f123bb5, C.fast.gapMs).toFixed(4);
  g.careful = +R.careful(B, rt, R.carefulGames(CG, n), seed ^ 0x6c8e9cf5, CG.depth).toFixed(3);
  g.obvious = +R.careful(B, rt, OB.games, seed ^ 0x1b873593, OB.depth).toFixed(3);
  if (C.grade.deep) g.deep = deepOf(B, rt, C, seed);
  return { win, grade, hits: line && line.won ? line.hits : null };
}
const fastBad = (g, C) => g.fast != null && (g.fast - g.rate >= C.fast.pts || (g.fast > C.fast.ratio * g.rate && g.fast - g.rate >= C.fast.minPts));
// The targets of a job. good(c): every one met; pen(c): the fallback's total miss; why(c): what it misses.
function targetsOf(C, V, job) {
  const band = job.band, PC = job.pace, care = job.care, P = job.plan;
  const fell = (c) => (!gt(c).pace || gt(c).pace.fell ? 1 : 0), dmiss = (c) => (fell(c) ? 1e9 : Math.max(0, PC.range[0] - gt(c).pace.ms, gt(c).pace.ms - PC.range[1]));
  const wmiss = (c) => (gt(c).maxWait == null ? 1e9 : Math.max(0, gt(c).maxWait - C.maxWaitMs)), tmiss = (c) => Math.max(0, (wn(c) || "").length - C.maxTaps);
  const fbad = (c) => (fastBad(gt(c), C) ? 1 : 0), pmiss = (c) => (c.pairs < P.links ? 1 : 0), hbad = (c) => (c.hits ? 1 : 0);
  const bo = (c) => bestOf(gt(c)) || [gt(c).careful, gt(c).careful], fl = job.floor; // fix pass: both runs' best under the ceiling, both over the floor
  const cover = (c) => { const b = bo(c), hi = Math.max(b[0], b[1]), lo = Math.min(b[0], b[1]); return (care != null && hi > care ? hi - care : 0) + (fl != null && lo < fl ? fl - lo : 0); };
  const sbad = (c) => ((gt(c).thinks || []).some((v) => !v) || !gt(c).steady || !!gt(c).steady.lost || gt(c).steady.gap > C.maxWaitMs ? 1 : 0);
  const rest = (c) => !c.miss && !dmiss(c) && !wmiss(c) && !tmiss(c) && !fbad(c) && !pmiss(c) && !sbad(c) && !hbad(c), good = (c) => rest(c) && !cover(c); // rest: every target but the careful gate
  const aim = (c) => (fell(c) || PC.aim == null ? 0 : Math.abs(gt(c).pace.ms - PC.aim) / V.aimWeight);
  const PN = V.penalty, pen = (c) => PN.band * c.miss + Math.min(dmiss(c), PN.fellMs) / PN.durationMs + wmiss(c) / PN.waitMs + tmiss(c) + PN.fast * fbad(c) + PN.pairs * pmiss(c) + cover(c) / PN.careful + PN.steady * sbad(c) + PN.hits * hbad(c);
  const why = (c) => { const w = []; if (c.miss) w.push("rate " + (100 * gt(c).rate).toFixed(2) + "% vs " + band.map((x) => (100 * x).toFixed(0)).join("-") + "%"); if (fell(c)) w.push("the real-pace replay lost");
    else if (dmiss(c)) w.push("real pace " + Math.round(gt(c).pace.ms / 1000) + " s outside " + PC.range.map((x) => x / 1000).join("-") + " s"); if (wmiss(c)) w.push("longest tap " + (gt(c).maxWait / 1000).toFixed(1) + " s");
    if (tmiss(c)) w.push("taps " + wn(c).length); if (fbad(c)) w.push("fast tapper " + gt(c).fast); if (pmiss(c)) w.push("pairs " + c.pairs + " of " + P.links); if (cover(c)) w.push("best-of " + bo(c).join("/") + " outside " + (fl != null ? fl + "-" : "") + care);
    if (sbad(c)) w.push("steady " + JSON.stringify([gt(c).thinks, gt(c).steady])); if (hbad(c)) w.push("the stored order meets an arrow"); return w.join("; "); };
  return { good, rest, pen, aim, why, cover, bo };
}

// The order's replays on a level (L without its deck, play the dealt plays): real pace, each thinking time, the steady
// rhythm; {ok, why}. A round-robin deck replays the same order as any tuned one.
function replaysOK(L, play, rt, C) {
  let co = null, dk = null; for (let t = 0; t < 24 && (!dk || dk.bad); t++) { co = G.assign(play, t ? 0.3 : 0, t); dk = G.deck(play, co); }
  if (dk.bad) return { ok: false, why: "no deck seats its linked partners" };
  const B = E.compile(Object.assign({}, L, { cols: dk.cols }, dk.links.length ? { links: dk.links } : {})), o = G.orderOf(co), PC = C.duration.pace;
  for (const th of [0].concat(PC.thinks)) if (!R.pace(B, rt, o, th).won) return { ok: false, why: "lost at " + th + " ms" };
  const st = R.pace(B, rt, o, PC.steady); if (!st.won || st.gap > C.maxWaitMs) return { ok: false, why: "steady " + (st.won ? st.gap + " ms gap" : "lost") };
  return { ok: true };
}
// The ? cards (land-bake.js mystify: placed in rows M.rows behind the fronts, never a linked card, never two in a row in a
// column, measured honest against all-seeing; the first within maxGap is kept, else the smallest gap, one fewer each try).
function mystify(L, want, M, rt, seed) {
  const r = R.rng(seed ^ 0x6a09e667), linked = new Set(); for (const P of L.links || []) for (const q of P) linked.add(q[0] + "," + q[1]);
  let best = null;
  for (let t = 0; t < M.tries; t++) {
    const k = Math.max(2, want - t), spots = [];
    L.cols.forEach((col, j) => col.forEach((cd, i) => { if (i >= M.rows[0] && i <= M.rows[1] && !linked.has(j + "," + i)) spots.push([j, i]); }));
    for (let i = spots.length - 1; i > 0; i--) { const q = Math.floor(r() * (i + 1)); [spots[i], spots[q]] = [spots[q], spots[i]]; }
    const got = []; for (const [j, i] of spots) { if (got.length >= k) break; if (got.some(([a, b]) => a === j && Math.abs(b - i) < 2)) continue; got.push([j, i]); }
    if (got.length < 2) break;
    const T = JSON.parse(JSON.stringify(L)); for (const [j, i] of got) T.cols[j][i][2] = E.MYSTERY;
    const B = E.compile(T), honest = R.plan(B, rt, M.games, seed ^ 0x3243f6a8, M.samples, false), seeing = R.plan(B, rt, M.games, seed ^ 0x3243f6a8, M.samples, true);
    const m = { cards: got.length, honest: +honest.toFixed(3), seeing: +seeing.toFixed(3), gap: +(seeing - honest).toFixed(3), tries: t + 1 };
    if (!best || m.gap < best.m.gap) best = { level: T, m };
    if (m.gap <= M.maxGap) break;
  }
  return best || { level: L, m: null };
}

// The colour locks from the dealt play: lock k (a "colour" entry of kinds) takes the colour whose first squad comes nearest
// at[k] of the order, never the gilt and never another lock's colour. Returns the locks list ([key lock?, ...]).
function lockColours(kinds, keyLock, play, at) {
  const first = new Map(); play.forEach((p, i) => { for (const m of p.length >= 4 ? [p[0], p[2]] : [p[0]]) if (!first.has(m) && m !== E.GILT) first.set(m, i); });
  const out = [], used = new Set();
  kinds.forEach((k, i) => { if (k === "key") { out.push(keyLock); return; }
    const want = at[i] * play.length, best = [...first].filter(([m]) => !used.has(m)).sort((p, q) => Math.abs(p[1] - want) - Math.abs(q[1] - want) || p[1] - q[1])[0];
    if (best) { used.add(best[0]); out.push({ colour: best[0] }); } });
  return out;
}
const withLocks = (L, locks) => { const o = Object.assign({}, L); delete o.lock; delete o.locks; if (locks.length === 1) o.lock = locks[0]; else if (locks.length > 1) o.locks = locks; return o; };

// One level. job: {n, tag, board (the level's board fields), plan {links, mystery, hidden ([lo, hi] or 0), locks ([kind,
// ...], kind "key" | "colour"), keyLock ({key: [x, y]} or null), archers}, band, care (ceiling or null), careTune, pace
// {range, aim}, deal (overrides), kept ({cols, links, hint} or null), extra, ks?, outs?}. Returns {n, part, out, stats} for
// a shard, else the pick {n, tag, seed, level, fallback, mystery, cands, stats} or {n, fail}.
function bakeOne(job) {
  const C = require("./bake-config.json"), V = C.v6, CFG = require("../config.json"), rules = rulesV6(CFG), { n, tag, band } = job, P = job.plan, rt = rules[tag];
  const TT = targetsOf(C, V, job), out = [], stats = { deals: 0, evals: 0, grades: 0 };
  const D0 = Object.assign({}, C.deal, V.deal.base, (V.deal.byRealm || {})[job.era] || {}, (V.deal.byTag || {})[tag] || {}, job.deal || {}, { maxTaps: C.maxTaps, time: rules.hard.time, maxWaitMs: C.maxWaitMs, lockSpaces: rules.hard.lockSpaces });
  const dealRules = Object.assign({}, rules.hard, { hold: C.deal.hold, archersKill: true });
  const base = (V.candidates.byTag || {})[tag] || V.candidates.perLevel, per = base + (job.extra | 0), ks = job.ks || [-1, per], arch = !!(job.board.archers && job.board.towers && job.board.towers.length);
  const graded = (level, hint, seed, k, extra) => { const g = gradeV6(level, rules, C, hint, seed, n, tag); stats.grades++; const rate = g.grade[tag].rate, miss = Math.max(0, band[0] - rate, rate - band[1]);
    return Object.assign({ k, seed, tag, level, win: g.win, grade: g.grade, hits: g.hits, miss: +miss.toFixed(4), pairs: (level.links || []).length, winnable: !!g.win[tag] }, extra || {}); };
  for (let k = ks[0]; k < ks[1] && !job.outs; k++) {
    const t0 = Date.now();
    try {
      if (k < 0) { // the kept deck, as it is (only when its board and locks are the plan's)
        if (job.kept) { const level = Object.assign({}, job.board, { cols: job.kept.cols }, job.kept.links && job.kept.links.length ? { links: job.kept.links } : {}); out.push(graded(level, job.kept.hint, job.kept.seed, k, { deck: "kept", tuned: { ms: Date.now() - t0 } })); }
        continue;
      }
      const seed = seedOf(C, n, k + 1), D = Object.assign({}, D0, arch && V.deal.rush[k % V.deal.rush.length] ? { rush: true, rushOpen: V.deal.rushOpen || false } : {}); // v6.deal.rush: candidate k on a level with pinning or killing archers is dealt rushed when rush[k mod length] if (D.deepAlt) D.deep = D.deepAlt[k % D.deepAlt.length]; if (D.sizeAlt) D.size = D.sizeAlt[k % D.sizeAlt.length];
      const more = k - (job.k0 | 0) >= base; // fix pass: --from K starts a level's new candidates at K (fresh seeds), counted from there if (more && V.deal.extraDeep) D.deep = Math.min(0.9, D.deep + V.deal.extraDeep); // v6: a fix-up's extra candidates (k past the tag's count) bury deeper and narrow longer
      let L = JSON.parse(JSON.stringify(job.board)); delete L.hidden; delete L.lock; delete L.locks;
      if (P.hidden) { const H = Object.assign({}, C.plan.hidden, V.hidden, { share: P.hidden }); if (!G.hide(L, seed, H)) { out.push({ k, fail: "no room for mystery blocks" }); continue; } }
      const Ld = withLocks(L, P.locks.map((kd, i) => (kd === "key" ? P.keyLock : { colour: 100 + i }))); // stand-ins: gen.js shut drops every colour lock (a space fewer each) before the deal compiles, so their colours never matter
      // Deal until a play passes the replays: the stored order tapped at real pace, with each thinking time and at the steady
      // rhythm must win (no arrow can make it short) and wait no more than maxWaitMs between taps. They read the order, not
      // the columns, so the tuner can't change them: checked here, before the tuning, on a round-robin deck.
      let play = null, why = "no deal in " + D.attempts + " attempts", Lk = null;
      for (let a = 0; a < D.attempts && !play; a++) { const dl = G.deal(Ld, seed ^ Math.imul(a + 1, 0x27D4EB2F), D); stats.deals++; if (!dl) continue;
        const pl = P.links ? G.linkUp(Ld, dl.play, P.links, seed ^ a, D) : dl.play, Lc = withLocks(L, lockColours(P.locks, P.keyLock, pl, V.lockAt));
        if (P.locks.length && E.locksOf(Lc).length !== P.locks.length) { why = "not enough colours for its locks"; continue; }
        const rp = replaysOK(Lc, pl, rt, C); if (!rp.ok) { why = "replays: " + rp.why; continue; }
        play = pl; Lk = Lc; }
      if (!play) { out.push({ k, seed, fail: why }); continue; }
      L = Lk;
      const T = Object.assign({}, C.tune, V.tune.base, arch ? V.tune.rushed : {}, { seed: seed ^ 0x3c6ef372, maxTaps: C.maxTaps, maxWaitMs: C.maxWaitMs, narrow: null }, // v6.tune.rushed: card moves only on a level with pinning or killing archers, so the play the replays passed is the play stored
        { careful: job.care != null ? Object.assign({}, V.tune.careful, more && V.tune.careful.extraSteps ? { steps: V.tune.careful.extraSteps } : {}, { games: R.carefulGames(V.tune.careful, n), stopAt: +((job.careTune != null ? job.careTune : job.care) * V.tune.careful.under).toFixed(3) },
          job.floor != null ? { window: [job.floor * V.tune.careful.floorOver, job.care * V.tune.careful.floorUnder] } : {}) : null }); // fix pass: a floor level climbs into [floor x floorOver, ceiling x floorUnder]
      const Lt = L.hidden ? Object.assign({}, L, { hidden: undefined }) : L; // tuned all-seeing (bake.js: the honest grade can only be lower)
      const res = G.tune(Lt, play, G.assign(play, 0, seed), band[0], band[1], T, { normal: rt, deal: Object.assign({}, dealRules, D) }); stats.evals += res.evals;
      const dk = G.deck(res.play, res.colOf); if (dk.bad) { out.push({ k, seed, fail: "a linked partner more than a row from its card" }); continue; }
      const level = Object.assign({}, L, { cols: dk.cols }, dk.links.length ? { links: dk.links } : {});
      out.push(graded(level, G.orderOf(res.colOf), seed, k, { deck: "dealt", tuned: { careful0: res.careful0, careful: res.careful, steps: res.steps, deep: D.deep, size: D.size, ms: Date.now() - t0 } }));
    } catch (e) { out.push({ k, fail: "error: " + (e && e.message) }); }
  }
  if (job.ks) return { n, part: true, out, stats };
  if (job.outs) { out.push(...job.outs); if (job.stats) Object.assign(stats, job.stats); }
  return pickOf(job, out, stats);
}
// The pick of a level's graded candidates (out), then its ? cards. Fix pass: among good picks the lean is the mean of the
// best-of gate's two runs (a floor level: its distance from the middle of floor and ceiling).
function pickOf(job, out, stats) {
  const C = require("./bake-config.json"), V = C.v6, CFG = require("../config.json"), rules = rulesV6(CFG), { n, tag, band } = job, P = job.plan, rt = rules[tag], TT = targetsOf(C, V, job);
  const okc = out.filter((c) => c.level && c.winnable), mid = (band[0] + band[1]) / 2;
  if (!okc.length) return { n, fail: "no winnable candidate (" + out.map((c) => c.fail || "lost").slice(0, 4).join("; ") + ")", stats };
  const lean = job.floor != null ? (job.floor + job.care) / 2 : job.care != null && V.lean && V.lean[tag] != null ? V.lean[tag] * job.care : null; // fix pass: a floor level leans to the middle of floor and ceiling, a tag in v6.lean to that share of its ceiling, the rest to the lowest
  const bm = (c) => { const b = TT.bo(c); return (b[0] + b[1]) / 2; }, cw = (c) => (job.care == null ? 0 : V.careWeight * (lean != null ? Math.abs(bm(c) - lean) : bm(c))), kept = (c) => (c.deck === "kept" ? -V.keptBonus : 0);
  okc.sort((p, q) => TT.good(q) - TT.good(p) || (TT.good(p) ? 100 * Math.abs(gt(p).rate - mid) + TT.aim(p) + cw(p) + kept(p) - 100 * Math.abs(gt(q).rate - mid) - TT.aim(q) - cw(q) - kept(q) : TT.pen(p) - TT.pen(q)) || p.k - q.k);
  const pk = okc[0]; let level = Object.assign({}, pk.level), mys = null;
  if (P.mystery) { const r = mystify(level, P.mystery, Object.assign({}, C.mystery, V.mystery || {}), rt, pk.seed); level = r.level; mys = r.m; }
  return { n, tag, seed: pk.seed, deck: pk.deck, level: Object.assign(level, { win: pk.win, grade: pk.grade }), inBand: !pk.miss, fallback: TT.good(pk) ? null : TT.why(pk), mystery: mys,
    cands: { tried: out.length, winnable: okc.length, good: okc.filter(TT.good).length, fails: out.filter((c) => c.fail).map((c) => c.fail).slice(0, 3),
      list: out.map((c) => (c.level ? { k: c.k, deck: c.deck, rate: gt(c).rate, careful: gt(c).careful, obvious: gt(c).obvious, best: bestOf(gt(c)), pace: gt(c).pace ? gt(c).pace.ms : null, wait: gt(c).maxWait, taps: (wn(c) || "").length, pairs: c.pairs, tuned: c.tuned, good: c.winnable && TT.good(c), why: c.winnable ? TT.why(c) : "lost" } : { k: c.k, fail: c.fail })) }, stats };
}

// Fix pass: one level on the best-of gate. job: the bake job plus pick (its installed pick) and cands (its cached graded
// candidates). The pick graded on the gate's two runs stays when it passes ({n, keep, pick}); else every cached candidate
// that meets every other target is graded the same and the level picked again ({n, pick} or {n, again} when none passes);
// job.repick: picked again even when the pick passes (more candidates came in).
function regate(job) {
  const C = require("./bake-config.json"), V = C.v6, CFG = require("../config.json"), rt = rulesV6(CFG)[job.tag], TT = targetsOf(C, V, job), pk = job.pick, g = pk.level.grade[job.tag];
  if (!g.deep) g.deep = deepOf(E.compile(pk.level), rt, C, pk.seed);
  if (!TT.cover({ tag: job.tag, grade: pk.level.grade }) && !job.repick) return { n: job.n, keep: true, pick: pk };
  const cs = (job.cands || []).filter((c) => c.level && c.winnable && TT.rest(c)); let graded = 0;
  for (const c of cs) { const gc = c.grade[job.tag]; if (!gc.deep) { gc.deep = deepOf(E.compile(c.level), rt, C, c.seed); graded++; } }
  const best = cs.map((c) => ({ k: c.k, best: bestOf(c.grade[job.tag]) })).sort((p, q) => Math.max(...p.best) - Math.max(...q.best)).slice(0, 3);
  if (!cs.some(TT.good)) return { n: job.n, again: true, was: bestOf(g), tried: cs.length, best };
  return Object.assign(pickOf(job, cs, { regated: graded }), { n: job.n, was: bestOf(g), tried: cs.length });
}

// Workers, one job each, at most `threads` at once; onDone(done, total) after each.
function runPool(jobs, threads, deadline, onDone) {
  const results = new Array(jobs.length); let next = 0, running = 0, done = 0;
  return new Promise((resolve) => {
    const pump = () => {
      if (done === jobs.length) { resolve(results); return; }
      while (running < threads && next < jobs.length) {
        const i = next++; running++;
        if (Date.now() > deadline) { results[i] = { n: jobs[i].n, fail: "wall budget" }; running--; done++; continue; }
        const wk = new Worker(__filename, { workerData: { job: jobs[i] } }); let got = false;
        wk.on("message", (m) => { got = true; results[i] = m; });
        wk.on("error", (e) => { results[i] = { n: jobs[i].n, fail: "worker error: " + e.message }; got = true; });
        wk.on("exit", () => { if (!got) results[i] = { n: jobs[i].n, fail: "worker died" }; running--; done++; if (onDone) onDone(done, jobs.length, results[i], i); pump(); });
      }
      if (done === jobs.length) resolve(results);
    };
    pump();
  });
}

if (!isMainThread) {
  const J = workerData.job; let res; // op "deep": a level's best-of gate runs (the fix pass's measure); "regate"; else a bake job
  try { res = J.op === "deep" ? { n: J.n, deep: deepOf(E.compile(J.level), rulesV6(require("../config.json"))[J.tag], require("./bake-config.json"), J.seed) } : J.op === "regate" ? regate(J) : bakeOne(J); } catch (e) { res = { n: workerData.job.n, fail: "worker error: " + (e && e.message) }; }
  parentPort.postMessage(res);
} else module.exports = { VERSION: 2, replaysOK, bakeOne, gradeV6, runPool, rulesV6, seedOf, mystify, lockColours, withLocks, deepOf, bestOf, targetsOf }; // VERSION 2: the fix pass's best-of gate // VERSION: bump when a candidate would come out differently (the scratch cache keys on it)
