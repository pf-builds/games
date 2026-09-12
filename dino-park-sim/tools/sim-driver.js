// Economy acceptance runs for M2.6 item 4. Pure driver: it is handed the game's own modules and plays them
// exactly the way the UI does (buyParcel / buildFence / buyDino / buyParkFood / hire / advanceDays), so what it
// measures is the shipped economy, not a copy of it.
//
// Paths on Standard (M3):
//   (a) classic opening  — one starter herbivore in a wood-fenced small parcel, 30 units of plants, one tour guide,
//                          $5 ticket, nothing else. Year 1 must end with cash above zero and no default. REQUIRED.
//   (b) slow bleed       — all six staff roles and one marquee dinosaur on day 1 at a $5 ticket, then no further
//                          actions. Must foreclose inside two years with a stated cause. REQUIRED.
//   (c) slow bleed, fed  — the same day 1, but the pen is kept stocked. Informational: shows that feeding the animal
//                          is what separates a bleed from a business; it never gates the run.
//   (d) seeds (M4)       — a 4-tile pen with two starter herbivores, restocked with plants whenever the stock runs
//                          out, for 360 days: once unseeded and once fully planted, per biome. A seeded MARSH pen must
//                          buy at least 40% fewer plant units than the unseeded one (desert ~15%). REQUIRED (marsh).
//
// Math.random is swapped for a seeded PRNG so a run is reproducible and several seeds can be checked at once.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function withRng(seed, fn) {
  const real = Math.random;
  Math.random = makeRng(seed);
  try { return fn(); } finally { Math.random = real; }
}

const money = n => Math.round(n);
const fmtInt = n => `$${Math.round(n).toLocaleString('en-US')}`;

// Cheapest parcel that can hold one small herbivore: fewest tiles, then lowest price (as the cheapest land type).
function starterParcel(G) {
  return G.S.parcelDefs()
    .map(d => ({ id: d.id, tiles: d.tiles.length, price: G.E.parcelPrice(d.id) }))
    .sort((a, b) => a.tiles - b.tiles || a.price - b.price)[0];
}
// M4: land type is chosen at purchase; every scenario buys the cheapest biome unless it says otherwise, and a pen
// meant for a given species buys the cheapest biome that species PREFERS (a marquee species may require it).
const cheapestBiomeId = G => G.E.cheapestBiome().id;
function biomeFor(G, sp) {
  const pref = G.S.speciesBiomes(sp).preferred || [];
  const ids = G.S.DATA.biomes.biomes.filter(b => pref.includes(b.id)).sort((a, b) => a.plot_cost - b.plot_cost);
  return ids.length ? ids[0].id : cheapestBiomeId(G);
}
const cheapestStarterHerbivore = G => G.S.DATA.dinosaurs.species
  .filter(s => s.diet === 'herbivore' && s.min_fence_tier === 1 && s.space_required === 1)
  .sort((a, b) => a.shop_price - b.shop_price)[0];

// One quarter of days, then a snapshot taken right after the quarter closed.
function runQuarters(G, n, onDay) {
  const dpq = G.S.DATA.balance.time.days_per_quarter;
  const rows = [];
  for (let q = 0; q < n; q++) {
    for (let i = 0; i < dpq && !G.S.state.game_over; i++) { if (onDay) onDay(G.S.state.day); G.T.advanceDays(1); }
    const last = G.S.state.history[G.S.state.history.length - 1];
    rows.push({
      quarter: G.S.quarterLabel(q),
      cash: money(G.S.state.cash),
      debt: money(G.S.state.debt),
      attendance: last ? last.attendance : 0,
      revenue: last ? money(G.E.sum(last.revenue)) : 0,
      expenses: last ? money(G.E.sum(last.expenses)) : 0,
      profit: last ? money(last.profit) : 0,
      net_worth: money(G.E.netWorth())
    });
    if (G.S.state.game_over) break;
  }
  return rows;
}

