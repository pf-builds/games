// Money, purchases, staff, food, upkeep, loans. All numbers come from DATA.
import {
  DATA, state, mode, speciesById, fenceByTier, biomeById, roleById, foodByDiet, foodById, campaignById,
  parcel, parcelDef, parcelDefs, parcelList, parcelArea, parcelOutlineCount, parcelSizeLabel, enclosures, allDinos, staffCount,
  facilityById, facilityDefs, facilityTier, facilityTierDef, facilityNextTier, log, clamp, pick, fmt$, pct, aWord, AWord
} from './state.js';
import { computeAttendance, concessionRevenue, efficiency } from './attendance.js';

const B = () => DATA.balance;

// ---- cash helpers ----
export const canAfford = n => state.cash >= n;
export function spend(n, group, key) { state.cash -= n; state.ledger[group][key] += n; }
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
    v += parcelPrice(p.id) * NW.land_value_ratio;
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
export function parcelPrice(id) {
  const def = parcelDef(id);
  return Math.round(biomeById(def.biome).plot_cost * areaFactor(parcelArea(id)));
}
// Fence segments = outline edges of the tile set (edges not shared with another tile of the same parcel).
export const perimeterSegments = id => parcelOutlineCount(id);
export const parcelCapacity = id => parcelArea(id) * B().parcel.space_per_tile;

export function buyParcel(id) {
  const p = parcel(id);
  if (!p) return 'No such parcel.';
  const def = parcelDef(id);
  const biome = biomeById(def.biome);
  if (p.owned) return 'Already owned.';
  const price = parcelPrice(id);
  if (!canAfford(price)) return `Need ${fmt$(price)} for parcel ${id} (${biome.name}, ${parcelSizeLabel(id)}).`;
  spend(price, 'capital', 'land');
  p.owned = true;
  log(`Bought parcel ${id}: ${parcelSizeLabel(id)} ${biome.name} for ${fmt$(price)}.`);
  return null;
}

// ---- fences ----
export const fenceCost = (tier, id) => fenceByTier(tier).cost_per_segment * perimeterSegments(id);

export function buildFence(id, tier) {
  const p = parcel(id);
  if (!p || !p.owned || p.enclosure) return 'Parcel must be owned and empty.';
  const cost = fenceCost(tier, id);
  if (!canAfford(cost)) return 'Not enough cash for that fence.';
  spend(cost, 'capital', 'fences');
  p.enclosure = { fence_tier: tier, condition: 100, dinos: [], food: Object.fromEntries(DATA.food.items.map(f => [f.id, 0])) };
  log(`Built ${aWord(fenceByTier(tier).name)} enclosure on parcel ${id}.`);
  return null;
}

export const upgradeCost = (enc, tier, id) => fenceCost(tier, id) - fenceCost(enc.fence_tier, id);
export function upgradeFence(id, tier) {
  const enc = parcel(id).enclosure;
  if (tier <= enc.fence_tier) return 'That is not an upgrade.';
  const cost = upgradeCost(enc, tier, id);
  if (!canAfford(cost)) return 'Not enough cash for that upgrade.';
  spend(cost, 'capital', 'fences');
  enc.fence_tier = tier;
  enc.condition = 100;
  log(`Upgraded fence on parcel ${id} to ${fenceByTier(tier).name}.`);
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
  return null;
}

// ---- dinosaurs ----
export const spaceUsed = enc => enc.dinos.reduce((s, d) => s + speciesById(d.species).space_required, 0);
export const spaceCapacity = id => parcelCapacity(id);
export function enclosureFits(p, species) {
  const enc = p.enclosure;
  return !!enc && enc.fence_tier >= species.min_fence_tier && spaceUsed(enc) + species.space_required <= spaceCapacity(p.id);
}
export const validEnclosuresFor = species => enclosures().filter(p => enclosureFits(p, species));

export function addDino(id, speciesId, health = B().dinosaur.health_max) {
  const p = parcel(id);
  const dino = { uid: state.next_uid++, species: speciesId, health, hunger: 0, age_days: 0, sick_days: 0 };
  p.enclosure.dinos.push(dino);
  return dino;
}

export function buyDino(speciesId, id, price = speciesById(speciesId).shop_price, health) {
  const sp = speciesById(speciesId);
  const p = parcel(id);
  if (!p || !p.enclosure || !enclosureFits(p, sp)) return 'That enclosure will not work for this species.';
  if (!canAfford(price)) return `Need ${fmt$(price)} to buy ${aWord(sp.name)}.`;
  spend(price, 'capital', 'dinosaurs');
  addDino(id, speciesId, health);
  log(`${AWord(sp.name)} arrived at parcel ${id}.`);
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
  spend(cost, 'expenses', 'food');
  enc.food[foodId] += units;
  return null;
}

