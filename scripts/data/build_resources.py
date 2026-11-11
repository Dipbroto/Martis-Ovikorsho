#!/usr/bin/env python3
"""
Builds authentic NASA/USGS planetary resource and survival layers drawn on the Mars map:

  public/data/h2o.json    Odyssey GRS water map: H2O concentration (weight %) in the upper ~1 m of regolith,
                          5-degree bins (Boynton et al. 2007), smoothed product from the PDS Geosciences Node.
  public/data/fe.json     Odyssey GRS Iron (Fe) concentration map (weight %).
  public/data/si.json     Odyssey GRS Silicon (Si) concentration map (weight %).
  public/data/k.json      Odyssey GRS Potassium (K) concentration map (weight %).
  public/data/th.json     Odyssey GRS Thorium (Th) concentration map (ppm).
  public/data/cl.json     Odyssey GRS Chlorine (Cl) concentration map (weight %).
  public/data/caves.json  Mars Global Cave Candidate Catalog (MGC3, Cushing 2017, USGS Astrogeology / PDS):
                          ~1,060 pits, skylights and other possible cave entrances usable as natural shelter.

Usage: python scripts/data/build_resources.py
"""
import csv
import io
import json
import os
import subprocess
import urllib.request
import zipfile
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "data")

GRS_BASE_URL = "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/DATA/SMOOTHED/"

CAVES_URL = (
    "https://astrogeology.usgs.gov/ckan/dataset/c2960f77-ee20-4cc6-ac85-abbecc0fc7f6/"
    "resource/ccd54fb2-9a50-46bf-8971-80c241bb2f40/download/mars_cave_catalog.zip"
)

ELEMENTS = {
    "fe": {
        "file": "fe_sr_5x5.tab",
        "symbol": "Fe",
        "name": "Iron",
        "unit": "wt%",
        "description": "Elemental iron abundance in the upper ~1 m of regolith. Essential for structural metallurgy, steel fabrication, and magnetics in Martian ISRU manufacturing.",
    },
    "si": {
        "file": "si_sr_5x5.tab",
        "symbol": "Si",
        "name": "Silicon",
        "unit": "wt%",
        "description": "Elemental silicon concentration. Key feedstock for in-situ photovoltaic solar cell fabrication, silicones, and silicate glass/ceramics.",
    },
    "k": {
        "file": "k_sr_5x5.tab",
        "symbol": "K",
        "name": "Potassium",
        "unit": "wt%",
        "description": "Naturally radioactive alkali metal (K-40). Vital macronutrient for hydroponic crop cultivation and geological dating (K-Ar geochronology).",
    },
    "th": {
        "file": "th_sr_5x5.tab",
        "symbol": "Th",
        "name": "Thorium",
        "unit": "ppm",
        "description": "Radioactive actinide concentration in parts per million (ppm). Indicator of high-temperature crustal differentiation and prospective fuel for thorium-based nuclear ISRU reactors.",
    },
    "cl": {
        "file": "cl_sr_5x5.tab",
        "symbol": "Cl",
        "name": "Chlorine",
        "unit": "wt%",
        "description": "Elemental chlorine concentration (chlorides and perchlorates). Critical volatile for chemical processing, water extraction, and habitat hazard management.",
    },
    "h2o": {
        "file": "h2o_sr_5x5.tab",
        "symbol": "H2O",
        "name": "Water Equivalent Hydrogen",
        "unit": "wt%",
        "description": "Weight percent H2O (chemically bound water and subsurface ice) in roughly the upper metre. Primary ISRU resource for life support and LOX/CH4 rocket propellant production.",
    }
}

NODATA = 9990.0

def fetch_grs(filename):
    url = GRS_BASE_URL + filename
    try:
        res = subprocess.run(["curl.exe", "-sL", url], capture_output=True, text=True, check=True)
        return res.stdout
    except Exception:
        req = urllib.request.Request(url, headers={"User-Agent": "martis-data-builder"})
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read().decode("utf-8", "ignore")

def build_element(key, meta):
    raw_text = fetch_grs(meta["file"])
    rows, cols = 36, 72  # 5-degree bins from 90N down, longitude 0..360 E
    grid = [[None] * cols for _ in range(rows)]
    sigma = [[None] * cols for _ in range(rows)]
    for line in raw_text.splitlines():
        parts = line.split()
        if len(parts) < 4:
            continue
        try:
            lat = float(parts[0])
            lon_e = float(parts[1])
            conc = float(parts[2])
            err = float(parts[3])
        except ValueError:
            continue
        r = int((90 - lat) // 5)
        c = int(lon_e // 5)
        if 0 <= r < rows and 0 <= c < cols:
            if conc < NODATA:
                grid[r][c] = round(conc, 3 if meta["unit"] == "wt%" and conc < 1.0 else 2)
                sigma[r][c] = round(err, 3 if meta["unit"] == "wt%" and conc < 1.0 else 2)
    # Re-order columns to run from -180 to +180 so the grid lines up with the map
    shift = cols // 2
    grid = [row[shift:] + row[:shift] for row in grid]
    sigma = [row[shift:] + row[:shift] for row in sigma]
    values = [v for row in grid for v in row if v is not None]
    return {
        "generated": date.today().isoformat(),
        "source": "Mars Odyssey GRS element concentration maps (Boynton et al. 2007), PDS Geosciences Node, smoothed 5x5 degree product",
        "element": key,
        "symbol": meta["symbol"],
        "name": meta["name"],
        "unit": meta["unit"],
        "description": meta["description"],
        "rows": rows, "cols": cols,
        "west": -180, "east": 180, "north": 90, "south": -90,
        "min": min(values) if values else 0,
        "max": max(values) if values else 0,
        "values": grid,
        "sigma": sigma,
    }

def build_caves():
    try:
        res = subprocess.run(["curl.exe", "-sL", CAVES_URL], capture_output=True, check=True)
        raw_zip = res.stdout
    except Exception:
        req = urllib.request.Request(CAVES_URL, headers={"User-Agent": "martis-data-builder"})
        with urllib.request.urlopen(req, timeout=120) as r:
            raw_zip = r.read()

    zf = zipfile.ZipFile(io.BytesIO(raw_zip))
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
    for key, meta in ELEMENTS.items():
        data = build_element(key, meta)
        out_file = os.path.join(OUT_DIR, f"{key}.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        print(f"{key}.json: {os.path.getsize(out_file)} bytes (range: {data['min']} - {data['max']} {data['unit']})")
    
    caves = build_caves()
    caves_path = os.path.join(OUT_DIR, "caves.json")
    with open(caves_path, "w", encoding="utf-8") as f:
        json.dump(caves, f, separators=(",", ":"))
    print(f"caves.json: {os.path.getsize(caves_path)} bytes ({len(caves['caves'])} candidates)")

if __name__ == "__main__":
    main()
