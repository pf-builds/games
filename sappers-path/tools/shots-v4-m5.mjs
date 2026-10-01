#!/usr/bin/env node
// Sapper's Path v4 M5 (the meta layer) screens, into tools/shots-v4-m5/ (gitignored). Headless Chromium via Playwright.
// At 375x812 (dpr 2, touch), 1280x720 (dpr 1), 812x375 (dpr 3, touch) and the 400x600 iframe (tools/iframe-host.html):
//   home-new (a fresh save), home-mid (levels 1-40 won, coins earned), home-gallery-locked / home-gallery-open (the tab
//   bar), settings, level-bar (level 40 with the power-up bar), buy (a + tapped: one owned), ladder (used: one more
//   space), pull-ask (the Quartermaster asking: tiles glow) and pull-done, scout-before / scout-after (v4-mystery),
//   recall-ask (a waiting squad's space glows) and recall-done, win-report (coins counted up), fail-report (a jam), map
//   (the era report cards), gallery (its report card), lives-on and lives-none (the flag forced on, debug only).
// Measurements go to tools/shots-v4-m5/notes.json. Exit 1 on a console error or warning.
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v4-m5.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v4-m5");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 480000);
const VPS = [{ tag: "375", w: 375, h: 812, dpr: 2, touch: true }, { tag: "1280", w: 1280, h: 720, dpr: 1 }, { tag: "812", w: 812, h: 375, dpr: 3, touch: true }, { tag: "iframe", w: 480, h: 700, dpr: 2, iframe: [400, 600] }];

async function run(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, hasTouch: !!vp.touch, isMobile: !!vp.touch });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(vp.tag + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(vp.tag + " pageerror: " + e.message));
  let F;
  if (vp.iframe) { await page.goto(URL_ + "tools/iframe-host.html?w=" + vp.iframe[0] + "&h=" + vp.iframe[1], { waitUntil: "load" }); const fh = await page.waitForSelector("#game", { timeout: 10000 }); for (let k = 0; k < 100 && !(F = await fh.contentFrame()); k++) await page.waitForTimeout(50); }
  else { await page.goto(URL_ + "?debug=1", { waitUntil: "load" }); F = page.mainFrame(); }
  await F.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
  const ev = (fn, a) => F.evaluate(fn, a), snap = async (name) => { await page.waitForTimeout(260); await page.screenshot({ path: resolve(OUT, vp.tag + "-" + name + ".png") }); };
  const L = (sel) => (vp.iframe ? page.frameLocator("#game").locator(sel) : page.locator(sel)).first();
  const tap = async (sel) => { const l = L(sel); if (vp.touch) await l.tap({ timeout: 5000 }); else await l.click({ timeout: 5000 }); };
  const N = (notes[vp.tag] = {});
  await snap("home-new"); await snap("home-gallery-locked");
  await tap("#btn-settings"); await snap("settings"); await tap("#set-close");
  // Mid-campaign: levels 1-40 won with coins earned (siege wins through SP.unlockTo, coins set as if earned).
  await ev(() => { SP.unlockTo(40); SP.setMeta({ coins: 760 }); SP.screen("title"); }); await snap("home-mid"); await snap("home-gallery-open");
  await ev(() => SP.load(40, "normal")); await snap("level-bar");
  N.level40 = await ev(() => ({ cs: SP.state().cs / devicePixelRatio, meta: SP.meta() }));
  await tap('.pw[data-k="0"]'); await snap("buy");
  await tap('.pw[data-k="0"]'); await page.waitForTimeout(120); await snap("ladder");
  await tap('.pw[data-k="1"]'); await tap('.pw[data-k="1"]'); await snap("pull-ask");
  await tap("#tray .tile.next.pickable"); await snap("pull-done");
  await ev(() => { SP.load("v4-mystery", "normal"); SP.setMeta({ inv: { ladder: 0, quartermaster: 0, scout: 1, recall: 1 } }); }); await snap("scout-before");
  await tap('.pw[data-k="2"]'); await snap("scout-after");
  // Recall: a level whose front can't reach a block; that squad waits in its space.
  const st = await ev(() => { const r = SP.stage(16, 1, 0); SP.setMeta({ inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 1 } }); return r; });
  N.recallLevel = st && st.id;
  await tap('.pw[data-k="3"]'); await snap("recall-ask");
  if (await L(".slot.pickable").count()) { await tap(".slot.pickable"); await snap("recall-done"); }
  // A win's report (level 3 on Hard: a first win there), the coins counted up.
  await ev(() => { SP.load(3, "hard"); const o = SP.winOrder(); for (let i = 0; i < o.length; i++) { SP.play(+o[i]); if (i < o.length - 1) SP.settle(); else SP.tick(400); } for (let i = 0; i < 2000 && !SP.state().panel; i++) SP.tick(16); SP.tick(1400); });
  await snap("win-report"); N.report = await ev(() => SP.meta().report);
  // A fail's report: a jam.
  const plan = await ev(() => { for (let n = 46; n <= 75; n++) { SP.load(n, "normal"); const p = SP.lossPlan(); if (p) return Object.assign({ n }, p); } return null; });
  if (plan) { await ev((p) => { SP.load(p.n, "normal"); for (const c of p.prefix) { SP.play(+c); SP.settle(); } for (let i = 0; i < 800 && !SP.state().panel; i++) SP.tick(16); SP.tick(400); }, plan); await snap("fail-report"); }
  await ev(() => { SP.screen("map"); document.getElementById("map").scrollTop = 0; }); await snap("map");
  await ev(() => { const e = document.querySelectorAll("#map .era")[2]; if (e) e.scrollIntoView({ block: "start" }); }); await snap("map-era2");
  await ev(() => SP.screen("gallery")); await snap("gallery");
  // Lives forced on (debug only): three left with a refill running, then none.
  await ev(() => { SP.screen("title"); SP.forceLives(true, 3, 4 * 60000); }); await snap("lives-on");
  await ev(() => SP.forceLives(true, 0, 7 * 60000)); await snap("lives-none");
  await ev(() => SP.forceLives(false));
  await ctx.close();
}
for (const vp of VPS) await run(vp);
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify({ notes, console: log }, null, 1));
console.log(JSON.stringify({ console: log, level40: Object.fromEntries(Object.entries(notes).map(([k, v]) => [k, v.level40 && v.level40.cs])) }));
clearTimeout(wall); await browser.close(); process.exit(log.length ? 1 : 0);
