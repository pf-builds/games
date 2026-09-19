// Marketing view: ticket price slider with live what-if projection, the campaign ladder (data/campaigns.json),
// active campaigns with days left, and the Members panel (season pass price, count, quarterly revenue, churn).
import { DATA, state, fmt$, pct, emitChange, season, seasonIndex, campaignById, facilityById } from '../state.js';
import { projectDay, computeAttendance, capacityParts, isWeekend, memberVisitsPerDay } from '../attendance.js';
import * as eco from '../economy.js';
import { h, clear, term, button } from './dom.js';
import { fail } from './enclosure.js';

let live = null;
export function refreshMarketing() { live?.(); }

export function renderMarketing(root) {
  const A = DATA.balance.attendance;
  const proj = h('div', { class: 'projection' });
  const slider = h('input', { type: 'range', min: A.min_ticket, max: A.max_ticket, step: 1, value: state.ticket_price, class: 'slider' });
  const priceLabel = h('span', { class: 'price-readout' }, fmt$(state.ticket_price));
  const update = () => {
    const price = Number(slider.value);
    priceLabel.textContent = fmt$(price);
    clear(proj).append(projection(price));
  };
  slider.addEventListener('input', () => { state.ticket_price = Number(slider.value); update(); emitChange(); });
  const ads = h('div', {});
  const members = h('div', {});
  live = () => { update(); clear(ads).append(campaignLadder()); clear(members).append(membersPanel()); };
  live();
  clear(root).append(h('div', { class: 'page' },
    h('h2', {}, 'Marketing'),
    h('div', { class: 'panel' },
      h('h3', {}, 'Ticket price'),
      h('div', { class: 'cols' },
        h('div', {},
          h('div', { class: 'price-row' }, h('span', { class: 'muted' }, 'Ticket price'), priceLabel),
          h('div', { class: 'row slider-row' }, h('span', { class: 'muted' }, fmt$(A.min_ticket)), slider, h('span', { class: 'muted' }, fmt$(A.max_ticket))),
          h('p', { class: 'muted' }, term('elasticity', 'Elasticity'), ': raise the price and fewer people come. ', term('seasonality', 'Seasons'), ' change demand too. Tour guides and restrooms make visitors accept higher prices.'),
          seasonTable()),
        proj)),
    h('div', { class: 'panel' },
      h('h3', {}, term('campaign', 'Marketing ladder')),
      ads),
    h('div', { class: 'panel' },
      h('h3', {}, term('membership', 'Members')),
      members)));
}

function seasonTable() {
  const T = DATA.balance.time;
  const cur = seasonIndex();
  return h('table', { class: 'table seasons' },
    h('tr', {}, T.seasons.map((s, i) => h('th', { class: i === cur ? 'now' : '' }, s))),
    h('tr', {}, T.season_factor.map((f, i) => h('td', { class: i === cur ? 'now' : '' }, `${Math.round(f * 100)}% demand`))));
}

function projection(price) {
  const p = projectDay(price);
  const cur = computeAttendance(price);
  const f = cur.factors;
  const capped = cur.demand > cur.cap;
  const floored = cur.floor > cur.demand && !capped;
  return h('div', {},
    h('h3', { class: 'first' }, term('what_if', 'What-if'), ' at this price'),
    h('table', { class: 'table kv' },
      row('Projected visitors/day', `${p.attendance}${capped ? ` (demand ${p.demand}, capped at ${p.cap})` : floored ? ` (demand ${p.demand}, floor ${cur.floor})` : ''}`),
      row(term('capacity', 'Daily cap'), `${p.cap} (gate ${capacityParts().gate} + parking ${capacityParts().parking} + tram ${capacityParts().tram})`),
      p.memberVisits ? row(term('membership', 'Member visits/day'), `${p.memberVisits} (no ticket, still buy snacks)`) : null,
      row('Ticket revenue/day', fmt$(p.tickets)),
      row(term('concessions', 'Concession revenue/day'), fmt$(p.concessions)),
      row('Total revenue/day', fmt$(p.total)),
      row('Over a 90-day quarter', fmt$(p.total * DATA.balance.time.days_per_quarter))),
    h('p', { class: 'muted small' }, `Factors: base ${Math.round(f.base)} × appeal ${f.appeal.toFixed(2)} × price ${f.price.toFixed(2)} × ${season()} ${f.season} × ads ${f.ad.toFixed(2)} × reputation ${f.reputation.toFixed(2)}${f.events !== 1 ? ` × events ${f.events.toFixed(2)}` : ''}${state.closed_days ? ' · park closed today' : ''}${state.perks?.online_ticketing ? ' · online ticketing softens the price factor' : ''}`),
    capped ? h('p', { class: 'muted small' }, 'Demand is above capacity. Upgrade the Parking Lot or the Park Tram (General Store → Upgrades) to raise the daily limit.') : null,
    cur.parts.dinos === 0 ? h('p', { class: 'muted small' }, 'No living dinosaurs: nobody comes, and concessions earn nothing until there is something to see.') : null);
}

