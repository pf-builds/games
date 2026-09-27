// Flockstop par report: MEASURE before setting par targets (DeJam lesson). For every candidate config in
// tools/report-config.json and every weekday in tools/bake-config.json, roll N random layouts, solve each,
// and write tools/par-report.md: par histograms, dead-end stats, solve time, capped rate, and how often each
// accept criterion passes. Runs the solves across worker threads.
// Run: ~/.local/opt/node/bin/node tools/report.js [layoutsPerConfig=400]
"use strict";
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const path = require("path");
const fs = require("fs");
const os = require("os");

if (!isMainThread) {
  const Gen = require("./gen.js"), Solver = require("../src/solver.js");
  const { cfg, seed, n } = workerData, rng = Gen.mulberry32(seed), out = [];
  for (let made = 0, tries = 0; made < n && tries < n * 20; tries++) {
    const b = Gen.generate(cfg, rng);
    if (!b) continue;
    made++;
    const r = Solver.solve(b, { cap: cfg.cap });
    out.push(Object.assign({ why: Gen.rejectReason(r, cfg) }, r, r.solved ? { board: b } : {}));
  }
  parentPort.postMessage(out);
  return;
}

const Sym = require("../src/sym.js");
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function runAll(jobs, threads) {
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length); let next = 0, done = 0;
    const launch = () => {
      if (next >= jobs.length) return;
      const k = next++, w = new Worker(__filename, { workerData: jobs[k] });
      w.once("message", (m) => { results[k] = m; done++; if (done === jobs.length) resolve(results); else launch(); });
      w.once("error", reject);
    };
    for (let i = 0; i < Math.min(threads, jobs.length); i++) launch();
  });
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "n/a");
const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : "-");
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

// Board JSON → monospace picture. Pens show their opening as an arrow (white ^ > v <, black ⇑ ⇒ ⇓ ⇐).
function ascii(b) {
  const W = { N: "^", E: ">", S: "v", W: "<" }, K = { N: "⇑", E: "⇒", S: "⇓", W: "⇐" };
  const lines = [];
  for (let y = 0; y < b.h; y++) {
    const cells = [];
    for (let x = 0; x < b.w; x++) {
      const ch = b.rows[y][x];
      if (ch === "P") { const p = b.pens.find((e) => e.x === x && e.y === y); cells.push(p.c === "w" ? W[p.open] : K[p.open]); }
      else cells.push(ch);
    }
    lines.push("    " + cells.join(" "));
  }
  return lines.join("\n");
}

function summarize(name, cfg, rows) {
  const n = rows.length, solved = rows.filter((r) => r.solved), capped = rows.filter((r) => r.capped).length;
  const pars = solved.map((r) => r.par).sort((a, b) => a - b);
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b), states = rows.map((r) => r.states).sort((a, b) => a - b);
  const inBand = solved.filter((r) => r.par >= cfg.par[0] && r.par <= cfg.par[1]);
  const accepted = rows.filter((r) => !r.why);
  const why = {}; for (const r of rows) if (r.why) why[r.why] = (why[r.why] || 0) + 1;
  const hist = {}; for (const p of pars) { const k = p >= 30 ? "30+" : String(p); hist[k] = (hist[k] || 0) + 1; }
  return { name, cfg, n, solved: solved.length, capped, pars, ms, states, inBand, accepted, why, hist,
    msPerAccept: accepted.length ? ms.reduce((s, v) => s + v, 0) / accepted.length : Infinity };
}

