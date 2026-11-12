import urllib.request
import json
import re
from datetime import datetime, timezone

TARGETS = [
    {
        'id': 'mro',
        'horizonsId': '-74',
        'name': 'Mars Reconnaissance Orbiter (MRO)',
        'shortName': 'MRO',
        'agency': 'NASA / JPL',
        'launched': '2005-08-12',
        'arrival': '2006-03-10',
        'color': '#38bdf8',
        'commsRelay': 'Electra UHF (401.5 MHz) & X-Band',
        'primaryMission': 'Sub-meter optical reconnaissance (HiRISE), atmospheric sounding (MCS), radar subsurface sounding (SHARAD), and rover relay.',
        'instruments': ['HiRISE (0.3m/px camera)', 'CRISM (visible-infrared spectrometer)', 'SHARAD (subsurface sounding radar)', 'MCS (climate sounder)', 'MARCI (color imager)'],
    },
    {
        'id': 'odyssey',
        'horizonsId': '-53',
        'name': '2001 Mars Odyssey',
        'shortName': 'Mars Odyssey',
        'agency': 'NASA / JPL',
        'launched': '2001-04-07',
        'arrival': '2001-10-24',
        'color': '#a78bfa',
        'commsRelay': 'UHF Transceiver (437 MHz) & X-Band',
        'primaryMission': 'Thermal infrared global cartography (THEMIS), gamma-ray global hydrogen and elemental mapping (GRS), and continuous surface rover comms relay.',
        'instruments': ['THEMIS (thermal emission imaging)', 'GRS (gamma ray spectrometer suite)', 'HEND (high energy neutron detector)', 'MARIE (radiation environment)'],
    },
    {
        'id': 'tgo',
        'horizonsId': '-143',
        'name': 'ExoMars Trace Gas Orbiter (TGO)',
        'shortName': 'ExoMars TGO',
        'agency': 'ESA / Roscosmos',
        'launched': '2016-03-14',
        'arrival': '2016-10-19',
        'color': '#34d399',
        'commsRelay': 'Electra UHF Transceiver (401.5 MHz)',
        'primaryMission': 'Atmospheric trace gas spectrometry (methane, water vapor, noble gases), high-resolution color stereo surface imaging (CaSSIS), and high-throughput rover data relay.',
        'instruments': ['NOMAD (nadir/solar occultation spectrometer)', 'ACS (atmospheric chemistry suite)', 'CaSSIS (color & stereo imaging system)', 'FREND (fine resolution epithermal neutron detector)'],
    },
    {
        'id': 'maven',
        'horizonsId': '-202',
        'name': 'MAVEN (Mars Atmosphere and Volatile EvolutioN)',
        'shortName': 'MAVEN',
        'agency': 'NASA / GSFC',
        'launched': '2013-11-18',
        'arrival': '2014-09-21',
        'color': '#fbbf24',
        'commsRelay': 'Electra UHF Backup Relay (401.5 MHz)',
        'primaryMission': 'Study Mars upper atmosphere loss, ionosphere dynamics, solar wind interaction, and volatile escape into space over geologic time.',
        'instruments': ['NGIMS (neutral gas & ion mass spectrometer)', 'SWEA (solar wind electron analyzer)', 'STATIC (suprathermal ion composition)', 'IUVS (imaging ultraviolet spectrograph)'],
        'sampleEpoch': '2026-02-01', # latest valid horizons segment
    },
    {
        'id': 'mex',
        'horizonsId': '-41',
        'name': 'Mars Express (MEX)',
        'shortName': 'Mars Express',
        'agency': 'ESA',
        'launched': '2003-06-02',
        'arrival': '2003-12-25',
        'color': '#f87171',
        'commsRelay': 'Melacom UHF Relay System',
        'primaryMission': 'High-resolution global stereo color imaging (HRSC), mineralogical mapping (OMEGA), subsurface ionospheric and radar sounding (MARSIS).',
        'instruments': ['HRSC (high resolution stereo camera)', 'OMEGA (mineralogical mapping spectrometer)', 'MARSIS (subsurface sounding radar/altimeter)', 'SPICAM (UV/IR atmospheric sensor)'],
    },
    {
        'id': 'phobos',
        'horizonsId': '401',
        'name': 'Phobos (Mars I)',
        'shortName': 'Phobos',
        'agency': 'Natural Satellite',
        'color': '#e2e8f0',
        'type': 'moon',
        'primaryMission': 'Innermost Martian moon; orbits closer to Mars than any other moon in the solar system, with rapid 7.65-hour orbital period and regular surface solar transits.',
        'diameterKm': 22.2,
    },
    {
        'id': 'deimos',
        'horizonsId': '402',
        'name': 'Deimos (Mars II)',
        'shortName': 'Deimos',
        'agency': 'Natural Satellite',
        'color': '#67e8f9',
        'type': 'moon',
        'primaryMission': 'Outermost Martian moon; synchronous tidally locked orbit at 23,460 km with 30.3-hour orbital period.',
        'diameterKm': 12.4,
    }
]

