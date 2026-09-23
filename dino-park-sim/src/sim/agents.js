// Living Park agents: visitors, cars, dinosaurs, staff, litter. Fixed-rate tick (balance.living.tick_hz),
// decoupled from rendering; the renderer interpolates between (px,py) and (x,y). All positions are
// world coords (tile units, see render/projection.js). Visual only: nothing here touches the economy.
// Pools are preallocated; the per-tick loops do not allocate.
// M2.5: routing runs on the walkway graph from data/parcels.json (sim/walkways.js); points of interest are
// parcels with dinosaurs (viewing spot on the nearest walkway) and the fixed facilities; cars use the front lot,
// whose slot count follows the parking tier.
import { DATA, state, bus, onChange, enclosures, parcelDef, parcelGeometry, tileIndex, speciesById, roleById, facilityTier, facilityById, facilityEffect, daySeconds, rnd, rndInt, clamp, pick } from '../state.js';
import { neighboursIn, tileKey } from '../tiles.js';
import { L, facilityRect, lotBlocks } from '../render/projection.js';
import * as G from './walkways.js';
import { play as playSfx, roarFor } from '../audio.js';
import { reduceMotion } from '../ui/effects.js';

const Lv = () => DATA.balance.living;
const A = () => DATA.balance.attendance;

// Visitor states
export const V_ENTER = 0, V_WALK = 1, V_DWELL = 2, V_LEAVE = 3, V_PANIC = 4, V_FOLLOW = 5, V_AMENITY = 6;
// Car states
export const C_IN = 0, C_PARKED = 1, C_OUT = 2;
// Staff states
const S_IDLE = 0, S_WALK = 1, S_WORK = 2, S_GATHER = 3;

export const visitors = [], cars = [], dinos = [], staff = [], litter = [], slots = [];
export const escape = { active: false, parcel: null, uid: null, left: 0, x: 0, y: 0 };
// Park Tram (visual only): shuttles along the forecourt track when the facility is above tier 0.
export const tram = { active: false, x: 0, y: 0, px: 0, dir: 1, cars: 0, pause: 0, stopped: false };
export const counts = { visitors: 0, cars: 0, dinos: 0, staff: 0, litter: 0 };
export let simTime = 0;
// Sim seconds covered by the last tick (0 while the clock is paused): the renderer eases animation time between ticks
// exactly like it interpolates positions, so procedural motion runs smooth at 60 fps and freezes with the clock.
export let tickDt = 0;
// M5 juice (all real-time, they run even while the clock is paused): the delivery truck that brings a bought
// dinosaur to the gate, the crate it leaves, dust puffs (prize placement, a dinosaur popping out), and the arrival
// queue. A dinosaur agent with `arriving` set is not drawn until its crate opens; `pop` is the pop-in progress.
export const truck = { active: false, x: 0, y: 0, px: 0, phase: 'in', t: 0, uid: null, crate: false, crateX: 0, crateY: 0 };
export const puffs = [];
export const arrivals = [];
const pendingArrivals = new Set();
let livingOn = false;
export function setLivingActive(v) {
  livingOn = !!v;
  if (!livingOn) drainArrivals();
  // The wait clock on queued deliveries starts when the scene is showing: a dinosaur bought in Town (the Dino Market
  // is a Town screen) still gets its truck when the player next opens the Park, however long they shopped.
  if (livingOn) for (const a of arrivals) a.at = performance.now();
}
export const arrivalStats = () => ({ queued: arrivals.length, truck: truck.active ? truck.phase : null, truck_species: truck.active ? truck.name : null, puffs: puffs.length, hidden: dinos.filter(d => d.arriving).length });

export const pois = [];        // { parcel, spots: [{ x, y, ax, ay, tx, ty, hw, spread }], weight }
export const amenities = [];   // { id, spots }
let spawnBudget = 0, litterBudget = 0, carCooldown = 0;
let lastStateRef = null, dinoSig = '', staffSig = '', lotSig = null, poiSig = '';
let blocked = () => false;
const VISITOR_COLORS = 8;
const WP = 24;

function makeWalker() {
  return { active: false, x: 0, y: 0, px: 0, py: 0, wx: new Float64Array(WP), wy: new Float64Array(WP), wn: 0, wi: 0, st: 0, timer: 0, speed: 1, dir: 1, lx: 0, ly: 0, lane: 0 };
}

export function initAgents({ paused }) {
  blocked = paused;
  G.buildGraph(DATA.parcels.walkways, tileIndex);
  const n = Lv().max_sprites;
  for (let i = 0; i < n; i++) visitors.push(Object.assign(makeWalker(), { color: 0, pois: 0, guide: -1, offx: 0, offy: 0, panic: 0, car: -1, amenityDone: false, poi: null, seed: Math.random() }));
  // Cars: `seed` (set per trip) picks style and colour in the renderer; `head` is the facing (0 E, 1 N, 2 W, 3 S),
  // `phead` last tick's, `rev` true while backing out of a bay (the car keeps facing into it).
  for (let i = 0; i < 80; i++) cars.push(Object.assign(makeWalker(), { slot: -1, seed: 0, head: 0, phead: 0, rev: false, style: 0, color: 0, lookSeed: -1 }));
  for (let i = 0; i < Lv().litter_max; i++) litter.push({ active: false, x: 0, y: 0, kind: 0 });
  onChange(sync);
  bus.addEventListener('escape', e => forceEscape(e.detail.parcel, e.detail.uid));
  bus.addEventListener('dino_arrival', e => queueArrival(e.detail));
  bus.addEventListener('prize', e => prizePuff(e.detail.prize));
  sync();
}

