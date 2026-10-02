// Sapper's Path bake (SPEC-v3 §5; v4 M3, the Siege to 100): tools/bake-config.json + levels/teaching.json ->
// levels/levels.json (versioned) and levels/pool-e{1,2,3,4}.json (every graded candidate, kept for rebakes and the app's
// longer curve).
//   ~/.local/opt/node/bin/node tools/bake.js [--out DIR] [--only A-B]
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
// report tables are written between the bake markers of tools/v4.1-rebake.md. `--out DIR` writes levels.json, the
// pools and the report into DIR instead (a trial bake that leaves the tracked files alone); `--only A-B` bakes only
// those levels (a trial: the file holds just them); `--teach FILE` reads the teaching levels from FILE.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const E = require("../src/engine.js");
const G = require("./gen.js");
const R = require("./grade.js");
const PAL = require("./palette.js");

const ROOT = path.join(__dirname, "..");
const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : null; };
const OUT = arg("out") ? path.resolve(arg("out")) : null;
const ONLY = arg("only") ? arg("only").split("-").map(Number) : null;
const outPath = (rel) => (OUT ? path.join(OUT, path.basename(rel)) : path.join(ROOT, rel));
const DIFFS = ["easy", "normal", "hard"];

// ---- shared by main and workers -------------------------------------------------------------------------------
function eraOf(n, C) { for (const e of Object.keys(C.eras)) if (n >= C.eras[e].from && n <= C.eras[e].to) return +e; return 1; }
// The late pattern (hard, hard, hard, hardest, relief) runs from curve.late.from; curve.late.overrides names slots by level
// (the run-in to the boss: 98 hardest, 99 relief, 100 boss).
function bandOf(n, C) {
  const cv = C.curve;
  if (n <= cv.early.to) return { kind: "early", sub: "early", band: cv.early.band };
  if (n <= cv.mid.to) { const k = (n - cv.mid.from) % cv.mid.saw.length; return { kind: "mid", sub: "saw" + k, band: cv.mid.saw[k] }; }
  const sub = (cv.late.overrides && cv.late.overrides[n]) || cv.late.pattern[(n - cv.late.from) % cv.late.pattern.length];
  return { kind: "late", sub, band: cv.late.bands[sub] };
}
function coloursOf(n, C, b) {
  if (b.sub === "boss") return C.boss.colours;
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

// Grade a finished level on every difficulty; `hint` is a known winning order (tried first). Per difficulty: a stored
// winning order, the random-tap rate, the peak line and the patient time; on Normal also the one-move-lookahead player,
// the longest single tap (dead time) and, from fast.from, the fast tapper.
function gradeLevel(L, rules, C, hint, seed, n) {
  const B = E.compile(L), win = {}, grade = { cards: B.ncards, pixels: B.pixTotal, colours: G.coloursOf(L).size };
  for (const d of DIFFS) {
    const h = hint && typeof hint === "object" ? hint[d] : hint; // v4.1: a teaching level brings its own order per difficulty
    let order = h, line = order ? R.line(B, rules[d], order) : null;
    if (!line || !line.won) { order = R.solve(B, rules[d], C.grade.solveNodes, h); line = order ? R.line(B, rules[d], order) : null; }
    win[d] = line && line.won ? order : null;
    grade[d] = { rate: +R.rate(B, rules[d], C.grade.playouts, seed).toFixed(4), peak: line ? line.peak : null, len: order ? order.length : null, ms: line && line.won ? line.ms : null };
    if (d === "normal") grade[d].maxWait = line && line.won ? line.maxWait : null;
  }
  grade.normal.greedy = +R.greedy(B, rules.normal, C.grade.greedyPlayouts, seed ^ 0x2545f491).toFixed(3);
  if (n >= C.fast.from) grade.normal.fast = +R.fast(B, rules.normal, C.fast.games, seed ^ 0x1f123bb5, C.fast.gapMs).toFixed(4);
  return { win, grade };
}
// The fast tapper's check (config fast): a level much easier tapped fast than patiently (fast - patient >= pts, or fast
// over ratio x patient and at least minPts over it) is retuned (the picker prefers candidates that pass).
const fastBad = (g, C) => g.normal.fast != null && (g.normal.fast - g.normal.rate >= C.fast.pts || (g.normal.fast > C.fast.ratio * g.normal.rate && g.normal.fast - g.normal.rate >= C.fast.minPts));

// All candidates for one generated level. Never throws: failures come back as {fail} entries.
function candidates(n, C, rules, tw) {
  const era = eraOf(n, C), b = bandOf(n, C), [cmin, cmax] = coloursOf(n, C, b), out = [], stats = { forts: 0, deals: 0, evals: 0, grades: 0 };
  const D = Object.assign({}, C.deal, C.dealBy[b.kind] || {}, C.dealBy[b.sub] || {}, { maxTaps: C.maxTaps, time: rules.hard.time, maxWaitMs: C.maxWaitMs, lockSpaces: rules.hard.lockSpaces });
  const dealRules = Object.assign({}, rules.hard, { hold: C.deal.hold, archersKill: true });
  const per = (C.candidates.perLevelBy && C.candidates.perLevelBy[b.sub]) || C.candidates.perLevel;
  for (let k = 0; k < per; k++) {
    try {
      let L = null, seed = 0;
      for (let t = 0; t < C.candidates.fortTries && !L; t++) {
        seed = seedOf(C, n, k * 1000 + t);
        const P = Object.assign({}, C.eras[era].gen, b.sub === "boss" ? C.boss.gen : {}, { colours: cmin + (Math.abs(seed) % (cmax - cmin + 1)) }), g0 = C.genBy && C.genBy[b.sub] && C.genBy[b.sub].scale, sc = g0 && typeof g0 === "object" ? g0[era] : g0;
        if (sc) { P.w = P.w.map((v) => Math.round(v * sc)); P.h = P.h.map((v) => Math.round(v * sc)); } // genBy: a slot's boards scaled (reliefs are smaller, and quicker)
        const f = G.fort(era, seed, P, C.picture); stats.forts++;
        if (!f) continue;
        if (tw.lock && !G.lockKey(f, seed)) continue;
        const nc = G.coloursOf(f).size; if (nc < cmin || nc > cmax) continue;
        if (era >= 2 && !(f.gates && f.gates.length)) continue; // every fort from Era 2 has a gate (v4 M3: so Era 3 keeps its moat)
        if (era >= 3 && !(f.towers && f.towers.length)) continue;
        delete f.roles; L = f; // v4.1: the picture's roles are the generator's business; pal (colours, names) ships
      }
      if (!L) { out.push({ k, fail: "no fort with " + cmin + "-" + cmax + " colours in " + C.candidates.fortTries + " seeds" }); continue; }
      let dl = null;
      for (let a = 0; a < D.attempts && !dl; a++) { dl = G.deal(L, seed ^ Math.imul(a + 1, 0x27D4EB2F), D); stats.deals++; }
      if (!dl) { out.push({ k, seed, fail: "no deal in " + D.attempts + " attempts" }); continue; }
      const play = tw.links ? G.linkUp(L, dl.play, tw.links, seed, D) : dl.play;
      const T = Object.assign({}, C.tune, { seed: seed ^ 0x3c6ef372, maxTaps: C.maxTaps, maxWaitMs: C.maxWaitMs }, b.kind === "late" && b.sub !== "relief" ? { narrow: C.tune.narrow } : { narrow: null });
      const res = G.tune(L, play, G.assign(play, 0, seed), b.band[0], b.band[1], T, { normal: rules.normal, deal: dealRules });
      stats.evals += res.evals;
      const dk = G.deck(res.play, res.colOf);
      if (dk.bad) { out.push({ k, seed, fail: "a linked partner more than a row from its card" }); continue; }
      const level = Object.assign({}, L, { cols: dk.cols }, dk.links.length ? { links: dk.links } : {});
      const g = gradeLevel(level, rules, C, G.orderOf(res.colOf), seed, n); stats.grades++;
      const rate = g.grade.normal.rate, miss = Math.max(0, b.band[0] - rate, rate - b.band[1]);
      out.push({ k, seed, level, win: g.win, grade: g.grade, miss: +miss.toFixed(4), tuneSteps: res.steps, taps: res.play.length, pairs: dk.links.length, winnable: DIFFS.every((d) => g.win[d]) });
    } catch (e) { out.push({ k, fail: "error: " + (e && e.message) + (process.env.BAKE_STACK ? " " + e.stack : "") }); }
  }
  return { n, era, band: b, colours: [cmin, cmax], cands: out, stats };
}

// The mystery cards (v4 M3): `want` flags on cards dealt in the rows just behind the fronts (config mystery.rows), never
// a linked card and never two in a row in one column. Each placement is measured by the sampling planner, honest and
// all-seeing (common seeds); the first within mystery.maxGap is kept, else the smallest gap after mystery.tries, with
// one flag fewer on each later try (never under 2). Returns {level, m} (m: the report's measures).
function mystify(L, want, C, rules, seed) {
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
    const B = E.compile(T), honest = R.plan(B, rules.normal, M.games, seed ^ 0x3243f6a8, M.samples, false), seeing = R.plan(B, rules.normal, M.games, seed ^ 0x3243f6a8, M.samples, true);
    const m = { cards: got.length, honest: +honest.toFixed(3), seeing: +seeing.toFixed(3), gap: +(seeing - honest).toFixed(3), tries: t + 1 };
    if (!best || m.gap < best.m.gap) best = { level: T, m };
    if (m.gap <= M.maxGap) break;
  }
  return best || { level: L, m: null };
}
// The second pass on a picked level: winning-order counts and safe taps per turn (report only), and the mystery flags.
function finish(task, C, rules) {
  const { L, want, seed } = task, B0 = E.compile(L), x = {};
  const oc = R.orders(B0, rules.normal, C.grade.orderCap, C.grade.orderNodes); x.orders = oc.count; x.ordersCapped = oc.capped; x.ordersExact = oc.exact;
  if (L.win && L.win.normal) { const nw = R.narrow(B0, rules.normal, L.win.normal, C.grade.narrowNodes); x.forced = nw.forced; x.minSafe = nw.minSafe; x.meanSafe = nw.meanSafe; x.narrowUnknown = nw.unknown; }
  let level = L, m = null;
  if (want) ({ level, m } = mystify(L, want, C, rules, seed));
  else if (L.cols.some((c) => c.some((cd) => cd[2]))) { const B = E.compile(L); m = { cards: L.cols.flat().filter((cd) => cd[2]).length, honest: R.plan(B, rules.normal, C.mystery.games, seed ^ 0x3243f6a8, C.mystery.samples, false), seeing: R.plan(B, rules.normal, C.mystery.games, seed ^ 0x3243f6a8, C.mystery.samples, true), tries: 0, authored: true }; m.gap = +(m.seeing - m.honest).toFixed(3); }
  return { n: task.n, cols: level.cols, x, m };
}

