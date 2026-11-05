# In-Situ Science Lab: System Architecture & Scientific Reference Manual

> **NASA Space Apps Challenge 2026 — Interplanetary Survival Guide & Martian Map**  
> **Subsystem**: In-Situ Planetary Science Lab, Astrobiology Core Profiler & Machine Learning Chemometrics  
> **Execution Environment**: Client-Side Zero-Latency Web Audio & WebGL Engine (Zero Python Dependencies)  
> **Data Provenance**: NASA Planetary Data System (PDS) Geosciences Node (Mars 2020 SuperCam, PIXL, SHERLOC Archives)

---

## 1. Executive Summary

The **In-Situ Science Lab** (`ScienceLabPage.jsx`) provides astronauts, mission planners, and planetary scientists with an interactive laboratory environment designed around the foundational philosophy: **"Read a Martian rock like a rover does."**

Addressing NASA's primary scientific directive for the Mars 2020 *Perseverance* mission—**the search for ancient biosignatures, paleo-environmental reconstruction, and sample selection for Mars Sample Return (MSR)**—the system integrates:
1. **Authentic Multi-Instrument Spectroscopic Analysis**: SuperCam LIBS, PIXL Micro-XRF, and SHERLOC Deep-UV Raman calibrated directly to NASA PDS data archives.
2. **55mm Subsurface Stratigraphic Coring**: Physical depth photolysis modeling, redox profiling, and molecular organic preservation.
3. **Advanced Machine Learning & Chemometrics**: 16-D Astrobiology Latent Manifold projection, Mahalanobis anomaly detection with $\chi^2$ hypothesis testing, multi-class mineral classification, Bayesian active learning triage, and prebiotic chemical structure matching.
4. **ISRU Thermochemical Plasma Smelting**: Stoichiometric feasibility checking and plasma ablation synthesis for structural alloys, quartz solar covers, methalox propellant, and deuterium fusion fuel.
5. **NASA MSR Sample Caching**: Serialized 38-tube return manifest linked to orbital ascent flight dispatch.

```mermaid
flowchart TD
    subgraph Data Sources
        PDS["NASA PDS Geosciences Archive\n(SuperCam · PIXL · SHERLOC)"]
        Scanner["Orbital-to-Ground Scanner\n(CRISM · THEMIS · MOLA Inversion)"]
    end

    subgraph 6 Instrument Decks
        SC["SuperCam LIBS Deck\n(1064nm Laser · Pulse Averaging)"]
        PX["PIXL Micro-XRF Deck\n(Spatial Oxide Chemistry)"]
        SH["SHERLOC Deep-UV Deck\n(248.58nm Raman & Fluorescence)"]
        CD["Core Drill & Astrobiology Deck\n(55mm Stratigraphy · Depth Redox)"]
        ISRU["ISRU Plasma Smelter Deck\n(Thermochemical Reduction)"]
        MSR["MSR Sample Cache Manifest\n(38 Serialized Return Tubes)"]
    end

    subgraph Machine Learning Pipeline
        ML1["16-D Astrobiology Latent Manifold\n(Mahalanobis Anomaly & Chi-Square)"]
        ML2["Prebiotic Molecular Matcher\n(SAM · Cosine Similarity · 2D Structures)"]
        ML3["In-Situ Mineral Classifier\n(Softmax Multinomial · Geochemical Indices)"]
        ML4["Bayesian Active Learning Triage\n(Shannon Entropy · Acquisition Scoring)"]
    end

    Data Sources --> SC & PX & SH & CD & ISRU
    SC & PX & SH & CD --> Machine Learning Pipeline
    Machine Learning Pipeline --> MSR
```

---

## 2. The 6 Integrated Scientific Instrument Decks

The Science Lab unifies six instrument workstations, each mirroring the operational physics and telemetry of flight instruments aboard NASA's *Perseverance* rover and future human exploration assets:

