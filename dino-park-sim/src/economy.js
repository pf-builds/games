// Money, purchases, staff, food, upkeep, loans. All numbers come from DATA.
import {
  DATA, state, bus, mode, speciesById, fenceByTier, biomeById, biomeDefs, roleById, foodByDiet, foodById, campaignById, campaignDefs,
  parcel, parcelDef, parcelDefs, parcelList, parcelArea, parcelOutlineCount, parcelSizeLabel, enclosures, allDinos, staffCount, speciesOwned,
  facilityById, facilityDefs, facilityTier, facilityTierDef, facilityNextTier, facilityEffect, managementCapacity, log, digestAdd, clamp, pick, fmt$, pct, aWord, AWord,
  biomeFit, speciesBiomes, speciesRequiresPreferred, FIT_WORD
} from './state.js';
import { computeAttendance, concessionRevenue, efficiency, satisfaction, capacity, parkRating } from './attendance.js';
import { addStoreSpend, checkPrizes } from './prizes.js';

const B = () => DATA.balance;
// M5 sound cues ride the state bus so this module never imports audio (tools/sim.html runs it headless).
const cue = id => bus.dispatchEvent(new CustomEvent('sfx', { detail: { id } }));

// ---- cash helpers ----
export const canAfford = n => state.cash >= n;
export function spend(n, group, key) { state.cash -= n; state.ledger[group][key] += n; }
// General Store purchases (fences, facility upgrades, advertising, food, every tab) also count toward park prizes.
export function storeSpend(n, group, key) { spend(n, group, key); addStoreSpend(n); }
export function earn(n, key) { state.cash += n; state.ledger.revenue[key] += n; }

// ---- valuation ----
export function facilityInvested(id) {
  const tier = facilityTier(id);
  return facilityById(id).tiers.filter(t => t.tier > 0 && t.tier <= tier).reduce((s, t) => s + t.cost, 0);
}
export function assetsValue() {
  const NW = B().net_worth;
  let v = 0;
  for (const p of parcelList()) {
    if (!p.owned) continue;
    v += parcelPrice(p.id, p.biome) * NW.land_value_ratio;
    if (p.enclosure) {
      v += fenceCost(p.enclosure.fence_tier, p.id) * NW.fence_value_ratio * (p.enclosure.condition / 100);
      for (const d of p.enclosure.dinos) v += speciesById(d.species).shop_price * NW.dino_value_ratio * (d.health / 100);
    }
  }
  for (const f of facilityDefs()) v += facilityInvested(f.id) * NW.facility_value_ratio;
  return v;
}
export const netWorth = () => state.cash + assetsValue() - state.debt;
// Debt cap scales with what the park has built (assets only). Borrowed cash does not raise it, so borrowing
// cannot lift its own ceiling; overdrawn cash pulls it down toward the base.
export const debtCap = () => mode().debt_cap_base + mode().debt_cap_networth_factor * Math.max(0, assetsValue() + Math.min(0, state.cash));
export const quarterlyInterest = () => state.debt * mode().apr / DATA.balance.time.quarters_per_year;
// Negative cash is an overdraft: the bank charges a penalty rate on it each quarter.
export const overdraftInterest = () => (state.cash < 0 ? -state.cash * B().loan.overdraft_apr / DATA.balance.time.quarters_per_year : 0);
export function quarterlyPrincipal() {
  const L = B().loan;
  return Math.min(state.debt, Math.max(L.min_quarterly_payment, state.debt * L.quarterly_principal_ratio));
}

// ---- land (parcels) ----
export function areaFactor(area) {
  const P = B().parcel;
  const table = P.area_factor || {};
  if (table[String(area)] != null) return table[String(area)];
  return Math.pow(area, P.area_factor_exponent ?? 1);
}
// Price of a parcel AS a given biome (M4: the buyer picks the land type). Defaults to the parcel's chosen biome when
// owned, else the cheapest biome ("from $X" on FOR SALE markers).
export const cheapestBiome = () => biomeDefs().slice().sort((a, b) => a.plot_cost - b.plot_cost)[0];
export function parcelPrice(id, biomeId = parcel(id)?.biome || cheapestBiome().id) {
  return Math.round(biomeById(biomeId).plot_cost * areaFactor(parcelArea(id)));
}
export const parcelPrices = id => Object.fromEntries(biomeDefs().map(b => [b.id, parcelPrice(id, b.id)]));
export const parcelPriceFrom = id => Math.min(...biomeDefs().map(b => parcelPrice(id, b.id)));
// Fence segments = outline edges of the tile set (edges not shared with another tile of the same parcel).
export const perimeterSegments = id => parcelOutlineCount(id);
export const parcelCapacity = id => parcelArea(id) * B().parcel.space_per_tile;

export function buyParcel(id, biomeId = cheapestBiome().id) {
  const p = parcel(id);
  if (!p) return 'No such parcel.';
  const biome = biomeById(biomeId);
  if (!biome) return `No such land type: ${biomeId}.`;
  if (p.owned) return 'Already owned.';
  const price = parcelPrice(id, biome.id);
  if (!canAfford(price)) return `Need ${fmt$(price)} for parcel ${id} as ${biome.name} (${parcelSizeLabel(id)}).`;
  spend(price, 'capital', 'land');
  p.owned = true;
  p.biome = biome.id;
  log(`Bought parcel ${id}: ${parcelSizeLabel(id)}, landscaped as ${biome.name} for ${fmt$(price)}.`);
  cue('buy');
  return null;
}