// ---- arrivals (delivery truck) ----
function queueArrival({ uid, parcel, size }) {
  // Motion reduced: the animal simply appears, and roars now. Otherwise every purchase is queued, whether or not the
  // living view is showing: the truck drives (and the roar plays) when the crate opens in the Park, so the player who
  // buys in Town and then clicks Park sees the delivery instead of an animal already standing in the pen.
  // M5 minor (Phase 2): the truck only runs while the Park is showing. A purchase made in Town (or with the survey
  // map up) appears in its pen at once and roars now; nothing is left queued for the next Park visit.
  if (reduceMotion() || !livingOn) { playSfx(roarFor(size), { gain: Lv().arrival_roar_gain ?? 1 }); return; }
  pendingArrivals.add(uid);
  arrivals.push({ uid, parcel, size, at: performance.now() });
  const a = dinos.find(d => d.uid === uid);
  if (a) a.arriving = true;
}
function revealDino(uid, withPop) {
  pendingArrivals.delete(uid);
  const a = dinos.find(d => d.uid === uid);
  if (!a) return null;
  a.arriving = false;
  if (withPop) { a.pop = Lv().pop_seconds || 0.5; a.popT = 0; puff(a.x, a.y, 7); }
  return a;
}
// Leaving the Park mid-delivery drains the queue at once (the animal is simply in its pen when the view returns).
export function drainArrivals() {
  while (arrivals.length) revealDino(arrivals.shift().uid, false);
  if (truck.active) { revealDino(truck.uid, false); truck.active = false; truck.crate = false; truck.uid = null; }
  for (const d of dinos) if (d.arriving) revealDino(d.uid, false);
  pendingArrivals.clear();
}
function tickArrivals(dt) {
  if (!livingOn) { if (arrivals.length || truck.active || pendingArrivals.size) drainArrivals(); return; }
  const maxWait = (Lv().arrival_max_wait_seconds ?? 45) * 1000;
  if (!truck.active && arrivals.length) {
    const next = arrivals.shift();
    if (performance.now() - next.at > maxWait || !dinos.some(d => d.uid === next.uid)) { revealDino(next.uid, false); return; }
    truck.active = true; truck.phase = 'in'; truck.t = 0; truck.uid = next.uid; truck.size = next.size; truck.crate = false;
    truck.name = dinos.find(d => d.uid === next.uid)?.name || '';
    truck.x = truck.px = -1.0; truck.y = L.ROAD_Y;
  }
  if (!truck.active) return;
  truck.px = truck.x;
  const sp = Lv().truck_speed || 3;
  if (truck.phase === 'in') {
    truck.x = Math.min(L.GATE.x, truck.x + sp * dt);
    if (truck.x >= L.GATE.x - 1e-6) { truck.phase = 'pause'; truck.t = Lv().truck_pause_seconds || 0.7; truck.crate = true; truck.crateX = L.GATE.x - 0.28; truck.crateY = L.GATE_OUT.y - 0.12; }
  } else if (truck.phase === 'pause') {
    truck.t -= dt;
    if (truck.t <= 0) { truck.phase = 'crate'; truck.t = Lv().crate_seconds || 0.45; }
  } else if (truck.phase === 'crate') {
    truck.t -= dt;
    if (truck.t <= 0) {
      truck.crate = false; truck.phase = 'out';
      const a = revealDino(truck.uid, true);
      playSfx(roarFor(a ? a.size : truck.size), { gain: Lv().arrival_roar_gain ?? 1 });
    }
  } else if (truck.phase === 'out') {
    truck.x += sp * dt;
    if (truck.x > L.PARK_W + 1.2) { truck.active = false; truck.uid = null; }
  }
}

// ---- puffs ----
export function puff(x, y, n = 6) {
  if (reduceMotion()) return;
  const life = Lv().puff_seconds || 0.8;
  for (let i = 0; i < n; i++) puffs.push({ x: x + rnd(-0.18, 0.18), y: y + rnd(-0.1, 0.1), t: 0, life: life * rnd(0.7, 1.1), r: rnd(3, 6), vx: rnd(-0.25, 0.25), vz: rnd(0.15, 0.45) });
}
function tickPuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.t += dt; if (p.t >= p.life) puffs.splice(i, 1); }
}
// A prize just landed: dust where it stands (data position(s); gate and fountain prizes at those spots).
function prizePuff(p) {
  if (!livingOn) return;
  const spots = p.positions ? p.positions.map(([x, y]) => [x, y]) : p.position ? [[p.position.x, p.position.y]] : p.render === 'fountain' ? [[L.CENTER.x, L.CENTER.y]] : [[L.GATE.x, L.PARK_H]];
  for (const [x, y] of spots) puff(x, y, spots.length > 4 ? 3 : 8);
}

// ---- routing helpers ----
function pushWp(a, x, y) { if (a.wn < WP) { a.wx[a.wn] = x; a.wy[a.wn] = y; a.wn++; } }

// Plan a route along the walkway graph from the walker's position to (tx,ty), then offset every waypoint sideways
// onto the walker's own lane so a crowd spreads across the path instead of forming one column.
// Phase 4 B1 (crowd flow): the old per-edge offset was applied on the INCOMING edge's axis only, so the route's
// entry point sat on the centreline and every corner zeroed the offset on the new edge; walkers then cut diagonally
// back toward the middle and ~half of them walked within 0.05 tiles of the centreline (a queue). Now each walker keeps
// a persistent lane (a fraction of the usable half-width, lane_jitter) with a small per-edge drift (lane_drift); the
// entry point takes the first edge's lane, and a corner takes BOTH edges' lanes (x from the vertical edge, y from the
// horizontal one), so a walker holds its line round a turn. route_jitter varies edge costs per route so near-equal
// routes (either side of the fountain, spine vs ring) share the load instead of everyone taking the same one.
const rawX = new Float64Array(WP), rawY = new Float64Array(WP), rawE = new Int32Array(WP), rawL = new Float64Array(WP);
let rawN = 0;
function planStep(x, y, edge) { if (rawN < WP) { rawX[rawN] = x; rawY[rawN] = y; rawE[rawN] = edge; rawN++; } }
const laneOff = (e, lane) => lane * Math.max(0, e.hw - Lv().lane_margin);
function planTo(a, tx, ty) {
  a.wn = 0; a.wi = 0; rawN = 0;
  G.route(a.x, a.y, tx, ty, planStep, Lv().route_jitter);
  const drift = Lv().lane_drift;
  for (let k = 0; k < rawN; k++) rawL[k] = clamp(a.lane + rnd(-drift, drift), -1, 1); // lane on the edge walked to reach k
  for (let k = 0; k < rawN; k++) {
    let x = rawX[k], y = rawY[k];
    const ein = rawE[k], eout = k + 1 < rawN ? rawE[k + 1] : -1;
    if (ein >= 0) { const e = G.edges[ein]; if (e.vertical) x += laneOff(e, rawL[k]); else y += laneOff(e, rawL[k]); }
    if (eout >= 0 && (ein < 0 || G.edges[eout].vertical !== G.edges[ein].vertical)) { const e = G.edges[eout]; if (e.vertical) x += laneOff(e, rawL[k + 1]); else y += laneOff(e, rawL[k + 1]); }
    pushWp(a, x, y);
  }
  if (Math.abs(a.wx[a.wn - 1] - tx) > 1e-6 || Math.abs(a.wy[a.wn - 1] - ty) > 1e-6) pushWp(a, tx, ty);
}
const newLane = () => rnd(-1, 1) * Lv().lane_jitter;
// Pull a point inside the fence onto the usable width of its nearest walkway (writes out.x/out.y; the forecourt
// outside the fence is open paving and is left alone).
const tmpF = { x: 0, y: 0 };
function onPath(x, y, out) {
  out.x = x; out.y = y;
  if (y >= L.PARK_H) return out;
  G.nearestOnGraph(x, y, nearP);
  if (nearP.edge < 0) return out;
  const e = G.edges[nearP.edge], lim = Math.max(0, e.hw - Lv().lane_margin);
  // across the path, and along it too: past a segment's end the paving runs on only by its half-width
  if (e.vertical) { out.x = nearP.x + clamp(x - nearP.x, -lim, lim); out.y = clamp(y, e.y0 - lim, e.y1 + lim); }
  else { out.y = nearP.y + clamp(y - nearP.y, -lim, lim); out.x = clamp(x, e.x0 - lim, e.x1 + lim); }
  return out;
}
// Off-walkway dwell point beside a point of interest: a random adjacent walkway, spread along that side,
// pushed toward the thing being looked at. Big parcels have several sides, so crowds spread around them.
// B1: the push toward the pen stops lane_margin short of the paving edge, so a drawn figure never stands on the verge.
function dwellPoint(p, out, alongF = null, towardF = null) {
  const s = p.spots[rndInt(0, p.spots.length - 1)];
  const along = alongF == null ? rnd(-s.spread, s.spread) : alongF * s.spread;
  const T = Lv().dwell_toward;
  const toward = towardF == null ? Math.min(s.hw * rnd(T[0], T[1]), s.hw - Lv().lane_margin) : s.hw * towardF;
  out.x = s.x + s.ax * along + s.tx * toward;
  out.y = s.y + s.ay * along + s.ty * toward;
  return out;
}
const tmpP = { x: 0, y: 0 }, nearP = { edge: -1, t: 0, x: 0, y: 0, d: 0 };

