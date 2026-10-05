// Critic v5 R4 visual: shots for levels 101-200 and map sheets 13-25. Read-only on the game.
import { writeFileSync } from "node:fs";
const OUT = "/Users/peter/Documents/Claude/business/D-click-it-studios/repos/games-sappers-path/sappers-path/tools/critic-v5-r4-visual/";
const URL_ = "http://127.0.0.1:8493/sappers-path/?debug=1";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch();
const VPS = { phone: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, desk: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } };
const only = process.argv[2] || "all";
const notes = {}, log = [];
const fresh = async (vp) => { const ctx = await browser.newContext(VPS[vp]), page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(vp + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(vp + " pageerror: " + e.message));
  await page.goto(URL_, { waitUntil: "load" });
  await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000, polling: 100 });
  return { ctx, page }; };
const nodbg = (page) => page.evaluate(() => { const d = document.getElementById("jr-dbg"); if (d) d.remove(); });
const drawn = (page) => page.waitForFunction(() => { const r = Array.from(document.querySelectorAll(".jr-img")).filter((i) => i.getAttribute("src")); return r.length > 0 && r.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 15000, polling: 50 }).catch(() => log.push("drawn timeout"));
const snap = (page, vp, name) => page.screenshot({ path: OUT + vp + "-" + name + ".png" });
const pics = (n) => Math.max(0, Math.min(50, Math.floor((n - 4) / 4)));

if (only === "all" || only === "self") {
  for (const vp of ["phone", "desk"]) { const { ctx, page } = await fresh(vp); const st = await page.evaluate(() => SP.selfTest()); notes["selfTest-" + vp] = { pass: st.pass, fail: st.fail, ms: st.ms }; await ctx.close(); }
}

if (only === "all" || only === "boards") {
  const BOARDS = [101, 106, 113, 120, 128, 133, 141, 147, 153, 160, 167, 172, 178, 185, 192, 197, 200, 125, 150];
  for (const vp of ["phone", "desk"]) { const { ctx, page } = await fresh(vp);
    for (const n of BOARDS) {
      notes[vp + "-b" + n] = await page.evaluate((n) => { SP.load(n); SP.tick(1200); const s = SP.state(); return { id: s.id, tag: s.tag, cap: s.cap }; }, n);
      await page.waitForTimeout(120); await snap(page, vp, "b" + n + "-start");
      await page.evaluate(() => { const o = SP.winOrder(); for (let i = 0; i < Math.floor(o.length / 2); i++) { SP.play(+o[i]); SP.tick(900); } SP.tick(300); });
      await page.waitForTimeout(120); await snap(page, vp, "b" + n + "-mid");
    }
    // archers in action: first hit on tower levels
    for (const n of [133, 160, 200]) {
      const r = await page.evaluate((n) => { SP.load(n); SP.tick(1200); const ord = SP.hitPlan(); if (!ord) return null; for (let i = 0; i < ord.length - 1; i++) { SP.play(+ord[i]); SP.settle(); }
        SP.play(+ord[ord.length - 1]); let t = 0; for (; t < 8000 && SP.state().hits === 0; t += 40) SP.tick(40); SP.tick(120); return { ord, t, hits: SP.state().hits }; }, n);
      notes[vp + "-hit" + n] = r; await page.waitForTimeout(80); await snap(page, vp, "hit" + n);
      await page.evaluate(() => SP.tick(350)); await snap(page, vp, "hit" + n + "-b");
    }
    // win panel on 160, lose panel on first new-realm loss
    notes[vp + "-win"] = await page.evaluate(() => { SP.load(160); SP.tick(1200); for (const c of SP.winOrder()) { SP.play(+c); for (let i = 0; i < 6000 && SP.state().busy; i++) SP.tick(16); } SP.tick(9000); const s = SP.state(); return { status: s.status, panel: s.panel }; });
    await page.waitForTimeout(500); await snap(page, vp, "win160");
    notes[vp + "-lose"] = await page.evaluate(() => { for (let n = 101; n <= 199; n++) { SP.load(n); const p = SP.lossPlan(); if (p) { SP.load(n); SP.tick(1200); for (const c of p.prefix) { SP.play(+c); SP.settle(); } for (let i = 0; i < 600 && !SP.state().panel; i++) SP.tick(16); const s = SP.state(); return { n, status: s.status, reason: s.reason, panel: s.panel }; } } return null; });
    await page.waitForTimeout(500); await snap(page, vp, "lose");
    await ctx.close(); }
}

