// Flockstop random board generator + accept filter. Node tools only (the page never generates boards).
// A day config (tools/bake-config.json) looks like:
//   {size, white, black, rocks, mud, pond, penEdge, par:[lo,hi], minDeadEdges, needStopper, noPenFirst, cap}
// Counts may be a number or an inclusive [lo,hi] range. penEdge = chance a pen sits on the outer edge, opening inward.
"use strict";
const R = require("../src/rules.js");
const Solver = require("../src/solver.js");

// Deterministic PRNG (mulberry32), same as DeJam: a fixed seed bakes the same levels every time.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function count(rng, v) { return Array.isArray(v) ? randInt(rng, v[0], v[1]) : (v | 0); }

// One random layout, or null when the dice paint it into a corner (the caller just rolls again).
function generate(cfg, rng) {
  const w = cfg.w || cfg.size, h = cfg.h || cfg.size, g = new Array(w * h).fill(".");
  const free = () => { for (let tries = 0; tries < 200; tries++) { const c = randInt(rng, 0, w * h - 1); if (g[c] === ".") return c; } return -1; };
  const pens = [], approach = new Set();
  const nw = count(rng, cfg.white), nb = count(rng, cfg.black || 0);
  for (let r = count(rng, cfg.rocks || 0); r > 0; r--) { const c = free(); if (c < 0) return null; g[c] = "R"; }
  const cols = []; for (let i = 0; i < nw; i++) cols.push("w"); for (let i = 0; i < nb; i++) cols.push("b");
  for (const col of cols) {
    let placed = false;
    for (let tries = 0; tries < 200 && !placed; tries++) {
      let x, y, o;
      if (rng() < (cfg.penEdge == null ? 0.5 : cfg.penEdge)) { // on the fence line, opening inward
        o = randInt(rng, 0, 3);
        if (o === 0) { y = h - 1; x = randInt(rng, 0, w - 1); } else if (o === 2) { y = 0; x = randInt(rng, 0, w - 1); }
        else if (o === 1) { x = 0; y = randInt(rng, 0, h - 1); } else { x = w - 1; y = randInt(rng, 0, h - 1); }
      } else { x = randInt(rng, 0, w - 1); y = randInt(rng, 0, h - 1); o = randInt(rng, 0, 3); }
      const ax = x + R.DX[o], ay = y + R.DY[o], c = y * w + x, a = ay * w + ax;
      if (g[c] !== "." || ax < 0 || ay < 0 || ax >= w || ay >= h || g[a] !== "." || approach.has(c)) continue;
      g[c] = "P"; approach.add(a); pens.push({ x, y, open: R.DIRS[o], c: col }); placed = true;
    }
    if (!placed) return null;
  }
  for (let r = count(rng, cfg.mud || 0); r > 0; r--) { const c = free(); if (c < 0) return null; g[c] = "M"; }
  // A pond on a pen's doorstep would lock that pen for good; keep them apart.
  for (let r = count(rng, cfg.pond || 0); r > 0; r--) {
    let c = -1; for (let tries = 0; tries < 50 && c < 0; tries++) { c = free(); if (approach.has(c)) c = -1; }
    if (c < 0) return null; g[c] = "~";
  }
  for (const col of cols) {
    let c = -1;
    for (let tries = 0; tries < 200 && c < 0; tries++) { const k = randInt(rng, 0, w * h - 1); if (g[k] === "." || g[k] === "M") c = k; }
    if (c < 0) return null;
    g[c] = g[c] === "M" ? col.toUpperCase() : col;
  }
  const rows = []; for (let y = 0; y < h; y++) rows.push(g.slice(y * w, y * w + w).join(""));
  pens.sort((a, b) => a.y - b.y || a.x - b.x);
  return { w, h, rows, pens };
}

// Why a solved board fails a day's accept criteria ("" = accepted). Checked in this order, so the
// report can say which rule rejects most.
function rejectReason(res, cfg) {
  if (!res.solved) return res.capped ? "capped" : "unsolvable";
  if (res.par < cfg.par[0]) return "par-low";
  if (res.par > cfg.par[1]) return "par-high";
  if (res.deadEdges < (cfg.minDeadEdges || 0)) return "few-dead-ends";
  if (cfg.needStopper && !res.needsStopper) return "no-stopper";
  if (cfg.noPenFirst && res.penOnFirst) return "pen-on-swipe-1";
  return "";
}

// Roll layouts until one passes (or tries run out). Returns {board, res, tries} or {board:null, tries, best}.
// best = the closest below-band board seen, for the bake's logged fallback.
function find(cfg, rng, maxTries) {
  let best = null;
  for (let t = 1; t <= maxTries; t++) {
    const b = generate(cfg, rng);
    if (!b) continue;
    const res = Solver.solve(b, { cap: cfg.cap });
    const why = rejectReason(res, cfg);
    if (!why) return { board: b, res, tries: t };
    if (res.solved && res.par <= cfg.par[1] && (!best || res.par > best.res.par)) best = { board: b, res, why };
  }
  return { board: null, tries: maxTries, best };
}

module.exports = { mulberry32, randInt, generate, rejectReason, find };
