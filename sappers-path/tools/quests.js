// Sapper's Path v5 R2, side quests (the rules review: "every 3-5 levels a side-quest node holds a picture level and gives
// a one-time power-up reward"; refinement round 1: optional detours, the prize shown before playing, rare power-ups like
// the Volley mostly from side quests; config.json gallery.quests). The Gallery's pictures become side quests in their
// order: picture 1 after main level quests.first, each next one quests.gaps[i % gaps.length] main levels after the one
// before (3-5). Each carries one power-up use as its prize, from the power-ups the campaign has unlocked by then (a
// quest after level a is reached with the campaign at a + 1; meta.powers unlockAt): the Volley only from its unlock and
// then on every quests.volleyEvery-th quest past it; otherwise the unlocked ones in turn (meta.powers order, the Volley
// left out). Quests after the last built level wait for it (R4 builds 100-200); until then they open one at a time once
// the campaign is complete (src/save.js questOpen).
//   questsOf(n, Q, powers) -> [{after, prize}] for pictures 1..n
//   ~/.local/opt/node/bin/node tools/quests.js [--write]   prints the table; --write stores quest {after, prize} on every
//                                                          picture of levels/gallery.json (nothing else changes)
"use strict";
const fs = require("fs"), path = require("path");
function questsOf(n, Q, powers) {
  const out = [], volley = powers.find((p) => p.id === Q.rare), past = []; let after = Q.first, turn = 0;
  for (let i = 0; i < n; i++) {
    if (i) after += Q.gaps[(i - 1) % Q.gaps.length];
    const reach = after + 1, pool = powers.filter((p) => p.id !== Q.rare && p.unlockAt <= reach);
    let prize;
    if (volley && reach >= volley.unlockAt) { past.push(i); if ((past.length - 1) % Q.volleyEvery === Q.volleyEvery - 1) prize = volley.id; }
    if (!prize) prize = pool[turn++ % pool.length].id;
    out.push({ after, prize });
  }
  return out;
}
// Lands foundation: a land's side quests (its own bonus pictures). Picture i of the land follows main level
// land.from - 1 + Q.first, then each next one Q.gaps in turn after the one before (3-5), while it stays within the land;
// i0: the pictures in the Gallery before the land's (its prizes go on in the same turn as questsOf's).
//   landQuestsOf(land, Q, powers, i0, max) -> [{after, prize}] (at most max)
function landQuestsOf(land, Q, powers, i0, max) {
  const afters = []; let after = land.from - 1 + Q.first;
  for (let i = 0; after <= land.to && afters.length < max && i < 1000; i++) { afters.push(after); after += Q.gaps[i % Q.gaps.length]; }
  const P = questsOf(i0 + afters.length, Q, powers);
  return afters.map((a, k) => ({ after: a, prize: P[i0 + k].prize }));
}
module.exports = { questsOf, landQuestsOf };

if (require.main === module) {
  const CFG = require("../config.json"), file = path.join(__dirname, "../levels/gallery.json"), F = JSON.parse(fs.readFileSync(file, "utf8"));
  const Q = questsOf(F.levels.length, CFG.gallery.quests, CFG.meta.powers), last = require("./bake-config.json").levels;
  F.levels.forEach((l, i) => console.log(String(l.n).padStart(2) + " after " + String(Q[i].after).padStart(3) + (Q[i].after > last ? " (past " + last + ")" : "") + "  " + Q[i].prize.padEnd(13) + " " + l.title));
  if (process.argv.includes("--write")) { F.levels.forEach((l, i) => { l.quest = Q[i]; }); fs.writeFileSync(file, JSON.stringify(F)); console.log("wrote quest {after, prize} on " + F.levels.length + " pictures"); }
}
