// Sapper's Path v3 bake (SPEC-v3 §5): tools/bake-config.json + levels/teaching.json -> levels/levels.json (versioned)
// and levels/pool-e{1,2,3}.json (every graded candidate, kept for rebakes and the app's longer curve).
//   ~/.local/opt/node/bin/node tools/bake.js
// Per generated level: perLevel candidates, each a seeded fort (colour count in the level's range), a deal simulated as
// a winning order under the dealing rules (so it wins on Easy, Normal and Hard), then tightened into the level's Normal
// band (gen.tune: card moves between columns, squad splits and merges). Every candidate is graded on all three
// difficulties. Levels are picked in order: the in-band candidate nearest its band's centre that is not a near-duplicate
// of an earlier pick; otherwise the nearest miss, logged as a fallback. Levels run in worker threads, one task per
// level with seeds derived from the level number, so thread timing never changes the output. Never throws: a task that
// fails is logged and its level falls back. The report tables are written between the bake markers of
// tools/v3-m0-report.md. `--out DIR` writes levels.json, the pools and the report into DIR instead (a trial bake that
// leaves the tracked level files alone).
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const E = require("../src/engine.js");
const G = require("./gen.js");
const R = require("./grade.js");

const ROOT = path.join(__dirname, "..");
const OUT = (() => { const i = process.argv.indexOf("--out"); return i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null; })();
const outPath = (rel) => (OUT ? path.join(OUT, path.basename(rel)) : path.join(ROOT, rel));
const DIFFS = ["easy", "normal", "hard"];

// ---- shared by main and workers -------------------------------------------------------------------------------
function eraOf(n, C) { for (const e of Object.keys(C.eras)) if (n >= C.eras[e].from && n <= C.eras[e].to) return +e; return 1; }
function bandOf(n, C) {
  const cv = C.curve;
  if (n <= cv.early.to) return { kind: "early", sub: "early", band: cv.early.band };
  if (n <= cv.mid.to) { const k = (n - cv.mid.from) % cv.mid.saw.length; return { kind: "mid", sub: "saw" + k, band: cv.mid.saw[k] }; }
  const sub = cv.late.pattern[(n - cv.late.from) % cv.late.pattern.length];
  return { kind: "late", sub, band: cv.late.bands[sub] };
}
function coloursOf(n, C, b) {
  if (b.sub === "relief") return C.reliefColours;
  if (b.sub === "saw" + (C.curve.mid.saw.length - 1)) return C.sawLowColours;
  for (const [a, z, lo, hi] of C.colours) if (n >= a && n <= z) return [lo, hi];
  return [5, 5];
}
const seedOf = (C, n, k) => (C.seed ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(k + 7, 0x85EBCA77)) | 0;
const countPix = (L) => { let p = 0; for (const row of L.grid) for (const ch of row) if (E.matOf(ch)) p++; return p; };

// Grade a finished level on every difficulty; `hint` is a known winning order (tried first).
function gradeLevel(L, rules, C, hint, seed) {
  const B = E.compile(L), win = {}, grade = { cards: B.ncards, pixels: B.pixTotal, colours: G.coloursOf(L).size };
  for (const d of DIFFS) {
    let order = hint, line = order ? R.line(B, rules[d], order) : null;
    if (!line || !line.won) { order = R.solve(B, rules[d], C.grade.solveNodes, hint); line = order ? R.line(B, rules[d], order) : null; }
    win[d] = line && line.won ? order : null;
    grade[d] = { rate: +R.rate(B, rules[d], C.grade.playouts, seed).toFixed(4), peak: line ? line.peak : null, len: order ? order.length : null, ms: line && line.won ? line.ms : null };
  }
  const oc = R.orders(B, rules.normal, C.grade.orderCap, C.grade.orderNodes);
  grade.normal.orders = oc.count; grade.normal.ordersCapped = oc.capped; grade.normal.ordersExact = oc.exact;
  grade.normal.greedy = +R.greedy(B, rules.normal, C.grade.greedyPlayouts, seed ^ 0x2545f491).toFixed(3);
  if (win.normal) { const nw = R.narrow(B, rules.normal, win.normal, C.grade.narrowNodes); grade.normal.forced = nw.forced; grade.normal.minSafe = nw.minSafe; grade.normal.meanSafe = nw.meanSafe; grade.normal.narrowUnknown = nw.unknown; }
  return { win, grade };
}

