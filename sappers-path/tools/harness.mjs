#!/usr/bin/env node
// Sapper's Path v3 harness (M2, updated for playtest 1's dispatch model). Headless Chromium via Playwright, real input for every play (a move is ONE tap on a
// front card, SPEC-v3 §3). Four viewports: 375×812 portrait phone (touch), 812×375 landscape (touch until v4.2's fix; a short desktop window since, as a phone held sideways shows the upright card), 1280×720
// desktop (mouse), and a 400×600 iframe inside a portal-style host page (tools/iframe-host.html, mouse). Per viewport,
// on a fresh profile:
//   portal shape: every request same-origin (no external requests), payload bytes, load-to-gameplay time and clicks
//   (the title's Play is the one click), no page scrollbars on the title, map and level, primary buttons hittable;
//   SP.selfTest(); level 1's coach line and arrow; a patient win on level 1 through the card buttons (tap, then wait
//   until every squad is home), the goblin, the win panel, Next reaches level 2; a jam loss through the cards (v3.1: a
//   patient order that fills every space with squads that can't reach), the sheet naming the crews, one Retry tap
//   restarts; a full line (v3.1): every front card wears the lock, a real tap on one is refused (nothing changes, the
//   toast), and plays once a squad is home; stuck and working squads; the near-jam warning; the victory march; live frame times with three rapid taps on levels 65 and 70 at 1x and 3x, and the draw cost; the Era 3
//   board's CSS px per cell (8 or more required);
//   pause and resume: on window blur (a real focus change to the host page in the iframe run) and on a hidden tab,
//   the clock stops, the Paused sheet takes the next tap, the game resumes without a jump and no card is played;
//   the map button; a garbage save loads clean.
// Then a hidden-tab load (document.hidden faked, rAF held, driven by SP.tick) that runs selfTest and wins a level.
// Zero console errors AND warnings anywhere.
// v4 M1: the speed button cycles 1x, 2x, 3x (the rapid-tap frame check runs at 1x and 3x); the speed and the colour-blind
// toggle persist across a reload. The M1 screens themselves come from tools/shots-v4-m1.mjs.
// v4 M2: each debug level opens from the map's "v4 twists" row by a real tap (8 CSS px a cell or more, no scrollbars),
// and a real tap on a linked card sends both squads (two spaces taken). The M2 screens come from tools/shots-v4-m2.mjs.
// v4 M3 (the Siege to 100): the cell-size check covers all 100 boards (the smallest per era, 8 CSS px or more at every
// viewport, a screen of the smallest), the frame check adds level 100 (the boss), output to tools/shots-v4-m3/harness/.
// The M3 screens come from tools/shots-v4-m3.mjs.
// v4 M4 (the Gallery): the map's Gallery button is padlocked until level 25 is won; once it is (SP.unlockGallery), a real
// tap opens the Gallery, a real tap on a painting's tile plays it (a real card tap, sappers in from the board's edges),
// the top bar's button goes back to the grid; every Gallery board keeps 8 CSS px a cell or more (the smallest reported,
// with a screen). Output to tools/shots-v4-m4/harness/.
// v4 Critics 2 fix: six viewports (375x667 and 414x736 added); the coach's checks per viewport are selfTest's.
// v4.3: no difficulty picker (SP.load plays a level on its own tag); a format-1 save migrates to format 2 by level id.
// v4.3 fix: a seventh viewport, 360x740 (a 360-wide Android phone: the play screen's 4 px gutter gives 8 px cells).
// v4.1 (castle pictures, bottom entry): a real card tap on a Gallery picture sends its squad out of its crate and up
// through the entry square (was: in from the board's edges); every Siege and Gallery board keeps 8 CSS px a cell. Output
// to tools/shots-v4.1/harness/.
// v4 M5 (the meta layer): the home's Play reads the next level and one real tap reaches it; the settings sheet opens and
// closes by real taps; the power-up bar through real taps (a Ladder bought and used on level 1: one more space; a
// Quartermaster bought, asked for and applied to a real tile on level 40); every bar on screen. The colour-blind toggle
// that persists is the settings sheet's. Output to tools/shots-v4-m5/harness/.
// v4 Critics 1 fix: the coach check asks that its line fits its box (one line or two); the jam sheet shows a colour chip
// per jammed squad, names the crews in its aria-label and never slices the holding line. The fix pass's screens and
// measurements come from tools/shots-v4-fix1.mjs; selfTest carries the per-viewport checks (coach clear of the board,
// the arrow clear of every count, every count clear of its space's badges, rods over no third tile, sheets whole).
// Screenshots (default tools/shots-v4-m1/harness/): v3.1 at 375×812: stuck-vs-working, near-jam, full-blocked, refused, jam-sheet,
// victory-march; and, as before, 375×812 level 1 teach, level 26 gate teach, level 51 archer hit, the
// win mid-collapse and the goblin fleeing, a fail; 375 and 1280: two and three overlapping squads mid-show; frame
// strips (six frames 300 ms apart, stitched): a first squad still working while a second heads out, and level 3's
// "only what can reach goes, then the next round"; 812×375 an Era 3 board; the iframe mid-level.
//
//   export PATH="$HOME/.local/opt/node/bin:$PATH"
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/harness.mjs [--url http://127.0.0.1:8491/sappers-path/] [--out tools/shots-v3.1]
//
// Exit 0: every assertion passed. Exit 1: an assertion or console message. Exit 2: the harness crashed or ran out of
// time. Every page.evaluate is a short call; every wait has its own timeout; the whole run has a wall budget.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://127.0.0.1:8491/sappers-path/");
const ORIGIN = new URL(URL_).origin;
const OUT = resolve(arg("out", resolve(here, "shots-v4.1", "harness")));
// v4 M3: every one of the 100 boards keeps MIN_CELL CSS px a cell at every viewport (the smallest per era is reported;
// the boss at 100 is the smallest, exactly 8 in the 400x600 iframe). v4.2 (full-screen boards from level 26, sized for a
// 375x812 phone at 8 CSS px): phones keep 8 (vp.minCell), the small frames (the 400x600 iframe, the short landscape
// phone) 6.
const WALL_MS = 1200000, MIN_CELL = 8; // Critics 2 fix: two more viewports
mkdirSync(OUT, { recursive: true });
const wall = setTimeout(() => { console.error("harness: wall budget exceeded"); process.exit(2); }, WALL_MS);

async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright"].filter(Boolean)) { try { return await import(m); } catch (e) { /* next */ } }
  throw new Error("playwright not found: set PLAYWRIGHT_MODULE to its index.mjs");
}
const report = { url: URL_, runs: {}, hidden: null, fails: [], console: [] };
const fail = (m) => { report.fails.push(m); console.log("FAIL " + m); };
const ok = (c, m) => { if (!c) fail(m); return !!c; };
// Critics 2 fix (V1): 375x667 (iPhone SE/8) and 414x736 (iPhone 8 Plus), where the teaching coach used to clip; selfTest
// there checks every teaching level's line at every step of its stored order (fits its box, off the board).
const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812, touch: true, dpr: 2, shots: "375" },
  { name: "375x667", width: 375, height: 667, touch: true, dpr: 2, shots: "667" },
  { name: "414x736", width: 414, height: 736, touch: true, dpr: 3, shots: "736" },
  { name: "360x740", width: 360, height: 740, touch: true, dpr: 3, shots: "360" }, // v4.3 fix (n1): a 360-wide Android phone, 8 px cells
  { name: "812x375", width: 812, height: 375, touch: false, dpr: 3, shots: "812", minCell: 6 }, // v4.2 fix: a short desktop window (a phone held so shows the upright card: below)
  { name: "1280x720", width: 1280, height: 720, touch: false, dpr: 1, shots: "1280" },
  { name: "iframe-400x600", width: 480, height: 700, touch: false, dpr: 2, shots: "iframe", iframe: { w: 400, h: 600 }, minCell: 6 },
];

