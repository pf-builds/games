#!/usr/bin/env node
// Sapper's Path v4.3 (fixed tags, the space freeing at pickup, linked squads at the front, the Gallery in order) screens,
// into tools/shots-v4.3/ (gitignored). Headless Chromium via Playwright, drawn by the game's own renderer, at 375x812
// (dpr 2, touch):
//   tags-map.png         the Siege map's first era: every level button wears its tag (Hard red, Easy teal, Normal none).
//   hard-header.png      a Hard level at load: the top bar's Hard tag over a 4-space line.
//   linked-buried.png    v4-all (?debug=1) at load: a linked front card whose partner is buried waits (dashed edge, chain
//                        badge); a tap on it is refused with the toast.
//   pickup-free.png      a Normal level mid-show: the first squad's last block picked up, its space already free while
//                        its carriers walk home (the line head counts it free).
//   gallery-locked.png   the Gallery with its first three pictures cleared: the fourth wears the gold frame and Play
//                        chip, the rest are padlocked silhouettes.
//   report.png           a Hard level's report: the tag under the title, time, taps and coins, no medals.
// Measurements go to tools/shots-v4.3/notes.json. Exit 1 on a console error or warning.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v4.3.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v4.3");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 300000);

try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push("pageerror: " + e.message));
  await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
  const ev = (fn, a) => page.evaluate(fn, a), snap = (name) => page.screenshot({ path: resolve(OUT, name + ".png") });
  // 1. The map: the first era's buttons with their tags (levels 1-12 cleared so the row reads as a campaign under way).
  notes.tagsMap = await ev(() => { SP.unlockTo(12); SP.screen("map"); const sec = document.querySelector("#eras .era:not(.dbg)"); sec.scrollIntoView({ block: "start" });
    return Array.from(sec.querySelectorAll(".node")).slice(0, 25).map((b) => b.textContent).join(" "); });
  await page.waitForTimeout(200); await snap("tags-map");
  // 2. A Hard level at load.
  notes.hardHeader = await ev(() => { const n = Array.from({ length: 100 }, (_, k) => k + 1).find((k) => k > 25 && SP.load(k).tag === "hard"); const s = SP.load(n); SP.tick(40);
    return { n: s.n, tag: s.tag, cap: s.cap, chip: document.getElementById("tag-chip").textContent }; });
  await page.waitForTimeout(150); await snap("hard-header");
  // 3. A linked front card waiting for its buried partner (v4-all), tapped: refused, the toast.
  notes.linkedBuried = await ev(() => { SP.load("v4-all"); SP.tick(40); const cards = Array.from(document.querySelectorAll("#tray .card")), j = cards.findIndex((b) => b.classList.contains("waitpair"));
    if (j >= 0) { cards[j].click(); SP.tick(120); } return { col: j, toast: document.getElementById("toast").textContent, aria: j >= 0 ? cards[j].getAttribute("aria-label") : "" }; });
  await page.waitForTimeout(150); await snap("linked-buried");
  // 4. The space freeing at pickup: a Normal level's first squad, the moment its space frees with carriers still out.
  notes.pickup = await ev(() => { let n = 27; for (; n <= 100; n++) if (SP.load(n).tag === "normal") break; const o = SP.winOrder(); SP.play(+o[0]);
    const s0 = SP.state(); let seen = null; for (let t = 0; t < 30000 && !seen; t += 16) { const s = SP.tick(16); if (s.line.length < s0.line.length + 0 && s.out > 0) seen = s; }
    const head = document.getElementById("line-cnt").textContent; return seen ? { n, ms: seen.now, out: seen.out, runners: seen.runners, line: seen.line.length, head } : { n, none: true }; });
  await snap("pickup-free");
  // 5. A Hard level's report (a patient win on its stored order; one past the 12 cleared above, so a first clear).
  notes.report = await ev(() => { const n = Array.from({ length: 25 }, (_, k) => k + 1).find((k) => k > 12 && SP.load(k).tag === "hard"); SP.load(n); const o = SP.winOrder();
    for (const c of o) { SP.play(+c); for (let i = 0; i < 6000 && SP.state().busy; i++) SP.tick(16); } const s = SP.tick(9000);
    return { n, panel: s.panel, tag: document.getElementById("p-tag").textContent, medals: document.querySelectorAll(".medal").length, line: document.getElementById("p-line").textContent }; });
  await page.waitForTimeout(300); await snap("report");
  // 6. The Gallery in order (after the report: unlocking it clears levels 1-25): three pictures cleared, the fourth next, the rest locked.
  notes.gallery = await ev(() => { SP.unlockGallery(); SP.clearPictures(3); SP.screen("gallery"); const t = Array.from(document.querySelectorAll("#gal-grid .gal-tile"));
    document.getElementById("gallery").scrollTop = 0; window.scrollTo(0, 0); return { cleared: t.filter((x) => x.classList.contains("done")).length, next: t.findIndex((x) => x.classList.contains("next")), locked: t.filter((x) => x.classList.contains("locked")).length }; });
  await page.waitForTimeout(250); await snap("gallery-locked");
  await ctx.close();
} catch (e) { log.push("crashed: " + (e && e.stack || e)); }
await browser.close(); clearTimeout(wall);
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, null, 1));
console.log(log.length ? "SHOTS: " + log.length + " console messages\n" + log.join("\n") : "SHOTS: 0 console errors or warnings");
process.exit(log.length ? 1 : 0);
