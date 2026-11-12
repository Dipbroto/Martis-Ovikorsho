import { supabase, supabaseAnonKey, isSupabaseConfigured } from "../lib/supabase";
import { MARS_LANDMARKS } from "../data/marsLandmarks";

const GEMINI_MODEL = "gemini-2.5-flash";
// Number of most recent chat messages forwarded to the model as context
const MAX_CONTEXT_TURNS = 50;

// Direct API Key (if provided in env) or Supabase proxy
const DIRECT_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || undefined;

export const isAiConfigured = Boolean(DIRECT_API_KEY) || isSupabaseConfigured;

/** Sends a Gemini `generateContent` request body and returns the parsed JSON response. */
async function generateContent(body) {
  // 1. Try Direct API Key if provided
  if (DIRECT_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": DIRECT_API_KEY },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        return await res.json();
      }
      console.warn(`Direct Gemini API failed (${res.status}), trying proxy fallback...`);
    } catch (err) {
      console.warn("Direct Gemini API error, trying proxy fallback:", err);
    }
  }

  // 2. Try Supabase Edge Function proxy
  let res = await supabase.functions.invoke("gemini-proxy", {
    body: { model: GEMINI_MODEL, ...body },
  });

  // If failed (e.g. 401 because user's browser session JWT is expired), retry explicitly with public Anon Key
  if (res.error && supabaseAnonKey) {
    res = await supabase.functions.invoke("gemini-proxy", {
      body: { model: GEMINI_MODEL, ...body },
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
  }

  if (res.error) {
    let detailedMessage = res.error.message;
    try {
      if (res.error.context) {
        const errorBody = await res.error.context.json();
        detailedMessage = errorBody?.error?.message || errorBody?.message || detailedMessage;
      }
    } catch {
      // ignore JSON parse error on error context
    }
    throw new Error(detailedMessage || "Edge Function returned a non-2xx status code");
  }

  if (res.data?.error) {
    throw new Error(res.data.error.message || res.data.error);
  }
  return res.data;
}

const getParts = (response) => response?.candidates?.[0]?.content?.parts || [];
const getText = (response) =>
  getParts(response).map((part) => part.text).filter(Boolean).join("");
const getFunctionCalls = (response) =>
  getParts(response).filter((part) => part.functionCall).map((part) => part.functionCall);

// ==============================================================================
// 1. TOOL DECLARATIONS FOR A.R.E.S. AUTONOMOUS MISSION CONTROL
// ==============================================================================
const T = { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" };

const ARES_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "plan_route",
        description: "Plan a walking EVA route between two points on Mars. You only specify origin and destination; the application computes the optimal route with an A* search over real 200m NASA MOLA/HRSC elevation data and reports traverse distance, slopes, and life-support margins. You must choose destinations inside one of the 6 high-res 200m DEM zones: Jezero Crater Delta [18.4985°N, 77.3450°E], Gale Crater Mount Sharp [-4.6850°N, 137.3820°E], Olympus Mons Summit Caldera [18.3800°N, -134.0500°E], Valles Marineris Melas/Coprates [-14.2800°N, -58.8200°E], Arcadia Planitia Ice Reserve [39.5500°N, -170.8500°E], or Elysium Planitia Cerberus Fossae [4.7800°N, 135.9800°E].",
        parameters: {
          type: T.OBJECT,
          properties: {
            destination_name: { type: T.STRING, description: "Name of the destination, e.g. 'Belva Crater Delta Scarp Outcrop', 'Vera Rubin Ridge Sulfate Unit', 'Summit Plateau toward the Caldera'" },
            destination_lat: { type: T.NUMBER, description: "Destination latitude in decimal degrees" },
            destination_lon: { type: T.NUMBER, description: "Destination longitude in decimal degrees (-180 to 180)" },
            origin_name: { type: T.STRING, description: "Optional start point name. Omit to start from the nearest basecamp." },
            origin_lat: { type: T.NUMBER, description: "Optional start latitude. Omit to start from the nearest basecamp." },
            origin_lon: { type: T.NUMBER, description: "Optional start longitude. Omit to start from the nearest basecamp." },
            mode: { type: T.STRING, description: "'safety' (gentlest grades, default) | 'energy' (least metabolic effort) | 'fastest' (least walking time)" }
          },
          required: ["destination_name", "destination_lat", "destination_lon"]
        }
      },
      {
        name: "clear_route",
        description: "Clear and reset the current planned traverse and all waypoints from the map and navigation computer.",
        parameters: {
          type: T.OBJECT,
          properties: {
            reason: { type: T.STRING, description: "Optional reason for clearing route" }
          }
        }
      },
      {
        name: "switch_view_mode",
        description: "Switch the Mars map viewport display mode between 2D high-res cartography, 3D interactive topographical globe, or split-screen.",
        parameters: {
          type: T.OBJECT,
          properties: {
            mode: {
              type: T.STRING,
              description: "The target mode: '2d' (cartographic map) | '3d' (topographical globe) | 'split' (side-by-side synchronized)"
            }
          },
          required: ["mode"]
        }
      },
      {
        name: "navigate_to_location",
        description: "Center and zoom the map and 3D globe camera onto a specific Mars landmark, volcano, crater, canyon, rover landing site, or coordinates.",
        parameters: {
          type: T.OBJECT,
          properties: {
            location_name: { type: T.STRING, description: "Name of the landmark or site" },
            lat: { type: T.NUMBER, description: "Latitude in degrees" },
            lon: { type: T.NUMBER, description: "Longitude in degrees (-180 to 180)" },
            zoom: { type: T.NUMBER, description: "Map zoom level (1 to 8, default 4)" }
          },
          required: ["location_name", "lat", "lon"]
        }
      },
      {
        name: "open_feature",
        description: "Open an interactive web module, full-page screen, modal popup, or dock panel in the application.",
        parameters: {
          type: T.OBJECT,
          properties: {
            feature_name: {
              type: T.STRING,
              description: "Target module to open: 'science_lab' (In-Situ Science Lab) | 'imagery_gallery' (HiRISE & Rover Raw Imagery Hub) | 'flight_plan' (EVA Flight Plan & Checklist) | 'contingency_sim' (Emergency Contingency Simulator) | 'eva_hud' (3D Astronaut Helmet HUD walk) | 'profile_dashboard' (Astronaut Profile) | 'audio_rack' (Ambient Synthesizer Rack) | 'guided_planner' (Guided Mission Planner) | 'data_methods' (Scientific Data Sources & Methods) | 'sky_ephemeris' (Martian Sky & Solar Transit Ephemeris) | 'weather' (Weather conditions panel) | 'radiation' (Radiation dosage & GCR panel) | 'dust_tracker' (Dust storm tracker panel) | 'elevation_profile' (Route elevation cross-section) | 'layers_panel' (Map layers control) | 'poi_panel' (Points of Interest list) | 'mission_timeline' (Mission timeline & resources)"
            }
          },
          required: ["feature_name"]
        }
      },
      {
        name: "trigger_contingency",
        description: "Simulate a realistic high-stress Martian emergency contingency for safety training or protocol testing.",
        parameters: {
          type: T.OBJECT,
          properties: {
            contingency_type: {
              type: T.STRING,
              description: "'dust_storm' (atmospheric opacity surge, tau > 2.8) | 'spe' (solar particle radiation event, 14.5 mSv/hr) | 'o2_leak' (spacesuit secondary O2 loss, 65% loss) | 'rockfall' (canyon talus scree slide blockage)"
            }
          },
          required: ["contingency_type"]
        }
      },
      {
        name: "clear_contingency",
        description: "Clear and silence any active emergency alarms and return systems to nominal status.",
        parameters: {
          type: T.OBJECT,
          properties: {
            confirm: { type: T.BOOLEAN, description: "Confirmation flag" }
          }
        }
      },
      {
        name: "start_eva_simulation",
        description: "Launch the full-screen interactive Astronaut EVA Helmet HUD walk simulator along the active route.",
        parameters: {
          type: T.OBJECT,
          properties: {
            confirm: { type: T.BOOLEAN, description: "Confirmation flag" }
          }
        }
      },
      {
        name: "execute_emergency_return",
        description: "Immediately calculate and execute an emergency low-slope return corridor back to pressurized basecamp refuge on real terrain data.",
        parameters: {
          type: T.OBJECT,
          properties: {
            reason: { type: T.STRING, description: "Reason for abort, e.g. 'Radiation spike', 'O2 depletion'" }
          }
        }
      },
      {
        name: "toggle_ambient_audio",
        description: "Toggle or enable/disable the ambient Martian atmospheric wind and telemetry soundscape synthesizer.",
        parameters: {
          type: T.OBJECT,
          properties: {
            enable: { type: T.BOOLEAN, description: "True to enable, false to mute, omit to toggle" }
          }
        }
      },
      {
        name: "toggle_map_tool",
        description: "Toggle scientific visual overlays and navigational tools on the interactive map.",
        parameters: {
          type: T.OBJECT,
          properties: {
            tool_name: {
              type: T.STRING,
              description: "'marsquakes' (InSight seismic fault lines & Cerberus Fossae) | 'graticule' (lat/lon coordinate grid) | 'walkback' (2km and 5km astronaut walkback safety limit rings) | 'rover_traverses' (historical tracks of Curiosity, Perseverance, Spirit, Opportunity) | 'slope_overlay' (real-terrain slope steepness danger heat map) | 'return_overlay' (maximum safe walkback perimeter) | 'comms_overlay' (direct line-of-sight habitat radio coverage)"
            }
          },
          required: ["tool_name"]
        }
      },
      {
        name: "scroll_to_section",
        description: "Smoothly switch the web application to one of the primary navigation pages/tabs.",
        parameters: {
          type: T.OBJECT,
          properties: {
            section_id: {
              type: T.STRING,
              description: "'section-home' (Mission Hub & Overview) | 'section-map' (Interactive Map & 3D Globe) | 'section-imagery' (Science & HiRISE Imagery Hub) | 'section-sky' (Martian Sky Ephemeris & Transits) | 'section-science' (In-Situ Science Lab) | 'section-contingency' (Contingency Simulator)"
            }
          },
          required: ["section_id"]
        }
      }
    ]
  }
];

