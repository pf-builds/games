// M5 end-game ladder: Loan repaid -> Net worth target -> 10 species -> 5-star quarter -> Grand Park -> Year-5 Report
// Card. Thresholds live in data/balance.json `goals`; this module decides when a goal fires (once, in any order),
// reports live progress for the Goals panel, and grades the report card. Announcements go out on the bus ('goal',
// 'report_card'); the shell turns them into modals, toasts and the fanfare.
import { DATA, state, bus, facilityDefs, facilityTier, facilityTopTier, prizeDefs, prizeEarned, speciesOwned, allDinos, mode, modeId, T, quarterIndex, year, fmt$, log, digestAdd } from './state.js';
import { netWorth } from './economy.js';
import { parkRating } from './attendance.js';

const G = () => DATA.balance.goals;
export const GOAL_ORDER = ['loan_repaid', 'net_worth', 'species', 'rating_quarter', 'grand_park', 'report_card'];

const COPY = {
  loan_repaid: { name: 'Repay the loan', title: 'Loan Repaid!', text: 'You paid the bank back every dollar. The park is yours, free and clear. Keep building.' },
  net_worth: { name: 'Net worth target', title: 'Net Worth Milestone!', text: () => `Your park is now worth over ${fmt$(G().net_worth.target)} after debt.` },
  species: { name: 'Species collector', title: 'Species Collector!', text: () => `${G().species.count} different species live in your park.` },
  rating_quarter: { name: 'Five-star quarter', title: 'Five-Star Park!', text: () => `A whole quarter closed with a ${G().rating_quarter.stars}-star rating. Visitors rate your park the best around.` },
  grand_park: { name: 'Grand Park', title: 'Grand Park!', text: () => `Every facility at its best, every spend prize earned, and ${G().grand_park.stars} stars held for ${G().grand_park.consecutive_quarters} quarters in a row. A plaque goes up at the gate.` },
  report_card: { name: 'Year-5 Report Card', title: 'Year-5 Report Card', text: 'Five years of running the park, graded.' }
};
export const goalCopy = id => ({ id, name: COPY[id].name, title: COPY[id].title, text: typeof COPY[id].text === 'function' ? COPY[id].text() : COPY[id].text });

export const goalDone = id => !!(state.goals && state.goals.done && state.goals.done[id]);
export const goalDay = id => (state.goals && state.goals.done ? state.goals.done[id] : null) ?? null;
const clamp01 = v => Math.max(0, Math.min(1, v));

// ---- pieces of the Grand Park ----
export function facilitiesAtMax() {
  const all = facilityDefs();
  return { done: all.filter(f => facilityTier(f.id) >= facilityTopTier(f.id).tier).length, total: all.length };
}
export function spendPrizesEarned() {
  const all = prizeDefs().filter(p => p.threshold != null);
  return { done: all.filter(p => prizeEarned(p.id)).length, total: all.length };
}
export const fiveStarStreak = () => (state.goals && state.goals.streak) || 0;
export const reportCardDay = () => G().report_card.year * T().quarters_per_year * T().days_per_quarter;

