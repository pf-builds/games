// Sapper's Path lands foundation: SP.selfTest() under ?debug=1 at a 375x812 phone (3x, touch) and a 1280x720 desktop, with
// every console message kept. Used on the branch (no land) and on a game copy with a land installed (--url).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/selftest-lands.mjs [--url http://127.0.0.1:8494/sappers-path/]
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8494/sappers-path/");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = []; let bad = 0;
for (const [w, h, dpr, touch] of [[375, 812, 3, true], [1280, 720, 1, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h + "@" + dpr;
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " pageerror: " + e.message));
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 20000 });
  const st = await p.evaluate(() => SP.selfTest());
  if (st.fail.length) bad += st.fail.length;
  console.log(tag + ": " + st.pass + " passed, " + st.fail.length + " failed (" + Math.round(st.ms || 0) + " ms)" + (st.notes && st.notes.playGear ? "; play gear " + st.notes.playGear : ""));
  for (const f of st.fail) console.log("  FAIL " + f);
  await ctx.close();
}
await b.close();
console.log("console messages: " + log.length); for (const l of log.slice(0, 20)) console.log("  " + l);
process.exitCode = bad || log.length ? 1 : 0;