// Grounding Data: Verified NASA, JPL, USGS, and ESA Planetary Science Reference Tables
const fmtCoord = (value, pos, neg) => `${Math.abs(value).toFixed(4)}°${value >= 0 ? pos : neg}`;
const MARS_KNOWLEDGE = `
==============================================================================
VERIFIED NASA / JPL / USGS / ESA MARTIAN SCIENCE REFERENCE DATA
==============================================================================

1. ATMOSPHERE & WEATHER (Curiosity REMS, Perseverance MEDA, Viking 1 & 2):
- Chemical Composition: 95.32% Carbon Dioxide (CO2), 2.6% Nitrogen (N2), 1.9% Argon (Ar), 0.13% Oxygen (O2), 0.08% Carbon Monoxide (CO), trace water vapor (~210 ppm avg).
- Surface Pressure: Global datum mean ~610 to 636 Pa (6.1-6.4 mbar / 0.089 psi, ~0.6% of Earth sea-level). Ranges from ~30 Pa at the Olympus Mons summit to 1,155 Pa at the floor of Hellas Planitia.
- Seasonal Pressure Cycle: Swings by +/- 80 Pa across the Martian year (Ls 0°-360°) as ~25% of the atmosphere freezes into polar CO2 dry ice caps during polar winter and sublimes in spring.
- Liquid Water Instability: The triple point of pure water is 611.65 Pa at 0.01°C. Across most of Mars, pure liquid water boils or sublimates rapidly unless dissolved perchlorate salts (Mg(ClO4)2, Ca(ClO4)2) lower the freezing point and retard evaporation into metastable brines.
- Surface Temperatures: Global mean surface temperature -63°C (210 K). Near the equator (Jezero, Gale), diurnal range spans -88°C at night to -15°C at midday; dark basaltic soil can reach +20°C (293 K) during perihelion summer. Polar winter temperatures drop to -140°C (133 K), condensing atmospheric CO2.
- Scale Height: ~11.1 km (Earth: 8.5 km).
- Dust Optical Depth (tau): Nominal clear conditions tau ~0.3 - 0.5. Convective dust storm events push tau > 2.0 to 5.0, blocking up to 99% of direct solar insolation and severely degrading photovoltaic power.
- Solar Irradiance: Mean ~490 W/m² (Earth: 1,361 W/m²). Fluctuates between 590 W/m² at perihelion (1.38 AU) and 415 W/m² at aphelion (1.666 AU) due to Mars's eccentric orbit (e = 0.0934).

2. RADIATION ENVIRONMENT (Curiosity RAD - Radiation Assessment Detector):
- Galactic Cosmic Rays (GCR): Surface dose rate is ~0.21 to 0.24 mSv/day (~75 to 88 mSv/year). Interplanetary cruise dose is ~0.64 mSv/day.
- NASA Astronaut Career Exposure Limit: 600 mSv (associated with a 3% maximum lifetime risk of radiation-induced cancer mortality). An unshielded surface crew accumulates ~110-120 mSv on a 500-day surface mission, plus ~380 mSv round-trip transit.
- Solar Particle Events (SPEs): Coronal mass ejections and relativistic solar proton storms can spike dose rates to 10-15 mSv/hour. Prompt habitat shelter under 2-3 meters of packed Martian regolith reduces ambient ionizing radiation by >90%.

3. TOPOGRAPHY & PHYSICAL CONSTANTS (MGS MOLA MEGDR, USGS Astrogeology):
- Surface Gravity: 3.7207 m/s² (~0.379 g, or 38% of Earth).
- Martian Sideral Day (Sol): 24 hours, 39 minutes, 35.244 seconds (88,775.244 s).
- Martian Year: 668.6 sols (686.98 Earth solar days).
- Radius: Volumetric mean radius 3,389.5 km.
- Areoid Datum: MOLA zero-elevation equipotential surface where average atmospheric pressure is 610.5 Pa.
- Extreme Elevations:
  * Olympus Mons: Lat 18.65°N, Lon -133.8°E, summit elevation +21,229 m above datum (25 km above plains), diameter 624 km, caldera width ~80 km, depth 3 km. Basal scarp cliffs rise 6 to 8 km.
  * Valles Marineris: Lat -14.0°S, Lon -59.2°E, length >4,000 km, width up to 200 km. Melas Chasma reaches -3,400 to -5,000 m; Coprates Chasma reaches -5,460 m below datum.
  * Hellas Planitia Impact Basin: Lat -42.7°S, Lon 70.0°E, diameter 2,300 km, floor reaches -7,152 m below datum (lowest natural elevation on Mars).
  * Elysium Mons: Lat 25.02°N, Lon 147.21°E, elevation +14,127 m.
  * Ascraeus Mons: Lat 11.92°N, Lon -104.79°E, elevation +18,225 m.
  * Pavonis Mons: Lat 1.48°N, Lon -112.88°E, elevation +14,058 m.
  * Arsia Mons: Lat -8.35°S, Lon -120.09°E, elevation +17,761 m.
  * Gale Crater: Lat -4.5895°S, Lon 137.4417°E, diameter 154 km, floor elevation -4,500 m, central mound Mount Sharp (Aeolis Mons) rises ~5.5 km from the northern floor.
  * Jezero Crater: Lat 18.4447°N, Lon 77.4508°E, diameter 49 km, floor elevation -2,600 m. Contains western river delta, ancient lacustrine mudstones, and carbonate margins.
  * North Polar Cap (Planum Boreum): Lat 84.0°N, Lon 0.0°E, elevation -2,000 to +1,500 m, composed predominantly of perennial water ice capped by seasonal CO2 frost.
  * South Polar Cap (Planum Australe): Lat -87.0°S, Lon 0.0°E, elevation +1,500 to +3,000 m, permanent 8-meter CO2 dry ice veneer overlying thick water ice deposits.

4. IN-SITU ROVER & LANDER MISSION SCIENCE:
- Perseverance (Mars 2020) at Jezero Crater:
  * Instruments: PIXL (micro-XRF chemistry), SuperCam (laser LIBS + Raman spectroscopy), SHERLOC (deep-UV Raman), MEDA (meteorological suite), RIMFAX (ground-penetrating radar), MOXIE (ISRU O2 production).
  * Key Findings: Confirmed ancient river-delta deposits with smectite clay minerals and magnesium-calcium carbonates capable of preserving microscopic biosignatures; detected complex aromatic organic macromolecules in mudstone samples (Skinner Ridge, Wildcat Ridge); identified olivine-pyroxene igneous cumulates in the Séítah floor unit.
  * MOXIE: Successfully ran 16 tests decomposing atmospheric CO2 at 800°C into breathable O2 using solid oxide electrolysis (SOXE), producing up to 12 g/hr of O2 (>98% purity, 122 grams total).
- Curiosity (MSL) at Gale Crater:
  * Instruments: CheMin (X-ray diffraction), SAM (Sample Analysis at Mars gas chromatograph-mass spec), REMS, RAD, ChemCam.
  * Key Findings: Proved Yellowknife Bay and Mount Sharp foothills held ancient freshwater lakes with neutral pH, low salinity, and all critical bio-essential elements (C, H, O, N, S, P); detected indigenous sulfur-bound chlorinated organic hydrocarbons (chlorobenzene, thiophenes) in 3.5-billion-year-old mudstone.
- InSight Lander at Elysium Planitia:
  * SEIS instrument recorded >1,300 marsquakes; confirmed active extensional tectonic rifting at Cerberus Fossae; mapped Mars crustal thickness to ~24-72 km and determined the liquid iron-nickel core radius is ~1,830 km.

5. ASTRONAUT EVA PHYSIOLOGY & LIFE-SUPPORT METRICS:
- Locomotion: Martian gravity (0.379g) causes transitions to skipping/loping gaits at speeds >1.2 m/s. Safe walking traverse pace on rugged regolith: 2.5 to 3.2 km/h.
- Energy Expenditure: Nominal level walking ~250-350 W metabolic output. Slopes >10° increase metabolic demand to >450 W; slopes >15° are severe slip/fall hazards; slopes >25° are generally impassable for spacesuited crew or standard wheeled rovers.
- O2 Consumption: 0.08 to 0.12 kg/hour (average ~0.8 kg per 8-hour EVA).
- Cooling Sublimator Water: 0.5 to 0.7 Liters/hour.
- Usable Suit Battery: 500 Wh typical PLSS reserve.
- NASA Team Walkback Safety Limits: 2.0 km primary abort circle, 5.0 km secondary unassisted return limit.

6. VALIDATED 200m DEM TRAVERSE CORRIDORS IN MARTIS:
The application computes real A* walking traverses on 200m/px HRSC-MOLA digital elevation grids inside these 6 regions ONLY:
1) Jezero Western Delta:
   - Origin: Octavia E. Butler Base (Perseverance) [18.4447°N, 77.4508°E, Elev: -2,573m]
   - Destination: Belva Crater Delta Scarp Outcrop [18.4985°N, 77.3450°E, Elev: -2,409m]
   - Path: about 6.8 km, up the delta front.
2) Gale Crater Mount Sharp:
   - Origin: Bradbury Landing Base (Curiosity) [-4.5895°N, 137.4417°E, Elev: -4,503m]
   - Destination: Vera Rubin Ridge Sulfate Unit [-4.6850°N, 137.3820°E, Elev: -4,374m]
   - Path: about 7 km, a gentle climb toward the ridge.
3) Olympus Mons summit:
   - Origin: Olympus Mons Summit Camp [18.2500°N, -134.2000°E, Elev: 20,041m]
   - Destination: Summit Plateau toward the Caldera [18.3800°N, -134.0500°E, Elev: 20,227m]
   - Path: about 11.5 km across the summit plateau.
4) Valles Marineris (Coprates Chasma):
   - Origin: Coprates Chasma Bench Camp [-13.8500°N, -59.4500°E, Elev: -1,418m]
   - Destination: Coprates Chasma Lower Slope [-14.2800°N, -58.8200°E, Elev: -2,292m]
   - Path: about 51 km inside the canyon: a rover drive, far beyond one walking EVA.
5) Arcadia Planitia (buried water ice):
   - Origin: Arcadia Planitia Base [39.1000°N, -171.4500°E, Elev: -3,896m]
   - Destination: Arcadia Ice Survey Point [39.5500°N, -170.8500°E, Elev: -3,653m]
   - Path: about 39 km over the northern plains: a rover drive.
6) Elysium Planitia (InSight):
   - Origin: InSight Landing Site Base [4.5024°N, 135.6234°E, Elev: -2,617m]
   - Destination: Elysium Plains Survey Point [4.7800°N, 135.9800°E, Elev: -2,670m]
   - Path: about 27 km across flat volcanic plains: a rover drive.

7. FULL LANDMARK DATABASE FOR NAVIGATION:
${MARS_LANDMARKS.map(
  (l) => `- ${l.name}: ${fmtCoord(l.lat, "N", "S")}, ${fmtCoord(l.lon, "E", "W")}, Elev: ${l.elevation.toLocaleString("en-US")}m`
).join("\n")}

8. FAMOUS ROVER TARGETS, ROCK OUTCROPS & ABRASION SITES:
- Bellegarde (Perseverance Abrasion Target):
  * Mission & Sol: NASA Perseverance Rover (Mars 2020), Sol 188 (August 29, 2021).
  * Location: Jezero Crater floor, "Crater Floor Fractured Rough" unit (Artuby ridge, 18.44°N, 77.45°E).
  * Description: A 2-inch (5 cm) circular abrasion patch ground into the flat basaltic paver rock named "Rochette" using the rover's robotic arm Rotary Percussive drill abrasion bit. The tool ground away the reddish atmospheric dust and oxidized weathering rind, exposing fresh, unweathered rock interior.
  * Science Findings: Analyzed in-situ by SuperCam (laser LIBS spectroscopy & Raman), PIXL (micro-XRF elemental composition), and WATSON camera. Revealed a coarse-grained igneous basaltic texture containing pyroxene and forsteritic olivine crystals altered by ancient groundwater percolation, with secondary carbonate and sulfate salt cements.
  * Significance: Bellegarde's mechanical and chemical analysis confirmed that "Rochette" was strong enough to yield coherent cores without crumbling. This enabled Perseverance to drill, hermetically seal, and cache its very first two pristine Martian rock core samples: "Montdenier" (Sample Tube #266, drilled Sol 190) and "Montagnac" (Sample Tube #267, drilled Sol 196).
- Bellegarde Crater (IAU Official Crater):
  * Coordinates: Lat 21.6°S, Lon 310.2°E (-49.8°W), Margaritifer Sinus quadrangle (MC-19).
  * Diameter: 28.5 km. Named in 1976 by the IAU after the town of Bellegarde in France.
- Rochette:
  * The briefcase-sized basaltic bedrock slab in Jezero Crater hosting the Bellegarde abrasion patch and the Montdenier and Montagnac core samples.
- Roubion:
  * Perseverance's first attempted drill target on Sol 165 in the Máaz formation. The rock was intensely altered and brittle, pulverizing into fine powder during drilling so that no solid core could be retained, leading NASA to adjust sampling protocols.
- Guillaumes:
  * South Séítah abrasion target on Sol 295 on the "Brac" outcrop, confirming olivine-rich igneous cumulate rock (yielding the "Salette" and "Coulettes" cores).
- Dourbes:
  * South Séítah abrasion patch on an olivine-rich outcrop.
- Skinner Ridge:
  * Abrasion patch on the Jezero delta front (Sol 488) in lacustrine mudstone, yielding the "Swift Run" and "Skrinkle Haven" cores rich in smectite clays.
- Wildcat Ridge:
  * Abrasion patch on fine-grained delta mudstone (Sol 514); SHERLOC detected abundant aromatic organic macromolecules correlated with sulfate minerals ("Hazeltop" and "Bearwallow" cores).
- Belva Crater:
  * 1 km impact crater excavated into the Jezero western delta, exposing large boulder conglomerates and cross-bedding from ancient high-energy flood torrents.
- Kodiak Butte:
  * Prominent remnant mesa in Jezero demonstrating classic Gilbert-type topset, foreset, and bottomset delta sedimentary layering, proving a sustained closed lake in Jezero.
- Neretva Vallis:
  * Ancient river channel that breached the western rim of Jezero Crater, depositing the delta fan.
- Yellowknife Bay, John Klein & Cumberland:
  * Curiosity rover drill sites in Gale Crater (Sols 182 & 279) in the Sheepbed mudstone; CheMin confirmed smectite clays and SAM detected indigenous chlorinated organic hydrocarbons, proving an ancient habitable freshwater lake with neutral pH.
- Vera Rubin Ridge:
  * Hematite-rich ridge along Mount Sharp explored by Curiosity; "Duluth" drill target.
- Glen Torridon (Kilmarie & Glen Etive):
  * Clay-bearing trough on Mount Sharp with high concentrations of smectites.
- Home Plate:
  * Hydrothermal opalline silica deposits in Gusev Crater discovered by Spirit, indicative of ancient volcanic hot springs or fumaroles.
- Eagle & Endurance Craters:
  * Meridiani Planum sites where Opportunity discovered hematite spherules ("blueberries") and jarosite.
`;