// Advance along the waypoint list. Returns true when the last waypoint is reached.
function step(a, dist) {
  while (a.wi < a.wn && dist > 0) {
    const tx = a.wx[a.wi], ty = a.wy[a.wi];
    const dx = tx - a.x, dy = ty - a.y;
    const d = Math.hypot(dx, dy);
    if (d <= dist) { a.x = tx; a.y = ty; a.wi++; dist -= d; }
    else { a.x += dx / d * dist; a.y += dy / d * dist; if (Math.abs(dx) > 0.01) a.dir = dx > 0 ? 1 : -1; dist = 0; }
  }
  return a.wi >= a.wn;
}

// ---- sync with game state (called on every change; cheap signatures skip rebuilds) ----
const rect = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, roofs: 0, rows: 0, render: null };
function sync() {
  if (state !== lastStateRef) { lastStateRef = state; resetAll(); }
  rebuildPois();
  syncDinos();
  syncStaff();
  syncSlots();
  syncTram();
}

function syncTram() {
  const cars = facilityRect('park_tram', facilityTier('park_tram'), rect).render?.cars || 0;
  if (cars === tram.cars && tram.active === cars > 0) return;
  tram.cars = cars; tram.active = cars > 0;
  tram.x = tram.px = L.TRAM.x0; tram.y = L.TRAM.y; tram.dir = 1; tram.pause = 0; tram.stopped = false;
}
function tickTram(dt) {
  if (!tram.active) return;
  tram.px = tram.x;
  if (tram.pause > 0) { tram.pause -= dt; return; }
  const sp = Lv().tram_speed || 1.5;
  const before = tram.x;
  tram.x += tram.dir * sp * dt;
  // pause at the stop (once per pass) and turn around at the ends of the track
  const stop = L.TRAM.stop_x;
  if (!tram.stopped && ((before < stop && tram.x >= stop) || (before > stop && tram.x <= stop))) { tram.x = stop; tram.pause = Lv().tram_pause_seconds || 2; tram.stopped = true; }
  if (tram.x >= L.TRAM.x1) { tram.x = L.TRAM.x1; tram.dir = -1; tram.pause = (Lv().tram_pause_seconds || 2) * 0.6; tram.stopped = false; }
  else if (tram.x <= L.TRAM.x0) { tram.x = L.TRAM.x0; tram.dir = 1; tram.pause = (Lv().tram_pause_seconds || 2) * 0.6; tram.stopped = false; }
}

function resetAll() {
  for (const v of visitors) v.active = false;
  for (const c of cars) c.active = false;
  for (const l of litter) l.active = false;
  dinos.length = 0; staff.length = 0; slots.length = 0;
  dinoSig = staffSig = poiSig = ''; lotSig = null;
  escape.active = false;
  truck.active = false; truck.crate = false; arrivals.length = 0; puffs.length = 0; pendingArrivals.clear();
  spawnBudget = litterBudget = 0; simTime = 0;
}

function rebuildPois() {
  let sig = '';
  for (const p of enclosures()) { let w = 0; for (const d of p.enclosure.dinos) w += speciesById(d.species).popularity; sig += `${p.id}:${w},`; }
  sig += '|' + facilityTier('food_stand') + facilityTier('gift_shop') + facilityTier('restrooms') + facilityTier('visitor_center');
  if (sig === poiSig) return;
  poiSig = sig;
  pois.length = 0; amenities.length = 0;
  for (const p of enclosures()) {
    if (!p.enclosure.dinos.length) continue;
    let w = 0;
    for (const d of p.enclosure.dinos) w += speciesById(d.species).popularity;
    pois.push({ parcel: p.id, weight: w, spots: G.spotsForTiles(parcelGeometry(p.id).tiles) });
  }
  if (pois.length) {
    const c = L.CENTER, hp = L.PLAZA_HALF;
    pois.push({ parcel: null, weight: Lv().plaza_poi_weight, spots: G.spotsForRect({ x0: c.x - hp, y0: c.y - hp, x1: c.x + hp, y1: c.y + hp }, 0.25) });
  }
  for (const f of DATA.facilities.facilities) {
    const open = f.effect_key === 'satisfaction' || ((f.effect_key === 'concession_spend' || f.effect_key === 'appeal_bonus') && facilityTier(f.id) > 0);
    if (!open || f.id === 'office') continue;
    const m = DATA.parcels.facilities[f.id];
    amenities.push({ id: f.id, spots: m && m.tiles ? G.spotsForTiles(m.tiles) : G.spotsForRect(facilityRect(f.id, facilityTier(f.id), rect), 0.3) });
  }
}