// Screens for playtest 1: two and three overlapping squads mid-show (the first still out), and two frame strips.
async function overlapShots(page, ev, tap, shot, tag, R) {
  const reach = () => ev(() => { const st = SP.state(), o = [], p = []; st.fronts.forEach((f, j) => { if (f) (SP.reachable(f.mat) > 0 ? o : p).push(j); }); return o.concat(p); });
  const hold = (ms) => ev((m) => { SP.tick(m); return SP.state(); }, ms);
  R.shots = R.shots || {};
  // Two, then three squads out on level 65.
  await ev(() => { SP.speed(1); SP.load(65); });
  let cols = await reach(); await tap(`.card[data-col="${cols[0]}"]`); await hold(700);
  cols = await reach(); if (cols.length) await tap(`.card[data-col="${cols[0]}"]`); let st = await hold(700);
  await shot("two-squads"); R.shots.two = { spaces: st.line.length, runners: st.runners };
  cols = await reach(); if (cols.length) await tap(`.card[data-col="${cols[0]}"]`); st = await hold(500);
  await shot("three-squads"); R.shots.three = { spaces: st.line.length, runners: st.runners };
  if (tag !== "375") return;
  // Frame strips: six frames 300 ms apart (engine time), the board region only, stitched side by side.
  const board = await page.locator("#board").boundingBox(), clip = { x: board.x, y: board.y, width: board.width, height: board.height };
  const strip = async (name, setup) => {
    await setup(); const bufs = [];
    for (let k = 0; k < 6; k++) { bufs.push(await page.screenshot({ clip })); await hold(300); }
    R.shots[name] = await stitch(page, bufs, resolve(OUT, tag + "-" + name + ".png"));
  };
  await strip("strip-overlap", async () => { await ev(() => SP.load(65)); const c = await reach(); await tap(`.card[data-col="${c[0]}"]`); await hold(1800); const c2 = await reach(); if (c2.length) await tap(`.card[data-col="${c2[0]}"]`); await hold(60); });
  await strip("strip-next-round", async () => { await ev(() => SP.load(3)); const c = await ev(() => SP.state().fronts.findIndex((f) => f && SP.reachable(f.mat) > 0 && f.n > SP.reachable(f.mat))); /* v4.1: the squad bigger than its reach */ await tap(`.card[data-col="${c}"]`); await hold(200); });
}
// Stitch PNG buffers side by side on a canvas in a scratch page; writes the file, returns its size.
async function stitch(page, bufs, file) {
  const ctx = page.context(), p = await ctx.newPage();
  const urls = bufs.map((b) => "data:image/png;base64," + b.toString("base64"));
  const out = await p.evaluate(async (list) => {
    const imgs = await Promise.all(list.map((u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; })));
    const gap = 6, w = imgs.reduce((s, i) => s + i.width + gap, -gap), h = Math.max(...imgs.map((i) => i.height)), c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.fillStyle = "#221a26"; g.fillRect(0, 0, w, h); let x = 0; for (const i of imgs) { g.drawImage(i, x, 0); x += i.width + gap; }
    return { url: c.toDataURL("image/png"), w, h };
  }, urls);
  writeFileSync(file, Buffer.from(out.url.split(",")[1], "base64")); await p.close();
  return { w: out.w, h: out.h };
}

