# MarsWalk Explorer

NASA Space Apps Challenge 2026 — a layered, integrated Martian surface map for planning human Marswalks:
2D/3D cartography, route planning with walkback limits, EVA HUD, science lab, contingency simulator and the
EVA AI copilot.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint (including React hooks rules) |
| `npm test` | Unit tests (Vitest) |

## Backend setup (Supabase)

1. Create a Supabase project and put its URL and anon key in `.env.local`.
2. Run [`supabase_schema.sql`](supabase_schema.sql) in the SQL editor. It creates the tables, row level
   security policies and the triggers that create profiles and maintain profile stats.
   It is safe to re-run.
3. Deploy the Gemini proxy so the AI features work without exposing the API key in the browser:

   ```bash
   supabase secrets set GEMINI_API_KEY=<your Gemini key>
   supabase functions deploy gemini-proxy
   ```

   In `vite dev` the app can call Gemini directly with `VITE_GEMINI_API_KEY` for convenience. Production
   builds never contain that key; they always go through `gemini-proxy`.

## Project layout

- `src/components` — UI (map, 3D globe, modals, full-page tabs)
- `src/hooks` — shared logic hooks (e.g. the Science Lab)
- `src/store/useMapStore.js` — global Zustand store (use selectors / `useShallow`, never `useMapStore()`)
- `src/services` — Gemini, NASA imagery/JPL, chat history and profile access
- `src/data` — landing sites, geological features and the shared landmark table (`marsLandmarks.js`)
- `src/terrain` — elevation grids, A* route planner, return / slope / radio analysis (runs in a web worker)
- `src/utils` — Mars math, solar geometry, elevation lookup, router wrapper, audio synthesiser
- `scripts/data` — scripts that download and build the NASA / USGS data files in `public/data`
- `supabase/functions/gemini-proxy` — Edge Function that holds the Gemini key

## Data provenance

Elevation comes from the HRSC-MOLA blended DEM (200 m/px) at seven hero sites and the MGS MOLA 4 px/deg grid
elsewhere; routes, slopes, the point-of-no-return range and radio coverage are computed from it. Water (Mars
Odyssey GRS), cave candidates (USGS) and rover tracks (NASA/JPL) are real datasets. Weather, radiation, HUD
telemetry and science-lab spectra are simulations and are labelled as such. Images from the NASA Image Library
are not georeferenced, so they carry no map coordinates. See the in-app **Data & Methods** panel for sources,
assumptions and the validation against real rover drives.

To rebuild the data files: `python scripts/data/build_dem.py`, `build_traverses.py` and `build_resources.py`
(Python 3 with numpy for the DEM script).

## Machine Learning & Science Subsystems

The platform features **8 machine learning model families** running zero-latency client-side inference (<44 KB bundle size). Four learn from real mission data; four are **surrogates**: fast fits to simulated data from published physics formulas, whose scores say how well they reproduce those formulas, not how well they predict Mars.

Every score below is measured on data the model did not see: later sols for weather, and **rocks left out of training** for the PIXL and SuperCam models (a random split would put points of the same rock on both sides). Retrain with `scripts/ml/train_models.py` (packages in `scripts/ml/requirements.txt`).

