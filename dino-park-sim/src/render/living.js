// Living Park renderer: 2.5D oblique scene of the whole park drawn from game state + agents.
// Placeholder art: flat-shaded shapes with outlines. Everything in world coords through projection.js.
// Ground (flat, z=0) is drawn first without sorting; everything with height goes through a painter's
// sort on depth() so sprites overlap walls and each other correctly.
// M2.6: parcels are tile sets (polyominoes). Ground and pen floors are filled from the parcel's outline loops and
// walls are emitted per OUTLINE EDGE only (never between two tiles of the same parcel), so an L, plus or Z fences
// correctly at every concave corner. Signs and pen labels sit on the label / front tile, never a bounding box.
// The five fixed facilities sit at their data positions and grow with their tier; walkways come from the same data
// the agents route on.
import { DATA, state, parcelList, parcelDef, parcelGeometry, biomeById, fenceByTier, facilityTier, facilityById, facilityTierDef, facilityNextTier, fmt$, onChange } from '../state.js';
import { BASE_W, BASE_H, L, project, unproject, depth, parcelAtWorld, facilityRect, facilityAtWorld } from './projection.js';
import * as AG from '../sim/agents.js';
import { parcelTooltip, shortShape } from './park.js';
import { parcelPrice } from '../economy.js';
import { showTip, hideTip } from '../ui/tooltips.js';

const FONT = '8px "Press Start 2P", monospace';
const FONT_S = '7px "Press Start 2P", monospace';
const FENCE_H = 0.34, HEDGE_H = 0.2, SEG = 0.25;
// How far inside its own outline a parcel's fence stands, in tiles. Two neighbours' fences end up 2 x this apart.
const WALL_INSET = 0.045;
const FACILITY_COLORS = { restrooms: ['#7fb8a8', '#5e9484', '#4a7a6c'], food_stand: ['#e0685a', '#b84c40', '#8f3a30'], gift_shop: ['#a97ad6', '#8258ad', '#654288'], office: ['#8a7d9c', '#6b5c8a', '#54486e'] };
const VISITOR_SHIRTS = ['#e05c5c', '#6fcf6a', '#5aa0e0', '#f2c94c', '#e08fd0', '#f0f0e8', '#ff9d4d', '#66d6c8'];
const CAR_COLORS = ['#d84a4a', '#3b6fd6', '#f2f2f2', '#2c2f36', '#6fcf6a', '#f2c94c', '#9b6fd6', '#c0c6d0'];
const STAFF_COLORS = { maintenance: '#f08a24', tour_guide: '#3fbf5f', security: '#3b5fd6', veterinary: '#f4f4f4', concessions: '#b56fd6', management: '#7d8494' };

// Draw-list entry kinds
const K_WALL = 1, K_FACILITY = 2, K_SIGN = 3, K_GATE = 4, K_OFFICE = 5, K_FOUNTAIN = 6, K_HEDGE = 7, K_BUSH = 8,
  K_STAKE = 9, K_BENCH = 14, K_LAMP = 15,
  K_VISITOR = 10, K_CAR = 11, K_DINO = 12, K_STAFF = 13;

let canvas, ctx, handlers = { onParcelClick: () => {}, onFacilityClick: () => {} };
let active = false, raf = 0, lastT = 0, acc = 0, watchdog = 0, lastFrameAt = 0;
let hover = null, hoverFacility = null;
const staticEntries = [];
let sceneSig = '';
const drawList = [];
const P = { x: 0, y: 0 }, Q = { x: 0, y: 0 }, R = { x: 0, y: 0 }, S = { x: 0, y: 0 };
const rect = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, roofs: 0, rows: 0 };
const hud = { v: -1, c: -1, a: -1, text: '' };
const stats = { stepMs: 0, renderMs: 0, sprites: 0, entries: 0 };
export const livingStats = () => stats;

export function initLiving(el, h) {
  canvas = el;
  ctx = canvas.getContext('2d');
  handlers = h;
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', () => { if (!active) return; hover = null; hoverFacility = null; hideTip(); });
  canvas.addEventListener('click', e => {
    if (!active) return;
    const id = parcelAt(e);
    if (id) { hover = null; hideTip(); handlers.onParcelClick(id); return; }
    const f = facilityAt(e);
    if (f) { hoverFacility = null; hideTip(); handlers.onFacilityClick(f); }
  });
  onChange(() => { if (sceneSignature() !== sceneSig) buildStatic(); });
  document.fonts?.load(FONT).catch(() => {});
  buildStatic();
}

export function startLiving() {
  if (active) return;
  active = true;
  if (sceneSignature() !== sceneSig) buildStatic();
  lastT = performance.now(); acc = 0; lastFrameAt = lastT;
  raf = requestAnimationFrame(frame);
  // rAF stalls in a hidden/background tab. The watchdog steps the scene (browsers throttle it to ~1Hz
  // when hidden, so it costs nothing) and hands back to rAF as soon as frames flow again.
  watchdog = setInterval(() => { if (active && performance.now() - lastFrameAt > 250) step(performance.now(), 1000); }, 100);
}
export function stopLiving() {
  active = false;
  hover = null; hoverFacility = null;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (watchdog) clearInterval(watchdog);
  watchdog = 0;
}
export const livingActive = () => active;

// ---- loop: fixed 20Hz agent tick, render every animation frame with interpolation ----
function frame(now) {
  if (!active) return;
  step(now, 120);
  raf = requestAnimationFrame(frame);
}
// maxDt caps catch-up after a stall: a frame hiccup skips at most ~2 ticks, the hidden-tab watchdog up to a second.
function step(now, maxDt) {
  const tickMs = 1000 / DATA.balance.living.tick_hz;
  acc += Math.min(now - lastT, maxDt);
  lastT = now; lastFrameAt = now;
  const t0 = performance.now();
  while (acc >= tickMs) { AG.tick(); acc -= tickMs; }
  const t1 = performance.now();
  render(acc / tickMs);
  stats.stepMs = performance.now() - t0; stats.renderMs = performance.now() - t1;
}