// Live progress for one goal: { id, name, done, day, progress 0..1, detail, parts? }.
export function goalProgress(id) {
  const c = goalCopy(id);
  const done = goalDone(id), day = goalDay(id);
  const base = { id, name: c.name, title: c.title, done, day, progress: done ? 1 : 0, detail: '' };
  if (id === 'loan_repaid') {
    const start = mode().start_loan || 1;
    const debt = Math.max(0, state.debt);
    return { ...base, progress: done ? 1 : clamp01(1 - debt / start), detail: done ? 'Debt free' : `${fmt$(debt)} still owed` };
  }
  if (id === 'net_worth') {
    const t = G().net_worth.target, nw = netWorth();
    return { ...base, progress: done ? 1 : clamp01(nw / t), detail: `${fmt$(nw)} of ${fmt$(t)}` };
  }
  if (id === 'species') {
    const n = speciesOwned().size, t = G().species.count;
    return { ...base, progress: done ? 1 : clamp01(n / t), detail: `${n} of ${t} species alive` };
  }
  if (id === 'rating_quarter') {
    const stars = G().rating_quarter.stars, r = parkRating();
    const last = state.history[state.history.length - 1];
    return { ...base, progress: done ? 1 : clamp01(r / stars), detail: done ? `${stars}-star quarter closed` : `rating ${r.toFixed(1)} now${last && last.rating_end != null ? `, ${last.rating_end.toFixed(1)} at the last quarter close` : ''}; needs ${stars} at a quarter close` };
  }
  if (id === 'grand_park') {
    const f = facilitiesAtMax(), p = spendPrizesEarned(), need = G().grand_park.consecutive_quarters, streak = Math.min(need, fiveStarStreak());
    const parts = [
      { key: 'facilities', label: 'Facilities at top tier', done: f.done, total: f.total },
      { key: 'prizes', label: 'Spend prizes earned', done: p.done, total: p.total },
      { key: 'streak', label: `${G().grand_park.stars}-star quarters in a row`, done: streak, total: need }
    ];
    const progress = done ? 1 : parts.reduce((s, x) => s + (x.total ? x.done / x.total : 1), 0) / parts.length;
    const met = parts.filter(x => x.done >= x.total).length;
    return { ...base, progress, parts, detail: done ? 'Every condition met' : `${met} of ${parts.length} conditions met` }; // the parts row lists them
  }
  if (id === 'report_card') {
    const at = reportCardDay();
    const left = Math.max(0, at - state.day + 1);
    return { ...base, progress: done ? 1 : clamp01((state.day - 1) / at), detail: done ? `Graded ${state.report_card ? state.report_card.overall.grade : ''}` : `opens at the close of year ${G().report_card.year} (${left} day${left === 1 ? '' : 's'} to go)` };
  }
  return base;
}
export const goalsList = () => GOAL_ORDER.map(goalProgress);

function conditionMet(id, ctx) {
  if (id === 'loan_repaid') return state.debt <= 0;
  if (id === 'net_worth') return netWorth() >= G().net_worth.target;
  if (id === 'species') return speciesOwned().size >= G().species.count;
  if (id === 'rating_quarter') return !!ctx.quarterClosed && ctx.rating >= G().rating_quarter.stars;
  if (id === 'grand_park') {
    const f = facilitiesAtMax(), p = spendPrizesEarned();
    return f.done >= f.total && p.done >= p.total && fiveStarStreak() >= G().grand_park.consecutive_quarters;
  }
  return false; // report_card is opened by the calendar (time.js), never by a condition
}

// Called every day after the tick, at each quarter close ({ quarterClosed, rating }) and after an early loan
// repayment. Awards every unfired goal whose condition now holds, in ladder order. Returns the ids fired.
export function checkGoals(ctx = {}) {
  state.goals ||= { done: {}, streak: 0 };
  state.goals.done ||= {};
  if (ctx.quarterClosed) state.goals.streak = ctx.rating >= G().grand_park.stars ? (state.goals.streak || 0) + 1 : 0;
  const fired = [];
  for (const id of GOAL_ORDER) {
    if (goalDone(id) || !conditionMet(id, ctx)) continue;
    award(id);
    fired.push(id);
  }
  return fired;
}

export function award(id) {
  if (goalDone(id)) return false;
  state.goals.done[id] = state.day;
  const c = goalCopy(id);
  log(`Goal reached: ${c.title}`);
  digestAdd({ title: `Goal: ${c.title}`, type: 'prize', summary: c.name, tooltip: c.text });
  bus.dispatchEvent(new CustomEvent('goal', { detail: { id, key: id, title: c.title, text: c.text, grand: id === 'grand_park' } }));
  return true;
}

