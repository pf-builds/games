// Sapper's Path v6 fix pass (Peter's desktop playtest): the journey map's side cards (#jr-realm, #jr-next) and the home
// across window sizes. Widths 700-1700 in 50 px steps at heights 720, 900 and 1300 (DPR 1, no touch), the window resized
// in place as a player drags it. At each size, in both modes: each side card hidden or whole inside the window and clear
// of the map column (#jr); the map's top bar as wide as the window; Play (#map-play) shown and hittable; the home filling
// the window with both mode cards hittable. A contact sheet per height goes to tools/shots-zen/sweep/ (gitignored).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/sweep-map.mjs [--url http://127.0.0.1:8495/sappers-path/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8495/sappers-path/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-zen", "sweep"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], bad = [], rows = [];
const WS = []; for (let w = 700; w <= 1700; w += 50) WS.push(w);
for (const h of [720, 900, 1300]) {
  const ctx = await b.newContext({ viewport: { width: WS[0], height: h }, deviceScaleFactor: 1 }), p = await ctx.newPage();
  await ctx.addInitScript(() => { try { localStorage.setItem("sappers-path.tour.v1", "1"); } catch (e) { /* no storage */ } });
  p.on("console", (m) => log.push(h + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(h + " pageerror: " + e.message));
  await p.goto(URL_); await p.waitForFunction(() => document.fonts.status === "loaded" && document.getElementById("play-lab").textContent !== "Play", null, { timeout: 20000 });
  const shots = [];
  for (const w of WS) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(120);
    for (const mode of ["campaign", "zen"]) {
      const r = await p.evaluate((mode) => {
        const $ = (id) => document.getElementById(id), hit = (el) => { const q = el.getBoundingClientRect(); if (!(q.width > 0 && q.height > 0)) return false; const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!t && (t === el || el.contains(t)); };
        // the home: fills the window, both cards hittable
        if (!$("title").hidden || true) { const ev = new Event("click"); }
        $("tab-home").click(); const ti = $("title").getBoundingClientRect(), home = Math.abs(ti.width - innerWidth) < 1 && Math.abs(ti.height - innerHeight) < 1 && hit($("btn-play")) && ($("btn-zen").hidden || hit($("btn-zen")));
        $("btn-tomap").click(); const c = document.querySelector('#map-mode [data-mode="' + mode + '"]'); if (c && c.getAttribute("aria-pressed") !== "true") c.click();
        const j = $("jr").getBoundingClientRect(), top = document.querySelector("#map .map-top").getBoundingClientRect(), out = { mode, cards: $("map").classList.contains("cards"), top: Math.round(top.width), w: innerWidth, h: innerHeight, home, fails: [] };
        for (const id of ["jr-realm", "jr-next"]) { const el = $(id), cs = getComputedStyle(el), q = el.getBoundingClientRect(), shown = cs.display !== "none" && cs.visibility !== "hidden" && q.width > 0 && q.height > 0;
          if (!shown || (id === "jr-next" && !out.cards)) continue; // the foot bar (one column) is #jr-next too: checked as the Play bar below
          if (q.left < -0.5 || q.top < -0.5 || q.right > innerWidth + 0.5 || q.bottom > innerHeight + 0.5) out.fails.push(id + " outside the window " + [q.left, q.top, q.right, q.bottom].map(Math.round));
          if (q.right > j.left + 0.5 && q.left < j.right - 0.5 && q.bottom > j.top + 0.5 && q.top < j.bottom - 0.5) out.fails.push(id + " over the map"); }
        if (Math.abs(top.width - innerWidth) > 1) out.fails.push("top bar " + Math.round(top.width) + " of " + innerWidth);
        const mp = $("map-play"); if (!(hit(mp) || !$("jr-end").hidden)) out.fails.push("Play not hittable");
        if (!home) out.fails.push("home not filling the window or a card not hittable");
        return out; }, mode);
      rows.push(r); for (const f of r.fails) bad.push(h + "x" + w + " " + mode + ": " + f);
      if (mode === "campaign") shots.push(await p.screenshot({ type: "jpeg", quality: 55 }));
    }
  }
  // a contact sheet per height: each size's campaign map scaled to 240 px wide, labelled by width
  await p.setViewportSize({ width: 1800, height: 1000 });
  await p.setContent("<body style='margin:0;background:#222;font:12px sans-serif;color:#fff'><div id=g style='display:flex;flex-wrap:wrap;gap:6px;padding:6px'></div></body>");
  await p.evaluate(([imgs, ws, h]) => { const g = document.getElementById("g"); imgs.forEach((src, i) => { const d = document.createElement("div"), im = new Image(); im.src = "data:image/jpeg;base64," + src; im.style.width = "240px"; d.append(ws[i] + "x" + h, document.createElement("br"), im); g.append(d); }); }, [shots.map((s) => s.toString("base64")), WS, h]);
  await p.waitForTimeout(500); await p.screenshot({ path: OUT + "/sweep-" + h + ".png", fullPage: true });
  await ctx.close();
}
await b.close();
const on = rows.filter((r) => r.cards), sum = { sizes: rows.length / 2, checks: rows.length, cardsFrom: on.length ? Math.min(...on.map((r) => r.w)) : null, fails: bad.length, console: log.length };
writeFileSync(OUT + "/sweep.json", JSON.stringify({ sum, rows, bad, log }, null, 1));
console.log(JSON.stringify(sum)); for (const x of bad.slice(0, 20)) console.log("  FAIL " + x); for (const l of log.slice(0, 10)) console.log("  " + l);
process.exitCode = bad.length || log.length ? 1 : 0;
