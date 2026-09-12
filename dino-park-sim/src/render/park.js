// "Buy Land" mode: a flat top-down survey map of the park drawn on the shared #park canvas (960x540 logical,
// sized by render/viewport.js). Parcels appear at their true footprint with biome colour, size and price;
// click FOR SALE to buy, an owned empty parcel to fence it, an enclosure to manage it. A side panel carries the
// biome legend and the hovered parcel's details. All layout comes from data/parcels.json.
import { DATA, state, parcelList, parcelDef, parcelGeometry, parcelSizeLabel, parcelAtTile, biomeById, biomeDefs, unownedBiome, parcelBiome, fenceByTier, speciesById, foodByDiet, facilityTier, facilityTierDef, facilityById, facilityDefs, fmt$, aWord, onChange, biomeFit } from '../state.js';
import { effectText } from '../ui/effects.js';
import { spaceUsed, spaceCapacity, dailyNeed, parcelPrice, parcelPriceFrom, parcelPrices, fenceCost, perimeterSegments, vegetationCap } from '../economy.js';
import { breakoutChance } from '../events.js';
import { BASE_W, BASE_H, L, facilityRect } from './projection.js';
import { showTip, hideTip } from '../ui/tooltips.js';
import { onFit } from './viewport.js';

const MAP = { x: 12, y: 30, k: 52 };          // map origin (px) and pixels per tile (13 tiles x 52 = 676 px, panel starts at 700)
const PANEL = { x: 700, y: 30, w: 248 };
const FONT = '8px "Press Start 2P", monospace';
const FONT_S = '6px "Press Start 2P", monospace';
const FONT_XS = '5px "Press Start 2P", monospace';
// First font in the list whose rendering of t fits in maxW (the last one is used regardless).
function fitFont(t, maxW, fonts) {
  for (const f of fonts) { ctx.font = f; if (ctx.measureText(t).width <= maxW) return f; }
  return fonts[fonts.length - 1];
}
// First (text, font) pair that actually fits: candidates run longest to shortest, fonts largest to smallest.
// Chip and box labels shrink their WORDING rather than being cut off mid-glyph at the edge of their box.
function fitText(candidates, maxW, fonts) {
  for (const f of fonts) for (const t of candidates) { ctx.font = f; if (ctx.measureText(t).width <= maxW) return { text: t, font: f }; }
  const last = candidates[candidates.length - 1];
  ctx.font = fonts[fonts.length - 1];
  return { text: last, font: fonts[fonts.length - 1] };
}

let canvas, ctx, hover = null, hoverFacility = null;
let active = false; // false while the Living Park owns the canvas
let handlers = { onParcelClick: () => {}, onFacilityClick: () => {} };
const rect = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, roofs: 0, rows: 0, render: null };

export function initPark(el, h) {
  canvas = el;
  ctx = canvas.getContext('2d');
  handlers = h;
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', () => { if (!active) return; hover = null; hoverFacility = null; hideTip(); drawPark(); });
  canvas.addEventListener('click', e => {
    if (!active) return;
    const id = parcelAt(e);
    const f = id ? null : facilityAt(e);
    if (!id && !f) return;
    hover = null; hoverFacility = null; hideTip(); drawPark(); // a modal will cover the canvas, so clear the hover tooltip now
    if (id) handlers.onParcelClick(id); else handlers.onFacilityClick(f);
  });
  onChange(drawPark);
  onFit(drawPark);
  // Redraw once the pixel font is available so labels do not stay in the fallback face.
  document.fonts?.load(FONT).then(drawPark).catch(() => {});
}

// Called by the shell when switching between the Living Park and Buy Land mode.
export function setGridActive(v) {
  active = v;
  if (!v) { hover = null; hoverFacility = null; hideTip(); }
  else drawPark();
}
export const gridActive = () => active;

