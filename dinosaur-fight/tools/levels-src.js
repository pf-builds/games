// Dinosaur Fight! — level source. Plain script so it runs under node (via build-levels.mjs)
// OR macOS JavaScriptCore with no node installed: tools/bake.sh
// Tile chars: '.'air '#'dirt(solid) '-'platform(solid) 'B'crate 'M'stone
// '~'water(deep) '_'mud(shallow: T-rex wades, everyone else sinks)
// 'c'cracked floor(collapses under the T-rex) '|'vine(small climbs)
// 'e'egg 'E'golden egg 'v'egg on a vine 'h'heart
// 'w'walker 's'shooter 'n'netter 'a'armored 'Z'boss(big baddie) 'J'jeep boss
// 'F'flag 'P'start 'C'checkpoint
// decor: 't'tree 'f'fern 'r'rock 'y'stalactite 'm'glow mushroom 'd'reeds


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
    // shallow mud at grade level: T-rex stands on it, everyone else sinks
    marsh(a, b, top = 13) {
      for (let x = a; x <= b; x++) {
        api.put(x, top, "_");
        for (let y = top + 1; y < H; y++) api.put(x, y, "~");
      }
    },
    // cracked bridge at grade over mud: normal/small walk it, T-rex crashes through into the mud
    crackedBridge(a, b, top = 13) {
      for (let x = a; x <= b; x++) {
        api.put(x, top, "c");
        api.put(x, top + 1, "_");
        for (let y = top + 2; y < H; y++) api.put(x, y, "~");
      }
    },
    ceiling(rows = 2) { api.fill(0, 0, w - 1, rows - 1, "#"); },
    rows() { return g.map(r => r.join("")); },
  };
  return api;
}

const levels = [];

// ================= WORLD 1: JUNGLE =================

// ---------- Level 1: Jungle Trail (easy — a 5yo beats it) ----------
{
  const L = makeLevel(120);
  L.ground(13, [[50, 51]]);                 // one tiny 2-wide water pit
  L.fill(50, 11, 51, 11, "-");              // stepping stone over it — L1 stays kind
  L.fill(20, 12, 26, 12, "#");              // low step (1 high)
  L.fill(66, 11, 84, 12, "#");              // raised area (2 high)
  L.fill(40, 8, 46, 8, "-");                // floating platform

  L.put(3, 12, "P");
  [15, 17, 19].forEach(x => L.put(x, 12, "e"));
  [21, 23, 25].forEach(x => L.put(x, 11, "e"));
  [41, 43, 45].forEach(x => L.put(x, 7, "e"));
  [70, 72, 74].forEach(x => L.put(x, 9, "e"));
  L.put(73, 10, "h");
  L.put(32, 12, "w");
  L.put(58, 12, "w");
  L.put(76, 10, "w");
  L.put(98, 12, "s");
  L.put(88, 12, "B"); L.put(88, 11, "B");
  L.put(60, 12, "C");
  L.put(114, 12, "F");
  L.put(10, 12, "t"); L.put(13, 12, "f"); L.put(44, 12, "t");
  L.put(63, 12, "f"); L.put(92, 12, "t"); L.put(105, 12, "f"); L.put(108, 12, "r");
  levels.push({ name: "Jungle Trail", theme: "jungle", world: 1, rows: L.rows() });
}

// ---------- Level 2: Riverside ----------
{
  const L = makeLevel(140);
  L.ground(13, [[30, 33], [88, 91]]);
  L.fill(31, 11, 32, 11, "-");
  L.fill(56, 11, 80, 12, "#");
  L.fill(56, 12, 80, 12, ".");
  [60, 64, 68, 72, 76].forEach(x => L.put(x, 12, "e"));
  L.fill(88, 10, 91, 10, "-");
  L.fill(104, 8, 105, 12, "B");
  [95, 97, 99].forEach(x => L.put(x, 12, "e"));
  L.put(3, 12, "P");
  [12, 14].forEach(x => L.put(x, 12, "e"));
  [40, 42].forEach(x => L.put(x, 12, "e"));
  L.put(50, 12, "w");
  L.put(45, 12, "n");
  L.put(66, 10, "w");
  L.put(84, 12, "C");
  L.put(119, 12, "n");
  L.put(126, 12, "w");
  L.put(130, 12, "s");
  L.put(112, 12, "h");
  L.put(136, 12, "F");
  L.put(8, 12, "t"); L.put(22, 12, "f"); L.put(48, 12, "f");
  L.put(70, 10, "t"); L.put(98, 12, "f"); L.put(116, 12, "t"); L.put(24, 12, "r");
  levels.push({ name: "Riverside", theme: "river", world: 1, rows: L.rows() });
}

