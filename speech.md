# MarsWalk Explorer — 4-Minute Hackathon Winning Pitch Script
**Event:** NASA Space Apps Challenge 2026  
**Category:** Planetary Cartography, Autonomous Surface Operations & Astrobiology  
**Target Duration:** 4:00 Minutes (240 Seconds)  
**Word Count:** ~560 Words (~135–140 words per minute deliberate speaking pace)  
**Live Demo:** Synchronized Screen Actions & Audio Cues  

---

## Pitch Overview & Timing Breakdown

```
[0:00 - 0:35]  ACT I:   The 100-Million-Mile Blind Spot (Hook & Problem)
[0:35 - 1:25]  ACT II:  Geotechnical Cartography & Physics-Coupled Routing
[1:25 - 2:25]  ACT III: In-Situ Science Lab & Subsurface Astrobiology Engine
[2:25 - 3:15]  ACT IV:  Zero-Latency Edge ML Architecture & Empirical Datasets
[3:15 - 3:45]  ACT V:   EVA Helmet HUD & Real-Time Contingency Command
[3:45 - 4:00]  FINALE:  The Vision & Closing Punchline
[Post-Pitch]   Q&A:     Technical Defense & Judge Cheat Sheet
```

---

## 4-Minute Presentation Script

### ACT I: The 100-Million-Mile Blind Spot (0:00 – 0:35)

> **Goal:** Hook the judges immediately by highlighting the existential danger of surface exploration and introducing MarsWalk Explorer as the definitive operational solution.

| Timestamp | Visual & Demo Action | Spoken Dialogue |
| :--- | :--- | :--- |
| **0:00 – 0:18** | **[SCREEN]** Start on **Home Hero** with the interactive 3D Mars globe rotating smoothly against deep space with atmospheric scattering. | *"Judges, when the Artemis generation steps onto the red dust of Mars, they won't be taking a leisurely stroll. They will be stepping into an environment where a 15-degree dune slope can permanently trap a multi-ton rover, where solar particle events deliver lethal radiation within minutes, and where an unexpected descent into an ancient crater leaves an astronaut stranded beyond their walkback oxygen limit."* |
| **0:18 – 0:35** | **[ACTION]** Click **"EXPLORE MARS CARTOGRAPHY"**. Camera flies seamlessly into **Jezero Crater** (Perseverance landing site). | *"For sixty years, Mars exploration has been fundamentally reactive. Today, we present **MarsWalk Explorer** — the first unified planetary cartography, geotechnical navigation, and in-situ astrobiology platform built from the ground up to safeguard human Marswalks."* |

---

### ACT II: Geotechnical Cartography & Physics-Coupled Routing (0:35 – 1:25)

> **Goal:** Prove scientific rigor by demonstrating real USGS/ESA DEM elevation grids coupled with Bekker-Wong terramechanics that steer rovers around sand traps.

| Timestamp | Visual & Demo Action | Spoken Dialogue |
| :--- | :--- | :--- |
| **0:35 – 0:52** | **[ACTION]** Toggle the **HRSC-MOLA 200m DEM Elevation Layer**, then switch on the **Slope Heatmap Overlay**. | *"MarsWalk is not an artistic rendering. It is directly powered by **USGS and ESA HRSC-MOLA 200-meter blended elevation grids**. But elevation alone doesn't prevent mission failure. That is why our autonomous A\* pathfinder is physically constrained by **Bekker-Wong soil terramechanics**."* |
| **0:52 – 1:12** | **[ACTION]** Drop a start waypoint on duricrust and click an objective across an aeolian drift sand ripple field. | *"Notice what happens as we plot a traverse: our engine doesn't just calculate distance. In real time, it models regolith shear strength, wheel sinkage, dynamic traction power drain, and wheel slip. When slip exceeds 45% or sand-trap probability hits 65%—the exact conditions that permanently entrapped Opportunity in Purgatory Dune—the router treats the dune as an infinite barrier and autonomously recalculates safe bedrock bypasses."* |
| **1:12 – 1:25** | **[ACTION]** Hover cursor over the dynamic red dashed contour (**Walkback Point of No Return**). | *"Simultaneously, the platform projects the astronaut’s non-negotiable **Walkback Limit**—dynamically factoring metabolic oxygen consumption, slope elevation penalties, and emergency return walk velocity."* |

---

### ACT III: In-Situ Science Lab & Subsurface Astrobiology Engine (1:25 – 2:25)

