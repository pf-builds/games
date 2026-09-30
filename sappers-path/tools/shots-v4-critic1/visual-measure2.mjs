// Visual critic 1, second probe (read-only): coach persistence, linked-slot badge overlap, line-head collision, desktop fill.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const B = "http://127.0.0.1:8493/sappers-path/", browser = await chromium.launch(), out = {};
async function open(w, h, dpr, touch, iframe) {
  const ctx = await browser.newContext({ viewport: { width: iframe ? 460 : w, height: iframe ? 700 : h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); let T = page;
  if (iframe) { await page.goto(B + "tools/iframe-host.html"); for (let i = 0; i < 100; i++) { T = page.frames().find((f) => f.url().includes("?debug=1")); if (T) break; await page.waitForTimeout(100); } }
  else await page.goto(B + "?debug=1");
  await T.waitForFunction(() => window.SP && document.fonts.status === "loaded"); return { ctx, T, page };
}
const vis = () => { const c = document.getElementById("coach"); if (!c || c.hidden) return false; const s = getComputedStyle(c); return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.05 && c.getBoundingClientRect().height > 0; };
{ const { ctx, T, page } = await open(400, 600, 2, false, true);
  out.coach = await T.evaluate(async (visSrc) => { const vis = eval(visSrc); const r = {}; SP.load(62, "normal"); SP.tick(40); r.atStart = vis();
    await new Promise((z) => setTimeout(z, 4000)); r.after4sIdle = vis(); const o = SP.winOrder("normal"); SP.play(+o[0]); SP.tick(3000); await new Promise((z) => setTimeout(z, 300)); r.afterTap1 = vis(); r.text1 = document.getElementById("coach").textContent;
    SP.settle(); SP.play(+o[1]); SP.tick(3000); await new Promise((z) => setTimeout(z, 300)); r.afterTap2 = vis(); return r; }, "(" + vis.toString() + ")");
  await ctx.close(); }
{ const { ctx, T } = await open(375, 812, 3, true, false);
  out.linkedSlot = await T.evaluate(() => { SP.load("v4-linked", "normal"); SP.tick(40); const b = document.querySelector(".tile.card.linked"); SP.play(+b.dataset.col); SP.tick(350);
    const ov = (a, c) => { const x = Math.min(a.right, c.right) - Math.max(a.left, c.left), y = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); return x > 0 && y > 0 ? [Math.round(x), Math.round(y)] : 0; };
    return Array.from(document.querySelectorAll("#line .slot")).slice(0, 2).map((s) => { const n = s.querySelector("b").getBoundingClientRect(), lk = s.querySelector(".lk").getBoundingClientRect(), pad = s.querySelector(".pad").getBoundingClientRect(), men = s.querySelector(".men").getBoundingClientRect();
      // the count's glyph box: text width via a range
      const rg = document.createRange(); rg.selectNodeContents(s.querySelector("b")); const g = rg.getBoundingClientRect();
      return { cls: s.className, count: s.querySelector("b").textContent, glyph: [Math.round(g.left), Math.round(g.top), Math.round(g.width), Math.round(g.height)], chain: [Math.round(lk.left), Math.round(lk.top), Math.round(lk.width), Math.round(lk.height)], chainOverGlyph: ov(g, lk), padOverGlyph: ov(g, pad), menOverGlyph: ov(g, men) }; }); });
  out.head375 = await T.evaluate(() => { const r = SP.stage(40, 3, 2); SP.tick(400); const a = document.getElementById("line-lab").getBoundingClientRect(), b = document.getElementById("line-cnt").getBoundingClientRect(); return { lab: document.getElementById("line-lab").textContent, cnt: document.getElementById("line-cnt").textContent, gapPx: Math.round(b.left - a.right), labW: Math.round(a.width), cntW: Math.round(b.width), font: getComputedStyle(document.getElementById("line-head")).fontSize }; });
  await ctx.close(); }
{ const { ctx, T } = await open(1280, 720, 1, false, false);
  out.desk = await T.evaluate(() => { SP.load(40, "normal"); SP.tick(40); const u = (id) => document.getElementById(id).getBoundingClientRect(); const bd = u("board"), rl = u("rail"), tp = u("top");
    const area = bd.width * bd.height + rl.width * rl.height; return { board: [bd.left, bd.top, bd.width, bd.height].map(Math.round), rail: [rl.left, rl.top, rl.width, rl.height].map(Math.round), top: [tp.left, tp.top, tp.width, tp.height].map(Math.round), usedPct: Math.round((100 * area) / (1280 * 720)), rightGap: Math.round(1280 - rl.right), gapBoardRail: Math.round(rl.left - bd.right) }; });
  await ctx.close(); }
await browser.close(); console.log(JSON.stringify(out, null, 1));
