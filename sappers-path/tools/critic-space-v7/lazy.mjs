// Critic (space v7, functional): lazy Zen worlds under a throttled connection, failure paths, races, and bytes.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
import { writeFileSync } from "node:fs";
const BASE = "http://127.0.0.1:8482/", NEW = "http://127.0.0.1:8481/";
const B = await chromium.launch(), log = [], res = {};
const F3G = { offline: false, latency: 562.5, downloadThroughput: 180000, uploadThroughput: 84375 };
async function ctxOf(url, { throttle = false, debug = true, ls = {}, vp = [375, 812] } = {}) {
  const ctx = await B.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript((ls) => { try { if (sessionStorage.getItem("crit")) return; sessionStorage.setItem("crit", "1"); localStorage.setItem("sappers-path.tour.v1", "1"); for (const k of Object.keys(ls)) localStorage.setItem(k, ls[k]); } catch (e) {} }, ls);
  const p = await ctx.newPage(), reqs = [], tag = (url === NEW ? "new" : "base") + (throttle ? "/3g" : "");
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.type() + ": " + m.text()); });
  p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  p.on("requestfailed", (r) => { if (!/zen-[0-9]\.pk/.test(r.url())) log.push(tag + " failed " + r.url() + " " + (r.failure() || {}).errorText); });
  p.on("response", (r) => { if (r.status() >= 400) log.push(tag + " HTTP " + r.status() + " " + r.url()); });
  p.on("request", (r) => reqs.push({ r, url: r.url(), t: Date.now() }));
  if (throttle) { const c = await ctx.newCDPSession(p); await c.send("Network.enable"); await c.send("Network.emulateNetworkConditions", F3G); }
  const t0 = Date.now(); await p.goto(url + (debug ? "?debug=1" : ""));
  return { ctx, p, reqs, t0 };
}
const homeReady = (p) => p.waitForFunction(() => { const b = document.getElementById("btn-play"); return b && b.offsetParent && !document.getElementById("title").hidden && !document.getElementById("load-msg").textContent && document.getElementById("home-camp").textContent !== "" && !document.getElementById("btn-zen").hidden && (location.search.indexOf("debug") < 0 || !!window.SP); }, null, { timeout: 120000, polling: 50 });
const playing = (p, ms = 60000) => p.waitForFunction(() => document.getElementById("title").hidden && document.getElementById("map").hidden && document.getElementById("lvl-num").textContent, null, { timeout: ms, polling: 50 });
const worldReqs = (reqs) => reqs.filter((q) => /zen-[0-9]+\.pk\.json/.test(q.url)).map((q) => q.url.match(/zen-[0-9]+/)[0]);
async function zenMap(p) {
  await p.click("#btn-tomap"); await p.waitForFunction(() => !document.getElementById("map").hidden, null, { timeout: 60000 });
  if (await p.evaluate(() => document.body.dataset.mode !== "zen")) await p.click('#map-mode button[data-mode="zen"]');
  await p.waitForFunction(() => document.body.dataset.mode === "zen" && document.querySelector("#jr .mn"), null, { timeout: 60000 });
}
const view = (p) => p.evaluate(() => ({ screen: !document.getElementById("title").hidden ? "title" : !document.getElementById("map").hidden ? "map" : "play", num: document.getElementById("lvl-num").textContent, toast: document.getElementById("toast").hidden ? "" : document.getElementById("toast").textContent, pend: window.SP && SP.pend ? JSON.stringify(SP.pend()) : null }));
const tapNode = (p, n) => p.evaluate((n) => { const b = document.querySelector('#jr .mn[data-n="' + n + '"]'); if (!b) return "no node " + n; b.scrollIntoView({ block: "center" }); b.click(); return "ok"; }, n);

