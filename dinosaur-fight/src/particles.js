// Dinosaur Fight! — chunky pixel particles. Fixed pool, no allocation in loop.
window.DF = window.DF || {};

DF.Particles = (function () {
  const MAX = 400;
  const pool = new Array(MAX);
  for (let i = 0; i < MAX; i++) pool[i] = { on: false };
  let cursor = 0;

  function spawn(o) {
    const p = pool[cursor];
    cursor = (cursor + 1) % MAX;
    p.on = true;
    p.x = o.x; p.y = o.y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.g = o.g == null ? 300 : o.g;
    p.life = p.life0 = o.life || 0.6;
    p.size = o.size || 2;
    p.col = o.col || "#FFFFFF";
    p.star = !!o.star;
    p.ring = !!o.ring;
    p.vr = o.vr || 0;
    p.spin = o.spin || 0;
    p.a = 0;
  }

  const api = {
    clear() { for (const p of pool) p.on = false; },

    // comic star-poof (baddie defeat)
    poof(x, y, col = "#FFE066", n = 10) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const s = 60 + Math.random() * 90;
        spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 160, life: 0.55 + Math.random() * 0.3, size: 2, col, star: i % 2 === 0, spin: 6 });
      }
      spawn({ x, y, ring: true, size: 3, vr: 90, g: 0, life: 0.28, col });
    },
    ring(x, y, col = "#C9B08A", vr = 110) {
      spawn({ x, y, ring: true, size: 4, vr, g: 0, life: 0.32, col });
    },
    dust(x, y, dir = 0, n = 4) {
      for (let i = 0; i < n; i++)
        spawn({ x: x + (Math.random() - 0.5) * 6, y, vx: dir * (20 + Math.random() * 30) + (Math.random() - 0.5) * 20, vy: -(20 + Math.random() * 40), g: 220, life: 0.35 + Math.random() * 0.2, size: 2, col: i % 3 ? "#8A6E4A" : "#6E5638" });
    },
    sparkle(x, y, col = "#FFF2B8", n = 6) {
      for (let i = 0; i < n; i++)
        spawn({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40, g: 60, life: 0.5, size: 1, col, star: true, spin: 4 });
    },
    splash(x, y, n = 10) {
      for (let i = 0; i < n; i++)
        spawn({ x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 90, vy: -(80 + Math.random() * 120), g: 420, life: 0.6, size: 2, col: i % 3 ? "#57A8E0" : "#CFEAFB" });
    },
    ding(x, y) {
      for (let i = 0; i < 5; i++)
        spawn({ x, y, vx: (Math.random() - 0.5) * 120, vy: -(30 + Math.random() * 60), g: 300, life: 0.3, size: 1, col: "#FFF2B8" });
    },
    crate(x, y) {
      for (let i = 0; i < 12; i++)
        spawn({ x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 160, vy: -(60 + Math.random() * 140), g: 460, life: 0.7, size: 2 + (Math.random() * 2 | 0), col: i % 3 ? "#B98A4A" : "#7E5A2C", spin: 8 });
    },
    confetti(x, y, n = 26) {
      const cols = ["#FFE066", "#57BE59", "#57A8E0", "#E8484F", "#C9A6FF"];
      for (let i = 0; i < n; i++)
        spawn({ x: x + (Math.random() - 0.5) * 60, y, vx: (Math.random() - 0.5) * 140, vy: -(100 + Math.random() * 160), g: 260, life: 1.2 + Math.random() * 0.5, size: 2, col: cols[i % cols.length], spin: 10 });
    },
    grow(x, y, big) {
      const col = big ? "#C9A6FF" : "#7BE5F2";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const d = big ? 4 : 18;
        spawn({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * (big ? 90 : -70), vy: Math.sin(a) * (big ? 90 : -70), g: 0, life: 0.35, size: 2, col });
      }
    },

    update(dt) {
      for (const p of pool) {
        if (!p.on) continue;
        p.life -= dt;
        if (p.life <= 0) { p.on = false; continue; }
        p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.a += p.spin * dt;
      }
    },

    draw(ctx, camX) {
      for (const p of pool) {
        if (!p.on) continue;
        const t = p.life / p.life0;
        ctx.globalAlpha = t < 0.35 ? t / 0.35 : 1;
        ctx.fillStyle = p.col;
        const x = Math.round(p.x - camX), y = Math.round(p.y);
        if (p.ring) {
          const r = p.size + p.vr * (p.life0 - p.life);
          ctx.strokeStyle = p.col; ctx.lineWidth = 2;
          ctx.globalAlpha = t * 0.8;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        } else if (p.star) {
          const s = p.size;
          ctx.fillRect(x - s, y, s * 2 + 1, 1);
          ctx.fillRect(x, y - s, 1, s * 2 + 1);
        } else {
          const s = Math.max(1, Math.round(p.size * (0.5 + t * 0.5)));
          ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
  return api;
})();
