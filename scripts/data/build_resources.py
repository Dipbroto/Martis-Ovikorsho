#!/usr/bin/env python3
"""
Builds two real-data survival layers the app draws on the map.

  public/data/h2o.json    Odyssey GRS water map: H2O concentration (weight %) in the upper ~1 m of regolith,
                          5-degree bins (Boynton et al. 2007), smoothed product from the PDS Geosciences Node.
  public/data/caves.json  Mars Global Cave Candidate Catalog (MGC3, Cushing 2017, USGS Astrogeology / PDS):
                          ~1,060 pits, skylights and other possible cave entrances usable as natural shelter.

Usage: python scripts/data/build_resources.py
"""
import csv
import io
import json
import os
import urllib.request
import zipfile
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "data")

H2O_URL = "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/DATA/SMOOTHED/h2o_sr_5x5.tab"
CAVES_URL = (
    "https://astrogeology.usgs.gov/ckan/dataset/c2960f77-ee20-4cc6-ac85-abbecc0fc7f6/"
    "resource/ccd54fb2-9a50-46bf-8971-80c241bb2f40/download/mars_cave_catalog.zip"
)
NODATA = 9999.0  # the archive marks bins without data as 9999.999


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "martis-data-builder"}), timeout=120) as r:
        return r.read()


def build_h2o():
    rows, cols = 36, 72  # 5-degree bins from 90N down, longitude 0..360 E
    grid = [[None] * cols for _ in range(rows)]
    sigma = [[None] * cols for _ in range(rows)]
    for line in fetch(H2O_URL).decode().splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        lat, lon_e, conc, err = float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
        r = int((90 - lat) // 5)
        c = int(lon_e // 5)
        if conc < NODATA:
            grid[r][c] = round(conc, 2)
            sigma[r][c] = round(err, 2)
    # Re-order columns to run from -180 to +180 so the grid lines up with the map
    shift = cols // 2
    grid = [row[shift:] + row[:shift] for row in grid]
    sigma = [row[shift:] + row[:shift] for row in sigma]
    values = [v for row in grid for v in row if v is not None]
    return {
        "generated": date.today().isoformat(),
        "source": "Mars Odyssey GRS element concentration maps (Boynton et al. 2007), PDS Geosciences Node, smoothed 5x5 degree product",
        "note": "Weight percent H2O (including chemically bound water) in roughly the upper metre. 5-degree bins are ~300 km wide: a regional indicator, not a site survey.",
        "rows": rows, "cols": cols,
        "west": -180, "east": 180, "north": 90, "south": -90,
        "min": min(values), "max": max(values),
        "values": grid,
        "sigma": sigma,
    }


def build_caves():
    zf = zipfile.ZipFile(io.BytesIO(fetch(CAVES_URL)))
    name = next(n for n in zf.namelist() if n.endswith("data/Mars_Cave_Catalog.csv"))
    caves = []
    for row in csv.reader(io.StringIO(zf.read(name).decode())):
        if not row or row[0].startswith("ID") or row[0].lower().startswith("longitude"):
            continue
        tag, lon, lat, kind, priority, diameter, depth = row[:7]
        comment = ",".join(row[7:]).strip()
        lon = float(lon)
        caves.append({
            "id": tag.strip(),
            "lat": round(float(lat), 4),
            "lon": round(lon - 360 if lon > 180 else lon, 4),
            "type": kind.strip(),
            "priority": int(priority),
            "diameterM": int(diameter) if diameter.strip().isdigit() else None,
            "depthM": int(depth) if depth.strip().isdigit() else None,
            "comment": comment,
        })
    return {
        "generated": date.today().isoformat(),
        "source": "Mars Global Cave Candidate Catalog v1 (Cushing 2017), USGS Astrogeology Science Center / NASA PDS",
        "note": "Candidates seen from orbit only. Many turn out to be pits or shadows when imaged by HiRISE.",
        "caves": caves,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    h2o = build_h2o()
    caves = build_caves()
    for name, data in (("h2o.json", h2o), ("caves.json", caves)):
        with open(os.path.join(OUT_DIR, name), "w") as f:
            json.dump(data, f, separators=(",", ":"))
        print(name, os.path.getsize(os.path.join(OUT_DIR, name)), "bytes")
    print("H2O wt%:", h2o["min"], "to", h2o["max"], "| caves:", len(caves["caves"]))


if __name__ == "__main__":
    main()
