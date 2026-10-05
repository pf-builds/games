// Sapper's Path palette check (v4 M1, the look pass): CIEDE2000 between every pair of materials that stand together in a
// level of levels/levels.json, the smallest pair per level, and the lightness gap (CIELAB L*) behind the grayscale
// reading. Also the gap from each material to the muted ground it sits on. Nothing is written.
//   ~/.local/opt/node/bin/node tools/palette.js                    the palette in config.json (v3.mats[].c)
//   ~/.local/opt/node/bin/node tools/palette.js --try '["#..", ...]'  a candidate: 14 hex colours, material 1..14
//   ~/.local/opt/node/bin/node tools/palette.js --opt [rounds]     search for a palette (hue families and lightness bands
//                                                                  from PLAN below); prints the best one found
//   --md '["#..", ...]'  a markdown before/after report: the argument is the BEFORE palette, config.json is AFTER
//   --levels FILE        read the levels from FILE instead of levels/levels.json (v4 M3: a trial bake's output)
//   --scenes             v4.1 fix: the castle pictures' scenes (tools/bake-config.json picture.scenes): for each scene and
//                        each era it serves, every pair of roles that can stand together in that era's pictures (must and
//                        opt, less the scene's drop, with the black outline and the gilt keys), in the scene's colours,
//                        must be picture.minDE apart in CIEDE2000 and picture.fadeDE with one faded (tools/pic.js), and
//                        no two roles may share a name; exits 1 when one isn't
// Deterministic (seeded). Levels are only read. v4 M3: require()d, it exports the colour maths (lab, de00) and minPair
// (the smallest pair among a level's materials) and reads no levels.
"use strict";
const V3 = require("../config.json").v3;
const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : null; };

