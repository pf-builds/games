// Sapper's Path v7 lane T, stage 2: the Campaign map's sheet joins as the player sees them (375x812 at 3x), on a build
// with the JPEG sheets and one with the WebP sheets, for a side-by-side (tools/space-v7/seams.py composes them).
//   PLAYWRIGHT_MODULE=... node tools/space-v7/seams.mjs URL OUTDIR [JOINS]   (JOINS: sheet numbers s, the join of s and s + 1)
const [URL_, OUT, J = "1,7,12,20,24"] = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE), fs = await import("fs");
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }), p = await ctx.newPage(), log = [];
p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push("pageerror: " + e.message));
await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 20000 });
await p.evaluate(() => { SP.screen("map"); });
for (const s of J.split(",").map(Number)) {
  // The join of sheets s and s + 1 (1-based, bottom first): the top edge of sheet s's box, centred in the view.
  const y = await p.evaluate((s) => { const w = document.getElementById("jr-world"), sh = w.querySelectorAll(".jr-sheet")[s - 1] || null, jr = document.getElementById("jr");
    const top = sh ? sh.offsetTop : 0; jr.scrollTop = Math.max(0, top - jr.clientHeight / 2); return top; }, s);
  await p.waitForFunction((s) => { const im = document.querySelectorAll("#jr-world .jr-img"); return [s - 1, s].every((i) => !im[i] || (im[i].complete && im[i].naturalWidth > 0)); }, s, { timeout: 15000 }).catch(() => log.push("join " + s + ": images not loaded"));
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + "/join-" + String(s).padStart(2, "0") + ".png" }); console.log("join " + s + " at " + y);
}
console.log("console: " + log.length); for (const l of log) console.log("  " + l);
await b.close();
