// Visual critic 1: DOM measurements (read-only). Coach cover of fort rows, 400 iframe queue clipping, head font sizes, rod lengths, title peek.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const B = "http://127.0.0.1:8493/sappers-path/", browser = await chromium.launch(), out = {};
async function open(w, h, dpr, touch, iframe) {
  const ctx = await browser.newContext({ viewport: { width: iframe ? 460 : w, height: iframe ? 700 : h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); let T = page;
  if (iframe) { await page.goto(B + "tools/iframe-host.html"); for (let i = 0; i < 100; i++) { T = page.frames().find((f) => f.url().includes("?debug=1")); if (T) break; await page.waitForTimeout(100); } }
  else await page.goto(B + "?debug=1");
  await T.waitForFunction(() => window.SP && document.fonts.status === "loaded"); return { ctx, T };
}
const probe = async (ids) => {
  const lv = (await (await fetch("tools/build-data/levels/levels.json")).json()).levels, res = [];
  for (const n of ids) {
    SP.load(n, "normal"); SP.tick(40); await new Promise((r) => setTimeout(r, 60));
    const L = lv.find((l) => l.n === n), st = SP.state(), cv = document.getElementById("board"), br = cv.getBoundingClientRect(), k = br.width / cv.width, cs = st.cs * k, co = document.getElementById("coach");
    const turned = document.body.classList.contains("turned"), r = { n, cs: +cs.toFixed(2), turned };
    if (co && !co.hidden && co.getBoundingClientRect().height) { const cr = co.getBoundingClientRect(); const ov = cr.bottom - br.top; r.coachOver = Math.round(ov);
      if (!turned && ov > 0) { const rows = Math.ceil(ov / cs); let first = -1; for (let y = 0; y < L.h && first < 0; y++) if (/[a-n]/.test(L.grid[y])) first = y; r.rowsCovered = rows; r.firstFortRow = first; r.fortRowsHidden = Math.max(0, rows - first);
        // Which covered columns hold fort blocks, and the tower ranges (dashed rings) that reach into the covered band.
        let cells = 0; for (let y = 0; y < Math.min(rows, L.h); y++) cells += (L.grid[y].match(/[a-n]/g) || []).length; r.fortCellsUnderCoach = cells; } }
    const q = document.querySelectorAll("#tray .tile"); let maxB = 0; q.forEach((t) => { const b = t.getBoundingClientRect(); if (b.height && !t.classList.contains("none")) maxB = Math.max(maxB, b.bottom); }); r.trayBottom = Math.round(maxB); r.vh = innerHeight;
    const svg = document.querySelector("#tray svg.rods"); if (svg) r.rods = Array.from(svg.querySelectorAll("line,path")).map((g) => Math.round(g.getTotalLength ? g.getTotalLength() : 0));
    const qq = document.querySelector("#tray .tile.mys .q"); if (qq) r.qFont = getComputedStyle(qq).fontSize + "/" + getComputedStyle(document.querySelector("#tray .tile.mys .n")).fontSize;
    r.headFont = getComputedStyle(document.getElementById("line-head")).fontSize; r.nameFont = getComputedStyle(document.getElementById("lvl-name")).fontSize;
    res.push(r);
  }
  return res;
};
const debugRods = () => ["v4-linked", "v4-all"].map((id) => { SP.load(id, "normal"); SP.tick(40); const svg = document.querySelector("#tray svg.rods"); return { id, rods: Array.from(svg.querySelectorAll("line,path,circle")).map((g) => g.tagName + ":" + Math.round(g.getTotalLength ? g.getTotalLength() : 0) + ":" + (g.getAttribute("stroke-width") || getComputedStyle(g).strokeWidth)) }; });
const titlePeek = () => { SP.screen("title"); return [60, 180, 300].map((x) => document.elementsFromPoint(x, 583).slice(0, 3).map((e) => e.id || e.className || e.tagName).join(" > ")); };
for (const [tag, w, h, dpr, touch, ifr] of [["375", 375, 812, 3, true, false], ["1280", 1280, 720, 1, false, false], ["812", 812, 375, 3, true, false], ["400", 400, 600, 2, false, true]]) {
  const { ctx, T } = await open(w, h, dpr, touch, ifr);
  out[tag] = await T.evaluate(probe, [1, 35, 62, 76, 77, 88, 100]);
  if (tag === "375") { out.debugRods = await T.evaluate(debugRods); out.titlePeek = await T.evaluate(titlePeek); }
  await ctx.close();
}
await browser.close(); console.log(JSON.stringify(out));
