import { useState, useMemo } from 'react';
import { Activity, Compass, ShieldAlert, ShieldCheck, AlertTriangle, LocateFixed, Volume2, Info, ChevronDown } from 'lucide-react';
import useMapStore from '../../store/useMapStore';
import {
  invertMarsquakeHypocenter,
  calculateGroundShakingAtLocation,
  getQuakeModel,
} from '../../services/marsMlService';
import { playMarsquakeAudio } from '../../utils/audioSynthesizer';
import ProvenanceBadge from '../ProvenanceBadge';

const TARGET_BASES = [
  { id: 'jezero', name: 'Jezero Base (Perseverance)', lat: 18.4447, lon: 77.4508 },
  { id: 'gale', name: 'Gale Crater (Curiosity)', lat: -4.5895, lon: 137.4417 },
  { id: 'insight', name: 'InSight Lander (Elysium)', lat: 4.5024, lon: 135.6234 },
  { id: 'olympus', name: 'Olympus Mons Base', lat: 18.65, lon: -133.8 },
];

export default function QuakeMlEstimator() {
  const fly = useMapStore((s) => s.flyToCoordinate);
  const cursor = useMapStore((s) => s.cursorPosition);
  const quakeModel = useMemo(() => getQuakeModel(), []);
  const landmarks = quakeModel?.landmarks || [];

  const [selectedEventId, setSelectedEventId] = useState('S1222a');
  const [targetId, setTargetId] = useState('jezero');
  const [siteCondition, setSiteCondition] = useState('duricrust');

  // Custom inversion controls
  const [deltaT, setDeltaT] = useState(265.2); // seconds (S0173a default)
  const [baz, setBaz] = useState(88.0); // degrees
  const [customMag, setCustomMag] = useState(3.7);
  const [customKind, setCustomKind] = useState('Low Frequency');

  const isCustom = selectedEventId === 'custom';
  const activeLandmark = landmarks.find((l) => l.name === selectedEventId) || landmarks[0];

  // Hypocenter calculation
  const inversion = useMemo(() => {
    if (!isCustom && activeLandmark) {
      return {
        distDeg: activeLandmark.dist_deg,
        distKm: activeLandmark.dist_km,
        depthKm: activeLandmark.depth_km,
        epicenter: { lat: activeLandmark.lat, lon: activeLandmark.lon },
        energyExponent: +(1.5 * activeLandmark.mag + 4.8).toFixed(1),
        magnitude: activeLandmark.mag,
        kind: activeLandmark.kind,
      };
    }
    const inv = invertMarsquakeHypocenter({
      deltaT_Sp: deltaT,
      backAzimuthDeg: baz,
      magnitude: customMag,
      kind: customKind,
    });
    return {
      ...inv,
      magnitude: customMag,
      kind: customKind,
    };
  }, [isCustom, activeLandmark, deltaT, baz, customMag, customKind]);

  // Target coordinates for ground shaking calculation
  const targetCoord = useMemo(() => {
    if (targetId === 'cursor' && cursor) {
      return { name: 'Cursor Location', lat: cursor.lat, lon: cursor.lon };
    }
    const base = TARGET_BASES.find((b) => b.id === targetId) || TARGET_BASES[0];
    return base;
  }, [targetId, cursor]);

  // Ground shaking prediction at the target
  const shaking = useMemo(() => {
    return calculateGroundShakingAtLocation({
      quakeLat: inversion.epicenter.lat,
      quakeLon: inversion.epicenter.lon,
      magnitude: inversion.magnitude,
      depthKm: inversion.depthKm,
      targetLat: targetCoord.lat,
      targetLon: targetCoord.lon,
      siteCondition,
      kind: inversion.kind,
    });
  }, [inversion, targetCoord, siteCondition]);

  const hazard = shaking.hazard;

  return (
    <section className="rounded-xl border border-white/15 bg-white/[0.04] p-3 text-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-white">
          <Activity className="w-4 h-4 text-rose-400" />
          <span>InSight Hypocentral & Shaking Estimator</span>
        </div>
        <ProvenanceBadge type="ML_SURROGATE" size="xs" detail="Shaking from a hand-calibrated Mars attenuation equation, applied to InSight catalogue V14 magnitudes and distances" />
      </div>

      <p className="text-zinc-400 text-[11px] leading-relaxed">
        Predicts epicentral coordinates from single-station differential P/S arrivals (<span className="text-zinc-200 font-mono">Δt<sub>S-P</sub></span>) and regresses Peak Ground Acceleration (PGA) at your habitat.
      </p>

      {/* Preset Marsquakes Selector */}
      <div>
        <div className="text-zinc-400 text-[10px] uppercase tracking-wider font-mono mb-1.5">Select InSight Event</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {landmarks.map((lm) => (
            <button
              key={lm.name}
              onClick={() => setSelectedEventId(lm.name)}
              className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                selectedEventId === lm.name
                  ? 'border-rose-400/80 bg-rose-500/20 text-white font-semibold shadow-sm'
                  : 'border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-rose-300">{lm.name}</span>
                <span className="text-[10px] font-mono text-zinc-400">M{lm.mag}</span>
              </div>
              <div className="truncate text-[10px] text-zinc-200 mt-0.5">{lm.title.replace('Marsquake', 'Quake')}</div>
            </button>
          ))}
          <button
            onClick={() => setSelectedEventId('custom')}
            className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
              isCustom
                ? 'border-violet-400/80 bg-violet-500/20 text-white font-semibold shadow-sm'
                : 'border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-violet-300">CUSTOM</span>
              <span className="text-[10px] font-mono text-zinc-400">Δt P/S</span>
            </div>
            <div className="truncate text-[10px] text-zinc-200 mt-0.5">Differential Arrival</div>
          </button>
        </div>
      </div>

      {/* Custom Parameters Drawer */}
      {isCustom && (
        <div className="space-y-2 p-2.5 rounded-lg bg-black/30 border border-violet-500/30">
          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-zinc-300">Differential Arrival (Δt<sub>S-P</sub>):</span>
              <span className="font-mono text-violet-300 font-semibold">{deltaT.toFixed(1)}s ({(deltaT / 60).toFixed(1)} min)</span>
            </div>
            <input
              type="range"
              min="20"
              max="550"
              step="1"
              value={deltaT}
              onChange={(e) => setDeltaT(Number(e.target.value))}
              className="w-full accent-violet-400 h-1 bg-zinc-700 rounded-lg cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-zinc-300">Back-Azimuth:</span>
                <span className="font-mono text-violet-300">{baz.toFixed(0)}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="2"
                value={baz}
                onChange={(e) => setBaz(Number(e.target.value))}
                className="w-full accent-violet-400 h-1 bg-zinc-700 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-zinc-300">Magnitude (M<sub>w</sub>):</span>
                <span className="font-mono text-rose-300 font-semibold">{customMag.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="5.2"
                step="0.1"
                value={customMag}
                onChange={(e) => setCustomMag(Number(e.target.value))}
                className="w-full accent-rose-400 h-1 bg-zinc-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Inverted Hypocenter Card */}
      <div className="rounded-xl bg-black/25 p-2.5 border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-[10px] uppercase font-mono tracking-wider">Inverted Hypocenter</span>
          <button
            onClick={() => fly?.(inversion.epicenter.lat, inversion.epicenter.lon, 6)}
            className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
          >
            <LocateFixed className="w-3 h-3" />
            <span>Focus Epicenter on Map</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono text-center">
          <div className="bg-white/[0.04] p-1.5 rounded-lg">
            <div className="text-[10px] text-zinc-500 font-sans">Coordinates</div>
            <div className="text-xs text-white font-semibold">
              {inversion?.epicenter?.lat != null && inversion?.epicenter?.lon != null
                ? `${Math.abs(inversion.epicenter.lat).toFixed(1)}°${inversion.epicenter.lat >= 0 ? 'N' : 'S'} ${Math.abs(inversion.epicenter.lon).toFixed(1)}°${inversion.epicenter.lon >= 0 ? 'E' : 'W'}`
                : '—'}
            </div>
          </div>
          <div className="bg-white/[0.04] p-1.5 rounded-lg">
            <div className="text-[10px] text-zinc-500 font-sans">Epicentral Dist</div>
            <div className="text-xs text-sky-300 font-semibold">
              {inversion.distKm} km <span className="text-[10px] text-zinc-400">({inversion.distDeg}°)</span>
            </div>
          </div>
          <div className="bg-white/[0.04] p-1.5 rounded-lg">
            <div className="text-[10px] text-zinc-500 font-sans">Focal Depth</div>
            <div className="text-xs text-amber-300 font-semibold">{inversion.depthKm} km</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10 text-zinc-400">
          <span>Seismic Radiated Energy (E<sub>s</sub>):</span>
          <span className="font-mono text-zinc-200">~10<sup>{inversion.energyExponent}</sup> Joules</span>
        </div>
      </div>

      {/* Target Habitat Ground Shaking & Hazard */}
      <div className="rounded-xl bg-black/35 p-2.5 border border-white/15 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-[10px] uppercase font-mono tracking-wider">Habitat Ground Shaking (GMPE)</span>
          <div className="flex items-center gap-1.5">
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="bg-black/60 border border-white/20 rounded px-2 py-0.5 text-[11px] text-zinc-200 cursor-pointer focus:outline-none focus:border-rose-400"
            >
              {TARGET_BASES.map((b) => (
                <option key={b.id} value={b.id}>{b.name.split(' (')[0]}</option>
              ))}
              {cursor && <option value="cursor">Under Mouse Cursor</option>}
            </select>
          </div>
        </div>

        {/* PGA and PGV Readout */}
        <div className="grid grid-cols-2 gap-2 font-mono">
          <div className="rounded-lg p-2 bg-white/[0.04] border border-white/10">
            <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
              <span>Peak Ground Accel (PGA)</span>
              <span className="text-rose-400 font-bold">{shaking.pgaPctG}% g</span>
            </div>
            <div className="text-base font-bold text-white mt-0.5">
              {shaking.pgaDisplay} <span className="text-xs text-zinc-400 font-normal">m/s²</span>
            </div>
            {shaking.pgaCi90Range && (
              <div className="text-[9px] text-violet-300 font-mono" title="90% Confidence Interval (±1.645σ InSight GMPE error)">
                90% CI: [{shaking.pgaCi90Range[0] < 0.0001 ? shaking.pgaCi90Range[0].toExponential(1) : shaking.pgaCi90Range[0].toFixed(4)} - {shaking.pgaCi90Range[1] < 0.0001 ? shaking.pgaCi90Range[1].toExponential(1) : shaking.pgaCi90Range[1].toFixed(4)} m/s²]
              </div>
            )}
            <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
              Distance: <span className="text-zinc-300">{shaking.distanceKm} km</span>
            </div>
          </div>

          <div className="rounded-lg p-2 bg-white/[0.04] border border-white/10">
            <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
              <span>Peak Velocity (PGV)</span>
              <span className="text-zinc-500">S<sub>a</sub>(1.0s)</span>
            </div>
            <div className="text-base font-bold text-sky-200 mt-0.5">
              {shaking.pgvCmS.toFixed(3)} <span className="text-xs text-zinc-400 font-normal">cm/s</span>
            </div>
            {shaking.pgvCi90Range && (
              <div className="text-[9px] text-violet-300 font-mono" title="90% Confidence Interval">
                90% CI: [{shaking.pgvCi90Range[0].toFixed(3)} - {shaking.pgvCi90Range[1].toFixed(3)} cm/s]
              </div>
            )}
            <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
              Spectral: <span className="text-zinc-300">{shaking.sa10} m/s²</span>
            </div>
          </div>
        </div>

        {/* Hazard Level Badge & Advisory */}
        <div
          className="p-2 rounded-lg border flex items-start gap-2"
          style={{
            backgroundColor: `${hazard.color}15`,
            borderColor: `${hazard.color}50`,
          }}
        >
          {hazard.level === 'SAFE' ? (
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          ) : hazard.level === 'CRITICAL' || hazard.level === 'WARNING' ? (
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400 animate-pulse" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase text-[11px]" style={{ color: hazard.color }}>
                {hazard.label}
              </span>
              <span className="text-[10px] font-mono px-1 rounded bg-black/40 text-zinc-300 border border-white/10">
                NASA-STD-3001
              </span>
            </div>
            <p className="text-[11px] text-zinc-200 leading-snug mt-1">
              {hazard.advisory}
            </p>
          </div>
        </div>

        {/* Audio Sample Playback */}
        <button
          onClick={() => playMarsquakeAudio?.()}
          className="w-full h-8 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
        >
          <Volume2 className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
          <span>Listen to InSight Seismometer Audio (Sol 128 Recording)</span>
        </button>
      </div>
    </section>
  );
}
