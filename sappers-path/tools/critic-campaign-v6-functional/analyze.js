// Functional critic, campaign v6 lane A: stored orders, independent careful grades, human proxy, tag/sawtooth reads.
"use strict";
const path = require("path"), D = path.join(__dirname, "../..");
const E = require(D + "/src/engine.js"), R = require(D + "/tools/grade.js");
const CFG = require(D + "/config.json"), BC = require(D + "/tools/bake-config.json");
const LV = require(D + "/levels/levels.json").levels.filter((l) => l.n >= 1 && l.n <= 200).sort((a, b) => a.n - b.n);
const rules = {}; for (const t of ["easy", "normal", "hard", "extreme"]) rules[t] = E.rulesOf(CFG.v3, t);
const realm = (n) => n <= 24 ? 1 : n <= 49 ? 2 : n <= 74 ? 3 : n <= 99 ? 4 : n <= 124 ? 5 : n <= 149 ? 6 : n <= 174 ? 7 : n <= 190 ? 8 : n <= 199 ? 9 : 10;
const out = { orders: [], careful: [], proxy: [], tags: "", sawtooth: [], obviousHigh: [] };
const part = process.argv[2] || "all";
// A: every stored order, patient, with hit/kill counters; real pace at 0/1/2/4 s thinking.
if (part === "all" || part === "A") {
  let bad = 0;
  for (const L of LV) {
    const B = E.compile(L), rt = rules[L.tag], ord = L.win[L.tag], S = E.sim(B, rt);
    let refused = 0;
    for (const ch of ord) { const j = +ch; if (S.status !== E.PLAYING) break; if (S.refused(j)) refused++; S.play(j); S.quiet(); }
    const r = { n: L.n, tag: L.tag, archers: L.archers || "", locks: L.locks ? L.locks.length : (L.lock ? 1 : 0), won: S.status === E.WON, hits: S.hits, kills: S.kills, refused, taps: ord.length, peak: S.peak };
    r.pace = [0, 1000, 2000, 4000].map((t) => R.pace(B, rt, ord, t).won ? 1 : 0).join("");
    if (!r.won || r.hits || r.kills || r.refused || r.taps > 55 || r.pace !== "1111") { bad++; r.BAD = 1; }
    out.orders.push(r);
  }
  out.ordersBad = bad;
}
// B: careful player on 20 random levels: stored seed (reproduce) and 3 fresh seeds.
if (part === "all" || part === "B") {
  let s = 20261007; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const pick = new Set(); while (pick.size < 20) pick.add(1 + Math.floor(rnd() * 200));
  for (const n of [...pick].sort((a, b) => a - b)) {
    const L = LV[n - 1], B = E.compile(L), rt = rules[L.tag], g = R.carefulGames(BC.grade.careful, n), seed = L.seed | 0;
    const same = +R.careful(B, rt, g, seed ^ 0x6c8e9cf5, 3).toFixed(3);
    const alt = [11, 22, 33].map((k) => R.careful(B, rt, g, seed ^ (0x51ed27 * k), 3));
    const am = alt.reduce((a, b) => a + b, 0) / 3;
    out.careful.push({ n, tag: L.tag, games: g, stored: L.grade[L.tag].careful, same, alt: alt.map((x) => +x.toFixed(3)), altMean: +am.toFixed(3) });
  }
}
// C: human proxy: the honest sampling planner (sees only what a player sees), up to 6 tries a level, one game a try.
if (part === "all" || part === "C") {
  const list = (process.argv[3] || "5,8,11,19,33,40,58,64,66,83,103,130,146,158,163,167,193,197,200").split(",").map(Number);
  for (const n of list) {
    const L = LV[n - 1], B = E.compile(L), rt = rules[L.tag];
    let tries = 0, won = false; const t0 = Date.now();
    while (tries < 6 && !won) { tries++; won = R.plan(B, rt, 1, 9001 + tries * 31 + n, 4, false) > 0; }
    const ob = R.careful(B, rt, 30, 4242 + n, 1);
    out.proxy.push({ n, tag: L.tag, archers: L.archers || "", won, tries, obvious30: +ob.toFixed(3), storedCareful: L.grade[L.tag].careful, storedObvious: L.grade[L.tag].obvious, rate: L.grade[L.tag].rate, ms: Date.now() - t0 });
  }
}
if (part === "all" || part === "D") {
  const TL = { easy: "E", normal: "N", hard: "H", extreme: "X" }; out.tags = LV.map((l) => TL[l.tag]).join("");
  // Extreme or Hard where the stored 1-deep player wins a lot
  for (const L of LV) { const g = L.grade[L.tag]; if ((L.tag === "extreme" || L.tag === "hard") && g.obvious != null && g.obvious >= 0.3) out.obviousHigh.push([L.n, L.tag, g.careful, g.obvious, g.rate]); }
  // realm means of careful/obvious per tag
  const agg = {}; for (const L of LV) { const k = realm(L.n) + ({ easy: "E", normal: "N", hard: "H", extreme: "X" })[L.tag]; const g = L.grade[L.tag]; (agg[k] = agg[k] || []).push([g.careful, g.obvious]); }
  out.agg = Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, [v.length, +(v.reduce((a, b) => a + (b[0] || 0), 0) / v.length).toFixed(2), +(v.reduce((a, b) => a + (b[1] || 0), 0) / v.length).toFixed(2)]]));
  out.twoLocks = LV.filter((l) => l.locks && l.locks.length === 2).map((l) => l.n + ":" + JSON.stringify(l.locks) + ":" + (l.archers || "-"));
  out.archers = LV.filter((l) => l.archers).map((l) => l.n + l.archers[0]);
}
// E: save/load round trip on v6 levels (pins, kills, two locks): random taps, save, play on, load, compare hash.
if (part === "E") {
  out.roundtrip = [];
  for (const n of [64, 66, 74, 80, 157, 159, 163, 176, 185, 192, 200]) {
    const L = LV[n - 1], B = E.compile(L), rt = rules[L.tag], S = E.sim(B, rt), buf = new Int32Array(S.M.length); let bad = 0, tries = 0;
    for (let g = 0; g < 40; g++) { S.reset(); const r = R.rng(g * 977 + n);
      for (let k = 0; k < 60 && S.status === E.PLAYING; k++) { const leg = []; for (let j = 0; j < E.NCOL; j++) if (R.legal(S, j)) leg.push(j); if (!leg.length) break;
        S.save(buf); const h = S.hash(), st = S.status, px = S.pixLeft, hi = S.hits, ki = S.kills; for (let q = 0; q < 3 && S.status === E.PLAYING; q++) { const l2 = []; for (let j = 0; j < E.NCOL; j++) if (R.legal(S, j)) l2.push(j); if (!l2.length) break; S.play(l2[Math.floor(r() * l2.length)]); S.quiet(); }
        S.load(buf); tries++; if (S.hash() !== h || S.status !== st || S.pixLeft !== px || S.hits !== hi || S.kills !== ki) bad++;
        S.play(leg[Math.floor(r() * leg.length)]); S.quiet(); } }
    // depth sweep with fresh seeds
    const dep = [1, 2, 3].map((d) => +R.careful(B, rt, 32, 777 + n, d).toFixed(3));
    out.roundtrip.push({ n, tag: L.tag, archers: L.archers || "", checks: tries, bad, depth123: dep, stored: [L.grade[L.tag].obvious, L.grade[L.tag].careful] });
  }
}
console.log(JSON.stringify(out));
