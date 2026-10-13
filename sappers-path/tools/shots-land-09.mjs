// Sapper's Path v7 lane D (Zen World 8 Poster Parade, renamed from National Park Posters): shots into tools/shots-land-09/ (gitignored), tools/shots-land-08.mjs
// for World 8 (round 2: 13 levels, Zen 330-342). At a 375x812 phone (3x, touch) on a fresh profile: the World 7 / World 8 join (Worlds 1-7 cleared, World 8's
// first current) on the plain URL after setting the save up under ?debug=1, the middle and the top of World 8, the opener (Old
// Faithful) in play, part dug and its win sheet; at 1280x720 the World 8 map and the opener in play. Plus the fit at 375
// (every Zen node's number inside its disc, the closest two nodes), the tint on World 8's sheet images and what each shot shows
// (notes.txt).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-land-09.mjs [--url http://127.0.0.1:8507/]
import { mkdirSync, writeFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8507/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-land-09"); mkdirSync(OUT, { recursive: true });
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
const first = 330, before = () => { for (let k = 1; k <= 5; k++) SP.zenTo(k, 50); SP.zenTo(6, 29); SP.zenTo(7, 50); }; // World 8's first Zen number (Worlds 1-5: 50 each, World 6 29, World 7 50, then the zen numbers count on: main.js zenNum)
await session(phone, async ({ p, go, shot, toZen, seen, banners, scrollTo }) => {
  await go(false); await go(true); await p.evaluate(before); await go(false); await toZen();
  await scrollTo(first - 1, 0.86); notes.push("W7/W8 join, nodes in view: " + (await seen()) + "; banners: " + (await banners())); await shot("map-join-375");
  notes.push("cur: " + JSON.stringify(await p.evaluate(() => { const n = document.querySelector("#jr .mn.cur"), bd = n.querySelector(".bd"), t = n.querySelector("b"); return { n: t.textContent, text: +t.getBoundingClientRect().width.toFixed(1), inside: bd.clientWidth, label: document.querySelector("#jr .jr-cur").textContent, play: document.getElementById("map-play").textContent }; })));
  notes.push("tint: " + JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll("#jr .jr-img")).map((im) => im.getAttribute("src") ? (im.getAttribute("src") || "").replace(/\?.*/, "").replace("map/", "") + (im.style.filter ? " [" + im.style.filter + "]" : "") : null).filter(Boolean).slice(-8))));
  notes.push("fit: " + JSON.stringify(await p.evaluate(() => { let worst = null, gap = Infinity, gapAt = ""; const ns = Array.from(document.querySelectorAll("#jr .mn"));
    for (const n of ns) { const bd = n.querySelector(".bd"), t = n.querySelector("b"), room = bd.clientWidth, w = t.getBoundingClientRect().width, s = room - w; if (!worst || s < worst.spare) worst = { n: t.textContent, text: +w.toFixed(1), inside: room, spare: +s.toFixed(1), cur: n.classList.contains("cur") }; }
    for (let i = 1; i < ns.length; i++) { const a = ns[i - 1].getBoundingClientRect(), c = ns[i].getBoundingClientRect(), d = Math.hypot(a.left - c.left, a.top - c.top); if (d < gap) { gap = d; gapAt = ns[i - 1].querySelector("b").textContent + "-" + ns[i].querySelector("b").textContent; } }
    return { nodes: ns.length, last: ns.length ? ns[ns.length - 1].querySelector("b").textContent : null, tightest: worst, closest: +gap.toFixed(1), at: gapAt }; })));
  await scrollTo(first + 6, 0.5); notes.push("World 8 middle, nodes in view: " + (await seen())); await shot("map-mid-375");
  await scrollTo(first + 12, 0.6); notes.push("World 8 top, nodes in view: " + (await seen()) + "; fog label: " + (await p.evaluate(() => { const f = document.querySelector("#jr .fogl"); return f ? f.textContent : "none"; }))); await shot("map-top-375");
  notes.push("credits: " + (await p.evaluate(() => document.getElementById("map-credits").textContent)));
  await go(true);
  const bar = await p.evaluate(async () => { SP.zenTo(8, 0); await SP.load("z8-1"); return { num: document.getElementById("lvl-num").textContent, name: document.getElementById("lvl-name").textContent }; });
  notes.push("The opener in play: " + JSON.stringify(bar)); await shot("play-opener-375");
  const o = await p.evaluate(() => SP.winOrder() || ""); for (let i = 0; i < Math.min(18, o.length); i++) await p.evaluate((ch) => { SP.play(+ch); SP.settle(); }, o[i]);
  await shot("play-opener-mid-375");
  const win = await p.evaluate((rest) => { for (const ch of rest) { SP.play(+ch); SP.settle(); } SP.tick(12000); return { panel: SP.state().panel, title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent }; }, o.slice(18));
  notes.push("The opener win: " + JSON.stringify(win)); await shot("win-375");
});
await session(desk, async ({ p, go, shot, toZen, seen, banners, scrollTo }) => {
  await go(false); await go(true); await p.evaluate(() => { for (let k = 1; k <= 5; k++) SP.zenTo(k, 50); SP.zenTo(6, 29); SP.zenTo(7, 50); SP.zenTo(8, 5); }); await go(false); await toZen();
  await scrollTo(first + 5, 0.6); notes.push("desktop World 8, nodes in view: " + (await seen()) + "; banners: " + (await banners())); await shot("map-1280");
  await go(true); await p.evaluate(async () => { await SP.load("z8-1"); }); await shot("play-opener-1280");
});
await b.close();
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n") + "\nconsole messages: " + log.length); for (const l of log.slice(0, 10)) console.log("  " + l);
