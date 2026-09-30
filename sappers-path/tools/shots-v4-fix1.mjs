#!/usr/bin/env node
// Sapper's Path v4 Critics 1 fix pass: the AFTER screens for every blocking and major finding of the visual critic
// (tools/critic-v4-1-visual.md) and the measurements behind tools/v4-critic1-fix-notes.md. The BEFORE screens are the
// critic's own captures, copied to tools/shots-v4-fix1/before/. Viewports as the critic's: 375x812 (dpr 3, touch),
// 1280x720, 812x375 (dpr 3, touch) and the 400x600 iframe host (tools/iframe-host.html, dpr 2).
//   PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs ~/.local/opt/node/bin/node tools/shots-v4-fix1.mjs [--url http://127.0.0.1:8491/sappers-path/] [--only 375,1280,812,400,measure]
// Writes tools/shots-v4-fix1/after/*.png and tools/shots-v4-fix1/measure.json. Read-only on the game (debug facade).
// Every page.evaluate is short; the whole run has a wall budget.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v4-fix1", "after"), ONLY = arg("only", "375,1280,812,400,measure").split(",");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], M = {};
const wall = setTimeout(() => { console.error("out of time"); process.exit(2); }, 560000);

async function ready(T) { await T.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 20000 }); }
function listen(page, tag) {
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
}
async function openPage(tag, w, h, dpr, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); listen(page, tag);
  await page.goto(BASE + "?debug=1", { waitUntil: "load" }); await ready(page);
  return { tag, ctx, page, T: page, clip: null };
}
async function openIframe(tag) {
  const ctx = await browser.newContext({ viewport: { width: 460, height: 700 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); listen(page, tag);
  await page.goto(BASE + "tools/iframe-host.html", { waitUntil: "load" });
  let fr = null; for (let i = 0; i < 100 && !fr; i++) { fr = page.frames().find((f) => f.url().includes("?debug=1")); if (!fr) await page.waitForTimeout(100); }
  await ready(fr); const clip = await page.locator("#game").boundingBox();
  return { tag, ctx, page, T: fr, clip };
}
const ev = (V, fn, a) => V.T.evaluate(fn, a);
async function shot(V, name, fn, a, wait = 260) {
  try { const got = fn ? await ev(V, fn, a) : null; await V.page.waitForTimeout(wait); (M.shots = M.shots || {})[V.tag + "-" + name] = got; await V.page.screenshot({ path: resolve(OUT, V.tag + "-" + name + ".png"), clip: V.clip || undefined }); }
  catch (e) { log.push(V.tag + " " + name + " failed: " + ((e && e.message) || e)); }
}

// ---- in-page helpers (serialised into the page) ----
const rest = (n) => { SP.speed(1); const st = SP.load(n, "normal"); SP.tick(40); return { id: st.id, cs: st.cs, coach: SP.coach() }; };
const toScreen = (nm) => { SP.screen(nm); scrollTo(0, 0); return nm; };
const toEra4 = () => { SP.screen("map"); const s = document.querySelectorAll(".era"); const e4 = s[s.length - 1]; e4.scrollIntoView({ block: "start" }); return e4.querySelector("h3").textContent; };
const linkedLeave = (ms) => { SP.speed(1); SP.load("v4-linked", "normal"); SP.tick(40); const b = document.querySelector(".tile.card.linked"); const j = b ? +b.dataset.col : -1; const ok = j >= 0 && SP.play(j); SP.tick(ms); return { j, ok, line: SP.state().line }; };
const linkedStuck = () => { SP.speed(1); SP.load("v4-linked", "normal"); SP.tick(40); const b = document.querySelector(".tile.card.linked"); SP.play(+b.dataset.col); SP.tick(350); SP.settle(); return { line: SP.state().line, li: SP.state().li }; };
const easyFull = (n) => { SP.speed(1); SP.load(n, "easy"); SP.tick(40); const f = SP.fill(); SP.tick(420); return { taps: f.taps, cap: SP.state().cap, tight: document.getElementById("line").classList.contains("tight") }; };
const stage = (a) => { SP.speed(1); const st = SP.stage(a[0], a[1], a[2]); if (st) SP.tick(a[3] || 400); return st ? { id: st.id, taps: st.taps, li: SP.state().li } : null; };
const jam = (n) => { SP.speed(1); const st = SP.load(n, "normal"); const p = SP.lossPlan(st.id, "normal"); if (!p) return null; SP.load(st.id, "normal"); for (const ch of p.prefix) { SP.play(+ch); SP.settle(); } SP.tick(2500); return { id: st.id, prefix: p.prefix, panel: SP.state().panel, text: document.getElementById("p-line").textContent, aria: document.getElementById("p-line").getAttribute("aria-label") }; };
const linkJam = () => { SP.speed(1); SP.fixture("linkJamLevel", "normal"); for (const ch of "2301") { SP.play(+ch); SP.settle(); } SP.tick(2500); return { panel: SP.state().panel, text: document.getElementById("p-line").textContent, aria: document.getElementById("p-line").getAttribute("aria-label") }; };
const win = (n) => { SP.speed(1); SP.load(n, "normal"); const o = SP.winOrder("normal"); for (const ch of o) { SP.play(+ch); SP.settle(); } SP.tick(2500); return { panel: SP.state().panel }; };
const midLevel = (a) => { SP.speed(1); SP.load(a[0], "normal"); const o = SP.winOrder("normal"); for (let i = 0; i < a[1] && i < o.length; i++) { SP.play(+o[i]); SP.settle(); } SP.tick(300); return { plays: SP.state().plays }; };
const archerHit = () => { SP.speed(1); SP.load(52, "normal"); SP.tick(40); const o = "00432"; for (let i = 0; i < o.length - 1; i++) { SP.play(+o[i]); SP.settle(); } SP.play(+o[o.length - 1]);
  for (let t = 0; t < 8000; t += 16) { SP.tick(16); const h = SP.hits(); if (h.struck) { SP.tick(120); return { t, hits: SP.state().hits, h: SP.hits() }; } } return { hits: SP.state().hits }; };
const lockCrop = async () => { SP.speed(1); SP.load("v4-locked", "normal"); SP.tick(40); const lv = await (await fetch("levels/debug-v4.json")).json(); const L = lv.levels.find((l) => l.id === "v4-locked"), k = L.lock.key;
  const c = document.getElementById("board"), b = c.getBoundingClientRect(), cs = (SP.state().cs * b.width) / c.width; return { x: b.left + (k[0] - 4) * cs, y: b.top + (k[1] - 4) * cs, width: 9 * cs, height: 9 * cs }; };

// Measurements (in the page): the coach against the board, the arrow against every count and the line head, the rail
// against the board on desktop, the sheet against the line, and the rod scan along stored orders.
function measure(kind, arg) {
  const R = (el) => el.getBoundingClientRect(), over = (a, b) => { const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return x > 0.5 && y > 0.5 ? [Math.round(x), Math.round(y)] : 0; };
  const glyph = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const shown = (el) => { if (!el) return false; const c = getComputedStyle(el), r = el.getBoundingClientRect(); return c.display !== "none" && c.visibility !== "hidden" && r.width > 0 && r.height > 0; };
  if (kind === "coach") {
    const out = [];
    for (const n of arg) { SP.speed(1); SP.load(n, "normal"); SP.tick(40); const co = document.getElementById("coach"), bd = document.getElementById("board"), cst = SP.coach();
      const r = { n, mode: cst.mode, lines: cst.oneLine ? 1 : 2, fits: cst.fits, cs: +(SP.state().cs / devicePixelRatio).toFixed(2), coachOverBoard: co.hidden ? "hidden" : over(R(co), R(bd)), hand: cst.kind };
      const hd = document.getElementById("hand");
      if (!hd.hidden) { const q = R(hd), bob = parseFloat(getComputedStyle(hd).getPropertyValue("--bob")) || 0, side = /rotate/.test(hd.style.transform), k = side ? 0.56 : 1, left = /rotate\(-90/.test(hd.style.transform), right = /rotate\(90/.test(hd.style.transform);
        const box = { left: q.left - (left ? bob * k : 0), right: q.right + (right ? bob * k : 0), top: q.top - (side ? 0 : bob), bottom: q.bottom };
        const hitTxt = []; for (const el of document.querySelectorAll("#tray .tile .n, #line .slot b, #line-lab, #line-cnt")) { if (!el.textContent || !shown(el)) continue; const o = over(box, glyph(el)); if (o) hitTxt.push(el.textContent + ":" + o.join("x")); }
        r.handOverText = hitTxt; }
      out.push(r); }
    return out;
  }
  if (kind === "desk") {
    SP.load(arg, "normal"); SP.tick(40); const bd = R(document.getElementById("frame")), sd = R(document.getElementById("side")), vw = innerWidth, vh = innerHeight, pw = R(document.getElementById("powers"));
    return { frame: [bd.left, bd.top, bd.width, bd.height].map(Math.round), side: [sd.left, sd.top, sd.width, sd.height].map(Math.round), topAligned: Math.round(sd.top - bd.top), bottomAligned: Math.round(sd.bottom - bd.bottom),
      coverPct: Math.round((100 * (bd.width * bd.height + sd.width * sd.height)) / (vw * vh)), leftGap: Math.round(bd.left), rightGap: Math.round(vw - sd.right), powers: [pw.top, pw.height].map(Math.round), powerButtons: document.querySelectorAll("#powers button").length };
  }
  if (kind === "sheet") {
    const p = R(document.getElementById("panel")), l = R(document.getElementById("line"));
    return { panel: document.getElementById("panel").hidden ? "hidden" : [Math.round(p.top), Math.round(p.bottom)], line: [Math.round(l.top), Math.round(l.bottom)], slices: !document.getElementById("panel").hidden && p.top > l.top + 0.5 && p.top < l.bottom - 0.5, cls: document.getElementById("panel").className };
  }
  if (kind === "slots") {
    const res = [];
    for (const s of document.querySelectorAll("#line .slot")) { if (s.hidden || !s.classList.contains("full")) continue; const b = s.querySelector("b"); if (!b.textContent) continue; const g = glyph(b), r = { count: b.textContent, cls: s.className.replace("slot ", ""), w: Math.round(R(s).width) };
      for (const sel of [".lk", ".out", ".men"]) { const el = s.querySelector(sel); if (shown(el)) r[sel.slice(1)] = over(g, R(el)); }
      if (s.classList.contains("stuck")) { const cs = getComputedStyle(s), q = R(s), bd = parseFloat(cs.getPropertyValue("--bd")), x = q.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), y = q.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop); r.lock = over(g, { left: x, top: y, right: x + bd, bottom: y + bd }); }
      res.push(r); }
    return res;
  }
  if (kind === "tiles") { // the chain badge and the mystery "?" against their tile's count
    const res = [];
    for (const t of document.querySelectorAll("#tray .tile")) { if (!shown(t)) continue; const n = t.querySelector(".n"), ch = t.querySelector(".ch"); if (!n.textContent || !shown(ch)) continue; res.push({ count: n.textContent, over: over(glyph(n), R(ch)) }); }
    return res;
  }
  if (kind === "rods") {
    const res = [];
    const T = () => { const o = []; for (const el of document.querySelectorAll("#tray .tile")) if (shown(el) && !el.classList.contains("empty")) o.push(R(el)); return o; };
    const inT = (x, y, b, e) => x > b.left + e && x < b.right - e && y > b.top + e && y < b.bottom - e;
    for (const n of arg) {
      const st = SP.load(n, "normal"); if (!st.links) continue; SP.tick(20); const o = SP.winOrder("normal") || ""; let worst = null, rods = 0, steps = 0, onBoth = 0;
      for (let i = 0; i <= o.length; i++) {
        const svg = document.querySelector("#tray svg.rods"), sb = R(svg), tl = T();
        for (const g of svg.querySelectorAll("path")) { const L = g.getTotalLength(); if (L < 4) continue; rods++;
          const at = (u) => { const p = g.getPointAtLength(L * u); return [sb.left + p.x, sb.top + p.y]; }, e0 = at(0), e1 = at(1), own = tl.filter((b) => inT(e0[0], e0[1], b, -1) || inT(e1[0], e1[1], b, -1));
          if (own.length === 2) onBoth++;
          let third = 0; for (let k = 1; k < 32; k++) { const [x, y] = at(k / 32); if (tl.some((b) => own.indexOf(b) < 0 && inT(x, y, b, 3))) third++; }
          if (third && (!worst || third > worst.third)) worst = { step: i, third }; }
        steps++; if (i < o.length) { SP.play(+o[i]); SP.settle(); }
      }
      res.push({ n: st.id, links: st.links, rodPaths: rods, onBothTiles: onBoth, steps, crossings: worst ? worst.third : 0 });
    }
    return res;
  }
  return null;
}

async function viewport(V, full) {
  const t = V.tag;
  if (full) {
    await shot(V, "linked-leaving", linkedLeave, 350, 80);   // B1
    await shot(V, "linked-stuck", linkedStuck, null, 80);     // B1
    await shot(V, "easy-full-line", easyFull, 70, 80);         // B1: six spaces
    await shot(V, "l8-rest", rest, 8);                         // M1
    await shot(V, "l40-rest", rest, 40);                       // M1, M2
    await shot(V, "l64-rest", rest, 64);                       // M2, M7
    await shot(V, "l64-mid", midLevel, [64, 6]);               // M7: bins grown in
    await shot(V, "v4-all-rest", rest, "v4-all");             // M2, M3, m4
    await shot(V, "linked-rest", rest, "v4-linked");          // M3
    for (const n of [67, 71, 82, 89, 91]) await shot(V, "rods-l" + n, rest, n); // M3
    await shot(V, "mystery-rest", rest, "v4-mystery");        // m4
    await shot(V, "teach-l35", rest, 35);                      // M4, M5
    await shot(V, "teach-l51", rest, 51);                      // M6 (the archer lesson)
    await shot(V, "archer-hit", archerHit, null, 60);          // M6
    await shot(V, "teach-l62", rest, 62);                      // M4
    await shot(V, "teach-l76", rest, 76);                      // M4, M5
    await shot(V, "teach-l77", rest, 77);                      // M4
    await shot(V, "l88-rest", rest, 88);                       // M6
    await shot(V, "l100-boss", rest, 100);                     // M6
    await shot(V, "line-full", stage, [40, 3, 2, 500]);        // m1
    await shot(V, "jam-sheet", jam, 30, 600);                  // M8, M9
    M[t + "-jam-sheet"] = await ev(V, measure, "sheet");
    await shot(V, "linked-jam-sheet", linkJam, null, 600);     // M8
    await shot(V, "win-sheet", win, 8, 600);                   // M9
    M[t + "-win-sheet"] = await ev(V, measure, "sheet");
    await shot(V, "map-top", toScreen, "map");                 // m6
    await shot(V, "map-era4", toEra4);                         // m6
    try { const bx = await ev(V, lockCrop); await V.page.waitForTimeout(200); await V.page.screenshot({ path: resolve(OUT, t + "-crop-lockkey.png"), clip: bx }); } catch (e) { log.push(t + " crop failed " + e.message); }
    return;
  }
  await shot(V, "l40-rest", rest, 40);
  await shot(V, "l100-boss", rest, 100);
  for (const n of [35, 62, 76, 77]) await shot(V, "teach-l" + n, rest, n);
  await shot(V, "linked-leaving", linkedLeave, 350, 80);
  await shot(V, "jam-sheet", jam, 30, 600);
  M[t + "-jam-sheet"] = await ev(V, measure, "sheet");
  await shot(V, "win-sheet", win, 8, 600);
  M[t + "-win-sheet"] = await ev(V, measure, "sheet");
  await shot(V, "v4-all-rest", rest, "v4-all");
  await shot(V, "title", toScreen, "title");
}

const TEACH = [1, 2, 3, 26, 35, 51, 62, 76, 77];
try {
  if (ONLY.includes("375")) { const V = await openPage("375", 375, 812, 3, true); await viewport(V, true); await V.ctx.close(); }
  if (ONLY.includes("1280")) { const V = await openPage("1280", 1280, 720, 1, false); await viewport(V, false); M["1280-desk-l40"] = await V.T.evaluate(([f, a]) => eval("(" + f + ")")("desk", a), [measure.toString(), 40]); M["1280-desk-l100"] = await V.T.evaluate(([f, a]) => eval("(" + f + ")")("desk", a), [measure.toString(), 100]); await V.ctx.close(); }
  if (ONLY.includes("812")) { const V = await openPage("812", 812, 375, 3, true); await viewport(V, false); await V.ctx.close(); }
  if (ONLY.includes("400")) { const V = await openIframe("400"); await viewport(V, false); await V.ctx.close(); }
  if (ONLY.includes("measure")) {
    const run = async (V, kind, a) => V.T.evaluate(([f, k, x]) => eval("(" + f + ")")(k, x), [measure.toString(), kind, a]);
    for (const [tag, w, h, dpr, touch] of [["375", 375, 812, 3, true], ["1280", 1280, 720, 1, false], ["812", 812, 375, 3, true], ["400", 0, 0, 2, false]]) {
      const V = tag === "400" ? await openIframe("m400") : await openPage("m" + tag, w, h, dpr, touch);
      M[tag + "-coach"] = await run(V, "coach", TEACH);
      await V.T.evaluate(() => { SP.load("v4-linked", "normal"); SP.tick(40); const b = document.querySelector(".tile.card.linked"); SP.play(+b.dataset.col); SP.tick(350); });
      M[tag + "-slots-linked-leaving"] = await run(V, "slots"); await V.T.evaluate(() => SP.settle()); M[tag + "-slots-linked-rest"] = await run(V, "slots");
      await V.T.evaluate(() => { SP.load(70, "easy"); SP.tick(40); SP.fill(); SP.tick(420); }); M[tag + "-slots-easy-full"] = await run(V, "slots");
      await V.T.evaluate(() => { SP.load(70, "normal"); SP.tick(40); SP.fill(); SP.tick(420); }); M[tag + "-slots-normal-full"] = await run(V, "slots");
      await V.T.evaluate(() => { SP.load("v4-all", "normal"); SP.tick(40); }); M[tag + "-tiles-v4-all"] = await run(V, "tiles");
      if (tag === "375") M["375-rods"] = await run(V, "rods", Array.from({ length: 100 }, (_, i) => i + 1).concat(["v4-linked", "v4-all"]));
      if (tag === "400") M["400-rods"] = await run(V, "rods", [62, 67, 71, 77, 82, 89, 91, 100, "v4-linked", "v4-all"]);
      await V.ctx.close();
    }
  }
} catch (e) { log.push("crashed: " + ((e && e.stack) || e)); }
clearTimeout(wall); await browser.close();
M.console = log;
writeFileSync(resolve(here, "shots-v4-fix1", "measure.json"), JSON.stringify(M, null, 1));
console.log(log.length ? "LOG " + log.length + "\n" + log.join("\n") : "LOG: 0 console errors or warnings");
