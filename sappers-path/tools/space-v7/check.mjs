// Sapper's Path v7 lane T (tools/space-v7-notes.md): the browser checks of the space work, on this build (NEW) and, where
// a comparison is asked for, on a server of a11e9bf's sappers-path/ (OLD).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/space-v7/check.mjs NEW_URL OLD_URL [bytes lazy saves sweep]
// bytes  bytes the page asks for (files on disk, so before any gzip) on a cold load: to the home being interactive, to the
//        first Campaign level after a tap on the Campaign card, to the first Zen level after a tap on the Zen card (each
//        a fresh browser context, 375x812), OLD and NEW, by part
// lazy   (NEW) Zen worlds on demand: no world file on a fresh home; the Zen save's next world fetched after the first paint
//        and no other; a tap on a node whose world is slow: nothing changes on screen at first, "Opening World k..." after
//        zen.load.toastMs, then the level; leaving for the home while it loads: the level never starts; a failed fetch: the
//        load-fail toast, the map stays, and the next tap loads it
// saves  tools/fixtures/v6.2-save.json (written by a11e9bf's page) on OLD and NEW: the stored saves untouched by the boot,
//        the same SP2 code, home cards, coins and power-ups; the fixture's SP2 code loaded through Settings on NEW reads
//        back as the same code
// sweep  (NEW) 0 console messages over fresh loads of: a Campaign level, a Zen level in every world, the map in both
//        modes, a Gallery picture (a Campaign side quest)
const [NEW, OLD, ...want] = process.argv.slice(2), on = (k) => !want.length || want.includes(k);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE), fs = await import("fs"), path = await import("path");
const HERE = path.dirname(new URL(import.meta.url).pathname), GAME = path.join(HERE, "..", ".."), OLDDIR = process.env.OLD_DIR || null;
const b = await chromium.launch(); let fails = 0; const out = {};
{ const nc = b.newContext.bind(b); b.newContext = async (o) => { const c = await nc(o); await c.addInitScript(() => { try { localStorage.setItem("sappers-path.tour.v1", "1"); } catch (e) { /* no store */ } }); return c; }; } // as the harness: the tour's first-launch offer seen
const ok = (c, m) => { console.log((c ? "ok    " : "FAIL  ") + m); if (!c) fails++; return c; };
const phone = () => b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const watch = (p) => { const log = [], reqs = []; p.on("console", (m) => log.push(m.type() + ": " + m.text())); p.on("pageerror", (e) => log.push("pageerror: " + e.message)); p.on("request", (r) => reqs.push(r.url())); return { log, reqs }; };
const homeUp = (p) => p.waitForFunction(() => { const t = document.getElementById("title"), z = document.getElementById("btn-zen"); return t && !t.hidden && z && !z.hidden && document.getElementById("btn-play").querySelector(".mc-n").textContent; }, null, { timeout: 20000 });
const playing = (p) => p.waitForFunction(() => document.getElementById("title").hidden && document.getElementById("map").hidden && document.body.dataset.mode, null, { timeout: 20000 });
const screenOf = (p) => p.evaluate(() => (!document.getElementById("title").hidden ? "title" : !document.getElementById("map").hidden ? "map" : "play"));
const toastOf = (p) => p.evaluate(() => { const t = document.getElementById("toast"); return t.hidden ? "" : t.textContent; });