function section(s) {
  const c = s.cfg, band = s.inBand, L = [];
  L.push("### " + s.name);
  L.push("");
  L.push("`" + JSON.stringify(Object.assign({}, c, { why: undefined, name: undefined })) + "`");
  L.push("");
  L.push("- layouts " + s.n + ", solvable " + pct(s.solved, s.n) + ", capped " + pct(s.capped, s.n) +
    "; solve ms p50/p90/max " + q(s.ms, 0.5) + "/" + q(s.ms, 0.9) + "/" + s.ms[s.ms.length - 1] +
    "; states p50/p90/max " + q(s.states, 0.5) + "/" + q(s.states, 0.9) + "/" + s.states[s.states.length - 1]);
  L.push("- par p10/p50/p90 " + q(s.pars, 0.1) + "/" + q(s.pars, 0.5) + "/" + q(s.pars, 0.9) + "; in band " + c.par[0] + "-" + c.par[1] + ": " + pct(band.length, s.n) + " of layouts");
  if (band.length) {
    const de = band.map((r) => r.deadEdges).sort((a, b) => a - b);
    L.push("- in-band boards (" + band.length + "): dead-end branches p10/p50/p90 " + q(de, 0.1) + "/" + q(de, 0.5) + "/" + q(de, 0.9) +
      ", dead states mean " + mean(band.map((r) => r.dead)).toFixed(0) + ", start traps mean " + mean(band.map((r) => r.startTraps)).toFixed(2) +
      ", traps along the par line mean " + mean(band.map((r) => r.trapsOnPath)).toFixed(1) +
      ", forced steps " + pct(band.reduce((a, r) => a + r.forcedSteps, 0), band.reduce((a, r) => a + r.par, 0)) +
      ", needs stopper " + pct(band.filter((r) => r.needsStopper).length, band.length) +
      ", pen on swipe 1 " + pct(band.filter((r) => r.penOnFirst).length, band.length));
  }
  const uniq = new Set(s.accepted.map((r) => Sym.canonicalKey(r.board))).size;
  L.push("- accepted " + s.accepted.length + "/" + s.n + " (" + pct(s.accepted.length, s.n) + ", " + uniq + " distinct up to symmetry), ~" + (s.msPerAccept === Infinity ? "∞" : s.msPerAccept.toFixed(0)) + " ms solve per accept; rejects: " +
    Object.keys(s.why).sort((a, b) => s.why[b] - s.why[a]).map((k) => k + " " + s.why[k]).join(", "));
  const keys = Object.keys(s.hist).sort((a, b) => parseInt(a) - parseInt(b)), top = Math.max(...keys.map((k) => s.hist[k]), 1);
  L.push("");
  L.push("```");
  for (const k of keys) L.push(("par " + k).padEnd(7) + " " + String(s.hist[k]).padStart(4) + " " + "#".repeat(Math.ceil((40 * s.hist[k]) / top)) + (k >= c.par[0] && k <= c.par[1] ? "  <" : ""));
  L.push("```");
  L.push("");
  return L.join("\n");
}