// ---------- Level 3: Baddie Camp ----------
{
  const L = makeLevel(150);
  L.ground(13, [[64, 67]]);
  L.fill(34, 11, 35, 12, "B");
  L.put(38, 12, "s");
  L.fill(44, 11, 53, 12, "#");
  L.fill(44, 12, 53, 12, ".");
  L.fill(48, 6, 49, 10, "B");
  [46, 48, 50].forEach(x => L.put(x, 12, "e"));
  L.fill(64, 10, 65, 10, "-");
  L.fill(78, 11, 82, 11, "-");
  L.fill(86, 9, 90, 9, "-");
  L.fill(94, 7, 104, 7, "-");
  [96, 98, 100, 102].forEach(x => L.put(x, 6, "e"));
  L.put(101, 6, "n");
  L.fill(112, 8, 113, 12, "B");
  [106, 108, 110].forEach(x => L.put(x, 12, "e"));
  L.put(3, 12, "P");
  [10, 12, 14].forEach(x => L.put(x, 12, "e"));
  L.put(20, 12, "w");
  L.put(28, 12, "w");
  L.put(58, 12, "w");
  L.put(75, 12, "C");
  L.put(96, 12, "w");
  L.put(122, 12, "s");
  L.put(128, 12, "n");
  L.put(134, 12, "w");
  L.put(104, 12, "h");
  L.put(145, 12, "F");
  L.put(7, 12, "t"); L.put(17, 12, "f"); L.put(41, 12, "r");
  L.put(56, 12, "f"); L.put(92, 12, "t"); L.put(118, 12, "f"); L.put(140, 12, "t");
  levels.push({ name: "Baddie Camp", theme: "camp", world: 1, rows: L.rows() });
}

// ---------- Level 4: Boss Arena ----------
{
  const L = makeLevel(46);
  L.ground(13, []);
  L.fill(0, 4, 1, 12, "M");
  L.fill(44, 4, 45, 12, "M");
  L.put(5, 12, "P");
  L.put(31, 12, "Z");
  [12, 22, 34].forEach(x => L.put(x, 12, "e"));
  L.put(17, 12, "h");
  L.put(27, 12, "h");
  L.put(40, 12, "F");
  L.put(9, 12, "r"); L.put(37, 12, "r");
  levels.push({
    name: "Boss Baddie!", theme: "arena", world: 1, boss: true, bossName: "BIG BOSS BADDIE",
    intro: ["BIG BOSS BADDIE!", "Double-jump over his charges...", "then stomp him when he's dizzy!"],
    rows: L.rows(),
  });
}

// ================= WORLD 2: SWAMP & CAVE =================