// Dinosaurs live on the parcel's tile set. Each agent keeps its current tile; wander targets are a random point in the
// current tile or a 4-adjacent tile of the same parcel (inset by the sprite's half-extent), so the straight-line move
// never leaves the shape even when the pen is an L, T, S or plus.
function randomTile(g) { return g.tiles[rndInt(0, g.tiles.length - 1)]; }
function pointInTile(a, tile, out) {
  const inset = Lv().dino_pen_inset[a.size] ?? Lv().dino_pen_inset.medium;
  const x0 = tile[0] + inset, x1 = tile[0] + 1 - inset;
  out.x = x1 > x0 ? rnd(x0, x1) : tile[0] + 0.5;
  out.y = rnd(tile[1] + 0.22, tile[1] + 1 - 0.12);
  return out;
}
const tmpT = { x: 0, y: 0 };
function syncDinos() {
  let sig = '';
  for (const p of enclosures()) for (const d of p.enclosure.dinos) sig += d.uid + ',';
  if (sig !== dinoSig) {
    dinoSig = sig;
    const keep = new Map();
    for (const a of dinos) keep.set(a.uid, a);
    dinos.length = 0;
    for (const p of enclosures()) {
      const g = parcelGeometry(p.id);
      for (const d of p.enclosure.dinos) {
        const sp = speciesById(d.species);
        let a = keep.get(d.uid);
        if (!a) {
          // seed: per-animal variety for the procedural walk / idle motion (render/living.js dinoPose), so a herd never
          // moves in lockstep; walkK / stride / lrx / lry are the renderer's own motion state.
          a = { uid: d.uid, x: 0, y: 0, px: 0, py: 0, tx: 0, ty: 0, moving: false, pause: rnd(0, Lv().dino_pause_ticks), dir: 1, phase: rnd(0, 6.28), escaped: false, tile: null, arriving: pendingArrivals.has(d.uid), pop: 0, popT: 0, seed: Math.random(), walkK: 0, stride: 0, lrx: NaN, lry: NaN, animAt: NaN };
          a.size = sp.size || 'medium';
          a.tile = randomTile(g);
          pointInTile(a, a.tile, tmpT); a.x = tmpT.x; a.y = tmpT.y;
        }
        a.px = a.x; a.py = a.y;
        a.d = d; a.sp = sp; a.parcel = p.id; a.size = sp.size || 'medium'; a.color = sp.color || '#888'; a.name = sp.name;
        a.g = g;
        // Home point (escape return, escape wander centre): the label tile centre, always inside the shape.
        a.hx = g.label[0] + 0.5; a.hy = g.label[1] + 0.5;
        if (!a.tile || !g.set.has(tileKey(a.tile[0], a.tile[1]))) { a.tile = g.label; }
        a.speed = Lv().dino_speed[a.size] ?? Lv().dino_speed.medium;
        dinos.push(a);
      }
    }
  } else { // refresh object refs (load replaces state objects but keeps uids)
    let k = 0;
    for (const p of enclosures()) for (const d of p.enclosure.dinos) { const a = dinos[k++]; a.d = d; a.sp = speciesById(d.species); a.color = a.sp.color || '#888'; }
  }
  if (escape.active && !dinos.some(a => a.uid === escape.uid)) endEscape();
}

function syncStaff() {
  let sig = '';
  for (const r of DATA.staff.roles) sig += state.staff.filter(s => s.role === r.id).length + ',';
  sig += '|' + facilityTier('food_stand') + facilityTier('gift_shop');
  if (sig === staffSig) return;
  staffSig = sig;
  staff.length = 0;
  const stores = DATA.facilities.facilities.filter(f => f.effect_key === 'concession_spend' && facilityTier(f.id) > 0);
  let storeSlot = 0;
  for (const w of state.staff) {
    const a = Object.assign(makeWalker(), { role: w.role, active: true, x: L.OFFICE_DOOR.x + rnd(-0.4, 0.4), y: L.OFFICE_DOOR.y, target: null, loop: 0, followers: 0, home: false, seed: Math.random(), lane: newLane() });
    a.px = a.x; a.py = a.y; a.speed = Lv().staff_walk_speed * rnd(0.9, 1.1);
    if (w.role === 'concessions') {
      const perStore = roleById('concessions').max_per_store || 2;
      const f = stores[Math.floor(storeSlot / perStore)];
      if (f) { facilityRect(f.id, facilityTier(f.id), rect); a.x = rect.x0 + 0.2 + (storeSlot % perStore) * 0.35; a.y = rect.y1 + 0.12; }
      storeSlot++;
      a.st = S_WORK; a.home = true;
    } else if (w.role === 'management') { a.x = L.OFFICE_DOOR.x + 0.5; a.y = L.OFFICE_DOOR.y; a.st = S_WORK; a.home = true; }
    else if (w.role === 'tour_guide') { a.x = L.GATE_IN.x + rnd(-0.2, 0.2); a.y = L.GATE_IN.y; a.st = S_GATHER; a.timer = Lv().guide_gather_ticks; }
    else { a.x = L.GATE_IN.x; a.y = L.GATE_IN.y; a.st = S_IDLE; }
    a.px = a.x; a.py = a.y;
    staff.push(a);
  }
  for (const v of visitors) if (v.active && v.st === V_FOLLOW) { v.guide = -1; v.st = V_LEAVE; planLeave(v); }
}

// Front lot: one slot per cars_per_capacity of daily capacity, laid out in the rows the parking tier renders, spread
// across the tier's stall blocks (the overflow tier has two, separated by a kerb strip: see projection.lotBlocks).
export const lotRect = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, roofs: 0, rows: 0, render: null };
export const lotBlockList = [];
function syncSlots() {
  const tier = facilityTier('parking_lot');
  if (tier === lotSig) return;
  lotSig = tier;
  slots.length = 0;
  facilityRect('parking_lot', tier, lotRect);
  const per = Lv().cars_per_capacity;
  const cap = A().front_gate_capacity + (facilityEffect('parking_lot', tier, 'parking_capacity') || 0);
  const n = Math.max(1, Math.floor(cap / per));
  const rows = Math.max(1, lotRect.rows);
  const blocks = lotBlocks(lotRect);
  lotBlockList.length = 0; for (const b of blocks) lotBlockList.push(b);
  const totalW = blocks.reduce((s, b) => s + (b.x1 - b.x0), 0);
  let left = n;
  blocks.forEach((b, bi) => {
    const share = bi === blocks.length - 1 ? left : Math.round(n * (b.x1 - b.x0) / totalW);
    left -= share;
    const cols = Math.max(1, Math.ceil(share / rows));
    const pitch = Math.max(L.LOT.minPitchX, (b.x1 - b.x0 - 0.2) / cols);
    for (let i = 0; i < share; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      slots.push({ x: b.x0 + 0.1 + pitch * c + pitch / 2, y: b.y0 + 0.14 + L.LOT.pitchY * r, car: -1, block: bi });
    }
  });
  // Slots moved. Re-seat parked cars into the new layout so an upgrade does not empty the lot for a few seconds;
  // cars still driving in start over (their old slot is gone) and cars driving out keep going.
  const parked = cars.filter(c => c.active && c.st === C_PARKED);
  for (const c of cars) { if (c.active && c.st === C_IN) c.active = false; c.slot = -1; }
  parked.forEach((c, i) => {
    if (i >= slots.length) { c.active = false; return; }
    const s = slots[i]; s.car = c; c.slot = i; c.x = c.px = s.x; c.y = c.py = s.y; c.head = c.phead = 0; c.rev = false;
  });
}

