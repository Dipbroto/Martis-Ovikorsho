# MarsWalk Explorer — Code Review & Improvement Report

_Review date: 2026-10-21 · Branch: `main` (88a02ef)_

Scope: a review of the whole codebase (~21k lines in `src/`, plus the Supabase schema, config and `public/` assets) and a production build. Every item below fixes, cleans up or hardens something that already exists. **None of it adds a feature.**

The production build passes but ships as a single 2.6 MB JavaScript file (716 KB gzipped).

**Suggested order:** section 1 first, then items 2.1 and 3.1. Those are the changes users would actually notice, and none of them is a large edit.

---

## 1. Bugs (things that work wrong today)

### 1.1 The AI science report never actually runs
[`ScienceLabPage.jsx:114`](src/components/ScienceLabPage.jsx) and [`ScienceLabModal.jsx:114`](src/components/ScienceLabModal.jsx) call `generateScienceReport(target)` with one argument. The function in [`aiService.js:176`](src/services/aiService.js) expects `(targetName, targetType, coords)` and reads `coords.lat.toFixed(...)` while building the prompt. That throws a `TypeError`, so the `catch` block always shows the hard-coded fallback report and Gemini is never called.

**Fix:** pass `target.name`, `target.formation` (or the type field) and `{ lat, lon }`, or change the function to accept the target object.

### 1.2 Copilot map commands don't take you to the map
Copilot actions (`plan_route`, `switch_view_mode`, `navigate_to_location`, `trigger_contingency`, `start_eva_simulation`) call `document.getElementById('section-map')?.scrollIntoView(...)` ([`AresCopilotModal.jsx:96`](src/components/AresCopilotModal.jsx)). The app now uses tabs, and no element has a `section-*` id. If you ask from the Home tab, the store updates but you never see the result.

**Fix:** call `setActiveTab('map')` in those actions. Make `scroll_to_section` switch tabs instead of scrolling, and update its tool description in `aiService.js` to match.

### 1.3 The safe-walkback circles are drawn about half their real size
The map uses `crs={L.CRS.EPSG4326}`. Leaflet's `<Circle radius={2000}>` converts metres to degrees using **Earth's** radius (6,371 km) whenever the CRS is Earth-based, which EPSG4326 is. On Mars (3,389.5 km), the 2 km and 5 km walkback zones are therefore drawn about **53% too small** ([`MarsMap.jsx:~676`](src/components/MarsMap.jsx)).

**Fix:** scale the radius by `6371008 / 3389500` (≈ 1.88), or draw the circle as a polygon using `marsDistance`.

### 1.4 Emergency return starts from the wrong place
`executeEmergencyReturn` always uses `waypoints[1]` as the current position ([`useMapStore.js:451`](src/store/useMapStore.js)), not where the rover actually is. `roverCurrentPosition` exists in the store but nothing ever sets it.

**Fix:** have the rover simulator write its position (throttled) and use it as the abort origin.

### 1.5 Supabase errors are silently ignored
supabase-js **returns** `{ error }` instead of throwing, so the `try/catch` around these calls never fires and failures go unnoticed:
- `ai_chat_messages.insert` / `.delete` in [`chatHistoryService.js`](src/services/chatHistoryService.js)
- `profiles.select` in [`App.jsx`](src/App.jsx) (`fetchProfile`)
- `profiles.update` in [`RoutePlanner.jsx:225`](src/components/RoutePlanner.jsx)

**Fix:** destructure `{ error }` and check it.

### 1.6 Smaller bugs
- `index.html` points the favicon to `/vite.svg`, which doesn't exist. `public/mars-favicon.svg` is never used.
- `feature_name.replace('_', ' ')` in the copilot only replaces the first underscore (use `replaceAll`).
- The "Registration successful! Please login." message is shown in the red **error** slot of [`AuthModal.jsx`](src/components/AuthModal.jsx).
- `addActivity` IDs come from `Date.now()` alone, so two activities added in the same millisecond collide.

---

## 2. Performance

