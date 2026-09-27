// Sapper's Path bake: tools/bake-config.json → levels/levels.json (versioned) + levels/pool-w{1..4}.json.
// Deterministic: bake.chunks[w] fixed-seed chunks of castle() boards per world, consumed in chunk order, so thread
// timing never changes the output. Accepts under bands (gen.acceptB), dedupes by grid, keeps up to bake.poolMax per
// world, then picks bake.levels[w] minus the world's teaching boards: about bake.detourShare of them with a detour
// chest, the rest required-chest, each group spread evenly across the pool's difficulty order. Every world opens with
// its hand-authored teaching boards (levels/teaching.json); the rest run easiest first (min crews, then random win).
// Never throws: a short pool is filled from near misses (a proxy band only), and every fallback is logged and written
// into the bake block of tools/m0b-report.md.
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

// Difficulty order: min crews low → high, then random win rate high → low, then trap rate. Easy first.
function harder(a, b, spare) { const A = pick(a, spare), B = pick(b, spare); return A.min - B.min || B.randWin - A.randWin || A.trapRate - B.trapRate; }
// n picks spread evenly across a difficulty-ordered list.
function spread(list, n) { const out = []; for (let k = 0; k < n && list.length; k++) { const it = list[n === 1 ? 0 : Math.round((k * (list.length - 1)) / (n - 1))]; if (!out.includes(it)) out.push(it); } return out; }

// First tile of each section on the line: the page's selfTest taps these through tapCell.
function lineCells(B, line) { return line.map((s) => { const c = B.secCells[B.secStart[s]]; return [c % B.w, (c / B.w) | 0]; }); }

function levelOut(L, m, id, name, world, source, extra) {
  const B = E.parse(L);
  return Object.assign({
    id, name, world, source, w: L.w, h: L.h, grid: L.grid, muster: L.muster, chests: L.chests || [], min: m.min,
    line: lineCells(B, m.line),
    metrics: { sections: m.sections, randWin: +m.randWin.toFixed(3), greedyWin: m.greedyWin, greedyUsed: m.greedyUsed, states: m.states,
      deadRatio: +m.deadRatio.toFixed(3), lostRatio: +m.lostRatio.toFixed(3), chestRequired: m.chestRequired, leversMatter: m.leversMatter,
      trapRate: +m.trapRate.toFixed(3), decisions: m.decisions, walls: m.walls, singles: m.singles, chestKind: m.chestKind },
  }, extra || {});
}

