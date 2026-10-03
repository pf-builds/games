const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), c = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), p = await c.newPage();
await p.goto("http://127.0.0.1:8493/sappers-path/?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded");
const out = {};
for (const k of [41, 9]) { out["next" + (k + 1)] = await p.evaluate((k) => { SP.unlockTo(k); SP.screen("title"); const t = Array.from(document.querySelectorAll("#title .tag")).filter((e) => !e.hidden && e.getBoundingClientRect().width); return { play: document.getElementById("btn-play").textContent.trim(), tags: t.map((e) => e.textContent) }; }, k); await p.waitForTimeout(200); await p.screenshot({ path: new URL("./visual/375-home-next" + (k + 1) + ".png", import.meta.url).pathname }); }
await b.close(); console.log(JSON.stringify(out));
