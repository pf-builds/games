#!/usr/bin/env node
// Sapper's Path v4 Critics 1, VISUAL critic's capture script (read-only on the game). Writes PNGs + notes.json to
// tools/shots-v4-critic1/visual/. Viewports: 375x812 (dpr 3, touch), 1280x720 (dpr 1), 812x375 (dpr 3, touch), and the
// 400x600 iframe host (tools/iframe-host.html, dpr 2).
//   PLAYWRIGHT_MODULE=$(~/.local/opt/node/bin/npm root -g)/playwright/index.mjs ~/.local/opt/node/bin/node tools/shots-v4-critic1/visual-shots.mjs [--url http://127.0.0.1:8493/sappers-path/] [--only 375,1280,812,400,checks]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("url", "http://127.0.0.1:8493/sappers-path/"), OUT = resolve(here, arg("out", "visual")), ONLY = arg("only", "375,1280,812,400,checks").split(",");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("out of time"); process.exit(2); }, 560000);

async function ready(T) { await T.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 20000 }); }
async function openPage(tag, w, h, dpr, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await page.goto(BASE + "?debug=1", { waitUntil: "load" }); await ready(page);
  return { tag, ctx, page, T: page, clip: null };
}
async function openIframe(tag) {
  const ctx = await browser.newContext({ viewport: { width: 460, height: 700 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(tag + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await page.goto(BASE + "tools/iframe-host.html", { waitUntil: "load" });
  let fr = null; for (let i = 0; i < 100 && !fr; i++) { fr = page.frames().find((f) => f.url().includes("?debug=1")); if (!fr) await page.waitForTimeout(100); }
  await ready(fr); const clip = await page.locator("#game").boundingBox();
  return { tag, ctx, page, T: fr, clip };
}
const ev = (V, fn, a) => V.T.evaluate(fn, a);
async function snap(V, name) { await V.page.screenshot({ path: resolve(OUT, V.tag + "-" + name + ".png"), clip: V.clip || undefined }); }
async function shot(V, name, fn, a, wait = 220) {
  try {
    const got = fn ? await ev(V, fn, a) : null;
    await V.page.waitForTimeout(wait);
    const m = await ev(V, measure);
    notes[V.tag + "-" + name] = { got, m };
    await snap(V, name);
  } catch (e) { log.push(V.tag + " " + name + " failed: " + (e && e.message || e)); }
}
async function strip(V, name, prep, a, k, stepMs, clipSel) {
  try {
    await ev(V, prep, a);
    const box = clipSel ? await (V.T === V.page ? V.page : V.T).locator(clipSel).boundingBox() : null;
    let clip = box || V.clip || undefined; if (box && V.clip && V.T !== V.page) clip = { x: V.clip.x + box.x, y: V.clip.y + box.y, width: box.width, height: box.height };
    for (let i = 0; i < k; i++) { await ev(V, (ms) => SP.tick(ms), stepMs); await V.page.waitForTimeout(40); await V.page.screenshot({ path: resolve(OUT, V.tag + "-" + name + "-f" + i + ".png"), clip }); }
  } catch (e) { log.push(V.tag + " " + name + " strip failed: " + (e && e.message || e)); }
}

// ---- in-page helpers (serialised into the page) ----
function measure() {
  const vw = innerWidth, vh = innerHeight, st = SP.state(), dpr = devicePixelRatio, r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return b.width || b.height ? [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] : null; };
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0 || el.hidden) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const out = { vw, vh, screen: st.screen, id: st.id, csCss: +(st.cs / dpr).toFixed(2), open: st.open, locked: st.locked, links: st.links, hidden: st.hidden, li: st.li, status: st.status, reason: st.reason, refused: st.refused };
  for (const id of ["top", "board", "coach", "toast", "rail", "line-wrap", "line", "tray", "panel", "hand"]) { const el = document.getElementById(id); if (vis(el)) out[id] = r(el); }
  const coach = document.getElementById("coach"), board = document.getElementById("board");
  if (vis(coach) && vis(board)) { const a = coach.getBoundingClientRect(), b = board.getBoundingClientRect(); const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); out.coachOverBoard = ox > 0 && oy > 0 ? [Math.round(ox), Math.round(oy)] : 0; out.coachText = coach.textContent.trim(); out.coachFont = getComputedStyle(coach).fontSize; }
  // Clipped or off-screen text.
  const clipped = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!vis(el) || el.closest("svg")) continue; const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
    const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const over = el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible" ? "overflow" : "", off = b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1 ? "offscreen" : "";
    if (over || off) clipped.push([el.id || el.className || el.tagName, el.textContent.trim().slice(0, 30), over || off, Math.round(b.left), Math.round(b.right)]);
  }
  out.clipped = clipped.slice(0, 12);
  const t = document.querySelector(".tile.card:not(.empty)"); if (t) { out.tile = r(t); out.tileFont = getComputedStyle(t.querySelector(".n")).fontSize; }
  const s = document.querySelector("#line .slot"); if (s && vis(s)) { out.slot = r(s); const bb = s.querySelector("b"); if (bb) out.slotFont = getComputedStyle(bb).fontSize; }
  return out;
}
const rest = (n) => { SP.speed(1); const st = SP.load(n, "normal"); SP.tick(40); return { n, id: st.id }; };
const toScreen = (nm) => { SP.screen(nm); if (nm === "map") { let el = document.querySelector(".era"); while (el) { if (el.scrollHeight > el.clientHeight + 2) el.scrollTop = 0; el = el.parentElement; } scrollTo(0, 0); } return nm; };
const toEra4 = () => { SP.screen("map"); const s = document.querySelectorAll(".era"); const e4 = Array.from(s).filter((e) => /4/.test((e.querySelector("h3") || {}).textContent || "")).pop() || s[s.length - 1]; e4.scrollIntoView({ block: "start" }); return (e4.querySelector("h3") || {}).textContent; };
const setCbOn = (on) => { SP.screen("title"); const b = document.querySelector(".tog-cb"); if (b && (b.getAttribute("aria-pressed") === "true") !== on) b.click(); return SP.state().cb; };
const stage = (a) => { SP.speed(1); const st = SP.stage(a[0], a[1], a[2]); if (st) SP.tick(a[3] || 400); return st ? { id: st.id, taps: st.taps, li: SP.state().li } : null; };
const refuse = (n) => { SP.speed(1); SP.load(n, "normal"); SP.tick(40); const f = SP.fill(); SP.tick(200); const fr = SP.state().fronts; let j = fr.findIndex((x) => x); const ok = SP.play(j); SP.tick(30); return { taps: f.taps, played: ok, refused: SP.state().refused, li: SP.state().li }; };
const jam = (n) => { SP.speed(1); const st = SP.load(n, "normal"); const p = SP.lossPlan(st.id, "normal"); if (!p) return null; SP.load(st.id, "normal"); for (const ch of p.prefix) { SP.play(+ch); SP.settle(); } SP.tick(2500); return { id: st.id, prefix: p.prefix, st: SP.state().status, reason: SP.state().reason, panel: SP.state().panel }; };
const win = (n) => { SP.speed(1); SP.load(n, "normal"); const o = SP.winOrder("normal"); for (const ch of o) { SP.play(+ch); SP.settle(); } SP.tick(2500); return { st: SP.state().status, panel: SP.state().panel }; };
const marchPrep = (n) => { SP.speed(1); SP.load(n, "normal"); const o = SP.winOrder("normal"); for (let i = 0; i < o.length; i++) { SP.play(+o[i]); if (i < o.length - 1) SP.settle(); } return SP.state().march; };
const swarmPrep = (a) => { SP.speed(1); SP.load(a[0], "normal"); SP.tick(40); SP.play(a[1]); return true; };
const mysteryTap = () => { SP.speed(1); SP.load("v4-mystery", "normal"); SP.tick(40); const o = SP.winOrder("normal"); SP.play(+o[0]); SP.tick(60); return { col: +o[0], hidden: SP.state().hidden }; };
const linkedLeave = (ms) => { SP.speed(1); SP.load("v4-linked", "normal"); SP.tick(40); const b = document.querySelector(".tile.card.linked"); const j = b ? +b.dataset.col : -1; const ok = j >= 0 && SP.play(j); SP.tick(ms); return { j, ok, line: SP.state().line }; };
const unlockNow = (id) => { SP.speed(1); SP.load(id, "normal"); SP.tick(40); const o = SP.winOrder("normal"); for (const ch of o) { SP.play(+ch); for (let t = 0; t < 40000 && SP.state().busy; t += 50) { SP.tick(50); if (SP.state().locked === 0) return { at: t, taps: o.indexOf(ch), locked: 0 }; } if (SP.state().locked === 0) return { locked: 0 }; } return { locked: SP.state().locked }; };
// Key crops: a CSS-pixel box around a cell (unrotated boards only).
const cellBox = async (a) => { const [id, x, y, pad] = a; const lv = await (await fetch(id.startsWith("v4-") ? "levels/debug-v4.json" : "levels/levels.json")).json(); const L = lv.levels.find((l) => l.id === id);
  const c = document.getElementById("board"), b = c.getBoundingClientRect(), k = b.width / c.width, cs = SP.state().cs * k; return { x: b.left + (x - pad) * cs, y: b.top + (y - pad) * cs, width: (2 * pad + 1) * cs, height: (2 * pad + 1) * cs, cs, w: L.w, h: L.h }; };

