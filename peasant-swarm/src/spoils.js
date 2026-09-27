// Peasant Swarm — spoils (SPEC-v2 §8). Click it! Studios, 2026.
// Three permanent team-wide axes (Arms I-III, Boots I-II, Horn I-II) and where they come from: muster milestones, six fixed chests at dead
// ends, a trickle chest every progression.trickleChestEvery s after 1:00, bandit camps, and a routed leader's drops. Villages whose
// garrison joins you. Bandits are agents with team id 8 that live in S.bandits (never in S.teams); game.js steers them in its agent loop.
// Every objective (chest, village, bandit camp, ground relic) is one record in S.objs with the same shape: x, y, live, landmark (a site every
// AI knows from the start, state unknown until seen), kn[team] (what each team last saw there: -1 never, 0 gone, 1 live) and sk (the
// player's last-seen state, drawn under fog). All tuning in config.progression, config.encampments and config.structures.
// v3 structures (SPEC-v3 §3, M3a): a joined village stays on the map as a site ("mill") with an owner and a bank. One capture rule for every
// site (holdStep: the v2 village ring rule), rout flips and elimination to neutral. Owner and bank are last-seen state (sk.team, sk.n for
// the player; kt[team] / kb[team] for each AI). M3b: a cleared bandit camp becomes its clearer's stockade (shoots, sights, captured by the
// same ring hold with no owner agent in it), three forges sell tier I-II for peasants (intent rule, floor, pay walk), and the trains hook
// tags a share of each team's new neutral recruits while it owns a stockade (data only; archers are M4).
// game.js binds this module once with its hooks (PS.Spoils(G)) and calls place / tick / observe / draw from newGame, update, observe, draw.
(function () {
  const PS = (window.PS = window.PS || {});
  const AXES = ["arms", "boots", "horn"], ROMAN = ["0", "I", "II", "III"], AXNAME = { arms: "ARMS", boots: "BOOTS", horn: "HORN" };
  const KIND = ["GREEN", "ORANGE", "RED"], KCOL = ["#5CC85A", "#F0922C", "#E0443C"]; // bandit camp kinds by index: reward utility, Arms, Arms III

  PS.Spoils = function (G) {
    const S = G.S, cfgOf = () => S.cfg;
    let nextId = 1;
    const mkObj = (type, x, y, landmark) => ({ type, id: nextId++, x, y, live: true, landmark: !!landmark, kn: new Int8Array(9).fill(-1), pr: true,
      axis: "", t3: false, src: "", life: Infinity, pair: null, gar: 0, prog: 0, holdTeam: 0, have: 0, agents: null, owner: 0, weight: 0, hold: 0,
      kind: 0, n0: 0, n: 0, lastHit: 0, fn: 0, fx: 0, fy: 0, vs: 0, opened: -1, sk: { seen: false, live: true, n: 0, team: 0 },
      site: "", bank: 0, bankT: 0, colT: 0, kt: new Int8Array(9).fill(-1), kb: new Int8Array(9), fh: null, payT0: 0, payTeam: 0, fireT: 0, shot: null }); // v3 sites (SPEC-v3 §3): kind ("mill" | "stockade" | "forge"), bank, bank / collect clocks; kt / kb: the owner and bank each team last saw (-1 never); fh: a forge's hold per team, payT0 / payTeam: its pay walk; fireT / shot: a stockade's shot clock and its last target
    const ST = () => cfgOf().structures, SON = () => cfgOf().structures.enabled; // SPEC-v3 §0 kill switch: false keeps v2's villages
    function reset() { S.objs = []; S.bandits = []; S.spT = 0; nextId = 1; arrowsInit(); }

    // ---------------------------------------------------------------- team tiers and their stats
    // hpMax / atkMul / power from Arms, spdMul / fordMul from Boots, recR from Horn. rescale: every living agent keeps its share of hp.
    function initTeam(t) { t.tier = { arms: 0, boots: 0, horn: 0 }; t.mustered = 0; t.musterK = 0; t.tierN = 0; applyTiers(t, false); }
    function applyTiers(t, rescale) {
      const cfg = cfgOf(), A = cfg.agent, PG = cfg.progression, k = t.tier, old = t.hpMax || A.hp;
      t.hpMax = A.hp * (1 + PG.armsHp * k.arms); t.atkMul = 1 + PG.armsAtk * k.arms; t.power = PG.armsPower[Math.min(k.arms, PG.armsPower.length - 1)];
      t.spdMul = 1 + PG.bootsSpeed * k.boots; t.fordMul = k.boots > 0 ? 1 - (1 - cfg.terrain.fordSpeed) * (1 - PG.bootsFord) : cfg.terrain.fordSpeed;
      t.recR = PG.hornRadius[Math.min(k.horn, PG.hornRadius.length - 1)]; t.tierN = k.arms + k.boots + k.horn;
      if (rescale && old !== t.hpMax) { const f = t.hpMax / old; for (const a of S.agents) if (a.team === t.id && !a.dead) a.hp *= f; }
    }
    const capOf = (axis, t3) => { const PG = cfgOf().progression; return axis === "arms" ? (t3 ? PG.armsMax : PG.armsCap) : axis === "boots" ? PG.bootsMax : PG.hornMax; };
    const canTake = (t, axis, t3) => !!t && t.tier[axis] < capOf(axis, t3);
    // the team's atlas carries its Arms tier (hat band, crest, tines); the old relic atlas is zeroed in the live world (never in a sandbox,
    // whose teams share the live cache)
    function restyle(t) {
      const a = t.tier.arms, old = t.spr; t.spr = S.spr.peasantSet(t.color, t.id, a ? { helmet: a, tines: a } : null);
      if (old && old !== t.spr && old.relics && !G.sandbox()) { let used = false; for (const u of G.swarms()) if (u.spr === old) used = true; if (!used) S.spr.dropSet(old); }
    }
    // +1 tier on axis (capped: Arms II, III only with a t3 relic; Boots II; Horn II). Banner, floater and a sound for your gains; a floater
    // over a rival you can see. Logged in S.ev.gains [t, team, axis, tier, source].
    function grant(t, axis, t3, why, x, y, paid) {
      if (!canTake(t, axis, t3)) return false;
      t.tier[axis]++; applyTiers(t, true); if (axis === "arms") restyle(t);
      const lvl = t.tier[axis], name = AXNAME[axis] + " " + ROMAN[lvl], col = S.spr.spoils.relics[axis].color;
      S.ev.gains.push([+S.t.toFixed(1), t.id, axis, lvl, why]);
      if (t.isPlayer && !S.aiPlayer) {
        G.banner((why === "muster" ? "MUSTER " + cfgOf().progression.muster[t.musterK] + ": " : "") + name + (paid ? " · " + paid + " PAID" : ""), col, 2.4, 0, 2); // v3 forge: "ARMS II · 40 PAID"
        G.floater(t.cx, t.cy - 34, "+" + name, col, 16, 1.4); if (why === "muster") PS.audio.fanfare(); else PS.audio.relic();
        if (G.gained) G.gained(t, axis); // M7 onboarding: the first gain's icon flies into the relic strip
      } else if (G.fxOk(t.ax, t.ay) && G.seenSwarm(t.id)) G.floater(t.ax, t.ay - 40, "+" + name, t.color, 13, 1.2);
      return true;
    }
    // muster milestones (progression.muster, absorbed rivals excluded): neutrals recruited through convert() count
    function onConvert(a, t, from, absorbed) {
      if (from !== 0 || absorbed || a.exr) { a.exr = false; return; }
      train(a, t); t.mustered++; const M = cfgOf().progression.muster, MA = cfgOf().progression.musterAxes;
      for (let g = 0; g < M.length && t.musterK < M.length && t.mustered >= M[t.musterK]; g++) { grant(t, MA[t.musterK], false, "muster", t.cx, t.cy); t.musterK++; }
    }

    // ---------------------------------------------------------------- placement (newGame; S.rng only)
    // per map, once: every walkable cell's path distance to the nearest spawn (px) and the dead ends among them (local maxima over 5 x 5)
    function tables(m) {
      if (m.spoilT) return m.spoilT;
      const N = m.N, NN = N * N, U = m.cell / 3, dmin = new Float32Array(NN).fill(1e9), dead = new Uint8Array(NN);
      for (let c = 0; c < NN; c++) { let b = 65535; for (let i = 0; i < m.dist.length; i++) { const d = m.dist[i][c]; if (d < b) b = d; } if (b < 65535) dmin[c] = b * U; }
      for (let c = 0; c < NN; c++) {
        if (dmin[c] >= 1e9) continue; const i = c % N, j = (c / N) | 0; let top = true;
        for (let v = -2; v <= 2 && top; v++) for (let u = -2; u <= 2; u++) { const x = i + u, y = j + v; if (x < 0 || y < 0 || x >= N || y >= N) continue; const q = y * N + x; if (dmin[q] < 1e9 && dmin[q] > dmin[c]) { top = false; break; } }
        if (top) dead[c] = 1;
      }
      return (m.spoilT = { dmin, dead });
    }
    // open ground clear of every placed objective by gap px and of every neutral camp by encampments.campGap px
    function clearAt(x, y, gap, campGap) {
      const cg = campGap || cfgOf().encampments.campGap;
      for (const o of S.objs) { const dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy < gap * gap) return false; }
      for (const c of S.camps) { const dx = c.x - x, dy = c.y - y; if (dx * dx + dy * dy < cg * cg) return false; }
      return true;
    }
    // for placeOk (trickle camps and power-ups): not inside a bandit camp's reach nor on a village (joined or not)
    function blocks(x, y) {
      const EN = cfgOf().encampments;
      for (const o of S.objs) { if (o.type === "relic" || (!o.live && o.type !== "village")) continue; const r = o.type === "bandit" ? EN.banditLeash + EN.banditAggro + EN.campGap * 0.5 : o.type === "chest" ? EN.campGap * 0.5 : EN.villageRing + 40; const dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy < r * r) return true; }
      return false;
    }
    const pickAxis = () => { const W = cfgOf().progression.chestAxes; let tot = 0; for (const k of AXES) tot += W[k]; let r = S.rng() * tot; for (const k of AXES) { r -= W[k]; if (r <= 0) return k; } return "horn"; };
    function place(P) {
      reset();
      const m = S.map, cfg = cfgOf(), EN = cfg.encampments, N = m.N, cell = m.cell, R = S.rng, T = PS.terrain;
      if (!m.dist || m.dist.length !== 6 || m.spawns.length !== 6) return; // fixture and flat maps: the tests stage their own
      const TB = tables(m), cxy = (c) => [((c % N) + 0.2 + 0.6 * R()) * cell, (((c / N) | 0) + 0.2 + 0.6 * R()) * cell];
      const inBand = (i, c, b) => { const d = m.dist[i][c] * cell / 3; return d >= b[0] && d <= b[1]; };
      // villages: one per spawn region, path distance from its spawn in encampments.villageDist, garrisons shuffled
      const gars = EN.villages.slice(); for (let i = gars.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0, t = gars[i]; gars[i] = gars[j]; gars[j] = t; }
      for (let r = 0; r < 6; r++) {
        const L = P.owned[r];
        for (let k = 0; k < 160; k++) {
          const c = L[(R() * L.length) | 0], [x, y] = cxy(c); if (!inBand(r, c, EN.villageDist) || !T.placementOk(x, y, 3) || !T.placementOk(x, y - 50, 2) || !clearAt(x, y, EN.objectGap)) continue;
          mkVillage(x, y, gars[r % gars.length]); break;
        }
      }
      // fixed chests: one per spawn region at a dead end (a local maximum of path distance from the nearest spawn) in encampments.chestDist
      for (let r = 0; r < 6; r++) {
        const L = P.owned[r], cand = [];
        for (let q = 0; q < L.length; q++) { const c = L[q]; if (TB.dead[c] && inBand(r, c, EN.chestDist)) cand.push(c); }
        cand.sort((a, b) => TB.dmin[b] - TB.dmin[a] || a - b);
        let done = false;
        for (let k = 0; k < cand.length && !done && k < 24; k++) { const c = cand[k < 3 ? (R() * Math.min(3, cand.length)) | 0 : k], x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell; if (!T.placementOk(x, y, 1) || !clearAt(x, y, EN.objectGap)) continue; const o = mkObj("chest", x, y, true); o.axis = pickAxis(); o.src = "fixed"; S.objs.push(o); done = true; }
        for (let k = 0; k < 120 && !done; k++) { const c = L[(R() * L.length) | 0], [x, y] = cxy(c); if (!inBand(r, c, EN.chestDist) || !T.placementOk(x, y, 2) || !clearAt(x, y, EN.objectGap)) continue; const o = mkObj("chest", x, y, true); o.axis = pickAxis(); o.src = "fixed"; S.objs.push(o); done = true; }
      }
      // bandit camps: >= encampments.banditMinPath by path from every spawn; the red one nearest the centre, then orange and green spread out
      // (farthest from everything placed, from a sample of candidates)
      const cand = []; for (let q = 0; q < P.open3.length; q++) { const c = P.open3[q]; if (TB.dmin[c] >= EN.banditMinPath + cell) cand.push(c); }
      const order = []; for (let k = 2; k >= 0; k--) for (let n = 0; n < EN.banditCounts[k]; n++) order.push(k);
      for (const kind of order) {
        let best = -1, bs = -1; const W2 = m.W / 2;
        for (let s = 0; s < (kind === 2 ? cand.length : Math.min(60, cand.length)); s++) {
          const c = kind === 2 ? cand[s] : cand[(R() * cand.length) | 0], x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell;
          if (!T.placementOk(x, y, 3) || !clearAt(x, y, EN.banditGap, EN.banditLeash + EN.banditAggro + EN.campGap)) continue; // no neutral camp inside a bandit's reach
          let sc; if (kind === 2) sc = -((x - W2) * (x - W2) + (y - W2) * (y - W2)); else { sc = 1e12; for (const o of S.objs) { const d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y); if (d < sc) sc = d; } }
          if (sc > bs || best < 0) { bs = sc; best = c; }
        }
        // v3: forest (and its groveClear margin) shrinks the open ground, so a sampled pick that found nothing falls back to a full scan of the
        // candidates by the same score (no S.rng draws; only on maps with forest, so the kill switches keep v2's placement exactly)
        if (best < 0 && m.forest && m.forest.cells > 0) for (let s = 0; s < cand.length; s++) {
          const c = cand[s], x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell;
          if (!T.placementOk(x, y, 3) || !clearAt(x, y, EN.banditGap, EN.banditLeash + EN.banditAggro + EN.campGap)) continue;
          let sc = 1e12; for (const o of S.objs) { const d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y); if (d < sc) sc = d; }
          if (sc > bs || best < 0) { bs = sc; best = c; }
        }
        if (best < 0) continue;
        mkCamp(((best % N) + 0.5) * cell, (((best / N) | 0) + 0.5) * cell, kind, EN.banditSizes[kind], kind === 0 ? (R() < 0.5 ? "boots" : "horn") : "arms");
      }
      // v3: the heavy chests are gone; the forges take their place (SPEC-v3 §3). Only with structures on, so the kill switch draws no S.rng
      if (SON() && ST().forge.count > 0) placeForges(m);
    }
    // forge.count forges round the centre at about forge.ringR x W, one in every other gap between neighbouring spawns (which set of gaps: one
    // S.rng draw; axes shuffled on S.rng), so each serves two spawns. The gap's own angle is the ridge between their regions, so each forge
    // takes the open cell (placement rules, objectGap) that best splits the two spawns' path distances, weighed with how far it strays from
    // the ring and the gap (one scan of the grid per forge at match start, no draws; SPEC-v3 §3 leaves the exact spot open)
    function placeForges(m) {
      const F = ST().forge, EN = cfgOf().encampments, T = PS.terrain, R = S.rng, N = m.N, cell = m.cell, U = cell / 3, c0 = m.W / 2, rr = F.ringR * m.W, sp = m.spawns;
      const angOf = (i) => Math.atan2(sp[i].y - c0, sp[i].x - c0), idx = sp.map((s, i) => i).sort((a, b) => angOf(a) - angOf(b));
      const off = R() < 0.5 ? 0 : 1, ax = AXES.slice(); for (let i = ax.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0, q = ax[i]; ax[i] = ax[j]; ax[j] = q; }
      for (let k = 0; k < F.count; k++) {
        const i = (off + ((k * idx.length / F.count) | 0)) % idx.length, A = idx[i], B = idx[(i + 1) % idx.length], aA = angOf(A), aB = angOf(B) + (i + 1 < idx.length ? 0 : Math.PI * 2), g = (aA + aB) / 2;
        let best = -1, bs = Infinity;
        for (let c = 0; c < N * N; c++) {
          const x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell, dx = x - c0, dy = y - c0, r = Math.sqrt(dx * dx + dy * dy); if (Math.abs(r - rr) > 0.1 * m.W) continue;
          let da = Math.atan2(dy, dx) - g; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; if (Math.abs(da) > 0.6) continue;
          const dA = m.dist[A][c], dB = m.dist[B][c]; if (dA >= 65535 || dB >= 65535) continue;
          const sc = Math.abs(dA - dB) * U + Math.abs(r - rr) * 0.5 + Math.abs(da) * rr * 0.25; if (sc >= bs || !T.placementOk(x, y, 3) || !clearAt(x, y, EN.objectGap)) continue;
          bs = sc; best = c;
        }
        if (best < 0) continue;
        const o = mkObj("forge", ((best % N) + 0.5) * cell, (((best / N) | 0) + 0.5) * cell, true); o.site = "forge"; o.axis = ax[k % ax.length]; o.fh = new Float32Array(9); o.agents = []; S.objs.push(o);
      }
    }
    // a village of gar with its garrison inside the palisade (hidden agents: they count toward the cap and join through convert())
    function mkVillage(x, y, gar) {
      const R = S.rng, v = mkObj("village", x, y, true); v.gar = gar; v.agents = []; S.objs.push(v);
      for (let g = 0; g < gar; g++) { const a = G.mkAgent(x + (R() - 0.5) * 60, y - 28 - R() * 26, 0); a.gar = true; a.hx = a.wx = a.x; a.hy = a.wy = a.y; v.agents.push(a); S.agents.push(a); }
      return v;
    }
    // a bandit camp of kind (0 green, 1 orange, 2 red) with n bandits on posts round its tent (team id 8); reward axis, tier III for red
    function mkCamp(x, y, kind, n, axis) {
      const T = PS.terrain, EN = cfgOf().encampments, b = mkObj("bandit", x, y, true); b.kind = kind; b.axis = axis; b.t3 = kind === 2; b.agents = []; S.objs.push(b); S.bandits.push(b);
      for (let i = 0, k = 0; k < n && i < n * 4; i++) {
        const a0 = i * 2.39996, d = 12 + 8 * Math.sqrt(i + 0.5), px = x + Math.cos(a0) * d, py = y + Math.sin(a0) * d; if (!T.walkable(px, py) || T.sdfAt(px, py) < 8) continue;
        const a = G.mkAgent(px, py, 8); a.hp = EN.banditHp; a.camp = b; a.hx = a.wx = px; a.hy = a.wy = py; b.agents.push(a); S.agents.push(a); k++;
      }
      b.n = b.n0 = b.agents.length; return b;
    }
    // QA and art scenes: one objective of type at (x, y) in the current world (fixture maps have no placement). o: { gar, kind, n, axis, t3,
    // owner, bank }. "mill": a village that has already joined (no garrison), owned by o.owner (0 neutral) with o.bank banked
    function stage(type, x, y, o) {
      o = o || {};
      if (type === "village") return mkVillage(x, y, o.gar || 12);
      if (type === "mill") { const v = mkVillage(x, y, 0); v.live = false; v.opened = S.t; v.site = "mill"; v.owner = o.owner || 0; v.bank = o.bank || 0; if (v.owner) v.kt[v.owner] = v.owner; return v; }
      if (type === "bandit") return mkCamp(x, y, o.kind || 0, o.n || cfgOf().encampments.banditSizes[o.kind || 0], o.axis || "arms");
      if (type === "relic") return relicAt(x, y, o.axis || "arms", !!o.t3, "qa", o.life || Infinity);
      if (type === "forge") { const f = mkObj("forge", x, y, true); f.site = "forge"; f.axis = o.axis || "arms"; f.fh = new Float32Array(9); f.agents = []; S.objs.push(f); return f; }
      if (type === "stockade") { const b = mkObj("bandit", x, y, true); b.kind = o.kind || 0; b.agents = []; b.live = false; b.opened = S.t; S.objs.push(b); S.bandits.push(b); toStockade(b, o.owner ? S.teams[o.owner] : null); return b; } // a cleared camp owned by o.owner
      const b = mkObj(type, x, y, o.landmark !== false); b.axis = o.axis || "arms"; b.src = "qa"; S.objs.push(b); return b;
    }
    // a ground relic (a scroll with its axis icon): life s (Infinity: until taken)
    function relicAt(x, y, axis, t3, src, life) { const p = PS.terrain.snapXY(x, y), o = mkObj("relic", p.x, p.y, false); o.axis = axis; o.t3 = !!t3; o.src = src; o.life = life; S.objs.push(o); return o; }

    // ---------------------------------------------------------------- per tick (update(), after recruitment and power-ups)
    const TC = new Int32Array(9); // agents per team in a ring (scratch)
    function ringCount(x, y, r) {
      TC.fill(0); const n = G.gather(x, y, r), NEAR = G.NEAR, r2 = r * r;
      for (let k = 0; k < n; k++) { const b = NEAR[k], tm = b.team; if (tm < 1 || tm > 6 || b.dead || b.escapeT > 0) continue; const dx = b.x - x, dy = b.y - y; if (dx * dx + dy * dy < r2) TC[tm]++; }
      let lead = 0, others = 0; for (let i = 1; i < 7; i++) if (TC[i] > TC[lead]) lead = i;
      for (let i = 1; i < 7; i++) if (i !== lead && TC[i] > 0) others++;
      return lead ? (others << 16) | lead : 0;
    }
    // the first team agent within r of (x, y) whose team can take a relic of this axis (null: none)
    function toucher(x, y, r, axis, t3) {
      const n = G.gather(x, y, r), NEAR = G.NEAR, r2 = r * r;
      for (let k = 0; k < n; k++) { const b = NEAR[k], tm = b.team; if (tm < 1 || tm > 6 || b.dead) continue; const dx = b.x - x, dy = b.y - y; if (dx * dx + dy * dy < r2) { const t = S.teams[tm]; if (!axis || canTake(t, axis, t3)) return t; } }
      return null;
    }
    const taken = (o, t) => { S.ev.taken.push([+S.t.toFixed(1), t.id, o.type]); };
    function tick(dt, finalPhase) {
      const cfg = cfgOf(), EN = cfg.encampments, PG = cfg.progression, pr = PG.pickupRadius, scan = S.tick % EN.scanTicks === 0, sdt = dt * EN.scanTicks;
      if (S.tick === 3600 || S.tick === 10800 || S.tick === 18000) S.ev["tiers" + S.tick / 60] = G.swarms().map((t) => t.tierN); // tiers at 1:00 / 3:00 / 5:00 (three times a match)
      if (S.tick === 10800) S.ev.kind180 = G.swarms().map((t) => (t.count ? +(t.kindN / t.count).toFixed(3) : 0)); // v3 M3b: trained share per team at 3:00
      for (let i = S.objs.length - 1; i >= 0; i--) {
        const o = S.objs[i];
        if (o.site) { if (o.agents !== null && o.agents.length && o.site === "forge") payStep(o, dt); if (scan) siteTick(o, sdt); continue; } // v3 structures (SPEC-v3 §3): mills, stockades, forges
        if (o.type === "relic") {
          if (o.life !== Infinity && (o.life -= dt) <= 0) { S.objs.splice(i, 1); continue; } // rare: one splice when a drop expires
          const t = toucher(o.x, o.y, pr, o.axis, o.t3); if (!t) continue;
          grant(t, o.axis, o.t3, o.src, o.x, o.y); taken(o, t); if (G.fxOk(o.x, o.y)) G.burst(o.x, o.y - 10, S.spr.spoils.relics[o.axis].color, 12, 110, 0.6, 3, 140);
          if (o.pair) { const q = S.objs.indexOf(o.pair); if (q >= 0) { S.objs.splice(q, 1); if (q < i) i--; } }
          S.objs.splice(i, 1); continue;
        }
        if (!o.live) continue;
        if (o.type === "chest") {
          const t = toucher(o.x, o.y, pr + 8, o.axis, false); if (!t) continue;
          o.live = false; o.opened = S.t; grant(t, o.axis, false, o.src, o.x, o.y); taken(o, t);
          if (G.fxOk(o.x, o.y)) { G.burst(o.x, o.y - 8, "#F6CF6A", 14, 120, 0.6, 3, 160); PS.audio.chest(); }
        } else if (o.type === "village" && scan) {
          const lead = holdStep(o, EN.villageRing, o.gar, 0, sdt); if (lead) joinVillage(o, S.teams[lead]);
        } else if (o.type === "bandit") {
          if (o.fn > 0) { const x = o.fx / o.fn, y = o.fy / o.fn; G.noiseAt(8, o.vs, x, y); if (S.fogOn && o.vs !== 1 && !PS.fog.sees(1, x, y)) G.clashPing(x, y, false); } // bandit fights make clash noise (SPEC-v2 §5, §7)
          o.fn = 0; o.fx = 0; o.fy = 0;
          if (o.n <= 0) { o.live = false; o.opened = S.t; const t = S.teams[o.lastHit]; if (t) taken(o, t); relicAt(o.x, o.y, o.axis, o.t3, "bandit", Infinity);
            if (t && t.isPlayer && !S.aiPlayer) { G.banner(KIND[o.kind] + " CAMP CLEARED", KCOL[o.kind], 2.2, 0, 2); PS.audio.chest(); } else if (G.playerSees(o.x, o.y)) G.banner((t ? t.name.toUpperCase() : "BANDITS") + " CLEARED A CAMP", t ? t.color : "#F1EEDF", 1.8, 0, 0);
            if (SON()) toStockade(o, t); } // v3 (SPEC-v3 §3): the cleared camp is the clearer's stockade
        }
      }
      // trickle chest: every progression.trickleChestEvery s from progression.trickleChestAfter, off in the finale, at most trickleChestMax
      // alive; biased (trickleChestBias) to the smallest living swarm, beyond its sight like the trickle camps
      if (!finalPhase && S.t >= PG.trickleChestAfter && S.map && S.map.dist && S.map.dist.length === 6) {
        S.spT += dt;
        if (S.spT >= PG.trickleChestEvery) {
          S.spT = 0; let alive = 0; for (const o of S.objs) if (o.type === "chest" && o.src === "trickle" && o.live) alive++;
          if (alive < PG.trickleChestMax) {
            let s1 = null; for (const t of G.swarms()) if (t.alive && t.count > 0 && (!s1 || t.count < s1.count)) s1 = t;
            const fav = s1 && S.rng() < PG.trickleChestBias ? s1 : null, SP = cfg.spawn, md2 = SP.minTrickleDistFromTeams * SP.minTrickleDistFromTeams;
            for (let n = 0; n < 40; n++) {
              let x, y; if (fav) { const Rr = G.sightR(fav) + SP.trickleBeyond[0] + S.rng() * (SP.trickleBeyond[1] - SP.trickleBeyond[0]), a = S.rng() * Math.PI * 2; x = fav.cx + Math.cos(a) * Rr; y = fav.cy + Math.sin(a) * Rr; } else { const p = G.randPos(); x = p.x; y = p.y; }
              if (!G.placeOk(x, y, 2, 30) || !clearAt(x, y, EN.objectGap * 0.5)) continue;
              let ok = true; for (const t of G.swarms()) { if (!t.alive || t === fav) continue; const dx = t.cx - x, dy = t.cy - y; if (dx * dx + dy * dy < md2) { ok = false; break; } }
              if (!ok) continue; const o = mkObj("chest", x, y, false); o.axis = pickAxis(); o.src = "trickle"; S.objs.push(o); S.ev.trickleChests++; break;
            }
          }
        }
      }
    }
    // capture by ring hold (SPEC-v2 §8 village rule, SPEC-v3 §3 for every site): the lead team in the ring (most agents; remnants in their
    // escape window never count; a tie goes to the lower team id) takes it at once with >= need, else after max(villageMin, villageStep x
    // (need - have)); any other team's agent in the ring pauses the timer; a new lead restarts it. exclude: a team that never captures here
    // (the owner of an owned site: its agents in the ring only pause a rival). Returns the captor's id, else 0. Leaves the counts in TC.
    // block: a team whose agents in the ring stop any capture (a stockade's owner, SPEC-v3 §3): the timer holds where it is
    function holdStep(o, ring, need, exclude, sdt, block) {
      const EN = cfgOf().encampments, rc = ringCount(o.x, o.y, ring), lead = rc & 0xffff, rival = rc >> 16, have = lead ? TC[lead] : 0; o.have = have;
      if (!lead || lead === exclude) { o.holdTeam = 0; o.prog = 0; return 0; }
      if (lead !== o.holdTeam) { o.holdTeam = lead; o.prog = 0; }
      if (block && TC[block] > 0) return 0;
      if (have >= need) o.prog = 1; else if (!rival) o.prog += sdt / Math.max(EN.villageMin, EN.villageStep * (need - have)); // a rival in the ring pauses the timer
      return o.prog >= 1 ? lead : 0;
    }
    // the need a rival sees on a site (SPEC-v3 §3): a mill max(structures.guardMin, banked) (a neutral mill: guardMin)
    const needOf = (o, bank) => (o.site === "stockade" ? ST().stockade.captureMin : Math.max(ST().guardMin, bank)); // a stockade: stockade.captureMin
    // one site per scan tick (SPEC-v3 §3). Mill: +1 banked every mill.every s while its owner lives, up to mill.cap; captured by ring hold at
    // needOf (the owner never captures its own); collected by >= mill.collectMin owner agents in the ring for mill.collectHold s (walking
    // through collects; a rival in the ring does not stop the owner collecting)
    function siteTick(o, sdt) {
      if (o.site === "forge") { forgeTick(o, sdt); return; }
      if (o.site === "stockade") { stockTick(o, sdt); return; }
      const M = ST().mill, t = o.owner ? S.teams[o.owner] : null;
      if (t && t.alive && o.bank < M.cap) { o.bankT += sdt; if (o.bankT >= M.every) { o.bankT -= M.every; o.bank++; } } else o.bankT = 0;
      const cap = holdStep(o, M.ring, needOf(o, o.bank), o.owner, sdt); if (cap) { takeSite(o, S.teams[cap], "ring"); return; }
      if (t && o.bank > 0 && TC[o.owner] >= M.collectMin) { o.colT += sdt; if (o.colT >= M.collectHold) { o.colT = 0; payOut(o, t, false); } } else o.colT = 0;
    }
    // the bank walks out of the gate through convert() (muster counts, SPEC-v3 §3): one agent per banked recruit while the world is under the
    // agent cap; the excess stays banked. Logged in S.ev.millPaid[team]. Returns how many walked out.
    function payOut(o, t, raid) {
      const R = S.rng; let n = 0;
      while (o.bank > 0 && S.agents.length < S.cap && n < 200) {
        const a = G.mkAgent(o.x + (R() - 0.5) * 50, o.y - 6 + (R() - 0.5) * 16, 0); a.hx = a.wx = a.x; a.hy = a.wy = a.y; S.agents.push(a); G.convert(a, t.id, false); o.bank--; n++;
      }
      if (!n) return 0;
      S.ev.millPaid[t.id] += n; S.ev.millCollects++;
      if (t.isPlayer && !S.aiPlayer && !raid) G.banner("MILL · +" + n, t.color, 1.6, t.id, 1);
      return n;
    }
    // a site changes hands (SPEC-v3 §3). why "ring": a captor takes the bank (raid); "rout": a rout next to it hands it over, bank and all.
    // The captor knows its own site live (kt); nobody else learns of it until they see it. Logged in S.ev.sites [t, team, from, why, paid].
    function takeSite(o, t, why) {
      const from = o.owner; o.owner = t.id; o.kt[t.id] = t.id; o.holdTeam = 0; o.prog = 0; o.colT = 0; o.bankT = 0;
      const paid = why === "ring" ? payOut(o, t, true) : 0; o.kb[t.id] = o.bank;
      S.ev.sites.push([+S.t.toFixed(1), t.id, from, why, paid]);
      const NM = o.site === "stockade" ? "STOCKADE" : "MILL"; o.fireT = 0;
      if (t.isPlayer && !S.aiPlayer) { G.banner(NM + " TAKEN" + (paid ? " · +" + paid : ""), t.color, 2.2, t.id, 2); if (o.site === "stockade" && !S._hintStockade) S._hintStockade = 1; }
      else if (from === 1 && G.playerSees(o.x, o.y)) G.banner(NM + " LOST", "#FF7A6E", 2.2, 0, 2);
      else if (G.playerSees(o.x, o.y)) G.banner(t.name.toUpperCase() + " TAKES A " + NM, t.color, 1.8, 0, 0);
    }
    // ---------------------------------------------------------------- v3 M3b: forges, stockades, the trains hook (SPEC-v3 §3)
    // a forge has no owner. It sells each team its next tier on o.axis (tier II at most: forge.prices has one price per tier) for that many
    // peasants when (forge.needTarget) the team's route target lies inside the ring, >= price of its agents stand in it and paying leaves
    // >= forge.minShare of its count, all held forge.hold s (a scan-tick clock per team, teams in id order). forge.shareFloor > 0 raises
    // the price to that share of the team (a leader tax; 0 = off). One sale at a time: the payers walk in over forge.payWalk s, then grant().
    const priceOf = (t, o) => { const F = ST().forge, k = t.tier ? t.tier[o.axis] : 99; if (k >= F.prices.length || !canTake(t, o.axis, false)) return 0; return Math.max(F.prices[k], Math.ceil(F.shareFloor * t.count)); };
    const floorOk = (t, price) => t.count - price >= ST().forge.minShare * t.count;
    const aimsAt = (t, o) => { const r = ST().forge.ring; return !ST().forge.needTarget || (t.tx - o.x) * (t.tx - o.x) + (t.ty - o.y) * (t.ty - o.y) <= r * r; };
    function forgeTick(o, sdt) {
      const F = ST().forge; ringCount(o.x, o.y, F.ring); o.have = TC[1];
      for (let i = 1; i < 7; i++) {
        const t = S.teams[i]; if (!t || !t.alive) { o.fh[i] = 0; continue; } const price = priceOf(t, o);
        if (o.agents.length || !price || TC[i] < price || !aimsAt(t, o) || !floorOk(t, price)) { o.fh[i] = 0; continue; }
        if ((o.fh[i] += sdt) >= F.hold) { o.fh[i] = 0; pay(o, t, price); }
      }
    }
    // the nearest price agents in the ring (ties by agent id) leave the sim at once (gar 2: out of the hash, the counts and every fight;
    // drawn walking to the door by payStep), so the team's count drops as it pays
    const PAY = [];
    function pay(o, t, price) {
      const r = ST().forge.ring, n = G.gather(o.x, o.y, r), NEAR = G.NEAR, r2 = r * r; PAY.length = 0;
      for (let k = 0; k < n; k++) { const b = NEAR[k]; if (b.team !== t.id || b.dead || b.gar || b.escapeT > 0) continue; const dx = b.x - o.x, dy = b.y - o.y, d2 = dx * dx + dy * dy; if (d2 < r2) { b.rd = d2; PAY.push(b); } }
      if (PAY.length < price) { PAY.length = 0; return; }
      PAY.sort((p, q) => p.rd - q.rd || p.id - q.id);
      for (let k = 0; k < price; k++) { const a = PAY[k]; a.gar = 2; a.tgt = null; a.fight = false; a.vx = a.vy = 0; a.hx = a.x; a.hy = a.y; o.agents.push(a); }
      PAY.length = 0; o.payT0 = S.t; o.payTeam = t.id; t.count -= price;
      if (t.isPlayer && !S.aiPlayer && G.fxOk(o.x, o.y)) PS.audio.chest();
    }
    // the pay walk (render only: the payers are already out of the sim): into the door over forge.payWalk s, then removed and the tier granted
    function payStep(o, dt) {
      const W = ST().forge.payWalk, f = W > 0 ? (S.t - o.payT0) / W : 1, dx = o.x, dy = o.y - 8;
      if (f < 1) { for (const a of o.agents) { a.x = a.hx + (dx - a.hx) * f; a.y = a.hy + (dy - a.hy) * f; a.ph += dt * 9; a.face = dx >= a.hx ? 1 : -1; } return; }
      const t = S.teams[o.payTeam], paid = o.agents.length; for (const a of o.agents) a.dead = true; o.agents.length = 0;
      if (!t || !grant(t, o.axis, false, "forge", o.x, o.y, paid)) return;
      S.ev.forge.push([+S.t.toFixed(1), t.id, o.axis, t.tier[o.axis], paid]);
      if (G.fxOk(o.x, o.y)) G.burst(o.x, o.y - 20, S.spr.spoils.relics[o.axis].color, 14, 120, 0.6, 3, 160);
    }
    // a cleared bandit camp becomes a stockade owned by t (the team that landed the last hit; none: a neutral stockade). The captor knows it live
    function toStockade(o, t) {
      o.site = "stockade"; o.owner = t ? t.id : 0; o.bank = 0; o.fireT = 0; o.holdTeam = 0; o.prog = 0; if (t) o.kt[t.id] = t.id;
      S.ev.sites.push([+S.t.toFixed(1), o.owner, 8, "clear", 0]);
      if (t && t.isPlayer && !S.aiPlayer && !S._hintStockade) S._hintStockade = 1;
    }
    // a stockade (SPEC-v3 §3): captured by the ring hold at stockade.captureMin, never while an owner agent stands in the ring; from
    // stockade.activeAfter s of match time it shoots every stockade.every s (a scan-tick clock) at the nearest rival agent within stockade.range
    // (teams 1-6 but its owner; never a remnant, a neutral, a bandit or a payer), engaged agents first, then the agent it shot last while it
    // stays valid (focus fire: kills land at about the spec's 3 in 10 s rather than chip damage spread over a jostling blob), then the
    // nearest, ties by agent id. stockade.damage a
    // shot, landed at once (the arrow is drawn, never simulated); a kill is credited to the owner and never converts. Not a team: it enters
    // no engagement pair, so it cannot start or break a fight; its kills thin whatever rout group the victim stands in.
    function stockTick(o, sdt) {
      const K = ST().stockade, t = o.owner ? S.teams[o.owner] : null;
      const cap = holdStep(o, K.ring, K.captureMin, o.owner, sdt, o.owner); if (cap) { takeSite(o, S.teams[cap], "ring"); return; }
      if (!t || !t.alive || S.t < K.activeAfter) { o.fireT = 0; return; }
      if ((o.fireT += sdt) < K.every) return;
      const n = G.gather(o.x, o.y, K.range), NEAR = G.NEAR, r2 = K.range * K.range, last = o.shot; let best = null, bd = 0, be = 0, bl = 0;
      for (let k = 0; k < n; k++) {
        const b = NEAR[k], tm = b.team; if (tm < 1 || tm > 6 || tm === o.owner || b.dead || b.gar || b.escapeT > 0) continue;
        const dx = b.x - o.x, dy = b.y - o.y, d2 = dx * dx + dy * dy; if (d2 >= r2) continue; const e = b.fight ? 1 : 0, l = b === last ? 1 : 0; // focus: the last target keeps its place among its peers
        if (!best || e > be || (e === be && (l > bl || (l === bl && (d2 < bd || (d2 === bd && b.id < best.id)))))) { best = b; bd = d2; be = e; bl = l; }
      }
      o.shot = best;
      if (!best) { o.fireT = K.every; return; } // loaded: the next rival in range is shot on the next scan
      o.fireT -= K.every; S.ev.stockShots++; best.hp -= K.damage; best.fl = 0.16;
      if (G.playerSees(best.x, best.y) && G.onScreen(best.x, best.y)) arrowAdd(o.x, o.y - 30, best.x, best.y - 8, Math.sqrt(bd) / K.arrowSpeed);
      if (best.hp <= 0) { G.kill(best, o.owner); S.ev.stockKills++; }
    }
    // the drawn arrows: a fixed ring of stockade.arrowPool (typed arrays, sim-time stamped), drawn by drawOver while in flight
    let AR = null, arN = 0;
    function arrowsInit() { const n = cfgOf() && cfgOf().structures.stockade ? cfgOf().structures.stockade.arrowPool : 16; if (!AR || AR.length !== n * 6) AR = new Float32Array(n * 6); AR.fill(0); arN = 0; }
    function arrowAdd(x0, y0, x1, y1, dur) { const q = (arN++ % (AR.length / 6)) * 6; AR[q] = x0; AR[q + 1] = y0; AR[q + 2] = x1; AR[q + 3] = y1; AR[q + 4] = S.t; AR[q + 5] = Math.max(0.05, dur); }
    function drawArrows(ctx) {
      if (!AR || !arN) return; const T = S.t; let any = false;
      for (let q = 0; q < AR.length; q += 6) { const f = (T - AR[q + 4]) / AR[q + 5]; if (!(AR[q + 5] > 0) || f < 0 || f > 1) continue; if (!any) { ctx.strokeStyle = "#2A1C10"; ctx.lineWidth = 2; ctx.beginPath(); any = true; }
        const dx = AR[q + 2] - AR[q], dy = AR[q + 3] - AR[q + 1], l = Math.sqrt(dx * dx + dy * dy) || 1, x = AR[q] + dx * f, y = AR[q + 1] + dy * f - Math.sin(f * 3.1416) * l * 0.12; ctx.moveTo(x - (dx / l) * 8, y - (dy / l) * 8); ctx.lineTo(x, y); }
      if (any) ctx.stroke();
    }
    // the stockade's sight (SPEC-v3 §3): its owner stamps stockade.sight px round it into its own grid only, through the same LOS rule
    function sight(i) { if (!SON() || !(ST().stockade.sight > 0)) return; for (const o of S.objs) if (o.site === "stockade" && o.owner === i) PS.fog.stampAt(i, o.x, o.y, ST().stockade.sight, PS.knowledge); }
    // AI helpers (knowledge through kt, the owner each team last saw): rival stockades it has seen owned join its avoid list once they shoot;
    // its own stockade (live: it knows its own sites) within maxD that lies farther from the threat than it does (Wary's flight); the nearest
    // rival mill it has seen within sqrt(r2) (Sly's lurk). OS holds the spot.
    const OS = { x: 0, y: 0 };
    function avoidList(t, n, X, Y) {
      if (!SON() || S.t < ST().stockade.activeAfter) return n;
      for (const o of S.objs) { if (o.site !== "stockade" || n >= X.length) continue; const kt = o.kt[t.id]; if (kt < 1 || kt === t.id) continue; X[n] = o.x; Y[n++] = o.y; }
      return n;
    }
    function ownStockade(t, hx, hy, maxD) {
      if (!SON()) return false; const m2 = maxD * maxD, me = (t.ax - hx) * (t.ax - hx) + (t.ay - hy) * (t.ay - hy); let bd = Infinity;
      for (const o of S.objs) { if (o.site !== "stockade" || o.owner !== t.id) continue; const d = (o.x - t.ax) * (o.x - t.ax) + (o.y - t.ay) * (o.y - t.ay); if (d > m2 || (o.x - hx) * (o.x - hx) + (o.y - hy) * (o.y - hy) <= me || d >= bd) continue; bd = d; OS.x = o.x; OS.y = o.y; }
      return bd < Infinity;
    }
    function rivalMill(t, r2) {
      if (!SON()) return false; let bd = Infinity;
      for (const o of S.objs) { if (o.site !== "mill") continue; const kt = o.kt[t.id]; if (kt < 1 || kt === t.id) continue; const d = (o.x - t.ax) * (o.x - t.ax) + (o.y - t.ay) * (o.y - t.ay); if (d <= r2 && d < bd) { bd = d; OS.x = o.x; OS.y = o.y; } }
      return bd < Infinity;
    }
    // SPEC-v3 §3 trains hook: while t owns sites whose kind trains a type, the summed share of each new neutral recruit carries it (a per-team
    // accumulator, no S.rng draw), never past units.maxShare of the team (units.enabled false: nobody is tagged). Data only in M3b.
    const KINDS = { archer: 1 };
    function train(a, t) {
      const U = cfgOf().units; if (!SON() || !U.enabled) return; let sh = 0, kind = 0;
      for (const o of S.objs) { if (!o.site || o.owner !== t.id) continue; const tr = ST()[o.site].trains; if (tr && KINDS[tr.type]) { sh += tr.share; kind = KINDS[tr.type]; } }
      if (!sh) return; t.trainAcc += sh; if (t.trainAcc < 1) return; t.trainAcc -= 1;
      if (t.kindN + 1 > U.maxShare * (t.count + 1)) return; a.kind = kind; t.kindN++; S.ev.trained[t.id]++;
    }
    // SPEC-v3 §3 rout flip: a rout whose contact centroid lies within structures.routFlipRadius of a site the loser owns hands it to the winner
    function routFlip(loser, winner, cx, cy) {
      if (!SON()) return 0; const r2 = ST().routFlipRadius * ST().routFlipRadius; let n = 0;
      for (const o of S.objs) if (o.site && o.owner === loser.id && (o.x - cx) * (o.x - cx) + (o.y - cy) * (o.y - cy) <= r2) { takeSite(o, winner, "rout"); n++; }
      return n;
    }
    // SPEC-v3 §3 elimination (structures.neutralOnElim): the team's sites go neutral with nothing banked
    function onElim(t) {
      if (!SON() || !ST().neutralOnElim) return;
      for (const o of S.objs) if (o.site && o.owner === t.id) { o.owner = 0; o.bank = 0; o.bankT = 0; o.colT = 0; S.ev.sites.push([+S.t.toFixed(1), 0, t.id, "elim", 0]); }
    }
    // a village joins: its garrison walks out of the gate and converts through convert() (muster counts, rout rules), a cheer within
    // encampments.cheer px of your swarm whether you see it or not (a tell through the dark). v3: it stays as the joiner's mill (SPEC-v3 §3)
    function joinVillage(v, t) {
      v.live = false; v.owner = t.id; v.opened = S.t; taken(v, t);
      if (SON()) { v.site = "mill"; v.bank = 0; v.bankT = 0; v.colT = 0; v.holdTeam = 0; v.prog = 0; v.kt[t.id] = t.id; v.kb[t.id] = 0; if (t.isPlayer && !S.aiPlayer && !S._hintMill) S._hintMill = 1; }
      for (const a of v.agents) { if (a.dead || a.team !== 0) continue; a.gar = false; a.x = v.x + (S.rng() - 0.5) * 50; a.y = v.y - 6 + (S.rng() - 0.5) * 16; a.hx = a.wx = a.x; a.hy = a.wy = a.y; G.convert(a, t.id, false); }
      v.agents.length = 0;
      const pl = S.teams[1], ch = cfgOf().encampments.cheer;
      if (pl && pl.count > 0 && (v.x - pl.cx) * (v.x - pl.cx) + (v.y - pl.cy) * (v.y - pl.cy) <= ch * ch) PS.audio.cheer();
      if (t.isPlayer && !S.aiPlayer) G.banner("+" + v.gar + " VILLAGE JOINS YOU", t.color, 2.4, t.id, 2);
      else if (G.playerSees(v.x, v.y)) G.banner("A VILLAGE JOINS " + t.name.toUpperCase(), t.color, 1.8, 0, 0);
    }
    // a routed leader (the biggest swarm when it lost a rout group of at least progression.dropMinShare of itself) drops every tier as a relic
    // scattered progression.dropScatter px round the contact, each living progression.relicLife s; Arms drops may reach III
    function leaderDrop(t, cx, cy) {
      const PG = cfgOf().progression; let n = 0;
      for (const axis of AXES) for (let k = 0; k < t.tier[axis]; k++) { const a = S.rng() * Math.PI * 2, r = 30 + S.rng() * (PG.dropScatter - 30); relicAt(cx + Math.cos(a) * r, cy + Math.sin(a) * r, axis, axis === "arms", "drop", PG.relicLife); n++; }
      if (!n) return 0;
      t.tier.arms = t.tier.boots = t.tier.horn = 0; applyTiers(t, true); restyle(t); S.ev.drops += n;
      if (G.playerSees(cx, cy)) G.banner((t.isPlayer ? "YOU DROP " : t.name.toUpperCase() + " DROPS ") + n + (n > 1 ? " RELICS" : " RELIC"), "#F6CF6A", 2.2, 0, t.isPlayer ? 2 : 0);
      return n;
    }

    // ---------------------------------------------------------------- fog: what each team last saw at every objective (after each stamp)
    function observe(o) {
      for (const b of S.objs) {
        if (!PS.fog.seesCell(o, PS.fog.cellOf(b.x, b.y))) continue;
        b.kn[o] = b.live ? 1 : 0; if (b.site) { b.kt[o] = b.owner; b.kb[o] = b.bank; } // v3: owner and bank as last seen (SPEC-v3 §3)
        if (o === 1) { if (b.type === "forge" && !S._hintForge && !S.aiPlayer) S._hintForge = 1; const k = b.sk; k.seen = true; k.live = b.live; k.team = b.owner; k.n = b.site ? b.bank : b.type === "bandit" ? b.n : b.type === "village" ? b.gar : 0; }
      }
    }
    // AI forage (SPEC-v2 §7, §8): value / (path distance + 120) x the personality's treasure bias over the objectives within ai.objectiveSight it
    // believes are live (seen live, or a landmark it has not seen taken), feasible on count x power: village when count >= garrison, bandit
    // camp when count x power >= ai.banditFeasible x its bandits, a relic or chest it can use always. v3 mills (SPEC-v3 §3, the minimal M3a
    // objective; per-personality structBias is M3b): its own mill once the bank it knows reaches ai.millCollectAt (ai.objMill per banked
    // recruit), and a mill it has seen owned by someone else (or neutral) when count >= the need it saw (ai.objMill x that need).
    // Skips any within ai.campAvoidRadius of a swarm it sees at >= ai.campAvoidRatio x its own (VB list). Writes AP (score, x, y, obj).
    const AP = { score: 0, x: 0, y: 0, obj: null };
    // v3 probe lever ai.siteKnowRadius (0 = v2: every landmark known from the start): a landmark is known within that many px of the team's
    // spawn, else once the team has explored its cell
    function landKnown(t, o) {
      const R = cfgOf().ai.siteKnowRadius; if (!(R > 0)) return true; const sp = S.map.spawns[t.slot];
      if (sp && (sp.x - o.x) * (sp.x - o.x) + (sp.y - o.y) * (sp.y - o.y) <= R * R) return true; return PS.fog.explored(t.id, o.x, o.y);
    }
    // v3 M3b (SPEC-v3 §3): the personality's structBias {mill, forge, stockade} on each site kind. Forge: its next tier there when count >= price
    // x (1 + ai.forgeReserve) and paying keeps the floor, valued ai.objForge x (1 - rank x ai.forgeRankStep) by the axis's place in its
    // forgeAxes (an axis not listed: never). Stockade: one it has seen neutral or owned by someone else, when count >= captureMin (ai.objStockade;
    // only swarms, not stockades, are checked against the avoid list for it: nSw). Mill: its own at millCollectAt (Greedy: its own
    // millCollectAt within collectRange px; Wary: only with no clash heard within collectQuiet px); Bully weighs your mills by hatesPlayer;
    // Sly weighs a site stealBonus while it hears the owner it saw there fighting >= stealDist px away. ring(x, y): only sites inside it (Stubborn).
    function aiPick(t, dist, pw, bias, nVB, VBX, VBY, nSw, ring) {
      const AI = cfgOf().ai, P = t.ai || {}, SB = P.structBias, os2 = AI.objectiveSight * AI.objectiveSight, av2 = AI.campAvoidRadius * AI.campAvoidRadius; AP.score = 0; AP.obj = null;
      if (nSw == null) nSw = nVB;
      for (const o of S.objs) {
        const k = o.kn[t.id], kt = o.kt[t.id], forge = o.site === "forge";
        if (forge ? k !== 1 && !landKnown(t, o) : kt < 0 && (k === 0 || (k < 0 && !(o.landmark && landKnown(t, o))))) continue;
        const dx = o.x - t.ax, dy = o.y - t.ay; if (dx * dx + dy * dy > os2 || (ring && !ring(o.x, o.y))) continue;
        let v = 0, nv = nVB;
        if (forge) { const price = priceOf(t, o), rank = P.forgeAxes ? P.forgeAxes.indexOf(o.axis) : 0; if (!price || rank < 0 || t.count < price * (1 + AI.forgeReserve) || !floorOk(t, price)) continue; v = AI.objForge * (1 - rank * AI.forgeRankStep) * (SB ? SB.forge : 1); }
        else if (kt >= 0) { // a site it has seen as one (or took): its own live, any other as last seen
          if (!SON()) continue;
          if (o.site === "stockade") { if (kt === t.id || t.count < needOf(o, 0)) continue; v = AI.objStockade * (SB ? SB.stockade : 1); nv = nSw; }
          else {
            const bank = o.owner === t.id ? o.bank : o.kb[t.id];
            if (kt === t.id) { const at = P.millCollectAt && dist(o.x, o.y) <= P.collectRange ? P.millCollectAt : AI.millCollectAt; if (bank < at || (P.collectQuiet && G.heard(t, P.collectQuiet, 0))) continue; v = AI.objMill * bank; }
            else { const need = needOf(o, bank); if (t.count < need) continue; v = AI.objMill * need * (kt === 1 && t.kind === "bully" ? P.hatesPlayer : 1); }
            v *= SB ? SB.mill : 1;
          }
          if (P.stealDist && kt > 0 && kt !== t.id) { const q = G.heard(t, 1e9, kt); if (q && (q.x - o.x) * (q.x - o.x) + (q.y - o.y) * (q.y - o.y) >= P.stealDist * P.stealDist) v *= P.stealBonus; }
        }
        else if (o.type === "relic" || o.type === "chest") { if (!canTake(t, o.axis, o.t3)) continue; v = AI.objRelic; }
        else if (o.type === "village") { if (t.count < o.gar) continue; v = AI.objVillage * o.gar; }
        else if (o.type === "bandit") { if (pw < AI.banditFeasible * o.n0 || !canTake(t, o.axis, o.t3)) continue; v = AI.objBandit; }
        let skip = false; for (let q = 0; q < nv; q++) if ((VBX[q] - o.x) * (VBX[q] - o.x) + (VBY[q] - o.y) * (VBY[q] - o.y) < av2) { skip = true; break; }
        if (skip) continue;
        const sc = bias * v / (dist(o.x, o.y) + 120); if (sc > AP.score) { AP.score = sc; AP.x = o.x; AP.y = o.y; AP.obj = o; }
      }
      return AP.obj ? AP : null;
    }
    // knowledge assert (SPEC-v2 §7): an objective an AI targets must be a landmark or one it has seen live
    // v3 (SPEC-v3 §3): a site it targets as a mill (kt >= 0) is one it has seen as a mill or took itself (aiPick reads nothing else there)
    function knowObj(t, o) { const K = S.fogS.ai; K.decisions++; K.objectives++; if (o.kt[t.id] < 0 && !(o.landmark && landKnown(t, o)) && o.kn[t.id] !== 1) G.knowFail(t, o.type + " at " + Math.round(o.x) + "," + Math.round(o.y)); }

    // ---------------------------------------------------------------- render: ring and camp dirt under everything, props in the y-sort,
    // numbers over the agents. Under fog each objective shows only once you have seen it, in the state you last saw (sk).
    const vis = (o, gate) => !gate || PS.fog.sees(1, o.x, o.y);
    const inView = (o, x0, y0, x1, y1, m) => o.x > x0 - m && o.x < x1 + m && o.y > y0 - m - 80 && o.y < y1 + m;
    function drawGround(ctx, gate, x0, y0, x1, y1) {
      const EN = cfgOf().encampments, spr = S.spr;
      for (const o of S.objs) {
        if (!inView(o, x0, y0, x1, y1, 120) || (gate && !o.sk.seen && !vis(o, gate))) continue;
        const live = vis(o, gate) ? o.live : o.sk.live;
        if (o.type === "bandit") { const im = spr.camps[1]; ctx.drawImage(im, snapA(o.x) - im.width * 1.5, snapA(o.y) - im.height * 1.5, im.width * 3, im.height * 3); }
        const site = !live && SON() && (o.type === "village" || o.type === "bandit"), forge = o.type === "forge"; // v3: mill and stockade rings in the owner's colour as last seen; a forge's ring (SPEC-v3 §6)
        if (!forge && (o.type !== "village" || !live) && !site) continue;
        const r = forge ? ST().forge.ring : live ? EN.villageRing : o.type === "bandit" ? ST().stockade.ring : ST().mill.ring, tm = live || forge ? 0 : vis(o, gate) ? o.owner : o.sk.team;
        ctx.globalAlpha = 0.35; ctx.strokeStyle = tm && S.teams[tm] ? S.teams[tm].color : "#F1EEDF"; ctx.lineWidth = 2; ctx.setLineDash(RDASH); ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash(NODASH); ctx.globalAlpha = 1;
      }
    }
    const RDASH = [6, 6], NODASH = [], snapA = (v) => ((v * 0.5) | 0) * 2;
    function pushProps(DL, gate, x0, y0, x1, y1) { for (const o of S.objs) if (inView(o, x0, y0, x1, y1, 60) && (!gate || o.sk.seen || vis(o, gate))) DL.push(o); }
    function drawProp(ctx, o, gate) {
      const sp = S.spr.spoils, seen = vis(o, gate), live = seen ? o.live : o.sk.live, x = snapA(o.x), y = snapA(o.y), T = S.t;
      if (!seen) ctx.globalAlpha = 0.85;
      if (o.type === "village") { const im = sp.village[live ? 0 : 1]; ctx.drawImage(im, x - 48, y - 80, 96, 80); const tm = seen ? o.owner : o.sk.team; if (!live && tm && S.teams[tm]) { ctx.fillStyle = "#3E2A1C"; ctx.fillRect(x + 12, y - 58, 2, 28); ctx.fillStyle = S.teams[tm].color; ctx.fillRect(x + 14, y - 58, 12, 8); }
        if (!live && SON()) sails(ctx, x - 20, y - 56, seen && tm ? T * 1.6 + o.id : 0.4); } // v3 mill (SPEC-v3 §3, §6): sails turn while it works for an owner you see
      else if (o.type === "chest") { const im = sp.chest[live ? 0 : 1]; ctx.drawImage(im, x - 12, y - 18, 24, 20); if (live) { const ic = sp.relics[o.axis].icon; ctx.drawImage(ic, x - 8, y - 38 + (seen ? Math.round(Math.sin(T * 3 + o.id) * 2) : 0), 16, 16); if (seen && ((T * 1.3 + o.id) % 2) < 0.25) { ctx.fillStyle = "#FFF6D0"; ctx.fillRect(x + 4, y - 16, 2, 2); } } }
      else if (o.type === "relic") { ctx.drawImage(sp.scroll, x - 10, y - 14, 20, 16); const ic = sp.relics[o.axis].icon, bob = seen ? Math.round(Math.sin(T * 4 + o.id) * 3) : 0; if (seen) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(T * 5); ctx.fillStyle = sp.relics[o.axis].color; ctx.beginPath(); ctx.arc(x, y - 26 + bob, 14, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } ctx.drawImage(ic, x - 12, y - 38 + bob, 24, 24); }
      else if (o.type === "bandit") { const im = sp.tent; ctx.drawImage(im, x - 20, y - 30, 40, 32); if (live) { ctx.fillStyle = KCOL[o.kind]; ctx.fillRect(x - 1, y - 40, 8, 6); ctx.fillRect(x - 1, y - 34, 4, 2); }
        else if (SON()) { const tm = seen ? o.owner : o.sk.team; stockade(ctx, x, y, tm && S.teams[tm] ? S.teams[tm].color : "#B8A88A"); } } // v3 stockade (SPEC-v3 §6): palisade + pennant
      else if (o.type === "forge") { forgeArt(ctx, x, y, sp.relics[o.axis].icon, seen && o.agents.length > 0); }
      ctx.globalAlpha = 1;
    }
    // v3 M3b art, primitives only (no new atlas; render only, no allocation): the stockade's stakes round the tent with a pennant in the
    // owner's colour, and the forge (a stone hut, anvil and chimney, its axis icon above; the hearth glows while payers walk in)
    function stockade(ctx, x, y, col) {
      for (let k = 0; k < 12; k++) { const a = k * 0.5236 + 0.26, sx = x + Math.cos(a) * 30, sy = y - 6 + Math.sin(a) * 18; if (sy > y + 4 && Math.abs(sx - x) < 8) continue; ctx.fillStyle = "#2A1C10"; ctx.fillRect(sx - 3, sy - 16, 6, 18); ctx.fillStyle = "#8A6038"; ctx.fillRect(sx - 2, sy - 16, 3, 16); }
      ctx.fillStyle = "#3E2A1C"; ctx.fillRect(x + 16, y - 52, 2, 34); ctx.fillStyle = col; ctx.fillRect(x + 18, y - 52, 14, 9);
    }
    function forgeArt(ctx, x, y, icon, hot) {
      ctx.fillStyle = "#2A1C10"; ctx.fillRect(x - 24, y - 30, 48, 32); ctx.fillStyle = "#6E6A62"; ctx.fillRect(x - 22, y - 28, 44, 28); ctx.fillStyle = "#4A4640"; ctx.fillRect(x - 26, y - 36, 52, 8); ctx.fillRect(x + 10, y - 48, 8, 14);
      ctx.fillStyle = hot ? "#FFB347" : "#C0502C"; ctx.fillRect(x - 8, y - 18, 16, 18); ctx.fillStyle = "#1E1A16"; ctx.fillRect(x - 20, y - 8, 10, 4); ctx.fillRect(x - 18, y - 4, 6, 4);
      ctx.drawImage(icon, x - 12, y - 66, 24, 24);
    }
    // the mill's four sails on the left hut's roof (render only, no allocation): a dark stroke under a light one
    function sails(ctx, hx, hy, a) {
      ctx.lineCap = "butt";
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? "#E8DCC0" : "#2A1C10"; ctx.lineWidth = pass ? 3 : 5; ctx.beginPath();
        for (let k = 0; k < 4; k++) { const b = a + k * 1.5708, c = Math.cos(b), s2 = Math.sin(b); ctx.moveTo(hx + c * 3, hy + s2 * 3); ctx.lineTo(hx + c * 17, hy + s2 * 17); }
        ctx.stroke();
      }
      ctx.fillStyle = "#3E2A1C"; ctx.fillRect(hx - 2, hy - 2, 4, 4);
    }
    // numbers over the agents: the garrison on a village gate, bandits left in a camp; all last-seen under fog. Your village progress arcs
    // while you hold the ring. v3 mill (SPEC-v3 §3): your own shows its bank in your colour (your collect arc while you stand in it); anyone
    // else's shows the need a rival faces, max(guardMin, bank), with your capture arc.
    function drawOver(ctx, gate, x0, y0, x1, y1) {
      const EN = cfgOf().encampments; drawArrows(ctx); ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center";
      for (const o of S.objs) {
        if (o.type === "relic" || o.type === "chest" || !inView(o, x0, y0, x1, y1, 60)) continue;
        const seen = vis(o, gate); if (gate && !seen && !o.sk.seen) continue; const live = seen ? o.live : o.sk.live;
        let txt = "", col = "#F1EEDF", ly = o.y - 8;
        if (o.type === "forge") { // v3 forge (SPEC-v3 §6): your next price here (greyed "TOO FEW" under the floor, "MAX" at tier II), your hold arc
          const p = S.teams[1], F = ST().forge, price = p && p.tier ? priceOf(p, o) : 0, few = price > 0 && !floorOk(p, price); ly = o.y + 22;
          txt = !price ? "MAX" : few ? price + " · TOO FEW" : String(price); col = !price || few ? "#9A968C" : "#F6CF6A";
          if (seen && o.fh[1] > 0) arc(ctx, o.x, o.y, F.ring, o.fh[1] / F.hold, p.color);
        }
        else if (!live && o.type === "bandit") { // v3 stockade: a rival's (or a neutral one) shows the need, with your capture arc; your own shows nothing
          if (!SON()) continue; const tm = seen ? o.owner : o.sk.team; if (tm === 1) continue; txt = String(needOf(o, 0)); ly = o.y + 22;
          if (seen && o.holdTeam === 1 && o.prog > 0) arc(ctx, o.x, o.y, ST().stockade.ring, o.prog, S.teams[1].color);
        }
        else if (!live) {
          if (o.type !== "village" || !SON()) continue;
          const M = ST().mill, tm = seen ? o.owner : o.sk.team, bank = seen ? o.bank : o.sk.n; ly = o.y + 22;
          if (tm === 1) { txt = String(bank); col = S.teams[1].color; if (seen && o.colT > 0) arc(ctx, o.x, o.y, M.ring, o.colT / M.collectHold, S.teams[1].color); }
          else { txt = String(needOf(o, bank)); if (seen && o.holdTeam === 1 && o.prog > 0) arc(ctx, o.x, o.y, M.ring, o.prog, S.teams[1].color); }
        }
        else if (o.type === "village") { txt = String(o.gar); ly = o.y - 14; if (seen && o.holdTeam === 1 && o.prog > 0) arc(ctx, o.x, o.y, EN.villageRing, o.prog, S.teams[1].color); }
        else if (o.type === "bandit") { txt = String(seen ? o.n : o.sk.n); col = KCOL[o.kind]; ly = o.y + 16; }
        if (!txt) continue;
        const w = ctx.measureText(txt).width + 10; ctx.globalAlpha = seen ? 0.95 : 0.6; ctx.fillStyle = "rgba(8,14,6,.8)"; ctx.fillRect(o.x - w / 2, ly - 12, w, 16); ctx.fillStyle = col; ctx.fillText(txt, o.x, ly); ctx.globalAlpha = 1;
      }
    }
    function arc(ctx, x, y, r, f, col) { ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, f)); ctx.stroke(); ctx.globalAlpha = 1; }
    // the minimap: objectives you have seen, in the state you last saw them
    function minimap(mctx, k, gate) {
      for (const o of S.objs) {
        if (gate && !o.sk.seen && !vis(o, gate)) continue; const live = vis(o, gate) ? o.live : o.sk.live, x = (o.x * k) | 0, y = (o.y * k) | 0;
        if (o.type === "village") { const tm = vis(o, gate) ? o.owner : o.sk.team; mctx.fillStyle = "#15110C"; mctx.fillRect(x - 3, y - 3, 6, 6); mctx.fillStyle = !live && tm && S.teams[tm] ? S.teams[tm].color : "#B08A48"; mctx.fillRect(x - 2, y - 2, 4, 4); }
        else if (o.type === "forge") { mctx.fillStyle = "#15110C"; mctx.fillRect(x - 3, y - 3, 7, 7); mctx.fillStyle = S.spr.spoils.relics[o.axis].color; mctx.fillRect(x - 2, y - 2, 5, 5); }
        else if (!live && o.type === "bandit" && SON()) { const tm = vis(o, gate) ? o.owner : o.sk.team; mctx.fillStyle = "#15110C"; mctx.fillRect(x - 3, y - 3, 6, 6); mctx.fillStyle = tm && S.teams[tm] ? S.teams[tm].color : "#8A6038"; mctx.fillRect(x - 2, y - 2, 4, 4); }
        else if (!live) continue;
        else if (o.type === "bandit") { mctx.fillStyle = "#15110C"; mctx.fillRect(x - 3, y - 3, 6, 6); mctx.fillStyle = KCOL[o.kind]; mctx.fillRect(x - 2, y - 2, 4, 4); }
        else { mctx.fillStyle = "#15110C"; mctx.fillRect(x - 2, y - 2, 5, 5); mctx.fillStyle = S.spr.spoils.relics[o.axis].color; mctx.fillRect(x - 1, y - 1, 3, 3); }
      }
    }
    // the banner bearer's horn (Horn I-II) and dust puffs from Boots (a few per second at the feet of a moving swarm you can see)
    function drawHorn(ctx, t, x, top) { if (!t.tier || !t.tier.horn) return; const h = S.spr.spoils.bannerHorn; ctx.drawImage(h, snapA(x) - 18, snapA(top) + 10, h.width * 2, h.height * 2); }
    let dustT = 0;
    function dust(dt) {
      if ((dustT -= dt) > 0) return; dustT = 0.12;
      for (const t of G.swarms()) { if (!t.alive || !t.tier || !t.tier.boots || t.count < 3 || t.vx * t.vx + t.vy * t.vy < 900) continue; const a = S.agents[(Math.random() * S.agents.length) | 0]; if (a && a.team === t.id && G.fxOk(a.x, a.y) && a.seenA > 0.5) G.puff(a.x, a.y); }
    }

    // ---------------------------------------------------------------- HUD: the relic strip (bottom-left, above the timed buffs): one icon per
    // axis with its tier pips, dimmed at 0; canvases painted from the sprite icons only when a tier changes (never read back)
    let hudKey = "", hudEls = null;
    function hud(force) {
      const el = G.$("relics"), t = S.teams[1]; if (!el || !t || !t.tier) return;
      const key = t.tier.arms + "," + t.tier.boots + "," + t.tier.horn; if (!force && key === hudKey && hudEls) return; hudKey = key;
      if (!hudEls || force) {
        el.innerHTML = ""; hudEls = {};
        for (const axis of AXES) {
          const d = document.createElement("div"); d.className = "relic"; d.id = "relic-" + axis; const cv = document.createElement("canvas"); cv.width = 24; cv.height = 24;
          const g = cv.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(S.spr.spoils.relics[axis].icon, 0, 0, 24, 24);
          const pips = document.createElement("div"); pips.className = "pips"; d.appendChild(cv); d.appendChild(pips); el.appendChild(d); hudEls[axis] = { d, pips };
        }
      }
      const PG = cfgOf().progression;
      for (const axis of AXES) {
        const e = hudEls[axis], lvl = t.tier[axis], max = axis === "arms" ? PG.armsMax : capOf(axis, false); let h = "";
        for (let i = 0; i < max; i++) h += "<i" + (i < lvl ? " class='on' style='background:" + S.spr.spoils.relics[axis].color + "'" : "") + "></i>";
        e.pips.innerHTML = h; e.d.classList.toggle("on", lvl > 0);
      }
    }

    // ---------------------------------------------------------------- the player's fog-honest view (PS.vis.objectives: the harness bot's input)
    function playerView() {
      const out = [], gate = G.fogGate();
      for (const o of S.objs) {
        const v = vis(o, gate); if (gate && !v && !o.sk.seen) continue; const live = v ? o.live : o.sk.live;
        const mill = !live && o.type === "village" && SON(), owner = mill ? (v ? o.owner : o.sk.team) : 0, bank = mill ? (v ? o.bank : o.sk.n) : 0; // v3: a mill as last seen (SPEC-v3 §3)
        const stock = !live && o.type === "bandit" && SON(), sOwner = stock ? (v ? o.owner : o.sk.team) : 0, p = S.teams[1], price = o.type === "forge" && p && p.tier ? priceOf(p, o) : 0; // v3 M3b: a stockade as last seen, a forge's price for you
        out.push({ type: o.type, x: Math.round(o.x), y: Math.round(o.y), live, visible: v, axis: o.axis, t3: o.t3, need: mill ? (owner === 1 ? 0 : needOf(o, bank)) : stock ? (sOwner === 1 ? 0 : needOf(o, 0)) : o.type === "village" ? o.gar : o.type === "bandit" ? (v ? o.n : o.sk.n) : 0, kind: o.kind, mill, owner: stock ? sOwner : owner, bank,
          stockade: stock, price, tooFew: price > 0 && !floorOk(p, price) });
      }
      return out;
    }
    const tierSum = (t) => (t && t.tier ? t.tier.arms + t.tier.boots + t.tier.horn : 0);
    return { stage, reset, initTeam, applyTiers, grant, canTake, onConvert, place, blocks, relicAt, tick, leaderDrop, observe, aiPick, knowObj, drawGround, pushProps, drawProp, drawOver,
      minimap, drawHorn, dust, hud, playerView, tierSum, tables, restyle, joinVillage, holdStep, takeSite, routFlip, onElim, needOf, AXES, KCOL,
      sight, avoidList, ownStockade, rivalMill, OS, priceOf, floorOk, toStockade, arrowCount: () => { let n = 0; if (AR) for (let q = 0; q < AR.length; q += 6) { const f = (S.t - AR[q + 4]) / AR[q + 5]; if (AR[q + 5] > 0 && f >= 0 && f <= 1) n++; } return n; } };
  };
})();
