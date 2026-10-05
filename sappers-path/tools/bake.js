// Sapper's Path bake (SPEC-v3 §5; v4 M3, the Siege to 100): tools/bake-config.json + levels/teaching.json ->
// levels/levels.json (versioned) and levels/pool-e{1,2,3,4}.json (every graded candidate, kept for rebakes and the app's
// longer curve).
//   ~/.local/opt/node/bin/node tools/bake.js [--out DIR] [--only A-B] [--boards FILE] [--keep FILE] [--config FILE] [--threads N]
//   ~/.local/opt/node/bin/node tools/bake.js --merge FULL,FIX1,... [--logs LOG,...] [--out DIR]   (v4.3: fix-up runs in)
// Per generated level: perLevel candidates, each a seeded fort (colour count in the level's range; the level's twists from
// the config's schedule: a lock key dug into the fort, linked pairs joined in the deal), a deal simulated as a winning
// order under the dealing rules (so it wins on Easy, Normal and Hard) within the dead-time cap, then tightened into the
// level's Normal band (gen.tune: card moves between columns, squad splits and merges). Every candidate is graded on all
// three difficulties, with its patient play-through time, its longest single tap and (late levels) the fast tapper.
// Levels are picked in order: the candidate that meets every target (band, time, dead time, fast tapper, lookahead)
// nearest its band's centre that is not a near-duplicate of an earlier pick; otherwise the nearest miss, logged as a
// fallback naming what it missed. Then a second pass over the picked levels: winning-order counts and safe taps per turn
// (the slow, report-only measures), and the mystery cards: 2-4 "?" flags placed in the rows behind the fronts, measured
// by the sampling planner (honest against all-seeing; the flags change nothing any other player reads, so every other
// grade stands). Both passes run in worker threads, one task per level with seeds derived from the level number, so
// thread timing never changes the output. Never throws: a task that fails is logged and its level falls back. The
// report tables are written between the bake markers of tools/v4.2-rebake.md. `--out DIR` writes levels.json, the
// pools and the report into DIR instead (a trial bake that leaves the tracked files alone); `--only A-B` bakes only
// those levels (a trial: the file holds just them); `--teach FILE` reads the teaching levels from FILE.
// v4.2, real pace (config duration.pace; tools/grade.js pace): each level's stored Normal order is also replayed tapping each
// next card the moment a space is free; that time times pace.factor is the level's real-pace time (Peter's pace). From
// pace.from the duration limits are on it (pace.range, the boss pace.boss) instead of the patient time; a replay that loses
// falls back to the patient time and is logged. `--keep FILE` (v4.2): the levels outside --only are copied from
// FILE as they are (byte-identical) and count as earlier picks for the variety gate and the dedupe, so a run of 26-100
// writes the whole campaign; `--extra K` gives every level in the run K more candidates (a fix-up run of one level).
// v4.3 (SPEC-v4 §9, the v4.3 entry): every level plays on one fixed tag (tools/tags.js, config tags) and is graded on it
// alone: one stored winning order (win[tag]), the rate, its band (curve.byTag: the band follows the tag), the lookahead,
// the fast tapper, the dead time and the real pace on the tag's rules (grade[tag]). `--boards FILE` keeps every level's
// board (grid, palette, gates, towers, lock) from FILE and deals it again: the v4.3 rebake changes the deals, not the
// pictures (a level missing from FILE gets a new fort). The dealer still deals on Hard's 4 spaces with archers lethal, so
// a deal wins on any tag. The real-pace replay must win on the tag (a lost replay counts as a duration miss: on a Hard
// level with archers, a fast player's extra kills can leave a colour short). `--config FILE`: a trial bake config.
// v4.1 fix, the variety gate (config variety; tools/variety.js): within an era, how alike two castle pictures are is the
// share of a cols x rows grid of picture cells whose colours match. A candidate meeting every target is picked only if
// its median match against the era's earlier generated picks is variety.maxMedian or under; when none is, the least alike
// of those meeting every target is picked and logged ("variety"). After the picks the bake reports each era's median over
// every pair and its most alike pair, and logs VARIETY GATE FAILED for an era whose median is over variety.maxMedian.
// v5 R2, the re-lay (`--relay`; tools/relay.js, bake-config relay): no schedule of twists and no new forts by default:
// every slot takes the board relay.js gives it (a v4.3 board edited to its realm and tag) with its kept deck, and the
// level is graded on its tag under the v5 rules. The kept deck stands if it meets every target; else the kept squads
// are re-tuned (gen.tune from the kept plays and columns); else the board is dealt again (perLevel candidates); and only
// if none of those meets every target are new forts of the realm's look drawn (edited the same way). Among candidates
// meeting every target the kept deck comes first, then the re-tuned, the re-dealt and a new board (`deck` in the level
// record, with `from`, the v4.3 level the board came from, and `edits`). A slot relay.js leaves empty gets a new board.
// The report goes to tools/v5-r2-relay.md. Every other measure, pick rule and the second pass are as before.
// v5 R4 (levels from bake-config plan.from): each generated level's features come from its plan (planOf: tag, ladder and
// seeded draws), its fort from its realm's painter with those features (moat, gates, towers, the boss's inner moat), then
// mystery blocks (gen.js hide) and the lock (a key dug in, or a colour set from the dealt order); a fort that doesn't carry
// exactly what its plan asks is skipped. `--report FILE` writes the report tables there.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const E = require("../src/engine.js");
const G = require("./gen.js");
const R = require("./grade.js");
const PAL = require("./palette.js");
const VAR = require("./variety.js");
const TG = require("./tags.js");

const ROOT = path.join(__dirname, "..");
const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : null; };
const OUT = arg("out") ? path.resolve(arg("out")) : null;
const ONLY = arg("only") ? arg("only").split("-").map(Number) : arg("list") ? [Math.min(...arg("list").split(",").map(Number)), Math.max(...arg("list").split(",").map(Number))] : null;
const LIST = arg("list") ? arg("list").split(",").map(Number) : null; // v5 R4 --list N,N,...: a fix-up run of just those levels
const outPath = (rel) => (OUT ? path.join(OUT, path.basename(rel)) : path.join(ROOT, rel));
const BOARD = ["w", "h", "grid", "pic", "gates", "towers", "pal", "scene", "style", "palette", "lock", "safeArchers"]; // v4.3 --boards: a level's board
const RELAY = process.argv.includes("--relay"); // v5 R2
const boardOf = (l) => { const b = {}; for (const k of Object.keys(l)) if (BOARD.indexOf(k) >= 0) b[k] = l[k]; return b; };

