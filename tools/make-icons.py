#!/usr/bin/env python3
"""Generate the extension's PNG icons.

Stdlib only -- no Pillow, no SVG rasterizer. Shapes are defined analytically in
normalized 0..1 coordinates, sampled at SUPERSAMPLE x SUPERSAMPLE per output
pixel, and written straight to PNG via zlib.

The mark is three rows of "words", each drawn as a solid leading block and a
faded trailing block. It says what the extension does without using letterforms,
which keeps it legible at 16px where real glyphs turn to mush.

    python3 tools/make-icons.py
"""

import struct
import zlib
from pathlib import Path

SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4

# Two palettes over identical geometry. The muted one is the toolbar icon
# whenever the extension is not painting the current tab. It is neutral gray at
# partial alpha so it reads as dimmed against both light and dark browser themes
# -- a hue change alone would not survive both.
ACTIVE = {
    "background": (0x28, 0x25, 0x60),
    "ink": (0xFF, 0xFF, 0xFF),
    "tail_alpha": 0.40,
    "opacity": 1.0,
    "suffix": "",
}

MUTED = {
    "background": (0x6E, 0x6E, 0x6E),
    "ink": (0xFF, 0xFF, 0xFF),
    "tail_alpha": 0.40,
    "opacity": 0.55,
    "suffix": "-off",
}

PALETTES = (ACTIVE, MUTED)

CORNER_RADIUS = 0.22
BAR_RADIUS = 0.020
ROW_HEIGHT = 0.115
FIXATION_RATIO = 0.55

# (row center y, [(word start x, word width), ...]). Kept to six blocks total:
# a 16px icon has room for a few large shapes and nothing more, so detail here
# costs legibility where the icon is actually seen most.
ROWS = (
    (0.290, ((0.155, 0.330), (0.565, 0.280))),
    (0.500, ((0.155, 0.260), (0.495, 0.350))),
    (0.710, ((0.155, 0.300), (0.545, 0.190))),
)


def in_round_rect(x, y, x0, y0, x1, y1, r):
    """Standard rounded-rectangle test: clamp into the inner rect, measure out."""
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= r * r


def sample(x, y, palette):
    """Return (r, g, b, alpha 0..1) for one point in the unit square."""
    if not in_round_rect(x, y, 0.0, 0.0, 1.0, 1.0, CORNER_RADIUS):
        return (0, 0, 0, 0.0)

    opacity = palette["opacity"]
    ink = palette["ink"]
    tail_alpha = palette["tail_alpha"]
    red, green, blue = palette["background"]

    for center, words in ROWS:
        top = center - ROW_HEIGHT / 2
        bottom = center + ROW_HEIGHT / 2
        if not (top <= y <= bottom):
            continue

        for start, width in words:
            end = start + width
            fixation_end = start + width * FIXATION_RATIO
            if in_round_rect(x, y, start, top, fixation_end, bottom, BAR_RADIUS):
                return ink + (opacity,)
            if in_round_rect(x, y, fixation_end, top, end, bottom, BAR_RADIUS):
                # Faded tail composited over the background, not over nothing.
                red = round(red + (ink[0] - red) * tail_alpha)
                green = round(green + (ink[1] - green) * tail_alpha)
                blue = round(blue + (ink[2] - blue) * tail_alpha)
                return (red, green, blue, opacity)

    return (red, green, blue, opacity)


def render(size, palette):
    """Render one icon, returning raw RGBA bytes."""
    pixels = bytearray(size * size * 4)
    step = 1.0 / (size * SUPERSAMPLE)
    taps = SUPERSAMPLE * SUPERSAMPLE

    for py in range(size):
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(SUPERSAMPLE):
                y = (py * SUPERSAMPLE + sy + 0.5) * step
                for sx in range(SUPERSAMPLE):
                    x = (px * SUPERSAMPLE + sx + 0.5) * step
                    sr, sg, sb, sa = sample(x, y, palette)
                    r += sr * sa
                    g += sg * sa
                    b += sb * sa
                    a += sa

            offset = (py * size + px) * 4
            if a > 0:
                # Un-premultiply so partially covered edge pixels keep their hue.
                pixels[offset] = min(255, round(r / a))
                pixels[offset + 1] = min(255, round(g / a))
                pixels[offset + 2] = min(255, round(b / a))
                pixels[offset + 3] = round(255 * a / taps)

    return pixels


def write_png(path, size, pixels):
    stride = size * 4
    raw = b"".join(
        b"\x00" + bytes(pixels[row * stride:(row + 1) * stride]) for row in range(size)
    )

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main():
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(exist_ok=True)

    for palette in PALETTES:
        for size in SIZES:
            path = out / f"icon{size}{palette['suffix']}.png"
            write_png(path, size, render(size, palette))
            print(f"wrote {path.relative_to(path.parent.parent)} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
