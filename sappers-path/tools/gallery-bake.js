// Sapper's Path v4 M4, the Gallery bake: levels/gallery-manifest.json (the kept pictures, in the Gallery's order) +
// tools/gallery-config.json (bake) -> levels/gallery.json (versioned). levels/levels.json is never read or written.
//   ~/.local/opt/node/bin/node tools/gallery-bake.js [--out DIR] [--only A-B]
// Per picture: the converter's plan (tools/convert.js: v4.1 a picture board entered from the bottom, its own palette), then `perLevel` candidates, each a
// deal simulated as a winning order under the dealing rules (Hard's 4 spaces, so it wins on Easy, Normal and Hard) within
// the dead-time cap, the outline's squads capped (bake.capOf: a narrow first breach, then more black squads), tightened
// into the slot's Normal band (gen.tune; the hard slots also narrow the lookahead player), and graded on all three
// difficulties with its patient play-through time, its longest single tap, the lookahead player and the fast tapper. The
// pick is the candidate meeting every target (band, time, dead time, fast tapper, taps) nearest its band's centre, else
// the least total miss (logged as a fallback naming what it missed). Workers, one per picture, seeds from the position:
// thread timing never changes the output. Never throws: a picture that fails is logged and left out. The report tables go
// between the gallery markers of tools/v4.1-rebake.md (v4.1; it was tools/v4-m4-gallery.md). --out DIR writes gallery.json and the report there (a trial);
// --only A-B bakes only those positions.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const E = require("../src/engine.js");
const G = require("./gen.js");
const R = require("./grade.js");
const V = require("./convert.js");

const ROOT = path.join(__dirname, "..");
const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : null; };
const OUT = arg("out") ? path.resolve(arg("out")) : null;
const ONLY = arg("only") ? arg("only").split("-").map(Number) : null;
const outPath = (rel) => (OUT ? path.join(OUT, path.basename(rel)) : path.join(ROOT, rel));
const DIFFS = ["easy", "normal", "hard"];

// ---- shared by main and workers -------------------------------------------------------------------------------
// The Gallery's curve (bake.curve): the first `intro` pictures in the intro band, then the pattern repeating.
function bandOf(n, B) { const cv = B.curve; const sub = n <= cv.intro ? "intro" : cv.pattern[(n - cv.intro - 1) % cv.pattern.length]; return { sub, band: cv.bands[sub] }; }
const seedOf = (B, n, k) => (B.seed ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(k + 7, 0x85EBCA77)) | 0;
// Grade a level on every difficulty (a stored winning order each, the random-tap rate, the patient time); on Normal also
// the lookahead player, the longest single tap and the fast tapper. `hint`: a known winning order (tried first).
function gradeLevel(L, rules, B, hint, seed) {
  const Bc = E.compile(L), win = {}, grade = { cards: Bc.ncards, pixels: Bc.pixTotal, colours: G.coloursOf(L).size };
  for (const d of DIFFS) {
    let order = hint, line = order ? R.line(Bc, rules[d], order) : null;
    if (!line || !line.won) { order = R.solve(Bc, rules[d], B.grade.solveNodes, hint); line = order ? R.line(Bc, rules[d], order) : null; }
    win[d] = line && line.won ? order : null;
    grade[d] = { rate: +R.rate(Bc, rules[d], B.grade.playouts, seed).toFixed(4), peak: line ? line.peak : null, len: order ? order.length : null, ms: line && line.won ? line.ms : null };
    if (d === "normal") grade[d].maxWait = line && line.won ? line.maxWait : null;
  }
  grade.normal.greedy = +R.greedy(Bc, rules.normal, B.grade.greedyPlayouts, seed ^ 0x2545f491).toFixed(3);
  grade.normal.fast = +R.fast(Bc, rules.normal, B.fast.games, seed ^ 0x1f123bb5, B.fast.gapMs).toFixed(4);
  return { win, grade };
}
const fastBad = (g, B) => g.normal.fast - g.normal.rate >= B.fast.pts || (g.normal.fast > B.fast.ratio * g.normal.rate && g.normal.fast - g.normal.rate >= B.fast.minPts);
// The outline breach on the stored Normal line: how many black squads, the tap that sends the first one, and where the
// first black card sits at the start (its column and row, 0 = the front).
function breachOf(L, inkId) {
  if (!inkId) return null;
  const order = L.win.normal || "", heads = [0, 0, 0, 0, 0]; let first = -1, squads = 0, at = null;
  L.cols.forEach((col, j) => col.forEach((cd, i) => { if (cd[0] === inkId) { squads++; if (!at || i < at[1]) at = [j, i]; } }));
  for (let t = 0; t < order.length; t++) { const j = order.charCodeAt(t) - 48, cd = L.cols[j][heads[j]++]; if (cd && cd[0] === inkId && first < 0) first = t + 1; }
  return { ink: inkId, squads, firstTap: first, start: at };
}

