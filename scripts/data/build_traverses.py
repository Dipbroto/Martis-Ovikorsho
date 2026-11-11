#!/usr/bin/env python3
"""
Downloads and compiles real rover traverse paths from NASA/JPL (MMGIS and PDS/Analyst's Notebook):
1. Perseverance (Mars 2020) — Jezero Crater Western Fan Delta & Sample Return Cache (42.71 km)
2. Curiosity (MSL) — Gale Crater & Mount Sharp / Aeolis Mons ascent (33.28 km)
3. Opportunity (MER-B) — Meridiani Planum: Eagle, Endurance, Victoria & Endeavour craters (45.16 km)
4. Spirit (MER-A) — Gusev Crater: Columbia Hills, Husband Hill summit & Home Plate silica (7.73 km)
5. Mars Pathfinder / Sojourner — Ares Vallis historic 1997 landing & rock surveys (0.10 km)

Output: public/data/traverses.json
Usage: python scripts/data/build_traverses.py
"""
import json
import math
import os
import urllib.request
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "data", "traverses.json")
MARS_R = 3_389_500.0


def dist_m(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * MARS_R * math.asin(math.sqrt(h))


def thin(points, step_m):
    if not points:
        return []
    thinned = [points[0]]
    acc = 0.0
    for prev, cur in zip(points, points[1:]):
        acc += dist_m(prev, cur)
        if acc >= step_m:
            thinned.append(cur)
            acc = 0.0
    if thinned[-1] != points[-1]:
        thinned.append(points[-1])
    return thinned


def lines_of(feature):
    geom = feature.get("geometry", {})
    if geom.get("type") == "LineString":
        return [geom["coordinates"]]
    if geom.get("type") == "MultiLineString":
        return geom["coordinates"]
    return []


def build_mmgis(source, step_m=25):
    # Try online fetch first; fallback to existing traverses.json if unavailable
    try:
        req = urllib.request.Request(source["url"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        points = []
        sols = []
        for feature in data.get("features", []):
            if "sol" in feature.get("properties", {}):
                sols.append(feature["properties"]["sol"])
            for line in lines_of(feature):
                for c in line:
                    points.append((round(c[1], 5), round(c[0], 5)))  # GeoJSON is lon, lat
        thinned = thin(points, step_m)
        last_sol = max(sols) if sols else None
    except Exception as err:
        print(f"  Note: Could not reach {source['url']} ({err}); reading from existing dataset.")
        with open(OUT, "r") as f:
            prev = json.load(f)
        match = next(t for t in prev["traverses"] if t["id"] == source["id"])
        thinned = [tuple(p) for p in match["points"]]
        last_sol = match.get("lastSol")

    length_m = sum(dist_m(a, b) for a, b in zip(thinned, thinned[1:]))
    return {
        "id": source["id"],
        "name": source["name"],
        "mission": source["id"],
        "location": source["location"],
        "source": source["url"],
        "lengthKm": source.get("officialLengthKm") or round(length_m / 1000, 2),
        "lastSol": last_sol,
        "highlights": source["highlights"],
        "color": source["color"],
        "points": [list(p) for p in thinned],
    }


def build_azmth(source, step_m=15):
    req = urllib.request.Request(source["url"], headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = json.load(r)

    lats = raw["path"]["lat"]
    lons = [lon - 360 if lon > 180 else lon for lon in raw["path"]["lon"]]
    pts = [(round(lat, 5), round(lon, 5)) for lat, lon in zip(lats, lons)]
    thinned = thin(pts, step_m)

    return {
        "id": source["id"],
        "name": source["name"],
        "mission": source["id"],
        "location": source["location"],
        "source": source["citation"],
        "lengthKm": source["officialLengthKm"],
        "lastSol": source["lastSol"],
        "highlights": source["highlights"],
        "color": source["color"],
        "points": [list(p) for p in thinned],
    }


SOURCES = [
    {
        "type": "mmgis",
        "id": "perseverance",
        "name": "Perseverance (Mars 2020)",
        "location": "Jezero Crater",
        "url": "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json",
        "officialLengthKm": 42.71,
        "step_m": 25,
        "highlights": "42.71 km traverse exploring Jezero Western Fan Delta and collecting 20 sealed rock cores for Mars Sample Return.",
        "color": "#fb923c",
    },
    {
        "type": "mmgis",
        "id": "curiosity",
        "name": "Curiosity (MSL)",
        "location": "Gale Crater",
        "url": "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json",
        "officialLengthKm": 33.28,
        "step_m": 25,
        "highlights": "33.28 km climb up Mount Sharp (Aeolis Mons), discovering ancient habitable lakebed sediments and organic molecules.",
        "color": "#c084fc",
    },
    {
        "type": "azmth",
        "id": "opportunity",
        "name": "Opportunity (MER-B)",
        "location": "Meridiani Planum",
        "url": "https://azmth.space/data/mars-traverses/opportunity.json",
        "citation": "NASA / JPL-Caltech / MER Science Team · Analyst's Notebook (WUSTL PDS)",
        "officialLengthKm": 45.16,
        "lastSol": 5111,
        "step_m": 15,
        "highlights": "Longest off-world drive in history (45.16 km). Navigated Eagle, Endurance, Victoria, and Endeavour craters across Meridiani Planum.",
        "color": "#38bdf8",
    },
    {
        "type": "azmth",
        "id": "spirit",
        "name": "Spirit (MER-A)",
        "location": "Gusev Crater",
        "url": "https://azmth.space/data/mars-traverses/spirit.json",
        "citation": "NASA / JPL-Caltech / MER Science Team · Analyst's Notebook (WUSTL PDS)",
        "officialLengthKm": 7.73,
        "lastSol": 2209,
        "step_m": 12,
        "highlights": "Explored Gusev Crater, ascended Husband Hill (107 m summit climb), and discovered pure opaline silica hot springs at Home Plate.",
        "color": "#facc15",
    },
    {
        "type": "azmth",
        "id": "pathfinder",
        "name": "Mars Pathfinder / Sojourner",
        "location": "Ares Vallis",
        "url": "https://azmth.space/data/mars-traverses/sojourner.json",
        "citation": "NASA / JPL-Caltech Mars Pathfinder Science Team (PDS Moore et al. 1999)",
        "officialLengthKm": 0.10,
        "lastSol": 83,
        "step_m": 0.8,
        "highlights": "Historic first wheeled rover on Mars (1997). Traversed 105 m around Carl Sagan Memorial Station, analyzing Yogi, Barnacle Bill, and Mermaid Dune.",
        "color": "#f43f5e",
    },
]


def main():
    traverses = []
    for s in SOURCES:
        print(f"Building {s['name']}...")
        if s["type"] == "mmgis":
            t = build_mmgis(s, s.get("step_m", 25))
        else:
            t = build_azmth(s, s.get("step_m", 15))
        traverses.append(t)
        print(f"  -> {t['id']}: {t['lengthKm']} km, {len(t['points'])} points, sol {t['lastSol']}")

    result = {
        "generated": date.today().isoformat(),
        "traverses": traverses,
    }
    with open(OUT, "w") as f:
        json.dump(result, f, separators=(",", ":"))
    print(f"Successfully wrote {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
