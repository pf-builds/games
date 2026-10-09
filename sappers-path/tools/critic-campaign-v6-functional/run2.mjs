import { readFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(here, "../.."), URL_ = "http://127.0.0.1:8471/";
const LV = JSON.parse(readFileSync(ROOT + "/tools/build-data/levels/levels.json", "utf8")).levels, CFG = JSON.parse(readFileSync(ROOT + "/config.json", "utf8"));
const GAL = JSON.parse(readFileSync(ROOT + "/tools/build-data/levels/gallery.json", "utf8")).levels, QJ = JSON.parse(readFileSync(ROOT + "/tools/campaign-quests/quests.json", "utf8"));
const ids = LV.filter((l) => l.n <= 200).sort((a, b) => a.n - b.n).map((l) => l.id), byN = (n) => LV.find((l) => l.n === n);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], rows = []; const check = (c, m) => rows.push((c ? "ok   " : "FAIL ") + m);
for (const [w, h, dpr, touch] of [[1280, 720, 1, false], [375, 812, 3, true]]) {
  const tag = w + "x" + h, ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(([key, all]) => { const n = +new URLSearchParams(location.search).get("n"); if (n > 0) { const d = {}; for (const id of all.slice(0, n - 1)) d[id] = 1; localStorage.setItem(key, JSON.stringify({ v: 2, done: d, coins: 400 })); } }, [CFG.save.key, ids]);
  const p = await ctx.newPage(); p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.text()); }); p.on("pageerror", (e) => log.push(tag + " pageerror " + e.message));
  const tapEl = async (sel) => { const L = p.locator(sel).first(); await L.scrollIntoViewIfNeeded({ timeout: 5000 }); const box = await L.boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(40); };
  const go = async (q) => { await p.goto(URL_ + "?debug=1" + q); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 }); };
  const playO = async (o) => { for (const ch of o) { await tapEl('button.card[data-col="' + ch + '"]'); await p.evaluate(() => { for (let i = 0; i < 400 && SP.state().busy; i++) SP.tick(100); }); if ((await p.evaluate(() => SP.state().status)) !== "playing") break; } return p.evaluate(() => { for (let i = 0; i < 2500 && !SP.state().panel; i++) SP.tick(40); return SP.state(); }); };
  try {
  // (a) short sheet -> Retry, with real waits
  await go("&n=66"); await p.evaluate(() => SP.load(66)); const s1 = await playO("224411304240"); await p.waitForTimeout(1500);
  const btn = await p.evaluate(() => { const a = document.getElementById("p-primary"), r = a.getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { txt: a.textContent.trim(), r: [r.x, r.y, r.width, r.height].map(Math.round), top: el ? (el.id || el.className || el.tagName) : null, sec: document.getElementById("p-secondary").textContent.trim() }; });
  await tapEl("#p-primary"); await p.waitForTimeout(800); const s2 = await p.evaluate(() => SP.state());
  check(s1.reason === "short" && s2.status === "playing" && s2.plays === 0, tag + " 66 short sheet primary '" + btn.txt + "' (top element at its centre: " + btn.top + ", secondary '" + btn.sec + "'): after tap status " + s2.status + " plays " + s2.plays + " panel " + s2.panel + " screen " + s2.screen);
  if (s2.status !== "playing") { await p.evaluate(() => SP.retry()); }
  const w = await playO(byN(66).win.extreme); check(w.status === "won" && w.hits === 0, tag + " 66 stored order after retry: " + w.status + " hits " + w.hits);
  // (b) 160: lock 1 opens first
  await go("&n=160"); await p.evaluate(() => SP.load(160)); const pats = [];
  for (const ch of byN(160).win.extreme) { await tapEl('button.card[data-col="' + ch + '"]'); const r = await p.evaluate(() => { for (let i = 0; i < 400 && SP.state().busy; i++) SP.tick(100); return Array.from(document.querySelectorAll("#line .slot")).map((x) => /\blocked\b/.test(x.className) ? "L" : "o").join("") + "/" + SP.state().open; }); if (pats[pats.length - 1] !== r) pats.push(r); }
  const w160 = await p.evaluate(() => { for (let i = 0; i < 2500 && !SP.state().panel; i++) SP.tick(40); return SP.state().status; });
  check(w160 === "won" && pats.length >= 3 && /^oooLo/.test(pats[1]), tag + " 160 (lock 1, the right socket, opens first at tap 13): sockets " + pats.join(" -> ") + "; " + w160);
  if (tag === "1280x720") {
    // (c) v5.4 save, written back
    const kept = GAL.slice(0, 50).map((g) => g.id), dropped = (QJ.v5Places || []).filter((id) => !GAL.some((g) => g.id === id));
    const raw = { v: 2, done: Object.fromEntries(ids.slice(0, 180).map((id) => [id, 1])), gal: { "g-ours-g01": 1, "g-ours-g12": 1, "g-noto-1f432": 1, [dropped[0]]: 1, [dropped[1]]: 1 }, coins: 1234, inv: { ladder: 2 }, got: { ladder: 1, quartermaster: 1, recall: 1, scout: 1, volley: 1 }, last: ids[170], tail: { [dropped[2]]: 1 }, settings: { music: false, sfx: true, speed: 2 } };
    await go(""); await p.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [CFG.save.key, raw]); await go("");
    const sv = await p.evaluate(([k]) => { SP.clearPictures(0); const s = JSON.parse(localStorage.getItem(k)); return { done: Object.keys(s.done).length, gal: Object.keys(s.gal || {}), coins: s.coins, inv: s.inv, tail: s.tail, last: s.last, code: SP.code() }; }, [CFG.save.key]);
    check(sv.done === 180 && sv.gal.length === 3 && sv.coins === 1234, "v5.4 save (dropped ids " + dropped.slice(0, 3).join(",") + "): done " + sv.done + ", gal " + JSON.stringify(sv.gal) + ", coins " + sv.coins + ", inv " + JSON.stringify(sv.inv) + ", tail " + JSON.stringify(sv.tail) + ", last " + sv.last + ", code " + String(sv.code).length + " chars");
    // map/quest nodes for kept vs new
    await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(400);
    const qn = await p.evaluate(() => Array.from(document.querySelectorAll(".qn")).slice(0, 4).map((x) => x.dataset.id + ":" + x.className));
    check(qn.length > 0, "map after the v5.4 save: first quest nodes " + JSON.stringify(qn));
    // reset: find the visible settings button
    await go(""); const setBtns = await p.evaluate(() => Array.from(document.querySelectorAll("button")).filter((x) => x.getBoundingClientRect().width > 0 && /set/i.test(x.id)).map((x) => x.id));
    rows.push("info visible settings buttons at load: " + JSON.stringify(setBtns) + " screen " + (await p.evaluate(() => SP.state().screen)));
    // (e) quests
    await go("&n=201"); await p.evaluate(() => { SP.unlockTo(200); SP.screen("map"); }); await p.waitForTimeout(300);
    for (const id of ["g-ours-cq34", "g-ours-cq13", "g-ours-cq03", "g-ours-g07"]) {
      const q = await p.evaluate((i) => SP.quest(i), id), aria = await p.evaluate((i) => { const n = document.querySelector('.qn[data-id="' + i + '"]'); return n ? n.getAttribute("aria-label") : null; }, id);
      await tapEl('.qn[data-id="' + id + '"]'); await p.waitForTimeout(300); const inv0 = await p.evaluate((k) => SP.meta().inv[k] | 0, q.prize), s0 = await p.evaluate(() => ({ id: SP.state().id, order: SP.winOrder(), tag: SP.state().tag }));
      const G = GAL.find((g) => g.id === id), stored = G.win[G.tag];
      const ws = await playO(s0.order); await p.waitForTimeout(300); const title = await p.evaluate(() => document.getElementById("p-title").textContent), inv1 = await p.evaluate((k) => SP.meta().inv[k] | 0, q.prize);
      await p.evaluate(() => SP.load(SP.state().id)); const ws2 = await playO(s0.order); const inv2 = await p.evaluate((k) => SP.meta().inv[k] | 0, q.prize);
      check(s0.id === id && s0.order === stored && ws.status === "won" && inv1 === inv0 + 1 && inv2 === inv1 && /prize/i.test(aria || ""), tag + " quest " + id + " (after " + q.after + ", " + s0.tag + ", prize " + q.prize + "; node aria '" + aria + "'): stored order " + (s0.order === stored) + ", " + ws.status + " '" + title + "', prize " + inv0 + "->" + inv1 + ", replay " + ws2.status + " -> " + inv2);
      await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(200);
    }
  }
  } catch (e) { rows.push("FAIL " + tag + " error " + e.message.split("\n")[0]); }
  await ctx.close();
}
await b.close(); for (const r of rows) console.log(r); console.log("console: " + log.length); for (const l of log.slice(0, 10)) console.log(" " + l);
