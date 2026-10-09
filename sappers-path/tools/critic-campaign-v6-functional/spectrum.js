"use strict";
const D = __dirname + "/../..", E = require(D + "/src/engine.js"), R = require(D + "/tools/grade.js"), CFG = require(D + "/config.json");
const LV = require(D + "/tools/build-data/levels/levels.json").levels;
for (const n of [45, 117, 157, 159, 162, 165, 176, 185, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200]) {
  const L = LV.find((l) => l.n === n), rt = E.rulesOf(CFG.v3, L.tag), B = E.compile(L), g = L.grade[L.tag];
  const planH = R.plan(B, rt, 8, 5150 + n, 4, false), look = R.greedy(B, rt, 30, 6160 + n), mys = L.cols.flat().filter((c) => c[2]).length;
  console.log(JSON.stringify({ n, tag: L.tag, arch: L.archers || "", random: g.rate, lookStored: g.greedy, look30: +look.toFixed(3), obvious: g.obvious, careful: g.careful, planHonest8: +planH.toFixed(3), qCards: mys, hidden: L.v6 && L.v6.hidden }));
}
