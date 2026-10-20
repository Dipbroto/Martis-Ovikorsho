import { Sun, Moon } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import ProvenanceBadge from './ProvenanceBadge';
import { daylight, formatSolarTime, lsFromMsd, seasonFromLs } from '../utils/marsSolar';

const EVA_MIN_SUN_ELEVATION = 5; // degrees: below this, solar power and visibility are marginal

/** Daylight and EVA window at the route's base for the current Mars date (pure orbital geometry). */
export default function DaylightCard({ lat }) {
  const sol = useMapStore((s) => s.currentSol);
  if (!Number.isFinite(lat)) return null;

  const ls = lsFromMsd(sol);
  const day = daylight(lat, ls);
  const eva = daylight(lat, ls, EVA_MIN_SUN_ELEVATION);

  let window;
  if (day.polarNight) window = 'Polar night: the sun does not rise.';
  else if (eva.polarNight) window = `The sun never climbs above ${EVA_MIN_SUN_ELEVATION}°: no usable EVA daylight.`;
  else if (day.polarDay) window = 'Midnight sun: daylight all sol.';
  else window = `EVA window ${formatSolarTime(eva.sunrise)}–${formatSolarTime(eva.sunset)} local solar time (${eva.hours.toFixed(1)} h, sun above ${EVA_MIN_SUN_ELEVATION}°).`;

  return (
    <div className="bg-space-900/80 p-3 rounded-xl border border-space-700/60 font-mono text-[10px] space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-space-300 uppercase tracking-wider font-bold">
          {day.polarNight ? <Moon className="w-3.5 h-3.5 text-indigo-300" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
          Daylight at base
        </span>
        <ProvenanceBadge type="DERIVED" size="xs" detail="Orbital geometry" />
      </div>
      <p className="text-space-200">
        Sol {sol} · Ls {ls.toFixed(0)}° · {seasonFromLs(ls)}
      </p>
      {!day.polarNight && !day.polarDay && (
        <p className="text-space-300">
          Sunrise {formatSolarTime(day.sunrise)} · Sunset {formatSolarTime(day.sunset)} · noon sun {day.noonElevation.toFixed(0)}° high
        </p>
      )}
      <p className="text-amber-200 leading-relaxed">{window}</p>
    </div>
  );
}
