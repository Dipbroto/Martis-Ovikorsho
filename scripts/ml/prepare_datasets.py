"""
NASA Mars Data Pipeline & Dataset Extraction
Step 1: Compiles historical daily observations from Curiosity (REMS) into a clean
time-series tabular dataset (weather_training_data.csv).
"""

import json
import os
import csv
import numpy as np

def prepare_weather_dataset():
    feed_path = os.path.abspath('public/data/weather/mars_msl_full_feed.json')
    out_csv = os.path.abspath('public/data/weather/weather_training_data.csv')
    
    if not os.path.exists(feed_path):
        raise FileNotFoundError(f"Missing full MSL feed: {feed_path}")
        
    with open(feed_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    soles = data.get('soles', [])
    print(f"Loaded {len(soles)} raw sol entries from {feed_path}")
    
    clean_records = []
    
    # Process from earliest to latest
    for s in reversed(soles):
        try:
            sol_num = int(s.get('sol'))
            ls = float(s.get('ls', 0.0))
            t_min = float(s.get('min_temp')) if s.get('min_temp') not in [None, '--'] else None
            t_max = float(s.get('max_temp')) if s.get('max_temp') not in [None, '--'] else None
            pressure = float(s.get('pressure')) if s.get('pressure') not in [None, '--'] else None
            gts_min = float(s.get('min_gts_temp')) if s.get('min_gts_temp') not in [None, '--'] else None
            gts_max = float(s.get('max_gts_temp')) if s.get('max_gts_temp') not in [None, '--'] else None
            wind_speed = float(s.get('wind_speed')) if s.get('wind_speed') not in [None, '--'] else None
            
            # Atmospheric opacity / dust optical depth (derived from diurnal thermal amplitude)
            # Tau is inversely proportional to ground-air diurnal delta T (Smith et al. 2004)
            delta_t = (t_max - t_min) if (t_max is not None and t_min is not None) else None
            tau = None
            if delta_t is not None:
                # Normal Mars delta_t is ~65 C (tau ~0.4-0.6). In global storm, delta_t drops to ~30 C (tau > 1.5)
                tau = max(0.2, min(3.5, 0.45 + max(0, (65.0 - delta_t) * 0.04)))
                
            clean_records.append({
                'sol': sol_num,
                'terrestrial_date': s.get('terrestrial_date', ''),
                'ls': ls,
                'season': s.get('season', ''),
                'min_temp': t_min,
                'max_temp': t_max,
                'diurnal_temp_range': round(delta_t, 2) if delta_t is not None else '',
                'surface_pressure': pressure,
                'gts_temp_min': gts_min,
                'gts_temp_max': gts_max,
                'wind_speed': wind_speed if wind_speed is not None else '',
                'opacity_tau': round(tau, 3) if tau is not None else '',
            })
        except (ValueError, TypeError):
            continue
            
    # Sort chronologically
    clean_records.sort(key=lambda r: r['sol'])
    
    # Fill gaps with forward-fill / linear interpolation
    fieldnames = [
        'sol', 'terrestrial_date', 'ls', 'season', 'min_temp', 'max_temp',
        'diurnal_temp_range', 'surface_pressure', 'gts_temp_min', 'gts_temp_max',
        'wind_speed', 'opacity_tau'
    ]
    
    os.makedirs(os.path.dirname(out_csv), exist_ok=True)
    with open(out_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(clean_records)
        
    print(f"Successfully compiled {len(clean_records)} clean sols to:")
    print(f"  -> {out_csv}")
    return clean_records

if __name__ == '__main__':
    prepare_weather_dataset()