// ---- Year-5 Report Card ----
const LETTERS = ['A', 'B', 'C', 'D'];
function grade(value, th) {
  for (const l of LETTERS) if (value >= th[l]) return l;
  return 'F';
}
const COMMENTS = {
  profit: { A: 'A money machine: the park earned more than it spent all year.', B: 'Solid profit. The books balance with room to spare.', C: 'In the black, but only just. Watch the payroll.', D: 'Barely broke even. Costs are eating the ticket money.', F: 'The park lost money this year. Something big is out of proportion.' },
  attendance: { A: 'The gates were busy every day of the year.', B: 'Good crowds; a few quiet weeks in winter.', C: 'A steady trickle. More species and marketing would fill the paths.', D: 'Thin crowds. Visitors have not heard of you yet.', F: 'Almost nobody came. There was little to see.' },
  welfare: { A: 'Healthy, well-fed animals and no incidents to speak of.', B: 'Well looked after, with the odd scare.', C: 'Animals got by, but escapes or losses cost you.', D: 'Too many sick, hungry or lost animals.', F: 'The animals paid for the park\'s mistakes.' },
  education: { A: 'Visitors leave knowing their dinosaurs. A real teaching park.', B: 'Good field notes and a busy Fact Book.', C: 'Some learning on offer; the Visitor Center could do more.', D: 'Not much to learn here beyond the fences.', F: 'No Visitor Center, no school program, no facts shared.' },
  satisfaction: { A: 'Five stars, quarter after quarter.', B: 'Guests leave happy and come back.', C: 'A fair day out. Restrooms and guides would lift it.', D: 'Guests grumble about queues and litter.', F: 'Visitors rate the park poorly. Clean it up and staff it.' }
};
const OVERALL = { A: 'A grand park by any measure.', B: 'A well-run park with a weak spot or two.', C: 'A park that works, not yet one people talk about.', D: 'Surviving, not thriving. Pick one grade to fix first.', F: 'Five hard years. The report says where the money went.' };

// Grades the park on the year just closed (last quarters_per_year closed quarters) and lifetime welfare/education.
export function buildReportCard() {
  const R = G().report_card, GP = R.grade_points;
  const qpy = T().quarters_per_year;
  const hist = state.history.slice(-qpy);
  const days = hist.reduce((s, q) => s + (q.days || 0), 0);
  const profit = hist.reduce((s, q) => s + (q.profit || 0), 0);
  const attendance = days ? hist.reduce((s, q) => s + (q.attendance || 0), 0) / days : 0;
  const dinos = allDinos();
  const avgHealth = dinos.length ? dinos.reduce((s, x) => s + x.dino.health, 0) / dinos.length : 0;
  const st = state.stats || {};
  const welfare = Math.max(0, avgHealth - (st.deaths || 0) * R.welfare.death_penalty - (st.escapes || 0) * R.welfare.escape_penalty);
  const education = facilityTier('visitor_center') * R.education.per_tier + Math.min(R.education.fact_cap, (st.fact_views || 0) * R.education.per_fact) + (st.school_ran ? R.education.school_bonus : 0);
  const rated = hist.filter(q => q.rating_end != null);
  const satisfaction = rated.length ? rated.reduce((s, q) => s + q.rating_end / DATA.balance.rating.max, 0) / rated.length * 100 : parkRating() / DATA.balance.rating.max * 100;
  const metric = (key, label, value, display, comment) => { const g = grade(value, R[key]); return { key, label, value: Math.round(value * 10) / 10, display, grade: g, points: GP[g], comment: comment ? comment(g) : COMMENTS[key][g] }; };
  const vcTier = facilityTier('visitor_center'), vcTop = facilityTopTier('visitor_center').tier;
  // Education and welfare are sums of parts, so their comment names what carried the grade and what was missing;
  // a grade-only line ("a busy Fact Book") can contradict the data beside it.
  const educationComment = g => {
    if (g === 'F') return COMMENTS.education.F;
    const carried = vcTier >= vcTop ? 'The Discovery Hall does the teaching' : vcTier > 0 ? `The tier-${vcTier} Visitor Center does the teaching` : 'The Fact Book does the teaching';
    const missing = [];
    if (!st.fact_views) missing.push('nobody opened the Fact Book');
    if (!st.school_ran) missing.push('the school program never ran');
    if (vcTier < vcTop) missing.push(vcTier > 0 ? 'the Visitor Center could grow' : 'there is no Visitor Center');
    if (g === 'A') return missing.length ? `${carried}; visitors leave knowing their dinosaurs, though ${missing[0]}.` : COMMENTS.education.A;
    return missing.length ? `${carried}, but ${missing.join(' and ')}.` : COMMENTS.education[g];
  };
  const welfareComment = g => {
    const incidents = (st.deaths || 0) + (st.escapes || 0);
    if (g === 'A' && incidents) return `Healthy, well-fed animals; ${st.deaths ? `${st.deaths} death${st.deaths === 1 ? '' : 's'}` : ''}${st.deaths && st.escapes ? ' and ' : ''}${st.escapes ? `${st.escapes} escape${st.escapes === 1 ? '' : 's'}` : ''} over five years is a record most parks would take.`;
    if (g === 'B' && !incidents) return `Well looked after and no incidents; average health ${Math.round(avgHealth)} kept it off an A.`;
    return COMMENTS.welfare[g];
  };
  const metrics = [
    metric('profit', 'Profit', profit, `${fmt$(profit)} over year ${year(Math.max(1, state.day - 1))}`),
    metric('attendance', 'Attendance', attendance, `${Math.round(attendance)} visitors a day`),
    metric('welfare', 'Dinosaur welfare', welfare, `avg health ${Math.round(avgHealth)} · ${st.deaths || 0} death${st.deaths === 1 ? '' : 's'} · ${st.escapes || 0} escape${st.escapes === 1 ? '' : 's'}`, welfareComment),
    metric('education', 'Education', education, `Visitor Center tier ${vcTier} · ${st.fact_views || 0} Fact Book views · school program ${st.school_ran ? 'ran' : 'never ran'}`, educationComment),
    metric('satisfaction', 'Guest satisfaction', satisfaction, `${Math.round(satisfaction)}% of five stars over the year`)
  ];
  const points = metrics.reduce((s, m) => s + m.points, 0) / metrics.length;
  const overallGrade = points >= 3.5 ? 'A' : points >= 2.5 ? 'B' : points >= 1.5 ? 'C' : points >= 0.5 ? 'D' : 'F';
  return { year: R.year, day: state.day, quarter: quarterIndex(Math.max(1, state.day - 1)) + 1, difficulty: modeId(), metrics, overall: { grade: overallGrade, points: Math.round(points * 100) / 100, comment: OVERALL[overallGrade] } };
}

