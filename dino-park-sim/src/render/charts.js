// Canvas line charts for reports. chart({ title, labels, series: [{ label, color, values }], money })
// returns a <canvas> that sizes itself to its CSS box and draws at device-pixel resolution (crisp on HiDPI).
import { h } from '../ui/dom.js';

const COLORS = { bg: '#1b1f2a', text: '#f1f0e6', muted: '#a7acbd', grid: '#4a5270' };

export function chart(spec) {
  const c = h('canvas', { class: 'chart' });
  const draw = () => {
    const w = c.clientWidth, hgt = c.clientHeight;
    if (!w || !hgt) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(hgt * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLineChart(ctx, w, hgt, spec);
  };
  // ResizeObserver only delivers during a rendering frame; a background or hidden tab gets none, so the first draw
  // also runs from a timer once the canvas has a layout box. Repeat draws are idempotent.
  new ResizeObserver(draw).observe(c);
  let tries = 0;
  const kick = () => { if (c.clientWidth || tries++ > 20) draw(); else setTimeout(kick, 50); };
  setTimeout(kick, 0);
  return c;
}

export function drawLineChart(ctx, W, H, { title, labels, series, money = true }) {
  const font = getComputedStyle(document.body).fontFamily;
  const pad = { l: 52, r: 12, t: 30, b: 24 };
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.font = `bold 12px ${font}`;
  ctx.fillStyle = COLORS.text;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, 8, 16);

  const all = series.flatMap(s => s.values);
  const step = niceStep(Math.min(0, ...all), Math.max(1, ...all));
  const peak = Math.max(1, ...all);
  // One step of headroom when the series tops out exactly on a gridline: a flat line drawn along the top rule reads
  // as an empty panel.
  let max = Math.ceil(peak / step) * step;
  if (max - peak < step * 0.15) max += step;
  const min = Math.floor(Math.min(0, ...all) / step) * step;
  const n = Math.max(labels.length, 2);
  const x = i => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = v => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

  ctx.font = `11px ${font}`;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let v = min; v <= max + step / 2; v += step) {
    const yy = Math.round(y(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'right';
    ctx.fillText(short(v, money), pad.l - 6, yy + 4);
  }
  ctx.textAlign = 'center';
  labels.forEach((lab, i) => { ctx.fillStyle = COLORS.muted; ctx.fillText(lab, x(i), H - 8); });
  ctx.textAlign = 'left';

  for (const s of series) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
    s.values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.stroke();
    ctx.fillStyle = s.color;
    s.values.forEach((v, i) => { ctx.beginPath(); ctx.arc(x(i), y(v), 3, 0, Math.PI * 2); ctx.fill(); });
  }
  // legend, right-aligned on the title row
  let lx = W - pad.r;
  for (const s of [...series].reverse()) {
    const tw = ctx.measureText(s.label).width;
    lx -= tw;
    ctx.fillStyle = COLORS.text; ctx.fillText(s.label, lx, 16);
    lx -= 14;
    ctx.fillStyle = s.color; ctx.fillRect(lx, 7, 10, 10);
    lx -= 12;
  }
}

// Axis step rounded to 1 / 2 / 2.5 / 5 x a power of ten, aiming for about four gridlines.
function niceStep(min, max) {
  const raw = (max - min) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const f = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return f * mag;
}

function short(v, money) {
  const a = Math.abs(v);
  const s = a >= 1000 ? `${Number((a / 1000).toFixed(a >= 10000 ? 0 : 1))}k` : `${Math.round(a)}`;
  return `${v < 0 ? '-' : ''}${money ? '$' : ''}${s}`;
}
