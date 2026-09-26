#!/usr/bin/env python3
# Peasant Swarm font subset (v3 M2b; the portal zip gate). python3 tools/font-subset.py <original baloo2 woff2> <original nunito woff2>
# Subsets the two Google Fonts latin variable woff2 files to the characters the game can draw: every character in src/*.js, index.html,
# config.json and style.css (a superset of the drawn strings), plus digits, ASCII punctuation, the middle dot, the times sign, dashes,
# curly quotes, the ellipsis and arrows. Keeps the wght axis, every layout feature, the glyph bounds, the name table and the OS/2 fields as
# shipped: with fontTools' default bound and metadata recalculation Chrome rasterised Nunito differently (same advances, different
# pixels); with them kept, canvas measureText and a rendered text sheet are identical to the unsubsetted files (M2-build-notes.md).
# Needs fonttools and brotli (pip3 install --user fonttools brotli). Writes fonts/baloo2-latin.woff2 and fonts/nunito-latin.woff2.
import glob, os, sys
from fontTools.ttLib import TTFont
from fontTools import subset
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set("0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~·×…→←↑↓–—’‘“”")
for f in glob.glob(os.path.join(here, "src", "*.js")) + [os.path.join(here, n) for n in ("index.html", "config.json", "style.css")]:
    chars |= set(open(f, encoding="utf-8").read())
text = "".join(sorted(c for c in chars if ord(c) >= 32))
o = subset.Options(); o.layout_features = ["*"]; o.recalc_bounds = False; o.recalc_timestamp = False; o.name_IDs = ["*"]; o.name_languages = ["*"]; o.name_legacy = True
o.prune_unicode_ranges = False; o.recalc_average_width = False; o.recalc_max_context = False; o.notdef_outline = True; o.glyph_names = True; o.legacy_kern = True; o.hinting = True
for src, name in zip(sys.argv[1:3], ("baloo2-latin.woff2", "nunito-latin.woff2")):
    f = TTFont(src, recalcBBoxes=False, recalcTimestamp=False); s = subset.Subsetter(o); s.populate(text=text); s.subset(f); f.flavor = "woff2"
    out = os.path.join(here, "fonts", name); f.save(out); print(name, os.path.getsize(src), "->", os.path.getsize(out), "B,", len(f.getGlyphOrder()), "glyphs")
