// Critic (space v7, functional): saves made on the base page (a11e9bf, 8482) read on the new page (8481).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
import { readFileSync, writeFileSync } from "node:fs";
const FX = JSON.parse(readFileSync(new URL("../fixtures/v6.2-save.json", import.meta.url)));
const BASE = "http://127.0.0.1:8482/", NEW = "http://127.0.0.1:8481/";
const B = await chromium.launch(), msgs = [], res_scr = [];
async function page(url, ls, vp = [375, 812]) {
  const ctx = await B.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript((ls) => { if (sessionStorage.getItem("crit.seeded")) return; sessionStorage.setItem("crit.seeded", "1"); localStorage.clear(); for (const k of Object.keys(ls)) localStorage.setItem(k, ls[k]); }, ls);
  const p = await ctx.newPage(), tag = url === NEW ? "new" : "base";
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") msgs.push(tag + " " + m.type() + ": " + m.text()); });
  p.on("pageerror", (e) => msgs.push(tag + " pageerror: " + e.message));
  p.on("response", (r) => { if (r.status() >= 400) msgs.push(tag + " HTTP " + r.status() + " " + r.url()); });
  await p.goto(url + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 30000 }); await p.waitForTimeout(600); res_scr.push(tag + ":" + await p.evaluate(() => SP.state().screen + "/" + (document.querySelector(".tut, #tour, [class*=tour]:not([hidden])") ? "tour?" : "")));
  return { ctx, p };
}
const dump = (p) => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!/probe/.test(k)) o[k] = localStorage.getItem(k); } return o; });
// Everything the home, the settings, the two maps and the two cards' first taps show.
async function read(p) {
  const r = await p.evaluate(() => {
    const t = (id) => { const e = document.getElementById(id); return e ? e.textContent + "|" + (e.getAttribute("aria-label") || "") + "|" + e.className + "|" + (e.hidden ? "H" : "") : null; };
    const tog = [...document.querySelectorAll(".tog")].map((b) => b.className + ":" + (b.getAttribute("aria-pressed") || "") + ":" + (b.getAttribute("aria-label") || ""));
    return { home: ["home-prog", "home-coins", "home-lives", "home-era", "btn-play", "btn-zen", "home-camp-w", "home-camp", "home-zen-w", "home-zen", "play-lab", "zen-lab"].map(t), tog, code: SP.code(), mode: SP.mode() };
  });
  const maps = {};
  for (const m of ["zen", "campaign"]) {
    maps[m] = await p.evaluate(async (m) => {
      const card = document.getElementById(m === "zen" ? "btn-zen" : "btn-play"); card.click();
      for (let i = 0; i < 100 && SP.state().screen !== "play"; i++) await new Promise((r) => setTimeout(r, 50));
      const s = SP.state(), first = { screen: s.screen, id: s.id, n: s.n, num: document.getElementById("lvl-num").textContent, name: document.getElementById("lvl-name").textContent, mode: SP.mode() };
      SP.screen("map"); await new Promise((r) => setTimeout(r, 300)); const jr = document.getElementById("jr"), mp = SP.map();
      const nodes = [...jr.querySelectorAll("button")].map((b) => (b.className + "/" + (b.getAttribute("aria-label") || "") + "/" + b.textContent.trim() + "/" + (b.hidden ? "H" : "") + "/" + b.style.left + "," + b.style.top)).join("\n");
      SP.screen("title"); return { first, map: mp, nodes: nodes.length, nodesHash: [...nodes].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7), nodesSample: nodes.slice(0, 200) };
    }, m);
  }
  return Object.assign(r, { maps });
}
const res = {};
// 1. Build a richer save on the BASE page from the v6.2 fixture: more wins in both modes, a speed change, Zen played last.
const seed = { "sappers-path.v3": FX.campaign, "sappers-path.zen.v1": FX.zen };
{ const { ctx, p } = await page(BASE, seed);
  await p.evaluate(async () => {
    const win = async (id) => { let s = SP.load(id); if (s && s.then) await s; const o = SP.winOrder(); for (const c of o) { if (SP.state().status !== "playing") break; SP.play(c.charCodeAt(0) - 48); SP.settle(); } SP.tick(9000); return SP.state().status; };
    window.__w = [await win(38), await win(39), await win("z3-8"), await win("z4-4"), await win("z1-13")];
    SP.screen("title"); document.getElementById("btn-settings").click(); const sp = [...document.querySelectorAll(".set-row.tog-speed")].find((b) => b.offsetParent); if (sp) sp.click(); SP.screen("title");
  });
  res.baseWins = await p.evaluate(() => window.__w);
  res.saveLS = await dump(p); await ctx.close(); }
