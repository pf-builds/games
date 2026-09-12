// Human-readable facility effect text, shared by the store cards, the living-view tooltip and the survey map.
// Effect keys are data (facilities.json `effects`); this is the one place that knows how to word each of them.
import { DATA, state, bus, onChange, fmt$, facilityById, facilityEffects, pct } from '../state.js';
import { parkRating } from '../attendance.js';
import { h } from './dom.js';

const WORDING = {
  parking_capacity: v => `+${v} visitors/day`,
  gate_capacity: v => `+${v} gate throughput/day`,
  concession_spend: v => `spend ×${v} per visitor`,
  satisfaction: v => `satisfaction +${pct(v)}`,
  appeal_bonus: v => `appeal +${pct(v)}`,
  education: v => (v >= 2 ? 'Fact Book: field notes + your specimens' : v >= 1 ? 'Fact Book: field notes' : ''),
  illness_reduction: v => `avert illness ${pct(v)}`,
  heal_bonus: v => `+${v} health/day`,
  management_capacity: v => `runs ${v} staff`,
  event_mitigation: v => `heads off events ${pct(v)}`
};

export function effectWord(key, v) { const f = WORDING[key]; return f ? f(v) : `${key} ${v}`; }

// Every non-zero effect at a tier, headline first. `tierDef` may be a tier object or a tier number.
export function effectList(facilityId, tierDef) {
  const f = facilityById(facilityId);
  const tier = typeof tierDef === 'number' ? tierDef : tierDef.tier;
  const eff = facilityEffects(facilityId, tier);
  const keys = [f.effect_key, ...Object.keys(eff).filter(k => k !== f.effect_key)];
  return keys.filter(k => eff[k] != null && eff[k] !== 0).map(k => effectWord(k, eff[k])).filter(Boolean);
}
export function effectText(f, tierDef) {
  const list = effectList(f.id, tierDef);
  return list.length ? list.join(' · ') : 'base facility';
}
// What changes between two tiers: "+150 visitors/day (150 → 300)".
export function effectDelta(facilityId, fromTier, toTier) {
  const a = facilityEffects(facilityId, fromTier), b = facilityEffects(facilityId, toTier);
  const out = [];
  for (const k of Object.keys(b)) {
    const from = a[k] ?? 0, to = b[k];
    if (to === from) continue;
    if (k === 'education') { out.push(effectWord(k, to)); continue; }
    const fmt = v => (k === 'satisfaction' || k === 'appeal_bonus' || k === 'illness_reduction' || k === 'event_mitigation' ? pct(v) : k === 'concession_spend' ? `×${v}` : String(v));
    out.push(`${effectWord(k, to)} (${fmt(from)} → ${fmt(to)})`);
  }
  return out;
}

// ============================================================================================================
// M5 juice. Button press feedback, cash-delta floaters by the Capital stat, the star pulse, escape shake + red
// vignette, generic stacking toasts, count-up numbers and the reduce-motion switch. Everything here is cosmetic:
// nothing touches game state, and every animation collapses to an instant/static change when motion is reduced
// (the OS `prefers-reduced-motion` query, or the Settings toggle in state.settings.reduce_motion).
// ============================================================================================================
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reduceMotion = () => !!((state && state.settings && state.settings.reduce_motion) || (mq && mq.matches));
function applyMotionClass() { document.documentElement.classList.toggle('reduce-motion', reduceMotion()); }

// Re-triggerable CSS animation: drop the class, force a reflow, add it back.
export function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ---- cash floaters ----
let cashRoot = null, lastCash = null, lastStateRef = null, pendingDelta = 0, flushTimer = 0, lastFloatAt = -Infinity;
const juice = { floaters: 0, shakes: 0, pulses: 0, toasts: 0, presses: 0 };
export const juiceStats = () => ({ ...juice, reduce_motion: reduceMotion() });
// Floaters live in a lane reserved inside the Capital cell (style.css .stat-cash / #cash-floaters) and rise a short
// way within it, so they never drift over the Debt stat or off the top of the status bar. Consecutive floaters
// cycle three vertical lanes so a 10x stream does not pile on one spot.
const LANES = [0, -9, 9];
function floater(delta) {
  if (!cashRoot) return;
  const el = h('span', { class: `floater ${delta >= 0 ? 'up' : 'down'}`, style: `--lane:${LANES[juice.floaters % LANES.length]}` }, `${delta >= 0 ? '+' : '−'}${fmt$(Math.abs(delta))}`);
  cashRoot.append(el);
  juice.floaters++;
  while (cashRoot.children.length > 3) cashRoot.firstChild.remove();
  setTimeout(() => el.remove(), 1500);
}
function flushCash() {
  flushTimer = 0;
  if (pendingDelta === 0) return;
  const now = performance.now();
  // Deltas that land within a tick share one floater; at 10x the clock ticks every 0.6 s, so at most ~3 a second.
  if (now - lastFloatAt < (DATA.balance.juice?.floater_min_gap_ms ?? 250)) { flushTimer = setTimeout(flushCash, 120); return; }
  lastFloatAt = now;
  floater(Math.round(pendingDelta));
  pendingDelta = 0;
}
function watchCash() {
  if (!state) return;
  if (state !== lastStateRef) { lastStateRef = state; lastCash = state.cash; pendingDelta = 0; clearToasts(); return; } // new game / load: no floater, no stale toasts
  if (lastCash == null) { lastCash = state.cash; return; }
  const d = state.cash - lastCash;
  lastCash = state.cash;
  if (Math.abs(d) < 0.5 || reduceMotion()) return;
  pendingDelta += d;
  if (!flushTimer) flushTimer = setTimeout(flushCash, 0);
}

