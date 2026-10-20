import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Trash2, Sparkles, CheckCircle2, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { chatWithMissionControl } from '../services/aiService';
import { loadChatHistory, saveChatMessage, clearChatHistory } from '../services/chatHistoryService';
import { marsAudio } from '../utils/audioSynthesizer';

const SUGGESTIONS = [
  { label: "🗺️ Plan Jezero Delta Traverse", text: "Plan a 4-waypoint exploration traverse across the Jezero Crater ancient river delta." },
  { label: "🌐 Switch to 3D Globe View", text: "Switch the map viewport to 3D topographical globe view." },
  { label: "🌋 Inspect Olympus Mons", text: "Fly to Olympus Mons and analyze the caldera." },
  { label: "🔬 Open Science Lab", text: "Open the In-Situ Science Lab module." },
  { label: "⚠️ Simulate Dust Storm", text: "Simulate a severe Martian dust storm contingency." },
  { label: "🚶 Start EVA HUD Walk", text: "Start the Astronaut EVA Helmet HUD walk simulation." }
];

export default function AresCopilotModal() {
  const isAresCopilotOpen = useMapStore(s => s.isAresCopilotOpen);
  const setAresCopilotOpen = useMapStore(s => s.setAresCopilotOpen);
  const user = useMapStore(s => s.user);

  // Map Store actions for autonomous execution
  const viewMode = useMapStore(s => s.viewMode);
  const currentSol = useMapStore(s => s.currentSol);
  const cursorPosition = useMapStore(s => s.cursorPosition);
  const waypoints = useMapStore(s => s.waypoints);
  const setWaypoints = useMapStore(s => s.setWaypoints);
  const clearWaypoints = useMapStore(s => s.clearWaypoints);
  const setViewMode = useMapStore(s => s.setViewMode);
  const flyToCoordinate = useMapStore(s => s.flyToCoordinate);
  const setSidebarTab = useMapStore(s => s.setSidebarTab);
  const setSidebarOpen = useMapStore(s => s.setSidebarOpen);
  const setScienceLabOpen = useMapStore(s => s.setScienceLabOpen);
  const setFlightPlanOpen = useMapStore(s => s.setFlightPlanOpen);
  const setImageryModalOpen = useMapStore(s => s.setImageryModalOpen);
  const setContingencyModalOpen = useMapStore(s => s.setContingencyModalOpen);
  const triggerContingency = useMapStore(s => s.triggerContingency);
  const clearContingency = useMapStore(s => s.clearContingency);
  const setEVASimulating = useMapStore(s => s.setEVASimulating);
  const toggleAudio = useMapStore(s => s.toggleAudio);
  const setProfileModalOpen = useMapStore(s => s.setProfileModalOpen);
  const setActiveTab = useMapStore(s => s.setActiveTab);
  const setAudioRackOpen = useMapStore(s => s.setAudioRackOpen);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeActionNotification, setActiveActionNotification] = useState(null);
  const scrollRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // Load chat history from Supabase / localStorage on mount or user change
  useEffect(() => {
    let isMounted = true;
    loadChatHistory(user?.id).then(history => {
      if (isMounted) setMessages(history);
    });
    return () => { isMounted = false; };
  }, [user?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Execute Autonomous Tool Actions directly on the Web App
  const executeAutonomousAction = (action) => {
    if (!action || !action.tool) return null;

    const { tool, args = {} } = action;
    marsAudio.playQuindarTone?.(true);

    let summaryText = "";

    switch (tool) {
      case "plan_route": {
        const generatedWps = (args.waypoints || []).map((wp, idx) => ({
          id: `wp-ai-${Date.now()}-${idx}`,
          name: wp.name || `Station ${idx + 1}`,
          lat: Number(wp.lat),
          lon: Number(wp.lon),
          elevation: Number(wp.elevation || -2500)
        }));

        if (generatedWps.length > 0) {
          setWaypoints(generatedWps);
          setSidebarTab('route');
          setSidebarOpen(true);
          flyToCoordinate(generatedWps[0].lat, generatedWps[0].lon, 4);
          setActiveTab('map');
          summaryText = `Plotted route: ${args.destination_name || 'Target Region'} (${generatedWps.length} stations)`;
        }
        break;
      }

      case "clear_route": {
        clearWaypoints();
        summaryText = "Cleared active traverse and purged waypoints.";
        break;
      }

      case "switch_view_mode": {
        const mode = (args.mode || '2d').toLowerCase();
        if (['2d', '3d', 'split'].includes(mode)) {
          setViewMode(mode);
          setActiveTab('map');
          summaryText = `Switched viewport to ${mode.toUpperCase()} mode.`;
        }
        break;
      }

      case "navigate_to_location": {
        const lat = Number(args.lat);
        const lon = Number(args.lon);
        const zoom = Number(args.zoom) || 4;
        flyToCoordinate(lat, lon, zoom);
        setActiveTab('map');
        summaryText = `Centered camera on ${args.location_name} [${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E].`;
        break;
      }

      case "open_feature": {
        const feature = args.feature_name;
        if (feature === 'science_lab') setScienceLabOpen(true);
        else if (feature === 'flight_plan') setFlightPlanOpen(true);
        else if (feature === 'imagery_gallery') setImageryModalOpen(true);
        else if (feature === 'contingency_sim') setContingencyModalOpen(true);
        else if (feature === 'eva_hud') setEVASimulating(true);
        else if (feature === 'profile_dashboard') setProfileModalOpen(true);
        else if (feature === 'audio_rack') setAudioRackOpen(true);
        summaryText = `Opened module: ${String(feature).replaceAll('_', ' ').toUpperCase()}`;
        break;
      }

      case "trigger_contingency": {
        const type = args.contingency_type || 'dust_storm';
        triggerContingency(type);
        setActiveTab('map');
        summaryText = `Initiated emergency contingency: ${type.toUpperCase()}`;
        break;
      }

      case "clear_contingency": {
        clearContingency();
        summaryText = "Reset emergency contingency. Alarms silenced.";
        break;
      }

      case "start_eva_simulation": {
        setEVASimulating(true);
        setActiveTab('map');
        summaryText = "Initialized EVA Astronaut Helmet HUD.";
        break;
      }

      case "toggle_ambient_audio": {
        toggleAudio();
        summaryText = "Toggled Martian ambient soundscape.";
        break;
      }

      case "scroll_to_section": {
        const secId = args.section_id || 'section-map';
        const tab = secId.replace('section-', '');
        if (['home', 'map', 'imagery', 'sky', 'science', 'contingency'].includes(tab)) {
          setActiveTab(tab);
          summaryText = `Navigated view to ${tab.toUpperCase()}`;
        }
        break;
      }

      default:
        console.warn("Unrecognized tool call:", tool);
    }

    if (summaryText) {
      setActiveActionNotification(summaryText);
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setActiveActionNotification(null), 4000);
    }

    return summaryText;
  };

  const handleSend = async (messageText = input) => {
    if (!messageText.trim() || isProcessing) return;

    const query = messageText.trim();
    setInput('');
    marsAudio.playUiClick?.();

    // 1. Save and render user message immediately
    const userMsg = await saveChatMessage({
      userId: user?.id,
      role: 'user',
      text: query
    });
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // 2. Telemetry state snapshot for Gemini context
      const appState = {
        viewMode,
        currentSol,
        cursorPosition,
        waypointCount: waypoints?.length || 0
      };

      // 3. Request Gemini Agent response
      const agentResult = await chatWithMissionControl(query, messages, appState);

      // 4. If autonomous action was returned, execute it!
      let actionExecutedSummary = null;
      if (agentResult?.action) {
        actionExecutedSummary = executeAutonomousAction(agentResult.action);
      }

      // 5. Persist and render AI message
      const modelMsg = await saveChatMessage({
        userId: user?.id,
        role: 'model',
        text: agentResult?.text || "Telemetry synchronized.",
        actionData: agentResult?.action ? {
          ...agentResult.action,
          executionSummary: actionExecutedSummary
        } : null
      });

      setMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      console.error("A.R.E.S. command failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearHistory = async () => {
    marsAudio.playUiClick?.();
    const freshHistory = await clearChatHistory(user?.id);
    setMessages(freshHistory);
  };

  return (
    <AnimatePresence>
      {isAresCopilotOpen && (
      <div key="ares-copilot" className="fixed inset-0 z-[600] pointer-events-none flex items-end sm:items-center justify-end sm:p-6 p-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className={`pointer-events-auto bg-[#07090E]/95 border border-purple-500/40 rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(168,85,247,0.2)] backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isExpanded 
              ? 'w-full sm:w-[650px] h-[88vh] max-h-[850px]' 
              : 'w-full sm:w-[480px] h-[75vh] max-h-[640px]'
          }`}
        >
          {/* HEADER */}
          <div className="p-4 border-b border-purple-500/25 bg-purple-950/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-cyan-400/60 shadow-[0_0_18px_rgba(6,182,212,0.45)] bg-[#04060b] flex items-center justify-center shrink-0">
                  <img src="/ares-mascot.jpg" alt="EVA Mascot" className="w-full h-full object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#07090E] animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-black text-sm tracking-widest text-white uppercase">EVA COPILOT</h3>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    AUTONOMOUS
                  </span>
                </div>
                <p className="text-[10px] font-mono text-cyan-300/80">
                  {user ? `Connected: ${user.email}` : 'Autonomous Martian Flight Agent · EVA AI'}
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearHistory}
                className="p-2 rounded-xl text-stone-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                title="Clear Conversation History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer hidden sm:block"
                title={isExpanded ? "Collapse Window" : "Expand Window"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  marsAudio.playUiClick?.();
                  setAresCopilotOpen(false);
                }}
                className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer"
                title="Close A.R.E.S."
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* REAL-TIME ACTION TOAST BANNER */}
          <AnimatePresence>
            {activeActionNotification && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-emerald-950/60 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between text-emerald-300 text-xs font-mono shrink-0"
              >
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                  <span className="font-bold uppercase tracking-wider text-[10px]">Action Executed:</span>
                  <span className="truncate">{activeActionNotification}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MESSAGES CONTAINER */}
          <div 
            ref={scrollRef} 
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar-y"
          >
            {messages.map((msg, idx) => (
              <div 
                key={msg.id || idx} 
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
              >
                <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-mono tracking-wider opacity-90">
                  {msg.role === 'user' ? (
                    <span className="text-cyan-400 uppercase font-semibold">COMMANDER</span>
                  ) : (
                    <span className="text-cyan-300 uppercase font-semibold flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full overflow-hidden border border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.4)] shrink-0">
                        <img src="/ares-mascot.jpg" alt="EVA" className="w-full h-full object-cover" />
                      </div>
                      <span>EVA · MISSION COPILOT</span>
                    </span>
                  )}
                </div>

                <div 
                  className={`p-3.5 rounded-2xl max-w-[90%] text-xs font-mono leading-relaxed shadow-md ${
                    msg.role === 'user'
                      ? 'bg-cyan-950/40 border border-cyan-500/40 text-cyan-50 rounded-br-none'
                      : 'bg-purple-950/30 border border-purple-500/35 text-stone-100 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* ACTION BADGE */}
                  {msg.actionData && (
                    <div className="mt-2.5 pt-2 border-t border-purple-400/20 flex flex-col gap-1 text-[10px]">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Autonomous Web Action Executed</span>
                      </div>
                      <div className="bg-black/50 p-2 rounded-lg border border-purple-500/20 text-purple-200">
                        <span className="text-purple-400 font-bold">[{msg.actionData.tool}]</span>{' '}
                        {msg.actionData.executionSummary || JSON.stringify(msg.actionData.args)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-mono tracking-wider text-purple-400 opacity-60 mb-1 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> EVA PROCESSING
                </span>
                <div className="p-3.5 rounded-2xl bg-purple-950/25 border border-purple-500/30 text-purple-200 text-xs font-mono flex items-center gap-2.5 shadow-md">
                  <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  <span>Synthesizing Mars telemetry and executing requested operations...</span>
                </div>
              </div>
            )}
          </div>

          {/* QUICK ACTION CHIPS */}
          <div className="px-3 pt-2 pb-1 border-t border-white/[0.06] bg-black/40 overflow-x-auto custom-scrollbar-x flex items-center gap-1.5 shrink-0">
            {SUGGESTIONS.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSend(sug.text)}
                disabled={isProcessing}
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-purple-600/20 text-purple-200/80 hover:text-purple-100 border border-white/[0.08] hover:border-purple-400/50 text-[10px] font-mono whitespace-nowrap transition-all cursor-pointer disabled:opacity-40 shrink-0"
              >
                {sug.label}
              </button>
            ))}
          </div>

          {/* INPUT FORM */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
            className="p-3 border-t border-purple-500/25 bg-[#090C14] flex items-center gap-2 shrink-0"
          >
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Give command (e.g. 'Plan route in Jezero', 'Switch to 3D')..."
                className="w-full bg-black/60 border border-purple-500/30 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder:text-stone-500 outline-none transition-colors"
                disabled={isProcessing}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/50 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dispatch</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
