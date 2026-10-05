const OUT = process.cwd() + "/";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = {};
for (const [vp, o] of [["phone", { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }], ["desk", { viewport: { width: 1280, height: 720 } }]]) {
  const ctx = await b.newContext(o), page = await ctx.newPage(); page.on("pageerror", (e) => log.push(e.message)); page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(m.text()); });
  await page.goto("http://127.0.0.1:8493/sappers-path/?debug=1"); await page.waitForFunction(() => window.SP && document.fonts.status === "loaded");
  for (const n of [133, 160, 200]) {
    notes[vp + n] = await page.evaluate((n) => { SP.load(n); SP.tick(1200); const ord = SP.hitPlan(n); if (!ord) return null; for (let i = 0; i < ord.length - 1; i++) { SP.play(+ord[i]); SP.settle(); }
      SP.play(+ord[ord.length - 1]); let t = 0; for (; t < 8000 && SP.state().hits === 0; t += 30) SP.tick(30); return { ord, t, hits: SP.state().hits, fx: SP.hits() }; }, n);
    await page.screenshot({ path: OUT + vp + "-hit" + n + ".png" }); await page.evaluate(() => SP.tick(250)); await page.screenshot({ path: OUT + vp + "-hit" + n + "-b.png" }); }
  // mystery revealed on 150 after patient full play to mid, boss patient mid
  for (const n of [150, 200, 185]) { notes[vp + "pm" + n] = await page.evaluate((n) => { SP.load(n); SP.tick(1200); const o = SP.winOrder(); for (let i = 0; i < Math.ceil(o.length * 0.6); i++) { SP.play(+o[i]); SP.settle(); } const s = SP.state(); return { status: s.status, panel: s.panel }; }, n);
    await page.waitForTimeout(100); await page.screenshot({ path: OUT + vp + "-b" + n + "-patient.png" }); }
  await ctx.close(); }
await b.close(); console.log(JSON.stringify({ notes, log }).slice(0, 1500));
