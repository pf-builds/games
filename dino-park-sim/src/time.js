// Day tick, auto-advance loop, and win/lose checks. UI listens on the bus.
import { DATA, state, mode, bus, emitChange, emptyLedger, quarterIndex, speciesOwned, log, digestAdd, AWord, T } from './state.js';
import {
  dailyRevenue, distributeFood, feedAndAge, dailyCleanliness, tickAd, payday, closeQuarter, quarterlyDecay, netWorth, debtCap, sum
} from './economy.js';
import { rollDailyEvent, checkBreakouts } from './events.js';
import { parkRating } from './attendance.js';
import { autosave } from './save.js';

let timer = null;
let lastTick = 0;
let blocked = () => false;

export function setBlockedCheck(fn) { blocked = fn; }
export function emit(name, detail) { bus.dispatchEvent(new CustomEvent(name, { detail })); }

// Real milliseconds per game day at 1x. balance.living.day_seconds is the single clock number (M2.6: 6 s).
export const dayMs = () => (DATA.balance.living.day_seconds || 1) * 1000;

export function setSpeed(speed) {
  if (!T().speeds.includes(speed)) return;
  state.speed = speed;
  if (timer) { clearInterval(timer); timer = null; }
  if (speed > 0 && !state.game_over) {
    lastTick = performance.now();
    timer = setInterval(loop, 50);
  }
  emitChange();
}

function loop() {
  if (blocked() || state.game_over) { lastTick = performance.now(); return; }
  const interval = dayMs() / state.speed;
  const now = performance.now();
  while (now - lastTick >= interval) {
    lastTick += interval;
    advanceDay();
    if (blocked() || state.game_over) { lastTick = now; break; }
  }
}

export function advanceDay() {
  if (state.game_over) return;
  const day = state.day;
  dailyRevenue();
  distributeFood();
  const starving = feedAndAge();
  dailyCleanliness();
  const incident = checkBreakouts() || rollDailyEvent() || starvingWarning(starving);
  tickAd();
  if (day % T().days_per_month === 0) payday();
  let report = null;
  if (day % T().days_per_quarter === 0) report = endQuarter();
  state.day = day + 1;
  if (incident) routeIncident(incident);
  checkMilestones();
  if (report) {
    emit('quarter', report);
    checkForeclosure();
    if (!state.game_over) autosave(); // never snapshot a foreclosed park
  }
  emitChange();
}

// At 1x (or stepping) every event opens a modal. Above balance.events.pause_at_speed_max, and during a batch advance,
// only critical kinds (escapes) still pause; the rest go to the ticker (already logged) and the daily digest.
function routeIncident(incident) {
  const EV = DATA.balance.events || {};
  const kind = incident.event?.effect?.kind;
  const critical = (EV.pause_kinds || []).includes(kind) && !incident.averted;
  const quiet = batching || state.speed > (EV.pause_at_speed_max ?? 1);
  // Everything that happens while the clock is running goes in the digest, escapes included: the modal is
  // transient, and a player who advanced ten days at a time still needs a record of what happened on each of them.
  if (quiet) digestAdd({ title: incident.event.title, type: incident.event.type, averted: incident.averted || null, summary: incident.summary || null, tooltip: incident.event.tooltip });
  if (!quiet || critical) emit('event', incident);
}

// A starving dinosaur is a popup (pauses the clock), not just a ticker line: it is a $2,000+ asset about to die.
function starvingWarning(list) {
  if (!list.length) return null;
  const W = DATA.events.warnings.starving;
  const s = list[0];
  const message = W.message.replace('{species}', AWord(s.species)).replace('{enclosure}', s.enclosure).replace('{food}', s.food);
  return { event: { type: 'negative', title: W.title, message, tooltip: W.tooltip, effect: { kind: 'starving' } }, summary: `${list.length} dinosaur${list.length > 1 ? 's' : ''} losing ${DATA.balance.dinosaur.starve_health_loss_per_day} health per day` };
}

// Steps several days at once (debug / skip). Non-critical event popups go to the digest (ticker still logs them);
// escapes, quarterly reports and win/lose still open.
let batching = false;
export function advanceDays(n) {
  batching = n > 1;
  try { for (let i = 0; i < n && !state.game_over; i++) advanceDay(); }
  finally { batching = false; }
}

function endQuarter() {
  quarterlyDecay();
  const report = closeQuarter();
  // The new ledger belongs to the quarter that starts tomorrow (state.day is still the last day of this one).
  state.ledger = emptyLedger(quarterIndex(state.day + 1) + 1);
  return report;
}

// The bank calls the loan when NET debt (what you owe, less the cash you hold) stays above the cap it will lend
// against the park's assets. Borrowing to the ceiling and running an overdraft feed the same number, so a park
// that leveraged itself into three marquee dinosaurs it cannot feed fails the test as surely as one that is
// simply overdrawn — and raising the cap no longer pushes the trap further away.
export const netDebt = () => state.debt - state.cash;
function checkForeclosure() {
  if (!mode().foreclosure_enabled || state.game_over) return;
  state.over_cap_quarters = netDebt() > debtCap() ? state.over_cap_quarters + 1 : 0;
  if (state.over_cap_quarters >= mode().grace_quarters) {
    state.game_over = { kind: 'foreclosure', cause: foreclosureCause() };
    setSpeed(0);
    emit('lose', state.game_over);
  } else if (state.over_cap_quarters > 0) {
    log(`Warning: you owe more than your debt cap. ${mode().grace_quarters - state.over_cap_quarters} quarter(s) to pay it down or grow the park.`);
  }
}

function foreclosureCause() {
  const recent = state.history.slice(-mode().grace_quarters);
  const totals = {};
  let revenue = 0;
  for (const q of recent) {
    revenue += sum(q.revenue);
    for (const [k, v] of Object.entries(q.expenses)) totals[k] = (totals[k] || 0) + v;
    for (const [k, v] of Object.entries(q.capital)) totals[k] = (totals[k] || 0) + v;
  }
  const [worstKey, worstAmt] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || ['expenses', 0];
  const names = { salaries: 'Payroll', food: 'Food', upkeep: 'Upkeep', interest: 'Interest', loan_payment: 'Loan payments', tax: 'Taxes', land: 'Land purchases', fences: 'Fence building', dinosaurs: 'Dinosaur purchases', facilities: 'Facility upgrades', advertising: 'Advertising', repairs: 'Repairs', debt_repaid: 'Early loan repayment' };
  return { category: names[worstKey] || worstKey, amount: worstAmt, revenue, quarters: recent.length };
}

// Also called right after an early repayment so the win fires at the Bank, not on the next day tick.
export function checkMilestones() {
  const W = DATA.balance.win;
  const M = state.milestones;
  const checks = [
    ['loan_repaid', () => state.debt <= 0, 'Loan Repaid!', 'You paid the bank back every dollar. The park is yours, free and clear. Keep building.'],
    ['net_worth', () => netWorth() >= W.net_worth_target, 'Net Worth Milestone!', `Your park is now worth over $${W.net_worth_target.toLocaleString('en-US')} after debt.`],
    ['species', () => speciesOwned().size >= W.species_target, 'Species Collector!', `${W.species_target} different species live in your park.`],
    ['rating', () => parkRating() >= W.rating_target, 'Five-Star Park!', 'Visitors rate your park the best around.']
  ];
  for (const [key, cond, title, text] of checks) {
    if (M[key] || !cond()) continue;
    M[key] = true;
    emit('win', { key, title, text });
  }
}
