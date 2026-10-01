// Visual critic 2 probe (read-only): coach fit on teaching levels at short phones; broke-state buy tap; gallery tiles' states.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch(), out = {};
for (const [tag, w, h] of [["375x667", 375, 667], ["360x640", 360, 640], ["390x844", 390, 844], ["414x736", 414, 736]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8493/sappers-path/?debug=1"); await page.waitForFunction(() => window.SP && document.fonts.status === "loaded");
  out[tag] = await page.evaluate(async () => {
    const r = [];
    for (const n of [1, 2, 3, 35, 51, 62, 76, 77]) { SP.load(n, "normal"); SP.tick(40); await new Promise((z) => setTimeout(z, 120));
      const c = document.getElementById("coach"), cs = SP.coach(), b = c.getBoundingClientRect();
      r.push({ n, mode: cs.mode, text: c.textContent, w: Math.round(b.width), h: Math.round(b.height), font: getComputedStyle(c).fontSize, clipped: c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1, cell: +(SP.state().cs / devicePixelRatio).toFixed(2) }); }
    return r.filter((x) => x.clipped || x.mode === "top");
  });
  await ctx.close();
}
{ const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8493/sappers-path/?debug=1"); await page.waitForFunction(() => window.SP && document.fonts.status === "loaded");
  out.broke = await page.evaluate(async () => { SP.setMeta({ coins: 10, inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 0 } }); SP.load(40, "normal"); SP.tick(40);
    const b = document.querySelector('.pw[data-k="0"]'), before = { cls: b.className, dis: b.disabled, aria: b.getAttribute("aria-label"), op: getComputedStyle(b).opacity, filt: getComputedStyle(b).filter };
    b.click(); await new Promise((z) => setTimeout(z, 100)); const t = document.getElementById("toast"); return { before, toast: t.hidden ? null : t.textContent, coins: SP.meta().coins }; });
  out.galTiles = await page.evaluate(() => { SP.unlockGallery(); SP.screen("gallery"); const ts = Array.from(document.querySelectorAll("#gallery .gt, #gallery [class*=tile], #gallery button")).slice(0, 6); return ts.map((t) => ({ cls: t.className, text: t.textContent.trim().slice(0, 20), op: getComputedStyle(t).opacity, filt: getComputedStyle(t).filter.slice(0, 40) })); });
  await ctx.close(); }
await browser.close(); console.log(JSON.stringify(out, null, 1));
