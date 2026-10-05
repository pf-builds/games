// Sapper's Path v5 R4 fix pass: the screens that prove each fix, phone (375x812, 3x, touch) and desktop (1280x720), into
// tools/shots-v5-r4/fixes/ (gitignored). Mistmoor boards (day, dusk, night), throne boards (four families), the boss (its
// intro, the board, the win sheet with the crown), the map label cases (106, 110, 131, 159, 189), towers on a lava and a
// moat board, and the realm 8 banner on a 360-wide phone. Prints the console messages (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v5-r4-fixes.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-v5-r4/fixes"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [];
const VPS = [["phone", { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }], ["desk", { viewport: { width: 1280, height: 720 } }]];
const BOARDS = [["mist-day-101", 101], ["mist-dusk-116", 116], ["mist-night-107", 107], ["mist-night-113", 113], ["throne-camp-178", 178], ["throne-cliff-181", 181], ["throne-crooked-188", 188], ["throne-gate-180", 180], ["throne-hall-184", 184], ["tower-lava-133", 133], ["tower-moat-176", 176]];
async function page(o) { const ctx = await b.newContext(o), p = await ctx.newPage(); p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(e.message));
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded"); await p.evaluate(() => { const d = document.getElementById("jr-dbg"); if (d) d.remove(); }); return { ctx, p }; }
const drawn = (p) => p.waitForFunction(() => Array.from(document.querySelectorAll(".jr-img")).filter((i) => i.getAttribute("src")).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
for (const [vp, o] of VPS) {
  const { ctx, p } = await page(o);
  for (const [name, n] of BOARDS) { await p.evaluate((k) => { SP.unlockTo(k - 1); SP.load(k); SP.tick(1500); }, n); await p.waitForTimeout(150); await p.screenshot({ path: OUT + "/" + vp + "-" + name + ".png" }); }
  // The boss: its intro (the coach's ring on the king), mid-board, and the win sheet with the crown.
  await p.evaluate(() => { SP.unlockTo(199); SP.load(200); SP.tick(800); }); await p.waitForTimeout(150); await p.screenshot({ path: OUT + "/" + vp + "-boss-intro.png" });
  await p.evaluate(() => { const o = SP.winOrder(); for (let i = 0; i < 12; i++) { SP.play(+o[i]); SP.settle(); } SP.tick(1200); }); await p.waitForTimeout(150); await p.screenshot({ path: OUT + "/" + vp + "-boss-board.png" });
  await p.evaluate(() => { const o = SP.winOrder(); SP.retry(); for (const c of o) { SP.play(+c); SP.settle(); } SP.tick(9000); }); await p.waitForTimeout(1600); await p.screenshot({ path: OUT + "/" + vp + "-boss-win.png" });
  await ctx.close();
  // The map (a fresh save, levels cleared in order): the label cases (the current level n), Play's boss label at 200.
  const M = await page(o);
  for (const n of [106, 110, 131, 159, 189, 200]) { const p = M.p; await p.evaluate((k) => { SP.unlockTo(k - 1); SP.clearPictures(Math.max(0, Math.min(50, Math.floor((k - 5) / 4)))); SP.screen("map"); const d = document.getElementById("jr-dbg"); if (d) d.remove(); }, n); await drawn(p); await p.waitForTimeout(200); await p.screenshot({ path: OUT + "/" + vp + "-map-label-" + n + ".png" }); }
  await M.ctx.close();
}
// The realm 8 banner on a 360-wide phone (every level cleared, the banner in the middle of the view).
{ const { ctx, p } = await page({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await p.evaluate(() => { SP.unlockTo(1000); SP.clearPictures(60); SP.screen("map"); const d = document.getElementById("jr-dbg"); if (d) d.remove(); const bn = Array.from(document.querySelectorAll("#jr .bn")).find((x) => /Goblin/.test(x.querySelector("b").textContent)), sc = document.getElementById("jr"); sc.scrollTop += bn.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientHeight / 2; });
  await drawn(p); await p.waitForTimeout(300); await p.screenshot({ path: OUT + "/phone360-banner-realm8.png" });
  const fit = await p.evaluate(() => { const bn = Array.from(document.querySelectorAll("#jr .bn")).find((x) => /Goblin/.test(x.querySelector("b").textContent)), t = bn.querySelector("b"), r = bn.getBoundingClientRect(); return { text: t.textContent, cut: t.scrollWidth > t.clientWidth + 1, left: Math.round(r.left), right: Math.round(r.right), lines: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight || 25)) }; });
  console.log("realm 8 banner at 360: " + JSON.stringify(fit)); await ctx.close(); }
await b.close();
console.log("shots in " + OUT + "; console messages: " + log.length + (log.length ? "\n" + log.slice(0, 10).join("\n") : ""));
process.exit(log.length ? 1 : 0);
