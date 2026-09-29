#!/usr/bin/env node
// Sapper's Path v3 harness (M2, updated for playtest 1's dispatch model). Headless Chromium via Playwright, real input for every play (a move is ONE tap on a
// front card, SPEC-v3 §3). Four viewports: 375×812 portrait phone (touch), 812×375 landscape phone (touch), 1280×720
// desktop (mouse), and a 400×600 iframe inside a portal-style host page (tools/iframe-host.html, mouse). Per viewport,
// on a fresh profile:
//   portal shape: every request same-origin (no external requests), payload bytes, load-to-gameplay time and clicks
//   (the title's Play is the one click), no page scrollbars on the title, map and level, primary buttons hittable;
//   SP.selfTest(); level 1's coach line and arrow; a patient win on level 1 through the card buttons (tap, then wait
//   until every squad is home), the goblin, the win panel, Next reaches level 2; a rushed overflow loss through the
//   cards (a patient prefix, then three taps with squads still out), the fail sheet only once they settle, one Retry tap
//   restarts; live frame times with three rapid taps on levels 65 and 70 at 1x and 2x, and the draw cost; the Era 3
//   board's CSS px per cell (8 or more required);
//   pause and resume: on window blur (a real focus change to the host page in the iframe run) and on a hidden tab,
//   the clock stops, the Paused sheet takes the next tap, the game resumes without a jump and no card is played;
//   the map button; a garbage save loads clean.
// Then a hidden-tab load (document.hidden faked, rAF held, driven by SP.tick) that runs selfTest and wins a level.
// Zero console errors AND warnings anywhere.
// Screenshots (default tools/shots-v3-playtest1/): 375×812 level 1 teach, level 26 gate teach, level 51 archer hit, the
// win mid-collapse and the goblin fleeing, a fail; 375 and 1280: two and three overlapping squads mid-show; frame
// strips (six frames 300 ms apart, stitched): a first squad still working while a second heads out, and level 3's
// "only what can reach goes, then the next round"; 812×375 an Era 3 board; the iframe mid-level.
//
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs [--url http://127.0.0.1:8491/sappers-path/] [--out tools/shots-v3-playtest1]
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
const OUT = resolve(arg("out", resolve(here, "shots-v3-playtest1")));
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

// Screens for playtest 1: two and three overlapping squads mid-show (the first still out), and two frame strips.
async function overlapShots(page, ev, tap, shot, tag, R) {
  const reach = () => ev(() => { const st = SP.state(), o = [], p = []; st.fronts.forEach((f, j) => { if (f) (SP.reachable(f.mat) > 0 ? o : p).push(j); }); return o.concat(p); });
  const hold = (ms) => ev((m) => { SP.tick(m); return SP.state(); }, ms);
  R.shots = R.shots || {};
  // Two, then three squads out on level 65.
  await ev(() => { SP.fast(false); SP.load(65, "normal"); });
  let cols = await reach(); await tap(`.card[data-col="${cols[0]}"]`); await hold(700);
  cols = await reach(); if (cols.length) await tap(`.card[data-col="${cols[0]}"]`); let st = await hold(700);
  await shot("two-squads"); R.shots.two = { spaces: st.line.length, runners: st.runners };
  cols = await reach(); if (cols.length) await tap(`.card[data-col="${cols[0]}"]`); st = await hold(500);
  await shot("three-squads"); R.shots.three = { spaces: st.line.length, runners: st.runners };
  if (tag !== "375") return;
  // Frame strips: six frames 300 ms apart (engine time), the board region only, stitched side by side.
  const board = await page.locator("#board").boundingBox(), clip = { x: board.x, y: board.y, width: board.width, height: board.height };
  const strip = async (name, setup) => {
    await setup(); const bufs = [];
    for (let k = 0; k < 6; k++) { bufs.push(await page.screenshot({ clip })); await hold(300); }
    R.shots[name] = await stitch(page, bufs, resolve(OUT, tag + "-" + name + ".png"));
  };
  await strip("strip-overlap", async () => { await ev(() => SP.load(65, "normal")); const c = await reach(); await tap(`.card[data-col="${c[0]}"]`); await hold(1800); const c2 = await reach(); if (c2.length) await tap(`.card[data-col="${c2[0]}"]`); await hold(60); });
  await strip("strip-next-round", async () => { await ev(() => SP.load(3, "normal")); const c = await ev(() => SP.state().fronts.findIndex((f) => f && f.crew === "Sawyers")); await tap(`.card[data-col="${c}"]`); await hold(200); });
}
// Stitch PNG buffers side by side on a canvas in a scratch page; writes the file, returns its size.
async function stitch(page, bufs, file) {
  const ctx = page.context(), p = await ctx.newPage();
  const urls = bufs.map((b) => "data:image/png;base64," + b.toString("base64"));
  const out = await p.evaluate(async (list) => {
    const imgs = await Promise.all(list.map((u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; })));
    const gap = 6, w = imgs.reduce((s, i) => s + i.width + gap, -gap), h = Math.max(...imgs.map((i) => i.height)), c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.fillStyle = "#221a26"; g.fillRect(0, 0, w, h); let x = 0; for (const i of imgs) { g.drawImage(i, x, 0); x += i.width + gap; }
    return { url: c.toDataURL("image/png"), w, h };
  }, urls);
  writeFileSync(file, Buffer.from(out.url.split(",")[1], "base64")); await p.close();
  return { w: out.w, h: out.h };
}

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

      // A patient win through the cards: tap, then wait until every squad is home, then the next tap.
      const quiet = () => ev(() => { for (let i = 0; i < 6000 && SP.state().busy; i++) SP.tick(16); return SP.state(); });
      const win = await ev(() => SP.winOrder());
      for (const c of win) { await tap(`.card[data-col="${c}"]`); await quiet(); }
      s = await S();
      ok(s.status === "won" && s.plays === win.length && !s.busy, tag + " level 1 won patiently through the cards (" + s.status + ", " + s.plays + " plays)");
      s = await ev(() => SP.tick(1600));
      ok(s.goblin || s.panel === "win", tag + " the goblin flees once the squads are home");
      s = await ev(() => SP.tick(3000));
      ok(s.panel === "win" && (await L("#p-title").textContent()) === "Fort razed!", tag + " win panel");
      await page.waitForTimeout(400);
      await tap("#p-primary");
      s = await S();
      ok(s.n === 2 && s.status === "playing" && s.panel === null, tag + " Next level loads level 2");

      // A rushed loss through the cards: a patient prefix, then three taps while the squads are still out.
      const plan = await ev(() => { for (let n = 46; n <= 75; n++) { SP.load(n, "normal"); const p = SP.lossPlan(); if (p) return Object.assign({ n }, p); } return null; });
      if (ok(!!plan, tag + " found a rush that overflows on a late level")) {
        await ev((n) => SP.load(n, "normal"), plan.n);
        for (const c of plan.prefix) { await tap(`.card[data-col="${c}"]`); await quiet(); }
        for (const c of plan.rush) await tap(`.card[data-col="${c}"]`);
        s = await S();
        ok(s.status === "failed" && s.reason === "overflow" && s.panel === null, tag + " rushed taps overflow at the tap; the sheet waits for the squads (" + s.status + " " + s.reason + ", busy " + s.busy + ")");
        s = await ev(() => { for (let i = 0; i < 600 && !SP.state().panel; i++) SP.tick(16); return SP.state(); });
        ok(s.status === "failed" && s.reason === "overflow" && s.panel === "fail" && !s.busy, tag + " overflow fail sheet once the squads are home (" + s.status + " " + s.reason + ")");
        ok(/Too many squads/.test(await L("#p-line").textContent()), tag + " the fail panel names the reason (too many squads out)");
        await page.waitForTimeout(400);
        if (vp.shots === "375") await shot("fail");
        await tap("#p-primary");
        s = await S();
        ok(s.status === "playing" && s.plays === 0 && s.panel === null, tag + " one tap on Retry restarts");
        R.loss = plan;
      }

      // Three rapid taps on levels 65 and 70, at 1x and 2x: live frame times while the squads overlap, then the JS cost
      // of one draw at that moment.
      const rapid = async (n, fast) => {
        await ev((a) => { SP.load(a[0], "normal"); SP.fast(a[1]); }, [n, fast]);
        const cols = await ev(() => { const st = SP.state(), o = [], p = []; st.fronts.forEach((f, j) => { if (f) (SP.reachable(f.mat) > 0 ? o : p).push(j); }); return o.concat(p); });
        for (const c of cols.slice(0, 3)) await tap(`.card[data-col="${c}"]`);
        return ev(() => new Promise((res) => { const d = []; let last = performance.now(); const f = (t) => { d.push(t - last); last = t; if (d.length < 120) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ n: d.length, p50: +d[60].toFixed(1), p95: +d[113].toFixed(1), max: +d[119].toFixed(1), runners: SP.state().runners, spaces: SP.state().line.length }); } }; requestAnimationFrame(f); }));
      };
      R.frames = {};
      for (const n of [65, 70]) for (const fast of [false, true]) {
        const fr = await rapid(n, fast); R.frames["L" + n + (fast ? " 2x" : " 1x")] = fr;
        ok(fr.p95 < 25 && fr.spaces >= 2, tag + " frame time with overlapping squads, level " + n + (fast ? " 2x" : " 1x") + " (p95 " + fr.p95 + " ms, " + fr.runners + " runners, " + fr.spaces + " squads)");
      }
      await ev(() => { SP.fast(false); SP.load(70, "normal"); });
      { const cols = await ev(() => { const st = SP.state(), o = []; st.fronts.forEach((f, j) => { if (f && SP.reachable(f.mat) > 0) o.push(j); }); return o; }); for (const c of cols.slice(0, 3)) await tap(`.card[data-col="${c}"]`); }
      await ev(() => SP.tick(900));
      const perf = await ev(() => SP.perf(120));
      R.midShow = { perf };
      ok(perf.runners >= 3, tag + " runners are out mid-show (" + JSON.stringify(perf) + ")");
      ok(perf.mean < 4 && perf.max < 12, tag + " draw cost mid-show (mean " + perf.mean + " ms, max " + perf.max + " ms)");
      if (vp.shots === "iframe") await shot("mid-show");
      if (vp.shots === "375" || vp.shots === "1280") await overlapShots(page, ev, tap, shot, vp.shots, R);
      await ev(() => SP.settle());

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
    const won = await page.evaluate(() => { SP.load(10, "hard"); for (const c of SP.winOrder()) { SP.play(+c); for (let i = 0; i < 6000 && SP.state().busy; i++) SP.tick(16); } return SP.tick(9000); });
    const spr = await page.evaluate(() => SP.sprites());
    report.hidden = { selfTest: { pass: st.pass, fail: st.fail, ms: st.ms }, panel: won.panel, sprites: spr };
    ok(st.fail.length === 0, "hidden selfTest: " + st.fail.join("; "));
    ok(won.status === "won" && won.panel === "win", "hidden: level 10 on Hard won patiently and its panel shown on SP.tick alone");
    ok(spr.length === 0, "hidden: sprite caches opaque (" + spr.join(",") + ")");
    await ctx.close();
  } finally { await browser.close(); }
  ok(report.console.length === 0, "console errors/warnings: " + report.console.length);
}

run().then(() => {
  writeFileSync(resolve(OUT, "harness-report.json"), JSON.stringify(report, null, 1));
  const brief = {}; for (const [k, R] of Object.entries(report.runs)) brief[k] = { selfTest: R.selfTest && R.selfTest.pass + " pass, " + R.selfTest.fail.length + " fail", titleReadyMs: R.titleReadyMs, loadToGameplayMs: R.loadToGameplayMs, clicks: R.clicksToGameplay, era3: R.era3MinCellCss, frames: R.frames, draw: R.midShow && R.midShow.perf, shots: R.shots, pause: R.pause, requests: R.requests, payloadBytes: R.payloadBytes };
  console.log(JSON.stringify({ runs: brief, hidden: report.hidden, console: report.console }, null, 1));
  console.log(report.fails.length ? "HARNESS: " + report.fails.length + " failure(s)" : "HARNESS: all passed");
  clearTimeout(wall); process.exit(report.fails.length ? 1 : 0);
}).catch((e) => { console.error("harness crashed: " + (e && e.stack || e)); clearTimeout(wall); process.exit(2); });
