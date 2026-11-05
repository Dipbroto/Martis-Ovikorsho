"""
NASA Mars Data Pipeline & Dataset Extraction
Step 1: Compiles historical daily observations from Curiosity (REMS) into a clean,
quality-controlled time-series tabular dataset (weather_training_data.csv).
Filters hardware sensor dropouts and sentinel values (-100°C, -99°C, -136°C)
and applies smooth time-series interpolation.
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
    dropped_sentinels_count = 0
    
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
            
            # Physical bounds checks: filter out NASA REMS hardware sentinels (-100, -99, -136)
            if t_min is not None and (t_min <= -92.0 or t_min >= -40.0):
                t_min = None
                dropped_sentinels_count += 1
            if t_max is not None and (t_max >= 25.0 or t_max <= -55.0):
                t_max = None
            if pressure is not None and (pressure < 600.0 or pressure > 1050.0):
                pressure = None
            if gts_min is not None and (gts_min <= -106.0 or gts_min >= -40.0):
                gts_min = None
                dropped_sentinels_count += 1
            if gts_max is not None and (gts_max >= 35.0 or gts_max <= -30.0):
                gts_max = None
                
            clean_records.append({
                'sol': sol_num,
                'terrestrial_date': s.get('terrestrial_date', ''),
                'ls': ls,
                'season': s.get('season', ''),
                'min_temp': t_min,
                'max_temp': t_max,
                'surface_pressure': pressure,
                'gts_temp_min': gts_min,
                'gts_temp_max': gts_max,
                'wind_speed': wind_speed if wind_speed is not None else '',
            })
        except (ValueError, TypeError):
            continue
            
    # Sort chronologically
    clean_records.sort(key=lambda r: r['sol'])
    
    # Smooth linear interpolation for isolated missing / sentinel-filtered values
    for key in ['min_temp', 'max_temp', 'surface_pressure', 'gts_temp_min', 'gts_temp_max', 'ls']:
        vals = [r[key] for r in clean_records]
        last_valid = next((v for v in vals if v is not None), -75.0 if 'min' in key else -15.0 if 'max' in key else 750.0)
        for i in range(len(vals)):
            if vals[i] is None:
                next_valid = next((vals[j] for j in range(i + 1, min(i + 12, len(vals))) if vals[j] is not None), last_valid)
                vals[i] = round((last_valid + next_valid) / 2.0, 2)
            else:
                last_valid = vals[i]
            clean_records[i][key] = vals[i]

    # Recompute derived diurnal range and opacity tau on fully interpolated physical values
    for r in clean_records:
        delta_t = round(r['max_temp'] - r['min_temp'], 2)
        r['diurnal_temp_range'] = delta_t
        tau = max(0.2, min(3.5, 0.45 + max(0.0, (65.0 - delta_t) * 0.04)))
        r['opacity_tau'] = round(tau, 3)
    
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
        
    print(f"Successfully compiled {len(clean_records)} quality-controlled sols (cleansed {dropped_sentinels_count} hardware dropouts) to:")
    print(f"  -> {out_csv}")
    return clean_records

if __name__ == '__main__':
    prepare_weather_dataset()
