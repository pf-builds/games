// Sapper's Path Land 1 fix pass: shots of the fixes, into tools/shots-land-01/fixes/ (gitignored). At a 375x812 phone
// (3x, touch): every land board at its start (mystery blocks in their fill), composed into two contact sheets with each
// level's number, title, tag and fill; the boards whose mystery fill is not the castle slate, and the finale, close up;
// a land level's win and jam sheets; the eggs of sheets 26-32 after level 250 (one tile each); the side quests' play bar
// with its short title. At a 360x640 phone (3x): the play bar. Console messages are kept (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-land-01-fixes.mjs [--url http://127.0.0.1:8494/sappers-path/]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const HERE = dirname(fileURLToPath(import.meta.url)), URL_ = arg("url", "http://127.0.0.1:8494/sappers-path/"), OUT = resolve(HERE, "shots-land-01/fixes"), BD = OUT + "/boards"; mkdirSync(BD, { recursive: true });
const LV = JSON.parse(readFileSync(resolve(HERE, "../tools/build-data/levels/levels.json"), "utf8")).levels.filter((l) => l.land === 1), CFG = JSON.parse(readFileSync(resolve(HERE, "../config.json"), "utf8"));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], notes = [];
const page = async (w, h) => { const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }), p = await ctx.newPage(), tag = w + "x" + h;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 }); return p; };
const p = await page(375, 812);
await p.evaluate(() => { localStorage.clear(); SP.unlockTo(250); });
// Every land board at its start.
const rows = [];
for (const L of LV) { await p.evaluate((n) => SP.load(n), L.n); await p.waitForTimeout(250); await p.locator("#board").screenshot({ path: BD + "/" + L.n + ".png" }); rows.push([L.n, L.title, L.tag, L.hideC || ""]); }
writeFileSync(BD + "/index.json", JSON.stringify(rows));
// Win and jam sheets on a land level (the first, a first clear: levels 1-200 cleared), as a player sees them.
const L0 = LV[0];
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded", null, { timeout: 20000 }); // a fresh save
await p.evaluate(([n, o]) => { SP.unlockTo(200); SP.load(n); for (const c of o) { SP.play(+c); SP.settle(); } SP.settle(); }, [L0.n, L0.win[L0.tag]]);
for (let k = 0; k < 40; k++) { await p.evaluate(() => SP.skip && SP.skip()); await p.waitForTimeout(300); if (await p.evaluate(() => !document.getElementById("panel").hidden)) break; }
await p.waitForTimeout(1200); await p.screenshot({ path: OUT + "/win-sheet-" + L0.n + ".png" }); notes.push("win: " + JSON.stringify(await p.evaluate(() => [document.getElementById("p-title").textContent, document.getElementById("p-line").textContent])));
const jam = await p.evaluate((n) => { SP.load(n); return SP.lossPlan ? SP.lossPlan() : null; }, L0.n);
if (jam && jam.prefix) { await p.evaluate((o) => { for (const c of o) { SP.play(+c); SP.settle(); } }, jam.prefix);
  for (let k = 0; k < 40; k++) { await p.evaluate(() => SP.skip && SP.skip()); await p.waitForTimeout(300); if (await p.evaluate(() => !document.getElementById("panel").hidden)) break; }
  await p.waitForTimeout(800); await p.screenshot({ path: OUT + "/fail-sheet-" + L0.n + ".png" }); notes.push("fail: " + JSON.stringify(await p.evaluate(() => [document.getElementById("p-title").textContent, document.getElementById("p-line").getAttribute("aria-label")]))); }
