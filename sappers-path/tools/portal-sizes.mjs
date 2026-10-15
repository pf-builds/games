#!/usr/bin/env node
// Sapper's Path portal layout check (lane P Stage 3; the Stage 2 gate critic's gate 3; tools/portal-notes.md, config
// tools/portal-config.json sizes).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/portal-sizes.mjs [--only 907x510] [--out DIR]
// Serves the game folder from this process (sizes.port, 127.0.0.1) and, for every size in sizes.list (CrazyGames' official
// iframe sizes, the small ones it also names, and the runbook's phones), drives six screens: the home (fresh profile), level
// 1 (one real tap on Play), the speed buy sheet with 0 coins, its win sheet, a loss sheet (a jam on a Campaign level), a Zen "A little stuck" sheet and the map.
// A fresh profile with 0 coins, so the loss sheet is its longest (a continue the player cannot afford). The game is set up through window.SP (?debug=1; only to reach the screens: the layout is the shipped one). On each screen
// every visible control (buttons, squad cards, spaces, power-up badges and their names, pills, the coach line) and every
// sheet's card and title must sit wholly inside the viewport and inside any scrolling ancestor (a button its sheet scrolls
// out of view fails), and the smallest visible text must be at least sizes.minFontPx
// on screen (font size times any zoom on the way). Prints PASS/FAIL per size and screen, writes a screenshot of each and a
// contact sheet (<out>/contact.png, via python3 + Pillow). Exit 0 when every check passes. The server closes at the end.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), C = JSON.parse(fs.readFileSync(path.join(root, "tools/portal-config.json"), "utf8")), Z = C.sizes;
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(root, arg("out", Z.out)), only = arg("only", null);
fs.mkdirSync(out, { recursive: true });
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".m4a": "audio/mp4", ".ttf": "font/ttf" };
const server = http.createServer((q, r) => { const rel = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/+/, "") || "index.html", f = path.join(root, rel);
  if (!f.startsWith(root) || rel.startsWith("tools/") || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(f).pipe(r); });
await new Promise((ok, no) => { server.once("error", no); server.listen(Z.port, "127.0.0.1", ok); });
const URL_ = `http://127.0.0.1:${Z.port}/`;

