# Dino Park Sim — build SPEC (Phase 1 core prototype)

Working codename. Final public name is deferred and MUST be original. Full design + economy rationale: `memory/projects/dinopark-recreation-PRD.md` (the PRD is authoritative where this file is silent). Research: `memory/projects/dinopark-recreation-research.md`.

**Hard constraints**
- Original branding only. No name, art, sprites, music, or text from the 1993 title this is inspired by. Real dinosaur species names are fine (factual).
- Client-side only, static files, no build step. Vanilla JS. Canvas for the park grid, DOM/CSS for all menus, stores, dialogs, reports.
- Every balance number lives in `/data/*.json`. Zero hardcoded economy values in JS.
- Desktop-first, fills the browser viewport. Mobile/touch is explicitly waived for Phase 1.
- Placeholder/programmer art is expected in Phase 1 (real pixel art is Phase 3).

## Mechanic (one line)
Turn-based park economics: take a loan → buy land → fence it → buy dinosaurs → hire staff → stock food → set ticket price → advertise → time runs, visitors come, events hit → read the quarterly ledger → repay the loan and grow. Fair-but-real: you can lose, but the game tells you why.

## Time model
- Time advances in **days**. Speed controls: pause / 1× / 3× / 10× (auto-advance) plus a "next day" step button.
- **Quarter = 90 days, Year = 4 quarters** (4 named seasons: Spring, Summer, Fall, Winter — one per quarter).
- Daily: attendance rolls, ticket + concession revenue, food consumed, event checks.
- Monthly (every 30 days): staff salaries paid.
- Quarterly: loan interest + payment, taxes, **Quarterly Report modal** opens automatically.

## Controls
Mouse only (click, hover for tooltips). Keyboard: Space = pause/resume, Esc = close modal, F = fullscreen toggle. No touch requirement.

## Win / lose / restart
- **Lose:** cash below `-debt_cap` for `grace_quarters` consecutive quarters → foreclosure screen (explains the cause: e.g. "Payroll exceeded revenue for 3 quarters"). Restart button → new game without reload.
- **Win milestones** (each fires a celebration modal; game continues as endless sandbox):
  1. Loan fully repaid
  2. Net worth ≥ `net_worth_target`
  3. `species_target` distinct species owned
  4. Park rating reaches 5 stars
- New game starts on Standard difficulty from `data/difficulty.json`.

## Entities
- **Player state:** cash, debt, debt_cap, day, park_rating (1–5), cleanliness (0–100), reputation.
- **Plot:** biome (desert/marsh/plains), owned?, contents = enclosure | building | empty. Grid 6×4 = 24 plots around fixed structures.
- **Enclosure:** fence tier (wood/steel/concrete/electrified), fence condition (0–100), list of dinos, food stock (meat/plants), capacity by `space_required`.
- **Dinosaur:** species (from `data/dinosaurs.json`), health (0–100), age, hunger, individual popularity.
- **Building:** restroom, food_stand, gift_shop, parking_lot, info_center (from `data/buildings.json`).
- **Staff:** role (management/veterinary/maintenance/security/concessions/tour_guide), morale, hired day.
- **Event:** from `data/events.json`, weighted, with mitigation keys.

