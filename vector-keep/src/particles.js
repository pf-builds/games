// Glow sprites, pooled particles (dots + line shards), floaters.
// Rebuilt per visual-critic pass: multi-size sprite cache, proper falloff
// gradient (terminating at color@0 alpha, never black), shard bursts.
(function () {
  const VK = (window.VK = window.VK || {});

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  VK.hexA = hexA;

  // --- glow sprite cache at 3 sizes; pick nearest to draw size to avoid mushy upscaling ---
  const glowCache = new Map();
  function buildGlow(color, size) {
    const c = document.createElement("canvas");
    c.width = c.height = size * 2;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(size, size, 0, size, size, size);
    grad.addColorStop(0, hexA(color, 1));
    grad.addColorStop(0.12, hexA(color, 1));
    grad.addColorStop(0.30, hexA(color, 0.55));
    grad.addColorStop(0.55, hexA(color, 0.22));
    grad.addColorStop(0.78, hexA(color, 0.08));
    grad.addColorStop(1, hexA(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size * 2, size * 2);
    return c;
  }
  VK.glow = function (color, drawRadius) {
    const size = drawRadius <= 20 ? 16 : drawRadius <= 56 ? 32 : 64;
    const key = color + "|" + size;
    let c = glowCache.get(key);
    if (!c) { c = buildGlow(color, size); glowCache.set(key, c); }
    return c;
  };
  VK.glowSprite = function (color) { return VK.glow(color, 16); }; // legacy callers

  // --- pooled particles: kind 0 = glow dot, kind 1 = line shard ---
  function Pool(cap) {
    this.cap = cap;
    this.items = new Array(cap);
    this.free = new Array(cap);
    for (let i = 0; i < cap; i++) { this.items[i] = { active: false, idx: i }; this.free[i] = i; }
    this.freeTop = cap;
    this.cursor = 0;
  }
  Pool.prototype.spawn = function () {
    if (this.freeTop > 0) { const p = this.items[this.free[--this.freeTop]]; p.active = true; return p; }
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.cap;
    p.active = true; // overwrite-oldest: bursts never silently vanish
    return p;
  };
  Pool.prototype.release = function (p) {
    if (!p.active) return;
    p.active = false;
    if (this.freeTop < this.cap) this.free[this.freeTop++] = p.idx;
  };

  VK.Particles = function (cap) {
    const pool = new Pool(cap);
    function base(p, x, y, color, life, size) {
      p.x = x; p.y = y; p.color = color;
      p.life = p.life0 = life; p.size = size; p.drag = 0.9; p.rot = 0; p.vrot = 0;
    }
    return {
      burst(x, y, color, n, speed, life, size) {
        for (let i = 0; i < n; i++) {
          const p = pool.spawn();
          const a = Math.random() * Math.PI * 2;
          const sp = speed * (0.35 + Math.random() * 0.85);
          base(p, x, y, color, life * (0.6 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8));
          p.kind = 0; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        }
      },
      shards(x, y, color, n, speed) {
        for (let i = 0; i < n; i++) {
          const p = pool.spawn();
          const a = Math.random() * Math.PI * 2;
          const sp = speed * (0.6 + Math.random() * 0.8);
          base(p, x, y, color, 0.4 + Math.random() * 0.35, 7 + Math.random() * 9);
          p.kind = 1; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
          p.rot = a; p.vrot = (Math.random() - 0.5) * 10;
        }
      },
      update(dt) {
        for (const p of pool.items) {
          if (!p.active) continue;
          p.life -= dt;
          if (p.life <= 0) { pool.release(p); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          const dr = Math.pow(p.drag, dt * 60);
          p.vx *= dr; p.vy *= dr;
          p.rot += p.vrot * dt;
        }
      },
      draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const p of pool.items) {
          if (!p.active) continue;
          const t = p.life / p.life0;
          ctx.globalAlpha = Math.min(1, t * 1.4);
          if (p.kind === 0) {
            const s = p.size * (0.5 + t * 0.5) * 2;
            ctx.drawImage(VK.glow(p.color, s), p.x - s, p.y - s, s * 2, s * 2);
          } else {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            const hx = Math.cos(p.rot) * p.size, hy = Math.sin(p.rot) * p.size;
            ctx.beginPath();
            ctx.moveTo(p.x - hx, p.y - hy);
            ctx.lineTo(p.x + hx, p.y + hy);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    };
  };

  // floating texts — glow + dark stroke + scale punch (critic: 12px flat text was invisible)
  VK.Floaters = function () {
    const list = [];
    return {
      add(x, y, text, color, size) { list.push({ x, y, text, color, size: size || 16, life: 0.9, life0: 0.9 }); },
      update(dt) {
        for (let i = list.length - 1; i >= 0; i--) {
          const f = list[i];
          f.life -= dt; f.y -= 26 * dt;
          if (f.life <= 0) list.splice(i, 1);
        }
      },
      draw(ctx) {
        ctx.save();
        ctx.textAlign = "center";
        for (const f of list) {
          const age = 1 - f.life / f.life0;
          const scale = 1.35 - Math.min(0.35, age * 1.4);
          const sz = Math.round(f.size * scale);
          ctx.globalAlpha = Math.min(1, f.life * 1.8);
          ctx.font = "700 " + sz + "px 'Chakra Petch', system-ui";
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = "rgba(0,0,0,.85)";
          ctx.strokeText(f.text, f.x, f.y);
          ctx.shadowColor = f.color;
          ctx.shadowBlur = 12;
          ctx.fillStyle = f.color;
          ctx.fillText(f.text, f.x, f.y);
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }
    };
  };
})();