(async () => {
  const t0 = Date.now(), N = +(process.argv[2] || 400), CHUNK = 50, threads = Math.max(2, os.cpus().length - 2);
  const bake = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
  const explore = JSON.parse(fs.readFileSync(path.join(__dirname, "report-config.json"), "utf8"));
  const configs = [];
  for (const d of DAYS) configs.push({ name: DAY_NAMES[d] + " (proposed)", day: d, cfg: Object.assign({ cap: bake.cap }, bake.days[d]) });
  for (const c of explore.candidates) configs.push({ name: c.name, day: c.day, cfg: Object.assign({ cap: bake.cap }, bake.days[c.day], c) });
  const jobs = [];
  configs.forEach((c, i) => { for (let k = 0; k < N / CHUNK; k++) jobs.push({ ci: i, cfg: c.cfg, seed: explore.seed + i * 1000 + k, n: CHUNK }); });
  const res = await runAll(jobs, threads);
  const rows = configs.map(() => []);
  jobs.forEach((j, k) => rows[j.ci].push(...res[k]));
  const sums = configs.map((c, i) => summarize(c.name, c.cfg, rows[i]));

  const L = [];
  L.push("# Flockstop par report (M0)");
  L.push("");
  L.push("Generated by `tools/report.js` (" + N + " random layouts per config, seed " + explore.seed + ", " + ((Date.now() - t0) / 1000).toFixed(0) + " s on " + threads + " threads). Accept criteria and bands come from `tools/bake-config.json`; exploration variants from `tools/report-config.json`.");
  L.push("");
  L.push("## Proposal (PENDING Peter)");
  L.push("");
  L.push("| Day | Size | Sheep | Elements | Par band | Accept thresholds | Accept rate | Accepted: median par / dead-end branches / states | Why |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  const fmt = (v) => (Array.isArray(v) ? v[0] + "-" + v[1] : String(v || 0));
  DAYS.forEach((d, i) => {
    const c = bake.days[d], s = sums[i], med = (f) => q(s.accepted.map(f).sort((a, b) => a - b), 0.5);
    const els = ["rocks " + fmt(c.rocks)]; if (c.mud) els.push("mud " + fmt(c.mud)); if (c.pond) els.push("pond " + fmt(c.pond));
    const sheep = fmt(c.white) + " white" + (c.black ? " + " + fmt(c.black) + " black" : "");
    const th = ["dead-end branches ≥ " + (c.minDeadEdges || 0)]; if (c.needStopper) th.push("stopper needed"); if (c.noPenFirst) th.push("no pen on swipe 1");
    L.push("| " + DAY_NAMES[d] + " | " + c.size + "×" + c.size + " | " + sheep + " | " + els.join(", ") + " | " + c.par[0] + "-" + c.par[1] + " | " + th.join("; ") + " | " + pct(s.accepted.length, s.n) + " | " + med((r) => r.par) + " / " + med((r) => r.deadEdges) + " / " + med((r) => r.states) + " | " + (c.why || "") + " |");
  });
  L.push("");
  for (const line of explore.notes || []) L.push(line); // hand-written findings, kept in report-config.json
  L.push("");
  L.push("## Sample boards (one accepted board per weekday)");
  L.push("");
  L.push("Legend: `.` grass, `R` rock, `M` mud, `~` pond, `w`/`b` sheep (`W`/`B` on mud), pens drawn as their opening: white `^ > v <`, black `⇑ ⇒ ⇓ ⇐` (a `^` pen opens north, so a sheep enters it moving south).");
  L.push("");
  DAYS.forEach((d, i) => {
    const acc = sums[i].accepted; if (!acc.length) { L.push("**" + DAY_NAMES[d] + "**: no accepted board in this run."); L.push(""); return; }
    const pick = acc[Math.floor(acc.length / 2)];
    L.push("**" + DAY_NAMES[d] + "**: par " + pick.par + ", solution `" + pick.solution + "`, dead-end branches " + pick.deadEdges + ", reachable states " + pick.states + (pick.needsStopper ? ", needs a stopper" : ""));
    L.push("");
    L.push("```");
    L.push(ascii(pick.board));
    L.push("```");
    L.push("");
  });
  L.push("## Measurements per config");
  L.push("");
  L.push("Dead-end branch = a move from a still-solvable state into a state from which no win is reachable. Start traps = such moves available on swipe 1. Forced steps = share of solution steps where only one direction keeps par. `<` marks the band in each histogram. Accept rate is over all random layouts, unsolvable ones included.");
  L.push("");
  for (const s of sums) L.push(section(s));
  fs.writeFileSync(path.join(__dirname, "par-report.md"), L.join("\n"));
  console.log("wrote tools/par-report.md in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
  sums.forEach((s) => console.log(s.name.padEnd(26), "solv", pct(s.solved, s.n).padStart(4), "cap", pct(s.capped, s.n).padStart(4), "par p10/50/90", q(s.pars, 0.1), q(s.pars, 0.5), q(s.pars, 0.9), " acc", pct(s.accepted.length, s.n), " ms/acc", s.msPerAccept.toFixed(0), JSON.stringify(s.why)));
})();
