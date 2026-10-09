// Sapper's Path v6 lane D15 (Zen World 1 Picture Garden grows to 50): shots into tools/world-01-50/ at a 375x812 phone (3x,
// touch) on a fresh profile, plain URL after setting the save up under ?debug=1 (World 1's 36 cleared, so 37 is current):
// the old top and the new sheets' start (36 done, 37 current), World 1's new top (44-50) and the World 1 -> 2 seam (50, World
// 2's banner, 51); plus the fit at 375 (every Zen node's number inside its disc, the closest two consecutive nodes).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-world-01-50.mjs [--url http://127.0.0.1:8531/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8531/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "world-01-50"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }), p = await ctx.newPage();
p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push("pageerror: " + e.message));
const go = async (dbg) => { await p.goto(URL_ + (dbg ? "?debug=1" : "")); await p.waitForFunction(() => document.fonts.status === "loaded" && !document.getElementById("btn-play").hidden && document.getElementById("play-lab").textContent !== "Play", null, { timeout: 20000 }); if (dbg) await p.waitForFunction(() => window.SP, null, { timeout: 20000 }); };
const shot = async (k) => { await p.waitForTimeout(600); await p.screenshot({ path: OUT + "/" + k + ".png" }); };
const sheetsIn = async () => { for (let i = 0; i < 40; i++) { const ok = await p.evaluate(() => Array.from(document.querySelectorAll("#jr .jr-img")).filter((im) => { const r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).every((im) => im.complete && im.naturalWidth)); if (ok) return; await p.waitForTimeout(150); } };
const toZen = async () => { await p.click("#btn-tomap"); await p.evaluate(() => { const c = document.querySelector('#map-mode [data-mode="zen"]'); if (c.getAttribute("aria-pressed") !== "true") c.click(); }); await sheetsIn(); };
const seen = () => p.evaluate(() => Array.from(document.querySelectorAll("#jr .mn")).filter((n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map((n) => n.querySelector("b").textContent + (n.classList.contains("cur") ? "*" : "")).sort((a, c) => parseInt(a) - parseInt(c)).join(" "));
const banners = () => p.evaluate(() => Array.from(document.querySelectorAll("#jr .bn")).filter((n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map((n) => n.textContent.trim()).join(" | "));
const at = (num, f) => p.evaluate(([num, f]) => { const n = Array.from(document.querySelectorAll("#jr .mn")).find((x) => x.querySelector("b").textContent === num), sc = document.getElementById("jr"), r = n.getBoundingClientRect(), q = sc.getBoundingClientRect(); sc.scrollTop += r.top - q.top - q.height * f; }, [num, f]);
await go(false); await go(true); await p.evaluate(() => { SP.zenTo(1, 36); }); await go(false);
notes.push("home Zen card: " + JSON.stringify(await p.evaluate(() => [document.getElementById("home-zen-w").textContent, document.getElementById("zen-lab").textContent])));
await toZen();
await at("36", 0.8); await sheetsIn(); notes.push("36/37 (old top, first new sheet), nodes in view: " + (await seen()) + "; banners: " + (await banners())); await shot("map-37-375");
notes.push("cur: " + JSON.stringify(await p.evaluate(() => { const n = document.querySelector("#jr .mn.cur"); return { n: n.querySelector("b").textContent, label: document.querySelector("#jr .jr-cur").textContent, play: document.getElementById("map-play").textContent }; })));
await at("50", 0.55); await sheetsIn(); notes.push("World 1 top, nodes in view: " + (await seen()) + "; banners: " + (await banners())); await shot("map-top-375");
await at("50", 0.85); await sheetsIn(); notes.push("World 1/2 seam, nodes in view: " + (await seen()) + "; banners: " + (await banners())); await shot("seam-375");
notes.push("seam gap: " + JSON.stringify(await p.evaluate(() => { const ns = Array.from(document.querySelectorAll("#jr .mn")), f = (t) => ns.find((x) => x.querySelector("b").textContent === t).getBoundingClientRect(), a = f("50"), c = f("51"), bn = Array.from(document.querySelectorAll("#jr .bn")).find((x) => /World 2/.test(x.textContent + (x.getAttribute("aria-label") || ""))).getBoundingClientRect();
  return { "50 to banner px": Math.round(a.top - bn.bottom), "banner to 51 px": Math.round(bn.top - c.bottom), "50 to 51 px": Math.round(a.top - c.top) }; })));
notes.push("fit: " + JSON.stringify(await p.evaluate(() => { let worst = null, gap = Infinity, gapAt = ""; const ns = Array.from(document.querySelectorAll("#jr .mn"));
  for (const n of ns) { const bd = n.querySelector(".bd"), t = n.querySelector("b"), room = bd.clientWidth, w = t.getBoundingClientRect().width, s = room - w; if (!worst || s < worst.spare) worst = { n: t.textContent, text: +w.toFixed(1), inside: room, spare: +s.toFixed(1) }; }
  for (let i = 1; i < ns.length; i++) { const a = ns[i - 1].getBoundingClientRect(), c = ns[i].getBoundingClientRect(), d = Math.hypot(a.left - c.left, a.top - c.top); if (d < gap) { gap = d; gapAt = ns[i - 1].querySelector("b").textContent + "-" + ns[i].querySelector("b").textContent; } }
  const w1 = ns.slice(0, 50); let g1 = Infinity, g1At = ""; for (let i = 36; i < 50; i++) { const a = w1[i - 1].getBoundingClientRect(), c = w1[i].getBoundingClientRect(), d = Math.hypot(a.left - c.left, a.top - c.top); if (d < g1) { g1 = d; g1At = (i) + "-" + (i + 1); } }
  return { nodes: ns.length, last: ns[ns.length - 1].querySelector("b").textContent, tightest: worst, closest: +gap.toFixed(1), at: gapAt, closestNew: +g1.toFixed(1), newAt: g1At }; })));
await ctx.close(); await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n") + "\nconsole messages: " + log.length); for (const l of log.slice(0, 10)) console.log("  " + l);
