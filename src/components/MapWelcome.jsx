import { useState } from 'react';
import { Compass } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import DockCard from './dock/DockCard';

const KEY = 'marswalk-welcome-dismissed';

const read = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};

const STEPS = [
  ['Choose where to start and where to go', 'Pick from the list, or press the crosshair and click the map'],
  ['See the route on real NASA terrain', 'Slope-aware, with the time and life support it needs'],
  ['Walk it', 'Watch the crew go, with the weather, light and ground along the way'],
];

/** First-visit card at the top of the dock: the idea in three steps. It goes away for good once closed. */
export default function MapWelcome() {
  const hasRoute = useMapStore((s) => s.waypoints.length > 0);
  const [dismissed, setDismissed] = useState(read);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode: it will just show again next visit */ }
  };
  if (dismissed || hasRoute) return null;

  return (
    <DockCard id="welcome" title="Plan a walk on Mars" subtitle="and make sure you can get back" icon={Compass} accent="#ffa07f" onClose={dismiss}>
      <ol className="space-y-2.5">
        {STEPS.map(([title, desc], i) => (
          <li key={title} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#ff7b4d]/20 text-[#ffa07f] text-sm font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
            <span>
              <span className="block text-sm text-white font-medium leading-snug">{title}</span>
              <span className="block text-xs text-zinc-400 leading-snug">{desc}</span>
            </span>
          </li>
        ))}
      </ol>
    </DockCard>
  );
}
