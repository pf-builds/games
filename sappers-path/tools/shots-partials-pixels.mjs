// Sapper's Path, Partial's Pixels (tools/partials-pixels-notes.md): the mode played for real in a browser, with screenshots
// in tools/shots-partials-pixels/ (gitignored) at a 375x812 phone (3x, touch) and a 1280x800 desktop. Per size, on a fresh
// save: the home with the mode locked; Campaign levels won to its openAfter and the home with it open; its map; the
// Lighthouse at its start (the whole picture) and mid-play, played with real taps on the squad cards (the board settled
// between taps, the patient player); the win sheet; back to the map; the map's foot (its credit line); a reload keeps the
// progress; then a Zen level and a Campaign level still play to a win. Every console message counts as a failure.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-partials-pixels.mjs [--url http://127.0.0.1:8731/]
import fs from "fs"; import path from "path";
const HERE = path.dirname(new URL(import.meta.url).pathname), OUT = path.join(HERE, "shots-partials-pixels");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; }, URL_ = arg("url", "http://127.0.0.1:8731/");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], res = []; fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { res.push((c ? "ok    " : "FAIL  ") + m); return c; };
for (const [w, h, dpr, touch] of [[375, 812, 3, true], [1280, 800, 1, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h, shot = (n) => p.screenshot({ path: path.join(OUT, n + "-" + w + ".png") });
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.addInitScript(() => { try { localStorage.setItem("sappers-path.tut.v1", "1"); } catch (e) { /* no tour flag */ } });
  const boot = async () => { await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 20000 }); await p.waitForTimeout(600); };
  await boot();
  const card = async () => p.evaluate(() => { const b = document.getElementById("btn-pixels"); return { hidden: b.hidden, locked: b.classList.contains("locked"), text: b.textContent.replace(/\s+/g, " ").trim() }; });
  const c0 = await card(); await shot("home-locked");
  await p.click("#btn-pixels", { force: true }); await p.waitForTimeout(300); const stay = await p.evaluate(() => SP.mode() === "campaign" && SP.state().screen === "title");
  ok(!c0.hidden && c0.locked && stay, tag + " home: three cards, Partial's Pixels locked ('" + c0.text + "'), a tap stays home");
  const n = await p.evaluate(() => SP.unlockTo(5)); await p.evaluate(() => SP.screen("title")); await p.waitForTimeout(300);
  const c1 = await card(); await shot("home-open"); ok(!c1.locked && /Picture 1/.test(c1.text), tag + " home: after " + n + " Campaign levels won, Partial's Pixels opens ('" + c1.text + "')");
  // Its map, from the map chip.
  await p.click("#btn-tomap"); await p.waitForTimeout(400); await p.click('#map-mode [data-mode="pixels"]'); await p.waitForTimeout(1200);
  const m1 = await p.evaluate(() => ({ mode: SP.mode(), map: SP.map(), play: document.querySelector("#map-play .pl").textContent }));
  await shot("map"); ok(m1.mode === "pixels" && m1.map.sheets >= 1 && /picture 1/i.test(m1.play), tag + " map: the Partial's Pixels map (" + m1.map.sheets + " sheet), Play reads '" + m1.play + "'");
  // The Lighthouse: real taps on the front cards in the stored winning order.
  await p.click("#map-play"); await p.waitForFunction(() => SP.state().screen === "play" && SP.state().id === "p1-1", null, { timeout: 10000 }); await p.waitForTimeout(700);
  const art = await p.evaluate(() => SP.cells()); await shot("level-start");
  ok(art && art.cells.length === 1600, tag + " level: the Lighthouse at its start, the whole picture (" + (art ? art.w + "x" + art.h : "-") + ")");
  const order = await p.evaluate(() => SP.winOrder());
  for (let i = 0; i < order.length; i++) {
    const col = order.charCodeAt(i) - 48; await p.click('#tray .tile.card[data-col="' + col + '"]'); await p.evaluate(() => SP.settle());
    if (i === Math.floor(order.length / 2)) { await p.evaluate(() => SP.tick(400)); await shot("mid-play"); }
  }
  await p.evaluate(() => SP.tick(12000)); await p.waitForFunction(() => !document.getElementById("panel").hidden, null, { timeout: 15000 }); await p.waitForTimeout(500);
  const win = await p.evaluate(() => ({ t: document.getElementById("p-title").textContent, l: document.getElementById("p-line").textContent }));
  await shot("win"); ok(win.t === "Picture done" && win.l.indexOf("Lighthouse by PartialVoid") === 0, tag + " win: '" + win.t + "', '" + win.l + "'");
  await p.click("#p-primary"); await p.waitForTimeout(1200);
  const m2 = await p.evaluate(() => ({ screen: SP.state().screen, mode: SP.mode(), done: document.querySelector('#jr .mn[data-n="1"]').dataset.st }));
  ok(m2.screen === "map" && m2.mode === "pixels" && m2.done === "done", tag + " back to the map: picture 1 cleared");
  await p.evaluate(() => { const c = document.getElementById("map-credits"); c.scrollIntoView({ block: "center" }); }); await p.waitForTimeout(500);
  const cred = await p.evaluate(() => document.getElementById("map-credits").textContent); await shot("credits");
  ok(cred === "Pixel art by PartialVoid, used with the artist's permission.", tag + " credits: the map's foot reads '" + cred + "'");
  // A reload keeps it.
  await boot(); const c2 = await card(); ok(/1 of 1 pictures/.test(c2.text) && /Continue/.test(c2.text) && (await p.evaluate(() => SP.mode())) === "pixels", tag + " reload: the card reads '" + c2.text + "' and Partial's Pixels is still the mode played last");
  await shot("home-after");
  // Zen and the Campaign still play.
  const other = await p.evaluate(async () => { const r = {}; for (const [m, id] of [["zen", "z1-1"], ["campaign", "e1-01"]]) { await SP.load(id); const o = SP.winOrder(); for (const c of o) { SP.play(c.charCodeAt(0) - 48); SP.settle(); } SP.tick(12000); r[m] = SP.mode() + " " + SP.state().status + " " + (document.getElementById("p-title").textContent); } return r; });
  ok(/^zen won Picture done/.test(other.zen) && /^campaign won Fort razed!/.test(other.campaign), tag + " Zen and Campaign still play: " + JSON.stringify(other));
  await ctx.close();
}
await b.close();
for (const r of res) console.log(r);
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = res.some((r) => r.startsWith("FAIL")) || log.length ? 1 : 0;
