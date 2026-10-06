// Sapper's Path lands foundation: the land bake (SPEC-v4 §9, the lands foundation entry; tools/land-runbook.md). A land's
// converted pictures (tools/land.js convert) become its main levels (past 200: a picture played with the existing rules,
// with the deck features its tag asks for) and its side quests (pictures with a power-up prize, no features). Driven by
// tools/land.js; numbers in tools/land-config.json (plan, bake), the grader's counts from tools/bake-config.json (main
// levels) or tools/gallery-config.json bake (side quests), so tools/regrade.js re-grades a banked land with 0 differences.
// Per level (one worker each, seeds from the level number: thread timing never changes the output):
//   1. The plan (tools/land-plan.js landPlan, from the land's profile; given in the job): which deck features it uses
//      and how much of each. FEATURES builds each one on a candidate (extension point: a later board feature, a moat
//      ring or a hazard, is one more entry here plus its share in the profile).
//   2. Candidates: build the board features (organic moats first: tools/moat.js, a ring of water round the picture's
//      subject with the plan's openings, Land 2 on; mystery blocks: hidePic; the lock: a key block dug in, gen.js lockKey,
//      when the gilt clears the picture's colours, else a colour lock set from the deal), deal (gen.js deal, the dealing
//      rules: 5 spaces), link pairs (linkUp), tune into the tag's band (gen.js tune, all-seeing past mystery blocks as
//      bake.js does; the one-move-lookahead player is narrowed toward the tag's ceiling for the narrowFor tags and, Land 1
//      on, for any tag the land's profile gives a ceiling, as the castle's Normal levels had one; toward tune.narrow.under
//      of the ceiling, since the grade's fresh sample lands either side of where the narrowing stopped), deck, grade on the tag
//      (gradeLevel: a stored winning order, rate, lookahead, real pace and thinking replays, fast tapper; no power-ups in
//      any of it).
//   3. The pick: every target met (band, real pace in range, the longest tap, the taps, the fast tapper, the pairs, the
//      lookahead ceiling), nearest the band's middle and the pace aim; else the least total miss, logged as a fallback.
//   4. ? cards (mystify, as bake.js's: placed in the rows behind the front, measured by the sampling planner).
// A level that fails comes back as {n, fail}; nothing throws out of a worker.
//   require("./land-bake.js"): {FEATURES, hidePic, bakeOne, runPool, configs, threadsOf, gradeLevel}
"use strict";
const path = require("path");
const os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const E = require("../src/engine.js");
const G = require("./gen.js");
const R = require("./grade.js");
const PAL = require("./palette.js");
const MO = require("./moat.js");

const hash01 = (n, k) => { let t = Math.imul(n + 0x3c6e, 0x9E3779B1) ^ Math.imul(k + 11, 0x85EBCA77); t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d); t ^= t >>> 12; return (t >>> 0) / 4294967296; };
const seedOf = (B, n, k) => (B.seed ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(k + 7, 0x85EBCA77)) | 0;
const gt = (o) => o.grade[o.tag], wn = (o) => o.win[o.tag];

// The bake settings for a main level (side: a side quest): land-config bake over the grader's counts of the file it goes
// in (bake-config for levels.json, gallery-config bake for gallery.json).
// LAND_CONFIG=FILE (env): a trial land-config instead of tools/land-config.json.
function configs(side) {
  const LC = process.env.LAND_CONFIG ? require(path.resolve(process.env.LAND_CONFIG)) : require("./land-config.json"), BC = require("./bake-config.json"), GB = require("./gallery-config.json").bake, src = side ? GB : BC;
  const B = Object.assign({}, LC.bake, { seed: LC.seed + (side ? 1 : 0), grade: src.grade, fast: src.fast, duration: { pace: { factor: src.duration.pace.factor, thinks: src.duration.pace.thinks } } });
  return { LC, B, D: require("../config.json").v5.density };
}

