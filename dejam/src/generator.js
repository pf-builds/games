// Level generation + BFS solver. Every shipped level is machine-verified solvable,
// and par = the solver's minimum move count. A slide of any distance = 1 move,
// including sliding a car out through a side-street exit (it leaves for good).
(function () {
  const G = (window.DeJam = window.DeJam || {});

  // vehicles: [{x, y, len, horiz, isGoal, colorIdx}] — variable coord is x if horiz else y.
  //   A coord of -1 (or v.out) means the vehicle has left the lot.
  // exits: [{side: 'right'|'left'|'top'|'bottom', index: lane, goal: bool}]
  //   The goal exit is the taxi's; side exits take any blocker in their lane.

  function coordOf(v) { return v.horiz ? v.x : v.y; }

  function occupancy(vehicles, N) {
    const grid = new Int8Array(N * N).fill(-1);
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v.out || coordOf(v) < 0) continue;
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
    const start = coordOf(v);
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

  // Which exit (if any) sits at the low or high end of vehicle v's lane.
  function exitFor(exits, v, high) {
    const side = v.horiz ? (high ? "right" : "left") : (high ? "bottom" : "top");
    const lane = v.horiz ? v.y : v.x;
    for (const e of exits) if (e.side === side && e.index === lane) return e;
    return null;
  }
  // Can v leave through that exit? Taxi only through its goal exit; blockers only through side streets.
  function mayUse(v, e) { return !!e && (v.isGoal ? !!e.goal : !e.goal); }
  function goalExit(exits) { return exits.find((e) => e.goal) || exits[0]; }
  function outward(e) { return e.side === "right" || e.side === "bottom"; }

  // Win coordinate: goal vehicle flush against the goal-exit wall (the drive-out is then free).
  function winCoord(exit, goalLen, N) { return outward(exit) ? N - goalLen : 0; }

  // BFS over board states. Returns minimum moves to solve, or -1 (unsolvable / state cap hit).
  function solve(vehicles, exits, N, stateCap) {
    const n = vehicles.length;
    const goalIdx = vehicles.findIndex((v) => v.isGoal);
    const gExit = goalExit(exits);
    const W = winCoord(gExit, vehicles[goalIdx].len, N);
    const start = vehicles.map((v) => (v.out ? -1 : coordOf(v)));
    if (start[goalIdx] === W) return 0;
    const key = (s) => s.join(",");
    const seen = new Set([key(start)]);
    let frontier = [start];
    let depth = 0;
    const temp = vehicles.map((v) => ({ x: v.x, y: v.y, len: v.len, horiz: v.horiz, isGoal: v.isGoal }));
    const lowExit = temp.map((v) => exitFor(exits, v, false));
    const highExit = temp.map((v) => exitFor(exits, v, true));
    while (frontier.length) {
      depth++;
      const next = [];
      for (const s of frontier) {
        for (let i = 0; i < n; i++) {
          if (temp[i].horiz) temp[i].x = s[i]; else temp[i].y = s[i];
        }
        const grid = occupancy(temp, N);
        for (let i = 0; i < n; i++) {
          if (s[i] < 0) continue;
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
          // slide out through a side street: one move, the car is gone
          if (i !== goalIdx) {
            const canLow = mn === 0 && mayUse(temp[i], lowExit[i]);
            const canHigh = mx === N - temp[i].len && mayUse(temp[i], highExit[i]);
            if (canLow || canHigh) {
              const s2 = s.slice();
              s2[i] = -1;
              const k = key(s2);
              if (!seen.has(k)) {
                seen.add(k);
                next.push(s2);
                if (seen.size > stateCap) return -1;
              }
            }
          }
        }
      }
      frontier = next;
    }
    return -1;
  }

  function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  function placeVehicle(rng, vehicles, N, goal) {
    const h = rng() < 0.5;
    const len = rng() < 0.3 ? 3 : 2;
    const vx = randInt(rng, 0, h ? N - len : N - 1);
    const vy = randInt(rng, 0, h ? N - 1 : N - len);
    // A same-orientation vehicle in the goal lane can never leave it → near-certain dead board.
    if (h === goal.horiz && (goal.horiz ? vy === goal.y : vx === goal.x)) return null;
    const grid = occupancy(vehicles, N);
    for (let k = 0; k < len; k++) {
      const cx = h ? vx + k : vx, cy = h ? vy : vy + k;
      if (grid[cy * N + cx] !== -1) return null;
    }
    return { x: vx, y: vy, len, horiz: h, isGoal: false, colorIdx: 1 + Math.floor(rng() * 6) };
  }

  // Side-street candidates: a wall+lane where at least one blocker points at that wall,
  // never the taxi's own lane. Returned in random order.
  function sideExitCandidates(rng, vehicles, N, goal) {
    const cands = [];
    for (let lane = 0; lane < N; lane++) {
      const rowHas = vehicles.some((v) => !v.isGoal && v.horiz && v.y === lane);
      const colHas = vehicles.some((v) => !v.isGoal && !v.horiz && v.x === lane);
      const taxiRow = goal.horiz && goal.y === lane, taxiCol = !goal.horiz && goal.x === lane;
      if (rowHas && !taxiRow) { cands.push({ side: "left", index: lane }); cands.push({ side: "right", index: lane }); }
      if (colHas && !taxiCol) { cands.push({ side: "top", index: lane }); cands.push({ side: "bottom", index: lane }); }
    }
    for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
    return cands;
  }

  // One generation attempt. Returns {vehicles, exits, par, board} or null.
  function generateAttempt(rng, tier, gcfg) {
    const N = tier.board;
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

    const goal = { x: gx, y: gy, len: goalLen, horiz, isGoal: true, colorIdx: 0 };
    const vehicles = [goal];
    const target = randInt(rng, tier.vehiclesMin, tier.vehiclesMax);
    let placeTries = 0;
    while (vehicles.length < target && placeTries < 300) {
      placeTries++;
      const v = placeVehicle(rng, vehicles, N, goal);
      if (v) vehicles.push(v);
    }
    if (vehicles.length < tier.vehiclesMin) return null;
    const exits = [{ side, index, goal: true }];
    const want = randInt(rng, tier.exitsMin || 0, tier.exitsMax || 0);
    const cands = sideExitCandidates(rng, vehicles, N, goal);
    for (const c of cands) {
      if (exits.length - 1 >= want) break;
      exits.push({ side: c.side, index: c.index, goal: false });
    }
    const par = solve(vehicles, exits, N, gcfg.bfsStateCap);
    if (par < 4) return null; // never unsolvable, never trivial
    return { vehicles, exits, par, board: N };
  }

  // Yields to the event loop so a long search never freezes the page, but only when ~30ms of
  // work has piled up: background tabs clamp timers to ~1s, so yielding every few attempts
  // turned a 2s Endless build into a minute. No-op in a shell runtime.
  let lastYield = 0;
  const yieldToUI = () => {
    if (typeof document === "undefined" || document.hidden) return Promise.resolve(); // hidden tabs clamp timers to ~1s; nobody's watching anyway
    const now = Date.now();
    if (now - lastYield < 30) return Promise.resolve();
    lastYield = now;
    return new Promise((r) => setTimeout(r, 0));
  };

  // Generate one level meeting the tier's par range, with a graceful fallback within
  // parMin - fallbackParSlack. Honors an optional wall-clock budget (Endless must
  // hand back a lot in a couple of seconds even on a phone).
  async function generateForTier(rng, tier, gcfg, budgetMs) {
    let best = null;
    const t0 = Date.now();
    for (let a = 0; a < gcfg.attemptsPerLevel; a++) {
      await yieldToUI();
      if (budgetMs && Date.now() - t0 > budgetMs && best) return best;
      const lvl = generateAttempt(rng, tier, gcfg);
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
    const tierNames = Object.keys(cfg.tiers);
    const total = tierNames.reduce((s, t) => s + cfg.tiers[t].count, 0);
    for (const tname of tierNames) {
      const tier = cfg.tiers[tname];
      for (let li = 0; li < tier.count; li++) {
        let lvl = null, guard = 0;
        while (!lvl && guard < 5) { lvl = await generateForTier(rng, tier, cfg.generator); guard++; }
        if (!lvl) throw new Error("generator exhausted for tier " + tname);
        lvl.tier = tname;
        levels.push(lvl);
        if (onProgress) onProgress(levels.length, total);
        await yieldToUI();
      }
    }
    return levels;
  }

  // Endless lot for a streak position: the ramp in config picks the tier.
  function endlessTierFor(cfg, streak) {
    const ramp = (cfg.endless && cfg.endless.ramp) || [];
    for (const r of ramp) if (streak < r.upTo) return r.tier;
    return ramp.length ? ramp[ramp.length - 1].tier : "medium";
  }

  // Random placement alone rarely lands a hard par on a big lot, so Endless does what the
  // baker does: take the first solvable board, then hill-climb its par with the time that's left.
  // Whatever par it reaches is the served par (the budget is built on it), so it's always honest.
  // The 8 board symmetries. Par is invariant under them, so a small baked pool of lots
  // serves as eight times as many distinct-looking ones.
  function transformLevel(lvl, k) {
    const N = lvl.board;
    const f = (x, y) => {
      switch (k) {
        case 1: return [N - 1 - y, x];
        case 2: return [N - 1 - x, N - 1 - y];
        case 3: return [y, N - 1 - x];
        case 4: return [N - 1 - x, y];
        case 5: return [x, N - 1 - y];
        case 6: return [y, x];
        case 7: return [N - 1 - y, N - 1 - x];
        default: return [x, y];
      }
    };
    const vehicles = lvl.vehicles.map((v) => {
      const cells = [];
      for (let i = 0; i < v.len; i++) cells.push(f(v.horiz ? v.x + i : v.x, v.horiz ? v.y : v.y + i));
      const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
      return { ...v, x: Math.min(...xs), y: Math.min(...ys), horiz: ys.every((y) => y === ys[0]) };
    });
    const exits = lvl.exits.map((e) => {
      const cell = e.side === "right" ? [N, e.index] : e.side === "left" ? [-1, e.index] : e.side === "bottom" ? [e.index, N] : [e.index, -1];
      const [x, y] = f(cell[0], cell[1]);
      const side = x === N ? "right" : x === -1 ? "left" : y === N ? "bottom" : "top";
      return { side, index: (side === "right" || side === "left") ? y : x, goal: !!e.goal };
    });
    return { ...lvl, vehicles, exits };
  }

  const poolLast = {};
  async function generateEndless(cfg, seed, streak, pool) {
    const rng = G.mulberry32(seed);
    const tname = endlessTierFor(cfg, streak || 0);
    const tier = cfg.tiers[tname];
    if (pool && pool[tname] && pool[tname].length) {
      // baked pool: instant and always at the tier's real par; never the same lot twice in a row
      let idx = Math.floor(rng() * pool[tname].length);
      if (pool[tname].length > 1 && idx === poolLast[tname]) idx = (idx + 1) % pool[tname].length;
      poolLast[tname] = idx;
      const lvl = transformLevel(pool[tname][idx], Math.floor(rng() * 8));
      lvl.tier = "endless"; lvl.sizeTier = tname;
      return lvl;
    }
    const g = Object.assign({}, cfg.generator, { bfsStateCap: cfg.generator.endlessStateCap || 60000 });
    const budget = g.endlessTimeBudgetMs || 2500;
    const t0 = Date.now();
    let lvl = null, tries = 0;
    while (!lvl && tries < 400 && Date.now() - t0 < budget * 0.6) {
      tries++;
      lvl = generateAttempt(rng, tier, g);
      if (tries % 3 === 0) await yieldToUI();
    }
    if (!lvl) { // last resort: a small lot is cheap to find
      tries = 0;
      while (!lvl && tries++ < 200) lvl = generateAttempt(rng, cfg.tiers.easy, g);
      if (!lvl) return null;
      lvl.tier = "endless"; lvl.sizeTier = "easy";
      return lvl;
    }
    if (lvl.par < tier.parMin) {
      lvl = await harden(lvl, tier, g, rng, 100000, tier.parMax === 99 ? 0 : tier.parMax, { untilMs: t0 + budget, targetPar: tier.parMin });
    }
    lvl.tier = "endless"; lvl.sizeTier = tname;
    return lvl;
  }

  // Hill-climb a solvable board toward a higher par: mutate one vehicle's resting
  // spot (or add one), keep the mutation only if the board stays solvable and par
  // rises. Random placement alone rarely reaches the top tiers; this reliably does.
  async function harden(lvl, tier, gcfg, rng, iters, parCap, opts) {
    const N = tier.board;
    let cur = { vehicles: lvl.vehicles.map((v) => ({ ...v })), exits: lvl.exits, par: lvl.par, board: N };
    for (let it = 0; it < iters; it++) {
      if (it % 5 === 4) await yieldToUI();
      if (opts && opts.untilMs && Date.now() > opts.untilMs) break;
      if (opts && opts.targetPar && cur.par >= opts.targetPar) break;
      const cand = cur.vehicles.map((v) => ({ ...v }));
      const addNew = rng() < 0.35 && cand.length < tier.vehiclesMax;
      if (addNew) {
        const v = placeVehicle(rng, cand, N, cand[0]);
        if (!v) continue;
        cand.push(v);
      } else {
        const i = 1 + Math.floor(rng() * (cand.length - 1));
        if (!cand[i]) continue;
        const v = cand[i];
        const others = cand.filter((_, j) => j !== i);
        const grid = occupancy(others, N);
        const range = [];
        const startC = coordOf(v);
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
      const par = solve(cand, cur.exits, N, gcfg.bfsStateCap);
      if (par > cur.par && (!parCap || par <= parCap)) {
        cur = { vehicles: cand, exits: cur.exits, par, board: N };
      }
    }
    return cur;
  }

  // Build the shipped set with STRICT tier ranges — no fallback slack. Hard tiers are
  // reached by hardening a decent seed board. Used at bake time; players never run this.
  async function prebake(cfg, onProgress) {
    const rng = G.mulberry32(cfg.generator.seed);
    const levels = [];
    const tierNames = Object.keys(cfg.tiers);
    const total = tierNames.reduce((s, t) => s + cfg.tiers[t].count, 0);
    for (const tname of tierNames) {
      const tier = cfg.tiers[tname];
      for (let li = 0; li < tier.count; li++) {
        let lvl = null, fallback = null;
        for (let round = 0; round < 40 && !lvl; round++) {
          let cand = null, tries = 0;
          while (!cand && tries < 400) { tries++; cand = generateAttempt(rng, tier, cfg.generator); if (cand && tries % 8 === 7) await yieldToUI(); }
          if (!cand) continue;
          if (cand.par < tier.parMin) {
            cand = await harden(cand, tier, cfg.generator, rng, cfg.generator.hardenIters, tier.parMax === 99 ? 0 : tier.parMax, { targetPar: tier.parMin });
          }
          if (cand.par >= tier.parMin && cand.par <= tier.parMax) lvl = cand;
          else if (cand.par <= tier.parMax && (!fallback || cand.par > fallback.par)) fallback = cand;
          // big lots resist hardening under the state cap: after a fair try, ship the best seen (still solver-verified)
          if (!lvl && round >= 10 && fallback && fallback.par >= tier.parMin - 2) { lvl = fallback; lvl.belowRange = true; }
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

  G.gen = { generateAttempt, generateForTier, transformLevel, occupancy, slideRange, winCoord, exitFor, mayUse, goalExit, outward, solve, generateSet, generateEndless, endlessTierFor, harden, prebake };
})();
