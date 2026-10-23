// Sapper's Path, Partial's Pixels (tools/partials-pixels-notes.md): THE ART in the real page. For every Partial's Pixels level,
// at each viewport, start the level and read the board back from its canvas (SP.cells(): each picture cell's colour at the
// middle of its block, and the share of each block's pixels that are exactly it), then hold every cell to the source PNG's
// cell colour (tools/partials-pixels.js convert, with the manifest's merge or crop). Writes, per level, a side-by-side image
// (the PNG as drawn | the board as drawn at the level's start, cropped to the picture, both at the board's own scale) to
// --out (default tools/shots-partials-pixels/). Exit 1 on any cell that differs or any console message.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/pixels-check.mjs [--url http://127.0.0.1:8731/] [--out DIR]
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url), T = require("./partials-pixels.js"), HERE = path.dirname(new URL(import.meta.url).pathname);
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8731/"), OUT = path.resolve(arg("out", path.join(HERE, "shots-partials-pixels")));
const X = T.context(), man = JSON.parse(fs.readFileSync(X.man, "utf8")).pictures, src = JSON.parse(fs.readFileSync(X.src, "utf8")).levels;
const want = src.map((L, i) => ({ id: L.id, file: man[i].file || null, cv: T.convert(X, man[i], i + 1) }));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = []; let bad = 0; fs.mkdirSync(OUT, { recursive: true });
for (const [w, h, dpr, touch] of [[375, 812, 3, true], [1280, 800, 1, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h + "@" + dpr;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.addInitScript(() => { try { localStorage.setItem("sappers-path.tut.v1", "1"); } catch (e) { /* no tour flag */ } });
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 20000 });
  for (const t of want) {
    const R = await p.evaluate(async (id) => { await SP.load(id); return SP.cells(); }, t.id);
    let hit = 0; const miss = []; R.cells.forEach((c, i) => { if (c === t.cv.cells[i]) hit++; else if (miss.length < 5) miss.push((i % R.w) + "," + ((i / R.w) | 0) + " " + c + " for " + t.cv.cells[i]); });
    const ok = R.w === t.cv.pw && R.h === t.cv.ph && hit === t.cv.cells.length; if (!ok) bad++;
    console.log(tag + " " + t.id + ": " + hit + "/" + t.cv.cells.length + " cells match the PNG (" + R.w + "x" + R.h + ", " + R.cs + " device px a cell; each block " + Math.round(100 * R.share[0]) + "-" + Math.round(100 * R.share[1]) + "% its exact colour, least-mean)" + (miss.length ? "; first misses " + miss.join("; ") : ""));
    // The side-by-side: the PNG (served from the art folder) scaled to the board's cell size with no smoothing | the board canvas's picture area.
    const art = "tools/build-data/partials-pixels/art/" + encodeURIComponent(t.cv.file);
    const url = await p.evaluate(async (a) => { const c = document.getElementById("board"), img = new Image(); img.src = a; await img.decode(); const B = SP.cells(), cs = B.cs, W = Math.round(B.w * cs), H = Math.round(B.h * cs), gap = Math.round(cs * 2);
      const o = document.createElement("canvas"); o.width = W * 2 + gap; o.height = H; const g = o.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, o.width, o.height); g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, W, H); g.drawImage(c, Math.round(cs), Math.round(cs), W, H, W + gap, 0, W, H); return o.toDataURL("image/png"); }, art);
    fs.writeFileSync(path.join(OUT, "side-by-side-" + t.id + "-" + w + ".png"), Buffer.from(url.split(",")[1], "base64"));
  }
  await ctx.close();
}
await b.close();
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = bad || log.length ? 1 : 0;
