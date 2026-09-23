// Game state, data loading, and shared lookups. No economy numbers live here.
import * as TL from './tiles.js';

const FILES = ['balance', 'biomes', 'campaigns', 'difficulty', 'dinosaurs', 'events', 'facilities', 'fences', 'food', 'parcels', 'prizes', 'sfx', 'staff', 'tooltips'];

export const DATA = {};
export const dataFiles = () => FILES.slice();
// 6 = M5 (goals ladder + report card, lifetime stats, sound/motion settings). 5 = M4 (player-chosen parcel biome,
// vegetation, auto-restock, campaign ladder, memberships). 4 = M3 (facility ladders, prizes, settings). 3 = M2.6
// tile-set parcels. Older saves are discarded with the "re-surveyed" notice.
export const SAVE_VERSION = 6;
// Player preferences that outlive a single park (day length, autosave cadence, sound). Mirrored into state.settings
// so a save carries them too; newGame() starts from the stored copy.
export const PREFS_KEY = 'fossil-fortune.prefs';
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
    revenue: { tickets: 0, concessions: 0, memberships: 0, donations: 0, sales: 0 },
    expenses: { salaries: 0, food: 0, upkeep: 0, overhead: 0, interest: 0, loan_payment: 0, tax: 0 },
    capital: { land: 0, fences: 0, dinosaurs: 0, facilities: 0, advertising: 0, repairs: 0, debt_repaid: 0 },
    attendance: 0,
    days: 0
  };
}

// M4: a parcel's biome is chosen by the player at purchase (null while unowned); data/parcels.json carries none.
function makeParcels() {
  const out = {};
  for (const def of DATA.parcels.parcels) out[def.id] = { id: def.id, owned: false, biome: null, enclosure: null };
  return out;
}
// Per-food auto-restock rules (balance.food.auto_restock_default), only for foods that are actually eaten (have a diet).
export function defaultAutoRestock() {
  const d = DATA.balance.food?.auto_restock_default || { on: false, threshold_days: 5, amount: 50 };
  return Object.fromEntries(DATA.food.items.filter(f => f.diet).map(f => [f.id, { on: !!d.on, threshold_days: d.threshold_days, amount: d.amount }]));
}
export function defaultMembers() {
  const M = DATA.balance.marketing?.memberships || {};
  return { active: false, count: 0, pass_price: M.pass_price_default ?? 60, pending: 0, joined_q: 0, joined_last_q: 0, churned_last_q: 0, churn_rate_last: 0, revenue_last_q: 0, launched_day: null };
}
function makeFacilities() {
  return Object.fromEntries(DATA.facilities.facilities.map(f => [f.id, 0]));
}
// M5 end-game: goals fired (id -> day), the five-star quarter streak for the Grand Park, and lifetime counters the
// Year-5 Report Card grades on (escapes, deaths, Fact Book views, whether the school program ever ran).
export function defaultGoals() { return { done: {}, streak: 0 }; }
export function defaultStats() { return { escapes: 0, deaths: 0, fact_views: 0, school_ran: false }; }

