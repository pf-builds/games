// Random events, mitigation by staff, and fence breakout checks.
import { DATA, state, bus, mode, enclosures, allDinos, staffCount, speciesById, roleById, facilityById, facilityTier, facilityEffect, season, log, pick, clamp } from './state.js';
import { parkRating } from './attendance.js';
import { quitRandomStaff } from './economy.js';

const E = () => DATA.events;

export function underFencedPlots() {
  return enclosures().filter(p => p.enclosure.dinos.some(d => speciesById(d.species).min_fence_tier > p.enclosure.fence_tier));
}

// Enclosures with a non-zero daily breakout chance (under-fenced, or a dangerous species behind a crumbling fence).
export function riskyEnclosures() { return enclosures().filter(p => breakoutChance(p.id) > 0); }

function eligible(ev) {
  const t = ev.trigger || {};
  const dinos = allDinos();
  if (t.requires_dinos && !dinos.length) return false;
  if (t.requires_breakout_risk && !riskyEnclosures().length) return false;
  if (t.min_dinos && dinos.length < t.min_dinos) return false;
  if (t.requires_under_fenced_dino && !underFencedPlots().length) return false;
  if (t.requires_staff && !state.staff.length) return false;
  if (t.min_staff && state.staff.length < t.min_staff) return false;
  if (t.requires_no_manager && staffCount('management') > 0) return false;
  if (t.seasons && !t.seasons.includes(season())) return false;
  if (t.min_park_rating && parkRating() < t.min_park_rating) return false;
  if (t.min_cleanliness && state.cleanliness < t.min_cleanliness) return false;
  if (t.min_species && new Set(dinos.map(x => x.dino.species)).size < t.min_species) return false;
  if (t.requires_role && staffCount(t.requires_role) === 0) return false;
  if (t.requires_enclosures && !enclosures().length) return false;
  return true;
}

function weightedPick(list) {
  const total = list.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of list) { r -= e.weight; if (r <= 0) return e; }
  return list[list.length - 1];
}

// Cooldowns: a quiet gap after any event, and a longer gap before the same event can repeat.
function offCooldown(ev) {
  const last = (state.event_log ||= {})[ev.id];
  return last == null || state.day - last >= E().same_event_cooldown_days;
}

// Returns a result object for the UI, or null when nothing happened.
export function rollDailyEvent() {
  if (state.day - (state.last_event_day ?? -Infinity) < E().min_days_between_events) return null;
  if (Math.random() >= E().daily_chance * mode().event_frequency) return null;
  const pool = E().events.filter(ev => eligible(ev) && offCooldown(ev));
  if (!pool.length) return null;
  const ev = weightedPick(pool);
  state.last_event_day = state.day;
  (state.event_log ||= {})[ev.id] = state.day;
  const averted = ev.type === 'negative' ? avertedBy(ev) : null;
  if (averted) {
    log(`${averted} staff headed off trouble: ${ev.title}.`);
    return { event: ev, averted };
  }
  const summary = applyEvent(ev);
  log(`${ev.title}: ${summary}`);
  return { event: ev, summary };
}

// Staff roll first (their effect_magnitude), then the facilities: the Vet Clinic against illness (illness_reduction,
// stacking with vets) and the Park Office against any negative event (event_mitigation). Returns who headed it off.
function avertedBy(ev) {
  for (const roleId of ev.mitigated_by || []) {
    if (staffCount(roleId) > 0 && Math.random() < roleById(roleId).effect_magnitude) return roleById(roleId).name;
  }
  const kind = ev.effect?.kind;
  const clinic = facilityEffect('vet_clinic', facilityTier('vet_clinic'), 'illness_reduction') || 0;
  if (kind === 'illness' && clinic > 0 && Math.random() < clinic) return facilityById('vet_clinic').tiers[facilityTier('vet_clinic')].label;
  const office = facilityEffect('office', facilityTier('office'), 'event_mitigation') || 0;
  if (office > 0 && Math.random() < office) return facilityById('office').tiers[facilityTier('office')].label;
  return null;
}

function reduction(ev) {
  let r = 1;
  if (ev.type !== 'negative') return r;
  if ((ev.mitigated_by || []).some(id => staffCount(id) > 0)) r *= 1 - E().mitigation_effect_reduction;
  return r;
}

