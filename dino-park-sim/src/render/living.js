// Living Park renderer: 2.5D oblique scene of the whole park drawn from game state + agents.
// Placeholder art: flat-shaded shapes with outlines. Everything in world coords through projection.js.
// Ground (flat, z=0) is drawn first without sorting; everything with height goes through a painter's
// sort on depth() so sprites overlap walls and each other correctly.
// M2.6: parcels are tile sets (polyominoes). Ground and pen floors are filled from the parcel's outline loops and
// walls are emitted per OUTLINE EDGE only (never between two tiles of the same parcel), so an L, plus or Z fences
// correctly at every concave corner. Signs and pen labels sit on the label / front tile, never a bounding box.
// M3: every facility tier has its own look (lot surface dirt -> gravel -> asphalt -> lined & lit -> overflow block;
// buildings grow in footprint, roof sections and storeys with a style per tier), the strip holds the tram, visitor
// center, office and vet clinic, earned park prizes are drawn at their data positions, a boundary shared by two pens
// draws ONE wall (higher tier wins), and biome ground marks tell desert / marsh / plains apart without the legend.
import { DATA, state, parcelList, parcelDef, parcelGeometry, parcelAtTile, biomeById, parcelBiome, unownedBiome, fenceByTier, facilityTier, facilityById, facilityTierDef, facilityNextTier, prizeEarned, earnedPrizes, fmt$, onChange, biomeFit } from '../state.js';
import { BASE_W, BASE_H, L, project, unproject, depth, parcelAtWorld, facilityRect, facilityAtWorld } from './projection.js';
import * as AG from '../sim/agents.js';
import { parcelTooltip, shortShape } from './park.js';
import { parcelPriceFrom, vegetationCap, plantedFraction, seedsToPlant } from '../economy.js';
import { fountainLevel } from '../prizes.js';
import { goalDone } from '../goals.js';
import { effectText } from '../ui/effects.js';
import { showTip, hideTip } from '../ui/tooltips.js';

const FONT = '8px "Press Start 2P", monospace';
const FONT_S = '7px "Press Start 2P", monospace';
const FENCE_H = 0.34, HEDGE_H = 0.2, SEG = 0.25;
// How far inside its own outline a parcel's fence stands, in tiles (only on edges that are NOT shared with another pen).
const WALL_INSET = 0.045;
const FACILITY_COLORS = {
  restrooms: ['#7fb8a8', '#5e9484', '#4a7a6c'], food_stand: ['#e0685a', '#b84c40', '#8f3a30'], gift_shop: ['#a97ad6', '#8258ad', '#654288'],
  office: ['#8a7d9c', '#6b5c8a', '#54486e'], visitor_center: ['#d9a441', '#b3842f', '#8c6624'], vet_clinic: ['#eef1f4', '#c9d0d8', '#a7b0bb'], park_tram: ['#5aa0b5', '#3f7d90', '#2f5f6e']
};
const VISITOR_SHIRTS = ['#e05c5c', '#6fcf6a', '#5aa0e0', '#f2c94c', '#e08fd0', '#f0f0e8', '#ff9d4d', '#66d6c8'];
const CAR_COLORS = ['#d84a4a', '#3b6fd6', '#f2f2f2', '#2c2f36', '#6fcf6a', '#f2c94c', '#9b6fd6', '#c0c6d0'];
const STAFF_COLORS = { maintenance: '#f08a24', tour_guide: '#3fbf5f', security: '#3b5fd6', veterinary: '#f4f4f4', concessions: '#b56fd6', management: '#7d8494' };
const OUT = '#1e2228';

// Draw-list entry kinds
const K_WALL = 1, K_FACILITY = 2, K_SIGN = 3, K_GATE = 4, K_FOUNTAIN = 6, K_HEDGE = 7, K_BUSH = 8,
  K_STAKE = 9, K_BENCH = 14, K_LAMP = 15, K_BANNER = 16, K_FLOWER = 17, K_STATUE = 18, K_CAROUSEL = 19, K_TRAMSTOP = 20,
  K_VISITOR = 10, K_CAR = 11, K_DINO = 12, K_STAFF = 13, K_TRAM = 21, K_SALE = 22, K_TRUCK = 23, K_CRATE = 24;

let canvas, ctx, handlers = { onParcelClick: () => {}, onFacilityClick: () => {} };
let active = false, raf = 0, lastT = 0, acc = 0, watchdog = 0, lastFrameAt = 0;
let hover = null, hoverFacility = null;
// Camera (playtest request): zoom into the park and pan around while zoomed. zoom 1 = whole park,
// x/y are the pan offset in logical BASE px. Wheel zooms toward the cursor, drag pans, the on-canvas
// +/-/R buttons and a double-click also work. At zoom 1 the pan is pinned to 0 (identical to before).
const cam = { zoom: 1, x: 0, y: 0 };
const ZOOM_MIN = 1, ZOOM_MAX = 4;
const zoomBtns = { in: null, out: null, reset: null }; // logical-space rects, filled by drawHud
let ptrDown = false, ptrDrag = false, ptrX = 0, ptrY = 0;
const M = { x: 0, y: 0 }; // scratch point for pointer math (kept off the render temps)
const staticEntries = [];
let sceneSig = '';
const drawList = [];
const P = { x: 0, y: 0 }, Q = { x: 0, y: 0 }, R = { x: 0, y: 0 }, S = { x: 0, y: 0 };
const rect = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, roofs: 0, rows: 0, render: null };
const hud = { v: -1, c: -1, a: -1, text: '' };
const stats = { stepMs: 0, renderMs: 0, sprites: 0, entries: 0 };
export const livingStats = () => stats;

// Phase 3: real VGA pixel-art sprites replace the placeholder shapes for the dinosaurs.
// Loaded once at boot from sprites/manifest.json (species id -> { w, h, size, face }).
// drawDino falls back to the drawn shape until an image is ready, so a missing or slow
// file never blanks a pen. `face` is the art's own facing; the sprite is mirrored so each
// animal faces its travel direction.
const dinoSprites = new Map();
// Phase 3: per-biome ground textures (scenes/biome-<id>.png), painted as a scaled repeat
// pattern over the flat biome colour inside each owned pen. Keyed by biome id (marsh uses the
// swamp scene). Falls back to the flat colour + procedural marks until the images load.
const biomePatterns = {};
const BIOME_TEX_SCALE = 0.34, BIOME_TEX_ALPHA = 0.6;
function loadBiomeTextures() {
  let base;
  try { base = new URL('../../scenes/', import.meta.url); } catch { return; }
  for (const id of ['desert', 'plains', 'marsh']) {
    const img = new Image();
    img.onload = () => { try { biomePatterns[id] = ctx.createPattern(img, 'repeat'); } catch { /* ctx not ready */ } };
    img.src = new URL(`biome-${id}.png`, base).href;
  }
}
function loadDinoSprites() {
  let base;
  try { base = new URL('../../sprites/', import.meta.url); }
  catch { base = null; }
  if (!base) return;
  fetch(new URL('manifest.json', base)).then(r => (r.ok ? r.json() : null)).then(m => {
    if (!m || !m.sprites) return;
    for (const [id, meta] of Object.entries(m.sprites)) {
      const rec = { img: new Image(), w: meta.w, h: meta.h, face: meta.face || 'right', ready: false };
      rec.img.onload = () => { rec.ready = true; };
      rec.img.src = new URL(`${id}.png`, base).href;
      dinoSprites.set(id, rec);
    }
  }).catch(() => {});
}

export function initLiving(el, h) {
  canvas = el;
  ctx = canvas.getContext('2d');
  handlers = h;
  loadDinoSprites();
  loadBiomeTextures();
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', () => { if (!active) return; hover = null; hoverFacility = null; hideTip(); });
  canvas.addEventListener('wheel', e => {
    if (!active) return;
    e.preventDefault();
    rawLogical(e, M);
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, M.x, M.y);
  }, { passive: false });
  canvas.addEventListener('dblclick', e => { if (!active) return; rawLogical(e, M); zoomAt(cam.zoom < ZOOM_MAX ? 1.6 : ZOOM_MIN / cam.zoom, M.x, M.y); });
  canvas.addEventListener('mousedown', e => { if (!active || e.button !== 0) return; ptrDown = true; ptrDrag = false; ptrX = e.clientX; ptrY = e.clientY; });
  window.addEventListener('mousemove', e => {
    if (!ptrDown) return;
    if (!ptrDrag && Math.hypot(e.clientX - ptrX, e.clientY - ptrY) < 4) return;
    ptrDrag = true;
    if (cam.zoom > 1) {
      const r = canvas.getBoundingClientRect();
      cam.x += (e.clientX - ptrX) * (BASE_W / r.width);
      cam.y += (e.clientY - ptrY) * (BASE_H / r.height);
      clampCam();
    }
    ptrX = e.clientX; ptrY = e.clientY;
    if (canvas.style.cursor !== 'grabbing') canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => { ptrDown = false; canvas.style.cursor = ''; });
  canvas.addEventListener('click', e => {
    if (!active) return;
    if (ptrDrag) { ptrDrag = false; return; } // finished a pan, not a click
    rawLogical(e, M); // zoom buttons live in fixed screen space (pre-camera)
    for (const key of ['in', 'out', 'reset']) {
      const r = zoomBtns[key];
      if (r && M.x >= r.x0 && M.x <= r.x1 && M.y >= r.y0 && M.y <= r.y1) {
        if (key === 'in') zoomAt(1.4, BASE_W / 2, BASE_H / 2);
        else if (key === 'out') zoomAt(1 / 1.4, BASE_W / 2, BASE_H / 2);
        else { cam.zoom = 1; clampCam(); }
        return;
      }
    }
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
  AG.setLivingActive(true);
  if (sceneSignature() !== sceneSig) buildStatic();
  lastT = performance.now(); acc = 0; lastFrameAt = lastT;
  raf = requestAnimationFrame(frame);
  // rAF stalls in a hidden/background tab. The watchdog steps the scene (browsers throttle it to ~1Hz
  // when hidden, so it costs nothing) and hands back to rAF as soon as frames flow again.
  watchdog = setInterval(() => { if (active && performance.now() - lastFrameAt > 250) step(performance.now(), 1000); }, 100);
}
export function stopLiving() {
  active = false;
  AG.setLivingActive(false);
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

// ---- camera ----
function clampCam() {
  cam.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom));
  // Keep the park covering the viewport: at zoom Z the scene [0,BASE] maps to [pan, Z*BASE+pan].
  cam.x = Math.min(0, Math.max(BASE_W * (1 - cam.zoom), cam.x));
  cam.y = Math.min(0, Math.max(BASE_H * (1 - cam.zoom), cam.y));
  if (cam.zoom <= ZOOM_MIN + 1e-6) { cam.zoom = ZOOM_MIN; cam.x = 0; cam.y = 0; }
}
// Zoom by `factor`, keeping the logical (pre-camera) point (cx,cy) fixed on screen.
function zoomAt(factor, cx, cy) {
  const z0 = cam.zoom;
  const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z0 * factor));
  const sx = (cx - cam.x) / z0, sy = (cy - cam.y) / z0;
  cam.zoom = nz; cam.x = cx - nz * sx; cam.y = cy - nz * sy;
  clampCam();
}
// Client px -> logical BASE px, before the camera transform.
function rawLogical(e, out) {
  const r = canvas.getBoundingClientRect();
  out.x = (e.clientX - r.left) * (BASE_W / r.width);
  out.y = (e.clientY - r.top) * (BASE_H / r.height);
  return out;
}

