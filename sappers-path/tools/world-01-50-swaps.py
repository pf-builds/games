# Sapper's Path v6 lane D16: old | new for each World 1 slot the fix pass changed, both boards drawn flat at about phone size
# (8 px a cell: a 42-cell board is 336 px, a 375 px phone draws it about 340 CSS px wide), with their titles and grades
# (two lines under each, so the old and new labels never overlap).
#   python3 tools/world-01-50-swaps.py OLD_ZEN.json NEW_ZEN.json OUT.png N,N,...   (Pillow)
import json, sys
from PIL import Image, ImageDraw, ImageFont
old_f, new_f, out, ns = sys.argv[1], sys.argv[2], sys.argv[3], [int(n) for n in sys.argv[4].split(",")]
pick = lambda f: {L["n"]: L for L in json.load(open(f))["levels"] if L["world"] == 1}
O, N = pick(old_f), pick(new_f)
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
cell, PAGE, INK, DIRT = 8, (246, 241, 230), (40, 34, 46), (201, 185, 143)
bw, bh = 42 * cell, 46 * cell
img = Image.new("RGB", (16 + 2 * (bw + 24) + 24, 52 + len(ns) * (bh + 76)), PAGE)
d = ImageDraw.Draw(img)
try:
    font, big = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14), ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
except Exception:
    font = big = ImageFont.load_default()
d.text((16, 14), "Zen World 1 fix pass (D16): old | new at about phone size", fill=INK, font=big)
def board(L, ox, oy):
    x0, y0 = ox + (bw - L["w"] * cell) // 2, oy + (bh - L["h"] * cell) // 2
    for y in range(L["h"]):
        for x in range(L["w"]):
            k, p = ord(L["grid"][y][x]) - 96, None
            if 1 <= k <= 14 and str(k) in L["pal"]:
                p = L["pal"][str(k)]; s = int(L["shade"][y][x]) if L.get("shade") else 0
                c = hexrgb((p.get("sh") or [None] * 4)[s - 1] or p["c"]) if s else hexrgb(p["c"])
            else:
                c = DIRT
            d.rectangle([x0 + x * cell, y0 + y * cell, x0 + (x + 1) * cell - 1, y0 + (y + 1) * cell - 1], fill=c)
    g = L["grade"][L["tag"]]
    return "%d %s (%s)\n%s %.1f%%, careful %s, %d s" % (L["n"], L["title"], L["src"], L["tag"], 100 * g["rate"], g.get("careful"), round(g["pace"]["ms"] / 1000))
for i, n in enumerate(ns):
    oy = 48 + i * (bh + 76)
    for j, L in enumerate([O[n], N[n]]):
        ox = 16 + j * (bw + 24)
        d.text((ox, oy + bh + 8), ("old: " if j == 0 else "new: ") + board(L, ox, oy), fill=INK, font=font)
img.save(out, optimize=True)
print("swaps: %d slots -> %s (%dx%d)" % (len(ns), out, img.size[0], img.size[1]))