## Economy (essentials — full tables in the PRD; these values seed `/data`)
- Start: loan $25,000 @ 6% APR, quarterly interest; cash = loan. `debt_cap` scales with park net worth.
- Land: Desert $1,500 · Marsh $2,000 · Plains $2,800 per plot.
- Fences/segment: Wood $150 (str 1) · Steel $400 (2) · Concrete $900 (3) · Electrified $1,800 (4). Quarterly upkeep $20/$40/$70/$150. Each enclosure = 4 segments. Dino `min_fence_tier` > installed tier → escalating breakout chance.
- Staff/mo: Management $2,400 · Veterinary $1,800 · Maintenance $1,400 · Security $1,250 · Concessions $1,100 · Tour Guide $900. Ratios: ~1 maintenance/3 pens, ~1 guide/3 dinos, manager needed past 5 staff.
- Buildings: Restroom $1,000 · Food Stand $5,000 · Gift Shop $7,500 · Parking Lot $10,000 (each lot adds `parking_capacity` visitors/day) · Info Center $2,000.
- Dinosaurs (v1 roster, 10 real species, price ladder scaled ~2× the research anchor): Coelophysis $2,500 · Deinonychus $2,500 · Hypsilophodon $2,000 · Hadrosaurus $7,000 · Allosaurus $8,500 · Ankylosaurus $11,500 · Parasaurolophus $12,000 · Stegosaurus $13,000 · Apatosaurus $17,500 · Tyrannosaurus $22,000. Auction: opening bid = 50% of shop, 3–5 bid rounds vs AI bidders, 20% chance the specimen arrives at reduced health.
- Food: meat $40/unit, plants $15/unit, seeds $8/unit. Each dino eats `food_per_day` units of its diet type. Starving → health drops → dies at 0.
- Attendance/day = `base_demand × appeal_mult × price_factor × season_factor × ad_boost`, capped by `front_gate_capacity + Σ parking_capacity`.
  - appeal_mult from Σ dino popularity (+ variety bonus, + cleanliness/100).
  - price_factor: smooth elasticity around a $5 reference ticket; forgiving.
  - season_factor: Spring 1.0, Summer 1.3, Fall 0.9, Winter 0.6.
  - ad_boost: campaign purchase gives +X% for 30 days.
- Revenue: tickets = price × attendance; concessions = per-visitor spend × attendance × (has food stand/gift shop, has concessions staff).
- Taxes: `tax_rate` on positive quarterly profit.
- Events: negative (escape / illness / staff quits / storm) and positive (media feature / donation / boom weekend). Mitigated by security / vet / management / maintenance respectively.

## Screens & 16:9 layout (fills viewport)
Shell: **top status bar** (Current Capital, debt, date + season, park rating stars, speed controls, fullscreen) · **left toolbar** (Town, Park, Reports, Marketing, Fact Book, Save/Settings) · **main area** · **bottom ticker** (scrolling event/tip messages).
Main area shows one of:
1. **Town Street** (DOM/CSS strip of clickable storefronts): Real Estate · Dino Market · General Store · Employment Office · Bank. Click → opens that store as a modal over the street.
2. **Park view** — **REVISED 2026-09-04:** the default Park screen is the **Living Park** (2.5D oblique animated scene — see the "Living Park view" section at the end of this file; built in M2). The **Park Grid** described here is retained as the **"Buy Land" mode** toggled from the living view: canvas, 6×4 plot grid with fixed structures along the bottom row (Front Gate, Office, Restrooms area). Empty plots show "FOR SALE" markers; click to buy via Real Estate prices. Enclosures show fence tier color, dino markers, food bar. Hover → tooltip. Click enclosure → enclosure panel (feed, upgrade fence, sell dino). (M1 shipped this grid as the only park view; that is expected until M2.)
3. **Real Estate** modal: 3 biome cards with price and blurb; select then click plot.
4. **Dino Market** modal: species grid with price, diet icon, min fence, popularity; "Buy" and "Auction" tabs. Buying requires a valid enclosure (fence ≥ min tier, space).
5. **General Store** modal: tabs Fences / Buildings / Advertising / Food.
6. **Employment Office** modal: 6 role cards with salary, hire/fire, current headcount, morale.
7. **Bank** modal: balance, debt, APR, next payment, borrow more (to cap), repay early.
8. **Reports** modal: quarterly ledger table + 3 line charts (revenue, attendance, expenses, last 8 quarters, canvas-drawn) + park stats.
9. **Marketing** modal: ticket price slider with a live "what-if" attendance/revenue projection; advertising campaigns.
10. **Fact Book**: card per species (real paleontology fact, diet, weight, era).
11. **Settings/Save**: Save / Load / New Game / difficulty (Standard only in Phase 1, others greyed) / sound toggle.
Plus modals: Quarterly Report (auto), Event popup, Enclosure panel, Win milestone, Foreclosure/Game Over, Tutorial hint on first launch (skippable).

