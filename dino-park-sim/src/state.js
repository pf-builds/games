// Game state, data loading, and shared lookups. No economy numbers live here.
import * as TL from './tiles.js';

const FILES = ['balance', 'biomes', 'difficulty', 'dinosaurs', 'events', 'facilities', 'fences', 'food', 'parcels', 'staff', 'tooltips'];

export const DATA = {};
// 3 = M2.6 tile-set parcels (polyominoes). 2 = M2.5 rectangles. Older saves are discarded with a notice, not migrated.
export const SAVE_VERSION = 3;
export const bus = new EventTarget();

export let state = null;

// Data URLs resolve against this module, not the document, so the game and the tools pages under /tools/ both load
// the same files.
const dataUrl = name => new URL(`../data/${name}.json`, import.meta.url).href;

export async function loadData() {
  await Promise.all(FILES.map(async name => {
    const res = await fetch(dataUrl(name));
    if (!res.ok) throw new Error(`Failed to load data/${name}.json (${res.status})`);
    DATA[name] = await res.json();
  }));
  buildParcelIndex();
}

// ---- parcel tile index (static, from data) ----
// tileIndex.owner: tile -> parcel id; walk/plaza/facility sets; per-parcel derived geometry cached here so hot loops
// (hit tests, dino wander, viewing spots) never recompute outlines.
export let tileIndex = null;
const parcelGeom = new Map();
export function buildParcelIndex() {
  tileIndex = TL.buildTileIndex(DATA.parcels);
  parcelGeom.clear();
  for (const d of DATA.parcels.parcels) {
    const edges = TL.outlineEdges(d.tiles);
    parcelGeom.set(d.id, { tiles: d.tiles, set: TL.tileSet(d.tiles), bbox: TL.bbox(d.tiles), edges, loops: TL.outlineLoops(d.tiles), centroid: TL.centroid(d.tiles), label: TL.labelTile(d.tiles), front: TL.frontTile(d.tiles), shape: TL.shapeLabel(d), sign: TL.signAnchor(d.tiles, tileIndex.walkable) });
  }
  const problems = TL.validateParcels(DATA.parcels);
  for (const msg of problems) console.warn(`parcels.json: ${msg}`);
  return problems;
}
export const parcelGeometry = id => parcelGeom.get(id);

export function emitChange() { bus.dispatchEvent(new Event('change')); }
export function onChange(fn) { bus.addEventListener('change', fn); return () => bus.removeEventListener('change', fn); }

// ---- construction ----
export function emptyLedger(quarter) {
  return {
    quarter,
    revenue: { tickets: 0, concessions: 0, donations: 0, sales: 0 },
    expenses: { salaries: 0, food: 0, upkeep: 0, interest: 0, loan_payment: 0, tax: 0 },
    capital: { land: 0, fences: 0, dinosaurs: 0, facilities: 0, advertising: 0, repairs: 0, debt_repaid: 0 },
    attendance: 0,
    days: 0
  };
}

function makeParcels() {
  const out = {};
  for (const def of DATA.parcels.parcels) out[def.id] = { id: def.id, owned: false, enclosure: null };
  return out;
}
function makeFacilities() {
  return Object.fromEntries(DATA.facilities.facilities.map(f => [f.id, 0]));
}

export function newGame(modeId = DATA.difficulty.default_mode) {
  const mode = DATA.difficulty.modes[modeId];
  const A = DATA.balance.attendance;
  state = {
    save_version: SAVE_VERSION,
    mode: modeId,
    day: 1,
    cash: mode.start_loan,
    debt: mode.start_loan,
    reputation: A.reputation_start,
    cleanliness: A.cleanliness_start,
    ticket_price: A.reference_ticket,
    parcels: makeParcels(),
    facilities: makeFacilities(),
    staff: [],
    park_food: Object.fromEntries(DATA.food.items.map(f => [f.id, 0])),
    ad: null,
    modifiers: [],
    closed_days: 0,
    ledger: emptyLedger(1),
    history: [],
    today: { attendance: 0, tickets: 0, concessions: 0 },
    over_cap_quarters: 0,
    last_event_day: null,
    event_log: {},
    milestones: { loan_repaid: false, net_worth: false, species: false, rating: false },
    game_over: null,
    next_uid: 1,
    ticker: [],
    digest: [],
    digest_unread: 0,
    speed: 0,
    settings: { sound: true, tutorial_seen: false }
  };
  emitChange();
  return state;
}

export function replaceState(next) { state = next; emitChange(); }

