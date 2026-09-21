#!/usr/bin/env python3
"""Fossil Fortune Phase 4: process facility BUILDING sprites.
Same background key as the dino sprites (gradient flood fill from the border + enclosed
pockets + near-white), then autocrop. Buildings keep their native resolution and are scaled
to the footprint at draw time, so there is no per-size target height. Outputs to buildings/
with a manifest {id: {w, h}}.
"""
import os, glob, json, sys
from collections import deque
from PIL import Image
import numpy as np
from scipy import ndimage

SRC = "art-direction/vga/buildings-iso"
OUT = sys.argv[1] if len(sys.argv) > 1 else "buildings"
os.makedirs(OUT, exist_ok=True)

TOL_SEED = 40
TOL_STEP = 34

def remove_bg(im):
    im = im.convert("RGBA")
    arr = np.array(im).astype(np.int16)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3]
    border = np.concatenate([rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]], axis=0)
    seed = np.median(border, axis=0)
    dist = np.sqrt(((rgb - seed) ** 2).sum(axis=2))
    sat = rgb.max(2) - rgb.min(2)
    bgmask = np.zeros((h, w), bool)
    visited = np.zeros((h, w), bool)
    dq = deque()
    for x in range(w):
        dq.append((0, x)); dq.append((h - 1, x))
    for y in range(h):
        dq.append((y, 0)); dq.append((y, w - 1))
    prevcol = {}
    while dq:
        y, x = dq.popleft()
        if visited[y, x]:
            continue
        px = rgb[y, x]
        near_seed = dist[y, x] <= TOL_SEED
        near_white = px.min() >= 230 and sat[y, x] < 16
        pv = prevcol.get((y, x))
        near_prev = pv is not None and np.sqrt(((px - pv) ** 2).sum()) <= TOL_STEP and sat[y, x] < 40
        if not (near_seed or near_white or near_prev):
            continue
        visited[y, x] = True
        bgmask[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                dq.append((ny, nx)); prevcol.setdefault((ny, nx), px)
    lbl, num = ndimage.label(~bgmask)
    if num:
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, num + 1))
        keep = max(range(1, num + 1), key=lambda i: sizes[i - 1])
        for i, s in enumerate(sizes, 1):
            if s < 10 and i != keep:
                bgmask[lbl == i] = True
    out = arr.copy()
    out[bgmask, 3] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")

def autocrop(im):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

results = {}
for f in sorted(glob.glob(f"{SRC}/*.png")):
    bid = os.path.basename(f)[:-4]
    if bid.startswith("_") or bid.endswith("-preview"):
        continue
    im = autocrop(remove_bg(Image.open(f)))
    im.save(f"{OUT}/{bid}.png")
    results[bid] = {"w": im.width, "h": im.height}

# contact sheet on a checker
ids = sorted(results)
cols = 4
rows = (len(ids) + cols - 1) // cols
cw, ch = 240, 220
sheet = Image.new("RGBA", (cols * cw, rows * ch), (40, 44, 52, 255))
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)
for i, bid in enumerate(ids):
    sp = Image.open(f"{OUT}/{bid}.png")
    z = min(2, (cw - 20) // max(1, sp.width), (ch - 30) // max(1, sp.height)) or 1
    s = sp.resize((sp.width * z, sp.height * z), Image.NEAREST)
    cx = (i % cols) * cw; cy = (i // cols) * ch
    sheet.alpha_composite(s, (cx + (cw - s.width) // 2, cy + (ch - 24 - s.height) // 2 + 6))
    d.text((cx + 4, cy + ch - 16), bid, fill=(235, 230, 218))
sheet.save(f"{OUT}/_contact.png")
with open(f"{OUT}/manifest.json", "w") as fh:
    json.dump({"_notes": "Phase 4 facility building sprites, oblique 3/4 VGA pixel art. Background keyed "
               "and autocropped; drawn footprint-anchored and scaled at render time.", "buildings": results}, fh, indent=2)
print(json.dumps(results, indent=0))
print("wrote", len(results), "buildings to", OUT)
