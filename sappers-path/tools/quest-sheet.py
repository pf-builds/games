# Sapper's Path campaign v6: the contact sheet of the campaign's side quests in map order (tools/quest-bake.js). One tile a
# quest: its board as shipped (shades, the moat's water or mire, mystery blocks as their fill), each cell PX image px with
# a darker 1 px seam, the frame and paths as ground; a caption (quest number, kept or new, title, the main level it
# follows, its prize, tag and features). Rows of COLS tiles. Kept quests have a grey rim, new ones gold.
#   python3 tools/quest-sheet.py OUT.jpg [PX] [COLS]   (reads tools/build-data/levels/gallery.json and config.json beside it)
import json, os, sys
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
out = sys.argv[1]; PX = int(sys.argv[2]) if len(sys.argv) > 2 else 4; COLS = int(sys.argv[3]) if len(sys.argv) > 3 else 10
G = json.load(open(os.path.join(ROOT, "tools/build-data/levels/gallery.json")))["levels"]; C = json.load(open(os.path.join(ROOT, "config.json")))
QL = [l for l in G if not l.get("land")]
GROUND, BG, INK, OLD, NEW = (110, 97, 80), (34, 28, 36), (243, 234, 216), (140, 136, 150), (217, 168, 38)
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mat(ch):
    o = ord(ch) - 96
    return o if 1 <= o <= 14 else 0
def draw(L):
    W, H = L["w"], L["h"]; im = Image.new("RGB", (W * PX, H * PX), GROUND); d = ImageDraw.Draw(im)
    liq = C["board"]["pic"]["liquids"].get(L.get("liquid") or "", {}).get("water") or C["board"]["pic"]["water"]
    hid = L.get("hidden"); hc = L.get("hideC") or C["board"]["hidden"]["c"]; sh = L.get("shade")
    for y in range(H):
        for x in range(W):
            ch = L["grid"][y][x]; m = mat(ch)
            if ch == "~": c = liq
            elif not m: continue
            elif hid and hid[y][x] == "?": c = hc
            else:
                p = L["pal"][str(m)]; c = p["c"]; k = int(sh[y][x]) if sh else 0
                if k and p.get("sh") and p["sh"][k - 1]: c = p["sh"][k - 1]
            c = rgb(c); s = tuple(int(v * 0.7) for v in c)
            d.rectangle([x * PX, y * PX, x * PX + PX - 1, y * PX + PX - 1], fill=s)
            d.rectangle([x * PX, y * PX, x * PX + PX - 2, y * PX + PX - 2], fill=c)
    return im
TW, TH, CAP = 46 * PX + 12, 47 * PX + 12, 40
sheet = Image.new("RGB", (COLS * TW, ((len(QL) + COLS - 1) // COLS) * (TH + CAP)), BG); dr = ImageDraw.Draw(sheet)
for i, L in enumerate(QL):
    new = L["kind"] == "outlined"; im = draw(L); x0, y0 = (i % COLS) * TW, (i // COLS) * (TH + CAP)
    ox, oy = x0 + (TW - im.width) // 2, y0 + (TH - im.height) // 2
    dr.rectangle([ox - 3, oy - 3, ox + im.width + 2, oy + im.height + 2], outline=NEW if new else OLD, width=2); sheet.paste(im, (ox, oy))
    q = L["quest"]; f = [k for k in (L.get("feats") or []) if k]
    dr.text((x0 + 6, y0 + TH), "%d %s %s" % (i + 1, "new" if new else "kept", L.get("short") or L["title"]), fill=INK)
    dr.text((x0 + 6, y0 + TH + 13), "after %d, %s, %s" % (q["after"], q["prize"], L["tag"]), fill=INK)
    dr.text((x0 + 6, y0 + TH + 26), ",".join(f) if f else ("plain" if not new else "no features"), fill=INK)
sheet.save(out, quality=88)
print("sheet: %d quests -> %s (%dx%d)" % (len(QL), out, sheet.width, sheet.height))
