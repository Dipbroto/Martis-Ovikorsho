import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'framer-motion';

function CountUp({ value, decimals = 0, suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView || value === null) return undefined;
    const controls = animate(0, value, { duration: 1.4, ease: [0.2, 0.7, 0.2, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [inView, value]);
  return (
    <span ref={ref} className="tabular-nums">
      {value === null ? '—' : shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Headline numbers, each read from the data the app ships. */
export default function StatsBand() {
  const [stats, setStats] = useState({ roverKm: null, steepPct: null, caves: null, sites: null });

  useEffect(() => {
    let cancelled = false;
    const json = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([json('/data/validation.json'), json('/data/caves.json'), json('/data/dem/index.json')]).then(([v, c, d]) => {
      if (cancelled) return;
      setStats({
        roverKm: v ? v.results.reduce((s, r) => s + r.traverseKm, 0) : null,
        steepPct: v ? Math.max(...v.results.map((r) => r.roverPathOver20DegPct)) : null,
        caves: c ? c.caves.length : null,
        sites: d ? d.grids.filter((g) => g.id !== 'global').length : null,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const items = [
    { value: stats.sites, label: 'areas of Mars mapped at 200 m per pixel' },
    { value: stats.roverKm, label: 'km of real Curiosity and Perseverance drives re-planned' },
    { value: stats.steepPct, label: 'of those rover paths rated too steep to walk', suffix: '%' },
    { value: stats.caves, label: 'cave candidates mapped as natural shelter' },
  ];

  return (
    <section className="border-y border-white/[0.07] bg-gradient-to-b from-[#0a0c11] to-[#05070b]">
      <div className="max-w-[1500px] mx-auto px-5 sm:px-10 py-12 grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6">
        {items.map(({ value, label, suffix }) => (
          <div key={label} className="lg:border-l lg:border-white/10 lg:pl-6 first:border-0 first:pl-0">
            <div className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
              <CountUp value={value} suffix={suffix} />
            </div>
            <p className="mt-2 text-sm text-zinc-400 max-w-[16rem] leading-snug">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
