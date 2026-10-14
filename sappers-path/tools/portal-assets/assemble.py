#!/usr/bin/env python3
"""Sapper's Path lane P Stage 5: one preview video from the cover and capture.mjs's shot folders. The cover is held for
COVER_S (frame 0 is the cover), then crossfades over XFADE_FRAMES into the first shot (the home: the same painting); every
other shot joins on a hard cut. No black frames, nothing added on top, no audio track. Encoded with the local ffmpeg as
MP4 / H.264 High / yuv420p / 30 fps / +faststart. Then: the stream facts (ffmpeg -i; no ffprobe here), blackdetect, frame 0 against the cover (PSNR), and
stills at 0, 5, 10 and 15 s.
  python3 assemble.py <cover.png> <frames dir (01-*, 02-*, ...)> <out.mp4> [--crf 18]"""
import glob, json, os, re, shutil, subprocess, sys, tempfile
from PIL import Image
FF = "/Users/peter/.local/bin/ffmpeg"
FPS, COVER_S, XFADE_FRAMES = 30, 1.0, 12
a = sys.argv; cover, frames, out = a[1], a[2], a[3]; crf = a[a.index("--crf") + 1] if "--crf" in a else "18"
shots = sorted(d for d in glob.glob(os.path.join(frames, "[0-9][0-9]-*")) if os.path.isdir(d))
seq = tempfile.mkdtemp(prefix="sp-seq-"); n = 0
def put(src=None, im=None):
    global n; dst = os.path.join(seq, f"{n:05d}.png")
    if im is not None: im.save(dst)
    else: os.symlink(os.path.abspath(src), dst)
    n += 1
cv = Image.open(cover).convert("RGB")
for _ in range(round(COVER_S * FPS)): put(cover)
for k, d in enumerate(shots):
    fs = sorted(glob.glob(os.path.join(d, "f*.png")))
    if Image.open(fs[0]).size != cv.size: sys.exit(f"{d}: frames are {Image.open(fs[0]).size}, the cover {cv.size}")
    for i, f in enumerate(fs):
        if k == 0 and i < XFADE_FRAMES: put(im=Image.blend(cv, Image.open(f).convert("RGB"), (i + 1) / (XFADE_FRAMES + 1)))
        else: put(f)
print(f"{n} frames = {n / FPS:.2f} s from {len(shots)} shots")
subprocess.run([FF, "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(seq, "%05d.png"), "-c:v", "libx264", "-preset", "slow", "-crf", crf,
                "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(FPS), "-movflags", "+faststart", "-an", out], check=True)
shutil.rmtree(seq)
# No ffprobe on this Mac: the facts come from ffmpeg's own stream report and a full decode (frame count, duration).
info = subprocess.run([FF, "-hide_banner", "-i", out], capture_output=True, text=True).stderr
dec = subprocess.run([FF, "-hide_banner", "-i", out, "-f", "null", "-"], capture_output=True, text=True).stderr
vline = [l.strip() for l in info.splitlines() if "Stream #" in l and "Video:" in l]
nfr = int(re.findall(r"frame=\s*(\d+)", dec)[-1])
print(json.dumps({"file": os.path.basename(out), "size_MB": round(os.path.getsize(out) / 1e6, 2), "container_duration": re.search(r"Duration: ([\d:.]+)", info).group(1),
                  "decoded_frames": nfr, "decoded_s": round(nfr / FPS, 3), "video": vline, "audio_streams": sum("Audio:" in l for l in info.splitlines())}, indent=1))
bd = subprocess.run([FF, "-v", "info", "-i", out, "-vf", "blackdetect=d=0.05:pix_th=0.10", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
print("blackdetect:", [l.split("] ")[-1] for l in bd.splitlines() if "black_start" in l] or "none")
ps = subprocess.run([FF, "-v", "info", "-i", out, "-i", cover, "-lavfi", "[0:v]trim=end_frame=1,format=rgb24[a];[1:v]format=rgb24[b];[a][b]psnr", "-f", "null", "-"], capture_output=True, text=True).stderr
print("frame 0 vs cover:", [l.split("] ")[-1] for l in ps.splitlines() if "PSNR" in l][-1])
stem = os.path.splitext(out)[0]
for t in (0, 5, 10, 15):
    subprocess.run([FF, "-y", "-loglevel", "error", "-ss", str(t), "-i", out, "-frames:v", "1", f"{stem}-still-{t:02d}s.png"], check=True)
print("stills:", ", ".join(f"{os.path.basename(stem)}-still-{t:02d}s.png" for t in (0, 5, 10, 15)))
