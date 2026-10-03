#!/usr/bin/env node
// Sapper's Path v4.3 VISUAL critic captures + measurements (read-only on the game). PNGs + notes.json into
// tools/shots-v4.3-critic/visual/. Viewports: 375x812 (dpr 3 touch), 375x667 (dpr 2 touch), 1280x720, the 400x600 iframe.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), OUT = resolve(here, "visual"), BASE = "http://127.0.0.1:8493/sappers-path/";
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch(), log = [], notes = {};
async function open(tag, w, h, dpr, touch, iframe) {
  const ctx = await browser.newContext({ viewport: { width: iframe ? w + 60 : w, height: iframe ? h + 100 : h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); let T = page, clip;
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.type() + ": " + m.text()); }); page.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  if (iframe) { await page.goto(BASE + "tools/iframe-host.html"); for (let i = 0; i < 100; i++) { T = page.frames().find((f) => f.url().includes("?debug=1")); if (T) break; await page.waitForTimeout(100); } clip = await page.locator("#game").boundingBox(); }
  else await page.goto(BASE + "?debug=1");
  await T.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 20000 });
  return { tag, ctx, page, T, clip };
}
async function shot(V, name, fn, a, wait = 220) {
  try { const got = fn ? await V.T.evaluate(fn, a) : null; await V.page.waitForTimeout(wait); const m = await V.T.evaluate(measure); notes[V.tag + "-" + name] = { got, m };
    await V.page.screenshot({ path: resolve(OUT, V.tag + "-" + name + ".png"), clip: V.clip || undefined }); }
  catch (e) { log.push(V.tag + " " + name + " failed: " + (e && e.message || e)); }
}
function measure() {
  const vis = (el) => { if (!el || el.hidden) return false; const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const tags = Array.from(document.querySelectorAll(".tag")).filter(vis).map((t) => ({ txt: t.textContent, cls: t.className, box: r(t), font: getComputedStyle(t).fontSize, op: (() => { let o = 1, e = t; while (e) { o *= +getComputedStyle(e).opacity; e = e.parentElement; } return +o.toFixed(2); })(), parent: (t.parentElement.id || t.parentElement.className || "").toString().slice(0, 24) }));
  const st = SP.state(), out = { screen: st.screen, id: st.id, tag: st.tag, panel: st.panel, tagsN: tags.length, tagsSample: tags.slice(0, 6) };
  const clipped = []; for (const el of document.querySelectorAll("body *")) { if (!vis(el) || el.closest("svg")) continue; const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) continue; const cs = getComputedStyle(el); if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible" && !el.closest("#map") && !el.closest("#gallery")) clipped.push([el.id || el.className, el.textContent.trim().slice(0, 24)]); }
  out.clipped = clipped.slice(0, 8);
  const p = document.getElementById("panel"); if (vis(p)) { out.panelBox = r(p); out.panelText = p.textContent.replace(/\s+/g, " ").trim().slice(0, 160); }
  const t = document.getElementById("toast"); if (vis(t)) out.toast = t.textContent;
  return out;
}
const home = (n) => { if (n) SP.unlockTo(n); SP.screen("title"); return SP.state().screen; };
const mapEra = (k) => { SP.unlockTo(40); SP.screen("map"); const s = document.querySelectorAll("#eras .era:not(.dbg)"); (s[k] || s[0]).scrollIntoView({ block: "start" }); return (s[k] || s[0]).querySelector("h3").textContent; };
const rest = (n) => { SP.speed(1); const s = SP.load(n); SP.tick(40); return { n, tag: s.tag }; };
const buried = () => { SP.speed(1); SP.load("v4-all"); SP.tick(40); const cards = Array.from(document.querySelectorAll("#tray .card")), j = cards.findIndex((b) => b.classList.contains("waitpair")); const look = j >= 0 ? (() => { const c = cards[j], s = getComputedStyle(c); return { cls: c.className, aria: c.getAttribute("aria-label"), outline: s.outlineStyle + " " + s.outlineColor, border: s.borderStyle + " " + s.borderColor }; })() : null; if (j >= 0) { cards[j].click(); SP.tick(120); } return { col: j, look, toast: document.getElementById("toast").textContent }; };
const pickup = () => { SP.speed(1); let n = 27; for (; n <= 100; n++) if (SP.load(n).tag === "normal") break; const o = SP.winOrder(); SP.play(+o[0]); const s0 = SP.state();
  for (let t = 0; t < 30000; t += 16) { const s = SP.tick(16); if (s.li && s.li.occ === 0 && s.out > 0) return { n, t, out: s.out, runners: s.runners, li: s.li, head: document.getElementById("line-cnt").textContent + " | " + document.getElementById("line-lab").textContent }; } return { n, none: true }; };
const winRep = (n) => { SP.speed(1); SP.load(n); const o = SP.winOrder(); for (let i = 0; i < o.length; i++) { SP.play(+o[i]); for (let k = 0; k < 6000 && SP.state().busy; k++) SP.tick(16); } for (let i = 0; i < 4000 && !SP.state().panel; i++) SP.tick(16); SP.tick(1800); return { tag: SP.state().tag, panel: SP.state().panel }; };
const failRep = (n) => { SP.speed(1); const st = SP.load(n); const p = SP.lossPlan(st.id); if (!p) return null; SP.load(st.id); for (const c of p.prefix) { SP.play(+c); SP.settle(); } for (let i = 0; i < 1500 && !SP.state().panel; i++) SP.tick(16); SP.tick(600); return SP.state().reason; };
const gal = () => { SP.unlockGallery(); SP.clearPictures(3); SP.screen("gallery"); const t = Array.from(document.querySelectorAll("#gal-grid .gal-tile")); return t.slice(0, 6).map((x) => x.className + ":" + x.textContent.trim().slice(0, 14)); };
const settings = () => { SP.screen("title"); document.getElementById("btn-settings").click(); return Array.from(document.querySelectorAll("#settings button, .set-row, [id^=set-]")).map((e) => (e.id || e.className) + ":" + e.textContent.trim().slice(0, 24)); };
async function vp(V, full) {
  await shot(V, "home-new", home, 0); await shot(V, "home-mid", home, 40);
  await shot(V, "settings", settings); await V.T.evaluate(() => { const c = document.getElementById("set-close"); if (c) c.click(); });
  await shot(V, "map-era1", mapEra, 0); await shot(V, "map-era2", mapEra, 1);
  for (const n of [27, 28, 29]) await shot(V, "hdr-l" + n, rest, n);
  await shot(V, "linked-buried", buried, null, 60);
  await shot(V, "win-hard", winRep, 15, 400); await shot(V, "win-easy", winRep, 11, 400); await shot(V, "fail", failRep, 30, 400);
  await shot(V, "gallery", gal);
  if (!full) return;
  await shot(V, "pickup-free", pickup, null, 40);
  await shot(V, "gal-win", winRep, "g-tw-1f355", 400);
}
try {
  { const V = await open("375", 375, 812, 3, true); notes.selfTest = await V.T.evaluate(() => { const r = SP.selfTest(); return { pass: r.pass, nfail: r.fail.length, fail: r.fail.slice(0, 8) }; }); await vp(V, true);
    // pickup frames
    await V.T.evaluate(() => { SP.speed(1); let n = 27; for (; n <= 100; n++) if (SP.load(n).tag === "normal") break; const o = SP.winOrder(); SP.play(+o[0]); for (let t = 0; t < 30000; t += 16) { const s = SP.tick(16); if (s.li && s.li.occ === 0 && s.out > 0) return; } });
    for (let i = 0; i < 4; i++) { await V.page.screenshot({ path: resolve(OUT, "375-pickup-f" + i + ".png") }); await V.T.evaluate(() => SP.tick(400)); await V.page.waitForTimeout(40); }
    await V.ctx.close(); }
  { const V = await open("667", 375, 667, 2, true); await vp(V, false); await V.ctx.close(); }
  { const V = await open("1280", 1280, 720, 1, false); await vp(V, true); await V.ctx.close(); }
  { const V = await open("400", 400, 600, 2, false, true); await vp(V, false); await V.ctx.close(); }
} catch (e) { log.push("crashed: " + (e && e.stack || e)); }
await browser.close(); writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(log.length ? "LOG " + log.length + "\n" + log.join("\n") : "LOG: 0 console errors or warnings");
