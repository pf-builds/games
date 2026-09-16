// Goals panel (the end-game ladder with live progress) and the Year-5 Report Card modal. Logic: src/goals.js.
import { state, onChange, season, year, dayOfQuarter, T } from '../state.js';
import { goalsList, GOAL_ORDER, reportCardDay } from '../goals.js';
import { h, button, term, clear, append } from './dom.js';
import { openModal } from './modals.js';
import { modeChip, modeName } from './newgame.js';

const whenLabel = day => `Day ${dayOfQuarter(day)} · ${season(day)} · Year ${year(day)}`;
const TIP = { loan_repaid: 'loan', net_worth: 'net_worth', species: 'goal', rating_quarter: 'park_rating', grand_park: 'grand_park', report_card: 'report_card' };

// The ladder: every rung in order with a progress bar; the first unfinished rung is highlighted as "next".
export function goalsBody({ compact = false } = {}) {
  const wrap = h('div', { class: 'goals' });
  const render = () => {
    const list = goalsList();
    const nextIx = list.findIndex(g => !g.done);
    append(clear(wrap), [
      h('div', { class: 'row wrap small goals-mode' }, h('span', { class: 'muted' }, 'Difficulty'), modeChip(undefined, { badge: true }), compact ? null : h('span', { class: 'muted' }, 'fixed for this park')),
      compact ? null : h('p', { class: 'muted' }, 'The long game, one rung at a time. Each ', term('goal', 'goal'), ' fires once and the park keeps going afterwards. The ', term('grand_park', 'Grand Park'), ' needs every facility at its top tier, every spend prize and four five-star quarters in a row; the ', term('report_card', 'Year-5 Report Card'), ` grades the park at the close of year ${Math.round(reportCardDay() / (T().days_per_quarter * T().quarters_per_year))}.`),
      h('ol', { class: 'goal-ladder' }, list.map((g, i) => h('li', { class: `goal ${g.done ? 'done' : i === nextIx ? 'next' : ''}` },
        h('div', { class: 'goal-mark' }, g.done ? '✅' : i === nextIx ? '➡️' : '○'),
        h('div', {}, h('div', { class: 'goal-name' }, `${i + 1}. `, term(TIP[g.id] || 'goal', g.name)), h('div', { class: 'goal-detail' }, g.detail)),
        h('div', { class: 'goal-when' }, g.done ? whenLabel(g.day) : `${Math.round(g.progress * 100)}%`),
        h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${Math.round(g.progress * 100)}%` })),
        g.parts ? h('div', { class: 'goal-parts' }, g.parts.map(p => h('span', { class: p.done >= p.total ? 'ok' : '' }, `${p.done >= p.total ? '✓' : '·'} ${p.label} ${p.done}/${p.total}`))) : null)))]);
  };
  render();
  const off = onChange(() => { if (!wrap.isConnected) return off(); render(); });
  return wrap;
}

export function openGoals() {
  const m = openModal({ title: '🎯 Goals', className: 'wide', body: h('div', {}, goalsBody(), h('div', { class: 'row end' }, button('Close', () => m.close(), { class: 'btn primary' }))) });
  return m;
}

// ---- Year-5 Report Card ----
export function reportCardBody(card) {
  return h('div', { class: 'report-card' },
    h('div', { class: 'report-overall' },
      h('div', { class: `grade grade-${card.overall.grade}` }, card.overall.grade),
      h('div', {}, h('div', { class: 'lead', style: 'margin:0' }, `Year ${card.year}: overall ${card.overall.grade} `, modeChip(card.difficulty, { badge: true })), h('div', { class: 'muted' }, card.overall.comment), h('div', { class: 'muted small' }, `Issued ${whenLabel(Math.max(1, card.day - 1))} · grade points ${card.overall.points} of 4 · ${modeName(card.difficulty)} difficulty${card.difficulty === 'classic' ? ' (Classic badge earned)' : ''}`))),
    card.metrics.map(m => h('div', { class: 'report-row' },
      h('div', { class: `grade small grade-${m.grade}` }, m.grade),
      h('div', {}, h('span', { class: 'label' }, m.key === 'welfare' ? term('welfare', m.label) : m.key === 'education' ? term('education', m.label) : m.label), h('span', { class: 'muted' }, m.display), h('span', { class: 'muted small' }, m.comment)))));
}

export function openReportCard(card = state.report_card, { keepPlaying = true } = {}) {
  if (!card) return null;
  const m = openModal({ title: `🎓 Year-${card.year} Report Card`, className: 'wide grand slide-in', body: reportCardBody(card),
    foot: h('div', { class: 'row foot-row' }, h('span', { class: 'muted small' }, `The card stays in Reports.${keepPlaying ? ' The game keeps going: there is always a next goal.' : ''}`), button(keepPlaying ? 'Keep playing' : 'Close', () => m.close(), { class: 'btn primary' })) });
  return m;
}

// Reports-view panel: the stored card with an Open button, or the countdown to it.
export function reportCardPanel() {
  const card = state.report_card;
  if (card) return h('div', {}, h('p', { class: 'muted' }, `Overall ${card.overall.grade}: ${card.metrics.map(m => `${m.label} ${m.grade}`).join(' · ')}.`), button('Open the report card', () => openReportCard(card, { keepPlaying: false }), { class: 'btn primary' }));
  const at = reportCardDay(), left = Math.max(0, at - state.day + 1);
  return h('p', { class: 'muted' }, `Opens at the close of year ${Math.round(at / (T().days_per_quarter * T().quarters_per_year))} (${left} day${left === 1 ? '' : 's'} to go): grades A–F on profit, attendance, dinosaur welfare, education and guest satisfaction.`);
}
void GOAL_ORDER;
