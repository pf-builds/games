# LATER — ideas parked during the Phase 1 build (not in scope)

Scope discipline: the SPEC is the ceiling. Anything discovered mid-build lands here.

- Relaxed and Classic difficulty modes (Phase 2)
- Real pixel-art pass + style guide (Phase 3)
- Full "learning mode" surfacing the math behind each decision
- Expansion roster: remaining ~28 species from the research list
- Dinosaur breeding / hatchery
- Weather system and disasters
- Mobile/touch layout
- Cloud save / accounts / leaderboards (would need a backend)
- Save export/import as a file

## Parked during Milestone 1 (2026-09-04)
- Drop `PressStart2P-Regular.woff2` (OFL, from the Google Fonts specimen page) into `assets/fonts/` so the font works offline; `@font-face` in style.css already points there. Until then it loads from the Google Fonts stylesheet linked in index.html.
- jsfxr SFX (click, buy, cash, alert, roar, fanfare); Settings sound toggle exists but nothing plays yet
- Balance: early-game staff attrition from `staff_quit` / `staff_quit_poached` events feels harsh with 1-2 staff and no manager
- Balance: cleanliness decays a flat 1/day regardless of visitor count; could scale with attendance
- Maintenance staff could auto-repair fence condition over time instead of only slowing decay
- Reports: per-day attendance sparkline for the current quarter
- Auction: show rival bidder "personalities" and a walk-away hint
- Spec reconciliation: park canvas now scales in 0.5 steps (1, 1.5, 2, 2.5...) with a device-pixel backing store, so 1280x720 gets 1.5x instead of a 1x island. SPEC.md still says "integer-scaled"; update the wording when the spec is next revised.
- Out-of-food warning before the starving one (starving popup exists now; an earlier "enclosure 1 has 2 days of food left" nudge would be friendlier)
- Event popups pile up when many days are skipped at once (debug `advanceDays`); a single digest modal would be cleaner

## Parked during Milestone 2 (2026-09-05)
- Spec reconciliation: the Living Park canvas is 960x540 logical (SPEC allowed it). Scale snaps to 0.5 steps only when that still fills >= `balance.living.fill_min_fraction` of the main area; otherwise it uses the exact fit (1920x1080 lands at ~1.6x). SPEC wording says "integer-scaled".
- Parking lots bought as plot buildings sit inside the park; their cars slide in from the plot's south edge rather than driving from the road. A dedicated parking strip beside the front lot would read better (Phase 3 layout pass).
- Visitors all take the same Manhattan route to a pen, so a busy park forms a visible queue line. Add lane jitter per segment or a second walkway option (route via the other bracketing walkway) for a looser crowd.
- Concessions and management staff are static placeholders (stand at their store / the office door). Give them a small idle loop.
- The agent tick runs from a setInterval watchdog when the tab is hidden (rAF stalls); browsers throttle it to ~1Hz, and each step catches up at most one second. Decide whether a hidden tab should instead freeze and resync on return.
- Living view has no per-agent hover (staff role, visitor state). A small legend for staff colours would help the teaching loop.
- Dino Market and Fact Book fall back to price-quartile tiers when a species has no `tier` field; drop the fallback once the roster is final.
- M1 balance, seen again in M2 testing: with 6 staff and no manager everyone quits within a few months at 10x. Consider a softer first-year morale curve.

## Parked after critic pass 1 (2026-09-05)
- Event modals at 10x cover the Living Park almost continuously (each one pauses the clock). A per-day digest or a "don't pause at 10x, just ticker it" option would keep the hero screen visible.
- Canvas pixel-font text is soft at exact-fit scales (1.59x at 1920x1080, 1.06x at 1280x720) because glyphs land on fractional device pixels. Options: snap the font size to whole device pixels, or draw HUD/sign text in a DOM overlay.
- Status bar Date and Today cells now stack two lines (Day/Season over Year/Quarter, visitors over revenue) so the pixel-font row fits the speed controls at 1280x720 with 7-digit cash. Revisit if the HUD gets more cells.

