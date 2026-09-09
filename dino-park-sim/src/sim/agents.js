// Living Park agents: visitors, cars, dinosaurs, staff, litter. Fixed-rate tick (balance.living.tick_hz),
// decoupled from rendering; the renderer interpolates between (px,py) and (x,y). All positions are
// world coords (tile units, see render/projection.js). Visual only: nothing here touches the economy.
// Pools are preallocated; the per-tick loops do not allocate.
// M2.5: routing runs on the walkway graph from data/parcels.json (sim/walkways.js); points of interest are
// parcels with dinosaurs (viewing spot on the nearest walkway) and the fixed facilities; cars use the front lot,
// whose slot count follows the parking tier.
import { DATA, state, bus, onChange, enclosures, parcelDef, parcelGeometry, tileIndex, speciesById, roleById, facilityTier, facilityById, rnd, rndInt, clamp, pick } from '../state.js';
import { neighboursIn, tileKey } from '../tiles.js';
import { L, facilityRect } from '../render/projection.js';
import * as G from './walkways.js';

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
export const counts = { visitors: 0, cars: 0, dinos: 0, staff: 0, litter: 0 };
export let simTime = 0;

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
  for (let i = 0; i < n; i++) visitors.push(Object.assign(makeWalker(), { color: 0, pois: 0, guide: -1, offx: 0, offy: 0, panic: 0, car: -1, amenityDone: false, poi: null }));
  for (let i = 0; i < 80; i++) cars.push(Object.assign(makeWalker(), { slot: -1, color: 0 }));
  for (let i = 0; i < Lv().litter_max; i++) litter.push({ active: false, x: 0, y: 0, kind: 0 });
  onChange(sync);
  bus.addEventListener('escape', e => forceEscape(e.detail.parcel, e.detail.uid));
  sync();
}

// ---- routing helpers ----
function pushWp(a, x, y) { if (a.wn < WP) { a.wx[a.wn] = x; a.wy[a.wn] = y; a.wn++; } }

// Plan a route along the walkway graph from the walker's position to (tx,ty). Each waypoint is offset sideways
// within the walkway (lane jitter, re-rolled per edge) so a crowd spreads across the path instead of forming one column.
let planA = null, planLastEdge = -1;
function planStep(x, y, edge) {
  const a = planA;
  if (edge >= 0) {
    const e = G.edges[edge];
    if (edge !== planLastEdge) { a.lane = (Math.random() * 2 - 1) * Lv().lane_jitter; planLastEdge = edge; }
    const off = a.lane * Math.max(0, e.hw - 0.07);
    if (e.vertical) x += off; else y += off;
  }
  pushWp(a, x, y);
}
function planTo(a, tx, ty) {
  a.wn = 0; a.wi = 0;
  planA = a; planLastEdge = -1;
  G.route(a.x, a.y, tx, ty, planStep);
  if (Math.abs(a.wx[a.wn - 1] - tx) > 1e-6 || Math.abs(a.wy[a.wn - 1] - ty) > 1e-6) pushWp(a, tx, ty);
  planA = null;
}
// Off-walkway dwell point beside a point of interest: a random adjacent walkway, spread along that side,
// pushed toward the thing being looked at. Big parcels have several sides, so crowds spread around them.
function dwellPoint(p, out, alongF = null, towardF = null) {
  const s = p.spots[rndInt(0, p.spots.length - 1)];
  const along = alongF == null ? rnd(-s.spread, s.spread) : alongF * s.spread;
  const toward = towardF == null ? s.hw * rnd(0.15, 0.85) : s.hw * towardF;
  out.x = s.x + s.ax * along + s.tx * toward;
  out.y = s.y + s.ay * along + s.ty * toward;
  return out;
}
const tmpP = { x: 0, y: 0 };

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
const rect = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, roofs: 0, rows: 0 };
function sync() {
  if (state !== lastStateRef) { lastStateRef = state; resetAll(); }
  rebuildPois();
  syncDinos();
  syncStaff();
  syncSlots();
}

function resetAll() {
  for (const v of visitors) v.active = false;
  for (const c of cars) c.active = false;
  for (const l of litter) l.active = false;
  dinos.length = 0; staff.length = 0; slots.length = 0;
  dinoSig = staffSig = poiSig = ''; lotSig = null;
  escape.active = false;
  spawnBudget = litterBudget = 0; simTime = 0;
}

