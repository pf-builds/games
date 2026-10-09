// Sapper's Path v6 lane D16 (Picture Garden fix pass): the in-level eye check, into tools/world-01-50/. At a 375x812 phone
// (3x, touch) under ?debug=1: each fixed level at its start as the player sees it (header and board), play-NN-375.png, with
// the header's title and tag in notes-fix.txt. Console messages are kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-world-01-50-fix.mjs [--url http://127.0.0.1:8541/] [--list 39,42,43,47]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8541/"), NS = arg("list", "39,42,43,47").split(",").map(Number), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "world-01-50"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }), p = await ctx.newPage();
p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push("pageerror: " + e.message));
await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 });
for (const n of NS) { const s = await p.evaluate((id) => SP.load(id), "z1-" + n); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + "/play-" + n + "-375.png" });
  notes.push(n + ": " + JSON.stringify({ id: s.id, screen: s.screen, head: await p.evaluate(() => (document.querySelector("#hud") || document.body).innerText.split("\n").slice(0, 4).join(" | ")) })); }
await ctx.close(); await b.close();
writeFileSync(OUT + "/notes-fix.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n") + "\nconsole messages: " + log.length); for (const l of log.slice(0, 10)) console.log("  " + l);
