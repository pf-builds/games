import { readFileSync } from "node:fs";
const CFG = JSON.parse(readFileSync("../../config.json", "utf8")), URL_ = "http://127.0.0.1:8471/";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE); const b = await chromium.launch(), log = [];
for (const [w, h, touch] of [[1280, 720, false], [375, 812, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 3 : 1, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(); let bytes = 0, reqs = 0;
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(m.text()); }); p.on("pageerror", (e) => log.push("pageerror " + e.message));
  p.on("response", async (r) => { reqs++; try { const bb = await r.body(); bytes += bb.length; } catch (e) {} });
  const t0 = Date.now(); await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded" && SP.state().screen, null, { timeout: 20000 }); const tl = Date.now() - t0; await p.waitForTimeout(1500);
  console.log(w + "x" + h, "load to ready ms", tl, "requests", reqs, "bytes", bytes);
  const tap = async (sel) => { const L = p.locator(sel).first(); const box = await L.boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(400); };
  // give some progress then reset
  await p.evaluate(() => { SP.unlockTo(120); }); await p.reload(); await p.waitForFunction(() => window.SP && SP.state().screen, null, { timeout: 20000 }); const before = await p.evaluate(() => SP.state().done);
  await tap("#btn-settings"); await tap("#set-reset");
  const btns = await p.evaluate(() => Array.from(document.querySelectorAll("#resetsheet button")).filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.id + "|" + x.textContent.trim().slice(0, 30)));
  const holdSel = await p.evaluate(() => { const bs = Array.from(document.querySelectorAll("#resetsheet button")).filter((x) => x.getBoundingClientRect().width > 0); const h = bs.find((x) => /hold|reset|erase/i.test(x.textContent + x.id) && !/keep|cancel/i.test(x.textContent)); return h ? "#" + h.id : null; });
  const box = await p.locator(holdSel).boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  if (touch) { await p.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const mk = (t) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerType: "touch", isPrimary: true, pointerId: 7 })); mk("pointerdown"); window.__up = () => mk("pointerup"); }, [cx, cy]); await p.waitForTimeout(4000); await p.evaluate(() => window.__up()); }
  else { await p.mouse.move(cx, cy); await p.mouse.down(); await p.waitForTimeout(4000); await p.mouse.up(); }
  await p.waitForTimeout(800); const after = await p.evaluate(() => ({ done: SP.state().done, coins: SP.meta().coins, screen: SP.state().screen }));
  console.log(w + "x" + h, "reset: buttons", JSON.stringify(btns), "hold", holdSel, "done before", before, "after", JSON.stringify(after));
  // quest nodes per realm on the map
  await p.evaluate(() => { SP.unlockTo(200); SP.screen("map"); }); await p.waitForTimeout(400);
  const q = await p.evaluate(() => Array.from(document.querySelectorAll(".qn")).map((x) => x.dataset.id)); console.log(w + "x" + h, "quest nodes on map", q.length);
  await ctx.close();
}
await b.close(); console.log("console", log.length, JSON.stringify(log.slice(0, 5)));
