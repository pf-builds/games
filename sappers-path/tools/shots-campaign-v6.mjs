// Sapper's Path campaign v6 stage 1 (killing towers, two locks): the two v6 debug levels played by real taps, into
// tools/shots-campaign-v6/ (gitignored). Per viewport (1280x720 desktop; 375x812 3x touch): from the map's debug row,
// v6-kill: the warning toast, a game that walks a sapper into the archer's ring (tap 3, then 0: the doomed runner, the
// label), the short sheet (no continue), Retry; then v6-locks: the two padlocked sockets, its stored order tapped card by
// card (the page clock run on with SP.tick between taps), each lock opening its own socket, and the win. Console
// messages kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-campaign-v6.mjs [--url http://127.0.0.1:8496/]
import { mkdirSync, readFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8496/"), OUT = resolve(here, "shots-campaign-v6"); mkdirSync(OUT, { recursive: true });
const DBG = JSON.parse(readFileSync(resolve(here, "../levels/debug-v4.json"), "utf8")).levels, LOCKS = DBG.find((l) => l.id === "v6-locks");
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
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
  await p.evaluate(() => { localStorage.clear(); SP.screen("map"); }); await p.waitForTimeout(500);
  // v6-kill from the map's debug row.
  await tapEl('.dbg-node[data-id="v6-kill"]'); await p.waitForTimeout(250);
  const t0 = await p.evaluate(() => ({ s: SP.state(), toast: document.getElementById("toast").hidden ? null : document.getElementById("toast").textContent }));
  await shot("kill-start");
  check(t0.s.id === "v6-kill" && t0.s.screen === "play" && t0.toast === "Deadly archers: a sapper they hit is lost", tag + " v6-kill starts from the map's debug row with the warning toast ('" + t0.toast + "')");
  await card(3); await rest(); await card(0);
  let seen = null; for (let i = 0; i < 600 && !seen; i++) seen = await p.evaluate(() => { SP.tick(40); const h = SP.hits(); return h.struck && h.label ? h : null; });
  await shot("kill-arrow");
  const k1 = await st(); check(!!seen && seen.kind === 2 && k1.kills === 1 && k1.status === "failed" && k1.reason === "short", tag + " tap 3 then 0: a doomed runner is struck, the label rises; the engine kills and fails short (" + JSON.stringify(seen) + ")");
  await p.evaluate(() => { for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(40); }); await p.waitForTimeout(500);
  const sh = await p.evaluate(() => ({ panel: SP.state().panel, title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent, aria: document.getElementById("p-line").getAttribute("aria-label"), chip: !!document.querySelector("#p-line .chip"), cont: document.getElementById("p-cont").hidden, main: document.querySelector("#p-primary .pl").textContent, second: document.getElementById("p-secondary").textContent }));
  await shot("short-sheet");
  check(sh.panel === "fail" && sh.chip && sh.cont && sh.main === "Retry" && /^Not enough .* left: archers shot one down\.$/.test(sh.aria), tag + " the short sheet: '" + sh.title + "' / '" + sh.aria + "' (the colour's chip shown), no continue, buttons '" + sh.main + "' and '" + sh.second + "'");
  await tapEl("#p-primary"); await p.waitForTimeout(300);
  const r1 = await st(); await shot("kill-retry");
  check(r1.status === "playing" && r1.plays === 0 && r1.kills === 0 && !r1.panel, tag + " Retry: the level starts again (plays " + r1.plays + ", kills " + r1.kills + ")");
  // v6-locks: two padlocked sockets; each lock opens its own; the stored order wins.
  await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(400);
  await tapEl('.dbg-node[data-id="v6-locks"]'); await p.waitForTimeout(250);
  const sock = () => p.evaluate(() => { const S = SP.state(), sl = Array.from(document.querySelectorAll("#line .slot")).slice(S.cap - 2, S.cap); return { open: S.open, locked: S.locked, a: sl[0].className, b: sl[1].className, aa: sl[0].getAttribute("aria-label"), ba: sl[1].getAttribute("aria-label"), keys: SP.fx().lockKeys, cue: SP.cues().unlock | 0 }; });
  const s0 = await sock(); await shot("locks-start");
  check(s0.open === 3 && s0.locked === 2 && /\blocked\b/.test(s0.a) && /\bclock\b/.test(s0.a) && /\blocked\b/.test(s0.b) && !/\bclock\b/.test(s0.b) && s0.keys === 1, tag + " v6-locks: 3 of 5 open; the left socket '" + s0.aa + "', the right '" + s0.ba + "'; the key wears its brackets");
  const ups = []; let was = 2; const o = LOCKS.win.normal;
  const watch = async () => { const s = await sock(); if (s.locked < was) { ups.push(s); await shot("unlock-" + ups.length); } was = s.locked; };
  for (const ch of o) { await card(+ch); await watch(); for (let i = 0; i < 400; i++) { const busy = await p.evaluate(() => { SP.tick(100); return SP.state().busy; }); await watch(); if (!busy) break; } }
  check(ups.length === 2 && /unlocking/.test(ups[0].b) && /\blocked\b/.test(ups[0].a) && ups[0].keys === 0 && /unlocking/.test(ups[1].a) && !/\blocked\b/.test(ups[1].a) && ups[1].cue - s0.cue === 2, tag + " the key opens the right socket alone (the left stays shut), then the colour opens the left; " + ups.map((u) => "[" + u.a + " | " + u.b + "]").join(" then "));
  await p.evaluate(() => { for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(40); }); await p.waitForTimeout(600);
  const wn = await st(); await shot("locks-win");
  check(wn.status === "won" && wn.panel === "win", tag + " the stored order (" + o.length + " real taps) wins");
  await ctx.close();
}
await b.close();
for (const r of rows) console.log(r);
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = bad || log.length ? 1 : 0;
