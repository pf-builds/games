// Sapper's Path lane P Stage 5, covers D-F: the cover scenes (cover-levels.py) drawn by the game's own board code.
// config.json is routed with the scenes added as selfTest fixtures; each one is played with SP.fixture, real taps
// (SP.play) and sim time (SP.tick, the rAF loop held as in capture.mjs), and the #board canvas is shot alone at the
// board's own top resolution (board.maxCellCss x maxDpr device px a cell), read straight off the canvas
// (toDataURL: the board's own pixels, nothing over them). Shots per scene: t0 (as dealt)
// and each time in the plan; E also shoots its front squad cards (the game's DOM tiles) before any tap.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node cover-boards.mjs --levels cover-levels.json --out <dir>
//     [--url http://127.0.0.1:8517/] [--only coverD_land,...]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const LV = JSON.parse(readFileSync(arg("levels"), "utf8")), OUT = arg("out"), URL_ = arg("url", "http://127.0.0.1:8517/"), ONLY = arg("only", "");
// Per option: taps (columns, in order, at sim ms) and the sim times (ms) to shoot.
const every = (a, z, d) => Array.from({ length: Math.floor((z - a) / d) + 1 }, (_, i) => a + i * d);
// Cover-only presentation (never shipped): sappers drawn at SAPPER_SCALE cells (the game's own 1.25 reads as specks at a
// 200x112 thumbnail) and cells up to CELL_CSS CSS px (x maxDpr 3 = 72 device px: every cover, the 1080x1620 video frame
// too, is then a downscale); everything else is the game's config as it is. The page runs at 4x so the DOM card tiles
// come out big enough for any cover (the canvas stays at the board's own maxDpr).
const SAPPER_SCALE = 1.9, CELL_CSS = 24;
// D (final): the ground drawn darker (dirt) so the hole reads as a breach, not a cloud; cover-only, like the sapper scale.
const PLAY = { D: { taps: [[0, 0], [1, 150], [2, 300], [3, 450], [4, 600]], shots: every(900, 3300, 200), dirt: "#2c2420" },
               E: { taps: [[0, 0], [1, 200], [2, 400]], shots: every(1000, 2800, 300), cards: true },
               F: { taps: [[0, 0], [1, 150], [2, 300], [3, 450], [4, 600]], shots: every(4000, 9000, 1000) } };
const grab = async (p, path) => { const d = await p.evaluate(() => document.getElementById("board").toDataURL("image/png")); writeFileSync(path, Buffer.from(d.split(",")[1], "base64")); };
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), errs = [], report = [];
for (const [key, L] of Object.entries(LV)) {
  if (ONLY && !ONLY.split(",").includes(key)) continue;
  const opt = key.slice(5, 6), P = PLAY[opt];
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 4 }), p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(key + ": " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(key + ": " + m.text()); });
  await p.addInitScript(() => { const R = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => (cb.name === "frame" ? 0 : R(cb)); });
  await p.route(/\/config\.json(\?.*)?$/, async (r) => { const res = await r.fetch(), cfg = await res.json(); Object.assign(cfg.selfTest, LV); cfg.board.sapper.scale = SAPPER_SCALE; cfg.board.maxCellCss = CELL_CSS; if (P.dirt) cfg.v3.ground.dirt = P.dirt; r.fulfill({ response: res, json: cfg }); });
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 15000 });
  await p.evaluate(() => { SP.unlockTo(199); SP.speed(1); });
  const st = await p.evaluate((k) => SP.fixture(k), key);
  if (!st) { errs.push(key + ": fixture did not load"); await ctx.close(); continue; }
  await p.evaluate(() => SP.tick(2600)); // the level-start toast and fades go (no tap yet: the board as dealt)
  const geo = await p.evaluate(() => { const c = document.getElementById("board"); return { W: c.width, H: c.height }; });
  const cs = geo.W / L.w; await grab(p, `${OUT}/${key}-t0.png`);
  if (P.cards) { const tiles = p.locator("#tray .tile"); const n = await tiles.count(); let k = 0;
    for (let i = 0; i < n && k < 5; i++) { const t = tiles.nth(i); if (await t.evaluate((e) => e.classList.contains("next"))) continue; await t.screenshot({ path: `${OUT}/${key}-card${k}.png`, omitBackground: true }); k++; } }
  let now = 0;
  const run = async (to) => { for (const [col, at] of P.taps) if (at >= now && at < to) { await p.evaluate((ms) => SP.tick(ms), at - now); now = at; await p.evaluate((c) => SP.play(c), col); }
    if (to > now) { await p.evaluate((ms) => SP.tick(ms), to - now); now = to; } };
  for (const t of P.shots) { await run(t); await grab(p, `${OUT}/${key}-${t}.png`); }
  const s = await p.evaluate(() => SP.state());
  report.push(`${key}: board ${geo.W}x${geo.H} device px, ${cs} px a cell (grid ${L.w}x${L.h}), shots t0 and ${P.shots[0]}-${P.shots[P.shots.length - 1]} ms; plays ${s.plays}, refused ${s.refused}, pixels left ${s.pixLeft}`);
  await ctx.close();
}
await b.close();
writeFileSync(`${OUT}/cover-boards.txt`, report.join("\n") + `\nconsole errors: ${errs.length}\n` + errs.join("\n") + "\n");
console.log(report.join("\n")); console.log("console errors: " + errs.length); for (const e of errs) console.log("  " + e);
