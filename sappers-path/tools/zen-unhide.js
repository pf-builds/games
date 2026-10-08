// Sapper's Path v6 lane D8: no mystery blocks in Zen (Peter, 2026-10-08: the whole picture shows from the start; in play
// the blocks read as random clouds of odd colours, and Zen is about enjoying the pictures). Takes the mystery blocks
// (hidden, hideC, hideQ, feature "hidden") off Zen levels and keeps the same board and deck: the stored order, its pace and
// its longest tap are unchanged (the engine never reads hidden; information only), and every player that reads the view
// (rate, lookahead, careful, obvious, fast tapper) is graded again on the level's own seed with the bake's counts
// (tools/land-bake.js gradeLevel), so tools/regrade.js finds 0 differences. ? cards' measure (mystery: honest and seeing)
// is taken again too. Then the level's bake targets (land-bake targetsOf: band, pace, the caps, the fast tapper, pairs, the
// careful floor, the steady replay) are read: a level that misses one is reported for a re-deal and not written.
//   ~/.local/opt/node/bin/node tools/zen-unhide.js PROFILE FILE... [--write]
// PROFILE: the land.json or world.json whose profile the levels were baked on. FILE: a bake result (scratch/bake/m-<n>.json:
// {tag, plan, seed, level, inBand, mystery}) or a levels file ({levels: [...]}, every record there with mystery blocks and
// the land or world named by --land K / --world K). Without --write nothing is written.
"use strict";
const fs = require("fs");
const path = require("path");
const E = require("../src/engine.js");
const R = require("./grade.js");
const LP = require("./land-plan.js");
const LB = require("./land-bake.js");

const argv = process.argv.slice(2), flag = (k) => argv.indexOf("--" + k) >= 0, opt = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const CFG = require("../config.json"), rules = { easy: E.rulesOf(CFG.v3, "easy"), normal: E.rulesOf(CFG.v3, "normal"), hard: E.rulesOf(CFG.v3, "hard"), extreme: E.rulesOf(CFG.v3, "extreme") };

// One level (L: w, h, grid, pal, cols, links, win, grade, hidden; tag, seed, links planned) without its mystery blocks:
// {level, inBand, mystery, why} (why: the targets it misses, "" when it meets every one).
function unhide(L, tag, seed, pairs, P, B, mys) {
  const T = Object.assign({}, L); delete T.hidden; delete T.hideC; delete T.hideQ;
  const g = LB.gradeLevel(T, rules, B, L.win[tag], seed, tag);
  if (g.win[tag] !== L.win[tag]) return { why: "the stored order changed" };
  const was = L.grade[tag], now = g.grade[tag];
  for (const k of ["peak", "len", "ms", "maxWait"]) if (was[k] !== now[k]) return { why: "the winning line changed (" + k + ")" };
  if (JSON.stringify(was.pace) !== JSON.stringify(now.pace) || JSON.stringify(was.steady) !== JSON.stringify(now.steady) || JSON.stringify(was.thinks) !== JSON.stringify(now.thinks)) return { why: "the real pace changed" };
  T.grade = g.grade; const band = P.bands[tag], miss = Math.max(0, band[0] - now.rate, now.rate - band[1]);
  const TT = LB.targetsOf(B, band, P.pace, P.lookahead[tag] != null ? P.lookahead[tag] : null, { links: pairs }, (P.careful || {})[tag] != null ? P.careful[tag] : null, (P.obvious || {})[tag] != null ? P.obvious[tag] : null, (P.carefulFloor || {})[tag] != null ? P.carefulFloor[tag] : null);
  const c = { tag, grade: g.grade, win: g.win, miss, pairs: (L.links || []).length };
  let m = mys || null; if (m) { const M = B.mystery, Bc = E.compile(T); m = Object.assign({}, m, { honest: +R.plan(Bc, rules[tag], M.games, seed ^ 0x3243f6a8, M.samples, false).toFixed(3), seeing: +R.plan(Bc, rules[tag], M.games, seed ^ 0x3243f6a8, M.samples, true).toFixed(3) }); m.gap = +(m.seeing - m.honest).toFixed(3); }
  return { level: T, inBand: !miss, mystery: m, why: TT.good(c) ? "" : TT.why(c), was, now };
}
const line = (id, r) => id + ": " + (r.why && !r.now ? r.why : "rate " + r.was.rate + " > " + r.now.rate + ", careful " + r.was.careful + " > " + r.now.careful + ", lookahead " + r.was.greedy + " > " + r.now.greedy + ", pace " + Math.round(r.now.pace.ms / 1000) + " s" + (r.why ? "; MISSES " + r.why : ""));

if (require.main === module) {
  const prof = readJ(path.resolve(argv[0])), LC = require("./land-config.json"), P = LP.profileOf(prof, LC); if (prof.pace) P.pace = Object.assign({}, P.pace, prof.pace);
  const B = LP.merge(LB.configs(false).B, P.bake || {}), files = argv.slice(1).filter((a, i, A) => !a.startsWith("--") && !(i > 0 && ["land", "world"].indexOf((A[i - 1] || "").slice(2)) >= 0));
  const land = opt("land") != null ? +opt("land") : null, world = opt("world") != null ? +opt("world") : null, out = [], bad = [];
  for (const f of files) {
    const o = readJ(f), w = (t) => { if (flag("write")) { fs.writeFileSync(f + ".tmp", t); fs.renameSync(f + ".tmp", f); } };
    if (o.levels) { // installed records (one line, as the game ships them)
      let n = 0; o.levels = o.levels.map((L) => { if (!L.hidden || (land != null ? L.land !== land : L.world !== world)) return L;
        const r = unhide(L, L.tag, L.seed, (L.links || []).length, P, B, L.mystery); out.push(line(L.id, r)); if (r.why) { bad.push(L.id); return L; } n++;
        const T = Object.assign({}, r.level, { inBand: r.inBand, feats: L.feats.filter((k) => k !== "hidden") }); if (r.mystery) T.mystery = r.mystery; return T; });
      w(JSON.stringify(o) + (fs.readFileSync(f, "utf8").endsWith("\n") ? "\n" : "")); console.log(f + ": " + n + " records");
    } else { // a bake result
      if (!o.level || !o.level.hidden) continue; const r = unhide(o.level, o.tag, o.seed, o.plan.links, P, B, o.mystery); out.push(line(f.replace(/.*scratch\//, ""), r)); if (r.why) { bad.push(f); continue; }
      const T = Object.assign({}, o, { plan: Object.assign({}, o.plan, { feats: o.plan.feats.filter((k) => k !== "hidden"), hidden: 0 }), level: r.level, inBand: r.inBand }, r.mystery ? { mystery: r.mystery } : {}); w(JSON.stringify(T) + "\n");
    }
  }
  for (const l of out) console.log("  " + l);
  console.log((flag("write") ? "written" : "dry run") + ": " + (out.length - bad.length) + " of " + out.length + " meet every target without their mystery blocks" + (bad.length ? "; RE-DEAL " + bad.join(", ") : ""));
  process.exitCode = bad.length ? 1 : 0;
}
module.exports = { unhide };
