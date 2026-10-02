#!/usr/bin/env node
// Sapper's Path v4.1 VISUAL critic's capture script (from the Critics 2 one) (read-only on the game). PNGs + notes.json into
// tools/shots-v4.1-critic/visual/. Viewports: 375x812 (dpr 3, touch), 375x667 (dpr 2, touch), 1280x720, 812x375 (dpr 3,
// touch), and the 400x600 iframe host (dpr 2).
//   PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs ~/.local/opt/node/bin/node tools/shots-v4-critic2/visual-shots.mjs [--only 375,667,1280,812,400]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("url", "http://127.0.0.1:8493/sappers-path/"), OUT = resolve(here, arg("out", "../shots-v4.1-critic/visual")), ONLY = arg("only", "375,667,1280,812,400").split(",");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("out of time"); process.exit(2); }, 580000);
const GAL = ["g-tw-1f355", "g-noto-1f431", "g-met-57007", "g-noto-1f3c6", "g-ours-g24", "g-noto-1f432"];

async function open(tag, w, h, dpr, touch, iframe) {
  const ctx = await browser.newContext({ viewport: { width: iframe ? 460 : w, height: iframe ? 700 : h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  let T = page, clip = null;
  if (iframe) { await page.goto(BASE + "tools/iframe-host.html", { waitUntil: "load" }); for (let i = 0; i < 100; i++) { T = page.frames().find((f) => f.url().includes("?debug=1")); if (T) break; await page.waitForTimeout(100); } clip = await page.locator("#game").boundingBox(); }
  else await page.goto(BASE + "?debug=1", { waitUntil: "load" });
  await T.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 20000 });
  return { tag, ctx, page, T, clip };
}
async function shot(V, name, fn, a, wait = 260) {
  try { const got = fn ? await V.T.evaluate(fn, a) : null; await V.page.waitForTimeout(wait); const m = await V.T.evaluate(measure); notes[V.tag + "-" + name] = { got, m };
    await V.page.screenshot({ path: resolve(OUT, V.tag + "-" + name + ".png"), clip: V.clip || undefined }); }
  catch (e) { log.push(V.tag + " " + name + " failed: " + (e && e.message || e)); }
}

async function strip(V, name, id, step) {
  try { await V.T.evaluate((id) => { SP.speed(1); SP.load(id, "normal"); SP.tick(40); const fr = SP.state().fronts; let j = 0, b = -1; fr.forEach((f, k) => { if (f && SP.reachable(f.mat) > b) { b = SP.reachable(f.mat); j = k; } }); SP.play(j); return j; }, id);
    const bx = await V.page.locator("#board").boundingBox();
    for (let i = 0; i < 6; i++) { await V.T.evaluate((ms) => SP.tick(ms), step); await V.page.waitForTimeout(40); await V.page.screenshot({ path: resolve(OUT, V.tag + "-" + name + "-f" + i + ".png"), clip: bx }); } }
  catch (e) { log.push(V.tag + " " + name + " strip failed: " + (e && e.message || e)); }
}
function measure() {
  const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const vis = (el) => { if (!el || el.hidden) return false; const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const st = SP.state(), out = { vw: innerWidth, vh: innerHeight, screen: st.screen, id: st.id, csCss: +(st.cs / devicePixelRatio).toFixed(2), panel: st.panel };
  const pws = Array.from(document.querySelectorAll(".pw")).filter(vis);
  if (pws.length) out.pw = pws.map((p) => { const t = p.textContent.replace(/\s+/g, " ").trim(); const ic = p.querySelector("i, img, canvas, .ic"); return { k: p.dataset.k, box: r(p), icon: ic && vis(ic) ? r(ic).slice(2) : null, text: t, cls: p.className, font: Array.from(p.querySelectorAll("*")).filter((e) => vis(e) && e.childNodes.length && Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => e.textContent.trim() + "@" + getComputedStyle(e).fontSize).join(" ") }; });
  const pb = document.getElementById("powers"); if (vis(pb)) out.powers = r(pb);
  const rows = new Set(); document.querySelectorAll("#tray .tile").forEach((t) => { if (vis(t) && !t.classList.contains("none")) rows.add(t.classList.contains("card") ? 0 : t.classList.contains("d1") ? 1 : 2); }); out.qRows = rows.size;
  const t = document.querySelector(".tile.card:not(.empty)"); if (t && vis(t)) { out.tile = r(t).slice(2); out.tileFont = getComputedStyle(t.querySelector(".n")).fontSize; }
  for (const id of ["board", "rail", "panel", "coach", "top", "side"]) { const el = document.getElementById(id); if (vis(el)) out[id] = r(el); }
  if (st.screen === "title" || st.screen === "gallery" || st.screen === "map") {
    const scr = document.getElementById(st.screen === "title" ? "title" : st.screen); const items = [];
    scr.querySelectorAll("button, h1, h2, img, canvas, .pill, [class*=pill], [id]").forEach((e) => { if (vis(e) && items.length < 40) items.push((e.id || e.className || e.tagName).toString().slice(0, 24) + ":" + r(e).join(",") + (e.textContent.trim() ? ":" + e.textContent.trim().replace(/\s+/g, " ").slice(0, 24) + "@" + getComputedStyle(e).fontSize : "")); });
    out.items = items;
  }
  const clipped = [];
  for (const el of document.querySelectorAll("body *")) { if (!vis(el) || el.closest("svg")) continue; const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
    const b = el.getBoundingClientRect(), cs = getComputedStyle(el); const over = el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible" ? "overflow" : "", off = b.left < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1 ? "offscreen" : "";
    if ((over || off) && !el.closest("#map") && !el.closest("#gallery")) clipped.push([el.id || el.className || el.tagName, el.textContent.trim().slice(0, 24), over || off]); }
  out.clipped = clipped.slice(0, 10);
  return out;
}
const home = (a) => { if (a && a.mid) { SP.unlockTo(40); SP.setMeta({ coins: 760 }); } SP.screen("title"); return SP.meta && SP.meta(); };
const rest = (n) => { SP.speed(1); const st = SP.load(n, "normal"); SP.tick(40); return { n, id: st.id, rows: SP.state().cs }; };
const inv = (a) => { SP.setMeta(a[1]); SP.load(a[0], "normal"); SP.tick(40); return SP.meta(); };
const winRep = (n) => { SP.speed(1); SP.load(n, "normal"); const o = SP.winOrder("normal"); for (let i = 0; i < o.length; i++) { SP.play(+o[i]); if (i < o.length - 1) SP.settle(); else SP.tick(400); } for (let i = 0; i < 3000 && !SP.state().panel; i++) SP.tick(16); SP.tick(1800); return SP.state().panel; };
const failRep = (n) => { SP.speed(1); const st = SP.load(n, "normal"); const p = SP.lossPlan(st.id, "normal"); if (!p) return null; SP.load(st.id, "normal"); for (const c of p.prefix) { SP.play(+c); SP.settle(); } for (let i = 0; i < 800 && !SP.state().panel; i++) SP.tick(16); SP.tick(400); return SP.state().reason; };
const galMid = (id) => { SP.speed(1); SP.load(id, "normal"); SP.tick(40); const o = SP.winOrder("normal"); const k = Math.floor(o.length / 3); for (let i = 0; i < k; i++) { SP.play(+o[i]); SP.settle(); } SP.play(+o[k]); SP.tick(900); return { k, of: o.length }; };
const mapTop = () => { SP.screen("map"); const m = document.getElementById("map"); m.scrollTop = 0; scrollTo(0, 0); return true; };
const galScreen = () => { SP.unlockGallery(); SP.screen("gallery"); return SP.state().screen; };

async function viewport(V, full) {
  await shot(V, "home-new", home, null);
  await shot(V, "home-mid", home, { mid: true });
  await shot(V, "settings", async () => { document.getElementById("btn-settings").click(); return true; });
  await V.T.evaluate(() => { const c = document.getElementById("set-close"); if (c) c.click(); });
  await shot(V, "map-top", mapTop);
  await shot(V, "l40-bar-buy", inv, [40, { coins: 760, inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 0 } }]);
  await shot(V, "l40-bar-mixed", inv, [40, { coins: 760, inv: { ladder: 2, quartermaster: 1, scout: 0, recall: 3 } }]);
  await shot(V, "l40-bar-broke", inv, [40, { coins: 10, inv: { ladder: 0, quartermaster: 0, scout: 0, recall: 0 } }]);
  await shot(V, "l100-boss", rest, 100);
  for (const n of [8, 20, 30, 64, 88]) await shot(V, "l" + n + "-rest", rest, n);
  await shot(V, "teach-l62", rest, 62);
  await shot(V, "win-report", winRep, 8, 400);
  await shot(V, "fail-report", failRep, 30, 400);
  await shot(V, "gallery", galScreen);
  for (const id of GAL.slice(0, full ? 6 : 2)) await shot(V, "gal-" + id.replace("g-", ""), rest, id);
  await shot(V, "gal-mid-pizza", galMid, "g-tw-1f355", 120);
  if (!full) return;
  for (const [nm, id, col, step] of [["l40", 40, -1, 300], ["l88", 88, -1, 300], ["pizza", "g-tw-1f355", -1, 300]]) await strip(V, "strip-" + nm, id, step);
  await shot(V, "gal-mid-fuji", galMid, "g-met-57007", 120);
  await shot(V, "gal-win", winRep, "g-tw-1f355", 400);
  await shot(V, "gallery-after-win", () => { SP.screen("gallery"); return SP.state().screen; });
  await shot(V, "gal-win-fuji", winRep, "g-met-57007", 400);
  await shot(V, "linked-rest", rest, "v4-linked");
  await shot(V, "l8-rest", rest, 8);
}
// 375x667: which levels get 2 rows, and the cell size each gets.
const rowsScan = () => { const out = []; for (let n = 1; n <= 100; n++) { const st = SP.load(n, "normal"); if (st.n !== n) continue; let rows = 0; document.querySelectorAll("#tray .tile.next").forEach((t) => { if (t.getBoundingClientRect().height && !t.classList.contains("none")) rows = Math.max(rows, t.classList.contains("d1") ? 1 : 2); }); out.push([n, +(SP.state().cs / devicePixelRatio).toFixed(2), document.querySelectorAll("#tray .col")[0].querySelectorAll(".tile").length]); } return out; };

try {
  if (ONLY.includes("375")) { const V = await open("375", 375, 812, 3, true); notes.selfTest = await V.T.evaluate(() => { const r = SP.selfTest(); return { pass: r.pass, nfail: r.fail.length, fail: r.fail.slice(0, 10), ms: Math.round(r.ms || 0) }; }); await V.T.evaluate(() => SP.screen("title")); await viewport(V, true); await V.ctx.close(); }
  if (ONLY.includes("667")) { const V = await open("667", 375, 667, 2, true); await viewport(V, true); notes.rows667 = await V.T.evaluate(rowsScan); await V.ctx.close(); }
  if (ONLY.includes("1280")) { const V = await open("1280", 1280, 720, 1, false); await viewport(V, true); await V.ctx.close(); }
  if (ONLY.includes("812")) { const V = await open("812", 812, 375, 3, true); await viewport(V, false); await V.ctx.close(); }
  if (ONLY.includes("400")) { const V = await open("400", 400, 600, 2, false, true); await viewport(V, false); await V.ctx.close(); }
} catch (e) { log.push("crashed: " + (e && e.stack || e)); }
clearTimeout(wall); await browser.close();
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(log.length ? "LOG " + log.length + "\n" + log.join("\n") : "LOG: 0 console errors or warnings");
