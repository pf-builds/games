// Critic (space v7): World 1 -> World 2 crossing on both builds (Fast 3G), and the Zen card's first tap on a cold 3G load.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
import { writeFileSync } from "node:fs";
const BASE = "http://127.0.0.1:8482/", NEW = "http://127.0.0.1:8481/", B = await chromium.launch(), res = {}, log = [];
const F3G = { offline: false, latency: 562.5, downloadThroughput: 180000, uploadThroughput: 84375 };
async function ctxOf(url, debug = true) {
  const ctx = await B.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("sappers-path.tour.v1", "1"); } catch (e) {} });
  const p = await ctx.newPage(); p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(m.text()); }); p.on("pageerror", (e) => log.push(e.message));
  const c = await ctx.newCDPSession(p); await c.send("Network.enable"); await c.send("Network.emulateNetworkConditions", F3G);
  const t0 = Date.now(); await p.goto(url + (debug ? "?debug=1" : ""));
  await p.waitForFunction((d) => document.getElementById("home-camp").textContent !== "" && !document.getElementById("btn-zen").hidden && (!d || !!window.SP), debug, { timeout: 120000, polling: 50 });
  return { ctx, p, t0, home: Date.now() - t0 };
}
const playing = (p) => p.waitForFunction(() => document.getElementById("title").hidden && document.getElementById("map").hidden && document.getElementById("lvl-num").textContent, null, { timeout: 90000, polling: 50 });
for (const [k, u] of [["base", BASE], ["new", NEW]]) {
  // Zen card, cold, no debug
  { const c = await ctxOf(u, false); const t = Date.now(); await c.p.click("#btn-zen"); await playing(c.p); res[k + "_zenCard"] = { home: c.home, tapToPlay: Date.now() - t, num: await c.p.evaluate(() => document.getElementById("lvl-num").textContent) }; await c.ctx.close(); }
  // Campaign card, cold
  { const c = await ctxOf(u, false); const t = Date.now(); await c.p.click("#btn-play"); await playing(c.p); res[k + "_campCard"] = { home: c.home, tapToPlay: Date.now() - t }; await c.ctx.close(); }
  // crossing: World 1 49 cleared, play 50, win, the win panel's buttons, then the map's next node
  { const c = await ctxOf(u, true); await c.p.evaluate(() => SP.zenTo(1, 49)); await c.p.click("#btn-zen"); await playing(c.p);
    await c.p.evaluate(() => { const o = SP.winOrder(); for (const ch of o) { if (SP.state().status !== "playing") break; SP.play(ch.charCodeAt(0) - 48); SP.settle(); } SP.tick(9000); });
    const panel = await c.p.evaluate(() => ({ prim: document.getElementById("p-primary").textContent, sec: document.getElementById("p-secondary").textContent, title: document.getElementById("p-title").textContent }));
    await c.p.evaluate(() => document.getElementById("p-primary").click()); await c.p.waitForTimeout(400);
    const scr = await c.p.evaluate(() => (!document.getElementById("map").hidden ? "map" : !document.getElementById("title").hidden ? "title" : "play"));
    let tapMs = null, num = null; if (scr === "map") { const t = Date.now(); await c.p.evaluate(() => { const b = document.querySelector('#jr .mn[data-n="201"]'); b.scrollIntoView({ block: "center" }); b.click(); }); await playing(c.p); tapMs = Date.now() - t; num = await c.p.evaluate(() => document.getElementById("lvl-num").textContent); }
    res[k + "_cross"] = { panel, scr, tapMs, num }; await c.ctx.close(); }
}
res.log = log; writeFileSync(new URL("./lazy2-out.json", import.meta.url), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res)); await B.close();
