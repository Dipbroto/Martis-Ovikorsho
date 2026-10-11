import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';

export default function AresFloatingButton() {
  const isAresCopilotOpen = useMapStore(s => s.isAresCopilotOpen);
  const setAresCopilotOpen = useMapStore(s => s.setAresCopilotOpen);

  if (isAresCopilotOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[500] pointer-events-auto">
      <button
        onClick={() => {
          marsAudio.playUiClick?.();
          setAresCopilotOpen(true);
        }}
        className="group relative flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#090C14]/90 hover:bg-[#0E1220] border border-purple-500/50 hover:border-purple-400 text-white shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.35)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_35px_rgba(168,85,247,0.6)] backdrop-blur-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        title="Open Autonomous A.R.E.S. Mission Copilot (Natural Language Web Control)"
      >
        {/* Glowing backdrop pulse */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600/20 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Icon & Live status pill */}
        <div className="relative flex items-center justify-center">
          <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-400/60 flex items-center justify-center text-purple-300 group-hover:text-white transition-colors">
            <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#090C14]" />
        </div>

        {/* Text Details */}
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-black text-xs tracking-wider uppercase text-white group-hover:text-purple-200 transition-colors">
              A.R.E.S. AI
            </span>
            <span className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              AGENT
            </span>
          </div>
          <span className="text-[9px] font-mono text-stone-400 group-hover:text-cyan-300 transition-colors">
            Autonomous Web Control
          </span>
        </div>
      </button>
    </div>
  );
}