## Parked during Milestone 2.5 (2026-09-07)
- Office upgrade tiers (`management_capacity` effect key is declared in facilities.json but only the base tier exists; the Upgrades card says so).
- Facility condition / storm damage: fixed facilities carry no condition in M2.5, so the storm event's `building_damage` line is cosmetic. Either drop the key from events.json or give facilities a repair loop.
- Restrooms "attendance threshold" idea from the SPEC table: restrooms only add satisfaction today. A capacity-gated satisfaction penalty (too many visitors per restroom tier) would make the upgrade feel more necessary on busy days.
- Parcel biome affinity: species carry `biome_affinity` in dinosaurs.json but nothing reads it. A small popularity or health bonus for a matching parcel biome would make the mixed-biome map matter.
- Survey map (Buy Land) draws the park only; the front strip is a one-line label bar. A tier-accurate lot and office drawing there would match the living view.
- Litter spawns on any walkway edge, including the forecourt outside the fence (re-rolled up to 6 times); a data flag per walkway (inside/outside) would be cleaner.
- Visitor viewing spots are one per adjacent walkway per parcel; a 3x2 with two long sides still bunches at the side nearest the centre. Weighting spots by side length would spread crowds further.
- Fence upkeep now scales with perimeter (segments_per_enclosure is the reference 1x1 perimeter); the General Store fence table quotes upkeep per 4 segments. Revisit the wording if it confuses playtesters.
- Digest retention is days- and count-based (balance.events.digest_days_kept / digest_max_entries). At 10x a quarter passes in 9 seconds, so consider an "unread since last open" filter instead of pruning.
- Dinosaur labels: large species always, others on pen hover. A per-sprite hover (not per pen) needs sprite hit-testing.
- Balance seen in M2.5 testing: a 500-unit food buy still runs out mid-quarter with 3-4 dinosaurs (2-4 units/day each); the out-of-food warning parked in M1 would help more now that events no longer pause at 10x.
- Spec reconciliation: projection scale moved to data (`parcels.json.projection`, 72x45 px per tile, 12x8.5 tile park) so the wider irregular map fits the 960x540 canvas; SPEC still describes the old 90x56 plot tiles.

## Parked after critic pass 1 on M2.5 (2026-09-08)
- Layout reads as a block plan: every parcel is an axis-aligned rectangle and every walkway is straight and orthogonal, so the park looks like city blocks rather than an organic park. Options for a polish pass: curved or diagonal walkway segments, a few non-rectangular (L-shaped) parcels, planted margins and tree clumps between parcels.
- Foreclosure modal is chained behind the top modal (so the last Quarterly Report is read first); on a debug batch advance several reports stack and the Foreclosure box surfaces after the first Continue. Only reachable via `DPS.advanceDays`; a single digest modal for batch advances would fix it.
- Starving-dinosaur warning now pauses the clock at every speed (`balance.events.pause_kinds`), and it fires every day a dinosaur is starving. If playtesters find the daily popup at 10x tiresome, add a per-enclosure cooldown (e.g. once per 3 days) as a balance key.
- Visitor conga line / viewing-spot bunching is the most visible unfinished tell on the hero screen (already parked under M2: lane jitter or a second route option).

## Parked during Milestone 2.5 critic pass 2 (2026-09-08)
- Marketing view what-if shows projected visitors/day but never the daily cap (front gate + parking). A "Daily cap: N (gate 120 + parking 500)" line would make the parking upgrade legible from Marketing, not just the Upgrades card.
- Foreclosure cause picker can name "Early loan repayment" as the main cost (it is the largest capital line after a big repay). Exclude debt_repaid from the cause ranking, or label it as a balance-sheet move rather than a cost.

## From M2.6
- The SPEC's overspend acceptance ("three marquee dinos + Parking III on day 1") costs about $148,000, so Standard's `debt_cap_base` now sits at $100,000 (four times the opening loan) to make it reachable on bank money alone. That is a lot of rope for a first-time owner and it was set to satisfy an acceptance scenario, not because $100,000 is the right feel. A second-tier credit line at punitive interest — the bank lends past the ordinary cap but at the overdraft rate — would be the honest shape, and would let the ordinary cap come back down.
- Marquee dinosaurs are very strong at a $20 ticket once they are fed: the overspend path only fails because there is no food budget. A price/appeal pass could make premium pricing a real trade-off rather than a straight win.
- Parcel biomes are authored per parcel; a "single-biome park" toggle in `data/parcels.json` would make the survey map read more like a real site survey.