// ---- settings / preferences ----
export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { return {}; }
}
export function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ }
}
// M5 sound + motion preferences: sfx (the old "sound" toggle), ambient bed, master volume, reduce motion.
export function defaultSettings() {
  const Lv = DATA.balance.living, SV = DATA.balance.save || {};
  const SD = (DATA.sfx && DATA.sfx.defaults) || {};
  const p = loadPrefs();
  return {
    sfx: p.sfx ?? p.sound ?? SD.sfx ?? true,
    ambient: p.ambient ?? SD.ambient ?? false,
    master_volume: clamp(Number(p.master_volume ?? SD.master_volume ?? 0.8), 0, 1),
    reduce_motion: !!(p.reduce_motion ?? false),
    tutorial_seen: false,
    day_seconds: clamp(Number(p.day_seconds) || Lv.day_seconds, Lv.day_seconds_min ?? 1, Lv.day_seconds_max ?? 60),
    autosave_days: clamp(Math.round(Number(p.autosave_days) || SV.autosave_days || DATA.balance.time.days_per_quarter), SV.autosave_days_min ?? 1, SV.autosave_days_max ?? 365)
  };
}
// Apply a settings patch live (clock, autosave cadence, sound) and persist it as a preference.
export function updateSettings(patch) {
  const Lv = DATA.balance.living, SV = DATA.balance.save || {};
  state.settings ||= defaultSettings();
  if (patch.day_seconds != null) state.settings.day_seconds = clamp(Number(patch.day_seconds) || Lv.day_seconds, Lv.day_seconds_min ?? 1, Lv.day_seconds_max ?? 60);
  if (patch.autosave_days != null) state.settings.autosave_days = clamp(Math.round(Number(patch.autosave_days) || SV.autosave_days), SV.autosave_days_min ?? 1, SV.autosave_days_max ?? 365);
  if (patch.sfx != null) state.settings.sfx = !!patch.sfx;
  if (patch.sound != null) state.settings.sfx = !!patch.sound; // old name of the SFX toggle
  if (patch.ambient != null) state.settings.ambient = !!patch.ambient;
  if (patch.master_volume != null) state.settings.master_volume = clamp(Number(patch.master_volume) || 0, 0, 1);
  if (patch.reduce_motion != null) state.settings.reduce_motion = !!patch.reduce_motion;
  savePrefs({ sfx: state.settings.sfx, ambient: state.settings.ambient, master_volume: state.settings.master_volume, reduce_motion: state.settings.reduce_motion, day_seconds: state.settings.day_seconds, autosave_days: state.settings.autosave_days });
  emitChange();
  return { ...state.settings };
}
// Real seconds per game day at 1x: the player's setting, else balance.living.day_seconds.
export const daySeconds = () => (state && state.settings && state.settings.day_seconds) || DATA.balance.living.day_seconds || 1;
export const autosaveDays = () => (state && state.settings && state.settings.autosave_days) || (DATA.balance.save && DATA.balance.save.autosave_days) || DATA.balance.time.days_per_quarter;

// Phase 2: the difficulty mode is chosen at New Game and fixed for the run (state.difficulty). An unknown or missing
// id (an old save, a retired mode name) falls back to the default mode.
export const modeIds = () => DATA.difficulty.order || Object.keys(DATA.difficulty.modes);
export const modeDef = id => DATA.difficulty.modes[id] || null;
export function normalizeModeId(id) { return modeDef(id) && modeDef(id).enabled !== false ? id : DATA.difficulty.default_mode; }
export function newGame(modeId = DATA.difficulty.default_mode) {
  modeId = normalizeModeId(modeId);
  const mode = DATA.difficulty.modes[modeId];
  const A = DATA.balance.attendance;
  state = {
    save_version: SAVE_VERSION,
    difficulty: modeId,
    day: 1,
    cash: mode.start_loan,
    debt: mode.start_loan,
    reputation: A.reputation_start,
    cleanliness: A.cleanliness_start,
    ticket_price: A.reference_ticket,
    parcels: makeParcels(),
    facilities: makeFacilities(),
    store_spend: 0,
    prizes: [],
    staff: [],
    park_food: Object.fromEntries(DATA.food.items.map(f => [f.id, 0])),
    auto_restock: defaultAutoRestock(),
    food_warned: {},
    campaigns: [],
    auto_renew: {},
    perks: {},
    members: defaultMembers(),
    modifiers: [],
    closed_days: 0,
    ledger: emptyLedger(1),
    history: [],
    today: { attendance: 0, tickets: 0, concessions: 0 },
    over_cap_quarters: 0,
    last_event_day: null,
    event_log: {},
    goals: defaultGoals(),
    stats: defaultStats(),
    report_card: null,
    game_over: null,
    next_uid: 1,
    ticker: [],
    digest: [],
    digest_unread: 0,
    speed: 0,
    settings: defaultSettings()
  };
  emitChange();
  return state;
}

export function replaceState(next) {
  state = next;
  // Saves from before Phase 2 carry no mode (or the old `mode` key): they load as Standard, never as anything else.
  state.difficulty = normalizeModeId(state.difficulty || state.mode);
  delete state.mode;
  state.over_cap_quarters ||= 0;
  // A loaded save carries its own settings; anything missing falls back to the stored preferences.
  state.settings = { ...defaultSettings(), ...(state.settings || {}) };
  state.store_spend ||= 0;
  state.prizes ||= [];
  state.auto_restock ||= defaultAutoRestock();
  state.food_warned ||= {};
  state.campaigns ||= [];
  state.perks ||= {};
  state.members = { ...defaultMembers(), ...(state.members || {}) };
  state.goals = { ...defaultGoals(), ...(state.goals || {}) };
  state.goals.done ||= {};
  state.stats = { ...defaultStats(), ...(state.stats || {}) };
  state.report_card ||= null;
  for (const id in state.parcels) { const p = state.parcels[id]; if (p.biome === undefined) p.biome = null; if (p.enclosure) { p.enclosure.vegetation ??= 0; p.enclosure.seeded ??= 0; } }
  emitChange();
}