// ---- (a) the classic opening ----
export function scenarioClassic(G, seed = 1) {
  return withRng(seed, () => {
    G.S.newGame();
    const st = G.S.state;
    const notes = [];
    const parcel = starterParcel(G);
    const sp = cheapestStarterHerbivore(G);
    const FOOD_BUNDLE = 30;

    const steps = [
      ['buy land', () => G.E.buyParcel(parcel.id, cheapestBiomeId(G))],
      ['wood fence', () => G.E.buildFence(parcel.id, 1)],
      [`buy ${sp.name}`, () => G.E.buyDino(sp.id, parcel.id)],
      [`${FOOD_BUNDLE} plants`, () => G.E.buyParkFood('plants', FOOD_BUNDLE)],
      ['hire tour guide', () => G.E.hire('tour_guide')]
    ];
    for (const [what, fn] of steps) { const err = fn(); if (err) notes.push(`${what}: ${err}`); }
    st.ticket_price = G.S.DATA.balance.attendance.reference_ticket;

    // The only ongoing decision a player still has to make: buy the same 30-unit bundle again when the store runs dry.
    let restocks = 0, restock_failed = 0;
    const quarters = runQuarters(G, G.S.DATA.balance.time.quarters_per_year, () => {
      if (st.park_food.plants > 0) return;
      if (G.E.buyParkFood('plants', FOOD_BUNDLE)) restock_failed++; else restocks++;
    });

    return {
      name: 'classic opening',
      setup: `${parcel.id} (${G.S.parcelSizeLabel(parcel.id)} ${G.S.parcelBiome(parcel.id).name}, ${G.E.parcelPrice(parcel.id)}), wood fence ${G.E.fenceCost(1, parcel.id)} (${G.E.perimeterSegments(parcel.id)} segments), one ${sp.name} ${sp.shop_price}, ${FOOD_BUNDLE} plants, one tour guide, $${st.ticket_price} ticket`,
      seed, notes, restocks, restock_failed,
      quarters,
      cash_end: money(st.cash),
      debt_end: money(st.debt),
      dinos_alive: G.S.allDinos().length,
      game_over: st.game_over,
      pass: st.cash > 0 && !st.game_over && G.S.allDinos().length > 0
    };
  });
}