// ---- re-landscape (change an owned parcel's biome) ----
export const relandscapeCost = (id, biomeId) => Math.round(parcelPrice(id, biomeId) * (B().biome.relandscape_ratio ?? 0.5));
// Species inside that MUST have their preferred biome block any change that is not preferred for them.
export function relandscapeBlockers(id, biomeId) {
  const enc = parcel(id).enclosure;
  if (!enc) return [];
  return enc.dinos.filter(d => speciesRequiresPreferred(speciesById(d.species)) && biomeFit(speciesById(d.species), biomeId) !== 'preferred').map(d => speciesById(d.species).name);
}
export function relandscape(id, biomeId) {
  const p = parcel(id);
  if (!p || !p.owned) return 'You do not own that parcel.';
  const biome = biomeById(biomeId);
  if (!biome) return `No such land type: ${biomeId}.`;
  if (p.biome === biome.id) return `Parcel ${id} is already ${biome.name}.`;
  const blockers = relandscapeBlockers(id, biome.id);
  if (blockers.length) return `${[...new Set(blockers)].join(', ')} must stay in a preferred biome. Sell or move it first.`;
  const cost = relandscapeCost(id, biome.id);
  if (!canAfford(cost)) return `Need ${fmt$(cost)} to re-landscape parcel ${id} as ${biome.name}.`;
  spend(cost, 'capital', 'land');
  cue('buy');
  const from = biomeById(p.biome)?.name || 'scrub';
  p.biome = biome.id;
  if (p.enclosure) { p.enclosure.vegetation = 0; p.enclosure.seeded = 0; }
  log(`Re-landscaped parcel ${id}: ${from} → ${biome.name} for ${fmt$(cost)}${p.enclosure ? ' (vegetation cleared)' : ''}.`);
  return null;
}

// ---- fences ----
export const fenceCost = (tier, id) => fenceByTier(tier).cost_per_segment * perimeterSegments(id);

export function buildFence(id, tier) {
  const p = parcel(id);
  if (!p || !p.owned || p.enclosure) return 'Parcel must be owned and empty.';
  const cost = fenceCost(tier, id);
  if (!canAfford(cost)) return 'Not enough cash for that fence.';
  storeSpend(cost, 'capital', 'fences');
  p.enclosure = { fence_tier: tier, condition: 100, dinos: [], food: Object.fromEntries(DATA.food.items.map(f => [f.id, 0])), vegetation: 0, seeded: 0 };
  log(`Built ${aWord(fenceByTier(tier).name)} enclosure on parcel ${id}.`);
  cue('buy');
  return null;
}

export const upgradeCost = (enc, tier, id) => fenceCost(tier, id) - fenceCost(enc.fence_tier, id);
export function upgradeFence(id, tier) {
  const enc = parcel(id).enclosure;
  if (tier <= enc.fence_tier) return 'That is not an upgrade.';
  const cost = upgradeCost(enc, tier, id);
  if (!canAfford(cost)) return 'Not enough cash for that upgrade.';
  storeSpend(cost, 'capital', 'fences');
  enc.fence_tier = tier;
  enc.condition = 100;
  log(`Upgraded fence on parcel ${id} to ${fenceByTier(tier).name}.`);
  cue('buy');
  return null;
}

export function repairCost(enc) { return (100 - enc.condition) * DATA.fences.breakout.condition_repair_cost_per_point; }
export function repairFence(id) {
  const enc = parcel(id).enclosure;
  const cost = repairCost(enc);
  if (cost <= 0) return 'Fence is already in full condition.';
  if (!canAfford(cost)) return 'Not enough cash to repair.';
  spend(cost, 'capital', 'repairs');
  enc.condition = 100;
  cue('buy');
  return null;
}

// ---- dinosaurs ----
export const spaceUsed = enc => enc.dinos.reduce((s, d) => s + speciesById(d.species).space_required, 0);
export const spaceCapacity = id => parcelCapacity(id);
// M4: a species with requires_preferred only fits a pen whose biome it prefers; every other species may be placed
// anywhere (and is unhappy in the wrong biome). biomeAllows() is the refusal rule on its own, for messages.
export const biomeAllows = (p, species) => !speciesRequiresPreferred(species) || biomeFit(species, p.biome) === 'preferred';
export function enclosureFits(p, species) {
  const enc = p.enclosure;
  return !!enc && enc.fence_tier >= species.min_fence_tier && spaceUsed(enc) + species.space_required <= spaceCapacity(p.id) && biomeAllows(p, species);
}
export const validEnclosuresFor = species => enclosures().filter(p => enclosureFits(p, species));
// Best biome fit a species can get across the player's usable pens: 'preferred' | 'tolerated' | 'wrong' | 'none'.
export function bestFitFor(species) {
  const rank = { preferred: 3, tolerated: 2, wrong: 1, none: 0 };
  let best = 'none';
  for (const p of validEnclosuresFor(species)) { const f = biomeFit(species, p.biome); if (rank[f] > rank[best]) best = f; }
  return best;
}

