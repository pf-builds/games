// Peasant Swarm — core simulation + render. Click it! Studios, 2026.
// Boids swarm routed by per-team flow fields (src/flow.js) on seeded terrain (src/terrain.js), local combat with a local rout and a
// fleeing remnant, AI rivals, power-ups. All tuning in config.json.
(function () {
  const PS = (window.PS = window.PS || {});
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const DT = 1 / 60; // the sim only ever advances in fixed 1/60 s ticks (SPEC-v2 §3)
  const QS = new URLSearchParams(location.search);
  const urlSeed = QS.has("seed") && QS.get("seed") !== "" && isFinite(+QS.get("seed")) ? +QS.get("seed") >>> 0 : null; // ?seed=N replays a match
  const capParam = QS.get("cap"); // ?cap=touch|desktop forces an agent cap (the harness runs both)
  const fixtureParam = QS.get("fixture"); // ?fixture=pass64|pass128|ambush|flipflop|cliff runs a QA fixture live instead of the title

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- state
  // input: mouse cursor (px, py, active), keys, the touch pointer (tp: tap / drag / hold), the floating joystick, a second finger (hud2),
  // the tapped/clicked/minimap route (route; chase = a rival team id), the hold flag and the route preview timer (frame time)
  const mkInput = () => ({ px: 0, py: 0, active: false, huddle: false, keys: {}, touch: false, hold: false, preview: 0, hud2: -1,
    joy: { active: false, id: -1, ox: 0, oy: 0, cx: 0, cy: 0, mag: 0, dx: 0, dy: 0 },
    tp: { active: false, id: -1, sx: 0, sy: 0, t0: 0, drag: false, hold: false },
    route: { on: false, x: 0, y: 0, chase: 0, src: "", sx: 0, sy: 0 } });
  const mkCamS = () => ({ i: -1, steps: null, from: 1, t: 0, lx: 0, ly: 0 }); // zoom step index + ease, smoothed look-ahead
  const mkEv = () => ({ fights: 0, routs: 0, remnants: 0, scattered: 0 }); // every team's engagements, routs, remnants formed, finale scatters
  const S = {
    cfg: null, spr: null, debug: /(\?|&)debug=1/.test(location.search),
    mode: "title", t: 0, timeLeft: 0, pace: 1, tick: 0, acc: 0,
    agents: [], teams: [], obstacles: [], powerups: [], camps: [],
    cam: { x: 0, y: 0, zoom: 1 }, camS: mkCamS(), vw: 0, vh: 0, dpr: 1,
    input: mkInput(),
    rng: null, seed: 0, trickleT: 0, shake: 0, banners: [], hintT: 0,
    stats: { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0, fights: 0 },
    fps: 60, fpsT0: 0, frameN: 0, engagedNow: false, result: null,
    map: null, obs: null, cap: 1000, dbg: { terrainBad: 0, firstBad: null, capOver: 0 },
    drawList: [], decals: [], trails: [], attract: false, vignette: null, difficulty: "normal",
    ev: mkEv(), lastRout: null, thinkRR: 0, flowW: null, fixture: null,
  };
  if (S.debug) window.PSS = S;

  const canvas = $("game"), ctx = canvas.getContext("2d");
  const mini = $("minimap"), mctx = mini.getContext("2d");
  let particles, floaters, sandbox = false; // sandbox: PS.fight / PS.simMatch are running a throwaway world, so DOM side effects are skipped
  let liveFlow = null, sbFlow = null; // flow-field worlds (src/flow.js): one for the live game, one reused by every sandbox

  // ---------------------------------------------------------------- setup
  async function boot() {
    const res = await fetch("config.json?v=21");
    S.cfg = await res.json();
    S.spr = PS.buildSprites(S.cfg);
    PS.terrain.init(S.cfg); PS.flow.init(S.cfg);
    liveFlow = PS.flow.world(); sbFlow = PS.flow.world();
    hashAlloc();
    particles = PS.Particles(1400);
    floaters = PS.Floaters();
    PS.selfTest = selfTest; PS.fight = fight; PS.simMatch = simMatch; PS.bench = bench; PS.replay = replay; // QA hooks, always on and side-effect free (see QA section)
    PS.debugDropCaches = debugDropCaches; PS.cacheReport = cacheReport; PS.recheckCaches = recheckCaches; PS.cacheProbe = cacheProbe;
    PS.fixture = fixture; PS.clashRead = clashRead;
    resize();
    window.addEventListener("resize", resize);
    bindInput();
    bindUI();
    if (fixtureParam && FIXTURES[fixtureParam]) startFixtureLive(fixtureParam); else newGame(true);
    schedule();
    if (S.debug) {
      // hidden-tab fallback clock: rAF starves there, and only there (M1 critic MAJOR-1: a visible tab's stall must drop time, never
      // catch up 8 ticks). Never registers a second rAF (see schedule()).
      setInterval(() => { if (document.hidden && performance.now() - lastFrame > 60) frame(performance.now(), true); }, 33);
      // synchronous sim advance for automated critics: PS.step(5) = 5 sim-seconds, no rendering
      PS.step = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (S.mode !== "play") break; update(DT); if (S.mode !== "play") break; particles.update(DT); floaters.update(DT); } updateHUD(true); return S.result || S.mode; };
      PS.timeStep = (sec) => { const t0 = performance.now(); PS.step(sec); return (performance.now() - t0) / (sec * 60); };
      // scripted control for critics and the harness bot: route the player to (x, y) through its field, as a cursor-follow target
      PS.aim = (x, y) => { const inp = S.input, p = S.teams[1]; inp.route.on = false; inp.hold = false; inp.active = false; inp.joy.active = false; if (!p) return null; p.tx = x; p.ty = y; p.mode = "route"; return p.mode; };
    }
  }

  function resize() {
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.vw = window.innerWidth; S.vh = window.innerHeight;
    canvas.width = Math.round(S.vw * S.dpr); canvas.height = Math.round(S.vh * S.dpr);
    zoomRule(S.teams[1] ? S.teams[1].count : 1, 0, true); // the zoom step for this viewport, at once
    // cached screen-space vignette
    const v = document.createElement("canvas"); v.width = Math.max(1, S.vw >> 1); v.height = Math.max(1, S.vh >> 1);
    const g = v.getContext("2d"); const rg = g.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * 0.35, v.width / 2, v.height / 2, Math.max(v.width, v.height) * 0.75);
    rg.addColorStop(0, "rgba(10,20,8,0)"); rg.addColorStop(1, "rgba(10,20,8,.42)"); g.fillStyle = rg; g.fillRect(0, 0, v.width, v.height); S.vignette = v;
  }

  // ---------------------------------------------------------------- world gen
  // every field an agent will ever carry is set here, v2 placeholders included (C2: agents that grow fields later ran 6x slower)
  function mkAgent(x, y, team) {
    const R = S.rng;
    // the neighbour loop reads x, y, team, dead and escapeT of hundreds of agents per agent: keep them first (one cache line)
    return { x, y, team, dead: false, escapeT: 0, vx: 0, vy: 0, hp: S.cfg.agent.hp, atk: R() * 0.5, tgt: null,
      ph: R() * 10, face: R() < 0.5 ? 1 : -1, fl: 0, lunge: 0, wx: x, wy: y, hx: x, hy: y, fight: false, r: S.cfg.agent.radius, pop: 9, camp: null,
      rec: 0, seenA: 1, ex: 0, ey: 0, groupId: 0, rd: 0, fieldT: 0, fdx: 0, fdy: 0, fok: 0 };
  }
  const z9 = () => [0, 0, 0, 0, 0, 0, 0, 0, 0]; // team-indexed arrays: neutral 0, player 1, rivals 2-6, spare 7, bandits 8 (SPEC-v2 §6)
  // route: the team steers by its flow field (else direct seek); mode (player): "route" | "steer" | "hold"; hyst: route hysteresis applies;
  // ax/ay: the anchor (centroid snapped to walkable, for AI and labels); tMed: last tick's median path distance (path cohesion).
  // Per enemy slot j: eng (agents fighting j this tick) with fX/fY (their position sums), engT (engaged time), engL (smoothed local
  // strength), engPk (its peak this engagement), engHold (time under breakRatio), engCx/engCy (contact centroid), engStart (count at start)
  function mkTeam(id, name, color, isPlayer, ai) {
    return { id, name, color, isPlayer, ai, count: 0, cx: 0, cy: 0, ax: 0, ay: 0, tx: 0, ty: 0, vx: 0, vy: 0, pcx: 0, pcy: 0, spd: 0, slot: -1, alive: true,
      route: true, mode: "route", hyst: false, tMed: 0,
      buffs: { speed: 0, armor: 0, frenzy: 0, rally: 0 }, eng: z9(), engT: z9(), engStart: z9(), engL: z9(), engPk: z9(), engHold: z9(), engCx: z9(), engCy: z9(), fX: z9(), fY: z9(),
      spr: S.spr.peasantSet(color), kills: 0, peak: 1, state: "roam", speedMod: 1, thinkT: S.rng() * 0.5, lastHint: 0, minY: 0, huntStart: 0, huntCooldown: 0,
      regroupUntil: 0, fleeFrom: 0, leftHome: -1, atCentre: -1 };
  }
  // speed by swarm size: small swarms get a boost that fades by `full`, big ones slow a little per peasant above it (SPEC-v2 §3)
  function sizeSpeed(n) { const k = S.cfg.agent.sizeSpeed, v = 1 + k.boost * Math.max(0, 1 - n / k.full) - k.drop * Math.max(0, n - k.full); return v < k.floor ? k.floor : v; }

  // trees and rocks: circular colliders bucketed per terrain cell (CSR lists) plus a "one within a cell" flag, so an agent checks a 3x3 block at most
  function bucketObstacles() {
    const T = PS.terrain, N = T.N, NN = N * N, st = new Int32Array(NN + 1), near = new Uint8Array(NN), list = new Int32Array(S.obstacles.length);
    for (const o of S.obstacles) st[T.cellOf(o.x, o.y) + 1]++;
    for (let c = 0; c < NN; c++) st[c + 1] += st[c];
    const fill = st.slice(0, NN);
    S.obstacles.forEach((o, i) => {
      const c = T.cellOf(o.x, o.y); list[fill[c]++] = i; const x = c % N, y = (c / N) | 0;
      for (let j = y - 1; j <= y + 1; j++) for (let k = x - 1; k <= x + 1; k++) if (j >= 0 && k >= 0 && j < N && k < N) near[j * N + k] = 1;
    });
    S.obs = { st, list, near };
  }
  function farFromObstacles(x, y, pad) {
    const O = S.obs, T = PS.terrain, N = T.N, cell = T.cell, R = Math.ceil((pad + 18) / cell), ci = (x / cell) | 0, cj = (y / cell) | 0;
    for (let j = Math.max(0, cj - R); j <= Math.min(N - 1, cj + R); j++) for (let i = Math.max(0, ci - R); i <= Math.min(N - 1, ci + R); i++) {
      const c = j * N + i; for (let k = O.st[c]; k < O.st[c + 1]; k++) { const o = S.obstacles[O.list[k]], dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy < (o.r + pad) * (o.r + pad)) return false; }
    }
    return true;
  }
  function farFromTeams(x, y, d) {
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (!t.alive) continue; const dx = t.cx - x, dy = t.cy - y; if (dx * dx + dy * dy < d * d) return false; }
    return true;
  }
  const placeOk = (x, y, minSdfCells, pad) => PS.terrain.placementOk(x, y, minSdfCells) && farFromObstacles(x, y, pad);
  // a random point inside a random cell of `list` (defaults to open ground: walkable, main region, sdf >= 2 cells, not in a pass)
  const RP = { x: 0, y: 0 };
  function randPos(list) {
    const P = S.map.place, L = list || P.open2, N = S.map.N, cell = S.map.cell, c = L[(S.rng() * L.length) | 0];
    RP.x = ((c % N) + 0.2 + 0.6 * S.rng()) * cell; RP.y = (((c / N) | 0) + 0.2 + 0.6 * S.rng()) * cell; return RP;
  }
  // per-map placement tables (built once per map, reused by attract restarts and the trickle)
  function placeTables(m) {
    if (m.place) return m.place;
    const cfg = S.cfg, N = m.N, cell = m.cell, NN = N * N, tol = cfg.powerups.contestTol, walk = PS.terrain.walkT;
    const open2 = [], open3 = [], owned = [[], [], [], [], [], []], contest = [], walkable = [], passCells = [];
    for (let c = 0; c < NN; c++) {
      if (!walk(m.terr[c])) continue; if (m.sdf[c] >= cell / 2) walkable.push(c); if (m.passMask[c] && m.region[c] === 1) passCells.push(c);
      if (m.region[c] !== 1 || m.passMask[c] || m.sdf[c] < 2 * cell) continue;
      open2.push(c); if (m.sdf[c] >= 3 * cell) open3.push(c);
      if (m.owner[c] < 6) owned[m.owner[c]].push(c);
      if (m.dist.length === 6) { let d1 = 65535, d2 = 65535; for (let i = 0; i < 6; i++) { const d = m.dist[i][c]; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } if (d2 < 65535 && d2 - d1 <= tol * d1) contest.push(c); }
    }
    const I = (a) => Int32Array.from(a);
    return (m.place = { open2: I(open2), open3: I(open3), owned: owned.map((a) => I(a.length ? a : open2)), contest: I(contest.length ? contest : open2), walkable: I(walkable), passCells: I(passCells), cost0: m.cost.slice() });
  }

  function spawnCamp(x, y, n) {
    const sp = S.cfg.spawn.campSpread;
    const camp = { x, y, n: 0, smokeT: S.rng() * 0.8 };
    S.camps.push(camp);
    for (let i = 0; i < n; i++) {
      const a = S.rng() * Math.PI * 2, d = 6 + S.rng() * sp;
      const ag = mkAgent(x + Math.cos(a) * d, y + Math.sin(a) * d, 0);
      ag.hx = x; ag.hy = y; ag.wx = ag.x; ag.wy = ag.y; ag.camp = camp;
      S.agents.push(ag);
    }
  }
  const capFor = () => (capParam === "touch" || (capParam !== "desktop" && S.input.touch) ? S.cfg.spawn.touchAgentCap : S.cfg.spawn.agentCap);

  // newGame(attract, { seed, keepMap, map }): seed from opts, else ?seed=, else the clock. The map is seeded by S.rng's first draw.
  function newGame(attract, opts) {
    opts = opts || {};
    const cfg = S.cfg, SP = cfg.spawn, T = PS.terrain;
    S.attract = !!attract; if (!sandbox) PS.audio.setSilent(S.attract);
    S.seed = opts.seed != null ? opts.seed >>> 0 : urlSeed != null ? urlSeed : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    S.rng = mulberry32(S.seed);
    const genSeed = (S.rng() * 4294967296) >>> 0;
    const old = S.map;
    if (opts.map) S.map = opts.map; else if (!(opts.keepMap && S.map && !S.map.flat)) S.map = T.gen(genSeed);
    if (!sandbox && old && old !== S.map) releaseGround(old); // a replaced map's chunk canvases are zeroed at once, not left for GC
    T.use(S.map);
    const m = S.map, P = placeTables(m), N = m.N, cell = m.cell;
    m.cost.set(P.cost0);
    S.flowW = PS.flow.use(PS.flow.reset(sandbox ? sbFlow : liveFlow, m)); // fields are per world; every cell is known in M2
    S.cap = opts.cap || capFor();
    S.agents.length = 0; S.obstacles.length = 0; S.powerups.length = 0; S.camps.length = 0; S.banners.length = 0; S.decals.length = 0; S.trails.length = 0;
    S.t = 0; S.tick = 0; S.acc = 0; S.timeLeft = cfg.world.matchSeconds; S.trickleT = 0; S.shake = 0; S.result = null; S.engagedNow = false; S.finalCalled = false; S.pendingEnd = null; S._routedBy = null;
    S.stats = { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0, fights: 0 };
    S.dbg = { terrainBad: 0, firstBad: null, capOver: 0 }; S.ev = mkEv(); S.lastRout = null; S.thinkRR = 0; S.fixture = null;
    const inp = S.input; inp.route.on = false; inp.route.chase = 0; inp.hold = false; inp.preview = 0;

    // obstacles: open ground at least 3 cells from any wall, spaced, clear of every spawn slot; +prop cost on their cell
    const clearStart = SP.obstacleClearOfStarts, nearSpawn = (x, y, d) => { for (const s of m.spawns) if ((s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < d * d) return true; return false; };
    const spaced = (x, y, pad) => { for (const o of S.obstacles) { const dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy < (o.r + pad) * (o.r + pad)) return false; } return true; };
    for (let i = 0; i < cfg.world.trees + cfg.world.rocks; i++) {
      const p = randPos(P.open3), tree = i < cfg.world.trees, big = tree && S.rng() < 0.4;
      if (!spaced(p.x, p.y, 40) || nearSpawn(p.x, p.y, clearStart) || !T.placementOk(p.x, p.y, 3)) continue;
      S.obstacles.push({ x: p.x, y: p.y, r: tree ? (big ? 17 : 12) : 13, kind: tree ? (big ? 1 : 0) : 2 });
      const c = T.cellOf(p.x, p.y); m.cost[c] = Math.min(254, m.cost[c] + cfg.terrain.costs.prop);
    }
    bucketObstacles();

    // teams: player + 3 AI at four of the six spawn slots, shuffled (Fisher-Yates); the map holds six so M4 adds rivals without new bookkeeping
    S.teams = [null];
    S.teams.push(mkTeam(1, cfg.player.name, cfg.player.color, true, S.attract ? cfg.ai.personalities[1] : null));
    cfg.ai.personalities.forEach((p, i) => S.teams.push(mkTeam(2 + i, p.name, p.color, false, p)));
    const slots = [0, 1, 2, 3, 4, 5]; for (let i = slots.length - 1; i > 0; i--) { const j = (S.rng() * (i + 1)) | 0, t = slots[i]; slots[i] = slots[j]; slots[j] = t; }
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i], s = m.spawns[slots[(i - 1) % 6]] || { x: cfg.world.w / 2 + (i - 2.5) * 300, y: cfg.world.h / 2, c: 0 };
      t.slot = slots[(i - 1) % 6]; t.cx = t.tx = t.pcx = s.x; t.cy = t.ty = t.pcy = s.y;
      S.agents.push(mkAgent(s.x, s.y, i));
      if (i === 1 && !S.attract) for (let b = 0; b < diff().startBonus; b++) S.agents.push(mkAgent(s.x + (S.rng() - 0.5) * 30, s.y + (S.rng() - 0.5) * 30, 1));
      // starter camps inside the home meadow so the first minute isn't a walk (path distance close to straight = same meadow)
      for (let k = 0, placed = 0; k < 30 && placed < SP.starterCamps; k++) {
        const a = S.rng() * Math.PI * 2, d = SP.starterDist[0] + S.rng() * (SP.starterDist[1] - SP.starterDist[0]);
        const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d, c = T.cellOf(x, y);
        if (!placeOk(x, y, 2, 44) || (m.dist.length && m.dist[t.slot][c] / 3 * cell > d * 1.35)) continue;
        let ok = true; for (const cp of S.camps) if ((cp.x - x) * (cp.x - x) + (cp.y - y) * (cp.y - y) < SP.campGap * SP.campGap) { ok = false; break; }
        if (!ok) continue;
        spawnCamp(x, y, 2 + ((S.rng() * 2) | 0)); placed++;
      }
    }
    // neutral camps split evenly across the six path-Voronoi regions (the remainder goes to regions in shuffled order)
    const per = Math.floor(SP.neutralCamps / 6), extra = SP.neutralCamps - per * 6, order = [0, 1, 2, 3, 4, 5];
    for (let i = 5; i > 0; i--) { const j = (S.rng() * (i + 1)) | 0, t = order[i]; order[i] = order[j]; order[j] = t; }
    for (let r = 0; r < 6; r++) {
      const want = per + (order.indexOf(r) < extra ? 1 : 0);
      for (let placed = 0, tries = 0; placed < want && tries < 80; tries++) {
        const p = randPos(P.owned[r]), x = p.x, y = p.y;
        if (!placeOk(x, y, 2, 44) || !farFromTeams(x, y, SP.campClearOfStarts)) continue;
        let ok = true; for (const cp of S.camps) if ((cp.x - x) * (cp.x - x) + (cp.y - y) * (cp.y - y) < SP.campGap * SP.campGap) { ok = false; break; }
        if (!ok) continue;
        spawnCamp(x, y, SP.campMin + ((S.rng() * (SP.campMax - SP.campMin + 1)) | 0)); placed++;
      }
    }
    // power-ups on contested ground (two spawns about equally far by path)
    for (let i = 0; i < cfg.powerups.count; i++) S.powerups.push(newPowerup(true));
    // decals (dressing only) and dirt trails between neighbouring camps: both are baked into the ground chunks
    for (let i = 0; i < cfg.world.decals; i++) { const c = P.walkable[(S.rng() * P.walkable.length) | 0]; S.decals.push({ x: ((c % N) + S.rng()) * cell, y: (((c / N) | 0) + S.rng()) * cell, k: (S.rng() * S.spr.decals.length) | 0 }); }
    for (let i = 0; i < S.camps.length; i++) {
      const a = S.camps[i]; const near = [];
      for (let j = 0; j < S.camps.length; j++) { if (i === j) continue; const b = S.camps[j]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < cfg.world.trailDist) near.push([d, j]); }
      near.sort((u, v) => u[0] - v[0]);
      for (let k = 0; k < Math.min(2, near.length); k++) {
        const j = near[k][1]; if (j < i) continue; const b = S.camps[j];
        const mx = (a.x + b.x) / 2 + (S.rng() - 0.5) * 120, my = (a.y + b.y) / 2 + (S.rng() - 0.5) * 120;
        let clear = true; for (let q = 1; q < 12 && clear; q++) { const t = q / 12, u = 1 - t; if (!T.walkable(u * u * a.x + 2 * u * t * mx + t * t * b.x, u * u * a.y + 2 * u * t * my + t * t * b.y)) clear = false; }
        if (clear) S.trails.push({ x0: a.x, y0: a.y, cx: mx, cy: my, x1: b.x, y1: b.y, minX: Math.min(a.x, b.x, mx) - 12, maxX: Math.max(a.x, b.x, mx) + 12, minY: Math.min(a.y, b.y, my) - 12, maxY: Math.max(a.y, b.y, my) + 12 });
      }
    }

    recount();
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; t.pcx = t.cx; t.pcy = t.cy; }
    S.cam.x = S.teams[1].cx; S.cam.y = S.teams[1].cy; S.camS = mkCamS(); zoomRule(S.teams[1].count, 0, true);
    S.teams[1].tx = S.teams[1].cx; S.teams[1].ty = S.teams[1].cy;
    if (!sandbox) { groundInvalidate(m); minimapBake(); }
    buildTeamChips();
    if (!S.attract) showHint(S.input.touch ? "Tap to march there, drag to steer, hold to stop" : "Walk into grey peasants to recruit them", 4);
  }

  function diff() { return S.cfg.difficulty[S.difficulty] || S.cfg.difficulty.normal; }
  function pickKind() {
    const w = S.cfg.powerups.weights; const keys = Object.keys(w); let tot = 0; for (const k of keys) tot += w[k];
    let r = S.rng() * tot; for (const k of keys) { r -= w[k]; if (r <= 0) return k; } return keys[0];
  }
  function newPowerup(initial) {
    let x = 0, y = 0;
    for (let n = 0; n < 60; n++) { const p = randPos(S.map.place.contest); x = p.x; y = p.y; if (placeOk(x, y, 2, 30) && (!initial || farFromTeams(x, y, S.cfg.powerups.minDistFromStart))) break; }
    return { x, y, kind: pickKind(), alive: true, t: 0 };
  }

  function recount() {
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; t.count = 0; t._sx = 0; t._sy = 0; t.minY = Infinity; }
    for (const a of S.agents) { if (a.team === 0 || a.dead) continue; const t = S.teams[a.team]; t.count++; t._sx += a.x; t._sy += a.y; if (a.y < t.minY) t.minY = a.y; }
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i];
      if (t.count > 0) { t.cx = t._sx / t.count; t.cy = t._sy / t.count; if (t.count > t.peak) t.peak = t.count; const p = PS.terrain.snapXY(t.cx, t.cy); t.ax = p.x; t.ay = p.y; }
    }
  }
  // QA: when each team's anchor first left its walled home meadow, and first stood in the central meadow (real maps only)
  function trackHome() {
    const m = S.map; if (!m || !m.spawns.length) return;
    const TC = S.cfg.terrain, hr = (TC.homeRadius + TC.homeWall + 1) * m.cell, cr = TC.centerRadius * m.W, c0 = m.W / 2;
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i], s = m.spawns[t.slot]; if (!t.alive || !s) continue;
      if (t.leftHome < 0 && (t.ax - s.x) * (t.ax - s.x) + (t.ay - s.y) * (t.ay - s.y) > hr * hr) t.leftHome = +S.t.toFixed(2);
      if (t.atCentre < 0 && (t.ax - c0) * (t.ax - c0) + (t.ay - c0) * (t.ay - c0) < cr * cr) t.atCentre = +S.t.toFixed(2);
    }
  }

  // ---------------------------------------------------------------- spatial hash: typed head/next lists, cells stamped per rebuild (no per-tick clears)
  const HC = 48; let hCols = 0, hRows = 0, hHead = null, hStamp = null, hNext = new Int32Array(0), hTick = 0;
  function hashAlloc() {
    hCols = Math.ceil(S.cfg.world.w / HC); hRows = Math.ceil(S.cfg.world.h / HC); hHead = new Int32Array(hCols * hRows); hStamp = new Int32Array(hCols * hRows);
    MED = []; for (let i = 0; i < 9; i++) MED.push(new Float32Array(Math.max(S.cfg.spawn.agentCap, S.cfg.spawn.touchAgentCap) + 512)); // per-team path-cohesion samples
  }
  const NEAR = new Array(6000); let nearN = 0;
  const REC = new Array(4096); let recN = 0; // neutrals recruited this tick (converted after the steering pass)
  function rebuildGrid() {
    const ag = S.agents, n = ag.length;
    if (hNext.length < n) hNext = new Int32Array(Math.max(n, S.cap) + 256); // grows once per session at most, never per frame
    hTick++;
    for (let i = 0; i < n; i++) {
      const a = ag[i]; let cx = (a.x / HC) | 0, cy = (a.y / HC) | 0;
      if (cx < 0) cx = 0; else if (cx >= hCols) cx = hCols - 1; if (cy < 0) cy = 0; else if (cy >= hRows) cy = hRows - 1;
      const c = cy * hCols + cx; if (hStamp[c] !== hTick) { hStamp[c] = hTick; hHead[c] = -1; }
      hNext[i] = hHead[c]; hHead[c] = i;
    }
  }
  // every agent in the hash cells overlapping the square of half-size r around (x, y)
  function gather(x, y, r) {
    nearN = 0; const ag = S.agents;
    let i0 = ((x - r) / HC) | 0, i1 = ((x + r) / HC) | 0, j0 = ((y - r) / HC) | 0, j1 = ((y + r) / HC) | 0;
    if (i0 < 0) i0 = 0; if (j0 < 0) j0 = 0; if (i1 >= hCols) i1 = hCols - 1; if (j1 >= hRows) j1 = hRows - 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * hCols + i; if (hStamp[c] !== hTick) continue;
      for (let k = hHead[c]; k >= 0 && nearN < 6000; k = hNext[k]) NEAR[nearN++] = ag[k];
    }
  }
  function countNear(x, y, r, team) {
    // wide query for AI/rally decisions — not per-agent
    gather(x, y, r); let n = 0; const r2 = r * r;
    for (let k = 0; k < nearN; k++) { const b = NEAR[k]; if (b.team !== team || b.dead) continue; const dx = b.x - x, dy = b.y - y; if (dx * dx + dy * dy < r2) n++; }
    return n;
  }

  // ---------------------------------------------------------------- terrain collision (SPEC-v2 §3): bilinear SDF, one push-out, wall slide
  let GX = 0, GY = 0; // unit gradient of the last sdfGrad() sample (points away from the wall), 0,0 on a flat spot
  function sdfGrad(x, y) {
    const T = PS.terrain, N = T.N, cell = T.cell, s = S.map.sdf; let fx = x / cell - 0.5, fy = y / cell - 0.5;
    if (!(fx >= 0)) fx = 0; else if (fx > N - 1.001) fx = N - 1.001; if (!(fy >= 0)) fy = 0; else if (fy > N - 1.001) fy = N - 1.001;
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, c = j * N + i, a = s[c], b = s[c + 1], d = s[c + N], e = s[c + N + 1];
    const gx = (1 - ty) * (b - a) + ty * (e - d), gy = (1 - tx) * (d - a) + tx * (e - b), gl = Math.sqrt(gx * gx + gy * gy);
    if (gl > 1e-6) { GX = gx / gl; GY = gy / gl; } else { GX = 0; GY = 0; }
    return a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty;
  }
  // the centre must end in a walkable cell: bilinear rounds convex corners and flattens deep in rock, so finish cell-exact
  function resolveBlocked(a, c) {
    const T = PS.terrain, N = T.N, cell = T.cell, terr = S.map.terr, w = T.walkT, i = c % N, j = (c / N) | 0, x0 = i * cell, y0 = j * cell;
    let best = Infinity, nx = a.x, ny = a.y;
    if (i > 0 && w(terr[c - 1])) { const d = a.x - x0; if (d < best) { best = d; nx = x0 - 0.5; ny = a.y; } }
    if (i < N - 1 && w(terr[c + 1])) { const d = x0 + cell - a.x; if (d < best) { best = d; nx = x0 + cell + 0.5; ny = a.y; } }
    if (j > 0 && w(terr[c - N])) { const d = a.y - y0; if (d < best) { best = d; nx = a.x; ny = y0 - 0.5; } }
    if (j < N - 1 && w(terr[c + N])) { const d = y0 + cell - a.y; if (d < best) { best = d; nx = a.x; ny = y0 + cell + 0.5; } }
    if (best === Infinity) { const s = S.map.snap[c]; if (s >= 0) { nx = ((s % N) + 0.5) * cell; ny = (((s / N) | 0) + 0.5) * cell; } }
    a.x = nx; a.y = ny;
  }

  // ---------------------------------------------------------------- simulation
  const SMP = { x: 0, y: 0, t: 0, ok: false }; // flow sample scratch
  let MED = null; const MEDN = new Int32Array(9); // per-team path distances this tick (path cohesion median)
  function update(dt) {
    const cfg = S.cfg, A = cfg.agent, F = cfg.flock, FW = cfg.flow, CB = cfg.combat, W = cfg.world.w, H = cfg.world.h, D = diff();
    S.t += dt; S.timeLeft -= dt; S.tick++;
    const player = S.teams[1];
    if (S.pendingEnd && S.t >= S.pendingEnd.at) { finishEnd(); return; }
    const finalPhase = S.timeLeft <= cfg.world.finalSeconds;
    if (S.fixture) S.fixture.drive(dt);
    else if (S.attract) {
      let alive = 0; for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive) alive++;
      if (alive <= 1 || S.timeLeft <= 0) { newGame(true, { keepMap: true }); return; } // attract mode keeps one map per title visit
    }
    if (finalPhase && !S.finalCalled) { S.finalCalled = true; banner("LAST MINUTE: every mob turns on the biggest", "#FFE49A", 3.5); PS.audio.bell(); showHint("Be the biggest swarm when the bell rings", 4); for (let i = 2; i < S.teams.length; i++) S.teams[i].thinkT = 0; }

    // player target and steering mode (SPEC-v2 §10)
    const inp = S.input;
    if (!S.attract && !S.fixture) playerControl(player);

    // AI think: one rival per tick
    aiTick(dt, D);

    // buffs tick, engagement reset, this tick's team speed (size curve, AI pace, speed buff)
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; for (const k in t.buffs) if (t.buffs[k] > 0) t.buffs[k] -= dt; for (let j = 0; j < 9; j++) { t.eng[j] = 0; t.fX[j] = 0; t.fY[j] = 0; }
      let s = A.speed * sizeSpeed(t.count) * t.speedMod; if (t.ai && !S.attract) s *= D.aiSpeed; if (t.buffs.speed > 0) s *= cfg.powerups.speedMult; t.spd = s; MEDN[i] = 0;
    }

    // flow fields: at most one team rebuild per tick, player first (SPEC-v2 §3); sim-tick scheduling keeps replays exact
    PS.flow.tick(S.teams, S.agents, S.tick);

    rebuildGrid();

    // per-agent steering + combat + terrain. Travel follows the team's field (or direct seek for drag, keys, hold and fighting pulls) with
    // arrive by path distance; path cohesion is a speed multiplier 1 + k (T - T_median) clamped, plus local cohesion toward same-team
    // neighbours from this same neighbour pass. A remnant (escapeT > 0) neither attacks nor is attacked and passes through enemies.
    const sepR = F.sepRadius, engR2 = A.engageRadius * A.engageRadius, atkR2 = A.attackRange * A.attackRange, rr2 = A.recruitRadius * A.recruitRadius;
    const eSep = sepR * F.enemySepMult, eSep2 = eSep * eSep, hard = F.enemyHardRadius, hard2 = hard * hard, lcR = FW.localCohesionRadius, lcR2 = lcR * lcR;
    const qTeam = Math.max(A.engageRadius, eSep, sepR, lcR), qNeutral = Math.max(sepR, A.recruitRadius), qTeam2 = qTeam * qTeam, qNeutral2 = qNeutral * qNeutral; // radius-limited neighbour scans
    const huddleP = inp.huddle, kLerp = 1 - Math.exp(-F.steerLerp * dt), pk = FW.pathCohesionK, pLo = FW.pathCohesionClamp[0], pHi = FW.pathCohesionClamp[1];
    const T = PS.terrain, TN = T.N, TC = T.cell, W1 = W - 0.001, terr = S.map.terr, sdfA = S.map.sdf, far = 2 * TC, slideM = FW.slideMargin, fordK = cfg.terrain.fordSpeed;
    const O = S.obs, OB = S.obstacles, FL = PS.flow, esc = CB.remnant.escapeSpeed;
    recN = 0;
    const nAg = S.agents.length;
    for (let idx = 0; idx < nAg; idx++) {
      const a = S.agents[idx];
      if (a.dead) continue;
      a.ph += dt * 9; if (a.fl > 0) a.fl -= dt; if (a.lunge > 0) a.lunge -= dt;
      if (a.pop < 0.35) { const was = a.pop; a.pop += dt; if (was < 0 && a.pop >= 0 && onScreen(a.x, a.y)) { const tc = S.teams[a.team]; if (tc) { particles.burst(a.x, a.y - 8, tc.color, 6, 80, 0.45, 3, 200); particles.ring(a.x, a.y - 8, tc.color, 4, 18, 0.3); } } }
      const team = a.team ? S.teams[a.team] : null, escaping = a.escapeT > 0;
      if (escaping) a.escapeT -= dt;
      gather(a.x, a.y, team ? qTeam : qNeutral);
      let sx = 0, sy = 0; // separation accumulator
      let dvx = 0, dvy = 0; // desired velocity
      let lcx = 0, lcy = 0, lcn = 0; // same-team neighbours (local cohesion)
      const hud = team && team.isPlayer && huddleP && !S.attract;
      const mySep = hud ? F.huddleSepRadius : sepR, mySep2 = mySep * mySep;
      const c0 = ((a.y < 0 ? 0 : a.y > W1 ? W1 : a.y) / TC | 0) * TN + ((a.x < 0 ? 0 : a.x > W1 ? W1 : a.x) / TC | 0);
      let speed = team ? team.spd : A.speed;
      if (hud) speed *= F.huddleSpeedMult;
      if (terr[c0] === 3) speed *= fordK;

      // find/keep combat target + separation + local cohesion (+ a neutral's nearest recruiter) in one pass
      let best = null, bestD2 = engR2, recT = 0, recD2 = rr2;
      if (a.tgt && (escaping || a.tgt.dead || a.tgt.team === a.team || a.tgt.team === 0 || a.tgt.escapeT > 0)) a.tgt = null;
      if (a.tgt) { const dx = a.tgt.x - a.x, dy = a.tgt.y - a.y; const d2 = dx * dx + dy * dy; if (d2 < engR2 * 4) { best = a.tgt; bestD2 = d2; } else a.tgt = null; }
      const at = a.team, q2 = team ? qTeam2 : qNeutral2; let ax = a.x, ay = a.y; // the enemy hard push moves this agent inside the loop: kept in locals, written back after
      for (let k = 0; k < nearN; k++) {
        const b = NEAR[k]; if (b === a || b.dead) continue;
        const bx = b.x, by = b.y, dx = ax - bx, dy = ay - by, d2 = dx * dx + dy * dy; if (d2 >= q2) continue; // the gather is a square of hash cells
        const bt = b.team;
        if (bt === at || team === null || bt === 0) { // same side, or a neutral either way: plain separation
          if (d2 < mySep2 && d2 > 0.0001) { const d = Math.sqrt(d2), f = (1 - d / mySep) / d; sx += dx * f; sy += dy * f; }
          if (team === null) { if (!escaping && bt !== 0 && d2 < recD2) { recD2 = d2; recT = bt; } }
          else if (bt === at && d2 < lcR2) { lcx += bx; lcy += by; lcn++; }
          continue;
        }
        if (escaping || b.escapeT > 0) continue; // a remnant passes through enemies, both ways
        if (d2 < eSep2 && d2 > 0.0001) {
          const d = Math.sqrt(d2), f = (1 - d / eSep) / d; sx += dx * f; sy += dy * f;
          if (d2 < hard2) { const push = (hard - d) * 0.5; ax += (dx / d) * push; ay += (dy / d) * push; }
        }
        if (d2 < bestD2 && !best) { best = b; bestD2 = d2; }
        else if (d2 < bestD2 && best && d2 < bestD2 * 0.5) { best = b; bestD2 = d2; }
      }
      a.x = ax; a.y = ay;
      if (recT && recN < REC.length) { a.rec = recT; REC[recN++] = a; }

      let vcap = speed; // this agent's speed before the 1.15 flocking headroom
      if (team) {
        // travel direction: the team field, or direct seek (drag, keys, hold, a field miss, or inside the arrive radius by path distance)
        const tdx = team.tx - a.x, tdy = team.ty - a.y, td = Math.sqrt(tdx * tdx + tdy * tdy);
        let ux = 0, uy = 0, tp = td;
        if (team.route) {
          // the field is sampled on alternate ticks per agent (direction and path distance cached; fok 0 = sample now, 1 = ok, -1 = miss)
          if (a.fok === 0 || ((idx + S.tick) & 1) === 0) { if (FL.sample(a.team, a.x, a.y, SMP)) { a.fdx = SMP.x; a.fdy = SMP.y; a.fieldT = SMP.t; a.fok = 1; } else a.fok = -1; }
          if (a.fok === 1) { tp = a.fieldT; if (tp > F.arrive) { ux = a.fdx; uy = a.fdy; } }
        }
        if (ux === 0 && uy === 0 && td > 2) { ux = tdx / td; uy = tdy / td; }
        let sp = speed * F.seek; if (tp < F.arrive) sp *= (td < tp ? td : tp) / F.arrive;
        if (escaping) {
          // escape window: run at remnant.escapeSpeed, and never back toward the rout's contact point
          const ex = a.x - a.ex, ey = a.y - a.ey, el = Math.sqrt(ex * ex + ey * ey) || 1;
          if (ux * ex + uy * ey <= 0) { ux = ex / el; uy = ey / el; }
          sp = speed * esc; vcap = sp;
        } else if (!best) {
          const m = 1 + pk * (tp - team.tMed), mk = m < pLo ? pLo : m > pHi ? pHi : m; sp *= mk; vcap = speed * mk;
          if (MEDN[a.team] < MED[a.team].length) MED[a.team][MEDN[a.team]++] = tp;
        }
        const seekX = ux * sp, seekY = uy * sp;
        // local cohesion toward the mean of same-team neighbours (nearly always on this side of any wall); huddle pulls to the anchor
        let cohX = 0, cohY = 0;
        if (lcn > 0) { const qx = lcx / lcn - a.x, qy = lcy / lcn - a.y, ql = Math.sqrt(qx * qx + qy * qy); if (ql > 1) { const k = (speed * FW.localCohesion * (ql < lcR ? ql / lcR : 1)) / ql; cohX = qx * k; cohY = qy * k; } }
        if (hud) {
          const cdx = team.ax - a.x, cdy = team.ay - a.y, cd = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cd > F.cohesionStart) { const k = clamp((cd - F.cohesionStart) / (F.cohesionFull - F.cohesionStart), 0, 1), w = (speed * F.huddleCohesion * (0.3 + 0.7 * k)) / cd; cohX += cdx * w; cohY += cdy * w; }
        }
        if (best) {
          a.tgt = best; a.fight = true; team.eng[best.team]++; team.fX[best.team] += a.x; team.fY[best.team] += a.y;
          const tdx2 = best.x - a.x, tdy2 = best.y - a.y, td2 = Math.sqrt(bestD2) || 1;
          const fs = speed * A.fightSpeedMult;
          if (bestD2 < atkR2 * 0.85) { dvx = 0; dvy = 0; } // hold the line at pitchfork reach
          else { dvx = (tdx2 / td2) * fs * CB.fightPull; dvy = (tdy2 / td2) * fs * CB.fightPull; }
          dvx += seekX * (1 - CB.fightPull) * 0.5 + cohX * 0.5;
          dvy += seekY * (1 - CB.fightPull) * 0.5 + cohY * 0.5;
          // melee cohesion: a fighter farther than contactPullStart from its engagement's contact point is pulled back toward it, so
          // pursuit chains and enemy pushes do not drift the melee apart (local strength counts within localRadius of that point)
          if (team.engT[best.team] > 0) { const qx = team.engCx[best.team] - a.x, qy = team.engCy[best.team] - a.y, ql = Math.sqrt(qx * qx + qy * qy); if (ql > CB.contactPullStart) { const w = (speed * CB.contactPull * Math.min(1, (ql - CB.contactPullStart) / CB.contactPullRamp)) / ql; dvx += qx * w; dvy += qy * w; } }
          // attack: 1.0 s interval with jitter, damage with agent.damageJitter, both on S.rng
          if (bestD2 < atkR2) {
            a.atk -= dt;
            if (a.atk <= 0) {
              a.atk = A.attackInterval * (0.8 + S.rng() * 0.4); a.lunge = 0.18;
              const tt = S.teams[best.team];
              let dmg = A.damage * (1 + A.damageJitter * (2 * S.rng() - 1)); if (team.buffs.frenzy > 0) dmg *= cfg.powerups.frenzyMult; if (tt.buffs.armor > 0) dmg *= cfg.powerups.armorMult;
              best.hp -= dmg; best.fl = 0.16;
              const vis = onScreen(best.x, best.y);
              if (vis) { particles.burst(best.x, best.y - 6, "#FFFFFF", 2, 60, 0.25, 2, 200); PS.audio.hit(); }
              if (best.hp <= 0) killAgent(best, a.team);
            }
          } else a.atk = Math.min(a.atk, A.attackInterval * 0.5);
        } else {
          a.fight = false; dvx = seekX + cohX; dvy = seekY + cohY;
        }
      } else {
        // neutral: idle wander around home camp; a neutral scattered by a finale rout runs to its scatter point first
        let dx = a.wx - a.x, dy = a.wy - a.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 3) { if (!escaping && S.rng() < 0.02) { const ang = S.rng() * Math.PI * 2, r = S.rng() * F.neutralWanderRadius; a.wx = a.hx + Math.cos(ang) * r; a.wy = a.hy + Math.sin(ang) * r; } }
        else { const s = escaping ? A.speed * esc : speed * F.neutralWander; dvx = (dx / d) * s; dvy = (dy / d) * s; if (escaping) vcap = s; }
      }
      // separation (velocity-space)
      const sl = Math.sqrt(sx * sx + sy * sy);
      if (sl > 0) { const sw = speed * F.separation; dvx += (sx / sl) * Math.min(sl * 40, 1) * sw; dvy += (sy / sl) * Math.min(sl * 40, 1) * sw; }
      // limit + steer
      const dl = Math.sqrt(dvx * dvx + dvy * dvy); const maxV = vcap * (team || escaping ? 1.15 : 0.5);
      if (dl > maxV) { dvx *= maxV / dl; dvy *= maxV / dl; }
      a.vx += (dvx - a.vx) * kLerp; a.vy += (dvy - a.vy) * kLerp;
      // wall slide: within r + slideMargin of a wall, drop the velocity component pointing into it (skipped when the cell is > 2 cells clear)
      if (sdfA[c0] <= far && sdfGrad(a.x, a.y) < a.r + slideM) { const vn = a.vx * GX + a.vy * GY; if (vn < 0) { a.vx -= vn * GX; a.vy -= vn * GY; } }
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (Math.abs(a.vx) > 8) a.face = a.vx > 0 ? 1 : -1;
      let c1 = ((a.y < 0 ? 0 : a.y > W1 ? W1 : a.y) / TC | 0) * TN + ((a.x < 0 ? 0 : a.x > W1 ? W1 : a.x) / TC | 0);
      // trees and rocks, bucketed: only agents whose cell has one within a cell check the 3x3 block
      if (O.near[c1]) {
        const ci = c1 % TN, cj = (c1 / TN) | 0;
        for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
          if (i < 0 || j < 0 || i >= TN || j >= TN) continue; const cc = j * TN + i;
          for (let k = O.st[cc]; k < O.st[cc + 1]; k++) {
            const ob = OB[O.list[k]]; const ox = a.x - ob.x, oy = a.y - ob.y; const rr = ob.r + a.r; const d2 = ox * ox + oy * oy;
            if (d2 < rr * rr && d2 > 0.001) { const d = Math.sqrt(d2); a.x = ob.x + (ox / d) * rr; a.y = ob.y + (oy / d) * rr; }
          }
        }
        c1 = ((a.y < 0 ? 0 : a.y > W1 ? W1 : a.y) / TC | 0) * TN + ((a.x < 0 ? 0 : a.x > W1 ? W1 : a.x) / TC | 0);
      }
      // terrain push-out last, after every other position push: one push along the SDF gradient, then the cell-exact guarantee
      if (sdfA[c1] <= far) {
        const s = sdfGrad(a.x, a.y);
        if (s < a.r && (GX || GY)) { a.x += GX * (a.r - s); a.y += GY * (a.r - s); c1 = ((a.y < 0 ? 0 : a.y > W1 ? W1 : a.y) / TC | 0) * TN + ((a.x < 0 ? 0 : a.x > W1 ? W1 : a.x) / TC | 0); }
        const tv = terr[c1]; if (tv === 1 || tv === 2) resolveBlocked(a, c1);
      }
    }

    // recruitment: each neutral found its nearest team agent within recruitRadius during its own neighbour pass
    for (let i = 0; i < recN; i++) { const a = REC[i]; REC[i] = null; if (!a.dead && a.team === 0 && a.rec) convert(a, a.rec, false); a.rec = 0; }
    recN = 0;

    // power-up pickup
    const pr = cfg.powerups.pickupRadius, pr2 = pr * pr;
    for (const p of S.powerups) {
      if (!p.alive) { p.t -= dt; if (p.t <= 0) { const np = newPowerup(false); p.x = np.x; p.y = np.y; p.kind = np.kind; p.alive = true; } continue; }
      p.t += dt;
      gather(p.x, p.y, pr);
      for (let k = 0; k < nearN; k++) { const b = NEAR[k]; if (b.team === 0 || b.dead) continue; const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < pr2) { pickup(p, b.team); break; } }
    }

    // camp head-counts (for "+N" labels) and campfire smoke
    for (const c of S.camps) c.n = 0;
    for (const a of S.agents) if (a.team === 0 && !a.dead && a.camp) a.camp.n++;
    for (const c of S.camps) { if (c.n === 0 || !onScreen(c.x, c.y)) continue; c.smokeT -= dt; if (c.smokeT <= 0) { c.smokeT = 0.5 + Math.random() * 0.5; particles.smoke(c.x + (Math.random() - 0.5) * 3, c.y - 6); } }

    recount();
    // path-cohesion medians for the next tick (selection over this tick's samples, no sort)
    for (let i = 1; i < S.teams.length; i++) if (MEDN[i] > 0) S.teams[i].tMed = medianOf(MED[i], MEDN[i]);
    // centroid velocity, smoothed (the AI hunt lead reads this, never the prey's target)
    const vk = 1 - Math.exp(-dt / cfg.ai.leadSmooth), vmax = 2 * A.speed;
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i];
      if (t.count > 0) { let vx = (t.cx - t.pcx) / dt, vy = (t.cy - t.pcy) / dt; const l = Math.sqrt(vx * vx + vy * vy); if (l > vmax) { vx *= vmax / l; vy *= vmax / l; } t.vx += (vx - t.vx) * vk; t.vy += (vy - t.vy) * vk; }
      t.pcx = t.cx; t.pcy = t.cy;
    }
    trackHome();

    // engagements and local rout (SPEC-v2 §6). Per engaged pair: the contact centroid is the mean of both sides' fighting agents; L is each
    // side's agents within combat.localRadius of it (remnants excluded), smoothed over moraleSmoothing, against this engagement's peak.
    // A side breaks after the engageDelay brace when L stays under breakRatio x the other's for breakHold, or its L/peak falls under
    // moraleBreak and 0.02 under the other's. Whole-team totals never enter the test. (The hash is still this tick's: no removal yet.)
    S.engagedNow = false;
    const ks = 1 - Math.exp(-dt / CB.moraleSmoothing), nT = S.teams.length;
    for (let i = 1; i < nT; i++) {
      const ta = S.teams[i]; if (!ta.alive) continue;
      for (let j = i + 1; j < nT; j++) {
        const tb = S.teams[j]; if (!tb.alive) continue;
        if (ta.eng[j] > 0 && tb.eng[i] > 0) {
          const nf = ta.eng[j] + tb.eng[i], cx = (ta.fX[j] + tb.fX[i]) / nf, cy = (ta.fY[j] + tb.fY[i]) / nf;
          localCount(cx, cy, CB.localRadius, i, j);
          if (ta.engT[j] === 0) { ta.engStart[j] = ta.count; tb.engStart[i] = tb.count; ta.engL[j] = LCA; tb.engL[i] = LCB; ta.engPk[j] = tb.engPk[i] = 0; ta.engHold[j] = tb.engHold[i] = 0; S.ev.fights++; if (ta.isPlayer || tb.isPlayer) S.stats.fights++; }
          else { ta.engL[j] += (LCA - ta.engL[j]) * ks; tb.engL[i] += (LCB - tb.engL[i]) * ks; }
          ta.engT[j] += dt; tb.engT[i] = ta.engT[j]; ta.engCx[j] = tb.engCx[i] = cx; ta.engCy[j] = tb.engCy[i] = cy;
          const La = ta.engL[j], Lb = tb.engL[i]; if (La > ta.engPk[j]) ta.engPk[j] = La; if (Lb > tb.engPk[i]) tb.engPk[i] = Lb;
          if (ta.isPlayer || tb.isPlayer) S.engagedNow = true;
          if (ta.engT[j] >= CB.engageDelay) {
            ta.engHold[j] = La < CB.breakRatio * Lb ? ta.engHold[j] + dt : 0; tb.engHold[i] = Lb < CB.breakRatio * La ? tb.engHold[i] + dt : 0;
            const mA = La / Math.max(1, ta.engPk[j]), mB = Lb / Math.max(1, tb.engPk[i]);
            const aBreak = LCA >= CB.minRoutSize && (ta.engHold[j] >= CB.breakHold || (mA < CB.moraleBreak && mA < mB - 0.02));
            const bBreak = LCB >= CB.minRoutSize && (tb.engHold[i] >= CB.breakHold || (mB < CB.moraleBreak && mB < mA - 0.02));
            if (aBreak && (!bBreak || mA <= mB)) rout(ta, tb, cx, cy, finalPhase); else if (bBreak) rout(tb, ta, cx, cy, finalPhase);
          }
        } else if (ta.engT[j] > 0) {
          ta.engT[j] = Math.max(0, ta.engT[j] - dt * CB.engageDecay); tb.engT[i] = ta.engT[j];
          if (ta.engT[j] === 0) { ta.engL[j] = tb.engL[i] = 0; ta.engPk[j] = tb.engPk[i] = 0; ta.engHold[j] = tb.engHold[i] = 0; }
        }
      }
    }

    // remove dead: swap-remove, no new array (after the engagement pass, which still reads this tick's hash by index)
    const ag = S.agents; for (let i = 0; i < ag.length;) { if (ag[i].dead) { ag[i] = ag[ag.length - 1]; ag.pop(); } else i++; }
    recount();

    // eliminations
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && t.count === 0) eliminate(t); }

    // trickle: every trickleEvery, trickleCamps camps; each is biased (underdogBias) to one of the two smallest living swarms and lands
    // trickleBeyond past that swarm's sight radius, never within minTrickleDistFromTeams of another swarm; off in the finale
    S.trickleT += dt;
    if (!finalPhase && S.trickleT >= cfg.spawn.trickleEvery) {
      S.trickleT = 0;
      const SP = cfg.spawn, FG = cfg.fog, md2 = SP.minTrickleDistFromTeams * SP.minTrickleDistFromTeams;
      let neutrals = 0; for (const a of S.agents) if (a.team === 0) neutrals++;
      let s1 = null, s2 = null;
      for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (!t.alive) continue; if (!s1 || t.count < s1.count) { s2 = s1; s1 = t; } else if (!s2 || t.count < s2.count) s2 = t; }
      for (let rep = 0; rep < SP.trickleCamps; rep++) {
        const nn = SP.campMin + ((S.rng() * (SP.campMax - SP.campMin + 1)) | 0); // size first: the cap check needs it (B0 bug 1)
        if (neutrals + nn > SP.trickleCap || S.agents.length + nn > S.cap) break;
        const pool = rep % 2 === 0 ? s1 : s2 || s1, fav = pool && S.rng() < SP.underdogBias ? pool : null;
        for (let n = 0; n < 40; n++) {
          let x, y;
          if (fav) { const R = FG.sight0 + FG.sightK * Math.sqrt(fav.count), ang = S.rng() * Math.PI * 2, d = R + SP.trickleBeyond[0] + S.rng() * (SP.trickleBeyond[1] - SP.trickleBeyond[0]); x = fav.cx + Math.cos(ang) * d; y = fav.cy + Math.sin(ang) * d; }
          else { const p = randPos(); x = p.x; y = p.y; }
          if (!placeOk(x, y, 2, 44)) continue;
          let ok = true; for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (!t.alive || t === fav) continue; const dx = t.cx - x, dy = t.cy - y; if (dx * dx + dy * dy < md2) { ok = false; break; } }
          if (!ok) continue;
          spawnCamp(x, y, nn); neutrals += nn; break;
        }
      }
    }
    // debug asserts (always counted, cheap): no agent centre in rock or deep water, total under the cap
    for (let i = 0; i < S.agents.length; i++) {
      const a = S.agents[i]; const c = ((a.y < 0 ? 0 : a.y > W1 ? W1 : a.y) / TC | 0) * TN + ((a.x < 0 ? 0 : a.x > W1 ? W1 : a.x) / TC | 0), tv = terr[c];
      if (tv === 1 || tv === 2 || a.x < 0 || a.y < 0 || a.x > W || a.y > H) { S.dbg.terrainBad++; if (!S.dbg.firstBad) S.dbg.firstBad = { t: +S.t.toFixed(2), x: +a.x.toFixed(1), y: +a.y.toFixed(1), team: a.team, terr: tv }; }
    }
    if (S.agents.length > S.cap) S.dbg.capOver++;

    // drum
    if (S.engagedNow && !PS.audio.drumOn()) PS.audio.startDrum(); else if (!S.engagedNow && PS.audio.drumOn()) PS.audio.stopDrum();

    // camera (SPEC-v2 §3): zoom by the swarm-size rule; follow with camera.lerp plus a velocity look-ahead (none under lookAheadMinSpeed of the
    // team's speed, capped at lookAheadCap of the half-extent); in a clash, centre between the two swarms (offset capped so you stay in view)
    const C = cfg.camera, cl = 1 - Math.exp(-C.lerp * dt), CS = S.camS;
    let camT = player;
    if (S.attract) { for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive && S.teams[i].count > camT.count) camT = S.teams[i]; }
    zoomRule(camT.count, dt, false);
    if (camT.count > 0) {
      const z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z; let gx = camT.cx, gy = camT.cy, lx = 0, ly = 0, ri = 0, bt = 0.1;
      if (!S.attract) for (let i = 1; i < S.teams.length; i++) if (i !== camT.id && S.teams[i].alive && camT.engT[i] > bt) { bt = camT.engT[i]; ri = i; }
      if (ri) { const r = S.teams[ri], cx = C.clashOffsetCap * hw, cy = C.clashOffsetCap * hh; gx += clamp((r.ax - camT.cx) / 2, -cx, cx); gy += clamp((r.ay - camT.cy) / 2, -cy, cy); }
      else { const v = Math.sqrt(camT.vx * camT.vx + camT.vy * camT.vy); if (v >= C.lookAheadMinSpeed * camT.spd) { lx = clamp(camT.vx * C.lookAhead, -C.lookAheadCap * hw, C.lookAheadCap * hw); ly = clamp(camT.vy * C.lookAhead, -C.lookAheadCap * hh, C.lookAheadCap * hh); } }
      CS.lx += (lx - CS.lx) * cl; CS.ly += (ly - CS.ly) * cl;
      const k = S.attract ? 0.4 : 1; S.cam.x += (gx + CS.lx - S.cam.x) * cl * k; S.cam.y += (gy + CS.ly - S.cam.y) * cl * k;
    }
    if (S.shake > 0) S.shake -= dt;

    // banners: one at a time, queued
    if (S.banners.length) { S.banners[0].life -= dt; if (S.banners[0].life <= 0) S.banners.shift(); }
    if (S.hintT > 0) { S.hintT -= dt; if (S.hintT <= 0 || S.engagedNow) { S.hintT = 0; if (!sandbox) $("hint").classList.remove("show"); } }

    if (S.attract || S.fixture) return;
    // stats + hints
    if (player.count > S.stats.peak) S.stats.peak = player.count;
    if (S.stats.recruited === 0 && S.t > 25 && !S._hintRecruit) { S._hintRecruit = true; showHint("Grey peasants are free recruits. Go touch them.", 3); }
    if (player.count >= 8 && !S._hintFight) { S._hintFight = true; showHint("Only fight rivals when you're bigger. Winners absorb the losers.", 5); }
    if (player.count >= 20 && !S._hintHud) { S._hintHud = true; showHint(S.input.touch ? "Hold HUDDLE to tighten the swarm before a clash" : "Hold SPACE to huddle up before a clash", 5); }

    // win / lose
    if (player.count === 0 && !S.result) endGame(false, S._routedBy ? "Your swarm broke and joined " + S._routedBy + "." : "Every last peasant fell.");
    else if (!S.result) {
      let rivals = 0; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive) rivals++;
      if (rivals === 0) endGame(true, "Every rival mob is gone. The whole valley marches under your banner.");
      else if (S.timeLeft <= 0) {
        let big = player; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].count > big.count) big = S.teams[i];
        if (big === player) endGame(true, "The bell rang and yours was the biggest swarm in the valley.");
        else endGame(false, big.name + " had the biggest swarm when the bell rang (" + big.count + " vs your " + player.count + ").");
      }
    }
  }

  function convert(a, team, absorbed) {
    const from = a.team; a.team = team; a.hp = S.cfg.agent.hp; a.tgt = null; a.fight = false; a.fl = absorbed ? 0 : 0.2; a.fok = 0;
    a.pop = absorbed ? -S.rng() * 0.45 : 0;
    const t = S.teams[team];
    if (onScreen(a.x, a.y)) {
      if (!absorbed) particles.burst(a.x, a.y - 6, t.color, 5, 80, 0.45, 3, 220);
      if (t.isPlayer && !absorbed) { PS.audio.recruit(); if (Math.random() < 0.35) floaters.add(a.x, a.y - 14, "+1", t.color, 13, 0.7); }
    }
    if (t.isPlayer && from === 0) S.stats.recruited++;
    if (from === 0 && !absorbed) bumpChip(team);
  }
  function killAgent(a, byTeam) {
    if (a.dead) return; a.dead = true;
    const t = S.teams[a.team]; if (t) { if (t.isPlayer) S.stats.lost++; }
    if (byTeam === 1) { S.stats.kills++; S.teams[1].kills++; }
    if (onScreen(a.x, a.y)) { particles.burst(a.x, a.y - 6, t ? t.color : "#B8A88A", 10, 120, 0.6, 4, 260); particles.burst(a.x, a.y - 6, "#F1C27D", 4, 90, 0.5, 3, 260); particles.ring(a.x, a.y - 6, "#FFFFFF", 3, 14, 0.22); PS.audio.die(a.team === 1); }
  }
  // local strength around a contact point: each side's agents within r (remnants excluded) into LCA / LCB
  let LCA = 0, LCB = 0;
  function localCount(x, y, r, ia, ib) {
    gather(x, y, r); const r2 = r * r; LCA = 0; LCB = 0;
    for (let k = 0; k < nearN; k++) { const b = NEAR[k]; if (b.dead || b.escapeT > 0 || (b.team !== ia && b.team !== ib)) continue; const dx = b.x - x, dy = b.y - y; if (dx * dx + dy * dy < r2) { if (b.team === ia) LCA++; else LCB++; } }
  }
  // the median of arr[0..n) by in-place selection (Hoare, middle pivot: deterministic, no sort, no allocation)
  function medianOf(arr, n) {
    const k = n >> 1; let lo = 0, hi = n - 1;
    for (let g = 0; hi > lo && g < 64; g++) {
      const pv = arr[(lo + hi) >> 1]; let i = lo, j = hi;
      while (i <= j) { while (arr[i] < pv) i++; while (arr[j] > pv) j--; if (i <= j) { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; i++; j--; } }
      if (k <= j) hi = j; else if (k >= i) lo = i; else break;
    }
    return arr[k];
  }
  const biggestTeam = () => { let b = null; for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && (!b || t.count > b.count)) b = t; } return b; };
  // spoils by proximity: the team of the nearest agent, among every team engaged with the loser, that is fighting within spoilsRadius
  function spoilsTeam(a, loser, winner) {
    const r = S.cfg.combat.spoilsRadius; gather(a.x, a.y, r); let best = 0, bd = r * r;
    for (let k = 0; k < nearN; k++) {
      const b = NEAR[k]; if (b.dead || !b.fight || b.team === 0 || b.team === loser.id || b.escapeT > 0) continue;
      const t = S.teams[b.team]; if (!t || !(t.eng[loser.id] > 0 || t.engT[loser.id] > 0)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = b.team; }
    }
    return best || winner.id;
  }
  // a finale survivor that the crowned team would absorb scatters as a neutral instead (finale.crownAbsorbs false)
  function scatter(a, cx, cy) {
    const RM = S.cfg.combat.remnant, dx = a.x - cx, dy = a.y - cy, l = Math.sqrt(dx * dx + dy * dy) || 1, d = RM.scatterDist[0] + S.rng() * (RM.scatterDist[1] - RM.scatterDist[0]);
    const p = PS.flow.rayOut(a.x, a.y, dx / l, dy / l, d, null);
    a.team = 0; a.hp = S.cfg.agent.hp; a.tgt = null; a.fight = false; a.camp = null; a.hx = a.wx = p.x; a.hy = a.wy = p.y; a.escapeT = RM.escapeSeconds; a.ex = cx; a.ey = cy; a.fl = 0.2;
  }
  // local rout (SPEC-v2 §6): only the loser's engaged group breaks. Flood-fill from its fighting agents near the contact through same-team
  // neighbours within combat.routLink; of that group's survivors by distance to the contact: under remnant.minLoser all flip, else the
  // nearest flipShare flip (never one beyond remnant.flipRadius) and the rest run as a remnant (escape window, then REGROUP for AI).
  // After the horn every survivor flips, except that the crowned team (the biggest swarm stands in until M4) absorbs nothing while
  // finale.crownAbsorbs is false: those scatter as neutrals. Agents outside the group keep their colour.
  const RQ = []; let routStamp = 0;
  function rout(loser, winner, cx, cy, finalPhase) {
    const cfg = S.cfg, CB = cfg.combat, RM = CB.remnant, ag = S.agents, lr2 = CB.localRadius * CB.localRadius, link2 = CB.routLink * CB.routLink, stamp = ++routStamp;
    const loserBefore = loser.count, winnerBefore = winner.count; let n = 0;
    for (let pass = 0; pass < 2 && n === 0; pass++) for (const a of ag) { // seeds: fighting agents near the contact (any agent near it if none fights)
      if (a.team !== loser.id || a.dead || a.escapeT > 0 || (pass === 0 && !a.fight)) continue;
      const dx = a.x - cx, dy = a.y - cy; if (dx * dx + dy * dy < lr2) { a.groupId = stamp; RQ[n++] = a; }
    }
    for (let h = 0; h < n; h++) {
      const a = RQ[h]; gather(a.x, a.y, CB.routLink);
      for (let k = 0; k < nearN; k++) { const b = NEAR[k]; if (b.team !== loser.id || b.dead || b.groupId === stamp || b.escapeT > 0) continue; const dx = b.x - a.x, dy = b.y - a.y; if (dx * dx + dy * dy < link2) { b.groupId = stamp; RQ[n++] = b; } }
    }
    for (let k = 0; k < n; k++) { const a = RQ[k], dx = a.x - cx, dy = a.y - cy; a.rd = Math.sqrt(dx * dx + dy * dy); }
    const group = RQ.slice(0, n).sort((p, q) => p.rd - q.rd); // a rare event: one small allocation is fine; stable sort keeps replays exact
    const full = finalPhase || n < RM.minLoser;
    let nFlip = full ? n : Math.round(RM.flipShare * n);
    if (!full) { let within = 0; for (const a of group) if (a.rd <= RM.flipRadius) within++; if (within < nFlip) nFlip = within; }
    const crown = finalPhase && !cfg.finale.crownAbsorbs ? biggestTeam() : null, got = z9();
    let flipped = 0, scattered = 0, fled = 0, farFlip = 0, minFlipX = Infinity;
    for (let k = 0; k < n; k++) {
      const a = group[k];
      if (k < nFlip) {
        if (a.rd > farFlip) farFlip = a.rd; if (a.x < minFlipX) minFlipX = a.x;
        const to = spoilsTeam(a, loser, winner);
        if (crown && to === crown.id) { scatter(a, cx, cy); scattered++; } else { convert(a, to, true); got[to]++; flipped++; }
      } else { a.escapeT = RM.escapeSeconds; a.ex = cx; a.ey = cy; a.tgt = null; a.fight = false; fled++; }
    }
    loser.engT[winner.id] = winner.engT[loser.id] = 0; loser.engL[winner.id] = winner.engL[loser.id] = 0; loser.engPk[winner.id] = winner.engPk[loser.id] = 0; loser.engHold[winner.id] = winner.engHold[loser.id] = 0;
    S.ev.routs++; if (fled) S.ev.remnants++; if (scattered) S.ev.scattered += scattered;
    if (fled && loser.ai) { loser.regroupUntil = S.t + RM.escapeSeconds + RM.regroupSeconds; loser.fleeFrom = winner.id; loser.thinkT = 0; }
    S.lastRout = { t: +S.t.toFixed(3), loser: loser.id, winner: winner.id, group: n, flipped, fled, scattered, outside: loserBefore - n, got: got.slice(), loserBefore, winnerBefore,
      cx: Math.round(cx), cy: Math.round(cy), farFlip: +farFlip.toFixed(1), minFlipX: minFlipX === Infinity ? null : Math.round(minFlipX) };
    if (winner.isPlayer) { S.stats.routs++; PS.audio.rout(true); banner(scattered && !got[1] ? "ROUTED: " + scattered + " SCATTER" : "+" + got[1] + " JOIN YOU" + (fled ? " · " + fled + " FLED" : ""), winner.color, 2.6); S.shake = 0.35; }
    else if (loser.isPlayer) { S._routedBy = winner.name; PS.audio.rout(false); S.shake = 0.5; if (flipped + scattered < loserBefore) banner(fled ? "SCATTERED: " + fled + " escaped" : "-" + (flipped + scattered) + " JOINED " + winner.name.toUpperCase(), "#FF7A6E", 2.4); }
    else { banner(loser.name.toUpperCase() + " routed by " + winner.name, winner.color, 2); if (onScreen(cx, cy)) PS.audio.rout(false); }
    particles.ring(cx, cy, winner.color, 10, 120, 0.7);
    recount();
  }
  function eliminate(t) {
    t.alive = false; t.count = 0;
    buildTeamChips();
    if (!t.isPlayer && !S.attract) { banner(t.name.toUpperCase() + " ELIMINATED", t.color, 2.4); PS.audio.eliminated(); }
  }
  function pickup(p, teamId) {
    const cfg = S.cfg.powerups, t = S.teams[teamId];
    p.alive = false; p.t = cfg.respawn;
    if (p.kind === "rally") {
      let n = 0;
      for (const a of S.agents) { if (a.team !== 0 || a.dead) continue; const dx = a.x - p.x, dy = a.y - p.y; if (dx * dx + dy * dy < cfg.rallyRadius * cfg.rallyRadius) { convert(a, teamId, false); n++; } }
      t.buffs.rally = cfg.duration.rally;
      particles.ring(p.x, p.y, S.spr.PU.rally.color, 10, cfg.rallyRadius, 0.6);
      if (t.isPlayer) { floaters.add(p.x, p.y - 20, "RALLY! +" + n, S.spr.PU.rally.color, 18, 1.3); PS.audio.power("rally"); S.stats.powerups++; }
    } else {
      t.buffs[p.kind] = cfg.duration[p.kind];
      if (t.isPlayer) { floaters.add(p.x, p.y - 20, p.kind.toUpperCase() + "!", S.spr.PU[p.kind].color, 18, 1.1); PS.audio.power(p.kind); S.stats.powerups++; }
    }
    particles.burst(p.x, p.y, S.spr.PU[p.kind].color, 14, 110, 0.6, 2.5, 120);
  }

  // ---------------------------------------------------------------- player control (SPEC-v2 §10)
  // Drag and keys steer directly along a ray-cast from the anchor (no field, wall slide); taps, clicks and the minimap route through the
  // player's field (a tapped rival is chased); the desktop cursor routes (input.desktopMode "route", with route hysteresis) or steers
  // ("steer"); a hold stops the swarm where it stands. With no live input the last (or scripted) target is kept. Sets tx/ty, mode, route, hyst.
  function playerControl(p) {
    const inp = S.input, joy = inp.joy, cfg = S.cfg, FL = PS.flow, kn = PS.knowledge, r = inp.route, W = cfg.world.w, H = cfg.world.h;
    let kx = 0, ky = 0;
    if (inp.keys.w || inp.keys.ArrowUp) ky -= 1; if (inp.keys.s || inp.keys.ArrowDown) ky += 1;
    if (inp.keys.a || inp.keys.ArrowLeft) kx -= 1; if (inp.keys.d || inp.keys.ArrowRight) kx += 1;
    if (joy.active) {
      const J = cfg.touch; let jx = joy.cx - joy.ox, jy = joy.cy - joy.oy; const len = Math.hypot(jx, jy);
      if (len > J.joyDead) { const mag = Math.min(1, (len - J.joyDead) / (J.joyRadius - J.joyDead)); jx /= len; jy /= len; joy.dx = jx; joy.dy = jy; joy.mag = mag; const q = FL.rayOut(p.ax, p.ay, jx, jy, mag * J.joyLead, kn); p.tx = q.x; p.ty = q.y; }
      else { joy.mag = 0; p.tx = p.ax; p.ty = p.ay; }
      p.mode = "steer";
    } else if (kx || ky) { const l = Math.hypot(kx, ky), q = FL.rayOut(p.ax, p.ay, kx / l, ky / l, cfg.input.keyLead, kn); p.tx = q.x; p.ty = q.y; p.mode = "steer"; r.on = false; inp.hold = false; }
    else if (r.on) {
      let x = r.x, y = r.y;
      if (r.chase) { const c = S.teams[r.chase]; if (c && c.alive && c.count > 0) { x = c.ax; y = c.ay; } else { r.on = false; r.chase = 0; holdHere(p); } }
      if (r.on) { const q = FL.rayBack(p.ax, p.ay, x, y, kn); p.tx = q.x; p.ty = q.y; p.mode = "route"; }
    } else if (inp.hold) p.mode = "hold";
    else if (inp.active) { const w = screenToWorld(inp.px, inp.py), q = FL.rayBack(p.ax, p.ay, clamp(w.x, 40, W - 40), clamp(w.y, 40, H - 40), kn); p.tx = q.x; p.ty = q.y; p.mode = cfg.input.desktopMode === "steer" ? "steer" : "route"; }
    else if (p.mode !== "hold") { const q = FL.rayBack(p.ax, p.ay, p.tx, p.ty, kn); p.tx = q.x; p.ty = q.y; } // the last or a scripted target, snapped
    p.route = p.mode === "route"; p.hyst = p.route && !r.on;
  }
  function holdHere(p) { S.input.hold = true; S.input.route.on = false; p.tx = p.ax; p.ty = p.ay; p.mode = "hold"; }
  // a tap (or left click) routes: a rival agent under the finger is chased, a camp under it is the destination, else the point itself
  function tapAt(sx, sy, src) {
    if (S.mode !== "play") return;
    const w = screenToWorld(sx, sy), pick = S.cfg.input.pickPx / S.cam.zoom; let chase = 0, bd = pick * pick, gx = w.x, gy = w.y;
    for (const a of S.agents) { if (a.dead || a.team < 2 || a.escapeT > 0 || !onScreen(a.x, a.y)) continue; const dx = a.x - w.x, dy = a.y - w.y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; chase = a.team; } }
    if (!chase) { let cd = 2.6 * pick * pick; for (const c of S.camps) { if (!c.n) continue; const dx = c.x - w.x, dy = c.y - w.y, d2 = dx * dx + dy * dy; if (d2 < cd) { cd = d2; gx = c.x; gy = c.y; } } }
    setRoute(gx, gy, chase, src || "tap", sx, sy);
  }
  function setRoute(x, y, chase, src, sx, sy) { const inp = S.input, r = inp.route; r.on = true; r.x = x; r.y = y; r.chase = chase; r.src = src; r.sx = sx; r.sy = sy; inp.hold = false; inp.preview = S.cfg.flow.previewSeconds; }

  // ---------------------------------------------------------------- AI
  // AI think, one rival per tick: every due team waits its turn in round-robin order, so a tick carries at most one think (and one
  // "from me" field). thinkT counts sim seconds of fixed ticks, so it is tick-exact.
  function aiTick(dt, D) {
    const n = S.teams.length, i0 = S.attract ? 1 : 2; let pick = 0;
    for (let i = i0; i < n; i++) { const t = S.teams[i]; if (t.alive && t.ai) t.thinkT -= dt; }
    for (let k = 0; k < n; k++) { const i = (S.thinkRR + k) % n; if (i < i0) continue; const t = S.teams[i]; if (t.alive && t.ai && t.thinkT <= 0) { pick = i; break; } }
    if (pick) { const t = S.teams[pick]; t.thinkT = S.attract ? S.cfg.ai.think : D.think; S.thinkRR = pick + 1; aiThink(t); }
  }
  // every AI target is snapped along a ray back toward (fx, fy) (default: the team's own anchor): the edge of any rock facing it
  function aim(t, x, y, fx, fy) { const W = S.cfg.world.w, p = PS.flow.rayBack(fx == null ? t.ax : fx, fy == null ? t.ay : fy, clamp(x, 20, W - 20), clamp(y, 20, S.cfg.world.h - 20), null); t.tx = p.x; t.ty = p.y; }
  // AI decisions on path distance (M2): a "from me" field out to ai.sight x flow.fromMeCap gives every distance aiThink uses, so a camp
  // behind a ridge scores as far as it really is; past the field's edge a distance is max(cap, straight x flow.farDetour). Sight stays a
  // straight line (terrain blocks movement, not sight). The team field then routes to whatever target is picked.
  function aiThink(t) {
    const cfg = S.cfg, P = t.ai, AI = cfg.ai, FW = cfg.flow, FL = PS.flow;
    const final = S.timeLeft <= cfg.world.finalSeconds, cap = AI.sight * FW.fromMeCap, me = FL.buildFromMe(t.id, t.ax, t.ay, cap);
    const dist = (x, y) => { const d = FL.pathPx(me, x, y); if (d >= 0) return d; const dx = x - t.ax, dy = y - t.ay; return Math.max(cap, Math.sqrt(dx * dx + dy * dy) * FW.farDetour); };
    const regroup = !final && S.t < t.regroupUntil;
    let biggest = null; for (let i = 1; i < S.teams.length; i++) { const o = S.teams[i]; if (o.alive && (!biggest || o.count > biggest.count)) biggest = o; }
    const sight2 = final ? 1e12 : AI.sight * AI.sight;
    const fleeRatio = final ? AI.finalFleeRatio : P.fleeRatio;
    let threat = null, threatD = Infinity, prey = null, preyScore = 0;
    for (let i = 1; i < S.teams.length; i++) {
      const o = S.teams[i]; if (o === t || !o.alive) continue;
      const dx = o.cx - t.cx, dy = o.cy - t.cy; if (dx * dx + dy * dy > sight2) continue;
      const d = dist(o.ax, o.ay);
      let huntRatio = final && o === biggest ? AI.finalHuntRatio : P.huntRatio * (S.attract ? 1 : diff().huntMult);
      if (!final && !o.isPlayer) huntRatio *= AI.aiVsAiHuntMult;
      if (!final && S.t < AI.gracePeriod) huntRatio = 1e9; // nobody hunts before the grace period ends
      if (!(final && o === biggest) && o.count >= t.count * fleeRatio && d < threatD) { threat = o; threatD = d; }
      if (!regroup && t.count >= o.count * huntRatio && t.count >= 3 && S.t >= (t.huntCooldown || 0)) {
        const sc = (o.count + 2) / (d + 60) * (o.isPlayer ? P.hatesPlayer : 1);
        if (sc > preyScore) { preyScore = sc; prey = o; }
      }
    }
    if (threat && threatD < AI.corneredDist && t.count >= 3) {
      // caught: turn and fight rather than drag a hopeless chase across the map
      aim(t, threat.ax, threat.ay); t.state = "hunt"; t.speedMod = AI.huntSpeed; return;
    }
    if (threat) { t.speedMod = AI.fleeSpeed; const q = fleeTarget(t, threat, me, false); aim(t, q.x, q.y); t.state = "flee"; return; }
    if (prey) {
      if (t.state !== "hunt") t.huntStart = S.t;
      let engagedAny = 0; for (let j = 1; j < 9; j++) engagedAny += t.eng[j];
      if (!final && S.t - t.huntStart > AI.huntTimeout && engagedAny === 0) { t.huntCooldown = S.t + AI.huntCooldown; prey = null; }
    }
    if (prey) {
      // lead the prey by its centroid velocity (never its target: for the player that is the cursor), snapped back toward the prey
      aim(t, prey.ax + prey.vx * AI.leadTime, prey.ay + prey.vy * AI.leadTime, prey.ax, prey.ay); t.state = "hunt"; t.speedMod = AI.huntSpeed; return;
    }
    if (regroup) { const fo = S.teams[t.fleeFrom]; if (fo && fo.alive && fo.count > 0) { const q = fleeTarget(t, fo, me, true); aim(t, q.x, q.y); t.state = "regroup"; t.speedMod = AI.roamSpeed; return; } }
    // roam: best neutral cluster or power-up by value / path distance
    let best = null, bestS = 0;
    for (const a of S.agents) {
      if (a.team !== 0 || a.dead || a.escapeT > 0) continue;
      const sc = P.neutralBias * AI.neutralScore / (dist(a.hx, a.hy) + 120);
      if (sc > bestS) { bestS = sc; best = a; }
    }
    let tx = best ? best.hx : t.cx, ty = best ? best.hy : t.cy;
    for (const p of S.powerups) {
      if (!p.alive) continue;
      const dx = p.x - t.cx, dy = p.y - t.cy; if (dx * dx + dy * dy > AI.powerupSight * AI.powerupSight) continue;
      const sc = P.powerBias * AI.powerScore / (dist(p.x, p.y) + 120);
      if (sc > bestS) { bestS = sc; tx = p.x; ty = p.y; }
    }
    if (!best && bestS === 0) { const p = randPos(); tx = p.x; ty = p.y; }
    aim(t, tx, ty); t.state = "roam"; t.speedMod = AI.roamSpeed;
  }
  // Brogue's Dijkstra-map flee: among the camps (and, unless campsOnly, pass cells) reachable inside the "from me" field, the one that
  // maximises (the threat's path distance - mine), camps favoured by flow.fleeCampBonus px; if none gains distance, straight away from
  // the threat by ai.fleeDistance, stopped at the first rock. Replaces v1's slide along the map edge.
  const FC = new Int32Array(4096), FCK = new Uint8Array(4096), FP = { x: 0, y: 0 };
  function fleeTarget(t, threat, me, campsOnly) {
    const FL = PS.flow, FW = S.cfg.flow, max = Math.min(FC.length, FW.fleeCandidates), cell = S.map.cell; let n = 0;
    FL.needBegin();
    for (const c of S.camps) { if (!c.n || n >= max) continue; const k = FL.cellFor(c.x, c.y); if (FL.pathCell(me, k) < 0) continue; FC[n] = k; FCK[n++] = 1; FL.needAdd(k); }
    if (!campsOnly) { const pc = S.map.place.passCells; for (let i = 0; i < pc.length && n < max; i++) { if (FL.pathCell(me, pc[i]) < 0) continue; FC[n] = pc[i]; FCK[n++] = 0; FL.needAdd(pc[i]); } }
    if (n) {
      const dx = threat.ax - t.ax, dy = threat.ay - t.ay, capPx = 2 * S.cfg.ai.sight * FW.fromMeCap + Math.sqrt(dx * dx + dy * dy) * FW.farDetour, th = FL.buildThreat(threat.ax, threat.ay, capPx);
      let bi = -1, bs = 0;
      for (let i = 0; i < n; i++) { const dT = FL.pathCell(th, FC[i]), s = (dT < 0 ? capPx : dT) - FL.pathCell(me, FC[i]) + (FCK[i] ? FW.fleeCampBonus : 0); if (s > bs) { bs = s; bi = i; } }
      if (bi >= 0) { const c = FC[bi], N = S.map.N; FP.x = ((c % N) + 0.5) * cell; FP.y = (((c / N) | 0) + 0.5) * cell; return FP; }
    }
    const dx = t.ax - threat.ax, dy = t.ay - threat.ay, d = Math.sqrt(dx * dx + dy * dy) || 1;
    return FL.rayOut(t.ax, t.ay, dx / d, dy / d, S.cfg.ai.fleeDistance, null);
  }

  // ---------------------------------------------------------------- camera zoom (SPEC-v2 §3)
  // span = span0 + spanK sqrt(n); zoom = clamp(shortSide / span) quantised to the DPR's step table (touch may go to zoomMinTouch), a step
  // changes only when the raw zoom passes a midpoint by camera.hysteresis, and eases over camera.ease seconds. now: jump to the step.
  const stepCache = {};
  function zoomSteps() {
    const C = S.cfg.camera, hi = S.dpr >= 2, lo = S.input.touch ? C.zoomMinTouch : C.zoomMin, key = (hi ? "2:" : "1:") + lo;
    return stepCache[key] || (stepCache[key] = (() => { const a = (hi ? C.steps.dpr2 : C.steps.dpr1).filter((z) => z >= lo - 1e-9 && z <= C.zoomMax + 1e-9); return a.length ? a : [1]; })());
  }
  function zoomRule(n, dt, now) {
    if (!S.cfg) return;
    const C = S.cfg.camera, Z = S.camS, st = zoomSteps(), raw = Math.min(S.vw, S.vh) / (C.span0 + C.spanK * Math.sqrt(Math.max(1, n)));
    let i = Z.i;
    if (now || i < 0 || Z.steps !== st) { i = 0; for (let k = 1; k < st.length; k++) if (Math.abs(st[k] - raw) < Math.abs(st[i] - raw)) i = k; }
    else { for (let g = 0; g < st.length && i + 1 < st.length && raw > ((st[i] + st[i + 1]) / 2) * (1 + C.hysteresis); g++) i++; for (let g = 0; g < st.length && i > 0 && raw < ((st[i] + st[i - 1]) / 2) * (1 - C.hysteresis); g++) i--; }
    if (now || i !== Z.i || Z.steps !== st) { Z.from = now || Z.i < 0 ? st[i] : S.cam.zoom; Z.t = now || Z.i < 0 ? C.ease : 0; Z.i = i; Z.steps = st; }
    Z.t = Math.min(C.ease, Z.t + dt); const k = C.ease > 0 ? Z.t / C.ease : 1, e = k * k * (3 - 2 * k);
    S.cam.zoom = Z.from + (st[i] - Z.from) * e;
  }

  // the clash panel's read of the player's fight with rival ri: counts x power (the hook M6 fills; 1.0 in M2) and a verdict from the local
  // strength ratio and morale (L / peak), blended with the headcount ratio by a geometric mean so a 427 v 227 clash opens as WINNING
  const teamPower = (t) => 1;
  const CR = { f: 0.5, verdict: "EVEN", a: 0, b: 0 };
  function clashRead(pl, t) {
    const ri = t.id, pa = teamPower(pl), pb = teamPower(t), La = pl.engL[ri] * pa, Lb = t.engL[pl.id] * pb, mA = pl.engL[ri] / Math.max(1, pl.engPk[ri]), mB = t.engL[pl.id] / Math.max(1, t.engPk[pl.id]);
    const sa = Math.sqrt(Math.max(0, La) * pl.count * pa) * mA, sb = Math.sqrt(Math.max(0, Lb) * t.count * pb) * mB;
    CR.a = Math.round(pl.count * pa); CR.b = Math.round(t.count * pb); CR.f = sa + sb > 0 ? sa / (sa + sb) : 0.5; CR.verdict = CR.f > 0.56 ? "WINNING" : CR.f < 0.44 ? "LOSING" : "EVEN";
    return CR;
  }
  // M3 hook: a third swarm within 400 px of the player's contact while it fights (M3 swaps onScreen for playerSees)
  function clashIncoming(pl, ri) {
    const x = pl.engCx[ri], y = pl.engCy[ri]; let best = null, bd = 400 * 400;
    for (let i = 2; i < S.teams.length; i++) { const t = S.teams[i]; if (i === ri || !t.alive || !t.count || !onScreen(t.ax, t.ay)) continue; const dx = t.ax - x, dy = t.ay - y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = t; } }
    return best;
  }

  // ---------------------------------------------------------------- helpers
  function screenToWorld(sx, sy) { const z = S.cam.zoom; return { x: (sx - S.vw / 2) / z + S.cam.x, y: (sy - S.vh / 2) / z + S.cam.y }; }
  function onScreen(x, y) { const z = S.cam.zoom, hw = S.vw / 2 / z + 40, hh = S.vh / 2 / z + 40; return Math.abs(x - S.cam.x) < hw && Math.abs(y - S.cam.y) < hh; }
  function banner(text, color, life) { if (S.attract) return; S.banners.push({ text, color, life, life0: life }); }
  function showHint(text, secs) { if (sandbox || S.attract || S.result) return; const h = $("hint"); h.textContent = text; h.classList.add("show"); S.hintT = secs; }
  function bumpChip(teamId) { if (sandbox) return; const el = $("chip-" + teamId); if (!el) return; el.classList.add("bump"); clearTimeout(el._bt); el._bt = setTimeout(() => el.classList.remove("bump"), 140); }

  function endGame(won, why) {
    if (S.attract || S.result) return;
    S.result = won ? "win" : "lose";
    PS.audio.stopDrum();
    S.pendingEnd = { won, why, at: S.t + (won ? 0.9 : 1.2) }; // sim-time delay: pausing defers it, newGame clears it
  }
  function finishEnd() {
    if (sandbox) return;
    const { won, why } = S.pendingEnd; S.pendingEnd = null;
    {
      S.mode = won ? "win" : "lose";
      if (won) PS.audio.win(); else PS.audio.lose();
      $(won ? "win-sub" : "lose-sub").textContent = why;
      const st = S.stats, el = $(won ? "win-stats" : "lose-stats");
      const mm = Math.floor((S.cfg.world.matchSeconds - Math.max(0, S.timeLeft)) / 60), ss = Math.floor((S.cfg.world.matchSeconds - Math.max(0, S.timeLeft)) % 60);
      el.innerHTML = [["Peak swarm", st.peak], ["Recruited", st.recruited], ["Routs", st.routs], ["Kills", st.kills], ["Power-ups", st.powerups], ["Time", mm + ":" + (ss < 10 ? "0" : "") + ss]]
        .map(([k, v]) => "<div class='stat'><b>" + v + "</b><span>" + k + "</span></div>").join("");
      showOverlay(won ? "ov-win" : "ov-lose");
    }
  }

  // ---------------------------------------------------------------- frame loop: fixed 1/60 s ticks through an accumulator
  let lastFrame = 0, rafPending = false;
  function schedule() { if (rafPending) return; rafPending = true; requestAnimationFrame((t) => { rafPending = false; frame(t, false); }); }
  function frame(now, fromFallback) {
    if (!fromFallback || !rafPending) schedule();
    let raw = (now - lastFrame) / 1000 || 0; lastFrame = now;
    if (raw < 0) raw = 0; // resume() and the fallback clock can hand in an earlier stamp (B0 bug 2)
    const wall = performance.now(); S.frameN++;
    if (wall - S.fpsT0 >= 500) { S.fps = Math.round((S.frameN * 1000) / (wall - S.fpsT0)); S.fpsT0 = wall; S.frameN = 0; }
    // touch hold: a finger down longer than input.tapMs without moving input.tapPx stops the swarm (input state only; the sim reads it)
    const tp = S.input.tp; if (tp.active && !tp.drag && !tp.hold && wall - tp.t0 > S.cfg.input.tapMs) { tp.hold = true; if (S.mode === "play" && S.teams[1]) holdHere(S.teams[1]); }
    if (S.fixture && S.mode === "play") { const fx = S.fixture; if (fx.done()) { if (fx.doneAt < 0) fx.doneAt = S.t; else if (S.t - fx.doneAt > 2) startFixtureLive(fx.name); } }
    if (S.mode === "play" || (S.mode === "title" && S.attract)) {
      // live play catches up at most 2 ticks per frame and drops the rest; the hidden-tab fallback clock may run 8
      S.acc += raw; let n = Math.floor(S.acc / DT + 1e-6); const cap = fromFallback ? 8 : 2;
      if (n > cap) { n = cap; S.acc = 0; } else S.acc = Math.max(0, S.acc - n * DT);
      const reps = S.attract ? 1 : S.pace;
      for (let k = 0; k < n; k++) for (let i = 0; i < reps; i++) { if (S.mode === "play" || (S.mode === "title" && S.attract)) update(DT); }
      const jt = Math.min(raw, 0.1); particles.update(jt); floaters.update(jt); if (S.input.preview > 0) S.input.preview -= jt; // juice runs on frame time (studio lesson 2)
      if (S.mode === "play") updateHUD();
    } else S.acc = 0;
    draw();
  }

  // ---------------------------------------------------------------- ground chunk cache (SPEC-v2 §2): 512 world px chunks at 256 art px, drawn at 2x
  // Static ground (grass tiles, trails, decals, terrain) is baked per chunk; chunks with water get a second baked frame, swapped every
  // waterFrameMs. Visible dirty chunks bake at once, the rest one per frame. Camp dirt, props and power-ups stay sprites.
  const TPAL = { top: "#8E8A7A", topLit: "#9A9686", face: "#615C50", base: "#2E2B25", water: ["#4A8CCB", "#3A74B2", "#2C5C93"], glint: "#A8D2F2",
    sand: "#C9B27C", sandD: "#B39A63", stone: "#7B776C", plank: "#8E6738", plankD: "#5E4222", beyond: "#8E8A7A" };
  function ground(m) {
    if (m.chunks) return m.chunks;
    const cfg = S.cfg.terrain, n = Math.ceil(S.cfg.world.w / cfg.chunk), N = m.N, per = cfg.chunk / m.cell, water = new Uint8Array(n * n);
    for (let c = 0; c < N * N; c++) if (m.terr[c] === 2 || m.terr[c] === 3) { const i = ((c % N) / per) | 0, j = (((c / N) | 0) / per) | 0; water[j * n + i] = 1; }
    return (m.chunks = { n, cvA: new Array(n * n).fill(null), cvB: new Array(n * n).fill(null), water, dirty: new Uint8Array(n * n).fill(1), left: n * n, scan: 0 });
  }
  function groundInvalidate(m) { const G = ground(m); G.dirty.fill(1); G.left = G.n * G.n; }
  function releaseGround(m) { const G = m.chunks; if (!G) return; for (const cv of G.cvA.concat(G.cvB)) if (cv) { cv.width = 0; cv.height = 0; } m.chunks = null; }
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function bakeChunk(m, G, ci) {
    const AP = S.cfg.terrain.chunkArt;
    if (!G.cvA[ci]) G.cvA[ci] = mkCanvas(AP, AP);
    paintChunk(G.cvA[ci], m, G, ci, 0);
    if (G.water[ci]) { if (!G.cvB[ci]) G.cvB[ci] = mkCanvas(AP, AP); paintChunk(G.cvB[ci], m, G, ci, 1); }
    if (G.dirty[ci]) { G.dirty[ci] = 0; G.left--; }
  }
  function sdfM(m, x, y) { const N = m.N, cell = m.cell, s = m.sdf; let fx = x / cell - 0.5, fy = y / cell - 0.5; fx = fx < 0 ? 0 : fx > N - 1.001 ? N - 1.001 : fx; fy = fy < 0 ? 0 : fy > N - 1.001 ? N - 1.001 : fy;
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, c = j * N + i, a = s[c], b = s[c + 1], d = s[c + N], e = s[c + N + 1]; return a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty; }
  const hash2 = (i, j, s) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  function paintChunk(cv, m, G, ci, frame) {
    const cfg = S.cfg, spr = S.spr, CH = cfg.terrain.chunk, sc = cfg.terrain.chunkArt / CH, n = G.n, wx = (ci % n) * CH, wy = ((ci / n) | 0) * CH;
    const g = cv.getContext("2d"), N = m.N, cell = m.cell, terr = m.terr;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(sc, 0, 0, sc, -wx * sc, -wy * sc); g.imageSmoothingEnabled = false;
    // grass: v1's three tile variants, same per-tile hash as v1's per-frame tiles
    const T = cfg.world.tile;
    for (let j = Math.floor(wy / T); j < Math.ceil((wy + CH) / T); j++) for (let i = Math.floor(wx / T); i < Math.ceil((wx + CH) / T); i++) {
      let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h = (h ^ (h >>> 16)) >>> 0; const v = h % 11;
      g.drawImage(spr.tiles[v < 6 ? 0 : v < 10 ? 1 : 2], i * T, j * T, T, T);
    }
    // dirt trails between the opening camps, then decals
    g.strokeStyle = "rgba(125,106,68,.42)"; g.lineWidth = 9; g.lineCap = "round";
    for (const tr of S.trails) { if (tr.maxX < wx || tr.minX > wx + CH || tr.maxY < wy || tr.minY > wy + CH) continue; g.beginPath(); g.moveTo(tr.x0, tr.y0); g.quadraticCurveTo(tr.cx, tr.cy, tr.x1, tr.y1); g.stroke(); }
    for (const d of S.decals) { if (d.x < wx - 20 || d.x > wx + CH + 20 || d.y < wy - 20 || d.y > wy + CH + 20) continue; const im = spr.decals[d.k]; g.drawImage(im, d.x - im.width / 2, d.y - im.height / 2); }
    // terrain cells, with a one-cell apron (neighbours outside the chunk are read and painted; the canvas clips them)
    const i0 = Math.max(0, Math.floor(wx / cell) - 1), i1 = Math.min(N - 1, Math.floor((wx + CH) / cell)), j0 = Math.max(0, Math.floor(wy / cell) - 1), j1 = Math.min(N - 1, Math.floor((wy + CH) / cell));
    const px = 1 / sc; // one art pixel in world px
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * N + i, t = terr[c], x = i * cell, y = j * cell;
      if (t === 1) {
        const south = j + 1 < N ? terr[c + N] : 1;
        if (south !== 1) { g.fillStyle = TPAL.face; g.fillRect(x, y, cell, cell); g.fillStyle = TPAL.top; g.fillRect(x, y, cell, px * 2); g.fillStyle = TPAL.base; g.fillRect(x, y + cell - px, cell, px); }
        else { g.fillStyle = (hash2(i, j, 3) & 7) === 0 ? TPAL.topLit : TPAL.top; g.fillRect(x, y, cell, cell); }
      } else if (t === 2) {
        // three tones by shore distance, sampled per 8 px block from the bilinear SDF (a 2-3 cell river has no deep cell centres)
        for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) { const d = -sdfM(m, x + u * 8 + 4, y + v * 8 + 4); g.fillStyle = TPAL.water[d < 9 ? 0 : d < 20 ? 1 : 2]; g.fillRect(x + u * 8, y + v * 8, 8, 8); }
        const h = hash2(i, j, 11 + frame); if ((h & 3) === 0) { g.fillStyle = TPAL.glint; g.fillRect(x + ((h >>> 4) % 24), y + ((h >>> 9) % 26), px * 3, px); }
      } else if (t === 3) {
        g.fillStyle = TPAL.sand; g.fillRect(x, y, cell, cell);
        const h = hash2(i, j, 5); if (h % 100 < 45) { g.fillStyle = TPAL.stone; g.fillRect(x + 6 + ((h >>> 8) % 16), y + 6 + ((h >>> 13) % 16), px * 3, px * 2); }
        if (frame && (h & 7) === 1) { g.fillStyle = TPAL.glint; g.fillRect(x + ((h >>> 5) % 24), y + ((h >>> 11) % 26), px * 2, px); }
      } else if (t === 4) {
        g.fillStyle = TPAL.plank; g.fillRect(x, y, cell, cell); g.fillStyle = TPAL.plankD;
        const along = m.river && Math.abs(m.river.dy) > Math.abs(m.river.dx); // planks lie along the river, across the way people walk
        for (let k = 0; k < cell; k += px * 4) { if (along) g.fillRect(x + k, y, px, cell); else g.fillRect(x, y + k, cell, px); }
      }
    }
  }
  function drawGround(x0, y0, x1, y1) {
    const m = S.map, G = ground(m), CH = S.cfg.terrain.chunk, n = G.n, k = S.cam.zoom * S.dpr;
    const i0 = Math.max(0, Math.floor(x0 / CH)), i1 = Math.min(n - 1, Math.floor(x1 / CH)), j0 = Math.max(0, Math.floor(y0 / CH)), j1 = Math.min(n - 1, Math.floor(y1 / CH));
    const wf = ((performance.now() / S.cfg.terrain.waterFrameMs) | 0) & 1, ov = 1 / k; // one device pixel of overlap hides seams
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ci = j * n + i; if (G.dirty[ci] || !G.cvA[ci]) bakeChunk(m, G, ci);
      ctx.drawImage(wf && G.water[ci] ? G.cvB[ci] : G.cvA[ci], i * CH, j * CH, CH + ov, CH + ov);
    }
    if (G.left > 0) { for (let q = 0; q < n * n; q++) { const ci = (G.scan + q) % (n * n); if (G.dirty[ci]) { bakeChunk(m, G, ci); G.scan = ci + 1; break; } } }
  }
  function flushGround(m) { const G = ground(m); for (let ci = 0; ci < G.n * G.n; ci++) if (G.dirty[ci] || !G.cvA[ci]) bakeChunk(m, G, ci); }

  // minimap terrain: one pixel per cell, rebuilt per map and on cache recovery
  let miniTerr = null;
  function minimapBake() {
    const m = S.map; if (!m) return; const N = m.N;
    if (!miniTerr || miniTerr.width !== N) miniTerr = mkCanvas(N, N);
    const g = miniTerr.getContext("2d"), im = g.createImageData(N, N), d = im.data;
    const col = [[31, 58, 26], [22, 24, 20], [52, 104, 176], [176, 156, 104], [120, 88, 52]];
    for (let c = 0; c < N * N; c++) { const k = col[m.terr[c]] || col[0]; d[c * 4] = k[0]; d[c * 4 + 1] = k[1]; d[c * 4 + 2] = k[2]; d[c * 4 + 3] = 255; }
    for (const o of S.obstacles) { const c = PS.terrain.cellOf(o.x, o.y); if (c >= 0 && !m.terr[c]) { d[c * 4] = 22; d[c * 4 + 1] = 48; d[c * 4 + 2] = 27; } }
    g.putImageData(im, 0, 0);
  }

  const teamRingCache = {};
  const ROUTE = new Int32Array(4096); // route trace for the dotted preview
  const byY = (p, q) => p.y - q.y;
  function draw() {
    const cfg = S.cfg, spr = S.spr, z = S.cam.zoom, dpr = S.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = TPAL.beyond; ctx.fillRect(0, 0, S.vw, S.vh); // past the world edge: more plateau
    if (!S.map) return;
    let shx = 0, shy = 0; if (S.shake > 0) { shx = (Math.random() - 0.5) * 10 * S.shake; shy = (Math.random() - 0.5) * 10 * S.shake; }
    // camera and shake rounded to device pixels
    const k = z * dpr, ox = Math.round((S.vw / 2 + shx) * dpr - S.cam.x * k), oy = Math.round((S.vh / 2 + shy) * dpr - S.cam.y * k);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    const x0 = -ox / k, y0 = -oy / k, x1 = x0 + (S.vw * dpr) / k, y1 = y0 + (S.vh * dpr) / k;

    // ground (baked chunks), plus the cache probe that heals a lost backing store without any browser event
    drawGround(x0, y0, x1, y1);
    cacheProbe(x0, y0, x1, y1, false);
    // camps
    for (const c of S.camps) if (c.x > x0 - 40 && c.x < x1 + 40 && c.y > y0 - 30 && c.y < y1 + 30) ctx.drawImage(spr.dirt, c.x - 32, c.y - 20);

    // team rings (buff / huddle indicator) under everything
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count < 2) continue;
      const r = 10 + Math.sqrt(t.count) * 7;
      let col = null;
      if (t.buffs.frenzy > 0) col = spr.PU.frenzy.color; else if (t.buffs.armor > 0) col = spr.PU.armor.color; else if (t.buffs.speed > 0) col = spr.PU.speed.color;
      if (t.isPlayer && S.input.huddle && !S.attract && !col) col = "rgba(255,255,255,.5)";
      if (!col) continue;
      ctx.globalAlpha = 0.28 + 0.12 * Math.sin(S.t * 8); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -S.t * 40;
      ctx.beginPath(); ctx.arc(t.cx, t.cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // player target marker, and the route: dotted through known cells for flow.previewSeconds after a tap / click / minimap route, and
    // always in cursor-follow when the route runs over flow.routeDrawRatio x the straight line
    const pl = S.teams[1];
    if (pl && pl.count > 0 && S.mode === "play") {
      const d = Math.hypot(pl.tx - pl.cx, pl.ty - pl.cy);
      if (d > 30) { ctx.globalAlpha = 0.85; ctx.drawImage(spr.marker, pl.tx - 2, pl.ty - 12); ctx.globalAlpha = 0.5; ctx.strokeStyle = pl.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.tx, pl.ty, 6 + 2 * Math.sin(S.t * 6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      const f = pl.route && PS.flow.fieldFor(1);
      if (f && f.ok) {
        const c0 = PS.flow.cellFor(pl.ax, pl.ay), len = PS.flow.pathCell(f, c0), straight = Math.hypot(pl.tx - pl.ax, pl.ty - pl.ay), pv = S.input.preview;
        if (len > 0 && (pv > 0 || (S.input.active && len > cfg.flow.routeDrawRatio * straight && straight > 60))) {
          const n = PS.flow.trace(f, c0, ROUTE, ROUTE.length), N = S.map.N, cell = S.map.cell, kn = PS.knowledge;
          ctx.fillStyle = pl.color; ctx.globalAlpha = pv > 0 ? Math.min(0.9, pv * 1.5) : 0.55;
          for (let k = 1; k < n; k += 2) { const c = ROUTE[k]; if (kn && !kn[c]) continue; const x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell; if (x < x0 - 8 || x > x1 + 8 || y < y0 - 8 || y > y1 + 8) continue; ctx.fillRect(x - 2, y - 2, 4, 4); }
          ctx.globalAlpha = 1;
        }
      }
    }

    // power-ups
    for (const p of S.powerups) {
      if (!p.alive || p.x < x0 - 30 || p.x > x1 + 30 || p.y < y0 - 30 || p.y > y1 + 30) continue;
      const pu = spr.PU[p.kind], bob = Math.sin(p.t * 4) * 3, pulse = (p.t * 0.9) % 1;
      ctx.globalAlpha = 0.4; ctx.fillStyle = pu.color; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7 * (1 - pulse); ctx.strokeStyle = pu.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, 10 + pulse * 26, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.drawImage(spr.shadow, p.x - 6, p.y + 4);
      ctx.drawImage(pu.icon, p.x - 12, p.y - 16 + bob, 24, 24);
    }

    // shadows + sort list
    const DL = S.drawList; DL.length = 0;
    for (const a of S.agents) { if (a.x < x0 - 20 || a.x > x1 + 20 || a.y < y0 - 30 || a.y > y1 + 20) continue; DL.push(a); }
    for (const o of S.obstacles) { if (o.x < x0 - 40 || o.x > x1 + 40 || o.y < y0 - 60 || o.y > y1 + 30) continue; DL.push(o); }
    for (const a of DL) if (a.team !== undefined) ctx.drawImage(spr.shadow, a.x - 6, a.y - 1);
    DL.sort(byY);
    const neutralSet = spr._neutral || (spr._neutral = spr.peasantSet(cfg.neutral.color));
    for (const e of DL) {
      if (e.team === undefined) {
        if (e.kind === 2) ctx.drawImage(spr.rock, e.x - 14, e.y - 14);
        else { const tr = spr.trees[e.kind]; ctx.drawImage(tr, e.x - tr.width / 2, e.y - tr.height + 6); }
        continue;
      }
      const set = e.team ? S.teams[e.team].spr : neutralSet;
      const moving = e.vx * e.vx + e.vy * e.vy > 120;
      let f = e.lunge > 0.08 ? 2 : moving ? ((e.ph | 0) % 2) : 3;
      const img = (e.face < 0 ? set.L : set.R)[f];
      const bob = moving ? (((e.ph * 0.5) | 0) % 2) : 0;
      let sc = 1; if (e.pop > 0 && e.pop < 0.3) sc = 1 + 0.55 * (1 - e.pop / 0.3);
      const w = 24 * sc, h = 28 * sc, dx = e.x - w / 2, dy = e.y - 24 - bob - (h - 28);
      if (e.escapeT > 0) { ctx.globalAlpha = 0.6 + 0.25 * ((e.ph | 0) & 1); ctx.drawImage(img, dx, dy, w, h); ctx.globalAlpha = 1; ctx.fillStyle = "#F1EEDF"; ctx.fillRect(e.x - 6, dy - 3, 2, 4); ctx.fillRect(e.x + 4, dy - 3, 2, 4); continue; } // remnant: hands up, run
      ctx.drawImage(img, dx, dy, w, h);
      if (e.fl > 0) { ctx.globalAlpha = Math.min(1, e.fl * 7); ctx.drawImage((e.face < 0 ? set.LW : set.RW)[f], dx, dy, w, h); ctx.globalAlpha = 1; }
      if (e.hp < cfg.agent.hp && e.team) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(e.x - 6, dy - 3, 12, 2); ctx.fillStyle = e.hp <= 1 ? "#FF5C5C" : "#FFD23F"; ctx.fillRect(e.x - 6, dy - 3, 12 * (e.hp / cfg.agent.hp), 2); }
    }

    particles.draw(ctx);
    floaters.draw(ctx);

    // camp head-count labels near the player
    if (S.mode === "play" && pl.count > 0) {
      ctx.font = "800 11px 'Nunito', system-ui"; ctx.textAlign = "center";
      for (const c of S.camps) {
        if (c.n === 0 || c.x < x0 - 40 || c.x > x1 + 40 || c.y < y0 - 40 || c.y > y1 + 40) continue;
        const d = Math.hypot(c.x - pl.cx, c.y - pl.cy); if (d > cfg.world.campLabelDist) continue;
        const a = clamp((cfg.world.campLabelDist - d) / 120, 0, 1); ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = "rgba(8,14,6,.7)"; ctx.fillRect(c.x - 15, c.y - 44, 30, 15); ctx.fillStyle = "#F1EEDF"; ctx.fillText("+" + c.n, c.x, c.y - 33);
      }
      ctx.globalAlpha = 1;
    }

    // name tags above every swarm (player too); the swarm currently clashing with the player is labelled by the clash panel instead
    let clashRival = 0; if (S.mode === "play" && !S.attract && pl.count > 0) { let best = 0.1; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive && pl.engT[i] > best) { best = pl.engT[i]; clashRival = i; } }
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count === 0 || i === clashRival || (t.isPlayer && (t.count < 2 || S.attract || S.engagedNow))) continue;
      if (t.cx < x0 - 60 || t.cx > x1 + 60 || t.cy < y0 - 60 || t.cy > y1 + 60) continue;
      const ly = Math.min(t.minY - 30, t.cy - 40);
      ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center";
      const label = (S.attract && t.isPlayer ? "Mint" : t.name) + " · " + t.count; const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = "rgba(8,14,6,.75)"; ctx.fillRect(t.cx - w / 2, ly - 13, w, 18);
      ctx.fillStyle = t.color; ctx.fillRect(t.cx - w / 2, ly - 13, 3, 18);
      ctx.fillStyle = "#F1EEDF"; ctx.fillText(label, t.cx + 1, ly);
    }

    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // off-screen rival arrows
    for (let i = 2; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count === 0 || S.mode !== "play") continue;
      const sx = (t.cx - S.cam.x) * z + S.vw / 2, sy = (t.cy - S.cam.y) * z + S.vh / 2;
      if (S.attract) continue;
      if (sx > 20 && sx < S.vw - 20 && sy > 60 && sy < S.vh - 20) continue;
      const cx = S.vw / 2, cy = S.vh / 2, ang = Math.atan2(sy - cy, sx - cx);
      let ex = clamp(sx, 26, S.vw - 26), ey = clamp(sy, S.input.touch ? 120 : 70, S.vh - (S.input.touch ? 46 : 26));
      const mm = S.input.touch ? 120 : 160; if (ex > S.vw - mm - 10 && ey > S.vh - mm - 10) ey = S.vh - mm - 14;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = t.color; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-3, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1; ctx.font = "800 11px 'Nunito', system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#F1EEDF";
      ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 3; ctx.strokeText(t.count, ex, ey + 22); ctx.fillText(t.count, ex, ey + 22);
    }
    // banner (one at a time, pinned high)
    for (let i = 0; i < Math.min(1, S.banners.length); i++) {
      const b = S.banners[i], age = 1 - b.life / b.life0;
      const a = Math.min(1, b.life * 2, age * 6); const y = S.input.touch ? 215 : Math.max(150, S.vh * 0.22);
      ctx.globalAlpha = a; ctx.font = "800 " + (S.vw < 700 ? 22 : 30) + "px 'Baloo 2', system-ui"; ctx.textAlign = "center";
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(b.text, S.vw / 2, y);
      ctx.fillStyle = b.color; ctx.fillText(b.text, S.vw / 2, y); ctx.globalAlpha = 1;
    }
    // clash panel: who is fighting whom and who is winning, unmissable, screen space
    let clashF = -1;
    if (S.mode === "play" && !S.attract && pl.count > 0) {
      let ri = 0, best = 0.1; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive && pl.engT[i] > best) { best = pl.engT[i]; ri = i; }
      if (ri) {
        const t = S.teams[ri], cr = clashRead(pl, t), inc = clashIncoming(pl, ri);
        clashF = cr.f;
        const pw = Math.min(380, S.vw - 32), px = S.vw / 2 - pw / 2, py = S.input.touch ? 112 : 58, ph = inc ? 62 : 46;
        ctx.fillStyle = "rgba(8,14,6,.82)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.fill();
        ctx.font = "800 15px 'Nunito', system-ui"; ctx.textAlign = "left"; ctx.fillStyle = pl.color; ctx.fillText("YOU " + cr.a, px + 12, py + 20);
        ctx.textAlign = "right"; ctx.fillStyle = t.color; ctx.fillText(t.name.toUpperCase() + " " + cr.b, px + pw - 12, py + 20);
        ctx.textAlign = "center"; ctx.font = "800 12px 'Nunito', system-ui";
        ctx.fillStyle = clashF > 0.56 ? "#7CF2C4" : clashF < 0.44 ? "#FF7A6E" : "#FFE49A"; ctx.fillText(cr.verdict, px + pw / 2, py + 20);
        if (inc) { ctx.fillStyle = inc.color; ctx.fillText(inc.name.toUpperCase() + " INCOMING", px + pw / 2, py + 56); }
        const bx = px + 12, bw = pw - 24, by = py + 30;
        ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(bx, by, bw, 8);
        ctx.fillStyle = pl.color; ctx.fillRect(bx, by, bw * clashF, 8); ctx.fillStyle = t.color; ctx.fillRect(bx + bw * clashF, by, bw * (1 - clashF), 8);
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bx + bw * clashF - 1, by - 2, 2, 12);
      }
    }
    // danger vignette while a clash is going against you
    if (S.mode === "play" && S.engagedNow) {
      const outn = clashF >= 0 && clashF < 0.46;
      if (outn) { const g = ctx.createRadialGradient(S.vw / 2, S.vh / 2, S.vh * 0.35, S.vw / 2, S.vh / 2, S.vh * 0.85); g.addColorStop(0, "rgba(200,30,30,0)"); g.addColorStop(1, "rgba(200,30,30," + (0.22 + 0.1 * Math.sin(S.t * 10)) + ")"); ctx.fillStyle = g; ctx.fillRect(0, 0, S.vw, S.vh); }
    }
    if (S.vignette) ctx.drawImage(S.vignette, 0, 0, S.vw, S.vh);
    // floating joystick (touch): anchor ring at first touch, knob follows the finger, clamped to the ring
    const joy = S.input.joy;
    if (joy.active && S.mode === "play") {
      const J = cfg.touch; let kx = joy.cx - joy.ox, ky = joy.cy - joy.oy; const len = Math.hypot(kx, ky);
      if (len > J.joyRadius) { kx *= J.joyRadius / len; ky *= J.joyRadius / len; }
      ctx.globalAlpha = 0.28; ctx.fillStyle = "#08140b"; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, J.joyRadius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.55; ctx.strokeStyle = "#F1EEDF"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, J.joyRadius, 0, Math.PI * 2); ctx.stroke();
      if (joy.mag > 0) { ctx.globalAlpha = 0.5; ctx.strokeStyle = pl.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(joy.ox, joy.oy); ctx.lineTo(joy.ox + kx, joy.oy + ky); ctx.stroke(); }
      ctx.globalAlpha = 0.85; ctx.fillStyle = pl.color; ctx.beginPath(); ctx.arc(joy.ox + kx, joy.oy + ky, 22, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (S.debug) { const fs = PS.flow.stats; ctx.font = "12px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("fps " + S.fps + "  agents " + S.agents.length + "/" + S.cap + "  seed " + S.seed + "  map " + S.map.used + (S.map.fallback ? " (fallback)" : "") + " r" + S.map.rerolls + "  zoom " + S.cam.zoom.toFixed(2) + "  fields " + (fs ? fs.rebuilds + " " + fs.lastCostMs + "ms" : "-") + (S.fixture ? "  fixture " + S.fixture.name : ""), 8, S.vh - 8); }

    drawMinimap();
  }

  function drawMinimap() {
    if (S.mode === "title" || S.attract) return;
    const cfg = S.cfg, W = cfg.world.w, H = cfg.world.h, k = 150 / Math.max(W, H);
    mctx.imageSmoothingEnabled = false;
    if (miniTerr) mctx.drawImage(miniTerr, 0, 0, 150, 150); else { mctx.fillStyle = "#1f3a1a"; mctx.fillRect(0, 0, 150, 150); }
    mctx.fillStyle = "#c9bd9c"; for (const a of S.agents) if (a.team === 0) mctx.fillRect((a.x * k) | 0, (a.y * k) | 0, 1, 1);
    for (const p of S.powerups) if (p.alive) { mctx.fillStyle = S.spr.PU[p.kind].color; mctx.fillRect((p.x * k - 1) | 0, (p.y * k - 1) | 0, 3, 3); }
    for (let i = S.teams.length - 1; i >= 1; i--) { const t = S.teams[i]; mctx.fillStyle = t.color; for (const a of S.agents) if (a.team === i) mctx.fillRect((a.x * k) | 0, (a.y * k) | 0, 2, 2); }
    const z = S.cam.zoom; mctx.strokeStyle = "rgba(255,255,255,.9)"; mctx.lineWidth = 1.5;
    mctx.strokeRect((S.cam.x - S.vw / 2 / z) * k, (S.cam.y - S.vh / 2 / z) * k, (S.vw / z) * k, (S.vh / z) * k);
  }

  // ---------------------------------------------------------------- cache recovery (studio lessons 27-29): chunks, minimap, sprites
  // On visibilitychange / pageshow / contextrestored every chunk is re-baked (visible first, then one per frame), the minimap re-baked, and
  // any blank sprite canvas repainted in place from a fresh build (same canvas objects, so every reference stays valid).
  function spriteCanvases(spr, teams) {
    const list = [];
    const addSet = (k, set) => { for (const f of ["R", "L", "RW", "LW"]) set[f].forEach((c, i) => list.push([k + "." + f + i, c, set, f, i])); };
    for (let i = 1; i < teams.length; i++) if (teams[i]) addSet("team" + i, teams[i].spr);
    if (spr._neutral) addSet("neutral", spr._neutral);
    spr.tiles.forEach((c, i) => list.push(["tile" + i, c])); spr.trees.forEach((c, i) => list.push(["tree" + i, c])); spr.decals.forEach((c, i) => list.push(["decal" + i, c]));
    for (const k in spr.PU) list.push(["pu." + k, spr.PU[k].icon]);
    list.push(["dirt", spr.dirt], ["rock", spr.rock], ["marker", spr.marker], ["shadow", spr.shadow], ["smoke", spr.smoke]);
    return list;
  }
  function restoreSprites() {
    const fresh = PS.buildSprites(S.cfg), spr = S.spr, copy = (dst, src) => { const g = dst.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, dst.width, dst.height); g.drawImage(src, 0, 0); }; // silhouettes were built in source-in mode
    const pairs = [["tiles"], ["trees"], ["decals"]]; for (const [k] of pairs) spr[k].forEach((c, i) => copy(c, fresh[k][i]));
    for (const k in spr.PU) copy(spr.PU[k].icon, fresh.PU[k].icon);
    for (const k of ["dirt", "rock", "marker", "shadow", "smoke"]) copy(spr[k], fresh[k]);
    const sets = []; for (let i = 1; i < S.teams.length; i++) if (S.teams[i]) sets.push([S.teams[i].spr, S.teams[i].color]); if (spr._neutral) sets.push([spr._neutral, S.cfg.neutral.color]);
    for (const [set, color] of sets) { const f = fresh.peasantSet(color); for (const k of ["R", "L", "RW", "LW"]) set[k].forEach((c, i) => copy(c, f[k][i])); }
  }
  function recheckCaches(sync) {
    if (!S.cfg || !S.spr) return;
    let blank = 0; for (const e of spriteCanvases(S.spr, S.teams)) if (opaqueCount(e[1]) === 0) blank++;
    if (blank) restoreSprites();
    if (S.map) { groundInvalidate(S.map); minimapBake(); if (sync) flushGround(S.map); }
    return blank;
  }
  // cache probe (M1 critic MAJOR-2): every terrain.probeFrames frames read one visible chunk (4x4 downscale) and one sprite canvas (round robin)
  // through the scratch canvas; a blank one re-arms every cache (recheckCaches): sprites repaint at once, visible chunks bake on the next
  // draw and the rest one per frame. Heals without any browser event. force: probe now, over all chunks (selfTest).
  let probeN = 0, probeC = 0, probeS = 0;
  function cacheProbe(x0, y0, x1, y1, force) {
    if (!S.map || !S.cfg || !S.spr) return false;
    if (!force && ++probeN < S.cfg.terrain.probeFrames) return false;
    probeN = 0; probeC++; let blank = false;
    const G = S.map.chunks;
    if (G) {
      const CH = S.cfg.terrain.chunk, n = G.n; let i0 = 0, i1 = n - 1, j0 = 0, j1 = n - 1;
      if (!force) { i0 = clamp(Math.floor(x0 / CH), 0, n - 1); i1 = clamp(Math.floor(x1 / CH), 0, n - 1); j0 = clamp(Math.floor(y0 / CH), 0, n - 1); j1 = clamp(Math.floor(y1 / CH), 0, n - 1); }
      const w = i1 - i0 + 1, k = probeC % (w * (j1 - j0 + 1)), ci = (j0 + ((k / w) | 0)) * n + i0 + (k % w), cv = G.cvA[ci];
      if (cv && !G.dirty[ci] && !opaque4(cv)) blank = true;
    }
    if (!blank) { const list = spriteCanvases(S.spr, S.teams); if (list.length && opaqueCount(list[probeS++ % list.length][1]) === 0) blank = true; }
    if (!blank && miniTerr && (force || (probeC & 7) === 0) && !opaque4(miniTerr)) blank = true;
    if (blank) recheckCaches();
    return blank;
  }
  // debug: blank every cache without telling the game (what a discarded backing store looks like) so the harness can assert the recovery
  function debugDropCaches() {
    const wipe = (c) => { if (!c) return; const g = c.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); };
    let n = 0;
    if (S.map && S.map.chunks) { const G = S.map.chunks; for (let i = 0; i < G.n * G.n; i++) { wipe(G.cvA[i]); wipe(G.cvB[i]); n += (G.cvA[i] ? 1 : 0) + (G.cvB[i] ? 1 : 0); } }
    wipe(miniTerr); n++;
    for (const e of spriteCanvases(S.spr, S.teams)) { wipe(e[1]); n++; }
    return n;
  }
  // chunk opacity on a 4x4 downscale into one scratch canvas (lesson 27: never read the cache itself); sprites by full opaque count
  let scratch4 = null, scratch4Ctx = null;
  function opaque4(c) {
    if (!c) return false;
    if (!scratch4) { scratch4 = mkCanvas(4, 4); scratch4Ctx = scratch4.getContext("2d", { willReadFrequently: true }); }
    scratch4Ctx.imageSmoothingEnabled = true; scratch4Ctx.clearRect(0, 0, 4, 4); scratch4Ctx.drawImage(c, 0, 0, 4, 4);
    const d = scratch4Ctx.getImageData(0, 0, 4, 4).data; for (let i = 3; i < 64; i += 4) if (d[i] < 250) return false; return true;
  }
  function cacheReport() {
    const out = { chunks: 0, chunksOpaque: 0, chunksBlank: [], pending: 0, minimap: miniTerr ? opaqueCount(miniTerr) > 0 : false, sprites: 0, spritesBlank: [] };
    if (S.map && S.map.chunks) { const G = S.map.chunks; out.pending = G.left; for (let i = 0; i < G.n * G.n; i++) for (const cv of [G.cvA[i], G.cvB[i]]) { if (!cv) continue; out.chunks++; if (opaque4(cv)) out.chunksOpaque++; else out.chunksBlank.push(i); } }
    for (const e of spriteCanvases(S.spr, S.teams)) { out.sprites++; if (opaqueCount(e[1]) === 0) out.spritesBlank.push(e[0]); }
    out.ok = out.chunks > 0 && out.chunksOpaque === out.chunks && out.pending === 0 && out.minimap && out.spritesBlank.length === 0;
    return out;
  }

  // ---------------------------------------------------------------- HUD
  function buildTeamChips() {
    if (sandbox) return;
    const el = $("teams"); el.innerHTML = "";
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i];
      const c = document.createElement("div"); c.className = "chip" + (t.isPlayer ? " you" : "") + (t.alive ? "" : " dead"); c.id = "chip-" + i;
      c.innerHTML = "<span class='sw' style='background:" + t.color + "'></span><span>" + t.name + "</span><span class='n'>" + t.count + "</span>";
      el.appendChild(c);
    }
  }
  let hudT = 0;
  function updateHUD(force) {
    const now = performance.now(); if (!force && now - hudT < 100) return; hudT = now;
    for (let i = 1; i < S.teams.length; i++) { const el = $("chip-" + i); if (el) el.lastElementChild.textContent = S.teams[i].count; }
    const tl = Math.max(0, S.timeLeft), m = Math.floor(tl / 60), s = Math.floor(tl % 60);
    const tm = $("timer"); tm.textContent = m + ":" + (s < 10 ? "0" : "") + s; tm.classList.toggle("urgent", tl < 30);
    const b = $("buffs"), t = S.teams[1], cfg = S.cfg.powerups; let h = "";
    for (const k of ["speed", "armor", "frenzy"]) if (t.buffs[k] > 0) h += "<div class='buff' style='color:" + S.spr.PU[k].color + ";border-color:" + S.spr.PU[k].color + "'><span>" + k.toUpperCase() + "</span><span class='bar'><i style='width:" + (100 * t.buffs[k] / cfg.duration[k]) + "%'></i></span></div>";
    if (b.innerHTML !== h) b.innerHTML = h;
  }

  // ---------------------------------------------------------------- input
  // SPEC-v2 §10. Touch: tap (lift inside input.tapMs, moved under input.tapPx) routes; drag (past tapPx) is the floating joystick, anchor
  // clamped touch.joyEdge from the edges, cancelling any route; hold (still past tapMs) stops; lifting after a drag stops; a second finger
  // is HUDDLE only. Mouse: the cursor follows (route or steer by input.desktopMode), left click routes until the cursor moves
  // input.routeBreakPx; a minimap click routes until the mouse moves on the canvas. pointercancel ends a touch without a tap.
  function bindInput() {
    const inp = S.input, joy = inp.joy, tp = inp.tp;
    const startDrag = (e) => {
      const J = S.cfg.touch; tp.drag = true; joy.active = true; joy.id = tp.id; joy.mag = 0;
      joy.ox = clamp(tp.sx, J.joyEdge, Math.max(J.joyEdge, S.vw - J.joyEdge)); joy.oy = clamp(tp.sy, J.joyEdge, Math.max(J.joyEdge, S.vh - J.joyEdge)); joy.cx = e.clientX; joy.cy = e.clientY;
      inp.route.on = false; inp.hold = false;
    };
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") {
        inp.px = e.clientX; inp.py = e.clientY; inp.active = true; const r = inp.route;
        if (r.on && (r.src === "minimap" || (r.src === "click" && Math.hypot(e.clientX - r.sx, e.clientY - r.sy) > S.cfg.input.routeBreakPx))) r.on = false;
        return;
      }
      if (joy.active && e.pointerId === joy.id) { joy.cx = e.clientX; joy.cy = e.clientY; return; }
      if (tp.active && e.pointerId === tp.id && !tp.drag && Math.hypot(e.clientX - tp.sx, e.clientY - tp.sy) > S.cfg.input.tapPx) startDrag(e);
    });
    canvas.addEventListener("pointerdown", (e) => {
      PS.audio.unlock();
      if (e.pointerType === "mouse") { inp.px = e.clientX; inp.py = e.clientY; inp.active = true; if (e.button === 0) tapAt(e.clientX, e.clientY, "click"); return; }
      inp.touch = true; document.body.classList.add("touch"); inp.active = false;
      if (tp.active) { if (inp.hud2 < 0) { inp.hud2 = e.pointerId; setHuddle(true); } return; } // a second finger is HUDDLE only
      tp.active = true; tp.id = e.pointerId; tp.sx = e.clientX; tp.sy = e.clientY; tp.t0 = performance.now(); tp.drag = false; tp.hold = false;
      try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    });
    const lift = (e) => {
      if (e.pointerType === "mouse") return;
      if (e.pointerId === inp.hud2) { inp.hud2 = -1; setHuddle(false); return; }
      if (!tp.active || e.pointerId !== tp.id) return;
      tp.active = false;
      if (tp.drag) { joy.active = false; joy.id = -1; joy.mag = 0; if (S.mode === "play" && S.teams[1]) holdHere(S.teams[1]); } // lifting after a drag stops the swarm
      else if (!tp.hold && e.type === "pointerup" && performance.now() - tp.t0 < S.cfg.input.tapMs) tapAt(tp.sx, tp.sy, "tap");
    };
    canvas.addEventListener("pointerup", lift);
    canvas.addEventListener("pointercancel", lift);
    canvas.addEventListener("lostpointercapture", lift);
    canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") inp.active = false; });
    // the minimap routes there (a tap on touch, a click on desktop)
    mini.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation(); PS.audio.unlock(); if (S.mode !== "play") return;
      const r = mini.getBoundingClientRect(), wx = ((e.clientX - r.left) / r.width) * S.cfg.world.w, wy = ((e.clientY - r.top) / r.height) * S.cfg.world.h;
      if (e.pointerType === "mouse") inp.active = false; // until the mouse moves on the canvas again
      setRoute(clamp(wx, 40, S.cfg.world.w - 40), clamp(wy, 40, S.cfg.world.h - 40), 0, "minimap", e.clientX, e.clientY);
    });
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      inp.keys[k] = true;
      if (k === " ") { e.preventDefault(); if (S.mode === "play") setHuddle(true); }
      if (k === "p" || k === "Escape") { if (S.mode === "play") pause(); else if (S.mode === "pause") resume(); }
      if (k === "m") toggleSound();
      if (k === "1") setPace(0); if (k === "2") setPace(1);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; inp.keys[k] = false; if (k === " ") setHuddle(false); });
    window.addEventListener("blur", () => { inp.keys = {}; setHuddle(false); joy.active = false; joy.id = -1; tp.active = false; inp.hud2 = -1; });
    const hb = $("t-huddle");
    hb.addEventListener("pointerdown", (e) => { e.preventDefault(); setHuddle(true); });
    hb.addEventListener("pointerup", () => setHuddle(false));
    hb.addEventListener("pointercancel", () => setHuddle(false));
    hb.addEventListener("pointerleave", () => setHuddle(false));
    if ("ontouchstart" in window && !window.matchMedia("(pointer:fine)").matches) { inp.touch = true; document.body.classList.add("touch"); }
    document.addEventListener("visibilitychange", () => { if (document.hidden) { if (S.mode === "play") pause(); } else recheckCaches(); });
    window.addEventListener("pageshow", () => recheckCaches());
    canvas.addEventListener("contextrestored", () => recheckCaches());
  }
  function setHuddle(on) { if (S.input.huddle === on) return; S.input.huddle = on; $("t-huddle").classList.toggle("on", on); if (S.mode === "play") PS.audio.huddle(on); }

  function bindUI() {
    try { const d = localStorage.getItem("ps.difficulty"); if (d && S.cfg.difficulty[d]) S.difficulty = d; } catch (e) {}
    const row = $("difficulty");
    for (const k of Object.keys(S.cfg.difficulty)) {
      const b = document.createElement("button"); b.textContent = S.cfg.difficulty[k].label; b.dataset.k = k;
      b.onclick = () => { S.difficulty = k; try { localStorage.setItem("ps.difficulty", k); } catch (e) {} syncDifficulty(); PS.audio.click(); };
      row.appendChild(b);
    }
    syncDifficulty();
    $("btn-play").onclick = () => startGame();
    $("btn-again").onclick = () => startGame();
    $("btn-retry").onclick = () => startGame();
    $("btn-title-w").onclick = () => toTitle();
    $("btn-title-l").onclick = () => toTitle();
    $("btn-quit").onclick = () => toTitle();
    $("btn-resume").onclick = () => resume();
    $("btn-pause").onclick = () => { if (S.mode === "play") pause(); };
    $("btn-pace").onclick = () => setPace((S.cfg.pace.indexOf(S.pace) + 1) % S.cfg.pace.length);
    for (const id of ["btn-sound", "btn-sound-title", "btn-sound-pause"]) $(id).onclick = () => toggleSound();
    syncSound();
  }
  function showOverlay(id) { document.querySelectorAll(".overlay").forEach((o) => o.classList.toggle("active", o.id === id)); }
  function startGame() { PS.audio.setSilent(false); PS.audio.unlock(); PS.audio.click(); newGame(false); S.mode = "play"; S._hintFight = S._hintHud = S._hintRecruit = false; S._routedBy = null; showOverlay(null); $("hud").classList.remove("hidden"); updateHUD(); }
  function toTitle() { PS.audio.stopDrum(); S.mode = "title"; showOverlay("ov-title"); $("hud").classList.add("hidden"); setHuddle(false); newGame(true); }
  function pause() { S.mode = "pause"; PS.audio.stopDrum(); showOverlay("ov-pause"); setHuddle(false); S.input.joy.active = false; S.input.joy.id = -1; S.input.tp.active = false; S.input.hud2 = -1; }
  function resume() { S.mode = "play"; showOverlay(null); lastFrame = performance.now(); }
  function setPace(i) { S.pace = S.cfg.pace[i]; $("btn-pace").textContent = S.pace + "×"; }
  function toggleSound() { PS.audio.setMuted(!PS.audio.isMuted()); syncSound(); }
  function syncDifficulty() { for (const b of $("difficulty").children) b.classList.toggle("sel", b.dataset.k === S.difficulty); }
  function syncSound() { const m = PS.audio.isMuted(); for (const id of ["btn-sound", "btn-sound-title", "btn-sound-pause"]) $(id).classList.toggle("off", m); }

  // ---------------------------------------------------------------- QA: selfTest, fight + match harnesses, replay, bench
  // PS.fight / PS.simMatch / PS.replay / PS.bench swap a throwaway world into S and swap the live one back in a finally block, so a player
  // can call PS.selfTest() mid-match from the console. No localStorage, no DOM (sandbox guards), no sound, no live particles.
  const SANDBOX_KEYS = ["mode", "t", "timeLeft", "agents", "teams", "obstacles", "powerups", "camps", "cam", "input", "rng", "seed", "trickleT", "shake",
    "banners", "hintT", "stats", "engagedNow", "result", "decals", "trails", "attract", "difficulty", "spr", "tick", "acc", "map", "obs", "cap", "dbg",
    "finalCalled", "pendingEnd", "_routedBy", "_hintRecruit", "_hintFight", "_hintHud", "camS", "ev", "lastRout", "thinkRR", "flowW", "fixture"];
  let sbParticles = null, flatMap = null; const sbSets = {};
  function withSandbox(fn) {
    if (sandbox) return fn(); // nested call shares the outer throwaway world
    const saved = {}; for (const k of SANDBOX_KEYS) saved[k] = k in S ? [S[k]] : null;
    const liveP = particles, liveF = floaters, liveSpr = S.spr;
    particles = sbParticles || (sbParticles = PS.Particles(200)); floaters = PS.Floaters(); sandbox = true;
    const spr = Object.create(liveSpr); spr.peasantSet = (c) => sbSets[c] || (sbSets[c] = liveSpr.peasantSet(c)); // one sprite build per colour, ever
    S.spr = spr; S.cam = { x: -1e5, y: -1e5, zoom: 1 }; S.camS = mkCamS(); S.fixture = null;
    S.input = mkInput();
    PS.audio.setSilent(true);
    try { return fn(); }
    finally {
      for (const k of SANDBOX_KEYS) { if (saved[k]) S[k] = saved[k][0]; else delete S[k]; }
      if (S.map) PS.terrain.use(S.map);
      PS.flow.use(S.flowW);
      particles = liveP; floaters = liveF; sandbox = false;
      PS.audio.setSilent(S.attract); // newGame/startGame keep silent === attract; the battle drum re-arms itself next frame if still engaged
      // lastFrame is left alone on purpose: the next rAF can carry a timestamp from before the test, and frame() clamps raw >= 0 anyway
    }
  }
  function sandboxField(map) {
    S.agents = []; S.obstacles = []; S.powerups = []; S.camps = []; S.banners = []; S.decals = []; S.trails = []; S.teams = [];
    S.map = map || flatMap || (flatMap = PS.terrain.flat()); PS.terrain.use(S.map); placeTables(S.map); bucketObstacles();
    S.flowW = PS.flow.use(PS.flow.reset(sbFlow, S.map));
    S.cap = S.cfg.spawn.agentCap; S.dbg = { terrainBad: 0, firstBad: null, capOver: 0 }; S.tick = 0; S.acc = 0; S.ev = mkEv(); S.lastRout = null; S.thinkRR = 0; S.camS = mkCamS();
    S.mode = "sandbox"; S.hintT = 0; S.stats = { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0, fights: 0 };
  }
  // sunflower blob, ~12 px between neighbours; positions on blocked ground are skipped so the blob keeps its headcount
  const blobR = (n) => 7 * Math.sqrt(n);
  function blob(x, y, n, team) { for (let i = 0, k = 0; k < n && i < n * 4; i++) { const a = i * 2.39996, d = 7 * Math.sqrt(i + 0.5), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!PS.terrain.walkable(px, py)) continue; S.agents.push(mkAgent(px, py, team)); k++; } }

  // One clash on an empty field (the flat fixture map): n player peasants vs m Greedy (team 2) peasants, facing edges 60 px apart, both
  // sides charging the other's centroid every tick. No AI think, neutrals, trickle or power-ups; Normal difficulty. Seeded per run.
  // The fight ends at its first rout (or a wipe): survivors are counted at the rout, before the flip; flipped and fled come from it.
  function fightOnce(n, m, maxSeconds, seed) {
    const cfg = S.cfg, W = cfg.world.w, H = cfg.world.h;
    sandboxField(); S.attract = false; S.difficulty = "normal";
    S.t = 0; S.timeLeft = 1e9; S.trickleT = -1e9; S.shake = 0; S.result = null; S.engagedNow = false; S.finalCalled = true; S.pendingEnd = null; S._routedBy = null;
    S._hintRecruit = S._hintFight = S._hintHud = true; S.seed = seed >>> 0; S.rng = mulberry32(S.seed);
    S.teams = [null, mkTeam(1, cfg.player.name, cfg.player.color, true, null)];
    cfg.ai.personalities.forEach((p, i) => S.teams.push(mkTeam(2 + i, p.name, p.color, false, p)));
    for (let i = 1; i < S.teams.length; i++) { S.teams[i].thinkT = 1e9; if (i > 2) S.teams[i].alive = false; }
    blob(W / 2 - 30 - blobR(n), H / 2, n, 1); blob(W / 2 + 30 + blobR(m), H / 2, m, 2);
    recount();
    const p = S.teams[1], r = S.teams[2], max = Math.round(maxSeconds * 60), w0 = performance.now();
    let truncated = false;
    for (let i = 0; i < max; i++) {
      p.tx = r.cx; p.ty = r.cy; r.tx = p.cx; r.ty = p.cy;
      update(DT);
      if (S.lastRout || !p.alive || !r.alive || S.result) break;
      if ((i & 63) === 63 && performance.now() - w0 > 4000) { truncated = true; break; } // lesson 20: wall-clock cap on every sim loop
    }
    const R = S.lastRout, out = { seed: S.seed, seconds: +S.t.toFixed(2), winner: "none", how: "timeout", playerLeft: p.count, rivalLeft: r.count, playerAfter: p.count, flipped: 0, fled: 0, truncated };
    if (R) { const pw = R.winner === 1; out.winner = pw ? "player" : "rival"; out.how = "rout"; out.flipped = R.flipped; out.fled = R.fled; out.playerLeft = pw ? R.winnerBefore : R.loserBefore; out.rivalLeft = pw ? R.loserBefore : R.winnerBefore; }
    else if (!r.alive && p.alive) { out.winner = "player"; out.how = "wipe"; }
    else if (!p.alive && r.alive) { out.winner = "rival"; out.how = "wipe"; out.playerAfter = 0; }
    return out;
  }
  // PS.fight(30, 20, 25, runs, seed): run i is seeded seed + i, so the runs differ and each one replays; reports medians
  function fight(n, m, maxSeconds, runs, seed) {
    n = Math.max(1, n | 0 || 30); m = Math.max(1, m | 0 || 20); maxSeconds = clamp(+maxSeconds || 25, 1, 120); runs = clamp(runs | 0 || 3, 1, 9); seed = seed == null ? 20260924 : seed >>> 0;
    return withSandbox(() => {
      const all = []; for (let i = 0; i < runs; i++) all.push(fightOnce(n, m, maxSeconds, seed + i));
      const med = (k) => { const v = all.map((x) => x[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
      const wins = all.filter((x) => x.winner === "player").length, losses = all.filter((x) => x.winner === "rival").length;
      return { n, m, maxSeconds, seconds: med("seconds"), playerLeft: med("playerLeft"), rivalLeft: med("rivalLeft"), playerAfter: med("playerAfter"), flipped: med("flipped"), fled: med("fled"),
        winner: wins * 2 > runs ? "player" : losses * 2 > runs ? "rival" : "split", playerWins: wins, rivalWins: losses, runs: all };
    });
  }

  // ---------------------------------------------------------------- QA fixtures (SPEC-v2 §13): hand-made maps + scripted scenes
  // Maps: grass inside a 2-cell rock border, plus a full-height ridge (fixtures.passLen cells thick) with one pass of 2 cells (pass64) or
  // 4 cells (pass128), or a short horizontal ridge (flipflop). A scene sets itself up in the current world (sandbox or live) and returns
  // { name, drive(dt) (measures the last tick, then steers; update() calls it first each tick), done(), result() }.
  const fixtureMaps = {};
  function passGeom(kind) {
    const T = PS.terrain, N = T.N, cell = T.cell, FX = S.cfg.fixtures, w = kind === "pass128" ? 4 : 2, x0 = ((N >> 1) - (FX.passLen >> 1)) * cell;
    return { w, x0, x1: x0 + FX.passLen * cell, cy: (N >> 1) * cell, i0: (N >> 1) - (FX.passLen >> 1), j0: (N >> 1) - (w >> 1) };
  }
  function fixtureMap(kind) {
    if (fixtureMaps[kind]) return fixtureMaps[kind];
    const T = PS.terrain, N = T.N, FX = S.cfg.fixtures, terr = new Uint8Array(N * N), pm = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) terr[j * N + i] = 1;
    if (kind === "flipflop") { const [rw, rh] = FX.flipflopRidge, i0 = (N - rw) >> 1, j0 = (N >> 1) - (rh >> 1); for (let j = j0; j < j0 + rh; j++) for (let i = i0; i < i0 + rw; i++) terr[j * N + i] = 1; }
    else { const g = passGeom(kind); for (let j = 2; j < N - 2; j++) for (let i = g.i0; i < g.i0 + FX.passLen; i++) { if (j < g.j0 || j >= g.j0 + g.w) terr[j * N + i] = 1; else pm[j * N + i] = 1; } }
    return (fixtureMaps[kind] = T.fromTerr(terr, { name: kind, passMask: pm }));
  }
  // a fresh scene on map m in the current world: player + the three rivals (dormant), no AI think, no trickle, no power-ups, seeded
  function fixtureBase(m, seed) {
    const cfg = S.cfg, old = S.map;
    S.agents = []; S.obstacles = []; S.powerups = []; S.camps = []; S.banners = []; S.decals = []; S.trails = [];
    S.map = m; PS.terrain.use(m); placeTables(m); bucketObstacles(); if (!sandbox && old && old !== m) releaseGround(old);
    S.flowW = PS.flow.use(PS.flow.reset(sandbox ? sbFlow : liveFlow, m));
    S.cap = cfg.spawn.agentCap; S.dbg = { terrainBad: 0, firstBad: null, capOver: 0 }; S.tick = 0; S.acc = 0; S.ev = mkEv(); S.lastRout = null; S.thinkRR = 0; S.camS = mkCamS();
    S.attract = false; S.difficulty = "normal"; S.t = 0; S.timeLeft = 1e9; S.trickleT = -1e9; S.shake = 0; S.result = null; S.engagedNow = false; S.finalCalled = true; S.pendingEnd = null; S._routedBy = null;
    S._hintRecruit = S._hintFight = S._hintHud = true; S.seed = seed >>> 0; S.rng = mulberry32(S.seed); S.stats = { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0, fights: 0 };
    S.teams = [null, mkTeam(1, cfg.player.name, cfg.player.color, true, null)];
    cfg.ai.personalities.forEach((p, i) => S.teams.push(mkTeam(2 + i, p.name, p.color, false, p)));
    for (let i = 1; i < S.teams.length; i++) { S.teams[i].thinkT = 1e9; if (i > 1) S.teams[i].alive = false; }
    const inp = S.input; inp.route.on = false; inp.hold = false; inp.preview = 0;
    if (!sandbox) { groundInvalidate(m); minimapBake(); }
  }
  const settle = (t) => { recount(); t.pcx = t.cx; t.pcy = t.cy; };
  // pass64 / pass128: a passN swarm startGap left of the ridge, target targetGap past the exit. First agent into the pass to 95% out,
  // then the share within regroupK x 7 sqrt(n) of the centroid regroupAfter s later (C2's model: 7.6 s and 96% at 64 px)
  function fxPass(kind, seed) {
    const FX = S.cfg.fixtures, m = fixtureMap(kind), g = passGeom(kind); fixtureBase(m, seed);
    const p = S.teams[1], tx = g.x1 + FX.targetGap; blob(g.x0 - FX.startGap, g.cy, FX.passN, 1); settle(p); p.tx = tx; p.ty = g.cy;
    let firstIn = -1, out95 = -1, share = -1, n0 = p.count, maxRev = 0;
    return { name: kind, drive() {
      if (share < 0) {
        let inn = 0, past = 0, cnt = 0; for (const a of S.agents) { if (a.team !== 1 || a.dead) continue; cnt++; if (a.x >= g.x0) inn++; if (a.x > g.x1) past++; }
        if (firstIn < 0 && inn > 0) firstIn = S.t; if (out95 < 0 && past >= 0.95 * cnt) out95 = S.t;
        if (out95 >= 0 && S.t >= out95 + FX.regroupAfter) { const R = FX.regroupK * 7 * Math.sqrt(cnt); let ok = 0; for (const a of S.agents) if (a.team === 1 && !a.dead && Math.hypot(a.x - p.cx, a.y - p.cy) < R) ok++; share = ok / Math.max(1, cnt); }
      }
      p.tx = tx; p.ty = g.cy; p.route = true; p.mode = "route";
    }, done: () => share >= 0, result: () => ({ fixture: kind, n: n0, passPx: g.w * m.cell, firstIn: +firstIn.toFixed(2), out95: +out95.toFixed(2), through: out95 >= 0 ? +(out95 - firstIn).toFixed(2) : null,
      regroup: share >= 0 ? +share.toFixed(3) : null, seconds: +S.t.toFixed(2), bar: kind === "pass128" ? 6 : 8 }) };
  }
  // ambush: an ambushColumn swarm (Greedy) strung through the 64 px pass (ambushLanes files, ambushSpacing px apart, its head at the
  // exit) toward a target past a waiting ambushWait (you, holding ambushDist beyond the exit). ambushWait is the smallest force that
  // breaks the head under the M2 combat numbers; the spec's 150 v 30 (ambushSpecWait, opts.wait) is run and reported beside it: the
  // column wins that one locally, because everyone queued within localRadius counts while frontage caps the kills (see M2 notes). At the first rout: who broke, and whether
  // only the head flipped (every flipped agent within flipRadius of the contact, none west of the pass entrance) while the tail kept its
  // colour. opts.blob: the column starts as a dense blob startGap before the pass instead (it floods out and wins locally: reported, not asserted).
  function fxAmbush(seed, opts) {
    const FX = S.cfg.fixtures, RM = S.cfg.combat.remnant, m = fixtureMap("pass64"), g = passGeom("pass64"); fixtureBase(m, seed);
    const nWait = opts.wait || FX.ambushWait, wait = S.teams[1], col = S.teams[2], hx = g.x1 + (opts.dist || FX.ambushDist); col.alive = true;
    if (opts.blob) blob(g.x0 - FX.startGap, g.cy, FX.ambushColumn, 2);
    else for (let k = 0; k < FX.ambushColumn; k++) { const lane = k % FX.ambushLanes, x = g.x1 - 8 - Math.floor(k / FX.ambushLanes) * FX.ambushSpacing, y = g.cy + (lane - (FX.ambushLanes - 1) / 2) * 16; S.agents.push(mkAgent(x, y, 2)); }
    blob(hx, g.cy, nWait, 1); settle(wait); settle(col);
    wait.mode = "hold"; wait.route = false; let R = null, tail = -1, tailKept = -1, colAfter = -1, colBefore = FX.ambushColumn;
    return { name: "ambush", drive() {
      if (S.lastRout && !R) { R = S.lastRout; tail = 0; tailKept = 0; for (const a of S.agents) { if (a.dead || a.x >= g.x0) continue; if (a.team === 2) tailKept++; tail++; } colAfter = col.count; }
      if (!R) colBefore = col.count;
      wait.tx = hx; wait.ty = g.cy; col.tx = hx + 400; col.ty = g.cy; col.route = true;
    }, done: () => !!R || S.t > FX.ambushSeconds, result: () => {
      const headOnly = !!R && R.loser === 2 && R.farFlip <= RM.flipRadius + 1e-6 && (R.minFlipX == null || R.minFlipX >= g.x0) && tailKept === tail && colAfter > 0;
      return { fixture: "ambush", variant: opts.blob ? "dense blob" : "strung " + FX.ambushLanes + " x " + FX.ambushSpacing + " px", column: FX.ambushColumn, waiting: nWait, rout: R, loser: R ? (R.loser === 2 ? "column" : "waiting") : "none", columnAtRout: R ? R.loserBefore : colBefore,
        headFlipped: R ? R.flipped : 0, fled: R ? R.fled : 0, outsideGroup: R ? R.outside : 0, tailWestOfPass: tail, tailKeptColour: tailKept, columnAfter: colAfter, farFlip: R ? R.farFlip : null,
        seconds: +S.t.toFixed(2), pass: headOnly };
    } };
  }
  // flipflop: a flipflopN swarm below a short ridge; the cursor target sits flipflopOffset above it and oscillates +-flipflopAmp (period
  // flipflopPeriod) across the equal-cost line: the x behind the ridge where going round either end costs the same from the swarm's anchor
  // right now (recomputed every tick, so the swarm never escapes the tie by moving; C2's worst case). A route reversal = the traced route
  // switching sides of the ridge. opts.noHyst: every new target's field wins (the baseline that shows the test has teeth); opts.steer:
  // direct steering (desktopMode "steer"), counting centroid U-turns only.
  function fxFlipflop(seed, opts) {
    const FX = S.cfg.fixtures, m = fixtureMap("flipflop"), N = m.N, cell = m.cell, [rw, rh] = FX.flipflopRidge, cx = (N >> 1) * cell, j0 = (N >> 1) - (rh >> 1), ry0 = j0 * cell, ry1 = ry0 + rh * cell;
    fixtureBase(m, seed); const p = S.teams[1], FL = PS.flow; blob(cx, ry1 + FX.flipflopOffset, FX.flipflopN, 1); settle(p);
    const xl = ((N - rw) >> 1) * cell - cell / 2, xr = xl + rw * cell + cell, ty = ry0 - FX.flipflopOffset, hyp = (x, y) => Math.sqrt(x * x + y * y);
    const eq = () => { let lo = xl, hi = xr; for (let k = 0; k < 30; k++) { const x = (lo + hi) / 2, L = hyp(p.ax - xl, p.ay - ry1) + (ry1 - ry0) + hyp(x - xl, ty - ry0), R = hyp(p.ax - xr, p.ay - ry1) + (ry1 - ry0) + hyp(x - xr, ty - ry0); if (L < R) lo = x; else hi = x; } return (lo + hi) / 2; };
    let side = 0, flips = 0, uturns = 0, lastVx = 0, sideLog = "", split = 0;
    return { name: "flipflop", drive() {
      // split: the minority share of the swarm going round the other end (after 0.5 s, agents more than 120 px either side of the centre)
      if (S.t > 0.5) { let l = 0, r = 0; for (const a of S.agents) { if (a.team !== 1 || a.dead) continue; if (a.x < cx - 120) l++; else if (a.x > cx + 120) r++; } const sp = Math.min(l, r) / Math.max(1, p.count); if (sp > split) split = sp; }
      if (!opts.steer && S.t > 0) {
        const f = FL.fieldFor(1), len = f ? FL.trace(f, FL.cellFor(p.ax, p.ay), ROUTE, ROUTE.length) : 0; let sd = 0;
        if (p.ay > ry1) for (let k = 0; k < len; k++) { const c = ROUTE[k], y = (c / N) | 0; if (y >= j0 - 1 && y <= j0 + rh) { sd = ((c % N) + 0.5) * cell < cx ? -1 : 1; break; } }
        if (sd) { if (side && sd !== side) { flips++; sideLog += "@" + S.t.toFixed(1); } side = sd; }
      }
      if (Math.abs(p.vx) > 30) { const sg = p.vx > 0 ? 1 : -1; if (lastVx && sg !== lastVx) uturns++; lastVx = sg; }
      p.tx = (p.ay > ry1 ? eq() : cx) + FX.flipflopAmp * Math.sin((2 * Math.PI * S.t) / FX.flipflopPeriod); p.ty = ty;
      p.mode = opts.steer ? "steer" : "route"; p.route = !opts.steer; p.hyst = !opts.noHyst;
    }, done: () => S.t >= FX.flipflopSeconds, result: () => ({ fixture: "flipflop", mode: opts.steer ? "steer" : opts.noHyst ? "route, no hysteresis" : "route", reversals: flips, at: sideLog,
      split: +split.toFixed(3), uturns, reached: p.ay < ry0, seconds: +S.t.toFixed(2), decisions: FL.stats.decisions, pass: opts.steer || flips <= 2 }) };
  }
  // cliff (M1 critic MINOR-2): a cliffN swarm pressed at a target cliffDepth cells inside the ridge for cliffPress s, then velocity
  // reversals per agent-second over cliffMeasure s. opts.variant: "snapped" (your swarm: the target snaps to the rock's near face, the
  // M2 path), "raw" (a rival with the raw in-rock target and direct seek: pure slide), "idle" (target = own centroid on open grass).
  function fxCliff(seed, opts) {
    const FX = S.cfg.fixtures, m = fixtureMap("pass64"), g = passGeom("pass64"), v = opts.variant || "snapped"; fixtureBase(m, seed);
    const t = S.teams[v === "raw" ? 2 : 1], y = g.cy - 600, FL = PS.flow; t.alive = true; blob(g.x0 - 220, y, FX.cliffN, t.id); settle(t);
    const gx = v === "idle" ? t.cx : g.x0 + FX.cliffDepth * m.cell, gy = v === "idle" ? t.cy : y, pv = new Float32Array(FX.cliffN * 2);
    let rev = 0, samples = 0, spd = 0;
    return { name: "cliff", drive() {
      if (S.t > FX.cliffPress) { let k = 0; for (const a of S.agents) { if (a.team !== t.id || a.dead || k >= FX.cliffN) continue; if (pv[2 * k] * a.vx + pv[2 * k + 1] * a.vy < 0) rev++; spd += Math.hypot(a.vx, a.vy); samples++; k++; } }
      let k = 0; for (const a of S.agents) { if (a.team !== t.id || a.dead || k >= FX.cliffN) continue; pv[2 * k] = a.vx; pv[2 * k + 1] = a.vy; k++; }
      if (v === "snapped") { const q = FL.rayBack(t.ax, t.ay, gx, gy, PS.knowledge); t.tx = q.x; t.ty = q.y; t.mode = "route"; t.route = true; } else { t.tx = gx; t.ty = gy; t.mode = "steer"; t.route = false; }
    }, done: () => S.t >= FX.cliffPress + FX.cliffMeasure, result: () => ({ fixture: "cliff", variant: v, reversalsPerAgentSec: +(rev / Math.max(1, samples) * 60).toFixed(2), meanSpeed: +(spd / Math.max(1, samples)).toFixed(1),
      target: [Math.round(t.tx), Math.round(t.ty)], seconds: +S.t.toFixed(2) }) };
  }
  const FIXTURES = { pass64: (sd) => fxPass("pass64", sd), pass128: (sd) => fxPass("pass128", sd), ambush: (sd, o) => fxAmbush(sd, o || {}), flipflop: (sd, o) => fxFlipflop(sd, o || {}), cliff: (sd, o) => fxCliff(sd, o || {}) };
  // PS.fixture(name, { seed, noHyst, steer, variant, wallMs }): one sandboxed run to its end, with the per-tick terrain assert and flow stats
  function fixture(name, opts) {
    opts = opts || {}; const mk = FIXTURES[name]; if (!mk) return { error: "unknown fixture " + name + " (" + Object.keys(FIXTURES).join(", ") + ")" };
    return withSandbox(() => {
      const w0 = performance.now(), fx = mk(opts.seed == null ? 1 : opts.seed >>> 0, opts), max = Math.round(S.cfg.fixtures.maxSeconds * 60), wallMs = clamp(+opts.wallMs || 9000, 500, 14000);
      S.fixture = fx; S.mode = "sandbox"; let truncated = false;
      for (let i = 0; i < max && !fx.done(); i++) { update(DT); if ((i & 63) === 63 && performance.now() - w0 > wallMs) { truncated = true; break; } } // lesson 20
      const r = fx.result(); r.truncated = truncated; r.terrainBad = S.dbg.terrainBad; r.firstBad = S.dbg.firstBad; r.flow = PS.flow.stats; r.wallMs = Math.round(performance.now() - w0);
      return r;
    });
  }
  // ?fixture=name: the scene runs live instead of the title (camera on your swarm), and restarts 2 s after it ends
  function startFixtureLive(name) {
    const fx = FIXTURES[name](1, name === "cliff" ? { variant: "snapped" } : {}); fx.name = name; fx.doneAt = -1; S.fixture = fx; S.mode = "play";
    const p = S.teams[1]; S.cam.x = p.cx; S.cam.y = p.cy; zoomRule(p.count, 0, true); showOverlay(null); $("hud").classList.add("hidden");
  }

  // PS.simMatch(240, { seed, cap, wallMs }): attract-rules match on a fresh seeded world, all four swarms AI-driven (team 1 plays as Bully).
  // Counts every 30 s. Asserts per tick: agent cap and no agent centre in rock or deep water.
  function simMatch(seconds, opts) {
    opts = opts || {};
    const lim = clamp(+seconds || S.cfg.world.matchSeconds, 1, 600), wallMs = clamp(+opts.wallMs || 10000, 500, 14000);
    return withSandbox(() => {
      sandboxField(); S.attract = true; newGame(true, { seed: opts.seed != null ? opts.seed : (Math.random() * 4294967296) >>> 0, cap: opts.cap === "touch" ? S.cfg.spawn.touchAgentCap : opts.cap === "desktop" ? S.cfg.spawn.agentCap : +opts.cap || S.cfg.spawn.agentCap });
      S.mode = "sandbox";
      const tl = [], errors = [], w0 = performance.now(); let maxTotal = S.agents.length, next = 30, end = "limit", truncated = false;
      const snap = () => { const c = []; let nn = 0; for (let i = 1; i < S.teams.length; i++) c.push(S.teams[i].count); for (const a of S.agents) if (a.team === 0) nn++; tl.push({ t: Math.round(S.t), counts: c, neutrals: nn, total: S.agents.length }); };
      snap();
      for (let i = 0; i < lim * 60; i++) {
        let alive = 0; for (let j = 1; j < S.teams.length; j++) if (S.teams[j].alive) alive++;
        if (alive <= 1) { end = "last-standing"; break; }
        if (S.timeLeft - DT <= 0) { end = "bell"; break; } // attract update() would start a new world here
        try { update(DT); } catch (e) { errors.push(String((e && e.message) || e)); break; }
        if (S.agents.length > maxTotal) maxTotal = S.agents.length;
        if (S.t >= next - 1e-9) { snap(); next += 30; }
        if ((i & 63) === 63 && performance.now() - w0 > wallMs) { truncated = true; break; } // lesson 20
      }
      if (tl[tl.length - 1].t !== Math.round(S.t)) snap();
      let win = null; for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && (!win || t.count > win.count)) win = t; }
      return { seed: S.seed, map: PS.terrain.report(S.map), seconds: +S.t.toFixed(2), end, truncated, wallMs: Math.round(performance.now() - w0), msPerTick: +((performance.now() - w0) / Math.max(1, S.tick)).toFixed(3),
        names: S.teams.slice(1).map((t) => t.name), winner: win ? { id: win.id, name: win.name, count: win.count } : null, maxTotal, agentCap: S.cap,
        capOver: S.dbg.capOver, terrainBad: S.dbg.terrainBad, firstBad: S.dbg.firstBad, timeline: tl, exceptions: errors, ev: { ...S.ev }, flow: PS.flow.stats,
        leftHome: S.teams.slice(1).map((t) => t.leftHome), atCentre: S.teams.slice(1).map((t) => t.atCentre) };
    });
  }

  // PS.replay(seed, seconds): the real newGame path (not attract) with a zero-input player, run twice; both stateSigs must match
  function replayOnce(seed, seconds) {
    return withSandbox(() => {
      sandboxField(); S.difficulty = "normal"; newGame(false, { seed }); S.mode = "play";
      const w0 = performance.now(); let truncated = false;
      for (let i = 0; i < seconds * 60; i++) { update(DT); if ((i & 63) === 63 && performance.now() - w0 > 6000) { truncated = true; break; } }
      return { sig: stateSig(), t: +S.t.toFixed(3), agents: S.agents.length, truncated, ms: Math.round(performance.now() - w0), map: S.map.used };
    });
  }
  function replay(seed, seconds) {
    seed = seed == null ? 424242 : seed >>> 0; seconds = clamp(+seconds || 60, 1, 120);
    const a = replayOnce(seed, seconds), b = replayOnce(seed, seconds);
    return { seed, seconds, same: a.sig === b.sig && !a.truncated && !b.truncated, a: { t: a.t, agents: a.agents, ms: a.ms, truncated: a.truncated, map: a.map }, b: { t: b.t, agents: b.agents, ms: b.ms, truncated: b.truncated } };
  }

  // PS.bench("capclash", { ticks, cap }): 4 teams x (cap-200)/4 in two clashes on screen + 200 neutrals in camps of 5, built through mkAgent,
  // on the first fallback map at its most open spot. No rout (engageDelay parked), no AI think, camera pinned on the scene. Times update()
  // and draw() per tick with performance.now; drawImage + full-screen alpha layers are counted on 10 extra frames through a wrapped context.
  // Same scene shape as the v1 reference copy measured before M1 (see M1-build-notes.md), so v2 can be gated at <= 1.1x v1.
  let benchMap = null, benchTick = () => {};
  function pct(a, p) { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3); }
  function benchLayout(cx, cy, per, zoom, okAt) {
    const vwW = S.vw / zoom, vhW = S.vh / zoom, land = vwW >= vhW, off = Math.min(0.25 * (land ? vwW : vhW), 300), br = blobR(per);
    const clashes = land ? [[cx - off, cy], [cx + off, cy]] : [[cx, cy - off], [cx, cy + off]];
    const blobs = []; clashes.forEach(([x, y], k) => { blobs.push([x - 30 - br, y, 1 + 2 * k]); blobs.push([x + 30 + br, y, 2 + 2 * k]); });
    const grid = (step, ox, want, test) => { const out = []; const x0 = cx - vwW / 2 + 40 + ox, y0 = cy - vhW / 2 + 40 + ox, keep = br + 90;
      for (let y = y0; y <= cy + vhW / 2 - 40 && out.length < want; y += step) for (let x = x0; x <= cx + vwW / 2 - 40 && out.length < want; x += step) {
        let ok = true; for (const b of blobs) if ((b[0] - x) * (b[0] - x) + (b[1] - y) * (b[1] - y) < keep * keep) { ok = false; break; }
        if (ok && test(x, y)) out.push([x, y]);
      } return out; };
    const want = grid(110, 0, 40, () => true).length; // the v1 layout's camp count on open ground
    let camps = grid(110, 0, want, okAt); if (camps.length < want) camps = camps.concat(grid(55, 27, want - camps.length, (x, y) => okAt(x, y) && camps.every((c) => (c[0] - x) * (c[0] - x) + (c[1] - y) * (c[1] - y) > 50 * 50)));
    return { blobs, camps, want };
  }
  function countFrame(n) {
    const oDI = ctx.drawImage, oFR = ctx.fillRect, cw = canvas.width, ch = canvas.height; let di = 0, layers = 0;
    const full = (x, y, w, h) => { const m = ctx.getTransform(); const ax = m.a * x + m.e, ay = m.d * y + m.f, bx = m.a * (x + w) + m.e, by = m.d * (y + h) + m.f; return Math.min(ax, bx) <= 1 && Math.min(ay, by) <= 1 && Math.max(ax, bx) >= cw - 1 && Math.max(ay, by) >= ch - 1; };
    ctx.drawImage = function (img, a, b, c, d) { di++; const w = arguments.length >= 5 ? (arguments.length >= 9 ? arguments[7] : c) : img.width, h = arguments.length >= 5 ? (arguments.length >= 9 ? arguments[8] : d) : img.height;
      const x = arguments.length >= 9 ? arguments[5] : a, y = arguments.length >= 9 ? arguments[6] : b; if (full(x, y, w, h)) layers++; return oDI.apply(this, arguments); };
    ctx.fillRect = function (x, y, w, h) { if (full(x, y, w, h) && (ctx.globalAlpha < 1 || typeof ctx.fillStyle !== "string" || ctx.fillStyle.length > 7)) layers++; return oFR.apply(this, arguments); };
    try { for (let i = 0; i < n; i++) { benchTick(); draw(); } } finally { delete ctx.drawImage; delete ctx.fillRect; }
    return { drawImage: di / n, layers: layers / n };
  }
  function bench(scene, opts) {
    opts = opts || {}; scene = scene || "capclash";
    const ticks = clamp(opts.ticks | 0 || 300, 30, 1200), warm = 20, cap = opts.cap || 1000, nNeutral = 200, per = Math.floor((cap - nNeutral) / 4);
    const cfg = S.cfg, delay0 = cfg.combat.engageDelay, w0 = performance.now();
    if (!benchMap) benchMap = PS.terrain.gen(cfg.terrain.fallbackSeeds[0]);
    try {
      cfg.combat.engageDelay = 1e9; // no rout: both clashes stay alive for the whole window
      return withSandbox(() => {
        sandboxField(benchMap); S.attract = false; S.difficulty = "normal"; S.mode = "play"; S.t = 0; S.timeLeft = 1e9; S.trickleT = -1e9; S.shake = 0;
        S.result = null; S.pendingEnd = null; S.finalCalled = true; S._routedBy = null; S._hintRecruit = S._hintFight = S._hintHud = true; S.seed = 777; S.rng = mulberry32(777); S.cap = cap + 64;
        S.teams = [null, mkTeam(1, cfg.player.name, cfg.player.color, true, null)];
        cfg.ai.personalities.forEach((p, i) => S.teams.push(mkTeam(2 + i, p.name, p.color, false, p)));
        for (let i = 1; i < S.teams.length; i++) S.teams[i].thinkT = 1e9;
        const zoom = S.vw < cfg.camera.mobileBreak ? cfg.camera.zoomMobile : cfg.camera.zoomDesktop, L0 = benchLayout(0, 0, per, zoom, () => true), pad = blobR(per) + 24;
        const c = benchSpot(benchMap, S.vw / zoom, S.vh / zoom, L0.blobs.map((b) => [b[0] - pad, b[1] - pad, b[0] + pad, b[1] + pad])), cx = c.x, cy = c.y;
        const L = benchLayout(cx, cy, per, zoom, (x, y) => PS.terrain.placementOk(x, y, 1));
        for (const b of L.blobs) blob(b[0], b[1], per, b[2]);
        for (const q of L.camps) spawnCamp(q[0], q[1], 5);
        recount(); for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; t.pcx = t.cx; t.pcy = t.cy; }
        const T = S.teams, pin = () => { S.cam.x = cx; S.cam.y = cy; S.cam.zoom = zoom; S.shake = 0; };
        benchTick = () => { T[1].tx = T[2].cx; T[1].ty = T[2].cy; T[2].tx = T[1].cx; T[2].ty = T[1].cy; T[3].tx = T[4].cx; T[3].ty = T[4].cy; T[4].tx = T[3].cx; T[4].ty = T[3].cy; update(DT); pin(); };
        pin(); flushGround(benchMap);
        const up = [], dr = []; let fl0 = null;
        for (let i = 0; i < warm + ticks; i++) {
          if (i === warm) fl0 = PS.flow.stats;
          const a = performance.now(); benchTick(); const b = performance.now(); draw(); const e = performance.now();
          if (i >= warm) { up.push(b - a); dr.push(e - b); }
          if (e - w0 > 12000) break; // lesson 20
        }
        const fl1 = PS.flow.stats, flow = { rebuilds: fl1.rebuilds - fl0.rebuilds, ms: +(fl1.costMs - fl0.costMs).toFixed(2), msPerTick: +((fl1.costMs - fl0.costMs) / Math.max(1, up.length)).toFixed(3), maxMs: fl1.maxCostMs, decisions: fl1.decisions };
        const cnt = countFrame(10);
        let onScreen = 0; const z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z; for (const a of S.agents) if (Math.abs(a.x - S.cam.x) < hw && Math.abs(a.y - S.cam.y) < hh) onScreen++;
        const mean = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3);
        return { scene, build: "v2", ticks: up.length, agents: S.agents.length, onScreen, counts: S.teams.slice(1).map((t) => t.count), camps: L.camps.length + "/" + L.want, viewport: [S.vw, S.vh, S.dpr], zoom,
          spot: [Math.round(cx), Math.round(cy), c.blockedInClash, +c.open.toFixed(2)], terrainBad: S.dbg.terrainBad,
          update: { p50: pct(up, 0.5), p90: pct(up, 0.9), p99: pct(up, 0.99), mean: mean(up) }, draw: { p50: pct(dr, 0.5), p90: pct(dr, 0.9), p99: pct(dr, 0.99), mean: mean(dr) },
          drawImage: cnt.drawImage, layers: cnt.layers, flow, wallMs: Math.round(performance.now() - w0), shot: opts.shot ? canvas.toDataURL() : undefined };
      });
    } finally { cfg.combat.engageDelay = delay0; benchTick = () => {}; }
  }
  // the bench spot: both clash footprints (rects relative to the centre) fully walkable, then the most open w x h view (ties: nearest the centre)
  function benchSpot(m, w, h, rects) {
    const N = m.N, cell = m.cell, N1 = N + 1, open = new Int32Array(N1 * N1), blocked = new Int32Array(N1 * N1), walk = PS.terrain.walkT;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i, k = (j + 1) * N1 + i + 1, wk = walk(m.terr[c]);
      open[k] = (wk && m.sdf[c] >= cell ? 1 : 0) + open[k - N1] + open[k - 1] - open[k - N1 - 1];
      blocked[k] = (wk ? 0 : 1) + blocked[k - N1] + blocked[k - 1] - blocked[k - N1 - 1];
    }
    const box = (A, i0, j0, i1, j1) => { i0 = clamp(i0, 0, N); j0 = clamp(j0, 0, N); i1 = clamp(i1, 0, N); j1 = clamp(j1, 0, N); return A[j1 * N1 + i1] - A[j0 * N1 + i1] - A[j1 * N1 + i0] + A[j0 * N1 + i0]; };
    const hw = Math.ceil(w / 2 / cell), hh = Math.ceil(h / 2 / cell); let best = null;
    for (let j = hh; j <= N - hh; j++) for (let i = hw; i <= N - hw; i++) {
      let bad = 0; for (const r of rects) bad += box(blocked, i + Math.floor(r[0] / cell), j + Math.floor(r[1] / cell), i + Math.ceil(r[2] / cell), j + Math.ceil(r[3] / cell));
      const v = box(open, i - hw, j - hh, i + hw, j + hh), d = (i - N / 2) * (i - N / 2) + (j - N / 2) * (j - N / 2);
      if (!best || bad < best.bad || (bad === best.bad && (v > best.v || (v === best.v && d < best.d)))) best = { bad, v, d, i, j };
    }
    return { x: best.i * cell, y: best.j * cell, open: best.v / (4 * hw * hh), blockedInClash: best.bad };
  }

  // every config path game.js, terrain.js + sprites.js read. n number, s string, a array, o object
  const CFG_KEYS = ("world.w:n world.h:n world.tile:n world.trees:n world.rocks:n world.matchSeconds:n world.finalSeconds:n world.decals:n world.trailDist:n world.campLabelDist:n " +
    "spawn.neutralCamps:n spawn.campMin:n spawn.campMax:n spawn.campSpread:n spawn.starterCamps:n spawn.starterDist.0:n spawn.starterDist.1:n spawn.trickleEvery:n " +
    "spawn.trickleCap:n spawn.agentCap:n spawn.touchAgentCap:n spawn.minTrickleDistFromTeams:n spawn.underdogBias:n spawn.trickleCamps:n spawn.trickleBeyond.0:n spawn.trickleBeyond.1:n " +
    "spawn.campGap:n spawn.campClearOfStarts:n spawn.obstacleClearOfStarts:n " +
    "agent.radius:n agent.hp:n agent.speed:n agent.damage:n agent.attackInterval:n agent.engageRadius:n agent.attackRange:n agent.recruitRadius:n agent.fightSpeedMult:n " +
    "agent.sizeSpeed:o agent.sizeSpeed.boost:n agent.sizeSpeed.full:n agent.sizeSpeed.drop:n agent.sizeSpeed.floor:n " +
    "flock.seek:n flock.arrive:n flock.separation:n flock.sepRadius:n flock.cohesion:n flock.cohesionStart:n flock.cohesionFull:n flock.huddleCohesion:n flock.huddleSepRadius:n " +
    "flock.huddleSpeedMult:n flock.steerLerp:n flock.neutralWander:n flock.neutralWanderRadius:n flock.enemySepMult:n flock.enemyHardRadius:n flow.slideMargin:n " +
    "flow.wallBias:n flow.earlyStopCells:n flow.playerHz:n flow.missTicks:n flow.hysteresis:n flow.sameShare:n flow.sameCells:n flow.pathCohesionK:n flow.pathCohesionClamp.0:n " +
    "flow.pathCohesionClamp.1:n flow.localCohesion:n flow.localCohesionRadius:n flow.fromMeCap:n flow.farDetour:n flow.fleeCampBonus:n flow.fleeCandidates:n flow.routeDrawRatio:n " +
    "flow.previewSeconds:n flow.walkStep:n flow.walkGoalPx:n flow.corridorDiscount:n flow.corridorMinCells:n flow.corridorCells:n flow.corridorBlobK:n agent.damageJitter:n " +
    "combat.breakRatio:n combat.minRoutSize:n combat.engageDelay:n combat.engageDecay:n combat.fightPull:n combat.moraleBreak:n combat.localRadius:n combat.moraleSmoothing:n " +
    "combat.contactPull:n combat.contactPullStart:n combat.contactPullRamp:n combat.breakHold:n combat.routLink:n combat.spoilsRadius:n combat.remnant:o combat.remnant.minLoser:n combat.remnant.flipShare:n combat.remnant.flipRadius:n " +
    "combat.remnant.escapeSeconds:n combat.remnant.escapeSpeed:n combat.remnant.regroupSeconds:n combat.remnant.scatterDist.0:n combat.remnant.scatterDist.1:n finale.crownAbsorbs:b " +
    "camera.span0:n camera.spanK:n camera.zoomMin:n camera.zoomMinTouch:n camera.zoomMax:n camera.steps:o camera.steps.dpr1:a camera.steps.dpr2:a camera.hysteresis:n camera.ease:n " +
    "camera.lookAhead:n camera.lookAheadCap:n camera.lookAheadMinSpeed:n camera.clashOffsetCap:n touch.joyEdge:n input.desktopMode:s input.tapMs:n input.tapPx:n input.keyLead:n " +
    "input.routeBreakPx:n input.pickPx:n ai.roamSpeed:n terrain.probeFrames:n " +
    "fixtures.passLen:n fixtures.passN:n fixtures.startGap:n fixtures.targetGap:n fixtures.regroupAfter:n fixtures.regroupK:n fixtures.maxSeconds:n fixtures.ambushColumn:n " +
    "fixtures.ambushWait:n fixtures.ambushSpecWait:n fixtures.ambushLanes:n fixtures.ambushSpacing:n fixtures.ambushDist:n fixtures.ambushSeconds:n fixtures.flipflopN:n fixtures.flipflopRidge.0:n fixtures.flipflopRidge.1:n fixtures.flipflopOffset:n " +
    "fixtures.flipflopAmp:n fixtures.flipflopPeriod:n fixtures.flipflopSeconds:n fixtures.cliffN:n fixtures.cliffDepth:n fixtures.cliffPress:n fixtures.cliffMeasure:n " +
    "powerups.count:n powerups.respawn:n powerups.pickupRadius:n powerups.minDistFromStart:n powerups.duration:o powerups.speedMult:n powerups.armorMult:n powerups.contestTol:n " +
    "powerups.frenzyMult:n powerups.rallyRadius:n powerups.weights:o powerups.duration.speed:n powerups.duration.armor:n powerups.duration.frenzy:n powerups.duration.rally:n " +
    "ai.think:n ai.sight:n ai.leadTime:n ai.leadSmooth:n ai.fleeDistance:n ai.personalities:a ai.finalHuntRatio:n ai.finalFleeRatio:n ai.huntSpeed:n ai.fleeSpeed:n ai.corneredDist:n ai.gracePeriod:n " +
    "ai.aiVsAiHuntMult:n ai.powerupSight:n ai.powerScore:n ai.neutralScore:n ai.huntTimeout:n ai.huntCooldown:n " +
    "player.name:s player.color:s neutral.color:s camera.lerp:n camera.zoomDesktop:n camera.zoomMobile:n camera.mobileBreak:n pace:a difficulty.normal:o " +
    "touch.joyRadius:n touch.joyDead:n touch.joyLead:n fog.sight0:n fog.sightK:n fog.bucketSight:n " +
    "terrain.cell:n terrain.blockedFraction:n terrain.noisePeriod:n terrain.caPasses:n terrain.disc:n terrain.spawnRing:n terrain.centerRadius:n terrain.homeRadius:n " +
    "terrain.homeWall:n terrain.exitWidth:n terrain.hubWall:n terrain.ridgeWidth:n terrain.ridgeWobble:n terrain.ridgeSpine:n terrain.rimRamp:n terrain.corridorHalf:n " +
    "terrain.riverWidth:a terrain.riverWobble:n terrain.riverPeriod:n terrain.crossings:a terrain.crossingMaxGap:n terrain.bridgeWidth:n terrain.fordWidth:a terrain.fordSpeed:n " +
    "terrain.passWidth:a terrain.pocketFill:n terrain.maxRerolls:n terrain.fairness:o terrain.fairness.rivalRatio:n terrain.fairness.centreRatio:n terrain.fairness.detour:a " +
    "terrain.fairness.minExits:n terrain.costs:o terrain.costs.base:n terrain.costs.wall1:n terrain.costs.wall2:n terrain.costs.ford:n terrain.costs.prop:n " +
    "terrain.fallbackSeeds:a terrain.chunk:n terrain.chunkArt:n terrain.waterFrameMs:n").split(" ");
  const cfgGet = (path) => { let o = S.cfg; for (const k of path.split(".")) { if (o == null) return undefined; o = o[k]; } return o; };
  const typeOk = (v, t) => (t === "n" ? typeof v === "number" && isFinite(v) : t === "s" ? typeof v === "string" && v.length > 0 : t === "a" ? Array.isArray(v) && v.length > 0 : t === "b" ? typeof v === "boolean" : !!v && typeof v === "object");
  function configReport() {
    const cfg = S.cfg, missing = [], used = {};
    for (const e of CFG_KEYS) { const [path, t] = e.split(":"); used[path.replace(/\.\d+$/, "")] = 1; used[path] = 1; if (!typeOk(cfgGet(path), t)) missing.push(path); }
    (cfg.ai && cfg.ai.personalities || []).forEach((p, i) => { for (const k of ["name:s", "color:s", "huntRatio:n", "fleeRatio:n", "neutralBias:n", "powerBias:n", "hatesPlayer:n"]) { const [f, t] = k.split(":"); if (!typeOk(p[f], t)) missing.push("ai.personalities." + i + "." + f); } });
    if (!cfg.ai || !cfg.ai.personalities || cfg.ai.personalities.length < 2) missing.push("ai.personalities.1 (attract mode plays team 1 as personality 1)");
    for (const d in cfg.difficulty || {}) for (const k of ["label:s", "aiSpeed:n", "think:n", "huntMult:n", "startBonus:n"]) { const [f, t] = k.split(":"); if (!typeOk(cfg.difficulty[d][f], t)) missing.push("difficulty." + d + "." + f); }
    (cfg.pace || []).forEach((v, i) => { if (!typeOk(v, "n")) missing.push("pace." + i); });
    if (cfg.input && ["route", "steer"].indexOf(cfg.input.desktopMode) < 0) missing.push("input.desktopMode (route | steer)");
    for (const k in (cfg.powerups && cfg.powerups.weights) || {}) { if (!S.spr.PU[k] || !typeOk(cfg.powerups.duration[k], "n")) missing.push("powerups.weights." + k + " (needs a PU icon + duration)"); }
    // tunables in config.json that no code reads (informational: a retune there does nothing)
    const unused = [];
    for (const sec of ["world", "spawn", "agent", "flock", "flow", "combat", "powerups", "ai", "camera", "touch", "fog", "terrain", "input", "finale", "fixtures"]) for (const k in cfg[sec] || {}) {
      const path = sec + "." + k; if (used[path]) continue; unused.push(path);
    }
    return { checked: CFG_KEYS.length, missing, unused };
  }
  // SPEC-v2: every new key carries units and a range in config._units; numbers (and every element of a numeric array) must sit in range
  function unitsReport() {
    const U = S.cfg._units || {}, bad = [], keys = Object.keys(U);
    for (const k of keys) {
      const u = U[k], v = cfgGet(k); if (!Array.isArray(u) || u.length !== 3 || typeof u[0] !== "string") { bad.push(k + ": malformed _units entry"); continue; }
      const vals = Array.isArray(v) ? v : [v];
      if (!vals.length || vals.some((x) => typeof x !== "number" || !isFinite(x))) { bad.push(k + ": missing or not numeric"); continue; }
      for (const x of vals) if (x < u[1] || x > u[2]) bad.push(k + " = " + x + " outside [" + u[1] + ", " + u[2] + "] " + u[0]);
    }
    return { checked: keys.length, bad };
  }

  // lesson 28: every cached sprite canvas must have opaque pixels. Read back through ONE scratch canvas, never the cache itself (lesson 27).
  let scratch = null, scratchCtx = null;
  function opaqueCount(c) {
    if (!c || !c.width || !c.height) return 0;
    if (!scratch) { scratch = document.createElement("canvas"); scratchCtx = scratch.getContext("2d", { willReadFrequently: true }); }
    if (scratch.width < c.width || scratch.height < c.height) { scratch.width = Math.max(scratch.width, c.width); scratch.height = Math.max(scratch.height, c.height); }
    let d; try { scratchCtx.clearRect(0, 0, c.width, c.height); scratchCtx.drawImage(c, 0, 0); d = scratchCtx.getImageData(0, 0, c.width, c.height).data; } catch (e) { return -1; }
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  }
  function spriteReport() {
    const spr = S.spr, list = spriteCanvases(spr, S.teams);
    if (!spr._neutral) { const set = spr.peasantSet(S.cfg.neutral.color); for (const f of ["R", "L", "RW", "LW"]) set[f].forEach((c, i) => list.push(["neutral." + f + i, c])); } // draw() caches it on first frame; if none yet, check a fresh build, don't store it
    const blank = []; let unreadable = 0;
    for (const [k, c] of list) { const n = opaqueCount(c); if (n === 0) blank.push(k); else if (n < 0) unreadable++; }
    return { total: list.length, blank, unreadable };
  }

  function stateSig() {
    let h = 0; for (const a of S.agents) h += a.x * 1.3 + a.y * 0.7 + a.vx * 0.11 + a.vy * 0.13 + a.hp * 3 + a.team * 11 + (a.tgt ? 5 : 0) + a.atk * 0.17 + a.ph * 0.01;
    const tm = S.teams.slice(1).map((t) => [t.count, t.alive, t.tx, t.ty, t.cx, t.cy, t.vx, t.vy, t.thinkT, t.kills, t.state, t.slot, t.mode, t.route, t.tMed, t.regroupUntil, t.engL.join(",")]);
    return JSON.stringify([S.mode, S.t, S.tick, S.timeLeft, S.seed, S.map ? S.map.used : null, S.agents.length, h, tm, S.cam, S.stats, S.banners.length, S.result, S.pendingEnd, S.difficulty, S.attract,
      S.camps.length, S.powerups.map((p) => [p.x, p.y, p.alive, p.kind]), S.trickleT, S.shake, S.engagedNow, S.input.huddle, S.input.joy.active, S.hintT, S.ev, S.thinkRR, PS.flow.stats && PS.flow.stats.rebuilds]);
  }
  function lsSnapshot() { try { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o.push(k + "=" + localStorage.getItem(k)); } return o.sort().join("\n"); } catch (e) { return "unavailable"; } }

  // terrain on 20 seeds: each generates within maxRerolls, is fair and one region, and placement puts every spawn and object on open ground;
  // then one forced failure must land on a vetted fallback seed
  function terrainSuite(n) {
    const T = PS.terrain, cfg = S.cfg, out = { seeds: [], genMs: [], rerolls: [0, 0, 0, 0, 0], fallbacks: 0, bad: [] };
    for (let i = 0; i < n; i++) {
      const seed = 1000 + i * 7919, m = T.gen(seed), r = T.report(m); out.genMs.push(m.genMs); if (m.fallback) out.fallbacks++; else out.rerolls[Math.min(4, m.rerolls)]++;
      const why = [];
      if (m.rerolls > cfg.terrain.maxRerolls || m.fallback) why.push("rerolls " + m.rerolls + (m.fallback ? " fallback" : ""));
      if (!m.fair.pass) why.push("unfair " + m.fair.why.join(","));
      if (!m.fair.oneRegion) why.push("regions");
      const xs = m.river.crossings.map((x) => x.s).sort((a, b) => a - b); for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > cfg.terrain.crossingMaxGap) why.push("crossing gap " + Math.round(xs[k] - xs[k - 1]));
      // placement on this map through the real newGame path (sandboxed), then every object checked on the map's own arrays
      const pl = withSandbox(() => {
        sandboxField(m); newGame(false, { map: m, seed: seed ^ 0x5bd1e995 });
        const ok2 = (x, y, k) => T.placementOk(x, y, k), fails = [];
        for (const s of m.spawns) if (!ok2(s.x, s.y, 2)) fails.push("spawn");
        for (const c of S.camps) if (!ok2(c.x, c.y, 2)) fails.push("camp");
        for (const p of S.powerups) if (!ok2(p.x, p.y, 2)) fails.push("powerup");
        for (const o of S.obstacles) if (!ok2(o.x, o.y, 3)) fails.push("obstacle");
        for (const a of S.agents) if (!T.walkable(a.x, a.y)) fails.push("agent");
        const regions = [0, 0, 0, 0, 0, 0]; for (const c of S.camps) { const o = m.owner[T.cellOf(c.x, c.y)]; if (o < 6) regions[o]++; }
        return { fails, camps: S.camps.length, powerups: S.powerups.length, obstacles: S.obstacles.length, regions };
      });
      if (pl.fails.length) why.push("placement " + pl.fails.slice(0, 5).join(","));
      if (pl.regions.some((v) => v === 0)) why.push("empty region " + pl.regions.join("/"));
      out.seeds.push({ seed, used: m.used, rerolls: m.rerolls, genMs: m.genMs, blocked: m.blocked, rival: r.fair.rival, centre: r.fair.centre, detour: r.fair.detour, camps: pl.regions.join("/"), ok: !why.length });
      if (why.length) out.bad.push(seed + ": " + why.join("; "));
    }
    const fm = T.gen(1000, { forceFail: true });
    out.forcedFallback = { fallback: fm.fallback, used: fm.used, inList: cfg.terrain.fallbackSeeds.indexOf(fm.used) >= 0, pass: fm.fair.pass, attempts: fm.attempts, genMs: fm.genMs };
    const s = [...out.genMs].sort((a, b) => a - b); out.genP50 = s[s.length >> 1]; out.genMax = s[s.length - 1];
    return out;
  }

  // direction-field walk (SPEC-v2 §13) on n seeds: a full field to the map centre (even) or a spawn (odd), then a point walked from every
  // walkable main-region cell must reach it (catches zero-gradient cells, walls the blend points into, dead ends)
  function flowWalkSuite(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const seed = 1000 + i * 7919, m = PS.terrain.gen(seed);
      out.push(withSandbox(() => {
        sandboxField(m); const t = mkTeam(1, "walk", S.cfg.player.color, true, null), c = m.W / 2, g = i % 2 ? m.spawns[i % m.spawns.length] : { x: c, y: c }, q = PS.terrain.snapXY(g.x, g.y);
        t.tx = t.ax = q.x; t.ty = t.ay = q.y; S.teams = [null, t]; PS.flow.tick(S.teams, [], 0);
        const r = PS.flow.walkFromEveryCell(1, { wallMs: 2600 }); r.seed = seed; r.target = [Math.round(q.x), Math.round(q.y)]; return r;
      }));
    }
    return out;
  }
  // knowledge plumbing (M3 drives it from fog): the player does not know the ridge, so it costs as grass and the route runs straight
  // through it; revealing blocked cells off the route changes nothing; revealing the ridge re-plans on the next allowed tick, via the pass
  function knowledgeReplan() {
    return withSandbox(() => {
      const m = fixtureMap("pass64"), g = passGeom("pass64"), N = m.N, cell = m.cell; fixtureBase(m, 7);
      const p = S.teams[1], FL = PS.flow, kn = PS.knowledge, y = g.cy - 800, tx = g.x1 + 300, ridge = (c) => m.terr[c] === 1 && (c % N) >= g.i0 && (c % N) < g.i0 + S.cfg.fixtures.passLen;
      for (let c = 0; c < N * N; c++) if (ridge(c)) kn[c] = 0;
      blob(g.x0 - 300, y, 12, 1); settle(p);
      S.fixture = { name: "knowledge", drive() { p.tx = tx; p.ty = y; p.route = true; p.mode = "route"; }, done: () => false, result: () => null };
      for (let i = 0; i < 8; i++) update(DT);
      const before = FL.pathCell(FL.fieldFor(1), FL.cellFor(p.ax, p.ay)), straight = Math.hypot(tx - p.ax, y - p.ay);
      let r0 = FL.stats.rebuilds; for (let c = (N - 8) * N; c < N * N; c++) if (ridge(c)) FL.learn(c); // far below the route
      for (let i = 0; i < 8; i++) update(DT); const offRoute = FL.stats.rebuilds - r0;
      r0 = FL.stats.rebuilds; for (let c = 0; c < N * N; c++) if (ridge(c)) FL.learn(c);
      for (let i = 0; i < 8; i++) update(DT); const onRoute = FL.stats.rebuilds - r0;
      const f = FL.fieldFor(1), a = FL.cellFor(p.ax, p.ay), after = FL.pathCell(f, a), len = FL.trace(f, a, ROUTE, ROUTE.length); let viaPass = false;
      for (let k = 0; k < len; k++) { const c = ROUTE[k], i = c % N, j = (c / N) | 0; if (i >= g.i0 && i < g.i0 + S.cfg.fixtures.passLen && j >= g.j0 && j < g.j0 + g.w) viaPass = true; }
      return { before: Math.round(before), straight: Math.round(straight), offRouteRebuilds: offRoute, onRouteRebuilds: onRoute, after: Math.round(after), viaPass,
        pass: before < straight * 1.2 && offRoute === 0 && onRoute >= 1 && after > before * 1.5 && viaPass };
    });
  }
  // the clash panel's opening read of an n v m clash on the flat field (player n): verdict at the first engaged tick and 0.5 s later
  function clashVerdictTest(n, m) {
    return withSandbox(() => {
      fixtureBase(flatMap || (flatMap = PS.terrain.flat()), 99); const p = S.teams[1], r = S.teams[2]; r.alive = true; blob(S.cfg.world.w / 2 - 30 - blobR(n), S.cfg.world.h / 2, n, 1); blob(S.cfg.world.w / 2 + 30 + blobR(m), S.cfg.world.h / 2, m, 2); settle(p); settle(r);
      S.fixture = { name: "clash", drive() { p.tx = r.cx; p.ty = r.cy; r.tx = p.cx; r.ty = p.cy; }, done: () => false, result: () => null };
      let first = null, later = null, t0 = -1;
      for (let i = 0; i < 360 && !later; i++) { update(DT); if (p.engT[2] > 0) { if (!first) { first = { ...clashRead(p, r), L: [Math.round(p.engL[2]), Math.round(r.engL[1])], t: +S.t.toFixed(2) }; t0 = S.t; } else if (S.t - t0 >= 0.5) later = { ...clashRead(p, r), L: [Math.round(p.engL[2]), Math.round(r.engL[1])], t: +S.t.toFixed(2) }; } }
      return { n, m, first, later, verdict: first ? first.verdict : "none" };
    });
  }

  // PS.selfTest({ matchSeconds, parts }) -> { pass, fails: [names], results: { name: { pass, detail } }, ms }. One console line.
  // parts (array or "a,b"): config sprites terrain caches fight replay match (default: all). The harness calls them in separate evaluates
  // so each stays under ~15 s of wall time; a console call runs everything.
  function selfTest(opts) {
    opts = opts || {};
    const all = ["config", "sprites", "terrain", "caches", "flow", "fight", "fixtures", "flipflop", "ai", "replay", "match"];
    const parts = opts.parts ? (Array.isArray(opts.parts) ? opts.parts : String(opts.parts).split(",")) : all, has = (p) => parts.indexOf(p) >= 0;
    const horizon = clamp(+opts.matchSeconds || (S.cfg ? S.cfg.world.matchSeconds : 240), 10, 600);
    const w0 = performance.now(), results = {}, fails = [], ms = {};
    const check = (name, ok, detail) => { results[name] = { pass: !!ok, detail }; if (!ok) fails.push(name); };
    const timed = (p, fn) => { const t = performance.now(); try { fn(); } catch (e) { check(p + "_threw", false, { error: String(e && e.stack || e) }); } ms[p] = Math.round(performance.now() - t); };
    const ls0 = lsSnapshot(), sig0 = stateSig(), refs0 = [S.agents, S.teams, S.map, S.cam, S.input, S.spr, S.stats, particles, floaters];
    let f = null, mt = null;
    if (has("config")) timed("config", () => {
      check("config_loaded", !!S.cfg && typeof S.cfg === "object", { sections: S.cfg ? Object.keys(S.cfg) : [] });
      const cr = configReport(); check("config_keys", cr.missing.length === 0, cr);
      const ur = unitsReport(); check("config_units", ur.bad.length === 0 && ur.checked > 0, ur);
    });
    if (has("sprites")) timed("sprites", () => { const sp = spriteReport(); check("sprites_opaque", sp.total > 0 && sp.blank.length === 0, sp); });
    if (has("terrain")) timed("terrain", () => {
      const ts = terrainSuite(20);
      check("terrain_20_seeds", ts.bad.length === 0 && ts.fallbacks === 0 && ts.seeds.every((s) => s.rerolls <= S.cfg.terrain.maxRerolls), ts);
      check("terrain_fallback_forced", ts.forcedFallback.fallback && ts.forcedFallback.inList && ts.forcedFallback.pass, ts.forcedFallback);
    });
    if (has("caches") && S.map && !S.map.flat) timed("caches", () => {
      // the no-event path (M1 critic MAJOR-2): after the drop only the draw loop's probe runs; it must find a blank and re-arm the caches
      flushGround(S.map); const before = cacheReport(); const dropped = debugDropCaches(); const mid = cacheReport(); const probed = cacheProbe(0, 0, 0, 0, true); flushGround(S.map); const after = cacheReport();
      check("caches_drop_rebuild", before.ok && !mid.ok && probed && after.ok, { dropped, before: { chunks: before.chunks, ok: before.ok }, droppedBlank: mid.chunksBlank.length + mid.spritesBlank.length, probed, after });
    });
    if (has("flow")) timed("flow", () => {
      const w = flowWalkSuite(5); check("flow_walk_5_seeds", w.every((r) => !r.error && r.fails === 0 && !r.truncated), w);
      const k = knowledgeReplan(); check("knowledge_replan", k.pass, k);
    });
    if (has("fight")) timed("fight", () => {
      const mx = [[20, 20], [25, 20], [30, 20], [40, 20], [60, 40]].map(([n, m]) => fight(n, m, 25, 3)); f = mx[2];
      check("fight_30v20", !f.error && f.playerWins >= 2 && f.seconds <= 25 && new Set(f.runs.map((r) => r.seconds + ":" + r.playerLeft)).size > 1, f);
      check("fight_matrix", mx.every((r) => !r.error && r.runs.every((x) => !x.truncated)), mx.map((r) => ({ nm: r.n + "v" + r.m, winner: r.winner, wins: r.playerWins + "/" + r.runs.length, seconds: r.seconds, left: r.playerLeft + " v " + r.rivalLeft, flipped: r.flipped, fled: r.fled, runs: r.runs })));
      const cv = clashVerdictTest(427, 227); check("clash_427v227_opens_winning", cv.verdict === "WINNING" && cv.later && cv.later.verdict === "WINNING", cv);
    });
    if (has("fixtures")) timed("fixtures", () => {
      const a = fixture("pass64"), b = fixture("pass128"), c = fixture("ambush"), FX = S.cfg.fixtures;
      c.spec = [fixture("ambush", { wait: FX.ambushSpecWait }), fixture("ambush", { wait: FX.ambushSpecWait, blob: true })].map((r) => ({ variant: r.variant, waiting: r.waiting, loser: r.loser, t: r.rout && r.rout.t, flipped: r.headFlipped, fled: r.fled, columnAfter: r.columnAfter }));
      check("fixture_pass64", a.through != null && a.through <= 8 && a.regroup >= 0.9 && !a.terrainBad && !a.truncated, a);
      check("fixture_pass128", b.through != null && b.through <= 6 && b.regroup >= 0.9 && !b.terrainBad && !b.truncated, b);
      check("fixture_ambush_head_only", c.pass && !c.terrainBad, c);
    });
    if (has("flipflop")) timed("flipflop", () => {
      const r = fixture("flipflop"), base = fixture("flipflop", { noHyst: true });
      check("fixture_flipflop", S.cfg.input.desktopMode !== "route" || (r.pass && !r.terrainBad), { route: r, noHysteresis: base, desktopMode: S.cfg.input.desktopMode });
    });
    if (has("ai")) timed("ai", () => {
      const runs = [0, 1, 2].map((k) => simMatch(60, { seed: 5150 + k * 7919, wallMs: 4000 }));
      check("ai_leave_home_40s", runs.every((r) => !r.truncated && r.leftHome.every((t) => t >= 0 && t <= 40)), runs.map((r) => ({ seed: r.seed, names: r.names, leftHome: r.leftHome, atCentre: r.atCentre, counts: r.timeline[r.timeline.length - 1].counts, ev: r.ev, truncated: r.truncated, wallMs: r.wallMs })));
    });
    if (has("replay")) timed("replay", () => { const r = replay(424242, 60); check("replay_60s", r.same, r); });
    if (has("match")) timed("match", () => {
      mt = simMatch(horizon, { wallMs: opts.wallMs || 9000 });
      check("simMatch_no_exceptions", mt.exceptions.length === 0, mt); // a wall-guard truncation is reported (detail.truncated), not failed: a slow machine isn't a bug
      check("simMatch_agent_cap", mt.capOver === 0 && mt.maxTotal <= mt.agentCap, { maxTotal: mt.maxTotal, agentCap: mt.agentCap, capOver: mt.capOver });
      check("no_agent_in_rock", mt.terrainBad === 0 && mt.seconds >= Math.min(60, horizon) - 0.5, { terrainBad: mt.terrainBad, firstBad: mt.firstBad, seconds: mt.seconds });
    });
    const refs1 = [S.agents, S.teams, S.map, S.cam, S.input, S.spr, S.stats, particles, floaters];
    check("state_restored", stateSig() === sig0 && refs0.every((r, i) => r === refs1[i]) && PS.terrain.map === S.map, { mode: S.mode, t: S.t, agents: S.agents.length });
    check("localStorage_unchanged", lsSnapshot() === ls0, {});
    const n = Object.keys(results).length, total = Math.round(performance.now() - w0), pass = fails.length === 0;
    (pass ? console.log : console.warn)("[PS.selfTest] " + (pass ? "PASS " : "FAIL ") + (n - fails.length) + "/" + n + (pass ? "" : " fails: " + fails.join(", ")) + " | parts " + parts.join(",") +
      (f ? " | 30v20 " + (f.winner || "?") + " in " + f.seconds + "s" : "") + (mt ? " | simMatch " + mt.seconds + "s " + (mt.truncated ? "TRUNCATED by wall guard" : mt.end) + ", peak " + mt.maxTotal + "/" + mt.agentCap : "") + " | " + total + " ms");
    return { pass, fails, results, ms: total, partMs: ms };
  }

  boot();
})();
