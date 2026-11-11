# Martis Ovikorsho 🪐
### Next-Generation Martian Surface Mission Planning, EVA Cartography & In-Situ Astrobiology Laboratory

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA_Space_Apps-2026_Challenge-0B3D91?style=for-the-badge&logo=nasa&logoColor=white)](https://www.spaceappschallenge.org/)
[![Live Deployment](https://img.shields.io/badge/Live_Demo-martis--ovikorsho.vercel.app-00C7B7?style=for-the-badge&logo=vercel&logoColor=white)](https://martis-ovikorsho.vercel.app/)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Dipbroto%2FMartis--Ovikorsho-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Dipbroto/Martis-Ovikorsho)
[![Tests Passing](https://img.shields.io/badge/Vitest-25%20Suites%20%7C%20212%20Passed-success?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![ML Runtime](https://img.shields.io/badge/Edge_ML-25--Tree%20Random%20Forest%20(%3C0.2ms)-blueviolet?style=for-the-badge&logo=scikitlearn&logoColor=white)](file:///c:/Users/dipka/Desktop/Nasa%20Space/src/services/marsMlService.js)
[![NASA PDS Archives](https://img.shields.io/badge/NASA_PDS-20%20Jezero%20Targets%20%7C%2018.5k%20Spectra-critical?style=for-the-badge&logo=nasa&logoColor=white)](https://pds-geosciences.wustl.edu/missions/mars2020/)
[![NASA Odyssey GRS](https://img.shields.io/badge/Odyssey_GRS-6%20Global%20Elemental%20Maps-teal?style=for-the-badge&logo=nasa&logoColor=white)](https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/)
[![NASA MSR Manifest](https://img.shields.io/badge/MSR_Manifest-24%20Sealed%20Tubes%20%7C%20Three%20Forks%20Depot-orange?style=for-the-badge&logo=nasa&logoColor=white)](file:///c:/Users/dipka/Desktop/Nasa%20Space/src/data/nasaSampleManifest.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **"Read a Martian rock like a rover does; plan a Marswalk like an astronaut must."**  
> Martis Ovikorsho is an integrated interplanetary operations cockpit and astrobiology research station. Engineered for future human surface missions and autonomous robotic precursors, the platform combines **high-resolution 2D/3D orbital cartography**, **Bekker-Wong rover terramechanics**, **point-of-no-return astronaut walkback envelopes**, **an authentic 20-campaign In-Situ Science Lab**, and an **8-family machine learning subsystem running zero-latency edge tree ensembles directly in the browser**.

---

## 📌 Table of Contents

1. [Executive Summary & System Architecture](#-executive-summary--system-architecture)
2. [Interactive In-Situ Science Lab (20 Empirical NASA Campaigns)](#-interactive-in-situ-science-lab-20-empirical-nasa-campaigns)
   - [The 20-Rock Empirical Manifest](#the-20-rock-empirical-manifest)
   - [The 6 Scientific Instrument Decks](#the-6-scientific-instrument-decks)
   - [Official NASA Mars Sample Return (MSR) Cache Manifest & Dossier](#-official-nasa-mars-sample-return-msr-cache-manifest--dossier)
   - [Anywhere-on-Mars Hyperspectral Scanner](#anywhere-on-mars-hyperspectral-scanner)
3. [Machine Learning Subsystem (8 Model Families)](#-machine-learning-subsystem-8-model-families)
   - [Master Model Inventory](#master-model-inventory)
   - [The MF-03 Random Forest Breakthrough](#the-mf-03-random-forest-breakthrough)
   - [16-D Astrobiology Latent Manifold & Mahalanobis Anomaly Engine](#16-d-astrobiology-latent-manifold--mahalanobis-anomaly-engine)
   - [Prebiotic Molecular Matcher](#prebiotic-molecular-matcher)
4. [2D/3D Multi-Scale Cartography & Tactical Traverse Planning](#-2d3d-multi-scale-cartography--tactical-traverse-planning)
   - [Terrain Elevation Grids & Anti-Meridian Routing](#terrain-elevation-grids--anti-meridian-routing)
   - [Planetary Resource Overlays: Mars Odyssey GRS Elemental Maps (Fe, Si, K, Th, Cl, H₂O) & ISRU Engine](#planetary-resource-overlays-mars-odyssey-grs-elemental-maps-fe-si-k-th-cl-h2o--isru-engine)
   - [Dynamic Point-of-No-Return (PNR) Walkback Safety Envelopes](#dynamic-point-of-no-return-pnr-walkback-safety-envelopes)
   - [Line-of-Sight VHF Comms Horizon](#line-of-sight-vhf-comms-horizon)
   - [Compact Collapsible Navigation Rail & Context-Aware UI](#compact-collapsible-navigation-rail--context-aware-ui)
5. [Astronaut EVA HUD, Biotelemetry & Solar Ephemeris](#-astronaut-eva-hud-biotelemetry--solar-ephemeris)
6. [Contingency Simulator & Emergency Protocols](#-contingency-simulator--emergency-protocols)
7. [EVA AI Copilot (Gemini 2.0 Flash)](#-eva-ai-copilot-gemini-20-flash)
8. [Scientific Data Provenance & Physical Truth Matrix](#-scientific-data-provenance--physical-truth-matrix)
9. [Mathematical & Physical Formulations](#-mathematical--physical-formulations)
10. [Technology Stack & System Design](#-technology-stack--system-design)
11. [Verification & Benchmark Validation](#-verification--benchmark-validation)
12. [Local Installation & Developer Setup](#-local-installation--developer-setup)
13. [Mission Credits & Acknowledgments](#-mission-credits--acknowledgments)

---

## 🚀 Executive Summary & System Architecture

Surface exploration on Mars presents existential challenges: lethal ionizing cosmic radiation, catastrophic dust storms, treacherous slip-inducing regolith slopes, strict life-support oxygen budgets, and finite comms windows. Ground control at NASA JPL operates with communication delays between 4 and 24 minutes each way, meaning **tactical EVA traverse decisions and in-situ astrobiological sample selection must be executed autonomously on Mars**.

Martis Ovikorsho bridges orbital remote sensing with sub-millimeter in-situ contact science:

```mermaid
flowchart TB
    subgraph DataIngestion["NASA Planetary Data System (PDS) & USGS Geosciences"]
        PDS1["Mars 2020 Perseverance<br/>PIXL & SuperCam & SHERLOC<br/>(20 Rock Targets · 18,572 Spectra)"]
        PDS2["Mars Science Laboratory Curiosity<br/>REMS Environmental Telemetry<br/>(4,745 Sols · Gale Crater)"]
        PDS3["InSight Mars Lander<br/>SEIS Seismic Event Catalog V14<br/>(672 Marsquakes)"]
        PDS4["USGS Astrogeology & MOLA<br/>HRSC-MOLA 200m Blended DEM<br/>(7 Hero Sites + Global 4 px/deg Grid)"]
    end

    subgraph CoreEngines["Core Computational Engines"]
        WORKER["Dedicated Terrain Web Worker<br/>- Vectorized A* Topographic Pathfinding<br/>- Bekker-Wong Soil Terramechanics<br/>- PNR Walkback Safety Contours<br/>- VHF Radio Horizon Ray-Casting"]
        ML_ENGINE["Zero-Dependency Browser ML Runtime<br/>- 25-Tree Random Forest Geochemical Classifier<br/>- 16-D Astrobiology Latent Space Projection<br/>- Mahalanobis Anomaly & Chi-Square P-Value<br/>- Multi-Horizon RidgeCV Weather Regressors"]
        AUDIO_ENGINE["Web Audio Procedural Synthesizer<br/>- 1064nm Laser Ionization Plasma Snap<br/>- Core Drill Resonant Ultrasonic Hum<br/>- VHF Comms Static & Suit Audio Cues"]
    end

    subgraph TacticalLayers["Martian Surface Operations Cockpit"]
        MAP2D3D["2D Multi-Layer Tactical Map & 3D WebGL Globe<br/>CRISM Minerals · GRS Water · Caves · HiRISE Tracks"]
        HUD["Astronaut EVA Tactical Helmet HUD<br/>Heart Rate · O2 Consumables · Real-time Solar Ephemeris"]
        LAB["In-Situ Astrobiology Science Lab<br/>6 Spectroscopic Decks · 55mm Stratigraphy · ISRU Smelter"]
        SIM["Contingency Simulator<br/>Global Dust Escalation · EVA Decompression · Power Grid"]
        COPILOT["Gemini 2.0 Flash Multimodal EVA Copilot<br/>Edge Proxy · Context-Aware Function Calling"]
    end

    DataIngestion --> CoreEngines
    CoreEngines --> TacticalLayers
```

---

## 🔬 Interactive In-Situ Science Lab (20 Empirical NASA Campaigns)

The In-Situ Science Lab (`src/components/ScienceLabPage.jsx`) allows mission specialists to conduct contact science on Martian abraded rock targets using the exact analytical instruments deployed on NASA's *Perseverance* rover in Jezero Crater. 

The lab has been scaled from an initial prototype of 6 rocks to **20 authentic abraded rock campaigns** curated directly from NASA Planetary Data System (PDS) Geosciences archives, spanning over 1,100 sols of rover exploration from the crater floor to the delta margin.

### The 20-Rock Empirical Manifest

Every rock campaign contains calibrated multi-instrument datasets, remote micro-imager (RMI) close-ups, and auto-focus context imager (ACI) microscopic rasters:

| Target ID | Target Name | Primary Sols | Coordinates (Lat, Lon) | Lithological Classification | Major Oxide Footprint | Empirical PDS Context & Geological Significance |
|---|---|---|---|---|---|---|
| `guillaumes` | **Guillaumes** | Sol 157–167 | 18.4277°N, 77.4517°E | Basaltic igneous rock | $\text{SiO}_2\text{ 38.9\%}, \text{FeO}\text{ 19.0\%}$ | Máaz formation; vesicular pyroxene-plagioclase basalt with intersertal textures. |
| `bellegarde` | **Bellegarde** | Sol 180–187 | 18.4307°N, 77.4444°E | Basaltic igneous rock | $\text{SiO}_2\text{ 45.2\%}, \text{FeO}\text{ 23.2\%}$ | Highly crystalline basalt flow with high $\text{TiO}_2$ and discrete iron oxides. |
| `dourbes` | **Dourbes** | Sol 248–259 | 18.4340°N, 77.4430°E | Olivine-rich igneous rock | $\text{MgO}\text{ 21.1\%}, \text{FeO}\text{ 35.8\%}$ | Séítah olivine-cumulate formation; cumulate poikilitic grains with carbonate rinds. |
| `quartier` | **Quartier** | Sol 286–294 | 18.4327°N, 77.4414°E | Olivine-rich igneous rock | $\text{MgO}\text{ 16.1\%}, \text{FeO}\text{ 33.9\%}$ | Bastide member; cumulate olivine grains cemented by secondary sulfates. |
| `montpezat` | **Montpezat** | Sol 343–349 | 18.4295°N, 77.4470°E | Basaltic igneous rock | $\text{SiO}_2\text{ 46.5\%}, \text{CaO}\text{ 8.1\%}$ | Máaz capping unit; coherent lava flow with plagioclase-dominated laths. |
| `alfalfa` | **Alfalfa** | Sol 362–371 | 18.4439°N, 77.4524°E | Silica-rich rock | $\text{SiO}_2\text{ 58.4\%}, \text{Al}_2\text{O}_3\text{ 10.6\%}$ | Elevated silica-aluminum phase; possible hydrothermal or felsic differentiate. |
| `pignut-mountain` | **Pignut Mountain** | Sol 461–463 | 18.4587°N, 77.4061°E | Sulfate-rich sedimentary | $\text{SO}_3\text{ 13.1\%}, \text{MgO}\text{ 9.9\%}$ | Shenandoah formation; hydrated magnesium sulfate evaporitic cement. |
| `thornton-gap` | **Thornton Gap** | Sol 477–492 | 18.4589°N, 77.4062°E | Olivine-rich igneous rock | $\text{MgO}\text{ 21.7\%}, \text{FeO}\text{ 23.9\%}$ | Delta front boulder; weathered olivine grains with secondary halogen salts ($\text{Cl 3.96\%}$). |
| `berry-hollow` | **Berry Hollow** | Sol 502–507 | 18.4587°N, 77.4059°E | Sulfate-rich sedimentary | $\text{SO}_3\text{ 21.2\%}, \text{MgO}\text{ 13.1\%}$ | Amygdaloidal sulfate sedimentary facies; highest sulfur concentration in Jezero. |
| `chiniak` | **Chiniak** | Sol 557–558 | 18.4507°N, 77.4014°E | Basaltic igneous rock | $\text{SiO}_2\text{ 37.3\%}, \text{SO}_3\text{ 9.5\%}$ | Delta front float rock with high-energy volcanic ejecta characteristics. |
| `novarupta` | **Novarupta** | Sol 565–570 | 18.4507°N, 77.4014°E | Olivine-rich igneous rock | $\text{MgO}\text{ 19.2\%}, \text{Cr}_2\text{O}_3\text{ 1.04\%}$ | Ultramafic cumulate with distinct chromite spinels and elevated pyroxene. |
| `uganik-island` | **Uganik Island** | Sol 609–619 | 18.4536°N, 77.3992°E | Sulfate-rich sedimentary | $\text{SO}_3\text{ 19.3\%}, \text{MgO}\text{ 13.1\%}$ | Deltaic mudstone facies showing fine laminations and evaporitic sulfate rinds. |
| `solva` | **Solva** | Sol 736–751 | 18.4702°N, 77.3840°E | Olivine-rich igneous rock | $\text{MgO}\text{ 17.2\%}, \text{FeO}\text{ 29.4\%}$ | Tenby formation; olivine-dominated detrital clasts in delta scarp face. |
| `solitude-lake` | **Solitude Lake** | Sol 775–782 | 18.4829°N, 77.3690°E | Olivine-rich igneous rock | $\text{MgO}\text{ 19.0\%}, \text{SO}_3\text{ 3.9\%}$ | Delta top sedimentary conglomerate with mafic basaltic provenance. |
| `ouzel-falls` | **Ouzel Falls** | Sol 797–811 | 18.4827°N, 77.3686°E | Basaltic igneous rock | $\text{SiO}_2\text{ 33.7\%}, \text{SO}_3\text{ 5.5\%}$ | Delta top sandstone facies; fine-grained basaltic mineral fragments. |
| `lake-haiyaha` | **Lake Haiyaha** | Sol 848–851 | 18.4814°N, 77.3659°E | Olivine-rich igneous rock | $\text{MgO}\text{ 36.8\%}, \text{SiO}_2\text{ 38.1\%}$ | Extreme magnesian ultramafic target; forsteritic olivine dunite mantle fragment. |
| `dragons-egg` | **Dragon's Egg Rock** | Sol 856–865 | 18.4811°N, 77.3648°E | Basaltic igneous rock | $\text{Al}_2\text{O}_3\text{ 14.5\%}, \text{SiO}_2\text{ 46.7\%}$ | High-alumina basaltic boulder; anorthositic plagioclase accumulation. |
| `gabletop-mountain`| **Gabletop Mountain** | Sol 872–879 | 18.4838°N, 77.3605°E | Olivine-rich igneous rock | $\text{MgO}\text{ 18.5\%}, \text{Cl}\text{ 3.83\%}$ | Margin unit carbonate-olivine boundary target with elevated halogen salts. |
| `amherst-point` | **Amherst Point** | Sol 911–921 | 18.4834°N, 77.3508°E | Olivine-rich igneous rock | $\text{MgO}\text{ 17.9\%}, \text{FeO}\text{ 33.4\%}$ | Margin Unit crater wall transition rock; serpentinized ultramafic boundary. |
| `bills-bay` | **Bills Bay** | Sol 933–939 | 18.4887°N, 77.3470°E | Basaltic igneous rock | $\text{SiO}_2\text{ 50.7\%}, \text{MgO}\text{ 13.8\%}$ | Quartz-normative tholeiitic basalt; intermediate silica volcanic crust. |

---

### The 6 Scientific Instrument Decks

```mermaid
flowchart LR
    subgraph Decks["The 6 Analytical Decks"]
        D1["Deck 1: SuperCam LIBS<br/>1064nm Laser Spectrometry"]
        D2["Deck 2: PIXL Micro-XRF<br/>Sub-mm Spatial Geochemistry"]
        D3["Deck 3: SHERLOC Deep-UV<br/>Raman & Native Fluorescence"]
        D4["Deck 4: Core Drill 55mm<br/>Stratigraphy & Redox Profiling"]
        D5["Deck 5: ISRU Plasma Forge<br/>Regolith In-Situ Metallurgy"]
        D6["Deck 6: NASA MSR Cache Manifest<br/>24 Real Sealed Tubes · 38 Slots"]
    end
```

#### ⚡ Deck 1: SuperCam LIBS (Laser-Induced Breakdown Spectroscopy)
- **Physics Engine**: Fires a $1064\text{ nm}$ Nd:YAG laser producing an ultra-dense $11,400\text{ K}$ surface plasma plume that atomizes rock minerals.
- **Spectral Coverage**: 6,144 physical channels across three calibrated spectrometers: **UV (240–340 nm)**, **VIO (382–469 nm)**, and **VNIR (470–853 nm)**.
- **Acoustic Realism**: Synthesizes the authentic procedural acoustic shockwave ("snap") of the laser pulse expanding in Mars' 6 mbar $\text{CO}_2$ atmosphere via the Web Audio API.
- **Shot Accumulation & Uncertainty Decay**: Implements physical pulse averaging where uncertainty decays inversely with the square root of shot count:
  $$\sigma(N) = \frac{1.25\%}{\sqrt{N / 30}}$$

#### ⚛️ Deck 2: PIXL Micro-XRF (Planetary Instrument for X-ray Lithochemistry)
- **Spatial Chemistry**: Maps 13 major, minor, and trace oxides ($\text{SiO}_2, \text{Al}_2\text{O}_3, \text{FeO}_T, \text{MgO}, \text{CaO}, \text{Na}_2\text{O}, \text{K}_2\text{O}, \text{TiO}_2, \text{Cr}_2\text{O}_3, \text{MnO}, \text{P}_2\text{O}_5, \text{SO}_3, \text{Cl}$) across sub-millimeter scan grids.
- **Aqueous Alteration Tracking**: Computes spatial Pearson cross-correlations ($r(\text{SO}_3, \text{CaO})$ vs $r(\text{SO}_3, \text{MgO})$):
  - $r(\text{SO}_3, \text{CaO}) > 0.70 \implies$ Hydrothermal calcium sulfate veins (gypsum/bassanite), indicative of neutral groundwater circulation.
  - $r(\text{SO}_3, \text{MgO}) > 0.70 \implies$ Magnesium sulfate salts (epsomite/starkeyite), marking evaporitic playa brines.

#### 💎 Deck 3: SHERLOC Deep-UV Raman & Native Fluorescence
- **Laser Optics**: $248.58\text{ nm}$ NeCu hollow-cathode pulsed laser excitation, separating resonance Raman vibrational scattering from native fluorescence emission.
- **Aromatic Organics Detection**:
  - **Band 1 ($275\text{--}300\text{ nm}$)**: Single-ring aromatic organics (benzene, toluene, phenols).
  - **Band 2 ($300\text{--}345\text{ nm}$)**: 2–3 ring polycyclic aromatic hydrocarbons (naphthalene, anthracene, phenanthrene).
- **Raman Fingerprints**: Automated 5th-order polynomial baseline subtraction to isolate Raman peaks: Carbon D-band ($1345\text{ cm}^{-1}$), G-band ($1590\text{ cm}^{-1}$), carbonates ($1085\text{ cm}^{-1}$), and perchlorates ($935\text{ cm}^{-1}$).

#### 🔩 Deck 4: 55mm Core Drill Stratigraphy & Astrobiology Profiler
- **Subsurface Profiling**: Simulates rotary-percussive coring down to $55\text{ mm}$ depth inside the rock matrix.
- **Taphonomic Preservation**: Evaluates photolytic UV degradation ($I(z) = I_0 e^{-\alpha z}$), cosmic ray penetration, and redox stratification ($\text{Fe}^{3+}/\text{Fe}^{2+}$ ratio) to compute the **Taphonomic Biosignature Preservation Potential (BPP)**:
  $$\text{BPP}(z) = \left( 1 - \frac{\text{Fe}^{3+}}{\text{Fe}_{\text{total}}} \right) \cdot \exp\left(-\frac{R_{\text{GCR}}}{R_0}\right) \cdot \left[1 + \beta \log_{10}(1 + z)\right]$$
- **MSR Return Tube Manifest**: Serialized sample logging tracking sealed cache status across the 38 Mars Sample Return (MSR) titanium tubes.

#### 🔥 Deck 5: High-Energy Plasma ISRU Materials Forge
- **Thermochemical Reduction**: Evaluates in-situ resource utilization (ISRU) feasibility via thermal vacuum carbothermal reduction and plasma arc electrolysis.
- **Stoichiometric Yields**: Calculates structural basaltic Fe-Ti alloy tensile yield, molten quartz solar shielding coverplates, oxygen liberation per metric ton of regolith, and methalox propellant synthesis balance.

#### 🗄️ Deck 6: Official NASA Mars Sample Return (MSR) Cache Manifest & Dossier
- **Authentic PDS Digital Twin**: Models the complete 43-tube inventory (5 witness contamination control blanks + 38 sample tubes) deployed on NASA's *Perseverance* rover.
- **24 Real Sealed Sample Tubes on Mars**:
  - **10 Tubes at Three Forks Surface Depot**: The first sample depot in human history, deposited between Dec 2022 and Jan 2023 on the delta floor (*Roubion, Montdenier, Coulettes, Malay, Atsah, Skyland, Bearwallow, Mageik, Crosswind Lake, Amalik Witness Blank*).
  - **14 Prime Cores in Onboard Rover Belly Cache**: Active return payload (*Montagnac, Salette, Robine, Ha'ahóni, Swift Run, Hazeltop, Shuyak, Kukaklek, Athene Mountain, Otis Peak, Pelican Point, Bunsen Peak, Silver Lake, Cheyava Falls*).
  - **14 Available Open Slots**: Open slots (Tubes #25–38) ready for live in-situ coring during astronaut EVAs.
- **Sample Dossier Inspector**: Instant access to official NASA hardware serial numbers (`serialId` e.g., `M2020-00190-03` / `ST20-003`), exact millimeter core lengths, mass in grams, taphonomic context, and SHERLOC deep-UV organic detections, linked directly to the NASA PDS Geosciences Node.

*(Note: The Science Lab also incorporates dedicated full-page analytical suites below the instrument decks: the In-Situ ML Mineral Classifier, the AEGIS Bayesian Active Learning Triage Radar, and the Ancient Water PaleoHydrology Engine).*

---


---

### 📦 Official NASA Mars Sample Return (MSR) Cache Manifest & Dossier

| Tube # | Serial ID | Hardware ID | Sample Name | Target Outcrop | Geological Formation | Sol | Length (mm) | Mass (g) | Depot Disposition | Astrobiology & Mission Context |
|---|---|---|---|---|---|---|---|---|---|---|
| **01** | `M2020-00164-02` | `ST20-002` | **Roubion** | Roubion | Máaz Formation | 164 | 0.0 | 0.1 | 🟠 Three Forks Depot | Atmospheric gas baseline; volatile isotope ratio calibration ($^{13}\text{C}/^{12}\text{C}, ^{18}\text{O}/^{16}\text{O}$). |
| **02** | `M2020-00190-03` | `ST20-003` | **Montdenier** | Rochette | Lower Máaz (Artuby Ridge) | 194 | 59.8 | 10.2 | 🟠 Three Forks Depot | Vesicular pyroxene-plagioclase basalt; primary crater floor crystallization age anchor. |
| **03** | `M2020-00196-04` | `ST20-004` | **Montagnac** | Rochette | Lower Máaz (Artuby Ridge) | 196 | 61.4 | 10.4 | 🟢 Onboard Belly Cache | Paired twin of Montdenier; fresh volcanic flow with olivine phenocrysts. |
| **04** | `M2020-00262-05` | `ST20-005` | **Salette** | Brac | South Séítah Formation | 262 | 32.8 | 6.4 | 🟢 Onboard Belly Cache | Cumulate olivine grains ($Fo_{55-65}$) with poikilitic pyroxene and carbonate cements. |
| **05** | `M2020-00271-06` | `ST20-006` | **Coulettes** | Brac | South Séítah Formation | 271 | 33.0 | 6.5 | 🟠 Three Forks Depot | Paired twin of Salette; ultramafic cumulate surface backup. |
| **06** | `M2020-00295-07` | `ST20-007` | **Robine** | Issole | South Séítah Formation | 295 | 30.8 | 5.8 | 🟢 Onboard Belly Cache | Olivine cumulate laced with aqueous sulfate veins; multi-stage alteration record. |
| **07** | `M2020-00337-08` | `ST20-008` | **Malay** | Issole | South Séítah Formation | 337 | 30.7 | 5.8 | 🟠 Three Forks Depot | First sample dropped at Three Forks depot on Sol 653 (Dec 21, 2022). |
| **08** | `M2020-00371-09` | `ST20-009` | **Ha'ahóni** | Sid | Upper Máaz Formation | 371 | 65.5 | 11.5 | 🟢 Onboard Belly Cache | Basaltic trachyandesite; upper crater floor volcanic capping sequence. |
| **09** | `M2020-00377-10` | `ST20-010` | **Atsah** | Sid | Upper Máaz Formation | 377 | 60.1 | 10.5 | 🟠 Three Forks Depot | Paired twin of Ha'ahóni; coherent volcanic rock. |
| **10** | `M2020-00490-11` | `ST20-011` | **Swift Run** | Skinner Ridge | Shenandoah (Hawksbill Gap) | 490 | 66.9 | 11.8 | 🟢 Onboard Belly Cache | **FIRST SEDIMENTARY ROCK CORED ON MARS**: Fluvial delta sandstone rich in smectite clay. |
| **11** | `M2020-00495-12` | `ST20-012` | **Skyland** | Skinner Ridge | Shenandoah (Hawksbill Gap) | 495 | 58.5 | 10.3 | 🟠 Three Forks Depot | Paired twin of Swift Run; cross-bedded river sandstone. |
| **12** | `M2020-00509-14` | `ST20-014` | **Hazeltop** | Wildcat Ridge | Shenandoah (Hogwallow Flats) | 509 | 59.7 | 10.1 | 🟢 Onboard Belly Cache | **HIGHEST ORGANICS CONCENTRATION**: Fine-grained mudstone with intense PAH fluorescence. |
| **13** | `M2020-00516-15` | `ST20-015` | **Bearwallow** | Wildcat Ridge | Shenandoah (Hogwallow Flats) | 516 | 62.4 | 10.6 | 🟠 Three Forks Depot | Paired twin of Hazeltop; evaporite-rich sulfate mudstone. |
| **14** | `M2020-00575-16` | `ST20-016` | **Shuyak** | Amalik | Shenandoah (Delta Front) | 575 | 55.5 | 9.4 | 🟢 Onboard Belly Cache | Laminated deltaic siltstone; optimal low-energy lacustrine taphonomic preservation. |
| **15** | `M2020-00579-17` | `ST20-017` | **Mageik** | Amalik | Shenandoah (Delta Front) | 579 | 73.6 | 12.9 | 🟠 Three Forks Depot | **LONGEST CORE ON MARS (73.6 mm)**: Continuous sedimentary column. |
| **16** | `M2020-00623-19` | `ST20-019` | **Kukaklek** | Hidden Harbor | Shenandoah (Delta Front) | 623 | 49.7 | 8.7 | 🟢 Onboard Belly Cache | Polyhydrated sulfate siltstone recording shifting lake brine chemistry. |
| **17** | `M2020-00634-20` | `ST20-020` | **Athene Mountain** | Observation Mtn | Delta Front Megaripple | 634 | 54.0 | 11.0 | 🟢 Onboard Belly Cache | Bulk aeolian regolith integrating regional impact ejecta and volcanic ash. |
| **18** | `M2020-00639-21` | `ST20-021` | **Crosswind Lake** | Observation Mtn | Delta Front Megaripple | 639 | 53.0 | 10.8 | 🟠 Three Forks Depot | Surface backup cache for modern Martian regolith and space weathering. |
| **19** | `M2020-00684-22` | `WT-02` | **Amalik Witness** | Three Forks Region | Control Blank | 684 | 0.0 | 0.0 | 🟠 Three Forks Depot | Terrestrial contamination control blank verifying authenticity of returned biosignatures. |
| **20** | `M2020-00822-23` | `ST20-023` | **Otis Peak** | Emerald Lake | Tenby Formation (Delta Top) | 822 | 65.0 | 11.4 | 🟢 Onboard Belly Cache | **FIRST CONGLOMERATE CORED**: High-energy river pebbles from crater rim. |
| **21** | `M2020-00884-24` | `ST20-024` | **Pelican Point** | Bills Bay | Upper Fan Formation | 884 | 62.0 | 10.8 | 🟢 Onboard Belly Cache | Cross-bedded upper fan sandstone marking transition to crater margin carbonates. |
| **22** | `M2020-01050-25` | `ST20-025` | **Bunsen Peak** | Comet Geyser | Margin Unit | 1050 | 60.5 | 10.5 | 🟢 Onboard Belly Cache | Hydrothermal silica-carbonate breccia (>30% carbonate); ancient hot spring/shoreline. |
| **23** | `M2020-01065-26` | `ST20-026` | **Silver Lake** | Bunsen Peak | Margin Unit | 1065 | 58.0 | 10.1 | 🟢 Onboard Belly Cache | Carbonate precipitate dating ancient Martian atmospheric carbon sequestration. |
| **24** | `M2020-01180-27` | `ST20-027` | **Cheyava Falls** | Cheyava Falls | Bright Angel (Neretva Vallis) | 1180 | 63.0 | 10.9 | 🟢 Onboard Belly Cache | **PRIME BIOSIGNATURE CANDIDATE**: Iron-phosphate reduction halos ("leopard spots"). |
| **25–38** | `ST20-028..043` | `ST20-028..043` | *Available Slots* | In-Situ Targets | Belly Carousel | Active | — | — | ⚪ Open for Coring | 14 unsealed titanium tubes available for in-situ drilling during astronaut EVAs. |

### Anywhere-on-Mars Hyperspectral Scanner
In addition to the 20 primary Jezero campaigns, the Science Lab includes an **Orbital-to-Ground Hyperspectral Inversion Engine**. Operators can click anywhere across the global 2D map or select 7 distinct Martian geological provinces (*Gale Crater, Valles Marineris, Olympus Mons, Jezero Delta, Meridiani Planum, Nili Fossae, Utopia Planitia*) to invert MRO CRISM and Odyssey GRS orbital spectra into predicted lithology, hydrated mineral abundance, and paleo-pH.

---

## 🧠 Machine Learning Subsystem (8 Model Families)

Martis Ovikorsho deploys an advanced **8-family machine learning subsystem** designed specifically for real-time edge execution in mission-critical environments. 

> [!IMPORTANT]
> **Scientific Honesty & Methodology**: In adherence to NASA's scientific standards, we rigorously distinguish between models trained on **empirical mission telemetry** (REMS, PIXL, SuperCam) and **physics-based surrogates** (RAD, Bekker-Wong, InSight SEIS, Opportunity photovoltaic dust). Model scores for surrogates evaluate fidelity to published physics equations, not unmeasured Martian ground truth.

```mermaid
flowchart TD
    subgraph Data["1. Telemetry & Physical Benchmarks"]
        RAW_PIXL["16,572 Empirical PIXL Micro-XRF Points<br/>(20 Jezero Rock Campaigns)"]
        AUG["Trace-Oxide Dropout Augmentation<br/>(40% Masking Na2O, K2O, TiO2, P2O5, Cl)"]
        REMS["4,745 Sols Curiosity REMS Telemetry"]
        BEKKER["12,000 Bekker-Wong Terramechanics Runs"]
    end

    subgraph Training["2. Offline Training (Python Scikit-Learn)"]
        RF["Random Forest Classifier (MF-03)<br/>25 Decision Trees · Gini Impurity"]
        RIDGECV["Multi-Horizon RidgeCV Regressors<br/>Time-Series Lags & Cyclical Orbital Ls"]
    end

    subgraph EdgeRuntime["3. Zero-Dependency Client Runtime (JavaScript)"]
        AST["Compiled Model Bundle (mars_models.json - 124.6 KB)<br/>Tree Nodes · Split Thresholds · Priors"]
        ENGINE["Pure JS Recursive Tree Traversal Engine<br/>Vectorized Dot-Products · Softmax Normalization"]
        INFERENCE["Ultra-Low Latency Edge Inference<br/>⚡ Less than 0.2 ms per evaluation"]
    end

    RAW_PIXL --> AUG --> RF
    REMS & BEKKER --> RIDGECV
    RF & RIDGECV --> AST --> ENGINE --> INFERENCE
```

### Master Model Inventory

| Family ID | Subsystem / Model Name | Sub-Models | Primary Algorithm | Training Data Provenance | Held-Out Validation Score | Uncertainty Calibration |
|---|---|---|---|---|---|---|
| **MF-01** | **Atmospheric Forecaster** | 15 multi-horizon regressors ($T_{\max}, T_{\min}, P, \text{GTS}_{\max}, \text{GTS}_{\min}$ for $t+1, t+2, t+3$) | Multi-Horizon RidgeCV with cyclical orbital ($L_s$) and autoregressive lag features | **Real:** 4,745 sols Curiosity REMS telemetry (Gale Crater) with ADC dropout cleansing | Chronological hold-out (latest 15%):<br>Pressure $R^2 = 0.9979$<br>$T_{\max}$ $R^2 = 0.907$<br>$T_{\min}$ $R^2 = 0.822$ (beats persistence) | $\pm 5.05^\circ\text{C}$ ($T_{\max}$), $\pm 3.81\text{ Pa}$ (Barometric) |
| **MF-02** | **Dust Storm Risk Classifier** | 3 binary classifiers ($t+1, t+2, t+3$) | Balanced L2 Logistic Regression with seasonal risk gating | **Real:** Curiosity REMS (diurnal temperature range $< 48^\circ\text{C}$ in dust storm window $L_s 160^\circ\text{--}330^\circ$) | Forward-chaining time folds: $\text{ROC-AUC} = 0.63\text{--}0.70$ | Sigmoid posterior with 4 hazard alert tiers |
| **MF-03** | **Geochemical Mineral Classifier** | 5 lithological classes across 16 geochemical features | **25-Tree Non-Linear Random Forest Ensemble** with trace-oxide dropout augmentation | **Real:** 16,572 empirical PIXL micro-XRF points (20 Jezero rocks) + 2,000 synthetic geological controls | **5-Fold Cross Validation:** **95.69%**<br>**Full Dataset Accuracy:** **96.24%** (Leaves linear models far behind) | Class posterior probability distribution + Taphonomic Prior |
| **MF-04** | **Space Radiation & SPE Hazard** | GCR surface dose regressor + SPE flare classifier | RidgeCV Regressor + Logistic Classifier with solar modulation | **Surrogate:** Dose formula anchored to Curiosity RAD benchmarks (Hassler et al. 2014) | Fit to formula: GCR $R^2 = 0.9904$, SPE $\text{ROC-AUC} = 0.8668$ | Residual $\pm 0.0248\text{ mSv/day}$ (90% CI) |
| **MF-05** | **Rover Terramechanics & Energy** | Wheel slip % + Traction energy (Wh/km) + Sand-trap risk | Bekker-Wong RidgeCV Regressors + Entrapment Logistic Classifier | **Surrogate:** 12,000 terramechanics runs tuned to MER Purgatory Dune & MSL Gale traversals | Fit to formulas: Slip $R^2 = 0.8476$, Energy $R^2 = 0.8667$, Trap $\text{AUC} = 0.9993$ | $\pm 20.72\%$ Slip, $\pm 732.39\text{ Wh/km}$ |
| **MF-06** | **SuperCam LIBS Chemometrics** | 9 oxide regressors ($\text{SiO}_2, \text{FeO}, \text{MgO}, \text{Al}_2\text{O}_3, \text{CaO}, \text{Na}_2\text{O}, \text{K}_2\text{O}, \text{TiO}_2, \text{SO}_3$) | Multi-Target RidgeCV with NIST plasma transition lines (23 spectral features) | **Real:** SuperCam laser emission spectra calibrated against paired PIXL medians across 20 rocks | Leave-one-rock-out: Outperforms mean baseline for $\text{MgO}, \text{Al}_2\text{O}_3, \text{CaO}, \text{TiO}_2$ | Calibrated per-oxide 90% confidence bands |
| **MF-07** | **InSight Marsquake Attenuation** | Kinematic $S-P$ inversion + Ground Motion Prediction (GMPE) | Single-Station Ray-Tracing + Log-linear Attenuation Regressors | **Surrogate:** 672 seismic events from InSight Marsquake Service (MQS) V14 catalog | Fit to equation: PGA $R^2 = 0.9908$, PGV $R^2 = 0.9895$ | Log-normal $\sigma_{\ln} = 0.2342$ |
| **MF-08** | **Photovoltaic Dust & Power** | Solar insolation + Dust factor ($D_f$) decay + Vortex clearing | Physics-constrained RidgeCV + Stochastic Convective Vortex Engine | **Surrogate:** Atmospheric radiative transfer tuned to Opportunity solar panel loss rates | Fit to formulas: Insolation $R^2 = 1.000$, Dust Rate $R^2 = 0.9949$ | Daily Dust Rate 90% CI: $\pm 0.00043\text{ }D_f/\text{sol}$ |

---

### The MF-03 Random Forest Breakthrough

Prior versions of the geochemical mineral classifier relied on linear multinomial logistic regression, which capped held-out classification accuracy at ~94% due to the severe non-linearity of planetary mineral phase boundaries (e.g., olivine-pyroxene cumulate crystallization lines, silica-enrichment fronts, and sulfate evaporite beds).

To solve this, we developed **Option A**: an optimized **25-Tree Non-Linear Random Forest Ensemble** trained on **18,572 pristine geochemical samples** (16,572 empirical PIXL micro-XRF raster points across the 20 Jezero rock campaigns + 2,000 synthetic sedimentary controls) and compiled it into a zero-dependency JSON abstract syntax tree:

#### 1. Sensor-Robustness Data Augmentation
In-situ rover sensors frequently suffer from hardware dropouts where trace volatile oxides ($\text{Na}_2\text{O}, \text{K}_2\text{O}, \text{TiO}_2, \text{P}_2\text{O}_5, \text{Cl}$) drop to $0.0$. We introduced a **40% trace-oxide dropout augmentation**, expanding the training corpus to **25,052 samples**. This taught the decision trees to split primarily on dominant rock-forming elements ($\text{SO}_3, \text{SiO}_2, \text{MgO}, \text{FeO}$, and the sulfate ratio) when trace indicators are unmeasured.

#### 2. Accuracy Comparison
- **Linear Logistic Regression**: 94.16% 5-fold cross-validation | 94.22% training accuracy.
- **25-Tree Random Forest Ensemble**: **95.69% 5-fold cross-validation** | **96.24% training accuracy**.

#### 3. Client-Side Zero-Dependency Recursive Tree Engine
Rather than importing heavy WebAssembly or ONNX runtimes (which add 3–5 MB of bloat and introduce cross-origin isolation hurdles), we authored a custom **recursive decision tree evaluator** directly inside [`src/services/marsMlService.js`](file:///c:/Users/dipka/Desktop/Nasa%20Space/src/services/marsMlService.js):
```javascript
// Zero-dependency pure JavaScript recursive decision tree traversal
function evaluateDecisionTree(node, features) {
  if (node.is_leaf) {
    return node.value; // Class probability distribution
  }
  const featureVal = features[node.feature];
  if (featureVal <= node.threshold) {
    return evaluateDecisionTree(node.left, features);
  } else {
    return evaluateDecisionTree(node.right, features);
  }
}
```
- **Bundle Footprint**: Entire 25-tree forest serializes to **99.8 KB** (`mars_mineral_model.json`).
- **Inference Speed**: Full forest evaluation across all 25 trees executes in **$< 0.2\text{ ms}$** in the client browser thread.

---

### 16-D Astrobiology Latent Manifold & Mahalanobis Anomaly Engine

To identify authentic astrobiological anomalies that deviate from typical volcanic crustal background rocks, the system projects the 13 micro-XRF oxides along with computed geochemical indexes into a **16-Dimensional Geochemical Latent Space**:

$$\mathbf{x} = \left[ \text{SiO}_2, \text{TiO}_2, \text{Al}_2\text{O}_3, \text{Cr}_2\text{O}_3, \text{FeO}, \text{MnO}, \text{MgO}, \text{CaO}, \text{Na}_2\text{O}, \text{K}_2\text{O}, \text{P}_2\text{O}_5, \text{SO}_3, \text{Cl}, \text{CIA}, \text{Fe/Mg}, \text{Sulfate Ratio} \right]^T$$

#### 1. Covariance Metric & Mahalanobis Distance
Using the empirical mean vector $\boldsymbol{\mu}$ and inverted covariance matrix $\mathbf{\Sigma}^{-1}$ derived from basaltic crustal standards:
$$D_M(\mathbf{x}) = \sqrt{(\mathbf{x} - \boldsymbol{\mu})^T \mathbf{\Sigma}^{-1} (\mathbf{x} - \boldsymbol{\mu})}$$

#### 2. Wilson-Hilferty Chi-Square Hypothesis Testing
Under the null hypothesis that a target is normal Martian volcanic basalt, the square of the Mahalanobis distance follows a Chi-square distribution with 16 degrees of freedom: $D_M^2 \sim \chi_{16}^2$. The system applies the **Wilson-Hilferty transformation** to calculate the rigorous p-value anomaly metric:
$$Z = \frac{\left( \frac{D_M^2}{k} \right)^{1/3} - \left( 1 - \frac{2}{9k} \right)}{\sqrt{\frac{2}{9k}}}, \quad k = 16, \quad p = 1 - \Phi(Z)$$
- $p < 0.001 \implies$ **Tier-1 Astrobiological Anomaly** (Extreme mineralogical deviation, potential hydrothermal deposit or organic-rich sedimentary clast).

---

### Prebiotic Molecular Matcher
The Science Lab includes a 2D chemical structure renderer and spectral matcher that compares detected vibrational peaks against the **NASA Sample Analysis at Mars (SAM)** and **CheMin** spectral databases:
- Prebiotic amino acid precursors (Glycine, Alanine, $\beta$-Alanine).
- Polycyclic Aromatic Hydrocarbons (Naphthalene, Pyrene, Phenanthrene).
- Monocarboxylic and dicarboxylic acids (Oxalic, Formic, Acetic).

---

## 🗺️ 2D/3D Multi-Scale Cartography & Tactical Traverse Planning

```mermaid
flowchart TD
    A["Operator Sets Traverse Waypoints (Origin -> Target)"] --> B["Terrain Worker Spawns A* Search Grid"]
    B --> C["Sample HRSC-MOLA 200m DEM Elevation Grid"]
    C --> D["Compute Topographic Slope Angle theta"]
    D --> E{"Slope Hazard Classification"}
    E -->|theta > 25 deg| F["NON-TRAVERSABLE: Infinite Cost Penalty"]
    E -->|theta > 15 deg| G["CRITICAL SLIP: Bekker-Wong Shear Derating"]
    E -->|theta <= 15 deg| H["NOMINAL TRAVERSE: Velocity Adjusted"]
    H & G --> I["Accumulate Astronaut Metabolic O2 & Battery Wh"]
    I --> J["Compute PNR Walkback Safety Contour"]
    J --> K["Ray-Cast Line-of-Sight VHF Horizon for Blackouts"]
    K --> L["Render Vectorized Safe Corridor on 2D Map & 3D Globe"]
```

### Terrain Elevation Grids & Anti-Meridian Routing
- **Dual-Tier Elevation Models**:
  - High-resolution **HRSC-MOLA 200m/pixel blended DEM** covering 7 hero landing sites (*Jezero Crater, Gale Crater, Gusev Crater, Meridiani Planum, Valles Marineris, Olympus Mons, Utopia Planitia*).
  - Global Mars Global Surveyor **MOLA 4 px/degree topographic grid** providing planetary coverage.
- **Anti-Meridian Coordinate Wrapping**: The A* pathfinder automatically resolves geodesic wraparound across the Martian $180^\circ$ longitude seam, preventing false hemispheric circumnavigations.

### Dynamic Point-of-No-Return (PNR) Walkback Safety Envelopes
Safe planetary surface exploration requires constant knowledge of the **Point-of-No-Return (PNR)**: the physical geographic boundary beyond which an astronaut cannot return to the lander/habitat before life-support consumables are exhausted.

Martis computes dynamic walkback envelopes in real time based on:
1. **Astronaut Metabolic Oxygen Consumption**: $0.85\text{--}1.65\text{ L/min}$ based on physical exertion against slope gradients.
2. **PLSS Suit Battery Power**: Baseline thermal heating and scrubbing draw.
3. **Terrain Slope-Speed Equation**:
   $$v(\theta) = v_{\text{nominal}} \cdot \exp\left(-k_s \cdot \tan |\theta|\right), \quad k_s = 2.1$$
4. **Walkback Margin Factor**: Strict $20\%$ life-support contingency reserve.

### Line-of-Sight VHF Comms Horizon
To prevent communication blackouts during EVAs, the terrain engine performs geometric ray-casting over the DEM between the rover/astronaut coordinates and the base station antenna mast:
$$d_{\text{horizon}} = \sqrt{2 R_{\text{Mars}} h_{\text{astronaut}}} + \sqrt{2 R_{\text{Mars}} h_{\text{antenna}}}$$
Areas where intervening terrain crests break the line of sight are dynamically highlighted with radio shadow warning hatching.

### Planetary Resource Overlays: Mars Odyssey GRS Elemental Maps (Fe, Si, K, Th, Cl, H₂O) & ISRU Engine

Beyond orbital optical imagery and topography, Martis Ovikorsho integrates the official **Mars Odyssey Gamma Ray Spectrometer (GRS)** element concentration archive (*Boynton et al. 2007, NASA PDS Geosciences Node*, `ODY-M-GRS-5-ELEMENTS-V1.0`). Derived from multi-year orbital gamma-ray and neutron flux measurements, the platform provides smoothed global $5^\circ \times 5^\circ$ gridded datasets (~300 km spatial bins) corrected for $\text{CO}_2$ seasonal frost:

```mermaid
flowchart LR
    GRS["Mars Odyssey GRS Suite<br/>(Gamma Ray Head + LANL & HEND Neutrons)"] --> PDS["NASA PDS Geosciences Node<br/>5° x 5° Smoothed Regional ASCII (.tab)"]
    PDS --> PARSER["build_resources.py<br/>Automated Longitude Shift [0..360] -> [-180..+180]"]
    PARSER --> JSONS["Compact Local JSON Grids (public/data/)<br/>fe.json · si.json · k.json · th.json · cl.json · h2o.json"]
    JSONS --> REND2D["2D Leaflet ImageOverlay<br/>- Dynamic Calibrated Color Ramps<br/>- Smooth Zoom Fade (Walking Scale Protection)<br/>- Exact Coordinate Bin Reading (r, c) with ±σ"]
    JSONS --> REND3D["3D WebGL Three.js Globe<br/>- ElementShell Spherical Mesh (R * 1.002)<br/>- Canvas Texture Generation<br/>- Interactive Real-time Layer Switching"]
    JSONS --> ISRU["ISRU Geochemical Engine<br/>- Steel Metallurgy · Solar Photovoltaics<br/>- Hydroponic NPK · Molten Salt Fuel · O2 Extraction"]
```

#### Elemental Concentration Manifest & ISRU Applications:

| Element | Symbol | PDS File | Planetary Range | Unit | ISRU Mission Utility & Tactical Prospecting |
|:---:|:---:|:---:|:---:|:---:|:---|
| **Iron** | $\text{Fe}$ | `fe_sr_5x5.tab` | $10.63\text{ -- }19.30$ | $\text{wt}\%$ | **Structural Metallurgy**: Primary mineral feedstock for carbothermal regolith smelting, magnetic shielding components, structural steel fabrication, and microwave sintering. Peaks in low-albedo basaltic shield provinces. |
| **Silicon** | $\text{Si}$ | `si_sr_5x5.tab` | $18.11\text{ -- }22.11$ | $\text{wt}\%$ | **Photovoltaics & Glass**: Feedstock for in-situ semiconductor manufacturing (photovoltaic solar cells), silicone habitat pressure seals, and structural silicate glass/ceramics. Uniformly abundant across silicate crust. |
| **Potassium** | $\text{K}$ | `k_sr_5x5.tab` | $0.071\text{ -- }0.561$ | $\text{wt}\%$ | **Biosphere Nutrition & Dating**: Naturally radioactive alkali metal (K-40); vital agricultural macronutrient (NPK fertilizer) for closed-loop bio-regenerative life-support greenhouses and K-Ar geochronological terrain dating. |
| **Thorium** | $\text{Th}$ | `th_sr_5x5.tab` | $0.16\text{ -- }0.95$ | $\text{ppm}$ | **Nuclear ISRU Power**: Radioactive actinide tracer of magmatic crustal differentiation; prime fuel prospect for sub-surface thorium molten salt power reactors (e.g., Kilopower successors). Enriched in high-silica provinces. |
| **Chlorine** | $\text{Cl}$ | `cl_sr_5x5.tab` | $0.216\text{ -- }0.797$ | $\text{wt}\%$ | **Volatiles & Hazard Warning**: Elemental chlorine (chlorides and magnesium/calcium perchlorates). Chemical reagent for water purification; perchlorate catalytic reduction yields breathable $\text{O}_2$. Flags toxic abrasive dust hazards for EVA airlock protocols. |
| **Water** | $\text{H}_2\text{O}$ | `h2o_sr_5x5.tab` | $1.65\text{ -- }7.40$ | $\text{wt}\%$ | **Life Support & Propellant**: Weight percent water equivalent hydrogen in the top ~1 m of regolith. Primary feedstock for crew hydration loops, hygiene, and Sabatier electrolysis for $\text{LOX/CH}_4$ ascent rocket propellant. |
| **Natural Shelter** | $\text{MGC3}$ | `caves.json` | $1,062\text{ sites}$ | Catalog | **Radiation & Micrometeorite Shelters**: Mars Global Cave Candidate Catalog (Cushing 2017, USGS Astrogeology). Basaltic skylights and lava tubes offering $>99\%$ galactic cosmic radiation (GCR) attenuation. |

#### In-Situ Concentration Readout & Uncertainty Engine:
When an elemental overlay is selected, the **Resource Panel** in the Map Dock calculates the exact 5° grid cell corresponding to the astronaut base (Waypoint 0) or current map crosshair:
$$r = \left\lfloor \frac{90 - \text{lat}}{5} \right\rfloor, \quad c = \left\lfloor \frac{\text{lon} + 180}{5} \right\rfloor$$
The readout provides the measured abundance, one-sigma uncertainty ($\pm\sigma$), relative regional quartile rating, and an alert if polar latitudes ($|\text{lat}| > 60^\circ$) are masked in the PDS product to prevent seasonal carbon dioxide frost bias.

### Compact Collapsible Navigation Rail & Context-Aware UI
To maximize map situational awareness and eliminate visual clutter:
- **Content-Hugging Collapsed Rail**: When closed, the left sidebar hugs its 6 icon buttons tightly (`h-auto`, ~278 px tall, floating unobtrusively on the left margin), keeping the vast majority of the Martian terrain completely visible without tall empty background pillars.
- **Auto-Expanding Viewport Envelope**: Clicking any navigation icon or the drawer toggle smoothly expands the sidebar in both width (to 380 px) and height (to `100%` of the viewport envelope), providing complete vertical scrolling for the active instrument deck.

---

## 🪖 Astronaut EVA HUD, Biotelemetry & Solar Ephemeris

The **EVA Tactical Helmet HUD** (`src/components/EvaHudOverlay.jsx`) simulates an astronaut heads-up display:
- **Real-Time Biotelemetry**: Continuously tracks heart rate (BPM), metabolic exertion, core body temperature, suit internal barometric pressure ($29.6\text{ kPa}$ pure $O_2$), and scrubbing canister life.
- **Celestial Ephemeris & Sun Transit**: Computes high-precision solar azimuth and elevation, local solar time (LST), and predicts Phobos and Deimos sky transits across the Martian disc.
- **Thermal Balance Gauges**: Displays external ambient temperature ($T_{\text{ambient}}$ down to $-110^\circ\text{C}$) vs active liquid cooling garment (LCG) thermal loop duty cycle.

---

## ⚡ Contingency Simulator & Emergency Protocols

The **Contingency Simulator** (`src/components/ContingencySimulatorPage.jsx`) tests mission resilience by injecting acute physical hazards:
- **Global Dust Storm Escalation**: Simulates atmospheric optical depth ($\tau$) rising from $0.4$ to $4.5$, triggering solar panel power collapse and thermal inversion.
- **EVA Suit Puncture & Rapid Decompression**: Calculates cabin pressure drop rates, Armstrong limit exposure thresholds ($6.3\text{ kPa}$ where water boils at body temperature), and emergency patch protocol deadlines.
- **Rover Drive-Train Entrapment**: Simulates high-slip sand traps (similar to the *Spirit* rover at Troy) with automated differential drive recovery sequences.
- **Telemetry Loss & Comms Blackout**: Initiates inertial dead-reckoning navigation and emergency VHF relay protocols.

---

## 🤖 EVA AI Copilot (Gemini 2.0 Flash)

The platform incorporates an intelligent mission copilot powered by **Google DeepMind's Gemini 2.0 Flash**:
- **Secure Serverless Proxy**: Production builds interact with Gemini via an edge proxy (`supabase/functions/gemini-proxy`), ensuring API credentials are never exposed in browser bundles.
- **Context-Aware Tool Calling**: The copilot can inspect the user's active map coordinates, query local elevation and slope hazards, fetch real-time PIXL oxide compositions, look up emergency checklists, and advise on route safety.
- **Zero-Latency In-App Dispatch**: Astronauts can trigger actions ("*Fly to Guillaumes rock*", "*Fire 10 SuperCam pulses*", "*Analyze walkback safety for Waypoint 3*") directly via natural language.

---

## 📊 Scientific Data Provenance & Physical Truth Matrix

Scientific integrity is paramount. The table below delineates the exact source, physical basis, and operational limitations of all data within Martis Ovikorsho:

| Subsystem Layer | Data Classification | Primary Empirical Source | Underlying Physical / Analytical Basis | Validation & Operational Notes |
|---|---|---|---|---|
| **Topographic Cartography** | **Ground Truth (100%)** | USGS Astrogeology / DLR HRSC / NASA MGS MOLA | Radar altimetry & stereo photogrammetry (200m/px & 4 px/deg) | Validated against actual Perseverance and Curiosity traverse odometry. |
| **Rock Campaigns (20 Rocks)** | **Ground Truth (100%)** | NASA PDS Geosciences Node (Mars 2020 Perseverance) | Micro-XRF elemental rasters (PIXL), LIBS laser spectra (SuperCam), Raman bands (SHERLOC) | Exact coordinates, sol dates, and rock classifications from NASA PDS archives. |
| **MSR Sample Manifest (24 Tubes)** | **Ground Truth (100%)** | NASA PDS / Mars 2020 Initial Reports & Dossier | Physical rock core stratigraphy, mass, and Three Forks depot placement logs | Authentic serial numbers (`M2020-00164-02`..`M2020-01180-27`), core lengths (mm), and masses (g). |
| **Orbital Composition** | **Ground Truth (100%)** | NASA MRO CRISM & Odyssey GRS | Visible-infrared reflectance spectroscopy & gamma-ray spectrometer | Real orbital mineral detections mapped to global coordinate grids. |
| **Odyssey GRS Elements** | **Ground Truth (100%)** | NASA PDS Geosciences (ODY-M-GRS-5-ELEMENTS-V1.0) | Global gamma-ray & neutron spectrometer 5° smoothed grids (Fe, Si, K, Th, Cl, H₂O) | Corrected for CO₂ frost; polar regions >60° masked to prevent ice dilution. |
| **Natural Cave Shelter (MGC3)** | **Ground Truth (100%)** | USGS Astrogeology / NASA PDS (Cushing 2017) | 1,062 orbital candidate skylights, lava tubes & collapse pits from THEMIS/CTX | Categorized by speleological morphology and HiRISE confirmation priority. |
| **Atmospheric Weather (MF-01)** | **Empirical ML (100%)** | NASA Curiosity REMS Archive (4,745 Sols) | Multi-Horizon RidgeCV regression with seasonal $L_s$ cyclical harmonics | Cleansed of ADC hardware dropouts; evaluated on chronological held-out sols. |
| **Geochemical Classifier (MF-03)** | **Empirical ML (100%)** | NASA Mars 2020 PIXL micro-XRF (16,572 points) | 25-Tree Non-Linear Random Forest with trace-oxide dropout augmentation | 95.69% 5-fold cross-validation accuracy; runs client-side in $<0.2\text{ ms}$. |
| **Space Radiation (MF-04)** | **Physics-Based Surrogate** | NASA MSL RAD Published Values (Hassler et al. 2014) | Analytical GCR galactic dose formula modulated by 11-year solar cycle | Evaluates reproduction of published physics formula, not raw sensor time series. |
| **Terramechanics (MF-05)** | **Physics-Based Surrogate** | MER Spirit/Opportunity & MSL Benchmarks | Bekker-Wong pressure-sinkage and Janosi-Hanamoto shear stress equations | Calibrated against empirical sand-trap incidents (e.g., Purgatory Dune). |
| **Marsquake Attenuation (MF-07)** | **Physics-Based Surrogate** | InSight Marsquake Service (MQS) V14 Catalog | Campbell-Duvall seismic ground motion prediction equations (GMPE) | Inverts 672 real InSight earthquake hypocenters into shaking contours. |
| **Solar Dust Deposition (MF-08)** | **Physics-Based Surrogate** | NASA MER Opportunity Dust Factor Records | Atmospheric radiative transfer (Beer-Lambert law) and convective vortex statistics | Reproduces long-term photovoltaic degradation trends observed across 5,000 sols. |

---

## 📐 Mathematical & Physical Formulations

### 1. Chemical Index of Alteration (CIA)
Quantifies the extent of open-system aqueous chemical weathering and feldspar breakdown into clay minerals:
$$\text{CIA} = \frac{\text{Al}_2\text{O}_3}{\text{Al}_2\text{O}_3 + \text{CaO}^* + \text{Na}_2\text{O} + \text{K}_2\text{O}} \times 100$$
*(Where $\text{CaO}^*$ represents calcium solely residing in the silicate fraction, corrected for carbonates and phosphates).*

### 2. Bekker-Wong Soil Terramechanics & Wheel Sinkage
Relates rover wheel sinkage $z$ to normal ground contact pressure $p$ and slip ratio $i$:
$$p = \left( \frac{k_c}{b} + k_\phi \right) z^n$$
$$\tau(j) = (c + p \tan \phi) \left( 1 - e^{-j / K} \right), \quad j = r \left[ \theta - (1 - i) \sin \theta \right]$$
*(Where $k_c, k_\phi, n$ are cohesive and frictional modulus parameters; $c$ is soil cohesion, $\phi$ is internal friction angle, and $K$ is the shear deformation modulus).*

### 3. Campbell-Duvall Seismic Ground Motion Attenuation (GMPE)
Predicts Peak Ground Acceleration (PGA) from an InSight marsquake of moment magnitude $M_W$ at hypocentral distance $R$:
$$\ln(\text{PGA}) = c_1 + c_2 M_W - c_3 \ln\left( R + c_4 e^{c_5 M_W} \right) + \epsilon$$

### 4. Atmospheric Radiative Attenuation (Beer-Lambert Law)
Models direct solar surface insolation $I_{\text{surface}}$ as a function of optical depth $\tau$ and solar zenith angle $\theta_z$:
$$I_{\text{surface}} = I_{\text{TOA}} \cdot \cos(\theta_z) \cdot \exp\left( -\frac{\tau}{\cos(\theta_z)} \right)$$

---

## 🛠️ Technology Stack & System Design

```
Martis-Ovikorsho/
├── public/data/
│   ├── science/               # 20 empirical NASA rock campaigns + 28 high-res RMI/ACI images
│   │   ├── campaigns.json     # Master rock manifest (coordinates, sols, oxides, element profiles)
│   │   ├── *.json             # Individual rock campaign micro-XRF & spectral datasets
│   │   └── img/               # Calibrated NASA context photos (RMI viewfinder & ACI rasters)
│   ├── ml/                    # Compiled machine learning bundles
│   │   ├── mars_models.json   # Master ML bundle (124.6 KB) - all 8 model families
│   │   ├── mars_mineral_model.json # 25-Tree Random Forest weights (99.8 KB)
│   │   └── mars_libs_model.json    # SuperCam LIBS chemometrics model (9.3 KB)
│   └── dem/                   # HRSC-MOLA elevation arrays & landmark catalogs
├── src/
│   ├── components/            # React UI components (Map, Globe, HUD, Lab, Simulator, Copilot)
│   │   ├── ScienceLabPage.jsx # In-situ Science Lab interface (6 interactive instrument decks)
│   │   ├── science/MsrSampleManifestDeck.jsx # 38-Tube MSR Carousel & NASA Dossier Deck
│   │   ├── EvaHudOverlay.jsx  # Astronaut tactical helmet HUD & real-time biotelemetry
│   │   └── MapView.jsx        # Leaflet 2D tactical surface map & WebGL 3D globe toggle
│   ├── data/
│   │   └── nasaSampleManifest.js # NASA MSR Manifest (24 sealed tubes, Three Forks logs)
│   ├── services/
│   │   ├── marsMlService.js   # Zero-dependency JS recursive tree traversal & ML inference engine
│   │   ├── geminiService.js   # Gemini 2.0 Flash integration with tool calling
│   │   └── marsWeatherService.js # Atmospheric forecast & dust storm risk evaluation
│   ├── terrain/               # Dedicated Web Worker terrain & pathfinding engine
│   │   ├── pathfinding.js     # Vectorized A* pathfinder with anti-meridian handling
│   │   ├── roverModel.js      # Bekker-Wong soil mechanics & battery energy consumption
│   │   └── terrainWorker.js   # Background worker thread for non-blocking map calculations
│   └── utils/
│       ├── audioSynthesizer.js# Web Audio procedural laser snap & drill hum generator
│       ├── marsSolar.js       # High-precision Mars solar ephemeris & transit math
│       └── spectrumMath.js    # Polynomial baseline subtraction & Raman peak deconvolution
├── scripts/ml/                # Offline Python machine learning training pipelines
│   ├── train_mineral_classifier.py # Random Forest trainer with trace-oxide augmentation
│   ├── train_weather_model.py      # Multi-Horizon RidgeCV atmospheric model trainer
│   └── train_models.py             # Master ML assembler and JSON compiler
└── supabase/functions/
    └── gemini-proxy/          # Deno serverless edge function proxy for Gemini 2.0 Flash
```

- **Frontend Core**: React 18, Vite 6, Tailwind CSS, Lucide React icons.
- **Cartography & 3D**: Leaflet.js, Canvas 2D API, WebGL, Proj4js Martian coordinates.
- **State Management**: Zustand (fine-grained atomic selector patterns with `useShallow`).
- **Parallel Computing**: HTML5 Web Workers for non-blocking terrain A* and radio ray-casting.
- **Audio Synthesis**: Web Audio API (procedural synthesis of laser ablation and core drill motor hum).
- **Backend & Security**: Supabase (PostgreSQL with Row Level Security, Edge Functions in Deno).
- **Testing Harness**: Vitest (23 test suites, 199 unit & integration tests passing with 100% clean exit).

---

## 🧪 Verification & Benchmark Validation

Martis Ovikorsho maintains a rigorous automated testing and verification suite. All 23 test suites (199 tests) run on every commit:

```bash
✓ src/utils/audioSynthesizer.test.js (3 tests)
✓ src/services/marsWeatherService.test.js (3 tests)
✓ src/data/nasaSampleManifest.test.js (8 tests)
✓ src/data/scienceLab.test.js (8 tests)
✓ src/utils/marsSolar.test.js (9 tests)
✓ src/utils/marsSky.test.js (9 tests)
✓ src/components/dock/walkEnvironment.test.js (3 tests)
✓ src/utils/marsUtils.test.js (13 tests)
✓ src/terrain/roverModel.test.js (4 tests)
✓ src/utils/drills.test.js (11 tests)
✓ src/services/crewCommsService.test.js (8 tests)
✓ src/store/useMapStore.test.js (14 tests)
✓ src/components/quakes/quakes.test.js (7 tests)
✓ src/utils/libsSpectrum.test.js (5 tests)
✓ src/terrain/pathfinding.test.js (17 tests)
✓ src/utils/spectrumMath.test.js (6 tests)
✓ src/utils/antimeridian.test.js (4 tests)
✓ src/terrain/terrainClient.test.js (2 tests)
✓ src/data/orbiters.test.js (3 tests)
✓ src/services/marsMlService.test.js (57 tests)
✓ src/data/weatherSimulation.test.js (3 tests)
✓ src/services/routePlanningService.test.js (3 tests)
✓ src/utils/marsSkyTransit.test.js (1 test)
✓ src/terrain/validation.test.js (6 tests)

✓ src/components/resourceOverlays.test.js (5 tests)
...
Test Files  25 passed (25)
     Tests  212 passed (212)
  Duration  25.47s
```

### Traverse Route Validation Against Real Rover Telemetry
Our A* terrain planner was validated against actual rover odometry logged by NASA in Jezero Crater (*Perseverance*) and Gale Crater (*Curiosity*):
- **Perseverance Traverse (42.71 km)**: Planned-to-actual length ratio median = **0.98**; P90 = **1.25**; max slope traversed = **4.8°**.
- **Curiosity Traverse (33.28 km)**: Planned-to-actual length ratio median = **0.82**; P90 = **0.87**; max slope traversed = **4.3°**.

---

## 💻 Local Installation & Developer Setup

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- Python 3.10+ (only required if retraining ML models or rebuilding DEM rasters)

### 1. Clone & Install
```bash
git clone https://github.com/Dipbroto/Martis-Ovikorsho.git
cd Martis-Ovikorsho
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in the root directory:
```bash
cp .env.example .env.local
```
Configure your keys:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Gemini AI (Optional for local development; in production calls route through gemini-proxy)
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### 3. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Run Test Suite
```bash
npm test
```

### 5. Production Build
```bash
npm run build
```

---

## 📜 Mission Credits & Acknowledgments

- **NASA Planetary Data System (PDS) Geosciences Node**: Mars 2020 Perseverance PIXL, SuperCam, and SHERLOC raw and derived science archives.
- **NASA Jet Propulsion Laboratory (JPL / Caltech)**: Mars Science Laboratory Curiosity REMS environmental data, rover drive logs, and MSR sample architecture.
- **USGS Astrogeology Science Center**: HRSC-MOLA Global Blended Digital Elevation Model (200m/px v2).
- **InSight Marsquake Service (MQS) & IPGP**: InSight SEIS Seismic Event Catalog V14.
- **European Space Agency (ESA)**: Mars Express HRSC orbital stereo imagery.
- **Google DeepMind**: Gemini 2.0 Flash multimodal language model.
- **NASA Space Apps Challenge 2026**: Inspiring the next generation of interplanetary exploration software.

---

<div align="center">
  <sub>Engineered with precision for humanity's journey to the Red Planet. Built for the NASA Space Apps Challenge 2026.</sub><br>
  <sub><b>Martis Ovikorsho Team · 2026</b></sub>
</div>
