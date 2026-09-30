#!/usr/bin/env node
// Sapper's Path v4 M1 (the look pass) screens, into tools/shots-v4-m1/. Headless Chromium via Playwright.
//   375×812 (dpr 2, touch): levels 8, 40 and 64 at rest; level 40 mid-show (three squads out); a full line; level 64 in
//   colour-blind mode; the title and the map (the colour-blind toggles)
//   1280×720: level 64 at rest.   812×375 (dpr 3, touch): the Era 3 board with the smallest cells
//   320×500 (dpr 2): level 64 at 8 CSS px a cell, the readability floor
//   side by side: 375 level 64 next to Food Hunt level 1492 (Peter's phone, game-research/sappers-path-v3/reference)
// Also prints each screen's CSS px per cell. Exit 1 on a console error or warning.
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v4-m1.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v4-m1");
const REF = resolve(here, "../../../../game-research/sappers-path-v3/reference/foodhunt-5-cat-l1492-queue-slots-powerups.webp");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], cells = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 180000);

async function open(w, h, dpr, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(w + "x" + h + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(w + "x" + h + " pageerror: " + e.message));
  await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000 });
  return { ctx, page };
}
const ev = (page, fn, a) => page.evaluate(fn, a);
async function shot(page, name, fn, a) {
  if (fn) await ev(page, fn, a);
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(OUT, name + ".png") });
  cells[name] = await ev(page, () => +(SP.state().cs / devicePixelRatio).toFixed(2));
}
const rest = (n) => { SP.load(n, "normal"); SP.tick(40); };

try {
  { const { ctx, page } = await open(375, 812, 2, true);
    await shot(page, "375-title", () => SP.screen("title"));
    await shot(page, "375-map", () => SP.screen("map"));
    for (const n of [8, 40, 64]) await shot(page, "375-l" + n + "-rest", rest, n);
    // Level 40 mid-show: three squads out, the first two with runners on the ground.
    await shot(page, "375-l40-mid-show", () => { SP.load(40, "normal"); const st = SP.state(), o = []; st.fronts.forEach((f, j) => { if (f && SP.reachable(f.mat) > 0) o.push(j); });
      for (const j of o.slice(0, 3)) { SP.play(j); SP.tick(420); } SP.tick(300); });
    await shot(page, "375-full-line", () => { SP.load(65, "normal"); SP.fill(); SP.tick(250); });
    await shot(page, "375-l64-colourblind", () => { SP.screen("title"); document.querySelector("#title .tog-cb").click(); SP.load(64, "normal"); SP.tick(40); });
    await ev(page, () => { SP.screen("title"); document.querySelector("#title .tog-cb").click(); });
    await ctx.close(); }
  // The readability floor: a 320×500 screen gives the Era 3 boards 8 CSS px a cell (Food Hunt's level 1492 size).
  { const { ctx, page } = await open(320, 500, 2, true);
    await shot(page, "320x500-l64-8px", rest, 64);
    await ctx.close(); }
  { const { ctx, page } = await open(1280, 720, 1, false);
    await shot(page, "1280-l64-rest", rest, 64);
    await ctx.close(); }
  { const { ctx, page } = await open(812, 375, 3, true);
    const big = await ev(page, () => { let b = null; for (let n = 51; n <= 75; n++) { SP.load(n, "normal"); const px = SP.state().cs / devicePixelRatio; if (!b || px < b.px) b = { n, px }; } return b; });
    await shot(page, "812-era3-l" + big.n, rest, big.n);
    await ctx.close(); }
  // Side by side: ours at 375 (level 64) and Food Hunt's level 1492, the same height.
  { const { ctx, page } = await open(400, 400, 1, false);
    const ours = "data:image/png;base64," + readFileSync(resolve(OUT, "375-l64-rest.png")).toString("base64"), ref = "data:image/webp;base64," + readFileSync(REF).toString("base64");
    const out = await ev(page, async (list) => {
      const imgs = await Promise.all(list.map((u) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = u; })));
      const H = imgs[0].height, ws = imgs.map((i) => Math.round((i.width * H) / i.height)), gap = 24, c = document.createElement("canvas"); c.width = ws[0] + ws[1] + gap; c.height = H;
      const g = c.getContext("2d"); g.fillStyle = "#1d1b22"; g.fillRect(0, 0, c.width, H); g.imageSmoothingEnabled = true; g.drawImage(imgs[0], 0, 0, ws[0], H); g.drawImage(imgs[1], ws[0] + gap, 0, ws[1], H);
      return c.toDataURL("image/png");
    }, [ours, ref]);
    writeFileSync(resolve(OUT, "side-by-side-375-l64-vs-foodhunt-l1492.png"), Buffer.from(out.split(",")[1], "base64"));
    await ctx.close(); }
} finally { await browser.close(); clearTimeout(wall); }
console.log(JSON.stringify({ cssPxPerCell: cells, console: log }, null, 1));
process.exit(log.length ? 1 : 0);