// ---- bytes ---------------------------------------------------------------------------------------------------------------
// A request's bytes: its file's size in the build's folder (the query string dropped; data: and other origins skipped).
const sizeOf = (base, dir, u) => { if (!u.startsWith(base)) return 0; const f = path.join(dir, decodeURIComponent(u.slice(base.length).split("?")[0]) || "index.html"); try { return fs.statSync(f.endsWith("/") ? f + "index.html" : f).size; } catch (e) { return 0; } };
const partOf = (u) => (/\/levels\/zen[-.]/.test(u) ? "levels: zen" : /\/levels\//.test(u) ? "levels: other" : /\/map\/sheet-/.test(u) ? "map: castle sheets" : /\/map\/land-/.test(u) ? "map: land sheets" : /\/map\//.test(u) ? "map: layout" : /\/audio\//.test(u) ? "audio" : /\/art\//.test(u) ? "art" : /\/fonts\//.test(u) ? "fonts" : /\/src\//.test(u) ? "code" : "page");
async function bytes(base, dir, tap) {
  const ctx = await phone(), p = await ctx.newPage(), W = watch(p); await p.goto(base); await homeUp(p); await p.waitForLoadState("networkidle"); await p.waitForTimeout(400);
  const sum = (list) => { const by = {}; let t = 0; for (const u of new Set(list)) { const s = sizeOf(base, dir, u); t += s; const k = partOf(u); by[k] = (by[k] || 0) + s; } return { total: t, by }; };
  const home = sum(W.reqs); let tapped = null;
  if (tap) { await p.click(tap === "zen" ? "#btn-zen" : "#btn-play"); await playing(p); await p.waitForLoadState("networkidle"); await p.waitForTimeout(400); tapped = sum(W.reqs); }
  await ctx.close(); return { home, tapped, log: W.log };
}
if (on("bytes")) {
  out.bytes = {};
  for (const [name, base, dir] of [["old", OLD, OLDDIR], ["new", NEW, GAME]]) { if (!base || !dir) continue;
    const c = await bytes(base, dir, "campaign"), z = await bytes(base, dir, "zen");
    out.bytes[name] = { home: c.home, campaign: c.tapped, zen: z.tapped };
    console.log(name + ": home " + c.home.total.toLocaleString("en-US") + " B, to the first Campaign level " + c.tapped.total.toLocaleString("en-US") + " B, to the first Zen level " + z.tapped.total.toLocaleString("en-US") + " B");
    for (const k of Object.keys(z.tapped.by).sort()) console.log("    " + k + ": home " + (c.home.by[k] || 0).toLocaleString("en-US") + ", campaign " + (c.tapped.by[k] || 0).toLocaleString("en-US") + ", zen " + z.tapped.by[k].toLocaleString("en-US"));
    ok(!c.log.length && !z.log.length, name + " bytes runs: 0 console messages" + (c.log.length + z.log.length ? " (" + c.log.concat(z.log).slice(0, 3).join(" | ") + ")" : "")); }
}

// ---- lazy ----------------------------------------------------------------------------------------------------------------
const worldReqs = (W) => W.reqs.filter((u) => /\/levels\/zen-\d+\.pk\.json/.test(u)).map((u) => +u.match(/zen-(\d+)\.pk/)[1]);
const FX = JSON.parse(fs.readFileSync(path.join(GAME, "tools/fixtures/v6.2-save.json"), "utf8"));
const seed = (ctx, fx) => ctx.addInitScript((f) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("sappers-path.v3", f.campaign); localStorage.setItem("sappers-path.zen.v1", f.zen); sessionStorage.setItem("seeded", "1"); } }, fx);
async function zenMap(p) { await p.click("#btn-tomap"); await p.waitForFunction(() => !document.getElementById("map").hidden, null, { timeout: 10000 }); if (await p.evaluate(() => document.body.dataset.mode !== "zen")) await p.click('#map-mode button[data-mode="zen"]'); await p.waitForFunction(() => document.body.dataset.mode === "zen" && document.querySelector('#jr .mn'), null, { timeout: 10000 }); }
if (on("lazy")) {
  { const ctx = await phone(), p = await ctx.newPage(), W = watch(p); await p.goto(NEW + "?debug=1"); await homeUp(p); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
    ok(worldReqs(W).length === 0, "lazy: a fresh home (Campaign last) asks for no Zen world file (" + worldReqs(W).join(",") + ")");
    const txt = await p.evaluate(() => document.getElementById("btn-zen").textContent.replace(/\s+/g, " ").trim());
    ok(/0 of 212 pictures/.test(txt) && /World 1/.test(txt) && /Picture 1/.test(txt), "lazy: the Zen card reads its counts and next picture from the index alone (" + txt + ")");
    await zenMap(p); await p.waitForTimeout(300);
    ok(worldReqs(W).join() === "1" && (await p.evaluate(() => document.querySelectorAll("#jr .mn").length)) === 200, "lazy: the Zen map builds all 200 nodes from the index; opening it fetches only the save's next world, 1 (fix pass M1) (" + worldReqs(W).join(",") + ")");
    // Slow World 4: nothing at first, the toast after toastMs, then the level.
    await p.route("**/levels/zen-4.pk.json*", async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.continue(); });
    await p.click('#jr .mn[data-n="301"]'); await p.waitForTimeout(150);
    const s0 = await screenOf(p), t0 = await toastOf(p); await p.waitForTimeout(600); const s1 = await screenOf(p), t1 = await toastOf(p);
    await playing(p); const t2 = await toastOf(p), lv = await p.evaluate(() => document.getElementById("lvl-num").textContent);
    ok(s0 === "map" && t0 === "" && s1 === "map" && t1 === "Opening World 4..." && t2 === "" && lv === "151", "lazy: a slow world: at 150 ms the map as it was (" + s0 + ", toast '" + t0 + "'), at 750 ms '" + t1 + "', then World 4's first picture plays (number " + lv + ", toast '" + t2 + "')");
    ok(!W.log.length, "lazy: 0 console messages (" + W.log.slice(0, 3).join(" | ") + ")"); await ctx.close(); }
  { const ctx = await phone(), p = await ctx.newPage(), W = watch(p); await p.goto(NEW + "?debug=1"); await homeUp(p); await zenMap(p);
    await p.route("**/levels/zen-3.pk.json*", async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.continue(); });
    await p.click('#jr .mn[data-n="251"]'); await p.waitForTimeout(200); await p.click("#btn-home"); await p.waitForTimeout(2200);
    ok((await screenOf(p)) === "title" && (await toastOf(p)) === "", "lazy: leaving for the home while World 3 loads: the level never starts, no toast left (" + (await screenOf(p)) + ")");
    await p.unroute("**/levels/zen-3.pk.json*");
    await p.route("**/levels/zen-2.pk.json*", (r) => r.abort()); await zenMap(p); await p.click('#jr .mn[data-n="201"]'); await p.waitForTimeout(800);
    const fail = await toastOf(p), s = await screenOf(p);
    const rows = await p.evaluate(() => { const t = document.getElementById("toast"), r = document.createRange(); r.selectNodeContents(t); const ys = new Set(Array.from(r.getClientRects()).map((q) => Math.round(q.top))); return ys.size; });
    await p.waitForTimeout(3700); const at45 = await toastOf(p); await p.waitForTimeout(1300); const at58 = await toastOf(p);
    ok(s === "map" && fail === "Couldn't open World 2. Check your connection." && rows <= 2 && at45 === fail && at58 === "", "lazy: a failed fetch: the map stays, the toast says so on " + rows + " line(s) at 375 px, still up at 4.5 s, gone by 5.8 s ('" + fail + "', fix pass minor 2)");
    await p.unroute("**/levels/zen-2.pk.json*"); await p.click('#jr .mn[data-n="201"]'); await playing(p);
    ok((await p.evaluate(() => document.getElementById("lvl-num").textContent)) === "51", "lazy: the next tap loads World 2 and plays its first picture (51)");
    const other = W.log.filter((l) => !/Failed to load resource|ERR_FAILED/.test(l));
    ok(!other.length, "lazy: no console message but the aborted fetch's own network line (" + W.log.length + " in all" + (other.length ? ": " + other.slice(0, 3).join(" | ") : "") + ")"); await ctx.close(); }
  { const ctx = await phone(); await seed(ctx, FX); const p = await ctx.newPage(), W = watch(p); await p.goto(NEW + "?debug=1"); await homeUp(p); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
    const got = worldReqs(W); ok(got.join() === "4", "lazy: with Zen played last (the v6.2 save, World 4 next) only World 4's file is fetched, after the first paint (" + got.join(",") + ")");
    await p.click("#btn-zen"); await playing(p); ok((await p.evaluate(() => document.getElementById("lvl-num").textContent)) === "154" && !W.log.length, "lazy: the Zen card's tap plays picture 154 (World 4's fourth) at once, 0 console messages");
    await ctx.close(); }

  // Fix pass B1: a level started while another waits on its world wins; the waiting one never takes over. Plus the busy
  // state on the node tapped (only after zen.load.toastMs) and a repeat tap ignored.
  { const ctx = await phone(), p = await ctx.newPage(), W = watch(p); await p.goto(NEW + "?debug=1"); await homeUp(p); await zenMap(p);
    await p.waitForFunction(() => SP.worlds().find((w) => w.k === 1).stubs === 0, null, { timeout: 10000 });
    await p.route("**/levels/zen-3.pk.json*", async (r) => { await new Promise((res) => setTimeout(res, 2500)); await r.continue(); });
    const node = '#jr .mn[data-n="251"]'; await p.click(node); await p.waitForTimeout(120);
    const b0 = await p.evaluate((q) => document.querySelector(q).classList.contains("busy"), node), at0 = (await p.evaluate(() => SP.pend())).at;
    await p.click(node); await p.waitForTimeout(400);
    const b1 = await p.evaluate((q) => { const b = document.querySelector(q); return b.classList.contains("busy") && b.getAttribute("aria-busy") === "true"; }, node), pd = await p.evaluate(() => SP.pend());
    ok(!b0 && b1 && pd && pd.at === at0 && (await toastOf(p)) === "Opening World 3...", "lazy (fix pass minor 1): the tapped node shows busy only after 300 ms (" + b0 + " at 120 ms, " + b1 + " at 520 ms) and a repeat tap is ignored (same wait)");
    await p.click('#jr .mn[data-n="1"]'); await playing(p); const n1 = await p.evaluate(() => document.getElementById("lvl-num").textContent);
    await p.waitForTimeout(3000); const after = await p.evaluate(() => ({ num: document.getElementById("lvl-num").textContent, id: SP.state().id, pend: SP.pend(), busy: document.querySelectorAll(".busy").length }));
    ok(n1 === "1" && after.num === "1" && after.id === "z1-1" && !after.pend && !after.busy && (await screenOf(p)) === "play", "lazy (fix pass B1): picture 1 started while World 3 loads keeps playing after zen-3 arrives (" + JSON.stringify(after) + ")");
    ok(!W.log.length, "lazy (B1 run): 0 console messages"); await ctx.close(); }
  // Fix pass M1: Zen progress but the Campaign played last: the home fetches the save's next Zen world after the first paint.
  { const fx = Object.assign({}, FX, { zen: JSON.stringify(Object.assign(JSON.parse(FX.zen), { mode: "campaign" })) }), ctx = await phone(); await seed(ctx, fx); const p = await ctx.newPage(), W = watch(p);
    await p.goto(NEW + "?debug=1"); await homeUp(p); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
    ok(worldReqs(W).join() === "4" && (await p.evaluate(() => SP.mode())) === "campaign" && !W.log.length, "lazy (fix pass M1): Zen progress, Campaign played last: the home fetches World 4 (the Zen card's next) after the first paint (" + worldReqs(W).join(",") + ")"); await ctx.close(); }
}

