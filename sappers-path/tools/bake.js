// Sapper's Path bake: tools/bake-config.json → levels/levels.json (DRAFT, versioned) + levels/pool-w{1..4}.json.
// Deterministic: bake.chunksMax fixed-seed chunks per world, consumed in chunk order, so thread timing never changes
// the output. Accepts under proposedBands, dedupes by grid, keeps up to bake.poolMax per world, then picks
// bake.levels[w] evenly across the pool's difficulty order (easiest first). World 1 opens with the 3 teaching boards.
// Never throws: a short pool is filled from near misses (random-win or min band only), and every fallback is logged
// and written into the bake block of tools/m0-report.md.
// Run: ~/.local/opt/node/bin/node tools/bake.js
"use strict";
const fs = require("fs");
const path = require("path");
const Par = require("./par.js");
const Gen = require("./gen.js");
const E = require("../src/engine.js");
const S = require("../src/solver.js");

const ROOT = path.join(__dirname, "..");
const log = [];
const say = (s) => { log.push(s); console.log(s); };
const pick = (r, spare) => (spare ? r.s1 : r.s0);

// Difficulty order: random win rate high → low, then min crews, then sections. Easy first.
function harder(a, b, spare) { const A = pick(a, spare), B = pick(b, spare); return B.randWin - A.randWin || A.min - B.min || A.sections - B.sections; }

// First tile of each section on the line: the page's selfTest taps these through tapCell.
function lineCells(B, line) { return line.map((s) => { const c = B.secCells[B.secStart[s]]; return [c % B.w, (c / B.w) | 0]; }); }

function levelOut(L, m, id, name, world, source, extra) {
  const B = E.parse(L);
  return Object.assign({
    id, name, world, source, w: L.w, h: L.h, grid: L.grid, muster: L.muster, chests: L.chests || [], min: m.min,
    line: lineCells(B, m.line),
    metrics: { sections: m.sections, randWin: +m.randWin.toFixed(3), greedyWin: m.greedyWin, greedyUsed: m.greedyUsed, states: m.states,
      deadRatio: +m.deadRatio.toFixed(3), lostRatio: +m.lostRatio.toFixed(3), chestRequired: m.chestRequired, leversMatter: m.leversMatter },
  }, extra || {});
}

