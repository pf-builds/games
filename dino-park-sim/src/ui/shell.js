// App shell: status bar, toolbar/view switching, speed controls, ticker, keyboard, and bus-driven modals.
import { DATA, state, bus, onChange, fmt$, season, year, dayOfQuarter, quarterIndex, T, fenceByTier, emitChange, mode } from '../state.js';
import { parkRating } from '../attendance.js';
import { setSpeed, advanceDay, setBlockedCheck, bankState } from '../time.js';
import { openNewGame, modeName } from './newgame.js';
import { h, append, button, term, starsEl, clear } from './dom.js';
import { openModal, closeTop, modalOpen, closeAll, closeBelowTop, topModal } from './modals.js';
import { initPark, setGridActive } from '../render/park.js';
import { initViewport, fitCanvas } from '../render/viewport.js';
import { initLiving, startLiving, stopLiving } from '../render/living.js';
import { initAgents } from '../sim/agents.js';
import { onParcelClick, facilityPanel } from './enclosure.js';
import { renderTown, refreshTown } from './town.js';
import { renderReports, openQuarterlyReport } from './reports.js';
import { renderMarketing, refreshMarketing, renderParkRail } from './marketing.js';
import { renderFactbook } from './factbook.js';
import { renderSettings } from './settings.js';
import { openPrizes, prizeToast } from './prizes.js';
import { nextPrize } from '../prizes.js';
import { foodDayChips } from './food.js';
import { openGeneralStore } from './stores.js';
import { openGoals, openReportCard } from './goals.js';
import { goalsList } from '../goals.js';
import { initJuice, toast } from './effects.js';
import { play as playSfx } from '../audio.js';

const $ = id => document.getElementById(id);
let current = 'town';
let parkMode = 'living'; // 'living' (default hero view) | 'grid' (Buy Land survey map)
let startNewGame = () => {};

// live: re-render on every state change (views that show numbers).
const VIEWS = {
  town: { render: renderTown, live: false, refresh: refreshTown },
  park: { render: renderParkBar, live: true },
  reports: { render: renderReports, live: true },
  marketing: { render: renderMarketing, live: false, refresh: refreshMarketing },
  factbook: { render: renderFactbook, live: false },
  settings: { render: root => renderSettings(root, { startNewGame, showTutorial: () => { resetTips(); tutorialHint(); } }), live: false }
};

export function initShell({ onNewGame }) {
  startNewGame = onNewGame;
  setBlockedCheck(modalOpen);
  initToolbar();
  initSpeed();
  initKeys();
  initViewport($('park'));
  const handlers = { onParcelClick, onFacilityClick: facilityPanel };
  initPark($('park'), handlers);
  initAgents({ paused: modalOpen });
  initLiving($('park'), handlers);
  $('fullscreen').addEventListener('click', toggleFullscreen);
  initTicker();
  onChange(refresh);
  initJuice();
  bus.addEventListener('quarter', e => openQuarterlyReport(e.detail));
  bus.addEventListener('event', e => eventPopup(e.detail));
  bus.addEventListener('goal', e => (e.detail.grand ? grandParkPopup(e.detail) : winPopup(e.detail)));
  bus.addEventListener('report_card', e => reportCardPopup(e.detail));
  bus.addEventListener('lose', e => losePopup(e.detail));
  bus.addEventListener('prize', e => prizeToast(e.detail));
  onChange(firstQuarterTips);
  showView('town');
}

function initToolbar() {
  document.querySelectorAll('#toolbar button').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
}