const mx = x => MAP.x + x * MAP.k, my = y => MAP.y + y * MAP.k;
function logicalPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (BASE_W / r.width), y: (e.clientY - r.top) * (BASE_H / r.height) };
}
function worldPoint(e) { const p = logicalPoint(e); return { x: (p.x - MAP.x) / MAP.k, y: (p.y - MAP.y) / MAP.k }; }
function parcelAt(e) {
  const w = worldPoint(e);
  if (w.x < 0 || w.y < 0 || w.x >= L.PARK_W || w.y >= L.PARK_H) return null;
  return parcelAtTile(w.x, w.y);
}
function facilityAt(e) {
  const w = worldPoint(e);
  for (const id in L.facilities) { const f = L.facilities[id]; if (f.kind !== 'building' || id === 'office') continue; if (w.x >= f.x0 && w.x < f.x1 && w.y >= f.y0 && w.y < f.y1) return id; }
  return null;
}

function onMove(e) {
  if (!active) return;
  const id = parcelAt(e);
  const f = id ? null : facilityAt(e);
  if (id !== hover || f !== hoverFacility) { hover = id; hoverFacility = f; drawPark(); }
  if (id) showTip(parcelTooltip(id), e.clientX, e.clientY);
  else if (f) showTip(`${facilityById(f).name}: ${facilityTierDef(f).label} (tier ${facilityTier(f)}) · ${effectText(facilityById(f), facilityTierDef(f))}. Fixed facility; click or use the General Store to upgrade.`, e.clientX, e.clientY);
  else hideTip();
}

// Shared with the Living Park hover.
export function parcelTooltip(id) {
  const p = state.parcels[id];
  const biome = parcelBiome(id);
  const size = `${parcelSizeLabel(id)}${biome ? ` ${biome.name}` : ''}`;
  if (!p.owned) {
    const prices = parcelPrices(id);
    return `Parcel ${id}: ${size} FOR SALE from ${fmt$(parcelPriceFrom(id))} (${biomeDefs().map(b => `${b.name} ${fmt$(prices[b.id])}`).join(' · ')}). Holds ${spaceCapacity(id)} space units; ${aWord(fenceByTier(1).name)} fence costs ${fmt$(fenceCost(1, id))} (${perimeterSegments(id)} segments). Click to buy and choose the land type.`;
  }
  if (!p.enclosure) return `Parcel ${id}: ${size}, owned and empty. Click to build an enclosure (fence around ${perimeterSegments(id)} segments).`;
  const enc = p.enclosure;
  const fence = fenceByTier(enc.fence_tier);
  const dinos = enc.dinos.map(x => { const f = biomeFit(speciesById(x.species), p.biome); return `${speciesById(x.species).name} (hp ${Math.round(x.health)}${x.sick_days > 0 ? ', sick' : ''}${x.hunger >= DATA.balance.dinosaur.hunger_max ? ', starving' : ''}${f === 'wrong' ? ', unhappy: wrong biome' : f === 'preferred' ? ', at home' : ''})`; }).join(', ') || 'no dinosaurs';
  const food = Object.entries(enc.food).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ') || 'no food';
  const veg = enc.vegetation || 0, cap = vegetationCap(id);
  const risk = breakoutChance(id);
  return `Parcel ${id} (${size}): ${fence.name} fence ${Math.round(enc.condition)}% · space ${spaceUsed(enc)}/${spaceCapacity(id)} · ${dinos} · food: ${food} · greenery ${Math.round(veg)}/${cap}${enc.seeded ? '' : ' (not seeded)'} · breakout risk ${risk > 0 ? `${(risk * 100).toFixed(1)}%/day` : 'none'}`;
}

// ---- drawing ----
export function drawPark() {
  if (!ctx || !active) return;
  const k = canvas.width / BASE_W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#23303a';
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  ctx.fillStyle = '#f2c94c';
  text('BUY LAND · SURVEY MAP', MAP.x, 18, 'left', FONT);
  ctx.fillStyle = '#a7acbd';
  text('north ↑ · gate at the bottom', mx(L.PARK_W), 18, 'right', FONT);
  drawMap();
  drawPanel();
}

