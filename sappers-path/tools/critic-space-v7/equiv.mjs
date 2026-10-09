// Critic (space v7, functional): base (a11e9bf) vs new build equivalence, written independently of tools/space-v7.
// node equiv.mjs  (servers: new on 8481, base on 8482, both serving sappers-path/ at the root)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
import { writeFileSync } from "node:fs";
const OUT = new URL("./equiv-out.json", import.meta.url);
const B = await chromium.launch();
const BASE = "http://127.0.0.1:8482/", NEW = "http://127.0.0.1:8481/";
async function open(url) {
  const ctx = await B.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(), msgs = [];
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") msgs.push(m.type() + ": " + m.text()); });
  p.on("pageerror", (e) => msgs.push("pageerror: " + e.message));
  p.on("response", (r) => { if (r.status() >= 400) msgs.push("HTTP " + r.status() + " " + r.url()); });
  await p.goto(url + "?debug=1"); await p.waitForFunction(() => window.SP, null, { timeout: 30000 });
  return { ctx, p, msgs };
}
// 1. Data level: each page's own files -> records the engine sees -> E.compile output, serialised.
const dataDump = async (p, isNew) => p.evaluate(async (isNew) => {
  const NS = window.SappersPath, E = NS.engine, Pk = NS.pack, get = (u) => fetch(u, { cache: "no-store" }).then((r) => r.json());
  const recs = {};
  const ser = (o) => JSON.stringify(o, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v instanceof Map ? [...v] : v instanceof Set ? [...v] : v));
  const put = (src, L) => { const c = JSON.parse(JSON.stringify(L)); let comp; try { comp = ser(E.compile(JSON.parse(JSON.stringify(L)))); } catch (e) { comp = "THROW " + e.message; } recs[src + ":" + L.id] = { L: c, comp }; };
  if (!isNew) {
    for (const [f, s] of [["levels", "lv"], ["gallery", "ga"], ["zen", "zen"]]) { const J = await get("levels/" + f + ".json"); for (const L of J.levels) put(s, L); if (f === "zen") recs.__worlds = J.worlds; }
  } else {
    for (const [f, s] of [["levels", "lv"], ["gallery", "ga"]]) { const J = Pk.unpackFile(await get("levels/" + f + ".pk.json")); for (const L of J.levels) put(s, L); }
    const I = await get("levels/zen.pk.json"); recs.__worlds = I.worlds.map(Pk.unpackWorld).map((w) => { const o = Object.assign({}, w); delete o.recs; return o; });
    for (const w of I.worlds) { if (!w.recs) continue; const J = await get("levels/" + w.recs.file); for (const P of J.levels) put("zen", Pk.unpack(P)); }
  }
  return recs;
}, isNew);
const A = await open(BASE), N = await open(NEW);
const SKIP = process.argv.includes("--play"); const dA = SKIP ? {__worlds:1} : await dataDump(A.p, false), dN = SKIP ? {__worlds:1} : await dataDump(N.p, true);
const DROP = await N.p.evaluate(() => window.SappersPath.pack.DROP);
const res = { data: { base: 0, new: 0, missing: [], extra: [], fieldDiff: [], compDiff: [], dropSeen: {}, worlds: null } };
const key = (k) => k.replace(/^(lv|zen):/, "L:"); // a land's records moved between files: compare by id across lv/zen
const mA = new Map(Object.keys(dA).filter((k) => k !== "__worlds").map((k) => [key(k), dA[k]])), mN = new Map(Object.keys(dN).filter((k) => k !== "__worlds").map((k) => [key(k), dN[k]]));
res.data.base = mA.size; res.data.new = mN.size;
for (const [k, a] of mA) {
  const b = mN.get(k); if (!b) { res.data.missing.push(k); continue; }
  const want = {}; for (const f of Object.keys(a.L)) { if (DROP.includes(f)) { res.data.dropSeen[f] = (res.data.dropSeen[f] || 0) + 1; continue; } want[f] = a.L[f]; }
  if (JSON.stringify(want) !== JSON.stringify(b.L)) res.data.fieldDiff.push(k);
  if (a.comp !== b.comp) res.data.compDiff.push(k);
}
for (const k of mN.keys()) if (!mA.has(k)) res.data.extra.push(k);
res.data.worlds = JSON.stringify(dA.__worlds) === JSON.stringify(dN.__worlds);
console.log("data", JSON.stringify(res.data).slice(0, 800));

