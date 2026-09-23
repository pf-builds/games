// Walkway graph for visitor/staff routing. Built from data/parcels.json walkways (axis-aligned centre-line segments
// with a width). Segments are split at every crossing and T-junction into edges between shared nodes; routes are
// shortest paths (Dijkstra) from the nearest point on the graph to the nearest point on the graph at the goal.
// All coordinates are world units. Nothing here allocates per tick: routes are planned only at state changes.

import { tileKey, outlineEdges } from '../tiles.js';

export const nodes = [];   // { x, y }
export const edges = [];   // { a, b, hw, vertical, len, x0, y0, x1, y1 }
const adj = [];            // adj[node] = [edge index...]
const EPS = 1e-6;
let walkable = new Set();  // tile keys that visitors can stand on (walkway + plaza tiles), from the park tile index
let pavingHw = new Map();  // tile key -> half paving width of the widest segment through that tile

function key(x, y) { return `${Math.round(x * 1000)},${Math.round(y * 1000)}`; }

export function buildGraph(segments, tileIndex = null) {
  nodes.length = 0; edges.length = 0; adj.length = 0;
  walkable = tileIndex ? tileIndex.walkable : new Set();
  pavingHw = new Map();
  for (const s of segments) {
    const [xa, ya] = s.from, [xb, yb] = s.to;
    const vertical = Math.abs(xa - xb) < EPS;
    for (let t = Math.min(vertical ? ya : xa, vertical ? yb : xb); t <= Math.max(vertical ? ya : xa, vertical ? yb : xb) + EPS; t += 1) {
      const k = vertical ? tileKey(Math.floor(xa), Math.floor(t)) : tileKey(Math.floor(t), Math.floor(ya));
      pavingHw.set(k, Math.max(pavingHw.get(k) || 0, s.w / 2));
    }
  }
  const nodeIx = new Map();
  const node = (x, y) => {
    const k = key(x, y);
    if (nodeIx.has(k)) return nodeIx.get(k);
    nodes.push({ x, y }); adj.push([]);
    nodeIx.set(k, nodes.length - 1);
    return nodes.length - 1;
  };
  const segs = segments.map(s => {
    const [xa, ya] = s.from, [xb, yb] = s.to;
    const vertical = Math.abs(xa - xb) < EPS;
    return { vertical, hw: s.w / 2, x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: Math.min(ya, yb), y1: Math.max(ya, yb) };
  });
  for (const s of segs) {
    const pts = [];
    const push = (x, y) => { if (!pts.some(p => Math.abs(p.x - x) < EPS && Math.abs(p.y - y) < EPS)) pts.push({ x, y }); };
    push(s.x0, s.y0); push(s.x1, s.y1);
    for (const o of segs) {
      if (o === s) continue;
      if (s.vertical && !o.vertical) { if (o.x0 - EPS <= s.x0 && s.x0 <= o.x1 + EPS && s.y0 - EPS <= o.y0 && o.y0 <= s.y1 + EPS) push(s.x0, o.y0); }
      else if (!s.vertical && o.vertical) { if (s.x0 - EPS <= o.x0 && o.x0 <= s.x1 + EPS && o.y0 - EPS <= s.y0 && s.y0 <= o.y1 + EPS) push(o.x0, s.y0); }
      else if (s.vertical && o.vertical && Math.abs(s.x0 - o.x0) < EPS) { for (const y of [o.y0, o.y1]) if (y > s.y0 + EPS && y < s.y1 - EPS) push(s.x0, y); }
      else if (!s.vertical && !o.vertical && Math.abs(s.y0 - o.y0) < EPS) { for (const x of [o.x0, o.x1]) if (x > s.x0 + EPS && x < s.x1 - EPS) push(x, s.y0); }
    }
    pts.sort((p, q) => s.vertical ? p.y - q.y : p.x - q.x);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = node(pts[i].x, pts[i].y), b = node(pts[i + 1].x, pts[i + 1].y);
      if (a === b) continue;
      const e = { a, b, hw: s.hw, vertical: s.vertical, len: Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y), x0: pts[i].x, y0: pts[i].y, x1: pts[i + 1].x, y1: pts[i + 1].y };
      edges.push(e);
      adj[a].push(edges.length - 1); adj[b].push(edges.length - 1);
    }
  }
}