else notes.push("fail: no jam plan from SP.lossPlan");
// The side quests' play bar (short titles), each picture once.
const GL = JSON.parse(readFileSync(resolve(HERE, "../tools/build-data/levels/gallery.json"), "utf8")).levels.filter((g) => g.land === 1 && g.short);
for (const g of GL) { await p.evaluate((id) => SP.load(id), g.id); await p.waitForTimeout(250); await p.locator("#top").screenshot({ path: OUT + "/quest-bar-375-" + g.n + ".png" }); notes.push("quest " + g.n + ": '" + (await p.evaluate(() => document.getElementById("lvl-name").textContent)) + "' (full: " + g.title + ")"); }
// The eggs of sheets 26-32 (levels 1-250 open, none found yet): a 150 px tile round each.
await p.evaluate(() => { localStorage.clear(); SP.unlockTo(250); SP.screen("map"); }); await p.waitForTimeout(1500);
const eggs = await p.evaluate(() => Array.from(document.querySelectorAll("#jr .egg")).filter((e) => !e.hidden && +(e.dataset.id || "s0").slice(1).split("-")[0] >= 26).map((e) => e.dataset.id));
for (const id of eggs) { await p.evaluate((id) => document.querySelector('#jr .egg[data-id="' + id + '"]').scrollIntoView({ block: "center" }), id); await p.waitForTimeout(700);
  const r = await p.evaluate((id) => { const q = document.querySelector('#jr .egg[data-id="' + id + '"]').getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, kind: document.querySelector('#jr .egg[data-id="' + id + '"]').getAttribute("aria-label") }; }, id);
  await p.screenshot({ path: OUT + "/egg-" + id + ".png", clip: { x: Math.max(0, r.x - 75), y: Math.max(0, r.y - 75), width: 150, height: 150 } }); notes.push("egg " + id + ": " + r.kind); }
await p.context().close();
// The play bar at 360x640 (the tap boxes: selfTest measures them).
const q = await page(360, 640); await q.evaluate(() => { localStorage.clear(); SP.unlockTo(250); SP.load(206); }); await q.waitForTimeout(500); await q.locator("#top").screenshot({ path: OUT + "/playbar-360x640.png" }); await q.screenshot({ path: OUT + "/play-360x640-206.png" }); await q.context().close();
await b.close();
// Contact sheets (Python with Pillow): 25 boards each, 5 across, labelled; and the mystery close-ups.
execFileSync(process.env.LAND_PYTHON || "python3", ["-c", `
import json, sys
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; rows = json.load(open(D + "/boards/index.json")); slate = sys.argv[2]
def font(s):
  try: return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", s)
  except Exception: return ImageFont.load_default()
F = font(26)
def sheet(rs, out, cols=5, tw=330):
  ims = [(r, Image.open(D + "/boards/%d.png" % r[0]).convert("RGB")) for r in rs]
  th = max(int(im.height * tw / im.width) for _, im in ims) + 40
  o = Image.new("RGB", (cols * (tw + 10) + 10, ((len(ims) + cols - 1) // cols) * (th + 10) + 10), (24, 22, 30)); d = ImageDraw.Draw(o)
  for i, (r, im) in enumerate(ims):
    x, y = 10 + (i % cols) * (tw + 10), 10 + (i // cols) * (th + 10); s = im.resize((tw, int(im.height * tw / im.width)))
    o.paste(s, (x, y + 36)); d.text((x, y), "%d %s (%s)" % (r[0], r[1], r[2][0].upper()), fill=(240, 230, 210), font=F)
    if r[3]: d.rectangle([x + tw - 26, y + 4, x + tw - 4, y + 28], fill=r[3], outline=(240, 230, 210))
  o.save(out)
sheet(rows[:25], D + "/contact-201-225.png"); sheet(rows[25:], D + "/contact-226-250.png")
sheet([r for r in rows if r[3] and r[3] != slate] + [r for r in rows if r[0] == rows[-1][0] and not (r[3] and r[3] != slate)], D + "/mystery-fills.png", cols=4, tw=420)
`, OUT, CFG.board.hidden.c]);
writeFileSync(OUT + "/notes.txt", notes.join("\n") + "\nconsole messages: " + log.length + "\n" + log.join("\n") + "\n");
console.log(notes.join("\n")); console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = log.length ? 1 : 0;