// ---- saves ---------------------------------------------------------------------------------------------------------------
async function readout(base, fx) {
  const ctx = await phone(); await seed(ctx, fx); const p = await ctx.newPage(), W = watch(p); await p.goto(base + "?debug=1"); await homeUp(p); await p.waitForFunction(() => window.SP, null, { timeout: 20000 }); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const card = (id) => document.getElementById(id).textContent.replace(/\s+/g, " ").trim(), m = SP.meta();
    return { code: SP.code(), mode: SP.mode(), camp: card("btn-play"), zen: card("btn-zen"), coins: m.coins, inv: m.inv, got: m.got, stored: [localStorage.getItem("sappers-path.v3"), localStorage.getItem("sappers-path.zen.v1")] }; });
  r.log = W.log; await ctx.close(); return r;
}
if (on("saves")) {
  const o = OLD ? await readout(OLD, FX) : null, n = await readout(NEW, FX);
  ok(n.stored[0] === FX.campaign && n.stored[1] === FX.zen, "saves: the v6.2 save's two stored keys are byte for byte as a11e9bf wrote them after NEW's boot");
  ok(n.code === FX.code, "saves: NEW's SP2 code of the v6.2 save is the code a11e9bf made (" + n.code.length + " chars)");
  if (o) { const keys = ["code", "mode", "camp", "zen", "coins", "inv", "got"], diff = keys.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]));
    ok(!diff.length, "saves: OLD and NEW read the v6.2 save the same: " + keys.join(", ") + (diff.length ? " (differ: " + diff.map((k) => k + " " + JSON.stringify(o[k]) + " vs " + JSON.stringify(n[k])).join("; ") + ")" : "") + "; Zen card '" + n.zen + "', Campaign card '" + n.camp + "'"); }
  // The fixture's SP2 code through Settings > Load save code on a fresh NEW page: it reads back as the same code.
  { const ctx = await phone(), p = await ctx.newPage(), W = watch(p); await p.goto(NEW + "?debug=1"); await homeUp(p); await p.waitForFunction(() => window.SP, null, { timeout: 20000 });
    const back = await p.evaluate((code) => { document.getElementById("btn-settings").click(); document.getElementById("set-load").click(); const ta = document.getElementById("ls-code"); ta.value = code; ta.dispatchEvent(new Event("input", { bubbles: true }));
      const can = !document.getElementById("ls-apply").disabled; document.getElementById("ls-apply").click(); return { can, code: SP.code(), mode: SP.mode() }; }, FX.code);
    ok(back.can && back.code === FX.code && !n.log.length && !W.log.length, "saves: a11e9bf's SP2 code loads on NEW and reads back identically (ids, progress, eggs, coins), 0 console messages");
    await ctx.close(); }
  out.saves = { code: n.code.length, zenCard: n.zen, campCard: n.camp };
}

