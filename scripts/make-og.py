#!/usr/bin/env python3
"""Generates the social share image (1200x630) of every case study into public/og/<id>.png.

Run it after adding or renaming a case study (needs Pillow: pip install pillow):

    python3 scripts/make-og.py

The images are committed, so the build and CI need nothing extra. A test fails when a case study has no image.
The text is Latin on purpose: project names are brand names, so the same image fits the English and Arabic pages.
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
BG = (10, 17, 30)
FG = (229, 236, 245)
MUTED = (147, 161, 184)
ACCENT = (90, 169, 255)
CYAN = (79, 209, 238)

# One line under the name. Add an entry here when you add a case study.
TAGLINES = {
    "dikirnis": "A local super-app, built solo in Flutter",
    "prime-source": "A Hajj app cut from 250 MB to 85 MB",
    "miqat": "A free, ad-free Islamic app in Flutter",
    "reposphere": "One inbox for all your Git work",
    "belmally": "Four apps on one API, built solo",
    "xprinter": "PDFs on Bluetooth thermal printers",
}
MARKS = {"prime-source": "PS", "belmally": "B", "xprinter": "XP"}  # shown when there is no screenshot

FONT_DIRS = ["/System/Library/Fonts/Supplemental", "/Library/Fonts", "/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation"]


def font(names, size, index=0):
    for d in FONT_DIRS:
        for n in names:
            path = os.path.join(d, n)
            if os.path.exists(path):
                return ImageFont.truetype(path, size, index=index)
    sys.exit(f"No font found for {names}; edit FONT_DIRS in scripts/make-og.py")


BOLD = ["Arial Bold.ttf", "LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf"]
REGULAR = ["Arial.ttf", "LiberationSans-Regular.ttf", "DejaVuSans.ttf"]
MONO = ["Courier New.ttf", "LiberationMono-Regular.ttf", "DejaVuSansMono.ttf"]


def background():
    img = Image.new("RGB", (W, H), BG)
    px = img.load()
    # soft blue glow from the bottom right, like the home page image
    for y in range(H):
        for x in range(W):
            d = ((x - 1150) ** 2 + (y - 640) ** 2) ** 0.5
            t = max(0.0, 1 - d / 900)
            k = t * t * 0.55
            r, g, b = px[x, y]
            px[x, y] = (int(r + (20 - r) * k), int(g + (95 - g) * k), int(b + (140 - b) * k))
    return img


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius, fill=255)
    img.putalpha(mask)
    return img


def make(case, title, shot):
    img = background().convert("RGBA")
    d = ImageDraw.Draw(img)
    text_w = 640 if shot or case["id"] in MARKS else 1000

    if shot:
        s = Image.open(os.path.join(ROOT, "public", shot)).convert("RGBA")
        w = 330
        s = s.resize((w, int(s.height * w / s.width)))
        frame = Image.new("RGBA", (w + 16, 640), (255, 255, 255, 0))
        fd = ImageDraw.Draw(frame)
        fd.rounded_rectangle((0, 0, w + 15, 700), 38, fill=(2, 6, 13, 255), outline=(60, 80, 110, 255), width=2)
        frame.paste(rounded(s, 28), (8, 8), s)
        img.alpha_composite(frame, (830, 70))
    elif case["id"] in MARKS:
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))  # drawn on its own layer so the alpha blends
        od = ImageDraw.Draw(overlay)
        od.ellipse((860, 150, 1140, 430), fill=(90, 169, 255, 38), outline=(90, 169, 255, 130), width=3)
        od.text((1000, 290), MARKS[case["id"]], font=font(BOLD, 110), fill=(229, 236, 245, 235), anchor="mm")
        img.alpha_composite(overlay)

    d.text((80, 90), "CASE STUDY", font=font(MONO, 26), fill=CYAN)
    size = 96
    tf = font(BOLD, size)
    while d.textlength(title, font=tf) > text_w and size > 48:
        size -= 4
        tf = font(BOLD, size)
    lines = wrap(d, title, tf, text_w)
    y = 150
    for line in lines:
        d.text((80, y), line, font=tf, fill=FG)
        y += int(size * 1.12)
    y += 18
    for line in wrap(d, TAGLINES[case["id"]], font(REGULAR, 40), text_w):
        d.text((80, y), line, font=font(REGULAR, 40), fill=ACCENT)
        y += 52

    d.line((80, 520, 560, 520), fill=(34, 48, 73), width=2)
    d.text((80, 545), "Atef Elsaeed", font=font(BOLD, 34), fill=FG)
    d.text((80, 590), "Senior Flutter Developer  ·  atefelsaeed.github.io", font=font(REGULAR, 24), fill=MUTED)
    return img.convert("RGB")


def main():
    shared = json.load(open(os.path.join(ROOT, "src/content/shared.json"), encoding="utf-8"))
    en = json.load(open(os.path.join(ROOT, "src/content/en.json"), encoding="utf-8"))
    titles = {c["id"]: c["title"] for c in en["cases"]}
    os.makedirs(os.path.join(ROOT, "public/og"), exist_ok=True)
    for case in shared["cases"]:
        if case["id"] not in TAGLINES:
            sys.exit(f'Add a tagline for "{case["id"]}" to TAGLINES in scripts/make-og.py')
        shot = (case.get("shots") or [{}])[0].get("src")
        out = os.path.join(ROOT, "public/og", f'{case["id"]}.png')
        make(case, titles[case["id"]], shot).save(out, optimize=True)
        print("wrote", os.path.relpath(out, ROOT), os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    main()
