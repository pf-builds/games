#!/usr/bin/env node
// Sapper's Path v4 M2 (the twists) screens, into tools/shots-v4-m2/ (gitignored). Headless Chromium via Playwright, at
// 375×812 (dpr 2, touch) and 1280×720 (dpr 1): each debug level at rest (mystery, linked with its rods and a stub, the
// locked space, all three), a mystery card turning over at the front (the flip frozen half way), a linked pair leaving
// together (runners from both spaces), a linked tap refused with one space free (both tiles shaking, the toast), the
// padlock before the key pops, popping, and after, and the generalized jam's sheet (selfTest.linkJamLevel and
// lockJamLevel). Exit 1 on a console error or warning.
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v4-m2.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(here, "shots-v4-m2");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(), log = [], notes = {};
const wall = setTimeout(() => { console.error("shots: out of time"); process.exit(2); }, 240000);

async function open(w, h, dpr, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(w + "x" + h + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => log.push(w + "x" + h + " pageerror: " + e.message));
  await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000 });
  return { ctx, page };
}
const ev = (page, fn, a) => page.evaluate(fn, a);
// Freeze every running CSS / Web animation at fraction f of its duration (the flip, the shake, the padlock's pop).
const freeze = (f) => { for (const a of document.getAnimations()) { const d = +a.effect.getTiming().duration || 0; a.pause(); a.currentTime = d * f; } };
async function shot(page, tag, name, fn, a) {
  const got = fn ? await ev(page, fn, a) : null;
  if (got && typeof got === "object") notes[tag + "-" + name] = got;
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, tag + "-" + name + ".png") });
}

async function run(tag, w, h, dpr, touch) {
  const { ctx, page } = await open(w, h, dpr, touch);
  const rest = (id) => { SP.load(id, "normal"); SP.tick(40); return { hidden: SP.state().hidden, links: SP.state().links, open: SP.state().open, cap: SP.state().cap }; };
  for (const id of ["v4-mystery", "v4-linked", "v4-locked", "v4-all"]) await shot(page, tag, id + "-rest", rest, id);
  // A mystery card reaches the front: tap the first column whose second card is hidden; freeze the flip half way.
  await ev(page, () => { SP.load("v4-mystery", "normal"); SP.tick(40); });
  await shot(page, tag, "mystery-reveal", (f) => { const cols = [0, 1, 2, 3, 4].filter((j) => document.querySelector('.col:nth-child(' + (j + 1) + ') .next.d1.mys')); SP.play(cols[0]);
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = (+a.effect.getTiming().duration || 0) * f; } return { col: cols[0], hidden: SP.state().hidden }; }, 0.45);
  // A linked pair leaving together: the stored order up to its first linked tap, then 0.9 s of the show.
  await shot(page, tag, "linked-leaving", () => { SP.load("v4-linked", "normal"); const o = SP.winOrder("normal");
    for (const ch of o) { const j = +ch, st = SP.state(), f = st.fronts[j], el = document.querySelector('.card[data-col="' + j + '"]');
      if (el.classList.contains("linked") && SP.reachable(f.mat) > 0) { const n0 = st.line.length; SP.play(j); SP.tick(700); const R = SP.runners().bySpace, sp = SP.state().line.length; if (sp - n0 === 2 && R.filter((k) => k > 0).length >= 2) return R; SP.settle(); continue; }
      SP.play(j); SP.settle(); } return null; });
  // A linked tap refused with one space free: same-instant taps of unlinked cards, then the linked one.
  await shot(page, tag, "linked-refused", () => { SP.load("v4-linked", "normal");
    for (let g = 0; g < 8; g++) { const st = SP.state(); if (st.line.length >= st.open - 1) break; const j = st.fronts.findIndex((f, k) => f && !document.querySelector('.card[data-col="' + k + '"]').classList.contains("linked") && !document.querySelector('.card[data-col="' + k + '"]').classList.contains("blocked")); if (j < 0) break; SP.play(j); }
    const lj = SP.state().fronts.findIndex((f, k) => f && document.querySelector('.card[data-col="' + k + '"]').classList.contains("linked")); const r = SP.play(lj); return { line: SP.state().line.length, open: SP.state().open, played: r, toast: document.getElementById("toast").textContent }; });
  await ev(page, freeze, 0.2); await page.screenshot({ path: resolve(OUT, tag + "-linked-refused.png") });
  // The padlock: at rest, then the key popping (the pop frozen a third in), then the space open.
  await shot(page, tag, "lock-before", rest, "v4-locked");
  await shot(page, tag, "lock-popping", () => { SP.load("v4-locked", "normal"); const o = SP.winOrder("normal"); for (const ch of o) { SP.play(+ch); for (let t = 0; t < 90000 && SP.state().busy; t += 16) { SP.tick(16); if (!SP.state().locked) return SP.state().open; } } return null; });
  await ev(page, freeze, 0.3); await page.screenshot({ path: resolve(OUT, tag + "-lock-popping.png") });
  await shot(page, tag, "lock-after", () => { for (const a of document.getAnimations()) a.play(); SP.tick(900); return SP.state().open; });
  // The generalized jam's sheets.
  await shot(page, tag, "jam-linked-sheet", () => { SP.fixture("linkJamLevel", "normal"); for (const ch of "2301") { SP.play(+ch); SP.settle(); } SP.tick(8000); return document.getElementById("p-line").textContent; });
  await shot(page, tag, "jam-lock-sheet", () => { SP.fixture("lockJamLevel", "normal"); for (const ch of "1234") { SP.play(+ch); SP.settle(); } SP.tick(8000); return document.getElementById("p-line").textContent; });
  await shot(page, tag, "map-debug-row", () => { SP.screen("map"); document.getElementById("map").scrollTop = 0; return document.querySelectorAll(".dbg-node").length; });
  notes[tag + "-cells"] = await ev(page, () => { const o = {}; for (const id of ["v4-mystery", "v4-linked", "v4-locked", "v4-all"]) { SP.load(id, "normal"); o[id] = +(SP.state().cs / devicePixelRatio).toFixed(2); } return o; });
  await ctx.close();
}

try { await run("375", 375, 812, 2, true); await run("1280", 1280, 720, 1, false); }
finally { await browser.close(); clearTimeout(wall); }
console.log(JSON.stringify({ notes, console: log }, null, 1));
process.exit(log.length ? 1 : 0);