// All candidates for one generated level. Never throws: failures come back as {fail} entries.
function candidates(n, C, rules) {
  const era = eraOf(n, C), b = bandOf(n, C), [cmin, cmax] = coloursOf(n, C, b), out = [], stats = { forts: 0, deals: 0, evals: 0, grades: 0 };
  const D = Object.assign({}, C.deal, C.dealBy[b.kind] || {}, { maxTaps: C.maxTaps, time: rules.hard.time });
  const dealRules = Object.assign({}, rules.hard, { hold: C.deal.hold, archersKill: true });
  const per = (C.candidates.perLevelBy && C.candidates.perLevelBy[b.sub]) || C.candidates.perLevel;
  for (let k = 0; k < per; k++) {
    try {
      let L = null, seed = 0;
      for (let t = 0; t < C.candidates.fortTries && !L; t++) {
        seed = seedOf(C, n, k * 1000 + t);
        const P = Object.assign({}, C.eras[era].gen, { colours: cmin + (Math.abs(seed) % (cmax - cmin + 1)) });
        const f = G.fort(era, seed, P); stats.forts++;
        if (!f) continue;
        const nc = G.coloursOf(f).size; if (nc < cmin || nc > cmax) continue;
        if (era === 2 && !(f.gates && f.gates.length)) continue;
        if (era === 3 && !(f.towers && f.towers.length)) continue;
        L = f;
      }
      if (!L) { out.push({ k, fail: "no fort with " + cmin + "-" + cmax + " colours in " + C.candidates.fortTries + " seeds" }); continue; }
      let dl = null;
      for (let a = 0; a < D.attempts && !dl; a++) { dl = G.deal(L, seed ^ Math.imul(a + 1, 0x27D4EB2F), D); stats.deals++; }
      if (!dl) { out.push({ k, seed, fail: "no deal in " + D.attempts + " attempts" }); continue; }
      const T = Object.assign({}, C.tune, { seed: seed ^ 0x3c6ef372, maxTaps: C.maxTaps }, b.kind === "late" && b.sub !== "relief" ? { narrow: C.tune.narrow } : { narrow: null });
      const res = G.tune(L, dl.play, G.assign(dl.play, 0, seed), b.band[0], b.band[1], T, { normal: rules.normal, deal: dealRules });
      stats.evals += res.evals;
      const level = Object.assign({}, L, { cols: G.colsOf(res.play, res.colOf) });
      const g = gradeLevel(level, rules, C, G.orderOf(res.colOf), seed); stats.grades++;
      const rate = g.grade.normal.rate, miss = Math.max(0, b.band[0] - rate, rate - b.band[1]);
      out.push({ k, seed, level, win: g.win, grade: g.grade, miss: +miss.toFixed(4), tuneSteps: res.steps, winnable: DIFFS.every((d) => g.win[d]) });
    } catch (e) { out.push({ k, fail: "error: " + (e && e.message) }); }
  }
  return { n, era, band: b, colours: [cmin, cmax], cands: out, stats };
}

if (!isMainThread) {
  const { n, C, rules } = workerData;
  let res; try { res = candidates(n, C, rules); } catch (e) { res = { n, cands: [{ fail: "worker error: " + (e && e.message) }], stats: {} }; }
  parentPort.postMessage(res);
  return;
}

