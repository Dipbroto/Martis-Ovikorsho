import urllib.request
import json
import os
import re

targets = [
    # Perseverance Hero Targets
    ('mars2020', 'perseverance', 1000, 'MCZ_RIGHT', 'Right Mastcam-Z Camera', 'Mastcam-Z (R)', 18.4447, 77.4509),
    ('mars2020', 'perseverance', 1000, 'SUPERCAM_RMI', 'SuperCam Remote Micro-Imager', 'SuperCam RMI', 18.4447, 77.4509),
    ('mars2020', 'perseverance', 1000, 'NAVCAM_LEFT', 'Left Navigation Camera', 'Navcam (L)', 18.4447, 77.4509),
    ('mars2020', 'perseverance', 294, 'SHERLOC_WATSON', 'SHERLOC WATSON', 'WATSON', 18.4355, 77.4518),
    ('mars2020', 'perseverance', 294, 'SUPERCAM_RMI', 'SuperCam Remote Micro-Imager', 'SuperCam RMI', 18.4355, 77.4518),
    ('mars2020', 'perseverance', 294, 'MCZ_RIGHT', 'Right Mastcam-Z Camera', 'Mastcam-Z (R)', 18.4355, 77.4518),
    ('mars2020', 'perseverance', 190, 'MCZ_RIGHT', 'Right Mastcam-Z Camera', 'Mastcam-Z (R)', 18.4448, 77.4514),
    ('mars2020', 'perseverance', 10, 'EDL_RDCAM', 'Rover Down-Look Camera', 'EDL Down-Look', 18.4446, 77.4509),
    # Curiosity Hero Targets
    ('msl', 'curiosity', 4086, 'NAV_LEFT_B', 'Navigation Camera Left', 'Navcam (L)', -4.7300, 137.3800),
    ('msl', 'curiosity', 1000, 'MAST_LEFT', 'Mastcam Left (34mm)', 'Mastcam (L)', -4.5895, 137.4417),
    ('msl', 'curiosity', 1814, 'MAST_LEFT', 'Mastcam Left (34mm)', 'Mastcam (L)', -4.6800, 137.4000),
]

normalized_photos = []

def ensure_https(url):
    if not url:
        return ''
    return re.sub(r'^http://', 'https://', url)

for category, rover, sol, cam, cam_full, cam_short, lat, lon in targets:
    url = f'https://mars.nasa.gov/rss/api/?feed=raw_images&category={category}&feedtype=json&sol={sol}&search={cam}&num=10'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            images = data.get('images', [])[:8]
            for img in images:
                files = img.get('image_files', {})
                small = ensure_https(files.get('small') or files.get('medium') or files.get('full_res'))
                medium = ensure_https(files.get('medium') or files.get('large') or files.get('full_res'))
                large = ensure_https(files.get('large') or files.get('full_res') or files.get('medium'))
                full_res = ensure_https(files.get('full_res') or large)

                if not small and not medium:
                    continue

                cam_obj = img.get('camera', {})
                instrument = cam_obj.get('instrument') or cam
                filter_name = cam_obj.get('filter_name') or 'BROADBAND'
                date_utc = img.get('date_taken_utc') or img.get('date_received') or ''
                earth_date = date_utc.split('T')[0] if 'T' in date_utc else date_utc

                item = {
                    'id': f"{rover}-{sol}-{img.get('imageid', len(normalized_photos))}",
                    'rover': rover,
                    'mission': 'Mars 2020 (Perseverance)' if rover == 'perseverance' else 'Mars Science Laboratory (Curiosity)',
                    'sol': sol,
                    'earthDate': earth_date,
                    'dateKind': 'taken',
                    'camera': instrument,
                    'cameraShort': cam_short,
                    'cameraFullName': cam_full,
                    'filterName': filter_name,
                    'title': img.get('title') or f"{rover.title()} Sol {sol}: {cam_full}",
                    'caption': img.get('caption') or f"Raw in-situ optical frame captured by {rover.title()} {cam_full} on Martian Sol {sol}.",
                    'thumbnailUrl': small or medium,
                    'imageUrl': large or medium or small,
                    'fullResUrl': full_res,
                    'lat': lat,
                    'lon': lon,
                    'coordsNote': 'site',
                    'credit': img.get('credit') or 'NASA/JPL-Caltech',
                    'drive': img.get('drive'),
                    'site': img.get('site'),
                    'attitude': img.get('attitude'),
                    'cameraVector': cam_obj.get('camera_vector'),
                    'tags': [rover.title(), cam_short, f"Sol {sol}", 'Raw Imagery', 'NASA PDS']
                }
                normalized_photos.append(item)
            print(f"[{rover}] Sol {sol} {cam}: added {len(images)} photos")
    except Exception as e:
        print(f"Error fetching {rover} Sol {sol} {cam}: {e}")

out_path = os.path.join('public', 'data', 'hero_rover_photos.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump({
        'generated': '2026-11-12',
        'source': 'NASA Mars Raw Images API (mars.nasa.gov/rss/api/?feed=raw_images)',
        'totalPhotos': len(normalized_photos),
        'photos': normalized_photos
    }, f, indent=2)

print(f"Saved {len(normalized_photos)} hero rover photos to {out_path} ({os.path.getsize(out_path)} bytes)")