// ---- (b) the slow bleed (M3 rewrite) ----
// The reachable trap: on day 1 the owner hires ALL SIX staff roles and buys ONE marquee dinosaur (land + the fence its
// species needs, with bank money where the opening loan runs out), sets a $5 ticket, and then takes no further action
// at all: no food, no restock, no more purchases. The animal starves within days, the park has nothing to show, and
// payroll keeps landing every 30 days into an overdraft. Must foreclose inside two years with a stated cause.
// (The old day-1 splurge — three marquee species plus the top parking tier — is unreachable: the debt cap refuses it.)
export function scenarioSlowBleed(G, seed = 1, opts = {}) {
  const feed = !!opts.feed;
  return withRng(seed, () => {
    G.S.newGame();
    const st = G.S.state;
    const bought = [], unfunded = [];
    st.ticket_price = G.S.DATA.balance.attendance.reference_ticket;

    // Cash for the next purchase, from the bank only. Returns false when the cap will not stretch that far.
    const fund = need => {
      if (st.cash >= need) return true;
      const room = Math.max(0, Math.floor(G.E.debtCap() - st.debt));
      const take = Math.min(room, Math.ceil(need - st.cash));
      if (take > 0) G.E.borrow(take);
      return st.cash >= need;
    };

    // One marquee dinosaur: the most expensive species on the roster, in the cheapest parcel that can hold it,
    // behind the fence tier its species requires.
    const sp = G.S.DATA.dinosaurs.species.slice().sort((a, b) => b.shop_price - a.shop_price)[0];
    const per = G.S.DATA.balance.parcel.space_per_tile;
    const spot = G.S.parcelDefs().filter(d => d.tiles.length * per >= sp.space_required)
      .sort((a, b) => a.tiles.length - b.tiles.length || G.E.parcelPrice(a.id) - G.E.parcelPrice(b.id))[0];
    const biome = biomeFor(G, sp);
    if (fund(G.E.parcelPrice(spot.id, biome))) { G.E.buyParcel(spot.id, biome); bought.push(`parcel ${spot.id} (${biome})`); } else unfunded.push('land');
    if (fund(G.E.fenceCost(sp.min_fence_tier, spot.id))) { G.E.buildFence(spot.id, sp.min_fence_tier); bought.push(`${G.S.fenceByTier(sp.min_fence_tier).name} fence`); } else unfunded.push('fence');
    if (fund(sp.shop_price)) { if (!G.E.buyDino(sp.id, spot.id)) bought.push(`${sp.name} (${fmtInt(sp.shop_price)})`); } else unfunded.push(`${sp.name} (${fmtInt(sp.shop_price)})`);
    // All six staff roles on day 1.
    for (const r of G.S.DATA.staff.roles) { if (!fund(r.salary_per_month)) { unfunded.push(`${r.name} hire`); continue; } if (!G.E.hire(r.id)) bought.push(`${r.name} hire`); }

    // (c) variant: the owner at least keeps the pen stocked (top-up whenever it runs low).
    let topups = 0, topup_failed = 0;
    const TOPUP_TO = 30, TOPUP_BELOW = 12;
    const feedFn = () => {
      const enc = st.parcels[spot.id].enclosure;
      if (!enc) return;
      for (const [foodId] of Object.entries(G.E.dailyNeed(enc))) {
        if (enc.food[foodId] >= TOPUP_BELOW) continue;
        if (G.E.buyEnclosureFood(spot.id, foodId, TOPUP_TO - enc.food[foodId])) topup_failed++; else topups++;
      }
    };
    if (feed) feedFn();

    const day1 = bought.slice();
    const payroll = G.E.monthlyPayroll();
    const quarters = runQuarters(G, G.S.DATA.balance.time.quarters_per_year * 2, feed ? feedFn : null);
    const years = G.S.DATA.balance.time.days_per_quarter * G.S.DATA.balance.time.quarters_per_year * 2;

    return {
      name: feed ? 'slow bleed (fed)' : 'slow bleed',
      setup: `all six staff roles (${fmtInt(payroll)}/month) + one ${sp.name} in a ${G.S.parcelSizeLabel(spot.id)} ${G.S.fenceByTier(sp.min_fence_tier).name.toLowerCase()} pen on day 1, $${st.ticket_price} ticket, ${feed ? `pen restocked below ${TOPUP_BELOW} units` : 'no food, no further actions'}`,
      seed, unfunded, bought_day_1: day1, payroll, topups, topup_failed,
      quarters,
      cash_end: money(st.cash),
      debt_end: money(st.debt),
      day_end: st.day,
      dinos_alive: G.S.allDinos().length,
      staff_end: st.staff.length,
      game_over: st.game_over,
      cause: st.game_over ? `${st.game_over.cause.category} ${money(st.game_over.cause.amount)} against ${money(st.game_over.cause.revenue)} of revenue over ${st.game_over.cause.quarters} quarters` : null,
      pass: feed ? true : (!!st.game_over && st.day <= years)
    };
  });
}
export const scenarioOverspend = scenarioSlowBleed;

