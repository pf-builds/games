#!/usr/bin/env node
// Sapper's Path v4 Critics 2 fix pass: before/after screens and measurements (tools/shots-v4-fix2/, gitignored).
//   PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs ~/.local/opt/node/bin/node tools/shots-v4-fix2.mjs --tag before|after [--url http://127.0.0.1:8491/sappers-path/] [--only 667,736,...]
// Screens, each named <tag>-<viewport>-<what>.png: V1 the teaching coach on levels 62, 76, 77 at 375x667 and 414x736 (and
// 62/77 everywhere else); V2 a Gallery win's report and the Gallery screen (none won, then three won); m1 the four lifted
// paintings and slot 33 at rest (1280, three queue rows); m2 the power-up bar broke and half-broke; m3 the bar close up;
// m4 the iframe's bar; m5 the landscape power panel; m6 the home mid-campaign; m7 the map's era card and settings; m8 a
// siege win report; m9 level 78's two rods at step 13. Measurements in <tag>-measure.json: per viewport, every teaching
// level's coach (mode, queue rows, font, lines, fits, the board's CSS px a cell), every badge's box, and console errors.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("url", "http://127.0.0.1:8491/sappers-path/"), TAG = arg("tag", "after"), OUT = resolve(here, "shots-v4-fix2");
const VPS = [["667", 375, 667, 2, true], ["736", 414, 736, 3, true], ["812", 375, 812, 3, true], ["844", 390, 844, 3, true], ["1280", 1280, 720, 1, false], ["land", 812, 375, 3, true], ["iframe", 400, 600, 2, false, true], ["640", 360, 640, 2, true]];
const ONLY = arg("only", VPS.map((v) => v[0]).join(",")).split(",");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], M = { tag: TAG, url: BASE, vp: {} };
const wall = setTimeout(() => { console.error("out of time"); process.exit(2); }, 560000);
const TEACH = [1, 2, 3, 26, 35, 51, 62, 76, 77];

async function open(tag, w, h, dpr, touch, iframe) {
  const ctx = await browser.newContext({ viewport: { width: iframe ? 460 : w, height: iframe ? 700 : h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  let T = page, clip = null;
  if (iframe) { await page.goto(BASE + "tools/iframe-host.html", { waitUntil: "load" }); for (let i = 0; i < 100 && !(T = page.frames().find((f) => f.url().includes("?debug=1"))); i++) await page.waitForTimeout(100); clip = await page.locator("#game").boundingBox(); }
  else await page.goto(BASE + "?debug=1", { waitUntil: "load" });
  await T.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 20000 });
  return { tag, ctx, page, T, clip };
}
async function shot(V, name, fn, a, wait = 250, el) {
  try { if (fn) await V.T.evaluate(fn, a); await V.page.waitForTimeout(wait);
    let clip = V.clip || undefined;
    if (el) { const b = await V.T.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left - 6, y: r.top - 12, width: r.width + 12, height: r.height + 18 }; }, el); clip = V.clip ? { x: V.clip.x + b.x, y: V.clip.y + b.y, width: b.width, height: b.height } : b; }
    await V.page.screenshot({ path: resolve(OUT, TAG + "-" + V.tag + "-" + name + ".png"), clip }); }
  catch (e) { log.push(V.tag + " " + name + " failed: " + ((e && e.message) || e)); }
}
// Every teaching level's coach at load: its mode, the queue rows, the font, one line or two, whether it fits, the cell.
const coachScan = (ns) => ns.map((n) => { const st = SP.load(n, "normal"); SP.tick(40); const c = document.getElementById("coach"), cs = SP.coach(), b = c.getBoundingClientRect();
  return { n, mode: cs.mode, rows: SP.meta().rows, text: c.textContent, box: [Math.round(b.width), Math.round(b.height)], font: getComputedStyle(c).fontSize, lines: cs.oneLine ? 1 : 2,
    fits: !(c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1), cell: +(st.cs / devicePixelRatio).toFixed(2) }; });
// Every later step's line too (the stored Normal order), on the levels with more than one step: any step that doesn't fit.
const stepScan = (ns) => { const bad = []; let steps = 0; for (const n of ns) { SP.load(n, "normal"); SP.tick(40); const o = SP.winOrder("normal") || "";
  for (let i = 0; i <= o.length; i++) { const c = document.getElementById("coach"); if (!c.hidden) { steps++; if (c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) bad.push(n + "@" + i + ": " + c.textContent); } if (i < o.length) { SP.play(+o[i]); SP.settle(); } } }
  return { checked: steps, bad }; };