// ---- shared by main and workers -------------------------------------------------------------------------------
function eraOf(n, C) { for (const e of Object.keys(C.eras)) if (n >= C.eras[e].from && n <= C.eras[e].to) return +e; return 1; }
// The late pattern (hard, hard, hard, hardest, relief) runs from curve.late.from; curve.late.overrides names slots by level
// (the run-in to the boss: 98 hardest, 99 relief, 100 boss).
// v4.3: the slot follows the level's tag (curve.byTag[kind][tag] names it; null keeps the pattern's slot, with byTag's
// `cap` slots moved to the named one), so a Hard level takes its section's hardest band and an Easy one the gentlest.
function bandOf(n, C, tag) {
  const cv = C.curve, BT = (cv.byTag || {});
  if (n <= cv.early.to) return { kind: "early", sub: "early", band: cv.early.band };
  if (n <= cv.mid.to) { let k = (n - cv.mid.from) % cv.mid.saw.length; const t = BT.mid && tag ? BT.mid[tag] : null;
    if (t != null) k = t; else if (BT.mid && BT.mid.cap != null && tag) k = Math.min(k, BT.mid.cap);
    return { kind: "mid", sub: "saw" + k, band: cv.mid.saw[k] }; }
  let sub = (cv.late.overrides && cv.late.overrides[n]) || cv.late.pattern[(n - cv.late.from) % cv.late.pattern.length];
  if (sub !== "boss" && BT.late && tag && BT.late[tag]) sub = BT.late[tag];
  return { kind: "late", sub, band: cv.late.bands[sub] };
}
const gt = (o) => o.grade[o.tag], wn = (o) => o.win[o.tag]; // v4.3: a level's (or candidate's) grade and order on its tag
function coloursOf(n, C, b) {
  if (b.sub === "boss") return bossOf(n, C).colours;
  if (C.plan && n >= C.plan.from) return C.plan.colours[eraOf(n, C)] || [5, 5]; // v5 R4: the realm's range (its plan decides the rest)
  if (b.sub === "relief") return C.reliefColours;
  if (b.sub === "saw" + (C.curve.mid.saw.length - 1)) return C.sawLowColours;
  for (const [a, z, lo, hi] of C.colours) if (n >= a && n <= z) return [lo, hi];
  return [5, 5];
}
const seedOf = (C, n, k) => (C.seed ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(k + 7, 0x85EBCA77)) | 0;
const hash01 = (n, k) => { let t = Math.imul(n + 0x3c6e, 0x9E3779B1) ^ Math.imul(k + 11, 0x85EBCA77); t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d); t ^= t >>> 12; return (t >>> 0) / 4294967296; };
// The twists a generated level carries (v4 M3, config twists; fixed by the level number, the same for every candidate):
// each twist from its first level on with probability p, forced when its last `gap` levels went without it; levels
// from `mixFrom` carry at least one (the one missing longest); the boss carries every twist. {mystery: cards, links:
// pairs, lock: bool}. A teaching level counts as carrying the twists its data holds.
function twistsOf(n, C, teachBy) {
  const T = C.twists, keys = ["mystery", "links", "lock"], out = { mystery: 0, links: 0, lock: false }, last = { mystery: -99, links: -99, lock: -99 };
  const r = (k, lo, hi) => lo + Math.floor(hash01(k * 131 + 7, 91) * (hi - lo + 1));
  for (let k = 1; k <= n; k++) {
    const tw = teachBy && teachBy.get(k), has = {};
    for (const key of keys) { const S = T[key]; has[key] = tw ? (key === "mystery" ? tw.cols.some((c) => c.some((cd) => cd[2])) : key === "links" ? !!(tw.links && tw.links.length) : !!tw.lock) : k >= S.from && (k === C.boss.n || hash01(k, keys.indexOf(key)) < S.p || k - last[key] > S.gap); }
    if (!tw && k >= T.mixFrom && !keys.some((key) => has[key])) { let best = keys[0]; for (const key of keys) if (k >= T[key].from && last[key] < last[best]) best = key; has[best] = k >= T[best].from; }
    for (const key of keys) if (has[key]) last[key] = k;
    if (k === n) {
      const boss = k === C.boss.n ? C.boss : null;
      if (has.mystery) { const c = boss ? boss.cards : T.mystery.cards; out.mystery = r(k, c[0], c[1]); }
      if (has.links) { const c = boss ? boss.pairs : T.links.pairs; out.links = r(k + 5, c[0], c[1]); }
      out.lock = !!has.lock;
    }
  }
  return out;
}