export function applyEvent(ev, targetParcel = null) {
  const f = ev.effect;
  const r = reduction(ev);
  const notes = [];
  if (f.fence_damage) {
    const risky = riskyEnclosures();
    const targets = f.kind === 'storm' ? enclosures() : [targetParcel || pick(risky.length ? risky : underFencedPlots().length ? underFencedPlots() : enclosures().filter(p => p.enclosure.dinos.length))].filter(Boolean);
    for (const p of targets) p.enclosure.condition = clamp(p.enclosure.condition - f.fence_damage * r, 0, 100);
    if (targets.length) notes.push(`fence condition -${Math.round(f.fence_damage * r)}`);
    // Living Park listens for this and shows the loose dinosaur; audio sounds the siren; effects shake the screen.
    // The lifetime escape count feeds the Year-5 Report Card's welfare grade.
    if (f.kind === 'escape' && targets.length) { if (state.stats) state.stats.escapes = (state.stats.escapes || 0) + 1; bus.dispatchEvent(new CustomEvent('escape', { detail: { parcel: targets[0].id } })); }
  }
  // building_damage (storm): fixed facilities carry no condition in M2.5, so the storm's facility line is cosmetic.
  if (f.health_loss) {
    const all = allDinos();
    const victims = f.affects_all || f.kind === 'storm' ? all : all.length ? [pick(all)] : [];
    for (const { dino } of victims) {
      if (f.sick_days) { dino.sick_days = Math.round(f.sick_days * r); dino.sick_loss_per_day = (f.health_loss * r) / dino.sick_days; }
      else dino.health = clamp(dino.health - f.health_loss * r, 1, 100);
    }
    if (victims.length) notes.push(`${victims.length} dino${victims.length > 1 ? 's' : ''} affected`);
  }
  if (f.food_loss_units) {
    for (const p of enclosures()) for (const k in p.enclosure.food) p.enclosure.food[k] = Math.max(0, p.enclosure.food[k] - f.food_loss_units);
    notes.push('food spoiled');
  }
  if (f.count) { const gone = quitRandomStaff(f.count); if (gone.length) notes.push(`${gone.join(', ')} quit`); }
  if (f.morale_loss) for (const w of state.staff) w.morale = clamp(w.morale - f.morale_loss * r, 0, 100);
  if (f.closed_days) { state.closed_days += Math.round(f.closed_days); notes.push(`closed ${f.closed_days} day${f.closed_days > 1 ? 's' : ''}`); }
  if (f.cleanliness_loss) state.cleanliness = clamp(state.cleanliness - f.cleanliness_loss * r, 0, 100);
  if (f.attendance_mult || f.concession_mult) {
    state.modifiers.push({ attendance_mult: f.attendance_mult ?? 1, concession_mult: f.concession_mult ?? 1, days_left: f.days || 1 });
    notes.push(`visitors x${f.attendance_mult ?? 1} for ${f.days || 1} days`);
  }
  if (f.cash) { state.cash += f.cash; state.ledger.revenue.donations += f.cash; notes.push(`+$${f.cash.toLocaleString('en-US')}`); }
  if (f.reputation_loss) state.reputation = clamp(state.reputation - f.reputation_loss * r, 0, 100);
  if (f.reputation_gain) state.reputation = clamp(state.reputation + f.reputation_gain, 0, 100);
  return notes.join(', ') || 'no lasting damage';
}

// Daily breakout chance for one enclosure (M2.6 rules, data/fences.json breakout):
//  - fence tier >= every dinosaur's min tier: 0 for danger_level below low_condition_danger_min; dangerous species
//    only roll once condition drops below low_condition_threshold (low_condition_chance_per_day x danger_factor).
//  - fence below the min tier: base_chance_per_day x danger_factor[danger_level] x tiers short (worst dinosaur counts).
//  - security multiplies by (1 - effect_magnitude).
export function dangerFactor(level) {
  const table = DATA.fences.breakout.danger_factor || {};
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (!keys.length) return 1;
  if (table[String(level)] != null) return table[String(level)];
  return table[String(level < keys[0] ? keys[0] : keys[keys.length - 1])];
}
export function breakoutChance(parcelId) {
  const p = enclosures().find(q => q.id === parcelId) || state.parcels[parcelId];
  const enc = p && p.enclosure;
  if (!enc || !enc.dinos.length) return 0;
  const K = DATA.fences.breakout;
  let chance = 0;
  for (const d of enc.dinos) {
    const sp = speciesById(d.species);
    const short = sp.min_fence_tier - enc.fence_tier;
    let c = 0;
    if (short > 0) c = K.base_chance_per_day * dangerFactor(sp.danger_level) * short;
    else if (sp.danger_level >= (K.low_condition_danger_min ?? 3) && enc.condition < K.low_condition_threshold) c = K.low_condition_chance_per_day * dangerFactor(sp.danger_level);
    if (c > chance) chance = c;
  }
  const secRed = staffCount('security') > 0 ? roleById('security').effect_magnitude : 0;
  return Math.min(1, chance * (1 - secRed));
}

// Daily check per enclosure: rolls breakoutChance; an under-fenced pen reads as "Fence Too Weak", a crumbling one as "Breakout!".
export function checkBreakouts() {
  for (const p of enclosures()) {
    const chance = breakoutChance(p.id);
    if (chance <= 0 || Math.random() >= chance) continue;
    const enc = p.enclosure;
    const under = enc.dinos.some(d => speciesById(d.species).min_fence_tier > enc.fence_tier);
    const ev = E().events.find(e => e.id === (under ? 'escape_weak_fence' : 'escape'));
    const summary = applyEvent(ev, p);
    log(`${ev.title}: ${summary}`);
    return { event: ev, summary };
  }
  return null;
}