// ---- the ladder (shared with the General Store Advertising tab) ----
function effectLine(c) {
  if (c.kind === 'boost') return `+${pct(c.boost)} visitors for ${c.days} days${c.stack ? ` · stacks up to ${DATA.balance.marketing.stack_max}` : ''}`;
  if (c.kind === 'spike') return `+${pct(c.boost)} visitors for one day`;
  if (c.kind === 'floor') return `at least ${c.floor} visitors every weekday for ${c.days} days`;
  if (c.kind === 'perk') return `permanent: elasticity −${pct(c.elasticity_cut || 0)} (one-time)`;
  if (c.kind === 'memberships') return 'launch the season pass (one-time); set the price in the Members panel';
  return '';
}
function unlockLine(c) {
  const u = c.unlock || {};
  const parts = [];
  if (u.min_species) parts.push(`${u.min_species} species`);
  if (u.min_rating) parts.push(`${u.min_rating}-star rating`);
  if (u.requires_facility) for (const [fid, tier] of Object.entries(u.requires_facility)) parts.push(`${facilityById(fid).name} tier ${tier}+`);
  return parts.length ? `Unlocks with ${parts.join(' and ')}` : 'Always available';
}
export function campaignLadder() {
  const ladder = eco.marketingLadder();
  const active = eco.activeCampaigns();
  return h('div', {},
    active.length ? h('div', { class: 'row wrap active-campaigns' }, h('b', {}, 'Active:'), active.map(a => { const d = campaignById(a.id); return h('span', { class: 'tag tag-campaign' }, `${d?.name || a.id} · ${a.days_left} day${a.days_left === 1 ? '' : 's'} left${a.boost ? ` · +${pct(a.boost)}` : a.floor ? ` · floor ${a.floor}` : ''}`); }),
      state.perks?.online_ticketing ? h('span', { class: 'tag tag-campaign' }, 'Online Ticketing · permanent') : null,
      state.members.active ? h('span', { class: 'tag tag-campaign' }, `Memberships · ${state.members.count} members`) : null)
      : h('p', { class: 'muted' }, `No campaign running${state.perks?.online_ticketing ? ' (Online Ticketing is permanent)' : ''}${state.members.active ? ` · memberships live with ${state.members.count} members` : ''}.`),
    h('div', { class: 'cards grid-3 ladder-cards' }, ladder.map(({ def: c, lock, owned }, i) => h('div', { class: `card ${lock ? (owned ? 'owned' : 'locked') : ''}` },
      h('div', { class: 'card-title' }, `${i + 1}. ${c.name}`),
      h('div', { class: 'big' }, fmt$(c.cost)),
      h('div', { class: 'muted' }, effectLine(c)),
      h('div', { class: 'muted small' }, unlockLine(c)),
      (c.kind === 'boost' || c.kind === 'spike') && !lock ? campaignWhatIf(c) : null,
      h('div', { class: 'lesson small' }, 'Lesson: ', c.lesson),
      lock ? h('div', { class: owned ? 'good small' : 'bad small' }, owned ? '✓ ' : '🔒 ', lock) : null,
      button(owned ? 'Owned' : lock ? 'Locked' : c.kind === 'perk' || c.kind === 'memberships' ? 'Buy once' : 'Buy', () => { if (!fail(eco.buyCampaign(c.id))) emitChange(); }, { class: lock ? 'btn locked' : 'btn primary', disabled: !!lock || !eco.canAfford(c.cost) }),
      c.kind !== 'perk' && c.kind !== 'memberships' && !lock ? autoRenewToggle(c) : null))));
}
function autoRenewToggle(c) {
  const on = !!(state.auto_renew || {})[c.id];
  return button(on ? '🔄 Auto-renew ON' : '🔄 Auto-renew', () => { eco.toggleAutoRenew(c.id); emitChange(); }, { class: `btn small ${on ? 'active' : ''}`, style: on ? 'background:#2a5a2a;color:#8f8' : '' });
}

