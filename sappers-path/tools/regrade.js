// Sapper's Path re-grade check (v3.1): grade every baked level again with the current engine, with the bake's own seeds
// and playout counts (tools/bake-config.json grade), and diff against the grades stored in levels/levels.json. Nothing is
// written. Per level and difficulty: the patient random-tap win rate, and the stored winning order replayed patiently
// (won, peak spaces, taps, engine ms); on Normal also the one-move-lookahead player's rate. v4 M3: the Normal line's
// longest single tap (maxWait) and, from bake-config fast.from, the fast tapper's rate, when the file stores them.
//   ~/.local/opt/node/bin/node tools/regrade.js [--quick] [--levels FILE]   (--quick: rates only, no lookahead player;
//   --levels: another levels file, e.g. a trial bake's)
// Exit 1 when anything differs.
"use strict";
const E = require("../src/engine.js");
const R = require("./grade.js");
const C = require("./bake-config.json");
const V3 = require("../config.json").v3;
const LV = JSON.parse(require("fs").readFileSync(process.argv.indexOf("--levels") > 0 ? require("path").resolve(process.argv[process.argv.indexOf("--levels") + 1]) : require("path").join(__dirname, "../levels/levels.json"), "utf8")).levels;

const DIFFS = ["easy", "normal", "hard"], QUICK = process.argv.includes("--quick");
const rules = { easy: E.rulesOf(V3, "easy"), normal: E.rulesOf(V3, "normal"), hard: E.rulesOf(V3, "hard") };
// The bake's seeds: a generated level carries its candidate seed; a teaching level is graded with seedOf(C, n, 0).
const seedOf = (n, k) => (C.seed ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(k + 7, 0x85EBCA77)) | 0;
const t0 = Date.now();
let diffs = 0, checks = 0;
const say = (L, d, what, was, now) => { diffs++; console.log("DIFF level " + L.n + " " + d + " " + what + ": stored " + JSON.stringify(was) + ", now " + JSON.stringify(now)); };
for (const L of LV) {
  const B = E.compile(L), seed = L.source === "teaching" ? seedOf(L.n, 0) : L.seed;
  for (const d of DIFFS) {
    const g = L.grade[d], rate = +R.rate(B, rules[d], C.grade.playouts, seed).toFixed(4); checks++;
    if (rate !== g.rate) say(L, d, "rate", g.rate, rate);
    const ln = R.line(B, rules[d], L.win[d]), now = { won: ln.won, peak: ln.peak, len: ln.len, ms: ln.ms }, was = { won: true, peak: g.peak, len: g.len, ms: g.ms }; checks++;
    if (d === "normal" && g.maxWait != null) { now.maxWait = ln.maxWait; was.maxWait = g.maxWait; }
    if (JSON.stringify(now) !== JSON.stringify(was)) say(L, d, "winning line", was, now);
  }
  if (!QUICK) { const gr = +R.greedy(B, rules.normal, C.grade.greedyPlayouts, seed ^ 0x2545f491).toFixed(3); checks++; if (gr !== L.grade.normal.greedy) say(L, "normal", "lookahead", L.grade.normal.greedy, gr); }
  if (!QUICK && L.grade.normal.fast != null) { const fr = +R.fast(B, rules.normal, C.fast.games, seed ^ 0x1f123bb5, C.fast.gapMs).toFixed(4); checks++; if (fr !== L.grade.normal.fast) say(L, "normal", "fast tapper", L.grade.normal.fast, fr); }
}
console.log(LV.length + " levels, " + checks + " checks, " + diffs + " differences (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
process.exitCode = diffs ? 1 : 0;