// ---- tick ----
// Agent countdowns (visitor dwell, dino pause, staff work) are counted in TICKS, but a tick covers `f` ticks of
// sim time at speed f. `TS` is that factor, so every countdown below runs on sim time: at 10x a dinosaur's pause
// is 5x shorter, not the same wall-clock wait that made a hungry animal look like a frozen sprite.
let TS = 1;
// `force` (DPS.selfTest) runs the tick even while a modal is open; the render loop never passes it.
export function tick(force = false) {
  for (const v of visitors) if (v.active) { v.px = v.x; v.py = v.y; }
  for (const c of cars) if (c.active) { c.px = c.x; c.py = c.y; c.phead = c.head; }
  for (const d of dinos) { d.px = d.x; d.py = d.y; }
  for (const s of staff) { s.px = s.x; s.py = s.y; }
  // Real-time juice runs whether or not the clock does (a purchase is made with the store modal open).
  const rdt = 1 / Lv().tick_hz;
  tickArrivals(rdt);
  tickPuffs(rdt);
  for (const d of dinos) if (d.pop > 0) { d.popT = (d.popT || 0) + rdt; if (d.popT >= d.pop) d.pop = 0; }
  const speed = state.speed;
  tickDt = 0;
  if (speed <= 0 || (!force && blocked()) || state.game_over) return;
  const f = Math.min(speed, Lv().max_speed_factor);
  TS = f;
  const dt = f / Lv().tick_hz;
  simTime += dt; tickDt = dt;
  tickEscape(dt);
  tickVisitors(dt);
  tickCars(dt);
  tickTram(dt);
  tickDinos(dt);
  tickStaff(dt);
  tickLitter(dt);
  recount();
}

function recount() {
  let v = 0, c = 0, l = 0;
  for (const a of visitors) if (a.active) v++;
  for (const a of cars) if (a.active) c++;
  for (const a of litter) if (a.active) l++;
  counts.visitors = v; counts.cars = c; counts.litter = l; counts.dinos = dinos.length; counts.staff = staff.length;
}

// ---- visitors ----
function tickVisitors(dt) {
  const attendance = state.closed_days > 0 ? 0 : state.today.attendance;
  const target = Math.min(Lv().max_sprites, Math.ceil(attendance * Lv().sprites_per_visitor));
  spawnBudget = Math.min(spawnBudget + attendance / daySeconds() * dt, 6);
  while (spawnBudget >= 1) {
    spawnBudget -= 1;
    if (counts.visitors < target) spawnVisitor();
  }
  for (let i = 0; i < visitors.length; i++) {
    const v = visitors[i];
    if (!v.active) continue;
    switch (v.st) {
      case V_ENTER: case V_WALK: case V_AMENITY:
        if (step(v, v.speed * dt)) { if (v.st === V_ENTER) arriveGate(v); else { v.st = V_DWELL; v.timer = Lv().dwell_ticks + rnd(0, Lv().dwell_ticks_jitter); } }
        break;
      case V_DWELL:
        if ((v.timer -= TS) <= 0) nextPoi(v);
        break;
      case V_LEAVE:
        if (step(v, v.speed * dt)) v.active = false;
        break;
      case V_PANIC: {
        const dx = v.x - escape.x, dy = v.y - escape.y, d = Math.hypot(dx, dy) || 1;
        v.x = clamp(v.x + dx / d * Lv().scatter_speed * dt, 0.1, L.PARK_W - 0.1);
        v.y = clamp(v.y + dy / d * Lv().scatter_speed * dt, 0.1, L.PARK_H - 0.15);
        v.dir = dx > 0 ? 1 : -1;
        if ((v.panic -= TS) <= 0) nextPoi(v);
        break;
      }
      case V_FOLLOW: {
        const g = staff[v.guide];
        if (!g || g.role !== 'tour_guide') { v.guide = -1; planLeave(v); break; }
        // B1: the group's world-space offset beside a guide walking its own lane could land on the verge, and a
        // follower catching up round a corner cut across the grass; both the spot and the follower stay on the path.
        onPath(g.x + v.offx, g.y + v.offy, tmpF);
        const tx = tmpF.x, ty = tmpF.y, dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
        const mv = v.speed * 1.1 * dt;
        if (d > mv) { v.x += dx / d * mv; v.y += dy / d * mv; if (Math.abs(dx) > 0.01) v.dir = dx > 0 ? 1 : -1; } else { v.x = tx; v.y = ty; }
        onPath(v.x, v.y, v);
        break;
      }
    }
    if (escape.active && v.st !== V_PANIC && v.st !== V_LEAVE && v.y < L.PARK_H) {
      const dx = v.x - escape.x, dy = v.y - escape.y;
      if (dx * dx + dy * dy < Lv().scatter_radius * Lv().scatter_radius) { if (v.st === V_FOLLOW) { const g = staff[v.guide]; if (g) g.followers--; v.guide = -1; } v.st = V_PANIC; v.panic = Lv().scatter_ticks; }
    }
  }
  counts.visitors = 0; for (const v of visitors) if (v.active) counts.visitors++;
}

export function spawnVisitor() {
  let v = null;
  for (let i = 0; i < visitors.length; i++) if (!visitors[i].active) { v = visitors[i]; break; }
  if (!v) return false;
  v.active = true;
  v.color = rndInt(0, VISITOR_COLORS - 1);
  v.speed = Lv().visitor_walk_speed * (1 + rnd(-Lv().visitor_walk_speed_jitter, Lv().visitor_walk_speed_jitter));
  v.pois = rndInt(Lv().poi_min, Lv().poi_max);
  v.amenityDone = false; v.panic = 0; v.guide = -1; v.poi = null;
  v.lx = rnd(-0.06, 0.06); v.ly = rnd(-0.06, 0.06);
  v.lane = newLane();
  const car = randomParkedCar();
  if (car) { v.x = car.x + rnd(-0.1, 0.1); v.y = car.y + 0.12; } else { v.x = rnd(0.3, 1.2); v.y = L.ROAD_Y - 0.28; }
  v.px = v.x; v.py = v.y;
  // Reserve a place in a gathering tour group when one has room; the visitor still walks in through the gate.
  for (let i = 0; i < staff.length; i++) {
    const g = staff[i];
    if (g.role === 'tour_guide' && g.st === S_GATHER && g.followers < Lv().guide_group_size) {
      g.followers++; v.guide = i;
      v.offx = rnd(-0.28, 0.28); v.offy = rnd(0.05, 0.3);
      break;
    }
  }
  v.st = V_ENTER;
  // B1: arrive on the walker's own lane through the gate (was a fixed +-0.15 funnel on the gate centreline).
  G.nearestOnGraph(L.GATE_IN.x, (L.GATE_IN.y + L.GATE_OUT.y) / 2, nearP);
  planTo(v, L.GATE_IN.x + (nearP.edge >= 0 ? laneOff(G.edges[nearP.edge], v.lane) : 0), L.GATE_IN.y + rnd(-0.1, 0.1));
  return true;
}