// ---- colour maths ---------------------------------------------------------------------------------------------------
const hexRgb = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const gam = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
function lab(hex) { // sRGB (D65) -> CIELAB
  const [r, g, b] = hexRgb(hex).map(lin), X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
// CIEDE2000 (Sharma, Wu and Dalal 2005), kL = kC = kH = 1.
function de00(p, q) {
  const [L1, a1, b1] = p, [L2, a2, b2] = q, rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a, b) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360), h1p = h(a1p, b1), h2p = h(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad), Lmp = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hmp = h1p + h2p; if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hmp += h1p + h2p < 360 ? 360 : -360; hmp /= 2; }
  const T = 1 - 0.17 * Math.cos((hmp - 30) * rad) + 0.24 * Math.cos(2 * hmp * rad) + 0.32 * Math.cos((3 * hmp + 6) * rad) - 0.2 * Math.cos((4 * hmp - 63) * rad);
  const dTh = 30 * Math.exp(-Math.pow((hmp - 275) / 25, 2)), RC = 2 * Math.sqrt(Math.pow(Cmp, 7) / (Math.pow(Cmp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lmp - 50, 2)) / Math.sqrt(20 + Math.pow(Lmp - 50, 2)), SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T, RT = -Math.sin(2 * dTh * rad) * RC;
  return Math.sqrt(Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2) + RT * (dCp / SC) * (dHp / SH));
}
// OKLCH -> hex, or null when out of the sRGB gamut (the search stays inside it).
function okHex(L, C, hDeg) {
  const a = C * Math.cos((hDeg * Math.PI) / 180), b = C * Math.sin((hDeg * Math.PI) / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  if (rgb.some((v) => v < -0.0005 || v > 1.0005)) return null;
  return "#" + rgb.map((v) => gam(v).toString(16).padStart(2, "0")).join("");
}

// The smallest CIEDE2000 between any two of the materials a (ids 1-14) in palette pal (default config.json): {min, at}.
function minPair(mats, pal) {
  const P = pal || V3.mats.map((m) => (m ? m.c : null)); let min = 1e9, at = null;
  for (let i = 0; i < mats.length; i++) for (let j = i + 1; j < mats.length; j++) { const d = de00(lab(P[mats[i]]), lab(P[mats[j]])); if (d < min) { min = d; at = [mats[i], mats[j]]; } }
  return { min: at ? min : null, at };
}
module.exports = { lab, de00, minPair }; // (set first: --scenes requires tools/pic.js, which requires this file)
if (require.main !== module) return;

if (process.argv.includes("--scenes")) {
  const PIC = require("./pic.js"), Q = require("./bake-config.json").picture, gilt = V3.mats[require("../src/engine.js").GILT].c; let bad = 0;
  for (const [k, S] of Object.entries(Q.scenes)) for (const e of S.eras) {
    const roles = ["ink", "gilt"].concat(Q.eras[e].must, Q.eras[e].opt, Q.eras[e].extra || []).filter((x, i, a) => a.indexOf(x) === i && (S.drop || []).indexOf(x) < 0);
    const col = (x) => (x === "ink" ? Q.ink : x === "gilt" ? gilt : (S.c && S.c[x]) || Q.roles[x].c[0]), nm = (x) => (x === "gilt" ? "gilt" : (S.n && S.n[x]) || Q.roles[x].name);
    let w = null; for (let a = 0; a < roles.length; a++) for (let b = a + 1; b < roles.length; b++) { const d = PIC.de(col(roles[a]), col(roles[b])), f = PIC.fadeGap(col(roles[a]), col(roles[b])), s = Math.min(d - Q.minDE, f - Q.fadeDE); if (!w || s < w.s) w = { s, d, f, p: roles[a] + "/" + roles[b] }; }
    const names = roles.map(nm), dup = names.filter((x, i) => names.indexOf(x) !== i), ok = w.s >= 0 && !dup.length; if (!ok) bad++;
    console.log((ok ? "ok  " : "BAD ") + k + " era " + e + ": " + roles.length + " roles, closest pair " + w.p + " ΔE00 " + w.d.toFixed(1) + " (faded " + w.f.toFixed(1) + ")" + (dup.length ? ", names shared: " + dup.join(", ") : ""));
  }
  process.exitCode = bad ? 1 : 0; return;
}

// ---- which materials stand together ---------------------------------------------------------------------------------
const LV = require(arg("levels") ? require("path").resolve(arg("levels")) : "../levels/levels.json").levels;
const SETS = LV.map((L) => { const s = new Set(); for (const r of L.grid) for (const ch of r) { const k = ch.charCodeAt(0) - 96; if (k >= 1 && k <= 14) s.add(k); } return { n: L.n, id: L.id, mats: [...s].sort((a, b) => a - b) }; });
const PAIRS = new Map(); // "a-b" -> levels
for (const S of SETS) for (let i = 0; i < S.mats.length; i++) for (let j = i + 1; j < S.mats.length; j++) { const k = S.mats[i] + "-" + S.mats[j]; if (!PAIRS.has(k)) PAIRS.set(k, 0); PAIRS.set(k, PAIRS.get(k) + 1); }
const PAIRLIST = [...PAIRS.keys()].map((k) => k.split("-").map(Number));
const GROUND = Object.values(V3.ground);
const NAME = (m) => V3.mats[m].n;

function measure(pal) { // pal[1..14] hex
  const L = pal.map((h) => (h ? lab(h) : null)), D = {};
  for (const [a, b] of PAIRLIST) D[a + "-" + b] = de00(L[a], L[b]);
  const per = SETS.map((S) => { let min = 1e9, at = null, dLmin = 1e9, under10 = 0, pairs = 0;
    for (let i = 0; i < S.mats.length; i++) for (let j = i + 1; j < S.mats.length; j++) { const a = S.mats[i], b = S.mats[j], d = D[a + "-" + b], dl = Math.abs(L[a][0] - L[b][0]); pairs++; if (d < min) { min = d; at = [a, b]; } if (dl < dLmin) dLmin = dl; if (dl < 10) under10++; }
    return { n: S.n, id: S.id, k: S.mats.length, min, at, grayClose: under10, pairs }; });
  const ground = []; for (let m = 1; m <= 14; m++) ground.push(m === 10 ? 99 : Math.min(...GROUND.map((g) => de00(L[m], lab(g))))); // iron (gates) is barred, never plain
  let min = 1e9, at = null; for (const [a, b] of PAIRLIST) { const d = D[a + "-" + b]; if (d < min) { min = d; at = [a, b]; } }
  let gray = 0; for (const [a, b] of PAIRLIST) if (Math.abs(L[a][0] - L[b][0]) >= 10) gray++;
  return { D, per, min, at, ground, groundMin: Math.min(...ground), gray, pairs: PAIRLIST.length, L };
}
const fmt = (x) => x.toFixed(1);
const palOf = (list) => [null].concat(list);
const CUR = V3.mats.map((m) => (m ? m.c : null));

function print(pal, title) {
  const M = measure(pal);
  console.log(title);
  console.log("  materials: " + pal.slice(1).map((h, i) => (i + 1) + " " + h).join("  "));
  console.log("  every level: min pair " + fmt(M.min) + " (" + M.at.map(NAME).join(" / ") + "); ground gap min " + fmt(M.groundMin) + "; grayscale: " + M.gray + " of " + M.pairs + " pairs differ by L* 10+");
  const under = M.per.filter((p) => p.min < 20);
  console.log("  levels with a pair under 20: " + under.length + (under.length ? " (" + under.map((p) => p.n + ": " + fmt(p.min) + " " + p.at.map(NAME).join("/")).join(", ") + ")" : ""));
  const close = PAIRLIST.map(([a, b]) => [a, b, M.D[a + "-" + b]]).sort((x, y) => x[2] - y[2]).slice(0, 8);
  console.log("  closest pairs: " + close.map(([a, b, d]) => NAME(a) + "/" + NAME(b) + " " + fmt(d)).join(", "));
  return M;
}

// ---- search ---------------------------------------------------------------------------------------------------------
// Each material keeps its family: an OKLCH hue window, a lightness band and a chroma floor (bright and saturated, like
// Food Hunt), except the three neutrals (rubble grey, ashlar white, iron black). Gilt (the keys) stays a gold.
const PLAN = [null,
  { h: [48, 66], L: [0.7, 0.8], C: 0.15 },    // 1 Earth bank: orange
  { h: [18, 32], L: [0.56, 0.64], C: 0.18 },  // 2 Palisade: red
  { h: [95, 110], L: [0.88, 0.95], C: 0.15 }, // 3 Thatch: yellow
  { h: [340, 368], L: [0.62, 0.74], C: 0.17 }, // 4 Timber: pink
  { h: [0, 360], L: [0.55, 0.7], C: 0, Cmax: 0.03 },   // 5 Rubble stone: grey
  { h: [0, 360], L: [0.95, 0.995], C: 0, Cmax: 0.03 }, // 6 Ashlar: white
  { h: [255, 272], L: [0.5, 0.6], C: 0.17 },   // 7 Slate: blue
  { h: [290, 318], L: [0.5, 0.62], C: 0.17 },  // 8 Roof tile: purple
  { h: [118, 135], L: [0.8, 0.9], C: 0.17 },   // 9 Brick: lime
  { h: [0, 360], L: [0.16, 0.26], C: 0, Cmax: 0.03 },  // 10 Iron: black (gates; they always wear their bars)
  { h: [140, 158], L: [0.58, 0.68], C: 0.14 }, // 11 Hedge: green
  { h: [170, 195], L: [0.62, 0.75], C: 0.1 },  // 12 Warded stone: teal
  { h: [205, 235], L: [0.75, 0.88], C: 0.1 },  // 13 Crystal: sky
  { h: [72, 90], L: [0.6, 0.7], C: 0.12 },     // 14 Gilt: gold (keys)
];
function search(rounds) {
  let seed = 20260930; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const P = [null], KEEP = [null];
  // Start from the current palette's OKLCH, clamped into each plan.
  const toOk = (hex) => { const [r, g, b] = hexRgb(hex).map(lin), l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s; return [L, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360]; };
  for (let m = 1; m <= 14; m++) { const o = toOk(CUR[m]), p = PLAN[m]; let h = o[2]; if (p.h[1] > 360 && h < p.h[0]) h += 360; P.push([Math.max(p.L[0], Math.min(p.L[1], o[0])), o[1], Math.max(p.h[0], Math.min(p.h[1], h))]); KEEP.push(null); }
  const hexOf = (m, v) => { const p = PLAN[m]; if (v[0] < p.L[0] || v[0] > p.L[1] || v[2] < p.h[0] || v[2] > p.h[1]) return null; if (p.Cmax != null ? v[1] > p.Cmax || v[1] < 0 : v[1] < p.C) return null; return okHex(v[0], v[1], v[2] % 360); };
  // A valid start: shrink chroma until it fits the gamut.
  for (let m = 1; m <= 14; m++) { const p = PLAN[m]; if (p.Cmax != null) P[m][1] = Math.min(P[m][1], p.Cmax); for (let g = 0; g < 60 && !hexOf(m, P[m]); g++) P[m][1] = Math.max(p.C, P[m][1] * 0.95); if (!hexOf(m, P[m])) P[m] = [(p.L[0] + p.L[1]) / 2, p.Cmax != null ? 0 : p.C, (p.h[0] + p.h[1]) / 2]; }
  const score = (pal) => { const M = measure(pal); const ds = PAIRLIST.map(([a, b]) => M.D[a + "-" + b]).sort((x, y) => x - y); let soft = 0; for (let i = 0; i < 12; i++) soft += ds[i]; return M.min + soft / 120 + Math.min(0, M.groundMin - 22) * 0.5 + (M.gray / M.pairs) * 2; };
  const pal = () => { const out = [null]; for (let m = 1; m <= 14; m++) out.push(hexOf(m, P[m])); return out; };
  let best = pal(), bs = score(best), cur = bs, temp = 1.0;
  for (let r = 0; r < rounds; r++) {
    const m = 1 + ((rnd() * 14) | 0), old = P[m].slice(), k = (rnd() * 3) | 0, step = [0.03, 0.03, 6][k] * (0.3 + temp);
    P[m][k] += (rnd() - 0.5) * 2 * step;
    const hx = hexOf(m, P[m]); if (!hx) { P[m] = old; continue; }
    const cand = pal(), s = score(cand);
    if (s >= cur || rnd() < Math.exp((s - cur) / Math.max(0.01, temp * 0.5))) { cur = s; if (s > bs) { bs = s; best = cand; } } else P[m] = old;
    temp = Math.max(0.02, 1 - r / rounds);
  }
  return best;
}

if (process.argv.includes("--opt")) {
  const n = +arg("opt") || 60000;
  print(CUR, "Current (config.json)");
  const best = search(n);
  print(best, "Search best (" + n + " rounds)");
  console.log(JSON.stringify(best.slice(1)));
} else if (arg("md")) {
  const before = palOf(JSON.parse(arg("md"))), A = measure(before), B = measure(CUR);
  const out = [];
  out.push("| Level | Colours | Min ΔE00 before (pair) | Min ΔE00 after (pair) | Gray-close pairs before → after |", "|---|---|---|---|---|");
  for (let i = 0; i < A.per.length; i++) { const a = A.per[i], b = B.per[i]; out.push("| " + a.n + " | " + a.k + " | " + fmt(a.min) + " (" + a.at.map(NAME).join(" / ") + ") | " + fmt(b.min) + " (" + b.at.map(NAME).join(" / ") + ") | " + a.grayClose + " → " + b.grayClose + " of " + a.pairs + " |"); }
  console.log(JSON.stringify({ before: { min: A.min, at: A.at.map(NAME), ground: A.groundMin, gray: A.gray, under20: A.per.filter((p) => p.min < 20).length }, after: { min: B.min, at: B.at.map(NAME), ground: B.groundMin, gray: B.gray, under20: B.per.filter((p) => p.min < 20).length }, pairs: A.pairs }));
  console.log(out.join("\n"));
} else print(arg("try") ? palOf(JSON.parse(arg("try"))) : CUR, arg("try") ? "Candidate" : "Current (config.json)");
