#!/usr/bin/env node
// Sapper's Path v4 M3 (the Siege to 100) screens, into tools/shots-v4-m3/ (gitignored). Headless Chromium via Playwright.
// At 375×812 (dpr 2, touch) and 1280×720 (dpr 1): one level per era at rest, every new or re-authored teaching level with
// its coach line and arrow (1, 2, 3, 35, 62, 76, 77), the boss at 100, a big squad mid-swarm (the biggest front squad
// with its whole count in reach, 0.9 s after the tap) plus a strip of six frames 250 ms apart, and the map scrolled to
// Era 4. At all four viewports (also 812×375, dpr 3, touch, and a 400×600 page): the board with the smallest cells.
// Exit 1 on a console error or warning.
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v4-m3.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v4-m3");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 300000);

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
async function shot(page, tag, name, fn, a) {
  const got = fn ? await ev(page, fn, a) : null;
  if (got && typeof got === "object") notes[tag + "-" + name] = got;
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, tag + "-" + name + ".png") });
}
const rest = (n) => { SP.speed(1); const st = SP.load(n, "normal"); SP.tick(40); return { n, id: st.id, cs: +(st.cs / devicePixelRatio).toFixed(2), coach: SP.coach().text }; };
// The biggest front squad whose whole count is in reach at the start (a swarm), over every level.
const swarmPick = () => { let best = null; for (let n = 1; n <= 100; n++) { const st = SP.load(n, "normal"); if (st.n !== n) continue; st.fronts.forEach((f, j) => { if (f && SP.reachable(f.mat) >= f.n && (!best || f.n > best.k)) best = { n, j, k: f.n }; }); } return best; };
async function stitch(page, bufs, file) {
  const png = await page.evaluate(async (srcs) => { const ims = await Promise.all(srcs.map((s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; })));
    const w = ims.reduce((a, i) => a + i.width + 6, 0), h = ims[0].height, c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#221a26"; g.fillRect(0, 0, w, h); let x = 0; for (const i of ims) { g.drawImage(i, x, 0); x += i.width + 6; } return c.toDataURL().split(",")[1]; }, bufs.map((b) => "data:image/png;base64," + b.toString("base64")));
  writeFileSync(file, Buffer.from(png, "base64"));
}

async function run(tag, w, h, dpr, touch, full) {
  const { ctx, page } = await open(w, h, dpr, touch);
  if (full) {
    for (const [era, n] of [[1, 8], [2, 40], [3, 64], [4, 88]]) await shot(page, tag, "era" + era + "-l" + n + "-rest", rest, n);
    for (const n of [1, 2, 3, 35, 62, 76, 77]) await shot(page, tag, "teach-l" + n, rest, n);
    await shot(page, tag, "l100-boss", rest, 100);
    const pick = await ev(page, swarmPick); notes[tag + "-swarm-pick"] = pick;
    if (pick) {
      await shot(page, tag, "swarm-l" + pick.n, (p) => { SP.speed(1); SP.load(p.n, "normal"); SP.tick(40); SP.play(p.j); const st = SP.tick(900); return { runners: st.runners, line: st.line }; }, pick);
      const box = await page.locator("#board").boundingBox(), clip = { x: box.x, y: box.y, width: box.width, height: box.height }, bufs = [];
      await ev(page, (p) => { SP.load(p.n, "normal"); SP.tick(40); SP.play(p.j); }, pick);
      for (let k = 0; k < 6; k++) { await ev(page, () => SP.tick(250)); bufs.push(await page.screenshot({ clip })); }
      await stitch(page, bufs, resolve(OUT, tag + "-swarm-strip-l" + pick.n + ".png"));
    }
    await shot(page, tag, "map-era4", () => { SP.screen("map"); const s = document.querySelectorAll(".era"); const e4 = s[s.length - 1]; e4.scrollIntoView({ block: "center" }); return { eras: s.length, era4: e4.querySelector("h3").textContent, note: e4.querySelector("p").textContent }; });
  }
  const small = await ev(page, () => { let b = null; for (let n = 1; n <= 100; n++) { const st = SP.load(n, "normal"); if (st.n !== n) continue; const px = st.cs / devicePixelRatio; if (!b || px < b.px) b = { n, px: +px.toFixed(2), turned: document.body.classList.contains("turned") }; } return b; });
  await shot(page, tag, "smallest-cell-l" + small.n, rest, small.n); notes[tag + "-smallest"] = small;
  await ctx.close();
}

try {
  await run("375", 375, 812, 2, true, true);
  await run("1280", 1280, 720, 1, false, true);
  await run("812", 812, 375, 3, true, false);
  await run("400", 400, 600, 2, false, false);
} catch (e) { log.push("shots crashed: " + (e && e.stack || e)); }
clearTimeout(wall); await browser.close();
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(JSON.stringify(notes, null, 1));
console.log(log.length ? "SHOTS: " + log.length + " console message(s)\n" + log.join("\n") : "SHOTS: done, 0 console errors or warnings");
process.exit(log.length ? 1 : 0);
