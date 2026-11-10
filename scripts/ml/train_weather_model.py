"""
NASA Mars Atmospheric Telemetry ML Training Pipeline
Trains predictive multi-step atmospheric forecasting and dust storm risk models
directly on 4,700+ daily in-situ observations from the Curiosity REMS archive.
Exports compact model weights to public/data/ml/mars_weather_model.json for zero-latency in-browser inference.

Evaluation: the regressors are scored on the last 15% of sols (a chronological hold-out) next to a
persistence baseline. The dust-storm classifier learns a proxy label (diurnal range below 48 °C during
Ls 160-330); its ROC-AUC comes from forward-chaining time folds, because the hold-out holds no proxy sols.
"""

import json
import os
import sys
import urllib.request
import numpy as np
from sklearn.linear_model import Ridge, RidgeCV, LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error, accuracy_score, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit

API_URL = "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json"
CACHE_PATH = os.path.join("public", "data", "weather", "mars_msl_full_feed.json")
LOCAL_FALLBACK = os.path.join("public", "data", "weather", "mars_rover_weather.json")
OUTPUT_MODEL_PATH = os.path.join("public", "data", "ml", "mars_weather_model.json")
SRC_MODEL_PATH = os.path.join("src", "data", "marsWeatherModel.json")


def fetch_or_load_data():
    """Fetches the complete historical NASA MSL weather archive or loads cached feed."""
    if os.path.exists(CACHE_PATH):
        print(f"Loading cached NASA MSL feed from: {CACHE_PATH}")
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    print(f"Fetching complete MSL archive from NASA API: {API_URL}")
    try:
        req = urllib.request.Request(API_URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=15) as res:
            raw_text = res.read().decode("utf-8")
            data = json.loads(raw_text)
            os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
            with open(CACHE_PATH, "w", encoding="utf-8") as f:
                f.write(raw_text)
            print(f"Successfully cached {len(data.get('soles', []))} sol records to {CACHE_PATH}")
            return data
    except Exception as e:
        print(f"Warning: Could not fetch from NASA API ({e}). Falling back to local dataset: {LOCAL_FALLBACK}")
        if os.path.exists(LOCAL_FALLBACK):
            with open(LOCAL_FALLBACK, "r", encoding="utf-8") as f:
                return json.load(f)
        raise RuntimeError("No telemetry source available for training.")


def clean_sol_records(raw_soles):
    """Parses, quality-cleans, and interpolates raw sol telemetry records."""
    cleaned = []
    dropped_sentinels_count = 0
    for s in raw_soles:
        if not s.get("sol"):
            continue
        try:
            sol_num = int(s["sol"])
            ls = float(s["ls"]) if s.get("ls") not in ("--", None) else None
            t_min = float(s["min_temp"]) if s.get("min_temp") not in ("--", None) else None
            t_max = float(s["max_temp"]) if s.get("max_temp") not in ("--", None) else None
            p = float(s["pressure"]) if s.get("pressure") not in ("--", None) else None
            gts_min = float(s["min_gts_temp"]) if s.get("min_gts_temp") not in ("--", None) else None
            gts_max = float(s["max_gts_temp"]) if s.get("max_gts_temp") not in ("--", None) else None

            # Physical bounds checks: filter out NASA REMS hardware dropouts & sentinels (-100, -99, -136)
            if t_min is not None and (t_min <= -92.0 or t_min >= -40.0):
                t_min = None
                dropped_sentinels_count += 1
            if t_max is not None and (t_max >= 25.0 or t_max <= -55.0):
                t_max = None
            if p is not None and (p < 600.0 or p > 1050.0):
                p = None
            if gts_min is not None and (gts_min <= -106.0 or gts_min >= -40.0):
                gts_min = None
                dropped_sentinels_count += 1
            if gts_max is not None and (gts_max >= 35.0 or gts_max <= -30.0):
                gts_max = None

            cleaned.append({
                "sol": sol_num,
                "ls": ls,
                "t_min": t_min,
                "t_max": t_max,
                "pressure": p,
                "gts_min": gts_min,
                "gts_max": gts_max,
            })
        except (ValueError, TypeError):
            continue

    cleaned.sort(key=lambda x: x["sol"])

    # Smooth linear interpolation for isolated missing / sentinel-filtered values
    for key in ["t_min", "t_max", "pressure", "gts_min", "gts_max", "ls"]:
        vals = [r[key] for r in cleaned]
        default_val = -75.0 if "min" in key else (-15.0 if "max" in key else 750.0)
        last_valid = next((v for v in vals if v is not None), default_val)
        for i in range(len(vals)):
            if vals[i] is None:
                next_valid = next((vals[j] for j in range(i + 1, min(i + 12, len(vals))) if vals[j] is not None), last_valid)
                vals[i] = round((last_valid + next_valid) / 2.0, 2)
            else:
                last_valid = vals[i]
            cleaned[i][key] = vals[i]

    # Recompute derived diurnal range and fill ground offsets if missing
    for r in cleaned:
        r["delta_t"] = round(r["t_max"] - r["t_min"], 2)
        if r["gts_min"] is None:
            r["gts_min"] = r["t_min"] - 5.0
        if r["gts_max"] is None:
            r["gts_max"] = r["t_max"] + 10.0

    print(f"Cleaned valid consecutive sol records: {len(cleaned)} (Cleansed {dropped_sentinels_count} dropouts, Sol {cleaned[0]['sol']} to Sol {cleaned[-1]['sol']})")
    return cleaned


