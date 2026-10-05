// Sapper's Path v5 R4 fix (the visual critic's S5): the current-level label audit on the journey map, the critic's own
// rule: at every current level from --from to --to (levels cleared one at a time, side-quest pictures won as they open),
// the label's box against every other node, shown quest and egg, banner, open prize bubble and the Goblin King, in CSS
// px² of contact (any contact counts), and the label clipped by the screen's sides. Phone (375x812, 3x, touch) and
// desktop (1280x720). Writes nothing; prints each contact and exits 1 on any (or on a console message).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/label-audit.mjs [--url http://127.0.0.1:8491/sappers-path/] [--from 99] [--to 200]
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), lo = +arg("from", 99), hi = +arg("to", 200);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], bad = [];
for (const [vp, o] of [["phone", { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }], ["desk", { viewport: { width: 1280, height: 720 } }]]) {
  const ctx = await b.newContext(o), page = await ctx.newPage(); page.on("console", (m) => log.push(vp + " " + m.type() + ": " + m.text())); page.on("pageerror", (e) => log.push(vp + " " + e.message));
  await page.goto(URL_ + "?debug=1"); await page.waitForFunction(() => window.SP && document.fonts.status === "loaded"); await page.evaluate(() => { const d = document.getElementById("jr-dbg"); if (d) d.remove(); });
  let n0 = 0;
  for (let n = lo; n <= hi; n++) {
    const a = await page.evaluate((k) => { SP.unlockTo(k); SP.clearPictures(Math.max(0, Math.min(50, Math.floor((k - 4) / 4)))); SP.screen("map"); const d = document.getElementById("jr-dbg"); if (d) d.remove();
      const ov = (p, q) => { const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); return w > 0 && h > 0 ? Math.round(w * h) : 0; };
      const lab = document.querySelector("#jr .jr-cur"); if (!lab || !lab.offsetWidth) return { k, hits: [] }; const r = lab.getBoundingClientRect(), own = lab.closest(".mn") || Array.from(document.querySelectorAll("#jr .mn.cur"))[0];
      const hits = []; for (const x of document.querySelectorAll("#jr .mn, #jr .qn:not([hidden]), #jr .egg:not([hidden]), #jr .bn, #jr .qn.open .prz, #jr .kg")) if (x !== own && !x.contains(lab) && !lab.contains(x)) { const v = ov(r, x.getBoundingClientRect()); if (v > 0) hits.push((x.dataset.n || x.dataset.id || x.className.baseVal || x.className) + " " + v); }
      const W = innerWidth; if (r.left < 0 || r.right > W) hits.push("clipped"); return { k, cur: own ? own.dataset.n : null, side: lab.className, hits }; }, n);
    n0++; if (a.hits.length) bad.push(vp + " " + (n + 1) + " (" + a.side + "): " + a.hits.join(", "));
  }
  console.log(vp + ": " + n0 + " states audited"); await ctx.close();
}
await b.close();
console.log(bad.length ? "CONTACT " + bad.length + ":\n" + bad.join("\n") : "CONTACT: none");
console.log(log.length ? "CONSOLE " + log.length + ":\n" + log.slice(0, 20).join("\n") : "CONSOLE: 0 messages");
process.exit(bad.length || log.length ? 1 : 0);
