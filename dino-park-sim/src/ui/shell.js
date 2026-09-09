// App shell: status bar, toolbar/view switching, speed controls, ticker, keyboard, and bus-driven modals.
import { DATA, state, bus, onChange, fmt$, season, year, dayOfQuarter, quarterIndex, T, fenceByTier, emitChange } from '../state.js';
import { parkRating } from '../attendance.js';
import { setSpeed, advanceDay, setBlockedCheck } from '../time.js';
import { h, append, button, term, starsEl, clear } from './dom.js';
import { openModal, closeTop, modalOpen, closeAll, closeBelowTop, topModal } from './modals.js';
import { initPark, setGridActive } from '../render/park.js';
import { initViewport, fitCanvas } from '../render/viewport.js';
import { initLiving, startLiving, stopLiving } from '../render/living.js';
import { initAgents } from '../sim/agents.js';
import { onParcelClick, facilityPanel } from './enclosure.js';
import { renderTown, refreshTown } from './town.js';
import { renderReports, openQuarterlyReport } from './reports.js';
import { renderMarketing, refreshMarketing } from './marketing.js';
import { renderFactbook } from './factbook.js';
import { renderSettings } from './settings.js';

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
  settings: { render: root => renderSettings(root, { startNewGame, showTutorial: tutorialHint }), live: false }
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
  bus.addEventListener('quarter', e => openQuarterlyReport(e.detail));
  bus.addEventListener('event', e => eventPopup(e.detail));
  bus.addEventListener('win', e => winPopup(e.detail));
  bus.addEventListener('lose', e => losePopup(e.detail));
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
  if (parkMode === 'living') {
    append(bar, [
      button('Buy Land', () => setParkMode('grid'), { class: 'btn primary' }),
      h('span', { class: 'muted' }, 'Click a pen to manage it, a building to upgrade it · Buy Land opens the survey map')
    ]);
    return;
  }
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
  // Date and Today stack two short lines so the pixel-font cells stay narrow enough for the speed controls at 1280x720.
  $('date').replaceChildren(h('span', { class: 'line' }, `Day ${dayOfQuarter()} · ${season()}`), h('span', { class: 'line' }, `Year ${year()} · Quarter ${quarterIndex() + 1}`));
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
      d.items.map(it => h('div', { class: `digest-item ${it.type === 'negative' ? 'bad' : 'good'}` },
        h('b', {}, it.averted ? `Close call: ${it.title}` : it.title),
        h('span', { class: 'muted' }, it.averted ? ` · ${it.averted} staff headed it off` : it.summary ? ` · ${it.summary}` : ''),
        it.tooltip ? h('div', { class: 'muted small' }, it.tooltip) : null)))) : h('p', { class: 'muted' }, 'Nothing yet.'),
    h('div', { class: 'row end' }, button('Close', () => m.close(), { class: 'btn primary' }))) });
  state.digest_unread = 0;
  emitChange();
}

function winPopup({ title, text }) {
  const m = openModal({ title: `🎉 ${title}`, className: 'event-good', body: h('div', {},
    h('p', {}, text),
    h('p', { class: 'muted' }, 'The game keeps going. There is always a next goal: ', term('net_worth', 'net worth'), ', more species, five stars.'),
    h('div', { class: 'row end' }, button('Keep playing', () => m.close(), { class: 'btn primary' }))) });
}

// The final Quarterly Report is already open when foreclosure fires; let the player read it, then show this.
function losePopup({ cause }) {
  const show = () => openModal({ title: 'Foreclosure', className: 'event-bad', closable: false, body: h('div', {},
    h('p', {}, 'The bank took the park. What you owed, less the cash you held, stayed above your ', term('debt_cap', 'debt cap'), ` for ${cause.quarters} quarter${cause.quarters > 1 ? 's' : ''}.`),
    h('p', {}, `Main cause: ${cause.category} cost ${fmt$(cause.amount)} while revenue was only ${fmt$(cause.revenue)} over that period.`),
    h('p', { class: 'muted' }, 'Tip: check the Reports view every quarter. Big costs (salaries, dinosaur purchases) should be covered by ticket income before you add more.'),
    h('div', { class: 'row end' }, button('Restart', () => { closeAll(); startNewGame(); }, { class: 'btn primary' }))) });
  closeBelowTop(); // a batch advance can leave a pile of stale event popups; they must not bury the lose screen
  const top = topModal();
  if (!top) return show();
  const prev = top.onClose;
  top.onClose = () => { prev?.(); show(); };
}

export function tutorialHint() {
  const m = openModal({ title: 'Welcome, park owner', body: h('div', {},
    h('p', {}, `You start with a ${fmt$(state.cash)} `, term('loan', 'loan'), ' from the bank. Turn it into a working park:'),
    h('ol', {},
      h('li', {}, 'Park → Buy Land: click a FOR SALE parcel to buy it. Bigger parcels hold more dinosaurs; the biome sets the price.'),
      h('li', {}, 'Click your new parcel to build a fence around it (', fenceByTier(1).name, ' is cheapest).'),
      h('li', {}, 'Town → Dino Market: buy a dinosaur that fits the fence. Buy food from the General Store.'),
      h('li', {}, 'Press ▶ to let days run. Every 90 days a report shows what you earned and spent. Upgrade parking, restrooms and shops in the General Store as the crowds grow.')),
    h('p', { class: 'muted' }, `Space pauses. Esc closes windows. Hover any underlined term for a plain explanation. Quarters are ${T().days_per_quarter} days.`),
    h('div', { class: 'row end' }, button('Got it', () => m.close(), { class: 'btn primary' }))) });
  void clear;
}