// Opens (stores + announces) the report card. time.js calls this when the closing quarter is the last of year 5.
export function issueReportCard() {
  const card = buildReportCard();
  state.report_card = card;
  state.goals.done.report_card ||= state.day;
  log(`Year-${card.year} Report Card: overall ${card.overall.grade}. It stays in Reports.`);
  digestAdd({ title: `Year-${card.year} Report Card: ${card.overall.grade}`, type: 'prize', summary: card.metrics.map(m => `${m.label} ${m.grade}`).join(' · '), tooltip: card.overall.comment });
  bus.dispatchEvent(new CustomEvent('report_card', { detail: card }));
  return card;
}
// The quarter that just closed is the final one of report_card.year (state.day is still that quarter's last day).
export const reportCardDue = day => !state.report_card && day === reportCardDay();

// Test hook: drive a goal's conditions and re-check. Grand Park maxes every facility, awards every spend prize and
// fills the streak; the report card is issued on the spot; the rest set the number the condition reads.
export function forceGoal(id) {
  if (!GOAL_ORDER.includes(id)) return `No such goal: ${id}`;
  if (id === 'loan_repaid') state.debt = 0;
  else if (id === 'net_worth') state.cash += Math.max(0, G().net_worth.target - netWorth());
  else if (id === 'grand_park') {
    for (const f of facilityDefs()) state.facilities[f.id] = facilityTopTier(f.id).tier;
    for (const p of prizeDefs()) if (p.threshold != null && !prizeEarned(p.id)) state.prizes.push({ id: p.id, day: state.day });
    state.goals.streak = Math.max(state.goals.streak || 0, G().grand_park.consecutive_quarters);
  } else if (id === 'report_card') { if (!state.report_card) issueReportCard(); return goalProgress(id); }
  else if (id === 'rating_quarter') { checkGoals({ quarterClosed: true, rating: G().rating_quarter.stars }); return goalProgress(id); }
  else if (id === 'species') { award('species'); return goalProgress(id); }
  checkGoals();
  return goalProgress(id);
}