## Education layer (tooltips-first)
- Every economic term has a hover tooltip in kid-friendly language: loan, interest, APR, elasticity, seasonality, cash flow, profit, tax, capacity.
- "What-if" projection before big purchases (dino, building, parking, campaign) and on the ticket slider.
- Fact card shown on purchase and in the Fact Book.

## Rendering / viewport
- Root layout is CSS grid filling `100vh × 100vw`, reflows on resize. Minimum 1024×640; below that scale the whole app down via CSS transform rather than clip.
- Park canvas: 640×360 logical, `image-rendering: pixelated`, integer-scaled to the largest multiple that fits the main area, centered, letterboxed.
- Fullscreen toggle via Fullscreen API.

## Save
Entire game state → JSON → `localStorage['dino-park-sim.save']`. Autosave at each quarter. Manual Save/Load in Settings. Versioned with a `save_version` field.

## Asset manifest (Phase 1) — see LICENSES.md
- Programmer art: generated in-code (colored shapes/silhouettes, simple tiles). Ours.
- UI panels/buttons: Kenney UI Pack (CC0) — optional; CSS-drawn is acceptable in Phase 1.
- SFX: jsfxr-generated (click, buy, cash, alert, roar, fanfare). Ours.
- Font: Press Start 2P (SIL OFL 1.1), self-hosted in `/assets/fonts`.

## File layout
```
index.html  style.css  SPEC.md  LATER.md  LICENSES.md
data/   difficulty.json dinosaurs.json biomes.json fences.json staff.json buildings.json food.json events.json balance.json
src/    main.js state.js time.js economy.js attendance.js events.js save.js
        render/park.js render/charts.js
        ui/shell.js ui/town.js ui/stores.js ui/reports.js ui/marketing.js ui/factbook.js ui/settings.js ui/modals.js ui/tooltips.js
assets/ fonts/ sfx/
```


## Living Park view — the hero screen (default Park view)

**Decision (2026-09-04):** the animated living park is the game's hero feature and the default Park screen. The plot grid becomes a **"Buy Land" mode** toggled from the living view (as in the original). Projection: **2.5D oblique** (three-quarter view with wall height and roofed buildings).

### Render architecture (projection-agnostic)
- All world positions are grid coords (plot x,y + sub-tile 0..1 offsets, optional z). One function, `project(x, y, z)` in `src/render/projection.js`, maps world → screen. The sim never touches screen coords, so swapping placeholder art for real iso sprites in Phase 3 is a render-only change.
- Draw order: painter's algorithm by projected depth (y + x), so sprites overlap walls and each other correctly.
- Canvas stays 640×360 logical (consider 960×540 if the oblique scene needs the room), integer-scaled, pixelated.
- Agents update at a fixed 20Hz tick decoupled from the render loop; render interpolates. Target 60fps with ≤200 sprites on screen.

### Scene composition (derived from game state, redrawn on change)
- Owned plots → enclosures: extruded walls whose look reflects fence tier (wood/steel/concrete/electrified) and condition (cracks/gaps when low); dinos inside.
- Buildings on plots (restroom, food stand, gift shop, info center) as roofed oblique boxes; parking lot as a striped lot near the front gate.
- Fixed structures: front gate + parking (bottom edge), office, walkway grid between plots, and a **centerpiece plaza** at the park center (our own design — e.g. a fountain with a dinosaur sculpture; nothing lifted from any commercial title).
- Cleanliness → litter density on walkways.