// ---- lookups ----
export const mode = () => DATA.difficulty.modes[normalizeModeId(state && state.difficulty)];
export const modeId = () => normalizeModeId(state && state.difficulty);
export const isClassic = () => modeId() === 'classic';
export const speciesById = id => DATA.dinosaurs.species.find(s => s.id === id);
export const fenceByTier = tier => DATA.fences.tiers.find(f => f.tier === tier);
export const biomeById = id => DATA.biomes.biomes.find(b => b.id === id);
export const roleById = id => DATA.staff.roles.find(r => r.id === id);
export const foodByDiet = diet => DATA.food.items.find(f => f.diet === diet);
export const foodById = id => DATA.food.items.find(f => f.id === id);
export const campaignDefs = () => DATA.campaigns.campaigns;
export const campaignById = id => DATA.campaigns.campaigns.find(c => c.id === id);
export const biomeDefs = () => DATA.biomes.biomes;
export const unownedBiome = () => DATA.biomes.unowned || { name: 'Scrub', color: '#8b8f62', texture: 'scrub' };

// ---- species <-> biome fit (M4) ----
// `biomes` on a species is authored in dinosaurs.json; the affinity fallback keeps a species without it playable.
export function speciesBiomes(sp) {
  if (sp.biomes) return sp.biomes;
  const aff = sp.biome_affinity || [];
  return { preferred: aff.slice(0, 1), tolerated: aff.slice(1) };
}
// 'preferred' | 'tolerated' | 'wrong' for a species on a biome id; 'none' when the pen has no biome (unowned).
export function biomeFit(sp, biomeId) {
  if (!biomeId) return 'none';
  const b = speciesBiomes(sp);
  if ((b.preferred || []).includes(biomeId)) return 'preferred';
  if ((b.tolerated || []).includes(biomeId)) return 'tolerated';
  return 'wrong';
}
export const FIT_MARK = { preferred: '✓', tolerated: '~', wrong: '✗', none: '?' };
export const FIT_WORD = { preferred: 'prefers', tolerated: 'tolerates', wrong: 'wrong biome', none: 'no biome' };
export const speciesRequiresPreferred = sp => !!speciesBiomes(sp).requires_preferred;
export const dinoFit = (dino, parcelState) => biomeFit(speciesById(dino.species), parcelState && parcelState.biome);

// Parcels: static definition (data/parcels.json) + player state (state.parcels[id]).
export const parcelDefs = () => DATA.parcels.parcels;
export const parcelDef = id => DATA.parcels.parcels.find(p => p.id === id);
export const parcel = id => state.parcels[id];
export const parcelList = () => DATA.parcels.parcels.map(d => state.parcels[d.id]);
// The biome the PLAYER chose for a parcel (null while unowned); never from parcels.json.
export const parcelBiome = id => { const b = state.parcels[id] && state.parcels[id].biome; return b ? biomeById(b) : null; };
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
// Effects are a map per tier ({ key: absolute value }); `effect_key` names the headline one.
export const facilityEffects = (id, tier = facilityTier(id)) => facilityTierDef(id, tier).effects || {};
export const facilityEffect = (id, tier = facilityTier(id), key = facilityById(id).effect_key) => facilityEffects(id, tier)[key] ?? 0;
export const facilityTopTier = id => facilityById(id).tiers[facilityById(id).tiers.length - 1];
// Facilities whose tiers carry a given effect key anywhere on the ladder (headline or extra).
export const facilitiesWithEffect = key => DATA.facilities.facilities.filter(f => f.effect_key === key || f.tiers.some(t => t.effects && t.effects[key] != null));
// Staff the office can run before morale slips (facilities.json management_capacity).
export const managementCapacity = () => facilityEffect('office', facilityTier('office'), 'management_capacity') || Infinity;

// Prizes: static definitions (data/prizes.json) + earned list in state.prizes [{ id, day }].
export const prizeDefs = () => DATA.prizes.prizes;
export const prizeById = id => DATA.prizes.prizes.find(p => p.id === id);
export const prizeEarned = id => !!(state.prizes || []).find(p => p.id === id);
export const earnedPrizes = () => (state.prizes || []).map(e => ({ ...prizeById(e.id), day: e.day })).filter(p => p.id);

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
