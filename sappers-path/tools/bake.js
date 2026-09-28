// Sapper's Path v2 bake: tools/bake-config.json → levels/levels.json (versioned) + levels/pool-w{1..4}.json.
// Rule from the command line or bake-config (C.rule, C.stacksInBake):
//   node tools/bake.js              Rule A (the recommendation)
//   node tools/bake.js --rule B     Rule B ("all reachable")
//   node tools/bake.js --stacks     Rule A + stacks (C.stacks.k columns)
// Deterministic: bake.chunks[w] fixed-seed chunks of castle() boards per world, consumed in chunk order, so thread
// timing never changes the output. Accepts under C.bands (gen.accept), dedupes by grid, keeps up to bake.poolMax per
// world, then picks bake.levels[w] minus the world's teaching boards: about bake.detourShare with a detour chest, the
// rest required, each group spread evenly across the pool's difficulty order. Every world opens with its hand-authored
// teaching boards (levels/teaching.json, solved under the baked rule); the rest run easiest first (min calls, then
// random win). Never throws: a short pool is filled from near misses (logged), and every fallback is written into the
// bake block of tools/m0c-report.md. levels.json and the pools are written atomically (temp file, then rename), because
// the page reads levels.json while tools run. Names come from levels/names.json (keyed by level id), so a rebake keeps them.
// fix-v2: every level (pools too) carries `art` (tools/artmeta.js: tower and gate rects, the keep, cosmetic decor), and
// levels run by a composite difficulty (bake.difficulty weights: min calls, decision points, trap rate, random win), each
// world's baked levels drawn from pool boards no easier than the previous world's median (bake.stepUp), boards with a
// slower win (2 stars reachable) preferred.
"use strict";
const fs = require("fs");
const path = require("path");
const Par = require("./par.js");
const Gen = require("./gen.js");
const E = require("../src/engine.js");
const S = require("../src/solver.js");
const Art = require("./artmeta.js");

const ROOT = path.join(__dirname, "..");
const log = [];
const say = (s) => { log.push(s); console.log(s); };
// Composite difficulty (bake.difficulty weights) and the order it gives: easy first, min calls then random win on ties.
let DF = { min: 1, decisions: 0.5, trap: 4, rand: 6 };
const diffOf = (m) => DF.min * m.min + DF.decisions * m.decisions + DF.trap * m.trapRate + DF.rand * (1 - m.randWin);
const harder = (A, B) => diffOf(A) - diffOf(B) || A.min - B.min || B.randWin - A.randWin;
// n picks spread evenly across a difficulty-ordered list.
function spread(list, n) { const out = []; for (let k = 0; k < n && list.length; k++) { const it = list[n === 1 ? 0 : Math.round((k * (list.length - 1)) / (n - 1))]; if (!out.includes(it)) out.push(it); } return out; }
// Near misses, least serious first (a proxy band before a depth or structure miss).
const NEAR = ["no-slow-win", "random-win-band", "trap-band", "greedy-solves", "few-decisions", "no-reshape", "chest-idle", "margin", "tie-decides", "min-band", "section-cap", "levers-idle", "one-material", "spam", "single-block"];
let ART_CAPPED = [];

function levelOut(L, m, id, name, world, source, extra, hints, C) {
  const B = E.parse(L);
  const out = {
    id, name, world, source, rule: B.rule, w: L.w, h: L.h, grid: L.grid, muster: L.muster, chests: L.chests || [], min: m.min,
    line: m.line.map((a) => (B.cols ? a : E.CREWS[a])),
    lineCells: m.lineSecs.map((ss) => { const c = B.secFirst[ss[0]]; return [c % B.w, (c / B.w) | 0]; }),
    metrics: { sections: m.sections, blocks: +m.blocks.toFixed(1), walls: m.walls, randWin: +m.randWin.toFixed(3), greedyWin: m.greedyWin, greedyUsed: m.greedyUsed,
      states: m.states, trapRate: +m.trapRate.toFixed(3), decisions: m.decisions, reshapes: m.reshapes, tieAny: m.tieAny, chestKind: m.chestKind, leversMatter: m.leversMatter, minB: m.minB,
      margin: m.margin, slowWin: m.slowWin, maxWin: m.maxWin, spam: m.spam, lineMats: m.lineMats, difficulty: +diffOf(m).toFixed(2) },
  };
  if (L.stacks) out.stacks = L.stacks;
  Object.assign(out, extra || {});
  const a = Art.artFor(Object.assign({}, L, { rule: B.rule }), hints, C);
  if (a.capped) ART_CAPPED.push(id);
  out.art = a.art;
  return out;
}