## Parked after critic pass 1 on M2.6 (2026-09-08)
- The under-tier breakout branch (`chance = base x danger_factor x (min_tier - tier)`) is unreachable in normal play: `buyDino` refuses a species whose minimum fence tier is above the pen, `upgradeFence` only moves tiers up, and no event downgrades a fence. It only fires for hand-built states (`E.addDino`). To make it a real trap, give the player a way to end up under-fenced on purpose or by accident: an auction lot that arrives before its pen is ready, a "move dinosaur" action with no tier check, or a storm that knocks a fence down a tier.
- Fence condition is the only thing standing between a dangerous species and an escape, and a `staff_quit` event can silently empty the maintenance role. Over 8 year-long runs, hiring maintenance once and never checking gave 2 runs with escapes; re-hiring whenever the role is empty gave none. Consider a standing "role is empty" warning in the status bar or the digest, or an auto-rehire toggle, so losing the worker is a decision rather than an ambush.
- Enclosure and facility panels keep the shared modal width (600 logical units), so a short panel still has a fixed-width box. A `fit`-width modal variant would suit the small panels; the trailing dead band under the last row is already gone.

## Parked after critic pass 2 on M2.6 (2026-09-09)
- Park canvas letterboxes to ~83% of the main area at both 1280x720 and 1920x1080 (56/84px side margins). It clears the >=80% fill bar but is an exact-fit scale (1.06x, 1.59x), not the integer multiple SPEC's "Rendering / viewport" line asks for; snapping to 1x would drop the fill to 73%. Either relax the SPEC wording or redesign the shell chrome so an integer scale fills the frame.
- D1 (the PLUS parcel) has 12 outline edges but only 4 face a walkway, so its crowd bunches on four points while B1 spreads over 14. Weighting a parcel's popularity by how many viewing spots it actually has — or authoring the walkway ring closer to D1's notches — would even out the hero-screen crowd.

## Parked during Milestone 3 (2026-09-09)
- Strip buildings (tram depot, visitor center, office, vet clinic) draw their doors on the south face like every other box, so staff and visitors walking to them cross the roof line. A "door side" per facility in parcels.json (and a spur path from the forecourt) would let the strip cluster route cleanly.
- The Park Tram is visual only (a shuttle on the forecourt track); visitors still walk from their car to the gate. Riding it (spawn at the stop, alight at the gate) would sell the throughput bonus better.
- Tall tier-3 strip buildings (Park Headquarters, Animal Hospital) poke up into the park's south row, and a FOR SALE sign for D5 can be lifted over their roofs by the label collider. Either lower the strip (a shallower oblique z for strip buildings) or give signs a "never below this y" rule.
- Prize positions are fixed data; with the carousel on the plaza's north-east corner that planter is skipped. A second carousel/statue position set for a single-biome or re-authored map would need new coordinates.
- Facility upgrade store spend counts toward prizes, so a wealthy player can buy every spend prize on day 1 (DPS.addCash aside, bank money caps this in real play). If that feels too fast, prizes could require the threshold AND a minimum park age or rating.
- Debt cap base went back to $60,000 (the $100,000 rope only existed for the retired day-1 splurge scenario). The two-tier credit line idea (lend past the cap at the overdraft rate) is still the honest shape and would let the cap be tuned for feel rather than for an acceptance run.
- The slow-bleed acceptance path forecloses because payroll runs into overdraft while the unfed marquee animal dies; the fed variant of the same day 1 turns a profit on every seed. That contrast is worth surfacing in-game (a "why did I fail" screen that names the missing food budget), not just in tools/sim.html.
- Office `management_capacity` and `event_mitigation`, the clinic's `illness_reduction`, and the tram's `gate_capacity` are all live, but only the office capacity has a visible in-game warning (the payroll ticker line). A status-bar hint when headcount exceeds the office, or when a clinic/office heads off an event (currently a "Close call" popup credited to the building), would make the new facilities' value legible.
- Fact Book extras from the Visitor Center are data already in dinosaurs.json (danger, lifespan, biome affinity) plus your specimens; a second fact per species (`fact_2`) would make the top education tier feel like new content rather than a reveal.
- Settings day-length and autosave sliders persist as browser preferences (dino-park-sim.prefs) and in the save; there is no "reset to defaults" button.