// Nearest point on the graph to (x,y). Writes { edge, t, x, y, d } into out.
export function nearestOnGraph(x, y, out) {
  out.edge = -1; out.d = Infinity;
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const dx = e.x1 - e.x0, dy = e.y1 - e.y0;
    let t = ((x - e.x0) * dx + (y - e.y0) * dy) / (e.len * e.len);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = e.x0 + dx * t, py = e.y0 + dy * t;
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < out.d) { out.d = d; out.edge = i; out.t = t; out.x = px; out.y = py; }
  }
  out.d = Math.sqrt(out.d);
  return out;
}

// Viewing spots for an axis-aligned rect {x0,y0,x1,y1}: one per walkway edge that runs alongside it (within `tol`
// of a side), each with the point on the edge nearest the rect centre, unit vectors along the edge and toward the
// rect, and the spread available along that side. Falls back to the single nearest edge when nothing is adjacent.
export function spotsForRect(r, tol = 0.12) {
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const out = [];
  let best = null, bd = Infinity;
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const dx = e.x1 - e.x0, dy = e.y1 - e.y0;
    const qx = Math.max(r.x0, Math.min(r.x1, e.vertical ? e.x0 : cx)), qy = Math.max(r.y0, Math.min(r.y1, e.vertical ? cy : e.y0));
    let t = ((qx - e.x0) * dx + (qy - e.y0) * dy) / (e.len * e.len);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = e.x0 + dx * t, py = e.y0 + dy * t;
    const gx = Math.max(r.x0 - px, 0, px - r.x1), gy = Math.max(r.y0 - py, 0, py - r.y1);
    const gap = Math.hypot(gx, gy) - e.hw;                     // clear distance between the walkway edge and the rect
    // portion of the edge that runs alongside the rect
    const lo = e.vertical ? Math.max(e.y0, r.y0) : Math.max(e.x0, r.x0), hi = e.vertical ? Math.min(e.y1, r.y1) : Math.min(e.x1, r.x1);
    const s = spot(e, i, px, py, cx, cy, lo, hi);
    if (gap <= tol && hi - lo > 0.2) out.push(s);
    const d = gap + (Math.abs(px - cx) + Math.abs(py - cy)) * 0.001;
    if (d < bd) { bd = d; best = s; }
  }
  if (!out.length && best) out.push(best);
  return out;
}
function spot(e, i, px, py, cx, cy, lo, hi) {
  const s = { edge: i, hw: e.hw, x: px, y: py, ax: e.vertical ? 0 : 1, ay: e.vertical ? 1 : 0, tx: 0, ty: 0, spread: 0.1 };
  if (e.vertical) { s.tx = cx > px ? 1 : -1; s.y = Math.max(lo, Math.min(hi, py)); s.spread = Math.max(0.1, Math.min(s.y - lo, hi - s.y) - 0.05); }
  else { s.ty = cy > py ? 1 : -1; s.x = Math.max(lo, Math.min(hi, px)); s.spread = Math.max(0.1, Math.min(s.x - lo, hi - s.x) - 0.05); }
  return s;
}
export function spotForRect(r, out = {}) { return Object.assign(out, spotsForRect(r)[0]); }

// Viewing spots for a tile set (M2.6): one per outline edge whose neighbouring tile is walkable (walkway or plaza).
// The anchor is the centre of that walkway tile; `toward` points back at the parcel so dwell points land on the
// paving right beside the fence; `along` runs the length of the edge. Falls back to spotsForRect(bbox) when a
// shape has no walkable neighbour (the validator flags that case, so it should not happen with shipped data).
export function spotsForTiles(tiles, tol = 0.25) {
  const out = [];
  // Two viewing points per facing edge rather than one: a plus- or L-shaped pen with only a couple of edges on a
  // path used to gather its whole (highest-weight) crowd onto one or two dots.
  for (const e of outlineEdges(tiles)) {
    const k = tileKey(e.nx, e.ny);
    if (!walkable.has(k)) continue;
    const hw = pavingHw.get(k) || 0.25;
    const vertical = e.side === 'e' || e.side === 'w';
    const ax = vertical ? 0 : 1, ay = vertical ? 1 : 0;
    for (const d of [-0.22, 0.22]) {
      out.push({ edge: -1, hw, x: e.nx + 0.5 + ax * d, y: e.ny + 0.5 + ay * d, ax, ay, tx: e.side === 'e' ? -1 : e.side === 'w' ? 1 : 0, ty: e.side === 's' ? -1 : e.side === 'n' ? 1 : 0, spread: 0.18 });
    }
  }
  if (out.length) return out;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of tiles) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  return spotsForRect({ x0, y0, x1, y1 }, tol);
}
export const isWalkableTile = (x, y) => walkable.has(tileKey(Math.floor(x), Math.floor(y)));