// The board features a plan can ask for, each built on a candidate's board before the deal: (L, P, seed, ctx) -> false
// when it can't be built (the candidate is dropped). Deck features (linked pairs, ? cards) are built in the deal and
// after the pick. Extension point (later feature drops): a new board feature is one entry here, its share in the land's
// profile and its name in the land's features (tools/land-plan.js refuses a name with no entry).
// moat (organic moats; SPEC-v4 §9, the organic moats entry): the ring tools/moat.js lays round the picture's subject, its
// openings from plan.moat.ways[ctx.ways] (bakeOne steps a level's candidates down from the planned index P.moat to
// job.moatLo in turn: a far or side way in can walk a sapper past the 15 s cap), its water colour from the profile's
// liquids (job.liquids); the subject is worked out once a level (ctx.sub). False when the picture can't carry it.
const FEATURES = {
  moat: (L, P, seed, ctx) => { const MC = ctx.PL.moat; if (!ctx.sub) ctx.sub = MO.subjectOf(ctx.board, MC); const R = MO.ringOf(ctx.board, MC, MC.ways[ctx.ways], seed, ctx.sub, ctx.liquids); if (!R.cells) { ctx.why = R.why; return false; } MO.apply(L, R); ctx.moat = R; return true; },
  hidden: (L, P, seed, ctx) => hidePic(L, seed, Object.assign({}, ctx.PL.hidden, { share: [P.hidden, P.hidden] }), ctx.skipIds),
  lock: (L, P, seed, ctx) => { let k = P.lock; if (k === "key" && !(ctx.giltOK && G.lockKey(L, seed))) k = "colour"; if (k === "colour") L.lock = { colour: [...G.coloursOf(L)].sort((a, b) => a - b)[0] }; ctx.lock = k;
    if (k === "key" && L.hidden) { const [x, y] = L.lock.key; L.hidden = L.hidden.slice(); L.hidden[y] = L.hidden[y].slice(0, x) + "." + L.hidden[y].slice(x + 1); } return true; }, // a colour lock's stand-in (the dealer plays it shut); its colour is set from the deal. Organic moats pass: a key dug in on a mystery block drops the block's flag (the engine takes no flag on a key; the candidate used to be lost)
  linked: () => true, mystery: () => true };

// Mystery blocks on a picture (gen.js hide is for castles: it needs open ground above the fort): blobs over plain blocks
// (not iron, gilt, a key or the lock's key; not ink or a masked picture's background) that start out of reach (no open
// ground beside them), until a share in H.share of those is hidden; no 4-connected group past H.maxGroup. Sets L.hidden
// (h strings of w: "?" or "."); false (L untouched) when fewer than H.min could be hidden. Land 1: H.gap keeps a blob's
// cells that many cells from every earlier blob, so blobs never merge into a group the cap then trims and the share
// asked is the share hidden (without it 0.3 of the eligible blocks came out about 15% of the picture; with gap 1, 26%).
function hidePic(L, seed, H, skipIds) {
  const B = E.compile(Object.assign({ cols: [[], [], [], [], []] }, L)), r = R.rng(seed ^ 0x7f4a7c15), w = B.w, h = B.h, a0 = B.a0;
  const open = (c) => !(a0[c] > 0), ok = new Uint8Array(w * h), cells = [];
  for (let c = 0; c < w * h; c++) { const m = a0[c]; if (!(m > 0) || m === E.IRON || m === E.GILT || B.keyOf[c] >= 0 || c === B.lockKey || (skipIds && skipIds.indexOf(m) >= 0)) continue;
    let bad = false; for (let k = 0; k < 4 && !bad; k++) { const e = B.nb[c * 4 + k]; if (e < 0 || open(e)) bad = true; } if (!bad) { ok[c] = 1; cells.push(c); } }
  const want = Math.round(cells.length * (H.share[0] + r() * (H.share[1] - H.share[0]))), hid = new Uint16Array(w * h); let got = 0;
  for (let t = 0; t < 400 && got < want && cells.length; t++) { const c0 = cells[Math.floor(r() * cells.length)], cx = c0 % w, cy = (c0 / w) | 0, rx = H.rx[0] + r() * (H.rx[1] - H.rx[0]), ry = H.ry[0] + r() * (H.ry[1] - H.ry[0]);
    const t1 = t + 1, near = (c) => { if (!H.gap) return false; const x0 = c % w, y0 = (c / w) | 0; for (let y = Math.max(0, y0 - H.gap); y <= Math.min(h - 1, y0 + H.gap); y++) for (let x = Math.max(0, x0 - H.gap); x <= Math.min(w - 1, x0 + H.gap); x++) { const e = y * w + x; if (hid[e] && hid[e] !== t1) return true; } return false; };
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(h - 1, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(w - 1, Math.ceil(cx + rx)); x++) { const c = y * w + x, dx = (x - cx) / rx, dy = (y - cy) / ry; if (ok[c] && !hid[c] && dx * dx + dy * dy <= 1 && got < want && !near(c)) { hid[c] = t1; got++; } } }
  if (H.maxGroup) { const seen = new Uint8Array(w * h), q = new Int32Array(w * h);
    for (let c0 = 0; c0 < w * h; c0++) { if (!hid[c0] || seen[c0]) continue; let qh = 0, qt = 0, k = 0; q[qt++] = c0; seen[c0] = 1;
      while (qh < qt) { const c = q[qh++]; if (++k > H.maxGroup) { hid[c] = 0; got--; } for (let j = 0; j < 4; j++) { const e = B.nb[c * 4 + j]; if (e >= 0 && hid[e] && !seen[e]) { seen[e] = 1; q[qt++] = e; } } } } }
  if (got < H.min) return false;
  L.hidden = []; for (let y = 0; y < h; y++) { let s = ""; for (let x = 0; x < w; x++) s += hid[y * w + x] ? "?" : "."; L.hidden.push(s); }
  return true;
}

