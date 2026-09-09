// Economy acceptance runs for M2.6 item 4. Pure driver: it is handed the game's own modules and plays them
// exactly the way the UI does (buyParcel / buildFence / buyDino / buyParkFood / hire / advanceDays), so what it
// measures is the shipped economy, not a copy of it.
//
// Three paths, all required to hold on Standard:
//   (a) classic opening  — one starter herbivore in a wood-fenced small parcel, 30 units of plants, one tour guide,
//                          $5 ticket, nothing else. Year 1 must end with cash above zero and no default.
//   (b) overspend        — the marquee shopping list (three most expensive species, Parking III), a full payroll and
//                          a $20 ticket on day 1, bought with starting cash plus everything the Bank will lend, and
//                          nothing left for food. Must foreclose inside two years, with a stated cause.
//   (c) overspend, fed   — the same day-1 leverage played by an owner who keeps the pen stocked, so the park cannot
//                          fail merely by starving its assets. The $20 ticket has to be the thing that sinks it.
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

// Cheapest parcel that can hold one small herbivore: fewest tiles, then lowest price.
function starterParcel(G) {
  return G.S.parcelDefs()
    .map(d => ({ id: d.id, tiles: d.tiles.length, price: G.E.parcelPrice(d.id) }))
    .sort((a, b) => a.tiles - b.tiles || a.price - b.price)[0];
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
      ['buy land', () => G.E.buyParcel(parcel.id)],
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

// ---- (b) the overspend path ----
// The SPEC's reckless park, set up on day 1: the three marquee species, Parking III, a $20 ticket, one of every
// staff role, and nothing left over for food.
//
// M2.6 fix: the scenario now spends ONLY money the game will actually hand a player — starting cash plus what the
// Bank screen will lend (borrow to the debt cap, exactly as E.borrow enforces it). Nothing is credited past the
// cap, so every state this run reaches is a state a player can reach by clicking, and `unfunded` records the parts
// of the marquee shopping list the bank refused to pay for.
export function scenarioOverspend(G, seed = 1, opts = {}) {
  const hireAll = opts.hireAll !== false;
  return withRng(seed, () => {
    G.S.newGame();
    const st = G.S.state;
    const bought = [], unfunded = [];
    st.ticket_price = G.S.DATA.balance.attendance.max_ticket;

    // Cash for the next purchase, from the bank only. Returns false when the cap will not stretch that far.
    const fund = need => {
      if (st.cash >= need) return true;
      const room = Math.max(0, Math.floor(G.E.debtCap() - st.debt));
      const take = Math.min(room, Math.ceil(need - st.cash));
      if (take > 0) G.E.borrow(take);
      return st.cash >= need;
    };

    const marquee = G.S.DATA.dinosaurs.species.slice().sort((a, b) => b.shop_price - a.shop_price).slice(0, 3);
    const free = () => G.S.parcelDefs().filter(d => !st.parcels[d.id].enclosure).sort((a, b) => a.tiles.length - b.tiles.length || G.E.parcelPrice(a.id) - G.E.parcelPrice(b.id));

    for (const sp of marquee) {
      const spot = free().find(d => d.tiles.length * G.S.DATA.balance.parcel.space_per_tile >= sp.space_required);
      if (!spot) continue;
      if (!st.parcels[spot.id].owned) { if (!fund(G.E.parcelPrice(spot.id))) { unfunded.push(`${sp.name} (no land)`); continue; } G.E.buyParcel(spot.id); }
      if (!fund(G.E.fenceCost(sp.min_fence_tier, spot.id))) { unfunded.push(`${sp.name} (no fence)`); continue; }
      G.E.buildFence(spot.id, sp.min_fence_tier);
      if (!fund(sp.shop_price)) { unfunded.push(`${sp.name} (${fmtInt(sp.shop_price)})`); continue; }
      if (!G.E.buyDino(sp.id, spot.id)) bought.push(`${sp.name} in ${spot.id}`);
    }
    while (G.S.facilityTier('parking_lot') < 3) {
      const next = G.S.facilityNextTier('parking_lot');
      if (!fund(next.cost)) { unfunded.push(`${next.label} (${fmtInt(next.cost)})`); break; }
      if (G.E.upgradeFacility('parking_lot')) break;
      bought.push(next.label);
    }
    // A park this size needs a payroll, and the marquee owner hires one of everything on day 1.
    if (hireAll) for (const r of G.S.DATA.staff.roles) { if (!fund(r.salary_per_month)) { unfunded.push(`${r.name} hire`); continue; } if (!G.E.hire(r.id)) bought.push(`${r.name} hire`); }

    const day1 = bought.slice();
    const quarters = runQuarters(G, G.S.DATA.balance.time.quarters_per_year * 2);
    const years = G.S.DATA.balance.time.days_per_quarter * G.S.DATA.balance.time.quarters_per_year * 2;

    return {
      name: 'overspend',
      setup: `${marquee.map(s => s.name).join(', ')} + Parking III + one of every staff role on day 1, $${st.ticket_price} ticket, no food budget`,
      seed,
      unfunded,
      bought_day_1: day1,
      bought_total: bought,
      quarters,
      cash_end: money(st.cash),
      debt_end: money(st.debt),
      day_end: st.day,
      dinos_alive: G.S.allDinos().length,
      game_over: st.game_over,
      cause: st.game_over ? `${st.game_over.cause.category} ${money(st.game_over.cause.amount)} against ${money(st.game_over.cause.revenue)} of revenue over ${st.game_over.cause.quarters} quarters` : null,
      pass: !!st.game_over && st.day <= years
    };
  });
}

// ---- (c) the overspend path, played by an owner who FEEDS his animals ----
// The playtest-2 failure case: the same day-1 leverage, but the pen is kept stocked, so the park never fails by
// simply starving its assets. Three top-billing species that a concrete fence can legally hold, one pen, every
// parking tier the bank will fund, a $20 ticket, no staff at all. If a $20 ticket is a trap, this must still
// foreclose inside two years; if it is not, this run turns a profit and the run FAILS.
export function scenarioOverspendFed(G, seed = 1) {
  return withRng(seed, () => {
    G.S.newGame();
    const st = G.S.state;
    const bought = [], unfunded = [];
    const TOPUP_TO = 30, TOPUP_BELOW = 12;
    st.ticket_price = G.S.DATA.balance.attendance.max_ticket;

    const fund = need => {
      if (st.cash >= need) return true;
      const room = Math.max(0, Math.floor(G.E.debtCap() - st.debt));
      const take = Math.min(room, Math.ceil(need - st.cash));
      if (take > 0) G.E.borrow(take);
      return st.cash >= need;
    };

    // The three priciest species a concrete (tier 3) fence may legally hold, all in ONE pen.
    const TIER = 3;
    const trio = G.S.DATA.dinosaurs.species.filter(s => s.min_fence_tier <= TIER).sort((a, b) => b.shop_price - a.shop_price).slice(0, 3);
    const space = trio.reduce((n, s) => n + s.space_required, 0);
    const per = G.S.DATA.balance.parcel.space_per_tile;
    const spot = G.S.parcelDefs().filter(d => d.tiles.length * per >= space)
      .sort((a, b) => a.tiles.length - b.tiles.length || G.E.parcelPrice(a.id) - G.E.parcelPrice(b.id))[0];

    if (fund(G.E.parcelPrice(spot.id))) G.E.buyParcel(spot.id); else unfunded.push('land');
    if (fund(G.E.fenceCost(TIER, spot.id))) G.E.buildFence(spot.id, TIER); else unfunded.push('fence');
    for (const sp of trio) { if (!fund(sp.shop_price)) { unfunded.push(`${sp.name} (${fmtInt(sp.shop_price)})`); continue; } if (!G.E.buyDino(sp.id, spot.id)) bought.push(sp.name); }
    while (G.S.facilityTier('parking_lot') < 3) {
      const next = G.S.facilityNextTier('parking_lot');
      if (!fund(next.cost)) { unfunded.push(`${next.label} (${fmtInt(next.cost)})`); break; }
      if (G.E.upgradeFacility('parking_lot')) break;
      bought.push(next.label);
    }

    // A player who feeds his animals: top the pen back up whenever it runs low.
    let topups = 0, topup_failed = 0;
    const feed = () => {
      const enc = st.parcels[spot.id].enclosure;
      if (!enc) return;
      for (const [foodId, ] of Object.entries(G.E.dailyNeed(enc))) {
        if (enc.food[foodId] >= TOPUP_BELOW) continue;
        if (G.E.buyEnclosureFood(spot.id, foodId, TOPUP_TO - enc.food[foodId])) topup_failed++; else topups++;
      }
    };
    feed();
    const quarters = runQuarters(G, G.S.DATA.balance.time.quarters_per_year * 2, feed);
    const years = G.S.DATA.balance.time.days_per_quarter * G.S.DATA.balance.time.quarters_per_year * 2;

    return {
      name: 'overspend (fed)',
      setup: `${trio.map(s => s.name).join(', ')} in one ${G.S.parcelSizeLabel(spot.id)} concrete pen + every parking tier the bank funds, $${st.ticket_price} ticket, no staff, pen restocked below ${TOPUP_BELOW} units`,
      seed, unfunded, bought_day_1: bought, topups, topup_failed,
      quarters,
      cash_end: money(st.cash),
      debt_end: money(st.debt),
      day_end: st.day,
      dinos_alive: G.S.allDinos().length,
      game_over: st.game_over,
      cause: st.game_over ? `${st.game_over.cause.category} ${money(st.game_over.cause.amount)} against ${money(st.game_over.cause.revenue)} of revenue over ${st.game_over.cause.quarters} quarters` : null,
      pass: !!st.game_over && st.day <= years
    };
  });
}

export function runAll(G, seeds = [1, 2, 3, 4, 5]) {
  const classic = seeds.map(s => scenarioClassic(G, s));
  const overspend = seeds.map(s => scenarioOverspend(G, s));
  const fed = seeds.map(s => scenarioOverspendFed(G, s));
  return {
    classic, overspend, fed,
    classic_pass: classic.every(r => r.pass),
    overspend_pass: overspend.every(r => r.pass),
    fed_pass: fed.every(r => r.pass),
    pass: classic.every(r => r.pass) && overspend.every(r => r.pass) && fed.every(r => r.pass)
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
  out.push('(b) OVERSPEND — must foreclose inside two years with a stated cause');
  out.push(`    ${res.overspend[0].setup}`);
  for (const r of res.overspend) {
    out.push(`    seed ${r.seed}: day ${r.day_end}, cash ${r.cash_end}, debt ${r.debt_end}, dinos alive ${r.dinos_alive} — ${r.game_over ? `FORECLOSED (${r.cause})` : 'still solvent'} — ${r.pass ? 'PASS' : 'FAIL'}`);
    out.push(`      day 1, bank money only: ${r.bought_day_1.join(', ') || 'nothing'}`);
    if (r.unfunded.length) out.push(`      refused by the debt cap: ${r.unfunded.join(', ')}`);
    out.push(...table(r.quarters));
  }
  out.push('');
  out.push('(c) OVERSPEND, FED — the same leverage, animals kept fed: must still foreclose inside two years');
  out.push(`    ${res.fed[0].setup}`);
  for (const r of res.fed) {
    out.push(`    seed ${r.seed}: day ${r.day_end}, cash ${r.cash_end}, debt ${r.debt_end}, dinos alive ${r.dinos_alive}, ${r.topups} food top-ups (${r.topup_failed} unaffordable) — ${r.game_over ? `FORECLOSED (${r.cause})` : 'still solvent'} — ${r.pass ? 'PASS' : 'FAIL'}`);
    out.push(`      day 1, bank money only: ${r.bought_day_1.join(', ') || 'nothing'}`);
    if (r.unfunded.length) out.push(`      refused by the debt cap: ${r.unfunded.join(', ')}`);
    out.push(...table(r.quarters));
  }
  out.push('');
  out.push(`RESULT: classic ${res.classic_pass ? 'PASS' : 'FAIL'}, overspend ${res.overspend_pass ? 'PASS' : 'FAIL'}, overspend-fed ${res.fed_pass ? 'PASS' : 'FAIL'}`);
  return out.join('\n');
}