### Deck 1: SuperCam LIBS Diagnostic Spectrometer (`LibsPanel.jsx`, `IsruPlasmaForgeDeck.jsx`)
* **Instrument Overview**: Laser-Induced Breakdown Spectroscopy (LIBS) utilizing a Q-switched pulsed Nd:YAG laser ($\lambda = 1064\text{ nm}$, pulse width $4.5\text{ ns}$, energy $15.2\text{ mJ/pulse}$) to ionize rock targets at standoffs of $2\text{ to }7\text{ meters}$.
* **Optics & Detectors**: 3 spectrometers covering $240\text{--}853\text{ nm}$:
  1. **UV Channel (240–340 nm)**: Analyzes Silicon ($\text{Si I } 288.1\text{ nm}$), Titanium ($\text{Ti I } 334.9\text{ nm}$), Magnesium ($\text{Mg I } 285.2\text{ nm}$).
  2. **VIO Channel (382–469 nm)**: Resolves Iron ($\text{Fe I/II } 404.5 \ \& \ 438.3\text{ nm}$), Calcium ($\text{Ca II } 393.3 \ \& \ 396.8\text{ nm}$ doublet), Aluminium ($\text{Al I } 394.4 \ \& \ 396.1\text{ nm}$).
  3. **VIS/VNIR Channels (470–853 nm)**: Detects atomic Oxygen ($\text{O I } 777.4\text{ nm}$ triplet), Sodium ($\text{Na I } 589.6\text{ nm}$), Potassium ($\text{K I } 766.5\text{ nm}$).
* **Interactive Mechanics**:
  - **Remote Micro-Imager (RMI)**: High-resolution camera viewfinder displaying true-color close-ups. Clicking anywhere on the rock fires laser pulses, generating ablation pit markers and loading point-specific spectra.
  - **Physics-Based Calibration Pulse Engine**:
    - **Poisson Noise Reduction**: Accumulates pulse bursts ($N \ge 30$) to increase the Signal-to-Noise Ratio:
      $$\Delta\text{SNR}(N) = 5 \log_{10}\left(\frac{N}{30}\right)\text{ dB}$$
    - **Stoichiometric Uncertainty Shrinkage**:
      $$\sigma(N) = \frac{1.25\%}{\sqrt{N / 30}}$$
    - **Thermal Plume Spikes**: Live plasma breakdown jumps from $8,400\text{ K}$ up to $11,400\text{ K}$ during firing.
    - **Micro-Pit Ablation**: Accumulates trench depth at $0.08\ \mu\text{m/pulse}$.
    - **Baseline Reset**: One-click reversion back to Sol 1 nominal baseline ($30\text{ shots}$).

---

### Deck 2: PIXL Micro-XRF Lithochemistry Deck (`PixlPanel.jsx`)
* **Instrument Overview**: Planetary Instrument for X-ray Lithochemistry. Measures elemental chemistry via micro-focused X-ray fluorescence across structured spatial grids ($100\text{ to }3,249\text{ points}$).
* **Key Features**:
  - **Spatial Oxide Heatmaps**: Renders localized concentrations for 11 major oxides ($\text{SiO}_2, \text{FeO-T}, \text{MgO}, \text{Al}_2\text{O}_3, \text{CaO}, \text{SO}_3, \text{Na}_2\text{O}, \text{K}_2\text{O}, \text{TiO}_2, \text{P}_2\text{O}_5, \text{Cl}$) using adaptive dynamic percentile color ramps.
  - **Interactive Point Inspector**: Hovering or clicking any raster coordinate reveals the exact local elemental composition vs. bulk rock median vs. average Martian soil (Taylor & McLennan baseline).
  - **Geochemical Coupling**: Calculates Pearson product-moment correlation coefficients $r(\text{SO}_3, \text{CaO})$ and $r(\text{SO}_3, \text{MgO})$ to distinguish between calcium sulfate (gypsum/anhydrite) veins and magnesium sulfate salts.

---

### Deck 3: SHERLOC Deep-UV Raman & Luminescence Deck (`SherlocPanel.jsx`)
* **Instrument Overview**: Scanning Habitable Environments with Raman & Luminescence for Organics and Chemicals. Employs a $248.58\text{ nm}$ NeCu deep-ultraviolet pulsed laser paired with the Autofocus and Context Imager (ACI).
* **Spectroscopic Regimes**:
  1. **Deep-UV Native Fluorescence (275–355 nm)**:
     - Band 1 (275–300 nm): Diagnostic resonance for monocyclic aromatics (benzene rings).
     - Band 2 (300–345 nm): Fluorescence emissions for 2-ring (naphthalene) and 3-ring (phenanthrene) polycyclic aromatic hydrocarbons (PAHs).
  2. **Deep-UV Raman Scattering (800–4000 cm⁻¹)**:
     - Isolates diagnostic vibrational modes: Olivine ($815\text{--}860\text{ cm}^{-1}$ doublet), Perchlorate ($925\text{--}950\text{ cm}^{-1}$), Phosphate ($950\text{--}975\text{ cm}^{-1}$), Sulfate/Pyroxene ($995\text{--}1030\text{ cm}^{-1}$), Carbonate ($1080\text{--}1100\text{ cm}^{-1}$), Carbon D-band ($1330\text{--}1390\text{ cm}^{-1}$), Carbon G-band ($1570\text{--}1620\text{ cm}^{-1}$), and Bound Hydroxyls ($3200\text{--}3650\text{ cm}^{-1}$).
  - **Fluorescence Baseline Stripping**: Toggleable background-correction filter removing native luminescence glare to reveal faint organic Raman peaks.

