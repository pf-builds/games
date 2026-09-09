// Tiny DOM builder. h(tag, attrs, ...children). attrs.on = { click: fn }.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'title' || k === 'type' || k === 'min' || k === 'max' || k === 'step' || k === 'value' || k === 'disabled') {
      if (v === false || v == null) continue;
      el.setAttribute(k, v === true ? '' : v);
    } else el[k] = v;
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { el.replaceChildren(); return el; }

// Term with an educational tooltip attached (see ui/tooltips.js).
export const term = (key, label) => h('span', { class: 'term', 'data-tip': key }, label ?? key);

// Star rating: filled stars lit, the rest dimmed, so "1.0" never sits next to five bright stars.
export function starsEl(rating, max, cls = 'stars') {
  const full = Math.round(rating);
  const el = h('span', { class: cls, title: `${rating.toFixed(1)} of ${max}` }, Array.from({ length: max }, (_, i) => h('span', { class: i < full ? 'star on' : 'star off' }, '★')));
  return el;
}

export function button(label, onClick, attrs = {}) {
  return h('button', { class: 'btn', on: { click: onClick }, ...attrs }, label);
}

export function tabs(defs, initial = 0) {
  const bar = h('div', { class: 'tabs' });
  const body = h('div', { class: 'tab-body' });
  const wrap = h('div', { class: 'tabbed' }, bar, body);
  const buttons = defs.map((d, i) => h('button', { class: 'tab', on: { click: () => show(i) } }, d.label));
  bar.append(...buttons);
  function show(i) {
    buttons.forEach((b, j) => b.classList.toggle('active', i === j));
    clear(body).append(defs[i].render());
  }
  show(initial);
  wrap.show = show;
  return wrap;
}