// ---- lookups ----
export const mode = () => DATA.difficulty.modes[state.mode];
export const speciesById = id => DATA.dinosaurs.species.find(s => s.id === id);
export const fenceByTier = tier => DATA.fences.tiers.find(f => f.tier === tier);
export const biomeById = id => DATA.biomes.biomes.find(b => b.id === id);
export const roleById = id => DATA.staff.roles.find(r => r.id === id);
export const foodByDiet = diet => DATA.food.items.find(f => f.diet === diet);
export const foodById = id => DATA.food.items.find(f => f.id === id);
export const campaignById = id => DATA.balance.advertising.campaigns.find(c => c.id === id);

// Parcels: static definition (data/parcels.json) + player state (state.parcels[id]).
export const parcelDefs = () => DATA.parcels.parcels;
export const parcelDef = id => DATA.parcels.parcels.find(p => p.id === id);
export const parcel = id => state.parcels[id];
export const parcelList = () => DATA.parcels.parcels.map(d => state.parcels[d.id]);
export const parcelBiome = id => biomeById(parcelDef(id).biome);
export const parcelTiles = id => parcelDef(id).tiles;
export const parcelArea = id => parcelDef(id).tiles.length;
export const parcelSizeLabel = id => parcelGeom.get(id).shape;
export const parcelOutlineCount = id => parcelGeom.get(id).edges.length;
// Parcel owning the tile under a world point, or null (walkways, plaza, facilities, outside the park).
export function parcelAtTile(x, y) { return tileIndex ? (tileIndex.owner.get(TL.tileKey(Math.floor(x), Math.floor(y))) ?? null) : null; }
export const enclosures = () => parcelList().filter(p => p.enclosure);
export function allDinos() {
  const out = [];
  for (const p of enclosures()) for (const d of p.enclosure.dinos) out.push({ dino: d, parcel: p });
  return out;
}

// Facilities: fixed structures with a tier in state.facilities[id].
export const facilityDefs = () => DATA.facilities.facilities;
export const facilityById = id => DATA.facilities.facilities.find(f => f.id === id);
export const facilityTier = id => state.facilities[id] ?? 0;
export const facilityTierDef = (id, tier = facilityTier(id)) => facilityById(id).tiers.find(t => t.tier === tier) || facilityById(id).tiers[0];
export const facilityNextTier = id => facilityById(id).tiers.find(t => t.tier === facilityTier(id) + 1) || null;
export const facilityEffect = (id, tier = facilityTier(id)) => facilityTierDef(id, tier).effect_magnitude;
export const facilitiesWithEffect = key => DATA.facilities.facilities.filter(f => f.effect_key === key);

export const staffCount = role => state.staff.filter(s => s.role === role).length;
export const speciesOwned = () => new Set(allDinos().map(x => x.dino.species));

// ---- calendar ----
export const T = () => DATA.balance.time;
export function quarterIndex(day = state.day) { return Math.floor((day - 1) / T().days_per_quarter); }
export function seasonIndex(day = state.day) { return quarterIndex(day) % T().quarters_per_year; }
export function season(day = state.day) { return T().seasons[seasonIndex(day)]; }
export function year(day = state.day) { return Math.floor(quarterIndex(day) / T().quarters_per_year) + 1; }
export function dayOfQuarter(day = state.day) { return ((day - 1) % T().days_per_quarter) + 1; }
export function quarterLabel(q) { return `${T().seasons[q % T().quarters_per_year]} Y${Math.floor(q / T().quarters_per_year) + 1}`; }

// ---- formatting ----
export function fmt$(n) {
  const v = Math.round(n);
  const s = Math.abs(v).toLocaleString('en-US');
  return v < 0 ? `-$${s}` : `$${s}`;
}
export const pct = x => `${Math.round(x * 100)}%`;
// "a Stegosaurus" / "an Apatosaurus": species and fence-tier names are data, so the article is picked at write time.
export const article = word => (/^[aeiou]/i.test(String(word)) ? 'an' : 'a');
export const aWord = word => `${article(word)} ${word}`;
export const AWord = word => { const t = aWord(word); return t[0].toUpperCase() + t.slice(1); };
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
export const rndInt = (lo, hi) => Math.floor(rnd(lo, hi + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function log(msg) {
  const last = state.ticker[state.ticker.length - 1];
  if (last && last.msg === msg) { last.day = state.day; return; }
  state.ticker.push({ day: state.day, msg });
  if (state.ticker.length > 40) state.ticker.shift();
}

// Daily digest: events that did not pause the clock (high speed / batch advance). Grouped by day, newest last.
export function digestAdd(entry) {
  const D = DATA.balance.events;
  state.digest ||= [];
  state.digest.push({ day: state.day, ...entry });
  state.digest_unread = (state.digest_unread || 0) + 1;
  const oldest = state.day - (D.digest_days_kept || 30);
  while (state.digest.length && (state.digest[0].day < oldest || state.digest.length > (D.digest_max_entries || 40))) state.digest.shift();
  state.digest_unread = Math.min(state.digest_unread, state.digest.length);
}