| Family | Model Pipeline | Target / Capability | Training Data | Held-out Score |
| --- | --- | --- | --- | --- |
| **MF-01** | **Atmospheric Forecaster** | Multi-step forecasts ($T_{\max}, T_{\min}, P, \text{GTS}_{\max}, \text{GTS}_{\min}$) for horizons $t+1, t+2, t+3$ | **Real:** 4,745 sols Curiosity REMS telemetry (Gale Crater) with hardware dropout cleansing | Latest 15% of sols, next to "tomorrow = today":<br>$P\text{ }R^2=0.9977$ (persistence 0.9963)<br>$T_{\max}\text{ }R^2=0.888$ (persistence 0.846)<br>$T_{\min}\text{ }R^2=0.818$ (persistence 0.740) |
| **MF-02** | **Dust Storm Risk** | Proxy storm label: diurnal range below 48 °C during Ls 160–330 | **Real:** Curiosity REMS (label is a proxy, not a storm catalogue) | Time-fold $\text{ROC-AUC}=0.62\text{–}0.70$ (modest skill) |
| **MF-03** | **Geochemical Mineral Classifier** | Lithology & Biosignature Preservation Potential (BPP) | **Real:** 5,363 PIXL points from 6 Jezero rocks; plus 2,000 synthetic points for mudstone and carbonate | Leave-one-rock-out accuracy **72.7%** (random split: 99.1%, optimistic). Berry Hollow, the only sulfate rock, cannot be learnt from the others |
| **MF-04** | **Space Radiation & SPE Hazard** | Galactic Cosmic Ray (GCR) dose rate & Solar Particle Event (SPE) alert | **Surrogate:** dose formula anchored to published Curiosity RAD values | Fit to its formula: GCR $R^2=0.990$, SPE $\text{ROC-AUC}=0.867$ |
| **MF-05** | **Rover Terramechanics** | Wheel slip ratio, traction energy drain, sand-trap entrapment risk | **Surrogate:** 12,000 Bekker-Wong simulations tuned to MER & Curiosity benchmarks | Fit to its formulas: Slip $R^2=0.848$, Energy $R^2=0.867$, Trap $\text{AUC}=0.999$ |
| **MF-06** | **LIBS Chemometrics Regressor** | 9-oxide composition ($\text{wt}\%$) from SuperCam emission lines | **Real:** 30 SuperCam laser points from 6 rocks (labelled with each rock's PIXL median), plus jittered copies and 2,400 synthetic spectra | Leave-one-rock-out: beats "predict the average" for MgO, Al₂O₃, CaO, TiO₂; **worse** for SiO₂, FeO, Na₂O, K₂O, SO₃. Shown ± ranges use this error |
| **MF-07** | **InSight Marsquake Attenuation** | Hypocentral distance, PGA, PGV, and shaking intensity | **Surrogate:** magnitudes and distances of 672 MQS V14 events; shaking from a hand-calibrated attenuation equation | Fit to its equation: PGA $R^2=0.991$, PGV $R^2=0.990$ |
| **MF-08** | **Solar Array Dust Deposition** | Daily dust factor ($D_f$) degradation, vortex cleaning probability | **Surrogate:** insolation and deposition formulas tuned to published Opportunity Dust Factor trends | Fit to its formulas: Insolation $R^2=1.000$, Dust Rate $R^2=0.995$ |

### Data Cleansing & Optimization Roadmap
- **Phase 1: REMS Hardware Sensor Dropout Cleansing**: Gale Crater REMS boom sensors experienced non-physical ADC integer dropouts ($-100^\circ\text{C}$, $-99^\circ\text{C}$, $-136^\circ\text{C}$) during cold martian nights. Cleansing 79 sentinels and applying smooth local linear time-series interpolation boosted $T_{\min}$ explained variance from $R^2 = 0.1895 \rightarrow 0.8176$ ($>400\%$ improvement) and reduced $T_{\min}$ MAE to $1.13^\circ\text{C}$. Regularization weights ($\alpha$) are dynamically optimized per atmospheric variable.
- **Phase 2: SuperCam Quantitative Chemometrics Optimization**: Physically coupled micro-grain elemental variance to atomic plasma emission intensity ($h_k \cdot (1 + \Delta_k) \cdot \text{laser\_pulse}$), calibrated emission transition factors for intense Ca II 393 nm and Mg II 279 nm doublets to match SuperCam spectrometer response, and introduced target-specific `RidgeCV` regularization. These gains were measured on a random row split, which shares laser points between train and test; on rocks left out of training the model still struggles (see MF-06 above).
- **Phase 3: Rover Terramechanics & InSight Marsquake Regressor Optimization**: Introduced `RidgeCV` multi-alpha cross-validation across Bekker-Wong slip and dynamic traction energy pipelines, decreasing dynamic energy MAE by 23.1 Wh/km ($375.9 \rightarrow 352.8\text{ Wh/km}$) while elevating Energy $R^2$ to $0.8667$ and Slip $R^2$ to $0.8476$. Fitted the marsquake attenuation surrogate to its hand-calibrated equation over MQS V14 magnitudes and distances ($R^2 = 0.9908$ for PGA, $0.9895$ for PGV, against that equation).
- **Phase 4: Solar Photovoltaics & Space Radiation Cross-Validated Tuning**: Upgraded surface insolation and dust deposition rate models to multi-alpha `RidgeCV` ($\alpha_{\text{insolation}} = 4.12 \times 10^{-6}, \alpha_{\text{dust}} = 0.0203$), reducing daily insolation MAE to near-zero ($3.14 \times 10^{-10}\text{ Wh/m}^2$) and dust factor degradation rate MAE to $0.000205\text{ }D_f/\text{sol}$. Evaluated the radiation surrogate (simulated from a dose formula anchored to Curiosity RAD values) and its SPE classifier on an 80/20 split of that simulated data: $R^2 = 0.9904$ ($\text{MAE} = 0.0120\text{ mSv/day}$), i.e. how closely it reproduces the formula.

For complete technical specifications, mathematical models, instrument architectures, and scientific references, see:
- [docs/ML_MODELS_SPECIFICATION.md](docs/ML_MODELS_SPECIFICATION.md) — Complete ML Model inventory, algorithms, loss functions, and inference benchmarks.
- [docs/SCIENCE_LAB_SYSTEM_ARCHITECTURE.md](docs/SCIENCE_LAB_SYSTEM_ARCHITECTURE.md) — Comprehensive guide to the 6 instrument decks, 16-D Astrobiology Latent Manifold, 55mm Core Drill stratigraphy, ISRU plasma smelting, and PDS ground truth archives.
