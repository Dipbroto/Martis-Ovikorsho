import gzip
import numpy as np
import struct
import json
import re

# Existing hero landmark details to preserve and merge

# Load global MOLA DEM grid (720 rows x 1440 cols, int16 meters)
try:
    with gzip.open('public/data/dem/global.i16z', 'rb') as f_dem:
        GLOBAL_MOLA_DEM = np.frombuffer(f_dem.read(), dtype='<i2').reshape(720, 1440)
except Exception as e:
    print('Warning: could not load global.i16z:', e)
    GLOBAL_MOLA_DEM = None

def get_mola_dem_elevation(lat, lon):
    if GLOBAL_MOLA_DEM is None:
        return 0
    r = int(np.clip((90.0 - lat) * 4.0, 0, 719))
    c = int(np.clip((lon + 180.0) * 4.0, 0, 1439))
    return int(GLOBAL_MOLA_DEM[r, c])

HERO_LANDMARKS = {
    'olympus-mons': {
        'elevation': 21229,
        'description': 'The tallest known volcano and mountain in the solar system. 21.2 km high and 624 km across — nearly the size of France. Its caldera has six nested collapse craters.',
        'science': 'Shield volcano formed by persistent hotspot volcanism. Some lava flows on its flanks are only a few million years old. Lava tubes may provide radiation shelter for future habitats.',
        'image': 'https://images-assets.nasa.gov/image/PIA10020/PIA10020~small.jpg',
        'isHero': True,
    },
    'valles-marineris': {
        'elevation': -5000,
        'description': 'The largest canyon system in the solar system: 4,000 km long, 200 km wide, and up to 7 km deep. It would stretch across the entire United States.',
        'science': 'Formed by tectonic rifting associated with the Tharsis bulge. Contains layered sedimentary deposits suggesting ancient lakes. Water-carved side channels indicate past water flow.',
        'image': 'https://images-assets.nasa.gov/image/PIA14564/PIA14564~medium.jpg',
        'isHero': True,
    },
    'jezero': {
        'elevation': -2600,
        'description': 'A 45 km impact crater that once held a lake fed by river channels. Contains a well-preserved river delta — one of the best places to search for ancient biosignatures.',
        'science': 'Clay minerals (smectite) in the delta indicate prolonged water-rock interaction. Carbonate deposits along the crater rim may preserve microbial fossils. Perseverance is actively exploring here.',
        'image': 'https://images-assets.nasa.gov/image/PIA26252/PIA26252~medium.jpg',
        'isHero': True,
    },
    'gale': {
        'elevation': -4500,
        'description': 'A 154 km crater containing Mount Sharp (Aeolis Mons), a 5.5 km central mound of layered sediments. Curiosity has been climbing it since 2014.',
        'science': 'Layers in Mount Sharp record billions of years of Martian climate history. Curiosity found ancient streambeds, organic molecules, and methane variations suggesting geological or biological processes.',
        'image': 'https://images-assets.nasa.gov/image/PIA15292/PIA15292~medium.jpg',
        'isHero': True,
    },
    'hellas-planitia': {
        'elevation': -7152,
        'description': 'The deepest and one of the largest impact basins in the solar system. 7.2 km below the datum with the highest atmospheric pressure on Mars (over 1,155 Pa).',
        'science': 'High atmospheric pressure means liquid water could potentially be stable on the surface during warm periods. Contains glacial features and possible ancient lake deposits.',
        'image': 'https://images-assets.nasa.gov/image/PIA21570/PIA21570~medium.jpg',
        'isHero': True,
    },
    'elysium-mons': {
        'elevation': 14127,
        'description': 'The principal volcano in Elysium Planitia, rising 12.6 km above the surrounding plains. Has an unusual conical shape compared to the flatter Tharsis shield volcanoes.',
        'science': 'A stratovolcano-like shield with steep slopes. InSight landed about 1,400 km to the south-west.',
        'image': 'https://images-assets.nasa.gov/image/PIA24959/PIA24959~medium.jpg',
        'isHero': True,
    },
    'korolev': {
        'elevation': -3900,
        'description': 'A northern impact crater filled with a permanent, 1.8 km thick dome of pure water ice. A natural cold trap prevents the ice from sublimating.',
        'science': 'Contains ~2,200 km3 of water ice — about as much as Great Bear Lake in Canada. Key resource target for future Martian settlements and ISRU propellant production.',
        'image': 'https://images-assets.nasa.gov/image/PIA05608/PIA05608~orig.jpg',
        'isHero': True,
    },
    'victoria': {
        'elevation': -1400,
        'description': 'An 800-meter impact crater in Meridiani Planum explored by the Opportunity rover for 22 months. Its scalloped rim reveals exposed sulfate bedrock.',
        'science': 'HiRISE imaged Opportunity at the crater rim. Exposed rock layers proved water was present over extensive geological epochs.',
        'image': 'https://images-assets.nasa.gov/image/PIA08812/PIA08812~small.jpg',
        'isHero': True,
    },
    'planum-boreum': {
        'elevation': -2755,
        'description': 'Mars northern polar ice cap, consisting of permanent water ice layered with dust. Surrounded by the vast sand dune sea of Olympia Undae.',
        'science': 'Layered ice deposits preserve a record of Mars climate cycles over millions of years, driven by changes in orbital obliquity (Milankovitch cycles).',
        'image': 'https://images-assets.nasa.gov/image/PIA10651/PIA10651~small.jpg',
        'isHero': True,
    },
    'pavonis-mons': {
        'elevation': 14058,
        'description': 'Central shield volcano of the Tharsis Montes triad, located almost precisely on Mars equator.',
        'science': 'Rises 14 km above the datum. Exhibits low-slope shield morphology with extensive flank lava tubes.',
        'isHero': True,
    },
    'ascraeus-mons': {
        'elevation': 18225,
        'description': 'The northernmost and highest of the three Tharsis Montes shield volcanoes, standing over 18 km high.',
        'science': 'Has the lowest caldera pressure on Mars after Olympus Mons. Contains extensive parasitic cinder cones.',
        'isHero': True,
    },
    'arsia-mons': {
        'elevation': 17761,
        'description': 'The southernmost of the Tharsis Montes volcanoes with an enormous 110-km wide caldera.',
        'science': 'Features candidate cave entrances and lava tubes identified by THEMIS along its eastern flank.',
        'isHero': True,
    },
    'alba-mons': {
        'elevation': 6800,
        'description': 'A low-profile volcanic construct with the largest surface area of any volcano on Mars (over 1,600 km across).',
        'science': 'Formed by extremely low-viscosity basaltic lava flows surrounded by extensive ring grabens (Alba Fossae).',
        'isHero': True,
    },
    'utopia-planitia': {
        'elevation': -4500,
        'description': 'A vast, circular plain in the northern lowlands, site of the Viking 2 and Zhurong landings.',
        'science': 'SHARAD radar discovered a subsurface water-ice reservoir as large as Lake Superior beneath Utopia.',
        'isHero': True,
    },
    'isidis-planitia': {
        'elevation': -3600,
        'description': 'Ancient impact basin on the boundary between the southern highlands and northern lowlands.',
        'science': 'Jezero Crater is situated on its western rim. The basin floor preserves extensive phyllosilicates.',
        'isHero': True,
    },
    'acidalia-planitia': {
        'elevation': -4786,
        'description': 'Vast dark northern lowland plain known for frequent baroclinic dust storm flushing channels.',
        'science': 'Contains extensive mud volcano candidate mounds and periglacial patterned ground.',
        'isHero': True,
    },
    'arabia-terra': {
        'elevation': -1859,
        'description': 'Extensive, densely cratered upland region in northern Mars with unique eroded plateaus.',
        'science': 'Proposed site of supervolcano calderas that blanketed early Mars in thousands of cubic kilometers of ash.',
        'isHero': True,
    },
    'noachis-terra': {
        'elevation': 1637,
        'description': 'One of the oldest surviving geological landmasses on Mars, defining the Noachian geological epoch.',
        'science': 'Heavily bombarded highland terrain dating back 4.1 to 3.7 billion years ago.',
        'isHero': True,
    },
}

