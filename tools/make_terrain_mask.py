#!/usr/bin/env python3
"""Reads the painted city map and writes the terrain the game plays on.

Usage: tools/make_terrain_mask.py [PREVIEW.png]

Input:  assets/maps/city.png           the map as painted
        assets/maps/source/city_vehicles.png  the same map with everything vehicles may
                                       drive on painted red (made by the owner)
Output: assets/maps/city_terrain.png   one pixel per game cell, coloured by terrain
        assets/maps/city_drive.png     one pixel per game cell, white where vehicles go

A game cell is CELL x CELL pixels of the picture, small enough to keep the gaps
between houses open. The mask is an ordinary picture: it can be opened and
corrected by hand, and the game reads whatever is in it.

Colours:
  white   street: red in the vehicle picture and inside the built-up area
  red     building: nobody passes
  magenta yards and alleys between buildings: infantry only, good cover
  green   orchards, fields and trees: infantry only, slow, concealed
  yellow  high ground: infantry only, slow, sees far
  blue    water: nobody passes
  black   open ground: infantry only

Water and buildings are found from colour. Hills cannot be told from open ground
that way, so they are outlined by hand below. Where vehicles may drive comes
from the owner's red picture and nothing else. The main roads, which only make
vehicles faster, are traced by hand in scripts/sim/map_library.gd and laid over
the mask when the map loads; there a road over water becomes a bridge.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SOURCE = "assets/maps/city.png"
VEHICLES = "assets/maps/source/city_vehicles.png"
MASK = "assets/maps/city_terrain.png"
DRIVE = "assets/maps/city_drive.png"
CELL = 2
REFERENCE = 1254.0  # the hand-made coordinates below are for a picture this wide

HILLS = [
    # North-west.
    [(0, 0), (202, 0), (203, 40), (188, 75), (190, 108), (172, 132), (148, 138), (120, 118),
     (90, 105), (60, 92), (30, 80), (0, 78)],
    # North-east, down to the road.
    [(1008, 0), (1254, 0), (1254, 135), (1215, 150), (1180, 165), (1140, 160), (1110, 125),
     (1085, 98), (1075, 62), (1040, 45), (1012, 30)],
    # South-west.
    [(0, 948), (60, 938), (105, 948), (150, 972), (180, 1005), (185, 1050), (175, 1085),
     (215, 1100), (240, 1140), (248, 1200), (250, 1254), (0, 1254)],
    # South-east: two hills with the road running between them.
    [(1150, 985), (1185, 975), (1254, 985), (1254, 1185), (1215, 1150), (1170, 1110),
     (1130, 1075), (1105, 1055), (1118, 1020)],
    [(952, 1140), (975, 1110), (1010, 1100), (1055, 1095), (1090, 1085), (1112, 1097),
     (1140, 1130), (1188, 1180), (1254, 1236), (1254, 1254), (958, 1254), (950, 1190)],
]

COLORS = {
    "road": (255, 255, 255), "building": (255, 0, 0),
    "town": (255, 0, 255), "grove": (0, 255, 0), "high": (255, 255, 0),
    "water": (0, 0, 255), "open": (0, 0, 0),
}


def image_of(mask):
    return Image.fromarray((mask * 255).astype(np.uint8))


def grow(mask, pixels):
    return np.asarray(image_of(mask).filter(ImageFilter.MaxFilter(2 * pixels + 1))) > 127


def shrink(mask, pixels):
    return np.asarray(image_of(mask).filter(ImageFilter.MinFilter(2 * pixels + 1))) > 127


def blurred(array, radius):
    image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), float)


def shifted(mask, dx, dy):
    """The mask moved by (dx, dy); what moves in from outside is empty."""
    result = np.zeros_like(mask)
    height, width = mask.shape
    xs = slice(max(dx, 0), width + min(dx, 0))
    ys = slice(max(dy, 0), height + min(dy, 0))
    xs_from = slice(max(-dx, 0), width + min(-dx, 0))
    ys_from = slice(max(-dy, 0), height + min(-dy, 0))
    result[ys, xs] = mask[ys_from, xs_from]
    return result


def long_runs(mask, length):
    """Pixels lying on a straight run of the mask at least `length` long, in any
    of eight directions. Streets are long; a roof is over in a few pixels."""
    half = length // 2
    found = np.zeros_like(mask)
    for step in range(8):
        angle = np.pi * step / 8.0
        offsets = sorted({(round(k * np.cos(angle)), round(k * np.sin(angle))) for k in range(-half, half + 1)})
        whole = np.ones_like(mask)
        for dx, dy in offsets:
            whole &= shifted(mask, dx, dy)
        for dx, dy in offsets:
            found |= shifted(whole, -dx, -dy)
    return found


def main():
    picture = Image.open(SOURCE).convert("RGB")
    size = picture.size[0]
    scale = size / REFERENCE
    rgb = np.asarray(picture, float)
    grey = rgb.mean(axis=2)
    blueness = rgb[..., 2] - rgb[..., 0]

    # Water is one flat, dark, saturated colour that nothing else on the map has.
    # Closing it fills the gaps under the bridges, so the river is unbroken and the
    # roads laid over it later become the only crossings.
    water = grow(shrink((grey < 64) & (blueness > 60), 2), 2)
    water = shrink(grow(water, 12), 12)

    # Roofs are near-white, and the built-up area is where roofs and the shadows
    # between them alternate. Road markings are white too, but the game lays the
    # roads over the mask afterwards.
    white = (grey > 200) & ~water
    dark_around = blurred((grey < 128) * 255.0, 11) / 255.0
    built = ((blurred(white * 255.0, 10) / 255.0) > 0.14) & (dark_around > 0.1) & ~water
    # Inside the built-up area a roof is anything clearly lighter than the streets
    # and the shadowed gaps between houses.
    light = blurred(grey, 0.7) > 184
    # Streets are light too. What tells them from roofs is length.
    streets = grow(long_runs(light, 27), 1) & light
    buildings = light & ~streets & built

    # Vehicles: everything the owner painted red. Red means more red than blue;
    # the untouched parts of the picture are blue.
    painted = np.asarray(Image.open(VEHICLES).convert("RGB").resize(picture.size), float)
    drive = (painted[..., 0] - painted[..., 2]) > 40
    streets = drive & built

    outline = Image.new("L", picture.size, 0)  # the hand-drawn hills
    for hill in HILLS:
        ImageDraw.Draw(outline).polygon([(x * scale, y * scale) for x, y in hill], fill=255)
    high = (np.asarray(outline) > 0) & ~water & ~built
    # The owner asked for the corner hills to be closed to vehicles, although the
    # red picture covers them.
    drive &= ~high
    grove = (blurred(grey, 1.5) < 128) & ~water & ~built & ~high

    cells = size // CELL
    layers = [
        ("water", water, 0.5), ("road", streets, 0.5), ("building", buildings, 0.5),
        ("town", built, 0.5),
        ("high", high, 0.5), ("grove", grove, 0.5),
    ]
    result = np.zeros((cells, cells, 3), np.uint8)
    decided = np.zeros((cells, cells), bool)
    counts = {}
    for name, layer, share in layers:
        trimmed = layer[:cells * CELL, :cells * CELL].astype(float)
        density = trimmed.reshape(cells, CELL, cells, CELL).mean(axis=(1, 3))
        chosen = (density >= share) & ~decided
        result[chosen] = COLORS[name]
        decided |= chosen
        counts[name] = int(chosen.sum())
    counts["open"] = int((~decided).sum())
    Image.fromarray(result).save(MASK)
    print(MASK, f"{cells}x{cells}", counts)

    trimmed = drive[:cells * CELL, :cells * CELL].astype(float)
    drive_cells = trimmed.reshape(cells, CELL, cells, CELL).mean(axis=(1, 3)) >= 0.5
    image_of(drive_cells).save(DRIVE)
    print(DRIVE, f"{100.0 * drive_cells.mean():.0f}% of the map is open to vehicles")

    if len(sys.argv) > 1:
        tint = np.asarray(Image.fromarray(result).resize(picture.size, Image.NEAREST), float)
        covered = (tint.sum(axis=2, keepdims=True) > 0) * 0.5
        preview = rgb * (1.0 - covered) + tint * covered
        Image.fromarray(preview.astype(np.uint8)).save(sys.argv[1])


if __name__ == "__main__":
    main()
