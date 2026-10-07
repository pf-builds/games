// Functional critic run, campaign v6 lane A. Real taps at 1280x720 (mouse) and 375x812 (touch, 3x).
import { readFileSync, mkdirSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(here, "../.."), OUT = resolve(here, "shots"); mkdirSync(OUT, { recursive: true });
const URL_ = "http://127.0.0.1:8471/";
const LV = JSON.parse(readFileSync(ROOT + "/levels/levels.json", "utf8")).levels, CFG = JSON.parse(readFileSync(ROOT + "/config.json", "utf8")), LY = CFG.layout;
const QJ = JSON.parse(readFileSync(ROOT + "/tools/campaign-quests/quests.json", "utf8")), GAL = JSON.parse(readFileSync(ROOT + "/levels/gallery.json", "utf8")).levels;
const byN = (n) => LV.find((l) => l.n === n), ids = LV.filter((l) => l.n <= 200).sort((a, b) => a.n - b.n).map((l) => l.id);
const ORD = { pinWin: "00034401114320234340040334444133303444002222222111", pinJam: "2030113132444400340", killShort: "224411304240" };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], rows = [], data = {}; let bad = 0;
const check = (c, m) => { if (!c) bad++; rows.push((c ? "ok   " : "FAIL ") + m); };
const only = process.argv[2] || "all";
for (const [w, h, dpr, touch, nm] of [[1280, 720, 1, false, "desktop"], [375, 812, 3, true, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), tag = w + "x" + h;
  await ctx.addInitScript(([key, all]) => { const q = new URLSearchParams(location.search), n = +q.get("n"); if (n > 0) { const d = {}; for (const id of all.slice(0, n - 1)) d[id] = 1; localStorage.setItem(key, JSON.stringify({ v: 2, done: d, coins: 400 })); } }, [CFG.save.key, ids]);
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.type() + ": " + m.text()); }); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  const tapEl = async (sel) => { const L = p.locator(sel).first(); await L.scrollIntoViewIfNeeded(); const box = await L.boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(40); };
  const card = (j) => tapEl('button.card[data-col="' + j + '"]');
  const st = () => p.evaluate(() => SP.state());
  const toPanel = () => p.evaluate(() => { for (let i = 0; i < 2500 && !SP.state().panel; i++) SP.tick(40); return SP.state(); });
  const shot = (k) => p.screenshot({ path: OUT + "/" + nm + "-" + k + ".png" });
  const panel = () => p.evaluate(() => { const P = document.getElementById("panel"), vis = (e) => e && !e.hidden && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
    return { shown: vis(P), title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent, lineAria: document.getElementById("p-line").getAttribute("aria-label"), chips: document.querySelectorAll("#p-line .chip, #p-line i, #p-line span").length,
      cont: vis(document.getElementById("p-cont")), primary: vis(document.getElementById("p-primary")) ? document.getElementById("p-primary").textContent.trim() : null, secondary: vis(document.getElementById("p-secondary")) ? document.getElementById("p-secondary").textContent.trim() : null,
      allButtons: Array.from(P.querySelectorAll("button")).filter(vis).map((x) => (x.textContent.trim() || x.getAttribute("aria-label") || x.id)) }; });
  const open = async (n) => {
    const L = byN(n);
    await p.goto(URL_ + "?debug=1&n=" + n); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
    await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(400);
    const sel = 'button.mn[data-n="' + n + '"]'; if (await p.locator(sel).count()) await tapEl(sel); await p.waitForTimeout(300);
    let s = await st(); const fromMap = s.id === L.id && s.screen === "play"; if (!fromMap) s = await p.evaluate((id) => SP.load(id), L.id);
    return { L, s, fromMap, toast: await p.evaluate(() => { const t = document.getElementById("toast"); return t.hidden ? null : { t: t.textContent, bad: t.classList.contains("bad") }; }), coach: await p.evaluate(() => { const c = document.getElementById("coach"); return c.hidden ? null : c.textContent; }) };
  };
  const play = async (o, watch) => { const seen = { pinned: 0, kinds: {}, opens: [], shut: [] };
    for (const ch of o) { await card(+ch);
      for (let i = 0; i < 400; i++) { const r = await p.evaluate(() => { SP.tick(100); const s = SP.state(), h = SP.hits(), sl = Array.from(document.querySelectorAll("#line .slot")).map((x) => /\blocked\b/.test(x.className) ? "L" : "o").join(""); return { busy: s.busy, status: s.status, open: s.open, locked: s.locked, h: h && h.kind, pin: (document.querySelectorAll('#line [aria-label*="pinned"]').length), sl }; });
        if (r.h != null) seen.kinds[r.h] = 1; if (r.pin > seen.pinned) seen.pinned = r.pin; if (!seen.opens.length || seen.opens[seen.opens.length - 1].open !== r.open) { seen.opens.push({ tap: seen.opens.length, open: r.open, locked: r.locked, sl: r.sl }); }
        if (!r.busy || r.status !== "playing") break; }
      const s = await st(); if (s.status !== "playing") break; }
    return { seen, s: await toPanel() }; };
  try {
  // 0. selfTest
  if (only === "all" || only === "self") { await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
    const t = await p.evaluate(() => { const r = SP.selfTest(); return { pass: r.pass, fail: r.fail, ms: Math.round(r.ms) }; }); data["self-" + tag] = t; check(!t.fail.length, tag + " selfTest " + t.pass + "/" + t.fail.length + " (" + t.ms + " ms) " + JSON.stringify(t.fail).slice(0, 300)); }
  if (only === "all" || only === "rules") {
  // 1a. 64: pin, then a win with the pin released
  { const r = await open(64); data["64open-" + tag] = { fromMap: r.fromMap, toast: r.toast, coach: r.coach };
    check(r.fromMap && r.toast && r.toast.t === LY.pinToast && !r.toast.bad && /towers are back/i.test(r.coach || ""), tag + " 64 opened from map; calm toast '" + (r.toast && r.toast.t) + "'; coach '" + r.coach + "'");
    const g = await play(ORD.pinWin); data["64pinwin-" + tag] = g.seen;
    check(g.s.status === "won" && g.s.hits > 0 && g.seen.pinned > 0, tag + " 64: a game with " + g.s.hits + " hits, max " + g.seen.pinned + " sapper(s) shown pinned, ends " + g.s.status + " (pins released, level won)");
    if (nm === "desktop") await shot("64-pinwin");
    await p.evaluate(() => SP.retry()); const j = await play(ORD.pinJam); const pn = await panel(); data["64jam-" + tag] = { s: j.s.status, reason: j.s.reason, pn };
    check(j.s.status === "failed" && j.s.reason === "jam" && pn.line.includes(LY.jamPinText) && pn.chips > 0, tag + " 64 jam with pins: sheet '" + pn.title + "' / '" + pn.line + "' chips " + pn.chips + " buttons " + JSON.stringify(pn.allButtons));
    if (nm === "desktop") await shot("64-jam"); }
  // 1b. 66: kill -> short
  { const r = await open(66); data["66open-" + tag] = { toast: r.toast, coach: r.coach };
    check(r.toast && r.toast.t === LY.killToast && r.toast.bad && /deadly/i.test(r.coach || ""), tag + " 66: red toast '" + (r.toast && r.toast.t) + "'; coach '" + r.coach + "'");
    const k = await play(ORD.killShort); const pn = await panel(); data["66short-" + tag] = { s: k.s.status, reason: k.s.reason, kills: k.s.kills, pn };
    check(k.s.status === "failed" && k.s.reason === "short" && /Not enough/.test(pn.line) && /archers shot one down/.test(pn.line) && !pn.cont && pn.allButtons.length === 2, tag + " 66 short: '" + pn.title + "' / '" + pn.line + "' aria '" + pn.lineAria + "' cont " + pn.cont + " buttons " + JSON.stringify(pn.allButtons));
    await shot("66-short");
    // Retry from the sheet
    await tapEl("#p-primary"); await p.waitForTimeout(300); const s2 = await st(); check(s2.status === "playing" && s2.plays === 0 && s2.kills === 0, tag + " 66: the sheet's primary button restarts the level (" + s2.status + ", plays " + s2.plays + ")");
    const o = r.L.win[r.L.tag], w1 = await play(o); check(w1.s.status === "won" && w1.s.hits === 0, tag + " 66 stored order by real taps: " + w1.s.status + " hits " + w1.s.hits); }
  // 1c. two locks: 157 (key + colour) and 159 (two colours), 200 boss
  for (const n of [157, 159, 200]) { const r = await open(n); const o = r.L.win[r.L.tag], g = await play(o); data["locks" + n + "-" + tag] = { locks: r.L.locks, toast: r.toast, coach: r.coach, opens: g.seen.opens.map((x) => x.open + ":" + x.sl).join(" ") };
    check(r.fromMap && g.s.status === "won" && g.s.hits === 0, tag + " " + n + " from map, stored order (" + o.length + " real taps): " + g.s.status + "; sockets over time " + data["locks" + n + "-" + tag].opens + "; coach '" + r.coach + "'");
    if (n === 157 && nm === "phone") await shot("157-won"); }
  }
  // 7. a v5.4-shaped save
  if ((only === "all" || only === "save") && nm === "desktop") {
    const kept = GAL.slice(0, 50).map((g) => g.id), v5 = QJ.v5Places || [], dropped = v5.filter((id) => !kept.includes(id) && !GAL.some((g) => g.id === id));
    const raw = { v: 2, done: Object.fromEntries(ids.slice(0, 180).map((id) => [id, 1])), gal: { "g-ours-g01": 1, "g-ours-g12": 1, "g-noto-1f432": 1, [dropped[0]]: 1, [dropped[1]]: 1 }, best: { [ids[0]]: [31000, 12, 40], [dropped[0]]: [200000, 40, 30] }, coins: 1234, inv: { ladder: 2, recall: 1 }, got: { ladder: 1, quartermaster: 1, recall: 1, scout: 1, volley: 1 }, last: ids[170], tail: { [dropped[2]]: 1 }, lives: { n: 3, at: 0 }, settings: { music: false, sfx: true, speed: 2 } };
    await p.goto(URL_ + "?debug=1"); await p.evaluate(([k, v]) => { localStorage.setItem(k, JSON.stringify(v)); }, [CFG.save.key, raw]);
    await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
    const sv = await p.evaluate(([k]) => { const s = JSON.parse(localStorage.getItem(k) || "null"); return { done: Object.keys(SP.state().done ? {} : {}).length, st: SP.state().done, coins: SP.meta ? SP.meta().coins : null, store: s && { done: Object.keys(s.done || {}).length, gal: Object.keys(s.gal || {}), coins: s.coins, inv: s.inv } }; }, [CFG.save.key]);
    await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(500);
    const mapOk = await p.evaluate(() => ({ nodes: document.querySelectorAll("button.mn").length, won: document.querySelectorAll("button.mn.won, button.mn.done").length }));
    const code = await p.evaluate(() => SP.code()); let dec = null; try { dec = await p.evaluate((c) => (window.Save && Save.decode ? JSON.stringify(Save.decode(c)).slice(0, 300) : "no Save.decode"), code); } catch (e) { dec = "decode threw " + e.message; }
    data.save = { raw: { done: 180, gal: Object.keys(raw.gal), dropped: dropped.slice(0, 3) }, sv, mapOk, code: String(code).slice(0, 80), codeLen: String(code).length, dec };
    check(sv.st === 180 && sv.store && sv.store.gal.length === 3, "v5.4 save: done " + sv.st + "/180, kept picture clears " + JSON.stringify(sv.store && sv.store.gal) + ", coins " + (sv.store && sv.store.coins) + "; map nodes " + mapOk.nodes + "; code " + String(code).length + " chars; decode " + String(dec).slice(0, 120));
    // reset via the settings sheet (press and hold)
    await p.evaluate(() => SP.screen("home")); await p.waitForTimeout(300);
    try { await tapEl("#btn-settings"); await p.waitForTimeout(300); await tapEl("#set-reset"); await p.waitForTimeout(300);
      const hb = await p.locator("#resetsheet button:not([hidden])").evaluateAll((bs) => bs.map((x) => x.id + "|" + x.textContent.trim()));
      const hold = p.locator("#resetsheet button.danger, #resetsheet #rs-hold, #resetsheet button").first(); const box = await hold.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(3500); await p.mouse.up(); await p.waitForTimeout(500);
      const after = await p.evaluate(([k]) => { const s = JSON.parse(localStorage.getItem(k) || "null"); return { done: s ? Object.keys(s.done || {}).length : null, st: SP.state().done }; }, [CFG.save.key]);
      data.reset = { hb, after }; check(after.st === 0, "reset (press and hold " + JSON.stringify(hb) + "): done after " + after.st);
    } catch (e) { data.reset = "error " + e.message; check(false, "reset flow: " + e.message); }
  }
  } catch (e) { check(false, tag + " script error: " + e.message); }
  await ctx.close();
}
await b.close();
for (const r of rows) console.log(r);
console.log("DATA " + JSON.stringify(data));
console.log("console errors/warnings: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
