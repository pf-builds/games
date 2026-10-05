const OUT = process.cwd() + "/";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }), page = await ctx.newPage();
await page.goto("http://127.0.0.1:8493/sappers-path/?debug=1"); await page.waitForFunction(() => window.SP && document.fonts.status === "loaded");
for (const n of process.argv.slice(2)) { await page.evaluate((n) => { SP.load(+n); SP.tick(1200); }, n); await page.waitForTimeout(100); await page.screenshot({ path: OUT + "phone-b" + n + "-start.png" }); }
await b.close();