export function addDino(id, speciesId, health = B().dinosaur.health_max) {
  const p = parcel(id);
  const dino = { uid: state.next_uid++, species: speciesId, health, hunger: 0, age_days: 0, sick_days: 0 };
  p.enclosure.dinos.push(dino);
  return dino;
}

export function buyDino(speciesId, id, price = speciesById(speciesId).shop_price, health) {
  const sp = speciesById(speciesId);
  const p = parcel(id);
  if (!p || !p.enclosure) return 'That enclosure will not work for this species.';
  if (!biomeAllows(p, sp)) return `${AWord(sp.name)} needs ${(speciesBiomes(sp).preferred || []).map(b => biomeById(b)?.name || b).join(' or ')} land; parcel ${id} is ${biomeById(p.biome)?.name || 'unlandscaped'}. Re-landscape it or pick another pen.`;
  if (!enclosureFits(p, sp)) return 'That enclosure will not work for this species.';
  if (!canAfford(price)) return `Need ${fmt$(price)} to buy ${aWord(sp.name)}.`;
  spend(price, 'capital', 'dinosaurs');
  const dino = addDino(id, speciesId, health);
  const fit = biomeFit(sp, p.biome);
  log(`${AWord(sp.name)} arrived at parcel ${id}${fit === 'wrong' ? ` and is unhappy: ${biomeById(p.biome)?.name} is the wrong biome (prefers ${(speciesBiomes(sp).preferred || []).map(b => biomeById(b)?.name || b).join('/')})` : fit === 'preferred' ? ' and feels right at home' : ''}.`);
  checkPrizes(); // species-count prize fires at purchase, not on the next day tick
  cue('buy');
  // M5: the living view answers with the delivery truck (and the roar when the crate opens); audio roars at once elsewhere.
  bus.dispatchEvent(new CustomEvent('dino_arrival', { detail: { parcel: id, uid: dino.uid, species: speciesId, size: sp.size || 'medium' } }));
  return null;
}

export const sellPrice = dino => Math.round(speciesById(dino.species).shop_price * B().dinosaur.sell_ratio * (dino.health / 100));
export function sellDino(id, uid) {
  const enc = parcel(id).enclosure;
  const i = enc.dinos.findIndex(d => d.uid === uid);
  if (i < 0) return 'No such dinosaur.';
  const [dino] = enc.dinos.splice(i, 1);
  earn(sellPrice(dino), 'sales');
  log(`Sold ${aWord(speciesById(dino.species).name)}.`);
  cue('sell');
  return null;
}

// ---- food ----
export function buyEnclosureFood(id, foodId, units) {
  const enc = parcel(id).enclosure;
  const food = foodById(foodId);
  const room = DATA.food.max_stock_per_enclosure - enc.food[foodId];
  units = Math.min(units, room);
  if (units <= 0) return 'That enclosure is full of this food.';
  const cost = units * food.unit_cost;
  if (!canAfford(cost)) return 'Not enough cash for that food.';
  storeSpend(cost, 'expenses', 'food');
  enc.food[foodId] += units;
  cue('buy');
  return null;
}

// quiet: a standing auto-restock order buys without the register sound.
export function buyParkFood(foodId, units, { quiet = false } = {}) {
  const food = foodById(foodId);
  if (!food || food.grows) return 'Seeds are planted in a pen, not stocked: open an enclosure in the Park view.';
  units = Math.max(0, Math.round(units));
  if (units <= 0) return 'Choose how many units to buy.';
  const cost = units * food.unit_cost;
  if (!canAfford(cost)) return 'Not enough cash for that food.';
  storeSpend(cost, 'expenses', 'food');
  state.park_food[foodId] += units;
  if (!quiet) cue('buy');
  return null;
}

// ---- seeds -> vegetation (M4, balance.vegetation) ----
const VG = () => B().vegetation;
export const seedFood = () => DATA.food.items.find(f => f.grows) || null;
export const vegetationCap = id => (VG().veg_per_tile ?? 25) * parcelArea(id);
export const seedsToPlant = id => (VG().seeds_per_tile ?? 10) * parcelArea(id);
export const plantedFraction = (enc, id) => Math.min(1, (enc.seeded || 0) / seedsToPlant(id));
// Daily growth for a pen at its current planting: per-tile biome rate x tiles x planted fraction.
export function vegetationGrowth(p) {
  const enc = p.enclosure;
  if (!enc || !p.biome) return 0;
  const rate = (VG().growth_per_day || {})[p.biome] || 0;
  return rate * parcelArea(p.id) * plantedFraction(enc, p.id);
}
export function plantSeeds(id, units) {
  const p = parcel(id);
  const enc = p && p.enclosure;
  if (!enc) return 'Build an enclosure first.';
  const seed = seedFood();
  if (!seed) return 'No seeds for sale.';
  const room = seedsToPlant(id) - (enc.seeded || 0);
  units = Math.min(Math.max(0, Math.round(units)), room);
  if (units <= 0) return 'This pen is fully planted already.';
  const cost = units * seed.unit_cost;
  if (!canAfford(cost)) return `Need ${fmt$(cost)} for ${units} seed units.`;
  storeSpend(cost, 'expenses', 'food');
  enc.seeded = (enc.seeded || 0) + units;
  log(`Planted ${units} seed units on parcel ${id} (${pct(plantedFraction(enc, id))} planted): ${biomeById(p.biome)?.name || 'the'} pen will grow about ${vegetationGrowth(p).toFixed(2)} plant units a day.`);
  cue('buy');
  return null;
}
// M5 (M4 minor a): each pen remembers what grew and what was grazed today for the enclosure panel readout.
function growVegetation(p) {
  const enc = p.enclosure;
  const g = vegetationGrowth(p);
  enc.regrow_today = Math.round(g * 100) / 100;
  enc.grazed_today = 0;
  if (g <= 0) return;
  enc.vegetation = Math.min(vegetationCap(p.id), (enc.vegetation || 0) + g);
}

