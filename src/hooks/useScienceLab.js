import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import useMapStore from '../store/useMapStore';
import { playLaserZap, playSampleSeal } from '../utils/audioSynthesizer';
import { loadCampaignIndex, loadCampaign, analyse, aiBrief, registerCampaign } from '../data/scienceLab';
import { generateProceduralRockSample, MARTIAN_PROVINCES } from '../services/marsMlService';
import { generateScienceReport } from '../services/aiService';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../services/profileService';

const SHOT_MS = 110;
export const TOTAL_TUBES = 38; // Perseverance carries 43 tubes; 38 are for samples

// Discovered rocks are saved as the inputs that rebuild them (a few bytes each), not as their spectra (~400 kB each)
const FRONTIER_KEY = 'mars_frontier_rocks';
const OLD_FRONTIER_KEY = 'mars_frontier_samples';
const MAX_FRONTIER = 12;

/** Longitude folded into -180..180, so 400°E is the same place as 40°E. */
export const wrapLon = (lon) => Math.round((((((Number(lon) + 180) % 360) + 360) % 360) - 180) * 1e6) / 1e6;

/** "14.500°S, 175.400°E": a hemisphere letter instead of a minus sign. */
export const formatLatLon = (lat, lon, digits = 3) => (
  `${Math.abs(lat).toFixed(digits)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(digits)}°${lon < 0 ? 'W' : 'E'}`
);

// Remove the crew's science-log rows for these tubes; only tubes saved while signed in have a row id
const deleteLogs = (samples) => {
  const user = useMapStore.getState().user;
  const ids = samples.map((s) => s.logId).filter(Boolean);
  if (!user || !supabase || !ids.length) return;
  supabase.from('science_logs').delete().eq('user_id', user.id).in('id', ids).then(({ error }) => {
    if (error) console.warn('Could not remove the sample from your profile:', error.message);
    else fetchProfile(user.id);
  });
};