// 2. Read that storage on both builds (fresh contexts, same storage), at a phone and a desktop size.
for (const vp of [[375, 812], [1280, 800]]) {
  const a = await page(BASE, res.saveLS, vp), n = await page(NEW, res.saveLS, vp);
  const ra = await read(a.p), rn = await read(n.p), la = await dump(a.p), ln = await dump(n.p);
  res["read" + vp[0]] = { same: JSON.stringify(ra) === JSON.stringify(rn), a: ra, n: rn, lsSame: JSON.stringify(la) === JSON.stringify(ln), untouched: JSON.stringify(ln) === JSON.stringify(Object.assign({}, res.saveLS, ln)) && Object.keys(res.saveLS).every((k) => ln[k] === res.saveLS[k]) };
  await a.ctx.close(); await n.ctx.close();
}
// 3. Codes through Settings > Load: the base page's SP2 code of the save, an SP1 (v5-era places) code of its Campaign half.
const codes = {};
{ const { ctx, p } = await page(BASE, res.saveLS);
  codes.sp2 = await p.evaluate(() => SP.code());
  codes.sp1 = await p.evaluate(async () => { const P = (await (await fetch("levels/places.json")).json()).places.slice(0, 72), d = JSON.parse(localStorage.getItem("sappers-path.v3")); return window.SappersPath.save.encode(d, P); });
  await ctx.close(); }
async function loadCode(url, code) {
  const { ctx, p } = await page(url, {});
  const out = await p.evaluate(async (code) => {
    document.getElementById("btn-settings").click(); const btn = document.getElementById("set-load"); btn.click();
    const ta = document.getElementById("ls-code"); ta.value = code; ta.dispatchEvent(new Event("input", { bubbles: true }));
    const msg = document.getElementById("ls-msg").textContent, dis = document.getElementById("ls-apply").disabled, warn = document.getElementById("ls-warn").textContent;
    document.getElementById("ls-apply").click(); await new Promise((r) => setTimeout(r, 400)); return { msg, dis, warn };
  }, code);
  out.read = await read(p); out.ls = await dump(p); await ctx.close(); return out;
}
for (const k of ["sp2", "sp1"]) { const a = await loadCode(BASE, codes[k]), n = await loadCode(NEW, codes[k]); res[k] = { code: codes[k].slice(0, 40) + "...", len: codes[k].length, same: JSON.stringify(a) === JSON.stringify(n), a: { msg: a.msg, dis: a.dis, code: a.read.code.slice(0, 30) }, n: { msg: n.msg, dis: n.dis, code: n.read.code.slice(0, 30) }, readSame: JSON.stringify(a.read) === JSON.stringify(n.read), lsSame: JSON.stringify(a.ls) === JSON.stringify(n.ls) }; }
// 4. A v5-style (pre-Zen) storage: the Campaign key only.
{ const ls = { "sappers-path.v3": FX.campaign }, a = await page(BASE, ls), n = await page(NEW, ls);
  const ra = await read(a.p), rn = await read(n.p), la = await dump(a.p), ln = await dump(n.p);
  res.v5 = { same: JSON.stringify(ra) === JSON.stringify(rn), lsSame: JSON.stringify(la) === JSON.stringify(ln), zenFirstA: ra.maps.zen.first, zenFirstN: rn.maps.zen.first };
  await a.ctx.close(); await n.ctx.close(); }
res.msgs = msgs; res.scr = res_scr;
writeFileSync(new URL("./saves-out.json", import.meta.url), JSON.stringify(res, null, 1));
const brief = JSON.parse(JSON.stringify(res)); for (const k of ["read375", "read1280"]) if (brief[k]) { if (brief[k].same) { brief[k].a = brief[k].a.home.slice(0, 3); delete brief[k].n; } }
delete brief.saveLS; console.log(JSON.stringify(brief, null, 0).slice(0, 4000));
await B.close();
