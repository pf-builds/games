#!/usr/bin/env node
// Sapper's Path portal build check (lane P, Stage 1; tools/portal-notes.md, config tools/portal-config.json selftest).
//   PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/portal-selftest.mjs [--zip FILE] [--keep]
// Unzips the build (tools/portal-build.mjs) to a temp folder under a CDN-like subpath (selftest.subpath) and serves it from this
// process on its own port at 127.0.0.1 (the game's origin); a second port at localhost serves a host page that frames it, so the
// framed run is cross-site, as on the portal (storage partitioned by the top site). Every request is logged. Checks, each PASS/FAIL:
//   1 load:       a fresh profile per viewport (selftest.viewports) loads the home with 0 console errors or warnings and no page error;
//   2 origin:     no request leaves the game's origin (data: and blob: aside), in every run, framed or not;
//   3 links:      no element points off-origin (a/area/link href, src, srcset, form action, a URL in a meta's content) on the home,
//                 the level, the map in both modes and Settings;
//   4 one tap:    a real tap on the home's Play reaches level 1 (the home gone, the level number 1, the board drawn); load-to-play ms;
//   5 bytes:      what loads before the first tap (response bodies, after selftest.settleMs on the home) and after it (the music);
//   6 selfTest:   SP.selfTest() under ?debug=1 in the unzipped build passes; levels/debug-v4.json, the one file the build leaves
//                 out on purpose (config debugOnly), is answered from the source tree for this run only (a Playwright route);
//   7 files:      every request answered 200 by the build (nothing the page asks for is missing from the zip), and which zipped
//                 files no run asked for;
//   8 framed:     in the cross-site frame under the subpath: Play reaches level 1, every ?v= request carries the page's own cache tag,
//                 the localStorage keys written are all "sappers-path." ones and survive a reload of the host page.
// Exit 0 when every check passes. The servers close at the end (no process is left on either port).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), C = JSON.parse(fs.readFileSync(path.join(root, "tools/portal-config.json"), "utf8")), T = C.selftest;
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const zip = path.resolve(root, arg("zip", path.join(C.out, C.name + ".zip"))), keep = process.argv.includes("--keep");
if (!fs.existsSync(zip)) { console.error("no build at " + zip + " (run node tools/portal-build.mjs first)"); process.exit(1); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sp-portal-")), gameDir = path.join(tmp, T.subpath);
fs.mkdirSync(gameDir, { recursive: true }); execFileSync("unzip", ["-q", zip, "-d", gameDir]);
const zipped = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n").filter((l) => !l.endsWith("/"));
const tag = (fs.readFileSync(path.join(gameDir, "index.html"), "utf8").match(/src\/main\.js\?v=(\w+)/) || [])[1];

// ---- the two servers -------------------------------------------------------------------------------------------------------
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png",
  ".m4a": "audio/mp4", ".ttf": "font/ttf", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml" };
const served = []; // {path, status} for every request the game's server answered
const game = http.createServer((q, r) => { const u = new URL(q.url, "http://x"), rel = decodeURIComponent(u.pathname).replace(/^\/+/, ""), f = path.join(tmp, rel.endsWith("/") || !rel ? rel + "index.html" : rel);
  const ok = f.startsWith(tmp) && fs.existsSync(f) && fs.statSync(f).isFile(); served.push({ path: rel, q: u.search, status: ok ? 200 : 404 });
  if (!ok) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(f).pipe(r); });
const host = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  r.end(`<!doctype html><meta charset="utf-8"><title>host</title><style>body{margin:0;background:#111}iframe{border:0;width:100vw;height:100vh;display:block}</style><iframe id="game" allow="autoplay" src="${GAME}index.html"></iframe>`); });
const listen = (s, port, h) => new Promise((ok, no) => { s.once("error", no); s.listen(port, h, ok); });
await listen(game, T.gamePort, "127.0.0.1"); await listen(host, T.hostPort, "127.0.0.1");
const ORIGIN = `http://127.0.0.1:${T.gamePort}`, GAME = `${ORIGIN}/${T.subpath}`, HOST = `http://localhost:${T.hostPort}/`;

