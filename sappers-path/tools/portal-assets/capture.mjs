// Sapper's Path lane P Stage 5: preview-video frame capture from the real game, on sim time (no screen recorder).
// The page's own rAF loop is held (requestAnimationFrame never runs the game's `frame`), so nothing moves unless SP.tick
// moves it: every video frame is SP.tick(1000/fps), then every CSS animation and transition is stepped by the same
// 1000/fps (paused and seeked through document.getAnimations()), then a PNG screenshot. Taps go through SP.play on the
// stored win order; a tap is only tried when the line has the free spaces a dry run learned that card needs, so no tap is
// ever refused on camera (no shake, no "No space" toast). Each level runs dry first (no screenshots) until it plays
// without a refusal, which also fixes its event frames (won, goblin, panel, hits); shot segments are set against those.
// No cursor (CSS cursor:none, and screenshots never carry the OS pointer), the ?debug=1 row on the map hidden.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node capture.mjs --plan shots.json --orient land --out DIR
//     [--url http://127.0.0.1:8517/] [--preview] [--board]   (--preview: every 6th frame at 1x scale, for picking segments;
//     --board: shoot the #board canvas alone, the covers' pixel-board art)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const PLAN = JSON.parse(readFileSync(arg("plan"), "utf8")), ORIENT = arg("orient", "land"), OUT = arg("out"), URL_ = arg("url", "http://127.0.0.1:8517/");
const PREVIEW = process.argv.includes("--preview"), BOARD = process.argv.includes("--board"), V = PLAN.viewports[ORIENT], FPS = PLAN.fps, DT = 1000 / FPS, EVERY = PREVIEW ? 6 : 1;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch();
const errs = [];
// A fresh context (its own save) per shot, and per dry run of a shot that wants a first clear on camera.
async function openPage(unlock) {
  const ctx = await b.newContext({ viewport: { width: V.w, height: V.h }, deviceScaleFactor: PREVIEW ? 1 : V.dpr, reducedMotion: "no-preference" });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); }); p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => {
    const R = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => (cb.name === "frame" ? 0 : R(cb)); // the game's loop never runs; SP.tick drives it
    // Step every CSS animation/transition by dt ms of sim time: a new one is paused at its start, a held one seeks on, and
    // one past its end is finished (its fill applies) and let go.
    const held = new WeakSet();
    window.__anim = (dt) => { for (const a of document.getAnimations()) {
      if (!held.has(a)) { if (a.playState !== "running") continue; held.add(a); a.pause(); a.currentTime = 0; continue; }
      if (a.playState !== "paused") continue;
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity, t = (a.currentTime || 0) + dt;
      if (isFinite(end) && t >= end) a.finish(); else a.currentTime = t; } };
    const css = "*{cursor:none!important;caret-color:transparent!important}#jr-dbg{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.append(s); });
  });
  await p.goto(URL_ + "?debug=1");
  await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 15000 });
  await p.evaluate((n) => { SP.unlockTo(n); SP.speed(1); }, unlock);

  // In-page level runner: n frames of play (tap if the line has room for the next card, then tick), events logged by frame.
  await p.evaluate(() => {
    window.__lv = (id, need) => { const s = SP.load(id); window.__R = { o: SP.winOrder(), i: 0, f: 0, need: need || {}, ev: [], ref: [], s, done: -1 }; return !!s; };
    window.__adv = (n, DT) => { const R = __R, t0 = performance.now(); let k = 0;
      for (; k < n && performance.now() - t0 < 4000; k++) { let s = R.s;
        if (s.status === "playing" && R.i < R.o.length && s.li.free >= (R.need[R.i] || 1)) {
          const r0 = s.refused; if (SP.play(+R.o[R.i])) R.i++; else if (SP.state().refused > r0) { R.ref.push(R.i); R.need[R.i] = s.li.free + 1; } }
        const s2 = SP.tick(DT); window.__anim(DT); R.f++;
        if (s2.hits !== s.hits) R.ev.push(["hit", R.f]); if (s2.status !== s.status) R.ev.push([s2.status, R.f]);
        if (s2.goblin && !s.goblin) R.ev.push(["goblin", R.f]); if (s2.march && !s.march) R.ev.push(["march", R.f]); if (s2.panel && !s.panel) { R.ev.push(["panel", R.f]); R.done = R.f; }
        R.s = s2; }
      return { k, f: R.f, done: R.done, ref: R.ref.length }; };
  });
  return { ctx, p };
}
let p; // the page being driven
const snap = (path) => (BOARD ? p.locator("#board").screenshot({ path }) : p.screenshot({ path }));
const advance = async (n) => { let left = n; for (let g = 0; left > 0 && g < 10000; g++) { const r = await p.evaluate(([m, dt]) => __adv(m, dt), [left, DT]); left -= r.k; } };
const runTo = async (cond, cap) => { for (let g = 0; g < 2000; g++) { const r = await p.evaluate(([dt]) => __adv(300, dt), [DT]); if (cond(r) || r.f > cap) return r; } };