### Agents (placeholder capsules/blobs in Phase 1; sprites in Phase 3)
- **Visitors:** the day's attendance spawns spread across the day's ticks (a 1× day lasts N real seconds from balance.json). Each visitor: enters from the parking lot/gate, walks the walkway graph to 2–4 points of interest weighted by dinosaur popularity (enclosures), then food stand / gift shop / restrooms, dwells, exits. Waypoint pathing along walkway nodes (walkways form a grid, so Manhattan routing — no A* needed). On-screen cap (e.g. 150) scaled to attendance; overflow is implied, not drawn.
- **Cars:** lot slots = parking capacity ÷ k. Occupancy tracks visitors present; cars pull in with spawns and leave with exits. A bigger lot visibly fills up on busy days.
- **Dinosaurs:** idle/wander within pen bounds, occasional idle animation, size/color by species. Hungry → slower, sick → warning badge. **Escape event** → the dino sprite wanders outside its pen (visitors scatter) until the event resolves — visual only, economy unchanged.
- **Staff (visible feedback):** maintenance sweep litter, tour guides lead visitor clusters, security patrol pen perimeters, vets visit sick pens. Seeing staff work is part of the teaching loop.

### Interaction
- Hover enclosure/building → tooltip; click → the existing enclosure/building panels.
- **"Buy Land"** button switches to the plot-grid overlay over the same scene (the current grid view); Esc / "Back to park" returns.
- Game speed drives agent activity; paused → agents idle in place.

### Milestone placement
- **M2 (revised): Living Park.** Projection module, scene renderer, visitor/car/dino/staff agents, Buy-Land mode toggle, hover/click parity with the grid. Placeholder art.
- **M3: Juice + polish.** SFX (jsfxr), screen feedback, menus, restart flow, remaining screen polish.
- Estimate for M2: ~6–10 supervising hrs, ~2–4M tokens.

### Critic bar additions for M2
- Visitors visibly arrive, walk, dwell at pens, and leave; count rises on busy (summer) days and with a bigger lot.
- Cars appear/depart in proportion; dinos move within pens; escape event shows a loose dino.
- Steady 60fps with ≥150 sprites at 10× speed; zero console errors.
- Depth sorting correct (no sprite drawn through a wall); tooltips/click parity with the grid view.


## Park layout revision — parcels + fixed facilities (M2.5)

**Decision (Peter, 2026-09-05):** purchased land is for dinosaur enclosures ONLY. Parking, restrooms, food stand, gift shop, and office are FIXED structures at set locations that the player UPGRADES in tiers (as in the original). Land parcels are IRREGULAR (varying sizes), not a uniform grid. The "info center" is removed.

### Parcels (`data/parcels.json`)
- Hand-authored map of 14–18 parcels: rectangles of varying size (1×1, 1×2, 2×1, 2×2, a couple of 2×3/3×2) placed around the walkway network and the central plaza. Each: `{ id, x, y, w, h, biome }` in tile units. Biome is authored per parcel (mixed desert/marsh/plains across the map) — flip to single-biome by editing the data if desired.
- Price = `biomes[biome].plot_cost × area_factor(w×h)` (area factor from balance.json, sub-linear so big parcels are a modest discount per tile).
- Enclosure fence cost = `cost_per_segment × perimeter_tiles` (2w + 2h). Capacity = `w × h × space_per_tile` (balance).
- Buy Land mode shows the parcel map (irregular shapes, biome color, price, FOR SALE); click a parcel to buy; the living view renders each parcel at its true footprint. Unowned parcels: faint terrain + sign.
- Walkway network is authored alongside the parcels so every parcel touches a walkway (visitor routing).

