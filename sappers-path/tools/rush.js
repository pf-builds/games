// Sapper's Path v3 rushing check (playtest 1): on a spread of baked levels, random tap orders played patiently (tap,
// wait until nothing moves) against the same kind of random orders played rushed (a random wait between taps). Rushing
// should never be much easier than patience; a level where it is gets flagged.
//   ~/.local/opt/node/bin/node tools/rush.js [games per level, default 300]
"use strict";
const E = require("../src/engine.js");
const { rng } = require("./grade.js");
const V3 = require("../config.json").v3, LV = require("../levels/levels.json").levels;
const N = +process.argv[2] || 300, rules = E.rulesOf(V3, "normal");
const WAITS = { patient: null, "rush 0-3 s": 3000, "rush 0-1 s": 1000 };
const pick = [5, 12, 18, 24, 33, 40, 47, 58, 66, 74].map((n) => LV.find((l) => l.n === n)).filter(Boolean);
console.log("level band        " + Object.keys(WAITS).map((k) => k.padStart(12)).join(""));
let flagged = 0;
for (const L of pick) {
  const B = E.compile(L), S = E.sim(B, rules), row = [];
  for (const [k, w] of Object.entries(WAITS)) {
    let wins = 0;
    for (let g = 0; g < N; g++) {
      S.reset(); const r = rng(L.n * 7919 + g), open = [];
      for (let guard = 0; guard <= B.ncards && S.status === E.PLAYING; guard++) {
        open.length = 0; for (let j = 0; j < 5; j++) if (S.heads[j] < B.colLen[j]) open.push(j);
        if (!open.length) break;
        const j = open[Math.floor(r() * open.length)];
        if (w == null) { S.play(j); S.quiet(); } else S.play(j, S.now + Math.floor(r() * w));
      }
      S.quiet(); if (S.status === E.WON) wins++;
    }
    row.push(wins / N);
  }
  const bad = row.slice(1).some((x) => x > row[0] + 0.1);
  if (bad) flagged++;
  console.log(String(L.n).padStart(5) + " " + L.band.padEnd(11) + row.map((x) => ((100 * x).toFixed(1) + "%").padStart(12)).join("") + (bad ? "   FLAG: rushing easier" : ""));
}
console.log(flagged ? flagged + " level(s) flagged" : "no level where rushing is more than 10 points easier than patience");
