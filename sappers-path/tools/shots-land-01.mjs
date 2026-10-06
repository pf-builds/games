// Sapper's Path Land 1 Kitten Forest: phone and desktop shots of the game with the land installed, into
// tools/shots-land-01/ (gitignored). A 375x812 phone (3x, touch) and a 1280x720 desktop, each: the map with level 201
// current (levels 1-200 cleared), the 200 -> 201 join (castle sheet 25 under the forest's first sheet), the map at 225
// with side quest 66 open, levels in play (201's shade tip; a Hard level with mystery blocks, ? cards, links and its lock,
// mid-play; 250, the Extreme finale, at its start and mid-play), a Wandering Gallery side quest mid-play, and the eggs on
// the first land sheet before and after their taps. Mid-play = n taps of the stored order with ms of play after each.
// Console messages are kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-land-01.mjs [--url http://127.0.0.1:8494/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8494/sappers-path/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-land-01"); mkdirSync(OUT, { recursive: true });
const HARD = +arg("hard", 206), QUEST = arg("quest", "g-w-poppy-field-giverny");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
for (const [w, h, dpr, touch, nm] of [[375, 812, 3, true, "phone"], [1280, 720, 1, false, "desktop"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
  const shot = (k) => p.screenshot({ path: OUT + "/" + nm + "-" + k + ".png" });
  const sheetsIn = async () => { for (let i = 0; i < 40; i++) { const m = await p.evaluate(() => SP.map()); if (m && m.loaded >= Math.min(m.sheets, 3)) break; await p.waitForTimeout(250); } await p.waitForTimeout(900); };
  const mapAt = async (k, upTo, centre) => { await p.evaluate(([u]) => { localStorage.clear(); SP.unlockTo(u); SP.screen("map"); }, [upTo]); await sheetsIn();
    if (centre) await p.evaluate((c) => { const sc = document.getElementById("jr"), ns = c.map((n) => document.querySelector('#jr .mn[data-n="' + n + '"], #jr .qn[data-id="' + n + '"]')).filter(Boolean); if (!ns.length) return; const r = ns.map((x) => x.getBoundingClientRect()), y = (Math.min(...r.map((q) => q.top)) + Math.max(...r.map((q) => q.bottom))) / 2, s = sc.getBoundingClientRect(); sc.scrollTop += y - (s.top + s.height / 2); }, centre);
    await sheetsIn(); await shot(k); notes.push(tag + " " + k + ": " + JSON.stringify(await p.evaluate(() => { const m = SP.map(); return { sheets: m.sheets, loaded: m.loaded, scrollTop: m.scrollTop }; }))); };
  const play = async (n, taps, ms, k) => { const r = await p.evaluate(([n, taps, ms]) => { const s0 = SP.load(n); const o = SP.winOrder() || ""; for (let i = 0; i < taps && i < o.length; i++) { SP.play(+o[i]); SP.tick(ms); } const st = SP.state(); return { id: s0.id, tag: st.tag, order: o.length, coach: SP.coach().text, title: (document.getElementById("lvl-name") || {}).textContent }; }, [n, taps, ms]); await p.waitForTimeout(500); await shot(k); notes.push(tag + " " + k + ": " + JSON.stringify(r)); };
  await mapAt("map-201", 200);
  await mapAt("map-join-200-201", 200, [200, 201]);
  await mapAt("map-225-quest", 224, [224, 225, "g-w-" + "boating-manet"]);
  const eg = await p.evaluate(() => { localStorage.clear(); SP.unlockTo(208); SP.screen("map"); const e = Array.from(document.querySelectorAll("#jr .egg")).filter((x) => !x.hidden && /^s26-/.test(x.dataset.id)); return e.map((x) => x.className); }); await sheetsIn();
  await p.evaluate(() => { const e = document.querySelector('#jr .egg[data-id="s26-0"]'); if (e) e.scrollIntoView({ block: "center" }); }); await sheetsIn(); await shot("map-eggs-before");
  await p.evaluate(() => { for (const id of ["s26-0", "s26-1"]) { const e = document.querySelector('#jr .egg[data-id="' + id + '"]'); if (e) e.click(); } }); await p.waitForTimeout(1600); await shot("map-eggs-after"); notes.push(tag + " eggs on sheet 26: " + JSON.stringify(eg));
  await p.evaluate(() => { localStorage.clear(); SP.unlockTo(200); });
  await play(201, 0, 0, "201-start");
  await play(HARD, 10, 2600, HARD + "-mid");
  await play(250, 0, 0, "250-start");
  await play(250, 12, 2600, "250-mid");
  await play(QUEST, 8, 2600, "quest-mid");
  await ctx.close();
}
await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n")); console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
