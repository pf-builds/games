#!/usr/bin/env node
// Sapper's Path v5 R3 (the journey map) screens (v5 R4 merge: the all-clear states clear every level, 1-200, and the
// long tail's pictures are 51-60), into tools/shots-v5-r3/ (gitignored). Headless Chromium via Playwright.
// Each state at 375x812 (touch, 3x) as phone-<name>.png and 1280x720 (1x) as desktop-<name>.png:
//   fresh          a new save: the bottom of the map, level 1 current, realm 1's banner.
//   quest-open     levels 1-6 cleared: picture 1's side quest open with its prize bubble; level 7 current.
//   egg-before, egg-pop, egg-after   sheet 1's woodpile before a real tap, mid coin pop, and after (a campfire, +coins).
//   realm-banner   levels 1-24 cleared: level 25 just over realm 2's banner, its lore shown by a real tap.
//   realm-3        levels 1-55 cleared, three pictures won: realm 3 (The Ironhollows), level 56 current.
//   all-clear      every level and pictures 1-50 cleared: the fog's next-picture node (51) past the Goblin King.
//   home           the home screen (mid-campaign).
// v5 R3 fix pass (fix-*): one shot per fix, same two viewports:
//   fix-all-clear       every level and all 60 pictures cleared: no Play, the end line; the desktop card agrees.
//   fix-tail-row        every level and pictures 1-55 cleared: the fog node, the latest 3 won in one row, the chip.
//   fix-tail-sheet      the chip tapped: the sheet of the 9 cleared long-tail pictures (44+ px tiles).
//   fix-sheet8-60       levels 1-74 cleared, no pictures: quest 15 moved off level 60 (sheet 8).
//   fix-banner-r4       levels 1-74 cleared, realm 4's banner tapped open (clear of the eggs and the Level 75 label).
//   fix-cur-81          levels 1-80 cleared: quest 20's bubble clear of the route between 80 and 81.
//   fix-quest-23        levels 1-92 cleared: quest 23 off the painted tower, on the spur by 92.
//   fix-playbar         levels 1-5 cleared: the Play bar's tag inside the button.
//   fix-nextup          levels 1-55 cleared, pictures 1-3: the next-up card's side quest is the nearest open one (13).
// Measurements to tools/shots-v5-r3/notes.json: SP.map() per state, the map's open time to its first sheet drawn, and
// scroll frame times on the phone at 4x CPU throttling (a programmatic scroll of 40 px a frame for 150 frames).
// The debug row (?debug=1, for SP) is hidden in the screens. Exit 1 on any console error or warning.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v5-r3.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v5-r3");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 400000);
const VPS = [{ name: "phone", ctx: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } }, { name: "desktop", ctx: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } }];

