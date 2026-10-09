#!/usr/bin/env python3
# Sapper's Path v7 lane T, stage 2 (tools/space-v7-notes.md §4): the 25 castle map sheets from JPEG to WebP with the
# land sheets' encoder and rule (game-research/.../lands/*/map/scripts/assemble.py: Pillow WEBP, method 6, quality
# from 96 down by 2 until the file fits webpMaxKB 250; every land sheet landed on q94). Writes map/sheet-NN.webp beside
# each map/sheet-NN.jpg and tools/space-v7/webp-sheets.json (quality, bytes before and after, PSNR against the JPEG).
#   python3 tools/space-v7/webp-sheets.py            encode (the JPEGs stay until the page and tools point at the WebP)
#   python3 tools/space-v7/webp-sheets.py --crops    side-by-side crops (JPEG | WebP | difference x8) into tools/space-v7/crops/
import io, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

GAME = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MAP, OUT = os.path.join(GAME, "map"), os.path.dirname(os.path.abspath(__file__))
Q0, Q1, MAXKB = 96, 70, 250  # the land sheets' plan.json webpQuality [96, 70] and webpMaxKB 250
psnr = lambda a, b: round(float(10 * np.log10(255 ** 2 / max(1e-9, np.mean((a.astype(float) - b.astype(float)) ** 2)))), 2)

def encode():
    rows = []
    for i in range(1, 26):
        src = os.path.join(MAP, f"sheet-{i:02d}.jpg"); im = Image.open(src).convert("RGB"); A = np.asarray(im)
        for q in range(Q0, Q1 - 1, -2):
            buf = io.BytesIO(); im.save(buf, "WEBP", quality=q, method=6)
            if buf.tell() <= MAXKB * 1024: break
        open(os.path.join(MAP, f"sheet-{i:02d}.webp"), "wb").write(buf.getvalue())
        B = np.asarray(Image.open(io.BytesIO(buf.getvalue())).convert("RGB"))
        rows.append({"sheet": i, "q": q, "jpg": os.path.getsize(src), "webp": buf.tell(), "psnr": psnr(A, B)})
        print(f"sheet-{i:02d}: q{q} {rows[-1]['jpg']:,} -> {rows[-1]['webp']:,} B, PSNR {rows[-1]['psnr']} dB")
    tj, tw = sum(r["jpg"] for r in rows), sum(r["webp"] for r in rows)
    json.dump({"note": "v7 lane T stage 2: castle sheets JPEG -> WebP (Pillow WEBP method 6, quality 96 down by 2 to fit 250 KB, the land sheets' rule); psnr is the WebP against the JPEG it was made from.", "jpg": tj, "webp": tw, "sheets": rows}, open(os.path.join(OUT, "webp-sheets.json"), "w"), indent=1)
    print(f"total {tj:,} -> {tw:,} B ({tj - tw:,} B saved)")

# A crop of the JPEG (git history once the JPEGs leave: pass --from-git) beside the WebP and their difference x8, 2x.
def crops():
    os.makedirs(os.path.join(OUT, "crops"), exist_ok=True)
    picks = [(1, 160, 820), (8, 300, 520), (13, 250, 300), (16, 420, 900), (21, 120, 600), (25, 250, 40)]  # sheet, x, y: busy roads, forts, water, sheet 25's fog
    for s, x, y in picks:
        J = Image.open(jpg_of(s)).convert("RGB"); W = Image.open(os.path.join(MAP, f"sheet-{s:02d}.webp")).convert("RGB")
        box = (x, y, x + 256, y + 256); a, b = J.crop(box), W.crop(box)
        d = Image.fromarray(np.clip(np.abs(np.asarray(a).astype(int) - np.asarray(b).astype(int)) * 8, 0, 255).astype(np.uint8))
        out = Image.new("RGB", (3 * 512 + 40, 512 + 36), (24, 22, 28)); dr = ImageDraw.Draw(out)
        for k, (im, lab) in enumerate([(a, "JPEG (shipped to v6.3)"), (b, "WebP (v7)"), (d, "difference x8")]):
            out.paste(im.resize((512, 512), Image.NEAREST), (k * 532, 36)); dr.text((k * 532 + 4, 10), f"sheet-{s:02d} {box} {lab}", fill=(240, 236, 220))
        out.save(os.path.join(OUT, "crops", f"sheet-{s:02d}.png")); print("crops/sheet-%02d.png" % s)

def jpg_of(s):
    p = os.path.join(MAP, f"sheet-{s:02d}.jpg")
    if os.path.exists(p): return p
    import subprocess; data = subprocess.run(["git", "-C", GAME, "show", f"a11e9bf:sappers-path/map/sheet-{s:02d}.jpg"], capture_output=True, check=True).stdout
    return io.BytesIO(data)

if __name__ == "__main__":
    crops() if "--crops" in sys.argv else encode()
