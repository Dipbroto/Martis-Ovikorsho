#!/usr/bin/env python3
"""
Builds the elevation grids the app uses for terrain, slopes and route planning.

Outputs (written to public/data/dem/):
  global.i16z      MOLA MEGDR 4 px/deg (~15 km) global topography
  <site>.i16z      200 m/px windows of the USGS HRSC-MOLA blended DEM around each hero site
  index.json       bounds, size, resolution and source of every grid

Each .i16z file is gzip-compressed little-endian int16 elevations (metres relative to the
Mars areoid), stored row-major from the north-west corner. -32768 marks "no data".

Sources
  - Smith et al., MGS MOLA MEGDR (MGS-M-MOLA-5-MEGDR-L3-V1.0), PDS Geosciences Node
  - Fergason et al. 2018, Mars HRSC MOLA Blended DEM Global 200m v2, USGS Astrogeology

Requires: Python 3.9+ and numpy.  Usage:  python scripts/data/build_dem.py
"""
import concurrent.futures as cf
import gzip
import json
import os
import urllib.request

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "data", "dem")

MEGDR_URL = "https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg004/megt90n000cb.img"

# The blended DEM is an uncompressed BigTIFF stored as one strip per row, so any window can be
# fetched with plain HTTP range requests (values below were read from the file's TIFF tags).
BLEND_URL = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
BLEND_WIDTH = 106694
BLEND_HEIGHT = 53347
BLEND_FIRST_STRIP = 854272
BLEND_ROW_BYTES = BLEND_WIDTH * 2
BLEND_DEG_PER_PX = 0.003374120830641
BLEND_NODATA = -32768

# Hero sites: every preset route and autonomous-router pair falls inside one of these boxes.
SITES = {
    "jezero": {"name": "Jezero Crater", "lat": 18.45, "lon": 77.40, "half": 0.75},
    "gale": {"name": "Gale Crater / Mount Sharp", "lat": -4.67, "lon": 137.40, "half": 0.75},
    "olympus": {"name": "Olympus Mons summit caldera", "lat": 18.45, "lon": -133.85, "half": 0.80},
    "melas": {"name": "Melas Chasma, Valles Marineris", "lat": -9.80, "lon": -76.50, "half": 0.75},
    "coprates": {"name": "Coprates Chasma, Valles Marineris", "lat": -14.06, "lon": -59.13, "half": 0.75},
    "arcadia": {"name": "Arcadia Planitia", "lat": 39.32, "lon": -171.15, "half": 0.75},
    "elysium": {"name": "Elysium Planitia (InSight)", "lat": 4.64, "lon": 135.80, "half": 0.75},
}


def fetch(url, start=None, end=None, retries=4):
    headers = {"User-Agent": "marswalk-dem-builder"}
    if start is not None:
        headers["Range"] = f"bytes={start}-{end}"
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
                return r.read()
        except Exception:  # noqa: BLE001 - retry on any network error
            if attempt == retries - 1:
                raise
    return b""


def write_grid(name, grid):
    path = os.path.join(OUT_DIR, f"{name}.i16z")
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(grid.astype("<i2").tobytes())
    return os.path.getsize(path)


def build_global():
    raw = fetch(MEGDR_URL)
    grid = np.frombuffer(raw, dtype=">i2").reshape(720, 1440)
    # MEGDR columns run 0..360 E; the app uses -180..180 so roll the western half to the front.
    grid = np.roll(grid, 720, axis=1)
    size = write_grid("global", grid)
    return {
        "id": "global",
        "name": "Global MOLA topography",
        "west": -180.0, "east": 180.0, "north": 90.0, "south": -90.0,
        "width": 1440, "height": 720,
        "metersPerPixel": round(2 * 3_389_500 * np.pi / 1440),
        "source": "MGS MOLA MEGDR 4 px/deg (Smith et al., PDS Geosciences Node)",
        "bytes": size,
    }


def build_site(site_id, site):
    north, south = site["lat"] + site["half"], site["lat"] - site["half"]
    west, east = site["lon"] - site["half"], site["lon"] + site["half"]
    row0 = int((90.0 - north) / BLEND_DEG_PER_PX)
    row1 = int(np.ceil((90.0 - south) / BLEND_DEG_PER_PX))
    col0 = int((west + 180.0) / BLEND_DEG_PER_PX)
    col1 = int(np.ceil((east + 180.0) / BLEND_DEG_PER_PX))
    width = col1 - col0

    def read_row(row):
        start = BLEND_FIRST_STRIP + row * BLEND_ROW_BYTES + col0 * 2
        return np.frombuffer(fetch(BLEND_URL, start, start + width * 2 - 1), dtype="<i2")

    with cf.ThreadPoolExecutor(max_workers=24) as pool:
        rows = list(pool.map(read_row, range(row0, row1)))
    grid = np.vstack(rows)
    size = write_grid(site_id, grid)
    valid = grid[grid != BLEND_NODATA]
    return {
        "id": site_id,
        "name": site["name"],
        # Exact pixel-edge bounds so lookups line up with the source raster
        "west": -180.0 + col0 * BLEND_DEG_PER_PX,
        "east": -180.0 + col1 * BLEND_DEG_PER_PX,
        "north": 90.0 - row0 * BLEND_DEG_PER_PX,
        "south": 90.0 - row1 * BLEND_DEG_PER_PX,
        "width": width, "height": row1 - row0,
        "metersPerPixel": 200,
        "minElevation": int(valid.min()), "maxElevation": int(valid.max()),
        "source": "HRSC-MOLA Blended DEM Global 200 m v2 (Fergason et al. 2018, USGS Astrogeology)",
        "bytes": size,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    grids = [build_global()]
    print("global done", grids[-1]["bytes"], "bytes")
    for site_id, site in SITES.items():
        grids.append(build_site(site_id, site))
        g = grids[-1]
        print(f"{site_id}: {g['width']}x{g['height']} elev {g['minElevation']}..{g['maxElevation']} m, {g['bytes']} bytes")
    index = {"nodata": BLEND_NODATA, "units": "metres relative to the Mars areoid", "grids": grids}
    with open(os.path.join(OUT_DIR, "index.json"), "w") as f:
        json.dump(index, f, indent=2)


if __name__ == "__main__":
    main()
