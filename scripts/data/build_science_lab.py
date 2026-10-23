"""Builds the Science Lab's data from real Perseverance instrument products on the NASA PDS Geosciences Node.

For each rock campaign below it downloads, reads and condenses:
  - SuperCam LIBS (laser-induced breakdown spectroscopy): calibrated spectra, 30 laser shots per point
    (mars2020_supercam, data_calibrated_spectra, "cl1" FITS files)
  - PIXL X-ray fluorescence: oxide composition of every analysed point plus its position on the rock
    (mars2020_pixl, data_oxides_pmc "ps__" tables joined with data_processed "pe__" position tables)
  - SHERLOC deep-UV Raman and fluorescence: calibrated spectra of every spot in a scan plus the spot
    positions on the context image (mars2020_sherloc, data_processed "ss__" tables)
and the matching rover photos from NASA's Perseverance raw image archive.

Everything shown in the lab is measured data read from those files; the only things added here are
averages, baselines and peak finding, all done on the measured numbers. Line positions used to name the
LIBS peaks are the standard atomic emission lines (NIST Atomic Spectra Database).

Run:  python3 scripts/data/build_science_lab.py          (needs numpy and Pillow; downloads about 80 MB)
Writes: public/data/science/campaigns.json, public/data/science/<id>.json, public/data/science/img/*.jpg
"""
import csv
import io
import json
import math
import os
import re
import sys
import urllib.request

import numpy as np
from PIL import Image

PDS = 'https://pds-geosciences.wustl.edu/m2020/'
RAW = 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&sol={sol}&page=0&per_page=500&order=sol+desc'
WAYPOINTS = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json'
OUT = 'public/data/science'
UA = {'User-Agent': 'curl/8.5'}

# One entry per rock. The PIXL and SuperCam products carry the target name; SHERLOC products only carry the
# sol, so its scan is the one made on the stated sol of the same abrasion campaign.
CAMPAIGNS = [
    dict(id='guillaumes', name='Guillaumes', libs=(162, 'guillaumes_162_scam'), pixl=167, sherloc=162, aci=True),
    dict(id='bellegarde', name='Bellegarde', libs=(187, 'bellegarde_187_scam'), pixl=187, sherloc=186),
    dict(id='dourbes', name='Dourbes', libs=(259, 'dourbes_259'), pixl=257, sherloc=257),
    dict(id='quartier', name='Quartier', libs=(294, 'quartier_294_scam'), pixl=294, sherloc=293),
    dict(id='montpezat', name='Montpezat', libs=(345, 'montpezat_scam'), pixl=347, sherloc=349),
    dict(id='berry-hollow', name='Berry Hollow', libs=(507, 'berry_hollow_507_sca'), pixl=507, sherloc=505),
]

OXIDES = ['Na2O', 'MgO', 'Al2O3', 'SiO2', 'P2O5', 'SO3', 'Cl', 'K2O', 'CaO', 'TiO2', 'Cr2O3', 'MnO', 'FeO-T']
LASER_NM = 248.5794  # SHERLOC deep-UV laser

