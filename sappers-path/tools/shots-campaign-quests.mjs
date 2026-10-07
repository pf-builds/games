// Sapper's Path campaign v6 (lane A): the on-theme side quests in a real browser, into tools/shots-campaign-v6/ (gitignored).
// Per viewport (1280x720 desktop; 375x812 3x touch): a new save, the map at realms 1, 4 and 8 with their quest nodes (each
// side quest's node there: locked or open, its prize icon on it, the prize bubble on the open ones); then two new quests
// played from their nodes by real taps (the stored order, the page clock run on with SP.tick between taps) to the win:
// the sheet, the prize toast, the power-up added once; Back to map shows the node won. Console messages kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-campaign-quests.mjs [--url http://127.0.0.1:8511/] [--play cq06,cq12]
import { mkdirSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8511/"), OUT = resolve(here, "shots-campaign-v6"), PLAY = arg("play", "cq06,cq12").split(",").map((s) => "g-ours-" + s); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], rows = []; let bad = 0;
const check = (c, m) => { if (!c) bad++; rows.push((c ? "ok   " : "FAIL ") + m); };
for (const [w, h, dpr, touch, nm] of [[1280, 720, 1, false, "desktop"], [375, 812, 3, true, "phone"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  const tapEl = async (sel) => { const L = p.locator(sel).first(); await L.scrollIntoViewIfNeeded(); const box = await L.boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(60); };
  const shot = (k) => p.screenshot({ path: OUT + "/quests-" + nm + "-" + tag + "-" + k + ".png" });
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
  await p.evaluate(() => { localStorage.clear(); SP.screen("map"); }); await p.waitForTimeout(400);
  // The map at realms 1, 4 and 8: every quest node of the realm with its prize icon; the open ones with the bubble.
  const realm = async (to, lo, hi, k) => {
    await p.evaluate((n) => { SP.unlockTo(n); SP.screen("map"); }, to); await p.waitForTimeout(300);
    const ids = await p.evaluate(([a, z]) => SP.gallery().filter((id) => { const q = SP.quest(id); return q && q.after >= a && q.after <= z; }), [lo, hi]);
    const nodes = []; for (const id of ids) { const sel = '.qn[data-id="' + id + '"]'; await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
      nodes.push(await p.evaluate((s) => { const e = document.querySelector(s), z = e && e.querySelector(".prz"), pi = e && e.querySelector(".pi"), r = e && e.getBoundingClientRect(); return e && { id: e.dataset.id, cls: e.className, aria: e.getAttribute("aria-label"), prz: !!z && getComputedStyle(z).display !== "none" && getComputedStyle(z).visibility !== "hidden", icon: !!pi && /url\(/.test(pi.style.backgroundImage || getComputedStyle(pi).backgroundImage), w: r.width }; }, sel)); }
    await shot(k);
    const open = nodes.filter((n) => /\bopen\b/.test(n.cls)), locked = nodes.filter((n) => /\blocked\b/.test(n.cls));
    check(nodes.length >= 5 && nodes.every((n) => n && n.icon && /prize: one /.test(n.aria) && n.w >= 40) && open.every((n) => n.prz) && open.length + locked.length === nodes.length, tag + " " + k + ": " + nodes.length + " quest nodes (" + open.length + " open with the prize bubble, " + locked.length + " locked), each with its prize icon and words: " + nodes.map((n) => n.id.replace(/^g-/, "") + " '" + (n.aria.match(/prize: one (\w+)/) || [, "?"])[1] + "'").join(", "));
    return nodes; };
  await realm(14, 1, 24, "realm1"); await realm(90, 75, 99, "realm4"); await realm(200, 175, 200, "realm8");
  // Two new quests played to the win from their nodes by real taps; the prize paid once.
  await p.evaluate(() => { SP.unlockTo(200); SP.screen("map"); }); await p.waitForTimeout(300);
  for (const id of PLAY) {
    const q = await p.evaluate((i) => SP.quest(i), id);
    await tapEl('.qn[data-id="' + id + '"]'); await p.waitForTimeout(300); const inv0 = await p.evaluate((k) => SP.meta().inv[k] | 0, q.prize); // after the start (a first level past an unlock hands out the free power-ups)
    const s0 = await p.evaluate(() => Object.assign(SP.state(), { order: SP.winOrder(), name: document.getElementById("lvl-name").textContent }));
    await shot(id.replace(/^g-ours-/, "") + "-start");
    const seen = () => p.evaluate(() => { const t = document.getElementById("toast"); return t.hidden ? null : t.textContent; }), toasts = new Set(), note = (t) => { if (t) toasts.add(t); };
    for (const ch of s0.order || "") { await tapEl('button.card[data-col="' + ch + '"]'); for (let i = 0; i < 400; i++) { const r = await p.evaluate(() => { SP.tick(100); const t = document.getElementById("toast"); return { busy: SP.state().busy, t: t.hidden ? null : t.textContent }; }); note(r.t); if (!r.busy) break; } }
    for (let i = 0; i < 1500; i++) { const r = await p.evaluate(() => { SP.tick(40); const t = document.getElementById("toast"); return { panel: SP.state().panel, t: t.hidden ? null : t.textContent }; }); note(r.t); if (r.panel) break; } await p.waitForTimeout(400); note(await seen());
    const s1 = await p.evaluate((k) => ({ st: SP.state(), title: document.getElementById("p-title").textContent, inv: SP.meta().inv[k] | 0 }), q.prize); s1.toast = [...toasts].find((t) => /^Side quest prize: \+1 /.test(t)) || [...toasts].join(" | ");
    await shot(id.replace(/^g-ours-/, "") + "-win");
    check(s0.id === id && s0.screen === "play" && s1.st.status === "won" && s1.st.panel === "win" && s1.title === "Picture complete!" && s1.inv === inv0 + 1 && /^Side quest prize: \+1 /.test(s1.toast || ""), tag + " " + id + " ('" + s0.name + "', after " + q.after + "): a real tap on its node plays it; " + (s0.order || "").length + " real taps win it ('" + s1.title + "'); the prize toast '" + s1.toast + "', " + q.prize + " " + inv0 + " -> " + s1.inv);
    await tapEl("#p-primary"); await p.waitForTimeout(500);
    const back = await p.evaluate((i) => ({ screen: SP.state().screen, cls: (document.querySelector('.qn[data-id="' + i + '"]') || {}).className || "" }), id);
    await shot(id.replace(/^g-ours-/, "") + "-map");
    check(back.screen === "map" && /\bwon\b/.test(back.cls), tag + " Back to map: " + id + "'s node shows won (" + back.cls + ")");
    await tapEl('.qn[data-id="' + id + '"]'); await p.waitForTimeout(300); const order = await p.evaluate(() => SP.winOrder());
    await p.evaluate((o) => { for (const c of o) { SP.play(+c); for (let i = 0; i < 400 && SP.state().busy; i++) SP.tick(100); } for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(40); }, order);
    const again = await p.evaluate((k) => ({ panel: SP.state().panel, inv: SP.meta().inv[k] | 0 }), q.prize);
    check(again.panel === "win" && again.inv === inv0 + 1, tag + " " + id + " replayed and won again pays no second prize (" + q.prize + " " + again.inv + ")");
    await p.evaluate(() => SP.screen("map")); await p.waitForTimeout(300);
  }
  await ctx.close();
}
await b.close();
for (const r of rows) console.log(r);
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
console.log(bad ? bad + " FAILED" : "all passed"); process.exitCode = bad || log.length ? 1 : 0;
