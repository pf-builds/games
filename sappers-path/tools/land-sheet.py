# Sapper's Path lands foundation: a land's contact sheet (tools/land.js sheet). For every picture in BOARDS (the land's
# scratch/boards.json: main pictures in level order, then its Wandering Gallery side quests), one tile: the source, the
# flat board and the shaded board (when the land shades), each cell PX image px with a darker 1 px seam, the frame as
# ground, and a caption (level or side quest, title, board size, colours, shades). Rows of COLS tiles.
#   python3 tools/land-sheet.py BOARDS SRC_DIR OUT.png [PX] [COLS]
import json, os, sys
from PIL import Image, ImageDraw
boards, src_dir, out = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
PX = int(sys.argv[4]) if len(sys.argv) > 4 else 5
COLS = int(sys.argv[5]) if len(sys.argv) > 5 else 4
GROUND, BG, INK = (110, 97, 80), (34, 28, 36), (243, 234, 216)
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mat(ch):  # the engine's grid letters: a-n are materials 1-14
    o = ord(ch) - 96
    return o if 1 <= o <= 14 else 0
def draw(b, shade):
    W, H = b["w"], b["h"]; im = Image.new("RGB", (W * PX, H * PX), GROUND); d = ImageDraw.Draw(im)
    for y in range(H):
        for x in range(W):
            m = mat(b["grid"][y][x])
            if not m: continue
            p = b["pal"][str(m)]; c = p["c"]; k = int(shade[y][x]) if shade else 0
            if k and p.get("sh") and p["sh"][k - 1]: c = p["sh"][k - 1]
            c = rgb(c); s = tuple(int(v * 0.7) for v in c)
            d.rectangle([x * PX, y * PX, x * PX + PX - 1, y * PX + PX - 1], fill=s)
            d.rectangle([x * PX, y * PX, x * PX + PX - 2, y * PX + PX - 2], fill=c)
    return im
tiles = []
for role in ("main", "side"):
    for e in boards.get(role, []):
        b = e["board"]; parts = []
        sp = os.path.join(src_dir, e["id"] + ".png")
        if os.path.exists(sp):
            s = Image.open(sp).convert("RGB"); k = (b["h"] * PX) / s.size[1]; parts.append(s.resize((max(1, round(s.size[0] * k)), b["h"] * PX), Image.LANCZOS))
        parts.append(draw(b, None))
        if b.get("shade"): parts.append(draw(b, b["shade"]))
        w = sum(p.size[0] for p in parts) + 6 * (len(parts) - 1); h = b["h"] * PX + 34
        t = Image.new("RGB", (w, h), BG); x = 0
        for p in parts: t.paste(p, (x, 0)); x += p.size[0] + 6
        cap = (("%d " % e["n"]) if role == "main" else "side ") + e["title"][:44]
        st = "%dx%d  %d colours%s" % (b["w"], b["h"], b["stats"]["colours"], ("  %d shades %.0f%%" % (b["shadeStats"]["shades"], b["shadeStats"]["shadedPct"])) if b.get("shadeStats") else "")
        dr = ImageDraw.Draw(t); dr.text((2, b["h"] * PX + 4), cap, fill=INK); dr.text((2, b["h"] * PX + 18), st, fill=(200, 190, 170))
        tiles.append(t)
if not tiles: print("no boards"); sys.exit(1)
cw = max(t.size[0] for t in tiles) + 12; ch = max(t.size[1] for t in tiles) + 12; rows = (len(tiles) + COLS - 1) // COLS
sheet = Image.new("RGB", (cw * COLS, ch * rows), (20, 16, 22))
for i, t in enumerate(tiles): sheet.paste(t, ((i % COLS) * cw + 6, (i // COLS) * ch + 6))
sheet.save(out, optimize=True); print("contact sheet: %d pictures, %dx%d px -> %s" % (len(tiles), sheet.size[0], sheet.size[1], out))