function drawMap() {
  const { PARK_W, PARK_H, CENTER, PLAZA_HALF, GATE } = L;
  // grass + hedge line
  ctx.fillStyle = '#3f7a3f';
  ctx.fillRect(mx(0), my(0), PARK_W * MAP.k, PARK_H * MAP.k);
  // walkways (inside the fence only)
  ctx.fillStyle = '#b8ab8c';
  for (const w of L.walkways) {
    const hw = w.w / 2;
    const x0 = Math.min(w.from[0], w.to[0]) - hw, y0 = Math.min(w.from[1], w.to[1]) - hw, x1 = Math.max(w.from[0], w.to[0]) + hw, y1 = Math.min(PARK_H, Math.max(w.from[1], w.to[1]) + hw);
    if (y0 >= PARK_H) continue;
    ctx.fillRect(mx(x0), my(y0), (x1 - x0) * MAP.k, (y1 - y0) * MAP.k);
  }
  // plaza + fountain (whole tile block)
  ctx.fillStyle = '#cfc3a4'; ctx.fillRect(mx(L.PLAZA.x0), my(L.PLAZA.y0), (L.PLAZA.x1 - L.PLAZA.x0) * MAP.k, (L.PLAZA.y1 - L.PLAZA.y0) * MAP.k);
  void PLAZA_HALF;
  ctx.fillStyle = '#4f8fd6'; ctx.beginPath(); ctx.arc(mx(CENTER.x), my(CENTER.y), L.FOUNTAIN_R * MAP.k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1e2228'; ctx.lineWidth = 1; ctx.stroke();
  // facilities inside the park
  for (const id in L.facilities) {
    const f = L.facilities[id];
    if (f.kind !== 'building' || id === 'office') continue;
    facilityRect(id, facilityTier(id), rect);
    ctx.fillStyle = '#8f886f'; ctx.fillRect(mx(f.x0), my(f.y0), (f.x1 - f.x0) * MAP.k, (f.y1 - f.y0) * MAP.k);
    ctx.fillStyle = hoverFacility === id ? '#d8d2c2' : '#5c6270'; ctx.fillRect(mx(rect.x0), my(rect.y0), (rect.x1 - rect.x0) * MAP.k, (rect.y1 - rect.y0) * MAP.k);
    ctx.strokeStyle = '#1e2228'; ctx.strokeRect(mx(rect.x0) + 0.5, my(rect.y0) + 0.5, (rect.x1 - rect.x0) * MAP.k - 1, (rect.y1 - rect.y0) * MAP.k - 1);
    ctx.fillStyle = '#f1f0e6';
    const label = id === 'food_stand' ? 'FOOD' : id === 'gift_shop' ? 'GIFT' : 'WC';
    const roman = 'I'.repeat(facilityTier(id)) || '0';
    const bw = (rect.x1 - rect.x0) * MAP.k;
    const ft = fitText([`${label} ${roman}`, label, roman], bw - 4, [FONT_S, FONT_XS]);
    ctx.save();
    ctx.beginPath(); ctx.rect(mx(rect.x0), my(rect.y0), bw, (rect.y1 - rect.y0) * MAP.k); ctx.clip();
    text(ft.text, mx((f.x0 + f.x1) / 2), my((f.y0 + f.y1) / 2) + 2, 'center', ft.font);
    ctx.restore();
  }
  // parcels
  for (const p of parcelList()) drawParcel(p);
  // fence line + gate
  ctx.strokeStyle = '#22401c'; ctx.lineWidth = 3;
  ctx.strokeRect(mx(0) - 1.5, my(0) - 1.5, PARK_W * MAP.k + 3, PARK_H * MAP.k + 3);
  ctx.fillStyle = '#b8ab8c'; ctx.fillRect(mx(GATE.x - GATE.halfGap), my(PARK_H) - 3, GATE.halfGap * 2 * MAP.k, 6);
  // front strip: the lot at its tier footprint (surface colour by tier), then the strip buildings, each with its tier label
  const sy = my(PARK_H) + 6;
  ctx.fillStyle = '#1b1f2a'; ctx.fillRect(mx(0), sy, PARK_W * MAP.k, 40);
  const lot = facilityRect('parking_lot', facilityTier('parking_lot'), rect);
  const LOT_COL = { dirt: '#8a6a3e', gravel: '#8d8b82', asphalt: '#4a4e58', lined: '#474b55', overflow: '#535866' };
  ctx.fillStyle = LOT_COL[lot.surface] || '#4a4e58'; ctx.fillRect(mx(lot.x0), sy + 3, (lot.x1 - lot.x0) * MAP.k, 34);
  ctx.strokeStyle = '#2b2e35'; ctx.strokeRect(mx(lot.x0) + 0.5, sy + 3.5, (lot.x1 - lot.x0) * MAP.k - 1, 33);
  ctx.fillStyle = '#f1f0e6';
  const lotLabel = fitText([`PARKING · ${facilityTierDef('parking_lot').label.toUpperCase()}`, facilityTierDef('parking_lot').label.toUpperCase(), 'PARKING'], (lot.x1 - lot.x0) * MAP.k - 6, [FONT_S, FONT_XS]);
  text(lotLabel.text, mx((lot.x0 + lot.x1) / 2), sy + 17, 'center', lotLabel.font);
  text(`${lot.rows} rows · +${facilityTierDef('parking_lot').effects.parking_capacity}/day`, mx((lot.x0 + lot.x1) / 2), sy + 30, 'center', FONT_XS);
  // strip buildings (office, tram, visitor center, vet clinic): two rows of chips right of the lot
  const strip = facilityDefs().filter(f => L.facilities[f.id].kind === 'building' && !L.facilities[f.id].tiles);
  const COL = { office: '#6b5c8a', park_tram: '#3f7d90', visitor_center: '#b3842f', vet_clinic: '#a7b0bb' };
  strip.forEach(f => {
    const m = L.facilities[f.id];
    const row = m.y0 < L.PARK_H + 1.2 ? 0 : 1;
    const bx = mx(m.x0), bw = (m.x1 - m.x0) * MAP.k, by = sy + 3 + row * 17;
    ctx.fillStyle = COL[f.id] || '#5c6270'; ctx.fillRect(bx, by, bw, 15);
    ctx.strokeStyle = '#1e2228'; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 14);
    ctx.fillStyle = '#f1f0e6';
    const t = facilityTierDef(f.id);
    const lab = fitText([`${f.short || f.name.toUpperCase()} · ${t.label.toUpperCase()}`, `${f.short} ${t.tier}`, f.short || 'F'], bw - 4, [FONT_XS]);
    text(lab.text, bx + bw / 2, by + 10, 'center', lab.font);
  });
  ctx.fillStyle = '#f2c94c'; text('▲ GATE', mx(GATE.x), sy + 14, 'center', FONT_S);
}