(async () => {
  const t0 = Date.now();
  let C;
  try { C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8")); }
  catch (e) { console.log("bake: cannot read bake-config.json: " + e.message); return; }
  const tasks = [];
  for (const wk of Object.keys(C.worlds)) for (let i = 0; i < C.bake.chunks[wk]; i++) tasks.push({ wk, seed: C.seed + (+wk) * 100000 + i, n: C.chunk });
  const res = await Par.run(C, tasks);

  const worlds = [], pools = {};
  for (const wk of Object.keys(C.worlds)) {
    const W = C.worlds[wk], band = C.bands[wk], spare = band.spare, seen = new Set(), pool = [], near = [];
    let made = 0;
    tasks.forEach((t, i) => {
      if (t.wk !== wk) return;
      for (const r of res[i].recs) {
        made++;
        const L = spare ? Gen.withSpare(r.level, r.info.spareCrew, 1) : r.level, key = L.grid.join("/");
        if (seen.has(key)) continue;
        const why = Gen.acceptB(r, band);
        if (!why && pool.length < C.bake.poolMax) { seen.add(key); pool.push({ r, L }); }
        else if ((why === "random-win-band" || why === "trap-band") && near.length < 50) { seen.add(key); near.push({ r, L, why }); }
      }
    });
    pool.sort((a, b) => harder(a.r, b.r, spare));
    let teach = [];
    try { teach = JSON.parse(fs.readFileSync(path.join(ROOT, "levels", "teaching.json"), "utf8")).levels.filter((t) => (t.world || 1) === +wk); }
    catch (e) { say("W" + wk + ": FALLBACK teaching.json unreadable (" + e.message + "); no teaching boards"); }
    const want = Math.max(0, C.bake.levels[wk] - teach.length), kind = (p) => pick(p.r, spare).chestKind;
    const det = pool.filter((p) => kind(p) === "detour"), req = pool.filter((p) => kind(p) !== "detour");
    const nDet = W.chests ? Math.min(det.length, Math.round(want * C.bake.detourShare)) : 0;
    const chosen = spread(det, nDet).concat(spread(req, want - nDet));
    for (const p of pool) { if (chosen.length >= want) break; if (!chosen.includes(p)) chosen.push(p); }
    if (chosen.length < want) {
      say("W" + wk + ": FALLBACK only " + chosen.length + "/" + want + " accepted boards; filling from " + near.length + " near misses");
      for (const nm of near) { if (chosen.length >= want) break; chosen.push(Object.assign(nm, { fallback: nm.why })); }
    }
    chosen.sort((a, b) => harder(a.r, b.r, spare));
    say("W" + wk + ": " + made + " boards, " + pool.length + " accepted into the pool (cap " + C.bake.poolMax + ", " + det.length + " detour chests), " + chosen.length + " picked (" + chosen.filter((p) => kind(p) === "detour").length + " detour)");

    const levels = [];
    for (const t of teach) {
      try {
        const B = E.parse(t), r = S.solve(B, { cap: C.cap }), used = Object.values(t.muster).reduce((a, b) => a + (b | 0), 0);
        if (!r.win) { say("W" + wk + ": FALLBACK teaching board " + t.id + " has no win; skipped"); continue; }
        if (r.min !== used + (t.chests || []).length) say("W" + wk + ": note " + t.id + " min " + r.min + " vs muster " + used);
        const m = Gen.measure(t, C);
        levels.push(levelOut(t, m, t.id, t.name, +wk, "teaching", { teaches: t.teaches }));
      } catch (e) { say("W" + wk + ": FALLBACK teaching board " + (t && t.id) + " failed to parse (" + e.message + "); skipped"); }
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

  const out = { version: C.version, draft: false, note: "M0b bake: castle-plan boards under tools/bake-config.json bands (tools/m0-decision.md). Peter reviews at the playtest gate.", seed: C.seed, worlds };
  fs.writeFileSync(path.join(ROOT, "levels", "levels.json"), JSON.stringify(out, null, 0).replace(/\{"id"/g, "\n{\"id\"") + "\n");
  for (const [wk, p] of Object.entries(pools)) fs.writeFileSync(path.join(ROOT, "levels", "pool-w" + wk + ".json"), JSON.stringify({ version: C.version, world: +wk, count: p.length, levels: p }).replace(/\{"id"/g, "\n{\"id\"") + "\n");
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  say("bake: " + worlds.reduce((a, w) => a + w.levels.length, 0) + " levels, pools " + Object.values(pools).map((p) => p.length).join("/") + ", " + secs + " s");

  // Bake block in the report.
  const rp = path.join(__dirname, "m0b-report.md");
  try {
    let md = fs.existsSync(rp) ? fs.readFileSync(rp, "utf8") : "";
    const rows = worlds.map((w) => "| " + w.world + " | " + w.levels.length + " | " + w.levels.map((l) => l.min).join(" ") + " | " + w.levels.map((l) => l.metrics.randWin.toFixed(2)).join(" ") + " | " + w.levels.map((l) => l.metrics.trapRate.toFixed(2)).join(" ") + " | " + w.levels.map((l) => l.metrics.walls).join(" ") + " | " + w.levels.map((l) => (l.metrics.chestKind || "-")[0]).join(" ") + " | " + w.levels.filter((l) => l.source.startsWith("near")).length + " |");
    const block = ["<!-- bake:start -->", "## Bake", "", "`tools/bake.js`, seed " + C.seed + ", chunks " + JSON.stringify(C.bake.chunks) + " × " + C.chunk + " boards, " + secs + " s wall clock. Teaching boards first, then easiest first (min crews, then random win). Chest: r required, d detour, - none.", "",
      "| world | levels | min crews | random win | trap rate | wall sections | chest | near-miss fallbacks |", "|---|---|---|---|---|---|---|---|", ...rows, "", "Bake log:", "", "```", ...log, "```", "<!-- bake:end -->"].join("\n");
    md = md.includes("<!-- bake:start -->") ? md.replace(/<!-- bake:start -->[\s\S]*<!-- bake:end -->/, block) : md + "\n" + block + "\n";
    fs.writeFileSync(rp, md);
  } catch (e) { console.log("bake: could not update m0b-report.md (" + e.message + ")"); }
})().catch((e) => { console.log("bake failed: " + (e && e.stack || e)); });
