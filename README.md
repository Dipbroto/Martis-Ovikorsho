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
- `src/utils` — Mars math, elevation model, autonomous router, audio synthesiser
- `supabase/functions/gemini-proxy` — Edge Function that holds the Gemini key

## Data provenance

Elevation is an inverse-distance-weighted model anchored on known MOLA elevations, not raw DEM tiles, and the
weather, radiation and rover telemetry are simulations. Map imagery comes from NASA Mars Trek tiles. Images from
the NASA Image Library are not georeferenced, so they carry no map coordinates.
