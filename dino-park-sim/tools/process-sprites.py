#!/usr/bin/env python3
"""Fossil Fortune Phase 3 sprite processing.
Flood-fill background removal (bg varies per sprite, sampled from border),
autocrop to content, then NEAREST-scale to a target height per size class.
Outputs tight transparent PNGs + a contact sheet for review.
"""
import os, glob, json, sys
from collections import deque
from PIL import Image
import numpy as np

SRC = "art-direction/vga/picked"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/private/tmp/claude-501/-Users-peter-Documents-Claude/809beb36-88e8-499b-a3fb-2b1b50685fbb/scratchpad/sprites_out"
os.makedirs(OUT, exist_ok=True)

# size class -> target height in px (at 960x540 logical canvas)
TARGET_H = {"small": 32, "medium": 48, "large": 64}
species = {s["id"]: s for s in json.load(open("data/dinosaurs.json"))["species"]}

# Base facing (which way the head points in the source art), read off the sprites.
# In-game the sprite is mirrored so it faces the dino's travel direction.
LEFT_FACING = {"baryonyx", "coelophysis", "dryosaurus", "iguanodon", "lesothosaurus",
               "parasaurolophus", "protoceratops", "psittacosaurus", "spinosaurus",
               "stegosaurus", "styracosaurus", "tyrannosaurus"}

TOL_SEED = 40   # always-bg: within this of the sampled open-bg colour
TOL_STEP = 34   # gradient step: flow into a neighbour this close to the current bg pixel.
                # Lets the fill cross the ground and up into the shaded pocket under a
                # belly (a smooth darkening of the bg), then stop at the dino's crisp
                # dark outline.

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
        near_white = px.min() >= 230 and sat[y, x] < 16   # white podium/halo artifacts
        pv = prevcol.get((y, x))
        near_prev = pv is not None and np.sqrt(((px - pv) ** 2).sum()) <= TOL_STEP and sat[y, x] < 40
        if not (near_seed or near_white or near_prev):
            continue  # crisp/saturated edge into the dino
        visited[y, x] = True
        bgmask[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                dq.append((ny, nx)); prevcol.setdefault((ny, nx), px)
    from scipy import ndimage
    lbl, num = ndimage.label(~bgmask)
    if num:
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, num + 1))
        keep = max(range(1, num + 1), key=lambda i: sizes[i - 1])  # largest = the dino
        for i, s in enumerate(sizes, 1):
            if s < 8 and i != keep:
                bgmask[lbl == i] = True
    out = arr.copy()
    out[bgmask, 3] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")

def remove_shadow(im):
    """Erase a baked flat ground shadow: flood fill from the figure's bottom-centre
    through connected low-saturation grey, capped to the lower part of the figure so it
    cannot climb into the body."""
    arr = np.array(im)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3].astype(np.int16)
    alpha = arr[:, :, 3]
    sat = rgb.max(2) - rgb.min(2)
    ys, xs = np.where(alpha > 8)
    if len(ys) == 0:
        return im
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    fh = y1 - y0
    cap = int(y1 - fh * 0.34)          # only the bottom 34% of the figure
    # seed: opaque low-sat pixels on the bottom two content rows
    seedpx = [(yy, xx) for yy in (y1, y1 - 1) for xx in range(x0, x1 + 1)
              if alpha[yy, xx] > 8 and sat[yy, xx] < 26]
    if not seedpx:
        return im
    scol = np.median([rgb[yy, xx] for yy, xx in seedpx], axis=0)
    shadow = np.zeros((h, w), bool)
    visited = np.zeros((h, w), bool)
    dq = deque(seedpx)
    STEP = 34
    for yy, xx in seedpx:
        visited[yy, xx] = True; shadow[yy, xx] = True
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if not (0 <= ny < h and 0 <= nx < w) or visited[ny, nx]:
                continue
            visited[ny, nx] = True
            if alpha[ny, nx] <= 8 or ny < cap:
                continue
            px = rgb[ny, nx]
            if sat[ny, nx] < 26 and np.sqrt(((px - scol) ** 2).sum()) <= STEP:
                shadow[ny, nx] = True
                dq.append((ny, nx))
    out = arr.copy()
    out[shadow, 3] = 0
    return Image.fromarray(out, "RGBA")

def autocrop(im):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

results = {}
for f in sorted(glob.glob(f"{SRC}/dino-*.png")):
    sid = os.path.basename(f)[5:-4]
    im = Image.open(f)
    im = remove_bg(im)
    im = remove_shadow(im)
    im = autocrop(im)
    size = species.get(sid, {}).get("size", "medium")
    th = TARGET_H[size]
    scale = th / im.height
    tw = max(1, round(im.width * scale))
    im2 = im.resize((tw, th), Image.NEAREST)
    im2.save(f"{OUT}/{sid}.png")
    results[sid] = {"size": size, "w": tw, "h": th,
                    "face": "left" if sid in LEFT_FACING else "right"}

# manifest the game loads at boot
with open(f"{OUT}/manifest.json", "w") as fh:
    json.dump({"_notes": "Phase 3 dino sprites. Cropped from art-direction/vga/picked, "
               "background + baked ground shadow removed, NEAREST-scaled to a per-size "
               "target height (small 32 / medium 48 / large 64 px at the 960x540 logical "
               "canvas). `face` = which way the source art's head points; the renderer "
               "mirrors the sprite to face the dino's travel direction.",
               "target_h": TARGET_H, "sprites": results}, fh, indent=2)

# contact sheet: all sprites on a checker bg, labelled, native target size
n = len(results)
cols = 6
rows = (n + cols - 1) // cols
cellw, cellh = 150, 120
sheet = Image.new("RGBA", (cols * cellw, rows * cellh), (40, 46, 56, 255))
# checker
chk = np.array(sheet)
for y in range(0, sheet.height, 12):
    for x in range(0, sheet.width, 12):
        if (x // 12 + y // 12) % 2:
            chk[y:y+12, x:x+12, :3] = (56, 62, 72)
sheet = Image.fromarray(chk)
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)
for i, sid in enumerate(sorted(results)):
    cx = (i % cols) * cellw
    cy = (i // cols) * cellh
    sp = Image.open(f"{OUT}/{sid}.png")
    # upscale 2x for visibility on the sheet only
    sp2 = sp.resize((sp.width * 2, sp.height * 2), Image.NEAREST)
    ox = cx + (cellw - sp2.width) // 2
    oy = cy + (cellh - 20 - sp2.height) // 2 + 10
    sheet.alpha_composite(sp2, (max(cx, ox), max(cy, oy)))
    d.text((cx + 4, cy + cellh - 14), f"{sid[:16]} {results[sid]['size'][0]}", fill=(230, 226, 214))
sheet.save(f"{OUT}/_contact.png")
print(json.dumps(results, indent=0))
print("wrote", n, "sprites to", OUT)
