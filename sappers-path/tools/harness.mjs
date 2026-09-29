#!/usr/bin/env node
// Sapper's Path v3 M2 harness. Headless Chromium via Playwright, real input for every play (a move is ONE tap on a
// front card, SPEC-v3 §3). Four viewports: 375×812 portrait phone (touch), 812×375 landscape phone (touch), 1280×720
// desktop (mouse), and a 400×600 iframe inside a portal-style host page (tools/iframe-host.html, mouse). Per viewport,
// on a fresh profile:
//   portal shape: every request same-origin (no external requests), payload bytes, load-to-gameplay time and clicks
//   (the title's Play is the one click), no page scrollbars on the title, map and level, primary buttons hittable;
//   SP.selfTest(); level 1's coach line and arrow; a win on level 1 through the card buttons, the goblin, the win panel,
//   Next reaches level 2; an overflow loss through the cards, the fail panel names it, one Retry tap restarts; a live
//   frame sample and the draw cost on the busiest play; the Era 3 board's CSS px per cell (8 or more required);
//   pause and resume: on window blur (a real focus change to the host page in the iframe run) and on a hidden tab,
//   the clock stops, the Paused sheet takes the next tap, the game resumes without a jump and no card is played;
//   the map button; a garbage save loads clean.
// Then a hidden-tab load (document.hidden faked, rAF held, driven by SP.tick) that runs selfTest and wins a level.
// Zero console errors AND warnings anywhere.
// Screenshots (tools/shots-v3-m2/): 375×812 level 1 teach, level 26 gate teach, level 51 archer hit mid-animation, the
// win mid-collapse and the goblin fleeing, a fail; 812×375 an Era 3 board; 1280×720 mid-show; the iframe mid-level.
//
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs [--url http://127.0.0.1:8491/sappers-path/] [--out tools/shots-v3-m2]
//
// Exit 0: every assertion passed. Exit 1: an assertion or console message. Exit 2: the harness crashed or ran out of
// time. Every page.evaluate is a short call; every wait has its own timeout; the whole run has a wall budget.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/");
const ORIGIN = new URL(URL_).origin;
const OUT = resolve(arg("out", resolve(here, "shots-v3-m2")));
const WALL_MS = 420000, MIN_CELL = 8;
mkdirSync(OUT, { recursive: true });
const wall = setTimeout(() => { console.error("harness: wall budget exceeded"); process.exit(2); }, WALL_MS);

async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright"].filter(Boolean)) { try { return await import(m); } catch (e) { /* next */ } }
  throw new Error("playwright not found: set PLAYWRIGHT_MODULE to its index.mjs");
}
const report = { url: URL_, runs: {}, hidden: null, fails: [], console: [] };
const fail = (m) => { report.fails.push(m); console.log("FAIL " + m); };
const ok = (c, m) => { if (!c) fail(m); return !!c; };
const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812, touch: true, dpr: 2, shots: "375" },
  { name: "812x375", width: 812, height: 375, touch: true, dpr: 3, shots: "812" },
  { name: "1280x720", width: 1280, height: 720, touch: false, dpr: 1, shots: "1280" },
  { name: "iframe-400x600", width: 480, height: 700, touch: false, dpr: 2, shots: "iframe", iframe: { w: 400, h: 600 } },
];