# Strong atomic emission lines seen in the SuperCam range (nm, in air). El, ion stage, wavelength.
LINES = [
    ('C', 'I', 247.86), ('Si', 'I', 250.69), ('Si', 'I', 251.43), ('Si', 'I', 251.61), ('Si', 'I', 252.41),
    ('Si', 'I', 252.85), ('Si', 'I', 288.16), ('Si', 'I', 390.55), ('Si', 'II', 634.71), ('Si', 'II', 637.14),
    ('P', 'I', 253.56), ('P', 'I', 255.33),
    ('Mn', 'II', 257.61), ('Mn', 'II', 259.37), ('Mn', 'II', 260.57), ('Mn', 'I', 403.31),
    ('Fe', 'II', 259.94), ('Fe', 'II', 261.19), ('Fe', 'II', 273.96), ('Fe', 'II', 274.65), ('Fe', 'II', 275.57),
    ('Fe', 'I', 302.06), ('Fe', 'I', 344.06), ('Fe', 'I', 358.12), ('Fe', 'I', 371.99), ('Fe', 'I', 373.49),
    ('Fe', 'I', 374.56), ('Fe', 'I', 382.04), ('Fe', 'I', 385.99), ('Fe', 'I', 404.58), ('Fe', 'I', 406.36),
    ('Fe', 'I', 438.35), ('Fe', 'I', 440.48), ('Fe', 'I', 527.04),
    ('Cr', 'II', 267.72), ('Cr', 'I', 425.43), ('Cr', 'I', 427.48), ('Cr', 'I', 428.97),
    ('Mg', 'II', 279.55), ('Mg', 'II', 280.27), ('Mg', 'I', 285.21), ('Mg', 'I', 383.23), ('Mg', 'I', 383.83),
    ('Mg', 'II', 448.11), ('Mg', 'I', 517.27), ('Mg', 'I', 518.36),
    ('Al', 'I', 308.22), ('Al', 'I', 309.27), ('Al', 'I', 394.40), ('Al', 'I', 396.15),
    ('Ca', 'II', 315.89), ('Ca', 'II', 317.93), ('Ca', 'II', 393.37), ('Ca', 'II', 396.85), ('Ca', 'I', 422.67),
    ('Ca', 'I', 612.22), ('Ca', 'I', 616.22), ('Ca', 'I', 643.91), ('Ca', 'I', 649.38),
    ('Ti', 'II', 334.94), ('Ti', 'II', 336.12), ('Ti', 'II', 337.28), ('Ti', 'II', 338.38), ('Ti', 'II', 375.93),
    ('Ti', 'II', 376.13),
    ('Cu', 'I', 324.75), ('Cu', 'I', 327.40),
    ('CN', 'band', 388.34),
    ('Sr', 'II', 407.77), ('Sr', 'II', 421.55), ('Ba', 'II', 455.40),
    ('H', 'I', 656.28), ('Li', 'I', 670.78),
    ('N', 'I', 742.36), ('N', 'I', 746.83),
    ('K', 'I', 766.49), ('K', 'I', 769.90), ('O', 'I', 777.42), ('Rb', 'I', 780.03),
    ('Na', 'I', 818.33), ('Na', 'I', 819.48), ('Cl', 'I', 837.59), ('O', 'I', 844.64),
    ('Na', 'I', 588.99), ('Na', 'I', 589.59),
]
ATMOSPHERE = {'C', 'O', 'N', 'CN'}  # also come from the carbon-dioxide air the laser plasma forms in

# Raman reference bands (cm-1) from the literature, used to say where to look, never as detections
RAMAN_BANDS = [
    ('Olivine', 815, 860), ('Perchlorate', 925, 950), ('Phosphate', 950, 975),
    ('Sulfate or pyroxene', 995, 1030), ('Carbonate', 1080, 1100), ('Carbon D band', 1330, 1390),
    ('Carbon G band', 1570, 1620), ('Water or hydroxyl', 3200, 3650),
]
# Fluorescence ranges (nm) where aromatic organic compounds are known to glow under 248.6 nm light
FLUOR_BANDS = [('One-ring aromatics', 275, 300), ('Two- and three-ring aromatics', 300, 345)]


# ---------------------------------------------------------------- network
CACHE = os.environ.get('SCIENCE_CACHE')  # optional folder that keeps downloads between runs


def fetch(url, tries=3):
    path = None
    if CACHE:
        os.makedirs(CACHE, exist_ok=True)
        path = os.path.join(CACHE, re.sub(r'[^A-Za-z0-9._-]', '_', url)[-200:])
        if os.path.exists(path):
            return open(path, 'rb').read()
    for i in range(tries):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
            if path:
                open(path, 'wb').write(data)
            return data
        except Exception as e:  # noqa: BLE001
            if i == tries - 1 or getattr(e, 'code', None) == 404:
                raise
            print('  retry', url[-60:], e)