TYPE_MAPPING = {
    'AA': {'type': 'crater', 'category': 'Impact Craters', 'icon': '💥', 'color': '#f47050'},
    'MO': {'type': 'volcano', 'category': 'Volcanoes & Mountains', 'icon': '🌋', 'color': '#ef4444'},
    'PE': {'type': 'volcano', 'category': 'Volcanoes & Mountains', 'icon': '🌋', 'color': '#ef4444'},
    'TH': {'type': 'volcano', 'category': 'Volcanoes & Mountains', 'icon': '🌋', 'color': '#ef4444'},
    'VA': {'type': 'canyon', 'category': 'Canyons & Valleys', 'icon': '🏜️', 'color': '#f97316'},
    'CM': {'type': 'canyon', 'category': 'Canyons & Valleys', 'icon': '🏜️', 'color': '#f97316'},
    'CA': {'type': 'canyon', 'category': 'Canyons & Valleys', 'icon': '🏜️', 'color': '#f97316'},
    'FL': {'type': 'canyon', 'category': 'Canyons & Valleys', 'icon': '🏜️', 'color': '#f97316'},
    'FO': {'type': 'fossa', 'category': 'Tectonic Scarps & Grabens', 'icon': '⚡', 'color': '#eab308'},
    'RU': {'type': 'fossa', 'category': 'Tectonic Scarps & Grabens', 'icon': '⚡', 'color': '#eab308'},
    'LB': {'type': 'fossa', 'category': 'Tectonic Scarps & Grabens', 'icon': '⚡', 'color': '#eab308'},
    'SU': {'type': 'fossa', 'category': 'Tectonic Scarps & Grabens', 'icon': '⚡', 'color': '#eab308'},
    'PL': {'type': 'plain', 'category': 'Plains, Basins & Plateaus', 'icon': '🪐', 'color': '#3b82f6'},
    'PM': {'type': 'plain', 'category': 'Plains, Basins & Plateaus', 'icon': '🪐', 'color': '#3b82f6'},
    'TA': {'type': 'plain', 'category': 'Plains, Basins & Plateaus', 'icon': '🪐', 'color': '#3b82f6'},
    'VS': {'type': 'plain', 'category': 'Plains, Basins & Plateaus', 'icon': '🪐', 'color': '#3b82f6'},
    'MN': {'type': 'plain', 'category': 'Plains, Basins & Plateaus', 'icon': '🪐', 'color': '#3b82f6'},
    'DO': {'type': 'plain', 'category': 'Plains, Basins & Plateaus', 'icon': '🪐', 'color': '#3b82f6'},
    'CO': {'type': 'plain', 'category': 'Plains, Basins & Plateaus', 'icon': '🪐', 'color': '#3b82f6'},
    'CH': {'type': 'chaos', 'category': 'Chaos Terrains', 'icon': '🌀', 'color': '#a855f7'},
    'LA': {'type': 'chaos', 'category': 'Chaos Terrains', 'icon': '🌀', 'color': '#a855f7'},
    'CB': {'type': 'polar', 'category': 'Polar Pits & Dune Fields', 'icon': '❄️', 'color': '#06b6d4'},
    'UN': {'type': 'polar', 'category': 'Polar Pits & Dune Fields', 'icon': '❄️', 'color': '#06b6d4'},
    'LN': {'type': 'polar', 'category': 'Polar Pits & Dune Fields', 'icon': '❄️', 'color': '#06b6d4'},
    'PA': {'type': 'polar', 'category': 'Polar Pits & Dune Fields', 'icon': '❄️', 'color': '#06b6d4'},
    'SE': {'type': 'polar', 'category': 'Polar Pits & Dune Fields', 'icon': '❄️', 'color': '#06b6d4'},
    'MA': {'type': 'polar', 'category': 'Polar Pits & Dune Fields', 'icon': '❄️', 'color': '#06b6d4'},
    'SC': {'type': 'fossa', 'category': 'Tectonic Scarps & Grabens', 'icon': '⚡', 'color': '#eab308'},
    'AL': {'type': 'albedo', 'category': 'Classical Albedo Features', 'icon': '🔭', 'color': '#64748b'},
}