export function buyParkFood(foodId, units) {
  const food = foodById(foodId);
  const cost = units * food.unit_cost;
  if (!canAfford(cost)) return 'Not enough cash for that food.';
  spend(cost, 'expenses', 'food');
  state.park_food[foodId] += units;
  return null;
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
  const vet = roleById('veterinary');
  const hasVet = staffCount('veterinary') > 0;
  const starving = [];
  for (const p of enclosures()) {
    const enc = p.enclosure;
    for (const d of [...enc.dinos]) {
      const sp = speciesById(d.species);
      const food = foodByDiet(sp.diet);
      const fed = food && enc.food[food.id] >= sp.food_per_day;
      if (fed) { enc.food[food.id] -= sp.food_per_day; d.hunger = 0; }
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
      else if (d.hunger < D.hunger_max && d.health > 0) d.health = Math.min(D.health_max, d.health + (hasVet ? vet.heal_per_day : D.health_regen_per_day));
      d.age_days += 1;
      if (d.age_days > sp.lifespan_years * D.days_per_year) d.health = 0;
      if (d.health <= 0) { enc.dinos.splice(enc.dinos.indexOf(d), 1); log(`${AWord(sp.name)} died (${d.hunger >= D.hunger_max ? 'starved' : d.sick_days > 0 ? 'illness' : 'old age'}).`); }
    }
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
  const { attendance } = computeAttendance();
  const tickets = attendance * state.ticket_price;
  const concessions = Math.round(concessionRevenue(attendance));
  earn(tickets, 'tickets');
  earn(concessions, 'concessions');
  state.ledger.attendance += attendance;
  state.ledger.days += 1;
  state.today = { attendance, tickets, concessions };
}

// ---- staff ----
export function hire(roleId) {
  const role = roleById(roleId);
  if (!canAfford(role.salary_per_month)) return 'You need at least one month of salary in cash to hire.';
  state.staff.push({ role: roleId, morale: DATA.staff.morale.start, hired_day: state.day });
  log(`Hired ${aWord(role.name)} worker.`);
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

// Payroll is always charged, even into overdraft. That is how overspending on staff can sink the park:
// overdrawn cash costs penalty interest and pulls the debt cap down. Staff paid from overdraft lose morale.
export function payday() {
  const M = DATA.staff.morale;
  if (!state.staff.length) return;
  const payroll = monthlyPayroll();
  spend(payroll, 'expenses', 'salaries');
  const overdrawn = state.cash < 0;
  let delta = needsManager() ? -M.no_manager_penalty_per_month : (staffCount('management') > 0 ? M.manager_bonus_per_month : 0);
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
  spend(next.cost, 'capital', 'facilities');
  state.facilities[id] = next.tier;
  log(`${f.name} upgraded to ${next.label} (tier ${next.tier}).`);
  return null;
}

// ---- advertising ----
export function buyCampaign(id) {
  const c = campaignById(id);
  if (!canAfford(c.cost)) return `Need ${fmt$(c.cost)} for ${c.name}.`;
  spend(c.cost, 'capital', 'advertising');
  const active = state.ad && state.ad.days_left > 0 ? state.ad : null;
  if (!active || c.boost >= active.boost) state.ad = { id: c.id, boost: c.boost, days_left: c.days };
  log(`${c.name} campaign started: +${Math.round(c.boost * 100)}% visitors for ${c.days} days.`);
  return null;
}
export function tickAd() {
  if (state.ad && state.ad.days_left > 0) state.ad.days_left -= 1;
  state.modifiers = state.modifiers.map(m => ({ ...m, days_left: m.days_left - 1 })).filter(m => m.days_left > 0);
  if (state.closed_days > 0) state.closed_days -= 1;
}

// ---- bank ----
export function borrow(n) {
  if (state.debt + n > debtCap()) return 'That would go past your debt cap.';
  state.debt += n;
  state.cash += n;
  log(`Borrowed ${fmt$(n)} from the bank.`);
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
  L.cash_end = state.cash;
  L.debt_end = state.debt;
  state.history.push(L);
  if (state.history.length > B().history.quarters_kept) state.history.shift();
  return L;
}
export const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0);