// ---- (d) seeds -> vegetation (M4 item 4) ----
// A 4-tile pen of the given biome, wood fence, two starter herbivores, $5 ticket, no staff. Every day the pen's plant
// stock is topped back up to TOPUP_TO units when it falls below TOPUP_BELOW, and the units bought are counted. The
// seeded run plants the pen fully on day 1. Cash is not the constraint (a large float is added), so the only
// difference between the two runs is the greenery. Same seed => same event rolls in both runs.
export function scenarioSeeds(G, seed = 1, biomeId = 'marsh', seeded = true) {
  return withRng(seed, () => {
    G.S.newGame();
    const st = G.S.state;
    st.cash += 1000000;
    const notes = [];
    const B = G.S.DATA.balance;
    const per = B.parcel.space_per_tile;
    const spot = G.S.parcelDefs().filter(d => d.tiles.length === 4).sort((a, b) => a.id.localeCompare(b.id))[0] || G.S.parcelDefs().filter(d => d.tiles.length * per >= 2).sort((a, b) => a.tiles.length - b.tiles.length)[0];
    const herb = G.S.DATA.dinosaurs.species.filter(s => s.diet === 'herbivore' && s.min_fence_tier === 1 && s.space_required === 1).sort((a, b) => a.shop_price - b.shop_price);
    const sp = herb.find(s => G.S.biomeFit(s, biomeId) !== 'wrong') || herb[0];
    const steps = [
      [`buy ${spot.id} as ${biomeId}`, () => G.E.buyParcel(spot.id, biomeId)],
      ['wood fence', () => G.E.buildFence(spot.id, 1)],
      [`buy ${sp.name} #1`, () => G.E.buyDino(sp.id, spot.id)],
      [`buy ${sp.name} #2`, () => G.E.buyDino(sp.id, spot.id)]
    ];
    if (seeded) steps.push(['plant seeds (full)', () => G.E.plantSeeds(spot.id, G.E.seedsToPlant(spot.id))]);
    for (const [what, fn] of steps) { const err = fn(); if (err) notes.push(`${what}: ${err}`); }
    st.ticket_price = B.attendance.reference_ticket;
    const TOPUP_TO = 30, TOPUP_BELOW = 6;
    let bought = 0, buys = 0;
    const enc = st.parcels[spot.id].enclosure;
    const feed = () => { if (enc.food.plants < TOPUP_BELOW) { const n = TOPUP_TO - enc.food.plants; if (!G.E.buyEnclosureFood(spot.id, 'plants', n)) { bought += n; buys++; } } };
    feed();
    const days = B.dinosaur.days_per_year;
    for (let i = 0; i < days && !st.game_over; i++) { feed(); G.T.advanceDays(1); }
    const seedCost = seeded ? G.E.seedsToPlant(spot.id) * G.E.seedFood().unit_cost : 0;
    const plantCost = G.S.DATA.food.items.find(f => f.id === 'plants').unit_cost;
    return {
      name: `seeds ${biomeId} ${seeded ? 'seeded' : 'unseeded'}`, biome: biomeId, seeded, seed, notes,
      parcel: spot.id, tiles: spot.tiles.length, species: sp.name,
      plants_bought: bought, buys, plant_cost: bought * plantCost, seed_cost: seedCost,
      vegetation_end: Math.round((enc.vegetation || 0) * 10) / 10, cap: G.E.vegetationCap(spot.id), grazed: enc.grazed || 0,
      growth_per_day: Math.round(G.E.vegetationGrowth(st.parcels[spot.id]) * 100) / 100,
      dinos_alive: enc.dinos.length, days
    };
  });
}
export function scenarioSeedsAll(G, seed = 1) {
  const biomes = G.S.DATA.biomes.biomes.map(b => b.id);
  const rows = biomes.map(b => {
    const un = scenarioSeeds(G, seed, b, false), se = scenarioSeeds(G, seed, b, true);
    const saving = un.plants_bought > 0 ? 1 - se.plants_bought / un.plants_bought : 0;
    return { biome: b, unseeded: un, seeded: se, saving, net_dollars: un.plant_cost - se.plant_cost - se.seed_cost };
  });
  const marsh = rows.find(r => r.biome === 'marsh'), desert = rows.find(r => r.biome === 'desert');
  return { seed, rows, pass: !!marsh && marsh.saving >= 0.40 && (!desert || desert.saving >= 0.10) && rows.every(r => r.seeded.dinos_alive === 2 && r.unseeded.dinos_alive === 2) };
}

export function runAll(G, seeds = [1, 2, 3, 4, 5]) {
  const classic = seeds.map(s => scenarioClassic(G, s));
  const overspend = seeds.map(s => scenarioSlowBleed(G, s));
  const fed = seeds.map(s => scenarioSlowBleed(G, s, { feed: true }));
  const seedsRuns = seeds.slice(0, 3).map(s => scenarioSeedsAll(G, s));
  return {
    classic, overspend, fed, seeds: seedsRuns,
    classic_pass: classic.every(r => r.pass),
    overspend_pass: overspend.every(r => r.pass),
    fed_pass: fed.every(r => r.pass),
    seeds_pass: seedsRuns.every(r => r.pass),
    // (c) is informational: it shows what feeding the animal changes, and never gates the run.
    pass: classic.every(r => r.pass) && overspend.every(r => r.pass) && seedsRuns.every(r => r.pass)
  };
}

