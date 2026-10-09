// Critic (space v7): the pending-Zen-level race. A tap on a level whose world is loading, then another level played
// before that load lands: does the first level start on top of the second when its world arrives?
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const B = await chromium.launch(), F3G = { offline: false, latency: 562.5, downloadThroughput: 180000, uploadThroughput: 84375 }, out = {};
async function run(name, second) {
  const ctx = await B.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("sappers-path.tour.v1", "1"); } catch (e) {} });
  const p = await ctx.newPage(), c = await ctx.newCDPSession(p); await c.send("Network.enable"); await c.send("Network.emulateNetworkConditions", F3G);
  await p.goto("http://127.0.0.1:8481/?debug=1"); await p.waitForFunction(() => window.SP && document.getElementById("home-camp").textContent, null, { timeout: 120000 });
  await p.click("#btn-tomap"); await p.waitForFunction(() => !document.getElementById("map").hidden); if (await p.evaluate(() => document.body.dataset.mode !== "zen")) await p.click('#map-mode button[data-mode="zen"]');
  await p.waitForFunction(() => document.body.dataset.mode === "zen" && document.querySelector('#jr .mn[data-n="251"]'));
  await p.evaluate(() => { const b = document.querySelector('#jr .mn[data-n="251"]'); b.scrollIntoView({ block: "center" }); b.click(); }); await p.waitForTimeout(400);
  await second(p); await p.waitForTimeout(300);
  const mid = await p.evaluate(() => ({ s: SP.state().id, mode: SP.mode(), pend: JSON.stringify(SP.pend()) }));
  await p.evaluate(() => { const S = SP.state(); if (S.status === "playing") { SP.play(0); SP.settle(); } }); const midPlays = await p.evaluate(() => SP.state().plays);
  await p.waitForFunction(() => SP.worlds().find((w) => w.k === 3).stubs === 0, null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500);
  out[name] = { mid, midPlays, after: await p.evaluate(() => ({ s: SP.state().id, plays: SP.state().plays, mode: SP.mode(), num: document.getElementById("lvl-num").textContent, pend: JSON.stringify(SP.pend()) })) };
  await ctx.close();
}
await run("zenNodeThenZenCardViaHome?", async (p) => { await p.click('#map-mode button[data-mode="campaign"]'); await p.waitForTimeout(300); await p.evaluate(() => { const b = document.querySelector('#jr .mn[data-n="1"]'); b.scrollIntoView({ block: "center" }); b.click(); }); await p.waitForFunction(() => document.getElementById("map").hidden, null, { timeout: 30000 }).catch(() => {}); });
console.log(JSON.stringify(out, null, 1)); await B.close();
