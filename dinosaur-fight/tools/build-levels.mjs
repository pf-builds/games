// Dinosaur Fight! — level baker. Writes ../levels.json deterministically.
// Tile chars: '.'air '#'dirt(solid) '-'platform(solid) 'B'crate 'M'stone
// '~'water 'e'egg 'h'heart 'w'walker 's'shooter 'n'netter 'Z'boss
// 'F'flag 'P'start 'C'checkpoint  decor: 't'tree 'f'fern 'r'rock
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const H = 17;

function makeLevel(w) {
  const g = Array.from({ length: H }, () => Array(w).fill("."));
  const api = {
    g, w,
    put(x, y, ch) { if (x >= 0 && x < w && y >= 0 && y < H) g[y][x] = ch; },
    fill(x0, y0, x1, y1, ch) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) api.put(x, y, ch);
    },
    // solid ground from row `top` to bottom, skipping [gapStart,gapEnd] pits
    ground(top, gaps = []) {
      for (let x = 0; x < w; x++) {
        const inGap = gaps.some(([a, b]) => x >= a && x <= b);
        for (let y = top; y < H; y++) api.put(x, y, inGap ? "." : "#");
      }
      // water fills pits from top+1 down
      for (const [a, b] of gaps)
        for (let x = a; x <= b; x++)
          for (let y = top + 1; y < H; y++) api.put(x, y, "~");
    },
    rows() { return g.map(r => r.join("")); },
  };
  return api;
}

const levels = [];

// ---------- Level 1: Jungle Trail (easy — a 5yo beats it) ----------
{
  const L = makeLevel(120);
  L.ground(13, [[50, 51]]);                 // one tiny 2-wide water pit
  L.fill(50, 11, 51, 11, "-");              // stepping stone over it — L1 stays kind
  L.fill(20, 12, 26, 12, "#");              // low step (1 high)
  L.fill(66, 11, 84, 12, "#");              // raised area (2 high)
  L.fill(40, 8, 46, 8, "-");                // floating platform

  L.put(3, 12, "P");
  // eggs
  [15, 17, 19].forEach(x => L.put(x, 12, "e"));   // approach eggs (over flat ground)
  [21, 23, 25].forEach(x => L.put(x, 11, "e"));   // on the low step
  [41, 43, 45].forEach(x => L.put(x, 7, "e"));    // on the platform
  [70, 72, 74].forEach(x => L.put(x, 9, "e"));    // over the raised area
  L.put(73, 10, "h");
  // baddies: 2 ground walkers, 1 step walker, 1 shooter
  L.put(32, 12, "w");
  L.put(58, 12, "w");
  L.put(76, 10, "w");
  L.put(98, 12, "s");
  // teachables
  L.put(88, 12, "B"); L.put(88, 11, "B");   // 2-high crate stack (jump OR smash)
  L.put(60, 12, "C");
  L.put(114, 12, "F");
  // decor
  L.put(10, 12, "t"); L.put(13, 12, "f"); L.put(44, 12, "t");
  L.put(63, 12, "f"); L.put(92, 12, "t"); L.put(105, 12, "f"); L.put(108, 12, "r");
  levels.push({ name: "Jungle Trail", theme: "jungle", rows: L.rows() });
}

// ---------- Level 2: Riverside (water, netter debut, shrink tunnel, grow wall) ----------
{
  const L = makeLevel(140);
  L.ground(13, [[30, 33], [88, 91]]);
  // stepping stone over first pit
  L.fill(31, 11, 32, 11, "-");
  // raised river bank with a 1-tile tunnel at ground level — small only
  L.fill(56, 11, 80, 12, "#");               // bank shelf, 2 tiles above grade
  L.fill(56, 12, 80, 12, ".");               // full-width crawlspace beneath it
  [60, 64, 68, 72, 76].forEach(x => L.put(x, 12, "e"));
  // platform over second pit
  L.fill(88, 10, 91, 10, "-");
  // grow wall: crates 5 high — too tall to jump, a T-rex walks straight through
  L.fill(104, 8, 105, 12, "B");
  [95, 97, 99].forEach(x => L.put(x, 12, "e")); // power-up eggs before the wall
  // items/baddies
  L.put(3, 12, "P");
  [12, 14].forEach(x => L.put(x, 12, "e"));
  [40, 42].forEach(x => L.put(x, 12, "e"));
  L.put(50, 12, "w");
  L.put(45, 12, "n");                        // netter debut
  L.put(66, 10, "w");                        // on the bank top
  L.put(84, 12, "C");
  L.put(119, 12, "n");
  L.put(126, 12, "w");
  L.put(130, 12, "s");
  L.put(112, 12, "h");
  L.put(136, 12, "F");
  // decor
  L.put(8, 12, "t"); L.put(22, 12, "f"); L.put(48, 12, "f");
  L.put(70, 10, "t"); L.put(98, 12, "f"); L.put(116, 12, "t"); L.put(24, 12, "r");
  levels.push({ name: "Riverside", theme: "river", rows: L.rows() });
}

