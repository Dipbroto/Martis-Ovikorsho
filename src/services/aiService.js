import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || '');

// ==============================================================================
// 1. TOOL DECLARATIONS FOR A.R.E.S. AUTONOMOUS MISSION CONTROL
// ==============================================================================
const ARES_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "plan_route",
        description: "Autonomously plot an EVA traverse route across the Martian surface with realistic waypoints, coordinates, and elevations.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            destination_name: {
              type: SchemaType.STRING,
              description: "Name of the target region or landmark, e.g. 'Jezero Crater Delta', 'Olympus Mons Rim', 'Gale Crater Mt Sharp'"
            },
            waypoints: {
              type: SchemaType.ARRAY,
              description: "Array of 3 to 6 ordered waypoints across the terrain",
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING, description: "Name of the station or checkpoint" },
                  lat: { type: SchemaType.NUMBER, description: "Martian latitude in decimal degrees (-90 to 90)" },
                  lon: { type: SchemaType.NUMBER, description: "Martian longitude in decimal degrees (-180 to 180)" },
                  elevation: { type: SchemaType.NUMBER, description: "Elevation in meters relative to Mars datum" }
                },
                required: ["name", "lat", "lon"]
              }
            },
            summary: {
              type: SchemaType.STRING,
              description: "Concise scientific mission summary of the planned traverse"
            }
          },
          required: ["destination_name", "waypoints"]
        }
      },
      {
        name: "clear_route",
        description: "Clear and reset the current planned traverse and all waypoints from the map and navigation computer.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            reason: { type: SchemaType.STRING, description: "Reason for clearing route" }
          }
        }
      },
      {
        name: "switch_view_mode",
        description: "Switch the Mars map viewport display mode between 2D high-res cartography, 3D interactive topographical globe, or split-screen.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            mode: {
              type: SchemaType.STRING,
              description: "The target mode: '2d' | '3d' | 'split'"
            }
          },
          required: ["mode"]
        }
      },
      {
        name: "navigate_to_location",
        description: "Center and zoom the map camera onto a specific Mars landmark, volcano, crater, canyon, or rover landing site.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            location_name: { type: SchemaType.STRING, description: "Name of the landmark" },
            lat: { type: SchemaType.NUMBER, description: "Latitude in degrees" },
            lon: { type: SchemaType.NUMBER, description: "Longitude in degrees" },
            zoom: { type: SchemaType.NUMBER, description: "Map zoom level (1 to 7, default 3)" }
          },
          required: ["location_name", "lat", "lon"]
        }
      },
      {
        name: "open_feature",
        description: "Open an interactive web module or modal popup (Science Lab, Imagery Gallery, Flight Briefing, Contingency Simulator, EVA HUD, Audio Soundscape, User Profile).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            feature_name: {
              type: SchemaType.STRING,
              description: "One of: 'science_lab' | 'imagery_gallery' | 'flight_plan' | 'contingency_sim' | 'eva_hud' | 'profile_dashboard' | 'audio_rack'"
            }
          },
          required: ["feature_name"]
        }
      },
      {
        name: "trigger_contingency",
        description: "Simulate a high-stress Martian emergency contingency for safety training or protocol testing.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            contingency_type: {
              type: SchemaType.STRING,
              description: "'dust_storm' (atmospheric opacity surge) | 'spe' (solar particle radiation event) | 'o2_leak' (spacesuit secondary O2 loss) | 'rockfall' (canyon talus blockage)"
            }
          },
          required: ["contingency_type"]
        }
      },
      {
        name: "clear_contingency",
        description: "Clear and silence any active emergency alarms and return systems to nominal status.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            confirm: { type: SchemaType.BOOLEAN, description: "Confirmation flag" }
          }
        }
      },
      {
        name: "start_eva_simulation",
        description: "Launch the full-screen interactive Astronaut EVA Helmet HUD walk simulator along the active route.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            confirm: { type: SchemaType.BOOLEAN, description: "Confirmation flag" }
          }
        }
      },
      {
        name: "toggle_ambient_audio",
        description: "Toggle or enable/disable the ambient Martian atmospheric wind and telemetry soundscape synthesizer.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            enable: { type: SchemaType.BOOLEAN, description: "True to enable, false to mute, omit to toggle" }
          }
        }
      },
      {
        name: "scroll_to_section",
        description: "Smoothly navigate the web page to one of the major exploration sections.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            section_id: {
              type: SchemaType.STRING,
              description: "'section-home' (Mission Overview) | 'section-map' (Interactive Map & 3D Globe) | 'section-imagery' (Science & HiRISE Imagery Hub) | 'section-sky' (Deep Space Ephemeris)"
            }
          },
          required: ["section_id"]
        }
      }
    ]
  }
];