// ---- days of food & auto-restock (M4, balance.food) ----
// Daily need per food across every pen, and how many days the park (stock + pens) can cover it.
export function parkDailyNeed() {
  const need = {};
  for (const p of enclosures()) for (const [k, v] of Object.entries(dailyNeed(p.enclosure))) need[k] = (need[k] || 0) + v;
  return need;
}
export function foodStockTotal(foodId) {
  let n = state.park_food[foodId] || 0;
  for (const p of enclosures()) n += p.enclosure.food[foodId] || 0;
  return n;
}
// [{ food, need, stock, days }] for every eaten food, days = Infinity when nothing eats it.
export function foodDays() {
  const need = parkDailyNeed();
  return DATA.food.items.filter(f => f.diet).map(f => {
    const n = need[f.id] || 0, stock = foodStockTotal(f.id);
    return { food: f, need: n, stock, days: n > 0 ? stock / n : Infinity };
  });
}
export function setAutoRestock(foodId, rule) {
  const cur = state.auto_restock[foodId];
  if (!cur) return `No such food: ${foodId}.`;
  if (rule.on != null) cur.on = !!rule.on;
  if (rule.threshold_days != null) cur.threshold_days = clamp(Math.round(Number(rule.threshold_days)) || 1, 1, 60);
  if (rule.amount != null) cur.amount = clamp(Math.round(Number(rule.amount)) || 1, 1, 1000);
  return null;
}
// Start of day: every food with a rule ON and fewer than threshold_days of stock is bought and charged. Returns the
// purchases made (for the ticker/digest). A rule that cannot be afforded logs once and stays on.
export function autoRestock() {
  const out = [];
  for (const row of foodDays()) {
    const rule = state.auto_restock[row.food.id];
    if (!rule || !rule.on || row.need <= 0 || row.days >= rule.threshold_days) continue;
    const err = buyParkFood(row.food.id, rule.amount, { quiet: true });
    if (err) { log(`Auto-restock: could not buy ${rule.amount} ${row.food.name.toLowerCase()} (${err.toLowerCase()})`); continue; }
    const cost = rule.amount * row.food.unit_cost;
    const line = `Auto-restock: bought ${rule.amount} ${row.food.name.toLowerCase()} for ${fmt$(cost)} (${row.days.toFixed(1)} days left, rule: below ${rule.threshold_days} days).`;
    log(line);
    digestAdd({ title: 'Auto-restock', type: 'info', summary: `${rule.amount} ${row.food.name.toLowerCase()} for ${fmt$(cost)}`, tooltip: DATA.tooltips.terms.auto_restock });
    out.push({ food: row.food.id, units: rule.amount, cost });
  }
  return out;
}
// Days of food for ONE pen's trough per food it needs (pen stock only), plus the park-wide figure. Used by the
// enclosure panel and to name the hungriest pen in the low-food warning (M5, M4 minor b).
export function penFoodDays(p) {
  const enc = p.enclosure;
  if (!enc) return [];
  const need = dailyNeed(enc);
  const park = foodDays();
  return Object.entries(need).map(([foodId, perDay]) => {
    const row = park.find(r => r.food.id === foodId);
    const stock = enc.food[foodId] || 0;
    return { food: foodById(foodId), need: perDay, stock, days: perDay > 0 ? stock / perDay : Infinity, park_days: row ? row.days : Infinity, park_stock: row ? row.stock : 0 };
  });
}
export function lowestPenFor(foodId) {
  let worst = null;
  for (const p of enclosures()) for (const r of penFoodDays(p)) if (r.food.id === foodId && (!worst || r.days < worst.days)) worst = { parcel: p.id, days: r.days, stock: r.stock, need: r.need };
  return worst;
}
// Low-food warning once per crossing below balance.food.warn_days (and again at zero), before the starving popup.
// Names the pen with the least in its trough, not just the park total.
export function foodWarnings() {
  const warnDays = B().food?.warn_days ?? 5;
  state.food_warned ||= {};
  for (const row of foodDays()) {
    const id = row.food.id;
    if (row.need <= 0 || row.days >= warnDays) { state.food_warned[id] = 0; continue; }
    const level = row.stock <= 0 ? 2 : 1;
    if ((state.food_warned[id] || 0) >= level) continue;
    state.food_warned[id] = level;
    const rule = state.auto_restock[id];
    const hint = rule && rule.on ? 'Auto-restock will buy more.' : 'Restock at the General Store, or turn on auto-restock.';
    const low = lowestPenFor(id);
    const pen = low ? ` Parcel ${low.parcel} has the least: ${low.stock} unit${low.stock === 1 ? '' : 's'} in its trough (${low.need}/day, ${low.days < 1 ? 'under a day' : `${Math.floor(low.days)} day${Math.floor(low.days) === 1 ? '' : 's'}`}).` : '';
    const msg = level === 2 ? `Out of ${row.food.name.toLowerCase()}: the park needs ${row.need} units a day.${pen} ${hint}` : `Low food: ${Math.floor(row.days)} day${Math.floor(row.days) === 1 ? '' : 's'} of ${row.food.name.toLowerCase()} left in the park (${row.stock} units, ${row.need}/day).${pen} ${hint}`;
    log(msg);
    digestAdd({ title: level === 2 ? `Out of ${row.food.name.toLowerCase()}` : `Low ${row.food.name.toLowerCase()}${low ? ` (parcel ${low.parcel} lowest)` : ''}`, type: 'negative', summary: `${row.stock} units in stock, ${row.need} eaten a day${low ? `; parcel ${low.parcel} has ${low.stock}` : ''}`, tooltip: DATA.tooltips.terms.days_of_food });
    cue('alert');
  }
}

