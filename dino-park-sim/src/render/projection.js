// World -> screen projection for the Living Park. 2.5D OBLIQUE (three-quarter) view.
//
// World space is in tile units: a 1x1 parcel is a 1x1 square, walkways run between parcels, z is height.
// The sim only ever deals in world coords; this is the single place that knows about pixels.
// Swapping placeholder art for real sprites in Phase 3 changes this file and living.js only.
//
// Oblique rules:  sx = OX + x*TW + y*SHEAR      (rows further down the screen shift right,
//                 sy = OY + y*TH - z*ZH          so the east (+x) face of every box is visible)
// Tiles project to parallelograms, walls to vertical quads, boxes show top + front + east faces.
// Painter's algorithm: sort by depth() = world y (front rows draw last), x breaks ties.
//
// M2.5: every layout number (park size, plaza, gate, lot, office, pixel scale) comes from data/parcels.json.
// initProjection() must run after loadData(); the exported L object is filled in place so importers keep one reference.

import { DATA, parcelAtTile, facilityTierDef } from '../state.js';

export const BASE_W = 960, BASE_H = 540;

// Layout, filled by initProjection(). Pixel scale: TW/TH px per world unit, SHEAR the oblique lean, ZH px per unit of height.
export const L = {
  TW: 72, TH: 45, SHEAR: 8, ZH: 48,
  PARK_W: 12, PARK_H: 8.5, STRIP_H: 1.8, WORLD_H: 10.3,
  CENTER: { x: 6, y: 4.2 }, PLAZA_HALF: 0.6, FOUNTAIN_R: 0.32,
  GATE: { x: 6, y: 8.5, halfGap: 0.45 }, GATE_IN: { x: 6, y: 8.275 }, GATE_OUT: { x: 6, y: 8.85 },
  ROAD_Y: 10.08,
  LOT: { x0: 0.3, y0: 9.1 },
  OFFICE: { x0: 8.9, y0: 9.1, x1: 11.2, y1: 9.65, h: 0.55 }, OFFICE_DOOR: { x: 10.05, y: 9.83 },
  OX: 0, OY: 0,
  walkways: [], facilities: {}
};

export function initProjection() {
  const D = DATA.parcels;
  Object.assign(L, { TW: D.projection.tile_w, TH: D.projection.tile_h, SHEAR: D.projection.shear, ZH: D.projection.z });
  L.PARK_W = D.park.w; L.PARK_H = D.park.h; L.STRIP_H = D.park.strip_h; L.WORLD_H = D.park.h + D.park.strip_h;
  // Plaza is a block of whole tiles (M2.6): centre and half-size derive from it.
  L.PLAZA = { x0: D.plaza.x0, y0: D.plaza.y0, x1: D.plaza.x1, y1: D.plaza.y1 };
  L.CENTER = { x: (D.plaza.x0 + D.plaza.x1) / 2, y: (D.plaza.y0 + D.plaza.y1) / 2 }; L.PLAZA_HALF = (D.plaza.x1 - D.plaza.x0) / 2; L.FOUNTAIN_R = D.plaza.fountain_r;
  L.GATE = { x: D.gate.x, y: L.PARK_H, halfGap: D.gate.half_gap };
  L.GATE_OUT = { x: D.gate.x, y: D.gate.out_y };
  const gw = D.walkways.find(w => Math.abs(w.to[1] - D.gate.out_y) < 1e-6 && Math.abs(w.to[0] - D.gate.x) < 1e-6);
  L.GATE_IN = gw ? { x: gw.from[0], y: gw.from[1] } : { x: D.gate.x, y: L.PARK_H - 0.25 };
  L.ROAD_Y = L.WORLD_H - D.road_y_from_bottom;
  L.LOT = { x0: D.facilities.parking_lot.x0, y0: D.facilities.parking_lot.y0, pitchY: D.lot.slot_pitch_y, minPitchX: D.lot.slot_min_pitch_x };
  const o = D.facilities.office;
  L.OFFICE = { x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, h: facilityTierDef('office', 0).render_size.z };
  L.OFFICE_DOOR = { x: o.door_x, y: o.y1 + 0.18 };
  L.walkways = D.walkways;
  // Facilities: buildings are authored as tile lists (M2.6); their max footprint is the tile bbox. The lot and office keep explicit rects.
  L.facilities = {};
  for (const id in D.facilities) {
    const f = D.facilities[id];
    if (f.tiles) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of f.tiles) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
      L.facilities[id] = { ...f, x0, y0, x1, y1 };
    } else L.facilities[id] = { ...f };
  }
  // Screen origin: centre the whole world (including shear) on the logical canvas.
  const sceneW = L.PARK_W * L.TW + L.WORLD_H * L.SHEAR, sceneH = L.WORLD_H * L.TH;
  L.OX = Math.round((BASE_W - sceneW) / 2);
  L.OY = Math.round((BASE_H - sceneH) / 2) + (D.projection.oy_offset || 0);
}

// The one mapping. Writes into `out` so hot loops do not allocate.
export function project(x, y, z, out) {
  out.x = L.OX + x * L.TW + y * L.SHEAR;
  out.y = L.OY + y * L.TH - z * L.ZH;
  return out;
}
export const projX = (x, y) => L.OX + x * L.TW + y * L.SHEAR;
export const projY = (y, z) => L.OY + y * L.TH - z * L.ZH;

// Inverse at a given height (hit testing).
export function unproject(sx, sy, z, out) {
  out.y = (sy - L.OY + z * L.ZH) / L.TH;
  out.x = (sx - L.OX - out.y * L.SHEAR) / L.TW;
  return out;
}

export function depth(x, y) { return y + x * 0.0005; }

// Parcel id under a world point (by tile), or null. Parcels are tile sets, so there is no rectangle to test
// against: renderers that need the footprint use parcelGeometry(id).tiles / .edges / .loops.
export function parcelAtWorld(x, y) { return parcelAtTile(x, y); }

// Footprint of a fixed facility at a tier: buildings scale inside their max footprint (anchored to the front/south edge
// so the door stays on the walkway); the lot grows east from its corner, rows deep. Returns {x0,y0,x1,y1,z,roofs}.
export function facilityRect(id, tier, out) {
  const f = L.facilities[id];
  const rs = facilityTierDef(id, tier).render_size;
  if (f.kind === 'lot') {
    out.x0 = f.x0; out.y0 = f.y0; out.x1 = f.x0 + rs.w; out.y1 = f.y0 + rs.rows * L.LOT.pitchY + 0.14; out.z = 0; out.roofs = 0; out.rows = rs.rows;
    return out;
  }
  const mw = f.x1 - f.x0, mh = f.y1 - f.y0;
  const w = mw * rs.w, h = mh * rs.h, cx = (f.x0 + f.x1) / 2;
  out.x0 = cx - w / 2; out.x1 = cx + w / 2; out.y1 = f.y1; out.y0 = f.y1 - h; out.z = rs.z; out.roofs = rs.roofs || 1;
  return out;
}
// Facility id whose max footprint contains a world point, or null (lot uses the current tier's rect).
export function facilityAtWorld(x, y, tiers) {
  for (const id in L.facilities) {
    const f = L.facilities[id];
    if (f.kind === 'lot') { const r = facilityRect(id, tiers[id] ?? 0, tmpRect); if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return id; continue; }
    if (x >= f.x0 && x < f.x1 && y >= f.y0 && y < f.y1) return id;
  }
  return null;
}
const tmpRect = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, roofs: 0, rows: 0 };
