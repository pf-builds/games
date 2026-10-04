#!/usr/bin/env node
// Sapper's Path v4.3 fix pass: before/after screens for the visual critic's findings, into tools/shots-v4.3/fix/<tag>-*.png
// (gitignored), with measurements in tools/shots-v4.3/fix/<tag>-notes.json. Headless Chromium via Playwright.
//   T1  home-hard / home-easy (375x812, 1280x720, the 400x600 page), map-play (375), gallery-play (375): the Play buttons
//       and the next level's tag.
//   m6  map (375): the Easy and Hard pills, with their contrast.
//   m2  linked-1280: the linked refusal's toast on a wide screen, and its distance from the tapped card.
//   m1  pickup (375): the line head the moment a squad's space frees while its carriers walk home.
//   m4  gallery-wall (375): the locked wall (tags, a painting's tile).
//   m3  report (375): a first clear's report while the coins count up.
//   m5  fail-1280: the fail sheet on a wide screen.
//   n1  board-360x640, board-360x740: a full-screen board on a 360-wide phone, with its cell size.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v4.3-fix.mjs --tag before|after [--url URL]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), TAG = arg("tag", "after"), OUT = resolve(here, "shots-v4.3", "fix");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 420000);

async function open(w, h, dpr, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(w + "x" + h + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(w + "x" + h + " pageerror: " + e.message));
  await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
  return { ctx, page };
}
const snap = (page, name) => page.screenshot({ path: resolve(OUT, TAG + "-" + name + ".png") });
// WCAG contrast of an element's text on its background.
const contrastJS = `(el) => { const p = (c) => c.match(/[\\d.]+/g).slice(0, 3).map(Number), L = (rgb) => { const f = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  const cs = getComputedStyle(el), a = L(p(cs.color)), b = L(p(cs.backgroundColor)); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); }`;

