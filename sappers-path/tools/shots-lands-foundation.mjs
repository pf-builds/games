// Sapper's Path lands foundation: phone and desktop shots of a game copy with a demo land installed (levels 201+), into
// tools/shots-lands-foundation/ (gitignored). A 375x812 phone (3x, touch): levels 1-200 cleared; the land's first level
// at its start (the shade tip), part-way through its stored order, two more land levels mid-play (the first Hard or
// Extreme one, with its lock, links, ? cards and mystery blocks, and the first portrait board), the map at the land's
// banner and at its frontier (the mirrored sheet), and the boss's win line (the epilogue); a 1280x720 desktop mid-play.
// Console messages are kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-lands-foundation.mjs --url http://127.0.0.1:8497/game/
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8497/game/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-lands-foundation"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
for (const [w, h, dpr, touch, nm] of [[375, 812, 3, true, "phone"], [1280, 720, 1, false, "desktop"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
  const shot = (k) => p.screenshot({ path: OUT + "/" + nm + "-" + k + ".png" });
  await p.evaluate(() => { localStorage.clear(); SP.unlockTo(200); });
  const play = async (n, taps, ms, k) => { const r = await p.evaluate(([n, taps, ms]) => { const s0 = SP.load(n); const o = SP.winOrder() || ""; for (let i = 0; i < taps && i < o.length; i++) { SP.play(+o[i]); SP.tick(ms); } return { id: s0.id, order: o.length, coach: SP.coach().text }; }, [n, taps, ms]); await p.waitForTimeout(400); await shot(k); notes.push(tag + " " + k + ": " + JSON.stringify(r)); };
  if (nm === "phone") {
    await play(201, 0, 0, "201-start"); await play(201, 6, 2500, "201-mid");
    await play(205, 4, 3000, "205-mid"); await play(202, 5, 2500, "202-mid");
    await p.evaluate(() => { SP.unlockTo(205); SP.screen("map"); }); await p.waitForTimeout(1500); await shot("map-land");
    await p.evaluate(() => { const sc = document.getElementById("jr"); sc.scrollTop = 0; }); await p.waitForTimeout(1500); await shot("map-frontier");
    const bn = await p.evaluate(() => { const b = Array.from(document.querySelectorAll("#jr .bn")).find((x) => /Land 1/.test(x.textContent)); if (!b) return null; b.scrollIntoView({ block: "center" }); b.click(); return b.textContent; }); await p.waitForTimeout(1500); await shot("map-banner"); notes.push(tag + " land banner: " + bn);
    await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.SP, null, { timeout: 20000 });
    const ep = await p.evaluate(() => { SP.unlockTo(199); SP.load(200); const o = SP.winOrder(); for (const c of o) { SP.play(+c); SP.settle(); } SP.tick(12000); return document.getElementById("p-line").textContent; }); await p.waitForTimeout(800); await shot("boss-epilogue"); notes.push(tag + " boss win line: " + ep);
  } else { await play(202, 5, 2500, "202-mid"); }
  await ctx.close();
}
await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n")); console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
