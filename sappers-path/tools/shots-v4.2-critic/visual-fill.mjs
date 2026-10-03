// v4.2 visual critic probe (read-only): board fill of the stage, cell size, and 2-digit count fit on tiles and slots.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const B = "http://127.0.0.1:8493/sappers-path/", browser = await chromium.launch(), out = { errors: [] };
const VPS = [["375x812", 375, 812, 3, true], ["390x844", 390, 844, 3, true], ["375x667", 375, 667, 2, true], ["414x736", 414, 736, 2, true], ["400x600if", 400, 600, 2, false, true], ["812x375", 812, 375, 3, true], ["1280x720", 1280, 720, 1, false]];
const IDS = [25, 26, 40, 51, 64, 77, 88, 100, "g-tw-1f355", "g-noto-1f431", "g-met-57007", "g-met-45434"];
for (const [tag, w, h, dpr, touch, ifr] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: ifr ? 460 : w, height: ifr ? 700 : h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), page = await ctx.newPage(); let T = page;
  page.on("pageerror", (e) => out.errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") out.errors.push(m.text()); });
  if (ifr) { await page.goto(B + "tools/iframe-host.html"); for (let i = 0; i < 100; i++) { T = page.frames().find((f) => f.url().includes("?debug=1")); if (T) break; await page.waitForTimeout(100); } } else await page.goto(B + "?debug=1");
  await T.waitForFunction(() => window.SP && document.fonts.status === "loaded");
  out[tag] = await T.evaluate(async (ids) => {
    const res = [];
    for (const id of ids) { const st = SP.load(id, "normal"); SP.tick(40); await new Promise((z) => setTimeout(z, 60));
      const r = (e) => e.getBoundingClientRect(), stg = r(document.getElementById("stage")), fr = r(document.getElementById("frame")), bd = r(document.getElementById("board"));
      // Tile and slot count fit: the widest count's glyph against its box.
      let worst = 0, wtxt = ""; document.querySelectorAll("#tray .tile .n, #line .slot b").forEach((e) => { if (!e.textContent || !e.getBoundingClientRect().width) return; const rg = document.createRange(); rg.selectNodeContents(e); const gw = rg.getBoundingClientRect().width, box = e.parentElement.getBoundingClientRect().width; const f = gw / box; if (f > worst) { worst = f; wtxt = e.textContent + "@" + getComputedStyle(e).fontSize + " in " + Math.round(box) + "px"; } });
      let rows = 1; document.querySelectorAll("#tray .tile.next").forEach((t) => { if (t.getBoundingClientRect().height && !t.classList.contains("none")) rows = Math.max(rows, t.classList.contains("d1") ? 2 : 3); });
      res.push({ id, cs: +(SP.state().cs / devicePixelRatio).toFixed(2), stage: [Math.round(stg.width), Math.round(stg.height)], frame: [Math.round(fr.width), Math.round(fr.height)], board: [Math.round(bd.width), Math.round(bd.height)], unusedW: Math.round(stg.width - fr.width), unusedH: Math.round(stg.height - fr.height), fillPct: Math.round((100 * fr.width * fr.height) / (stg.width * stg.height)), rows, worstCount: wtxt, worstFrac: +worst.toFixed(2) }); }
    return res; }, IDS);
  // Force 99s: fill the line on a level with big squads to see slot counts.
  out[tag + "-slots"] = await T.evaluate(() => { SP.load(88, "normal"); SP.tick(40); SP.fill(); SP.tick(200); return Array.from(document.querySelectorAll("#line .slot b")).filter((e) => e.textContent).map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); return e.textContent + ":" + Math.round(rg.getBoundingClientRect().width) + "/" + Math.round(e.parentElement.getBoundingClientRect().width) + "@" + getComputedStyle(e).fontSize; }); });
  await ctx.close();
}
await browser.close(); console.log(JSON.stringify(out));