### 2.1 About 20 components subscribe to the entire store
Many components destructure the whole store, e.g. `const { waypoints } = useMapStore()`. Examples: `RoverSimulator` (inside MarsMap), `Mars3DViewer`, `RoutePlanner`, `RightSidebar`, `EVAHelmetHUD`, `MissionReport`, `POIDetailCard`, `FlightPlanModal`, `ContingencySimulator(Page)`, `WeatherPanel`, `RadiationPanel`, and others.

The map writes `cursorPosition` on **every mouse move**, and the rover writes progress every 120 ms. So all of these re-render constantly, including the whole 3D `<Canvas>` tree. The earlier commit e0fd1b0 fixed only part of this.

**Fix:** use per-field selectors (`useMapStore(s => s.waypoints)`) or `useShallow` from `zustand/react/shallow`.

### 2.2 The rover animation re-renders React on every frame
The drive loop in [`MarsMap.jsx`](src/components/MarsMap.jsx) calls `setCurrentCoord`, `setCurrentHeading`, `setCurrentSpeed`, `setCurrentSlope` and `setCurrentSegIdx` on every `requestAnimationFrame`. It also builds a new `L.divIcon` (a large HTML string) on every render. Its effect depends on `evaCurrentWaypointIndex`, so the loop also restarts at every segment.

**Fix:** move the marker imperatively through a ref (`marker.setLatLng`), throttle the React state, memoise the icon, and read `evaCurrentWaypointIndex` via `getState()`.

### 2.3 The mascot button re-renders on every mouse move anywhere in the app
[`AresFloatingButton.jsx:207`](src/components/AresFloatingButton.jsx) tracks the cursor with React state.

**Fix:** use framer-motion's `useMotionValue` / `useTransform` so updates skip React rendering.

### 2.4 The full-screen starfield never stops animating
`SpaceAtmosphere` runs a full-viewport canvas loop at all times, even when opaque map, 3D or page backgrounds cover it. It also ignores `devicePixelRatio`.

**Fix:** pause it when not visible (only render it on Home), or cap it at about 30 fps.

### 2.5 The JavaScript ships as one 2.6 MB file
three.js, Leaflet, recharts, framer-motion and every tab load up front (716 KB gzipped).

**Fix:** lazy-load tabs, modals and `Mars3DViewer` with `React.lazy` + `Suspense`. Optionally split vendor code with `manualChunks`.

### 2.6 About 11 MB of unused files in `public/`
These files are referenced nowhere but get copied into every build:
- `mars_nasa.glb` (3.9 MB)
- `mars2.png` (2.0 MB), `mars3.png` (1.6 MB)
- `dest_basecamp.jpg`, `dest_crater_zeta.jpg`, `dest_elysium.jpg`, `dest_olympus.jpg` (~3.6 MB together)

Separately, `background.png` **is** used but weighs 2 MB as a PNG. Converting it to WebP or AVIF would shrink it a lot.

### 2.7 Leaflet CSS loads twice
It loads once from unpkg in `index.html` and again via `import 'leaflet/dist/leaflet.css'` in `MarsMap.jsx`. Remove the CDN link.

---

## 3. Security and privacy

### 3.1 The Gemini API key is in the public bundle
`VITE_GEMINI_API_KEY` is inlined by Vite. I confirmed the key appears in the built JavaScript, so anyone visiting the site can copy it and use it on your quota.

**Fix:** move the three Gemini calls (`generateScienceReport`, `generateFlightBrief`, `chatWithMissionControl`) behind a small Supabase Edge Function that holds the key server-side. App behaviour stays the same. **Rotate the current key** once that's done.

### 3.2 Saved routes are public by default
"Sync mission" inserts with `is_public: true` ([`RoutePlanner.jsx:216`](src/components/RoutePlanner.jsx)). Combined with `profiles` being readable by everyone, users publish their routes without being asked.

**Fix:** default to `false`.

### 3.3 Users can edit their own rank and stats
The `profiles` UPDATE policy in `supabase_schema.sql` lets the client write `rank`, `total_distance_km` and `samples_collected` directly. The distance total is also computed on the client.

**Fix:** restrict updatable columns (column privileges or a `BEFORE UPDATE` trigger), and compute stats server-side from `missions` / `science_logs`.