// v5 R4, the plan (bake-config plan; levels from plan.from): the features a generated level uses, from its tag and the
// feature ladder (config.json v5.density), every draw fixed by the level number (hash01). Returns the twists-like record
// the candidates read: {plan: true, feats, moat, gates, towers ([a, b] or 0), hidden, mystery (cards), links (pairs),
// lock (false, "key" or "colour"), inner (the boss's inner moat)}.
const bossOf = (n, C) => (C.bosses && C.bosses[n]) || C.boss; // v5 R4: per-level bosses (200), else the old boss (99)
function planOf(n, C, tag, D) {
  const PL = C.plan, TG2 = require("./tags.js"), u = TG2.unlockedAt(n, D), h = (k) => hash01(n, 300 + k), boss = C.bosses && C.bosses[n];
  const pickOf = (list, k) => list[Math.floor(h(k) * list.length) % list.length];
  let f;
  if (boss || tag === "extreme") f = u.slice();
  else if (tag === "hard") { f = u.slice(); if (n >= PL.hardFrom && h(1) < PL.hardDrop) { const can = ["linked", "mystery", "tower", "hidden", "gate"].filter((k) => f.indexOf(k) >= 0); if (can.length) f.splice(f.indexOf(pickOf(can, 2)), 1); } }
  else if (tag === "normal") { const k = Math.min(u.length - 1, Math.max(Math.min(D.normalMin, u.length), PL.normal[0] + (h(3) < PL.normalMore ? 1 : 0))), sh = u.slice();
    for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(h(10 + i) * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
    f = sh.slice(0, k); if (f.indexOf("gate") >= 0 && f.indexOf("moat") < 0) f[f.indexOf("gate")] = "moat"; }
  else { const can = ["moat", "linked", "mystery", "tower", "hidden"].filter((k) => u.indexOf(k) >= 0); f = h(4) < PL.easyNone || !can.length ? [] : [pickOf(can, 5)]; }
  const has = (k) => f.indexOf(k) >= 0, hardish = tag === "hard" || tag === "extreme" || !!boss, T = C.twists, r = (k, lo, hi) => lo + Math.floor(h(k) * (hi - lo + 1));
  return { plan: true, feats: f, moat: has("moat"), gates: has("gate") ? (boss ? 2 : hardish && h(6) < PL.twoGates ? 2 : 1) : 0, towers: has("tower") ? (boss && boss.towers) || PL.towers[tag] : 0, hidden: has("hidden"),
    mystery: has("mystery") ? (boss ? r(7, boss.cards[0], boss.cards[1]) : r(7, T.mystery.cards[0], T.mystery.cards[1])) : 0, links: has("linked") ? (boss ? r(8, boss.pairs[0], boss.pairs[1]) : r(8, T.links.pairs[0], T.links.pairs[1])) : 0,
    lock: hardish && n >= D.lockFrom ? (h(9) < PL.keyLock ? "key" : "colour") : false, inner: !!(boss && boss.gen && boss.gen.inner) };
}

// Grade a finished level on its tag (v4.3; every difficulty before); `hint` is a known winning order (tried first; an
// object: the order per tag). A stored winning order, the random-tap rate, the peak line, the patient time, the longest
// single tap (dead time), the one-move-lookahead player, the real pace and, from fast.from, the fast tapper.
function gradeLevel(L, rules, C, hint, seed, n, tag) {
  const B = E.compile(L), win = {}, grade = { cards: B.ncards, pixels: B.pixTotal, colours: G.coloursOf(L).size }, rt = rules[tag];
  const h = hint && typeof hint === "object" ? hint[tag] : hint;
  let order = h, line = order ? R.line(B, rt, order) : null;
  if (!line || !line.won) { order = R.solve(B, rt, C.grade.solveNodes, h); line = order ? R.line(B, rt, order) : null; }
  win[tag] = line && line.won ? order : null;
  const g = (grade[tag] = { rate: +R.rate(B, rt, C.grade.playouts, seed).toFixed(4), peak: line ? line.peak : null, len: order ? order.length : null, ms: line && line.won ? line.ms : null, maxWait: line && line.won ? line.maxWait : null });
  g.greedy = +R.greedy(B, rt, C.grade.greedyPlayouts, seed ^ 0x2545f491).toFixed(3);
  if (win[tag]) { const pc = R.pace(B, rt, win[tag], 0), PC = C.duration.pace; g.pace = pc.won ? { raw: pc.ms, ms: Math.round(pc.ms * PC.factor) } : { raw: null, ms: g.ms, fell: true }; // v4.2: real pace
    if (PC.thinks) g.thinks = PC.thinks.map((th) => (R.pace(B, rt, win[tag], th).won ? 1 : 0)); } // v4.3: the stored order replayed with thinking time (pace.thinks ms) won?
  if (n >= C.fast.from) g.fast = +R.fast(B, rt, C.fast.games, seed ^ 0x1f123bb5, C.fast.gapMs).toFixed(4);
  return { win, grade };
}
// v4.3: a Hard level whose archers stand is dealt rushed (gen.js D.rush): its stored order wins at real pace too.
const rushOf = (L, tag, C) => !!(C.deal.rushHard && tag === "hard" && L.towers && L.towers.length && !L.safeArchers);
// The fast tapper's check (config fast) on a tag's grade g: a level much easier tapped fast than patiently (fast -
// patient >= pts, or fast over ratio x patient and at least minPts over it) is retuned (the picker prefers candidates that pass).
const fastBad = (g, C) => g.fast != null && (g.fast - g.rate >= C.fast.pts || (g.fast > C.fast.ratio * g.rate && g.fast - g.rate >= C.fast.minPts));

// The targets a level's candidate is measured on (shared by the picker and, v5 R2, the re-lay's workers): band, duration
// (the real pace from pace.from, the boss its own range; patient limits before), dead time, the fast tapper, linked pairs
// and the lookahead player on late hard slots. good(c): every target met; pen(c): the fallback's total miss.
function targetsOf(n, C, b, tw) {
  const DU = C.duration, PC = DU.pace, lateHard = b.kind === "late" && b.sub !== "relief";
  const lookT0 = lateHard && C.lookahead ? C.lookahead[b.sub] : null, over = (c) => (lookT0 != null && gt(c).greedy > lookT0 ? 1 : 0);
  const real = PC && n >= PC.from, dLim = n <= DU.earlyTo ? DU.early : real ? (b.sub === "boss" ? PC.boss : PC.range) : [0, DU.maxMs];
  const fell = (c) => (real && (!gt(c).pace || gt(c).pace.fell) ? 1 : 0);
  const dmiss = (c) => { if (fell(c)) return 1e9; const ms = real ? gt(c).pace.ms : gt(c).ms; return ms == null ? 1e9 : Math.max(0, dLim[0] - ms, ms - dLim[1]); };
  const aim = (c) => (real && PC.aim && !fell(c) ? Math.abs(gt(c).pace.ms - PC.aim) : 0); // v4.3: among picks meeting every target, the real pace nearest pace.aim
  const wmiss = (c) => { const w = gt(c).maxWait; return w == null ? 1e9 : Math.max(0, w - C.maxWaitMs); };
  const fbad = (c) => (fastBad(gt(c), C) ? 1 : 0), twMiss = (c) => (c.pairs < tw.links ? 1 : 0);
  const good = (c) => c.miss === 0 && !dmiss(c) && !wmiss(c) && !fbad(c) && !twMiss(c) && !over(c);
  const PN = C.penalty, pen = (c) => PN.band * c.miss + Math.min(dmiss(c), PN.fellMs || 1e9) / PN.durationMs + wmiss(c) / PN.waitMs + PN.fast * fbad(c) + PN.pairs * twMiss(c) + (over(c) ? (gt(c).greedy - lookT0) / PN.lookahead : 0);
  return { lookT0, over, real, dLim, fell, dmiss, aim, wmiss, fbad, twMiss, good, pen };
}
const DECKS = ["kept", "tuned", "dealt", "new board"], rankOf = (c) => DECKS.indexOf(c.deck || "dealt"); // v5 R2: the pick's preference among candidates meeting every target

// All candidates for one generated level. Never throws: failures come back as {fail} entries.
// v5 R2 (--relay): kept {cols, links, hint} is the slot's kept deck on `board` (tried first, then re-tuned); realm: the
// slot's realm (new forts take its edits, tools/relay.js freshEdits); new forts only if nothing on the board meets
// every target.
function candidates(n, C, rules, tw, tag, board, kept, realm) {
  const era = eraOf(n, C), b = bandOf(n, C, tag), [cmin, cmax] = coloursOf(n, C, b), out = [], stats = { forts: 0, deals: 0, evals: 0, grades: 0 };
  const D0 = Object.assign({}, C.deal, C.dealBy[b.kind] || {}, C.dealBy["era" + era] || {}, C.dealBy[b.sub] || {}, (C.dealByLevel || {})[n] || {}, { maxTaps: C.maxTaps, time: rules.hard.time, maxWaitMs: C.maxWaitMs, lockSpaces: rules.hard.lockSpaces }); // v4.3: dealBy.era<e>
  const per = ((C.candidates.perLevelBy && C.candidates.perLevelBy[b.sub]) || C.candidates.perLevel) + (C.extra | 0); // v4.2 --extra
  const TT = targetsOf(n, C, b, tw), T0 = Object.assign({}, C.tune, { seed: seedOf(C, n, 0) ^ 0x3c6ef372, maxTaps: C.maxTaps, maxWaitMs: C.maxWaitMs }, b.kind === "late" && b.sub !== "relief" ? { narrow: C.tune.narrow } : { narrow: null });
  const graded = (L, cols, links, hint, seed, k, deck, extra) => { const level = Object.assign({}, L, { cols }, links && links.length ? { links } : {}), g = gradeLevel(level, rules, C, hint, seed, n, tag); stats.grades++;
    const rate = g.grade[tag].rate, miss = Math.max(0, b.band[0] - rate, rate - b.band[1]);
    return Object.assign({ k, seed, tag, level, win: g.win, grade: g.grade, miss: +miss.toFixed(4), taps: g.win[tag] ? g.win[tag].length : null, pairs: (links || []).length, winnable: !!g.win[tag], deck }, extra || {}); };
  if (kept && board) { // v5 R2: the kept deck as it is, then its squads re-tuned into the band
    try {
      const seed = seedOf(C, n, 0), c0 = graded(board, kept.cols, kept.links, kept.hint, seed, -2, "kept"); out.push(c0);
      if (c0.winnable && TT.good(c0)) return { n, era, band: b, colours: [cmin, cmax], cands: out, stats };
      const RLY = require("./relay.js"), taps = RLY.toTaps(Object.assign({}, board, { cols: kept.cols, links: kept.links }), c0.win[tag] || kept.hint);
      const play = taps.map((t) => (t.part ? [t.card[0], t.card[1], t.part.card[0], t.part.card[1]] : [t.card[0], t.card[1]])), colOf = taps.map((t) => t.col);
      const dealR = Object.assign({}, rules.hard, { hold: C.deal.hold, archersKill: true }, D0);
      const res = G.tune(board, play, colOf, b.band[0], b.band[1], T0, { normal: rules[tag], deal: dealR }); stats.evals += res.evals;
      const dk = G.deck(res.play, res.colOf);
      if (!dk.bad) { const c1 = graded(board, dk.cols, dk.links, G.orderOf(res.colOf), seed, -1, "tuned", { tuneSteps: res.steps }); out.push(c1); if (c1.winnable && TT.good(c1)) return { n, era, band: b, colours: [cmin, cmax], cands: out, stats }; }
    } catch (e) { out.push({ k: -1, fail: "kept deck: " + (e && e.message) }); }
  }
  // v4.3 --boards: every candidate deals the level's own board; only when none of them deals (`fresh`) do `per` more
  // candidates draw new forts (the level is then marked newBoard).
  for (let k = 0, fresh = false; k < (board ? 2 : 1) * per; k++) {
    if (board && k === per) { if (realm ? out.some((c) => c.level && c.winnable && TT.good(c)) : out.some((c) => c.level)) break; fresh = true; } // v5 R2: new forts only if nothing on the board meets every target
    try {
      let L = null, seed = 0;
      if (board && !fresh) { seed = seedOf(C, n, k * 1000); L = JSON.parse(JSON.stringify(board)); }
      for (let t = 0; t < C.candidates.fortTries && !L; t++) {
        seed = seedOf(C, n, k * 1000 + t);
        const P = Object.assign({}, C.eras[era].gen, b.sub === "boss" ? bossOf(n, C).gen : {}, { colours: cmin + (Math.abs(seed) % (cmax - cmin + 1)) }, tw.plan ? { moat: tw.moat, gates: tw.gates, towers: tw.towers, inner: tw.inner } : {}), g0 = C.genBy && C.genBy[b.sub] && C.genBy[b.sub].scale, sc = g0 && typeof g0 === "object" ? g0[era] : g0;
        if (sc) { P.w = P.w.map((v) => Math.round(v * sc)); P.h = P.h.map((v) => Math.round(v * sc)); } // genBy: a slot's boards scaled (reliefs are smaller, and quicker)
        const f = G.fort(era, seed, P, C.picture); stats.forts++;
        if (!f) continue;
        if ((tw.lock === true || tw.lock === "key") && !G.lockKey(f, seed)) continue;
        const nc = G.coloursOf(f).size; if (nc < cmin || nc > cmax) continue;
        if (tw.plan) { // v5 R4: the fort carries what its plan asks, and nothing it doesn't
          const wet = f.grid.some((row) => row.indexOf("~") >= 0), ng = (f.gates || []).length, nt = (f.towers || []).length;
          if (wet !== tw.moat || (tw.gates ? ng < 1 : ng > 0) || (tw.towers ? nt < 1 : nt > 0)) continue;
          if (tw.hidden && !G.hide(f, seed, C.plan.hidden)) continue;
          if (tw.lock === "colour") f.lock = { colour: [...G.coloursOf(f)].sort((a, b) => a - b)[0] }; // a stand-in (the dealer plays it shut); the colour is set from the deal
        } else {
        if (era >= 2 && !(f.gates && f.gates.length)) continue; // every fort from Era 2 has a gate (v4 M3: so Era 3 keeps its moat)
        if (era >= 3 && !(f.towers && f.towers.length)) continue;
        }
        if (realm) require("./relay.js").freshEdits(f, realm, tag); // v5 R2: a new fort takes its realm's edits (drawbridges open, towers plain)
        delete f.roles; L = f; // v4.1: the picture's roles are the generator's business; pal (colours, names) ships
      }
      if (!L) { out.push({ k, fail: "no fort with " + cmin + "-" + cmax + " colours in " + C.candidates.fortTries + " seeds" }); continue; }
      const D = Object.assign({}, D0, rushOf(L, tag, C) ? { rush: true } : {}), dealRules = Object.assign({}, rules.hard, { hold: C.deal.hold, archersKill: true }, D.rush ? { rush: true } : {});
      let dl = null; const tr = process.env.BAKE_TRACE ? (s) => console.log("  trace " + n + "/" + k + " " + s + " " + ((Date.now() - tr0) / 1000).toFixed(1) + " s") : null, tr0 = Date.now(); // v5 R4: BAKE_TRACE=1 times each stage
      for (let a = 0; a < D.attempts && !dl; a++) { dl = G.deal(L, seed ^ Math.imul(a + 1, 0x27D4EB2F), D); stats.deals++; }
      if (tr) tr("deal " + (dl ? dl.play.length + " squads" : "none"));
      if (!dl) { out.push({ k, seed, fail: "no deal in " + D.attempts + " attempts" }); continue; }
      const play = tw.links ? G.linkUp(L, dl.play, tw.links, seed, D) : dl.play;
      if (tw.lock === "colour") { const first = new Map(); play.forEach((p, i) => { for (const m of p.length >= 4 ? [p[0], p[2]] : [p[0]]) if (!first.has(m) && m !== E.GILT) first.set(m, i); }); // v5 R4: the colour whose first squad comes nearest relay.lockAt of the order
        const want = C.relay.lockAt * play.length, best = [...first].sort((p, q) => Math.abs(p[1] - want) - Math.abs(q[1] - want) || p[1] - q[1])[0]; if (best) L.lock = { colour: best[0] }; }
      const T = Object.assign({}, C.tune, { seed: seed ^ 0x3c6ef372, maxTaps: C.maxTaps, maxWaitMs: C.maxWaitMs }, b.kind === "late" && b.sub !== "relief" ? { narrow: C.tune.narrow } : { narrow: null });
      const Lt = L.hidden ? Object.assign({}, L, { hidden: undefined }) : L; // v5 R4: tuned all-seeing (the lookahead with mystery blocks samples 4 boards a tap, too slow to hill-climb; seeing more only makes it stronger, so the honest grade below stays at or under the target)
      const res = G.tune(Lt, play, G.assign(play, 0, seed), b.band[0], b.band[1], T, { normal: rules[tag], deal: dealRules }); // v4.3: tuned on the tag's rules
      stats.evals += res.evals; if (tr) tr("tune " + res.evals + " evals");
      const dk = G.deck(res.play, res.colOf);
      if (dk.bad) { out.push({ k, seed, fail: "a linked partner more than a row from its card" }); continue; }
      const level = Object.assign({}, L, { cols: dk.cols }, dk.links.length ? { links: dk.links } : {});
      const g = gradeLevel(level, rules, C, G.orderOf(res.colOf), seed, n, tag); stats.grades++;
      const rate = g.grade[tag].rate, miss = Math.max(0, b.band[0] - rate, rate - b.band[1]);
      out.push(Object.assign({ k, seed, tag, level, win: g.win, grade: g.grade, miss: +miss.toFixed(4), tuneSteps: res.steps, taps: res.play.length, pairs: dk.links.length, winnable: !!g.win[tag], deck: board && !fresh ? "dealt" : "new board" }, D.rush ? { rush: true } : {}, (board ? fresh : !!realm) ? { newBoard: true } : {}));
    } catch (e) { out.push({ k, fail: "error: " + (e && e.message) + (process.env.BAKE_STACK ? " " + e.stack : "") }); }
  }
  return { n, era, band: b, colours: [cmin, cmax], cands: out, stats };
}

// The mystery cards (v4 M3): `want` flags on cards dealt in the rows just behind the fronts (config mystery.rows), never
// a linked card and never two in a row in one column. Each placement is measured by the sampling planner, honest and
// all-seeing (common seeds); the first within mystery.maxGap is kept, else the smallest gap after mystery.tries, with
// one flag fewer on each later try (never under 2). Returns {level, m} (m: the report's measures).
function mystify(L, want, C, rt, seed) { // v4.3: rt, the level's tag's rules
  const M = C.mystery, r = R.rng(seed ^ 0x6a09e667), linked = new Set();
  for (const P of L.links || []) for (const q of P) linked.add(q[0] + "," + q[1]);
  let best = null;
  for (let t = 0; t < M.tries; t++) {
    const k = Math.max(2, want - t), spots = [];
    L.cols.forEach((col, j) => col.forEach((cd, i) => { if (i >= M.rows[0] && i <= M.rows[1] && !linked.has(j + "," + i)) spots.push([j, i]); }));
    for (let i = spots.length - 1; i > 0; i--) { const q = Math.floor(r() * (i + 1)); [spots[i], spots[q]] = [spots[q], spots[i]]; }
    const got = [];
    for (const [j, i] of spots) { if (got.length >= k) break; if (got.some(([a, b]) => a === j && Math.abs(b - i) < 2)) continue; got.push([j, i]); }
    if (got.length < 2) break;
    const T = JSON.parse(JSON.stringify(L)); for (const [j, i] of got) T.cols[j][i][2] = E.MYSTERY;
    const B = E.compile(T), honest = R.plan(B, rt, M.games, seed ^ 0x3243f6a8, M.samples, false), seeing = R.plan(B, rt, M.games, seed ^ 0x3243f6a8, M.samples, true);
    const m = { cards: got.length, honest: +honest.toFixed(3), seeing: +seeing.toFixed(3), gap: +(seeing - honest).toFixed(3), tries: t + 1 };
    if (!best || m.gap < best.m.gap) best = { level: T, m };
    if (m.gap <= M.maxGap) break;
  }
  return best || { level: L, m: null };
}
// The second pass on a picked level: winning-order counts and safe taps per turn (report only), and the mystery flags.
function finish(task, C, rules) {
  const { L, want, seed, tag } = task, B0 = E.compile(L), x = {}, rt = rules[tag];
  const oc = R.orders(B0, rt, C.grade.orderCap, C.grade.orderNodes); x.orders = oc.count; x.ordersCapped = oc.capped; x.ordersExact = oc.exact;
  if (L.win && L.win[tag]) { const nw = R.narrow(B0, rt, L.win[tag], C.grade.narrowNodes); x.forced = nw.forced; x.minSafe = nw.minSafe; x.meanSafe = nw.meanSafe; x.narrowUnknown = nw.unknown; }
  let level = L, m = null;
  if (want) ({ level, m } = mystify(L, want, C, rt, seed));
  else if (L.cols.some((c) => c.some((cd) => cd[2]))) { const B = E.compile(L); m = { cards: L.cols.flat().filter((cd) => cd[2]).length, honest: R.plan(B, rt, C.mystery.games, seed ^ 0x3243f6a8, C.mystery.samples, false), seeing: R.plan(B, rt, C.mystery.games, seed ^ 0x3243f6a8, C.mystery.samples, true), tries: 0, authored: true }; m.gap = +(m.seeing - m.honest).toFixed(3); }
  return { n: task.n, cols: level.cols, x, m };
}

if (!isMainThread) {
  const { job, C, rules } = workerData;
  let res;
  try { res = job.kind === "finish" ? finish(job, C, rules) : candidates(job.n, C, rules, job.tw, job.tag, job.board, job.kept, job.realm); }
  catch (e) { res = job.kind === "finish" ? { n: job.n, fail: "worker error: " + (e && e.message) } : { n: job.n, cands: [{ fail: "worker error: " + (e && e.message) }], stats: {} }; }
  parentPort.postMessage(res);
  return;
}

// ---- main ------------------------------------------------------------------------------------------------------
function runPool(jobs, threads, C, rules, deadline, onDone) {
  const results = new Array(jobs.length); let next = 0, running = 0, done = 0;
  return new Promise((resolve) => {
    const pump = () => {
      if (done === jobs.length) { resolve(results); return; }
      while (running < threads && next < jobs.length) {
        const i = next++; running++;
        if (Date.now() > deadline) { results[i] = { n: jobs[i].n, fail: "wall budget", cands: [{ fail: "wall budget" }], stats: {} }; running--; done++; continue; }
        const wk = new Worker(__filename, { workerData: { job: jobs[i], C, rules } });
        let got = false;
        wk.on("message", (m) => { got = true; results[i] = m; });
        wk.on("error", (e) => { console.log("worker error (level " + jobs[i].n + "): " + e.message); });
        wk.on("exit", () => { if (!got) results[i] = { n: jobs[i].n, fail: "worker died", cands: [{ fail: "worker died" }], stats: {} }; running--; done++; if (onDone) onDone(done, jobs.length); pump(); });
      }
      if (done === jobs.length) resolve(results);
    };
    pump();
  });
}
function nearDup(A, B, frac) {
  if (A.w !== B.w || A.h !== B.h) return false;
  let same = 0; for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (A.grid[y][x] === B.grid[y][x]) same++;
  return same / (A.w * A.h) >= frac;
}
function writeAtomic(file, text) { const tmp = file + ".tmp"; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }
const pct = (x) => (x == null ? "-" : (100 * x).toFixed(1) + "%");
const secs = (ms) => (ms == null ? "-" : (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + " s");
const med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; };

(async () => {
  const t0 = Date.now(), log = [], say = (s) => { log.push(s); console.log(s); };
  let C, CFG, TEACH;
  try {
    C = JSON.parse(fs.readFileSync(arg("config") ? path.resolve(arg("config")) : path.join(__dirname, "bake-config.json"), "utf8")); C.extra = +arg("extra") || 0; // v4.2: --extra K more candidates a level (a fix-up run)
    if (process.argv.includes("--r4fix")) { Object.assign(C.candidates.perLevelBy, C.r4fix.perLevelBy); Object.assign(C.tune.narrow, C.r4fix.narrow); } // v5 R4: the fix-up's lighter search
    CFG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
    TEACH = JSON.parse(fs.readFileSync(arg("teach") ? path.resolve(arg("teach")) : path.join(ROOT, "levels/teaching.json"), "utf8")).levels;
  } catch (e) { console.log("bake: cannot read config: " + e.message); process.exitCode = 1; return; }
  const rules = { easy: E.rulesOf(CFG.v3, "easy"), normal: E.rulesOf(CFG.v3, "normal"), hard: E.rulesOf(CFG.v3, "hard"), extreme: E.rulesOf(CFG.v3, "extreme") }, deadline = t0 + C.budget.wallSec * 1000;
  const threads = +arg("threads") || C.budget.threads || Math.max(2, os.cpus().length - 2); // v4.3 --threads N
  const teachBy = new Map(TEACH.map((L) => [L.n, L]));
  const inRun = (n) => (LIST ? LIST.indexOf(n) >= 0 : !ONLY || (n >= ONLY[0] && n <= (ONLY[1] || ONLY[0])));
  const tagN = (n) => TG.tagOf(n, C.tags, teachBy.has(n)); // v4.3: the level's fixed tag
  // v4.3 --merge FULL,FIX1,... [--logs LOG,...]: no bake; FULL's levels with each fix-up run's levels (by n) in their place
  // (fix-up runs: --only N-N --keep FULL), the bake record's lists and the variety redone, written with the report.
  if (arg("merge")) {
    const files = arg("merge").split(",").map((f) => JSON.parse(fs.readFileSync(path.resolve(f), "utf8"))), out = files[0], fixed = [];
    files.slice(1).forEach((F, k) => { const run = F.bake.run || []; for (const l of F.levels) { if (run.length && run.indexOf(l.n) < 0) continue; const i = out.levels.findIndex((x) => x.n === l.n); if (i >= 0) out.levels[i] = l; else out.levels.push(l); fixed.push(l.n); } // v5 R2: a level the full run missed goes in too
      for (const key of ["fallbacks", "lookaheadFallbacks", "varietyMisses", "paceFell", "newBoards"]) { const mine = (F.bake[key] || []).filter((x) => run.indexOf(typeof x === "number" ? x : x.n) >= 0);
        out.bake[key] = (out.bake[key] || []).filter((x) => run.indexOf(typeof x === "number" ? x : x.n) < 0).concat(mine); } });
    out.levels.sort((p, q) => p.n - q.n); out.bake.fixups = fixed; out.bake.variety = VAR.eraReport(out.levels, C.variety);
    if (out.bake.relay) { const dk = {}; for (const l of out.levels) if (l.deck) dk[l.deck] = (dk[l.deck] || 0) + 1; out.bake.relay.decks = dk; } // v5 R2: the decks recounted
    for (const f of (arg("logs") || "").split(",").filter(Boolean)) for (const line of fs.readFileSync(path.resolve(f), "utf8").split("\n")) if (line && !/^ {2}/.test(line)) log.push(line);
    say("bake: merged fix-up level(s) " + fixed.join(", ") + " into " + arg("merge").split(",")[0] + "; fallbacks now " + out.bake.fallbacks.length + (out.bake.fallbacks.length ? " (" + out.bake.fallbacks.map((x) => x.n).join(", ") + ")" : ""));
    try { if (OUT) fs.mkdirSync(OUT, { recursive: true }); writeAtomic(outPath("levels/levels.json"), JSON.stringify(out)); writeReport(out, C, log); } catch (e) { say("bake merge failed: " + e.message); process.exitCode = 1; }
    return;
  }
  const BOARDS = arg("boards") ? new Map(JSON.parse(fs.readFileSync(path.resolve(arg("boards")), "utf8")).levels.map((l) => [l.n, boardOf(l)])) : null;
  // v5 R2 --relay: the slot map (tools/relay.js) gives every generated slot its board, kept deck and twists.
  const RLY = RELAY ? (() => { const RL = require("./relay.js"), S = RL.source(C, arg("src"), arg("srcTeach")); return new Map(RL.relay(S.SRC, S.TEACH, C, CFG).slots.map((x) => [x.n, x])); })() : null;
  const jobs = []; for (let n = 1; n <= C.levels; n++) if (!teachBy.has(n) && inRun(n)) {
    const x = RLY && RLY.get(n);
    if (RLY && (!x || x.teaching)) { say("level " + n + ": the re-lay gives no generated slot here (a teaching level missing from the teaching file?)"); continue; }
    if (x && x.tag !== tagN(n)) say("level " + n + ": the re-lay's tag " + x.tag + " is not the schedule's " + tagN(n));
    jobs.push(x ? { kind: "cand", n, tag: tagN(n), tw: x.twists, board: x.level ? boardOf(x.level) : null, kept: x.level ? { cols: x.level.cols, links: x.level.links || [], hint: x.hint } : null, realm: x.realm, from: x.from, edits: x.edits }
      : { kind: "cand", n, tag: tagN(n), tw: C.plan && n >= C.plan.from ? planOf(n, C, tagN(n), CFG.v5.density) : twistsOf(n, C, teachBy), board: BOARDS && BOARDS.get(n) }); // v5 R4: the plan
  }
  for (const j of jobs) if (!RLY && j.board && !!j.board.lock !== !!j.tw.lock) { say("level " + j.n + ": the kept board's lock does not match the level's twists; a new fort is drawn"); j.board = null; }
  say("bake v" + C.version + ": " + C.levels + " levels, " + jobs.length + " generated on " + threads + " threads" + (ONLY ? " (only " + ONLY.join("-") + ")" : "") + (BOARDS ? ", boards kept from " + arg("boards") + " (" + jobs.filter((j) => j.board).length + ")" : "") + (RLY ? ", re-laid from v4.3 (" + C.relay.src + "; " + jobs.filter((j) => j.kept).length + " kept decks)" : ""));
  const results = await runPool(jobs, threads, C, rules, deadline, (d, t) => { if (d % 10 === 0 || d === t) console.log("  " + d + "/" + t + " levels  " + ((Date.now() - t0) / 1000).toFixed(1) + " s"); });
  const byN = new Map(results.map((r) => [r.n, r]));
  const tot = { forts: 0, deals: 0, evals: 0, grades: 0 };
  for (const r of results) for (const k of Object.keys(tot)) tot[k] += (r.stats && r.stats[k]) || 0;
  const t1 = Date.now();

  const levels = [], fallbacks = [], lookMiss = [], varMiss = [], paceFell = [], newBoards = [], pools = {}, DU = C.duration, VC = C.variety, maps = {}, decks = {};
  for (const e of Object.keys(C.eras)) if (C.eras[e].from) { pools[e] = []; maps[e] = []; } // v5 R2: one per realm
  // v4.2 --keep FILE: the levels outside --only come from FILE as they are, and count as earlier picks (variety, dedupe).
  const KEEP = arg("keep") && ONLY ? JSON.parse(fs.readFileSync(path.resolve(arg("keep")), "utf8")).levels.filter((l) => !inRun(l.n)) : [];
  for (const l of KEEP) { levels.push(l); if (l.source !== "teaching" && maps[l.era]) maps[l.era].push(VAR.mapOf(l, VC)); }
  if (KEEP.length) say("bake: " + KEEP.length + " levels outside " + ONLY.join("-") + " kept as they are from " + arg("keep"));
  for (let n = 1; n <= C.levels; n++) {
    if (!inRun(n)) continue;
    const tag = tagN(n), b = bandOf(n, C, tag), era = eraOf(n, C), id = "e" + era + "-" + String(n).padStart(2, "0");
    if (teachBy.has(n)) {
      const T = teachBy.get(n), L = Object.assign({ w: T.w, h: T.h, grid: T.grid }, T.pic ? { pic: true } : {}, { gates: T.gates || [], towers: T.towers || [], cols: T.cols }, T.links ? { links: T.links } : {}, T.lock ? { lock: T.lock } : {}, T.safeArchers ? { safeArchers: true } : {}, T.pal ? { pal: T.pal } : {}, T.palette ? { palette: T.palette } : {}, T.hidden ? { hidden: T.hidden } : {}, T.liquid ? { liquid: T.liquid } : {}); // v5 R4: mystery blocks, a lava moat
      if (T.tag && T.tag !== tag) say("level " + n + ": the teaching file's tag " + T.tag + " is not the schedule's " + tag);
      let g; try { g = gradeLevel(L, rules, C, T.win || null, seedOf(C, n, 0), n, tag); } catch (e) { say("level " + n + ": teaching level failed to grade: " + e.message); continue; }
      if (!g.win[tag]) say("level " + n + ": teaching level NOT winnable on its tag (" + tag + ")");
      levels.push(Object.assign({ id, n, era, source: "teaching", name: T.name, teaches: T.teaches, hint: T.hint, tag, band: b.sub, target: b.band }, L, { win: g.win, grade: g.grade, exempt: "teaching" }));
      continue;
    }
    const job = jobs.find((j) => j.n === n), r = byN.get(n), cands = (r && r.cands) || [], ok = cands.filter((c) => c.level && c.winnable), tw = job ? job.tw : twistsOf(n, C, teachBy);
    for (const c of ok) pools[era].push({ n, k: c.k, seed: c.seed, band: b.sub, target: b.band, miss: c.miss, grade: c.grade, win: c.win, level: c.level });
    for (const c of cands) if (c.fail) say("level " + n + " candidate " + c.k + ": " + c.fail);
    const mid = (b.band[0] + b.band[1]) / 2;
    // Late hard slots: the lookahead player's target (C.lookahead). Duration (C.duration): the patient play-through on the
    // stored Normal line inside the level's limits. Dead time (C.maxWaitMs): its longest single tap. Fast tapper (C.fast).
    // v4.3: every measure on the level's tag (gt: the candidate's grade on it); a lost real-pace replay is a duration miss.
    // v5 R2: the targets are targetsOf's (the re-lay's workers use them too).
    const PC = DU.pace, { lookT0, over, real, dLim, fell, dmiss, aim, wmiss, fbad, twMiss, good, pen } = targetsOf(n, C, b, tw);
    const aimW = PC && PC.aimWeight ? PC.aimWeight : 0; // pace.aimWeight: ms of real pace from pace.aim worth one point (1%) of rate from the band's middle
    const rob = (c) => (gt(c).thinks ? gt(c).thinks.length - gt(c).thinks.reduce((a, x) => a + x, 0) : 0); // v4.3: replays with thinking time that lose
    ok.sort((p, q) => (p.miss > 0) - (q.miss > 0) || (dmiss(p) > 0) - (dmiss(q) > 0) || (wmiss(p) > 0) - (wmiss(q) > 0) || fbad(p) - fbad(q) || twMiss(p) - twMiss(q) || (good(p) && good(q) ? rankOf(p) - rankOf(q) : 0) || p.miss - q.miss || dmiss(p) - dmiss(q) || wmiss(p) - wmiss(q)
      || over(p) - over(q) || (over(p) ? gt(p).greedy - gt(q).greedy : 0) || rob(p) - rob(q) || (100 * Math.abs(gt(p).rate - mid) + (aimW ? aim(p) / aimW : 0)) - (100 * Math.abs(gt(q).rate - mid) + (aimW ? aim(q) / aimW : 0)) || p.k - q.k);
    const alike = (c) => { if (c.alike == null) { const m = VAR.mapOf(c.level, VC); c.map = m; c.alike = maps[era].length ? med(maps[era].map((q) => VAR.match(m, q))) : 0; } return c.alike; };
    // When no candidate meets every target, the fallback is the one that misses least overall (C.penalty: a band miss of
    // 1 point, 30 s of duration, 3 s of dead time, a fast-tapper flag, a missing pair or 25 points of lookahead over its
    // target each count about 1), so a few seconds over the time limit never outweighs a lookahead of 99%.
    let pickC = null, why = null;
    for (const c of ok) { if (!good(c)) break; if (alike(c) <= VC.maxMedian && !levels.some((L) => nearDup(L, c.level, C.dedupe.sameCells))) { pickC = c; break; } }
    if (!pickC) { const gv = ok.filter((c) => good(c) && !levels.some((L) => nearDup(L, c.level, C.dedupe.sameCells))).sort((p, q) => alike(p) - alike(q) || p.k - q.k);
      if (gv.length) { pickC = gv[0]; varMiss.push({ n, alike: +alike(pickC).toFixed(3) }); say("level " + n + ": variety, the least alike candidate meeting every target is " + pct(alike(pickC)) + " alike its era's earlier picks (median; target " + pct(VC.maxMedian) + ")"); } }
    if (!pickC) {
      const rest = ok.filter((c) => !levels.some((L) => nearDup(L, c.level, C.dedupe.sameCells))).sort((p, q) => pen(p) - pen(q) || p.k - q.k);
      pickC = rest[0] || ok[0] || null;
      const w = []; if (!ok.length) w.push("no winnable candidate");
      else {
        const g = gt(pickC);
        if (pickC.miss > 0) w.push("out of band: " + tag + " " + pct(g.rate) + " vs " + pct(b.band[0]) + "-" + pct(b.band[1]));
        if (fell(pickC)) w.push("the real-pace replay lost on " + tag);
        else if (dmiss(pickC) > 0) w.push((real ? "real pace " + secs(g.pace.ms) : "duration " + secs(g.ms)) + " outside " + dLim[0] / 1000 + "-" + dLim[1] / 1000 + " s");
        if (wmiss(pickC) > 0) w.push("longest tap " + secs(g.maxWait) + " over " + C.maxWaitMs / 1000 + " s");
        if (fbad(pickC)) w.push("fast tapper " + pct(g.fast) + " vs patient " + pct(g.rate));
        if (twMiss(pickC)) w.push("linked pairs " + pickC.pairs + " of " + tw.links);
        if (over(pickC)) w.push("lookahead " + pct(g.greedy) + " over " + pct(lookT0));
        if (!w.length) w.push("near-duplicate of an earlier level");
      }
      why = w.join("; ");
    }
    if (!pickC) { fallbacks.push({ n, why }); say("level " + n + ": NO LEVEL (" + why + ")"); continue; }
    if (why) { fallbacks.push({ n, why }); say("level " + n + ": fallback, " + why); }
    if (real && gt(pickC).pace && gt(pickC).pace.fell) { paceFell.push(n); say("level " + n + ": the real-pace replay lost; its patient time stands in"); }
    const lookT = lookT0, look = gt(pickC).greedy;
    if (lookT != null && look > lookT) { lookMiss.push({ n, sub: b.sub, look }); say("level " + n + ": lookahead fallback, " + pct(look) + " over the " + pct(lookT) + " target (" + ok.filter((c) => c.miss === 0).length + " in-band candidates)"); }
    if (pickC.newBoard) { newBoards.push(n); say("level " + n + (RLY ? (job && job.from ? ": no candidate on its kept board (" + job.from + ") met every target; a new board" : ": the re-lay has no board for this slot; a new board") : ": its kept board would not deal" + (pickC.rush ? " rushed (Hard, archers)" : "") + "; a new board at the same size")); }
    if (job && job.realm) decks[pickC.deck] = (decks[pickC.deck] || 0) + 1;
    levels.push(Object.assign({ id, n, era, source: "gen", seed: pickC.seed, tag, band: b.sub, target: b.band, twists: tw }, job && job.realm ? { from: pickC.deck === "new board" ? null : job.from, edits: job.edits, deck: pickC.deck } : {}, pickC.level, { win: pickC.win, grade: pickC.grade, inBand: pickC.miss === 0 }, pickC.rush ? { rush: true } : {}, why ? { fallback: why } : {}));
    maps[era].push(pickC.map || VAR.mapOf(pickC.level, VC));
  }
  say("bake: " + levels.length + " levels picked in " + ((t1 - t0) / 1000).toFixed(1) + " s; forts " + tot.forts + ", deals " + tot.deals + ", tune evaluations " + tot.evals + ", full grades " + tot.grades + " (each on its level's tag)");

  // Second pass: order counts and safe taps (report only), the mystery flags and their planner measures.
  const fin = levels.filter((l) => inRun(l.n)).map((l) => ({ kind: "finish", n: l.n, tag: l.tag, L: { w: l.w, h: l.h, grid: l.grid, pic: l.pic, gates: l.gates, towers: l.towers, cols: l.cols, links: l.links, lock: l.lock, safeArchers: l.safeArchers, hidden: l.hidden, win: l.win }, want: l.twists ? l.twists.mystery : 0, seed: l.seed || seedOf(C, l.n, 0) }));
  const done = await runPool(fin, threads, C, rules, Date.now() + C.budget.finishSec * 1000, (d, t) => { if (d % 20 === 0 || d === t) console.log("  finish " + d + "/" + t + "  " + ((Date.now() - t0) / 1000).toFixed(1) + " s"); });
  for (const f of done) {
    const l = levels.find((x) => x.n === f.n); if (!l) continue;
    if (f.fail) { say("level " + f.n + ": second pass failed (" + f.fail + ")"); continue; }
    Object.assign(gt(l), f.x); if (f.m) gt(l).mystery = f.m;
    if (f.cols) l.cols = f.cols;
    if (f.m && f.m.gap > C.mystery.maxGap) { fallbacks.push({ n: f.n, why: "mystery gap " + pct(f.m.gap) + " over " + pct(C.mystery.maxGap) }); say("level " + f.n + ": mystery fallback, planner gap " + pct(f.m.gap)); }
  }
  const secsAll = (Date.now() - t0) / 1000, graded = tot.evals + tot.grades;
  say("bake: " + levels.length + " levels in " + secsAll.toFixed(1) + " s (candidates " + ((t1 - t0) / 1000).toFixed(0) + " s, second pass " + ((Date.now() - t1) / 1000).toFixed(0) + " s)");
  say("bake: " + (graded / ((t1 - t0) / 1000)).toFixed(0) + " graded candidate decks per second across " + threads + " threads");
  const gen = levels.filter((l) => !l.exempt);
  for (const sub of ["hard", "hardest", "boss"]) { const g = gen.filter((l) => l.band === sub).map((l) => gt(l).greedy); if (g.length) say("bake: lookahead player on " + sub + " (on each level's tag): median " + pct(med(g)) + ", max " + pct(Math.max(...g)) + " over " + g.length + " levels"); }
  { const ms = gen.map((l) => gt(l).ms).filter((x) => x != null), all = levels.map((l) => gt(l).ms).filter((x) => x != null), early = gen.filter((l) => l.n <= DU.earlyTo).map((l) => gt(l).ms);
    if (ms.length) say("bake: patient play-through on the stored line at 1x (generated levels): median " + secs(med(ms)) + ", max " + secs(Math.max(...ms)) + (early.length ? "; early " + secs(Math.min(...early)) + "-" + secs(Math.max(...early)) : "") + "; all levels median " + secs(med(all)) + ", " + secs(Math.min(...all)) + "-" + secs(Math.max(...all)));
    const w = levels.map((l) => gt(l).maxWait).filter((x) => x != null); if (w.length) say("bake: longest single tap on the stored line: median " + secs(med(w)) + ", max " + secs(Math.max(...w)) + " (cap " + C.maxWaitMs / 1000 + " s)"); }
  { const PC = C.duration.pace, rp = levels.filter((l) => PC && l.n >= PC.from && gt(l).pace), g = rp.filter((l) => !l.exempt && !gt(l).pace.fell), ms = g.map((l) => gt(l).pace.ms), boss = rp.find((l) => l.band === "boss");
    if (ms.length) say("bake: real pace (stored order on the level's tag, a tap the moment a space is free, x " + PC.factor + ") on generated levels " + PC.from + "+: median " + secs(med(ms)) + ", " + secs(Math.min(...ms)) + "-" + secs(Math.max(...ms)) + (boss ? "; boss " + secs(gt(boss).pace.ms) : "") + "; replays that lost " + rp.filter((l) => gt(l).pace.fell).length + "; by tag " + TG.TAGS.map((t) => { const q = g.filter((l) => l.tag === t).map((l) => gt(l).pace.ms); return t + " " + (q.length ? secs(med(q)) + " (" + q.length + ")" : "-"); }).join(", ")); }
  levels.sort((a, b) => a.n - b.n);
  const variety = VAR.eraReport(levels, VC);
  for (const e of Object.keys(variety)) { const v = variety[e]; say("bake: variety, era " + e + ": median match " + pct(v.median) + " over " + v.n + " generated pictures (gate " + pct(VC.maxMedian) + (v.median > VC.maxMedian ? ": VARIETY GATE FAILED" : "") + "), most alike " + v.worst.a + " and " + v.worst.b + " at " + pct(v.worst.m)); }
  say("bake: tags " + TG.TAGS.map((t) => t + " " + levels.filter((l) => l.tag === t).length).join(", ") + "; taps per level: max " + Math.max(...levels.map((l) => wn(l) ? wn(l).length : 0)) + " (cap " + C.maxTaps + "), median " + med(levels.map((l) => (wn(l) ? wn(l).length : 0))) + "; cards max " + Math.max(...levels.map((l) => l.grade.cards)));
  const out = { version: C.version, bake: { config: C.version, seed: C.seed, time: CFG.v3.time, forts: tot.forts, deals: tot.deals, tuneEvals: tot.evals, fullGrades: tot.grades, seconds: +secsAll.toFixed(1), fallbacks, lookaheadFallbacks: lookMiss, variety, varietyMisses: varMiss, paceFell, newBoards, run: ONLY ? levels.filter((l) => inRun(l.n)).map((l) => l.n) : undefined }, levels };
  if (RLY) { out.bake.relay = { src: C.relay.src, dropped: C.relay.drop, decks }; say("bake: the re-lay's decks: " + DECKS.map((d) => d + " " + (decks[d] || 0)).join(", ") + " (generated slots)"); }
  try {
    if (OUT) fs.mkdirSync(OUT, { recursive: true });
    writeAtomic(outPath("levels/levels.json"), JSON.stringify(out));
    for (const e of Object.keys(pools)) if (pools[e].length) writeAtomic(outPath("levels/pool-e" + e + ".json"), JSON.stringify({ version: C.version, era: +e, cands: pools[e] })); // v4.2: a partial run leaves the other eras' pools alone (v5 R2: and a realm with none)
  } catch (e) { say("bake: write failed: " + e.message); process.exitCode = 1; }
  try { writeReport(out, C, log); } catch (e) { say("bake: report tables failed: " + e.message); }
})();

// ---- report tables (between the markers in tools/v4.3-rebake.md) --------------------------------------------------
function writeReport(out, C, log) {
  const file = arg("report") ? path.resolve(arg("report")) : outPath(RELAY ? "tools/v5-r2-relay.md" : "tools/v4.3-rebake.md"), A = "<!-- bake:start -->", Z = "<!-- bake:end -->"; // v5 R2: the re-lay's own report; v5 R4: --report FILE
  const L = out.levels, rows = [], minDE = (l) => (l.palette ? l.palette.minDE : (() => { const s = new Set(); for (const row of l.grid) for (const ch of row) { const m = E.matOf(ch); if (m) s.add(m); } return PAL.minPair([...s]).min; })());
  const twOf = (l) => { const t = []; if (l.gates && l.gates.length) t.push("gates " + l.gates.length); if (l.towers && l.towers.length) t.push("archers " + l.towers.length); const mc = l.cols.flat().filter((cd) => cd[2]).length; if (mc) t.push("? " + mc); if (l.links && l.links.length) t.push("linked " + l.links.length); if (l.lock) t.push(l.lock.colour ? "colour lock " + l.lock.colour : "key lock"); if (l.grid.some((r) => r.indexOf("~") >= 0)) t.unshift("moat"); return t.join(", ") || "-"; };
  rows.push("### Bands (each level's random-tap rate on its own tag)", "", "| Band | Levels | Tags E/N/H | In band | Exempt (teaching) | Rate min | median | max |", "|---|---|---|---|---|---|---|---|");
  for (const kind of ["early", "saw0", "saw1", "saw2", "hard", "hardest", "relief", "boss"]) {
    const ls = L.filter((l) => l.band === kind); if (!ls.length) continue;
    const gen = ls.filter((l) => !l.exempt), rs = ls.map((l) => gt(l).rate), t = ls[0].target;
    rows.push(`| ${kind} ${pct(t[0])}-${pct(t[1])} | ${ls.length} | ${TG.TAGS.map((x) => ls.filter((l) => l.tag === x).length).join("/")} | ${gen.filter((l) => l.inBand).length}/${gen.length} | ${ls.length - gen.length} | ${pct(Math.min(...rs))} | ${pct(med(rs))} | ${pct(Math.max(...rs))} |`);
  }
  if (out.bake.variety) { rows.push("", "### Variety (picture cells matching within an era; gate " + pct(C.variety.maxMedian) + ")", "", "| Era | Generated pictures | Median match | 10th percentile | Most alike pair |", "|---|---|---|---|---|");
    for (const e of Object.keys(out.bake.variety)) { const v = out.bake.variety[e]; rows.push(`| ${e} | ${v.n} | ${pct(v.median)}${v.median > C.variety.maxMedian ? " (over)" : ""} | ${pct(v.p10)} | ${v.worst.a} and ${v.worst.b}, ${pct(v.worst.m)} |`); } }
  rows.push("", "### Every level", "", (RELAY ? "v5 R2: from = the v4.3 level the board came from; deck = kept (as re-laid), tuned (the kept squads re-tuned), dealt (dealt again on the board) or new board; edits = tools/relay.js's. Every level has 5 spaces and archers never kill. " : "") + "Every measure is on the level's own tag (v4.3: Easy 6 spaces, Normal 5, Hard 4 with archers lethal). Rate = the random-tap rate (" + C.grade.playouts + " games); lookahead = the one-move-lookahead player (" + C.grade.greedyPlayouts + "); fast = the fast tapper (" + C.fast.games + ", from level " + C.fast.from + "); ? planner = the sampling planner honest / all-seeing (" + C.mystery.games + " games); patient time and longest wait = patient play on the stored line at 1x; real pace = the stored order replayed tapping the moment a space is free, times " + (C.duration.pace ? C.duration.pace.factor : 1) + " (Peter's pace; * the replay lost, patient time shown); thinking = the same replay waiting " + ((C.duration.pace && C.duration.pace.thinks) || []).map((x) => x / 1000).join(" / ") + " s after each tap, won (W) or lost (L); R = dealt rushed (a Hard level with standing archers: its stored order also wins at real pace); taps = the stored order's taps (cards); ΔE = the smallest CIEDE2000 between two colours standing in the level.", "",
    "| # | Era | Tag | Band | " + (RELAY ? "From | Deck | Edits | " : "") + "Twists | Board | Pixels | Colours | Min ΔE00 | Taps (cards) | Rate | Lookahead | Fast | ? planner | Real pace | Thinking | Patient | Longest wait | Note |", "|---|---|---|---|" + (RELAY ? "---|---|---|" : "") + "---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const l of L) {
    const g = gt(l), m = g.mystery;
    rows.push(`| ${l.n} | ${l.era} | ${l.tag} | ${l.band} | ${RELAY ? (l.from || "-") + " | " + (l.deck || (l.source === "teaching" ? "teaching" : "-")) + " | " + ((l.edits || []).join(", ") || "-") + " | " : ""}${twOf(l)} | ${l.w}×${l.h} | ${l.grade.pixels} | ${l.grade.colours} | ${minDE(l) != null ? minDE(l).toFixed(1) : "-"} | ${wn(l) ? wn(l).length : "-"} (${l.grade.cards}) | ${pct(g.rate)} | ${pct(g.greedy)} | ${g.fast != null ? pct(g.fast) + (fastBad(g, C) ? " !" : "") : "-"} | ${m ? pct(m.honest) + " / " + pct(m.seeing) : "-"} | ${g.pace ? secs(g.pace.ms) + (g.pace.fell ? " *" : "") : "-"}${l.rush ? " R" : ""} | ${g.thinks ? g.thinks.map((x) => (x ? "W" : "L")).join("") : "-"} | ${secs(g.ms)} | ${secs(g.maxWait)} | ${l.exempt ? "teaching: " + l.teaches : (l.fallback || (l.inBand ? "" : "out of band")) + (out.bake.newBoards && out.bake.newBoards.indexOf(l.n) >= 0 ? (l.fallback ? "; " : "") + "new board" : "")} |`);
  }
  rows.push("", "### Bake log", "", "```", ...log, "```");
  const block = A + "\n" + rows.join("\n") + "\n" + Z;
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "# Sapper's Path v4.3 rebake\n\n" + A + "\n" + Z + "\n";
  if (!text.includes(A)) text += "\n" + A + "\n" + Z + "\n";
  text = text.slice(0, text.indexOf(A)) + block + text.slice(text.indexOf(Z) + Z.length);
  writeAtomic(file, text);
}
