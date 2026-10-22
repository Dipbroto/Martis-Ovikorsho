"""Builds public/data/marsquakes.json from the InSight Marsquake Service catalogue, V14.

Source: InSight Marsquake Service (2023), Mars Seismic Catalogue, InSight Mission; V14 2023-04-01,
ETHZ, IPGP, JPL, ICL, Univ. Bristol, https://doi.org/10.12686/a21, as listed on the IRIS page
https://ds.iris.edu/ds/nodes/dmc/tools/mars-events/v14/ (catalogue dates 2019-01-12 to 2022-12-31).

InSight had a single seismometer, so each event has a distance from the lander (degrees of arc) and,
for the best events only, a back azimuth (direction of the source from the lander). Where both are
given, the epicentre is placed here on a sphere of Mars's radius by moving from the lander along that
bearing by that distance. Events with a distance only keep lat/lon as null.

Run:  python3 scripts/data/build_marsquakes.py            (downloads the page, about 5 MB)
      python3 scripts/data/build_marsquakes.py page.html  (parses a copy you already have)
"""
import html
import json
import math
import re
import sys
import urllib.request

URL = 'https://ds.iris.edu/ds/nodes/dmc/tools/mars-events/v14/'
OUT = 'public/data/marsquakes.json'
INSIGHT = (4.5024, 135.6234)  # InSight lander, Elysium Planitia (lat N, lon E)


def clean(x):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', x))).strip()


def number(x):
    m = re.match(r'-?\d+(\.\d+)?', x)
    return float(m.group(0)) if m else None


def destination(lat, lon, bearing_deg, dist_deg):
    la, lo, b, d = map(math.radians, (lat, lon, bearing_deg, dist_deg))
    la2 = math.asin(math.sin(la) * math.cos(d) + math.cos(la) * math.sin(d) * math.cos(b))
    lo2 = lo + math.atan2(math.sin(b) * math.sin(d) * math.cos(la), math.cos(d) - math.sin(la) * math.sin(la2))
    return math.degrees(la2), (math.degrees(lo2) + 540) % 360 - 180


def main():
    if len(sys.argv) > 1:
        text = open(sys.argv[1], errors='ignore').read()
    else:
        text = urllib.request.urlopen(URL, timeout=120).read().decode('utf-8', 'ignore')

    best = {}
    for cls, body in re.findall(r'<tr class="([^"]*)">(.*?)</tr>\s*(?=<tr|</tbody)', text, flags=re.S):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', body, flags=re.S)
        if len(tds) < 8:
            continue
        name = clean(re.sub(r'<span class="meteorite".*?</span>', '', tds[1], flags=re.S))
        row = {
            'name': name,
            't': clean(tds[0]).replace(' ', 'T') + 'Z',
            'impact': 'class="meteorite"' in tds[1],
            'kind': clean(tds[3]).title(),
            'dist': number(clean(tds[4])),
            'mag': number(clean(tds[5])),
            'baz': number(clean(tds[6])),
            'q': clean(tds[7]),
            'preferred': 'preferred-origin' in cls,
        }
        old = best.get(name)
        # keep the preferred origin; otherwise the row with the most information
        score = (row['preferred'], row['mag'] is not None, row['dist'] is not None, row['baz'] is not None)
        if old is None or score > old[0]:
            best[name] = (score, row)

    events = []
    for _, row in best.values():
        row.pop('preferred')
        if row['dist'] is not None and row['baz'] is not None:
            row['lat'], row['lon'] = (round(v, 2) for v in destination(*INSIGHT, row['baz'], row['dist']))
        else:
            row['lat'] = row['lon'] = None
        events.append(row)
    events.sort(key=lambda e: e['t'])

    out = {
        'source': 'InSight Marsquake Service, Mars Seismic Catalogue V14 (2023-04-01)',
        'doi': 'https://doi.org/10.12686/a21',
        'lander': {'name': 'InSight', 'lat': INSIGHT[0], 'lon': INSIGHT[1]},
        'events': events,
    }
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    located = sum(e['lat'] is not None for e in events)
    print(f'{len(events)} events, {located} located, {sum(e["impact"] for e in events)} impacts -> {OUT}')


if __name__ == '__main__':
    main()
