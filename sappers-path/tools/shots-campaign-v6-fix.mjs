// Sapper's Path campaign v6 fix pass (difficulty): the re-dealt landmarks played by real taps in a real browser, into
// tools/shots-campaign-v6-fix/ (gitignored). Per viewport (1280x720 desktop; 375x812 3x touch), each level opened from the
// map (its node, with a save that has cleared every level before it), its stored order played by real taps (a win, nobody
// hit), and its start shot kept:
//   11, the first Hard (its floor: a step up, not a wall); 64, the first pin (toast and coach); 66, the first kill (toast
//   and coach); 104 (its tower moved to 106); 106 and 116, the moved stone towers (pin); 125, the first knock-back tower
//   (its coach names the knock back); 157, the first two locks (its coach line); 176 and 198 (the stone tower); 200, the boss.
// Console messages kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-campaign-v6-fix.mjs [--url http://127.0.0.1:8499/]
import { mkdirSync, readFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8499/"), OUT = resolve(here, "shots-campaign-v6-fix"); mkdirSync(OUT, { recursive: true });
const LV = JSON.parse(readFileSync(resolve(here, "../levels/levels.json"), "utf8")).levels, CFG = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8")), LY = CFG.layout;
const byN = (n) => LV.find((l) => l.n === n), ids = LV.filter((l) => l.n <= 200).map((l) => l.id);
const want = { 64: { toast: LY.pinToast, coach: /towers are back/i }, 66: { toast: LY.killToast, coach: /deadly/i }, 125: { coach: /knock sappers back/i }, 157: { toast: LY.killToast, coach: /two spaces are locked/i } }; // what a level must say at its start
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], rows = []; let bad = 0;
const check = (c, m) => { if (!c) bad++; rows.push((c ? "ok   " : "FAIL ") + m); };
for (const [w, h, dpr, touch, nm] of [[1280, 720, 1, false, "desktop"], [375, 812, 3, true, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), tag = w + "x" + h;
  await ctx.addInitScript(([key, all]) => { const n = +new URLSearchParams(location.search).get("n"); if (n > 0) { const d = {}; for (const id of all.slice(0, n - 1)) d[id] = 1; localStorage.setItem(key, JSON.stringify({ v: 2, done: d })); } }, [CFG.save.key, ids]);
  const p = await ctx.newPage();
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  const tapEl = async (sel) => { const L = p.locator(sel).first(); await L.scrollIntoViewIfNeeded(); const box = await L.boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(60); };
  const card = (j) => tapEl('button.card[data-col="' + j + '"]');
  const st = () => p.evaluate(() => SP.state());
  const shot = (k) => p.screenshot({ path: OUT + "/" + nm + "-" + tag + "-" + k + ".png" });
  const toPanel = () => p.evaluate(() => { for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(40); return SP.state(); });
  const open = async (n) => {
    const L = byN(n);
    await p.goto(URL_ + "?debug=1&n=" + n); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
    await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(500);
    const sel = 'button.mn[data-n="' + n + '"]'; if (await p.locator(sel).count()) await tapEl(sel); await p.waitForTimeout(300);
    let s = await st(); check(s.id === L.id && s.screen === "play", tag + " " + n + ": opened from its map node (a save with 1-" + (n - 1) + " cleared)");
    if (s.id !== L.id || s.screen !== "play") s = await p.evaluate((id) => SP.load(id), L.id);
    return { L, s, toast: await p.evaluate(() => (document.getElementById("toast").hidden ? null : document.getElementById("toast").textContent)), coach: await p.evaluate(() => SP.coach()) };
  };
  const playOrder = async (o) => { for (const ch of o) { await card(+ch); for (let i = 0; i < 400; i++) { const busy = await p.evaluate(() => { SP.tick(100); return SP.state().busy; }); if (!busy) break; } } return toPanel(); };
  for (const n of [11, 64, 66, 104, 106, 116, 125, 157, 176, 198, 200]) {
    const r = await open(n), W = want[n] || {}, g = r.L.grade[r.L.tag], best = g.deep ? [Math.max(...g.deep.a), Math.max(...g.deep.b)] : null; await shot(n + "-start");
    if (W.toast || W.coach) check((!W.toast || r.toast === W.toast) && (!W.coach || W.coach.test(JSON.stringify(r.coach))), tag + " " + n + ": the start toast and coach line (" + r.toast + " / " + JSON.stringify(r.coach).slice(0, 110) + ")");
    const o = r.L.win[r.L.tag], w1 = await playOrder(o); await shot(n + "-win");
    check(w1.status === "won" && w1.panel === "win" && w1.hits === 0 && w1.kills === 0, tag + " " + n + " (" + r.L.tag + ", " + (r.L.towers || []).length + " towers" + (r.L.archers ? " " + r.L.archers : "") + ", " + ((r.L.locks || (r.L.lock ? [r.L.lock] : [])).length) + " locks, best-of " + (best ? best.join("/") : "-") + "): the stored order (" + o.length + " real taps) wins, nobody hit");
  }
  await ctx.close();
}
await b.close();
for (const r of rows) console.log(r);
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = bad || log.length ? 1 : 0;