async function run() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      const R = (report.runs[vp.name] = {}), tag = vp.name;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch });
      const page = await ctx.newPage();
      const reqs = []; let bytes = 0;
      page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push(tag + " " + m.type() + ": " + m.text()); });
      page.on("pageerror", (e) => report.console.push(tag + " pageerror: " + e.message));
      page.on("request", (r) => reqs.push(r.url()));
      page.on("requestfinished", async (r) => { try { const s = await r.sizes(); bytes += s.responseBodySize + s.responseHeadersSize; } catch (e) { /* not counted */ } });
      const t0 = Date.now();
      let F;
      if (vp.iframe) {
        await page.goto(URL_ + "tools/iframe-host.html?w=" + vp.iframe.w + "&h=" + vp.iframe.h, { waitUntil: "load" });
        const fh = await page.waitForSelector("#game", { timeout: 10000 });
        for (let k = 0; k < 100 && !(F = await fh.contentFrame()); k++) await page.waitForTimeout(50);
      } else { await page.goto(URL_ + "?debug=1", { waitUntil: "load" }); F = page.mainFrame(); }
      await F.waitForFunction(() => window.SP && document.querySelector("#title:not([hidden])"), null, { timeout: 15000 });
      R.titleReadyMs = Date.now() - t0;
      const L = (sel) => (vp.iframe ? page.frameLocator("#game").locator(sel) : page.locator(sel)).first();
      const tap = async (sel) => { const l = L(sel); if (vp.touch) await l.tap({ timeout: 5000 }); else await l.click({ timeout: 5000 }); };
      const ev = (fn, a) => F.evaluate(fn, a);
      const S = () => ev(() => SP.state());
      const noScroll = () => ev(() => { const d = document.documentElement; return d.scrollWidth <= d.clientWidth && d.scrollHeight <= d.clientHeight && document.body.scrollHeight <= d.clientHeight; });
      const hit = (sel) => ev((sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t)); }, sel);
      const shot = (name) => page.screenshot({ path: resolve(OUT, vp.shots + "-" + name + ".png") });

      // Portal shape: one click from load to gameplay.
      ok(await noScroll(), tag + " title: no scrollbars");
      ok(await hit("#btn-play"), tag + " title Play is hittable");
      // v4 M5, the home: Play reads the next level; the settings sheet opens and closes by real taps.
      { const lab = await L("#play-lab").textContent(), coins = await L("#home-coins").textContent();
        ok(lab === "Level 1" && /^\d+$/.test(coins) && !(await L("#home-lives").isVisible()), tag + " home: Play reads '" + lab + "', " + coins + " coins, no lives pill"); }
      await tap("#btn-play"); let clicks = 1;
      await F.waitForFunction(() => SP.state().screen === "play", null, { timeout: 5000 });
      R.loadToGameplayMs = Date.now() - t0; R.clicksToGameplay = clicks;
      let s = await S();
      ok(s.screen === "play" && s.n === 1 && s.status === "playing", tag + " title Play reaches level 1 in one tap (" + s.screen + " " + s.n + ")");
      ok(R.loadToGameplayMs < 20000, tag + " load to gameplay under 20 s (" + R.loadToGameplayMs + " ms)");
      ok(await noScroll(), tag + " level: no scrollbars");
      // Level 1's coach: one line and the arrow on a card.
      const co = await ev(() => SP.coach());
      ok(co.on && co.hand && co.fits && /card/.test(co.target || ""), tag + " level 1: the coach line fits its box and its arrow is on a card (" + JSON.stringify(co) + ")");
      await page.waitForTimeout(350);
      if (vp.shots === "375") await shot("teach-l1");

      // selfTest (every check through the play entry point), then back to level 1.
      const st = await ev(() => SP.selfTest());
      R.selfTest = { pass: st.pass, fail: st.fail, ms: st.ms, notes: st.notes };
      ok(st.fail.length === 0, tag + " selfTest: " + st.fail.join("; "));
      await ev(() => SP.load(1));

      // v4 M5, the power-up bar through real taps: a Ladder bought and used on level 1 (one more space), a Quartermaster
      // bought, asked for and applied to a real tile on level 40; every badge on screen.
      { await ev(() => SP.load(1)); const m0 = await ev(() => SP.meta()), cap0 = (await S()).cap;
        const onScreen = await ev(() => Array.from(document.querySelectorAll(".pw")).every((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
        await tap('.pw[data-k="0"]'); const m1 = await ev(() => SP.meta()); await tap('.pw[data-k="0"]'); const m2 = await ev(() => SP.meta()), s1 = await S();
        ok(onScreen && m1.inv.ladder === 1 && m1.coins < m0.coins && m2.inv.ladder === 0 && s1.cap === cap0 + 1, tag + " power-up bar: every badge on screen; a real tap buys a Ladder (" + m0.coins + " -> " + m1.coins + " coins), a second uses it (" + cap0 + " -> " + s1.cap + " spaces)");
        await ev(() => SP.load(40)); await tap('.pw[data-k="1"]'); await tap('.pw[data-k="1"]');
        const ask = await ev(() => document.querySelectorAll("#tray .tile.next.pickable").length); await tap("#tray .tile.next.pickable");
        const m3 = await ev(() => SP.meta()), s3 = await S();
        ok(ask > 0 && m3.inv.quartermaster === 0 && m3.used[1] === 1 && m3.pick === -1, tag + " power-up bar: a real tap buys a Quartermaster, a second asks (" + ask + " tiles glow), a real tap on a tile sends it out (v5 R1)");
        await page.waitForTimeout(200); if (vp.shots === "375" || vp.shots === "iframe") await shot("power-bar"); await ev(() => SP.load(1)); }
      // A patient win through the cards: tap, then wait until every squad is home, then the next tap.
      const quiet = () => ev(() => { for (let i = 0; i < 6000 && SP.state().busy; i++) SP.tick(16); return SP.state(); });
      const win = await ev(() => SP.winOrder());
      for (const c of win) { await tap(`.card[data-col="${c}"]`); await quiet(); }
      s = await S();
      ok(s.status === "won" && s.plays === win.length && !s.busy, tag + " level 1 won patiently through the cards (" + s.status + ", " + s.plays + " plays)");
      s = await ev(() => SP.tick(1600));
      ok(s.goblin || s.panel === "win", tag + " the goblin flees once the squads are home");
      s = await ev(() => SP.tick(3000));
      ok(s.panel === "win" && (await L("#p-title").textContent()) === "Fort razed!", tag + " win panel");
      await page.waitForTimeout(400);
      await tap("#p-primary");
      s = await S();
      ok(s.n === 2 && s.status === "playing" && s.panel === null, tag + " Next level loads level 2");

      // A jam loss through the cards (v3.1): a patient order that fills every space with squads that can't reach a block.
      const plan = await ev(() => { for (let n = 46; n <= 75; n++) { SP.load(n); const p = SP.lossPlan(); if (p) return Object.assign({ n }, p); } return null; });
      if (ok(!!plan, tag + " found a patient order that jams a late level")) {
        await ev((n) => SP.load(n), plan.n);
        for (const c of plan.prefix) { await tap(`.card[data-col="${c}"]`); await quiet(); }
        s = await S();
        ok(s.status === "failed" && s.reason === "jam" && s.li.stuck === s.cap, tag + " the line jams at rest: every space stuck (" + s.status + " " + s.reason + ", " + JSON.stringify(s.li) + ")");
        s = await ev(() => { for (let i = 0; i < 600 && !SP.state().panel; i++) SP.tick(16); return SP.state(); });
        const pl = (await L("#p-line").getAttribute("aria-label")) || "", chips = await ev(() => document.querySelectorAll("#p-line .chip").length), cut = await ev(() => { const a = document.getElementById("panel").getBoundingClientRect(), l = document.getElementById("line").getBoundingClientRect(); return a.top > l.top + 0.5 && a.top < l.bottom - 0.5; });
        ok(s.panel === "fail" && /^Line jammed: .+ can't reach a block\.$/.test(pl) && chips === s.cap && !cut, tag + " the jam sheet shows a colour chip per jammed squad (" + chips + "), names the crews in its label (" + pl + ") and leaves the line whole");
        await page.waitForTimeout(400);
        if (vp.shots === "375") await shot("jam-sheet");
        await tap("#p-primary");
        s = await S();
        ok(s.status === "playing" && s.plays === 0 && s.panel === null, tag + " one tap on Retry restarts");
        R.loss = plan;
      }

      // v3.1 line states through the real buttons. Full line: every front card wears the lock and the head says wait; a
      // real tap on one is refused (the tray and play count don't change, no fail, the toast; the byte-identical engine
      // check is selfTest's, since the clock runs here), and the same card plays once a squad is home.
      { const full = await ev(() => SP.fill());
        const locks = await ev(() => Array.from(document.querySelectorAll(".card")).filter((b, j) => SP.state().fronts[j]).every((b) => b.classList.contains("blocked")));
        ok(full.li.full && locks && full.status === "playing", tag + " full line: every front card wears the lock (" + full.taps + ", " + JSON.stringify(full.li) + ")");
        await page.waitForTimeout(250);
        if (vp.shots === "375") await shot("full-blocked");
        const col = full.fronts.findIndex((f) => f), before = await ev(() => JSON.stringify([SP.state().fronts, SP.state().plays, SP.state().refused]));
        await tap(`.card[data-col="${col}"]`);
        const after = await ev(() => JSON.stringify([SP.state().fronts, SP.state().plays, SP.state().refused - 1]));
        await page.waitForTimeout(90);
        if (vp.shots === "375") await shot("refused");
        s = await S();
        ok(before === after && s.refused >= 1 && s.status === "playing" && (await L("#toast").isVisible()), tag + " a real tap on a blocked card is refused: nothing changes, the toast shows (" + (await L("#toast").textContent()) + ")");
        s = await ev(() => { for (let i = 0; i < 3000 && SP.state().li.full; i++) SP.tick(16); return SP.state(); });
        const p0 = s.plays; await tap(`.card[data-col="${col}"]`); s = await S();
        ok(s.plays === p0 + 1, tag + " once a squad is home, the same card plays"); }
      // Stuck and working, and the near jam (patient taps of fronts with nothing in reach, then rushed ones with reach).
      { const sw = await ev(() => { const r = SP.stage(16, 2, 2); SP.tick(400); return r && SP.state(); });
        ok(!!sw && sw.li.stuck === 2 && sw.li.work >= 1, tag + " stuck and working squads side by side (" + (sw && JSON.stringify(sw.li)) + ")");
        if (vp.shots === "375" && sw) await shot("stuck-vs-working");
        const nj = await ev(() => { const r = SP.stage(16, 3, 1); SP.tick(300); return r && SP.state(); });
        ok(!!nj && nj.li.near && (await L("#line-lab").textContent()) === "One space left", tag + " near jam: 'One space left' (" + (nj && JSON.stringify(nj.li)) + ")");
        if (vp.shots === "375" && nj) await shot("near-jam"); }
      // Victory march: level 3's stored line through the cards; once the tray is empty the pace goes to 1.5x.
      { await ev(() => { SP.speed(1); SP.load(3); });
        const o = await ev(() => SP.winOrder());
        for (let i = 0; i < o.length; i++) { await tap(`.card[data-col="${o[i]}"]`); if (i < o.length - 1) await quiet(); }
        s = await ev(() => SP.tick(400));
        ok(s.march && s.pace === 1.5 && s.busy && (await L("#line-lab").textContent()).startsWith("Victory march"), tag + " victory march: the tray is empty and the line wins: 1.5x (" + s.pace + ")");
        if (vp.shots === "375") await shot("victory-march");
        s = await quiet(); ok(s.status === "won", tag + " victory march ends in the win"); }

      // Three rapid taps on levels 65, 70 and 100 (v4 M3: the boss, the biggest squads), at 1x and 3x: live frame times while the squads overlap, then the JS cost
      // of one draw at that moment.
      const rapid = async (n, fast) => {
        await ev((a) => { SP.load(a[0]); SP.speed(a[1] ? 3 : 1); }, [n, fast]);
        const cols = await ev(() => { const st = SP.state(), o = [], p = []; st.fronts.forEach((f, j) => { if (f) (SP.reachable(f.mat) > 0 ? o : p).push(j); }); return o.concat(p); });
        for (const c of cols.slice(0, 3)) await tap(`.card[data-col="${c}"]`);
        // Peak runners and squads out are sampled every 8th frame (at 3x the squads can be home before the window ends).
        return ev(() => new Promise((res) => { const d = []; let last = performance.now(), runners = 0, spaces = 0; const f = (t) => { d.push(t - last); last = t; if (d.length % 8 === 1) { const s = SP.state(); runners = Math.max(runners, s.runners); spaces = Math.max(spaces, s.line.length); } if (d.length < 120) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ n: d.length, p50: +d[60].toFixed(1), p95: +d[113].toFixed(1), max: +d[119].toFixed(1), runners, spaces }); } }; requestAnimationFrame(f); }));
      };
      R.frames = {};
      for (const n of [65, 70, 100]) for (const fast of [false, true]) {
        const fr = await rapid(n, fast); R.frames["L" + n + (fast ? " 3x" : " 1x")] = fr;
        ok(fr.p95 < 25 && fr.spaces >= 2, tag + " frame time with overlapping squads, level " + n + (fast ? " 3x" : " 1x") + " (p95 " + fr.p95 + " ms, peak " + fr.runners + " runners, " + fr.spaces + " squads)");
      }
      await ev(() => { SP.speed(1); SP.load(70); });
      { const cols = await ev(() => { const st = SP.state(), o = []; st.fronts.forEach((f, j) => { if (f && SP.reachable(f.mat) > 0) o.push(j); }); return o; }); for (const c of cols.slice(0, 3)) await tap(`.card[data-col="${c}"]`); }
      await ev(() => SP.tick(900));
      const perf = await ev(() => SP.perf(120));
      R.midShow = { perf };
      ok(perf.runners >= 3, tag + " runners are out mid-show (" + JSON.stringify(perf) + ")");
      ok(perf.mean < 4 && perf.max < 12, tag + " draw cost mid-show (mean " + perf.mean + " ms, max " + perf.max + " ms)");
      if (vp.shots === "iframe") await shot("mid-show");
      if (vp.shots === "375" || vp.shots === "1280") await overlapShots(page, ev, tap, shot, vp.shots, R);
      await ev(() => SP.settle());

      // v4 M3: every board's CSS px per cell (turned a quarter on a landscape phone), the smallest per era.
      const cells = await ev(() => { const by = {}; for (let n = 1; n <= 100; n++) { const st = SP.load(n); if (st.n !== n) continue; const e = st.era, px = +(st.cs / devicePixelRatio).toFixed(2); if (!by[e] || px < by[e].px) by[e] = { n, px, turned: document.body.classList.contains("turned") }; } return by; });
      R.minCellCss = cells;
      const worst = Object.values(cells).reduce((a, b) => (b.px < a.px ? b : a));
      ok(worst.px >= (vp.minCell || MIN_CELL), tag + " every board keeps " + (vp.minCell || MIN_CELL) + " CSS px a cell or more (smallest per era: " + JSON.stringify(cells) + ")");
      await ev((n) => SP.load(n), worst.n); await page.waitForTimeout(300); await shot("smallest-cell");
      ok(await noScroll(), tag + " the smallest-cell level: no scrollbars");

      // Pause on blur, resume with one tap on the Paused sheet: no clock jump, no card played.
      await ev(() => SP.load(3));
      if (vp.iframe) { await L("#board").click({ timeout: 5000, force: true }); await page.locator("#host-btn").click(); }
      else await ev(() => window.dispatchEvent(new Event("blur")));
      await page.waitForTimeout(60);
      const c1 = await S(); await page.waitForTimeout(450); const c2 = await S();
      ok((await ev(() => SP.paused())) && c1.clock === c2.clock && (await hit("#pause")) && !(await hit(".card")), tag + " blur pauses: the clock stops and the Paused sheet covers the cards (" + c1.clock + " → " + c2.clock + ")");
      await tap("#pause"); await page.waitForTimeout(300); const c3 = await S();
      ok(!(await ev(() => SP.paused())) && c3.plays === 0 && c3.clock > c2.clock && c3.clock - c2.clock < 1000, tag + " one tap resumes, no jump (" + (c3.clock - c2.clock) + " ms over ~300 ms), no card played");
      // A hidden tab pauses too.
      await ev(() => { Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
      const h1 = await S(); await page.waitForTimeout(300); const h2 = await S();
      ok((await ev(() => SP.paused())) && h1.clock === h2.clock, tag + " a hidden tab pauses the clock");
      await ev(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
      await tap("#pause"); ok(!(await ev(() => SP.paused())), tag + " back from a hidden tab: one tap resumes");
      R.pause = { blurFrozen: c1.clock === c2.clock, resumeDeltaMs: c3.clock - c2.clock };

      // Map through its button.
      await tap("#btn-map");
      s = await S();
      ok(s.screen === "map" && (await hit("#map-play")) && (await noScroll()), tag + " map button; map Play hittable; no scrollbars");
      // v4 M2 debug levels: each from the map's debug row by a real tap; a real tap on a linked card takes two spaces.
      R.debug = {};
      for (const id of ["v4-mystery", "v4-linked", "v4-locked", "v4-all"]) {
        await ev(() => { SP.screen("map"); document.getElementById("map").scrollTop = 0; });
        await tap(`.dbg-node[data-id="${id}"]`); s = await S();
        R.debug[id] = { cell: +(s.cs / (vp.dpr || 1)).toFixed(2), hidden: s.hidden, links: s.links, open: s.open, cap: s.cap };
        ok(s.screen === "play" && s.id === id && s.debug && s.cs / (vp.dpr || 1) >= (vp.minCell || MIN_CELL) && (await noScroll()), tag + " " + id + " opens from the map's debug row (" + JSON.stringify(R.debug[id]) + ")");
        if (id === "v4-linked") { // v4.3: the stored order up to its first pair (both cards at a front), then a real tap on it
          const pre = await ev(() => { const o = SP.winOrder(), cs = () => document.querySelectorAll("#tray .card"); let i = 0; for (; i < o.length && !cs()[+o[i]].classList.contains("linked"); i++) { SP.play(+o[i]); SP.settle(); }
            const st = SP.state(); return { lj: i < o.length ? +o[i] : -1, line: st.line.length, plays: st.plays }; });
          await tap(`.card[data-col="${pre.lj}"]`); s = await S(); ok(pre.lj >= 0 && s.line.length === pre.line + 2 && s.plays === pre.plays + 1, tag + " a real tap on a linked card (its partner at a front) sends both squads (" + (s.line.length - pre.line) + " spaces, " + (s.plays - pre.plays) + " play)"); }
        if (id === "v4-locked") ok(s.open === s.cap - 1 && (await ev(() => { const q = document.querySelectorAll(".slot")[SP.state().cap - 1]; return q.classList.contains("locked") && !q.hidden; })), tag + " the locked space shows its padlock");
      }

      // v4 M5: the home's settings sheet by real taps.
      { await ev(() => SP.screen("title")); await page.waitForTimeout(150); await tap("#btn-settings"); const open = await L("#settings").isVisible();
        if (vp.shots === "375") await shot("settings");
        await tap("#set-close"); ok(open && !(await L("#settings").isVisible()), tag + " home: the gear opens the settings sheet and Done closes it"); }
      // v4 M4, the Gallery: locked on the map until level 25 is won; then a real tap opens it and a real tap on a painting
      // plays it; every Gallery board's cell size.
      {
        await ev(() => { SP.screen("map"); document.getElementById("map").scrollTop = 0; });
        ok(await ev(() => document.getElementById("map-gallery").classList.contains("locked")), tag + " the map's Gallery button is padlocked before level 25 is won");
        await L("#map-gallery").click({ force: true, timeout: 5000 }); s = await S(); ok(s.screen === "map", tag + " a tap on the locked (aria-disabled) Gallery button stays on the map");
        ok(await ev(() => SP.unlockGallery()), tag + " level 25 won: the Gallery opens");
        await ev(() => SP.screen("map")); await tap("#map-gallery"); s = await S();
        const nt = await ev(() => document.querySelectorAll("#gal-grid .gal-tile").length);
        ok(s.screen === "gallery" && nt === (await ev(() => SP.gallery().length)) && (await noScroll()), tag + " a real tap opens the Gallery: " + nt + " pictures, no page scrollbars");
        if (vp.shots === "375" || vp.shots === "1280") await shot("gallery");
        const gi = await ev(() => SP.gallery().findIndex((id) => /^g-met-/.test(id)));
        // v4.3: the pictures open in order; the painting's tile is padlocked (a tap stays on the Gallery) until the ones
        // before it are cleared.
        await ev((i) => document.querySelectorAll("#gal-grid .gal-tile")[i].scrollIntoView({ block: "center" }), gi);
        await L(`#gal-grid .gal-tile:nth-child(${gi + 1})`).click({ force: true, timeout: 5000 }); s = await S(); ok(s.screen === "gallery", tag + " v4.3: a tap on a padlocked picture stays on the Gallery");
        await ev((i) => { SP.clearPictures(i); document.querySelectorAll("#gal-grid .gal-tile")[i].scrollIntoView({ block: "center" }); }, gi);
        await tap(`#gal-grid .gal-tile:nth-child(${gi + 1})`); s = await S();
        ok(s.screen === "play" && /^g-met-/.test(s.id) && s.cs / (vp.dpr || 1) >= (vp.minCell || MIN_CELL) && (await noScroll()), tag + " a real tap on a painting's tile plays it (" + s.id + ", " + (s.cs / (vp.dpr || 1)).toFixed(2) + " CSS px a cell)");
        const gc = await ev(() => SP.state().fronts.findIndex((f) => f && SP.reachable(f.mat) > 0)); await tap(`.card[data-col="${gc}"]`);
        await ev(() => SP.tick(700)); const sd = await ev(() => SP.entry()); s = await S();
        ok(s.plays === 1 && sd.live > 0 && sd.crate === sd.live && sd.entry === sd.live, tag + " v4.1: a real card tap sends a squad out of its crate and up through the entry square at the bottom (" + JSON.stringify(sd) + ")");
        await shot("gallery-level-mid");
        await tap("#btn-map"); s = await S(); ok(s.screen === "gallery", tag + " the top bar's button goes back to the Gallery");
        const gcells = await ev(() => { let w = null; for (const id of SP.gallery()) { const st = SP.load(id), px = +(st.cs / devicePixelRatio).toFixed(2); if (!w || px < w.px) w = { id, px, turned: document.body.classList.contains("turned") }; } return w; });
        R.galleryMinCell = gcells;
        ok(gcells.px >= (vp.minCell || MIN_CELL), tag + " every Gallery board keeps " + (vp.minCell || MIN_CELL) + " CSS px a cell or more (smallest " + JSON.stringify(gcells) + ")");
        await ev((id) => SP.load(id), gcells.id); await page.waitForTimeout(300); await shot("gallery-smallest-cell");
        ok(await noScroll(), tag + " the smallest Gallery board: no scrollbars");
      }

      // Screens for the critics (portrait phone): the gate teach, an archer hit mid-animation, the win's collapse and goblin.
      if (vp.shots === "375") {
        await ev(() => { SP.load(26); SP.play(0); SP.tick(3500); });
        await page.waitForTimeout(250); await shot("teach-l26-gate");
        await ev(() => { SP.play(1); for (let i = 0; i < 400; i++) { SP.tick(16); if (SP.fx().gates[0] === 1) break; } SP.tick(100); });
        await shot("gate-opening");
        await ev(() => { const o = SP.hitPlan(51) || "2"; SP.load(51); for (let k = 0; k < o.length - 1; k++) { SP.play(+o[k]); SP.settle(); } SP.play(+o[o.length - 1]); for (let i = 0; i < 600; i++) { SP.tick(16); if (SP.hits().struck) break; } SP.tick(120); }); // v4.1: a patient order whose last tap walks into the ring
        const hh = await ev(() => SP.hits()); ok(hh.struck > 0 && hh.label, tag + " level 51: an arrow has struck mid-show");
        await shot("archer-hit");
        await ev(() => { SP.load(2); const o = SP.winOrder(); for (let i = 0; i < o.length - 1; i++) SP.play(+o[i]); SP.skip(); SP.play(+o[o.length - 1]); for (let i = 0; i < 400; i++) { SP.tick(16); if (SP.fx().falls > 4) break; } SP.tick(60); });
        await shot("win-collapse");
        await ev(() => { for (let i = 0; i < 400 && !SP.state().goblin; i++) SP.tick(16); SP.tick(700); });
        await shot("win-goblin");
      }

      // Portal: nothing but this origin (and data: URLs) was requested; payload.
      const ext = reqs.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:"));
      R.requests = reqs.length; R.payloadBytes = bytes; R.external = ext;
      ok(ext.length === 0, tag + " no external requests (" + ext.join(", ") + ")");

      // Mute, the speed (v4 M1: 1x, 2x, 3x) and colour-blind mode (the map's toggle) persist in the save; then a garbage
      // save loads clean.
      if (!vp.iframe) {
        await ev(() => SP.load(1)); await tap("#top .tog-mute");
        await tap("#top .tog-speed"); await tap("#top .tog-speed");
        ok((await L("#top .tog-speed").textContent()) === "3\u00d7" && (await S()).speed === 3, tag + " the speed button cycles to 3x");
        await tap("#btn-map"); await tap("#map .tog-cb");
        ok((await S()).cb === true && (await L("#map .tog-cb").getAttribute("aria-pressed")) === "true", tag + " the map's toggle turns colour-blind marks on");
        await page.reload({ waitUntil: "load" }); await page.waitForFunction(() => window.SP, null, { timeout: 15000 });
        ok((await page.getAttribute("#top .tog-mute", "aria-pressed")) === "true", tag + " mute persists across a reload");
        s = await S();
        ok(s.speed === 3 && (await page.textContent("#top .tog-speed")) === "3\u00d7" && s.cb === true && (await page.getAttribute("#settings .tog-cb", "aria-pressed")) === "true" && (await page.evaluate(() => document.body.classList.contains("cb"))), tag + " speed 3x and colour-blind marks persist across a reload");
        await page.evaluate(() => localStorage.setItem("sappers-path.v3", '{"v":1,"done":{"e1-01":7,"e3-75":7,"x":9},"settings":{"diff":"nightmare","muted":"yes"},"last":"e3-75"}'));
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(() => window.SP, null, { timeout: 15000 });
        s = await S();
        const sv = await page.evaluate(() => { SP.setMeta({}); return JSON.parse(localStorage.getItem("sappers-path.v3")); }); // v4.3: a write stores format 2
        ok(s.done === 2 && sv.v === 2 && sv.done["e1-01"] === 1 && sv.done["e3-75"] === 1 && !sv.done.x && !("diff" in sv.settings), tag + " sanitize (v4.3): a format-1 save migrates by id (both cleared levels kept, unknown ids dropped, the difficulty setting gone): " + JSON.stringify(sv.done) + " " + JSON.stringify(sv.settings));
      }
      await ctx.close();
    }

    // v4.2 fix (B1, V1): phones play upright. A touch phone held sideways (667x375, 740x360, 812x375) shows the upright
    // card, paused, and turning it upright hides the card and plays on; a desktop window or a portal's iframe on a
    // desktop (900x500, 1280x720, the 400x600 iframe in a 900x500 page) never shows it; no board is ever turned.
    { report.upright = {};
      for (const [w, h, dpr] of [[667, 375, 2], [740, 360, 3], [812, 375, 3]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true }), page = await ctx.newPage(), tag = w + "x" + h + " touch";
        page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push(tag + " " + m.type() + ": " + m.text()); });
        page.on("pageerror", (e) => report.console.push(tag + " pageerror: " + e.message));
        await page.goto(URL_ + "?debug=1", { waitUntil: "load" }); await page.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000 });
        const c0 = await page.evaluate(() => { SP.load(64); return SP.state().clock; }); await page.waitForTimeout(600); // real frames: the paused clock must not move
        const a = await page.evaluate((c0) => { const u = document.getElementById("upright"), r = u.getBoundingClientRect(); return { up: SP.upright().on && !u.hidden && r.width >= innerWidth && r.height >= innerHeight, paused: SP.paused(), still: SP.state().clock === c0 }; }, c0);
        await page.setViewportSize({ width: h, height: w }); await page.waitForTimeout(200);
        const b = await page.evaluate(() => { const s = SP.state(); return { up: SP.upright().on || !document.getElementById("upright").hidden, paused: SP.paused(), cs: +(s.cs / devicePixelRatio).toFixed(2), upright: Math.abs(document.getElementById("board").width / document.getElementById("board").height - s.w / (s.h + 4)) < 0.05 }; });
        report.upright[tag] = { landscape: a, portrait: b };
        ok(a.up && a.paused && a.still, tag + ": the upright card covers the screen and the game is paused (" + JSON.stringify(a) + ")");
        const floor = h < 375 ? 7.5 : MIN_CELL; // a 360-wide phone upright: about 8 (7.67), the board being 42 columns
        ok(!b.up && !b.paused && b.upright && b.cs >= floor, tag + " turned upright: the card is gone and the game plays on, upright, at " + b.cs + " CSS px a cell (" + JSON.stringify(b) + ")");
        await ctx.close();
      }
      for (const [w, h, frame] of [[900, 500, null], [1280, 720, null], [812, 375, null], [900, 500, [400, 600]]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }), page = await ctx.newPage(), tag = w + "x" + h + " desktop" + (frame ? " iframe " + frame.join("x") : "");
        page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push(tag + " " + m.type() + ": " + m.text()); });
        let F = page.mainFrame();
        if (frame) { await page.goto(URL_ + "tools/iframe-host.html?w=" + frame[0] + "&h=" + frame[1], { waitUntil: "load" }); const fh = await page.waitForSelector("#game"); for (let k = 0; k < 100 && !(F = await fh.contentFrame()); k++) await page.waitForTimeout(50); }
        else await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
        await F.waitForFunction(() => window.SP && document.fonts && document.fonts.status === "loaded", null, { timeout: 15000 });
        const c = await F.evaluate(() => { const out = { card: false, turned: [] }; for (const n of [64, 100]) { const s = SP.load(n); SP.tick(40); const bd = document.getElementById("board"); if (Math.abs(bd.width / bd.height - s.w / (s.h + 4)) > 0.05) out.turned.push(n); } out.card = SP.upright().on || !document.getElementById("upright").hidden; return out; });
        report.upright[tag] = c;
        ok(!c.card && !c.turned.length, tag + ": never the upright card, and the boards stand upright (" + JSON.stringify(c) + ")");
        await ctx.close();
      }
    }
    // Hidden-tab load: rAF never fires, document.hidden is true; everything must still run on SP.tick.
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => {
      Object.defineProperty(document, "hidden", { get: () => true, configurable: true });
      Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
      window.requestAnimationFrame = () => 0;
    });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push("hidden " + m.type() + ": " + m.text()); });
    page.on("pageerror", (e) => report.console.push("hidden pageerror: " + e.message));
    await page.goto(URL_ + "?debug=1", { waitUntil: "load" });
    await page.waitForFunction(() => window.SP, null, { timeout: 15000, polling: 100 }); // rAF is held here, so poll by time (M4: boot awaits one more fetch)
    const st = await page.evaluate(() => SP.selfTest());
    const won = await page.evaluate(() => { SP.load(10); /* v4.3: level 10 is a Hard level */ for (const c of SP.winOrder()) { SP.play(+c); for (let i = 0; i < 6000 && SP.state().busy; i++) SP.tick(16); } return SP.tick(9000); });
    const spr = await page.evaluate(() => SP.sprites());
    report.hidden = { selfTest: { pass: st.pass, fail: st.fail, ms: st.ms }, panel: won.panel, sprites: spr };
    ok(st.fail.length === 0, "hidden selfTest: " + st.fail.join("; "));
    ok(won.status === "won" && won.panel === "win" && won.tag === "hard", "hidden: level 10 (Hard) won patiently and its panel shown on SP.tick alone");
    ok(spr.length === 0, "hidden: sprite caches opaque (" + spr.join(",") + ")");
    await ctx.close();
  } finally { await browser.close(); }
  ok(report.console.length === 0, "console errors/warnings: " + report.console.length);
}

run().then(() => {
  writeFileSync(resolve(OUT, "harness-report.json"), JSON.stringify(report, null, 1));
  const brief = {}; for (const [k, R] of Object.entries(report.runs)) brief[k] = { selfTest: R.selfTest && R.selfTest.pass + " pass, " + R.selfTest.fail.length + " fail", titleReadyMs: R.titleReadyMs, loadToGameplayMs: R.loadToGameplayMs, clicks: R.clicksToGameplay, cells: R.minCellCss, galleryCell: R.galleryMinCell, frames: R.frames, draw: R.midShow && R.midShow.perf, shots: R.shots, pause: R.pause, requests: R.requests, payloadBytes: R.payloadBytes };
  console.log(JSON.stringify({ runs: brief, hidden: report.hidden, console: report.console }, null, 1));
  console.log(report.fails.length ? "HARNESS: " + report.fails.length + " failure(s)" : "HARNESS: all passed");
  clearTimeout(wall); process.exit(report.fails.length ? 1 : 0);
}).catch((e) => { console.error("harness crashed: " + (e && e.stack || e)); clearTimeout(wall); process.exit(2); });