// ---------- Level 3: Baddie Camp (crate maze, towers, vertical bit) ----------
{
  const L = makeLevel(150);
  L.ground(13, [[64, 67]]);
  // crate stack 1 (jump over or smash)
  L.fill(34, 11, 35, 12, "B");
  L.put(38, 12, "s");                        // shooter guarding it, on the ground
  // crate choke on a mound: 5-high wall on top (grow to smash or jump the mound
  // as T-rex) + a small-only tunnel through the mound at ground level
  L.fill(44, 11, 53, 12, "#");               // shelf, 2 tiles above grade
  L.fill(44, 12, 53, 12, ".");               // full-width crawlspace beneath it
  L.fill(48, 6, 49, 10, "B");                // crate wall standing on the shelf
  [46, 48, 50].forEach(x => L.put(x, 12, "e"));
  // pit with platform hops
  L.fill(64, 10, 65, 10, "-");
  // vertical climb to high ledge (egg bonus route)
  L.fill(78, 11, 82, 11, "-");
  L.fill(86, 9, 90, 9, "-");
  L.fill(94, 7, 104, 7, "-");
  [96, 98, 100, 102].forEach(x => L.put(x, 6, "e"));
  L.put(101, 6, "n");
  // grow wall 2: 5-high crates (must smash through as the T-rex)
  L.fill(112, 8, 113, 12, "B");
  [106, 108, 110].forEach(x => L.put(x, 12, "e"));
  // final gauntlet
  L.put(3, 12, "P");
  [10, 12, 14].forEach(x => L.put(x, 12, "e"));
  L.put(20, 12, "w");
  L.put(28, 12, "w");
  L.put(58, 12, "w");
  L.put(75, 12, "C");
  L.put(96, 12, "w");                        // under the high route
  L.put(122, 12, "s");
  L.put(128, 12, "n");
  L.put(134, 12, "w");
  L.put(104, 12, "h");
  L.put(145, 12, "F");
  // decor
  L.put(7, 12, "t"); L.put(17, 12, "f"); L.put(41, 12, "r");
  L.put(56, 12, "f"); L.put(92, 12, "t"); L.put(118, 12, "f"); L.put(140, 12, "t");
  levels.push({ name: "Baddie Camp", theme: "camp", rows: L.rows() });
}

// ---------- Level 4: Boss Arena (tight — short charges, quick dizzies) ----------
{
  const L = makeLevel(46);
  L.ground(13, []);
  L.fill(0, 4, 1, 12, "M");                  // left wall
  L.fill(44, 4, 45, 12, "M");                // right wall
  L.put(5, 12, "P");
  L.put(31, 12, "Z");
  [12, 22, 34].forEach(x => L.put(x, 12, "e"));
  L.put(17, 12, "h");
  L.put(27, 12, "h");
  L.put(40, 12, "F");
  L.put(9, 12, "r"); L.put(37, 12, "r");
  levels.push({ name: "Boss Baddie!", theme: "arena", rows: L.rows() });
}

// validate: uniform widths, exactly one P per level, flag present
for (const lv of levels) {
  const w = lv.rows[0].length;
  if (!lv.rows.every(r => r.length === w)) throw new Error(lv.name + ": ragged rows");
  const all = lv.rows.join("");
  const count = ch => all.split(ch).length - 1;
  if (count("P") !== 1) throw new Error(lv.name + ": P count " + count("P"));
  if (count("F") !== 1) throw new Error(lv.name + ": F count " + count("F"));
  if (lv.rows.length !== H) throw new Error(lv.name + ": height " + lv.rows.length);
}

const out = { version: "1-20260831", levels };
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "..", "levels.json"), JSON.stringify(out, null, 1));
console.log("wrote levels.json:", levels.map(l => `${l.name} ${l.rows[0].length}x${H}`).join(" | "));