> **Goal:** Showcase the deep science capabilities—Perseverance instrument triad (SuperCam, PIXL, SHERLOC), 3D Core Drill, and paleohydrology.

| Timestamp | Visual & Demo Action | Spoken Dialogue |
| :--- | :--- | :--- |
| **1:25 – 1:40** | **[ACTION]** Click the **"Science Lab"** tab. Select rock target **"Berry Hollow"** or **"Montpezat"**. | *"Once on station, astronauts become planetary field geologists. Welcome to the **In-Situ Science Lab**, integrating Perseverance's primary analytical triad: SuperCam LIBS, PIXL micro-XRF, and SHERLOC deep UV Raman."* |
| **1:40 – 1:56** | **[ACTION]** Click **DECK 1 (SuperCam)**. Hover over the 240–850 nm spectrum showing NIST emission peaks (Ca II, Mg II). | *"These are real Perseverance measurements from NASA's archive. Our model turns SuperCam's laser-spark emission lines into nine oxide estimates, with honest error bars measured on rocks it never saw."* |
| **1:56 – 2:12** | **[ACTION]** Click **DECK 4 (55mm Core Drill)**. Rotate the interactive **3D Core Sample Drill**. | *"Perseverance measured each rock's surface; our **55mm Core Drill** models what lies deeper, layer by layer. Starting from the real SHERLOC spectrum, it strips fluorescence and compares carbon bands to an organic library—a teaching tool, not a life detector."* |
| **2:12 – 2:25** | **[ACTION]** Click **DECK 5 (ISRU Forge)**, then toggle the **Paleohydrology geochemical water chart**. | *"We pair discovery with survival: a speculative look at what future ISRU could build from each rock, and the ancient water that shaped it—from acid brines to neutral paleolakes."* |

---

### ACT IV: Zero-Latency Edge ML Architecture & Empirical Datasets (2:25 – 3:15)

> **Goal:** Address the hardest engineering challenge: computing on Mars with zero cloud dependency, highlighting the ~49 KB model bundle.

| Timestamp | Visual & Demo Action | Spoken Dialogue |
| :--- | :--- | :--- |
| **2:25 – 2:44** | **[ACTION]** Open the **Weather / ML Telemetry Deck** showing multi-horizon forecast cards ($T_{\max}, T_{\min}, P, \text{GTS}$). | *"Now, the critical engineering question: How does this run on Mars without an Earth cloud data center? Cloud APIs are impossible when communications latency is twenty minutes each way. MarsWalk runs **8 machine learning model families**: four learn from real mission data, four are fast surrogates of published physics models."* |
| **2:44 – 3:15** | **[ACTION]** Highlight the score line under the forecast (Pressure MAE 1.5 Pa, $T_{\max}$ $R^2$ 0.888 vs 0.846 persistence). | *"Every model is compiled into a zero-dependency **49-kilobyte JSON bundle** running in client-side JavaScript in under **0.5 milliseconds**.*  
*Trained on 4,745 sols of Curiosity REMS data, the forecaster beats 'tomorrow equals today' on sols it never saw—and every score in the app is measured on unseen data."* |

---

### ACT V: EVA Helmet HUD & Real-Time Contingency Command (3:15 – 3:45)

> **Goal:** Bring the judges into the spacesuit visor, demonstrating real-time biometrics, radiation alerts, and contingency survival modeling.

| Timestamp | Visual & Demo Action | Spoken Dialogue |
| :--- | :--- | :--- |
| **3:15 – 3:30** | **[ACTION]** Open the **EVA Helmet HUD** modal. Audio synthesizer plays ambient telemetry hum and suit vitals. | *"When astronauts step through the airlock, MarsWalk transforms into the **EVA Helmet HUD**. Biometric sensors track metabolic oxygen burn, suit internal pressure, and real-time cosmic radiation exposure against a 0.50 millisievert per-EVA planning allowance."* |
| **3:30 – 3:45** | **[ACTION]** Switch to the **Contingency Simulator** (triggering a Dust Devil Cleaning or ECLSS power warning). | *"If a global dust storm rolls in or an oxygen suit puncture occurs, the **Contingency Simulator** models dynamic life support depletion rates and computes the exact sols to habitat ECLSS starvation."* |

---

### FINALE: The Vision & Closing Punchline (3:45 – 4:00)

