#!/usr/bin/env node
// Peasant Swarm verification harness. Headless Chromium via Playwright: PS.selfTest(), a PS.fight matrix, N scripted-player
// matches advanced with PS.step, sim cost per chunk, live rAF render timing, screenshots, and (--mobile) a real CDP touch drag.
//
//   node tools/harness.mjs --url http://127.0.0.1:8471/peasant-swarm/ --out <dir> [--mobile] [--sim 240] [--seeds 3]
//                          [--difficulty normal] [--viewport 1280x720] [--fights 30x20,40x20,20x20,25x20] [--fight-runs 5] [--render-secs 3]
//                          [--seed N] [--cap touch|desktop] [--v1-url <v1 reference build>] [--bench-reps 3] [--ai-matches 3]
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
    viewport: "1280x720", fights: "30x20,40x20,20x20,25x20", fightRuns: 5, fightMax: 40, renderSecs: 3, seed: null, cap: null, v1Url: null, benchReps: 3, aiMatches: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--mobile") { o.mobile = true; continue; }
    const key = { "--url": "url", "--out": "out", "--sim": "sim", "--seeds": "seeds", "--difficulty": "difficulty", "--viewport": "viewport",
      "--fights": "fights", "--fight-runs": "fightRuns", "--fight-max": "fightMax", "--render-secs": "renderSecs", "--seed": "seed", "--cap": "cap",
      "--v1-url": "v1Url", "--bench-reps": "benchReps", "--ai-matches": "aiMatches" }[k];
    if (!key) { console.error("unknown arg " + k); process.exit(2); }
    o[key] = typeof o[key] === "number" || key === "seed" ? +v : v; i++;
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
    // scripted player: flee a rival > flee x our size within sight, else hunt a rival < hunt x our size within sight, else the camp nearest
    // by path. It routes itself: one BFS over PS.terrain from its centroid cell, then the furthest cell (<= 16 steps) along the path it can
    // see in a straight line becomes the swarm's target. Harness-only: the game's own swarms seek directly until M2 brings flow fields.
    policy(o) {
      const S = window.PSS, p = S && S.teams[1]; if (!p || p.count === 0) return "idle";
      const T = window.PS.terrain, W = S.cfg.world.w, H = S.cfg.world.h, cl = (v, a, b) => (v < a ? a : v > b ? b : v);
      let fl = null, fd = Infinity, hu = null, hd = Infinity;
      for (let i = 2; i < S.teams.length; i++) {
        const r = S.teams[i]; if (!r.alive || r.count === 0) continue;
        const d = Math.hypot(r.cx - p.cx, r.cy - p.cy); if (d > o.sight) continue;
        if (r.count > o.flee * p.count) { if (d < fd) { fl = r; fd = d; } } else if (r.count < o.hunt * p.count && d < hd) { hu = r; hd = d; }
      }
      this.bfs(p.cx, p.cy);
      let gx, gy, act;
      if (fl) { const dx = p.cx - fl.cx, dy = p.cy - fl.cy, d = Math.hypot(dx, dy) || 1; gx = cl(p.cx + (dx / d) * o.fleeDist, 40, W - 40); gy = cl(p.cy + (dy / d) * o.fleeDist, 40, H - 40); act = "flee"; }
      else if (hu) { gx = hu.cx; gy = hu.cy; act = "hunt"; }
      else {
        let best = null, bd = Infinity;
        for (const c of S.camps) { if (!c.n) continue; const k = T.cellOf(c.x, c.y), d = k >= 0 ? this.D[k] : -1; if (d >= 0 && d < bd) { bd = d; best = c; } }
        if (best) { gx = best.x; gy = best.y; act = "camp"; } else { gx = W / 2; gy = H / 2; act = "idle"; }
      }
      const g = T.snapXY(gx, gy), w = this.waypoint(p.cx, p.cy, g.x, g.y); p.tx = w[0]; p.ty = w[1];
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
    see(x0, y0, x1, y1) { const T = window.PS.terrain, l = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(l / 8); for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (!T.walkable(x, y) || T.sdfAt(x, y) < 10) return false; } return true; },
    waypoint(x, y, gx, gy) {
      const T = window.PS.terrain, m = T.map, N = m.N, cell = m.cell, g = T.cellOf(gx, gy);
      if (this.see(x, y, gx, gy) || g < 0 || this.D[g] < 0) return [gx, gy];
      const path = []; for (let c = g, k = 0; c >= 0 && k < N * N; c = this.Pa[c], k++) path.push(c);
      path.reverse(); // root ... goal
      let best = path[Math.min(2, path.length - 1)];
      for (let i = Math.min(16, path.length - 1); i >= 2; i--) { const c = path[i], cx = ((c % N) + 0.5) * cell, cy = (((c / N) | 0) + 0.5) * cell; if (this.see(x, y, cx, cy)) { best = c; break; } }
      return [((best % N) + 0.5) * cell, (((best / N) | 0) + 0.5) * cell];
    },
    snapshot() {
      const S = window.PSS, z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z;
      let neutrals = 0, onScreen = 0;
      for (const a of S.agents) { if (a.team === 0) neutrals++; if (Math.abs(a.x - S.cam.x) < hw && Math.abs(a.y - S.cam.y) < hh) onScreen++; }
      const counts = {}; for (const t of S.teams.slice(1)) counts[t.name] = t.count;
      return { t: Math.round(S.t * 100) / 100, mode: S.mode, result: S.result, counts, alive: S.teams.slice(1).map((t) => t.alive), neutrals, total: S.agents.length, onScreen };
    },
  };
}

