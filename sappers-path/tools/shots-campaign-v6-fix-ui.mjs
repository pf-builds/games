// Sapper's Path campaign v6 lane A, the fix pass (page and quests): before and after screens into tools/shots-campaign-v6-fix/
// <phase>/, by real taps at 1280x720 (mouse), 375x812 (3x touch) and 400x600 (the portal iframe's size as a viewport).
// Each level opens from its map node on a save with 1..n-1 cleared (the critics' method). Per size:
//   64  the start toast (its box against the line and the tray: 0 px overlap wanted), a pin by the hit plan (the pinned
//       space: its class, its badge's size, the head's words), then a continuation solved from that state: the tower falls,
//       the sapper gets up (the marker clears), the level wins;
//   157 the start toast against the line and tray, the two sockets (the key's own mark), the stored order by real taps: each
//       socket opens, the level wins;
//   74, 91 the quiet archer rings (board crops); the map at realms 7 and 8 (the tag pills); the play bar's chip on 157;
//   after only: the three swapped side quests (cq14, cq27, cq36) won from their map nodes by real taps (prize paid once);
//   before only: the three replaced pictures (cq13, cq30, cq42) at play size.
// Console messages are kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs ~/.local/opt/node/bin/node tools/shots-campaign-v6-fix.mjs after [--url http://127.0.0.1:8473/] [--only desk]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = dirname(fileURLToPath(import.meta.url)), arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const PHASE = process.argv[2] === "before" ? "before" : "after", URL_ = arg("url", "http://127.0.0.1:8473/"), ONLY = arg("only", "all"), OUT = resolve(here, "shots-campaign-v6-fix", PHASE); mkdirSync(OUT, { recursive: true });
const ROOT = resolve(here, ".."), LV = JSON.parse(readFileSync(resolve(ROOT, "tools/build-data/levels/levels.json"), "utf8")).levels, CFG = JSON.parse(readFileSync(resolve(ROOT, "config.json"), "utf8"));
const byN = (n) => LV.find((l) => l.n === n), ids = LV.filter((l) => l.n <= 200).map((l) => l.id);
const require = createRequire(import.meta.url), E = require("../src/engine.js"), R = require("./grade.js");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const QUESTS = arg("quests", "") ? arg("quests").split(",") : PHASE === "after" ? ["cq14", "cq27", "cq44"] : ["cq13", "cq30", "cq42"]; // roast redo: cq44 for cq36
const b = await chromium.launch(), log = [], rows = [], meas = {}; let bad = 0;
const check = (c, m) => { if (!c) bad++; rows.push((c ? "ok   " : "FAIL ") + m); };
const overlap = (a, z) => (a && z ? Math.max(0, Math.min(a.x + a.w, z.x + z.w) - Math.max(a.x, z.x)) * Math.max(0, Math.min(a.y + a.h, z.y + z.h) - Math.max(a.y, z.y)) : 0);
for (const [w, h, dpr, touch, nm] of [[1280, 720, 1, false, "desk"], [375, 812, 3, true, "phone"], [400, 600, 1, false, "frame"]]) {
  if (ONLY !== "all" && ONLY !== nm) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), tag = w + "x" + h, M = (meas[nm] = {});
  await ctx.addInitScript(([key, all]) => { const n = +new URLSearchParams(location.search).get("n"); if (n > 0) { const d = {}; for (const id of all.slice(0, n - 1)) d[id] = 1; localStorage.setItem(key, JSON.stringify({ v: 2, done: d })); } }, [CFG.save.key, ids]);
  const p = await ctx.newPage(); p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  const tapEl = async (sel) => { const L = p.locator(sel).first(); await L.scrollIntoViewIfNeeded(); const box = await L.boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(60); };
  const card = (j) => tapEl('button.card[data-col="' + j + '"]');
  const rest = () => p.evaluate(() => { for (let i = 0; i < 3000 && SP.state().busy; i++) SP.tick(100); return SP.state(); });
  const shot = (k, clip) => p.screenshot({ path: OUT + "/" + nm + "-" + k + ".png", clip });
  const rect = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return r.width ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: e.textContent.trim().slice(0, 120) } : null; }, s);
  const boot = async (q) => { await p.goto(URL_ + "?debug=1" + q); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 }); };
  const open = async (n) => { const L = byN(n); await boot("&n=" + n); await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(400); await tapEl('button.mn[data-n="' + n + '"]'); await p.waitForTimeout(400);
    const s = await p.evaluate(() => SP.state()); check(s.id === L.id && s.screen === "play", tag + " " + n + ": opened from its map node by a real tap (" + s.id + ")"); return L; };
  const toastClear = async (n) => { const t = await rect("#toast"), lw = await rect("#line-wrap"), tr = await rect("#tray"); const o = overlap(t, lw) + overlap(t, tr); M["toast" + n] = { toast: t, line: lw, tray: tr, overlap: o };
    check(!!t && o === 0, tag + " " + n + ": the start toast '" + (t ? t.t : "-") + "' covers 0 px of the line and the queue (" + o + " px²; toast " + (t ? t.x + "," + t.y + " " + t.w + "x" + t.h : "-") + ")"); };
  const lineState = () => p.evaluate(() => ({ head: document.getElementById("line-cnt").textContent.trim(), slots: [...document.querySelectorAll("#line .slot")].filter((s) => !s.hidden).map((s) => { const o = s.querySelector(".out"), r = o.getBoundingClientRect(); return { cls: s.className, aria: s.getAttribute("aria-label"), badge: o.textContent ? [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10] : null }; }) }));
  // 64: the start toast; a pin; the pinned space; the release; the win.
  { const L = await open(64); await shot("L64-start"); await toastClear(64);
    const o = await p.evaluate((id) => SP.hitPlan(id), L.id); for (const ch of o.slice(0, -1)) { await card(+ch); await rest(); } await card(+o[o.length - 1]);
    let seen = null; for (let i = 0; i < 600 && !seen; i++) seen = await p.evaluate(() => { SP.tick(40); const h = SP.hits(); return h.struck && h.kind === 3 ? h : null; });
    await rest(); for (let i = 0; i < 8; i++) await p.evaluate(() => SP.tick(400)); await p.waitForTimeout(80); await shot("L64-pinned"); const ls = await lineState(); M.pin = ls;
    const pinS = ls.slots.find((s) => / pinned$/.test(s.aria || "") || /pinned/.test(s.aria || ""));
    check(!!seen && !!pinS && (PHASE === "before" || (/\bpinned\b/.test(pinS.cls) && /\d+ pinned/.test(ls.head) && pinS.badge && pinS.badge[1] >= 10)), tag + " 64: a sapper pinned (" + o.length + " real taps); its space '" + (pinS ? pinS.aria : "-") + "' class '" + (pinS ? pinS.cls : "-") + "', badge " + JSON.stringify(pinS && pinS.badge) + " css px; the head reads '" + ls.head + "'");
    const lr = await rect("#line-wrap"); if (lr) await shot("L64-pinned-line", { x: Math.max(0, lr.x - 6), y: Math.max(0, lr.y - 6), width: Math.min(w - Math.max(0, lr.x - 6), lr.w + 12), height: lr.h + 12 });
    const P = E.compile(L), N = E.rulesOf(CFG.v3, L.tag), S = E.sim(P, N); for (const c of o) { S.play(+c); S.quiet(); } const cont = R.solve(P, N, 400000, null, S.save()); let up = null, upLine = null;
    for (const ch of cont || "") { await card(+ch); for (let i = 0; i < 400; i++) { const r = await p.evaluate(() => { SP.tick(100); return { busy: SP.state().busy, h: SP.hits() }; }); if (!up && r.h.kind === 4) { up = r.h; await p.evaluate(() => SP.tick(40)); upLine = await lineState(); await shot("L64-released"); } if (!r.busy) break; } }
    for (let i = 0; i < 1500 && !(await p.evaluate(() => SP.state().panel)); i++) await p.evaluate(() => SP.tick(40)); const end = await p.evaluate(() => SP.state());
    check(!!up && upLine && !upLine.slots.some((s) => /\bpinned\b/.test(s.cls)) && !/pinned/.test(upLine.head) && end.status === "won", tag + " 64: the tower falls, the sapper gets up: no space marked pinned, the head reads '" + (upLine ? upLine.head : "-") + "'; " + (cont || "").length + " more real taps win (" + end.status + ")"); }
  // 157: the start toast; the sockets; the stored order; each socket opens; the win.
  { const L = await open(157); await shot("L157-start"); await toastClear(157); const lr = await rect("#line-wrap"); if (lr) await shot("L157-line", { x: Math.max(0, lr.x - 6), y: Math.max(0, lr.y - 6), width: Math.min(w - Math.max(0, lr.x - 6), lr.w + 12), height: lr.h + 12 });
    const socks = await p.evaluate(() => [...document.querySelectorAll("#line .slot.locked")].map((s) => { const a = getComputedStyle(s, "::after"), r = s.getBoundingClientRect(); return { cls: s.className, aria: s.getAttribute("aria-label"), mark: a.content !== "none" && a.backgroundImage !== "none" ? [parseFloat(a.width), parseFloat(a.height)] : null, w: Math.round(r.width) }; })); M.socks = socks;
    check(socks.length === 2 && (PHASE === "before" || (socks.some((s) => /\bklock\b/.test(s.cls) && s.mark && s.mark[0] >= 10) && socks.some((s) => /\bclock\b/.test(s.cls)))), tag + " 157: two padlocked sockets: " + socks.map((s) => "'" + s.aria + "' (" + s.cls.replace(/^slot ?/, "") + (s.mark ? ", key mark " + s.mark.map(Math.round).join("x") + " px" : "") + ")").join(", "));
    const chip = await rect("#tag-chip"); M.chip = chip; if (chip) await shot("L157-chip", { x: Math.max(0, chip.x - 70), y: Math.max(0, chip.y - 30), width: Math.min(260, w - Math.max(0, chip.x - 70)), height: chip.h + 60 });
    let was = (await p.evaluate(() => SP.state())).locked, k = 0; for (const ch of L.win[L.tag]) { await card(+ch); for (let i = 0; i < 400; i++) { const r = await p.evaluate(() => { SP.tick(100); return { busy: SP.state().busy, locked: SP.state().locked }; }); if (r.locked < was) { k++; await shot("L157-unlock-" + k); was = r.locked; } if (!r.busy) break; } }
    for (let i = 0; i < 1500 && !(await p.evaluate(() => SP.state().panel)); i++) await p.evaluate(() => SP.tick(40)); const end = await p.evaluate(() => SP.state());
    check(k === 2 && end.status === "won", tag + " 157: " + L.win[L.tag].length + " real taps: both sockets open (" + k + "), the level wins (" + end.status + ")"); }
  // Rings at rest (74, 91): the board.
  for (const n of [74, 91]) { await open(n); await p.evaluate(() => { for (let i = 0; i < 40; i++) SP.tick(100); }); const bd = await rect("#board"); await shot("L" + n + "-rings", bd ? { x: bd.x, y: bd.y, width: bd.w, height: bd.h } : undefined); }
  // The map's tag pills at realms 7 and 8.
  await boot(""); for (const [to, n0, k] of [[200, 160, "map-r7"], [200, 190, "map-r8"]]) { await p.evaluate((n) => { localStorage.clear(); SP.unlockTo(n); SP.screen("map"); }, to); await p.waitForTimeout(300); await p.locator('button.mn[data-n="' + n0 + '"]').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await shot(k); }
  // Side quests.
  await p.evaluate(() => { localStorage.clear(); SP.unlockTo(200); SP.screen("map"); }); await p.waitForTimeout(300);
  for (const c of QUESTS) { const id = "g-ours-" + c, q = await p.evaluate((i) => SP.quest(i), id); if (!q) { check(PHASE === "before" ? false : false, tag + " " + id + ": not in the Gallery"); continue; }
    await tapEl('.qn[data-id="' + id + '"]'); await p.waitForTimeout(300); const inv0 = await p.evaluate((k) => SP.meta().inv[k] | 0, q.prize), s0 = await p.evaluate(() => Object.assign(SP.state(), { order: SP.winOrder(), name: document.getElementById("lvl-name").textContent }));
    const st = await rect("#stage"); await shot("q-" + c + "-start", st ? { x: st.x, y: st.y, width: st.w, height: st.h } : undefined);
    if (PHASE === "before") { check(s0.id === id, tag + " " + id + " ('" + s0.name + "') opened from its node"); await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(200); continue; }
    const toasts = new Set();
    for (const ch of s0.order || "") { await card(+ch); for (let i = 0; i < 400; i++) { const r = await p.evaluate(() => { SP.tick(100); const t = document.getElementById("toast"); return { busy: SP.state().busy, t: t.hidden ? null : t.textContent }; }); if (r.t) toasts.add(r.t); if (!r.busy) break; } }
    for (let i = 0; i < 1500; i++) { const r = await p.evaluate(() => { SP.tick(40); const t = document.getElementById("toast"); return { panel: SP.state().panel, t: t.hidden ? null : t.textContent }; }); if (r.t) toasts.add(r.t); if (r.panel) break; }
    const s1 = await p.evaluate((k) => ({ st: SP.state(), title: document.getElementById("p-title").textContent, inv: SP.meta().inv[k] | 0 }), q.prize), pt = [...toasts].find((t) => /^Side quest prize: \+1 /.test(t)) || "";
    await shot("q-" + c + "-win");
    check(s0.id === id && s1.st.status === "won" && s1.title === "Picture complete!" && s1.inv === inv0 + 1 && !!pt, tag + " " + id + " '" + s0.name + "' (after " + q.after + ", " + q.prize + "): won from its map node by " + (s0.order || "").length + " real taps ('" + s1.title + "', '" + pt + "', " + inv0 + " -> " + s1.inv + ")");
    const prim = await p.evaluate(() => { for (let i = 0; i < 20; i++) SP.tick(100); return document.getElementById("p-primary").textContent; }); /* past the sheet's tap guard (page clock) */ await tapEl("#p-primary"); let back = "", scr = "";
    for (let i = 0; i < 40 && !/\bwon\b/.test(back); i++) { await p.waitForTimeout(100); [back, scr] = await p.evaluate((i) => [(document.querySelector('.qn[data-id="' + i + '"]') || {}).className || "", SP.state().screen], id); } back += " on " + scr + " after '" + prim + "'"; check(/\bwon\b/.test(back), tag + " " + id + ": its node shows won (" + back + ")"); await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(300); }
  await ctx.close();
}
await b.close();
writeFileSync(OUT + "/run.json", JSON.stringify({ rows, meas, log }, null, 1));
for (const r of rows) console.log(r);
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
console.log(bad ? bad + " FAILED" : "all passed"); process.exitCode = bad || log.length ? 1 : 0;