// 2. App level: the ids each page knows, then SP.load each and snapshot the live state + its stored win order.
const ids = async (p) => p.evaluate(() => ({ zen: SP.zen(), gal: SP.gallery(), mode: SP.mode() }));
const iA = await ids(A.p), iN = await ids(N.p);
res.ids = { zenSame: JSON.stringify(iA.zen) === JSON.stringify(iN.zen), galSame: JSON.stringify(iA.gal) === JSON.stringify(iN.gal), zen: iA.zen.length, gal: iA.gal.length };
const all = [...Array.from({ length: 200 }, (_, i) => i + 1), ...iA.gal, ...iA.zen];
const snap = async (p, list) => p.evaluate(async (list) => {
  const o = [];
  for (const id of list) { let s = SP.load(id); if (s && s.then) s = await s; const w = SP.winOrder();
    o.push({ id, s: s && { screen: s.screen, id: s.id, n: s.n, era: s.era, tag: s.tag, status: s.status, pixLeft: s.pixLeft, cap: s.cap, line: s.line, fronts: s.fronts, w: s.w, h: s.h, links: s.links, hidden: s.hidden, locked: s.locked, open: s.open, mode: SP.mode(), name: document.getElementById("lvl-name").textContent, num: document.getElementById("lvl-num").textContent }, w }); }
  SP.screen("title"); return o;
}, list);
res.app = { n: all.length, diff: [] };
for (let i = 0; i < (SKIP ? 0 : all.length); i += 40) {
  const ch = all.slice(i, i + 40), a = await snap(A.p, ch), b = await snap(N.p, ch);
  for (let j = 0; j < a.length; j++) if (JSON.stringify(a[j]) !== JSON.stringify(b[j])) res.app.diff.push({ id: a[j].id, a: JSON.stringify(a[j]).slice(0, 300), b: JSON.stringify(b[j]).slice(0, 300) });
}
console.log("app", res.app.n, "diffs", res.app.diff.length);

// 3. Play: identical taps to a win (stored order) and to a loss (lossPlan) on both; compare outcome + whole localStorage.
const play = async (p, id, kind) => p.evaluate(async ([id, kind]) => {
  let s = SP.load(id); if (s && s.then) s = await s;
  let ord = kind === "win" ? SP.winOrder() : SP.lossPlan(id); const rush = kind !== "win"; if (ord && typeof ord === "object" && ord.prefix != null) ord = ord.prefix; if (Array.isArray(ord)) ord = ord.join("");
  if (typeof ord !== "string") return { id, kind, err: "no order " + JSON.stringify(ord).slice(0, 80) };
  for (let i = 0; i < ord.length; i++) { if (SP.state().status !== "playing") break; SP.play(ord.charCodeAt(i) - 48); if (!rush) SP.settle(); } if (rush) { for (let k = 0; k < 30 && SP.state().status === "playing"; k++) { SP.fill(); SP.tick(3000); } }
  const st = SP.tick(9000), ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  return { id, kind, status: st.status, reason: st.reason, plays: st.plays, hits: st.hits, kills: st.kills, pixLeft: st.pixLeft, panel: st.panel, title: document.getElementById("p-title").textContent, line: document.getElementById("p-line").textContent, ls };
}, [id, kind]);
const strip = (r) => { const c = JSON.parse(JSON.stringify(r)); c.ls = c.ls || {}; for (const k of Object.keys(c.ls || {})) { try { const v = JSON.parse(c.ls[k]); for (const t of ["t", "at", "time", "ts", "lifeAt", "stamp", "saved"]) if (v && typeof v === "object") delete v[t]; c.ls[k] = JSON.stringify(v); } catch (e) {} } return c; };
const plays = [[1, "win"], [5, "win"], [37, "loss"], [100, "win"], [150, "loss"], [200, "win"], [iA.gal[0], "win"], [iA.zen.find((x) => /^z1-/.test(x)), "win"], [iA.zen.find((x) => /^z3-/.test(x)), "win"], [iA.zen.find((x) => /^z4-/.test(x)), "loss"], [iA.zen.find((x) => /^z4-/.test(x)), "win"]];
res.play = [];
for (const [id, kind] of plays) { const a = await play(A.p, id, kind), b = await play(N.p, id, kind); res.play.push({ id, kind, same: JSON.stringify(strip(a)) === JSON.stringify(strip(b)), a: { status: a.status, reason: a.reason, plays: a.plays, line: a.line, err: a.err }, b: { status: b.status, reason: b.reason, plays: b.plays, line: b.line, err: b.err }, lsA: JSON.stringify(strip(a).ls || {}).length, lsDiff: JSON.stringify(strip(a).ls) === JSON.stringify(strip(b).ls) ? null : [JSON.stringify(strip(a).ls).slice(0, 600), JSON.stringify(strip(b).ls).slice(0, 600)] }); }
console.log("play", JSON.stringify(res.play.map((r) => [r.id, r.kind, r.same, r.a.status, r.b.status, r.a.err || ""])));
res.msgs = { base: A.msgs, new: N.msgs };
writeFileSync(SKIP ? new URL("./equiv-play.json", import.meta.url) : OUT, JSON.stringify(res, null, 1));
console.log("msgs new", N.msgs.length, N.msgs.slice(0, 5), "base", A.msgs.length);
await B.close();
