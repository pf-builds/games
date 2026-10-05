#!/usr/bin/env python3
"""Sapper's Path v5.2 music: encode the soundtrack loops and the win jingle into sappers-path/audio/, gapless-ready.

  /Users/peter/local-ai/.venv/bin/python tools/music-encode.py [--src DIR] [--kbps 96] [--check]

Needs numpy and the static ffmpeg that ships with imageio_ffmpeg (both in the local-ai venv). Reads the originals from
--src (default /Users/peter/local-ai/outputs/sapper-music, never committed), writes audio/<name>.m4a (AAC-LC in MP4,
44.1 kHz stereo, --kbps each; Safari and Chrome both decode it) and prints the numbers config.json audio.music needs.
--check re-decodes the files already in audio/ and checks them against config.json without encoding anything.

Each loop is the whole source file: every one is a whole number of bars (Calm2 24 bars at 56 bpm, Evil4 40 bars at
120 bpm, the theme "loop ready" per its page; measured in tools/v5-2-music-notes.md). Gapless on the web: a decoder may
or may not trim the AAC encoder's priming and padding, so each file is written PERIODIC around the loop: the loop's
last PRE seconds, then the loop, then its first POST seconds. loopStart = PRE and loopEnd = PRE + loop length (in
seconds of the file); because the audio on both sides of each point is the same music, a constant offset of up to PRE
(AAC priming is 2112 samples, 48 ms) still leaves an exact loop of the right length. A seam whose sample jump is larger
than the biggest step in the 10 ms around it (a click) gets a raised-cosine DC ramp over the loop's last RAMP samples
so its end meets its start; the step is reported either way.

Verification (printed; --check fails a loop that misses): the encoded file decoded by ffmpeg is compared with itself
one loop later over the POST pad (the RMS of buf[t] - buf[t + loop], in dB under the signal; AAC's own noise at 96 kbps
is -16 to -23 dB, a loop one period off is near 0; the check passes under -12 dB), and the sample step across
loopEnd -> loopStart must be no bigger than the steps in the 10 ms around it. The page repeats both checks in the
browser's own decoder (SP.musicCheck, run by tools/harness.mjs).
"""
import argparse, json, os, shutil, subprocess, sys
import numpy as np

SR = 44100
PRE, POST, RAMP = 0.25, 0.5, 256
GAME = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# name: (source file under --src, kind). kind "loop": a soundtrack loop; "jingle": played once.
TRACKS = {
    "theme": ("JRPG Theme [Loop Ready].wav", "loop"),
    "play": ("Calm2 - Childhood Friends.ogg", "loop"),
    "boss": ("Evil4 - Witch's Lair.ogg", "loop"),
    # The win jingle: config audio.music.jingle names which one plays (all three are encoded, about 11 KB each, so a swap
    # is a config edit). Kenney's jingles all run under 1.6 s; these three are major and rise (tools/v5-2-music-notes.md).
    "jingle-pizzi10": ("kenney-jingles/Audio/Pizzicato jingles/jingles_PIZZI10.ogg", "jingle"),
    "jingle-pizzi15": ("kenney-jingles/Audio/Pizzicato jingles/jingles_PIZZI15.ogg", "jingle"),
    "jingle-steel10": ("kenney-jingles/Audio/Steel jingles/jingles_STEEL10.ogg", "jingle"),
}
TARGET_RMS = 0.12  # loops are evened to about this RMS through their config gain (capped at MAXGAIN)
MAXGAIN = 1.6


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which("ffmpeg") or sys.exit("no ffmpeg: run with /Users/peter/local-ai/.venv/bin/python")


