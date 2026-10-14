#!/usr/bin/env python3
"""Sapper's Path lane P Stage 5, covers D-F: cover-boards.mjs's board grabs cut to each cover's exact size. The scene's
cells (its dirt border dropped; the bottom border row kept, where the sappers walk in from the camp) are scaled DOWN to
cover the target (never up: it stops if a scene would need an upscale) and cropped (keeping the bottom: the title's sky
band at the top gives way first). A light lift for a cover (colour x COLOR, brightness x BRIGHT). F is the game's own
before/after: the scene as dealt left of a diagonal, the same scene well into the dig right of it, an ink seam between.
  python3 cover-crop.py <boards dir> <levels.json> <out dir> [--pick D=1500,E=1900,F=6000]
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageEnhance

SIZES = {"land": (1920, 1080), "port": (800, 1200), "square": (800, 800), "port@1080x1620": (1080, 1620)}  # the last: the portrait video's first frame
PICK = {"D": 1650, "E": 1600, "F": 6000}  # sim ms of the grab used per option (F: its "after")
COLOR, BRIGHT = 1.12, 1.03
SEAM = 0.011  # F: the diagonal's ink seam, as a share of the cover's width
DIAG = (0.62, 0.38)  # F: where the diagonal meets the top and the bottom edge (shares of the width)


def scene(path, L):
    im = Image.open(path).convert("RGB"); cs = im.size[0] // L["w"]
    return im.crop((cs, cs, (L["w"] - 1) * cs, L["h"] * cs)), cs  # the cells plus the bottom border row


def fit(im, W, H, tag):
    k = max(W / im.size[0], H / im.size[1])
    if k > 1.0001: sys.exit(f"{tag}: needs a x{k:.3f} upscale ({im.size} -> {W}x{H}); make its grid bigger")
    w, h = round(im.size[0] * k), round(im.size[1] * k)
    im = im.resize((w, h), Image.LANCZOS); x0, y0 = (w - W) // 2, h - H
    return im.crop((x0, y0, x0 + W, y0 + H)), k


def lift(im): return ImageEnhance.Brightness(ImageEnhance.Color(im).enhance(COLOR)).enhance(BRIGHT)


def diagonal(before, after):
    W, H = before.size; S = 4; a, b = DIAG
    m = Image.new("L", (W * S, H * S), 0); g = ImageDraw.Draw(m)
    g.polygon([(a * W * S, 0), (W * S, 0), (W * S, H * S), (b * W * S, H * S)], fill=255)
    out = Image.composite(after, before, m.resize((W, H), Image.LANCZOS))
    s = Image.new("L", (W * S, H * S), 0); ImageDraw.Draw(s).line([(a * W * S, 0), (b * W * S, H * S)], fill=255, width=max(4, round(SEAM * W * S)))
    out.paste((29, 26, 38), (0, 0), s.resize((W, H), Image.LANCZOS))
    return out


def main(boards, levels, out, pick):
    LV = json.load(open(levels)); os.makedirs(out, exist_ok=True)
    for o in "DEF":
        for size, (W, H) in SIZES.items():
            key = f"cover{o}_{size.split('@')[0]}"; L = LV[key]
            src, cs = scene(os.path.join(boards, f"{key}-{pick[o]}.png"), L)
            im, k = fit(src, W, H, key)
            if o == "F": im = diagonal(fit(scene(os.path.join(boards, f"{key}-t0.png"), L)[0], W, H, key)[0], im)
            lift(im).save(os.path.join(out, f"art-{o}-{size}.png"))
            print(f"art-{o}-{size}.png {W}x{H}: {key} at {pick[o]} ms, {cs} px cells scaled x{k:.3f} ({cs * k:.1f} px a cell on the cover)")


if __name__ == "__main__":
    a = sys.argv; p = dict(PICK)
    if "--pick" in a: p.update({kv.split("=")[0]: int(kv.split("=")[1]) for kv in a[a.index("--pick") + 1].split(",")})
    main(a[1], a[2], a[3], p)
