import { useEffect, useState } from 'react';
import { loadDemIndex, gridContains } from '../terrain/dem';

// The 200 m terrain areas a walk can be planned in (everything else only has 15 km global data)
let cached = null;

export default function useDetailAreas() {
  const [areas, setAreas] = useState(cached || []);
  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;
    loadDemIndex()
      .then((idx) => {
        cached = idx.grids.filter((g) => g.id !== 'global');
        if (!cancelled) setAreas(cached);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return areas;
}

/** The detail area that covers a point, or null. */
export const areaOf = (areas, p) => (p ? areas.find((g) => gridContains(g, p.lat, p.lon)) || null : null);
