// Peasant Swarm — core simulation + render. Click it! Studios, 2026.
// Boids swarm routed by per-team flow fields (src/flow.js) on seeded terrain (src/terrain.js), local combat with a local rout and a
// fleeing remnant, AI rivals that play under the same fog of war as you (src/fog.js), power-ups. All tuning in config.json.
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
  const NOFOG = QS.get("nofog") === "1"; // ?nofog=1 renders everything (v1-style gating) while the fog data model keeps running

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
    route: { on: false, x: 0, y: 0, chase: 0, src: "", sx: 0, sy: 0 }, routeT: -1e9 }); // routeT: wall time of the last tap / click / minimap route (hint spacing)
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
    drawList: [], decals: [], trails: [], attract: false, difficulty: "normal",
    ev: mkEv(), lastRout: null, thinkRR: 0, flowW: null, fixture: null,
    fogW: null, fogS: null, fogOn: false, frameId: 0, lastDrawT: 0, lastDrawSim: 0, // fog world (src/fog.js), per-world fog presentation state, fog render flag
  };
  if (S.debug) window.PSS = S;

  const canvas = $("game"), ctx = canvas.getContext("2d");
  const mini = $("minimap"), mctx = mini.getContext("2d");
  let particles, floaters, smokeP, sandbox = false; // sandbox: PS.fight / PS.simMatch are running a throwaway world, so DOM side effects are skipped
  let liveFlow = null, sbFlow = null; // flow-field worlds (src/flow.js): one for the live game, one reused by every sandbox
  let liveFog = null, sbFog = null; // fog worlds (src/fog.js), same split

  // ---------------------------------------------------------------- setup
  async function boot() {
    const res = await fetch("config.json?v=22");
    S.cfg = await res.json();
    S.spr = PS.buildSprites(S.cfg);
    PS.terrain.init(S.cfg); PS.flow.init(S.cfg); PS.fog.init(S.cfg);
    liveFlow = PS.flow.world(); sbFlow = PS.flow.world(); liveFog = PS.fog.world(); sbFog = PS.fog.world();
    hashAlloc();
    particles = PS.Particles(1400);
    smokeP = PS.Particles(320); // drawn above the fog: campfire smoke and crows (SPEC-v2 §5 tells)
    floaters = PS.Floaters();
    PS.vis = VIS; PS.ai = AIQ;
    PS.selfTest = selfTest; PS.fight = fight; PS.simMatch = simMatch; PS.bench = bench; PS.replay = replay; // QA hooks, always on and side-effect free (see QA section)
    PS.debugDropCaches = debugDropCaches; PS.cacheReport = cacheReport; PS.recheckCaches = recheckCaches; PS.cacheProbe = cacheProbe;
    PS.fixture = fixture; PS.clashRead = clashRead; PS.fogMatch = fogMatch;
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
      PS.step = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (S.mode !== "play") break; update(DT); if (S.mode !== "play") break; particles.update(DT); smokeP.update(DT); floaters.update(DT); } updateHUD(true); return S.result || S.mode; };
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
    PS.fog.resize(S.vw, S.vh); // one quarter-CSS fog canvas, reused: it also carries the vignette and the losing-clash glow (SPEC-v2 §5)
  }

  // ---------------------------------------------------------------- world gen
  // every field an agent will ever carry is set here, v2 placeholders included (C2: agents that grow fields later ran 6x slower)
  function mkAgent(x, y, team) {
    const R = S.rng;
    // the neighbour loop reads x, y, team, dead and escapeT of hundreds of agents per agent: keep them first (one cache line)
    return { x, y, team, dead: false, escapeT: 0, vx: 0, vy: 0, hp: S.cfg.agent.hp, atk: R() * 0.5, tgt: null,
      ph: R() * 10, face: R() < 0.5 ? 1 : -1, fl: 0, lunge: 0, wx: x, wy: y, hx: x, hy: y, fight: false, r: S.cfg.agent.radius, pop: 9, camp: null,
      rec: 0, seenA: 0, seenT: -1e9, drawnF: 0, ex: 0, ey: 0, groupId: 0, rd: 0, fieldT: 0, fdx: 0, fdy: 0, fok: 0 };
  }
  const z9 = () => [0, 0, 0, 0, 0, 0, 0, 0, 0]; // team-indexed arrays: neutral 0, player 1, rivals 2-6, spare 7, bandits 8 (SPEC-v2 §6)
  // route: the team steers by its flow field (else direct seek); mode (player): "route" | "steer" | "hold"; hyst: route hysteresis applies;
  // ax/ay: the anchor (centroid snapped to walkable, for AI and labels); tMed: last tick's median path distance (path cohesion).
  // AI under fog: preyId (the team it hunts, 0 none), exX/exY/exUntil (an explore target and its commit time).
  // Per enemy slot j: eng (agents fighting j this tick) with fX/fY (their position sums), engT (engaged time), engL (smoothed local
  // strength), engPk (its peak this engagement), engHold (time under breakRatio), engCx/engCy (contact centroid), engStart (count at start),
  // engG / engGPk (fighting mode: the rout group's survivors and their peak this engagement)
  function mkTeam(id, name, color, isPlayer, ai) {
    return { id, name, color, isPlayer, ai, count: 0, cx: 0, cy: 0, ax: 0, ay: 0, tx: 0, ty: 0, vx: 0, vy: 0, pcx: 0, pcy: 0, spd: 0, slot: -1, alive: true,
      route: true, mode: "route", hyst: false, tMed: 0,
      buffs: { speed: 0, armor: 0, frenzy: 0, rally: 0 }, eng: z9(), engT: z9(), engStart: z9(), engL: z9(), engPk: z9(), engHold: z9(), engCx: z9(), engCy: z9(), fX: z9(), fY: z9(),
      engG: z9(), engGPk: z9(),
      spr: S.spr.peasantSet(color), kills: 0, peak: 1, state: "roam", speedMod: 1, thinkT: S.rng() * 0.5, lastHint: 0, minY: 0, huntStart: 0, huntCooldown: 0,
      regroupUntil: 0, fleeFrom: 0, leftHome: -1, atCentre: -1, preyId: 0, exX: 0, exY: 0, exUntil: -1, escUntil: -1, escFrom: 0, escReplanAt: 0, escGX: 0, escGY: 0 };
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
    const camp = { x, y, n: 0, smokeT: S.rng() * 0.8, kn: new Int16Array(9).fill(-1) }; // kn[team]: the head-count that team last saw here (-1 never)
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
    S.flowW = PS.flow.use(PS.flow.reset(sandbox ? sbFlow : liveFlow, m)); // fields are per world
    S.flowW.know.fill(0); // the player starts knowing nothing: explored cells teach its field (fog stamps call PS.flow.learn)
    S.fogW = PS.fog.use(PS.fog.reset(sandbox ? sbFog : liveFog, m, { learn: true })); S.fogS = mkFogS(); S.fogOn = !attract;
    S.cap = opts.cap || capFor();
    S.agents.length = 0; S.obstacles.length = 0; S.powerups.length = 0; S.camps.length = 0; S.banners.length = 0; S.decals.length = 0; S.trails.length = 0;
    S.t = 0; S.tick = 0; S.acc = 0; S.timeLeft = cfg.world.matchSeconds; S.trickleT = 0; S.shake = 0; S.result = null; S.engagedNow = false; S.finalCalled = false; S.pendingEnd = null; S._routedBy = null; S.lastDrawSim = 0;
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
    fogStampAll(); // every team sees its start before the first frame
    S.cam.x = S.teams[1].cx; S.cam.y = S.teams[1].cy; S.camS = mkCamS(); zoomRule(S.teams[1].count, 0, true);
    S.teams[1].tx = S.teams[1].cx; S.teams[1].ty = S.teams[1].cy;
    if (!sandbox) { groundInvalidate(m); minimapBake(true); }
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
    return { x, y, kind: pickKind(), alive: true, t: 0, sx: 0, sy: 0, skind: "", salive: false, sseen: false }; // s*: the player's last-seen state
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
    BNs = PS.fog.BN; BKs = PS.fog.BK; BB = BNs * BNs; FBS = new Int32Array(9 * BB); FBL = new Int16Array(9 * BB); // fog sources: occupied 64 px buckets per team
  }
  const NEAR = new Array(6000); let nearN = 0;
  const REC = new Array(4096); let recN = 0; // neutrals recruited this tick (converted after the steering pass)
  // the same pass gathers each team's occupied 64 px buckets (fog sources) into preallocated lists: FBL[team * BB + k], FBN[team] of them
  let BNs = 0, BKs = 64, BB = 0, FBS = null, FBL = null; const FBN = new Int32Array(9);
  function rebuildGrid() {
    const ag = S.agents, n = ag.length, bn1 = BNs - 1;
    if (hNext.length < n) hNext = new Int32Array(Math.max(n, S.cap) + 256); // grows once per session at most, never per frame
    hTick++; FBN.fill(0);
    for (let i = 0; i < n; i++) {
      const a = ag[i]; let cx = (a.x / HC) | 0, cy = (a.y / HC) | 0;
      if (cx < 0) cx = 0; else if (cx >= hCols) cx = hCols - 1; if (cy < 0) cy = 0; else if (cy >= hRows) cy = hRows - 1;
      const c = cy * hCols + cx; if (hStamp[c] !== hTick) { hStamp[c] = hTick; hHead[c] = -1; }
      hNext[i] = hHead[c]; hHead[c] = i;
      const tm = a.team; if (tm === 0) continue;
      let bx = (a.x / BKs) | 0, by = (a.y / BKs) | 0; if (bx < 0) bx = 0; else if (bx > bn1) bx = bn1; if (by < 0) by = 0; else if (by > bn1) by = bn1;
      const b = by * BNs + bx, k = tm * BB + b; if (FBS[k] !== hTick) { FBS[k] = hTick; FBL[tm * BB + FBN[tm]++] = b; }
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


  // ---------------------------------------------------------------- fog of war (SPEC-v2 §5): stamps, sight records, memory, tells
  // Every team stamps its sight into its own grids (src/fog.js) from update(): the player every fog.playerStampTicks ticks, AI teams one per
  // tick in turn. After each stamp, observe() records what that team now sees of every other swarm (obs: visible agents, their centroid,
  // a velocity smoothed from successive sightings, the public live count) and, when a swarm leaves its sight, writes mem (the ghost AI
  // hunts read and the player's "~N" marker). Camps keep the head-count each team last saw (kn), power-ups the player's last-seen state.
  // AI decisions read obs, mem, kn and campfire smoke only (aiThink); PS.ai.assertKnowledge counts every targeted swarm and camp.
  const mkRec = () => ({ seen: false, ever: false, n: 0, nEsc: 0, x: 0, y: 0, vx: 0, vy: 0, minY: 0, count: 0, t: -1e9 }); // nEsc: seen agents in their escape window
  function mkFogS() {
    const obs = [], mem = [], ghosts = [], dust = [], verdict = [], pings = [];
    for (let o = 0; o < 9; o++) { obs.push([]); mem.push([]); for (let r = 0; r < 9; r++) { obs[o].push(mkRec()); mem[o].push(mkRec()); } ghosts.push({ on: false, x: 0, y: 0, n: 0, t0: -1e9 }); dust.push({ on: false, x: 0, y: 0, t: -1e9 }); verdict.push({ t0: -1e9, kind: 0 }); }
    for (let i = 0; i < 8; i++) pings.push({ on: false, x: 0, y: 0, t0: -1e9, t1: -1e9, rumbleT: -1e9, rout: false });
    return { obs, mem, ghosts, dust, verdict, pings, rr: 0, dustT: 0, dawnT0: -1, reveal: false, leakOn: false, simMs: 0, simTotal: 0, simTicks: 0, simMax: 0,
      danger: { on: false, ang: 0, t0: -1e9, last: -1e9, team: 0 },
      stats: { firstSight: -1, sightings: 0, ghosts: 0, dangerCues: 0, pings: 0, routPings: 0, rumbles: 0, dust: 0, verdicts: 0, crows: 0 },
      leak: { frames: 0, rivalsDrawn: 0, rivalsVisible: 0, fading: 0, hidden: 0, missed: 0, neutralsHidden: 0, tagHidden: 0, ringHidden: 0, arrowHidden: 0, miniHidden: 0, last: null },
      ai: { decisions: 0, swarm: 0, camps: 0, explore: 0, violations: 0, first: null } };
  }
  // the player's presentation is fogged: a real match (or a fog test scene), not ?nofog=1, not a bench "reveal", before dawn
  const fogGate = () => S.fogOn && !NOFOG && !!S.fogS && !S.fogS.reveal && S.fogS.dawnT0 < 0;
  const tellsOn = () => fogGate() && !S.attract;
  // playerSees: the one gate for everything that could give a rival away (v1's onScreen() gates, SPEC-v2 §5 leak audit); fxOk adds the
  // screen test v1 used for particles and sounds. With the fog off (title, fixtures, ?nofog=1, dawn) it falls back to v1's behaviour.
  function playerSees(x, y) { return !fogGate() || PS.fog.sees(1, x, y); }
  function fxOk(x, y) { return onScreen(x, y) && playerSees(x, y); }
  const sightR = (t) => S.cfg.fog.sight0 + S.cfg.fog.sightK * Math.sqrt(Math.max(1, t.count));

  const OC = new Int32Array(9), OE = new Int32Array(9), OX = new Float64Array(9), OY = new Float64Array(9), OMY = new Float64Array(9);
  function observe(o) {
    const FS = S.fogS, V = PS.fog.vis(o), v = PS.fog.verOf(o), nT = S.teams.length, NC = PS.fog.N, cell = S.map.cell, lim = NC * cell;
    for (let r = 0; r < 9; r++) { OC[r] = 0; OE[r] = 0; OX[r] = 0; OY[r] = 0; OMY[r] = 1e9; }
    for (let i = 0; i < S.agents.length; i++) {
      const a = S.agents[i], tm = a.team; if (tm === 0 || tm === o || a.dead) continue;
      const x = a.x, y = a.y; if (!(x >= 0 && y >= 0 && x < lim && y < lim) || V[((y / cell) | 0) * NC + ((x / cell) | 0)] !== v) continue;
      OC[tm]++; OX[tm] += x; OY[tm] += y; if (y < OMY[tm]) OMY[tm] = y; if (a.escapeT > 0) OE[tm]++;
    }
    const ks = S.cfg.fog.obsSmooth, vmax = 2 * S.cfg.agent.speed;
    for (let r = 1; r < nT; r++) {
      if (r === o) continue; const ob = FS.obs[o][r];
      if (OC[r] > 0) {
        const x = OX[r] / OC[r], y = OY[r] / OC[r];
        if (ob.seen) { const dt = S.t - ob.t; if (dt > 1e-6) { let vx = (x - ob.x) / dt, vy = (y - ob.y) / dt; const l = Math.sqrt(vx * vx + vy * vy), k = 1 - Math.exp(-dt / ks); if (l > vmax) { vx *= vmax / l; vy *= vmax / l; } ob.vx += (vx - ob.vx) * k; ob.vy += (vy - ob.vy) * k; } }
        else { ob.vx = 0; ob.vy = 0; if (o === 1) FS.ghosts[r].on = false; } // back in sight: the player's ghost goes
        ob.x = x; ob.y = y; ob.minY = OMY[r]; ob.n = OC[r]; ob.nEsc = OE[r]; ob.count = S.teams[r].count; ob.t = S.t; ob.seen = true;
        if (!ob.ever) { ob.ever = true; if (o === 1) firstSight(r); }
      } else if (ob.seen) {
        const m = FS.mem[o][r]; ob.seen = false; m.ever = true; m.x = ob.x; m.y = ob.y; m.vx = ob.vx; m.vy = ob.vy; m.n = ob.n; m.nEsc = ob.nEsc; m.count = ob.count; m.minY = ob.minY; m.t = S.t; ob.n = 0; ob.nEsc = 0;
        if (o === 1) { const g = FS.ghosts[r]; g.on = true; g.x = m.x; g.y = m.y; g.n = m.n; g.t0 = S.t; FS.stats.ghosts++; }
      }
    }
    // camps: the head-count this team last saw at each camp in its sight (a camp seen empty is known empty)
    for (const c of S.camps) if (PS.fog.seesCell(o, PS.fog.cellOf(c.x, c.y))) c.kn[o] = c.n;
    // the player's last-seen power-ups: a ghost stays where one was seen until that spot is seen again
    if (o === 1) for (const p of S.powerups) {
      if (PS.fog.sees(1, p.x, p.y)) { p.sx = p.x; p.sy = p.y; p.skind = p.kind; p.salive = p.alive; p.sseen = true; }
      else if (p.sseen && PS.fog.sees(1, p.sx, p.sy)) p.salive = false;
    }
  }
  // first sight of rival r: the pip flips from "?" to a count and a verdict mark (count x power, stronger / even / weaker) shows on it
  function firstSight(r) {
    const FS = S.fogS, FG = S.cfg.fog, pl = S.teams[1], t = S.teams[r], ratio = (t.count * teamPower(t)) / Math.max(1, pl.count * teamPower(pl));
    FS.stats.sightings++; if (FS.stats.firstSight < 0) FS.stats.firstSight = +S.t.toFixed(2);
    const v = FS.verdict[r]; v.t0 = S.t; v.kind = ratio > FG.verdictStronger ? 1 : ratio < FG.verdictWeaker ? -1 : 0; FS.stats.verdicts++;
  }
  function fogStamp(i) {
    const t = S.teams[i]; if (!t || !t.alive || t.count === 0) return;
    PS.fog.stamp(i, t.cx, t.cy, sightR(t), FBL, i * BB, FBN[i], S.cfg.fog.bucketSight, PS.knowledge);
    observe(i);
  }
  // one update() step: the player every fog.playerStampTicks ticks, one AI team per tick in turn (SPEC-v2 §5); counts sim-side fog ms
  function fogTick() {
    const t0 = performance.now(), FS = S.fogS, nT = S.teams.length, nA = Math.max(1, nT - 2);
    if (S.tick % S.cfg.fog.playerStampTicks === 0) fogStamp(1);
    for (let k = 0; k < nA; k++) { const i = 2 + ((FS.rr + k) % nA), t = S.teams[i]; if (!t || !t.alive || t.count === 0) continue; fogStamp(i); FS.rr = (i - 1) % nA; break; }
    const ms = performance.now() - t0; FS.simMs += ms; FS.simTotal += ms; FS.simTicks++; if (ms > FS.simMax) FS.simMax = ms;
  }
  function fogStampAll() { rebuildGrid(); for (let i = 1; i < S.teams.length; i++) fogStamp(i); }

  // Tells through the dark (SPEC-v2 §5). A clash you cannot see within fog.clashNoise px: a ping (edge pitchfork, minimap ring) that lives
  // fog.pingSeconds past its last refresh, and a panned distant rumble every fog.pingSeconds while it lasts (the one deliberate off-screen
  // sound); a hidden rout folds into its clash's ping with the ping tone. Presentation only: Math.random is fine here, S.rng never.
  function clashPing(x, y, rout) {
    const FS = S.fogS, FG = S.cfg.fog, pl = S.teams[1]; if (!tellsOn() || !pl || pl.count === 0) return;
    const dx = x - pl.cx, dy = y - pl.cy, d2 = dx * dx + dy * dy, m2 = FG.pingMerge * FG.pingMerge; if (d2 > FG.clashNoise * FG.clashNoise) return;
    let p = null; for (const q of FS.pings) if (q.on && (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y) < m2) { p = q; break; }
    if (!p) { p = FS.pings[0]; for (const q of FS.pings) { if (!q.on) { p = q; break; } if (q.t1 < p.t1) p = q; } p.on = true; p.x = x; p.y = y; p.t0 = S.t; p.rumbleT = -1e9; p.rout = false; FS.stats.pings++; }
    p.t1 = S.t + FG.pingSeconds;
    if (S.t - p.rumbleT >= FG.pingSeconds) { p.rumbleT = S.t; FS.stats.rumbles++; PS.audio.rumble(clamp(((x - S.cam.x) * S.cam.zoom) / Math.max(1, S.vw / 2), -1, 1), 1 - (0.6 * Math.sqrt(d2)) / FG.clashNoise); }
    if (rout) { p.rout = true; FS.stats.routPings++; PS.audio.ping(); }
  }
  // crows flush above the fog (M4's lurking Sly uses this): a small dark burst in the above-fog particle pool
  function crows(x, y) { smokeP.burst(x, y - 16, "#1E1A16", S.cfg.fog.crows, 70, 1.3, 3, -60); S.fogS.stats.crows++; }
  // per tick, after the engagements: ping and ghost expiry; the danger cue (an unseen rival hunting you within fog.danger px: low horn and
  // a red edge chevron within fog.dangerJitter degrees of its bearing, at most every fog.dangerEvery s); dust from unseen swarms of
  // fog.dustMin+ within fog.dust px, re-rolled every fog.dustEvery s up to fog.dustOffset px off their anchor (a smudge, never a count)
  function tellsTick() {
    const FS = S.fogS, FG = S.cfg.fog, pl = S.teams[1];
    for (const p of FS.pings) if (p.on && S.t > p.t1) { p.on = false; p.rout = false; }
    for (let r = 2; r < 9; r++) { const g = FS.ghosts[r]; if (g.on && S.t - g.t0 > FG.ghostSeconds) g.on = false; }
    const D = FS.danger; if (D.on && S.t - D.t0 > FG.dangerShow) D.on = false;
    if (!tellsOn() || !pl || pl.count === 0) return;
    if (S.t - D.last >= FG.dangerEvery) for (let r = 2; r < S.teams.length; r++) {
      const t = S.teams[r]; if (!t.alive || t.count === 0 || t.state !== "hunt" || t.preyId !== 1 || FS.obs[1][r].seen) continue;
      const dx = t.ax - pl.ax, dy = t.ay - pl.ay; if (dx * dx + dy * dy > FG.danger * FG.danger) continue;
      D.on = true; D.t0 = D.last = S.t; D.team = r; D.ang = Math.atan2(dy, dx) + (Math.random() * 2 - 1) * FG.dangerJitter * Math.PI / 180; FS.stats.dangerCues++; PS.audio.dangerHorn(); break;
    }
    if (S.t >= FS.dustT) {
      FS.dustT = S.t + FG.dustEvery;
      for (let r = 2; r < S.teams.length; r++) {
        const t = S.teams[r], d = FS.dust[r]; d.on = false; if (!t.alive || t.count < FG.dustMin || FS.obs[1][r].seen) continue;
        const dx = t.ax - pl.ax, dy = t.ay - pl.ay; if (dx * dx + dy * dy > FG.dust * FG.dust) continue;
        const a = Math.random() * Math.PI * 2, o = Math.random() * FG.dustOffset; d.on = true; d.x = t.ax + Math.cos(a) * o; d.y = t.ay + Math.sin(a) * o; d.t = S.t; FS.stats.dust++;
      }
    }
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
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && t.escUntil > S.t && S.t >= t.escReplanAt) { planEscape(t); break; } } // one remnant re-plan per tick

    rebuildGrid();
    fogTick(); // sight stamps from this tick's buckets (SPEC-v2 §5): the player every 3rd tick, one AI team per tick

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
      if (a.pop < 0.35) { const was = a.pop; a.pop += dt; if (was < 0 && a.pop >= 0 && fxOk(a.x, a.y)) { const tc = S.teams[a.team]; if (tc) { particles.burst(a.x, a.y - 8, tc.color, 6, 80, 0.45, 3, 200); particles.ring(a.x, a.y - 8, tc.color, 4, 18, 0.3); } } }
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
          // escape window: run at remnant.escapeSpeed along the team's escape field to its flee target (away from the winner); without one,
          // never back toward the rout's contact point
          if (team.escUntil > S.t && FL.sampleEscape(a.team, a.x, a.y, SMP) && SMP.t > 8) { ux = SMP.x; uy = SMP.y; }
          else { const ex = a.x - a.ex, ey = a.y - a.ey, el = Math.sqrt(ex * ex + ey * ey) || 1; if (ux * ex + uy * ey <= 0) { ux = ex / el; uy = ey / el; } }
          sp = (speed / (team.speedMod || 1)) * esc; vcap = sp; // escapeSpeed x the team's base pace: an AI's flee / hunt pace does not stack on it
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
              if (fxOk(best.x, best.y)) { particles.burst(best.x, best.y - 6, "#FFFFFF", 2, 60, 0.25, 2, 200); PS.audio.hit(); }
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

    // camp head-counts (for "+N" labels) and campfire smoke, which rises above the fog (smokeP is drawn after it) from camps within
    // fog.smoke px of your swarm: a tell of recruits in the dark (SPEC-v2 §5); with the fog off, v1's on-screen smoke
    for (const c of S.camps) c.n = 0;
    for (const a of S.agents) if (a.team === 0 && !a.dead && a.camp) a.camp.n++;
    const smR = cfg.fog.smoke, gS = fogGate();
    for (const c of S.camps) {
      if (c.n === 0 || !onScreen(c.x, c.y) || (gS && (c.x - player.cx) * (c.x - player.cx) + (c.y - player.cy) * (c.y - player.cy) > smR * smR)) continue;
      c.smokeT -= dt; if (c.smokeT <= 0) { c.smokeT = 0.5 + Math.random() * 0.5; smokeP.smoke(c.x + (Math.random() - 0.5) * 3, c.y - 6); }
    }

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

    // engagements and local rout (SPEC-v2 §6). Per engaged pair the contact centroid is the mean of both sides' fighting agents.
    // combat.localMode "fighting" (M2 critic MAJOR-1): L is each side's agents fighting the other this tick (so a column queued in a pass does
    // not count, only its frontage), smoothed over moraleSmoothing; morale is the rout group's survivors (the flood fill a rout would take)
    // against that group's peak this engagement. "radius" (M2): L is each side's agents within combat.localRadius of the contact, and morale
    // is L against its peak. A side breaks after the engageDelay brace when L stays under breakRatio x the other's for breakHold, or its
    // morale falls under moraleBreak and 0.02 under the other's. Whole-team totals never enter the test. (The hash is still this tick's.)
    // The group is measured every tick for both sides by groupCells() (the rout's flood at hash-cell resolution).
    S.engagedNow = false;
    const ks = 1 - Math.exp(-dt / CB.moraleSmoothing), nT = S.teams.length, fightMode = CB.localMode !== "radius";
    for (let i = 1; i < nT; i++) {
      const ta = S.teams[i]; if (!ta.alive) continue;
      for (let j = i + 1; j < nT; j++) {
        const tb = S.teams[j]; if (!tb.alive) continue;
        if (ta.eng[j] > 0 && tb.eng[i] > 0) {
          const nf = ta.eng[j] + tb.eng[i], cx = (ta.fX[j] + tb.fX[i]) / nf, cy = (ta.fY[j] + tb.fY[i]) / nf;
          if (fightMode) { LCA = ta.eng[j]; LCB = tb.eng[i]; } else localCount(cx, cy, CB.localRadius, i, j);
          if (ta.engT[j] === 0) {
            ta.engStart[j] = ta.count; tb.engStart[i] = tb.count; ta.engL[j] = LCA; tb.engL[i] = LCB; ta.engPk[j] = tb.engPk[i] = 0; ta.engHold[j] = tb.engHold[i] = 0; S.ev.fights++; if (ta.isPlayer || tb.isPlayer) S.stats.fights++;
            ta.engGPk[j] = tb.engGPk[i] = 0;
          }
          else { ta.engL[j] += (LCA - ta.engL[j]) * ks; tb.engL[i] += (LCB - tb.engL[i]) * ks; }
          if (fightMode) { const gA = groupCells(ta.id, cx, cy), gB = groupCells(tb.id, cx, cy); ta.engG[j] = gA; tb.engG[i] = gB; if (gA > ta.engGPk[j]) ta.engGPk[j] = gA; if (gB > tb.engGPk[i]) tb.engGPk[i] = gB; }
          ta.engT[j] += dt; tb.engT[i] = ta.engT[j]; ta.engCx[j] = tb.engCx[i] = cx; ta.engCy[j] = tb.engCy[i] = cy;
          if (!ta.isPlayer && !tb.isPlayer && S.fogOn && !PS.fog.sees(1, cx, cy)) clashPing(cx, cy, false); // clash noise through the dark
          const La = ta.engL[j], Lb = tb.engL[i]; if (La > ta.engPk[j]) ta.engPk[j] = La; if (Lb > tb.engPk[i]) tb.engPk[i] = Lb;
          if (ta.isPlayer || tb.isPlayer) S.engagedNow = true;
          if (ta.engT[j] >= CB.engageDelay) {
            ta.engHold[j] = La < CB.breakRatio * Lb ? ta.engHold[j] + dt : 0; tb.engHold[i] = Lb < CB.breakRatio * La ? tb.engHold[i] + dt : 0;
            const mA = fightMode ? ta.engG[j] / Math.max(1, ta.engGPk[j]) : La / Math.max(1, ta.engPk[j]), mB = fightMode ? tb.engG[i] / Math.max(1, tb.engGPk[i]) : Lb / Math.max(1, tb.engPk[i]);
            const nA = fightMode ? ta.engG[j] : LCA, nB = fightMode ? tb.engG[i] : LCB;
            const aBreak = nA >= CB.minRoutSize && (ta.engHold[j] >= CB.breakHold || (mA < CB.moraleBreak && mA < mB - 0.02));
            const bBreak = nB >= CB.minRoutSize && (tb.engHold[i] >= CB.breakHold || (mB < CB.moraleBreak && mB < mA - 0.02));
            if (aBreak && (!bBreak || mA <= mB)) rout(ta, tb, cx, cy, finalPhase); else if (bBreak) rout(tb, ta, cx, cy, finalPhase);
          }
        } else if (ta.engT[j] > 0) {
          ta.engT[j] = Math.max(0, ta.engT[j] - dt * CB.engageDecay); tb.engT[i] = ta.engT[j];
          if (ta.engT[j] === 0) { ta.engL[j] = tb.engL[i] = 0; ta.engPk[j] = tb.engPk[i] = 0; ta.engHold[j] = tb.engHold[i] = 0; ta.engG[j] = tb.engG[i] = 0; ta.engGPk[j] = tb.engGPk[i] = 0; }
        }
      }
    }

    // remove dead: swap-remove, no new array (after the engagement pass, which still reads this tick's hash by index)
    const ag = S.agents; for (let i = 0; i < ag.length;) { if (ag[i].dead) { ag[i] = ag[ag.length - 1]; ag.pop(); } else i++; }
    recount();

    // eliminations
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && t.count === 0) eliminate(t); }
    tellsTick();

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
      const ob = ri ? S.fogS.obs[1][ri] : null; if (ri && fogGate() && !ob.seen) ri = 0; // the clash camera uses only what you see of the rival
      if (ri) { const r = S.teams[ri], rx = fogGate() ? ob.x : r.ax, ry = fogGate() ? ob.y : r.ay, cx = C.clashOffsetCap * hw, cy = C.clashOffsetCap * hh; gx += clamp((rx - camT.cx) / 2, -cx, cx); gy += clamp((ry - camT.cy) / 2, -cy, cy); }
      else { const v = Math.sqrt(camT.vx * camT.vx + camT.vy * camT.vy); if (v >= C.lookAheadMinSpeed * camT.spd) { lx = clamp(camT.vx * C.lookAhead, -C.lookAheadCap * hw, C.lookAheadCap * hw); ly = clamp(camT.vy * C.lookAhead, -C.lookAheadCap * hh, C.lookAheadCap * hh); } }
      CS.lx += (lx - CS.lx) * cl; CS.ly += (ly - CS.ly) * cl;
      const k = S.attract ? 0.4 : 1; S.cam.x += (gx + CS.lx - S.cam.x) * cl * k; S.cam.y += (gy + CS.ly - S.cam.y) * cl * k;
    }
    if (S.shake > 0) S.shake -= dt;

    // banners: one at a time, queued
    if (S.banners.length) { S.banners[0].life -= dt; if (S.banners[0].life <= 0) S.banners.shift(); }
    if (S.hintT > 0) { S.hintT -= dt; if (S.hintT <= 0 || S.engagedNow || S.banners.length > 0) { S.hintT = 0; if (!sandbox) $("hint").classList.remove("show"); } }

    if (S.attract || S.fixture) return;
    // stats + hints
    if (player.count > S.stats.peak) S.stats.peak = player.count;
    if (S.stats.recruited === 0 && S.t > 25 && !S._hintRecruit) S._hintRecruit = showHint("Grey peasants are free recruits. Go touch them.", 3);
    if (player.count >= 8 && !S._hintFight) S._hintFight = showHint("Only fight rivals when you're bigger. Winners absorb the losers.", 5);
    if (player.count >= 20 && !S._hintHud) S._hintHud = showHint(S.input.touch ? "Hold HUDDLE to tighten the swarm before a clash" : "Hold SPACE to huddle up before a clash", 5);

    // win / lose
    if (player.count === 0 && !S.result) endGame(false, S._routedBy ? "Your swarm broke and joined " + S._routedBy + "." : "Every last peasant fell.");
    else if (!S.result) {
      let rivals = 0; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive) rivals++;
      if (rivals === 0) endGame(true, "Every rival mob is gone. The whole valley marches under your banner.");
      else if (S.timeLeft <= 0) {
        if (S.fogS.dawnT0 < 0) S.fogS.dawnT0 = S.t; // dawn: at the bell the fog lifts over fog.dawnSeconds before the result screen
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
    if (fxOk(a.x, a.y)) {
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
    if (fxOk(a.x, a.y)) { particles.burst(a.x, a.y - 6, t ? t.color : "#B8A88A", 10, 120, 0.6, 4, 260); particles.burst(a.x, a.y - 6, "#F1C27D", 4, 90, 0.5, 3, 260); particles.ring(a.x, a.y - 6, "#FFFFFF", 3, 14, 0.22); PS.audio.die(a.team === 1); }
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
  // a remnant's escape (M2 critic MAJOR-2): its fled agents route to the Dijkstra flee target away from the winner (camps and pass cells
  // maximising the winner's path distance minus the remnant's, fleeTarget), re-planned every remnant.escapeReplan s of the window from
  // where the loser sees (or last saw) the winner; the player's remnant too, whatever the cursor says
  const ESC = { ax: 0, ay: 0 };
  function planEscape(t) {
    const RM = S.cfg.combat.remnant, FS = S.fogS; t.escReplanAt = S.t + RM.escapeReplan;
    let n = 0, sx = 0, sy = 0; for (const a of S.agents) if (a.team === t.id && !a.dead && a.escapeT > 0) { n++; sx += a.x; sy += a.y; }
    if (!n) { t.escUntil = -1; return; }
    const w = S.teams[t.escFrom], ob = FS.obs[t.id][t.escFrom], mm = FS.mem[t.id][t.escFrom];
    if (!w || !w.alive || w.count === 0 || !(ob.seen || mm.ever)) return; // nothing to run from: keep the last escape
    const p = PS.terrain.snapXY(sx / n, sy / n); ESC.ax = p.x; ESC.ay = p.y; TH.ax = ob.seen ? ob.x : mm.x; TH.ay = ob.seen ? ob.y : mm.y;
    const me = PS.flow.buildFromMe(t.id, ESC.ax, ESC.ay, S.cfg.ai.sight * S.cfg.flow.fromMeCap), q = fleeTarget(ESC, TH, me, false, RM.escapeDistance); // no camp or pass gains: run remnant.escapeDistance straight away
    t.escGX = q.x; t.escGY = q.y; PS.flow.buildEscape(t.id, PS.flow.cellFor(q.x, q.y), t.isPlayer ? PS.knowledge : null, S.agents);
  }
  // local rout (SPEC-v2 §6): only the loser's engaged group breaks. Flood-fill from its fighting agents near the contact through same-team
  // neighbours within combat.routLink; of that group's survivors by distance to the contact: under remnant.minLoser all flip, else the
  // nearest flipShare flip (never one beyond remnant.flipRadius) and the rest run as a remnant (escape window, then REGROUP for AI).
  // After the horn every survivor flips, except that the crowned team (the biggest swarm stands in until M4) absorbs nothing while
  // finale.crownAbsorbs is false: those scatter as neutrals. Agents outside the group keep their colour.
  const RQ = []; let routStamp = 0;
  // the group a rout of team tid at (cx, cy) would take, into RQ[0..n): flood fill from its fighting agents within combat.localRadius of the
  // contact (any of its agents there if none fights) through same-team neighbours within combat.routLink, remnants excluded. Returns n.
  function floodGroup(tid, cx, cy) {
    const CB = S.cfg.combat, ag = S.agents, lr2 = CB.localRadius * CB.localRadius, link2 = CB.routLink * CB.routLink, stamp = ++routStamp; let n = 0;
    for (let pass = 0; pass < 2 && n === 0; pass++) for (const a of ag) {
      if (a.team !== tid || a.dead || a.escapeT > 0 || (pass === 0 && !a.fight)) continue;
      const dx = a.x - cx, dy = a.y - cy; if (dx * dx + dy * dy < lr2) { a.groupId = stamp; RQ[n++] = a; }
    }
    for (let h = 0; h < n; h++) {
      const a = RQ[h]; gather(a.x, a.y, CB.routLink);
      for (let k = 0; k < nearN; k++) { const b = NEAR[k]; if (b.team !== tid || b.dead || b.groupId === stamp || b.escapeT > 0) continue; const dx = b.x - a.x, dy = b.y - a.y; if (dx * dx + dy * dy < link2) { b.groupId = stamp; RQ[n++] = b; } }
    }
    return n;
  }
  // the morale group (fighting mode, M2 critic MAJOR-1): the rout's flood at hash-cell resolution. From every 48 px hash cell holding one of
  // team tid's fighting agents within combat.localRadius of the contact (any of its agents there if none fights), a flood over 8-neighbour
  // cells holding any of its agents (remnants excluded); returns how many it holds. About 1.5k list steps where the per-agent 40 px flood
  // takes about 25k, so every engaged side is measured every tick.
  let GV = null, GQ = null, gvT = 0;
  function groupCells(tid, cx, cy) {
    const ag = S.agents, lr = S.cfg.combat.localRadius, lr2 = lr * lr, NC = hCols * hRows;
    if (!GV || GV.length !== NC) { GV = new Int32Array(NC); GQ = new Int32Array(NC); }
    gvT++; let qn = 0, total = 0;
    const i0 = Math.max(0, ((cx - lr) / HC) | 0), i1 = Math.min(hCols - 1, ((cx + lr) / HC) | 0), j0 = Math.max(0, ((cy - lr) / HC) | 0), j1 = Math.min(hRows - 1, ((cy + lr) / HC) | 0);
    for (let pass = 0; pass < 2 && qn === 0; pass++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * hCols + i; if (hStamp[c] !== hTick || GV[c] === gvT) continue; let seed = false, n = 0;
      for (let k = hHead[c]; k >= 0; k = hNext[k]) { const a = ag[k]; if (a.team !== tid || a.dead || a.escapeT > 0) continue; n++; if (!seed && (pass || a.fight)) { const dx = a.x - cx, dy = a.y - cy; if (dx * dx + dy * dy < lr2) seed = true; } }
      if (seed) { GV[c] = gvT; GQ[qn++] = c; total += n; }
    }
    for (let h = 0; h < qn; h++) {
      const c = GQ[h], ci = c % hCols, cj = (c / hCols) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= hCols || jj >= hRows) continue;
        const cc = jj * hCols + ii; if (GV[cc] === gvT || hStamp[cc] !== hTick) continue; GV[cc] = gvT;
        let n = 0; for (let k = hHead[cc]; k >= 0; k = hNext[k]) { const a = ag[k]; if (a.team === tid && !a.dead && !(a.escapeT > 0)) n++; }
        if (n) { GQ[qn++] = cc; total += n; }
      }
    }
    return total;
  }
  function rout(loser, winner, cx, cy, finalPhase) {
    const cfg = S.cfg, CB = cfg.combat, RM = CB.remnant;
    const loserBefore = loser.count, winnerBefore = winner.count, n = floodGroup(loser.id, cx, cy);
    for (let k = 0; k < n; k++) { const a = RQ[k], dx = a.x - cx, dy = a.y - cy; a.rd = Math.sqrt(dx * dx + dy * dy); }
    const group = RQ.slice(0, n).sort((p, q) => p.rd - q.rd); for (let k = 0; k < n; k++) RQ[k] = null; // a rare event: one small allocation is fine; stable sort keeps replays exact
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
    loser.engG[winner.id] = winner.engG[loser.id] = 0; loser.engGPk[winner.id] = winner.engGPk[loser.id] = 0;
    S.ev.routs++; if (fled) S.ev.remnants++; if (scattered) S.ev.scattered += scattered;
    if (fled) { loser.escUntil = S.t + RM.escapeSeconds; loser.escFrom = winner.id; planEscape(loser); } // the remnant runs from the winner (M2 critic MAJOR-2)
    if (fled && loser.ai) { loser.regroupUntil = S.t + RM.escapeSeconds + RM.regroupSeconds; loser.fleeFrom = winner.id; loser.thinkT = 0; }
    S.lastRout = { t: +S.t.toFixed(3), loser: loser.id, winner: winner.id, group: n, flipped, fled, scattered, outside: loserBefore - n, got: got.slice(), loserBefore, winnerBefore,
      cx: Math.round(cx), cy: Math.round(cy), farFlip: +farFlip.toFixed(1), minFlipX: minFlipX === Infinity ? null : Math.round(minFlipX) };
    if (winner.isPlayer) { S.stats.routs++; PS.audio.rout(true); banner(scattered && !got[1] ? "ROUTED: " + scattered + " SCATTER" : "+" + got[1] + " JOIN YOU" + (fled ? " · " + fled + " FLED" : ""), winner.color, 2.6); S.shake = 0.35; }
    else if (loser.isPlayer) { S._routedBy = winner.name; PS.audio.rout(false); S.shake = 0.5; if (flipped + scattered < loserBefore) banner(fled ? "SCATTERED: " + fled + " escaped" : "-" + (flipped + scattered) + " JOINED " + winner.name.toUpperCase(), "#FF7A6E", 2.4); }
    else if (playerSees(cx, cy)) { banner(loser.name.toUpperCase() + " routed by " + winner.name, winner.color, 2); if (fxOk(cx, cy)) PS.audio.rout(false); }
    else clashPing(cx, cy, true); // a rout you cannot see: no banner, it folds into the clash ping (SPEC-v2 §5)
    if (fxOk(cx, cy)) particles.ring(cx, cy, winner.color, 10, 120, 0.7);
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
      if (fxOk(p.x, p.y)) particles.ring(p.x, p.y, S.spr.PU.rally.color, 10, cfg.rallyRadius, 0.6);
      if (t.isPlayer) { floaters.add(p.x, p.y - 20, "RALLY! +" + n, S.spr.PU.rally.color, 18, 1.3); PS.audio.power("rally"); S.stats.powerups++; }
    } else {
      t.buffs[p.kind] = cfg.duration[p.kind];
      if (t.isPlayer) { floaters.add(p.x, p.y - 20, p.kind.toUpperCase() + "!", S.spr.PU[p.kind].color, 18, 1.1); PS.audio.power(p.kind); S.stats.powerups++; }
    }
    if (fxOk(p.x, p.y)) particles.burst(p.x, p.y, S.spr.PU[p.kind].color, 14, 110, 0.6, 2.5, 120);
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
      // a chase follows what you see of the rival (never its hidden anchor); out of sight it routes to where it was last seen, then holds
      if (r.chase) {
        const c = S.teams[r.chase], ob = S.fogS.obs[1][r.chase], mm = S.fogS.mem[1][r.chase], fog = fogGate();
        if (c && c.alive && c.count > 0 && (!fog || ob.seen)) { x = fog ? ob.x : c.ax; y = fog ? ob.y : c.ay; }
        else if (c && c.alive && c.count > 0 && mm.ever) { r.x = x = mm.x; r.y = y = mm.y; r.chase = 0; }
        else { r.on = false; r.chase = 0; holdHere(p); }
      }
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
    for (const a of S.agents) { if (a.dead || a.team < 2 || a.escapeT > 0 || !onScreen(a.x, a.y) || (fogGate() && a.seenA < 0.5)) continue; const dx = a.x - w.x, dy = a.y - w.y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; chase = a.team; } }
    if (!chase) { let cd = 2.6 * pick * pick; for (const c of S.camps) { if (!c.n) continue; const dx = c.x - w.x, dy = c.y - w.y, d2 = dx * dx + dy * dy; if (d2 < cd) { cd = d2; gx = c.x; gy = c.y; } } }
    setRoute(gx, gy, chase, src || "tap", sx, sy);
  }
  function setRoute(x, y, chase, src, sx, sy) { const inp = S.input, r = inp.route; r.on = true; r.x = x; r.y = y; r.chase = chase; r.src = src; r.sx = sx; r.sy = sy; inp.hold = false; inp.preview = S.cfg.flow.previewSeconds; inp.routeT = performance.now(); }

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
  // Under fog (M3, SPEC-v2 §7 minimal; M4 adds the personalities): a swarm is a threat or prey only while this AI sees it (obs, its own
  // stamps) or remembers it (mem, fog.aiMemory s for hunting, projected at most fog.aiLeadMax s ahead; fog.aiFleeMemory s for fleeing).
  // Counts are the public live counts (the pips). Camps: ones it has seen with people, or whose smoke is within fog.smoke. Power-ups:
  // beacons within ai.powerupSight. With nothing known it explores: fog.exploreSamples points fog.exploreRing px away, the nearest cell it
  // has not explored, kept fog.exploreCommit s. Every targeted swarm and camp passes the knowledge assert (PS.ai.assertKnowledge).
  const TH = { ax: 0, ay: 0 }, PR = { x: 0, y: 0, vx: 0, vy: 0 };
  function aiThink(t) {
    const cfg = S.cfg, P = t.ai, AI = cfg.ai, FW = cfg.flow, FG = cfg.fog, FL = PS.flow, FS = S.fogS;
    const final = S.timeLeft <= cfg.world.finalSeconds, cap = AI.sight * FW.fromMeCap, me = FL.buildFromMe(t.id, t.ax, t.ay, cap);
    const dist = (x, y) => { const d = FL.pathPx(me, x, y); if (d >= 0) return d; const dx = x - t.ax, dy = y - t.ay; return Math.max(cap, Math.sqrt(dx * dx + dy * dy) * FW.farDetour); };
    const regroup = !final && S.t < t.regroupUntil;
    let biggest = null; for (let i = 1; i < S.teams.length; i++) { const o = S.teams[i]; if (o.alive && (!biggest || o.count > biggest.count)) biggest = o; } // live counts are public (the pips)
    const fleeRatio = final ? AI.finalFleeRatio : P.fleeRatio;
    let threat = null, threatD = Infinity, prey = null, preyScore = 0;
    for (let i = 1; i < S.teams.length; i++) {
      const o = S.teams[i]; if (o === t || !o.alive) continue;
      const ob = FS.obs[t.id][i], mm = FS.mem[t.id][i]; let ox, oy, vx, vy, age, fresh;
      if (ob.seen) { ox = ob.x; oy = ob.y; vx = ob.vx; vy = ob.vy; age = 0; fresh = ob.n > ob.nEsc; }
      else if (mm.ever && S.t - mm.t <= FG.aiMemory) { age = S.t - mm.t; const la = Math.min(age, FG.aiLeadMax); ox = mm.x + mm.vx * la; oy = mm.y + mm.vy * la; vx = mm.vx; vy = mm.vy; fresh = mm.n > mm.nEsc; }
      else continue; // never target a swarm it has not seen (SPEC-v2 §7)
      const sp = PS.terrain.snapXY(ox, oy); ox = sp.x; oy = sp.y;
      const d = dist(ox, oy);
      let huntRatio = final && o === biggest ? AI.finalHuntRatio : P.huntRatio * (S.attract ? 1 : diff().huntMult);
      if (!final && !o.isPlayer) huntRatio *= AI.aiVsAiHuntMult;
      if (!final && S.t < AI.gracePeriod) huntRatio = 1e9; // nobody hunts before the grace period ends
      if (!(final && o === biggest) && age <= FG.aiFleeMemory && o.count >= t.count * fleeRatio && d < threatD) { threat = o; threatD = d; TH.ax = ox; TH.ay = oy; }
      // never hunt a swarm whose seen agents are all inside their escape window: they cannot be targeted (M2 critic MAJOR-2)
      if (!regroup && fresh && t.count >= o.count * huntRatio && t.count >= 3 && S.t >= (t.huntCooldown || 0)) {
        const sc = (o.count + 2) / (d + 60) * (o.isPlayer ? P.hatesPlayer : 1);
        if (sc > preyScore) { preyScore = sc; prey = o; PR.x = ox; PR.y = oy; PR.vx = vx; PR.vy = vy; }
      }
    }
    const escaping = S.t < t.escUntil;
    if (threat && threatD < AI.corneredDist && t.count >= 3 && !regroup && !escaping) {
      // caught: turn and fight rather than drag a hopeless chase across the map (never while regrouping or escaping: M2 critic MAJOR-2)
      knowSwarm(t, threat); aim(t, TH.ax, TH.ay); t.state = "hunt"; t.preyId = threat.id; t.speedMod = AI.huntSpeed; return;
    }
    if (threat) { knowSwarm(t, threat); t.speedMod = AI.fleeSpeed; const q = fleeTarget(t, TH, me, false); aim(t, q.x, q.y); t.state = "flee"; t.preyId = 0; return; }
    if (prey) {
      if (t.state !== "hunt") t.huntStart = S.t;
      let engagedAny = 0; for (let j = 1; j < 9; j++) engagedAny += t.eng[j];
      if (!final && S.t - t.huntStart > AI.huntTimeout && engagedAny === 0) { t.huntCooldown = S.t + AI.huntCooldown; prey = null; }
    }
    if (prey) {
      // lead the prey by the velocity this AI observed (never the prey's target: for the player that is the cursor), snapped back toward it
      knowSwarm(t, prey); aim(t, PR.x + PR.vx * AI.leadTime, PR.y + PR.vy * AI.leadTime, PR.x, PR.y); t.state = "hunt"; t.preyId = prey.id; t.speedMod = AI.huntSpeed; return;
    }
    t.preyId = 0;
    if (regroup) {
      const fo = S.teams[t.fleeFrom], ob = FS.obs[t.id][t.fleeFrom], mm = FS.mem[t.id][t.fleeFrom];
      if (fo && fo.alive && fo.count > 0 && (ob.seen || (mm.ever && S.t - mm.t <= FG.aiMemory))) {
        knowSwarm(t, fo); TH.ax = ob.seen ? ob.x : mm.x; TH.ay = ob.seen ? ob.y : mm.y; const q = fleeTarget(t, TH, me, true); aim(t, q.x, q.y); t.state = "regroup"; t.speedMod = AI.roamSpeed; return;
      }
    }
    // roam: the best camp this AI knows, or a power-up beacon it sees, by value / path distance
    let bestC = null, bestS = 0, pu = false; const sm2 = FG.smoke * FG.smoke;
    for (const c of S.camps) {
      const dx = c.x - t.ax, dy = c.y - t.ay, smoke = c.n > 0 && dx * dx + dy * dy <= sm2; if (!(c.kn[t.id] > 0) && !smoke) continue;
      const sc = P.neutralBias * AI.neutralScore / (dist(c.x, c.y) + 120);
      if (sc > bestS) { bestS = sc; bestC = c; }
    }
    let tx = bestC ? bestC.x : t.cx, ty = bestC ? bestC.y : t.cy;
    for (const p of S.powerups) {
      if (!p.alive) continue;
      const dx = p.x - t.cx, dy = p.y - t.cy; if (dx * dx + dy * dy > AI.powerupSight * AI.powerupSight) continue;
      const sc = P.powerBias * AI.powerScore / (dist(p.x, p.y) + 120);
      if (sc > bestS) { bestS = sc; tx = p.x; ty = p.y; pu = true; }
    }
    if (bestS > 0) { if (!pu) knowCamp(t, bestC); aim(t, tx, ty); t.state = "roam"; t.speedMod = AI.roamSpeed; return; }
    // explore: nothing known, so head for ground this AI has not seen (kept fog.exploreCommit s, or until reached)
    if (S.t >= t.exUntil || (t.exX - t.ax) * (t.exX - t.ax) + (t.exY - t.ay) * (t.exY - t.ay) < 60 * 60) {
      const E = FG.exploreRing, ex = PS.fog.exploredArr(t.id), T = PS.terrain, m = S.map; let bx = 0, by = 0, bd = Infinity;
      for (let k = 0; k < FG.exploreSamples; k++) {
        const a = S.rng() * Math.PI * 2, d = E[0] + S.rng() * (E[1] - E[0]), x = t.ax + Math.cos(a) * d, y = t.ay + Math.sin(a) * d, c = T.cellOf(x, y);
        if (c < 0 || !T.walkT(m.terr[c]) || m.region[c] !== 1 || (ex && ex[c])) continue; if (d < bd) { bd = d; bx = x; by = y; }
      }
      if (bd === Infinity) { const p = randPos(); bx = p.x; by = p.y; }
      t.exX = bx; t.exY = by; t.exUntil = S.t + FG.exploreCommit; FS.ai.explore++;
    }
    aim(t, t.exX, t.exY); t.state = "explore"; t.speedMod = AI.roamSpeed;
  }
  // PS.ai.assertKnowledge (SPEC-v2 §7, M3 brief 9): a swarm an AI targets must be in its sight (obs) or memory window (mem); a camp must be
  // one it has seen with people or whose smoke is in range. Counted always (sandboxes too); the first violation logs a console error.
  function knowSwarm(t, o) {
    const FS = S.fogS, K = FS.ai, ob = FS.obs[t.id][o.id], mm = FS.mem[t.id][o.id]; K.decisions++; K.swarm++;
    if (!ob.seen && !(mm.ever && S.t - mm.t <= S.cfg.fog.aiMemory + 1e-9)) knowFail(t, "swarm " + o.name);
  }
  function knowCamp(t, c) {
    const K = S.fogS.ai, sm = S.cfg.fog.smoke, dx = c.x - t.ax, dy = c.y - t.ay; K.decisions++; K.camps++;
    if (!(c.kn[t.id] > 0) && !(c.n > 0 && dx * dx + dy * dy <= sm * sm)) knowFail(t, "camp at " + Math.round(c.x) + "," + Math.round(c.y));
  }
  function knowFail(t, what) { const K = S.fogS.ai; K.violations++; if (!K.first) { K.first = { t: +S.t.toFixed(2), team: t.name, what }; if (S.debug) console.error("[PS.ai] knowledge assert: " + t.name + " targeted " + what + " it has not seen"); } }
  // Brogue's Dijkstra-map flee: among the camps (and, unless campsOnly, pass cells) reachable inside the "from me" field, the one that
  // maximises (the threat's path distance - mine), camps favoured by flow.fleeCampBonus px; if none gains distance, straight away from
  // the threat by ai.fleeDistance, stopped at the first rock. Replaces v1's slide along the map edge.
  const FC = new Int32Array(4096), FCK = new Uint8Array(4096), FP = { x: 0, y: 0 };
  function fleeTarget(t, threat, me, campsOnly, runPx) {
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
    return FL.rayOut(t.ax, t.ay, dx / d, dy / d, runPx || S.cfg.ai.fleeDistance, null);
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
  // strength ratio and morale (fighting mode: the rout group against its peak; radius mode: L / peak), blended with the headcount ratio by a
  // geometric mean so a 427 v 227 clash opens as WINNING
  const teamPower = (t) => 1;
  const CR = { f: 0.5, verdict: "EVEN", a: 0, b: 0 };
  function clashRead(pl, t) {
    const ri = t.id, pa = teamPower(pl), pb = teamPower(t), La = pl.engL[ri] * pa, Lb = t.engL[pl.id] * pb, fm = S.cfg.combat.localMode !== "radius";
    const mA = fm ? pl.engG[ri] / Math.max(1, pl.engGPk[ri]) : pl.engL[ri] / Math.max(1, pl.engPk[ri]), mB = fm ? t.engG[pl.id] / Math.max(1, t.engGPk[pl.id]) : t.engL[pl.id] / Math.max(1, t.engPk[pl.id]);
    const sa = Math.sqrt(Math.max(0, La) * pl.count * pa) * mA, sb = Math.sqrt(Math.max(0, Lb) * t.count * pb) * mB;
    CR.a = Math.round(pl.count * pa); CR.b = Math.round(t.count * pb); CR.f = sa + sb > 0 ? sa / (sa + sb) : 0.5; CR.verdict = CR.f > 0.56 ? "WINNING" : CR.f < 0.44 ? "LOSING" : "EVEN";
    return CR;
  }
  // a third swarm you can see within 400 px of the player's contact while it fights (fog: its visible agents only; fog off: on screen)
  function clashIncoming(pl, ri) {
    const x = pl.engCx[ri], y = pl.engCy[ri], fog = fogGate(); let best = null, bd = 400 * 400;
    for (let i = 2; i < S.teams.length; i++) {
      const t = S.teams[i], ob = S.fogS.obs[1][i]; if (i === ri || !t.alive || !t.count || (fog ? !ob.seen : !onScreen(t.ax, t.ay))) continue;
      const tx = fog ? ob.x : t.ax, ty = fog ? ob.y : t.ay, dx = tx - x, dy = ty - y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = t; }
    }
    return best;
  }

  // ---------------------------------------------------------------- helpers
  function screenToWorld(sx, sy) { const z = S.cam.zoom; return { x: (sx - S.vw / 2) / z + S.cam.x, y: (sy - S.vh / 2) / z + S.cam.y }; }
  function onScreen(x, y) { const z = S.cam.zoom, hw = S.vw / 2 / z + 40, hh = S.vh / 2 / z + 40; return Math.abs(x - S.cam.x) < hw && Math.abs(y - S.cam.y) < hh; }
  function banner(text, color, life) { if (S.attract) return; S.banners.push({ text, color, life, life0: life }); }
  // hints wait while the clash panel or a banner is up and for input.hintAfterRouteMs after a tap / click route (the marker and its
  // preview), so the pill never covers either (M2 critic MAJOR-3); returns whether it showed, and the caller retries until it does
  const clashShowing = () => { const p = S.teams[1]; if (!p || !p.count) return false; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive && p.engT[i] > 0.1) return true; return false; };
  function showHint(text, secs) {
    if (sandbox || S.attract || S.result) return false;
    if (S.engagedNow || clashShowing() || S.banners.length > 0 || performance.now() - S.input.routeT < S.cfg.input.hintAfterRouteMs) return false;
    const h = $("hint"); h.textContent = text; h.classList.add("show"); S.hintT = secs; return true;
  }
  function bumpChip(teamId) { if (sandbox) return; const el = $("chip-" + teamId); if (!el) return; el.classList.add("bump"); clearTimeout(el._bt); el._bt = setTimeout(() => el.classList.remove("bump"), 140); }

  function endGame(won, why) {
    if (S.attract || S.result) return;
    S.result = won ? "win" : "lose";
    PS.audio.stopDrum();
    const dawn = S.fogS && S.fogS.dawnT0 >= 0 ? S.cfg.fog.dawnSeconds : 0;
    S.pendingEnd = { won, why, at: S.t + Math.max(won ? 0.9 : 1.2, dawn) }; // sim-time delay: pausing defers it, newGame clears it
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
      const jt = Math.min(raw, 0.1); particles.update(jt); smokeP.update(jt); floaters.update(jt); if (S.input.preview > 0) S.input.preview -= jt; // juice runs on frame time (studio lesson 2)
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

  // minimap terrain (SPEC-v2 §5): one pixel per cell in a parchment palette (the map metaphor lives on the minimap only, R7); under fog only
  // the cells you have explored, the rest dark slate. An ImageData re-put from the typed arrays: the rect you explored since the last
  // redraw, or all of it for a new map or world, a dawn reveal, and on cache recovery (full = true)
  const MPAL = [[214, 196, 150], [120, 104, 82], [120, 150, 166], [198, 178, 120], [142, 104, 60]], MUNEX = [24, 30, 42], MOBST = [160, 138, 96];
  let miniTerr = null, miniImg = null, miniKey = "", miniT = -1e9, miniFrame = 0;
  function minimapBake(full) {
    const m = S.map; if (!m) return; const N = m.N, w = S.fogW, all = !fogGate(), key = m.id + ":" + (w ? w.id + "." + w.gen : "-") + ":" + all;
    if (!miniTerr || miniTerr.width !== N) { if (miniTerr) { miniTerr.width = 0; miniTerr.height = 0; } miniTerr = mkCanvas(N, N); miniImg = null; }
    const g = miniTerr.getContext("2d"); if (!miniImg) { miniImg = g.createImageData(N, N); full = true; }
    let x0 = 0, y0 = 0, x1 = N - 1, y1 = N - 1;
    if (!full && key === miniKey) { if (!w || w.mx1 < 0) return; x0 = w.mx0; y0 = w.my0; x1 = w.mx1; y1 = w.my1; }
    const d = miniImg.data, ex = w ? w.explored[1] : null;
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const c = j * N + i, q = c * 4, k = all || (ex && ex[c]) ? MPAL[m.terr[c]] || MPAL[0] : MUNEX; d[q] = k[0]; d[q + 1] = k[1]; d[q + 2] = k[2]; d[q + 3] = 255; }
    for (const o of S.obstacles) { const c = PS.terrain.cellOf(o.x, o.y), i = c % N, j = (c / N) | 0; if (c < 0 || m.terr[c] || !(all || (ex && ex[c])) || i < x0 || i > x1 || j < y0 || j > y1) continue; const q = c * 4; d[q] = MOBST[0]; d[q + 1] = MOBST[1]; d[q + 2] = MOBST[2]; }
    g.putImageData(miniImg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    if (w) { w.mx0 = 0; w.my0 = 0; w.mx1 = -1; w.my1 = -1; } miniKey = key;
  }

  const ROUTE = new Int32Array(4096); // route trace for the dotted preview
  const byY = (p, q) => p.y - q.y;
  const DASH = [8, 6], DASH0 = [], GDASH = [4, 4]; // reused line-dash arrays (no per-frame allocation)
  // fog render parameters (reused), the per-frame fog JS ring (render-side fog work plus the stamps of the ticks run since the last frame),
  // the last frame's view window, and the per-frame view of each rival (PV*: the agents you see, their centroid and top) from the same
  // pass that fades agents: tags, rings and arrows use it, so none can mark a rival you do not see this frame
  const FR = { vw: 0, vh: 0, dpr: 1, camX: 0, camY: 0, zoom: 1, t: 0, fog: false, px: 0, py: 0, R: 0, band: 0.28, dawn: 0, glow: 0 };
  const FCOST = new Float32Array(720), FPART = new Float32Array(720 * 4); let fcostN = 0, fogLastMs = 0; // FPART: per frame stamps, visibility pass, fog pass, tells
  const LW = { x0: 0, y0: 0, x1: 0, y1: 0 }; let tagMask = 0, ringMask = 0, arrowMask = 0, miniMask = 0;
  const PVN = new Int32Array(9), PVX = new Float64Array(9), PVY = new Float64Array(9), PVMY = new Float64Array(9);
  function draw() {
    const cfg = S.cfg, spr = S.spr, z = S.cam.zoom, dpr = S.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = TPAL.beyond; ctx.fillRect(0, 0, S.vw, S.vh); // past the world edge: more plateau
    if (!S.map) return;
    const FS = S.fogS, FG = cfg.fog, gate = fogGate(), fogView = S.fogOn && !NOFOG, tells = tellsOn() && S.mode === "play", pl = S.teams[1];
    const nowMs = performance.now(), dtF = Math.min(0.1, Math.max(0, (nowMs - S.lastDrawT) / 1000)), dtS = S.t >= S.lastDrawSim ? S.t - S.lastDrawSim : DT; S.lastDrawT = nowMs; S.lastDrawSim = S.t; S.frameId++;
    let fogMs = FS.simMs, f0 = 0, fp1 = 0, fp2 = 0, fp3 = 0; const fp0 = FS.simMs; FS.simMs = 0; tagMask = ringMask = arrowMask = 0;
    let shx = 0, shy = 0; if (S.shake > 0) { shx = (Math.random() - 0.5) * 10 * S.shake; shy = (Math.random() - 0.5) * 10 * S.shake; }
    // camera and shake rounded to device pixels
    const k = z * dpr, ox = Math.round((S.vw / 2 + shx) * dpr - S.cam.x * k), oy = Math.round((S.vh / 2 + shy) * dpr - S.cam.y * k);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    const x0 = -ox / k, y0 = -oy / k, x1 = x0 + (S.vw * dpr) / k, y1 = y0 + (S.vh * dpr) / k; LW.x0 = x0; LW.y0 = y0; LW.x1 = x1; LW.y1 = y1;

    // ground (baked chunks), plus the cache probe that heals a lost backing store without any browser event
    drawGround(x0, y0, x1, y1);
    cacheProbe(x0, y0, x1, y1, false);
    // camps: under fog, dirt only where you have seen a camp (camp dirt is a sprite, never baked)
    for (const c of S.camps) if ((!gate || c.kn[1] >= 0) && c.x > x0 - 40 && c.x < x1 + 40 && c.y > y0 - 30 && c.y < y1 + 30) ctx.drawImage(spr.dirt, c.x - 32, c.y - 20);

    // visibility and the fog.fadeSeconds fade (seenA) of every agent that is not yours, the per-frame view of each rival (PV*), and the draw
    // list. Agents outside the view snap to their state so none enters mid-fade; the fade steps by frame time or sim time, whichever is
    // larger, so a fading agent is never drawn more than fog.fadeSeconds of sim time after you last saw it (SPEC-v2 §5)
    f0 = performance.now();
    const V1 = gate ? PS.fog.vis(1) : null, v1 = gate ? PS.fog.verOf(1) : 0, NC = PS.fog.N, cell = S.map.cell, lim = NC * cell, fstep = Math.max(dtF, dtS, DT) / FG.fadeSeconds;
    for (let i = 0; i < 9; i++) { PVN[i] = 0; PVX[i] = 0; PVY[i] = 0; PVMY[i] = 1e9; }
    const DL = S.drawList; DL.length = 0;
    for (const a of S.agents) {
      const tm = a.team, out = a.x < x0 - 20 || a.x > x1 + 20 || a.y < y0 - 30 || a.y > y1 + 20; let vis = true;
      if (gate && tm === 0 && out) { a.seenA = 0; continue; } // a neutral out of view needs no lookup: it fades in if it enters the view in sight
      if (gate && tm !== 1) { const x = a.x, y = a.y; vis = v1 !== 0 && x >= 0 && y >= 0 && x < lim && y < lim && V1[((y / cell) | 0) * NC + ((x / cell) | 0)] === v1; }
      if (vis) { a.seenT = S.t; if (tm > 1) { PVN[tm]++; PVX[tm] += a.x; PVY[tm] += a.y; if (a.y < PVMY[tm]) PVMY[tm] = a.y; } }
      if (out) { a.seenA = vis ? 1 : 0; continue; }
      if (tm === 1 || !fogView) a.seenA = 1;
      else if (vis) { if ((a.seenA += fstep) > 1) a.seenA = 1; }
      else if ((a.seenA -= fstep) <= 0) { a.seenA = 0; continue; }
      DL.push(a);
    }
    fp1 = performance.now() - f0; fogMs += fp1;

    // team rings (buff / huddle indicator) under everything: a rival's only while you see it, around what you see of it
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count < 2) continue;
      let cx = t.cx, cy = t.cy, n = t.count; if (gate && i > 1) { if (!PVN[i]) continue; cx = PVX[i] / PVN[i]; cy = PVY[i] / PVN[i]; n = PVN[i]; }
      const r = 10 + Math.sqrt(n) * 7;
      let col = null;
      if (t.buffs.frenzy > 0) col = spr.PU.frenzy.color; else if (t.buffs.armor > 0) col = spr.PU.armor.color; else if (t.buffs.speed > 0) col = spr.PU.speed.color;
      if (t.isPlayer && S.input.huddle && !S.attract && !col) col = "rgba(255,255,255,.5)";
      if (!col) continue;
      if (i > 1) ringMask |= 1 << i;
      ctx.globalAlpha = 0.28 + 0.12 * Math.sin(S.t * 8); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(DASH); ctx.lineDashOffset = -S.t * 40;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash(DASH0); ctx.globalAlpha = 1;
    }

    // player target marker, and the route: dotted through known cells for flow.previewSeconds after a tap / click / minimap route, and
    // always in cursor-follow when the route runs over flow.routeDrawRatio x the straight line
    if (pl && pl.count > 0 && S.mode === "play") {
      const d = Math.hypot(pl.tx - pl.cx, pl.ty - pl.cy);
      if (d > 30) { ctx.globalAlpha = 0.85; ctx.drawImage(spr.marker, pl.tx - 2, pl.ty - 12); ctx.globalAlpha = 0.5; ctx.strokeStyle = pl.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.tx, pl.ty, 6 + 2 * Math.sin(S.t * 6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      const f = pl.route && PS.flow.fieldFor(1);
      if (f && f.ok) {
        const c0 = PS.flow.cellFor(pl.ax, pl.ay), len = PS.flow.pathCell(f, c0), straight = Math.hypot(pl.tx - pl.ax, pl.ty - pl.ay), pv = S.input.preview;
        if (len > 0 && (pv > 0 || (S.input.active && len > cfg.flow.routeDrawRatio * straight && straight > 60))) {
          const n = PS.flow.trace(f, c0, ROUTE, ROUTE.length), N = S.map.N, kn = PS.knowledge;
          ctx.fillStyle = pl.color; ctx.globalAlpha = pv > 0 ? Math.min(0.9, pv * 1.5) : 0.55;
          for (let q = 1; q < n; q += 2) { const c = ROUTE[q]; if (kn && !kn[c]) continue; const x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell; if (x < x0 - 8 || x > x1 + 8 || y < y0 - 8 || y > y1 + 8) continue; ctx.fillRect(x - 2, y - 2, 4, 4); }
          ctx.globalAlpha = 1;
        }
      }
    }

    // power-ups: live where you see them; where one was seen and that spot is out of sight now, a grey last-seen ghost (SPEC-v2 §5)
    for (const p of S.powerups) {
      if (gate && !PS.fog.sees(1, p.x, p.y)) {
        if (p.sseen && p.salive && p.sx > x0 - 30 && p.sx < x1 + 30 && p.sy > y0 - 30 && p.sy < y1 + 30 && !PS.fog.sees(1, p.sx, p.sy)) {
          ctx.globalAlpha = 0.35; ctx.fillStyle = "#9C9C94"; ctx.beginPath(); ctx.arc(p.sx, p.sy, 13, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.45; ctx.drawImage(spr.PU[p.skind].icon, p.sx - 12, p.sy - 16, 24, 24); ctx.globalAlpha = 1;
        }
        continue;
      }
      if (!p.alive || p.x < x0 - 30 || p.x > x1 + 30 || p.y < y0 - 30 || p.y > y1 + 30) continue;
      const pu = spr.PU[p.kind], bob = Math.sin(p.t * 4) * 3, pulse = (p.t * 0.9) % 1;
      ctx.globalAlpha = 0.4; ctx.fillStyle = pu.color; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7 * (1 - pulse); ctx.strokeStyle = pu.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, 10 + pulse * 26, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.drawImage(spr.shadow, p.x - 6, p.y + 4);
      ctx.drawImage(pu.icon, p.x - 12, p.y - 16 + bob, 24, 24);
    }

    // shadows + sort list (agents at their seenA; trees and rocks are terrain, drawn as ever)
    for (const o of S.obstacles) { if (o.x < x0 - 40 || o.x > x1 + 40 || o.y < y0 - 60 || o.y > y1 + 30) continue; DL.push(o); }
    let curA = 1; for (const a of DL) if (a.team !== undefined) { if (a.seenA !== curA) { curA = a.seenA; ctx.globalAlpha = curA; } ctx.drawImage(spr.shadow, a.x - 6, a.y - 1); }
    ctx.globalAlpha = 1;
    DL.sort(byY);
    const neutralSet = spr._neutral || (spr._neutral = spr.peasantSet(cfg.neutral.color)), fid = S.frameId;
    for (const e of DL) {
      if (e.team === undefined) {
        if (e.kind === 2) ctx.drawImage(spr.rock, e.x - 14, e.y - 14);
        else { const tr = spr.trees[e.kind]; ctx.drawImage(tr, e.x - tr.width / 2, e.y - tr.height + 6); }
        continue;
      }
      const set = e.team ? S.teams[e.team].spr : neutralSet, al = e.seenA;
      const moving = e.vx * e.vx + e.vy * e.vy > 120;
      let f = e.lunge > 0.08 ? 2 : moving ? ((e.ph | 0) % 2) : 3;
      const img = (e.face < 0 ? set.L : set.R)[f];
      const bob = moving ? (((e.ph * 0.5) | 0) % 2) : 0;
      let sc = 1; if (e.pop > 0 && e.pop < 0.3) sc = 1 + 0.55 * (1 - e.pop / 0.3);
      const w = 24 * sc, h = 28 * sc, dx = e.x - w / 2, dy = e.y - 24 - bob - (h - 28);
      if (e.team !== 1) e.drawnF = fid;
      if (e.escapeT > 0) { ctx.globalAlpha = al * (0.6 + 0.25 * ((e.ph | 0) & 1)); ctx.drawImage(img, dx, dy, w, h); ctx.globalAlpha = al; ctx.fillStyle = "#F1EEDF"; ctx.fillRect(e.x - 6, dy - 3, 2, 4); ctx.fillRect(e.x + 4, dy - 3, 2, 4); ctx.globalAlpha = 1; continue; } // remnant: hands up, run
      if (al < 1) ctx.globalAlpha = al;
      ctx.drawImage(img, dx, dy, w, h);
      if (e.fl > 0) { ctx.globalAlpha = Math.min(1, e.fl * 7) * al; ctx.drawImage((e.face < 0 ? set.LW : set.RW)[f], dx, dy, w, h); ctx.globalAlpha = al; } // hit flash and HP bar respect seenA
      if (e.hp < cfg.agent.hp && e.team) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(e.x - 6, dy - 3, 12, 2); ctx.fillStyle = e.hp <= 1 ? "#FF5C5C" : "#FFD23F"; ctx.fillRect(e.x - 6, dy - 3, 12 * (e.hp / cfg.agent.hp), 2); }
      if (al < 1) ctx.globalAlpha = 1;
    }

    particles.draw(ctx);
    floaters.draw(ctx);

    // camp head-count labels near the player: the live count where you see the camp, the last-seen one on explored ground (never live)
    if (S.mode === "play" && pl.count > 0) {
      ctx.font = "800 11px 'Nunito', system-ui"; ctx.textAlign = "center";
      for (const c of S.camps) {
        if (c.x < x0 - 40 || c.x > x1 + 40 || c.y < y0 - 40 || c.y > y1 + 40) continue;
        const n = !gate || PS.fog.sees(1, c.x, c.y) ? c.n : c.kn[1]; if (!(n > 0)) continue;
        const d = Math.hypot(c.x - pl.cx, c.y - pl.cy); if (d > cfg.world.campLabelDist) continue;
        const a = clamp((cfg.world.campLabelDist - d) / 120, 0, 1); ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = "rgba(8,14,6,.7)"; ctx.fillRect(c.x - 15, c.y - 44, 30, 15); ctx.fillStyle = "#F1EEDF"; ctx.fillText("+" + n, c.x, c.y - 33);
      }
      ctx.globalAlpha = 1;
    }

    // the clash you are in (the panel labels that rival; its read also drives the losing-clash glow inside the fog canvas)
    let clashRi = 0, clashF = -1;
    if (S.mode === "play" && !S.attract && pl.count > 0) { let best = 0.1; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive && pl.engT[i] > best) { best = pl.engT[i]; clashRi = i; } if (clashRi) clashF = clashRead(pl, S.teams[clashRi]).f; }

    // the fog pass (SPEC-v2 §5): mask, cloud drift, holes, vignette and the losing-clash glow composed in the quarter-res fog canvas, then
    // ONE full-screen alpha blit. With the fog off (title, fixtures, ?nofog=1) the same canvas carries only the vignette and the glow.
    f0 = performance.now();
    FR.vw = S.vw; FR.vh = S.vh; FR.dpr = dpr; FR.camX = S.cam.x; FR.camY = S.cam.y; FR.zoom = z; FR.t = S.t; FR.fog = fogView;
    FR.px = pl ? pl.cx : 0; FR.py = pl ? pl.cy : 0; FR.R = pl && pl.alive && pl.count > 0 ? sightR(pl) : 0;
    FR.band = S.input.touch && FR.R > 0 ? Math.max(FG.softBand, FG.phoneBand / FR.R) : FG.softBand;
    FR.dawn = FS.dawnT0 >= 0 ? clamp((S.t - FS.dawnT0) / FG.dawnSeconds, 0, 1) : 0;
    FR.glow = S.mode === "play" && S.engagedNow && clashF >= 0 && clashF < 0.46 ? FG.glowAlpha + FG.glowPulse * Math.sin(S.t * FG.glowRate) : 0;
    PS.fog.render(ctx, FR);
    fp2 = performance.now() - f0; fogMs += fp2;

    // above the fog, world space: campfire smoke and crows, beacons, pings, dust, ghosts, then name tags and verdict marks
    ctx.setTransform(k, 0, 0, k, ox, oy);
    smokeP.draw(ctx);
    f0 = performance.now();
    if (tells) drawTellsWorld(x0, y0, x1, y1, pl);
    fp3 = performance.now() - f0; fogMs += fp3;
    // name tags above every swarm you see (yours too), over what you see of it; the swarm clashing with you is labelled by the clash panel
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count === 0 || i === clashRi || (t.isPlayer && (t.count < 2 || S.attract || S.engagedNow))) continue;
      let cx = t.cx, cy = t.cy, top = t.minY; if (gate && i > 1) { if (!PVN[i]) continue; cx = PVX[i] / PVN[i]; cy = PVY[i] / PVN[i]; top = PVMY[i]; }
      if (cx < x0 - 60 || cx > x1 + 60 || cy < y0 - 60 || cy > y1 + 60) continue;
      const ly = Math.min(top - 30, cy - 40);
      ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center";
      const label = (S.attract && t.isPlayer ? "Mint" : t.name) + " · " + t.count; const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = "rgba(8,14,6,.75)"; ctx.fillRect(cx - w / 2, ly - 13, w, 18);
      ctx.fillStyle = t.color; ctx.fillRect(cx - w / 2, ly - 13, 3, 18);
      ctx.fillStyle = "#F1EEDF"; ctx.fillText(label, cx + 1, ly);
      if (i > 1) tagMask |= 1 << i;
    }
    // first sight: a verdict mark on that rival's banner position for fog.verdictSeconds (stronger / even / weaker, count x power)
    f0 = performance.now();
    let fp4 = 0; if (tells) for (let i = 2; i < S.teams.length; i++) {
      const v = FS.verdict[i], age = S.t - v.t0; if (age < 0 || age >= FG.verdictSeconds || !PVN[i] || i === clashRi) continue;
      const cx = PVX[i] / PVN[i], ly = Math.min(PVMY[i] - 30, PVY[i] / PVN[i] - 40);
      ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center";
      const txt = v.kind > 0 ? "STRONGER" : v.kind < 0 ? "WEAKER" : "EVEN", col = v.kind > 0 ? "#FF7A6E" : v.kind < 0 ? "#7CF2C4" : "#FFE49A", vy = ly - 26, vw = ctx.measureText(txt).width + 26;
      ctx.globalAlpha = Math.min(1, (FG.verdictSeconds - age) * 3, age * 8 + 0.2); ctx.fillStyle = "rgba(8,14,6,.85)"; ctx.beginPath(); ctx.roundRect(cx - vw / 2, vy - 13, vw, 18, 6); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(txt, cx + 7, vy); ctx.beginPath();
      const mx = cx - vw / 2 + 9, my = vy - 4; if (v.kind > 0) { ctx.moveTo(mx - 4, my + 3); ctx.lineTo(mx, my - 3); ctx.lineTo(mx + 4, my + 3); } else if (v.kind < 0) { ctx.moveTo(mx - 4, my - 3); ctx.lineTo(mx, my + 3); ctx.lineTo(mx + 4, my - 3); } else { ctx.moveTo(mx - 4, my - 2); ctx.lineTo(mx + 4, my - 2); ctx.moveTo(mx - 4, my + 2); ctx.lineTo(mx + 4, my + 2); }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    }

    // screen-space overlays: edge markers (fog tells and off-screen rivals), banner, clash panel, joystick, debug line
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S.mode === "play" && !S.attract) drawEdges();
    fp4 = performance.now() - f0; fogMs += fp4; fp3 += fp4; // fog JS: the stamps, the visibility pass, the fog pass, the tells, verdict marks and edge markers
    // banner (one at a time, pinned high)
    for (let i = 0; i < Math.min(1, S.banners.length); i++) {
      const b = S.banners[i], age = 1 - b.life / b.life0;
      const a = Math.min(1, b.life * 2, age * 6); const y = S.input.touch ? 215 : Math.max(150, S.vh * 0.22);
      ctx.globalAlpha = a; ctx.font = "800 " + (S.vw < 700 ? 22 : 30) + "px 'Baloo 2', system-ui"; ctx.textAlign = "center";
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(b.text, S.vw / 2, y);
      ctx.fillStyle = b.color; ctx.fillText(b.text, S.vw / 2, y); ctx.globalAlpha = 1;
    }
    // clash panel: who is fighting whom and who is winning, unmissable, screen space
    if (clashRi) {
      const t = S.teams[clashRi], cr = clashRead(pl, t), inc = clashIncoming(pl, clashRi);
      const pw = Math.min(380, S.vw - 32), px = S.vw / 2 - pw / 2, py = S.input.touch ? 112 : 58, ph = inc ? 62 : 46;
      ctx.fillStyle = "rgba(8,14,6,.82)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.fill();
      ctx.font = "800 15px 'Nunito', system-ui"; ctx.textAlign = "left"; ctx.fillStyle = pl.color; ctx.fillText("YOU " + cr.a, px + 12, py + 20);
      ctx.textAlign = "right"; ctx.fillStyle = t.color; ctx.fillText(t.name.toUpperCase() + " " + cr.b, px + pw - 12, py + 20);
      ctx.textAlign = "center"; ctx.font = "800 12px 'Nunito', system-ui";
      ctx.fillStyle = cr.f > 0.56 ? "#7CF2C4" : cr.f < 0.44 ? "#FF7A6E" : "#FFE49A"; ctx.fillText(cr.verdict, px + pw / 2, py + 20);
      if (inc) { ctx.fillStyle = inc.color; ctx.fillText(inc.name.toUpperCase() + " INCOMING", px + pw / 2, py + 56); }
      const bx = px + 12, bw = pw - 24, by = py + 30;
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = pl.color; ctx.fillRect(bx, by, bw * cr.f, 8); ctx.fillStyle = t.color; ctx.fillRect(bx + bw * cr.f, by, bw * (1 - cr.f), 8);
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bx + bw * cr.f - 1, by - 2, 2, 12);
    }
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
    if (S.debug) { const fs = PS.flow.stats; ctx.font = "12px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("fps " + S.fps + "  agents " + S.agents.length + "/" + S.cap + "  seed " + S.seed + "  map " + S.map.used + (S.map.fallback ? " (fallback)" : "") + " r" + S.map.rerolls + "  zoom " + S.cam.zoom.toFixed(2) + "  fields " + (fs ? fs.rebuilds + " " + fs.lastCostMs + "ms" : "-") + "  fog " + fogLastMs.toFixed(2) + "ms" + (NOFOG ? " (nofog)" : "") + (S.fixture ? "  fixture " + S.fixture.name : ""), 8, S.vh - 8); }

    drawMinimap(false);
    if (gate && S.mode === "play" && (S.debug || FS.leakOn)) leakFrame();
    const fq = (fcostN % FCOST.length) * 4; FPART[fq] = fp0; FPART[fq + 1] = fp1; FPART[fq + 2] = fp2; FPART[fq + 3] = fp3;
    FCOST[fcostN++ % FCOST.length] = fogMs; fogLastMs = fogMs;
  }

  // above the fog, world space (SPEC-v2 §5 tells): power-up beacons within fog.beacon px that you cannot see, pings where a clash you cannot
  // see is going on, dust from big unseen swarms, and "~N" ghosts where a rival left your sight (fading over fog.ghostSeconds)
  function drawTellsWorld(x0, y0, x1, y1, pl) {
    const FS = S.fogS, FG = S.cfg.fog, spr = S.spr, bc2 = FG.beacon * FG.beacon, inV = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
    for (const p of S.powerups) {
      if (!p.alive || PS.fog.sees(1, p.x, p.y) || !inV(p.x, p.y, 40) || (p.x - pl.cx) * (p.x - pl.cx) + (p.y - pl.cy) * (p.y - pl.cy) > bc2) continue;
      const pu = 0.6 + 0.3 * Math.sin(S.t * 3 + p.x * 0.01); ctx.fillStyle = spr.PU[p.kind].color;
      ctx.globalAlpha = 0.12 * pu; ctx.fillRect(p.x - 10, p.y - 90, 20, 90); ctx.globalAlpha = 0.22 * pu; ctx.fillRect(p.x - 5, p.y - 90, 10, 90); ctx.globalAlpha = 0.55 * pu; ctx.fillRect(p.x - 2, p.y - 90, 4, 90);
      ctx.globalAlpha = 0.9 * pu; ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x + 6, p.y); ctx.lineTo(p.x, p.y + 8); ctx.lineTo(p.x - 6, p.y); ctx.closePath(); ctx.fill();
    }
    for (const p of FS.pings) {
      if (!p.on || !inV(p.x, p.y, 40)) continue; const age = (S.t - p.t0) % 1;
      ctx.globalAlpha = 0.8 * (1 - age); ctx.strokeStyle = p.rout ? "#FFE49A" : "#F1EEDF"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 12 + age * 34, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.9; pitchfork(p.x, p.y, 11, "#F1EEDF");
    }
    for (let r = 2; r < S.teams.length; r++) {
      const d = FS.dust[r], t = S.teams[r]; if (!d.on || PVN[r] || !inV(d.x, d.y, 60)) continue;
      ctx.fillStyle = t.color; for (let q = 0; q < 4; q++) { const a = q * 1.7 + S.t * 0.6, rr = 16 + 6 * Math.sin(S.t * 1.3 + q); ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * 18, d.y + Math.sin(a) * 10 - 10, rr, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center";
    for (let r = 2; r < S.teams.length; r++) {
      const g = FS.ghosts[r]; if (!g.on || PVN[r] || !inV(g.x, g.y, 60)) continue; const age = S.t - g.t0, a = clamp(1 - (0.8 * age) / FG.ghostSeconds, 0.2, 1), rad = 12 + Math.sqrt(g.n) * 5;
      ctx.globalAlpha = a; ctx.strokeStyle = S.teams[r].color; ctx.lineWidth = 2; ctx.setLineDash(GDASH); ctx.beginPath(); ctx.arc(g.x, g.y, rad, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash(DASH0);
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(g.x - 14, g.y - 7, 28, 14); ctx.fillStyle = S.teams[r].color; ctx.fillText("~" + g.n, g.x, g.y + 4);
    }
    ctx.globalAlpha = 1;
  }
  function pitchfork(x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y - s * 0.25); ctx.moveTo(x - s * 0.55, y - s * 0.25); ctx.lineTo(x + s * 0.55, y - s * 0.25);
    for (let q = -1; q <= 1; q++) { ctx.moveTo(x + q * s * 0.55, y - s * 0.25); ctx.lineTo(x + q * s * 0.55, y - s); } ctx.stroke();
  }
  // edge markers (SPEC-v2 §5, §10), at most fog.edgeMax, priority danger > visible rival > crown (M4) > ping > ghost > dust: a solid arrow
  // with the count to a rival you see off-screen, a hollow arrow to a ghost, a pitchfork to a heard clash, a red chevron to danger, a puff
  // to dust. Never an arrow to a rival you cannot see. With the fog off: v1's solid arrows to every off-screen rival.
  const EM = []; for (let i = 0; i < 24; i++) EM.push({ pri: 0, x: 0, y: 0, team: 0, n: 0, ang: 0, a: 1 }); let emN = 0;
  function emAdd(pri, sx, sy, team, n, a) { if (emN >= EM.length) return; const e = EM[emN++], cx = S.vw / 2, cy = S.vh / 2; e.pri = pri; e.x = sx; e.y = sy; e.team = team; e.n = n; e.ang = Math.atan2(sy - cy, sx - cx); e.a = a; }
  const offScreen = (sx, sy) => !(sx > 20 && sx < S.vw - 20 && sy > 60 && sy < S.vh - 20);
  function drawEdges() {
    const FS = S.fogS, FG = S.cfg.fog, z = S.cam.zoom, gate = fogGate(), cx = S.vw / 2, cy = S.vh / 2; emN = 0;
    if (gate && FS.danger.on) { const a = FS.danger.ang; emAdd(5, cx + Math.cos(a) * 4000, cy + Math.sin(a) * 4000, FS.danger.team, 0, 0.65 + 0.35 * Math.sin(S.t * 12)); }
    for (let i = 2; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count === 0) continue;
      if (!gate || PVN[i]) {
        const wx = gate ? PVX[i] / PVN[i] : t.cx, wy = gate ? PVY[i] / PVN[i] : t.cy, sx = (wx - S.cam.x) * z + cx, sy = (wy - S.cam.y) * z + cy;
        if (offScreen(sx, sy)) { emAdd(4, sx, sy, i, t.count, 0.9); if (gate) arrowMask |= 1 << i; }
        continue;
      }
      const g = FS.ghosts[i]; if (g.on) { const sx = (g.x - S.cam.x) * z + cx, sy = (g.y - S.cam.y) * z + cy; if (offScreen(sx, sy)) emAdd(1, sx, sy, i, g.n, clamp(1 - (0.7 * (S.t - g.t0)) / FG.ghostSeconds, 0.3, 1)); }
      const d = FS.dust[i]; if (d.on) { const sx = (d.x - S.cam.x) * z + cx, sy = (d.y - S.cam.y) * z + cy; if (offScreen(sx, sy)) emAdd(0, sx, sy, i, 0, 0.8); }
    }
    if (gate) for (const p of FS.pings) if (p.on) { const sx = (p.x - S.cam.x) * z + cx, sy = (p.y - S.cam.y) * z + cy; if (offScreen(sx, sy)) emAdd(2, sx, sy, 0, p.rout ? 1 : 0, 1); }
    for (let i = 1; i < emN; i++) { const e = EM[i]; let j = i - 1; while (j >= 0 && EM[j].pri < e.pri) { EM[j + 1] = EM[j]; j--; } EM[j + 1] = e; } // stable, by priority
    const top = S.input.touch ? 120 : 70, bot = S.vh - (S.input.touch ? 46 : 26), mm = S.input.touch ? 120 : 160;
    for (let q = 0; q < Math.min(emN, FG.edgeMax); q++) {
      const e = EM[q], dx = e.x - cx, dy = e.y - cy; let s = 1;
      if (dx > 0) s = Math.min(s, (S.vw - 26 - cx) / dx); else if (dx < 0) s = Math.min(s, (26 - cx) / dx); if (dy > 0) s = Math.min(s, (bot - cy) / dy); else if (dy < 0) s = Math.min(s, (top - cy) / dy);
      const ex = cx + dx * s; let ey = cy + dy * s; if (ex > S.vw - mm - 10 && ey > S.vh - mm - 10) ey = S.vh - mm - 14;
      const col = e.team ? S.teams[e.team].color : "#F1EEDF", ca = Math.cos(e.ang) * S.dpr, sa = Math.sin(e.ang) * S.dpr;
      ctx.setTransform(ca, sa, -sa, ca, ex * S.dpr, ey * S.dpr); ctx.globalAlpha = e.a;
      if (e.pri === 5) { ctx.strokeStyle = "#FF3B30"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-4, -11); ctx.lineTo(7, 0); ctx.lineTo(-4, 11); ctx.moveTo(-14, -11); ctx.lineTo(-3, 0); ctx.lineTo(-14, 11); ctx.stroke(); ctx.lineCap = "butt"; }
      else if (e.pri === 4) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-3, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); }
      else if (e.pri === 1) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-3, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.stroke(); }
      else if (e.pri === 0) { ctx.fillStyle = col; for (let k = 0; k < 3; k++) { ctx.globalAlpha = 0.35 * e.a; ctx.beginPath(); ctx.arc(-4 + k * 5, (k - 1) * 4, 7, 0, Math.PI * 2); ctx.fill(); } }
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      if (e.pri === 2) { ctx.globalAlpha = 0.85; ctx.fillStyle = "rgba(8,14,6,.8)"; ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; pitchfork(ex, ey, 9, e.n ? "#FFE49A" : "#F1EEDF"); }
      ctx.globalAlpha = 1;
      if (e.pri === 4 || e.pri === 1) { const txt = e.pri === 1 ? "~" + e.n : String(e.n); ctx.font = "800 11px 'Nunito', system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(ex - 13, ey + 12, 26, 14); ctx.fillStyle = e.pri === 1 ? col : "#F1EEDF"; ctx.fillText(txt, ex, ey + 23); }
    }
  }

  // minimap (SPEC-v2 §5): explored terrain, camps and power-ups as you last saw them, your swarm, neutrals and rivals only where you see them
  // now, a fading ghost for fog.miniGhostSeconds where a rival left your sight, pings and dust. Redrawn at most fog.minimapHz, one pass
  // over the agents with a colour switch (v1 walked every agent once per team per frame).
  function drawMinimap(force) {
    if (S.mode === "title" || S.attract) return;
    const nowMs = performance.now(); if (!force && nowMs - miniT < 1000 / S.cfg.fog.minimapHz) return; miniT = nowMs; miniFrame = S.frameId;
    const cfg = S.cfg, FS = S.fogS, FG = cfg.fog, k = 150 / Math.max(cfg.world.w, cfg.world.h), gate = fogGate(), pl = S.teams[1], bc2 = FG.beacon * FG.beacon;
    minimapBake(false);
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.imageSmoothingEnabled = false; mctx.globalAlpha = 1;
    if (miniTerr) mctx.drawImage(miniTerr, 0, 0, 150, 150); else { mctx.fillStyle = "#1f3a1a"; mctx.fillRect(0, 0, 150, 150); }
    mctx.fillStyle = "#6E4F30"; for (const c of S.camps) { const n = gate && !PS.fog.sees(1, c.x, c.y) ? c.kn[1] : c.n; if (n > 0) mctx.fillRect((c.x * k - 1) | 0, (c.y * k - 1) | 0, 3, 2); }
    for (const p of S.powerups) {
      let x = p.x, y = p.y, col = null;
      if (p.alive && (!gate || PS.fog.sees(1, p.x, p.y) || (p.x - pl.cx) * (p.x - pl.cx) + (p.y - pl.cy) * (p.y - pl.cy) <= bc2)) col = S.spr.PU[p.kind].color;
      else if (gate && p.sseen && p.salive) { x = p.sx; y = p.sy; col = "#8A8A84"; }
      if (col) { mctx.fillStyle = col; mctx.fillRect((x * k - 1) | 0, (y * k - 1) | 0, 3, 3); }
    }
    let cur = ""; miniMask = 0;
    for (const a of S.agents) {
      const tm = a.team; if (a.dead || (gate && tm !== 1 && !PS.fog.sees(1, a.x, a.y))) continue;
      const x = (a.x * k) | 0, y = (a.y * k) | 0;
      if (tm === 0) { if (cur !== "n") { mctx.fillStyle = "#5A4630"; cur = "n"; } mctx.fillRect(x, y, 1, 1); continue; }
      if (tm > 1) { if (cur !== "d") { mctx.fillStyle = "#15110C"; cur = "d"; } mctx.fillRect(x - 1, y - 1, 4, 4); miniMask |= 1 << tm; } // dark backing: yellow reads on parchment
      const col = S.teams[tm].color; if (cur !== col) { mctx.fillStyle = col; cur = col; } mctx.fillRect(x, y, 2, 2);
    }
    if (gate) {
      for (let r = 2; r < S.teams.length; r++) {
        const g = FS.ghosts[r], age = S.t - g.t0; if (age > FG.miniGhostSeconds || FS.obs[1][r].seen) continue;
        mctx.globalAlpha = 1 - age / FG.miniGhostSeconds; mctx.strokeStyle = S.teams[r].color; mctx.lineWidth = 1.5; mctx.strokeRect(g.x * k - 3, g.y * k - 3, 6, 6);
      }
      for (let r = 2; r < S.teams.length; r++) { const d = FS.dust[r]; if (!d.on || FS.obs[1][r].seen) continue; mctx.globalAlpha = 0.4; mctx.fillStyle = S.teams[r].color; mctx.fillRect((d.x * k - 4) | 0, (d.y * k - 4) | 0, 8, 8); }
      for (const p of FS.pings) if (p.on) { const age = (S.t - p.t0) % 1; mctx.globalAlpha = 1 - age; mctx.strokeStyle = p.rout ? "#FFE49A" : "#F1EEDF"; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(p.x * k, p.y * k, 2 + age * 7, 0, Math.PI * 2); mctx.stroke(); }
      mctx.globalAlpha = 1;
    }
    const z = S.cam.zoom; mctx.strokeStyle = "rgba(255,255,255,.9)"; mctx.lineWidth = 1.5;
    mctx.strokeRect((S.cam.x - S.vw / 2 / z) * k, (S.cam.y - S.vh / 2 / z) * k, (S.vw / z) * k, (S.vh / z) * k);
  }

  // leak check (SPEC-v2 §5): over the last frame, every rival (and neutral) agent drawn must be one you see now or one still inside its
  // fog.fadeSeconds fade since you last saw it; every agent you see in the view must be drawn; tags, rings, solid arrows and (on a redraw
  // frame) minimap dots may only mark rivals you see. Recomputed through PS.fog.sees from the typed arrays, not the draw pass's own state.
  function leakFrame() {
    const FS = S.fogS, L = FS.leak, fade = S.cfg.fog.fadeSeconds + 2 * DT, f = S.frameId, w = LW;
    let drawn = 0, vis = 0, fading = 0, hidden = 0, missed = 0, nh = 0, seenM = 0, drawnM = 0;
    for (const a of S.agents) {
      const tm = a.team; if (tm === 1 || a.dead) continue;
      const seen = PS.fog.sees(1, a.x, a.y), was = a.drawnF === f, inWin = !(a.x < w.x0 - 20 || a.x > w.x1 + 20 || a.y < w.y0 - 30 || a.y > w.y1 + 20);
      if (tm > 1) { if (seen) seenM |= 1 << tm; if (was) { drawnM |= 1 << tm; drawn++; } if (seen && inWin) vis++; }
      if (was && !seen) { if (inWin && S.t - a.seenT <= fade) { if (tm > 1) fading++; } else { if (tm > 1) hidden++; else nh++; if (!L.samples) L.samples = []; if (L.samples.length < 5) L.samples.push({ t: +S.t.toFixed(2), team: tm, x: Math.round(a.x), y: Math.round(a.y), seenA: +a.seenA.toFixed(2), seenT: +a.seenT.toFixed(2), inWin }); } }
      if (seen && inWin && !was) missed++;
    }
    const ok = seenM | drawnM; let tagH = 0, ringH = 0, arrowH = 0, miniH = 0;
    for (let r = 2; r < 9; r++) { const b = 1 << r; if (ok & b) continue; if (tagMask & b) tagH++; if (ringMask & b) ringH++; if (arrowMask & b) arrowH++; if (miniFrame === f && (miniMask & b)) miniH++; }
    const diff = hidden + missed + nh + tagH + ringH + arrowH + miniH;
    L.frames++; L.rivalsDrawn += drawn; L.rivalsVisible += vis; L.fading += fading; L.hidden += hidden; L.missed += missed; L.neutralsHidden += nh; L.tagHidden += tagH; L.ringHidden += ringH; L.arrowHidden += arrowH; L.miniHidden += miniH;
    return (L.last = { frame: f, t: +S.t.toFixed(2), rivalsDrawn: drawn, rivalsVisible: vis, fading, hidden, missed, neutralsHidden: nh, tagHidden: tagH, ringHidden: ringH, arrowHidden: arrowH, miniHidden: miniH, diff });
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
    if (S.map) { groundInvalidate(S.map); minimapBake(true); if (sync) flushGround(S.map); }
    PS.fog.recover(); // the fog mask and cloud texture, re-put from their typed arrays (explored ground is remembered)
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
    if (!blank && (force || (probeC & 7) === 4) && PS.fog.maskCanvas && PS.fog.minAlpha4(PS.fog.maskCanvas) < 100) blank = true; // the fog mask (alpha 140-235 when whole)
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
    n += PS.fog.drop();
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
    const fr = PS.fog.report(), out = { chunks: 0, chunksOpaque: 0, chunksBlank: [], pending: 0, minimap: miniTerr ? opaqueCount(miniTerr) > 0 : false, sprites: 0, spritesBlank: [], fogMask: fr.mask >= 100, fogMaskAlpha: fr.mask, fogCloud: fr.cloud };
    if (S.map && S.map.chunks) { const G = S.map.chunks; out.pending = G.left; for (let i = 0; i < G.n * G.n; i++) for (const cv of [G.cvA[i], G.cvB[i]]) { if (!cv) continue; out.chunks++; if (opaque4(cv)) out.chunksOpaque++; else out.chunksBlank.push(i); } }
    for (const e of spriteCanvases(S.spr, S.teams)) { out.sprites++; if (opaqueCount(e[1]) === 0) out.spritesBlank.push(e[0]); }
    out.ok = out.chunks > 0 && out.chunksOpaque === out.chunks && out.pending === 0 && out.minimap && out.spritesBlank.length === 0 && out.fogMask && out.fogCloud;
    return out;
  }

  // ---------------------------------------------------------------- HUD
  function buildTeamChips() {
    if (sandbox) return;
    const el = $("teams"); el.innerHTML = "";
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i];
      const c = document.createElement("div"); c.className = "chip" + (t.isPlayer ? " you" : "") + (t.alive ? "" : " dead"); c.id = "chip-" + i;
      const unseen = chipUnseen(i); if (unseen) c.classList.add("unseen");
      c.innerHTML = "<span class='sw' style='background:" + t.color + "'></span><span>" + t.name + "</span><span class='n'>" + (unseen ? "?" : t.count) + "</span>";
      el.appendChild(c);
    }
  }
  // a rival's pip is dimmed with "?" until you have seen it once (SPEC-v2 §5): after that its live count (the win condition stays readable)
  const chipUnseen = (i) => i > 1 && !S.attract && fogGate() && !S.fogS.obs[1][i].ever;
  let hudT = 0;
  function updateHUD(force) {
    const now = performance.now(); if (!force && now - hudT < 100) return; hudT = now;
    for (let i = 1; i < S.teams.length; i++) { const el = $("chip-" + i); if (!el) continue; const u = chipUnseen(i); el.lastElementChild.textContent = u ? "?" : S.teams[i].count; el.classList.toggle("unseen", u); }
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

  // ---------------------------------------------------------------- PS.vis / PS.ai: the fog's critic hooks (SPEC-v2 §5, §7, §13)
  // The harness bot plays fog-honest through rivals() and camps() (never PSS.teams positions); leakCheck() draws one frame and checks it;
  // leakTotals() sums every checked frame (every live frame under ?debug=1); structure() counts full-screen alpha draws over 10 frames;
  // cost() is the per-frame fog JS (render side plus the stamps of the ticks each frame ran) over the last 720 frames.
  const pctA = (a, p) => (a.length ? pct(a, p) : 0);
  const VIS = {
    sees: (team, x, y) => PS.fog.sees(team, x, y),
    seesAgent: (team, a) => !!a && !a.dead && (a.team === team || PS.fog.sees(team, a.x, a.y)),
    explored: (team, x, y) => PS.fog.explored(team, x, y),
    get stamps() { return S.fogW ? Array.from(S.fogW.stamps) : null; },
    get lastCostMs() { return S.fogW ? +S.fogW.lastCostMs.toFixed(4) : 0; },
    get stats() { return S.fogS ? { ...S.fogS.stats, t: +S.t.toFixed(2) } : null; },
    get nofog() { return NOFOG; },
    get on() { return fogGate(); },
    // the player's view of each rival it sees now: visible agents, their centroid, the public live count
    rivals() { const out = []; if (!S.fogS) return out; for (let i = 2; i < S.teams.length; i++) { const t = S.teams[i], ob = S.fogS.obs[1][i]; if (t.alive && (ob.seen || !fogGate())) out.push({ id: i, name: t.name, n: ob.seen ? ob.n : t.count, x: ob.seen ? ob.x : t.cx, y: ob.seen ? ob.y : t.cy, count: t.count }); } return out; },
    // camps the player knows: seen with people (the live count where it sees them, else the last-seen one), or smoke rising within fog.smoke
    camps() {
      const out = [], pl = S.teams[1], sm = S.cfg.fog.smoke, g = fogGate();
      for (const c of S.camps) { const v = !g || PS.fog.sees(1, c.x, c.y), n = v ? c.n : c.kn[1]; if (n > 0) out.push({ x: c.x, y: c.y, n, visible: v }); else if (!v && c.n > 0 && pl && (c.x - pl.cx) * (c.x - pl.cx) + (c.y - pl.cy) * (c.y - pl.cy) <= sm * sm) out.push({ x: c.x, y: c.y, n: null, smoke: true }); }
      return out;
    },
    ghosts() { return S.fogS ? S.fogS.ghosts.map((g, r) => (g.on ? { team: r, x: Math.round(g.x), y: Math.round(g.y), n: g.n, age: +(S.t - g.t0).toFixed(2) } : null)).filter(Boolean) : []; },
    pings() { return S.fogS ? S.fogS.pings.filter((p) => p.on).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), rout: p.rout, age: +(S.t - p.t0).toFixed(2) })) : []; },
    leakCheck() { draw(); return fogGate() ? leakFrame() : { fog: false, nofog: NOFOG, diff: 0 }; },
    leakTotals() { return S.fogS ? { ...S.fogS.leak } : null; },
    structure() {
      const fs = PS.fog.fogSize, c = countFrame(10), U = PS.fog.ST;
      return { fogW: fs[0], fogH: fs[1], cssW: fs[2], cssH: fs[3], quarter: fs[0] <= Math.ceil(fs[2] / 4) && fs[1] <= Math.ceil(fs[3] / 4), layers: c.layers, drawImage: c.drawImage, uploads: U.uploads, forced: U.forced, uploadMs: +U.upMs.toFixed(2), uploadCells: U.cells, holes: PS.fog.RS.holes };
    },
    cost() {
      const n = Math.min(fcostN, FCOST.length), a = Array.from(FCOST.subarray(0, n)), FS = S.fogS, U = PS.fog.ST;
      const part = (k) => { const v = []; for (let i = 0; i < n; i++) v.push(FPART[i * 4 + k]); return { p50: pctA(v, 0.5), p90: pctA(v, 0.9), mean: n ? +(v.reduce((x, y) => x + y, 0) / n).toFixed(3) : 0 }; };
      return { frames: n, p50: pctA(a, 0.5), p90: pctA(a, 0.9), p99: pctA(a, 0.99), max: n ? +Math.max(...a).toFixed(3) : 0, last: +fogLastMs.toFixed(3), mean: n ? +(a.reduce((x, y) => x + y, 0) / n).toFixed(3) : 0,
        parts: { stamps: part(0), visibility: part(1), fogPass: part(2), tells: part(3) },
        stampMsPerTick: FS ? +(FS.simTotal / Math.max(1, FS.simTicks)).toFixed(4) : 0, stampMax: FS ? +FS.simMax.toFixed(3) : 0, uploads: U.uploads, forced: U.forced, uploadMs: +U.upMs.toFixed(2) };
    },
    resetCost() { fcostN = 0; FCOST.fill(0); FPART.fill(0); const FS = S.fogS; if (FS) { FS.simMs = 0; FS.simTotal = 0; FS.simTicks = 0; FS.simMax = 0; } const U = PS.fog.ST; U.uploads = 0; U.forced = 0; U.upMs = 0; U.cells = 0; return true; },
    crows: (x, y) => crows(x, y),
  };
  const AIQ = { assertKnowledge: () => (S.fogS ? { ...S.fogS.ai } : null) };

  // ---------------------------------------------------------------- QA: selfTest, fight + match harnesses, replay, bench
  // PS.fight / PS.simMatch / PS.replay / PS.bench swap a throwaway world into S and swap the live one back in a finally block, so a player
  // can call PS.selfTest() mid-match from the console. No localStorage, no DOM (sandbox guards), no sound, no live particles.
  const SANDBOX_KEYS = ["mode", "t", "timeLeft", "agents", "teams", "obstacles", "powerups", "camps", "cam", "input", "rng", "seed", "trickleT", "shake",
    "banners", "hintT", "stats", "engagedNow", "result", "decals", "trails", "attract", "difficulty", "spr", "tick", "acc", "map", "obs", "cap", "dbg",
    "finalCalled", "pendingEnd", "_routedBy", "_hintRecruit", "_hintFight", "_hintHud", "camS", "ev", "lastRout", "thinkRR", "flowW", "fixture",
    "fogW", "fogS", "fogOn", "frameId", "lastDrawT", "lastDrawSim"];
  let sbParticles = null, sbSmoke = null, flatMap = null; const sbSets = {};
  function withSandbox(fn) {
    if (sandbox) return fn(); // nested call shares the outer throwaway world
    const saved = {}; for (const k of SANDBOX_KEYS) saved[k] = k in S ? [S[k]] : null;
    const liveP = particles, liveF = floaters, liveSm = smokeP, liveSpr = S.spr;
    particles = sbParticles || (sbParticles = PS.Particles(200)); smokeP = sbSmoke || (sbSmoke = PS.Particles(120)); floaters = PS.Floaters(); sandbox = true;
    const spr = Object.create(liveSpr); spr.peasantSet = (c) => sbSets[c] || (sbSets[c] = liveSpr.peasantSet(c)); // one sprite build per colour, ever
    S.spr = spr; S.cam = { x: -1e5, y: -1e5, zoom: 1 }; S.camS = mkCamS(); S.fixture = null;
    S.input = mkInput();
    PS.audio.setSilent(true);
    try { return fn(); }
    finally {
      for (const k of SANDBOX_KEYS) { if (saved[k]) S[k] = saved[k][0]; else delete S[k]; }
      if (S.map) PS.terrain.use(S.map);
      PS.flow.use(S.flowW); PS.fog.use(S.fogW);
      particles = liveP; floaters = liveF; smokeP = liveSm; sandbox = false;
      PS.audio.setSilent(S.attract); // newGame/startGame keep silent === attract; the battle drum re-arms itself next frame if still engaged
      // lastFrame is left alone on purpose: the next rAF can carry a timestamp from before the test, and frame() clamps raw >= 0 anyway
    }
  }
  function sandboxField(map) {
    S.agents = []; S.obstacles = []; S.powerups = []; S.camps = []; S.banners = []; S.decals = []; S.trails = []; S.teams = [];
    S.map = map || flatMap || (flatMap = PS.terrain.flat()); PS.terrain.use(S.map); placeTables(S.map); bucketObstacles();
    S.flowW = PS.flow.use(PS.flow.reset(sbFlow, S.map));
    S.fogW = PS.fog.use(PS.fog.reset(sbFog, S.map, { learn: false })); S.fogS = mkFogS(); S.fogOn = false; // fog data runs; the view is unfogged unless a test sets fogOn
    S.cap = S.cfg.spawn.agentCap; S.dbg = { terrainBad: 0, firstBad: null, capOver: 0 }; S.tick = 0; S.acc = 0; S.ev = mkEv(); S.lastRout = null; S.thinkRR = 0; S.camS = mkCamS(); S.lastDrawSim = 0;
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
    S.fogW = PS.fog.use(PS.fog.reset(sandbox ? sbFog : liveFog, m, { learn: false })); S.fogS = mkFogS(); S.fogOn = false; // fixtures keep full knowledge and an unfogged view
    S.cap = cfg.spawn.agentCap; S.dbg = { terrainBad: 0, firstBad: null, capOver: 0 }; S.tick = 0; S.acc = 0; S.ev = mkEv(); S.lastRout = null; S.thinkRR = 0; S.camS = mkCamS();
    S.attract = false; S.difficulty = "normal"; S.t = 0; S.timeLeft = 1e9; S.trickleT = -1e9; S.shake = 0; S.result = null; S.engagedNow = false; S.finalCalled = true; S.pendingEnd = null; S._routedBy = null; S.lastDrawSim = 0;
    S._hintRecruit = S._hintFight = S._hintHud = true; S.seed = seed >>> 0; S.rng = mulberry32(S.seed); S.stats = { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0, fights: 0 };
    S.teams = [null, mkTeam(1, cfg.player.name, cfg.player.color, true, null)];
    cfg.ai.personalities.forEach((p, i) => S.teams.push(mkTeam(2 + i, p.name, p.color, false, p)));
    for (let i = 1; i < S.teams.length; i++) { S.teams[i].thinkT = 1e9; if (i > 1) S.teams[i].alive = false; }
    const inp = S.input; inp.route.on = false; inp.hold = false; inp.preview = 0;
    if (!sandbox) { groundInvalidate(m); minimapBake(true); }
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
  // hold (M2 critic MAJOR-1): fixtures.holdN of yours hold fixtures.holdAt px past the 64 px pass's exit (opts.at; negative = inside the pass)
  // against a fixtures.holdColumn Greedy swarm starting fixtures.holdStart px west of the entrance, bound fixtures.holdTarget px past the
  // exit. Runs until the holders break or fixtures.holdSeconds. Reports how long they lasted from first contact, their kills before they
  // broke, and which side broke first. Bar: they last 8 s and kill 8 before breaking (a column that breaks first counts as held).
  function fxHold(seed, opts) {
    const FX = S.cfg.fixtures, m = fixtureMap("pass64"), g = passGeom("pass64"); fixtureBase(m, seed);
    const hold = S.teams[1], col = S.teams[2], hx = g.x1 + (opts.at != null ? opts.at : FX.holdAt), tx = g.x1 + FX.holdTarget; col.alive = true;
    blob(g.x0 - FX.holdStart - blobR(FX.holdColumn), g.cy, FX.holdColumn, 2); blob(hx, g.cy, FX.holdN, 1); settle(hold); settle(col);
    let contact = -1, broke = -1, killsAtBreak = -1, first = null, firstRout = null;
    return { name: "hold", drive() {
      if (contact < 0 && hold.engT[2] > 0) contact = S.t;
      if (S.lastRout && !firstRout) { firstRout = S.lastRout; first = S.lastRout.loser === 1 ? "holders" : "column"; }
      if (broke < 0 && S.lastRout && S.lastRout.loser === 1) { broke = S.t; killsAtBreak = S.stats.kills; }
      hold.tx = hx; hold.ty = g.cy; hold.mode = "hold"; hold.route = false; col.tx = tx; col.ty = g.cy; col.route = true;
    }, done: () => broke >= 0 || S.t >= FX.holdSeconds || !hold.alive, result: () => {
      const lasted = contact < 0 ? 0 : (broke >= 0 ? broke : S.t) - contact, kills = broke >= 0 ? killsAtBreak : S.stats.kills;
      return { fixture: "hold", at: opts.at != null ? opts.at : FX.holdAt, holders: FX.holdN, column: FX.holdColumn, mode: S.cfg.combat.localMode, contact: +contact.toFixed(2), lasted: +lasted.toFixed(2), killsBeforeBreak: kills,
        firstBreak: first || "none", firstRout, holdersLeft: hold.count, columnLeft: col.count, seconds: +S.t.toFixed(2), pass: contact >= 0 && (first === "column" || (lasted >= 8 && kills >= 8)) };
    } };
  }
  // remnant (M2 critic MAJOR-2): fixtures.remnantWin v fixtures.remnantLose on the flat field, both charging. At the rout the winner turns AI
  // (thinking, past the grace period) when it has a personality, else (your swarm) it chases the remnant's centroid every tick, as does any
  // winner under opts.chase; the loser keeps its target on the winner (a player whose cursor stays on the enemy). The distance from the
  // remnant's centroid to the winner's, each second of fixtures.remnantSeconds. Bar: it reaches 350 px within the window.
  function fxRemnant(seed, opts) {
    const FX = S.cfg.fixtures, W = S.cfg.world.w, H = S.cfg.world.h; fixtureBase(flatMap || (flatMap = PS.terrain.flat()), seed);
    const lp = opts.loser !== "ai", L = S.teams[lp ? 1 : 2], Wn = S.teams[lp ? 2 : 1]; S.teams[2].alive = true; S.t = S.cfg.ai.gracePeriod;
    blob(W / 2 - 30 - blobR(FX.remnantLose), H / 2, FX.remnantLose, L.id); blob(W / 2 + 30 + blobR(FX.remnantWin), H / 2, FX.remnantWin, Wn.id); settle(L); settle(Wn);
    let R = null, t0 = -1, next = 1, rx = 0, ry = 0, rn = 0; const dist = [], states = [];
    const rem = () => { rn = 0; rx = 0; ry = 0; for (const a of S.agents) if (a.team === L.id && !a.dead && a.escapeT > 0) { rn++; rx += a.x; ry += a.y; } if (rn) { rx /= rn; ry /= rn; } };
    return { name: "remnant", drive() {
      if (!R && S.lastRout) { R = S.lastRout; t0 = S.t; if (Wn.ai && !opts.chase) Wn.thinkT = 0; }
      rem();
      if (R && rn && S.t - t0 >= next - 1e-9) { dist.push(Math.round(Math.hypot(rx - Wn.cx, ry - Wn.cy))); states.push(Wn.ai ? Wn.state + (Wn.preyId ? ":" + Wn.preyId : "") : "chase"); next++; }
      L.tx = Wn.cx; L.ty = Wn.cy; L.route = true;
      if (!R) { Wn.tx = L.cx; Wn.ty = L.cy; Wn.route = true; } else if (!Wn.ai || opts.chase) { if (rn) { Wn.tx = rx; Wn.ty = ry; } Wn.route = true; }
    }, done: () => (R && S.t - t0 >= FX.remnantSeconds) || S.t - S.cfg.ai.gracePeriod > 40, result: () => ({ fixture: "remnant", loser: lp ? "player" : "ai", winner: Wn.ai && !opts.chase ? "ai" : "chasing",
      rout: R ? { t: +(R.t - S.cfg.ai.gracePeriod).toFixed(2), group: R.group, flipped: R.flipped, fled: R.fled } : null, dist, maxDist: dist.length ? Math.max(...dist) : 0, winnerStates: states,
      escape: [Math.round(L.escGX), Math.round(L.escGY)], pass: dist.length > 0 && Math.max(...dist) >= 350 }) };
  }
  const FIXTURES = { pass64: (sd) => fxPass("pass64", sd), pass128: (sd) => fxPass("pass128", sd), ambush: (sd, o) => fxAmbush(sd, o || {}), flipflop: (sd, o) => fxFlipflop(sd, o || {}), cliff: (sd, o) => fxCliff(sd, o || {}),
    hold: (sd, o) => fxHold(sd, o || {}), remnant: (sd, o) => fxRemnant(sd, o || {}) };
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
    PS.audio.setSilent(true); // a fixture page has had no user gesture: its hits must not poke an AudioContext (M2 critic BLOCKER-1)
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
        leftHome: S.teams.slice(1).map((t) => t.leftHome), atCentre: S.teams.slice(1).map((t) => t.atCentre), ai: { ...S.fogS.ai }, fog: { ...S.fogS.stats } };
    });
  }

  // ---------------------------------------------------------------- QA: fog (SPEC-v2 §5, §13; M3 brief 10)
  // a fog-honest scripted player (QA only; the harness bot plays the same way through PS.vis): a visible rival under 0.7x yours, else the
  // nearest camp you know (seen with people, or smoke in range), else ground you have not explored on a ring toward the map centre
  function fogPolicy() {
    const p = S.teams[1]; if (!p || !p.count) return; let best = null, bd = Infinity;
    for (const r of VIS.rivals()) { const d = (r.x - p.cx) * (r.x - p.cx) + (r.y - p.cy) * (r.y - p.cy); if (r.count < 0.7 * p.count && d < bd) { bd = d; best = r; } }
    if (!best) for (const c of VIS.camps()) { const d = (c.x - p.cx) * (c.x - p.cx) + (c.y - p.cy) * (c.y - p.cy); if (d < bd) { bd = d; best = c; } }
    let tx = S.map.W / 2, ty = S.map.W / 2;
    if (best) { tx = best.x; ty = best.y; }
    else { const a0 = Math.atan2(ty - p.cy, tx - p.cx); for (let k = 0; k < 12; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, x = p.cx + Math.cos(a) * 600, y = p.cy + Math.sin(a) * 600; if (PS.terrain.walkable(x, y) && !PS.fog.explored(1, x, y)) { tx = x; ty = y; break; } } }
    p.tx = tx; p.ty = ty; p.mode = "route"; p.route = true; p.hyst = true;
  }
  // PS.fogMatch(60, { seed, drawEvery }): the real newGame path under fog, the fog-honest player, a frame drawn every drawEvery ticks with
  // the camera following, the leak check on every drawn frame. Returns leak totals, fog stats, stamp cost and the AI knowledge counters.
  function fogMatch(seconds, opts) {
    opts = opts || {};
    return withSandbox(() => {
      sandboxField(); S.difficulty = "normal"; newGame(false, { seed: opts.seed == null ? 31337 : opts.seed }); S.mode = "play"; S.fogS.leakOn = true;
      const every = opts.drawEvery || 8, w0 = performance.now(); let truncated = false, frames = 0, rivalFrames = 0;
      for (let i = 0; i < seconds * 60; i++) {
        if (i % 30 === 0) fogPolicy();
        update(DT); if (S.mode !== "play" || S.pendingEnd) break;
        if (i % every === 0) { draw(); frames++; if (S.fogS.leak.last && S.fogS.leak.last.rivalsDrawn > 0) rivalFrames++; }
        if ((i & 63) === 63 && performance.now() - w0 > (opts.wallMs || 9000)) { truncated = true; break; }
      }
      const L = S.fogS.leak, diff = L.hidden + L.missed + L.neutralsHidden + L.tagHidden + L.ringHidden + L.arrowHidden + L.miniHidden;
      return { seed: S.seed, seconds: +S.t.toFixed(2), frames, rivalFrames, leak: { ...L, last: undefined }, diff, stats: { ...S.fogS.stats }, ai: { ...S.fogS.ai }, count: S.teams[1].count,
        stampMsPerTick: +(S.fogS.simTotal / Math.max(1, S.fogS.simTicks)).toFixed(4), stampMax: +S.fogS.simMax.toFixed(3), explored: S.fogW.nExp[1], truncated, wallMs: Math.round(performance.now() - w0) };
    });
  }
  // a rival fog.* px past your sight edge: two rival swarms fight there, on screen (zoom pinned); nothing of theirs may be drawn, heard or
  // spawn particles, while the clash ping and its rumble do fire. reveal: the same scene with the fog lifted (the test's teeth).
  function hiddenRivalTest(reveal) {
    return withSandbox(() => {
      fixtureBase(flatMap || (flatMap = PS.terrain.flat()), 5); S.fogOn = true; S.fogS.reveal = !!reveal; S.mode = "play";
      const W = S.cfg.world.w, p = S.teams[1], a = S.teams[2], b = S.teams[3], x0 = W / 2 - 700, y0 = W / 2; a.alive = b.alive = true;
      blob(x0, y0, 20, 1); settle(p); const R = sightR(p), cx = x0 + R + 500, cy = y0; // the nearest rival agents start ~390 px past the sight edge and stay 280+ out while they fight
      blob(cx - 30 - blobR(30), cy, 30, 2); blob(cx + 30 + blobR(30), cy, 30, 3); settle(a); settle(b); fogStampAll();
      const A = PS.audio, keys = ["hit", "die", "rout", "recruit", "power", "eliminated", "rumble", "ping", "dangerHorn"], cnt = {}, orig = {}, pb = particles.burst, pr = particles.ring; let near = 0;
      const nearClash = (x, y) => Math.abs(x - cx) < 360 && Math.abs(y - cy) < 360;
      for (const k of keys) { cnt[k] = 0; orig[k] = A[k]; A[k] = function () { cnt[k]++; return orig[k].apply(A, arguments); }; }
      particles.burst = function (x, y) { if (nearClash(x, y)) near++; return pb.apply(this, arguments); }; particles.ring = function (x, y) { if (nearClash(x, y)) near++; return pr.apply(this, arguments); };
      let drawn = 0, tags = 0, arrows = 0, minD = 1e9, frames = 0; S.fogS.leakOn = true;
      try {
        for (let i = 0; i < 600; i++) {
          p.tx = x0; p.ty = y0; p.mode = "hold"; p.route = false; a.tx = b.cx; a.ty = b.cy; b.tx = a.cx; b.ty = a.cy;
          update(DT); S.cam.x = cx - 60; S.cam.y = cy; S.cam.zoom = 0.75; // the clash on screen on any viewport: v1's onScreen gate would show it
          if (i % 3 === 0) { draw(); frames++; for (const ag of S.agents) if ((ag.team === 2 || ag.team === 3) && ag.drawnF === S.frameId) drawn++; if (tagMask & 12) tags++; if (arrowMask & 12) arrows++; }
          for (const ag of S.agents) if (ag.team === 2 || ag.team === 3) { const d = Math.hypot(ag.x - p.cx, ag.y - p.cy) - sightR(p); if (d < minD) minD = d; }
        }
      } finally { for (const k of keys) A[k] = orig[k]; particles.burst = pb; particles.ring = pr; }
      const onScreen0 = onScreen(cx, cy), L = S.fogS.leak;
      return { reveal: !!reveal, frames, rivalsDrawn: drawn, tags, arrows, particlesNear: near, sounds: cnt, pings: S.fogS.stats.pings, minPastEdge: Math.round(minD), clashOnScreen: onScreen0, fights: S.ev.fights,
        leakDiff: L.hidden + L.missed + L.neutralsHidden + L.tagHidden + L.ringHidden + L.arrowHidden + L.miniHidden, layers: countFrame(3).layers };
    });
  }
  // AI knowledge (M3 brief 9): a big AI and a small one beyond each other's sight never hunt each other; walked into sight, the big one hunts
  function aiBlindTest() {
    return withSandbox(() => {
      fixtureBase(flatMap || (flatMap = PS.terrain.flat()), 9); S.t = S.cfg.ai.gracePeriod + 1; const W = S.cfg.world.w, big = S.teams[2], small = S.teams[3]; big.alive = small.alive = true;
      blob(W / 2, W / 2 + 1500, 3, 1); blob(W / 2 - 1300, W / 2, 60, 2); blob(W / 2 + 1300, W / 2, 12, 3); settle(S.teams[1]); settle(big); settle(small); big.thinkT = 0; small.thinkT = 1e9; fogStampAll(); // your 3 far off, out of everyone's sight
      let huntBlind = 0, huntSeen = -1, gapBlind = 1e9;
      for (let i = 0; i < 240; i++) { small.tx = W / 2 + 1300; small.ty = W / 2; small.route = true; update(DT); if (big.state === "hunt" && big.preyId === 3) huntBlind++; gapBlind = Math.min(gapBlind, Math.hypot(big.cx - small.cx, big.cy - small.cy)); }
      const dx = big.cx + 330 - small.cx, dy = big.cy - small.cy; for (const a of S.agents) if (a.team === 3) { a.x += dx; a.y += dy; } recount(); // carried into sight
      for (let i = 0; i < 180 && huntSeen < 0; i++) { small.tx = small.cx; small.ty = small.cy; small.route = true; update(DT); if (big.state === "hunt" && big.preyId === 3) huntSeen = +(i / 60).toFixed(2); }
      return { huntBlindTicks: huntBlind, closestWhileBlind: Math.round(gapBlind), huntAfterSighting: huntSeen, ai: { ...S.fogS.ai }, pass: huntBlind === 0 && huntSeen >= 0 && S.fogS.ai.violations === 0 };
    });
  }
  // dawn: at the bell the fog lifts over fog.dawnSeconds before the result screen, and everything is drawn
  function dawnTest() {
    return withSandbox(() => {
      sandboxField(); newGame(false, { seed: 4242 }); S.mode = "play"; S.timeLeft = 0.1; let t0 = -1, gateAtBell = null;
      for (let i = 0; i < 240 && S.mode === "play"; i++) { update(DT); if (t0 < 0 && S.fogS.dawnT0 >= 0) { t0 = S.t; gateAtBell = fogGate(); } }
      return { dawnT0: +S.fogS.dawnT0.toFixed(2), endAt: S.pendingEnd ? +S.pendingEnd.at.toFixed(2) : null, result: S.result, gateAfter: gateAtBell, pass: S.fogS.dawnT0 >= 0 && S.pendingEnd && S.pendingEnd.at - S.fogS.dawnT0 >= S.cfg.fog.dawnSeconds - 1e-6 && gateAtBell === false };
    });
  }
  // the fog mask is a cache: sampled against the typed arrays, dropped (blank), found by the draw loop's probe, re-put from the arrays
  function maskDropTest() {
    const w = S.fogW; if (!w) return { pass: false, why: "no fog world" };
    PS.fog.flushMask(true); const pts = [], N = PS.fog.N, cell = S.map.cell, ex = w.explored[1];
    for (let c = 0; c < N * N && pts.length < 6; c += 97) if (ex[c]) pts.push([((c % N) + 0.5) * cell, (((c / N) | 0) + 0.5) * cell]);
    for (let c = 0; pts.length < 12 && c < N * N; c += 131) if (!ex[c]) pts.push([((c % N) + 0.5) * cell, (((c / N) | 0) + 0.5) * cell]);
    const want = pts.map(([x, y]) => PS.fog.dispAt(x, y)), before = PS.fog.maskAlphaAt(pts), dropped = PS.fog.drop(), blank = PS.fog.minAlpha4(PS.fog.maskCanvas), probed = cacheProbe(0, 0, 0, 0, true), after = PS.fog.maskAlphaAt(pts);
    const same = (a) => a.every((v, i) => Math.abs(v - want[i]) <= 2);
    return { points: pts.length, explored: pts.filter((p, i) => want[i] < 200).length, want, before, after, dropped, blankAfterDrop: blank, probed, pass: pts.length >= 6 && same(before) && blank === 0 && probed && same(after) };
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
  // opts.fog: "on" (default: the player's fog as in a match), "reveal" (the fog layer composed but every agent drawn), "off" (no fog layer)
  function bench(scene, opts) {
    // opts.flush (or window.__benchFlush): end every timed frame with a 1 px read of the main canvas, so each frame's draw time includes the
    // raster Chrome would do at that frame's end; without it a synchronous loop lets the canvas batch several frames into one flush and
    // draw p90 measures the batching (M3 notes). The reference build is benched with the same one-line change.
    opts = opts || {}; scene = scene || "capclash"; const fogMode = opts.fog || "on", flush = !!(opts.flush || window.__benchFlush);
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
        S.fogOn = fogMode !== "off"; S.fogS.reveal = fogMode === "reveal";
        const zoom = S.vw < cfg.camera.mobileBreak ? cfg.camera.zoomMobile : cfg.camera.zoomDesktop, L0 = benchLayout(0, 0, per, zoom, () => true), pad = blobR(per) + 24;
        const c = benchSpot(benchMap, S.vw / zoom, S.vh / zoom, L0.blobs.map((b) => [b[0] - pad, b[1] - pad, b[0] + pad, b[1] + pad])), cx = c.x, cy = c.y;
        const L = benchLayout(cx, cy, per, zoom, (x, y) => PS.terrain.placementOk(x, y, 1));
        for (const b of L.blobs) blob(b[0], b[1], per, b[2]);
        for (const q of L.camps) spawnCamp(q[0], q[1], 5);
        recount(); for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; t.pcx = t.cx; t.pcy = t.cy; }
        fogStampAll();
        const T = S.teams, pin = () => { S.cam.x = cx; S.cam.y = cy; S.cam.zoom = zoom; S.shake = 0; };
        benchTick = () => { T[1].tx = T[2].cx; T[1].ty = T[2].cy; T[2].tx = T[1].cx; T[2].ty = T[1].cy; T[3].tx = T[4].cx; T[3].ty = T[4].cy; T[4].tx = T[3].cx; T[4].ty = T[3].cy; update(DT); pin(); };
        pin(); flushGround(benchMap);
        const up = [], dr = [], fg = []; let fl0 = null, st0 = 0, stN0 = 0, drawnSum = 0;
        for (let i = 0; i < warm + ticks; i++) {
          if (i === warm) { fl0 = PS.flow.stats; st0 = S.fogS.simTotal; stN0 = S.fogS.simTicks; }
          const a = performance.now(); benchTick(); const b = performance.now(); draw(); if (flush) ctx.getImageData(0, 0, 1, 1); const e = performance.now();
          if (i >= warm) { up.push(b - a); dr.push(e - b); fg.push(fogLastMs); drawnSum += S.drawList.length; }
          if (e - w0 > 12000) break; // lesson 20
        }
        const fl1 = PS.flow.stats, flow = { rebuilds: fl1.rebuilds - fl0.rebuilds, ms: +(fl1.costMs - fl0.costMs).toFixed(2), msPerTick: +((fl1.costMs - fl0.costMs) / Math.max(1, up.length)).toFixed(3), maxMs: fl1.maxCostMs, decisions: fl1.decisions };
        const cnt = countFrame(10);
        let onScreen = 0; const z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z; for (const a of S.agents) if (Math.abs(a.x - S.cam.x) < hw && Math.abs(a.y - S.cam.y) < hh) onScreen++;
        const mean = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3);
        const fog = { mode: fogMode, p50: pct(fg, 0.5), p90: pct(fg, 0.9), p99: pct(fg, 0.99), mean: fg.length ? +(fg.reduce((x, y) => x + y, 0) / fg.length).toFixed(3) : 0, stampMsPerTick: +((S.fogS.simTotal - st0) / Math.max(1, S.fogS.simTicks - stN0)).toFixed(4), holes: PS.fog.RS.holes, drawnPerFrame: Math.round(drawnSum / Math.max(1, fg.length)) };
        return { scene, build: "v2", fog, flush, ticks: up.length, agents: S.agents.length, onScreen, counts: S.teams.slice(1).map((t) => t.count), camps: L.camps.length + "/" + L.want, viewport: [S.vw, S.vh, S.dpr], zoom,
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
    "combat.localMode:s combat.remnant.escapeReplan:n combat.remnant.escapeDistance:n input.hintAfterRouteMs:n fixtures.holdN:n fixtures.holdColumn:n fixtures.holdStart:n fixtures.holdTarget:n fixtures.holdAt:n fixtures.holdSeconds:n " +
    "fixtures.remnantWin:n fixtures.remnantLose:n fixtures.remnantSeconds:n " +
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
    "fog.bucket:n fog.playerStampTicks:n fog.displayCell:n fog.displayPad:n fog.exploreMargin:n fog.unexploredAlpha:n fog.exploredAlpha:n fog.unexploredColor:s fog.exploredColor:s " +
    "fog.softBand:n fog.phoneBand:n fog.holeVignette:n fog.holeVigStart:n fog.maskHz:n fog.canvasScale:n fog.maxPixels:n fog.fadeSeconds:n fog.obsSmooth:n fog.cloudTile:n fog.cloudSpeed:n fog.cloudAlpha:n fog.vignetteAlpha:n " +
    "fog.vignetteInner:n fog.vignetteOuter:n fog.glowAlpha:n fog.glowPulse:n fog.glowRate:n fog.glowInner:n fog.glowOuter:n fog.smoke:n fog.beacon:n fog.clashNoise:n fog.pingSeconds:n " +
    "fog.pingMerge:n fog.dust:n fog.dustMin:n fog.dustOffset:n fog.dustEvery:n fog.ghostSeconds:n fog.miniGhostSeconds:n fog.danger:n fog.dangerEvery:n fog.dangerJitter:n fog.dangerShow:n " +
    "fog.crows:n fog.edgeMax:n fog.verdictSeconds:n fog.verdictStronger:n fog.verdictWeaker:n fog.dawnSeconds:n fog.minimapHz:n fog.aiMemory:n fog.aiFleeMemory:n fog.aiLeadMax:n " +
    "fog.exploreRing.0:n fog.exploreRing.1:n fog.exploreSamples:n fog.exploreCommit:n " +
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
    if (cfg.combat && ["fighting", "radius"].indexOf(cfg.combat.localMode) < 0) missing.push("combat.localMode (fighting | radius)");
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
      S.camps.length, S.powerups.map((p) => [p.x, p.y, p.alive, p.kind]), S.trickleT, S.shake, S.engagedNow, S.input.huddle, S.input.joy.active, S.hintT, S.ev, S.thinkRR, PS.flow.stats && PS.flow.stats.rebuilds,
      PS.fog.sig(), S.fogS ? [S.fogS.stats.sightings, S.fogS.stats.ghosts, S.fogS.ai.decisions, S.fogS.ai.violations] : null]);
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
    const all = ["config", "sprites", "terrain", "caches", "flow", "fight", "fixtures", "flipflop", "ai", "fog", "replay", "match"];
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
      const r64 = mx[4]; check("fight_60v40_remnant", r64.playerWins >= 2 && r64.fled > 0, { wins: r64.playerWins, fled: r64.fled, seconds: r64.seconds }); // M2 critic MAJOR-1: the break rule keeps a remnant
      check("fight_30v20_4to7s", f.seconds >= 4 && f.seconds <= 7, { seconds: f.seconds, mode: S.cfg.combat.localMode });
    });
    if (has("fixtures")) timed("fixtures", () => {
      const a = fixture("pass64"), b = fixture("pass128"), c = fixture("ambush"), FX = S.cfg.fixtures;
      c.spec = [fixture("ambush", { wait: FX.ambushSpecWait }), fixture("ambush", { wait: FX.ambushSpecWait, blob: true })].map((r) => ({ variant: r.variant, waiting: r.waiting, loser: r.loser, t: r.rout && r.rout.t, flipped: r.headFlipped, fled: r.fled, columnAfter: r.columnAfter }));
      check("fixture_pass64", a.through != null && a.through <= 8 && a.regroup >= 0.9 && !a.terrainBad && !a.truncated, a);
      check("fixture_pass128", b.through != null && b.through <= 6 && b.regroup >= 0.9 && !b.terrainBad && !b.truncated, b);
      check("fixture_ambush_head_only", c.pass && !c.terrainBad, c);
      // M2 critic MAJOR-1 and MAJOR-2
      const h = [fixture("hold"), fixture("hold", { at: -40 })]; check("fixture_hold_pass", h.every((r) => r.pass && !r.terrainBad && !r.truncated), h.map((r) => ({ at: r.at, lasted: r.lasted, kills: r.killsBeforeBreak, firstBreak: r.firstBreak, holdersLeft: r.holdersLeft, columnLeft: r.columnLeft })));
      const rm = [fixture("remnant"), fixture("remnant", { chase: true }), fixture("remnant", { loser: "ai" })];
      check("fixture_remnant_escape", rm[0].pass && !rm[0].terrainBad, rm.map((r) => ({ loser: r.loser, winner: r.winner, dist: r.dist, winnerStates: r.winnerStates, pass: r.pass })));
    });
    if (has("flipflop")) timed("flipflop", () => {
      const r = fixture("flipflop"), base = fixture("flipflop", { noHyst: true });
      check("fixture_flipflop", S.cfg.input.desktopMode !== "route" || (r.pass && !r.terrainBad), { route: r, noHysteresis: base, desktopMode: S.cfg.input.desktopMode });
    });
    if (has("ai")) timed("ai", () => {
      const runs = [0, 1, 2].map((k) => simMatch(60, { seed: 5150 + k * 7919, wallMs: 4000 }));
      check("ai_leave_home_40s", runs.every((r) => !r.truncated && r.leftHome.every((t) => t >= 0 && t <= 40)), runs.map((r) => ({ seed: r.seed, names: r.names, leftHome: r.leftHome, atCentre: r.atCentre, counts: r.timeline[r.timeline.length - 1].counts, ev: r.ev, ai: r.ai, truncated: r.truncated, wallMs: r.wallMs })));
      check("ai_knowledge_assert", runs.every((r) => r.ai.violations === 0 && r.ai.decisions > 0), runs.map((r) => r.ai)); // no AI targeted a swarm or camp it had not seen (M3 brief 9)
      const bl = aiBlindTest(); check("ai_blind_to_hidden", bl.pass, bl);
    });
    if (has("fog")) timed("fog", () => {
      const sr = withSandbox(() => { fixtureBase(flatMap || (flatMap = PS.terrain.flat()), 3); S.fogOn = true; const W = S.cfg.world.w; blob(W / 2 + 16, W / 2 + 16, 1, 1); settle(S.teams[1]); fogStampAll(); const x = S.teams[1].cx, y = S.teams[1].cy, R = sightR(S.teams[1]);
        return { R, at: [R - 30, R + 40].map((d) => PS.fog.sees(1, x + d, y)), cost: +S.fogW.lastCostMs.toFixed(4) }; });
      check("fog_sight_radius", sr.at[0] && !sr.at[1], sr);
      const fm = fogMatch(60, { seed: 31337 }); check("fog_leak_60s", fm.diff === 0 && fm.frames >= 100 && !fm.truncated && fm.ai.violations === 0, fm);
      check("fog_stamp_cost", fm.stampMsPerTick <= 0.1, { stampMsPerTick: fm.stampMsPerTick, stampMax: fm.stampMax, explored: fm.explored });
      const hr = hiddenRivalTest(false), hc = hiddenRivalTest(true), snd = (r) => r.sounds.hit + r.sounds.die + r.sounds.rout + r.sounds.recruit + r.sounds.power;
      check("fog_hidden_rival_silent", hr.fights > 0 && hr.minPastEdge >= 280 && hr.rivalsDrawn === 0 && hr.tags === 0 && hr.arrows === 0 && hr.particlesNear === 0 && snd(hr) === 0 && hr.pings > 0 && hr.sounds.rumble > 0 && hr.leakDiff === 0,
        { fog: hr, control: hc, controlHasTeeth: hc.rivalsDrawn > 0 && snd(hc) > 0 && hc.particlesNear > 0 });
      check("fog_structure", hr.layers === 1 && PS.fog.fogSize[0] <= Math.ceil(S.vw / 4) && PS.fog.fogSize[1] <= Math.ceil(S.vh / 4), { layers: hr.layers, fog: PS.fog.fogSize, css: [S.vw, S.vh], scale: S.cfg.fog.canvasScale });
      const md = maskDropTest(); check("fog_mask_reput_after_drop", md.pass, md);
      const dw = dawnTest(); check("fog_dawn", dw.pass, dw);
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
