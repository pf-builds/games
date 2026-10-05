# Sapper's Path v5 map: paint ONE sheet image with SDXL base 1.0 img2img (Peter's one-image rule). Never SDXL-Turbo.
# Based on /Users/peter/local-ai/sdxl_base.py. Two passes per sheet:
#   base: the coded biome guide (no road) at high strength -> the painted land in the seed-61 parchment style
#   road: that painting with the coded road layer laid on top, at low strength -> the road painted in, where we put it
# Usage: /Users/peter/local-ai/.venv/bin/python paint.py base <sheet 1-25> <seed> [strength]
#        /Users/peter/local-ai/.venv/bin/python paint.py road <sheet 1-25> <seed> <base.png> [strength]
import os, sys, time, json, pathlib
os.environ.setdefault("HF_HUB_CACHE", "/Users/peter/local-ai/hf-cache/hub")
import torch
from diffusers import StableDiffusionXLImg2ImgPipeline
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
P = json.load(open(HERE / "plan.json")); M = P["model"]
G, OUT = pathlib.Path(P["out"]["guides"]), pathlib.Path(P["out"]["candidates"]); OUT.mkdir(parents=True, exist_ok=True)
mode, sheet, seed = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
realm, sh = [(r, s) for r in P["realms"] for s in r["sheets"]][sheet - 1]
prompt = P["stylePrefix"] + sh.get("prompt", realm["prompt"])   # v5 R4c: a sheet can carry its own prompt (the summit)
if mode == "base":                                # no road in the land pass: the road is ours, laid on in pass 2
    prompt = prompt.replace(P["roadPhrase"], "")
    strength = float(sys.argv[4]) if len(sys.argv) > 4 else realm.get("baseStrength", M["baseStrength"])
    init = Image.open(G / f"base-{sheet:02d}.png").convert("RGB")
    name = f"base-{sheet:02d}-s{seed}-st{round(strength * 100)}.png"
else:
    src = pathlib.Path(sys.argv[4]); strength = float(sys.argv[5]) if len(sys.argv) > 5 else M["roadStrength"]
    init = Image.open(src).convert("RGBA"); init.alpha_composite(Image.open(G / f"road-{sheet:02d}.png").convert("RGBA"))
    init = init.convert("RGB")
    name = f"sheet-{sheet:02d}-s{seed}-st{round(strength * 100)}-{src.stem.replace(f'base-{sheet:02d}-', 'b')}.png"
    init.save(OUT / "composite" / name) if (OUT / "composite").is_dir() else None

t0 = time.time()
pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(M["id"], torch_dtype=torch.float16, variant="fp16",
                                                        use_safetensors=True).to("mps")
pipe.vae.enable_slicing(); pipe.vae.enable_tiling()
t1 = time.time(); print(f"loaded in {t1 - t0:.1f}s", flush=True)
g = torch.Generator(device="cpu").manual_seed(seed)
neg = P["neg"] + realm.get("negExtra", "")         # v5 R4c: a realm can add to the negative prompt (perspective peaks)
im = pipe(prompt=prompt, negative_prompt=neg, image=init, strength=strength, num_inference_steps=M["steps"],
          guidance_scale=M["guidance"], generator=g).images[0]
p = OUT / name; im.save(p)
print(f"saved {p} mode {mode} sheet {sheet} realm {realm['realm']} seed {seed} strength {strength} steps {M['steps']} "
      f"guidance {M['guidance']} gen {time.time() - t1:.1f}s total {time.time() - t0:.1f}s", flush=True)
print(f"prompt: {prompt}", flush=True)
