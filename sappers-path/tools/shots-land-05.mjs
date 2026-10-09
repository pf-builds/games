// Sapper's Path v6 lane D12 (Zen World 4 Dino Valley): shots into tools/land-05/ at a 375x812 phone (3x, touch) on a fresh
// profile: the Zen map at the World 3 / World 4 seam (Worlds 1-3 cleared, 137 current) on the plain URL after setting the
// save up under ?debug=1, the top of World 4 (186 and the fog), and a World 4 level (z4-2, picture 138) won under ?debug=1;
// plus the fit at 375 (every Zen node's number inside its disc, the closest two consecutive nodes) and what each shot shows.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-land-05.mjs [--url http://127.0.0.1:8512/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8512/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "land-05"); mkdirSync(OUT, { recursive: true });
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
const eggs = () => p.evaluate(() => Array.from(document.querySelectorAll("#jr .egg, #jr [data-egg]")).filter((n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length);
await go(false); await go(true); await p.evaluate(() => { SP.zenTo(1, 36); SP.zenTo(2, 50); SP.zenTo(3, 50); }); await go(false); await toZen();
// The W3/W4 seam: World 3's last level (136) low in the view, so 137 and World 4's banner show above it.
await p.evaluate(() => { const n = Array.from(document.querySelectorAll("#jr .mn")).find((x) => x.querySelector("b").textContent === "136"), sc = document.getElementById("jr"), r = n.getBoundingClientRect(), q = sc.getBoundingClientRect(); sc.scrollTop += r.top - q.top - q.height * 0.86; }); await sheetsIn();
notes.push("W3/W4 seam, nodes in view: " + (await seen()) + "; banners: " + (await banners()) + "; eggs drawn in view: " + (await eggs())); await shot("map-375");
notes.push("cur: " + JSON.stringify(await p.evaluate(() => { const n = document.querySelector("#jr .mn.cur"), bd = n.querySelector(".bd"), t = n.querySelector("b"); return { n: t.textContent, text: +t.getBoundingClientRect().width.toFixed(1), inside: bd.clientWidth, label: document.querySelector("#jr .jr-cur").textContent, play: document.getElementById("map-play").textContent }; })));
notes.push("fit: " + JSON.stringify(await p.evaluate(() => { let worst = null, gap = Infinity, gapAt = ""; const ns = Array.from(document.querySelectorAll("#jr .mn"));
  for (const n of ns) { const bd = n.querySelector(".bd"), t = n.querySelector("b"), room = bd.clientWidth, w = t.getBoundingClientRect().width, s = room - w; if (!worst || s < worst.spare) worst = { n: t.textContent, text: +w.toFixed(1), inside: room, spare: +s.toFixed(1), cur: n.classList.contains("cur") }; }
  for (let i = 1; i < ns.length; i++) { const a = ns[i - 1].getBoundingClientRect(), c = ns[i].getBoundingClientRect(), d = Math.hypot(a.left - c.left, a.top - c.top); if (d < gap) { gap = d; gapAt = ns[i - 1].querySelector("b").textContent + "-" + ns[i].querySelector("b").textContent; } }
  return { nodes: ns.length, last: ns.length ? ns[ns.length - 1].querySelector("b").textContent : null, tightest: worst, closest: +gap.toFixed(1), at: gapAt }; })));
// The top of World 4: its last level (186) and the fog after it.
await p.evaluate(() => { const n = Array.from(document.querySelectorAll("#jr .mn")).find((x) => x.querySelector("b").textContent === "186"), sc = document.getElementById("jr"), r = n.getBoundingClientRect(), q = sc.getBoundingClientRect(); sc.scrollTop += r.top - q.top - q.height * 0.6; }); await sheetsIn();
notes.push("World 4 top, nodes in view: " + (await seen()) + "; fog label: " + (await p.evaluate(() => { const f = document.querySelector("#jr .fogl"); return f ? f.textContent : "none"; }))); await shot("map-top-375");
await go(true);
const win = await p.evaluate(() => { SP.zenTo(4, 1); SP.load("z4-2"); const bar = { num: document.getElementById("lvl-num").textContent, name: document.getElementById("lvl-name").textContent }, o = SP.winOrder() || ""; for (const ch of o) { SP.play(+ch); SP.settle(); } SP.tick(12000);
  return Object.assign(bar, { panel: SP.state().panel, title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent }); });
notes.push("World 4 win: " + JSON.stringify(win)); await shot("level-win-375");
await ctx.close(); await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n") + "\nconsole messages: " + log.length); for (const l of log.slice(0, 10)) console.log("  " + l);
