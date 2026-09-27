// Flockstop bake: tools/bake-config.json → levels/daily.json (7 weekday pools) + levels/practice.json.
// Deterministic: every pool is filled from fixed-seed chunks consumed in chunk order, so thread timing never
// changes the output. Boards are deduped up to symmetry across the whole bake (dailies first, then practice).
// If a pool can't fill inside maxChunks, the closest near-band boards fill the gap and the log says so (never throws).
// Every baked board is re-parsed and its solution replayed through rules.play before it is written.
// Run: ~/.local/opt/node/bin/node tools/bake.js
"use strict";
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Worker: one chunk = n layouts from one seed. Returns accepted boards in roll order + a few near misses.
if (!isMainThread) {
  const Gen = require("./gen.js"), Solver = require("../src/solver.js");
  const { cfg, seed, n } = workerData, rng = Gen.mulberry32(seed), ok = [], near = [];
  for (let made = 0, tries = 0; made < n && tries < n * 20; tries++) {
    const b = Gen.generate(cfg, rng);
    if (!b) continue;
    made++;
    const r = Solver.solve(b, { cap: cfg.cap }), why = Gen.rejectReason(r, cfg);
    const item = { board: b, par: r.par, sol: r.solution, deadEdges: r.deadEdges, states: r.states, why };
    if (!why) ok.push(item);
    else if ((why === "par-low" || why === "few-dead-ends") && near.length < 8) near.push(item);
  }
  parentPort.postMessage({ ok, near });
  return;
}

const R = require("../src/rules.js");
const Sym = require("../src/sym.js");
const ROOT = path.join(__dirname, "..");
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SPARE = 3; // extra boards per pool, so a cross-pool duplicate never leaves a hole

