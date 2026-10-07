// Sapper's Path campaign v6 stage 2 (the re-deal of 1-200): the curve's landmark levels played by real taps in a real
// browser, into tools/shots-campaign-v6-s2/ (gitignored). Per viewport (1280x720 desktop; 375x812 3x touch), each level
// opened from the map (its node, with a save that has cleared every level before it), then:
//   64, the first towers and the first pinning archers: the calm pin toast and the coach line; a game that walks a sapper
//      into a ring (the page's hitPlan): the runner lies pinned; Retry; the stored order by real taps wins, nobody hit;
//   66, the first killing archers: the red toast and the coach line; a game with a hit: the doomed runner (and the short
//      sheet if it leaves the colour short); Retry; the stored order wins;
//   159, an Extreme past 150 with two locks: 3 of 5 spaces open, two padlocked sockets; the stored order opens both and wins;
//   200, the boss: the stored order wins.
// Console messages kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-campaign-v6-s2.mjs [--url http://127.0.0.1:8498/]
import { mkdirSync, readFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8498/"), OUT = resolve(here, "shots-campaign-v6-s2"); mkdirSync(OUT, { recursive: true });
const LV = JSON.parse(readFileSync(resolve(here, "../levels/levels.json"), "utf8")).levels, CFG = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8")), LY = CFG.layout;
const byN = (n) => LV.find((l) => l.n === n), ids = LV.filter((l) => l.n <= 200).map((l) => l.id);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], rows = []; let bad = 0;
const check = (c, m) => { if (!c) bad++; rows.push((c ? "ok   " : "FAIL ") + m); };
for (const [w, h, dpr, touch, nm] of [[1280, 720, 1, false, "desktop"], [375, 812, 3, true, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  const tapEl = async (sel) => { const L = p.locator(sel).first(); await L.scrollIntoViewIfNeeded(); const box = await L.boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(60); };
  const card = (j) => tapEl('button.card[data-col="' + j + '"]');
  const st = () => p.evaluate(() => SP.state());
  const rest = () => p.evaluate(() => { for (let i = 0; i < 3000 && SP.state().busy; i++) SP.tick(100); return SP.state(); });
  const shot = (k) => p.screenshot({ path: OUT + "/" + nm + "-" + tag + "-" + k + ".png" });
  const toPanel = () => p.evaluate(() => { for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(40); return SP.state(); });
  // A save that has cleared every level before n (the save's done map, by id), then the map, then the level's node.
  const open = async (n) => {
    const L = byN(n), done = {}; for (const id of ids.slice(0, n - 1)) done[id] = 1;
    await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
    await p.evaluate(([d, key]) => { const raw = JSON.parse(localStorage.getItem(key) || '{"v": 2}'); raw.done = Object.assign({}, d); localStorage.setItem(key, JSON.stringify(raw)); }, [done, CFG.save.key]);
    await p.reload(); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
    await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(500);
    const sel = 'button.mn[data-n="' + n + '"]', node = await p.locator(sel).count();
    if (node) await tapEl(sel); await p.waitForTimeout(300);
    let s = await st(); check(s.id === L.id && s.screen === "play", tag + " " + n + ": opened from its map node (a save with 1-" + (n - 1) + " cleared)");
    if (s.id !== L.id || s.screen !== "play") s = await p.evaluate((id) => SP.load(id), L.id);
    return { L, s, toast: await p.evaluate(() => (document.getElementById("toast").hidden ? null : { t: document.getElementById("toast").textContent, bad: document.getElementById("toast").classList.contains("bad") })), coach: await p.evaluate(() => SP.coach()) };
  };
  const playOrder = async (o) => { for (const ch of o) { await card(+ch); for (let i = 0; i < 400; i++) { const busy = await p.evaluate(() => { SP.tick(100); return SP.state().busy; }); if (!busy) break; } } return toPanel(); };
  const hitGame = async (id, kind) => { const o = await p.evaluate((x) => SP.hitPlan(x), id); if (!o) return null; for (const ch of o.slice(0, -1)) { await card(+ch); await rest(); } await card(+o[o.length - 1]);
    let seen = null; for (let i = 0; i < 600 && !seen; i++) seen = await p.evaluate((k) => { SP.tick(40); const h = SP.hits(); return h.struck && h.label && h.kind === k ? h : null; }, kind); return { o, seen }; };
  // 64: first towers, first pins.
  { const r = await open(64); await shot("64-start");
    check(r.s.id === r.L.id && r.L.archers === "pin" && (r.L.towers || []).length > 0 && r.toast && r.toast.t === LY.pinToast && !r.toast.bad && !!r.coach && /towers are back/i.test(JSON.stringify(r.coach)), tag + " 64 (" + r.L.tag + ", " + r.L.towers.length + " towers): the calm pin toast and the coach line (" + JSON.stringify(r.coach).slice(0, 120) + ")");
    const g = await hitGame(r.L.id, 3); await shot("64-pinned"); const s1 = await rest();
    check(!!g && !!g.seen && s1.status === "playing", tag + " 64: a sapper walked into a ring lies pinned and play goes on (" + (g ? g.o : "no game") + ")");
    await p.evaluate(() => SP.retry()); const o = r.L.win[r.L.tag], w1 = await playOrder(o); await shot("64-win");
    check(w1.status === "won" && w1.panel === "win" && w1.hits === 0, tag + " 64: the stored order (" + o.length + " real taps) wins with nobody hit"); }
  // 66: first kills.
  { const r = await open(66); await shot("66-start");
    check(r.s.id === r.L.id && r.L.archers === "kill" && r.toast && r.toast.t === LY.killToast && r.toast.bad && !!r.coach && /deadly/i.test(JSON.stringify(r.coach)), tag + " 66 (" + r.L.tag + "): the red kill toast and the coach line");
    const g = await hitGame(r.L.id, 2); await shot("66-doomed"); const s1 = await toPanel(); await shot("66-after");
    check(!!g && !!g.seen && s1.kills > 0, tag + " 66: a doomed runner is struck and the engine kills (" + s1.status + (s1.reason ? " " + s1.reason : "") + ")");
    await p.evaluate(() => SP.retry()); const o = r.L.win[r.L.tag], w1 = await playOrder(o); await shot("66-win");
    check(w1.status === "won" && w1.kills === 0 && w1.hits === 0, tag + " 66: the stored order (" + o.length + " real taps) wins with nobody shot"); }
  // 159: two locks.
  { const r = await open(159); await shot("159-start");
    const sk = await p.evaluate(() => { const S = SP.state(), sl = Array.from(document.querySelectorAll("#line .slot")); return { open: S.open, locked: S.locked, shut: sl.filter((x) => /\blocked\b/.test(x.className)).length }; });
    check(r.L.locks && r.L.locks.length === 2 && sk.open === 3 && sk.shut === 2 && r.L.archers === "kill", tag + " 159 (" + r.L.tag + "): two locks, 3 of 5 open, two padlocked sockets (" + JSON.stringify(sk) + ")");
    const o = r.L.win[r.L.tag], w1 = await playOrder(o); await shot("159-win");
    check(w1.status === "won" && w1.kills === 0, tag + " 159: the stored order (" + o.length + " real taps) opens both locks and wins"); }
  // 200: the boss.
  { const r = await open(200); await shot("200-start");
    const o = r.L.win[r.L.tag], w1 = await playOrder(o); await shot("200-win");
    check(r.L.tag === "extreme" && w1.status === "won" && w1.panel === "win", tag + " 200 (the boss, " + (r.L.locks || [r.L.lock]).length + " locks, " + r.L.towers.length + " towers): the stored order (" + o.length + " real taps) wins"); }
  await ctx.close();
}
await b.close();
for (const r of rows) console.log(r);
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = bad || log.length ? 1 : 0;
