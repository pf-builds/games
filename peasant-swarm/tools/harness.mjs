#!/usr/bin/env node
// Peasant Swarm verification harness. Headless Chromium via Playwright: PS.selfTest(), a PS.fight matrix, N scripted-player
// matches advanced with PS.step, sim cost per chunk, live rAF render timing, screenshots, and (--mobile) a real CDP touch drag.
//
//   node tools/harness.mjs --url http://127.0.0.1:8471/peasant-swarm/ --out <dir> [--mobile] [--sim 240] [--seeds 3]
//                          [--difficulty normal] [--viewport 1280x720] [--fights 20x20,25x20,30x20,40x20,60x40] [--fight-runs 5] [--render-secs 3]
//                          [--seed N] [--cap touch|desktop] [--v1-url <reference build>] [--ref-gate 1.25] [--bench-reps 3] [--ai-matches 3] [--fixtures]
// --ref-gate X: with --v1-url pointing at the previous milestone's build, gate only tick p90 at X times it (M2: 1.25 vs M1); without it the
// M1 gate holds (tick and draw p50/p90 all <= 1.1x the v1 reference).
//
// M1 additions: --seed N passes ?seed=N+run (replayable matches); --cap forces an agent cap (?cap=); selfTest runs part by part (one
// evaluate each, all under ~15 s); PS.bench("capclash") is recorded and, with --v1-url, gated at v2 <= 1.1x v1 on tick and draw script ms
// (each build benched in its own fresh page, alternating v1, v2, v1, v2 so both see the same machine within minutes); the terrain report;
// the hidden-tab proxy (PS.debugDropCaches, then visibilitychange, then every chunk and sprite opaque); per-tick no-agent-in-rock and cap
// counters read after every match; --ai-matches K all-AI PS.simMatch(240) runs at the harness cap; a restart check and an idle-player
// loss check on run 1. The scripted player routes itself (BFS on PS.terrain, harness-side only): the game's own swarms still seek directly
// until M2 brings flow fields.
//
// Exit 0: every assertion passed. Exit 1: a console error, a page error, a selfTest failure or an assertion failure. Exit 2: the harness crashed.
// Writes <out>/report.json (every number) and <out>/report.md (the short read), plus PNG screenshots.
//
// Studio lessons it keeps: (14) PS.step is the sim clock; (20) every page.evaluate stays under ~15 s wall and carries its own wall guard,
// every PS.step call is at most 30 sim-seconds; (34) the PLAY button is checked with elementFromPoint, and pressed with a real mouse or touch.
// "--seeds N" means N independent matches; without --seed each run takes a clock seed, and every run records the seed it played (PSS.seed).
//
// M2 additions: the scripted player now sets its goal with PS.aim and the game's own flow field routes it (the harness BFS only ranks
// camps by path); every run reports fights, routs, remnants formed, swarms alive at 1:00/2:00/3:00 and whether the bell rang; --fixtures
// runs PS.fixture pass64, pass128, ambush and flipflop and asserts their bars (plus the spec's 150 v 30 ambush and the no-hysteresis
// flip-flop as report-only baselines) and screenshots each fixture live; the AI matches assert every swarm leaves its home meadow within
// 40 s; mobile adds tap-to-route and hold-to-stop; run 1 asserts the visible-tab stall cap (a 2 s main-thread stall, then no frame
// advances more than 2 ticks: M1 critic MAJOR-1) and a cache rebuild with no browser event (M1 critic MAJOR-2).
//
// M3 additions (fog of war): the scripted player is fog-honest: it reads PS.vis only (rivals it sees, camps it knows, ground it has
// explored), never PSS.teams positions or PSS.camps. Every chunk draws a frame after each policy step and runs the leak check on it
// (PS.vis.leakCheck); each run reports first sighting, ghosts, danger cues, pings, leak totals and the AI knowledge counters. Run 1 adds the
// fog structure test (fog canvas <= 1/4 CSS, one full-screen alpha draw per frame, mask uploads <= fog.maskHz over a live window). A fog
// perf page measures fog JS per frame at 1x and at --throttle (default 4x) CPU throttle (CDP Emulation.setCPUThrottlingRate), in a live
// match and in the cap-clash bench, gated at 1.5 ms p90. A ?nofog=1 page plays start -> end -> restart. --ref-draw-gate X gates bench draw
// p90 at X times the reference; --bench-flush benches both builds with the per-frame canvas flush (see M3-build-notes.md). Console
// warnings are failures now (M2 critic BLOCKER-1), except the font host's TLS lines.
//
// M4 additions (rivals and match): six teams and the 5:00 match. --ai-matches K now plays K all-AI matches under the real rules in the live
// page (PS.debugStart({ aiPlayer: true }): team 1 as ai.proxy, rivals on Normal), stepped in 30 s chunks to the bell, and reads PS.pacing().
// --bot-matches K plays K matches of the fog-honest scripted bot on each of --bot-diffs (default easy,normal) for the win rate. The report
// carries the §9 pacing table: first sighting, first fight, fights per match, swarms alive at 1:00 / 2:00 / 3:00, bell reached, the 3:45
// leader's win share, eliminations inside the first minute, the bot's win rate; the AI think cost per tick. Targets are M8 gates: reported.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const A = parseArgs(process.argv.slice(2));
const CHUNK_SIM = 30;        // max sim-seconds per page.evaluate
const POLICY_TICK = 0.5;     // sim-seconds between scripted-player decisions
const EVAL_WALL_MS = 12000;  // in-page wall guard for one chunk (lesson 20)
const LOG_EVERY = 30;        // sim-seconds between timeline rows / render samples
const POLICY = { sight: 400, hunt: 0.7, flee: 1.4, fleeDist: 300 };
const FONT_HOST = /fonts\.(googleapis|gstatic)\.com/;

function parseArgs(argv) {
  const o = { url: "http://127.0.0.1:8471/peasant-swarm/", out: "harness-out", mobile: false, sim: 240, seeds: 3, difficulty: "normal",
    viewport: "1280x720", fights: "20x20,25x20,30x20,40x20,60x40", fightRuns: 5, fightMax: 40, renderSecs: 3, seed: null, cap: null, v1Url: null, benchReps: 3, aiMatches: 0, fixtures: false, refGate: null,
    refDrawGate: null, benchFlush: false, throttle: 4, fogPerf: true, botMatches: 0, botDiffs: "easy,normal", aiSecs: 300 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--mobile") { o.mobile = true; continue; }
    if (k === "--fixtures") { o.fixtures = true; continue; }
    if (k === "--bench-flush") { o.benchFlush = true; continue; }
    if (k === "--no-fog-perf") { o.fogPerf = false; continue; }
    const key = { "--url": "url", "--out": "out", "--sim": "sim", "--seeds": "seeds", "--difficulty": "difficulty", "--viewport": "viewport",
      "--fights": "fights", "--fight-runs": "fightRuns", "--fight-max": "fightMax", "--render-secs": "renderSecs", "--seed": "seed", "--cap": "cap",
      "--v1-url": "v1Url", "--bench-reps": "benchReps", "--ai-matches": "aiMatches", "--ref-gate": "refGate", "--ref-draw-gate": "refDrawGate", "--throttle": "throttle",
      "--bot-matches": "botMatches", "--bot-diffs": "botDiffs", "--ai-secs": "aiSecs" }[k];
    if (!key) { console.error("unknown arg " + k); process.exit(2); }
    o[key] = typeof o[key] === "number" || key === "seed" || key === "refGate" || key === "refDrawGate" ? +v : v; i++;
  }
  if (o.cap && o.cap !== "touch" && o.cap !== "desktop") { console.error("--cap must be touch or desktop"); process.exit(2); }
  return o;
}
async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try { return await import(m); } catch (e) { /* try the next location */ }
  }
  throw new Error("playwright not found: set PLAYWRIGHT_MODULE to its index.mjs");
}
const r2 = (v) => Math.round(v * 100) / 100;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

// ---------------------------------------------------------------- in-page helpers (harness-owned global, installed before the game boots)
function installHelpers() {
  window.__psh = {
    // scripted player, fog-honest (M3): it reads PS.vis only. Flee a rival it sees at > flee x our size, else hunt one it sees at < hunt x,
    // else the camp it knows nearest by path (one BFS over PS.terrain ranks them: the land is public), else ground it has not explored on
    // a ring toward the map centre. The goal goes to PS.aim, so the game's own flow field routes the swarm.
    policy(o) {
      const S = window.PSS, p = S && S.teams[1]; if (!p || p.count === 0) return "idle";
      const V = window.PS.vis, T = window.PS.terrain, W = S.cfg.world.w, H = S.cfg.world.h, cl = (v, a, b) => (v < a ? a : v > b ? b : v);
      let fl = null, fd = Infinity, hu = null, hd = Infinity;
      for (const r of V.rivals()) {
        const d = Math.hypot(r.x - p.cx, r.y - p.cy);
        if (r.count > o.flee * p.count) { if (d < fd) { fl = r; fd = d; } } else if (r.count < o.hunt * p.count && d < hd) { hu = r; hd = d; }
      }
      let gx, gy, act;
      if (fl) { const dx = p.cx - fl.x, dy = p.cy - fl.y, d = Math.hypot(dx, dy) || 1; gx = cl(p.cx + (dx / d) * o.fleeDist, 40, W - 40); gy = cl(p.cy + (dy / d) * o.fleeDist, 40, H - 40); act = "flee"; }
      else if (hu) { gx = hu.x; gy = hu.y; act = "hunt"; }
      else {
        this.bfs(p.cx, p.cy); let best = null, bd = Infinity;
        for (const c of V.camps()) { const k = T.cellOf(c.x, c.y), d = k >= 0 ? this.D[k] : -1; if (d >= 0 && d < bd) { bd = d; best = c; } }
        if (best) { gx = best.x; gy = best.y; act = "camp"; }
        else {
          act = "explore"; gx = W / 2; gy = H / 2; const a0 = Math.atan2(H / 2 - p.cy, W / 2 - p.cx);
          for (let k = 0; k < 12; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, x = p.cx + Math.cos(a) * 600, y = p.cy + Math.sin(a) * 600; if (T.walkable(x, y) && !V.explored(1, x, y)) { gx = x; gy = y; break; } }
        }
      }
      window.PS.aim(gx, gy);
      return act;
    },
    bfs(x, y) {
      const T = window.PS.terrain, m = T.map, N = m.N, NN = N * N, terr = m.terr, wk = T.walkT;
      if (!this.D || this.D.length !== NN) { this.D = new Int32Array(NN); this.Pa = new Int32Array(NN); this.Q = new Int32Array(NN); }
      const D = this.D, Pa = this.Pa, Q = this.Q; D.fill(-1);
      let s = T.cellOf(x, y); if (s < 0 || !wk(terr[s])) s = s >= 0 ? m.snap[s] : m.snap[0];
      let h = 0, t = 0; D[s] = 0; Pa[s] = -1; Q[t++] = s; this.root = s;
      while (h < t) {
        const c = Q[h++], cx = c % N, cy = (c / N) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const n = ny * N + nx; if (D[n] >= 0 || !wk(terr[n])) continue;
          if (dx && dy && (!wk(terr[cy * N + nx]) || !wk(terr[ny * N + cx]))) continue;
          D[n] = D[c] + 1; Pa[n] = c; Q[t++] = n;
        }
      }
    },
    snapshot() {
      const S = window.PSS, z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z;
      let neutrals = 0, onScreen = 0;
      for (const a of S.agents) { if (a.team === 0) neutrals++; if (Math.abs(a.x - S.cam.x) < hw && Math.abs(a.y - S.cam.y) < hh) onScreen++; }
      const counts = {}; for (const t of S.teams.slice(1)) counts[t.name] = t.count;
      return { t: Math.round(S.t * 100) / 100, mode: S.mode, result: S.result, counts, alive: S.teams.slice(1).map((t) => t.alive), neutrals, total: S.agents.length, onScreen,
        ev: S.ev ? { ...S.ev } : null, playerFights: S.stats.fights || 0, flow: window.PS.flow ? window.PS.flow.stats.rebuilds : 0 };
    },
  };
}

