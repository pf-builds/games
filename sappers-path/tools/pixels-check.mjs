// Sapper's Path, Partial's Pixels (tools/partials-pixels-notes.md): THE ART in the real page. For every Partial's Pixels level,
// at each viewport, start the level and read the board back from its canvas (SP.cells(): each picture cell's colour at the
// middle of its block, and the share of each block's pixels that are exactly it), then hold every cell to the source PNG's
// cell colour (tools/partials-pixels.js convert, with the manifest's merge or crop). Writes, per level, a side-by-side image
// (the PNG as drawn | the board as drawn at the level's start, cropped to the picture, both at the board's own scale) to
// --out (default tools/shots-partials-pixels/). Exit 1 on any cell that differs or any console message.
// Last, a page with no config.pixels (the portal build's): the mode is gone without a trace (card, chip, reset choice, requests).
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
    const ok = R.w === t.cv.pw && R.h === t.cv.ph && hit === t.cv.cells.length; if (!ok) bad++; // each block's face (its base colour) her exact hex; the share of exact pixels is for information (standard blocks, Peter 2026-10-23)
    console.log(tag + " " + t.id + ": " + hit + "/" + t.cv.cells.length + " cells match the PNG (" + R.w + "x" + R.h + ", " + R.cs + " device px a cell; each block " + (100 * R.share[0]).toFixed(1) + "-" + (100 * R.share[1]).toFixed(1) + "% of its pixels exactly her colour, least-mean, for information: the rest is the game's seam, highlight, foot and glint)" + (miss.length ? "; first misses " + miss.join("; ") : ""));
    // The side-by-side: the PNG (served from the art folder) scaled to the board's cell size with no smoothing | the board canvas's picture area.
    const art = "tools/build-data/partials-pixels/art/" + encodeURIComponent(t.cv.file);
    const url = await p.evaluate(async (a) => { const c = document.getElementById("board"), img = new Image(); img.src = a; await img.decode(); const B = SP.cells(), cs = B.cs, W = Math.round(B.w * cs), H = Math.round(B.h * cs), gap = Math.round(cs * 2);
      const o = document.createElement("canvas"); o.width = W * 2 + gap; o.height = H; const g = o.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, o.width, o.height); g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, W, H); g.drawImage(c, Math.round(cs), Math.round(cs), W, H, W + gap, 0, W, H); return o.toDataURL("image/png"); }, art);
    fs.writeFileSync(path.join(OUT, "side-by-side-" + t.id + "-" + w + ".png"), Buffer.from(url.split(",")[1], "base64"));
  }
  await ctx.close();
}
// Web only (Peter, 2026-10-22; critic B1): a build with no config.pixels (the portal build drops it) shows no card, chip or
// reset choice for the mode, plays as Zen and the Campaign did before, and a save that still holds the mode's progress (and
// the Zen save's mode "pixels") opens on the Campaign with 0 console messages; selfTest passes there.
{ const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }), p = await ctx.newPage(), tag = "no-pixels 375x812";
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.route(/config\.json/, async (r) => { const res = await r.fetch(), j = await res.json(); delete j.pixels; delete j.audio.music.modes.pixels; await r.fulfill({ response: res, json: j }); });
  const asked = []; p.on("request", (q) => { if (/pixels/.test(q.url())) asked.push(q.url()); });
  await p.addInitScript(() => { try { localStorage.setItem("sappers-path.tut.v1", "1"); localStorage.setItem("sappers-path.zen.v1", JSON.stringify({ v: 1, done: {}, gal: {}, eggs: {}, best: {}, last: null, moved: 1, mode: "pixels" })); localStorage.setItem("sappers-path.pixels.v1", JSON.stringify({ v: 1, done: { "p1-1": 1 }, gal: {}, eggs: {}, best: {}, last: "p1-1", moved: 1, mode: "campaign" })); } catch (e) { /* no store */ } });
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 20000 });
  const st = await p.evaluate(async () => { const hid = (q) => { const e = document.querySelector(q); return !e || e.hidden; }; document.getElementById("btn-settings").click(); document.getElementById("set-reset").click(); const r = { mode: SP.mode(), pixels: SP.pixels().length, card: hid("#btn-pixels"), chip: hid('#map-mode [data-mode="pixels"]'), radio: hid('#rs-mode [data-mode="pixels"]'), three: document.getElementById("map-mode").classList.contains("three") };
    SP.screen("title"); const t = await SP.selfTest(); r.self = t.pass + "/" + t.fail.length; r.fails = t.fail.slice(0, 3); return r; });
  const ok = st.mode === "campaign" && !st.pixels && st.card && st.chip && st.radio && !st.three && st.fails.length === 0 && !asked.length; if (!ok) bad++;
  console.log(tag + ": no config.pixels -> mode " + st.mode + ", card/chip/reset choice hidden " + [st.card, st.chip, st.radio].join("/") + ", no request for its files (" + asked.length + "), selfTest " + st.self + (st.fails.length ? " " + st.fails.join(" | ") : "") + (ok ? " OK" : " FAIL"));
  await ctx.close(); }
await b.close();
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = bad || log.length ? 1 : 0;
