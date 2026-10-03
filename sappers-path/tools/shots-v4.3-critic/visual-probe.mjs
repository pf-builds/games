// Visual critic 2 re-check probe (read-only): coach fit on teaching levels at 8 viewports (+ screenshots of 62/76/77),
// buy states when broke, badge sizes, the Gallery's next tile and the Gallery win report's picture.
import { mkdirSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const OUT = new URL("./visual/probe/", import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const B = "http://127.0.0.1:8493/sappers-path/", browser = await chromium.launch(), out = { coach: {}, errors: [] };
async function open(w, h, dpr, touch, iframe) {
  const ctx = await browser.newContext({ viewport: { width: iframe ? 460 : w, height: iframe ? 700 : h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); let T = page, clip; page.on("pageerror", (e) => out.errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") out.errors.push(m.text()); });
  if (iframe) { await page.goto(B + "tools/iframe-host.html"); for (let i = 0; i < 100; i++) { T = page.frames().find((f) => f.url().includes("?debug=1")); if (T) break; await page.waitForTimeout(100); } clip = await page.locator("#game").boundingBox(); }
  else await page.goto(B + "?debug=1");
  await T.waitForFunction(() => window.SP && document.fonts.status === "loaded"); return { ctx, page, T, clip };
}
const coach = async (n) => { SP.load(n, "normal"); SP.tick(40); await new Promise((z) => setTimeout(z, 140)); const c = document.getElementById("coach"), cs = SP.coach(), b = c.getBoundingClientRect(), bd = document.getElementById("board").getBoundingClientRect();
  const ov = (q) => { const x = Math.min(b.right, q.right) - Math.max(b.left, q.left), y = Math.min(b.bottom, q.bottom) - Math.max(b.top, q.top); return x > 0.5 && y > 0.5 ? [Math.round(x), Math.round(y)] : 0; };
  let rows = 0; document.querySelectorAll("#tray .tile.next").forEach((t) => { if (t.getBoundingClientRect().height && !t.classList.contains("none")) rows = Math.max(rows, t.classList.contains("d1") ? 2 : 3); });
  return { n, mode: cs.mode, text: c.textContent, box: [b.left, b.top, b.width, b.height].map(Math.round), font: getComputedStyle(c).fontSize, clipped: c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1, overBoard: ov(bd), overNum: ov(document.getElementById("lvl-num").getBoundingClientRect()), cell: +(SP.state().cs / devicePixelRatio).toFixed(2), rows: rows || 1 }; };
const VPS = [["375x667", 375, 667, 2, true], ["414x736", 414, 736, 2, true], ["375x812", 375, 812, 3, true], ["390x844", 390, 844, 3, true], ["1280x720", 1280, 720, 1, false], ["812x375", 812, 375, 3, true], ["400x600if", 400, 600, 2, false, true], ["360x640", 360, 640, 2, true]];
for (const [tag, w, h, dpr, touch, ifr] of VPS) {
  const V = await open(w, h, dpr, touch, ifr); out.coach[tag] = [];
  for (const n of [1, 2, 3, 35, 51, 62, 76, 77]) { out.coach[tag].push(await V.T.evaluate(coach, n)); if ([62, 76, 77].includes(n)) await V.page.screenshot({ path: OUT + "coach-" + tag + "-l" + n + ".png", clip: V.clip }); }
  if (tag === "400x600if" || tag === "812x375" || tag === "375x812" || tag === "375x667") out["bar-" + tag] = await V.T.evaluate(() => { SP.setMeta({ coins: 70, inv: { ladder: 0, quartermaster: 1, scout: 0, recall: 0 } }); SP.load(40, "normal"); SP.tick(40);
    const pb = document.getElementById("powers").getBoundingClientRect(); return { powers: [pb.left, pb.top, pb.width, pb.height].map(Math.round), pw: Array.from(document.querySelectorAll(".pw")).map((p) => { const b = p.getBoundingClientRect(); const plus = p.querySelector("[class*=plus], .pl, b, em"); return { k: p.dataset.k, cls: p.className, wh: [Math.round(b.width), Math.round(b.height)], top: Math.round(b.top), plusBg: plus ? getComputedStyle(plus).backgroundColor + "/" + getComputedStyle(plus).color : null }; }) }; });
  if (tag === "375x812") {
    out.galNext = await V.T.evaluate(() => { SP.unlockGallery(); SP.screen("gallery"); const ts = Array.from(document.querySelectorAll("#gallery .gal-tile")); return ts.slice(0, 3).map((t) => ({ cls: t.className, text: t.textContent.trim().slice(0, 30), border: getComputedStyle(t).borderColor, shadow: getComputedStyle(t).boxShadow.slice(0, 60) })); });
    await V.page.screenshot({ path: OUT + "gallery-375-fresh.png" });
    out.galWin = await V.T.evaluate(() => { SP.speed(1); SP.load("g-noto-1f3c6", "normal"); const o = SP.winOrder(); for (let i = 0; i < o.length; i++) { SP.play(+o[i]); if (i < o.length - 1) SP.settle(); else SP.tick(400); } for (let i = 0; i < 3000 && !SP.state().panel; i++) SP.tick(16); SP.tick(1800);
      const p = document.getElementById("panel"); const pic = p.querySelector("canvas, img, .pic, [class*=pic]"); const r = pic ? pic.getBoundingClientRect() : null; return { title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent, pic: pic ? (pic.tagName + "." + pic.className + " " + [r.left, r.top, r.width, r.height].map(Math.round).join(",")) : null, panel: [p.getBoundingClientRect().top, p.getBoundingClientRect().height].map(Math.round) }; });
    await V.page.waitForTimeout(300); await V.page.screenshot({ path: OUT + "galwin-375-trophy.png" });
    out.galAfter = await V.T.evaluate(() => { SP.screen("gallery"); const ts = Array.from(document.querySelectorAll("#gallery .gal-tile")); return ts.slice(0, 3).concat(ts.filter((t) => t.textContent.includes("Trophy"))).map((t) => ({ cls: t.className, text: t.textContent.trim().slice(0, 30) })); });
    await V.page.screenshot({ path: OUT + "gallery-375-after.png" });
    out.sieWin = await V.T.evaluate(() => { SP.load(8, "normal"); const o = SP.winOrder(); for (let i = 0; i < o.length; i++) { SP.play(+o[i]); if (i < o.length - 1) SP.settle(); else SP.tick(400); } for (let i = 0; i < 3000 && !SP.state().panel; i++) SP.tick(16); SP.tick(600); const p = document.getElementById("panel"); return { title: document.getElementById("p-title").textContent, pic: !!p.querySelector("canvas, img, .pic, [class*=pic]") }; });
    await V.page.waitForTimeout(300); await V.page.screenshot({ path: OUT + "siegewin-375-l8.png" });
  }
  await V.ctx.close();
}
await browser.close(); console.log(JSON.stringify(out, null, 1));
