#!/usr/bin/env python3
"""Turns a raw screenshot into a web-ready JPEG in public/assets/shots/ and prints the entry for shared.json.

    python3 scripts/optimize-image.py raw/dashboard.png belmally-dashboard --width 960
    python3 scripts/optimize-image.py raw/phone.png miqat-home --width 540 --crop-top 150 --crop-bottom 20

--width       output width in pixels (default 540; use about twice the width it is shown at)
--crop-top    pixels to cut from the top of the original, e.g. the status bar of a phone screenshot
--crop-bottom pixels to cut from the bottom of the original
--quality     JPEG quality (default 80)
--dest        folder to write to (default public/assets/shots)

Keep the raw originals outside the repository (the raw/ folder is ignored by git); only the optimized file is committed.
Needs Pillow: pip install pillow
"""

import argparse
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser(description="Optimize a screenshot for the site")
    ap.add_argument("source")
    ap.add_argument("name", help="output file name without extension, e.g. miqat-home")
    ap.add_argument("--width", type=int, default=540)
    ap.add_argument("--crop-top", type=int, default=0)
    ap.add_argument("--crop-bottom", type=int, default=0)
    ap.add_argument("--quality", type=int, default=80)
    ap.add_argument("--dest", default=os.path.join(ROOT, "public", "assets", "shots"))
    a = ap.parse_args()

    if not os.path.exists(a.source):
        sys.exit(f"No such file: {a.source}")
    im = Image.open(a.source).convert("RGB")
    w, h = im.size
    if a.crop_top + a.crop_bottom >= h:
        sys.exit(f"Cropping {a.crop_top}+{a.crop_bottom}px leaves nothing of a {h}px tall image")
    im = im.crop((0, a.crop_top, w, h - a.crop_bottom))
    if im.width > a.width:  # never upscale
        im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)

    os.makedirs(a.dest, exist_ok=True)
    out = os.path.join(a.dest, f"{a.name}.jpg")
    im.save(out, "JPEG", quality=a.quality, optimize=True, progressive=True)
    kb = os.path.getsize(out) / 1024
    print(f"wrote {os.path.relpath(out, ROOT)}  {im.width}x{im.height}  {kb:.0f} KB")
    if kb > 200:
        print("note: over 200 KB; try a smaller --width or --quality", file=sys.stderr)
    print("shared.json entry:")
    print(json.dumps({"src": f"assets/shots/{a.name}.jpg", "w": im.width, "h": im.height}))


if __name__ == "__main__":
    main()