### Fixed facilities (`data/facilities.json` replaces `buildings.json`)
Each facility has a fixed world position in the layout and 3 tiers; tier 0 = base (exists at game start), tiers 1–3 purchased in order from the General Store → **Upgrades** tab (replaces the Buildings tab; no placement UI).
| Facility | Location | Effect key | Tiers (cost → effect, tune in data) |
|---|---|---|---|
| Parking Lot | front gate | `parking_capacity` | I $10,000 · II $18,000 · III $30,000 → +150 / +300 / +500 visitors/day |
| Restrooms | near plaza | `satisfaction` / attendance threshold | I $1,000 · II $3,000 · III $6,000 |
| Food Stand → Diner | plaza edge | `concession_spend` | I $5,000 · II $9,000 · III $15,000 |
| Gift Shop | near gate | `concession_spend` | I $7,500 · II $12,000 · III $20,000 |
| Office | fixed | `management_capacity` (optional) | base only in v1; upgrade tiers parked in LATER |
- Upgrade tiers change the rendered building (bigger box / extra roof section) so the park visibly grows.
- Concessions revenue still requires concessions staff; parking still caps attendance; restrooms tier gates satisfaction as before.

### State & save
- `state.plots` (grid) → `state.parcels` (by id, owned/enclosure); `state.facilities = { parking: tier, restrooms: tier, food: tier, gift: tier }`.
- Bump `save_version`; older saves are discarded with a friendly "new park layout" notice (no migration needed in Phase 1).

### Removed / changed
- Buildings-on-plots purchase flow, "Buy & place", info center, the 6×4 grid assumption in render/park.js and render/living.js.
- Real Estate store becomes a map legend + biome info; actual purchase happens on the parcel map.

### Critic bar additions for M2.5
- Land purchase works only on parcels; no way to place a building on land.
- Every facility upgrades in order with the correct cost and visible change; effects reach the economy (parking cap, concession spend, satisfaction).
- Parcels render at their true footprint in both Buy Land and Living views; dinos and visitors respect the new shapes; walkway routing reaches every parcel.
- M1/M2 regressions: full loop, save/load with the new shape, fill-the-browser.

## Playtest round 1 revisions (M2.6) — from Peter's Phase-4 playtest, 2026-09-08

**1. Parcels are tile sets ("tetris"), and the park has no blank land.** Each parcel in `data/parcels.json` becomes `{ id, biome, tiles: [[x,y],...] }` — a connected polyomino, not a w×h rectangle. The park interior (everything that is not walkway, plaza, or facility footprint) must be fully covered by parcels: zero blank interior tiles. At least 5 parcels are non-rectangular (L, T, S/Z, plus, or a long 1×4 next to squares). Derived values: `capacity = tiles.length × space_per_tile`; fence cost/upkeep = `cost_per_segment × outline_edges` (count of tile edges not shared with another tile of the same parcel); price = `biome plot_cost × area_factor(tiles.length)`. Rendering: walls follow the outline edges in both the survey map and the living view; dinos wander within the tile set (not a bounding box); hit-testing and walkway adjacency use the tile set; visitor viewing spots are on outline edges that touch a walkway. Keep `w/h` out of the schema; anything that used them derives from tiles. Old saves are discarded with the existing "re-surveyed" notice.

**2. Breakouts are reserved for large/aggressive species behind an inadequate fence.** In `data/fences.json` breakout rules: when `installed tier ≥ min_fence_tier`, breakout chance is **0** for `danger_level ≤ 2`, and only non-zero for `danger_level ≥ 3` when fence condition is below `low_condition_threshold`. When `installed tier < min_fence_tier`, chance = `base × danger_factor[danger_level] × (min_fence_tier − tier)`, with `danger_factor` ≈ {1: 0.05, 2: 0.15, 3: 0.5, 4: 1.0, 5: 1.4}. Fence condition decays slower and maintenance staff slow it further. Security still reduces chance and severity. Acceptance: a Psittacosaurus in a wood fence never escapes across a game year; a Tyrannosaurus in a wood fence escapes within a quarter; a Tyrannosaurus in an electrified fence with maintenance never escapes across a year.

**3. Normal speed is watchable.** 1× ≈ one game day per **6 real seconds** (`balance.living.day_seconds` / time tick), 3× and 10× stay proportional. Pause/+1 day unchanged.