// Human-readable report (same text in node and in the browser).
export function formatReport(res) {
  const out = [];
  const table = rows => rows.map(r => `      ${r.quarter.padEnd(10)} cash ${String(r.cash).padStart(8)}  debt ${String(r.debt).padStart(7)}  att ${String(r.attendance).padStart(6)}  rev ${String(r.revenue).padStart(7)}  exp ${String(r.expenses).padStart(7)}  profit ${String(r.profit).padStart(8)}`);
  out.push('(a) CLASSIC OPENING — year 1 must end with cash above zero and no default');
  out.push(`    ${res.classic[0].setup}`);
  for (const r of res.classic) {
    out.push(`    seed ${r.seed}: cash ${r.cash_end}, debt ${r.debt_end}, dinos ${r.dinos_alive}, ${r.restocks} food restocks (${r.restock_failed} unaffordable) — ${r.pass ? 'PASS' : 'FAIL'}`);
    if (r.notes.length) out.push(`      notes: ${r.notes.join(' | ')}`);
    out.push(...table(r.quarters));
  }
  out.push('');
  out.push('(b) SLOW BLEED — all six staff + one marquee dinosaur on day 1, $5 ticket, nothing else: must foreclose inside two years with a stated cause');
  out.push(`    ${res.overspend[0].setup}`);
  for (const r of res.overspend) {
    out.push(`    seed ${r.seed}: day ${r.day_end}, cash ${r.cash_end}, debt ${r.debt_end}, dinos alive ${r.dinos_alive}, staff left ${r.staff_end} — ${r.game_over ? `FORECLOSED (${r.cause})` : 'still solvent'} — ${r.pass ? 'PASS' : 'FAIL'}`);
    out.push(`      day 1, bank money only: ${r.bought_day_1.join(', ') || 'nothing'}`);
    if (r.unfunded.length) out.push(`      refused by the debt cap: ${r.unfunded.join(', ')}`);
    out.push(...table(r.quarters));
  }
  out.push('');
  out.push('(c) SLOW BLEED, FED — same day 1, but the pen is kept stocked (informational: shows what feeding changes; does not gate the run)');
  out.push(`    ${res.fed[0].setup}`);
  for (const r of res.fed) {
    out.push(`    seed ${r.seed}: day ${r.day_end}, cash ${r.cash_end}, debt ${r.debt_end}, dinos alive ${r.dinos_alive}, staff left ${r.staff_end}, ${r.topups} food top-ups (${r.topup_failed} unaffordable) — ${r.game_over ? `FORECLOSED (${r.cause})` : 'still solvent'}`);
    out.push(`      day 1, bank money only: ${r.bought_day_1.join(', ') || 'nothing'}`);
    if (r.unfunded.length) out.push(`      refused by the debt cap: ${r.unfunded.join(', ')}`);
    out.push(...table(r.quarters));
  }
  out.push('');
  out.push('(d) SEEDS -> VEGETATION — 4-tile pen, two starter herbivores, plants topped up whenever the pen runs low, 360 days, unseeded vs fully planted on day 1 (marsh must save >= 40%, desert ~15%)');
  for (const r of res.seeds || []) {
    out.push(`    seed ${r.seed}: ${r.pass ? 'PASS' : 'FAIL'}`);
    for (const row of r.rows) {
      const u = row.unseeded, s = row.seeded;
      out.push(`      ${row.biome.padEnd(7)} ${u.parcel} (${u.tiles} tiles, 2x ${u.species}): unseeded bought ${String(u.plants_bought).padStart(4)} plants (${fmtInt(u.plant_cost)}) · seeded bought ${String(s.plants_bought).padStart(4)} (${fmtInt(s.plant_cost)}) + seeds ${fmtInt(s.seed_cost)} · saving ${Math.round(row.saving * 100)}% of plants, net ${fmtInt(row.net_dollars)} over the year · growth ${s.growth_per_day}/day, grazed ${s.grazed}, greenery at end ${s.vegetation_end}/${s.cap}, dinos alive ${s.dinos_alive}/${u.dinos_alive}`);
      if (s.notes.length || u.notes.length) out.push(`        notes: ${[...u.notes, ...s.notes].join(' | ')}`);
    }
  }
  out.push('');
  out.push(`RESULT: classic ${res.classic_pass ? 'PASS' : 'FAIL'}, slow bleed ${res.overspend_pass ? 'PASS' : 'FAIL'} (fed variant: ${res.fed.every(r => r.game_over) ? 'forecloses too' : res.fed.some(r => r.game_over) ? 'mixed' : 'survives'}), seeds ${res.seeds_pass ? 'PASS' : 'FAIL'}`);
  return out.join('\n');
}
