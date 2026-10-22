import { Ruler } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import { marsDistance, calculateSlope } from '../../utils/marsUtils';
import DockCard from './DockCard';

/** Result of the measure tool: distance, height change and slope between two clicked points. */
export default function RulerCard() {
  const { active, points, setActive, clear } = useMapStore(useShallow((s) => ({ active: s.isRulerActive, points: s.rulerPoints, setActive: s.setRulerActive, clear: s.clearRuler })));
  if (!active) return null;
  const close = () => { setActive(false); clear(); };

  let body = <p className="text-sm text-zinc-300">Click the first point on the map.</p>;
  if (points.length === 1) body = <p className="text-sm text-zinc-300">Now click the second point.</p>;
  if (points.length >= 2) {
    const [a, b] = points;
    const km = marsDistance(a.lat, a.lon, b.lat, b.lon);
    const dz = (b.elevation || 0) - (a.elevation || 0);
    const slope = Math.abs(calculateSlope(a.elevation || 0, b.elevation || 0, km * 1000));
    body = (
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[['Distance', `${km.toFixed(2)} km`], ['Height change', `${dz > 0 ? '+' : ''}${Math.round(dz)} m`], ['Average slope', `${slope.toFixed(1)}°`]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/[0.04] px-1 py-2">
            <div className="text-[11px] text-zinc-400">{k}</div>
            <div className={`text-sm font-semibold tabular-nums ${k === 'Average slope' && slope > 15 ? 'text-rose-300' : 'text-white'}`}>{v}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <DockCard id="ruler" title="Measure distance" subtitle="Two clicks on the map" icon={Ruler} accent="#fde047" onClose={close}>
      {body}
    </DockCard>
  );
}
