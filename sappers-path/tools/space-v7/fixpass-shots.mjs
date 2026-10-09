// Sapper's Path v7 lane T fix pass: the busy Zen card and the load-fail toast at 375x812@3 (tools/space-v7/fixpass-*.png).
//   PLAYWRIGHT_MODULE=... node tools/space-v7/fixpass-shots.mjs URL
const URL_ = process.argv[2], { chromium } = await import(process.env.PLAYWRIGHT_MODULE), OUT = new URL(".", import.meta.url).pathname;
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { localStorage.setItem("sappers-path.tour.v1", "1"); } catch (e) { /* no store */ } });
const p = await ctx.newPage(), log = []; p.on("console", (m) => log.push(m.text())); p.on("pageerror", (e) => log.push(e.message));
await p.route("**/levels/zen-1.pk.json*", async (r) => { await new Promise((res) => setTimeout(res, 3000)); await r.continue(); });
await p.goto(URL_); await p.waitForFunction(() => !document.getElementById("btn-zen").hidden, null, { timeout: 20000 });
await p.click("#btn-zen"); await p.waitForTimeout(700); const busy = await p.evaluate(() => document.getElementById("btn-zen").classList.contains("busy"));
await p.screenshot({ path: OUT + "fixpass-busy-card.png" });
await p.waitForFunction(() => document.getElementById("map").hidden && document.getElementById("title").hidden, null, { timeout: 10000 });
await p.unroute("**/levels/zen-1.pk.json*"); await p.goto(URL_); await p.route("**/levels/zen-1.pk.json*", (r) => r.abort());
await p.waitForFunction(() => !document.getElementById("btn-zen").hidden, null, { timeout: 20000 }); await p.click("#btn-zen"); await p.waitForTimeout(800);
await p.screenshot({ path: OUT + "fixpass-fail-toast.png" }); const t = await p.evaluate(() => document.getElementById("toast").textContent);
await p.click("#btn-settings").catch(() => {}); const after = await p.evaluate(() => document.getElementById("toast").hidden);
console.log("busy card " + busy + "; fail toast '" + t + "', put away by the next tap " + after + "; console " + log.length + (log.length ? ": " + log.join(" | ") : ""));
await b.close();