if (!isMainThread) {
  const { job, C, rules } = workerData;
  let res;
  try { res = job.kind === "finish" ? finish(job, C, rules) : candidates(job.n, C, rules, job.tw); }
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
    C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
    CFG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
    TEACH = JSON.parse(fs.readFileSync(arg("teach") ? path.resolve(arg("teach")) : path.join(ROOT, "levels/teaching.json"), "utf8")).levels;
  } catch (e) { console.log("bake: cannot read config: " + e.message); process.exitCode = 1; return; }
  const rules = { easy: E.rulesOf(CFG.v3, "easy"), normal: E.rulesOf(CFG.v3, "normal"), hard: E.rulesOf(CFG.v3, "hard") }, deadline = t0 + C.budget.wallSec * 1000;
  const threads = C.budget.threads || Math.max(2, os.cpus().length - 2);
  const teachBy = new Map(TEACH.map((L) => [L.n, L]));
  const inRun = (n) => !ONLY || (n >= ONLY[0] && n <= (ONLY[1] || ONLY[0]));
  const jobs = []; for (let n = 1; n <= C.levels; n++) if (!teachBy.has(n) && inRun(n)) jobs.push({ kind: "cand", n, tw: twistsOf(n, C, teachBy) });
  say("bake v" + C.version + ": " + C.levels + " levels, " + jobs.length + " generated on " + threads + " threads" + (ONLY ? " (only " + ONLY.join("-") + ")" : ""));
  const results = await runPool(jobs, threads, C, rules, deadline, (d, t) => { if (d % 10 === 0 || d === t) console.log("  " + d + "/" + t + " levels  " + ((Date.now() - t0) / 1000).toFixed(1) + " s"); });
  const byN = new Map(results.map((r) => [r.n, r]));
  const tot = { forts: 0, deals: 0, evals: 0, grades: 0 };
  for (const r of results) for (const k of Object.keys(tot)) tot[k] += (r.stats && r.stats[k]) || 0;
  const t1 = Date.now();

  const levels = [], fallbacks = [], lookMiss = [], pools = { 1: [], 2: [], 3: [], 4: [] }, DU = C.duration;
  for (let n = 1; n <= C.levels; n++) {
    if (!inRun(n)) continue;
    const b = bandOf(n, C), era = eraOf(n, C), id = "e" + era + "-" + String(n).padStart(2, "0");
    if (teachBy.has(n)) {
      const T = teachBy.get(n), L = Object.assign({ w: T.w, h: T.h, grid: T.grid }, T.pic ? { pic: true } : {}, { gates: T.gates || [], towers: T.towers || [], cols: T.cols }, T.links ? { links: T.links } : {}, T.lock ? { lock: T.lock } : {}, T.safeArchers ? { safeArchers: true } : {}, T.pal ? { pal: T.pal } : {}, T.palette ? { palette: T.palette } : {});
      let g; try { g = gradeLevel(L, rules, C, T.win || null, seedOf(C, n, 0), n); } catch (e) { say("level " + n + ": teaching level failed to grade: " + e.message); continue; }
      const winnable = DIFFS.every((d) => g.win[d]); if (!winnable) say("level " + n + ": teaching level NOT winnable on every difficulty");
      levels.push(Object.assign({ id, n, era, source: "teaching", name: T.name, teaches: T.teaches, hint: T.hint, band: b.sub, target: b.band }, L, { win: g.win, grade: g.grade, exempt: "teaching" }));
      continue;
    }
    const r = byN.get(n), cands = (r && r.cands) || [], ok = cands.filter((c) => c.level && c.winnable), tw = twistsOf(n, C, teachBy);
    for (const c of ok) pools[era].push({ n, k: c.k, seed: c.seed, band: b.sub, target: b.band, miss: c.miss, grade: c.grade, win: c.win, level: c.level });
    for (const c of cands) if (c.fail) say("level " + n + " candidate " + c.k + ": " + c.fail);
    const mid = (b.band[0] + b.band[1]) / 2;
    const lateHard = b.kind === "late" && b.sub !== "relief";
    // Late hard slots: the lookahead player's target (C.lookahead). Duration (C.duration): the patient play-through on the
    // stored Normal line inside the level's limits. Dead time (C.maxWaitMs): its longest single tap. Fast tapper (C.fast).
    const lookT0 = lateHard && C.lookahead ? C.lookahead[b.sub] : null, over = (c) => (lookT0 != null && c.grade.normal.greedy > lookT0 ? 1 : 0);
    const dLim = n <= DU.earlyTo ? DU.early : [0, DU.maxMs];
    const dmiss = (c) => { const ms = c.grade.normal.ms; return ms == null ? 1e9 : Math.max(0, dLim[0] - ms, ms - dLim[1]); };
    const wmiss = (c) => { const w = c.grade.normal.maxWait; return w == null ? 1e9 : Math.max(0, w - C.maxWaitMs); };
    const fbad = (c) => (fastBad(c.grade, C) ? 1 : 0), twMiss = (c) => (c.pairs < tw.links ? 1 : 0);
    ok.sort((p, q) => (p.miss > 0) - (q.miss > 0) || (dmiss(p) > 0) - (dmiss(q) > 0) || (wmiss(p) > 0) - (wmiss(q) > 0) || fbad(p) - fbad(q) || twMiss(p) - twMiss(q) || p.miss - q.miss || dmiss(p) - dmiss(q) || wmiss(p) - wmiss(q)
      || over(p) - over(q) || (over(p) ? p.grade.normal.greedy - q.grade.normal.greedy : 0) || Math.abs(p.grade.normal.rate - mid) - Math.abs(q.grade.normal.rate - mid) || p.k - q.k);
    const good = (c) => c.miss === 0 && !dmiss(c) && !wmiss(c) && !fbad(c) && !twMiss(c) && !over(c);
    // When no candidate meets every target, the fallback is the one that misses least overall (C.penalty: a band miss of
    // 1 point, 30 s of duration, 3 s of dead time, a fast-tapper flag, a missing pair or 25 points of lookahead over its
    // target each count about 1), so a few seconds over the time limit never outweighs a lookahead of 99%.
    const PN = C.penalty, pen = (c) => PN.band * c.miss + dmiss(c) / PN.durationMs + wmiss(c) / PN.waitMs + PN.fast * fbad(c) + PN.pairs * twMiss(c) + (over(c) ? (c.grade.normal.greedy - lookT0) / PN.lookahead : 0);
    let pickC = null, why = null;
    for (const c of ok) { if (!good(c)) break; if (!levels.some((L) => nearDup(L, c.level, C.dedupe.sameCells))) { pickC = c; break; } }
    if (!pickC) {
      const rest = ok.filter((c) => !levels.some((L) => nearDup(L, c.level, C.dedupe.sameCells))).sort((p, q) => pen(p) - pen(q) || p.k - q.k);
      pickC = rest[0] || ok[0] || null;
      const w = []; if (!ok.length) w.push("no winnable candidate");
      else {
        if (pickC.miss > 0) w.push("out of band: Normal " + pct(pickC.grade.normal.rate) + " vs " + pct(b.band[0]) + "-" + pct(b.band[1]));
        if (dmiss(pickC) > 0) w.push("duration " + secs(pickC.grade.normal.ms) + " outside " + dLim[0] / 1000 + "-" + dLim[1] / 1000 + " s");
        if (wmiss(pickC) > 0) w.push("longest tap " + secs(pickC.grade.normal.maxWait) + " over " + C.maxWaitMs / 1000 + " s");
        if (fbad(pickC)) w.push("fast tapper " + pct(pickC.grade.normal.fast) + " vs patient " + pct(pickC.grade.normal.rate));
        if (twMiss(pickC)) w.push("linked pairs " + pickC.pairs + " of " + tw.links);
        if (over(pickC)) w.push("lookahead " + pct(pickC.grade.normal.greedy) + " over " + pct(lookT0));
        if (!w.length) w.push("near-duplicate of an earlier level");
      }
      why = w.join("; ");
    }
    if (!pickC) { fallbacks.push({ n, why }); say("level " + n + ": NO LEVEL (" + why + ")"); continue; }
    if (why) { fallbacks.push({ n, why }); say("level " + n + ": fallback, " + why); }
    const lookT = lookT0, look = pickC.grade.normal.greedy;
    if (lookT != null && look > lookT) { lookMiss.push({ n, sub: b.sub, look }); say("level " + n + ": lookahead fallback, " + pct(look) + " over the " + pct(lookT) + " target (" + ok.filter((c) => c.miss === 0).length + " in-band candidates)"); }
    levels.push(Object.assign({ id, n, era, source: "gen", seed: pickC.seed, band: b.sub, target: b.band, twists: tw }, pickC.level, { win: pickC.win, grade: pickC.grade, inBand: pickC.miss === 0 }, why ? { fallback: why } : {}));
  }
  say("bake: " + levels.length + " levels picked in " + ((t1 - t0) / 1000).toFixed(1) + " s; forts " + tot.forts + ", deals " + tot.deals + ", tune evaluations " + tot.evals + ", full grades " + tot.grades + " (x3 difficulties)");

  // Second pass: order counts and safe taps (report only), the mystery flags and their planner measures.
  const fin = levels.map((l) => ({ kind: "finish", n: l.n, L: { w: l.w, h: l.h, grid: l.grid, pic: l.pic, gates: l.gates, towers: l.towers, cols: l.cols, links: l.links, lock: l.lock, safeArchers: l.safeArchers, win: l.win }, want: l.twists ? l.twists.mystery : 0, seed: l.seed || seedOf(C, l.n, 0) }));
  const done = await runPool(fin, threads, C, rules, Date.now() + C.budget.finishSec * 1000, (d, t) => { if (d % 20 === 0 || d === t) console.log("  finish " + d + "/" + t + "  " + ((Date.now() - t0) / 1000).toFixed(1) + " s"); });
  for (const f of done) {
    const l = levels.find((x) => x.n === f.n); if (!l) continue;
    if (f.fail) { say("level " + f.n + ": second pass failed (" + f.fail + ")"); continue; }
    Object.assign(l.grade.normal, f.x); if (f.m) l.grade.normal.mystery = f.m;
    if (f.cols) l.cols = f.cols;
    if (f.m && f.m.gap > C.mystery.maxGap) { fallbacks.push({ n: f.n, why: "mystery gap " + pct(f.m.gap) + " over " + pct(C.mystery.maxGap) }); say("level " + f.n + ": mystery fallback, planner gap " + pct(f.m.gap)); }
  }
  const secsAll = (Date.now() - t0) / 1000, graded = tot.evals + tot.grades * 3;
  say("bake: " + levels.length + " levels in " + secsAll.toFixed(1) + " s (candidates " + ((t1 - t0) / 1000).toFixed(0) + " s, second pass " + ((Date.now() - t1) / 1000).toFixed(0) + " s)");
  say("bake: " + (graded / ((t1 - t0) / 1000)).toFixed(0) + " graded candidate decks per second across " + threads + " threads");
  const gen = levels.filter((l) => !l.exempt);
  for (const sub of ["hard", "hardest", "boss"]) { const g = gen.filter((l) => l.band === sub).map((l) => l.grade.normal.greedy); if (g.length) say("bake: lookahead player on " + sub + " (Normal): median " + pct(med(g)) + ", max " + pct(Math.max(...g)) + " over " + g.length + " levels"); }
  { const ms = gen.map((l) => l.grade.normal.ms).filter((x) => x != null), all = levels.map((l) => l.grade.normal.ms).filter((x) => x != null), early = gen.filter((l) => l.n <= DU.earlyTo).map((l) => l.grade.normal.ms);
    if (ms.length) say("bake: patient play-through on the stored Normal line at 1x (generated levels): median " + secs(med(ms)) + ", max " + secs(Math.max(...ms)) + (early.length ? "; early " + secs(Math.min(...early)) + "-" + secs(Math.max(...early)) : "") + "; all levels median " + secs(med(all)) + ", " + secs(Math.min(...all)) + "-" + secs(Math.max(...all)));
    const w = levels.map((l) => l.grade.normal.maxWait).filter((x) => x != null); if (w.length) say("bake: longest single tap on the stored Normal line: median " + secs(med(w)) + ", max " + secs(Math.max(...w)) + " (cap " + C.maxWaitMs / 1000 + " s)"); }
  say("bake: taps per level: max " + Math.max(...levels.map((l) => l.win.normal ? l.win.normal.length : 0)) + " (cap " + C.maxTaps + "), median " + med(levels.map((l) => (l.win.normal ? l.win.normal.length : 0))) + "; cards max " + Math.max(...levels.map((l) => l.grade.cards)));
  const out = { version: C.version, bake: { config: C.version, seed: C.seed, time: CFG.v3.time, forts: tot.forts, deals: tot.deals, tuneEvals: tot.evals, fullGrades: tot.grades, seconds: +secsAll.toFixed(1), fallbacks, lookaheadFallbacks: lookMiss }, levels };
  try {
    if (OUT) fs.mkdirSync(OUT, { recursive: true });
    writeAtomic(outPath("levels/levels.json"), JSON.stringify(out));
    for (const e of [1, 2, 3, 4]) writeAtomic(outPath("levels/pool-e" + e + ".json"), JSON.stringify({ version: C.version, era: e, cands: pools[e] }));
  } catch (e) { say("bake: write failed: " + e.message); process.exitCode = 1; }
  try { writeReport(out, C, log); } catch (e) { say("bake: report tables failed: " + e.message); }
})();

