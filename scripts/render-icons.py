#!/usr/bin/env python3
"""Rasterize the Epoch mark into PNG icons. Standard library only."""

import math
import struct
import zlib
from pathlib import Path

GREEN = (30 / 255, 79 / 255, 67 / 255)
CREAM = (244 / 255, 239 / 255, 230 / 255)


def clamp(value: float) -> float:
    return 0.0 if value < 0 else 1.0 if value > 1 else value


def coverage(dist: float, aa: float) -> float:
    return clamp(0.5 - dist / aa)


def rounded_rect_dist(x: float, y: float) -> float:
    half = 16.0
    radius = 8.0
    qx = abs(x - 16) - (half - radius)
    qy = abs(y - 16) - (half - radius)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    inside = min(max(qx, qy), 0.0)
    return outside + inside - radius


def composite(base, color, alpha: float):
    if alpha <= 0:
        return base
    sr, sg, sb = color
    dr, dg, db, da = base
    out_a = alpha + da * (1 - alpha)
    if out_a <= 0:
        return (0.0, 0.0, 0.0, 0.0)
    return (
        (sr * alpha + dr * da * (1 - alpha)) / out_a,
        (sg * alpha + dg * da * (1 - alpha)) / out_a,
        (sb * alpha + db * da * (1 - alpha)) / out_a,
        out_a,
    )


def pixel(x: int, y: int, size: int, maskable: bool):
    vx = (x + 0.5) * 32 / size
    vy = (y + 0.5) * 32 / size
    aa = 32 / size
    color = (*GREEN, 1.0) if maskable else (0.0, 0.0, 0.0, 0.0)
    if not maskable:
        color = composite(color, GREEN, coverage(rounded_rect_dist(vx, vy), aa))
    ring = abs(math.hypot(vx - 16, vy - 16) - 8.5) - 0.85
    color = composite(color, CREAM, coverage(ring, aa))
    dot = math.hypot(vx - 16, vy - 16) - 2.2
    color = composite(color, CREAM, coverage(dot, aa))
    return color


def png_bytes(size: int, maskable: bool) -> bytes:
    rows = []
    for y in range(size):
        row = bytearray(1 + size * 4)
        for x in range(size):
            red, green, blue, alpha = pixel(x, y, size, maskable)
            index = 1 + x * 4
            row[index] = round(red * 255)
            row[index + 1] = round(green * 255)
            row[index + 2] = round(blue * 255)
            row[index + 3] = round(alpha * 255)
        rows.append(bytes(row))

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
        + chunk(b"IEND", b"")
    )


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "public" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    files = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "icon-maskable-192.png": (192, True),
        "icon-maskable-512.png": (512, True),
        "apple-touch-icon.png": (180, True),
    }
    for name, (size, maskable) in files.items():
        path = out / name
        path.write_bytes(png_bytes(size, maskable))
        print(f"{path} {path.stat().st_size}")


if __name__ == "__main__":
    main()