// ---- shortest path ----
const dist = [], prev = [], prevEdge = [], done = [], cost = [];
const startP = { edge: -1, t: 0, x: 0, y: 0, d: 0 }, endP = { edge: -1, t: 0, x: 0, y: 0, d: 0 };

// Route from (x0,y0) to (x1,y1). Calls step(x, y, edge) for each waypoint in order: the entry point on the graph,
// every node along the path, and the exit point. `edge` is the edge being walked to reach that point (-1 for the first).
// `jitter` (phase 4 B1, balance.living.route_jitter) scales each edge's cost by a fresh random 1..1+jitter for this
// route, so walkers spread over near-equal alternatives instead of all taking the one the tie-break favours.
export function route(x0, y0, x1, y1, step, jitter = 0) {
  nearestOnGraph(x0, y0, startP);
  nearestOnGraph(x1, y1, endP);
  if (startP.edge < 0) { step(x1, y1, -1); return; }
  step(startP.x, startP.y, -1);
  if (startP.edge === endP.edge) { step(endP.x, endP.y, endP.edge); return; }
  const n = nodes.length;
  for (let i = 0; i < n; i++) { dist[i] = Infinity; prev[i] = -1; prevEdge[i] = -1; done[i] = false; }
  for (let i = 0; i < edges.length; i++) cost[i] = 1 + jitter * Math.random();
  const se = edges[startP.edge], cs = cost[startP.edge];
  dist[se.a] = Math.hypot(startP.x - nodes[se.a].x, startP.y - nodes[se.a].y) * cs;
  dist[se.b] = Math.hypot(startP.x - nodes[se.b].x, startP.y - nodes[se.b].y) * cs;
  const ee = edges[endP.edge], ce = cost[endP.edge];
  const goalA = ee.a, goalB = ee.b;
  const tailA = Math.hypot(endP.x - nodes[goalA].x, endP.y - nodes[goalA].y) * ce, tailB = Math.hypot(endP.x - nodes[goalB].x, endP.y - nodes[goalB].y) * ce;
  let goal = -1;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = true;
    if ((u === goalA || u === goalB)) {
      // stop once the cheaper of the two goal endpoints (including its tail to the exit point) is settled
      const total = dist[u] + (u === goalA ? tailA : tailB);
      const other = u === goalA ? goalB : goalA;
      const otherTotal = dist[other] + (other === goalA ? tailA : tailB);
      if (done[other] || total <= otherTotal) { goal = total <= otherTotal ? u : other; break; }
    }
    for (const ei of adj[u]) {
      const e = edges[ei];
      const v = e.a === u ? e.b : e.a;
      const nd = dist[u] + e.len * cost[ei];
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; prevEdge[v] = ei; }
    }
  }
  if (goal < 0) { step(endP.x, endP.y, endP.edge); return; }
  const path = [];
  for (let v = goal; v >= 0; v = prev[v]) path.push(v);
  path.reverse();
  for (let i = 0; i < path.length; i++) {
    const v = path[i];
    step(nodes[v].x, nodes[v].y, i === 0 ? startP.edge : prevEdge[v]);
  }
  step(endP.x, endP.y, endP.edge);
}

export function randomPointOnEdge(out) {
  const e = edges[Math.floor(Math.random() * edges.length)];
  const t = Math.random();
  const lane = (Math.random() * 2 - 1) * Math.max(0, e.hw - 0.06);
  out.x = e.x0 + (e.x1 - e.x0) * t + (e.vertical ? lane : 0);
  out.y = e.y0 + (e.y1 - e.y0) * t + (e.vertical ? 0 : lane);
  return out;
}
export function randomNode() { return nodes[Math.floor(Math.random() * nodes.length)]; }
