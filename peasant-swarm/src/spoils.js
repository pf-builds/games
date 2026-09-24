// Peasant Swarm — spoils (SPEC-v2 §8). Click it! Studios, 2026.
// Three permanent team-wide axes (Arms I-III, Boots I-II, Horn I-II) and where they come from: muster milestones, six fixed chests at dead
// ends, a trickle chest every progression.trickleChestEvery s after 1:00, heavy chests behind a size gate, bandit camps, and a routed
// leader's drops. Villages whose garrison joins you. Bandits are agents with team id 8 that live in S.bandits (never in S.teams); game.js
// steers them in its agent loop. Every objective (chest, heavy chest, village, bandit camp, ground relic) is one record in S.objs with the
// same shape: x, y, live, landmark (a site every AI knows from the start, state unknown until seen), kn[team] (what each team last saw there:
// -1 never, 0 gone, 1 live) and sk (the player's last-seen state, drawn under fog). All tuning in config.progression and config.encampments.
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
      kind: 0, n0: 0, n: 0, lastHit: 0, fn: 0, fx: 0, fy: 0, vs: 0, opened: -1, sk: { seen: false, live: true, n: 0, team: 0 } });
    function reset() { S.objs = []; S.bandits = []; S.spT = 0; nextId = 1; }

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
    function grant(t, axis, t3, why, x, y) {
      if (!canTake(t, axis, t3)) return false;
      t.tier[axis]++; applyTiers(t, true); if (axis === "arms") restyle(t);
      const lvl = t.tier[axis], name = AXNAME[axis] + " " + ROMAN[lvl], col = S.spr.spoils.relics[axis].color;
      S.ev.gains.push([+S.t.toFixed(1), t.id, axis, lvl, why]);
      if (t.isPlayer && !S.aiPlayer) {
        G.banner((why === "muster" ? "MUSTER " + cfgOf().progression.muster[t.musterK] + ": " : "") + name, col, 2.4, 0, 2);
        G.floater(t.cx, t.cy - 34, "+" + name, col, 16, 1.4); if (why === "muster") PS.audio.fanfare(); else PS.audio.relic();
      } else if (G.fxOk(t.ax, t.ay) && G.seenSwarm(t.id)) G.floater(t.ax, t.ay - 40, "+" + name, t.color, 13, 1.2);
      return true;
    }
    // muster milestones (progression.muster, absorbed rivals excluded): neutrals recruited through convert() count
    function onConvert(a, t, from, absorbed) {
      if (from !== 0 || absorbed || a.exr) { a.exr = false; return; }
      t.mustered++; const M = cfgOf().progression.muster, MA = cfgOf().progression.musterAxes;
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
    // for placeOk (trickle camps and power-ups): not inside a bandit camp's reach nor on a village or heavy chest
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
        if (best < 0) continue;
        mkCamp(((best % N) + 0.5) * cell, (((best / N) | 0) + 0.5) * cell, kind, EN.banditSizes[kind], kind === 0 ? (R() < 0.5 ? "boots" : "horn") : "arms");
      }
      // heavy chests (encampments.heavy weights): path distance to the nearest spawn in encampments.heavyDist, spread out
      for (const w of EN.heavy) {
        let best = null, bs = -1;
        for (let s = 0; s < 60; s++) {
          const c = P.open3[(R() * P.open3.length) | 0], x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell;
          if (TB.dmin[c] < EN.heavyDist[0] || TB.dmin[c] > EN.heavyDist[1] || !T.placementOk(x, y, 3) || !clearAt(x, y, EN.objectGap)) continue;
          let sc = 1e12; for (const o of S.objs) { const d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y); if (d < sc) sc = d; }
          if (sc > bs) { bs = sc; best = [x, y]; }
        }
        if (!best) continue;
        const h = mkObj("heavy", best[0], best[1], true); h.weight = w; h.axis = pickAxis(); S.objs.push(h);
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
    // QA and art scenes: one objective of type at (x, y) in the current world (fixture maps have no placement). o: { gar, weight, kind, n, axis, t3 }
    function stage(type, x, y, o) {
      o = o || {};
      if (type === "village") return mkVillage(x, y, o.gar || 12);
      if (type === "bandit") return mkCamp(x, y, o.kind || 0, o.n || cfgOf().encampments.banditSizes[o.kind || 0], o.axis || "arms");
      if (type === "relic") return relicAt(x, y, o.axis || "arms", !!o.t3, "qa", o.life || Infinity);
      const b = mkObj(type, x, y, o.landmark !== false); b.axis = o.axis || "arms"; b.src = "qa"; if (type === "heavy") b.weight = o.weight || 15; S.objs.push(b); return b;
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
      for (let i = S.objs.length - 1; i >= 0; i--) {
        const o = S.objs[i];
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
          const rc = ringCount(o.x, o.y, EN.villageRing), lead = rc & 0xffff, rival = rc >> 16, have = lead ? TC[lead] : 0; o.have = have;
          if (!lead) { o.holdTeam = 0; o.prog = 0; continue; }
          if (lead !== o.holdTeam) { o.holdTeam = lead; o.prog = 0; }
          if (have >= o.gar) o.prog = 1; else if (!rival) o.prog += sdt / Math.max(EN.villageMin, EN.villageStep * (o.gar - have)); // a rival in the ring pauses the timer
          if (o.prog >= 1) joinVillage(o, S.teams[lead]);
        } else if (o.type === "heavy" && scan) {
          const rc = ringCount(o.x, o.y, EN.heavyRing), lead = rc & 0xffff, have = lead ? TC[lead] : 0; o.have = have;
          if (have >= o.weight && lead === o.holdTeam) o.hold += sdt; else { o.holdTeam = have >= o.weight ? lead : 0; o.hold = 0; }
          if (o.hold >= EN.heavyHold) openHeavy(o, S.teams[lead]);
        } else if (o.type === "bandit") {
          if (o.fn > 0) { const x = o.fx / o.fn, y = o.fy / o.fn; G.noiseAt(8, o.vs, x, y); if (S.fogOn && o.vs !== 1 && !PS.fog.sees(1, x, y)) G.clashPing(x, y, false); } // bandit fights make clash noise (SPEC-v2 §5, §7)
          o.fn = 0; o.fx = 0; o.fy = 0;
          if (o.n <= 0) { o.live = false; o.opened = S.t; const t = S.teams[o.lastHit]; if (t) taken(o, t); relicAt(o.x, o.y, o.axis, o.t3, "bandit", Infinity);
            if (t && t.isPlayer && !S.aiPlayer) { G.banner(KIND[o.kind] + " CAMP CLEARED", KCOL[o.kind], 2.2, 0, 2); PS.audio.chest(); } else if (G.playerSees(o.x, o.y)) G.banner((t ? t.name.toUpperCase() : "BANDITS") + " CLEARED A CAMP", t ? t.color : "#F1EEDF", 1.8, 0, 0); }
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
    // a village joins: its garrison walks out of the gate and converts through convert() (muster counts, rout rules), a cheer within
    // encampments.cheer px of your swarm whether you see it or not (a tell through the dark)
    function joinVillage(v, t) {
      v.live = false; v.owner = t.id; v.opened = S.t; taken(v, t);
      for (const a of v.agents) { if (a.dead || a.team !== 0) continue; a.gar = false; a.x = v.x + (S.rng() - 0.5) * 50; a.y = v.y - 6 + (S.rng() - 0.5) * 16; a.hx = a.wx = a.x; a.hy = a.wy = a.y; G.convert(a, t.id, false); }
      v.agents.length = 0;
      const pl = S.teams[1], ch = cfgOf().encampments.cheer;
      if (pl && pl.count > 0 && (v.x - pl.cx) * (v.x - pl.cx) + (v.y - pl.cy) * (v.y - pl.cy) <= ch * ch) PS.audio.cheer();
      if (t.isPlayer && !S.aiPlayer) G.banner("+" + v.gar + " VILLAGE JOINS YOU", t.color, 2.4, t.id, 2);
      else if (G.playerSees(v.x, v.y)) G.banner("A VILLAGE JOINS " + t.name.toUpperCase(), t.color, 1.8, 0, 0);
    }
    // a heavy chest opens for the team that held weight peasants in its ring for heavyHold s: weight < encampments.heavyPick2 grants its relic;
    // heavier ones lay two relics of different axes on the ground, and the first one walked onto takes the pair
    function openHeavy(h, t) {
      const EN = cfgOf().encampments; h.live = false; h.opened = S.t; h.owner = t.id; taken(h, t);
      if (h.weight < EN.heavyPick2) grant(t, h.axis, false, "heavy", h.x, h.y);
      else {
        const k = AXES.indexOf(h.axis), b = AXES[(k + 1 + ((S.rng() * 2) | 0)) % 3], r1 = relicAt(h.x - 34, h.y + 26, h.axis, false, "heavy", Infinity), r2 = relicAt(h.x + 34, h.y + 26, b, false, "heavy", Infinity);
        r1.pair = r2; r2.pair = r1; r1.kn[t.id] = r2.kn[t.id] = 1;
        if (t.isPlayer && !S.aiPlayer) G.banner("PICK ONE", "#F6CF6A", 2, 0, 2);
      }
      if (G.fxOk(h.x, h.y)) { G.burst(h.x, h.y - 10, "#F6CF6A", 18, 140, 0.7, 3, 160); PS.audio.chest(); }
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
        b.kn[o] = b.live ? 1 : 0;
        if (o === 1) { const k = b.sk; k.seen = true; k.live = b.live; k.team = b.owner; k.n = b.type === "bandit" ? b.n : b.type === "village" ? b.gar : b.type === "heavy" ? b.have : 0; }
      }
    }
    // AI forage (SPEC-v2 §7, §8): value / (path distance + 120) x the personality's treasure bias over the objectives within ai.objectiveSight it
    // believes are live (seen live, or a landmark it has not seen taken), feasible on count x power: village when count >= garrison, bandit
    // camp when count x power >= ai.banditFeasible x its bandits, heavy chest when count >= weight, a relic or chest it can use always.
    // Skips any within ai.campAvoidRadius of a swarm it sees at >= ai.campAvoidRatio x its own (VB list). Writes AP (score, x, y, obj).
    const AP = { score: 0, x: 0, y: 0, obj: null };
    function aiPick(t, dist, pw, bias, nVB, VBX, VBY) {
      const AI = cfgOf().ai, os2 = AI.objectiveSight * AI.objectiveSight, av2 = AI.campAvoidRadius * AI.campAvoidRadius; AP.score = 0; AP.obj = null;
      for (const o of S.objs) {
        const k = o.kn[t.id]; if (k === 0 || (k < 0 && !o.landmark)) continue;
        const dx = o.x - t.ax, dy = o.y - t.ay; if (dx * dx + dy * dy > os2) continue;
        let v = 0;
        if (o.type === "relic" || o.type === "chest") { if (!canTake(t, o.axis, o.t3)) continue; v = AI.objRelic; }
        else if (o.type === "village") { if (t.count < o.gar) continue; v = AI.objVillage * o.gar; }
        else if (o.type === "heavy") { if (t.count < o.weight || !canTake(t, o.axis, false)) continue; v = AI.objHeavy; }
        else if (o.type === "bandit") { if (pw < AI.banditFeasible * o.n0 || !canTake(t, o.axis, o.t3)) continue; v = AI.objBandit; }
        let skip = false; for (let q = 0; q < nVB; q++) if ((VBX[q] - o.x) * (VBX[q] - o.x) + (VBY[q] - o.y) * (VBY[q] - o.y) < av2) { skip = true; break; }
        if (skip) continue;
        const sc = bias * v / (dist(o.x, o.y) + 120); if (sc > AP.score) { AP.score = sc; AP.x = o.x; AP.y = o.y; AP.obj = o; }
      }
      return AP.obj ? AP : null;
    }
    // knowledge assert (SPEC-v2 §7): an objective an AI targets must be a landmark or one it has seen live
    function knowObj(t, o) { const K = S.fogS.ai; K.decisions++; K.objectives++; if (!o.landmark && o.kn[t.id] !== 1) G.knowFail(t, o.type + " at " + Math.round(o.x) + "," + Math.round(o.y)); }

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
        if (!live || (o.type !== "village" && o.type !== "heavy")) continue;
        const r = o.type === "village" ? EN.villageRing : EN.heavyRing;
        ctx.globalAlpha = 0.35; ctx.strokeStyle = "#F1EEDF"; ctx.lineWidth = 2; ctx.setLineDash(RDASH); ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash(NODASH); ctx.globalAlpha = 1;
      }
    }
    const RDASH = [6, 6], NODASH = [], snapA = (v) => ((v * 0.5) | 0) * 2;
    function pushProps(DL, gate, x0, y0, x1, y1) { for (const o of S.objs) if (inView(o, x0, y0, x1, y1, 60) && (!gate || o.sk.seen || vis(o, gate))) DL.push(o); }
    function drawProp(ctx, o, gate) {
      const sp = S.spr.spoils, seen = vis(o, gate), live = seen ? o.live : o.sk.live, x = snapA(o.x), y = snapA(o.y), T = S.t;
      if (!seen) ctx.globalAlpha = 0.85;
      if (o.type === "village") { const im = sp.village[live ? 0 : 1]; ctx.drawImage(im, x - 48, y - 80, 96, 80); const tm = seen ? o.owner : o.sk.team; if (!live && tm && S.teams[tm]) { ctx.fillStyle = "#3E2A1C"; ctx.fillRect(x + 12, y - 58, 2, 28); ctx.fillStyle = S.teams[tm].color; ctx.fillRect(x + 14, y - 58, 12, 8); } }
      else if (o.type === "chest") { const im = sp.chest[live ? 0 : 1]; ctx.drawImage(im, x - 12, y - 18, 24, 20); if (live) { const ic = sp.relics[o.axis].icon; ctx.drawImage(ic, x - 8, y - 38 + (seen ? Math.round(Math.sin(T * 3 + o.id) * 2) : 0), 16, 16); if (seen && ((T * 1.3 + o.id) % 2) < 0.25) { ctx.fillStyle = "#FFF6D0"; ctx.fillRect(x + 4, y - 16, 2, 2); } } }
      else if (o.type === "heavy") { const im = sp.heavy[live ? 0 : 1]; ctx.drawImage(im, x - 18, y - 26, 36, 28); if (live) { const ic = sp.relics[o.axis].icon; ctx.drawImage(ic, x - 8, y - 46, 16, 16); } }
      else if (o.type === "relic") { ctx.drawImage(sp.scroll, x - 10, y - 14, 20, 16); const ic = sp.relics[o.axis].icon, bob = seen ? Math.round(Math.sin(T * 4 + o.id) * 3) : 0; if (seen) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(T * 5); ctx.fillStyle = sp.relics[o.axis].color; ctx.beginPath(); ctx.arc(x, y - 26 + bob, 14, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } ctx.drawImage(ic, x - 12, y - 38 + bob, 24, 24); }
      else if (o.type === "bandit") { const im = sp.tent; ctx.drawImage(im, x - 20, y - 30, 40, 32); if (live) { ctx.fillStyle = KCOL[o.kind]; ctx.fillRect(x - 1, y - 40, 8, 6); ctx.fillRect(x - 1, y - 34, 4, 2); } }
      ctx.globalAlpha = 1;
    }
    // numbers over the agents: the garrison on a village gate, "have/need" on a heavy chest ring (your count once you stand in it), bandits
    // left in a camp; all last-seen under fog. Your village and heavy-chest progress arcs while you hold the ring.
    function drawOver(ctx, gate, x0, y0, x1, y1) {
      const EN = cfgOf().encampments; ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center";
      for (const o of S.objs) {
        if (o.type === "relic" || o.type === "chest" || !inView(o, x0, y0, x1, y1, 60)) continue;
        const seen = vis(o, gate); if (gate && !seen && !o.sk.seen) continue; const live = seen ? o.live : o.sk.live; if (!live) continue;
        let txt = "", col = "#F1EEDF", ly = o.y - 8;
        if (o.type === "village") { txt = String(o.gar); ly = o.y - 14; if (seen && o.holdTeam === 1 && o.prog > 0) arc(ctx, o.x, o.y, EN.villageRing, o.prog, S.teams[1].color); }
        else if (o.type === "heavy") { const have = seen ? o.have : o.sk.n; txt = have + "/" + o.weight; col = have >= o.weight ? "#7CF2C4" : "#F1EEDF"; ly = o.y + 22; if (seen && o.holdTeam === 1 && o.hold > 0) arc(ctx, o.x, o.y, EN.heavyRing, o.hold / EN.heavyHold, S.teams[1].color); }
        else if (o.type === "bandit") { txt = String(seen ? o.n : o.sk.n); col = KCOL[o.kind]; ly = o.y + 16; }
        const w = ctx.measureText(txt).width + 10; ctx.globalAlpha = seen ? 0.95 : 0.6; ctx.fillStyle = "rgba(8,14,6,.8)"; ctx.fillRect(o.x - w / 2, ly - 12, w, 16); ctx.fillStyle = col; ctx.fillText(txt, o.x, ly); ctx.globalAlpha = 1;
      }
    }
    function arc(ctx, x, y, r, f, col) { ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, f)); ctx.stroke(); ctx.globalAlpha = 1; }
    // the minimap: objectives you have seen, in the state you last saw them
    function minimap(mctx, k, gate) {
      for (const o of S.objs) {
        if (gate && !o.sk.seen && !vis(o, gate)) continue; const live = vis(o, gate) ? o.live : o.sk.live, x = (o.x * k) | 0, y = (o.y * k) | 0;
        if (o.type === "village") { const tm = vis(o, gate) ? o.owner : o.sk.team; mctx.fillStyle = "#15110C"; mctx.fillRect(x - 3, y - 3, 6, 6); mctx.fillStyle = !live && tm && S.teams[tm] ? S.teams[tm].color : "#B08A48"; mctx.fillRect(x - 2, y - 2, 4, 4); }
        else if (!live) continue;
        else if (o.type === "bandit") { mctx.fillStyle = "#15110C"; mctx.fillRect(x - 3, y - 3, 6, 6); mctx.fillStyle = KCOL[o.kind]; mctx.fillRect(x - 2, y - 2, 4, 4); }
        else { mctx.fillStyle = "#15110C"; mctx.fillRect(x - 2, y - 2, 5, 5); mctx.fillStyle = o.type === "heavy" ? "#C9D6E2" : S.spr.spoils.relics[o.axis].color; mctx.fillRect(x - 1, y - 1, 3, 3); }
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
        out.push({ type: o.type, x: Math.round(o.x), y: Math.round(o.y), live, visible: v, axis: o.axis, t3: o.t3, need: o.type === "village" ? o.gar : o.type === "heavy" ? o.weight : o.type === "bandit" ? (v ? o.n : o.sk.n) : 0, kind: o.kind });
      }
      return out;
    }
    const tierSum = (t) => (t && t.tier ? t.tier.arms + t.tier.boots + t.tier.horn : 0);
    return { stage, reset, initTeam, applyTiers, grant, canTake, onConvert, place, blocks, relicAt, tick, leaderDrop, observe, aiPick, knowObj, drawGround, pushProps, drawProp, drawOver,
      minimap, drawHorn, dust, hud, playerView, tierSum, tables, restyle, joinVillage, openHeavy, AXES, KCOL };
  };
})();
