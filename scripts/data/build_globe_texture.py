#!/usr/bin/env python3
"""
Builds the 3D globe's colour texture from real NASA imagery: the Viking MDIM 2.1 colour mosaic
(USGS / NASA Trek), stitched from Trek WMTS tiles at zoom 3 into one 4096 x 2048 equirectangular image.

Output: public/textures/mars-viking-mdim21-4k.jpg (lon -180..180, lat 90..-90)
Usage: python scripts/data/build_globe_texture.py   (needs Pillow)
"""
import io
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "textures", "mars-viking-mdim21-4k.jpg")
URL = ("https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/"
       "default/default028mm/{z}/{y}/{x}.jpg")
Z = 3            # EPSG:4326 tile grid: 2^(z+1) x 2^z tiles of 256 px
COLS, ROWS = 2 ** (Z + 1), 2 ** Z


def fetch(xy):
    x, y = xy
    req = urllib.request.Request(URL.format(z=Z, x=x, y=y), headers={"User-Agent": "marswalk-data-builder"})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return x, y, Image.open(io.BytesIO(r.read())).convert("RGB")
        except Exception:  # retry flaky tiles
            continue
    raise RuntimeError(f"tile {Z}/{y}/{x} failed")


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    canvas = Image.new("RGB", (COLS * 256, ROWS * 256))
    with ThreadPoolExecutor(max_workers=8) as pool:
        for x, y, tile in pool.map(fetch, [(x, y) for y in range(ROWS) for x in range(COLS)]):
            canvas.paste(tile, (x * 256, y * 256))
    canvas.save(OUT, quality=86, optimize=True, progressive=True)
    print("wrote", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