// Daily: move park stock into enclosures so each has a few days of the right diet.
export function distributeFood() {
  const days = B().enclosure.food_topup_days;
  for (const p of enclosures()) {
    const need = dailyNeed(p.enclosure);
    for (const [foodId, perDay] of Object.entries(need)) {
      const target = Math.min(DATA.food.max_stock_per_enclosure, perDay * days);
      const move = Math.min(state.park_food[foodId], Math.max(0, target - p.enclosure.food[foodId]));
      if (move > 0) { state.park_food[foodId] -= move; p.enclosure.food[foodId] += move; }
    }
  }
}

export function dailyNeed(enc) {
  const need = {};
  for (const d of enc.dinos) {
    const sp = speciesById(d.species);
    const food = foodByDiet(sp.diet);
    if (food) need[food.id] = (need[food.id] || 0) + sp.food_per_day;
  }
  return need;
}

// Returns the dinosaurs that started starving today so the day tick can raise a warning popup.
export function feedAndAge() {
  const D = B().dinosaur;
  const BM = B().biome || {};
  const vet = roleById('veterinary');
  const hasVet = staffCount('veterinary') > 0;
  // Vet Clinic (facilities.json heal_bonus): extra health per day for every animal, on top of staff.
  const clinicHeal = facilityEffect('vet_clinic', facilityTier('vet_clinic'), 'heal_bonus') || 0;
  const starving = [];
  const plants = foodByDiet('herbivore');
  for (const p of enclosures()) {
    const enc = p.enclosure;
    // Vegetation grows first, then herbivores graze whole units of it before touching the pen's stock.
    growVegetation(p);
    let graze = Math.floor(enc.vegetation || 0);
    let unhappy = 0;
    for (const d of [...enc.dinos]) {
      const sp = speciesById(d.species);
      const food = foodByDiet(sp.diet);
      const fit = biomeFit(sp, p.biome);
      let fed = false;
      if (food && plants && food.id === plants.id && graze > 0) {
        const fromVeg = Math.min(sp.food_per_day, graze), rest = sp.food_per_day - fromVeg;
        if (enc.food[food.id] >= rest) { graze -= fromVeg; enc.vegetation -= fromVeg; enc.food[food.id] -= rest; enc.grazed = (enc.grazed || 0) + fromVeg; enc.grazed_today = (enc.grazed_today || 0) + fromVeg; fed = true; }
      } else if (food && enc.food[food.id] >= sp.food_per_day) { enc.food[food.id] -= sp.food_per_day; fed = true; }
      if (fed) d.hunger = 0;
      else {
        const before = d.hunger;
        d.hunger = Math.min(D.hunger_max, d.hunger + D.hunger_per_day);
        if (d.hunger === D.hunger_max && before < D.hunger_max) {
          log(`${AWord(sp.name)} is starving: buy ${food ? food.name.toLowerCase() : 'food'} for parcel ${p.id}.`);
          starving.push({ species: sp.name, enclosure: p.id, food: food ? food.name.toLowerCase() : 'food' });
        }
      }
      if (d.hunger >= D.hunger_max) d.health -= D.starve_health_loss_per_day;
      if (d.sick_days > 0) { d.sick_days = Math.max(0, d.sick_days - (hasVet ? 2 : 1)); d.health -= d.sick_loss_per_day || 0; }
      else if (d.hunger < D.hunger_max && d.health > 0) d.health = Math.min(D.health_max, d.health + (hasVet ? vet.heal_per_day : D.health_regen_per_day) + clinicHeal + (fit === 'preferred' ? (BM.preferred_regen || 0) : 0));
      // Wrong biome: health drifts down toward a floor (never a death sentence on its own), and the pen is flagged.
      if (fit === 'wrong' && d.health > 0) { unhappy++; const floor = BM.wrong_health_floor ?? 30; if (d.health > floor) d.health = Math.max(floor, d.health - (BM.wrong_health_drift || 0)); }
      d.age_days += 1;
      if (d.age_days > sp.lifespan_years * D.days_per_year) d.health = 0;
      if (d.health <= 0) { enc.dinos.splice(enc.dinos.indexOf(d), 1); if (state.stats) state.stats.deaths = (state.stats.deaths || 0) + 1; log(`${AWord(sp.name)} died (${d.hunger >= D.hunger_max ? 'starved' : d.sick_days > 0 ? 'illness' : 'old age'}).`); }
    }
    // Unhappy-pen warning (ticker + digest), repeated every balance.biome.warn_every_days while it lasts.
    if (unhappy > 0) {
      const every = BM.warn_every_days || 30;
      if (enc.biome_warned_day == null || state.day - enc.biome_warned_day >= every) {
        enc.biome_warned_day = state.day;
        const names = [...new Set(enc.dinos.filter(d => biomeFit(speciesById(d.species), p.biome) === 'wrong').map(d => speciesById(d.species).name))];
        const msg = `${names.join(', ')} unhappy on parcel ${p.id}: ${biomeById(p.biome)?.name} is the wrong biome (popularity ×${BM.wrong_popularity}, health slipping). Re-landscape the pen or move the animal.`;
        log(msg);
        digestAdd({ title: `Unhappy dinosaur${unhappy > 1 ? 's' : ''} on parcel ${p.id}`, type: 'negative', summary: `${names.join(', ')} in the wrong biome`, tooltip: DATA.tooltips.terms.biome });
      }
    } else enc.biome_warned_day = null;
  }
  return starving;
}

