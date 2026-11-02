"""
NASA Mars Feature Engineering Pipeline
Step 2: Time-Series Lags & Seasonal Sinusoids for Martian Weather Forecasting.
"""

import numpy as np

def compute_seasonal_sinusoids(ls_deg):
    """
    Computes orbital sinusoids from areocentric solar longitude (Ls) to capture
    Mars's orbital eccentricity and the global CO2 polar cap sublimation cycle.
    """
    rad = np.radians(np.asarray(ls_deg, dtype=np.float64))
    return np.sin(rad), np.cos(rad)

def compute_rolling_lags(values, window=3):
    """
    Computes rolling moving average over previous sols.
    """
    arr = np.asarray(values, dtype=np.float64)
    result = np.zeros_like(arr)
    for i in range(len(arr)):
        start = max(0, i - window + 1)
        result[i] = np.mean(arr[start:i+1])
    return result

def compute_rate_of_change(values):
    """
    Computes dP/dt (daily rate of change).
    """
    arr = np.asarray(values, dtype=np.float64)
    dp = np.zeros_like(arr)
    dp[1:] = arr[1:] - arr[:-1]
    dp[0] = 0.0
    return dp

def build_weather_feature_vector_row(recent_3_sols, ls_deg):
    """
    Builds the 21-element feature vector matching JavaScript marsMlService.js.
    """
    sin_ls, cos_ls = compute_seasonal_sinusoids(ls_deg)
    
    # recent_3_sols: [t_0 (most recent), t_-1, t_-2]
    # Each sol object has: { t_max, t_min, pressure, gts_max, gts_min }
    features = [float(sin_ls), float(cos_ls)]
    
    for sol in recent_3_sols:
        t_max = float(sol.get('t_max', -15.0))
        t_min = float(sol.get('t_min', -75.0))
        p = float(sol.get('pressure', 750.0))
        gts_max = float(sol.get('gts_max', 0.0))
        gts_min = float(sol.get('gts_min', -85.0))
        delta_t = t_max - t_min
        
        features.extend([t_max, t_min, p, gts_max, gts_min, delta_t])
        
    p_now = float(recent_3_sols[0].get('pressure', 750.0))
    p_prev = float(recent_3_sols[1].get('pressure', p_now)) if len(recent_3_sols) > 1 else p_now
    dp_dt = p_now - p_prev
    features.append(dp_dt)
    
    return features