function arriveGate(v) {
  if (v.guide >= 0) {
    const g = staff[v.guide];
    if (g && g.role === 'tour_guide' && g.st === S_GATHER) { v.st = V_FOLLOW; return; }
    if (g && g.role === 'tour_guide') g.followers--;
    v.guide = -1;
  }
  nextPoi(v);
}

function randomParkedCar() {
  let n = 0;
  for (const c of cars) if (c.active && c.st === C_PARKED) n++;
  if (!n) return null;
  let k = rndInt(0, n - 1);
  for (const c of cars) if (c.active && c.st === C_PARKED) { if (k-- === 0) return c; }
  return null;
}

function pickPoi(exclude) {
  let total = 0;
  for (const p of pois) if (p.parcel !== exclude) total += p.weight;
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const p of pois) { if (p.parcel === exclude) continue; r -= p.weight; if (r <= 0) return p; }
  return pois[pois.length - 1];
}

function nextPoi(v) {
  if (v.pois > 0) {
    const p = pickPoi(v.poi);
    if (p) {
      v.pois--; v.poi = p.parcel; v.st = V_WALK;
      dwellPoint(p, tmpP);
      planTo(v, tmpP.x, tmpP.y);
      return;
    }
  }
  if (!v.amenityDone && amenities.length && Math.random() < Lv().amenity_visit_chance) {
    v.amenityDone = true; v.st = V_AMENITY;
    const a = amenities[rndInt(0, amenities.length - 1)];
    dwellPoint(a, tmpP);
    planTo(v, tmpP.x, tmpP.y);
    return;
  }
  planLeave(v);
}

function planLeave(v) {
  v.st = V_LEAVE;
  const car = randomParkedCar();
  if (car) planTo(v, car.x, car.y + 0.1); else planTo(v, rnd(0.3, 1.2), L.ROAD_Y - 0.28);
}

// ---- cars ----
function tickCars(dt) {
  if (slots.length) {
    let present = 0, incoming = 0;
    for (const c of cars) if (c.active) { if (c.st === C_OUT) continue; if (c.st === C_IN) incoming++; present++; }
    const wanted = Math.min(slots.length, Math.ceil(counts.visitors / Lv().visitors_per_car));
    // Hard guard (M4): the lot can never hold more cars than it has slots, whatever the tier or a re-seat left behind.
    if (present > slots.length) { for (const c of cars) { if (present <= slots.length) break; if (c.active && c.st === C_PARKED) { leaveCar(c); present--; } } }
    carCooldown -= dt;
    if (carCooldown <= 0) {
      if (present < wanted) { if (spawnCar()) carCooldown = 0.25; }
      else if (present - incoming > wanted) {
        for (const c of cars) if (c.active && c.st === C_PARKED) { leaveCar(c); carCooldown = 0.35; break; }
      }
    }
  }
  for (const c of cars) {
    if (!c.active || c.st === C_PARKED) continue;
    const done = step(c, Lv().car_speed * (c.rev ? Lv().car_reverse_factor : 1) * dt); // backing out is slow
    carHeading(c);
    if (done) {
      if (c.st === C_IN) c.st = C_PARKED;
      else { c.active = false; if (c.slot >= 0 && slots[c.slot] && slots[c.slot].car === c) slots[c.slot].car = -1; c.slot = -1; }
    }
  }
}

function spawnCar() {
  let s = -1;
  for (let i = 0; i < slots.length; i++) if (slots[i].car === -1) { s = i; break; }
  if (s < 0) return false;
  let inLot = 0;
  for (const k of cars) if (k.active && k.st !== C_OUT) inLot++;
  if (inLot >= slots.length) return false;
  let c = null;
  for (const k of cars) if (!k.active) { c = k; break; }
  if (!c) return false;
  const slot = slots[s];
  c.active = true; c.st = C_IN; c.slot = s; slot.car = c;
  c.seed = Math.random(); c.head = c.phead = 0; c.rev = false;
  c.wn = 0; c.wi = 0;
  // Phase 4 B2: in along the road, up the aisle beside the bay (car_aisle_offset west of it), then forward into the
  // bay, so every parked car sits side-on in its stall facing east.
  const ax = slot.x - Lv().car_aisle_offset;
  c.x = -0.7; c.y = L.ROAD_Y; pushWp(c, ax, L.ROAD_Y); pushWp(c, ax, slot.y); pushWp(c, slot.x, slot.y);
  c.px = c.x; c.py = c.y;
  return true;
}

// Leaving: back out of the bay into the aisle (still facing into it), drive down the aisle to the road, then away east.
function leaveCar(c) {
  const slot = slots[c.slot];
  c.st = C_OUT; c.wn = 0; c.wi = 0; c.rev = true;
  if (slot) slot.car = -1;
  const ax = c.x - Lv().car_aisle_offset;
  pushWp(c, ax, c.y); pushWp(c, ax, L.ROAD_Y); pushWp(c, L.PARK_W + 0.8, L.ROAD_Y);
}
// Facing follows the leg being driven (not the tick's displacement, which cuts corners); a car backing out keeps its
// facing until it reaches the aisle, and an arrived car keeps the facing it parked with.
function carHeading(c) {
  if (c.wi >= c.wn) return;
  if (c.rev) { if (c.wi === 0) return; c.rev = false; }
  const dx = c.wx[c.wi] - c.x, dy = c.wy[c.wi] - c.y;
  if (Math.abs(dx) + Math.abs(dy) < 1e-6) return;
  c.head = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy < 0 ? 1 : 3);
}

