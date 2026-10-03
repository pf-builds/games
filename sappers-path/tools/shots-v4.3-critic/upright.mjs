// v4.2 visual re-check (read-only): the upright card on touch landscape phones, never on desktop or iframes; no turned boards.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const B = "http://127.0.0.1:8493/sappers-path/", OUT = new URL("./visual/upright/", import.meta.url).pathname, b = await chromium.launch(), out = { errors: [] };
const probe = () => { const u = document.getElementById("upright"), s = SP.state(); const vis = !u.hidden && getComputedStyle(u).display !== "none"; return { card: vis, text: vis ? u.textContent.trim() : "", paused: SP.paused(), clock: s.clock, turned: document.body.classList.contains("turned"), cs: +(s.cs / devicePixelRatio).toFixed(2), screen: s.screen }; };
async function open(w, h, touch, iframe) {
  const c = await b.newContext({ viewport: { width: iframe ? w + 60 : w, height: iframe ? h + 100 : h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch }), p = await c.newPage(); let T = p, clip;
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") out.errors.push(m.text()); }); p.on("pageerror", (e) => out.errors.push(e.message));
  if (iframe) { await p.goto(B + "tools/iframe-host.html?w=" + w + "&h=" + h); for (let i = 0; i < 100; i++) { T = p.frames().find((f) => f.url().includes("?debug=1")); if (T) break; await p.waitForTimeout(100); } clip = await p.locator("#game").boundingBox(); }
  else await p.goto(B + "?debug=1");
  await T.waitForFunction(() => window.SP && document.fonts.status === "loaded"); return { c, p, T, clip };
}
const start = (id) => { SP.speed(1); SP.load(id, "normal"); SP.tick(40); const fr = SP.state().fronts; SP.play(fr.findIndex((f) => f)); SP.tick(300); return true; };
// Touch phones held sideways, then turned upright.
for (const [tag, w, h] of [["667x375", 667, 375], ["740x360", 740, 360], ["844x390", 844, 390]]) {
  const { c, p, T } = await open(w, h, true); await T.evaluate(start, 64); await p.waitForTimeout(300);
  const a = await T.evaluate(probe); await p.waitForTimeout(1200); const a2 = await T.evaluate(probe);
  await p.screenshot({ path: OUT + "touch-" + tag + "-card.png" });
  await p.setViewportSize({ width: h, height: w }); await p.waitForTimeout(500); const up = await T.evaluate(probe); await p.waitForTimeout(800); const up2 = await T.evaluate(probe);
  await p.screenshot({ path: OUT + "touch-" + tag + "-upright.png" });
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(400); const back = await T.evaluate(probe);
  // Home screen sideways too.
  await T.evaluate(() => SP.screen("title")); await p.waitForTimeout(200); const home = await T.evaluate(probe);
  out[tag] = { sideways: a, clockMovedWhileCard: a2.clock - a.clock, upright: up, clockMovedUpright: up2.clock - up.clock, sidewaysAgain: back.card, homeSideways: home.card };
  await c.close();
}
// Never on desktop windows or iframes; boards upright.
for (const [tag, w, h, touch, ifr] of [["900x500", 900, 500, false], ["1280x720", 1280, 720, false], ["812x375desk", 812, 375, false], ["844x390desk", 844, 390, false], ["400x600if", 400, 600, false, true], ["740x360if-touch", 740, 360, true, true]]) {
  const { c, p, T, clip } = await open(w, h, touch, ifr); const r = [];
  for (const id of [8, 26, 64, 100, "g-tw-1f355", "g-noto-1f431", "g-met-57007"]) { await T.evaluate((id) => { SP.load(id, "normal"); SP.tick(40); }, id); await p.waitForTimeout(80); r.push([id, await T.evaluate(probe)]); }
  out[tag] = { cards: r.filter((x) => x[1].card).length, turned: r.filter((x) => x[1].turned).length, cs: r.map((x) => x[0] + ":" + x[1].cs).join(" "), paused: r.some((x) => x[1].paused) };
  await T.evaluate(() => { SP.load(100, "normal"); SP.tick(40); }); await p.waitForTimeout(250); await p.screenshot({ path: OUT + tag + "-l100.png", clip });
  await c.close();
}
// Portrait phones unchanged.
for (const [tag, w, h] of [["375x812", 375, 812], ["390x844", 390, 844], ["375x667", 375, 667], ["414x736", 414, 736]]) {
  const { c, p, T } = await open(w, h, true); const r = [];
  for (const id of [25, 26, 40, 77, 100, "g-tw-1f355", "g-met-57007"]) { await T.evaluate((id) => { SP.load(id, "normal"); SP.tick(40); }, id); await p.waitForTimeout(60); const q = await T.evaluate(probe); r.push(id + ":" + q.cs + (q.card ? "!CARD" : "") + (q.turned ? "!TURN" : "")); }
  out[tag] = r.join(" "); await c.close();
}
await b.close(); console.log(JSON.stringify(out, null, 1));