// All candidates for one picture. Never throws: failures come back as {fail} entries.
function candidates(job, B, rules) {
  const { n, pic } = job, b = bandOf(n, B), out = [], stats = { deals: 0, evals: 0, grades: 0 };
  let P; try { P = V.planOf(pic, V.config()); } catch (e) { return { n, cands: [{ fail: "convert: " + e.message }], stats }; }
  const L = { w: P.w, h: P.h, grid: P.grid, pic: true }, inkId = +Object.keys(P.pal).find((k) => P.pal[k].c === V.config().convert.ink) || 0;
  const D = Object.assign({}, B.deal, B.dealBy[b.sub] || {}, { maxTaps: B.maxTaps, time: rules.hard.time, maxWaitMs: B.maxWaitMs }, inkId ? { capOf: { [inkId]: B.capOf } } : {});
  const dealRules = Object.assign({}, rules.hard, { hold: B.deal.hold, archersKill: true });
  for (let k = 0; k < (B.candidates.perLevelBy[b.sub] || B.candidates.perLevel); k++) {
    try {
      const seed = seedOf(B, n, k);
      let dl = null; for (let a = 0; a < D.attempts && !dl; a++) { dl = G.deal(L, seed ^ Math.imul(a + 1, 0x27D4EB2F), D); stats.deals++; }
      if (!dl) { out.push({ k, seed, fail: "no deal in " + D.attempts + " attempts" }); continue; }
      const T = Object.assign({}, B.tune, { seed: seed ^ 0x3c6ef372, maxTaps: B.maxTaps, maxWaitMs: B.maxWaitMs }, B.narrowFor.indexOf(b.sub) >= 0 ? { narrow: B.tune.narrow } : { narrow: null });
      const res = G.tune(L, dl.play, G.assign(dl.play, 0, seed), b.band[0], b.band[1], T, { normal: rules.normal, deal: dealRules }); stats.evals += res.evals;
      const level = Object.assign({}, L, { cols: G.colsOf(res.play, res.colOf) }), g = gradeLevel(level, rules, B, G.orderOf(res.colOf), seed); stats.grades++;
      const rate = g.grade.normal.rate, miss = Math.max(0, b.band[0] - rate, rate - b.band[1]);
      out.push({ k, seed, level, win: g.win, grade: g.grade, miss: +miss.toFixed(4), taps: res.play.length, winnable: DIFFS.every((d) => g.win[d]) });
    } catch (e) { out.push({ k, fail: "error: " + (e && e.message) }); }
  }
  return { n, b, plan: { pal: P.pal, stats: P.stats, inkId }, cands: out, stats };
}

if (!isMainThread) {
  const { job, B, rules } = workerData;
  let res; try { res = candidates(job, B, rules); } catch (e) { res = { n: job.n, cands: [{ fail: "worker error: " + (e && e.message) }], stats: {} }; }
  parentPort.postMessage(res);
  return;
}

// ---- main ------------------------------------------------------------------------------------------------------
function runPool(jobs, threads, B, rules, deadline, onDone) {
  const results = new Array(jobs.length); let next = 0, running = 0, done = 0;
  return new Promise((resolve) => {
    const pump = () => {
      if (done === jobs.length) { resolve(results); return; }
      while (running < threads && next < jobs.length) {
        const i = next++; running++;
        if (Date.now() > deadline) { results[i] = { n: jobs[i].n, cands: [{ fail: "wall budget" }], stats: {} }; running--; done++; continue; }
        const wk = new Worker(__filename, { workerData: { job: jobs[i], B, rules } }); let got = false;
        wk.on("message", (m) => { got = true; results[i] = m; });
        wk.on("error", (e) => { console.log("worker error (picture " + jobs[i].n + "): " + e.message); });
        wk.on("exit", () => { if (!got) results[i] = { n: jobs[i].n, cands: [{ fail: "worker died" }], stats: {} }; running--; done++; if (onDone) onDone(done, jobs.length); pump(); });
      }
      if (done === jobs.length) resolve(results);
    };
    pump();
  });
}
function nearDup(A, Bl, frac) { if (A.w !== Bl.w || A.h !== Bl.h) return false; let same = 0; for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (A.grid[y][x] === Bl.grid[y][x]) same++; return same / (A.w * A.h) >= frac; }
function writeAtomic(file, text) { const tmp = file + ".tmp"; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }
const pct = (x) => (x == null ? "-" : (100 * x).toFixed(1) + "%");
const secs = (ms) => (ms == null ? "-" : (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + " s");
const med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; };