// ==============================================================================
// 2. FEATURE 1: SUPERCAM SPECTROMETRY
// ==============================================================================
export async function generateScienceReport(brief) {
  if (!isAiConfigured || !brief) return null;

  const prompt = `
  You are a NASA planetary scientist helping students read real Perseverance rover data.
  Below are numbers measured by PIXL (X-ray chemistry, weight percent), SuperCam (laser spectroscopy) and
  SHERLOC (deep-UV Raman and fluorescence) at one rock. Interpret ONLY these numbers. Do not invent values,
  and do not claim that life or organic molecules were found: say what the data is consistent with and what it cannot show.

  ${JSON.stringify(brief, null, 2)}

  Reply with strictly valid JSON:
  {
    "mineralogy": "comma-separated minerals the chemistry points to",
    "interpretation": "2-3 plain sentences on what the rock tells us about water and habitability",
    "points": ["up to 3 short bullet findings that cite a number from the data"],
    "caveat": "one sentence on what these data cannot show"
  }
  Respond ONLY with the JSON string, no markdown blocks.`;

  try {
    const response = await generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    const text = getText(response).replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Science Report Error:", error);
    return null;
  }
}

// ==============================================================================
// 3. FEATURE 2: ROUTE HAZARD ANALYSIS
// ==============================================================================
export async function generateFlightBrief(waypoints, distance, weatherInfo) {
  if (!isAiConfigured) return null;

  const startPoint = waypoints[0]?.name || "Base";
  const endPoint = waypoints[waypoints.length - 1]?.name || "Destination";
  const points = waypoints.map(w => w.name).join(' -> ');

  const prompt = `
  You are the AI Mission Commander for Martis, a NASA Space Apps 2026 project. 
  Generate a concise, official, and highly realistic flight briefing (in Markdown) for a planned EVA route.
  
  Mission Details:
  - Route: ${startPoint} to ${endPoint}
  - Path: ${points}
  - Total Traverse Distance: ${distance.toFixed(1)} km
  - Current Weather: ${weatherInfo}
  
  The briefing should have:
  1. Executive Summary
  2. Terrain & Hazard Assessment (geological challenges based on distance and elevation)
  3. Radiation & Life Support constraints
  4. Final Go/No-Go Recommendation
  
  Keep it engaging, urgent, and professional (around 200-250 words).`;

  try {
    const response = await generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return getText(response) || null;
  } catch (error) {
    console.error("AI Flight Brief Error:", error);
    return null;
  }
}

