#!/usr/bin/env node
// Sapper's Path v5 R4 merge screens (levels 101-200 with their map), into tools/shots-v5-r4/merged/ (gitignored).
// Each state at 375x812 (touch, 3x) as phone-<name>.png and 1280x720 (1x) as desktop-<name>.png, on the real levels.json:
//   fresh         a new save: the bottom of the map, level 1 current.
//   cur-110, cur-130, cur-160, cur-190   levels 1-(n-1) cleared, pictures won as they open: n current (130: Emberwatch
//                 Crags, the towers realm, stone bridges near).
//   summit        levels 1-199 cleared: level 200 current at the fortress, the Goblin King beside it.
//   all-200       every level and pictures 1-50 cleared: the long tail's node (picture 51) in the fog past 200.
//   lesson-125, lesson-150   the archer-tower and hidden-block lessons in play (two taps of the stored order, the coach up).
// Exit 1 on any console error or warning.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v5-r4-merged.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v5-r4/merged");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 600000);
const VPS = [{ name: "phone", ctx: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } }, { name: "desktop", ctx: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } }];
const pics = (n) => Math.max(0, Math.min(50, Math.floor((n - 4) / 4))); // about the pictures open by level n (gallery afters)
const MAPS = [["fresh", 0, 0], ["cur-110", 109, pics(109)], ["cur-130", 129, pics(129)], ["cur-160", 159, pics(159)], ["cur-190", 189, pics(189)], ["summit", 199, pics(199)], ["all-200", 200, 50]];

try {
  for (const vp of VPS) {
    const fresh = async () => { const ctx = await browser.newContext(vp.ctx), page = await ctx.newPage();
      page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(vp.name + " " + m.type() + ": " + m.text()); });
      page.on("pageerror", (e) => log.push(vp.name + " pageerror: " + e.message));
      await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
      await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
      await page.evaluate(() => { const d = document.getElementById("jr-dbg"); if (d) d.remove(); }); return { ctx, page }; };
    const drawn = (page) => page.waitForFunction(() => { const r = Array.from(document.querySelectorAll(".jr-img")).filter((i) => i.getAttribute("src")); return r.length > 0 && r.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 15000, polling: 50 });
    for (const [name, n, k] of MAPS) { const { ctx, page } = await fresh();
      notes[vp.name + "-" + name] = await page.evaluate(([n, k]) => { if (n) SP.unlockTo(n); if (k) SP.clearPictures(k); SP.screen("map"); const m = SP.map(); return { focus: m && m.focus, play: document.getElementById("map-play").hidden ? null : document.getElementById("map-play").textContent }; }, [n, k]);
      await drawn(page); await page.waitForTimeout(300); await page.screenshot({ path: resolve(OUT, vp.name + "-" + name + ".png") }); await ctx.close(); }
    for (const n of [125, 150]) { const { ctx, page } = await fresh();
      notes[vp.name + "-lesson-" + n] = await page.evaluate((n) => { SP.load(n); SP.tick(1200); const o = SP.winOrder(); for (let i = 0; i < 2 && i < o.length; i++) { SP.play(+o[i]); SP.tick(900); } const c = document.querySelector(".coach, #coach"); return { id: SP.state().id || null, coach: c ? c.textContent.trim().slice(0, 80) : null }; }, n);
      await page.waitForTimeout(300); await page.screenshot({ path: resolve(OUT, vp.name + "-lesson-" + n + ".png") }); await ctx.close(); }
  }
} catch (e) { log.push("crashed: " + ((e && e.stack) || e)); }
await browser.close(); clearTimeout(wall);
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, null, 1));
console.log(log.length ? "SHOTS: " + log.length + " console messages\n" + log.join("\n") : "SHOTS: 0 console errors or warnings");
process.exit(log.length ? 1 : 0);