let shotN = 0; const report = [];
async function shoot(dir, nFrames, perFrame) { // nFrames frames: perFrame(i) moves the game one frame, then a screenshot
  for (let i = 0; i < nFrames; i++) { await perFrame(i); if (i % EVERY === 0) await snap(`${dir}/f${String(i).padStart(5, "0")}.png`); }
}
for (const S of PLAN.shots) {
  const unlock = S.unlockTo != null ? S.unlockTo : PLAN.unlockTo, cam = await openPage(unlock); p = cam.p;
  const dir = `${OUT}/${String(++shotN).padStart(2, "0")}-${S.name}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  if (S.kind === "screen") { // a still screen (home): the screen, settle real-time image loads, then frames on sim time
    await p.evaluate((n) => SP.screen(n), S.screen); await p.waitForTimeout(1500);
    await p.evaluate(() => { for (const a of document.getAnimations()) if (isFinite(a.effect.getComputedTiming().endTime)) a.finish(); });
    await shoot(dir, Math.round(S.sec * FPS), () => p.evaluate((dt) => { SP.tick(dt); __anim(dt); }, DT));
    report.push(`${S.name}: ${Math.round(S.sec * FPS)} frames`); await cam.ctx.close();
  } else if (S.kind === "map") { // the journey map, scrolled by script from start to end (css px below the opened spot) with an ease
    await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(1200);
    const top0 = await p.evaluate(() => document.getElementById("jr").scrollTop);
    await p.evaluate(([a]) => { document.getElementById("jr").scrollTop = a; }, [top0 + S.from]); await p.waitForTimeout(800);
    await p.evaluate(([a]) => { document.getElementById("jr").scrollTop = a; }, [top0 + S.to]); await p.waitForTimeout(800); // both ends' sheets loaded
    await p.evaluate(() => { for (const a of document.getAnimations()) if (isFinite(a.effect.getComputedTiming().endTime)) a.finish(); });
    const n = Math.round(S.sec * FPS);
    await shoot(dir, n, (i) => p.evaluate(([y, dt]) => { document.getElementById("jr").scrollTop = y; SP.tick(dt); __anim(dt); }, [top0 + S.from + (S.to - S.from) * (0.5 - 0.5 * Math.cos(Math.PI * i / (n - 1))), DT]));
    await cam.ctx.close(); report.push(`${S.name}: ${n} frames, scrollTop ${top0 + S.from} -> ${top0 + S.to}`);
  } else { // a level: dry runs until refusal-free, then the real run with the segments shot
    let need = {}, dry; const dc = S.first ? await openPage(unlock) : cam; p = dc.p; // S.first: dry runs elsewhere, so the camera's save still has the level unwon
    for (let pass = 0; pass < 6; pass++) {
      await p.evaluate(([id, nd]) => __lv(id, nd), [S.id, need]);
      dry = await runTo((r) => r.done >= 0 && r.f >= r.done + 150, 40000);
      const st = await p.evaluate(() => ({ need: __R.need, ref: __R.ref.length, ev: __R.ev }));
      need = st.need; dry.ev = st.ev; if (!st.ref) break; if (pass === 5) throw new Error(S.id + ": still refusing after 6 dry runs");
    }
    const at = {}; for (const [k, f] of dry.ev) if (!(k in at)) at[k] = f; at.hits = dry.ev.filter((e) => e[0] === "hit").map((e) => e[1]);
    const segs = S.segments.map(([ev, a, z]) => { const base = ev === "t" ? 0 : ev.startsWith("hit") ? at.hits[+ev.slice(3)] : at[ev]; return [Math.round(base + a * FPS), Math.round(base + z * FPS)]; });
    if (dc !== cam) await dc.ctx.close(); p = cam.p;
    await p.evaluate(([id, nd]) => __lv(id, nd), [S.id, need]);
    let f = 0, out = 0; const SEG = [];
    for (const [a, z] of segs) {
      await advance(a - f); f = a; const t0 = f;
      for (; f < z; f++, out++) { await p.evaluate((dt) => __adv(1, dt), DT); if (out % EVERY === 0) await snap(`${dir}/f${String(out).padStart(5, "0")}.png`); }
      SEG.push(`${(t0 / FPS).toFixed(2)}-${(z / FPS).toFixed(2)}s`);
    }
    const ref = await p.evaluate(() => __R.ref.length), real = await p.evaluate(() => __R.ev);
    const same = JSON.stringify(real.filter((e) => e[1] <= f)) === JSON.stringify(dry.ev.filter((e) => e[1] <= f));
    await cam.ctx.close();
    report.push(`${S.name} (${S.id}, save at ${unlock}${S.first ? ", first clear" : ""}): ${out} frames from ${SEG.join(" + ")}; events ${JSON.stringify(Object.fromEntries(Object.entries(at).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => (x / FPS).toFixed(2)) : (v / FPS).toFixed(2)])))}; refused on camera ${ref}; real run matches dry run ${same}`);
  }
}
writeFileSync(`${OUT}/capture-${ORIENT}${PREVIEW ? "-preview" : ""}.txt`, report.join("\n") + `\nconsole errors: ${errs.length}\n` + errs.join("\n") + "\n");
console.log(report.join("\n")); console.log("console errors: " + errs.length); for (const e of errs) console.log("  " + e);
await b.close();