// Grade a level on its tag (as bake.js gradeLevel and tools/regrade.js read it).
function gradeLevel(L, rules, B, hint, seed, tag) {
  const Bc = E.compile(L), win = {}, grade = { cards: Bc.ncards, pixels: Bc.pixTotal, colours: G.coloursOf(L).size }, rt = rules[tag];
  let order = hint, line = order ? R.line(Bc, rt, order) : null;
  if (!line || !line.won) { order = R.solve(Bc, rt, B.grade.solveNodes, hint); line = order ? R.line(Bc, rt, order) : null; }
  win[tag] = line && line.won ? order : null;
  const g = (grade[tag] = { rate: +R.rate(Bc, rt, B.grade.playouts, seed).toFixed(4), peak: line ? line.peak : null, len: order ? order.length : null, ms: line && line.won ? line.ms : null, maxWait: line && line.won ? line.maxWait : null });
  g.greedy = +R.greedy(Bc, rt, B.grade.greedyPlayouts, seed ^ 0x2545f491).toFixed(3);
  if (win[tag]) { const PC = B.duration.pace, pc = R.pace(Bc, rt, win[tag], 0); g.pace = pc.won ? { raw: pc.ms, ms: Math.round(pc.ms * PC.factor) } : { raw: null, ms: g.ms, fell: true };
    g.thinks = PC.thinks.map((th) => (R.pace(Bc, rt, win[tag], th).won ? 1 : 0)); }
  g.fast = +R.fast(Bc, rt, B.fast.games, seed ^ 0x1f123bb5, B.fast.gapMs).toFixed(4);
  return { win, grade };
}
const fastBad = (g, B) => g.fast != null && (g.fast - g.rate >= B.fast.pts || (g.fast > B.fast.ratio * g.rate && g.fast - g.rate >= B.fast.minPts));
// The targets (band: [lo, hi]; P: the plan). good(c): every one met; pen(c): the fallback's total miss.
function targetsOf(B, band, PC, look, P) { // PC: {range, aim}; look: the lookahead ceiling (null: none)
  const fell = (c) => (!gt(c).pace || gt(c).pace.fell ? 1 : 0), dmiss = (c) => (fell(c) ? 1e9 : Math.max(0, PC.range[0] - gt(c).pace.ms, gt(c).pace.ms - PC.range[1]));
  const wmiss = (c) => (gt(c).maxWait == null ? 1e9 : Math.max(0, gt(c).maxWait - B.maxWaitMs)), tmiss = (c) => Math.max(0, (wn(c) || "").length - B.maxTaps);
  const fbad = (c) => (fastBad(gt(c), B) ? 1 : 0), pmiss = (c) => (c.pairs < P.links ? 1 : 0), over = (c) => (look != null && gt(c).greedy > look ? gt(c).greedy - look : 0);
  const good = (c) => !c.miss && !dmiss(c) && !wmiss(c) && !tmiss(c) && !fbad(c) && !pmiss(c) && !over(c);
  const aim = (c) => (fell(c) ? 0 : Math.abs(gt(c).pace.ms - PC.aim) / B.aimWeight);
  const PN = B.penalty, pen = (c) => PN.band * c.miss + Math.min(dmiss(c), PN.fellMs) / PN.durationMs + wmiss(c) / PN.waitMs + tmiss(c) + PN.fast * fbad(c) + PN.pairs * pmiss(c) + over(c) / PN.lookahead;
  const why = (c) => { const w = []; if (c.miss) w.push("out of band: " + (100 * gt(c).rate).toFixed(1) + "% vs " + band.map((x) => (100 * x).toFixed(0)).join("-") + "%"); if (fell(c)) w.push("the real-pace replay lost");
    else if (dmiss(c)) w.push("real pace " + Math.round(gt(c).pace.ms / 1000) + " s outside " + PC.range.map((x) => x / 1000).join("-") + " s"); if (wmiss(c)) w.push("longest tap " + (gt(c).maxWait / 1000).toFixed(1) + " s");
    if (tmiss(c)) w.push("taps " + wn(c).length); if (fbad(c)) w.push("fast tapper"); if (pmiss(c)) w.push("pairs " + c.pairs + " of " + P.links); if (over(c)) w.push("lookahead " + gt(c).greedy); return w.join("; "); };
  return { good, pen, aim, why };
}