---

### Deck 4: Astrobiology Deep Core Drill Deck (`SubsurfaceCoreDrillDeck.jsx`, `OrganicRamanInspector.jsx`)
* **Instrument Overview**: Simulates *Perseverance's* rotary percussive coring drill, extracting a $55\text{ mm} \times 13\text{ mm}$ cylindrical titanium rock core from the subsurface.
* **4 Stratigraphic Core Horizons**:
  - **Layer 1 (0–3 mm) — Eolian Dust Patina & Oxidized Weathering Crust**:
    High $\text{Fe}^{3+}/\text{Fe}^{2+}$ redox ratio ($95\% \ \text{Fe}^{3+}$), intense UV photolysis depletion, elevated perchlorate ($>450\text{ ppm}$), trace total organic carbon ($\text{TOC} < 20\ \mu\text{g/g}$).
  - **Layer 2 (3–20 mm) — Pristine Igneous/Sedimentary Matrix**:
    Equilibrated crystalline framework, intermediate oxidation, decreasing perchlorates.
  - **Layer 3 (20–35 mm) — Hydrothermal Secondary Mineralization Vein**:
    Aqueous silica/sulfate intrusion, secondary calcite veins, moderate organic shielding.
  - **Layer 4 (35–55 mm) — Deep Shielded Lacustrine Mudstone Laminae**:
    Protected from surface cosmic rays and solar ultraviolet photons ($200\text{--}400\text{ nm}$). Retains reduced $\text{Fe}^{2+}$ silicate phases ($82\% \ \text{Fe}^{2+}$), hydrated clay interlayers, and elevated organic carbon ($\text{TOC} > 150\ \mu\text{g/g}$).
* **Interactive Core Sensor Slider**:
  Draggable depth cursor ($0\text{ to }55\text{ mm}$) tracking depth-resolved redox fractions ($\text{Fe}^{3+}/\text{Fe}^{2+}$), perchlorate contamination gradients, and biogenic potential.
* **Rotary Percussive Drilling Mechanism**:
  Simulates animated drill actuation, mechanical torque rotation, and percussive audio synthesis (`playCoreDrill`).

---

### Deck 5: High-Energy Plasma Smelter & ISRU Materials Forge (`IsruPlasmaForgeDeck.jsx`)
* **Instrument Overview**: Converts the rover's optical mast laser into an In-Situ Resource Utilization (ISRU) induction plasma torch capable of operating at $12,000\text{ to }18,900\text{ K}$.
* **4 Thermochemical & Isotopic Synthesis Recipes**:
  1. **Titanium-Iron Aerospace Structural Alloy (Ti-Fe)**:
     - *Formula*: $\text{FeTiO}_3 + \text{CO} \to \text{Ti-Fe} + \text{CO}_2$ ($16,500\text{ K}$, $1,850\text{ kJ/kg}$)
     - *Precursor Requirement*: $\text{FeO-T} \ge 17.0\%$, $\text{TiO}_2 \ge 1.0\%$.
     - *Yield*: $+12.5\text{ kg}$ structural alloy to reinforce rover treads and chassis joints.
  2. **High-Transmittance Photovoltaic Quartz Glass**:
     - *Formula*: $\text{SiO}_2 \to \text{Vitreous Fused Silica Cover Slip}$ ($12,800\text{ K}$, $1,420\text{ kJ/kg}$)
     - *Precursor Requirement*: $\text{SiO}_2 \ge 45.0\%$.
     - *Yield*: $+1\text{ unit}$ optical quartz cover slip, restoring solar array dust factor ($D_f \to 1.0$).
  3. **Cryogenic Methalox Rocket Propellant ($\text{CH}_4\text{ / LOX}$)**:
     - *Formula*: $\text{CO}_2\text{ (atm)} + 4\text{H}_2\text{ (clays/sulfates)} \to \text{CH}_4 + 2\text{O}_2$ ($14,200\text{ K}$, $2,400\text{ kJ/kg}$)
     - *Precursor Requirement*: $\text{SO}_3 \ge 4.0\%$ or $\text{Cl} \ge 1.0\%$ or $\text{Al}_2\text{O}_3 \ge 8.0\%$.
     - *Yield*: $+25.0\text{ kg}$ cryogenic propellant for the Mars Ascent Vehicle (MAV).
  4. **Deuterium & Helium-3 Fusion Isotope Fuel Pellets**:
     - *Formula*: $\text{HDO (hydrated clays)} \to \text{D}_2\text{O} \to \text{D}_2\text{ pellets}$ ($18,900\text{ K}$, $4,800\text{ kJ/kg}$)
     - *Precursor Requirement*: Hydrates ($\text{SO}_3 + \text{Al}_2\text{O}_3) \ge 12.0\%$ or Biosignature Score $\ge 65\%$.
     - *Yield*: $+2\text{ pellets}$ for base aneutronic fusion reactors.
