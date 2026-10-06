// Sapper's Path v5.4 (Peter, 2026-10-06: Reset progress and the save code): screens and measurements by real input, into
// tools/shots-v5-4/ (gitignored). Per viewport (375x812 3x touch, 360x640 3x touch, 1280x720, 812x375 3x desktop), a
// mid-campaign save (levels 1-90 won, 218 coins, 12 side quests): the settings sheet (its box, scrolling or not, each
// row's height and hit test), the reset sheet and the hold part-way (a real mouse press), the code copied (the real
// clipboard read back, permission granted), the load sheet's preview after a real paste, the toast after applying, and a
// real full hold resetting to level 1. Then the WCAG contrast of the new text, and the console messages (0 expected).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/shots-v5-4.mjs [--url http://127.0.0.1:8491/sappers-path/]
import { mkdirSync } from "node:fs"; import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/"), OUT = resolve(dirname(fileURLToPath(import.meta.url)), "shots-v5-4"); mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch(), log = [], rows = []; let bad = 0;
const check = (c, m) => { if (!c) bad++; rows.push((c ? "ok   " : "FAIL ") + m); };
const VPS = [[375, 812, 3, true, "phone"], [360, 640, 3, true, "small"], [1280, 720, 1, false, "desktop"], [812, 375, 3, false, "short"]];
for (const [w, h, dpr, touch, nm] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), p = await ctx.newPage(), tag = w + "x" + h;
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(URL_).origin });
  p.on("console", (m) => log.push(tag + " " + m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push(tag + " " + e.message));
  const tap = async (sel) => { const box = await p.locator(sel).boundingBox(); if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(120); };
  const shot = (k) => p.screenshot({ path: OUT + "/" + nm + "-" + tag + "-" + k + ".png" });
  await p.goto(URL_ + "?debug=1"); await p.waitForFunction(() => window.SP && document.fonts.status === "loaded" && document.querySelector("#title-art.on"), null, { timeout: 15000 });
  await p.evaluate(() => { localStorage.clear(); SP.unlockTo(90); SP.clearPictures(12); SP.setMeta({ coins: 218 }); SP.screen("title"); }); await p.waitForTimeout(700);
  // Settings: the box, rows, hits.
  await tap("#btn-settings"); await p.waitForTimeout(300);
  const S = await p.evaluate(() => { const c = document.querySelector("#settings .sheetcard"), r = c.getBoundingClientRect(), els = Array.from(c.querySelectorAll("button")).filter((b) => !b.hidden && b.offsetParent);
    const hit = (el) => { const q = el.getBoundingClientRect(), t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!t && (t === el || el.contains(t)); };
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height, scroll: c.scrollHeight - c.clientHeight, rows: els.map((e) => [e.id || e.className.split(" ").slice(-1)[0], Math.round(e.getBoundingClientRect().height), hit(e)]) }; });
  await shot("settings");
  check(S.top >= 0 && S.bottom <= h && S.left >= 0 && S.right <= w, tag + " settings card " + Math.round(S.h) + " px tall inside the screen" + (S.scroll > 0 ? " (scrolls " + S.scroll + " px inside)" : " (no scroll)"));
  check(S.rows.every((r) => r[1] >= 44 && (r[2] || S.scroll > 0)), tag + " settings rows (height, hit): " + S.rows.map((r) => r[0] + " " + r[1] + (r[2] ? "" : " offscreen")).join(", "));
  // Reset sheet, then a hold part-way by a real mouse press (released: nothing changes).
  await p.evaluate(() => { const c = document.querySelector("#settings .sheetcard"); c.scrollTop = c.scrollHeight; }); await tap("#set-reset"); await p.waitForTimeout(300); await shot("reset-confirm");
  const hb = await p.locator("#rs-hold").boundingBox(); await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down(); await p.waitForTimeout(800); await shot("reset-holding");
  const midT = await p.evaluate(() => document.querySelector("#rs-hold .fill").style.transform); await p.mouse.up(); await p.waitForTimeout(300);
  const still = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("sappers-path.v3")).done).length);
  check(/scaleX\(0\.[3-7]/.test(midT) && still === 90, tag + " a 0.8 s press fills part-way (" + midT + ") and letting go keeps all " + still + " levels");
  await tap("#rs-cancel");
  // Copy: the real clipboard.
  await p.evaluate(() => { const c = document.querySelector("#settings .sheetcard"); c.scrollTop = 0; }); await tap("#set-copy"); await p.waitForTimeout(400); await shot("code-copied");
  const C = await p.evaluate(async () => ({ box: document.getElementById("cs-code").value, clip: await navigator.clipboard.readText(), len: document.getElementById("cs-len").textContent, st: document.getElementById("cs-status").textContent, sum: document.getElementById("cs-sum").textContent }));
  check(C.clip === C.box && C.box.startsWith("SP1.") && C.st === "Copied to the clipboard.", tag + " Copy: the clipboard holds the code (" + C.len + "; " + C.sum + ")");
  await tap("#cs-close");
  // Load: a real paste of the code into a fresh save's sheet, the preview, apply.
  await p.evaluate(() => { localStorage.clear(); location.reload(); }); await p.waitForFunction(() => window.SP && document.querySelector("#title-art.on"), null, { timeout: 15000 }); await p.waitForTimeout(400);
  await tap("#btn-settings"); await tap("#set-load"); await p.locator("#ls-code").focus(); await p.keyboard.press((process.platform === "darwin" ? "Meta" : "Control") + "+v"); await p.waitForTimeout(250);
  const L = await p.evaluate(() => ({ v: document.getElementById("ls-code").value.length, msg: document.getElementById("ls-msg").textContent, warn: document.getElementById("ls-warn").textContent, dis: document.getElementById("ls-apply").disabled }));
  await shot("load-preview");
  check(L.v === C.box.length && !L.dis && L.msg === "Level 91, 218 coins, 12 side quests", tag + " Load: a real paste (" + L.v + " chars) previews '" + L.msg + "'; " + L.warn);
  await tap("#ls-apply"); await p.waitForTimeout(250); await shot("loaded-toast");
  const A = await p.evaluate(() => ({ play: document.getElementById("play-lab").textContent, coins: document.getElementById("home-coins").textContent, toast: document.getElementById("toast").textContent, saved: Object.keys(JSON.parse(localStorage.getItem("sappers-path.v3")).done).length }));
  check(A.play === "Level 91" && A.coins === "218" && A.saved === 90, tag + " applied: home reads " + A.play + ", " + A.coins + " coins, saved; toast '" + A.toast + "'");
  // A real full hold resets.
  await tap("#btn-settings"); await p.evaluate(() => { const c = document.querySelector("#settings .sheetcard"); c.scrollTop = c.scrollHeight; }); await tap("#set-reset");
  const hb2 = await p.locator("#rs-hold").boundingBox(); await p.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2); await p.mouse.down(); await p.waitForTimeout(1750); await p.mouse.up(); await p.waitForTimeout(150); await shot("reset-toast");
  const R = await p.evaluate(() => ({ play: document.getElementById("play-lab").textContent, toast: document.getElementById("toast").textContent, saved: JSON.parse(localStorage.getItem("sappers-path.v3")) }));
  check(R.play === "Level 1" && Object.keys(R.saved.done).length === 0 && R.saved.coins === 400, tag + " a 1.75 s real hold resets: home reads " + R.play + ", toast '" + R.toast + "'");
  // Contrast of the new text against its own background (WCAG AA: 4.5:1, 3:1 for 24 px and up).
  if (nm === "phone") {
    const K = await p.evaluate(() => { const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }, cs = (el) => getComputedStyle(el), P = getComputedStyle(document.documentElement);
      const parch = P.getPropertyValue("--parch").trim(), hex = (h) => "rgb(" + [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",") + ")";
      const t = (id, bg) => { const el = document.querySelector(id); return [id, +ratio(cs(el).color, bg).toFixed(2), parseFloat(cs(el).fontSize)]; };
      document.getElementById("ls-msg").className = "sub-sum bad"; const bad = t("#ls-msg", hex(parch)); document.getElementById("ls-msg").className = "sub-sum good"; const good = t("#ls-msg", hex(parch));
      return [t("#set-reset", hex(parch)), t("#rs-lose", hex(parch)), t("#rs-hold .hl", hex(P.getPropertyValue("--danger").trim())), t("#rs-hold .hl", hex(P.getPropertyValue("--danger-fill").trim())), t("#cs-len", hex(parch)), bad, good, t("#cs-code", "rgb(255,255,255)"), t("#toast", hex(parch))]; });
    for (const [id, r, fs] of K) check(r >= (fs >= 24 ? 3 : 4.5), "contrast " + id + " " + r + ":1 at " + fs + " px");
  }
  await ctx.close();
}
await b.close();
console.log(rows.join("\n")); console.log("fails: " + bad + "; console messages: " + log.length); for (const l of log) console.log("  " + l);
process.exit(bad || log.length ? 1 : 0);
