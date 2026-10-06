#!/usr/bin/env python3
"""Sapper's Path v5.3: the home screen's painted siege (Peter's pick, 2026-10-06: SDXL base 1.0 seed 23, variant h,
/Users/peter/local-ai/sapper_card.py --variant h --seed 23 --w 1344 --h 768) into the game's art/ folder.

The painting is never altered: a Lanczos 2x upscale with a light unsharp mask makes the master (kept beside the source,
not in the repo), then two JPEGs are cut from it:
  art/home-wide.jpg  the whole painting, 1920 px wide (desktop and landscape)
  art/home-tall.jpg  a 9:16 crop the painting's full height (sky at the top), 1080x1920, centred on the keep (phones upright)
Each JPEG takes the highest quality that keeps it under MAX_KB. Prints the sizes and the keep's x in each image as a
fraction of its width (config.json title.art.*.castleX).

  python3 tools/home-art.py [source.png]
"""
import io, os, sys
from PIL import Image, ImageFilter

SRC = "/Users/peter/local-ai/outputs/sapper-card/home-h-s23.png"
MASTER = "/Users/peter/local-ai/outputs/sapper-card/home-h-s23-2x.png"
ART = os.path.join(os.path.dirname(__file__), "..", "art")
KEEP_X = 778  # the keep's centre in the 1344-wide source (its walls run 697 to 858): the castle's centre
WIDE_W, TALL = 1920, (1080, 1920)
MIN_KB, MAX_KB = 250, 450


def jpeg(im, path):
    best = None
    for q in range(92, 59, -2):
        b = io.BytesIO(); im.save(b, "JPEG", quality=q, optimize=True, progressive=True, subsampling=2)
        if b.tell() <= MAX_KB * 1024: best = (q, b.getvalue()); break
    if not best: sys.exit(f"{path}: over {MAX_KB} KB at quality 60")
    open(path, "wb").write(best[1])
    print(f"{os.path.relpath(path)}: {im.size[0]}x{im.size[1]}, quality {best[0]}, {len(best[1]) / 1024:.0f} KB" + ("" if len(best[1]) >= MIN_KB * 1024 else " (under the floor: fine)"))


def main(src):
    im = Image.open(src).convert("RGB"); w, h = im.size
    m = im.resize((w * 2, h * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    m.save(MASTER); print("master:", MASTER, m.size)
    os.makedirs(ART, exist_ok=True)
    k = KEEP_X * 2
    wide = m.resize((WIDE_W, round(WIDE_W * m.size[1] / m.size[0])), Image.LANCZOS)
    jpeg(wide, os.path.join(ART, "home-wide.jpg")); print(f"  castleX {KEEP_X / w:.4f}")
    cw = round(m.size[1] * TALL[0] / TALL[1]); x0 = max(0, min(m.size[0] - cw, k - cw // 2))
    tall = m.crop((x0, 0, x0 + cw, m.size[1])).resize(TALL, Image.LANCZOS)
    jpeg(tall, os.path.join(ART, "home-tall.jpg")); print(f"  crop x {x0 // 2}..{(x0 + cw) // 2} of the source, castleX {(k - x0) / cw:.4f}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else SRC)
