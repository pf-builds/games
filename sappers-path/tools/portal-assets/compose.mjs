// Sapper's Path lane P Stage 5: the CrazyGames covers. compose.html lays each cover out at its exact pixel size; this
// screenshots it at 1x (so every pixel is drawn, nothing resampled after), for options A, B and C in the three sizes, plus
// a 200x112 preview of each landscape cover (the portal's smallest thumbnail) and the contact sheet (sheet-covers.py).
// Assets are routed, not served: /game/ -> the game folder, /art/ -> the art folder (prep-art.py cuts, board.png).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node compose.mjs --game <sappers-path dir> --art <dir> --out <dir> [--opts A,B,C]
//     [--sizes land,port,square] [--scale 1.35]   (--scale: the same layout at that device scale, e.g. the portrait video's
//     1080x1620 first frame; saved as cover-<opt>-<size>@<w>x<h>.png)
import { readFileSync, existsSync, mkdirSync } from "node:fs"; import { dirname, join, extname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const HERE = dirname(fileURLToPath(import.meta.url)), GAME = resolve(arg("game")), ART = resolve(arg("art")), OUT = resolve(arg("out")), OPTS = arg("opts", "A,B,C").split(","), ONLY = arg("sizes", "land,port,square").split(","), SCALE = +arg("scale", "1");
const SIZES = { land: [1920, 1080], port: [800, 1200], square: [800, 800] };
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".js": "text/javascript", ".ttf": "font/ttf", ".html": "text/html" };
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), errs = [];
for (const o of OPTS) for (const [sz, [w, h]] of Object.entries(SIZES)) {
  if (!ONLY.includes(sz)) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: SCALE }), p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.route("http://cover.local/**", (r) => { const u = new URL(r.request().url()), path = decodeURIComponent(u.pathname);
    const f = path === "/compose.html" ? join(HERE, "compose.html") : path.startsWith("/game/") ? join(GAME, path.slice(6)) : path.startsWith("/art/") ? join(ART, path.slice(5)) : null;
    if (!f || !existsSync(f)) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ status: 200, body: readFileSync(f), headers: { "content-type": TYPES[extname(f)] || "application/octet-stream" } }); });
  await p.goto(`http://cover.local/compose.html?opt=${o}&size=${sz}${SCALE !== 1 ? `&hi=${Math.round(w * SCALE)}x${Math.round(h * SCALE)}` : ""}`); await p.waitForSelector("body[data-ready]", { timeout: 15000 });
  await p.screenshot({ path: join(OUT, `cover-${o}-${sz}${SCALE !== 1 ? "@" + Math.round(w * SCALE) + "x" + Math.round(h * SCALE) : ""}.png`) }); await ctx.close();
}
await b.close(); console.log("covers:", OPTS.join(","), "x", Object.keys(SIZES).join(","), "console errors:", errs.length); for (const e of errs) console.log("  " + e);