| Timestamp | Visual & Demo Action | Spoken Dialogue |
| :--- | :--- | :--- |
| **3:45 – 4:00** | **[ACTION]** Click **"Generate Flight Plan"** (opening the printable NASA Mission Brief), then return to the rotating 3D globe. | *"MarsWalk Explorer bridges the gap between raw NASA planetary data and human operational survival. It transforms raw orbital pixels into safe traverses, laser sparks into rock chemistry, and unpredictable hazards into calculated survival margins.*  
*We didn't just build a map. We built the copilot for humanity's first steps on Mars.*  
*Thank you, and we welcome your questions."* |

---

## Technical Defense & Judge Q&A Cheat Sheet

### 1. "Where does your elevation and terrain data come from?"
> *"We ingested the official USGS Astrogeology and ESA HRSC-MOLA blended digital elevation model at 200 meters per pixel across our hero landing sites (Jezero, Gale, Gusev, Meridiani, Mawrth, Valles Marineris, and Olympus Mons), complemented by the global MGS MOLA 4 pixel-per-degree grid. Slope gradients and radio line-of-sight are computed directly on these elevation meshes via Web Workers."*

### 2. "How do you run 8 ML model families inside the browser without latency?"
> *"Instead of shipping heavy PyTorch or ONNX runtimes, we train every model offline in Python with scikit-learn (`scripts/ml/train_models.py`) and export the regression weights, scalers and uncertainty ranges into a single ~49 KB JSON bundle. In the browser, inference is plain JavaScript dot-products in under 0.5 milliseconds. We checked that the browser gives the same answers as Python."*

### 3. "What makes your routing different from standard Google Maps or A*?"
> *"Standard pathfinders minimize geometric Euclidean distance. MarsWalk minimizes **dynamic energy and risk** using Bekker-Wong soil mechanics. The edge cost function is $C = E_{\text{Wh}} \times (1 + 4(s/100)^2)$. When slope and low thermal inertia indicate loose drift sand with slip $>45\%$ or entrapment probability $>65\%$, the cost approaches infinity, forcing the router to find firm regolith or bedrock pavements."*

### 4. "Is your weather and radiation model truly calibrated to Mars?"
> *"The weather model is trained on real data: 4,745 sols of Curiosity REMS telemetry from Gale Crater, with 79 sensor dropouts cleaned. On the latest sols, which it never saw, it scores $T_{\max}$ $R^2 = 0.888$ against 0.846 for 'tomorrow equals today', and pressure $R^2 = 0.998$. The radiation model is a surrogate: it reproduces a dose formula anchored to Curiosity RAD's published surface dose (Hassler et al., Science 2014) and the 11-year solar cycle. We label every surrogate as such in the app."*

### 5. "How does the Science Lab handle Raman fluorescence?"
> *"Mineral fluorescence swamps Raman signals on Mars. We start from the real SHERLOC spectrum, remove the fluorescence with a rolling-minimum baseline, find peaks such as the carbon D and G bands near 1350 and 1600 cm⁻¹, and compare their positions to an organic reference library. That shows which compounds would fit—but Raman band positions alone cannot identify a molecule or prove biology, and the app says so."*

### 6. "How do you know your ML models actually work?"
> *"We test each one on data it never saw. Weather is scored on the most recent sols. The mineral and SuperCam models are scored leave-one-rock-out: each Jezero rock is predicted by a model that never saw it. That is harder than a random split—our mineral classifier drops from 99% to 73%—but it is the honest number, and it is the one we show. The weak spots are clear too: with only six analysed rocks, the SuperCam oxide model still struggles on new rock types, so more labelled targets are our next step."*

---

## Platform Production Benchmarks Summary

- **Unit Tests:** 192 / 192 Tests Passing (100% Green in Vitest)
- **Production Build:** Clean Vite Build in ~20 Seconds (0 Errors)
- **Edge ML Bundle:** ~49 KB (`public/data/ml/mars_models.json`)
- **Inference Runtime:** < 0.5 ms per model evaluation
- **Real NASA data used:** Curiosity REMS weather, Perseverance SuperCam / PIXL / SHERLOC (PDS Geosciences Node), InSight MQS marsquake catalogue V14 (magnitudes and distances), USGS HRSC-MOLA DEMs
- **Published benchmarks the surrogates are tuned to:** Curiosity RAD surface dose, Opportunity Dust Factor trends, MER / Curiosity mobility and slip events