// ---- main ------------------------------------------------------------------------------------------------------
function runPool(tasks, threads, C, rules, deadline, onDone) {
  const results = new Array(tasks.length); let next = 0, running = 0, done = 0;
  return new Promise((resolve) => {
    const pump = () => {
      if (done === tasks.length) { resolve(results); return; }
      while (running < threads && next < tasks.length) {
        const i = next++; running++;
        if (Date.now() > deadline) { results[i] = { n: tasks[i], cands: [{ fail: "wall budget" }], stats: {} }; running--; done++; continue; }
        const wk = new Worker(__filename, { workerData: { n: tasks[i], C, rules } });
        let got = false;
        wk.on("message", (m) => { got = true; results[i] = m; });
        wk.on("error", (e) => { console.log("worker error (level " + tasks[i] + "): " + e.message); });
        wk.on("exit", () => { if (!got) results[i] = { n: tasks[i], cands: [{ fail: "worker died" }], stats: {} }; running--; done++; if (onDone) onDone(done, tasks.length); pump(); });
      }
      if (done === tasks.length) resolve(results);
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

(async () => {
  const t0 = Date.now(), log = [], say = (s) => { log.push(s); console.log(s); };
  let C, CFG, TEACH;
  try {
    C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
    CFG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
    TEACH = JSON.parse(fs.readFileSync(path.join(ROOT, "levels/teaching.json"), "utf8")).levels;
  } catch (e) { console.log("bake: cannot read config: " + e.message); process.exitCode = 1; return; }
  const rules = { easy: E.rulesOf(CFG.v3, "easy"), normal: E.rulesOf(CFG.v3, "normal"), hard: E.rulesOf(CFG.v3, "hard") }, deadline = t0 + C.budget.wallSec * 1000;
  const threads = C.budget.threads || Math.max(2, os.cpus().length - 2);
  const teachBy = new Map(TEACH.map((L) => [L.n, L]));
  const tasks = []; for (let n = 1; n <= C.levels; n++) if (!teachBy.has(n)) tasks.push(n);
  say("bake v" + C.version + ": " + C.levels + " levels, " + tasks.length + " generated on " + threads + " threads");
  const results = await runPool(tasks, threads, C, rules, deadline, (d, t) => { if (d % 10 === 0 || d === t) console.log("  " + d + "/" + t + " levels  " + ((Date.now() - t0) / 1000).toFixed(1) + " s"); });
  const byN = new Map(results.map((r) => [r.n, r]));
  const tot = { forts: 0, deals: 0, evals: 0, grades: 0 };
  for (const r of results) for (const k of Object.keys(tot)) tot[k] += (r.stats && r.stats[k]) || 0;

  const levels = [], fallbacks = [], lookMiss = [], pools = { 1: [], 2: [], 3: [] };
  for (let n = 1; n <= C.levels; n++) {
    const b = bandOf(n, C), era = eraOf(n, C), id = "e" + era + "-" + String(n).padStart(2, "0");
    if (teachBy.has(n)) {
      const T = teachBy.get(n), L = Object.assign({ w: T.w, h: T.h, grid: T.grid, gates: T.gates || [], towers: T.towers || [], cols: T.cols }, T.safeArchers ? { safeArchers: true } : {});
      let g; try { g = gradeLevel(L, rules, C, null, seedOf(C, n, 0)); } catch (e) { say("level " + n + ": teaching level failed to grade: " + e.message); continue; }
      const winnable = DIFFS.every((d) => g.win[d]); if (!winnable) say("level " + n + ": teaching level NOT winnable on every difficulty");
      levels.push(Object.assign({ id, n, era, source: "teaching", name: T.name, teaches: T.teaches, hint: T.hint, band: b.sub, target: b.band }, L, { win: g.win, grade: g.grade, exempt: "teaching" }));
      continue;
    }
    const r = byN.get(n), cands = (r && r.cands) || [], ok = cands.filter((c) => c.level && c.winnable);
    for (const c of ok) pools[era].push({ n, k: c.k, seed: c.seed, band: b.sub, target: b.band, miss: c.miss, grade: c.grade, win: c.win, level: c.level });
    for (const c of cands) if (c.fail) say("level " + n + " candidate " + c.k + ": " + c.fail);
    const mid = (b.band[0] + b.band[1]) / 2;
    const lateHard = b.kind === "late" && b.sub !== "relief";
    // Late hard slots: in-band candidates the lookahead player wins no more than its target (C.lookahead) first, nearest
    // the band's centre among them; if none, the lowest lookahead rate. Elsewhere the band's centre.
    const lookT0 = lateHard && C.lookahead ? C.lookahead[b.sub] : null, over = (c) => (lookT0 != null && c.grade.normal.greedy > lookT0 ? 1 : 0);
    ok.sort((p, q) => p.miss - q.miss || over(p) - over(q) || (over(p) ? p.grade.normal.greedy - q.grade.normal.greedy : 0) || Math.abs(p.grade.normal.rate - mid) - Math.abs(q.grade.normal.rate - mid) || p.k - q.k);
    let pickC = null, why = null;
    for (const c of ok) { if (c.miss > 0) break; if (!levels.some((L) => nearDup(L, c.level, C.dedupe.sameCells))) { pickC = c; break; } }
    if (!pickC) {
      pickC = ok.find((c) => !levels.some((L) => nearDup(L, c.level, C.dedupe.sameCells))) || ok[0] || null;
      why = !ok.length ? "no winnable candidate" : pickC.miss > 0 ? "out of band: Normal " + pct(pickC.grade.normal.rate) + " vs " + pct(b.band[0]) + "-" + pct(b.band[1]) : "near-duplicate of an earlier level";
    }
    if (!pickC) { fallbacks.push({ n, why }); say("level " + n + ": NO LEVEL (" + why + ")"); continue; }
    if (why) { fallbacks.push({ n, why }); say("level " + n + ": fallback, " + why); }
    // Late hard slots are judged by the thinking player too (C.lookahead): an in-band pick over its target is logged.
    const lookT = lateHard && C.lookahead ? C.lookahead[b.sub] : null, look = pickC.grade.normal.greedy;
    if (lookT != null && look > lookT) { lookMiss.push({ n, sub: b.sub, look }); say("level " + n + ": lookahead fallback, " + pct(look) + " over the " + pct(lookT) + " target (" + ok.filter((c) => c.miss === 0).length + " in-band candidates)"); }
    levels.push(Object.assign({ id, n, era, source: "gen", seed: pickC.seed, band: b.sub, target: b.band }, pickC.level, { win: pickC.win, grade: pickC.grade, inBand: pickC.miss === 0 }, why ? { fallback: why } : {}));
  }
  const secs = (Date.now() - t0) / 1000;
  const graded = tot.evals + tot.grades * 3;
  say("bake: " + levels.length + " levels in " + secs.toFixed(1) + " s; forts " + tot.forts + ", deals " + tot.deals + ", tune evaluations " + tot.evals + ", full grades " + tot.grades + " (x3 difficulties)");
  say("bake: " + (graded / secs).toFixed(0) + " graded candidate decks per second across " + threads + " threads (" + (graded / secs / threads).toFixed(1) + " per thread)");

  const late = levels.filter((l) => l.band === "hard" || l.band === "hardest"), med = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : null; };
  for (const sub of ["hard", "hardest"]) { const g = late.filter((l) => l.band === sub && !l.exempt).map((l) => l.grade.normal.greedy); say("bake: lookahead player on " + sub + " (Normal): median " + pct(med(g)) + ", max " + pct(Math.max(...g)) + " over " + g.length + " levels"); }
  { const ms = levels.map((l) => l.grade.normal.ms).filter((x) => x != null); say("bake: patient winning line on Normal at 1x (engine time): median " + (med(ms) / 1000).toFixed(0) + " s, max " + (Math.max(...ms) / 1000).toFixed(0) + " s"); }
  say("bake: taps per level: max " + Math.max(...levels.map((l) => l.grade.cards)) + " (cap " + C.maxTaps + "); late band max " + Math.max(...levels.filter((l) => l.n >= C.curve.late.from).map((l) => l.grade.cards)));
  const out = { version: C.version, bake: { config: C.version, seed: C.seed, forts: tot.forts, deals: tot.deals, tuneEvals: tot.evals, fullGrades: tot.grades, fallbacks, lookaheadFallbacks: lookMiss }, levels };
  try {
    if (OUT) fs.mkdirSync(OUT, { recursive: true });
    writeAtomic(outPath("levels/levels.json"), JSON.stringify(out));
    for (const e of [1, 2, 3]) writeAtomic(outPath("levels/pool-e" + e + ".json"), JSON.stringify({ version: C.version, era: e, cands: pools[e] }));
  } catch (e) { say("bake: write failed: " + e.message); process.exitCode = 1; }
  try { writeReport(out, C, log); } catch (e) { say("bake: report tables failed: " + e.message); }
})();

// ---- report tables (between the markers in tools/v3-m0-report.md) --------------------------------------------------
function writeReport(out, C, log) {
  const file = outPath("tools/v3-m0-report.md"), A = "<!-- bake:start -->", Z = "<!-- bake:end -->";
  const L = out.levels, med = (a) => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[(s.length - 1) >> 1] : null; };
  const rows = [];
  rows.push("### Bands on Normal", "", "| Band | Levels | In band | Exempt (teaching) | Normal min | median | max |", "|---|---|---|---|---|---|---|");
  for (const kind of ["early", "saw0", "saw1", "saw2", "hard", "hardest", "relief"]) {
    const ls = L.filter((l) => (kind === "early" ? l.band === "early" : l.band === kind));
    if (!ls.length) continue;
    const gen = ls.filter((l) => !l.exempt), rs = ls.map((l) => l.grade.normal.rate);
    const t = ls[0].target;
    rows.push(`| ${kind} ${pct(t[0])}-${pct(t[1])} | ${ls.length} | ${gen.filter((l) => l.inBand).length}/${gen.length} | ${ls.length - gen.length} | ${pct(Math.min(...rs))} | ${pct(med(rs))} | ${pct(Math.max(...rs))} |`);
  }
  rows.push("", "### Every level", "", "| # | Era | Band | Target (Normal) | Easy | Normal | Hard | In band | Cards | Colours | Pixels | Peak line E/N/H | Winning orders (Normal, cap " + C.grade.orderCap + ") | Lookahead player (Normal) | Forced turns / mean safe taps | Note |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const l of L) {
    const g = l.grade, oc = g.normal.orders + (g.normal.ordersCapped ? "+" : g.normal.ordersExact ? "" : "?");
    rows.push(`| ${l.n} | ${l.era} | ${l.band} | ${pct(l.target[0])}-${pct(l.target[1])} | ${pct(g.easy.rate)} | ${pct(g.normal.rate)} | ${pct(g.hard.rate)} | ${l.exempt ? "exempt" : l.inBand ? "yes" : "NO"} | ${g.cards} | ${g.colours} | ${g.pixels} | ${g.easy.peak}/${g.normal.peak}/${g.hard.peak} | ${oc} | ${pct(g.normal.greedy)} | ${g.normal.forced}/${g.normal.meanSafe} | ${l.exempt ? "teaching: " + l.teaches : l.fallback || ""} |`);
  }
  rows.push("", "### Bake", "", "```", ...log, "```");
  const block = A + "\n" + rows.join("\n") + "\n" + Z;
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "# Sapper's Path v3 M0 report\n\n" + A + "\n" + Z + "\n";
  if (!text.includes(A)) text += "\n" + A + "\n" + Z + "\n";
  text = text.slice(0, text.indexOf(A)) + block + text.slice(text.indexOf(Z) + Z.length);
  writeAtomic(file, text);
}