// ---- hit testing ----
function logicalPoint(e) {
  const r = canvas.getBoundingClientRect();
  P.x = (e.clientX - r.left) * (BASE_W / r.width); P.y = (e.clientY - r.top) * (BASE_H / r.height);
  return P;
}
function parcelAt(e) {
  const p = logicalPoint(e);
  unproject(p.x, p.y, 0, Q);
  let id = parcelAtWorld(Q.x, Q.y);
  if (id) return id;
  unproject(p.x, p.y, FENCE_H, Q); // walls sit above their floor
  id = parcelAtWorld(Q.x, Q.y);
  return id && state.parcels[id].enclosure ? id : null;
}
function facilityAt(e) {
  const p = logicalPoint(e);
  unproject(p.x, p.y, 0, Q);
  let id = facilityAtWorld(Q.x, Q.y, state.facilities);
  if (id) return id;
  unproject(p.x, p.y, 0.4, Q);
  return facilityAtWorld(Q.x, Q.y, state.facilities);
}
function onMove(e) {
  if (!active) return;
  hover = parcelAt(e);
  hoverFacility = hover ? null : facilityAt(e);
  if (hover) showTip(parcelTooltip(hover), e.clientX, e.clientY);
  else if (hoverFacility) showTip(facilityTooltip(hoverFacility), e.clientX, e.clientY);
  else hideTip();
}
export function facilityTooltip(id) {
  const f = facilityById(id), t = facilityTierDef(id), next = facilityNextTier(id);
  const eff = f.effect_key === 'parking_capacity' ? `+${t.effect_magnitude} visitors/day` : f.effect_key === 'concession_spend' ? `spend ×${t.effect_magnitude}` : f.effect_key === 'satisfaction' ? `satisfaction +${Math.round(t.effect_magnitude * 100)}%` : 'base';
  return `${f.name}: ${t.label} (tier ${t.tier}) · ${eff}${next ? ` · next: ${next.label} for ${fmt$(next.cost)}` : ' · top tier'}. Click to upgrade.`;
}

// ---- static scene (rebuilt only when the park's layout changes) ----
function sceneSignature() {
  let s = '';
  for (const p of parcelList()) s += p.owned ? (p.enclosure ? `e${p.enclosure.fence_tier}.${Math.floor(p.enclosure.condition / 10)}` : 'o') : 'u';
  for (const k in state.facilities) s += k[0] + state.facilities[k];
  return s;
}

function entry(kind, dep) {
  const e = { kind, depth: dep, id: null, x0: 0, y0: 0, x1: 0, y1: 0, tier: 0, cond: 100, seg: 0, text: '', ref: null };
  staticEntries.push(e);
  return e;
}

function buildStatic() {
  sceneSig = sceneSignature();
  staticEntries.length = 0;
  const { PARK_W, PARK_H, GATE, CENTER } = L;
  // perimeter hedge with a gap at the gate
  for (let x = 0; x < PARK_W - 1e-6; x += 1) { hedge(x, 0, Math.min(x + 1, PARK_W), 0); }
  for (let x = 0; x < PARK_W - 1e-6; x += 1) {
    const a = x, b = Math.min(x + 1, PARK_W);
    if (b <= GATE.x - GATE.halfGap || a >= GATE.x + GATE.halfGap) hedge(a, PARK_H, b, PARK_H);
    else { if (a < GATE.x - GATE.halfGap) hedge(a, PARK_H, GATE.x - GATE.halfGap, PARK_H); if (b > GATE.x + GATE.halfGap) hedge(GATE.x + GATE.halfGap, PARK_H, b, PARK_H); }
  }
  for (let y = 0; y < PARK_H - 1e-6; y += 1) { hedge(0, y, 0, Math.min(y + 1, PARK_H)); hedge(PARK_W, y, PARK_W, Math.min(y + 1, PARK_H)); }
  entry(K_GATE, depth(GATE.x, PARK_H + 0.01));
  entry(K_OFFICE, depth(L.OFFICE.x0, L.OFFICE.y1));
  entry(K_FOUNTAIN, depth(CENTER.x, CENTER.y + 0.3));
  // plaza furniture: planters on the diagonals, benches facing the fountain, two lamps. The centrepiece is the
  // middle of the hero screen, so it carries real detail rather than one circle on a blank slab.
  for (const [dx, dy] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) { const e = entry(K_BUSH, depth(CENTER.x + dx, CENTER.y + dy)); e.x0 = CENTER.x + dx; e.y0 = CENTER.y + dy; }
  for (const [dx, dy] of [[0, -0.9], [0, 0.9], [-0.9, 0], [0.9, 0]]) { const e = entry(K_BENCH, depth(CENTER.x + dx, CENTER.y + dy)); e.x0 = CENTER.x + dx; e.y0 = CENTER.y + dy; e.tier = dx === 0 ? 0 : 1; }
  for (const [dx, dy] of [[-1.15, -1.15], [1.15, 1.15]]) { const e = entry(K_LAMP, depth(CENTER.x + dx, CENTER.y + dy)); e.x0 = CENTER.x + dx; e.y0 = CENTER.y + dy; }
  for (const f of DATA.facilities.facilities) {
    if (f.id === 'office' || f.id === 'parking_lot') continue;
    facilityRect(f.id, facilityTier(f.id), rect);
    const e = entry(K_FACILITY, depth(rect.x0, rect.y1 - 0.02)); e.id = f.id; e.tier = facilityTier(f.id);
  }
  // Parcels: signs sit on the label tile; walls follow the OUTLINE EDGES of the tile set only, so two tiles of the
  // same parcel never get a wall between them and an L / plus / Z is fenced correctly at every concave corner.
  for (const p of parcelList()) {
    const g = parcelGeometry(p.id);
    // Sign post stands on the PATH beside the parcel (state.js parcelGeometry().sign), so its board can never be
    // lifted onto the pen behind it.
    const sx = g.sign.x, sy = g.sign.y;
    if (!p.owned) {
      const e = entry(K_SIGN, depth(sx, sy)); e.id = p.id; e.x0 = sx; e.y0 = sy; e.text = 'FOR SALE'; e.tier = 0;
      // survey stakes and rope around the whole outline: unbought land is staked out, not blank lawn
      for (const ed of g.edges) { const st = entry(K_STAKE, depth(ed.x0, Math.max(ed.y0, ed.y1))); st.id = p.id; st.x0 = ed.x0; st.y0 = ed.y0; st.x1 = ed.x1; st.y1 = ed.y1; }
      continue;
    }
    if (!p.enclosure) {
      const e = entry(K_SIGN, depth(sx, sy)); e.id = p.id; e.x0 = sx; e.y0 = sy; e.text = 'READY'; e.tier = 1;
      for (const ed of g.edges) { const st = entry(K_STAKE, depth(ed.x0, Math.max(ed.y0, ed.y1))); st.id = p.id; st.x0 = ed.x0; st.y0 = ed.y0; st.x1 = ed.x1; st.y1 = ed.y1; st.tier = 1; }
      continue;
    }
    const enc = p.enclosure;
    let seg = 0;
    for (const ed of g.edges) {
      const horiz = ed.side === 'n' || ed.side === 's';
      const n = Math.max(1, Math.round(1 / SEG));
      // Each parcel's wall is pulled WALL_INSET inside its own outline (and stretched by the same amount along the
      // edge so corners still meet). Two parcels that share a boundary therefore draw two fences a few pixels apart,
      // each in its own tier's material, instead of one quad where whoever drew last won and a wood pen could be
      // shown wearing its neighbour's steel.
      const inx = ed.side === 'w' ? WALL_INSET : ed.side === 'e' ? -WALL_INSET : 0;
      const iny = ed.side === 'n' ? WALL_INSET : ed.side === 's' ? -WALL_INSET : 0;
      const ex = (ed.x1 - ed.x0) * WALL_INSET, ey = (ed.y1 - ed.y0) * WALL_INSET;
      const x0 = ed.x0 + inx - ex, y0 = ed.y0 + iny - ey, x1 = ed.x1 + inx + ex, y1 = ed.y1 + iny + ey;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0;
        const bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
        // A north edge draws behind everything standing in its own tile; south and side edges draw at their
        // lower end so a dinosaur further back is occluded and one further forward is not.
        const dep = horiz ? depth(ax, ay + (ed.side === 'n' ? 0.001 : 0)) : depth(ax, Math.max(ay, by));
        wall(p.id, ax, ay, bx, by, enc, seg++, dep);
      }
    }
  }
}
function hedge(x0, y0, x1, y1) { const e = entry(K_HEDGE, depth(x0, Math.max(y0, y1) + 0.002)); e.x0 = x0; e.y0 = y0; e.x1 = x1; e.y1 = y1; }
function wall(id, x0, y0, x1, y1, enc, seg, dep) {
  const e = entry(K_WALL, dep);
  e.id = id; e.x0 = x0; e.y0 = y0; e.x1 = x1; e.y1 = y1; e.tier = enc.fence_tier; e.cond = enc.condition; e.seg = seg;
}

