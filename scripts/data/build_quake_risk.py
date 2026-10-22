"""Builds the marsquake layer's data: tectonic fault lines and a relative seismic-risk grid.

Inputs (both real data):
  - Faults: USGS SIM 3292, Geologic Map of Mars, 1:20M (Tanaka et al., 2014), structure layer
    SIM3292_Global_Structure. Only structures of tectonic origin are kept: graben axes (crust pulled
    apart along normal faults), wrinkle ridges (crust squeezed over thrust faults), pit crater chains and
    tectonic ridges. The shapefile is read straight out of the 809 MB USGS package with HTTP range
    requests, so only the ~12 MB needed is downloaded.
  - Quakes: the InSight Marsquake Service catalogue V14, as built by build_marsquakes.py.

The risk grid is a relative index, not an official hazard map: mapped fault length per area (weighted by
fault type and how fresh it looks), smoothed, plus the places InSight located marsquakes, weighted by
magnitude. Each 1 degree cell gets a score from 0 to 255, and four levels are cut at fixed shares of the
planet's surface.

Run:  python3 scripts/data/build_quake_risk.py
Writes: public/data/mars_faults.json, public/data/mars_quake_risk.json
"""
import base64
import json
import math
import os
import struct
import urllib.request
import zlib

ZIP_URL = 'https://pubs.usgs.gov/sim/3292/downloads/sim3292_database.zip'
SHAPE = 'SIM3292_Shapefiles/SIM3292_Global_Structure'
QUAKES = 'scripts/data/marsquakes_v14.json'
OUT_FAULTS = 'public/data/mars_faults.json'
OUT_RISK = 'public/data/mars_quake_risk.json'
UA = {'User-Agent': 'curl/8.5'}

TYPES = {'Graben axis': 'graben', 'Wrinkle ridge': 'ridge', 'Pit crater chain': 'pits', 'Ridge': 'ridge'}
TYPE_WEIGHT = {'graben': 1.0, 'pits': 1.0, 'ridge': 0.5}
FRESH_WEIGHT = {'Fresh': 2.0, 'Subdued': 1.0, 'Partly Buried': 0.6, 'Buried': 0.3}
# Cerberus Fossae, where InSight located most of its marsquakes
CERBERUS = (2, 16, 150, 180)


def remote_files(names):
    """Reads chosen members of the remote zip with range requests."""
    def get(a, b):
        req = urllib.request.Request(ZIP_URL, headers={**UA, 'Range': f'bytes={a}-{b}'})
        return urllib.request.urlopen(req, timeout=180).read()
    size = int(urllib.request.urlopen(urllib.request.Request(ZIP_URL, method='HEAD', headers=UA), timeout=60).headers['Content-Length'])
    tail = get(max(0, size - 70000), size - 1)
    i = tail.rfind(b'PK\x05\x06')
    n, cd_size, cd_off = struct.unpack('<HII', tail[i + 10:i + 20])
    if cd_off == 0xFFFFFFFF or n == 0xFFFF:
        j = tail.rfind(b'PK\x06\x06')
        n, cd_size, cd_off = struct.unpack('<QQQ', tail[j + 32:j + 56])
    cd = get(cd_off, cd_off + cd_size - 1)
    out, p = {}, 0
    while p < len(cd) and cd[p:p + 4] == b'PK\x01\x02':
        method, csize, usize, nlen, xlen, clen, lho = struct.unpack('<10xH8xIIHHH8xI', cd[p:p + 46])
        name = cd[p + 46:p + 46 + nlen].decode('utf-8', 'replace')
        if any(name.endswith(want) for want in names):
            h = get(lho, lho + 29)
            ln, lx = struct.unpack('<HH', h[26:30])
            data = get(lho + 30 + ln + lx, lho + 30 + ln + lx + csize - 1)
            out[name.rsplit('.', 1)[1]] = zlib.decompress(data, -15) if method == 8 else data
        p += 46 + nlen + xlen + clen
    return out


