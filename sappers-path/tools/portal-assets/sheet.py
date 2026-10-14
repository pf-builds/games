#!/usr/bin/env python3
"""Contact sheet of a frame folder: every frame given (or every Nth), tiled at a fixed width, labelled with its frame number.
  python3 sheet.py <dir> <out.png> [--w 320] [--cols 6] [--step 1]"""
import glob, os, sys
from PIL import Image, ImageDraw
a = sys.argv; d, out = a[1], a[2]
opt = lambda k, v: int(a[a.index(k) + 1]) if k in a else v
W, C, STEP = opt("--w", 320), opt("--cols", 6), opt("--step", 1)
fs = sorted(glob.glob(os.path.join(d, "f*.png")))[::STEP]
if not fs: sys.exit("no frames in " + d)
im0 = Image.open(fs[0]); H = round(W * im0.size[1] / im0.size[0])
R = (len(fs) + C - 1) // C; S = Image.new("RGB", (C * W, R * (H + 14)), "#222")
g = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    x, y = (i % C) * W, (i // C) * (H + 14)
    S.paste(Image.open(f).convert("RGB").resize((W, H), Image.LANCZOS), (x, y + 14)); g.text((x + 3, y + 1), os.path.basename(f), fill="#ddd")
S.save(out); print(out, S.size, len(fs), "frames")
