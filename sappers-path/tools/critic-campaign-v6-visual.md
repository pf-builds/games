# Sapper's Path campaign v6 lane A: visual critic (one round)

Build: worktree `games-sappers-campaign`, branch campaign-v6 @ 2474574, served on 127.0.0.1:8472. Read-only on code and data.
Screens and contact sheets: `tools/critic-campaign-v6-visual/` (driver `run.mjs`, measurements `run.json`).
Viewports: 1280x720 (dpr 1, mouse), 375x812 (dpr 3, touch), 400x600 (dpr 1, the iframe size as a viewport). Each level opened
from its map node with a save that has 1..n-1 cleared (the s2 shots' method).

## Verdict

Ship-able after the SHOULD-FIX items. No BLOCKING. Nothing a portal would reject on sight: 0 console messages across the
whole run, no broken layout at any of the three sizes, the pin and kill read clearly through their labels and sheets. The
weak spots are three of the realm 5/8 painted tower colours, the line not showing a pinned squad, and about six of the 26
new quest pictures that don't read as their title.

selfTest: 916/0 at 375x812, 918/0 at 1280x720, 0 console messages.

## Counts

BLOCKING 0, SHOULD-FIX 5, MINOR 9.

## SHOULD-FIX

1. **Painted towers on 104, 117 and 198 look like a mistake.** The painted tower takes the palette's slate-role colour,
   and in those palettes that colour is 104 #c74fc0 hot magenta ("watch huts"), 117 #bf87fb lilac, and 198 #c77c9a pink
   ("scrap iron"). The fen boards are night-fog teal, reed green and brown, so a saturated magenta or lilac 5x14 pillar at
   the frame edge reads as a pink column, not a stone archer tower. 115 (#938b9e grey-violet) reads fine as stone, and so
   do 191, 195 and 196 (teal and grey-green). There's no clash with block colours, because the tower is its own colour
   group (104's magenta *is* card 43). The problem is purely the stone-vs-candy look. Evidence: `sheet-phone-towers.jpg`,
   `sheet-tower-zoom.jpg`, `desk-L104-start.png`, `phone-L117-start.png`, `phone-L198-start.png`. Fix: let the tower
   drop the ΔE-from-slate aim and pick a desaturated grey or umber that still clears 25.
2. **The line doesn't show that a squad is pinned.** Repro: 64, play `00432221231` (SP.hitPlan). The pinned crew's space is
   a plain grey "work" slot with a tiny count badge. Its aria says "Stone, 0 waiting, 1 out, 1 pinned", but nothing on
   screen says so, and the head reads "1 stuck · 1 working · 3 free". The struck label "Pinned! Until its tower falls" is
   clear while it shows. After it fades, the only cue is a ~4 css px sapper with an arrow in it at 375 px, and the space
   looks like it's working forever. Evidence: `sheet-frame-desk.jpg` row 1, `desk-L64-pin-lying.png`, pinslot.mjs output.
   Fix: give the space a pin or arrow glyph and say "pinned" in the head count.
3. **cq13 Raven Messenger reads as a penguin.** It's a black upright body with a white front (the scroll), an orange beak,
   and it stands flat. At play size it's a penguin. Swap it for a spare (cq14, cq16 or cq35) or redraw. Evidence:
   `sheet-quests-zoom.jpg`.
4. **Weak quest pictures that don't read as their title at play size** (`sheet-quests.jpg`, `sheet-quests-zoom.jpg`):
   - cq30 Shield Wall: reads as three tomatoes or flowers. Its bottom row is a dotted run of black and grey cells, which
     is broken black bits under the ink-outline rule.
   - cq42 Bagpipes: a green and red figure, and the pipes don't read. The drones at top right break into separate black
     fragments, another ink-rule problem.
   - cq26 Bullseye: the green cloak blob over the target is shapeless.
   - cq21 Round Shield: the brown disc reads as a sack or boulder.
   - cq02 Helmet Bed: reads as a hood or ghost with something green inside.

   Swap the worst two (cq30, cq42) for the spares. The rest can stay if Peter accepts them.
5. **On two-lock levels at desktop, the start toast hides the sockets.** On 157 at 1280x720 the kill toast (829,132 to
   1130,191) sits on the line and covers spaces 2-4, including the key socket, so only the green colour socket shows
   at the moment the player most needs to see both. 64 at desktop does the same to the line. Evidence:
   `sheet-zoom2.jpg` "157 line desk start", `desk-L64-start.png`. Fix: put the desktop toast over the board, as phone does.

## MINOR

1. **Archer range rings are thin dashed red lines, about 1 css px.** They're readable on 64 and 66, where the coach adds a
   solid yellow ring and an arrow. On 74, 80, 82, 91 and the painted levels they almost vanish into busy pixel art at
   375 px. Consider a 2 px ring or a faint fill. Evidence: `sheet-phone-towers.jpg`.
2. **Key socket vs colour socket (157).** The colour lock socket is hatched in its crew colour (dark green). The key lock
   socket is a plain socket with a generic padlock and no key glyph, while the board's key marker is a small gilt key
   (about 8 css px on phone). A player can only pair them by elimination. A key glyph on the key socket would settle it.
   The unlock pops are clean: the key socket opens alone, then the colour socket opens (`L157-unlock-1/2`, all sizes).
3. **The short sheet's chip on 66 is a solid black square** (the black crew) sitting inline: "Not enough ■ sappers left".
   On cream it reads like a redacted word. Give the chip a light outline or its count. The sheet also says what happened
   but not what to do. "Bring the tower down first" would close the loop.
4. **On 64 and 66 at phone, the coach and the toast say the same thing twice,** and the toast (184x80) covers the bottom
   ~60 px of the board (the bank and moat where sappers enter) while it shows. The coach itself is clear of the board
   (coach y 52-98, board from y 133) and its wording is plain: "Archer towers are back! Here a hit pins your sapper until
   its tower falls." / "Deadly archers: bring their tower down before anyone walks into the ring." At 400x600 the coach
   shrinks to "Archers pin here: tower first!" in the top bar, at about 6 px type.
5. **The tag badges are tiny, and Extreme doesn't read as harder than Hard.** They're about 7 px type on the phone map:
   Easy teal, Hard red, Extreme purple. Red reads as the most dangerous colour, so Extreme in purple reads as a different
   kind of level, not a harder one. A skull or bolder chip would fix that (`sheet-maps.jpg`). The play-bar chips (HARD
   red, EXTREME purple) have the same issue.
6. **cq12 Spell-Book Cat reads as a black blob in a witch hat.** The ears don't separate from the hat.
7. **cq11 Knitting Dragon is an orange upright dragon with a cream belly and a curled tail.** It's generic (horns, no
   flame tail), but it sits near a well-known orange starter-monster silhouette. Peter should eyeball it against the
   no-IP rule.
8. **The `quests-50.jpg` contact sheet named in notes §4.6 isn't in this worktree.** It lives only in
   `games-sappers-campaign-quests/sappers-path/tools/shots-campaign-v6/` (gitignored, so the merge didn't bring it). I
   judged the 26 from my own renders at play size (`phone-q-cq*.png`).
9. **Quest nodes and prize bubbles in realms 1, 4 and 8 are readable** and none of them overlaps the path. In realm 4 at
   375 px, the two prize bubbles near 88-89 and the castle sit close together but don't touch (`sheet-maps.jpg`). No egg
   overlap was seen.

## Checked and OK

- The restored towers (64, 66, 74, 80, 82, 91) are the castle's own blue and teal towers with an archer on top, and they
  read as towers. 115, 191, 195 and 196 read as stone towers.
- Pin, struck and released on 64: the arrow lands, the label "Pinned! Until its tower falls" is clear, the sapper lies with
  the arrow in it, and when the tower falls it gets up (`L64-pin-*`, all three sizes).
- Kill on 66: the label "Shot down by an archer!" is clear, and the short sheet has Retry and Back to map and no continue.
- The jam sheet with a pinned squad (64, order `13204231021212`) reads "Line jammed: [chips] can't reach a block. Archers
  have pinned sappers until their towers fall." It's whole at 375, 400 and 1280.
- Quest pictures: all 26 have one solid dark outline plus the moat ring, except where noted (cq30, cq42). They fit the
  campaign theme (goblins, knights, dragons, siege kit).

Caveat: the "New: Ladder" and "New: Recall" power-up tips in some screens come from the synthetic save (done map only, no
meta). They aren't v6 findings.