try {
  for (const vp of VPS) {
    const N = (notes[vp.name] = {});
    const fresh = async () => { const ctx = await browser.newContext(vp.ctx), page = await ctx.newPage();
      page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(vp.name + " " + m.type() + ": " + m.text()); });
      page.on("pageerror", (e) => log.push(vp.name + " pageerror: " + e.message));
      await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
      await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
      await page.evaluate(() => { document.getElementById("jr-dbg").remove(); }); return { ctx, page }; };
    const ev = (page, fn, a) => page.evaluate(fn, a);
    // Wait (bounded) until every requested sheet image near the view has decoded.
    const drawn = (page) => page.waitForFunction(() => { const r = Array.from(document.querySelectorAll(".jr-img")).filter((i) => i.getAttribute("src")); return r.length > 0 && r.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 15000, polling: 50 });
    const open = async (page, setup) => { await ev(page, setup); const t0 = await ev(page, () => { const t = performance.now(); SP.screen("map"); return t; });
      await drawn(page); const t1 = await ev(page, () => performance.now()); await page.waitForTimeout(250); return Math.round(t1 - t0); };
    const snap = (page, name) => page.screenshot({ path: resolve(OUT, vp.name + "-" + name + ".png") });
    const toMid = (page, sel) => ev(page, (q) => { const el = document.querySelector(q), sc = document.getElementById("jr"); sc.scrollTop += el.getBoundingClientRect().top + el.offsetHeight / 2 - sc.getBoundingClientRect().top - sc.clientHeight / 2; }, sel);
    const states = [
      ["fresh", () => {}],
      ["quest-open", () => SP.unlockTo(6)],
      ["realm-3", () => { SP.unlockTo(55); SP.clearPictures(3); }],
      ["all-clear", () => { SP.unlockTo(1e3); SP.clearPictures(50); }]];
    for (const [name, setup] of states) { const { ctx, page } = await fresh(); const ms = await open(page, setup); N[name] = Object.assign({ openMs: ms }, await ev(page, () => SP.map())); await snap(page, name); await ctx.close(); }
    // The realm boundary: level 25 over realm 2's banner, its lore by a real tap.
    { const { ctx, page } = await fresh(); await open(page, () => SP.unlockTo(24)); const bn = '.jr-sheet[data-sheet="4"] .bn'; await toMid(page, bn); await page.waitForTimeout(150); await drawn(page);
      const l = page.locator(bn); if (vp.ctx.hasTouch) await l.tap(); else await l.click(); await page.waitForTimeout(200);
      N.banner = await ev(page, (q) => ({ label: document.querySelector(q).getAttribute("aria-label"), lore: document.querySelector(q + " .lore").textContent, open: document.querySelector(q).classList.contains("open") }), bn); await snap(page, "realm-banner"); await ctx.close(); }
    // An egg before, mid pop, after (real taps).
    { const { ctx, page } = await fresh(); await open(page, () => {}); const egg = '.egg[data-id="s1-0"]'; await toMid(page, egg); await page.waitForTimeout(150); await drawn(page); await snap(page, "egg-before");
      const c0 = await ev(page, () => SP.meta().coins), l = page.locator(egg); if (vp.ctx.hasTouch) await l.tap(); else await l.click(); await page.waitForTimeout(220); await snap(page, "egg-pop");
      await page.waitForTimeout(1300); await snap(page, "egg-after"); N.egg = { paid: (await ev(page, () => SP.meta().coins)) - c0, label: await l.getAttribute("aria-label"), coinsShown: await page.textContent("#map-coins b") }; await ctx.close(); }
    // v5 R3 fix pass: one shot per fix (the header lists them); `at`: a node to bring to the middle, `tap`: a real tap first.
    const fixes = [
      ["fix-all-clear", () => { SP.unlockTo(1e3); SP.clearPictures(60); }],
      ["fix-tail-row", () => { SP.unlockTo(1e3); SP.clearPictures(55); }],
      ["fix-tail-sheet", () => { SP.unlockTo(1e3); SP.clearPictures(59); }, null, ".tchip"],
      ["fix-sheet8-60", () => SP.unlockTo(74), '.mn[data-n="60"]'],
      ["fix-banner-r4", () => SP.unlockTo(74), '.jr-sheet[data-sheet="10"] .bn', '.jr-sheet[data-sheet="10"] .bn'],
      ["fix-cur-81", () => SP.unlockTo(80)],
      ["fix-quest-23", () => SP.unlockTo(92), '.jr-sheet[data-sheet="12"] .qn'],
      ["fix-playbar", () => SP.unlockTo(5)],
      ["fix-nextup", () => { SP.unlockTo(55); SP.clearPictures(3); }]];
    for (const [name, setup, at, tap] of fixes) { const { ctx, page } = await fresh(); await open(page, setup); if (at) { await toMid(page, at); await page.waitForTimeout(150); await drawn(page); }
      if (tap) { const l = page.locator(tap).first(); if (vp.ctx.hasTouch) await l.tap(); else await l.click(); await page.waitForTimeout(350); }
      N[name] = await ev(page, () => ({ play: document.getElementById("map-play").hidden ? null : document.getElementById("map-play").textContent, end: document.getElementById("jr-end").hidden ? null : document.getElementById("jr-end").textContent,
        card: document.getElementById("jr-n-name").textContent, quest: document.getElementById("jr-quest").hidden ? null : document.getElementById("jr-quest").textContent,
        tiles: Array.from(document.querySelectorAll("#jr .th, #jr .tchip, #ts-grid .ts-tile")).filter((b) => b.getBoundingClientRect().width > 0).map((b) => Math.round(Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))) }));
      await snap(page, name); await ctx.close(); }
    // The home, mid-campaign.
    { const { ctx, page } = await fresh(); await ev(page, () => { SP.unlockTo(30); SP.screen("title"); }); await page.waitForTimeout(400); await snap(page, "home"); await ctx.close(); }
    // Scroll frame times on the phone, CPU throttled 4x: a programmatic scroll down the map, 40 px a frame.
    if (vp.name === "phone") { const { ctx, page } = await fresh(); await open(page, () => SP.unlockTo(60)); const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      N.scroll = await ev(page, () => new Promise((done) => { const sc = document.getElementById("jr"), dt = []; let last = performance.now(), k = 0;
        const f = (t) => { dt.push(t - last); last = t; sc.scrollTop -= 40; if (++k < 150) requestAnimationFrame(f); else { dt.shift(); dt.sort((a, b) => a - b); done({ frames: dt.length, median: +dt[dt.length >> 1].toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), max: +dt[dt.length - 1].toFixed(1), loaded: SP.map().loaded }); } };
        requestAnimationFrame(f); }));
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await ctx.close(); }
  }
} catch (e) { log.push("crashed: " + ((e && e.stack) || e)); }
await browser.close(); clearTimeout(wall);
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, null, 1));
console.log(log.length ? "SHOTS: " + log.length + " console messages\n" + log.join("\n") : "SHOTS: 0 console errors or warnings");
process.exit(log.length ? 1 : 0);
