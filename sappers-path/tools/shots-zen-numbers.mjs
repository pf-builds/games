// Sapper's Path v6 lane D10 (Zen numbers count up across the worlds): three shots into tools/zen-numbers/ at a 375x812
// phone (3x, touch), on a fresh profile, plus the map nodes' fit at 375: the Zen map at the World 1 / World 2 seam (World 1
// cleared, 37 current), at the World 2 / World 3 seam (Worlds 1 and 2 cleared, 87 current), both on the plain URL after
// setting the save up under ?debug=1; then under ?debug=1 a World 3 level (z3-5, picture 91) won: its play bar and win sheet.
// Fit: every Zen node's number against its disc's inside (3 px border), and the closest two node centres on a sheet.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-zen-numbers.mjs [--url http://127.0.0.1:8521/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8521/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "zen-numbers"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }), p = await ctx.newPage();
p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push("pageerror: " + e.message));
const go = async (dbg) => { await p.goto(URL_ + (dbg ? "?debug=1" : "")); await p.waitForFunction(() => document.fonts.status === "loaded" && !document.getElementById("btn-play").hidden && document.getElementById("play-lab").textContent !== "Play", null, { timeout: 20000 }); if (dbg) await p.waitForFunction(() => window.SP, null, { timeout: 20000 }); };
const shot = async (k) => { await p.waitForTimeout(600); await p.screenshot({ path: OUT + "/" + k + ".png" }); };
const sheetsIn = async () => { for (let i = 0; i < 40; i++) { const ok = await p.evaluate(() => Array.from(document.querySelectorAll("#jr .jr-img")).filter((im) => { const r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).every((im) => im.complete && im.naturalWidth)); if (ok) return; await p.waitForTimeout(150); } };
const toZen = async () => { await p.click("#btn-tomap"); await p.evaluate(() => { const c = document.querySelector('#map-mode [data-mode="zen"]'); if (c.getAttribute("aria-pressed") !== "true") c.click(); }); await sheetsIn(); };
// The W2/W3 seam: World 2's last level (86) near the view's foot, so 87 and World 3's banner show above it.
// The seam: World k's banner a little above the middle of the view (World k-1's last levels below it, k's first above).
const seam = async (i) => { await p.evaluate((i) => { const bn = Array.from(document.querySelectorAll("#jr .bn"))[i], sc = document.getElementById("jr"), r = bn.getBoundingClientRect(), q = sc.getBoundingClientRect(); sc.scrollTop += r.top - q.top - q.height * 0.5; }, i); await sheetsIn(); };
const seen = () => p.evaluate(() => Array.from(document.querySelectorAll("#jr .mn")).filter((n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map((n) => n.querySelector("b").textContent + (n.classList.contains("cur") ? "*" : "")).sort((a, c) => parseInt(a) - parseInt(c)).join(" "));
await go(false); await go(true); await p.evaluate(() => SP.zenTo(1, 36)); await go(false); await toZen(); await seam(1); notes.push("W1/W2 seam, nodes in view: " + (await seen())); await shot("zen-map-seam-w1-w2-375");
// The fit, with every node built: each number's width inside its disc, and the closest two nodes on any sheet (CSS px).
notes.push("fit: " + JSON.stringify(await p.evaluate(() => { let worst = null, gap = Infinity, gapAt = ""; const ns = Array.from(document.querySelectorAll("#jr .mn"));
  for (const n of ns) { const bd = n.querySelector(".bd"), t = n.querySelector("b"), room = bd.clientWidth, w = t.getBoundingClientRect().width, s = room - w; if (!worst || s < worst.spare) worst = { n: t.textContent, text: +w.toFixed(1), inside: room, spare: +s.toFixed(1), cur: n.classList.contains("cur") }; }
  for (let i = 1; i < ns.length; i++) { const a = ns[i - 1].getBoundingClientRect(), c = ns[i].getBoundingClientRect(), d = Math.hypot(a.left - c.left, a.top - c.top); if (d < gap) { gap = d; gapAt = ns[i - 1].querySelector("b").textContent + "-" + ns[i].querySelector("b").textContent; } }
  return { nodes: ns.length, tightest: worst, closest: +gap.toFixed(1), at: gapAt }; })));
await go(true); await p.evaluate(() => SP.zenTo(2, 50)); await go(false); await toZen(); await p.evaluate(() => { const n = Array.from(document.querySelectorAll("#jr .mn")).find((x) => x.querySelector("b").textContent === "86"), sc = document.getElementById("jr"), r = n.getBoundingClientRect(), q = sc.getBoundingClientRect(); sc.scrollTop += r.top - q.top - q.height * 0.86; }); await sheetsIn(); notes.push("W2/W3 seam, nodes in view: " + (await seen())); await shot("zen-map-seam-w2-w3-375");
// A cur node at three digits (World 3's next, 87 here): its number inside the bigger disc.
notes.push("cur: " + JSON.stringify(await p.evaluate(() => { const n = document.querySelector("#jr .mn.cur"), bd = n.querySelector(".bd"), t = n.querySelector("b"); return { n: t.textContent, text: +t.getBoundingClientRect().width.toFixed(1), inside: bd.clientWidth, label: document.querySelector("#jr .jr-cur").textContent, play: document.getElementById("map-play").textContent }; })));
await go(true);
const win = await p.evaluate(() => { SP.zenTo(3, 4); SP.load("z3-5"); const bar = { num: document.getElementById("lvl-num").textContent, name: document.getElementById("lvl-name").textContent }, o = SP.winOrder() || ""; for (const ch of o) { SP.play(+ch); SP.settle(); } SP.tick(12000);
  return Object.assign(bar, { panel: SP.state().panel, title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent }); });
notes.push("World 3 win: " + JSON.stringify(win)); await shot("zen-w3-level-win-375");
await ctx.close(); await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n") + "\nconsole messages: " + log.length); for (const l of log.slice(0, 10)) console.log("  " + l);