// ---- dinosaurs ----
function tickDinos(dt) {
  const B = DATA.balance.dinosaur;
  for (const a of dinos) {
    a.phase += dt * Lv().dino_bob_hz * 6.283;
    const hungry = a.d.hunger >= Lv().dino_hungry_threshold;
    let sp = a.speed * (hungry ? Lv().dino_hungry_speed_factor : 1) * (a.d.sick_days > 0 ? 0.6 : 1) * (a.d.hunger >= B.hunger_max ? 0.6 : 1);
    if (a.escaped) sp = a.speed * 1.3;
    if (!a.moving) {
      if ((a.pause -= TS) <= 0) {
        if (a.escaped) {
          const r = Lv().escape_wander_radius;
          // wander around the pen but never back inside it: retry a few times, then push out past the bbox
          for (let tries = 0; tries < 6; tries++) {
            a.tx = clamp(a.hx + rnd(-r, r), 0.2, L.PARK_W - 0.2);
            a.ty = clamp(a.hy + rnd(-r, r), 0.2, L.PARK_H - 0.2);
            if (!a.g.set.has(tileKey(Math.floor(a.tx), Math.floor(a.ty)))) break;
          }
          if (a.g.set.has(tileKey(Math.floor(a.tx), Math.floor(a.ty)))) { const b = a.g.bbox; a.tx = clamp(a.tx < a.hx ? b.x0 - 0.5 : b.x1 + 0.5, 0.2, L.PARK_W - 0.2); }
        } else {
          const next = neighboursIn(a.g.tiles, a.tile[0], a.tile[1]);
          const tile = next.length && Math.random() < 0.7 ? pick(next) : a.tile;
          a.nextTile = tile;
          pointInTile(a, tile, tmpT); a.tx = tmpT.x; a.ty = tmpT.y;
          idleRoar(a);
        }
        a.moving = true;
      }
      continue;
    }
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), mv = sp * dt;
    if (d <= mv) { a.x = a.tx; a.y = a.ty; a.moving = false; if (!a.escaped && a.nextTile) a.tile = a.nextTile; a.pause = Lv().dino_pause_ticks + rnd(0, Lv().dino_pause_ticks_jitter); if (a.escaped) a.pause *= 0.4; }
    else { a.x += dx / d * mv; a.y += dy / d * mv; if (Math.abs(dx) > 0.01) a.dir = dx > 0 ? 1 : -1; }
    if (a.escaped) { escape.x = a.x; escape.y = a.y; }
  }
}

// Occasional idle roar when a wandering animal sets off (data/sfx.json idle_roar: chance per move, min gap), by size.
let lastRoarAt = -Infinity;
function idleRoar(a) {
  const R = (DATA.sfx && DATA.sfx.idle_roar) || {};
  if (a.arriving || !livingOn) return;
  if (simTime - lastRoarAt < (R.min_gap_seconds ?? 9) || Math.random() >= (R.chance_per_move ?? 0.05)) return;
  lastRoarAt = simTime;
  playSfx(roarFor(a.size), { gain: R.idle_roar_gain ?? 0.55 });
}

// ---- escape (visual only) ----
export function forceEscape(parcelId, uid = null) {
  const a = dinos.find(d => d.parcel === parcelId && (uid == null || d.uid === uid));
  if (!a) return false;
  if (escape.active) endEscape();
  escape.active = true; escape.parcel = parcelId; escape.uid = a.uid; escape.left = Lv().escape_seconds;
  escape.x = a.x; escape.y = a.y;
  a.escaped = true; a.moving = false; a.pause = 0;
  return true;
}
function endEscape() {
  const a = dinos.find(d => d.uid === escape.uid);
  // Snap back inside the pen rather than walking home through the fence: once the LOOSE banner is gone a dinosaur
  // on the path with no explanation reads as a bug.
  if (a) { a.escaped = false; a.moving = false; a.tile = a.g.label; a.x = a.px = a.hx; a.y = a.py = a.hy; a.pause = Lv().dino_pause_ticks; }
  escape.active = false;
}
function tickEscape(dt) {
  if (!escape.active) return;
  escape.left -= dt;
  if (escape.left <= 0) endEscape();
}

// ---- staff ----
function sickPens() { let n = 0; for (const p of enclosures()) if (p.enclosure.dinos.some(d => d.sick_days > 0 || d.health < 50)) n++; return n; }
function nthSickPen(k) { for (const p of enclosures()) if (p.enclosure.dinos.some(d => d.sick_days > 0 || d.health < 50)) { if (k-- === 0) return p.id; } return null; }
const spot = { x: 0, y: 0 };
const spotCache = new Map();
function viewSpot(parcelId, out) { let sp = spotCache.get(parcelId); if (!sp) { sp = G.spotsForTiles(parcelGeometry(parcelId).tiles); spotCache.set(parcelId, sp); } return dwellPoint({ spots: sp }, out); }

function tickStaff(dt) {
  for (let i = 0; i < staff.length; i++) {
    const s = staff[i];
    if (s.home) continue;
    switch (s.role) {
      case 'maintenance': tickMaintenance(s, dt); break;
      case 'security': tickSecurity(s, dt); break;
      case 'veterinary': tickVet(s, dt); break;
      case 'tour_guide': tickGuide(s, i, dt); break;
    }
  }
}