* **Persistent Depot**:
  Synthesized materials are stored in Zustand state (`isruInventory`) and persist across app navigation.

---

### Deck 6: Mars Sample Return (MSR) Return Cache (`ScienceLabPage.jsx`)
* **Hardware Specs**: Renders the complete 38-tube sample rack carried on Perseverance.
* **Custody Chain Logging**:
  Sealing a sample assigns it to the next serialized tube (`Tube #1` to `Tube #38`), logging:
  - Rock name and lithology.
  - Core drill stratigraphy depth (e.g. `Layer 4 at 48mm`).
  - Matched organic compound and confidence level.
  - Redox state and TOC content.
  - Visual status pill `55mm CORE` and direct linkage to `FlightPlanModal.jsx` for orbital rendezvous dispatch.

---

## 3. Comprehensive Machine Learning & Chemometrics Engines

The Science Lab executes seven distinct machine learning models and chemometrics engines entirely inside the client browser:

```mermaid
classDiagram
    class AstrobiologyLatentManifold {
        +Float64Array featureVector16D
        +Float64Array projectionMatrix
        +projectLatentSpace(z1, z2)
        +computeMahalanobis(dm)
        +computeChiSquarePValue(p)
        +computeUncertainty(epistemic, aleatoric)
    }

    class PrebioticOrganicMatcher {
        +Array referenceLibrary
        +spectralAngleMapper(v_obs, v_ref)
        +cosineSimilarity()
        +deconvolveRamanBaseline()
        +evaluateBioticPlausibility()
    }

    class MineralMlClassifier {
        +StandardScaler scaler
        +MultinomialCoefficients weights
        +computeGeochemicalIndices()
        +softmaxInference()
        +calculateBppScore()
    }

    class ActiveLearningTriage {
        +computeRegolithDistance()
        +shannonEntropyBits()
        +acquisitionFunctionScore()
        +assignTriageTier()
    }

    AstrobiologyLatentManifold <|-- PrebioticOrganicMatcher
    MineralMlClassifier <|-- ActiveLearningTriage
```

---

### 1. 16-D Astrobiology Latent Manifold & Anomaly Engine
* **Input Feature Space ($\mathbf{x} \in \mathbb{R}^{16}$)**:
  1. $\text{SiO}_2\text{ (wt\%)}$
  2. $\text{FeO-T (wt\%)}$
  3. $\text{MgO (wt\%)}$
  4. $\text{Al}_2\text{O}_3\text{ (wt\%)}$
  5. $\text{CaO (wt\%)}$
  6. $\text{SO}_3\text{ (wt\%)}$
  7. $\text{Na}_2\text{O (wt\%)}$
  8. $\text{K}_2\text{O (wt\%)}$
  9. $\text{TiO}_2\text{ (wt\%)}$
  10. $\text{P}_2\text{O}_5\text{ (wt\%)}$
  11. $\text{Cl (wt\%)}$
  12. Raman Carbon D-band intensity ($1345\text{ cm}^{-1}$)
  13. Raman Carbon G-band intensity ($1600\text{ cm}^{-1}$)
  14. Total Organic Carbon ($\text{TOC } \mu\text{g/g}$)
  15. Chemical Index of Alteration (CIA index)
  16. Subsurface Depth Core Preservation Ratio ($1 - \text{UV Bleach}$)
