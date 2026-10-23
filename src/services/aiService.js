import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { MARS_LANDMARKS } from "../data/marsLandmarks";

const GEMINI_MODEL = "gemini-2.5-flash";
// Number of most recent chat messages forwarded to the model as context
const MAX_CONTEXT_TURNS = 20;

// The Gemini key must never ship in the production bundle. In production every request goes through
// the `gemini-proxy` Supabase Edge Function (see supabase/functions/gemini-proxy). The direct key is
// honoured in `vite dev` only; `import.meta.env.DEV` is false in builds so this branch is stripped out.
const DEV_API_KEY = import.meta.env.DEV ? import.meta.env.VITE_GEMINI_API_KEY : undefined;

export const isAiConfigured = Boolean(DEV_API_KEY) || isSupabaseConfigured;

/** Sends a Gemini `generateContent` request body and returns the parsed JSON response. */
async function generateContent(body) {
  if (DEV_API_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": DEV_API_KEY },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
    return res.json();
  }

  const { data, error } = await supabase.functions.invoke("gemini-proxy", {
    body: { model: GEMINI_MODEL, ...body },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error.message || data.error);
  return data;
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
        description: "Plan a walking EVA route between two points. You only choose WHERE (start and destination); the application itself computes the route with an A* search over real NASA MOLA/HRSC elevation data and reports distance, slopes and life-support use. Never invent waypoints, elevations or slopes.",
        parameters: {
          type: T.OBJECT,
          properties: {
            destination_name: { type: T.STRING, description: "Name of the destination, e.g. 'Belva Crater Delta Scarp', 'Mount Sharp foothills'" },
            destination_lat: { type: T.NUMBER, description: "Destination latitude in decimal degrees" },
            destination_lon: { type: T.NUMBER, description: "Destination longitude in decimal degrees (-180 to 180)" },
            origin_name: { type: T.STRING, description: "Optional start point name. Omit to start from the current base." },
            origin_lat: { type: T.NUMBER, description: "Optional start latitude. Omit to start from the current base." },
            origin_lon: { type: T.NUMBER, description: "Optional start longitude. Omit to start from the current base." },
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
            reason: { type: T.STRING, description: "Reason for clearing route" }
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
          type: T.OBJECT,
          properties: {
            location_name: { type: T.STRING, description: "Name of the landmark" },
            lat: { type: T.NUMBER, description: "Latitude in degrees" },
            lon: { type: T.NUMBER, description: "Longitude in degrees" },
            zoom: { type: T.NUMBER, description: "Map zoom level (1 to 7, default 3)" }
          },
          required: ["location_name", "lat", "lon"]
        }
      },
      {
        name: "open_feature",
        description: "Open an interactive web module or modal popup (Science Lab, Imagery Gallery, Flight Briefing, Contingency Simulator, EVA HUD, Audio Soundscape, User Profile).",
        parameters: {
          type: T.OBJECT,
          properties: {
            feature_name: {
              type: T.STRING,
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
          type: T.OBJECT,
          properties: {
            contingency_type: {
              type: T.STRING,
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
        name: "scroll_to_section",
        description: "Smoothly navigate the web page to one of the major exploration sections.",
        parameters: {
          type: T.OBJECT,
          properties: {
            section_id: {
              type: T.STRING,
              description: "'section-home' (Mission Overview) | 'section-map' (Interactive Map & 3D Globe) | 'section-imagery' (Science & HiRISE Imagery Hub) | 'section-sky' (Deep Space Ephemeris) | 'section-science' (Science Lab) | 'section-contingency' (Contingency Simulator)"
            }
          },
          required: ["section_id"]
        }
      }
    ]
  }
];

// Known Martian Landmarks for Grounding (generated from the shared landmark table so coordinates never drift)
const fmtCoord = (value, pos, neg) => `${Math.abs(value).toFixed(4)}°${value >= 0 ? pos : neg}`;
const MARS_KNOWLEDGE = `
FAMOUS MARTIAN LANDMARKS & ACCURATE COORDINATES:
${MARS_LANDMARKS.map(
  (l) => `- ${l.name}: ${fmtCoord(l.lat, "N", "S")}, ${fmtCoord(l.lon, "E", "W")}, Elev: ${l.elevation.toLocaleString("en-US")}m`
).join("\n")}
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
2. DO NOT ASK the user for coordinates. For route requests pick the destination (and, only if asked, the start) from the landmark list or your Mars knowledge and call 'plan_route' immediately. You never write waypoints, elevations or slopes yourself: the app computes the route on real NASA elevation data, and you must not claim figures about slope, distance or safety that the app has not reported. Routes can only be planned inside the 200 m terrain areas: Jezero, Gale/Mount Sharp, Olympus Mons summit, Melas Chasma, Coprates Chasma, Arcadia Planitia and Elysium Planitia (about 90 km wide each).
3. Keep your spoken responses concise, authoritative, and immersive, speaking like a calm, sharp NASA Mission Director at Houston/JPL.
4. If the user asks a factual question, answer concisely using authentic Mars science (MEDA weather, MOLA topography, HiRISE optics, Perseverance/Curiosity findings).
`;

  try {
    // Format history for the Gemini API
    let apiHistory = history.slice(-MAX_CONTEXT_TURNS).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    // Filter out leading model messages (Gemini requirement: history must start with user)
    while (apiHistory.length > 0 && apiHistory[0].role === 'model') {
      apiHistory.shift();
    }

    const result = await generateContent({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: ARES_TOOLS,
      contents: [...apiHistory, { role: "user", parts: [{ text: message }] }],
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
          responseText = `Planning a walking route to ${toolArgs.destination_name || 'the designated target'} on real terrain data.`;
        } else if (toolName === "switch_view_mode") {
          responseText = `Reconfigured orbital camera to ${toolArgs.mode?.toUpperCase()} viewport. Systems synchronized.`;
        } else if (toolName === "navigate_to_location") {
          responseText = `Orbital tracking locked onto ${toolArgs.location_name} [${toolArgs.lat}°N, ${toolArgs.lon}°E]. Repositioning viewport.`;
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