// ---- cleanliness & decay ----
export function maintenanceCoverage() {
  const m = roleById('maintenance');
  const needed = Math.max(1, Math.ceil(enclosures().length / m.pens_per_worker));
  return Math.min(1, staffCount('maintenance') / needed);
}
// Dirt scales with the crowd: decay = base x clamp(attendance / ref, min, max), so an empty park barely gets dirty.
export function cleanlinessDecay(attendance = state.today.attendance) {
  const A = B().attendance;
  const ref = A.cleanliness_decay_ref_attendance || 1;
  return A.cleanliness_decay_per_day * clamp(attendance / ref, A.cleanliness_decay_min_factor ?? 0, A.cleanliness_decay_max_factor ?? Infinity);
}
export function dailyCleanliness() {
  const A = B().attendance;
  const m = roleById('maintenance');
  state.cleanliness = clamp(state.cleanliness - cleanlinessDecay() + staffCount('maintenance') * m.cleanliness_per_day, 0, 100);
  const drift = A.reputation_drift_per_day;
  const gap = A.reputation_start - state.reputation;
  state.reputation = Math.abs(gap) <= drift ? A.reputation_start : clamp(state.reputation + Math.sign(gap) * drift, 0, 100);
}
// Maintenance does two things to a fence each quarter: it slows the decay, and it puts back
// `maintenance_repair_per_quarter` points of storm damage (both scaled by pen coverage). Without the repair term a
// properly staffed electrified T-rex pen still drifted to condition 0 over one year of storms, which is the point
// at which a danger-3+ species starts rolling for escapes through no fault of the player. Heavy damage still wants
// the Repair button; this only keeps a maintained pen clear of low_condition_threshold.
export function quarterlyDecay() {
  const cover = maintenanceCoverage();
  const F = DATA.fences.breakout;
  const loss = F.condition_loss_per_quarter * (1 - roleById('maintenance').effect_magnitude * cover);
  const repair = (F.maintenance_repair_per_quarter || 0) * cover;
  for (const p of enclosures()) p.enclosure.condition = clamp(p.enclosure.condition - loss + repair, 0, 100);
}

// ---- daily revenue ----
export function dailyRevenue() {
  const { attendance, memberVisits } = computeAttendance();
  const tickets = Math.max(0, attendance - memberVisits) * state.ticket_price;
  const concessions = Math.round(concessionRevenue(attendance));
  earn(tickets, 'tickets');
  earn(concessions, 'concessions');
  state.ledger.attendance += attendance;
  state.ledger.days += 1;
  state.today = { attendance, tickets, concessions, memberVisits };
}

// ---- memberships (M4, balance.marketing.memberships) ----
const MM = () => B().marketing.memberships;
export function membershipConversion() {
  const M = MM();
  const satCap = B().attendance.satisfaction_price_tolerance_cap || 1;
  const satF = M.convert_satisfaction_floor + (1 - M.convert_satisfaction_floor) * Math.min(1, satisfaction() / satCap);
  const fair = state.ticket_price * M.fair_price_tickets;
  const price = state.members.pass_price;
  const priceF = price <= fair ? 1 : Math.pow(fair / price, M.price_exponent);
  return { rate: M.convert_base * satF * priceF, satF, priceF, fair, cap: Math.round(capacity() * M.max_members_per_capacity) };
}
export const memberChurnRate = (rating = parkRating()) => {
  const M = MM();
  return Math.min(1, M.churn_base_per_quarter + Math.max(0, M.churn_low_rating - rating) * M.churn_extra_per_star);
};
// Called after dailyRevenue: today's paying visitors convert to members at the current rate.
export function dailyMembers() {
  const m = state.members;
  if (!m || !m.active) return;
  const paying = Math.max(0, (state.today.attendance || 0) - (state.today.memberVisits || 0));
  const c = membershipConversion();
  m.pending = (m.pending || 0) + paying * c.rate;
  const add = Math.floor(m.pending);
  if (add > 0) {
    m.pending -= add;
    const got = Math.max(0, Math.min(add, c.cap - m.count));
    m.count += got; m.joined_q = (m.joined_q || 0) + got;
    if (got > 0) cue('member_ding');
  }
}
export function setPassPrice(price) {
  const M = MM();
  state.members.pass_price = clamp(Math.round(Number(price) / M.pass_price_step) * M.pass_price_step || M.pass_price_default, M.pass_price_min, M.pass_price_max);
  return state.members.pass_price;
}
// Quarter close: churn on the closing quarter's rating, then the survivors pay the pass price.
function closeMemberships() {
  const m = state.members;
  if (!m || !m.active) return;
  const churn = memberChurnRate();
  const churned = Math.round(m.count * churn);
  m.count -= churned;
  const revenue = m.count * m.pass_price;
  earn(revenue, 'memberships');
  m.churned_last_q = churned; m.churn_rate_last = churn; m.revenue_last_q = revenue; m.joined_last_q = m.joined_q || 0; m.joined_q = 0;
  log(`Memberships: ${m.count} members paid ${fmt$(revenue)} (${churned} left, ${pct(churn)} churn${churn > MM().churn_base_per_quarter + 1e-9 ? ' — low rating' : ''}).`);
}