// one chunk: policy every POLICY_TICK, PS.step between decisions, stop at `until`, at maxSim sim-seconds, or at the wall guard
function runChunk(o) {
  const S = window.PSS, w0 = performance.now(), t0 = S.t, acts = { camp: 0, hunt: 0, flee: 0, idle: 0, explore: 0 };
  let stepMs = 0, steps = 0, peak = S.agents.length, drawn = 0;
  while (S.mode === "play" && S.t < o.until - 1e-6 && S.t - t0 < o.maxSim - 1e-6 && performance.now() - w0 < o.wallMs) {
    acts[window.__psh.policy(o.policy)]++;
    const sec = Math.max(1 / 60, Math.min(o.tick, o.until - S.t, o.maxSim - (S.t - t0)));
    const a = performance.now(); window.PS.step(sec); stepMs += performance.now() - a; steps++;
    if (S.mode === "play" && o.leak) { window.PS.vis.leakCheck(); drawn++; } // a frame drawn and leak-checked after every policy step (M3)
    if (S.agents.length > peak) peak = S.agents.length;
  }
  return { t: S.t, simSec: S.t - t0, stepMs, steps, peak, acts, drawn, mode: S.mode, wallMs: performance.now() - w0 };
}

// live rAF timing for `ms` of wall time; the scripted player keeps steering every ~0.5 s so the swarm isn't parked
function renderWindow(o) {
  return new Promise((res) => {
    const S = window.PSS, t0 = performance.now(), st0 = S.t, gaps = [], acts = { camp: 0, hunt: 0, flee: 0, idle: 0, explore: 0 }, up0 = window.PS.vis.cost();
    let last = 0, n = 0, nextPolicy = 0;
    const f = (ts) => {
      if (last) gaps.push(ts - last); last = ts; n++;
      const now = performance.now();
      if (S.mode === "play" && now >= nextPolicy) { acts[window.__psh.policy(o.policy)]++; nextPolicy = now + 500; }
      if (now - t0 < o.ms) { requestAnimationFrame(f); return; }
      gaps.sort((a, b) => a - b);
      const avg = gaps.reduce((s, g) => s + g, 0) / Math.max(1, gaps.length);
      const up1 = window.PS.vis.cost();
      res({ frames: n, wallMs: now - t0, avgMs: avg, fps: 1000 / avg, p95Ms: gaps[Math.floor(gaps.length * 0.95)] || 0, maxMs: gaps[gaps.length - 1] || 0,
        gameFps: S.fps, simAdvance: S.t - st0, visibility: document.visibilityState, acts, maskUploads: up1.uploads - up0.uploads, maskUploadRate: (up1.uploads - up0.uploads) / ((now - t0) / 1000), fogP90: up1.p90 });
    };
    requestAnimationFrame(f);
  });
}

// PS.bench("capclash") in a fresh page of its own (nothing else running in the browser): one warm-up, then `reps` timed runs
async function benchPage(browser, ctxOpts, href, reps) {
  const ctx = await browser.newContext(ctxOpts), page = await ctx.newPage(), errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e)));
  await page.goto(href); await page.waitForFunction(() => !!(window.PS && window.PS.bench && window.PSS && window.PSS.teams && window.PSS.teams.length > 1), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  if (A.benchFlush) await page.evaluate(() => { window.__benchFlush = true; }); // both builds: the per-frame canvas flush (M3 notes)
  await page.evaluate(() => window.PS.bench("capclash", { ticks: 60 }));
  const runs = []; for (let i = 0; i < reps; i++) runs.push(await page.evaluate(() => window.PS.bench("capclash")));
  await ctx.close();
  return { runs, errs };
}
const benchMed = (runs, k, q) => median(runs.map((r) => r[k][q]));

