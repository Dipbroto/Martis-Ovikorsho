import { useEffect, useState } from 'react';
import { ImageOverlay, Pane } from 'react-leaflet';
import { loadGrid } from '../terrain/dem';
import { renderHillshade } from '../terrain/hillshade';

// A whole-planet shaded relief from the MOLA elevation grid the app already loads, drawn under the
// NASA Trek imagery. Trek tiles take ~2 s each, so this keeps the map from showing black squares while
// they load, or entirely if Trek is unreachable on demo day. It is tinted one dusty Mars tone (no
// false-colour ramp) so it reads as real terrain and blends into the imagery that loads over it.

let cached = null;

export default function ReliefLayers() {
  const [base, setBase] = useState(cached);

  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;
    loadGrid('global')
      .then((g) => {
        // Drawing a 1440 x 720 relief takes a moment; let the map paint first
        setTimeout(() => {
          if (cancelled) return;
          cached = renderHillshade(g, { exaggeration: 14, tint: [176, 118, 84] }).toDataURL('image/jpeg', 0.85);
          setBase(cached);
        }, 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <Pane name="relief-base" style={{ zIndex: 150 }}>
      {base && <ImageOverlay url={base} bounds={[[-90, -180], [90, 180]]} interactive={false} />}
    </Pane>
  );
}
