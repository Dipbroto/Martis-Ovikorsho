import { useEffect, useState } from 'react';
import { Polyline, Tooltip } from 'react-leaflet';

const STYLE = {
  perseverance: { color: '#fb923c', label: 'Perseverance' },
  curiosity: { color: '#a78bfa', label: 'Curiosity' },
};

/** Real rover drive paths from NASA/JPL MMGIS, drawn as a reference for what vehicles have actually traversed. */
export default function RoverTraverses() {
  const [traverses, setTraverses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/traverses.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => !cancelled && setTraverses(json.traverses))
      .catch((err) => console.warn('Rover traverses unavailable:', err.message));
    return () => { cancelled = true; };
  }, []);

  return traverses.map((t) => (
    <Polyline
      key={t.id}
      positions={t.points}
      pathOptions={{ color: STYLE[t.id]?.color || '#94a3b8', weight: 2, opacity: 0.85 }}
    >
      <Tooltip sticky>
        {t.name}: {t.lengthKm} km driven{t.lastSol ? ` through sol ${t.lastSol}` : ''} (NASA/JPL)
      </Tooltip>
    </Polyline>
  ));
}
