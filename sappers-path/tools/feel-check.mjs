#!/usr/bin/env node
// Sapper's Path v3 M0 feel-board check. Headless Chromium at 375x812: loads tools/feel.html for each band pick, asserts
// zero console errors and warnings, checks the board fits the phone width at the target cell size, then wins one level
// by clicking the real front-card buttons in its stored Normal order. Screenshots go to tools/shots/v3m0/ (not committed).
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/feel-check.mjs [--url http://localhost:8491/sappers-path/tools/feel.html]
// Exit 0 on success, 1 on a failed assertion or console message, 2 if the run crashed or ran out of time.
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://localhost:8491/sappers-path/tools/feel.html");
const OUT = resolve(here, "shots/v3m0");
const WALL_MS = 90000;
mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

let fails = 0;
const ok = (c, name) => { console.log((c ? "ok    " : "FAIL  ") + name); if (!c) fails++; };
const timer = setTimeout(() => { console.log("FAIL  wall budget"); process.exit(2); }, WALL_MS);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const msgs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") msgs.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => msgs.push("pageerror: " + e.message));
  for (const n of [8, 29, 64]) {
    await page.goto(URL_ + "?level=" + n, { waitUntil: "load", timeout: 15000 });
    await page.waitForFunction(() => window.FEEL, null, { timeout: 10000 });
    const info = await page.evaluate(() => { const c = document.getElementById("board").getBoundingClientRect(); return { w: c.width, h: c.height, lw: FEEL.level.w, lh: FEEL.level.h, doc: document.documentElement.scrollWidth, btns: document.querySelectorAll("button.card").length }; });
    ok(info.w === info.lw * 10 && info.w <= 375 - 16 * 2 + 16, `level ${n}: board ${info.w}x${info.h} CSS px at 10 px per cell (${info.lw}x${info.lh})`);
    ok(info.doc <= 375 && info.btns === 5, `level ${n}: no horizontal scroll at 375 px, five front cards`);
    await page.screenshot({ path: resolve(OUT, `feel-L${n}.png`), fullPage: true });
  }
  // Win level 29 (a mid-band Era 2 level with a gate) through the card buttons, in its stored Normal order.
  await page.goto(URL_ + "?level=29", { waitUntil: "load", timeout: 15000 });
  await page.waitForFunction(() => window.FEEL, null, { timeout: 10000 });
  const order = await page.evaluate(() => FEEL.level.win.normal);
  for (const ch of order) {
    const btn = page.locator(`button.card[data-col="${ch}"]`);
    const hit = await btn.evaluate((b) => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); });
    if (!hit) { ok(false, "card " + ch + " is not the element at its centre"); break; }
    await btn.click({ timeout: 3000 });
  }
  const st = await page.evaluate(() => FEEL.state());
  ok(st.status === 1 && st.pixLeft === 0, `level 29: won through the card buttons in ${order.length} taps (status ${st.status}, ${st.pixLeft} px left)`);
  ok((await page.textContent("#status")).includes("razed"), "level 29: the win message shows");
  await page.screenshot({ path: resolve(OUT, "feel-L29-won.png"), fullPage: true });
  // A fail: tap column 0 until the game ends on the hardest pick, then Retry resets it.
  await page.goto(URL_ + "?level=64", { waitUntil: "load", timeout: 15000 });
  await page.waitForFunction(() => window.FEEL, null, { timeout: 10000 });
  for (let i = 0; i < 120; i++) {
    const s = await page.evaluate(() => FEEL.state()); if (s.status !== 0) break;
    const open = await page.$$eval("button.card:not(:disabled)", (bs) => bs.map((b) => b.dataset.col));
    if (!open.length) break;
    await page.click(`button.card[data-col="${open[open.length - 1]}"]`, { timeout: 3000 });
  }
  const f = await page.evaluate(() => FEEL.state());
  ok(f.status === -1, `level 64: always tapping the last open column fails (${f.reason})`);
  await page.screenshot({ path: resolve(OUT, "feel-L64-fail.png"), fullPage: true });
  await page.click("#retry");
  const r = await page.evaluate(() => FEEL.state());
  ok(r.status === 0 && r.lineLen === 0 && r.heads.every((h) => h === 0), "retry: one tap restarts the level");
  ok(msgs.length === 0, "zero console errors or warnings" + (msgs.length ? ": " + msgs.slice(0, 3).join(" | ") : ""));
} catch (e) { console.log("FAIL  crashed: " + e.message); fails++; clearTimeout(timer); await browser.close(); process.exit(2); }
clearTimeout(timer);
await browser.close();
process.exit(fails ? 1 : 0);