// one chunk: policy every POLICY_TICK, PS.step between decisions, stop at `until`, at maxSim sim-seconds, or at the wall guard
function runChunk(o) {
  const S = window.PSS, w0 = performance.now(), t0 = S.t, acts = { camp: 0, hunt: 0, flee: 0, idle: 0 };
  let stepMs = 0, steps = 0, peak = S.agents.length;
  while (S.mode === "play" && S.t < o.until - 1e-6 && S.t - t0 < o.maxSim - 1e-6 && performance.now() - w0 < o.wallMs) {
    acts[window.__psh.policy(o.policy)]++;
    const sec = Math.max(1 / 60, Math.min(o.tick, o.until - S.t, o.maxSim - (S.t - t0)));
    const a = performance.now(); window.PS.step(sec); stepMs += performance.now() - a; steps++;
    if (S.agents.length > peak) peak = S.agents.length;
  }
  return { t: S.t, simSec: S.t - t0, stepMs, steps, peak, acts, mode: S.mode, wallMs: performance.now() - w0 };
}

// live rAF timing for `ms` of wall time; the scripted player keeps steering every ~0.5 s so the swarm isn't parked
function renderWindow(o) {
  return new Promise((res) => {
    const S = window.PSS, t0 = performance.now(), st0 = S.t, gaps = [], acts = { camp: 0, hunt: 0, flee: 0, idle: 0 };
    let last = 0, n = 0, nextPolicy = 0;
    const f = (ts) => {
      if (last) gaps.push(ts - last); last = ts; n++;
      const now = performance.now();
      if (S.mode === "play" && now >= nextPolicy) { acts[window.__psh.policy(o.policy)]++; nextPolicy = now + 500; }
      if (now - t0 < o.ms) { requestAnimationFrame(f); return; }
      gaps.sort((a, b) => a - b);
      const avg = gaps.reduce((s, g) => s + g, 0) / Math.max(1, gaps.length);
      res({ frames: n, wallMs: now - t0, avgMs: avg, fps: 1000 / avg, p95Ms: gaps[Math.floor(gaps.length * 0.95)] || 0, maxMs: gaps[gaps.length - 1] || 0,
        gameFps: S.fps, simAdvance: S.t - st0, visibility: document.visibilityState, acts });
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
  await page.evaluate(() => window.PS.bench("capclash", { ticks: 60 }));
  const runs = []; for (let i = 0; i < reps; i++) runs.push(await page.evaluate(() => window.PS.bench("capclash")));
  await ctx.close();
  return { runs, errs };
}
const benchMed = (runs, k, q) => median(runs.map((r) => r[k][q]));

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
    meta: { url: url.href, mode: tag, viewport: ctxOpts.viewport, deviceScaleFactor: ctxOpts.deviceScaleFactor, sim: A.sim, seeds: A.seeds, difficulty: A.difficulty, seed: A.seed, cap: A.cap, v1Url: A.v1Url,
      chromium: browser.version(), node: process.version, startedAt: new Date().toISOString(), policy: POLICY, chunkSim: CHUNK_SIM, policyTick: POLICY_TICK,
      cpus: os.cpus().length, loadAvgStart: os.loadavg().map(r2) }, // timings are only comparable at similar load: other sessions may share this machine
    errors: { console: [], page: [], filteredFontErrors: 0, warnings: [] },
    selfTest: null, fights: [], title: null, touch: null, huddle: null, runs: [], asserts: {}, notes: [], pass: false,
    bench: null, caches: null, aiMatches: [], outcomes: [], restart: null,
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
      else if (m.type() === "warning" && !warnSeen.has(m.text())) { warnSeen.add(m.text()); report.errors.warnings.push(m.text().slice(0, 300)); }
      else if (m.type() === "log" && m.text().startsWith("[PS.selfTest]")) report.notes.push("run " + (ri + 1) + " console: " + m.text());
    });
    page.on("pageerror", (e) => report.errors.page.push({ run: ri + 1, text: String(e.message || e) }));
    const bootReady = () => !!(window.PS && window.PS.selfTest && window.PS.step && window.PSS && window.PSS.teams && window.PSS.teams.length > 1);
    const run = { index: ri + 1, timeline: [], chunks: [], render: [], screenshots: {}, policy: { camp: 0, hunt: 0, flee: 0, idle: 0 } };
    report.runs.push(run);

    let b0 = Date.now();
    await page.goto(runUrl(ri));
    await page.waitForFunction(bootReady, null, { timeout: 15000 });
    run.bootMs = Date.now() - b0;

    if (ri === 0) {
      // selfTest on the title screen before any match, then the fight matrix (each call is its own evaluate, well under 15 s)
      // one evaluate per part so each stays well under ~15 s of wall time (lesson 20); the merged verdict is the selfTest verdict
      const s0 = Date.now(), st = { pass: true, fails: [], results: {}, partMs: {}, wallMs: 0 };
      for (const part of ["config", "sprites", "terrain", "caches", "fight", "replay", "match"]) {
        const p0 = Date.now(), r = await page.evaluate((part) => window.PS.selfTest({ parts: part }), part);
        st.partMs[part] = Date.now() - p0; Object.assign(st.results, r.results); for (const f of r.fails) if (st.fails.indexOf(f) < 0) st.fails.push(f);
      }
      st.pass = st.fails.length === 0; st.wallMs = Date.now() - s0; report.selfTest = st;
      // hidden-tab proxy: blank every cache the way a discarded backing store does, fire visibilitychange, let the frame loop re-bake
      const drop = await page.evaluate(() => { const n = window.PS.debugDropCaches(); const mid = window.PS.cacheReport(); document.dispatchEvent(new Event("visibilitychange")); return { dropped: n, blankAfterDrop: mid.chunksBlank.length + mid.spritesBlank.length }; });
      let cr = null; for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); cr = await page.evaluate(() => window.PS.cacheReport()); if (cr.ok) break; }
      report.caches = { ...drop, after: cr, recovered: !!(cr && cr.ok) };
      report.terrainTitle = await page.evaluate(() => window.PS.terrain.report());
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
        const c = await page.evaluate(runChunk, { until: stop, maxSim: CHUNK_SIM, tick: POLICY_TICK, wallMs: EVAL_WALL_MS, policy: POLICY });
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
          mainThreadMsPerFrame: r2(busyMs), scriptMsPerFrame: r2(scriptMs), gameFps: rw.gameFps, simAdvance: r2(rw.simAdvance), wallMs: Math.round(rw.wallMs), visibility: rw.visibility });
      }
    }
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
      return { mode: S.mode, result: S.result, t: Math.round(S.t * 100) / 100, overlay: ov ? ov.id : null, reason: ov ? ov.querySelector("p").textContent : null, counts, stats: { ...S.stats } };
    });
    run.screenshots.end = await shot(page, `run${ri + 1}-end`);
    run.maxAgents = maxAgents;
    run.agentCap = await page.evaluate(() => window.PSS.cap);
    run.dbg = await page.evaluate(() => ({ ...window.PSS.dbg }));
    report.outcomes.push({ run: ri + 1, result: run.end.result, forced: run.endForced, how: run.end.reason });

    if (ri === 0 && run.end.overlay) {
      // restart: the end screen's primary button must be what a pointer hits, and pressing it must start a fresh match
      const btnId = run.end.overlay === "ov-win" ? "btn-again" : "btn-retry";
      const hitBtn = (id) => page.evaluate((id) => { const b = document.getElementById(id), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y); return { x, y, hit: !!e && (e === b || b.contains(e)) }; }, id);
      const press = async (id) => { const h = await hitBtn(id); if (A.mobile) await page.touchscreen.tap(h.x, h.y); else await page.mouse.click(h.x, h.y); await page.waitForFunction(() => window.PSS.mode === "play", null, { timeout: 5000 }).catch(() => {}); return h; };
      const h = await press(btnId);
      const after = await page.evaluate(() => ({ mode: window.PSS.mode, t: window.PSS.t, seed: window.PSS.seed, agents: window.PSS.agents.length, map: window.PS.terrain.report().used }));
      report.restart = { button: btnId, hit: h.hit, ...after, ok: h.hit && after.mode === "play" && after.t < 2 };
      if (report.restart.ok) {
        // idle-player loss: nobody steers the player for 40 s (AIs recruit their starter camps), then the bell rings: the player must lose
        await page.evaluate(() => window.PS.step(30)); await page.evaluate(() => window.PS.step(10));
        const pre = await page.evaluate(() => ({ counts: window.PSS.teams.slice(1).map((t) => t.count), dbg: { ...window.PSS.dbg } }));
        await page.evaluate(() => { window.PSS.timeLeft = 0.05; });
        for (let i = 0; i < 10; i++) { const m = await page.evaluate(() => { window.PS.step(0.5); return window.PSS.mode; }); if (m !== "play") break; }
        await page.waitForFunction(() => document.querySelector("#ov-win.active, #ov-lose.active"), null, { timeout: 5000 }).catch(() => {});
        const idle = await page.evaluate(() => { const ov = document.querySelector("#ov-win.active, #ov-lose.active"); return { result: window.PSS.result, overlay: ov ? ov.id : null, reason: ov ? ov.querySelector("p").textContent : null }; });
        run.screenshots.idleEnd = await shot(page, `run${ri + 1}-idle-end`);
        report.outcomes.push({ run: "idle", result: idle.result, forced: true, how: idle.reason, countsBeforeBell: pre.counts, terrainBad: pre.dbg.terrainBad });
        const h2 = idle.overlay ? await press(idle.overlay === "ov-win" ? "btn-again" : "btn-retry") : { hit: false };
        report.restart.second = { hit: h2.hit, mode: await page.evaluate(() => window.PSS.mode) };
      }
      // all-AI matches at the harness cap: per-tick no-agent-in-rock and cap counters over full 240 s matches
      for (let k = 0; k < A.aiMatches; k++) {
        const seed = ((A.seed != null && isFinite(A.seed) ? A.seed : 97) * 31 + k * 7919) >>> 0, cap = A.cap || (A.mobile ? "touch" : "desktop");
        const mres = await page.evaluate(([seed, cap]) => window.PS.simMatch(240, { seed, cap, wallMs: 12000 }), [seed, cap]);
        report.aiMatches.push({ seed, cap, agentCap: mres.agentCap, seconds: mres.seconds, end: mres.end, truncated: mres.truncated, wallMs: mres.wallMs, msPerTick: mres.msPerTick,
          maxTotal: mres.maxTotal, capOver: mres.capOver, terrainBad: mres.terrainBad, firstBad: mres.firstBad, exceptions: mres.exceptions, winner: mres.winner, map: mres.map,
          timeline: mres.timeline.map((x) => x.t + "s " + x.counts.join("/") + " n" + x.neutrals) });
      }
    }
    const costly = run.chunks.reduce((b, c) => (!b || c.peakAgents > b.peakAgents ? c : b), null);
    run.simCost = costly ? { atPeakAgents: costly.peakAgents, window: [costly.t0, costly.t1], msPerSimSec: costly.msPerSimSec,
      avgMsPerSimSec: r2(run.chunks.reduce((s, c) => s + c.stepMs, 0) / Math.max(1e-9, run.chunks.reduce((s, c) => s + c.simSec, 0))) } : null;
    const top = run.render.reduce((b, x) => (!b || x.total > b.total ? x : b), null);
    run.renderAtBusiest = top; run.worstRender = run.render.reduce((b, x) => (!b || x.fps < b.fps ? x : b), null);
    await ctx.close();
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
  as.agentCapRespected = report.runs.every((r) => r.maxAgents <= r.agentCap && r.dbg && r.dbg.capOver === 0) && report.aiMatches.every((m) => m.capOver === 0 && m.maxTotal <= m.agentCap);
  // M1 gates
  as.noAgentInRock = report.runs.every((r) => r.dbg && r.dbg.terrainBad === 0) && report.aiMatches.every((m) => m.terrainBad === 0) && report.outcomes.every((o) => !o.terrainBad);
  as.terrainWithinRerolls = report.runs.every((r) => r.terrain && r.terrain.rerolls <= 4) && !!(report.terrainTitle && report.terrainTitle.rerolls <= 4);
  as.cachesRecovered = !!(report.caches && report.caches.recovered && report.caches.blankAfterDrop > 0);
  as.restartWorks = !!(report.restart && report.restart.ok && report.restart.second && report.restart.second.hit && report.restart.second.mode === "play");
  as.idlePlayerLoses = report.outcomes.some((o) => o.run === "idle" && o.result === "lose");
  if (A.aiMatches > 0) as.aiMatchesClean = report.aiMatches.length === A.aiMatches && report.aiMatches.every((m) => m.exceptions.length === 0);
  if (report.bench && report.bench.ratio) { const q = report.bench.ratio; as.benchGate = q.updateP50 <= 1.1 && q.updateP90 <= 1.1 && q.drawP50 <= 1.1 && q.drawP90 <= 1.1; }
  if (report.bench) as.benchClean = report.bench.errors.length === 0 && [...report.bench.v2runs, ...report.bench.v1runs].every((b) => !b.terrainBad);
  if (A.mobile) {
    const t = report.touch || {}, h = report.huddle || {};
    as.touchLandsOnCanvas = t.target === "CANVAS#game";
    as.joyActive = !!t.joyActive; as.joyTargetMovedUp = !!t.movedUp; as.joyReleased = !!t.released;
    as.huddleVisible = !!(h.bodyTouch && h.visible); as.huddleReachable = !!h.reachable;
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
  for (const m of report.aiMatches) if (m.truncated) W.push(`AI match seed ${m.seed} hit its 12 s wall guard at ${m.seconds} sim-s`);
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
    if (b.ratio) L.push("", `v2 / v1: update p50 ${b.ratio.updateP50}, p90 ${b.ratio.updateP90}; draw p50 ${b.ratio.drawP50}, p90 ${b.ratio.drawP90} (gate <= 1.1)`);
  }
  if (R.caches) L.push("", "## Cache drop and recovery", "", `PS.debugDropCaches blanked ${R.caches.dropped} canvases (${R.caches.blankAfterDrop} read blank), visibilitychange fired; after: ${R.caches.after.chunksOpaque}/${R.caches.after.chunks} chunks opaque, ${R.caches.after.pending} pending, minimap ${R.caches.after.minimap}, blank sprites ${R.caches.after.spritesBlank.length}. Recovered: ${R.caches.recovered}.`);
  if (R.terrainTitle) L.push("", "## Terrain", "", `Title map: ${JSON.stringify(R.terrainTitle)}`);
  for (const r of R.runs) if (r.terrain) L.push(`Run ${r.index} map: seed ${r.terrain.seed}, used ${r.terrain.used}, rerolls ${r.terrain.rerolls}${r.terrain.fallback ? " (fallback)" : ""}, gen ${r.terrain.genMs} ms, blocked ${r.terrain.blocked}, rival ${r.terrain.fair.rival}, centre ${r.terrain.fair.centre}, detour ${r.terrain.fair.detour}, crossings ${r.terrain.crossings.join(" ")}; per-tick asserts: ${JSON.stringify(r.dbg)}`);
  if (R.restart) L.push("", "## Restart and outcomes", "", `Restart via ${R.restart.button}: hit ${R.restart.hit}, mode ${R.restart.mode}, t ${r2(R.restart.t)}, new map ${R.restart.map}. Second restart: ${JSON.stringify(R.restart.second)}.`);
  for (const o of R.outcomes) L.push(`- ${o.run === "idle" ? "idle player" : "run " + o.run}: **${o.result}**${o.forced ? " (bell rung early)" : ""} — ${o.how || ""}${o.countsBeforeBell ? " (counts before the bell " + o.countsBeforeBell.join("/") + ")" : ""}`);
  if (R.aiMatches.length) {
    L.push("", "## All-AI matches (PS.simMatch 240 s, per-tick asserts)", "", "| seed | cap | end | s | peak / cap | capOver | terrainBad | ms/tick | winner |", "|---|---|---|---|---|---|---|---|---|");
    for (const m of R.aiMatches) L.push(`| ${m.seed} | ${m.cap} | ${m.end}${m.truncated ? " (truncated)" : ""} | ${m.seconds} | ${m.maxTotal} / ${m.agentCap} | ${m.capOver} | ${m.terrainBad} | ${m.msPerTick} | ${m.winner ? m.winner.name + " " + m.winner.count : "-"} |`);
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
