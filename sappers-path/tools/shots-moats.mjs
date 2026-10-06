// Sapper's Path organic moats: phone shots of a game copy with a moat land installed (levels 201+), into
// tools/shots-moats/ (gitignored). A 375x812 phone (3x, touch): each listed land level at its start and part-way through
// its stored order (the ring of water round the subject, the path inside it, the ways in); a 1280x720 desktop mid-play
// of the first. Console messages are kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-moats.mjs --url http://127.0.0.1:8496/ --levels 201,203,208
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8496/"), LV = arg("levels", "201,203,208").split(",").map(Number), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-moats"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
for (const [w, h, dpr, touch, nm] of [[375, 812, 3, true, "phone"], [1280, 720, 1, false, "desktop"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
  await p.evaluate(() => { localStorage.clear(); SP.unlockTo(1e3); });
  const play = async (n, taps, ms, k) => { const r = await p.evaluate(([n, taps, ms]) => { const s0 = SP.load(n); const o = SP.winOrder() || ""; for (let i = 0; i < taps && i < o.length; i++) { SP.play(+o[i]); SP.tick(ms); } return { id: s0.id, order: o.length, title: (document.getElementById("t-name") || {}).textContent }; }, [n, taps, ms]); await p.waitForTimeout(500); await p.screenshot({ path: OUT + "/" + nm + "-" + k + ".png" }); notes.push(tag + " " + k + ": " + JSON.stringify(r)); };
  for (const n of nm === "phone" ? LV : LV.slice(0, 1)) { await play(n, 0, 0, n + "-start"); await play(n, 8, 2600, n + "-mid"); }
  await ctx.close();
}
await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n")); console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
