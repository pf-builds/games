// Sapper's Path re-grade check (v3.1): grade every baked level again with the current engine, with the bake's own seeds
// and playout counts (tools/bake-config.json grade), and diff against the grades stored in levels/levels.json. Nothing is
// written. Per level and difficulty: the patient random-tap win rate, and the stored winning order replayed patiently
// (won, peak spaces, taps, engine ms); on Normal also the one-move-lookahead player's rate. v4 M3: the Normal line's
// longest single tap (maxWait) and, from bake-config fast.from, the fast tapper's rate, when the file stores them. v4.2:
// the real pace (grade.pace: the stored Normal order replayed tapping the moment a space is free, times duration.pace's
// factor), when the file stores it. v4.3: every level is graded on its own tag only (L.tag; grade[tag], win[tag]); the
// lookahead, dead time, real pace, fast tapper and the thinking replays (duration.pace.thinks) on it. Land 1 fix: the
// careful player (grade.careful, bake-config grade.careful's games and depth; grade.obvious, grade.obvious's) and the steady replay (grade.steady, its
// longest wait between taps and to the end at duration.pace.steady), when the file stores them (land levels).
//   ~/.local/opt/node/bin/node tools/regrade.js [--quick] [--levels FILE]   (--quick: rates only, no lookahead player;
//   --levels: another levels file, e.g. a trial bake's)
//   ~/.local/opt/node/bin/node tools/regrade.js --gallery [--levels FILE]   v4 M4: levels/gallery.json (or FILE) with the
//   Gallery bake's own counts (tools/gallery-config.json bake: grade, fast; every level has a fast-tapper grade)
//   ~/.local/opt/node/bin/node tools/regrade.js --zen     v6 lane B: levels/zen.json (Zen World 1, made by tools/zen-world.js)
// Exit 1 when anything differs. v5 R1: require("./regrade.js").regrade(LV, C, V3, quick) is the same run as a function
// (tools/freeze.js uses it).
"use strict";
const E = require("../src/engine.js");
const R = require("./grade.js");
const fs = require("fs"), path = require("path");
// v5 R1: the re-grade as a function (tools/freeze.js runs it over a frozen snapshot). LV: the levels; C: the bake's
// config (bake-config.json, or gallery-config.json's bake); V3: config.json's v3 (the engine's rules); quick: rates only.
// Returns {checks, diffs, lines} (lines: one per difference).
function regrade(LV, C, V3, quick) {
  const rules = { easy: E.rulesOf(V3, "easy"), normal: E.rulesOf(V3, "normal"), hard: E.rulesOf(V3, "hard"), extreme: E.rulesOf(V3, "extreme") }; // v5 R1: extreme
  // The bake's seeds: a generated level carries its candidate seed; a teaching level is graded with seedOf(C, n, 0).
  const seedOf = (n, k) => (C.seed ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(k + 7, 0x85EBCA77)) | 0;
  let diffs = 0, checks = 0; const lines = [];
  const say = (L, d, what, was, now) => { diffs++; lines.push("DIFF level " + (L.n != null ? L.n : L.id) + " " + d + " " + what + ": stored " + JSON.stringify(was) + ", now " + JSON.stringify(now)); };
  for (const L of LV) {
    const B = E.compile(L), seed = L.source === "teaching" ? seedOf(L.n, 0) : L.seed, d = L.tag, g = L.grade && L.grade[d], rt = rules[d];
    if (!rules[d] || !g || !L.win || !L.win[d]) { say(L, d, "tag", "a tag with its grade and order", { tag: d, grade: !!g, win: !!(L.win && L.win[d]) }); continue; }
    const rate = +R.rate(B, rt, C.grade.playouts, seed).toFixed(4); checks++;
    if (rate !== g.rate) say(L, d, "rate", g.rate, rate);
    const ln = R.line(B, rt, L.win[d]), now = { won: ln.won, peak: ln.peak, len: ln.len, ms: ln.ms }, was = { won: true, peak: g.peak, len: g.len, ms: g.ms }; checks++;
    if (g.maxWait != null) { now.maxWait = ln.maxWait; was.maxWait = g.maxWait; }
    if (JSON.stringify(now) !== JSON.stringify(was)) say(L, d, "winning line", was, now);
    if (!quick && g.greedy != null) { const gr = +R.greedy(B, rt, C.grade.greedyPlayouts, seed ^ 0x2545f491).toFixed(3); checks++; if (gr !== g.greedy) say(L, d, "lookahead", g.greedy, gr); }
    if (g.pace) { const pc = R.pace(B, rt, L.win[d], 0), now = pc.won ? { raw: pc.ms, ms: Math.round(pc.ms * C.duration.pace.factor) } : { raw: null, ms: g.ms, fell: true }; checks++; if (JSON.stringify(now) !== JSON.stringify(g.pace)) say(L, d, "real pace", g.pace, now); }
    if (g.thinks) { const th = C.duration.pace.thinks.map((x) => (R.pace(B, rt, L.win[d], x).won ? 1 : 0)); checks++; if (JSON.stringify(th) !== JSON.stringify(g.thinks)) say(L, d, "thinking replays", g.thinks, th); }
    if (g.steady) { const st = R.pace(B, rt, L.win[d], C.duration.pace.steady), now = st.won ? { gap: st.gap, end: st.end } : { lost: 1 }; checks++; if (JSON.stringify(now) !== JSON.stringify(g.steady)) say(L, d, "steady replay", g.steady, now); } // Land 1 fix
    if (!quick && g.obvious != null && C.grade.obvious) { const ov = +R.careful(B, rt, C.grade.obvious.games, seed ^ 0x1b873593, C.grade.obvious.depth).toFixed(3); checks++; if (ov !== g.obvious) say(L, d, "obvious player", g.obvious, ov); } // Land 1 fix
    if (!quick && g.careful != null && C.grade.careful) { const cr = +R.careful(B, rt, C.grade.careful.games, seed ^ 0x6c8e9cf5, C.grade.careful.depth).toFixed(3); checks++; if (cr !== g.careful) say(L, d, "careful player", g.careful, cr); } // Land 1 fix
    if (!quick && g.fast != null) { const fr = +R.fast(B, rt, C.fast.games, seed ^ 0x1f123bb5, C.fast.gapMs).toFixed(4); checks++; if (fr !== g.fast) say(L, d, "fast tapper", g.fast, fr); }
  }
  return { checks, diffs, lines };
}
module.exports = { regrade };

if (require.main === module) {
  const GAL = process.argv.includes("--gallery");
  const C = GAL ? require("./gallery-config.json").bake : require("./bake-config.json");
  const V3 = require("../config.json").v3;
  const ZEN = process.argv.includes("--zen"); // v6 lane B: levels/zen.json's own records (Zen World 1), with the main levels' counts
  const LV = JSON.parse(fs.readFileSync(process.argv.indexOf("--levels") > 0 ? path.resolve(process.argv[process.argv.indexOf("--levels") + 1]) : path.join(__dirname, ZEN ? "../levels/zen.json" : GAL ? "../levels/gallery.json" : "../levels/levels.json"), "utf8")).levels;
  const t0 = Date.now(), r = regrade(LV, C, V3, process.argv.includes("--quick"));
  for (const l of r.lines) console.log(l);
  console.log(LV.length + " levels, " + r.checks + " checks, " + r.diffs + " differences (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
  process.exitCode = r.diffs ? 1 : 0;
}