def fetch_horizons_elements(horizons_id, epoch='2026-11-12'):
    start_time = epoch
    url = f"https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='{horizons_id}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='ELEMENTS'&CENTER='500@499'&START_TIME='{start_time}'&STOP_TIME='{start_time}%2001:00'&STEP_SIZE='1d'"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            result = data.get('result', '')
            match = re.search(r'\$\$SOE(.*?)\$\$EOE', result, re.DOTALL)
            if not match:
                return None
            block = match.group(1).strip()
            def get_val(pattern):
                m = re.search(pattern, block)
                return float(m.group(1)) if m else None

            epoch_jd_m = re.search(r'(\d+\.\d+)\s*=\s*A\.D\.\s*([\d\w\-:\. ]+)\s*TDB', block)
            epoch_jd = float(epoch_jd_m.group(1)) if epoch_jd_m else 2461356.5
            epoch_str = epoch_jd_m.group(2).strip() if epoch_jd_m else f"{epoch} 00:00:00"

            ec = get_val(r'(?:^|\s)EC\s*=\s*([\d\.E\+\-]+)')
            qr = get_val(r'(?:^|\s)QR\s*=\s*([\d\.E\+\-]+)')
            inc = get_val(r'(?:^|\s)IN\s*=\s*([\d\.E\+\-]+)')
            om = get_val(r'(?:^|\s)OM\s*=\s*([\d\.E\+\-]+)')
            w = get_val(r'(?:^|\s)W\s*=\s*([\d\.E\+\-]+)')
            tp = get_val(r'(?:^|\s)Tp\s*=\s*([\d\.E\+\-]+)')
            n = get_val(r'(?:^|\s)N\s*=\s*([\d\.E\+\-]+)') # deg/s
            ma = get_val(r'(?:^|\s)MA\s*=\s*([\d\.E\+\-]+)') # deg
            ta = get_val(r'(?:^|\s)TA\s*=\s*([\d\.E\+\-]+)') # deg
            a = get_val(r'(?:^|\s)A\s*=\s*([\d\.E\+\-]+)') # km
            ad = get_val(r'(?:^|\s)AD\s*=\s*([\d\.E\+\-]+)') # km
            pr = get_val(r'(?:^|\s)PR\s*=\s*([\d\.E\+\-]+)') # sec

            mars_r = 3389.5
            peri_alt = round(qr - mars_r, 1) if qr else None
            apo_alt = round(ad - mars_r, 1) if ad else None

            return {
                'epochJD': epoch_jd,
                'epochStr': epoch_str,
                'semiMajorAxisKm': round(a, 3) if a else None,
                'eccentricity': ec,
                'inclinationDeg': round(inc, 4) if inc else None,
                'nodeDeg': round(om, 4) if om else None,
                'argPeriapsisDeg': round(w, 4) if w else None,
                'meanAnomalyDeg': round(ma, 4) if ma else None,
                'trueAnomalyDeg': round(ta, 4) if ta else None,
                'periapsisTimeJD': tp,
                'meanMotionDegS': n,
                'periodSec': round(pr, 2) if pr else None,
                'periodMin': round(pr / 60.0, 2) if pr else None,
                'periapsisAltKm': peri_alt,
                'apoapsisAltKm': apo_alt,
            }
    except Exception as e:
        print(f"Error fetching {horizons_id}: {e}")
        return None

def fetch_earth_comms_link():
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='399'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='500@499'&QUANTITIES='20,21'&START_TIME='2026-11-12'&STOP_TIME='2026-11-13'&STEP_SIZE='1d'"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            result = data.get('result', '')
            match = re.search(r'\$\$SOE(.*?)\$\$EOE', result, re.DOTALL)
            if match:
                line = match.group(1).strip().split('\n')[0]
                parts = line.split()
                range_au = float(parts[2])
                range_km = range_au * 149597870.7
                light_min = float(parts[4])
                return {
                    'rangeAU': range_au,
                    'rangeKm': range_km,
                    'rangeMillionKm': round(range_km / 1e6, 2),
                    'oneWayLightTimeMin': light_min,
                    'oneWayLightTimeSec': round(light_min * 60.0, 2),
                    'roundTripLightTimeMin': round(light_min * 2.0, 2),
                    'epoch': f"{parts[0]} {parts[1]} UTC",
                }
    except Exception as e:
        print(f"Error fetching earth comms link: {e}")
    return {
        'rangeAU': 1.3415,
        'rangeKm': 200685000,
        'rangeMillionKm': 200.69,
        'oneWayLightTimeMin': 11.16,
        'oneWayLightTimeSec': 669.4,
        'roundTripLightTimeMin': 22.31,
        'epoch': '2026-Nov-12 00:00 UTC',
    }

print("Fetching all target orbital elements from JPL Horizons API...")
catalog_targets = []
for t in TARGETS:
    epoch = t.get('sampleEpoch', '2026-11-12')
    print(f"  Fetching {t['name']} ({t['horizonsId']}) at epoch {epoch}...")
    el = fetch_horizons_elements(t['horizonsId'], epoch)
    t_copy = dict(t)
    t_copy['orbitalElements'] = el
    catalog_targets.append(t_copy)

earth_link = fetch_earth_comms_link()
print("Earth Comms Link:", earth_link)

catalog = {
    'catalogVersion': '2026.1',
    'source': 'NASA JPL Horizons On-Line Ephemeris System (https://ssd.jpl.nasa.gov/horizons/)',
    'system': 'NASA Jet Propulsion Laboratory Solar System Dynamics Group',
    'spiceFrame': 'IAU_MARS / MARS_FRAME / ICRF Body-Centered',
    'generated': datetime.now(timezone.utc).isoformat(),
    'earthCommsLink': earth_link,
    'orbiters': catalog_targets
}

with open('src/data/horizonsOrbiterCatalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2)

with open('public/data/horizons_orbiter_catalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2)

print("Saved horizonsOrbiterCatalog.json successfully!")
