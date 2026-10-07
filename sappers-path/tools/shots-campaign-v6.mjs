// Sapper's Path campaign v6 stage 1 (killing towers, two locks): the two v6 debug levels played by real taps, into
// tools/shots-campaign-v6/ (gitignored). Per viewport (1280x720 desktop; 375x812 3x touch): from the map's debug row,
// v6-kill: the warning toast, a game that walks a sapper into the archer's ring (tap 3, then 0: the doomed runner, the
// label), the short sheet (no continue), Retry; then v6-locks: the two padlocked sockets, its stored order tapped card by
// card (the page clock run on with SP.tick between taps), each lock opening its own socket, and the win. Stage 1b:
// v6-pin: the calm toast; tap 3 then 0 pins a sapper (lying, the arrow in it); a winning continuation (solved here from
// that position) taps on until its tower falls and it gets up, then the win; and a jam with a pinned squad (its sheet).
// Console messages kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-campaign-v6.mjs [--url http://127.0.0.1:8496/]
import { mkdirSync, readFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8497/"), OUT = resolve(here, "shots-campaign-v6"); mkdirSync(OUT, { recursive: true });
const DBG = JSON.parse(readFileSync(resolve(here, "../levels/debug-v4.json"), "utf8")).levels, LOCKS = DBG.find((l) => l.id === "v6-locks");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const require = (await import("node:module")).createRequire(import.meta.url), E = require("../src/engine.js"), R = require("./grade.js"), N = E.rulesOf(require("../config.json").v3, "normal");
const PIN = DBG.find((l) => l.id === "v6-pin"), PB = E.compile(PIN), pinRest = (() => { const S = E.sim(PB, N); for (const c of "30") { S.play(+c); S.quiet(); } return R.solve(PB, N, 400000, null, S.save()); })();
const pinJam = (() => { for (let k = 0; k < 2000; k++) { const S = E.sim(PB, N), r = R.rng(k * 13 + 5); let o = ""; for (let g = 0; g <= PB.ncards && S.status === E.PLAYING; g++) { const op = []; for (let j = 0; j < 5; j++) if (R.legal(S, j)) op.push(j); if (!op.length) break; const j = op[Math.floor(r() * op.length)]; o += j; S.play(j); S.quiet(); } if (S.status === E.FAILED && S.reason === "jam" && S.jamWhy & 8) return o; } return null; })();
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
  // Stage 1b: v6-pin.
  await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(400);
  await tapEl('.dbg-node[data-id="v6-pin"]'); await p.waitForTimeout(250);
  const p0 = await p.evaluate(() => ({ s: SP.state(), toast: document.getElementById("toast").hidden ? null : document.getElementById("toast").textContent, bad: document.getElementById("toast").classList.contains("bad") }));
  await shot("pin-start");
  check(p0.s.id === "v6-pin" && p0.toast === "Archers pin here: a hit sapper waits for its tower to fall" && !p0.bad, tag + " v6-pin starts with the calm toast ('" + p0.toast + "')");
  await card(3); await rest(); await card(0);
  let pn = null; for (let i = 0; i < 600 && !pn; i++) pn = await p.evaluate(() => { SP.tick(40); const h = SP.hits(); return h.struck && h.kind === 3 && h.label ? h : null; });
  await shot("pin-struck"); const s1 = await rest(); await shot("pin-lying");
  const lying = await p.evaluate(() => SP.hits());
  check(!!pn && s1.status === "playing" && lying.kind === 3 && lying.live === 1, tag + " tap 3 then 0: the arrow strikes, the sapper lies pinned at rest and play goes on (" + JSON.stringify(lying) + ")");
  let up = null;
  for (const ch of pinRest || "") { await card(+ch); for (let i = 0; i < 400; i++) { const r = await p.evaluate(() => { SP.tick(100); const h = SP.hits(); return { busy: SP.state().busy, h }; }); if (!up && r.h.kind === 4) { up = r.h; await shot("pin-released"); } if (!r.busy) break; } }
  await p.evaluate(() => { for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(40); }); await p.waitForTimeout(600);
  const pw = await st(); await shot("pin-win");
  check(!!pinRest && !!up && pw.status === "won" && pw.panel === "win", tag + " the continuation (" + (pinRest || "").length + " real taps): the tower falls, the pinned sapper gets up and walks back, the level wins");
  await tapEl("#p-primary"); await p.waitForTimeout(600); await tapEl('.dbg-node[data-id="v6-pin"]'); await p.waitForTimeout(250);
  for (const ch of pinJam || "") { await card(+ch); await rest(); }
  await p.evaluate(() => { for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(40); }); await p.waitForTimeout(500);
  const pj = await p.evaluate(() => ({ panel: SP.state().panel, reason: SP.state().reason, aria: document.getElementById("p-line").getAttribute("aria-label"), chips: document.querySelectorAll("#p-line .chip").length }));
  await shot("pin-jam");
  check(!!pinJam && pj.panel === "fail" && pj.reason === "jam" && /pinned sappers until their towers fall\.$/.test(pj.aria) && pj.chips >= 1, tag + " a jam with a pinned squad ('" + pinJam + "'): '" + pj.aria + "' (" + pj.chips + " chips)");
  await ctx.close();
}
await b.close();
for (const r of rows) console.log(r);
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = bad || log.length ? 1 : 0;
