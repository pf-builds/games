#!/usr/bin/env node
// Sapper's Path v5 R4c (the journey map for levels 101-200) screens and checks, into tools/shots-v5-r4-map/ (gitignored).
// Two states of the game, each at 375x812 (touch, 3x) as phone-<name>.png and 1280x720 (1x) as desktop-<name>.png:
//   today (levels.json as it is, 1-100): the map stops at level 101's spot on sheet 13, in fog; nothing past it is built.
//     today-fresh   a new save (the bottom of the map; nothing broken).
//     today-100     levels 1-99 cleared: level 100 current under the fog, the Goblin King's teaser in the wash.
//     today-tail    every level and pictures 1-25 cleared: the long tail's node (picture 26) at level 101's spot.
//   fake200 (levels.json served with 101-200 cloned from 1-100, eras 6-8 added to config: what the merge brings):
//     r5-111, r6-137, r7-160, r8-185   a current node in each new realm (sheet 17's stone bridges in r6-137).
//     summit        levels 1-199 cleared: level 200 current at the fortress, the Goblin King beside it.
//     tail-200      every level and pictures 1-50 cleared: the long tail's node (picture 51) in the fog past 200.
//     tail-200-row  pictures 1-55 cleared: the row of the latest won and the chip.
//     eggs-r6       levels 1-130 cleared: sheet 16's lava bubble and ember sprite, then both tapped (found looks).
// The overlap audit also runs at every current level from 100 to 200 and the long tail (fake200), pictures won as they open:
// a report (labels grazing a neighbour's node are as common as in R3's 1-99), not a failure.
// Per state and viewport SP.selfTest() runs once (today and fake200 at each viewport) and SP.map() is recorded; every
// open, side quest and egg is checked for overlap with the labels and bubbles (the selfTest rule, here at every state).
// Exit 1 on any console error or warning, or a selfTest failure.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v5-r4-map.mjs [--url http://127.0.0.1:8495/sappers-path/]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8495/sappers-path/"), OUT = resolve(here, "shots-v5-r4-map");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {}, fails = [];
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 900000);
const VPS = [{ name: "phone", ctx: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } }, { name: "desktop", ctx: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } }];

// The merge's levels, faked: 101-200 cloned from 1-100 (ids f-<n>, their realm by number), and lore for realms 6-8.
const LV = JSON.parse(readFileSync(resolve(here, "../levels/levels.json"), "utf8")), CFG = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8"));
const realmOf = (n) => (n < 25 ? 1 : Math.min(8, 1 + Math.floor(n / 25)));
const FAKE = Object.assign({}, LV, { levels: LV.levels.concat(LV.levels.map((L) => Object.assign({}, L, { id: "f-" + (+L.n + 100), n: +L.n + 100, era: realmOf(+L.n + 100) }))) });
const FCFG = Object.assign({}, CFG, { eras: CFG.eras.concat([[6, "Emberwatch Crags"], [7, "The Shrouded Weald"], [8, "The Goblin King's Throne"]].map(([era, name]) => ({ era, name, note: "(test lore for the screens)" }))) });