async function viewport(V, full) {
  await shot(V, "title", toScreen, "title");
  await shot(V, "map-top", toScreen, "map");
  await shot(V, "map-era4", toEra4);
  for (const n of [8, 40, 64, 88]) await shot(V, "l" + n + "-rest", rest, n);
  await shot(V, "l100-boss", rest, 100);
  for (const n of [1, 35, 62, 76, 77]) await shot(V, "teach-l" + n, rest, n);
  await shot(V, "line-full", stage, [40, 3, 2, 500]);
  await shot(V, "near-jam", stage, [40, 3, 1, 500]);
  await shot(V, "refused", refuse, 40, 60);
  await shot(V, "jam-sheet", jam, 30, 600);
  await shot(V, "win-sheet", win, 8, 600);
  await shot(V, "v4-all-rest", rest, "v4-all");
  await shot(V, "linked-leaving", linkedLeave, 350, 60);
  await shot(V, "mystery-rest", rest, "v4-mystery");
  await shot(V, "easy-full-line", (n) => { SP.speed(1); SP.load(n, "easy"); SP.tick(40); const f = SP.fill(); SP.tick(300); return { taps: f.taps, li: SP.state().li, open: SP.state().open }; }, 40);
  await shot(V, "l64-mid", (n) => { SP.speed(1); SP.load(n, "normal"); const o = SP.winOrder("normal"); for (let i = 0; i < 4; i++) { SP.play(+o[i]); SP.settle(); } SP.tick(600); return o.slice(0, 4); }, 64, 500);
  await shot(V, "linked-jam", (id) => { SP.speed(1); const p = SP.lossPlan(id, "normal"); if (!p) return null; SP.load(id, "normal"); for (const ch of p.prefix) { SP.play(+ch); SP.settle(); } SP.tick(2500); return { prefix: p.prefix, reason: SP.state().reason }; }, "v4-linked", 600);
  if (!full) return;
  for (const [n, k] of [[67, 20], [71, 6], [82, 3], [89, 3], [91, 13]]) await shot(V, "rods-l" + n, (a) => { SP.speed(1); SP.load(a[0], "normal"); SP.tick(20); const o = SP.winOrder("normal"); for (let i = 0; i < a[1]; i++) { SP.play(+o[i]); SP.settle(); } SP.tick(20); return a; }, [n, k]);
  await shot(V, "teach-l51", rest, 51);
  await shot(V, "swarm-l9", (a) => { SP.speed(1); SP.load(a[0], "normal"); SP.tick(40); SP.play(a[1]); return SP.tick(900).runners; }, [9, 1]);
  await strip(V, "swarm", swarmPrep, [9, 1], 6, 250, "#board");
  await strip(V, "march", marchPrep, 8, 6, 450, null);
  await shot(V, "mystery-rest", rest, "v4-mystery");
  await shot(V, "mystery-reveal", mysteryTap, null, 120);
  await shot(V, "linked-rest", rest, "v4-linked");
  await shot(V, "linked-leaving", linkedLeave, 350, 60);
  await shot(V, "locked-before", rest, "v4-locked");
  await shot(V, "locked-after", unlockNow, "v4-locked", 80);
  await shot(V, "teach76-after-unlock", unlockNow, "e4-76", 80);
  await ev(V, setCbOn, true);
  await shot(V, "cb-l88", rest, 88);
  await shot(V, "cb-l100", rest, 100);
  await shot(V, "cb-v4-all", rest, "v4-all");
  await ev(V, setCbOn, false);
  // Key crops at 375 only: the locked space's key and a gate's key, magnified from the screenshot later.
  try {
    await ev(V, rest, "v4-locked");
    const lk = await ev(V, async () => { const lv = await (await fetch("levels/debug-v4.json")).json(); return lv.levels.find((l) => l.id === "v4-locked").lock.key; });
    const bx = await ev(V, cellBox, ["v4-locked", lk[0], lk[1], 4]); notes[V.tag + "-lockkey-box"] = bx;
    await V.page.screenshot({ path: resolve(OUT, V.tag + "-crop-lockkey.png"), clip: { x: bx.x, y: bx.y, width: bx.width, height: bx.height } });
    const gk = await ev(V, async () => { const lv = await (await fetch("levels/levels.json")).json(); const L = lv.levels.find((l) => l.n === 40); return { gates: L.gates, id: L.id }; });
    notes[V.tag + "-l40-gates"] = gk;
    await ev(V, rest, 40);
    const g0 = gk.gates && gk.gates[0]; const key = g0 && (g0.key || g0.k);
    if (key) { const bx2 = await ev(V, cellBox, [gk.id, key[0], key[1], 4]); await V.page.screenshot({ path: resolve(OUT, V.tag + "-crop-gatekey.png"), clip: { x: bx2.x, y: bx2.y, width: bx2.width, height: bx2.height } }); }
  } catch (e) { log.push(V.tag + " crops failed: " + (e && e.message || e)); }
}