def decode(ff, path):
    raw = subprocess.run([ff, "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def step_vs_local(x, a, b, w=441):
    """The sample step from x[a] to x[b] (a seam) per channel, and the biggest step inside the w samples either side."""
    jump = np.abs(x[b] - x[a])
    near = np.concatenate([np.abs(np.diff(x[max(0, a - w):a + 1], axis=0)), np.abs(np.diff(x[b:b + w + 1], axis=0))])
    return jump, near.max(axis=0)


def encode(ff, pcm, out, kbps):
    tmp = out + ".f32"
    pcm.astype(np.float32).tofile(tmp)
    codec = "aac_at" if b"aac_at" in subprocess.run([ff, "-hide_banner", "-encoders"], capture_output=True).stdout else "aac"
    subprocess.run([ff, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp, "-c:a", codec, "-b:a", f"{kbps}k",
                    "-ar", str(SR), "-ac", "2", "-movflags", "+faststart", "-map_metadata", "-1", out], check=True)
    os.remove(tmp)
    return codec


def measure(ff, out, n_loop):
    """Decode the encoded file; return (decoded samples, the priming offset found, periodicity error dB, seam step, local max)."""
    y = decode(ff, out)
    pre, post = int(PRE * SR), int(POST * SR)
    a = pre + n_loop  # loopEnd in samples (file time, edit list honoured)
    seg = slice(pre, pre + post - 4096)
    d = y[seg] - y[seg.start + n_loop:seg.stop + n_loop]
    err_db = 10 * np.log10((d ** 2).mean() / max(1e-12, (y[seg] ** 2).mean()))
    jump, near = step_vs_local(y, a - 1, pre)
    return len(y), float(err_db), jump, near


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="/Users/peter/local-ai/outputs/sapper-music")
    ap.add_argument("--kbps", type=int, default=96)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    ff, outdir = ffmpeg(), os.path.join(GAME, "audio")
    os.makedirs(outdir, exist_ok=True)
    cfg = json.load(open(os.path.join(GAME, "config.json")))["audio"]["music"]["tracks"] if a.check else None
    res, bad = {}, 0
    for name, (src, kind) in TRACKS.items():
        out = os.path.join(outdir, name + ".m4a")
        if kind == "jingle":
            if not a.check:
                x = decode(ff, os.path.join(a.src, src)); nz = np.nonzero(np.abs(x).max(axis=1) > 1e-4)[0]
                x = x[: nz[-1] + 1 + int(0.05 * SR)]  # its own tail of silence trimmed to 50 ms
                encode(ff, x, out, a.kbps)
            y = decode(ff, out)
            res[name] = {"file": "audio/" + name + ".m4a", "src": os.path.basename(src), "s": round(len(y) / SR, 3), "rms": round(float(np.sqrt((y ** 2).mean())), 4), "peak": round(float(np.abs(y).max()), 3)}
            continue
        if a.check:
            n = round((cfg[name]["loopEnd"] - cfg[name]["loopStart"]) * SR)
        else:
            x = decode(ff, os.path.join(a.src, src)); n = len(x)
            jump, near = step_vs_local(x, n - 1, 0, 441)
            fixed = bool((jump > near).any())
            if fixed:  # a click at the seam: ramp the loop's end onto its start (the slope kept), per channel
                slope = x[n - 1] - x[n - 2]; delta = x[0] - (x[n - 1] + slope)
                w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, RAMP))
                x[n - RAMP:] += w[:, None] * delta[None, :]
            rms = float(np.sqrt((x ** 2).mean()))
            pre, post = int(PRE * SR), int(POST * SR)
            pcm = np.concatenate([x[n - pre:], x, x[:post]])
            codec = encode(ff, pcm, out, a.kbps)
        L, err_db, sj, sn = measure(ff, out, n)
        r = {"file": "audio/" + name + ".m4a", "loopStart": PRE, "loopEnd": round(PRE + n / SR, 6), "loopSamples": n,
             "seamDb": round(err_db, 1), "seamJump": [round(float(v), 4) for v in sj], "seamNear": [round(float(v), 4) for v in sn]}
        if not a.check:
            r.update({"srcSeamJump": [round(float(v), 4) for v in jump], "srcSeamNear": [round(float(v), 4) for v in near], "ramped": fixed,
                      "rms": round(rms, 4), "gain": round(min(MAXGAIN, TARGET_RMS / rms), 2), "codec": codec, "decoded": L})
        else:
            ok = abs(r["loopEnd"] - cfg[name]["loopEnd"]) < 1e-6 and err_db < -12 and (sj <= sn * 1.05).all()
            r["ok"] = bool(ok); bad += not ok
        res[name] = r
    sizes = {f: os.path.getsize(os.path.join(outdir, f)) for f in sorted(os.listdir(outdir))}
    print(json.dumps({"tracks": res, "bytes": sizes, "total": sum(sizes.values())}, indent=1))
    if bad:
        sys.exit(f"{bad} track(s) failed the check")


if __name__ == "__main__":
    main()
