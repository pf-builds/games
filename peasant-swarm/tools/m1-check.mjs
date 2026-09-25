#!/usr/bin/env node
// Peasant Swarm v3 M1 acceptance checks (SPEC-v3 §5, §9 M1 gates; R4 §6). Headless Chromium via Playwright, one fresh context per check.
//
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/m1-check.mjs --url http://127.0.0.1:8431/peasant-swarm/ \
//     --frame-host http://127.0.0.1:8432/ --frame-dir <dir served on that host> --out <dir> [--only cold,ads,crazy,dpr,busy,idle,audio,iframe]
//
// cold:   a cold load logs every request (zero off-origin), the portal log opens init, loadingStart, loadingStop, gameplayStart comes on the
//         first canvas input only and never twice in a row, canvas text measures in Baloo 2 / Nunito (not the fallback), screenshot.
// ads:    end screen PLAY AGAIN and the title's PLAY after match 1 both log gameplayStop, commercialBreak, gameplayStart; the first PLAY
//         of the session logs no commercialBreak.
// crazy:  ?portal=crazygames&useLocalSdk=true: the SDK loads (environment "local"), PLAY AGAIN shows the demo midgame, the master gain is
//         0 only while it shows (sampled every 100 ms), screenshots during and after.
// dpr:    375 x 812 touch at ?dpr=1.5 and ?dpr=1: the tier is pinned and the zoom table still starts at 0.5.
// busy:   DPR 2, after the first input and the grace: a 25 ms busy loop per frame steps 2 -> 1.5 (time recorded), then with the loop off
//         the tier never goes back up.
// idle:   DPR 2, the idle title at 4x CPU throttle for 12 s: no step.
// audio:  a console ctx.suspend() recovers on the next click; resume() stubbed to a no-op: two failed clicks, the third rebuilds and a
//         sound plays on the new bus; a hidden tab ramps the master gain to 0 and back.
// iframe: the game in an <iframe> served from another port at 640x360, 800x450, 907x510, 1216x684: HUD inside the frame, a resize
//         mid-match re-sizes the canvas, a click outside the frame pauses the match. Screenshots.
// Writes <out>/m1-check.json and PNGs; prints a one-line verdict per check. Exit 0 when every check passed.
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://127.0.0.1:8431/peasant-swarm/"), FRAME_HOST = arg("--frame-host", "http://127.0.0.1:8432/"), FRAME_DIR = arg("--frame-dir", null);
const OUT = arg("--out", "m1-out"), ONLY = (arg("--only", "cold,ads,crazy,dpr,busy,idle,audio,iframe")).split(",");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch();
const R = { base: BASE, at: new Date().toISOString(), checks: {}, errors: [] };
const u = (q) => { const x = new URL(BASE); for (const [k, v] of Object.entries(q || {})) x.searchParams.set(k, v); return x.href; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(opts, url) {
  const ctx = await browser.newContext(opts || { viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), reqs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") R.errors.push({ url, type: m.type(), text: m.text().slice(0, 300) }); });
  page.on("pageerror", (e) => R.errors.push({ url, type: "pageerror", text: String(e.message || e).slice(0, 300) }));
  page.on("request", (q) => reqs.push(q.url()));
  if (url) { await page.goto(url); await page.waitForFunction(() => !!(window.PS && window.PS.portal && window.PS.portal.log.includes("loadingStop")), null, { timeout: 20000 }); }
  return { ctx, page, reqs };
}
const center = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
async function clickSel(page, sel) { const [x, y] = await center(page, sel); await page.mouse.click(x, y); }
async function clickCanvas(page, fx = 0.62, fy = 0.55) { const v = page.viewportSize(); await page.mouse.click(Math.round(v.width * fx), Math.round(v.height * fy)); }
const log = (page) => page.evaluate(() => PS.portal.log.slice());
const noDoubles = (L) => L.every((e, i) => i === 0 || e !== L[i - 1]);
// the last index of the sub-sequence seq in L (in order, gaps allowed only between none: consecutive entries)
const hasRun = (L, seq) => { for (let i = 0; i + seq.length <= L.length; i++) if (seq.every((s, k) => L[i + k] === s)) return true; return false; };
async function endMatch(page) { // ring the bell now; the end screen follows on sim time
  await page.evaluate(() => { PSS.timeLeft = 0.02; });
  await page.waitForFunction(() => PSS.mode === "win" || PSS.mode === "lose", null, { timeout: 20000 });
  await sleep(300); return page.evaluate(() => PSS.mode);
}
function verdict(name, pass, detail) { R.checks[name] = { pass: !!pass, ...detail }; console.log((pass ? "PASS " : "FAIL ") + name + " " + JSON.stringify(detail).slice(0, 400)); }

try {
  if (ONLY.includes("cold")) {
    const { ctx, page, reqs } = await open(null, u({ debug: "1", seed: "7" }));
    const L0 = await log(page);
    await clickSel(page, "#btn-play"); await sleep(400); const L1 = await log(page);
    await clickCanvas(page); await sleep(200); await clickCanvas(page, 0.4, 0.4); await sleep(200); const L2 = await log(page);
    await page.keyboard.press("p"); await sleep(200); await page.keyboard.press("p"); await sleep(200); await clickCanvas(page); await sleep(900);
    const L3 = await log(page);
    const fonts = await page.evaluate(() => { const c = document.createElement("canvas").getContext("2d"), w = (f) => { c.font = f; return +c.measureText("PEASANT SWARM 0123 +45 JOIN YOU").width.toFixed(1); };
      return { baloo: w("800 30px 'Baloo 2', system-ui"), balooFallback: w("800 30px system-ui"), nunito: w("800 30px 'Nunito', system-ui"), nunitoFallback: w("800 30px system-ui"), check: [document.fonts.check('800 22px "Baloo 2"'), document.fonts.check("800 12px Nunito")], fontsOk: PSS.fontsOk }; });
    const shot = path.join(OUT, "m1-cold-first-match.png"); await page.screenshot({ path: shot });
    const origin = new URL(BASE).origin, off = reqs.filter((q) => !q.startsWith("data:") && !q.startsWith("blob:") && new URL(q).origin !== origin);
    verdict("cold_zero_off_origin", off.length === 0, { requests: reqs.length, offOrigin: off });
    verdict("portal_log_no_sdk", L0.join() === "init,loadingStart,loadingStop" && L1.join() === L0.join() && L2.filter((e) => e === "gameplayStart").length === 1 && L2[L2.length - 1] === "gameplayStart" && noDoubles(L3) && hasRun(L3, ["gameplayStart", "gameplayStop", "gameplayStart"]),
      { afterLoad: L0, afterPlayButton: L1, afterTwoCanvasClicks: L2, afterPauseResumeClick: L3, name: await page.evaluate(() => PS.portal.name) });
    verdict("fonts_canvas_text", fonts.check.every(Boolean) && fonts.fontsOk && fonts.baloo !== fonts.balooFallback && fonts.nunito !== fonts.nunitoFallback, { ...fonts, screenshot: shot });
    await ctx.close();
  }
  if (ONLY.includes("ads")) {
    const { ctx, page } = await open(null, u({ debug: "1", seed: "11" }));
    await clickSel(page, "#btn-play"); await sleep(300); await clickCanvas(page); await sleep(300);
    const firstPlay = await log(page), mode = await endMatch(page);
    const n0 = (await log(page)).length; await clickSel(page, mode === "win" ? "#btn-again" : "#btn-retry"); await sleep(500); await clickCanvas(page); await sleep(300);
    const againPath = (await log(page)).slice(n0 - 1);
    await page.keyboard.press("p"); await sleep(200); await clickSel(page, "#btn-quit"); await sleep(500);
    const n1 = (await log(page)).length; await clickSel(page, "#btn-play"); await sleep(500); await clickCanvas(page); await sleep(300);
    const L = await log(page), titlePath = L.slice(n1 - 1);
    verdict("ads_both_play_paths", !firstPlay.includes("commercialBreak") && hasRun(againPath, ["gameplayStop", "commercialBreak", "gameplayStart"]) && hasRun(titlePath, ["gameplayStop", "commercialBreak", "gameplayStart"]) && noDoubles(L),
      { endMode: mode, firstPlay, againPath, titlePath, full: L });
    await ctx.close();
  }
  if (ONLY.includes("crazy")) {
    const { ctx, page } = await open(null, u({ debug: "1", seed: "11", portal: "crazygames", useLocalSdk: "true" }));
    const sdk = await page.evaluate(() => ({ name: PS.portal.name, env: window.CrazyGames && window.CrazyGames.SDK ? window.CrazyGames.SDK.environment : null }));
    await clickSel(page, "#btn-play"); await sleep(300); await clickCanvas(page); await sleep(500);
    const mode = await endMatch(page); await sleep(500);
    await clickSel(page, mode === "win" ? "#btn-again" : "#btn-retry");
    const samples = []; let shotDuring = null, shotAfter = null;
    for (let i = 0; i < 400; i++) { // up to 40 s: the demo ad, then the new match
      const s = await page.evaluate(() => { const h = PS.audio.hardening(); return { t: Math.round(performance.now()), duck: h.duck.ad, master: h.master, mode: PSS.mode, busy: !!PSS.adBusy, log: PS.portal.log.slice(-3).join(">") }; });
      samples.push(s);
      if (s.duck && !shotDuring && samples.filter((x) => x.duck).length >= 10) { shotDuring = path.join(OUT, "m1-crazygames-demo-midgame.png"); await page.screenshot({ path: shotDuring }); }
      if (s.mode === "play" && !s.busy) { await sleep(400); shotAfter = path.join(OUT, "m1-crazygames-after-ad.png"); await page.screenshot({ path: shotAfter }); break; }
      await sleep(100);
    }
    const ducked = samples.filter((s) => s.duck), first = samples.findIndex((s) => s.duck), last = samples.length - 1 - [...samples].reverse().findIndex((s) => s.duck);
    const silentOutside = samples.every((s, i) => s.duck || s.master === null || s.master > 0.5 || (i > 0 && samples[i - 1].duck) || (i + 1 < samples.length && samples[i + 1].duck)); // one sample of ramp either side allowed
    const L = await log(page);
    verdict("crazygames_demo_midgame", sdk.env === "local" && ducked.length > 5 && ducked.every((s) => s.master !== null && s.master < 0.05 || s === samples[first]) && silentOutside && samples[samples.length - 1].mode === "play" && L.includes("commercialBreak"),
      { sdk, samples: samples.length, duckedSamples: ducked.length, duckMs: first >= 0 ? samples[last].t - samples[first].t : 0, masterDuring: ducked.slice(1, 4).map((s) => s.master), masterAfter: samples[samples.length - 1].master, log: L, shotDuring, shotAfter });
    await ctx.close();
  }
  if (ONLY.includes("dpr")) {
    const out = {};
    for (const d of ["1.5", "1"]) {
      const { ctx, page } = await open({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, u({ debug: "1", seed: "7", dpr: d }));
      const [x, y] = await center(page, "#btn-play"); await page.touchscreen.tap(x, y); await sleep(600);
      out[d] = await page.evaluate(() => ({ dpr: PSS.dpr, pinned: PSS.dprPin, touch: PSS.input.touch, steps: PSS.camS.steps, zoom: +PSS.cam.zoom.toFixed(3), canvas: [document.getElementById("game").width, document.getElementById("game").height] }));
      await page.evaluate(() => { const p = PSS.teams[1]; p.count = 700; }); // a big swarm's raw zoom sits under the floor: the step must be 0.5
      await sleep(1600); out[d].zoomAt700 = await page.evaluate(() => +PSS.cam.zoom.toFixed(3));
      await page.screenshot({ path: path.join(OUT, `m1-dpr-${d}-375x812.png`) }); await ctx.close();
    }
    verdict("dpr_override_keeps_floor", ["1.5", "1"].every((d) => out[d].pinned && out[d].dpr === +d && out[d].steps && out[d].steps[0] === 0.5), out);
  }
  if (ONLY.includes("busy")) {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }, u({ debug: "1", seed: "7" }));
    await clickSel(page, "#btn-play"); await sleep(300); await clickCanvas(page); await sleep(2600); // past the 2 s grace
    // 25 ms of busy work inside the game's own frame, once per rAF (pump also runs once per sim tick: only its first call in a frame spins)
    const t0 = await page.evaluate(() => { const p = PS.audio.pump; window.__pump = p; let fr = 0, done = -1; (function f() { fr++; if (window.__pump) requestAnimationFrame(f); })();
      PS.audio.pump = () => { if (done !== fr) { done = fr; const t = performance.now(); while (performance.now() - t < 25) {} } p(); }; return performance.now(); });
    let stepAt = null; const trace = [];
    for (let i = 0; i < 100 && stepAt == null; i++) { await sleep(100); const s = await page.evaluate(() => ({ t: performance.now(), cap: PSS.dprCap, p90: PSS.scriptP90, hot: PSS.dprHot })); if (i % 5 === 0) trace.push(s); if (s.cap < 2) stepAt = (s.t - t0) / 1000; }
    await page.evaluate(() => { PS.audio.pump = window.__pump; });
    const after = []; for (let i = 0; i < 12; i++) { await sleep(500); after.push(await page.evaluate(() => PSS.dprCap)); }
    const st = await page.evaluate(() => ({ steps: PSS.perfSteps, stored: localStorage.getItem("ps.perf"), dpr: PSS.dpr }));
    verdict("dpr_busy_steps_once_never_up", stepAt != null && stepAt >= 3 && stepAt <= 4.2 && after.every((c) => c <= 1.5) && after.every((c, i) => i === 0 || c <= after[i - 1]), { stepSeconds: stepAt && +stepAt.toFixed(2), trace, capAfterLoopOff: after, ...st });
    await ctx.close();
  }
  if (ONLY.includes("idle")) {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }, u({ debug: "1", seed: "7" }));
    const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const tr = []; for (let i = 0; i < 12; i++) { await sleep(1000); tr.push(await page.evaluate(() => ({ cap: PSS.dprCap, p90: +PSS.scriptP90.toFixed(2), raf: +PSS.rafP90.toFixed(1), fps: PSS.fps, mode: PSS.mode }))); }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    verdict("dpr_idle_title_4x_no_step", tr.every((s) => s.cap === 2 && s.mode === "title"), { trace: tr });
    await ctx.close();
  }
  if (ONLY.includes("audio")) {
    const { ctx, page } = await open(null, u({ debug: "1", seed: "7" }));
    await page.mouse.click(40, 700); await sleep(400); // a click on the title: the first gesture unlocks audio
    const a0 = await page.evaluate(() => PS.audio.hardening());
    await page.evaluate(() => PS.audio.ctx().suspend()); await sleep(300); const s1 = await page.evaluate(() => PS.audio.ctx().state);
    await page.mouse.click(40, 700); await sleep(400); const s2 = await page.evaluate(() => ({ state: PS.audio.ctx().state, h: PS.audio.hardening() }));
    await page.evaluate(async () => { const c = PS.audio.ctx(); window.__oldCtx = c; c.resume = () => Promise.resolve(); await c.suspend(); });
    const tries = []; for (let i = 0; i < 3; i++) { await page.mouse.click(40, 700); await sleep(450); tries.push(await page.evaluate(() => ({ same: PS.audio.ctx() === window.__oldCtx, state: PS.audio.ctx().state, h: PS.audio.hardening() }))); }
    const b0 = await page.evaluate(() => (PS.audio.state().plays || {}).click || 0); // the title is silent (attract); PLAY's click sound lands on the new bus
    await clickSel(page, "#btn-play"); await sleep(400);
    const plays = await page.evaluate((b0) => ({ before: b0, after: (PS.audio.state().plays || {}).click || 0, old: window.__oldCtx.state, state: PS.audio.ctx().state, nodes: PS.audio.state().nodes }), b0);
    // a hidden tab: the master gain ramps to 0, and back on return (visibility faked on the document)
    const hid = await page.evaluate(async () => { const w = (ms) => new Promise((r) => setTimeout(r, ms)); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); await w(250); const a = PS.audio.hardening().master;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); await w(250); return { hidden: a, visible: PS.audio.hardening().master }; });
    verdict("audio_recovers_and_rebuilds", a0.ctx === "running" && s1 === "suspended" && s2.state === "running" && s2.h.rebuilds === 0 && tries[0].same && tries[1].same && !tries[2].same && tries[2].state === "running" && tries[2].h.rebuilds === 1 && plays.after > plays.before && plays.old === "closed" && hid.hidden === 0 && hid.visible > 0.5,
      { unlocked: a0, afterConsoleSuspend: s1, afterClick: s2, stuckClicks: tries, plays, hiddenRamp: hid });
    await ctx.close();
  }
  if (ONLY.includes("iframe")) {
    if (!FRAME_DIR) throw new Error("--frame-dir is required for the iframe check");
    const src = u({ debug: "1", seed: "7" });
    fs.writeFileSync(path.join(FRAME_DIR, "frame.html"), `<!DOCTYPE html><html><head><meta charset="utf-8"><title>frame</title><style>body{margin:0;background:#333}iframe{position:absolute;left:40px;top:40px;border:0}</style></head>
<body><iframe id="f" allow="autoplay; fullscreen" width="640" height="360"></iframe><script>const f=document.getElementById("f"),q=new URLSearchParams(location.search);f.width=q.get("w");f.height=q.get("h");f.src=q.get("src");</script></body></html>`);
    const sizes = [[640, 360], [800, 450], [907, 510], [1216, 684]], res = {};
    for (const [w, h] of sizes) {
      const { ctx, page } = await open({ viewport: { width: 1320, height: 780 } }, null);
      await page.goto(FRAME_HOST + "frame.html?w=" + w + "&h=" + h + "&src=" + encodeURIComponent(src));
      const fr = () => page.frames().find((f) => f.url().startsWith(new URL(BASE).origin));
      for (let i = 0; i < 100 && !(fr() && await fr().evaluate(() => !!(window.PS && PS.portal && PS.portal.log.includes("loadingStop"))).catch(() => false)); i++) await sleep(100);
      const F = fr(), off = async (sel) => { const r = await F.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return [b.left, b.top]; }, sel); return r; };
      const [bx, by] = await off("#btn-play"), bw = await F.evaluate(() => { const b = document.getElementById("btn-play").getBoundingClientRect(); return [b.width, b.height]; });
      const titleFit = await F.evaluate(() => { const bad = []; for (const e of document.querySelectorAll("#ov-title .logo, #ov-title .menu button, #ov-title .diffrow")) { const r = e.getBoundingClientRect(); if (r.width && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) bad.push(e.id || e.className); } return bad; });
      await page.screenshot({ path: path.join(OUT, `m1-iframe-${w}x${h}-title.png`) });
      await page.mouse.click(40 + bx + bw[0] / 2, 40 + by + bw[1] / 2); await sleep(500); await page.mouse.click(40 + w * 0.62, 40 + h * 0.55); await sleep(1500);
      const hud = await F.evaluate(() => { const bad = [], vis = []; for (const sel of ["#timer", "#ctrls", "#teams", "#minimap", "#bl", "#chip-1"]) { const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (!r.width) continue; vis.push(sel); if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push(sel + " " + [r.left, r.top, r.right, r.bottom].map(Math.round).join(",")); }
        const cs = getComputedStyle(document.querySelector(".chip .n") || document.body); return { mode: PSS.mode, inner: [innerWidth, innerHeight], bad, vis, chipFontPx: parseFloat(cs.fontSize), timerFontPx: parseFloat(getComputedStyle(document.getElementById("timer")).fontSize), layout: document.body.className }; });
      const shot = path.join(OUT, `m1-iframe-${w}x${h}-match.png`); await page.screenshot({ path: shot });
      // resize mid-match to the next size (the last one shrinks back to the first)
      const nx = sizes[(sizes.findIndex((s) => s[0] === w) + 1) % sizes.length];
      await page.evaluate(([a, b]) => { const f = document.getElementById("f"); f.width = a; f.height = b; }, nx); await sleep(700);
      const rs = await F.evaluate(() => ({ inner: [innerWidth, innerHeight], canvas: [document.getElementById("game").width, document.getElementById("game").height], dpr: PSS.dpr, mode: PSS.mode, vw: PSS.vw, vh: PSS.vh }));
      await page.screenshot({ path: path.join(OUT, `m1-iframe-${w}x${h}-resized-${nx[0]}x${nx[1]}.png`) });
      await page.mouse.click(1300, 770); await sleep(400); // outside the frame: the frame's window blurs
      const blur = await F.evaluate(() => ({ mode: PSS.mode, log: PS.portal.log.slice(-2) }));
      res[w + "x" + h] = { titleFit, hud, resized: { to: nx, ...rs }, blur, shot };
      await ctx.close();
    }
    const ok = Object.values(res).every((r) => r.titleFit.length === 0 && r.hud.mode === "play" && r.hud.bad.length === 0 && r.resized.inner[0] === r.resized.to[0] && r.resized.canvas[0] === Math.round(r.resized.to[0] * r.resized.dpr) && r.resized.mode === "play" && r.blur.mode === "pause");
    verdict("iframe_sizes_resize_blur", ok, res);
  }
} catch (e) { R.crash = String((e && e.stack) || e); console.error(R.crash); }
await browser.close();
R.pass = !R.crash && R.errors.length === 0 && Object.values(R.checks).every((c) => c.pass);
fs.writeFileSync(path.join(OUT, "m1-check.json"), JSON.stringify(R, null, 1));
console.log((R.pass ? "M1 CHECK PASS" : "M1 CHECK FAIL") + " | errors " + R.errors.length + (R.errors.length ? " " + JSON.stringify(R.errors.slice(0, 5)) : ""));
process.exit(R.pass ? 0 : 1);