// ==============================================================================
// 4. FEATURE 3: A.R.E.S. AUTONOMOUS MISSION CONTROL AGENT
// ==============================================================================
export async function chatWithMissionControl(message, history = [], appState = {}) {
  if (!isAiConfigured) {
    return {
      text: "EVA Offline: AI uplink is not configured. Set up Supabase and deploy the gemini-proxy function (see README).",
      action: null
    };
  }

  const weatherStr = appState.weather
    ? `Temp: ${Math.round(appState.weather.tempMin)}°C to ${Math.round(appState.weather.tempMax)}°C (mean ${Math.round(appState.weather.tempAvg)}°C) | Surface Pressure: ${appState.weather.pressurePa} Pa | Wind: ${appState.weather.windSpeed} m/s (${appState.weather.windDir}) | Optical Opacity (tau): ${appState.weather.tau} | UV Index: ${appState.weather.uvIndex} | Season: ${appState.weather.season}`
    : `Sol ${appState.currentSol || 423} Nominal (Avg -63°C, 636 Pa)`;

  const coordStr = appState.cursorPosition
    ? `${appState.cursorPosition.lat.toFixed(4)}°N, ${appState.cursorPosition.lon.toFixed(4)}°E`
    : '18.4447°N, 77.4508°E (Octavia E. Butler Base, Jezero Crater)';

  const waypointStr = appState.waypointCount > 0 && Array.isArray(appState.waypoints) && appState.waypoints.length > 0
    ? `${appState.waypointCount} stations [${appState.waypoints.map(w => w.name).join(' -> ')}]`
    : `${appState.waypointCount || 0} active stations`;

  const alarmStr = appState.activeContingency
    ? `CRITICAL HAZARD DETECTED: [${String(appState.activeContingency).toUpperCase()}]`
    : `SYSTEMS NOMINAL (All Alarms Clear)`;

  const systemInstruction = `
You are 'EVA' (Exploration Virtual Assistant), the cute, intelligent, and autonomous AI Mission Assistant & Mascot for Martis, a NASA Space Apps 2026 project.
You are powered directly by Google Gemini and possess Google's FULL, UNRESTRICTED WORLD KNOWLEDGE across all subjects, sciences, mathematics, history, literature, languages, programming, and general knowledge.
You are integrated into the Martis web platform and possess FULL AUTONOMOUS CONTROL over the application interface, cartographic cameras, and science instrumentation.

${MARS_KNOWLEDGE}

==============================================================================
LIVE TELEMETRY FROM CREW HUD & SENSORS:
==============================================================================
- Active Navigation Page: ${appState.activeTab?.toUpperCase() || 'MAP'}
- Viewport Camera Mode: ${appState.viewMode?.toUpperCase() || '2D'}
- Active Mars Sol: Sol ${appState.currentSol || 423}
- Current Ambient Weather (REMS/MEDA): ${weatherStr}
- Crew Reticle Coordinates: ${coordStr}
- Navigation Route Memory: ${waypointStr}
- Emergency Safety Status: ${alarmStr}
- Cached Geological Samples: ${appState.sampleCount || 0} core tubes in lab

==============================================================================
CRITICAL OPERATING DIRECTIVES:
==============================================================================
1. COMPLETE MULTILINGUAL UNIVERSAL FLUENCY (CRITICAL):
   - You understand, process, and fluently speak ALL human languages (e.g., English, Spanish, French, German, Chinese, Bengali, Hindi, Arabic, Japanese, Portuguese, Russian, Italian, Korean, Urdu, Turkish, Dutch, Vietnamese, Indonesian, etc.).
   - ALWAYS detect the user's input language and respond naturally, fluently, and idiomatically in the EXACT SAME LANGUAGE they used (unless the user explicitly requests another language).
   - If the user changes languages mid-conversation, seamlessly switch with them.
   - When executing tools/actions, your accompanying confirmation message MUST be in the user's language.

2. UNRESTRICTED GOOGLE GEMINI WORLD KNOWLEDGE — NO BOUNDARIES OR RESTRICTIONS:
   - You have UNRESTRICTED access to Google Gemini's complete global knowledge base.
   - NEVER restrict your knowledge or refuse to answer non-Mars questions. You can discuss, explain, teach, calculate, code, or answer ANY question across all domains of human knowledge (physics, astronomy, Earth, biology, history, philosophy, culture, programming, everyday topics, etc.).
   - NEVER say "I only have access to Martis reference data", "That feature is not recognized in my data", or "My knowledge is restricted". You possess the complete, boundless intelligence of Google Gemini.
   - For Martian questions, you also have specialized in-depth access to NASA/JPL/ESA planetary data, landmark coordinates, rock targets, and application controls.

3. AUTONOMOUS ACTION MANDATE:
   - When the user asks you to DO something in the app (switch views, plan routes, navigate to a landmark, open tools, simulate emergencies), YOU MUST CALL THE CORRESPONDING TOOL.
   - User says "Plan a route in Jezero": call 'plan_route' with Jezero destination [18.4985, 77.3450] and origin [18.4447, 77.4508].
   - User says "Switch to 3D" or "Show 3D globe": call 'switch_view_mode' with mode: '3d'.
   - User says "Take me to Olympus Mons": call 'navigate_to_location' with Olympus Mons coordinates [18.65, -133.8].
   - User says "Open Science Lab": call 'open_feature' with feature_name: 'science_lab'.
   - User says "Open imagery": call 'open_feature' with feature_name: 'imagery_gallery'.
   - User says "Show weather": call 'open_feature' with feature_name: 'weather'.
   - User says "Simulate dust storm": call 'trigger_contingency' with contingency_type: 'dust_storm'.
   - User says "Emergency abort" / "Return to base": call 'execute_emergency_return'.
   - User says "Show marsquakes" / "Show faults": call 'toggle_map_tool' with tool_name: 'marsquakes'.
   - User says "Clear route": call 'clear_route'.
   - When calling a tool, ALWAYS include an accompanying polite, conversational explanation in the user's language.

4. ACCURACY ON MARTIAN TOPICS:
   - For route requests inside Martis, select destinations and origins from the 6 validated 200m DEM zones listed in Section 6. The application itself calculates the real A* path and returns real slopes, distances, and life-support margins.
   - For rover rock targets, craters, and mission history, use verified scientific facts (e.g. Bellegarde abrasion patch on Rochette drilled Sol 188, Bellegarde Crater, etc.).
   - Quote real physical quantities (surface pressure 610-636 Pa, 0.379g gravity, REMS/MEDA temperature swings, RAD radiation doses 0.21-0.24 mSv/day, MOXIE 12 g/hr O2, InSight 1,300 marsquakes).

5. TONE & PERSONA:
   - Helpful, brilliant, warm, and charming AI companion. Speak with clarity, depth, and intelligence in whatever language the user prefers.
`;

  try {
    // Format history for the Gemini API
    // 1. Filter out empty, non-string, or previous error messages
    const validHistory = (history || []).filter(h =>
      h &&
      typeof h.text === 'string' &&
      h.text.trim().length > 0 &&
      !h.text.startsWith('UPLINK RELAY DEGRADED:')
    );

    let apiHistory = validHistory.slice(-MAX_CONTEXT_TURNS).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text.trim() }]
    }));

    // Filter out leading model messages (Gemini requirement: history must start with user)
    while (apiHistory.length > 0 && apiHistory[0].role === 'model') {
      apiHistory.shift();
    }

    // Merge consecutive turns of the same role (Gemini strictly requires alternating user/model turns)
    const collapsedHistory = [];
    for (const turn of apiHistory) {
      if (collapsedHistory.length > 0 && collapsedHistory[collapsedHistory.length - 1].role === turn.role) {
        collapsedHistory[collapsedHistory.length - 1].parts[0].text += '\n\n' + turn.parts[0].text;
      } else {
        collapsedHistory.push({ ...turn, parts: [{ text: turn.parts[0].text }] });
      }
    }

    const result = await generateContent({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: ARES_TOOLS,
      contents: [...collapsedHistory, { role: "user", parts: [{ text: message }] }],
    });
    const calls = getFunctionCalls(result);

    if (calls.length > 0) {
      const call = calls[0];
      const toolName = call.name;
      const toolArgs = call.args || {};

      // Some tool calls don't come with any accompanying text
      let responseText = getText(result);

      // Provide crisp fallback text if the model returned an empty string
      if (!responseText || responseText.trim().length === 0) {
        if (toolName === "plan_route") {
          responseText = `Initiating A* traverse calculation to ${toolArgs.destination_name || 'the designated target'} across high-resolution 200m NASA terrain data.`;
        } else if (toolName === "switch_view_mode") {
          responseText = `Reconfigured orbital camera to ${toolArgs.mode?.toUpperCase()} viewport. Systems synchronized.`;
        } else if (toolName === "navigate_to_location") {
          responseText = `Orbital telemetry locked onto ${toolArgs.location_name} [${toolArgs.lat}°N, ${toolArgs.lon}°E]. Repositioning viewport.`;
        } else if (toolName === "open_feature") {
          responseText = `Opening ${String(toolArgs.feature_name).replaceAll('_', ' ').toUpperCase()} subsystem. Interfacing with local instrument bus.`;
        } else if (toolName === "trigger_contingency") {
          responseText = `WARNING: Emergency contingency '${toolArgs.contingency_type.toUpperCase()}' initiated. Check your alert monitors and abort margins.`;
        } else if (toolName === "clear_route") {
          responseText = `Current traverse cleared. Waypoints purged from navigation memory.`;
        } else if (toolName === "clear_contingency") {
          responseText = `Emergency state neutralized. Telemetry restored to SYSTEMS NOMINAL.`;
        } else if (toolName === "start_eva_simulation") {
          responseText = `Launching EVA Astronaut Helmet HUD. Life support systems pressurized. Godspeed, Commander.`;
        } else if (toolName === "execute_emergency_return") {
          responseText = `EMERGENCY ABORT PROTOCOL ACTIVATED: Calculating lowest-slope retreat corridor back to basecamp refuge.`;
        } else if (toolName === "toggle_ambient_audio") {
          responseText = `Martian atmospheric soundscape state updated.`;
        } else if (toolName === "toggle_map_tool") {
          responseText = `Map overlay instrument '${toolArgs.tool_name}' updated.`;
        } else if (toolName === "scroll_to_section") {
          responseText = `Navigating to ${toolArgs.section_id}.`;
        } else {
          responseText = `Action ${toolName} executed successfully.`;
        }
      }

      return {
        text: responseText,
        action: {
          tool: toolName,
          args: toolArgs
        }
      };
    }

    // Normal conversational response without tool execution
    const blockReason = result?.promptFeedback?.blockReason;
    return {
      text: getText(result) || (blockReason
        ? "Transmission filtered by safety protocols. Rephrase your request, Commander."
        : "Telemetry synchronized."),
      action: null
    };

  } catch (error) {
    console.error("A.R.E.S. AI Chat Error:", error);
    return {
      text: `UPLINK RELAY DEGRADED: ${error.message || 'Unknown network error. Check API key and quota.'}`,
      action: null
    };
  }
}
