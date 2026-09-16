// Economy acceptance runs. Pure driver: it is handed the game's own modules and plays them exactly the way the UI
// does (buyParcel / buildFence / buyDino / buyParkFood / hire / advanceDays), so what it measures is the shipped
// economy, not a copy of it. Runs from tools/sim.html (there is no node on the build machine).
//
// Standard paths (M3/M4):
//   (a) classic opening  — one starter herbivore in a wood-fenced small parcel, 30 units of plants, one tour guide,
//                          $5 ticket, nothing else. Year 1 must end with cash above zero and no default. REQUIRED.
//   (b) slow bleed       — all six staff roles and one marquee dinosaur on day 1 at a $5 ticket, then no further
//                          actions. Must foreclose inside two years with a stated cause. REQUIRED.
//   (c) slow bleed, fed  — the same day 1, but the pen is kept stocked. Informational.
//   (d) seeds (M4)       — a 4-tile pen with two starter herbivores for 360 days, unseeded vs fully planted, per
//                          biome. Marsh >= 40%, plains >= 25%, desert >= 10% fewer plants bought. REQUIRED.
// Phase 2 balance sweep (SPEC item 2), all on Standard:
//   (e) facility ROI     — every facility tier pays back its cost within 6 quarters on the reference park where its
//                          effect is in play: the GOOD park (3 pens, 4 dinosaurs, staff, $6 ticket) for effect
//                          facilities, the BIG park (6 pens, 12 dinosaurs, 9 staff) for capacity and office tiers.
//   (f) prize pacing     — a scripted good run over 4 years: spend prizes about one per 1-2 quarters, all 8 by the end
//                          of year 4, the last one not before year 3.
//   (g) memberships      — 8 quarters at a good rating: members are 15-35% of revenue; starved with no staff, the
//                          members churn to near zero within 3 quarters.
//   (h) campaign ROI     — no campaign has negative expected ROI on the smallest park that unlocks it (averaged over
//                          the four season starts); three stacked social campaigns do not beat TV per dollar by > 2x.
//   (i) breakouts        — adequate fence 0/year; low-danger species one tier short <= 1/year; large carnivore in
//                          wood >= 1 per quarter; electrified + maintenance holds every species for a year.
//   (j) events           — mid park: <= 3 negative events per quarter on average, >= 1 positive per quarter.
//   (k) seeds            — (d) re-checked with the plains target.
// Phase 2 difficulty (SPEC item 1): the classic opening on all three modes, "Classic, played well", and the slow
// bleed on all three modes (Relaxed never forecloses; the Bank warning state shows instead).
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
const mean = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const DPQ = G => G.S.DATA.balance.time.days_per_quarter;
const QPY = G => G.S.DATA.balance.time.quarters_per_year;

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
const starterHerbivores = G => G.S.DATA.dinosaurs.species
  .filter(s => s.diet === 'herbivore' && s.min_fence_tier === 1 && s.space_required === 1)
  .sort((a, b) => a.shop_price - b.shop_price);
const cheapestStarterHerbivore = G => starterHerbivores(G)[0];