def slugify(text):
    s = text.lower().strip()
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'[^a-z0-9\-]', '', s)
    return s.strip('-')

dbf_path = 'public/data/usgs_temp/MARS_nomenclature_center_pts.dbf'

with open(dbf_path, 'rb') as f:
    version, year, month, day, num_records, header_len, record_len = struct.unpack('<BBBBLHH', f.read(12))
    f.seek(32)
    fields = []
    while True:
        b = f.read(1)
        if b == b'\r':
            break
        desc = b + f.read(31)
        name = desc[:11].replace(b'\x00', b'').decode('ascii').strip()
        length = desc[16]
        fields.append((name, length))
    
    f.seek(header_len)
    all_features = []
    slug_counts = {}
    
    for i in range(num_records):
        rec_data = f.read(record_len)
        if not rec_data or len(rec_data) < record_len:
            break
        offset = 1
        rec = {}
        for name, length in fields:
            rec[name] = rec_data[offset:offset+length].decode('utf-8', errors='replace').strip()
            offset += length
            
        clean_name = rec.get('clean_name') or rec.get('name') or f"feature-{i}"
        formal_name = rec.get('name') or clean_name
        
        try:
            lat = round(float(rec.get('center_lat', 0)), 4)
            raw_lon = float(rec.get('center_lon', 0))
            lon = round(raw_lon - 360.0 if raw_lon > 180.0 else raw_lon, 4)
            lon360 = round(raw_lon, 4)
            diameter = round(float(rec.get('diameter', 0)), 1)
        except Exception:
            continue
            
        code = rec.get('code', 'AA')
        type_info = TYPE_MAPPING.get(code, {'type': 'crater', 'category': 'Impact Craters', 'icon': '💥', 'color': '#f47050'})
        
        base_slug = slugify(clean_name)
        if base_slug in slug_counts:
            slug_counts[base_slug] += 1
            feat_id = f"{base_slug}-{code.lower()}"
        else:
            slug_counts[base_slug] = 1
            feat_id = base_slug
            
        # Check hero details
        hero = HERO_LANDMARKS.get(base_slug) or HERO_LANDMARKS.get(feat_id) or {}
        
        origin_text = rec.get('origin', '')
        if origin_text:
            origin_text = origin_text.rstrip('. ') + '.'
            
        approval_dt = rec.get('approvaldt', '').split(' ')[0]
        
        feature_obj = {
            'id': feat_id,
            'name': clean_name,
            'formalName': formal_name,
            'type': type_info['type'],
            'typeRaw': rec.get('type', ''),
            'code': code,
            'category': hero.get('category') or type_info['category'],
            'lat': lat,
            'lon': lon,
            'lon360': lon360,
            'diameter': diameter,
            'elevation': hero.get('elevation') if hero.get('elevation') is not None else get_mola_dem_elevation(lat, lon),
            'origin': origin_text,
            'approvalDate': approval_dt,
            'approval': rec.get('approval', 'Adopted by IAU'),
            'quadName': rec.get('quad_name', ''),
            'quadCode': rec.get('quad_code', ''),
            'ethnicity': rec.get('ethnicity', ''),
            'continent': rec.get('continent', ''),
            'link': rec.get('link', '').replace('http://', 'https://'),
            'icon': hero.get('icon') or type_info['icon'],
            'color': hero.get('color') or type_info['color'],
            'isHero': hero.get('isHero', False),
            'description': hero.get('description') or (f"{clean_name} is an officially approved {rec.get('type', 'feature').lower()} spanning {diameter} km across." if diameter > 0 else f"{clean_name} is an officially approved Martian {rec.get('type', 'feature').lower()}."),
            'science': hero.get('science') or (f"IAU designated in {approval_dt[:4] if approval_dt else 'archive'}. Etymological origin: {origin_text}" if origin_text else None),
        }
        
        if hero.get('image'):
            feature_obj['image'] = hero['image']
            
        all_features.append(feature_obj)

# Sort features: hero features first, then largest diameter first
all_features.sort(key=lambda x: (not x.get('isHero', False), -x.get('diameter', 0)))

catalog = {
    'catalogVersion': '2026.1',
    'source': 'USGS Astrogeology / IAU Gazetteer of Planetary Nomenclature',
    'attribution': 'USGS Planetary Names / IAU Working Group for Planetary System Nomenclature (WGPSN)',
    'totalFeatures': len(all_features),
    'generated': '2026-11-12T02:00:00Z',
    'features': all_features
}

output_path = 'public/data/mars_nomenclature_catalog.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(catalog, f, separators=(',', ':'), ensure_ascii=False)

src_path = 'src/data/marsNomenclatureCatalog.json'
with open(src_path, 'w', encoding='utf-8') as f:
    json.dump(catalog, f, separators=(',', ':'), ensure_ascii=False)

print(f"Generated {output_path} with {len(all_features)} features.")
import os
print(f"File size: {os.path.getsize(output_path) / 1024:.1f} KB")
