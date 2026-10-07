#!/usr/bin/env python3
"""Reads the painted city map and writes the terrain the game plays on.

Usage: tools/make_terrain_mask.py [PREVIEW.png]

Input:  assets/maps/city.png          the map as painted
Output: assets/maps/city_terrain.png  one pixel per game cell, coloured by terrain

The mask is an ordinary picture: it can be opened and corrected by hand, and the
game reads whatever is in it. Roads are not detected here; they are listed in
scripts/sim/map_library.gd and laid over the mask when the map loads.

Colours: black open ground, blue water, red buildings, green orchards and fields,
yellow high ground.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SOURCE = "assets/maps/city.png"
MASK = "assets/maps/city_terrain.png"
CELLS = 84

# High ground cannot be told from dark fields by colour, so the hills are outlined
# by hand, in pixels of a 1254 px wide picture.
HILLS = [
    [(0, 0), (95, 0), (90, 90), (40, 170), (0, 180)],
    [(1040, 0), (1254, 0), (1254, 280), (1130, 260), (1080, 150)],
    [(1100, 310), (1254, 310), (1254, 470), (1160, 440)],
    [(1010, 830), (1254, 850), (1254, 1254), (860, 1254), (900, 1090), (1000, 1020)],
    [(0, 930), (240, 930), (290, 1000), (300, 1254), (0, 1254)],
]

OPEN = (0, 0, 0)
WATER = (0, 0, 255)
TOWN = (255, 0, 0)
GROVE = (0, 255, 0)
HIGH = (255, 255, 0)


def blurred(array, radius):
    image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), float)


def main():
    picture = Image.open(SOURCE).convert("RGB")
    size = picture.size[0]
    rgb = np.asarray(picture.filter(ImageFilter.GaussianBlur(3)), float)
    grey = np.asarray(picture.convert("L"), float)
    bright = rgb.mean(axis=2)
    blueness = rgb[..., 2] - rgb[..., 0]

    grad_y, grad_x = np.gradient(blurred(grey, 1))
    texture = blurred(np.hypot(grad_x, grad_y) * 4.0, 6) / 4.0
    # Roofs are the only near-white things on the map.
    roofs = blurred((grey > 175) * 255.0, 7) / 255.0
    broad = blurred(bright, 22)

    water = (blueness > 47) & (texture < 5.5) & (bright < 96)
    # Close the gaps that ripples and small islands leave in the river.
    closed = Image.fromarray((water * 255).astype(np.uint8))
    closed = closed.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(13)).filter(ImageFilter.MaxFilter(5))
    outline = Image.new("L", picture.size, 0)
    scale = size / 1254.0
    for hill in HILLS:
        ImageDraw.Draw(outline).polygon([(x * scale, y * scale) for x, y in hill], fill=255)
    hills = np.asarray(outline) > 0
    # Dark slopes look like water to the colour test; there is none in the hills.
    water = (np.asarray(closed) > 127) & ~hills
    town = (roofs > 0.085) & ~water
    high = hills & ~town
    grove = (bright < 94) & (broad < 112) & ~water & ~town & ~high

    cell = size / CELLS
    mask = Image.new("RGB", (CELLS, CELLS), OPEN)
    for y in range(CELLS):
        for x in range(CELLS):
            box = (slice(int(y * cell), int((y + 1) * cell)), slice(int(x * cell), int((x + 1) * cell)))
            if water[box].mean() > 0.45:
                mask.putpixel((x, y), WATER)
            elif town[box].mean() > 0.5:
                mask.putpixel((x, y), TOWN)
            elif high[box].mean() > 0.55:
                mask.putpixel((x, y), HIGH)
            elif grove[box].mean() > 0.5:
                mask.putpixel((x, y), GROVE)
    mask.save(MASK)

    counts = {}
    for pixel in mask.getdata():
        counts[pixel] = counts.get(pixel, 0) + 1
    print(MASK, {name: counts.get(color, 0) for name, color in
                 (("open", OPEN), ("water", WATER), ("town", TOWN), ("grove", GROVE), ("high", HIGH))})

    if len(sys.argv) > 1:
        tint = mask.resize(picture.size, Image.NEAREST)
        shown = np.asarray(tint, float)
        covered = (shown.sum(axis=2, keepdims=True) > 0) * 0.42
        preview = np.asarray(picture, float) * (1.0 - covered) + shown * covered
        Image.fromarray(preview.astype(np.uint8)).save(sys.argv[1])


if __name__ == "__main__":
    main()