// Rod geometry over every linked level along its stored Normal order: does a rod pass over a third tile?
function rodScan(range) {
  const res = [], tiles = () => Array.from(document.querySelectorAll("#tray .tile")).filter((t) => !t.classList.contains("none") && !t.classList.contains("empty") && t.getBoundingClientRect().width > 0);
  const ids = range === "debug" ? ["v4-linked", "v4-all"] : Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i);
  for (const n of ids) {
    let st = SP.load(n, "normal"); if (!st.links) continue; SP.tick(20); const o = SP.winOrder("normal") || ""; let worst = null, rods = 0, steps = 0;
    for (let i = 0; i <= o.length; i++) {
      const svg = document.querySelector("#tray svg.rods"); if (!svg) break; const sb = svg.getBoundingClientRect(), T = tiles().map((t) => ({ t, b: t.getBoundingClientRect() }));
      for (const g of svg.querySelectorAll("line, path, polyline")) {
        if (!g.getTotalLength) continue; const L = g.getTotalLength(); if (L < 4) continue; rods++;
        const hit = new Set();
        for (let k = 1; k < 24; k++) { const p = g.getPointAtLength((L * k) / 24), x = sb.left + p.x, y = sb.top + p.y;
          for (const { t, b } of T) if (x > b.left + 3 && x < b.right - 3 && y > b.top + 3 && y < b.bottom - 3) hit.add(t); }
        // The rod's own two tiles contain its ends; anything else crossed is a third tile.
        const ends = [g.getPointAtLength(0), g.getPointAtLength(L)].map((p) => T.filter(({ b }) => sb.left + p.x >= b.left - 1 && sb.left + p.x <= b.right + 1 && sb.top + p.y >= b.top - 1 && sb.top + p.y <= b.bottom + 1).map((q) => q.t));
        const third = Array.from(hit).filter((t) => !ends[0].includes(t) && !ends[1].includes(t));
        if (third.length && (!worst || third.length > worst.third)) worst = { step: i, third: third.length, cls: third.map((t) => t.className + " col" + Array.from(t.parentElement.parentElement.children).indexOf(t.parentElement)).join("|"), len: Math.round(L) };
      }
      steps++; if (i < o.length) { SP.play(+o[i]); SP.settle(); }
    }
    res.push({ n, links: st.links, rods, steps, worst });
  }
  return res;
}