// ---- staff ----
export function hire(roleId) {
  const role = roleById(roleId);
  if (!canAfford(role.salary_per_month)) return 'You need at least one month of salary in cash to hire.';
  state.staff.push({ role: roleId, morale: DATA.staff.morale.start, hired_day: state.day });
  log(`Hired ${aWord(role.name)} worker.`);
  cue('buy');
  return null;
}
export function fire(roleId) {
  const i = state.staff.findIndex(s => s.role === roleId);
  if (i < 0) return 'Nobody in that role.';
  state.staff.splice(i, 1);
  log(`Let ${aWord(roleById(roleId).name)} worker go. Payroll is now ${fmt$(monthlyPayroll())}/month.`);
  return null;
}
export const monthlyPayroll = () => state.staff.reduce((s, w) => s + roleById(w.role).salary_per_month, 0);
export const needsManager = () => state.staff.length > roleById('management').needed_past_staff && staffCount('management') === 0;
// Headcount above what the Park Office can run (facilities.json management_capacity): a monthly morale penalty.
export const overCapacity = () => state.staff.length > managementCapacity();

// Payroll is always charged, even into overdraft. That is how overspending on staff can sink the park:
// overdrawn cash costs penalty interest and pulls the debt cap down. Staff paid from overdraft lose morale.
export function payday() {
  const M = DATA.staff.morale;
  if (!state.staff.length) return;
  const payroll = monthlyPayroll();
  spend(payroll, 'expenses', 'salaries');
  const overdrawn = state.cash < 0;
  let delta = needsManager() ? -M.no_manager_penalty_per_month : (staffCount('management') > 0 ? M.manager_bonus_per_month : 0);
  if (overCapacity()) {
    delta -= M.over_capacity_penalty_per_month || 0;
    log(`${state.staff.length} staff is more than the ${facilityTierDef('office').label} can run (${managementCapacity()}): morale slips. Upgrade the office.`);
  }
  if (overdrawn) {
    delta -= M.unpaid_penalty_per_month;
    log(`Payroll of ${fmt$(payroll)} put you in overdraft (${fmt$(state.cash)}). Overdraft costs ${pct(B().loan.overdraft_apr)} APR and staff paid late lose morale.`);
  }
  for (const w of state.staff) w.morale = clamp(w.morale + delta, 0, M.max);
  const quitters = state.staff.filter(w => w.morale < M.quit_threshold);
  if (quitters.length) {
    state.staff = state.staff.filter(w => !quitters.includes(w));
    log(`${quitters.length} staff quit over low morale${overdrawn ? ' (paid late)' : needsManager() ? ' (no manager)' : ''}.`);
  }
}

export function quitRandomStaff(count) {
  const gone = [];
  for (let i = 0; i < count && state.staff.length; i++) {
    const w = pick(state.staff);
    state.staff.splice(state.staff.indexOf(w), 1);
    gone.push(roleById(w.role).name);
  }
  return gone;
}

// ---- facility upgrades (fixed structures, tiers bought in order) ----
export function upgradeFacility(id) {
  const f = facilityById(id);
  if (!f) return 'No such facility.';
  const next = facilityNextTier(id);
  if (!next) return `${f.name} is already at its top tier.`;
  if (!canAfford(next.cost)) return `Need ${fmt$(next.cost)} to upgrade the ${f.name} to ${next.label}.`;
  storeSpend(next.cost, 'capital', 'facilities');
  state.facilities[id] = next.tier;
  log(`${f.name} upgraded to ${next.label} (tier ${next.tier}).`);
  cue('buy');
  return null;
}

