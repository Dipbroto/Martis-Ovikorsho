#!/usr/bin/env python3
"""
Downloads the real rover traverse paths published by NASA/JPL (MMGIS) and writes a compact
public/data/traverses.json the app draws as a reference layer and uses to validate the planner.

Sources (public, NASA/JPL-Caltech):
  Perseverance: https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json
  Curiosity:    https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json

Output: { "generated": ..., "traverses": [ { id, name, mission, source, lengthKm, sols, points: [[lat, lon], ...] } ] }
Points are thinned to roughly one per `STEP_M` metres of path.

Usage: python scripts/data/build_traverses.py
"""
import json
import math
import os
import urllib.request
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "data", "traverses.json")
STEP_M = 25
MARS_R = 3_389_500.0

SOURCES = [
    {
        "id": "perseverance",
        "name": "Perseverance (Mars 2020)",
        "url": "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json",
    },
    {
        "id": "curiosity",
        "name": "Curiosity (MSL)",
        "url": "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json",
    },
]


def dist_m(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * MARS_R * math.asin(math.sqrt(h))


def lines_of(feature):
    geom = feature["geometry"]
    if geom["type"] == "LineString":
        return [geom["coordinates"]]
    if geom["type"] == "MultiLineString":
        return geom["coordinates"]
    return []


def build(source):
    with urllib.request.urlopen(source["url"], timeout=120) as r:
        data = json.load(r)
    points = []
    sols = []
    for feature in data["features"]:
        if "sol" in feature.get("properties", {}):
            sols.append(feature["properties"]["sol"])
        for line in lines_of(feature):
            for c in line:
                points.append((round(c[1], 5), round(c[0], 5)))  # GeoJSON is lon, lat
    # Thin to ~STEP_M spacing and drop consecutive duplicates
    thinned = [points[0]]
    acc = 0.0
    for prev, cur in zip(points, points[1:]):
        acc += dist_m(prev, cur)
        if acc >= STEP_M:
            thinned.append(cur)
            acc = 0.0
    if thinned[-1] != points[-1]:
        thinned.append(points[-1])
    length_m = sum(dist_m(a, b) for a, b in zip(thinned, thinned[1:]))
    return {
        "id": source["id"],
        "name": source["name"],
        "mission": source["id"],
        "source": source["url"],
        "lengthKm": round(length_m / 1000, 2),
        "lastSol": max(sols) if sols else None,
        "points": [list(p) for p in thinned],
    }


def main():
    traverses = [build(s) for s in SOURCES]
    for t in traverses:
        print(t["id"], t["lengthKm"], "km,", len(t["points"]), "points, last sol", t["lastSol"])
    with open(OUT, "w") as f:
        json.dump({"generated": date.today().isoformat(), "traverses": traverses}, f, separators=(",", ":"))
    print("wrote", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
