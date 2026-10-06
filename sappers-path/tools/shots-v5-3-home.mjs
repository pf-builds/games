// Sapper's Path v5.3 (Peter, 2026-10-06: the painted siege on the home, and the castle centred at every width): the home
// at 375x812 (3x, touch), 414x896 (touch), 768x1024, 1143x800 (the width where the old scene drifted right), 1366x768,
// 1920x1080 and a phone held sideways (812x375, touch), mid-campaign (the realm line reads Realm 4), into
// tools/shots-v5-3-home/ (gitignored). Then the sweep: every config title.art.widths at a phone height (812) and a desktop
// height (800), plus the landscape phones (touch; the shot above is a short desktop window, as a phone held sideways shows the upright card): which image the <picture> picked, the home's box, and the castle's centre off
// the box's centre as a share of its width (limit title.art.maxOff). Prints the console messages (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v5-3-home.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-v5-3-home"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], rows = [], A = (await (await fetch(URL_ + "config.json")).json()).title.art; let bad = 0;
const SHOTS = [[375, 812, 3, true], [414, 896, 2, true], [768, 1024, 2, false], [1143, 800, 1, false], [1366, 768, 1, false], [1920, 1080, 1, false], [812, 375, 3, false]];
const ready = (p) => p.waitForFunction(() => window.SP && document.fonts.status === "loaded" && document.querySelector("#title-art.on"), null, { timeout: 15000 });
async function open(w, h, dpr, touch) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage();
  p.on("console", (m) => log.push(w + "x" + h + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(w + "x" + h + " " + e.message));
  await p.goto(URL_ + "?debug=1"); await ready(p);
  await p.evaluate(() => { SP.unlockTo(80); SP.screen("title"); }); await p.waitForTimeout(800); // mid-campaign: Realm 4; the fade done
  return { ctx, p };
}
const row = (tag, g, lim) => { const okk = Math.abs(g.off) <= lim; if (!okk) bad++; rows.push(tag.padEnd(14) + " " + g.k.padEnd(5) + " box " + Math.round(g.w) + "x" + Math.round(g.h) + "  castle " + (g.off * 100).toFixed(1).padStart(5) + "%  " + (okk ? "ok" : "OFF")); };
for (const [w, h, dpr, touch] of SHOTS) {
  const { ctx, p } = await open(w, h, dpr, touch);
  await p.screenshot({ path: OUT + "/home-" + w + "x" + h + ".png" });
  const [g, era] = await p.evaluate(() => [SP.homeArt(), document.getElementById("home-era").textContent]);
  row(w + "x" + h + " shot", g, A.maxOff);
  rows[rows.length - 1] += "  " + era; await ctx.close();
}
// The sweep: one context per height, resized through the widths (the <picture> re-picks on an orientation change).
for (const [h, dpr, touch] of [[812, 2, true], [800, 1, false]]) {
  const { ctx, p } = await open(A.widths[0], h, dpr, touch);
  for (const w of A.widths) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250); await p.waitForFunction(() => { const i = document.querySelector("#title-art img"); return i.complete && i.naturalWidth > 0; }); row(w + "x" + h, await p.evaluate(() => SP.homeArt()), A.maxOff); }
  await ctx.close();
}
for (const [w, h] of [[568, 320], [667, 375], [740, 360], [844, 390], [896, 414], [932, 430]]) { const { ctx, p } = await open(w, h, 3, true); row(w + "x" + h + " land", await p.evaluate(() => SP.homeArt()), A.maxOff); await ctx.close(); }
await b.close();
console.log(rows.join("\n")); console.log("castle off-centre past " + A.maxOff * 100 + "%: " + bad); console.log("console messages: " + log.length); for (const l of log) console.log("  " + l);
process.exit(bad || log.length ? 1 : 0);