// one live match to its end (M4): PS.debugStart, then 30 sim-second chunks. aiPlayer: all six swarms AI (the pacing matches); else the
// fog-honest bot plays team 1 through runChunk (no frames drawn). Returns PS.pacing() plus the peak agent count and the win / lose result.
async function liveMatch(page, o, secs) {
  const w0 = Date.now(), st = await page.evaluate((o) => window.PS.debugStart(o), o); let peak = 0, chunks = 0;
  for (let g = 0; g < Math.ceil(secs / CHUNK_SIM) + 8; g++) {
    const c = o.aiPlayer
      ? await page.evaluate((maxSim) => { const S = window.PSS, w0 = performance.now(); let pk = 0, n = 0; while (S.mode === "play" && n < maxSim && performance.now() - w0 < 12000) { window.PS.step(1); n++; if (S.agents.length > pk) pk = S.agents.length; } return { mode: S.mode, t: S.t, peak: pk }; }, CHUNK_SIM)
      : await page.evaluate(runChunk, { until: 1e9, maxSim: CHUNK_SIM, tick: POLICY_TICK, wallMs: EVAL_WALL_MS, policy: POLICY, leak: false });
    chunks++; if (c.peak > peak) peak = c.peak; if (c.mode !== "play") break;
  }
  await page.waitForFunction(() => window.PSS.mode !== "play" || window.PSS.pendingEnd, null, { timeout: 5000 }).catch(() => {});
  const p = await page.evaluate(() => ({ ...window.PS.pacing(), cap: window.PSS.cap, won: window.PSS.result === "win", bell: window.PSS.timeLeft <= 0.001 }));
  return { ...o, ...p, slots: st.slots, peak, chunks, wallMs: Date.now() - w0 };
}
// the SPEC-v2 §9 pacing table (M4 reports it; the targets are M8 gates): one row for the all-AI matches, one per bot difficulty
function pacingTable(R) {
  const ok = (v) => v != null && v >= 0, med = (a) => { const s = a.filter(ok).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const mean = (a) => { const s = a.filter((v) => v != null); return s.length ? r2(s.reduce((x, y) => x + y, 0) / s.length) : null; }, pct = (n, d) => (d ? Math.round((100 * n) / d) : null);
  const row = (ms, label, bot) => {
    const elims = ms.flatMap((m) => m.elims), horn = ms.filter((m) => m.hornLeader);
    return { label, n: ms.length, firstSight: med(ms.map((m) => m.firstSight)), firstSightAny: med(ms.map((m) => m.firstSightAny)), firstFight: med(ms.map((m) => m.firstFight)),
      firstPlayerFight: med(ms.map((m) => m.firstPlayerFight)), fights: mean(ms.map((m) => m.fights)), playerFights: mean(ms.map((m) => m.playerFights)),
      alive60: mean(ms.map((m) => m.alive60)), alive120: mean(ms.map((m) => m.alive120)), alive180: mean(ms.map((m) => m.alive180)), hornAlive: mean(horn.map((m) => m.hornAlive)),
      bellPct: pct(ms.filter((m) => (bot ? m.bell : m.result === "bell")).length, ms.length), leaderWinsPct: pct(horn.filter((m) => m.hornLeader === m.biggest).length, horn.length), hornN: horn.length,
      elimFirstMinPct: pct(elims.filter((e) => e[0] <= 60).length, elims.length), elims: elims.length, winPct: bot ? pct(ms.filter((m) => m.won).length, ms.length) : null,
      pileOns: mean(ms.map((m) => m.pileOns)), scentPings: mean(ms.map((m) => m.scentPings)), aiMsPerTick: mean(ms.map((m) => m.aiCost.msPerTick)), aiMaxMs: ms.length ? Math.max(...ms.map((m) => m.aiCost.maxMs)) : null };
  };
  const rows = []; if (R.aiMatches.length) rows.push(row(R.aiMatches, "all-AI (Normal rivals, team 1 as proxy)", false));
  for (const d of [...new Set((R.botMatches || []).map((m) => m.difficulty))]) rows.push(row(R.botMatches.filter((m) => m.difficulty === d), "fog-honest bot, " + d, true));
  return rows;
}
async function cdpMetrics(cdp) { const m = await cdp.send("Performance.getMetrics"); return Object.fromEntries(m.metrics.map((x) => [x.name, x.value])); }

async function main() {
  const t0 = Date.now(), out = path.resolve(A.out);
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = await loadPlaywright();
  const [vw, vh] = A.viewport.split("x").map(Number);
  const tag = A.mobile ? "mobile" : "desktop";
  const ctxOpts = A.mobile
    ? { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true }
    : { viewport: { width: vw, height: vh }, deviceScaleFactor: 1, ignoreHTTPSErrors: true };
  // --ignore-certificate-errors lets the real Google Fonts load through the container's TLS proxy; font-host errors are filtered either way
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const url = new URL(A.url); url.searchParams.set("debug", "1"); if (A.cap) url.searchParams.set("cap", A.cap);
  const runUrl = (ri) => { const u = new URL(url.href); if (A.seed != null && isFinite(A.seed)) u.searchParams.set("seed", String((A.seed + ri) >>> 0)); return u.href; };
  const report = {
    meta: { url: url.href, mode: tag, viewport: ctxOpts.viewport, deviceScaleFactor: ctxOpts.deviceScaleFactor, sim: A.sim, seeds: A.seeds, difficulty: A.difficulty, seed: A.seed, cap: A.cap, v1Url: A.v1Url, refGate: A.refGate,
      chromium: browser.version(), node: process.version, startedAt: new Date().toISOString(), policy: POLICY, chunkSim: CHUNK_SIM, policyTick: POLICY_TICK,
      cpus: os.cpus().length, loadAvgStart: os.loadavg().map(r2) }, // timings are only comparable at similar load: other sessions may share this machine
    errors: { console: [], page: [], filteredFontErrors: 0, warnings: [] },
    selfTest: null, fights: [], title: null, touch: null, huddle: null, runs: [], asserts: {}, notes: [], pass: false,
    bench: null, caches: null, aiMatches: [], outcomes: [], restart: null, fixtures: null, stall: null, tap: null, hold: null,
    fogStructure: null, fogPerf: null, nofog: null,
  };
  const warnSeen = new Set();
  const shot = async (page, name) => { const f = path.join(out, `${tag}-${name}.png`); await page.screenshot({ path: f }); return path.basename(f); };

  // ------------------------------------------------ PS.bench("capclash"): v2 alone, or alternating v1, v2, v1, v2 with --v1-url (M1 gate: v2 <= 1.1x v1)
  if (A.benchReps > 0) {
    const v2 = [], v1 = [], errs = [];
    const v1href = A.v1Url ? (() => { const u = new URL(A.v1Url); u.searchParams.set("debug", "1"); return u.href; })() : null;
    for (let round = 0; round < (v1href ? 2 : 1); round++) {
      if (v1href) { const b = await benchPage(browser, ctxOpts, v1href, A.benchReps); v1.push(...b.runs); errs.push(...b.errs.map((e) => "v1: " + e)); }
      const b = await benchPage(browser, ctxOpts, url.href, A.benchReps); v2.push(...b.runs); errs.push(...b.errs.map((e) => "v2: " + e));
    }
    const sum = (runs) => runs.length ? { update: { p50: benchMed(runs, "update", "p50"), p90: benchMed(runs, "update", "p90"), p99: benchMed(runs, "update", "p99") },
      draw: { p50: benchMed(runs, "draw", "p50"), p90: benchMed(runs, "draw", "p90"), p99: benchMed(runs, "draw", "p99") }, drawImage: median(runs.map((r) => r.drawImage)),
      layers: median(runs.map((r) => r.layers)), agents: median(runs.map((r) => r.agents)), onScreen: median(runs.map((r) => r.onScreen)) } : null;
    report.bench = { v2: sum(v2), v1: sum(v1), v2runs: v2, v1runs: v1, errors: errs, ratio: null };
    if (v1.length) { const a = report.bench.v2, b = report.bench.v1; report.bench.ratio = { updateP50: r2(a.update.p50 / b.update.p50), updateP90: r2(a.update.p90 / b.update.p90), drawP50: r2(a.draw.p50 / b.draw.p50), drawP90: r2(a.draw.p90 / b.draw.p90) }; }
  }

  for (let ri = 0; ri < A.seeds; ri++) {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(installHelpers);
    const page = await ctx.newPage();
    page.on("console", (m) => {
      const where = (m.location() && m.location().url) || "";
      if (m.type() === "error") { if (FONT_HOST.test(where) || FONT_HOST.test(m.text())) report.errors.filteredFontErrors++; else report.errors.console.push({ run: ri + 1, text: m.text(), where }); }
      else if (m.type() === "warning" && !warnSeen.has(m.text())) { if (FONT_HOST.test(where) || FONT_HOST.test(m.text())) report.errors.filteredFontErrors++; else { warnSeen.add(m.text()); report.errors.warnings.push(m.text().slice(0, 300)); } }
      else if (m.type() === "log" && m.text().startsWith("[PS.selfTest]")) report.notes.push("run " + (ri + 1) + " console: " + m.text());
    });
    page.on("pageerror", (e) => report.errors.page.push({ run: ri + 1, text: String(e.message || e) }));
    const bootReady = () => !!(window.PS && window.PS.selfTest && window.PS.step && window.PSS && window.PSS.teams && window.PSS.teams.length > 1);
    const run = { index: ri + 1, timeline: [], chunks: [], render: [], screenshots: {}, policy: { camp: 0, hunt: 0, flee: 0, idle: 0, explore: 0 } };
    report.runs.push(run);

    let b0 = Date.now();
    await page.goto(runUrl(ri));
    await page.waitForFunction(bootReady, null, { timeout: 15000 });
    run.bootMs = Date.now() - b0;

    if (ri === 0) {
      // selfTest on the title screen before any match, then the fight matrix (each call is its own evaluate, well under 15 s)
      // one evaluate per part so each stays well under ~15 s of wall time (lesson 20); the merged verdict is the selfTest verdict
      const s0 = Date.now(), st = { pass: true, fails: [], results: {}, partMs: {}, wallMs: 0 };
      for (const part of ["config", "sprites", "terrain", "caches", "flow", "fight", "fixtures", "flipflop", "ai", "rivals", "fog", "replay", "match"]) {
        const p0 = Date.now(), r = await page.evaluate((part) => window.PS.selfTest({ parts: part }), part);
        st.partMs[part] = Date.now() - p0; Object.assign(st.results, r.results); for (const f of r.fails) if (st.fails.indexOf(f) < 0) st.fails.push(f);
      }
      st.pass = st.fails.length === 0; st.wallMs = Date.now() - s0; report.selfTest = st;
      // hidden-tab proxy: blank every cache the way a discarded backing store does, fire visibilitychange, let the frame loop re-bake
      const drop = await page.evaluate(() => { const n = window.PS.debugDropCaches(); const mid = window.PS.cacheReport(); document.dispatchEvent(new Event("visibilitychange")); return { dropped: n, blankAfterDrop: mid.chunksBlank.length + mid.spritesBlank.length }; });
      let cr = null; for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); cr = await page.evaluate(() => window.PS.cacheReport()); if (cr.ok) break; }
      report.caches = { ...drop, after: cr, recovered: !!(cr && cr.ok) };
      // the same drop with NO browser event (M1 critic MAJOR-2): the draw loop's probe alone must find the blank caches and rebuild them
      const drop2 = await page.evaluate(() => { const n = window.PS.debugDropCaches(); const mid = window.PS.cacheReport(); return { dropped: n, blankAfterDrop: mid.chunksBlank.length + mid.spritesBlank.length }; });
      let cr2 = null, waited = 0; for (let i = 0; i < 40; i++) { await page.waitForTimeout(200); waited += 200; cr2 = await page.evaluate(() => window.PS.cacheReport()); if (cr2.ok) break; }
      report.caches.noEvent = { ...drop2, after: cr2, recovered: !!(cr2 && cr2.ok), waitedMs: waited };
      report.terrainTitle = await page.evaluate(() => window.PS.terrain.report());
      if (A.fixtures) {
        const fx = {};
        for (const [k, name, o] of [["pass64", "pass64"], ["pass128", "pass128"], ["ambush", "ambush"], ["ambushSpec", "ambush", { wait: 30 }], ["ambushSpecBlob", "ambush", { wait: 30, blob: true }],
          ["flipflop", "flipflop"], ["flipflopNoHyst", "flipflop", { noHyst: true }], ["cliffSnapped", "cliff", { variant: "snapped" }], ["cliffRaw", "cliff", { variant: "raw" }], ["cliffIdle", "cliff", { variant: "idle" }],
          ["hold", "hold"], ["holdInside", "hold", { at: -40 }], ["remnant", "remnant"], ["remnantChased", "remnant", { chase: true }], ["remnantAiLoser", "remnant", { loser: "ai" }]]) {
          fx[k] = await page.evaluate(([n, o]) => window.PS.fixture(n, o || {}), [name, o]);
        }
        fx.desktopMode = await page.evaluate(() => window.PSS.cfg.input.desktopMode);
        report.fixtures = fx;
      }
      for (const pair of A.fights === "none" ? [] : A.fights.split(",")) {
        const [n, m] = pair.split("x").map(Number);
        const f = await page.evaluate(([n, m, mx, runs]) => window.PS.fight(n, m, mx, runs), [n, m, A.fightMax, A.fightRuns]);
        report.fights.push(f);
      }
    }

    // difficulty: set the stored choice, reload, confirm the game picked it up
    await page.evaluate((d) => localStorage.setItem("ps.difficulty", d), A.difficulty);
    b0 = Date.now();
    await page.reload();
    await page.waitForFunction(bootReady, null, { timeout: 15000 });
    run.bootMs = Date.now() - b0;
    await page.evaluate(() => Promise.race([document.fonts.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]));
    run.fontsLoaded = await page.evaluate(() => document.fonts.check("800 20px 'Baloo 2'") && document.fonts.check("800 12px 'Nunito'"));
    run.difficulty = await page.evaluate(() => window.PSS.difficulty);
    await page.waitForTimeout(600); // let the attract match draw a few frames behind the title

    // lesson 34: the PLAY button must be what a real pointer hits at its centre
    const title = await page.evaluate(() => {
      const b = document.getElementById("btn-play"), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const e = document.elementFromPoint(x, y);
      return { x, y, w: r.width, h: r.height, inViewport: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight, hit: !!e && (e === b || b.contains(e)),
        element: e ? e.tagName + (e.id ? "#" + e.id : "") : null, bodyTouch: document.body.classList.contains("touch") };
    });
    if (ri === 0) { report.title = title; run.screenshots.title = await shot(page, "title"); }
    run.titleHit = title.hit;

    // start the match with real input: a mouse click on desktop, a touch tap on mobile
    if (A.mobile) await page.touchscreen.tap(title.x, title.y); else await page.mouse.click(title.x, title.y);
    await page.waitForFunction(() => window.PSS.mode === "play", null, { timeout: 5000 }).catch(() => {});
    run.started = await page.evaluate(() => window.PSS.mode === "play");
    run.seed = await page.evaluate(() => window.PSS.seed);
    run.terrain = await page.evaluate(() => window.PS.terrain.report());
    run.cap = await page.evaluate(() => window.PSS.cap);
    run.mouseFollowActive = await page.evaluate(() => window.PSS.input.active); // must stay false or the game overrides the scripted tx/ty
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Performance.enable");

    if (A.mobile && ri === 0 && run.started) {
      // real touch drag on the canvas: start (187,600), 6 moves up to (187,450), hold 1 s live, lift
      const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      const under = await page.evaluate(() => { const e = document.elementFromPoint(187, 600); return e ? e.tagName + (e.id ? "#" + e.id : "") : null; });
      const before = await page.evaluate(() => ({ ty: window.PSS.teams[1].ty, cy: window.PSS.teams[1].cy }));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(187, 600) });
      for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(187, 600 - 25 * i) });
      const hold = [];
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(200);
        hold.push(await page.evaluate(() => { const j = window.PSS.input.joy; return { active: j.active, mag: r(j.mag), dy: r(j.dy), ty: r(window.PSS.teams[1].ty), cy: r(window.PSS.teams[1].cy) }; function r(v) { return Math.round(v * 100) / 100; } }));
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => ({ active: window.PSS.input.joy.active, touch: window.PSS.input.touch }));
      report.touch = { target: under, before: { ty: r2(before.ty), cy: r2(before.cy) }, hold, after,
        joyActive: hold.every((h) => h.active), movedUp: Math.min(...hold.map((h) => h.ty)) < before.ty - 50, released: !after.active,
        swarmMovedUp: hold[hold.length - 1].cy < before.cy };
    }
    if (A.mobile && ri === 0 && run.started) {
      // tap-to-route: touchStart + touchEnd inside 200 ms at a walkable point 300 world px from the swarm; the player's target moves there
      // and a route (the player's field, sourced at that target) exists. Then hold-to-stop: a still finger past input.tapMs stops the swarm.
      const tp = (x, y) => [{ x, y, id: 2, radiusX: 4, radiusY: 4, force: 1 }];
      const pick = await page.evaluate(() => { const S = window.PSS, p = S.teams[1], z = S.cam.zoom, T = window.PS.terrain;
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, wx = p.ax + Math.cos(a) * 300, wy = p.ay + Math.sin(a) * 300, sx = (wx - S.cam.x) * z + S.vw / 2, sy = (wy - S.cam.y) * z + S.vh / 2;
          if (sx > 40 && sx < S.vw - 40 && sy > 160 && sy < S.vh - 160 && T.walkable(wx, wy) && T.sdfAt(wx, wy) > 40) return { wx, wy, sx, sy, under: (document.elementFromPoint(sx, sy) || {}).id || null }; } return null; });
      if (pick) {
        const t0 = Date.now(); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(pick.sx, pick.sy) }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); const liftMs = Date.now() - t0;
        await page.waitForTimeout(250);
        const a = await page.evaluate(() => { const S = window.PSS, p = S.teams[1], f = window.PS.flow.fieldFor(1), FL = window.PS.flow; return { mode: p.mode, route: S.input.route.on, src: S.input.route.src, tx: p.tx, ty: p.ty, field: !!(f && f.ok), fieldAtTarget: !!(f && f.ok && f.src === FL.cellFor(p.tx, p.ty)), pathPx: f && f.ok ? Math.round(FL.pathCell(f, FL.cellFor(p.ax, p.ay))) : -1,
          snappedToCamp: window.PS.vis.camps().some((c) => Math.hypot(c.x - p.tx, c.y - p.ty) < 1) }; }); // a tap near a known camp routes to the camp (SPEC-v2 §10), a legal target
        report.tap = { pick, liftMs, ...a, dist: Math.round(Math.hypot(a.tx - pick.wx, a.ty - pick.wy)), ok: liftMs < 200 && a.mode === "route" && a.route && a.src === "tap" && (Math.hypot(a.tx - pick.wx, a.ty - pick.wy) < 48 || a.snappedToCamp) && a.fieldAtTarget && a.pathPx > 0 };
        const h0 = await page.evaluate(() => { const S = window.PSS; return { sx: S.vw / 2, sy: S.vh * 0.6 }; });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(h0.sx, h0.sy) }); await page.waitForTimeout(450);
        const during = await page.evaluate(() => { const S = window.PSS, p = S.teams[1]; return { mode: p.mode, hold: S.input.hold, dist: Math.round(Math.hypot(p.tx - p.ax, p.ty - p.ay)), route: S.input.route.on, joy: S.input.joy.active }; });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(600);
        const after = await page.evaluate(() => { const S = window.PSS, p = S.teams[1]; return { mode: p.mode, hold: S.input.hold, speed: Math.round(Math.hypot(p.vx, p.vy)), route: S.input.route.on }; });
        report.hold = { during, after, ok: during.mode === "hold" && during.hold && !during.route && !during.joy && during.dist < 60 && after.mode === "hold" && !after.route };
      } else report.tap = { pick: null, ok: false };
    }
    if (ri === 0 && run.started) {
      // visible-tab stall (M1 critic MAJOR-1): a 2 s busy loop on the main thread, then 40 frames: no frame may advance more than 2 ticks x pace
      report.stall = await page.evaluate(() => new Promise((res) => { const S = window.PSS, t0 = performance.now(); while (performance.now() - t0 < 2000) { /* stall */ }
        const d = []; let last = S.tick, n = 0; const f = () => { d.push(S.tick - last); last = S.tick; if (++n < 40) requestAnimationFrame(f); else res({ deltas: d, max: Math.max(...d), pace: S.pace, hidden: document.hidden }); }; requestAnimationFrame(f); }));
      report.stall.ok = report.stall.max <= 2 * report.stall.pace;
      // fog structure (M3): fog canvas <= 1/4 CSS size, exactly one full-screen alpha draw per frame (wrapped drawImage / fillRect, 10 frames)
      report.fogStructure = await page.evaluate(() => window.PS.vis.structure());
      report.fogStructure.ok = report.fogStructure.quarter && report.fogStructure.layers === 1;
    }
    if (A.mobile && ri === 0 && run.started) {
      report.huddle = await page.evaluate(() => {
        const b = document.getElementById("t-huddle"), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { bodyTouch: document.body.classList.contains("touch"), display: cs.display, rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
          visible: cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
          reachable: !!e && (e === b || b.contains(e)) };
      });
    }

    // ------------------------------------------------ the match
    const stops = new Set(); for (let t = LOG_EVERY; t < A.sim; t += LOG_EVERY) stops.add(t); stops.add(45); stops.add(A.sim);
    const plan = [...stops].filter((t) => t <= A.sim).sort((a, b) => a - b);
    run.timeline.push(await page.evaluate(() => window.__psh.snapshot()));
    let maxAgents = run.timeline[0].total, busiest = null;
    for (const stop of plan) {
      let guard = 0;
      while (guard++ < 20) {
        const now = await page.evaluate(() => ({ t: window.PSS.t, mode: window.PSS.mode }));
        if (now.mode !== "play" || now.t >= stop - 1e-6) break;
        const c = await page.evaluate(runChunk, { until: stop, maxSim: CHUNK_SIM, tick: POLICY_TICK, wallMs: EVAL_WALL_MS, policy: POLICY, leak: true });
        if (c.simSec > 0) run.chunks.push({ t0: r2(c.t - c.simSec), t1: r2(c.t), simSec: r2(c.simSec), stepMs: Math.round(c.stepMs), msPerSimSec: r2(c.stepMs / c.simSec), peakAgents: c.peak, wallMs: Math.round(c.wallMs) });
        for (const k in c.acts) run.policy[k] += c.acts[k];
        if (c.peak > maxAgents) maxAgents = c.peak;
      }
      const snap = await page.evaluate(() => window.__psh.snapshot());
      if (snap.mode !== "play") break;
      if (stop === 45) run.screenshots.t45 = await shot(page, `run${ri + 1}-t45`);
      if (stop % LOG_EVERY === 0 || stop === A.sim) {
        run.timeline.push(snap);
        if (!busiest || snap.total > busiest.total) { busiest = snap; run.screenshots.busiest = await shot(page, `run${ri + 1}-busiest`); }
        const m0 = await cdpMetrics(cdp);
        const rw = await page.evaluate(renderWindow, { ms: A.renderSecs * 1000, policy: POLICY });
        const m1 = await cdpMetrics(cdp);
        for (const k in rw.acts) run.policy[k] += rw.acts[k];
        const busyMs = ((m1.TaskDuration - m0.TaskDuration) * 1000) / Math.max(1, rw.frames), scriptMs = ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / Math.max(1, rw.frames);
        run.render.push({ t: snap.t, total: snap.total, onScreen: snap.onScreen, fps: r2(rw.fps), avgMs: r2(rw.avgMs), p95Ms: r2(rw.p95Ms), maxMs: r2(rw.maxMs),
          mainThreadMsPerFrame: r2(busyMs), scriptMsPerFrame: r2(scriptMs), gameFps: rw.gameFps, simAdvance: r2(rw.simAdvance), wallMs: Math.round(rw.wallMs), visibility: rw.visibility,
          maskUploads: rw.maskUploads, maskUploadRate: r2(rw.maskUploadRate), fogP90: rw.fogP90 });
      }
    }
    // fog (M3): what the fog-honest player saw, the leak totals over every drawn frame, the AI knowledge counters, fog JS per frame
    run.fog = await page.evaluate(() => ({ stats: window.PS.vis.stats, leak: window.PS.vis.leakTotals(), ai: window.PS.ai.assertKnowledge(), cost: window.PS.vis.cost(), stamps: window.PS.vis.stamps, explored: window.PSS.fogW ? window.PSS.fogW.nExp[1] : null }));
    if (run.fog.leak) { const L = run.fog.leak; run.fog.leakDiff = L.hidden + L.missed + L.neutralsHidden + L.tagHidden + L.ringHidden + L.arrowHidden + L.miniHidden; }
    // ------------------------------------------------ the end screen: finish naturally, or ring the bell early when --sim is shorter than the match
    let st = await page.evaluate(() => ({ mode: window.PSS.mode, t: window.PSS.t, timeLeft: window.PSS.timeLeft, result: window.PSS.result }));
    run.endForced = false;
    if (st.mode === "play" && !st.result && st.timeLeft > 0.5) { run.endForced = true; await page.evaluate(() => { window.PSS.timeLeft = Math.min(window.PSS.timeLeft, 0.05); }); }
    for (let i = 0; i < 20 && st.mode === "play"; i++) { st = await page.evaluate(() => { window.PS.step(0.5); return { mode: window.PSS.mode, t: window.PSS.t }; }); }
    await page.waitForFunction(() => document.querySelector("#ov-win.active, #ov-lose.active"), null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    run.end = await page.evaluate(() => {
      const S = window.PSS, ov = document.querySelector("#ov-win.active, #ov-lose.active");
      const counts = {}; for (const t of S.teams.slice(1)) counts[t.name] = t.count;
      return { mode: S.mode, result: S.result, t: Math.round(S.t * 100) / 100, overlay: ov ? ov.id : null, reason: ov ? ov.querySelector("p").textContent : null, counts, stats: { ...S.stats },
        ev: S.ev ? { ...S.ev } : null, bell: S.timeLeft <= 0.001, leftHome: S.teams.slice(1).map((t) => t.leftHome), atCentre: S.teams.slice(1).map((t) => t.atCentre) };
    });
    run.screenshots.end = await shot(page, `run${ri + 1}-end`);
    const aliveAt = (t) => { const s = run.timeline.find((x) => Math.round(x.t) === t); return s ? s.alive.filter(Boolean).length : null; };
    run.summary = { playerFights: run.end.stats.fights, fights: run.end.ev && run.end.ev.fights, routs: run.end.ev && run.end.ev.routs, remnants: run.end.ev && run.end.ev.remnants,
      aliveAt60: aliveAt(60), aliveAt120: aliveAt(120), aliveAt180: aliveAt(180), bell: run.end.bell && !run.endForced, bellForced: run.endForced, leftHome: run.end.leftHome, atCentre: run.end.atCentre };
    run.maxAgents = maxAgents;
    run.agentCap = await page.evaluate(() => window.PSS.cap);
    run.dbg = await page.evaluate(() => ({ ...window.PSS.dbg }));
    report.outcomes.push({ run: ri + 1, result: run.end.result, forced: run.endForced, how: run.end.reason });

    if (ri === 0 && run.end.overlay) {
      // restart: the end screen's primary button must be what a pointer hits, and pressing it must start a fresh match
      const btnId = run.end.overlay === "ov-win" ? "btn-again" : "btn-retry";
      const hitBtn = (id) => page.evaluate((id) => { const b = document.getElementById(id), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y); return { x, y, hit: !!e && (e === b || b.contains(e)) }; }, id);
      const press = async (id) => { const h = await hitBtn(id); if (A.mobile) await page.touchscreen.tap(h.x, h.y); else await page.mouse.click(h.x, h.y); await page.waitForFunction(() => window.PSS.mode === "play", null, { timeout: 5000 }).catch(() => {}); return h; };
      // the restarted match runs on Hard (startBonus 0, as if the player picked HARD) for the idle-player loss check below
      await page.evaluate(() => { window.PSS.difficulty = "hard"; });
      const h = await press(btnId);
      const after = await page.evaluate(() => ({ mode: window.PSS.mode, t: window.PSS.t, seed: window.PSS.seed, agents: window.PSS.agents.length, map: window.PS.terrain.report().used }));
      report.restart = { button: btnId, hit: h.hit, ...after, ok: h.hit && after.mode === "play" && after.t < 2 };
      if (report.restart.ok) {
        // idle-player loss: nobody steers the Hard match's single peasant for 40 s while the AIs recruit their starter camps, then the
        // bell rings: the player must lose. Difficulty goes back to the run's setting before the second restart.
        await page.evaluate(() => window.PS.step(30)); await page.evaluate(() => window.PS.step(10));
        const pre = await page.evaluate(() => ({ counts: window.PSS.teams.slice(1).map((t) => t.count), dbg: { ...window.PSS.dbg } }));
        await page.evaluate(() => { window.PSS.timeLeft = 0.05; });
        for (let i = 0; i < 10; i++) { const m = await page.evaluate(() => { window.PS.step(0.5); return window.PSS.mode; }); if (m !== "play") break; }
        await page.waitForFunction(() => document.querySelector("#ov-win.active, #ov-lose.active"), null, { timeout: 5000 }).catch(() => {});
        const idle = await page.evaluate(() => { const ov = document.querySelector("#ov-win.active, #ov-lose.active"); return { result: window.PSS.result, overlay: ov ? ov.id : null, reason: ov ? ov.querySelector("p").textContent : null }; });
        run.screenshots.idleEnd = await shot(page, `run${ri + 1}-idle-end`);
        report.outcomes.push({ run: "idle", difficulty: "hard", result: idle.result, forced: true, how: idle.reason, countsBeforeBell: pre.counts, terrainBad: pre.dbg.terrainBad });
        await page.evaluate((d) => { window.PSS.difficulty = d; }, A.difficulty);
        const h2 = idle.overlay ? await press(idle.overlay === "ov-win" ? "btn-again" : "btn-retry") : { hit: false };
        report.restart.second = { hit: h2.hit, mode: await page.evaluate(() => window.PSS.mode) };
      }
      // all-AI matches under the real rules (M4): six swarms, the live page, stepped to the bell in 30 s chunks; per-tick cap and rock counters
      for (let k = 0; k < A.aiMatches; k++) {
        const seed = ((A.seed != null && isFinite(A.seed) ? A.seed : 97) * 31 + k * 7919) >>> 0;
        report.aiMatches.push(await liveMatch(page, { seed, difficulty: "normal", aiPlayer: true }, A.aiSecs));
      }
    }
    const costly = run.chunks.reduce((b, c) => (!b || c.peakAgents > b.peakAgents ? c : b), null);
    run.simCost = costly ? { atPeakAgents: costly.peakAgents, window: [costly.t0, costly.t1], msPerSimSec: costly.msPerSimSec,
      avgMsPerSimSec: r2(run.chunks.reduce((s, c) => s + c.stepMs, 0) / Math.max(1e-9, run.chunks.reduce((s, c) => s + c.simSec, 0))) } : null;
    const top = run.render.reduce((b, x) => (!b || x.total > b.total ? x : b), null);
    run.renderAtBusiest = top; run.worstRender = run.render.reduce((b, x) => (!b || x.fps < b.fps ? x : b), null);
    await ctx.close();
  }
  if (A.botMatches > 0) {
    // the fog-honest scripted bot's win rate per difficulty (M4, SPEC-v2 §9: Easy >= 60%, Normal 35-45% are M8 gates): full matches, no draws
    const ctx = await browser.newContext(ctxOpts); await ctx.addInitScript(installHelpers); const page = await ctx.newPage();
    page.on("pageerror", (e) => report.errors.page.push({ run: "bot matches", text: String(e.message || e) }));
    page.on("console", (m) => { if (m.type() === "error" && !FONT_HOST.test(m.text() + ((m.location() && m.location().url) || ""))) report.errors.console.push({ run: "bot matches", text: m.text() }); });
    await page.goto(url.href); await page.waitForFunction(() => !!(window.PS && window.PS.debugStart && window.PSS && window.PSS.teams && window.PSS.teams.length > 1), null, { timeout: 20000 });
    report.botMatches = [];
    for (const diff of A.botDiffs.split(",")) for (let k = 0; k < A.botMatches; k++) {
      const seed = ((A.seed != null && isFinite(A.seed) ? A.seed : 97) * 17 + 104729 + k * 7919) >>> 0;
      report.botMatches.push(await liveMatch(page, { seed, difficulty: diff, aiPlayer: false }, A.aiSecs));
    }
    await ctx.close();
  }
  if (A.fixtures) {
    // each fixture live (?fixture=name): a screenshot mid-scene, and zero errors on those pages too
    report.fixtureShots = {};
    for (const [name, t] of [["pass64", 4], ["pass128", 3], ["ambush", 5], ["flipflop", 3]]) {
      const ctx = await browser.newContext(ctxOpts), page = await ctx.newPage();
      page.on("pageerror", (e) => report.errors.page.push({ run: "fixture " + name, text: String(e.message || e) }));
      page.on("console", (m) => { if (m.type() === "error" && !FONT_HOST.test(m.text() + ((m.location() && m.location().url) || ""))) report.errors.console.push({ run: "fixture " + name, text: m.text() }); });
      const u = new URL(url.href); u.searchParams.set("fixture", name); await page.goto(u.href);
      await page.waitForFunction((t) => window.PSS && window.PSS.fixture && window.PSS.t >= t, t, { timeout: 30000 }).catch(() => {});
      report.fixtureShots[name] = await shot(page, "fixture-" + name); await ctx.close();
    }
  }
  if (A.fogPerf) {
    // fog JS per frame (M3 gate 1.5 ms at 4x): a live scripted match to 90 s at 1x, then 120 frames (one tick + one drawn, leak-checked frame
    // each) at 1x and at --throttle x; the cap-clash bench's fog JS at both. Fog JS = the render-side fog work plus the stamps of the ticks.
    const ctx = await browser.newContext(ctxOpts); await ctx.addInitScript(installHelpers); const page = await ctx.newPage();
    page.on("pageerror", (e) => report.errors.page.push({ run: "fog perf", text: String(e.message || e) }));
    page.on("console", (m) => { if (m.type() === "error" && !FONT_HOST.test(m.text() + ((m.location() && m.location().url) || ""))) report.errors.console.push({ run: "fog perf", text: m.text() }); });
    await page.goto(runUrl(7)); await page.waitForFunction(() => !!(window.PS && window.PS.vis && window.PSS && window.PSS.teams && window.PSS.teams.length > 1), null, { timeout: 20000 });
    const b = await page.evaluate(() => { const b = document.getElementById("btn-play").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    if (A.mobile) await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
    await page.waitForFunction(() => window.PSS.mode === "play", null, { timeout: 5000 }).catch(() => {});
    for (let k = 0; k < 3; k++) await page.evaluate(runChunk, { until: 90, maxSim: CHUNK_SIM, tick: POLICY_TICK, wallMs: EVAL_WALL_MS, policy: POLICY, leak: false });
    const frames = () => page.evaluate(() => { window.PS.vis.resetCost(); const S = window.PSS; let n = 0; for (let i = 0; i < 120 && S.mode === "play"; i++) { if (i % 30 === 0) window.__psh.policy({ sight: 400, hunt: 0.7, flee: 1.4, fleeDist: 300 }); window.PS.step(1 / 60); window.PS.vis.leakCheck(); n++; }
      const c = window.PS.vis.cost(50); return { frames: n, p50: c.p50, p90: c.p90, p99: c.p99, mean: c.mean, meanTrim: c.meanTrim, stalls: c.stalls, max: c.max, stampMsPerTick: c.stampMsPerTick, t: +S.t.toFixed(1), count: S.teams[1].count, agents: S.agents.length, holes: window.PS.fog.RS.holes }; });
    const cdp = await ctx.newCDPSession(page); const fp = { throttle: A.throttle };
    fp.match1x = await frames();
    fp.bench1x = await page.evaluate(() => { const b = window.PS.bench("capclash", { ticks: 90, stallMs: 50 }); return { fog: b.fog, draw: b.draw, update: b.update }; });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: A.throttle });
    fp.matchThrottled = await frames();
    fp.benchThrottled = await page.evaluate(() => { const b = window.PS.bench("capclash", { ticks: 45, stallMs: 50 }); return { fog: b.fog, draw: b.draw, update: b.update }; });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    // the gate reads the per-frame MEAN at the throttle: CDP throttling runs the page in ~0.2 ms bursts between ~0.5 ms pauses, so any
    // timed segment that straddles a pause reads 0.5 ms more (a 0.03 ms stamp segment reads ~0.7 ms at p90 under 4x). p90 is reported.
    // Frames over 50 ms are GPU-process stalls, not fog work (the same 250+ ms stalls land on frames whose fog JS is 2 ms): they are counted
    // and reported, and left out of the gated mean (meanTrim); the raw mean is reported beside it.
    fp.ok = fp.matchThrottled.meanTrim <= 1.5 && fp.benchThrottled.fog.meanTrim <= 1.5; fp.p90ok = fp.matchThrottled.p90 <= 1.5 && fp.benchThrottled.fog.p90 <= 1.5;
    report.fogPerf = fp; await ctx.close();
  }
  {
    // ?nofog=1 (M3 brief acceptance): renders everything; start with a real click or tap, play, reach the end screen, restart
    const ctx = await browser.newContext(ctxOpts); await ctx.addInitScript(installHelpers); const page = await ctx.newPage(), errs = [];
    page.on("pageerror", (e) => errs.push(String(e.message || e)));
    page.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !FONT_HOST.test(m.text() + ((m.location() && m.location().url) || ""))) errs.push(m.type() + ": " + m.text()); });
    const u = new URL(runUrl(8)); u.searchParams.set("nofog", "1"); await page.goto(u.href);
    await page.waitForFunction(() => !!(window.PS && window.PS.vis && window.PSS && window.PSS.teams && window.PSS.teams.length > 1), null, { timeout: 20000 });
    const hit = async (id) => { const h = await page.evaluate((id) => { const b = document.getElementById(id), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y); return { x, y, hit: !!e && (e === b || b.contains(e)) }; }, id);
      if (A.mobile) await page.touchscreen.tap(h.x, h.y); else await page.mouse.click(h.x, h.y); await page.waitForFunction(() => window.PSS.mode === "play", null, { timeout: 5000 }).catch(() => {}); return h.hit; };
    const n = { startHit: await hit("btn-play") };
    n.started = await page.evaluate(() => window.PSS.mode === "play" && window.PS.vis.nofog);
    await page.evaluate(runChunk, { until: 20, maxSim: CHUNK_SIM, tick: POLICY_TICK, wallMs: EVAL_WALL_MS, policy: POLICY, leak: false });
    n.drawnAll = await page.evaluate(() => { window.PS.vis.leakCheck(); const S = window.PSS; let rivals = 0; for (const a of S.agents) if (a.team > 1 && a.seenA > 0) rivals++; return { rivalsShown: rivals, gate: window.PS.vis.on }; });
    await page.evaluate(() => { window.PSS.timeLeft = 0.05; }); for (let i = 0; i < 10; i++) { const m = await page.evaluate(() => { window.PS.step(0.5); return window.PSS.mode; }); if (m !== "play") break; }
    await page.waitForFunction(() => document.querySelector("#ov-win.active, #ov-lose.active"), null, { timeout: 5000 }).catch(() => {});
    n.end = await page.evaluate(() => { const ov = document.querySelector("#ov-win.active, #ov-lose.active"); return ov ? ov.id : null; });
    n.restartHit = n.end ? await hit(n.end === "ov-win" ? "btn-again" : "btn-retry") : false;
    n.restarted = await page.evaluate(() => window.PSS.mode === "play" && window.PSS.t < 2);
    n.shot = await shot(page, "nofog"); n.errors = errs; n.ok = n.startHit && n.started && !!n.end && n.restartHit && n.restarted && errs.length === 0 && n.drawnAll.gate === false;
    report.nofog = n; await ctx.close();
  }
  await browser.close();

  // ---------------------------------------------------------------- verdict
  const as = report.asserts, W = report.notes;
  as.noConsoleErrors = report.errors.console.length === 0;
  as.noPageErrors = report.errors.page.length === 0;
  as.selfTestPass = !!(report.selfTest && report.selfTest.pass);
  as.btnPlayHit = report.runs.every((r) => r.titleHit);
  as.difficultyApplied = report.runs.every((r) => r.difficulty === A.difficulty);
  as.matchStarted = report.runs.every((r) => r.started);
  as.scriptedPlayerInControl = report.runs.every((r) => !r.mouseFollowActive);
  as.endScreenReached = report.runs.every((r) => !!(r.end && r.end.overlay));
  const lives = report.aiMatches.concat(report.botMatches || []);
  as.agentCapRespected = report.runs.every((r) => r.maxAgents <= r.agentCap && r.dbg && r.dbg.capOver === 0) && lives.every((m) => m.dbg.capOver === 0 && m.peak <= m.cap);
  // M1 gates
  as.noAgentInRock = report.runs.every((r) => r.dbg && r.dbg.terrainBad === 0) && lives.every((m) => m.dbg.terrainBad === 0) && report.outcomes.every((o) => !o.terrainBad);
  as.terrainWithinRerolls = report.runs.every((r) => r.terrain && r.terrain.rerolls <= 4) && !!(report.terrainTitle && report.terrainTitle.rerolls <= 4);
  as.cachesRecovered = !!(report.caches && report.caches.recovered && report.caches.blankAfterDrop > 0);
  as.restartWorks = !!(report.restart && report.restart.ok && report.restart.second && report.restart.second.hit && report.restart.second.mode === "play");
  as.idlePlayerLoses = report.outcomes.some((o) => o.run === "idle" && o.result === "lose");
  if (A.aiMatches > 0) as.aiMatchesClean = report.aiMatches.length === A.aiMatches && report.aiMatches.every((m) => m.mode === "aidone" && m.names.length === 6); // ran to the bell or last standing
  // M2 gates
  if (A.aiMatches > 0) as.aiLeaveHome40s = report.aiMatches.every((m) => m.leftHome && m.leftHome.every((t) => t >= 0 && t <= 40));
  as.cachesRecoveredNoEvent = !!(report.caches && report.caches.noEvent && report.caches.noEvent.recovered && report.caches.noEvent.blankAfterDrop > 0);
  as.visibleStallCap = !!(report.stall && report.stall.ok && !report.stall.hidden);
  if (A.fixtures) {
    const F = report.fixtures || {};
    as.fixturePass64 = !!(F.pass64 && F.pass64.through != null && F.pass64.through <= 8 && F.pass64.regroup >= 0.9 && !F.pass64.terrainBad);
    as.fixturePass128 = !!(F.pass128 && F.pass128.through != null && F.pass128.through <= 6 && F.pass128.regroup >= 0.9 && !F.pass128.terrainBad);
    as.fixtureAmbushHeadOnly = !!(F.ambush && F.ambush.pass && !F.ambush.terrainBad);
    as.fixtureFlipflop = !!(F.flipflop && (F.desktopMode !== "route" || (F.flipflop.reversals <= 2 && F.flipflop.split <= 0.1)) && !F.flipflop.terrainBad);
    as.fixtureShots = !!(report.fixtureShots && Object.keys(report.fixtureShots).length === 4);
    as.fixtureHold = !!(F.hold && F.hold.pass && F.holdInside && F.holdInside.pass); // M2 critic MAJOR-1
    as.fixtureRemnantEscape = !!(F.remnant && F.remnant.pass); // M2 critic MAJOR-2: the winner AI-driven
  }
  if (report.bench && report.bench.ratio) { const q = report.bench.ratio; if (A.refGate) as.benchTickP90VsRef = q.updateP90 <= A.refGate; else as.benchGate = q.updateP50 <= 1.1 && q.updateP90 <= 1.1 && q.drawP50 <= 1.1 && q.drawP90 <= 1.1; if (A.refDrawGate) as.benchDrawP90VsRef = q.drawP90 <= A.refDrawGate; }
  // M3 gates: fog leaks, AI knowledge, structure, mask upload rate, fog JS at the throttle, ?nofog=1, console warnings
  as.noConsoleWarnings = report.errors.warnings.length === 0;
  as.fogLeakClean = report.runs.every((r) => r.fog && r.fog.leak && r.fog.leak.frames > 0 && r.fog.leakDiff === 0);
  as.aiKnowledgeClean = report.runs.every((r) => r.fog && r.fog.ai && r.fog.ai.violations === 0) && lives.every((m) => m.ai && m.ai.violations === 0);
  if (lives.length) as.aiThinkCost = lives.every((m) => m.aiCost.msPerTick < 0.1);
  report.pacing = pacingTable(report);
  if (report.fogStructure) as.fogStructure = !!report.fogStructure.ok;
  as.maskUploadsUnder5Hz = report.runs.every((r) => r.render.every((x) => x.maskUploadRate == null || x.maskUploadRate <= 5.05));
  if (report.fogPerf) as.fogJsThrottled = !!report.fogPerf.ok;
  as.nofogPlayable = !!(report.nofog && report.nofog.ok);
  if (report.bench) as.benchClean = report.bench.errors.length === 0 && [...report.bench.v2runs, ...report.bench.v1runs].every((b) => !b.terrainBad);
  if (A.mobile) {
    const t = report.touch || {}, h = report.huddle || {};
    as.touchLandsOnCanvas = t.target === "CANVAS#game";
    as.joyActive = !!t.joyActive; as.joyTargetMovedUp = !!t.movedUp; as.joyReleased = !!t.released;
    as.huddleVisible = !!(h.bodyTouch && h.visible); as.huddleReachable = !!h.reachable;
    as.tapToRoute = !!(report.tap && report.tap.ok); as.holdToStop = !!(report.hold && report.hold.ok);
  }
  report.pass = Object.values(as).every(Boolean);
  for (const r of report.runs) {
    if (r.renderAtBusiest && r.renderAtBusiest.fps < 50) W.push(`run ${r.index}: ${r.renderAtBusiest.fps} fps at the busiest sample (${r.renderAtBusiest.total} agents, ${r.renderAtBusiest.onScreen} on screen)`);
    for (const x of r.render) if (x.simAdvance < 0.8 * (x.wallMs / 1000) && x.fps < 30) W.push(`run ${r.index} t=${x.t}: rAF looks starved (sim advanced ${x.simAdvance}s in ${x.wallMs} ms)`);
    if (!r.fontsLoaded) W.push(`run ${r.index}: web fonts did not load, screenshots use fallback fonts`);
  }
  if (report.selfTest && report.selfTest.wallMs > 12000) W.push(`selfTest took ${report.selfTest.wallMs} ms`);
  const smd = report.selfTest && report.selfTest.results.simMatch_no_exceptions && report.selfTest.results.simMatch_no_exceptions.detail;
  if (smd && smd.truncated) W.push(`selfTest simMatch hit its wall guard at ${smd.seconds} sim-s: the agent-cap check covered only that span`);
  for (const m of lives) if (m.t < A.aiSecs - 1 && m.mode === "play") W.push(`live match seed ${m.seed} stopped at ${m.t} sim-s`);
  if (!report.outcomes.some((o) => o.result === "win")) W.push("no win observed in this pass (runs + idle check); a win is verified in another pass or by hand");
  report.meta.durationMs = Date.now() - t0; report.meta.loadAvgEnd = os.loadavg().map(r2);
  if (report.meta.loadAvgStart[0] > report.meta.cpus * 0.75) W.push(`machine was busy at start (load ${report.meta.loadAvgStart[0]} on ${report.meta.cpus} CPUs): sim-cost and selfTest timings are inflated`);
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(out, "report.md"), markdown(report));
  console.log(`[harness] ${tag} ${report.pass ? "PASS" : "FAIL"} in ${Math.round(report.meta.durationMs / 1000)} s -> ${path.join(out, "report.md")}`);
  if (!report.pass) console.log("[harness] failed: " + Object.keys(as).filter((k) => !as[k]).join(", "));
  process.exitCode = report.pass ? 0 : 1;
}

