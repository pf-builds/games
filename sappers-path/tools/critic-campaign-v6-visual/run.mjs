// Visual critic run (campaign v6 lane A). Read-only on the game; writes screens here.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), OUT = here, URL_ = "http://127.0.0.1:8472/sappers-path/";
const LV = JSON.parse(readFileSync(resolve(here, "../../tools/build-data/levels/levels.json"), "utf8")).levels, CFG = JSON.parse(readFileSync(resolve(here, "../../config.json"), "utf8"));
const GAL = JSON.parse(readFileSync(resolve(here, "../../tools/build-data/levels/gallery.json"), "utf8")).levels;
const byN = (n) => LV.find((l) => l.n === n), ids = LV.filter((l) => l.n <= 200).map((l) => l.id);
const require = (await import("node:module")).createRequire(import.meta.url), E = require("../../src/engine.js"), R = require("../grade.js");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const ONLY = process.argv[2] || "all";
// Node-side: on 64, a pin jam order and a continuation after the hit plan.
const L64 = byN(64), P64 = E.compile(L64), N64 = E.rulesOf(CFG.v3, L64.tag);
const pinJam = (() => { for (let k = 0; k < 3000; k++) { const S = E.sim(P64, N64), r = R.rng(k * 13 + 5); let o = ""; for (let g = 0; g <= P64.ncards && S.status === E.PLAYING; g++) { const op = []; for (let j = 0; j < 5; j++) if (R.legal(S, j)) op.push(j); if (!op.length) break; const j = op[Math.floor(r() * op.length)]; o += j; S.play(j); S.quiet(); } if (S.status === E.FAILED && S.reason === "jam" && S.jamWhy & 8) return o; } return null; })();
const res = { pinJam };
const b = await chromium.launch(), log = [];
for (const [w, h, dpr, touch, nm] of [[1280, 720, 1, false, "desk"], [375, 812, 3, true, "phone"], [400, 600, 1, false, "frame"]]) {
  if (ONLY !== "all" && ONLY !== nm) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(([key, all]) => { const n = +new URLSearchParams(location.search).get("n"); if (n > 0) { const d = {}; for (const id of all.slice(0, n - 1)) d[id] = 1; localStorage.setItem(key, JSON.stringify({ v: 2, done: d })); } }, [CFG.save.key, ids]);
  const p = await ctx.newPage(); p.on("console", (m) => log.push(nm + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(nm + " pageerror " + e.message));
  const tapEl = async (sel) => { const L = p.locator(sel).first(); await L.scrollIntoViewIfNeeded(); const box = await L.boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(60); };
  const card = (j) => tapEl('button.card[data-col="' + j + '"]');
  const rest = () => p.evaluate(() => { for (let i = 0; i < 3000 && SP.state().busy; i++) SP.tick(100); return SP.state(); });
  const toPanel = () => p.evaluate(() => { for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(40); return SP.state(); });
  const shot = (k, clip) => p.screenshot({ path: OUT + "/" + nm + "-" + k + ".png", clip });
  const rect = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return r.width ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: e.textContent.trim().slice(0, 160) } : null; }, s);
  const info = async () => ({ coach: await rect("#coach"), dock: await rect("#coach-dock"), toast: await rect("#toast"), board: await rect("#board"), stage: await rect("#stage"), chip: await rect("#tag-chip"), name: await rect("#lvl-name"), hand: await rect("#hand") });
  const open = async (n) => { const L = byN(n); await p.goto(URL_ + "?debug=1&n=" + n); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
    await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(400); const sel = 'button.mn[data-n="' + n + '"]';
    if (await p.locator(sel).count()) await tapEl(sel); await p.waitForTimeout(500); let s = await p.evaluate(() => SP.state()); if (s.id !== L.id) await p.evaluate((id) => SP.load(id), L.id); await p.waitForTimeout(300); return L; };
  const hitGame = async (id, kind, label) => { const o = await p.evaluate((x) => SP.hitPlan(x), id); if (!o) return null; for (const ch of o.slice(0, -1)) { await card(+ch); await rest(); } await card(+o[o.length - 1]);
    let seen = null; for (let i = 0; i < 600 && !seen; i++) seen = await p.evaluate((k) => { SP.tick(40); const h = SP.hits(); return h.struck && h.label && h.kind === k ? h : null; }, kind); if (seen) await shot(label + "-struck"); return { o, seen }; };
  if (nm !== "frame" || true) {
    for (const n of [64, 66, 74, 80, 82, 91, 104, 115, 117, 191, 195, 196, 198]) { const L = await open(n); await shot("L" + n + "-start"); res[nm + n] = { tag: L.tag, archers: L.archers, towers: (L.towers || []).length, ...(await info()) }; }
    // 64: pin, lying, released, jam with pin.
    { const L = await open(64); const g = await hitGame(L.id, 3, "L64-pin"); const s1 = await rest(); await shot("L64-pin-lying"); res[nm + "pin"] = { o: g && g.o, seen: g && g.seen, hits: await p.evaluate(() => SP.hits()), st: s1.status };
      // continuation: solve in node from the same position
      const S = E.sim(P64, N64); for (const c of g.o) { S.play(+c); S.quiet(); } const cont = R.solve(P64, N64, 400000, null, S.save()); res[nm + "cont"] = cont;
      let up = null; for (const ch of cont || "") { await card(+ch); for (let i = 0; i < 400; i++) { const r = await p.evaluate(() => { SP.tick(100); return { busy: SP.state().busy, h: SP.hits() }; }); if (!up && r.h.kind === 4) { up = r.h; await shot("L64-pin-released"); } if (!r.busy) break; } }
      res[nm + "up"] = up;
      if (pinJam) { await p.evaluate(() => SP.retry()); for (const ch of pinJam) { await card(+ch); await rest(); } const s = await toPanel(); await p.waitForTimeout(500); await shot("L64-pin-jam"); res[nm + "pinjam"] = { s: s.status, reason: s.reason, panel: await rect("#panel"), title: await rect("#p-title"), line: await rect("#p-line"), aria: await p.evaluate(() => document.getElementById("panel").getAttribute("aria-label")) }; } }
    // 66: kill.
    { const L = await open(66); const g = await hitGame(L.id, 2, "L66-kill"); const s1 = await toPanel(); await p.waitForTimeout(500); await shot("L66-kill-after"); res[nm + "kill"] = { seen: g && g.seen, st: s1.status, reason: s1.reason, title: await rect("#p-title"), line: await rect("#p-line"), panel: await rect("#panel") }; }
    // 157: key + colour lock.
    { const L = await open(157); await shot("L157-start"); const o = L.win[L.tag]; let was = (await p.evaluate(() => SP.state())).locked, k = 0; res[nm + "157"] = { locks: L.locks, locked0: was, fx: await p.evaluate(() => SP.fx()) };
      for (const ch of o) { await card(+ch); for (let i = 0; i < 400; i++) { const r = await p.evaluate(() => { SP.tick(100); return { busy: SP.state().busy, locked: SP.state().locked }; }); if (r.locked < was) { k++; await p.waitForTimeout(50); await shot("L157-unlock-" + k); was = r.locked; } if (!r.busy) break; } } }
  }
  // Map: tag badges, quest nodes in realms 1, 4, 8.
  { await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
    for (const [to, n0, k] of [[30, 20, "map-r1"], [96, 85, "map-r4"], [200, 160, "map-r7"], [200, 186, "map-r8"]]) { await p.evaluate((n) => { localStorage.clear(); SP.unlockTo(n); SP.screen("map"); }, to); await p.waitForTimeout(300);
      await p.locator('button.mn[data-n="' + n0 + '"]').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await shot(k); } }
  // Quest pictures at play size (phone only).
  if (nm === "phone") { await p.evaluate(() => SP.unlockTo(200)); for (const g of GAL.filter((x) => /cq\d/.test(x.id))) { await p.evaluate((id) => SP.load(id), g.id); await p.waitForTimeout(250); const r = await rect("#stage"); await shot("q-" + g.id.replace("g-ours-", ""), r ? { x: r.x, y: r.y, width: r.w, height: r.h } : undefined); } }
  await ctx.close();
}
await b.close();
writeFileSync(OUT + "/run.json", JSON.stringify({ res, log }, null, 1));
console.log("console:", log.length, log.slice(0, 10)); console.log("pinJam", pinJam);
