// Smoke test for a Sapper's Path page: the playtest bundle under its artifact-style wrapper, or the live site.
// At a phone (375x812, touch) and a desktop (1280x720) size: load, tap the first visible Play/Level button, tap a front
// card, let the show run, then report console errors, failed requests and what is on screen. Exit 1 on any failure.
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/playtest-smoke.mjs http://127.0.0.1:8494/wrap.html
//   PLAYWRIGHT_MODULE=... node tools/playtest-smoke.mjs https://pf-builds.github.io/games/sappers-path/
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const url = process.argv[2];
const shotDir = process.argv[3] || null;
if (!url) { console.error("usage: node tools/playtest-smoke.mjs <url> [screenshot-dir]"); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const vp of [{ width: 375, height: 812, touch: true, dpr: 3 }, { width: 1280, height: 720, touch: false, dpr: 1 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.touch, hasTouch: vp.touch, deviceScaleFactor: vp.dpr });
  const page = await ctx.newPage();
  const errs = [], fails = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("requestfailed", (r) => fails.push(r.url()));
  page.on("response", (r) => { if (r.status() >= 400) fails.push(r.status() + " " + r.url()); });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const skip = page.locator("#tut-offer button:visible", { hasText: /^skip$/i }).first(); // v6: the intro tour's first-launch offer
  const offered = (await skip.count()) > 0;
  if (offered) { if (vp.touch) await skip.tap(); else await skip.click(); await page.waitForTimeout(300); }
  const play =page.locator("button:visible", { hasText: /play|level/i }).first();
  const playText = (await play.count()) ? (await play.innerText()).replace(/\s+/g, " ").trim() : "(none)";
  if (await play.count()) { if (vp.touch) await play.tap(); else await play.click(); }
  await page.waitForTimeout(800);
  const cards = await page.locator("button.tile.card").count();
  const card = page.locator("button.tile.card:not([disabled])").first();
  if (await card.count()) { if (vp.touch) await card.tap(); else await card.click(); }
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ title: document.title, sp: typeof window.SP, lvl: (document.getElementById("lvl-name") || {}).textContent || "" }));
  if (shotDir) await page.screenshot({ path: `${shotDir}/smoke-${vp.width}.png` });
  const ok = errs.length === 0 && fails.length === 0 && cards > 0;
  if (!ok) bad++;
  console.log(`${vp.width}x${vp.height}: ${ok ? "OK" : "FAIL"}  play="${playText}"  level="${st.lvl}"  cards=${cards}  SP=${st.sp}  title="${st.title}"`);
  for (const e of errs) console.log("   console:", e);
  for (const f of fails) console.log("   request:", f);
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