// ---------- Level 5: Mucky Marsh (mud debut — grow to wade) ----------
{
  const L = makeLevel(150);
  L.ground(13, []);
  L.marsh(24, 27);                            // 4 wide — wade it, or double-jump it
  L.marsh(58, 66);                            // 9 wide — T-rex only
  L.fill(78, 11, 90, 12, "#");                // shelf with a shooter on top
  L.marsh(96, 105);                           // 10 wide, egg trail overhead
  L.fill(110, 6, 111, 12, "M");               // 7-high pillar: golden egg on top (T-rex double-jump)
  L.marsh(128, 131);                          // 4 wide

  L.put(3, 12, "P");
  [10, 12, 14].forEach(x => L.put(x, 12, "e"));
  L.put(18, 12, "w");
  [30, 32].forEach(x => L.put(x, 12, "e"));
  L.put(38, 12, "w");
  L.put(44, 12, "n");
  L.put(50, 12, "w");
  [52, 54, 56].forEach(x => L.put(x, 12, "e"));
  L.put(70, 12, "h");
  L.put(72, 12, "C");
  [80, 82].forEach(x => L.put(x, 10, "e"));
  L.put(85, 10, "s");
  L.put(94, 12, "w");
  [98, 100, 102, 104].forEach(x => L.put(x, 11, "e"));
  [107, 108].forEach(x => L.put(x, 12, "e"));
  L.put(110, 5, "E");
  L.put(118, 12, "w");
  L.put(124, 12, "s");
  [126, 127].forEach(x => L.put(x, 12, "e"));
  L.put(136, 12, "n");
  L.put(141, 12, "w");
  L.put(146, 12, "F");
  // decor
  L.put(7, 12, "t"); L.put(16, 12, "f"); L.put(23, 12, "d"); L.put(28, 12, "d");
  L.put(41, 12, "t"); L.put(57, 12, "d"); L.put(67, 12, "d"); L.put(75, 12, "f");
  L.put(93, 12, "d"); L.put(106, 12, "d"); L.put(115, 12, "t"); L.put(121, 12, "r");
  L.put(127, 12, "d"); L.put(133, 12, "d"); L.put(143, 12, "f");
  levels.push({ name: "Mucky Marsh", theme: "swamp", world: 2, hat: "party", rows: L.rows() });
}

// ---------- Level 6: Vine Hollow (cave — vines, cracked floor, armored debut) ----------
{
  const L = makeLevel(150);
  L.ground(13, []);
  L.ceiling(2);
  L.fill(22, 11, 23, 12, "B");                // jump or smash
  L.crackedBridge(36, 41);                    // T-rex crashes into the mud, little ones cross
  // the vine wall: rock mass, small-only crawl in at the bottom, vine shaft up, walk off the top
  L.fill(55, 4, 64, 12, "M");
  L.fill(55, 12, 58, 12, ".");                // crawlspace (1 tile tall)
  L.fill(59, 4, 59, 12, "|");                 // vine shaft, pokes out of the opening on the wall top
  L.put(59, 10, "v"); L.put(59, 7, "v");      // eggs ON the vine (v = vine + egg) — a normal compy who falls in can jump for one, shrink, climb out
  [56, 57].forEach(x => L.put(x, 12, "e"));   // refills in the crawlspace
  [61, 63].forEach(x => L.put(x, 3, "e"));    // and on the wall top
  // stairs down the far side (2-tile steps)
  L.fill(65, 6, 66, 12, "M");
  L.fill(67, 8, 68, 12, "M");
  L.fill(69, 10, 70, 12, "M");
  // cracked floor over a secret chamber holding the golden egg
  L.fill(96, 13, 103, 13, "c");
  L.fill(96, 14, 103, 15, ".");
  L.put(99, 15, "E");
  L.marsh(126, 129);

  L.put(3, 12, "P");
  [8, 10, 12].forEach(x => L.put(x, 12, "e"));
  L.put(17, 12, "w");
  [26, 28].forEach(x => L.put(x, 12, "e"));
  L.put(31, 12, "a");                         // armored debut
  [44, 46].forEach(x => L.put(x, 12, "e"));
  L.put(50, 12, "w");
  [52, 53].forEach(x => L.put(x, 12, "e"));
  L.put(74, 12, "C");
  [76, 78].forEach(x => L.put(x, 12, "e"));
  L.put(82, 12, "w");
  L.put(90, 12, "s");
  L.put(108, 12, "w");
  [110, 112].forEach(x => L.put(x, 12, "e"));
  L.put(115, 12, "a");
  L.put(121, 12, "n");
  [123, 124].forEach(x => L.put(x, 12, "e"));
  L.put(134, 12, "s");
  L.put(138, 12, "h");
  L.put(141, 12, "w");
  L.put(146, 12, "F");
  // decor
  [6, 20, 33, 47, 78, 88, 105, 120, 137, 144].forEach(x => L.put(x, 2, "y"));
  [14, 45, 86, 118, 143].forEach(x => L.put(x, 12, "m"));
  L.put(35, 12, "r"); L.put(93, 12, "r"); L.put(131, 12, "d");
  levels.push({ name: "Vine Hollow", theme: "cave", world: 2, hat: "miner", rows: L.rows() });
}