try {
  // T1 at three sizes: the home with the next level Hard (6), then Easy (11).
  for (const [vt, w, h, dpr, touch] of [["375", 375, 812, 2, true], ["1280", 1280, 720, 1, false], ["400", 400, 600, 2, false]]) {
    const { ctx, page } = await open(w, h, dpr, touch);
    for (const [name, n] of [["home-hard", 5], ["home-easy", 10]]) {
      notes[vt + "-" + name] = await page.evaluate((n) => { SP.unlockTo(n); SP.screen("title"); const b = document.getElementById("btn-play"), t = b.querySelector(".tag");
        return { label: b.textContent.trim(), tag: t && !t.hidden ? t.textContent : null, face: getComputedStyle(b).backgroundColor, cls: b.className }; }, n);
      await page.waitForTimeout(150); await snap(page, vt + "-" + name);
    }
    await ctx.close();
  }
  { const { ctx, page } = await open(375, 812, 2, true), ev = (f, a) => page.evaluate(f, a);
    // T1 on the map's Play, then m6 on the map's pills.
    notes.map = await ev(new Function("c", `const contrast = ${contrastJS}; SP.unlockTo(5); SP.screen("map"); document.querySelector("#eras .era:not(.dbg)").scrollIntoView({ block: "start" });
      const e = document.querySelector(".node .tag.tag-easy"), h = document.querySelector(".node .tag.tag-hard"), mp = document.getElementById("map-play");
      return { easy: contrast(e), hard: contrast(h), mapPlay: mp.textContent.trim(), mapTag: (mp.querySelector(".tag") || {}).textContent || null };`));
    await page.waitForTimeout(150); await snap(page, "375-map");
    // m1: the line head the moment the first squad's space frees while its carriers walk home.
    notes.pickup = await ev(() => { let n = 27; for (; n <= 100; n++) if (SP.load(n).tag === "normal") break; const o = SP.winOrder(); SP.play(+o[0]); let seen = null;
      for (let t = 0; t < 30000 && !seen; t += 16) { const s = SP.tick(16); if (s.line.length === 0 && s.out > 0) seen = s; }
      return { n, head: document.getElementById("line-head").textContent.replace(/\s+/g, " ").trim(), out: seen && seen.out }; });
    await snap(page, "375-pickup");
    // m3: a first clear's report while the coins count up (level 15, Hard, not yet cleared: unlockTo(5) above).
    notes.report = await ev(() => { SP.load(15); const o = SP.winOrder(); for (const c of o) { SP.play(+c); for (let i = 0; i < 6000 && SP.state().busy; i++) SP.tick(16); }
      for (let i = 0; i < 2000 && !SP.state().panel; i++) SP.tick(16); SP.tick(500);
      const st = document.getElementById("p-stats"), rb = document.getElementById("p-ribbon"); return { panel: SP.state().panel, coins: document.getElementById("p-coins").textContent, ribbon: rb && !rb.hidden ? rb.textContent : null, burst: st.querySelectorAll(".burst i, .coinburst i").length }; });
    await page.waitForTimeout(900); await snap(page, "375-report"); // the sheet slides in and the ribbon stamps on real time
    // (after the report: unlocking the Gallery clears levels 1-25) T1 on the Gallery's Play chip (the next picture Hard: 5), then m4 the locked wall.
    notes.galleryPlay = await ev(() => { SP.unlockGallery(); SP.clearPictures(4); SP.screen("gallery"); window.scrollTo(0, 0); const nx = document.querySelector(".gal-tile.next"), gp = nx && nx.querySelector(".gp");
      return { next: nx && nx.getAttribute("aria-label"), chip: gp && gp.textContent, chipFace: gp && getComputedStyle(gp).backgroundColor }; });
    await page.waitForTimeout(200); await snap(page, "375-gallery-play");
    notes.galleryWall = await ev(() => { const t = Array.from(document.querySelectorAll(".gal-tile.locked")), tg = t.map((x) => x.querySelector(".tag")).filter((x) => x && !x.hidden), pt = Array.from(document.querySelectorAll(".gal-tile")).find((x, k) => x.classList.contains("locked") && SP.gallery()[k].indexOf("g-met-") === 0);
      if (pt) pt.scrollIntoView({ block: "center" }); return { lockedTagOpacity: tg.length ? +getComputedStyle(tg[0]).opacity : null, painting: pt ? pt.getAttribute("aria-label") : null }; });
    await page.waitForTimeout(200); await snap(page, "375-gallery-wall");
    await ctx.close(); }
  { const { ctx, page } = await open(1280, 720, 1, false), ev = (f, a) => page.evaluate(f, a);
    // m2: the linked refusal on a wide screen (v4-all at load): the toast's distance from the tapped card.
    notes.linked1280 = await ev(() => { SP.load("v4-all"); SP.tick(40); const cards = Array.from(document.querySelectorAll("#tray .card")), j = cards.findIndex((b) => b.classList.contains("waitpair")); cards[j].click(); SP.tick(80);
      const t = document.getElementById("toast").getBoundingClientRect(), c = cards[j].getBoundingClientRect(), d = Math.hypot((t.left + t.right) / 2 - (c.left + c.right) / 2, (t.top + t.bottom) / 2 - (c.top + c.bottom) / 2);
      return { dist: Math.round(d), font: getComputedStyle(document.getElementById("toast")).fontSize, toast: [Math.round(t.left), Math.round(t.top), Math.round(t.width), Math.round(t.height)], card: [Math.round(c.left), Math.round(c.top)] }; });
    await snap(page, "1280-linked");
    // m5: the fail sheet on a wide screen (a patient order that jams).
    notes.fail1280 = await ev(() => { let p = null, n = 46; for (; n <= 75 && !p; n++) { SP.load(n); p = SP.lossPlan(); } n--; SP.load(n); for (const c of p.prefix) { SP.play(+c); SP.settle(); }
      for (let i = 0; i < 3000 && !SP.state().panel; i++) SP.tick(16); SP.tick(600); const card = document.querySelector("#panel .sheetcard"), r = card.getBoundingClientRect();
      let lo = 1e9, hi = 0; for (const el of card.children) { if (el.hidden || !el.getBoundingClientRect().height) continue; const q = el.getBoundingClientRect(); lo = Math.min(lo, q.top); hi = Math.max(hi, q.bottom); }
      return { n, sheet: Math.round(r.height), content: Math.round(hi - lo), blank: Math.round(r.height - (hi - lo)) }; });
    await page.waitForTimeout(600); await snap(page, "1280-fail");
    await ctx.close(); }
  // n1: a full-screen board on 360-wide phones.
  for (const [w, h] of [[360, 640], [360, 740]]) {
    const { ctx, page } = await open(w, h, 3, true);
    notes["board-" + w + "x" + h] = await page.evaluate(() => { const r = []; for (const n of [27, 64, 100]) { const s = SP.load(n); SP.tick(40); r.push({ n, px: +(s.cs / devicePixelRatio).toFixed(2) }); } SP.load(64); SP.tick(40); return r; });
    await page.waitForTimeout(150); await snap(page, "board-" + w + "x" + h);
    await ctx.close();
  }
} catch (e) { log.push("crashed: " + (e && e.stack || e)); }
await browser.close(); clearTimeout(wall);
writeFileSync(resolve(OUT, TAG + "-notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, null, 1));
console.log(log.length ? "SHOTS: " + log.length + " console messages\n" + log.join("\n") : "SHOTS: 0 console errors or warnings");
process.exit(log.length ? 1 : 0);