def listing(url):
    html = fetch(url).decode('utf-8', 'replace')
    return [h.split('/')[-1] for h in re.findall(r'HREF="([^"]+)"', html) if not h.endswith('/')]


def title(url):
    m = re.search(r'<title>(.*?)</title>', fetch(url).decode('utf-8', 'replace'), re.S)
    return m.group(1).strip() if m else ''


# ---------------------------------------------------------------- FITS (binary tables only)
def read_fits(b):
    p, hdus = 0, {}
    while p < len(b):
        cards, end = {}, False
        while not end:
            blk = b[p:p + 2880]
            p += 2880
            for i in range(36):
                c = blk[i * 80:(i + 1) * 80].decode('ascii', 'replace')
                if c.startswith('END'):
                    end = True
                    break
                if '=' in c[:10]:
                    cards[c[:8].strip()] = c[10:].split('/')[0].strip().strip("'").strip()
        size = int(cards.get('NAXIS1', 0)) * int(cards.get('NAXIS2', 0)) + int(cards.get('PCOUNT', 0)) if 'NAXIS1' in cards else 0
        hdus[cards.get('EXTNAME', 'PRIMARY')] = (cards, b[p:p + size])
        p += ((size + 2879) // 2880) * 2880
    return hdus


def table(hdu):
    cards, data = hdu
    fm = {'E': '>f4', 'D': '>f8', 'J': '>i4', 'I': '>i2', 'K': '>i8', 'B': 'u1'}
    dt = []
    for i in range(1, int(cards['TFIELDS']) + 1):
        f = cards['TFORM%d' % i]
        rep = int(''.join(ch for ch in f if ch.isdigit()) or 1)
        dt.append((cards['TTYPE%d' % i], fm[f[-1]], (rep,)) if rep > 1 else (cards['TTYPE%d' % i], fm[f[-1]]))
    rows = int(cards['NAXIS2'])
    return np.frombuffer(data[:rows * int(cards['NAXIS1'])], dtype=np.dtype(dt))


# ---------------------------------------------------------------- helpers
def smooth(y, n):
    k = np.ones(n) / n
    return np.convolve(np.pad(y, n // 2, mode='edge'), k, mode='valid')[:len(y)]


def lower_envelope(y, win):
    """Slowly varying floor under the peaks: running minimum, then smoothed."""
    pad = win // 2
    yp = np.pad(y, pad, mode='edge')
    mins = np.lib.stride_tricks.sliding_window_view(yp, win).min(axis=1)[:len(y)]
    return smooth(mins, win)


def robust_sigma(x):
    x = x[np.isfinite(x)]
    return 1.4826 * np.median(np.abs(x - np.median(x))) or 1e-9


def pool(a, n):
    m = (a.shape[-1] // n) * n
    return a[..., :m].reshape(*a.shape[:-1], m // n, n).mean(-1)


def r(a, d=1):
    return [round(float(v), d) for v in a]


# ---------------------------------------------------------------- LIBS
def libs_point(url):
    h = read_fits(fetch(url))
    wl = table(h['WAVELENGTH'])['Wavelength'].astype(float)
    sp = table(h['SPECTRA'])
    shots = np.array([sp[n] for n in sp.dtype.names]).astype(float)  # (shots, channels)
    return wl, shots


def find_lines(wl, y, segs):
    """Peaks of the measured spectrum, named by the nearest known emission line."""
    found = []
    for a, b in segs:
        ys, ws = y[a:b], wl[a:b]
        floor = lower_envelope(ys, 61)
        res = ys - floor
        noise = robust_sigma(res)
        for i in range(3, len(ys) - 3):
            if res[i] > 6 * noise and res[i] == res[i - 3:i + 4].max():
                found.append((float(ws[i]), float(res[i])))
    top = max((h for _, h in found), default=1)
    out = []
    for nm, h in found:
        best = min(LINES, key=lambda l: abs(l[2] - nm))
        if abs(best[2] - nm) <= 0.14:
            out.append(dict(nm=round(nm, 2), h=round(h / top * 100, 1), el=best[0], ion=best[1], ref=best[2]))
    out.sort(key=lambda l: -l['h'])
    return out[:60]


def build_libs(c):
    sol, key = c['libs']
    d = f'{PDS}urn-nasa-pds-mars2020_supercam/data_calibrated_spectra/sol_{sol:05d}/'
    files = sorted(f for f in listing(d) if '_cl1_' in f and key in f and f.endswith('.fits'))
    if not files:
        raise SystemExit(f'no LIBS files for {key} on sol {sol}')
    pick = [files[i] for i in sorted({round(k * (len(files) - 1) / 4) for k in range(5)})] if len(files) > 5 else files
    wl0, pts = None, []
    for k, f in enumerate(pick):
        print('  LIBS', f)
        wl, shots = libs_point(d + f)
        if wl0 is None:
            wl0 = wl
        mean = shots[5:].mean(0)  # the first five shots clear dust off the rock, so they are left out
        pts.append(dict(file=f, mean=np.interp(wl0, wl, mean), shots=shots if k == 0 else None, wl=wl))
    gaps = [0, *(np.where(np.diff(wl0) > 2)[0] + 1).tolist(), len(wl0)]
    segs = list(zip(gaps[:-1], gaps[1:]))
    scale = max(float(np.nanmax(p['mean'])) for p in pts) / 1000
    out_pts = []
    for k, p in enumerate(pts):
        n = re.search(r'_(\d\d)p(\d\d)\.fits', p['file'])
        item = dict(n=int(n.group(1)), product=p['file'][:-5], mean=r(p['mean'] / scale, 1),
                    lines=find_lines(wl0, p['mean'] / scale, segs))
        if p['shots'] is not None:
            # shots are pooled six channels at a time inside each spectrometer so the file stays small
            sh = np.concatenate([pool(p['shots'][:, a:b], 6) for a, b in segs], axis=1) / scale
            item['shots'] = [[int(round(v)) for v in row] for row in sh]
            item['shotWl'] = r(np.concatenate([pool(wl0[None, a:b], 6)[0] for a, b in segs]), 2)
        out_pts.append(item)
    return dict(
        sol=sol, target=key, wl=r(wl0, 3), segments=segs, points=out_pts, dropShots=5,
        unit='Relative intensity (the strongest line in this observation = 1000)',
        product=pick[0].split('_cl1_')[0] + '_cl1…', directory=d,
    )


# ---------------------------------------------------------------- PIXL
def read_csv_rows(b):
    return list(csv.reader(io.StringIO(b.decode('utf-8', 'replace'))))


def build_pixl(c):
    sol = c['pixl']
    dox = f'{PDS}urn-nasa-pds-mars2020_pixl/data_oxides_pmc/sol_{sol:05d}/'
    combined = None
    for f in sorted(x for x in listing(dox) if x.endswith('.xml')):
        t = title(dox + f)
        if 'Combined' in t:
            combined = (f[:-4] + '.csv', t)
            break
    if not combined:
        raise SystemExit(f'no combined PIXL product on sol {sol}')
    rows = read_csv_rows(fetch(dox + combined[0]))
    head = rows[0]
    idx = {h: i for i, h in enumerate(head)}
    pts = {}
    for row in rows[1:]:
        if len(row) < len(head):
            continue
        pts[int(row[0])] = {o: float(row[idx[f'{o}_wt%']]) for o in OXIDES}
    best = None
    # the scan's position table is filed under the sol the scan started, which can be a sol or two earlier
    for ds in (sol, sol - 1, sol - 2):
        dpos = f'{PDS}urn-nasa-pds-mars2020_pixl/data_processed/sol_{ds:05d}/'
        try:
            names = listing(dpos)
        except Exception:  # noqa: BLE001
            continue
        for f in sorted(x for x in names if x.startswith('pe__') and 'rxl' in x and x.endswith('.csv')):
            pr = read_csv_rows(fetch(dpos + f))
            pi = {h: i for i, h in enumerate(pr[0])}
            xy = {int(q[0]): (float(q[pi['x']]), float(q[pi['y']])) for q in pr[1:] if len(q) > pi['y']}
            cover = sum(1 for k in pts if k in xy)
            if best is None or cover > best[0]:
                best = (cover, f, xy)
        if best and best[0] >= len(pts) * 0.8:
            break
    if not best or best[0] < len(pts) * 0.8:
        raise SystemExit(f'PIXL positions do not cover the oxide table on sol {sol}')
    xy = best[2]
    keep = sorted(k for k in pts if k in xy)
    x0 = np.array([xy[k][0] for k in keep]) * 1000
    y0 = np.array([xy[k][1] for k in keep]) * 1000
    vals = {o: np.array([pts[k][o] for k in keep]) for o in OXIDES}
    stats = {o: dict(med=round(float(np.median(v)), 2), lo=round(float(np.percentile(v, 16)), 2),
                     hi=round(float(np.percentile(v, 84)), 2), max=round(float(v.max()), 2)) for o, v in vals.items()}
    return dict(
        sol=sol, product=combined[0][:-4], title=combined[1].split(': ', 1)[-1], positionsProduct=best[1][:-4],
        n=len(keep), oxides=OXIDES, stats=stats,
        x=r(x0 - x0.mean(), 2), y=r(y0 - y0.mean(), 2),
        v={o: r(vals[o], 2) for o in OXIDES},
    )


# ---------------------------------------------------------------- SHERLOC
def build_sherloc(c, raw):
    sol = c['sherloc']
    d = f'{PDS}urn-nasa-pds-mars2020_sherloc/data_processed/sol_{sol:05d}/'
    files = listing(d)
    rrs = sorted(f for f in files if 'rrs__' in f and re.search(r'w108cgn', f) and f.endswith('.csv'))
    if not rrs:
        rrs = sorted(f for f in files if 'rrs__' in f and re.search(r'w\d08cgn', f) and f.endswith('.csv'))
    if not rrs:
        raise SystemExit(f'no SHERLOC scan on sol {sol}')
    name = rrs[0]
    stamp = re.search(r'ss__\d{4}_(\d+_\d+)rrs', name).group(1)
    rls = next(f for f in files if f'{stamp}rls' in f and f.endswith('.csv'))
    print('  SHERLOC', name)
    lines = fetch(d + name).decode('utf-8', 'replace').split('\n')
    wl = np.array(lines[2].split(','), float)
    regions, cur = {}, None
    for ln in lines[3:]:
        if ln.startswith('LASER-NORMALIZED_SPECTRA:_REGION_'):
            cur = int(ln.strip().rsplit('_', 1)[1])
            regions[cur] = []
        elif cur and ln and not ln.startswith('R%d_Channel' % cur):
            regions[cur].append([float(v) for v in ln.split(',')])
    R = {k: np.array(v) for k, v in regions.items()}
    n = R[1].shape[0]
    pos = read_csv_rows(fetch(d + rls))[2:]
    spots = [dict(samp=float(p[3]) if p[3] else None, line=float(p[4]) if p[4] else None) for p in pos[:n]]
    image = pos[0][2].split('.')[0] if pos else None

    # Raman: region 1, Raman shift 800 to 4000 cm-1 (the shift grows with wavelength)
    shift = (1 / LASER_NM - 1 / wl) * 1e7
    sel = (shift >= 800) & (shift <= 4000)
    sh, rm = shift[sel], R[1][:, sel]
    mean_r = rm.mean(0)
    base = lower_envelope(smooth(mean_r, 9), 81)
    corr = smooth(mean_r - base, 3)
    # channel-to-channel scatter is the noise: broad real features do not inflate it
    noise = float(robust_sigma(np.diff(mean_r)) / math.sqrt(2))
    bands = []
    for nm, a, b in RAMAN_BANDS:
        m = np.where((sh >= a) & (sh <= b))[0]
        if len(m) < 3:
            continue
        k = m[np.argmax(corr[m])]
        # a peak has to turn over inside the band; a slope running into a neighbouring peak is not a detection
        inside = m[0] < k < m[-1] and corr[k] >= corr[k - 1] and corr[k] >= corr[k + 1]
        bands.append(dict(name=nm, lo=a, hi=b, snr=round(float(corr[k] / noise), 1) if inside else 0.0, at=round(float(sh[k]))))
    # per-spot strength of the sulfate/pyroxene band, over that spot's own floor
    spot_raman = []
    for row in rm:
        s5 = smooth(row, 5)
        floor = lower_envelope(smooth(row, 9), 81)
        m = (sh >= 995) & (sh <= 1030)
        spot_raman.append(float((s5 - floor)[m].max()))

    # Fluorescence: region 2 up to 338 nm, region 3 from there on
    cut = 338.0
    f_wl = wl
    fl = np.where(f_wl[None, :] < cut, R[2], R[3])
    fsel = (wl >= 280) & (wl <= 355)
    fwl, fspec = wl[fsel], fl[:, fsel]
    pw = pool(fwl[None, :], 4)[0]
    ps = pool(fspec, 4)
    dark = R[2][:, (wl >= 250) & (wl <= 268)]  # nothing glows or scatters here: it shows the detector noise
    f_noise = float(robust_sigma(dark.mean(0)))
    f_bands = []
    per_band = {}
    for nm, a, b in FLUOR_BANDS:
        m = (fwl >= a) & (fwl < b)
        per_band[nm] = fspec[:, m].mean(1)
        f_bands.append(dict(name=nm, lo=a, hi=b, mean=round(float(per_band[nm].mean()), 1),
                            snr=round(float(per_band[nm].mean() / f_noise), 1)))
    tot = fspec.mean(1)

    # big scans keep a spectrum for every k-th spot only (the maps still use every spot)
    step = max(1, math.ceil(n / 150))
    keep_idx = list(range(0, n, step))

    aci = None
    if image:
        base_id = re.sub(r'(LMJ|LUJ)\d\d$', r'\1', image)
        for im in raw.get('images', []):
            if im['camera']['instrument'] == 'SHERLOC_ACI' and (im.get('imageid') or '').startswith(base_id):
                aci = im
                break
    return dict(
        sol=sol, product=name[:-4], scanFile=name, spotsFile=rls, n=n,
        spots=spots, imageId=image,
        raman=dict(shift=r(sh, 1), mean=r(mean_r, 1), baseline=r(base, 1),
                   noise=round(float(noise), 2), bands=bands, spot=r(spot_raman, 1)),
        fluor=dict(noise=round(f_noise, 2), wl=r(pw, 2), mean=r(ps.mean(0), 1), spotIdx=keep_idx,
                   spots=[[int(round(v)) for v in ps[i]] for i in keep_idx],
                   bands=f_bands, total=r(tot, 1), byBand={k: r(v, 1) for k, v in per_band.items()}),
    ), aci


# ---------------------------------------------------------------- images
def save_image(url, path, max_side=900, crop_dark=False):
    im = Image.open(io.BytesIO(fetch(url))).convert('RGB')
    if crop_dark:  # the context imager is a circle on a black square: trim to the circle
        a = np.asarray(im).max(2)
        ys, xs = np.where(a > 22)
        if len(xs):
            im = im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    im.thumbnail((max_side, max_side))
    im.save(path, quality=82, optimize=True)
    return im.size


def pick_rmi(raw_by_sol, sol):
    best = None
    for s in (sol, sol - 1, sol + 1):
        for im in raw_by_sol(s).get('images', []):
            if im['camera']['instrument'] != 'SUPERCAM_RMI' or 'large' not in im['image_files']:
                continue
            thumb = Image.open(io.BytesIO(fetch(im['image_files']['small']))).convert('RGB')
            hsv = np.asarray(thumb.convert('HSV')).astype(float)
            sat = float(hsv[..., 1][hsv[..., 2] > 40].mean()) if (hsv[..., 2] > 40).any() else 0
            if best is None or sat > best[0]:
                best = (sat, im)
        if best and best[0] > 25:
            break
    return best[1] if best else None


# ---------------------------------------------------------------- campaign summary
def rock_type(med):
    if med['SO3'] >= 10:
        return 'Sulfate-rich sedimentary rock'
    if med['MgO'] + med['FeO-T'] >= 40 and med['SiO2'] <= 44:
        return 'Olivine-rich igneous rock'
    if med['SiO2'] <= 52:
        return 'Basaltic igneous rock'
    return 'Silica-rich rock'


def main():
    os.makedirs(OUT + '/img', exist_ok=True)
    cache = {}

    def raw_by_sol(s):
        if s not in cache:
            try:
                cache[s] = json.loads(fetch(RAW.format(sol=s)))
            except Exception as e:  # noqa: BLE001
                print('  raw images unavailable for sol', s, e)
                cache[s] = {}
        return cache[s]

    wp = json.loads(fetch(WAYPOINTS))['features']
    index = []
    for c in CAMPAIGNS:
        print(c['name'])
        sols = sorted({c['libs'][0], c['pixl'], c['sherloc']})
        here = max((f['properties'] for f in wp if f['properties']['sol'] <= sols[-1] and f['properties'].get('lat')), key=lambda p: (p['sol'], p.get('drive') or 0))
        libs = build_libs(c)
        pixl = build_pixl(c)
        sherloc, aci = build_sherloc(c, raw_by_sol(c['sherloc']))

        images = {}
        rmi = pick_rmi(raw_by_sol, c['libs'][0])
        if rmi:
            images['rmi'] = dict(src=f"img/{c['id']}-rmi.jpg", sol=rmi['sol'], id=rmi.get('imageid'),
                                 size=save_image(rmi['image_files']['large'], f"{OUT}/img/{c['id']}-rmi.jpg", 900, True))
        if aci:
            dim = aci['extended']['dimension'].strip('()').split(',')
            images['aci'] = dict(src=f"img/{c['id']}-aci.jpg", sol=aci['sol'], id=aci.get('imageid'),
                                 width=int(dim[0]), height=int(dim[1]),
                                 size=save_image(aci['image_files']['large'], f"{OUT}/img/{c['id']}-aci.jpg", 1000))
        med = {o: s['med'] for o, s in pixl['stats'].items()}
        with open(f"{OUT}/{c['id']}.json", 'w') as f:
            json.dump(dict(id=c['id'], libs=libs, pixl=pixl, sherloc=sherloc), f, separators=(',', ':'))
        top = {}
        for pt in libs['points']:
            for ln in pt['lines']:
                top[ln['el']] = max(top.get(ln['el'], 0), ln['h'])
        index.append(dict(
            id=c['id'], name=c['name'], sols=dict(supercam=libs['sol'], pixl=pixl['sol'], sherloc=sherloc['sol']),
            siteSol=here['sol'], lat=round(here['lat'], 5), lon=round(here['lon'], 5), rockType=rock_type(med),
            pixlMedian=med, images=images, file=f"{c['id']}.json",
            elements=[e for e, _ in sorted(top.items(), key=lambda kv: -kv[1]) if e not in ATMOSPHERE][:8],
        ))
        print(f"  -> {c['id']}: {rock_type(med)}, PIXL {pixl['n']} points, SHERLOC {sherloc['n']} spots, {os.path.getsize(OUT + '/' + c['id'] + '.json') // 1024} KB")

    with open(f'{OUT}/campaigns.json', 'w') as f:
        json.dump(dict(
            source='NASA PDS Geosciences Node: Mars 2020 SuperCam, PIXL and SHERLOC data; photos from the Mars 2020 raw image archive',
            pds='https://pds-geosciences.wustl.edu/missions/mars2020/', laserNm=LASER_NM,
            ramanBands=[dict(name=n, lo=a, hi=b) for n, a, b in RAMAN_BANDS],
            campaigns=index,
        ), f, separators=(',', ':'))
    print('wrote', OUT)


if __name__ == '__main__':
    sys.exit(main())
