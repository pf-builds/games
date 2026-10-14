#!/usr/bin/env python3
"""Sapper's Path lane P Stage 5: the covers' 200x112 previews (each landscape cover at the portal's smallest thumbnail size,
Lanczos) and the contact sheet: one row per option (landscape, portrait, square, then its 200x112 preview at 1:1 and 2x),
each labelled. Also checks every cover's pixel size against the rules (1920x1080, 800x1200, 800x800).
  python3 sheet-covers.py <covers dir> [A B C]"""
import os, sys
from PIL import Image, ImageDraw
D = sys.argv[1]; OPTS = sys.argv[2:] or ["A", "B", "C"]
SIZE = {"land": (1920, 1080), "port": (800, 1200), "square": (800, 800)}
RH, GAP, LAB = 450, 24, 30  # row height (each cover scaled to it), gap, label band
bad = 0
rows = []
for o in OPTS:
    ims = {}
    for k, wh in SIZE.items():
        im = Image.open(os.path.join(D, f"cover-{o}-{k}.png")).convert("RGB")
        if im.size != wh: print(f"cover-{o}-{k}.png is {im.size}, want {wh}"); bad += 1
        ims[k] = im
    th = ims["land"].resize((200, 112), Image.LANCZOS); th.save(os.path.join(D, f"thumb-{o}-200x112.png")); rows.append((o, ims, th))
W = GAP + sum(round(RH * w / h) + GAP for w, h in SIZE.values()) + 200 + GAP + 400 + GAP
S = Image.new("RGB", (W, GAP + len(rows) * (RH + LAB + GAP)), "#1e1a22"); g = ImageDraw.Draw(S)
for r, (o, ims, th) in enumerate(rows):
    x, y = GAP, GAP + r * (RH + LAB + GAP)
    for k, im in ims.items():
        w = round(RH * im.size[0] / im.size[1]); S.paste(im.resize((w, RH), Image.LANCZOS), (x, y + LAB)); g.text((x, y + 8), f"{o} {k} {im.size[0]}x{im.size[1]}", fill="#e8e0d0"); x += w + GAP
    S.paste(th, (x, y + LAB)); g.text((x, y + 8), f"{o} 200x112 (1:1)", fill="#e8e0d0"); x += 200 + GAP
    S.paste(th.resize((400, 224), Image.NEAREST), (x, y + LAB)); g.text((x, y + 8), f"{o} 200x112 shown 2x", fill="#e8e0d0")
S.save(os.path.join(D, "contact-sheet.png")); print("contact-sheet.png", S.size, "size errors:", bad)