// ---- marketing ladder (M4, data/campaigns.json) ----
export const activeCampaigns = () => (state.campaigns || []).filter(c => c.days_left > 0);
export const campaignActive = id => activeCampaigns().filter(c => c.id === id);
export const campaignOwned = id => !!(state.perks && state.perks[id]) || (id === 'memberships' && state.members.active);
// Why a campaign cannot be bought right now, or null when it can. Lock reasons are the unlock condition in words.
export function campaignLock(c) {
  const u = c.unlock || {};
  const species = speciesOwned().size;
  if (u.requires_dinos && !allDinos().length) return 'needs a living dinosaur';
  if (u.min_species && species < u.min_species) return `needs ${u.min_species} species (you have ${species})`;
  if (u.min_rating && parkRating() < u.min_rating) return `needs a ${u.min_rating}-star park rating (now ${parkRating().toFixed(1)})`;
  if (u.requires_facility) for (const [fid, tier] of Object.entries(u.requires_facility)) if (facilityTier(fid) < tier) return `needs the ${facilityById(fid).name} at ${facilityById(fid).tiers.find(t => t.tier === tier)?.label || `tier ${tier}`} or better`;
  if ((c.kind === 'perk' || c.kind === 'memberships') && campaignOwned(c.id)) return 'already yours';
  if (!c.stack && c.kind !== 'perk' && c.kind !== 'memberships' && campaignActive(c.id).length) return `already running (${campaignActive(c.id)[0].days_left} day${campaignActive(c.id)[0].days_left === 1 ? '' : 's'} left)`;
  if (c.stack && campaignActive(c.id).length >= (B().marketing.stack_max || 3)) return `already ${campaignActive(c.id).length} running (max ${B().marketing.stack_max || 3})`;
  return null;
}
export function buyCampaign(id) {
  const c = campaignById(id);
  if (!c) return `No such campaign: ${id}.`;
  const lock = campaignLock(c);
  if (lock) return `${c.name}: ${lock}.`;
  if (!canAfford(c.cost)) return `Need ${fmt$(c.cost)} for ${c.name}.`;
  storeSpend(c.cost, 'capital', 'advertising');
  cue('buy');
  if (c.kind === 'floor' && state.stats) state.stats.school_ran = true; // the report card's education line
  if (c.kind === 'perk') { state.perks[c.id] = { day: state.day }; log(`${c.name}: bought once, works every day from now on. ${c.lesson}`); return null; }
  if (c.kind === 'memberships') { state.members.active = true; state.members.launched_day = state.day; log(`${c.name} launched at ${fmt$(state.members.pass_price)} per quarter. ${c.lesson}`); return null; }
  state.campaigns.push({ id: c.id, days_left: c.days, boost: c.boost || 0, floor: c.floor || 0, kind: c.kind, started: state.day });
  log(c.kind === 'floor' ? `${c.name} started: at least ${c.floor} visitors on weekdays for ${c.days} days.` : `${c.name} started: +${Math.round((c.boost || 0) * 100)}% visitors for ${c.days} day${c.days === 1 ? '' : 's'}.`);
  return null;
}
export function tickAd() {
  for (const c of state.campaigns || []) c.days_left -= 1;
  const ended = (state.campaigns || []).filter(c => c.days_left <= 0);
  for (const c of ended) log(`${campaignById(c.id)?.name || c.id} campaign ended.`);
  state.campaigns = (state.campaigns || []).filter(c => c.days_left > 0);
  state.modifiers = state.modifiers.map(m => ({ ...m, days_left: m.days_left - 1 })).filter(m => m.days_left > 0);
  if (state.closed_days > 0) state.closed_days -= 1;
}
export const marketingLadder = () => campaignDefs().map(c => ({ def: c, lock: campaignLock(c), active: campaignActive(c.id), owned: campaignOwned(c.id) }));

// ---- bank ----
export function borrow(n) {
  if (state.debt + n > debtCap()) return 'That would go past your debt cap.';
  state.debt += n;
  state.cash += n;
  log(`Borrowed ${fmt$(n)} from the bank.`);
  cue('sell');
  return null;
}
export function repay(n) {
  n = Math.min(n, state.debt);
  if (n <= 0) return 'Nothing to repay.';
  if (!canAfford(n)) return 'Not enough cash to repay that much.';
  state.cash -= n;
  state.debt -= n;
  state.ledger.capital.debt_repaid += n;
  log(`Repaid ${fmt$(n)} of the loan early.`);
  cue('buy');
  return null;
}

// ---- quarter close ----
export function quarterlyUpkeep() {
  let total = 0;
  for (const p of enclosures()) total += fenceByTier(p.enclosure.fence_tier).upkeep_per_quarter * perimeterSegments(p.id) / DATA.fences.segments_per_enclosure;
  for (const f of facilityDefs()) total += facilityTierDef(f.id).upkeep_per_quarter || 0;
  return Math.round(total / efficiency());
}
export function closeQuarter() {
  const L = state.ledger;
  closeMemberships();
  const interest = Math.round(quarterlyInterest());
  const overdraft = Math.round(overdraftInterest());
  const principal = Math.round(quarterlyPrincipal());
  spend(interest + overdraft, 'expenses', 'interest');
  if (overdraft > 0) log(`Overdraft interest: ${fmt$(overdraft)} charged on your negative balance.`);
  state.cash -= principal; state.debt -= principal; L.expenses.loan_payment += principal;
  spend(quarterlyUpkeep(), 'expenses', 'upkeep');
  const operating = sum(L.revenue) - sum(L.expenses);
  const tax = operating > 0 ? Math.round(operating * B().revenue.tax_rate) : 0;
  spend(tax, 'expenses', 'tax');
  L.profit = sum(L.revenue) - sum(L.expenses);
  L.net_worth = netWorth();
  L.rating_end = parkRating(); // the closing quarter's rating: five-star goals, Grand Park streak, report card
  L.cash_end = state.cash;
  L.debt_end = state.debt;
  state.history.push(L);
  if (state.history.length > B().history.quarters_kept) state.history.shift();
  return L;
}
export const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0);