(async () => {
  const t0 = Date.now(), log = [], say = (s) => { log.push(s); console.log(s); };
  let GC, CFG, M;
  try { GC = V.config(); CFG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8")); M = V.manifest(); } catch (e) { console.log("gallery bake: cannot read config: " + e.message); process.exitCode = 1; return; }
  const B = GC.bake, rules = { easy: E.rulesOf(CFG.v3, "easy"), normal: E.rulesOf(CFG.v3, "normal"), hard: E.rulesOf(CFG.v3, "hard") };
  const kept = M.order.map((id) => M.pictures.find((p) => p.id === id)).filter((p) => p && p.keep !== false);
  const inRun = (n) => !ONLY || (n >= ONLY[0] && n <= (ONLY[1] || ONLY[0]));
  const jobs = kept.map((pic, i) => ({ n: i + 1, pic })).filter((j) => inRun(j.n)), threads = B.budget.threads || Math.max(2, os.cpus().length - 2);
  say("gallery bake v" + B.version + ": " + kept.length + " pictures, " + jobs.length + " baked on " + threads + " threads" + (ONLY ? " (only " + ONLY.join("-") + ")" : ""));
  const results = await runPool(jobs, threads, B, rules, t0 + B.budget.wallSec * 1000, (d, t) => { if (d % 10 === 0 || d === t) console.log("  " + d + "/" + t + "  " + ((Date.now() - t0) / 1000).toFixed(1) + " s"); });
  const levels = [], fallbacks = [], DU = B.duration;
  for (const r of results) {
    const pic = kept[r.n - 1], cands = r.cands || [], ok = cands.filter((c) => c.level && c.winnable);
    for (const c of cands) if (c.fail) say("picture " + r.n + " (" + pic.id + ") candidate " + c.k + ": " + c.fail);
    if (!r.b) { fallbacks.push({ n: r.n, why: "not converted" }); say("picture " + r.n + ": NOT CONVERTED"); continue; }
    const b = r.b, mid = (b.band[0] + b.band[1]) / 2;
    const dmiss = (c) => (c.grade.normal.ms == null ? 1e9 : Math.max(0, c.grade.normal.ms - DU.maxMs));
    const wmiss = (c) => (c.grade.normal.maxWait == null ? 1e9 : Math.max(0, c.grade.normal.maxWait - B.maxWaitMs));
    const fbad = (c) => (fastBad(c.grade, B) ? 1 : 0), tmiss = (c) => Math.max(0, (c.win.normal || "").length - B.maxTaps);
    const good = (c) => !c.miss && !dmiss(c) && !wmiss(c) && !fbad(c) && !tmiss(c);
    const PN = B.penalty, pen = (c) => PN.band * c.miss + dmiss(c) / PN.durationMs + wmiss(c) / PN.waitMs + PN.fast * fbad(c) + tmiss(c);
    ok.sort((p, q) => good(q) - good(p) || (good(p) ? Math.abs(p.grade.normal.rate - mid) - Math.abs(q.grade.normal.rate - mid) : pen(p) - pen(q)) || p.k - q.k);
    const pickC = ok.find((c) => !levels.some((L) => nearDup(L, c.level, B.dedupe))) || null;
    if (!pickC) { fallbacks.push({ n: r.n, why: "no winnable candidate" }); say("picture " + r.n + " (" + pic.id + "): NO LEVEL"); continue; }
    let why = null;
    if (!good(pickC)) { const w = [];
      if (pickC.miss) w.push("out of band: Normal " + pct(pickC.grade.normal.rate) + " vs " + pct(b.band[0]) + "-" + pct(b.band[1]));
      if (dmiss(pickC)) w.push("duration " + secs(pickC.grade.normal.ms) + " over " + DU.maxMs / 1000 + " s");
      if (wmiss(pickC)) w.push("longest tap " + secs(pickC.grade.normal.maxWait) + " over " + B.maxWaitMs / 1000 + " s");
      if (fbad(pickC)) w.push("fast tapper " + pct(pickC.grade.normal.fast) + " vs patient " + pct(pickC.grade.normal.rate));
      if (tmiss(pickC)) w.push("taps " + pickC.win.normal.length + " over " + B.maxTaps);
      why = w.join("; "); fallbacks.push({ n: r.n, why }); say("picture " + r.n + " (" + pic.id + "): fallback, " + why); }
    const credit = pic.kind === "painting" ? pic.artist + ", " + pic.date : pic.set === "Twemoji" ? "Twemoji (CC BY 4.0)" : pic.set === "Noto Emoji" ? "Noto Emoji (Apache 2.0)" : "Click it! Studios";
    const L = Object.assign({ id: "g-" + pic.id, n: r.n, gallery: true, title: pic.title, kind: pic.kind, src: pic.id, credit, band: b.sub, target: b.band, seed: pickC.seed },
      pickC.level, { pal: r.plan.pal, win: pickC.win, grade: pickC.grade, inBand: !pickC.miss, convert: r.plan.stats }, why ? { fallback: why } : {});
    L.breach = breachOf(L, r.plan.inkId);
    levels.push(L);
  }
  levels.sort((a, b) => a.n - b.n);
  const secsAll = (Date.now() - t0) / 1000;
  say("gallery bake: " + levels.length + " levels in " + secsAll.toFixed(1) + " s, " + fallbacks.length + " fallbacks");
  const ms = levels.map((l) => l.grade.normal.ms).filter((x) => x != null), w = levels.map((l) => l.grade.normal.maxWait).filter((x) => x != null);
  if (ms.length) say("gallery bake: patient play-through on the stored Normal line at 1x: median " + secs(med(ms)) + ", " + secs(Math.min(...ms)) + "-" + secs(Math.max(...ms)) + "; longest single tap max " + secs(Math.max(...w)) + "; taps max " + Math.max(...levels.map((l) => l.win.normal.length)));
  const out = { version: B.version, bake: { config: B.version, seed: B.seed, time: CFG.v3.time, seconds: +secsAll.toFixed(1), fallbacks }, levels };
  try { if (OUT) fs.mkdirSync(OUT, { recursive: true }); writeAtomic(outPath("levels/gallery.json"), JSON.stringify(out)); } catch (e) { say("gallery bake: write failed: " + e.message); process.exitCode = 1; }
  try { writeReport(out, B, log, kept); } catch (e) { say("gallery bake: report failed: " + e.message); }
})();

// ---- report tables (v4.1: between the gallery markers in tools/v4.1-rebake.md) -------------------------------------
function writeReport(out, B, log, kept) {
  const file = outPath("tools/v4.1-rebake.md"), A = "<!-- gallery:start -->", Z = "<!-- gallery:end -->", L = out.levels, rows = [];
  rows.push("### Bands on Normal", "", "| Slot | Band | Levels | In band | Normal min | median | max | Fast tapper median | Lookahead median |", "|---|---|---|---|---|---|---|---|---|");
  for (const sub of Object.keys(B.curve.bands)) { const ls = L.filter((l) => l.band === sub); if (!ls.length) continue; const rs = ls.map((l) => l.grade.normal.rate), t = B.curve.bands[sub];
    rows.push(`| ${sub} | ${pct(t[0])}-${pct(t[1])} | ${ls.length} | ${ls.filter((l) => l.inBand).length}/${ls.length} | ${pct(Math.min(...rs))} | ${pct(med(rs))} | ${pct(Math.max(...rs))} | ${pct(med(ls.map((l) => l.grade.normal.fast)))} | ${pct(med(ls.map((l) => l.grade.normal.greedy)))} |`); }
  rows.push("", "### Every level", "", "Normal = the random-tap rate (" + B.grade.playouts + " games); lookahead = the one-move-lookahead player (" + B.grade.greedyPlayouts + "); fast = the fast tapper (" + B.fast.games + "); time and longest tap = patient play on the stored Normal line at 1x; ΔE = the smallest CIEDE2000 between two of its colours; breach = black squads, the tap that sends the first, where the first black card starts (column, row).", "",
    "| # | Id | Title | Kind | Slot | Board | Colours | Min ΔE00 | Taps (cards) | Normal | Easy | Hard | Lookahead | Fast | Time | Longest tap | Breach | Note |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const l of L) { const g = l.grade, br = l.breach;
    rows.push(`| ${l.n} | ${l.src} | ${l.title} | ${l.kind} | ${l.band} | ${l.w}×${l.h} | ${l.convert.colours} | ${l.convert.minDE} | ${l.win.normal.length} (${g.cards}) | ${pct(g.normal.rate)} | ${pct(g.easy.rate)} | ${pct(g.hard.rate)} | ${pct(g.normal.greedy)} | ${pct(g.normal.fast)}${fastBad(g, B) ? " !" : ""} | ${secs(g.normal.ms)} | ${secs(g.normal.maxWait)} | ${br ? br.squads + ", tap " + br.firstTap + ", " + (br.start ? br.start.join("/") : "-") : "-"} | ${l.fallback || ""} |`); }
  rows.push("", "### Bake log", "", "```", ...log, "```");
  const block = A + "\n" + rows.join("\n") + "\n" + Z;
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "# Sapper's Path v4.1 rebake\n\n" + A + "\n" + Z + "\n";
  if (!text.includes(A)) text += "\n" + A + "\n" + Z + "\n";
  text = text.slice(0, text.indexOf(A)) + block + text.slice(text.indexOf(Z) + Z.length);
  writeAtomic(file, text);
}