// S1: cold load on Fast 3G, base vs new: time and requests to the home, then the Zen map (new) with no world file.
console.error("step S1");
for (const u of [BASE, NEW]) {
  const c = await ctxOf(u, { throttle: true, debug: false }); await homeReady(c.p); const tHome = Date.now() - c.t0;
  const k = u === NEW ? "new" : "base"; res["s1_" + k] = { homeMs: tHome, reqsBeforeHome: c.reqs.length };
  const t1 = Date.now(); await zenMap(c.p); res["s1_" + k].zenMapMs = Date.now() - t1; res["s1_" + k].worldFiles = worldReqs(c.reqs); res["s1_" + k].nodes = await c.p.evaluate(() => document.querySelectorAll("#jr .mn").length);
  await c.ctx.close();
}
// S2: each world opened cold from the Zen map on Fast 3G (fresh storage: each world's first picture is open).
console.error("step S2");
res.s2 = [];
for (const n of [1, 201, 251, 301]) {
  const c = await ctxOf(NEW, { throttle: true }); await homeReady(c.p); await zenMap(c.p); const before = worldReqs(c.reqs);
  const t = Date.now(); const tap = await tapNode(c.p, n); await c.p.waitForTimeout(150); const at150 = await view(c.p); await c.p.waitForTimeout(600); const at750 = await view(c.p);
  let ok = true; try { await playing(c.p); } catch (e) { ok = false; }
  res.s2.push({ n, tap, before, at150, at750, playedMs: Date.now() - t, ok, end: await view(c.p), files: worldReqs(c.reqs) }); await c.ctx.close();
}
// S3: back out mid-load (home), then open another world: the first must never start later.
console.error("step S3");
{ const c = await ctxOf(NEW, { throttle: true }); await homeReady(c.p); await zenMap(c.p);
  await tapNode(c.p, 251); await c.p.waitForTimeout(200); await c.p.click("#btn-home"); await c.p.waitForTimeout(300); const home = await view(c.p);
  await zenMap(c.p); await tapNode(c.p, 301); await playing(c.p); const p1 = await view(c.p);
  await c.p.waitForFunction(() => SP.worlds().filter((w) => w.k >= 3).every((w) => w.stubs === 0), null, { timeout: 60000 }).catch(() => {}); await c.p.waitForTimeout(1500);
  res.s3 = { home, p1, after: await view(c.p), worlds: await c.p.evaluate(() => SP.worlds()) }; await c.ctx.close(); }
// S4: race: a tap on a loading world, then a tap on a loaded world's level before the first load lands.
console.error("step S4");
{ const c = await ctxOf(NEW, { throttle: true }); await homeReady(c.p); await zenMap(c.p);
  await tapNode(c.p, 1); await playing(c.p); await c.p.evaluate(() => SP.screen("title")); await zenMap(c.p); // World 1 now loaded
  await tapNode(c.p, 251); await c.p.waitForTimeout(500); const mid = await view(c.p); await tapNode(c.p, 2 > 1 ? 1 : 1); await c.p.waitForTimeout(200); const p1 = await view(c.p);
  await c.p.waitForFunction(() => SP.worlds().find((w) => w.k === 3).stubs === 0, null, { timeout: 60000 }).catch(() => {}); await c.p.waitForTimeout(1500);
  const after = await view(c.p), st = await c.p.evaluate(() => SP.state()); res.s4 = { mid, p1, after, stateId: st.id, statePlays: st.plays }; await c.ctx.close(); }
// S5: World 4's file blocked: the tap fails gracefully; unblocked, the next tap plays. Also a tap on another world meanwhile.
console.error("step S5");
{ const c = await ctxOf(NEW, { throttle: false }); await homeReady(c.p); await c.p.route("**/levels/zen-4.pk.json*", (r) => r.abort()); await zenMap(c.p);
  await tapNode(c.p, 301); await c.p.waitForTimeout(1200); const fail = await view(c.p); await c.p.waitForTimeout(4000); const later = await view(c.p);
  await c.p.unroute("**/levels/zen-4.pk.json*"); await tapNode(c.p, 301); let ok = true; try { await playing(c.p, 10000); } catch (e) { ok = false; }
  res.s5 = { fail, later, retryOk: ok, end: await view(c.p) }; await c.ctx.close(); }