try {
  for (const mode of ["today", "fake200"]) for (const vp of VPS) {
    const N = (notes[mode + "-" + vp.name] = {});
    const fresh = async (keepDbg) => { const ctx = await browser.newContext(vp.ctx), page = await ctx.newPage();
      if (mode === "fake200") { await page.route(/levels\/levels\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(FAKE) }));
        await page.route(/\/config\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(FCFG) })); }
      page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(mode + " " + vp.name + " " + m.type() + ": " + m.text()); });
      page.on("pageerror", (e) => log.push(mode + " " + vp.name + " pageerror: " + e.message));
      await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
      await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
      if (!keepDbg) await page.evaluate(() => { document.getElementById("jr-dbg").remove(); }); return { ctx, page }; };
    const ev = (page, fn, a) => page.evaluate(fn, a);
    const drawn = (page) => page.waitForFunction(() => { const r = Array.from(document.querySelectorAll(".jr-img")).filter((i) => i.getAttribute("src")); return r.length > 0 && r.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 15000, polling: 50 });
    const open = async (page, setup) => { await ev(page, setup); await ev(page, () => SP.screen("map")); await drawn(page); await page.waitForTimeout(250); };
    const snap = (page, name) => page.screenshot({ path: resolve(OUT, vp.name + "-" + name + ".png") });
    const toMid = (page, sel) => ev(page, (q) => { const el = document.querySelector(q), sc = document.getElementById("jr"); sc.scrollTop += el.getBoundingClientRect().top + el.offsetHeight / 2 - sc.getBoundingClientRect().top - sc.clientHeight / 2; }, sel);
    // What the map built and whether a label or bubble covers another node (more than 8x8 CSS px), and every shown
    // button's hit test at its centre (when on screen).
    const audit = (page) => ev(page, () => { const tg = Array.from(document.querySelectorAll("#jr .mn, #jr .qn:not([hidden]), #jr .egg:not([hidden])")), bad = [], miss = [];
      const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      for (const el of Array.from(document.querySelectorAll("#jr .qn.open .prz, #jr .jr-cur"))) { const r = el.getBoundingClientRect(); if (!r.width) continue; const own = el.closest(".qn, .mn");
        for (const x of tg) if (x !== own && !x.contains(el) && ov(r, x.getBoundingClientRect()) > 64) bad.push((own ? own.dataset.id || own.dataset.n : "label") + " x " + (x.dataset.id || x.dataset.n)); }
      for (const x of tg) { const r = x.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cy < 60 || cy > innerHeight - 90 || cx < 0 || cx > innerWidth) continue; const h = document.elementFromPoint(cx, cy); if (!h || !(h === x || x.contains(h))) miss.push(x.dataset.id || x.dataset.n); }
      const m = SP.map(); return Object.assign(m, { built: document.querySelectorAll("#jr .jr-sheet").length, levels: document.querySelectorAll("#jr .mn").length, quests: document.querySelectorAll("#jr .qn:not(.tailn)").length,
        eggs: document.querySelectorAll("#jr .egg").length, eggsShown: document.querySelectorAll("#jr .egg:not([hidden])").length, banners: document.querySelectorAll("#jr .bn").length, bridges: document.querySelectorAll("#jr .br").length,
        play: document.getElementById("map-play").hidden ? null : document.getElementById("map-play").textContent, overlaps: bad, unhittable: miss }); });
    // selfTest, once per mode and viewport.
    { const { ctx, page } = await fresh(true); const st = await ev(page, () => SP.selfTest()); N.selfTest = { pass: st.pass, fail: st.fail, ms: st.ms }; if (st.fail.length) fails.push(mode + " " + vp.name + " selfTest: " + st.fail.join("; ")); await ctx.close(); }
    const states = mode === "today"
      ? [["today-fresh", () => {}], ["today-100", () => SP.unlockTo(99)], ["today-tail", () => { SP.unlockTo(100); SP.clearPictures(25); }]]
      : [["r5-111", () => SP.unlockTo(110)], ["r6-137", () => SP.unlockTo(136)], ["r7-160", () => SP.unlockTo(159)], ["r8-185", () => SP.unlockTo(184)],
        ["summit", () => SP.unlockTo(199)], ["tail-200", () => { SP.unlockTo(200); SP.clearPictures(50); }], ["tail-200-row", () => { SP.unlockTo(200); SP.clearPictures(55); }]];
    for (const [name, setup] of states) { const { ctx, page } = await fresh(); await open(page, setup); N[name] = await audit(page); if (N[name].overlaps.length || N[name].unhittable.length) fails.push(mode + " " + vp.name + " " + name + ": overlaps " + N[name].overlaps.join(", ") + " unhittable " + N[name].unhittable.join(", "));
      await snap(page, name); await ctx.close(); }
    // The overlap audit at every current level past 99 (fake200; R3's audit covered 1-100): levels cleared one at a time.
    if (mode === "fake200") { const { ctx, page } = await fresh(); await open(page, () => SP.unlockTo(99)); const bad = [];
      for (let n = 99; n <= 200; n++) { await ev(page, (k) => { SP.unlockTo(k); SP.clearPictures(Math.max(0, Math.min(60, Math.floor((k - 4) / 4)))); SP.screen("map"); }, n);
        const a = await ev(page, () => { const tg = Array.from(document.querySelectorAll("#jr .mn, #jr .qn:not([hidden]), #jr .egg:not([hidden])")), out = [];
          const ov = (p, q) => Math.max(0, Math.min(p.right, q.right) - Math.max(p.left, q.left)) * Math.max(0, Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top));
          for (const el of Array.from(document.querySelectorAll("#jr .qn.open .prz, #jr .jr-cur"))) { const r = el.getBoundingClientRect(); if (!r.width) continue; const own = el.closest(".qn, .mn");
            for (const x of tg) if (x !== own && !x.contains(el) && ov(r, x.getBoundingClientRect()) > 64) out.push((own ? own.dataset.id || own.dataset.n : "label") + " x " + (x.dataset.id || x.dataset.n));
            for (const y of Array.from(document.querySelectorAll("#jr .qn.open .prz, #jr .jr-cur"))) if (y !== el && ov(r, y.getBoundingClientRect()) > 64) out.push((own ? own.dataset.id || own.dataset.n : "label") + " x bubble " + (y.closest(".qn") ? y.closest(".qn").dataset.id : "label")); }
          return out; });
        for (const x of a) if (bad.indexOf(n + ": " + x) < 0) bad.push(n + ": " + x); }
      N.auditPast99 = bad; console.log(mode + " " + vp.name + " audit 99-200 (a report, R3's 1-99 under the same rule: 19 on the phone): " + bad.length + (bad.length ? ": " + bad.join("; ") : "")); await ctx.close(); }
    if (mode === "fake200") { const { ctx, page } = await fresh(); await open(page, () => SP.unlockTo(130)); const e0 = '.egg[data-id="s16-0"]', e1 = '.egg[data-id="s16-1"]';
      await toMid(page, e0); await page.waitForTimeout(150); await drawn(page); await snap(page, "eggs-r6");
      const c0 = await ev(page, () => SP.meta().coins); for (const q of [e0, e1]) { const l = page.locator(q); await toMid(page, q); await page.waitForTimeout(100); if (vp.ctx.hasTouch) await l.tap(); else await l.click(); await page.waitForTimeout(200); }
      await toMid(page, e0); await page.waitForTimeout(1300); await snap(page, "eggs-r6-found"); N.eggsR6 = { paid: (await ev(page, () => SP.meta().coins)) - c0 }; await ctx.close(); }
  }
} catch (e) { log.push("crashed: " + ((e && e.stack) || e)); }
await browser.close(); clearTimeout(wall);
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, (k, v) => (k === "fail" && Array.isArray(v) ? v.length : v), 1));
console.log(fails.length ? "FAILS:\n" + fails.join("\n") : "FAILS: none");
console.log(log.length ? "SHOTS: " + log.length + " console messages\n" + log.join("\n") : "SHOTS: 0 console errors or warnings");
process.exit(log.length || fails.length ? 1 : 0);