async function run() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      const R = (report.runs[vp.name] = {}), tag = vp.name;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch });
      const page = await ctx.newPage();
      const reqs = []; let bytes = 0;
      page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push(tag + " " + m.type() + ": " + m.text()); });
      page.on("pageerror", (e) => report.console.push(tag + " pageerror: " + e.message));
      page.on("request", (r) => reqs.push(r.url()));
      page.on("requestfinished", async (r) => { try { const s = await r.sizes(); bytes += s.responseBodySize + s.responseHeadersSize; } catch (e) { /* not counted */ } });
      const t0 = Date.now();
      let F;
      if (vp.iframe) {
        await page.goto(URL_ + "tools/iframe-host.html?w=" + vp.iframe.w + "&h=" + vp.iframe.h, { waitUntil: "load" });
        const fh = await page.waitForSelector("#game", { timeout: 10000 });
        for (let k = 0; k < 100 && !(F = await fh.contentFrame()); k++) await page.waitForTimeout(50);
      } else { await page.goto(URL_ + "?debug=1", { waitUntil: "load" }); F = page.mainFrame(); }
      await F.waitForFunction(() => window.SP && document.querySelector("#title:not([hidden])"), null, { timeout: 15000 });
      R.titleReadyMs = Date.now() - t0;
      const L = (sel) => (vp.iframe ? page.frameLocator("#game").locator(sel) : page.locator(sel)).first();
      const tap = async (sel) => { const l = L(sel); if (vp.touch) await l.tap({ timeout: 5000 }); else await l.click({ timeout: 5000 }); };
      const ev = (fn, a) => F.evaluate(fn, a);
      const S = () => ev(() => SP.state());
      const noScroll = () => ev(() => { const d = document.documentElement; return d.scrollWidth <= d.clientWidth && d.scrollHeight <= d.clientHeight && document.body.scrollHeight <= d.clientHeight; });
      const hit = (sel) => ev((sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t)); }, sel);
      const shot = (name) => page.screenshot({ path: resolve(OUT, vp.shots + "-" + name + ".png") });

      // Portal shape: one click from load to gameplay.
      ok(await noScroll(), tag + " title: no scrollbars");
      ok(await hit("#btn-play"), tag + " title Play is hittable");
      await tap("#btn-play"); let clicks = 1;
      await F.waitForFunction(() => SP.state().screen === "play", null, { timeout: 5000 });
      R.loadToGameplayMs = Date.now() - t0; R.clicksToGameplay = clicks;
      let s = await S();
      ok(s.screen === "play" && s.n === 1 && s.status === "playing", tag + " title Play reaches level 1 in one tap (" + s.screen + " " + s.n + ")");
      ok(R.loadToGameplayMs < 20000, tag + " load to gameplay under 20 s (" + R.loadToGameplayMs + " ms)");
      ok(await noScroll(), tag + " level: no scrollbars");
      // Level 1's coach: one line and the arrow on a card.
      const co = await ev(() => SP.coach());
      ok(co.on && co.hand && co.oneLine && /card/.test(co.target || ""), tag + " level 1: the coach line and its arrow on a card (" + JSON.stringify(co) + ")");
      await page.waitForTimeout(350);
      if (vp.shots === "375") await shot("teach-l1");

      // selfTest (every check through the play entry point), then back to level 1.
      const st = await ev(() => SP.selfTest());
      R.selfTest = { pass: st.pass, fail: st.fail, ms: st.ms, notes: st.notes };
      ok(st.fail.length === 0, tag + " selfTest: " + st.fail.join("; "));
      await ev(() => SP.load(1, "normal"));

      // A win through the cards.
      const win = await ev(() => SP.winOrder());
      for (const c of win) await tap(`.card[data-col="${c}"]`);
      s = await S();
      ok(s.status === "won" && s.plays === win.length, tag + " level 1 won through the cards (" + s.status + ", " + s.plays + " plays)");
      s = await ev(() => SP.tick(3200));
      ok(s.goblin || s.panel === "win", tag + " the goblin flees after the last pixel");
      s = await ev(() => SP.tick(3000));
      ok(s.panel === "win" && (await L("#p-title").textContent()) === "Fort razed!", tag + " win panel");
      await page.waitForTimeout(400);
      await tap("#p-primary");
      s = await S();
      ok(s.n === 2 && s.status === "playing" && s.panel === null, tag + " Next level loads level 2");

      // A loss through the cards: an overflow on a late level.
      await ev(() => SP.load(46, "normal"));
      const loss = await ev(() => SP.lossOrder());
      if (ok(!!loss, tag + " found an overflow order on level 46")) {
        for (const c of loss) await tap(`.card[data-col="${c}"]`);
        s = await ev(() => SP.tick(4000));
        ok(s.status === "failed" && s.reason === "overflow" && s.panel === "fail", tag + " overflow fail through the cards (" + s.status + " " + s.reason + ")");
        ok(/overflow/.test(await L("#p-line").textContent()), tag + " the fail panel names the reason");
        await page.waitForTimeout(400);
        if (vp.shots === "375") await shot("fail");
        await tap("#p-primary");
        s = await S();
        ok(s.status === "playing" && s.plays === 0 && s.panel === null, tag + " one tap on Retry restarts");
        R.loss = loss;
      }

      // Mid-show on the busiest play: live frame times, then the JS cost of one draw at that moment.
      const bz = await ev(() => SP.busiest());
      const playTo = async () => { await ev((n) => SP.load(n, "normal"), bz.n); const o = await ev(() => SP.winOrder()); for (let i = 0; i < bz.i; i++) { await tap(`.card[data-col="${o[i]}"]`); await ev(() => SP.tick(3500)); } await tap(`.card[data-col="${o[bz.i]}"]`); };
      await playTo();
      R.frames = await ev(() => new Promise((res) => { const d = []; let last = performance.now(); const f = (t) => { d.push(t - last); last = t; if (d.length < 60) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ n: d.length, p50: +d[30].toFixed(1), p95: +d[57].toFixed(1), max: +d[59].toFixed(1) }); } }; requestAnimationFrame(f); }));
      ok(R.frames.p95 < 25, tag + " frame time during the busiest live show (p95 " + R.frames.p95 + " ms)");
      await playTo();
      await ev(() => SP.tick(1250));
      const perf = await ev(() => SP.perf(120));
      R.midShow = { level: bz.n, play: bz.i, perf };
      ok(perf.launched >= 20, tag + " the busiest play has its runners out (" + JSON.stringify(perf) + ")");
      ok(perf.mean < 4 && perf.max < 12, tag + " draw cost mid-show (mean " + perf.mean + " ms, max " + perf.max + " ms)");
      if (vp.shots === "1280" || vp.shots === "iframe") await shot("mid-show");
      await ev(() => SP.tick(4000));

      // Era 3's biggest board: CSS px per cell (turned a quarter on a landscape phone).
      const big = await ev(() => { let b = null; for (let n = 51; n <= 75; n++) { SP.load(n, "normal"); const s = SP.state(); if (!b || s.cs / devicePixelRatio < b.px) b = { n, px: +(s.cs / devicePixelRatio).toFixed(2), turned: document.body.classList.contains("turned") }; } return b; });
      R.era3MinCellCss = big;
      ok(big.px >= MIN_CELL, tag + " Era 3 boards keep " + MIN_CELL + " CSS px a cell or more (smallest: level " + big.n + ", " + big.px + " px" + (big.turned ? ", turned" : "") + ")");
      if (vp.shots === "812") { await ev((n) => SP.load(n, "normal"), big.n); await page.waitForTimeout(300); await shot("era3"); }
      ok(await noScroll(), tag + " Era 3 level: no scrollbars");

      // Pause on blur, resume with one tap on the Paused sheet: no clock jump, no card played.
      await ev(() => SP.load(3, "normal"));
      if (vp.iframe) { await L("#board").click({ timeout: 5000, force: true }); await page.locator("#host-btn").click(); }
      else await ev(() => window.dispatchEvent(new Event("blur")));
      await page.waitForTimeout(60);
      const c1 = await S(); await page.waitForTimeout(450); const c2 = await S();
      ok((await ev(() => SP.paused())) && c1.clock === c2.clock && (await hit("#pause")) && !(await hit(".card")), tag + " blur pauses: the clock stops and the Paused sheet covers the cards (" + c1.clock + " → " + c2.clock + ")");
      await tap("#pause"); await page.waitForTimeout(300); const c3 = await S();
      ok(!(await ev(() => SP.paused())) && c3.plays === 0 && c3.clock > c2.clock && c3.clock - c2.clock < 1000, tag + " one tap resumes, no jump (" + (c3.clock - c2.clock) + " ms over ~300 ms), no card played");
      // A hidden tab pauses too.
      await ev(() => { Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
      const h1 = await S(); await page.waitForTimeout(300); const h2 = await S();
      ok((await ev(() => SP.paused())) && h1.clock === h2.clock, tag + " a hidden tab pauses the clock");
      await ev(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
      await tap("#pause"); ok(!(await ev(() => SP.paused())), tag + " back from a hidden tab: one tap resumes");
      R.pause = { blurFrozen: c1.clock === c2.clock, resumeDeltaMs: c3.clock - c2.clock };

      // Map through its button.
      await tap("#btn-map");
      s = await S();
      ok(s.screen === "map" && (await hit("#map-play")) && (await noScroll()), tag + " map button; map Play hittable; no scrollbars");

      // Screens for the critics (portrait phone): the gate teach, an archer hit mid-animation, the win's collapse and goblin.
      if (vp.shots === "375") {
        await ev(() => { SP.load(26, "normal"); SP.play(0); SP.tick(3500); });
        await page.waitForTimeout(250); await shot("teach-l26-gate");
        await ev(() => { SP.play(1); for (let i = 0; i < 400; i++) { SP.tick(16); if (SP.fx().gates[0] === 1) break; } SP.tick(100); });
        await shot("gate-opening");
        await ev(() => { SP.load(51, "normal"); SP.play(2); for (let i = 0; i < 400; i++) { SP.tick(16); if (SP.hits().struck) break; } SP.tick(120); });
        const hh = await ev(() => SP.hits()); ok(hh.struck > 0 && hh.label, tag + " level 51: an arrow has struck mid-show");
        await shot("archer-hit");
        await ev(() => { SP.load(2, "normal"); const o = SP.winOrder(); for (let i = 0; i < o.length - 1; i++) SP.play(+o[i]); SP.skip(); SP.play(+o[o.length - 1]); for (let i = 0; i < 400; i++) { SP.tick(16); if (SP.fx().falls > 4) break; } SP.tick(60); });
        await shot("win-collapse");
        await ev(() => { for (let i = 0; i < 400 && !SP.state().goblin; i++) SP.tick(16); SP.tick(700); });
        await shot("win-goblin");
      }

      // Portal: nothing but this origin (and data: URLs) was requested; payload.
      const ext = reqs.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:"));
      R.requests = reqs.length; R.payloadBytes = bytes; R.external = ext;
      ok(ext.length === 0, tag + " no external requests (" + ext.join(", ") + ")");

      // Mute persists in the save; then a garbage save loads clean.
      if (!vp.iframe) {
        await ev(() => SP.load(1, "normal")); await tap("#top .tog-mute");
        await page.reload({ waitUntil: "load" }); await page.waitForFunction(() => window.SP, null, { timeout: 15000 });
        ok((await page.getAttribute("#top .tog-mute", "aria-pressed")) === "true", tag + " mute persists across a reload");
        await page.evaluate(() => localStorage.setItem("sappers-path.v3", '{"v":1,"done":{"e1-01":7,"e3-75":7,"x":9},"settings":{"diff":"nightmare","muted":"yes"},"last":"e3-75"}'));
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(() => window.SP, null, { timeout: 15000 });
        s = await S();
        ok(s.done === 1 && s.diff === "normal", tag + " sanitize: only reachable wins survive, bad difficulty clamps (" + s.done + " " + s.diff + ")");
      }
      await ctx.close();
    }

    // Hidden-tab load: rAF never fires, document.hidden is true; everything must still run on SP.tick.
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => {
      Object.defineProperty(document, "hidden", { get: () => true, configurable: true });
      Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
      window.requestAnimationFrame = () => 0;
    });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push("hidden " + m.type() + ": " + m.text()); });
    page.on("pageerror", (e) => report.console.push("hidden pageerror: " + e.message));
    await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
    await page.waitForFunction(() => window.SP, null, { timeout: 15000 });
    const st = await page.evaluate(() => SP.selfTest());
    const won = await page.evaluate(() => { SP.load(10, "hard"); for (const c of SP.winOrder()) SP.play(+c); return SP.tick(9000); });
    const spr = await page.evaluate(() => SP.sprites());
    report.hidden = { selfTest: { pass: st.pass, fail: st.fail, ms: st.ms }, panel: won.panel, sprites: spr };
    ok(st.fail.length === 0, "hidden selfTest: " + st.fail.join("; "));
    ok(won.status === "won" && won.panel === "win", "hidden: level 10 on Hard won and its panel shown on SP.tick alone");
    ok(spr.length === 0, "hidden: sprite caches opaque (" + spr.join(",") + ")");
    await ctx.close();
  } finally { await browser.close(); }
  ok(report.console.length === 0, "console errors/warnings: " + report.console.length);
}

run().then(() => {
  writeFileSync(resolve(OUT, "harness-report.json"), JSON.stringify(report, null, 1));
  const brief = {}; for (const [k, R] of Object.entries(report.runs)) brief[k] = { selfTest: R.selfTest && R.selfTest.pass + " pass, " + R.selfTest.fail.length + " fail", titleReadyMs: R.titleReadyMs, loadToGameplayMs: R.loadToGameplayMs, clicks: R.clicksToGameplay, era3: R.era3MinCellCss, frames: R.frames, draw: R.midShow && R.midShow.perf, pause: R.pause, requests: R.requests, payloadBytes: R.payloadBytes };
  console.log(JSON.stringify({ runs: brief, hidden: report.hidden, console: report.console }, null, 1));
  console.log(report.fails.length ? "HARNESS: " + report.fails.length + " failure(s)" : "HARNESS: all passed");
  clearTimeout(wall); process.exit(report.fails.length ? 1 : 0);
}).catch((e) => { console.error("harness crashed: " + (e && e.stack || e)); clearTimeout(wall); process.exit(2); });
