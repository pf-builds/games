// Peasant Swarm — pooled particles + floaters (pattern from Vector Keep, pixel-chunk flavored).
(function () {
  const PS = (window.PS = window.PS || {});

  function Pool(cap) {
    this.cap = cap; this.items = new Array(cap); this.free = new Array(cap);
    for (let i = 0; i < cap; i++) { this.items[i] = { active: false, idx: i }; this.free[i] = i; }
    this.freeTop = cap; this.cursor = 0;
  }
  Pool.prototype.spawn = function () {
    if (this.freeTop > 0) { const p = this.items[this.free[--this.freeTop]]; p.active = true; return p; }
    const p = this.items[this.cursor]; this.cursor = (this.cursor + 1) % this.cap; p.active = true; return p;
  };
  Pool.prototype.release = function (p) {
    if (!p.active) return; p.active = false;
    if (this.freeTop < this.cap) this.free[this.freeTop++] = p.idx;
  };

  PS.Particles = function (cap) {
    const pool = new Pool(cap);
    return {
      // square pixel chunks that arc and drop (blood-free: tunic scraps, dust, sparkles)
      burst(x, y, color, n, speed, life, size, gravity) {
        for (let i = 0; i < n; i++) {
          const p = pool.spawn();
          const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.9);
          p.x = x; p.y = y; p.color = color; p.kind = 0;
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - speed * 0.5;
          p.life = p.life0 = life * (0.6 + Math.random() * 0.7);
          p.size = size * (0.6 + Math.random() * 0.8); p.g = gravity == null ? 260 : gravity;
        }
      },
      // campfire smoke: slow grey puff drifting up
      smoke(x, y) {
        const p = pool.spawn();
        p.x = x; p.y = y; p.color = "rgba(220,215,205,.55)"; p.kind = 0; p.vx = 8 + Math.random() * 6; p.vy = -14 - Math.random() * 8;
        p.life = p.life0 = 1.6 + Math.random() * 0.6; p.size = 3.5; p.g = -6;
      },
      // expanding ring (rally, rout shock)
      ring(x, y, color, r0, r1, life) {
        const p = pool.spawn();
        p.x = x; p.y = y; p.color = color; p.kind = 1; p.r0 = r0; p.r1 = r1; p.life = p.life0 = life; p.vx = p.vy = 0; p.g = 0;
      },
      update(dt) {
        for (const p of pool.items) {
          if (!p.active) continue;
          p.life -= dt;
          if (p.life <= 0) { pool.release(p); continue; }
          if (p.kind === 0) {
            p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            const dr = Math.pow(0.92, dt * 60); p.vx *= dr;
          }
        }
      },
      draw(ctx) {
        for (const p of pool.items) {
          if (!p.active) continue;
          const t = p.life / p.life0;
          if (p.kind === 0) {
            ctx.globalAlpha = Math.min(1, t * 1.6);
            ctx.fillStyle = p.color;
            const s = Math.max(1, p.size * (0.5 + t * 0.5));
            ctx.fillRect((p.x - s / 2) | 0, (p.y - s / 2) | 0, s | 0 || 1, s | 0 || 1);
          } else {
            const r = p.r0 + (p.r1 - p.r0) * (1 - t);
            ctx.globalAlpha = t * 0.8; ctx.strokeStyle = p.color; ctx.lineWidth = 3 * t + 1;
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
    };
  };

  PS.Floaters = function () {
    const list = [];
    return {
      add(x, y, text, color, size, life) { list.push({ x, y, text, color, size: size || 14, life: life || 0.9, life0: life || 0.9 }); },
      update(dt) {
        for (let i = list.length - 1; i >= 0; i--) { const f = list[i]; f.life -= dt; f.y -= 22 * dt; if (f.life <= 0) list.splice(i, 1); }
      },
      draw(ctx) {
        ctx.save(); ctx.textAlign = "center";
        for (const f of list) {
          const age = 1 - f.life / f.life0, scale = 1.3 - Math.min(0.3, age * 1.2);
          const sz = Math.round(f.size * scale);
          ctx.globalAlpha = Math.min(1, f.life * 2);
          ctx.font = "800 " + sz + "px 'Baloo 2', 'Nunito', system-ui";
          ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.8)"; ctx.strokeText(f.text, f.x, f.y);
          ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
        }
        ctx.restore();
      }
    };
  };
})();
