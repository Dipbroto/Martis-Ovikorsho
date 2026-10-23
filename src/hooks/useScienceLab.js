import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import useMapStore from '../store/useMapStore';
import { playLaserZap, playSampleSeal } from '../utils/audioSynthesizer';
import { loadCampaignIndex, loadCampaign, analyse, aiBrief } from '../data/scienceLab';
import { generateScienceReport } from '../services/aiService';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../services/profileService';

const SHOT_MS = 110;

/**
 * Shared state and handlers for the In-Situ Science Lab page (ScienceLabPage).
 * The lab shows measured Perseverance data (SuperCam, PIXL, SHERLOC); this hook loads it and holds what the
 * visitor has picked: the rock, the instrument, the laser point and shot, the PIXL oxide and the SHERLOC spot.
 */
export default function useScienceLab() {
  const collectedSamples = useMapStore((s) => s.collectedSamples);
  const addSample = useMapStore((s) => s.addSample);

  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [activeInstrument, setActiveInstrument] = useState('supercam');
  const [pointIdx, setPointIdx] = useState(0);
  const [shot, setShot] = useState(null); // null = average of shots 6-30, otherwise the single shot number 1-30
  const [isFiringLaser, setIsFiringLaser] = useState(false);
  const [highlightedPeak, setHighlightedPeak] = useState(null);
  const [oxide, setOxide] = useState('SiO2');
  const [pixlPick, setPixlPick] = useState(null);
  const [sherlocMetric, setSherlocMetric] = useState('fluor-2');
  const [sherlocSpot, setSherlocSpot] = useState(null);

  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [cachedSuccess, setCachedSuccess] = useState(false);
  const [customTubeNotes, setCustomTubeNotes] = useState('');
  const [isSealingTube, setIsSealingTube] = useState(false);
  const [cacheError, setCacheError] = useState(null);
  const [paleoPh, setPaleoPh] = useState(7.2);

  const timer = useRef(null);
  const stopFiring = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setIsFiringLaser(false);
  }, []);
  useEffect(() => stopFiring, [stopFiring]);

  // the list of rocks
  useEffect(() => {
    let cancelled = false;
    setIsLoadingTargets(true);
    loadCampaignIndex().then((idx) => {
      if (cancelled) return;
      setCampaigns(idx.campaigns);
      setSelectedId((cur) => cur || idx.campaigns[0]?.id || null);
      setLoadError(null);
    }).catch((e) => {
      console.error(e);
      if (!cancelled) setLoadError('The rock data could not be loaded. Check your connection and try again.');
    }).finally(() => { if (!cancelled) setIsLoadingTargets(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const target = useMemo(() => campaigns.find((c) => c.id === selectedId) || null, [campaigns, selectedId]);

  // the measurements of the picked rock
  useEffect(() => {
    if (!target) return undefined;
    let cancelled = false;
    stopFiring();
    setData(null);
    setIsLoadingData(true);
    setPointIdx(0); setShot(null); setHighlightedPeak(null); setPixlPick(null); setSherlocSpot(null); setAiReport(null);
    loadCampaign(target).then((d) => {
      if (cancelled) return;
      setData(d);
      setLoadError(null);
      // start the map on the oxide that varies most across the scan: it shows the most structure
      let best = 'SiO2'; let bestCv = -1;
      for (const k of ['SiO2', 'FeO-T', 'MgO', 'Al2O3', 'CaO', 'SO3', 'Na2O', 'TiO2']) {
        const s = d.pixl.stats[k];
        const cv = s.med > 0.5 ? (s.hi - s.lo) / s.med : 0;
        if (cv > bestCv) { bestCv = cv; best = k; }
      }
      setOxide(best);
    }).catch((e) => {
      console.error(e);
      if (!cancelled) setLoadError(`The measurements for ${target.name} could not be loaded.`);
    }).finally(() => { if (!cancelled) setIsLoadingData(false); });
    return () => { cancelled = true; };
  }, [target, reloadKey, stopFiring]);

  const analysis = useMemo(() => analyse(target, data), [target, data]);

  const selectTarget = (id) => setSelectedId(id);
  const retry = () => setReloadKey((k) => k + 1);

  const selectPoint = (i) => { stopFiring(); setPointIdx(i); setShot(null); };

  // Fire the laser: step through the 30 real laser shots of the first point, one per pulse
  const fireLaser = () => {
    const pt = data?.libs?.points?.[0];
    if (!pt?.shots || isFiringLaser) return;
    const total = pt.shots.length;
    setPointIdx(0);
    setIsFiringLaser(true);
    playLaserZap?.();
    let k = 0;
    setShot(1);
    timer.current = setInterval(() => {
      k += 1;
      if (k >= total) { stopFiring(); setShot(total); return; }
      setShot(k + 1);
    }, SHOT_MS);
  };
  const showAverage = () => { stopFiring(); setShot(null); };
  const pickShot = (n) => { stopFiring(); setPointIdx(0); setShot(n); };

  const runAiAnalysis = async () => {
    if (!target || !data || !analysis) return;
    setIsAiAnalyzing(true);
    const computed = {
      source: 'computed',
      mineralogy: analysis.minerals.join(', ') || 'No dominant mineral from the chemistry alone',
      interpretation: analysis.summary,
      points: analysis.evidence.slice(0, 4).map((e) => `${e.label} (${e.instrument}, ${e.level}): ${e.detail}`),
    };
    try {
      const report = await generateScienceReport(aiBrief(target, data, analysis));
      setAiReport(report ? { ...report, source: 'ai' } : computed);
    } catch (e) {
      console.error(e);
      setAiReport(computed);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleCacheSample = () => {
    if (!target) return;
    setIsSealingTube(true);
    setCacheError(null);
    playSampleSeal?.();

    const notes = customTubeNotes || `${target.name}, Jezero crater (${target.lat.toFixed(3)}°N, ${target.lon.toFixed(3)}°E)`;
    setTimeout(async () => {
      addSample({
        id: Date.now().toString(),
        name: target.name,
        rockType: target.rockType,
        status: 'SEALED IN CACHE',
        notes,
      });

      // Signed-in crews also log the sample to their profile (the database counts it)
      const user = useMapStore.getState().user;
      if (user) {
        const { error } = await supabase.from('science_logs').insert({
          user_id: user.id,
          target_id: target.id,
          target_name: target.name,
          mineralogy: analysis?.minerals.join(', ') || null,
          ph_level: null,
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

  const safeSamples = Array.isArray(collectedSamples) ? collectedSamples : [];

  return {
    campaigns, target, data, analysis, isLoadingTargets, isLoadingData, loadError, retry, selectTarget,
    activeInstrument, setActiveInstrument,
    pointIdx, selectPoint, shot, isFiringLaser, fireLaser, showAverage, pickShot, highlightedPeak, setHighlightedPeak,
    oxide, setOxide, pixlPick, setPixlPick, sherlocMetric, setSherlocMetric, sherlocSpot, setSherlocSpot,
    isAiAnalyzing, aiReport, setAiReport, runAiAnalysis,
    cachedSuccess, customTubeNotes, setCustomTubeNotes, isSealingTube, cacheError, handleCacheSample,
    collectedSamples, safeSamples, paleoPh, setPaleoPh,
  };
}