if (only === "all" || only === "map") {
  const MAPS = [["cur-110", 109, pics(109)], ["cur-130", 129, pics(129)], ["cur-160", 159, pics(159)], ["cur-190", 189, pics(189)], ["summit", 199, pics(199)], ["all-200", 200, 50]];
  for (const vp of ["phone", "desk"]) {
    for (const [name, n, k] of MAPS) { const { ctx, page } = await fresh(vp); await nodbg(page);
      notes[vp + "-" + name] = await page.evaluate(([n, k]) => { SP.unlockTo(n); if (k) SP.clearPictures(k); SP.screen("map"); return SP.map(); }, [n, k]);
      await drawn(page); await page.waitForTimeout(300); await snap(page, vp, "map-" + name);
      if (name === "cur-130" || name === "cur-160") { // locked-node contrast
        notes[vp + "-" + name + "-locked"] = await page.evaluate(() => { const cs = (el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, color: s.color, border: s.borderColor, op: s.opacity, cls: el.className }; };
          const ms = Array.from(document.querySelectorAll("#jr .mn")); const cur = document.querySelector("#jr .mn.cur, #jr .jr-cur"); const out = [];
          for (const m of ms) { const r = m.getBoundingClientRect(); if (r.top > 60 && r.bottom < innerHeight - 60 && out.length < 6) out.push(Object.assign({ n: m.dataset.n, html: m.outerHTML.slice(0, 160) }, cs(m), m.firstElementChild ? { child: cs(m.firstElementChild) } : {})); }
          return out; }); }
      if (name === "all-200") { // seams 12/13 .. 24/25
        const seams = await page.evaluate(() => { const sc = document.getElementById("jr"), r0 = sc.getBoundingClientRect(); return Array.from(document.querySelectorAll("#jr .jr-sheet")).map((el) => { const r = el.getBoundingClientRect(); return { s: +el.dataset.sheet, top: r.top - r0.top + sc.scrollTop, bot: r.bottom - r0.top + sc.scrollTop }; }); });
        notes[vp + "-sheets"] = seams;
        for (let s = 12; s <= 24; s++) { const a = seams.find((x) => x.s === s), b = seams.find((x) => x.s === s + 1); if (!a || !b) continue; const y = a.top < b.top ? a.top : b.top; const join = a.top < b.top ? a.top : a.bot; // join between them
          const jy = Math.abs(a.top - b.bot) < Math.abs(b.top - a.bot) ? a.top : a.bot;
          await page.evaluate((jy) => { const sc = document.getElementById("jr"); sc.scrollTop = jy - sc.clientHeight / 2; }, jy);
          await page.waitForTimeout(200); await drawn(page); await page.waitForTimeout(150); await snap(page, vp, "seam-" + s + "-" + (s + 1)); }
        // fog top of summit sheet
        await page.evaluate(() => { const sc = document.getElementById("jr"); sc.scrollTop = 0; }); await page.waitForTimeout(200); await drawn(page); await snap(page, vp, "map-top");
      }
      await ctx.close(); }
  }
}

if (only === "all" || only === "audit") { // label grazes, phone, at every current level 100-200
  for (const vp of ["phone", "desk"]) { const { ctx, page } = await fresh(vp); await nodbg(page); const bad = [];
    for (let n = 99; n <= 200; n += 1) {
      const a = await page.evaluate((k) => { SP.unlockTo(k); SP.clearPictures(Math.max(0, Math.min(50, Math.floor((k - 4) / 4)))); SP.screen("map");
        const ov = (p, q) => { const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); return w > 0 && h > 0 ? Math.round(w * h) : 0; };
        const lab = document.querySelector("#jr .jr-cur"); if (!lab) return { k, none: true }; const r = lab.getBoundingClientRect(); const own = lab.closest(".mn");
        const tg = Array.from(document.querySelectorAll("#jr .mn, #jr .qn:not([hidden]), #jr .egg:not([hidden]), #jr .bn, #jr .qn.open .prz, #jr .jr-king, #jr .king"));
        const hits = []; for (const x of tg) if (x !== own && !x.contains(lab) && !lab.contains(x)) { const o = ov(r, x.getBoundingClientRect()); if (o > 0) hits.push([x.className.baseVal || x.className, x.dataset.n || x.dataset.id || "", o]); }
        const W = innerWidth; return { k, cur: own ? own.dataset.n : null, txt: lab.textContent.trim().slice(0, 30), w: Math.round(r.width), clipL: r.left < 0, clipR: r.right > W, hits }; }, n);
      if (a.hits && a.hits.length || a.clipL || a.clipR) bad.push(a); }
    notes[vp + "-audit"] = bad; await ctx.close(); }
}
await browser.close();
writeFileSync(OUT + "notes-" + only + ".json", JSON.stringify({ notes, log }, null, 1));
console.log(JSON.stringify({ log: log.slice(0, 20) }));