* **Linear Dimensionality Reduction**:
  Projects the 16-dimensional standardized geochemical vector $\mathbf{x}_{\text{std}}$ into an orthogonal 2D latent coordinates system $(z_1, z_2)$:
  $$\mathbf{z} = \mathbf{W}^T (\mathbf{x} - \boldsymbol{\mu}) \oslash \boldsymbol{\sigma}$$
  - **Latent Dimension $z_1$**: *Aromaticity & Organic Complexity Gradient* (measures polycyclic aromatic condensation and macromolecular kerogen maturation).
  - **Latent Dimension $z_2$**: *Redox Shielding & Hydrothermal Alteration Index* (measures preserved $\text{Fe}^{2+}$ silicates and aqueous alteration vs. photolytic oxidation).

* **5 Ground-Truth Terrestrial & Meteoritic Analog Clusters**:
  Calibrated against peer-reviewed astrobiological benchmark samples:
  1. **Pilbara Archean Kerogen (3.48 Ga Earth Analog)**:
     - Mean: $(z_1 = 2.45, z_2 = 1.85)$, $\boldsymbol{\Sigma} = \text{diag}(0.18, 0.22)$
     - True biogenic microfossil and stromatolite kerogen preserved in barite/chert veins (Dresser Formation, Western Australia).
  2. **Hydrothermal Silica Sinter (El Tatio Geyser Analog)**:
     - Mean: $(z_1 = 1.10, z_2 = 2.60)$, $\boldsymbol{\Sigma} = \text{diag}(0.25, 0.20)$
     - High-silica spiculite sinter preserving subaerial microbial mats.
  3. **Murchison Carbonaceous Chondrite Infall (CM2 Chondrite)**:
     - Mean: $(z_1 = 1.80, z_2 = -1.65)$, $\boldsymbol{\Sigma} = \text{diag}(0.30, 0.28)$
     - Extraterrestrial abiotic delivery of racemic amino acids, polycyclic aromatic hydrocarbons, and insoluble organic matter (IOM).
  4. **Fischer-Tropsch Type (FTT) Catalytic Synthesis**:
     - Mean: $(z_1 = -1.20, z_2 = 0.45)$, $\boldsymbol{\Sigma} = \text{diag}(0.35, 0.30)$
     - Abiotic serpentinization synthesis ($n\text{CO} + (2n+1)\text{H}_2 \to \text{C}_n\text{H}_{2n+2} + n\text{H}_2\text{O}$).
  5. **Martian Igneous Null Baseline (Abiotic Basalt Control)**:
     - Mean: $(z_1 = -2.10, z_2 = -1.40)$, $\boldsymbol{\Sigma} = \text{diag}(0.22, 0.25)$
     - Null baseline representing sterile, irradiated Martian basaltic crust.

* **Mahalanobis Distance Metric vs. Abiotic Null**:
  Measures the statistical distance $D_M$ of the core sample $\mathbf{z}$ from the center of the abiotic null baseline $(\boldsymbol{\mu}_0, \boldsymbol{\Sigma}_0)$:
  $$D_M(\mathbf{z}) = \sqrt{(\mathbf{z} - \boldsymbol{\mu}_0)^T \boldsymbol{\Sigma}_0^{-1} (\mathbf{z} - \boldsymbol{\mu}_0)}$$
* **Statistical Hypothesis Testing ($\chi^2$ Distribution)**:
  Under the null hypothesis $H_0$ that the sample is sterile abiotic basalt, $D_M^2$ follows a Chi-Square distribution with 2 degrees of freedom ($k=2$):
  $$p = \exp\left(-\frac{D_M^2}{2}\right)$$
  - If $p < 0.01$ and $D_M > 3.0$: $H_0$ is rejected at the $99\%$ confidence level $\to$ **Strong Statistical Anomaly (Astrobiological Biosignature Candidate)**.
* **Dual-Component Bayesian Uncertainty Quantification**:
  - **Epistemic Uncertainty ($\sigma_{\text{epistemic}}$)**: Measures distance to nearest benchmark cluster; elevates when probing novel, uncharacterized lithologies.
  - **Aleatoric Uncertainty ($\sigma_{\text{aleatoric}}$)**: Measures photon shot noise and spectral baseline variance, decreasing with laser pulse accumulation.

---

### 2. Prebiotic Organic Deconvolution & Spectral Angle Mapper (SAM)
* **Mathematical Baseline Correction**:
  Applies an iterative rolling polynomial envelope subtraction:
  $$I_{\text{deconv}}(\tilde{\nu}) = \max\left(0, I_{\text{raw}}(\tilde{\nu}) - I_{\text{baseline}}(\tilde{\nu})\right)$$