// ---- the runs --------------------------------------------------------------------------------------------------------------
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch(), checks = {}, notes = {}, log = [];
const check = (k, pass, line) => { (checks[k] = checks[k] || []).push({ pass: !!pass, line }); };
async function context(vp) { const [w, h, dpr, touch] = vp, ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }), page = await ctx.newPage(), name = w + "x" + h;
  const R = { name, reqs: [], off: [], bytes: 0, tapAt: -1, console: [] };
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") R.console.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => R.console.push("pageerror: " + e.message));
  page.on("request", (q) => { const u = q.url(); if (/^(data|blob):/.test(u)) return; const o = new URL(u).origin; R.reqs.push(u); if (o !== ORIGIN && o !== new URL(HOST).origin) R.off.push(u); });
  page.on("response", async (s) => { try { if (new URL(s.url()).origin === ORIGIN) { const pre = R.tapAt < 0, n = (await s.body()).length; R.bytes += n; if (pre) R.pre = (R.pre || 0) + n; } } catch (e) { /* a body gone with its frame */ } });
  return { ctx, page, R };
}
// every element attribute that can point somewhere, absolute and off the game's origin (the SVG namespace is an XML name, not a link)
const offLinks = (F) => F.evaluate((origin) => { const bad = [], seen = (u, what) => { if (!u || /^(data|blob|javascript:void)/.test(u) || u.startsWith("#")) return; let a; try { a = new URL(u, location.href); } catch (e) { return; } if (a.origin !== origin) bad.push(what + " " + u); };
  for (const el of document.querySelectorAll("[href],[src],[srcset],form[action],meta[content]")) { if (el.namespaceURI === "http://www.w3.org/2000/svg" && el.tagName !== "a" && el.tagName !== "image") continue;
    for (const at of ["href", "src", "action"]) if (el.hasAttribute(at)) seen(el.getAttribute(at), el.tagName.toLowerCase() + "[" + at + "]");
    if (el.hasAttribute("srcset")) for (const p of el.getAttribute("srcset").split(",")) seen(p.trim().split(/\s+/)[0], el.tagName.toLowerCase() + "[srcset]");
    if (el.tagName === "META" && /^(https?:)?\/\//i.test(el.getAttribute("content") || "")) seen(el.getAttribute("content"), "meta[content]"); }
  return bad; }, ORIGIN);
const visible = (F, sel) => F.evaluate((s) => { const el = document.querySelector(s); if (!el || el.hidden) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
// a fresh profile on the home, Play tapped, then the map (both modes) and Settings, links checked on each screen
async function walk(F, page, R, tagName, touch) {
  const t0 = Date.now(); await F.waitForFunction(() => { const b = document.getElementById("btn-play"); return b && !b.hidden && b.getBoundingClientRect().width > 0 && document.querySelector("#title-art.on"); }, null, { timeout: 15000 });
  R.homeMs = Date.now() - t0; await page.waitForTimeout(T.settleMs); R.tapAt = Date.now(); R.preList = R.reqs.slice();
  const links = []; links.push(...(await offLinks(F)).map((s) => "home: " + s));
  // a fresh profile meets the tour's offer over the home (src/tutorial.js offerMaybe): Skip, then Play, is the way to level 1
  const press = async (sel) => { const el = await F.$(sel); if (touch) await el.tap(); else await el.click(); };
  const offer = await visible(F, "#tut-offer"); let taps = 0; if (offer) { await press("#tut-offer .tut-no"); taps++; }
  await press("#btn-play"); taps++;
  const inPlay = await F.waitForFunction(() => document.getElementById("title").hidden && document.getElementById("map").hidden && /^\D*1\D*$/.test(document.getElementById("lvl-num").textContent) && document.getElementById("board").width > 0, null, { timeout: 10000 }).then(() => true, () => false);
  R.toPlayMs = Date.now() - t0; const num = await F.evaluate(() => document.getElementById("lvl-num").textContent);
  check("4 one tap", inPlay && taps === 1, `${tagName}, fresh profile: ${offer ? "the tour's offer (New here? Show me / Skip) covers the home; " : ""}level ${JSON.stringify(num)} in ${taps} tap${taps > 1 ? "s" : ""}${offer ? " (Skip, Play)" : ""}, board drawn (${R.toPlayMs} ms from load to play)`);
  await page.waitForTimeout(1500); links.push(...(await offLinks(F)).map((s) => "level: " + s));
  await F.click("#btn-map"); await F.waitForFunction(() => !document.getElementById("map").hidden, null, { timeout: 8000 }); await page.waitForTimeout(800); links.push(...(await offLinks(F)).map((s) => "map: " + s));
  if (await visible(F, '#map-mode [data-mode="zen"]')) { await F.click('#map-mode [data-mode="zen"]'); await page.waitForTimeout(1200); links.push(...(await offLinks(F)).map((s) => "zen map: " + s)); await F.click('#map-mode [data-mode="campaign"]'); await page.waitForTimeout(300); }
  await F.click("#map-set"); await page.waitForTimeout(300); links.push(...(await offLinks(F)).map((s) => "settings: " + s)); await F.click("#set-close");
  await F.click("#btn-home"); await page.waitForTimeout(500);
  check("3 links", !links.length, `${tagName}: home, level, map (Campaign and Zen), Settings: ${links.length} off-origin attributes` + (links.length ? " " + links.slice(0, 4).join("; ") : ""));
}

try {
  // 1-5, 7: each viewport, a fresh profile, the build as it ships (no ?debug)
  for (const vp of T.viewports) {
    const { ctx, page, R } = await context(vp), touch = vp[3];
    await page.goto(GAME); await walk(page.mainFrame(), page, R, R.name, touch);
    { await page.reload(); await page.waitForFunction(() => { const b = document.getElementById("btn-play"); return b && !b.hidden && b.getBoundingClientRect().width > 0; }, null, { timeout: 15000 }); await page.waitForTimeout(500);
      const offer = await visible(page.mainFrame(), "#tut-offer"), b = await page.$("#btn-play"); if (touch) await b.tap(); else await b.click();
      const ok = await page.waitForFunction(() => document.getElementById("title").hidden && document.getElementById("map").hidden && /^\D*1\D*$/.test(document.getElementById("lvl-num").textContent), null, { timeout: 10000 }).then(() => true, () => false);
      check("4 one tap", ok && !offer, `${R.name}, returning player (tour offered once): one tap on Play -> level 1 ${ok ? "reached" : "NOT reached"}${offer ? ", the offer showed again" : ""}`); }
    const pre = R.preList.map((u) => new URL(u).pathname.replace("/" + T.subpath, "")), music = R.reqs.filter((u) => /\/audio\//.test(u)).length;
    notes[R.name] = { homeMs: R.homeMs, toPlayMs: R.toPlayMs, beforeTap: R.pre, total: R.bytes, beforeTapFiles: pre.length, musicRequests: music };
    check("1 load", !R.console.length, `${R.name}: ${R.console.length} console errors/warnings` + (R.console.length ? " " + R.console.slice(0, 3).join(" | ") : ""));
    check("2 origin", !R.off.length, `${R.name}: ${R.reqs.length} requests, ${R.off.length} off the game's origin` + (R.off.length ? " " + R.off.slice(0, 3).join(" ") : ""));
    check("5 bytes", R.pre > 0, `${R.name}: ${R.pre} B in ${pre.length} files before the first tap (${pre.filter((p) => /\.(jpg|webp)$/.test(p)).join(", ")}), ${R.bytes} B after the walk (music files ${music})`);
    await ctx.close();
  }
  // 4: on a fresh profile, Show me is one tap into a playable practice fort (the tour)
  { const vp = T.viewports[0], { ctx, page, R } = await context(vp); await page.goto(GAME); await page.waitForFunction(() => { const o = document.getElementById("tut-offer"); return o && !o.hidden; }, null, { timeout: 15000 }).catch(() => {});
    const offer = await visible(page.mainFrame(), "#tut-offer"); if (offer) await (await page.$("#tut-offer .tut-yes")).tap();
    const ok = offer && await page.waitForFunction(() => document.body.classList.contains("tut") && document.getElementById("title").hidden && document.getElementById("board").width > 0 && document.querySelectorAll("#tray .card:not(.empty)").length > 0, null, { timeout: 10000 }).then(() => true, () => false);
    check("4 one tap", ok, `${R.name}, fresh profile: Show me is one tap into a playable practice fort (the tour, not level 1)` + (R.console.length ? "; console " + R.console.slice(0, 2).join(" | ") : ""));
    await ctx.close(); }
  // 6: SP.selfTest under ?debug=1, the debug-only file from the source tree
  { const vp = T.viewports[0], { ctx, page, R } = await context(vp);
    for (const f of C.debugOnly) await page.route("**/" + f + "*", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: fs.readFileSync(path.join(root, f)) }));
    await page.goto(GAME + "?debug=1"); await page.waitForFunction(() => window.SP, null, { timeout: 20000 });
    const st = await page.evaluate(() => SP.selfTest());
    check("6 selfTest", !st.fail.length && st.pass > 0, `${R.name}@${vp[2]}: SP.selfTest ${st.pass} passed, ${st.fail.length} failed (${Math.round(st.ms || 0)} ms)` + (st.fail.length ? " " + st.fail.slice(0, 3).join(" | ") : ""));
    check("1 load", !R.console.length, `${R.name} ?debug=1 selfTest run: ${R.console.length} console errors/warnings` + (R.console.length ? " " + R.console.slice(0, 3).join(" | ") : ""));
    check("2 origin", !R.off.length, `${R.name} ?debug=1 selfTest run: ${R.reqs.length} requests, ${R.off.length} off the game's origin`);
    await ctx.close(); }
  // 8: the cross-site frame under the subpath, then a reload of the host page
  { const vp = T.viewports[1], { ctx, page, R } = await context(vp);
    await page.goto(HOST); const fh = await page.waitForSelector("#game"), F = await fh.contentFrame(); await walk(F, page, R, "framed " + R.name, false);
    const keys = await F.evaluate(() => { try { return Object.keys(localStorage); } catch (e) { return ["(storage threw: " + e.message + ")"]; } });
    const tagged = R.reqs.filter((u) => new URL(u).origin === ORIGIN && /\?v=/.test(u)), wrong = tagged.filter((u) => new URL(u).searchParams.get("v") !== tag);
    const untagged = R.reqs.filter((u) => new URL(u).origin === ORIGIN && !/\?v=/.test(u) && !/\/index\.html$|\/$/.test(new URL(u).pathname));
    check("8 framed", wrong.length === 0 && tagged.length > 0, `cache tag: ${tagged.length} requests carry ?v=${tag} from ${GAME}, ${wrong.length} another tag, ${untagged.length} untagged` + (untagged.length ? " (" + untagged.map((u) => new URL(u).pathname.split("/").pop()).join(", ") + ")" : ""));
    await page.reload(); const F2 = await (await page.waitForSelector("#game")).contentFrame(); await F2.waitForFunction(() => document.getElementById("btn-play") && !document.getElementById("btn-play").hidden, null, { timeout: 15000 });
    const keys2 = await F2.evaluate(() => { try { return Object.keys(localStorage); } catch (e) { return []; } });
    check("8 framed", keys.length > 0 && keys.every((k) => k.startsWith("sappers-path.")) && keys.every((k) => keys2.includes(k)), `storage in the cross-site frame: keys ${JSON.stringify(keys)}, after a host reload ${JSON.stringify(keys2)}`);
    check("1 load", !R.console.length, `framed ${R.name}: ${R.console.length} console errors/warnings` + (R.console.length ? " " + R.console.slice(0, 3).join(" | ") : ""));
    check("2 origin", !R.off.length, `framed ${R.name}: ${R.reqs.length} requests, ${R.off.length} off the game's or the host page's origin` + (R.off.length ? " " + R.off.slice(0, 3).join(" ") : ""));
    await ctx.close(); }
  // 7: every request answered by the build; which zipped files nothing asked for
  { const asked = new Set(served.filter((s) => s.status === 200).map((s) => s.path.replace(T.subpath, "").replace(/^$/, "index.html").replace(/\/$/, "/index.html"))), miss = served.filter((s) => s.status !== 200 && !C.debugOnly.some((f) => s.path.endsWith(f)));
    const never = zipped.filter((f) => !asked.has(f));
    check("7 files", !miss.length, `${served.length} requests to the build, ${miss.length} not found` + (miss.length ? " " + miss.slice(0, 5).map((s) => s.path).join(", ") : "") + `; ${zipped.length - never.length} of ${zipped.length} zipped files asked for; never asked: ${never.join(", ") || "none"}`); }
} finally {
  await browser.close(); game.close(); host.close(); if (!keep) fs.rmSync(tmp, { recursive: true, force: true });
}
let bad = 0; for (const [k, L] of Object.entries(checks)) { const ok = L.every((c) => c.pass); if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + k); for (const c of L) console.log("     " + (c.pass ? "ok   " : "FAIL ") + c.line); }
console.log("bytes: " + JSON.stringify(notes)); console.log(bad ? `FAIL: ${bad} check(s)` : "PASS: every check"); if (keep) console.log("kept: " + tmp);
process.exit(bad ? 1 : 0);
