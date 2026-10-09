#!/usr/bin/env python3
"""Cuts the owner's icon sheets into one file per icon.

Usage: tools/cut_icons.py [CONTACT_SHEET.png]

Input:  assets/icons/source/sheet_*.png   white discs with black pictograms
Output: assets/icons/<name>.png           one icon each, transparent outside the disc

The discs are found by themselves; only their names, in reading order, are
listed below. Add a sheet by adding its file and its list of names.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw

SIZE = 96
SHEETS = {
    "assets/icons/source/sheet_west.png": [
        "rifle", "engineer", "antitank", "sniper", "machine_gun",
        "jeep", "truck", "apc", "transport_helicopter", "attack_helicopter", "missile",
    ],
    "assets/icons/source/sheet_east.png": [
        "east_rifle", "east_antitank", "east_machine_gun",
        "east_jeep", "east_truck", "mortar",
    ],
    "assets/icons/source/sheet_misc.png": [
        "mine", "east_tank", "tank", "civilian", "crowd",
    ],
}


def runs(filled):
    """Start and end of each stretch of True values."""
    found, start = [], None
    for index, value in enumerate(filled):
        if value and start is None:
            start = index
        elif not value and start is not None:
            found.append((start, index))
            start = None
    if start is not None:
        found.append((start, len(filled)))
    return found


def discs(sheet):
    """Bounding boxes of the white discs, row by row, left to right."""
    rgba = np.asarray(sheet.convert("RGBA"), float)
    light = (rgba[..., :3].mean(axis=2) > 128) & (rgba[..., 3] > 128)
    boxes = []
    for top, bottom in runs(light.mean(axis=1) > 0.02):
        if bottom - top < 40:
            continue
        for left, right in runs(light[top:bottom].mean(axis=0) > 0.02):
            if right - left >= 40:
                boxes.append((left, top, right, bottom))
    return boxes


def main():
    cut = []
    for path, names in SHEETS.items():
        sheet = Image.open(path)
        boxes = discs(sheet)
        if len(boxes) != len(names):
            raise SystemExit(f"{path}: found {len(boxes)} discs, expected {len(names)}")
        for name, (left, top, right, bottom) in zip(names, boxes):
            # The black ring around the disc is part of the icon: take a little margin.
            side = max(right - left, bottom - top) * 1.07
            centre = ((left + right) / 2.0, (top + bottom) / 2.0)
            box = [round(centre[0] - side / 2), round(centre[1] - side / 2),
                   round(centre[0] + side / 2), round(centre[1] + side / 2)]
            icon = sheet.convert("RGB").crop(box).resize((SIZE * 4, SIZE * 4), Image.LANCZOS)
            mask = Image.new("L", icon.size, 0)
            ImageDraw.Draw(mask).ellipse([2, 2, icon.size[0] - 3, icon.size[1] - 3], fill=255)
            icon.putalpha(mask)
            icon = icon.resize((SIZE, SIZE), Image.LANCZOS)
            icon.save(f"assets/icons/{name}.png")
            cut.append((name, icon))
        print(path, "->", ", ".join(names))

    if len(sys.argv) > 1:
        columns = 6
        rows = (len(cut) + columns - 1) // columns
        board = Image.new("RGB", (columns * 150, rows * 140), (20, 40, 64))
        draw = ImageDraw.Draw(board)
        for index, (name, icon) in enumerate(cut):
            x, y = (index % columns) * 150 + 27, (index // columns) * 140 + 8
            board.paste(icon, (x, y), icon)
            draw.text((x - 20, y + SIZE + 6), name, fill=(235, 242, 251))
        board.save(sys.argv[1])


if __name__ == "__main__":
    main()
