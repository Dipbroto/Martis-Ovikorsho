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

## Machine Learning Subsystem

The platform features 8 machine learning model families (33 trained sub-models / regressors) running zero-latency client-side inference (<43 KB bundle size) calibrated against NASA Curiosity, Perseverance, InSight, and Opportunity datasets.

For the complete technical specification, model inventory, training algorithms, loss functions, and uncertainty quantification, see:
- [docs/ML_MODELS_SPECIFICATION.md](docs/ML_MODELS_SPECIFICATION.md)