// ---- star pulse ----
let lastStars = null;
function watchRating() {
  if (!state) return;
  const r = Math.round(parkRating() * 10) / 10;
  if (lastStars === null) { lastStars = r; return; }
  if (r === lastStars) return;
  lastStars = r;
  if (reduceMotion()) return;
  const el = document.getElementById('rating');
  if (el) { replay(el, 'pulse'); juice.pulses++; }
}

// ---- screen shake + vignette ----
let vignette = null;
export function shake(ms = DATA.balance.juice?.shake_ms ?? 300) {
  juice.shakes++;
  if (reduceMotion()) return false;
  const app = document.getElementById('app');
  if (!app) return false;
  app.style.setProperty('--shake-ms', `${ms}ms`);
  replay(app, 'shake');
  if (!vignette) { vignette = h('div', { id: 'vignette' }); document.body.append(vignette); }
  replay(vignette, 'flash');
  return true;
}

// ---- toasts (stack, slide in, auto-dismiss) ----
let toastRoot = null;
// New Game / Restart / Load: a goal or tip toast from the previous park must not outlive it.
export function clearToasts() { if (toastRoot) toastRoot.replaceChildren(); }
export const toastCount = () => (toastRoot ? toastRoot.children.length : 0);
export function toast({ icon = '', title = '', text = '', cls = '', seconds = DATA.balance.prizes?.toast_seconds ?? 6, actions = null } = {}) {
  if (!toastRoot) { toastRoot = h('div', { id: 'toast-root' }); document.body.append(toastRoot); }
  const el = h('div', { class: `toast ${cls}` },
    icon ? h('div', { class: 'toast-icon' }, icon) : null,
    h('div', { class: 'toast-main' }, h('div', { class: 'toast-title' }, title), text ? h('div', { class: 'toast-text' }, text) : null, actions),
    h('button', { class: 'toast-close', title: 'Dismiss', on: { click: () => dismiss() } }, '✕'));
  const dismiss = () => { if (!el.isConnected) return; if (reduceMotion()) return el.remove(); el.classList.add('fade'); setTimeout(() => el.remove(), 400); };
  el.dismiss = dismiss;
  toastRoot.append(el);
  juice.toasts++;
  while (toastRoot.children.length > 3) toastRoot.firstChild.remove();
  if (seconds > 0) setTimeout(dismiss, seconds * 1000);
  return el;
}

// ---- count-up numbers ----
// Every element with data-count (a number) inside `root` counts from 0 to its value; `fmt` formats the text.
export function countUp(root, fmt = fmt$, ms = DATA.balance.juice?.count_up_ms ?? 900) {
  const els = [...root.querySelectorAll('[data-count]')];
  if (!els.length) return;
  const finals = els.map(el => Number(el.dataset.count) || 0);
  const done = () => els.forEach((el, i) => { el.textContent = fmt(finals[i]); });
  if (reduceMotion()) return done();
  const t0 = performance.now();
  const frame = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    els.forEach((el, i) => { el.textContent = fmt(finals[i] * e); });
    if (k < 1) requestAnimationFrame(frame); else done();
  };
  requestAnimationFrame(frame);
}

export function initJuice() {
  applyMotionClass();
  if (mq) mq.addEventListener?.('change', applyMotionClass);
  cashRoot = h('span', { id: 'cash-floaters' });
  const cash = document.getElementById('cash');
  if (cash && cash.parentElement) cash.parentElement.append(cashRoot);
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b || b.disabled) return;
    juice.presses++;
    if (!reduceMotion()) replay(b, 'press');
  });
  onChange(() => { applyMotionClass(); watchCash(); watchRating(); });
  bus.addEventListener('escape', () => shake());
  bus.addEventListener('goal', e => toast({ icon: e.detail.grand ? '🏛️' : '🎯', title: e.detail.title, text: e.detail.text, cls: 'goal-toast' }));
}
