import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Volume2,
  VolumeX,
  Radio,
  Wind,
  Heart,
  Zap,
  Sliders,
  Play,
  Pause,
  Activity,
  Mic,
  Disc,
  Info,
} from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { marsAudio, NASA_AUDIO_TRACKS } from '../utils/audioSynthesizer';
import ProvenanceBadge from './ProvenanceBadge';

export default function AudioSynthesizerRack() {
  const { isAudioRackOpen, setAudioRackOpen, isAudioActive, toggleAudio } = useMapStore(
    useShallow((s) => ({
      isAudioRackOpen: s.isAudioRackOpen,
      setAudioRackOpen: s.setAudioRackOpen,
      isAudioActive: s.isAudioActive,
      toggleAudio: s.toggleAudio,
    }))
  );

  // Tab: 'nasa' (Official NASA Acoustic Recordings) | 'procedural' (Synthesizer Life-support)
  const [activeTab, setActiveTab] = useState('nasa');

  // Procedural volumes
  const [windVol, setWindVol] = useState(0.25);
  const [breathVol, setBreathVol] = useState(0.04);
  const [geigerVol, setGeigerVol] = useState(0.06);

  // NASA Audio track state tracking
  const [nasaPlayingState, setNasaPlayingState] = useState({
    wind_sol4: false,
    wind_filtered: false,
    laser_sol12: false,
    marsquake_sol128: false,
  });

  const [nasaVolumes, setNasaVolumes] = useState({
    wind_sol4: 0.7,
    wind_filtered: 0.65,
    laser_sol12: 0.85,
    marsquake_sol128: 0.9,
  });

  const canvasRef = useRef(null);

  // Live Audio Oscilloscope / Frequency Spectrum Visualizer (64-point FFT)
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const freqData = new Uint8Array(32);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const anyAudioActive = isAudioActive || Object.values(nasaPlayingState).some(Boolean);

      if (anyAudioActive) {
        marsAudio.getFrequencyData(freqData);
      } else {
        freqData.fill(0);
      }

      const barWidth = canvas.width / 32 - 1;
      for (let i = 0; i < 32; i++) {
        const val = anyAudioActive ? freqData[i] : 4;
        const barHeight = (val / 255) * (canvas.height - 4);

        // Dynamic spectral color gradient: Cyan -> Orange -> Crimson
        const r = Math.round(56 + (i / 32) * 199);
        const g = Math.round(189 - (i / 32) * 90);
        const b = Math.round(248 - (i / 32) * 230);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(i * (barWidth + 1), canvas.height - barHeight - 2, barWidth, barHeight + 2);
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [isAudioActive, isAudioRackOpen, nasaPlayingState]);

  // Sync NASA playing state poll
  useEffect(() => {
    if (!isAudioRackOpen) return;
    const interval = setInterval(() => {
      setNasaPlayingState({
        wind_sol4: marsAudio.isNasaTrackPlaying('wind_sol4'),
        wind_filtered: marsAudio.isNasaTrackPlaying('wind_filtered'),
        laser_sol12: marsAudio.isNasaTrackPlaying('laser_sol12'),
        marsquake_sol128: marsAudio.isNasaTrackPlaying('marsquake_sol128'),
      });
    }, 250);
    return () => clearInterval(interval);
  }, [isAudioRackOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isAudioRackOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setAudioRackOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAudioRackOpen, setAudioRackOpen]);

  const handleToggleNasaTrack = (trackId) => {
    marsAudio.init();
    if (marsAudio.ctx && marsAudio.ctx.state === 'suspended') {
      marsAudio.ctx.resume();
    }
    const isNowPlaying = marsAudio.toggleNasaTrack(trackId);
    setNasaPlayingState((prev) => ({ ...prev, [trackId]: isNowPlaying }));
  };

  const handleNasaVolumeChange = (trackId, val) => {
    setNasaVolumes((prev) => ({ ...prev, [trackId]: val }));
    marsAudio.setNasaTrackVolume(trackId, val);
  };

  if (!isAudioRackOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setAudioRackOpen(false);
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel-solid w-full max-w-xl rounded-2xl border-2 border-cyan-500/60 p-5 bg-space-950 shadow-2xl flex flex-col gap-4 font-mono text-xs relative z-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-space-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-wider flex items-center gap-2">
                MARTIAN ACOUSTIC & SYNTHESIZER RACK
                <span className="text-[10px] font-normal text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                  NASA Mars Audio Core
                </span>
              </h3>
              <p className="text-[10px] text-space-400">
                Live Acoustic Surface Recordings (SuperCam & SEIS) + Procedural Life Support
              </p>
            </div>
          </div>
          <button
            onClick={() => setAudioRackOpen(false)}
            className="px-3 py-1 bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 font-bold rounded-xl flex items-center gap-1 shadow-neon-mars transition-all hover:scale-105 active:scale-95 border border-rose-400/60 cursor-pointer backdrop-blur-md"
            title="Close Audio Mixer (ESC)"
          >
            <X className="w-3.5 h-3.5" />
            <span>← BACK (ESC)</span>
          </button>
        </div>

        {/* Master State & Real-time DSP Spectrum Analyzer */}
        <div className="bg-space-900/60 p-3.5 rounded-xl border border-space-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-space-400 text-[10px] uppercase tracking-wider">
                DSP Frequency Spectrum (64-pt FFT)
              </span>
              {Object.values(nasaPlayingState).some(Boolean) && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  NASA ACOUSTIC DOWNLINK ACTIVE
                </span>
              )}
            </div>

            <button
              onClick={toggleAudio}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                isAudioActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'bg-space-800 text-space-400 hover:text-white'
              }`}
            >
              {isAudioActive ? (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>{isAudioActive ? 'SYNTHESIZER ACTIVE' : 'SYNTH MUTED'}</span>
            </button>
          </div>

          <div className="h-14 w-full bg-black/50 rounded-lg border border-space-800 overflow-hidden p-1">
            <canvas ref={canvasRef} width="460" height="48" className="w-full h-full" />
          </div>
        </div>

        {/* Section Navigation Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-space-900/80 border border-space-800">
          <button
            onClick={() => setActiveTab('nasa')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'nasa'
                ? 'bg-gradient-to-r from-[#ff7b4d] to-[#ff9a4d] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>1. Official NASA Acoustic Downlink (SuperCam & SEIS)</span>
          </button>
          <button
            onClick={() => setActiveTab('procedural')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'procedural'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>2. Procedural Life-Support Mixer</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: OFFICIAL NASA MARTIAN ACOUSTIC RECORDINGS         */}
        {/* ======================================================== */}
        {activeTab === 'nasa' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span>Authentic raw recordings captured by microphones & seismometers on Mars</span>
              <ProvenanceBadge
                type="OBSERVED"
                detail="NASA Mars 2020 SuperCam & InSight SEIS Public Domain Audio"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Track 1: Perseverance Wind Sol 4 */}
              <div className="bg-space-900/50 p-3 rounded-xl border border-space-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-amber-400" />
                      <span>{NASA_AUDIO_TRACKS.wind_sol4.title}</span>
                    </span>
                    <span className="text-[10px] text-amber-300 font-mono">
                      Sol {NASA_AUDIO_TRACKS.wind_sol4.sol}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">
                    {NASA_AUDIO_TRACKS.wind_sol4.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => handleToggleNasaTrack('wind_sol4')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                      nasaPlayingState.wind_sol4
                        ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {nasaPlayingState.wind_sol4 ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{nasaPlayingState.wind_sol4 ? 'PAUSE' : 'PLAY'}</span>
                  </button>

                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={nasaVolumes.wind_sol4}
                      onChange={(e) =>
                        handleNasaVolumeChange('wind_sol4', parseFloat(e.target.value))
                      }
                      className="w-full accent-amber-500 bg-space-800 rounded-lg cursor-pointer h-1.5"
                    />
                    <span className="text-[10px] text-zinc-500 w-8 text-right font-mono">
                      {Math.round(nasaVolumes.wind_sol4 * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Track 2: Filtered Martian Breeze */}
              <div className="bg-space-900/50 p-3 rounded-xl border border-space-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Disc className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{NASA_AUDIO_TRACKS.wind_filtered.title}</span>
                    </span>
                    <span className="text-[10px] text-cyan-300 font-mono">Clean Breeze</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">
                    {NASA_AUDIO_TRACKS.wind_filtered.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => handleToggleNasaTrack('wind_filtered')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                      nasaPlayingState.wind_filtered
                        ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {nasaPlayingState.wind_filtered ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{nasaPlayingState.wind_filtered ? 'PAUSE' : 'PLAY'}</span>
                  </button>

                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={nasaVolumes.wind_filtered}
                      onChange={(e) =>
                        handleNasaVolumeChange('wind_filtered', parseFloat(e.target.value))
                      }
                      className="w-full accent-cyan-400 bg-space-800 rounded-lg cursor-pointer h-1.5"
                    />
                    <span className="text-[10px] text-zinc-500 w-8 text-right font-mono">
                      {Math.round(nasaVolumes.wind_filtered * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Track 3: SuperCam Laser Rock Zap */}
              <div className="bg-space-900/50 p-3 rounded-xl border border-space-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-rose-400" />
                      <span>{NASA_AUDIO_TRACKS.laser_sol12.title}</span>
                    </span>
                    <span className="text-[10px] text-rose-300 font-mono">
                      Sol {NASA_AUDIO_TRACKS.laser_sol12.sol}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">
                    {NASA_AUDIO_TRACKS.laser_sol12.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => marsAudio.playLaserZap()}
                    className="w-full py-1.5 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span>Fire SuperCam Laser (Rock 'Máaz')</span>
                  </button>
                </div>
              </div>

              {/* Track 4: InSight Marsquake Sol 128 */}
              <div className="bg-space-900/50 p-3 rounded-xl border border-space-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-sky-400" />
                      <span>{NASA_AUDIO_TRACKS.marsquake_sol128.title}</span>
                    </span>
                    <span className="text-[10px] text-sky-300 font-mono">
                      Sol {NASA_AUDIO_TRACKS.marsquake_sol128.sol} SEIS
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">
                    {NASA_AUDIO_TRACKS.marsquake_sol128.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => marsAudio.playMarsquakeAudio()}
                    className="w-full py-1.5 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    <span>Listen to InSight Marsquake (Sol 128)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PROCEDURAL LIFE-SUPPORT & AMBIENCE MIXER          */}
        {/* ======================================================== */}
        {activeTab === 'procedural' && (
          <div className="grid grid-cols-3 gap-3">
            {/* Procedural Wind Channel */}
            <div className="bg-space-900/40 p-3 rounded-xl border border-space-800 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                <Wind className="w-3.5 h-3.5" />
                <span>Synthetic Wind</span>
              </div>
              <p className="text-[9px] text-space-500 leading-tight">
                Resonant pink noise atmospheric generator
              </p>
              <input
                type="range"
                min="0"
                max="0.6"
                step="0.02"
                value={windVol}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setWindVol(val);
                  marsAudio.setWindVolume(val);
                }}
                className="w-full accent-amber-500 bg-space-800 rounded-lg cursor-pointer h-1.5 mt-2"
              />
              <div className="text-[10px] text-space-400 text-right font-mono">
                {Math.round(windVol * 166)}%
              </div>
            </div>

            {/* Respirator Channel */}
            <div className="bg-space-900/40 p-3 rounded-xl border border-space-800 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-green-400 font-bold text-[11px]">
                <Heart className="w-3.5 h-3.5" />
                <span>Suit Respirator</span>
              </div>
              <p className="text-[9px] text-space-500 leading-tight">
                Life-support breathing rhythm simulation
              </p>
              <input
                type="range"
                min="0"
                max="0.1"
                step="0.005"
                value={breathVol}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setBreathVol(val);
                  marsAudio.setBreathVolume(val);
                }}
                className="w-full accent-green-500 bg-space-800 rounded-lg cursor-pointer h-1.5 mt-2"
              />
              <div className="text-[10px] text-space-400 text-right font-mono">
                {Math.round(breathVol * 1000)}%
              </div>
            </div>

            {/* Geiger Channel */}
            <div className="bg-space-900/40 p-3 rounded-xl border border-space-800 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold text-[11px]">
                <Zap className="w-3.5 h-3.5" />
                <span>Geiger Clicks</span>
              </div>
              <p className="text-[9px] text-space-500 leading-tight">
                Cosmic radiation Poisson pulse generator
              </p>
              <input
                type="range"
                min="0"
                max="0.15"
                step="0.01"
                value={geigerVol}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setGeigerVol(val);
                  marsAudio.setGeigerVolume(val);
                }}
                className="w-full accent-purple-500 bg-space-800 rounded-lg cursor-pointer h-1.5 mt-2"
              />
              <div className="text-[10px] text-space-400 text-right font-mono">
                {Math.round(geigerVol * 666)}%
              </div>
            </div>
          </div>
        )}

        {/* Footer with NASA Quindar Tone Test */}
        <div className="flex items-center justify-between pt-2 border-t border-space-800">
          <button
            onClick={() => marsAudio.playQuindarTone(true)}
            className="px-3 py-1.5 bg-space-800 hover:bg-space-700 text-cyan-300 rounded-lg flex items-center gap-1.5 transition-colors border border-space-700 cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test NASA Quindar Tone (2525 Hz)</span>
          </button>

          <span className="text-[10px] text-space-500">Martis Audio Core v3.0 (NASA Caltech Audio)</span>
        </div>
      </motion.div>
    </div>
  );
}
