"use strict";
const D = __dirname + "/../..", E = require(D + "/src/engine.js"), R = require(D + "/tools/grade.js"), CFG = require(D + "/config.json");
const LV = require(D + "/levels/levels.json").levels, want = process.argv[2];
const L = LV.find((l) => l.n === +process.argv[3]), rt = E.rulesOf(CFG.v3, L.tag), B = E.compile(L), S = E.sim(B, rt), win = L.win[L.tag];
const buf = new Int32Array(S.M.length), res = {};
for (let k = 0; k < 4000 && !(res.pinWin && res.pinJam); k++) {
  S.reset(); const r = R.rng(k * 131 + 7), pre = k % win.length; let ord = "";
  for (let g = 0; g < 80 && S.status === E.PLAYING; g++) {
    const leg = []; for (let j = 0; j < E.NCOL; j++) if (R.legal(S, j)) leg.push(j); if (!leg.length) break;
    let j;
    if (g < pre) j = +win[g]; else { // 1-deep: prefer taps that don't fail, random among top-ish
      S.save(buf); const sc = leg.map((c) => { S.play(c); S.quiet(); const v = S.status === E.FAILED ? -1e9 : S.status === E.WON ? 1e9 : -S.pixLeft + r() * 40; S.load(buf); return v; });
      j = leg[sc.indexOf(Math.max(...sc))]; }
    S.play(j); S.quiet(); ord += j;
  }
  const pinnedSeen = S.hits > 0;
  if (want === "pin" && S.status === E.WON && S.hits > 0 && !res.pinWin) res.pinWin = { ord, hits: S.hits };
  if (want === "pin" && S.status === E.FAILED && S.hits > 0 && !res.pinJam) res.pinJam = { ord, hits: S.hits, reason: S.reason, why: S.jamWhy };
  if (want === "kill" && S.status === E.FAILED && S.kills > 0 && !res.pinJam) res.pinJam = { ord, kills: S.kills, reason: S.reason };
  if (want === "kill" && S.status === E.WON && S.hits > 0 && !res.pinWin) res.pinWin = { ord, hits: S.hits, kills: S.kills };
}
console.log(JSON.stringify(res));
