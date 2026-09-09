// Attendance, revenue projection, and park rating. Pure functions over state + DATA.
// Capacity, concession spend and satisfaction all come from fixed-facility tiers (data/facilities.json effect keys).
import { DATA, state, mode, allDinos, staffCount, speciesById, roleById, facilitiesWithEffect, facilityTier, facilityEffect, seasonIndex, clamp } from './state.js';

const A = () => DATA.balance.attendance;

export function appealParts() {
  const dinos = allDinos();
  const sickFactor = DATA.balance.dinosaur.sick_popularity_factor;
  const species = new Set();
  let pop = 0;
  for (const { dino } of dinos) {
    const sp = speciesById(dino.species);
    pop += sp.popularity * (dino.sick_days > 0 ? sickFactor : 1);
    species.add(dino.species);
  }
  const variety = 1 + A().variety_bonus_per_species * Math.max(0, species.size - 1);
  const popTerm = (pop / A().appeal_popularity_divisor) * variety;
  const cleanTerm = A().cleanliness_weight * state.cleanliness / 100;
  const appeal = dinos.length ? Math.max(A().appeal_min, popTerm + cleanTerm) : A().appeal_min * A().empty_park_factor;
  return { appeal, popTerm, cleanTerm, species: species.size, dinos: dinos.length };
}

// Sum of a facility effect key across all facilities at their current tier (or an override map for what-ifs).
export function facilitySum(key, tiers = state.facilities) {
  let s = 0;
  for (const f of facilitiesWithEffect(key)) s += facilityEffect(f.id, tiers[f.id] ?? facilityTier(f.id));
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
export function priceFactor(price, sat = satisfaction()) {
  const r = price / A().reference_ticket;
  const e = A().elasticity * (1 - sat);
  const k = A().price_penalty_exponent ?? 1;
  return r >= 1 ? Math.exp(-e * Math.pow(r - 1, k)) : Math.pow(1 / r, e);
}

export const seasonFactor = () => DATA.balance.time.season_factor[seasonIndex()];
export const adBoost = () => (state.ad && state.ad.days_left > 0 ? 1 + state.ad.boost : 1);
export function reputationFactor() { const mid = A().reputation_start; return 1 + A().reputation_weight * (state.reputation - mid) / mid; }
export function eventMult(key) {
  return state.modifiers.reduce((m, x) => m * (x[key] ?? 1), 1);
}

export function capacity(tiers = state.facilities) {
  return A().front_gate_capacity + facilitySum('parking_capacity', tiers);
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
  const attendance = state.closed_days > 0 ? 0 : Math.round(Math.min(demand, cap));
  return { attendance, demand: Math.round(demand), cap, factors, parts };
}

export function efficiency() {
  const mgmt = roleById('management');
  return 1 + (staffCount('management') > 0 ? mgmt.effect_magnitude : 0);
}

// Concessions: open stores (concession_spend facilities above tier 0) need concessions staff, one per store for full effect.
export function concessionStores(tiers = state.facilities) {
  return facilitiesWithEffect('concession_spend').filter(f => (tiers[f.id] ?? facilityTier(f.id)) > 0);
}
export function concessionRevenue(attendance, tiers = state.facilities) {
  const stores = concessionStores(tiers);
  if (!stores.length) return 0;
  const factor = facilitySum('concession_spend', tiers);
  const staffFactor = Math.min(1, staffCount('concessions') / stores.length);
  return DATA.balance.revenue.per_visitor_concession_spend * attendance * factor * staffFactor * efficiency() * eventMult('concession_mult');
}

export function projectDay(price, tiers = state.facilities) {
  const { attendance, demand, cap } = computeAttendance(price, tiers);
  const tickets = attendance * price;
  const concessions = concessionRevenue(attendance, tiers);
  return { attendance, demand, cap, tickets, concessions, total: tickets + concessions };
}

export function parkRating() {
  const R = DATA.balance.rating;
  const parts = appealParts();
  if (!parts.dinos) return R.min;
  const appealScore = clamp(parts.popTerm / R.appeal_full_pop_term, 0, 1);
  const satScore = satisfaction() / A().satisfaction_price_tolerance_cap;
  const score = R.weights.appeal * appealScore + R.weights.cleanliness * state.cleanliness / 100 + R.weights.satisfaction * satScore;
  return R.min + (R.max - R.min) * score;
}

export function ratingStars(rating = parkRating()) {
  const R = DATA.balance.rating;
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(R.max - full);
}
