#!/usr/bin/env node
// Sapper's Path v5 R2 (the re-lay) screens, into tools/shots-v5-r2/ (gitignored). Headless Chromium via Playwright, drawn
// by the game's own renderer:
//   contact-1-100.png    every Siege level at rest (its board canvas at load, 10 a row, the number and tag under each).
//   side-quests.png      the Gallery standing in for R3's side quests: levels 1-40 cleared, so the quests after 4-40 are
//                        open and the rest are padlocked; each tile wears its prize (a power-up) until its first clear.
//   realm-1..5.png       a level from each realm at load (375x812): 10, 30, 60, 85, 100.
//   lock-colour.png      level 53 (Hard): the colour lock (the last space shows its colour) and its coach line.
//   lock-key.png         level 87 (Hard): the key lock (the padlocked space, the key ringed) and its coach line.
//   lore-map.png, lore-map-2.png   the map's realm sections with their names and lore.
// Measurements go to tools/shots-v5-r2/notes.json. Exit 1 on a console error or warning.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v5-r2.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v5-r2");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 300000);
const png = (dataUrl, name) => writeFileSync(resolve(OUT, name + ".png"), Buffer.from(dataUrl.split(",")[1], "base64"));

try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push("pageerror: " + e.message));
  await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
  const ev = (fn, a) => page.evaluate(fn, a), snap = (name) => page.screenshot({ path: resolve(OUT, name + ".png") });
  // 1. The contact sheet: each board's canvas at load, scaled into a 10 x 10 grid with its number and tag.
  const sheet = await ev(() => { const cell = 150, lab = 22, out = document.createElement("canvas"); out.width = 10 * cell; out.height = 10 * (cell + lab); const g = out.getContext("2d");
    g.fillStyle = "#1a1620"; g.fillRect(0, 0, out.width, out.height); g.font = "16px sans-serif"; g.textBaseline = "top"; const rows = [];
    for (let n = 1; n <= 100; n++) { const s = SP.load(n); SP.tick(20); const c = document.getElementById("board"), k = Math.min(cell / c.width, (cell - 4) / c.height), w = c.width * k, h = c.height * k, x = ((n - 1) % 10) * cell, y = Math.floor((n - 1) / 10) * (cell + lab);
      g.drawImage(c, x + (cell - w) / 2, y + (cell - h) / 2, w, h); g.fillStyle = s.tag === "hard" ? "#ff7a5c" : s.tag === "easy" ? "#6fd6c4" : "#f3ead8"; g.fillText(n + " " + s.tag, x + 4, y + cell + 2); rows.push(n + ":" + s.tag + ":" + s.id); }
    return { url: out.toDataURL("image/png"), rows }; });
  png(sheet.url, "contact-1-100"); notes.contact = sheet.rows.join(" ");
  // 2. A level from each realm at load, then each lock type with its coach line.
  for (const [k, n] of [[1, 10], [2, 30], [3, 60], [4, 85], [5, 100]]) { notes["realm" + k] = await ev((n) => { const s = SP.load(n); SP.tick(40); return { n, id: s.id, tag: s.tag, name: document.getElementById("lvl-name").textContent }; }, n); await page.waitForTimeout(150); await snap("realm-" + k); }
  for (const [name, n] of [["lock-colour", 53], ["lock-key", 87]]) { notes[name] = await ev((n) => { const s = SP.load(n); SP.tick(40); const last = document.querySelectorAll("#line .slot"); const sl = last[last.length - 1];
    return { n, tag: s.tag, coach: document.getElementById("coach").textContent, slot: sl ? sl.className + " | " + sl.getAttribute("aria-label") : "" }; }, n); await page.waitForTimeout(150); await snap(name); }
  // 3. The map's realm sections (names and lore), two screens.
  notes.lore = await ev(() => { SP.screen("map"); const secs = Array.from(document.querySelectorAll("#eras .era:not(.dbg)")); secs[0].scrollIntoView({ block: "start" });
    return secs.map((s) => s.querySelector(".eye span").textContent + " | " + s.querySelector("h3").textContent + " | " + s.querySelector("p").textContent); });
  await page.waitForTimeout(200); await snap("lore-map");
  await ev(() => { const secs = Array.from(document.querySelectorAll("#eras .era:not(.dbg)")); secs[3].scrollIntoView({ block: "start" }); }); await page.waitForTimeout(200); await snap("lore-map-2");
  // 4. The side quests in the interim Gallery: levels 1-40 cleared.
  notes.quests = await ev(() => { SP.unlockTo(40); SP.screen("gallery"); const t = Array.from(document.querySelectorAll("#gal-grid .gal-tile")); document.getElementById("gallery").scrollTop = 0; window.scrollTo(0, 0);
    return { open: t.filter((x) => !x.classList.contains("locked")).length, prize: t.filter((x) => x.classList.contains("prize")).length, first: t.slice(0, 12).map((x) => x.getAttribute("aria-label")) }; });
  await page.waitForTimeout(250); await snap("side-quests");
  await ctx.close();
} catch (e) { log.push("crashed: " + (e && e.stack || e)); }
await browser.close(); clearTimeout(wall);
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, null, 1).slice(0, 4000));
console.log(log.length ? "SHOTS: " + log.length + " console messages\n" + log.join("\n") : "SHOTS: 0 console errors or warnings");
process.exit(log.length ? 1 : 0);
