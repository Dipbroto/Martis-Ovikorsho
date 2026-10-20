import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Database, Cpu, FlaskConical, ShieldCheck } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { EVA_ASSUMPTIONS } from '../terrain/evaModel';

const DATASETS = [
  {
    name: 'HRSC-MOLA Blended DEM, 200 m/px',
    use: 'Terrain for slope, route planning, point of no return and radio coverage at seven hero sites',
    cite: 'Fergason et al. 2018, USGS Astrogeology',
    href: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m',
  },
  {
    name: 'MGS MOLA MEGDR topography, 4 px/deg',
    use: 'Global elevation (coarse) and the elevation readout anywhere on the planet',
    cite: 'Smith et al., PDS Geosciences Node',
    href: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html',
  },
  {
    name: 'Mars Trek WMTS tiles',
    use: 'Imagery, topography and mineral map layers',
    cite: 'NASA/JPL Mars Trek',
    href: 'https://trek.nasa.gov/mars/',
  },
  {
    name: 'Rover traverse paths (Perseverance, Curiosity)',
    use: 'Reference tracks and validation of the planner against real drives',
    cite: 'NASA/JPL MMGIS',
    href: 'https://mars.nasa.gov/maps/',
  },
  {
    name: 'Mars Odyssey GRS water map (5° bins)',
    use: 'WATER layer: water in the top metre of soil at low and mid latitudes',
    cite: 'Boynton et al. 2007, PDS Geosciences Node',
    href: 'https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html',
  },
  {
    name: 'Mars Global Cave Candidate Catalog',
    use: 'SHELTER layer: about 1,060 pits and skylights that could shelter a crew',
    cite: 'Cushing 2017, USGS Astrogeology / PDS',
    href: 'https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing',
  },
  {
    name: 'NASA Image and Video Library',
    use: 'Image gallery (not georeferenced, so no map position is shown)',
    cite: 'NASA',
    href: 'https://images.nasa.gov/',
  },
  {
    name: 'Areocentric solar longitude and daylight',
    use: 'Season and sunrise / sunset from orbital mechanics',
    cite: 'Allison & McEwen 2000',
    href: 'https://doi.org/10.1016/S0032-0633(99)00092-6',
  },
];

const MODELS = [
  ['Walking energy', 'Minetti et al. 2002 gradient cost of walking, scaled by Mars gravity (0.38 g), plus a resting load'],
  ['Walking speed', "Tobler's hiking function rescaled to the suited pace below"],
  ['Route planner', 'A* search on the elevation grid (16 directions) minimising the chosen cost; steps steeper than the slope limit are impassable'],
  ['Point of no return', 'Cheapest-path energy from the base and from your position, compared with the remaining life-support budget'],
  ['Radio coverage', 'Line of sight from a 10 m antenna to a receiver 2 m above ground, including terrain and Mars curvature'],
];

const SIMULATED = [
  'Weather, dust-risk and radiation panels: seasonal models, not live instrument feeds',
  'HUD telemetry radar, graphs and log stream: illustrative',
  'Rover and EVA telemetry during the drive simulation',
  'Science lab spectra: curated targets with published characteristics',
  '2 km / 5 km walkback rings: team planning assumptions, not NASA requirements',
  'AI copilot: chooses where to go; it never supplies elevations, slopes or distances',
];

export default function DataMethodsModal() {
  const open = useMapStore((s) => s.isDataMethodsOpen);
  const setOpen = useMapStore((s) => s.setDataMethodsOpen);
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    if (!open || validation) return;
    fetch('/data/validation.json').then((r) => (r.ok ? r.json() : null)).then(setValidation).catch(() => {});
  }, [open, validation]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const a = EVA_ASSUMPTIONS;

  return (
    <AnimatePresence>
      {open && (
        <div key="data-methods" className="fixed inset-0 z-[650] flex items-center justify-center p-3 sm:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#07090E]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden font-sans text-white"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#ff8c69]">Transparency</div>
                <h2 className="text-lg font-bold">Data &amp; Methods</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6 text-sm custom-scrollbar-y">
              <section>
                <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300 mb-2"><Database className="w-4 h-4" />NASA and partner data used</h3>
                <ul className="space-y-2">
                  {DATASETS.map((d) => (
                    <li key={d.name} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                      <a href={d.href} target="_blank" rel="noreferrer" className="font-semibold text-white hover:text-cyan-300 underline-offset-2 hover:underline">{d.name}</a>
                      <p className="text-zinc-400 text-xs mt-0.5">{d.use}</p>
                      <p className="text-zinc-500 text-[11px] font-mono mt-0.5">{d.cite}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300 mb-2"><Cpu className="w-4 h-4" />How the numbers are computed</h3>
                <ul className="space-y-1.5 text-zinc-300 text-xs">
                  {MODELS.map(([k, v]) => (
                    <li key={k}><span className="font-semibold text-white">{k}:</span> {v}</li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  {[
                    ['Crew + suit mass', `${a.crewMassKg} + ${a.suitMassKg} kg`],
                    ['Level walking pace', `${a.flatSpeedKmh} km/h`],
                    ['Steepest walkable grade', `${a.maxSlopeDeg}°`],
                    ['Life support', `${a.lifeSupportHours} h at nominal workload`],
                    ['Emergency reserve', `${Math.round(a.reserveFraction * 100)}% of budget`],
                    ['Resting power', `${a.restingPowerW} W`],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-black/40 border border-white/[0.06] rounded p-2">
                      <div className="text-zinc-500 text-[9px] uppercase">{k}</div>
                      <div className="text-white">{v}</div>
                    </div>
                  ))}
                </div>
                <p className="text-zinc-500 text-[11px] mt-2">These are planning assumptions chosen by the team, not mission requirements. Terrain is 200 m/px, so metre-scale hazards (boulders, small scarps) are not resolved.</p>
              </section>

              <section>
                <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-emerald-300 mb-2"><ShieldCheck className="w-4 h-4" />Checked against real rover drives</h3>
                {validation ? (
                  <div className="space-y-2">
                    {validation.results.map((r) => (
                      <div key={r.site} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-xs text-zinc-300">
                        <div className="font-semibold text-white">{r.site} <span className="text-zinc-500 font-mono">({r.traverseKm} km of real driving)</span></div>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-zinc-400">
                          <li>{r.roverPathOver20DegPct}% of the real rover path is steeper than {a.maxSlopeDeg}° on our terrain (median {r.roverMedianSlopeDeg}°, 95th percentile {r.roverP95SlopeDeg}°): the elevation data agrees with where vehicles chose to drive.</li>
                          <li>On {r.directDrives} drives that went straight from A to B, planned routes were {r.plannedToRoverLengthMedian}x the distance the rover drove (median); planned routes are {r.plannedDetourVsStraightMedian}x the straight line.</li>
                        </ul>
                      </div>
                    ))}
                    <p className="text-zinc-500 text-[11px]">Reproduce with <span className="font-mono">WRITE_VALIDATION=1 npm test</span>. Rovers sometimes drive longer paths for science or to protect their wheels, so planned routes are expected to be somewhat shorter.</p>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs">Loading validation results...</p>
                )}
              </section>

              <section>
                <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-amber-300 mb-2"><FlaskConical className="w-4 h-4" />What is simulated</h3>
                <ul className="space-y-1 text-zinc-300 text-xs list-disc list-inside">
                  {SIMULATED.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
