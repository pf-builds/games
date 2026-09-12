// Attendance, revenue projection, and park rating. Pure functions over state + DATA.
// Capacity, concession spend and satisfaction all come from fixed-facility tiers (data/facilities.json effect keys).
import { DATA, state, mode, allDinos, staffCount, speciesById, roleById, facilitiesWithEffect, facilityTier, facilityEffect, earnedPrizes, seasonIndex, clamp, biomeFit, campaignById, enclosures, parcelArea } from './state.js';

const A = () => DATA.balance.attendance;

export function appealParts() {
  const dinos = allDinos();
  const sickFactor = DATA.balance.dinosaur.sick_popularity_factor;
  const species = new Set();
  let pop = 0;
  for (const { dino, parcel } of dinos) {
    const sp = speciesById(dino.species);
    pop += sp.popularity * (dino.sick_days > 0 ? sickFactor : 1) * biomeMult(biomeFit(sp, parcel.biome));
    species.add(dino.species);
  }
  const variety = 1 + A().variety_bonus_per_species * Math.max(0, species.size - 1);
  const popTerm = (pop / A().appeal_popularity_divisor) * variety;
  const cleanTerm = A().cleanliness_weight * state.cleanliness / 100;
  const bonusTerm = appealBonus();
  // No living dinosaurs: appeal collapses to appeal_min x empty_park_factor (0 in M3 data), so demand, attendance and
  // concessions all go to zero. An empty park cannot profit.
  const appeal = dinos.length ? Math.max(A().appeal_min, popTerm + cleanTerm + bonusTerm) : A().appeal_min * A().empty_park_factor;
  return { appeal, popTerm, cleanTerm, bonusTerm, species: species.size, dinos: dinos.length };
}

// Popularity multiplier for a species' biome fit (balance.biome): preferred boosts, tolerated is neutral, wrong hurts.
export function biomeMult(fit) {
  const BM = DATA.balance.biome || {};
  return fit === 'preferred' ? (BM.preferred_popularity ?? 1) : fit === 'wrong' ? (BM.wrong_popularity ?? 1) : (BM.tolerated_popularity ?? 1);
}
// Vegetation appeal: every pen adds balance.vegetation.appeal_bonus_per_pen x how full its greenery is.
export function vegetationBonus() {
  const V = DATA.balance.vegetation || {};
  const per = V.appeal_bonus_per_pen || 0, perTile = V.veg_per_tile || 25;
  let b = 0;
  for (const p of enclosures()) { const cap = perTile * parcelArea(p.id); if (cap > 0) b += per * Math.min(1, (p.enclosure.vegetation || 0) / cap); }
  return b;
}
// Appeal bonus from facilities (visitor center, museum store), earned park prizes and pen vegetation, capped in balance.facilities.
export function appealBonus(tiers = state.facilities) {
  let b = facilitySum('appeal_bonus', tiers);
  for (const p of earnedPrizes()) b += p.appeal_bonus || 0;
  b += vegetationBonus();
  const cap = DATA.balance.facilities?.appeal_bonus_cap ?? Infinity;
  return Math.min(cap, b);
}

// Sum of a facility effect key across all facilities at their current tier (or an override map for what-ifs).
export function facilitySum(key, tiers = state.facilities) {
  let s = 0;
  for (const f of facilitiesWithEffect(key)) s += facilityEffect(f.id, tiers[f.id] ?? facilityTier(f.id), key);
  return s;
}

// Visitor satisfaction (0..cap): facility tiers (restrooms) + effective tour guides. Raises price tolerance.
export function satisfaction(tiers = state.facilities) {
  let sat = facilitySum('satisfaction', tiers);
  const guide = roleById('tour_guide');
  const needed = Math.max(1, Math.ceil(allDinos().length / guide.dinos_per_guide));
  sat += Math.min(staffCount('tour_guide'), needed) * guide.effect_magnitude;
  return Math.min(A().satisfaction_price_tolerance_cap, sat);
}

// Smooth elasticity around the reference ticket. Below reference: mild boost (a cheaper ticket brings more people,
// but never enough to beat the lost margin). Above reference: the penalty grows with the SQUARE of the overcharge
// (price_penalty_exponent), so a small rise is worth it and a big one empties the park. That shape is what puts the
// revenue peak at a real price - about 1.5x the reference on Standard - instead of at whichever end of the slider
// a constant elasticity happens to favour. Satisfaction (restrooms, tour guides) shrinks e, which pushes the peak
// higher: look after visitors and they will pay more.
// Online ticketing (campaigns.json perk): a permanent cut to elasticity, so visitors mind the price a little less.
export function perkElasticity() {
  const perk = state.perks && state.perks.online_ticketing ? campaignById('online_ticketing') : null;
  return 1 - (perk && perk.elasticity_cut ? perk.elasticity_cut : 0);
}
export function priceFactor(price, sat = satisfaction()) {
  const r = price / A().reference_ticket;
  const e = A().elasticity * (1 - sat) * perkElasticity();
  const k = A().price_penalty_exponent ?? 1;
  return r >= 1 ? Math.exp(-e * Math.pow(r - 1, k)) : Math.pow(1 / r, e);
}