function nearestLitter(s) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < litter.length; i++) {
    const l = litter[i];
    if (!l.active) continue;
    const d = (l.x - s.x) ** 2 + (l.y - s.y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function tickMaintenance(s, dt) {
  if (s.st === S_IDLE) {
    const k = nearestLitter(s);
    if (k >= 0) { s.target = k; const l = litter[k]; planTo(s, l.x, l.y); s.st = S_WALK; }
    else if ((s.timer -= TS) <= 0) { const n = G.randomNode(); planTo(s, n.x, n.y); s.st = S_WALK; s.target = -1; }
  } else if (s.st === S_WALK) {
    if (step(s, s.speed * dt)) { if (s.target >= 0) { s.st = S_WORK; s.timer = Lv().sweep_ticks; } else { s.st = S_IDLE; s.timer = 40; } }
  } else if (s.st === S_WORK) {
    if ((s.timer -= TS) <= 0) { if (s.target >= 0) litter[s.target].active = false; s.target = -1; s.st = S_IDLE; s.timer = 0; }
  }
}

// Security walks pen to pen: a viewing spot at a random enclosure, then a random walkway node, then the next pen.
function tickSecurity(s, dt) {
  if (s.st === S_IDLE) {
    if ((s.timer -= TS) > 0) return;
    const pens = enclosures();
    if (s.loop % 2 === 0 && pens.length) { const p = pens[rndInt(0, pens.length - 1)]; viewSpot(p.id, spot); planTo(s, spot.x, spot.y); }
    else { const n = G.randomNode(); planTo(s, n.x, n.y); }
    s.loop = (s.loop + 1) % 2;
    s.st = S_WALK;
  } else if (step(s, s.speed * dt)) { s.st = S_IDLE; s.timer = Lv().security_pause_ticks; }
}

function tickVet(s, dt) {
  if (s.st === S_IDLE) {
    if ((s.timer -= TS) > 0) return;
    const n = sickPens();
    if (n) { s.target = nthSickPen(rndInt(0, n - 1)); viewSpot(s.target, spot); planTo(s, spot.x, spot.y); s.st = S_WALK; }
    else if (s.y < L.PARK_H) { planTo(s, L.OFFICE_DOOR.x - 0.3, L.OFFICE_DOOR.y); s.st = S_WALK; s.target = null; }
    else s.timer = 40;
  } else if (s.st === S_WALK) {
    if (step(s, s.speed * dt)) { if (s.target) { s.st = S_WORK; s.timer = Lv().vet_dwell_ticks; } else { s.st = S_IDLE; s.timer = 40; } }
  } else if (s.st === S_WORK && (s.timer -= TS) <= 0) { s.st = S_IDLE; s.timer = 10; }
}

function tickGuide(s, idx, dt) {
  if (s.st === S_GATHER) {
    if ((s.timer -= TS) <= 0 || s.followers >= Lv().guide_group_size) {
      if (pois.length) { s.loop = 0; s.st = S_IDLE; s.timer = 0; }
      else s.timer = Lv().guide_gather_ticks;
    }
  } else if (s.st === S_IDLE) {
    if ((s.timer -= TS) > 0) return;
    if (s.loop < 3) { const p = pickPoi(s.target); if (p) { s.target = p.parcel; dwellPoint(p, spot, 0, 0.5); planTo(s, spot.x, spot.y); s.loop++; s.st = S_WALK; return; } }
    planTo(s, L.GATE_IN.x, L.GATE_IN.y); s.loop = 99; s.st = S_WALK;
  } else if (s.st === S_WALK) {
    if (step(s, s.speed * dt)) {
      if (s.loop === 99) { // back at the gate: release the group
        for (const v of visitors) if (v.active && v.st === V_FOLLOW && v.guide === idx) { v.guide = -1; planLeave(v); }
        s.followers = 0; s.st = S_GATHER; s.timer = Lv().guide_gather_ticks;
      } else { s.st = S_IDLE; s.timer = Lv().guide_dwell_ticks; }
    }
  }
}

// ---- litter ----
function placeLitter(l) {
  for (let i = 0; i < 6; i++) { G.randomPointOnEdge(l); if (l.y < L.PARK_H - 0.05) break; } // keep litter inside the fence
  l.kind = rndInt(0, 2);
  l.active = true;
}
function tickLitter(dt) {
  const target = Math.round(Lv().litter_max * (1 - state.cleanliness / 100));
  let n = 0;
  for (const l of litter) if (l.active) n++;
  litterBudget += Lv().litter_regen_per_second * dt;
  while (litterBudget >= 1) {
    litterBudget -= 1;
    if (n < target) { for (const l of litter) if (!l.active) { placeLitter(l); n++; break; } }
    else if (n > target + 4) { for (const l of litter) if (l.active) { l.active = false; n--; break; } }
  }
}

export function agentCounts() { recount(); return { ...counts, escape: escape.active ? escape.parcel : null }; }
export function spawnVisitors(n) { let k = 0; for (let i = 0; i < n; i++) if (spawnVisitor()) k++; recount(); return k; }

// ---- crowd metric (phase 4 B1): does the walking crowd use the width of the paths, or walk in single file? ----
// Samples every visitor walking inside the fence on a straight stretch (farther than crowd_junction_skip from any
// junction, where two centrelines meet and "offset" is ambiguous) at its DRAWN position (sim + render offset).
//   centre_share        share within crowd_centre_band of the walkway centreline (single file ~1, an even crowd ~0.2)
//   spine_centre_share  the same on the spine (the vertical walkways through the gate)
//   lateral_rms         RMS offset as a fraction of the paving half-width
//   overlap_share       walkers with another walker within crowd_overlap tiles (sprites drawn on top of each other)
//   dwell_overlap_share the same for visitors standing at a pen or amenity (viewing spots bunching)
//   off_path            visitors (any state but panic) off the paving inside the fence, in the fountain, or inside a
//                       forecourt building; must be 0. `off_by_state` splits it by visitor state.
const WALKING = s => s === V_ENTER || s === V_WALK || s === V_AMENITY || s === V_LEAVE;
export function onPaving(x, y) {
  if (y >= L.PARK_H) { // forecourt / strip: anywhere but inside a building
    for (const id in L.facilities) {
      const f = L.facilities[id];
      if (f.kind !== 'building' || f.y0 < L.PARK_H) continue;
      facilityRect(id, facilityTier(id), rect);
      if (x > rect.x0 && x < rect.x1 && y > rect.y0 && y < rect.y1) return false;
    }
    return true;
  }
  const P = L.PLAZA;
  if (x >= P.x0 && x <= P.x1 && y >= P.y0 && y <= P.y1) return Math.hypot(x - L.CENTER.x, y - L.CENTER.y) > L.FOUNTAIN_R * 1.22;
  for (const w of L.walkways) {
    const hw = w.w / 2;
    if (x >= Math.min(w.from[0], w.to[0]) - hw && x <= Math.max(w.from[0], w.to[0]) + hw && y >= Math.min(w.from[1], w.to[1]) - hw && y <= Math.max(w.from[1], w.to[1]) + hw) return true;
  }
  return false;
}
export function crowdStats() {
  const band = Lv().crowd_centre_band, skip = Lv().crowd_junction_skip, ov = Lv().crowd_overlap;
  let n = 0, centre = 0, sn = 0, scentre = 0, sq = 0, walkers = 0, overlap = 0, off = 0, dwellers = 0, dwellOverlap = 0;
  const offBy = {}, offAt = []; // offAt: the first few offenders, for diagnosis
  for (const v of visitors) {
    if (!v.active) continue;
    const x = v.x + v.lx, y = v.y + v.ly;
    if (v.st !== V_PANIC && !onPaving(x, y)) { off++; offBy[v.st] = (offBy[v.st] || 0) + 1; if (offAt.length < 3) offAt.push({ st: v.st, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }); }
    if (v.st === V_DWELL) {
      dwellers++;
      for (const o of visitors) if (o !== v && o.active && o.st === V_DWELL && Math.abs(o.x + o.lx - x) < ov && Math.abs(o.y + o.ly - y) < ov) { dwellOverlap++; break; }
    }
    if (!WALKING(v.st) || y >= L.PARK_H) continue;
    walkers++;
    for (const o of visitors) if (o !== v && o.active && WALKING(o.st) && Math.abs(o.x + o.lx - x) < ov && Math.abs(o.y + o.ly - y) < ov) { overlap++; break; }
    let atJunction = false;
    for (const nd of G.nodes) if (Math.abs(nd.x - x) < skip && Math.abs(nd.y - y) < skip) { atJunction = true; break; }
    if (atJunction) continue;
    G.nearestOnGraph(x, y, nearP);
    const e = G.edges[nearP.edge];
    n++; sq += (nearP.d / e.hw) ** 2;
    if (nearP.d < band) centre++;
    if (e.vertical && Math.abs(e.x0 - L.GATE.x) < 1e-6) { sn++; if (nearP.d < band) scentre++; }
  }
  const r = x => Math.round(x * 1000) / 1000;
  return { visitors: counts.visitors, walkers, sampled: n, centre_share: n ? r(centre / n) : null, spine_sampled: sn, spine_centre_share: sn ? r(scentre / sn) : null,
    lateral_rms: n ? r(Math.sqrt(sq / n)) : null, overlap_share: walkers ? r(overlap / walkers) : null, dwellers, dwell_overlap_share: dwellers ? r(dwellOverlap / dwellers) : null,
    off_path: off, off_by_state: offBy, off_at: offAt };
}
