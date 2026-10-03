// Sapper's Path v4.3 level tags (SPEC-v4 §9, the v4.3 entry). There is no difficulty picker: every level plays on one
// fixed tag, Easy (6 holding spaces), Normal (5) or Hard (4, archers lethal; level 51 keeps safeArchers), from its place
// in the campaign. T (bake config `tags`, Gallery config `bake.tags`):
//   ends: the era ends (Hard: every era ends on a Hard boss); the level after one is Easy (a breather);
//   teaching levels: `first` before `from`, `afterEnd` right after an era end, else `teach` (Easy or Normal, never Hard);
//   other levels before `from`: `first`; from `from` on, `cycle` repeating (a Hard every 4-5 levels, an Easy after the
//   second Hard of each round).
//   tagOf(n, T, teaching) -> "easy" | "normal" | "hard"
// The bands follow the tag (bake config curve.byTag): a Hard level takes its section's hardest band, an Easy one the
// gentlest, so the tag a player reads is the difficulty the grader measured (on the tag's own rules).
"use strict";
const TAGS = ["easy", "normal", "hard"];
function tagOf(n, T, teaching) {
  const ends = T.ends || [];
  if (ends.indexOf(n) >= 0) return "hard";
  if (teaching) return n < T.from ? T.first : ends.indexOf(n - 1) >= 0 ? T.afterEnd : T.teach;
  if (ends.indexOf(n - 1) >= 0) return T.afterEnd;
  if (n < T.from) return T.first;
  return T.cycle[(n - T.from) % T.cycle.length];
}
module.exports = { TAGS, tagOf };