// In the page: every visible control and sheet title outside the viewport, and the smallest on-screen text size.
const probe = (sel) => {
  const W = innerWidth, H = innerHeight, bad = [], vis = (el) => { if (el.closest("[hidden]")) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false; } return true; };
  const name = (el) => (el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : el.tagName.toLowerCase()) + (el.textContent ? " '" + el.textContent.trim().slice(0, 18) + "'" : "");
  // the viewport cut down by every scrolling or clipping ancestor (Stage 3 re-check: a button cut by its own sheet's scroll)
  const clip = (el) => { let c = [0, 0, W, H]; for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflowX === "visible" && s.overflowY === "visible") continue; const q = e.getBoundingClientRect(); c = [Math.max(c[0], q.left), Math.max(c[1], q.top), Math.min(c[2], q.right), Math.min(c[3], q.bottom)]; } return c; };
  for (const el of document.querySelectorAll(sel)) { if (!vis(el)) continue; const r = el.getBoundingClientRect(), c = /sheetcard/.test(el.className) ? [0, 0, W, H] : clip(el); if (r.left < c[0] - 0.5 || r.top < c[1] - 0.5 || r.right > c[2] + 0.5 || r.bottom > c[3] + 0.5) bad.push(name(el) + " [" + [r.left, r.top, r.right, r.bottom].map(Math.round).join(",") + "]" + (c[3] < H || c[1] > 0 ? " clipped to [" + c.map(Math.round).join(",") + "]" : "")); }
  let min = 1e9, at = ""; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { const el = n.parentElement; if (!el || !n.textContent.trim() || !vis(el) || el.closest("#jr-world, script, style")) continue; const k = el.offsetWidth > 0 ? el.getBoundingClientRect().width / el.offsetWidth : 1, fs = parseFloat(getComputedStyle(el).fontSize) * k; if (fs < min) { min = fs; at = name(el); } }
  return { bad, min: Math.round(min * 10) / 10, at };
};
const scope = (pre, list) => list.split(",").map((x) => pre + " " + x.trim()).join(", ");
const HOME = scope("#title", "button, .pill, h1, .mode-card, .tab"), BUY = "#speedbuy .sheetcard, #speedbuy button, #sb-title, #sb-poor", PLAY = scope("#play", "button, .card, .slot, .pw, .pw-name, .pill, #lvl-name, #line-head") + ", #coach:not([hidden]), " + scope("#panel", ".sheetcard, .p-title, #p-line, button") + ", #pwtip, #toast, .modal:not([hidden]) .sheetcard";
const MAPSEL = ".map-top button, .map-top .pill, #map-mode, #jr-next button, #map-play, #jr-realm";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch(), rows = [], shots = [];
let fails = 0;
try {
  for (const [w, h] of Z.list) {
    if (only && only !== w + "x" + h) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }), p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errs.push(m.text()); });
    const tag = w + "x" + h, check = async (screen, sel) => { await p.waitForTimeout(350); const r = await p.evaluate(probe, sel); const f = out + "/" + tag + "-" + screen + ".png"; await p.screenshot({ path: f }); shots.push([tag, screen, f]);
      const ok = !r.bad.length && r.min >= Z.minFontPx; if (!ok) fails++; rows.push((ok ? "PASS " : "FAIL ") + tag.padEnd(10) + screen.padEnd(6) + ` min text ${r.min} px (${r.at})` + (r.bad.length ? "; outside: " + r.bad.slice(0, 6).join("; ") : "")); };
    const sheet = async (screen, setup, want) => { await p.evaluate(setup); for (let i = 0; i < 120 && await p.evaluate(() => document.getElementById("panel").hidden); i++) await p.evaluate(() => SP.tick(100));
      const t = await p.evaluate(() => (document.getElementById("panel").hidden ? "" : document.getElementById("p-title").textContent)); if (!want.test(t)) { fails++; rows.push("FAIL " + tag.padEnd(10) + screen.padEnd(6) + " the sheet did not come up (title '" + t + "')"); } await check(screen, PLAY); };
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("sz")) { sessionStorage.setItem("sz", "1"); localStorage.clear(); localStorage.setItem("sappers-path.v3", JSON.stringify({ v: 2, coins: 0 })); } } catch (e) { /* no storage */ } });
    await p.goto(URL_); await p.waitForFunction(() => document.querySelector("#title-art.on"), null, { timeout: 30000 }); // the game as it ships for these three
    await check("home", HOME);
    await p.click("#btn-play"); await p.waitForTimeout(600); await check("level", PLAY);
    await p.click("#top .tog-speed"); await check("buy", BUY); // the buy sheet with 0 coins (Buy off, the short line)
    await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 30000 }); // SP, to reach the sheets
    await sheet("win", () => { SP.load(1); for (const c of SP.winOrder()) { SP.play(+c); SP.settle(); } }, /./);
    await sheet("loss", () => { for (let n = 64; n <= 120; n++) { SP.load(n); const q = SP.lossPlan(); if (q) { for (const c of q.prefix) { SP.play(+c); SP.settle(); } return; } } }, /failed/i);
    await sheet("zen", async () => { const ids = SP.zen().filter((id) => /^z1-/.test(id)); for (const id of ids.slice(0, 30)) { await SP.load(id); const q = SP.lossPlan(); if (q) { for (const c of q.prefix) { SP.play(+c); SP.settle(); } return; } } }, /stuck/i);
    await p.evaluate(() => SP.screen("map")); await check("map", MAPSEL);
    if (errs.length) { fails++; rows.push("FAIL " + tag + " console: " + errs.slice(0, 2).join(" | ")); }
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
for (const r of rows) console.log(r);
// the contact sheet: one row per size, the six screens across, each scaled to a fixed height
const list = path.join(out, "shots.json"); fs.writeFileSync(list, JSON.stringify(shots));
try { execFileSync("python3", ["-c", `import json,sys
from PIL import Image, ImageDraw
S=json.load(open(sys.argv[1])); H=150; rows={}
for t,s,f in S: rows.setdefault(t,[]).append((s,f))
ims=[]
for t,L in rows.items():
  tiles=[Image.open(f).convert("RGB") for s,f in L]; tiles=[i.resize((max(1,int(i.width*H/i.height)),H)) for i in tiles]
  row=Image.new("RGB",(sum(i.width for i in tiles)+8*len(tiles)+90,H+8),(30,28,36)); d=ImageDraw.Draw(row); d.text((4,4),t,fill=(255,255,255)); x=90
  for i in tiles: row.paste(i,(x,4)); x+=i.width+8
  ims.append(row)
W=max(i.width for i in ims); sheet=Image.new("RGB",(W,sum(i.height for i in ims)),(30,28,36)); y=0
for i in ims: sheet.paste(i,(0,y)); y+=i.height
sheet.save(sys.argv[2])`, list, path.join(out, "contact.png")]); console.log("contact sheet: " + path.relative(root, path.join(out, "contact.png"))); } catch (e) { console.log("contact sheet: not made (" + e.message.split("\n")[0] + ")"); }
console.log(fails ? `FAIL: ${fails} check(s)` : "PASS: every size and screen");
process.exit(fails ? 1 : 0);