def read_dbf(b):
    n, hlen, rlen = struct.unpack('<4xIHH', b[:12])
    fields, p = [], 32
    while b[p] != 0x0D:
        fields.append((b[p:p + 11].split(b'\0')[0].decode(), b[p + 16]))
        p += 32
    rows = []
    for i in range(n):
        r, q, row = b[hlen + i * rlen + 1:hlen + (i + 1) * rlen], 0, {}
        for name, flen in fields:
            row[name] = r[q:q + flen].decode('latin-1').strip()
            q += flen
        rows.append(row)
    return rows


def read_shp(b):
    p, shapes = 100, []
    while p < len(b):
        _, clen = struct.unpack('>II', b[p:p + 8])
        p += 8
        if struct.unpack('<i', b[p:p + 4])[0] in (3, 13, 23):
            nparts, npts = struct.unpack('<ii', b[p + 36:p + 44])
            parts = struct.unpack(f'<{nparts}i', b[p + 44:p + 44 + 4 * nparts])
            q = p + 44 + 4 * nparts
            pts = struct.unpack(f'<{2 * npts}d', b[q:q + 16 * npts])
            xy = list(zip(pts[1::2], pts[0::2]))  # (lat, lon)
            shapes.append([xy[parts[k]:(parts[k + 1] if k + 1 < nparts else npts)] for k in range(nparts)])
        else:
            shapes.append([])
        p += clen * 2
    return shapes