// ---------- Level 7: Deep Dark (cave — everything at once) ----------
{
  const L = makeLevel(170);
  L.ground(13, []);
  L.ceiling(2);
  L.marsh(30, 37);
  L.fill(42, 11, 52, 12, "#");                // shelf, shooter on top
  // vine up to a high platform route with the golden egg
  L.fill(58, 7, 70, 7, "-");
  L.fill(57, 7, 57, 12, "|");                 // vine hangs beside the platform's left end
  L.put(57, 9, "v");
  [60, 62, 64].forEach(x => L.put(x, 6, "e"));
  L.put(67, 6, "n");
  L.put(70, 6, "E");
  L.crackedBridge(90, 95);
  L.fill(100, 8, 101, 12, "B");               // 5-high crate wall
  L.fill(118, 11, 127, 12, "#");              // mound with a crawlspace
  L.fill(118, 12, 127, 12, ".");
  [120, 122, 124].forEach(x => L.put(x, 12, "e"));
  L.marsh(144, 151);

  L.put(3, 12, "P");
  [8, 10, 12].forEach(x => L.put(x, 12, "e"));
  L.put(16, 12, "w");
  [20, 22].forEach(x => L.put(x, 12, "e"));
  L.put(25, 12, "a");
  [27, 28].forEach(x => L.put(x, 12, "e"));
  L.put(47, 10, "s");
  [54, 55].forEach(x => L.put(x, 12, "e"));
  L.put(74, 12, "C");
  L.put(78, 12, "w");
  L.put(84, 12, "w");
  [96, 98].forEach(x => L.put(x, 12, "e"));
  L.put(106, 12, "s");
  [108, 110].forEach(x => L.put(x, 12, "e"));
  L.put(113, 12, "a");
  L.put(123, 10, "a");
  L.put(134, 12, "n");
  L.put(140, 12, "w");
  [146, 148, 150].forEach(x => L.put(x, 11, "e"));
  L.put(154, 12, "h");
  L.put(158, 12, "s");
  L.put(162, 12, "w");
  L.put(165, 12, "F");
  // decor
  [7, 19, 40, 55, 76, 87, 104, 116, 132, 142, 156].forEach(x => L.put(x, 2, "y"));
  [14, 39, 81, 103, 138, 160].forEach(x => L.put(x, 12, "m"));
  L.put(29, 12, "d"); L.put(38, 12, "d"); L.put(143, 12, "d"); L.put(152, 12, "d");
  levels.push({ name: "Deep Dark", theme: "cave", world: 2, hat: "crown", rows: L.rows() });
}

// ---------- Level 8: Jeep Jam (boss arena) ----------
{
  const L = makeLevel(52);
  L.ground(13, []);
  L.fill(0, 4, 1, 12, "M");
  L.fill(50, 4, 51, 12, "M");
  L.put(5, 12, "P");
  L.put(36, 12, "J");
  [12, 20, 28, 40].forEach(x => L.put(x, 12, "e"));
  L.put(16, 12, "h");
  L.put(32, 12, "h");
  L.put(46, 12, "F");
  L.put(9, 12, "d"); L.put(44, 12, "d"); L.put(24, 12, "r");
  levels.push({
    name: "Jeep Jam!", theme: "bog", world: 2, boss: true, bossName: "SWAMP JEEP", hat: "racer",
    intro: ["SWAMP JEEP!", "Grow HUGE and bump it to flip it...", "then stomp its belly!"],
    eggRespawn: 9,
    rows: L.rows(),
  });
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
  if (lv.world === 2 && count("E") !== 1 && !lv.boss) throw new Error(lv.name + ": needs one golden egg");
}

const out = { version: "2-20260903", levels };
const json = JSON.stringify(out, null, 1);
if (typeof process === "undefined" && typeof print === "function") print(json);   // jsc: stdout → levels.json
else if (typeof require === "function") {
  const fs = require("node:fs"), path = require("node:path");
  fs.writeFileSync(path.join(__dirname, "..", "levels.json"), json);
  console.log("wrote levels.json:", levels.map(l => `${l.name} ${l.rows[0].length}x${H}`).join(" | "));
}