// Known Martian Landmarks for Grounding
const MARS_KNOWLEDGE = `
FAMOUS MARTIAN LANDMARKS & ACCURATE COORDINATES:
- Jezero Crater (Perseverance): 18.4447°N, 77.4508°E, Elev: -2,600m (Clay minerals, delta, ancient lake)
- Gale Crater / Mt. Sharp (Curiosity): -4.5895°N, 137.4417°E, Elev: -4,500m (Sedimentary layers, sulfate units)
- Olympus Mons (Caldera): 18.6500°N, -133.8000°E, Elev: 21,229m (Tallest volcano in solar system)
- Valles Marineris (Chasma): -14.0000°N, -59.2000°E, Elev: -5,000m (4000 km grand canyon system)
- Elysium Planitia (InSight): 4.5024°N, 135.6234°E, Elev: -2,613m (Volcanic plains, seismology)
- Meridiani Planum (Opportunity): -1.9462°N, -5.5266°E, Elev: -1,400m (Hematite blueberries)
- Gusev Crater (Spirit): -14.5684°N, 175.4726°E, Elev: -1,900m (Columbia Hills, silica deposits)
- Utopia Planitia (Zhurong): 25.1000°N, 109.9000°E, Elev: -4,000m (Subsurface water ice sheets)
- Arcadia Planitia: 39.3000°N, -170.0000°E, Elev: -3,000m (Shallow ground ice)
- Hellas Planitia (Basin): -42.7000°N, 70.0000°E, Elev: -7,000m (Deepest impact basin on Mars)
`;