// S6: win World 1's last picture (Fast 3G, nothing else loaded) and press Next at once: World 2 must open.
console.error("step S6");
{ const c = await ctxOf(NEW, { throttle: true }); await homeReady(c.p);
  await c.p.evaluate(() => SP.zenTo(1, 49)); await c.p.click("#btn-zen"); await playing(c.p); const at = await view(c.p);
  await c.p.evaluate(() => { const o = SP.winOrder(); for (const ch of o) { if (SP.state().status !== "playing") break; SP.play(ch.charCodeAt(0) - 48); SP.settle(); } SP.tick(9000); });
  const win = await c.p.evaluate(() => ({ s: SP.state().status, prim: document.getElementById("p-primary").textContent, worlds: SP.worlds() }));
  await c.p.waitForTimeout(1500); const t = Date.now(); await c.p.evaluate(() => document.getElementById("p-primary").click()); await c.p.waitForTimeout(300); const mid = await view(c.p);
  await c.p.waitForFunction((n0) => document.getElementById("lvl-num").textContent !== n0 && document.getElementById("map").hidden && document.getElementById("title").hidden, at.num, { timeout: 60000 }).catch(() => {});
  res.s6 = { at, win, mid, ms: Date.now() - t, end: await view(c.p), st: await c.p.evaluate(() => SP.state().id) }; await c.ctx.close(); }
// S7: reload mid-world (World 3, 7 cleared, Zen last): the prefetch, then the Zen card.
console.error("step S7");
{ const c = await ctxOf(NEW, { throttle: true }); await homeReady(c.p); await c.p.evaluate(() => SP.zenTo(3, 7)); const n0 = c.reqs.length;
  await c.p.reload(); await homeReady(c.p); await c.p.waitForTimeout(2500); const pre = worldReqs(c.reqs.slice(n0));
  const t = Date.now(); await c.p.click("#btn-zen"); await playing(c.p); res.s7 = { prefetched: pre, ms: Date.now() - t, end: await view(c.p), st: await c.p.evaluate(() => SP.state().id) }; await c.ctx.close(); }
// S8: a Campaign-only player: no Zen world file at all, even after a level and the map.
console.error("step S8");
{ const c = await ctxOf(NEW, { throttle: false }); await homeReady(c.p); await c.p.click("#btn-play"); await playing(c.p); await c.p.click("#btn-home").catch(() => {}); await c.p.waitForTimeout(2000);
  res.s8 = { files: worldReqs(c.reqs) }; await c.ctx.close(); }
// Bytes: unthrottled, no debug, fresh storage (tour seen): to the home, to the first Campaign level, to the first Zen level.
console.error("step Bytes");
async function bytes(u, card) {
  const c = await ctxOf(u, { debug: false }); await homeReady(c.p); const home = c.reqs.slice();
  let tap = null; if (card) { await c.p.click(card); await playing(c.p); await c.p.waitForLoadState("networkidle"); await c.p.waitForTimeout(500); tap = c.reqs.slice(); }
  const sum = async (L) => { let s = 0; for (const q of L) { try { const z = await q.r.sizes(); s += z.responseBodySize; } catch (e) {} } return s; };
  const o = { home: await sum(home), homeN: home.length, tap: tap ? await sum(tap) : null, tapN: tap ? tap.length : null, list: (tap || home).map((q) => q.url.replace(u, "")).filter((x) => !/^data:/.test(x)) }; await c.ctx.close(); return o;
}
res.bytes = {};
for (const [k, u] of [["base", BASE], ["new", NEW]]) { const h = await bytes(u, null), cp = await bytes(u, "#btn-play"), zn = await bytes(u, "#btn-zen"); res.bytes[k] = { home: h.home, campaign: cp.tap, zen: zn.tap, zenList: zn.list.filter((x) => /levels|map/.test(x)) }; }
res.log = log;
writeFileSync(new URL("./lazy-out.json", import.meta.url), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 0).slice(0, 6000));
await B.close();