(async () => {
  const t0 = Date.now();
  let C;
  try { C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8")); }
  catch (e) { console.log("bake: cannot read bake-config.json: " + e.message); return; }
  const argv = process.argv.slice(2), ri = argv.indexOf("--rule");
  const rule = ri >= 0 && (argv[ri + 1] === "A" || argv[ri + 1] === "B") ? argv[ri + 1] : C.rule || "A";
  const stacks = rule === "A" && (argv.includes("--stacks") || (C.stacksInBake && !argv.includes("--no-stacks")));
  const vk = rule === "B" ? "B" : stacks ? "AS" : "A";
  if (C.bake.difficulty) DF = C.bake.difficulty;
  say("bake: rule " + rule + (stacks ? " + stacks (" + C.stacks.k + " columns)" : "") + ", variant " + vk);
  const tasks = [];
  for (const wk of Object.keys(C.worlds)) for (let i = 0; i < C.bake.chunks[wk]; i++) tasks.push({ wk, seed: C.seed + (+wk) * 100000 + i, n: C.chunk, variants: [vk] });
  const res = await Par.run(C, tasks);
  let NAMES = {};
  try { NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, "levels", "names.json"), "utf8")) || {}; }
  catch (e) { say("FALLBACK names.json unreadable (" + e.message + "); levels keep their default names"); }
  const nameOf = (id, dflt) => (typeof NAMES[id] === "string" && NAMES[id].trim() ? NAMES[id].trim() : dflt);
  let TEACH = [];
  try { TEACH = JSON.parse(fs.readFileSync(path.join(ROOT, "levels", "teaching.json"), "utf8")).levels; }
  catch (e) { say("FALLBACK teaching.json unreadable (" + e.message + "); no teaching boards"); }

  const worlds = [], pools = {};
  let floor = -1;   // bake.stepUp: the previous world's median difficulty
  for (const wk of Object.keys(C.worlds)) {
    const W = C.worlds[wk], band = C.bands[wk], seen = new Set(), pool = [], near = [];
    let made = 0;
    tasks.forEach((t, i) => {
      if (t.wk !== wk) return;
      for (const r of res[i].recs) {
        made++;
        const v = r.v[vk];
        if (!v || !v.m) continue;
        const key = v.level.grid.join("/");
        if (seen.has(key)) continue;
        seen.add(key);
        const why = Gen.accept(v.m, band), rec = { r, v, m: v.m };
        if (!why) { if (pool.length < C.bake.poolMax) pool.push(rec); }
        else if (v.m.win && !v.m.capped && !v.m.tieMove && NAMES && near.length < 400) near.push(Object.assign(rec, { why }));
      }
    });
    pool.sort((a, b) => harder(a.m, b.m));
    const teach = TEACH.filter((t) => (t.world || 1) === +wk);
    const want = Math.max(0, C.bake.levels[wk] - teach.length), kind = (p) => p.m.chestKind;
    // Step up: only pool boards no easier than the previous world's median (the hardest ones when too few are).
    let elig = C.bake.stepUp && floor >= 0 ? pool.filter((p) => diffOf(p.m) >= floor) : pool.slice();
    if (elig.length < want) { say("W" + wk + ": FALLBACK only " + elig.length + " pool boards at or above the step-up floor " + floor.toFixed(2) + "; taking the hardest " + want); elig = pool.slice(-Math.max(want, elig.length)); }
    // Spread across the difficulty order, then swap a pick without a slower win (2 stars reachable) for a neighbour
    // within 2 places that has one, so the curve keeps its span.
    const pickSlow = (list, k) => {
      const base = spread(list, k), out = [];
      for (const p of base) {
        let q = p;
        if (!p.m.slowWin) { const i = list.indexOf(p); for (let d = 1; d <= 2 && q === p; d++) for (const j of [i - d, i + d]) { const c = list[j]; if (c && c.m.slowWin && !base.includes(c) && !out.includes(c)) { q = c; break; } } }
        if (!out.includes(q)) out.push(q);
      }
      return out;
    };
    const det = elig.filter((p) => kind(p) === "detour"), req = elig.filter((p) => kind(p) !== "detour");
    const nDet = W.chests ? Math.min(det.length, Math.round(want * C.bake.detourShare)) : 0;
    const chosen = pickSlow(det, nDet).concat(pickSlow(req, want - nDet));
    for (const p of elig) { if (chosen.length >= want) break; if (!chosen.includes(p)) chosen.push(p); }
    if (chosen.length < want) {
      near.sort((a, b) => NEAR.indexOf(a.why) - NEAR.indexOf(b.why) || harder(a.m, b.m));
      say("W" + wk + ": FALLBACK only " + chosen.length + "/" + want + " accepted boards; filling from " + near.length + " near misses");
      for (const nm of near) { if (chosen.length >= want) break; chosen.push(Object.assign(nm, { fallback: nm.why })); }
    }
    chosen.sort((a, b) => harder(a.m, b.m));
    if (chosen.length) { const ds = chosen.map((p) => diffOf(p.m)).sort((a, b) => a - b); floor = ds[(ds.length - 1) >> 1]; }
    say("W" + wk + ": " + made + " boards, " + pool.length + " accepted into the pool (cap " + C.bake.poolMax + ", " + det.length + " detour chests), " + chosen.length + " picked (" + chosen.filter((p) => kind(p) === "detour").length + " detour)");

    const levels = [];
    for (const t of teach) {
      try {
        const L = Object.assign({}, t, { rule }), B = E.parse(L), r = S.solve(B, { cap: C.cap });
        if (!r.win) { say("W" + wk + ": FALLBACK teaching board " + t.id + " has no win under rule " + rule + "; skipped"); continue; }
        const m = Gen.measure(L, C, { ab: rule === "A" });
        const T0 = Object.assign({}, t); delete T0.art;
        levels.push(levelOut(Object.assign(T0, { rule }), m, t.id, nameOf(t.id, t.name), +wk, "teaching", { teaches: t.teaches }, t.art, C));
      } catch (e) { say("W" + wk + ": FALLBACK teaching board " + (t && t.id) + " failed (" + e.message + "); skipped"); }
    }
    chosen.forEach((c) => {
      const n = levels.length + 1, id = "w" + wk + "-" + String(n).padStart(2, "0");
      levels.push(levelOut(c.v.level, c.m, id, nameOf(id, W.name + " " + n), +wk, c.fallback ? "near-miss:" + c.fallback : "baked", { seed: c.r.seed, idx: c.r.idx }, c.r.info.art, C));
    });
    worlds.push({ world: +wk, name: W.name, band, levels });
    pools[wk] = pool.map((p, i) => levelOut(p.v.level, p.m, "p" + wk + "-" + String(i + 1).padStart(3, "0"), W.name + " pool " + (i + 1), +wk, "pool", { seed: p.r.seed, idx: p.r.idx }, p.r.info.art, C));
  }

  // Every shipped level should have a name in names.json, and every name a shipped level (logged, never fatal).
  const shipped = new Set(worlds.flatMap((w) => w.levels.map((l) => l.id)));
  for (const id of shipped) if (!(id in NAMES)) say("note: " + id + " has no name in names.json");
  for (const id of Object.keys(NAMES)) if (!shipped.has(id)) say("note: names.json names " + id + ", which is not shipped");

  // Replay every shipped line through engine.call before writing (a bad line is logged, never written silently).
  let bad = 0;
  for (const w of worlds) for (const L of w.levels) {
    const B = E.parse(L); let s = E.start(B);
    for (const a of L.line) { const n = E.call(B, s, a); if (n) s = n; }
    if (!s.won || s.calls !== L.min) { bad++; say("REPLAY FAIL " + L.id + ": won " + s.won + " calls " + s.calls + " min " + L.min); }
  }

  if (ART_CAPPED.length) say("note: no decor on " + ART_CAPPED.length + " levels (state cap " + C.decor.stateCap + "): " + ART_CAPPED.join(" "));
  const out = { version: C.version, draft: true, rule, stacks, note: "fix-v2 gen bake: castle pictures with towers, gatehouses and a 2-deep camp, art metadata on every level, closest margin, no one-card spam, difficulty step-up; rule " + rule + (stacks ? " + stacks" : "") + ". Level format: SPEC-v2 §8. Numbers: tools/fix-v2-gen-report.md and tools/m0c-report.md.", seed: C.seed, worlds };
  const atomic = (file, text) => { const tmp = file + ".tmp" + process.pid; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); };
  atomic(path.join(ROOT, "levels", "levels.json"), JSON.stringify(out, null, 0).replace(/\{"id"/g, "\n{\"id\"") + "\n");
  for (const [wk, p] of Object.entries(pools)) atomic(path.join(ROOT, "levels", "pool-w" + wk + ".json"), JSON.stringify({ version: C.version, world: +wk, rule, stacks, count: p.length, levels: p }).replace(/\{"id"/g, "\n{\"id\"") + "\n");
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  say("bake: " + worlds.reduce((a, w) => a + w.levels.length, 0) + " levels, pools " + Object.values(pools).map((p) => p.length).join("/") + ", " + bad + " replay failures, " + secs + " s");

  // Bake block in the report.
  const rp = path.join(__dirname, "m0c-report.md");
  try {
    let md = fs.existsSync(rp) ? fs.readFileSync(rp, "utf8") : "";
    const rows = worlds.map((w) => "| " + w.world + " | " + w.levels.length + " | " + w.levels.map((l) => l.min).join(" ") + " | " + w.levels.map((l) => l.metrics.decisions).join(" ") + " | " + w.levels.map((l) => l.metrics.randWin.toFixed(2)).join(" ") + " | " + w.levels.map((l) => l.metrics.trapRate.toFixed(2)).join(" ") + " | " + w.levels.map((l) => l.metrics.sections).join(" ") + " | " + w.levels.map((l) => (l.metrics.chestKind || "-")[0]).join(" ") + " | " + w.levels.filter((l) => l.source.startsWith("near")).length + " |");
    const block = ["<!-- bake:start -->", "## Draft bake", "", "`tools/bake.js`" + (rule !== "A" || stacks ? " " + argv.join(" ") : "") + ", rule " + rule + (stacks ? " + stacks" : "") + ", seed " + C.seed + ", chunks " + JSON.stringify(C.bake.chunks) + " × " + C.chunk + " boards, " + secs + " s wall clock. Teaching boards first, then easiest first (min calls, then random win). Chest: r required, d detour, - none.", "",
      "| world | levels | min calls | decision points | random win | trap rate | crew sections | chest | near-miss fallbacks |", "|---|---|---|---|---|---|---|---|---|", ...rows, "", "Bake log:", "", "```", ...log, "```", "<!-- bake:end -->"].join("\n");
    md = md.includes("<!-- bake:start -->") ? md.replace(/<!-- bake:start -->[\s\S]*<!-- bake:end -->/, block) : md + "\n" + block + "\n";
    fs.writeFileSync(rp, md);
  } catch (e) { console.log("bake: could not update m0c-report.md (" + e.message + ")"); }
})().catch((e) => { console.log("bake failed: " + (e && e.stack || e)); });
