#!/usr/bin/env python3
"""Sapper's Path lane P Stage 5: the covers' painted siege, cut to each cover's exact pixel size from the ORIGINAL painting
(the 1344x768 SDXL render behind art/home-*.jpg, tools/home-art.py), never from the game's JPEGs. Lanczos straight to the
target size, then the same light unsharp mask home-art.py uses on the home's master. Prints each cut's source box and its
scale (over 1 = an upscale: the softness risk the covers rule names).
  python3 prep-art.py <out dir> [source.png]
"""
import os, sys
from PIL import Image, ImageFilter

SRC = "/Users/peter/local-ai/outputs/sapper-card/home-h-s23.png"
KEEP_X = 778  # the keep's centre in the 1344-wide source (home-art.py)
CUTS = {  # name: (target w, h, source box as (x0, y0, w, h) or None for the widest box centred on the keep)
    "land": (1920, 1080, (0, 0, 1344, 756)),  # 16:9 from the top (keeps the flags; loses 12 px of foreground)
    "port": (800, 1200, None),                # 2:3, full height, centred on the keep
    "square": (800, 800, None),               # 1:1, full height, centred on the keep
}


def box(im, w, h):
    W, H = im.size; bw = round(H * w / h); x0 = max(0, min(W - bw, KEEP_X - bw // 2)); return (x0, 0, bw, H)


def main(out, src):
    im = Image.open(src).convert("RGB"); os.makedirs(out, exist_ok=True)
    print("source", src, im.size)
    for name, (w, h, b) in CUTS.items():
        x0, y0, bw, bh = b or box(im, w, h)
        cut = im.crop((x0, y0, x0 + bw, y0 + bh)).resize((w, h), Image.LANCZOS)
        cut = cut.filter(ImageFilter.UnsharpMask(radius=1.2, percent=45, threshold=2))
        cut.save(os.path.join(out, f"paint-{name}.png"))
        print(f"paint-{name}.png {w}x{h} from source box x {x0}..{x0 + bw}, y {y0}..{y0 + bh} ({bw}x{bh}): scale x{w / bw:.3f}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else SRC)