def simplify(pts, tol):
    """Douglas-Peucker in degrees."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (y1, x1), (y2, x2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        d2 = dx * dx + dy * dy or 1e-12
        best, idx = 0, -1
        for i in range(a + 1, b):
            y, x = pts[i]
            t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / d2))
            dist = math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
            if dist > best:
                best, idx = dist, i
        if best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def seg_km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 3389.5 * math.asin(math.sqrt(min(1, h)))


def blur(grid, w, h, sigma):
    r = int(sigma * 3)
    k = [math.exp(-(i * i) / (2 * sigma * sigma)) for i in range(-r, r + 1)]
    s = sum(k)
    k = [v / s for v in k]
    tmp = [[sum(grid[y][(x + i) % w] * k[i + r] for i in range(-r, r + 1)) for x in range(w)] for y in range(h)]
    return [[sum(tmp[min(h - 1, max(0, y + i))][x] * k[i + r] for i in range(-r, r + 1)) for x in range(w)] for y in range(h)]


def main():
    files = remote_files([SHAPE + '.shp', SHAPE + '.dbf'])
    rows, shapes = read_dbf(files['dbf']), read_shp(files['shp'])

    lines, W, H = [], 360, 180
    density = [[0.0] * W for _ in range(H)]
    for row, parts in zip(rows, shapes):
        if row['Origin'] != 'Tectonic' or row['Interpreta'] not in TYPES:
            continue
        kind = TYPES[row['Interpreta']]
        weight = TYPE_WEIGHT[kind] * FRESH_WEIGHT.get(row['Preservati'], 1.0)
        for part in parts:
            for a, b in zip(part, part[1:]):
                if abs(a[1] - b[1]) > 180:
                    continue
                m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                gy, gx = min(H - 1, int(90 - m[0])), min(W - 1, int(m[1] + 180))
                density[gy][gx] += seg_km(a, b) * weight
            simple = simplify(part, 0.04)
            if len(simple) < 2:
                continue
            la0, la1_, lo0, lo1_ = CERBERUS
            active = kind == 'graben' and any(la0 < y < la1_ and lo0 < x < lo1_ for y, x in simple)
            km = float(row['SphLen_km'] or 0) or sum(seg_km(a, b) for a, b in zip(part, part[1:]))
            lines.append({
                't': kind,
                'p': row['Preservati'],
                'km': round(km),
                'a': 1 if active else 0,
                'c': [v for y, x in simple for v in (round(y, 2), round(x, 2))],
            })

    # fault length per km2 of surface
    cell_km2 = [(math.pi * 3389.5 / 180) ** 2 * max(0.05, math.cos(math.radians(89.5 - y))) for y in range(H)]
    density = blur([[density[y][x] / cell_km2[y] for x in range(W)] for y in range(H)], W, H, 2.2)

    quakes = json.load(open(QUAKES))
    seismic = [[0.0] * W for _ in range(H)]
    for e in quakes['events']:
        if e['lat'] is None:
            continue
        amp = 10 ** (0.5 * ((e['mag'] or 3) - 3))
        sigma = 3.0 if e['q'] == 'A' else 4.5
        for y in range(H):
            lat = 89.5 - y
            for x in range(W):
                lon = x - 179.5
                dlon = (lon - e['lon'] + 540) % 360 - 180
                d2 = (lat - e['lat']) ** 2 + (dlon * math.cos(math.radians(lat))) ** 2
                if d2 < (sigma * 3) ** 2:
                    seismic[y][x] += amp * math.exp(-d2 / (2 * sigma * sigma))

    dmax = sorted(v for r in density for v in r)[int(W * H * 0.995)] or 1
    smax = max(v for r in seismic for v in r) or 1
    score = [[min(1.0, 0.75 * min(1.0, density[y][x] / dmax) + 0.9 * (seismic[y][x] / smax)) for x in range(W)] for y in range(H)]
    cells = [(score[y][x], cell_km2[y]) for y in range(H) for x in range(W)]

    # Levels cut by share of the planet's area: the top 4% very high, next 10% high, next 26% moderate
    total = sum(a for _, a in cells)
    acc, cuts, shares, k = 0.0, [], [0.04, 0.14, 0.40], 0
    for s, a in sorted(cells, key=lambda c: -c[0]):
        acc += a
        while k < len(shares) and acc / total >= shares[k]:
            cuts.append(round(s * 255))
            k += 1
    raw = bytes(round(score[y][x] * 255) for y in range(H) for x in range(W))

    located = [e for e in quakes['events'] if e['lat'] is not None]
    biggest = max((e for e in quakes['events'] if e['mag'] is not None), key=lambda e: e['mag'])
    json.dump({
        'source': 'USGS SIM 3292, Geologic Map of Mars 1:20M (Tanaka et al., 2014), structure layer, tectonic features',
        'doi': 'https://doi.org/10.3133/sim3292',
        'lines': lines,
    }, open(OUT_FAULTS, 'w'), separators=(',', ':'))
    json.dump({
        'source': 'Derived in MarsWalk from USGS SIM 3292 tectonic structures and the InSight Marsquake Service catalogue V14',
        'width': W, 'height': H, 'west': -180, 'north': 90, 'cell_deg': 1,
        'cuts': cuts[::-1],  # ascending: moderate, high, very high
        'score': base64.b64encode(raw).decode(),
        'insight': quakes['lander'],
        'stats': {
            'events': len(quakes['events']),
            'measured': sum(e['mag'] is not None for e in quakes['events']),
            'located': len(located),
            'impacts': sum(e['impact'] for e in quakes['events']),
            'biggest': {'name': biggest['name'], 'mag': biggest['mag'], 't': biggest['t']},
            'cerberus': sum(1 for e in located if 0 < e['lat'] < 20 and 155 < e['lon'] < 175),
        },
    }, open(OUT_RISK, 'w'), separators=(',', ':'))
    print(f'{len(lines)} fault lines ({sum(l["a"] for l in lines)} in Cerberus Fossae), '
          f'{os.path.getsize(OUT_FAULTS) // 1024} KB; risk grid {os.path.getsize(OUT_RISK) // 1024} KB, cuts {cuts[::-1]}')


if __name__ == '__main__':
    main()
