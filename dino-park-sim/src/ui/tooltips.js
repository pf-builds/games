// Hover tooltips. Any element with data-tip="term" shows data/tooltips.json text.
// data-tip-text="..." shows custom text instead. showTip/hideTip are used by the canvas.
import { DATA } from '../state.js';

let tip = null;

function ensure() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.hidden = true;
  document.body.append(tip);
  return tip;
}

export function showTip(text, x, y) {
  const el = ensure();
  el.textContent = text;
  el.hidden = false;
  const pad = 14;
  const w = el.offsetWidth, hgt = el.offsetHeight;
  let left = x + pad, top = y + pad;
  if (left + w > window.innerWidth - 8) left = x - w - pad;
  if (top + hgt > window.innerHeight - 8) top = y - hgt - pad;
  el.style.left = `${Math.max(4, left)}px`;
  el.style.top = `${Math.max(4, top)}px`;
}

export function hideTip() { if (tip) tip.hidden = true; }

export function tipText(key) { return DATA.tooltips.terms[key]; }

export function initTooltips() {
  ensure();
  document.addEventListener('mouseover', e => {
    const el = e.target.closest?.('[data-tip], [data-tip-text]');
    if (!el) return;
    const text = el.dataset.tipText || tipText(el.dataset.tip);
    if (text) showTip(text, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', e => {
    if (!tip || tip.hidden) return;
    if (!e.target.closest?.('[data-tip], [data-tip-text], #park')) hideTip();
    else if (!e.target.closest('#park')) showTip(tip.textContent, e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest?.('[data-tip], [data-tip-text]')) hideTip();
  });
}