try {
  if (ONLY.includes("375")) { const V = await openPage("375", 375, 812, 3, true);
    notes.selfTest = await V.page.evaluate(() => { const r = SP.selfTest(); return { pass: r.pass, fail: r.fail.slice(0, 20), nfail: r.fail.length, ms: Math.round(r.ms || 0) }; });
    await V.page.evaluate(() => SP.screen("title"));
    await viewport(V, true); await V.ctx.close(); }
  if (ONLY.includes("1280")) { const V = await openPage("1280", 1280, 720, 1, false); await viewport(V, false); await shot(V, "cb-l88", async (n) => { const b = document.querySelector(".tog-cb"); SP.screen("title"); b.click(); SP.load(n, "normal"); SP.tick(40); return SP.state().cb; }, 88); await V.ctx.close(); }
  if (ONLY.includes("812")) { const V = await openPage("812", 812, 375, 3, true); await viewport(V, false); await V.ctx.close(); }
  if (ONLY.includes("400")) { const V = await openIframe("400"); await viewport(V, false); await V.ctx.close(); }
  if (ONLY.includes("checks")) { const V = await openPage("chk", 375, 812, 3, true);
    notes.rods = []; for (const r of [[1, 50], [51, 100], "debug"]) notes.rods.push(...(await V.page.evaluate(rodScan, r)));
    await V.ctx.close(); }
} catch (e) { log.push("crashed: " + (e && e.stack || e)); }
clearTimeout(wall); await browser.close();
writeFileSync(resolve(OUT, "notes.json"), JSON.stringify(notes, null, 1));
console.log(log.length ? "LOG " + log.length + "\n" + log.join("\n") : "LOG: 0 console errors or warnings");