* **Cosine Similarity & Spectral Angle Mapping**:
  Compares the deconvolved Raman band vector $\mathbf{v}_{\text{obs}}$ against the calibrated vibrational profiles $\mathbf{v}_{\text{lib}}$ in `ASTROBIOLOGY_ORGANIC_LIBRARY`:
  $$\theta = \arccos\left(\frac{\mathbf{v}_{\text{obs}} \cdot \mathbf{v}_{\text{lib}}}{\|\mathbf{v}_{\text{obs}}\| \|\mathbf{v}_{\text{lib}}\|}\right), \quad \text{Similarity Index (SSI)} = \cos(\theta) \times 100\%$$
* **6 Prebiotic Compound Classes**:
  1. **Phenanthrene ($\text{C}_{14}\text{H}_{10}$, $178.23\text{ g/mol}$)**: 3-ring angular PAH; marker of hydrothermal carbonaceous synthesis.
  2. **Pyrene ($\text{C}_{16}\text{H}_{10}$, $202.26\text{ g/mol}$)**: 4-ring peri-condensed PAH; diagnostic of high-temperature carbon maturity.
  3. **Naphthalene ($\text{C}_{10}\text{H}_8$, $128.17\text{ g/mol}$)**: Bicyclic aromatic; volatile PAH indicative of carbonaceous chondrite delivery.
  4. **Glycine Precursor ($\text{C}_2\text{H}_5\text{NO}_2$, $75.07\text{ g/mol}$)**: Simplest amino acid; biomarker of prebiotic coacervates.
  5. **Alanine Precursor ($\text{C}_3\text{H}_7\text{NO}_2$, $89.09\text{ g/mol}$)**: Chiral aliphatic amino acid building block.
  6. **Refractory Macromolecular Kerogen Matrix**: Disordered polycyclic carbon network characterized by $I_D/I_G$ Raman band ratio.
* **2D Lewis / Skeletal Chemical Structure Renderer**:
  Dynamically renders SVG vector bond diagrams (benzene rings, delocalized electron resonance circles, amino/carboxyl functional groups, and carbon backbone vertices).

---

### 3. In-Situ Supervised Multi-Class Mineral Classifier
* **Model Family**: Softmax Multinomial Logistic Regression calibrated on 2,500 laboratory rock spectra.
* **Feature Engineering & Geochemical Indices**:
  - **Chemical Index of Alteration (CIA)**:
    $$\text{CIA} = \frac{\text{Al}_2\text{O}_3}{\text{Al}_2\text{O}_3 + \text{CaO} + \text{Na}_2\text{O} + \text{K}_2\text{O}} \times 100$$
    Tracks open-system feldspar weathering and clay formation.
  - **Mafic Cumulate Index**:
    $$\text{MI} = \frac{\text{MgO} + \text{FeO}}{\text{SiO}_2 + \text{Al}_2\text{O}_3}$$
    Separates olivine/pyroxene cumulates from felsic differentiates.
  - **Sulfate Saturation Ratio**:
    $$S_{\text{ratio}} = \frac{\text{SO}_3}{\text{SO}_3 + \text{SiO}_2}$$
    Distinguishes evaporitic playa beds from detrital silicate sands.
  - **Silica Saturation Ratio**:
    $$\text{Si}_{\text{sat}} = \frac{\text{SiO}_2}{\text{MgO} + \text{FeO} + \text{CaO}}$$
  - **Alkali Ratio**:
    $$\text{Alk} = \frac{\text{Na}_2\text{O} + \text{K}_2\text{O}}{\text{Al}_2\text{O}_3}$$
* **Softmax Probability Distribution**:
  $$P(y = c \mid \mathbf{x}) = \frac{\exp\left(\beta_{c0} + \sum_j \beta_{cj} \frac{x_j - \mu_j}{\sigma_j}\right)}{\sum_{k=1}^K \exp\left(\beta_{k0} + \sum_j \beta_{kj} \frac{x_j - \mu_j}{\sigma_j}\right)}$$
* **Biosignature Preservation Potential (BPP Score)**:
  Weights mineral stability, low permeability, and redox trapping:
  - Silica sinter / Chert: **$95\%$ BPP** (entombs microfossils in amorphous silica).
  - Clay / Phyllosilicate: **$88\%$ BPP** (interlayer electrostatic trapping of biomolecules).
  - Carbonate mudstone: **$82\%$ BPP** (rapid cementation preserves morphology).
  - Sulfate salt flat: **$75\%$ BPP** (fluid inclusion halophile preservation).
  - Basalt / Olivine: **$25\text{--}40\%$ BPP** (permeable, susceptible to oxidative dissolution).