// ---- hit testing ----
function logicalPoint(e) {
  rawLogical(e, P);
  P.x = (P.x - cam.x) / cam.zoom; P.y = (P.y - cam.y) / cam.zoom; // undo the camera to reach scene space
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
  if (ptrDown && ptrDrag) { hideTip(); return; } // mid-pan: no hover/tooltip churn
  hover = parcelAt(e);
  hoverFacility = hover ? null : facilityAt(e);
  if (hover) showTip(parcelTooltip(hover), e.clientX, e.clientY);
  else if (hoverFacility) showTip(facilityTooltip(hoverFacility), e.clientX, e.clientY);
  else hideTip();
}
export function facilityTooltip(id) {
  const f = facilityById(id), t = facilityTierDef(id), next = facilityNextTier(id);
  return `${f.name}: ${t.label} (tier ${t.tier}/${f.tiers[f.tiers.length - 1].tier}) · ${effectText(f, t)}${next ? ` · next: ${next.label} for ${fmt$(next.cost)}` : ' · top tier'}. Click to upgrade.`;
}

// ---- static scene (rebuilt only when the park's layout changes) ----
function sceneSignature() {
  let s = '';
  for (const p of parcelList()) s += p.owned ? (p.enclosure ? `e${p.enclosure.fence_tier}.${Math.floor(p.enclosure.condition / 10)}` : 'o') : 'u';
  for (const k in state.facilities) s += k[0] + state.facilities[k];
  s += '|' + (state.prizes || []).map(p => p.id).join(',');
  return s;
}

function entry(kind, dep) {
  const e = { kind, depth: dep, id: null, x0: 0, y0: 0, x1: 0, y1: 0, tier: 0, cond: 100, seg: 0, text: '', ref: null };
  staticEntries.push(e);
  return e;
}
const near = (ax, ay, bx, by, r) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by) < r * r;

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
  entry(K_FOUNTAIN, depth(CENTER.x, CENTER.y + 0.3));
  // ---- park prizes at their data positions ----
  const carousel = earnedPrizes().find(p => p.render === 'carousel');
  for (const p of earnedPrizes()) {
    if (p.render === 'banner') { const e = entry(K_BANNER, depth(p.position.x, p.position.y)); e.x0 = p.position.x; e.y0 = p.position.y; e.x1 = p.position.half_w; }
    else if (p.render === 'flower_beds') for (const [x, y] of p.positions) { const e = entry(K_FLOWER, depth(x, y + 0.001)); e.x0 = x; e.y0 = y; }
    else if (p.render === 'statues') p.positions.forEach(([x, y], i) => { const e = entry(K_STATUE, depth(x, y)); e.x0 = x; e.y0 = y; e.tier = i; });
    else if (p.render === 'lamp_posts') for (const [x, y] of p.positions) { const e = entry(K_LAMP, depth(x, y)); e.x0 = x; e.y0 = y; e.tier = 1; }
    else if (p.render === 'carousel') { const e = entry(K_CAROUSEL, depth(p.position.x, p.position.y + p.position.r)); e.x0 = p.position.x; e.y0 = p.position.y; e.x1 = p.position.r; }
  }
  // plaza furniture: planters on the diagonals (skipped where the carousel stands), benches facing the fountain, two lamps.
  for (const [dx, dy] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
    if (carousel && near(CENTER.x + dx, CENTER.y + dy, carousel.position.x, carousel.position.y, carousel.position.r + 0.15)) continue;
    const e = entry(K_BUSH, depth(CENTER.x + dx, CENTER.y + dy)); e.x0 = CENTER.x + dx; e.y0 = CENTER.y + dy;
  }
  for (const [dx, dy] of [[0, -0.9], [0, 0.9], [-0.9, 0], [0.9, 0]]) { const e = entry(K_BENCH, depth(CENTER.x + dx, CENTER.y + dy)); e.x0 = CENTER.x + dx; e.y0 = CENTER.y + dy; e.tier = dx === 0 ? 0 : 1; }
  for (const [dx, dy] of [[-1.15, -1.15], [1.15, 1.15]]) { const e = entry(K_LAMP, depth(CENTER.x + dx, CENTER.y + dy)); e.x0 = CENTER.x + dx; e.y0 = CENTER.y + dy; }
  // fixed facilities: every building (plaza ones and the strip cluster, office included) at its tier
  for (const f of DATA.facilities.facilities) {
    if (f.id === 'parking_lot') continue;
    facilityRect(f.id, facilityTier(f.id), rect);
    const e = entry(K_FACILITY, depth(rect.x0, rect.y1 - 0.02)); e.id = f.id; e.tier = facilityTier(f.id);
  }
  // lot lamp posts (lined & lit tiers): along the north kerb, and the south kerb too on the overflow tier
  facilityRect('parking_lot', facilityTier('parking_lot'), rect);
  const lamps = rect.lamps || 0;
  if (lamps > 0) {
    const top = Math.min(lamps, 4), bottom = lamps - top;
    for (let i = 0; i < top; i++) { const x = rect.x0 + 0.12 + (rect.x1 - rect.x0 - 0.24) * (top === 1 ? 0.5 : i / (top - 1)); const e = entry(K_LAMP, depth(x, rect.y0 - 0.06)); e.x0 = x; e.y0 = rect.y0 - 0.06; e.tier = 2; }
    for (let i = 0; i < bottom; i++) { const x = rect.x0 + 0.12 + (rect.x1 - rect.x0 - 0.24) * (bottom === 1 ? 0.5 : i / (bottom - 1)); const e = entry(K_LAMP, depth(x, rect.y1 + 0.04)); e.x0 = x; e.y0 = rect.y1 + 0.04; e.tier = 2; }
  }
  // tram stop shelter on the track (tier >= 1)
  if (facilityTier('park_tram') > 0) { const e = entry(K_TRAMSTOP, depth(L.TRAM.stop_x, L.TRAM.y + 0.16)); e.x0 = L.TRAM.stop_x; e.y0 = L.TRAM.y + 0.16; e.tier = facilityTier('park_tram'); }
  // Parcels: signs sit on the label tile; walls follow the OUTLINE EDGES of the tile set only, so two tiles of the
  // same parcel never get a wall between them and an L / plus / Z is fenced correctly at every concave corner.
  for (const p of parcelList()) {
    const g = parcelGeometry(p.id);
    // Sign post stands on the PATH beside the parcel (state.js parcelGeometry().sign), so its board can never be
    // lifted onto the pen behind it.
    const sx = g.sign.x, sy = g.sign.y;
    if (!p.owned) {
      // M4: a small FOR SALE stake on the parcel's front tile (depth-sorted like any scene sprite, so prizes and
      // pens draw past it); price + size live in the hover tooltip and a hover chip, not on a billboard.
      const [fx, fy] = g.front;
      const e = entry(K_SALE, depth(fx + 0.5, fy + 0.62)); e.id = p.id; e.x0 = fx + 0.5; e.y0 = fy + 0.62;
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
      // A boundary shared with another fenced pen is drawn ONCE, on the line itself, by the pen with the higher fence
      // tier (ties: the lower id). The other pen skips that edge, so two fences never stand side by side.
      const nid = parcelAtTile(ed.nx, ed.ny);
      const other = nid && nid !== p.id ? state.parcels[nid].enclosure : null;
      const shared = !!other;
      if (shared && (other.fence_tier > enc.fence_tier || (other.fence_tier === enc.fence_tier && nid < p.id))) continue;
      const inset = shared ? 0 : WALL_INSET;
      // Each parcel's wall is pulled WALL_INSET inside its own outline (and stretched by the same amount along the
      // edge so corners still meet) unless the edge is shared, where it sits exactly on the boundary.
      const inx = ed.side === 'w' ? inset : ed.side === 'e' ? -inset : 0;
      const iny = ed.side === 'n' ? inset : ed.side === 's' ? -inset : 0;
      const ex = (ed.x1 - ed.x0) * inset, ey = (ed.y1 - ed.y0) * inset;
      const x0 = ed.x0 + inx - ex, y0 = ed.y0 + iny - ey, x1 = ed.x1 + inx + ex, y1 = ed.y1 + iny + ey;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0;
        const bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
        // A north edge draws behind everything standing in its own tile; south and side edges draw at their
        // lower end so a dinosaur further back is occluded and one further forward is not.
        const dep = horiz ? depth(ax, ay + (ed.side === 'n' ? 0.001 : 0)) : depth(ax, Math.max(ay, by));
        wall(p.id, ax, ay, bx, by, enc, seg++, dep, shared);
      }
    }
  }
}
function hedge(x0, y0, x1, y1) { const e = entry(K_HEDGE, depth(x0, Math.max(y0, y1) + 0.002)); e.x0 = x0; e.y0 = y0; e.x1 = x1; e.y1 = y1; }
function wall(id, x0, y0, x1, y1, enc, seg, dep, shared) {
  const e = entry(K_WALL, dep);
  e.id = id; e.x0 = x0; e.y0 = y0; e.x1 = x1; e.y1 = y1; e.tier = enc.fence_tier; e.cond = enc.condition; e.seg = seg; e.ref = shared ? 'shared' : null;
}
// Wall segments in the last static build (for the layout check in tools/ and the console): { id, x0, y0, x1, y1, tier, shared }.
export const wallSegments = () => staticEntries.filter(e => e.kind === K_WALL).map(e => ({ id: e.id, x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, tier: e.tier, shared: e.ref === 'shared' }));

