// Sapper's Path v7 lane T, stage 4: a save made by the shipped v6.2/v6.3 page itself (a11e9bf), for the read-back check
// (tools/space-v7/check.mjs saves). Plays nothing: it writes progress through the page's own debug hooks (SP.unlockTo,
// SP.zenTo, SP.setMeta, SP.clearPictures) so the stored JSON is exactly what that code writes, then keeps both
// localStorage keys as stored and the page's own SP2 code. Writes tools/fixtures/v6.2-save.json.
//   PLAYWRIGHT_MODULE=... node tools/space-v7/v62-fixture.mjs http://127.0.0.1:8474/   (a server on a11e9bf's sappers-path/)
const URL_ = process.argv[2], { chromium } = await import(process.env.PLAYWRIGHT_MODULE), fs = await import("fs"), path = await import("path");
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "fixtures", "v6.2-save.json");
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 375, height: 812 } }), p = await ctx.newPage(), log = [];
p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push("pageerror: " + e.message));
await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 20000 });
const made = await p.evaluate(() => {
  SP.unlockTo(37); SP.clearPictures(5); // Campaign: levels 1-37 cleared, its first 5 side quests won
  SP.setMeta({ coins: 777, eggs: { "s1-0": 1, "s2-1": 1, "s5-0": 1 }, settings: Object.assign({}, JSON.parse(localStorage.getItem("sappers-path.v3")).settings, { music: false, cb: true }) });
  SP.zenTo(2, 4); SP.zenTo(1, 12); SP.zenTo(3, 7); SP.zenTo(4, 3); // Zen: World 2 (a land world)'s first 4, World 1's first 12, World 3's first 7, World 4's first 3; Zen played last (World 4)
  SP.setMeta({ eggs: { "z1-1-0": 1, "z3-2-1": 1, "z4-1-0": 1 } }); // the Zen save's eggs (setMeta writes the mode in use)
  return { campaign: localStorage.getItem("sappers-path.v3"), zen: localStorage.getItem("sappers-path.zen.v1"), code: SP.code(), mode: SP.mode() };
});
await b.close();
const fx = Object.assign({ note: "v7 lane T: a save written by the v6.2/v6.3 page (games a11e9bf) through its debug hooks: Campaign 1-37 and 5 side quests, coins 777, castle eggs, Music off and Colour-blind marks on; Zen World 2 (Kitten Forest, a land world) 1-4, World 1 1-12, World 3 1-7, World 4 1-3 (Zen played last), three Zen eggs. campaign/zen: the two localStorage values as stored; code: that page's SP2 save code. tools/space-v7/check.mjs saves loads it on both builds and compares.", made: "a11e9bf" }, made);
fs.writeFileSync(OUT, JSON.stringify(fx, null, 1) + "\n");
console.log("fixture: " + OUT + " (mode " + made.mode + ", code " + made.code.length + " chars); console: " + log.length); for (const l of log) console.log("  " + l);