### 3.4 Signup breaks on duplicate usernames
- `profiles.username` is `unique`. If two people sign up with the same username, the `handle_new_user` trigger fails, and so does the signup. Handle the conflict, e.g. by appending a suffix.
- `handle_new_user` is `security definer` without `set search_path = public`, which Supabase's database linter flags.

### 3.5 Chat history is unbounded
The full Supabase chat history loads and is sent to Gemini on every message, so token cost and latency grow forever. Cap it at the last N turns (e.g. 20) both when loading and when sending.

### 3.6 `venv/` isn't in `.gitignore`
It is currently untracked. Add it before someone commits it by accident.

---

## 4. Code health and maintainability

### 4.1 Three near-duplicate modal/page pairs
| Modal | Page | Notes |
|---|---|---|
| `ScienceLabModal.jsx` (897 lines) | `ScienceLabPage.jsx` (898 lines) | Nearly identical logic |
| `MarsImageryModal.jsx` (318) | `MarsImageryPage.jsx` (430) | Shared fetch/filter logic |
| `ContingencySimulator.jsx` (261) | `ContingencySimulatorPage.jsx` (250) | Shared scenario logic |

Pulling the shared body into one component, with a thin modal wrapper around it, removes about 1,500 lines. It also stops bugs like 1.1 from having to be fixed twice.

### 4.2 Dead code
- Unused files: `src/components/InteractiveMarsHero.jsx` (524 lines), `src/components/ui/card.tsx`, `src/components/ui/demo.tsx`.
- Unused functions: `createProceduralMarsTexture()` and `createProceduralMarsBumpMap()` in `Mars3DViewer.jsx` (~170 lines). The `Resize` import from drei is also unused.
- A duplicate `src/lib/utils.js` next to `src/lib/utils.ts`.
- Store state nothing reads or sets: `isSkyEphemerisOpen` (and its setter), `roverCurrentPosition`, `roverSpeedKmh`, `roverOdometerKm`.
- Many unused `lucide-react` imports (e.g. in `AresCopilotModal.jsx`).
- A stale comment in `nasaApiService.js`: `// We will create this`.

### 4.3 Repeated `lon`/`lng` fallbacks
`wp.lon !== undefined ? wp.lon : (wp.lng !== undefined ? wp.lng : 0)` is repeated about 15 times in `MarsMap.jsx` and `Mars3DViewer.jsx`, even though the store already normalises to `lon` in `setWaypoints`, `addWaypoint` and `loadExpeditionPreset`. Remove the repeats, or use one `getLon(wp)` helper.