function markdown(R) {
  const L = [], m = R.meta, st = R.selfTest;
  L.push(`# Peasant Swarm harness: ${m.mode} ${R.pass ? "PASS" : "FAIL"}`, "");
  L.push(`${m.url} · ${m.viewport.width}x${m.viewport.height} @${m.deviceScaleFactor}x · Chromium ${m.chromium} · ${m.seeds} run(s) × ${m.sim} s · ${m.difficulty} · ${Math.round(m.durationMs / 1000)} s wall · load ${m.loadAvgStart[0]}→${m.loadAvgEnd[0]} on ${m.cpus} CPUs`, "");
  L.push("## Assertions", "", "| check | result |", "|---|---|");
  for (const [k, v] of Object.entries(R.asserts)) L.push(`| ${k} | ${v ? "pass" : "**FAIL**"} |`);
  L.push("", `Console errors: ${R.errors.console.length} · page errors: ${R.errors.page.length} · filtered font-host errors: ${R.errors.filteredFontErrors}`);
  for (const e of [...R.errors.console, ...R.errors.page].slice(0, 10)) L.push(`- run ${e.run}: ${e.text.slice(0, 200)}`);
  if (st) {
    L.push("", `## selfTest: ${st.pass ? "PASS" : "FAIL"} (${st.wallMs} ms)`, "");
    for (const [k, v] of Object.entries(st.results)) L.push(`- ${k}: ${v.pass ? "pass" : "FAIL"}`);
    const sm = st.results.simMatch_no_exceptions && st.results.simMatch_no_exceptions.detail;
    if (sm && sm.timeline) L.push(`- simMatch (all four swarms AI): ${sm.seconds} s, ended by ${sm.truncated ? "the 10 s wall guard (truncated)" : sm.end}, winner ${sm.winner ? sm.winner.name + " " + sm.winner.count : "none"}, peak agents ${sm.maxTotal} / cap ${sm.agentCap}. Counts ${sm.names.join("/")}: ${sm.timeline.map((x) => x.t + "s " + x.counts.join("/")).join(" · ")}`);
    const cfg = st.results.config_keys && st.results.config_keys.detail;
    if (cfg && cfg.unused && cfg.unused.length) L.push(`- config keys no code reads: ${cfg.unused.join(", ")}`);
  }
  if (R.fights.length) {
    L.push("", "## Fights (PS.fight, median of runs; survivors counted before the rout flips the losers)", "", "| n v m | winner | player wins | median s | player left | rival left | player after |", "|---|---|---|---|---|---|---|");
    for (const f of R.fights) L.push(`| ${f.n}v${f.m} | ${f.winner} | ${f.playerWins}/${f.runs.length} | ${f.seconds} | ${f.playerLeft} | ${f.rivalLeft} | ${f.playerAfter} |`);
  }
  if (R.bench) {
    const b = R.bench, row = (k, x) => x ? `| ${k} | ${x.update.p50} / ${x.update.p90} / ${x.update.p99} | ${x.draw.p50} / ${x.draw.p90} / ${x.draw.p99} | ${r2(x.drawImage)} | ${x.layers} | ${x.agents} (${x.onScreen} on screen) |` : null;
    L.push("", "## PS.bench(\"capclash\") (median of runs; ms of script per tick / per frame)", "", "| build | update p50 / p90 / p99 | draw p50 / p90 / p99 | drawImage | full-screen alpha layers | agents |", "|---|---|---|---|---|---|");
    if (b.v1) L.push(row("v1 reference (" + b.v1runs.length + " runs)", b.v1)); L.push(row("v2 (" + b.v2runs.length + " runs)", b.v2));
    if (b.ratio) L.push("", `this build / reference: update p50 ${b.ratio.updateP50}, p90 ${b.ratio.updateP90}; draw p50 ${b.ratio.drawP50}, p90 ${b.ratio.drawP90} (gate: ${R.meta.refGate ? "tick p90 <= " + R.meta.refGate : "all four <= 1.1"})`);
    const fl = b.v2runs.length && b.v2runs[b.v2runs.length - 1].flow; if (fl) L.push(`Flow fields during the timed ticks (last run): ${fl.rebuilds} rebuilds, ${fl.ms} ms total, ${fl.msPerTick} ms per tick, max ${fl.maxMs} ms.`);
  }
  L.push("", "## Fog (M3)", "", "| run | first sighting (s) | sightings | ghosts | danger cues | pings / rumbles | dust | leak frames | rivals drawn / visible / fading | leak diff | AI decisions / violations | fog JS p50 / p90 ms |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of R.runs) if (r.fog && r.fog.stats) { const f = r.fog, s = f.stats, l = f.leak; L.push(`| ${r.index} | ${s.firstSight} | ${s.sightings} | ${s.ghosts} | ${s.dangerCues} | ${s.pings} / ${s.rumbles} | ${s.dust} | ${l.frames} | ${l.rivalsDrawn} / ${l.rivalsVisible} / ${l.fading} | ${f.leakDiff} | ${f.ai.decisions} / ${f.ai.violations} | ${f.cost.p50} / ${f.cost.p90} |`); }
  if (R.fogStructure) L.push("", `Structure: fog canvas ${R.fogStructure.fogW}x${R.fogStructure.fogH} for ${R.fogStructure.cssW}x${R.fogStructure.cssH} CSS (<= 1/4: ${R.fogStructure.quarter}), full-screen alpha draws per frame ${R.fogStructure.layers}, drawImage per frame ${R.fogStructure.drawImage}. Mask uploads per second over the render windows: ${R.runs.map((r) => r.render.map((x) => x.maskUploadRate).join("/")).join(" · ")}.`);
  if (R.fogPerf) { const f = R.fogPerf; L.push("", `Fog JS per frame (ms, p50 / p90): live match at 1x ${f.match1x.p50} / ${f.match1x.p90}, at ${f.throttle}x ${f.matchThrottled.p50} / ${f.matchThrottled.p90} (t ${f.matchThrottled.t} s, ${f.matchThrottled.count} yours, ${f.matchThrottled.agents} agents); cap-clash bench at 1x ${f.bench1x.fog.p50} / ${f.bench1x.fog.p90}, at ${f.throttle}x ${f.benchThrottled.fog.p50} / ${f.benchThrottled.fog.p90}. Mean at ${f.throttle}x: match ${f.matchThrottled.meanTrim} (raw ${f.matchThrottled.mean}, ${f.matchThrottled.stalls} stall frames over 50 ms, max ${f.matchThrottled.max}), bench ${f.benchThrottled.fog.meanTrim} (raw ${f.benchThrottled.fog.mean}, ${f.benchThrottled.fog.stalls} stalls). Gate mean <= 1.5 at ${f.throttle}x: ${f.ok ? "pass" : "FAIL"}; p90 <= 1.5 at ${f.throttle}x: ${f.p90ok ? "pass" : "over (throttle pause quantisation, see notes)"}.`); }
  if (R.nofog) L.push("", `?nofog=1: start ${R.nofog.startHit && R.nofog.started}, end screen ${R.nofog.end}, restart ${R.nofog.restartHit && R.nofog.restarted}, errors ${R.nofog.errors.length}: ${R.nofog.ok ? "pass" : "FAIL"}.`);
  if (R.caches) L.push("", "## Cache drop and recovery", "", `PS.debugDropCaches blanked ${R.caches.dropped} canvases (${R.caches.blankAfterDrop} read blank), visibilitychange fired; after: ${R.caches.after.chunksOpaque}/${R.caches.after.chunks} chunks opaque, ${R.caches.after.pending} pending, minimap ${R.caches.after.minimap}, blank sprites ${R.caches.after.spritesBlank.length}. Recovered: ${R.caches.recovered}.`);
  if (R.caches && R.caches.noEvent) { const c = R.caches.noEvent; L.push(`No event (M1 critic MAJOR-2): ${c.dropped} blanked, ${c.blankAfterDrop} read blank; recovered ${c.recovered} after ${c.waitedMs} ms of frames (${c.after ? c.after.chunksOpaque + "/" + c.after.chunks + " chunks opaque" : "-"}).`); }
  if (R.stall) L.push("", "## Visible-tab stall (M1 critic MAJOR-1)", "", `2 s busy loop, then 40 frames: ticks per frame max ${R.stall.max} (pace ${R.stall.pace}, cap ${2 * R.stall.pace}); deltas ${R.stall.deltas.join(",")}. ${R.stall.ok ? "pass" : "FAIL"}.`);
  if (R.fixtures) {
    const F = R.fixtures, row = (k, v, bar) => L.push(`| ${k} | ${v} | ${bar} |`);
    L.push("", "## Fixtures (PS.fixture, sandboxed; M2 section 13)", "", "| fixture | result | bar |", "|---|---|---|");
    for (const k of ["pass64", "pass128"]) { const f = F[k]; row(k, `first in ${f.firstIn} s, 95% out ${f.out95} s: **${f.through} s**; within 1.3 x 7 sqrt(n) 3 s later: **${Math.round(100 * f.regroup)}%**; terrainBad ${f.terrainBad}`, `<= ${f.bar} s, >= 90%`); }
    const am = (f) => f.rout ? `${f.loser} broke at ${f.rout.t} s: group ${f.rout.group}, flipped ${f.headFlipped}, fled ${f.fled}, outside the group ${f.outsideGroup}, farthest flip ${f.farFlip} px, tail west of the pass kept ${f.tailKeptColour}/${f.tailWestOfPass}, column after ${f.columnAfter}` : "no rout";
    row("ambush (" + F.ambush.variant + ", 150 v " + F.ambush.waiting + ")", am(F.ambush), "only the head flips");
    row("ambush, spec 150 v 30 strung (report only)", am(F.ambushSpec), "-"); row("ambush, spec 150 v 30 dense blob (report only)", am(F.ambushSpecBlob), "-");
    row("flipflop (" + F.desktopMode + ")", `route reversals **${F.flipflop.reversals}**, split ${F.flipflop.split}, centroid U-turns ${F.flipflop.uturns}, decisions ${JSON.stringify(F.flipflop.decisions)}`, "<= 2");
    row("flipflop without hysteresis (report only)", `route reversals ${F.flipflopNoHyst.reversals} (${F.flipflopNoHyst.at}), reached ${F.flipflopNoHyst.reached}`, "-");
    const hd = (f) => `lasted ${f.lasted} s from contact, kills before breaking ${f.killsBeforeBreak}, first to break: ${f.firstBreak}, holders ${f.holdersLeft} / column ${f.columnLeft} at ${f.seconds} s`;
    row("hold (20 at the 64 px exit v a 60 column, " + F.hold.mode + ")", hd(F.hold), ">= 8 s, >= 8 kills (or the column breaks)"); row("hold, inside the pass", hd(F.holdInside), "same");
    const rd = (f) => `remnant-to-winner px each s: ${f.dist.join(", ")} (winner ${f.winner}${f.winnerStates.length ? ": " + [...new Set(f.winnerStates)].join("/") : ""})`;
    row("remnant 60 v 40, your remnant, AI winner", rd(F.remnant), ">= 350 px"); row("remnant, winner chasing it (report)", rd(F.remnantChased), "-"); row("remnant, AI remnant chased by you (report)", rd(F.remnantAiLoser), "-");
    row("cliff press (M1 critic MINOR-2)", `reversals per agent-second: snapped ${F.cliffSnapped.reversalsPerAgentSec}, raw in-rock target ${F.cliffRaw.reversalsPerAgentSec}, idle on grass ${F.cliffIdle.reversalsPerAgentSec}`, "M1: 5.25 pressed, 0.97 idle");
    if (R.fixtureShots) L.push("", `Live fixture screenshots: ${Object.values(R.fixtureShots).join(", ")}`);
  }
  if (R.tap) L.push("", "## Tap and hold (touch)", "", `Tap: lift ${R.tap.liftMs} ms, mode ${R.tap.mode}, route ${R.tap.route} (${R.tap.src}), target ${R.tap.dist} px from the tapped point, field sourced there ${R.tap.fieldAtTarget}, path ${R.tap.pathPx} px: ${R.tap.ok ? "pass" : "FAIL"}.` + (R.hold ? ` Hold: during ${JSON.stringify(R.hold.during)}, after lift ${JSON.stringify(R.hold.after)}: ${R.hold.ok ? "pass" : "FAIL"}.` : ""));
  if (R.terrainTitle) L.push("", "## Terrain", "", `Title map: ${JSON.stringify(R.terrainTitle)}`);
  for (const r of R.runs) if (r.terrain) L.push(`Run ${r.index} map: seed ${r.terrain.seed}, used ${r.terrain.used}, rerolls ${r.terrain.rerolls}${r.terrain.fallback ? " (fallback)" : ""}, gen ${r.terrain.genMs} ms, blocked ${r.terrain.blocked}, rival ${r.terrain.fair.rival}, centre ${r.terrain.fair.centre}, detour ${r.terrain.fair.detour}, crossings ${r.terrain.crossings.join(" ")}; per-tick asserts: ${JSON.stringify(r.dbg)}`);
  if (R.restart) L.push("", "## Restart and outcomes", "", `Restart via ${R.restart.button}: hit ${R.restart.hit}, mode ${R.restart.mode}, t ${r2(R.restart.t)}, new map ${R.restart.map}. Second restart: ${JSON.stringify(R.restart.second)}.`);
  for (const o of R.outcomes) L.push(`- ${o.run === "idle" ? "idle player" : "run " + o.run}: **${o.result}**${o.forced ? " (bell rung early)" : ""} — ${o.how || ""}${o.countsBeforeBell ? " (counts before the bell " + o.countsBeforeBell.join("/") + ")" : ""}`);
  if (R.pacing && R.pacing.length) {
    L.push("", "## Pacing (SPEC-v2 §9; targets are M8 gates, reported here)", "", "| matches | n | first sighting: team 1 / any (s, median) | first fight: any / team 1 (s, median) | fights / team 1's (mean) | alive 1:00 / 2:00 / 3:00 / horn | bell reached | 3:45 leader wins | elims in 1st min | bot wins | pile-ons / scent pings | AI ms per tick (max think) |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const p of R.pacing) L.push(`| ${p.label} | ${p.n} | ${p.firstSight} / ${p.firstSightAny} | ${p.firstFight} / ${p.firstPlayerFight} | ${p.fights} / ${p.playerFights} | ${p.alive60} / ${p.alive120} / ${p.alive180} / ${p.hornAlive} | ${p.bellPct}% | ${p.leaderWinsPct}% of ${p.hornN} | ${p.elimFirstMinPct}% of ${p.elims} | ${p.winPct == null ? "-" : p.winPct + "%"} | ${p.pileOns} / ${p.scentPings} | ${p.aiMsPerTick} (${p.aiMaxMs}) |`);
    L.push("", "Targets (M8): first sighting 30-90 s; first fight 60-150 s; >= 3 fights for the bot; >= 3.5 alive at 3:00; bell >= 60%; 3:45 leader wins <= 60% of all-AI matches; bot wins Easy >= 60%, Normal 35-45%; <= 20% of eliminations inside the first minute.");
  }
  const LV = R.aiMatches.concat(R.botMatches || []);
  if (LV.length) {
    L.push("", "## Live matches (M4: all-AI under the real rules, and the bot)", "", "| kind | seed | end | t | peak / cap | counts at the end | alive 1:00/2:00/3:00 | horn leader / biggest | elims [t, team] | first fight | fights | left home (s) | AI ms/tick |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const m of LV) L.push(`| ${m.aiPlayer ? "all-AI" : "bot " + m.difficulty} | ${m.seed} | ${m.aiPlayer ? m.result : m.won ? "win" : m.result}${m.bell ? " (bell)" : ""} | ${m.t} | ${m.peak} / ${m.cap} | ${m.counts.join("/")} | ${m.alive60}/${m.alive120}/${m.alive180} | ${m.hornLeader} / ${m.biggest} | ${m.elims.map((e) => e.join(":")).join(" ")} | ${m.firstFight} | ${m.fights} | ${m.leftHome.join(" / ")} | ${m.aiCost.msPerTick} |`);
  }
  if (R.touch) L.push("", "## Touch", "", `Drag on ${R.touch.target}: joy active ${R.touch.joyActive}, target ty ${R.touch.before.ty} → ${Math.min(...R.touch.hold.map((h) => h.ty))}, released ${R.touch.released}. HUDDLE visible ${R.huddle && R.huddle.visible}, reachable ${R.huddle && R.huddle.reachable}.`);
  for (const r of R.runs) {
    const names = Object.keys(r.timeline[0].counts);
    L.push("", `## Run ${r.index} (seed ${r.seed}): ${r.end.result || "?"}${r.endForced ? " (bell rung early at the --sim cap)" : ""} at ${r.end.t} s`, "", `> ${r.end.reason || ""}`, "");
    L.push(`| t | ${names.join(" | ")} | neutrals | total | on screen |`, `|${"---|".repeat(names.length + 4)}`);
    for (const s of r.timeline) L.push(`| ${Math.round(s.t)} | ${names.map((n) => s.counts[n]).join(" | ")} | ${s.neutrals} | ${s.total} | ${s.onScreen} |`);
    if (r.simCost) L.push("", `Sim cost: ${r.simCost.msPerSimSec} ms per sim-second at the busiest chunk (${r.simCost.atPeakAgents} agents, t ${r.simCost.window[0]}–${r.simCost.window[1]}); match average ${r.simCost.avgMsPerSimSec}.`);
    if (r.renderAtBusiest) L.push(`Render at busiest (t ${r.renderAtBusiest.t}, ${r.renderAtBusiest.total} agents, ${r.renderAtBusiest.onScreen} on screen): ${r.renderAtBusiest.fps} fps, ${r.renderAtBusiest.avgMs} ms/frame avg, p95 ${r.renderAtBusiest.p95Ms} ms, main thread ${r.renderAtBusiest.mainThreadMsPerFrame} ms/frame. Worst sample ${r.worstRender.fps} fps at t ${r.worstRender.t}.`);
    L.push(`Peak agents ${r.maxAgents} / cap ${r.agentCap}. Player stats: ${JSON.stringify(r.end.stats)}. Policy ticks: ${JSON.stringify(r.policy)}.`);
    if (r.summary) L.push(`Match: player fights ${r.summary.playerFights}; all swarms: fights ${r.summary.fights}, routs ${r.summary.routs}, remnants formed ${r.summary.remnants}; swarms alive at 1:00/2:00/3:00: ${r.summary.aliveAt60}/${r.summary.aliveAt120}/${r.summary.aliveAt180}; bell reached ${r.summary.bell}${r.summary.bellForced ? " (rung early at the --sim cap)" : ""}; left home (s) ${(r.summary.leftHome || []).join(" / ")}; central meadow (s) ${(r.summary.atCentre || []).join(" / ")}.`);
    L.push(`Screenshots: ${Object.values(r.screenshots).join(", ")}`);
  }
  if (R.notes.length) { L.push("", "## Notes"); for (const n of R.notes) L.push(`- ${n}`); }
  if (R.errors.warnings.length) { L.push("", "## Console warnings (not failures)"); for (const w of R.errors.warnings.slice(0, 8)) L.push(`- ${w}`); }
  return L.join("\n") + "\n";
}

main().catch((e) => {
  console.error("[harness] crashed: " + (e && e.stack || e));
  try { fs.mkdirSync(path.resolve(A.out), { recursive: true }); fs.writeFileSync(path.join(path.resolve(A.out), "crash.txt"), String(e && e.stack || e)); } catch (x) { /* nothing left to do */ }
  process.exit(2);
});
