import { useEffect, useRef, useState } from 'react';
import { Footprints, CloudFog, Mountain, Sunset, Sunrise, Moon, AlertTriangle, Flag, MapPin, Thermometer } from 'lucide-react';
import { fmtLtst, fmtDuration } from './walkEnvironment';
import { nearestPlace } from '../../data/places';

/**
 * Turns the walk into a short story: as the crew moves, notes appear about the weather, the ground,
 * the light and the life support. Each note fires once per walk.
 */
export default function useWalkFeed({ active, progress, telemetry, position, env, lifeLeft, maxSlope, names }) {
  const [items, setItems] = useState([]);
  const fired = useRef(new Set());
  const lastPhase = useRef(null);

  // A new walk (back at the start) clears the story
  useEffect(() => {
    if (progress < 0.003) { fired.current = new Set(); lastPhase.current = null; setItems([]); }
  }, [progress]);

  useEffect(() => {
    if (!active || !env || progress < 0.003) return;
    const out = [];
    const once = (key, item) => { if (!fired.current.has(key)) { fired.current.add(key); out.push({ id: key, at: progress, ...item }); } };
    const dist = `${telemetry.distKm.toFixed(1)} km`;
    const wx = `${Math.round(env.temp)} °C, ${env.pressure} Pa, wind ${env.windSpeed} m/s ${env.windDir}`;

    once('start', { icon: Footprints, tone: 'info', title: `Setting off from ${names.start}`, text: `Local time ${fmtLtst(env.ltst)}, ${env.phase.toLowerCase()} (Sun ${Math.round(env.sunEl)}° up). ${wx}.` });

    [0.2, 0.4, 0.6, 0.8].forEach((m) => {
      if (progress >= m) {
        const found = position ? nearestPlace(position.lat, position.lon, 1.2) : null;
        const near = found && found.name !== names.start && found.name !== names.end ? found : null;
        once(`m${m}`, { icon: Thermometer, tone: 'info', title: `${Math.round(m * 100)}% done, ${dist} walked`, text: `${near ? `Passing ${near.name}. ` : ''}${wx}. Dust haze ${env.dustRisk.toLowerCase()} (τ ${env.tau}).` });
      }
    });

    if (maxSlope > 6 && telemetry.slope >= maxSlope * 0.85) {
      once('steep', { icon: Mountain, tone: 'warn', title: `Steepest ground: ${telemetry.slope.toFixed(0)}°`, text: `Pace drops to ${telemetry.paceKmh.toFixed(1)} km/h and the suit works harder here.` });
    }
    if (env.tau >= 0.8) once('dust', { icon: CloudFog, tone: 'warn', title: 'Dust haze', text: `Dust opacity τ ${env.tau} (${env.dustRisk.toLowerCase()}): less sunlight on the suit panels and shorter sight lines.` });

    const phase = env.phase;
    if (lastPhase.current && lastPhase.current !== phase) {
      const k = `phase-${phase}-${Math.round(progress * 100)}`;
      if (phase === 'Night') once(k, { icon: Moon, tone: 'warn', title: 'Night has fallen', text: `It is ${fmtLtst(env.ltst)} local time and ${Math.round(env.temp)} °C. Suit lights on, and the air cools fast.` });
      else if (phase === 'Low sun' && env.sunEl < 8 && lastPhase.current === 'Daylight') once(k, { icon: Sunset, tone: 'info', title: 'Sun is getting low', text: `Sun ${Math.round(env.sunEl)}° above the horizon at ${fmtLtst(env.ltst)}. Long shadows hide small rocks.` });
      else if (phase === 'Daylight' && lastPhase.current !== 'Daylight') once(k, { icon: Sunrise, tone: 'good', title: 'Sun is up', text: `Sun ${Math.round(env.sunEl)}° above the horizon. It will warm up from here.` });
    }
    lastPhase.current = phase;

    const spare = lifeLeft * 2 - 100;
    if (spare < 25 && spare >= 0 && progress < 0.99) once('spare-low', { icon: AlertTriangle, tone: 'warn', title: 'Spare life support is running low', text: `Walking back from here would use almost everything that is left (${Math.round(spare)}% spare).` });
    if (spare < 0 && progress < 0.99) once('no-return', { icon: AlertTriangle, tone: 'bad', title: 'Past the point of no return', text: 'There is not enough life support left to walk all the way back on foot from here.' });

    if (progress >= 0.99) once('arrive', { icon: Flag, tone: 'good', title: `Arrived at ${names.end}`, text: `${dist} in ${fmtDuration(telemetry.hours)} on foot, with ${Math.round(lifeLeft)}% of the life support left.` });

    if (out.length) setItems((prev) => [...out.reverse(), ...prev].slice(0, 9));
  }, [active, progress, telemetry, position, env, lifeLeft, maxSlope, names]);

  return items;
}

export const FEED_ICON_FALLBACK = MapPin;