// ---- report tables (between the markers in tools/v4.1-rebake.md) --------------------------------------------------
function writeReport(out, C, log) {
  const file = outPath("tools/v4.1-rebake.md"), A = "<!-- bake:start -->", Z = "<!-- bake:end -->";
  const L = out.levels, rows = [], minDE = (l) => (l.palette ? l.palette.minDE : (() => { const s = new Set(); for (const row of l.grid) for (const ch of row) { const m = E.matOf(ch); if (m) s.add(m); } return PAL.minPair([...s]).min; })());
  const twOf = (l) => { const t = []; if (l.gates && l.gates.length) t.push("gates " + l.gates.length); if (l.towers && l.towers.length) t.push("archers " + l.towers.length); const mc = l.cols.flat().filter((cd) => cd[2]).length; if (mc) t.push("? " + mc); if (l.links && l.links.length) t.push("linked " + l.links.length); if (l.lock) t.push("lock"); return t.join(", ") || "-"; };
  rows.push("### Bands on Normal", "", "| Band | Levels | In band | Exempt (teaching) | Normal min | median | max |", "|---|---|---|---|---|---|---|");
  for (const kind of ["early", "saw0", "saw1", "saw2", "hard", "hardest", "relief", "boss"]) {
    const ls = L.filter((l) => l.band === kind); if (!ls.length) continue;
    const gen = ls.filter((l) => !l.exempt), rs = ls.map((l) => l.grade.normal.rate), t = ls[0].target;
    rows.push(`| ${kind} ${pct(t[0])}-${pct(t[1])} | ${ls.length} | ${gen.filter((l) => l.inBand).length}/${gen.length} | ${ls.length - gen.length} | ${pct(Math.min(...rs))} | ${pct(med(rs))} | ${pct(Math.max(...rs))} |`);
  }
  rows.push("", "### Every level", "", "Normal random = the random-tap rate (" + C.grade.playouts + " games); lookahead = the one-move-lookahead player (" + C.grade.greedyPlayouts + "); fast = the fast tapper (" + C.fast.games + ", from level " + C.fast.from + "); ? planner = the sampling planner honest / all-seeing (" + C.mystery.games + " games); time and longest tap = patient play on the stored Normal line at 1x; ΔE = the smallest CIEDE2000 between two colours standing in the level.", "",
    "| # | Era | Band | Twists | Board | Pixels | Colours | Min ΔE00 | Taps (cards) | Normal random | Easy | Hard | Lookahead | Fast | ? planner | Time | Longest tap | Note |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const l of L) {
    const g = l.grade, m = g.normal.mystery;
    rows.push(`| ${l.n} | ${l.era} | ${l.band} | ${twOf(l)} | ${l.w}×${l.h} | ${g.pixels} | ${g.colours} | ${minDE(l) != null ? minDE(l).toFixed(1) : "-"} | ${l.win.normal ? l.win.normal.length : "-"} (${g.cards}) | ${pct(g.normal.rate)} | ${pct(g.easy.rate)} | ${pct(g.hard.rate)} | ${pct(g.normal.greedy)} | ${g.normal.fast != null ? pct(g.normal.fast) + (fastBad(g, C) ? " !" : "") : "-"} | ${m ? pct(m.honest) + " / " + pct(m.seeing) : "-"} | ${secs(g.normal.ms)} | ${secs(g.normal.maxWait)} | ${l.exempt ? "teaching: " + l.teaches : l.fallback || (l.inBand ? "" : "out of band")} |`);
  }
  rows.push("", "### Bake log", "", "```", ...log, "```");
  const block = A + "\n" + rows.join("\n") + "\n" + Z;
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "# Sapper's Path v4.1 rebake\n\n" + A + "\n" + Z + "\n";
  if (!text.includes(A)) text += "\n" + A + "\n" + Z + "\n";
  text = text.slice(0, text.indexOf(A)) + block + text.slice(text.indexOf(Z) + Z.length);
  writeAtomic(file, text);
}
