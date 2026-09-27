// helpers copied verbatim from peasant-swarm/tools/harness.mjs (the fog-honest bot and its chunk runner)
function installHelpers() {
  window.__psh = {
    // scripted player, fog-honest (M3): it reads PS.vis only. Flee a rival it sees at > flee x our size, else hunt one it sees at < hunt x,
    // else the camp it knows nearest by path (one BFS over PS.terrain ranks them: the land is public), else ground it has not explored on
    // a ring toward the map centre. The goal goes to PS.aim, so the game's own flow field routes the swarm.
    policy(o) {
      const S = window.PSS, p = S && S.teams[1]; if (!p || p.count === 0) return "idle";
      const V = window.PS.vis, T = window.PS.terrain, W = S.cfg.world.w, H = S.cfg.world.h, cl = (v, a, b) => (v < a ? a : v > b ? b : v);
      let fl = null, fd = Infinity, hu = null, hd = Infinity;
      for (const r of V.rivals()) {
        const d = Math.hypot(r.x - p.cx, r.y - p.cy);
        if (r.count > o.flee * p.count) { if (d < fd) { fl = r; fd = d; } } else if (r.count < o.hunt * p.count && d < hd) { hu = r; hd = d; }
      }
      let gx, gy, act;
      if (fl) { const dx = p.cx - fl.x, dy = p.cy - fl.y, d = Math.hypot(dx, dy) || 1; gx = cl(p.cx + (dx / d) * o.fleeDist, 40, W - 40); gy = cl(p.cy + (dy / d) * o.fleeDist, 40, H - 40); act = "flee"; }
      else if (hu) { gx = hu.x; gy = hu.y; act = "hunt"; }
      else {
        this.bfs(p.cx, p.cy); let best = null, bd = Infinity;
        for (const c of V.camps()) { const k = T.cellOf(c.x, c.y), d = k >= 0 ? this.D[k] : -1; if (d >= 0 && d < bd) { bd = d; best = c; } }
        // M6: spoils it knows (live where it sees them, last-seen elsewhere), their path distance weighted down so they beat a nearer camp
        const PG = S.cfg.progression, tier = p.tier || { arms: 0, boots: 0, horn: 0 }, cap = (ax, t3) => (ax === "arms" ? (t3 ? PG.armsMax : PG.armsCap) : ax === "boots" ? PG.bootsMax : PG.hornMax);
        let ob = null, od = Infinity;
        for (const o of V.objectives ? V.objectives() : []) {
          if (!o.live && !o.mill) continue; // v3 M3a: its own mill once 6 are banked (SPEC-v3 §3; the bot collects by walking in)
          const use = o.type === "relic" || o.type === "chest" ? tier[o.axis] < cap(o.axis, o.t3) : o.type === "village" ? (o.mill ? o.owner === 1 && o.bank >= 6 : p.count >= 0.5 * o.need) : o.type === "bandit" ? p.count >= 2 * o.need : o.type === "forge" ? o.price > 0 && !o.tooFew && p.count >= 2.5 * o.price : false; // v3 M3b: a forge it can pay with 2.5 x the price (it stands in the ring: its target is the forge)
          if (!use) continue; const k = T.cellOf(o.x, o.y), d = k >= 0 ? this.D[k] : -1; if (d >= 0 && d * 0.5 < od) { od = d * 0.5; ob = o; }
        }
        if (ob && od < bd) { best = ob; bd = od; }
        if (best) { gx = best.x; gy = best.y; act = best === ob ? "spoils" : "camp"; }
        else {
          act = "explore"; gx = W / 2; gy = H / 2; const a0 = Math.atan2(H / 2 - p.cy, W / 2 - p.cx);
          for (let k = 0; k < 12; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, x = p.cx + Math.cos(a) * 600, y = p.cy + Math.sin(a) * 600; if (T.walkable(x, y) && !V.explored(1, x, y)) { gx = x; gy = y; break; } }
        }
      }
      window.PS.aim(gx, gy);
      return act;
    },
    bfs(x, y) {
      const T = window.PS.terrain, m = T.map, N = m.N, NN = N * N, terr = m.terr, wk = T.walkT;
      if (!this.D || this.D.length !== NN) { this.D = new Int32Array(NN); this.Pa = new Int32Array(NN); this.Q = new Int32Array(NN); }
      const D = this.D, Pa = this.Pa, Q = this.Q; D.fill(-1);
      let s = T.cellOf(x, y); if (s < 0 || !wk(terr[s])) s = s >= 0 ? m.snap[s] : m.snap[0];
      let h = 0, t = 0; D[s] = 0; Pa[s] = -1; Q[t++] = s; this.root = s;
      while (h < t) {
        const c = Q[h++], cx = c % N, cy = (c / N) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const n = ny * N + nx; if (D[n] >= 0 || !wk(terr[n])) continue;
          if (dx && dy && (!wk(terr[cy * N + nx]) || !wk(terr[ny * N + cx]))) continue;
          D[n] = D[c] + 1; Pa[n] = c; Q[t++] = n;
        }
      }
    },
    snapshot() {
      const S = window.PSS, z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z;
      let neutrals = 0, onScreen = 0;
      for (const a of S.agents) { if (a.team === 0) neutrals++; if (Math.abs(a.x - S.cam.x) < hw && Math.abs(a.y - S.cam.y) < hh) onScreen++; }
      const counts = {}; for (const t of S.teams.slice(1)) counts[t.name] = t.count;
      return { t: Math.round(S.t * 100) / 100, mode: S.mode, result: S.result, counts, alive: S.teams.slice(1).map((t) => t.alive), neutrals, total: S.agents.length, onScreen,
        ev: S.ev ? { ...S.ev, gains: undefined, taken: undefined } : null, playerFights: S.stats.fights || 0, flow: window.PS.flow ? window.PS.flow.stats.rebuilds : 0,
        tiers: S.teams.slice(1).map((t) => t.tierN || 0), taken: S.ev && S.ev.taken ? S.ev.taken.filter((x) => x[1] === 1).length : 0 };
    },
  };
}
function runChunk(o) {
  const S = window.PSS, w0 = performance.now(), t0 = S.t, acts = { camp: 0, hunt: 0, flee: 0, idle: 0, explore: 0, spoils: 0 };
  let stepMs = 0, steps = 0, peak = S.agents.length, drawn = 0;
  while (S.mode === "play" && S.t < o.until - 1e-6 && S.t - t0 < o.maxSim - 1e-6 && performance.now() - w0 < o.wallMs) {
    acts[window.__psh.policy(o.policy)]++;
    const sec = Math.max(1 / 60, Math.min(o.tick, o.until - S.t, o.maxSim - (S.t - t0)));
    const a = performance.now(); window.PS.step(sec); stepMs += performance.now() - a; steps++;
    if (S.mode === "play" && o.leak) { window.PS.vis.leakCheck(); drawn++; } // a frame drawn and leak-checked after every policy step (M3)
    if (S.agents.length > peak) peak = S.agents.length;
  }
  return { t: S.t, simSec: S.t - t0, stepMs, steps, peak, acts, drawn, mode: S.mode, wallMs: performance.now() - w0 };
}
export { installHelpers, runChunk };
