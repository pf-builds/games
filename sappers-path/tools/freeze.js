// Sapper's Path freeze test (v5 R1; the rules review's freeze rule: once a level ships it never changes, so after any
// engine change a re-grade of every shipped level must show 0 differences, or the change doesn't ship). A frozen
// snapshot is a folder holding frozen.json ({files: [{file, kind: "siege" | "gallery"}]}) and copies of the shipped
// level files, grades and stored orders included. Every level of every file is graded again with the current engine
// and the bake's own seeds and counts (tools/regrade.js regrade(): rate, the stored winning line, lookahead, real pace,
// thinking replays, fast tapper, whichever the file stores) and compared field for field. Exit 1 on any difference.
//   ~/.local/opt/node/bin/node tools/freeze.js                 the snapshot named by config.json v5.freeze.dir
//   ~/.local/opt/node/bin/node tools/freeze.js --dir DIR        another snapshot (the test runs tools/freeze-fixture)
//   ~/.local/opt/node/bin/node tools/freeze.js --require        a missing snapshot is a failure (from R2 on)
//   ~/.local/opt/node/bin/node tools/freeze.js --snapshot       copy levels/levels.json and levels/gallery.json into the
//                                                               configured folder (R2 baselines with this, once)
//   ~/.local/opt/node/bin/node tools/freeze.js --make-fixture   rebuild tools/freeze-fixture from its source.json (three
//                                                               small hand boards graded with this engine)
// R1 has no baseline yet: the shipped levels were dealt under v4.3's rules and are re-laid in R2, which snapshots them.
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../src/engine.js"), R = require("./grade.js"), { regrade } = require("./regrade.js");
const CFG = require("../config.json"), BC = require("./bake-config.json"), GC = require("./gallery-config.json").bake;
const ROOT = path.join(__dirname, "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

// Re-grade every file of the snapshot in dir. Returns {ok, missing, files: [{file, levels, checks, diffs, lines}]}.
// v3 (optional): the engine rules to grade with (default config.json's; the test passes a changed one).
function check(dir, v3) {
  const man = path.join(dir, "frozen.json");
  if (!fs.existsSync(man)) return { ok: false, missing: true, files: [] };
  const M = JSON.parse(fs.readFileSync(man, "utf8")), files = [];
  for (const f of M.files || []) {
    const LV = JSON.parse(fs.readFileSync(path.join(dir, f.file), "utf8")).levels, r = regrade(LV, f.kind === "gallery" ? GC : BC, v3 || CFG.v3, false);
    files.push({ file: f.file, levels: LV.length, checks: r.checks, diffs: r.diffs, lines: r.lines });
  }
  return { ok: files.every((f) => !f.diffs) && files.length > 0, missing: false, files };
}
module.exports = { check };

// The fixture: grade each hand board of source.json as the bake stores grades (on its tag; seed from the file).
function makeFixture(dir) {
  const src = JSON.parse(fs.readFileSync(path.join(dir, "source.json"), "utf8")), out = [];
  for (const L of src.levels) {
    const B = E.compile(L), rt = E.rulesOf(CFG.v3, L.tag), d = L.tag, order = R.solve(B, rt, 200000);
    if (!order) throw new Error("fixture " + L.id + ": no winning order");
    const ln = R.line(B, rt, order), pc = R.pace(B, rt, order, 0);
    const g = { rate: +R.rate(B, rt, BC.grade.playouts, L.seed).toFixed(4), peak: ln.peak, len: ln.len, ms: ln.ms, maxWait: ln.maxWait, greedy: +R.greedy(B, rt, BC.grade.greedyPlayouts, L.seed ^ 0x2545f491).toFixed(3),
      pace: pc.won ? { raw: pc.ms, ms: Math.round(pc.ms * BC.duration.pace.factor) } : { raw: null, ms: ln.ms, fell: true } };
    out.push(Object.assign({}, L, { win: { [d]: order }, grade: { [d]: g } }));
  }
  fs.writeFileSync(path.join(dir, "levels.json"), JSON.stringify({ note: "Built by tools/freeze.js --make-fixture from source.json; graded with the v5 R1 engine.", levels: out }, null, 1) + "\n");
  fs.writeFileSync(path.join(dir, "frozen.json"), JSON.stringify({ note: "The freeze test's fixture snapshot (tools/freeze.js).", files: [{ file: "levels.json", kind: "siege" }] }, null, 1) + "\n");
  return out.length;
}

if (require.main === module) {
  const V5 = CFG.v5.freeze, dir = path.resolve(ROOT, arg("--dir") || V5.dir);
  if (process.argv.includes("--make-fixture")) { const fx = path.join(__dirname, "freeze-fixture"); console.log("fixture: " + makeFixture(fx) + " levels graded into " + path.relative(ROOT, fx)); process.exit(0); }
  if (process.argv.includes("--snapshot")) {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["levels.json", "gallery.json"]) fs.copyFileSync(path.join(ROOT, "levels", f), path.join(dir, f));
    fs.writeFileSync(path.join(dir, "frozen.json"), JSON.stringify({ note: "Shipped levels frozen by tools/freeze.js --snapshot; never edit by hand.", made: new Date().toISOString().slice(0, 10), files: [{ file: "levels.json", kind: "siege" }, { file: "gallery.json", kind: "gallery" }] }, null, 1) + "\n");
    console.log("snapshot written to " + path.relative(ROOT, dir)); process.exit(0);
  }
  const t0 = Date.now(), r = check(dir);
  if (r.missing) { console.log("freeze: no snapshot at " + path.relative(ROOT, dir) + " (not baselined yet: R2 runs --snapshot once it ships the re-laid levels)"); process.exitCode = process.argv.includes("--require") ? 1 : 0; }
  else {
    for (const f of r.files) { for (const l of f.lines) console.log(f.file + ": " + l); console.log("freeze: " + f.file + " " + f.levels + " levels, " + f.checks + " checks, " + f.diffs + " differences"); }
    console.log("freeze: " + (r.ok ? "PASS" : "FAIL") + " (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)"); process.exitCode = r.ok ? 0 : 1;
  }
}