// ---- sweep ---------------------------------------------------------------------------------------------------------------
if (on("sweep")) {
  const runs = [["Campaign level 5", (p) => p.evaluate(() => SP.load(5))], ["Zen World 1 (z1-3)", (p) => p.evaluate(() => SP.load("z1-3"))], ["Zen World 2 (e9-205)", (p) => p.evaluate(() => SP.load("e9-205"))],
    ["Zen World 3 (z3-4)", (p) => p.evaluate(() => SP.load("z3-4"))], ["Zen World 4 (z4-6)", (p) => p.evaluate(() => SP.load("z4-6"))], ["the Campaign map", (p) => p.evaluate(() => SP.screen("map"))],
    ["the Zen map", (p) => zenMap(p)], ["a Gallery picture (Campaign side quest 1)", (p) => p.evaluate(() => SP.load(SP.gallery()[0]))]];
  for (const vp of [[375, 812, 3, true], [1280, 800, 1, false]]) for (const [name, go] of runs) {
    const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: vp[2], hasTouch: vp[3], isMobile: vp[3] }), p = await ctx.newPage(), W = watch(p);
    await p.goto(NEW + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 20000 }); await go(p); await p.waitForTimeout(700);
    await p.reload(); await p.waitForFunction(() => window.SP, null, { timeout: 20000 }); await go(p); await p.waitForTimeout(700); const s = await screenOf(p);
    ok(!W.log.length && s === (/map/.test(name) ? "map" : "play"), "sweep " + vp[0] + "x" + vp[1] + ": " + name + ", loaded, reloaded and loaded again: on " + s + ", 0 console messages" + (W.log.length ? " (" + W.log.slice(0, 3).join(" | ") + ")" : ""));
    await ctx.close(); }
}
await b.close();
fs.writeFileSync(path.join(HERE, "check-last.json"), JSON.stringify(out, null, 1) + "\n");
console.log(fails ? fails + " failed" : "all passed"); process.exitCode = fails ? 1 : 0;