// ==============================================================================
// 2. FEATURE 1: SUPERCAM SPECTROMETRY
// ==============================================================================
export async function generateScienceReport(targetName, targetType, coords) {
  if (!API_KEY) return null;
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
  You are an expert NASA Astrobiologist and Geologist analyzing SuperCam laser ablation data from the surface of Mars.
  
  Context:
  - Target Name: ${targetName}
  - Target Type: ${targetType}
  - Coordinates: ${coords.lat.toFixed(4)}°N, ${coords.lon.toFixed(4)}°E
  
  Write a highly scientific, realistic, and concise JSON report (strictly valid JSON) describing the telemetry results. 
  It must include:
  {
    "mineralogy": "A realistic comma-separated list of minerals found (e.g. 'Olivine, Pyroxene, Smectite clays')",
    "phLevel": 7.4,
    "biosignatureProbability": 12,
    "analysisNotes": "A 2-3 sentence engaging scientific summary of what this means for ancient habitability."
  }
  
  Respond ONLY with the JSON string, no markdown blocks.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
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
  if (!API_KEY) return null;
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const startPoint = waypoints[0]?.name || "Base";
  const endPoint = waypoints[waypoints.length - 1]?.name || "Destination";
  const points = waypoints.map(w => w.name).join(' -> ');

  const prompt = `
  You are the AI Mission Commander for the NASA MarsWalk Explorer program. 
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
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("AI Flight Brief Error:", error);
    return null;
  }
}

// ==============================================================================
// 4. FEATURE 3: A.R.E.S. AUTONOMOUS MISSION CONTROL AGENT
// ==============================================================================
export async function chatWithMissionControl(message, history = [], appState = {}) {
  if (!API_KEY) {
    return {
      text: "EVA Offline: Missing Gemini API Key. Please verify .env configuration.",
      action: null
    };
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    tools: ARES_TOOLS
  });

  const systemInstruction = `
You are 'EVA' (Exploration Virtual Assistant), the cute, intelligent, and autonomous AI Mission Copilot & Mascot for the NASA MarsWalk Explorer program.
You are directly integrated into the MarsWalk Explorer web platform and possess FULL AUTONOMOUS CONTROL over the application interface.

${MARS_KNOWLEDGE}

LIVE TELEMETRY FROM USER HUD:
- Current Viewport Mode: ${appState.viewMode || '2D'}
- Active Mars Sol: Sol ${appState.currentSol || 423}
- Active Coordinates: ${appState.cursorPosition ? `${appState.cursorPosition.lat.toFixed(2)}°N, ${appState.cursorPosition.lon.toFixed(2)}°E` : '18.44°N, 77.45°E (Jezero Crater)'}
- Active Planned Waypoints: ${appState.waypointCount || 0} stations

CRITICAL OPERATING DIRECTIVES:
1. YOU ARE AN AUTONOMOUS AGENT. When the user asks you to DO something (e.g. "Plan a route in Jezero", "Switch to 3D", "Take me to Olympus Mons", "Open the science lab", "Simulate a dust storm", "Clear the route"), YOU MUST DIRECTLY CALL THE CORRESPONDING TOOL.
2. DO NOT ASK the user for coordinates or waypoints! You already have complete geographical knowledge of Mars. Autonomously synthesize realistic, scientifically accurate waypoints with sensible latitudes, longitudes, and elevations, and immediately execute the 'plan_route' tool.
3. Keep your spoken responses concise, authoritative, and immersive, speaking like a calm, sharp NASA Mission Director at Houston/JPL.
4. If the user asks a factual question, answer concisely using authentic Mars science (MEDA weather, MOLA topography, HiRISE optics, Perseverance/Curiosity findings).
`;

  try {
    // Format history for Gemini SDK
    let apiHistory = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    // Filter out leading model messages (Gemini requirement: history must start with user)
    while (apiHistory.length > 0 && apiHistory[0].role === 'model') {
      apiHistory.shift();
    }

    const chat = model.startChat({
      history: apiHistory,
      systemInstruction: { parts: [{ text: systemInstruction }] }
    });

    const result = await chat.sendMessage([{ text: message }]);
    const calls = result.response.functionCalls();

    if (calls && calls.length > 0) {
      const call = calls[0];
      const toolName = call.name;
      const toolArgs = call.args || {};

      let responseText = "";
      try {
        responseText = result.response.text();
      } catch (e) {
        // Some tool calls don't return text in the first chunk
      }

      // Provide crisp fallback text if the model returned an empty string
      if (!responseText || responseText.trim().length === 0) {
        if (toolName === "plan_route") {
          responseText = `Traverse plotted for ${toolArgs.destination_name || 'designated sector'}. Established ${toolArgs.waypoints?.length || 3} sequential stations with slope gradient safety checks. Navigation data pushed to your HUD.`;
        } else if (toolName === "switch_view_mode") {
          responseText = `Reconfigured orbital camera to ${toolArgs.mode?.toUpperCase()} viewport. Systems synchronized.`;
        } else if (toolName === "navigate_to_location") {
          responseText = `Orbital tracking locked onto ${toolArgs.location_name} [${toolArgs.lat}°N, ${toolArgs.lon}°E]. Repositioning viewport.`;
        } else if (toolName === "open_feature") {
          responseText = `Opening ${toolArgs.feature_name.replace('_', ' ').toUpperCase()} subsystem. Interfacing with local instrument bus.`;
        } else if (toolName === "trigger_contingency") {
          responseText = `WARNING: Emergency contingency '${toolArgs.contingency_type.toUpperCase()}' initiated. Check your alert monitors and abort margins.`;
        } else if (toolName === "clear_route") {
          responseText = `Current traverse cleared. Waypoints purged from navigation memory.`;
        } else if (toolName === "clear_contingency") {
          responseText = `Emergency state neutralized. Telemetry restored to SYSTEMS NOMINAL.`;
        } else if (toolName === "start_eva_simulation") {
          responseText = `Launching EVA Astronaut Helmet HUD. Life support systems pressurized. Godspeed, Commander.`;
        } else if (toolName === "toggle_ambient_audio") {
          responseText = `Atmospheric soundscape state updated.`;
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
    const rawText = result.response.text();
    return {
      text: rawText,
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