const rest = (n) => { SP.speed(1); SP.load(n, "normal"); SP.tick(40); return true; };
const inv = (a) => { SP.setMeta(a[1]); SP.load(a[0], "normal"); SP.tick(40); return SP.meta(); };
const home = () => { SP.unlockTo(40); SP.setMeta({ coins: 760 }); SP.screen("title"); return true; };
const winRep = (n) => { SP.speed(1); SP.load(n, "normal"); const o = SP.winOrder("normal"); for (let i = 0; i < o.length; i++) { SP.play(+o[i]); if (i < o.length - 1) SP.settle(); else SP.tick(400); } for (let i = 0; i < 3000 && !SP.state().panel; i++) SP.tick(16); SP.tick(1800); return SP.state().panel; };
const step78 = () => { SP.speed(1); SP.load(78, "normal"); SP.tick(20); const o = SP.winOrder("normal"); for (let i = 0; i < 13; i++) { SP.play(+o[i]); SP.settle(); } return true; };

async function viewport(V, full) {
  const m = (M.vp[V.tag] = {});
  m.coach = await V.T.evaluate(coachScan, TEACH);
  m.steps = await V.T.evaluate(stepScan, [3, 26, 35, 51, 62, 76, 77]);
  for (const n of V.tag === "667" || V.tag === "736" ? [62, 76, 77] : [62, 77]) await shot(V, "teach-l" + n, rest, n);
  m.badges = await V.T.evaluate(() => { SP.load(40, "normal"); SP.tick(40); return Array.from(document.querySelectorAll(".pw")).map((p) => { const r = p.getBoundingClientRect(); return [p.dataset.k, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; }); });
  await shot(V, "bar-broke", inv, [40, { coins: 10, inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 0 } }], 250, V.tag === "1280" || V.tag === "land" ? "#powers" : "#rail");
  await shot(V, "bar-half", inv, [40, { coins: 90, inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 1 } }], 250, "#powers");
  await shot(V, "home-mid", home, null);
  await shot(V, "gal-win", winRep, "g-tw-1f355", 450);
  await shot(V, "gallery-1", () => { SP.unlockGallery(); SP.screen("gallery"); return true; });
  if (!full) return;
  await shot(V, "gal-win-painting", winRep, "g-met-57007", 450);
  await shot(V, "gallery-3", () => { for (const id of SP.gallery().slice(0, 3)) { SP.load(id, "normal"); const o = SP.winOrder("normal"); for (const c of o) { SP.play(+c); SP.settle(); } for (let i = 0; i < 3000 && !SP.state().panel; i++) SP.tick(16); } SP.screen("gallery"); return true; });
  await shot(V, "win-report", winRep, 8, 450);
  await shot(V, "map-top", () => { SP.screen("map"); const mp = document.getElementById("map"); mp.scrollTop = 0; return true; });
  await shot(V, "settings", () => { SP.screen("title"); document.getElementById("btn-settings").click(); return true; });
  await V.T.evaluate(() => { const c = document.getElementById("set-close"); if (c) c.click(); });
  await shot(V, "l78-step13", step78, null, 250, "#tray");
  if (V.tag === "1280") for (const id of ["g-met-57007", "g-met-436528", "g-met-436534", "g-met-435882", "g-met-437999", "g-noto-1f3c6"]) await shot(V, "paint-" + id.replace("g-", ""), (x) => { const ids = SP.gallery(); if (ids.indexOf(x) < 0) return false; SP.load(x, "normal"); SP.tick(40); return true; }, id);
}
try {
  for (const [tag, w, h, dpr, touch, iframe] of VPS) { if (!ONLY.includes(tag)) continue; const V = await open(tag, w, h, dpr, touch, iframe); await viewport(V, tag === "812" || tag === "1280" || tag === "667"); await V.ctx.close(); }
} catch (e) { log.push("crashed: " + ((e && e.stack) || e)); }
clearTimeout(wall); await browser.close();
M.console = log;
writeFileSync(resolve(OUT, TAG + "-measure.json"), JSON.stringify(M, null, 1));
for (const [k, v] of Object.entries(M.vp)) console.log(k, "coach:", v.coach.map((c) => c.n + ":" + c.mode + "/" + c.rows + "r/" + c.font + "/" + c.lines + "l/" + (c.fits ? "fits" : "CLIPPED") + "/" + c.cell).join(" "), "| steps", v.steps.checked, "bad", v.steps.bad.length, "| badges", v.badges.map((b) => b[1]).join(","));
console.log(log.length ? "LOG " + log.length + "\n" + log.join("\n") : "LOG: 0 console errors or warnings");