// A parcel is drawn tile by tile (fill), then its outline (edges not shared with another tile of the same parcel)
// is stroked, so an L or a plus reads as one shape with walls only on the outside. Labels sit on the centroid tile.
function tileRect(t) { return { x: mx(t[0]), y: my(t[1]), w: MAP.k, h: MAP.k }; }
// The whole polyomino as ONE path, built from its outline loops, so the tiles of a parcel fill as a single shape.
// (Filling tile by tile left a few pixels of park ground between two tiles of the same parcel, which made every
// tetris parcel read as loose 1x1 squares on a uniform grid.)
function loopPath(g) {
  ctx.beginPath();
  for (const lp of g.loops) {
    for (let i = 0; i < lp.length; i++) { const x = mx(lp[i][0]), y = my(lp[i][1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath();
  }
}
function fillLoops(g, color) { loopPath(g); ctx.fillStyle = color; ctx.fill(); }
function strokeLoops(g, color, width) { loopPath(g); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
// `skip(e)` drops an outline edge (a boundary shared with a neighbouring pen that draws it instead); `centre(e)` puts
// the stroke exactly on the boundary line for a shared edge this pen owns.
function strokeOutline(g, inset, color, width, dash = null, skip = null, centre = null) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  for (const e of g.edges) {
    if (skip && skip(e)) continue;
    if (centre && centre(e)) { ctx.moveTo(mx(e.x0), my(e.y0)); ctx.lineTo(mx(e.x1), my(e.y1)); continue; }
    // inset each edge toward the tile it belongs to, and shorten it by the inset so corners meet cleanly
    const horiz = e.side === 'n' || e.side === 's';
    const ix = e.side === 'w' ? inset : e.side === 'e' ? -inset : 0, iy = e.side === 'n' ? inset : e.side === 's' ? -inset : 0;
    const ax = mx(e.x0) + (horiz ? inset : 0), bx = mx(e.x1) - (horiz ? inset : 0);
    const ay = my(e.y0) + (horiz ? 0 : inset), by = my(e.y1) - (horiz ? 0 : inset);
    ctx.moveTo(ax + ix, ay + iy); ctx.lineTo(bx + ix, by + iy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}
function drawParcel(p) {
  const d = parcelDef(p.id);
  const g = parcelGeometry(p.id);
  // M4: unsold land is neutral scrub; an owned parcel draws the biome the player chose for it.
  const biome = parcelBiome(p.id) || unownedBiome();
  const small = d.tiles.length === 1;
  const f = small ? FONT_S : FONT, lh = small ? 9 : 12;
  const lt = tileRect(g.label);
  const cx = lt.x + lt.w / 2, cy = lt.y + lt.h / 2;
  const fillTiles = color => fillLoops(g, color);
  const tag = `${p.id} ${shapeAbbrev(d)}`;
  if (!p.owned) {
    fillTiles('#2c3a44');
    fillTiles(tint(biome.color, 0.6));   // enough biome colour to tell marsh from plains on the map, not only in the legend
    strokeLoops(g, '#1b2630', 1);                 // hard seam: the boundary between two parcels, not between two tiles
    strokeOutline(g, 2.5, lighten(biome.color, 0.3), 1.5, [4, 3]);
    const tg = fitText([tag, p.id], lt.w - 4, [f, FONT_S, FONT_XS]);
    ctx.fillStyle = '#c9c4b8'; text(tg.text, cx, cy - lh, 'center', tg.font);
    const fs = fitText(['FOR SALE', 'SALE'], lt.w - 6, [f, FONT_S, FONT_XS]);
    ctx.fillStyle = '#f2c94c'; text(fs.text, cx, cy + (small ? 1 : 2), 'center', fs.font);
    const from = `from ${fmt$(parcelPriceFrom(p.id))}`;
    const pf = fitText([from, fmt$(parcelPriceFrom(p.id))], lt.w - 4, [f, FONT_S, FONT_XS]);
    ctx.fillStyle = '#f1f0e6'; text(pf.text, cx, cy + lh + (small ? 1 : 2), 'center', pf.font);
  } else {
    fillTiles(biome.color);
    strokeLoops(g, 'rgba(0,0,0,0.55)', 1);
    if (!p.enclosure) {
      strokeOutline(g, 2.5, 'rgba(0,0,0,0.35)', 1.5);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const tg2 = fitText([tag, p.id], lt.w - 4, [f, FONT_S, FONT_XS]);
      text(tg2.text, cx, cy - lh, 'center', tg2.font);
      text('READY', cx, cy + (small ? 1 : 2), 'center', f);
      text('+ fence', cx, cy + lh + (small ? 1 : 2), 'center', f);
    } else drawEnclosure(p, d, g, lt, small);
  }
  if (hover === p.id) strokeOutline(g, 1.5, '#ffffff', 2);
}
// Shape tag for a park sign: "2x2" for a rectangle, "L-SHAPE" / "PLUS-SHAPE" for a polyomino. Spelling the word
// out keeps it from scanning as a part number ("L-3" read as a SKU); the tile count lives in the tooltip and the
// survey panel, which is where a player looks for numbers.
export function shortShape(idOrDef) {
  const d = typeof idOrDef === 'string' ? parcelDef(idOrDef) : idOrDef;
  const g = parcelGeometry(d.id);
  const w = g.bbox.x1 - g.bbox.x0, hh = g.bbox.y1 - g.bbox.y0;
  if (w * hh === d.tiles.length) return `${w}x${hh}`;
  return `${(d.shape && d.shape !== 'rect' ? d.shape : 'irregular').toUpperCase()}-SHAPE`;
}
// Same idea, abbreviated for the map's own header chip where a tile is only ~50px wide: "2x2", "L", "PLUS".
export function shapeAbbrev(idOrDef) {
  const d = typeof idOrDef === 'string' ? parcelDef(idOrDef) : idOrDef;
  const g = parcelGeometry(d.id);
  const w = g.bbox.x1 - g.bbox.x0, hh = g.bbox.y1 - g.bbox.y0;
  if (w * hh === d.tiles.length) return `${w}x${hh}`;
  return (d.shape && d.shape !== 'rect' ? d.shape : 'irr').toUpperCase();
}

// Enclosure: fence-coloured outline (dashed when crumbling), header + WEAK on the label tile, one marker per
// dinosaur spread across the tiles (label tile keeps one row free for the header, food bar and space count).
function drawEnclosure(p, d, g, lt, small) {
  const enc = p.enclosure;
  const fence = fenceByTier(enc.fence_tier);
  const under = enc.dinos.some(k => speciesById(k.species).min_fence_tier > enc.fence_tier);
  const warn = enc.dinos.some(k => k.health < 50 || k.sick_days > 0 || k.hunger >= DATA.balance.dinosaur.hunger_max);
  const f = small ? FONT_S : FONT;
  fillLoops(g, 'rgba(0,0,0,0.18)');
  const low = enc.condition <= DATA.fences.breakout.low_condition_threshold;
  // A boundary shared with another fenced pen is drawn once, on the line, by the higher fence tier (ties: lower id).
  const neighbour = e => { const nid = parcelAtTile(e.nx + 0.5, e.ny + 0.5); return nid && nid !== p.id ? { id: nid, enc: state.parcels[nid].enclosure } : null; };
  const skip = e => { const n = neighbour(e); return !!(n && n.enc && (n.enc.fence_tier > enc.fence_tier || (n.enc.fence_tier === enc.fence_tier && n.id < p.id))); };
  const centre = e => { const n = neighbour(e); return !!(n && n.enc); };
  strokeOutline(g, 3, fence.color, low ? 2 : 3, low ? [3, 3] : null, skip, centre);
  const x = lt.x, y = lt.y, w = lt.w, hh = lt.h;
  const short = (fence.short || fence.name).toUpperCase();
  const headMax = w - 12 - (under ? 26 : 0);
  const head = fitText([`${p.id} ${short}`, `${p.id} ${short.slice(0, 4)}`, p.id], headMax, [f, FONT_S, FONT_XS]);
  ctx.font = head.font;
  const chipW = Math.min(w - 6, ctx.measureText(head.text).width + 6 + (under ? 28 : 0));
  ctx.fillStyle = 'rgba(12,15,20,0.72)';
  ctx.fillRect(x + 3, y + 2, chipW, 12);
  ctx.fillStyle = lighten(fence.color, 0.45); text(head.text, x + 5, y + 11, 'left', head.font);
  if (under) { ctx.fillStyle = '#f2c94c'; text('WEAK', x + w - 5, y + 11, 'right', FONT_S); }
  // markers: label tile gets one row (2 slots), every other tile two rows (4 slots)
  const slots = [];
  const lk = `${g.label[0]},${g.label[1]}`;
  for (const t of d.tiles) {
    const r = tileRect(t);
    const isLabel = `${t[0]},${t[1]}` === lk;
    const rows = isLabel ? 1 : 2, y0 = isLabel ? r.y + 24 : r.y + 16;
    for (let i = 0; i < rows * 2; i++) slots.push({ x: r.x + 14 + (i % 2) * 16, y: y0 + Math.floor(i / 2) * 15 });
  }
  enc.dinos.forEach((k, i) => { if (i < slots.length) drawDino(k, slots[i].x, slots[i].y, biomeFit(speciesById(k.species), p.biome)); });
  // greenery: a thin green bar above the food bar once the pen is seeded
  if (enc.seeded) { const cap = vegetationCap(p.id); const vw = w - 28 - (warn ? 14 : 0); if (vw > 10) { ctx.fillStyle = '#101418'; ctx.fillRect(x + 24, y + hh - 14, vw, 4); ctx.fillStyle = '#5fbf3a'; ctx.fillRect(x + 25, y + hh - 13, Math.max(0, (vw - 2) * Math.min(1, (enc.vegetation || 0) / cap)), 2); } }
  if (enc.dinos.length > slots.length) { ctx.fillStyle = '#f1f0e6'; text(`+${enc.dinos.length - slots.length}`, x + w - 5, y + 26, 'right', FONT_XS); }
  if (warn) { ctx.fillStyle = '#e05c5c'; ctx.fillRect(x + w - 16, y + hh - 20, 12, 12); ctx.fillStyle = '#fff'; text('!', x + w - 10, y + hh - 11, 'center', FONT); }
  ctx.fillStyle = '#f1f0e6'; text(`${spaceUsed(enc)}/${spaceCapacity(p.id)}`, x + 5, y + hh - 4, 'left', FONT_XS);
  foodBar(enc, x + 24, y + hh - 9, w - 28 - (warn ? 14 : 0));
}

function drawDino(d, cx, cy, fit = 'tolerated') {
  const sp = speciesById(d.species);
  ctx.fillStyle = sp.color;
  ctx.strokeStyle = '#101418';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (sp.size === 'small') ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  else if (sp.size === 'medium') ctx.rect(cx - 6, cy - 6, 12, 12);
  else { ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 8, cy + 7); ctx.lineTo(cx - 8, cy + 7); ctx.closePath(); }
  ctx.fill(); ctx.stroke();
  if (d.health < 50) { ctx.fillStyle = '#e05c5c'; ctx.fillRect(cx - 2, cy - 2, 4, 4); }
  else if (fit === 'wrong') { ctx.fillStyle = '#ff9d4d'; ctx.fillRect(cx + 4, cy - 9, 5, 5); ctx.strokeStyle = '#101418'; ctx.strokeRect(cx + 4.5, cy - 8.5, 4, 4); }
}

function foodBar(enc, x, y, w) {
  if (w < 10) return;
  const need = dailyNeed(enc);
  const ids = Object.keys(need);
  ctx.fillStyle = '#101418';
  ctx.fillRect(x, y, w, 7);
  if (!ids.length) return;
  const stock = ids.reduce((s, id) => s + enc.food[id], 0);
  const perDay = ids.reduce((s, id) => s + need[id], 0);
  const days = Math.min(1, stock / (perDay * DATA.balance.enclosure.food_topup_days * 2));
  ctx.fillStyle = days < 0.25 ? '#e05c5c' : '#6fcf6a';
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * days), 5);
}

// Word-wraps panel body text to the column width, so no line can run past the panel border however the numbers
// or a biome name come out. Empty strings stay as blank spacer lines.
function wrap(lines, maxW, font = FONT_S) {
  const out = [];
  ctx.font = font;
  for (const t of lines) {
    if (!t) { out.push(''); continue; }
    let line = '';
    for (const word of String(t).split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(next).width <= maxW) line = next;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

// Side panel: legend + hovered parcel details.
function drawPanel() {
  const { x, w } = PANEL;
  let y = PANEL.y + 8;
  ctx.fillStyle = '#1b1f2a'; ctx.fillRect(x, PANEL.y, w, BASE_H - PANEL.y - 12);
  ctx.strokeStyle = '#4a5270'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, PANEL.y + 0.5, w - 1, BASE_H - PANEL.y - 13);
  ctx.fillStyle = '#f2c94c'; text('LAND TYPES', x + 10, y + 8, 'left', FONT); y += 20;
  const un = unownedBiome();
  ctx.fillStyle = un.color; ctx.fillRect(x + 10, y, 12, 12); ctx.strokeStyle = '#000'; ctx.strokeRect(x + 10.5, y + 0.5, 11, 11);
  ctx.fillStyle = '#a7acbd'; text(`${(un.name || 'SCRUB').toUpperCase()} = for sale`, x + 28, y + 10, 'left', FONT); y += 18;
  for (const b of DATA.biomes.biomes) {
    ctx.fillStyle = b.color; ctx.fillRect(x + 10, y, 12, 12); ctx.strokeStyle = '#000'; ctx.strokeRect(x + 10.5, y + 0.5, 11, 11);
    ctx.fillStyle = '#f1f0e6'; text(`${b.name.toUpperCase()} ${fmt$(b.plot_cost)}/tile`, x + 28, y + 10, 'left', FONT);
    y += 18;
  }
  const P = DATA.balance.parcel;
  ctx.fillStyle = '#a7acbd';
  const body = [
    'You pick the land type when you buy; it sets the price and which species feel at home.',
    `Bigger parcels cost less per tile (4 tiles pay ${Math.round((P.area_factor['4'] ?? 4) / 4 * 100)}%, 6 pay ${Math.round((P.area_factor['6'] ?? 6) / 6 * 100)}%).`,
    `Capacity: ${P.space_per_tile} space units per tile.`,
    'Fence cost = per segment x outline edges.'
  ];
  // M5 (M4 minor f): legend and help copy at the 8px face (a 12px-sans equivalent at 1280x720), never the 6px one.
  for (const line of wrap(body, w - 20, FONT)) { text(line, x + 10, y + 8, 'left', FONT); y += 12; }
  y += 8;
  const owned = parcelList().filter(p => p.owned).length;
  ctx.fillStyle = '#f2c94c'; text('YOUR LAND', x + 10, y + 8, 'left', FONT); y += 20;
  ctx.fillStyle = '#f1f0e6'; text(`${owned}/${parcelList().length} parcels owned`, x + 10, y + 8, 'left', FONT); y += 14;
  text(`${parcelList().filter(p => p.enclosure).length} enclosures`, x + 10, y + 8, 'left', FONT); y += 22;
  ctx.fillStyle = '#f2c94c'; text(hover ? `PARCEL ${hover}` : 'HOVER A PARCEL', x + 10, y + 8, 'left', FONT); y += 20;
  ctx.fillStyle = '#f1f0e6';
  const lines = hover ? parcelLines(hover) : ['Click FOR SALE to buy.', 'Owned + empty: click to fence.', 'Enclosure: click to manage.', '', 'Parking, restrooms, food and gifts are fixed. Upgrade them in the General Store.'];
  for (const line of wrap(lines, w - 20, FONT)) { text(line, x + 10, y + 8, 'left', FONT); y += 12; }
  y += 8;
  ctx.fillStyle = '#a7acbd'; text('Esc: back to the living park', x + 10, y + 8, 'left', FONT);
}

function parcelLines(id) {
  const p = state.parcels[id];
  const biome = parcelBiome(id);
  const out = [`${parcelSizeLabel(id)} ${biome ? biome.name : 'scrub (for sale)'}`, `${perimeterSegments(id)} fence segments`, `Capacity ${spaceCapacity(id)} space units`];
  if (!p.owned) {
    const prices = parcelPrices(id);
    out.push('Price by land type:');
    for (const b of biomeDefs()) out.push(`  ${b.name} ${fmt$(prices[b.id])}`);
    out.push(`Cash now: ${fmt$(state.cash)}`, '');
    for (const f of DATA.fences.tiers) out.push(`${f.name} fence ${fmt$(fenceCost(f.tier, id))}`);
  } else if (!p.enclosure) {
    out.push('Owned, no fence yet.', '');
    for (const f of DATA.fences.tiers) out.push(`${f.name} fence ${fmt$(fenceCost(f.tier, id))}`);
  } else {
    const enc = p.enclosure;
    const risk = breakoutChance(id);
    out.push(`${fenceByTier(enc.fence_tier).name} fence, ${Math.round(enc.condition)}%`, `Space used ${spaceUsed(enc)}/${spaceCapacity(id)}`, `Breakout risk: ${risk > 0 ? `${(risk * 100).toFixed(1)}%/day` : 'none'}`, '');
    for (const k of enc.dinos) { const f = biomeFit(speciesById(k.species), p.biome); out.push(`${f === 'wrong' ? 'x ' : f === 'preferred' ? '+ ' : '~ '}${speciesById(k.species).name} hp ${Math.round(k.health)}${f === 'wrong' ? ' unhappy' : ''}`); }
    if (!enc.dinos.length) out.push('No dinosaurs yet.');
    if (enc.seeded) out.push(`Greenery ${Math.round(enc.vegetation || 0)}/${vegetationCap(id)}`);
  }
  return out;
}

// Mixes a colour toward white so a fence tier reads as a label on a dark biome fill.
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

function text(t, x, y, align, font = FONT) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillText(t, x, y);
  ctx.textAlign = 'left';
}

export function foodForEnclosure(enc) {
  const diets = new Set(enc.dinos.map(d => speciesById(d.species).diet));
  return [...diets].map(foodByDiet).filter(Boolean);
}
