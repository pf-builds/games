#!/usr/bin/env node
// Sapper's Path frame-rate check (lane P Stage 3; CrazyGames' "physics consistent at 144 Hz" gate; tools/portal-notes.md).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/portal-hz.mjs [--port 8615]
// Serves the game folder from this process and plays the same stored winning taps on level 1 and on the first archer-tower
// level with requestAnimationFrame replaced by a fixed-rate timer at 30, 60 and 144 Hz (the page's own loop, real time).
// Each tap waits until every sapper is home (patient play). In the page, every frame logs the engine clock when the squads
// start and stop running, so each run's engine length is known to a frame. Compared across the rates: the outcome, the taps,
// the archers' hits, each run's engine length (within one frame of the slower rate, twice: its start and its end), and the
// engine ms per real ms while sappers run (the walk speed on screen: positions are a function of engine time). Exit 0 when
// every rate agrees.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = +arg("port", 8615), RATES = [30, 60, 144];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".m4a": "audio/mp4", ".ttf": "font/ttf" };
const server = http.createServer((q, r) => { const rel = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/+/, "") || "index.html", f = path.join(root, rel);
  if (!f.startsWith(root) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(f).pipe(r); });
await new Promise((ok, no) => { server.once("error", no); server.listen(PORT, "127.0.0.1", ok); });
const LV = JSON.parse(fs.readFileSync(path.join(root, "tools/build-data/levels/levels.json"), "utf8")).levels.filter((l) => !l.land), tower = (LV.find((l) => l.towers && l.towers.length) || {}).n;

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch(), res = {};
try {
  for (const hz of RATES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errs.push(m.text()); });
    await ctx.addInitScript((hz) => { // the page's frames at a fixed rate; each frame logs the run edges (engine and real time)
      window.__hz = { log: [], busy: false }; const ms = 1000 / hz;
      window.requestAnimationFrame = (cb) => setTimeout(() => { const t = performance.now(); cb(t); const SP = window.SP; if (SP && SP.state) { const s = SP.state(); if (s.busy !== window.__hz.busy) { window.__hz.busy = s.busy; window.__hz.log.push([s.busy ? 1 : 0, s.now, t]); } } }, ms); }, hz);
    await p.goto(`http://127.0.0.1:${PORT}/?debug=1`); await p.waitForFunction(() => window.SP, null, { timeout: 30000, polling: 100 }).catch(async (e) => { throw new Error("no SP: " + errs.join(" | ") + " " + await p.evaluate(() => typeof window.SP + " " + document.getElementById("load-msg").textContent)); });
    for (const n of [1, tower]) {
      await p.evaluate((n) => { SP.speed(1); SP.load(n); window.__hz.log = []; window.__hz.busy = false; }, n);
      const order = await p.evaluate(() => SP.winOrder());
      for (const c of order) { const k = await p.evaluate((c) => { const k = window.__hz.log.length; SP.play(+c); return k; }, c); // a tap, then its squad's run to its end
        await p.waitForFunction((k) => window.__hz.log.length > k || window.__hz.busy, k, { timeout: 2000, polling: 20 }).catch(() => {}); await p.waitForFunction(() => !window.__hz.busy, null, { timeout: 60000, polling: 20 }); }
      await p.waitForFunction(() => SP.state().panel, null, { timeout: 30000, polling: 100 }).catch(async () => { throw new Error("no sheet: " + JSON.stringify(await p.evaluate(() => { const s = SP.state(); return [s.status, s.busy, s.panel, s.goblin, SP.paused(), s.clock, window.__hz.log.slice(-3)]; }))); });
      const r = await p.evaluate(() => { const s = SP.state(), L = window.__hz.log, runs = []; for (let i = 0; i + 1 < L.length; i++) if (L[i][0] === 1 && L[i + 1][0] === 0) runs.push([L[i + 1][1] - L[i][1], L[i + 1][2] - L[i][2]]); return { status: s.status, plays: s.plays, hits: s.hits, kills: s.kills, runs }; });
      res[hz + ":" + n] = r;
    }
    if (errs.length) res[hz + ":errors"] = errs;
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
let bad = 0;
for (const n of [1, tower]) {
  const R = RATES.map((hz) => res[hz + ":" + n]), sum = (r, k) => r.runs.reduce((a, x) => a + x[k], 0), frame = 1000 / RATES[0];
  const same = R.every((r) => r.status === R[0].status && r.plays === R[0].plays && r.hits === R[0].hits && r.kills === R[0].kills && r.runs.length === R[0].runs.length);
  const runOK = same && R.every((r) => r.runs.every((x, i) => Math.abs(x[0] - R[0].runs[i][0]) <= 2 * frame + 1));
  const speed = R.map((r) => sum(r, 0) / sum(r, 1)), speedOK = speed.every((v) => Math.abs(v - speed[0]) < 0.02);
  if (!(same && runOK && speedOK)) bad++;
  console.log(`${same && runOK && speedOK ? "PASS" : "FAIL"} level ${n}: ` + RATES.map((hz, k) => `${hz} Hz ${R[k].status}, ${R[k].plays} taps, ${R[k].hits} hits, runs ${Math.round(sum(R[k], 0))} engine ms in ${Math.round(sum(R[k], 1))} real ms (x${speed[k].toFixed(3)})`).join("; ")
    + `; the longest run's spread ${Math.round(Math.max(...R[0].runs.map((x, i) => Math.max(...R.map((r) => r.runs[i] ? r.runs[i][0] : 0)) - Math.min(...R.map((r) => r.runs[i] ? r.runs[i][0] : 1e9)))))} engine ms (a 30 Hz frame is ${Math.round(frame)})`);
}
for (const hz of RATES) if (res[hz + ":errors"]) { bad++; console.log("FAIL " + hz + " Hz console: " + res[hz + ":errors"].slice(0, 2).join(" | ")); }
console.log(bad ? "FAIL" : "PASS: the same game at 30, 60 and 144 Hz");
process.exit(bad ? 1 : 0);
