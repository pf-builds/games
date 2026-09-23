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
import { DATA, state, parcelList, parcelDef, parcelGeometry, parcelAtTile, biomeById, parcelBiome, unownedBiome, fenceByTier, facilityTier, facilityById, facilityTierDef, facilityNextTier, prizeEarned, earnedPrizes, fmt$, onChange, biomeFit, speciesById } from '../state.js';
import { BASE_W, BASE_H, L, project, unproject, depth, parcelAtWorld, facilityRect, facilityAtWorld } from './projection.js';
import * as AG from '../sim/agents.js';
import { shortShape } from './park.js';
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
// Cute & colourful buildings: light saturated WALLS [top, front, side] + a bright distinct ROOF
// [slope, gable-side]. Walls read clean and friendly; the bright gabled roof makes each one a little
// storybook house. Roofs are colour-coded so a facility is recognisable at a glance.
const FACILITY_COLORS = {
  restrooms:      ['#bfe6dd', '#9fcfc4', '#84b3a8'], food_stand:  ['#f4dcae', '#e6c88e', '#cdac6e'], gift_shop: ['#e0cbf4', '#c8ace4', '#ac8fce'],
  office:         ['#cdd6e6', '#adb9ce', '#8f9cb4'], visitor_center: ['#f4e2b6', '#e2c98e', '#c8ac6e'], vet_clinic: ['#f6f8fb', '#e2e7ee', '#c6cede'], park_tram: ['#c2e4f0', '#9fcede', '#82b4ca']
};
const FACILITY_ROOF = {
  restrooms: ['#33a08c', '#277d6e'], food_stand: ['#e85440', '#c23e30'], gift_shop: ['#9b4fc4', '#7c3ba0'],
  office: ['#4f74ac', '#3c5a8a'], visitor_center: ['#f0922e', '#c67322'], vet_clinic: ['#e85440', '#c23e30'], park_tram: ['#3f95b0', '#2f7288']
};
const VISITOR_SHIRTS = ['#e05c5c', '#6fcf6a', '#5aa0e0', '#f2c94c', '#e08fd0', '#f0f0e8', '#ff9d4d', '#66d6c8'];
// Phase 4 B2 cars: bright friendly body colours and five body styles, both picked per trip from the car's seed
// (carLook). Style geometry in tiles: len x wid footprint, cl ground clearance, bh body height, cab = the cabin's
// [rear base, rear roof, front roof, windshield base] as fractions from tail (0) to nose (1), ch cabin height, bed =
// pickup load bed length (fraction), wh = wheel positions (fractions), spare = a spare wheel on the tail.
const CAR_COLORS = ['#e0503f', '#3f7fe0', '#f2c94c', '#5fbf5a', '#f08a3c', '#35b3a4', '#9b6fd6', '#ec7fb4', '#f4f4ef', '#c3c9d2', '#2f4f8f', '#8a5a3c'];
const CAR_STYLES = [
  { id: 'sedan', len: 0.23, wid: 0.105, cl: 0.022, bh: 0.064, cab: [0.24, 0.34, 0.6, 0.74], ch: 0.056, bed: 0, wh: [0.19, 0.8], spare: false },
  { id: 'hatch', len: 0.19, wid: 0.1, cl: 0.022, bh: 0.064, cab: [0.05, 0.12, 0.54, 0.72], ch: 0.062, bed: 0, wh: [0.2, 0.8], spare: false },
  { id: 'van', len: 0.24, wid: 0.11, cl: 0.024, bh: 0.066, cab: [0.02, 0.04, 0.78, 0.9], ch: 0.08, bed: 0, wh: [0.18, 0.82], spare: false },
  { id: 'pickup', len: 0.25, wid: 0.11, cl: 0.028, bh: 0.066, cab: [0.44, 0.47, 0.7, 0.8], ch: 0.06, bed: 0.41, wh: [0.19, 0.8], spare: false },
  { id: 'jeep', len: 0.2, wid: 0.11, cl: 0.036, bh: 0.068, cab: [0.1, 0.12, 0.62, 0.68], ch: 0.066, bed: 0, wh: [0.2, 0.8], spare: true }
];
const CAR_GLASS = '#4f7fa8', CAR_GLASS_LIT = '#9fd4f5', CAR_GLASS_DIM = '#3f6488', TIRE = '#23262d', HUB = '#b8bec8';
const LAMP_HEAD = '#fff6c8', LAMP_TAIL = '#e8402e', ROOF_WHITE = '#f7f7f2';
const STAFF_COLORS = { maintenance: '#f08a24', tour_guide: '#3fbf5f', security: '#3b5fd6', veterinary: '#f4f4f4', concessions: '#b56fd6', management: '#7d8494' };
// Crowd variety: hair, skin and trouser palettes plus visitor caps, all picked deterministically from an agent's
// stable `seed` so the crowd reads as a mix of people (not clones) without flickering as they walk.
const HAIR = ['#2f2117', '#5a3a1e', '#141414', '#8a6a3a', '#caa63b', '#7a4a2a', '#d8d2c2', '#9a3a2a', '#5a5a66'];
const SKIN = ['#f1c9a5', '#e6b489', '#cf9a68', '#b07a48', '#8a5a34', '#6a4326'];
const PANTS = ['#2b2f3a', '#3a4250', '#4a3a2a', '#555a66', '#333844', '#6a4a30'];
const VISITOR_CAPS = ['#e05c5c', '#3b5fd6', '#2b2f3a', '#f2c94c', '#6fcf6a', '#e08fd0'];
// Per-role staff cap so a worker reads as uniformed at a glance, on top of the role shirt colour + prop.
const STAFF_CAPS = { maintenance: '#f2c94c', tour_guide: '#2f7d3f', security: '#20287a', veterinary: '#e05c5c', concessions: '#7c3ba0', management: '#3c4250' };
const frac = x => x - Math.floor(x);
const pick = (arr, sd, m) => arr[Math.floor(frac(sd * m) * arr.length)];
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
// Animation clock (sim seconds): the sim time eased between ticks like positions are (render sets it each frame), so
// procedural motion is smooth at 60 fps and freezes with the clock. DPS.selfTest pins it to draw props deterministically.
let animT = 0;
export const livingStats = () => stats;

// Phase 3: real VGA pixel-art sprites replace the placeholder shapes for the dinosaurs.
// Loaded once at boot from sprites/manifest.json (species id -> { w, h, size, face }).
// drawDino falls back to the drawn shape until an image is ready, so a missing or slow
// file never blanks a pen. `face` is the art's own facing; the sprite is mirrored so each
// animal faces its travel direction.
const dinoSprites = new Map();
let spritesSettled = false; // the manifest fetch has finished (ok or not)
let castShadowCheck = null; // manifest.cast_shadow: the phase 4 B2 sprite-cleanup check (DPS.selfTest)
// DPS.selfTest: per-species sprite state. 'loaded' = pixel-art image ready; 'fallback' = no manifest entry or the image
// failed, so drawDino draws the shape (a flagged fallback); 'loading' = still in flight.
export function spriteStatus() {
  const out = {};
  for (const s of DATA.dinosaurs.species) { const r = dinoSprites.get(s.id); out[s.id] = r ? (r.ready ? 'loaded' : r.failed ? 'fallback' : 'loading') : spritesSettled ? 'fallback' : 'loading'; }
  return out;
}
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
// Phase 4: facility BUILDING sprites (buildings/<id>.png), oblique 3/4 pixel art blitted onto each
// facility's footprint. Each facility maps to a small (early tiers) and/or large (top tiers) stage so
// the upgrade still reads; tier 0 empty pads and any unmapped tier keep the procedural drawing.
const buildingSprites = new Map();
// Each facility maps to three isometric stage sprites (small/mid/large) and a per-tier index into
// them (null tiers keep the procedural drawing, e.g. an empty pad or "no tram"). `scale` fine-tunes
// the footprint fit per building on top of balance.living.building_scale.
// DISABLED (2026-09-20): AI-generated building sprites use a generic 45deg isometric that does not
// match the game's sheared oblique projection, so they read tilted / out of place next to the pens
// and ground. Reverted to the procedural buildings (drawn through the same project() as the world,
// so they always fit). Sprites + loader kept for a possible face-textured/hybrid approach later.
const BUILDING_ART = {};
const _BUILDING_ART_SPRITES = {
  food_stand:     { stages: ['food_stand-t1', 'food_stand-t2', 'food_stand-t3'], tierStage: [null, 0, 1, 1, 2], scale: 1.0 },
  gift_shop:      { stages: ['gift_shop-t1', 'gift_shop-t2', 'gift_shop-t3'], tierStage: [null, 0, 1, 1, 2], scale: 1.0 },
  restrooms:      { stages: ['restrooms-t1', 'restrooms-t2', 'restrooms-t3'], tierStage: [0, 1, 1, 2], scale: 1.0 },
  office:         { stages: ['office-t1', 'office-t2', 'office-t3'], tierStage: [0, 1, 2], scale: 0.9 },
  visitor_center: { stages: ['visitor_center-t1', 'visitor_center-t2', 'visitor_center-t3'], tierStage: [null, 0, 1, 2], scale: 1.0 },
  vet_clinic:     { stages: ['vet_clinic-t1', 'vet_clinic-t2', 'vet_clinic-t3'], tierStage: [null, 0, 1, 2], scale: 0.82 },
  park_tram:      { stages: ['park_tram-t1', 'park_tram-t2', 'park_tram-t3'], tierStage: [null, 0, 1, 2], scale: 1.0 }
};
void _BUILDING_ART_SPRITES;
function loadBuildingSprites() {
  let base;
  try { base = new URL('../../buildings/', import.meta.url); } catch { return; }
  fetch(new URL('manifest.json', base)).then(r => (r.ok ? r.json() : null)).then(m => {
    if (!m || !m.buildings) return;
    for (const [id, meta] of Object.entries(m.buildings)) {
      const rec = { img: new Image(), w: meta.w, h: meta.h, ready: false };
      rec.img.onload = () => { rec.ready = true; };
      rec.img.src = new URL(`${id}.png`, base).href;
      buildingSprites.set(id, rec);
    }
  }).catch(() => {});
}
// The building sprite + per-building scale for a facility at a tier, or null to keep the procedural drawing.
function buildingArt(id, tier) {
  const map = BUILDING_ART[id];
  if (!map) return null;
  const si = map.tierStage[tier];
  if (si == null) return null; // empty pad / no-tram: procedural
  const rec = buildingSprites.get(map.stages[si]);
  return rec && rec.ready ? { rec, scale: map.scale ?? 1 } : null;
}
function loadDinoSprites() {
  let base;
  try { base = new URL('../../sprites/', import.meta.url); }
  catch { base = null; }
  if (!base) return;
  fetch(new URL('manifest.json', base)).then(r => (r.ok ? r.json() : null)).then(m => {
    spritesSettled = true;
    if (!m || !m.sprites) return;
    castShadowCheck = m.cast_shadow || null;
    for (const [id, meta] of Object.entries(m.sprites)) {
      const rec = { img: new Image(), w: meta.w, h: meta.h, face: meta.face || 'right', ready: false, shadowBg: meta.shadow_bg || null };
      rec.img.onload = () => { rec.ready = true; };
      rec.img.onerror = () => { rec.failed = true; };
      rec.img.src = new URL(`${id}.png`, base).href;
      dinoSprites.set(id, rec);
    }
  }).catch(() => { spritesSettled = true; });
}