export const seasonFactor = () => DATA.balance.time.season_factor[seasonIndex()];
// Campaign boost: the strongest non-stackable campaign plus up to balance.marketing.stack_max stackable ones.
export function adBoost() {
  let best = 0, stack = 0, n = 0;
  const max = DATA.balance.marketing?.stack_max ?? 3;
  for (const c of state.campaigns || []) {
    if (c.days_left <= 0 || !c.boost) continue;
    const def = campaignById(c.id);
    if (def && def.stack) { if (n < max) { stack += c.boost; n++; } } else best = Math.max(best, c.boost);
  }
  return 1 + best + stack;
}
export const isWeekend = (day = state.day) => (DATA.balance.marketing?.weekend_days || [0, 6]).includes(day % 7);
// Attendance floors: the school program's weekday floor, and member visits (members x visit rate).
export function schoolFloor(day = state.day) {
  if (isWeekend(day)) return 0;
  let f = 0;
  for (const c of state.campaigns || []) if (c.days_left > 0 && c.floor) f = Math.max(f, c.floor);
  return f;
}
export function memberVisitsPerDay() {
  const m = state.members;
  if (!m || !m.active || !m.count) return 0;
  return Math.round(m.count * (DATA.balance.marketing?.memberships?.member_visit_rate || 0));
}
export function reputationFactor() { const mid = A().reputation_start; return 1 + A().reputation_weight * (state.reputation - mid) / mid; }
export function eventMult(key) {
  return state.modifiers.reduce((m, x) => m * (x[key] ?? 1), 1);
}

// Daily visitor cap = front gate + parking (lot tiers) + tram throughput. capacityParts() breaks it down for the UI.
export function capacityParts(tiers = state.facilities) {
  return { gate: A().front_gate_capacity, parking: facilitySum('parking_capacity', tiers), tram: facilitySum('gate_capacity', tiers) };
}
export function capacity(tiers = state.facilities) {
  const c = capacityParts(tiers);
  return c.gate + c.parking + c.tram;
}

export function computeAttendance(price = state.ticket_price, tiers = state.facilities) {
  const parts = appealParts();
  const factors = {
    base: A().base_demand * mode().attendance_bonus,
    appeal: parts.appeal,
    price: priceFactor(price, satisfaction(tiers)),
    season: seasonFactor(),
    ad: adBoost(),
    reputation: reputationFactor(),
    events: eventMult('attendance_mult')
  };
  const demand = Object.values(factors).reduce((a, b) => a * b, 1);
  const cap = capacity(tiers);
  const members = memberVisitsPerDay(), school = schoolFloor();
  const floor = Math.max(members, school);
  const attendance = state.closed_days > 0 ? 0 : Math.round(Math.min(Math.max(demand, floor), cap));
  const memberVisits = Math.min(attendance, members);
  return { attendance, demand: Math.round(demand), cap, floor, memberVisits, factors, parts };
}

export function efficiency() {
  const mgmt = roleById('management');
  return 1 + (staffCount('management') > 0 ? mgmt.effect_magnitude : 0);
}

// Concessions: open stores (concession_spend facilities above tier 0) need concessions staff, one per store for full effect.
export function concessionStores(tiers = state.facilities) {
  return facilitiesWithEffect('concession_spend').filter(f => f.effect_key === 'concession_spend' && (tiers[f.id] ?? facilityTier(f.id)) > 0);
}
export function concessionRevenue(attendance, tiers = state.facilities) {
  const stores = concessionStores(tiers);
  if (!stores.length) return 0;
  const factor = facilitySum('concession_spend', tiers);
  const staffFactor = Math.min(1, staffCount('concessions') / stores.length);
  return DATA.balance.revenue.per_visitor_concession_spend * attendance * factor * staffFactor * efficiency() * eventMult('concession_mult');
}

export function projectDay(price, tiers = state.facilities) {
  const { attendance, demand, cap, memberVisits } = computeAttendance(price, tiers);
  const tickets = Math.max(0, attendance - memberVisits) * price;
  const concessions = concessionRevenue(attendance, tiers);
  return { attendance, demand, cap, memberVisits, tickets, concessions, total: tickets + concessions };
}

export function parkRating() {
  const R = DATA.balance.rating;
  const parts = appealParts();
  if (!parts.dinos) return R.min;
  const appealScore = clamp((parts.popTerm + parts.bonusTerm) / R.appeal_full_pop_term, 0, 1);
  const satScore = satisfaction() / A().satisfaction_price_tolerance_cap;
  const score = R.weights.appeal * appealScore + R.weights.cleanliness * state.cleanliness / 100 + R.weights.satisfaction * satScore;
  return R.min + (R.max - R.min) * score;
}

export function ratingStars(rating = parkRating()) {
  const R = DATA.balance.rating;
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(R.max - full);
}
