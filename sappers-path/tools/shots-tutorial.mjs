// Sapper's Path v6 lane B part 2 (the intro tour): phone and desktop shots into tools/shots-tutorial/ (gitignored). A
// 375x812 phone (3x, touch), a 1280x720 desktop and a 360x640 phone, each on a fresh profile: the first-launch offer,
// then every step through real clicks on the tray's cards, the power-up badges, the line's spaces and the tour's own
// buttons: each fort at its first coach line, after its first tap, its done card (fort 4: the jam's real sheet and the
// second script after Retry; fort 8: the real win sheet), the closing card, the Campaign map it opens, and Settings with
// How to play. Times each step on the game clock (the 60 seconds) and keeps the console (0 messages expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-tutorial.mjs [--url http://127.0.0.1:8498/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8498/sappers-path/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-tutorial"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
for (const [w, h, dpr, touch, nm] of [[375, 812, 3, true, "phone"], [1280, 720, 1, false, "desktop"], [360, 640, 2, true, "small"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded" && document.getElementById("tut-offer"), null, { timeout: 20000 });
  const shot = async (k) => { await p.waitForTimeout(350); await p.screenshot({ path: OUT + "/" + nm + "-" + k + ".png" }); };
  const clock = () => p.evaluate(() => SP.state().clock);
  const tap = async (col) => { const ok = await p.evaluate((j) => { const c = document.querySelectorAll("#tray .col")[j]; const t = c && c.querySelector(".card"); if (!t) return false; t.scrollIntoView({ block: "nearest" }); return true; }, col); if (ok) await p.locator("#tray .col").nth(col).locator(".card").first().click(); };
  const waitFor = async (sel, ms = 30000) => { await p.waitForFunction((s) => { const e = document.querySelector(s); return e && !e.hidden && e.getBoundingClientRect().width > 0; }, sel, { timeout: ms }); };
  const cardUp = () => waitFor("#tut-card");
  await shot("00-offer");
  await p.click("#tut-offer .tut-yes"); const t0 = await clock(); const times = [];
  const steps = await p.evaluate(async () => (await (await fetch("levels/tutorial.json")).json()).steps.map((s) => ({ id: s.id, win: s.board.win.normal, jam: s.board.jam || "", powers: s.powers || null, final: !!s.final })));
  for (let k = 0; k < steps.length; k++) {
    const st = steps[k], n = String(k + 1), s0 = await clock();
    await p.waitForFunction((id) => SP.state().id === id, st.id); await shot(n + "a-start");
    if (st.jam) { // the player's own jam: blue until the line is full, the game's sheet, Retry, the second script, the win
      for (const ch of st.jam) await tap(+ch); await waitFor("#panel"); await shot(n + "b-jam");
      notes.push(tag + " jam sheet: " + await p.evaluate(() => document.getElementById("p-title").textContent + " / " + document.getElementById("p-line").textContent + " / " + (document.querySelector(".tut-note") || {}).textContent));
      await p.click("#p-primary"); await shot(n + "c-retry");
      for (const ch of st.win) { await p.waitForFunction(() => !SP.state().busy, null, { timeout: 20000 }); await tap(+ch); }
    } else if (st.powers) { // yellow waits, the practice Recall on its space, the practice Ladder
      await tap(1); await p.waitForTimeout(500); await shot(n + "b-wait");
      await p.click('#powers .pw[data-k="3"]'); await shot(n + "c-recall-pick"); await p.locator("#line .slot.pickable").first().click(); await shot(n + "d-recalled");
      await p.click('#powers .pw[data-k="0"]'); await shot(n + "e-ladder");
    } else {
      await tap(+st.win[0]); await p.waitForTimeout(700); await shot(n + "b-tap");
      for (const ch of st.win.slice(1)) { if (await p.evaluate(() => !document.getElementById("tut-card").hidden || SP.state().status !== "playing")) break; await p.waitForFunction(() => !SP.state().busy || !document.getElementById("tut-card").hidden, null, { timeout: 20000 }); if (await p.evaluate(() => !document.getElementById("tut-card").hidden)) break; await tap(+ch); }
    }
    if (st.final) { await waitFor("#panel"); await shot(n + "z-win"); times.push(Math.round(((await clock()) - s0) / 100) / 10); await p.click("#p-primary"); }
    else { await cardUp(); await shot(n + "z-done"); times.push(Math.round(((await clock()) - s0) / 100) / 10); await p.click("#tut-card .tut-next"); }
  }
  await waitFor("#tut-close"); await shot("9-close");
  notes.push(tag + " step seconds (game clock, tap as soon as the squads are home): " + times.join(", ") + "; total " + Math.round(((await clock()) - t0) / 1000) + " s; seen flag " + await p.evaluate(() => localStorage.getItem("sappers-path.tour.v1")));
  await p.click('#tut-close .tut-mode[data-mode="campaign"]'); await p.waitForTimeout(800); await shot("9b-campaign-map");
  await p.click("#btn-home"); await p.click("#btn-settings"); await shot("10-settings");
  await ctx.close();
}
await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n") + "\nconsole messages: " + log.length); for (const l of log.slice(0, 10)) console.log("  " + l);