// ---- frame ----
function render(alpha) {
  const k = canvas.width / BASE_W;
  // Scene (ground, depth-sorted world, pen labels) draws under the camera; the HUD resets to base below.
  ctx.setTransform(k * cam.zoom, 0, 0, k * cam.zoom, k * cam.x, k * cam.y);
  ctx.lineJoin = 'round';
  drawGround();
  // gather + sort
  drawList.length = 0;
  for (let i = 0; i < staticEntries.length; i++) drawList.push(staticEntries[i]);
  for (const d of AG.dinos) { d.rx = d.px + (d.x - d.px) * alpha; d.ry = d.py + (d.y - d.py) * alpha; d.depth = depth(d.rx, d.ry); d.kind = K_DINO; drawList.push(d); }
  for (const v of AG.visitors) { if (!v.active) continue; v.rx = v.px + (v.x - v.px) * alpha + v.lx; v.ry = v.py + (v.y - v.py) * alpha + v.ly; v.depth = depth(v.rx, v.ry); v.kind = K_VISITOR; drawList.push(v); }
  for (const c of AG.cars) { if (!c.active) continue; c.rx = c.px + (c.x - c.px) * alpha; c.ry = c.py + (c.y - c.py) * alpha; c.depth = depth(c.rx, c.ry + 0.08); c.kind = K_CAR; drawList.push(c); }
  for (const s of AG.staff) { s.rx = s.px + (s.x - s.px) * alpha; s.ry = s.py + (s.y - s.py) * alpha; s.depth = depth(s.rx, s.ry); s.kind = K_STAFF; drawList.push(s); }
  if (AG.tram.active) { const t = AG.tram; t.rx = t.px + (t.x - t.px) * alpha; t.ry = t.y; t.depth = depth(t.rx, t.y + 0.12); t.kind = K_TRAM; drawList.push(t); }
  // M5: the delivery truck on the road and the crate it leaves at the gate.
  if (AG.truck.active) { const t = AG.truck; t.rx = t.px + (t.x - t.px) * alpha; t.ry = t.y; t.depth = depth(t.rx, t.y + 0.1); t.kind = K_TRUCK; drawList.push(t); if (t.crate) drawList.push(crateEntry); crateEntry.depth = depth(t.crateX, t.crateY + 0.05); }
  drawList.sort(byDepth);
  stats.entries = drawList.length; stats.sprites = drawList.length - staticEntries.length;
  for (let i = 0; i < drawList.length; i++) {
    const e = drawList[i];
    switch (e.kind) {
      case K_WALL: drawWall(e); break;
      case K_FACILITY: drawFacility(e); break;
      case K_SIGN: queueSign(e); break;
      case K_GATE: drawGate(); break;
      case K_FOUNTAIN: drawFountain(); break;
      case K_HEDGE: box(e.x0, e.y0, e.x1 === e.x0 ? e.x1 + 0.12 : e.x1, e.y1 === e.y0 ? e.y1 + 0.12 : e.y1, HEDGE_H, '#4f8a3e', '#3c6b2f', '#345d29', '#22401c'); break;
      case K_BUSH: drawPlanter(e); break;
      case K_BENCH: drawBench(e); break;
      case K_LAMP: drawLamp(e); break;
      case K_STAKE: drawStake(e); break;
      case K_SALE: drawSaleStake(e); break;
      case K_BANNER: drawBanner(e); break;
      case K_FLOWER: drawFlowerBed(e); break;
      case K_STATUE: drawStatue(e); break;
      case K_CAROUSEL: drawCarousel(e); break;
      case K_TRAMSTOP: drawTramStop(e); break;
      case K_VISITOR: drawVisitor(e); break;
      case K_CAR: drawCar(e); break;
      case K_DINO: drawDino(e); break;
      case K_STAFF: drawStaff(e); break;
      case K_TRAM: drawTram(e); break;
      case K_TRUCK: drawTruck(e); break;
      case K_CRATE: drawCrate(AG.truck); break;
    }
  }
  drawPuffs();
  // Labels last, and never inside the depth sort: signs, facility tags and pen chips are UI over the scene.
  drawPenLabels();
  flushLabels();
  ctx.setTransform(k, 0, 0, k, 0, 0); // HUD is fixed screen UI, not part of the zoom/pan
  drawHud();
}
const crateEntry = { kind: K_CRATE, depth: 0 };
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
// Paint a biome ground texture inside a parcel's shape: build the same polyomino path, then fill it
// with the biome's repeat pattern (scaled down so its cacti/reeds/trees read as ground detail) over
// the flat biome colour. No-op until the pattern has loaded.
function fillBiomeTexture(g, id) {
  const pat = biomePatterns[id];
  if (!pat) return;
  ctx.beginPath();
  for (const lp of g.loops) {
    for (let i = 0; i < lp.length; i++) { project(lp[i][0], lp[i][1], 0, P); if (i === 0) ctx.moveTo(P.x, P.y); else ctx.lineTo(P.x, P.y); }
    ctx.closePath();
  }
  try { pat.setTransform(new DOMMatrix([BIOME_TEX_SCALE, 0, 0, BIOME_TEX_SCALE, 0, 0])); } catch { /* older Safari: pattern draws at native scale */ }
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = BIOME_TEX_ALPHA;
  ctx.fillStyle = pat;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = smooth;
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
function ellipse3(x, y, z, rx, ry, fill, stroke) {
  project(x, y, z, P);
  ctx.beginPath(); ctx.ellipse(P.x, P.y, L.TW * rx, L.TH * ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
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

// Deterministic scatter points inside a world rect (speckle, sand, tufts): generated once per key, projected each frame.
const scatterCache = new Map();
function scatter(key, x0, y0, x1, y1, density) {
  let pts = scatterCache.get(key);
  if (pts) return pts;
  pts = [];
  let seed = 7;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const n = Math.round((x1 - x0) * (y1 - y0) * density);
  for (let i = 0; i < n; i++) pts.push({ x: x0 + rnd() * (x1 - x0), y: y0 + rnd() * (y1 - y0), k: rnd() });
  scatterCache.set(key, pts);
  return pts;
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
  // front parking lot (surface, footprint and stall marks all change with the parking tier)
  drawLot();
  // park ground + walkways from data
  quad(0, 0, PARK_W, PARK_H, 0, '#3f7a3f');
  for (const w of L.walkways) {
    const hw = w.w / 2;
    quad(Math.min(w.from[0], w.to[0]) - hw, Math.min(w.from[1], w.to[1]) - hw, Math.max(w.from[0], w.to[0]) + hw, Math.max(w.from[1], w.to[1]) + hw, 0, '#b8ab8c');
  }
  // tram track along the forecourt (tier >= 1)
  if (facilityTier('park_tram') > 0) {
    const t = L.TRAM;
    quad(t.x0 - 0.2, t.y - 0.1, t.x1 + 0.2, t.y + 0.1, 0, 'rgba(60,60,70,0.25)');
    for (const dy of [-0.05, 0.05]) quad(t.x0 - 0.2, t.y + dy - 0.008, t.x1 + 0.2, t.y + dy + 0.008, 0, '#6d7078');
  }
  // plaza paving
  quad(CENTER.x - PLAZA_HALF, CENTER.y - PLAZA_HALF, CENTER.x + PLAZA_HALF, CENTER.y + PLAZA_HALF, 0, '#cfc3a4', '#8d8368');
  quad(CENTER.x - PLAZA_HALF * 0.7, CENTER.y - PLAZA_HALF * 0.7, CENTER.x + PLAZA_HALF * 0.7, CENTER.y + PLAZA_HALF * 0.7, 0, '#bfb394');
  // parcels at their true tile-set footprint: one path per parcel built from its outline loops, so an L, plus or Z
  // is filled and outlined as one shape with no seam between its own tiles.
  for (const p of parcelList()) {
    const g = parcelGeometry(p.id);
    if (!p.owned) {
      // M4: unbought land is NEUTRAL scrub (biomes.json `unowned`): dry ground, stones and dry tufts, no biome
      // wash. The land type is chosen at purchase, so nothing here should suggest one.
      const un = unownedBiome();
      loopShape(g, 0, '#7c7a52', null);
      loopShape(g, 0, tint(un.color, 0.55), null);
      loopShape(g, 0, 'rgba(60,50,30,0.12)', null);
      drawScrub(p.id, g);
      ctx.setLineDash([5, 4]);
      loopShape(g, 0, null, lighten(un.color, 0.35));
      ctx.setLineDash([]);
    } else {
      const biome = parcelBiome(p.id) || unownedBiome();
      loopShape(g, 0, biome.color, '#2b3a2b');
      if (biomePatterns[biome.id]) fillBiomeTexture(g, biome.id); // texture supersedes the procedural marks
      else drawBiomeMarks(p.id, g, biome, 1);
      if (p.enclosure) drawPenFloor(p, g);
    }
    if (hover === p.id) loopShape(g, 0, 'rgba(255,255,255,0.12)', '#ffffff');
  }
  // facility pads (flat slabs under each building so a tier-0 pad reads as a reserved spot)
  for (const f of DATA.facilities.facilities) {
    if (f.id === 'parking_lot') continue;
    const m = L.facilities[f.id];
    quad(m.x0, m.y0, m.x1, m.y1, 0, hoverFacility === f.id ? '#d8d2c2' : '#a8a08a', '#6d6754');
  }
  if (hoverFacility === 'parking_lot') quad(AG.lotRect.x0, AG.lotRect.y0, AG.lotRect.x1, AG.lotRect.y1, 0, 'rgba(255,255,255,0.15)', '#ffffff');
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

// ---- the front lot, per tier ----
const LOT_SURFACE = {
  dirt: { fill: '#8a6a3e', edge: '#5d4728' },
  gravel: { fill: '#8d8b82', edge: '#5f5d55' },
  asphalt: { fill: '#4a4e58', edge: '#2b2e35' },
  lined: { fill: '#474b55', edge: '#2b2e35' },
  overflow: { fill: '#474b55', edge: '#2b2e35' }
};
function drawLot() {
  const lot = AG.lotRect;
  const surface = lot.surface || 'dirt';
  const S = LOT_SURFACE[surface] || LOT_SURFACE.dirt;
  const blocks = AG.lotBlockList.length ? AG.lotBlockList : [lot];
  const paved = surface === 'asphalt' || surface === 'lined' || surface === 'overflow';
  // entrance apron from the road up to the lot (a dirt track, or tarmac once paved)
  const ax = lot.x0 + (lot.x1 - lot.x0) * 0.5;
  quad(ax - 0.35, lot.y1, ax + 0.35, L.ROAD_Y - 0.14, 0, surface === 'dirt' ? '#7d6240' : surface === 'gravel' ? '#84827a' : '#41454f');
  if (blocks.length > 1) quad(lot.x0 - 0.06, lot.y0 - 0.06, lot.x1 + 0.06, lot.y1 + 0.06, 0, '#6f7378', '#2b2e35'); // kerb apron around a two-block lot
  for (const b of blocks) {
    quad(b.x0, b.y0, b.x1, b.y1, 0, b.overflow ? '#535866' : S.fill, S.edge);
    if (surface === 'dirt') {
      for (const s of scatter(`dirt${b.x0}${b.x1}`, b.x0 + 0.05, b.y0 + 0.05, b.x1 - 0.05, b.y1 - 0.05, 22)) {
        project(s.x, s.y, 0, P);
        if (s.k < 0.5) { ctx.fillStyle = 'rgba(60,40,20,0.25)'; ctx.fillRect(P.x - 3, P.y - 1, 6, 2); }
        else { ctx.fillStyle = '#9c7a4a'; ctx.fillRect(P.x - 1, P.y - 1, 2, 1.5); }
      }
    } else if (surface === 'gravel') {
      for (const s of scatter(`gravel${b.x0}${b.x1}`, b.x0 + 0.03, b.y0 + 0.03, b.x1 - 0.03, b.y1 - 0.03, 110)) {
        project(s.x, s.y, 0, P);
        ctx.fillStyle = s.k < 0.45 ? '#a9a79e' : s.k < 0.8 ? '#6e6c64' : '#c4c2b8';
        ctx.fillRect(P.x, P.y, 1.5, 1.5);
      }
    } else {
      // painted kerb line just inside the edge; a lined lot gets a bright one, a plain paved lot a faint one
      quad(b.x0 + 0.04, b.y0 + 0.04, b.x1 - 0.04, b.y1 - 0.04, 0, null, surface === 'asphalt' ? 'rgba(230,201,74,0.45)' : '#e6c94a');
      if (b.overflow) { project((b.x0 + b.x1) / 2, b.y0 + 0.1, 0, P); label('OVERFLOW', P.x, P.y + 3, 'rgba(241,240,230,0.55)', 'center', FONT_S); }
    }
  }
  // divider strip between the two blocks: kerb + a line of shrubs
  if (blocks.length > 1) {
    const a = blocks[0], c = blocks[1];
    quad(a.x1, lot.y0, c.x0, lot.y1, 0, '#4f7a3e', '#2b2e35');
    const n = Math.max(2, Math.round((lot.y1 - lot.y0) / 0.25));
    for (let i = 0; i < n; i++) ellipse3((a.x1 + c.x0) / 2, lot.y0 + 0.12 + (lot.y1 - lot.y0 - 0.24) * i / (n - 1), 0, 0.09, 0.1, '#3f6b30', '#22401c');
  }
  drawSlots(surface, paved);
  // lot sign at the entrance corner: "P" board with the tier label
  const t = facilityTierDef('parking_lot');
  line3(lot.x0 + 0.08, lot.y1 + 0.04, 0, lot.x0 + 0.08, lot.y1 + 0.04, 0.5, '#5a3d1e', 2);
  project(lot.x0 + 0.08, lot.y1 + 0.04, 0.5, P);
  queueTag(`P · ${t.label.toUpperCase()}`, P.x + 4, P.y - 2, OUT, paved ? '#f2f2f2' : '#f2c94c', 2);
}
function drawSlots(surface, paved) {
  if (surface === 'gravel') return; // gravel has no marked bays
  for (const s of AG.slots) {
    if (surface === 'dirt') { ellipse3(s.x, s.y + 0.02, 0, 0.1, 0.07, 'rgba(60,40,20,0.14)', null); continue; }
    if (surface === 'asphalt') { quad(s.x - 0.11, s.y - 0.08, s.x + 0.11, s.y + 0.08, 0, null, 'rgba(230,230,230,0.28)'); continue; }
    // lined & lit / overflow: bright painted bay lines (U shape open to the aisle)
    ctx.strokeStyle = '#ececec'; ctx.lineWidth = 1;
    project(s.x - 0.11, s.y - 0.08, 0, P); project(s.x - 0.11, s.y + 0.08, 0, Q); project(s.x + 0.11, s.y + 0.08, 0, R); project(s.x + 0.11, s.y - 0.08, 0, S);
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.lineTo(R.x, R.y); ctx.lineTo(S.x, S.y); ctx.stroke();
  }
  void paved;
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
  for (const [tx, ty] of g.tiles) for (let i = 0; i < 5; i++) pts.push({ x: tx + 0.12 + rnd() * 0.76, y: ty + 0.12 + rnd() * 0.76, k: rnd() });
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
// Biome ground marks (biomes.json `texture`): sand dots on desert, puddles and reed clumps on marsh, grass tufts on
// plains. Same marks in both ownership states (dimmer when unsold), so the biome reads without the legend.
const biomeCache = new Map();
function biomeMarks(id, g) {
  let pts = biomeCache.get(id);
  if (pts) return pts;
  pts = [];
  let seed = 99;
  for (let i = 0; i < id.length; i++) seed = (seed * 33 + id.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const [tx, ty] of g.tiles) for (let i = 0; i < 6; i++) pts.push({ x: tx + 0.1 + rnd() * 0.8, y: ty + 0.15 + rnd() * 0.75, k: rnd() });
  biomeCache.set(id, pts);
  return pts;
}
function drawBiomeMarks(id, g, biome, alpha) {
  const tex = biome.texture || 'grass';
  ctx.globalAlpha = alpha;
  for (const s of biomeMarks(id, g)) {
    project(s.x, s.y, 0, P);
    if (tex === 'sand') { ctx.fillStyle = s.k < 0.5 ? '#f3dc96' : '#c69b3c'; ctx.fillRect(P.x - 1.5, P.y - 0.5, 3, 1.5); }
    else if (tex === 'reeds') {
      if (s.k < 0.35) { ctx.fillStyle = 'rgba(70,140,170,0.7)'; ctx.beginPath(); ctx.ellipse(P.x, P.y, 5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.strokeStyle = '#1f5a48'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x - 1, P.y - 5); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + 1.5, P.y - 5.5); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + 0.3, P.y - 6.5); ctx.stroke(); }
    } else { ctx.strokeStyle = s.k < 0.5 ? '#4f8f22' : '#a9d85a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x - 1.5, P.y); ctx.lineTo(P.x - 0.5, P.y - 3); ctx.moveTo(P.x + 1.5, P.y); ctx.lineTo(P.x + 0.5, P.y - 3); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
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

// Greenery from planted seeds: a deterministic scatter of bush clumps per tile; the share drawn follows
// vegetation / cap, so a grazed pen visibly thins out and regrows.
const greenCache = new Map();
function greenery(id, g) {
  let pts = greenCache.get(id);
  if (pts) return pts;
  pts = [];
  let seed = 1234;
  for (let i = 0; i < id.length; i++) seed = (seed * 37 + id.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const [tx, ty] of g.tiles) for (let i = 0; i < 9; i++) pts.push({ x: tx + 0.08 + rnd() * 0.84, y: ty + 0.3 + rnd() * 0.62, k: rnd() });
  // shuffle so the drawn prefix is spread over the whole pen rather than filling tile by tile
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  greenCache.set(id, pts);
  return pts;
}
function drawGreenery(p, g) {
  const enc = p.enclosure;
  const cap = vegetationCap(p.id);
  let share = cap > 0 ? Math.min(1, (enc.vegetation || 0) / cap) : 0;
  // M5 (M4 minor a): a seeded pen keeps a visible floor of greenery (balance.vegetation.visible_floor x how much of
  // it is planted), so a freshly planted or heavily grazed pen reads as seeded-and-regrowing, never as bare.
  if ((enc.seeded || 0) > 0) share = Math.max(share, (DATA.balance.vegetation.visible_floor ?? 0) * plantedFraction(enc, p.id));
  if (share <= 0) return;
  const pts = greenery(p.id, g);
  const n = Math.round(pts.length * share);
  for (let i = 0; i < n; i++) {
    const s = pts[i];
    project(s.x, s.y, 0, P);
    const r = 2.2 + s.k * 1.6;
    ctx.fillStyle = s.k < 0.5 ? '#3f8a2a' : '#5fbf3a'; ctx.beginPath(); ctx.ellipse(P.x, P.y, r + 1, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = s.k < 0.5 ? '#6fd04a' : '#9ae06a'; ctx.beginPath(); ctx.ellipse(P.x - 0.6, P.y - 0.8, r * 0.6, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function drawPenFloor(p, g) {
  // worn patch over the whole tile set plus a food trough on the label tile, so a pen reads as lived-in
  loopShape(g, 0, 'rgba(0,0,0,0.08)', null);
  drawGreenery(p, g);
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
// M4 FOR SALE marker: a short post with a small yellow board, on the parcel itself. On hover the price chip appears
// beside it (queued through the label pass); the full price-per-biome breakdown is in the tooltip.
function drawSaleStake(e) {
  const h = 0.3;
  line3(e.x0, e.y0, 0, e.x0, e.y0, h, '#5a3d1e', 2);
  project(e.x0, e.y0, h, P);
  const w = 22, bh = 9;
  ctx.fillStyle = '#f2c94c'; ctx.fillRect(P.x - w / 2, P.y - bh + 2, w, bh);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(P.x - w / 2 + 0.5, P.y - bh + 2.5, w - 1, bh - 1);
  label('SALE', P.x, P.y + 0.5, OUT, 'center', '5px "Press Start 2P", monospace');
  if (hover === e.id) queueTag(`${shortShape(e.id)} from ${fmt$(parcelPriceFrom(e.id))}`, P.x, P.y - bh - 2, OUT, '#f2c94c', 2);
}
function drawPlanter(e) {
  box(e.x0 - 0.13, e.y0 - 0.13, e.x0 + 0.13, e.y0 + 0.13, 0.1, '#b9ad8e', '#9a8f74', '#867c64', OUT);
  box(e.x0 - 0.1, e.y0 - 0.1, e.x0 + 0.1, e.y0 + 0.1, 0.18, '#5c9a45', '#457a33', '#3a672b', '#22401c', 0.1);
}
function drawBench(e) {
  const w = e.tier === 0 ? 0.22 : 0.07, d = e.tier === 0 ? 0.07 : 0.22;
  box(e.x0 - w, e.y0 - d, e.x0 + w, e.y0 + d, 0.09, '#a97b4a', '#8a6238', '#74522f', '#2b1a0b');
  box(e.x0 - w, e.y0 - d, e.x0 + w, e.y0 - d + 0.03, 0.2, '#a97b4a', '#8a6238', '#74522f', '#2b1a0b', 0.09);
}
// tier 0: plaza lamp; 1: prize lamp post (taller, ornate double head); 2: lot lamp (tall, cool light)
function drawLamp(e) {
  const h = e.tier === 1 ? 0.72 : e.tier === 2 ? 0.8 : 0.62;
  line3(e.x0, e.y0, 0, e.x0, e.y0, h, e.tier === 1 ? '#2f3340' : '#4a4e58', 2);
  if (e.tier === 1) {
    box(e.x0 - 0.06, e.y0 - 0.06, e.x0 + 0.06, e.y0 + 0.06, 0.06, '#2f3340', '#23262f', '#1c1f27', OUT, 0);
    for (const dx of [-0.07, 0.07]) { line3(e.x0, e.y0, h - 0.06, e.x0 + dx, e.y0, h, '#2f3340', 1.5); box(e.x0 + dx - 0.045, e.y0 - 0.045, e.x0 + dx + 0.045, e.y0 + 0.045, 0.09, '#fff1b8', '#e0d089', '#c9b978', OUT, h); }
  } else if (e.tier === 2) {
    line3(e.x0, e.y0, h, e.x0 + 0.12, e.y0, h, '#4a4e58', 2);
    box(e.x0 + 0.06, e.y0 - 0.04, e.x0 + 0.18, e.y0 + 0.04, 0.05, '#e8f4ff', '#bcd4ea', '#9fbbd6', OUT, h - 0.02);
  } else box(e.x0 - 0.05, e.y0 - 0.05, e.x0 + 0.05, e.y0 + 0.05, 0.1, '#f6e9a8', '#e0d089', '#c9b978', OUT, 0.62);
}

// Fixed facility at its tier: bigger box per tier, extra roof sections, storeys and a style per tier from
// facilities.json `render`, plus a tag with the tier label. Every tier looks different from the one before.
function drawFacility(e) {
  facilityRect(e.id, e.tier, rect);
  const c = FACILITY_COLORS[e.id] || ['#8a8a8a', '#666', '#555'];
  const { x0, y0, x1, y1, z, roofs, storeys, style } = rect;
  const f = facilityById(e.id);
  const t = facilityTierDef(e.id, e.tier);
  const cx = (x0 + x1) / 2;
  if (e.tier === 0 && (roofs === 0 || storeys === 0) && style !== 'portable') { // empty pad: low slab with a marker post
    box(x0, y0, x1, y1, z * 0.5, '#bdb59d', '#8f886f', '#7a7460', OUT);
    line3(cx, y1 - 0.05, 0, cx, y1 - 0.05, 0.4, '#5a3d1e', 2);
    project(cx, y1 - 0.05, 0.4, P);
    queueTag(f.name.toUpperCase(), P.x, P.y - 2, OUT, '#f2c94c', 2);
    return;
  }
  if (style === 'portable') { // a row of three portable cabins
    const n = 3, w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) box(x0 + i * w + 0.02, y0, x0 + (i + 1) * w - 0.02, y1, z, '#8fb7ad', c[1], c[2], OUT);
    for (let i = 0; i < n; i++) vquad(x0 + i * w + w / 2 - 0.04, y1, x0 + i * w + w / 2 + 0.04, y1, 0, z * 0.6, OUT);
  } else if (style === 'cart') { // kiosk on wheels with a striped awning
    box(x0, y0, x1, y1, z, c[0], c[1], c[2], OUT);
    for (let i = 0; i < 4; i++) quad(x0 + (x1 - x0) * i / 4, y1 - 0.08, x0 + (x1 - x0) * (i + 0.5) / 4, y1 + 0.06, z, '#f1f0e6', OUT);
    quad(x0, y1 - 0.08, x1, y1 + 0.06, z, null, OUT);
    for (const wx of [x0 + 0.08, x1 - 0.08]) ellipse3(wx, y1 + 0.02, 0, 0.035, 0.05, '#2b2e35', OUT);
    vquad(x0 + 0.06, y1, x1 - 0.06, y1, z * 0.45, z * 0.85, '#1c2230', OUT); // serving hatch
  } else {
    box(x0, y0, x1, y1, z, c[0], c[1], c[2], OUT);
    // roof sections: a ridge per section, and a raised second roof / clerestory from 2 sections up
    const n = Math.max(1, roofs);
    for (let i = 1; i < n; i++) { const yy = y0 + (y1 - y0) * i / n; line3(x0, yy, z, x1, yy, z, 'rgba(0,0,0,0.3)', 1.5); }
    line3(x0, (y0 + y1) / 2, z, x1, (y0 + y1) / 2, z, 'rgba(0,0,0,0.25)', 1.5);
    if (n >= 2 && style !== 'tower') box(x0 + 0.12, y0 + 0.08, x1 - 0.12, y0 + (y1 - y0) * 0.45, 0.16, c[0], c[1], c[2], OUT, z);
    if (n >= 3 && style !== 'tower' && style !== 'museum') box(cx - 0.1, y0 + 0.1, cx + 0.1, y0 + 0.3, 0.14, '#f2c94c', '#c9a63b', '#a8892f', OUT, z + 0.16);
    // storey bands + a window row per storey on the front face
    for (let s = 1; s < storeys; s++) line3(x0, y1, z * s / storeys, x1, y1, z * s / storeys, 'rgba(0,0,0,0.35)', 1);
    const cols = Math.max(2, Math.round((x1 - x0) / 0.32));
    for (let s = 0; s < storeys; s++) {
      const zb = z * (s + 0.35) / storeys, zt = z * (s + 0.7) / storeys;
      for (let i = 0; i < cols; i++) {
        const wx = x0 + (x1 - x0) * (i + 0.5) / cols;
        if (s === 0 && Math.abs(wx - cx) < 0.12) continue; // door goes here
        vquad(wx - 0.05, y1, wx + 0.05, y1, zb, zt, style === 'tiled' ? '#dff3ff' : '#cfe3f5', OUT);
      }
    }
    // styles
    if (style === 'tiled') for (let i = 0; i < 6; i++) vquad(x0 + (x1 - x0) * i / 6, y1, x0 + (x1 - x0) * (i + 0.5) / 6, y1, 0.02, z * 0.28, i % 2 ? '#e9f4f7' : '#7fb8d8', null);
    if (style === 'pavilion') { quad(x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.12, z + 0.02, c[1], OUT); for (const wx of [x0 - 0.06, x1 + 0.06]) line3(wx, y1 + 0.08, 0, wx, y1 + 0.08, z, '#c9c4b8', 2); }
    if (style === 'diner') { vquad(x0, y1, x1, y1, z * 0.72, z * 0.9, '#f2c94c', OUT); vquad(x0 + 0.05, y1, x1 - 0.05, y1, z * 0.76, z * 0.86, '#e05c5c', null); }
    if (style === 'restaurant') { quad(x0 - 0.06, y1 - 0.02, x1 + 0.06, y1 + 0.1, z * 0.5, '#e05c5c', OUT); box(x1 - 0.18, y0 + 0.06, x1 - 0.08, y0 + 0.16, 0.16, '#5a4a48', '#463a38', '#3a302e', OUT, z); }
    if (style === 'emporium') { vquad(x0, y1, x1, y1, z * 0.8, z, '#f2c94c', OUT); for (let i = 0; i < 3; i++) vquad(x0 + 0.06 + i * 0.18, y1, x0 + 0.16 + i * 0.18, y1, z * 0.84, z * 0.96, '#e05c5c', null); }
    if (style === 'museum') { // columns and a pediment on the front
      const nc = 4;
      for (let i = 0; i < nc; i++) { const wx = x0 + 0.06 + (x1 - x0 - 0.12) * i / (nc - 1); line3(wx, y1 + 0.03, 0, wx, y1 + 0.03, z, '#f1f0e6', 3); }
      project(x0 - 0.02, y1 + 0.03, z, P); project(x1 + 0.02, y1 + 0.03, z, Q); project(cx, y1 + 0.03, z + 0.2, R);
      ctx.fillStyle = c[0]; ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.lineTo(R.x, R.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (style === 'tower') { // headquarters: clock tower with a flag
      box(x1 - 0.55, y0 + 0.08, x1 - 0.15, y0 + 0.48, 0.4, c[0], c[1], c[2], OUT, z);
      project(x1 - 0.35, y0 + 0.48, z + 0.28, P); ctx.fillStyle = '#f1f0e6'; ctx.beginPath(); ctx.arc(P.x, P.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke(); ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x, P.y - 3); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + 2, P.y); ctx.stroke();
      line3(x1 - 0.35, y0 + 0.28, z + 0.4, x1 - 0.35, y0 + 0.28, z + 0.68, '#2b2e35', 1.5);
      project(x1 - 0.35, y0 + 0.28, z + 0.68, P); ctx.fillStyle = '#e05c5c'; ctx.fillRect(P.x, P.y, 9, 5);
    }
    if (style === 'hospital') { vquad(cx - 0.12, y1, cx + 0.12, y1, z * 0.55, z * 0.95, '#f4f4f4', OUT); vquad(cx - 0.03, y1, cx + 0.03, y1, z * 0.6, z * 0.9, '#e05c5c', null); vquad(cx - 0.09, y1, cx + 0.09, y1, z * 0.71, z * 0.79, '#e05c5c', null); }
    if (style === 'shelter' || style === 'depot') { // tram shed: wide door and a tram-coloured stripe
      vquad(x0, y1, x1, y1, z * 0.62, z * 0.78, '#f2c94c', null);
      vquad(cx - 0.22, y1, cx + 0.22, y1, 0, z * 0.6, '#1c2230', OUT);
    }
    // door
    if (style !== 'shelter' && style !== 'depot') vquad(cx - 0.07, y1, cx + 0.07, y1, 0, z * 0.5 / Math.max(1, storeys), OUT);
  }
  // Forecourt strip buildings sit in two rows; the row nearer the viewer (larger y0) hangs its label at the door
  // on the ground, the back row on the roof, so at max tier neither row's label can cover the other's.
  const fm = L.facilities[e.id];
  const frontRow = fm && !fm.tiles && fm.y0 >= L.PARK_H + 1.2;
  if (frontRow) { project(cx, y1 + 0.16, 0, P); queueTag(t.label.toUpperCase(), P.x, P.y + 8, '#f1f0e6', 'rgba(16,20,28,0.75)', 2); }
  else { project(cx, y1, z + (roofs >= 2 ? 0.2 : 0.06) + (style === 'tower' ? 0.3 : 0), P); queueTag(t.label.toUpperCase(), P.x, P.y - 4, '#f1f0e6', 'rgba(16,20,28,0.75)', 2); }
  if (hoverFacility === e.id) { ctx.setLineDash([3, 2]); quad(x0 - 0.04, y0 - 0.04, x1 + 0.04, y1 + 0.04, 0, null, '#ffffff'); ctx.setLineDash([]); }
}

// ---- label pass: signs, facility tags and pen chips ----
// Everything readable is collected while the scene draws and painted afterwards, so no roof or pen wall can eat a
// price. A greedy pass then lifts any chip that lands on one already placed (front-most keeps its spot); if every
// preset slot is taken it scans further up and down until it finds free space, so no two chips ever overlap.
const labelQueue = [], labelBoxes = [];
// (dx in label widths, dy in 14px rows) tried in order when a label collides with one already placed.
const LABEL_SLOTS = [[0, 0], [0, -1], [0, -2], [0, 1], [0, 2], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -3], [0, 3], [-1, -2], [1, -2], [-1, 2], [1, 2], [-2, 0], [2, 0], [-2, -1], [2, -1], [-2, 1], [2, 1], [0, -4], [0, 4]];
// Placed label rectangles for the frame just drawn (used by the layout check in tools/, and handy in the console).
export const labelRects = () => labelBoxes.map(b => ({ ...b }));
// box (optional): a screen rect the label must stay inside (M5: pen chips clamp to their own pen, never a walkway).
function queueLabel(prio, x, y, w, h, draw, box = null) { labelQueue.push({ prio, x, y, w, h, draw, box }); }
function queueTag(text, sx, sy, fg, bg, prio, font = FONT_S, box = null) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 6;
  queueLabel(prio, sx, sy, w, 12, (x, y) => tag(text, x, y, fg, bg, font), box);
}
const inBox = (b, x0, y0, x1, y1) => !b || (x0 >= b.x0 - 0.5 && x1 <= b.x1 + 0.5 && y0 >= b.y0 - 0.5 && y1 <= b.y1 + 0.5);
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
    const b = it.box;
    const cxOf = dx => Math.max(it.w / 2 + 2, Math.min(BASE_W - it.w / 2 - 2, it.x + dx * (it.w * 0.55)));
    const cyOf = dy => Math.max(it.h + 2, Math.min(BASE_H - 2, y0 + dy * 14));
    // Candidates in order of preference: where it belongs, then lifted, then dropped, then stepped sideways.
    // A boxed label only takes a candidate that keeps it inside its box.
    for (const [dx, dy] of LABEL_SLOTS) {
      const cx = cxOf(dx), cy = cyOf(dy);
      if (!inBox(b, cx - it.w / 2, cy - it.h, cx + it.w / 2, cy)) continue;
      if (!blocker(cx - it.w / 2, cy - it.h, cx + it.w / 2, cy)) { x = cx; y = cy; placed = true; break; }
    }
    // Still blocked (a dense cluster): march up, then down, then sideways columns, one row at a time.
    if (!placed && !b) {
      outer: for (const dx of [0, -1, 1, -2, 2]) {
        const cx = cxOf(dx);
        for (let k = 5; k <= 30; k++) for (const sgn of [-1, 1]) {
          const cy = cyOf(sgn * k);
          if (!blocker(cx - it.w / 2, cy - it.h, cx + it.w / 2, cy)) { x = cx; y = cy; placed = true; break outer; }
        }
      }
    }
    // A boxed label with no free slot stays in its box (it may overlap another chip there, never spill out).
    if (!placed) { x = it.x; y = y0; if (b) { x = Math.max(b.x0 + it.w / 2, Math.min(b.x1 - it.w / 2, x)); y = Math.max(b.y0 + it.h, Math.min(b.y1, y)); if (b.x1 - b.x0 < it.w) x = (b.x0 + b.x1) / 2; } }
    labelBoxes.push({ x0: x - it.w / 2, y0: y - it.h, x1: x + it.w / 2, y1: y });
    it.draw(x, y);
  }
  labelQueue.length = 0;
}

// A parcel sign is one board on a post: FOR SALE / READY over the shape and price, with a biome swatch. Queued, not depth-sorted.
function queueSign(e) {
  project(e.x0, e.y0, 0, P);
  const gx = P.x, gy = P.y;
  project(e.x0, e.y0, 0.32, Q);
  const shape = shortShape(e.id);
  const biome = parcelBiome(e.id) || unownedBiome();
  const l2 = e.tier === 0 ? `${shape} from ${fmt$(parcelPriceFrom(e.id))}` : `${e.id} ${shape}`;
  ctx.font = FONT; const w1 = ctx.measureText(e.text).width;
  ctx.font = FONT_S; const w2 = ctx.measureText(l2).width;
  const w = Math.max(w1, w2) + 18, h = 24;
  queueLabel(3, Q.x, Q.y, w, h, (x, y) => {
    ctx.strokeStyle = '#5a3d1e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = e.tier === 0 ? '#f2c94c' : '#c9c4b8';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2 + 0.5, y - h + 0.5, w - 1, h - 1);
    // biome swatch on the board's left edge, so a sign says desert / marsh / plains at a glance
    ctx.fillStyle = biome.color; ctx.fillRect(x - w / 2 + 2, y - h + 2, 6, h - 4); ctx.strokeRect(x - w / 2 + 2.5, y - h + 2.5, 5, h - 5);
    label(e.text, x + 3, y - h + 11, OUT);
    label(l2, x + 3, y - 5, OUT, 'center', FONT_S);
  });
}

// Front gate: plain posts and lintel, the Fancy Gate Arch prize, or the Grand Entrance (twin towers, flags, gold fascia).
function drawGate() {
  const g = L.GATE, t = 0.14, PARK_H = L.PARK_H;
  const grand = prizeEarned('grand_entrance'), arch = !grand && prizeEarned('gate_arch');
  const h = grand ? 1.15 : arch ? 0.85 : 0.75;
  const pw = grand ? 0.28 : t;
  const stone = grand ? ['#e9dfc4', '#c9bea0', '#a89e84'] : ['#d8d2c2', '#b8b2a2', '#9a9486'];
  box(g.x - g.halfGap - pw, PARK_H - pw / 2, g.x - g.halfGap, PARK_H + pw / 2, h, stone[0], stone[1], stone[2], OUT);
  box(g.x + g.halfGap, PARK_H - pw / 2, g.x + g.halfGap + pw, PARK_H + pw / 2, h, stone[0], stone[1], stone[2], OUT);
  if (grand) {
    // gold fascia across the towers, flags on both, lit lanterns
    vquad(g.x - g.halfGap - pw, PARK_H, g.x + g.halfGap + pw, PARK_H, h * 0.66, h * 0.86, '#c9a63b', OUT);
    vquad(g.x - g.halfGap - pw + 0.04, PARK_H, g.x + g.halfGap + pw - 0.04, PARK_H, h * 0.7, h * 0.82, '#6b5c8a', null);
    for (const px of [g.x - g.halfGap - pw / 2, g.x + g.halfGap + pw / 2]) {
      line3(px, PARK_H, h, px, PARK_H, h + 0.35, '#2b2e35', 1.5);
      project(px, PARK_H, h + 0.35, P); ctx.fillStyle = '#e05c5c'; ctx.fillRect(P.x, P.y, 9, 5);
      box(px - 0.05, PARK_H - 0.05, px + 0.05, PARK_H + 0.05, 0.08, '#fff1b8', '#e0d089', '#c9b978', OUT, h * 0.5);
    }
    project(g.x, PARK_H, h * 0.72 + 0.03, P);
    queueTag('GRAND ENTRANCE', P.x, P.y, '#fff1b8', 'rgba(107,92,138,0.9)', 2, FONT);
  } else if (arch) {
    // carved arch: a curved lintel with finials and a painted sign
    project(g.x - g.halfGap - t / 2, PARK_H, h * 0.7, P); project(g.x + g.halfGap + t / 2, PARK_H, h * 0.7, Q); project(g.x, PARK_H, h + 0.22, R);
    ctx.fillStyle = '#8a6b3a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.quadraticCurveTo(R.x, R.y - 14, Q.x, Q.y); ctx.lineTo(Q.x, Q.y + 7); ctx.quadraticCurveTo(R.x, R.y - 6, P.x, P.y + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const px of [g.x - g.halfGap - t / 2, g.x + g.halfGap + t / 2]) { project(px, PARK_H, h + 0.06, P); ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(P.x, P.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    project(g.x, PARK_H, h * 0.78, P);
    queueTag('WELCOME', P.x, P.y, '#f2c94c', 'rgba(138,107,58,0.9)', 2, FONT);
  } else {
    vquad(g.x - g.halfGap - t, PARK_H, g.x + g.halfGap + t, PARK_H, h * 0.72, h + 0.12, '#6b5c8a', OUT);
    project(g.x, PARK_H, h * 0.72 + 0.03, P);
    queueTag('ENTRANCE', P.x, P.y, '#f2c94c', 'rgba(107,92,138,0.9)', 2, FONT);
  }
  if (goalDone('grand_park')) drawPlaque(g.x + g.halfGap + pw + 0.34, PARK_H + 0.02);
}
// M5 Grand Park plaque: a stone plinth with a gold board beside the gate, lit by two small lanterns.
function drawPlaque(x, y) {
  box(x - 0.16, y - 0.09, x + 0.16, y + 0.09, 0.22, '#c9c4b8', '#a9a498', '#8d8880', OUT);
  vquad(x - 0.14, y + 0.09, x + 0.14, y + 0.09, 0.24, 0.5, '#c9a63b', OUT);
  vquad(x - 0.12, y + 0.09, x + 0.12, y + 0.09, 0.27, 0.47, '#e6cf7a', null);
  for (const dx of [-0.2, 0.2]) box(x + dx - 0.03, y - 0.03, x + dx + 0.03, y + 0.03, 0.06, '#fff1b8', '#e0d089', '#c9b978', OUT, 0.22);
  // The name tag hangs under the plinth on the ground row (the gold board above already reads as a plaque), at a
  // lower priority than facility labels so it steps aside instead of stacking with the tram and hall tags.
  project(x, y + 0.12, 0, P);
  queueTag('GRAND PARK', P.x, P.y + 12, '#2b1a0b', '#e6cf7a', 3, FONT_S);
}
export const plaqueVisible = () => goalDone('grand_park');

// Our own centrepiece: a round fountain with a stone long-neck dinosaur sculpture. Prize levels: 1 wider basin and
// a raised second bowl, 2 eight jets and lit water, 3 a tall central cascade with gold trim on a proper plinth.
function drawFountain() {
  const c = L.CENTER, lvl = fountainLevel();
  const r = L.FOUNTAIN_R * (lvl >= 1 ? 1.22 : 1);
  const t = AG.simTime;
  ellipse3(c.x, c.y, 0, r, r, lvl >= 3 ? '#a89a6a' : '#8d8368', OUT);
  if (lvl >= 3) ellipse3(c.x, c.y, 0, r * 0.94, r * 0.94, null, '#f2c94c');
  ellipse3(c.x, c.y - 0.04, 0, r * 0.8, r * 0.8, lvl >= 2 ? '#62a8ec' : '#4f8fd6', null);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  project(c.x, c.y - 0.04, 0, P);
  const jets = lvl >= 2 ? 8 : 4;
  for (let k = 0; k < jets; k++) { const a = t * 1.5 + k * (6.283 / jets); ctx.fillRect(P.x + Math.cos(a) * L.TW * r * 0.55 - 1, P.y + Math.sin(a) * L.TH * r * 0.55, 3, 2); }
  if (lvl >= 2) for (let k = 0; k < jets; k++) { const a = k * (6.283 / jets); const jx = c.x + Math.cos(a) * r * 0.62, jy = c.y + Math.sin(a) * r * 0.62; line3(jx, jy, 0, jx, jy, 0.16 + 0.05 * Math.sin(t * 5 + k), 'rgba(220,240,255,0.85)', 2); }
  if (lvl >= 1) { // raised second bowl
    box(c.x - 0.06, c.y - 0.06, c.x + 0.06, c.y + 0.06, 0.16, '#b5b0a4', '#a9a498', '#8d8880', OUT);
    ellipse3(c.x, c.y, 0.16, r * 0.42, r * 0.42, lvl >= 3 ? '#c9b25c' : '#a9a498', OUT);
    ellipse3(c.x, c.y - 0.02, 0.16, r * 0.34, r * 0.34, '#7cbcf2', null);
  }
  const pz = lvl >= 1 ? 0.16 : 0;
  const plinth = lvl >= 3 ? 0.32 : 0.22;
  box(c.x - 0.08, c.y - 0.08, c.x + 0.08, c.y + 0.08, plinth, lvl >= 3 ? '#e6cf7a' : '#c9c4b8', lvl >= 3 ? '#c9a63b' : '#a9a498', lvl >= 3 ? '#a8892f' : '#8d8880', OUT, pz);
  if (lvl >= 3) { // tall central cascade
    const hz = pz + plinth + 0.55 + 0.05 * Math.sin(t * 4);
    line3(c.x, c.y, pz + plinth, c.x, c.y, hz, 'rgba(220,240,255,0.9)', 3);
    project(c.x, c.y, hz, P); ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let k = 0; k < 5; k++) ctx.fillRect(P.x - 8 + k * 4, P.y + 2 + (k % 2) * 3, 2, 2);
  }
  // sculpture: body, neck, head, tail in stone grey
  project(c.x, c.y, pz + plinth, Q);
  ctx.fillStyle = lvl >= 3 ? '#c9c2b0' : '#b5b0a4'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(Q.x, Q.y - 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(Q.x + 6, Q.y - 8); ctx.quadraticCurveTo(Q.x + 14, Q.y - 14, Q.x + 12, Q.y - 26); ctx.lineTo(Q.x + 9, Q.y - 26); ctx.quadraticCurveTo(Q.x + 9, Q.y - 12, Q.x + 3, Q.y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(Q.x + 11, Q.y - 27, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(Q.x - 8, Q.y - 8); ctx.lineTo(Q.x - 20, Q.y - 12); ctx.lineTo(Q.x - 8, Q.y - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const lx of [-5, 4]) { ctx.fillRect(Q.x + lx, Q.y - 3, 3, 4); }
}

// ---- park prizes ----
function drawBanner(e) {
  const hw = e.x1, h = 0.72;
  for (const px of [e.x0 - hw, e.x0 + hw]) line3(px, e.y0, 0, px, e.y0, h, '#5a3d1e', 2);
  vquad(e.x0 - hw, e.y0, e.x0 + hw, e.y0, h * 0.62, h * 0.92, '#e05c5c', OUT);
  project(e.x0, e.y0, h * 0.78, P);
  label('WELCOME', P.x, P.y + 3, '#fff1b8', 'center', FONT_S);
}
function drawFlowerBed(e) {
  ellipse3(e.x0, e.y0, 0, 0.13, 0.11, '#4a3320', OUT);
  ellipse3(e.x0, e.y0, 0, 0.11, 0.09, '#3f7a2e', null);
  const cols = ['#e05c5c', '#f2c94c', '#e08fd0', '#f0f0e8', '#ff9d4d'];
  for (let i = 0; i < 6; i++) { const a = i * 1.047; project(e.x0 + Math.cos(a) * 0.07, e.y0 + Math.sin(a) * 0.055, 0.02, P); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(P.x - 1.5, P.y - 1.5, 3, 3); }
}
function drawStatue(e) {
  box(e.x0 - 0.12, e.y0 - 0.1, e.x0 + 0.12, e.y0 + 0.1, 0.16, '#b9ad8e', '#9a8f74', '#867c64', OUT);
  project(e.x0, e.y0, 0.16, Q);
  const dir = e.tier === 0 ? 1 : -1;
  ctx.fillStyle = '#a8a39a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(Q.x, Q.y - 5, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(Q.x + dir * 4, Q.y - 6); ctx.lineTo(Q.x + dir * 9, Q.y - 16); ctx.lineTo(Q.x + dir * 6, Q.y - 16); ctx.lineTo(Q.x + dir * 2, Q.y - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(Q.x + dir * 8, Q.y - 17, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(Q.x - dir * 5, Q.y - 6); ctx.lineTo(Q.x - dir * 13, Q.y - 9); ctx.lineTo(Q.x - dir * 5, Q.y - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const lx of [-4, 2]) ctx.fillRect(Q.x + lx, Q.y - 3, 2.5, 3);
}
function drawCarousel(e) {
  const r = e.x1, t = AG.simTime;
  ellipse3(e.x0, e.y0, 0, r, r, '#c9a63b', OUT);
  ellipse3(e.x0, e.y0, 0.06, r * 0.92, r * 0.92, '#e8d9a0', OUT);
  line3(e.x0, e.y0, 0.06, e.x0, e.y0, 0.62, '#8a6b3a', 3);
  const n = 6;
  for (let i = 0; i < n; i++) { const a = t * 0.9 + i * 6.283 / n; const px = e.x0 + Math.cos(a) * r * 0.62, py = e.y0 + Math.sin(a) * r * 0.62; line3(px, py, 0.06, px, py, 0.5, '#c9c4b8', 1); const zz = 0.2 + 0.05 * Math.sin(t * 3 + i); box(px - 0.05, py - 0.03, px + 0.05, py + 0.03, 0.07, ['#e05c5c', '#6fcf6a', '#5aa0e0', '#f2c94c', '#e08fd0', '#ff9d4d'][i], '#7a5a30', '#5a4020', OUT, zz); }
  // canopy: striped cone
  project(e.x0, e.y0, 0.5, P); project(e.x0, e.y0, 0.8, R);
  for (let i = 0; i < 12; i++) { const a0 = i * 6.283 / 12, a1 = (i + 1) * 6.283 / 12; ctx.fillStyle = i % 2 ? '#e05c5c' : '#f1f0e6'; ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(R.x, R.y); ctx.lineTo(P.x + Math.cos(a0) * L.TW * r, P.y + Math.sin(a0) * L.TH * r); ctx.lineTo(P.x + Math.cos(a1) * L.TW * r, P.y + Math.sin(a1) * L.TH * r); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(R.x, R.y - 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
// Tram stop shelter beside the track (posts + roof + a bench), with a "TRAM" sign.
function drawTramStop(e) {
  const x0 = e.x0 - 0.4, x1 = e.x0 + 0.4, y0 = e.y0 - 0.02, y1 = e.y0 + 0.16;
  for (const [px, py] of [[x0, y1], [x1, y1], [x0, y0], [x1, y0]]) line3(px, py, 0, px, py, 0.42, '#5aa0b5', 2);
  quad(x0 - 0.04, y0 - 0.04, x1 + 0.04, y1 + 0.04, 0.42, '#3f7d90', OUT);
  box(x0 + 0.08, y1 - 0.06, x1 - 0.08, y1 - 0.01, 0.1, '#a97b4a', '#8a6238', '#74522f', '#2b1a0b');
  project(x0 - 0.06, y1, 0.42, P);
  queueTag('TRAM', P.x, P.y - 2, '#f1f0e6', '#3f7d90', 3);
}
function drawTram(t) {
  const n = t.cars, w = 0.15, hh = 0.07;
  for (let i = 0; i < n; i++) {
    const cx = t.rx - t.dir * i * 0.36;
    const x0 = cx - w, x1 = cx + w, y0 = t.y - hh, y1 = t.y + hh;
    const col = i === 0 ? '#5aa0b5' : '#f2c94c';
    box(x0, y0, x1, y1, 0.12, col, shade(col), shade(col), OUT);
    box(x0 + 0.02, y0 + 0.01, x1 - 0.02, y1 - 0.01, 0.2, i === 0 ? '#3f7d90' : '#c9a63b', '#bfdcf0', '#9fbbd6', OUT, 0.12);
    for (const wx of [x0 + 0.06, x1 - 0.06]) ellipse3(wx, y1 + 0.01, 0, 0.03, 0.04, '#2b2e35', OUT);
    if (i > 0) line3(x1 + (t.dir > 0 ? 0 : -2 * w), t.y, 0.08, x1 + (t.dir > 0 ? 0.06 : -2 * w - 0.06), t.y, 0.08, '#2b2e35', 2);
  }
}

function badge(sx, sy) {
  ctx.fillStyle = '#e05c5c'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  label('!', sx, sy + 3, '#ffffff', 'center', FONT_S);
}
// Unhappy (wrong biome) badge: an orange disc with a frown, so it never reads as the red sick "!".
function unhappyBadge(sx, sy) {
  ctx.fillStyle = '#ff9d4d'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = OUT; ctx.fillRect(sx - 2.5, sy - 2, 1.5, 1.5); ctx.fillRect(sx + 1, sy - 2, 1.5, 1.5);
  ctx.beginPath(); ctx.arc(sx, sy + 3.2, 2.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
}

// ---- agents ----
function shadow(sx, sy, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sx, sy, w, w * 0.45, 0, 0, Math.PI * 2); ctx.fill();
}
function person(sx, sy, shirt, hat) {
  shadow(sx, sy, 3.5);
  ctx.fillStyle = '#2b2f3a'; ctx.fillRect(sx - 2.5, sy - 4, 2, 4); ctx.fillRect(sx + 0.5, sy - 4, 2, 4);
  ctx.fillStyle = shirt; ctx.fillRect(sx - 3, sy - 10, 6, 7);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(sx - 3 + 0.5, sy - 10 + 0.5, 5, 6);
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
  box(x0, y0, x1, y1, 0.09, col, shade(col), shade(col), OUT);
  box(x0 + 0.05, y0 + 0.01, x1 - 0.05, y1 - 0.01, 0.15, '#bfdcf0', shade(col), shade(col), OUT);
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
// Phase 3: draw the species' pixel-art sprite, feet on the ground point, mirrored to face the
// travel direction. Preserves the shadow, wander/idle/starving bob, the crate pop-in scale, and
// every status badge. Falls back to drawDinoShape until the image has loaded.
function drawDino(d) {
  if (d.arriving) return; // still in the delivery truck (M5)
  const spr = dinoSprites.get(d.sp.id);
  if (!spr || !spr.ready) { drawDinoShape(d); return; }
  project(d.rx, d.ry, 0, P);
  const Lv = DATA.balance.living;
  const popK = d.pop > 0 ? Math.min(1, (d.popT || 0) / d.pop) : 1;
  const popScale = d.pop > 0 ? (popK < 0.7 ? 0.2 + 1.15 * (popK / 0.7) : 1.35 - 0.35 * ((popK - 0.7) / 0.3)) : 1;
  const scale = (Lv.sprite_scale ?? 1) * popScale;
  const w = spr.w * scale, h = spr.h * scale;
  const starving = d.d.hunger >= DATA.balance.dinosaur.hunger_max;
  const bob = d.moving ? Math.abs(Math.sin(d.phase)) * 1.5 : starving ? Math.sin(d.phase * ((Lv.dino_starving_bob_hz || 0.45) / (Lv.dino_bob_hz || 1.4))) * (Lv.dino_starving_bob_px || 1.6) : Math.sin(d.phase * 0.5) * 0.6;
  const sx = P.x, sy = P.y - bob;
  shadow(P.x, P.y, w * 0.42);
  const flip = (d.dir >= 0) !== (spr.face === 'right'); // mirror when art facing != travel facing
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(sx, sy);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(spr.img, -w / 2, -h, w, h); // centred, feet on the ground point
  ctx.restore();
  d.labelY = sy - h - 8 - (d.size === 'large' ? 4 : 0);
  const wrongBiome = !d.escaped && biomeFit(d.sp, state.parcels[d.parcel]?.biome) === 'wrong';
  if (d.d.sick_days > 0 || d.d.health < 50) { badge(sx, d.labelY + 2); if (wrongBiome) unhappyBadge(sx + 11, d.labelY + 2); }
  else if (wrongBiome) unhappyBadge(sx, d.labelY + 2);
  if (d.d.hunger >= Lv.dino_hungry_threshold && !(d.d.sick_days > 0 || d.d.health < 50)) { label('z', sx + w * 0.4, sy - h - 2, '#f2c94c', 'center', FONT_S); }
}
// Bigger placeholder dinosaurs with a dark outline pass so they read against any pen colour. A starving animal
// keeps a slow, deep breathing bob and a drooped head (balance.living.dino_starving_bob_*): never a frozen sprite.
function drawDinoShape(d) {
  if (d.arriving) return; // still in the delivery truck (M5)
  project(d.rx, d.ry, 0, P);
  const Lv = DATA.balance.living;
  const SC = Lv.dino_sprite_scale;
  // Pop-in after the crate opens: an overshooting scale-up over pop_seconds.
  const popK = d.pop > 0 ? Math.min(1, (d.popT || 0) / d.pop) : 1;
  const popScale = d.pop > 0 ? (popK < 0.7 ? 0.2 + 1.15 * (popK / 0.7) : 1.35 - 0.35 * ((popK - 0.7) / 0.3)) : 1;
  const size = (SC[d.size] ?? SC.medium) * popScale;
  const w = 6 * size, h = 3.6 * size;
  const starving = d.d.hunger >= DATA.balance.dinosaur.hunger_max;
  const bob = d.moving ? Math.abs(Math.sin(d.phase)) * 1.5 : starving ? Math.sin(d.phase * ((Lv.dino_starving_bob_hz || 0.45) / (Lv.dino_bob_hz || 1.4))) * (Lv.dino_starving_bob_px || 1.6) : Math.sin(d.phase * 0.5) * 0.6;
  const sx = P.x, sy = P.y - bob;
  const dir = d.dir;
  shadow(P.x, P.y, w * 0.9);
  const nx = sx + dir * w * 0.8, ny = sy - h * 1.6 - (d.size === 'large' ? h * 0.9 : h * 0.3) + (starving ? h * 0.7 : 0);
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
  const wrongBiome = !d.escaped && biomeFit(d.sp, state.parcels[d.parcel]?.biome) === 'wrong';
  if (d.d.sick_days > 0 || d.d.health < 50) { badge(sx, d.labelY + 2); if (wrongBiome) unhappyBadge(sx + 11, d.labelY + 2); }
  else if (wrongBiome) unhappyBadge(sx, d.labelY + 2);
  if (d.d.hunger >= Lv.dino_hungry_threshold && !(d.d.sick_days > 0 || d.d.health < 50)) { label('z', sx + w, sy - h * 2.4, '#f2c94c', 'center', FONT_S); }
}
// One sign per pen (species and head count) on the front fence, instead of a tag over every animal: two Triceratops
// used to draw two stacked labels that spilled over the north wall onto the walkway crowd. Large species always,
// any pen on hover (balance.living.dino_label_always). An escaped dinosaur keeps a tag that follows it.
const penLabels = new Map();
const stackBoxes = []; // one entry per pen chip stack as placed by drawPenLabels (before the label-slot pass)
export const penLabelStacks = () => stackBoxes.map(b => ({ ...b }));
function drawPenLabels() {
  const always = DATA.balance.living.dino_label_always || [];
  penLabels.clear();
  for (const d of AG.dinos) {
    if (d.escaped) { project(d.rx, d.ry, 0, P); queueTag(d.sp.name.toUpperCase(), P.x, d.labelY ?? P.y - 30, '#f2c94c', 'rgba(16,20,28,0.85)', 0); continue; }
    if (d.arriving) continue; // still in the delivery truck: the chip would spoil the arrival
    if (!(always.includes(d.size) || hover === d.parcel)) continue;
    let m = penLabels.get(d.parcel);
    if (!m) { m = new Map(); penLabels.set(d.parcel, m); }
    m.set(d.name, (m.get(d.name) || 0) + 1);
  }
  // M5 (M4 minor d): chips stack on the pen's own front tile and are clamped to the pen's screen box, so a stack
  // never sits over a walkway or the plaza. The box runs from the top of the back wall to the front edge.
  // Interlocking pens (tetris shapes) can put two front tiles on the same row, so their stacks would abut and read as
  // one block. Each stack is placed as a unit: if it sits within `gap` px of a stack already placed, it is pushed
  // sideways away from that neighbour inside its own box, or lifted above it when there is no room.
  const gap = DATA.balance.living.pen_label_stack_gap_px ?? 14;
  const placed = stackBoxes; placed.length = 0;
  for (const [id, m] of penLabels) {
    const g = parcelGeometry(id);
    const bb = g.bbox;
    project(bb.x0, bb.y0, FENCE_H, Q); project(bb.x1, bb.y1, 0, R);
    const box = { x0: Math.min(Q.x, R.x - (bb.y1 - bb.y0) * L.SHEAR), y0: Q.y, x1: R.x, y1: R.y - 1 };
    const [fx, fy] = g.front;
    project(fx + 0.5, fy + 0.94, 0, P);
    // A name wider than the pen (a 1x1 tile is 66px) is shortened to fit: "PSITTACOS." rather than spilling over the path.
    const maxW = box.x1 - box.x0;
    const texts = [...m].map(([name, n]) => fitName(n > 1 ? `${name.toUpperCase()} x${n}` : name.toUpperCase(), maxW));
    ctx.font = FONT_S;
    const w = Math.max(...texts.map(t => ctx.measureText(t).width + 6));
    const hgt = texts.length * 13;
    // Clamp the stack into its own box first (a front tile at the pen's edge puts the chip's natural centre so close
    // to the fence that the slot pass would otherwise shove it sideways, into the neighbour's stack).
    let cx = Math.max(box.x0 + w / 2 + 2, Math.min(box.x1 - w / 2 - 2, P.x)), y = P.y - 1;
    for (const o of placed) {
      const x0 = cx - w / 2, x1 = cx + w / 2, y0 = y - hgt, y1 = y;
      if (x0 >= o.x1 + gap || x1 <= o.x0 - gap || y0 >= o.y1 + 4 || y1 <= o.y0 - 4) continue;
      const right = o.x1 + gap + w / 2, left = o.x0 - gap - w / 2;
      if (cx >= (o.x0 + o.x1) / 2 && right <= box.x1 - 2) cx = right;
      else if (left >= box.x0 + 2) cx = left;
      else if (right <= box.x1 - 2) cx = right;
      else if (o.y0 - 4 - hgt >= box.y0 + 2) y = o.y0 - 4;
    }
    placed.push({ id, x0: cx - w / 2, x1: cx + w / 2, y0: y - hgt, y1: y, shifted: cx !== P.x || y !== P.y - 1 });
    for (const t of texts) { queueTag(t, cx, y, '#f1f0e6', 'rgba(16,20,28,0.75)', 1, FONT_S, box); y -= 13; }
  }
}
function fitName(text, maxW) {
  ctx.font = FONT_S;
  if (ctx.measureText(text).width + 6 <= maxW) return text;
  const m = text.match(/^(.*?)( x\d+)?$/);
  let base = m[1], suffix = m[2] || '';
  while (base.length > 3 && ctx.measureText(`${base}.${suffix}`).width + 6 > maxW) base = base.slice(0, -1);
  return `${base}.${suffix}`;
}
// Pen chips placed in the last frame, for the layout check: { id -> [rects] } is not tracked; labelRects() lists all.
export const penLabelBoxes = () => { const out = {}; for (const id of penLabels.keys()) { const g = parcelGeometry(id), bb = g.bbox; project(bb.x0, bb.y0, FENCE_H, Q); project(bb.x1, bb.y1, 0, R); out[id] = { x0: Math.min(Q.x, R.x - (bb.y1 - bb.y0) * L.SHEAR), y0: Q.y, x1: R.x, y1: R.y - 1 }; } return out; };

// M5: delivery truck (cab + box body on the road), the crate at the gate, and dust puffs.
// Sized so it reads on the road (about a tile long, taller than a car) with a striped livery and a DINO board.
function drawTruck(t) {
  const y0 = t.y - 0.1, y1 = t.y + 0.1;
  const x0 = t.rx - 0.46, x1 = t.rx + 0.46;
  box(x0, y0, x1 - 0.24, y1, 0.32, '#e8e2d0', '#c9c2ae', '#a9a292', OUT);           // cargo box
  vquad(x0 + 0.02, y1, x1 - 0.26, y1, 0.1, 0.16, '#6b5c8a', null);                   // livery stripe
  box(x1 - 0.24, y0 + 0.01, x1, y1 - 0.01, 0.18, '#d84a4a', shade('#d84a4a'), shade('#d84a4a'), OUT); // cab
  vquad(x1 - 0.21, y1 - 0.01, x1 - 0.04, y1 - 0.01, 0.08, 0.17, '#bfdcf0', OUT);   // cab window
  for (const wx of [x0 + 0.1, x1 - 0.3, x1 - 0.08]) ellipse3(wx, y1 + 0.01, 0, 0.045, 0.055, '#2b2e35', OUT);
  project((x0 + x1 - 0.24) / 2, y1, 0.2, P);
  label('DINO', P.x, P.y + 3, '#6b5c8a', 'center', '6px "Press Start 2P", monospace');
}
function drawCrate(t) {
  const x = t.crateX, y = t.crateY, hw = 0.11;
  box(x - hw, y - 0.08, x + hw, y + 0.08, 0.16, '#b8894a', '#8f6a38', '#74522f', '#2b1a0b');
  line3(x - hw, y + 0.08, 0.02, x + hw, y + 0.08, 0.14, '#5a3d1e', 1.5);
  line3(x - hw, y + 0.08, 0.14, x + hw, y + 0.08, 0.02, '#5a3d1e', 1.5);
  project(x, y + 0.08, 0.16, P);
  label('!', P.x, P.y - 6, '#f2c94c', 'center', FONT_S);
}
function drawPuffs() {
  for (const p of AG.puffs) {
    const k = p.t / p.life;
    project(p.x + p.vx * k, p.y, p.vz * k, P);
    const r = p.r * (0.6 + 1.2 * k);
    ctx.fillStyle = `rgba(226,214,180,${(1 - k) * 0.75})`;
    ctx.beginPath(); ctx.ellipse(P.x, P.y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
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
  else if (AG.truck.active && AG.truck.phase !== 'out') { // delivery cue: the truck is small on the road, this is not
    const t = `DELIVERY: ${(AG.truck.name || 'DINOSAUR').toUpperCase()} AT THE GATE`;
    ctx.fillStyle = 'rgba(16,20,28,0.7)'; ctx.fillRect(BASE_W / 2 - t.length * 4 - 6, 6, t.length * 8 + 12, 16);
    label(t, BASE_W / 2, 18, '#f2c94c', 'center');
  }
  drawZoomControls();
}
// Zoom controls, bottom-right: [-] [R] [+]. Rects saved (fixed screen space) for click hit-testing.
function drawZoomControls() {
  const bw = 22, bh = 20, gap = 5, ry = BASE_H - 8 - bh;
  const specs = [['out', '-', BASE_W - 8 - bw * 3 - gap * 2], ['reset', 'R', BASE_W - 8 - bw * 2 - gap], ['in', '+', BASE_W - 8 - bw]];
  for (const [key, glyph, rx] of specs) {
    const dim = key === 'in' ? cam.zoom >= ZOOM_MAX - 1e-6 : cam.zoom <= ZOOM_MIN + 1e-6;
    ctx.fillStyle = dim ? 'rgba(16,20,28,0.4)' : 'rgba(16,20,28,0.72)';
    ctx.fillRect(rx, ry, bw, bh);
    ctx.strokeStyle = 'rgba(241,240,230,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(rx + 0.5, ry + 0.5, bw - 1, bh - 1);
    label(glyph, rx + bw / 2, ry + bh / 2 + 3, dim ? 'rgba(241,240,230,0.5)' : '#f1f0e6', 'center', FONT_S);
    zoomBtns[key] = { x0: rx, y0: ry, x1: rx + bw, y1: ry + bh };
  }
}