(async () => {
  const t0 = Date.now(), C = JSON.parse(fs.readFileSync(path.join(__dirname, "bake-config.json"), "utf8"));
  const threads = Math.max(2, os.cpus().length - 2);
  const practicePer = Math.ceil(C.practiceCount / C.practice.mix.length);
  // One pool per weekday daily + one per weekday practice slice; each has its own seed stream.
  const pools = [];
  DAYS.forEach((d, i) => pools.push({ name: d, cfg: Object.assign({ cap: C.cap }, C.days[d]), seed: C.seed + i * 100000, want: C.perDay + SPARE }));
  C.practice.mix.forEach((d, i) => pools.push({ name: "practice-" + d, cfg: Object.assign({ cap: C.cap }, C.days[d]), seed: C.practiceSeed + i * 100000, want: practicePer + SPARE }));
  for (const p of pools) { p.next = 0; p.inflight = 0; p.results = []; p.taken = []; p.seen = new Set(); p.near = []; p.consumed = 0; p.done = false; }

  // Consume finished chunks strictly in chunk order; a pool is done once it holds `want` distinct boards.
  function consume(p) {
    while (!p.done && p.results[p.consumed]) {
      const r = p.results[p.consumed++];
      for (const it of r.ok) { const k = Sym.canonicalKey(it.board); if (p.taken.length < p.want && !p.seen.has(k)) { p.seen.add(k); p.taken.push(it); } }
      p.near.push(...r.near);
      if (p.taken.length >= p.want || p.consumed >= C.maxChunks) p.done = true;
    }
  }

  await new Promise((resolve, reject) => {
    let running = 0;
    const pump = () => {
      if (pools.every((p) => p.done)) { if (!running) resolve(); return; }
      while (running < threads) {
        // Feed the neediest pool: fewest boards per chunk launched, so slow pools get more threads.
        const open = pools.filter((p) => !p.done && p.next < C.maxChunks && p.next - p.consumed < threads);
        if (!open.length) break;
        open.sort((a, b) => a.taken.length / a.want - b.taken.length / b.want || a.inflight - b.inflight);
        const p = open[0], k = p.next++;
        running++; p.inflight++;
        const w = new Worker(__filename, { workerData: { cfg: p.cfg, seed: p.seed + k, n: C.chunkLayouts } });
        w.once("message", (m) => {
          running--; p.inflight--; p.results[k] = m; consume(p);
          if (p.done && !p._logged) { p._logged = true; console.log(p.name.padEnd(14), p.taken.length + "/" + p.want, "after", p.consumed, "chunks", ((Date.now() - t0) / 1000).toFixed(1) + "s"); }
          pump();
        });
        w.once("error", reject);
      }
      if (!running && pools.every((p) => p.done || p.next >= C.maxChunks)) { pools.forEach((p) => (p.done = true)); resolve(); }
    };
    pump();
  });

  // Cross-pool dedup in a fixed order, then below-band fallback for any pool still short.
  const global = new Set(), fallbacks = [];
  function finalize(p, count) {
    const out = [];
    for (const it of p.taken) { const k = Sym.canonicalKey(it.board); if (out.length < count && !global.has(k)) { global.add(k); out.push(it); } }
    if (out.length < count) {
      const near = p.near.slice().sort((a, b) => b.par - a.par || b.deadEdges - a.deadEdges);
      for (const it of near) { const k = Sym.canonicalKey(it.board); if (out.length < count && !global.has(k)) { global.add(k); out.push(Object.assign({}, it, { fallback: true })); } }
      fallbacks.push(p.name + ": " + out.filter((x) => x.fallback).length + " below-band fallback(s), " + (count - out.length) + " still missing");
    }
    return out;
  }
  const entry = (it, id) => ({ id, w: it.board.w, h: it.board.h, rows: it.board.rows, pens: it.board.pens, par: it.par, sol: it.sol });
  const daily = { version: C.version + "-" + C.seed + "-" + C.perDay, seed: C.seed, pools: {} };
  DAYS.forEach((d, i) => { daily.pools[d] = finalize(pools[i], C.perDay).map((it, j) => entry(it, d + "-" + String(j).padStart(3, "0"))); });
  const slices = C.practice.mix.map((d, i) => finalize(pools[DAYS.length + i], practicePer));
  const boards = [];
  for (let j = 0; boards.length < C.practiceCount && j < practicePer; j++) for (const s of slices) if (s[j] && boards.length < C.practiceCount) boards.push(entry(s[j], "p-" + String(boards.length).padStart(3, "0")));
  const practice = { version: C.version + "-" + C.practiceSeed + "-" + boards.length, seed: C.practiceSeed, boards };

  // Verify every board through the public rules API before writing.
  let bad = 0;
  const all = [].concat(...DAYS.map((d) => daily.pools[d]), boards);
  for (const b of all) { const res = R.play(R.parseBoard(b), b.sol); if (!res.win || res.swipes !== b.par) { bad++; console.log("VERIFY FAIL", b.id); } }
  if (bad) { console.log("BAKE FAILED: " + bad + " boards did not replay to a win at par; nothing written"); process.exit(1); }

  fs.writeFileSync(path.join(ROOT, "levels/daily.json"), JSON.stringify(daily));
  fs.writeFileSync(path.join(ROOT, "levels/practice.json"), JSON.stringify(practice));
  const bytes = (f) => fs.statSync(path.join(ROOT, f)).size;
  for (const d of DAYS) {
    const ps = daily.pools[d].map((b) => b.par), h = {};
    for (const v of ps) h[v] = (h[v] || 0) + 1;
    console.log(d, daily.pools[d].length, "boards, par", JSON.stringify(h));
  }
  console.log("practice", boards.length, "boards");
  for (const f of fallbacks) console.log("FALLBACK " + f);
  console.log("verified " + all.length + " boards; daily.json " + bytes("levels/daily.json") + " B, practice.json " + bytes("levels/practice.json") + " B; wall " + ((Date.now() - t0) / 1000).toFixed(1) + " s on " + threads + " threads");
})();
