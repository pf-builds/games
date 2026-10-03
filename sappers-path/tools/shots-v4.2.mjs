#!/usr/bin/env node
// Sapper's Path v4.2 (full-screen boards from level 26) screens, into tools/shots-v4.2/ (gitignored). Headless Chromium via
// Playwright, drawn by the game's own renderer. (Made from tools/shots-v4.1.mjs.)
//   contact-sheet.png: the Siege boards 26-100 at rest (each board canvas copied in the page into one sheet, numbered).
//   gallery-sheet.png: all 60 Gallery boards at rest.
//   At 375x812 (dpr 2, touch) and 1280x720 (dpr 1): one level per era at rest and mid-swarm (the front squad with the most
//     sappers in reach, 1.5 s out: sappers leaving their crates and coming up through the entry square), the boss (100) at rest and mid-swarm, two
//     teaching levels with their coaches (1 and 26), two Gallery pictures mid-swarm.
//   At every harness viewport (375x812, 375x667, 414x736, 812x375, 1280x720 and a 400x600 page): the Siege and the
//     Gallery board with the smallest cells.
// Measurements go to tools/shots-v4.1/notes.json. Exit 1 on a console error or warning.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v4.1.mjs [--url http://127.0.0.1:8491/sappers-path/]
//   [--sheet NAME]  the Siege contact sheet's name (v4.1 fix: contact-sheet-fix); the smallest-cell notes also give each
//   era's smallest cells and the boss's (the visual critic's m3)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v4.2");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 600000);
const ERAS = [8, 40, 64, 88], TEACH = [26, 77], GAL = ["g-tw-1f355", "g-noto-1f431"];

async function open(w, h, dpr, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(w + "x" + h + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(w + "x" + h + " pageerror: " + e.message));
  await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
  await page.evaluate(() => SP.unlockGallery && SP.unlockGallery());
  return { ctx, page };
}
const ev = (page, fn, a) => page.evaluate(fn, a);
const snap = (page, name) => page.screenshot({ path: resolve(OUT, name + ".png") });

// Every board of a list at rest, copied into one canvas in the page (cols columns, a caption under each).
async function sheet(name, which, cols) {
  const { ctx, page } = await open(1280, 720, 1, false);
  const png = await ev(page, ([which, cols]) => {
    const ids = which === "gallery" ? SP.gallery() : Array.from({ length: 75 }, (_, k) => k + 26);
    const cell = 220, capH = 22, rows = Math.ceil(ids.length / cols), c = document.createElement("canvas"); c.width = cols * cell; c.height = rows * (cell + capH); const g = c.getContext("2d");
    g.fillStyle = "#221a26"; g.fillRect(0, 0, c.width, c.height); g.font = "15px 'Jersey 10', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    ids.forEach((id, k) => { const st = SP.load(id, "normal"); SP.tick(16); const b = document.getElementById("board"), s = Math.min((cell - 8) / b.width, (cell - 8) / b.height), w = b.width * s, h = b.height * s, x = (k % cols) * cell, y = ((k / cols) | 0) * (cell + capH);
      g.imageSmoothingEnabled = false; g.drawImage(b, x + (cell - w) / 2, y + (cell - h) / 2, w, h); g.fillStyle = "#f3ead8"; g.fillText(st.n + ". " + document.getElementById("lvl-name").textContent + " " + st.w + "x" + st.h, x + cell / 2, y + cell + capH / 2 - 2); });
    return c.toDataURL().split(",")[1]; }, [which, cols]);
  writeFileSync(resolve(OUT, name + ".png"), Buffer.from(png, "base64"));
  await ctx.close();
}

async function screens(tag, w, h, dpr, touch) {
  const { ctx, page } = await open(w, h, dpr, touch);
  const rest = (id) => { SP.speed(1); const s = SP.load(id, "normal"); SP.tick(40); return { id: s.id, cs: +(s.cs / devicePixelRatio).toFixed(2), board: s.w + "x" + s.h, coach: SP.coach().text }; };
  // Mid-swarm: the front card with the most sappers that have a block in reach goes; 1.5 s later.
  const mid = () => { const f = SP.state().fronts; let j = 0, k = -1; f.forEach((c, q) => { const go = c ? Math.min(c.n, SP.reachable(c.mat)) : 0; if (go > k) { k = go; j = q; } }); SP.play(j); SP.tick(1500); return SP.entry(); };
  for (const n of ERAS.concat([100])) {
    notes[tag + "-l" + n + "-rest"] = await ev(page, rest, n); await snap(page, tag + "-l" + n + "-rest");
    notes[tag + "-l" + n + "-mid"] = await ev(page, mid); await snap(page, tag + "-l" + n + "-mid");
  }
  for (const n of TEACH) { notes[tag + "-teach-l" + n] = await ev(page, rest, n); await page.waitForTimeout(150); await snap(page, tag + "-teach-l" + n); }
  for (const id of GAL) { await ev(page, rest, id); notes[tag + "-" + id + "-mid"] = await ev(page, mid); await snap(page, tag + "-" + id + "-mid"); }
  await ctx.close();
}

async function smallest(tag, w, h, dpr, touch) {
  const { ctx, page } = await open(w, h, dpr, touch);
  for (const which of ["siege", "gallery"]) {
    notes[tag + "-" + which + "-smallest"] = await ev(page, (which) => { let b = null; const ids = which === "gallery" ? SP.gallery() : Array.from({ length: 100 }, (_, k) => k + 1);
      const era = {}; for (const id of ids) { const s = SP.load(id, "normal"), px = +(s.cs / devicePixelRatio).toFixed(2); if (!b || px < b.px) b = { id: s.id, px, board: s.w + "x" + s.h, turned: document.body.classList.contains("turned") };
        if (which === "siege") { const e = s.n === 100 ? "boss" : "era" + Math.ceil(s.n / 25); if (!era[e] || px < era[e].px) era[e] = { id: s.id, px, cssW: Math.round((s.w * s.cs) / devicePixelRatio) }; } }
      if (which === "siege") b.eras = era;
      SP.load(b.id, "normal"); SP.tick(40); return b; }, which);
    await page.waitForTimeout(200); await snap(page, tag + "-" + which + "-smallest-cell");
  }
  await ctx.close();
}

try {
  await sheet(arg("sheet", "contact-sheet"), "siege", 10);
  await sheet("gallery-sheet", "gallery", 10);
  await screens("375", 375, 812, 2, true);
  await screens("1280", 1280, 720, 1, false);
  for (const [tag, w, h, dpr, touch] of [["375", 375, 812, 2, true], ["844", 390, 844, 3, true], ["667", 375, 667, 2, true], ["736", 414, 736, 3, true], ["812", 812, 375, 3, true], ["1280", 1280, 720, 1, false], ["400", 400, 600, 2, false]]) await smallest(tag, w, h, dpr, touch);
} catch (e) { log.push("crashed: " + (e && e.stack || e)); }
await browser.close(); clearTimeout(wall);
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, null, 1));
console.log(log.length ? "SHOTS: " + log.length + " console messages\n" + log.join("\n") : "SHOTS: 0 console errors or warnings");
process.exit(log.length ? 1 : 0);
