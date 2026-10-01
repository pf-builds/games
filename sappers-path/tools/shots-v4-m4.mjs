#!/usr/bin/env node
// Sapper's Path v4 M4 (the Gallery) screens, into tools/shots-v4-m4/ (gitignored). Headless Chromium via Playwright.
//   contact-sheet.png: all 60 Gallery boards at rest, drawn by the game's own renderer (each board canvas copied in the
//     page into one sheet, numbered and titled), so Peter can veto quickly.
//   At 375x812 (dpr 2, touch) and 1280x720 (dpr 1): the title and the map with the Gallery locked (fresh save) and open
//     (level 25 won), the Gallery screen with twelve pictures won (colour) and the rest dimmed, scrolled to its credits;
//     four Gallery levels at rest, early in the first squad (sappers coming in from the edges) and as the first black
//     squad breaches the outline.
//   At all four viewports (also 812x375 dpr 3 touch, and a 400x600 page): the Gallery board with the smallest cells.
// Measurements go to tools/shots-v4-m4/notes.json. Exit 1 on a console error or warning.
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v4-m4.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v4-m4");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 400000);
const KEY = "sappers-path.v3", PICKS = ["g-tw-1f355", "g-ours-g01", "g-noto-1f431", "g-met-45434"];

async function open(w, h, dpr, touch, save) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  if (save) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, [KEY, JSON.stringify(save)]);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(w + "x" + h + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(w + "x" + h + " pageerror: " + e.message));
  await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
  return { ctx, page };
}
const ev = (page, fn, a) => page.evaluate(fn, a);
const snap = (page, name) => page.screenshot({ path: resolve(OUT, name + ".png") });
// A save with siege levels 1-25 won, and Gallery wins on the first k pictures (Normal).
const saveWith = (k, gal) => { const d = { v: 1, done: {}, gal: {}, settings: { muted: true, speed: 1, cb: false, diff: "normal" }, last: null }; for (let n = 1; n <= 25; n++) d.done["e1-" + String(n).padStart(2, "0")] = 2; gal.slice(0, k).forEach((id) => { d.gal[id] = 2; }); return d; };

async function sheet() {
  const { ctx, page } = await open(1280, 720, 1, false);
  const ids = await ev(page, () => SP.gallery());
  // Each board at rest, copied into one canvas in the page: 6 columns, a caption under each.
  const png = await ev(page, (ids) => {
    const cell = 300, capH = 26, cols = 6, rows = Math.ceil(ids.length / cols), c = document.createElement("canvas"); c.width = cols * cell; c.height = rows * (cell + capH); const g = c.getContext("2d");
    g.fillStyle = "#221a26"; g.fillRect(0, 0, c.width, c.height); g.font = "16px 'Jersey 10', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    ids.forEach((id, k) => { const st = SP.load(id, "normal"); SP.tick(16); const b = document.getElementById("board"), s = Math.min((cell - 10) / b.width, (cell - 10) / b.height), w = b.width * s, h = b.height * s, x = (k % cols) * cell, y = ((k / cols) | 0) * (cell + capH);
      g.imageSmoothingEnabled = false; g.drawImage(b, x + (cell - w) / 2, y + (cell - h) / 2, w, h); g.fillStyle = "#f3ead8"; g.fillText(st.n + ". " + document.getElementById("lvl-name").textContent, x + cell / 2, y + cell + capH / 2 - 2); });
    return c.toDataURL().split(",")[1]; }, ids);
  writeFileSync(resolve(OUT, "contact-sheet.png"), Buffer.from(png, "base64"));
  notes.sheet = ids.length + " boards";
  await ctx.close();
  return ids;
}