## Parked during Milestone 4 (2026-09-10)
- "Move dinosaur" between pens: the only fix for a wrong-biome animal today is Re-landscape (blocked while a required species is inside) or Sell. A move action with a fence-tier check would also give the under-tier breakout branch a real path.
- Vegetation is grazed in whole units (floor) and only by herbivores; piscivores could get a marsh "fish pond" analogue (stocked once, regrows) so marsh has a second free-food story.
- Auto-restock buys a fixed amount; a "fill to N days" mode would track a growing herd without editing the rule.
- Membership pass price is one number for the whole park; tiers (family pass, off-peak pass) and a members-only perk (early entry raises satisfaction) would deepen the panel.
- School program floor is a flat number; scaling it with the Visitor Center tier (education level) would tie it to the education prize the SPEC mentions.
- Influencer visit is a plain one-day boost; a reputation bump on a five-star day (and a hit on a dirty one) would make it a gamble rather than a purchase.
- Campaign what-if lines assume today's season for the whole run; a 30-day campaign bought in late Spring is worth more than the line says (Summer inside it).
- FOR SALE stakes stand on the parcel's front tile; the survey rope around unowned outlines is still drawn. A single stake per parcel with no rope would be quieter still if playtest wants it.
- The unhappy badge and the "z" hungry tag both sit over the head; with sick + unhappy the second badge shifts right. A single status strip per dinosaur would scale better once sprites land in Phase 3.

## Parked during Milestone 5 (2026-09-11)
- Sound is one-shot per trigger; a proper mix (ducking the ambient pad under a fanfare, a per-category volume for roars vs UI) and a "mute while the tab is hidden" rule would be the next step. The synth renders each id once and caches it, so a data-driven random pitch jitter per play (cheap variety) would need a small cache per variant.
- Idle roars only fire in the living view (the agent tick drives them). A "distant roar" cue on other screens, timed off the clock, would keep the park audible while shopping.
- The delivery truck always drives left-to-right along the forecourt road and the dinosaur pops in at its pen; a crate carried up the spine by staff (or the tram) would sell the delivery better once sprites land in Phase 3.
- Cash floaters merge everything inside one JS task and rate-limit to about four a second; at 10x a busy park still shows a steady stream. A per-category split (income vs bills) or a rolling "+$/day" chip would be quieter.
- Goals are a fixed ladder from balance.goals; a second, data-authored ladder (e.g. a "welfare park" route with no escapes and a vet clinic first) would give replay value. The report card grades only the FINAL year for profit/attendance/satisfaction; a five-year trend line on the card would show growth, not just the last lap.
- Grand Park requires four consecutive five-star quarters; the rating today saturates once appeal, cleanliness and satisfaction max out, so the streak is mostly a wait. A harder late-game rating (visitor fatigue, ageing facilities) would make holding five stars a real job.
- Pen name chips are clamped to their pen (never over a walkway); on a 1x1 pen a long name still overflows the tile sideways. A per-tile abbreviation table (T-REX, STEGO) would fit every name in a single tile.
- The Grand Park plaque is drawn beside the right gate post at a fixed offset; the Grand Entrance prize's towers make it tight. A dedicated plaque spot in parcels.json (like prize positions) would decouple the two.
- The survey-map panel copy moved to the 8px face; the map's own parcel chips stay at 6px/5px because a 1x1 tile is 52px wide. A hover card (DOM) for chips would let the map text grow too.
- First-quarter tips are keyed by day and shown once per browser (localStorage); a returning player who already knows the game sees them once more on their next park. A "seen the tutorial" flag could also skip the tips.

## Parked during the M5 critic fix pass (2026-09-11)
- Deliveries queue from any screen and the truck runs when the Park is next opened; a distant engine/horn cue on the Town screen (audio only) would tell the shopper the truck left without switching views.
- The Grand Park plaque tag, the tram-stop sign and the Discovery Hall roof label all live in the ~2-tile forecourt strip beside the gate; a data-driven label anchor per forecourt building (parcels.json) would let them be placed by hand instead of by the collision slots.
- Pen chip stacks on interlocking pens are pushed apart by a fixed pixel gap; a per-pen chip colour (the pen's biome tint) would make ownership legible even when the boxes overlap exactly.
