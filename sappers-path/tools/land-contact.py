# Sapper's Path v6 lane D4: a contact sheet of a land's main levels as they ship (levels/levels.json records): each board
# drawn flat from its grid, palette and shade rows (shade digit d draws pal sh[d - 1]), mystery blocks in the level's own
# fill with a "?" dot, the open frame in dirt. Under each: level, picture id, title, tag, features. Levels named in --keep
# get an amber frame and "KEPT (live board)". For the critic of a re-deal.
#   python3 tools/land-contact.py LEVELS.json LAND_K OUT.png [--keep N,N] [--cell 5] [--cols 10] [--world K]
# v6 lane D7: --world K reads a Zen world's records (levels/zen.json, world K) instead of a land's; water (a moat) is drawn
# in blue, and each tile says its board size and moat yes or no. v6 lane D12: --zen-from N labels each tile with the Zen number
# the page shows (main.js zenNum: N for the world's first level, then on by one), e.g. --zen-from 137 for World 4.
import json, sys
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
def opt(k, d=None):
    return args[args.index("--" + k) + 1] if "--" + k in args else d
levels_f, land_k, out = args[0], int(args[1]), args[2]
keep = set(int(n) for n in opt("keep", "").split(",") if n)
cell, cols = int(opt("cell", "5")), int(opt("cols", "10"))
raw = json.load(open(levels_f))
world = int(opt("world", "0"))
zen0 = int(opt("zen-from", "0"))
LV = [L for L in (raw if isinstance(raw, list) else raw["levels"]) if (L.get("world") == world if world else L.get("land") == land_k)]
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
DIRT, PAGE, INK, AMBER, WATER = (201, 185, 143), (246, 241, 230), (40, 34, 46), (230, 150, 20), (70, 130, 200)
bw, bh = 42 * cell, 46 * cell
tw, th = bw + 16, bh + 66
rows = (len(LV) + cols - 1) // cols
img = Image.new("RGB", (cols * tw + 16, rows * th + 56), PAGE)
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
    big = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
except Exception:
    font = big = ImageFont.load_default()
d.text((16, 14), "Zen World %d as installed: %d levels (level%s, picture, title; tag | features; board size, moat)" % (world, len(LV), " / Zen number" if zen0 else ""), fill=INK, font=big) if world else d.text((16, 14), "Land %d as installed: %d levels, %d kept on their live boards (amber), %d re-dealt on outlined boards" % (land_k, len(LV), len([L for L in LV if L["n"] in keep]), len([L for L in LV if L["n"] not in keep])), fill=INK, font=big)
for i, L in enumerate(LV):
    ox, oy = 16 + (i % cols) * tw, 48 + (i // cols) * th
    kept = L["n"] in keep
    if kept:
        d.rectangle([ox - 4, oy - 4, ox + bw + 4, oy + bh + 4], outline=AMBER, width=4)
    x0, y0 = ox + (bw - L["w"] * cell) // 2, oy + (bh - L["h"] * cell) // 2
    pal = L["pal"]
    for y in range(L["h"]):
        for x in range(L["w"]):
            ch = L["grid"][y][x]
            k = ord(ch) - 96
            if 1 <= k <= 14 and str(k) in pal:
                p = pal[str(k)]
                s = int(L["shade"][y][x]) if L.get("shade") else 0
                c = hexrgb((p.get("sh") or [None] * 4)[s - 1] or p["c"]) if s else hexrgb(p["c"])
            elif ch == "~":
                c = WATER
            else:
                c = DIRT
            if L.get("hidden") and L["hidden"][y][x] == "?":
                c = hexrgb(L.get("hideC", "#3a3f63"))
            d.rectangle([x0 + x * cell, y0 + y * cell, x0 + (x + 1) * cell - 1, y0 + (y + 1) * cell - 1], fill=c)
            if L.get("hidden") and L["hidden"][y][x] == "?" and cell >= 4:
                m = cell // 2
                d.point((x0 + x * cell + m, y0 + y * cell + m), fill=hexrgb(L.get("hideQ", "#f3ead8")))
    hid = sum(r.count("?") for r in L.get("hidden", []))
    feats = ", ".join({"linked": "links", "mystery": "? cards", "hidden": "mystery"}.get(x, x) for x in L.get("feats", [])) or "-"
    d.text((ox, oy + bh + 6), ("%d/Z%d %s %s" % (L["n"], zen0 + i, L["src"], L["title"][:20])) if zen0 else ("%d %s %s" % (L["n"], L["src"], L["title"][:24])), fill=INK, font=font)
    d.text((ox, oy + bh + 21), "%s | %s%s" % (L["tag"], feats, (" %d" % hid) if hid else ""), fill=INK, font=font)
    moat = any("~" in r for r in L["grid"])
    d.text((ox, oy + bh + 36), "%dx%d %s" % (L["w"], L["h"], L.get("kind", "")) + ("   KEPT (live board)" if kept else "") + (("   moat yes" if moat else "   moat no") if world else ""), fill=AMBER if kept else INK, font=font)
img.save(out, optimize=True)
print("contact: %d boards -> %s (%dx%d)" % (len(LV), out, img.size[0], img.size[1]))