function rebuildPois() {
  let sig = '';
  for (const p of enclosures()) { let w = 0; for (const d of p.enclosure.dinos) w += speciesById(d.species).popularity; sig += `${p.id}:${w},`; }
  sig += '|' + facilityTier('food_stand') + facilityTier('gift_shop') + facilityTier('restrooms');
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
    const open = f.effect_key === 'satisfaction' || (f.effect_key === 'concession_spend' && facilityTier(f.id) > 0);
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
          a = { uid: d.uid, x: 0, y: 0, px: 0, py: 0, tx: 0, ty: 0, moving: false, pause: rnd(0, Lv().dino_pause_ticks), dir: 1, phase: rnd(0, 6.28), escaped: false, tile: null };
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
    const a = Object.assign(makeWalker(), { role: w.role, active: true, x: L.OFFICE_DOOR.x + rnd(-0.4, 0.4), y: L.OFFICE_DOOR.y, target: null, loop: 0, followers: 0, home: false });
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

// Front lot: one slot per cars_per_capacity of daily capacity, laid out in the rows the parking tier renders.
export const lotRect = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, roofs: 0, rows: 0 };
function syncSlots() {
  const tier = facilityTier('parking_lot');
  if (tier === lotSig) return;
  lotSig = tier;
  slots.length = 0;
  facilityRect('parking_lot', tier, lotRect);
  const per = Lv().cars_per_capacity;
  const cap = A().front_gate_capacity + (facilityById('parking_lot').tiers.find(t => t.tier === tier)?.effect_magnitude || 0);
  const n = Math.max(1, Math.floor(cap / per));
  const rows = Math.max(1, lotRect.rows);
  const cols = Math.ceil(n / rows);
  const pitch = Math.max(L.LOT.minPitchX, (lotRect.x1 - lotRect.x0 - 0.2) / cols);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    slots.push({ x: lotRect.x0 + 0.1 + pitch * c + pitch / 2, y: lotRect.y0 + 0.14 + L.LOT.pitchY * r, car: -1 });
  }
  // Slots moved. Re-seat parked cars into the new layout so an upgrade does not empty the lot for a few seconds;
  // cars still driving in start over (their old slot is gone) and cars driving out keep going.
  const parked = cars.filter(c => c.active && c.st === C_PARKED);
  for (const c of cars) { if (c.active && c.st === C_IN) c.active = false; c.slot = -1; }
  parked.forEach((c, i) => {
    if (i >= slots.length) { c.active = false; return; }
    const s = slots[i]; s.car = c; c.slot = i; c.x = c.px = s.x; c.y = c.py = s.y;
  });
}

// ---- tick ----
// Agent countdowns (visitor dwell, dino pause, staff work) are counted in TICKS, but a tick covers `f` ticks of
// sim time at speed f. `TS` is that factor, so every countdown below runs on sim time: at 10x a dinosaur's pause
// is 5x shorter, not the same wall-clock wait that made a hungry animal look like a frozen sprite.
let TS = 1;
export function tick() {
  for (const v of visitors) if (v.active) { v.px = v.x; v.py = v.y; }
  for (const c of cars) if (c.active) { c.px = c.x; c.py = c.y; }
  for (const d of dinos) { d.px = d.x; d.py = d.y; }
  for (const s of staff) { s.px = s.x; s.py = s.y; }
  const speed = state.speed;
  if (speed <= 0 || blocked() || state.game_over) return;
  const f = Math.min(speed, Lv().max_speed_factor);
  TS = f;
  const dt = f / Lv().tick_hz;
  simTime += dt;
  tickEscape(dt);
  tickVisitors(dt);
  tickCars(dt);
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
  spawnBudget = Math.min(spawnBudget + attendance / Lv().day_seconds * dt, 6);
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
        const tx = g.x + v.offx, ty = g.y + v.offy, dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
        const mv = v.speed * 1.1 * dt;
        if (d > mv) { v.x += dx / d * mv; v.y += dy / d * mv; if (Math.abs(dx) > 0.01) v.dir = dx > 0 ? 1 : -1; } else { v.x = tx; v.y = ty; }
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
  planTo(v, L.GATE_IN.x + rnd(-0.15, 0.15), L.GATE_IN.y + rnd(-0.1, 0.1));
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
    if (step(c, Lv().car_speed * dt)) {
      if (c.st === C_IN) c.st = C_PARKED;
      else { c.active = false; if (c.slot >= 0 && slots[c.slot] && slots[c.slot].car === c) slots[c.slot].car = -1; c.slot = -1; }
    }
  }
}

function spawnCar() {
  let s = -1;
  for (let i = 0; i < slots.length; i++) if (slots[i].car === -1) { s = i; break; }
  if (s < 0) return false;
  let c = null;
  for (const k of cars) if (!k.active) { c = k; break; }
  if (!c) return false;
  const slot = slots[s];
  c.active = true; c.st = C_IN; c.slot = s; slot.car = c;
  c.color = rndInt(0, 7);
  c.wn = 0; c.wi = 0;
  c.x = -0.7; c.y = L.ROAD_Y; pushWp(c, slot.x, L.ROAD_Y); pushWp(c, slot.x, slot.y);
  c.px = c.x; c.py = c.y;
  return true;
}

function leaveCar(c) {
  const slot = slots[c.slot];
  c.st = C_OUT; c.wn = 0; c.wi = 0;
  if (slot) slot.car = -1;
  pushWp(c, c.x, L.ROAD_Y); pushWp(c, L.PARK_W + 0.8, L.ROAD_Y);
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
