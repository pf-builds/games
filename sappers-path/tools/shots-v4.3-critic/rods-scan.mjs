// Visual critic 1, re-check 2 (read-only): rods/rivets vs counts and tile faces along every linked level's stored Normal order
// at 375, 1280 and the 400x600 iframe; desktop tray below the queue; queue row bands; iframe level 77 coach.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const B = "http://127.0.0.1:8493/sappers-path/", browser = await chromium.launch(), out = {};
async function open(w, h, dpr, touch, iframe) {
  const ctx = await browser.newContext({ viewport: { width: iframe ? 460 : w, height: iframe ? 700 : h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); let T = page; page.on("pageerror", (e) => (out.errors = (out.errors || []).concat(e.message)));
  if (iframe) { await page.goto(B + "tools/iframe-host.html"); for (let i = 0; i < 100; i++) { T = page.frames().find((f) => f.url().includes("?debug=1")); if (T) break; await page.waitForTimeout(100); } }
  else await page.goto(B + "?debug=1");
  await T.waitForFunction(() => window.SP && document.fonts.status === "loaded"); return { ctx, T };
}
const scan = (ids) => {
  const o = { states: 0, rivetOnGlyph: 0, rodInGlyph: 0, rodOnFace: 0, third: 0, ex: [] };
  const glyph = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); };
  for (const n of ids) {
    const st = SP.load(n, "normal"); if (!st.links) continue; SP.tick(20); const ord = SP.winOrder() || "";
    for (let i = 0; i <= ord.length; i++) {
      const svg = document.querySelector("#tray svg.rods"), sb = svg.getBoundingClientRect(); o.states++;
      const tiles = Array.from(document.querySelectorAll("#tray .tile")).filter((t) => !t.classList.contains("none") && !t.classList.contains("empty") && t.getBoundingClientRect().width).map((t) => ({ t, b: t.getBoundingClientRect() }));
      const gl = Array.from(document.querySelectorAll("#tray .tile .n")).filter((e) => e.textContent && e.getBoundingClientRect().width).map((e) => ({ t: e.textContent, r: glyph(e) }));
      for (const c of svg.querySelectorAll("circle")) { const b = c.getBoundingClientRect(); if (b.width < 4) continue; for (const g of gl) { const x = Math.min(b.right, g.r.right) - Math.max(b.left, g.r.left), y = Math.min(b.bottom, g.r.bottom) - Math.max(b.top, g.r.top); if (x > 0.5 && y > 0.5) { o.rivetOnGlyph++; if (o.ex.length < 6) o.ex.push(n + "@" + i + " rivet on '" + g.t + "' " + Math.round(x) + "x" + Math.round(y)); } } }
      for (const p of svg.querySelectorAll("path, line, polyline")) { const L = p.getTotalLength ? p.getTotalLength() : 0; if (L < 4) continue; const sw = parseFloat(getComputedStyle(p).strokeWidth) || 0; if (sw < 3) continue;
        const inG = new Set(), onF = new Set();
        for (let k = 0; k <= 40; k++) { const q = p.getPointAtLength((L * k) / 40), x = sb.left + q.x, y = sb.top + q.y;
          gl.forEach((g, j) => { if (x > g.r.left && x < g.r.right && y > g.r.top && y < g.r.bottom) inG.add(j); });
          tiles.forEach((tt, j) => { if (x > tt.b.left + 4 && x < tt.b.right - 4 && y > tt.b.top + 4 && y < tt.b.bottom - 4) onF.add(j); }); }
        o.rodInGlyph += inG.size; o.rodOnFace += onF.size; if (onF.size > 2) o.third++;
        if ((inG.size || onF.size) && o.ex.length < 10) o.ex.push(n + "@" + i + " rod len " + Math.round(L) + " sw " + sw + " glyphs " + inG.size + " faces " + onF.size); }
      if (i < ord.length) { SP.play(+ord[i]); SP.settle(); }
    }
  }
  return o;
};
const IDS = [62, 66, 67, 70, 71, 75, 77, 78, 79, 82, 85, 87, 89, 91, 95, 99, 100, "v4-linked", "v4-all"];
const extra = async () => {
  const r = {}, bx = (id) => { const e = document.getElementById(id); if (!e) return null; const q = e.getBoundingClientRect(); return q.width ? [q.left, q.top, q.width, q.height].map(Math.round) : null; };
  for (const n of [40, 88, 100, 62]) { SP.load(n, "normal"); SP.tick(40); await new Promise((z) => setTimeout(z, 80));
    let qb = 0; document.querySelectorAll("#tray .tile").forEach((t) => { const b = t.getBoundingClientRect(); if (b.height && !t.classList.contains("none")) qb = Math.max(qb, b.bottom); });
    const rl = document.getElementById("rail").getBoundingClientRect(), sd = document.getElementById("side"), sdb = sd ? sd.getBoundingClientRect() : null, bd = document.getElementById("frame").getBoundingClientRect();
    // What sits just under the queue, halfway to the column foot: element and its background.
    const x = rl.left + rl.width / 2, y = Math.round((qb + (sdb ? sdb.bottom : innerHeight)) / 2), el = document.elementFromPoint(x, y);
    r["l" + n] = { queueBottom: Math.round(qb), rail: bx("rail"), side: bx("side"), powers: bx("powers"), frame: [bd.left, bd.top, bd.width, bd.height].map(Math.round), midBelow: el ? (el.id || el.className || el.tagName) + " bg " + getComputedStyle(el).backgroundColor : null, trayBlank: Math.round(rl.bottom - qb) }; }
  // Row bands
  SP.load(64, "normal"); SP.tick(40); r.bands = Array.from(document.querySelectorAll("#tray > *")).slice(0, 8).map((e) => (e.className && e.className.baseVal === undefined ? e.className : "svg") + ":" + getComputedStyle(e).backgroundColor + ":" + getComputedStyle(e).backgroundImage.slice(0, 60));
  // Level 77 coach
  SP.load(77, "normal"); SP.tick(40); await new Promise((z) => setTimeout(z, 120)); const c = document.getElementById("coach"), cb = c.getBoundingClientRect(), cs = SP.coach();
  const ov = (id) => { const e = document.getElementById(id); if (!e) return 0; const q = e.getBoundingClientRect(); const x = Math.min(cb.right, q.right) - Math.max(cb.left, q.left), y = Math.min(cb.bottom, q.bottom) - Math.max(cb.top, q.top); return x > 0.5 && y > 0.5 ? [Math.round(x), Math.round(y)] : 0; };
  r.l77 = { mode: cs.mode, text: c.textContent, box: [cb.left, cb.top, cb.width, cb.height].map(Math.round), font: getComputedStyle(c).fontSize, overNum: ov("lvl-num"), overName: ov("lvl-name"), overChip: ov("diff-chip"), overMap: ov("btn-map"), overRetry: ov("btn-retry"), clipped: c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1, lines: Math.round(cb.height / parseFloat(getComputedStyle(c).lineHeight || 20)) };
  return r;
};
for (const [tag, w, h, dpr, touch, ifr] of [["375", 375, 812, 3, true, false], ["1280", 1280, 720, 1, false, false], ["400", 400, 600, 2, false, true], ["812", 812, 375, 3, true, false]]) {
  const { ctx, T } = await open(w, h, dpr, touch, ifr);
  out[tag] = { extra: await T.evaluate(extra) };
  if (tag !== "812") { const s = { states: 0, rivetOnGlyph: 0, rodInGlyph: 0, rodOnFace: 0, third: 0, ex: [] }; for (const part of [IDS.slice(0, 7), IDS.slice(7, 14), IDS.slice(14)]) { const p = await T.evaluate(scan, part); for (const k of ["states", "rivetOnGlyph", "rodInGlyph", "rodOnFace", "third"]) s[k] += p[k]; s.ex.push(...p.ex); } s.ex = s.ex.slice(0, 8); out[tag].scan = s; }
  await ctx.close();
}
await browser.close(); console.log(JSON.stringify(out, null, 1));