async function screens(tag, w, h, dpr, touch, ids) {
  { // Locked: a fresh save.
    const { ctx, page } = await open(w, h, dpr, touch);
    await snap(page, tag + "-title-gallery-locked");
    await ev(page, () => SP.screen("map")); await ev(page, () => { const m = document.getElementById("map"); m.scrollTop = m.scrollHeight; }); await snap(page, tag + "-map-gallery-locked");
    notes[tag + "-locked"] = await ev(page, () => ({ title: document.querySelector("#btn-gallery").getAttribute("aria-label"), locked: document.querySelector("#btn-gallery").classList.contains("locked") }));
    await ctx.close();
  }
  { // Open, twelve pictures won.
    const { ctx, page } = await open(w, h, dpr, touch, saveWith(12, ids));
    await snap(page, tag + "-title-gallery-open");
    await ev(page, () => SP.screen("gallery")); await page.waitForTimeout(150); await snap(page, tag + "-gallery-open");
    await ev(page, () => { const m = document.getElementById("gallery"); m.scrollTop = m.scrollHeight; }); await page.waitForTimeout(150); await snap(page, tag + "-gallery-credits");
    notes[tag + "-gallery"] = await ev(page, () => ({ count: document.getElementById("gal-count").textContent, tiles: document.querySelectorAll(".gal-tile").length, won: document.querySelectorAll(".gal-tile.done").length, links: document.querySelectorAll("#gallery a").length }));
    // Four levels: at rest; 600 ms into the first squad (sappers in from the edges); the first black squad breaching.
    for (const id of PICKS) {
      const st = await ev(page, (id) => { SP.speed(1); const s = SP.load(id, "normal"); SP.tick(40); return { id: s.id, cs: +(s.cs / devicePixelRatio).toFixed(2), w: 0 }; }, id); await snap(page, tag + "-" + id + "-rest");
      notes[tag + "-" + id + "-rest"] = st;
      notes[tag + "-" + id + "-entry"] = await ev(page, () => { const o = SP.winOrder("normal"); SP.play(+o[0]); SP.tick(600); return SP.sides(); }); await snap(page, tag + "-" + id + "-entry");
      notes[tag + "-" + id + "-breach"] = await ev(page, () => { // patient taps up to the first black squad, then 1.4 s of it
        const st = SP.state(), o = SP.winOrder("normal"); let k = 1; SP.settle(); const black = (f) => f && f.crew === "Black";
        for (; k < o.length; k++) { const f = SP.state().fronts[+o[k]]; const b = black(f); SP.play(+o[k]); if (b) { SP.tick(1400); return { tap: k + 1, sides: SP.sides(), status: SP.state().status }; } SP.settle(); }
        return { tap: -1, status: st.status }; });
      await snap(page, tag + "-" + id + "-breach");
    }
    await ctx.close();
  }
}

async function smallest(tag, w, h, dpr, touch) {
  const { ctx, page } = await open(w, h, dpr, touch);
  notes[tag + "-smallest"] = await ev(page, () => { let b = null; for (const id of SP.gallery()) { const s = SP.load(id, "normal"), px = +(s.cs / devicePixelRatio).toFixed(2); if (!b || px < b.px) b = { id, px, turned: document.body.classList.contains("turned") }; } SP.load(b.id, "normal"); SP.tick(40); return b; });
  await page.waitForTimeout(200); await snap(page, tag + "-gallery-smallest-cell");
  await ctx.close();
}

try {
  const ids = await sheet();
  await screens("375", 375, 812, 2, true, ids);
  await screens("1280", 1280, 720, 1, false, ids);
  await smallest("375", 375, 812, 2, true); await smallest("1280", 1280, 720, 1, false); await smallest("812", 812, 375, 3, true); await smallest("400", 400, 600, 2, false);
} catch (e) { log.push("crashed: " + (e && e.stack || e)); }
await browser.close(); clearTimeout(wall);
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, null, 1));
console.log(log.length ? "SHOTS: " + log.length + " console messages\n" + log.join("\n") : "SHOTS: 0 console errors or warnings");
process.exit(log.length ? 1 : 0);
