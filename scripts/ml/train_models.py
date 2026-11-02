"""
NASA Mars Master Machine Learning Training Pipeline
Step 3 & Step 4: Trains all models and exports them into lightweight, browser-friendly JSON
structures (public/data/ml/mars_models.json, under 150 KB).
"""

import json
import os
import subprocess
import sys

def train_all_models():
    print("=" * 60)
    print("NASA Mars Explorer - Master ML Model Training Pipeline")
    print("=" * 60)
    
    # Step 1: Prepare CSV dataset
    print("\n[Step 1] Preparing weather training dataset...")
    from prepare_datasets import prepare_weather_dataset
    prepare_weather_dataset()
    
    # Step 2 & 3: Run Model 1 & 2 (Weather & Dust Storm)
    print("\n[Step 2 & 3: Model 1 & 2] Training Weather Forecaster & Dust Storm Classifier...")
    subprocess.run([sys.executable, 'scripts/ml/train_weather_model.py'], check=True)
    
    # Model 3: Mineralogy & Biosignature
    print("\n[Step 3: Model 3] Training SuperCam / PIXL Geochemical Classifier...")
    subprocess.run([sys.executable, 'scripts/ml/train_mineral_classifier.py'], check=True)
    
    # Model 4: Space Radiation & SPE Forecaster
    print("\n[Step 3: Model 4] Training MSL RAD Radiation & SPE Hazard Model...")
    subprocess.run([sys.executable, 'scripts/ml/train_radiation_model.py'], check=True)
    
    # Step 4: Export to unified lightweight bundle (mars_models.json) under 150 KB
    print("\n[Step 4] Assembling unified browser bundle: public/data/ml/mars_models.json...")
    
    with open('public/data/ml/mars_weather_model.json', 'r') as f:
        weather_model = json.load(f)
    with open('public/data/ml/mars_mineral_model.json', 'r') as f:
        mineral_model = json.load(f)
    with open('public/data/ml/mars_radiation_model.json', 'r') as f:
        radiation_model = json.load(f)
        
    unified_bundle = {
        'version': '2.0.0',
        'generated_at': '2026-11-03',
        'weather': weather_model,
        'mineralogy': mineral_model,
        'radiation': radiation_model,
    }
    
    out_unified = os.path.abspath('public/data/ml/mars_models.json')
    out_src_unified = os.path.abspath('src/data/marsModels.json')
    
    with open(out_unified, 'w') as f:
        json.dump(unified_bundle, f, indent=2)
    with open(out_src_unified, 'w') as f:
        json.dump(unified_bundle, f, indent=2)
        
    size_kb = os.path.getsize(out_unified) / 1024.0
    print(f"Unified model bundle generated successfully: {size_kb:.1f} KB (budget: < 150 KB)")
    print(f"  -> {out_unified}")
    print(f"  -> {out_src_unified}")
    print("=" * 60)
    print("Master ML Pipeline Completed Successfully!")
    print("=" * 60)

if __name__ == '__main__':
    train_all_models()