// One quarter of days, then a snapshot taken right after the quarter closed.
function runQuarters(G, n, onDay) {
  const dpq = DPQ(G);
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

// ---- (a) the classic opening (any mode) ----
export function scenarioClassic(G, seed = 1, opts = {}) {
  const modeId = typeof opts === 'string' ? opts : (opts.mode || G.S.DATA.difficulty.default_mode);
  return withRng(seed, () => {
    G.S.newGame(modeId);
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
    const cash_after_setup = money(st.cash);

    // The only ongoing decision a player still has to make: buy the same 30-unit bundle again when the store runs dry.
    let restocks = 0, restock_failed = 0;
    const quarters = runQuarters(G, QPY(G), () => {
      if (st.park_food.plants > 0) return;
      if (G.E.buyParkFood('plants', FOOD_BUNDLE)) restock_failed++; else restocks++;
    });
    const profit = quarters.reduce((s, q) => s + q.profit, 0);
    const alive = G.S.allDinos().length > 0;
    const positive = st.cash > 0 && !st.game_over && alive;
    // Per-mode target: Relaxed clearly positive (year profit > 0 and cash above what the setup left), Standard positive
    // (as today), Classic forecloses or ends the year with cash below zero.
    const pass = modeId === 'classic' ? (!!st.game_over || st.cash < 0) : modeId === 'relaxed' ? (positive && profit > 0 && st.cash > cash_after_setup) : positive;

    return {
      name: `classic opening (${modeId})`, mode: modeId,
      setup: `${parcel.id} (${G.S.parcelSizeLabel(parcel.id)} ${G.S.parcelBiome(parcel.id).name}, ${G.E.parcelPrice(parcel.id)}), wood fence ${G.E.fenceCost(1, parcel.id)} (${G.E.perimeterSegments(parcel.id)} segments), one ${sp.name} ${sp.shop_price}, ${FOOD_BUNDLE} plants, one tour guide, $${st.ticket_price} ticket`,
      seed, notes, restocks, restock_failed,
      quarters,
      cash_after_setup,
      cash_end: money(st.cash),
      debt_end: money(st.debt),
      profit_year: money(profit),
      dinos_alive: G.S.allDinos().length,
      bank: G.T.bankState ? G.T.bankState() : null,
      game_over: st.game_over,
      day_end: st.day,
      pass
    };
  });
}

// ---- Classic, played well (Phase 2) ----
// The same shoestring start on Classic, played with care: a starter herbivore in a fully seeded small pen, a tour
// guide, a $5 ticket, flyers whenever they lapse, a SECOND starter dinosaur at the start of Q2, no marquee purchase.
// Must survive year 1 (no foreclosure, cash above zero, animals alive).
export function scenarioClassicPlayedWell(G, seed = 1, modeId = 'classic') {
  return withRng(seed, () => {
    G.S.newGame(modeId);
    const st = G.S.state;
    const notes = [];
    const dpq = DPQ(G);
    // Cheapest parcel with room for two starters that is worth seeding (2+ tiles), as the cheapest biome.
    const parcel = G.S.parcelDefs().map(d => ({ id: d.id, tiles: d.tiles.length, price: G.E.parcelPrice(d.id) }))
      .filter(p => p.tiles >= 2).sort((a, b) => a.price - b.price || a.tiles - b.tiles)[0];
    const biome = cheapestBiomeId(G);
    const herbs = starterHerbivores(G).filter(s => G.S.biomeFit(s, biome) !== 'wrong');
    const sp1 = herbs[0], sp2 = herbs[1] || herbs[0];
    const FOOD_BUNDLE = 30;
    const steps = [
      ['buy land', () => G.E.buyParcel(parcel.id, biome)],
      ['wood fence', () => G.E.buildFence(parcel.id, 1)],
      [`buy ${sp1.name}`, () => G.E.buyDino(sp1.id, parcel.id)],
      ['plant seeds (full)', () => G.E.plantSeeds(parcel.id, G.E.seedsToPlant(parcel.id))],
      [`${FOOD_BUNDLE} plants`, () => G.E.buyParkFood('plants', FOOD_BUNDLE)],
      ['hire tour guide', () => G.E.hire('tour_guide')],
      ['flyers', () => G.E.buyCampaign('flyers')]
    ];
    for (const [what, fn] of steps) { const err = fn(); if (err) notes.push(`${what}: ${err}`); }
    st.ticket_price = G.S.DATA.balance.attendance.reference_ticket;
    let restocks = 0, restock_failed = 0, flyers = 1, flyers_failed = 0, second = null;
    const quarters = runQuarters(G, QPY(G), day => {
      // A real player retries the second dinosaur purchase until they can afford it, not just on day 91.
      if (second == null && day >= dpq + 1) { const err = G.E.buyDino(sp2.id, parcel.id); if (!err) second = `day ${day}`; }
      if (st.park_food.plants <= 0) { if (G.E.buyParkFood('plants', FOOD_BUNDLE)) restock_failed++; else restocks++; }
      if (!G.E.activeCampaigns().length && !G.E.campaignLock(G.S.campaignById('flyers'))) { if (G.E.buyCampaign('flyers')) flyers_failed++; else flyers++; }
    });
    return {
      name: `classic, played well (${modeId})`, mode: modeId, seed, notes,
      setup: `${parcel.id} (${G.S.parcelSizeLabel(parcel.id)} ${G.S.biomeById(biome).name}, ${G.E.parcelPrice(parcel.id, biome)}), wood fence ${G.E.fenceCost(1, parcel.id)}, one ${sp1.name}, seeds ${G.E.seedsToPlant(parcel.id)} units, ${FOOD_BUNDLE} plants, one tour guide, flyers, $${st.ticket_price} ticket; ${sp2.name} bought on day ${dpq + 1}`,
      quarters, restocks, restock_failed, flyers, flyers_failed, second_dino: second,
      cash_end: money(st.cash), debt_end: money(st.debt), day_end: st.day, dinos_alive: G.S.allDinos().length, game_over: st.game_over,
      pass: !st.game_over && st.cash > 0 && G.S.allDinos().length >= 1
    };
  });
}

// ---- (b) the slow bleed (M3 rewrite; any mode) ----
// The reachable trap: on day 1 the owner hires ALL SIX staff roles and buys ONE marquee dinosaur (land + the fence its
// species needs, with bank money where the opening loan runs out), sets a $5 ticket, and then takes no further action
// at all: no food, no restock, no more purchases. The animal starves within days, the park has nothing to show, and
// payroll keeps landing every 30 days into an overdraft. Must foreclose inside two years with a stated cause on
// Standard and Classic; on Relaxed it must NOT foreclose, and the Bank warning state must show instead.
export function scenarioSlowBleed(G, seed = 1, opts = {}) {
  const feed = !!opts.feed;
  const modeId = opts.mode || G.S.DATA.difficulty.default_mode;
  return withRng(seed, () => {
    G.S.newGame(modeId);
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
    for (const r of G.S.DATA.staff.roles) { if (!fund(G.E.roleSalary(r))) { unfunded.push(`${r.name} hire`); continue; } if (!G.E.hire(r.id)) bought.push(`${r.name} hire`); }

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
    let warning_day = null;
    const quarters = runQuarters(G, QPY(G) * 2, day => { if (feed) feedFn(); if (warning_day == null && G.T.bankState && G.T.bankState().warning) warning_day = day; });
    const years = DPQ(G) * QPY(G) * 2;
    const bank = G.T.bankState ? G.T.bankState() : null;
    const noForeclose = !G.S.mode().foreclosure_enabled;
    const pass = feed ? true : noForeclose ? (!st.game_over && !!(bank && bank.warning) && (st.over_cap_quarters || 0) > 0) : (!!st.game_over && st.day <= years);

    return {
      name: feed ? `slow bleed, fed (${modeId})` : `slow bleed (${modeId})`, mode: modeId,
      setup: `all six staff roles (${fmtInt(payroll)}/month) + one ${sp.name} in a ${G.S.parcelSizeLabel(spot.id)} ${G.S.fenceByTier(sp.min_fence_tier).name.toLowerCase()} pen on day 1, $${st.ticket_price} ticket, ${feed ? `pen restocked below ${TOPUP_BELOW} units` : 'no food, no further actions'}`,
      seed, unfunded, bought_day_1: day1, payroll, topups, topup_failed,
      quarters,
      cash_end: money(st.cash),
      debt_end: money(st.debt),
      day_end: st.day,
      dinos_alive: G.S.allDinos().length,
      staff_end: st.staff.length,
      game_over: st.game_over,
      bank, warning_day, over_cap_quarters: st.over_cap_quarters || 0,
      cause: st.game_over ? `${st.game_over.cause.category} ${money(st.game_over.cause.amount)} against ${money(st.game_over.cause.revenue)} of revenue over ${st.game_over.cause.quarters} quarters` : null,
      pass
    };
  });
}
export const scenarioOverspend = scenarioSlowBleed;

// ---- (d) seeds -> vegetation (M4 item 4) ----
export function scenarioSeeds(G, seed = 1, biomeId = 'marsh', seeded = true) {
  return withRng(seed, () => {
    G.S.newGame();
    const st = G.S.state;
    st.cash += 1000000;
    const notes = [];
    const B = G.S.DATA.balance;
    const per = B.parcel.space_per_tile;
    const spot = G.S.parcelDefs().filter(d => d.tiles.length === 4).sort((a, b) => a.id.localeCompare(b.id))[0] || G.S.parcelDefs().filter(d => d.tiles.length * per >= 2).sort((a, b) => a.tiles.length - b.tiles.length)[0];
    const herb = starterHerbivores(G);
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
    const seedCost = seeded ? G.E.seedsToPlant(spot.id) * G.E.foodUnitCost(G.E.seedFood()) : 0;
    const plantCost = G.E.foodUnitCost(G.S.DATA.food.items.find(f => f.id === 'plants'));
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
export const SEED_TARGETS = { marsh: 0.40, plains: 0.25, desert: 0.10 };
export function scenarioSeedsAll(G, seed = 1) {
  const biomes = G.S.DATA.biomes.biomes.map(b => b.id);
  const rows = biomes.map(b => {
    const un = scenarioSeeds(G, seed, b, false), se = scenarioSeeds(G, seed, b, true);
    const saving = un.plants_bought > 0 ? 1 - se.plants_bought / un.plants_bought : 0;
    return { biome: b, unseeded: un, seeded: se, saving, target: SEED_TARGETS[b] ?? 0, net_dollars: un.plant_cost - se.plant_cost - se.seed_cost, pass: saving >= (SEED_TARGETS[b] ?? 0) && se.dinos_alive === 2 && un.dinos_alive === 2 };
  });
  return { seed, rows, pass: rows.every(r => r.pass) };
}

// ============================================================================================================
// Phase 2 balance sweep: shared park builders
// ============================================================================================================
// Parcels with room for a real pen (4+ tiles), biggest first, then by id, so every build picks the same parcels.
function penParcels(G, n, minTiles = 4) {
  return G.S.parcelDefs().slice().filter(d => d.tiles.length >= minTiles).sort((a, b) => b.tiles.length - a.tiles.length || a.id.localeCompare(b.id)).slice(0, n);
}
function makePen(G, parcelId, biome, tier, speciesIds, notes) {
  let err = G.E.buyParcel(parcelId, biome); if (err) notes.push(`${parcelId} land: ${err}`);
  err = G.E.buildFence(parcelId, tier); if (err) notes.push(`${parcelId} fence: ${err}`);
  for (const id of speciesIds) { if (!G.S.speciesById(id)) { notes.push(`no species ${id}`); continue; } err = G.E.buyDino(id, parcelId); if (err) notes.push(`${parcelId} ${id}: ${err}`); }
}
// Stock 30 days of every eaten food and turn auto-restock on for it, so nothing in the reference parks ever starves.
function stockAndAutoRestock(G, days = 30) {
  for (const row of G.E.foodDays()) {
    if (row.need <= 0) continue;
    const amount = Math.max(10, Math.ceil(row.need * days));
    G.E.buyParkFood(row.food.id, amount);
    G.E.setAutoRestock(row.food.id, { on: true, threshold_days: 5, amount });
  }
}
// GOOD park: 3 pens (two plains-loving starters in wood, a Camptosaurus in steel, a Hadrosaurus in a marsh steel pen),
// four staff, a $6 ticket, food on auto-restock, Parking I so the gate is not the binding constraint, and the two
// cheapest concession tiers (Snack Cart, Souvenir Stand: each pays back inside a quarter, so any good run has them by
// the time it weighs a bigger purchase). Cash is not the question in these runs, so a large float is added.
export const GOOD_STAFF = ['tour_guide', 'maintenance', 'concessions', 'veterinary'];
export const GOOD_FACILITIES = { food_stand: 1, gift_shop: 1 };
export function buildGoodPark(G, { mode = 'standard', ticket = 6, cash = 1000000, facilities = {}, staff = GOOD_STAFF, parking = 1, restock = true, baseline = GOOD_FACILITIES } = {}) {
  G.S.newGame(mode);
  const st = G.S.state;
  st.cash += cash;
  const notes = [];
  const P = penParcels(G, 3);
  makePen(G, P[0].id, 'plains', 1, ['hypsilophodon', 'dryosaurus'], notes);
  makePen(G, P[1].id, 'plains', 2, ['camptosaurus'], notes);
  makePen(G, P[2].id, 'marsh', 2, ['hadrosaurus'], notes);
  for (const r of staff) { const err = G.E.hire(r); if (err) notes.push(`hire ${r}: ${err}`); }
  st.facilities.parking_lot = parking;
  Object.assign(st.facilities, baseline, facilities);
  st.ticket_price = ticket;
  if (restock) stockAndAutoRestock(G);
  return { parcels: P.slice(0, 3).map(p => p.id), notes };
}
// BIG park: the GOOD park plus three pens of big herbivores (12 dinosaurs, 12 species) and a nine-strong crew,
// demand well above 1,000 a day, so capacity tiers (parking, tram) and the office's staff cap actually bind.
export const BIG_STAFF = ['tour_guide', 'tour_guide', 'maintenance', 'maintenance', 'concessions', 'concessions', 'veterinary', 'security', 'management'];
export function buildBigPark(G, { mode = 'standard', ticket = 6, cash = 1000000, facilities = {}, staff = BIG_STAFF, parking = 4, tram = 3 } = {}) {
  const base = buildGoodPark(G, { mode, ticket, cash, staff, parking, restock: false });
  const st = G.S.state;
  const notes = base.notes;
  const P = penParcels(G, 6);
  makePen(G, P[3].id, 'plains', 3, ['stegosaurus', 'apatosaurus', 'styracosaurus'], notes);
  makePen(G, P[4].id, 'marsh', 3, ['parasaurolophus', 'iguanodon'], notes);
  makePen(G, P[5].id, 'plains', 2, ['ankylosaurus', 'pachycephalosaurus', 'pachycephalosaurus'], notes);
  st.facilities.park_tram = tram;
  Object.assign(st.facilities, facilities);
  stockAndAutoRestock(G);
  return { parcels: P.map(p => p.id), notes };
}
// Wealth without the facilities' own book value: cash + land, fences and animals. Two runs that differ only in one
// facility tier compare on this, so a tier "pays back" when the park is at least `cost` richer for having it.
function wealthNoFacilities(G) {
  const NW = G.S.DATA.balance.net_worth;
  let fac = 0;
  for (const f of G.S.facilityDefs()) fac += G.E.facilityInvested(f.id) * NW.facility_value_ratio;
  return G.S.state.cash + G.E.assetsValue() - fac;
}

// ---- (e) facility ROI ----
export const CAPACITY_KEYS = ['parking_capacity', 'gate_capacity', 'management_capacity'];
export function roiReferencePark(G, facilityId) {
  const f = G.S.facilityById(facilityId);
  return CAPACITY_KEYS.includes(f.effect_key) ? 'big' : 'good';
}
// One run: the reference park with `facilityId` set to `tier` (for free: the comparison charges the cost), six
// quarters, wealth-without-facilities at every quarter close.
function roiRun(G, seed, park, facilityId, tier, quarters) {
  return withRng(seed, () => {
    const fac = {};
    if (park === 'big') { if (facilityId !== 'parking_lot') fac.parking_lot = facilityId === 'park_tram' ? 0 : 4; if (facilityId !== 'park_tram') fac.park_tram = facilityId === 'parking_lot' ? 0 : 3; buildBigPark(G, { parking: fac.parking_lot ?? 0, tram: fac.park_tram ?? 0 }); }
    else buildGoodPark(G, { parking: facilityId === 'parking_lot' ? 0 : 1 });
    const st = G.S.state;
    for (const f of G.S.facilityDefs()) if (f.id === facilityId) st.facilities[f.id] = tier;
    // A concession store needs its own concessions worker (the store card says so): one per open store.
    while (G.S.staffCount('concessions') < G.A.concessionStores().length) { if (G.E.hire('concessions')) break; }
    const w0 = wealthNoFacilities(G);
    const wq = [];
    let revenue = 0, attendance = 0;
    for (let q = 0; q < quarters; q++) {
      G.T.advanceDays(DPQ(G));
      const last = st.history[st.history.length - 1];
      revenue += last ? G.E.sum(last.revenue) : 0;
      attendance += last ? last.attendance : 0;
      wq.push(wealthNoFacilities(G) - w0);
    }
    return { wq, revenue, attendance };
  });
}
// Facilities whose value is avoided losses (events averted, animals kept healthy) are noisy run to run: a single
// averted storm on the BIG park is worth a day of $16,000, so they get four times the seeds.
export const NOISY_FACILITIES = ['office', 'vet_clinic'];
export function scenarioFacilityRoi(G, baseSeeds = [1, 2, 3, 4, 5], quarters = 6) {
  const out = [];
  for (const f of G.S.facilityDefs()) {
    const park = roiReferencePark(G, f.id);
    const tiers = f.tiers.map(t => t.tier);
    const seeds = NOISY_FACILITIES.includes(f.id) ? Array.from({ length: baseSeeds.length * 4 }, (_, i) => i + 1) : baseSeeds;
    // Chain: one run per tier per seed; the delta for tier t is run[t] - run[t-1] on the same seed.
    const runs = tiers.map(t => seeds.map(s => roiRun(G, s, park, f.id, t, quarters)));
    for (let i = 1; i < tiers.length; i++) {
      const def = f.tiers[i];
      const per = seeds.map((s, k) => {
        const a = runs[i - 1][k], b = runs[i][k];
        const deltas = b.wq.map((w, q) => w - a.wq[q]);
        const payback = deltas.findIndex(d => d >= def.cost);
        return { seed: s, delta: deltas[quarters - 1], payback_quarter: payback < 0 ? null : payback + 1, revenue_delta: b.revenue - a.revenue, attendance_delta: b.attendance - a.attendance };
      });
      const avgDelta = mean(per.map(p => p.delta));
      const paybacks = per.map(p => p.payback_quarter);
      out.push({
        facility: f.id, name: f.name, tier: def.tier, label: def.label, cost: def.cost, upkeep: def.upkeep_per_quarter || 0, park,
        effect: Object.entries(def.effects || {}).map(([k, v]) => `${k} ${v}`).join(', '),
        delta_avg: money(avgDelta), revenue_delta_avg: money(mean(per.map(p => p.revenue_delta))), attendance_delta_avg: money(mean(per.map(p => p.attendance_delta))),
        payback_quarter_avg: paybacks.every(p => p != null) ? r1(mean(paybacks)) : null, seeds_paid_back: paybacks.filter(p => p != null).length, per,
        pass: avgDelta >= def.cost
      });
    }
  }
  return { rows: out, quarters, pass: out.every(r => r.pass) };
}

// ---- (f) prize pacing: a scripted good run over four years ----
// A careful owner on the standard loan: two starters in a seeded plains pen, a guide, auto-restock, flyers, and then
// a build order worked through whenever cash clears a reserve (three months of payroll plus a cushion), bigger
// campaigns as they unlock, memberships when they unlock. Every General Store dollar (fences, upgrades, food,
// campaigns) counts toward the spend prizes; land and animals do not.
export function scenarioGoodRunPolicy(G, seed = 1, { mode = 'standard', quarters = 16 } = {}) {
  return withRng(seed, () => {
    G.S.newGame(mode);
    const st = G.S.state;
    const notes = [];
    const dpq = DPQ(G);
    const P = penParcels(G, 6);
    const hires = {};
    const hire = r => { const err = G.E.hire(r); if (!err) hires[r] = (hires[r] || 0) + 1; return err; };
    // Day 1
    makePen(G, P[0].id, 'plains', 1, ['hypsilophodon', 'dryosaurus'], notes);
    G.E.plantSeeds(P[0].id, G.E.seedsToPlant(P[0].id));
    hire('tour_guide');
    G.E.buyParkFood('plants', 60);
    G.E.setAutoRestock('plants', { on: true, threshold_days: 5, amount: 60 });
    G.E.buyCampaign('flyers');
    st.ticket_price = G.S.DATA.balance.attendance.reference_ticket;
    const up = id => () => G.E.upgradeFacility(id);
    const upCost = id => (G.S.facilityNextTier(id) ? G.S.facilityNextTier(id).cost : Infinity);
    const penCost = (pid, biome, tier, ids) => G.E.parcelPrice(pid, biome) + G.E.fenceCost(tier, pid) + ids.reduce((s, id) => s + G.S.speciesById(id).shop_price, 0);
    const pen = (pid, biome, tier, ids) => () => { const before = notes.length; makePen(G, pid, biome, tier, ids, notes); return notes.length > before ? notes[notes.length - 1] : null; };
    const dino = (id, pid) => () => G.E.buyDino(id, pid);
    const steps = [
      ['Parking I', () => upCost('parking_lot'), up('parking_lot')],
      ['Snack Cart + concessions hire', () => upCost('food_stand'), () => up('food_stand')() || hire('concessions')],
      ['pen 2: Camptosaurus', () => penCost(P[1].id, 'plains', 2, ['camptosaurus']), pen(P[1].id, 'plains', 2, ['camptosaurus'])],
      ['Souvenir Stand', () => upCost('gift_shop'), up('gift_shop')],
      ['Restroom Block', () => upCost('restrooms'), up('restrooms')],
      ['Info Kiosk', () => upCost('visitor_center'), up('visitor_center')],
      ['maintenance hire', () => 3000, () => hire('maintenance')],
      ['pen 3: Hadrosaurus', () => penCost(P[2].id, 'marsh', 2, ['hadrosaurus']), pen(P[2].id, 'marsh', 2, ['hadrosaurus'])],
      ['First-Aid Post + vet hire', () => upCost('vet_clinic'), () => up('vet_clinic')() || hire('veterinary')],
      ['second guide', () => 3000, () => hire('tour_guide')],
      ['Food Stand', () => upCost('food_stand'), up('food_stand')],
      ['Gift Shop', () => upCost('gift_shop'), up('gift_shop')],
      ['Tram Stop', () => upCost('park_tram'), up('park_tram')],
      ['pen 4: Stegosaurus', () => penCost(P[3].id, 'plains', 3, ['stegosaurus']), pen(P[3].id, 'plains', 3, ['stegosaurus'])],
      ['Tiled Block', () => upCost('restrooms'), up('restrooms')],
      ['Parking II', () => upCost('parking_lot'), up('parking_lot')],
      ['Admin Building + manager', () => upCost('office'), () => up('office')() || hire('management')],
      ['Visitor Center', () => upCost('visitor_center'), up('visitor_center')],
      ['Diner', () => upCost('food_stand'), up('food_stand')],
      ['Gift Emporium', () => upCost('gift_shop'), up('gift_shop')],
      ['Apatosaurus', () => G.S.speciesById('apatosaurus').shop_price, dino('apatosaurus', P[3].id)],
      ['Park Tram', () => upCost('park_tram'), up('park_tram')],
      ['Parking III', () => upCost('parking_lot'), up('parking_lot')],
      ['Vet Clinic', () => upCost('vet_clinic'), up('vet_clinic')],
      ['Family Pavilion', () => upCost('restrooms'), up('restrooms')],
      ['pen 5: Parasaurolophus + Iguanodon', () => penCost(P[4].id, 'marsh', 3, ['parasaurolophus', 'iguanodon']), pen(P[4].id, 'marsh', 3, ['parasaurolophus', 'iguanodon'])],
      ['third guide + second maintenance + second concessions', () => 6000, () => hire('tour_guide') || hire('maintenance') || hire('concessions')],
      ['Discovery Hall', () => upCost('visitor_center'), up('visitor_center')],
      ['Restaurant', () => upCost('food_stand'), up('food_stand')],
      ['Museum Store', () => upCost('gift_shop'), up('gift_shop')],
      ['Parking IV', () => upCost('parking_lot'), up('parking_lot')],
      ['Park Headquarters', () => upCost('office'), up('office')],
      ['Animal Hospital', () => upCost('vet_clinic'), up('vet_clinic')],
      ['Tram Loop', () => upCost('park_tram'), up('park_tram')],
      ['pen 6: Ankylosaurus + Pachycephalosaurus', () => penCost(P[5].id, 'plains', 2, ['ankylosaurus', 'pachycephalosaurus']), pen(P[5].id, 'plains', 2, ['ankylosaurus', 'pachycephalosaurus'])]
    ];
    let next = 0;
    const done = [];
    const reserve = () => G.E.monthlyPayroll() * 3 + 4000;
    const STEPS_PER_CLOSE = 2;
    const tryBuild = day => {
      // A good run, not a max-growth run: the owner reads the Quarterly Report and makes at most two investments.
      let made = 0;
      while (next < steps.length && made < STEPS_PER_CLOSE) {
        const [name, cost, fn] = steps[next];
        const c = cost();
        if (!Number.isFinite(c) || st.cash - c < reserve()) break;
        const err = fn();
        if (err) { notes.push(`day ${day} ${name}: ${err}`); next++; continue; }
        done.push({ day, name, cost: money(c) });
        next++; made++;
      }
      // Marketing: the strongest boost campaign that is unlocked and not running; memberships once they unlock.
      for (const id of ['tv_spot', 'radio', 'flyers']) {
        const def = G.S.campaignById(id);
        if (!def || G.E.campaignLock(def) || st.cash - def.cost < reserve()) continue;
        if (G.E.activeCampaigns().some(c => c.kind === 'boost')) break;
        if (!G.E.buyCampaign(id)) done.push({ day, name: def.name, cost: def.cost });
        break;
      }
      const mem = G.S.campaignById('memberships');
      if (mem && !st.members.active && !G.E.campaignLock(mem) && st.cash - mem.cost >= reserve() && !G.E.buyCampaign('memberships')) done.push({ day, name: mem.name, cost: mem.cost });
      // Keep every eaten food on auto-restock as the herd grows.
      for (const row of G.E.foodDays()) if (row.need > 0) { const amount = Math.max(30, Math.ceil(row.need * 30)); G.E.setAutoRestock(row.food.id, { on: true, threshold_days: 5, amount }); }
    };
    const prizeDays = [];
    const spendByQuarter = [];
    const quartersRows = runQuarters(G, quarters, day => {
      if (day === dpq + 1) st.ticket_price = 6; // the $6 ticket once the park has something to show
      if (day % dpq === 1 && day > 1) { tryBuild(day); spendByQuarter.push(money(st.store_spend)); }
    });
    spendByQuarter.push(money(st.store_spend));
    const spendPrizes = G.S.prizeDefs().filter(p => p.threshold != null);
    for (const p of spendPrizes) { const e = (st.prizes || []).find(x => x.id === p.id); prizeDays.push({ id: p.id, name: p.name, threshold: p.threshold, day: e ? e.day : null, quarter: e ? Math.floor((e.day - 1) / dpq) + 1 : null }); }
    const earned = prizeDays.filter(p => p.day != null);
    const gaps = earned.slice(1).map((p, i) => (p.day - earned[i].day) / dpq);
    const last = earned.length === spendPrizes.length ? earned[earned.length - 1] : null;
    const year = d => Math.floor((d - 1) / (dpq * QPY(G))) + 1;
    return {
      name: 'prize pacing (good run policy)', seed, notes, quarters: quartersRows, done, steps_done: done.length, steps_total: steps.length,
      store_spend: money(st.store_spend), spend_by_quarter: spendByQuarter, prizes: prizeDays, earned: earned.length, total: spendPrizes.length,
      gap_quarters_avg: r2(mean(gaps)), gap_quarters_max: gaps.length ? r2(Math.max(...gaps)) : null, first_day: earned[0]?.day ?? null, last_day: last ? last.day : null, last_year: last ? year(last.day) : null,
      game_over: st.game_over, cash_end: money(st.cash), dinos: G.S.allDinos().length, species: G.S.speciesOwned().size,
      // Targets: all 8 by the end of year 4, the last not before year 3, gaps roughly one per 1-2 quarters (mean 0.5-2.5, no gap over 4).
      pass: !!last && last.day <= dpq * QPY(G) * 4 && year(last.day) >= 3 && mean(gaps) >= 0.5 && mean(gaps) <= 2.5 && Math.max(...gaps) <= 4
    };
  });
}

// ---- (g) memberships ----
export function scenarioMemberships(G, seed = 1, { poor = false } = {}) {
  return withRng(seed, () => {
    buildGoodPark(G, { facilities: { restrooms: 1 } });
    const st = G.S.state;
    const notes = [];
    const dpq = DPQ(G);
    const err = G.E.buyCampaign('memberships');
    if (err) { notes.push(`launch: ${err} (forced on)`); st.members.active = true; st.members.launched_day = st.day; }
    const rows = [];
    let peak = 0, share = 0, memberRev = 0, totalRev = 0;
    const snap = q => {
      const last = st.history[st.history.length - 1];
      const m = last ? (last.revenue.memberships || 0) : 0, t = last ? G.E.sum(last.revenue) : 0;
      memberRev += m; totalRev += t;
      peak = Math.max(peak, st.members.count);
      rows.push({ quarter: G.S.quarterLabel(q), members: st.members.count, joined: st.members.joined_last_q, churned: st.members.churned_last_q, churn: r2(st.members.churn_rate_last), member_revenue: money(m), revenue: money(t), share: t ? r2(m / t) : 0, rating: r1(last ? last.rating_end : G.A.parkRating()) });
    };
    const good = poor ? 3 : 8;
    for (let q = 0; q < good; q++) { G.T.advanceDays(dpq); snap(q); }
    let poorRows = null;
    if (poor) {
      // The park goes to seed: every worker fired, food gone and auto-restock off, so the animals starve and the rating collapses.
      const peakAtTurn = st.members.count;
      st.staff = [];
      for (const f of G.S.DATA.food.items) { st.park_food[f.id] = 0; G.E.setAutoRestock(f.id, { on: false }); }
      for (const p of G.S.enclosures()) for (const k in p.enclosure.food) p.enclosure.food[k] = 0;
      poorRows = [];
      for (let q = 0; q < 3; q++) { G.T.advanceDays(dpq); const last = st.history[st.history.length - 1]; poorRows.push({ quarter: G.S.quarterLabel(good + q), members: st.members.count, churn: r2(st.members.churn_rate_last), rating: r1(last ? last.rating_end : 0), dinos: G.S.allDinos().length }); }
      const end = st.members.count;
      return { name: 'memberships, poor rating', seed, notes, good_rows: rows, poor_rows: poorRows, peak: peakAtTurn, members_end: end, fraction_left: peakAtTurn ? r2(end / peakAtTurn) : 0, pass: peakAtTurn > 0 && end <= Math.max(2, 0.1 * peakAtTurn) };
    }
    share = totalRev ? memberRev / totalRev : 0;
    return { name: 'memberships, good rating', seed, notes, rows, member_revenue: money(memberRev), revenue: money(totalRev), share: r2(share), peak, members_end: st.members.count, pass: share >= 0.15 && share <= 0.35 };
  });
}

// ---- (h) campaign ROI ----
// The smallest park that unlocks a campaign: N cheap starter herbivores of distinct species (min_species), a tour
// guide, a $5 ticket, Parking I only when the campaign requires it, a Visitor Center when it requires one. Expected
// ROI = revenue with the campaign minus revenue without it minus its cost, over the campaign's window, averaged
// over the four season starts (the park is advanced to that season first) and the seeds. Perks are judged over a
// year at a $7 ticket (a park still charging the $5 reference has no use for an elasticity cut); memberships over
// four quarters; the school program over its 90 days.
function minimalUnlockPark(G, def, season, seed) {
  const u = def.unlock || {};
  G.S.newGame('standard');
  const st = G.S.state;
  st.cash += 1000000;
  const notes = [];
  const n = Math.max(1, u.min_species || 1);
  const P = penParcels(G, 2);
  const herbs = starterHerbivores(G);
  const ids = [];
  for (const sp of herbs) { if (ids.length >= n) break; if (G.S.biomeFit(sp, 'plains') !== 'wrong') ids.push(sp.id); }
  for (const sp of herbs) { if (ids.length >= n) break; if (!ids.includes(sp.id)) ids.push(sp.id); }
  makePen(G, P[0].id, 'plains', 1, ids, notes);
  G.E.hire('tour_guide');
  if (u.requires_facility) for (const [fid, tier] of Object.entries(u.requires_facility)) st.facilities[fid] = Math.max(st.facilities[fid] || 0, tier);
  st.ticket_price = def.kind === 'perk' ? 7 : G.S.DATA.balance.attendance.reference_ticket;
  // A rating requirement: clean paths, a restroom block, and more starters (distinct species) until the rating holds.
  if (u.min_rating) {
    st.cleanliness = 100; st.facilities.restrooms = Math.max(st.facilities.restrooms || 0, 1);
    G.E.hire('maintenance'); // keeps the paths clean through the season advance below
    let extra = 0;
    while (G.A.parkRating() < u.min_rating && extra < 6) {
      const sp = herbs.find(s => !ids.includes(s.id)) || herbs[0];
      const target = G.E.enclosureFits(st.parcels[P[0].id], sp) ? P[0].id : (st.parcels[P[1].id].owned ? P[1].id : (makePen(G, P[1].id, 'plains', 1, [], notes), P[1].id));
      const err = G.E.buyDino(sp.id, target); if (err) { notes.push(`rating filler ${sp.id}: ${err}`); break; }
      ids.push(sp.id); extra++;
    }
  }
  stockAndAutoRestock(G);
  // Advance to the requested season start (quarter index), a quiet way to test every season's economics. The park
  // keeps its opening crew: a walkout or a poaching event empties a role, the owner rehires (as the breakout runs do).
  const crew = st.staff.map(w => w.role);
  for (let i = 0; i < season * DPQ(G); i++) { for (const r of crew) if (G.S.staffCount(r) === 0) G.E.hire(r); G.T.advanceDays(1); }
  return { ids, notes };
}
function campaignWindowDays(G, def) {
  if (def.kind === 'perk') return G.S.DATA.balance.dinosaur.days_per_year;
  if (def.kind === 'memberships') return DPQ(G) * 4;
  return Math.max(def.days || 1, 14) + 7; // the boost plus a week of after-effects (reputation, members)
}
function campaignRun(G, seed, def, season, buy, copies = 1) {
  return withRng(seed, () => {
    const park = minimalUnlockPark(G, def, season, seed);
    const st = G.S.state;
    const rev0 = st.history.reduce((s, q) => s + G.E.sum(q.revenue), 0) + G.E.sum(st.ledger.revenue);
    const cash0 = st.cash;
    let cost = 0, lock = null;
    if (buy) for (let i = 0; i < copies; i++) { const err = G.E.buyCampaign(def.id); if (err) { lock = err; break; } cost += def.cost; }
    const days = campaignWindowDays(G, def);
    const att0 = st.history.reduce((s, q) => s + q.attendance, 0) + st.ledger.attendance;
    G.T.advanceDays(days);
    const rev1 = st.history.reduce((s, q) => s + G.E.sum(q.revenue), 0) + G.E.sum(st.ledger.revenue);
    const att1 = st.history.reduce((s, q) => s + q.attendance, 0) + st.ledger.attendance;
    return { revenue: rev1 - rev0, attendance: att1 - att0, cost, lock, cash_delta: st.cash - cash0, park: park.ids, notes: park.notes, days };
  });
}
export function scenarioCampaignRoi(G, seeds = [1, 2, 3, 4, 5]) {
  const seasons = [0, 1, 2, 3];
  const rows = [];
  const perDollar = {};
  for (const def of G.S.campaignDefs()) {
    const copies = def.stack ? Math.min(3, G.S.DATA.balance.marketing.stack_max || 3) : 1;
    const cells = [];
    let lock = null;
    for (const season of seasons) for (const seed of seeds) {
      const w = campaignRun(G, seed, def, season, true, copies), wo = campaignRun(G, seed, def, season, false, copies);
      if (w.lock) lock = w.lock;
      cells.push({ season: G.S.DATA.balance.time.seasons[season], seed, gain: w.revenue - wo.revenue, cost: w.cost, roi: w.revenue - wo.revenue - w.cost, attendance_gain: w.attendance - wo.attendance, days: w.days, park: w.park });
    }
    const roiAvg = mean(cells.map(c => c.roi)), gainAvg = mean(cells.map(c => c.gain)), costAvg = mean(cells.map(c => c.cost));
    const bySeason = seasons.map(s => ({ season: G.S.DATA.balance.time.seasons[s], roi: money(mean(cells.filter(c => c.season === G.S.DATA.balance.time.seasons[s]).map(c => c.roi))) }));
    perDollar[def.id] = costAvg ? gainAvg / costAvg : 0;
    rows.push({ id: def.id, name: def.name, kind: def.kind, cost: def.cost, copies, unlock: JSON.stringify(def.unlock || {}), park: cells[0].park.join('+'), days: cells[0].days, lock, gain_avg: money(gainAvg), cost_avg: money(costAvg), roi_avg: money(roiAvg), per_dollar: r2(perDollar[def.id]), by_season: bySeason, worst_season: Math.min(...bySeason.map(b => b.roi)), pass: !lock && roiAvg >= 0 });
  }
  const social = perDollar.social_campaign || 0, tv = perDollar.tv_spot || 0;
  const stackRatio = tv > 0 ? social / tv : null;
  return { rows, social_per_dollar: r2(social), tv_per_dollar: r2(tv), stack_ratio: stackRatio == null ? null : r2(stackRatio), pass: rows.every(r => r.pass) && (stackRatio == null || stackRatio <= 2) };
}

// ---- (i) breakouts ----
function breakoutPark(G, pens, staff) {
  G.S.newGame('standard');
  const st = G.S.state;
  st.cash += 1000000;
  const notes = [];
  const P = penParcels(G, pens.length, 1);
  pens.forEach((pen, i) => {
    let err = G.E.buyParcel(P[i].id, pen.biome); if (err) notes.push(err);
    err = G.E.buildFence(P[i].id, pen.tier); if (err) notes.push(err);
    for (const id of pen.species) G.E.addDino(P[i].id, id); // addDino skips the fence check on purpose: under-fencing is the test
  });
  for (const r of staff) G.E.hire(r);
  st.ticket_price = 5;
  stockAndAutoRestock(G, 60);
  return { parcels: P.map(p => p.id), notes };
}
function countEscapes(G, days, keepStaff = []) {
  const st = G.S.state;
  const dpq = DPQ(G);
  const perQuarter = [];
  let last = 0, rehired = 0, minCondition = 100;
  for (let i = 0; i < days && !st.game_over; i++) {
    // "with maintenance" means the role stays filled: a walkout event empties it, the owner rehires (a real player would).
    for (const r of keepStaff) if (G.S.staffCount(r) === 0 && !G.E.hire(r)) rehired++;
    G.T.advanceDays(1);
    for (const p of G.S.enclosures()) minCondition = Math.min(minCondition, p.enclosure.condition);
    if ((st.day - 1) % dpq === 0) { perQuarter.push((st.stats.escapes || 0) - last); last = st.stats.escapes || 0; }
  }
  if (days % dpq !== 0) perQuarter.push((st.stats.escapes || 0) - last);
  return { total: st.stats.escapes || 0, per_quarter: perQuarter, rehired, min_condition: r1(minCondition) };
}
export function scenarioBreakouts(G, seeds = [1, 2, 3, 4, 5]) {
  const year = G.S.DATA.balance.dinosaur.days_per_year;
  const lowDangerShort = G.S.DATA.dinosaurs.species.filter(s => s.min_fence_tier >= 2).sort((a, b) => a.danger_level - b.danger_level || a.shop_price - b.shop_price)[0];
  const bigCarnivore = G.S.DATA.dinosaurs.species.filter(s => s.diet !== 'herbivore').sort((a, b) => b.danger_level - a.danger_level || b.shop_price - a.shop_price)[0];
  const adequateSp = G.S.DATA.dinosaurs.species.find(s => s.id === 'velociraptor') || lowDangerShort;
  const cases = [
    { key: 'adequate', name: `adequate fence: ${adequateSp.name} (danger ${adequateSp.danger_level}) behind ${G.S.fenceByTier(adequateSp.min_fence_tier).name}, maintenance`, target: '0 per year', pens: [{ biome: biomeFor(G, adequateSp), tier: adequateSp.min_fence_tier, species: [adequateSp.id] }], staff: ['maintenance'], days: year, judge: r => r.total === 0 },
    { key: 'short', name: `low-danger species one tier short: ${lowDangerShort.name} (danger ${lowDangerShort.danger_level}, needs ${G.S.fenceByTier(lowDangerShort.min_fence_tier).name}) in ${G.S.fenceByTier(lowDangerShort.min_fence_tier - 1).name}, no staff`, target: '<= 1 per year (mean over seeds)', pens: [{ biome: biomeFor(G, lowDangerShort), tier: lowDangerShort.min_fence_tier - 1, species: [lowDangerShort.id] }], staff: [], days: year, judge: null },
    { key: 'trex_wood', name: `large carnivore in wood: ${bigCarnivore.name} (danger ${bigCarnivore.danger_level}, needs ${G.S.fenceByTier(bigCarnivore.min_fence_tier).name})`, target: '>= 1 per quarter', pens: [{ biome: biomeFor(G, bigCarnivore), tier: 1, species: [bigCarnivore.id] }], staff: [], days: year, judge: r => r.per_quarter.every(q => q >= 1) }
  ];
  const out = [];
  for (const c of cases) {
    const runs = seeds.map(seed => withRng(seed, () => { const p = breakoutPark(G, c.pens, c.staff); const r = countEscapes(G, c.days, c.staff); return { seed, ...r, notes: p.notes, alive: G.S.allDinos().length, rehired: r.rehired }; }));
    const meanTotal = mean(runs.map(r => r.total));
    const pass = c.judge ? runs.every(c.judge) : meanTotal <= 1;
    out.push({ key: c.key, name: c.name, target: c.target, runs, mean_per_year: r2(meanTotal), pass });
  }
  // Electrified + maintenance holds every species: the whole roster spread over electrified pens (plains and marsh so
  // the required-biome species fit), enough maintenance for full coverage, one year, zero escapes.
  const all = G.S.DATA.dinosaurs.species.slice().sort((a, b) => b.space_required - a.space_required);
  const per = G.S.DATA.balance.parcel.space_per_tile;
  const runsAll = seeds.map(seed => withRng(seed, () => {
    G.S.newGame('standard');
    const st = G.S.state;
    st.cash += 5000000;
    const P = penParcels(G, 8, 3);
    const pens = P.map((d, i) => ({ id: d.id, biome: i % 2 === 0 ? 'plains' : 'marsh', cap: d.tiles.length * per, used: 0 }));
    for (const pen of pens) { G.E.buyParcel(pen.id, pen.biome); G.E.buildFence(pen.id, 4); }
    const placed = [], unplaced = [];
    for (const sp of all) {
      const pen = pens.find(p => p.used + sp.space_required <= p.cap && G.E.biomeAllows(st.parcels[p.id], sp));
      if (!pen) { unplaced.push(sp.id); continue; }
      G.E.addDino(pen.id, sp.id); pen.used += sp.space_required; placed.push(sp.id);
    }
    const needed = Math.ceil(G.S.enclosures().length / G.S.roleById('maintenance').pens_per_worker);
    for (let i = 0; i < needed; i++) G.E.hire('maintenance');
    st.ticket_price = 5;
    stockAndAutoRestock(G, 60);
    const r = countEscapes(G, year);
    const minCond = Math.min(...G.S.enclosures().map(p => p.enclosure.condition));
    return { seed, ...r, placed: placed.length, unplaced, maintenance: needed, min_condition_end: r1(minCond), alive: G.S.allDinos().length };
  }));
  out.push({ key: 'electrified', name: `electrified + maintenance holds every species (${all.length} species over ${runsAll[0].maintenance * 3} pens max)`, target: '0 per year', runs: runsAll, mean_per_year: r2(mean(runsAll.map(r => r.total))), pass: runsAll.every(r => r.total === 0 && r.unplaced.length === 0) });
  return { rows: out, pass: out.every(r => r.pass) };
}

// ---- (j) events per quarter on a mid park ----
export function scenarioEvents(G, seed = 1, quarters = 8) {
  return withRng(seed, () => {
    buildGoodPark(G);
    const st = G.S.state;
    st.speed = 10; // above pause_at_speed_max: every incident is written to the daily digest, which is what we count
    const titles = new Map(G.S.DATA.events.events.map(e => [e.title, e]));
    const seen = new WeakSet();
    const rows = [];
    for (let q = 0; q < quarters; q++) {
      const c = { negative: 0, averted: 0, positive: 0 };
      for (let i = 0; i < DPQ(G); i++) {
        G.T.advanceDays(1);
        for (const e of st.digest || []) {
          if (seen.has(e)) continue;
          seen.add(e);
          const ev = titles.get(e.title);
          if (!ev) continue;
          if (ev.type === 'positive') c.positive++;
          else { c.negative++; if (e.averted) c.averted++; }
        }
      }
      rows.push({ quarter: G.S.quarterLabel(q), ...c, applied: c.negative - c.averted });
    }
    st.speed = 0;
    const negMean = mean(rows.map(r => r.negative)), posMean = mean(rows.map(r => r.positive));
    return { name: 'events per quarter (GOOD park)', seed, rows, negative_mean: r2(negMean), negative_max: Math.max(...rows.map(r => r.negative)), applied_mean: r2(mean(rows.map(r => r.applied))), positive_mean: r2(posMean), positive_min: Math.min(...rows.map(r => r.positive)), pass: negMean <= 3 && posMean >= 1 };
  });
}

// ---- (l) max-growth reinvestor ----
// A greedy bot that always reinvests every dollar into the highest-return option, buying land, fencing, dinosaurs,
// facility upgrades, and marketing as fast as possible. 5 seeds, 5 years (20 quarters).
// Acceptance: net worth at end of year 4 < $1.5M, all 8 spend prizes not before year 3, concessions <= 50% of revenue.
export function scenarioMaxGrowthReinvestor(G, seed = 1, { mode = 'standard', quarters = 20 } = {}) {
  return withRng(seed, () => {
    G.S.newGame(mode);
    const st = G.S.state;
    const notes = [];
    const dpq = DPQ(G);
    const qpy = QPY(G);
    const year = d => Math.floor((d - 1) / (dpq * qpy)) + 1;

    // --- day-1 setup: minimal start (same as classic opening) ---
    const p0 = starterParcel(G);
    const sp0 = cheapestStarterHerbivore(G);
    G.E.buyParcel(p0.id, cheapestBiomeId(G));
    G.E.buildFence(p0.id, 1);
    G.E.buyDino(sp0.id, p0.id);
    G.E.buyParkFood('plants', 30);
    G.E.hire('tour_guide');
    st.ticket_price = G.S.DATA.balance.attendance.reference_ticket;
    G.E.setAutoRestock('plants', { on: true, threshold_days: 5, amount: 30 });

    // --- priority queue: the reinvestor builds in ROI order ---
    // Available parcels sorted by cheapest first (tiles ascending, then price).
    const availParcels = () => G.S.parcelDefs().filter(d => !G.S.parcel(d.id).owned)
      .sort((a, b) => a.tiles.length - b.tiles.length || G.E.parcelPrice(a.id) - G.E.parcelPrice(b.id));

    // Cheapest herbivore species not yet owned, in fence tier 1-2 range, sorted by price.
    const availDinos = () => G.S.DATA.dinosaurs.species
      .filter(s => s.diet === 'herbivore' && s.min_fence_tier <= 2 && !G.S.speciesOwned().has(s.id))
      .sort((a, b) => a.shop_price - b.shop_price);

    // Find a pen with room for another dinosaur.
    const penWithRoom = (sp) => {
      for (const p of G.S.enclosures()) {
        const cap = G.E.parcelCapacity(p.id);
        const used = p.enclosure.dinos.reduce((s, d) => s + G.S.speciesById(d.species).space_required, 0);
        if (cap - used >= sp.space_required && G.S.fenceByTier(p.enclosure.fence_tier).tier >= sp.min_fence_tier) return p.id;
      }
      return null;
    };

    // Facility upgrade priority: parking > food > gift > restrooms > tram > office > visitor_center > vet_clinic.
    const facOrder = ['parking_lot', 'food_stand', 'gift_shop', 'restrooms', 'park_tram', 'office', 'visitor_center', 'vet_clinic'];
    const nextFac = () => {
      for (const id of facOrder) {
        const next = G.S.facilityNextTier(id);
        if (next) return { id, cost: next.cost, tier: next.tier };
      }
      return null;
    };

    // Staff needed: one concessions per open concession store, tour_guide until 2, maintenance, vet, management.
    const staffNeeds = () => {
      const needs = [];
      const stores = G.A.concessionStores ? G.A.concessionStores().length : 0;
      const concNeeded = Math.max(0, stores - G.S.staffCount('concessions'));
      for (let i = 0; i < concNeeded; i++) needs.push('concessions');
      if (G.S.staffCount('tour_guide') < 2) needs.push('tour_guide');
      if (G.S.staffCount('maintenance') < 1) needs.push('maintenance');
      if (G.S.staffCount('veterinary') < 1) needs.push('veterinary');
      if (G.S.staffCount('management') < 1 && G.S.facilityTier('office') > 0) needs.push('management');
      if (G.S.staffCount('maintenance') < 2 && G.S.enclosures().length >= 4) needs.push('maintenance');
      if (G.S.staffCount('tour_guide') < 3 && G.S.enclosures().length >= 5) needs.push('tour_guide');
      return needs;
    };

    // The reinvestor greedily invests every quarter it has cash.
    const invest = () => {
      let acted = true, guard = 0;
      while (acted && !st.game_over && guard++ < 60) {
        acted = false;

        // Hire needed staff first (cheap and immediately productive).
        for (const role of staffNeeds()) {
          if (st.cash < 2000) break;
          if (!G.E.hire(role)) { acted = true; break; }
        }

        // Buy a facility upgrade if affordable.
        const fac = nextFac();
        if (fac && st.cash >= fac.cost + 2000) {
          if (!G.E.upgradeFacility(fac.id)) { acted = true; continue; }
        }

        // Buy a new parcel + fence + cheapest available dino.
        const parcels = availParcels();
        const dinos = availDinos();
        if (parcels.length && dinos.length) {
          const pd = parcels[0];
          const sp = dinos[0];
          const biome = biomeFor(G, sp);
          const cost = G.E.parcelPrice(pd.id, biome) + G.E.fenceCost(Math.max(1, sp.min_fence_tier), pd.id) + sp.shop_price;
          if (st.cash >= cost + 2000) {
            const err1 = G.E.buyParcel(pd.id, biome);
            if (!err1) {
              G.E.buildFence(pd.id, Math.max(1, sp.min_fence_tier));
              G.E.buyDino(sp.id, pd.id);
              G.E.plantSeeds(pd.id, G.E.seedsToPlant(pd.id));
              acted = true;
              continue;
            }
          }
        }

        // Fill an existing pen with another dino of a new species.
        for (const sp of availDinos()) {
          const pid = penWithRoom(sp);
          if (pid && st.cash >= sp.shop_price + 1000) {
            if (!G.E.buyDino(sp.id, pid)) { acted = true; break; }
          }
        }

        // Marketing: launch memberships, then the strongest boost.
        const mem = G.S.campaignById('memberships');
        if (mem && !st.members.active && !G.E.campaignLock(mem) && st.cash >= mem.cost + 1000) {
          if (!G.E.buyCampaign('memberships')) { acted = true; continue; }
        }
        for (const id of ['tv_spot', 'radio', 'flyers']) {
          const def = G.S.campaignById(id);
          if (!def || G.E.campaignLock(def) || st.cash < def.cost + 1000) continue;
          if (G.E.activeCampaigns().some(c => c.kind === 'boost')) break;
          if (!G.E.buyCampaign(id)) { acted = true; break; }
        }

        // If nothing else to do, try to upgrade the ticket price toward $7.
        if (!acted && st.ticket_price < 7 && st.day > dpq * 2) {
          st.ticket_price = Math.min(7, st.ticket_price + 1);
          acted = true;
        }
      }
    };

    // Update food auto-restock as the herd grows.
    const updateRestock = () => {
      for (const row of G.E.foodDays()) {
        if (row.need <= 0) continue;
        const amount = Math.max(30, Math.ceil(row.need * 30));
        G.E.setAutoRestock(row.food.id, { on: true, threshold_days: 5, amount });
      }
    };

    // Run the sim.
    const yearSnaps = [];
    let totalConcessions = 0, totalRevenue = 0;
    const quartersRows = runQuarters(G, quarters, day => {
      if (day % dpq === 1) { invest(); updateRestock(); }
    });
    // Collect revenue breakdown from history.
    for (const h of st.history || []) {
      totalConcessions += h.revenue.concessions || 0;
      totalRevenue += G.E.sum(h.revenue);
    }
    // Also scan the quarterly rows for year-end snapshots.
    for (let y = 1; y <= 5; y++) {
      const qi = y * qpy - 1; // index into quartersRows
      if (qi < quartersRows.length) yearSnaps.push({ year: y, ...quartersRows[qi] });
    }

    // Spend prizes.
    const spendPrizes = G.S.prizeDefs().filter(p => p.threshold != null);
    const prizeDays = spendPrizes.map(p => {
      const e = (st.prizes || []).find(x => x.id === p.id);
      return { id: p.id, name: p.name, threshold: p.threshold, day: e ? e.day : null, year: e ? year(e.day) : null };
    });
    const earned = prizeDays.filter(p => p.day != null);
    const earlyPrizes = earned.filter(p => p.year < 3);
    const concessionShare = totalRevenue > 0 ? totalConcessions / totalRevenue : 0;

    // Year 4 end snapshot.
    const y4 = yearSnaps.find(y => y.year === 4);
    const nwY4 = y4 ? y4.net_worth : money(G.E.netWorth());

    return {
      name: 'max-growth reinvestor', seed, mode, notes,
      quarters: quartersRows,
      year_snaps: yearSnaps,
      net_worth_y4: nwY4,
      concession_share: r2(concessionShare),
      prizes: prizeDays,
      prizes_earned: earned.length,
      prizes_total: spendPrizes.length,
      early_prizes: earlyPrizes.length,
      parcels_owned: G.S.parcelList().filter(p => p.owned).length,
      species: G.S.speciesOwned().size,
      dinos: G.S.allDinos().length,
      cash_end: money(st.cash),
      game_over: st.game_over,
      // Acceptance: net worth yr4 < $1.5M, not all 8 spend prizes completed before yr3, concessions <= 50% of revenue.
      pass: nwY4 < 1500000 && earlyPrizes.length < spendPrizes.length && concessionShare <= 0.50
    };
  });
}

// ============================================================================================================
// The whole suite
// ============================================================================================================
const yieldFrame = () => new Promise(r => setTimeout(r, 0));
export async function runAll(G, seeds = [1, 2, 3, 4, 5], onProgress = () => {}) {
  const step = async (label, fn) => { onProgress(label); await yieldFrame(); const t0 = performance.now(); const r = fn(); onProgress(`${label} done in ${((performance.now() - t0) / 1000).toFixed(1)} s`); await yieldFrame(); return r; };
  const modes = G.S.modeIds ? G.S.modeIds() : Object.keys(G.S.DATA.difficulty.modes);
  const res = {};
  res.classic = await step('(a) classic opening', () => seeds.map(s => scenarioClassic(G, s)));
  res.overspend = await step('(b) slow bleed', () => seeds.map(s => scenarioSlowBleed(G, s)));
  res.fed = await step('(c) slow bleed, fed', () => seeds.map(s => scenarioSlowBleed(G, s, { feed: true })));
  res.seeds = await step('(d)/(k) seeds', () => seeds.slice(0, 3).map(s => scenarioSeedsAll(G, s)));
  res.facility_roi = await step('(e) facility ROI', () => scenarioFacilityRoi(G, seeds));
  res.prizes = await step('(f) prize pacing', () => seeds.map(s => scenarioGoodRunPolicy(G, s)));
  res.members_good = await step('(g) memberships, good rating', () => seeds.map(s => scenarioMemberships(G, s)));
  res.members_poor = await step('(g) memberships, poor rating', () => seeds.map(s => scenarioMemberships(G, s, { poor: true })));
  res.campaigns = await step('(h) campaign ROI', () => scenarioCampaignRoi(G, seeds));
  res.breakouts = await step('(i) breakouts', () => scenarioBreakouts(G, seeds));
  res.events = await step('(j) events', () => seeds.map(s => scenarioEvents(G, s)));
  res.diff_classic = {};
  res.diff_bleed = {};
  for (const m of modes) {
    res.diff_classic[m] = await step(`difficulty: classic opening on ${m}`, () => seeds.map(s => scenarioClassic(G, s, { mode: m })));
    res.diff_bleed[m] = await step(`difficulty: slow bleed on ${m}`, () => seeds.map(s => scenarioSlowBleed(G, s, { mode: m })));
  }
  res.played_well = await step('difficulty: Classic, played well', () => seeds.map(s => scenarioClassicPlayedWell(G, s, 'classic')));
  res.reinvestor = await step('(l) max-growth reinvestor', () => seeds.map(s => scenarioMaxGrowthReinvestor(G, s)));
  G.S.newGame('standard');

  const allPass = arr => arr.every(r => r.pass);
  const mostPass = (arr, n = 4) => arr.filter(r => r.pass).length >= n;
  res.classic_pass = allPass(res.classic);
  res.overspend_pass = allPass(res.overspend);
  res.fed_pass = true;
  res.seeds_pass = allPass(res.seeds);
  const seedRow = b => res.seeds.map(r => r.rows.find(x => x.biome === b)).filter(Boolean);
  const modeRow = (obj, m) => obj[m] || [];
  res.summary = [
    { key: 'a', name: '(a) Classic opening, Standard', target: 'year 1 ends with cash > 0, no default', result: res.classic.map(r => fmtInt(r.cash_end)).join(' / '), pass: res.classic_pass },
    { key: 'b', name: '(b) Slow bleed, Standard', target: 'forecloses inside 2 years with a cause', result: res.overspend.map(r => (r.game_over ? `day ${r.day_end}` : 'solvent')).join(' / '), pass: res.overspend_pass },
    { key: 'c', name: '(c) Slow bleed, fed (informational)', target: 'no gate', result: res.fed.map(r => (r.game_over ? 'forecloses' : 'survives')).join(' / '), pass: true },
    { key: 'k', name: '(d)/(k) Seeds: marsh / plains / desert saving', target: '>= 40% / >= 25% / >= 10%', result: ['marsh', 'plains', 'desert'].map(b => `${b} ${seedRow(b).map(r => `${Math.round(r.saving * 100)}%`).join('/')}`).join(' · '), pass: res.seeds_pass },
    { key: 'e', name: '(e) Facility ROI', target: 'every tier pays back within 6 quarters on its reference park', result: `${res.facility_roi.rows.filter(r => r.pass).length}/${res.facility_roi.rows.length} tiers pay back${res.facility_roi.rows.filter(r => !r.pass).length ? `; failing: ${res.facility_roi.rows.filter(r => !r.pass).map(r => `${r.name} ${r.label}`).join(', ')}` : ''}`, pass: res.facility_roi.pass },
    { key: 'f', name: '(f) Prize pacing (good run)', target: 'one per 1-2 quarters; all 8 by end of Y4; last not before Y3', result: res.prizes.map(r => `${r.earned}/${r.total}${r.last_day ? ` last day ${r.last_day} (Y${r.last_year})` : ''} gap ${r.gap_quarters_avg}q`).join(' / '), pass: allPass(res.prizes) },
    { key: 'g1', name: '(g) Memberships, good rating', target: 'members 15-35% of revenue over 8 quarters', result: res.members_good.map(r => `${Math.round(r.share * 100)}%`).join(' / '), pass: allPass(res.members_good) },
    { key: 'g2', name: '(g) Memberships, poor rating', target: 'members near zero (<= 10% of peak) within 3 quarters', result: res.members_poor.map(r => `${r.peak}→${r.members_end}`).join(' / '), pass: allPass(res.members_poor) },
    { key: 'h', name: '(h) Campaign ROI at unlock', target: 'no negative expected ROI; social per $ <= 2x TV', result: `${res.campaigns.rows.map(r => `${r.name} ${r.roi_avg >= 0 ? '+' : ''}${fmtInt(r.roi_avg)}`).join(', ')}; social/TV per $ ${res.campaigns.stack_ratio}x`, pass: res.campaigns.pass },
    { key: 'i', name: '(i) Breakouts', target: 'adequate 0; low-danger short <= 1/yr; big carnivore in wood >= 1/q; electrified + maintenance 0', result: res.breakouts.rows.map(r => `${r.key} ${r.mean_per_year}/yr`).join(' · '), pass: res.breakouts.pass },
    { key: 'j', name: '(j) Events, mid park', target: '<= 3 negative per quarter (mean), >= 1 positive', result: res.events.map(r => `neg ${r.negative_mean} pos ${r.positive_mean}`).join(' / '), pass: allPass(res.events) },
    ...modes.map(m => ({ key: `d-${m}`, name: `Classic opening on ${m}`, target: m === 'classic' ? 'forecloses or ends year 1 negative (>= 4/5 seeds)' : m === 'relaxed' ? 'clearly positive' : 'positive', result: modeRow(res.diff_classic, m).map(r => (r.game_over ? `day ${r.day_end} FORECLOSED` : fmtInt(r.cash_end))).join(' / '), pass: m === 'classic' ? mostPass(modeRow(res.diff_classic, m)) : allPass(modeRow(res.diff_classic, m)) })),
    { key: 'd-well', name: 'Classic, played well', target: 'survives year 1 on Classic (>= 4/5 seeds)', result: res.played_well.map(r => (r.game_over ? `day ${r.day_end} FORECLOSED` : fmtInt(r.cash_end))).join(' / '), pass: mostPass(res.played_well) },
    ...modes.map(m => ({ key: `b-${m}`, name: `Slow bleed on ${m}`, target: m === 'relaxed' ? 'never forecloses; Bank warning shows' : 'forecloses inside 2 years', result: modeRow(res.diff_bleed, m).map(r => (r.game_over ? `day ${r.day_end}` : `solvent${r.bank && r.bank.warning ? `, warning from day ${r.warning_day}` : ''}`)).join(' / '), pass: allPass(modeRow(res.diff_bleed, m)) })),
    { key: 'l', name: '(l) Max-growth reinvestor', target: 'NW yr4 < $1.5M; not all 8 prizes before yr3; concessions <= 50%', result: res.reinvestor.map(r => `NW ${fmtInt(r.net_worth_y4)} conc ${Math.round(r.concession_share * 100)}% early ${r.early_prizes}/${r.prizes_total}`).join(' / '), pass: allPass(res.reinvestor) }
  ];
  res.pass = res.summary.every(r => r.pass);
  return res;
}

// Human-readable report.
export function formatReport(res) {
  const out = [];
  const table = rows => rows.map(r => `      ${r.quarter.padEnd(10)} cash ${String(r.cash).padStart(8)}  debt ${String(r.debt).padStart(7)}  att ${String(r.attendance).padStart(6)}  rev ${String(r.revenue).padStart(7)}  exp ${String(r.expenses).padStart(7)}  profit ${String(r.profit).padStart(8)}`);
  const P = r => (r.pass ? 'PASS' : 'FAIL');
  out.push('(a) CLASSIC OPENING — year 1 must end with cash above zero and no default');
  out.push(`    ${res.classic[0].setup}`);
  for (const r of res.classic) {
    out.push(`    seed ${r.seed}: cash ${r.cash_end}, debt ${r.debt_end}, dinos ${r.dinos_alive}, ${r.restocks} food restocks (${r.restock_failed} unaffordable) — ${P(r)}`);
    if (r.notes.length) out.push(`      notes: ${r.notes.join(' | ')}`);
    out.push(...table(r.quarters));
  }
  out.push('');
  out.push('(b) SLOW BLEED — all six staff + one marquee dinosaur on day 1, $5 ticket, nothing else: must foreclose inside two years with a stated cause');
  out.push(`    ${res.overspend[0].setup}`);
  for (const r of res.overspend) {
    out.push(`    seed ${r.seed}: day ${r.day_end}, cash ${r.cash_end}, debt ${r.debt_end}, dinos alive ${r.dinos_alive}, staff left ${r.staff_end} — ${r.game_over ? `FORECLOSED (${r.cause})` : 'still solvent'} — ${P(r)}`);
    out.push(`      day 1, bank money only: ${r.bought_day_1.join(', ') || 'nothing'}`);
    if (r.unfunded.length) out.push(`      refused by the debt cap: ${r.unfunded.join(', ')}`);
    out.push(...table(r.quarters));
  }
  out.push('');
  out.push('(c) SLOW BLEED, FED — same day 1, but the pen is kept stocked (informational)');
  for (const r of res.fed) out.push(`    seed ${r.seed}: day ${r.day_end}, cash ${r.cash_end}, debt ${r.debt_end}, dinos alive ${r.dinos_alive}, staff left ${r.staff_end}, ${r.topups} food top-ups — ${r.game_over ? `FORECLOSED (${r.cause})` : 'still solvent'}`);
  out.push('');
  out.push('(d)/(k) SEEDS -> VEGETATION — 4-tile pen, two starter herbivores, 360 days, unseeded vs fully planted (marsh >= 40%, plains >= 25%, desert >= 10%)');
  for (const r of res.seeds || []) {
    out.push(`    seed ${r.seed}: ${P(r)}`);
    for (const row of r.rows) {
      const u = row.unseeded, s = row.seeded;
      out.push(`      ${row.biome.padEnd(7)} ${u.parcel} (${u.tiles} tiles, 2x ${u.species}): unseeded bought ${String(u.plants_bought).padStart(4)} plants (${fmtInt(u.plant_cost)}) · seeded bought ${String(s.plants_bought).padStart(4)} (${fmtInt(s.plant_cost)}) + seeds ${fmtInt(s.seed_cost)} · saving ${Math.round(row.saving * 100)}% (target ${Math.round(row.target * 100)}%), net ${fmtInt(row.net_dollars)} · growth ${s.growth_per_day}/day, grazed ${s.grazed}, dinos alive ${s.dinos_alive}/${u.dinos_alive} — ${row.pass ? 'ok' : 'FAIL'}`);
    }
  }
  if (res.facility_roi) {
    out.push('');
    out.push(`(e) FACILITY ROI — each tier vs the tier below on its reference park (GOOD: 3 pens / 4 dinos / 4 staff / $6, Parking I; BIG: 6 pens / 12 dinos / 9 staff), ${res.facility_roi.quarters} quarters, wealth without the facility's own book value; pays back when the park is >= cost richer`);
    for (const r of res.facility_roi.rows) out.push(`    ${(r.name + ' ' + r.label).padEnd(34)} tier ${r.tier} on ${r.park.padEnd(4)} cost ${fmtInt(r.cost).padStart(8)} upkeep ${String(r.upkeep).padStart(4)}/q  [${r.effect}]  wealth Δ ${fmtInt(r.delta_avg).padStart(9)} (revenue Δ ${fmtInt(r.revenue_delta_avg)}, visitors Δ ${r.attendance_delta_avg})  payback ${r.payback_quarter_avg == null ? 'never' : `${r.payback_quarter_avg} q`} on ${r.seeds_paid_back}/${r.per.length} seeds — ${P(r)}`);
  }
  if (res.prizes) {
    out.push('');
    out.push('(f) PRIZE PACING — scripted good run over 16 quarters: spend prizes about one per 1-2 quarters, all 8 by the end of year 4, the last not before year 3');
    for (const r of res.prizes) {
      out.push(`    seed ${r.seed}: ${r.earned}/${r.total} prizes, store spend ${fmtInt(r.store_spend)}, ${r.steps_done}/${r.steps_total} build steps, ${r.species} species, cash ${fmtInt(r.cash_end)}${r.game_over ? ', FORECLOSED' : ''}, gap avg ${r.gap_quarters_avg} q (max ${r.gap_quarters_max}), last on day ${r.last_day ?? '-'} (year ${r.last_year ?? '-'}) — ${P(r)}`);
      out.push(`      prizes: ${r.prizes.map(p => `${p.name} ${fmtInt(p.threshold)} → ${p.day == null ? 'not earned' : `day ${p.day} (Q${p.quarter})`}`).join(' · ')}`);
      out.push(`      store spend at each quarter close: ${r.spend_by_quarter.map(v => fmtInt(v)).join(', ')}`);
      if (r.notes.length) out.push(`      notes: ${r.notes.slice(0, 6).join(' | ')}`);
    }
  }
  if (res.members_good) {
    out.push('');
    out.push('(g) MEMBERSHIPS — GOOD park + Restroom Block, season pass launched on day 1, 8 quarters: members 15-35% of revenue; then the same park starved with no staff: members near zero within 3 quarters');
    for (const r of res.members_good) out.push(`    good, seed ${r.seed}: share ${Math.round(r.share * 100)}% (${fmtInt(r.member_revenue)} of ${fmtInt(r.revenue)}), peak ${r.peak} members, end ${r.members_end} — ${P(r)}  [${r.rows.map(q => `${q.members}m ${Math.round(q.share * 100)}% ★${q.rating}`).join(' | ')}]`);
    for (const r of res.members_poor) out.push(`    poor, seed ${r.seed}: ${r.peak} members at the turn → ${r.members_end} after 3 starved quarters (${Math.round(r.fraction_left * 100)}% left) — ${P(r)}  [${r.poor_rows.map(q => `${q.members}m churn ${Math.round(q.churn * 100)}% ★${q.rating} dinos ${q.dinos}`).join(' | ')}]`);
  }
  if (res.campaigns) {
    out.push('');
    out.push('(h) CAMPAIGN ROI — smallest park that unlocks each campaign, with vs without, averaged over four season starts and the seeds (perks at a $7 ticket over a year; memberships over four quarters)');
    for (const r of res.campaigns.rows) out.push(`    ${r.name.padEnd(28)} ${fmtInt(r.cost).padStart(7)}${r.copies > 1 ? ` x${r.copies}` : ''} unlock ${r.unlock.padEnd(44)} park ${r.park.padEnd(40)} ${String(r.days).padStart(3)} days: gain ${fmtInt(r.gain_avg).padStart(8)}, ROI ${fmtInt(r.roi_avg).padStart(8)} (${r.by_season.map(b => `${b.season.slice(0, 2)} ${b.roi}`).join(', ')}), ${r.per_dollar} per $ — ${r.lock ? `LOCKED: ${r.lock}` : P(r)}`);
    out.push(`    social stack per dollar ${res.campaigns.social_per_dollar} vs TV ${res.campaigns.tv_per_dollar}: ${res.campaigns.stack_ratio}x (must be <= 2x)`);
  }
  if (res.breakouts) {
    out.push('');
    out.push('(i) BREAKOUTS — one year each');
    for (const r of res.breakouts.rows) out.push(`    ${r.name}: target ${r.target}; escapes per seed ${r.runs.map(x => `${x.total}${x.per_quarter ? ` [${x.per_quarter.join(',')}]` : ''}`).join(' / ')} (mean ${r.mean_per_year}/yr; min fence condition ${r.runs.map(x => x.min_condition).join('/')}; rehired ${r.runs.map(x => x.rehired || 0).join('/')})${r.runs[0].unplaced ? `; unplaced ${r.runs[0].unplaced.join(',') || 'none'}, min condition ${r.runs.map(x => x.min_condition_end).join('/')}` : ''} — ${P(r)}`);
  }
  if (res.events) {
    out.push('');
    out.push('(j) EVENTS — GOOD park, 8 quarters: negative (incl. close calls) <= 3 per quarter on average, positive >= 1');
    for (const r of res.events) out.push(`    seed ${r.seed}: negative mean ${r.negative_mean} (max ${r.negative_max}, applied ${r.applied_mean}), positive mean ${r.positive_mean} (min ${r.positive_min}) — ${P(r)}  [${r.rows.map(q => `${q.negative}-/${q.positive}+`).join(' ')}]`);
  }
  if (res.reinvestor) {
    out.push('');
    out.push('(l) MAX-GROWTH REINVESTOR — always reinvest all cash, 5 years: net worth yr4 < $1.5M, prizes not before yr3, concessions <= 50%');
    for (const r of res.reinvestor) {
      out.push(`    seed ${r.seed}: NW yr4 ${fmtInt(r.net_worth_y4)}, concessions ${Math.round(r.concession_share * 100)}% of revenue, ${r.prizes_earned}/${r.prizes_total} prizes (${r.early_prizes} before yr3), ${r.parcels_owned} parcels, ${r.species} species, ${r.dinos} dinos, cash ${fmtInt(r.cash_end)} — ${P(r)}`);
      out.push(`      prizes: ${r.prizes.map(p => `${p.name} ${fmtInt(p.threshold)} → ${p.day == null ? 'not earned' : `day ${p.day} (Y${p.year})`}`).join(' · ')}`);
      out.push(`      year snapshots: ${r.year_snaps.map(y => `Y${y.year} cash ${fmtInt(y.cash)} NW ${fmtInt(y.net_worth)}`).join(' · ')}`);
    }
  }
  if (res.diff_classic) {
    out.push('');
    out.push('DIFFICULTY — classic opening on every mode (Relaxed clearly positive, Standard positive, Classic forecloses or ends year 1 negative)');
    for (const [m, list] of Object.entries(res.diff_classic)) for (const r of list) out.push(`    ${m.padEnd(9)} seed ${r.seed}: ${r.game_over ? `FORECLOSED day ${r.day_end}` : `cash ${fmtInt(r.cash_end)}`}, year profit ${fmtInt(r.profit_year)}, debt ${fmtInt(r.debt_end)}, dinos ${r.dinos_alive} — ${P(r)}`);
    out.push('    Classic, played well — starter herbivore in a seeded pen + guide + flyers + $5 ticket, second starter in Q2, no marquee: must survive year 1 on Classic');
    out.push(`    ${res.played_well[0].setup}`);
    for (const r of res.played_well) { out.push(`    seed ${r.seed}: ${r.game_over ? `FORECLOSED day ${r.day_end}` : `cash ${fmtInt(r.cash_end)}`}, debt ${fmtInt(r.debt_end)}, dinos ${r.dinos_alive}, flyers ${r.flyers}, restocks ${r.restocks}, second dino ${r.second_dino} — ${P(r)}`); out.push(...table(r.quarters)); }
    out.push('    Slow bleed on every mode (Standard and Classic foreclose inside two years; Relaxed never forecloses, Bank warning instead)');
    for (const [m, list] of Object.entries(res.diff_bleed)) for (const r of list) out.push(`    ${m.padEnd(9)} seed ${r.seed}: ${r.game_over ? `FORECLOSED day ${r.day_end} (${r.cause})` : `solvent on day ${r.day_end}, cash ${fmtInt(r.cash_end)}, over cap ${r.over_cap_quarters} quarters, bank warning ${r.bank && r.bank.warning ? `YES (from day ${r.warning_day})` : 'no'}`} — ${P(r)}`);
  }
  out.push('');
  out.push('RESULT');
  for (const s of res.summary || []) out.push(`    ${(s.pass ? 'PASS' : 'FAIL')}  ${s.name.padEnd(44)} ${s.target.padEnd(60)} ${s.result}`);
  out.push(`OVERALL: ${res.pass ? 'PASS' : 'FAIL'}`);
  return out.join('\n');
}
