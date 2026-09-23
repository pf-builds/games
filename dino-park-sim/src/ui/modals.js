// Modal stack over #modal-root. Any open modal pauses the clock (turn-based feel).
import { h, clear } from './dom.js';
import { hideTip } from './tooltips.js';

const root = () => document.getElementById('modal-root');
const stack = [];

// foot: optional node pinned under the scrolling body (buttons stay visible on long reports).
export function openModal({ title, body, foot = null, className = '', onClose = null, closable = true }) {
  const bodyEl = h('div', { class: 'modal-body' });
  if (body) bodyEl.append(body);
  const box = h('div', { class: `modal ${className}` },
    h('div', { class: 'modal-head' },
      h('h2', {}, title),
      closable ? h('button', { class: 'modal-close', title: 'Close (Esc)', on: { click: () => close() } }, '✕') : null),
    bodyEl,
    foot ? h('div', { class: 'modal-foot' }, foot) : null);
  const overlay = h('div', { class: 'modal-overlay' }, box);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay && entry.closable) close(); });
  const entry = { overlay, box, bodyEl, closable, onClose, closed: false };
  function close() {
    if (entry.closed) return;
    entry.closed = true;
    overlay.remove();
    stack.splice(stack.indexOf(entry), 1);
    hideTip();
    entry.onClose?.(); // read from the entry so callers can swap the handler later (e.g. auction finish)
  }
  entry.close = close;
  entry.setBody = node => { clear(bodyEl).append(node); };
  root().append(overlay);
  stack.push(entry);
  return entry;
}

export function closeTop() {
  const top = stack[stack.length - 1];
  if (top && top.closable) top.close();
}
export function closeAll() { for (const m of [...stack]) { m.closable = true; m.close(); } }
// Close everything UNDER the top modal. Used when the game ends: a batch advance can leave a stack of quarterly
// reports and event popups queued up, and the player should not have to dismiss all of them to reach the lose screen.
export function closeBelowTop() {
  const top = stack[stack.length - 1];
  for (const m of [...stack]) if (m !== top && m.closable) m.close();
}
export const modalOpen = () => stack.length > 0;
// DPS.selfTest: close only the modals opened since the stack was `n` deep (a close can chain another, so bounded).
export const modalDepth = () => stack.length;
export function closeAbove(n) { for (let guard = 0; stack.length > n && guard < 200; guard++) { const m = stack[stack.length - 1]; m.closable = true; m.close(); } }
export const topModal = () => stack[stack.length - 1] || null;

// Simple message box with OK.
export function alertModal(title, message, onOk) {
  const m = openModal({ title, body: h('div', {}, h('p', {}, message), h('div', { class: 'row end' }, h('button', { class: 'btn primary', on: { click: () => m.close() } }, 'OK'))), onClose: onOk });
  return m;
}

// Confirm with what-if text; resolves true/false.
export function confirmModal(title, node, okLabel = 'Confirm') {
  return new Promise(resolve => {
    let ok = false;
    const m = openModal({
      title,
      body: h('div', {}, node, h('div', { class: 'row end' },
        h('button', { class: 'btn', on: { click: () => m.close() } }, 'Cancel'),
        h('button', { class: 'btn primary', on: { click: () => { ok = true; m.close(); } } }, okLabel))),
      onClose: () => resolve(ok)
    });
  });
}
