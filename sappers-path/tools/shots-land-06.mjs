// Sapper's Path v7 lane D (Zen World 5 Masterpiece Gallery): shots into tools/shots-land-06/ (gitignored). At a 375x812 phone
// (3x, touch) on a fresh profile: the World 4 / World 5 join (Worlds 1-4 cleared, World 5's first current) on the plain URL
// after setting the save up under ?debug=1, the middle and the top of World 5, La Grande Jatte in play and its win sheet; at
// 1280x720 the World 5 map. Round 3: La Grande Jatte is a series, 201 the left bank and 202 the parasol couple (play-grande-jatte-2-375). Plus the fit at 375 (every Zen node's number inside its disc, the closest two nodes), the tint
// on World 5's sheet images and what each shot shows (notes.txt).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-land-06.mjs [--url http://127.0.0.1:8506/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8506/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-land-06"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
async function session(vp, run) {
  const ctx = await b.newContext(vp), p = await ctx.newPage(); p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push("pageerror: " + e.message));
  const go = async (dbg) => { await p.goto(URL_ + (dbg ? "?debug=1" : "")); await p.waitForFunction(() => document.fonts.status === "loaded" && !document.getElementById("btn-play").hidden && document.getElementById("play-lab").textContent !== "Play", null, { timeout: 20000 }); if (dbg) await p.waitForFunction(() => window.SP, null, { timeout: 20000 }); };
  const shot = async (k) => { await p.waitForTimeout(700); await p.screenshot({ path: OUT + "/" + k + ".png" }); };
  const sheetsIn = async () => { for (let i = 0; i < 40; i++) { const ok = await p.evaluate(() => Array.from(document.querySelectorAll("#jr .jr-img")).filter((im) => { const r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).every((im) => im.complete && im.naturalWidth)); if (ok) return; await p.waitForTimeout(150); } };
  const toZen = async () => { await p.click("#btn-tomap"); await p.evaluate(() => { const c = document.querySelector('#map-mode [data-mode="zen"]'); if (c.getAttribute("aria-pressed") !== "true") c.click(); }); await sheetsIn(); };
  const seen = () => p.evaluate(() => Array.from(document.querySelectorAll("#jr .mn")).filter((n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map((n) => n.querySelector("b").textContent + (n.classList.contains("cur") ? "*" : "")).sort((a, c) => parseInt(a) - parseInt(c)).join(" "));
  const banners = () => p.evaluate(() => Array.from(document.querySelectorAll("#jr .bn")).filter((n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map((n) => n.textContent.trim()).join(" | "));
  const scrollTo = async (num, at) => { await p.evaluate(([num, at]) => { const n = Array.from(document.querySelectorAll("#jr .mn")).find((x) => x.querySelector("b").textContent === num), sc = document.getElementById("jr"), r = n.getBoundingClientRect(), q = sc.getBoundingClientRect(); sc.scrollTop += r.top - q.top - q.height * at; }, [String(num), at]); await sheetsIn(); };
  await run({ p, go, shot, toZen, seen, banners, scrollTo }); await ctx.close();
}
const phone = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, desk = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 };
const first = 201; // World 5's first Zen number (Worlds 1-4: 50 each, then the zen numbers count on: main.js zenNum)
await session(phone, async ({ p, go, shot, toZen, seen, banners, scrollTo }) => {
  await go(false); await go(true); await p.evaluate(() => { SP.zenTo(1, 50); SP.zenTo(2, 50); SP.zenTo(3, 50); SP.zenTo(4, 50); }); await go(false); await toZen();
  await scrollTo(first - 1, 0.86); notes.push("W4/W5 join, nodes in view: " + (await seen()) + "; banners: " + (await banners())); await shot("map-join-375");
  notes.push("cur: " + JSON.stringify(await p.evaluate(() => { const n = document.querySelector("#jr .mn.cur"), bd = n.querySelector(".bd"), t = n.querySelector("b"); return { n: t.textContent, text: +t.getBoundingClientRect().width.toFixed(1), inside: bd.clientWidth, label: document.querySelector("#jr .jr-cur").textContent, play: document.getElementById("map-play").textContent }; })));
  notes.push("tint: " + JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll("#jr .jr-img")).map((im) => im.getAttribute("src") ? (im.getAttribute("src") || "").replace(/\?.*/, "").replace("map/", "") + (im.style.filter ? " [" + im.style.filter + "]" : "") : null).filter(Boolean).slice(-9))));
  notes.push("fit: " + JSON.stringify(await p.evaluate(() => { let worst = null, gap = Infinity, gapAt = ""; const ns = Array.from(document.querySelectorAll("#jr .mn"));
    for (const n of ns) { const bd = n.querySelector(".bd"), t = n.querySelector("b"), room = bd.clientWidth, w = t.getBoundingClientRect().width, s = room - w; if (!worst || s < worst.spare) worst = { n: t.textContent, text: +w.toFixed(1), inside: room, spare: +s.toFixed(1), cur: n.classList.contains("cur") }; }
    for (let i = 1; i < ns.length; i++) { const a = ns[i - 1].getBoundingClientRect(), c = ns[i].getBoundingClientRect(), d = Math.hypot(a.left - c.left, a.top - c.top); if (d < gap) { gap = d; gapAt = ns[i - 1].querySelector("b").textContent + "-" + ns[i].querySelector("b").textContent; } }
    return { nodes: ns.length, last: ns.length ? ns[ns.length - 1].querySelector("b").textContent : null, tightest: worst, closest: +gap.toFixed(1), at: gapAt }; })));
  await scrollTo(first + 22, 0.5); notes.push("World 5 middle, nodes in view: " + (await seen())); await shot("map-mid-375");
  await scrollTo(first + 49, 0.6); notes.push("World 5 top, nodes in view: " + (await seen()) + "; fog label: " + (await p.evaluate(() => { const f = document.querySelector("#jr .fogl"); return f ? f.textContent : "none"; }))); await shot("map-top-375");
  await go(true);
  const bar = await p.evaluate(async () => { SP.zenTo(5, 0); await SP.load("z5-1"); return { num: document.getElementById("lvl-num").textContent, name: document.getElementById("lvl-name").textContent }; });
  notes.push("La Grande Jatte in play: " + JSON.stringify(bar)); await shot("play-grande-jatte-375");
  const o = await p.evaluate(() => SP.winOrder() || ""); for (let i = 0; i < Math.min(18, o.length); i++) await p.evaluate((ch) => { SP.play(+ch); SP.settle(); }, o[i]);
  await shot("play-grande-jatte-mid-375");
  const win = await p.evaluate((rest) => { for (const ch of rest) { SP.play(+ch); SP.settle(); } SP.tick(12000); return { panel: SP.state().panel, title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent }; }, o.slice(18));
  notes.push("La Grande Jatte win: " + JSON.stringify(win)); await shot("win-375");
  await go(true); notes.push("La Grande Jatte 2 of 2 in play: " + JSON.stringify(await p.evaluate(async () => { SP.zenTo(5, 1); await SP.load("z5-2"); return { num: document.getElementById("lvl-num").textContent, name: document.getElementById("lvl-name").textContent }; }))); await shot("play-grande-jatte-2-375"); // round 3: the series' second picture
});
await session(desk, async ({ p, go, shot, toZen, seen, banners, scrollTo }) => {
  await go(false); await go(true); await p.evaluate(() => { SP.zenTo(1, 50); SP.zenTo(2, 50); SP.zenTo(3, 50); SP.zenTo(4, 50); SP.zenTo(5, 9); }); await go(false); await toZen();
  await scrollTo(first + 9, 0.6); notes.push("desktop World 5, nodes in view: " + (await seen()) + "; banners: " + (await banners())); await shot("map-1280");
  await go(true); await p.evaluate(async () => { await SP.load("z5-1"); }); await shot("play-grande-jatte-1280");
});
await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n") + "\nconsole messages: " + log.length); for (const l of log.slice(0, 10)) console.log("  " + l);
