const OUT = process.cwd() + "/";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), notes = {}, log = [];
for (const [vp, o] of [["phone", { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }], ["desk", { viewport: { width: 1280, height: 720 } }]]) {
  for (const n of [188, 130, 158, 105, 109, 129, 159, 189]) {
    const ctx = await b.newContext(o), page = await ctx.newPage(); page.on("pageerror", (e) => log.push(e.message));
    await page.goto("http://127.0.0.1:8493/sappers-path/?debug=1"); await page.waitForFunction(() => window.SP && document.fonts.status === "loaded");
    notes[vp + n] = await page.evaluate((k) => { document.getElementById("jr-dbg")?.remove(); SP.unlockTo(k); SP.clearPictures(Math.max(0, Math.min(50, Math.floor((k - 4) / 4)))); SP.screen("map");
      const bn = Array.from(document.querySelectorAll("#jr .bn")).map((x) => { const t = x.querySelector(".jr-r-name") || x; return { t: t.textContent, cut: t.scrollWidth > t.clientWidth + 1, w: t.clientWidth, sw: t.scrollWidth }; });
      const lk = Array.from(document.querySelectorAll("#jr .mn.locked .bd")).map((x) => { const r = x.getBoundingClientRect(); return [x.parentElement.dataset.n, Math.round(r.left), Math.round(r.top), Math.round(r.width)]; }).filter((r) => r[2] > 70 && r[2] < innerHeight - 100);
      return { bn: bn.filter((x) => x.cut), locked: lk.slice(0, 5) }; }, n);
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".jr-img")).filter((i) => i.getAttribute("src")).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(250); await page.screenshot({ path: OUT + vp + "-label-" + (n + 1) + ".png" }); await ctx.close(); } }
await b.close(); console.log(JSON.stringify({ notes, log }));