**4. Standard economy is less punishing (fair-but-real, but fair first).** Tune `data/difficulty.json` / `balance.json` / `staff.json` / `events.json`: APR 6% → 4%; `grace_quarters` 2 → 3; food unit costs −25%; `base_demand` +20%; cleanliness decay halved and scaled by attendance; year-1 staff morale bleed halved and `staff_quit`-type event weights halved; `event_frequency` 0.8. Acceptance (critic-verified): the classic opening — one starter herbivore in a wood-fenced 1×2, 30 units of plants, one tour guide, $5 ticket, nothing else — ends year 1 with cash above zero and the loan not in default; the overspend path (three marquee dinos + Parking III on day 1, $20 ticket) still forecloses within two years with a stated cause.

**5. Facilities** are fine as designed; visuals revisited in Phase 3 (art). No change.

## M3 — Depth & feel (from Peter's playtest 2026-09-09)

**A. Facility depth (`data/facilities.json`).** Deeper ladders, bigger visual change per tier, plus a few facilities the original didn't have. Every tier: cost, upkeep, effect, `render` key so the living view changes visibly.
- **Parking Lot — 5 tiers, large footprint at the front** (widen the forecourt strip to match the original's big lot): 0 Dirt lot (small, brown, no marks) → 1 Gravel (bigger, grey speckle) → 2 Paved (asphalt) → 3 Lined & lit (painted stalls, lamp posts, more rows) → 4 Overflow lot / second lot (second block of stalls or a small garage). Capacity rises each tier; car slots and lot texture change each tier.
- Restrooms 4 tiers (portable → block → tiled block → family pavilion). Food 4 tiers (cart → stand → diner → restaurant, rising concession spend + a satisfaction bump at 3–4). Gift 4 tiers (stand → shop → emporium → museum store). Office 3 tiers (`management_capacity`: staff cap and event mitigation).
- **New facilities (beyond the original), each 2–3 tiers:** Visitor Center (education/appeal bonus; unlocks Fact Book extras), Vet Clinic (illness reduction stacking with vets, faster healing), Park Tram (visitor throughput: raises effective gate capacity and satisfaction on big days). Data-driven; no new mechanics beyond effect keys.

**B. Prizes (`data/prizes.json`).** Awarded at cumulative General Store spend thresholds (all tabs), with a few also tied to milestones (first 5-star quarter, 10 species). Each prize is a decorative park feature drawn in the living view with a small appeal bonus, so a well-run park visibly levels up: welcome banner → flower beds → fancy gate arch → fountain upgrade (the plaza fountain gets 3 looks) → statues → lamp posts → carousel → grand entrance. Award = fanfare toast + ticker + digest entry; a "Park Prizes" panel (from the General Store or Park bar) lists earned and next-threshold prizes. Prizes persist in the save.

**C. Speed/timing in the player's hands.** Settings gains a "Day length at normal speed" control (seconds per day, default from `balance.living.day_seconds`) and an autosave-every-N-days control. No other time changes.

**D. Carry-overs to close in M3:** label collisions with many owned pens (collision-avoid or stack chips); doubled walls where two owned parcels share a boundary (draw shared edges once, higher tier wins); biome colours clearly distinct in both views and the legend; a park with zero live dinosaurs must not profit (attendance needs ≥1 dino; concessions scale with attendance); starving dino gets a slow idle so it doesn't read as frozen; **rewrite the overspend acceptance test** to a reachable slow bleed: hire all six staff roles and buy one marquee dino on day 1 at a $5 ticket with no further income actions → forecloses within 2 years with a stated cause (the old day-1 splurge is unreachable because the debt cap correctly refuses it).

**Acceptance (critics):** every facility tier purchasable in order with a visible change; parking footprint clearly larger and visibly evolving dirt→gravel→paved→lined→overflow; ≥6 prizes awardable by spending, each visible in the living view, listed in the Prizes panel, and restored on load; Settings day-length control changes measured 1× pace; both economy paths (classic opening survives year 1; slow-bleed forecloses) hold; zero console errors; M1–M2.6 regressions clean.

**M4 (next):** sound (jsfxr) + juice + end-game ladder (5-star grand park milestone, year-5 report card).

## M4 — Land, food & marketing (from Peter's playtest 2026-09-10)

**1. FOR SALE markers.** Replace the large price chips on unowned parcels with a small stake/sign sprite; price + size appear on hover (living view) and always in the survey map. Prize decorations must be visible past them.

**2. Biome matters (`data/dinosaurs.json` `biome_affinity` → real mechanic).** Each species has `biomes: { preferred: [...], tolerated: [...] }` derived from the existing affinity data (every species gets ≥1 preferred; a few marquee species are `requires_preferred: true`). Effects (all in `balance.biome`): preferred → popularity ×1.15 and +health regen; tolerated → neutral; wrong → health drifts down slowly, popularity ×0.7, an "unhappy" badge over the dino and a ticker/digest warning; required-and-wrong → the Dino Market/picker refuses. Dino Market cards and the enclosure picker show biome fit against the player's pens (✓ / ~ / ✗). Fact Book lists each species' preferred biome.

**3. Choose the land type at purchase (as in the original).** Parcels in `data/parcels.json` no longer carry a fixed biome; unowned land is neutral (grey-green scrub). On purchase the player picks Desert / Plains / Marsh in the buy dialog; price = that biome's `plot_cost × area_factor`. The chosen biome tints the pen in both views. Add **Re-landscape** to the enclosure panel (change biome for `balance.biome.relandscape_ratio × price`, blocked while a required-biome dino is inside). Validator no longer checks biome mix. Real Estate store = biome guide (what grows, which species prefer it, prices).

**4. Seeds → vegetation (a real food source).** `data/food.json` seeds get `grows: true`. Enclosure panel: **Plant seeds** (N units) → enclosure `vegetation` 0–100 grows daily by `balance.vegetation.growth_per_day[biome]` (marsh fastest, plains normal, desert slowest) up to a cap by pen tiles. Herbivores graze vegetation first (1 unit veg = 1 plant unit), then park stock; grazing lowers vegetation, which regrows. Vegetation draws as greenery density in the pen and adds a small appeal bonus. Over a year, seeded pens must cost measurably less than buying plants (target ~40% saving at marsh, ~15% at desert). Tooltip teaches "investment vs recurring cost".

**5. Food without round trips.** Park-level **auto-restock** rule (in General Store → Food and Settings): when park stock of a food type drops below `threshold` days, buy `amount` units automatically (charged, ticker line, digest); default off. Park bar shows **days of food left** per type and a **Restock** button opening the Food tab pre-filled. Low-food warning at `balance.food.warn_days` (5) before the starving warning.

**6. Modern marketing ladder (`data/campaigns.json`).** Replace the fixed 3 campaigns with a data ladder, each with cost, duration, boost, unlock condition, and a one-line lesson: Flyers → Radio → TV spot → **Social media campaign** (cheap, short, stacks) → **Influencer visit** (one-day attendance spike, needs ≥3 species) → **School field-trip program** (weekday attendance floor, needs Visitor Center; ties to the education prize) → **Online ticketing** (small permanent elasticity boost, one-time) → **Memberships / season pass** (set a pass price; members convert from visitors at a rate driven by satisfaction, pay quarterly, churn on low rating; members raise the daily attendance floor). Marketing view shows the ladder, active campaigns with days left, and a Members panel (count, quarterly revenue, churn). Reports gain a Memberships revenue line and a Marketing spend line.

**7. M3 minors folded in:** forecourt buildings at max tier must not hide each other's labels (stagger/offset); dirt-lot cars never exceed slots; species-count prize fires at purchase.

**Acceptance (critics):** unowned land is neutral and the buy dialog offers all three biomes at correct prices; a required-biome species is refused in the wrong biome, a preferred-biome dino shows the bonus and a wrong-biome dino the unhappy state; seeded marsh pen with 2 herbivores buys ≥40% fewer plants over 360 days than an unseeded one; auto-restock triggers and charges; every campaign purchasable per its unlock, memberships accrue members and quarterly revenue and churn on low rating; FOR SALE markers small with hover price; zero console errors; both economy scenarios still hold; M1–M3 regressions clean.

**M5 (next):** sound (jsfxr) + juice + end-game ladder (grand-park milestone, year-5 report card).

## M5 — Sound, juice & end-game (2026-09-11)

**1. Sound (no external audio files — LICENSES.md stays "ours").** `src/audio.js`: Web Audio, unlocked on first user gesture. SFX generated in code with jsfxr-style parameter synthesis (`data/sfx.json` holds the parameter sets): ui_click, buy (cash register), sell, alert (low food / warning), roar_small / roar_medium / roar_large (on purchase arrival and occasional idle, by species size), prize_fanfare, quarter_chime (report opens), escape_siren, member_ding (member joins), milestone_fanfare, foreclosure_sting. Optional light ambient bed (soft oscillator pad + occasional bird chirp) toggled separately. Settings: master volume, SFX on/off, ambient on/off; persisted in prefs. Nothing plays before the first click. `DPS.sfx(id)` for critics.

**2. Juice.** Button press feedback (scale/flash) on every store button; cash-delta floaters (+$/−$) near the Capital stat on every transaction; star-rating pulse when the rating changes; screen shake + red vignette flash on escape; dino arrival animation (delivery truck at the gate → crate → dino appears in pen, ~3 s); prize placement puff; quarterly report slides in with a stat count-up; toast polish (stack, slide, auto-dismiss); hover lift on Town storefronts. All animations respect `prefers-reduced-motion` and a Settings "Reduce motion" toggle.

**3. End-game ladder.** Win milestones become a visible ladder in a new **Goals** panel (Park bar + Reports): Loan repaid → Net worth target → 10 species → 5-star quarter → **Grand Park** (all facilities at max tier + every spend prize + 5 stars for 4 consecutive quarters; fires once, big fanfare, park gets a "Grand Park" plaque decoration) → **Year-5 Report Card** (opens at the close of year 5, stored in Reports): grades A–F on Profit, Attendance, Dinosaur welfare (avg health, escapes, deaths), Education (Visitor Center tier + fact-book views + school program), and Guest satisfaction, each with a one-line comment; overall grade; "Keep playing" continues endless. Balance thresholds in `balance.goals`. `DPS.goals()` and `DPS.reportCard()` for critics.

**4. M4 minors to close:** (a) seeded pens with a grazer show growth: a per-pen "grazed today / regrowing" readout in the enclosure panel and a minimum visible greenery floor while seeded; (b) days-of-food per pen in the enclosure panel and the low-food warning names the lowest pen, not the park total; (c) locked marketing cards use a disabled grey button, not a green one; (d) species label stacks never sit over walkways/plaza (clamp to pen); (e) forecourt: Visitor Center III must not hide the tram stop (offset/stagger footprints); (f) survey-map legend and help copy readable at 1280×720 (min 12px equivalent).

**5. Tutorial refresh.** Welcome hint and first-quarter tips cover: choose a biome when buying land, seeds save money, auto-restock, the marketing ladder, and the Goals panel. Skippable; never shown twice.

**Acceptance (critics):** every SFX in `data/sfx.json` fires on its trigger via play and via `DPS.sfx`, obeys volume/toggles, and nothing plays before the first gesture; no audio files in the repo; each juice item visible and disabled under Reduce motion; Goals panel lists the ladder with live progress; Grand Park fires once when its conditions are met (drive via DPS) and adds the plaque; Year-5 Report Card opens at day 1800 with data-driven grades and is retrievable from Reports; all six M4 minors closed; zero console errors; both economy scenarios and the seed scenario still hold; M1–M4 regressions clean.
