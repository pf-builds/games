// Sapper's Path v5.1 (playtesters, 2026-10-06: a win goes back to the map): the screens, phone (375x812, 3x, touch) and
// desktop (1280x720), into tools/shots-v5-1/ (gitignored). On a fresh save: the win sheet of the level whose clear opens
// side quest 1 (and of a mid-campaign one), the map right after its "Back to map" (the next node current, the quest just
// opened with its prize, mid-pulse and settled), a jam's fail sheet, the boss's "Crown taken!" sheet and the map after it.
// Every button is a real tap or click. Prints the console messages (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v5-1.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-v5-1"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = {};
const VPS = [["phone", { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, true], ["desk", { viewport: { width: 1280, height: 720 } }, false]];
async function page(o) { const ctx = await b.newContext(o), p = await ctx.newPage(); p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(e.message));
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded"); await p.evaluate(() => { const d = document.getElementById("jr-dbg"); if (d) d.remove(); }); return { ctx, p }; }
// A power-up unlock's intro tips (a fresh save) go one per tap; the shots take it away before the sheet shows.
const noTip = (p) => p.evaluate(() => { for (let i = 0; i < 6; i++) document.dispatchEvent(new PointerEvent("pointerdown")); }); // the tips queue: one per newly open power-up
const drawn = (p) => p.waitForFunction(() => Array.from(document.querySelectorAll(".jr-img")).filter((i) => i.getAttribute("src")).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
const winNow = async (p) => { await noTip(p); return p.evaluate(() => { const o = SP.winOrder(); for (const c of o) { SP.play(+c); SP.settle(); } for (let i = 0; i < 900 && !SP.state().panel; i++) SP.tick(16); return SP.state().panel; }); };
for (const [vp, o, touch] of VPS) {
  const tap = (p, sel) => (touch ? p.tap(sel) : p.click(sel));
  // A level whose clear opens a side quest: quest 1's, and the first one from level 40 on.
  for (const [name, pick] of [["q1", (g) => g[0]], ["mid", (g) => g.find((id) => SP.quest(id).after >= 40)]]) {
    const { ctx, p } = await page(o);
    const n = await p.evaluate((src) => { const id = eval(src)(SP.gallery()), k = SP.quest(id).after; SP.unlockTo(k - 1); SP.load(k); return k; }, pick.toString());
    const pn = await winNow(p); await p.waitForTimeout(1600); await p.screenshot({ path: OUT + "/" + vp + "-" + name + "-win-" + n + ".png" });
    await tap(p, "#p-primary"); await drawn(p); await p.waitForTimeout(300); await p.screenshot({ path: OUT + "/" + vp + "-" + name + "-map-after-win-" + n + "-pulse.png" });
    await p.waitForTimeout(1500); await p.screenshot({ path: OUT + "/" + vp + "-" + name + "-map-after-win-" + n + ".png" });
    notes[vp + "-" + name] = await p.evaluate(() => { const q = document.getElementById("jr").getBoundingClientRect(), vis = (el) => { const r = el.getBoundingClientRect(); return r.top >= q.top && r.bottom <= q.bottom; };
      return { panel: null, screen: SP.state().screen, cur: (document.querySelector("#jr .mn.cur") || {}).dataset?.n, curInView: vis(document.querySelector("#jr .mn.cur")), openQuests: Array.from(document.querySelectorAll("#jr .qn.open")).map((x) => ({ id: x.dataset.id, inView: vis(x) })), eggsShown: Array.from(document.querySelectorAll("#jr .egg:not([hidden])")).filter(vis).length }; });
    notes[vp + "-" + name].panel = pn; await ctx.close();
  }
  // A jam's fail sheet (Retry main, Back to map second), then its second button.
  { const { ctx, p } = await page(o);
    const plan = await p.evaluate(() => { for (let n = 46; n <= 75; n++) { SP.unlockTo(n - 1); SP.load(n); const q = SP.lossPlan(); if (q) return Object.assign({ n }, q); } return null; });
    await p.evaluate((pl) => { SP.load(pl.n); for (const c of pl.prefix) { SP.play(+c); SP.settle(); } for (let i = 0; i < 900 && !SP.state().panel; i++) SP.tick(16); }, plan); await noTip(p);
    await p.waitForTimeout(900); await p.screenshot({ path: OUT + "/" + vp + "-lose-" + plan.n + ".png" });
    notes[vp + "-lose"] = await p.evaluate(() => [document.querySelector("#p-primary .pl").textContent, document.getElementById("p-secondary").textContent]);
    await tap(p, "#p-secondary"); notes[vp + "-lose"].push(await p.evaluate(() => SP.state().screen)); await ctx.close(); }
  // The boss (level 200): "Crown taken!", then its "Back to map".
  { const { ctx, p } = await page(o);
    await p.evaluate(() => { SP.unlockTo(199); SP.load(200); }); await winNow(p); await p.waitForTimeout(1600); await p.screenshot({ path: OUT + "/" + vp + "-boss-win.png" });
    notes[vp + "-boss"] = await p.evaluate(() => [document.getElementById("p-title").textContent, document.querySelector("#p-primary .pl").textContent]);
    await tap(p, "#p-primary"); await drawn(p); await p.waitForTimeout(1600); await p.screenshot({ path: OUT + "/" + vp + "-boss-map.png" });
    notes[vp + "-boss"].push(await p.evaluate(() => SP.map().focus)); await ctx.close(); }
}
await b.close();
console.log(JSON.stringify(notes, null, 1));
console.log("shots in " + OUT + "; console messages: " + log.length + (log.length ? "\n" + log.slice(0, 10).join("\n") : ""));
process.exit(log.length ? 1 : 0);
