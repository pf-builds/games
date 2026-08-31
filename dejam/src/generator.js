// Level generation + BFS solver. Every shipped level is machine-verified solvable,
// and par = the solver's minimum move count. A slide of any distance = 1 move.
(function () {
  const G = (window.DeJam = window.DeJam || {});

  // vehicles: [{x, y, len, horiz, isGoal, colorIdx}] — variable coord is x if horiz else y.
  // exit: {side: 'right'|'left'|'top'|'bottom', index: row-or-col of the goal lane}

  function occupancy(vehicles, N) {
    const grid = new Int8Array(N * N).fill(-1);
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      for (let k = 0; k < v.len; k++) {
        const x = v.horiz ? v.x + k : v.x;
        const y = v.horiz ? v.y : v.y + k;
        grid[y * N + x] = i;
      }
    }
    return grid;
  }

  // Legal slide range [min, max] of vehicle i's variable coord, given a prebuilt grid.
  function slideRange(vehicles, i, N, grid) {
    const v = vehicles[i];
    const start = v.horiz ? v.x : v.y;
    let min = start, max = start;
    for (let c = start - 1; c >= 0; c--) {
      const x = v.horiz ? c : v.x, y = v.horiz ? v.y : c;
      if (grid[y * N + x] !== -1) break;
      min = c;
    }
    for (let c = start + 1; c + v.len - 1 < N; c++) {
      const x = v.horiz ? c + v.len - 1 : v.x, y = v.horiz ? v.y : c + v.len - 1;
      if (grid[y * N + x] !== -1) break;
      max = c;
    }
    return [min, max];
  }

  // Win coordinate: goal vehicle flush against the exit wall (the drive-out is then free).
  function winCoord(exit, goalLen, N) {
    return (exit.side === "right" || exit.side === "bottom") ? N - goalLen : 0;
  }

  // BFS over board states. Returns minimum moves to solve, or -1 (unsolvable / state cap hit).
  function solve(vehicles, exit, N, stateCap) {
    const n = vehicles.length;
    const goalIdx = vehicles.findIndex((v) => v.isGoal);
    const W = winCoord(exit, vehicles[goalIdx].len, N);
    const start = vehicles.map((v) => (v.horiz ? v.x : v.y));
    if (start[goalIdx] === W) return 0;
    const key = (s) => s.join(",");
    const seen = new Set([key(start)]);
    let frontier = [start];
    let depth = 0;
    const temp = vehicles.map((v) => ({ x: v.x, y: v.y, len: v.len, horiz: v.horiz }));
    while (frontier.length) {
      depth++;
      const next = [];
      for (const s of frontier) {
        for (let i = 0; i < n; i++) {
          if (temp[i].horiz) temp[i].x = s[i]; else temp[i].y = s[i];
        }
        const grid = occupancy(temp, N);
        for (let i = 0; i < n; i++) {
          const [mn, mx] = slideRange(temp, i, N, grid);
          for (let c = mn; c <= mx; c++) {
            if (c === s[i]) continue;
            if (i === goalIdx && c === W) return depth;
            const s2 = s.slice();
            s2[i] = c;
            const k = key(s2);
            if (seen.has(k)) continue;
            seen.add(k);
            next.push(s2);
            if (seen.size > stateCap) return -1;
          }
        }
      }
      frontier = next;
    }
    return -1;
  }

  function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  // One generation attempt. Returns {vehicles, exit, par} or null.
  function generateAttempt(rng, tier, N, gcfg) {
    const sides = ["right", "left", "top", "bottom"];
    const side = sides[Math.floor(rng() * 4)];
    const index = randInt(rng, 1, N - 2); // keep the goal lane off the corners
    const horiz = side === "right" || side === "left";
    const goalLen = 2;
    let gx, gy;
    if (side === "right") { gy = index; gx = randInt(rng, 0, N - goalLen - 1); }
    else if (side === "left") { gy = index; gx = randInt(rng, 1, N - goalLen); }
    else if (side === "bottom") { gx = index; gy = randInt(rng, 0, N - goalLen - 1); }
    else { gx = index; gy = randInt(rng, 1, N - goalLen); }

    const vehicles = [{ x: gx, y: gy, len: goalLen, horiz, isGoal: true, colorIdx: 0 }];
    const target = randInt(rng, tier.vehiclesMin, tier.vehiclesMax);
    let placeTries = 0;
    while (vehicles.length < target && placeTries < 250) {
      placeTries++;
      const h = rng() < 0.5;
      const len = rng() < 0.3 ? 3 : 2;
      const vx = randInt(rng, 0, h ? N - len : N - 1);
      const vy = randInt(rng, 0, h ? N - 1 : N - len);
      // A same-orientation vehicle in the goal lane can never leave it → near-certain dead board.
      if (h === horiz && (horiz ? vy === gy : vx === gx)) continue;
      const grid = occupancy(vehicles, N);
      let ok = true;
      for (let k = 0; k < len; k++) {
        const cx = h ? vx + k : vx, cy = h ? vy : vy + k;
        if (grid[cy * N + cx] !== -1) { ok = false; break; }
      }
      if (!ok) continue;
      vehicles.push({ x: vx, y: vy, len, horiz: h, isGoal: false, colorIdx: 1 + Math.floor(rng() * 6) });
    }
    if (vehicles.length < tier.vehiclesMin) return null;
    const par = solve(vehicles, { side, index }, N, gcfg.bfsStateCap);
    if (par < 4) return null; // never unsolvable, never trivial
    return { vehicles, exit: { side, index }, par };
  }

  const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

  // Generate one level meeting the tier's par range, with a graceful fallback:
  // if the exact range never hits within the attempt budget, ship the closest
  // candidate within parMin - fallbackParSlack (still solver-verified, still par >= 4).
  // Yields to the event loop every few attempts — a hard-tier search can take
  // real CPU time and must never freeze the page (that bug shipped once already).
  async function generateForTier(rng, tier, N, gcfg) {
    let best = null;
    for (let a = 0; a < gcfg.attemptsPerLevel; a++) {
      if (a % 6 === 5) await yieldToUI();
      const lvl = generateAttempt(rng, tier, N, gcfg);
      if (!lvl) continue;
      if (lvl.par >= tier.parMin && lvl.par <= tier.parMax) return lvl;
      const slackMin = tier.parMin - (gcfg.fallbackParSlack || 3);
      if (lvl.par >= slackMin && lvl.par <= tier.parMax) {
        if (!best || lvl.par > best.par) best = lvl;
      }
    }
    return best; // may be null; caller retries with a nudged seed
  }

  async function generateSet(cfg, onProgress) {
    const rng = G.mulberry32(cfg.generator.seed);
    const levels = [];
    const tierNames = ["easy", "medium", "hard"];
    const total = tierNames.reduce((s, t) => s + cfg.tiers[t].count, 0);
    for (const tname of tierNames) {
      const tier = cfg.tiers[tname];
      for (let li = 0; li < tier.count; li++) {
        let lvl = null, guard = 0;
        while (!lvl && guard < 5) { lvl = await generateForTier(rng, tier, cfg.board, cfg.generator); guard++; }
        if (!lvl) throw new Error("generator exhausted for tier " + tname);
        lvl.tier = tname;
        levels.push(lvl);
        if (onProgress) onProgress(levels.length, total);
        await yieldToUI();
      }
    }
    return levels;
  }

  async function generateEndless(cfg, seed) {
    const rng = G.mulberry32(seed);
    const tier = cfg.tiers[cfg.endlessTier];
    let lvl = null, guard = 0;
    while (!lvl && guard < 8) { lvl = await generateForTier(rng, tier, cfg.board, cfg.generator); guard++; }
    if (!lvl) { // last-resort: easy tier is cheap to find
      lvl = await generateForTier(rng, cfg.tiers.easy, cfg.board, cfg.generator);
    }
    if (lvl) lvl.tier = "endless";
    return lvl;
  }

  // Hill-climb a solvable board toward a higher par: mutate one vehicle's resting
  // spot (or add one), keep the mutation only if the board stays solvable and par
  // rises. Random placement alone almost never reaches par 14+; this reliably does.
  async function harden(lvl, N, gcfg, rng, iters, parCap) {
    let cur = { vehicles: lvl.vehicles.map((v) => ({ ...v })), exit: lvl.exit, par: lvl.par };
    for (let it = 0; it < iters; it++) {
      if (it % 5 === 4) await yieldToUI();
      const cand = cur.vehicles.map((v) => ({ ...v }));
      const addNew = rng() < 0.35 && cand.length < 13;
      if (addNew) {
        const h = rng() < 0.5, len = rng() < 0.3 ? 3 : 2;
        const vx = randInt(rng, 0, h ? N - len : N - 1);
        const vy = randInt(rng, 0, h ? N - 1 : N - len);
        const goal = cand[0];
        if (h === goal.horiz && (goal.horiz ? vy === goal.y : vx === goal.x)) continue;
        const grid = occupancy(cand, N);
        let ok = true;
        for (let k = 0; k < len; k++) {
          const cx = h ? vx + k : vx, cy = h ? vy : vy + k;
          if (grid[cy * N + cx] !== -1) { ok = false; break; }
        }
        if (!ok) continue;
        cand.push({ x: vx, y: vy, len, horiz: h, isGoal: false, colorIdx: 1 + Math.floor(rng() * 6) });
      } else {
        const i = 1 + Math.floor(rng() * (cand.length - 1));
        if (!cand[i]) continue;
        const v = cand[i];
        const others = cand.filter((_, j) => j !== i);
        const grid = occupancy(others, N);
        // move the vehicle to a random legal cell along its axis
        const range = [];
        const startC = v.horiz ? v.x : v.y;
        for (let c = 0; c + v.len - 1 < N; c++) {
          let free = true;
          for (let k = 0; k < v.len; k++) {
            const cx = v.horiz ? c + k : v.x, cy = v.horiz ? v.y : c + k;
            if (grid[cy * N + cx] !== -1) { free = false; break; }
          }
          if (free && c !== startC) range.push(c);
        }
        if (!range.length) continue;
        const c = range[Math.floor(rng() * range.length)];
        if (v.horiz) v.x = c; else v.y = c;
      }
      const par = solve(cand, cur.exit, N, gcfg.bfsStateCap);
      if (par > cur.par && (!parCap || par <= parCap)) {
        cur = { vehicles: cand, exit: cur.exit, par };
      }
    }
    return cur;
  }

  // Build the shipped 30-level set with STRICT tier ranges — no fallback slack.
  // Hard tiers are reached by hardening a decent seed board. Used at bake time
  // (dev writes the result to levels.json); players never run this.
  async function prebake(cfg, onProgress) {
    const rng = G.mulberry32(cfg.generator.seed);
    const levels = [];
    const tierNames = ["easy", "medium", "hard"];
    const total = tierNames.reduce((s, t) => s + cfg.tiers[t].count, 0);
    for (const tname of tierNames) {
      const tier = cfg.tiers[tname];
      for (let li = 0; li < tier.count; li++) {
        let lvl = null;
        for (let round = 0; round < 40 && !lvl; round++) {
          let cand = null, tries = 0;
          while (!cand && tries < 400) { tries++; cand = generateAttempt(rng, tier, cfg.board, cfg.generator); if (cand && tries % 8 === 7) await yieldToUI(); }
          if (!cand) continue;
          if (cand.par < tier.parMin) {
            cand = await harden(cand, cfg.board, cfg.generator, rng, cfg.generator.hardenIters, tier.parMax === 99 ? 0 : tier.parMax);
          }
          if (cand.par >= tier.parMin && cand.par <= tier.parMax) lvl = cand;
        }
        if (!lvl) throw new Error("prebake exhausted for " + tname + " #" + li);
        lvl.tier = tname;
        levels.push(lvl);
        if (onProgress) onProgress(levels.length, total, tname, lvl.par);
        await yieldToUI();
      }
    }
    return levels;
  }

  G.gen = { occupancy, slideRange, winCoord, solve, generateSet, generateEndless, harden, prebake };
})();
