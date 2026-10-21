import { useState, useEffect } from 'react';
import useMapStore from '../store/useMapStore';
import { playLaserZap, playSampleSeal } from '../utils/audioSynthesizer';
import { fetchScienceTargets } from '../services/nasaApiService';
import { generateScienceReport } from '../services/aiService';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../services/profileService';

/**
 * Shared state and handlers for the In-Situ Science Lab page (ScienceLabPage).
 * Kept as a hook so the lab logic stays separate from its layout.
 * Pass `enabled: false` to postpone fetching the rock targets (e.g. while a modal is closed).
 */
export default function useScienceLab({ enabled = true } = {}) {
  const collectedSamples = useMapStore(s => s.collectedSamples);
  const addSample = useMapStore(s => s.addSample);
  const [rockTargets, setRockTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  
  // AI State
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);

  // Fetch targets from API (the modal variant waits until it is opened)
  useEffect(() => {
    if (!enabled || rockTargets.length > 0) return;
    let cancelled = false;
    setIsLoadingTargets(true);
    fetchScienceTargets().then(targets => {
      if (cancelled) return;
      setRockTargets(targets);
      setSelectedTarget(targets[0]);
      setIsLoadingTargets(false);
    }).catch(err => {
      console.error(err);
      if (!cancelled) setIsLoadingTargets(false);
    });
    return () => { cancelled = true; };
  }, [enabled, rockTargets.length]);

  // Active instrument tab: 'supercam' | 'pixl' | 'sherloc' | 'msr'
  const [activeInstrument, setActiveInstrument] = useState('supercam');

  // Laser Targeting Canvas states
  const [laserTargetPos, setLaserTargetPos] = useState({ x: 50, y: 50 });
  const [ablationPits, setAblationPits] = useState([
    { id: 1, x: 45, y: 40, label: '#01 Core Matrix' },
    { id: 2, x: 62, y: 55, label: '#02 Mineral Vein' }
  ]);
  const [isFiringLaser, setIsFiringLaser] = useState(false);
  const [laserBeamActive, setLaserBeamActive] = useState(false);

  // SHERLOC UV Raman states
  const [uvIntensity, setUvIntensity] = useState(85);

  // Paleo-Groundwater pH Simulator
  const [paleoPh, setPaleoPh] = useState(7.2);

  // MSR Tube Sealing State
  const [cachedSuccess, setCachedSuccess] = useState(false);
  const [customTubeNotes, setCustomTubeNotes] = useState('');
  const [isSealingTube, setIsSealingTube] = useState(false);

  // Selected Spectral Peak highlight
  const [highlightedPeak, setHighlightedPeak] = useState(null);

  const target = selectedTarget || rockTargets[0];
  const safeSamples = Array.isArray(collectedSamples) ? collectedSamples : [];

  // Reset ablation pits when target changes
  const selectedTargetId = selectedTarget?.id;
  useEffect(() => {
    if (selectedTargetId) {
      setAblationPits([
        { id: 1, x: 40 + Math.random() * 20, y: 35 + Math.random() * 20, label: '#01 Primary Spot' }
      ]);
      setHighlightedPeak(null);
      setAiReport(null);
    }
  }, [selectedTargetId]);

  // Click on Rock Surface to Aim and Fire SuperCam Laser
  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    
    setLaserTargetPos({ x, y });
    triggerLaserAblation(x, y);
  };

  const triggerLaserAblation = (x, y) => {
    if (isFiringLaser) return;
    setIsFiringLaser(true);
    setLaserBeamActive(true);
    playLaserZap?.();

    setTimeout(() => {
      setLaserBeamActive(false);
      setIsFiringLaser(false);
      
      setAblationPits(prev => [
        ...prev.slice(-4),
        { id: Date.now(), x, y, label: `#0${prev.length + 1} LIBS Spot` }
      ]);
    }, 600);
  };

  // Run Real AI Spectrometry Analysis
  const runAiAnalysis = async () => {
    if (!target) return;
    setIsAiAnalyzing(true);
    const fallbackReport = {
      mineralogy: target.mineralogy || 'Smectite clays, Fe-Mg Carbonates',
      phLevel: '7.4 (Neutral to Mildly Alkaline)',
      biosignatureProbability: target.bpi || 88,
      analysisNotes: 'Spectrometric profile indicates fine-grained alluvial deposition with high preservation capacity.'
    };
    try {
      const report = await generateScienceReport(target);
      setAiReport(report || fallbackReport);
    } catch (e) {
      console.error(e);
      setAiReport(fallbackReport);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Seal sample in MSR tube
  const [cacheError, setCacheError] = useState(null);

  const handleCacheSample = () => {
    if (!target) return;
    setIsSealingTube(true);
    setCacheError(null);
    playSampleSeal?.();

    const notes = customTubeNotes || `Harvested from ${target.location}`;
    setTimeout(async () => {
      addSample({
        id: Date.now().toString(),
        name: target.name,
        rockType: target.formation,
        status: 'SEALED IN CACHE',
        notes
      });

      // Signed-in crews also log the sample to their profile (the database counts it)
      const user = useMapStore.getState().user;
      if (user) {
        const ph = parseFloat(aiReport?.phLevel);
        const { error } = await supabase.from('science_logs').insert({
          user_id: user.id,
          target_id: target.id,
          target_name: target.name,
          mineralogy: aiReport?.mineralogy || target.mineralogy || null,
          ph_level: Number.isFinite(ph) ? ph : null,
          notes: notes.slice(0, 2000),
        });
        if (error) {
          console.warn('Could not save sample to profile:', error.message);
          setCacheError('Sealed locally, but saving to your profile failed.');
        } else {
          fetchProfile(user.id);
        }
      }

      setIsSealingTube(false);
      setCachedSuccess(true);
      setCustomTubeNotes('');
      setTimeout(() => setCachedSuccess(false), 3000);
    }, 1200);
  };

  // Compute paleo-environmental diagnosis based on pH slider
  const getPaleoEnvironment = (ph) => {
    if (ph < 4.5) {
      return {
        epoch: 'Early Hesperian (Acidic Groundwater)',
        regime: 'Hyper-Acidic Brine (pH ' + ph.toFixed(1) + ')',
        precipitates: 'Jarosite, Ferric Sulfates, Gypsum',
        habitability: 'Extreme Acidophile Chemolithotrophy Only',
        color: 'text-amber-400',
        badge: 'border-amber-500/30 bg-amber-950/40 text-amber-300'
      };
    } else if (ph <= 8.2) {
      return {
        epoch: 'Noachian (Fluvio-Lacustrine Epoch)',
        regime: 'Neutral to Mildly Alkaline Lake (pH ' + ph.toFixed(1) + ')',
        precipitates: 'Smectite Clays, Fe-Mg Carbonates, Silica Gel',
        habitability: 'Optimal for Microorganic Macromolecule Preservation',
        color: 'text-emerald-400',
        badge: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
      };
    } else {
      return {
        epoch: 'Deep Crustal Serpentinization Epoch',
        regime: 'Alkaline Hydrothermal Fluids (pH ' + ph.toFixed(1) + ')',
        precipitates: 'Serpentine, Brucite, Hydrotalcite, Calcite',
        habitability: 'Abiotic Hydrogen & Methane Generation (CH4/H2 Fuel)',
        color: 'text-cyan-400',
        badge: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300'
      };
    }
  };

  const paleoDiagnosis = getPaleoEnvironment(paleoPh);


  return {
    collectedSamples,
    addSample,
    rockTargets,
    setRockTargets,
    selectedTarget,
    setSelectedTarget,
    isLoadingTargets,
    setIsLoadingTargets,
    isAiAnalyzing,
    setIsAiAnalyzing,
    aiReport,
    setAiReport,
    activeInstrument,
    setActiveInstrument,
    laserTargetPos,
    setLaserTargetPos,
    ablationPits,
    setAblationPits,
    isFiringLaser,
    setIsFiringLaser,
    laserBeamActive,
    setLaserBeamActive,
    uvIntensity,
    setUvIntensity,
    paleoPh,
    setPaleoPh,
    cachedSuccess,
    setCachedSuccess,
    customTubeNotes,
    setCustomTubeNotes,
    isSealingTube,
    setIsSealingTube,
    highlightedPeak,
    setHighlightedPeak,
    target,
    safeSamples,
    handleCanvasClick,
    triggerLaserAblation,
    runAiAnalysis,
    handleCacheSample,
    cacheError,
    paleoDiagnosis,
  };
}