### 4.4 The same landmarks have different values in different files
- Utopia Planitia is at **25.1°N, 109.9°E** in `aiService.js` (`MARS_KNOWLEDGE`) but **47.67°N, 134.04°E** in `elevationService.js`. Isidis Planitia is at 30°N, 100°E in `elevationService.js` (it's actually about 13°N, 87°E).
- The 3D camera presets in `Mars3DViewer.jsx` use hand-typed `Vector3`s instead of the existing `latLonToVector3()` helper, so they may not point at the named landmark.
- Rover speed is 7.2 km/h in the store (`roverSpeedKmh`) but about 14.5 km/h in the simulator.

**Fix:** one shared landmark/constants module used by the AI prompt, the elevation service, the 3D presets and the map.

### 4.5 Some data is presented as real when it isn't
- NASA Image Library results get **random** lat/lon near Jezero, a random elevation and a random Ls, and their `sol` field is filled with an Earth date ([`nasaApiService.js:~50`](src/services/nasaApiService.js)).
- `fetchScienceTargets()` adds a fake 1.2 s "network latency".
- JPL Horizons is called directly from the browser, which CORS will likely block. The comment in the code acknowledges this.
- Elevation is IDW interpolation over 20 reference points plus noise, not MOLA data.

**Fix:** label these as simulated (`ProvenanceBadge` already exists for that), or remove the fabricated fields. This matters for credibility in a NASA Space Apps entry.

### 4.6 Small React issues
- `<AnimatePresence>` sits inside an early `if (!open) return null` in `AresCopilotModal`, `AuthModal` and others, so exit animations never play. Keep the `AnimatePresence` mounted and render its children conditionally.
- The `useEffect` dependency lists in `App.jsx` are incomplete (`fetchProfile`, the setters).
- The `setTimeout`s in the copilot action toast and the route sync status aren't cleared on unmount.
- `isProcessing` in the copilot is never reset if `saveChatMessage` throws (it needs `try/finally`).
- `DEFAULT_GREETING.timestamp` in `chatHistoryService.js` is fixed when the module loads.

### 4.7 No tooling
- No ESLint config. ESLint with `eslint-plugin-react-hooks` alone would have caught several of the issues above (dependency lists, unused imports, unused files).
- `.tsx` files exist with no `tsconfig.json`, so nothing type-checks them.
- No tests. Unit tests for `marsUtils.js` (distance, slope) and `weatherSimulation.js` (sol calculation) would be cheap.
- No `README.md` with setup steps (env vars, running `supabase_schema.sql`).

### 4.8 Workspace clutter
`generate_*.py`, the `MarsWalk_*.docx` files, `MarsWalk_TopBar_Functionality.txt` and `venv/` are untracked in the repo root. They belong in a `docs/` folder or should be ignored.

---

## Quick reference: priority checklist

- [ ] 1.1 Fix the `generateScienceReport` arguments
- [ ] 1.2 Copilot actions switch to the Map tab
- [ ] 1.3 Use the Mars radius for walkback circles
- [ ] 1.4 Emergency return from the rover's real position
- [ ] 1.5 Check Supabase `{ error }` results
- [ ] 1.6 Favicon, `replaceAll`, registration message, activity IDs
- [ ] 2.1 Replace whole-store subscriptions with selectors
- [ ] 2.2 Rover animation without per-frame React renders
- [ ] 2.3 Mascot cursor tracking via motion values
- [ ] 2.4 Pause the starfield when hidden
- [ ] 2.5 Lazy-load tabs, modals and the 3D viewer
- [ ] 2.6 Remove ~11 MB of unused assets; compress `background.png`
- [ ] 2.7 Remove the duplicate Leaflet CSS
- [ ] 3.1 Move the Gemini key server-side and rotate it
- [ ] 3.2 Default saved missions to private
- [ ] 3.3 Lock down profile stat columns
- [ ] 3.4 Handle username conflicts; set `search_path`
- [ ] 3.5 Cap chat history
- [ ] 3.6 Ignore `venv/`
- [ ] 4.1 Merge the modal/page duplicates
- [ ] 4.2 Remove dead code
- [ ] 4.3 Remove the repeated `lon`/`lng` fallbacks
- [ ] 4.4 One shared landmark/constants module
- [ ] 4.5 Label or remove simulated data
- [ ] 4.6 React cleanup items
- [ ] 4.7 Add ESLint, tsconfig, basic tests and a README
- [ ] 4.8 Tidy the repo root

---

## Status (2026-10-21): fixes applied

All items above were implemented in the working tree (not committed). `npm run lint`, `npm test`,
`tsc --noEmit` and `npm run build` pass, and the app was exercised in the browser (map, layers, rover drive,
3D globe, EVA HUD, copilot, science lab).

**Needs action from you**
- **3.1:** deploy the edge function and **rotate the Gemini key** (the old key was exposed in earlier builds):
  `supabase secrets set GEMINI_API_KEY=...` then `supabase functions deploy gemini-proxy`.
- **3.3 / 3.4:** re-run `supabase_schema.sql` in your Supabase SQL editor.

**Deviations from the original write-up**
- **4.1:** only the Science Lab pair really duplicated logic (67% identical lines); the other two pairs differ
  too much (24% / 46%). Shared Science Lab state/handlers now live in `src/hooks/useScienceLab.js`; the two
  layouts stay separate on purpose. The imagery and contingency pairs were left as they are.
- **4.4:** the 3D camera presets were checked in the browser and point at the right place, so they were not
  changed. The landmark table now feeds the AI prompt and the elevation model.
- **New bug found and fixed:** `LayerPanel` used `require()`, which does not exist in the browser, so the Map
  Layers panel rendered no layers at all.