// ---- frame ----
function render(alpha) {
  const k = canvas.width / BASE_W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.lineJoin = 'round';
  drawGround();
  // gather + sort
  drawList.length = 0;
  for (let i = 0; i < staticEntries.length; i++) drawList.push(staticEntries[i]);
  for (const d of AG.dinos) { d.rx = d.px + (d.x - d.px) * alpha; d.ry = d.py + (d.y - d.py) * alpha; d.depth = depth(d.rx, d.ry); d.kind = K_DINO; drawList.push(d); }
  for (const v of AG.visitors) { if (!v.active) continue; v.rx = v.px + (v.x - v.px) * alpha + v.lx; v.ry = v.py + (v.y - v.py) * alpha + v.ly; v.depth = depth(v.rx, v.ry); v.kind = K_VISITOR; drawList.push(v); }
  for (const c of AG.cars) { if (!c.active) continue; c.rx = c.px + (c.x - c.px) * alpha; c.ry = c.py + (c.y - c.py) * alpha; c.depth = depth(c.rx, c.ry + 0.08); c.kind = K_CAR; drawList.push(c); }
  for (const s of AG.staff) { s.rx = s.px + (s.x - s.px) * alpha; s.ry = s.py + (s.y - s.py) * alpha; s.depth = depth(s.rx, s.ry); s.kind = K_STAFF; drawList.push(s); }
  drawList.sort(byDepth);
  stats.entries = drawList.length; stats.sprites = drawList.length - staticEntries.length;
  for (let i = 0; i < drawList.length; i++) {
    const e = drawList[i];
    switch (e.kind) {
      case K_WALL: drawWall(e); break;
      case K_FACILITY: drawFacility(e); break;
      case K_SIGN: queueSign(e); break;
      case K_GATE: drawGate(); break;
      case K_OFFICE: drawOffice(); break;
      case K_FOUNTAIN: drawFountain(); break;
      case K_HEDGE: box(e.x0, e.y0, e.x1 === e.x0 ? e.x1 + 0.12 : e.x1, e.y1 === e.y0 ? e.y1 + 0.12 : e.y1, HEDGE_H, '#4f8a3e', '#3c6b2f', '#345d29', '#22401c'); break;
      case K_BUSH: drawPlanter(e); break;
      case K_BENCH: drawBench(e); break;
      case K_LAMP: drawLamp(e); break;
      case K_STAKE: drawStake(e); break;
      case K_VISITOR: drawVisitor(e); break;
      case K_CAR: drawCar(e); break;
      case K_DINO: drawDino(e); break;
      case K_STAFF: drawStaff(e); break;
    }
  }
  // Labels last, and never inside the depth sort: signs, facility tags and pen chips are UI over the scene.
  drawPenLabels();
  flushLabels();
  drawHud();
}
const byDepth = (a, b) => a.depth - b.depth;