export function initLiving(el, h) {
  canvas = el;
  ctx = canvas.getContext('2d');
  handlers = h;
  loadDinoSprites();
  loadBiomeTextures();
  loadBuildingSprites();
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', () => { if (!active) return; hover = null; hoverFacility = null; hideTip(); });
  canvas.addEventListener('wheel', e => {
    if (!active || titleMode) return;
    e.preventDefault();
    rawLogical(e, M);
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, M.x, M.y);
  }, { passive: false });
  canvas.addEventListener('dblclick', e => { if (!active || titleMode) return; rawLogical(e, M); zoomAt(cam.zoom < ZOOM_MAX ? 1.6 : ZOOM_MIN / cam.zoom, M.x, M.y); });
  canvas.addEventListener('mousedown', e => { if (!active || titleMode || e.button !== 0) return; ptrDown = true; ptrDrag = false; ptrX = e.clientX; ptrY = e.clientY; });
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
    if (!active || titleMode) return;
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
// Title screen: the living park runs as an animated hero backdrop — zoomed in, slowly panning,
// with no HUD/labels and input disabled. setTitleMode(true) frames it; the render loop drives the pan.
let titleMode = false, titlePanDir = -1;
const TITLE_ZOOM = 2.0, TITLE_PAN_PX = 0.28;
export function setTitleMode(on) {
  titleMode = !!on;
  if (titleMode) {
    cam.zoom = TITLE_ZOOM;
    cam.x = BASE_W * (1 - cam.zoom) / 2; // start centred, then drift
    cam.y = BASE_H * (1 - cam.zoom) * 0.42; // a touch above centre so the pens fill the frame
    clampCam();
  } else {
    cam.zoom = 1; cam.x = 0; cam.y = 0;
  }
}
function titlePan() {
  const minX = BASE_W * (1 - cam.zoom);
  cam.x += titlePanDir * TITLE_PAN_PX;
  if (cam.x <= minX) { cam.x = minX; titlePanDir = 1; }
  else if (cam.x >= 0) { cam.x = 0; titlePanDir = -1; }
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
  if (!active || titleMode) return;
  if (ptrDown && ptrDrag) { hideTip(); return; } // mid-pan: no hover/tooltip churn
  hover = parcelAt(e);
  hoverFacility = hover ? null : facilityAt(e);
  const tip = hover ? livingParcelTip(hover) : null;
  if (tip) showTip(tip, e.clientX, e.clientY);
  else if (hoverFacility) showTip(facilityTooltip(hoverFacility), e.clientX, e.clientY);
  else hideTip();
}
// The Living Park hover keeps it light: a pen just lists the dinosaurs living in it (the full management detail is a
// click away in the pen panel, and the Buy Land survey map keeps the verbose parcelTooltip). Names in the tooltip
// replace the old on-hover name chips that drew below the pen.
function livingParcelTip(id) {
  const p = state.parcels[id];
  if (!p) return null;
  if (!p.owned) return `Parcel ${id}: for sale from ${fmt$(parcelPriceFrom(id))} — click to buy`;
  const enc = p.enclosure;
  if (!enc) return `Parcel ${id}: empty — click to build an enclosure`;
  const dinos = enc.dinos || [];
  if (!dinos.length) return `Parcel ${id}: no dinosaurs yet — click to manage`;
  const counts = new Map();
  for (const x of dinos) { const n = speciesById(x.species)?.name || x.species; counts.set(n, (counts.get(n) || 0) + 1); }
  return [...counts].map(([n, c]) => c > 1 ? `${n} ×${c}` : n).join(', ');
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
    if (p.render === 'banner') { const e = entry(K_BANNER, depth(p.position.x, p.position.y)); e.x0 = p.position.x; e.y0 = p.position.y; e.x1 = p.position.half_w; e.y1 = p.position.h; }
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
  // benches face the fountain: tier = the side the backrest is on (0 north, 1 west, 2 south, 3 east)
  for (const [dx, dy] of [[0, -0.9], [0, 0.9], [-0.9, 0], [0.9, 0]]) { const e = entry(K_BENCH, depth(CENTER.x + dx, CENTER.y + dy)); e.x0 = CENTER.x + dx; e.y0 = CENTER.y + dy; e.tier = dy < 0 ? 0 : dy > 0 ? 2 : dx < 0 ? 1 : 3; }
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
  if (titleMode) titlePan();
  animT = AG.simTime - (1 - alpha) * AG.tickDt;
  // Scene (ground, depth-sorted world, pen labels) draws under the camera; the HUD resets to base below.
  ctx.setTransform(k * cam.zoom, 0, 0, k * cam.zoom, k * cam.x, k * cam.y);
  ctx.lineJoin = 'round';
  drawGround();
  // gather + sort
  drawList.length = 0;
  for (let i = 0; i < staticEntries.length; i++) drawList.push(staticEntries[i]);
  for (const d of AG.dinos) { d.rx = d.px + (d.x - d.px) * alpha; d.ry = d.py + (d.y - d.py) * alpha; d.depth = depth(d.rx, d.ry); d.kind = K_DINO; drawList.push(d); }
  for (const v of AG.visitors) { if (!v.active) continue; v.rx = v.px + (v.x - v.px) * alpha + v.lx; v.ry = v.py + (v.y - v.py) * alpha + v.ly; v.depth = depth(v.rx, v.ry); v.kind = K_VISITOR; drawList.push(v); }
  // Cars sort on their front edge, which depends on facing (side-on: half the width; end-on: half the length).
  for (const c of AG.cars) {
    if (!c.active) continue;
    c.rx = c.px + (c.x - c.px) * alpha; c.ry = c.py + (c.y - c.py) * alpha;
    carLook(c); c.dh = alpha < 0.5 ? c.phead : c.head;
    const st = CAR_STYLES[c.style];
    c.depth = depth(c.rx, c.ry + ((c.dh & 1) ? st.len : st.wid) * 0.5); c.kind = K_CAR; drawList.push(c);
  }
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
  if (!titleMode) { drawPenLabels(); flushLabels(); } // no chips/tooltips over the title backdrop
  ctx.setTransform(k, 0, 0, k, 0, 0); // HUD is fixed screen UI, not part of the zoom/pan
  if (!titleMode) drawHud();
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
// Fill an arbitrary 3D polygon (world points [[x,y,z],...]) — used for gabled roofs.
function poly3(pts, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) { project(pts[i][0], pts[i][1], pts[i][2], P); if (i) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
// A cute bright gabled roof sitting on top of a box (eaves at z, ridge along X at z+rh): the front
// slope (bright), the visible east gable, a dimmer back slope for depth, and a ridge line.
function gableRoof(x0, y0, x1, y1, z, rh, top, side) {
  const ym = (y0 + y1) / 2, eave = 0.04;
  const x0e = x0 - eave, x1e = x1 + eave, y1e = y1 + eave, y0e = y0 - eave;
  poly3([[x0e, y0e, z], [x1e, y0e, z], [x1e, ym, z + rh], [x0e, ym, z + rh]], shade(top), OUT);       // back slope (dimmer)
  poly3([[x1e, y0e, z], [x1e, y1e, z], [x1e, ym, z + rh]], side, OUT);                                 // east gable triangle
  poly3([[x0e, y1e, z], [x1e, y1e, z], [x1e, ym, z + rh], [x0e, ym, z + rh]], top, OUT);               // front slope (bright)
  line3(x0e, ym, z + rh, x1e, ym, z + rh, OUT, 1);                                                     // ridge
}
// A striped shop awning across the front face, just above the door.
function stripedAwning(x0, x1, y, zt) {
  const zb = zt - 0.13, n = 5;
  for (let i = 0; i < n; i++) vquad(x0 + (x1 - x0) * i / n, y, x0 + (x1 - x0) * (i + 1) / n, y, zb, zt, i % 2 ? '#f4f0e2' : '#e85440', OUT);
}
// A cheerful little pennant flag on a pole at a roof point.
function pennant(x, y, z, color) {
  line3(x, y, z, x, y, z + 0.22, OUT, 1.5);
  project(x, y, z + 0.22, P);
  ctx.fillStyle = color; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + 10, P.y + 3); ctx.lineTo(P.x, P.y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
}
function line3(xa, ya, za, xb, yb, zb, color, w) {
  project(xa, ya, za, P); project(xb, yb, zb, Q);
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.stroke();
}
// Phase 4 B2 prop primitives. In this oblique view the WEST face of a box is the visible side (the view leans a touch
// west), so box3 draws west + south + top; face4 / tri3 fill any world points without allocating; drum is an upright
// cylinder (lower rim arc, sides, full top); pyramid is a four-sided roof (west + south faces); glow a soft light.
function fillStroke(fill, stroke, lw = 1) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function face4(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, fill, stroke) {
  ctx.beginPath();
  project(ax, ay, az, P); ctx.moveTo(P.x, P.y);
  project(bx, by, bz, P); ctx.lineTo(P.x, P.y);
  project(cx, cy, cz, P); ctx.lineTo(P.x, P.y);
  project(dx, dy, dz, P); ctx.lineTo(P.x, P.y);
  ctx.closePath(); fillStroke(fill, stroke);
}
function tri3(ax, ay, az, bx, by, bz, cx, cy, cz, fill, stroke) {
  ctx.beginPath();
  project(ax, ay, az, P); ctx.moveTo(P.x, P.y);
  project(bx, by, bz, P); ctx.lineTo(P.x, P.y);
  project(cx, cy, cz, P); ctx.lineTo(P.x, P.y);
  ctx.closePath(); fillStroke(fill, stroke);
}
function box3(x0, y0, x1, y1, h, top, front, west, stroke, z0 = 0) {
  vquad(x0, y0, x0, y1, z0, z0 + h, west, stroke);
  vquad(x0, y1, x1, y1, z0, z0 + h, front, stroke);
  quad(x0, y0, x1, y1, z0 + h, top, stroke);
}
function drum(x, y, z0, z1, r, side, top, stroke) {
  project(x, y, z0, P); project(x, y, z1, Q);
  const rx = r * L.TW, ry = r * L.TH;
  ctx.beginPath(); ctx.moveTo(P.x + rx, P.y); ctx.ellipse(P.x, P.y, rx, ry, 0, 0, Math.PI); ctx.lineTo(Q.x - rx, Q.y); ctx.ellipse(Q.x, Q.y, rx, ry, 0, Math.PI, 0, true); ctx.closePath();
  fillStroke(side, stroke);
  if (top) { ctx.beginPath(); ctx.ellipse(Q.x, Q.y, rx, ry, 0, 0, 6.283); fillStroke(top, stroke); }
}
function pyramid(x0, y0, x1, y1, z, h, front, west, stroke) {
  const ax = (x0 + x1) / 2, ay = (y0 + y1) / 2;
  tri3(x0, y0, z, x0, y1, z, ax, ay, z + h, west, stroke);
  tri3(x0, y1, z, x1, y1, z, ax, ay, z + h, front, stroke);
}
function glow(sx, sy, r, color, a) {
  ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
}
function ball(sx, sy, r, fill) { ctx.fillStyle = fill; ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill(); ctx.stroke(); }
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
// Palettes for the plaza set: warm sandstone, painted wood, garden iron, gold trim, foliage.
const STONE = ['#f1e8d4', '#dccfb2', '#c2b393'], STONE_DK = ['#d6cab0', '#bfb193', '#a69877'];
const WOOD = ['#d59a5a', '#b87a3e', '#9a6231'], IRON = '#2f5a4c', IRON_DK = '#262a36';
const GOLD = ['#f8dc6c', '#dcb03a', '#b98f27'], LEAF = ['#3f8a2a', '#5cb83a', '#8fdc5a'];
const BLOOMS = ['#ff6b6b', '#ffd23f', '#ff8fd0', '#ffffff', '#ff9d4d', '#b58cff'];
const DASH = [2, 2], NODASH = [];
// Plaza planter: a terracotta tub with a rim and a round flowering shrub.
function drawPlanter(e) {
  const x = e.x0, y = e.y0;
  box3(x - 0.13, y - 0.13, x + 0.13, y + 0.13, 0.1, '#e58f5a', '#d0703f', '#b35c33', OUT);
  box3(x - 0.145, y - 0.145, x + 0.145, y + 0.145, 0.025, '#f0a574', '#d97c48', '#bf6639', OUT, 0.1);
  quad(x - 0.11, y - 0.11, x + 0.11, y + 0.11, 0.125, '#6a4a2e', null);
  project(x, y, 0.13, P);
  const sx = P.x, sy = P.y;
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.fillStyle = LEAF[0]; ctx.beginPath(); ctx.ellipse(sx, sy - 5, 9, 7, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = LEAF[1]; ctx.beginPath(); ctx.ellipse(sx - 1.5, sy - 7, 7, 5, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = LEAF[2]; ctx.beginPath(); ctx.ellipse(sx - 3, sy - 9, 3.5, 2.5, 0, 0, 6.283); ctx.fill();
  const k = Math.floor(frac(x * 3.7 + y * 1.3) * BLOOMS.length);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = BLOOMS[(k + i) % BLOOMS.length]; ctx.fillRect(sx - 6 + i * 3.6, sy - 9 + (i % 2) * 4, 2, 2); }
}
// Park bench: slatted wooden seat and backrest on iron legs, facing the fountain. e.tier = the side its backrest is on
// (0 north, 1 west, 2 south, 3 east); the parts are drawn back to front for that facing.
function drawBench(e) {
  const x = e.x0, y = e.y0, along = e.tier === 0 || e.tier === 2, L2 = 0.21, D2 = 0.065;
  const x0 = along ? x - L2 : x - D2, x1 = along ? x + L2 : x + D2, y0 = along ? y - D2 : y - L2, y1 = along ? y + D2 : y + L2;
  const backFirst = e.tier === 0 || e.tier === 3;
  if (backFirst) benchBack(e.tier, x0, y0, x1, y1);
  // legs (front pair shows), seat with two slat lines
  if (along) { vquad(x0 + 0.02, y1 - 0.01, x0 + 0.04, y1 - 0.01, 0, 0.06, IRON_DK, null); vquad(x1 - 0.04, y1 - 0.01, x1 - 0.02, y1 - 0.01, 0, 0.06, IRON_DK, null); }
  else { vquad(x0 + 0.01, y1 - 0.02, x1 - 0.01, y1 - 0.02, 0, 0.06, IRON_DK, null); vquad(x0 + 0.01, y0 + 0.02, x0 + 0.03, y0 + 0.02, 0, 0.06, IRON_DK, null); }
  box3(x0, y0, x1, y1, 0.028, WOOD[0], WOOD[1], WOOD[2], OUT, 0.06);
  for (let i = 1; i < 3; i++) {
    if (along) line3(x0 + 0.01, y0 + (y1 - y0) * i / 3, 0.088, x1 - 0.01, y0 + (y1 - y0) * i / 3, 0.088, WOOD[2], 1);
    else line3(x0 + (x1 - x0) * i / 3, y0 + 0.01, 0.088, x0 + (x1 - x0) * i / 3, y1 - 0.01, 0.088, WOOD[2], 1);
  }
  if (!backFirst) benchBack(e.tier, x0, y0, x1, y1);
}
function benchBack(tier, x0, y0, x1, y1) {
  const t = 0.022;
  if (tier === 0 || tier === 2) {
    const yb = tier === 0 ? y0 : y1 - t;
    line3(x0 + 0.03, yb + t / 2, 0.06, x0 + 0.03, yb + t / 2, 0.21, IRON_DK, 1.5); line3(x1 - 0.03, yb + t / 2, 0.06, x1 - 0.03, yb + t / 2, 0.21, IRON_DK, 1.5);
    box3(x0, yb, x1, yb + t, 0.1, WOOD[0], WOOD[1], WOOD[2], OUT, 0.11);
    line3(x0 + 0.01, yb + t, 0.16, x1 - 0.01, yb + t, 0.16, WOOD[2], 1);
  } else {
    const xb = tier === 1 ? x0 : x1 - t;
    line3(xb + t / 2, y0 + 0.03, 0.06, xb + t / 2, y0 + 0.03, 0.21, IRON_DK, 1.5); line3(xb + t / 2, y1 - 0.03, 0.06, xb + t / 2, y1 - 0.03, 0.21, IRON_DK, 1.5);
    box3(xb, y0, xb + t, y1, 0.1, WOOD[0], WOOD[1], WOOD[2], OUT, 0.11);
    line3(xb, y0 + 0.01, 0.16, xb, y1 - 0.01, 0.16, WOOD[2], 1);
  }
}
// tier 0: plaza lantern on a green iron post; 1: the Lamp Posts prize, a taller black post with a crossbar, two hanging
// lanterns and a gold finial; 2: lot lamp, a tall galvanised pole with an arm and a flat cool luminaire.
function drawLamp(e) {
  const x = e.x0, y = e.y0;
  if (e.tier === 2) {
    box3(x - 0.035, y - 0.035, x + 0.035, y + 0.035, 0.05, '#aab2bc', '#8d95a0', '#737a86', OUT);
    line3(x, y, 0.05, x, y, 0.8, '#6d7480', 2);
    line3(x, y, 0.79, x + 0.12, y, 0.79, '#6d7480', 2);
    box3(x + 0.06, y - 0.04, x + 0.18, y + 0.04, 0.03, '#8d95a0', '#eef8ff', '#b9c9d8', OUT, 0.76);
    project(x + 0.12, y + 0.04, 0.76, P); glow(P.x, P.y + 2, 6, '#e6f6ff', 0.28);
    return;
  }
  const prize = e.tier === 1, h = prize ? 0.72 : 0.56, post = prize ? IRON_DK : IRON;
  box3(x - 0.045, y - 0.045, x + 0.045, y + 0.045, 0.05, prize ? '#4a5064' : '#4f8a74', post, post, OUT);
  line3(x, y, 0.05, x, y, h, post, prize ? 2.5 : 2);
  if (prize) {
    project(x, y, 0.3, P); ctx.fillStyle = GOLD[1]; ctx.fillRect(P.x - 2, P.y - 1, 4, 2); // collar
    line3(x - 0.09, y, h - 0.04, x + 0.09, y, h - 0.04, post, 1.5);
    for (let i = 0; i < 2; i++) {
      const lx = x + (i ? 0.09 : -0.09);
      box3(lx - 0.035, y - 0.035, lx + 0.035, y + 0.035, 0.08, '#fff4c0', '#ffe28a', '#e8c86a', OUT, h - 0.14);
      pyramid(lx - 0.045, y - 0.045, lx + 0.045, y + 0.045, h - 0.06, 0.04, post, post, OUT);
      project(lx, y + 0.035, h - 0.1, P); glow(P.x, P.y, 6, '#ffe9a0', 0.28);
    }
    project(x, y, h, P); ball(P.x, P.y - 2, 2, GOLD[0]);
  } else {
    box3(x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0.1, '#fff4c0', '#ffe28a', '#e8c86a', OUT, h);
    pyramid(x - 0.06, y - 0.06, x + 0.06, y + 0.06, h + 0.1, 0.05, post, post, OUT);
    project(x, y + 0.05, h + 0.05, P); glow(P.x, P.y, 7, '#ffe9a0', 0.25);
  }
}

// Fixed facility at its tier: bigger box per tier, extra roof sections, storeys and a style per tier from
// facilities.json `render`, plus a tag with the tier label. Every tier looks different from the one before.
// Phase 4: draw a building sprite anchored to its footprint's front-centre, scaled to the footprint
// width (building_scale gives a little overhang for eaves/roof). A soft shadow grounds it; depth-sort
// is handled by the facility entry's front-edge depth, so visitors in front still overlap correctly.
function blitBuilding(art, rect, scale = 1) {
  const cx = (rect.x0 + rect.x1) / 2;
  project(rect.x0, rect.y1, 0, P); project(rect.x1, rect.y1, 0, Q);
  const footW = Math.abs(Q.x - P.x);
  const drawW = footW * (DATA.balance.living.building_scale ?? 1.18) * scale;
  const drawH = drawW * (art.h / art.w);
  project(cx, rect.y1, 0, P);
  shadow(P.x, P.y, drawW * 0.42);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(art.img, Math.round(P.x - drawW / 2), Math.round(P.y - drawH), Math.round(drawW), Math.round(drawH));
}
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
  // Phase 4: blit the pixel-art building sprite, footprint-anchored, instead of the procedural block.
  const art = buildingArt(e.id, e.tier);
  if (art) { blitBuilding(art.rec, rect, art.scale); return; }
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
    // Cute storybook building: light coloured walls + a bright gabled roof + friendly windows + a door.
    const rc = FACILITY_ROOF[e.id] || ['#c85a48', '#a3453a'];
    const rh = Math.min(0.55, z * 0.42 + 0.14);
    box(x0, y0, x1, y1, z, c[0], c[1], c[2], OUT);
    gableRoof(x0, y0, x1, y1, z, rh, rc[0], rc[1]);
    // a window per column, per storey, on the front face (leave the middle of the ground floor for the door)
    const cols = Math.max(2, Math.round((x1 - x0) / 0.34));
    for (let s = 0; s < storeys; s++) {
      const zb = z * (s + 0.4) / storeys, zt = z * (s + 0.72) / storeys;
      for (let i = 0; i < cols; i++) {
        const wx = x0 + (x1 - x0) * (i + 0.5) / cols;
        if (s === 0 && Math.abs(wx - cx) < 0.14) continue; // door column
        vquad(wx - 0.055, y1, wx + 0.055, y1, zb, zt, '#bfe6fb', OUT);
      }
    }
    // door
    vquad(cx - 0.085, y1, cx + 0.085, y1, 0, Math.min(z * 0.6, z * 0.5 / Math.max(1, storeys) + 0.14), '#7a5330', OUT);
    // bright, recognisable accents per facility
    if (e.id === 'food_stand') stripedAwning(x0, x1, y1, z * 0.66);
    if (e.id === 'gift_shop' || e.id === 'visitor_center') vquad(x0 + 0.06, y1, x1 - 0.06, y1, z * 0.74, z * 0.92, '#f2c94c', OUT); // sign band
    if (e.id === 'vet_clinic') { // red cross on a white panel
      vquad(cx - 0.12, y1, cx + 0.12, y1, z * 0.5, z * 0.9, '#ffffff', OUT);
      vquad(cx - 0.035, y1, cx + 0.035, y1, z * 0.56, z * 0.84, '#e85440', null);
      vquad(cx - 0.1, y1, cx + 0.1, y1, z * 0.67, z * 0.73, '#e85440', null);
    }
    if (style === 'tower') { // office HQ: a little clock face high on the gable
      project(cx, (y0 + y1) / 2, z + rh, P);
      ctx.fillStyle = '#f4f0e2'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(P.x, P.y - 5, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(P.x, P.y - 5); ctx.lineTo(P.x, P.y - 7); ctx.moveTo(P.x, P.y - 5); ctx.lineTo(P.x + 2, P.y - 5); ctx.stroke();
    }
    // a cheerful pennant on the roof ridge for the shops and welcome buildings
    if (e.id === 'food_stand' || e.id === 'gift_shop' || e.id === 'visitor_center') pennant(cx + (x1 - x0) * 0.28, (y0 + y1) / 2, z + rh, rc[0]);
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

// Front gate by prize: 0 two sandstone pillars and a purple ENTRANCE lintel; 1 the Fancy Gate Arch, carved wooden posts
// with gold finials and pennants, a curved arch and a string of bunting; 2 the Grand Entrance, twin towers with pointed
// roofs, waving flags, lit lanterns and a gold fascia. Each look is a clear step up from the one before. The plain gate
// and the arch both name themselves ENTRANCE (fix pass: the arch said WELCOME, which doubled the Welcome Banner that
// always hangs above it, since the banner is earned first).
export const gateKind = () => prizeEarned('grand_entrance') ? 2 : prizeEarned('gate_arch') ? 1 : 0;
const BUNTING = ['#e0503f', '#f2c94c', '#3f7fe0', '#5fbf5a', '#ec7fb4', '#f08a3c', '#35b3a4'];
function drawGate(kind = gateKind()) {
  const g = L.GATE, Y = L.PARK_H, xl = g.x - g.halfGap, xr = g.x + g.halfGap;
  const pw = kind === 2 ? 0.28 : 0.14, t = animT;
  if (kind === 2) {
    for (let i = 0; i < 2; i++) {
      const x0 = i ? xr : xl - pw, x1 = x0 + pw, cx = (x0 + x1) / 2, H = 1.1;
      box3(x0 - 0.02, Y - pw / 2 - 0.02, x1 + 0.02, Y + pw / 2 + 0.02, 0.08, STONE_DK[0], STONE_DK[1], STONE_DK[2], OUT);
      box3(x0, Y - pw / 2, x1, Y + pw / 2, H - 0.08, STONE[0], STONE[1], STONE[2], OUT, 0.08);
      box3(x0 - 0.02, Y - pw / 2 - 0.02, x1 + 0.02, Y + pw / 2 + 0.02, 0.05, GOLD[0], GOLD[1], GOLD[2], OUT, H);
      vquad(cx - 0.04, Y + pw / 2, cx + 0.04, Y + pw / 2, H * 0.62, H * 0.84, '#3a3350', OUT);           // window slit
      pyramid(x0 - 0.03, Y - pw / 2 - 0.03, x1 + 0.03, Y + pw / 2 + 0.03, H + 0.05, 0.38, '#9b5fd6', '#7a45b0', OUT);
      line3(cx, Y, H + 0.43, cx, Y, H + 0.7, OUT, 1.5);
      project(cx, Y, H + 0.7, P);
      const wv = Math.sin(t * 5 + i * 2) * 1.5;
      ctx.fillStyle = i ? '#f2c94c' : '#e0503f'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + 12, P.y + 2.5 + wv); ctx.lineTo(P.x, P.y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      box3(cx - 0.05, Y + pw / 2, cx + 0.05, Y + pw / 2 + 0.06, 0.08, '#fff1b8', '#ffe28a', '#e0c070', OUT, H * 0.34);  // lantern
      project(cx, Y + pw / 2 + 0.06, H * 0.38, P); glow(P.x, P.y, 7, '#ffe9a0', 0.3);
    }
    box3(xl, Y - 0.03, xr, Y + 0.03, 0.2, GOLD[0], GOLD[1], GOLD[2], OUT, 0.74);
    vquad(xl + 0.04, Y + 0.03, xr - 0.04, Y + 0.03, 0.77, 0.91, '#6b5c8a', null);
    project(g.x, Y, 0.8, P);
    queueTag('GRAND ENTRANCE', P.x, P.y, '#fff1b8', 'rgba(107,92,138,0.9)', 2, FONT);
  } else if (kind === 1) {
    const H = 0.78;
    for (let i = 0; i < 2; i++) {
      const x0 = i ? xr : xl - pw, x1 = x0 + pw, cx = (x0 + x1) / 2;
      box3(x0 - 0.015, Y - pw / 2 - 0.015, x1 + 0.015, Y + pw / 2 + 0.015, 0.07, WOOD[1], WOOD[2], '#7d4f28', OUT);
      box3(x0, Y - pw / 2, x1, Y + pw / 2, H - 0.07, WOOD[0], WOOD[1], WOOD[2], OUT, 0.07);
      for (let b = 0; b < 2; b++) vquad(x0, Y + pw / 2, x1, Y + pw / 2, 0.3 + b * 0.28, 0.34 + b * 0.28, '#7d4f28', null); // carved bands
      project(cx, Y, H, P); ball(P.x, P.y - 3, 3.5, GOLD[0]);
      pennant(cx, Y, H + 0.1, i ? '#3f7fe0' : '#e0503f');
    }
    // the arch: a thick curved band in the gate's front plane, rising from post to post
    const ax0 = xl - pw / 2, ax1 = xr + pw / 2, zb = H * 0.78, rise = 0.3, th = 0.1, N = 14, yf = Y + pw / 2;
    ctx.beginPath();
    for (let k = 0; k <= N; k++) { const u = k / N; project(ax0 + (ax1 - ax0) * u, yf, zb + rise * Math.sin(Math.PI * u) + th, P); if (k) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); }
    for (let k = N; k >= 0; k--) { const u = k / N; project(ax0 + (ax1 - ax0) * u, yf, zb + rise * Math.sin(Math.PI * u), P); ctx.lineTo(P.x, P.y); }
    ctx.closePath(); fillStroke('#b87a3e', OUT);
    ctx.beginPath();
    for (let k = 0; k <= N; k++) { const u = k / N; project(ax0 + (ax1 - ax0) * u, yf, zb + rise * Math.sin(Math.PI * u) + th * 0.5, P); if (k) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); }
    ctx.strokeStyle = GOLD[1]; ctx.lineWidth = 1; ctx.stroke();
    // bunting on a sagging string between the posts
    const bz = H * 0.6, n = BUNTING.length;
    for (let k = 0; k < n; k++) {
      const u0 = (k + 0.15) / n, u1 = (k + 0.85) / n, um = (u0 + u1) / 2;
      const s0 = bz - 0.06 * Math.sin(Math.PI * u0), s1 = bz - 0.06 * Math.sin(Math.PI * u1), sm = bz - 0.06 * Math.sin(Math.PI * um) - 0.07;
      tri3(xl + (xr - xl) * u0, yf, s0, xl + (xr - xl) * u1, yf, s1, xl + (xr - xl) * um, yf, sm, BUNTING[k], OUT);
    }
    project(g.x, yf, zb + rise + th * 0.2, P);
    queueTag('ENTRANCE', P.x, P.y + 10, '#f2c94c', 'rgba(138,107,58,0.9)', 2, FONT);
  } else {
    const H = 0.72;
    for (let i = 0; i < 2; i++) {
      const x0 = i ? xr : xl - pw, x1 = x0 + pw;
      box3(x0 - 0.02, Y - pw / 2 - 0.02, x1 + 0.02, Y + pw / 2 + 0.02, 0.06, STONE_DK[0], STONE_DK[1], STONE_DK[2], OUT);
      box3(x0, Y - pw / 2, x1, Y + pw / 2, H - 0.06, STONE[0], STONE[1], STONE[2], OUT, 0.06);
      box3(x0 - 0.02, Y - pw / 2 - 0.02, x1 + 0.02, Y + pw / 2 + 0.02, 0.04, STONE_DK[0], STONE_DK[1], STONE_DK[2], OUT, H);
    }
    box3(xl - pw, Y - 0.025, xr + pw, Y + 0.025, 0.17, '#8f7fb4', '#6b5c8a', '#574a72', OUT, H - 0.2);
    project(g.x, Y, H - 0.12, P);
    queueTag('ENTRANCE', P.x, P.y, '#f2c94c', 'rgba(107,92,138,0.9)', 2, FONT);
  }
  if (goalDone('grand_park')) drawPlaque(g.x + g.halfGap + pw + 0.34, Y + 0.02);
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

// Our own centrepiece, by prize level (fountainLevel): 0 a round sandstone basin with a long-neck dinosaur sculpture
// spouting into it; 1 Stone Basin: a wider, taller basin and a raised second bowl spilling into the pool; 2 Twin Jets:
// eight jets arcing in from the rim, lit water and a blue tile band; 3 Grand Cascade: gold trim and finials, the
// sculpture on a tall plinth and a tall central plume. Each level adds something the one before does not have.
function drawFountain(lvl = fountainLevel()) {
  const c = L.CENTER, t = animT;
  const r = L.FOUNTAIN_R * (lvl >= 1 ? 1.22 : 1), rimH = lvl >= 1 ? 0.12 : 0.085, wz = rimH - 0.02;
  drum(c.x, c.y, 0, rimH, r, STONE[1], STONE[0], OUT);
  if (lvl >= 2) { project(c.x, c.y, rimH * 0.45, P); ctx.strokeStyle = '#3f7fe0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(P.x, P.y, r * L.TW, r * L.TH, 0, 0.15, Math.PI - 0.15); ctx.stroke(); }
  if (lvl >= 3) { project(c.x, c.y, rimH, P); ctx.strokeStyle = GOLD[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(P.x, P.y, r * L.TW * 0.97, r * L.TH * 0.97, 0, 0, 6.283); ctx.stroke(); }
  ellipse3(c.x, c.y, wz, r * 0.84, r * 0.84, lvl >= 2 ? '#62c2ff' : '#4d9fe6', '#2f6fb0');
  if (lvl >= 2) { project(c.x, c.y, wz, P); glow(P.x, P.y, r * L.TH * 0.9, '#c8f0ff', 0.45); }
  // ripples spreading from the centre
  project(c.x, c.y, wz, P);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
  for (let k = 0; k < 2; k++) {
    const p = frac(t * 0.45 + k * 0.5);
    ctx.globalAlpha = (1 - p) * 0.55; ctx.beginPath(); ctx.ellipse(P.x, P.y, r * L.TW * (0.2 + 0.6 * p), r * L.TH * (0.2 + 0.6 * p), 0, 0, 6.283); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (lvl >= 2) fountainJets(c, r, rimH, wz, t, -1);
  // centre: pedestal (0), column + raised spilling bowl (1-2), bowl + tall gold plinth (3)
  let top;
  if (lvl === 0) { drum(c.x, c.y, wz, 0.2, 0.07, STONE[1], STONE[0], OUT); top = 0.2; }
  else {
    drum(c.x, c.y, wz, 0.25, 0.055, STONE[1], STONE[0], OUT);
    drum(c.x, c.y, 0.24, 0.3, r * 0.42, STONE[1], STONE[0], OUT);
    ellipse3(c.x, c.y, 0.3, r * 0.34, r * 0.34, '#7cc8f6', null);
    ctx.setLineDash(DASH); ctx.lineDashOffset = -t * 14;
    for (let k = 0; k < 5; k++) { const a = 0.35 + k * 0.6; const bx = c.x + Math.cos(a) * r * 0.43, by = c.y + Math.sin(a) * r * 0.43; line3(bx, by, 0.26, bx, by, wz, 'rgba(210,238,255,0.9)', 1.5); }
    ctx.setLineDash(NODASH); ctx.lineDashOffset = 0;
    top = 0.3;
    if (lvl >= 3) {
      box3(c.x - 0.075, c.y - 0.075, c.x + 0.075, c.y + 0.075, 0.2, GOLD[0], GOLD[1], GOLD[2], OUT, top);
      vquad(c.x - 0.055, c.y + 0.075, c.x + 0.055, c.y + 0.075, top + 0.04, top + 0.16, STONE[0], null);
      top += 0.2;
    }
  }
  project(c.x, c.y, top, Q);
  fountainSculpture(Q.x, Q.y, lvl >= 3 ? 1.15 : 1, t, lvl >= 3 ? 0 : wz);
  if (lvl >= 3) { // tall central plume behind a crown of spray
    const hz = top + 0.62 + 0.05 * Math.sin(t * 4);
    line3(c.x - 0.02, c.y, top + 0.05, c.x - 0.02, c.y, hz, 'rgba(220,242,255,0.95)', 3);
    project(c.x - 0.02, c.y, hz, P);
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 6; k++) { const a = k * 1.047 + t * 2, p = frac(t * 0.9 + k / 6); ctx.fillRect(P.x + Math.cos(a) * 8 * p - 1, P.y + p * p * 16 - 4 * p, 2, 2); }
    for (let k = 0; k < 4; k++) { const a = 0.785 + k * 1.571; project(c.x + Math.cos(a) * r * 0.92, c.y + Math.sin(a) * r * 0.92, rimH, P); ball(P.x, P.y - 2, 2.2, GOLD[0]); }
  }
  if (lvl >= 2) fountainJets(c, r, rimH, wz, t, 1);
}
// Eight jets arcing from nozzles on the rim into the pool, with a droplet riding each arc. half = -1 draws the far
// (north) half, +1 the near half, so the centrepiece sits between them.
function fountainJets(c, r, rimH, wz, t, half) {
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 8; k++) {
    const a = k * 0.7854 + 0.39;
    if ((Math.sin(a) < 0 ? -1 : 1) !== half) continue;
    project(c.x + Math.cos(a) * r * 0.86, c.y + Math.sin(a) * r * 0.86, rimH, P);
    project(c.x + Math.cos(a) * r * 0.3, c.y + Math.sin(a) * r * 0.3, wz, R);
    const mx = (P.x + R.x) / 2, my = Math.min(P.y, R.y) - 14 - 2 * Math.sin(t * 5 + k);
    ctx.strokeStyle = 'rgba(215,240,255,0.9)'; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.quadraticCurveTo(mx, my, R.x, R.y); ctx.stroke();
    const u = frac(t * 1.3 + k / 8), v = 1 - u;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(v * v * P.x + 2 * u * v * mx + u * u * R.x - 1, v * v * P.y + 2 * u * v * my + u * u * R.y - 1, 2, 2);
  }
}
// The sculpture: a chunky pale-stone long-neck dinosaur on the pedestal top (sx, sy), spouting a water arc from its
// mouth into the pool when `spoutZ` > 0 (the Grand Cascade's plume replaces the spout).
function fountainSculpture(sx, sy, k, t, spoutZ) {
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.fillStyle = STONE[2];
  ctx.fillRect(sx - 6 * k, sy - 4 * k, 3 * k, 4 * k); ctx.fillRect(sx + 3 * k, sy - 4 * k, 3 * k, 4 * k);
  ctx.fillStyle = STONE[1];
  ctx.beginPath(); ctx.moveTo(sx - 7 * k, sy - 8 * k); ctx.quadraticCurveTo(sx - 16 * k, sy - 9 * k, sx - 21 * k, sy - 4 * k); ctx.quadraticCurveTo(sx - 14 * k, sy - 5 * k, sx - 7 * k, sy - 3 * k); ctx.closePath(); ctx.fill(); ctx.stroke(); // tail
  ctx.fillStyle = STONE[0];
  ctx.beginPath(); ctx.ellipse(sx, sy - 7 * k, 10 * k, 6 * k, 0, 0, 6.283); ctx.fill(); ctx.stroke();                        // body
  ctx.beginPath(); ctx.moveTo(sx + 5 * k, sy - 11 * k); ctx.quadraticCurveTo(sx + 12 * k, sy - 16 * k, sx + 11 * k, sy - 27 * k); ctx.lineTo(sx + 6 * k, sy - 27 * k); ctx.quadraticCurveTo(sx + 7 * k, sy - 17 * k, sx + 1 * k, sy - 10 * k); ctx.closePath(); ctx.fill(); ctx.stroke(); // neck
  ctx.beginPath(); ctx.ellipse(sx + 10 * k, sy - 28 * k, 5 * k, 3.4 * k, -0.15, 0, 6.283); ctx.fill(); ctx.stroke();       // head
  ctx.fillStyle = STONE[1]; ctx.beginPath(); ctx.ellipse(sx - 1 * k, sy - 4.5 * k, 7 * k, 2.2 * k, 0, 0, Math.PI); ctx.fill(); // belly shade
  ctx.fillStyle = OUT; ctx.fillRect(sx + 11 * k, sy - 29.5 * k, 1.5, 1.5);                                                 // eye
  if (spoutZ > 0) {
    const hx = sx + 15 * k, hy = sy - 27 * k, ex = sx + 18 * k, ey = sy + 1;
    ctx.strokeStyle = 'rgba(200,236,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + 12 * k, hy - 6 * k, ex, ey); ctx.stroke();
    const u = frac(t * 1.6), v = 1 - u;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(v * v * hx + 2 * u * v * (hx + 12 * k) + u * u * ex - 1, v * v * hy + 2 * u * v * (hy - 6 * k) + u * u * ey - 1, 2, 2);
  }
}

// ---- park prizes ----
// Welcome Banner prize: candy-striped poles with gold finials and a red cloth with a gently waving pennant hem.
// It stands across the spine just inside the gate (position and pole height in prizes.json), deep and tall enough that
// its cloth hangs clear above every gate look: over the ENTRANCE lintel, over the arch, between the Grand Entrance towers.
const BANNER_TEXT = 'WELCOME';
function drawBanner(e) {
  const hw = e.x1, h = e.y1, y = e.y0, t = animT;
  for (let i = 0; i < 2; i++) {
    const px = i ? e.x0 + hw : e.x0 - hw;
    for (let k = 0; k < 6; k++) line3(px, y, h * k / 6, px, y, h * (k + 1) / 6, k % 2 ? '#f4f0e2' : '#e0503f', 2.5);
    project(px, y, h, P); ball(P.x, P.y - 2, 2.5, GOLD[0]);
  }
  const x0 = e.x0 - hw + 0.03, x1 = e.x0 + hw - 0.03, zt = h * 0.92, zb = h * 0.6, N = 8;
  ctx.beginPath();
  project(x0, y, zt, P); ctx.moveTo(P.x, P.y); project(x1, y, zt, P); ctx.lineTo(P.x, P.y);
  for (let k = N; k >= 0; k--) { const u = k / N, drop = k % 2 ? 0.05 : 0; project(x0 + (x1 - x0) * u, y, zb - drop + 0.012 * Math.sin(t * 3 + k), P); ctx.lineTo(P.x, P.y); }
  ctx.closePath(); fillStroke('#e0503f', OUT);
  vquad(x0 + 0.02, y, x1 - 0.02, y, zt - 0.035, zt - 0.02, '#f2c94c', null);
  project(e.x0, y, h * 0.76, P);
  label(BANNER_TEXT, P.x, P.y + 3, '#fff1b8', 'center', FONT_S);
}
// Flower Beds prize: a round stone-edged bed of soil with clumps of leaves and bright blooms (colours vary by bed).
function drawFlowerBed(e) {
  drum(e.x0, e.y0, 0, 0.035, 0.14, STONE[1], STONE[0], OUT);
  ellipse3(e.x0, e.y0, 0.035, 0.115, 0.115, '#6a4a2e', null);
  const k0 = Math.floor(frac(e.x0 * 2.3 + e.y0 * 5.1) * BLOOMS.length);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.8976 + 0.3, rr = i === 6 ? 0 : 0.07;
    project(e.x0 + Math.cos(a) * rr, e.y0 + Math.sin(a) * rr * 0.9, 0.04, P);
    ctx.fillStyle = i % 2 ? LEAF[1] : LEAF[0]; ctx.beginPath(); ctx.ellipse(P.x, P.y - 1.5, 3, 2, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = BLOOMS[(k0 + i) % BLOOMS.length]; ctx.fillRect(P.x - 1.5, P.y - 5, 3, 3);
    ctx.fillStyle = '#ffe36b'; ctx.fillRect(P.x - 0.5, P.y - 4, 1, 1);
  }
}
// Dinosaur Statues prize: a stepped sandstone plinth with a gold plaque, topped by a chunky stone T-rex (tier 0 faces
// east, tier 1 west).
function drawStatue(e) {
  const x = e.x0, y = e.y0;
  box3(x - 0.13, y - 0.11, x + 0.13, y + 0.11, 0.06, STONE_DK[0], STONE_DK[1], STONE_DK[2], OUT);
  box3(x - 0.1, y - 0.08, x + 0.1, y + 0.08, 0.13, STONE[0], STONE[1], STONE[2], OUT, 0.06);
  vquad(x - 0.045, y + 0.08, x + 0.045, y + 0.08, 0.1, 0.15, GOLD[1], OUT);
  project(x, y, 0.19, Q);
  const d = e.tier === 0 ? 1 : -1, sx = Q.x, sy = Q.y;
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.fillStyle = '#a9a295';
  ctx.fillRect(sx - 4, sy - 6, 3, 6); ctx.fillRect(sx + 1, sy - 6, 3, 6);                                                    // legs
  ctx.fillStyle = '#c9c2b2';
  ctx.beginPath(); ctx.moveTo(sx - d * 4, sy - 11); ctx.quadraticCurveTo(sx - d * 13, sy - 12, sx - d * 17, sy - 5); ctx.lineTo(sx - d * 5, sy - 6); ctx.closePath(); ctx.fill(); ctx.stroke(); // tail
  ctx.beginPath(); ctx.ellipse(sx, sy - 10, 7, 5, -d * 0.35, 0, 6.283); ctx.fill(); ctx.stroke();                        // body
  ctx.beginPath(); ctx.moveTo(sx + d * 2, sy - 16); ctx.lineTo(sx + d * 11, sy - 19); ctx.lineTo(sx + d * 11, sy - 14); ctx.lineTo(sx + d * 4, sy - 12); ctx.closePath(); ctx.fill(); ctx.stroke(); // head
  ctx.fillStyle = '#a9a295'; ctx.fillRect(sx + d * 5 - (d < 0 ? 2 : 0), sy - 11, 2, 1.5);                                 // tiny arm
  ctx.fillStyle = OUT; ctx.fillRect(sx + d * 7 - 0.5, sy - 17.5, 1.5, 1.5);                                             // eye
}
// Carousel prize: a red-and-gold platform, a striped centre column, six little dinosaurs to ride bobbing on poles as it
// turns (far half drawn behind the column, near half in front), a striped canopy with a scalloped valance and a flag.
const RIDE_COLS = ['#e0503f', '#5fbf5a', '#3f7fe0', '#f2c94c', '#ec7fb4', '#f08a3c'];
function drawCarousel(e) {
  const r = e.x1, t = animT, x = e.x0, y = e.y0;
  drum(x, y, 0, 0.06, r, '#c23e30', GOLD[0], OUT);
  ellipse3(x, y, 0.06, r * 0.86, r * 0.86, '#f4e6b8', OUT);
  carouselRiders(x, y, r, t, -1);
  drum(x, y, 0.06, 0.5, 0.05, '#f4f0e2', null, OUT);
  line3(x, y + 0.05, 0.1, x, y + 0.05, 0.46, '#e0503f', 2);
  carouselRiders(x, y, r, t, 1);
  // canopy: striped cone, scalloped valance, flag
  project(x, y, 0.52, P); project(x, y, 0.84, R);
  const rx = r * L.TW * 1.04, ry = r * L.TH * 1.04;
  for (let i = 0; i < 12; i++) {
    const a0 = i * 0.5236, a1 = (i + 1) * 0.5236;
    ctx.fillStyle = i % 2 ? '#e0503f' : '#f4f0e2'; ctx.strokeStyle = OUT; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(R.x, R.y); ctx.lineTo(P.x + Math.cos(a0) * rx, P.y + Math.sin(a0) * ry); ctx.lineTo(P.x + Math.cos(a1) * rx, P.y + Math.sin(a1) * ry); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i + 0.5) * 0.5236;
    if (Math.sin(a) < -0.2) continue; // only the near half of the valance shows
    ctx.fillStyle = i % 2 ? '#f4f0e2' : '#e0503f';
    ctx.beginPath(); ctx.arc(P.x + Math.cos(a) * rx, P.y + Math.sin(a) * ry + 1, 3, 0, Math.PI); ctx.fill(); ctx.stroke();
  }
  ball(R.x, R.y - 2, 3, GOLD[0]);
  line3(x, y, 0.86, x, y, 1.02, OUT, 1);
  project(x, y, 1.02, P); ctx.fillStyle = '#3f7fe0'; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + 8, P.y + 2 + Math.sin(t * 5)); ctx.lineTo(P.x, P.y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
}
function carouselRiders(x, y, r, t, half) {
  for (let i = 0; i < 6; i++) {
    const a = t * 0.9 + i * 1.0472, sa = Math.sin(a);
    if ((sa < 0 ? -1 : 1) !== half) continue;
    const px = x + Math.cos(a) * r * 0.62, py = y + sa * r * 0.62, zz = 0.2 + 0.05 * Math.sin(t * 3 + i);
    line3(px, py, 0.06, px, py, 0.5, GOLD[1], 1);
    project(px, py, zz, P);
    const d = Math.cos(a + 1.5708) >= 0 ? 1 : -1; // riders face along the direction of travel
    ctx.fillStyle = RIDE_COLS[i]; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(P.x, P.y - 2, 5, 3, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(P.x + d * 3, P.y - 3); ctx.lineTo(P.x + d * 6, P.y - 9); ctx.lineTo(P.x + d * 8.5, P.y - 8); ctx.lineTo(P.x + d * 5, P.y - 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(P.x - 3, P.y, 1.5, 2); ctx.fillRect(P.x + 1.5, P.y, 1.5, 2);
  }
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
// A small person, animated: legs stride and the body bobs while walking (o.phase set), still when idle (o.phase null).
// o = { shirt, pants, skin, hair, hat, dir, phase, scale }. Kept at ~16px tall so it reads at the park's scale.
function person(sx, sy, o) {
  const s = o.scale || 1;
  const stride = o.phase != null ? Math.sin(o.phase) : 0;
  const bob = o.phase != null ? Math.abs(Math.sin(o.phase)) * 0.9 * s : 0;
  const yy = sy - bob;
  shadow(sx, sy, 3.4 * s);
  ctx.lineWidth = 1; ctx.strokeStyle = OUT;
  // legs (stride swings them fore/aft)
  ctx.fillStyle = o.pants || '#2b2f3a';
  const lh = 4 * s;
  ctx.fillRect(sx - 2.4 * s + stride * 1.1 * s, yy - lh, 1.9 * s, lh);
  ctx.fillRect(sx + 0.5 * s - stride * 1.1 * s, yy - lh, 1.9 * s, lh);
  // torso with a shaded trailing edge for a hint of form
  const tw = 6 * s, th = 7 * s, tx = sx - 3 * s, ty = yy - 10 * s;
  ctx.fillStyle = o.shirt; ctx.fillRect(tx, ty, tw, th);
  ctx.fillStyle = shade(o.shirt); ctx.fillRect(tx + tw - 1.6 * s, ty, 1.6 * s, th);
  ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);
  // head
  const hy = yy - 12.6 * s, hr = 3 * s;
  ctx.fillStyle = o.skin || '#f1c9a5'; ctx.beginPath(); ctx.arc(sx, hy, hr, 0, 6.283); ctx.fill(); ctx.stroke();
  if (o.hair && !o.hat) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.arc(sx, hy, hr, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); }
  // facing cue: a dark eye pixel toward travel direction
  ctx.fillStyle = '#2b2430'; ctx.fillRect(sx + (o.dir >= 0 ? 0.5 : -1.5) * s, hy - 0.4 * s, 1 * s, 1 * s);
  if (o.hat) { // cap: crown band + a short brim in the facing direction
    ctx.fillStyle = o.hat; ctx.fillRect(sx - 3.4 * s, hy - hr - 1.2 * s, 6.8 * s, 2.3 * s);
    ctx.strokeRect(sx - 3.4 * s + 0.5, hy - hr - 1.2 * s + 0.5, 6.8 * s - 1, 2.3 * s - 1);
    ctx.fillStyle = shade(o.hat); ctx.fillRect(o.dir >= 0 ? sx + 3.2 * s : sx - 5.6 * s, hy - hr + 0.5 * s, 2.4 * s, 1 * s);
  }
}
function visitorLook(v) {
  const sd = v.seed || 0;
  return { shirt: VISITOR_SHIRTS[v.color], pants: pick(PANTS, sd, 3), skin: pick(SKIN, sd, 5), hair: pick(HAIR, sd, 11),
    hat: frac(sd * 13) > 0.74 ? pick(VISITOR_CAPS, sd, 17) : null, scale: frac(sd * 31) < 0.15 ? 0.78 : 1 };
}
// Moving this tick? (per-tick displacement) — drives the walk cycle for visitors and staff alike, and stays still when
// the clock is paused or the agent is dwelling at a pen.
const isMoving = a => (Math.abs(a.x - a.px) + Math.abs(a.y - a.py)) > 0.0015;
const WALK_HZ = 9;
function drawVisitor(v) {
  project(v.rx, v.ry, 0, P);
  const o = visitorLook(v);
  o.dir = v.dir || 1;
  o.phase = isMoving(v) ? AG.simTime * WALK_HZ + (v.seed || 0) * 6.283 : null;
  person(P.x, P.y, o);
  if (v.st === AG.V_PANIC) label('!', P.x, P.y - 18 * (o.scale || 1), '#f2c94c', 'center', FONT_S);
}
function drawStaff(s) {
  project(s.rx, s.ry, 0, P);
  const sd = s.seed || 0;
  person(P.x, P.y, { shirt: STAFF_COLORS[s.role] || '#888', pants: '#333844', skin: pick(SKIN, sd, 5), hair: pick(HAIR, sd, 11),
    hat: STAFF_CAPS[s.role] || '#3c4250', dir: s.dir || 1, phase: isMoving(s) ? AG.simTime * WALK_HZ + sd * 6.283 : null });
  if (s.role === 'maintenance') { ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(P.x + 4, P.y - 9); ctx.lineTo(P.x + 7 + (s.st === 2 ? Math.sin(AG.simTime * 12) * 3 : 0), P.y + 1); ctx.stroke(); }
  else if (s.role === 'tour_guide') { ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x + 4, P.y - 8); ctx.lineTo(P.x + 4, P.y - 22); ctx.stroke(); ctx.fillStyle = '#f2c94c'; ctx.fillRect(P.x + 4, P.y - 22, 6, 4); }
  else if (s.role === 'veterinary') { ctx.fillStyle = '#e05c5c'; ctx.fillRect(P.x - 1, P.y - 9, 2, 5); ctx.fillRect(P.x - 2.5, P.y - 7.5, 5, 2); }
}
// ---- cars (phase 4 B2) ----
// Style and colour indices for a car's current trip, derived once from its seed (balance.living.car_style_weights sets
// the style mix, car_two_tone_share the share with a white roof). Exported for DPS.selfTest.
export function carLook(c) {
  const sd = c.seed || 0;
  if (c.lookSeed === sd) return c;
  const Lv = DATA.balance.living, W = Lv.car_style_weights || {};
  let tot = 0;
  for (let i = 0; i < CAR_STYLES.length; i++) tot += Math.max(0, W[CAR_STYLES[i].id] ?? 1);
  let r = frac(sd * 7.77) * tot, s = 0;
  while (s < CAR_STYLES.length - 1 && r >= Math.max(0, W[CAR_STYLES[s].id] ?? 1)) { r -= Math.max(0, W[CAR_STYLES[s].id] ?? 1); s++; }
  c.style = s; c.color = Math.floor(frac(sd * 3.331) * CAR_COLORS.length);
  c.roof2 = frac(sd * 23.17) < (Lv.car_two_tone_share ?? 0);
  c.lookSeed = sd;
  return c;
}
export const carPalette = () => ({ colors: CAR_COLORS.length, styles: CAR_STYLES.length, ids: CAR_STYLES.map(st => st.id) });
// [roof (sunlit), side, shaded end, hood and deck] per body colour, built once.
let carTones = null;
function carTone(i) {
  if (!carTones) carTones = CAR_COLORS.map(col => [lighten(col, 0.3), col, shade(col), lighten(col, 0.12)]);
  return carTones[i] || carTones[0];
}
// A car facing its heading (c.dh: 0 E, 1 N, 2 W, 3 S). Side-on shows the classic profile: body, a cabin with a raked
// windshield toward the nose, wheels, a head lamp at the nose and a tail lamp at the back. Driving up the aisle shows
// the tail (rear window, tail lamps, white reversing lamps when backing out); leaving shows the nose (windshield,
// head lamps, grille). Everything goes through project(), so it sits on the grid like the buildings.
function drawCar(c) {
  const st = CAR_STYLES[c.style] || CAR_STYLES[0], T = carTone(c.color), roof = c.roof2 ? ROOF_WHITE : T[0];
  const side = (c.dh & 1) === 0;
  project(c.rx, c.ry, 0, P);
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath(); ctx.ellipse(P.x - 1, P.y + 0.5, (side ? st.len : st.wid) * 0.5 * L.TW + 1.5, (side ? st.wid : st.len) * 0.5 * L.TH + 1, 0, 0, 6.283); ctx.fill();
  if (side) carSide(c, st, T, roof, c.dh === 0 ? 1 : -1);
  else carEnd(c, st, T, roof, c.dh === 3);
}
function carSide(c, st, T, roof, f) {
  const cy = c.ry, y0 = cy - st.wid / 2, y1 = cy + st.wid / 2;
  const z0 = st.cl, z1 = st.cl + st.bh, z2 = z1 + st.ch;
  const xr = c.rx - f * st.len / 2, fl = f * st.len; // tail x, and signed length toward the nose
  const xw = Math.min(xr, xr + fl), xe = Math.max(xr, xr + fl);
  if (st.spare) { project(xr - f * 0.012, y1 - 0.02, z0 + st.bh * 0.55, P); ctx.fillStyle = TIRE; ctx.beginPath(); ctx.arc(P.x, P.y, 2.2, 0, 6.283); ctx.fill(); }
  vquad(xw, y0, xw, y1, z0, z1, T[2], OUT);   // west end (a sliver in this view)
  vquad(xw, y1, xe, y1, z0, z1, T[1], OUT);   // flank
  quad(xw, y0, xe, y1, z1, T[3], OUT);        // hood and deck from above
  if (st.bed) quad(xr + fl * 0.04, y0 + 0.018, xr + fl * st.bed, y1 - 0.018, z1, T[2], OUT); // pickup load bed
  const K = st.cab, yc0 = y0 + 0.014, yc1 = y1 - 0.014;
  const ra = xr + fl * K[0], rb = xr + fl * K[1], fb = xr + fl * K[2], fa = xr + fl * K[3];
  face4(ra, yc0, z1, ra, yc1, z1, rb, yc1, z2, rb, yc0, z2, CAR_GLASS_DIM, OUT); // rear window
  face4(fa, yc0, z1, fa, yc1, z1, fb, yc1, z2, fb, yc0, z2, CAR_GLASS_LIT, OUT); // windshield
  quad(rb, yc0, fb, yc1, z2, roof, OUT);
  face4(ra, yc1, z1, fa, yc1, z1, fb, yc1, z2, rb, yc1, z2, T[1], OUT);         // cabin side
  const wz0 = z1 + st.ch * 0.2, wz1 = z2 - st.ch * 0.14, sl0 = (wz0 - z1) / st.ch, sl1 = (wz1 - z1) / st.ch;
  face4(ra + (rb - ra) * sl0 + fl * 0.03, yc1, wz0, fa + (fb - fa) * sl0 - fl * 0.03, yc1, wz0, fa + (fb - fa) * sl1 - fl * 0.03, yc1, wz1, ra + (rb - ra) * sl1 + fl * 0.03, yc1, wz1, CAR_GLASS, null); // side windows
  for (let i = 0; i < st.wh.length; i++) { project(xr + fl * st.wh[i], y1, 0.03, P); carWheel(P.x, P.y); }
  project(xr + fl, y1, z0 + st.bh * 0.62, P); ctx.fillStyle = LAMP_HEAD; ctx.fillRect(P.x - (f > 0 ? 2 : 0), P.y - 1, 2, 1.6);
  project(xr, y1, z0 + st.bh * 0.62, P); ctx.fillStyle = c.rev ? LAMP_HEAD : LAMP_TAIL; ctx.fillRect(P.x - (f > 0 ? 0 : 1.6), P.y - 1, 1.6, 1.6);
}
function carWheel(sx, sy) {
  const r = Math.max(1.5, 0.03 * L.ZH);
  ctx.fillStyle = TIRE; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill();
  ctx.fillStyle = HUB; ctx.fillRect(sx - 0.5, sy - 0.5, 1, 1);
}
function carEnd(c, st, T, roof, front) {
  const x0 = c.rx - st.wid / 2, x1 = c.rx + st.wid / 2;
  const z0 = st.cl, z1 = st.cl + st.bh, z2 = z1 + st.ch;
  const s = front ? 1 : -1, yr = c.ry - s * st.len / 2, fl = s * st.len; // tail y, signed length toward the nose
  const yn = Math.min(yr, yr + fl), ys = Math.max(yr, yr + fl);
  vquad(x0 + 0.004, ys - 0.03, x0 + 0.03, ys - 0.03, 0, z0 + 0.02, TIRE, null);   // tyres peeking under the near end
  vquad(x1 - 0.03, ys - 0.03, x1 - 0.004, ys - 0.03, 0, z0 + 0.02, TIRE, null);
  vquad(x0, yn, x0, ys, z0, z1, T[2], OUT);   // west flank (a sliver)
  vquad(x0, ys, x1, ys, z0, z1, T[1], OUT);   // near end: nose or tail
  quad(x0, yn, x1, ys, z1, T[3], OUT);
  if (st.bed) quad(x0 + 0.018, yr + fl * 0.04, x1 - 0.018, yr + fl * st.bed, z1, T[2], OUT);
  const K = st.cab, xc0 = x0 + 0.014, xc1 = x1 - 0.014;
  const ra = yr + fl * K[0], rb = yr + fl * K[1], fb = yr + fl * K[2], fa = yr + fl * K[3];
  face4(xc0, ra, z1, xc0, fa, z1, xc0, fb, z2, xc0, rb, z2, CAR_GLASS, OUT);      // west side windows (a sliver)
  if (front) face4(xc0, ra, z1, xc1, ra, z1, xc1, rb, z2, xc0, rb, z2, CAR_GLASS_DIM, OUT); // far: rear window
  else face4(xc0, fa, z1, xc1, fa, z1, xc1, fb, z2, xc0, fb, z2, CAR_GLASS_DIM, OUT);       // far: windshield
  quad(xc0, rb, xc1, fb, z2, roof, OUT);
  if (front) face4(xc0, fa, z1, xc1, fa, z1, xc1, fb, z2, xc0, fb, z2, CAR_GLASS_LIT, OUT); // near: windshield
  else face4(xc0, ra, z1, xc1, ra, z1, xc1, rb, z2, xc0, rb, z2, CAR_GLASS, OUT);           // near: rear window
  if (st.spare && !front) { project(c.rx, ys, z0 + st.bh * 0.5, P); ctx.fillStyle = TIRE; ctx.beginPath(); ctx.arc(P.x, P.y, 2.2, 0, 6.283); ctx.fill(); }
  // lamps on the near end, plus a grille (nose) or a number plate (tail)
  project(x0, ys, z0 + st.bh * 0.62, P); project(x1, ys, z0 + st.bh * 0.62, Q);
  ctx.fillStyle = front ? LAMP_HEAD : LAMP_TAIL;
  ctx.fillRect(P.x + 0.8, P.y - 1, 1.8, 1.6); ctx.fillRect(Q.x - 2.6, Q.y - 1, 1.8, 1.6);
  if (!front && c.rev) { ctx.fillStyle = LAMP_HEAD; ctx.fillRect(P.x + 2.6, P.y - 1, 1, 1.6); ctx.fillRect(Q.x - 3.6, Q.y - 1, 1, 1.6); }
  ctx.fillStyle = front ? OUT : '#f2f2e6'; ctx.fillRect((P.x + Q.x) / 2 - 1.5, P.y - (front ? 1 : 0.2), 3, front ? 1 : 1.2);
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
// ---- dinosaur motion (phase 4 B2): procedural walk + idle on the existing sprites, no new art ----
// A feet-anchored pose per animal: sx / sy scale about the feet, kx leans the top toward the head (a skew, as a
// fraction of height), tail lifts the tail end of the sprite (a shear about a seam at tail_split of the width), lift is
// the starving breathing bob in px (kept from before, the only motion that moves the feet). Walking: two footfalls per
// stride, squash on landing and stretch mid-stride, a forward lean, a side-to-side rock and a tail sway, the stride
// advancing with the distance actually drawn so the feet do not skate. Idle: slow breathing, and now and then a
// head-dip (lean + squash) or a tail flick. Rates and phases come from the animal's seed, so pen-mates never move in
// lockstep. Every amplitude and rate is balance.living.dino_anim.
const POSE = { sx: 1, sy: 1, kx: 0, tail: 0, lift: 0 };
// Progress 0..1 through an occasional per-animal event (one per window of `every` = [min, max] seconds, placed at a
// hashed offset inside the window, lasting `dur` seconds), or -1 when none is running.
function eventAt(t, sd, every, dur, salt) {
  const period = every[0] + (every[1] - every[0]) * frac(sd * (13.7 + salt));
  const k = Math.floor(t / period);
  const start = frac(Math.sin((k + 1) * 12.9898 + sd * 78.233 + salt * 4.1) * 43758.5453) * Math.max(0, period - dur);
  const x = t - k * period - start;
  return x >= 0 && x < dur ? x / dur : -1;
}
export function dinoPose(d, out = POSE) {
  const Lv = DATA.balance.living, A = Lv.dino_anim, sd = d.seed || 0;
  out.sx = 1; out.sy = 1; out.kx = 0; out.tail = 0; out.lift = 0;
  const starving = d.d.hunger >= DATA.balance.dinosaur.hunger_max;
  const w = Math.min(1, Math.max(0, d.walkK || 0)), i = 1 - w;
  if (w > 0) {
    const phi = (d.stride || 0) * (A.walk_steps_per_tile[d.size] ?? A.walk_steps_per_tile.medium) * Math.PI + frac(sd * 5.3) * 6.283;
    const s = Math.abs(Math.sin(phi)) * 2 - 1, k = w * (starving ? A.starving_walk : 1);
    out.sy += k * A.walk_stretch * s; out.sx -= k * A.walk_stretch * A.walk_squash * s;
    out.kx += k * (A.walk_lean + A.walk_rock * Math.sin(phi));
    out.tail += k * A.walk_tail * (0.5 + 0.5 * Math.cos(phi));
  }
  if (i > 0) {
    if (starving) out.lift = i * Math.sin(d.phase * ((Lv.dino_starving_bob_hz || 0.45) / (Lv.dino_bob_hz || 1.4))) * (Lv.dino_starving_bob_px || 1.6);
    else {
      const t = animT * (1 + A.rate_jitter * (2 * frac(sd * 7.31) - 1)) + frac(sd * 3.17) * 60;
      const br = Math.sin(t * A.breath_hz * 6.283);
      out.sy += i * A.breath * br; out.sx -= i * A.breath * A.walk_squash * br;
      const dp = eventAt(t, sd, A.dip_every_s, A.dip_s, 1);
      if (dp >= 0) { const b = Math.sin(Math.PI * dp) ** 2; out.kx += i * A.dip_lean * b; out.sy -= i * A.dip_squash * b; }
      const fl = eventAt(t, sd, A.flick_every_s, A.flick_s, 2);
      if (fl >= 0) out.tail += i * A.flick * Math.sin(Math.PI * fl) * Math.abs(Math.sin(Math.PI * A.flick_waves * fl));
    }
  }
  if (d.pop > 0) { out.sx = 1; out.sy = 1; out.kx = 0; out.tail = 0; } // the crate pop-in owns the scale
  return out;
}
// Phase 3: draw the species' pixel-art sprite, feet on the ground point, mirrored to face the
// travel direction. Preserves the shadow, the starving bob, the crate pop-in scale, and
// every status badge. Falls back to drawDinoShape until the image has loaded.
// Phase 4 B2: posed through dinoPose (walk cycle / idle life), feet anchored on the ground point.
function drawDino(d) {
  if (d.arriving) return; // still in the delivery truck (M5)
  const spr = dinoSprites.get(d.sp.id);
  if (!spr || !spr.ready) { drawDinoShape(d); return; }
  const Lv = DATA.balance.living, A = Lv.dino_anim;
  // Renderer-side motion state: the stride follows the distance actually drawn (a jump, e.g. an escapee snapped home,
  // is ignored); walkK eases between standing and walking on sim time, so it freezes with the clock.
  if (d.lrx === d.lrx) { const m = Math.hypot(d.rx - d.lrx, d.ry - d.lry); if (m < 0.3) d.stride += m; }
  d.lrx = d.rx; d.lry = d.ry;
  const dt = d.animAt === d.animAt ? animT - d.animAt : 0;
  d.animAt = animT;
  if (dt > 0) d.walkK += ((d.moving ? 1 : 0) - d.walkK) * Math.min(1, dt * A.blend_rate);
  project(d.rx, d.ry, 0, P);
  const popK = d.pop > 0 ? Math.min(1, (d.popT || 0) / d.pop) : 1;
  const popScale = d.pop > 0 ? (popK < 0.7 ? 0.2 + 1.15 * (popK / 0.7) : 1.35 - 0.35 * ((popK - 0.7) / 0.3)) : 1;
  const scale = (Lv.sprite_scale ?? 1) * popScale;
  const w = spr.w * scale, h = spr.h * scale;
  const pose = dinoPose(d);
  const sx = P.x, sy = P.y - pose.lift;
  shadow(P.x, P.y, w * 0.42);
  const flip = (d.dir >= 0) !== (spr.face === 'right'); // mirror when art facing != travel facing
  const fwd = spr.face === 'right' ? 1 : -1;             // the head's side in the art's own frame
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(sx, sy);
  if (flip) ctx.scale(-1, 1);
  ctx.transform(pose.sx, 0, -fwd * pose.kx, pose.sy, 0, 0); // scale about the feet, lean the top toward the head
  blitDino(spr, w, h, fwd, pose.tail, A.tail_split);
  ctx.restore();
  d.labelY = sy - h * pose.sy - 8 - (d.size === 'large' ? 4 : 0);
  const wrongBiome = !d.escaped && biomeFit(d.sp, state.parcels[d.parcel]?.biome) === 'wrong';
  if (d.d.sick_days > 0 || d.d.health < 50) { badge(sx, d.labelY + 2); if (wrongBiome) unhappyBadge(sx + 11, d.labelY + 2); }
  else if (wrongBiome) unhappyBadge(sx, d.labelY + 2);
  if (d.d.hunger >= Lv.dino_hungry_threshold && !(d.d.sick_days > 0 || d.d.health < 50)) { label('z', sx + w * 0.4, sy - h - 2, '#f2c94c', 'center', FONT_S); }
}
// The sprite, feet on the origin, in the art's own facing. With a tail lift the tail end (`split` of the width) is its
// own slice, sheared up about the seam; the slices overlap by one source column so no seam line shows.
function blitDino(spr, w, h, fwd, tail, split) {
  const img = spr.img, iw = img.naturalWidth || spr.w, ih = img.naturalHeight || spr.h;
  const n = Math.round(iw * split);
  if (Math.abs(tail) < 1e-4 || n < 2 || n > iw - 3) { ctx.drawImage(img, -w / 2, -h, w, h); return; }
  const k = w / iw, seam = fwd > 0 ? -w / 2 + n * k : w / 2 - n * k, b = fwd * tail;
  ctx.save();
  ctx.transform(1, b, 0, 1, 0, -b * seam); // shear about x = seam: the tail end rises, the seam stays put
  if (fwd > 0) ctx.drawImage(img, 0, 0, n + 1, ih, -w / 2, -h, (n + 1) * k, h);
  else ctx.drawImage(img, iw - n - 1, 0, n + 1, ih, seam - k, -h, (n + 1) * k, h);
  ctx.restore();
  if (fwd > 0) ctx.drawImage(img, n, 0, iw - n, ih, seam, -h, w / 2 - seam, h);
  else ctx.drawImage(img, 0, 0, iw - n, ih, -w / 2, -h, seam + w / 2, h);
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
    if (!always.includes(d.size)) continue; // hover no longer draws a chip — the pen's dinosaurs are listed in the tooltip instead
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

// ---- DPS.selfTest hooks (phase 4 B2) ----
// Every plaza / prize prop at every tier, drawn into a scratch 2D context `c2d` (px scale, prop centred, animation
// clock pinned so the jets and riders hold still), each tier compared with the tier before it: `diff` = pixels whose
// colour moved by more than 24 in any channel. Returns [{ prop, tier, ok, err, diff }]. The live frame is untouched.
const PROP_TIERS = [
  { prop: 'fountain', tiers: 4, ladder: true }, { prop: 'gate', tiers: 3, ladder: true }, { prop: 'lamp', tiers: 3, ladder: true },
  { prop: 'bench', tiers: 4 }, { prop: 'statue', tiers: 2 }, { prop: 'planter', tiers: 1 }, { prop: 'flower_bed', tiers: 1 },
  { prop: 'banner', tiers: 1 }, { prop: 'carousel', tiers: 1 }
];
export function propTierTest(c2d, px = 4) {
  const saved = ctx, savedT = animT, W = c2d.canvas.width, H = c2d.canvas.height, out = [];
  const C = L.CENTER, e = { kind: 0, depth: 0, id: null, x0: C.x + 1.3, y0: C.y + 1.3, x1: 0.62, y1: 0, tier: 0, cond: 100, seg: 0, text: '', ref: null };
  const BN = DATA.prizes.prizes.find(p => p.render === 'banner').position;
  const q0 = labelQueue.length;
  ctx = c2d; animT = 12.345; ctx.lineJoin = 'round';
  try {
    for (const spec of PROP_TIERS) {
      let prev = null;
      for (let tier = 0; tier < spec.tiers; tier++) {
        const r = { prop: spec.prop, tier, ok: true, err: '', diff: null, ladder: !!spec.ladder };
        try {
          e.tier = tier; e.x1 = spec.prop === 'carousel' ? 0.32 : spec.prop === 'banner' ? BN.half_w : 0.62; e.y1 = spec.prop === 'banner' ? BN.h : 0;
          const ax = spec.prop === 'fountain' ? C.x : spec.prop === 'gate' ? L.GATE.x : e.x0;
          const ay = spec.prop === 'fountain' ? C.y : spec.prop === 'gate' ? L.PARK_H : e.y0;
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
          project(ax, ay, 0.3, P);
          ctx.setTransform(px, 0, 0, px, W / 2 - P.x * px, H * 0.62 - P.y * px);
          if (spec.prop === 'fountain') drawFountain(tier);
          else if (spec.prop === 'gate') drawGate(tier);
          else if (spec.prop === 'lamp') drawLamp(e);
          else if (spec.prop === 'bench') drawBench(e);
          else if (spec.prop === 'statue') drawStatue(e);
          else if (spec.prop === 'planter') drawPlanter(e);
          else if (spec.prop === 'flower_bed') drawFlowerBed(e);
          else if (spec.prop === 'banner') drawBanner(e);
          else drawCarousel(e);
          const img = ctx.getImageData(0, 0, W, H).data;
          if (prev) { let n = 0; for (let i = 0; i < img.length; i += 4) if (Math.abs(img[i] - prev[i]) > 24 || Math.abs(img[i + 1] - prev[i + 1]) > 24 || Math.abs(img[i + 2] - prev[i + 2]) > 24 || Math.abs(img[i + 3] - prev[i + 3]) > 24) n++; r.diff = n; }
          prev = img;
        } catch (err) { r.ok = false; r.err = err.message; }
        out.push(r);
      }
    }
  } finally {
    ctx = saved; animT = savedT; labelQueue.length = q0; // drop the gate labels the test queued
  }
  return out;
}
// Welcome Banner against every gate look (phase 4 fix pass): the banner alone at its data position, then each gate
// alone with its name tag, same scratch camera. Per gate kind: `cloth` = banner pixels between the poles that the gate
// paints over, `letters` = the same in the lettering's columns, `gap` = the fewest clear rows between the banner's
// lowest pixel and the gate's highest one in those cloth columns (negative = they overlap). Returns [{ kind, cloth, letters, gap }].
export function bannerGateTest(c2d, px = 4) {
  const saved = ctx, savedT = animT, W = c2d.canvas.width, H = c2d.canvas.height, out = [];
  const bn = DATA.prizes.prizes.find(p => p.render === 'banner').position, e = { x0: bn.x, y0: bn.y, x1: bn.half_w, y1: bn.h };
  const q0 = labelQueue.length;
  ctx = c2d; animT = 12.345; ctx.lineJoin = 'round';
  const frame = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); project(L.GATE.x, L.PARK_H, 0.3, P); ctx.setTransform(px, 0, 0, px, W / 2 - P.x * px, H * 0.62 - P.y * px); };
  const mask = () => { const d = ctx.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 8 ? 1 : 0; return m; };
  const col = (x, y) => { project(x, y, 0, P); return Math.round(W / 2 + (P.x - Q.x) * px); };
  try {
    frame(); drawBanner(e); const B = mask();
    ctx.font = FONT_S; const tw = ctx.measureText(BANNER_TEXT).width / 2 + 1;
    project(L.GATE.x, L.PARK_H, 0.3, Q);
    const c0 = col(e.x0 - e.x1, e.y0) + 2 * px, c1 = col(e.x0 + e.x1, e.y0) - 2 * px, cm = col(e.x0, e.y0), t0 = cm - Math.ceil(tw * px), t1 = cm + Math.ceil(tw * px);
    for (let kind = 0; kind < 3; kind++) {
      frame(); drawGate(kind);
      for (let i = q0; i < labelQueue.length; i++) labelQueue[i].draw(labelQueue[i].x, labelQueue[i].y);
      labelQueue.length = q0;
      const G = mask(), r = { kind, cloth: 0, letters: 0, gap: Infinity };
      for (let x = Math.max(0, c0); x <= Math.min(W - 1, c1); x++) {
        let low = -1, top = -1;
        for (let y = 0; y < H; y++) { const i = y * W + x; if (B[i]) { low = y; if (G[i]) { r.cloth++; if (x >= t0 && x <= t1) r.letters++; } } if (G[i] && top < 0) top = y; }
        if (low >= 0 && top >= 0) r.gap = Math.min(r.gap, top - low - 1);
      }
      out.push(r);
    }
  } finally {
    ctx = saved; animT = savedT; labelQueue.length = q0;
  }
  return out;
}
// The cleaned sprites (manifest shadow_bg) against manifest.cast_shadow: in the bottom `band` of rows, count opaque
// pixels that are shadow-tone (on the ray from black through the sampled backdrop colour) or near-black (luma below
// near_black_luma). Returns { cfg, sprites: [{ id, ready, rows, opaque, shadow_tone, near_black }] }.
export function spriteCleanCheck(c2d) {
  const cfg = castShadowCheck, out = { cfg, sprites: [] };
  if (!cfg) return out;
  for (const [id, rec] of dinoSprites) {
    if (!rec.shadowBg) continue;
    const r = { id, ready: rec.ready, rows: 0, opaque: 0, shadow_tone: 0, near_black: 0 };
    out.sprites.push(r);
    if (!rec.ready) continue;
    const w = rec.img.naturalWidth, h = rec.img.naturalHeight, y0 = Math.floor(h * (1 - cfg.band));
    c2d.setTransform(1, 0, 0, 1, 0, 0); c2d.clearRect(0, 0, c2d.canvas.width, c2d.canvas.height);
    c2d.drawImage(rec.img, 0, 0);
    const px = c2d.getImageData(0, y0, w, h - y0).data, [br, bg, bb] = rec.shadowBg, bl = br * br + bg * bg + bb * bb;
    r.rows = h - y0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] <= 8) continue;
      r.opaque++;
      const R2 = px[i], G2 = px[i + 1], B2 = px[i + 2], t = (R2 * br + G2 * bg + B2 * bb) / bl;
      if (Math.hypot(R2 - t * br, G2 - t * bg, B2 - t * bb) < cfg.ray_tol && t > cfg.ray_t[0] && t < cfg.ray_t[1]) r.shadow_tone++;
      if (0.299 * R2 + 0.587 * G2 + 0.114 * B2 < cfg.near_black_luma) r.near_black++;
    }
  }
  return out;
}