---

### 4. Bayesian Active Learning Novelty & Triage Radar
* **Information Entropy Metric (Shannon Uncertainty)**:
  $$H(P) = - \sum_{k=1}^K P_k \log_2(P_k) \quad \text{[bits]}$$
  Quantifies uncertainty across rock classifications. High entropy occurs at ambiguous geochemical transition boundaries, signaling maximum active learning scientific reward.
* **Autonomous Rover Triage Decision Function**:
  $$\text{Score}_{\text{acquisition}} = w_1 \cdot D_M(\text{regolith}) + w_2 \cdot H(P) + w_3 \cdot \text{BPP}$$
  - **TIER 1 (Priority Return Cache)**: Novelty $>80\%$, $D_M > 3.0$, or high astrobiology BPP. Triggers automated rover cache recommendation.
  - **TIER 2 (High Value Science)**: Moderate novelty; recommends secondary SuperCam rasters.
  - **TIER 3 (Nominal Regolith)**: Background terrain; minimal caching priority.

---

### 5. LIBS Calibration Pulse Physics & Shot-Averaging Engine
* **Physical Theory**:
  When SuperCam fires its pulsed laser at Martian rocks:
  1. *Shots 1–5*: Ablate the pervasive atmospheric dust rind ($92\%$ matrix transmission).
  2. *Shots 6–30*: Nominal science raster; dust cleared, bedrock exposed.
  3. *Shots 31–100+*: Shot-averaging regime. Poisson photon statistics improve by $\sqrt{N}$:
     $$\text{SNR}_{\text{total}} = \text{SNR}_{\text{base}} + 5 \log_{10}\left(\frac{N}{30}\right)\text{ dB}$$
     $$\sigma_{\text{wt\%}}(N) = \max\left(0.12\%, \frac{1.25\%}{\sqrt{N / 30}}\right)$$

---

### 6. Anywhere-on-Mars Orbital Discovery Scanner
* **Hyperspectral Inversion Pipeline**:
  Allows the user to click any of the 7 Martian provinces or type arbitrary coordinates ($[-90^\circ, +90^\circ]\text{ lat}$, $[-180^\circ, +180^\circ]\text{ lon}$) to generate an in-situ rock target:
  - **Tharsis Volcanic Plateau**: High-titanium tholeiitic basalts ($\text{TiO}_2 > 1.8\%$, $\text{FeO} > 22\%$).
  - **Valles Marineris Chasmata**: Deep crustal mafic layering and hydrated sulfate wall rock.
  - **Meridiani Planum**: Hematite-rich spherules ("blueberries") and jarosite evaporites.
  - **Gale Crater Lacustrine Basin**: Smectite clays and calcium sulfate vein networks.
  - **Planum Boreum (North Polar Cap)**: Water ice with perchlorate dust inclusions.
* **Deterministic Synthesis**:
  Derives 100 PIXL spatial coordinates, SuperCam atomic line peaks, and SHERLOC fluorescence curves seeded by latitude, longitude, and topographic elevation.

---

### 7. AI Plain-Language Explainer & Scientific Synthesis
* **Dual Operation**:
  - **Client-Side Analytical Synthesis**: Instantly synthesizes mineral evidence, oxidation state, and habitability notes from raw numbers.
  - **Edge-Function Gemini API**: When configured, generates plain-language geological interpretations translating raw spectrometer readouts into accessible human summaries.

---

## 4. Authentic NASA PDS Ground Truth Target Benchmark

The Science Lab incorporates authentic NASA Planetary Data System (PDS) archive files for 6 real exploration targets analyzed by *Perseverance* in Jezero Crater:

| Rock Target | Martian Sol | Rock Type & Lithology | $\text{SiO}_2$ | $\text{FeO-T}$ | $\text{MgO}$ | $\text{CaO}$ | $\text{SO}_3$ | Key Scientific Discovery |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Guillaumes** | Sol 162 | Basaltic igneous bedrock | $38.9\%$ | $19.0\%$ | $2.4\%$ | $7.1\%$ | $1.5\%$ | Early crater floor igneous floor unit; low-alteration olivine-pyroxene basalt. |
| **Bellegarde** | Sol 187 | Titanium-rich basalt | $45.2\%$ | $23.2\%$ | $1.9\%$ | $7.4\%$ | $1.3\%$ | Highest titanium content ($1.61\%\ \text{TiO}_2$); ilmenite rich; optimal for Ti-Fe alloy ISRU smelting. |
| **Dourbes** | Sol 259 | Olivine-rich cumulate | $37.1\%$ | $35.8\%$ | $21.1\%$ | $0.8\%$ | $0.1\%$ | Ultramafic olivine cumulate; highest iron and magnesium; coarse crystalline texture. |
| **Quartier** | Sol 294 | Olivine-rich igneous rock | $33.8\%$ | $33.9\%$ | $16.1\%$ | $0.9\%$ | $1.5\%$ | Abraded target revealing coarse olivine grains altered by ancient carbonate-bearing fluids. |
| **Montpezat** | Sol 345 | Basaltic lava flow | $46.5\%$ | $17.7\%$ | $6.0\%$ | $8.1\%$ | $0.3\%$ | High silica basalt ($46.5\%\ \text{SiO}_2$); excellent for photovoltaic quartz glass vitrification. |
| **Berry Hollow** | Sol 507 | Sulfate-rich sedimentary rock | $32.4\%$ | $17.4\%$ | $13.1\%$ | $1.5\%$ | $21.2\%$ | Lacustrine delta sediment; extreme sulfate salt content ($21.2\%\ \text{SO}_3$); high organic preservation potential. |

---

## 5. Ancient Water Paleo-pH & Habitability Engine

Located at the base of the Science Lab, this interactive thermodynamic equilibrium engine models the chemical precipitates formed under ancient Martian surface waters:

$$\text{pH Range: } 2.0 \longleftrightarrow 10.0$$

1. **Acid Brine ($\text{pH } 2.0\text{--}4.5$)**:
   - *Regime*: Acid-sulfate weathering driven by volcanic sulfur dioxide outgassing.
   - *Precipitates*: Jarosite ($\text{KFe}^{3+}_3(\text{SO}_4)_2(\text{OH})_6$), Alunite, amorphous Silica.
   - *Taphonomy*: Harsh oxidative environment; rapid degradation of unshielded organic structures.
2. **Neutral Lake ($\text{pH } 4.5\text{--}8.2$)**:
   - *Regime*: Long-lived lacustrine and deltaic standing water (e.g., Jezero paleolake).
   - *Precipitates*: Smectite and nontronite clays, Ca-sulfates (gypsum/bassanite), detrital quartz.
   - *Taphonomy*: **Prime Astrobiological Target**; electrostatic entrapment of biomolecules in phyllosilicate lattices.
3. **Alkaline Vents ($\text{pH } 8.2\text{--}10.0$)**:
   - *Regime*: Ultramafic serpentinization and sublacustrine alkaline hydrothermal venting.
   - *Precipitates*: Mg/Ca-carbonates (magnesite, siderite), serpentine, talc.
   - *Taphonomy*: Excellent morphological fossil preservation via rapid carbonate cementation; high potential for abiotic abiotic FTT organic synthesis.

---

## 6. Multi-Sensory Web Audio Synthesis Architecture (`audioSynthesizer.js`)

To provide rich physical and tactile immersion without external audio asset downloads, the Science Lab implements custom Web Audio API procedural synthesizers:

- `playLaserZap()`: Simulates high-energy Q-switched pulsed laser discharges with sharp acoustic ionizing snaps ($1.2\text{ kHz}$ to $80\text{ Hz}$ pitch drop with white noise bursts).
- `playCoreDrill()`: Procedural rotary percussive drilling audio using dual frequency-modulated oscillators ($42\text{ Hz}$ fundamental vibration with $18\text{ Hz}$ rotational motor rumble).
- `playPlasmaForge()`: Deep inductive plasma hum ($60\text{ Hz}$ to $180\text{ Hz}$ sub-bass sweep with resonant bandpass filter sizzle).
- `playSampleSeal()`: Pneumatic hermetic sealing chime representing the titanium sample tube seal actuation.
- `playUiClick()` / `playUiHover()`: High-frequency acoustic micro-clicks for responsive dashboard interactions.

---

## 7. Quality Assurance & System Verification

- **Test Suite**: Verified via Vitest running **192 unit and integration tests** across 23 test suites (`npx vitest run`).
- **Production Build**: Compiles cleanly with zero warnings or errors via Vite (`npm run build`).
- **Zero Runtime Dependencies**: All chemometrics, linear algebra, latent space projections, and statistical distributions are written in pure modern ES2022 JavaScript, guaranteeing offline and edge execution.