const loadFrontier = () => {
  try {
    localStorage.removeItem(OLD_FRONTIER_KEY); // the old format stored whole spectra and could fill the browser's quota
    const saved = JSON.parse(localStorage.getItem(FRONTIER_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.flatMap((recipe) => {
      try {
        const sample = generateProceduralRockSample(recipe);
        registerCampaign(sample.target, sample.data);
        return [sample];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
};

const saveFrontier = (samples) => {
  try {
    localStorage.setItem(FRONTIER_KEY, JSON.stringify(samples.map((s) => s.recipe).filter(Boolean)));
  } catch (e) {
    console.warn('Could not save the discovered rocks:', e);
  }
};

/**
 * Shared state and handlers for the In-Situ Science Lab page (ScienceLabPage).
 * The lab shows measured Perseverance data (SuperCam, PIXL, SHERLOC); this hook loads it and holds what the
 * visitor has picked: the rock, the instrument, the laser point and shot, the PIXL oxide and the SHERLOC spot.
 */
export default function useScienceLab() {
  const collectedSamples = useMapStore((s) => s.collectedSamples);
  const addSample = useMapStore((s) => s.addSample);
  const removeSample = useMapStore((s) => s.removeSample);
  const clearSamples = useMapStore((s) => s.clearSamples);
  const updateSample = useMapStore((s) => s.updateSample);

  const famousSites = useMemo(() => Object.values(MARTIAN_PROVINCES), []);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredSamples, setDiscoveredSamples] = useState(loadFrontier);
  // read by the rock-list loader, so a reload or a retry puts the discovered rocks back in the list
  const discoveredRef = useRef(discoveredSamples);
  discoveredRef.current = discoveredSamples;
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
  const [laserPos, setLaserPos] = useState({ x: 50, y: 50 });
  const [beamActive, setBeamActive] = useState(false);
  const [pits, setPits] = useState([]);
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
  // the beam animation of a click on the rock; cancelled when the rock changes, so it cannot play on the next one
  const beamTimer = useRef(null);
  // which measured point the next click on the rock plays
  const nextPoint = useRef(0);
  // the delayed parts of sealing a tube, cancelled if the page goes away
  const sealTimers = useRef([]);
  // which rock the latest AI request belongs to: an answer for a rock no longer shown is dropped
  const aiRequest = useRef(0);
  const stopFiring = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setIsFiringLaser(false);
  }, []);
  const stopBeam = useCallback(() => {
    if (beamTimer.current) clearTimeout(beamTimer.current);
    beamTimer.current = null;
    setBeamActive(false);
  }, []);
  useEffect(() => () => {
    stopFiring();
    stopBeam();
    sealTimers.current.forEach(clearTimeout);
  }, [stopFiring, stopBeam]);

  // the list of rocks
  useEffect(() => {
    let cancelled = false;
    setIsLoadingTargets(true);
    loadCampaignIndex().then((idx) => {
      if (cancelled) return;
      const frontier = discoveredRef.current.map((s) => s.target);
      setCampaigns([...frontier, ...idx.campaigns.filter((c) => !frontier.some((f) => f.id === c.id))]);
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
    stopBeam();
    setData(null);
    setIsLoadingData(true);
    setPointIdx(0); setShot(null); setPits([]); setHighlightedPeak(null); setPixlPick(null); setSherlocSpot(null); setAiReport(null);
    nextPoint.current = 0;
    aiRequest.current += 1; setIsAiAnalyzing(false);
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
  }, [target, reloadKey, stopFiring, stopBeam]);

  const analysis = useMemo(() => analyse(target, data), [target, data]);

  const selectTarget = (id) => setSelectedId(id);
  const retry = () => setReloadKey((k) => k + 1);

  const selectPoint = (i) => { stopFiring(); setPointIdx(i); setShot(null); };

  // Step through the 30 real laser shots of the first point, one per pulse
  const stepShots = () => {
    const pt = data?.libs?.points?.[0];
    if (!pt?.shots) return;
    const total = pt.shots.length;
    stopFiring();
    setPointIdx(0);
    setIsFiringLaser(true);
    let k = 0;
    setShot(1);
    timer.current = setInterval(() => {
      k += 1;
      if (k >= total) { stopFiring(); setShot(total); return; }
      setShot(k + 1);
    }, SHOT_MS);
  };

  const fireLaser = () => {
    if (isFiringLaser || beamActive) return;
    playLaserZap?.();
    stepShots();
  };

  // Click on the rock photo to aim and fire. NASA's public files do not give where each laser point sat on the
  // photo, so the aim only places the animation: each click plays the next real measured point of this rock.
  const fireAt = (x, y) => {
    const points = data?.libs?.points;
    if (!points?.length || isFiringLaser || beamActive) return;
    // a counter, not the number of pits shown: only the last 5 pits stay on the photo
    const next = nextPoint.current % points.length;
    nextPoint.current += 1;
    setLaserPos({ x, y });
    setBeamActive(true);
    setPits((prev) => [...prev.slice(-4), { id: Date.now(), x, y, point: next }]);
    playLaserZap?.();
    stopFiring();
    beamTimer.current = setTimeout(() => {
      beamTimer.current = null;
      setBeamActive(false);
      if (next === 0) stepShots();
      else { setPointIdx(next); setShot(null); }
    }, 500);
  };
  const showAverage = () => { stopFiring(); setShot(null); };
  const pickShot = (n) => { stopFiring(); setPointIdx(0); setShot(n); };

  const runAiAnalysis = async () => {
    if (!target || !data || !analysis) return;
    const id = ++aiRequest.current;
    setIsAiAnalyzing(true);
    const computed = {
      source: 'computed',
      mineralogy: analysis.minerals.join(', ') || 'No dominant mineral from the chemistry alone',
      interpretation: analysis.summary,
      points: analysis.evidence.slice(0, 4).map((e) => `${e.label} (${e.instrument}, ${e.level}): ${e.detail}`),
    };
    let report = null;
    try {
      report = await generateScienceReport(aiBrief(target, data, analysis));
    } catch (e) {
      console.error(e);
    }
    if (id !== aiRequest.current) return; // another rock was picked meanwhile
    setAiReport(report ? { ...report, source: 'ai' } : computed);
    setIsAiAnalyzing(false);
  };

  const discoverRockAt = useCallback(({ lat, lon, regionId, name, seed, sol = 750 }) => {
    setIsDiscovering(true);
    playLaserZap?.();
    try {
      const sample = generateProceduralRockSample({ lat, lon: wrapLon(lon), regionId, name, seed, sol });
      registerCampaign(sample.target, sample.data);

      const next = [sample, ...discoveredRef.current.filter((s) => s.target.id !== sample.target.id)].slice(0, MAX_FRONTIER);
      const keep = new Set(next.map((s) => s.target.id));
      // the oldest discovery past the limit leaves the rock list too, as it is no longer saved
      setCampaigns((prev) => [sample.target, ...prev.filter((c) => c.id !== sample.target.id && (!c.isProcedural || keep.has(c.id)))]);
      setSelectedId(sample.target.id);
      setDiscoveredSamples(next);
      saveFrontier(next);

      setTimeout(() => {
        setIsDiscovering(false);
      }, 400);

      return sample;
    } catch (err) {
      console.error('Error generating procedural rock sample:', err);
      setIsDiscovering(false);
      return null;
    }
  }, []);

  const removeDiscoveredRock = useCallback((targetId) => {
    if (!targetId) return;
    setCampaigns((prev) => {
      const next = prev.filter((c) => c.id !== targetId);
      if (selectedId === targetId) {
        setSelectedId(next[0]?.id || null);
      }
      return next;
    });
    const next = discoveredRef.current.filter((s) => s.target.id !== targetId);
    setDiscoveredSamples(next);
    saveFrontier(next);
  }, [selectedId]);

  const handleRemoveSample = useCallback((sampleId) => {
    if (!sampleId && sampleId !== 0) return;
    const sample = (useMapStore.getState().collectedSamples || []).find((s, idx) => (s.id ? s.id === sampleId : idx === sampleId));
    removeSample(sampleId);
    if (sample) deleteLogs([sample]);
  }, [removeSample]);

  const handleClearAllSamples = useCallback(() => {
    deleteLogs(useMapStore.getState().collectedSamples || []);
    if (clearSamples) {
      clearSamples();
    } else {
      useMapStore.setState({ collectedSamples: [] });
    }
  }, [clearSamples]);

  const safeSamples = Array.isArray(collectedSamples) ? collectedSamples : [];
  const tubesFull = safeSamples.length >= TOTAL_TUBES;

  // notesOverride: notes written by another deck (the core drill), used instead of the typed field notes
  const handleCacheSample = (notesOverride) => {
    if (!target || isSealingTube || tubesFull) return false;
    setIsSealingTube(true);
    setCacheError(null);
    playSampleSeal?.();

    const typed = typeof notesOverride === 'string' && notesOverride ? notesOverride : customTubeNotes;
    const notes = typed || `${target.name}, ${target.province || 'Jezero crater'} (${formatLatLon(target.lat, target.lon)})`;
    const tubeNumber = safeSamples.length + 1;
    const sampleId = `${Date.now()}`;
    const sealed = target;
    const minerals = analysis?.minerals.join(', ') || null;
    const sol = data?.libs?.sol || target.sols?.supercam || 1;
    sealTimers.current.push(setTimeout(async () => {
      addSample({
        id: sampleId,
        tubeNumber,
        name: sealed.name,
        rockType: sealed.rockType,
        status: 'SEALED IN CACHE',
        sol,
        notes,
      });

      // Signed-in crews also log the sample to their profile (the database counts it)
      const user = useMapStore.getState().user;
      if (user) {
        try {
          const { data: row, error } = await supabase.from('science_logs').insert({
            user_id: user.id,
            target_id: sealed.id,
            target_name: sealed.name,
            mineralogy: minerals,
            ph_level: null,
            notes: notes.slice(0, 2000),
          }).select('id').single();
          if (error) throw error;
          // keep the row id, so removing this tube can remove its log entry too
          if (row?.id) updateSample(sampleId, { logId: row.id });
          fetchProfile(user.id);
        } catch (e) {
          console.warn('Could not save sample to profile:', e?.message || e);
          setCacheError('Sealed locally, but saving to your profile failed.');
        }
      }

      setIsSealingTube(false);
      setCachedSuccess(true);
      setCustomTubeNotes('');
      sealTimers.current.push(setTimeout(() => setCachedSuccess(false), 3000));
    }, 1200));
    return true;
  };

  return {
    campaigns, target, data, analysis, isLoadingTargets, isLoadingData, loadError, retry, selectTarget,
    activeInstrument, setActiveInstrument,
    pointIdx, selectPoint, shot, isFiringLaser, fireLaser, fireAt, laserPos, beamActive, pits, setPits, showAverage, pickShot, highlightedPeak, setHighlightedPeak,
    oxide, setOxide, pixlPick, setPixlPick, sherlocMetric, setSherlocMetric, sherlocSpot, setSherlocSpot,
    isAiAnalyzing, aiReport, setAiReport, runAiAnalysis,
    cachedSuccess, customTubeNotes, setCustomTubeNotes, isSealingTube, cacheError, handleCacheSample, tubesFull,
    handleRemoveSample, handleClearAllSamples,
    collectedSamples, safeSamples, paleoPh, setPaleoPh,
    famousSites, discoverRockAt, removeDiscoveredRock, isDiscovering,
  };
}