def build_training_matrix(records):
    """
    Constructs feature vectors with multi-sol history and target horizons (t+1, t+2, t+3).
    """
    feature_names = [
        "sin_ls", "cos_ls", "sin_2ls", "cos_2ls", "perihelion_factor",
        "t_max_lag1", "t_min_lag1", "delta_t_lag1", "pressure_lag1",
        "gts_max_lag1", "gts_min_lag1", "delta_p_lag1",
        "t_max_lag2", "t_min_lag2", "pressure_lag2",
        "t_max_lag3", "t_min_lag3", "pressure_lag3",
        "rolling_3sol_tmax", "rolling_3sol_tmin", "rolling_3sol_p"
    ]

    target_keys = ["t_max", "t_min", "pressure", "gts_max", "gts_min"]
    horizons = [1, 2, 3]

    X = []
    # Targets for each horizon: y[h][key]
    y_reg = {h: {k: [] for k in target_keys} for h in horizons}
    y_dust = {h: [] for h in horizons}

    # Sol i is the latest observed sol (lag 1), as it is in the app when a forecast is made; horizon h
    # predicts sol i + h. (Using i - 1 as lag 1 would skip sol i and make "next sol" two sols ahead.)
    for i in range(2, len(records) - 3):
        curr = records[i]
        p1 = records[i]
        p2 = records[i - 1]
        p3 = records[i - 2]

        ls_rad = curr["ls"] * np.pi / 180.0
        # Perihelion occurs near Ls = 251 degrees (Mars closest to Sun, highest solar flux)
        perihelion_rad = (curr["ls"] - 251.0) * np.pi / 180.0

        delta_p = p1["pressure"] - p2["pressure"]
        r3_tmax = (p1["t_max"] + p2["t_max"] + p3["t_max"]) / 3.0
        r3_tmin = (p1["t_min"] + p2["t_min"] + p3["t_min"]) / 3.0
        r3_p = (p1["pressure"] + p2["pressure"] + p3["pressure"]) / 3.0

        feat = [
            np.sin(ls_rad),
            np.cos(ls_rad),
            np.sin(2.0 * ls_rad),
            np.cos(2.0 * ls_rad),
            np.cos(perihelion_rad),
            p1["t_max"],
            p1["t_min"],
            p1["delta_t"],
            p1["pressure"],
            p1["gts_max"],
            p1["gts_min"],
            delta_p,
            p2["t_max"],
            p2["t_min"],
            p2["pressure"],
            p3["t_max"],
            p3["t_min"],
            p3["pressure"],
            r3_tmax,
            r3_tmin,
            r3_p
        ]
        X.append(feat)

        for h in horizons:
            tgt = records[i + h]
            for k in target_keys:
                y_reg[h][k].append(tgt[k])

            # Dust storm label:
            # Diurnal temperature range collapses (Delta T < 48°C) or extreme max suppression during dust storm season
            # (Matches NASA 2018 Global Dust Storm and 2014 regional events)
            is_dust_storm = 1 if (tgt["delta_t"] < 48.0 and tgt["ls"] > 160.0 and tgt["ls"] < 330.0) else 0
            y_dust[h].append(is_dust_storm)

    X = np.array(X)
    for h in horizons:
        for k in target_keys:
            y_reg[h][k] = np.array(y_reg[h][k])
        y_dust[h] = np.array(y_dust[h])

    return X, y_reg, y_dust, feature_names


