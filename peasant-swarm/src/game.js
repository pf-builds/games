// Peasant Swarm — core simulation + render. Click it! Studios, 2026.
// Boids swarm routed by per-team flow fields (src/flow.js) on seeded terrain (src/terrain.js), local combat with a local rout and a
// fleeing remnant, AI rivals that play under the same fog of war as you (src/fog.js), power-ups, spoils (src/spoils.js: relics, chests, villages, bandit camps). All tuning in config.json.
(function () {
  const PS = (window.PS = window.PS || {});
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const DT = 1 / 60; // the sim only ever advances in fixed 1/60 s ticks (SPEC-v2 §3)
  const QS = new URLSearchParams(location.search);
  const urlSeed = QS.has("seed") && QS.get("seed") !== "" && isFinite(+QS.get("seed")) ? +QS.get("seed") >>> 0 : null; // ?seed=N replays a match
  const capParam = QS.get("cap"); // ?cap=touch|desktop forces an agent cap (the harness runs both)
  const POSTER = QS.get("poster") === "1"; // ?poster=1 stages the arcade card / portal cover scene (M7): no HUD, no fog, the logo only
  const fixtureParam = QS.get("fixture"); // ?fixture=pass64|pass128|ambush|flipflop|cliff runs a QA fixture live instead of the title
  let NOFOG = QS.get("nofog") === "1"; // ?nofog=1 renders everything (v1-style gating) while the fog data model keeps running; ?debug=1 toggles it live (M7)

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- state
  // input: mouse cursor (px, py, active), keys (kbd: the keys have the swarm; the cursor sleeps until it moves input.mouseWakePx from kx0/ky0), the touch pointer (tp: tap / drag / hold), the floating joystick, a second finger (hud2),
  // the tapped/clicked/minimap route (route; chase = a rival team id), the hold flag and the route preview timer (frame time)
  const mkInput = () => ({ px: 0, py: 0, active: false, huddle: false, keys: {}, kbd: false, kx0: 0, ky0: 0, touch: false, hold: false, preview: 0, hud2: -1,
    joy: { active: false, id: -1, ox: 0, oy: 0, cx: 0, cy: 0, mag: 0, dx: 0, dy: 0 },
    tp: { active: false, id: -1, sx: 0, sy: 0, t0: 0, drag: false, hold: false },
    route: { on: false, x: 0, y: 0, chase: 0, src: "", sx: 0, sy: 0 }, routeT: -1e9 }); // routeT: wall time of the last tap / click / minimap route (hint spacing)
  const mkCamS = () => ({ i: -1, steps: null, from: 1, t: 0, lx: 0, ly: 0 }); // zoom step index + ease, smoothed look-ahead
  // every team's engagements, routs, remnants formed, finale scatters; M4 pacing: first fight (any pair / the player), first sighting by any
  // swarm, eliminations [t, team], the horn's leader and swarms alive then, swarms alive at 1:00 / 2:00 / 3:00, pile-ons, scent pings, crown
  // moves, trickle camps (and how many went to one of the two smallest swarms)
  const mkEv = () => ({ fights: 0, routs: 0, remnants: 0, scattered: 0, firstFight: -1, firstPlayerFight: -1, firstSightAny: -1, elims: [], hornLeader: 0, hornAlive: 0,
    alive60: 0, alive120: 0, alive180: 0, pileOns: 0, scentPings: 0, crownMoves: 0, trickle: 0, trickleFav: 0,
    gains: [], taken: [], drops: 0, trickleChests: 0, tiers60: null, tiers180: null, tiers300: null }); // M6: tier gains [t, team, axis, tier, source], objectives taken [t, team, type], tiers at 1:00 / 3:00 / 5:00
  // heard noise (SPEC-v2 §7): the clashes going on now, a fixed pool; each AI hears one within its difficulty's hearing radius
  const mkNoise = () => { const a = []; for (let i = 0; i < 16; i++) a.push({ on: false, a: 0, b: 0, x: 0, y: 0, t0: -1e9, t1: -1e9 }); return a; };
  // the finale crown (the biggest swarm, position broadcast every finale.crownEvery s), the pile-on flag, Bully's scent pings
  const mkCrown = () => ({ team: 0, x: 0, y: 0, t: -1e9, next: 0, marked: false });
  const mkPile = () => ({ id: 0, bannerT: -1e9 });
  const mkScent = () => ({ next: 0, n: 0, x: 0, y: 0, t: -1e9 });
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
    noise: mkNoise(), crown: mkCrown(), pile: mkPile(), scent: mkScent(), relaxUntil: -1e9, torches: false, aiPlayer: false, // M4: rivals and match (SPEC-v2 §7, §9)
    aiCost: { ms: 0, thinks: 0, ticks: 0, max: 0 }, // AI think script time (the < 0.1 ms per tick gate)
    dprCap: 2, zDpr: 1, dprHot: 0, scriptP90: 0, // M7: adaptive DPR tier, the zoom table's DPR, seconds over the p90 line, the live p90 script ms
    objs: [], bandits: [], spT: 0, // M6 spoils (src/spoils.js): every objective, the bandit camps among them (never in S.teams), the trickle-chest timer
  };
  if (S.debug || POSTER) window.PSS = S; // (the harness reads the staged poster scene through it too)

  const canvas = $("game"), ctx = canvas.getContext("2d");
  const mini = $("minimap"), mctx = mini.getContext("2d");
  let particles, floaters, smokeP, sandbox = false; // sandbox: PS.fight / PS.simMatch are running a throwaway world, so DOM side effects are skipped
  let liveFlow = null, sbFlow = null; // flow-field worlds (src/flow.js): one for the live game, one reused by every sandbox
  let liveFog = null, sbFog = null; // fog worlds (src/fog.js), same split
  let SPL = null; // spoils (src/spoils.js), bound once in boot() with the hooks it needs (spoilsHooks)
  let SCR = null; // screens (src/title.js): the painted title, win and lose staging (M7)

  // ---------------------------------------------------------------- setup
  const portal = (ev) => (PS.portal ? PS.portal.call(ev) : Promise.resolve()); // src/portal.js: a no-op unless ?portal=crazygames|poki
  async function boot() {
    try { await portal("init"); } catch (e) {} portal("loadingStart");
    const res = await fetch("config.json?v=33");
    S.cfg = await res.json(); PS.audio.configure(S.cfg.audio);
    S.spr = PS.buildSprites(S.cfg);
    SPL = PS.Spoils(spoilsHooks()); SCR = PS.Screens(S.cfg);
    PS.terrain.init(S.cfg); PS.flow.init(S.cfg); PS.fog.init(S.cfg);
    liveFlow = PS.flow.world(); sbFlow = PS.flow.world(); liveFog = PS.fog.world(); sbFog = PS.fog.world();
    hashAlloc();
    particles = PS.Particles(1400);
    smokeP = PS.Particles(320); // drawn above the fog: campfire smoke and crows (SPEC-v2 §5 tells)
    floaters = PS.Floaters();
    PS.vis = VIS; PS.ai = AIQ;
    PS.selfTest = selfTest; PS.fight = fight; PS.simMatch = simMatch; PS.bench = bench; PS.replay = replay; // QA hooks, always on and side-effect free (see QA section)
    PS.debugDropCaches = debugDropCaches; PS.cacheReport = cacheReport; PS.recheckCaches = recheckCaches; PS.cacheProbe = cacheProbe;
    PS.fixture = fixture; PS.clashRead = clashRead; PS.fogMatch = fogMatch; PS.audioScene = audioScene;
    resize();
    window.addEventListener("resize", resizeSoon);
    if (S.debug) document.body.classList.add("debug");
    bindInput();
    bindUI();
    if (fixtureParam && FIXTURES[fixtureParam]) startFixtureLive(fixtureParam); else newGame(true);
    schedule(); portal("loadingStop");
    if (S.debug || POSTER) { // (poster mode stages its scene with the same sim hooks)
      // hidden-tab fallback clock: rAF starves there, and only there (M1 critic MAJOR-1: a visible tab's stall must drop time, never
      // catch up 8 ticks). Never registers a second rAF (see schedule()).
      setInterval(() => { if (document.hidden && performance.now() - lastFrame > 60) frame(performance.now(), true); }, 33);
      // synchronous sim advance for automated critics: PS.step(5) = 5 sim-seconds, no rendering
      PS.step = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (S.mode !== "play") break; update(DT); if (S.mode !== "play") break; particles.update(DT); smokeP.update(DT); floaters.update(DT); } updateHUD(true); return S.result || S.mode; };
      PS.timeStep = (sec) => { const t0 = performance.now(); PS.step(sec); return (performance.now() - t0) / (sec * 60); };
      // scripted control for critics and the harness bot: route the player to (x, y) through its field, as a cursor-follow target
      PS.aim = (x, y) => { const inp = S.input, p = S.teams[1]; inp.route.on = false; inp.hold = false; inp.active = false; inp.joy.active = false; if (!p) return null; p.tx = x; p.ty = y; p.mode = "route"; return p.mode; };
      // QA: start a live match without the title click. { seed, difficulty, aiPlayer } (aiPlayer: all six swarms AI, the harness's pacing matches)
      PS.debugStart = (o) => { o = o || {}; if (o.difficulty && S.cfg.difficulty[o.difficulty]) S.difficulty = o.difficulty; PS.audio.setSilent(true); newGame(false, { seed: o.seed, aiPlayer: !!o.aiPlayer }); S.mode = "play"; S._hintFight = S._hintHud = S._hintRecruit = S._hintFog = true; S._hintRelic = S._hintRem = 2; S._routedBy = null; showOverlay(null); $("hud").classList.remove("hidden"); layoutHUD(); updateHUD(true); return { seed: S.seed, difficulty: S.difficulty, slots: S.teams.slice(1).map((t) => t.slot) }; };
      PS.pacing = pacing;
      PS.cfgOverride = cfgOverride; // M8 sweeps (SPEC-v2 §13)
      PS.artScene = artScene;
      PS.spoilsQA = { villageTest, banditTest, banditCost, heavyTest, musterTest, dropTest, aiSpoilsTest, parityTest, placement: spoilsPlacement, SP: () => SPL }; // debug: the M6 checks one by one
    }
    if (POSTER) posterStage(); // after the sim hooks it stages with (PS.step, PS.aim)
  }

  // S.dprCap: the adaptive DPR tier (SPEC-v2 §13: 2 -> 1.5 -> 1, stepping down only, frameCost()); S.zDpr: the DPR the zoom step table was
  // picked for, which follows S.dpr only outside a match (a mid-match step-down keeps its zoom steps; re-quantised at the next match start)
  function resize() {
    S.dpr = Math.min(S.dprCap, window.devicePixelRatio || 1);
    S.vw = window.innerWidth; S.vh = window.innerHeight;
    const w = Math.round(S.vw * S.dpr), h = Math.round(S.vh * S.dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } // the one main canvas, resized in place
    if (S.mode !== "play" && S.mode !== "pause") S.zDpr = S.dpr;
    zoomRule(S.teams[1] ? S.teams[1].count : 1, 0, true); // the zoom step for this viewport, at once
    PS.fog.resize(S.vw, S.vh); // one quarter-CSS fog canvas, reused: it also carries the vignette and the losing-clash glow (SPEC-v2 §5)
    layoutHUD();
  }
  let resizeT = 0; const resizeSoon = () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 100); }; // iOS rule: resize debounced 100 ms (layout only, never game state)

  // ---------------------------------------------------------------- world gen
  // every field an agent will ever carry is set here, v2 placeholders included (C2: agents that grow fields later ran 6x slower)
  function mkAgent(x, y, team) {
    const R = S.rng;
    // the neighbour loop reads x, y, team, dead and escapeT of hundreds of agents per agent: keep them first (one cache line)
    return { x, y, team, dead: false, escapeT: 0, vx: 0, vy: 0, hp: S.cfg.agent.hp, atk: R() * 0.5, tgt: null,
      ph: R() * 10, face: R() < 0.5 ? 1 : -1, fl: 0, lunge: 0, wx: x, wy: y, hx: x, hy: y, fight: false, r: S.cfg.agent.radius, pop: 9, camp: null,
      rec: 0, seenA: 0, seenT: -1e9, drawnF: 0, ex: 0, ey: 0, groupId: 0, rd: 0, fieldT: 0, fdx: 0, fdy: 0, fok: 0, strag: 0, gar: false, exr: false, pk: -1, wT: -1, wTeam: 0 }; // strag: left behind terrain, it follows the field (P1); wT / wTeam: the rout wave (M7, render only: until sim time wT it is drawn hands up in team wTeam); pk: its slot in the packed hash this tick (M7); gar: a village garrison inside its palisade (M6); exr: a scattered ex-rival (no muster credit)
  }
  const z9 = () => [0, 0, 0, 0, 0, 0, 0, 0, 0]; // team-indexed arrays: neutral 0, player 1, rivals 2-6, spare 7, bandits 8 (SPEC-v2 §6)
  // route: the team steers by its flow field (else direct seek); mode (player): "route" | "steer" | "hold"; hyst: route hysteresis applies;
  // ax/ay: the anchor (centroid snapped to walkable, for AI and labels); tMed: last tick's median path distance (path cohesion); fv / fvTick:
  // its field's version and the tick it last changed (P1: the straggler band reads tMed once the field has held 2 ticks); stragN (its stragglers
  // last tick), blockT (sim time one of its direct-seeking agents last pushed into rock) and wantField (the player's field without a route).
  // AI under fog: preyId (the team it hunts, 0 none), exX/exY/exUntil (an explore target and its commit time).
  // M4: kind (personality), senses (sense: sight multiplier, mem: hunt memory s, hear: hearing px), lastFight (sim time it last fought),
  // scentX/Y/T (Bully's last scent ping), leaveUntil (Wary leaving a clash), lurkX/Y/lurkUntil/lurkCool/crowsT (Sly), claimX/Y/claimOn/claimEmpty (Stubborn).
  // Per enemy slot j: eng (agents fighting j this tick) with fX/fY (their position sums), engT (engaged time), engL (smoothed local
  // strength), engPk (its peak this engagement), engHold (time under breakRatio), engCx/engCy (contact centroid), engStart (count at start),
  // engG / engGPk (fighting mode: the rout group's survivors and their peak this engagement)
  // M6 (src/spoils.js): tier {arms, boots, horn}, mustered (neutrals recruited) and musterK (milestones passed), and the stats the tiers set:
  // hpMax, atkMul, power (count x power in every ratio), spdMul, fordMul, recR (recruit radius)
  function mkTeam(id, name, color, isPlayer, ai) {
    const t = { id, name, color, isPlayer, ai, tier: null, mustered: 0, musterK: 0, tierN: 0, hpMax: 0, atkMul: 1, power: 1, spdMul: 1, fordMul: 1, recR: 0, count: 0, _sx: 0, _sy: 0, cx: 0, cy: 0, ax: 0, ay: 0, tx: 0, ty: 0, vx: 0, vy: 0, pcx: 0, pcy: 0, spd: 0, slot: -1, alive: true,
      route: true, mode: "route", hyst: false, tMed: 0, fv: -1, fvTick: 0, stragN: 0, blockT: -1e9, wantField: false,
      buffs: { speed: 0, armor: 0, frenzy: 0, rally: 0 }, eng: z9(), engT: z9(), engStart: z9(), engL: z9(), engPk: z9(), engHold: z9(), engCx: z9(), engCy: z9(), fX: z9(), fY: z9(),
      engG: z9(), engGPk: z9(),
      spr: S.spr.peasantSet(color, id), ban: S.spr.banner(color, id), kills: 0, peak: 1, state: "roam", speedMod: 1, thinkT: S.rng() * 0.5, lastHint: 0, minY: 0, huntStart: 0, huntCooldown: 0,
      regroupUntil: 0, fleeFrom: 0, leftHome: -1, atCentre: -1, preyId: 0, exX: 0, exY: 0, exUntil: -1, escUntil: -1, escFrom: 0, escReplanAt: 0, escGX: 0, escGY: 0,
      kind: ai ? ai.kind || "" : "", sense: 1, mem: S.cfg.fog.aiMemory, hear: S.cfg.fog.clashNoise, lastFight: -1e9, scentX: 0, scentY: 0, scentT: -1e9, leaveUntil: -1e9,
      lurkX: 0, lurkY: 0, lurkUntil: -1e9, lurkCool: 0, crowsT: -1e9, claimX: 0, claimY: 0, claimOn: false, claimEmpty: 0 };
    SPL.initTeam(t); return t;
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
  const placeOk = (x, y, minSdfCells, pad) => PS.terrain.placementOk(x, y, minSdfCells) && farFromObstacles(x, y, pad) && !SPL.blocks(x, y); // M6: never in a bandit camp's reach or a village ring
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
    const camp = { x, y, n, smokeT: S.rng() * 0.8, kn: new Int16Array(9).fill(-1) }; // kn[team]: the head-count that team last saw here (-1 never); n: recounted per tick
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
    S.agents.length = 0; S.obstacles.length = 0; S.powerups.length = 0; S.camps.length = 0; S.banners.length = 0; S.decals.length = 0; S.trails.length = 0; SPL.reset();
    if (!sandbox) for (const st of [...S.spr.sets.values()]) if (st.relics) S.spr.dropSet(st); // last match's relic atlases: zeroed (every team starts at tier 0)
    S.t = 0; S.tick = 0; S.acc = 0; S.timeLeft = cfg.world.matchSeconds; S.trickleT = 0; S.shake = 0; S.result = null; S.engagedNow = false; S.finalCalled = false; S.pendingEnd = null; S._routedBy = null; S.lastDrawSim = 0;
    S.stats = { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0, fights: 0 };
    S.dbg = { terrainBad: 0, firstBad: null, capOver: 0 }; S.ev = mkEv(); S.lastRout = null; S.thinkRR = 0; S.fixture = null;
    S.noise = mkNoise(); S.crown = mkCrown(); S.pile = mkPile(); S.scent = mkScent(); S.scent.next = cfg.ai.grace; S.relaxUntil = -1e9; S.torches = false; S.aiCost = { ms: 0, thinks: 0, ticks: 0, max: 0 };
    S.zoomLock = 0; // PS.artScene's pinned zoom ends with the match
    S.aiPlayer = !attract && !!opts.aiPlayer; // QA: an all-AI match under real rules (team 1 plays as ai.proxy; nobody wins or loses, the harness reads PS.pacing)
    const inp = S.input; inp.route.on = false; inp.route.chase = 0; inp.hold = false; inp.preview = 0;

    // obstacles: open ground at least 3 cells from any wall, spaced, clear of every spawn slot; +prop cost on their cell
    const clearStart = SP.obstacleClearOfStarts, nearSpawn = (x, y, d) => { for (const s of m.spawns) if ((s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < d * d) return true; return false; };
    const spaced = (x, y, pad) => { for (const o of S.obstacles) { const dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy < (o.r + pad) * (o.r + pad)) return false; } return true; };
    for (let i = 0; i < cfg.world.trees + cfg.world.rocks; i++) {
      const p = randPos(P.open3), tree = i < cfg.world.trees, big = tree && S.rng() < 0.4;
      if (!spaced(p.x, p.y, 40) || nearSpawn(p.x, p.y, clearStart) || !T.placementOk(p.x, p.y, 3)) continue;
      S.obstacles.push({ x: p.x, y: p.y, r: tree ? (big ? 17 : 12) : 13, kind: tree ? (big ? 1 : 0) : 2, v: -1 }); // v: render variant (pine, rock shape), set on first draw
      const c = T.cellOf(p.x, p.y); m.cost[c] = Math.min(254, m.cost[c] + cfg.terrain.costs.prop);
    }
    bucketObstacles();

    // teams: the player + the five rivals of ai.personalities, one per spawn slot, slots shuffled per match (Fisher-Yates on S.rng, so a seed
    // replays the same shuffle). Title attract and all-AI QA matches play team 1 as ai.proxy. Rival senses scale with the difficulty (SPEC-v2 §7).
    S.teams = [null];
    S.teams.push(mkTeam(1, cfg.player.name, cfg.player.color, true, S.attract || S.aiPlayer ? cfg.ai.proxy : null));
    cfg.ai.personalities.forEach((p, i) => S.teams.push(mkTeam(2 + i, p.name, p.color, false, p)));
    { const D = diff(); for (let i = 2; i < S.teams.length; i++) { const t = S.teams[i]; if (S.attract) continue; t.sense = D.sight; t.mem = D.memory; t.hear = D.hearing; } }
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
    // spoils (SPEC-v2 §8, src/spoils.js): villages and fixed chests per spawn region, bandit camps (their agents, team id 8), heavy chests.
    // Placed before the neutral camps, which then keep out of every bandit camp's reach and off every objective (placeOk)
    SPL.place(P);
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
    // AI knowledge at the start (SPEC-v2 §7): every camp within ai.campKnowStart px of its spawn; the rest as explored or smelled
    { const ck2 = cfg.ai.campKnowStart * cfg.ai.campKnowStart;
      for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i], s = m.spawns[t.slot]; if (!t.ai || !s) continue; for (const c of S.camps) if ((c.x - s.x) * (c.x - s.x) + (c.y - s.y) * (c.y - s.y) <= ck2) c.kn[i] = c.n; } }
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
    if (!sandbox) S.zDpr = S.dpr; // the zoom steps are re-quantised for the DPR tier at match start only (SPEC-v2 §13)
    S.cam.x = S.teams[1].cx; S.cam.y = S.teams[1].cy; S.camS = mkCamS(); zoomRule(S.teams[1].count, 0, true);
    S.teams[1].tx = S.teams[1].cx; S.teams[1].ty = S.teams[1].cy;
    if (!sandbox) { groundInvalidate(m); minimapBake(true); }
    buildTeamChips();
    if (!S.attract) showHint(S.input.touch ? "Tap to march there, drag to steer, hold to stop" : "Your swarm follows the cursor and finds its way round cliffs", 4);
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

  // camps: also the neutral head-count of every camp (update(), once per tick)
  function recount(camps) {
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; t.count = 0; t._sx = 0; t._sy = 0; t.minY = Infinity; }
    if (camps) for (const c of S.camps) c.n = 0;
    for (const a of S.agents) { if (a.dead) continue; if (a.team === 0) { if (camps && a.camp) a.camp.n++; continue; } if (a.team === 8) continue; const t = S.teams[a.team]; t.count++; t._sx += a.x; t._sy += a.y; if (a.y < t.minY) t.minY = a.y; }
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

  // the one way AI and HUD code walks teams (SPEC-v2 §6, C2 F): swarms() = the six swarm teams 1..6, rivals() = the player's five rivals 2..6.
  // Bandits (team id 8 in agent records) live in S.bandits and never appear here. Lists cached per S.teams array (no allocation per call).
  const SWL = { src: null, n: -1, all: [], riv: [] };
  function swarmLists() { const T = S.teams; if (SWL.src !== T || SWL.n !== T.length) { SWL.src = T; SWL.n = T.length; SWL.all.length = 0; SWL.riv.length = 0; for (let i = 1; i < T.length; i++) { SWL.all.push(T[i]); if (i > 1) SWL.riv.push(T[i]); } } return SWL; }
  const swarms = () => swarmLists().all, rivals = () => swarmLists().riv;
  // what src/spoils.js may touch (SPEC-v2 §8): state, agent creation and conversion, the neighbour gather, presentation (every one of them
  // gated as the rest of the game gates it), noise and pings, placement, and the knowledge assert
  function spoilsHooks() {
    return { S, $, NEAR, mkAgent: (x, y, t) => mkAgent(x, y, t), convert: (a, t, ab) => convert(a, t, ab), gather: (x, y, r) => { gather(x, y, r); return nearN; },
      banner: (text, color, life, at, pri) => banner(text, color, life, at, pri), floater: (x, y, s, c, sz, l) => { if (!sandbox && fxOk(x, y)) floaters.add(x, y, s, c, sz, l); },
      burst: (x, y, c, n, sp, l, sz, g) => particles.burst(x, y, c, n, sp, l, sz, g), puff: (x, y) => particles.burst(x, y - 2, "#C8B08A", 2, 30, 0.35, 2, -20),
      playerSees: (x, y) => playerSees(x, y), fxOk: (x, y) => fxOk(x, y), fogGate: () => fogGate(), sightR: (t) => sightR(t), randPos: (l) => randPos(l), placeOk: (x, y, k, pad) => placeOk(x, y, k, pad),
      noiseAt: (a, b, x, y) => noiseAt(a, b, x, y), clashPing: (x, y, r) => clashPing(x, y, r), sandbox: () => sandbox, swarms, seenSwarm: (id) => !fogGate() || S.fogS.obs[1][id].seen,
      knowFail: (t, what) => knowFail(t, what), gained: (t, axis) => onGained(t, axis) };
  }

  // ---------------------------------------------------------------- spatial hash: agents packed by 48 px cell into contiguous typed arrays
  // (M7): each occupied cell owns the range HS[c]..HE[c] of PX / PY (position at rebuild), PT (team), PF (1 escaping); a dead agent sits at -1e9, out of every scan
  // and PA (the agent). Cells are stamped per rebuild (no per-tick clears). Within a cell agents sit in reverse insertion order, the order
  // the M1-M6 linked lists walked, so gather() hands out neighbours exactly as before. The steering pass reads the packed arrays directly:
  // a neighbour's x, y and team come from one contiguous run of memory instead of hundreds of scattered agent objects (the phone's sim cost,
  // M7 brief item 7). Each agent writes its new position back when it has moved, so later agents read it live exactly as before: a finer
  // cell (24 px) scans a third fewer candidates but changes the scan order, and with it which enemy each fighter picks, which slowed
  // 60 v 40 from 4.9 s to 6.2 s. Combat sits on a knife edge at pitchfork reach, so the order stays.
  const HC = 48; let hCols = 0, hRows = 0, hStamp = null, HT = null, HS = null, HE = null, HN = null, OCC = null, hTick = 0, pN = 0;
  let PX = new Float64Array(0), PY = new Float64Array(0), PT = new Int8Array(0), PF = new Uint8Array(0), ACELL = new Int32Array(0); const PA = [];
  function packAlloc(n) { PX = new Float64Array(n); PY = new Float64Array(n); PT = new Int8Array(n); PF = new Uint8Array(n); ACELL = new Int32Array(n); PA.length = n; } // grows once per session at most, never per frame
  function hashAlloc() {
    hCols = Math.ceil(S.cfg.world.w / HC); hRows = Math.ceil(S.cfg.world.h / HC); const NC = hCols * hRows; hStamp = new Int32Array(NC); HT = new Int32Array(NC); HS = new Int32Array(NC); HE = new Int32Array(NC); HN = new Int32Array(NC); OCC = new Int32Array(NC);
    MED = []; for (let i = 0; i < 9; i++) MED.push(new Float32Array(Math.max(S.cfg.spawn.agentCap, S.cfg.spawn.touchAgentCap) + 512)); // per-team path-cohesion samples
    BNs = PS.fog.BN; BKs = PS.fog.BK; BB = BNs * BNs; FBS = new Int32Array(9 * BB); FBL = new Int16Array(9 * BB); // fog sources: occupied 64 px buckets per team
  }
  const NEAR = new Array(6000); let nearN = 0;
  const REC = new Array(4096); let recN = 0; // neutrals recruited this tick (converted after the steering pass)
  // the same pass gathers each team's occupied 64 px buckets (fog sources) into preallocated lists: FBL[team * BB + k], FBN[team] of them
  let BNs = 0, BKs = 64, BB = 0, FBS = null, FBL = null; const FBN = new Int32Array(9);
  function rebuildGrid() {
    const ag = S.agents, n = ag.length, bn1 = BNs - 1; let nOcc = 0;
    if (PX.length < n) packAlloc(Math.max(n, S.cap) + 256);
    hTick++; FBN.fill(0);
    for (let i = 0; i < n; i++) {
      const a = ag[i]; if (a.gar) { a.pk = -1; ACELL[i] = -1; continue; } // a garrison inside its palisade is nobody's neighbour until its village joins (M6)
      let cx = (a.x / HC) | 0, cy = (a.y / HC) | 0;
      if (cx < 0) cx = 0; else if (cx >= hCols) cx = hCols - 1; if (cy < 0) cy = 0; else if (cy >= hRows) cy = hRows - 1;
      const c = cy * hCols + cx; if (hStamp[c] !== hTick) { hStamp[c] = hTick; HN[c] = 0; OCC[nOcc++] = c; } HN[c]++; ACELL[i] = c;
      const tm = a.team; if (tm !== 0) HT[c] = hTick; if (tm === 0 || tm === 8) continue; // HT: a cell holding anyone but neutrals this tick
      let bx = (a.x / BKs) | 0, by = (a.y / BKs) | 0; if (bx < 0) bx = 0; else if (bx > bn1) bx = bn1; if (by < 0) by = 0; else if (by > bn1) by = bn1;
      const b = by * BNs + bx, k = tm * BB + b; if (FBS[k] !== hTick) { FBS[k] = hTick; FBL[tm * BB + FBN[tm]++] = b; }
    }
    let off = 0; for (let q = 0; q < nOcc; q++) { const c = OCC[q]; HS[c] = off; off += HN[c]; HE[c] = off; }
    for (let i = 0; i < n; i++) { const c = ACELL[i]; if (c < 0) continue; const a = ag[i], k = HS[c] + --HN[c]; PX[k] = a.dead ? -1e9 : a.x; PY[k] = a.dead ? -1e9 : a.y; PT[k] = a.team; PF[k] = a.escapeT > 0 ? 1 : 0; PA[k] = a; a.pk = k; }
    for (let k = off; k < pN; k++) PA[k] = null; pN = off; // no stale agent refs past the packed end
  }
  // every agent in the hash cells overlapping the square of half-size r around (x, y)
  function gather(x, y, r) {
    nearN = 0;
    let i0 = ((x - r) / HC) | 0, i1 = ((x + r) / HC) | 0, j0 = ((y - r) / HC) | 0, j1 = ((y + r) / HC) | 0;
    if (i0 < 0) i0 = 0; if (j0 < 0) j0 = 0; if (i1 >= hCols) i1 = hCols - 1; if (j1 >= hRows) j1 = hRows - 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * hCols + i; if (hStamp[c] !== hTick) continue;
      for (let k = HS[c], e = HE[c]; k < e && nearN < 6000; k++) NEAR[nearN++] = PA[k];
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
  const mkRec = () => ({ seen: false, ever: false, n: 0, nEsc: 0, x: 0, y: 0, vx: 0, vy: 0, minY: 0, count: 0, pw: 1, t: -1e9 }); // nEsc: seen agents in their escape window; pw: their power when last seen (M6)
  function mkFogS() {
    const obs = [], mem = [], ghosts = [], dust = [], verdict = [], pings = [];
    for (let o = 0; o < 9; o++) { obs.push([]); mem.push([]); for (let r = 0; r < 9; r++) { obs[o].push(mkRec()); mem[o].push(mkRec()); } ghosts.push({ on: false, x: 0, y: 0, n: 0, t0: -1e9 }); dust.push({ on: false, x: 0, y: 0, t: -1e9 }); verdict.push({ t0: -1e9, kind: 0 }); }
    for (let i = 0; i < 8; i++) pings.push({ on: false, x: 0, y: 0, t0: -1e9, t1: -1e9, rumbleT: -1e9, rout: false });
    return { obs, mem, ghosts, dust, verdict, pings, rr: 0, dustT: 0, dawnT0: -1, reveal: false, leakOn: false, simMs: 0, simTotal: 0, simTicks: 0, simMax: 0,
      danger: { on: false, ang: 0, t0: -1e9, last: -1e9, team: 0 },
      stats: { firstSight: -1, sightings: 0, ghosts: 0, dangerCues: 0, pings: 0, routPings: 0, rumbles: 0, dust: 0, verdicts: 0, crows: 0 },
      leak: { frames: 0, rivalsDrawn: 0, rivalsVisible: 0, fading: 0, hidden: 0, missed: 0, neutralsHidden: 0, tagHidden: 0, ringHidden: 0, arrowHidden: 0, miniHidden: 0, last: null },
      ai: { decisions: 0, swarm: 0, camps: 0, explore: 0, violations: 0, first: null, crown: 0, noise: 0, scent: 0, objectives: 0 } };
  }
  // the player's presentation is fogged: a real match (or a fog test scene), not ?nofog=1, not a bench "reveal", before dawn
  const fogGate = () => S.fogOn && !NOFOG && !!S.fogS && !S.fogS.reveal && S.fogS.dawnT0 < 0;
  const tellsOn = () => fogGate() && !S.attract;
  // playerSees: the one gate for everything that could give a rival away (v1's onScreen() gates, SPEC-v2 §5 leak audit); fxOk adds the
  // screen test v1 used for particles and sounds. With the fog off (title, fixtures, ?nofog=1, dawn) it falls back to v1's behaviour.
  function playerSees(x, y) { return !fogGate() || PS.fog.sees(1, x, y); }
  function fxOk(x, y) { return onScreen(x, y) && playerSees(x, y); }
  // sight: 340 + 10 sqrt(n), x the team's difficulty sense (rivals: 0.9 / 1.0 / 1.15), x finale.torches after the horn (SPEC-v2 §5, §7, §9)
  const sightR = (t) => (S.cfg.fog.sight0 + S.cfg.fog.sightK * Math.sqrt(Math.max(1, t.count))) * t.sense * (S.torches ? S.cfg.finale.torches : 1);

  const OC = new Int32Array(9), OE = new Int32Array(9), OX = new Float64Array(9), OY = new Float64Array(9), OMY = new Float64Array(9);
  function observe(o) {
    const FS = S.fogS, V = PS.fog.vis(o), v = PS.fog.verOf(o), nT = S.teams.length, NC = PS.fog.N, cell = S.map.cell, lim = NC * cell;
    for (let r = 0; r < 9; r++) { OC[r] = 0; OE[r] = 0; OX[r] = 0; OY[r] = 0; OMY[r] = 1e9; }
    for (let k = 0; k < pN; k++) { // the packed hash (M7): every agent's position, team and escape flag as of this tick's rebuild, in one contiguous run
      const tm = PT[k]; if (tm === 0 || tm === o) continue;
      const x = PX[k], y = PY[k]; if (!(x >= 0 && y >= 0 && x < lim && y < lim) || V[((y / cell) | 0) * NC + ((x / cell) | 0)] !== v) continue;
      OC[tm]++; OX[tm] += x; OY[tm] += y; if (y < OMY[tm]) OMY[tm] = y; if (PF[k] & 1) OE[tm]++;
    }
    const ks = S.cfg.fog.obsSmooth, vmax = 2 * S.cfg.agent.speed;
    for (let r = 1; r < nT; r++) {
      if (r === o) continue; const ob = FS.obs[o][r];
      if (OC[r] > 0) {
        const x = OX[r] / OC[r], y = OY[r] / OC[r];
        if (ob.seen) { const dt = S.t - ob.t; if (dt > 1e-6) { let vx = (x - ob.x) / dt, vy = (y - ob.y) / dt; const l = Math.sqrt(vx * vx + vy * vy), k = 1 - Math.exp(-dt / ks); if (l > vmax) { vx *= vmax / l; vy *= vmax / l; } ob.vx += (vx - ob.vx) * k; ob.vy += (vy - ob.vy) * k; } }
        else { ob.vx = 0; ob.vy = 0; if (o === 1) FS.ghosts[r].on = false; } // back in sight: the player's ghost goes
        ob.x = x; ob.y = y; ob.minY = OMY[r]; ob.n = OC[r]; ob.nEsc = OE[r]; ob.count = S.teams[r].count; ob.pw = S.teams[r].power; ob.t = S.t; ob.seen = true;
        if (!ob.ever) { ob.ever = true; if (o === 1) firstSight(r); if (S.ev.firstSightAny < 0) S.ev.firstSightAny = +S.t.toFixed(2); }
      } else if (ob.seen) {
        const m = FS.mem[o][r]; ob.seen = false; m.ever = true; m.x = ob.x; m.y = ob.y; m.vx = ob.vx; m.vy = ob.vy; m.n = ob.n; m.nEsc = ob.nEsc; m.count = ob.count; m.minY = ob.minY; m.t = S.t; ob.n = 0; ob.nEsc = 0;
        if (o === 1) { const g = FS.ghosts[r]; g.on = true; g.x = m.x; g.y = m.y; g.n = m.n; g.t0 = S.t; FS.stats.ghosts++; }
      }
    }
    // camps: the head-count this team last saw at each camp in its sight (a camp seen empty is known empty); objectives: what it last saw there
    for (const c of S.camps) if (PS.fog.seesCell(o, PS.fog.cellOf(c.x, c.y))) c.kn[o] = c.n;
    SPL.observe(o);
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
    // crows (SPEC-v2 §5, §7): a lurking Sly you cannot see flushes birds above the fog when you come within 1.3x its sight, every 5 s at most
    for (let r = 2; r < S.teams.length; r++) {
      const t = S.teams[r]; if (!t.alive || t.state !== "lurk" || FS.obs[1][r].seen || S.t < t.crowsT) continue;
      const dx = t.ax - pl.ax, dy = t.ay - pl.ay, R = 1.3 * sightR(t); if (dx * dx + dy * dy <= R * R) { t.crowsT = S.t + 5; crows(t.ax, t.ay); }
    }
    if (S.t - D.last >= FG.dangerEvery) for (let r = 2; r < S.teams.length; r++) {
      const t = S.teams[r]; if (!t.alive || t.count === 0 || (t.state !== "hunt" && t.state !== "crown") || t.preyId !== 1 || FS.obs[1][r].seen) continue;
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
  const SMP = { x: 0, y: 0, t: 0, ok: false }, SMR = { x: 0, y: 0, t: 0, ok: false }; // flow sample scratch (team field, rejoin field)
  const STRN = new Int32Array(9); // per-team stragglers this tick (P1)
  let MED = null; const MEDN = new Int32Array(9); // per-team path distances this tick (path cohesion median)
  const RR2 = new Float64Array(9); // per-team recruit radius squared this tick (Horn, M6)
  function update(dt) {
    const cfg = S.cfg, A = cfg.agent, F = cfg.flock, FW = cfg.flow, CB = cfg.combat, W = cfg.world.w, H = cfg.world.h, D = diff();
    S.t += dt; S.timeLeft -= dt; S.tick++;
    const player = S.teams[1];
    if (S.pendingEnd) { if (S.t >= S.pendingEnd.at) finishEnd(); return; } // the result is set: the sim freezes (no recruits, hits or crown moves after the bell; M5 critic MINOR-7), particles and dawn run on
    const finalPhase = S.timeLeft <= cfg.world.finalSeconds;
    if (S.fixture) S.fixture.drive(dt);
    else if (S.attract) {
      let alive = 0; for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive) alive++;
      if (alive <= 1 || S.timeLeft <= 0) { newGame(true, { keepMap: true }); return; } // attract mode keeps one map per title visit
    }
    // the horn (SPEC-v2 §9): the crown goes on the biggest swarm, torches light every sight x finale.torches, every rival re-thinks now
    if (finalPhase && !S.finalCalled) {
      S.finalCalled = true; S.torches = true; crownUpdate(true); S.ev.hornLeader = S.crown.team; let al = 0; for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive) al++; S.ev.hornAlive = al;
      const ct = S.teams[S.crown.team]; banner(!ct ? "THE HORN" : ct.isPlayer ? "THE HORN: YOU WEAR THE CROWN" : "THE HORN: " + ct.name.toUpperCase() + " WEARS THE CROWN", "#FFE49A", 3.5, 0, 2); PS.audio.warHorn(); showHint("Be the biggest swarm when the bell rings", 4); for (let i = 1; i < S.teams.length; i++) if (S.teams[i].ai) S.teams[i].thinkT = 0;
    } else if (finalPhase && S.crown.team && S.t >= S.crown.next) crownUpdate();
    if (S.tick % 3600 === 0 && S.tick <= 10800) { let al = 0; for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive) al++; S.ev["alive" + S.tick / 60] = al; } // swarms alive at 1:00 / 2:00 / 3:00
    if (S.tick % 30 === 0 && !S.fixture) pileTick();
    if (!S.fixture) scentTick();

    // player target and steering mode (SPEC-v2 §10)
    const inp = S.input;
    if (!S.attract && !S.fixture && !player.ai) playerControl(player);

    // AI think: one rival per tick
    aiTick(dt, D);

    // buffs tick, engagement reset, this tick's team speed (size curve, AI pace, speed buff, Boots) and recruit radius (Horn)
    let rrMax = A.recruitRadius;
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i], bf = t.buffs; if (bf.speed > 0) bf.speed -= dt; if (bf.armor > 0) bf.armor -= dt; if (bf.frenzy > 0) bf.frenzy -= dt; if (bf.rally > 0) bf.rally -= dt; for (let j = 0; j < 9; j++) { t.eng[j] = 0; t.fX[j] = 0; t.fY[j] = 0; }
      let s = A.speed * sizeSpeed(t.count) * t.speedMod * t.spdMul; if (t.ai && !t.isPlayer && !S.attract) s *= D.aiSpeed; if (t.buffs.speed > 0) s *= cfg.powerups.speedMult; t.spd = s; MEDN[i] = 0; // spdMul: Boots (M6)
      const rr = t.recR || A.recruitRadius; RR2[i] = rr * rr; if (rr > rrMax) rrMax = rr; // recruit radius: Horn (M6)
    }

    // flow fields: at most one team rebuild per tick, player first (SPEC-v2 §3); sim-tick scheduling keeps replays exact
    PS.flow.tick(S.teams, S.agents, S.tick);
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i], f = PS.flow.fieldFor(i), v = f ? f.ver : -1; if (v !== t.fv) { t.fv = v; t.fvTick = S.tick; } } // a new field: the median settles over 2 ticks (alternate-tick samples)
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && t.escUntil > S.t && S.t >= t.escReplanAt) { planEscape(t); break; } } // one remnant re-plan per tick

    rebuildGrid();
    fogTick(); // sight stamps from this tick's buckets (SPEC-v2 §5): the player every 3rd tick, one AI team per tick

    // per-agent steering + combat + terrain. Travel follows the team's field (or direct seek for drag, keys, hold and fighting pulls) with
    // arrive by path distance; path cohesion is a speed multiplier 1 + k (T - T_median) clamped, plus local cohesion toward same-team
    // neighbours from this same neighbour pass. A remnant (escapeT > 0) neither attacks nor is attacked and passes through enemies.
    // Stragglers (P1, Peter's playtest: peasants left beyond a ridge pushed straight at the group): the player's field runs in every mode it needs, and
    // an agent whose path distance is flow.stragglerBand past the team median, or whose straight line to the target is flow.stragglerDetour
    // shorter than its path (a wall between), follows the field at its path-cohesion pace (1.3x that far back) with local cohesion and the
    // huddle pull off, in any mode, until both fall under flow.stragglerRejoin of those numbers.
    const sepR = F.sepRadius, engR2 = A.engageRadius * A.engageRadius, atkR2 = A.attackRange * A.attackRange, EN = cfg.encampments;
    const eSep = sepR * F.enemySepMult, eSep2 = eSep * eSep, hard = F.enemyHardRadius, hard2 = hard * hard, lcR = FW.localCohesionRadius, lcR2 = lcR * lcR;
    const qTeam = Math.max(A.engageRadius, eSep, sepR, lcR), qNeutral = Math.max(sepR, rrMax), qTeam2 = qTeam * qTeam, qNeutral2 = qNeutral * qNeutral; // radius-limited neighbour scans
    const qBandit = Math.max(qTeam, EN.banditAggro), qBandit2 = qBandit * qBandit, leash2 = EN.banditLeash * EN.banditLeash; // bandits: aggro radius, leash from their camp
    const huddleP = inp.huddle, kLerp = 1 - Math.exp(-F.steerLerp * dt), pk = FW.pathCohesionK, pLo = FW.pathCohesionClamp[0], pHi = FW.pathCohesionClamp[1];
    const sBand = FW.stragglerBand, sDet = FW.stragglerDetour, sRejoin = FW.stragglerRejoin;
    const T = PS.terrain, TN = T.N, TC = T.cell, W1 = W - 0.001, terr = S.map.terr, sdfA = S.map.sdf, far = 2 * TC, slideM = FW.slideMargin, fordK = cfg.terrain.fordSpeed;
    const O = S.obs, OB = S.obstacles, FL = PS.flow, esc = CB.remnant.escapeSpeed, truce = S.t < CB.truceSeconds; // truce: no attacks land, enemies only repel
    recN = 0;
    const nAg = S.agents.length;
    for (let idx = 0; idx < nAg; idx++) {
      const a = S.agents[idx];
      if (a.dead || a.gar) continue; // a village garrison waits inside its palisade (M6)
      a.ph += dt * 9; if (a.fl > 0) a.fl -= dt; if (a.lunge > 0) a.lunge -= dt;
      if (a.pop < 0.35) { const was = a.pop; a.pop += dt; if (was < 0 && a.pop >= 0 && fxOk(a.x, a.y)) { const tc = S.teams[a.team]; if (tc) { particles.burst(a.x, a.y - 8, tc.color, 6, 80, 0.45, 3, 200); particles.ring(a.x, a.y - 8, tc.color, 4, 18, 0.3); } } }
      const bandit = a.team === 8, team = a.team && !bandit ? S.teams[a.team] : null, escaping = a.escapeT > 0; // bandits (team id 8) have no team record
      if (escaping) { a.escapeT -= dt; if (a.escapeT <= 0 && a.pk >= 0) PF[a.pk] = 0; } // later agents this tick see the window closed, as they read it live before M7
      const qr = team ? qTeam : bandit ? qBandit : qNeutral, self = a.pk, aNeu = team === null && !bandit; // the neighbour square: hash cells within qr
      let gi0 = ((a.x - qr) / HC) | 0, gi1 = ((a.x + qr) / HC) | 0, gj0 = ((a.y - qr) / HC) | 0, gj1 = ((a.y + qr) / HC) | 0;
      if (gi0 < 0) gi0 = 0; if (gj0 < 0) gj0 = 0; if (gi1 >= hCols) gi1 = hCols - 1; if (gj1 >= hRows) gj1 = hRows - 1;
      let sx = 0, sy = 0; // separation accumulator
      let dvx = 0, dvy = 0; // desired velocity
      let lcx = 0, lcy = 0, lcn = 0; // same-team neighbours (local cohesion)
      const hud = team && team.isPlayer && huddleP && !S.attract;
      const mySep = hud ? F.huddleSepRadius : sepR, mySep2 = mySep * mySep;
      const c0 = ((a.y < 0 ? 0 : a.y > W1 ? W1 : a.y) / TC | 0) * TN + ((a.x < 0 ? 0 : a.x > W1 ? W1 : a.x) / TC | 0);
      let speed = team ? team.spd : bandit ? EN.banditSpeed : A.speed;
      if (hud) speed *= F.huddleSpeedMult;
      if (terr[c0] === 3) speed *= team ? team.fordMul : fordK; // Boots: fords slow less (M6)

      // find/keep combat target + separation + local cohesion (+ a neutral's nearest recruiter) in one pass
      let best = null, bestD2 = engR2, recT = 0, recD2 = 1e12, chase = null, chD2 = EN.banditAggro * EN.banditAggro; // chase: a bandit's nearest swarm peasant within aggro
      if (a.tgt && (truce || escaping || a.tgt.dead || a.tgt.team === a.team || a.tgt.team === 0 || a.tgt.escapeT > 0)) a.tgt = null;
      if (a.tgt) { const dx = a.tgt.x - a.x, dy = a.tgt.y - a.y; const d2 = dx * dx + dy * dy; if (d2 < engR2 * 4) { best = a.tgt; bestD2 = d2; } else a.tgt = null; }
      const at = a.team, q2 = team ? qTeam2 : bandit ? qBandit2 : qNeutral2; let ax = a.x, ay = a.y; // the enemy hard push moves this agent inside the loop: kept in locals, written back after
      // an idle neutral (standing at its wander point, not escaping) with nobody but neutrals in its cells skips the scan: nothing can recruit
      // it, and neutral-on-neutral separation at rest only jostles a camp (M7 brief item 7: skip separation for idle neutrals)
      let scan = true;
      if (aNeu && !escaping) { const wx = a.wx - a.x, wy = a.wy - a.y; if (wx * wx + wy * wy < 9) { scan = false; for (let gj = gj0; gj <= gj1 && !scan; gj++) for (let gi = gi0; gi <= gi1; gi++) if (HT[gj * hCols + gi] === hTick) { scan = true; break; } } }
      if (scan) for (let gj = gj0; gj <= gj1; gj++) for (let gi = gi0; gi <= gi1; gi++) {
        const gc = gj * hCols + gi; if (hStamp[gc] !== hTick) continue;
        for (let k = HS[gc], ke = HE[gc]; k < ke; k++) {
          if (k === self) continue; // (an agent killed earlier this tick sits at -1e9: killAgent)
          const bx = PX[k], by = PY[k], dx = ax - bx, dy = ay - by, d2 = dx * dx + dy * dy; if (d2 >= q2) continue; // the cells cover a square
          const bt = PT[k];
          if (bt === at || aNeu || bt === 0) { // same side, or a neutral either way: plain separation (a bandit treats swarm peasants as enemies)
            if (d2 < mySep2 && d2 > 0.0001) { const d = Math.sqrt(d2), f = (1 - d / mySep) / d; sx += dx * f; sy += dy * f; }
            if (team === null) { if (!bandit && !escaping && bt !== 0 && bt !== 8 && d2 < RR2[bt] && d2 < recD2) { recD2 = d2; recT = bt; } } // the nearest recruiter within its own team's radius
            else if (bt === at && d2 < lcR2) { lcx += bx; lcy += by; lcn++; }
            continue;
          }
          if (escaping || (PF[k] & 1)) continue; // a remnant passes through enemies, both ways
          if (d2 < eSep2 && d2 > 0.0001) {
            const d = Math.sqrt(d2), f = (1 - d / eSep) / d; sx += dx * f; sy += dy * f;
            if (d2 < hard2) { const push = (hard - d) * 0.5; ax += (dx / d) * push; ay += (dy / d) * push; }
          }
          if (truce) continue;
          if (bandit && d2 < chD2 && bt !== 8) { chD2 = d2; chase = PA[k]; }
          if (d2 < bestD2 && (!best || d2 < bestD2 * 0.5)) { best = PA[k]; bestD2 = d2; }
        }
      }
      a.x = ax; a.y = ay;
      if (recT && recN < REC.length) { a.rec = recT; REC[recN++] = a; }

      let vcap = speed; // this agent's speed before the 1.15 flocking headroom
      if (team) {
        // travel direction: the team field, or direct seek (drag, keys, hold, a field miss, or inside the arrive radius by path distance)
        const tdx = team.tx - a.x, tdy = team.ty - a.y, td = Math.sqrt(tdx * tdx + tdy * tdy);
        let ux = 0, uy = 0, tp = td;
        // the player's field in drag / keys / hold is built on demand (wantField: one of its agents pushed into rock inside the last
        // flow.blockHold s, or it has stragglers), so a swarm that never meets a wall routes exactly as before P1
        if (!team.route && at === 1 && sdfA[c0] <= far && td > 2 && !best && !escaping && sdfGrad(a.x, a.y) < a.r + slideM + 2 && (tdx * GX + tdy * GY) / td < -0.5) team.blockT = S.t;
        if (team.route || (at === 1 && team.wantField)) {
          // the field is sampled on alternate ticks per agent (direction and path distance cached; fok 0 = sample now, 1 = ok, -1 = miss)
          if (a.fok === 0 || ((idx + S.tick) & 1) === 0) { if (FL.sample(a.team, a.x, a.y, SMP)) { a.fdx = SMP.x; a.fdy = SMP.y; a.fieldT = SMP.t; a.fok = 1; } else a.fok = -1; }
          if (a.fok === 1) {
            // straggler: the band (path distance past the median, read only once the field has held 2 ticks) in any mode; with direct seek
            // (drag, keys, hold) also the detour (a wall between it and the target: its straight line is what direct seek would push along)
            // (a direct-seek agent that is not straggling keeps its straight distance for arrive and path cohesion, as before P1)
            const fT = a.fieldT, ok = S.tick - team.fvTick >= 2, far = fT - team.tMed, det = team.route ? 0 : fT - td;
            if (a.strag) { if (ok && far < sBand * sRejoin && det < sDet * sRejoin) a.strag = 0; } else if (!escaping && ((ok && far > sBand) || det > sDet)) a.strag = 1;
            if (team.route || a.strag) { tp = fT; if (tp > F.arrive) { ux = a.fdx; uy = a.fdy; } }
            if (a.strag) { STRN[at]++; if (at === 1 && FL.sampleRejoin(a.x, a.y, SMR) && SMR.t > F.arrive) { ux = SMR.x; uy = SMR.y; } } // back over known ground (the rejoin field)
          } else a.strag = 0;
        } else a.strag = 0;
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
          if (!a.strag && MEDN[a.team] < MED[a.team].length) MED[a.team][MEDN[a.team]++] = tp; // the group's median: stragglers left out
        }
        const seekX = ux * sp, seekY = uy * sp;
        // local cohesion toward the mean of same-team neighbours (nearly always on this side of any wall); huddle pulls to the anchor
        let cohX = 0, cohY = 0;
        if (lcn > 0 && !a.strag) { const qx = lcx / lcn - a.x, qy = lcy / lcn - a.y, ql = Math.sqrt(qx * qx + qy * qy); if (ql > 1) { const k = (speed * FW.localCohesion * (ql < lcR ? ql / lcR : 1)) / ql; cohX = qx * k; cohY = qy * k; } }
        if (hud && !a.strag) {
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
              a.atk = A.attackInterval * (0.8 + S.rng() * 0.4) / team.atkMul; a.lunge = 0.18; // atkMul: Arms (M6)
              const tt = best.team === 8 ? null : S.teams[best.team]; // a bandit has no team record
              let dmg = A.damage * (1 + A.damageJitter * (2 * S.rng() - 1)); if (team.buffs.frenzy > 0) dmg *= cfg.powerups.frenzyMult; if (tt && tt.buffs.armor > 0) dmg *= cfg.powerups.armorMult;
              best.hp -= dmg; best.fl = 0.16;
              if (fxOk(best.x, best.y)) { particles.spark((a.x + best.x) / 2, (a.y + best.y) / 2 - 8, "#FFF6D0"); PS.audio.hit(); } // hit spark at the fork tips (M7)
              if (best.hp <= 0) killAgent(best, a.team);
            }
          } else a.atk = Math.min(a.atk, A.attackInterval * 0.5 / team.atkMul);
        } else {
          a.fight = false; dvx = seekX + cohX; dvy = seekY + cohY;
        }
      } else if (bandit) {
        // bandits (SPEC-v2 §6, §8): hold a post in their camp; go for any swarm peasant within encampments.banditAggro px, never farther than
        // encampments.banditLeash px from the camp (past it they walk home and drop their target). No rout, no join, no spoils: team id 8 is
        // outside S.teams and every team loop. Their fights feed the camp's clash noise (src/spoils.js tick).
        const cp = a.camp, lx = a.x - cp.x, ly = a.y - cp.y;
        if (lx * lx + ly * ly > leash2) { best = null; chase = null; }
        if (best) {
          if (best.team === 1 && a.tgt !== best && fxOk(a.x, a.y)) PS.audio.growl(); // bandits going for your peasants where you see them (M7)
          a.tgt = best; a.fight = true; cp.fn++; cp.fx += a.x; cp.fy += a.y; cp.vs = best.team;
          const d = Math.sqrt(bestD2) || 1; if (bestD2 >= atkR2 * 0.85) { dvx = ((best.x - a.x) / d) * speed; dvy = ((best.y - a.y) / d) * speed; }
          if (bestD2 < atkR2) {
            a.atk -= dt;
            if (a.atk <= 0) {
              a.atk = A.attackInterval * (0.8 + S.rng() * 0.4); a.lunge = 0.18; const tt = S.teams[best.team];
              let dmg = EN.banditDamage * (1 + A.damageJitter * (2 * S.rng() - 1)); if (tt && tt.buffs.armor > 0) dmg *= cfg.powerups.armorMult;
              best.hp -= dmg; best.fl = 0.16;
              if (fxOk(best.x, best.y)) { particles.spark((a.x + best.x) / 2, (a.y + best.y) / 2 - 8, "#FFF6D0"); PS.audio.hit(); }
              if (best.hp <= 0) killAgent(best, 8);
            }
          } else a.atk = Math.min(a.atk, A.attackInterval * 0.5);
        } else {
          a.fight = false; a.tgt = null; let gx = a.hx, gy = a.hy;
          if (chase) { const qx = chase.x - cp.x, qy = chase.y - cp.y; if (qx * qx + qy * qy < leash2) { gx = chase.x; gy = chase.y; } }
          const dx = gx - a.x, dy = gy - a.y, d = Math.sqrt(dx * dx + dy * dy); if (d > 3) { const s = speed * (d < 30 ? d / 30 : 1); dvx = (dx / d) * s; dvy = (dy / d) * s; }
        }
        vcap = speed;
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
      const dl = Math.sqrt(dvx * dvx + dvy * dvy); const maxV = vcap * (team || bandit || escaping ? 1.15 : 0.5);
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
      // debug assert (always counted, cheap, folded into this pass in M7): no agent centre in rock or deep water or outside the world
      { const cE = ((a.y < 0 ? 0 : a.y > W1 ? W1 : a.y) / TC | 0) * TN + ((a.x < 0 ? 0 : a.x > W1 ? W1 : a.x) / TC | 0), tvE = terr[cE];
        if (tvE === 1 || tvE === 2 || a.x < 0 || a.y < 0 || a.x > W || a.y > H) { S.dbg.terrainBad++; if (!S.dbg.firstBad) S.dbg.firstBad = { t: +S.t.toFixed(2), x: +a.x.toFixed(1), y: +a.y.toFixed(1), team: a.team, terr: tvE }; } }
      if (a.pk >= 0) { PX[a.pk] = a.x; PY[a.pk] = a.y; } // agents later in this pass see where it moved (the live read of M1-M6, kept exactly: combat sits on a knife edge at pitchfork reach)
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
      for (let k = 0; k < nearN; k++) { const b = NEAR[k]; if (b.team === 0 || b.team === 8 || b.dead) continue; const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < pr2) { pickup(p, b.team); break; } }
    }
    // spoils (SPEC-v2 §8, src/spoils.js): relic and chest pickups, village and heavy-chest rings, bandit camps cleared, the trickle chest
    SPL.tick(dt, finalPhase);

    // camp head-counts (for "+N" labels) and campfire smoke, which rises above the fog (smokeP is drawn after it) from camps within
    // fog.smoke px of your swarm: a tell of recruits in the dark (SPEC-v2 §5); with the fog off, v1's on-screen smoke
    recount(true); // team counts and centroids, and the camp head-counts (one pass over the agents)
    const smR = cfg.fog.smoke, gS = fogGate();
    for (const c of S.camps) {
      if (c.n === 0 || !onScreen(c.x, c.y) || (gS && (c.x - player.cx) * (c.x - player.cx) + (c.y - player.cy) * (c.y - player.cy) > smR * smR)) continue;
      c.smokeT -= dt; if (c.smokeT <= 0) { c.smokeT = 0.5 + Math.random() * 0.5; smokeP.smoke(c.x + (Math.random() - 0.5) * 3, c.y - 6); }
    }

    // path-cohesion medians for the next tick (selection over this tick's samples, no sort)
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (MEDN[i] > 0) t.tMed = medianOf(MED[i], MEDN[i]); t.stragN = STRN[i]; STRN[i] = 0; t.wantField = t.stragN > 0 || S.t - t.blockT < FW.blockHold; } // (the flow tick reads both)
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
    S.engagedNow = false; S.meleeN = 0; // meleeN: agents fighting in clashes you see (P2: the melee bed follows it)
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
            if (S.ev.firstFight < 0) S.ev.firstFight = +S.t.toFixed(2); if ((ta.isPlayer || tb.isPlayer) && S.ev.firstPlayerFight < 0) S.ev.firstPlayerFight = +S.t.toFixed(2);
          }
          else { ta.engL[j] += (LCA - ta.engL[j]) * ks; tb.engL[i] += (LCB - tb.engL[i]) * ks; }
          if (fightMode) { const gA = groupCells(ta.id, cx, cy), gB = groupCells(tb.id, cx, cy); ta.engG[j] = gA; tb.engG[i] = gB; if (gA > ta.engGPk[j]) ta.engGPk[j] = gA; if (gB > tb.engGPk[i]) tb.engGPk[i] = gB; }
          ta.engT[j] += dt; tb.engT[i] = ta.engT[j]; ta.engCx[j] = tb.engCx[i] = cx; ta.engCy[j] = tb.engCy[i] = cy;
          ta.lastFight = tb.lastFight = S.t; noiseAt(i, j, cx, cy); // every AI within its hearing radius hears this clash (SPEC-v2 §7)
          if (fxOk(cx, cy)) S.meleeN += nf;
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
    // (no recount here since M7: the one after the steering pass already skips the dead, and every rout recounts itself)

    // eliminations
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && t.count === 0) eliminate(t); }
    tellsTick();

    // trickle: every trickleEvery, trickleCamps camps; each is biased (underdogBias) to one of the two smallest living swarms and lands
    // trickleBeyond past that swarm's sight radius, never within minTrickleDistFromTeams of another swarm; off in the finale
    S.trickleT += dt;
    if (!finalPhase && S.trickleT >= cfg.spawn.trickleEvery) {
      S.trickleT = 0;
      const SP = cfg.spawn, FG = cfg.fog, md2 = SP.minTrickleDistFromTeams * SP.minTrickleDistFromTeams;
      let neutrals = 0; for (const a of S.agents) if (a.team === 0 && !a.gar) neutrals++;
      let s1 = null, s2 = null;
      for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (!t.alive) continue; if (!s1 || t.count < s1.count) { s2 = s1; s1 = t; } else if (!s2 || t.count < s2.count) s2 = t; }
      for (let rep = 0; rep < SP.trickleCamps; rep++) {
        const nn = SP.campMin + ((S.rng() * (SP.campMax - SP.campMin + 1)) | 0); // size first: the cap check needs it (B0 bug 1)
        if (neutrals + nn > SP.trickleCap || S.agents.length + nn > S.cap) break;
        const pool = rep % 2 === 0 ? s1 : s2 || s1, fav = pool && S.rng() < SP.underdogBias ? pool : null; S.ev.trickle++; if (fav) S.ev.trickleFav++; // fav: one of the two smallest living swarms (of six)
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
    // debug assert (always counted): total under the cap (the rock / water assert runs in the steering pass)
    if (S.agents.length > S.cap) S.dbg.capOver++;

    // drum, and the melee bed (P2) by the fighting agents you see
    if (S.engagedNow && !PS.audio.drumOn()) PS.audio.startDrum(); else if (!S.engagedNow && PS.audio.drumOn()) PS.audio.stopDrum();
    PS.audio.melee(S.meleeN);
    PS.audio.pump(); // the drum's lookahead and the cue reap, on the audio clock (P1)

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

    // banners: one at a time, by priority (banner()); shorter while others wait; stale rival news expires in the queue
    if (S.banners.length) { const b = S.banners[0], BQ = cfg.banner; b.life -= dt; if (b.life <= 0 || (S.banners.length > 1 && b.life0 - b.life >= BQ.queuedSeconds)) S.banners.shift();
      for (let i = S.banners.length - 1; i >= 1; i--) if (S.banners[i].pri === 0 && S.t - S.banners[i].t0 > BQ.staleSeconds) S.banners.splice(i, 1); }
    if (S.hintT > 0) { S.hintT -= dt; if (S.hintT <= 0 || S.engagedNow || S.banners.length > 0) { S.hintT = 0; if (!sandbox) $("hint").classList.remove("show"); } }

    if (S.attract || S.fixture) return;
    if (S.aiPlayer) { let al = 0; for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive) al++; if (S.timeLeft <= 0 || al <= 1) { S.result = S.timeLeft <= 0 ? "bell" : "last"; S.mode = "aidone"; } return; } // all-AI QA match: no win screen
    // stats + hints
    if (player.count > S.stats.peak) S.stats.peak = player.count;
    if (S.stats.recruited === 0 && S.t > 25 && !S._hintRecruit) S._hintRecruit = showHint("Grey peasants are free recruits. Go touch them.", 3);
    if (player.count >= 1 + diff().startBonus + S.cfg.polish.hintFightGain && S.t >= S.cfg.polish.hintFightAfter && !S._hintFight) S._hintFight = showHint("Only fight rivals when you're bigger. Winners absorb the losers.", 5); // relative to the start count, after the control hint (final critic MAJOR-1)
    if (player.count >= 20 && !S._hintHud) S._hintHud = showHint(S.input.touch ? "Hold HUDDLE to tighten the swarm before a clash" : "Hold SPACE to huddle up before a clash", 5);
    // v2 hints (M7): the fog, relics, the remnant. Each waits (showHint returns false) while a clash, a banner or a fresh route marker is up
    if (!S._hintFog && S.t > 22 && S.fogS.stats.firstSight < 0) S._hintFog = showHint("Rival mobs hide in the dark. Explore to find them", 4);
    if (S._hintRelic === 1 && showHint("Relics upgrade your whole swarm for the rest of the match", 4)) S._hintRelic = 2;
    if (S._hintRem === 1 && showHint(S._hintRemTxt, 4)) S._hintRem = 2;

    // win / lose
    if (player.count === 0 && !S.result) endGame(false, S._routedBy ? "Your swarm broke and joined " + S._routedBy + "." : "Every last peasant fell.");
    else if (!S.result) {
      let rivals = 0; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].alive) rivals++;
      if (rivals === 0) endGame(true, "Every rival mob is gone. The whole valley marches under your banner.");
      else if (S.timeLeft <= 0) {
        if (S.fogS.dawnT0 < 0) { S.fogS.dawnT0 = S.t; PS.audio.dawn(); } // dawn: at the bell the fog lifts over fog.dawnSeconds before the result screen (and a chime, M7)
        let big = player; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].count > big.count) big = S.teams[i];
        if (big === player) endGame(true, "The bell rang and yours was the biggest swarm in the valley.");
        else endGame(false, big.name + " had the biggest swarm when the bell rang (" + big.count + " vs your " + player.count + ").");
      }
    }
  }

  function convert(a, team, absorbed) {
    const from = a.team, t = S.teams[team]; a.team = team; a.hp = t.hpMax; a.tgt = null; a.fight = false; a.fl = absorbed ? 0 : 0.2; a.fok = 0; a.strag = 0; // hpMax: Arms (M6), every recruit takes the team's tiers
    a.pop = absorbed ? -S.rng() * 0.45 : 0;
    SPL.onConvert(a, t, from, absorbed); // muster milestones (M6): neutrals recruited, absorbed rivals excluded
    if (fxOk(a.x, a.y)) {
      if (!absorbed) particles.burst(a.x, a.y - 6, t.color, 5, 80, 0.45, 3, 220);
      if (t.isPlayer && !absorbed) { PS.audio.recruit(); if (Math.random() < 0.35) floaters.add(a.x, a.y - 14, "+1", t.color, 13, 0.7); }
    }
    if (t.isPlayer && from === 0) S.stats.recruited++;
    if (from === 0 && !absorbed) bumpChip(team);
  }
  function killAgent(a, byTeam) {
    if (a.dead) return; a.dead = true; if (a.pk >= 0 && a.pk < pN && PA[a.pk] === a) { PX[a.pk] = -1e9; PY[a.pk] = -1e9; } // out of every neighbour scan for the rest of this tick
    const t = a.team === 8 ? null : S.teams[a.team]; if (t) { if (t.isPlayer) S.stats.lost++; }
    if (a.team === 8 && a.camp) { a.camp.n--; if (byTeam > 0 && byTeam < 7) a.camp.lastHit = byTeam; } // a bandit down: its camp clears at 0 (src/spoils.js)
    if (byTeam === 1) { S.stats.kills++; S.teams[1].kills++; }
    if (fxOk(a.x, a.y)) { particles.burst(a.x, a.y - 6, t ? t.color : a.team === 8 ? "#56565E" : "#B8A88A", 10, 120, 0.6, 4, 260); particles.burst(a.x, a.y - 6, "#F1C27D", 4, 90, 0.5, 3, 260); particles.ring(a.x, a.y - 6, "#FFFFFF", 3, 14, 0.22); PS.audio.die(a.team === 1); }
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
    a.team = 0; a.hp = S.cfg.agent.hp; a.tgt = null; a.fight = false; a.camp = null; a.hx = a.wx = p.x; a.hy = a.wy = p.y; a.escapeT = RM.escapeSeconds; a.ex = cx; a.ey = cy; a.fl = 0.2; a.exr = true; // exr: no muster credit for whoever takes it
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
  // the morale group (fighting mode, M2 critic MAJOR-1): the rout's flood at 48 px group-cell resolution (GC; since M7 a group cell spans
  // 2 x 2 hash cells). From every group cell holding one of team tid's fighting agents within combat.localRadius of the contact (any of its
  // agents there if none fights), a flood over 8-neighbour group cells holding any of its agents (remnants excluded); returns how many it
  // holds. About 1.5k list steps where the per-agent 40 px flood takes about 25k, so every engaged side is measured every tick.
  const GC = 48; let GV = null, GQ = null, gvT = 0, gCols = 0, gRows = 0, gSeed = false;
  // tid's agents (not dead, not escaping) in group cell (I, J); seed 1: gSeed if one of them fights within lr of (cx, cy), 2: any of them
  function gcCount(I, J, tid, seed, cx, cy, lr2) {
    let n = 0; gSeed = false; const r = GC / HC, fi0 = I * r, fj0 = J * r, fi1 = fi0 + r - 1 < hCols ? fi0 + r - 1 : hCols - 1, fj1 = fj0 + r - 1 < hRows ? fj0 + r - 1 : hRows - 1; // GC is a whole multiple of HC
    for (let fj = fj0; fj <= fj1; fj++) for (let fi = fi0; fi <= fi1; fi++) {
      const c = fj * hCols + fi; if (hStamp[c] !== hTick) continue;
      for (let k = HS[c], e = HE[c]; k < e; k++) {
        const a = PA[k]; if (a.team !== tid || a.dead || a.escapeT > 0) continue; n++;
        if (seed && !gSeed && (seed === 2 || a.fight)) { const dx = a.x - cx, dy = a.y - cy; if (dx * dx + dy * dy < lr2) gSeed = true; }
      }
    }
    return n;
  }
  function groupCells(tid, cx, cy) {
    const lr = S.cfg.combat.localRadius, lr2 = lr * lr;
    if (!GV) { gCols = Math.ceil(S.cfg.world.w / GC); gRows = Math.ceil(S.cfg.world.h / GC); GV = new Int32Array(gCols * gRows); GQ = new Int32Array(gCols * gRows); }
    gvT++; let qn = 0, total = 0;
    const i0 = Math.max(0, ((cx - lr) / GC) | 0), i1 = Math.min(gCols - 1, ((cx + lr) / GC) | 0), j0 = Math.max(0, ((cy - lr) / GC) | 0), j1 = Math.min(gRows - 1, ((cy + lr) / GC) | 0);
    for (let pass = 0; pass < 2 && qn === 0; pass++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * gCols + i; if (GV[c] === gvT) continue; const n = gcCount(i, j, tid, pass ? 2 : 1, cx, cy, lr2);
      if (gSeed) { GV[c] = gvT; GQ[qn++] = c; total += n; }
    }
    for (let h = 0; h < qn; h++) {
      const c = GQ[h], ci = c % gCols, cj = (c / gCols) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= gCols || jj >= gRows) continue;
        const cc = jj * gCols + ii; if (GV[cc] === gvT) continue; GV[cc] = gvT;
        const n = gcCount(ii, jj, tid, 0, 0, 0, 0); if (n) { GQ[qn++] = cc; total += n; }
      }
    }
    return total;
  }
  function rout(loser, winner, cx, cy, finalPhase) {
    const cfg = S.cfg, CB = cfg.combat, RM = CB.remnant;
    const loserBefore = loser.count, winnerBefore = winner.count, lead = biggestTeam() === loser, n = floodGroup(loser.id, cx, cy); // lead: the biggest swarm at rout time (M6 drops)
    for (let k = 0; k < n; k++) { const a = RQ[k], dx = a.x - cx, dy = a.y - cy; a.rd = Math.sqrt(dx * dx + dy * dy); }
    const group = RQ.slice(0, n).sort((p, q) => p.rd - q.rd); for (let k = 0; k < n; k++) RQ[k] = null; // a rare event: one small allocation is fine; stable sort keeps replays exact
    const full = (finalPhase && cfg.finale.fullFlip) || n < RM.minLoser; // finale.fullFlip (SPEC-v2 §6: true) is an M8 lever: false keeps the remnant rule after the horn
    let nFlip = full ? n : Math.round(RM.flipShare * n);
    if (!full) { let within = 0; for (const a of group) if (a.rd <= RM.flipRadius) within++; if (within < nFlip) nFlip = within; }
    const crown = finalPhase && !cfg.finale.crownAbsorbs && S.crown.team ? S.teams[S.crown.team] : null, got = z9(); // the crowned team absorbs nothing (SPEC-v2 §6)
    let flipped = 0, scattered = 0, fled = 0, farFlip = 0, minFlipX = Infinity;
    // the rout wave (SPEC-v2 §11, render only): each flipping survivor drops its fork and puts its hands up in the loser's colour, then turns
    // in a wave from the contact outward: polish.surrenderSeconds, plus up to polish.routWaveSeconds by distance (group is sorted by it)
    const PW = cfg.polish, nfl = Math.min(n, nFlip), rdMax = nfl > 0 ? Math.max(1, group[nfl - 1].rd) : 1;
    for (let k = 0; k < n; k++) {
      const a = group[k];
      if (k < nFlip) {
        if (a.rd > farFlip) farFlip = a.rd; if (a.x < minFlipX) minFlipX = a.x;
        const to = spoilsTeam(a, loser, winner);
        if (crown && to === crown.id) { scatter(a, cx, cy); scattered++; } else { convert(a, to, true); got[to]++; flipped++; }
        a.wTeam = loser.id; a.wT = S.t + PW.surrenderSeconds + PW.routWaveSeconds * Math.min(1, a.rd / rdMax); a.pop = -(a.wT - S.t); // the pop-in lands as the colour turns
      } else { a.escapeT = RM.escapeSeconds; a.ex = cx; a.ey = cy; a.tgt = null; a.fight = false; fled++; }
    }
    loser.engT[winner.id] = winner.engT[loser.id] = 0; loser.engL[winner.id] = winner.engL[loser.id] = 0; loser.engPk[winner.id] = winner.engPk[loser.id] = 0; loser.engHold[winner.id] = winner.engHold[loser.id] = 0;
    loser.engG[winner.id] = winner.engG[loser.id] = 0; loser.engGPk[winner.id] = winner.engGPk[loser.id] = 0;
    S.ev.routs++; if (fled) S.ev.remnants++; if (scattered) S.ev.scattered += scattered;
    if (fled && (winner.isPlayer || loser.isPlayer) && !S._hintRem) { S._hintRem = 1; S._hintRemTxt = winner.isPlayer ? "The rear of a beaten mob runs. Chase it down or let it go" : "Your rear got away. Regroup and recruit"; }
    if (fled) { loser.escUntil = S.t + RM.escapeSeconds; loser.escFrom = winner.id; planEscape(loser); if (!sandbox && (loser.isPlayer || fxOk(cx, cy))) PS.audio.scatter(); } // the remnant runs from the winner (M2 critic MAJOR-2), with a scatter sound where you see it (M7)
    if (fled && loser.ai) { loser.regroupUntil = S.t + RM.escapeSeconds + RM.regroupSeconds; loser.fleeFrom = winner.id; loser.thinkT = 0; }
    S.lastRout = { t: +S.t.toFixed(3), loser: loser.id, winner: winner.id, group: n, flipped, fled, scattered, outside: loserBefore - n, got: got.slice(), loserBefore, winnerBefore,
      cx: Math.round(cx), cy: Math.round(cy), farFlip: +farFlip.toFixed(1), minFlipX: minFlipX === Infinity ? null : Math.round(minFlipX) };
    if (winner.isPlayer) { if (!S.stats.routs && !sandbox) portal("happytime"); S.stats.routs++; PS.audio.rout(true); banner(scattered && !got[1] ? "ROUTED: " + scattered + " SCATTER" : "+" + got[1] + " JOIN YOU" + (fled ? " · " + fled + " FLED" : ""), winner.color, 2.6, winner.id, 2, "join"); S.shake = 0.35; }
    else if (loser.isPlayer) { S._routedBy = winner.name; S.relaxUntil = S.t + cfg.ai.relaxSeconds; /* relax window: no rival starts a hunt on you (SPEC-v2 §7) */ PS.audio.rout(false); S.shake = 0.5; if (flipped + scattered < loserBefore) banner(fled ? "SCATTERED: " + fled + " escaped" : "-" + (flipped + scattered) + " JOINED " + winner.name.toUpperCase(), "#FF7A6E", 2.4, 0, 2); }
    else if (playerSees(cx, cy)) { banner(loser.name.toUpperCase() + " routed by " + winner.name, winner.color, 2, winner.id, 0); if (fxOk(cx, cy)) PS.audio.rout(false); }
    else clashPing(cx, cy, true); // a rout you cannot see: no banner, it folds into the clash ping (SPEC-v2 §5)
    if (fxOk(cx, cy)) particles.ring(cx, cy, winner.color, 10, 120, 0.7);
    if (lead && n >= cfg.progression.dropMinShare * loserBefore) SPL.leaderDrop(loser, cx, cy); // a routed leader drops its tiers as relics (SPEC-v2 §8)
    recount();
  }
  function eliminate(t) {
    t.alive = false; t.count = 0; S.ev.elims.push([+S.t.toFixed(1), t.id]); if (S.crown.team === t.id) crownUpdate(); // the crown moves on at once
    buildTeamChips();
    if (!t.isPlayer && !S.attract) { banner(t.name.toUpperCase() + " ELIMINATED", t.color, 2.4); PS.audio.eliminated(); }
  }
  function pickup(p, teamId) {
    const cfg = S.cfg.powerups, t = S.teams[teamId];
    p.alive = false; p.t = cfg.respawn;
    if (p.kind === "rally") {
      let n = 0;
      for (const a of S.agents) { if (a.team !== 0 || a.dead || a.escapeT > 0 || a.gar) continue; const dx = a.x - p.x, dy = a.y - p.y; if (dx * dx + dy * dy < cfg.rallyRadius * cfg.rallyRadius) { convert(a, teamId, false); n++; } } // scattering survivors are in their escape window: no rally (M4: the crown absorbed a whole scatter through a Rally orb)
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
    for (const a of S.agents) { if (a.dead || a.team < 2 || a.team === 8 || a.escapeT > 0 || !onScreen(a.x, a.y) || (fogGate() && a.seenA < 0.5)) continue; const dx = a.x - w.x, dy = a.y - w.y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; chase = a.team; } }
    if (!chase) { let cd = 2.6 * pick * pick; const g = fogGate(); for (const c of S.camps) { if (!(g && !PS.fog.sees(1, c.x, c.y) ? c.kn[1] > 0 : c.n > 0)) continue; const dx = c.x - w.x, dy = c.y - w.y, d2 = dx * dx + dy * dy; if (d2 < cd) { cd = d2; gx = c.x; gy = c.y; } } } // snaps only to camps you know (M4: a hidden camp no longer pulls the tap)
    setRoute(gx, gy, chase, src || "tap", sx, sy);
  }
  function setRoute(x, y, chase, src, sx, sy) { const inp = S.input, r = inp.route; r.on = true; r.x = x; r.y = y; r.chase = chase; r.src = src; r.sx = sx; r.sy = sy; inp.hold = false; inp.preview = S.cfg.flow.previewSeconds; inp.routeT = performance.now(); }

  // ---------------------------------------------------------------- AI (SPEC-v2 §7)
  // AI think, one rival per tick: every due team waits its turn in round-robin order, so a tick carries at most one think (and one
  // "from me" field). thinkT counts sim seconds of fixed ticks, so it is tick-exact. aiCost times every think (the < 0.1 ms per tick gate).
  function aiTick(dt, D) {
    const n = S.teams.length, i0 = S.teams[1] && S.teams[1].ai ? 1 : 2; let pick = 0; S.aiCost.ticks++;
    for (let i = i0; i < n; i++) { const t = S.teams[i]; if (t.alive && t.ai) t.thinkT -= dt; }
    for (let k = 0; k < n; k++) { const i = (S.thinkRR + k) % n; if (i < i0) continue; const t = S.teams[i]; if (t.alive && t.ai && t.thinkT <= 0) { pick = i; break; } }
    if (pick) { const t = S.teams[pick], t0 = performance.now(); t.thinkT = S.attract ? S.cfg.ai.think : D.think; S.thinkRR = pick + 1; aiThink(t); const ms = performance.now() - t0, C = S.aiCost; C.ms += ms; C.thinks++; if (ms > C.max) C.max = ms; }
  }
  // every AI target is snapped along a ray back toward (fx, fy) (default: the team's own anchor): the edge of any rock facing it
  function aim(t, x, y, fx, fy) { const W = S.cfg.world.w, p = PS.flow.rayBack(fx == null ? t.ax : fx, fy == null ? t.ay : fy, clamp(x, 20, W - 20), clamp(y, 20, S.cfg.world.h - 20), null); t.tx = p.x; t.ty = p.y; }
  // heard noise: every engaged pair refreshes its slot each tick at the contact centroid; a slot lives ai.heardSeconds past its last refresh
  function noiseAt(a, b, x, y) {
    let s = null, free = null, old = null;
    for (const q of S.noise) { if (q.on && q.a === a && q.b === b) { s = q; break; } if (!q.on) { if (!free) free = q; } else if (!old || q.t1 < old.t1) old = q; }
    if (!s) { s = free || old; s.on = true; s.a = a; s.b = b; s.t0 = S.t; }
    s.x = x; s.y = y; s.t1 = S.t;
  }
  // the nearest clash team t hears (within min(maxD, its hearing radius), refreshed within ai.heardSeconds, not its own fight);
  // who > 0: only a clash that team is in
  function heardFight(t, maxD, who) {
    const hs = S.cfg.ai.heardSeconds, r = Math.min(maxD, t.hear); let best = null, bd = r * r;
    for (const q of S.noise) {
      if (!q.on) continue; if (S.t - q.t1 > hs) { q.on = false; continue; }
      if (q.a === t.id || q.b === t.id || (who && q.a !== who && q.b !== who)) continue;
      const dx = q.x - t.ax, dy = q.y - t.ay, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = q; }
    }
    return best;
  }
  // what team t knows of swarm o: its own sight (obs), else a ghost younger than win s, projected up to fog.aiLeadMax s ahead. Sets KP
  // (x, y, vx, vy, age, fresh: some of what it saw is outside an escape window). Counts are public (the pips).
  const KP = { x: 0, y: 0, vx: 0, vy: 0, age: 0, fresh: false };
  function knowOf(t, o, win) {
    const FS = S.fogS, ob = FS.obs[t.id][o.id];
    if (ob.seen) { KP.x = ob.x; KP.y = ob.y; KP.vx = ob.vx; KP.vy = ob.vy; KP.age = 0; KP.fresh = ob.n > ob.nEsc; return true; }
    const mm = FS.mem[t.id][o.id]; if (!mm.ever || S.t - mm.t > win) return false;
    const age = S.t - mm.t, la = Math.min(age, S.cfg.fog.aiLeadMax); KP.x = mm.x + mm.vx * la; KP.y = mm.y + mm.vy * la; KP.vx = mm.vx; KP.vy = mm.vy; KP.age = age; KP.fresh = mm.n > mm.nEsc; return true;
  }
  // the crown (SPEC-v2 §9): on the biggest living swarm, its position broadcast every finale.crownEvery s (crownEveryLate in the last
  // finale.crownLate s). Every swarm knows where the crown was at the last broadcast: the finale's announced exception to the fog.
  function crownUpdate(quiet) {
    const F = S.cfg.finale, C = S.crown, b = biggestTeam(); if (!b) { C.team = 0; return; }
    if (b.id !== C.team) { S.ev.crownMoves++; if (!quiet && !S.aiPlayer) banner(b.isPlayer ? "YOU WEAR THE CROWN: YOU ARE MARKED" : b.name.toUpperCase() + " TAKES THE CROWN", b.isPlayer ? "#FFD23F" : b.color, 2.6, 0, b.isPlayer ? 2 : 1); }
    C.team = b.id; C.x = b.ax; C.y = b.ay; C.t = S.t; C.next = S.t + (S.timeLeft <= F.crownLate ? F.crownEveryLate : F.crownEvery);
    if (!sandbox && !S.attract && !S.aiPlayer) PS.audio.crownPulse(b.isPlayer); // the broadcast is public (the finale's announced exception): a pulse each time
  }
  // pile-on (SPEC-v2 §7, C1 E): once the biggest swarm passes ai.pileOnRatio x the second (public counts), every rival that hears it fighting
  // joins that fight. The banner fires when the flag lands on a new leader, at most every ai.pileOnBannerCooldown s. Checked every 30 ticks.
  function pileTick() {
    const AI = S.cfg.ai, P = S.pile; let a = null, b = null;
    for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (!t.alive || !t.count) continue; if (!a || t.count > a.count) { b = a; a = t; } else if (!b || t.count > b.count) b = t; }
    const on = S.t >= AI.grace && !!a && !!b && a.count > AI.pileOnRatio * b.count, prev = P.id; P.id = on ? a.id : 0;
    if (on && prev !== a.id) { S.ev.pileOns++; if (S.t - P.bannerT >= AI.pileOnBannerCooldown) { P.bannerT = S.t; banner(a.isPlayer ? "THE VALLEY TURNS ON YOU" : "THE VALLEY TURNS ON " + a.name.toUpperCase(), "#FFE49A", 3, 0, a.isPlayer ? 2 : 1); } }
  }
  // Bully's scent (SPEC-v2 §7, announced): from ai.grace, every difficulty scentEvery s, Bully learns your position within ai.scentJitter px.
  // The first ping plays the war horn with "BULLY HAS YOUR SCENT"; later ones only pulse the minimap with a short low note.
  function scentTick() {
    const AI = S.cfg.ai, sc = S.scent; if (S.t < sc.next || S.t < AI.grace) return;
    sc.next = S.t + (S.attract ? S.cfg.difficulty.normal.scentEvery : diff().scentEvery);
    let b = null; for (let i = 2; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && t.count > 0 && t.kind === "bully") { b = t; break; } }
    const p = S.teams[1]; if (!b || !p || !p.alive || !p.count) return;
    const a = S.rng() * Math.PI * 2, r = Math.sqrt(S.rng()) * AI.scentJitter; sc.x = p.ax + Math.cos(a) * r; sc.y = p.ay + Math.sin(a) * r; sc.t = S.t; sc.n++; S.ev.scentPings++;
    b.scentX = sc.x; b.scentY = sc.y; b.scentT = S.t;
    if (S.aiPlayer) return;
    if (sc.n === 1) { banner("BULLY HAS YOUR SCENT", b.color, 2.6, 0, 2); PS.audio.warHorn(0.75); } else PS.audio.scentNote();
  }
  const edgeness = (x, y, W) => 1 - Math.min(x, y, W - x, W - y) / (W / 2); // 1 at the map edge, 0 at the centre (Wary)
  // Sly's lurk spot: the pass cell nearest an open objective (a power-up beacon within ai.objectiveSight, else the busiest camp it knows),
  // within lurkPassMax px of it
  function lurkSpot(t, P) {
    const AI = S.cfg.ai, os2 = AI.objectiveSight * AI.objectiveSight; let ox = 0, oy = 0, bd = Infinity, on = false;
    for (const p of S.powerups) { if (!p.alive) continue; const d = (p.x - t.ax) * (p.x - t.ax) + (p.y - t.ay) * (p.y - t.ay); if (d <= os2 && d < bd) { bd = d; ox = p.x; oy = p.y; on = true; } }
    if (!on) { let bn = 0; for (const c of S.camps) if (c.kn[t.id] > bn) { bn = c.kn[t.id]; ox = c.x; oy = c.y; on = true; } }
    if (!on) return false;
    const pc = S.map.place.passCells, N = S.map.N, cell = S.map.cell, lim = P.lurkPassMax * P.lurkPassMax; let bc = -1; bd = lim;
    for (let i = 0; i < pc.length; i++) { const c = pc[i], x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell, d = (x - ox) * (x - ox) + (y - oy) * (y - oy); if (d < bd) { bd = d; bc = c; } }
    if (bc < 0) return false;
    t.lurkX = ((bc % N) + 0.5) * cell; t.lurkY = (((bc / N) | 0) + 0.5) * cell; return true;
  }
  // Stubborn's claim: the camp cluster it knows (kn > 0, outside its own home meadow) with the most people within clusterRadius per path px
  function claimSite(t, P, dist) {
    const m = S.map, s = m.spawns[t.slot], TC = S.cfg.terrain, hr = (TC.homeRadius + TC.homeWall + 1) * m.cell + 60, cr2 = P.clusterRadius * P.clusterRadius; let best = null, bs = 0;
    for (const c of S.camps) {
      if (!(c.kn[t.id] > 0) || (s && (c.x - s.x) * (c.x - s.x) + (c.y - s.y) * (c.y - s.y) < hr * hr)) continue;
      let n = 0; for (const q of S.camps) if (q.kn[t.id] > 0 && (q.x - c.x) * (q.x - c.x) + (q.y - c.y) * (q.y - c.y) <= cr2) n += q.kn[t.id];
      const sc = n / (dist(c.x, c.y) + 300); if (sc > bs) { bs = sc; best = c; }
    }
    if (!best) return;
    t.claimX = best.x; t.claimY = best.y; t.claimOn = true; t.claimEmpty = S.t; S.fogS.ai.decisions++; S.fogS.ai.camps++;
  }
  // AI decisions on path distance (M2): a "from me" field out to ai.sight x flow.fromMeCap gives every distance aiThink uses, so a camp
  // behind a ridge scores as far as it really is; past the field's edge a distance is max(cap, straight x flow.farDetour). Sight stays a
  // straight line (terrain blocks movement, not sight). The team field then routes to whatever target is picked.
  // Knowledge (SPEC-v2 §7): a swarm is a threat or prey only while this AI sees it or remembers it: hunts t.mem s (difficulty 4 / 6 / 10)
  // projected at most fog.aiLeadMax s ahead, flight fog.aiFleeMemory s, routing ai.ghostKeep s. Camps: seen with people, within
  // ai.campKnowStart of its spawn, or smoke within fog.smoke. Objectives: power-up beacons within ai.objectiveSight. Noise: clashes within its
  // hearing. The two announced exceptions: Bully's scent and the finale crown. State machine, first match wins: FLEE (cornered: fight) >
  // CROWN (finale) > HUNT (huntTimeout, then huntCooldown) > PILE-ON > personality (Bully TRACK, Wary LEAVE, Sly INVESTIGATE / LURK,
  // Stubborn HOLD) > REGROUP > FORAGE > EXPLORE. Before ai.grace nobody hunts and every AI steers away from any swarm it sees.
  const TH = { ax: 0, ay: 0 }, PR = { x: 0, y: 0, vx: 0, vy: 0 }, VBX = new Float64Array(9), VBY = new Float64Array(9);
  function aiThink(t) {
    const cfg = S.cfg, P = t.ai, K = t.kind, AI = cfg.ai, FW = cfg.flow, FG = cfg.fog, FN = cfg.finale, FL = PS.flow, FS = S.fogS;
    const final = S.timeLeft <= cfg.world.finalSeconds, grace = !final && S.t < AI.grace, cap = AI.sight * FW.fromMeCap, me = FL.buildFromMe(t.id, t.ax, t.ay, cap);
    const dist = (x, y) => { const d = FL.pathPx(me, x, y); if (d >= 0) return d; const dx = x - t.ax, dy = y - t.ay; return Math.max(cap, Math.sqrt(dx * dx + dy * dy) * FW.farDetour); };
    const regroup = !final && S.t < t.regroupUntil, escaping = S.t < t.escUntil, hm = S.attract ? 1 : diff().huntMult, pw = t.count * teamPower(t);
    const crown = final && S.crown.team && S.crown.team !== t.id && S.teams[S.crown.team].alive ? S.teams[S.crown.team] : null;
    const R2 = K === "stubborn" ? P.holdRadius * P.holdRadius : 0, inRing = (x, y) => (x - t.claimX) * (x - t.claimX) + (y - t.claimY) * (y - t.claimY) <= R2;
    const holding = K === "stubborn" && t.claimOn && !final, fleeRatio = final ? AI.finalFleeRatio : holding && inRing(t.ax, t.ay) ? P.homeFleeRatio : P.fleeRatio;
    let threat = null, threatD = Infinity, prey = null, preyScore = 0, avoid = null, avoidD = AI.graceAvoid, nVB = 0;
    for (let i = 1; i < S.teams.length; i++) {
      const o = S.teams[i]; if (o === t || !o.alive || o.count === 0) continue;
      if (!knowOf(t, o, Math.max(t.mem, FG.aiFleeMemory))) continue; // never a swarm it has not seen (SPEC-v2 §7)
      const sp = PS.terrain.snapXY(KP.x, KP.y), ox = sp.x, oy = sp.y, age = KP.age, opw = o.count * teamPower(o);
      if (age === 0 && opw >= AI.campAvoidRatio * pw && nVB < 9) { VBX[nVB] = ox; VBY[nVB++] = oy; } // camp avoidance reads these
      const d = dist(ox, oy);
      if (grace) { if (age === 0 && d < avoidD) { avoid = o; avoidD = d; TH.ax = ox; TH.ay = oy; } continue; } // steer away, never hunt
      if (o !== crown && age <= FG.aiFleeMemory && opw >= pw * fleeRatio && d < threatD) { threat = o; threatD = d; TH.ax = ox; TH.ay = oy; }
      if (o === crown || regroup || escaping || !KP.fresh || age > t.mem || t.count < 3 || S.t < t.huntCooldown) continue;
      if (o.isPlayer && S.t < S.relaxUntil && t.preyId !== o.id) continue; // relax window: no new hunt on the player after it loses a fight
      let hr = P.huntRatio * hm * (o.isPlayer ? 1 : AI.aiVsAiHuntMult);
      if (K === "sly" && S.t - o.lastFight <= P.foughtSeconds) hr = P.foughtHuntRatio * (o.isPlayer ? hm : 1); // jump a swarm that just fought
      if (K === "stubborn") { if (!holding || !inRing(ox, oy)) continue; hr = P.huntRatio * (o.isPlayer ? hm : 1); } // only inside its ring
      if (pw < opw * hr) continue;
      const sc = (o.count + 2) / (d + 60) * (o.isPlayer ? P.hatesPlayer : 1);
      if (sc > preyScore) { preyScore = sc; prey = o; PR.x = ox; PR.y = oy; PR.vx = KP.vx; PR.vy = KP.vy; }
    }
    // grace: steer straight away from the nearest swarm it sees
    if (avoid) { knowSwarm(t, avoid, 0); const dx = t.ax - TH.ax, dy = t.ay - TH.ay, l = Math.sqrt(dx * dx + dy * dy) || 1, q = FL.rayOut(t.ax, t.ay, dx / l, dy / l, AI.fleeDistance, null); aim(t, q.x, q.y); t.state = "avoid"; t.preyId = 0; t.speedMod = AI.roamSpeed; return; }
    // FLEE, or turn and fight when caught (never while regrouping or escaping: M2 critic MAJOR-2)
    if (threat && threatD < AI.corneredDist && t.count >= 3 && !regroup && !escaping) { knowSwarm(t, threat, FG.aiFleeMemory); aim(t, TH.ax, TH.ay); t.state = "hunt"; t.preyId = threat.id; t.speedMod = AI.huntSpeed; return; }
    if (threat) { knowSwarm(t, threat, FG.aiFleeMemory); t.speedMod = AI.fleeSpeed; const q = fleeTarget(t, TH, me, false); aim(t, q.x, q.y); t.state = "flee"; t.preyId = 0; return; }
    // CROWN: every rival goes for the crowned leader; one under finale.underdogRatio x the leader closes to finale.closeTo px and commits only
    // once a second attacker it sees stands within finale.pairRadius of the crown, or it hears the leader fighting
    if (crown && !regroup && !escaping && t.count >= 3) {
      const L = crown, sees = knowOf(t, L, t.mem) && KP.age <= 1; let cx = S.crown.x, cy = S.crown.y; if (sees) { cx = KP.x; cy = KP.y; }
      let commit = pw >= FN.underdogRatio * L.count * teamPower(L);
      if (!commit && heardFight(t, 1e9, L.id)) commit = true;
      if (!commit) { const pr2 = FN.pairRadius * FN.pairRadius; for (let i = 1; i < S.teams.length && !commit; i++) { const o = S.teams[i], ob = FS.obs[t.id][i]; if (o !== t && o !== L && o.alive && o.count >= 3 && ob.seen && (ob.x - cx) * (ob.x - cx) + (ob.y - cy) * (ob.y - cy) <= pr2) commit = true; } }
      FS.ai.decisions++; FS.ai.crown++;
      if (commit) { if (sees) { knowSwarm(t, L, t.mem); aim(t, cx + KP.vx * AI.leadTime, cy + KP.vy * AI.leadTime, cx, cy); } else aim(t, cx, cy); t.state = "crown"; t.preyId = L.id; t.speedMod = AI.huntSpeed; return; }
      const dx = t.ax - cx, dy = t.ay - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > FN.closeTo) aim(t, cx + (dx / d) * FN.closeTo, cy + (dy / d) * FN.closeTo); else aim(t, t.ax, t.ay);
      t.state = "crownwait"; t.preyId = 0; t.speedMod = AI.roamSpeed; return;
    }
    // HUNT a swarm it sees or remembers (ai.huntTimeout s without contact starts ai.huntCooldown)
    if (prey) {
      if (t.state !== "hunt" || t.preyId !== prey.id) t.huntStart = S.t;
      let engagedAny = 0; for (let j = 1; j < 9; j++) engagedAny += t.eng[j];
      if (!final && S.t - t.huntStart > AI.huntTimeout && engagedAny === 0) { t.huntCooldown = S.t + AI.huntCooldown; prey = null; }
    }
    if (prey) { knowSwarm(t, prey, t.mem); aim(t, PR.x + PR.vx * AI.leadTime, PR.y + PR.vy * AI.leadTime, PR.x, PR.y); t.state = "hunt"; t.preyId = prey.id; t.speedMod = AI.huntSpeed; return; }
    t.preyId = 0;
    // PILE-ON: the valley turns on a runaway leader; a rival that hears it fighting joins that fight (hunts it on sight, whatever the ratio)
    if (!grace && S.pile.id && S.pile.id !== t.id && !regroup && !escaping && t.count >= 3 && !(S.pile.id === 1 && S.t < S.relaxUntil)) {
      const L = S.teams[S.pile.id], nz = L && L.alive ? heardFight(t, 1e9, L.id) : null;
      if (nz) {
        FS.ai.decisions++; FS.ai.noise++; t.speedMod = AI.huntSpeed;
        if (knowOf(t, L, t.mem) && KP.age === 0) { knowSwarm(t, L, t.mem); aim(t, KP.x, KP.y); if (t.state !== "hunt") t.huntStart = S.t; t.state = "hunt"; t.preyId = L.id; return; }
        aim(t, nz.x, nz.y); t.state = "pileon"; return;
      }
    }
    // personality moves (SPEC-v2 §7)
    if (!grace && !regroup && !escaping) {
      if (K === "bully" && S.t - t.scentT <= P.scentSearch) { // TRACK the last scent ping while big enough to take you on
        const pl = S.teams[1];
        if ((t.scentX - t.ax) * (t.scentX - t.ax) + (t.scentY - t.ay) * (t.scentY - t.ay) < 90 * 90) t.scentT = -1e9; // searched: nothing here
        else if (pl.alive && pl.count > 0 && S.t >= S.relaxUntil && pw >= pl.count * teamPower(pl) * P.huntRatio * hm * P.trackRatio) { FS.ai.decisions++; FS.ai.scent++; aim(t, t.scentX, t.scentY); t.state = "track"; t.speedMod = AI.roamSpeed; return; }
      } else if (K === "wary") { // LEAVE any area with a clash heard within clashLeave px
        let nz = null;
        if (S.t >= t.leaveUntil && (nz = heardFight(t, P.clashLeave, 0))) { FS.ai.decisions++; FS.ai.noise++; TH.ax = nz.x; TH.ay = nz.y; const q = fleeTarget(t, TH, me, false); t.lurkX = q.x; t.lurkY = q.y; t.leaveUntil = S.t + P.leaveSeconds; }
        if (S.t < t.leaveUntil) { aim(t, t.lurkX, t.lurkY); t.state = "leave"; t.speedMod = AI.roamSpeed; return; }
      } else if (K === "sly") { // INVESTIGATE a clash heard within clashGo px; else LURK at the pass nearest an open objective
        const nz = heardFight(t, P.clashGo, 0);
        if (nz) { FS.ai.decisions++; FS.ai.noise++; t.lurkUntil = -1e9; aim(t, nz.x, nz.y); t.state = "investigate"; t.speedMod = AI.huntSpeed; return; }
        if (S.t < t.lurkUntil) { aim(t, t.lurkX, t.lurkY); t.state = "lurk"; t.speedMod = AI.roamSpeed; return; }
        if (S.t >= t.lurkCool && lurkSpot(t, P)) { FS.ai.decisions++; t.lurkUntil = S.t + P.lurkSeconds + dist(t.lurkX, t.lurkY) / Math.max(60, t.spd); t.lurkCool = t.lurkUntil + P.lurkCooldown; aim(t, t.lurkX, t.lurkY); t.state = "lurk"; t.speedMod = AI.roamSpeed; return; }
      } else if (K === "stubborn" && !final) { // HOLD holdRadius px around a claimed camp cluster, foraging only inside it; leaves at the horn
        if (!t.claimOn) claimSite(t, P, dist);
        if (t.claimOn) {
          let bc = null, bs = 0;
          for (const c of S.camps) {
            if (!(c.kn[t.id] > 0) || !inRing(c.x, c.y)) continue; let skip = false; for (let k = 0; k < nVB; k++) if ((VBX[k] - c.x) * (VBX[k] - c.x) + (VBY[k] - c.y) * (VBY[k] - c.y) < AI.campAvoidRadius * AI.campAvoidRadius) { skip = true; break; }
            if (skip) continue; const sc = 1 / (dist(c.x, c.y) + 120); if (sc > bs) { bs = sc; bc = c; }
          }
          if (bc) { t.claimEmpty = S.t; knowCamp(t, bc); aim(t, bc.x, bc.y); } else { if (S.t - t.claimEmpty > P.reclaimEmpty) t.claimOn = false; aim(t, t.claimX, t.claimY); }
          t.state = "hold"; t.speedMod = AI.roamSpeed; return;
        }
      }
    }
    // REGROUP: a fresh remnant heads for camps away from the winner (it remembers the winner ai.ghostKeep s for routing)
    if (regroup) {
      const fo = S.teams[t.fleeFrom];
      if (fo && fo.alive && fo.count > 0 && knowOf(t, fo, AI.ghostKeep)) { knowSwarm(t, fo, AI.ghostKeep); TH.ax = KP.x; TH.ay = KP.y; const q = fleeTarget(t, TH, me, true); aim(t, q.x, q.y); t.state = "regroup"; t.speedMod = AI.roamSpeed; return; }
    }
    // FORAGE: value / (path distance + 120) over the camps it knows and the power-up beacons within ai.objectiveSight, skipping any camp
    // within ai.campAvoidRadius of a swarm it sees at >= ai.campAvoidRatio x its own count (R8: the biggest survival lever); Wary likes edges
    let bestC = null, bestS = 0, pu = false; const sm2 = FG.smoke * FG.smoke, av2 = AI.campAvoidRadius * AI.campAvoidRadius, os2 = AI.objectiveSight * AI.objectiveSight, W = cfg.world.w;
    for (const c of S.camps) {
      const dx = c.x - t.ax, dy = c.y - t.ay, smoke = c.n > 0 && dx * dx + dy * dy <= sm2; if (!(c.kn[t.id] > 0) && !smoke) continue;
      let skip = false; for (let k = 0; k < nVB; k++) if ((VBX[k] - c.x) * (VBX[k] - c.x) + (VBY[k] - c.y) * (VBY[k] - c.y) < av2) { skip = true; break; }
      if (skip) continue;
      let sc = P.neutralBias * AI.neutralScore / (dist(c.x, c.y) + 120); if (K === "wary") sc *= 1 + P.edgeBias * edgeness(c.x, c.y, W);
      if (sc > bestS) { bestS = sc; bestC = c; }
    }
    let tx = bestC ? bestC.x : t.cx, ty = bestC ? bestC.y : t.cy, po = null;
    for (const p of S.powerups) {
      if (!p.alive) continue; const dx = p.x - t.ax, dy = p.y - t.ay; if (dx * dx + dy * dy > os2) continue;
      const sc = P.powerBias * AI.powerScore / (dist(p.x, p.y) + 120); if (sc > bestS) { bestS = sc; tx = p.x; ty = p.y; pu = true; }
    }
    // spoils (SPEC-v2 §7, §8): the same roam score over the objectives it believes live, feasible on count x power (src/spoils.js aiPick)
    const op = SPL.aiPick(t, dist, pw, P.powerBias, nVB, VBX, VBY); if (op && op.score > bestS) { bestS = op.score; tx = op.x; ty = op.y; pu = true; po = op.obj; }
    if (bestS > 0) { if (po) SPL.knowObj(t, po); else if (!pu) knowCamp(t, bestC); aim(t, tx, ty); t.state = po ? "spoils" : "forage"; t.speedMod = AI.roamSpeed; return; }
    // EXPLORE: fog.exploreSamples points fog.exploreRing px away on walkable ground it has not explored, the nearest that does not lead toward
    // a bigger swarm it remembers (ai.ghostKeep); kept fog.exploreCommit s or until reached. Wary weighs edges.
    if (S.t >= t.exUntil || (t.exX - t.ax) * (t.exX - t.ax) + (t.exY - t.ay) * (t.exY - t.ay) < 60 * 60) {
      let nT = 0; for (let i = 1; i < S.teams.length && nT < 9; i++) { const o = S.teams[i]; if (o === t || !o.alive || o.count * teamPower(o) < pw) continue; if (knowOf(t, o, AI.ghostKeep)) { VBX[nT] = KP.x; VBY[nT++] = KP.y; } }
      const E = FG.exploreRing, ex = PS.fog.exploredArr(t.id), T = PS.terrain, m = S.map; let bx = 0, by = 0, bd = Infinity;
      for (let k = 0; k < FG.exploreSamples; k++) {
        const a = S.rng() * Math.PI * 2, d = E[0] + S.rng() * (E[1] - E[0]), x = t.ax + Math.cos(a) * d, y = t.ay + Math.sin(a) * d, c = T.cellOf(x, y);
        if (c < 0 || !T.walkT(m.terr[c]) || m.region[c] !== 1 || (ex && ex[c])) continue;
        let toward = false; for (let q = 0; q < nT; q++) if ((VBX[q] - x) * (VBX[q] - x) + (VBY[q] - y) * (VBY[q] - y) < (VBX[q] - t.ax) * (VBX[q] - t.ax) + (VBY[q] - t.ay) * (VBY[q] - t.ay)) { toward = true; break; }
        if (toward) continue;
        const s = K === "wary" ? d * (1 - 0.5 * P.edgeBias * edgeness(x, y, W)) : d; if (s < bd) { bd = s; bx = x; by = y; }
      }
      if (bd === Infinity) { const p = randPos(); bx = p.x; by = p.y; }
      t.exX = bx; t.exY = by; t.exUntil = S.t + FG.exploreCommit; FS.ai.explore++;
    }
    aim(t, t.exX, t.exY); t.state = "explore"; t.speedMod = AI.roamSpeed;
  }
  // PS.ai.assertKnowledge (SPEC-v2 §7): a swarm an AI targets must be in its sight (obs) or inside the memory window that decision uses (win);
  // a camp must be one it has seen with people, knew from its spawn, or whose smoke is in range. Counted always (sandboxes too); the first
  // violation logs a console error. Crown, scent and noise targets are places, announced or heard, and are counted separately.
  function knowSwarm(t, o, win) {
    const FS = S.fogS, K = FS.ai, ob = FS.obs[t.id][o.id], mm = FS.mem[t.id][o.id]; K.decisions++; K.swarm++;
    if (!ob.seen && !(mm.ever && S.t - mm.t <= win + 1e-9)) knowFail(t, "swarm " + o.name);
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
    const C = S.cfg.camera, hi = S.zDpr >= 2, lo = S.input.touch ? C.zoomMinTouch : C.zoomMin, key = (hi ? "2:" : "1:") + lo;
    return stepCache[key] || (stepCache[key] = (() => { const a = (hi ? C.steps.dpr2 : C.steps.dpr1).filter((z) => z >= lo - 1e-9 && z <= C.zoomMax + 1e-9); return a.length ? a : [1]; })());
  }
  function zoomRule(n, dt, now) {
    if (!S.cfg) return;
    if (S.zoomLock) { S.cam.zoom = S.zoomLock; return; } // debug: PS.artScene pins a zoom for screenshots
    const C = S.cfg.camera, Z = S.camS, st = zoomSteps(), raw = Math.min(S.vw, S.vh) / (C.span0 + C.spanK * Math.sqrt(Math.max(1, n)));
    let i = Z.i;
    if (now || i < 0 || Z.steps !== st) { i = 0; for (let k = 1; k < st.length; k++) if (Math.abs(st[k] - raw) < Math.abs(st[i] - raw)) i = k; }
    else { for (let g = 0; g < st.length && i + 1 < st.length && raw > ((st[i] + st[i + 1]) / 2) * (1 + C.hysteresis); g++) i++; for (let g = 0; g < st.length && i > 0 && raw < ((st[i] + st[i - 1]) / 2) * (1 - C.hysteresis); g++) i--; }
    if (now || i !== Z.i || Z.steps !== st) { Z.from = now || Z.i < 0 ? st[i] : S.cam.zoom; Z.t = now || Z.i < 0 ? C.ease : 0; Z.i = i; Z.steps = st; }
    Z.t = Math.min(C.ease, Z.t + dt); const k = C.ease > 0 ? Z.t / C.ease : 1, e = k * k * (3 - 2 * k);
    S.cam.zoom = Z.from + (st[i] - Z.from) * e;
  }

  // the clash panel's read of the player's fight with rival ri (M5 critic MAJOR-1): the two engaged GROUPS (fighting mode: the rout group each
  // side would lose, the flood fill; radius mode: whole counts) x power (M6: the Arms equivalence) x morale (the group's survivors over its
  // peak this clash). It opens on the group ratio and morale moves it: WINNING at >= combat.verdictRatio, LOSING at <= 1 / it, else EVEN,
  // so a 1.4x group is never read EVEN at contact. f (the bar) = q / (1 + q).
  const teamPower = (t) => t.power || 1; // M6: the Arms headcount equivalence (progression.armsPower, measured with PS.fight)
  const CR = { f: 0.5, verdict: "EVEN", a: 0, b: 0, q: 1 };
  function clashRead(pl, t) {
    const ri = t.id, pa = teamPower(pl), pb = teamPower(t), fm = S.cfg.combat.localMode !== "radius", vr = S.cfg.combat.verdictRatio;
    const mA = fm ? pl.engG[ri] / Math.max(1, pl.engGPk[ri]) : pl.engL[ri] / Math.max(1, pl.engPk[ri]), mB = fm ? t.engG[pl.id] / Math.max(1, t.engGPk[pl.id]) : t.engL[pl.id] / Math.max(1, t.engPk[pl.id]);
    const gA = fm && pl.engGPk[ri] > 0 ? pl.engGPk[ri] : pl.count, gB = fm && t.engGPk[pl.id] > 0 ? t.engGPk[pl.id] : t.count; // each group at its peak; morale carries the losses
    const q = (gA * pa * Math.max(0.05, mA)) / Math.max(1e-6, gB * pb * Math.max(0.05, mB));
    CR.a = Math.round(pl.count * pa); CR.b = Math.round(t.count * pb); CR.q = q; CR.f = q / (1 + q); CR.verdict = q >= vr ? "WINNING" : q <= 1 / vr ? "LOSING" : "EVEN";
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
  // banners (M5 critic MAJOR-2): a priority queue, one shown at a time. pri 2 = news about you (your routs, the crown on you, the scent, your
  // spoils), 1 = the match (the horn, eliminations, pile-ons), 0 = rival-vs-rival news. A higher one preempts: the banner showing keeps
  // banner.minSeconds, then goes; while more wait, each shows banner.queuedSeconds; rival news is dropped when banner.dropDepth already
  // wait and expires after banner.staleSeconds in the queue. at: a team id whose banner bearer it anchors to.
  function banner(text, color, life, at, pri, kind) {
    if (S.attract) return; const Q = S.banners, B = S.cfg.banner; pri = pri == null ? 1 : pri;
    if (pri === 0 && Q.length > B.dropDepth) return;
    if (Q.length && pri > Q[0].pri) { const c = Q[0], shown = c.life0 - c.life; if (shown > 0) c.life = Math.min(c.life, Math.max(0.001, B.minSeconds - shown)); }
    let i = Q.length; while (i > 0 && Q[i - 1].pri < pri && !(i === 1 && Q[0].life0 - Q[0].life > 0)) i--; // never ahead of the one already showing
    Q.splice(i, 0, { text, color, life, life0: life, at: at || 0, pri, t0: S.t, kind: kind || "" });
  }
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
    PS.audio.stopDrum(); PS.audio.murmur(0); PS.audio.melee(0);
    if (S.fogS && S.fogS.dawnT0 < 0 && !sandbox) S.fogS.dawnT0 = S.t; // any end lifts the fog (M7: the lose screen's grey frame shows the valley, not the dark)
    const dawn = S.fogS && S.fogS.dawnT0 >= 0 ? S.cfg.fog.dawnSeconds : 0;
    S.pendingEnd = { won, why, at: S.t + Math.max(won ? 0.9 : 1.2, dawn) }; // sim-time delay: pausing defers it, newGame clears it
  }
  function finishEnd() {
    if (sandbox) return;
    const { won, why } = S.pendingEnd; S.pendingEnd = null; portal("gameplayStop"); if (won) portal("happytime");
    S.endT0 = performance.now(); if (!won && SCR) { draw(); SCR.loseSnap(canvas); } // the lose screen's one cached desaturation pass of this frame (drawn now: the dawn has lifted the fog)
    {
      S.mode = won ? "win" : "lose";
      if (won) PS.audio.win(); else PS.audio.lose();
      $(won ? "win-sub" : "lose-sub").textContent = why;
      const st = S.stats, el = $(won ? "win-stats" : "lose-stats");
      const mm = Math.floor((S.cfg.world.matchSeconds - Math.max(0, S.timeLeft)) / 60), ss = Math.floor((S.cfg.world.matchSeconds - Math.max(0, S.timeLeft)) % 60);
      el.innerHTML = [["Peak swarm", st.peak], ["Recruited", st.recruited], ["Routs", st.routs], ["Kills", st.kills], ["Relic tiers", S.teams[1].tierN], ["Time", mm + ":" + (ss < 10 ? "0" : "") + ss]]
        .map(([k, v]) => "<div class='stat'><b>" + v + "</b><span>" + k + "</span></div>").join("");
      saveRecord(won, st.peak, S.cfg.world.matchSeconds - Math.max(0, S.timeLeft));
      showOverlay(won ? "ov-win" : "ov-lose"); $("hud").classList.add("hidden"); setHuddle(false); // the end screens own the view (the staging sits where HUDDLE and the minimap were)
    }
  }
  // the records panel on the title (SPEC-v2 §8): best peak, wins and fastest win per difficulty in one localStorage key, every access in
  // try/catch (a private window or blocked storage just shows dashes). Sandboxes and all-AI QA matches never write it.
  const REC_KEY = "ps.records";
  function readRecords() { try { const o = JSON.parse(localStorage.getItem(REC_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
  function saveRecord(won, peak, secs) {
    if (sandbox || S.aiPlayer || S.attract) return; const R = readRecords(), d = R[S.difficulty] || (R[S.difficulty] = { peak: 0, wins: 0, fastest: 0 });
    if (peak > d.peak) d.peak = peak; if (won) { d.wins++; if (!d.fastest || secs < d.fastest) d.fastest = Math.round(secs); }
    try { localStorage.setItem(REC_KEY, JSON.stringify(R)); } catch (e) {} renderRecords();
  }
  function renderRecords() {
    const el = $("records"); if (!el || !S.cfg) return; const R = readRecords(), ks = Object.keys(S.cfg.difficulty), f = (s) => (s ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : "-");
    const any = ks.some((k) => R[k] && (R[k].peak || R[k].wins)); el.classList.toggle("empty", !any); if (!any) { el.innerHTML = ""; return; }
    el.innerHTML = "<table><tr><th></th>" + ks.map((k) => "<th>" + S.cfg.difficulty[k].label + "</th>").join("") + "</tr>" +
      [["Best peak", (d) => d.peak || "-"], ["Wins", (d) => d.wins || 0], ["Fastest win", (d) => f(d.fastest)]].map(([l, g]) => "<tr><td>" + l + "</td>" + ks.map((k) => "<td>" + g(R[k] || {}) + "</td>").join("") + "</tr>").join("") + "</table>";
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
    if (S.mode === "play") { // (the title is the painted valley since M7: no attract sim behind it)
      // live play catches up at most 2 ticks per frame and drops the rest; the hidden-tab fallback clock may run 8
      S.acc += raw; let n = Math.floor(S.acc / DT + 1e-6); const cap = fromFallback ? 8 : 2;
      if (n > cap) { n = cap; S.acc = 0; } else S.acc = Math.max(0, S.acc - n * DT);
      const reps = S.attract ? 1 : S.pace;
      for (let k = 0; k < n; k++) for (let i = 0; i < reps; i++) { if (S.mode === "play") update(DT); }
      const jt = Math.min(raw, 0.1); particles.update(jt); smokeP.update(jt); floaters.update(jt); if (S.input.preview > 0) S.input.preview -= jt; // juice runs on frame time (studio lesson 2)
      if (S.mode === "play") updateHUD();
    } else S.acc = 0;
    draw(); PS.audio.pump(); // cues on the end screens and the title are reaped too
    if (!fromFallback) frameCost(performance.now() - wall, Math.min(raw, 0.1));
  }
  // adaptive DPR (SPEC-v2 §13): the p90 of the last polish.dprWindow frames' script ms (sim ticks + draw); over polish.dprP90Ms for
  // polish.dprHoldSeconds of frames steps the canvas down one tier of polish.dprTiers (2 -> 1.5 -> 1), never up. ?debug=1 shows all three.
  const FCS = new Float32Array(240); let FCT = null, fcsN = 0, dbgT = 0;
  function frameCost(ms, dt) {
    const P = S.cfg.polish, n = Math.min(P.dprWindow, FCS.length); FCS[fcsN % n] = ms; fcsN++;
    if (fcsN >= n && fcsN % 15 === 0) { if (!FCT || FCT.length !== n) FCT = new Float32Array(n); for (let i = 0; i < n; i++) FCT[i] = FCS[i]; FCT.sort(); S.scriptP90 = FCT[Math.floor(0.9 * (n - 1))]; }
    if ((S.mode === "play" || S.mode === "title") && fcsN >= n) {
      S.dprHot = S.scriptP90 > P.dprP90Ms ? S.dprHot + dt : 0;
      if (S.dprHot >= P.dprHoldSeconds) { let next = 0; for (const d of P.dprTiers) if (d < S.dpr - 1e-6 && d > next) next = d; if (next > 0) { S.dprCap = next; resize(); } S.dprHot = 0; fcsN = 0; }
    } else S.dprHot = 0;
    if (S.debug && performance.now() - dbgT > 500) debugLine();
  }
  // ?debug=1 readout (SPEC-v2 §13): fps, p90 script ms per frame, DPR tier, agents, zoom, seed, fog ms, and a live nofog toggle (one sitting on
  // a phone gives the fog A/B)
  function debugLine() {
    dbgT = performance.now(); const el = $("dbg"); if (!el) return;
    if (!el.firstChild) { el.innerHTML = "<span></span><br><button id='dbg-nofog'></button>"; $("dbg-nofog").onclick = (e) => { e.stopPropagation(); NOFOG = !NOFOG; debugLine(); }; }
    const fs = PS.flow.stats, tier = S.cfg.polish.dprTiers.indexOf(S.dprCap);
    const au = PS.audio.meter(); // P2: the limiter's gain reduction now and the voices sounding (lanes mid-envelope, live cues, the two beds)
    el.firstChild.textContent = "fps " + S.fps + "  p90 " + S.scriptP90.toFixed(1) + " ms  DPR " + S.dpr + (tier > 0 ? " (tier " + (tier + 1) + ")" : "") + "\nagents " + S.agents.length + "/" + S.cap + "  zoom " + S.cam.zoom.toFixed(2) + "  fog " + fogLastMs.toFixed(2) + " ms\nseed " + S.seed + "  fields " + (fs ? fs.rebuilds : "-") + (S.fixture ? "  " + S.fixture.name : "") +
      "\naudio " + (au ? "lim " + au.red.toFixed(1) + " dB  voices " + au.voices + " (cues " + au.cues + ")" : "off (no gesture yet)");
    $("dbg-nofog").textContent = NOFOG ? "fog: OFF (tap for on)" : "fog: on (tap for off)";
  }

  // ---------------------------------------------------------------- ground chunk cache (SPEC-v2 §2): 512 world px chunks at 256 art px, drawn at 2x
  // Static ground is painted per chunk by src/ground.js at art resolution (macro patches, pass floors, trails, decal clusters, autotiled
  // cliffs, water, fords, bridges, pines, cast shadows); chunks with water get a second frame, swapped every terrain.waterFrameMs. Visible
  // dirty chunks bake at once, the rest one per frame. Camp dirt, props, trees and power-ups stay sprites.
  function ground(m) {
    if (m.chunks) return m.chunks;
    const cfg = S.cfg.terrain, n = Math.ceil(S.cfg.world.w / cfg.chunk), N = m.N, per = cfg.chunk / m.cell, water = new Uint8Array(n * n);
    for (let c = 0; c < N * N; c++) if (m.terr[c] === 2 || m.terr[c] === 3) { const i = ((c % N) / per) | 0, j = (((c / N) | 0) / per) | 0; water[j * n + i] = 1; }
    return (m.chunks = { n, cvA: new Array(n * n).fill(null), cvB: new Array(n * n).fill(null), water, dirty: new Uint8Array(n * n).fill(1), left: n * n, scan: 0 });
  }
  function groundInvalidate(m) { const G = ground(m); G.dirty.fill(1); G.left = G.n * G.n; }
  function releaseGround(m) { const G = m.chunks; if (!G) return; for (const cv of G.cvA.concat(G.cvB)) if (cv) { cv.width = 0; cv.height = 0; } m.chunks = null; }
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  const GP = { n: 0, CH: 0, AP: 0, A: null, trails: null, decals: null, spr: null }; // reused paint options
  function bakeChunk(m, G, ci) {
    const AP = S.cfg.terrain.chunkArt;
    if (!G.cvA[ci]) G.cvA[ci] = mkCanvas(AP, AP);
    if (G.water[ci] && !G.cvB[ci]) G.cvB[ci] = mkCanvas(AP, AP);
    GP.n = G.n; GP.CH = S.cfg.terrain.chunk; GP.AP = AP; GP.A = S.cfg.art; GP.trails = S.trails; GP.decals = S.decals; GP.spr = S.spr;
    PS.ground.paint(G.cvA[ci], G.water[ci] ? G.cvB[ci] : null, m, ci, GP);
    if (G.dirty[ci]) { G.dirty[ci] = 0; G.left--; }
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
  // under the painted title the world is not drawn, but its caches stay whole as in play (M7): one pending chunk baked a frame and the
  // cache probe over the camera's view, so a match starts on baked ground and a discarded backing store heals without any browser event
  function titleCaches() {
    if (!S.map) return; const G = ground(S.map), n = G.n, z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z;
    if (G.left > 0) { for (let q = 0; q < n * n; q++) { const ci = (G.scan + q) % (n * n); if (G.dirty[ci] || !G.cvA[ci]) { bakeChunk(S.map, G, ci); G.scan = ci + 1; break; } } }
    cacheProbe(S.cam.x - hw, S.cam.y - hh, S.cam.x + hw, S.cam.y + hh, false);
  }
  function flushGround(m) { const G = ground(m); for (let ci = 0; ci < G.n * G.n; ci++) if (G.dirty[ci] || !G.cvA[ci]) bakeChunk(m, G, ci); }

  // minimap terrain (SPEC-v2 §5): one pixel per cell in a parchment palette (the map metaphor lives on the minimap only, R7); under fog only
  // the cells you have explored, the rest dark slate. An ImageData re-put from the typed arrays: the rect you explored since the last
  // redraw, or all of it for a new map or world, a dawn reveal, and on cache recovery (full = true)
  // parchment colours from PS.PAL.parch: grass, rock, water, ford, bridge by terrain code, the high rock, unexplored, props
  let MPAL = null, MHIGH = null, MUNEX = null, MOBST = null;
  let miniTerr = null, miniImg = null, miniKey = "", miniT = -1e9, miniFrame = 0;
  function minimapBake(full) {
    const m = S.map; if (!m) return; const N = m.N, w = S.fogW, all = !fogGate(), lvl = PS.ground.mapArt(m, S.cfg.art).lvl, key = m.id + ":" + (w ? w.id + "." + w.gen : "-") + ":" + all;
    if (!MPAL) { const P = PS.PAL.parch, r = PS.PAL.rgb; MPAL = [P.grass, P.rock, P.water, P.ford, P.bridge].map(r); MHIGH = r(P.high); MUNEX = r(P.unex); MOBST = r(P.prop); }
    if (!miniTerr || miniTerr.width !== N) { if (miniTerr) { miniTerr.width = 0; miniTerr.height = 0; } miniTerr = mkCanvas(N, N); miniImg = null; }
    const g = miniTerr.getContext("2d"); if (!miniImg) { miniImg = g.createImageData(N, N); full = true; }
    let x0 = 0, y0 = 0, x1 = N - 1, y1 = N - 1;
    if (!full && key === miniKey) { if (!w || w.mx1 < 0) return; x0 = w.mx0; y0 = w.my0; x1 = w.mx1; y1 = w.my1; }
    const d = miniImg.data, ex = w ? w.explored[1] : null;
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const c = j * N + i, q = c * 4, k = all || (ex && ex[c]) ? (lvl[c] === 2 ? MHIGH : MPAL[m.terr[c]] || MPAL[0]) : MUNEX; d[q] = k[0]; d[q + 1] = k[1]; d[q + 2] = k[2]; d[q + 3] = 255; }
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
  const snap2 = (v) => ((v * 0.5) | 0) * 2; // the 2 world px art grid (one art pixel)
  let agentsDrawn = 0; // agents drawn in the last frame (the one-draw-per-agent check)
  // banner bearers (SPEC-v2 §11): one per swarm at its centroid (a rival's: the centroid of what you see of it, and only where you see
  // that point), four size tiers at art.bannerTiers. Per team this frame: pole base BX/BY, pennant top BTOP, tier, drawn (BON). Name tags,
  // verdict marks, the crown and anchored banners ("+N JOIN YOU") sit above it.
  const BX = new Float64Array(9), BY = new Float64Array(9), BTOP = new Float64Array(9), BON = new Uint8Array(9), BTIER = new Uint8Array(9);
  const BNE = []; for (let i = 0; i < 9; i++) BNE.push({ bn: true, tm: i, x: 0, y: 0 });
  const TAGS = []; for (let i = 0; i < 9; i++) TAGS.push({ i: 0, x: 0, y: 0, w: 0, label: "" }); // name tags this frame (layout pass)
  function bannerPrep(gate, x0, y0, x1, y1, DL) {
    const A = S.cfg.art, T = A.bannerTiers; BON.fill(0);
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count < A.bannerMin || !t.ban) continue;
      let x = t.cx, y = t.cy;
      if (gate && i > 1) { if (!PVN[i]) continue; x = PVX[i] / PVN[i]; y = PVY[i] / PVN[i]; if (!playerSees(x, y)) continue; }
      const tier = t.count >= T[2] ? 3 : t.count >= T[1] ? 2 : t.count >= T[0] ? 1 : 0, by = y + A.bannerLift;
      BX[i] = x; BY[i] = by; BTIER[i] = tier; BTOP[i] = by - (t.ban.py - t.ban.top[tier]) * 2; BON[i] = 1;
      if (x < x0 - 60 || x > x1 + 60 || by < y0 - 20 || BTOP[i] > y1 + 20) continue;
      const e = BNE[i]; e.x = x; e.y = by; DL.push(e); if (i > 1) tagMask |= 1 << i; // a rival's banner is a tag for the leak check
    }
  }
  function drawBanner(e) {
    const i = e.tm, b = S.teams[i].ban, fr = ((((performance.now() / S.cfg.art.bannerFrameMs) | 0) + i) % 3);
    ctx.drawImage(b.cv, fr * b.bw, BTIER[i] * b.bh, b.bw, b.bh, snap2(e.x) - b.px * 2, snap2(e.y) - b.py * 2, b.bw * 2, b.bh * 2);
    SPL.drawHorn(ctx, S.teams[i], e.x, BTOP[i]); // Horn I-II: a horn on the banner bearer (M6)
  }
  function draw() {
    const cfg = S.cfg, spr = S.spr, z = S.cam.zoom, dpr = S.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (S.mode === "title" && SCR && S.teams[1] && !POSTER) { SCR.title(ctx, S.vw, S.vh, dpr, performance.now() / 1000, spr, S.teams[1]); titleCaches(); return; } // the painted valley (SPEC-v2 §11)
    if (S.mode === "lose" && SCR && S.teams[1] && SCR.lose(ctx, S.vw, S.vh, dpr, (performance.now() - S.endT0) / 1000, spr, S.teams[1])) return; // one cached grey frame, your banner falling
    ctx.fillStyle = PS.PAL.stone[3]; ctx.fillRect(0, 0, S.vw, S.vh); // past the world edge: more high rim
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
    for (const c of S.camps) if ((!gate || c.kn[1] >= 0) && c.x > x0 - 40 && c.x < x1 + 40 && c.y > y0 - 30 && c.y < y1 + 30) { const im = spr.camps[(((c.x | 0) * 31 + (c.y | 0) * 17) >>> 2) & 3]; ctx.drawImage(im, snap2(c.x) - im.width, snap2(c.y) - im.height, im.width * 2, im.height * 2); }
    SPL.drawGround(ctx, gate, x0, y0, x1, y1); // M6: bandit camp dirt and the have/need rings of villages and heavy chests (last-seen under fog)

    // visibility and the fog.fadeSeconds fade (seenA) of every agent that is not yours, the per-frame view of each rival (PV*), and the draw
    // list. Agents outside the view snap to their state so none enters mid-fade; the fade steps by frame time or sim time, whichever is
    // larger, so a fading agent is never drawn more than fog.fadeSeconds of sim time after you last saw it (SPEC-v2 §5)
    f0 = performance.now();
    const V1 = gate ? PS.fog.vis(1) : null, v1 = gate ? PS.fog.verOf(1) : 0, NC = PS.fog.N, cell = S.map.cell, lim = NC * cell, fstep = Math.max(dtF, dtS, DT) / FG.fadeSeconds;
    for (let i = 0; i < 9; i++) { PVN[i] = 0; PVX[i] = 0; PVY[i] = 0; PVMY[i] = 1e9; }
    const DL = S.drawList; DL.length = 0;
    for (const a of S.agents) {
      if (a.gar) continue; // a village garrison is inside its palisade (the number on the gate stands for it)
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
      if (d > 30) { ctx.globalAlpha = 0.85; ctx.drawImage(spr.marker, snap2(pl.tx) - 6, snap2(pl.ty) - 20, spr.marker.width * 2, spr.marker.height * 2); ctx.globalAlpha = 0.5; ctx.strokeStyle = pl.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.tx, pl.ty, 6 + 2 * Math.sin(S.t * 6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
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
      ctx.drawImage(spr.shadow, snap2(p.x) - 8, snap2(p.y) + 4, 16, 6);
      ctx.drawImage(pu.icon, p.x - 12, p.y - 16 + bob, 24, 24);
    }

    // the sort list: agents (at their seenA), trees and rocks, and one banner bearer per swarm you see (SPEC-v2 §11). Shadows are baked into
    // every peasant frame and every tree and rock, so each thing is ONE drawImage (the hit flash is a baked frame too). Sprites sit on the
    // 2 world px art grid.
    for (const o of S.obstacles) { if (o.x < x0 - 40 || o.x > x1 + 40 || o.y < y0 - 60 || o.y > y1 + 30) continue; DL.push(o); }
    SPL.pushProps(DL, gate, x0, y0, x1, y1); // M6 props in the y-sort: villages, chests, heavy chests, bandit tents, ground relics (seen ones only under fog)
    bannerPrep(gate, x0, y0, x1, y1, DL);
    DL.sort(byY);
    const hpMax = cfg.polish.hpBarMax, A = cfg.art, neutralSet = spr._neutral || (spr._neutral = spr.peasantSet(cfg.neutral.color, "straw")), banditSet = spr._bandit || (spr._bandit = spr.peasantSet(PS.PAL.bandit[1], "kerchief")), fid = S.frameId, FWp = spr.FW, FHp = spr.FH, flashMin = A.flashMin, bHp = cfg.encampments.banditHp;
    let nAg = 0;
    for (const e of DL) {
      if (e.team === undefined) {
        if (e.bn) { drawBanner(e); continue; }
        if (e.pr) { SPL.drawProp(ctx, e, gate); continue; }
        if (e.v < 0) e.v = e.kind === 2 ? ((((e.x | 0) * 13 + (e.y | 0) * 7) >>> 3) & 1) : PS.ground.biome(S.map, e.x, e.y, A) > A.highAbove ? 2 : e.kind; // render variant: pines on highland
        const im = e.kind === 2 ? spr.rocks[e.v] : spr.trees[e.v], cv = im.cv;
        ctx.drawImage(cv, snap2(e.x) - im.ax * 2, snap2(e.y) + 6 - im.ay * 2, cv.width * 2, cv.height * 2);
        continue;
      }
      const wave = e.wT > S.t, wt = wave ? e.wTeam : e.team; // the rout wave: still the loser's colour, hands up, until its turn (M7, render only)
      const set = wt === 8 ? banditSet : wt ? S.teams[wt].spr : neutralSet, al = e.seenA, left = e.face < 0;
      const moving = e.vx * e.vx + e.vy * e.vy > 120;
      const fi = wave ? 3 + (left ? 4 : 0) : (e.lunge > 0.08 ? 2 : moving ? ((e.ph | 0) % 2) : 3) + (left ? 4 : 0) + (e.fl > flashMin ? 8 : 0);
      let sc = 1; if (e.pop > 0 && e.pop < 0.3) sc = 1 + 0.55 * (1 - e.pop / 0.3);
      const k2 = 2 * sc, gx = sc === 1 ? snap2(e.x) : e.x, gy = sc === 1 ? snap2(e.y) : e.y, dx = gx - (left ? set.axL : set.axR) * k2, dy = gy + 2 - set.ay * k2;
      if (e.team !== 1) e.drawnF = fid;
      nAg++;
      if (e.escapeT > 0) { ctx.globalAlpha = al * (0.6 + 0.25 * ((e.ph | 0) & 1)); ctx.drawImage(set.atlas, set.sx[fi], set.sy[fi], FWp, FHp, dx, dy, FWp * k2, FHp * k2); ctx.globalAlpha = al; ctx.fillStyle = PS.PAL.cream; ctx.fillRect(gx - 8, dy + 8, 2, 4); ctx.fillRect(gx + 6, dy + 8, 2, 4); ctx.globalAlpha = 1; continue; } // remnant: hands up, run
      if (al < 1) ctx.globalAlpha = al;
      ctx.drawImage(set.atlas, set.sx[fi], set.sy[fi], FWp, FHp, dx, dy, FWp * k2, FHp * k2);
      if (wave) { ctx.fillStyle = PS.PAL.cream; ctx.fillRect(gx - 8, dy + 6, 2, 4); ctx.fillRect(gx + 6, dy + 6, 2, 4); ctx.fillStyle = "#6B4A2E"; ctx.fillRect(gx + (left ? -12 : 4), gy + 2, 8, 2); if (al < 1) ctx.globalAlpha = 1; continue; } // hands up, the fork dropped at its feet
      const hm = e.team === 8 ? bHp : e.team ? S.teams[e.team].hpMax : cfg.agent.hp; // Arms raise a team's max hp (M6)
      if (e.hp < hm && e.team && (e.team === 8 || S.teams[e.team].count <= hpMax)) { /* HP bars hide in swarms over polish.hpBarMax (SPEC-v2 §11) */ ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(gx - 6, dy + 2, 12, 2); ctx.fillStyle = e.hp <= 1 ? "#FF5C5C" : "#FFD23F"; ctx.fillRect(gx - 6, dy + 2, 12 * (e.hp / hm), 2); } // HP bar respects seenA
      if (al < 1) ctx.globalAlpha = 1;
    }
    agentsDrawn = nAg;

    // contact-line dust (SPEC-v2 §11, render only): puffs along the line where two swarms you can see are fighting, across the axis between them
    if (S.mode === "play" && !S.attract) { const P = cfg.polish; for (let i = 1; i < S.teams.length; i++) { const ta = S.teams[i]; if (!ta.alive) continue; for (let j = i + 1; j < S.teams.length; j++) {
      const tb = S.teams[j]; if (!(ta.engT[j] > 0.05) || !tb.alive) continue; const cx = ta.engCx[j], cy = ta.engCy[j]; if (Math.random() > dtF / P.dustEvery || !fxOk(cx, cy)) continue;
      let ux = tb.ax - ta.ax, uy = tb.ay - ta.ay; const ul = Math.sqrt(ux * ux + uy * uy) || 1, sp = (Math.random() - 0.5) * P.dustSpan; ux /= ul; uy /= ul; particles.burst(cx - uy * sp, cy + ux * sp, "#C8B08A", P.dustN, 34, 0.55, 4, -24); } } }
    particles.draw(ctx);
    floaters.draw(ctx);
    SPL.drawOver(ctx, gate, x0, y0, x1, y1); // M6: garrison numbers, have/need counters, bandits left, progress arcs (last-seen under fog)
    if (S.mode === "play") SPL.dust(dtF); // Boots: dust puffs at the feet of a moving swarm you see (render only)

    // camp head-count labels near the player: the live count where you see the camp, the last-seen one on explored ground (never live)
    if (S.mode === "play" && pl.count > 0) {
      ctx.font = "800 11px 'Nunito', system-ui"; ctx.textAlign = "center";
      for (const c of S.camps) {
        if (c.x < x0 - 40 || c.x > x1 + 40 || c.y < y0 - 40 || c.y > y1 + 40) continue;
        const live = !gate || PS.fog.sees(1, c.x, c.y), n = live ? c.n : c.kn[1]; if (!(n > 0)) continue;
        const d = Math.hypot(c.x - pl.cx, c.y - pl.cy), R = live ? cfg.world.campLabelDist : FG.labelDist; if (d > R) continue; // M3 critic MAJOR-1: last-seen labels reach fog.labelDist
        const a = clamp((R - d) / 120, 0, 1); ctx.globalAlpha = a * 0.9 * (live ? 1 : FG.labelDim);
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
    // name tags above every swarm you see (yours too), over what you see of it; the swarm clashing with you is labelled by the clash panel.
    // Tags and verdict marks stay inside the safe play area: below the top HUD, off the screen edges (M3 critic MINOR-5)
    const safeT = y0 + (HUDL.top + 4) / z + 14, safeL = x0 + 6 / z, safeR = x1 - 6 / z, vOn = (i) => tells && i > 1 && S.t - FS.verdict[i].t0 >= 0 && S.t - FS.verdict[i].t0 < FG.verdictSeconds;
    // one layout pass (M5 critic MINOR-1): tags placed top to bottom, each pushed down past any it would overlap, then drawn
    let vNew = 0; if (tells) for (let i = 2; i < S.teams.length; i++) { const v = FS.verdict[i], age = S.t - v.t0; if (age >= 0 && age < FG.verdictSeconds && PVN[i] && i !== clashRi && (!vNew || v.t0 > FS.verdict[vNew].t0)) vNew = i; } // one verdict mark at a time: the newest
    ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center"; let nTag = 0;
    for (let i = 1; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count === 0 || i === clashRi || (S.mode !== "play" && S.mode !== "pause") || (t.isPlayer && (t.count < 2 || S.attract || S.engagedNow))) continue;
      let cx = t.cx, cy = t.cy, top = t.minY; if (gate && i > 1) { if (!PVN[i]) continue; cx = PVX[i] / PVN[i]; cy = PVY[i] / PVN[i]; top = PVMY[i]; }
      if (cx < x0 - 60 || cx > x1 + 60 || cy < y0 - 60 || cy > y1 + 60) continue;
      const ly = Math.max(Math.min(top - 30, BON[i] ? BTOP[i] - 8 : cy - 40), safeT + (vNew === i ? 26 : 0)); // above the banner bearer
      const label = (S.attract && t.isPlayer ? "Mint" : t.name) + " · " + t.count; const w = ctx.measureText(label).width + 12; cx = clamp(cx, safeL + w / 2, Math.max(safeL + w / 2, safeR - w / 2));
      const e = TAGS[nTag++]; e.i = i; e.x = cx; e.y = ly; e.w = w; e.label = label;
    }
    for (let a = 1; a < nTag; a++) { const e = TAGS[a]; let b = a - 1; while (b >= 0 && TAGS[b].y > e.y) { TAGS[b + 1] = TAGS[b]; b--; } TAGS[b + 1] = e; } // by y (insertion sort, no allocation)
    const th = 20; // a pill (18) and a gap, world px (tags draw in the world transform)
    for (let a = 0; a < nTag; a++) { const e = TAGS[a]; for (let g = 0; g < nTag; g++) { let moved = false; for (let b = 0; b < a; b++) { const o = TAGS[b]; if (Math.abs(o.x - e.x) < (o.w + e.w) / 2 && Math.abs(o.y - e.y) < th) { e.y = o.y + th; moved = true; } } if (!moved) break; } }
    for (let a = 0; a < nTag; a++) {
      const e = TAGS[a], t = S.teams[e.i];
      ctx.fillStyle = "rgba(8,14,6,.75)"; ctx.fillRect(e.x - e.w / 2, e.y - 13, e.w, 18);
      ctx.fillStyle = t.color; ctx.fillRect(e.x - e.w / 2, e.y - 13, 3, 18);
      ctx.fillStyle = "#F1EEDF"; ctx.fillText(e.label, e.x + 1, e.y);
      if (e.i > 1) tagMask |= 1 << e.i;
    }
    // the crown (SPEC-v2 §9): over the crowned swarm where you see it (yours too), and a ghost crown at its last broadcast position, which is
    // where every hunter thinks it is ("YOU ARE MARKED" when it is yours). The broadcast is public: it is the finale's announced exception.
    if (S.crown.team && S.mode === "play" && !S.attract) {
      const C = S.crown, ct = S.teams[C.team];
      if (ct && ct.alive && ct.count > 0) {
        let vx = 0, vy = 0, on = false;
        if (ct.isPlayer || !gate) { vx = ct.cx; vy = Math.min(ct.minY - 30, BON[C.team] ? BTOP[C.team] - 8 : ct.cy - 40) - 24; on = true; }
        else if (PVN[C.team]) { vx = PVX[C.team] / PVN[C.team]; vy = Math.min(PVMY[C.team] - 30, BON[C.team] ? BTOP[C.team] - 8 : PVY[C.team] / PVN[C.team] - 40) - 24; on = true; }
        if (on && vx > x0 - 40 && vx < x1 + 40 && vy > y0 - 40 && vy < y1 + 40) crownGlyph(vx, vy + Math.sin(S.t * 3) * 2, 11, 1);
        if ((ct.isPlayer || !on) && !(on && Math.hypot(C.x - vx, C.y - vy) < 160) && C.x > x0 - 40 && C.x < x1 + 40 && C.y > y0 - 40 && C.y < y1 + 40) crownGlyph(C.x, C.y, 14, 0.4 + 0.15 * Math.sin(S.t * 4)); // the ghost only apart from the real one (M5 critic MINOR-2)
      }
    }
    // first sight: a verdict mark on that rival's banner position for fog.verdictSeconds (stronger / even / weaker, count x power)
    f0 = performance.now();
    let fp4 = 0; if (tells && vNew) for (let i = vNew; i === vNew; i++) {
      const v = FS.verdict[i], age = S.t - v.t0;
      let ly = Math.max(Math.min(PVMY[i] - 30, BON[i] ? BTOP[i] - 8 : PVY[i] / PVN[i] - 40), safeT + 26); // on the banner bearer, above its tag
      for (let a = 0; a < nTag; a++) if (TAGS[a].i === i) ly = Math.min(ly, TAGS[a].y);
      ctx.font = "800 12px 'Nunito', system-ui"; ctx.textAlign = "center";
      const txt = v.kind > 0 ? "STRONGER" : v.kind < 0 ? "WEAKER" : "EVEN", col = v.kind > 0 ? "#FF7A6E" : v.kind < 0 ? "#7CF2C4" : "#FFE49A", vy = ly - 26, vw = ctx.measureText(txt).width + 26;
      const cx = clamp(BON[i] ? BX[i] : PVX[i] / PVN[i], safeL + vw / 2, Math.max(safeL + vw / 2, safeR - vw / 2));
      ctx.globalAlpha = Math.min(1, (FG.verdictSeconds - age) * 3, age * 8 + 0.2); ctx.fillStyle = "rgba(8,14,6,.85)"; ctx.beginPath(); ctx.roundRect(cx - vw / 2, vy - 13, vw, 18, 6); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(txt, cx + 7, vy); ctx.beginPath();
      const mx = cx - vw / 2 + 9, my = vy - 4; if (v.kind > 0) { ctx.moveTo(mx - 4, my + 3); ctx.lineTo(mx, my - 3); ctx.lineTo(mx + 4, my + 3); } else if (v.kind < 0) { ctx.moveTo(mx - 4, my - 3); ctx.lineTo(mx, my + 3); ctx.lineTo(mx + 4, my - 3); } else { ctx.moveTo(mx - 4, my - 2); ctx.lineTo(mx + 4, my - 2); ctx.moveTo(mx - 4, my + 2); ctx.lineTo(mx + 4, my + 2); }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    }

    // screen-space overlays: edge markers (fog tells and off-screen rivals), banner, clash panel, joystick, debug line
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S.mode === "play" && !S.attract && !S.result) drawEdges(); // (none once the match is decided: the dawn and the end screens)
    fp4 = performance.now() - f0; fogMs += fp4; fp3 += fp4; // fog JS: the stamps, the visibility pass, the fog pass, the tells, verdict marks and edge markers
    // banner (one at a time, pinned high)
    for (let i = 0; i < Math.min(1, S.banners.length); i++) {
      const b = S.banners[i], age = 1 - b.life / b.life0;
      const a = Math.min(1, b.life * 2, age * 6); let y = Math.max(HUDL.top + 76, S.vh * (HUDL.lay === "lay-l" ? 0.36 : 0.24)), bx = S.vw / 2; // under the top HUD and a clash panel (R6: about a quarter down)
      if (b.at && BON[b.at]) { const sx = (BX[b.at] * k + ox) / dpr, sy = (BTOP[b.at] * k + oy) / dpr - 30; if (sx > 40 && sx < S.vw - 40 && sy > HUDL.top + 64 && sy < S.vh - 60) { y = sy; bx = clamp(sx, S.vw / 2 - 40, S.vw / 2 + 40); } } // over the bearer
      let fs = S.vw < 700 ? 22 : 30; ctx.font = "800 " + fs + "px 'Baloo 2', system-ui"; const tw = ctx.measureText(b.text).width; if (tw > S.vw - 28) { fs = Math.max(12, Math.floor((fs * (S.vw - 28)) / tw)); ctx.font = "800 " + fs + "px 'Baloo 2', system-ui"; } // long banners fit a 375 px phone
      { const tw2 = Math.min(tw, S.vw - 28); bx = clamp(bx, tw2 / 2 + 14, S.vw - tw2 / 2 - 14); }
      const join = b.kind === "join", pop = join ? 1 + 0.25 * Math.max(0, 1 - age * 8) : 1; if (pop !== 1) { ctx.save(); ctx.translate(bx, y - fs * 0.3); ctx.scale(pop, pop); ctx.translate(-bx, -(y - fs * 0.3)); }
      ctx.globalAlpha = a * (join ? 0.86 : 0.72); ctx.fillStyle = "#08100A"; { const tw2 = Math.min(tw * (fs / (S.vw < 700 ? 22 : 30)), S.vw - 20); ctx.beginPath(); ctx.roundRect(bx - tw2 / 2 - 12, y - fs * 0.95, tw2 + 24, fs * 1.3, 10); ctx.fill(); if (join) { ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.stroke(); pitchfork(bx - tw2 / 2 - 2, y - fs * 0.3, 8, b.color); pitchfork(bx + tw2 / 2 + 2, y - fs * 0.3, 8, b.color); } } // M5 critic MINOR-4: a dark plate; your rout's "+N JOIN YOU" gets a rim in your colour and a pop (M7)
      ctx.globalAlpha = a; ctx.textAlign = "center";
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(b.text, bx, y);
      ctx.fillStyle = b.color; ctx.fillText(b.text, bx, y); ctx.globalAlpha = 1; if (pop !== 1) ctx.restore();
    }
    drawOnboard(pl, k, ox, oy, dpr, nowMs);
    // bottom-centre status line: the opening truce countdown (combat.truceSeconds > 0), or "YOU ARE MARKED" while you wear the crown
    if (S.mode === "play" && !S.attract) {
      const tr = cfg.combat.truceSeconds - S.t, mk = S.crown.team === 1 && pl.count > 0, txt = tr > 0 ? "TRUCE " + Math.floor(tr / 60) + ":" + String(Math.floor(tr % 60)).padStart(2, "0") : mk ? "YOU ARE MARKED" : "";
      if (txt) { const y = S.vh - HUDL.safeB - (HUDL.lay === "lay-p" ? 112 : 36); /* above HUDDLE on a portrait phone */ ctx.font = "800 " + (S.vw < 700 ? 16 : 18) + "px 'Baloo 2', system-ui"; ctx.textAlign = "center"; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.globalAlpha = mk ? 0.75 + 0.25 * Math.sin(S.t * 5) : 1; ctx.strokeText(txt, S.vw / 2, y); ctx.fillStyle = mk ? "#FFD23F" : "#F1EEDF"; ctx.fillText(txt, S.vw / 2, y); ctx.globalAlpha = 1; }
    }
    // clash panel: who is fighting whom and who is winning, unmissable, screen space
    if (clashRi) {
      const t = S.teams[clashRi], cr = clashRead(pl, t), inc = clashIncoming(pl, clashRi);
      // under the top HUD (portrait: under the pips, top HUD <= 130 px below the notch; landscape: under the timer, between the leaderboard
      // and the pause button); a touch panel is 40 px (52 with INCOMING), the desktop one 46 (62)
      const tch = S.input.touch, pw = Math.min(HUDL.lay === "lay-d" ? 380 : 343, S.vw - (HUDL.lay === "lay-l" ? 264 : 32)), px = S.vw / 2 - pw / 2, py = HUDL.top + 4, r1 = tch ? 17 : 20, bh = tch ? 7 : 8, ph = tch ? (inc ? 52 : 40) : inc ? 62 : 46;
      ctx.fillStyle = "rgba(8,14,6,.82)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.fill();
      ctx.font = "800 " + (tch ? 14 : 15) + "px 'Nunito', system-ui"; ctx.textAlign = "left"; ctx.fillStyle = pl.color; ctx.fillText("YOU " + cr.a, px + 12, py + r1);
      ctx.textAlign = "right"; ctx.fillStyle = t.color; ctx.fillText(t.name.toUpperCase() + " " + cr.b, px + pw - 12, py + r1);
      ctx.textAlign = "center"; ctx.font = "800 12px 'Nunito', system-ui";
      ctx.fillStyle = cr.verdict === "WINNING" ? "#7CF2C4" : cr.verdict === "LOSING" ? "#FF7A6E" : "#FFE49A"; ctx.fillText(cr.verdict, px + pw / 2, py + r1);
      if (inc) { ctx.fillStyle = inc.color; ctx.fillText(inc.name.toUpperCase() + " INCOMING", px + pw / 2, py + ph - (tch ? 6 : 6)); }
      const bx = px + 12, bw = pw - 24, by = py + r1 + (tch ? 7 : 10);
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = pl.color; ctx.fillRect(bx, by, bw * cr.f, bh); ctx.fillStyle = t.color; ctx.fillRect(bx + bw * cr.f, by, bw * (1 - cr.f), bh);
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bx + bw * cr.f - 1, by - 2, 2, bh + 4);
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

    // the match start (SPEC-v2 §11): a polish.irisSeconds iris opening on your lone peasant (an opaque ring, not an alpha layer); the win staging
    if (S.mode === "play" && !S.attract && !S.fixture && S.t < cfg.polish.irisSeconds && pl) { const q0 = S.t / cfg.polish.irisSeconds, e = q0 * q0 * (3 - 2 * q0), sx = (pl.cx * k + ox) / dpr, sy = (pl.cy * k + oy) / dpr, R = 16 + Math.hypot(S.vw, S.vh) * e;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "#0B0F14"; ctx.beginPath(); ctx.rect(0, 0, S.vw, S.vh); ctx.arc(sx, sy, R, 0, Math.PI * 2, true); ctx.fill("evenodd"); }
    if (S.mode === "win" && SCR) SCR.win(ctx, S.vw, S.vh, dpr, S.t + (nowMs - S.endT0) / 1000, dtF, spr, pl, PS.PAL.teams);
    drawMinimap(false);
    if (gate && S.mode === "play" && (S.debug || FS.leakOn)) leakFrame();
    const fq = (fcostN % FCOST.length) * 4; FPART[fq] = fp0; FPART[fq + 1] = fp1; FPART[fq + 2] = fp2; FPART[fq + 3] = fp3;
    FCOST[fcostN++ % FCOST.length] = fogMs; fogLastMs = fogMs;
  }

  // onboarding without a text wall (SPEC-v2 §10, R6): for the first polish.ghostSeconds of a match, until you recruit, a ghost finger (touch)
  // or a cursor pulse (desktop) sweeps from your swarm to the nearest camp you can see and taps it; the first relic tier you gain flies from
  // your swarm into the relic strip (polish.flySeconds) so you learn where the strip lives. Screen space, frame time, render only.
  const HAND = ["...##....", "..#cc#...", "..#cc#...", "..#cc###.", ".##cc#cc##", "#c#cccccc#", "#cccccccc#", ".#cccccc#.", "..######.."];
  const ARROW = ["#.......", "##......", "#c#.....", "#cc#....", "#ccc#...", "#cccc#..", "#ccccc#.", "#cc####.", "##.#c#..", "#..#c#..", "....##.."];
  function pixelIcon(rows, x, y, u) { for (let r = 0; r < rows.length; r++) { const row = rows[r]; for (let c = 0; c < row.length; c++) { const ch = row.charCodeAt(c); if (ch === 46) continue; ctx.fillStyle = ch === 35 ? "#15110C" : "#F1EEDF"; ctx.fillRect(x + c * u, y + r * u, u, u); } } }
  function drawOnboard(pl, k, ox, oy, dpr, nowMs) {
    const P = S.cfg.polish;
    if (S.mode === "play" && !S.attract && !S.aiPlayer && !S.fixture && S.t < P.ghostSeconds && S.stats.recruited === 0 && pl.count > 0) {
      let best = null, bd = 1e12; for (const c of S.camps) { if (c.n <= 0 || !playerSees(c.x, c.y)) continue; const d = (c.x - pl.cx) * (c.x - pl.cx) + (c.y - pl.cy) * (c.y - pl.cy); if (d < bd) { bd = d; best = c; } }
      if (best) {
        const sx0 = (pl.cx * k + ox) / dpr, sy0 = (pl.cy * k + oy) / dpr, sx1 = (best.x * k + ox) / dpr, sy1 = (best.y * k + oy) / dpr, ph = (S.t % 1.6) / 1.6, e0 = Math.min(1, ph / 0.65), q = e0 * e0 * (3 - 2 * e0);
        const fade = Math.min(1, (P.ghostSeconds - S.t) * 2), x = sx0 + (sx1 - sx0) * q, y = sy0 + (sy1 - sy0) * q;
        if (ph > 0.65) { ctx.globalAlpha = 0.8 * fade * (1 - (ph - 0.65) / 0.35); ctx.strokeStyle = "#F1EEDF"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx1, sy1 - 6, 6 + (ph - 0.65) * 70, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 0.9 * fade * (ph < 0.9 ? 1 : (1 - ph) / 0.1); if (S.input.touch) pixelIcon(HAND, Math.round(x) - 6, Math.round(y) - 2, 3); else pixelIcon(ARROW, Math.round(x) - 1, Math.round(y) - 1, 3); ctx.globalAlpha = 1;
      }
    }
    const F = S.fly; if (!F) return;
    const p = (nowMs - F.t0) / (P.flySeconds * 1000);
    if (p >= 1) { S.fly = null; const el = $("relic-" + F.axis); if (el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); } return; }
    const e = p * p * (3 - 2 * p), sz = 40 - 16 * e, x = F.x0 + (F.x1 - F.x0) * e, y = F.y0 + (F.y1 - F.y0) * e - Math.sin(p * Math.PI) * 70;
    ctx.globalAlpha = 0.35; ctx.fillStyle = S.spr.spoils.relics[F.axis].color; ctx.beginPath(); ctx.arc(x, y, sz * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.drawImage(S.spr.spoils.relics[F.axis].icon, Math.round(x - sz / 2), Math.round(y - sz / 2), Math.round(sz), Math.round(sz));
  }
  function onGained(t, axis) {
    if (sandbox || S.attract || S.gained) return; S.gained = true; if (!S._hintRelic) S._hintRelic = 1;
    const el = $("relic-" + axis); if (!el) return; const r = el.getBoundingClientRect(), z = S.cam.zoom;
    S.fly = { axis, x0: (t.cx - S.cam.x) * z + S.vw / 2, y0: (t.cy - S.cam.y) * z + S.vh / 2 - 30, x1: r.left + r.width / 2, y1: r.top + 12, t0: performance.now() };
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
  // a crown: gold, dark outline, s = half width, in the current transform
  function crownGlyph(x, y, s, a) {
    ctx.globalAlpha = a; ctx.fillStyle = "#FFD23F"; ctx.strokeStyle = "rgba(20,12,4,.9)"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x - s, y - s * 0.45); ctx.lineTo(x - s * 0.5, y + s * 0.05); ctx.lineTo(x, y - s * 0.75); ctx.lineTo(x + s * 0.5, y + s * 0.05); ctx.lineTo(x + s, y - s * 0.45); ctx.lineTo(x + s, y + s * 0.6); ctx.closePath();
    ctx.stroke(); ctx.fill(); ctx.globalAlpha = 1;
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
  const offScreen = (sx, sy) => !(sx > 20 && sx < S.vw - 20 && sy > HUDL.top && sy < S.vh - 20);
  function drawEdges() {
    const FS = S.fogS, FG = S.cfg.fog, z = S.cam.zoom, gate = fogGate(), cx = S.vw / 2, cy = S.vh / 2; emN = 0;
    if (gate && FS.danger.on) { const a = FS.danger.ang; emAdd(5, cx + Math.cos(a) * 4000, cy + Math.sin(a) * 4000, FS.danger.team, 0, 0.65 + 0.35 * Math.sin(S.t * 12)); }
    const sightOnly = NOFOG && S.fogOn && FS.dawnT0 < 0; // ?nofog=1 renders everything but arrows still respect sight (M3 critic MINOR-2)
    for (let i = 2; i < S.teams.length; i++) {
      const t = S.teams[i]; if (!t.alive || t.count === 0) continue;
      if (sightOnly && !FS.obs[1][i].seen) continue;
      if (!gate || PVN[i]) {
        const wx = gate ? PVX[i] / PVN[i] : t.cx, wy = gate ? PVY[i] / PVN[i] : t.cy, sx = (wx - S.cam.x) * z + cx, sy = (wy - S.cam.y) * z + cy;
        if (offScreen(sx, sy)) { emAdd(4, sx, sy, i, t.count, 0.9); if (gate) arrowMask |= 1 << i; }
        continue;
      }
      const g = FS.ghosts[i]; if (g.on) { const sx = (g.x - S.cam.x) * z + cx, sy = (g.y - S.cam.y) * z + cy; if (offScreen(sx, sy)) emAdd(1, sx, sy, i, g.n, clamp(1 - (0.7 * (S.t - g.t0)) / FG.ghostSeconds, 0.3, 1)); }
      const d = FS.dust[i]; if (d.on) { const sx = (d.x - S.cam.x) * z + cx, sy = (d.y - S.cam.y) * z + cy; if (offScreen(sx, sy)) emAdd(0, sx, sy, i, 0, 0.8); }
    }
    if (gate) for (const p of FS.pings) if (p.on) { const sx = (p.x - S.cam.x) * z + cx, sy = (p.y - S.cam.y) * z + cy; if (offScreen(sx, sy)) emAdd(2, sx, sy, 0, p.rout ? 1 : 0, 1); }
    { const C = S.crown, ct = C.team > 1 ? S.teams[C.team] : null; if (ct && ct.alive && ct.count > 0 && !(gate && PVN[C.team]) && !(!gate && !offScreen((ct.cx - S.cam.x) * z + cx, (ct.cy - S.cam.y) * z + cy))) { const sx = (C.x - S.cam.x) * z + cx, sy = (C.y - S.cam.y) * z + cy; if (offScreen(sx, sy)) emAdd(3, sx, sy, C.team, 0, 1); } } // the crown's last broadcast
    for (let i = 1; i < emN; i++) { const e = EM[i]; let j = i - 1; while (j >= 0 && EM[j].pri < e.pri) { EM[j + 1] = EM[j]; j--; } EM[j + 1] = e; } // stable, by priority
    // at most fog.edgeMax markers by priority (danger > visible rival > crown > ping > ghost), on the play area's edge: under the top HUD,
    // inside the safe insets, and pushed out of every HUD box (pips, leaderboard, pause, minimap, HUDDLE, relic strip) along its edge
    const top = HUDL.top + 16, bot = S.vh - HUDL.safeB - 26, lft = HUDL.safeL + 26, rgt = S.vw - HUDL.safeR - 26;
    for (let q = 0; q < Math.min(emN, FG.edgeMax); q++) {
      const e = EM[q], dx = e.x - cx, dy = e.y - cy; let s = 1;
      if (dx > 0) s = Math.min(s, (rgt - cx) / dx); else if (dx < 0) s = Math.min(s, (lft - cx) / dx); if (dy > 0) s = Math.min(s, (bot - cy) / dy); else if (dy < 0) s = Math.min(s, (top - cy) / dy);
      let ex = cx + dx * s, ey = cy + dy * s; const side = ex <= lft + 1 || ex >= rgt - 1;
      for (let r = 0; r < HUDL.n; r++) { const ax = HUDL.rx0[r] - 16, ay = HUDL.ry0[r] - 16, bx = HUDL.rx1[r] + 16, by = HUDL.ry1[r] + 16; if (ex > ax && ex < bx && ey > ay && ey < by) { if (side) ey = ey - ay < by - ey && ay > top ? ay : by; else ex = ex - ax < bx - ex && ax > lft ? ax : bx; } }
      const col = e.team ? S.teams[e.team].color : "#F1EEDF", ca = Math.cos(e.ang) * S.dpr, sa = Math.sin(e.ang) * S.dpr;
      ctx.setTransform(ca, sa, -sa, ca, ex * S.dpr, ey * S.dpr); ctx.globalAlpha = e.a;
      if (e.pri === 5) { ctx.strokeStyle = "#FF3B30"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-4, -11); ctx.lineTo(7, 0); ctx.lineTo(-4, 11); ctx.moveTo(-14, -11); ctx.lineTo(-3, 0); ctx.lineTo(-14, 11); ctx.stroke(); ctx.lineCap = "butt"; }
      else if (e.pri === 4) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-3, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); }
      else if (e.pri === 1) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-3, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.stroke(); }
      else if (e.pri === 0) { ctx.fillStyle = col; for (let k = 0; k < 3; k++) { ctx.globalAlpha = 0.35 * e.a; ctx.beginPath(); ctx.arc(-4 + k * 5, (k - 1) * 4, 7, 0, Math.PI * 2); ctx.fill(); } }
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      if (e.pri === 2) { ctx.globalAlpha = 0.85; ctx.fillStyle = "rgba(8,14,6,.8)"; ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; pitchfork(ex, ey, 9, e.n ? "#FFE49A" : "#F1EEDF"); }
      if (e.pri === 3) { ctx.globalAlpha = 0.85; ctx.fillStyle = "rgba(8,14,6,.8)"; ctx.beginPath(); ctx.arc(ex, ey, 15, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); crownGlyph(ex, ey + 1, 9, 1); }
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
    mctx.fillStyle = PS.PAL.parch.camp; for (const c of S.camps) { const n = gate && !PS.fog.sees(1, c.x, c.y) ? c.kn[1] : c.n; if (n > 0) mctx.fillRect((c.x * k - 1) | 0, (c.y * k - 1) | 0, 3, 2); }
    SPL.minimap(mctx, k, gate); // M6: villages, chests, heavy chests, bandit camps and relics you have seen, as you last saw them
    for (const p of S.powerups) {
      let x = p.x, y = p.y, col = null;
      if (p.alive && (!gate || PS.fog.sees(1, p.x, p.y) || (p.x - pl.cx) * (p.x - pl.cx) + (p.y - pl.cy) * (p.y - pl.cy) <= bc2)) col = S.spr.PU[p.kind].color;
      else if (gate && p.sseen && p.salive) { x = p.sx; y = p.sy; col = "#8A8A84"; }
      if (col) { mctx.fillStyle = col; mctx.fillRect((x * k - 1) | 0, (y * k - 1) | 0, 3, 3); }
    }
    let cur = ""; miniMask = 0;
    for (const a of S.agents) {
      const tm = a.team; if (a.dead || a.gar || (gate && tm !== 1 && !PS.fog.sees(1, a.x, a.y))) continue;
      const x = (a.x * k) | 0, y = (a.y * k) | 0;
      if (tm === 0) { if (cur !== "n") { mctx.fillStyle = "#5A4630"; cur = "n"; } mctx.fillRect(x, y, 1, 1); continue; }
      if (tm > 1) { if (cur !== "d") { mctx.fillStyle = "#15110C"; cur = "d"; } mctx.fillRect(x - 1, y - 1, 4, 4); if (tm < 8) miniMask |= 1 << tm; } // dark backing: yellow reads on parchment
      const col = tm === 8 ? "#8A8A94" : S.teams[tm].color; if (cur !== col) { mctx.fillStyle = col; cur = col; } mctx.fillRect(x, y, 2, 2);
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
    // the crown's last broadcast (every minimap, SPEC-v2 §9) and Bully's scent ping (a pulse where it thinks you are, 2 s)
    if (S.crown.team) { const C = S.crown, x = C.x * k, y = C.y * k; mctx.globalAlpha = 1; mctx.fillStyle = "#FFD23F"; mctx.strokeStyle = "#15110C"; mctx.lineWidth = 1; mctx.beginPath(); mctx.moveTo(x - 5, y + 3); mctx.lineTo(x - 5, y - 3); mctx.lineTo(x - 2, y); mctx.lineTo(x, y - 5); mctx.lineTo(x + 2, y); mctx.lineTo(x + 5, y - 3); mctx.lineTo(x + 5, y + 3); mctx.closePath(); mctx.fill(); mctx.stroke(); }
    { const sc = S.scent, age = S.t - sc.t; if (sc.n > 0 && age >= 0 && age < 2) { let col = "#2F7BD8"; for (let i = 2; i < S.teams.length; i++) if (S.teams[i].kind === "bully") col = S.teams[i].color; mctx.globalAlpha = 1 - age / 2; mctx.strokeStyle = col; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(sc.x * k, sc.y * k, 3 + age * 9, 0, Math.PI * 2); mctx.stroke(); mctx.globalAlpha = 1; } }
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
      const tm = a.team; if (tm === 1 || a.dead || a.gar) continue;
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
  // every sprite cache: the team atlases and banner atlases (built lazily, cached per colour and style for the page's life), trees, rocks,
  // camp dirt, decals, power-up icons, the flag and the loose shadow. teams is unused (atlases live in spr.sets), kept for callers.
  function spriteCanvases(spr, teams) {
    const list = [];
    for (const [k, v] of spr.sets) list.push(["atlas." + k, v.atlas]);
    for (const [k, v] of spr.banners) list.push(["banner." + k, v.cv]);
    spr.trees.forEach((t, i) => list.push(["tree" + i, t.cv])); spr.rocks.forEach((t, i) => list.push(["rock" + i, t.cv])); spr.camps.forEach((c, i) => list.push(["camp" + i, c]));
    spr.decals.forEach((c, i) => list.push(["decal" + i, c]));
    for (const k in spr.PU) list.push(["pu." + k, spr.PU[k].icon]);
    list.push(["marker", spr.marker], ["shadow", spr.shadow]);
    const sp = spr.spoils; for (const k in sp.relics) list.push(["relic." + k, sp.relics[k].icon]); // M6 props
    list.push(["scroll", sp.scroll], ["chest0", sp.chest[0]], ["chest1", sp.chest[1]], ["heavy0", sp.heavy[0]], ["heavy1", sp.heavy[1]], ["village0", sp.village[0]], ["village1", sp.village[1]], ["tent", sp.tent], ["bannerHorn", sp.bannerHorn]);
    return list;
  }
  // repaint every sprite cache in place (same canvas objects, so every reference stays valid): atlases and banners from their recipe,
  // the rest copied from a fresh build (the build is seeded, so it paints the same art)
  function restoreSprites() {
    const fresh = PS.buildSprites(S.cfg), spr = S.spr, copy = (dst, src) => { const g = dst.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, dst.width, dst.height); g.drawImage(src, 0, 0); };
    spr.trees.forEach((t, i) => copy(t.cv, fresh.trees[i].cv)); spr.rocks.forEach((t, i) => copy(t.cv, fresh.rocks[i].cv)); spr.camps.forEach((c, i) => copy(c, fresh.camps[i])); spr.decals.forEach((c, i) => copy(c, fresh.decals[i]));
    for (const k in spr.PU) copy(spr.PU[k].icon, fresh.PU[k].icon);
    copy(spr.marker, fresh.marker); copy(spr.shadow, fresh.shadow);
    { const a = spr.spoils, b = fresh.spoils; for (const k in a.relics) copy(a.relics[k].icon, b.relics[k].icon); copy(a.scroll, b.scroll); copy(a.tent, b.tent); copy(a.bannerHorn, b.bannerHorn); for (let i = 0; i < 2; i++) { copy(a.chest[i], b.chest[i]); copy(a.heavy[i], b.heavy[i]); copy(a.village[i], b.village[i]); } }
    SPL.hud(true); if (buffEls) for (const k of BUFFS) buffEls[k].painted = false; // the relic strip's and the buff icons' canvases are painted from these
    for (const v of spr.sets.values()) spr.paintAtlas(v.atlas, v.color, v.style, v.relics);
    for (const v of spr.banners.values()) spr.paintBanner(v.cv, v.color, v.style);
  }
  // canvas backing stores held as caches (SPEC-v2 §13, M5 brief: <= art.canvasBudgetMB): chunks and water pairs, sprites and atlases,
  // the minimap terrain, the fog canvases. The main canvas is reported apart.
  function canvasMemory() {
    const out = { count: 0, bytes: 0, chunks: 0, waterPairs: 0, atlases: 0, banners: 0, sprites: 0, fog: 0 }, add = (c, k) => { if (!c || !c.width) return; out.count++; out.bytes += c.width * c.height * 4; if (k) out[k]++; };
    if (S.map && S.map.chunks) { const G = S.map.chunks; for (let i = 0; i < G.n * G.n; i++) { add(G.cvA[i], "chunks"); add(G.cvB[i], "waterPairs"); } }
    for (const e of spriteCanvases(S.spr)) add(e[1], e[0].startsWith("atlas.") ? "atlases" : e[0].startsWith("banner.") ? "banners" : "sprites");
    add(miniTerr); for (const c of PS.fog.canvases()) add(c, "fog");
    return { count: out.count, mb: +(out.bytes / 1048576).toFixed(2), chunks: out.chunks, waterPairs: out.waterPairs, atlases: out.atlases, banners: out.banners, sprites: out.sprites, fog: out.fog, mainMB: +((canvas.width * canvas.height * 4) / 1048576).toFixed(2) };
  }
  function recheckCaches(sync) {
    if (!S.cfg || !S.spr) return;
    let blank = 0; for (const e of spriteCanvases(S.spr, S.teams)) if (opaqueCount(e[1]) === 0) blank++;
    if (blank) restoreSprites();
    if (S.map) { groundInvalidate(S.map); minimapBake(true); if (sync) flushGround(S.map); }
    PS.fog.recover(); // the fog mask and cloud texture, re-put from their typed arrays (explored ground is remembered)
    if (SCR) SCR.dirty(); // the painted title repaints its layers on its next frame (M7)
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
    if (!blank && S.mode === "title" && SCR && SCR.sky() && !opaque4(SCR.sky())) blank = true; // the painted title's sky layer (M7)
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
    if (SCR) for (const c of SCR.canvases()) { wipe(c); n++; } // the painted title's layers and the lose screen's grey frame (M7)
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
    out.memory = canvasMemory();
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
      c.innerHTML = "<span class='sw' style='background:" + t.color + "'></span><span class='nm'>" + t.name + "</span><span class='n'>" + (unseen ? "?" : t.count) + "</span><span class='pw'></span>";
      el.appendChild(c);
    }
    hudMeasureT = 0; // re-measure the top HUD next update (the chips changed)
  }
  // ---------------------------------------------------------------- HUD layout (SPEC-v2 §10, R6): one set of HUD nodes restyled per layout by a
  // body class (lay-d desktop top bar; lay-p touch portrait; lay-l touch landscape). The canvas overlays (clash panel, banners, name tags,
  // edge markers, status line) read HUDL: the safe-area insets, the top HUD's bottom edge and the HUD boxes the edge markers keep out of.
  const HUDL = { lay: "", top: 60, safeT: 0, safeR: 0, safeB: 0, safeL: 0, n: 0, rx0: new Float64Array(8), ry0: new Float64Array(8), rx1: new Float64Array(8), ry1: new Float64Array(8) };
  const HUD_TOP = ["teams", "timer", "ctrls"], HUD_BOX = ["teams", "timer", "ctrls", "minimap", "t-huddle", "bl"];
  let hudMeasureT = 0;
  function layoutHUD() {
    if (sandbox || !S.cfg) return;
    const lay = !S.input.touch ? "lay-d" : S.vh >= S.vw ? "lay-p" : "lay-l", b = document.body;
    if (HUDL.lay !== lay) { b.classList.remove("lay-d", "lay-p", "lay-l"); b.classList.add(lay); HUDL.lay = lay; }
    const cs = getComputedStyle($("safe")); HUDL.safeT = parseFloat(cs.paddingTop) || 0; HUDL.safeR = parseFloat(cs.paddingRight) || 0; HUDL.safeB = parseFloat(cs.paddingBottom) || 0; HUDL.safeL = parseFloat(cs.paddingLeft) || 0;
    if ($("hud").classList.contains("hidden")) return; // measured once the HUD shows (startGame)
    let top = 0; HUDL.n = 0;
    for (const id of HUD_BOX) {
      const r = $(id).getBoundingClientRect(); if (!(r.width > 0)) continue;
      if (HUD_TOP.indexOf(id) >= 0 && (lay !== "lay-l" || id === "timer")) top = Math.max(top, r.bottom); // landscape: the clash panel goes under the timer, between the leaderboard and the pause button
      const k = HUDL.n++; HUDL.rx0[k] = r.left; HUDL.ry0[k] = r.top; HUDL.rx1[k] = r.right; HUDL.ry1[k] = r.bottom;
    }
    HUDL.top = top || 60; hudMeasureT = performance.now();
  }
  // a rival's pip is dimmed with "?" until you have seen it once (SPEC-v2 §5): after that its live count (the win condition stays readable)
  const chipUnseen = (i) => i > 1 && !S.attract && fogGate() && !S.fogS.obs[1][i].ever;
  let hudT = 0;
  function updateHUD(force) {
    const now = performance.now(); if (!force && now - hudT < 100) return; hudT = now;
    if (now - hudMeasureT > 1000) layoutHUD();
    if (S.t > S.cfg.polish.irisSeconds + 0.6) $("teams").classList.remove("rumour"); // the rival pips arrive as rumours with the iris (M7) // chips grow with their counts (desktop wraps): the overlays follow at 1 Hz
    if (HUDL.lay === "lay-l") { // the landscape leaderboard: YOU and the rivals you have sighted by count, then the unseen, then the dead (CSS order, no DOM moves)
      let r = 0; for (const t of swarms()) { const el = $("chip-" + t.id); if (!el) continue; let k = 0; for (const u of swarms()) if (u !== t && (u.alive && !chipUnseen(u.id)) && (!t.alive || chipUnseen(t.id) || u.count > t.count || (u.count === t.count && u.id < t.id))) k++; el.style.order = !t.alive ? 20 + t.id : chipUnseen(t.id) ? 10 + t.id : k; r++; }
    }
    for (const t of swarms()) {
      const i = t.id, el = $("chip-" + i); if (!el) continue; const u = chipUnseen(i), n = el.children[2], pe = el.children[3]; n.textContent = u ? "?" : t.count; el.classList.toggle("unseen", u);
      // a power figure once that rival has been sighted (the power you last saw on it; yours live), SPEC-v2 §10 / M6
      const pw = i === 1 || !fogGate() || S.attract ? t.power : S.fogS.obs[1][i].seen ? t.power : S.fogS.obs[1][i].pw, txt = u || !t.alive || !(pw > 1.001) ? "" : "×" + pw.toFixed(2); if (pe && pe.textContent !== txt) pe.textContent = txt;
    }
    SPL.hud(false);
    PS.audio.murmur(S.mode === "play" && !S.attract && S.teams[1] ? S.teams[1].count : 0); // crowd murmur by your count (SPEC-v2 §12)
    const tl = Math.max(0, S.timeLeft), m = Math.floor(tl / 60), s = Math.floor(tl % 60);
    const tm = $("timer"); tm.textContent = m + ":" + (s < 10 ? "0" : "") + s; tm.classList.toggle("urgent", tl < 30);
    // timed buffs: a 28 px pixel icon each with a ring timer (built once; painted from the sprite icons, never read back)
    const t = S.teams[1], cfg = S.cfg.powerups;
    if (!buffEls) { buffEls = {}; const b = $("buffs"); b.innerHTML = ""; for (const k of BUFFS) { const d = document.createElement("div"); d.className = "buff"; const ring = document.createElement("i"); ring.className = "ring"; const cv = document.createElement("canvas"); cv.width = 22; cv.height = 22; d.appendChild(ring); d.appendChild(cv); b.appendChild(d); buffEls[k] = { d, ring, cv, painted: false, pc: -1 }; } }
    for (const k of BUFFS) {
      const e = buffEls[k], on = !!t && t.buffs[k] > 0; e.d.classList.toggle("on", on); if (!on) continue;
      if (!e.painted) { const g = e.cv.getContext("2d"); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 22, 22); g.drawImage(S.spr.PU[k].icon, 0, 0, 22, 22); e.painted = true; }
      const pc = Math.round((100 * t.buffs[k]) / cfg.duration[k]); if (pc !== e.pc) { e.pc = pc; e.ring.style.background = "conic-gradient(" + S.spr.PU[k].color + " " + pc + "%, rgba(255,255,255,.1) 0)"; }
    }
  }
  const BUFFS = ["speed", "armor", "frenzy"]; let buffEls = null;

  // ---------------------------------------------------------------- input
  // SPEC-v2 §10. Touch: tap (lift inside input.tapMs, moved under input.tapPx) routes; drag (past tapPx) is the floating joystick, anchor
  // clamped touch.joyEdge from the edges, cancelling any route; hold (still past tapMs) stops; lifting after a drag stops; a second finger
  // is HUDDLE only. Mouse: the cursor follows (route or steer by input.desktopMode), left click routes until the cursor moves
  // input.routeBreakPx; a minimap click routes until the mouse moves on the canvas. pointercancel ends a touch without a tap.
  // Keys over mouse: a movement key puts the cursor to sleep (it no longer pulls the swarm), lifting the last key stops the swarm where it
  // stands, and the cursor wakes on a click or once it moves input.mouseWakePx from where it was when the keys took over.
  const MOVE_KEYS = ["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  function bindInput() {
    const inp = S.input, joy = inp.joy, tp = inp.tp;
    const startDrag = (e) => {
      const J = S.cfg.touch; tp.drag = true; joy.active = true; joy.id = tp.id; joy.mag = 0;
      joy.ox = clamp(tp.sx, J.joyEdge, Math.max(J.joyEdge, S.vw - J.joyEdge)); joy.oy = clamp(tp.sy, J.joyEdge, Math.max(J.joyEdge, S.vh - J.joyEdge)); joy.cx = e.clientX; joy.cy = e.clientY;
      inp.route.on = false; inp.hold = false;
    };
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") {
        inp.px = e.clientX; inp.py = e.clientY;
        if (inp.kbd) { if (Math.hypot(inp.px - inp.kx0, inp.py - inp.ky0) < S.cfg.input.mouseWakePx) return; inp.kbd = false; inp.hold = false; } // the cursor wakes and takes the swarm back
        inp.active = true; const r = inp.route;
        if (r.on && (r.src === "minimap" || (r.src === "click" && Math.hypot(e.clientX - r.sx, e.clientY - r.sy) > S.cfg.input.routeBreakPx))) r.on = false;
        return;
      }
      if (joy.active && e.pointerId === joy.id) { joy.cx = e.clientX; joy.cy = e.clientY; return; }
      if (tp.active && e.pointerId === tp.id && !tp.drag && Math.hypot(e.clientX - tp.sx, e.clientY - tp.sy) > S.cfg.input.tapPx) startDrag(e);
    });
    canvas.addEventListener("pointerdown", (e) => {
      PS.audio.unlock(); if (S.mode === "play") portal("gameplayStart"); // the first input of a match, not the load (R6)
      if (e.pointerType === "mouse") { inp.px = e.clientX; inp.py = e.clientY; inp.active = true; inp.kbd = false; if (e.button === 0) tapAt(e.clientX, e.clientY, "click"); return; }
      if (!inp.touch) { inp.touch = true; document.body.classList.add("touch"); layoutHUD(); } inp.active = false;
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
      inp.keys[k] = true; if (S.mode === "play") portal("gameplayStart");
      if (MOVE_KEYS.includes(k)) { if (!inp.kbd) { inp.kx0 = inp.px; inp.ky0 = inp.py; } inp.kbd = true; inp.active = false; }
      if (k === " ") { e.preventDefault(); if (S.mode === "play") setHuddle(true); }
      if (k === "p" || k === "Escape") { if (S.mode === "play") pause(); else if (S.mode === "pause") resume(); }
      if (k === "m") toggleSound();
      if (k === "1") setPace(0); if (k === "2") setPace(1);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; inp.keys[k] = false; if (k === " ") setHuddle(false);
      if (inp.kbd && MOVE_KEYS.includes(k) && !MOVE_KEYS.some((q) => inp.keys[q]) && S.mode === "play" && S.teams[1] && !inp.route.on) holdHere(S.teams[1]); // lifting the last key stops the swarm
    });
    window.addEventListener("blur", () => { inp.keys = {}; setHuddle(false); joy.active = false; joy.id = -1; tp.active = false; inp.hud2 = -1; });
    const hb = $("t-huddle");
    hb.addEventListener("pointerdown", (e) => { e.preventDefault(); setHuddle(true); });
    hb.addEventListener("pointerup", () => setHuddle(false));
    hb.addEventListener("pointercancel", () => setHuddle(false));
    hb.addEventListener("pointerleave", () => setHuddle(false));
    if ("ontouchstart" in window && !window.matchMedia("(pointer:fine)").matches) { inp.touch = true; document.body.classList.add("touch"); }
    layoutHUD();
    document.addEventListener("visibilitychange", () => { if (document.hidden) { if (S.mode === "play") pause(); } else recheckCaches(); });
    for (const ev of ["gesturestart", "gesturechange", "dblclick"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }); // iOS: no pinch or double-tap zoom (user-scalable=no alone does not stop it)
    window.addEventListener("pageshow", () => recheckCaches());
    canvas.addEventListener("contextrestored", () => recheckCaches());
  }
  function setHuddle(on) { if (S.input.huddle === on) return; S.input.huddle = on; $("t-huddle").classList.toggle("on", on); if (S.mode === "play") PS.audio.huddle(on); }

  function bindUI() {
    let stored = null; try { stored = localStorage.getItem("ps.difficulty"); if (stored && S.cfg.difficulty[stored]) S.difficulty = stored; } catch (e) {}
    { const R = readRecords(); S.firstEver = !stored && !Object.keys(R).length; }
    for (const row of document.querySelectorAll(".diffpick")) for (const k of Object.keys(S.cfg.difficulty)) {
      const b = document.createElement("button"); b.textContent = S.cfg.difficulty[k].label; b.dataset.k = k;
      b.onclick = () => { S.difficulty = k; S.firstEver = false; try { localStorage.setItem("ps.difficulty", k); } catch (e) {} syncDifficulty(); PS.audio.click(); };
      row.appendChild(b);
    }
    syncDifficulty(); renderRecords();
    $("btn-play").onclick = () => startGame();
    // PLAY AGAIN / TRY AGAIN await the portal's commercial break (a no-op without a portal), silent while it runs
    const again = () => { if (S.adBusy) return; S.adBusy = true; PS.audio.setSilent(true); portal("commercialBreak").then(() => { S.adBusy = false; startGame(); }); };
    $("btn-again").onclick = again; $("btn-retry").onclick = again;
    $("btn-title-w").onclick = () => toTitle();
    $("btn-title-l").onclick = () => toTitle();
    $("btn-quit").onclick = () => toTitle();
    $("btn-resume").onclick = () => resume();
    $("btn-pause").onclick = () => { if (S.mode === "play") pause(); };
    $("btn-pace").onclick = $("btn-pace-pause").onclick = () => setPace((S.cfg.pace.indexOf(S.pace) + 1) % S.cfg.pace.length);
    for (const id of ["btn-sound", "btn-sound-title", "btn-sound-pause"]) $(id).onclick = () => toggleSound();
    syncSound();
    if (S.debug) { // P2 listening aid (?debug=1): the pause menu's mixer, a mute per sound category and the master volume; nothing persisted
      const mx = document.createElement("div"); mx.className = "mixer"; mx.id = "mixer";
      for (const k of PS.audio.categories) { const b = document.createElement("button"); b.textContent = k; b.dataset.k = k; b.onclick = () => { PS.audio.mix(k, !PS.audio.mixState()[k]); syncMixer(); }; mx.appendChild(b); }
      const lb = document.createElement("label"), v = document.createElement("input"); v.type = "range"; v.min = "0"; v.max = "100"; v.value = "100"; v.id = "mix-vol";
      v.oninput = () => { PS.audio.volume(v.value / 100); syncMixer(); }; lb.appendChild(document.createTextNode("volume")); lb.appendChild(v); lb.appendChild(document.createElement("span")); mx.appendChild(lb);
      $("ov-pause").appendChild(mx); syncMixer();
    }
  }
  function syncMixer() { const m = PS.audio.mixState(), el = $("mixer"); if (!el) return; for (const b of el.querySelectorAll("button")) b.classList.toggle("off", !m[b.dataset.k]); el.querySelector("span").textContent = Math.round(m.volume * 100) + "%"; }
  function showOverlay(id) { document.querySelectorAll(".overlay").forEach((o) => o.classList.toggle("active", o.id === id)); }
  // the first-ever match (no stored difficulty, no records, nothing picked this visit) runs Easy silently; the end screens carry the picker
  function startGame() { if (SCR) SCR.drop(); $("teams").classList.add("rumour"); if (S.firstEver) { S.firstEver = false; S.difficulty = "easy"; syncDifficulty(); } PS.audio.setSilent(false); PS.audio.unlock(); PS.audio.click(); portal("gameplayStop"); newGame(false); S.mode = "play"; S._hintFight = S._hintHud = S._hintRecruit = S._hintFog = false; S._hintRelic = S._hintRem = 0; S.fly = null; S.gained = false; S._routedBy = null; showOverlay(null); $("hud").classList.remove("hidden"); layoutHUD(); updateHUD(true); }
  function toTitle() { portal("gameplayStop"); if (SCR) SCR.drop(); PS.audio.stopDrum(); PS.audio.murmur(0); PS.audio.melee(0); S.mode = "title"; showOverlay("ov-title"); $("hud").classList.add("hidden"); setHuddle(false); newGame(true); }
  function pause() { portal("gameplayStop"); S.mode = "pause"; PS.audio.stopDrum(); PS.audio.murmur(0); PS.audio.melee(0); showOverlay("ov-pause"); setHuddle(false); S.input.joy.active = false; S.input.joy.id = -1; S.input.tp.active = false; S.input.hud2 = -1; }
  function resume() { S.mode = "play"; showOverlay(null); lastFrame = performance.now(); }
  function setPace(i) { S.pace = S.cfg.pace[i]; $("btn-pace").textContent = S.pace + "×"; $("btn-pace-pause").textContent = "SPEED " + S.pace + "×"; } // the top-bar button (desktop) and the pause menu's (phones)
  function toggleSound() { PS.audio.setMuted(!PS.audio.isMuted()); syncSound(); }
  function syncDifficulty() { for (const b of document.querySelectorAll(".diffpick button")) b.classList.toggle("sel", b.dataset.k === S.difficulty); }
  function syncSound() { const m = PS.audio.isMuted(); for (const id of ["btn-sound", "btn-sound-title", "btn-sound-pause"]) $(id).classList.toggle("off", m); }

  // ---------------------------------------------------------------- PS.vis / PS.ai: the fog's critic hooks (SPEC-v2 §5, §7, §13)
  // The harness bot plays fog-honest through rivals() and camps() (never PSS.teams positions); leakCheck() draws one frame and checks it;
  // leakTotals() sums every checked frame (every live frame under ?debug=1); structure() counts full-screen alpha draws over 10 frames;
  // cost() is the per-frame fog JS (render side plus the stamps of the ticks each frame ran) over the last 720 frames.
  const pctA = (a, p) => (a.length ? pct(a, p) : 0);
  const trimMean = (a, stallMs) => { const ok = stallMs > 0 ? a.filter((v) => v <= stallMs) : a; return { meanTrim: ok.length ? +(ok.reduce((x, y) => x + y, 0) / ok.length).toFixed(3) : 0, stalls: a.length - ok.length }; }; // see PS.vis.cost
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
    // stallMs (QA, optional): frames above it are counted as stalls and left out of meanTrim. Under CDP throttling in a synchronous loop the
    // renderer sometimes waits 250+ ms on the GPU process inside whatever canvas call is next (measured: the same stalls hit frames whose
    // fog JS was 2 ms), so one stall landing in a fog segment would otherwise decide the mean
    cost(stallMs) {
      const n = Math.min(fcostN, FCOST.length), a = Array.from(FCOST.subarray(0, n)), FS = S.fogS, U = PS.fog.ST;
      const part = (k) => { const v = []; for (let i = 0; i < n; i++) v.push(FPART[i * 4 + k]); return { p50: pctA(v, 0.5), p90: pctA(v, 0.9), mean: n ? +(v.reduce((x, y) => x + y, 0) / n).toFixed(3) : 0 }; };
      return { frames: n, p50: pctA(a, 0.5), p90: pctA(a, 0.9), p99: pctA(a, 0.99), max: n ? +Math.max(...a).toFixed(3) : 0, last: +fogLastMs.toFixed(3), mean: n ? +(a.reduce((x, y) => x + y, 0) / n).toFixed(3) : 0,
        ...trimMean(a, stallMs), parts: { stamps: part(0), visibility: part(1), fogPass: part(2), tells: part(3) },
        stampMsPerTick: FS ? +(FS.simTotal / Math.max(1, FS.simTicks)).toFixed(4) : 0, stampMax: FS ? +FS.simMax.toFixed(3) : 0, uploads: U.uploads, forced: U.forced, uploadMs: +U.upMs.toFixed(2) };
    },
    resetCost() { fcostN = 0; FCOST.fill(0); FPART.fill(0); const FS = S.fogS; if (FS) { FS.simMs = 0; FS.simTotal = 0; FS.simTicks = 0; FS.simMax = 0; } const U = PS.fog.ST; U.uploads = 0; U.forced = 0; U.upMs = 0; U.cells = 0; return true; },
    crows: (x, y) => crows(x, y),
    // M6: the objectives you know (the live state where you see them, the last-seen one elsewhere): the harness bot's only view of spoils
    objectives: () => SPL.playerView(),
  };
  const AIQ = { assertKnowledge: () => (S.fogS ? { ...S.fogS.ai } : null) };

  // ---------------------------------------------------------------- QA: selfTest, fight + match harnesses, replay, bench
  // PS.fight / PS.simMatch / PS.replay / PS.bench swap a throwaway world into S and swap the live one back in a finally block, so a player
  // can call PS.selfTest() mid-match from the console. No localStorage, no DOM (sandbox guards), no sound, no live particles.
  const SANDBOX_KEYS = ["mode", "t", "timeLeft", "agents", "teams", "obstacles", "powerups", "camps", "cam", "input", "rng", "seed", "trickleT", "shake",
    "banners", "hintT", "stats", "engagedNow", "result", "decals", "trails", "attract", "difficulty", "spr", "tick", "acc", "map", "obs", "cap", "dbg",
    "finalCalled", "pendingEnd", "_routedBy", "_hintRecruit", "_hintFight", "_hintHud", "camS", "ev", "lastRout", "thinkRR", "flowW", "fixture",
    "fogW", "fogS", "fogOn", "frameId", "lastDrawT", "lastDrawSim", "noise", "crown", "pile", "scent", "relaxUntil", "torches", "aiPlayer", "aiCost", "objs", "bandits", "spT", "meleeN"];
  let sbParticles = null, sbSmoke = null, sbFloaters = null, sbSpr = null, sbSprOf = null, flatMap = null;
  function withSandbox(fn) {
    if (sandbox) return fn(); // nested call shares the outer throwaway world
    const saved = {}; for (const k of SANDBOX_KEYS) saved[k] = k in S ? [S[k]] : null;
    const liveP = particles, liveF = floaters, liveSm = smokeP, liveSpr = S.spr;
    particles = sbParticles || (sbParticles = PS.Particles(200)); smokeP = sbSmoke || (sbSmoke = PS.Particles(120)); floaters = sbFloaters || (sbFloaters = PS.Floaters()); floaters.clear(); sandbox = true;
    const spr = sbSpr && sbSprOf === liveSpr ? sbSpr : (sbSprOf = liveSpr, sbSpr = Object.create(liveSpr)); // atlases are cached per colour and style in the live sprite set (one build per team, ever); one overlay reused (M7: no fresh objects per sandbox, so update() keeps its optimised code)
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
    S.agents = []; S.obstacles = []; S.powerups = []; S.camps = []; S.banners = []; S.decals = []; S.trails = []; S.teams = []; SPL.reset();
    S.map = map || flatMap || (flatMap = PS.terrain.flat()); PS.terrain.use(S.map); placeTables(S.map); bucketObstacles();
    S.flowW = PS.flow.use(PS.flow.reset(sbFlow, S.map));
    S.fogW = PS.fog.use(PS.fog.reset(sbFog, S.map, { learn: false })); S.fogS = mkFogS(); S.fogOn = false; // fog data runs; the view is unfogged unless a test sets fogOn
    S.cap = S.cfg.spawn.agentCap; S.dbg = { terrainBad: 0, firstBad: null, capOver: 0 }; S.tick = 0; S.acc = 0; S.ev = mkEv(); S.lastRout = null; S.thinkRR = 0; S.camS = mkCamS(); S.lastDrawSim = 0;
    S.mode = "sandbox"; S.hintT = 0; S.stats = { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0, fights: 0 };
    resetM4();
  }
  // the M4 match state a sandbox or fixture starts from (newGame sets the same)
  function resetM4() { S.noise = mkNoise(); S.crown = mkCrown(); S.pile = mkPile(); S.scent = mkScent(); S.scent.next = S.cfg.ai.grace; S.relaxUntil = -1e9; S.torches = false; S.aiPlayer = false; S.aiCost = { ms: 0, thinks: 0, ticks: 0, max: 0 }; }
  // sunflower blob, ~12 px between neighbours; positions on blocked ground are skipped so the blob keeps its headcount
  const blobR = (n) => 7 * Math.sqrt(n);
  function blob(x, y, n, team) { for (let i = 0, k = 0; k < n && i < n * 4; i++) { const a = i * 2.39996, d = 7 * Math.sqrt(i + 0.5), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!PS.terrain.walkable(px, py)) continue; S.agents.push(mkAgent(px, py, team)); k++; } }

  // One clash on an empty field (the flat fixture map): n player peasants vs m Greedy (team 2) peasants, facing edges 60 px apart, both
  // sides charging the other's centroid every tick. No AI think, neutrals, trickle or power-ups; Normal difficulty. Seeded per run.
  // The fight ends at its first rout (or a wipe): survivors are counted at the rout, before the flip; flipped and fled come from it.
  // opts.armsA / opts.armsB: that side's Arms tier (M6 parity matrix)
  function fightOnce(n, m, maxSeconds, seed, opts) {
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
    if (opts && opts.armsA) { p.tier.arms = opts.armsA; SPL.applyTiers(p, true); } if (opts && opts.armsB) { r.tier.arms = opts.armsB; SPL.applyTiers(r, true); }
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
  // PS.fight(30, 20, 25, runs, seed, { armsA, armsB }): run i is seeded seed + i, so the runs differ and each one replays; reports medians
  function fight(n, m, maxSeconds, runs, seed, opts) {
    n = Math.max(1, n | 0 || 30); m = Math.max(1, m | 0 || 20); maxSeconds = clamp(+maxSeconds || 25, 1, 120); runs = clamp(runs | 0 || 3, 1, 9); seed = seed == null ? 20260924 : seed >>> 0;
    return withSandbox(() => {
      const all = []; for (let i = 0; i < runs; i++) all.push(fightOnce(n, m, maxSeconds, seed + i, opts));
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
  // straggler: a full-height ridge fixtures.stragglerRidge cells thick with one fixtures.stragglerPass-cell pass at mid-height
  function stragGeom() { const T = PS.terrain, N = T.N, cell = T.cell, FX = S.cfg.fixtures, i0 = (N >> 1) - (FX.stragglerRidge >> 1), j0 = (N >> 1) - (FX.stragglerPass >> 1); return { i0, j0, xw: i0 * cell, xe: (i0 + FX.stragglerRidge) * cell, cy: (j0 + FX.stragglerPass / 2) * cell }; }
  function fixtureMap(kind) {
    if (fixtureMaps[kind]) return fixtureMaps[kind];
    const T = PS.terrain, N = T.N, FX = S.cfg.fixtures, terr = new Uint8Array(N * N), pm = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) terr[j * N + i] = 1;
    if (kind === "flipflop") { const [rw, rh] = FX.flipflopRidge, i0 = (N - rw) >> 1, j0 = (N >> 1) - (rh >> 1); for (let j = j0; j < j0 + rh; j++) for (let i = i0; i < i0 + rw; i++) terr[j * N + i] = 1; }
    else if (kind === "straggler") { const g = stragGeom(); for (let j = 2; j < N - 2; j++) for (let i = g.i0; i < g.i0 + FX.stragglerRidge; i++) { if (j < g.j0 || j >= g.j0 + FX.stragglerPass) terr[j * N + i] = 1; else pm[j * N + i] = 1; } }
    else { const g = passGeom(kind); for (let j = 2; j < N - 2; j++) for (let i = g.i0; i < g.i0 + FX.passLen; i++) { if (j < g.j0 || j >= g.j0 + g.w) terr[j * N + i] = 1; else pm[j * N + i] = 1; } }
    return (fixtureMaps[kind] = T.fromTerr(terr, { name: kind, passMask: pm }));
  }
  // a fresh scene on map m in the current world: player + the three rivals (dormant), no AI think, no trickle, no power-ups, seeded
  function fixtureBase(m, seed) {
    const cfg = S.cfg, old = S.map;
    S.agents = []; S.obstacles = []; S.powerups = []; S.camps = []; S.banners = []; S.decals = []; S.trails = []; SPL.reset();
    S.map = m; PS.terrain.use(m); placeTables(m); bucketObstacles(); if (!sandbox && old && old !== m) releaseGround(old);
    S.flowW = PS.flow.use(PS.flow.reset(sandbox ? sbFlow : liveFlow, m));
    S.fogW = PS.fog.use(PS.fog.reset(sandbox ? sbFog : liveFog, m, { learn: false })); S.fogS = mkFogS(); S.fogOn = false; // fixtures keep full knowledge and an unfogged view
    S.cap = cfg.spawn.agentCap; S.dbg = { terrainBad: 0, firstBad: null, capOver: 0 }; S.tick = 0; S.acc = 0; S.ev = mkEv(); S.lastRout = null; S.thinkRR = 0; S.camS = mkCamS();
    S.attract = false; S.difficulty = "normal"; S.t = 0; S.timeLeft = 1e9; S.trickleT = -1e9; S.shake = 0; S.result = null; S.engagedNow = false; S.finalCalled = true; S.pendingEnd = null; S._routedBy = null; S.lastDrawSim = 0;
    S._hintRecruit = S._hintFight = S._hintHud = true; S.seed = seed >>> 0; S.rng = mulberry32(S.seed); S.stats = { recruited: 0, kills: 0, routs: 0, lost: 0, peak: 1, powerups: 0, fights: 0 };
    resetM4();
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
      col.speedMod = FX.holdPace / diff().aiSpeed; // the column marches at fixtures.holdPace whatever the difficulty's rival pace (M4 moved Normal 0.92 -> 0.88; see M4 notes)
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
    const lp = opts.loser !== "ai", L = S.teams[lp ? 1 : 2], Wn = S.teams[lp ? 2 : 1]; S.teams[2].alive = true; S.t = S.cfg.ai.grace;
    blob(W / 2 - 30 - blobR(FX.remnantLose), H / 2, FX.remnantLose, L.id); blob(W / 2 + 30 + blobR(FX.remnantWin), H / 2, FX.remnantWin, Wn.id); settle(L); settle(Wn);
    let R = null, t0 = -1, next = 1, rx = 0, ry = 0, rn = 0; const dist = [], states = [];
    const rem = () => { rn = 0; rx = 0; ry = 0; for (const a of S.agents) if (a.team === L.id && !a.dead && a.escapeT > 0) { rn++; rx += a.x; ry += a.y; } if (rn) { rx /= rn; ry /= rn; } };
    return { name: "remnant", drive() {
      if (!R && S.lastRout) { R = S.lastRout; t0 = S.t; if (Wn.ai && !opts.chase) Wn.thinkT = 0; }
      rem();
      if (R && rn && S.t - t0 >= next - 1e-9) { dist.push(Math.round(Math.hypot(rx - Wn.cx, ry - Wn.cy))); states.push(Wn.ai ? Wn.state + (Wn.preyId ? ":" + Wn.preyId : "") : "chase"); next++; }
      L.tx = Wn.cx; L.ty = Wn.cy; L.route = true;
      if (!R) { Wn.tx = L.cx; Wn.ty = L.cy; Wn.route = true; } else if (!Wn.ai || opts.chase) { if (rn) { Wn.tx = rx; Wn.ty = ry; } Wn.route = true; }
    }, done: () => (R && S.t - t0 >= FX.remnantSeconds) || S.t - S.cfg.ai.grace > 40, result: () => ({ fixture: "remnant", loser: lp ? "player" : "ai", winner: Wn.ai && !opts.chase ? "ai" : "chasing",
      rout: R ? { t: +(R.t - S.cfg.ai.grace).toFixed(2), group: R.group, flipped: R.flipped, fled: R.fled } : null, dist, maxDist: dist.length ? Math.max(...dist) : 0, winnerStates: states,
      escape: [Math.round(L.escGX), Math.round(L.escGY)], pass: dist.length > 0 && Math.max(...dist) >= 350 }) };
  }
  // straggler (Peter's playtest, P1): you walked through the pass and fixtures.stragglerN peasants were left behind. Your fixtures.stragglerMain
  // hold with the target on them fixtures.stragglerMainGap px east of the ridge, fixtures.stragglerRise px above the pass; the stragglers
  // stand fixtures.stragglerGap px west of it at the same height (~230 px away in a straight line, ~1050 px by path). Every straggler must
  // come within fixtures.stragglerNear px of the team centroid inside fixtures.stragglerSeconds, and no agent may sit with sdf < r for more
  // than fixtures.stragglerRockSeconds in a row, nor lean on it (inside the wall-slide band at under 30% pace) that long. opts.mode: "route" (the cursor on the group; default), "hold",
  // "steer" (keys / joystick) or "huddle" (route with SPACE held). opts.wobble: the target sways that many px at 1 Hz (a hovering cursor:
  // rebuilds and hysteresis). opts.fog: the player's knowledge comes from its fog (true: what it sees now; "walked": plus the pass it came through).
  function fxStraggler(seed, opts) {
    const FX = S.cfg.fixtures, m = fixtureMap("straggler"), g = stragGeom(), mode = opts.mode || "route"; fixtureBase(m, seed);
    const p = S.teams[1], y = g.cy - FX.stragglerRise, mx = g.xe + FX.stragglerMainGap;
    blob(mx, y, FX.stragglerMain, 1); const n0 = S.agents.length; blob(g.xw - FX.stragglerGap, y, FX.stragglerN, 1); settle(p);
    const sa = S.agents.slice(n0), reach = sa.map(() => -1), rock = new Map(), press = new Map(), track = []; let rockMax = 0, rockWho = null, pressMax = 0, pressWho = null, allAt = -1, straight = 0, minPath = 1e9;
    const fm = PS.flow.buildFromMe(1, p.ax, p.ay, 4000); // the true path from the group to each straggler (terrain as it is, whatever the player knows)
    for (const a of sa) { straight = Math.max(straight, Math.hypot(a.x - p.cx, a.y - p.cy)); const d = PS.flow.pathPx(fm, a.x, a.y); if (d >= 0 && d < minPath) minPath = d; } S.input.huddle = mode === "huddle";
    if (opts.fog) { // the live game's knowledge: the player knows only what its agents have seen, and its fog teaches the field (M3)
      S.flowW.know.fill(0); S.fogW = PS.fog.use(PS.fog.reset(sandbox ? sbFog : liveFog, m, { learn: true })); S.fogS = mkFogS(); S.fogOn = true; fogStampAll();
      if (opts.fog === "walked") { // the walk you came by: from 600 px south-west of the pass, through it, up to the group, seen at your sight radius
        const R = S.cfg.fog.sight0 + S.cfg.fog.sightK * Math.sqrt(p.count), pts = [[g.xw - 420, g.cy + 420], [(g.xw + g.xe) / 2, g.cy], [mx, y]], N = m.N, cell = m.cell;
        for (let k = 0; k + 1 < pts.length; k++) for (let u = 0; u <= 1; u += 0.05) { const px = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, py = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u;
          for (let j = Math.max(0, ((py - R) / cell) | 0); j <= Math.min(N - 1, ((py + R) / cell) | 0); j++) for (let i = Math.max(0, ((px - R) / cell) | 0); i <= Math.min(N - 1, ((px + R) / cell) | 0); i++) if (Math.hypot((i + 0.5) * cell - px, (j + 0.5) * cell - py) < R) PS.flow.learn(j * N + i); }
      }
    }
    return { name: "straggler", drive() {
      const r = FX.stragglerNear;
      for (let k = 0; k < sa.length; k++) { const a = sa[k]; if (reach[k] < 0 && !a.dead && Math.hypot(a.x - p.cx, a.y - p.cy) < r) reach[k] = +S.t.toFixed(2); }
      // in rock: sdf < r (the push-out corrects this every tick, so it stays near 0 even when an agent leans on the ridge); pressed: inside
      // the wall-slide band (sdf < r + flow.slideMargin) and slower than 30% of the team's pace, i.e. leaning on the rock instead of walking
      const sm = S.cfg.flow.slideMargin, slow = 0.3 * p.spd;
      for (const a of S.agents) { if (a.team !== 1 || a.dead) continue; const sd = PS.terrain.sdfAt(a.x, a.y), who = () => ({ t: +S.t.toFixed(2), x: Math.round(a.x), y: Math.round(a.y), straggler: sa.indexOf(a) >= 0 });
        if (sd < a.r) { const v = (rock.get(a) || 0) + DT; rock.set(a, v); if (v > rockMax) { rockMax = v; rockWho = who(); } } else if (rock.has(a)) rock.set(a, 0);
        if (sd < a.r + sm && Math.hypot(a.vx, a.vy) < slow) { const v = (press.get(a) || 0) + DT; press.set(a, v); if (v > pressMax) { pressMax = v; pressWho = who(); } } else if (press.has(a)) press.set(a, 0); }
      if (allAt < 0 && reach.every((v) => v >= 0)) allAt = S.t;
      if (S.tick % 60 === 0) { let x = 0, y2 = 0, k = 0, st = 0; for (const a of sa) if (!a.dead) { x += a.x; y2 += a.y; k++; st += a.strag; } if (k) track.push([Math.round(S.t), Math.round(x / k), Math.round(y2 / k), st]); } // the stragglers' centroid each second (x, y, how many flagged)
      p.tx = mx + (opts.wobble || 0) * Math.sin(2 * Math.PI * S.t); p.ty = y; p.mode = mode === "route" || mode === "huddle" ? "route" : mode; p.route = p.mode === "route"; p.hyst = true; // wobble: a hovering cursor
    }, done: () => (allAt >= 0 && S.t >= allAt + 0.5) || S.t >= FX.stragglerSeconds, result: () => {
      const last = reach.every((v) => v >= 0) ? Math.max(...reach) : null, left = sa.map((a) => Math.round(Math.hypot(a.x - p.cx, a.y - p.cy)));
      return { fixture: "straggler", mode, wobble: opts.wobble || 0, fog: opts.fog || false, main: FX.stragglerMain, stragglers: sa.length, straightPx: Math.round(straight), pathPx: minPath < 1e9 ? Math.round(minPath) : null, reached: reach, lastReached: last, distLeft: left,
        rockMaxSeconds: +rockMax.toFixed(2), rockWorst: rockWho, pressMaxSeconds: +pressMax.toFixed(2), pressWorst: pressWho, stillStraggling: sa.reduce((n, a) => n + a.strag, 0), track, seconds: +S.t.toFixed(2),
        pass: last != null && last <= FX.stragglerSeconds && rockMax <= FX.stragglerRockSeconds && pressMax <= FX.stragglerRockSeconds };
    } };
  }
  const FIXTURES = { pass64: (sd) => fxPass("pass64", sd), pass128: (sd) => fxPass("pass128", sd), ambush: (sd, o) => fxAmbush(sd, o || {}), flipflop: (sd, o) => fxFlipflop(sd, o || {}), cliff: (sd, o) => fxCliff(sd, o || {}),
    hold: (sd, o) => fxHold(sd, o || {}), remnant: (sd, o) => fxRemnant(sd, o || {}), straggler: (sd, o) => fxStraggler(sd, o || {}) };
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

  // PS.artScene(name, { zoom, n }) (debug, live page, after PS.debugStart): stages a scene for the M5 art screenshots on the live map, with
  // the camera on your swarm. "home" (as started), "pass" (a narrow pass between rock), "ford" / "bridge" (your swarm on a bank, marching
  // across), "clash" (you 70 v Greedy 50), "rout" (you 90 v Greedy 36, stepped to the rout banner), "teams" (six swarms of 30 around you,
  // fog lifted, rivals frozen). Rivals in the staged scenes do not think. Returns where it staged.
  // ?poster=1 (SPEC-v2 §11, R7): a fixed scene for the arcade card and portal covers: a mint mob charging an orange mob across a ford, fog
  // off, sim frozen, no HUD, the logo the only text. Captured by the harness (--poster) at 1920x1080, 800x450 and 800x800.
  function posterStage() {
    PS.audio.setSilent(true); newGame(false, { seed: S.cfg.polish.posterSeed }); S.mode = "play"; S.fogOn = false; S._hintFight = S._hintHud = S._hintRecruit = S._hintFog = true; S._hintRelic = S._hintRem = 2;
    showOverlay(null); $("hud").classList.add("hidden"); $("poster").classList.remove("hidden"); $("hint").classList.remove("show");
    const P = S.cfg.polish, r = artScene("ford", { n: P.posterMint, walk: 0 }), m = S.map, R = m.river, nx = -R.dy, ny = R.dx, g = S.teams[2];
    S.agents = S.agents.filter((a) => a.team !== 2); blob(r.x - nx * 150, r.y - ny * 150, P.posterOrange, 2); recount(); g.pcx = g.cx; g.pcy = g.cy; g.tx = r.x + nx * 80; g.ty = r.y + ny * 80; g.thinkT = 1e9;
    PS.step(P.posterStep); S.banners.length = 0; S.mode = "poster"; S.cam.x = r.x; S.cam.y = r.y - (S.vh * 0.1) / S.cam.zoom; if (S.map.chunks) flushGround(S.map); // the two mobs a stride apart across the ford, a little below the logo
  }
  function artScene(name, opts) {
    opts = opts || {}; const m = S.map, N = m.N, cell = m.cell, W = m.W, pl = S.teams[1], T = PS.terrain, walk = (x, y) => T.walkable(x, y) && T.sdfAt(x, y) >= cell * 0.6;
    S.zoomLock = opts.zoom || 0;
    const clear = (teams) => { S.agents = S.agents.filter((a) => teams.indexOf(a.team) < 0); }, // only the teams the scene stages (a rival with no agents is eliminated)
      freeze = () => { for (let i = 2; i < S.teams.length; i++) S.teams[i].thinkT = 1e9; },
      put = (x, y, n, team) => { blob(x, y, n, team); },
      done = (x, y) => { recount(); for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; t.pcx = t.cx; t.pcy = t.cy; t.tx = t.cx; t.ty = t.cy; } fogStampAll(); S.cam.x = x; S.cam.y = y; zoomRule(pl.count, 0, true); if (S.map.chunks) flushGround(S.map); return { name, x: Math.round(x), y: Math.round(y), zoom: S.cam.zoom }; },
      near = (x, y, r) => { for (let k = 0; k < 60; k++) { const a = k * 2.39996, d = (k / 60) * r, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (walk(px, py)) return [px, py]; } return [x, y]; };
    if (name === "home") return done(pl.cx, pl.cy);
    if (name === "ford" || name === "bridge") {
      const want = name === "ford" ? 3 : 4; let sx = 0, sy = 0, sn = 0, best = null;
      for (let c = 0; c < N * N; c++) if (m.terr[c] === want) { const x = ((c % N) + 0.5) * cell, y = (((c / N) | 0) + 0.5) * cell; if (!best) best = [x, y]; if (Math.hypot(x - best[0], y - best[1]) < 200) { sx += x; sy += y; sn++; } }
      if (!sn) return { name, error: "no " + name };
      const cx = sx / sn, cy = sy / sn, R = m.river, nx = -R.dy, ny = R.dx, side = opts.side || 1, [bx, by] = near(cx + nx * 150 * side, cy + ny * 150 * side, 80);
      clear([1]); freeze(); put(bx, by, opts.n || 40, 1); const r = done(cx, cy); PS.aim(cx - nx * 170 * side, cy - ny * 170 * side); PS.step(opts.walk == null ? 1.1 : opts.walk); return r;
    }
    if (name === "pass") {
      let best = -1, bc = -1;
      for (let c = 0; c < N * N; c++) {
        if (!m.passMask[c] || m.terr[c] !== 0) continue; const i = c % N, j = (c / N) | 0; let rock = 0, wet = 0;
        for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) { const q = (j + v) * N + i + u; if (q < 0 || q >= N * N) continue; if (m.terr[q] === 1) rock++; else if (m.terr[q] >= 2) wet++; }
        const d = Math.hypot(i - N / 2, j - N / 2) / N; if (wet || d < 0.12 || d > 0.35) continue; if (rock > best) { best = rock; bc = c; }
      }
      const x = ((bc % N) + 0.5) * cell, y = (((bc / N) | 0) + 0.5) * cell, [bx, by] = near(x, y + 90, 60);
      clear([1]); freeze(); put(bx, by, opts.n || 60, 1); return done(x, y);
    }
    if (name === "clash" || name === "rout") {
      const s0 = m.spawns[pl.slot], [x, y] = near(s0.x, s0.y, 60), n = name === "rout" ? 90 : 70, e = name === "rout" ? 36 : 50;
      clear([1, 2]); freeze(); put(x - 60, y, n, 1); put(x + 60, y, e, 2); const r = done(x, y);
      const g = S.teams[2]; g.tx = x - 60; g.ty = y; PS.aim(x + 70, y);
      if (name === "clash") { PS.step(2.0); return r; } // M5 critic MAJOR-1: 2 s into the clash
      for (let k = 0; k < 24; k++) { PS.step(0.5); g.tx = pl.cx; g.ty = pl.cy; PS.aim(g.count ? g.cx : pl.cx, g.count ? g.cy : pl.cy); if (S.banners.some((b) => /JOIN/.test(b.text))) break; }
      return Object.assign(r, { banners: S.banners.map((b) => b.text), t: +S.t.toFixed(1) });
    }
    // M6: your swarm (opts.n, default 24) opts.gap px from the first objective of that type toward the map centre (a bandit camp of opts.kind), camera on it
    if (name === "village" || name === "chest" || name === "heavy" || name === "bandit" || name === "relic") {
      let o = null; for (const q of S.objs) if (q.type === (name === "relic" ? "chest" : name) && q.live && (name !== "bandit" || q.kind === (opts.kind || 0))) { o = q; break; }
      if (!o) return { name, error: "no " + name };
      if (name === "relic") { o.live = false; o = SPL.relicAt(o.x + 40, o.y, o.axis, false, "chest", Infinity); }
      const g = opts.gap || (name === "bandit" ? 230 : 130), cdx = W / 2 - o.x, cdy = W / 2 - o.y, cl = Math.hypot(cdx, cdy) || 1, [x, y] = near(o.x + (cdx / cl) * g, o.y + (cdy / cl) * g + 40, 60); clear([1]); freeze(); put(x, y, opts.n || 24, 1); // g px toward the map centre
      const r = done(o.x, o.y + 20); PS.aim(x, y); return Object.assign(r, { obj: { type: o.type, x: Math.round(o.x), y: Math.round(o.y), gar: o.gar, weight: o.weight, n: o.n, axis: o.axis } });
    }
    if (name === "teams") {
      const s0 = m.spawns[pl.slot], [x, y] = near(s0.x, s0.y, 80), R0 = opts.r || 150;
      clear([1, 2, 3, 4, 5, 6]); freeze(); S.fogS.reveal = true;
      for (let i = 1; i <= 6; i++) { const a = (i - 1) * 1.0472 - 1.5708, [bx, by] = near(x + Math.cos(a) * (i === 1 ? 0 : R0), y + Math.sin(a) * (i === 1 ? 0 : R0), 60); put(bx, by, opts.n || 30, i); }
      return done(x, y);
    }
    return { name, error: "unknown scene" };
  }

  // PS.simMatch(300, { seed, cap, wallMs, difficulty }): an all-AI match under the real rules (grace, scent, pile-on, horn and crown) on a fresh
  // seeded world: all six swarms AI-driven, team 1 as ai.proxy at the player's pace, the rivals at the difficulty's senses and pace.
  // Counts every 30 s. Asserts per tick: agent cap and no agent centre in rock or deep water.
  function simMatch(seconds, opts) {
    opts = opts || {};
    const lim = clamp(+seconds || S.cfg.world.matchSeconds, 1, 600), wallMs = clamp(+opts.wallMs || 10000, 500, 14000);
    return withSandbox(() => {
      sandboxField(); S.difficulty = opts.difficulty || "normal";
      newGame(false, { aiPlayer: true, seed: opts.seed != null ? opts.seed : (Math.random() * 4294967296) >>> 0, cap: opts.cap === "touch" ? S.cfg.spawn.touchAgentCap : opts.cap === "desktop" ? S.cfg.spawn.agentCap : +opts.cap || S.cfg.spawn.agentCap });
      S.mode = "play";
      const tl = [], errors = [], w0 = performance.now(); let maxTotal = S.agents.length, next = 30, end = "limit", truncated = false;
      const snap = () => { const c = []; let nn = 0; for (let i = 1; i < S.teams.length; i++) c.push(S.teams[i].count); for (const a of S.agents) if (a.team === 0) nn++; tl.push({ t: Math.round(S.t), counts: c, neutrals: nn, total: S.agents.length }); };
      snap();
      for (let i = 0; i < lim * 60; i++) {
        let alive = 0; for (let j = 1; j < S.teams.length; j++) if (S.teams[j].alive) alive++;
        if (alive <= 1) { end = "last-standing"; break; }
        if (S.timeLeft - DT <= 0) { end = "bell"; break; }
        try { update(DT); } catch (e) { errors.push(String((e && e.message) || e)); break; }
        if (S.mode !== "play") { end = S.result === "bell" ? "bell" : "last-standing"; break; }
        if (S.agents.length > maxTotal) maxTotal = S.agents.length;
        if (S.t >= next - 1e-9) { snap(); next += 30; }
        if ((i & 63) === 63 && performance.now() - w0 > wallMs) { truncated = true; break; } // lesson 20
      }
      if (tl[tl.length - 1].t !== Math.round(S.t)) snap();
      let win = null; for (let i = 1; i < S.teams.length; i++) { const t = S.teams[i]; if (t.alive && (!win || t.count > win.count)) win = t; }
      return { seed: S.seed, map: PS.terrain.report(S.map), seconds: +S.t.toFixed(2), end, truncated, wallMs: Math.round(performance.now() - w0), msPerTick: +((performance.now() - w0) / Math.max(1, S.tick)).toFixed(3),
        names: S.teams.slice(1).map((t) => t.name), winner: win ? { id: win.id, name: win.name, count: win.count } : null, maxTotal, agentCap: S.cap,
        capOver: S.dbg.capOver, terrainBad: S.dbg.terrainBad, firstBad: S.dbg.firstBad, timeline: tl, exceptions: errors, ev: { ...S.ev }, flow: PS.flow.stats,
        leftHome: S.teams.slice(1).map((t) => t.leftHome), atCentre: S.teams.slice(1).map((t) => t.atCentre), ai: { ...S.fogS.ai }, fog: { ...S.fogS.stats }, slots: S.teams.slice(1).map((t) => t.slot),
        aiCost: aiCostReport(), pacing: pacing() };
    });
  }
  const aiCostReport = () => { const C = S.aiCost; return { msPerTick: +(C.ms / Math.max(1, C.ticks)).toFixed(4), msPerThink: +(C.ms / Math.max(1, C.thinks)).toFixed(4), maxMs: +C.max.toFixed(3), thinks: C.thinks, ticks: C.ticks }; };
  // PS.pacing(): this match's pacing record (SPEC-v2 §9 harness targets): first sighting (by team 1 and by any swarm), first fight (any pair and
  // team 1's), fights, swarms alive at 1:00 / 2:00 / 3:00 and now, eliminations [t, team], the horn's leader and swarms alive then, the
  // biggest swarm now (the winner once the bell has rung), pile-ons, scent pings, crown moves, trickle bias and the AI think cost
  function pacing() {
    const E = S.ev, FS = S.fogS; let al = 0; for (let i = 1; i < S.teams.length; i++) if (S.teams[i].alive) al++; const b = biggestTeam();
    return { t: +S.t.toFixed(2), timeLeft: +S.timeLeft.toFixed(2), result: S.result, mode: S.mode, difficulty: S.difficulty, aiPlayer: S.aiPlayer, firstSight: FS ? FS.stats.firstSight : -1, firstSightAny: E.firstSightAny,
      firstFight: E.firstFight, firstPlayerFight: E.firstPlayerFight, fights: E.fights, playerFights: S.stats.fights, routs: E.routs, remnants: E.remnants, scattered: E.scattered,
      alive60: E.alive60, alive120: E.alive120, alive180: E.alive180, aliveNow: al, elims: E.elims.slice(), hornLeader: E.hornLeader, hornAlive: E.hornAlive, biggest: b ? b.id : 0,
      counts: S.teams.slice(1).map((t) => t.count), names: S.teams.slice(1).map((t) => t.name), pileOns: E.pileOns, scentPings: E.scentPings, crownMoves: E.crownMoves,
      trickle: E.trickle, trickleFav: E.trickleFav, leftHome: S.teams.slice(1).map((t) => t.leftHome), ai: FS ? { ...FS.ai } : null, aiCost: aiCostReport(), dbg: { ...S.dbg },
      tiers: S.teams.slice(1).map((t) => t.tierN), tiers60: E.tiers60, tiers180: E.tiers180, tiers300: E.tiers300, taken: E.taken.slice(), gains: E.gains.slice(), drops: E.drops, trickleChests: E.trickleChests, mustered: S.teams.slice(1).map((t) => t.mustered) };
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
      blob(x0, y0, 20, 1); settle(p); const R = sightR(p), cx = x0 + R + S.cfg.fixtures.hiddenGap, cy = y0; // the nearest rival agents start ~540 px past the sight edge and stay 280+ out while they fight (P1: at 155 px/s the rout's remnant ran 170 px nearer than at 170, so the scene moved 150 px out)
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
      fixtureBase(flatMap || (flatMap = PS.terrain.flat()), 9); S.t = S.cfg.ai.grace + 1; const W = S.cfg.world.w, big = S.teams[2], small = S.teams[3]; big.alive = small.alive = true;
      const nBig = Math.max(60, Math.ceil(12 * big.ai.huntRatio * diff().huntMult * S.cfg.ai.aiVsAiHuntMult * 1.2)); // M8: 1.2x over the AI-vs-AI hunt threshold, so the check reads blindness, not the ratio
      blob(W / 2, W / 2 + 1500, 3, 1); blob(W / 2 - 1300, W / 2, nBig, 2); blob(W / 2 + 1300, W / 2, 12, 3); settle(S.teams[1]); settle(big); settle(small); big.thinkT = 0; small.thinkT = 1e9; fogStampAll(); // your 3 far off, out of everyone's sight
      let huntBlind = 0, huntSeen = -1, gapBlind = 1e9;
      for (let i = 0; i < 240; i++) { small.tx = W / 2 + 1300; small.ty = W / 2; small.route = true; update(DT); if (big.state === "hunt" && big.preyId === 3) huntBlind++; gapBlind = Math.min(gapBlind, Math.hypot(big.cx - small.cx, big.cy - small.cy)); }
      const dx = big.cx + 330 - small.cx, dy = big.cy - small.cy; for (const a of S.agents) if (a.team === 3) { a.x += dx; a.y += dy; } recount(); // carried into sight
      for (let i = 0; i < 180 && huntSeen < 0; i++) { small.tx = small.cx; small.ty = small.cy; small.route = true; update(DT); if (big.state === "hunt" && big.preyId === 3) huntSeen = +(i / 60).toFixed(2); }
      return { huntBlindTicks: huntBlind, closestWhileBlind: Math.round(gapBlind), huntAfterSighting: huntSeen, ai: { ...S.fogS.ai }, pass: huntBlind === 0 && huntSeen >= 0 && S.fogS.ai.violations === 0 };
    });
  }
  // ---------------------------------------------------------------- QA: rivals and match (SPEC-v2 §7, §9; M4 brief 8)
  // slots: the same seed shuffles the six spawns the same way, other seeds differently; the five rivals are the five kinds in their colours
  function slotTest() {
    return withSandbox(() => {
      const run = (seed) => { sandboxField(); newGame(false, { seed }); return { slots: S.teams.slice(1).map((t) => t.slot), kinds: S.teams.slice(2).map((t) => t.kind), colors: S.teams.slice(2).map((t) => t.color), n: S.teams.length - 1, map: S.map }; };
      const a = run(4242), b = run(4242), others = [4243, 4244, 4245].map((s) => run(s).slots.join("")), key = a.slots.join("");
      return { a: a.slots, b: b.slots, others, kinds: a.kinds, colors: a.colors, pass: a.n === 6 && key === b.slots.join("") && new Set(a.slots).size === 6 && others.some((o) => o !== key) &&
        a.kinds.join() === "greedy,bully,wary,sly,stubborn" && a.colors[3] === "#C8323C" && a.colors[4] === "#9A62E0" };
    });
  }
  // Bully's scent (Normal): pings at ai.grace, then every scentEvery s, within ai.scentJitter px of you; the first one bannered; Bully tracks it
  function scentTest() {
    return withSandbox(() => {
      fixtureBase(flatMap || (flatMap = PS.terrain.flat()), 11); const W = S.cfg.world.w, AI = S.cfg.ai, every = S.cfg.difficulty.normal.scentEvery, p = S.teams[1], b = S.teams[3]; b.alive = true;
      blob(W / 2 - 900, W / 2, 10, 1); blob(W / 2 + 900, W / 2, 30, 3); settle(p); settle(b); fogStampAll(); S.t = AI.grace - 1;
      const pings = [], err = [], states = {}; let last = 0, banners = [], thought = false; // Bully stays put (no fight can end the test); it thinks once, just after the first ping
      for (let i = 0; i < Math.round((2.2 * every + 1) * 60); i++) {
        p.tx = W / 2 - 900; p.ty = W / 2; p.mode = "hold"; if (!thought && S.scent.n > 0 && b.thinkT > 1e8) b.thinkT = 0;
        update(DT); if (!thought && b.thinkT < 1e8) { thought = true; states[b.state] = 1; b.thinkT = 1e9; } b.tx = b.cx; b.ty = b.cy;
        if (S.scent.n !== last) { last = S.scent.n; pings.push(+S.scent.t.toFixed(2)); err.push(Math.round(Math.hypot(S.scent.x - p.ax, S.scent.y - p.ay))); for (const q of S.banners) banners.push(q.text); }
      }
      const gaps = pings.slice(1).map((t, i) => +(t - pings[i]).toFixed(2));
      return { pings, gaps, err, banners, states, pass: pings.length === 3 && Math.abs(pings[0] - AI.grace) < 0.05 && gaps.every((g) => Math.abs(g - every) < 0.05) && err.every((e) => e <= AI.scentJitter + 1) && banners[0] === "BULLY HAS YOUR SCENT" && (states.track || 0) > 0 };
    });
  }
  // pile-on: Greedy (120) fighting Bully (40) passes 1.6x the second; Sly 1000 px off hears it and joins, Stubborn 2600 px off (past its
  // hearing) does not; the banner reads "THE VALLEY TURNS ON GREEDY"
  function pileTest() {
    return withSandbox(() => {
      fixtureBase(flatMap || (flatMap = PS.terrain.flat()), 13); const W = S.cfg.world.w, c = W / 2, T = S.teams; for (let i = 2; i <= 6; i++) if (i !== 4) T[i].alive = true;
      blob(300, 300, 8, 1); blob(c - 40 - blobR(120), c, 120, 2); blob(c + 40 + blobR(40), c, 40, 3); blob(c, c + 1000, 30, 5); blob(c, c - 2600, 30, 6);
      for (let i = 1; i <= 6; i++) settle(T[i]); fogStampAll(); S.t = S.cfg.ai.grace + 5; T[5].thinkT = 0.2; T[6].thinkT = 0.3; const st5 = {}, st6 = {}; let tgt = null;
      for (let i = 0; i < 240; i++) {
        T[1].tx = 300; T[1].ty = 300; T[1].mode = "hold"; T[2].tx = T[3].cx; T[2].ty = T[3].cy; T[3].tx = T[2].cx; T[3].ty = T[2].cy; update(DT);
        st5[T[5].state] = (st5[T[5].state] || 0) + 1; st6[T[6].state] = (st6[T[6].state] || 0) + 1; if (T[5].state === "pileon" && !tgt) tgt = [Math.round(T[5].tx), Math.round(T[5].ty)];
      }
      const banners = S.banners.map((b) => b.text), clash = [Math.round(T[2].engCx[3]), Math.round(T[2].engCy[3])];
      return { pileOns: S.ev.pileOns, pile: S.pile.id, banners, sly: st5, stubborn: st6, slyTarget: tgt, clash, ai: { ...S.fogS.ai },
        pass: S.ev.pileOns >= 1 && banners.indexOf("THE VALLEY TURNS ON GREEDY") >= 0 && (st5.pileon || 0) + (st5.hunt || 0) > 0 && !st6.pileon && !!tgt && Math.abs(tgt[1] - c) < 300 && S.fogS.ai.violations === 0 };
    });
  }
  // the horn and the crown: at 3:45 the biggest swarm is crowned and torches light (sight x finale.torches); in the finale the crowned team
  // routing a swarm absorbs nothing (its flipping survivors scatter as neutrals, finale.crownAbsorbs false; a group of combat.remnant.minLoser or
  // more keeps its remnant, finale.fullFlip false); any other finale rout of a small group is a full flip
  function crownTest() {
    return withSandbox(() => {
      fixtureBase(flatMap || (flatMap = PS.terrain.flat()), 17); const W = S.cfg.world.w, c = W / 2, T = S.teams, FN = S.cfg.world.finalSeconds; for (let i = 2; i <= 5; i++) T[i].alive = true;
      blob(300, 300, 6, 1); blob(c - 40 - blobR(100), c - 600, 100, 2); blob(c + 40 + blobR(30), c - 600, 30, 3); blob(c - 40 - blobR(45), c + 600, 45, 4); blob(c + 40 + blobR(15), c + 600, 15, 5);
      for (let i = 1; i <= 5; i++) settle(T[i]); fogStampAll(); S.finalCalled = false; S.timeLeft = FN + 0.5; const s0 = sightR(T[2]); let crownAt = 0, torch = 0; const routs = [];
      for (let i = 0; i < 1500 && routs.length < 2; i++) {
        T[1].tx = 300; T[1].ty = 300; T[1].mode = "hold"; T[2].tx = T[3].cx; T[2].ty = T[3].cy; T[3].tx = T[2].cx; T[3].ty = T[2].cy; T[4].tx = T[5].cx; T[4].ty = T[5].cy; T[5].tx = T[4].cx; T[5].ty = T[4].cy;
        const lr = S.lastRout; update(DT); if (!crownAt && S.crown.team) { crownAt = S.crown.team; torch = +(sightR(T[2]) / s0).toFixed(3); } if (S.lastRout && S.lastRout !== lr) routs.push({ ...S.lastRout, got: S.lastRout.got.join(",") });
      }
      const r23 = routs.find((r) => r.winner === 2), r45 = routs.find((r) => r.winner === 4);
      return { crownAt, torch, routs, pass: crownAt === 2 && Math.abs(torch - S.cfg.finale.torches) < 0.02 && !!r23 && r23.scattered > 0 && r23.flipped === 0 && (r23.group < S.cfg.combat.remnant.minLoser ? r23.fled === 0 : r23.fled > 0) && !!r45 && r45.fled === 0 && r45.scattered === 0 && r45.flipped === r45.group };
    });
  }

  // ---------------------------------------------------------------- QA: spoils (SPEC-v2 §8, §13; M6 brief 10)
  // placement on n seeds through the real newGame path: six villages (the configured garrisons), six fixed chests, the bandit camps by kind,
  // the heavy chests; every objective reachable (finite path distance from every spawn); every bandit camp >= encampments.banditMinPath by
  // path from every spawn; garrisons and bandits are agents (cap accounting) standing on walkable ground
  function spoilsPlacement(n) {
    const out = [], EN = S.cfg.encampments;
    for (let i = 0; i < n; i++) out.push(withSandbox(() => {
      sandboxField(); newGame(false, { seed: 1000 + i * 7919 }); const m = S.map, U = m.cell / 3, bad = [], cnt = { village: 0, chest: 0, heavy: 0, bandit: [0, 0, 0] }; let minB = 1e9;
      for (const o of S.objs) {
        const c = PS.terrain.cellOf(o.x, o.y); let far = 1e9; for (let k = 0; k < 6; k++) { const d = m.dist[k][c]; if (d >= 65535) bad.push(o.type + " unreachable from spawn " + k); if (d * U < far) far = d * U; }
        if (o.type === "bandit") { cnt.bandit[o.kind]++; if (far < minB) minB = far; if (far < EN.banditMinPath) bad.push("bandit camp " + Math.round(far) + " px from a spawn"); } else cnt[o.type]++;
        if (!PS.terrain.walkable(o.x, o.y)) bad.push(o.type + " on blocked ground");
      }
      const gars = S.objs.filter((o) => o.type === "village").map((o) => o.gar).sort((a, b) => a - b).join(","), want = EN.villages.slice().sort((a, b) => a - b).join(",");
      const garN = S.agents.filter((a) => a.gar).length, banN = S.agents.filter((a) => a.team === 8).length, sumG = S.objs.filter((o) => o.type === "village").reduce((s, o) => s + o.gar, 0), sumB = S.bandits.reduce((s, b) => s + b.n0, 0);
      if (cnt.village !== 6 || gars !== want) bad.push("villages " + gars); if (cnt.chest !== 6) bad.push("chests " + cnt.chest); if (cnt.bandit.join() !== EN.banditCounts.join()) bad.push("bandit camps " + cnt.bandit.join("/"));
      if (cnt.heavy !== EN.heavy.length) bad.push("heavy " + cnt.heavy); if (garN !== sumG || banN !== sumB) bad.push("agents gar " + garN + "/" + sumG + " bandits " + banN + "/" + sumB);
      if (S.agents.some((a) => !PS.terrain.walkable(a.x, a.y))) bad.push("agent on blocked ground");
      return { seed: S.seed, counts: cnt, garrisons: gars, bandits: S.bandits.map((b) => b.n0).join(","), minBanditPath: Math.round(minB), agents: S.agents.length, bad };
    }));
    return out;
  }
  // a small scene on the flat field for the spoils checks: the player (and rival 2 when asked) as blobs, fog data on, no AI think
  // (a scene fixture, so no win check ends it and no player input steers it: the checks set every target themselves)
  function spoilsScene(seed) { fixtureBase(flatMap || (flatMap = PS.terrain.flat()), seed); S.t = S.cfg.ai.grace + 1; S.fixture = { name: "spoils", drive() {}, done: () => false, result: () => null }; return { W: S.cfg.world.w, p: S.teams[1], r: S.teams[2] }; }
  const holdAt = (t, x, y) => { t.tx = x; t.ty = y; t.mode = "hold"; t.route = false; };
  // village join timing (SPEC-v2 §8): with >= garrison in the gate ring it joins at once; with fewer it joins after villageStep x (garrison -
  // nearby), villageMin minimum; a rival in the ring pauses the timer. The garrison joins through convert() (muster counts)
  function villageTest() {
    const EN = S.cfg.encampments, run = (have, rival) => withSandbox(() => {
      const { W, p, r } = spoilsScene(21); const x = W / 2, y = W / 2, v = SPL.stage("village", x, y, { gar: 12 });
      blob(x - (rival ? 40 : 0), y, have, 1); settle(p); if (rival) { r.alive = true; blob(x + 45, y, rival, 2); settle(r); }
      const rec0 = S.stats.recruited, must0 = p.mustered; let at = -1;
      for (let i = 0; i < 60 * 12 && at < 0; i++) { holdAt(p, x - (rival ? 40 : 0), y); if (rival) holdAt(r, x + 45, y); update(DT); if (!v.live) at = S.t - S.cfg.ai.grace - 1; }
      return { have, rival: rival || 0, joinedAfter: at < 0 ? null : +at.toFixed(2), prog: +v.prog.toFixed(3), owner: v.owner, count: p.count, recruited: S.stats.recruited - rec0, mustered: p.mustered - must0 };
    });
    const a = run(12, 0), b = run(6, 0), c = run(6, 3), want = Math.max(EN.villageMin, EN.villageStep * 6), tick = DT * EN.scanTicks;
    return { atOnce: a, fewer: b, paused: c, want, pass: a.joinedAfter != null && a.joinedAfter <= tick + 1e-6 && a.count === 24 && a.recruited === 12 && a.mustered === 12 &&
      b.joinedAfter != null && Math.abs(b.joinedAfter - want) <= 2 * tick + 1e-6 && b.count === 18 && c.joinedAfter == null && c.prog === 0 }; // one scan of slack either side
  }
  // bandits (SPEC-v2 §6, §8): three tough peasants (hp x100, a bait moved by hand) stand 100 px from a camp, then walk out past the leash; no bandit
  // chases farther than the leash (+ 16 px of separation); a 45 swarm then clears the camp: bandits never rout, never join, never take spoils
  // (every bandit stays team 8 until it dies), and clearing opens the chest (a relic). The swarm's shove on the camp is reported, not gated.
  function banditTest() {
    return withSandbox(() => {
      const EN = S.cfg.encampments, { W, p } = spoilsScene(23), x = W / 2, y = W / 2, b = SPL.stage("bandit", x, y, { kind: 1, n: 10, axis: "arms" });
      blob(x + 100, y, 3, 1); settle(p); for (const a of S.agents) if (a.team === 1) a.hp = 1000; let maxD = 0, turned = 0, chased = 0;
      const bait = S.agents.filter((a) => a.team === 1);
      for (let i = 0; i < 60 * 8; i++) {
        holdAt(p, p.cx, p.cy); update(DT); const bx = x + 100 + Math.max(0, S.t - S.cfg.ai.grace - 3) * 40; bait.forEach((a, k) => { a.x = bx; a.y = y + (k - 1) * 14; a.vx = a.vy = 0; });
        for (const a of b.agents) if (!a.dead) { const d = Math.hypot(a.x - x, a.y - y); if (d > maxD) maxD = d; if (a.team !== 8) turned++; if (a.fight) chased++; }
      }
      const lure = { maxFromCamp: Math.round(maxD), leash: EN.banditLeash, baitAt: Math.round(p.cx - x), banditFightTicks: chased };
      for (const a of S.agents) if (a.team === 1) a.dead = true; recount(); maxD = 0;
      blob(x - 260, y, 45, 1); settle(p); p.alive = true; const t0 = S.t, rout0 = S.ev.routs, tier0 = p.tierN; let cleared = -1, relic = false, took = -1;
      for (let i = 0; i < 60 * 30 && took < 0; i++) {
        p.tx = x; p.ty = y; p.route = true; p.mode = "route"; update(DT);
        for (const a of b.agents) { if (!a.dead && a.team !== 8) turned++; const d = Math.hypot(a.x - x, a.y - y); if (!a.dead && d > maxD) maxD = d; }
        if (cleared < 0 && !b.live) { cleared = +(S.t - t0).toFixed(2); relic = S.objs.some((o) => o.type === "relic" && o.src === "bandit"); }
        if (cleared >= 0 && p.tierN > tier0) took = +(S.t - t0).toFixed(2);
      }
      return { lure, fight: { cleared, relic, took, playerLeft: p.count, banditsLeft: b.n, maxFromCamp: Math.round(maxD), routs: S.ev.routs - rout0, turned, tier: p.tier.arms },
        pass: lure.maxFromCamp <= EN.banditLeash + 16 && lure.maxFromCamp > 70 && lure.banditFightTicks > 0 && cleared > 0 && relic && took > 0 && turned === 0 && S.ev.routs === rout0 };
    });
  }
  // M8 bandit cost (SPEC-v2 §8 pacing): a plain swarm of n (tier 0) routed from 260 px into a camp of kind (0 green, 1 orange, 2 red, the
  // configured size); per run: cleared or not, seconds from first contact to the last bandit down, peasants lost. PS.spoilsQA.banditCost({ kind, n, runs, seed })
  function banditCost(o) {
    o = o || {}; const kind = o.kind || 0, n = o.n || 12, runs = o.runs || 5, out = [];
    for (let r = 0; r < runs; r++) out.push(withSandbox(() => {
      const { W, p } = spoilsScene((o.seed || 500) + r), x = W / 2, y = W / 2, b = SPL.stage("bandit", x, y, { kind, axis: "boots" });
      blob(x - 260, y, n, 1); settle(p); const t0 = S.t; let hit = -1, done = -1;
      for (let i = 0; i < 60 * 40 && done < 0 && p.count > 0; i++) { p.tx = x; p.ty = y; p.route = true; p.mode = "route"; update(DT); if (hit < 0 && p.eng[8] > 0) hit = S.t; if (!b.live) done = S.t; }
      return { cleared: done >= 0, secs: done >= 0 && hit >= 0 ? +(done - hit).toFixed(1) : null, lost: n - p.count, left: b.n, walk: hit >= 0 ? +(hit - t0).toFixed(1) : null };
    }));
    const ok = out.filter((q) => q.cleared), med = (a) => { const v = a.slice().sort((u, w) => u - w); return v.length ? v[v.length >> 1] : null; };
    return { kind, n, bandits: S.cfg.encampments.banditSizes[kind], cleared: ok.length, runs, secs: med(ok.map((q) => q.secs)), lost: med(out.map((q) => q.lost)), per: out };
  }
  // heavy chest (SPEC-v2 §8): 10 in the ring of a 15 for 4 s: shut, the counter reads 10/15; 16: it opens after heavyHold s; one of
  // encampments.heavyPick2 lays two relics and the first one walked onto takes the pair
  function heavyTest() {
    return withSandbox(() => {
      const EN = S.cfg.encampments, { W, p } = spoilsScene(25), x = W / 2, y = W / 2, h = SPL.stage("heavy", x, y, { weight: 15, axis: "boots" });
      blob(x, y, 10, 1); settle(p);
      for (let i = 0; i < 240; i++) { holdAt(p, x, y); update(DT); }
      const shut = { live: h.live, have: h.have, label: h.have + "/" + h.weight };
      blob(x + 10, y + 10, 6, 1); settle(p); const t0 = S.t; let at = -1;
      for (let i = 0; i < 300 && at < 0; i++) { holdAt(p, x, y); update(DT); if (!h.live) at = +(S.t - t0).toFixed(2); }
      const got = p.tier.boots;
      const w2 = EN.heavyPick2, h2 = SPL.stage("heavy", x + 900, y, { weight: w2, axis: "horn" }); for (const a of S.agents) if (a.team === 1) { a.x += 900; } settle(p); if (p.count < w2) { blob(x + 900, y, w2 - p.count, 1); settle(p); } // M8: the pick-of-two weight comes from config
      let pair = 0; for (let i = 0; i < 300 && h2.live; i++) { holdAt(p, x + 900, y); update(DT); } pair = S.objs.filter((o) => o.type === "relic" && o.src === "heavy").length;
      const r = S.objs.find((o) => o.type === "relic" && o.src === "heavy"), tiers0 = p.tierN; let left = -1;
      if (r) { for (let i = 0; i < 400; i++) { p.tx = r.x; p.ty = r.y; p.route = true; p.mode = "route"; update(DT); if (p.tierN > tiers0) { left = S.objs.filter((o) => o.type === "relic" && o.src === "heavy").length; break; } } }
      return { shut, openedAfter: at, hold: EN.heavyHold, boots: got, pick2: { relicsLaid: pair, leftAfterPick: left, tiers: p.tierN }, pass: shut.live && shut.have === 10 && at >= EN.heavyHold - 2 * DT * EN.scanTicks && at <= EN.heavyHold + 0.2 && got === 1 && pair === 2 && left === 0 };
    });
  }
  // muster milestones (SPEC-v2 §8): progression.muster neutrals recruited grant Horn I, Boots I, Arms I in that order; absorbed rivals do not count
  function musterTest() {
    return withSandbox(() => {
      const { W, p } = spoilsScene(27), PG = S.cfg.progression; blob(W / 2, W / 2, 1, 1); settle(p); const log = [];
      const recruit = (k, absorbed) => { for (let i = 0; i < k; i++) { const a = mkAgent(W / 2 + 60, W / 2, 0); S.agents.push(a); convert(a, 1, absorbed); } };
      recruit(PG.muster[0] - 1, false); log.push(p.tier.horn); recruit(30, true); log.push(p.tier.horn); recruit(1, false); log.push(p.tier.horn);
      recruit(PG.muster[1] - PG.muster[0], false); log.push(p.tier.boots); recruit(PG.muster[2] - PG.muster[1] - 1, false); log.push(p.tier.arms); recruit(1, false); log.push(p.tier.arms);
      const gains = S.ev.gains.map((g) => g[2] + g[3] + ":" + g[4]);
      return { log, mustered: p.mustered, gains, hpMax: p.hpMax, pass: log.join() === "0,0,1,1,0,1" && p.mustered === PG.muster[2] && gains.join() === "horn1:muster,boots1:muster,arms1:muster" && Math.abs(p.hpMax - S.cfg.agent.hp * (1 + PG.armsHp)) < 1e-9 };
    });
  }
  // a routed leader (SPEC-v2 §8): the biggest swarm loses a rout group: every tier drops as a relic within progression.dropScatter of the contact,
  // each living progression.relicLife s (Arms may reach III); its tiers and stats go back to base; unclaimed drops expire
  function dropTest() {
    return withSandbox(() => {
      const PG = S.cfg.progression, { W, p, r } = spoilsScene(29), q = S.teams[3], x = W / 2, y = W / 2; r.alive = q.alive = true;
      blob(300, 300, 5, 1); blob(x - 50, y, 80, 2); blob(x + 60, y, 40, 3); settle(p); settle(r); settle(q);
      r.tier.arms = 2; r.tier.boots = 1; r.tier.horn = 1; SPL.applyTiers(r, true); const hp0 = r.hpMax;
      for (const a of S.agents) if (a.team === 2 && a.x > x - 90) a.fight = true; // its front is fighting at the contact
      rebuildGrid(); rout(r, q, x, y, false);
      const drops = S.objs.filter((o) => o.type === "relic" && o.src === "drop"), far = drops.length ? Math.max(...drops.map((o) => Math.hypot(o.x - x, o.y - y))) : 0;
      const after = { tiers: r.tierN, hpMax: r.hpMax, power: r.power }, life = drops.length ? drops[0].life : 0;
      const lone = SPL.stage("relic", 300, W - 300, { axis: "horn", life: 0.5 }); for (let i = 0; i < 45; i++) { holdAt(p, 300, 300); update(DT); } const expired = S.objs.indexOf(lone) < 0; // an unclaimed drop expires
      return { dropped: drops.length, axes: drops.map((o) => o.axis + (o.t3 ? "*" : "")).join(","), farthest: Math.round(far), life, hpBefore: hp0, after, expired,
        pass: drops.length === 4 && far <= PG.dropScatter + 24 && after.tiers === 0 && after.hpMax === S.cfg.agent.hp && after.power === 1 && drops.filter((o) => o.axis === "arms").every((o) => o.t3) && life === PG.relicLife && expired };
    });
  }
  // an AI values objectives (SPEC-v2 §7, §8): Greedy (20, past the grace) with a village of 12 (a landmark) 500 px off goes for it and takes it;
  // a relic it has never seen, 1500 px off, is never targeted; the knowledge assert stays clean
  function aiSpoilsTest() {
    return withSandbox(() => {
      const { W, r } = spoilsScene(31), x = W / 2, y = W / 2; r.alive = true; blob(300, 300, 3, 1); settle(S.teams[1]);
      blob(x - 500, y, 20, 2); settle(r); const v = SPL.stage("village", x, y, { gar: 12 }), far = SPL.stage("relic", x - 500, y + 1500, { axis: "horn" }); fogStampAll(); r.thinkT = 0;
      let st = {}, joined = -1, farT = 0;
      for (let i = 0; i < 60 * 20 && joined < 0; i++) { holdAt(S.teams[1], 300, 300); update(DT); st[r.state] = (st[r.state] || 0) + 1; if (!v.live && v.owner === 2) joined = +(S.t - S.cfg.ai.grace - 1).toFixed(2); if (Math.hypot(r.tx - far.x, r.ty - far.y) < 60) farT++; }
      return { states: st, joined, count: r.count, farTargeted: farT, ai: { ...S.fogS.ai }, pass: joined > 0 && r.count >= 32 && farT === 0 && S.fogS.ai.violations === 0 && S.fogS.ai.objectives > 0 };
    });
  }
  // Arms parity matrix (SPEC-v2 §8, R8): 40 and 60 Arms I-III peasants against 1.0x, their configured power (progression.armsPower) and the
  // gate x base peasants (PS.fight, 5 seeded runs per size and point, pooled: 10 per point). Gates: Arms I beats an even number (>= 70%);
  // Arms II does not beat 1.4x base, Arms III not 1.75x (< 50%: else cut the per-tier percent); at its configured power each tier is a
  // contested fight (10-90%). The single-point shares are noisy (fights sit on the rout rule's knife edge); the power table itself comes
  // from the 9-run scans in M6-build-notes.md.
  function parityTest() {
    const PG = S.cfg.progression, share = (k, ratio) => { let w = 0, r = 0; for (const n of [40, 60]) { const f = fight(n, Math.round(n * ratio), 30, 5, 8800 + k * 31 + n + Math.round(ratio * 100), { armsA: k }); w += f.playerWins; r += f.runs.length; } return +(w / r).toFixed(2); };
    const gates = [1.4, 1.4, 1.75], tiers = [1, 2, 3].map((k) => { const p = PG.armsPower[k]; return { tier: k, power: p, gate: gates[k - 1], atEven: share(k, 1), atPower: share(k, p), atGate: share(k, gates[k - 1]) }; });
    return { tiers, perTier: { hp: PG.armsHp, atk: PG.armsAtk }, power: PG.armsPower,
      pass: tiers[0].atEven >= 0.7 && tiers[1].atGate < 0.5 && tiers[2].atGate < 0.5 && tiers.every((t) => t.atPower >= 0.1 && t.atPower <= 0.9) };
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

  // PS.bench("capclash", { ticks, cap, simOnly }): 4 teams x (cap-200)/4 (cap: the device's own, 640 on touch since M7) in two clashes on screen + 200 neutrals in camps of 5, built through mkAgent,
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
    const oDI = ctx.drawImage, oFR = ctx.fillRect, cw = canvas.width, ch = canvas.height; let di = 0, layers = 0, ag = 0;
    const full = (x, y, w, h) => { const m = ctx.getTransform(); const ax = m.a * x + m.e, ay = m.d * y + m.f, bx = m.a * (x + w) + m.e, by = m.d * (y + h) + m.f; return Math.min(ax, bx) <= 1 && Math.min(ay, by) <= 1 && Math.max(ax, bx) >= cw - 1 && Math.max(ay, by) >= ch - 1; };
    ctx.drawImage = function (img, a, b, c, d) { di++; const w = arguments.length >= 5 ? (arguments.length >= 9 ? arguments[7] : c) : img.width, h = arguments.length >= 5 ? (arguments.length >= 9 ? arguments[8] : d) : img.height;
      const x = arguments.length >= 9 ? arguments[5] : a, y = arguments.length >= 9 ? arguments[6] : b; if (full(x, y, w, h)) layers++; return oDI.apply(this, arguments); };
    ctx.fillRect = function (x, y, w, h) { if (full(x, y, w, h) && (ctx.globalAlpha < 1 || typeof ctx.fillStyle !== "string" || ctx.fillStyle.length > 7)) layers++; return oFR.apply(this, arguments); };
    try { for (let i = 0; i < n; i++) { benchTick(); draw(); ag += agentsDrawn; } } finally { delete ctx.drawImage; delete ctx.fillRect; }
    return { drawImage: di / n, layers: layers / n, agentsDrawn: ag / n };
  }
  // opts.fog: "on" (default: the player's fog as in a match), "reveal" (the fog layer composed but every agent drawn), "off" (no fog layer)
  function bench(scene, opts) {
    // opts.flush (or window.__benchFlush): end every timed frame with a 1 px read of the main canvas, so each frame's draw time includes the
    // raster Chrome would do at that frame's end; without it a synchronous loop lets the canvas batch several frames into one flush and
    // draw p90 measures the batching (M3 notes). The reference build is benched with the same one-line change.
    opts = opts || {}; scene = scene || "capclash"; const fogMode = opts.fog || "on", flush = !!(opts.flush || window.__benchFlush), simOnly = !!opts.simOnly; // simOnly: update() alone (profiling the sim)
    const ticks = clamp(opts.ticks | 0 || 300, 30, 1200), warm = 20, cap = opts.cap || capFor(),  nNeutral = 200, per = Math.floor((cap - nNeutral) / 4);
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
        pin(); if (!simOnly) flushGround(benchMap);
        const up = [], dr = [], fg = []; let fl0 = null, st0 = 0, stN0 = 0, drawnSum = 0;
        for (let i = 0; i < warm + ticks; i++) {
          if (i === warm) { fl0 = PS.flow.stats; st0 = S.fogS.simTotal; stN0 = S.fogS.simTicks; }
          const a = performance.now(); benchTick(); const b = performance.now(); if (!simOnly) { draw(); if (flush) benchFlush(); } const e = performance.now();
          if (i >= warm) { up.push(b - a); dr.push(e - b); fg.push(fogLastMs); drawnSum += S.drawList.length; }
          if (e - w0 > 12000) break; // lesson 20
        }
        const fl1 = PS.flow.stats, flow = { rebuilds: fl1.rebuilds - fl0.rebuilds, ms: +(fl1.costMs - fl0.costMs).toFixed(2), msPerTick: +((fl1.costMs - fl0.costMs) / Math.max(1, up.length)).toFixed(3), maxMs: fl1.maxCostMs, decisions: fl1.decisions };
        const cnt = countFrame(10);
        let onScreen = 0; const z = S.cam.zoom, hw = S.vw / 2 / z, hh = S.vh / 2 / z; for (const a of S.agents) if (Math.abs(a.x - S.cam.x) < hw && Math.abs(a.y - S.cam.y) < hh) onScreen++;
        const mean = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3);
        const fog = { mode: fogMode, p50: pct(fg, 0.5), p90: pct(fg, 0.9), p99: pct(fg, 0.99), mean: fg.length ? +(fg.reduce((x, y) => x + y, 0) / fg.length).toFixed(3) : 0, ...trimMean(fg, opts.stallMs), stampMsPerTick: +((S.fogS.simTotal - st0) / Math.max(1, S.fogS.simTicks - stN0)).toFixed(4), holes: PS.fog.RS.holes, drawnPerFrame: Math.round(drawnSum / Math.max(1, fg.length)) };
        return { scene, build: "v2", fog, flush, ticks: up.length, agents: S.agents.length, onScreen, counts: S.teams.slice(1).map((t) => t.count), camps: L.camps.length + "/" + L.want, viewport: [S.vw, S.vh, S.dpr], zoom,
          spot: [Math.round(cx), Math.round(cy), c.blockedInClash, +c.open.toFixed(2)], terrainBad: S.dbg.terrainBad,
          update: { p50: pct(up, 0.5), p90: pct(up, 0.9), p99: pct(up, 0.99), mean: mean(up) }, draw: { p50: pct(dr, 0.5), p90: pct(dr, 0.9), p99: pct(dr, 0.99), mean: mean(dr) },
          drawImage: cnt.drawImage, layers: cnt.layers, agentsDrawn: cnt.agentsDrawn, drawPerAgentOk: cnt.drawImage <= cfg.art.drawPerAgent * cnt.agentsDrawn + cfg.art.drawOverhead, // M5: one draw per agent
          canvas: canvasMemory(), flow, wallMs: Math.round(performance.now() - w0), shot: opts.shot ? canvas.toDataURL() : undefined };
      });
    } finally { cfg.combat.engageDelay = delay0; benchTick = () => {}; if (benchMap) releaseGround(benchMap); } // the bench map's chunks are zeroed, not kept (memory)
  }
  // the per-frame flush: one main-canvas pixel drawn into a willReadFrequently scratch and read there (the same forced raster, no readback
  // warning on the main canvas; M5 critic MINOR-6)
  let flushCv = null, flushCtx = null;
  function benchFlush() { if (!flushCv) { flushCv = mkCanvas(1, 1); flushCtx = flushCv.getContext("2d", { willReadFrequently: true }); } flushCtx.drawImage(canvas, 0, 0, 1, 1, 0, 0, 1, 1); return flushCtx.getImageData(0, 0, 1, 1).data[3]; }
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
    "combat.remnant.escapeSeconds:n combat.remnant.escapeSpeed:n combat.remnant.regroupSeconds:n combat.remnant.scatterDist.0:n combat.remnant.scatterDist.1:n finale.crownAbsorbs:b finale.fullFlip:b " +
    "combat.localMode:s combat.remnant.escapeReplan:n combat.remnant.escapeDistance:n input.hintAfterRouteMs:n fixtures.holdN:n fixtures.holdPace:n fixtures.holdColumn:n fixtures.holdStart:n fixtures.holdTarget:n fixtures.holdAt:n fixtures.holdSeconds:n " +
    "fixtures.remnantWin:n fixtures.remnantLose:n fixtures.remnantSeconds:n " +
    "camera.span0:n camera.spanK:n camera.zoomMin:n camera.zoomMinTouch:n camera.zoomMax:n camera.steps:o camera.steps.dpr1:a camera.steps.dpr2:a camera.hysteresis:n camera.ease:n " +
    "camera.lookAhead:n camera.lookAheadCap:n camera.lookAheadMinSpeed:n camera.clashOffsetCap:n touch.joyEdge:n input.desktopMode:s input.tapMs:n input.tapPx:n input.keyLead:n input.mouseWakePx:n " +
    "input.routeBreakPx:n input.pickPx:n ai.roamSpeed:n terrain.probeFrames:n " +
    "fixtures.passLen:n fixtures.passN:n fixtures.startGap:n fixtures.targetGap:n fixtures.regroupAfter:n fixtures.regroupK:n fixtures.maxSeconds:n fixtures.ambushColumn:n " +
    "fixtures.ambushWait:n fixtures.ambushSpecWait:n fixtures.ambushLanes:n fixtures.ambushSpacing:n fixtures.ambushDist:n fixtures.ambushSeconds:n fixtures.flipflopN:n fixtures.flipflopRidge.0:n fixtures.flipflopRidge.1:n fixtures.flipflopOffset:n " +
    "fixtures.flipflopAmp:n fixtures.flipflopPeriod:n fixtures.flipflopSeconds:n fixtures.cliffN:n fixtures.cliffDepth:n fixtures.cliffPress:n fixtures.cliffMeasure:n " +
    "flow.stragglerBand:n flow.stragglerDetour:n flow.stragglerRejoin:n flow.rejoinTicks:n flow.blockHold:n fixtures.stragglerMain:n fixtures.stragglerN:n fixtures.stragglerRidge:n fixtures.stragglerPass:n fixtures.stragglerRise:n fixtures.stragglerMainGap:n fixtures.stragglerGap:n fixtures.stragglerNear:n " +
    "fixtures.stragglerSeconds:n fixtures.stragglerRockSeconds:n fixtures.comboSeeds:n fixtures.ambushRate:n fixtures.holdRate:n fixtures.hiddenGap:n fixtures.audioSoakN:n fixtures.audioSoakRival:n fixtures.audioSoakSeconds:n fixtures.audioDrain:n audio.nodeCap:n audio.master:n audio.ceiling:n audio.lanePeak:n audio.cueGain:n audio.limiter.threshold:n audio.limiter.knee:n audio.limiter.ratio:n audio.limiter.attack:n " +
    "audio.limiter.release:n audio.cueVoices:n audio.reapPad:n audio.minDuck:n audio.hit.perSec:n audio.hit.energy:n audio.hit.minLevel:n audio.hit.jitter:n audio.hit.tonePeak:n audio.hit.toneDur:n " +
    "audio.hit.clickPeak:n audio.hit.clickHz.0:n audio.hit.clickHz.1:n audio.hit.clickDur:n audio.hit.clickLp:n audio.die.perSec:n audio.die.energy:n audio.die.minLevel:n audio.die.jitter:n audio.die.tonePeak:n " +
    "audio.die.toneDur:n audio.die.tailDb:n audio.die.tailDur:n audio.die.tailHz:n audio.melee.max:n audio.melee.full:n audio.melee.k0:n audio.melee.hz:n audio.melee.q:n audio.melee.tau:n audio.melee.every:n " +
    "audio.recruit.gapMs:n audio.recruit.peak:n audio.drum.step:n audio.drum.ahead:n audio.drum.kickPeak:n audio.drum.kickDur:n audio.drum.kickFloor:n audio.drum.tickPeak.0:n audio.drum.tickPeak.1:n audio.drum.tickHz.0:n " +
    "audio.drum.tickHz.1:n audio.drum.tickDur.0:n audio.drum.tickDur.1:n audio.drum.tickLp:n audio.murmur.hz:a audio.murmur.detune:n audio.murmur.drift:n audio.murmur.lp:n audio.murmur.max:n audio.murmur.full:n " +
    "audio.murmur.k0:n audio.murmur.tau:n audio.murmur.am.0:n audio.murmur.am.1:n audio.murmur.amSec.0:n audio.murmur.amSec.1:n audio.qa.sceneN:n audio.qa.sceneSeconds:n audio.qa.sampleRate:n " +
    "audio.qa.flatHz.0:n audio.qa.flatHz.1:n audio.qa.highHz:n audio.qa.flatMax:n audio.qa.highMax:n audio.qa.noiseMax:n audio.limiter:o audio.hit:o audio.die:o audio.melee:o audio.recruit:o audio.drum:o audio.murmur:o audio.qa:o " +
    "powerups.count:n powerups.respawn:n powerups.pickupRadius:n powerups.minDistFromStart:n powerups.duration:o powerups.speedMult:n powerups.armorMult:n powerups.contestTol:n " +
    "powerups.frenzyMult:n powerups.rallyRadius:n powerups.weights:o powerups.duration.speed:n powerups.duration.armor:n powerups.duration.frenzy:n powerups.duration.rally:n " +
    "ai.think:n ai.sight:n ai.leadTime:n ai.leadSmooth:n ai.fleeDistance:n ai.personalities:a ai.finalFleeRatio:n ai.huntSpeed:n ai.fleeSpeed:n ai.corneredDist:n ai.grace:n " +
    "ai.aiVsAiHuntMult:n ai.objectiveSight:n ai.powerScore:n ai.neutralScore:n ai.huntTimeout:n ai.huntCooldown:n ai.proxy:o ai.campKnowStart:n ai.campAvoidRadius:n ai.campAvoidRatio:n " +
    "ai.relaxSeconds:n ai.pileOnRatio:n ai.pileOnBannerCooldown:n ai.graceAvoid:n ai.ghostKeep:n ai.heardSeconds:n ai.scentJitter:n " +
    "finale.crownEvery:n finale.crownEveryLate:n finale.crownLate:n finale.torches:n finale.underdogRatio:n finale.closeTo:n finale.pairRadius:n combat.truceSeconds:n " +
    "player.name:s player.color:s neutral.color:s camera.lerp:n camera.zoomDesktop:n camera.zoomMobile:n camera.mobileBreak:n pace:a difficulty.normal:o " +
    "touch.joyRadius:n touch.joyDead:n touch.joyLead:n fog.sight0:n fog.sightK:n fog.bucketSight:n " +
    "fog.bucket:n fog.playerStampTicks:n fog.displayCell:n fog.displayPad:n fog.exploreMargin:n fog.unexploredAlpha:n fog.exploredAlpha:n fog.unexploredColor:s fog.exploredColor:s " +
    "fog.softBand:n fog.phoneBand:n fog.holeVignette:n fog.holeVigStart:n fog.maskHz:n fog.canvasScale:n fog.maxPixels:n fog.fadeSeconds:n fog.obsSmooth:n fog.cloudTile:n fog.cloudSpeed:n fog.cloudAlpha:n fog.vignetteAlpha:n " +
    "fog.vignetteInner:n fog.vignetteOuter:n fog.glowAlpha:n fog.glowPulse:n fog.glowRate:n fog.glowInner:n fog.glowOuter:n fog.smoke:n fog.beacon:n fog.clashNoise:n fog.pingSeconds:n fog.labelDist:n fog.labelDim:n " +
    "fog.pingMerge:n fog.dust:n fog.dustMin:n fog.dustOffset:n fog.dustEvery:n fog.ghostSeconds:n fog.miniGhostSeconds:n fog.danger:n fog.dangerEvery:n fog.dangerJitter:n fog.dangerShow:n " +
    "fog.crows:n fog.edgeMax:n fog.verdictSeconds:n fog.verdictStronger:n fog.verdictWeaker:n fog.dawnSeconds:n fog.minimapHz:n fog.aiMemory:n fog.aiFleeMemory:n fog.aiLeadMax:n " +
    "fog.exploreRing.0:n fog.exploreRing.1:n fog.exploreSamples:n fog.exploreCommit:n " +
    "terrain.cell:n terrain.blockedFraction:n terrain.noisePeriod:n terrain.caPasses:n terrain.disc:n terrain.spawnRing:n terrain.centerRadius:n terrain.homeRadius:n " +
    "terrain.homeWall:n terrain.exitWidth:n terrain.hubWall:n terrain.ridgeWidth:n terrain.ridgeWobble:n terrain.ridgeSpine:n terrain.rimRamp:n terrain.corridorHalf:n " +
    "terrain.riverWidth:a terrain.riverWobble:n terrain.riverPeriod:n terrain.crossings:a terrain.crossingMaxGap:n terrain.bridgeWidth:n terrain.fordWidth:a terrain.fordSpeed:n " +
    "terrain.passWidth:a terrain.pocketFill:n terrain.maxRerolls:n terrain.fairness:o terrain.fairness.rivalRatio:n terrain.fairness.centreRatio:n terrain.fairness.detour:a " +
    "terrain.fairness.minExits:n terrain.costs:o terrain.costs.base:n terrain.costs.wall1:n terrain.costs.wall2:n terrain.costs.ford:n terrain.costs.prop:n " +
    "terrain.fallbackSeeds:a terrain.chunk:n terrain.chunkArt:n terrain.waterFrameMs:n " +
    "art.flashWhite:n art.bannerPole:a art.bannerFlagW:a art.bannerFlagH:a art.bannerEmblem:a art.bannerTiers:a art.bannerMin:n art.bannerFrameMs:n art.bannerLift:n art.highCells:n art.cornerR:n art.shadow:a art.shallow:n art.deep:n art.foam:n art.sparkle:n art.bridgeShadow:n art.deckOverhang:n art.stoneStep:n art.stoneR:n art.fordEdge:n art.biomePeriod:n art.tonePeriod:n art.rockyBelow:n art.highAbove:n art.decalCluster:n art.decalSpread:n art.pineShare:n art.drawOverhead:n art.drawPerAgent:n art.canvasBudgetMB:n art.hatShareMin:n art.terrainSatMax:n art.flashMin:n art.ditherBand:n " +
    // M6 spoils (src/spoils.js reads them through S.cfg)
    "progression.armsHp:n progression.armsAtk:n progression.armsCap:n progression.armsMax:n progression.armsPower:a progression.bootsSpeed:n progression.bootsFord:n progression.bootsMax:n " +
    "progression.hornRadius:a progression.hornMax:n progression.muster:a progression.musterAxes:a progression.chestAxes:o progression.chestAxes.arms:n progression.chestAxes.boots:n progression.chestAxes.horn:n " +
    "progression.pickupRadius:n progression.relicLife:n progression.dropScatter:n progression.dropMinShare:n progression.trickleChestEvery:n progression.trickleChestAfter:n progression.trickleChestMax:n progression.trickleChestBias:n " +
    "encampments.villages:a encampments.villageRing:n encampments.villageStep:n encampments.villageMin:n encampments.villageDist.0:n encampments.villageDist.1:n encampments.chestDist.0:n encampments.chestDist.1:n " +
    "encampments.heavy:a encampments.heavyPick2:n encampments.heavyRing:n encampments.heavyHold:n encampments.heavyDist.0:n encampments.heavyDist.1:n encampments.banditSizes:a encampments.banditCounts:a " +
    "encampments.banditMinPath:n encampments.banditLeash:n encampments.banditAggro:n encampments.banditHp:n encampments.banditDamage:n encampments.banditSpeed:n encampments.banditGap:n " +
    "encampments.objectGap:n encampments.campGap:n encampments.cheer:n encampments.scanTicks:n ai.objRelic:n ai.objVillage:n ai.objHeavy:n ai.objBandit:n ai.banditFeasible:n " +
    "banner.minSeconds:n banner.queuedSeconds:n banner.staleSeconds:n banner.dropDepth:n combat.verdictRatio:n polish.dprTiers.0:n polish.dprTiers.1:n polish.dprTiers.2:n polish.dprP90Ms:n polish.dprHoldSeconds:n polish.dprWindow:n polish.ghostSeconds:n polish.flySeconds:n polish.surrenderSeconds:n polish.routWaveSeconds:n polish.hpBarMax:n polish.dustEvery:n polish.dustSpan:n polish.dustN:n polish.irisSeconds:n polish.confetti:n polish.bannerFall:n polish.posterSeed:n polish.posterMint:n polish.posterOrange:n polish.posterStep:n").split(" ");
  const cfgGet = (path) => { let o = S.cfg; for (const k of path.split(".")) { if (o == null) return undefined; o = o[k]; } return o; };
  const typeOk = (v, t) => (t === "n" ? typeof v === "number" && isFinite(v) : t === "s" ? typeof v === "string" && v.length > 0 : t === "a" ? Array.isArray(v) && v.length > 0 : t === "b" ? typeof v === "boolean" : !!v && typeof v === "object");
  // PS.cfgOverride(patch) (SPEC-v2 §13, M8 sweeps): deep-merges patch into the live config in place, so every module holding a section sees
  // it; arrays and leaves are replaced, an object patch on an array patches by index ({ ai: { personalities: { 0: { huntRatio: 1.4 } } } }).
  // An unknown key throws (a typo must not read as "no effect"). PS.cfgOverride(null) restores the loaded config. Takes effect at once; start
  // a new match (PS.debugStart) for a clean read. Returns the paths it changed.
  let cfgBase = null;
  function cfgOverride(patch) {
    if (!cfgBase) cfgBase = JSON.parse(JSON.stringify(S.cfg));
    const out = [], put = (dst, src, pre) => { for (const k of Object.keys(src)) {
      if (!(k in dst)) throw new Error("PS.cfgOverride: unknown key " + pre + k);
      const v = src[k]; if (v && typeof v === "object" && !Array.isArray(v) && dst[k] && typeof dst[k] === "object") put(dst[k], v, pre + k + "."); else { dst[k] = Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v; out.push(pre + k); } } };
    put(S.cfg, patch == null ? JSON.parse(JSON.stringify(cfgBase)) : patch, "");
    if (patch == null || patch.terrain) PS.terrain.init(S.cfg); // terrain.js copies its section at init: the next generated map uses the patch
    return patch == null ? ["(restored)"] : out;
  }
  function configReport() {
    const cfg = S.cfg, missing = [], used = {};
    for (const e of CFG_KEYS) { const [path, t] = e.split(":"); used[path.replace(/\.\d+$/, "")] = 1; used[path] = 1; if (!typeOk(cfgGet(path), t)) missing.push(path); }
    // the five rivals (SPEC-v2 §7): the shared fields, and each kind's specials
    const SPECIAL = { greedy: [], bully: ["scentSearch:n", "trackRatio:n"], wary: ["clashLeave:n", "leaveSeconds:n", "edgeBias:n"], sly: ["clashGo:n", "foughtSeconds:n", "foughtHuntRatio:n", "lurkSeconds:n", "lurkCooldown:n", "lurkPassMax:n"],
      stubborn: ["homeFleeRatio:n", "holdRadius:n", "clusterRadius:n", "reclaimEmpty:n"], proxy: [] };
    (cfg.ai && cfg.ai.personalities || []).concat(cfg.ai && cfg.ai.proxy ? [cfg.ai.proxy] : []).forEach((p, i) => { for (const k of ["name:s", "kind:s", "color:s", "huntRatio:n", "fleeRatio:n", "neutralBias:n", "powerBias:n", "hatesPlayer:n"].concat(SPECIAL[p.kind] || ["kind (greedy | bully | wary | sly | stubborn)"])) { const [f, t] = k.split(":"); if (!typeOk(p[f], t)) missing.push("ai.personalities." + i + "." + f); } });
    if (!cfg.ai || !cfg.ai.personalities || cfg.ai.personalities.length !== 5) missing.push("ai.personalities (five rivals, SPEC-v2 §7)");
    for (const d in cfg.difficulty || {}) for (const k of ["label:s", "aiSpeed:n", "think:n", "huntMult:n", "startBonus:n", "sight:n", "memory:n", "hearing:n", "scentEvery:n"]) { const [f, t] = k.split(":"); if (!typeOk(cfg.difficulty[d][f], t)) missing.push("difficulty." + d + "." + f); }
    (cfg.pace || []).forEach((v, i) => { if (!typeOk(v, "n")) missing.push("pace." + i); });
    if (cfg.input && ["route", "steer"].indexOf(cfg.input.desktopMode) < 0) missing.push("input.desktopMode (route | steer)");
    if (cfg.combat && ["fighting", "radius"].indexOf(cfg.combat.localMode) < 0) missing.push("combat.localMode (fighting | radius)");
    { const PG = cfg.progression || {}, EN = cfg.encampments || {}, ax = ["arms", "boots", "horn"]; // M6 shapes the rules rely on
      if (!(PG.muster && PG.musterAxes && PG.muster.length === PG.musterAxes.length && PG.musterAxes.every((a) => ax.indexOf(a) >= 0))) missing.push("progression.muster / musterAxes (same length, axes arms | boots | horn)");
      if (!(PG.armsPower && PG.armsPower.length === PG.armsMax + 1)) missing.push("progression.armsPower (one per Arms tier 0..armsMax)");
      if (!(PG.hornRadius && PG.hornRadius.length === PG.hornMax + 1)) missing.push("progression.hornRadius (one per Horn tier 0..hornMax)");
      if (!(EN.banditSizes && EN.banditCounts && EN.banditSizes.length === 3 && EN.banditCounts.length === 3)) missing.push("encampments.banditSizes / banditCounts (green, orange, red)"); }
    for (const k in (cfg.powerups && cfg.powerups.weights) || {}) { if (!S.spr.PU[k] || !typeOk(cfg.powerups.duration[k], "n")) missing.push("powerups.weights." + k + " (needs a PU icon + duration)"); }
    // tunables in config.json that no code reads (informational: a retune there does nothing)
    const unused = [];
    for (const sec of ["world", "spawn", "agent", "flock", "flow", "combat", "powerups", "ai", "camera", "touch", "fog", "terrain", "input", "finale", "fixtures", "art", "progression", "encampments", "banner", "polish", "audio"]) for (const k in cfg[sec] || {}) {
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
    if (!spr._neutral) spr._neutral = spr.peasantSet(S.cfg.neutral.color, "straw"); // the neutral atlas (cached per colour and style, as draw() does)
    const blank = []; let unreadable = 0;
    for (const [k, c] of list) { const n = opaqueCount(c); if (n === 0) blank.push(k); else if (n < 0) unreadable++; }
    return { total: list.length, blank, unreadable };
  }

  function stateSig() {
    let h = 0; for (const a of S.agents) h += a.x * 1.3 + a.y * 0.7 + a.vx * 0.11 + a.vy * 0.13 + a.hp * 3 + a.team * 11 + (a.tgt ? 5 : 0) + a.atk * 0.17 + a.ph * 0.01;
    const tm = S.teams.slice(1).map((t) => [t.count, t.alive, t.tx, t.ty, t.cx, t.cy, t.vx, t.vy, t.thinkT, t.kills, t.state, t.slot, t.mode, t.route, t.tMed, t.regroupUntil, t.engL.join(","), t.tierN, t.mustered]);
    return JSON.stringify([S.mode, S.t, S.tick, S.timeLeft, S.seed, S.map ? S.map.used : null, S.agents.length, h, tm, S.cam, S.stats, S.banners.length, S.result, S.pendingEnd, S.difficulty, S.attract,
      S.camps.length, S.powerups.map((p) => [p.x, p.y, p.alive, p.kind]), S.trickleT, S.shake, S.engagedNow, S.input.huddle, S.input.joy.active, S.hintT, S.ev, S.thinkRR, PS.flow.stats && PS.flow.stats.rebuilds,
      PS.fog.sig(), S.fogS ? [S.fogS.stats.sightings, S.fogS.stats.ghosts, S.fogS.ai.decisions, S.fogS.ai.violations] : null, (S.objs || []).map((o) => [o.type, o.live, o.x, o.y, o.prog, o.hold, o.n, o.owner])]);
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
  // ---------------------------------------------------------------- M5 art QA (SPEC-v2 §11, M5 brief 7). Every read goes through a scratch
  // canvas (lesson 27), never a cache. hslS: HSL saturation of one pixel.
  const hslS = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const l = (mx + mn) / 510; return d / 255 / (1 - Math.abs(2 * l - 1)); };
  let artScratch = null;
  function artCanvas(w, h) { if (!artScratch) artScratch = mkCanvas(w, h); if (artScratch.width !== w || artScratch.height !== h) { artScratch.width = w; artScratch.height = h; } const g = artScratch.getContext("2d", { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.imageSmoothingEnabled = false; g.clearRect(0, 0, w, h); return g; }
  // terrain saturation: the chunks around your spawn and every chunk holding a crossing, frame A, every pixel (a crop of the real ground)
  function terrainSaturation() {
    const m = S.map, G = ground(m), CH = S.cfg.terrain.chunk, n = G.n, pick = new Set(), s0 = m.spawns[S.teams[1].slot] || { x: m.W / 2, y: m.W / 2 };
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = clamp(Math.floor(s0.x / CH) + di, 0, n - 1), j = clamp(Math.floor(s0.y / CH) + dj, 0, n - 1); pick.add(j * n + i); }
    for (let c = 0; c < m.N * m.N; c++) if (m.terr[c] >= 3) { const x = ((c % m.N) + 0.5) * m.cell, y = (((c / m.N) | 0) + 0.5) * m.cell; pick.add(Math.floor(y / CH) * n + Math.floor(x / CH)); }
    let sum = 0, cnt = 0, over = 0, max = 0; const hist = new Uint32Array(21);
    for (const ci of pick) {
      if (G.dirty[ci] || !G.cvA[ci]) bakeChunk(m, G, ci); const cv = G.cvA[ci], g = artCanvas(cv.width, cv.height); g.drawImage(cv, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      for (let q = 0; q < d.length; q += 4) { const v = hslS(d[q], d[q + 1], d[q + 2]); sum += v; cnt++; if (v > S.cfg.art.terrainSatMax) over++; if (v > max) max = v; hist[Math.min(20, (v * 20) | 0)]++; }
    }
    const teams = PS.PAL.teams.map((c) => +PS.PAL.sat(c).toFixed(3));
    return { chunks: pick.size, pixels: cnt, mean: +(sum / cnt).toFixed(3), max: +max.toFixed(3), overShare: +(over / cnt).toFixed(4), p90: (() => { let k = 0, t = cnt * 0.9; for (let b = 0; b <= 20; b++) { k += hist[b]; if (k >= t) return +(b / 20 + 0.05).toFixed(2); } return 1; })(), teamSat: teams };
  }
  // hat share: 60 peasants of one team in a sunflower crowd (the blob spacing the fixtures use), drawn as draw() draws them (one atlas frame
  // at 2x, feet on the art grid, y-sorted, mixed poses and facings) over meadow grass; hat pixels (the team's hat ramp, exact) over (a) the
  // crowd's own pixels and (b) a square crop inside the crowd, ground included (what a screenshot crop sees). Gated on (b).
  function hatShare(team, n) {
    const t = S.teams[team], set = t ? t.spr : S.spr.peasantSet(PS.PAL.teams[team - 1], team), W0 = 240, H0 = 240, cx = 120, cy = 132, pts = [];
    for (let i = 0; i < n; i++) { const a = i * 2.39996, d = 7 * Math.sqrt(i + 0.5), h = (Math.imul(i + 1, 2654435761) >>> 0); pts.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, f: (h & 1 ? 0 : 1) + (h & 2 ? 4 : 0) + ((h >>> 5) % 5 === 0 ? 3 : 0) }); }
    pts.sort((p, q) => p.y - q.y);
    const hat = set.hat.map((c) => PS.PAL.rgb(c)), isHat = (d, q) => { for (const h of hat) if (d[q] === h[0] && d[q + 1] === h[1] && d[q + 2] === h[2]) return true; return false; };
    const paint = (bg) => { const g = artCanvas(W0, H0); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W0, H0); } for (const p of pts) { const f = p.f % 8, ax = f & 4 ? set.axL : set.axR; g.drawImage(set.atlas, set.sx[f], set.sy[f], set.fw, set.fh, snap2(p.x) - ax * 2, snap2(p.y) + 2 - set.ay * 2, set.fw * 2, set.fh * 2); } return g.getImageData(0, 0, W0, H0).data; };
    let d = paint(null), crowd = 0, hatN = 0, x0 = W0, y0 = H0, x1 = 0, y1 = 0;
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) { const q = (y * W0 + x) * 4; if (d[q + 3] < 200) continue; crowd++; if (isHat(d, q)) hatN++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    d = paint(PS.PAL.grass[2]); const side = Math.round(Math.min(x1 - x0, y1 - y0) * 0.6), sx = Math.round((x0 + x1 - side) / 2), sy = Math.round((y0 + y1 - side) / 2); let cropHat = 0;
    for (let y = sy; y < sy + side; y++) for (let x = sx; x < sx + side; x++) if (isHat(d, (y * W0 + x) * 4)) cropHat++;
    return { team: t ? t.name : team, style: set.style, crowdShare: +(hatN / crowd).toFixed(3), cropShare: +(cropHat / (side * side)).toFixed(3), crop: side + "x" + side, bbox: [x1 - x0, y1 - y0] };
  }

  // ---------------------------------------------------------------- QA: audio (P1, Peter's first playtest: "a lot of static ... grew over time")
  // A clash-heavy match with sound on, through PS.audio.qa (an OfflineAudioContext bus on sim time: nodes are made and wired for real,
  // nothing renders). Your fixtures.audioSoakN peasants clash with a fixtures.audioSoakRival blob spawned beside you (the five rivals in
  // turn) whenever you have been out of a fight for 1 s, for fixtures.audioSoakSeconds; the camera follows you, so every hit, death, rout
  // and scatter is heard, and the murmur follows your count as updateHUD drives it. Then the clock runs fixtures.audioDrain s on with nothing
  // new. Reports the live node count (max during, and after), the level bound, calls against plays per lane (the gates under a 600+ agent
  // melee) and the cue pool's closes and reaps.
  function audioSoak(o) {
    o = o || {}; const FX = S.cfg.fixtures, AU = S.cfg.audio, secs = o.seconds || FX.audioSoakSeconds, wallMs = clamp(+o.wallMs || 11000, 500, 13000);
    return withSandbox(() => {
      let clock = 0; if (!PS.audio.qa(true, () => clock)) return { error: "no OfflineAudioContext" };
      try {
        const w0 = performance.now(), W = S.cfg.world.w; fixtureBase(flatMap || (flatMap = PS.terrain.flat()), o.seed || 77);
        const p = S.teams[1]; blob(W / 2, W / 2, FX.audioSoakN, 1); settle(p); S.cam.x = p.cx; S.cam.y = p.cy;
        let foe = null, next = 2, calm = 1, peakAgents = 0, clashes = 0, truncated = false; const trace = [];
        S.fixture = { name: "audio", drive(dt) {
          calm = S.engagedNow ? 0 : calm + dt;
          if (p.count < FX.audioSoakN / 3) { blob(p.cx + 60, p.cy, FX.audioSoakN, 1); settle(p); }
          if (calm >= 1 && (!foe || !foe.alive || foe.count === 0)) {
            foe = S.teams[next]; next = next >= 6 ? 2 : next + 1; foe.alive = true; foe.thinkT = 1e9; const a = S.rng() * Math.PI * 2, d = blobR(p.count) + blobR(FX.audioSoakRival) + 40;
            blob(clamp(p.cx + Math.cos(a) * d, 200, W - 200), clamp(p.cy + Math.sin(a) * d, 200, W - 200), FX.audioSoakRival, foe.id); settle(foe); clashes++; calm = 0;
          }
          if (foe && foe.count > 0) { p.tx = foe.cx; p.ty = foe.cy; foe.tx = p.cx; foe.ty = p.cy; foe.route = true; } else { p.tx = p.cx; p.ty = p.cy; }
          p.route = true; p.mode = "route";
        }, done: () => false, result: () => null };
        S.mode = "sandbox"; const n = Math.round(secs * 60);
        for (let i = 0; i < n; i++) {
          clock = S.t; update(DT); if (i % 6 === 0) PS.audio.murmur(p.count); if (S.agents.length > peakAgents) peakAgents = S.agents.length;
          if (i % 600 === 0) { const st = PS.audio.state(); trace.push([+S.t.toFixed(0), S.agents.length, st.nodes.live, st.cues.live, st.level.now]); }
          if ((i & 63) === 63 && performance.now() - w0 > wallMs) { truncated = true; break; }
        }
        const during = PS.audio.state(); clock = S.t + FX.audioDrain; PS.audio.stopDrum(); PS.audio.murmur(0); PS.audio.melee(0); PS.audio.pump(); const after = PS.audio.state();
        return { seconds: +S.t.toFixed(1), truncated, clashes, fights: S.ev.fights, routs: S.ev.routs, peakAgents, nodesMax: during.nodes.max, nodesFixed: during.nodes.fixed, nodesAfter: after.nodes.live, cuesAfter: after.cues.live,
          cues: after.cues, level: during.level, calls: during.calls, plays: during.plays, trace, wallMs: Math.round(performance.now() - w0),
          lanes: +(AU.lanePeak * AU.master).toFixed(3) };
      } finally { PS.audio.qa(false); }
    });
  }
  // P2: the audio scene, two clashes on screen on the flat fixture map for o.seconds with about o.n agents in all (the deaths bring the
  // 1.1 n it spawns back to about n): yours (0.46 n) against a rival (0.24 n) above or below you, and two rivals (0.22 n, 0.18 n) fighting
  // 0.62 of a half screen to your right (on a portrait screen the axes swap). Staged, not played: a pair out of a fight
  // for 0.5 s is replaced (its remnants retired silently, a fresh rival on the other side of you from teams 2, 5, 6 in turn, a fresh second
  // pair beside you), and you are trimmed or topped up to 0.46 n before each new rival, so the scene holds still at n agents. The camera follows
  // you as in play, so the calls (hits, deaths, routs, the melee bed, the drum) are the ones a player hears; the murmur follows your count
  // every 6 ticks, as updateHUD drives it. Every PS.audio call is logged on sim time. Returns { log, trace: per second [t, agents, yours,
  // clashes, clashes on screen, fighting agents on screen, zoom] }; sandboxed and silent: the log is what PS.audio.renderOffline plays.
  function audioScene(o) {
    o = o || {}; const n = clamp(o.n | 0 || 700, 20, 900), secs = clamp(+o.seconds || 45, 1, 60), wallMs = clamp(+o.wallMs || 12000, 500, 13000);
    return withSandbox(() => {
      const w0 = performance.now(), W = S.cfg.world.w; fixtureBase(flatMap || (flatMap = PS.terrain.flat()), o.seed || 91); S.mode = "sandbox";
      const p = S.teams[1], [nP, nA, nB, nC] = [0.46, 0.24, 0.22, 0.18].map((k) => Math.max(4, Math.round(k * n))), B = S.teams[3], Cc = S.teams[4];
      blob(W / 2, W / 2, nP, 1); settle(p); S.cam.x = p.cx; S.cam.y = p.cy; zoomRule(p.count, 0, true);
      let foe = null, fi = 0, side = 1, calm1 = 9, calm2 = 9, truncated = false; const trace = [], wide = S.vw >= S.vh; // the lower pair sits along the screen's long axis
      const retire = (t, keep) => { let k = t.count - (keep || 0); for (let i = S.agents.length - 1; i >= 0 && k > 0; i--) { const a = S.agents[i]; if (a.team === t.id && !a.dead) { a.dead = true; k--; } } if (!keep) t.alive = false; recount(); };
      const drop = (t, x, y, k) => { t.alive = true; t.thinkT = 1e9; blob(clamp(x, 200, W - 200), clamp(y, 200, W - 200), k, t.id); settle(t); };
      S.fixture = { name: "audioScene", drive(dt) {
        calm1 = S.engagedNow ? 0 : calm1 + dt; calm2 = B.engT[4] > 0 ? 0 : calm2 + dt;
        if (calm1 >= 0.5) { calm1 = 0; if (foe) retire(foe); if (p.count > nP) retire(p, nP); else if (p.count < nP) { blob(p.cx, p.cy, nP - p.count, 1); settle(p); } foe = S.teams[[2, 5, 6][fi++ % 3]]; side = -side; const d = side * (blobR(p.count) + blobR(nA) + 40); drop(foe, p.cx + (wide ? 0 : d), p.cy + (wide ? d : 0), nA); }
        if (calm2 >= 0.5) { calm2 = 0; retire(B); retire(Cc); const h = 0.62 * (wide ? S.vw : S.vh) / 2 / S.cam.zoom, x = p.cx + (wide ? h : 0), y = p.cy + (wide ? 0 : h), gb = blobR(nB) + 15, gc = blobR(nC) + 15;
          drop(B, x - (wide ? gb : 0), y - (wide ? 0 : gb), nB); drop(Cc, x + (wide ? gc : 0), y + (wide ? 0 : gc), nC); }
        if (foe.count > 0) { p.tx = foe.cx; p.ty = foe.cy; foe.tx = p.cx; foe.ty = p.cy; foe.route = true; } else { p.tx = p.cx; p.ty = p.cy; }
        if (B.count > 0 && Cc.count > 0) { B.tx = Cc.cx; B.ty = Cc.cy; Cc.tx = B.cx; Cc.ty = B.cy; B.route = Cc.route = true; }
        p.route = true; p.mode = "route";
      }, done: () => false, result: () => null };
      PS.audio.log(true, () => S.t, o.cap);
      try {
        const nT = Math.round(secs * 60);
        for (let i = 0; i < nT; i++) {
          update(DT); if (i % 6 === 0) PS.audio.murmur(p.count);
          if (i % 60 === 59) { let pr = 0, on = 0; for (let a = 1; a < S.teams.length; a++) for (let c = a + 1; c < S.teams.length; c++) if (S.teams[a].engT[c] > 0 && S.teams[a].eng[c] > 0) { pr++; if (onScreen(S.teams[a].engCx[c], S.teams[a].engCy[c])) on++; }
            trace.push([Math.round(S.t), S.agents.length, p.count, pr, on, S.meleeN, +S.cam.zoom.toFixed(2)]); }
          if ((i & 63) === 63 && performance.now() - w0 > wallMs) { truncated = true; break; }
        }
        PS.audio.stopDrum(); PS.audio.murmur(0); PS.audio.melee(0);
        return { n, seconds: +S.t.toFixed(2), truncated, log: PS.audio.log(), trace, fights: S.ev.fights, routs: S.ev.routs, wallMs: Math.round(performance.now() - w0) };
      } finally { PS.audio.log(false); }
    });
  }
  // P2: the audio render check. A qa.sceneSeconds, qa.sceneN-agent two-clash scene (audioScene) rendered offline at qa.sampleRate twice,
  // as heard and with every noise source silent (its tonal part), each analysed per second (PS.audio.analyse). Resolves to both analyses.
  function audioMix(o) {
    o = o || {}; const Q = S.cfg.audio.qa, secs = o.seconds || Q.sceneSeconds, w0 = performance.now(), sc = audioScene({ n: o.n || Q.sceneN, seconds: secs, seed: o.seed || 91, wallMs: 6000 }), simMs = Math.round(performance.now() - w0);
    const an = (r) => (r ? PS.audio.analyse(r.data, r.sr, { flatHz: Q.flatHz, highHz: Q.highHz }) : null), ro = { sr: Q.sampleRate };
    return PS.audio.renderOffline(sc.log, secs, ro).then((full) => PS.audio.renderOffline(sc.log, secs, { ...ro, noise: false }).then((tonal) => ({ scene: { n: sc.n, seconds: sc.seconds, truncated: sc.truncated, events: sc.log.n, trace: sc.trace, simMs },
      full: an(full), tonal: an(tonal), red: full ? Array.from(full.red) : null, stats: full ? full.stats : null })));
  }
  // the render's bars (P2, config audio.qa): median flatness <= flatMax, median share above highHz <= highMax, no clipped sample, and the
  // noise-like share of the A-weighted power (the render as heard minus its tonal part, per second, median) <= noiseMax
  function mixChecks(r, check) {
    const Q = S.cfg.audio.qa, med = (a) => { const v = a.filter((x) => isFinite(x)).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : null; };
    if (!r.full) { check("audio_render_mix", true, { skipped: "no OfflineAudioContext" }); return; }
    const P = r.full.per, T = r.tonal.per, flat = med(P.map((x) => x.flat)), high = med(P.map((x) => x.high)), rms = med(P.map((x) => x.rms));
    const share = med(P.map((x, i) => { const a = Math.pow(10, x.aw / 10), t = T[i] ? Math.pow(10, T[i].aw / 10) : 0; return a > 0 ? Math.max(0, (a - t) / a) : 0; }));
    const red = (r.red || []).slice(Math.round(2 / 0.05)).sort((a, b) => a - b), redMed = red.length ? red[red.length >> 1] : 0; // (the reduction meter settles over its first 2 s)
    const d = { agents: r.scene.n, seconds: r.scene.seconds, truncated: r.scene.truncated, flat: +flat.toFixed(4), high: +high.toFixed(4), noiseShare: +share.toFixed(3), rms, peak: r.full.peak, clipped: r.full.clipped, limiterRedMed: +redMed.toFixed(2),
      bars: { flatMax: Q.flatMax, highMax: Q.highMax, noiseMax: Q.noiseMax }, simMs: r.scene.simMs };
    check("audio_render_mix", !r.scene.truncated && r.full.clipped === 0 && flat <= Q.flatMax && high <= Q.highMax && share <= Q.noiseMax, d);
  }
  function selfTest(opts) {
    opts = opts || {};
    const all = ["config", "sprites", "terrain", "caches", "art", "flow", "fight", "fixtures", "flipflop", "ai", "rivals", "fog", "spoils", "parity", "replay", "match", "audio"];
    const parts = opts.parts ? (Array.isArray(opts.parts) ? opts.parts : String(opts.parts).split(",")) : all, has = (p) => parts.indexOf(p) >= 0;
    const horizon = clamp(+opts.matchSeconds || (S.cfg ? S.cfg.world.matchSeconds : 240), 10, 600);
    const w0 = performance.now(), results = {}, fails = [], ms = {};
    const check = (name, ok, detail) => { results[name] = { pass: !!ok, detail }; if (!ok) fails.push(name); };
    const timed = (p, fn) => { const t = performance.now(); try { fn(); } catch (e) { check(p + "_threw", false, { error: String(e && e.stack || e) }); } ms[p] = Math.round(performance.now() - t); };
    const ls0 = lsSnapshot(), sig0 = stateSig(), refs0 = [S.agents, S.teams, S.map, S.cam, S.input, S.spr, S.stats, particles, floaters];
    let f = null, mt = null, mixP = null;
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
    if (has("art") && S.map && !S.map.flat) timed("art", () => {
      const A = S.cfg.art, ts = terrainSaturation(); check("art_terrain_saturation", ts.mean <= A.terrainSatMax, ts);
      const hs = []; for (let i = 1; i <= 6; i++) hs.push(hatShare(i, 60));
      check("art_hat_share_60", hs.every((h) => h.cropShare >= A.hatShareMin), hs);
      const b = bench("capclash", { ticks: 30 }); check("art_one_draw_per_agent", b.drawPerAgentOk && b.agentsDrawn > 100, { drawImage: b.drawImage, agentsDrawn: b.agentsDrawn, limit: +(A.drawPerAgent * b.agentsDrawn + A.drawOverhead).toFixed(1), perAgent: +(b.drawImage / Math.max(1, b.agentsDrawn)).toFixed(3), draw: b.draw });
      flushGround(S.map); const mem = canvasMemory(); check("art_cache_memory", mem.mb <= A.canvasBudgetMB && mem.atlases >= 7 && mem.banners >= 6, mem);
      // every cache after a drop: chunks and water pairs opaque on a 4x4 downscale, every atlas / banner / sprite non-blank (4x4 alpha sum), minimap opaque
      const dropped = debugDropCaches(); const probed = cacheProbe(0, 0, 0, 0, true); flushGround(S.map);
      const G = S.map.chunks, blank = []; let pairs = 0; for (let i = 0; i < G.n * G.n; i++) { if (!opaque4(G.cvA[i])) blank.push("chunk" + i); if (G.cvB[i]) { pairs++; if (!opaque4(G.cvB[i])) blank.push("water" + i); } }
      for (const e of spriteCanvases(S.spr)) if (!(PS.fog.sumAlpha4(e[1]) > 0)) blank.push(e[0]);
      if (!opaque4(miniTerr)) blank.push("minimap");
      check("art_caches_after_drop", probed && blank.length === 0, { dropped, probed, chunks: G.n * G.n, waterPairs: pairs, caches: spriteCanvases(S.spr).length, blank });
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
      const cvs = [[56, 40], [66, 47], [145, 87]].map(([a, b]) => clashVerdictTest(a, b)); // M5 critic MAJOR-1: fights the player always wins never open EVEN
      check("clash_1_4x_opens_winning", cvs.every((c) => c.verdict === "WINNING" && c.later && c.later.verdict === "WINNING"), cvs.map((c) => ({ nm: c.n + "v" + c.m, first: c.first && [c.first.verdict, +c.first.q.toFixed(2)], later: c.later && [c.later.verdict, +c.later.q.toFixed(2)] })));
      const r64 = mx[4]; check("fight_60v40_remnant", r64.playerWins >= 2 && r64.fled > 0, { wins: r64.playerWins, fled: r64.fled, seconds: r64.seconds }); // M2 critic MAJOR-1: the break rule keeps a remnant
      check("fight_30v20_4to7s", f.seconds >= 4 && f.seconds <= 7, { seconds: f.seconds, mode: S.cfg.combat.localMode });
    });
    if (has("fixtures")) timed("fixtures", () => {
      const a = fixture("pass64"), b = fixture("pass128"), c = fixture("ambush"), FX = S.cfg.fixtures;
      c.spec = [fixture("ambush", { wait: FX.ambushSpecWait }), fixture("ambush", { wait: FX.ambushSpecWait, blob: true })].map((r) => ({ variant: r.variant, waiting: r.waiting, loser: r.loser, t: r.rout && r.rout.t, flipped: r.headFlipped, fled: r.fled, columnAfter: r.columnAfter }));
      check("fixture_pass64", a.through != null && a.through <= 8 && a.regroup >= 0.9 && !a.terrainBad && !a.truncated, a);
      check("fixture_pass128", b.through != null && b.through <= 6 && b.regroup >= 0.9 && !b.terrainBad && !b.truncated, b);
      // P1: the ambush and hold fixtures run fixtures.comboSeeds seeds each. One seed was a knife edge: at M8's 170 px/s the in-pass hold passed
      // seed 1 but held 3 of 20 fresh seeds, and at P1's 155 px/s a 1 px change of flock.arrive flipped the ambush's seed 1. The bars are rates:
      // the column's head breaks at the exit in at least fixtures.ambushRate of the seeds, and 20 hold the pass (at the exit or inside it,
      // whichever holds more) in at least fixtures.holdRate of them. Seeds 1-8 at M8: ambush 8/8, exit 6/8, inside 5/8; at P1: 5/8, 0/8, 4/8
      const sds = []; for (let k = 1; k <= FX.comboSeeds; k++) sds.push(k);
      const am = [c].concat(sds.slice(1).map((sd) => fixture("ambush", { seed: sd }))), amOk = am.filter((r) => r.pass && !r.terrainBad).length;
      check("fixture_ambush_head_only", amOk >= FX.ambushRate * sds.length && am.every((r) => !r.terrainBad), { headOnly: amOk + "/" + sds.length, bar: FX.ambushRate, seed1: c, bySeed: am.map((r) => r.pass ? 1 : 0).join("") });
      // M2 critic MAJOR-1 and MAJOR-2
      const hs = [sds.map((sd) => fixture("hold", { seed: sd })), sds.map((sd) => fixture("hold", { seed: sd, at: -40 }))], hOk = hs.map((l) => l.filter((r) => r.pass && !r.terrainBad && !r.truncated).length);
      check("fixture_hold_pass", Math.max(hOk[0], hOk[1]) >= FX.holdRate * sds.length && hs.every((l) => l.every((r) => !r.terrainBad && !r.truncated)),
        { held: { exit: hOk[0] + "/" + sds.length, inside: hOk[1] + "/" + sds.length }, bar: FX.holdRate, seed1: hs.map((l) => ({ at: l[0].at, lasted: l[0].lasted, kills: l[0].killsBeforeBreak, firstBreak: l[0].firstBreak, holdersLeft: l[0].holdersLeft, columnLeft: l[0].columnLeft })) });
      // P1 (Peter's playtest): 8 peasants left beyond a 2-cell ridge rejoin in every control mode, and under the fog's knowledge
      const sg = [{ mode: "route" }, { mode: "hold" }, { mode: "steer" }, { mode: "huddle" }, { mode: "route", fog: "walked" }, { mode: "hold", fog: "walked" }].map((o) => fixture("straggler", o));
      check("fixture_straggler", sg.every((r) => r.pass && !r.terrainBad && !r.truncated && r.pathPx >= 900 && r.straightPx >= 150 && r.straightPx <= 250),
        sg.map((r) => ({ mode: r.mode, fog: r.fog, last: r.lastReached, straight: r.straightPx, path: r.pathPx, rock: r.rockMaxSeconds, pressed: r.pressMaxSeconds, left: r.distLeft })));
      const rm = [fixture("remnant"), fixture("remnant", { chase: true }), fixture("remnant", { loser: "ai" })];
      check("fixture_remnant_escape", rm[0].pass && !rm[0].terrainBad, rm.map((r) => ({ loser: r.loser, winner: r.winner, dist: r.dist, winnerStates: r.winnerStates, pass: r.pass })));
    });
    if (has("flipflop")) timed("flipflop", () => {
      const r = fixture("flipflop"), base = fixture("flipflop", { noHyst: true });
      check("fixture_flipflop", S.cfg.input.desktopMode !== "route" || (r.pass && !r.terrainBad), { route: r, noHysteresis: base, desktopMode: S.cfg.input.desktopMode });
    });
    if (has("ai")) timed("ai", () => {
      // two 90 s all-AI matches, six swarms under fog (M4 brief 8): everyone leaves home by 40 s, no knowledge violation, think cost
      const runs = [0, 1].map((k) => simMatch(90, { seed: 5150 + k * 7919, wallMs: 6000 }));
      check("ai_leave_home_40s", runs.every((r) => !r.truncated && r.names.length === 6 && r.leftHome.every((t) => t >= 0 && t <= 40)), runs.map((r) => ({ seed: r.seed, names: r.names, slots: r.slots, leftHome: r.leftHome, atCentre: r.atCentre, counts: r.timeline[r.timeline.length - 1].counts, ev: r.ev, truncated: r.truncated, wallMs: r.wallMs })));
      check("ai_knowledge_assert_90s_six", runs.every((r) => !r.truncated && r.seconds >= 89.9 && r.ai.violations === 0 && r.ai.decisions > 0), runs.map((r) => ({ seconds: r.seconds, ...r.ai }))); // no AI targeted a swarm or camp it had not seen
      check("ai_think_cost", runs.every((r) => r.aiCost.msPerTick < 0.1), runs.map((r) => r.aiCost));
      check("trickle_underdog_six", runs.every((r) => r.pacing.trickle > 0 && r.pacing.trickleFav / r.pacing.trickle >= 0.6 && r.pacing.trickleFav / r.pacing.trickle <= 0.95), runs.map((r) => ({ trickle: r.pacing.trickle, fav: r.pacing.trickleFav })));
      const bl = aiBlindTest(); check("ai_blind_to_hidden", bl.pass, bl);
    });
    if (has("rivals")) timed("rivals", () => {
      const sl = slotTest(); check("rivals_slot_shuffle_seeded", sl.pass, sl);
      const sc = scentTest(); check("rivals_scent_cadence", sc.pass, sc);
      const pl = pileTest(); check("rivals_pile_on", pl.pass, pl);
      const cr = crownTest(); check("finale_crown_scatter", cr.pass, cr);
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
    if (has("spoils")) timed("spoils", () => {
      const pl = spoilsPlacement(5); check("spoils_reachable_5_seeds", pl.every((r) => r.bad.length === 0), pl);
      const v = villageTest(); check("spoils_village_timing", v.pass, v);
      const b = banditTest(); check("spoils_bandit_leash_never_rout", b.pass, b);
      const h = heavyTest(); check("spoils_heavy_gate_counter", h.pass, h);
      const m = musterTest(); check("spoils_muster_grants", m.pass, m);
      const d = dropTest(); check("spoils_leader_drops", d.pass, d);
      const a = aiSpoilsTest(); check("spoils_ai_values_objectives", a.pass, a);
      const at = withSandbox(() => { const { p } = spoilsScene(33), base = p.spr; p.tier.arms = 0; SPL.grant(p, "arms", false, "qa", 0, 0); const up = p.spr; const probe = S.spr.peasantSet("#123456", "hood", { helmet: 1, tines: 1 }), dropped = S.spr.dropSet(probe);
        return { base: base.key, up: up.key, rebuilt: up !== base && !!up.relics && opaqueCount(up.atlas) > 0, dropped, zeroed: probe.atlas.width === 0 && !S.spr.sets.has(probe.key) }; });
      check("spoils_atlas_rebuild", at.rebuilt && at.dropped && at.zeroed, at);
    });
    if (has("parity")) timed("parity", () => { const p = parityTest(); check("spoils_arms_parity", p.pass, p); });
    if (has("replay")) timed("replay", () => { const r = replay(424242, 60); check("replay_60s", r.same, r); });
    if (has("audio")) timed("audio", () => {
      // P1: after a 120 s clash-heavy match the cue voices have all disconnected (only the bus's fixed nodes are left), the live node count
      // never passed audio.nodeCap, the level bound held (master x (lanePeak + live cues) <= audio.ceiling, master never raised), the
      // lanes and beds leave half the ceiling to the cues, and the hit / death budgets (P2) held under a 600+ agent melee
      const r = audioSoak(), AU = S.cfg.audio;
      if (r.error) { check("audio_soak_nodes", true, r); return; } // a browser without OfflineAudioContext: reported, not failed
      check("audio_soak_nodes", !r.truncated && r.seconds >= S.cfg.fixtures.audioSoakSeconds - 0.5 && r.nodesAfter === r.nodesFixed && r.cuesAfter === 0 && r.nodesMax <= AU.nodeCap && r.cues.closed === r.cues.made - r.cuesAfter, r);
      check("audio_level_bound", r.level.max <= AU.ceiling + 1e-6 && Math.abs(r.level.master - AU.master) < 1e-6 && r.lanes <= AU.ceiling / 2, { level: r.level, lanes: r.lanes, ceiling: AU.ceiling });
      const cap = (g) => Math.ceil(r.seconds * g.perSec) + g.perSec, capMs = (g) => Math.floor((r.seconds * 1000) / g.gapMs) + 1, pl = r.plays || {}, ca = r.calls || {}; // hits and deaths: perSec in any second (P2)
      check("audio_gates_hold", r.peakAgents >= 600 && (ca.hit || 0) > 3 * (pl.hit || 0) && (pl.hit || 0) > 0 && (pl.hit || 0) <= cap(AU.hit) && (pl.die || 0) <= cap(AU.die) && (pl.recruit || 0) <= capMs(AU.recruit),
        { peakAgents: r.peakAgents, calls: ca, plays: pl, capHit: cap(AU.hit), capDie: cap(AU.die) });
      mixP = audioMix(); // P2: the render check (asynchronous; its checks land in mixChecks)
    });
    if (has("match")) timed("match", () => {
      mt = simMatch(horizon, { wallMs: opts.wallMs || 9000 });
      check("simMatch_no_exceptions", mt.exceptions.length === 0, mt); // a wall-guard truncation is reported (detail.truncated), not failed: a slow machine isn't a bug
      check("simMatch_agent_cap", mt.capOver === 0 && mt.maxTotal <= mt.agentCap, { maxTotal: mt.maxTotal, agentCap: mt.agentCap, capOver: mt.capOver });
      check("no_agent_in_rock", mt.terrainBad === 0 && mt.seconds >= Math.min(60, horizon) - 0.5, { terrainBad: mt.terrainBad, firstBad: mt.firstBad, seconds: mt.seconds });
    });
    const refs1 = [S.agents, S.teams, S.map, S.cam, S.input, S.spr, S.stats, particles, floaters];
    check("state_restored", stateSig() === sig0 && refs0.every((r, i) => r === refs1[i]) && PS.terrain.map === S.map, { mode: S.mode, t: S.t, agents: S.agents.length });
    check("localStorage_unchanged", lsSnapshot() === ls0, {});
    const finish = () => {
      const n = Object.keys(results).length, total = Math.round(performance.now() - w0), pass = fails.length === 0;
      (pass ? console.log : console.warn)("[PS.selfTest] " + (pass ? "PASS " : "FAIL ") + (n - fails.length) + "/" + n + (pass ? "" : " fails: " + fails.join(", ")) + " | parts " + parts.join(",") +
        (f ? " | 30v20 " + (f.winner || "?") + " in " + f.seconds + "s" : "") + (mt ? " | simMatch " + mt.seconds + "s " + (mt.truncated ? "TRUNCATED by wall guard" : mt.end) + ", peak " + mt.maxTotal + "/" + mt.agentCap : "") + " | " + total + " ms");
      return { pass, fails, results, ms: total, partMs: ms };
    };
    // P2: the audio part's offline render finishes asynchronously (an OfflineAudioContext), after the sim state is checked restored: then
    // PS.selfTest returns a Promise (page.evaluate awaits it); without the audio part it returns its result as before
    if (!mixP) return finish();
    const r0 = performance.now();
    return mixP.then((r) => { ms.audioRender = Math.round(performance.now() - r0); mixChecks(r, check); return finish(); },
      (e) => { check("audio_render_threw", false, { error: String((e && e.stack) || e) }); return finish(); });
  }

  boot();
})();