export function showView(name) {
  current = name;
  document.querySelectorAll('#toolbar button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  renderCurrent();
  if (name === 'park') { fitCanvas(); applyParkMode(); }
  else { stopLiving(); setGridActive(false); parkMode = 'living'; } // Park always reopens on the living view
}

// The Living Park owns the canvas by default; Buy Land swaps in the survey map over the same canvas.
function applyParkMode() {
  if (current !== 'park') return;
  if (parkMode === 'grid') { stopLiving(); setGridActive(true); }
  else { setGridActive(false); startLiving(); }
}
export function setParkMode(mode) {
  if (parkMode === mode) return;
  parkMode = mode;
  renderParkBar();
  fitCanvas();
  applyParkMode();
}
export const getParkMode = () => parkMode;
// Jump straight to the survey map from anywhere (Real Estate office, tutorial).
export function openBuyLand() {
  parkMode = 'grid';
  showView('park');
}

function renderCurrent() {
  VIEWS[current].render($(`view-${current}`));
}

function renderParkBar() {
  const bar = $('park-bar');
  bar.replaceChildren();
  const rail = $('park-rail');
  if (parkMode === 'living') {
    if (rail) { rail.hidden = false; renderParkRail(rail, { openMarketing: () => showView('marketing') }); }
    const n = (state.prizes || []).length;
    const nx = nextPrize();
    append(bar, [
      button('Buy Land', () => setParkMode('grid'), { class: 'btn primary' }),
      button(`🏆 Park Prizes${n ? ` (${n})` : ''}`, openPrizes, { class: 'btn', title: nx ? `Next: ${nx.prize.name} at ${fmt$(nx.threshold)}` : 'Every spend prize earned' }),
      button(`🎯 Goals ${goalsList().filter(g => g.done).length}/${goalsList().length}`, openGoals, { class: 'btn', title: (goalsList().find(g => !g.done) || { name: 'Every goal reached' }).name }),
      h('span', { class: 'food-status' }, h('span', { class: 'muted small', 'data-tip': 'days_of_food' }, 'Food '), foodDayChips()),
      button('Restock', () => openGeneralStore({ tab: 'food' }), { class: 'btn', title: 'General Store → Food, quantity pre-filled' }),
      h('span', { class: 'muted' }, 'Click a pen to manage it, a building to upgrade it')
    ]);
    return;
  }
  if (rail) rail.hidden = true; // Buy Land survey map uses the full canvas width
  const owned = Object.values(state.parcels).filter(p => p.owned).length;
  append(bar, [
    button('Back to park', () => setParkMode('living'), { title: 'Esc' }),
    h('span', {}, `${owned}/${Object.keys(state.parcels).length} parcels owned`),
    h('span', { class: 'muted' }, 'Click FOR SALE to buy · an owned parcel to fence · an enclosure to manage')
  ]);
}

function initSpeed() {
  document.querySelectorAll('#speed [data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
  $('step').addEventListener('click', () => { if (!modalOpen()) advanceDay(); });
}

function initKeys() {
  window.addEventListener('keydown', e => {
    // Text fields keep Space; range sliders and buttons do not. A focused button would re-fire its click on
    // Space keyup (browser default), so drop focus before toggling.
    if (e.target?.matches?.('input:not([type=range]):not([type=checkbox]), textarea')) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (e.target?.matches?.('button, input')) e.target.blur();
      if (!modalOpen()) setSpeed(state.speed > 0 ? 0 : 1);
    }
    else if (e.key === 'Escape') {
      if (modalOpen()) closeTop();
      else if (current === 'park' && parkMode === 'grid') setParkMode('living');
    }
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

// Ticker footer carries the daily digest button (events that did not pause the clock at high speed).
let digestBtn = null;
function initTicker() {
  digestBtn = button('Digest', openDigest, { class: 'btn digest', title: 'Events that went by without pausing the clock' });
  $('ticker').append(digestBtn);
}

// Re-render status bar, ticker, and the live views that show numbers.
export function refresh() {
  if (!state) return;
  $('cash').textContent = fmt$(state.cash);
  $('cash').classList.toggle('neg', state.cash < 0);
  $('debt').textContent = fmt$(state.debt);
  // Phase 2: the Bank warning state (net debt above the cap). On Relaxed this is all the bank ever does; elsewhere it
  // is the countdown to foreclosure. The Debt cell turns red and its label says so.
  const bank = bankState();
  const debtStat = $('debt').parentElement, debtLabel = debtStat.querySelector('.label');
  debtStat.classList.toggle('bank-warning', bank.warning);
  debtLabel.textContent = bank.warning ? 'Bank warning' : 'Debt';
  debtLabel.dataset.tipText = bank.warning ? `${DATA.tooltips.terms.bank_warning} Net debt ${fmt$(bank.net_debt)} against a ${fmt$(bank.cap)} cap, ${bank.over_cap_quarters} quarter${bank.over_cap_quarters === 1 ? '' : 's'} so far${bank.foreclosure_enabled ? `; ${bank.quarters_left} left before foreclosure` : ' (no foreclosure on ' + bank.mode + ')'}.` : DATA.tooltips.terms.debt;
  // Date and Today stack two short lines so the pixel-font cells stay narrow enough for the speed controls at 1280x720.
  $('date').replaceChildren(h('span', { class: 'line' }, `Day ${dayOfQuarter()} · ${season()}`), h('span', { class: 'line' }, `Year ${year()} · Quarter ${quarterIndex() + 1}`));
  // Phase 2: the run's difficulty rides in the Date tooltip (label and value), as a chip line ahead of the calendar text.
  const dateTip = `Difficulty: ${modeName()} — ${mode().feel || ''} ${DATA.tooltips.terms.quarter}`;
  $('date').dataset.tipText = dateTip;
  const dateLabel = $('date').parentElement.querySelector('.label');
  dateLabel.dataset.tipText = dateTip; delete dateLabel.dataset.tip;
  $('rating').replaceChildren(starsEl(parkRating(), DATA.balance.rating.max, 'stars'), h('span', { class: 'stars-num' }, parkRating().toFixed(1)));
  $('today').replaceChildren(h('span', { class: 'line' }, `${state.today.attendance.toLocaleString('en-US')} visitors`), h('span', { class: 'line' }, fmt$(state.today.tickets + state.today.concessions)));
  document.querySelectorAll('#speed [data-speed]').forEach(b => b.classList.toggle('active', Number(b.dataset.speed) === state.speed));
  $('ticker-text').textContent = state.ticker.slice(-3).map(t => t.msg).join('   •   ') || 'Welcome to your park. Buy land, build a fence, buy a dinosaur, then press play.';
  if (digestBtn) {
    const n = state.digest_unread || 0;
    digestBtn.textContent = n ? `Digest (${n})` : 'Digest';
    digestBtn.classList.toggle('unread', n > 0);
    digestBtn.hidden = !(state.digest && state.digest.length);
  }
  const v = VIEWS[current];
  if (v.live) renderCurrent();
  else v.refresh?.();
}

// ---- bus-driven modals ----
function eventPopup({ event, averted, summary }) {
  // Escapes get the siren from the 'escape' bus event; every other bad-news popup gets the alert.
  if (event.type === 'negative' && !averted && event.effect?.kind !== 'escape') playSfx('alert');
  const m = openModal({ title: averted ? `Close call: ${event.title}` : event.title, className: event.type === 'negative' ? 'event-bad' : 'event-good', body: h('div', {},
    h('p', {}, averted ? `Your ${averted} staff caught the problem before it hit. (${event.title} was about to happen.)` : event.message),
    summary ? h('p', { class: 'muted' }, `Effect: ${summary}.`) : null,
    h('p', { class: 'lesson', 'data-tip-text': event.tooltip }, 'Lesson: ', event.tooltip),
    h('div', { class: 'row end' }, button('OK', () => m.close(), { class: 'btn primary' }))) });
}

// Daily digest: grouped by day, newest day first. Opening it clears the unread count.
export function openDigest() {
  const items = (state.digest || []).slice().reverse();
  const days = [];
  for (const it of items) { let d = days.find(x => x.day === it.day); if (!d) { d = { day: it.day, items: [] }; days.push(d); } d.items.push(it); }
  const m = openModal({ title: 'Event Digest', className: 'wide', body: h('div', {},
    h('p', { class: 'muted' }, `At 3× and 10× only escapes, the Quarterly Report, foreclosure and milestones pause the clock. Everything else lands here (last ${DATA.balance.events.digest_days_kept} days).`),
    days.length ? days.map(d => h('div', { class: 'digest-day' },
      h('h3', {}, `Day ${dayOfQuarter(d.day)} · ${season(d.day)} · Year ${year(d.day)}`),
      d.items.map(it => h('div', { class: `digest-item ${it.type === 'negative' ? 'bad' : it.type === 'prize' ? 'prize' : it.type === 'info' ? 'info' : 'good'}` },
        h('b', {}, it.averted ? `Close call: ${it.title}` : it.title),
        h('span', { class: 'muted' }, it.averted ? ` · ${it.averted} staff headed it off` : it.summary ? ` · ${it.summary}` : ''),
        it.tooltip ? h('div', { class: 'muted small' }, it.tooltip) : null)))) : h('p', { class: 'muted' }, 'Nothing yet.'),
    h('div', { class: 'row end' }, button('Close', () => m.close(), { class: 'btn primary' }))) });
  state.digest_unread = 0;
  emitChange();
}

function winPopup({ title, text }) {
  const next = goalsList().find(g => !g.done);
  const m = openModal({ title: `🎉 ${title}`, className: 'event-good slide-in', body: h('div', {},
    h('p', {}, text),
    h('p', { class: 'muted' }, 'The game keeps going. ', next ? `Next on the ladder: ${next.name} (${next.detail}).` : 'Every goal on the ladder is done.', ' The ', term('goal', 'Goals'), ' panel on the Park bar shows the whole ladder.'),
    h('div', { class: 'row end' }, button('Open Goals', () => { m.close(); openGoals(); }), button('Keep playing', () => m.close(), { class: 'btn primary' }))) });
}
// The Grand Park: the top of the ladder, once. A plaque goes up at the gate in the living view.
function grandParkPopup({ title, text }) {
  const m = openModal({ title: `🏛️ ${title}`, className: 'grand slide-in', body: h('div', {},
    h('p', { class: 'lead' }, text),
    h('p', { class: 'muted' }, 'Visitors will see the Grand Park plaque by the front gate. The game keeps going: the ', term('report_card', 'Year-5 Report Card'), ' still grades the whole run, and the endless sandbox is yours.'),
    h('div', { class: 'row end' }, button('See the park', () => { m.close(); showView('park'); }), button('Keep playing', () => m.close(), { class: 'btn primary' }))) });
}
// The report card is issued while the year-end Quarterly Report is already open: let the player read that first.
function reportCardPopup(card) {
  const show = () => openReportCard(card);
  const top = topModal();
  if (!top) return show();
  const prev = top.onClose;
  top.onClose = () => { prev?.(); show(); };
}

// The final Quarterly Report is already open when foreclosure fires; let the player read it, then show this.
function losePopup({ cause }) {
  const show = () => openModal({ title: 'Foreclosure', className: 'event-bad', closable: false, body: h('div', {},
    h('p', {}, 'The bank took the park. What you owed, less the cash you held, stayed above your ', term('debt_cap', 'debt cap'), ` for ${cause.quarters} quarter${cause.quarters > 1 ? 's' : ''}.`),
    h('p', {}, `Main cause: ${cause.category} cost ${fmt$(cause.amount)} while revenue was only ${fmt$(cause.revenue)} over that period.`),
    h('p', { class: 'muted' }, 'Tip: check the Reports view every quarter. Big costs (salaries, dinosaur purchases) should be covered by ticket income before you add more.'),
    h('div', { class: 'row end' }, button('Restart', () => openNewGame({ onStart: startNewGame, cancelable: false, title: 'New Game', intro: `The ${modeName()} park is gone. Pick a difficulty for the next one.` }), { class: 'btn primary' }))) });
  closeBelowTop(); // a batch advance can leave a pile of stale event popups; they must not bury the lose screen
  const top = topModal();
  if (!top) return show();
  const prev = top.onClose;
  top.onClose = () => { prev?.(); show(); };
}

export function tutorialHint() {
  // Six short cards in two columns (M5 fixer): one line each, the detail lives in the hover terms and the first-quarter tips.
  const tut = (title, ...text) => h('div', { class: 'tut' }, h('b', {}, title), h('span', {}, ...text));
  const m = openModal({ title: 'Welcome, park owner', className: 'wide', body: h('div', {},
    h('p', {}, `You start with a ${fmt$(mode().start_loan ?? state.debt)} `, term('loan', 'loan'), ` from the bank (${modeName()} difficulty). Six things turn it into a park:`),
    h('div', { class: 'tutorial-grid' },
      tut('1. Buy land, pick its biome', 'Park → Buy Land. Desert, Plains or Marsh: the ', term('biome', 'biome'), ' sets price, growth and which species feel at home.'),
      tut('2. Fence it', `Click your parcel. ${fenceByTier(1).name} is cheapest; big species need stronger tiers.`),
      tut('3. Buy a dinosaur, feed it', 'Town → Dino Market. Food is in the General Store; ', term('auto_restock', 'auto-restock'), ' buys more when stock runs low.'),
      tut('4. Plant seeds', 'Seeds are paid once and grow ', term('vegetation', 'greenery'), ' herbivores graze first. Bought plants are a weekly bill.'),
      tut('5. Climb the marketing ladder', 'Cheap flyers first, bigger ', term('campaign', 'campaigns'), ' as the park grows, then ', term('membership', 'memberships'), '.'),
      tut('6. Watch the Goals', 'Park bar → 🎯 Goals: loan, net worth, ten species, five stars, the ', term('grand_park', 'Grand Park'), ', the Year-5 ', term('report_card', 'Report Card'), '.')),
    h('p', { class: 'muted' }, `▶ runs the days; a report opens every ${T().days_per_quarter} days. Space pauses, Esc closes. Hover underlined terms for a plain explanation; short tips follow in your first quarter.`),
    h('div', { class: 'row end' }, button('Skip the tips', () => { markTipsSeen(); m.close(); }), button('Got it', () => m.close(), { class: 'btn primary' }))) });
}

// ---- first-quarter tips (data/tooltips.json first_quarter_tips): one toast each, on its day, shown once per browser ----
const TIPS_KEY = 'fossil-fortune.tips_seen';
function tipsSeen() { try { return JSON.parse(localStorage.getItem(TIPS_KEY) || '[]') || []; } catch { return []; } }
function markTipSeen(day) { try { const seen = tipsSeen(); if (!seen.includes(day)) seen.push(day); localStorage.setItem(TIPS_KEY, JSON.stringify(seen)); } catch { /* storage blocked */ } }
export function markTipsSeen() { try { localStorage.setItem(TIPS_KEY, JSON.stringify((DATA.tooltips.first_quarter_tips || []).map(t => t.day))); } catch { /* storage blocked */ } }
export function resetTips() { try { localStorage.removeItem(TIPS_KEY); } catch { /* storage blocked */ } }
// Tips show one at a time: a batch advance (or 10x) that passes several tip days queues them, and the next one
// appears once the current tip has been dismissed or has timed out, instead of three stacking over the scene.
const tipQueue = [];
let tipShowing = null, tipShowingDef = null, tipTimer = 0, tipWatch = 0;
function pumpTips() {
  tipTimer = 0;
  // M5 minor (Phase 2): a tip never stacks over an open panel or modal (Goals, a store, the Quarterly Report): it waits.
  if (modalOpen() || (tipShowing && tipShowing.isConnected)) { tipTimer = setTimeout(pumpTips, 800); return; }
  const t = tipQueue.shift();
  if (!t) { tipShowing = null; tipShowingDef = null; return; }
  tipShowingDef = t;
  tipShowing = toast({ icon: '💡', title: t.title, text: t.text, cls: 'tip-toast', seconds: DATA.balance.juice?.tip_toast_seconds ?? 9 });
  // A panel that opens while the tip is up takes it down; the tip goes back to the front of the queue for later.
  if (!tipWatch) tipWatch = setInterval(() => {
    if (!(tipShowing && tipShowing.isConnected)) { if (!tipQueue.length) { clearInterval(tipWatch); tipWatch = 0; } return; }
    if (modalOpen()) { tipShowing.remove(); if (tipShowingDef) tipQueue.unshift(tipShowingDef); tipShowing = null; tipShowingDef = null; if (!tipTimer) tipTimer = setTimeout(pumpTips, 800); }
  }, 250);
  if (tipQueue.length && !tipTimer) tipTimer = setTimeout(pumpTips, 800);
}
function firstQuarterTips() {
  if (!state || state.day > T().days_per_quarter) return;
  const tips = DATA.tooltips.first_quarter_tips || [];
  const seen = tipsSeen();
  for (const t of tips) {
    if (seen.includes(t.day) || state.day < t.day) continue;
    markTipSeen(t.day);
    tipQueue.push(t);
  }
  if (tipQueue.length && !tipTimer) pumpTips();
}