(async () => {
  const t0 = Date.now();
  let C;
  try { C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8")); }
  catch (e) { console.log("bake: cannot read bake-config.json: " + e.message); return; }
  const tasks = [];
  for (const wk of Object.keys(C.worlds)) for (let i = 0; i < C.bake.chunksMax; i++) tasks.push({ wk, seed: C.seed + (+wk) * 100000 + i, n: C.chunk });
  const res = await Par.run(C, tasks);

  const worlds = [], pools = {};
  for (const wk of Object.keys(C.worlds)) {
    const W = C.worlds[wk], band = C.proposedBands[wk], spare = band.spare, seen = new Set(), pool = [], near = [];
    let made = 0;
    tasks.forEach((t, i) => {
      if (t.wk !== wk) return;
      for (const r of res[i].recs) {
        made++;
        const L = spare ? Gen.withSpare(r.level, r.info.spareCrew, 1) : r.level, key = L.grid.join("/");
        if (seen.has(key)) continue;
        const why = Gen.accept(r, band);
        if (!why && pool.length < C.bake.poolMax) { seen.add(key); pool.push({ r, L }); }
        else if ((why === "random-win-band" || why === "min-band") && near.length < 50) near.push({ r, L, why });
      }
    });
    pool.sort((a, b) => harder(a.r, b.r, spare));
    const want = C.bake.levels[wk] - (wk === "1" ? 3 : 0), chosen = [];
    for (let k = 0; k < want && pool.length; k++) {
      const idx = want === 1 ? 0 : Math.round((k * (pool.length - 1)) / (want - 1));
      if (!chosen.includes(pool[idx])) chosen.push(pool[idx]);
    }
    if (chosen.length < want) {
      say("W" + wk + ": FALLBACK only " + chosen.length + "/" + want + " accepted boards; filling from " + near.length + " near misses");
      for (const nm of near) { if (chosen.length >= want) break; chosen.push(Object.assign(nm, { fallback: nm.why })); }
      chosen.sort((a, b) => harder(a.r, b.r, spare));
    }
    say("W" + wk + ": " + made + " boards, " + pool.length + " accepted into the pool (cap " + C.bake.poolMax + "), " + chosen.length + " picked");

    const levels = [];
    if (wk === "1") {
      let teach = [];
      try { teach = JSON.parse(fs.readFileSync(path.join(ROOT, "levels", "teaching.json"), "utf8")).levels; }
      catch (e) { say("W1: FALLBACK teaching.json unreadable (" + e.message + "); world 1 has no teaching boards"); }
      for (const t of teach) {
        try {
          const B = E.parse(t), r = S.solve(B, { cap: C.cap }), used = Object.values(t.muster).reduce((a, b) => a + (b | 0), 0);
          if (!r.win) { say("W1: FALLBACK teaching board " + t.id + " has no win; skipped"); continue; }
          if (r.min !== used) say("W1: note " + t.id + " min " + r.min + " vs muster " + used);
          const m = Gen.measure(t, C);
          levels.push(levelOut(t, m, t.id, t.name, 1, "teaching", { teaches: t.teaches }));
        } catch (e) { say("W1: FALLBACK teaching board " + (t && t.id) + " failed to parse (" + e.message + "); skipped"); }
      }
    }
    chosen.forEach((c, i) => {
      const n = levels.length + 1, id = "w" + wk + "-" + String(n).padStart(2, "0");
      levels.push(levelOut(c.L, pick(c.r, spare), id, W.name + " " + n, +wk, c.fallback ? "near-miss:" + c.fallback : "baked", { seed: c.r.seed, idx: c.r.idx }));
    });
    worlds.push({ world: +wk, name: W.name, band, levels });
    pools[wk] = pool.map((p, i) => levelOut(p.L, pick(p.r, spare), "p" + wk + "-" + String(i + 1).padStart(3, "0"), W.name + " pool " + (i + 1), +wk, "pool", { seed: p.r.seed, idx: p.r.idx }));
  }

  // Replay every shipped line through the engine before writing (a bad line is logged, never written silently).
  for (const w of worlds) for (const L of w.levels) {
    const B = E.parse(L); let s = E.start(B);
    for (const [x, y] of L.line) { const n = E.apply(B, s, E.sectionAt(B, x, y)); if (n) s = n; }
    if (!s.won || s.used !== L.min) say("REPLAY FAIL " + L.id + ": won " + s.won + " used " + s.used + " min " + L.min);
  }

  const out = { version: C.version, draft: true, note: "DRAFT bake under proposedBands; Peter approves bands before M1 locks levels.", seed: C.seed, worlds };
  fs.writeFileSync(path.join(ROOT, "levels", "levels.json"), JSON.stringify(out, null, 0).replace(/\{"id"/g, "\n{\"id\"") + "\n");
  for (const [wk, p] of Object.entries(pools)) fs.writeFileSync(path.join(ROOT, "levels", "pool-w" + wk + ".json"), JSON.stringify({ version: C.version, world: +wk, count: p.length, levels: p }).replace(/\{"id"/g, "\n{\"id\"") + "\n");
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  say("bake: " + worlds.reduce((a, w) => a + w.levels.length, 0) + " levels, pools " + Object.values(pools).map((p) => p.length).join("/") + ", " + secs + " s");

  // Bake block in the report.
  const rp = path.join(__dirname, "m0-report.md");
  try {
    let md = fs.existsSync(rp) ? fs.readFileSync(rp, "utf8") : "";
    const rows = worlds.map((w) => "| " + w.world + " | " + w.levels.length + " | " + w.levels.map((l) => l.min).join(" ") + " | " + w.levels.map((l) => l.metrics.randWin.toFixed(2)).join(" ") + " | " + w.levels.filter((l) => l.source.startsWith("near")).length + " |");
    const block = ["<!-- bake:start -->", "## Draft bake", "", "`tools/bake.js`, seed " + C.seed + ", " + C.bake.chunksMax + " chunks × " + C.chunk + " boards per world, " + secs + " s wall clock. Levels ordered easiest first by random win rate.", "",
      "| world | levels | min crews per level | random win per level | near-miss fallbacks |", "|---|---|---|---|---|", ...rows, "", "Bake log:", "", "```", ...log, "```", "<!-- bake:end -->"].join("\n");
    md = md.includes("<!-- bake:start -->") ? md.replace(/<!-- bake:start -->[\s\S]*<!-- bake:end -->/, block) : md + "\n" + block + "\n";
    fs.writeFileSync(rp, md);
  } catch (e) { console.log("bake: could not update m0-report.md (" + e.message + ")"); }
})().catch((e) => { console.log("bake failed: " + (e && e.stack || e)); });