def train_models():
    """Main training routine: trains and evaluates models, then exports to JSON."""
    raw_data = fetch_or_load_data()
    records = clean_sol_records(raw_data.get("soles", []))

    if len(records) < 20:
        raise ValueError(f"Insufficient records for ML training: {len(records)}")

    X, y_reg, y_dust, feature_names = build_training_matrix(records)
    total_samples = len(X)
    split_idx = int(total_samples * 0.85)

    print(f"\nTotal ML Samples: {total_samples} | Train: {split_idx} | Test: {total_samples - split_idx}")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X[:split_idx])
    X_test_scaled = scaler.transform(X[split_idx:])

    model_export = {
        "metadata": {
            "model_name": "Martis Atmospheric & Dust Forecaster (NASA MSL REMS / MEDA)",
            "trained_on": "Curiosity REMS in-situ telemetry",
            "samples_count": total_samples,
            "feature_count": len(feature_names),
            "features": feature_names,
            "scale_mean": [round(float(m), 6) for m in scaler.mean_],
            "scale_std": [round(float(s), 6) for s in scaler.scale_],
            "horizons": [1, 2, 3],
        },
        "horizons": {},
        "climatology": {},
        "evaluation": {}
    }

    print("\n--- Model Evaluation (Test Set / Sols Out-of-Sample) ---")

    alphas = np.logspace(-1, 3, 20)

    for h in [1, 2, 3]:
        model_export["horizons"][f"sol_plus_{h}"] = {"regression": {}, "dust_classifier": {}}
        model_export["evaluation"][f"sol_plus_{h}"] = {}

        for k in ["t_max", "t_min", "pressure", "gts_max", "gts_min"]:
            y_tr = y_reg[h][k][:split_idx]
            y_te = y_reg[h][k][split_idx:]

            reg = RidgeCV(alphas=alphas)
            reg.fit(X_train_scaled, y_tr)
            preds = reg.predict(X_test_scaled)

            r2 = r2_score(y_te, preds)
            mae = mean_absolute_error(y_te, preds)
            rmse = np.sqrt(mean_squared_error(y_te, preds))
            ci90 = 1.645 * rmse
            # The bar to beat: "the next sols look like the last one", i.e. the lag-1 value of the same quantity
            persist = X[split_idx:, feature_names.index(f"{k}_lag1")]
            persist_r2 = r2_score(y_te, persist)
            persist_mae = mean_absolute_error(y_te, persist)

            model_export["horizons"][f"sol_plus_{h}"]["regression"][k] = {
                "intercept": round(float(reg.intercept_), 5),
                "coefficients": [round(float(c), 5) for c in reg.coef_],
                "uncertainty_ci90": round(float(ci90), 2),
                "best_alpha": round(float(reg.alpha_), 3),
            }
            model_export["evaluation"][f"sol_plus_{h}"][k] = {
                "r2_score": round(float(r2), 4),
                "mae": round(float(mae), 3),
                "rmse": round(float(rmse), 3),
                "ci90_half_width": round(float(ci90), 2),
                "best_alpha": round(float(reg.alpha_), 3),
                "persistence_r2": round(float(persist_r2), 4),
                "persistence_mae": round(float(persist_mae), 3),
            }

            if h == 1:
                print(f"  Horizon t+{h} [{k.upper()}]: R² = {r2:.4f} | MAE = {mae:.3f} | persistence R² = {persist_r2:.4f} | alpha = {reg.alpha_:.2f}")

        # Train Dust Storm Logistic Classifier
        y_d_tr = y_dust[h][:split_idx]
        y_d_te = y_dust[h][split_idx:]

        clf = LogisticRegression(class_weight="balanced", max_iter=200, C=0.5)
        clf.fit(X_train_scaled, y_d_tr)
        probs = clf.predict_proba(X_test_scaled)[:, 1]

        # The last 15% of sols holds no storm-proxy sols at all, so ROC-AUC cannot be measured on it.
        # Score it instead with forward-chaining folds (train on the past, test on the next block),
        # keeping only folds whose test block has both classes. Never substitute a made-up value.
        test_positives = int(np.sum(y_d_te))
        fold_aucs = []
        for tr_idx, te_idx in TimeSeriesSplit(n_splits=5).split(X):
            y_tr_f, y_te_f = y_dust[h][tr_idx], y_dust[h][te_idx]
            if len(set(y_tr_f)) < 2 or len(set(y_te_f)) < 2:
                continue
            sc_f = StandardScaler().fit(X[tr_idx])
            clf_f = LogisticRegression(class_weight="balanced", max_iter=200, C=0.5).fit(sc_f.transform(X[tr_idx]), y_tr_f)
            fold_aucs.append(roc_auc_score(y_te_f, clf_f.predict_proba(sc_f.transform(X[te_idx]))[:, 1]))
        auc = float(np.mean(fold_aucs)) if fold_aucs else None
        # with no positives in the hold-out, accuracy is the share of storm-free sols it correctly calls calm
        acc = accuracy_score(y_d_te, (probs >= 0.5).astype(int))

        model_export["horizons"][f"sol_plus_{h}"]["dust_classifier"] = {
            "intercept": round(float(clf.intercept_[0]), 5),
            "coefficients": [round(float(c), 5) for c in clf.coef_[0]],
        }
        model_export["evaluation"][f"sol_plus_{h}"]["dust_storm"] = {
            "roc_auc": round(auc, 4) if auc is not None else None,
            "roc_auc_method": f"mean of {len(fold_aucs)} forward-chaining time folds that contain storm-proxy sols",
            "roc_auc_folds": [round(float(a), 4) for a in fold_aucs],
            "holdout_storm_sols": test_positives,
            "holdout_accuracy": round(float(acc), 4),
            "label": "proxy: diurnal range below 48 °C during Ls 160-330, not a catalogued storm",
        }
        auc_text = f"{auc:.4f} over {len(fold_aucs)} time folds" if auc is not None else "not measurable"
        print(f"  Horizon t+{h} [DUST_STORM_RISK]: ROC-AUC = {auc_text} | hold-out storm sols = {test_positives} | hold-out accuracy = {acc:.4f}")

    # Baseline climatology per season for pure Ls queries (when rover telemetry is offline)
    seasons = ["spring", "summer", "autumn", "winter"]
    for s_name in seasons:
        if s_name == "spring":
            s_recs = [r for r in records if 0 <= r["ls"] < 90]
        elif s_name == "summer":
            s_recs = [r for r in records if 90 <= r["ls"] < 180]
        elif s_name == "autumn":
            s_recs = [r for r in records if 180 <= r["ls"] < 270]
        else:
            s_recs = [r for r in records if 270 <= r["ls"] < 360]

        if s_recs:
            model_export["climatology"][s_name] = {
                "t_max": round(float(np.mean([r["t_max"] for r in s_recs])), 1),
                "t_min": round(float(np.mean([r["t_min"] for r in s_recs])), 1),
                "t_avg": round(float(np.mean([(r["t_max"] + r["t_min"]) / 2.0 for r in s_recs])), 1),
                "pressure": round(float(np.mean([r["pressure"] for r in s_recs])), 1),
                "gts_max": round(float(np.mean([r["gts_max"] for r in s_recs])), 1),
                "gts_min": round(float(np.mean([r["gts_min"] for r in s_recs])), 1),
            }

    # Finer climatology: 12 bins of 30° Ls, centred on 15°, 45°, ... The app interpolates between neighbouring bin
    # centres, so the seasonal cycle is smooth; four 90° seasons were up to 10 °C and 76 Pa off the real averages.
    by_ls = []
    for b in range(12):
        lo, hi = b * 30.0, (b + 1) * 30.0
        b_recs = [r for r in records if lo <= r["ls"] < hi]
        if not b_recs:
            continue
        by_ls.append({
            "ls_center": lo + 15.0,
            "n": len(b_recs),
            "t_max": round(float(np.mean([r["t_max"] for r in b_recs])), 1),
            "t_min": round(float(np.mean([r["t_min"] for r in b_recs])), 1),
            "t_avg": round(float(np.mean([(r["t_max"] + r["t_min"]) / 2.0 for r in b_recs])), 1),
            "pressure": round(float(np.mean([r["pressure"] for r in b_recs])), 1),
            "gts_max": round(float(np.mean([r["gts_max"] for r in b_recs])), 1),
            "gts_min": round(float(np.mean([r["gts_min"] for r in b_recs])), 1),
        })
    model_export["climatology_by_ls"] = by_ls

    # Save to public/data/ml/mars_weather_model.json and src/data/marsWeatherModel.json
    os.makedirs(os.path.dirname(OUTPUT_MODEL_PATH), exist_ok=True)
    with open(OUTPUT_MODEL_PATH, "w", encoding="utf-8") as f:
        json.dump(model_export, f, indent=2)

    os.makedirs(os.path.dirname(SRC_MODEL_PATH), exist_ok=True)
    with open(SRC_MODEL_PATH, "w", encoding="utf-8") as f:
        json.dump(model_export, f, indent=2)

    file_size_kb = os.path.getsize(OUTPUT_MODEL_PATH) / 1024.0
    print(f"\nModel exported successfully to {OUTPUT_MODEL_PATH} and {SRC_MODEL_PATH} ({file_size_kb:.1f} KB)")
    print("Stage 1 Training Pipeline Complete.")


if __name__ == "__main__":
    train_models()