// ---- primitives (world -> screen) ----
function quad(x0, y0, x1, y1, z, fill, stroke) {
  project(x0, y0, z, P); project(x1, y0, z, Q); project(x1, y1, z, R); project(x0, y1, z, S);
  ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.lineTo(R.x, R.y); ctx.lineTo(S.x, S.y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
// Whole polyomino as one canvas path (from its outline loops), so a concave parcel fills and strokes cleanly.
function loopShape(g, z, fill, stroke) {
  ctx.beginPath();
  for (const lp of g.loops) {
    for (let i = 0; i < lp.length; i++) { project(lp[i][0], lp[i][1], z, P); if (i === 0) ctx.moveTo(P.x, P.y); else ctx.lineTo(P.x, P.y); }
    ctx.closePath();
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
// vertical quad between two ground points, from z0 to z1
function vquad(xa, ya, xb, yb, z0, z1, fill, stroke) {
  project(xa, ya, z0, P); project(xb, yb, z0, Q); project(xb, yb, z1, R); project(xa, ya, z1, S);
  ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.lineTo(R.x, R.y); ctx.lineTo(S.x, S.y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function box(x0, y0, x1, y1, h, top, front, side, stroke, z0 = 0) {
  vquad(x1, y0, x1, y1, z0, z0 + h, side, stroke);   // east face
  vquad(x0, y1, x1, y1, z0, z0 + h, front, stroke);  // front face
  quad(x0, y0, x1, y1, z0 + h, top, stroke);         // roof
}
function line3(xa, ya, za, xb, yb, zb, color, w) {
  project(xa, ya, za, P); project(xb, yb, zb, Q);
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.stroke();
}
function label(text, sx, sy, color, align = 'center', font = FONT) {
  ctx.font = font; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, sx, sy); ctx.textAlign = 'left';
}
function tag(text, sx, sy, fg, bg, font = FONT_S) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 6;
  ctx.fillStyle = bg; ctx.fillRect(sx - w / 2, sy - 8, w, 10);
  label(text, sx, sy, fg, 'center', font);
}

// ---- ground pass ----
function drawGround() {
  const { PARK_W, PARK_H, WORLD_H, ROAD_Y, CENTER, PLAZA_HALF } = L;
  ctx.fillStyle = '#2e5a33';
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  // strip under the park: forecourt, road
  quad(-0.3, PARK_H, PARK_W + 0.3, WORLD_H, 0, '#7d8577');
  quad(-0.8, ROAD_Y - 0.14, PARK_W + 0.9, ROAD_Y + 0.14, 0, '#34363c');
  for (let x = -0.6; x < PARK_W + 0.9; x += 0.5) quad(x, ROAD_Y - 0.012, x + 0.25, ROAD_Y + 0.012, 0, '#e6c94a');
  // front parking lot (grows with the parking tier)
  const lot = AG.lotRect;
  const tier = facilityTier('parking_lot');
  quad(lot.x0, lot.y0, lot.x1, lot.y1, 0, tier === 0 ? '#6e6a5e' : '#4a4e58', '#2b2e35');
  if (tier >= 2) quad(lot.x0 + 0.03, lot.y0 + 0.03, lot.x1 - 0.03, lot.y1 - 0.03, 0, null, '#e6c94a');
  drawSlots();
  // park ground + walkways from data
  quad(0, 0, PARK_W, PARK_H, 0, '#3f7a3f');
  for (const w of L.walkways) {
    const hw = w.w / 2;
    quad(Math.min(w.from[0], w.to[0]) - hw, Math.min(w.from[1], w.to[1]) - hw, Math.max(w.from[0], w.to[0]) + hw, Math.max(w.from[1], w.to[1]) + hw, 0, '#b8ab8c');
  }
  // plaza paving
  quad(CENTER.x - PLAZA_HALF, CENTER.y - PLAZA_HALF, CENTER.x + PLAZA_HALF, CENTER.y + PLAZA_HALF, 0, '#cfc3a4', '#8d8368');
  quad(CENTER.x - PLAZA_HALF * 0.7, CENTER.y - PLAZA_HALF * 0.7, CENTER.x + PLAZA_HALF * 0.7, CENTER.y + PLAZA_HALF * 0.7, 0, '#bfb394');
  // parcels at their true tile-set footprint: one path per parcel built from its outline loops, so an L, plus or Z
  // is filled and outlined as one shape with no seam between its own tiles.
  for (const p of parcelList()) {
    const g = parcelGeometry(p.id);
    const biome = biomeById(parcelDef(p.id).biome);
    if (!p.owned) {
      // Unbought land is scrub, not lawn: a dry tan-olive ground with a biome wash and scattered stones and dry
      // tufts, so owned pens (full biome colour) and unsold parcels never read as the same green field. The wash
      // carries enough of the biome through (and the dashed border is the biome colour lightened) that marsh,
      // plains and desert are told apart on the map, not only in the legend swatches.
      loopShape(g, 0, '#7c7a52', null);
      loopShape(g, 0, tint(biome.color, 0.4), null);
      loopShape(g, 0, 'rgba(60,50,30,0.16)', null);
      drawScrub(p.id, g);
      ctx.setLineDash([5, 4]);
      loopShape(g, 0, null, lighten(biome.color, 0.35));
      ctx.setLineDash([]);
    } else {
      loopShape(g, 0, biome.color, '#2b3a2b');
      if (p.enclosure) drawPenFloor(p, g);
    }
    if (hover === p.id) loopShape(g, 0, 'rgba(255,255,255,0.12)', '#ffffff');
  }
  // facility pads (flat slabs under each building so a tier-0 pad reads as a reserved spot)
  for (const f of DATA.facilities.facilities) {
    if (f.id === 'office' || f.id === 'parking_lot') continue;
    const m = L.facilities[f.id];
    quad(m.x0, m.y0, m.x1, m.y1, 0, hoverFacility === f.id ? '#d8d2c2' : '#a8a08a', '#6d6754');
  }
  if (hoverFacility === 'parking_lot') quad(lot.x0, lot.y0, lot.x1, lot.y1, 0, 'rgba(255,255,255,0.15)', '#ffffff');
  if (hoverFacility === 'office') quad(L.OFFICE.x0, L.OFFICE.y0, L.OFFICE.x1, L.OFFICE.y1, 0, 'rgba(255,255,255,0.15)', '#ffffff');
  // litter
  for (const l of AG.litter) {
    if (!l.active) continue;
    project(l.x, l.y, 0, P);
    ctx.fillStyle = l.kind === 0 ? '#f1f0e6' : l.kind === 1 ? '#d9534f' : '#8ab6d6';
    ctx.fillRect(P.x - 1.5, P.y - 1, 3, 2);
  }
  // escape marker
  if (AG.escape.active) {
    project(AG.escape.x, AG.escape.y, 0, P);
    const r = 12 + 3 * Math.sin(AG.simTime * 6);
    ctx.strokeStyle = 'rgba(224,92,92,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.ellipse(P.x, P.y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}
// Deterministic scrub litter for an unbought parcel (stones + dry tufts), generated once and projected each frame.
const scrubCache = new Map();
function scrubFor(id, g) {
  let pts = scrubCache.get(id);
  if (pts) return pts;
  pts = [];
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const [tx, ty] of g.tiles) for (let i = 0; i < 7; i++) pts.push({ x: tx + 0.12 + rnd() * 0.76, y: ty + 0.12 + rnd() * 0.76, k: rnd() });
  scrubCache.set(id, pts);
  return pts;
}
function drawScrub(id, g) {
  for (const s of scrubFor(id, g)) {
    project(s.x, s.y, 0, P);
    if (s.k < 0.4) { ctx.fillStyle = '#9a9478'; ctx.fillRect(P.x - 1, P.y - 1, 2, 2); }
    else if (s.k < 0.75) { ctx.strokeStyle = '#a8a066'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + 1.5, P.y - 4); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x - 1.5, P.y - 3.5); ctx.stroke(); }
    else { ctx.fillStyle = '#6a6a46'; ctx.fillRect(P.x - 1.5, P.y - 1, 3, 1.5); }
  }
}

const lightenCache = new Map();
function lighten(hex, amt) {
  const k = hex + amt;
  let s = lightenCache.get(k);
  if (s) return s;
  const n = parseInt(hex.slice(1), 16);
  const mix = c => Math.round(c + (255 - c) * amt);
  s = `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
  lightenCache.set(k, s);
  return s;
}

const tintCache = new Map();
function tint(hex, a) {
  const k = hex + a;
  let s = tintCache.get(k);
  if (s) return s;
  const n = parseInt(hex.slice(1), 16);
  s = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  tintCache.set(k, s);
  return s;
}

function drawSlots() {
  for (const s of AG.slots) quad(s.x - 0.11, s.y - 0.08, s.x + 0.11, s.y + 0.08, 0, null, '#c9c9c9');
}

function drawPenFloor(p, g) {
  // worn patch over the whole tile set plus a food trough on the label tile, so a pen reads as lived-in
  loopShape(g, 0, 'rgba(0,0,0,0.08)', null);
  const enc = p.enclosure;
  let stock = 0; for (const k in enc.food) stock += enc.food[k];
  const [tx, ty] = g.label;
  quad(tx + 0.1, ty + 0.1, tx + 0.3, ty + 0.2, 0, stock > 0 ? '#8a5a2b' : '#5a3a1b', '#2b1a0b');
  if (stock > 0) quad(tx + 0.12, ty + 0.12, tx + 0.28, ty + 0.18, 0, enc.food.meat > 0 ? '#c0392b' : '#6fcf6a');
}

// ---- static drawables ----
function drawWall(e) {
  const f = fenceByTier(e.tier);
  const K = DATA.fences.breakout;
  const broken = e.cond <= K.low_condition_threshold && ((e.seg * 7 + e.id.charCodeAt(1) * 3) % 4 === 0);
  const cracked = e.cond < 60;
  const h = FENCE_H;
  const post = f.id === 'wood' ? '#6b4423' : f.id === 'steel' ? '#6d7680' : f.id === 'concrete' ? '#9a958a' : '#8a8a52';
  // post at the segment start
  if (broken) { line3(e.x0, e.y0, 0, e.x0 + 0.08, e.y0 + 0.02, h * 0.55, post, 2); }
  else line3(e.x0, e.y0, 0, e.x0, e.y0, h, post, 2);
  if (broken) return; // gap in the fence
  if (f.id === 'wood') {
    line3(e.x0, e.y0, h * 0.45, e.x1, e.y1, h * 0.45, f.color, 2);
    line3(e.x0, e.y0, h * 0.9, e.x1, e.y1, h * 0.9, f.color, 2);
  } else if (f.id === 'steel') {
    vquad(e.x0, e.y0, e.x1, e.y1, 0.03, h, 'rgba(154,164,173,0.35)', f.color);
    line3(e.x0, e.y0, h * 0.95, e.x1, e.y1, h * 0.95, f.color, 1.5);
  } else if (f.id === 'concrete') {
    vquad(e.x0, e.y0, e.x1, e.y1, 0, h, f.color, '#5a574f');
    if (cracked) line3(e.x0 + (e.x1 - e.x0) * 0.4, e.y0 + (e.y1 - e.y0) * 0.4, h * 0.9, e.x0 + (e.x1 - e.x0) * 0.6, e.y0 + (e.y1 - e.y0) * 0.6, h * 0.2, '#4a463d', 1);
  } else {
    for (let z = 0.3; z <= 0.95; z += 0.32) line3(e.x0, e.y0, h * z, e.x1, e.y1, h * z, '#f2d64b', 1);
    line3(e.x0, e.y0, h * 1.02, e.x1, e.y1, h * 1.02, 'rgba(242,214,75,0.35)', 3);
    project(e.x0, e.y0, h * 0.62, P); ctx.fillStyle = '#f2f2f2'; ctx.fillRect(P.x - 1, P.y - 1, 2, 2);
  }
}

// Survey stakes + rope along the outline of a parcel nobody has fenced yet: the land reads as staked-out lots that
// tile together, instead of one unbroken lawn with billboards standing in it.
function drawStake(e) {
  const h = e.tier === 1 ? 0.2 : 0.16;
  const post = e.tier === 1 ? '#8a6a3c' : '#6b5a3c';
  line3(e.x0, e.y0, 0, e.x0, e.y0, h, post, 2);
  line3(e.x1, e.y1, 0, e.x1, e.y1, h, post, 2);
  ctx.setLineDash([4, 3]);
  line3(e.x0, e.y0, h * 0.8, e.x1, e.y1, h * 0.8, e.tier === 1 ? '#e6dcb8' : '#bdb08a', 1.5);
  ctx.setLineDash([]);
}
function drawPlanter(e) {
  box(e.x0 - 0.13, e.y0 - 0.13, e.x0 + 0.13, e.y0 + 0.13, 0.1, '#b9ad8e', '#9a8f74', '#867c64', '#1e2228');
  box(e.x0 - 0.1, e.y0 - 0.1, e.x0 + 0.1, e.y0 + 0.1, 0.18, '#5c9a45', '#457a33', '#3a672b', '#22401c', 0.1);
}
function drawBench(e) {
  const w = e.tier === 0 ? 0.22 : 0.07, d = e.tier === 0 ? 0.07 : 0.22;
  box(e.x0 - w, e.y0 - d, e.x0 + w, e.y0 + d, 0.09, '#a97b4a', '#8a6238', '#74522f', '#2b1a0b');
  box(e.x0 - w, e.y0 - d, e.x0 + w, e.y0 - d + 0.03, 0.2, '#a97b4a', '#8a6238', '#74522f', '#2b1a0b', 0.09);
}
function drawLamp(e) {
  line3(e.x0, e.y0, 0, e.x0, e.y0, 0.62, '#4a4e58', 2);
  box(e.x0 - 0.05, e.y0 - 0.05, e.x0 + 0.05, e.y0 + 0.05, 0.1, '#f6e9a8', '#e0d089', '#c9b978', '#2b2e35', 0.62);
}

// Fixed facility at its tier: bigger box per tier, extra roof sections at tiers 2-3, a sign with the tier label.
function drawFacility(e) {
  facilityRect(e.id, e.tier, rect);
  const c = FACILITY_COLORS[e.id] || ['#8a8a8a', '#666', '#555'];
  const { x0, y0, x1, y1, z, roofs } = rect;
  if (e.tier === 0 && roofs === 0) { // empty pad: low slab with a marker post
    box(x0, y0, x1, y1, z * 0.5, '#bdb59d', '#8f886f', '#7a7460', '#1e2228');
    line3((x0 + x1) / 2, y1 - 0.05, 0, (x0 + x1) / 2, y1 - 0.05, 0.4, '#5a3d1e', 2);
    project((x0 + x1) / 2, y1 - 0.05, 0.4, P);
    queueTag(facilityById(e.id).name.toUpperCase(), P.x, P.y - 2, '#1e2228', '#f2c94c', 2);
    return;
  }
  box(x0, y0, x1, y1, z, c[0], c[1], c[2], '#1e2228');
  // roof sections: a ridge per section, and a raised second storey / clerestory from tier 2 up
  const n = Math.max(1, roofs);
  for (let i = 1; i < n; i++) { const yy = y0 + (y1 - y0) * i / n; line3(x0, yy, z, x1, yy, z, 'rgba(0,0,0,0.3)', 1.5); }
  line3(x0, (y0 + y1) / 2, z, x1, (y0 + y1) / 2, z, 'rgba(0,0,0,0.25)', 1.5);
  if (n >= 2) box(x0 + 0.12, y0 + 0.08, x1 - 0.12, y0 + (y1 - y0) * 0.45, 0.16, c[0], c[1], c[2], '#1e2228', z);
  if (n >= 3) { const cx = (x0 + x1) / 2; box(cx - 0.1, y0 + 0.1, cx + 0.1, y0 + 0.3, 0.14, '#f2c94c', '#c9a63b', '#a8892f', '#1e2228', z + 0.16); }
  // door + windows on the front
  const dx = (x0 + x1) / 2;
  vquad(dx - 0.07, y1, dx + 0.07, y1, 0, z * 0.5, '#1e2228');
  if (n >= 2) for (const wx of [x0 + 0.12, x1 - 0.12]) vquad(wx - 0.06, y1, wx + 0.06, y1, z * 0.3, z * 0.6, '#cfe3f5', '#1e2228');
  const t = facilityTierDef(e.id, e.tier);
  project(dx, y1, z + (n >= 2 ? 0.2 : 0.06), P);
  queueTag(t.label.toUpperCase(), P.x, P.y - 4, '#f1f0e6', 'rgba(16,20,28,0.75)', 2);
  if (hoverFacility === e.id) { ctx.setLineDash([3, 2]); quad(x0 - 0.04, y0 - 0.04, x1 + 0.04, y1 + 0.04, 0, null, '#ffffff'); ctx.setLineDash([]); }
}

// ---- label pass: signs, facility tags and pen chips ----
// Everything readable is collected while the scene draws and painted afterwards, so no roof or pen wall can eat a
// price. A greedy pass then lifts any chip that lands on one already placed (front-most keeps its spot), so two
// signs and a facility tag beside the plaza stack instead of overprinting each other.
const labelQueue = [], labelBoxes = [];
// (dx in label widths, dy in 14px rows) tried in order when a label collides with one already placed.
const LABEL_SLOTS = [[0, 0], [0, -1], [0, -2], [0, 1], [0, 2], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -3], [0, 3], [-1, -2], [1, -2]];
// Placed label rectangles for the frame just drawn (used by the layout check in tools/, and handy in the console).
export const labelRects = () => labelBoxes.map(b => ({ ...b }));
function queueLabel(prio, x, y, w, h, draw) { labelQueue.push({ prio, x, y, w, h, draw }); }
function queueTag(text, sx, sy, fg, bg, prio, font = FONT_S) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 6;
  queueLabel(prio, sx, sy, w, 12, (x, y) => tag(text, x, y, fg, bg, font));
}
function blocker(x0, y0, x1, y1) {
  for (let i = labelBoxes.length - 1; i >= 0; i--) {
    const b = labelBoxes[i];
    if (x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0) return b;
  }
  return null;
}
function flushLabels() {
  labelBoxes.length = 0;
  labelBoxes.push({ x0: 0, y0: 0, x1: 6 + hud.text.length * 8 + 14, y1: 24 }); // the HUD owns the top-left corner
  // Front-most first (bigger world y drew later), by priority: a loose dinosaur, then pen chips, facilities, signs.
  labelQueue.sort((a, b) => a.prio - b.prio || b.y - a.y);
  for (const it of labelQueue) {
    const y0 = Math.max(it.h + 2, Math.min(BASE_H - 2, it.y));
    let x = it.x, y = y0, placed = false;
    // Candidates in order of preference: where it belongs, then lifted, then dropped, then stepped sideways along
    // the path. Pushing only upward used to run out of room and drop a board straight onto the pen behind it.
    for (const [dx, dy] of LABEL_SLOTS) {
      const cx = Math.max(it.w / 2 + 2, Math.min(BASE_W - it.w / 2 - 2, it.x + dx * (it.w * 0.55)));
      const cy = Math.max(it.h + 2, Math.min(BASE_H - 2, y0 + dy * 14));
      if (!blocker(cx - it.w / 2, cy - it.h, cx + it.w / 2, cy)) { x = cx; y = cy; placed = true; break; }
    }
    if (!placed) { x = it.x; y = y0; }
    labelBoxes.push({ x0: x - it.w / 2, y0: y - it.h, x1: x + it.w / 2, y1: y });
    it.draw(x, y);
  }
  labelQueue.length = 0;
}

// A parcel sign is one board on a post: FOR SALE / READY over the shape and price. Queued, not depth-sorted.
function queueSign(e) {
  project(e.x0, e.y0, 0, P);
  const gx = P.x, gy = P.y;
  project(e.x0, e.y0, 0.32, Q);
  const shape = shortShape(e.id);
  const l2 = e.tier === 0 ? `${shape} ${fmt$(parcelPrice(e.id))}` : `${e.id} ${shape}`;
  ctx.font = FONT; const w1 = ctx.measureText(e.text).width;
  ctx.font = FONT_S; const w2 = ctx.measureText(l2).width;
  const w = Math.max(w1, w2) + 10, h = 24;
  queueLabel(3, Q.x, Q.y, w, h, (x, y) => {
    ctx.strokeStyle = '#5a3d1e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = e.tier === 0 ? '#f2c94c' : '#c9c4b8';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = '#1e2228'; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2 + 0.5, y - h + 0.5, w - 1, h - 1);
    label(e.text, x, y - h + 11, '#1e2228');
    label(l2, x, y - 5, '#1e2228', 'center', FONT_S);
  });
}

function drawGate() {
  const g = L.GATE, t = 0.14, h = 0.75, PARK_H = L.PARK_H;
  box(g.x - g.halfGap - t, PARK_H - t / 2, g.x - g.halfGap, PARK_H + t / 2, h, '#d8d2c2', '#b8b2a2', '#9a9486', '#1e2228');
  box(g.x + g.halfGap, PARK_H - t / 2, g.x + g.halfGap + t, PARK_H + t / 2, h, '#d8d2c2', '#b8b2a2', '#9a9486', '#1e2228');
  vquad(g.x - g.halfGap - t, PARK_H, g.x + g.halfGap + t, PARK_H, h * 0.72, h + 0.12, '#6b5c8a', '#1e2228');
  project(g.x, PARK_H, h * 0.72 + 0.03, P);
  label('ENTRANCE', P.x, P.y - 3, '#f2c94c');
}

function drawOffice() {
  const o = L.OFFICE;
  box(o.x0, o.y0, o.x1, o.y1, o.h, '#8a7d9c', '#6b5c8a', '#54486e', '#1e2228');
  vquad(L.OFFICE_DOOR.x - 0.1, o.y1, L.OFFICE_DOOR.x + 0.1, o.y1, 0, o.h * 0.5, '#1e2228');
  for (const wx of [o.x0 + 0.35, o.x1 - 0.35]) vquad(wx - 0.12, o.y1, wx + 0.12, o.y1, o.h * 0.25, o.h * 0.6, '#cfe3f5', '#1e2228');
  project((o.x0 + o.x1) / 2, o.y1, o.h * 0.82, P);
  label('OFFICE', P.x, P.y + 3, '#f1f0e6', 'center', FONT_S);
}

// Our own centrepiece: a round fountain with a stone long-neck dinosaur sculpture.
function drawFountain() {
  const c = L.CENTER, r = L.FOUNTAIN_R;
  project(c.x, c.y, 0, P);
  ctx.fillStyle = '#8d8368'; ctx.beginPath(); ctx.ellipse(P.x, P.y, L.TW * r, L.TH * r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1e2228'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#4f8fd6'; ctx.beginPath(); ctx.ellipse(P.x, P.y - 2, L.TW * r * 0.8, L.TH * r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  const t = AG.simTime;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let k = 0; k < 4; k++) { const a = t * 1.5 + k * 1.57; ctx.fillRect(P.x + Math.cos(a) * L.TW * r * 0.55 - 1, P.y - 2 + Math.sin(a) * L.TH * r * 0.55, 3, 2); }
  box(c.x - 0.08, c.y - 0.08, c.x + 0.08, c.y + 0.08, 0.22, '#c9c4b8', '#a9a498', '#8d8880', '#1e2228');
  // sculpture: body, neck, head, tail in stone grey
  project(c.x, c.y, 0.22, Q);
  ctx.fillStyle = '#b5b0a4'; ctx.strokeStyle = '#1e2228'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(Q.x, Q.y - 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(Q.x + 6, Q.y - 8); ctx.quadraticCurveTo(Q.x + 14, Q.y - 14, Q.x + 12, Q.y - 26); ctx.lineTo(Q.x + 9, Q.y - 26); ctx.quadraticCurveTo(Q.x + 9, Q.y - 12, Q.x + 3, Q.y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(Q.x + 11, Q.y - 27, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(Q.x - 8, Q.y - 8); ctx.lineTo(Q.x - 20, Q.y - 12); ctx.lineTo(Q.x - 8, Q.y - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const lx of [-5, 4]) { ctx.fillRect(Q.x + lx, Q.y - 3, 3, 4); }
}

function badge(sx, sy) {
  ctx.fillStyle = '#e05c5c'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1e2228'; ctx.lineWidth = 1; ctx.stroke();
  label('!', sx, sy + 3, '#ffffff', 'center', FONT_S);
}

// ---- agents ----
function shadow(sx, sy, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sx, sy, w, w * 0.45, 0, 0, Math.PI * 2); ctx.fill();
}
function person(sx, sy, shirt, hat) {
  shadow(sx, sy, 3.5);
  ctx.fillStyle = '#2b2f3a'; ctx.fillRect(sx - 2.5, sy - 4, 2, 4); ctx.fillRect(sx + 0.5, sy - 4, 2, 4);
  ctx.fillStyle = shirt; ctx.fillRect(sx - 3, sy - 10, 6, 7);
  ctx.strokeStyle = '#1e2228'; ctx.lineWidth = 1; ctx.strokeRect(sx - 3 + 0.5, sy - 10 + 0.5, 5, 6);
  ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(sx, sy - 12.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (hat) { ctx.fillStyle = hat; ctx.fillRect(sx - 3.5, sy - 16, 7, 2.5); }
}
function drawVisitor(v) {
  project(v.rx, v.ry, 0, P);
  person(P.x, P.y, VISITOR_SHIRTS[v.color], null);
  if (v.st === AG.V_PANIC) label('!', P.x, P.y - 18, '#f2c94c', 'center', FONT_S);
}
function drawStaff(s) {
  project(s.rx, s.ry, 0, P);
  const col = STAFF_COLORS[s.role] || '#888';
  person(P.x, P.y, col, s.role === 'security' ? '#2b3a8a' : s.role === 'maintenance' ? '#f2c94c' : s.role === 'veterinary' ? '#e05c5c' : null);
  if (s.role === 'maintenance') { ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(P.x + 4, P.y - 9); ctx.lineTo(P.x + 7 + (s.st === 2 ? Math.sin(AG.simTime * 12) * 3 : 0), P.y + 1); ctx.stroke(); }
  else if (s.role === 'tour_guide') { ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x + 4, P.y - 8); ctx.lineTo(P.x + 4, P.y - 22); ctx.stroke(); ctx.fillStyle = '#f2c94c'; ctx.fillRect(P.x + 4, P.y - 22, 6, 4); }
  else if (s.role === 'veterinary') { ctx.fillStyle = '#e05c5c'; ctx.fillRect(P.x - 1, P.y - 9, 2, 5); ctx.fillRect(P.x - 2.5, P.y - 7.5, 5, 2); }
}
function drawCar(c) {
  const w = 0.11, hh = 0.065;
  const x0 = c.rx - w, x1 = c.rx + w, y0 = c.ry - hh, y1 = c.ry + hh;
  const col = CAR_COLORS[c.color];
  box(x0, y0, x1, y1, 0.09, col, shade(col), shade(col), '#1e2228');
  box(x0 + 0.05, y0 + 0.01, x1 - 0.05, y1 - 0.01, 0.15, '#bfdcf0', shade(col), shade(col), '#1e2228');
}
const shadeCache = new Map();
function shade(hex) {
  let s = shadeCache.get(hex);
  if (s) return s;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 50), g = Math.max(0, ((n >> 8) & 255) - 50), b = Math.max(0, (n & 255) - 50);
  s = `rgb(${r},${g},${b})`;
  shadeCache.set(hex, s);
  return s;
}
// Bigger placeholder dinosaurs with a dark outline pass so they read against any pen colour.
function drawDino(d) {
  project(d.rx, d.ry, 0, P);
  const SC = DATA.balance.living.dino_sprite_scale;
  const size = SC[d.size] ?? SC.medium;
  const w = 6 * size, h = 3.6 * size;
  const bob = d.moving ? Math.abs(Math.sin(d.phase)) * 1.5 : Math.sin(d.phase * 0.5) * 0.6;
  const sx = P.x, sy = P.y - bob;
  const dir = d.dir;
  shadow(P.x, P.y, w * 0.9);
  const nx = sx + dir * w * 0.8, ny = sy - h * 1.6 - (d.size === 'large' ? h * 0.9 : h * 0.3);
  for (let pass = 0; pass < 2; pass++) {
    const outline = pass === 0;
    ctx.fillStyle = outline ? '#161a20' : d.color; ctx.strokeStyle = '#161a20'; ctx.lineWidth = outline ? 3 : 1;
    // legs
    ctx.fillRect(sx - w * 0.5 - (outline ? 1 : 0), sy - h * 0.6 - (outline ? 1 : 0), 2 * size + (outline ? 2 : 0), h * 0.7 + (outline ? 2 : 0));
    ctx.fillRect(sx + w * 0.2 - (outline ? 1 : 0), sy - h * 0.6 - (outline ? 1 : 0), 2 * size + (outline ? 2 : 0), h * 0.7 + (outline ? 2 : 0));
    // tail
    ctx.beginPath(); ctx.moveTo(sx - dir * w * 0.6, sy - h * 1.3); ctx.lineTo(sx - dir * w * 1.5, sy - h * 1.6); ctx.lineTo(sx - dir * w * 0.6, sy - h * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    // body
    ctx.beginPath(); ctx.ellipse(sx, sy - h * 1.05, w, h, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // neck + head
    ctx.lineWidth = Math.max(2, 2.2 * size) + (outline ? 2.5 : 0); ctx.strokeStyle = outline ? '#161a20' : d.color; ctx.beginPath(); ctx.moveTo(sx + dir * w * 0.6, sy - h * 1.2); ctx.lineTo(nx, ny); ctx.stroke();
    ctx.lineWidth = outline ? 3 : 1; ctx.strokeStyle = '#161a20';
    ctx.beginPath(); ctx.ellipse(nx + dir * 2 * size, ny, 3.2 * size, 2.2 * size, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#f1f0e6'; ctx.fillRect(nx + dir * 3 * size - 1, ny - 1.5, 2.5, 2.5);
  ctx.fillStyle = '#161a20'; ctx.fillRect(nx + dir * 3 * size, ny - 1, 1.5, 1.5);
  d.labelY = sy - h * 2.6 - (d.size === 'large' ? h : 0) - 8;
  if (d.d.sick_days > 0 || d.d.health < 50) badge(sx, d.labelY + 2);
  else if (d.d.hunger >= DATA.balance.living.dino_hungry_threshold) { label('z', sx + w, sy - h * 2.4, '#f2c94c', 'center', FONT_S); }
}
// One sign per pen (species and head count) on the front fence, instead of a tag over every animal: two Triceratops
// used to draw two stacked labels that spilled over the north wall onto the walkway crowd. Large species always,
// any pen on hover (balance.living.dino_label_always). An escaped dinosaur keeps a tag that follows it.
const penLabels = new Map();
function drawPenLabels() {
  const always = DATA.balance.living.dino_label_always || [];
  penLabels.clear();
  for (const d of AG.dinos) {
    if (d.escaped) { project(d.rx, d.ry, 0, P); queueTag(d.sp.name.toUpperCase(), P.x, d.labelY ?? P.y - 30, '#f2c94c', 'rgba(16,20,28,0.85)', 0); continue; }
    if (!(always.includes(d.size) || hover === d.parcel)) continue;
    let m = penLabels.get(d.parcel);
    if (!m) { m = new Map(); penLabels.set(d.parcel, m); }
    m.set(d.name, (m.get(d.name) || 0) + 1);
  }
  for (const [id, m] of penLabels) {
    const a = parcelGeometry(id).sign;
    project(a.x, a.y, 0, P); // the walkway tile beside the pen: a name chip never covers the animals it names
    let y = P.y - 3;
    for (const [name, n] of m) { queueTag(n > 1 ? `${name.toUpperCase()} x${n}` : name.toUpperCase(), P.x, y, '#f1f0e6', 'rgba(16,20,28,0.75)', 1); y -= 13; }
  }
}

function drawHud() {
  const c = AG.counts;
  const a = state.today.attendance;
  if (c.visitors !== hud.v || c.cars !== hud.c || a !== hud.a) {
    hud.v = c.visitors; hud.c = c.cars; hud.a = a;
    hud.text = `IN PARK ${c.visitors}  CARS ${c.cars}  TODAY ${a}${state.closed_days > 0 ? '  CLOSED' : ''}`;
  }
  ctx.fillStyle = 'rgba(16,20,28,0.7)';
  ctx.fillRect(6, 6, hud.text.length * 8 + 12, 16);
  label(hud.text, 12, 18, '#f1f0e6', 'left');
  if (state.speed === 0) label('PAUSED', BASE_W - 8, 18, '#f2c94c', 'right');
  if (AG.escape.active) label('DINOSAUR LOOSE!', BASE_W / 2, 18, '#e05c5c', 'center');
}
