// Sapper's Path v6 lane B (Zen mode): shots into tools/shots-zen/ (gitignored) at a 375x812 phone (3x, touch), a
// 320x568 phone (2x, touch) and a 1280x720 desktop, each on a fresh profile. Home and map shots are taken on the plain
// URL (no debug row), after setting the save up under ?debug=1 and reloading: the fresh home's two cards; the Campaign
// map's end (levels to 199 cleared: the Goblin King at 200, no road on); the Zen map at World 1's start, at the World 1 /
// World 2 join and at its top; then under ?debug=1 a Zen win (a side quest with its prize named) and a Zen fail; the home
// after Zen (Zen's card ringed); the reset sheet's three choices (Everything picked). Console messages kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-zen.mjs [--url http://127.0.0.1:8495/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8495/sappers-path/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-zen"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
for (const [w, h, dpr, touch, nm] of [[375, 812, 3, true, "phone"], [320, 568, 2, true, "small"], [1280, 720, 1, false, "desktop"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  const go = async (dbg) => { await p.goto(URL_ + (dbg ? "?debug=1" : "")); await p.waitForFunction(() => document.fonts.status === "loaded" && !document.getElementById("btn-play").hidden && document.getElementById("play-lab").textContent !== "Play", null, { timeout: 20000 }); };
  const shot = async (k) => { await p.waitForTimeout(500); await p.screenshot({ path: OUT + "/" + nm + "-" + k + ".png" }); };
  const sheetsIn = async () => { for (let i = 0; i < 40; i++) { const ok = await p.evaluate(() => Array.from(document.querySelectorAll("#jr .jr-img")).filter((im) => { const r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).every((im) => im.complete && im.naturalWidth)); if (ok) break; await p.waitForTimeout(250); } };
  const toMap = async (mode) => { if (await p.isVisible("#btn-tomap")) await p.click("#btn-tomap"); if (mode) await p.evaluate((m) => { const c = document.querySelector('#map-mode [data-mode="' + m + '"]'); if (c.getAttribute("aria-pressed") !== "true") c.click(); }, mode); await sheetsIn(); };
  await go(false); await shot("home");
  await go(true); await p.evaluate(() => SP.unlockTo(199)); await go(false); await toMap("campaign"); await p.evaluate(() => { document.getElementById("jr").scrollTop = 0; }); await sheetsIn(); await shot("campaign-map-end");
  await toMap("zen"); await p.evaluate(() => { const sc = document.getElementById("jr"); sc.scrollTop = sc.scrollHeight; }); await sheetsIn(); await shot("zen-map-world1");
  await p.evaluate(() => { const bn = Array.from(document.querySelectorAll("#jr .bn"))[1], sc = document.getElementById("jr"); const r = bn.getBoundingClientRect(), q = sc.getBoundingClientRect(); sc.scrollTop += r.top - q.top - q.height * 0.55; }); await sheetsIn(); await shot("zen-map-join");
  await p.evaluate(() => { document.getElementById("jr").scrollTop = 0; }); await sheetsIn(); await shot("zen-map-top");
  await go(true);
  const win = await p.evaluate(() => { SP.zenTo(2, 4); const id = "g-w-poppy-field-giverny"; SP.load(id); const o = SP.winOrder() || ""; for (const ch of o) { SP.play(+ch); SP.settle(); } SP.tick(12000); return { panel: SP.state().panel, title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent }; });
  notes.push(tag + " win: " + JSON.stringify(win)); await shot("zen-win");
  const fail = await p.evaluate(() => { const id = "e9-203", pl = SP.lossPlan(id); SP.load(id); for (const ch of (pl && pl.prefix) || "") { SP.play(+ch); SP.settle(); } SP.tick(12000); return { panel: SP.state().panel, title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent }; });
  notes.push(tag + " fail: " + JSON.stringify(fail)); await shot("zen-fail");
  await go(false); await shot("home-zen-lit");
  await p.click("#btn-settings"); await p.click("#set-reset"); await p.click('#rs-mode [data-mode="all"]'); await shot("reset-all");
  await ctx.close();
}
await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n") + "\nconsole messages: " + log.length); for (const l of log.slice(0, 10)) console.log("  " + l);
