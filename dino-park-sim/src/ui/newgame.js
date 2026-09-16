// Phase 2: the New Game dialog (three difficulty cards) and the mode chip shown wherever a run's mode matters
// (status-bar date tooltip, Reports, Goals, the Year-5 Report Card). Numbers come straight from data/difficulty.json.
import { DATA, state, modeIds, modeDef, modeId, fmt$, pct } from '../state.js';
import { h, button, term } from './dom.js';
import { openModal } from './modals.js';

const STANDARD = () => modeDef(DATA.difficulty.default_mode) || {};

// Everything a critic or a card needs to know about one mode, with the current run flagged.
export function modeSummary(id) {
  const m = modeDef(id);
  if (!m) return null;
  return {
    id, name: m.name, feel: m.feel || '', blurb: m.blurb || '', enabled: m.enabled !== false, current: !!state && modeId() === id,
    start_loan: m.start_loan, apr: m.apr, debt_cap_base: m.debt_cap_base, debt_cap_networth_factor: m.debt_cap_networth_factor,
    grace_quarters: m.grace_quarters, foreclosure_enabled: !!m.foreclosure_enabled,
    attendance_mult: m.attendance_mult ?? 1, event_frequency: m.event_frequency ?? 1, event_mult_vs_standard: round2((m.event_frequency ?? 1) / (STANDARD().event_frequency || 1)),
    food_cost_mult: m.food_cost_mult ?? 1, salary_mult: m.salary_mult ?? 1, breakout_mult: m.breakout_mult ?? 1, morale_softening: m.morale_softening !== false,
    overhead_mult: m.overhead_mult ?? 0
  };
}
const round2 = v => Math.round(v * 100) / 100;
const x = v => `×${round2(v)}`;

// The chip: "Standard" / "Classic" with the difficulty tooltip. `badge` adds the CLASSIC badge on the hardest mode.
export function modeChip(id = modeId(), { badge = false, cls = '' } = {}) {
  const m = modeDef(id);
  if (!m) return null;
  return h('span', { class: `mode-chip mode-${id} ${cls}`, 'data-tip': 'difficulty', title: m.feel || '' },
    m.name, badge && id === 'classic' ? h('span', { class: 'mode-badge' }, 'CLASSIC') : null);
}
export const modeName = (id = modeId()) => (modeDef(id) || {}).name || id;

// Key numbers for a card: loan, APR, grace, foreclosure, and the five multipliers.
export function modeFacts(id) {
  const s = modeSummary(id);
  if (!s) return [];
  return [
    ['Loan', `${fmt$(s.start_loan)} at ${pct(s.apr)} APR`],
    ['Grace', s.foreclosure_enabled ? `${s.grace_quarters} quarter${s.grace_quarters === 1 ? '' : 's'} over the cap, then foreclosure` : `${s.grace_quarters} quarters counted; the bank warns, never forecloses`],
    ['Debt cap', `${fmt$(s.debt_cap_base)} + ${pct(s.debt_cap_networth_factor)} of assets`],
    ['Visitors', x(s.attendance_mult)],
    ['Bad events', x(s.event_mult_vs_standard)],
    ['Feed & wages', `${x(s.food_cost_mult)} / ${x(s.salary_mult)}`],
    ['Breakouts', x(s.breakout_mult)],
    ['Morale', s.morale_softening ? 'softened penalties' : 'full penalties']
  ];
}

function modeCard(id, onPick, { current = false } = {}) {
  const m = modeDef(id);
  const s = modeSummary(id);
  const facts = modeFacts(id);
  return h('div', { class: `card mode-card mode-card-${id} ${current ? 'selected' : ''} ${s.enabled ? '' : 'disabled'}` },
    h('div', { class: 'card-title' }, modeChip(id, { badge: true }), current ? h('span', { class: 'muted small' }, ' (this park)') : null),
    h('div', { class: 'mode-feel' }, m.feel || ''),
    h('p', { class: 'muted small' }, m.blurb || ''),
    h('table', { class: 'table kv mode-facts' }, facts.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v)))),
    button(`Start ${m.name}`, () => onPick(id), { class: `btn ${id === DATA.difficulty.default_mode ? 'primary' : ''}`, disabled: !s.enabled, 'data-mode': id }));
}

// From Settings (cancelable) or the foreclosure screen (not). onStart(modeId) founds the park.
export function openNewGame({ onStart, cancelable = true, title = 'New Game', intro = null } = {}) {
  let picked = null;
  const m = openModal({
    title, className: 'wide newgame', closable: cancelable,
    body: h('div', {},
      h('p', {}, intro || ['Pick a ', term('difficulty', 'difficulty'), '. It is fixed for the whole run and shown on your reports. Unsaved progress in the current park is lost.']),
      h('div', { class: 'cards grid-3 mode-cards' }, modeIds().map(id => modeCard(id, id2 => { picked = id2; m.close(); }, { current: !!state && modeId() === id }))),
      cancelable ? h('div', { class: 'row end' }, button('Cancel', () => m.close())) : null),
    onClose: () => { if (picked) onStart(picked); }
  });
  return m;
}