// What-if: project a day with the campaign added to the active list (economy untouched), scaled by its length.
function campaignWhatIf(c) {
  const before = projectDay(state.ticket_price);
  const saved = state.campaigns;
  state.campaigns = [...(saved || []), { id: c.id, days_left: c.days, boost: c.boost || 0, floor: c.floor || 0, kind: c.kind }];
  const after = projectDay(state.ticket_price);
  state.campaigns = saved;
  const gain = (after.total - before.total) * c.days;
  const capped = after.attendance >= after.cap;
  return h('div', { class: 'muted small' }, term('what_if', 'What-if'), `: about ${fmt$(gain)} extra over ${c.days} day${c.days === 1 ? '' : 's'} vs ${fmt$(c.cost)} cost${capped ? ' (capped by parking: part of the boost is wasted)' : ''}.`);
}

// ---- Members panel ----
function membersPanel() {
  const M = DATA.balance.marketing.memberships;
  const m = state.members;
  if (!m.active) {
    const def = campaignById('memberships');
    const lock = def ? eco.campaignLock(def) : 'no memberships campaign in data';
    return h('div', {},
      h('p', { class: 'muted' }, 'A ', term('membership', 'season pass'), ` turns visitors into members who pay every quarter and keep visiting (${pct(M.member_visit_rate)} of them each day, no ticket). They convert faster when satisfaction is high and the pass is fair (about ${M.fair_price_tickets} tickets' worth), and they leave (`, term('churn', 'churn'), `) when the rating slips below ${M.churn_low_rating} stars.`),
      h('p', {}, lock ? `Launch it from the ladder above once you have: ${lock}.` : `Ready to launch from the ladder above for ${fmt$(def.cost)}.`));
  }
  const c = eco.membershipConversion();
  const churn = eco.memberChurnRate();
  const slider = h('input', { type: 'range', min: M.pass_price_min, max: M.pass_price_max, step: M.pass_price_step, value: m.pass_price, class: 'slider' });
  const readout = h('span', { class: 'price-readout' }, `${fmt$(m.pass_price)}/quarter`);
  const stats = h('div', {});
  const renderStats = () => {
    const cc = eco.membershipConversion();
    const paying = Math.max(0, (state.today.attendance || 0) - (state.today.memberVisits || 0));
    clear(stats).append(h('table', { class: 'table kv' },
      row('Members', `${m.count}${cc.cap ? ` (cap ${cc.cap})` : ''}`),
      row('Joined this quarter', `${m.joined_q || 0}`),
      row('Converting today', `${(paying * cc.rate).toFixed(2)} new members/day (${pct(cc.rate)} of ${paying} paying visitors: satisfaction ×${cc.satF.toFixed(2)}, price ×${cc.priceF.toFixed(2)})`),
      row('Fair pass price', `${fmt$(cc.fair)} (${M.fair_price_tickets} tickets at ${fmt$(state.ticket_price)})`),
      row('Member visits/day', `${memberVisitsPerDay()} (attendance floor, no ticket)`),
      row('Projected quarterly revenue', fmt$(Math.round(m.count * (1 - churn)) * m.pass_price)),
      row(term('churn', 'Churn at quarter end'), `${pct(churn)}${churn > M.churn_base_per_quarter + 1e-9 ? ' (rating below ' + M.churn_low_rating + ' stars raises it)' : ''}`),
      row('Last quarter', m.revenue_last_q || m.churned_last_q ? `${fmt$(m.revenue_last_q)} from ${m.count + (m.churned_last_q || 0)} members · ${m.churned_last_q} left (${pct(m.churn_rate_last)}) · ${m.joined_last_q || 0} joined` : 'no quarter closed yet')));
  };
  slider.addEventListener('input', () => { eco.setPassPrice(slider.value); readout.textContent = `${fmt$(m.pass_price)}/quarter`; renderStats(); emitChange(); });
  renderStats();
  void c;
  return h('div', { class: 'cols' },
    h('div', {},
      h('div', { class: 'price-row' }, h('span', { class: 'muted' }, 'Season pass price'), readout),
      h('div', { class: 'row slider-row' }, h('span', { class: 'muted' }, fmt$(M.pass_price_min)), slider, h('span', { class: 'muted' }, fmt$(M.pass_price_max))),
      h('p', { class: 'muted small' }, `Members pay the pass price at every quarter close (Reports: Memberships line). Above the fair price fewer visitors convert; below it you leave money on the table. ${isWeekend() ? 'Weekend today.' : 'Weekday today.'}`)),
    stats);
}

const row = (k, v) => h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, v));
