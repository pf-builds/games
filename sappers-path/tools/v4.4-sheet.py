# Sapper's Path v4.4a: the candidates' contact sheet for Peter's pick (Gallery 61-100). Reads tools/shots-v4.4/candidates.json
# (in sheet order, strongest first: number, id, title, kind, source, note, readability 1-5) and each board
# (tools/shots-v4.4/boards/<id>.png, tools/v4.4-candidates.js) with its source (tools/gallery-src/<id>.png), and writes
# tools/shots-v4.4/candidates-sheet.png: a numbered card per candidate (the board as converted at the v4.2 full size, the
# source in its corner, title, kind, readability and the one-line note). Run with the local-ai venv's Python (Pillow):
#   /Users/peter/local-ai/.venv/bin/python tools/v4.4-sheet.py
import json, os, textwrap
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "shots-v4.4")
cands = json.load(open(os.path.join(OUT, "candidates.json")))["candidates"]
font = lambda s: ImageFont.truetype(os.path.join(ROOT, "fonts", "Jersey10-Regular.ttf"), s)
F1, F2, F3 = font(30), font(22), font(19)
COLS, CW, CH, B = 7, 300, 410, 264          # columns, card width and height, the board's box
KIND = {"ours": (232, 85, 58), "emoji": (47, 122, 111), "painting": (110, 92, 160)}
W, H = COLS * CW + 20, ((len(cands) + COLS - 1) // COLS) * CH + 90
sheet = Image.new("RGB", (W, H), (34, 26, 38)); d = ImageDraw.Draw(sheet)
d.text((20, 18), "Sapper's Path v4.4a: picture candidates for Gallery 61-100 (pick 40). Strongest first; boards at the v4.2 full size.", font=F1, fill=(243, 234, 216))
for k, c in enumerate(cands):
    x0, y0 = 10 + (k % COLS) * CW, 70 + (k // COLS) * CH
    d.rounded_rectangle((x0 + 4, y0 + 4, x0 + CW - 6, y0 + CH - 8), radius=10, fill=(243, 234, 216), outline=(20, 16, 24), width=3)
    bd = Image.open(os.path.join(OUT, "boards", c["id"] + ".png")).convert("RGB"); s = min(B / bd.width, B / bd.height)
    bd = bd.resize((max(1, round(bd.width * s)), max(1, round(bd.height * s))), Image.NEAREST)
    bx, by = x0 + (CW - bd.width) // 2, y0 + 16 + (B - bd.height) // 2; sheet.paste(bd, (bx, by))
    src = os.path.join(ROOT, "tools", "gallery-src", c["id"] + ".png")
    if os.path.exists(src):
        im = Image.open(src).convert("RGBA"); im.thumbnail((62, 62)); bgc = Image.new("RGBA", (im.width + 6, im.height + 6), (20, 16, 24, 255))
        bgc.paste(im, (3, 3), im); sheet.paste(bgc.convert("RGB"), (x0 + CW - im.width - 18, y0 + 12))
    d.rounded_rectangle((x0 + 10, y0 + 10, x0 + 58, y0 + 44), radius=6, fill=(242, 194, 48), outline=(20, 16, 24), width=2)
    d.text((x0 + 34, y0 + 27), str(c["number"]), font=F1, fill=(20, 16, 24), anchor="mm")
    ty = y0 + 20 + B
    d.text((x0 + 14, ty), c["title"][:26], font=F2, fill=(34, 26, 38))
    kc = KIND.get(c["kind"], (90, 90, 90)); kw = d.textlength(c["kind"], font=F3)
    d.rounded_rectangle((x0 + 14, ty + 28, x0 + 26 + kw, ty + 50), radius=4, fill=kc); d.text((x0 + 20, ty + 30), c["kind"], font=F3, fill=(255, 246, 232))
    d.text((x0 + 36 + kw, ty + 30), "read " + str(c["readability"]) + "/5", font=F3, fill=(34, 26, 38))
    for i, line in enumerate(textwrap.wrap(c["note"], 34)[:3]): d.text((x0 + 14, ty + 56 + i * 21), line, font=F3, fill=(90, 80, 96))
sheet.save(os.path.join(OUT, "candidates-sheet.png"), optimize=True)
print("sheet", sheet.size, len(cands), "candidates")