// The ? cards (bake.js mystify, the same rule): `want` flags on cards in rows M.rows behind the fronts, never a linked
// card and never two in a row in one column, measured honest against all-seeing; the first within maxGap is kept, else
// the smallest gap, one flag fewer each try (never under 2).
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

// One level, start to finish. job: {n, tag, side, plan (land-plan.js landPlan's; a side quest: none), band ([lo, hi]),
// look (the lookahead ceiling or null), pace ({range, aim}), board ({w, h, grid, pal, ink?: the ink's id, bg?: the
// background's id}), extra}. Returns {n, tag, plan, seed, level (the picked board and deck with win and grade), inBand,
// fallback, mystery, moat ({set, drop, water, path, edge, cuts, ways, liquid} or null), cands (summary), stats} or {n,
// fail}. Organic moats: job.liquids, the profile's moat liquids; job.moatLo, the gentlest opening set it allows.
function bakeOne(job) {
  const { LC, B } = configs(job.side), CFG = require("../config.json"), rules = { easy: E.rulesOf(CFG.v3, "easy"), normal: E.rulesOf(CFG.v3, "normal"), hard: E.rulesOf(CFG.v3, "hard"), extreme: E.rulesOf(CFG.v3, "extreme") };
  const { n, tag, band } = job, PL = LC.plan, P = job.plan || { feats: [], mystery: 0, links: 0, hidden: 0, lock: false };
  for (const f of P.feats.concat(P.lock ? ["lock"] : [])) if (!FEATURES[f]) return { n, fail: "feature " + f + " has no builder" };
  const TT = targetsOf(B, band, job.pace, job.look, P), out = [], stats = { deals: 0, evals: 0, grades: 0 }, ink = job.board.ink || 0;
  const ctx = { PL, board: job.board, liquids: job.liquids, skipIds: [job.board.ink, job.board.bg].filter(Boolean), giltOK: Object.keys(job.board.pal).every((k) => PAL.de00(PAL.lab(job.board.pal[k].c), PAL.lab(CFG.v3.mats[E.GILT].c)) >= PL.keyDE), lock: false };
  const D0 = Object.assign({}, B.deal, B.dealBy[tag] || {}, { maxTaps: B.maxTaps, time: rules.hard.time, maxWaitMs: B.maxWaitMs, lockSpaces: rules.hard.lockSpaces }, ink ? { capOf: { [ink]: B.capOf } } : {});
  if (B.deal.sizeRef) { const k = (job.board.w * job.board.h) / B.deal.sizeRef; D0.size = D0.size.map((v) => Math.max(1, Math.min(B.deal.maxCard, Math.round(v * k)))); } // squads scale with the board
  const dealRules = Object.assign({}, rules.hard, { hold: B.deal.hold, archersKill: true });
  const per = ((B.candidates.perLevelBy || {})[tag] || B.candidates.perLevel) + (job.extra | 0);
  for (let k = 0; k < per; k++) {
    try {
      const seed = seedOf(B, n, k), L = JSON.parse(JSON.stringify({ w: job.board.w, h: job.board.h, grid: job.board.grid, pic: true })); ctx.lock = false; ctx.moat = null; ctx.ways = P.moat - (k % ((P.moat | 0) - (job.moatLo | 0) + 1));
      if (P.feats.indexOf("moat") >= 0 && !FEATURES.moat(L, P, seed, ctx)) { out.push({ k, fail: "no moat: " + ctx.why }); continue; }
      if (P.hidden && !FEATURES.hidden(L, P, seed, ctx)) { out.push({ k, fail: "no room for mystery blocks" }); continue; }
      if (P.lock) FEATURES.lock(L, P, seed, ctx);
      let dl = null; for (let a = 0; a < D0.attempts && !dl; a++) { dl = G.deal(L, seed ^ Math.imul(a + 1, 0x27D4EB2F), D0); stats.deals++; }
      if (!dl) { out.push({ k, seed, fail: "no deal in " + D0.attempts + " attempts" }); continue; }
      const play = P.links ? G.linkUp(L, dl.play, P.links, seed, D0) : dl.play;
      if (ctx.lock === "colour") { const first = new Map(); play.forEach((p, i) => { for (const m of p.length >= 4 ? [p[0], p[2]] : [p[0]]) if (!first.has(m) && m !== E.GILT) first.set(m, i); });
        const want = PL.lockAt * play.length, best = [...first].sort((p, q) => Math.abs(p[1] - want) - Math.abs(q[1] - want) || p[1] - q[1])[0]; if (best) L.lock = { colour: best[0] }; }
      const T = Object.assign({}, B.tune, { seed: seed ^ 0x3c6ef372, maxTaps: B.maxTaps, maxWaitMs: B.maxWaitMs }, B.narrowFor.indexOf(tag) >= 0 || job.look != null ? { narrow: Object.assign({}, B.tune.narrow, job.look != null ? { stopAt: +(job.look * (B.tune.narrow.under || 1)).toFixed(3) } : {}) } : { narrow: null });
      const Lt = L.hidden ? Object.assign({}, L, { hidden: undefined }) : L; // tuned all-seeing (bake.js: the honest grade below stays at or under the target)
      const res = G.tune(Lt, play, G.assign(play, 0, seed), band[0], band[1], T, { normal: rules[tag], deal: Object.assign({}, dealRules, D0) }); stats.evals += res.evals;
      const dk = G.deck(res.play, res.colOf); if (dk.bad) { out.push({ k, seed, fail: "a linked partner more than a row from its card" }); continue; }
      const level = Object.assign({}, L, { cols: dk.cols }, dk.links.length ? { links: dk.links } : {}), g = gradeLevel(level, rules, B, G.orderOf(res.colOf), seed, tag); stats.grades++;
      const rate = g.grade[tag].rate, miss = Math.max(0, band[0] - rate, rate - band[1]);
      out.push({ k, seed, tag, level, win: g.win, grade: g.grade, miss: +miss.toFixed(4), pairs: dk.links.length, lock: ctx.lock, winnable: !!g.win[tag], moat: ctx.moat ? { set: ctx.ways, drop: P.moat - ctx.ways, water: ctx.moat.cells.length, path: ctx.moat.ground.length, edge: ctx.moat.edge, cuts: ctx.moat.cuts.length, ways: ctx.moat.ways, liquid: ctx.moat.liquid } : null });
    } catch (e) { out.push({ k, fail: "error: " + (e && e.message) }); }
  }
  const okc = out.filter((c) => c.level && c.winnable), mid = (band[0] + band[1]) / 2;
  if (!okc.length) return { n, fail: "no winnable candidate (" + out.map((c) => c.fail || "lost").slice(0, 4).join("; ") + ")", stats };
  const drop = (c) => (c.moat ? c.moat.drop : 0); // organic moats: the planned opening set first among the good picks
  okc.sort((p, q) => TT.good(q) - TT.good(p) || (TT.good(p) ? drop(p) - drop(q) : 0) || (TT.good(p) ? 100 * Math.abs(gt(p).rate - mid) + TT.aim(p) - 100 * Math.abs(gt(q).rate - mid) - TT.aim(q) : TT.pen(p) - TT.pen(q)) || p.k - q.k);
  const pk = okc[0]; let level = Object.assign({}, pk.level, { win: pk.win, grade: pk.grade }), mys = null;
  if (P.mystery) { const r = mystify(level, P.mystery, B.mystery, rules[tag], pk.seed); level = Object.assign({}, r.level, { win: pk.win, grade: pk.grade }); mys = r.m; }
  return { n, tag, plan: P, seed: pk.seed, level, inBand: !pk.miss, fallback: TT.good(pk) ? null : TT.why(pk), mystery: mys, moat: pk.moat, cands: { tried: out.length, winnable: okc.length, good: okc.filter(TT.good).length, fails: out.filter((c) => c.fail).map((c) => c.fail).slice(0, 3) }, stats };
}

// Workers, one level each, at most `threads` at once; onDone(done, total) after each.
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
        wk.on("exit", () => { if (!got) results[i] = { n: jobs[i].n, fail: "worker died" }; running--; done++; if (onDone) onDone(done, jobs.length); pump(); });
      }
      if (done === jobs.length) resolve(results);
    };
    pump();
  });
}
const threadsOf = (B) => B.budget.threads || Math.max(2, os.cpus().length - 2);

if (!isMainThread) {
  let res; try { res = bakeOne(workerData.job); } catch (e) { res = { n: workerData.job.n, fail: "worker error: " + (e && e.message) }; }
  parentPort.postMessage(res);
} else module.exports = { FEATURES, hidePic, bakeOne, runPool, configs, threadsOf, targetsOf, gradeLevel };
