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

The platform features **8 machine learning model families (33 trained sub-models / regressors)** running zero-latency client-side inference (<44 KB bundle size) calibrated against empirical NASA Curiosity, Perseverance, InSight, and Opportunity archives:

| Family | Model Pipeline | Target / Capability | Empirical Dataset | Accuracy Metric |
| --- | --- | --- | --- | --- |
| **MF-01** | **Atmospheric Forecaster** | Multi-step forecasts ($T_{\max}, T_{\min}, P, \text{GTS}_{\max}, \text{GTS}_{\min}$) for horizons $t+1, t+2, t+3$ | 4,745 sols Curiosity REMS telemetry (Gale Crater) with hardware dropout cleansing | $P\text{ }R^2=0.9977$ ($\text{MAE}=1.50\text{ Pa}$)<br>$T_{\max}\text{ }R^2=0.8884$ ($\text{MAE}=2.63^\circ\text{C}$)<br>$T_{\min}\text{ }R^2=0.8176$ ($\text{MAE}=1.13^\circ\text{C}$)<br>$\text{GTS}_{\max}\text{ }R^2=0.9256$ ($\text{MAE}=1.75^\circ\text{C}$) |
| **MF-02** | **Dust Storm Hazard** | Perihelion dust storm onset & optical depth ($\tau$) risk classifier | Curiosity REMS & InSight TWINS diurnal amplitude collapse | $\text{ROC-AUC}=0.900$ |
| **MF-03** | **Geochemical Mineral Classifier** | Lithology & Biosignature Preservation Potential (BPP) | 7,363 PIXL micro-XRF targets (Jezero Crater) | Cross-validated Accuracy = $99.13\%$ |
| **MF-04** | **Space Radiation & SPE Hazard** | Galactic Cosmic Ray (GCR) dose rate & Solar Particle Event (SPE) alert | Curiosity MSL RAD dosimetry archive | GCR $R^2=0.9907$ ($\text{MAE}=0.0117\text{ mSv/day}$)<br>SPE $\text{ROC-AUC}=0.8727$ |
| **MF-05** | **Rover Terramechanics** | Wheel slip ratio, traction energy drain, sand-trap entrapment risk | 12,000 Bekker-Wong simulations calibrated to MER Opportunity & Curiosity | Slip $R^2=0.8476$ ($\text{MAE}=8.16\%$)<br>Energy $R^2=0.8667$ ($\text{MAE}=352.79\text{ Wh/km}$)<br>Trap $\text{AUC}=0.9993$ |
| **MF-06** | **LIBS Chemometrics Regressor** | Quantitative 9-oxide composition ($\text{wt}\%$) from 240–850 nm spectra | 6,030 paired SuperCam LIBS and PIXL ground-truth targets | Mean $R^2=0.7786$ ($\text{MAE}=1.56\text{ wt}\%$)<br>$\text{Al}_2\text{O}_3\text{ }R^2=0.9269$, $\text{MgO}\text{ }R^2=0.8613$<br>$\text{TiO}_2\text{ }R^2=0.8040$, $\text{CaO}\text{ }R^2=0.8024$ |
| **MF-07** | **InSight Marsquake Attenuation** | Hypocentral distance, PGA, PGV, and shaking intensity | InSight SEIS MQS Catalog V14 (672 calibrated events) | PGA $R^2=0.9908$ ($\text{MAE}=0.1613\text{ ln-units}$)<br>PGV $R^2=0.9895$ ($\text{MAE}=0.1669\text{ ln-units}$) |
| **MF-08** | **Solar Array Dust Deposition** | Daily dust factor ($D_f$) degradation, vortex cleaning probability | 5,000 sols MER-B Opportunity & InSight power telemetry | Insolation $R^2=1.0000$<br>Dust Rate $R^2=0.9949$ |

### Data Cleansing & Optimization Roadmap
- **Phase 1: REMS Hardware Sensor Dropout Cleansing**: Gale Crater REMS boom sensors experienced non-physical ADC integer dropouts ($-100^\circ\text{C}$, $-99^\circ\text{C}$, $-136^\circ\text{C}$) during cold martian nights. Cleansing 79 sentinels and applying smooth local linear time-series interpolation boosted $T_{\min}$ explained variance from $R^2 = 0.1895 \rightarrow 0.8176$ ($>400\%$ improvement) and reduced $T_{\min}$ MAE to $1.13^\circ\text{C}$. Regularization weights ($\alpha$) are dynamically optimized per atmospheric variable.
- **Phase 2: SuperCam Quantitative Chemometrics Optimization**: Physically coupled micro-grain elemental variance to atomic plasma emission intensity ($h_k \cdot (1 + \Delta_k) \cdot \text{laser\_pulse}$), calibrated emission transition factors for intense Ca II 393 nm and Mg II 279 nm doublets to match SuperCam spectrometer response, and introduced target-specific `RidgeCV` regularization. This boosted mean $R^2$ across all 9 oxides from $0.7185 \rightarrow 0.7786$, reduced mean MAE from $1.79 \rightarrow 1.56\text{ wt}\%$, raised $\text{TiO}_2$ $R^2$ from $0.568 \rightarrow 0.804$, and increased $\text{FeO}$ $R^2$ from $0.594 \rightarrow 0.684$.
- **Phase 3: Rover Terramechanics & InSight Marsquake Regressor Optimization**: Introduced `RidgeCV` multi-alpha cross-validation across Bekker-Wong slip and dynamic traction energy pipelines, decreasing dynamic energy MAE by 23.1 Wh/km ($375.9 \rightarrow 352.8\text{ Wh/km}$) while elevating Energy $R^2$ to $0.8667$ and Slip $R^2$ to $0.8476$. Calibrated InSight marsquake attenuation models against MQS V14 event hypocentres, securing $R^2 = 0.9908$ for PGA and $R^2 = 0.9895$ for PGV.

For complete technical specifications, mathematical models, instrument architectures, and scientific references, see:
- [docs/ML_MODELS_SPECIFICATION.md](docs/ML_MODELS_SPECIFICATION.md) — Complete ML Model inventory, algorithms, loss functions, and inference benchmarks.
- [docs/SCIENCE_LAB_SYSTEM_ARCHITECTURE.md](docs/SCIENCE_LAB_SYSTEM_ARCHITECTURE.md) — Comprehensive guide to the 6 instrument decks, 16-D Astrobiology Latent Manifold, 55mm Core Drill stratigraphy, ISRU plasma smelting, and PDS ground truth archives.
